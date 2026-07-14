import * as THREE from 'three';
import { CombatPhysicsWorld, initializeCombatPhysics } from './CombatPhysicsWorld.js';
import { HumanoidCombatActor } from './HumanoidCombatActor.js';
import { CombatBloodEffects } from './CombatBloodEffects.js';
import { CombatFeedbackSystem } from './CombatFeedbackSystem.js';
import { resolveCombatMortalityMode } from './CombatMortality.js';
import { TESTMAN_COMBAT_PROFILE } from './HumanoidModelProfiles.js';
import { CombatDirector } from './CombatDirector.js';
import { KNIFE_COMBAT_CONFIG } from './CombatConfig.js';
import { applyMeleeSpacingEnvelope } from './CombatPresentation.js';
import { preloadKnifeWoundDecalLibrary } from './KnifeWoundDecalLibrary.js';
import { CombatActorRouter } from './CombatActorRouter.js';
import { COMBAT_LAB_WALKER_CONFIG, CombatLabWalkerController, WALKER_STATES } from './CombatLabWalkerController.js';
import { AuthoredHumanoidDeathController } from './AuthoredHumanoidDeathController.js';

const FOLSOM_AUTHORED_PLAYER_SPAWN = Object.freeze([-2, 1.71, -4]);
const FOLSOM_TESTMAN_SPAWN_XZ = Object.freeze([8, -4]);
const FOLSOM_COMBAT_RANGE = 6.5;

export const FOLSOM_COMBAT_FOOTPRINT = Object.freeze({
  minX: -11,
  maxX: 15,
  minZ: -13,
  maxZ: 11,
});

export const FOLSOM_RAPIER_SUPPORT = Object.freeze({
  minX: -12.5,
  maxX: 16.5,
  minZ: -14.5,
  maxZ: 12.5,
  thickness: 0.2,
});

export const FOLSOM_WALKER_CONFIG = Object.freeze({
  ...COMBAT_LAB_WALKER_CONFIG,
  fallbackPosition: Object.freeze([-4.05, 0.16, 1.65]),
  spawnCandidateCount: 12,
});

export const FOLSOM_ENEMY_WAVE_CONFIG = Object.freeze({
  size: 2,
  corpseDespawnSeconds: 10,
  corpseFadeSeconds: 1,
  respawnDelaySeconds: 2,
});

const DEATH_STATES = new Set([WALKER_STATES.losingConsciousness, WALKER_STATES.grounded]);
const createCorpseLifecycle = () => ({ started: false, elapsed: 0, opacity: 1, despawned: false, actorInstanceId: null });

const isInsideBounds = (position, bounds, margin = 0) => Boolean(position
  && position.x >= bounds.minX + margin
  && position.x <= bounds.maxX - margin
  && position.z >= bounds.minZ + margin
  && position.z <= bounds.maxZ - margin);

export function isFolsomCombatActorRelevant(actor, walkerController = null, stationaryDeathController = null) {
  if (!actor || actor.disposed) return false;
  if (actor === stationaryDeathController?.actor && [WALKER_STATES.losingConsciousness, WALKER_STATES.grounded].includes(stationaryDeathController.state)) return false;
  if (actor !== walkerController?.actor) return true;
  return ![WALKER_STATES.losingConsciousness, WALKER_STATES.grounded, WALKER_STATES.disposed, WALKER_STATES.respawning].includes(walkerController.state);
}

export class FolsomCombatEncounter {
  static async create(options = {}) {
    await Promise.all([initializeCombatPhysics(), preloadKnifeWoundDecalLibrary()]);
    return new FolsomCombatEncounter(options);
  }

  constructor({ dungeon, audioRuntime = null, query = new URLSearchParams(globalThis.location?.search ?? ''), player = null } = {}) {
    this.dungeon = dungeon;
    this.scene = dungeon.scene;
    this.query = query;
    this.player = player ?? { position: new THREE.Vector3(...FOLSOM_AUTHORED_PLAYER_SPAWN), yaw: 0 };
    this.physics = new CombatPhysicsWorld();
    this.feedbackSystem = new CombatFeedbackSystem({ audioRuntime });
    this.combatRouter = new CombatActorRouter();
    this.weaponController = null;
    this.disposed = false;
    this.modelProfile = TESTMAN_COMBAT_PROFILE;
    this.playerSpawn = new THREE.Vector3(...FOLSOM_AUTHORED_PLAYER_SPAWN);
    this.supportFloors = [];
    this.supportGroundVariation = 0;
    this.createRapierGroundSupport();

    this.spawnPosition = this.resolveCombatSpawn();
    const sampledGround = dungeon.collision?.sampleWalkableY?.(this.spawnPosition.x, this.spawnPosition.z, 0.16);
    this.groundY = Number.isFinite(sampledGround?.y) ? sampledGround.y : 0.16;
    const spawnOffset = new THREE.Vector3(this.spawnPosition.x, this.groundY, this.spawnPosition.z + 3.55);
    const spawnYaw = Math.atan2(this.playerSpawn.x - this.spawnPosition.x, this.playerSpawn.z - this.spawnPosition.z);
    this.actor = new HumanoidCombatActor({ physics: this.physics, scene: this.scene, spawnOffset, spawnYaw, visualProfile: this.modelProfile, mortalityMode: resolveCombatMortalityMode(), automaticMortality: false, isolateVisualMaterials: true, eventSink: (event, payload) => this.handleStationaryCombatEvent(event, payload) });
    this.actor.root.name = 'folsom-testman-combat-subject';
    this.playerBlocker = this.actor.updatePlayerCollisionBlocker({ id: 'folsom-testman-combat-player-blocker' });
    this.meleeSpacing = this.applyActorMeleeSpacing(this.playerBlocker);
    this.dungeon.collision?.addBlocker?.(this.playerBlocker);
    this.actor.setEnvironmentContactHints({ groundY: this.groundY, wallX: null });
    this.bloodEffects = new CombatBloodEffects({ scene: this.scene, woundSystem: this.actor.woundSystem, physiology: this.actor.physiology, groundY: this.groundY, eventSink: (event, payload) => this.handleStationaryCombatEvent(event, payload) });
    this.combatDirector = new CombatDirector({ actor: this.actor, bloodEffects: this.bloodEffects, feedbackSystem: this.feedbackSystem });
    this.combatRouter.register(this.actor, this.combatDirector);
    this.stationaryDeathCollisionReleased = false;
    this.stationaryDeathController = new AuthoredHumanoidDeathController({
      actor: this.actor,
      groundY: this.groundY,
      onDeathStarted: (actor) => this.releaseStationaryDeathCollisionOwnership(actor),
    });

    this.walkerController = new CombatLabWalkerController({
      scene: this.scene,
      physics: this.physics,
      collision: this.dungeon.collision,
      combatRouter: this.combatRouter,
      stationaryActor: this.actor,
      feedbackSystem: this.feedbackSystem,
      playerProvider: () => this.player,
      enabled: this.query.get('folsomWalker') !== '0',
      query: this.query,
      config: FOLSOM_WALKER_CONFIG,
      environment: this.createWalkerEnvironment(),
      beforeActorDisposal: (actor, reason) => this.weaponController?.cancelTarget?.(actor, reason),
    });
    this.walkerController.prepareFrame(0, this.player);
    this.waveGeneration = 1;
    this.resetEnemyWaveLifecycle();
    this.priorityCombatActor = this.getPriorityCombatActor(this.player);
    this.combatActiveActor = null;
  }

  applyActorMeleeSpacing(blocker) {
    return applyMeleeSpacingEnvelope(blocker, {
      playerRadius: this.dungeon.collision?.playerRadius,
      readyReach: Math.abs(KNIFE_COMBAT_CONFIG.workspace.ready[2]) + KNIFE_COMBAT_CONFIG.bladeLength,
      gestureReach: KNIFE_COMBAT_CONFIG.workspace.thrustDistance,
      effectiveDepth: KNIFE_COMBAT_CONFIG.maximumPenetrationDepth,
    });
  }

  createRapierGroundSupport() {
    const bounds = FOLSOM_RAPIER_SUPPORT;
    const centerX = (bounds.minX + bounds.maxX) * 0.5;
    const centerZ = (bounds.minZ + bounds.maxZ) * 0.5;
    const probes = [[centerX, centerZ], [bounds.minX, bounds.minZ], [bounds.maxX, bounds.minZ], [bounds.minX, bounds.maxZ], [bounds.maxX, bounds.maxZ]];
    const heights = probes.map(([x, z]) => this.dungeon.collision?.sampleWalkableY?.(x, z, 0.16)?.y).filter(Number.isFinite);
    this.supportGroundVariation = heights.length ? Math.max(...heights) - Math.min(...heights) : 0;
    if (this.supportGroundVariation <= 0.08) {
      this.createRapierSupportTile(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ);
      return;
    }
    const columns = 3;
    const rows = 3;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const minX = THREE.MathUtils.lerp(bounds.minX, bounds.maxX, column / columns);
        const maxX = THREE.MathUtils.lerp(bounds.minX, bounds.maxX, (column + 1) / columns);
        const minZ = THREE.MathUtils.lerp(bounds.minZ, bounds.maxZ, row / rows);
        const maxZ = THREE.MathUtils.lerp(bounds.minZ, bounds.maxZ, (row + 1) / rows);
        this.createRapierSupportTile(minX, maxX, minZ, maxZ);
      }
    }
  }

  createRapierSupportTile(minX, maxX, minZ, maxZ) {
    const bounds = FOLSOM_RAPIER_SUPPORT;
    const centerX = (minX + maxX) * 0.5;
    const centerZ = (minZ + maxZ) * 0.5;
    const sample = this.dungeon.collision?.sampleWalkableY?.(centerX, centerZ, 0.16);
    const groundY = Number.isFinite(sample?.y) ? sample.y : 0.16;
    this.supportFloors.push(this.physics.createFixedBox({
      position: { x: centerX, y: groundY - bounds.thickness * 0.5, z: centerZ },
      halfExtents: { x: (maxX - minX) * 0.5, y: bounds.thickness * 0.5, z: (maxZ - minZ) * 0.5 },
      userData: { type: 'folsom-bounded-combat-ground-support' },
    }));
  }

  isRapierSupported(position, margin = 0.35) {
    return isInsideBounds(position, FOLSOM_RAPIER_SUPPORT, margin);
  }

  createWalkerEnvironment() {
    return {
      id: 'folsom',
      spawnMode: 'forwardCone',
      queryKeys: { pause: 'folsomWalkerPause', speed: 'folsomWalkerSpeed' },
      getPlayerPosition: (player) => player?.position ?? null,
      getPlayerFacingYaw: (player) => player?.yaw ?? 0,
      sampleGround: (x, z) => this.dungeon.collision?.sampleWalkableY?.(x, z, this.groundY ?? 0.16),
      isInsideEncounter: (position, margin = 0) => isInsideBounds(position, FOLSOM_COMBAT_FOOTPRINT, margin),
      canSpawnForPlayer: (_player, position) => isInsideBounds(position, FOLSOM_COMBAT_FOOTPRINT, 0.75),
      getBlockingEntries: (position, radius) => this.dungeon.collision?.getIntersectingBlockers?.({ x: position.x, y: position.y + 1.55, z: position.z }, radius) ?? [],
      isInsideWater: (position) => this.dungeon.isPositionInFishingWater?.({ x: position.x, z: position.z }, 0.02) === true,
      validateSpawnCandidate: (candidate) => (this.dungeon.collision?.canStandAtFloorPosition?.(candidate) ?? true) && this.isRapierSupported(candidate, 0.65),
      getFallbackSpawn: ({ playerPosition, facingYaw, side }) => {
        const angle = facingYaw + side * THREE.MathUtils.degToRad(22);
        return new THREE.Vector3(playerPosition.x + Math.sin(angle) * 6, 0.16, playerPosition.z + Math.cos(angle) * 6);
      },
      getBloodGroundHeight: (position) => this.dungeon.collision?.sampleWalkableY?.(position.x, position.z, position.y)?.y ?? position.y,
      getBloodWallX: () => null,
      getActorName: (generation) => `folsom-authored-walker-${generation}`,
      getBlockerName: (generation) => `folsom-authored-walker-blocker-${generation}`,
      getFeedbackOwner: (generation) => `folsom-walker-${generation}`,
      ensureRapierGroundSupport: ({ spawnPosition, playerPosition }) => ({
        supported: this.isRapierSupported(spawnPosition) && this.isRapierSupported(playerPosition),
        supportFloorCount: this.supportFloors.length,
      }),
      onWalkerSpawned: ({ blocker }) => this.applyActorMeleeSpacing(blocker),
    };
  }

  resolveCombatSpawn() {
    const candidates = [[10, 0], [-10, 0], [0, 10], [0, -10]];
    for (const [dx, dz] of candidates) {
      const x = this.playerSpawn.x + dx;
      const z = this.playerSpawn.z + dz;
      const sampled = this.dungeon.collision?.sampleWalkableY?.(x, z, 0.16);
      const floorY = Number.isFinite(sampled?.y) ? sampled.y : 0.16;
      const floorPosition = new THREE.Vector3(x, floorY, z);
      const walkable = this.dungeon.collision?.canStandAtFloorPosition?.(floorPosition) ?? true;
      const blocked = (this.dungeon.collision?.getIntersectingBlockers?.(new THREE.Vector3(x, floorY + 1.55, z), 0.5) ?? []).length > 0;
      if (walkable && !blocked) return floorPosition;
    }
    return new THREE.Vector3(FOLSOM_TESTMAN_SPAWN_XZ[0], 0.16, FOLSOM_TESTMAN_SPAWN_XZ[1]);
  }

  handleStationaryCombatEvent(event, payload = {}) {
    if (event === 'final_exhale') this.feedbackSystem.stopOwnerVocal('folsom-combat-stationary');
    if (this.combatDirector) this.combatDirector.forwardFeedbackEvent(event, { ...payload, owner: 'folsom-combat-stationary' });
    else this.feedbackSystem.emit(event, { ...payload, owner: 'folsom-combat-stationary' });
  }

  getActiveCombatActors() {
    return [this.actor, this.walkerController?.actor].filter((actor) => isFolsomCombatActorRelevant(actor, this.walkerController, this.stationaryDeathController));
  }

  releaseStationaryDeathCollisionOwnership(actor = this.actor) {
    if (!actor || actor !== this.actor || this.stationaryDeathCollisionReleased) return false;
    this.stationaryDeathCollisionReleased = true;
    this.weaponController?.cancelTarget?.(actor, 'folsom-stationary-death-collision-release');
    this.combatRouter.unregister(actor);
    actor.colliders?.forEach?.((collider) => collider.setEnabled?.(false));
    this.dungeon.collision?.removeBlocker?.(this.playerBlocker);
    return true;
  }

  getPriorityCombatActor(player = this.player) {
    if (!player?.position) return null;
    let selected = null;
    let selectedDistance = Infinity;
    for (const actor of this.getActiveCombatActors()) {
      const pelvis = actor.getBodyWorldPosition('pelvis');
      const distance = player.position.distanceTo(pelvis);
      if (distance < selectedDistance) {
        selected = actor;
        selectedDistance = distance;
      }
    }
    return selected;
  }

  isPlayerInCombatRange(player = this.player) {
    const actor = this.getPriorityCombatActor(player);
    this.combatActiveActor = actor && player?.position?.distanceTo(actor.getBodyWorldPosition('pelvis')) <= FOLSOM_COMBAT_RANGE ? actor : null;
    return Boolean(this.combatActiveActor);
  }

  attachWeaponController(controller) {
    if (this.weaponController === controller) return;
    this.weaponController?.cancel?.('controller-replaced');
    this.weaponController = controller;
  }

  resetEnemyWaveLifecycle() {
    this.enemyWaveCorpses = {
      stationary: createCorpseLifecycle(),
      walker: createCorpseLifecycle(),
    };
    this.waveRespawnElapsed = 0;
  }

  setCorpseOpacity(actor, bloodEffects, opacity) {
    if (!actor) return;
    const value = THREE.MathUtils.clamp(Number(opacity) || 0, 0, 1);
    actor.visualAdapter?.setOpacity?.(value);
    actor.woundSystem?.setOpacity?.(value);
    bloodEffects?.setOpacity?.(value);
  }

  advanceCorpseLifecycle(slot, actor, state, bloodEffects, onDespawn, deltaSeconds) {
    if (!slot || slot.despawned || !actor || !DEATH_STATES.has(state)) return;
    if (!slot.started) {
      slot.started = true;
      slot.actorInstanceId = actor.instanceId;
    }
    slot.elapsed += Math.max(0, Number(deltaSeconds) || 0);
    const fadeStart = FOLSOM_ENEMY_WAVE_CONFIG.corpseDespawnSeconds - FOLSOM_ENEMY_WAVE_CONFIG.corpseFadeSeconds;
    slot.opacity = slot.elapsed <= fadeStart
      ? 1
      : 1 - THREE.MathUtils.clamp((slot.elapsed - fadeStart) / FOLSOM_ENEMY_WAVE_CONFIG.corpseFadeSeconds, 0, 1);
    this.setCorpseOpacity(actor, bloodEffects, slot.opacity);
    if (slot.elapsed < FOLSOM_ENEMY_WAVE_CONFIG.corpseDespawnSeconds) return;
    slot.opacity = 0;
    slot.despawned = true;
    this.setCorpseOpacity(actor, bloodEffects, 0);
    actor.root.visible = false;
    onDespawn?.();
  }

  updateEnemyWaveLifecycle(deltaSeconds) {
    const dt = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
    const bothAlreadyDespawned = this.enemyWaveCorpses.stationary.despawned && this.enemyWaveCorpses.walker.despawned;
    this.advanceCorpseLifecycle(
      this.enemyWaveCorpses.stationary,
      this.actor,
      this.stationaryDeathController?.state,
      this.bloodEffects,
      null,
      dt,
    );
    const walkerActor = this.walkerController?.actor;
    this.advanceCorpseLifecycle(
      this.enemyWaveCorpses.walker,
      walkerActor,
      this.walkerController?.state,
      this.walkerController?.bloodEffects,
      () => this.walkerController?.disposeWalker?.({ respawn: false }),
      dt,
    );
    const bothDespawned = this.enemyWaveCorpses.stationary.despawned && this.enemyWaveCorpses.walker.despawned;
    if (!bothDespawned) {
      this.waveRespawnElapsed = 0;
      return;
    }
    if (!bothAlreadyDespawned) {
      this.waveRespawnElapsed = 0;
      return;
    }
    this.waveRespawnElapsed += dt;
    if (this.waveRespawnElapsed >= FOLSOM_ENEMY_WAVE_CONFIG.respawnDelaySeconds) this.startNextEnemyWave();
  }

  startNextEnemyWave() {
    this.waveGeneration += 1;
    return this.reset(this.player, { preserveWaveGeneration: true, reason: 'enemy-wave-respawn' });
  }

  update(deltaSeconds, player = this.player) {
    if (this.disposed) return;
    this.player = player ?? this.player;
    if (!this.physics.paused) this.walkerController?.prepareFrame(deltaSeconds, this.player);
    if (!this.physics.paused) this.stationaryDeathController?.prepareFrame(deltaSeconds);
    this.actor.prepareFrame(deltaSeconds);
    this.walkerController?.actor?.prepareFrame(deltaSeconds);
    this.physics.step(deltaSeconds, (dt) => {
      this.feedbackSystem.update(dt);
      this.weaponController?.beforePhysics?.(dt);
      this.combatDirector.update(dt);
      this.stationaryDeathController?.beforePhysics();
      if (!this.stationaryDeathController?.shouldHoldFinalPose?.()) this.actor.beforePhysics(dt, this.player?.position);
      this.walkerController?.beforePhysics(dt, this.player?.position);
    }, (dt) => {
      this.weaponController?.afterPhysicsStep?.(dt);
      this.bloodEffects.update(dt);
      this.walkerController?.afterPhysicsStep(dt);
    });
    this.actor.afterPhysics(this.physics.interpolationAlpha);
    this.walkerController?.afterPhysics(this.physics.interpolationAlpha);
    if (!this.stationaryDeathCollisionReleased) this.actor.updatePlayerCollisionBlocker(this.playerBlocker);
    this.updateEnemyWaveLifecycle(deltaSeconds);
    this.priorityCombatActor = this.getPriorityCombatActor(this.player);
    const combatShadowTarget = this.priorityCombatActor?.getBodyWorldPosition?.('upper_chest');
    if (combatShadowTarget) this.scene.userData.activeCombatShadowTarget = combatShadowTarget;
    else delete this.scene.userData.activeCombatShadowTarget;
    this.weaponController?.afterPhysics?.(this.physics.interpolationAlpha);
  }

  reset(player = this.player, { preserveWaveGeneration = false, reason = 'encounter-reset' } = {}) {
    if (this.disposed) return false;
    this.player = player ?? this.player;
    this.weaponController?.cancel?.(reason);
    this.actor.root.visible = true;
    this.stationaryDeathController?.reset();
    this.actor.reset();
    this.combatRouter.register(this.actor, this.combatDirector);
    this.actor.updatePlayerCollisionBlocker(this.playerBlocker);
    this.dungeon.collision?.addBlocker?.(this.playerBlocker);
    this.stationaryDeathCollisionReleased = false;
    this.bloodEffects.clear();
    this.bloodEffects.setOpacity(1);
    this.combatDirector.reset();
    this.walkerController.stationaryActor = this.actor;
    this.walkerController?.reset(this.player);
    this.feedbackSystem.reset();
    this.weaponController?.reset?.();
    if (!preserveWaveGeneration) this.waveGeneration = 1;
    this.resetEnemyWaveLifecycle();
    this.priorityCombatActor = this.getPriorityCombatActor(this.player);
    return true;
  }

  getDiagnostics() {
    const routing = this.combatRouter.getDiagnostics();
    return {
      modelProfileName: this.modelProfile.name,
      stationaryActorId: this.actor?.instanceId ?? null,
      stationaryDeathCollisionReleased: this.stationaryDeathCollisionReleased,
      walkerActorId: this.walkerController?.actor?.instanceId ?? null,
      routerActorCount: routing.actorCount,
      routerColliderCount: routing.colliderCount,
      priorityCombatActor: this.priorityCombatActor?.instanceId ?? null,
      combatActiveDueToActor: this.combatActiveActor?.instanceId ?? null,
      walkerSpawnPoint: this.walkerController?.spawnDiagnostics?.point ?? null,
      walkerGroundHeight: this.walkerController?.spawnGroundHeight ?? null,
      encounterFootprintActive: this.walkerController?.footprintActive ?? false,
      supportFloorCount: this.supportFloors.length,
      supportGroundVariation: this.supportGroundVariation,
      enemyWave: {
        generation: this.waveGeneration,
        size: FOLSOM_ENEMY_WAVE_CONFIG.size,
        corpseDespawnSeconds: FOLSOM_ENEMY_WAVE_CONFIG.corpseDespawnSeconds,
        corpseFadeSeconds: FOLSOM_ENEMY_WAVE_CONFIG.corpseFadeSeconds,
        respawnDelaySeconds: FOLSOM_ENEMY_WAVE_CONFIG.respawnDelaySeconds,
        respawnElapsed: this.waveRespawnElapsed,
        stationary: { ...this.enemyWaveCorpses.stationary },
        walker: { ...this.enemyWaveCorpses.walker },
      },
      physics: this.physics.getDiagnostics(),
      actor: this.actor.getDiagnostics(),
      stationaryDeath: this.stationaryDeathController?.getDiagnostics?.() ?? null,
      walker: this.walkerController?.getDiagnostics?.() ?? null,
      combatRouting: routing,
      weapon: this.weaponController?.getDiagnostics?.() ?? null,
      director: this.combatDirector.getDiagnostics(),
      blood: this.bloodEffects.getDiagnostics(),
      feedback: this.feedbackSystem.getDiagnostics(),
      meleeSpacing: this.meleeSpacing,
      spawnPosition: this.spawnPosition.toArray(),
      groundY: this.groundY,
    };
  }

  disposeSupportFloors() {
    this.supportFloors.forEach(({ body }) => this.physics.world.removeRigidBody(body));
    this.supportFloors = [];
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.weaponController?.cancel?.('encounter-dispose');
    this.dungeon.collision?.removeBlocker?.(this.playerBlocker);
    this.walkerController?.dispose?.();
    this.stationaryDeathController?.dispose?.();
    this.combatRouter.unregister(this.actor);
    this.combatDirector.dispose();
    this.bloodEffects.dispose();
    this.actor.dispose();
    this.disposeSupportFloors();
    this.combatRouter.dispose();
    this.feedbackSystem.dispose();
    this.physics.dispose();
    delete this.scene.userData.activeCombatShadowTarget;
  }
}
