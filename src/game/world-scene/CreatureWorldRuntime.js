import * as THREE from 'three';
import { createCreatureActor } from '../../engine/creatures/CreatureActorFactory.js';
import { BlackGrassTempleFactionManager } from '../BlackGrassTempleFactions.js';
import { SheepDemonEnemy } from '../SheepDemonEnemy.js';
import { RAM_MAN_FRIENDLY_ANIMATION_FILES } from '../creatures/ramManFriendly.config.js';
import '../creatures/creatureRegistry.js';

export { createCreatureActor, RAM_MAN_FRIENDLY_ANIMATION_FILES };

const GENERATED_ENEMY_ACTIVE_CAP = 3;
const GENERATED_ENEMY_INITIAL_CAP = 2;
const GENERATED_ENEMY_WAKE_RADIUS = 20;
const GENERATED_ENEMY_SLEEP_RADIUS = 38;
const GENERATED_ENEMY_AI_NEAR_RADIUS = 18;
const GENERATED_ENEMY_AI_MID_RADIUS = 30;
const GENERATED_ENEMY_RESPAWN_COOLDOWN_MS = 15000;
const GENERATED_ENEMY_MAX_WAKE_PER_SECOND = 1;


function createNeckmanDebugTogglesFromQuery() {
  if (typeof window === 'undefined') return {};
  const query = new URLSearchParams(window.location.search);
  return {
    neckmen: query.get('neckmen') !== '0',
    neckmanActorsHidden: query.get('neckmanActorsHidden') === '1',
    neckmanStatic: query.get('neckmanStatic') === '1',
    neckmanAiOff: query.get('neckmanAiOff') === '1',
    neckmanFeudOff: query.get('neckmanFeudOff') === '1',
    neckmanCollisionOff: query.get('neckmanCollisionOff') === '1',
    neckmanTargetingOff: query.get('neckmanTargetingOff') === '1',
    neckmanMovementOff: query.get('neckmanMovementOff') === '1',
    neckmanCombatOff: query.get('neckmanCombatOff') === '1',
    neckmanStateMachineOff: query.get('neckmanStateMachineOff') === '1',
    neckmanRenderLite: query.get('neckmanRenderLite') === '1',
    neckmanPerfTrace: query.get('neckmanPerfTrace') === '1',
    ramHerd: query.get('ramHerd') !== '0',
    rammanStatic: query.get('rammanStatic') === '1',
    rammanAiOff: query.get('rammanAiOff') === '1',
    rammanActorsHidden: query.get('rammanActorsHidden') === '1',
    neckmanTargetRamMen: query.get('neckmanTargetRamMen') !== '0',
  };
}

function horizontalDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export class CreatureWorldRuntime {
  constructor({
    scene,
    collision,
    area = 'dungeon',
    perfDebugToggles = null,
    playerSpawn = null,
    resolveOutdoorVisibleSurfaceY = null,
    onGoreEvent = null,
    emitPlayerAttackGore = null,
  } = {}) {
    this.scene = scene;
    this.collision = collision;
    this.area = area;
    this.perfDebugToggles = { ...createNeckmanDebugTogglesFromQuery(), ...(perfDebugToggles ?? {}) };
    this.playerSpawn = playerSpawn;
    this.resolveOutdoorVisibleSurfaceY = resolveOutdoorVisibleSurfaceY;
    this.onGoreEvent = onGoreEvent;
    this.emitPlayerAttackGore = emitPlayerAttackGore;

    this.sheepDemonEnemy = null;
    this.blackGrassFactionManager = null;
    this.generatedEnemyRuntime = null;
    this.compiledLocationEnemiesSpawnedFor = null;
    this.bloodFeudSpawnDebug = null;
  }

  setArea(area) { this.area = area; }
  setCollision(collision) { this.collision = collision; }
  setPlayerSpawn(playerSpawn) { this.playerSpawn = playerSpawn; }

  addStandaloneSheepDemonEnemy() {
    if (this.area !== 'dungeon') return;
    this.sheepDemonEnemy = new SheepDemonEnemy({ scene: this.scene, collision: this.collision });
    this.sheepDemonEnemy.load();
  }

  addBlackGrassTempleEnemies({ anchors, navigationGraph, encounterZones } = {}) {
    this.blackGrassFactionManager = new BlackGrassTempleFactionManager({
      scene: this.scene,
      collision: this.collision,
      anchors,
      navigationGraph,
      encounterZones,
      onGoreEvent: this.onGoreEvent,
      perfDebugToggles: this.perfDebugToggles,
    });
    this.blackGrassFactionManager.spawnInitialWave();
  }

  addCompiledLocationEnemies(runtime, options = {}) {
    if (!runtime || runtime.locationId === 'black-grass-temple') return;
    if (this.compiledLocationEnemiesSpawnedFor === runtime.locationId) return;
    const factionSpawns = runtime.spawnAnchors.filter((spawn) => (
      spawn.kind === 'enemy'
      && ['sheep_demon', 'neck_man'].includes(spawn.species)
      && (spawn.allowedForInitialWave || spawn.initialWave || spawn.tags?.includes('initial-wave'))
    ));
    const folsomBloodFeudSpawns = runtime.locationId === 'folsom'
      ? factionSpawns.filter((spawn) => spawn.tags?.includes('folsom-blood-feud'))
      : [];
    if (runtime.locationId === 'folsom') {
      this.bloodFeudSpawnDebug = {
        locationId: runtime.locationId,
        collisionAvailable: Boolean(this.collision),
        found: folsomBloodFeudSpawns.length,
        spawned: 0,
        skipped: 0,
        skipReasons: [],
        encounterMode: null,
      };
    }
    const folsomBloodFeudAnchors = folsomBloodFeudSpawns.map((spawn) => this.createRuntimeEnemyAnchor(spawn, runtime)).filter(Boolean);
    const isFolsomBloodFeud = runtime.locationId === 'folsom' && folsomBloodFeudAnchors.length === 3;
    const folsomRamManHerdAnchors = isFolsomBloodFeud ? this.createFolsomRamManHerdAnchors(runtime).map((spawn) => this.createRuntimeEnemyAnchor(spawn, runtime)).filter(Boolean) : [];
    if (runtime.locationId === 'folsom') {
      this.bloodFeudSpawnDebug.spawned = folsomBloodFeudAnchors.length;
      this.bloodFeudSpawnDebug.skipped = Math.max(0, folsomBloodFeudSpawns.length - folsomBloodFeudAnchors.length);
      this.bloodFeudSpawnDebug.encounterMode = isFolsomBloodFeud ? 'folsom_neckman_blood_feud' : null;
      if (import.meta.env?.DEV) console.info(`[FolsomBloodFeud] found ${folsomBloodFeudSpawns.length} authored spawns, resolved ${folsomBloodFeudAnchors.length} safe anchors, skipped ${this.bloodFeudSpawnDebug.skipped}`, this.bloodFeudSpawnDebug);
    }

    const factionAnchors = isFolsomBloodFeud ? folsomBloodFeudAnchors : factionSpawns.map((spawn) => this.createRuntimeEnemyAnchor(spawn, runtime)).filter(Boolean);
    if (factionAnchors.length === 0) return;
    this.compiledLocationEnemiesSpawnedFor = runtime.locationId;
    this.blackGrassFactionManager = new BlackGrassTempleFactionManager({
      scene: this.scene,
      collision: this.collision,
      anchors: factionAnchors,
      navigationGraph: runtime.navGraph,
      outdoorVisibleSurfaceSampler: this.resolveOutdoorVisibleSurfaceY,
      encounterZones: runtime.encounterZones,
      onGoreEvent: this.onGoreEvent,
      enableBattleDirector: false,
      enableRespawns: isFolsomBloodFeud,
      encounterMode: isFolsomBloodFeud ? 'folsom_neckman_blood_feud' : 'faction_war',
      respawnCooldownSeconds: isFolsomBloodFeud ? 30 : undefined,
      perfDebugToggles: this.perfDebugToggles,
    });
    if (options.validateOnly) return;
    if (isFolsomBloodFeud) {
      this.blackGrassFactionManager.spawnInitialAnchors(factionAnchors);
      this.blackGrassFactionManager.spawnRamManHerd?.(folsomRamManHerdAnchors);
      if (options.source === 'compiled-outdoor' && import.meta.env?.DEV) console.info(`[FolsomBloodFeud] compiled outdoor path spawned ${factionAnchors.length} neckmen`);
      return;
    }
    const policy = this.createGeneratedEnemySpawnPolicy(runtime);
    this.generatedEnemyRuntime = { anchors: factionAnchors, activeAnchorIds: new Set(), sleepingUntil: new Map(), lastWakeAt: 0, devStats: { wakeCount: 0, sleepCount: 0, elapsedSeconds: 0 }, policy };
    this.spawnGeneratedEnemyAnchors(this.selectGeneratedEnemyWakeAnchors(this.playerSpawn?.spawnPosition ?? factionAnchors[0]?.position, policy.initialEnemyCap));
  }

  createFolsomRamManHerdAnchors(runtime) {
    const positions = [
      { x: -32, y: 0, z: -42 },
      { x: -36, y: 0, z: -47 },
      { x: -28, y: 0, z: -49 },
      { x: -40, y: 0, z: -39 },
      { x: -24, y: 0, z: -43 },
    ];
    return positions.map((position, index) => ({
      id: `folsom_ram_man_herd_${String(index + 1).padStart(2, '0')}`,
      kind: 'enemy',
      species: 'ram_man',
      preferredFaction: 'ram_man',
      faction: 'ram_man',
      position: new THREE.Vector3(position.x, position.y, position.z),
      yaw: Math.PI * (0.2 + index * 0.17),
      allowedForInitialWave: true,
      initialWave: true,
      tags: ['folsom-ram-man-herd', 'prey', 'neutral'],
      userData: { herd: 'folsom_ram_man_prey_test', cappedMax: 5 },
      patrolPoints: this.createFallbackPatrolPoints(new THREE.Vector3(position.x, position.y, position.z), 3.2),
    }));
  }

  createGeneratedEnemySpawnPolicy(runtime) {
    const policy = runtime?.definition?.runtimeSpawnPolicy ?? {};
    const activeEnemyCap = Math.max(1, Number(policy.activeEnemyCap ?? GENERATED_ENEMY_ACTIVE_CAP));
    return {
      activeEnemyCap,
      initialEnemyCap: Math.max(1, Math.min(activeEnemyCap, Number(policy.initialEnemyCap ?? GENERATED_ENEMY_INITIAL_CAP))),
      wakeRadius: Math.max(1, Number(policy.wakeRadius ?? GENERATED_ENEMY_WAKE_RADIUS)),
      sleepRadius: Math.max(1, Number(policy.sleepRadius ?? GENERATED_ENEMY_SLEEP_RADIUS)),
      respawnCooldownMs: Math.max(0, Number(policy.respawnCooldownMs ?? GENERATED_ENEMY_RESPAWN_COOLDOWN_MS)),
      maxWakePerSecond: Math.max(0.1, Number(policy.maxWakePerSecond ?? GENERATED_ENEMY_MAX_WAKE_PER_SECOND)),
      generatedAiLod: policy.generatedAiLod !== false,
      aiNearRadius: Math.max(1, Number(policy.aiNearRadius ?? GENERATED_ENEMY_AI_NEAR_RADIUS)),
      aiMidRadius: Math.max(1, Number(policy.aiMidRadius ?? GENERATED_ENEMY_AI_MID_RADIUS)),
    };
  }

  createRuntimeEnemyAnchor(spawn, runtime) {
    const safePosition = this.findSafeCompiledEnemySpawnPosition(spawn, runtime);
    if (!safePosition) {
      const reason = this.collision ? 'no-safe-walkable-point' : 'collision-unavailable';
      if (spawn.tags?.includes('folsom-blood-feud') && this.bloodFeudSpawnDebug) this.bloodFeudSpawnDebug.skipReasons.push({ id: spawn.id, reason });
      console.warn(`Skipping generated enemy spawn ${spawn.id}: ${reason}.`);
      return null;
    }
    const preferredFaction = ['sheep_demon', 'neck_man'].includes(spawn.preferredFaction) ? spawn.preferredFaction : ['sheep_demon', 'neck_man'].includes(spawn.faction) ? spawn.faction : spawn.species;
    const patrolPoints = (spawn.patrolPoints?.length ? spawn.patrolPoints : this.createFallbackPatrolPoints(safePosition))
      .map((point) => this.findSafeCompiledEnemySpawnPosition({ ...spawn, id: `${spawn.id}:patrol`, position: point }, runtime) ?? safePosition.clone());
    return { id: spawn.id, preferredFaction, faction: spawn.faction, species: spawn.species, position: safePosition, yaw: spawn.yaw, scale: spawn.scale, roomId: spawn.roomId ?? this.findCompiledRoomIdForPoint(safePosition, runtime), initialWave: spawn.initialWave || spawn.allowedForInitialWave || spawn.tags?.includes('initial-wave'), allowedForInitialWave: spawn.allowedForInitialWave, allowedForRespawn: spawn.allowedForRespawn, minDistanceFromPlayer: spawn.minDistanceFromPlayer, actionBubblePriority: spawn.actionBubblePriority, tags: spawn.tags ?? [], userData: spawn.userData ?? {}, patrolPoints: Object.freeze(patrolPoints.map((point) => point.clone())) };
  }

  findSafeCompiledEnemySpawnPosition(spawn, runtime) {
    if (!this.collision) return null;
    const position = spawn.position?.clone?.() ?? new THREE.Vector3(spawn.position?.x ?? 0, spawn.position?.y ?? 0, spawn.position?.z ?? 0);
    position.y = this.collision?.sampleWalkableY?.(position.x, position.z, position.y)?.y ?? position.y;
    if (this.collision?.canStandAtFloorPosition?.(position) ?? this.collision?.canStandAt(position)) return position;
    const room = runtime.navGraph?.rooms?.[spawn.roomId] ?? this.findCompiledRoomForPoint(position, runtime);
    const candidates = [];
    if (room) {
      const clamped = position.clone();
      clamped.x = THREE.MathUtils.clamp(clamped.x, room.minX + 0.9, room.maxX - 0.9);
      clamped.z = THREE.MathUtils.clamp(clamped.z, room.minZ + 0.9, room.maxZ - 0.9);
      candidates.push(clamped, room.center?.clone?.());
    }
    candidates.push(...this.createFallbackPatrolPoints(position, 1.5));
    return candidates.find((candidate) => candidate && (this.collision?.canStandAtFloorPosition?.(candidate) ?? this.collision?.canStandAt(candidate)))?.clone() ?? null;
  }

  findCompiledRoomForPoint(point, runtime) {
    return Object.values(runtime.navGraph?.rooms ?? {}).find((room) => point.x >= room.minX && point.x <= room.maxX && point.z >= room.minZ && point.z <= room.maxZ) ?? null;
  }
  findCompiledRoomIdForPoint(point, runtime) { return this.findCompiledRoomForPoint(point, runtime)?.id ?? null; }
  createFallbackPatrolPoints(position, radius = 3) { return [position.clone().add(new THREE.Vector3(-radius, 0, -radius)), position.clone().add(new THREE.Vector3(radius, 0, -radius)), position.clone().add(new THREE.Vector3(radius, 0, radius)), position.clone().add(new THREE.Vector3(-radius, 0, radius))]; }

  selectGeneratedEnemyWakeAnchors(playerPosition, limit) {
    if (!this.generatedEnemyRuntime || !playerPosition) return [];
    const now = Date.now();
    const { anchors, activeAnchorIds, sleepingUntil, policy } = this.generatedEnemyRuntime;
    const capacity = Math.max(0, Math.min(limit, policy.activeEnemyCap - activeAnchorIds.size));
    if (capacity <= 0) return [];
    return anchors.filter((anchor) => !activeAnchorIds.has(anchor.id) && (sleepingUntil.get(anchor.id) ?? 0) <= now)
      .map((anchor) => ({ anchor, distance: horizontalDistance(anchor.position, playerPosition) }))
      .filter(({ distance }) => distance <= policy.wakeRadius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, capacity)
      .map(({ anchor }) => anchor);
  }

  spawnGeneratedEnemyAnchors(anchors) {
    if (!anchors?.length || !this.blackGrassFactionManager || !this.generatedEnemyRuntime) return;
    this.blackGrassFactionManager.spawnInitialAnchors(anchors);
    anchors.forEach((anchor) => this.generatedEnemyRuntime.activeAnchorIds.add(anchor.id));
  }

  updateGeneratedEnemyActivation(playerPosition) {
    if (!this.generatedEnemyRuntime || !this.blackGrassFactionManager || !playerPosition) return;
    const { activeAnchorIds, sleepingUntil, policy, devStats } = this.generatedEnemyRuntime;
    const now = Date.now();
    this.blackGrassFactionManager.enemies.forEach((enemy) => {
      const anchorId = enemy.spawnAnchor?.id;
      if (!anchorId || !activeAnchorIds.has(anchorId) || !enemy.group || enemy.isRemoved) return;
      const distance = horizontalDistance(enemy.group.position, playerPosition);
      const isEngaged = enemy.playerRevengeTimer > 0 || enemy.behaviorState === 'attack_player_fallback' || enemy.behaviorState === 'attack_enemy_faction' || enemy.behaviorState === 'jump_attack_enemy_faction';
      if (distance > policy.sleepRadius && !isEngaged) {
        enemy.hideCorpse();
        activeAnchorIds.delete(anchorId);
        sleepingUntil.set(anchorId, now + policy.respawnCooldownMs);
        if (devStats) devStats.sleepCount += 1;
      }
    });
    this.blackGrassFactionManager.enemies = this.blackGrassFactionManager.enemies.filter((enemy) => !enemy.isRemoved || enemy.isAlive);
    const wakeIntervalMs = 1000 / policy.maxWakePerSecond;
    if (now - (this.generatedEnemyRuntime.lastWakeAt ?? 0) >= wakeIntervalMs) {
      const anchors = this.selectGeneratedEnemyWakeAnchors(playerPosition, 1);
      if (anchors.length) {
        this.spawnGeneratedEnemyAnchors(anchors);
        this.generatedEnemyRuntime.lastWakeAt = now;
        if (devStats) devStats.wakeCount += anchors.length;
      }
    }
  }

  update(deltaSeconds, player) {
    this.updateBlackGrassFactionEnemies(deltaSeconds, player);
    this.updateSheepDemonEnemy(deltaSeconds, player);
  }

  updateBlackGrassFactionEnemies(deltaSeconds, player) {
    if (!this.blackGrassFactionManager || !player?.position) return;
    this.perfDebugToggles = { ...createNeckmanDebugTogglesFromQuery(), ...(this.perfDebugToggles ?? {}) };
    this.blackGrassFactionManager.perfDebugToggles = this.perfDebugToggles;
    if (this.perfDebugToggles?.neckmen === false && this.blackGrassFactionManager.encounterMode === 'folsom_neckman_blood_feud') {
      this.blackGrassFactionManager.enemies?.forEach((enemy) => { if (enemy.species === 'neck_man') { if (enemy.group) enemy.group.visible = false; enemy.currentTarget = null; } });
      return;
    }
    this.updateGeneratedEnemyActivation(player.position);
    this.blackGrassFactionManager.update(deltaSeconds, player.position, { generatedRuntime: this.generatedEnemyRuntime });
    if (this.blackGrassFactionManager.encounterMode === 'folsom_neckman_blood_feud') this.blackGrassFactionManager.enemies?.forEach((enemy) => { if (enemy.species === 'neck_man' && enemy.group) enemy.group.visible = this.perfDebugToggles?.neckmanActorsHidden === true ? false : true; if (enemy.species === 'ram_man' && enemy.group) enemy.group.visible = this.perfDebugToggles?.rammanActorsHidden === true ? false : true; });
  }

  updateSheepDemonEnemy(deltaSeconds, player) {
    if (!player || this.area === 'black-grass-temple') return;
    if (this.sheepDemonEnemies?.length) {
      this.sheepDemonEnemies.forEach((enemy) => enemy.update(deltaSeconds, player.position));
      return;
    }
    this.sheepDemonEnemy?.update(deltaSeconds, player.position);
  }

  consumeEnemyContactDamage(playerPosition) {
    if (this.area === 'black-grass-temple' || this.generatedEnemyRuntime || this.blackGrassFactionManager) return this.blackGrassFactionManager?.consumeEnemyContactDamage(playerPosition) ?? null;
    if (this.sheepDemonEnemies?.length) {
      for (const enemy of this.sheepDemonEnemies) {
        const hit = enemy.consumeContactDamage(playerPosition);
        if (hit) return hit;
      }
      return null;
    }
    return this.sheepDemonEnemy?.consumeContactDamage(playerPosition) ?? null;
  }

  damageEnemyFromPlayerAttack(attack) {
    if (this.area === 'black-grass-temple' || this.generatedEnemyRuntime || this.blackGrassFactionManager) {
      const hit = this.blackGrassFactionManager?.damageEnemyFromPlayerAttack(attack) ?? null;
      this.emitPlayerAttackGore?.(hit, attack);
      return hit;
    }
    if (this.sheepDemonEnemies?.length) {
      for (const enemy of this.sheepDemonEnemies) {
        const hit = enemy.receivePlayerAttack(attack);
        this.emitPlayerAttackGore?.(hit, attack);
        if (hit) return hit;
      }
      return null;
    }
    const hit = this.sheepDemonEnemy?.receivePlayerAttack(attack) ?? null;
    this.emitPlayerAttackGore?.(hit, attack);
    return hit;
  }

  getDebugSummary() {
    const enemies = this.blackGrassFactionManager?.enemies ?? [];
    return {
      activeEnemies: enemies.filter((enemy) => enemy.isAlive && !enemy.isRemoved).length,
      activeNeckmen: enemies.filter((enemy) => enemy.species === 'neck_man' && enemy.isAlive && !enemy.isRemoved).length,
      activeAnimationMixers: enemies.reduce((count, enemy) => count + (enemy.animation?.getActiveMixerCount?.() ?? enemy.actor?.animationSet?.getActiveMixerCount?.() ?? 0), 0),
      loadedCreatureAnimationRoots: enemies.reduce((count, enemy) => count + (enemy.animation?.getLoadedRootCount?.() ?? enemy.actor?.animationSet?.getLoadedRootCount?.() ?? 0), 0),
      neckmanStateCounts: this.blackGrassFactionManager?.getNeckmanStateCounts?.() ?? [],
      generatedEnemyRuntime: this.generatedEnemyRuntime,
      encounterMode: this.blackGrassFactionManager?.encounterMode ?? null,
      folsomBloodFeud: this.bloodFeudSpawnDebug,
      mobileEnemyRuntime: this.blackGrassFactionManager?.getMobileRuntimeSummary?.() ?? null,
    };
  }

  dispose() {
    this.blackGrassFactionManager?.dispose?.();
    this.sheepDemonEnemy?.dispose?.();
    this.blackGrassFactionManager = null;
    this.generatedEnemyRuntime = null;
    this.sheepDemonEnemy = null;
  }
}

export function createCreatureWorldRuntime(options = {}) {
  return new CreatureWorldRuntime(options);
}
