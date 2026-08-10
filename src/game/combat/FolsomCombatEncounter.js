import * as THREE from 'three';
import { CombatPhysicsWorld, initializeCombatPhysics } from './CombatPhysicsWorld.js';
import { HumanoidCombatActor } from './HumanoidCombatActor.js';
import { CombatBloodEffects } from './CombatBloodEffects.js';
import { CombatFeedbackSystem } from './CombatFeedbackSystem.js';
import { resolveCombatMortalityMode } from './CombatMortality.js';
import { CHEZWICK_DAMAGE_COMBAT_PROFILE } from './HumanoidModelProfiles.js';
import { CombatDirector } from './CombatDirector.js';
import { KNIFE_COMBAT_CONFIG } from './CombatConfig.js';
import { applyMeleeSpacingEnvelope } from './CombatPresentation.js';
import { preloadKnifeWoundDecalLibrary } from './KnifeWoundDecalLibrary.js';
import { CombatActorRouter } from './CombatActorRouter.js';
import { COMBAT_LAB_WALKER_CONFIG, CombatLabWalkerController, WALKER_STATES } from './CombatLabWalkerController.js';
import { AuthoredHumanoidDeathController } from './AuthoredHumanoidDeathController.js';
import { CombatAcceptedAudioSystem } from './CombatAcceptedAudioSystem.js';
import { FolsomShowcaseCombatExtras, isFolsomShowcaseEnabled } from './FolsomShowcaseCombatExtras.js';
import { BLUNT_IMPACT_CLASSIFICATIONS, BLUNT_IMPACT_SCHEMA } from './weapons/BluntImpactInteraction.js';
import { CreatureLabController, resolveCreatureLabMode } from '../creatures/CreatureLabController.js';
import { CreatureLabAttackHarness } from '../creatures/CreatureLabAttackHarness.js';
import { CreaturePackRegistry } from '../creatures/CreaturePackRegistry.js';

const FOLSOM_AUTHORED_PLAYER_SPAWN = Object.freeze([-2, 1.71, -4]);
const FOLSOM_DREADGUARD_SPAWN_XZ = Object.freeze([8, -4]);
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
  stopTargetDistance: 1,
  stopEnterDistance: 1.08,
  resumeDistance: 1.42,
  slowDistance: 1.9,
  respawnDelaySeconds: 0,
  groundedRespawnSeconds: 15,
});

export const FOLSOM_CREATURE_LAB_WALKER_CONFIG = Object.freeze({
  ...FOLSOM_WALKER_CONFIG,
  groundedRespawnSeconds: Number.POSITIVE_INFINITY,
});

const FOLSOM_WALKER_SPAWN_PATTERNS = Object.freeze([
  Object.freeze([{ angleDegrees: -18, radius: 6 }, { angleDegrees: 18, radius: 6 }]),
  Object.freeze([{ angleDegrees: -29, radius: 6.68 }, { angleDegrees: -50, radius: 6.2 }, { angleDegrees: 50, radius: 6.2 }]),
  Object.freeze([{ angleDegrees: 0, radius: 6 }, { angleDegrees: 50, radius: 6 }, { angleDegrees: -50, radius: 6 }, { angleDegrees: 160, radius: 6 }]),
  Object.freeze([{ angleDegrees: 32, radius: 6.45 }, { angleDegrees: -68, radius: 6.75 }, { angleDegrees: 145, radius: 6.3 }]),
]);

export const FOLSOM_ENEMY_WAVE_CONFIG = Object.freeze({
  size: 4,
  corpseDespawnSeconds: 15,
  corpseFadeSeconds: 0,
  respawnDelaySeconds: 0,
});

const DEATH_STATES = new Set([WALKER_STATES.losingConsciousness, WALKER_STATES.grounded]);
const createCorpseLifecycle = () => ({ started: false, fadeStarted: false, elapsed: 0, opacity: 1, despawned: false, actorInstanceId: null });

const isInsideBounds = (position, bounds, margin = 0) => Boolean(position
  && position.x >= bounds.minX + margin
  && position.x <= bounds.maxX - margin
  && position.z >= bounds.minZ + margin
  && position.z <= bounds.maxZ - margin);

export function isFolsomCombatActorLiving(actor, walkerController = null, stationaryDeathController = null) {
  if (!actor || actor.disposed || actor.lifeState !== 'alive') return false;
  if (actor === stationaryDeathController?.actor && [WALKER_STATES.losingConsciousness, WALKER_STATES.grounded].includes(stationaryDeathController.state)) return false;
  if (actor !== walkerController?.actor) return true;
  return ![WALKER_STATES.losingConsciousness, WALKER_STATES.grounded, WALKER_STATES.disposed, WALKER_STATES.respawning].includes(walkerController.state);
}

export function isFolsomCombatActorContactable(actor, walkerController = null, stationaryDeathController = null) {
  if (!actor || actor.disposed || !['alive', 'dying'].includes(actor.lifeState)) return false;
  if (actor.combatContactState === 'grounded' || actor.combatContactState === 'disposed') return false;
  if (actor === stationaryDeathController?.actor) return stationaryDeathController.state !== WALKER_STATES.grounded;
  if (actor !== walkerController?.actor) return true;
  return ![WALKER_STATES.grounded, WALKER_STATES.disposed, WALKER_STATES.respawning].includes(walkerController.state);
}

export const isFolsomCombatActorRelevant = isFolsomCombatActorLiving;

export class FolsomCombatEncounter {
  static async create(options = {}) {
    await Promise.all([initializeCombatPhysics(), preloadKnifeWoundDecalLibrary()]);
    const encounter = new FolsomCombatEncounter(options);
    if (encounter.creatureLabEnabled) await encounter.initializeCreatureLab();
    return encounter;
  }

  constructor({
    dungeon,
    audioRuntime = null,
    query = new URLSearchParams(globalThis.location?.search ?? ''),
    player = null,
    creatureLabEnabled = null,
    creaturePackRegistry = null,
  } = {}) {
    this.dungeon = dungeon;
    this.scene = dungeon.scene;
    this.query = query;
    this.player = player ?? { position: new THREE.Vector3(...FOLSOM_AUTHORED_PLAYER_SPAWN), yaw: 0 };
    this.physics = new CombatPhysicsWorld();
    this.feedbackSystem = new CombatFeedbackSystem({ audioRuntime });
    this.acceptedCombatAudio = new CombatAcceptedAudioSystem({ audioRuntime });
    this.combatRouter = new CombatActorRouter();
    this.weaponController = null;
    this.disposed = false;
    this.modelProfile = CHEZWICK_DAMAGE_COMBAT_PROFILE;
    this.creatureLabEnabled = creatureLabEnabled ?? resolveCreatureLabMode(this.query);
    this.creaturePackRegistry = creaturePackRegistry;
    this.creatureLabController = null;
    this.creatureLabAttackHarness = this.creatureLabEnabled ? new CreatureLabAttackHarness({
      scene: this.scene,
      playerProvider: () => this.player,
      damageReceiverProvider: () => this.player?.combatDamageReceiver ?? null,
    }) : null;
    this.showcaseEnabled = !this.creatureLabEnabled && isFolsomShowcaseEnabled(this.query);
    this.waveGeneration = 1;
    this.playerSpawn = new THREE.Vector3(...FOLSOM_AUTHORED_PLAYER_SPAWN);
    this.supportFloors = [];
    this.supportGroundVariation = 0;
    this.createRapierGroundSupport();

    this.spawnPosition = this.resolveCombatSpawn();
    const sampledGround = dungeon.collision?.sampleWalkableY?.(this.spawnPosition.x, this.spawnPosition.z, 0.16);
    this.groundY = Number.isFinite(sampledGround?.y) ? sampledGround.y : 0.16;
    this.actor = null;
    this.playerBlocker = null;
    this.bloodEffects = null;
    this.combatDirector = null;
    this.stationaryDeathController = null;
    this.stationaryDeathCollisionReleased = false;
    this.meleeSpacing = null;

    this.walkerController = new CombatLabWalkerController({
      scene: this.scene,
      physics: this.physics,
      collision: this.dungeon.collision,
      combatRouter: this.combatRouter,
      stationaryActor: null,
      feedbackSystem: this.feedbackSystem,
      acceptedCombatAudio: this.acceptedCombatAudio,
      playerProvider: () => this.player,
      enabled: !this.creatureLabEnabled && this.query.get('folsomWalker') !== '0',
      query: this.query,
      config: this.creatureLabEnabled ? FOLSOM_CREATURE_LAB_WALKER_CONFIG : FOLSOM_WALKER_CONFIG,
      environment: this.creatureLabEnabled
        ? this.createCreatureLabWalkerEnvironment()
        : this.createWalkerEnvironment({ ownerId: 'primary', ordinal: 0 }),
      actorFactory: (options) => this.createDamageProfileActor(options),
      beforeActorDisposal: (actor, reason) => this.weaponController?.cancelTarget?.(actor, reason),
    });
    this.walkerController.prepareFrame(0, this.player);
    this.syncPrimaryWalkerAliases();
    this.showcaseExtras = this.creatureLabEnabled ? null : new FolsomShowcaseCombatExtras({
      scene: this.scene,
      physics: this.physics,
      collision: this.dungeon.collision,
      combatRouter: this.combatRouter,
      stationaryActor: this.actor,
      feedbackSystem: this.feedbackSystem,
      acceptedCombatAudio: this.acceptedCombatAudio,
      playerProvider: () => this.player,
      query: this.query,
      walkerConfig: FOLSOM_WALKER_CONFIG,
      environmentFactory: (identity) => this.createWalkerEnvironment(identity),
      actorFactory: (options) => this.createDamageProfileActor(options),
      beforeActorDisposal: (actor, reason) => this.weaponController?.cancelTarget?.(actor, reason),
    });
    this.resetEnemyWaveLifecycle();
    this.priorityCombatActor = this.getPriorityCombatActor(this.player);
    this.combatActiveActor = null;
    if (!this.creatureLabEnabled) this.installForgeDamageDebugCommands();
  }

  async initializeCreatureLab() {
    if (!this.creatureLabEnabled || this.creatureLabController) return this.creatureLabController;
    this.creatureLabController = new CreatureLabController({
      registry: this.creaturePackRegistry ?? new CreaturePackRegistry(),
      walkerController: this.walkerController,
      combatRouter: this.combatRouter,
      playerProvider: () => this.player,
      weaponControllerProvider: () => this.weaponController,
      initialPresetId: this.query.get('enemyPreset'),
      initialDefinitionId: this.query.get('creatureDefinition'),
      initialPackId: this.query.has('creatureDefinition') || this.query.has('enemyPreset') ? null : this.query.get('creaturePack'),
      attackHarness: this.creatureLabAttackHarness,
      onSubjectChanged: (subject) => this.syncCreatureLabSubject(subject),
    });
    await this.creatureLabController.initialize();
    this.syncCreatureLabSubject(this.creatureLabController.getSubjectState());
    this.resetEnemyWaveLifecycle();
    return this.creatureLabController;
  }

  syncCreatureLabSubject(subject = {}) {
    this.syncPrimaryWalkerAliases();
    if (subject.profile) this.modelProfile = subject.profile;
    this.priorityCombatActor = this.getPriorityCombatActor(this.player);
    return this.actor;
  }

  createDamageProfileActor(options = {}) {
    return new HumanoidCombatActor({ ...options, visualProfile: CHEZWICK_DAMAGE_COMBAT_PROFILE });
  }

  syncPrimaryWalkerAliases() {
    this.actor = this.walkerController?.actor ?? null;
    this.playerBlocker = this.walkerController?.playerBlocker ?? null;
    this.bloodEffects = this.walkerController?.bloodEffects ?? null;
    this.combatDirector = this.walkerController?.director ?? null;
  }

  installForgeDamageDebugCommands() {
    if (import.meta.env?.DEV !== true || typeof globalThis === 'undefined') return null;
    const commands = Object.freeze({
      Light: () => this.debugSetProgressiveDamageStage('LIGHT'),
      Medium: () => this.debugSetProgressiveDamageStage('MEDIUM'),
      Heavy: () => this.debugSetProgressiveDamageStage('HEAVY'),
      LightRight: () => this.debugSetProgressiveDamageStage('LIGHT', 'right'),
      MediumRight: () => this.debugSetProgressiveDamageStage('MEDIUM', 'right'),
      HeavyRight: () => this.debugSetProgressiveDamageStage('HEAVY', 'right'),
      nextStage: () => this.debugAdvanceProgressiveDamage(),
      solidHeadImpact: () => this.debugApplySolidHeadImpact(),
      resetAllDamage: () => this.debugResetForgeDamage(),
      diagnostics: () => this.actor?.visualAdapter?.damageSegmentRuntime?.deformationRuntime?.getDiagnostics?.() ?? null,
      characterDiagnostics: () => this.actor?.getDiagnostics?.() ?? null,
      deathDiagnostics: () => this.walkerController?.getDiagnostics?.() ?? null,
    });
    this.forgeDamageDebugCommands = commands;
    globalThis.__DSB_CHEZWICK_DAMAGE__ = commands;
    console.info('[ForgeDamage] Folsom Chezwick commands installed at __DSB_CHEZWICK_DAMAGE__.');
    return commands;
  }

  getConfiguredProgressiveSites() {
    const manifestSites = this.actor?.visualAdapter?.damageManifest?.deformations?.progressiveDamageSites ?? [];
    const sides = new Set(manifestSites.map((site) => Math.sign(Number(site.stages?.[0]?.measurements?.captureCenterLocal?.[0]) || 0)));
    return [...manifestSites, ...(this.modelProfile.progressiveDamageSiteFallbacks ?? []).filter((site) => !sides.has(Math.sign(Number(site.stages?.[0]?.measurements?.captureCenterLocal?.[0]) || 0)))];
  }

  getProgressiveSiteId(side = 'left') {
    // Legacy console stage control names an authored side explicitly. Physical
    // impact selection never calls this path; Forge uses 3D target records.
    const sign = side === 'right' ? 1 : -1;
    return this.getConfiguredProgressiveSites().find((site) => Math.sign(Number(site.stages?.[0]?.measurements?.captureCenterLocal?.[0]) || 0) === sign)?.siteId ?? null;
  }

  debugSetProgressiveDamageStage(stageName, side = 'left') {
    return this.actor?.visualAdapter?.setProgressiveDamageStage?.(this.getProgressiveSiteId(side), stageName, { source: 'folsom_debug_command', hitRegion: 'skull', hitSide: side }) ?? { applied: false, reason: 'damage-runtime-not-ready', stage: stageName };
  }

  debugAdvanceProgressiveDamage(side = 'left') {
    return this.actor?.visualAdapter?.advanceProgressiveDamageSite?.(this.getProgressiveSiteId(side), { source: 'folsom_debug_command', hitRegion: 'skull', hitSide: side }) ?? { applied: false, reason: 'damage-runtime-not-ready' };
  }

  debugApplySolidHeadImpact() {
    const actor = this.actor;
    const adapter = actor?.visualAdapter;
    const target = adapter?.getProgressiveDamageSiteTarget?.(this.getProgressiveSiteId('left'), { refresh: true });
    const headCollider = actor?.colliders?.get?.('head');
    if (!actor || !adapter || !headCollider || !target?.currentWorldCenter) {
      return { accepted: false, reason: 'left-head-progressive-site-not-ready' };
    }
    const worldPoint = target.currentWorldCenter.clone();
    const hit = actor.resolveHit(headCollider, worldPoint);
    if (!hit?.region) return { accepted: false, reason: 'left-head-hit-resolution-failed' };
    const worldDirection = target.currentWorldPreferredDirection?.clone?.() ?? new THREE.Vector3(0, 0, -1);
    if (worldDirection.lengthSq() < 1e-8) worldDirection.set(0, 0, -1);
    worldDirection.normalize();
    const worldNormal = worldDirection.clone().negate();
    return actor.applyBluntImpact({
      hit,
      impact: {
        schema: BLUNT_IMPACT_SCHEMA,
        interactionId: `folsom-debug-solid-head-impact-${actor.elapsed.toFixed(4)}`,
        targetingSource: 'folsom_debug_probe',
        primitive: 'mace_head',
        classification: BLUNT_IMPACT_CLASSIFICATIONS.committedBlunt,
        worldPoint,
        worldNormal,
        impactDirection: worldDirection,
        normalImpactSpeed: 4,
        tangentialSpeed: 0.3,
        estimatedImpulse: 21.6,
        estimatedEnergy: 43.2,
        loadProgress: 0.76,
        gesturePower: 0.7,
        impactRadiusEstimate: 0.11,
      },
    });
  }

  debugResetForgeDamage() {
    return this.actor?.visualAdapter?.resetForgeDamage?.() ?? null;
  }

  spawnStationaryActor() {
    const spawnOffset = new THREE.Vector3(this.spawnPosition.x, this.groundY, this.spawnPosition.z + 3.55);
    const spawnYaw = Math.atan2(this.playerSpawn.x - this.spawnPosition.x, this.playerSpawn.z - this.spawnPosition.z);
    this.actor = this.createDamageProfileActor({ physics: this.physics, scene: this.scene, spawnOffset, spawnYaw, mortalityMode: resolveCombatMortalityMode(), automaticMortality: false, isolateVisualMaterials: true, acceptedCombatAudio: this.acceptedCombatAudio, eventSink: (event, payload) => this.handleStationaryCombatEvent(event, payload) });
    this.actor.root.name = `folsom-dreadguard-stationary-${this.waveGeneration}`;
    this.actor.combatContactState = 'alive';
    this.playerBlocker = this.actor.updatePlayerCollisionBlocker({ id: `folsom-dreadguard-stationary-blocker-${this.waveGeneration}` });
    this.meleeSpacing = this.applyActorMeleeSpacing(this.playerBlocker);
    this.dungeon.collision?.addBlocker?.(this.playerBlocker);
    this.actor.setEnvironmentContactHints({ groundY: this.groundY, wallX: null });
    this.bloodEffects = new CombatBloodEffects({ scene: this.scene, woundSystem: this.actor.woundSystem, physiology: this.actor.physiology, groundY: this.groundY, eventSink: (event, payload) => this.handleStationaryCombatEvent(event, payload) });
    this.actor.setDetachmentBloodEmitter((request) => this.bloodEffects?.emitDetachment?.(request) === true);
    this.combatDirector = new CombatDirector({ actor: this.actor, bloodEffects: this.bloodEffects, feedbackSystem: this.feedbackSystem, acceptedCombatAudio: this.acceptedCombatAudio });
    this.combatRouter.register(this.actor, this.combatDirector);
    this.stationaryDeathCollisionReleased = false;
    this.stationaryDeathController = new AuthoredHumanoidDeathController({
      actor: this.actor,
      groundY: this.groundY,
      onDeathStarted: (actor) => this.releaseStationaryDeathCollisionOwnership(actor),
      onGrounded: (actor) => this.finalizeStationaryDeathContactOwnership(actor),
    });
    return this.actor;
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

  createWalkerEnvironment({ ownerId = 'primary', ordinal = 0 } = {}) {
    const namespace = ownerId === 'primary' ? 'folsom-authored-walker' : `folsom-${ownerId}-walker`;
    return {
      id: `folsom-${ownerId}`,
      spawnMode: 'forwardCone',
      queryKeys: { pause: ordinal ? `folsomShowcaseWalker${ordinal}Pause` : 'folsomWalkerPause', speed: ordinal ? `folsomShowcaseWalker${ordinal}Speed` : 'folsomWalkerSpeed' },
      getPlayerPosition: (player) => player?.position ?? null,
      getPlayerFacingYaw: (player) => player?.yaw ?? 0,
      getSpawnCandidates: ({ playerPosition, facingYaw }) => (this.showcaseEnabled ? FOLSOM_WALKER_SPAWN_PATTERNS[ordinal] ?? [] : [])
        .map(({ angleDegrees, radius }) => {
          const angle = facingYaw + THREE.MathUtils.degToRad(angleDegrees);
          return new THREE.Vector3(
            playerPosition.x + Math.sin(angle) * radius,
            this.groundY ?? 0.16,
            playerPosition.z + Math.cos(angle) * radius,
          );
        }),
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
      getActorName: (generation) => `${namespace}-${generation}`,
      getBlockerName: (generation) => `${namespace}-blocker-${generation}`,
      getFeedbackOwner: (generation, actor) => `${namespace}-feedback-${generation}-${actor?.instanceId ?? 'unbound'}`,
      ensureRapierGroundSupport: ({ spawnPosition, playerPosition }) => ({
        supported: this.isRapierSupported(spawnPosition) && this.isRapierSupported(playerPosition),
        supportFloorCount: this.supportFloors.length,
      }),
      onWalkerSpawned: ({ actor, bloodEffects, blocker }) => {
        actor?.setDetachmentBloodEmitter?.((request) => bloodEffects?.emitDetachment?.(request) === true);
        return this.applyActorMeleeSpacing(blocker);
      },
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
    return new THREE.Vector3(FOLSOM_DREADGUARD_SPAWN_XZ[0], 0.16, FOLSOM_DREADGUARD_SPAWN_XZ[1]);
  }

  handleStationaryCombatEvent(event, payload = {}) {
    const owner = this.actor?.instanceId ?? 'folsom-combat-stationary-unbound';
    if (event === 'final_exhale') this.feedbackSystem.stopOwnerVocal(owner);
    if (this.combatDirector) this.combatDirector.forwardFeedbackEvent(event, { ...payload, owner });
    else this.feedbackSystem.emit(event, { ...payload, owner });
  }

  getLivingCombatActors() {
    return this.getWalkerControllers()
      .map((controller) => controller.actor)
      .filter((actor, index) => isFolsomCombatActorLiving(actor, this.getWalkerControllers()[index], null));
  }

  createCreatureLabWalkerEnvironment() {
    const environment = this.createWalkerEnvironment({ ownerId: 'creature-lab', ordinal: 0 });
    const stableSpawn = new THREE.Vector3().fromArray(FOLSOM_WALKER_CONFIG.fallbackPosition);
    return {
      ...environment,
      id: 'folsom-creature-lab',
      spawnMode: 'fixed',
      getSpawnCandidates: () => [stableSpawn.clone()],
      getFallbackSpawn: () => stableSpawn.clone(),
      getActorName: (generation) => `folsom-creature-lab-subject-${generation}`,
      getBlockerName: (generation) => `folsom-creature-lab-blocker-${generation}`,
      getFeedbackOwner: (generation, actor) => `folsom-creature-lab-${generation}-${actor?.instanceId ?? 'unbound'}`,
    };
  }

  getContactableCombatActors() {
    const controllers = this.getWalkerControllers();
    return controllers.map((controller) => controller.actor)
      .filter((actor, index) => isFolsomCombatActorContactable(actor, controllers[index], null));
  }

  getActiveCombatActors() { return this.getLivingCombatActors(); }

  getWalkerControllers() {
    return [this.walkerController, ...(this.showcaseExtras?.getWalkerControllers?.() ?? [])].filter(Boolean);
  }

  releaseStationaryDeathCollisionOwnership(actor = this.actor) {
    if (!actor || actor !== this.actor || this.stationaryDeathCollisionReleased) return false;
    this.stationaryDeathCollisionReleased = true;
    actor.combatContactState = 'dying';
    this.dungeon.collision?.removeBlocker?.(this.playerBlocker);
    return true;
  }

  finalizeStationaryDeathContactOwnership(actor = this.actor) {
    if (!actor || actor !== this.actor || actor.combatContactState === 'grounded') return false;
    actor.combatContactState = 'grounded';
    this.combatRouter.unregister(actor);
    actor.colliders?.forEach?.((collider) => collider.setEnabled?.(false));
    return true;
  }

  getPriorityCombatActor(player = this.player) {
    if (!player?.position) return null;
    let selected = null;
    let selectedDistance = Infinity;
    for (const actor of this.getLivingCombatActors()) {
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
    let actor = null;
    let distance = Infinity;
    for (const candidate of this.getContactableCombatActors()) {
      const candidateDistance = player?.position?.distanceTo(candidate.getBodyWorldPosition('pelvis')) ?? Infinity;
      if (candidateDistance < distance) { actor = candidate; distance = candidateDistance; }
    }
    this.combatActiveActor = actor && distance <= FOLSOM_COMBAT_RANGE ? actor : null;
    return Boolean(this.combatActiveActor);
  }

  attachWeaponController(controller) {
    if (this.weaponController === controller) return;
    this.weaponController?.cancel?.('controller-replaced');
    this.weaponController = controller;
  }

  resetEnemyWaveLifecycle() {
    this.enemyWaveCorpses = {};
    this.getWalkerControllers().forEach((_controller, index) => {
      this.enemyWaveCorpses[index === 0 ? 'walker' : `showcaseWalker${index}`] = createCorpseLifecycle();
    });
    this.waveRespawnElapsed = 0;
  }

  beginCorpseFade(actor, bloodEffects) {
    if (!actor) return false;
    actor.visualAdapter?.beginFade?.();
    actor.woundSystem?.beginFade?.();
    bloodEffects?.beginFade?.();
    return true;
  }

  setCorpseFadeOpacity(actor, bloodEffects, opacity) {
    if (!actor) return false;
    const value = THREE.MathUtils.clamp(Number(opacity) || 0, 0, 1);
    actor.visualAdapter?.setFadeOpacity?.(value);
    actor.woundSystem?.setFadeOpacity?.(value);
    bloodEffects?.setFadeOpacity?.(value);
    return true;
  }

  resetCorpseFade(actor, bloodEffects) {
    if (!actor) return false;
    actor.visualAdapter?.resetFade?.();
    actor.woundSystem?.resetFade?.();
    bloodEffects?.resetFade?.();
    if (actor.root) actor.root.visible = true;
    return true;
  }

  advanceCorpseLifecycle(slot, actor, state, bloodEffects, onDespawn, deltaSeconds) {
    if (!slot || slot.despawned || !actor || !DEATH_STATES.has(state)) return;
    if (!slot.started) {
      slot.started = true;
      slot.actorInstanceId = actor.instanceId;
    }
    slot.elapsed += Math.max(0, Number(deltaSeconds) || 0);
    const fadeStart = FOLSOM_ENEMY_WAVE_CONFIG.corpseDespawnSeconds - FOLSOM_ENEMY_WAVE_CONFIG.corpseFadeSeconds;
    if (slot.elapsed < fadeStart) {
      slot.opacity = 1;
      return;
    }
    if (!slot.fadeStarted) {
      this.beginCorpseFade(actor, bloodEffects);
      slot.fadeStarted = true;
    }
    slot.opacity = 1 - THREE.MathUtils.clamp((slot.elapsed - fadeStart) / Math.max(0.001, FOLSOM_ENEMY_WAVE_CONFIG.corpseFadeSeconds), 0, 1);
    this.setCorpseFadeOpacity(actor, bloodEffects, slot.opacity);
    if (slot.elapsed < FOLSOM_ENEMY_WAVE_CONFIG.corpseDespawnSeconds) return;
    slot.opacity = 0;
    slot.despawned = true;
    actor.root.visible = false;
    onDespawn?.();
  }

  updateEnemyWaveLifecycle(deltaSeconds) {
    const dt = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
    const slots = Object.values(this.enemyWaveCorpses);
    const allAlreadyDespawned = slots.every((slot) => slot.despawned);
    this.getWalkerControllers().forEach((controller, index) => {
      const key = index === 0 ? 'walker' : `showcaseWalker${index}`;
      this.advanceCorpseLifecycle(
        this.enemyWaveCorpses[key],
        controller.actor,
        controller.state,
        controller.bloodEffects,
        () => controller.disposeWalker?.({ respawn: false }),
        dt,
      );
    });
    const allDespawned = Object.values(this.enemyWaveCorpses).every((slot) => slot.despawned);
    if (!allDespawned) {
      this.waveRespawnElapsed = 0;
      return;
    }
    if (!allAlreadyDespawned) {
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

  disposeStationaryActor(reason = 'stationary-dispose') {
    const actor = this.actor;
    if (!actor) return false;
    this.weaponController?.cancelTarget?.(actor, reason);
    actor.combatContactState = 'disposed';
    this.feedbackSystem?.stopOwnerVocal?.(actor.instanceId);
    this.combatRouter.unregister(actor);
    this.dungeon.collision?.removeBlocker?.(this.playerBlocker);
    this.stationaryDeathController?.dispose?.();
    this.combatDirector?.dispose?.();
    this.bloodEffects?.dispose?.();
    actor.dispose();
    this.actor = null;
    this.playerBlocker = null;
    this.stationaryDeathController = null;
    this.combatDirector = null;
    this.bloodEffects = null;
    this.stationaryDeathCollisionReleased = true;
    return true;
  }

  update(deltaSeconds, player = this.player) {
    if (this.disposed) return;
    this.player = player ?? this.player;
    if (!this.physics.paused) this.walkerController?.prepareFrame(deltaSeconds, this.player);
    if (!this.physics.paused) this.showcaseExtras?.prepareFrame(deltaSeconds, this.player);
    this.walkerController?.actor?.prepareFrame(deltaSeconds);
    this.showcaseExtras?.getActors?.().forEach((actor) => actor.prepareFrame(deltaSeconds));
    this.physics.step(deltaSeconds, (dt) => {
      this.acceptedCombatAudio.update(dt);
      this.feedbackSystem.update(dt);
      this.weaponController?.beforePhysics?.(dt);
      this.walkerController?.beforePhysics(dt, this.player?.position);
      this.showcaseExtras?.beforePhysics(dt, this.player?.position);
    }, (dt) => {
      this.weaponController?.afterPhysicsStep?.(dt);
      this.walkerController?.afterPhysicsStep(dt);
      this.showcaseExtras?.afterPhysicsStep(dt);
    });
    this.walkerController?.afterPhysics(this.physics.interpolationAlpha);
    this.showcaseExtras?.afterPhysics(this.physics.interpolationAlpha);
    this.syncPrimaryWalkerAliases();
    this.priorityCombatActor = this.getPriorityCombatActor(this.player);
    const combatShadowTarget = this.priorityCombatActor?.getBodyWorldPosition?.('upper_chest');
    if (combatShadowTarget) this.scene.userData.activeCombatShadowTarget = combatShadowTarget;
    else delete this.scene.userData.activeCombatShadowTarget;
    this.weaponController?.afterPhysics?.(this.physics.interpolationAlpha, deltaSeconds);
    this.creatureLabController?.update?.(deltaSeconds);
  }

  reset(player = this.player, { preserveWaveGeneration = false, reason = 'encounter-reset' } = {}) {
    if (this.disposed) return false;
    this.player = player ?? this.player;
    if (this.creatureLabEnabled) {
      void this.creatureLabController?.respawn?.();
      return true;
    }
    this.weaponController?.cancel?.(reason);
    if (!preserveWaveGeneration) this.waveGeneration = 1;
    this.walkerController?.disposeWalker?.({ respawn: false });
    this.showcaseExtras?.getWalkerControllers?.().forEach((controller) => controller.disposeWalker?.({ respawn: false }));
    this.walkerController.stationaryActor = null;
    this.walkerController?.reset(this.player);
    this.walkerController?.prepareFrame(0, this.player);
    this.syncPrimaryWalkerAliases();
    this.showcaseExtras?.reset(this.player, this.actor);
    this.acceptedCombatAudio.reset();
    this.feedbackSystem.reset();
    this.weaponController?.reset?.();
    this.resetEnemyWaveLifecycle();
    this.priorityCombatActor = this.getPriorityCombatActor(this.player);
    return true;
  }

  getDiagnostics() {
    const routing = this.combatRouter.getDiagnostics();
    const weapon = this.weaponController?.getDiagnostics?.() ?? null;
    const swordShowcase = weapon?.sword?.edgeSweepObserver ?? null;
    const ownedActors = this.getWalkerControllers().map((controller) => controller.actor).filter(Boolean);
    const maceChestPresent = this.dungeon?.outdoorInteractions?.some?.((interaction) => interaction.id === 'folsom_courtyard_mace_chest')
      ?? this.dungeon?.definition?.outdoorChests?.some?.((chest) => chest.id === 'folsom_courtyard_mace_chest')
      ?? false;
    return {
      modelProfileName: this.modelProfile.name,
      creatureLab: this.creatureLabController?.getDiagnostics?.() ?? { enabled: false },
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
        size: this.getWalkerControllers().length,
        corpseDespawnSeconds: FOLSOM_ENEMY_WAVE_CONFIG.corpseDespawnSeconds,
        corpseFadeSeconds: FOLSOM_ENEMY_WAVE_CONFIG.corpseFadeSeconds,
        respawnDelaySeconds: FOLSOM_ENEMY_WAVE_CONFIG.respawnDelaySeconds,
        respawnElapsed: this.waveRespawnElapsed,
        ...Object.fromEntries(Object.entries(this.enemyWaveCorpses).map(([key, slot]) => [key, { ...slot }])),
      },
      physics: this.physics.getDiagnostics(),
      actor: this.actor?.getDiagnostics?.() ?? null,
      stationaryDeath: this.stationaryDeathController?.getDiagnostics?.() ?? null,
      walker: this.walkerController?.getDiagnostics?.() ?? null,
      showcaseExtras: this.showcaseExtras?.getDiagnostics?.() ?? null,
      combatRouting: routing,
      weapon,
      director: this.combatDirector?.getDiagnostics?.() ?? null,
      blood: this.bloodEffects?.getDiagnostics?.() ?? null,
      feedback: this.feedbackSystem.getDiagnostics(),
      acceptedCombatAudio: this.acceptedCombatAudio.getDiagnostics({ actor: this.actor, penetrationAudioGate: this.weaponController?.penetrationAudioGate }),
      meleeSpacing: this.meleeSpacing,
      playerCollision: this.dungeon.collision?.getMovementDiagnostics?.() ?? null,
      spawnPosition: this.spawnPosition.toArray(),
      groundY: this.groundY,
      folsomShowcase: {
        enabled: this.showcaseEnabled,
        totalActorCount: ownedActors.length,
        livingActorCount: this.getLivingCombatActors().length,
        contactableActorCount: this.getContactableCombatActors().length,
        additionalWalkerCount: this.showcaseExtras?.getActors?.().length ?? 0,
        damageProfileActorCount: ownedActors.filter((actor) => actor.visualProfile === CHEZWICK_DAMAGE_COMBAT_PROFILE).length,
        maceChestPresent,
        maceControllerAvailable: weapon?.mace != null,
        swordShowcaseEnabled: swordShowcase?.enabled === true,
        activeSwingId: swordShowcase?.activeSwingId ?? null,
        swingEdgeSpeed: swordShowcase?.swingEdgeSpeed ?? 0,
        swingLateralRatio: swordShowcase?.swingLateralRatio ?? 0,
        swingTravel: swordShowcase?.swingTravel ?? 0,
        lastContactActorId: swordShowcase?.lastContactActorId ?? null,
        lastContactBodyId: swordShowcase?.lastContactBodyId ?? null,
        lastContactRegionId: swordShowcase?.lastContactRegionId ?? null,
        lastCandidateSegmentId: swordShowcase?.lastCandidateSegmentId ?? null,
        lastSeamDistance: swordShowcase?.lastSeamDistance ?? null,
        lastResult: swordShowcase?.lastResult ?? 'unavailable',
        acceptedDetachmentCount: swordShowcase?.acceptedDetachmentCount ?? 0,
        rejectedSpeedCount: swordShowcase?.rejectedSpeedCount ?? 0,
        rejectedIntentCount: swordShowcase?.rejectedIntentCount ?? 0,
        rejectedSeamDistanceCount: swordShowcase?.rejectedSeamDistanceCount ?? 0,
        rejectedRepeatCount: swordShowcase?.rejectedRepeatCount ?? 0,
        actorsResolvedThisSwing: swordShowcase?.actorsResolvedThisSwing ?? [],
      },
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
    this.creatureLabController?.dispose?.();
    this.creatureLabController = null;
    this.creatureLabAttackHarness = null;
    this.showcaseExtras?.dispose?.();
    this.walkerController?.dispose?.();
    this.acceptedCombatAudio.dispose();
    this.disposeSupportFloors();
    this.combatRouter.dispose();
    this.feedbackSystem.dispose();
    this.physics.dispose();
    if (globalThis.__DSB_CHEZWICK_DAMAGE__ === this.forgeDamageDebugCommands) delete globalThis.__DSB_CHEZWICK_DAMAGE__;
    this.forgeDamageDebugCommands = null;
    delete this.scene.userData.activeCombatShadowTarget;
  }
}
