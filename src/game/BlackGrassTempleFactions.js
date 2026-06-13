import * as THREE from 'three';
import { createCreatureActor } from '../engine/creatures/CreatureActorFactory.js';
import './creatures/creatureRegistry.js';
import {
  sheepDemonConfig,
  SHEEP_DEMON_ANIMATION_FILES,
  SHEEP_DEMON_FACTION_STATE_TO_ANIMATION,
} from './creatures/sheepDemon.config.js';
import {
  neckManConfig,
  NECK_MAN_ANIMATION_FILES,
  NECK_MAN_FACTION_STATE_TO_ANIMATION,
} from './creatures/neckMan.config.js';

export const BLACK_GRASS_SHEEP_DEMON_ANIMATION_ASSETS = SHEEP_DEMON_ANIMATION_FILES;
export const BLACK_GRASS_NECK_MAN_ANIMATION_ASSETS = NECK_MAN_ANIMATION_FILES;

const FACTIONS = Object.freeze({
  sheep_demon: Object.freeze({
    creatureConfigId: sheepDemonConfig.id,
    factionId: 'sheep_demon',
    displayName: sheepDemonConfig.identity.displayName,
    opposingFactionId: 'neck_man',
    assets: BLACK_GRASS_SHEEP_DEMON_ANIMATION_ASSETS,
    animationMap: SHEEP_DEMON_FACTION_STATE_TO_ANIMATION,
    targetHeight: sheepDemonConfig.scale.targetHeight,
    maxWidth: sheepDemonConfig.scale.maxWidth,
    maxHealth: sheepDemonConfig.combatProfile.maxHealth,
    walkSpeed: 0.82,
    seekSpeed: 1.55,
    attackDamage: sheepDemonConfig.combatProfile.attackDamage,
    playerAttackDamage: sheepDemonConfig.combatProfile.playerAttackDamage,
    playerAttackRange: sheepDemonConfig.combatProfile.playerAttackRange,
    attackRange: 2.05,
    visualContactRange: sheepDemonConfig.combatProfile.visualContactRange,
    attackCommitRange: sheepDemonConfig.combatProfile.attackCommitRange,
    attackImpactRange: sheepDemonConfig.combatProfile.attackImpactRange,
    attackLungeDistance: sheepDemonConfig.combatProfile.lungeDistance,
    minimumBodySeparation: sheepDemonConfig.combatProfile.minimumBodySeparation,
    attackCooldownSeconds: 1.12,
    attackDamageWindow: Object.freeze({ start: 0.36, end: 0.68 }),
    desiredCombatDistance: sheepDemonConfig.combatProfile.desiredCombatDistance,
    tooCloseDistance: sheepDemonConfig.combatProfile.tooCloseDistance,
    combatEngageDistance: 6.2,
    circleSpeed: 0.58,
    backstepSpeed: 1.45,
    lungeSpeed: 2.75,
    defensiveManeuverChance: sheepDemonConfig.combatProfile.defensiveManeuverChance,
    offensiveLungeChance: sheepDemonConfig.combatProfile.offensiveLungeChance,
    jumpAttackChance: sheepDemonConfig.combatProfile.jumpAttackChance,
    jumpAttackCooldownSeconds: 6.2,
    turnSpeed: 4.1,
    enemyAttackAnimations: Object.freeze(['punch_left']),
  }),
  neck_man: Object.freeze({
    creatureConfigId: neckManConfig.id,
    factionId: 'neck_man',
    displayName: neckManConfig.identity.displayName,
    opposingFactionId: 'sheep_demon',
    assets: BLACK_GRASS_NECK_MAN_ANIMATION_ASSETS,
    animationMap: NECK_MAN_FACTION_STATE_TO_ANIMATION,
    targetHeight: neckManConfig.scale.targetHeight,
    maxWidth: neckManConfig.scale.maxWidth,
    maxHealth: neckManConfig.combatProfile.maxHealth,
    walkSpeed: 0.92,
    seekSpeed: 1.7,
    attackDamage: neckManConfig.combatProfile.attackDamage,
    playerAttackDamage: neckManConfig.combatProfile.playerAttackDamage,
    playerAttackRange: neckManConfig.combatProfile.playerAttackRange,
    attackRange: neckManConfig.combatProfile.attackRange,
    visualContactRange: neckManConfig.combatProfile.visualContactRange,
    attackCommitRange: neckManConfig.combatProfile.attackCommitRange,
    attackImpactRange: neckManConfig.combatProfile.attackImpactRange,
    attackLungeDistance: neckManConfig.combatProfile.lungeDistance,
    minimumBodySeparation: neckManConfig.combatProfile.minimumBodySeparation,
    attackCooldownSeconds: 0.95,
    attackDamageWindow: Object.freeze({ start: 0.34, end: 0.64 }),
    desiredCombatDistance: 1.92,
    tooCloseDistance: 0.98,
    combatEngageDistance: 5.9,
    circleSpeed: 1.05,
    backstepSpeed: 1.45,
    lungeSpeed: 3.05,
    defensiveManeuverChance: neckManConfig.combatProfile.defensiveManeuverChance,
    offensiveLungeChance: neckManConfig.combatProfile.offensiveLungeChance,
    jumpAttackChance: neckManConfig.combatProfile.jumpAttackChance,
    jumpAttackCooldownSeconds: 999,
    turnSpeed: 5.8,
    enemyAttackAnimations: Object.freeze(['punch_left', 'punch_right', 'cross_punch_left', 'kick_right']),
  }),
});

export const BLACK_GRASS_FACTION_ANIMATION_REPORT = Object.freeze({
  sheep_demon: Object.freeze({
    detectedFiles: Object.values(BLACK_GRASS_SHEEP_DEMON_ANIMATION_ASSETS),
    mapping: FACTIONS.sheep_demon.animationMap,
  }),
  neck_man: Object.freeze({
    detectedFiles: Object.values(BLACK_GRASS_NECK_MAN_ANIMATION_ASSETS),
    mapping: FACTIONS.neck_man.animationMap,
  }),
});

const FACTION_STATE_MACHINE = Object.freeze([
  'spawn',
  'patrol',
  'investigate_enemy_faction',
  'seek_enemy_faction',
  'combat_enter',
  'combat_circle',
  'combat_feint',
  'combat_lunge',
  'attack_enemy_faction',
  'jump_attack_enemy_faction',
  'defensive_backstep',
  'defensive_strafe',
  'recover',
  'seek_player_fallback',
  'attack_player_fallback',
  'dead',
]);

const RETARGET_INTERVAL_SECONDS = 0.38;
const TARGET_LOCK_SECONDS = 1.25;
const WAYPOINT_LOCK_SECONDS = 0.72;
const COMBAT_MANEUVER_LOCK_MIN_SECONDS = 0.72;
const DIRECTOR_TARGET_LOCK_SECONDS = 2.8;
const ACTION_BUBBLE_PREFERRED_MIN = 12;
const ACTION_BUBBLE_PREFERRED_MAX = 28;
const ACTION_BUBBLE_HARD_RADIUS = 48;
const ACTION_BUBBLE_RECYCLE_RADIUS = 58;
const MIN_PLAYER_SPAWN_DISTANCE = 10;
const FAR_AWARENESS_RADIUS = 26;
const SAME_ROOM_AWARENESS_RADIUS = 32;
const ADJACENT_ROOM_AWARENESS_RADIUS = 30;
const COMBAT_AWARENESS_RADIUS = 15;
const DOORWAY_COMBAT_AWARENESS_RADIUS = 10;
const MAX_FAR_ROOM_PATH_STEPS = 1;
const SHORT_ROUTE_INVESTIGATION_RADIUS = 42;
const MAX_SHORT_ROUTE_INVESTIGATION_STEPS = 1;
const PLAYER_DETECTION_RADIUS = 13.5;
const LOSE_PLAYER_RADIUS = 22;
const PLAYER_REVENGE_SECONDS = 6;
const PLAYER_NEAR_FIGHT_SECONDS = 2.25;
const NO_OPPOSING_TARGET_PLAYER_SECONDS = 2.75;
const NEARBY_COMBAT_TIMEOUT_SECONDS = 18;
const FAR_IRRELEVANT_REDIRECT_SECONDS = 4;
const FAR_IRRELEVANT_RECYCLE_SECONDS = 9;
const RESPAWN_COOLDOWN_SECONDS = 10;
const CORPSE_SECONDS = 28;
const MAX_ACTIVE_BY_FACTION = Object.freeze({ sheep_demon: 2, neck_man: 2 });
const INITIAL_WAVE_BY_FACTION = Object.freeze({ sheep_demon: 1, neck_man: 1 });
const DEV_DIAGNOSTIC_INTERVAL_SECONDS = 5;
const IS_DEV = import.meta.env.DEV;
const WAYPOINT_REPATH_SECONDS = 0.75;
const STUCK_MOVEMENT_THRESHOLD = 0.04;
const SOFT_STUCK_SECONDS = 0.7;
const HARD_STUCK_SECONDS = 1.5;
const ABANDON_STUCK_SECONDS = 2.5;
const UNSTUCK_SECONDS = 0.48;
const NAV_CLEARANCE_RADIUS = 0.58;
const LOCAL_DETOUR_PADDING = 1.05;
const LOCAL_DETOUR_REACHED_DISTANCE = 0.45;
const STEERING_PROBE_DISTANCE = 0.82;
const STEERING_PROBE_SECONDS = 0.5;
const BLOCKED_TARGET_REPATH_SECONDS = 1.7;
const BLOCKED_SEGMENT_COOLDOWN_SECONDS = 3.0;
const ENEMY_PERSONAL_SPACE = 1.15;
const ENEMY_SEPARATION_STRENGTH = 0.32;
const LOCOMOTION_ANIMATION_HOLD_SECONDS = Object.freeze({
  spawn: 0.4,
  patrol: 0.8,
  investigate_enemy_faction: 0.8,
  seek_enemy_faction: 0.7,
  combat_enter: 0.55,
  combat_circle: 0.55,
  combat_feint: 0.55,
  combat_lunge: 0.45,
  defensive_backstep: 0.5,
  defensive_strafe: 0.5,
  recover: 0.25,
  seek_player_fallback: 0.7,
});
const IMMEDIATE_ANIMATION_STATES = new Set(['attack_enemy_faction', 'jump_attack_enemy_faction', 'attack_player_fallback', 'dead']);
const SHEEP_DEMON_BLACK_GRASS_NEUTRAL_COLOR = new THREE.Color(0xffffff);
const SHEEP_DEMON_BLACK_GRASS_SHADOW_FILL = new THREE.Color(0x0d1118);


function vectorSummary(vector) {
  return {
    x: Number(vector.x.toFixed(2)),
    y: Number(vector.y.toFixed(2)),
    z: Number(vector.z.toFixed(2)),
  };
}

function boxSizeSummary(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return { x: 0, y: 0, z: 0 };
  return vectorSummary(box.getSize(new THREE.Vector3()));
}

function horizontalDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function chooseClipForAnimation(assetState, clips) {
  const normalizedState = assetState.toLowerCase();
  const withoutUnderscore = normalizedState.replaceAll('_', '');
  return clips.find((candidate) => {
    const name = (candidate.name || '').toLowerCase();
    return name.includes(normalizedState) || name.replaceAll('_', '').includes(withoutUnderscore);
  }) ?? clips[0];
}

const warnedFallbacks = new Set();

function resolveAnimationState({ species, requestedState, assets }) {
  if (assets[requestedState]) return requestedState;
  const fallback = assets.idle ? 'idle' : Object.keys(assets)[0];
  const key = `${species}:${requestedState}`;
  if (!warnedFallbacks.has(key)) {
    warnedFallbacks.add(key);
    console.warn(`Black Grass Temple faction enemy missing ${species} animation "${requestedState}"; falling back to "${fallback}".`);
  }
  return fallback;
}

function makeAnimationTrack({ state, root, gltf, scale }) {
  const mixer = new THREE.AnimationMixer(root);
  const clips = gltf.animations ?? [];
  const clip = chooseClipForAnimation(state, clips);

  if (!clip) {
    console.warn(`Black Grass Temple ${state} GLB loaded without animation clips.`);
    return { root, mixer, action: null, clip: null, clipNames: [], clipSummaries: [], scale };
  }

  const action = mixer.clipAction(clip);
  const isOneShot = ['punch_left', 'punch_right', 'cross_punch_left', 'kick_right', 'jump', 'die'].includes(state);
  action.setLoop(isOneShot ? THREE.LoopOnce : THREE.LoopRepeat, isOneShot ? 1 : Infinity);
  action.clampWhenFinished = isOneShot;

  return {
    root,
    mixer,
    action,
    clip,
    clipNames: clips.map((candidate) => candidate.name || '(unnamed clip)'),
    clipSummaries: clips.map((candidate) => ({
      name: candidate.name || '(unnamed clip)',
      durationSeconds: Number(candidate.duration.toFixed(3)),
      trackCount: candidate.tracks.length,
    })),
    scale,
  };
}

function clampPatrolPoint(point, fallback) {
  return point instanceof THREE.Vector3 ? point : fallback;
}

function makePatrolPoints(origin, spread = 4.5) {
  return Object.freeze([
    new THREE.Vector3(origin.x - spread, 0, origin.z - spread * 0.45),
    new THREE.Vector3(origin.x + spread * 0.7, 0, origin.z - spread * 0.65),
    new THREE.Vector3(origin.x + spread, 0, origin.z + spread * 0.5),
    new THREE.Vector3(origin.x - spread * 0.65, 0, origin.z + spread * 0.72),
  ]);
}

function tuneMaterialTexture(texture, colorSpace) {
  if (!texture) return false;
  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
  return true;
}

function tuneBlackGrassSheepDemonMaterials(root) {
  const tunedMaterials = new Set();
  const summary = {
    meshes: 0,
    materials: 0,
    baseColorMapsSetToSrgb: 0,
    nonColorMapsKeptLinear: 0,
    neutralizedColorMultipliers: 0,
  };

  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    summary.meshes += 1;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material || tunedMaterials.has(material)) return;
      tunedMaterials.add(material);
      summary.materials += 1;

      if (tuneMaterialTexture(material.map, THREE.SRGBColorSpace)) summary.baseColorMapsSetToSrgb += 1;
      [
        material.normalMap,
        material.roughnessMap,
        material.metalnessMap,
        material.aoMap,
        material.bumpMap,
        material.displacementMap,
        material.alphaMap,
      ].forEach((texture) => {
        if (tuneMaterialTexture(texture, THREE.NoColorSpace)) summary.nonColorMapsKeptLinear += 1;
      });

      if (material.color instanceof THREE.Color) {
        if (!material.color.equals(SHEEP_DEMON_BLACK_GRASS_NEUTRAL_COLOR)) summary.neutralizedColorMultipliers += 1;
        material.color.copy(SHEEP_DEMON_BLACK_GRASS_NEUTRAL_COLOR);
      }

      if ('emissive' in material && material.emissive instanceof THREE.Color) {
        material.emissive.copy(SHEEP_DEMON_BLACK_GRASS_SHADOW_FILL);
        material.emissiveIntensity = Math.min(Math.max(material.emissiveIntensity ?? 0, 0.1), 0.16);
      }
      if ('metalness' in material) material.metalness = Math.min(material.metalness ?? 0, 0.02);
      if ('roughness' in material) material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.84, 0.76, 0.9);
      material.needsUpdate = true;
    });
  });

  return summary;
}

function makeNavPointSummary(point) {
  return point ? { x: Number(point.x.toFixed(2)), z: Number(point.z.toFixed(2)) } : null;
}

function inflateRect(rect, amount) {
  return {
    ...rect,
    minX: rect.minX - amount,
    maxX: rect.maxX + amount,
    minZ: rect.minZ - amount,
    maxZ: rect.maxZ + amount,
  };
}

function segmentIntersectsRect(start, end, rect) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  let tMin = 0;
  let tMax = 1;
  const clip = (p, q) => {
    if (Math.abs(p) < 0.000001) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > tMax) return false;
      if (r > tMin) tMin = r;
    } else {
      if (r < tMin) return false;
      if (r < tMax) tMax = r;
    }
    return true;
  };

  return clip(-dx, start.x - rect.minX)
    && clip(dx, rect.maxX - start.x)
    && clip(-dz, start.z - rect.minZ)
    && clip(dz, rect.maxZ - start.z)
    && tMax >= 0
    && tMin <= 1;
}

function pointInExpandedRect(point, rect, padding = 0) {
  return point.x >= rect.minX - padding && point.x <= rect.maxX + padding
    && point.z >= rect.minZ - padding && point.z <= rect.maxZ + padding;
}

function rotateHorizontal(vector, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return new THREE.Vector3(
    vector.x * cos - vector.z * sin,
    0,
    vector.x * sin + vector.z * cos,
  );
}

function toVector3(value, fallbackY = 0) {
  if (value instanceof THREE.Vector3) return value.clone();
  return new THREE.Vector3(
    Number(value?.x ?? value?.[0] ?? 0),
    Number(value?.y ?? value?.[1] ?? fallbackY),
    Number(value?.z ?? value?.[2] ?? 0),
  );
}


class BlackGrassFactionEnemy {
  constructor({ scene, collision, navigationGraph = null, species, id, spawnAnchor, patrolPoints = null, onLoaded = null, onGoreEvent = null }) {
    this.scene = scene;
    this.collision = collision;
    this.navigationGraph = navigationGraph;
    this.species = species;
    this.template = FACTIONS[species];
    this.id = id;
    this.spawnAnchor = spawnAnchor;
    this.actor = null;
    this.group = null;
    this.animation = null;
    this.behaviorState = null;
    this.health = this.template.maxHealth;
    this.isLoaded = false;
    this.isRemoved = false;
    this.retargetElapsed = RETARGET_INTERVAL_SECONDS * Math.random();
    this.targetLockTimer = TARGET_LOCK_SECONDS * (0.4 + Math.random() * 0.4);
    this.currentTarget = null;
    this.patrolPoints = Object.freeze((patrolPoints ?? makePatrolPoints(spawnAnchor.position)).map((point) => clampPatrolPoint(point, spawnAnchor.position)));
    this.patrolTargetIndex = Math.floor(Math.random() * this.patrolPoints.length);
    this.pauseTimer = 0.2 + Math.random() * 0.6;
    this.attackCooldown = 0.4 + Math.random() * 0.8;
    this.attackElapsed = 0;
    this.attackHasDamaged = false;
    this.pendingAttackAnimation = null;
    this.jumpAttackCooldown = Math.random() * this.template.jumpAttackCooldownSeconds;
    this.awarenessReactionDelay = 0;
    this.awarenessTier = 'none';
    this.combatManeuver = 'none';
    this.combatManeuverTimer = 0;
    this.combatStrafeSign = Math.random() < 0.5 ? -1 : 1;
    this.recoverTimer = 0;
    this.devCombatLogElapsed = Math.random();
    this.devLastCombatLogKey = '';
    this.corpseTimer = CORPSE_SECONDS;
    this.onLoaded = onLoaded;
    this.onGoreEvent = onGoreEvent;
    this.devMarker = null;
    this.pathMarker = null;
    this.stuckMarker = null;
    this.pathRepathElapsed = WAYPOINT_REPATH_SECONDS;
    this.activeWaypoint = null;
    this.waypointLockTimer = 0;
    this.localAvoidanceWaypoint = null;
    this.steeringProbeTimer = 0;
    this.steeringProbeDirection = new THREE.Vector3();
    this.blockedTargetElapsed = 0;
    this.blockedSegmentCooldowns = new Map();
    this.stuckElapsed = 0;
    this.unstuckTimer = 0;
    this.unstuckDirection = new THREE.Vector3();
    this.currentUpdateContext = null;
    this.directorTarget = null;
    this.directorTargetReason = null;
    this.directorTargetLockTimer = 0;
    this.animationStateElapsed = 0;
    this.noOpposingTargetElapsed = 0;
    this.playerRevengeTimer = 0;
    this.playerFightProximityElapsed = 0;
    this.farIrrelevantElapsed = 0;
  }

  load() {
    const idleState = this.resolveStateAnimation('spawn');
    const primaryStates = new Set([
      idleState,
      this.resolveStateAnimation('patrol'),
      this.resolveStateAnimation('investigate_enemy_faction'),
      this.resolveStateAnimation('seek_enemy_faction'),
      this.resolveStateAnimation('combat_circle'),
      this.resolveStateAnimation('combat_lunge'),
      this.resolveStateAnimation('defensive_backstep'),
      this.resolveStateAnimation('attack_enemy_faction'),
      this.resolveStateAnimation('jump_attack_enemy_faction'),
      this.resolveStateAnimation('dead'),
      ...this.template.enemyAttackAnimations,
    ]);
    const allStates = Object.keys(this.template.assets);
    const priorityRemaining = allStates.filter((candidate) => candidate !== idleState && primaryStates.has(candidate));
    const optionalRemaining = allStates.filter((candidate) => candidate !== idleState && !primaryStates.has(candidate));

    this.actor = createCreatureActor(this.template.creatureConfigId, {
      scene: this.scene,
      position: this.spawnAnchor.position,
      yaw: this.spawnAnchor.yaw ?? 0,
      name: this.id,
    });

    return this.actor.load({ initialStates: [idleState], lazyStates: [...priorityRemaining, ...optionalRemaining] })
      .then((actor) => {
        this.group = actor.group;
        this.group.visible = true;
        this.animation = actor.animationSet;
        this.group.userData = {
          ...this.group.userData,
          hostile: true,
          blackGrassTempleFactionEnemy: true,
          faction: this.species,
          opposingFaction: this.template.opposingFactionId,
          displayName: `${this.template.displayName} ${this.spawnAnchor.id}`,
          spawnAnchorId: this.spawnAnchor.id,
          spawnPosition: vectorSummary(this.spawnAnchor.position),
          stateMachine: FACTION_STATE_MACHINE,
          targetPriority: ['nearest living opposing faction enemy', 'player fallback', 'patrol target'],
          animationMapping: this.template.animationMap,
          assetUrls: this.template.assets,
          expectedAnimationStates: Object.keys(this.template.assets),
          health: this.health,
        };

        this.setBehaviorState('spawn', { force: true });
        this.ensureSingleVisibleAnimationRoot();
        this.addDevMarker();
        this.isLoaded = true;
        this.refreshAnimationUserData();
        this.logLoadDiagnostics('idle-visible');
        this.onLoaded?.(this);
      })
      .catch((error) => {
        console.warn(`Black Grass Temple ${this.template.displayName} failed to load idle model; faction spawn skipped.`, error);
      });
  }

  addDevMarker() {
    if (!IS_DEV || !this.group || this.devMarker) return;
    const color = this.species === 'sheep_demon' ? 0xff3131 : 0x20d6a4;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8),
      new THREE.MeshBasicMaterial({ color, depthTest: false }),
    );
    marker.name = `${this.id}-dev-visible-faction-marker`;
    marker.position.set(0, this.template.targetHeight + 0.45, 0);
    marker.renderOrder = 999;
    marker.userData = { devOnly: true, blackGrassFactionMarker: true, species: this.species, enemyId: this.id };
    this.group.add(marker);
    this.devMarker = marker;
  }



  ensurePathMarker() {
    if (!IS_DEV || this.pathMarker) return;
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xf7dc4f, depthTest: false, transparent: true, opacity: 0.72 }),
    );
    marker.name = `${this.id}-dev-current-path-waypoint`;
    marker.renderOrder = 998;
    marker.userData = { devOnly: true, blackGrassFactionPathWaypoint: true, species: this.species, enemyId: this.id };
    this.scene.add(marker);
    this.pathMarker = marker;
  }

  ensureStuckMarker() {
    if (!IS_DEV || this.stuckMarker) return;
    const marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.7, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd000, depthTest: false, transparent: true, opacity: 0.86 }),
    );
    marker.name = `${this.id}-dev-stuck-marker`;
    marker.renderOrder = 1000;
    marker.visible = false;
    marker.userData = { devOnly: true, blackGrassFactionStuckMarker: true, species: this.species, enemyId: this.id };
    this.scene.add(marker);
    this.stuckMarker = marker;
  }

  updateDevNavigationMarkers() {
    if (!IS_DEV || !this.group) return;
    if (this.activeWaypoint) {
      this.ensurePathMarker();
      this.pathMarker.position.set(this.activeWaypoint.x, 0.55, this.activeWaypoint.z);
      this.pathMarker.visible = true;
    } else if (this.pathMarker) {
      this.pathMarker.visible = false;
    }
    this.ensureStuckMarker();
    this.stuckMarker.position.set(this.group.position.x, this.template.targetHeight + 0.95, this.group.position.z);
    this.stuckMarker.visible = this.unstuckTimer > 0 || this.stuckElapsed > SOFT_STUCK_SECONDS;
    if (this.group.userData.navigation) {
      this.group.userData.navigation.localAvoidanceWaypoint = makeNavPointSummary(this.localAvoidanceWaypoint);
      this.group.userData.navigation.stuckSeconds = Number(this.stuckElapsed.toFixed(2));
      this.group.userData.navigation.steeringProbeActive = this.steeringProbeTimer > 0;
    }
  }

  refreshAnimationUserData() {
    if (!this.group || !this.animation) return;
    const tracks = this.animation.tracks;
    this.group.userData.animationClips = Object.fromEntries(Object.entries(tracks).map(([state, track]) => [state, track.clipNames]));
    this.group.userData.animationClipDetails = Object.fromEntries(Object.entries(tracks).map(([state, track]) => [state, track.clipSummaries]));
    this.group.userData.loadedAnimationStates = Object.keys(tracks);
    this.group.userData.normalizedScale = Object.fromEntries(Object.entries(tracks).map(([state, track]) => [state, track.scale]));
    this.group.userData.visibleAnimationState = this.group.userData.animationState;
    this.group.userData.visibleAnimationRootCount = Object.values(tracks).filter((track) => track.root.visible).length;
    this.group.userData.boundingBoxSize = boxSizeSummary(this.group);
    this.group.userData.worldPosition = vectorSummary(this.group.getWorldPosition(new THREE.Vector3()));
  }

  ensureSingleVisibleAnimationRoot() {
    if (!this.group || !this.animation) return;
    this.group.visible = true;
    const animationState = this.resolveStateAnimation(this.behaviorState ?? 'spawn');
    const visibleState = this.animation.tracks[animationState] ? animationState : Object.keys(this.animation.tracks)[0];
    Object.entries(this.animation.tracks).forEach(([trackState, track]) => {
      track.root.visible = trackState === visibleState;
    });
    this.group.userData.animationState = visibleState;
    this.group.userData.visibleAnimationState = visibleState;
    this.group.userData.visibleAnimationRootCount = 1;
  }

  logLoadDiagnostics(stage) {
    if (!IS_DEV || !this.group || !this.animation) return;
    this.refreshAnimationUserData();
    const visibleAnimationState = this.group.userData.visibleAnimationState;
    console.info('Black Grass Temple faction enemy visibility diagnostic:', {
      stage,
      species: this.species,
      id: this.id,
      spawnAnchorId: this.spawnAnchor.id,
      spawnPosition: vectorSummary(this.spawnAnchor.position),
      loadedAnimationStates: this.group.userData.loadedAnimationStates,
      glbTrackCount: this.animation.tracks[visibleAnimationState]?.clip?.tracks.length ?? 0,
      visibleAnimationState,
      visibleAnimationRootCount: this.group.userData.visibleAnimationRootCount,
      groupVisible: this.group.visible,
      scaleByState: this.group.userData.normalizedScale,
      boundingBoxSize: this.group.userData.boundingBoxSize,
      finalWorldPosition: this.group.userData.worldPosition,
    });
  }

  get isAlive() {
    return Boolean(this.group) && this.health > 0 && this.behaviorState !== 'dead' && !this.isRemoved;
  }

  update(deltaSeconds, context) {
    this.animation?.mixers.forEach((mixer) => mixer.update(deltaSeconds));
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaSeconds);
    this.devCombatLogElapsed += deltaSeconds;
    this.jumpAttackCooldown = Math.max(0, this.jumpAttackCooldown - deltaSeconds);
    this.playerRevengeTimer = Math.max(0, this.playerRevengeTimer - deltaSeconds);
    this.awarenessReactionDelay = Math.max(0, this.awarenessReactionDelay - deltaSeconds);
    this.currentUpdateContext = context;
    this.steeringProbeTimer = Math.max(0, this.steeringProbeTimer - deltaSeconds);
    this.decayBlockedSegmentCooldowns(deltaSeconds);
    if (!this.group || this.isRemoved) return;

    if (this.behaviorState === 'dead') {
      this.corpseTimer -= deltaSeconds;
      if (this.corpseTimer <= 0) this.hideCorpse();
      return;
    }

    this.retargetElapsed += deltaSeconds;
    this.targetLockTimer = Math.max(0, this.targetLockTimer - deltaSeconds);
    this.waypointLockTimer = Math.max(0, this.waypointLockTimer - deltaSeconds);
    this.directorTargetLockTimer = Math.max(0, this.directorTargetLockTimer - deltaSeconds);
    this.animationStateElapsed += deltaSeconds;
    const attackCommitted = this.behaviorState === 'attack_enemy_faction' || this.behaviorState === 'jump_attack_enemy_faction' || this.behaviorState === 'attack_player_fallback';
    if (!attackCommitted && (this.retargetElapsed >= RETARGET_INTERVAL_SECONDS || !this.isTargetStillValid(context))) {
      this.retargetElapsed = 0;
      this.selectTarget(context);
    }

    this.updateDirectorPressureTimers(deltaSeconds, context);
    this.pathRepathElapsed += deltaSeconds;

    if (this.unstuckTimer > 0) {
      this.unstuckTimer = Math.max(0, this.unstuckTimer - deltaSeconds);
      this.activeWaypoint = null;
      this.moveToward(this.unstuckDirection, this.template.walkSpeed * 0.75, deltaSeconds, Infinity, 'patrol', { suppressStuckTracking: true });
      this.updateDevNavigationMarkers();
      return;
    }

    if (this.behaviorState === 'recover') {
      this.recoverTimer = Math.max(0, this.recoverTimer - deltaSeconds);
      const targetPosition = this.currentTarget?.type === 'enemy' ? this.currentTarget.enemy?.group?.position : null;
      if (targetPosition) {
        const face = targetPosition.clone().sub(this.group.position);
        face.y = 0;
        if (face.lengthSq() > 0.001) this.faceDirection(face.normalize(), deltaSeconds);
      }
      if (this.recoverTimer > 0) {
        this.updateDevNavigationMarkers();
        return;
      }
    }

    if (this.behaviorState === 'attack_enemy_faction' || this.behaviorState === 'jump_attack_enemy_faction' || this.behaviorState === 'attack_player_fallback') {
      this.updateAttack(deltaSeconds, context);
      this.updateDevNavigationMarkers();
      return;
    }

    if (this.currentTarget?.type === 'enemy') {
      this.updateEnemyTarget(deltaSeconds, context);
      this.updateDevNavigationMarkers();
      return;
    }

    if (this.currentTarget?.type === 'player') {
      this.updatePlayerTarget(deltaSeconds, context.playerPosition);
      this.updateDevNavigationMarkers();
      return;
    }

    if (this.directorTarget) {
      this.updateDirectorTarget(deltaSeconds);
      this.updateDevNavigationMarkers();
      return;
    }

    this.updatePatrol(deltaSeconds);
    this.updateDevNavigationMarkers();
  }

  updateDirectorPressureTimers(deltaSeconds, context) {
    const opposingEnemy = this.findNearestOpposingEnemy(context);
    if (opposingEnemy) {
      this.noOpposingTargetElapsed = 0;
    } else {
      this.noOpposingTargetElapsed += deltaSeconds;
    }

    const nearPlayer = context.playerPosition && horizontalDistance(this.group.position, context.playerPosition) <= PLAYER_DETECTION_RADIUS + 2;
    const fightingOpposing = this.currentTarget?.type === 'enemy'
      && ['combat_enter', 'combat_circle', 'combat_feint', 'combat_lunge', 'attack_enemy_faction', 'jump_attack_enemy_faction', 'defensive_backstep', 'defensive_strafe', 'recover'].includes(this.behaviorState);
    this.playerFightProximityElapsed = nearPlayer && fightingOpposing
      ? this.playerFightProximityElapsed + deltaSeconds
      : Math.max(0, this.playerFightProximityElapsed - deltaSeconds * 1.5);
  }

  isTargetStillValid(context) {
    if (this.currentTarget?.type === 'enemy') {
      const enemy = this.currentTarget.enemy;
      return enemy?.isAlive && this.getOpposingAwareness(enemy, context).tier !== 'none';
    }
    if (this.currentTarget?.type === 'player') {
      const enemyTarget = this.findNearestOpposingEnemy(context);
      const enemyIsImmediate = enemyTarget && ['melee', 'combat'].includes(this.awarenessTier);
      if (enemyIsImmediate && this.playerRevengeTimer <= 0) return false;
      return context.playerPosition && horizontalDistance(this.group.position, context.playerPosition) <= LOSE_PLAYER_RADIUS;
    }
    return false;
  }

  selectTarget(context) {
    const previousTargetId = this.currentTarget?.type === 'enemy' ? this.currentTarget.enemy?.id : null;
    if (this.targetLockTimer > 0 && this.isTargetStillValid(context)) {
      this.group.userData.targetLockRemaining = Number(this.targetLockTimer.toFixed(2));
      return;
    }
    const opposingEnemy = this.findNearestOpposingEnemy(context);
    const shouldPressurePlayer = this.shouldTargetPlayer(context, opposingEnemy);
    const opposingIsImmediatelyRelevant = opposingEnemy && ['melee', 'combat', 'same_room', 'adjacent_room'].includes(this.awarenessTier);

    if (opposingEnemy && (!shouldPressurePlayer || opposingIsImmediatelyRelevant)) {
      this.noOpposingTargetElapsed = 0;
      if (previousTargetId !== opposingEnemy.id) {
        this.awarenessReactionDelay = opposingIsImmediatelyRelevant ? 0.08 + Math.random() * 0.24 : 0.22 + Math.random() * 0.34;
        this.combatManeuverTimer = 0;
        this.logCombatEvent('target-acquired', { target: opposingEnemy, maneuver: this.awarenessTier, distance: horizontalDistance(this.group.position, opposingEnemy.group.position) });
      }
      this.currentTarget = { type: 'enemy', enemy: opposingEnemy };
      if (previousTargetId !== opposingEnemy.id) this.targetLockTimer = TARGET_LOCK_SECONDS * (0.85 + Math.random() * 0.35);
      this.group.userData.targetType = 'opposing_faction';
      this.group.userData.targetId = opposingEnemy.id;
      this.group.userData.awarenessTier = this.awarenessTier;
      return;
    }

    if (shouldPressurePlayer) {
      const wasPlayerTarget = this.currentTarget?.type === 'player';
      this.currentTarget = { type: 'player' };
      if (!wasPlayerTarget) this.targetLockTimer = TARGET_LOCK_SECONDS;
      this.group.userData.targetType = this.playerRevengeTimer > 0 ? 'player_revenge' : 'player_fallback';
      this.group.userData.targetId = 'player';
      this.logCombatEvent('player-targeted', { maneuver: this.group.userData.targetType, distance: horizontalDistance(this.group.position, context.playerPosition) });
      return;
    }

    this.currentTarget = null;
    this.targetLockTimer = 0;
    this.group.userData.targetType = this.directorTarget ? 'director_encounter_zone' : 'patrol';
    this.group.userData.targetId = this.directorTargetReason ?? null;
    this.group.userData.awarenessTier = 'none';
  }

  shouldTargetPlayer(context, opposingEnemy) {
    if (!context.playerPosition || !this.group) return false;
    const playerDistance = horizontalDistance(this.group.position, context.playerPosition);
    const opposingDistance = opposingEnemy?.group ? horizontalDistance(this.group.position, opposingEnemy.group.position) : Infinity;
    const playerClose = playerDistance <= PLAYER_DETECTION_RADIUS;
    const revenge = this.playerRevengeTimer > 0 && playerDistance <= LOSE_PLAYER_RADIUS;
    const noOpposing = !opposingEnemy && this.noOpposingTargetElapsed >= NO_OPPOSING_TARGET_PLAYER_SECONDS && playerDistance <= LOSE_PLAYER_RADIUS;
    const playerInterruptingFight = this.playerFightProximityElapsed >= PLAYER_NEAR_FIGHT_SECONDS && playerDistance <= PLAYER_DETECTION_RADIUS + 2;
    const playerCloserThanStuckEnemy = opposingEnemy && playerDistance + 2 < opposingDistance && this.stuckElapsed > SOFT_STUCK_SECONDS && playerDistance <= LOSE_PLAYER_RADIUS;
    return revenge || playerClose || noOpposing || playerInterruptingFight || playerCloserThanStuckEnemy;
  }

  findNearestOpposingEnemy(context) {
    let nearest = null;
    let nearestDistance = Infinity;
    let nearestAwareness = null;
    context.enemies.forEach((enemy) => {
      if (enemy === this || enemy.species !== this.template.opposingFactionId || !enemy.isAlive || !enemy.group) return;
      const awareness = this.getOpposingAwareness(enemy, context);
      if (this.blockedSegmentCooldowns.has(enemy.id) && awareness.tier !== 'melee') return;
      if (awareness.tier === 'none' || awareness.distance >= nearestDistance) return;
      nearest = enemy;
      nearestDistance = awareness.distance;
      nearestAwareness = awareness;
    });
    this.awarenessTier = nearestAwareness?.tier ?? 'none';
    this.group.userData.awarenessTier = this.awarenessTier;
    this.group.userData.roomPathToEnemy = nearestAwareness?.roomPath ?? [];
    return nearest;
  }

  getOpposingAwareness(enemy, context = null) {
    if (!this.group || !enemy?.group) return { tier: 'none', distance: Infinity, roomPath: [] };
    const distance = horizontalDistance(this.group.position, enemy.group.position);
    const visible = this.hasLineOfMovement(this.group.position, enemy.group.position);
    const targetBlockedRecently = this.blockedSegmentCooldowns.has(enemy.id);
    const selfRoom = this.findNearestNavigableRoom(this.group.position);
    const targetRoom = this.findNearestNavigableRoom(enemy.group.position);
    const sameRoom = Boolean(selfRoom && targetRoom && selfRoom.id === targetRoom.id);
    const roomPath = selfRoom && targetRoom ? this.findRoomPath(selfRoom.id, targetRoom.id) : [];
    const roomSteps = roomPath.length > 1 ? roomPath.length - 1 : (sameRoom ? 0 : Infinity);
    const adjacentRoom = roomSteps === 1;
    const nearDoorway = adjacentRoom && distance <= DOORWAY_COMBAT_AWARENESS_RADIUS;
    const selfNearPlayer = context?.playerPosition ? horizontalDistance(this.group.position, context.playerPosition) <= ACTION_BUBBLE_HARD_RADIUS : false;
    const targetNearPlayer = context?.playerPosition ? horizontalDistance(enemy.group.position, context.playerPosition) <= ACTION_BUBBLE_HARD_RADIUS : false;
    const inPlayerActionBubble = selfNearPlayer && targetNearPlayer;

    if (inPlayerActionBubble && distance <= ACTION_BUBBLE_PREFERRED_MAX && !targetBlockedRecently) {
      return { tier: visible && distance <= this.template.combatEngageDistance ? 'melee' : 'combat', distance, roomPath };
    }
    if (((sameRoom && visible && distance <= this.template.combatEngageDistance) || (visible && distance <= this.template.combatEngageDistance) || nearDoorway) && !targetBlockedRecently) {
      return { tier: 'melee', distance, roomPath };
    }
    if (((sameRoom && distance <= COMBAT_AWARENESS_RADIUS) || (visible && distance <= COMBAT_AWARENESS_RADIUS) || nearDoorway) && !targetBlockedRecently) {
      return { tier: 'combat', distance, roomPath };
    }
    if (sameRoom && distance <= SAME_ROOM_AWARENESS_RADIUS) {
      return { tier: 'same_room', distance, roomPath };
    }
    if (adjacentRoom && distance <= ADJACENT_ROOM_AWARENESS_RADIUS) {
      return { tier: 'adjacent_room', distance, roomPath };
    }
    if (roomSteps <= MAX_FAR_ROOM_PATH_STEPS && distance <= FAR_AWARENESS_RADIUS) {
      return { tier: 'far', distance, roomPath };
    }
    if (roomSteps <= MAX_SHORT_ROUTE_INVESTIGATION_STEPS && distance <= SHORT_ROUTE_INVESTIGATION_RADIUS) {
      return { tier: 'short_route', distance, roomPath };
    }
    return { tier: 'none', distance, roomPath };
  }

  updateEnemyTarget(deltaSeconds, context) {
    const target = this.currentTarget.enemy;
    if (!target?.isAlive || !target.group) {
      this.currentTarget = null;
      return;
    }

    const awareness = this.getOpposingAwareness(target, context);
    this.awarenessTier = awareness.tier;
    this.group.userData.awarenessTier = awareness.tier;
    this.group.userData.roomPathToEnemy = awareness.roomPath;
    if (awareness.tier === 'none') {
      this.currentTarget = null;
      return;
    }

    const toTarget = target.group.position.clone().sub(this.group.position);
    toTarget.y = 0;
    const distance = toTarget.length();

    if (this.awarenessReactionDelay > 0) {
      this.setBehaviorState(awareness.tier === 'far' || awareness.tier === 'adjacent_room' || awareness.tier === 'short_route' ? 'investigate_enemy_faction' : 'combat_enter');
      return;
    }

    const directClear = this.hasClearMovementSegment(this.group.position, target.group.position, NAV_CLEARANCE_RADIUS);
    this.blockedTargetElapsed = directClear ? 0 : this.blockedTargetElapsed + deltaSeconds;
    if (this.blockedTargetElapsed >= BLOCKED_TARGET_REPATH_SECONDS) this.blockCurrentDirectSegment();

    if ((distance <= this.template.combatEngageDistance || awareness.tier === 'melee' || awareness.tier === 'combat') && directClear) {
      this.updateEnemyCombat(deltaSeconds, target, distance, toTarget);
      return;
    }

    if ((distance <= this.template.combatEngageDistance || awareness.tier === 'melee' || awareness.tier === 'combat') && !directClear) {
      this.combatManeuverTimer = 0;
      this.moveToPosition(target.group.position, this.template.seekSpeed * 0.68, deltaSeconds, Math.max(0, distance - this.template.attackRange * 0.9), 'seek_enemy_faction');
      return;
    }

    const investigativeTier = awareness.tier === 'far' || awareness.tier === 'adjacent_room' || awareness.tier === 'short_route';
    const speed = investigativeTier
      ? this.template.walkSpeed * (0.78 + Math.random() * 0.1)
      : this.template.seekSpeed * 0.72;
    const state = investigativeTier ? 'investigate_enemy_faction' : 'seek_enemy_faction';
    const stopDistance = investigativeTier ? Math.max(this.template.combatEngageDistance + 3, this.template.desiredCombatDistance + 2) : this.template.combatEngageDistance * 0.9;
    this.moveToPosition(target.group.position, speed, deltaSeconds, Math.max(0, distance - stopDistance), state);
  }

  updateEnemyCombat(deltaSeconds, target, distance, toTarget) {
    const directClear = this.hasClearMovementSegment(this.group.position, target.group.position, NAV_CLEARANCE_RADIUS);
    if (!directClear) {
      this.blockedTargetElapsed += deltaSeconds;
      if (this.blockedTargetElapsed >= BLOCKED_TARGET_REPATH_SECONDS) this.blockCurrentDirectSegment();
      this.moveToPosition(target.group.position, this.template.seekSpeed * 0.72, deltaSeconds, Math.max(0, distance - this.template.attackRange * 0.92), 'seek_enemy_faction');
      return;
    }
    this.blockedTargetElapsed = 0;
    this.activeWaypoint = null;
    this.combatManeuverTimer = Math.max(0, this.combatManeuverTimer - deltaSeconds);
    const direction = distance > 0.001 ? toTarget.clone().normalize() : new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
    const strafe = new THREE.Vector3(direction.z * this.combatStrafeSign, 0, -direction.x * this.combatStrafeSign).normalize();

    if (distance < this.template.minimumBodySeparation) {
      const sideBias = Math.random() < 0.55 ? strafe.multiplyScalar(0.75) : new THREE.Vector3();
      const backstep = direction.clone().multiplyScalar(-1).add(sideBias).normalize();
      this.moveToward(backstep, this.template.backstepSpeed, deltaSeconds, Infinity, 'defensive_backstep');
      this.logCombatEvent('maneuver', { target, maneuver: 'minimum-separation-backstep', distance });
      return;
    }

    if (this.attackCooldown <= 0 && distance <= this.template.attackCommitRange && directClear) {
      if (distance > this.template.visualContactRange) {
        this.moveToward(direction, this.template.lungeSpeed, deltaSeconds, Math.max(0, distance - this.template.visualContactRange), 'combat_lunge', { desiredTarget: target.group.position, faceTarget: target.group.position, minimumTargetDistance: this.template.minimumBodySeparation });
        this.logCombatEvent('maneuver', { target, maneuver: 'contact-lunge', distance });
        return;
      }
      this.chooseAndBeginEnemyAttack(distance);
      return;
    }

    if (this.combatManeuverTimer <= 0) this.chooseCombatManeuver(distance);

    if (distance < this.template.tooCloseDistance) {
      const sideBias = Math.random() < 0.55 ? strafe.multiplyScalar(0.75) : new THREE.Vector3();
      const backstep = direction.clone().multiplyScalar(-1).add(sideBias).normalize();
      this.moveToward(backstep, this.template.backstepSpeed, deltaSeconds, Infinity, 'defensive_backstep');
      this.logCombatEvent('maneuver', { target, maneuver: 'backstep', distance });
      return;
    }

    if (this.combatManeuver === 'lunge' && distance > this.template.visualContactRange * 0.9) {
      this.moveToward(direction, this.template.lungeSpeed, deltaSeconds, Math.max(0, distance - this.template.visualContactRange * 0.88), 'combat_lunge', { desiredTarget: target.group.position, faceTarget: target.group.position, minimumTargetDistance: this.template.minimumBodySeparation });
      this.logCombatEvent('maneuver', { target, maneuver: 'lunge', distance });
      return;
    }

    if (distance > this.template.desiredCombatDistance + 0.45) {
      this.moveToward(direction, this.template.seekSpeed * 0.86, deltaSeconds, Math.max(0, distance - this.template.desiredCombatDistance), 'combat_lunge', { desiredTarget: target.group.position, faceTarget: target.group.position, minimumTargetDistance: this.template.minimumBodySeparation });
      return;
    }

    if (this.combatManeuver === 'feint') {
      this.setBehaviorState('combat_feint');
      this.logCombatEvent('maneuver', { target, maneuver: 'feint', distance });
      return;
    }

    if (this.combatManeuver === 'backstep') {
      this.moveToward(direction.clone().multiplyScalar(-1).add(strafe.clone().multiplyScalar(0.35)).normalize(), this.template.backstepSpeed, deltaSeconds, Infinity, 'defensive_backstep');
      return;
    }

    this.moveToward(strafe, this.template.circleSpeed, deltaSeconds, Infinity, Math.random() < 0.35 ? 'defensive_strafe' : 'combat_circle');
    this.logCombatEvent('maneuver', { target, maneuver: 'circle', distance });
  }

  chooseCombatManeuver(distance) {
    if (this.combatManeuverTimer > 0) return;
    this.combatStrafeSign = Math.random() < 0.5 ? -1 : 1;
    const roll = Math.random();
    if (distance < this.template.tooCloseDistance || roll < this.template.defensiveManeuverChance * 0.45) {
      this.combatManeuver = 'backstep';
      this.combatManeuverTimer = COMBAT_MANEUVER_LOCK_MIN_SECONDS + Math.random() * 0.35;
    } else if (roll < this.template.defensiveManeuverChance) {
      this.combatManeuver = 'strafe';
      this.combatManeuverTimer = COMBAT_MANEUVER_LOCK_MIN_SECONDS + Math.random() * 0.55;
    } else if (roll < this.template.defensiveManeuverChance + this.template.offensiveLungeChance) {
      this.combatManeuver = 'lunge';
      this.combatManeuverTimer = COMBAT_MANEUVER_LOCK_MIN_SECONDS + Math.random() * 0.28;
    } else {
      this.combatManeuver = 'feint';
      this.combatManeuverTimer = COMBAT_MANEUVER_LOCK_MIN_SECONDS + Math.random() * 0.22;
    }
    this.group.userData.combatManeuver = this.combatManeuver;
  }

  chooseAndBeginEnemyAttack(distance) {
    const canJump = this.species === 'sheep_demon'
      && this.jumpAttackCooldown <= 0
      && distance >= this.template.tooCloseDistance
      && Math.random() < this.template.jumpAttackChance;
    const attackState = canJump ? 'jump_attack_enemy_faction' : 'attack_enemy_faction';
    const choices = canJump ? ['jump'] : this.template.enemyAttackAnimations;
    this.pendingAttackAnimation = choices[Math.floor(Math.random() * choices.length)] ?? this.template.animationMap[attackState];
    if (canJump) this.jumpAttackCooldown = this.template.jumpAttackCooldownSeconds * (0.75 + Math.random() * 0.5);
    this.beginAttack(attackState, { maneuver: canJump ? 'jump_attack' : this.pendingAttackAnimation });
  }

  updatePlayerTarget(deltaSeconds, playerPosition) {
    const toPlayer = playerPosition.clone().sub(this.group.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();
    const directClear = this.hasLineOfMovement(this.group.position, playerPosition);
    if (this.attackCooldown <= 0 && distance <= this.template.attackCommitRange && directClear) {
      if (distance > this.template.visualContactRange) {
        const direction = distance > 0.001 ? toPlayer.clone().normalize() : new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
        this.moveToward(direction, this.template.lungeSpeed, deltaSeconds, Math.max(0, distance - this.template.visualContactRange), 'seek_player_fallback', { desiredTarget: playerPosition, faceTarget: playerPosition, minimumTargetDistance: this.template.minimumBodySeparation });
        return;
      }
      this.beginAttack('attack_player_fallback');
      return;
    }

    this.moveToPosition(playerPosition, this.template.seekSpeed * 0.88, deltaSeconds, Math.max(0, distance - this.template.visualContactRange), 'seek_player_fallback');
  }

  updateDirectorTarget(deltaSeconds) {
    const toTarget = this.directorTarget.clone().sub(this.group.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    if (distance < 1.2) {
      this.directorTarget = null;
      this.directorTargetReason = null;
      this.setBehaviorState('patrol');
      return;
    }
    const speed = distance > ACTION_BUBBLE_PREFERRED_MAX ? this.template.seekSpeed * 0.82 : this.template.walkSpeed * 0.95;
    this.moveToPosition(this.directorTarget, speed, deltaSeconds, Math.max(0, distance - 0.9), 'investigate_enemy_faction');
  }

  updatePatrol(deltaSeconds) {
    if (this.pauseTimer > 0) {
      this.pauseTimer = Math.max(0, this.pauseTimer - deltaSeconds);
      this.setBehaviorState('spawn');
      return;
    }

    const target = this.patrolPoints[this.patrolTargetIndex];
    const toTarget = target.clone().sub(this.group.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    if (distance < 0.16) {
      this.patrolTargetIndex = (this.patrolTargetIndex + 1) % this.patrolPoints.length;
      this.pauseTimer = 0.35 + Math.random() * 0.65;
      this.setBehaviorState('spawn');
      return;
    }

    this.moveToPosition(target, this.template.walkSpeed, deltaSeconds, distance, 'patrol');
  }

  beginAttack(state, { maneuver = null } = {}) {
    this.attackElapsed = 0;
    this.attackHasDamaged = false;
    this.attackCooldown = this.template.attackCooldownSeconds * (0.8 + Math.random() * 0.35);
    this.combatManeuverTimer = 0;
    this.setBehaviorState(state, { force: true });
    this.logCombatEvent('attack-started', {
      target: this.currentTarget?.enemy,
      maneuver: maneuver ?? this.pendingAttackAnimation ?? state,
      distance: this.currentTarget?.enemy?.group ? horizontalDistance(this.group.position, this.currentTarget.enemy.group.position) : null,
    }, { force: true });
  }

  updateAttack(deltaSeconds, context) {
    this.attackElapsed += deltaSeconds;
    const targetPosition = this.currentTarget?.type === 'enemy'
      ? this.currentTarget.enemy?.group?.position
      : context.playerPosition;

    if (targetPosition) {
      const face = targetPosition.clone().sub(this.group.position);
      face.y = 0;
      const distance = face.length();
      if (distance > 0.001) {
        const direction = face.clone().multiplyScalar(1 / distance);
        this.faceDirection(direction, deltaSeconds, this.template.turnSpeed * 1.2);
        const animationState = this.resolveStateAnimation(this.behaviorState);
        const duration = this.getActionDuration(animationState, 0.9);
        const progress = this.attackElapsed / Math.max(duration, 0.001);
        const canLungeIn = progress < this.template.attackDamageWindow.start
          && distance > this.template.visualContactRange
          && distance <= this.template.attackCommitRange
          && this.hasClearMovementSegment(this.group.position, targetPosition, NAV_CLEARANCE_RADIUS);
        if (canLungeIn) {
          this.moveToward(
            direction,
            this.template.lungeSpeed * 0.82,
            deltaSeconds,
            Math.min(this.template.attackLungeDistance, Math.max(0, distance - this.template.visualContactRange)),
            this.behaviorState,
            { suppressStuckTracking: true, desiredTarget: targetPosition, faceTarget: targetPosition, minimumTargetDistance: this.template.minimumBodySeparation },
          );
        }
      }
    }

    this.applyAttackDamageIfReady(context);

    const animationState = this.resolveStateAnimation(this.behaviorState);
    const duration = this.getActionDuration(animationState, 0.9);
    if (this.attackElapsed >= duration) {
      this.pendingAttackAnimation = null;
      if (this.currentTarget?.type === 'player') {
        this.setBehaviorState('seek_player_fallback');
      } else {
        this.recoverTimer = 0.12 + Math.random() * 0.18;
        this.setBehaviorState('recover');
      }
    }
  }

  applyAttackDamageIfReady() {
    if (this.attackHasDamaged) return;
    const animationState = this.resolveStateAnimation(this.behaviorState);
    const duration = this.getActionDuration(animationState, 0.9);
    const progress = this.attackElapsed / Math.max(duration, 0.001);
    const window = this.template.attackDamageWindow;
    if (progress < window.start || progress > window.end) return;

    if (this.currentTarget?.type === 'enemy') {
      const target = this.currentTarget.enemy;
      if (target?.isAlive && horizontalDistance(this.group.position, target.group.position) <= this.template.attackImpactRange && this.hasClearMovementSegment(this.group.position, target.group.position, NAV_CLEARANCE_RADIUS)) {
        const result = target.receiveFactionDamage(this.template.attackDamage, this.template.displayName);
        this.attackHasDamaged = true;
        this.emitFactionGore({ target, damage: this.template.attackDamage, result });
        this.logCombatEvent('damage-applied', {
          target,
          maneuver: this.pendingAttackAnimation ?? this.behaviorState,
          distance: horizontalDistance(this.group.position, target.group.position),
          damage: this.template.attackDamage,
          targetHp: target.health,
          killed: Boolean(result?.killed),
        }, { force: true });
      }
    }
  }

  consumePlayerDamage(playerPosition) {
    if (!this.group || this.behaviorState !== 'attack_player_fallback' || this.attackHasDamaged) return null;
    const animationState = this.resolveStateAnimation(this.behaviorState);
    const duration = this.getActionDuration(animationState, 0.9);
    const progress = this.attackElapsed / Math.max(duration, 0.001);
    const window = this.template.attackDamageWindow;
    if (progress < window.start || progress > window.end) return null;
    const distance = horizontalDistance(this.group.position, playerPosition);
    if (distance > this.template.attackImpactRange || !this.hasClearMovementSegment(this.group.position, playerPosition, NAV_CLEARANCE_RADIUS)) return null;
    this.attackHasDamaged = true;
    this.logCombatEvent('damage-applied', { maneuver: 'player_hit', distance, damage: this.template.attackDamage }, { force: true });
    return {
      source: this.template.displayName,
      amount: this.template.attackDamage,
      distance,
      attackWindowProgress: Number(progress.toFixed(2)),
    };
  }

  receiveFactionDamage(damage, source) {
    if (!this.isAlive) return null;
    this.health = Math.max(0, this.health - damage);
    if (this.actor) this.actor.health = this.health;
    this.group.userData.health = this.health;
    if (this.health <= 0) {
      this.kill(source);
      return { killed: true, remainingHealth: 0, goreEvent: this.createGoreEventMetadata({ damage, sourceId: source, weaponId: 'claw' }) };
    }
    return { killed: false, remainingHealth: this.health, goreEvent: this.createGoreEventMetadata({ damage, sourceId: source, weaponId: 'claw' }) };
  }

  receivePlayerAttack({ position, direction, damage = this.template.playerAttackDamage, range = this.template.playerAttackRange, goreProfileId = 'sword', weaponId = goreProfileId } = {}) {
    if (!this.isAlive) return null;
    const toEnemy = this.group.position.clone().sub(position);
    toEnemy.y = 0;
    const distance = toEnemy.length();
    if (distance > range) return null;
    const attackDirection = direction.clone();
    attackDirection.y = 0;
    if (attackDirection.lengthSq() > 0.001 && toEnemy.lengthSq() > 0.001) {
      const angle = attackDirection.normalize().angleTo(toEnemy.normalize());
      if (angle > THREE.MathUtils.degToRad(72) * 0.5) return null;
    }
    this.health = Math.max(0, this.health - damage);
    if (this.actor) this.actor.health = this.health;
    this.group.userData.health = this.health;
    if (this.health <= 0) {
      this.kill('player');
      return {
        target: this.template.displayName,
        damage,
        remainingHealth: 0,
        killed: true,
        goreEvent: this.createGoreEventMetadata({ damage, sourceId: 'player', sourcePosition: position, direction, weaponId }),
      };
    }
    return {
      target: this.template.displayName,
      damage,
      remainingHealth: this.health,
      killed: false,
      goreEvent: this.createGoreEventMetadata({ damage, sourceId: 'player', sourcePosition: position, direction, weaponId }),
    };
  }

  createGoreEventMetadata({ damage, sourceId = null, sourcePosition = null, direction = null, weaponId = null } = {}) {
    const hitDirection = direction?.clone?.() ?? (sourcePosition
      ? this.group.position.clone().sub(sourcePosition)
      : new THREE.Vector3(0, 0, 1));
    hitDirection.y = 0;
    if (hitDirection.lengthSq() < 0.0001) hitDirection.set(0, 0, 1);
    hitDirection.normalize();
    const hitPosition = this.group.position.clone().add(new THREE.Vector3(0, this.template.targetHeight * 0.48, 0));
    hitPosition.addScaledVector(hitDirection, -0.2);
    return {
      sourceId,
      targetId: this.id,
      creatureId: this.species,
      species: this.species,
      factionId: this.template.factionId,
      weaponId,
      damageAmount: damage,
      position: hitPosition,
      direction: hitDirection,
      targetRoot: this.group,
      tags: ['black_grass_temple_faction'],
    };
  }

  emitFactionGore({ target, damage, result }) {
    if (!target?.group || !this.onGoreEvent) return;
    const direction = target.group.position.clone().sub(this.group.position);
    direction.y = 0;
    if (direction.lengthSq() < 0.0001) direction.set(0, 0, 1);
    direction.normalize();
    const event = target.createGoreEventMetadata({
      damage,
      sourceId: this.id,
      sourcePosition: this.group.position,
      direction,
      weaponId: this.species === 'sheep_demon' ? 'claw' : 'unarmed',
    });
    this.onGoreEvent({ kind: result?.killed ? 'death' : 'hit', event });
  }

  kill(source = 'unknown') {
    if (!this.group || this.behaviorState === 'dead') return;
    this.health = 0;
    if (this.actor) this.actor.health = 0;
    this.attackHasDamaged = true;
    this.currentTarget = null;
    this.group.userData.health = 0;
    this.group.userData.killedBy = source;
    this.group.userData.bodyWoundsShouldClear = true;
    this.setBehaviorState('dead', { force: true });
    this.logCombatEvent('death', { maneuver: source, targetHp: 0 }, { force: true });
  }

  hideCorpse() {
    if (!this.group || this.isRemoved) return;
    this.group.visible = false;
    this.group.userData.isRemoved = true;
    this.scene.remove(this.group);
    if (this.pathMarker) this.scene.remove(this.pathMarker);
    if (this.stuckMarker) this.scene.remove(this.stuckMarker);
    this.isRemoved = true;
  }


  logCombatEvent(event, { target = null, maneuver = null, distance = null, damage = null, targetHp = null, killed = null } = {}, { force = false } = {}) {
    if (!IS_DEV || !this.group) return;
    this.devCombatLogElapsed += force ? DEV_DIAGNOSTIC_INTERVAL_SECONDS : 0;
    const key = `${event}:${this.behaviorState}:${target?.id ?? 'none'}:${maneuver ?? 'none'}`;
    if (!force && this.devCombatLogElapsed < 1.5 && this.devLastCombatLogKey === key) return;
    if (!force && this.devCombatLogElapsed < 0.75) return;
    this.devCombatLogElapsed = 0;
    this.devLastCombatLogKey = key;
    console.info('Black Grass Temple faction combat:', {
      event,
      id: this.id,
      species: this.species,
      targetId: target?.id ?? null,
      targetSpecies: target?.species ?? null,
      combatState: this.behaviorState,
      awarenessTier: this.awarenessTier,
      distance: distance === null || distance === undefined ? null : Number(distance.toFixed(2)),
      maneuver,
      damage,
      targetRemainingHp: targetHp,
      killed,
    });
  }

  moveToPosition(finalTarget, speed, deltaSeconds, maxDistance = Infinity, movingState = 'patrol') {
    const waypoint = this.getMovementWaypoint(finalTarget, movingState);
    const directClear = this.hasClearMovementSegment(this.group.position, finalTarget, NAV_CLEARANCE_RADIUS);
    const previousWaypoint = this.activeWaypoint;
    this.activeWaypoint = directClear ? null : waypoint;
    if (this.activeWaypoint && (!previousWaypoint || horizontalDistance(previousWaypoint, this.activeWaypoint) > 0.25)) {
      this.waypointLockTimer = WAYPOINT_LOCK_SECONDS;
    }
    const toWaypoint = waypoint.clone().sub(this.group.position);
    toWaypoint.y = 0;
    const waypointDistance = toWaypoint.length();
    if (waypointDistance < LOCAL_DETOUR_REACHED_DISTANCE && this.localAvoidanceWaypoint) {
      this.localAvoidanceWaypoint = null;
      this.activeWaypoint = null;
      this.waypointLockTimer = 0;
      return;
    }
    if (waypointDistance < 0.2) {
      this.activeWaypoint = null;
      return;
    }
    const direction = toWaypoint.normalize();
    const allowedDistance = Math.min(maxDistance, waypointDistance);
    this.moveToward(direction, speed, deltaSeconds, allowedDistance, movingState, { desiredTarget: waypoint });
  }

  getMovementWaypoint(finalTarget, movingState) {
    const final = finalTarget.clone();
    final.y = 0;

    if (this.activeWaypoint && this.waypointLockTimer > 0 && horizontalDistance(this.group.position, this.activeWaypoint) > LOCAL_DETOUR_REACHED_DISTANCE && this.isWaypointWalkable(this.activeWaypoint)) {
      return this.activeWaypoint.clone();
    }

    if (this.localAvoidanceWaypoint) {
      if (horizontalDistance(this.group.position, this.localAvoidanceWaypoint) > LOCAL_DETOUR_REACHED_DISTANCE && this.isWaypointWalkable(this.localAvoidanceWaypoint)) {
        return this.localAvoidanceWaypoint.clone();
      }
      this.localAvoidanceWaypoint = null;
    }

    const directClear = this.hasClearMovementSegment(this.group.position, final, NAV_CLEARANCE_RADIUS);
    if (directClear) return final;
    const direct = this.findBlockingRect(this.group.position, final, NAV_CLEARANCE_RADIUS);

    const startRoom = this.findNearestNavigableRoom(this.group.position);
    const targetRoom = this.findNearestNavigableRoom(final);
    if (startRoom && targetRoom && startRoom.id !== targetRoom.id) {
      const roomWaypoint = this.getRoomRouteWaypoint(startRoom, targetRoom, final, movingState);
      if (roomWaypoint && this.hasClearMovementSegment(this.group.position, roomWaypoint, NAV_CLEARANCE_RADIUS * 0.85)) {
        this.localAvoidanceWaypoint = null;
        return roomWaypoint;
      }
    }

    if (!direct) return final;

    const detour = this.findLocalDetourWaypoint(this.group.position, final, direct.rect);
    if (detour) {
      this.localAvoidanceWaypoint = detour;
      this.logNavigationEvent('local-detour', { movingState, blockingRect: direct.rect, waypoint: detour, final });
      return detour.clone();
    }

    if (startRoom && targetRoom && startRoom.id !== targetRoom.id) {
      const roomWaypoint = this.getRoomRouteWaypoint(startRoom, targetRoom, final, movingState);
      if (roomWaypoint) return roomWaypoint;
    }

    this.logNavigationEvent('blocked-no-detour', { movingState, blockingRect: direct.rect, waypoint: null, final });
    return final;
  }

  getRoomRouteWaypoint(startRoom, targetRoom, final, movingState) {
    if (!this.navigationGraph) return null;
    this.pathRepathElapsed = 0;
    const roomPath = this.findRoomPath(startRoom.id, targetRoom.id);
    if (roomPath.length < 2) return null;
    const nextRoomId = roomPath[1];
    const link = (this.navigationGraph.links[startRoom.id] ?? []).find((candidate) => candidate.to === nextRoomId);
    const doorway = link?.waypoint?.clone?.() ?? this.navigationGraph.rooms[nextRoomId]?.center?.clone?.();
    const nextCenter = this.navigationGraph.rooms[nextRoomId]?.center?.clone?.();
    const waypoint = doorway && horizontalDistance(this.group.position, doorway) > 0.65 ? doorway : (nextCenter ?? final);
    const chosen = this.isWaypointWalkable(waypoint) ? waypoint : (nextCenter && this.isWaypointWalkable(nextCenter) ? nextCenter : null);

    if (IS_DEV && this.group) {
      this.group.userData.navigation = {
        ...(this.group.userData.navigation ?? {}),
        movingState,
        startRoom: startRoom.id,
        targetRoom: targetRoom.id,
        roomPath,
        waypoint: makeNavPointSummary(chosen),
        lineOfMovement: 'blocked-route-doorway',
      };
    }
    return chosen;
  }

  findNearestNavigableRoom(position) {
    const rooms = Object.values(this.navigationGraph?.rooms ?? {});
    const containing = rooms.find((room) => position.x >= room.minX && position.x <= room.maxX && position.z >= room.minZ && position.z <= room.maxZ);
    if (containing) return containing;
    return rooms.reduce((best, room) => {
      const distance = horizontalDistance(position, room.center);
      return !best || distance < best.distance ? { room, distance } : best;
    }, null)?.room ?? null;
  }

  findRoomPath(startRoomId, targetRoomId) {
    if (startRoomId === targetRoomId) return [startRoomId];
    const queue = [[startRoomId]];
    const visited = new Set([startRoomId]);
    while (queue.length) {
      const path = queue.shift();
      const roomId = path[path.length - 1];
      for (const link of this.navigationGraph?.links?.[roomId] ?? []) {
        if (visited.has(link.to)) continue;
        const nextPath = [...path, link.to];
        if (link.to === targetRoomId) return nextPath;
        visited.add(link.to);
        queue.push(nextPath);
      }
    }
    return [];
  }

  hasLineOfMovement(start, end) {
    return this.hasClearMovementSegment(start, end, NAV_CLEARANCE_RADIUS);
  }

  hasClearMovementSegment(start, end, clearanceRadius = NAV_CLEARANCE_RADIUS) {
    if (!this.collision) return true;
    const delta = end.clone().sub(start);
    delta.y = 0;
    const distance = delta.length();
    if (distance < 0.001) return true;
    const direction = delta.multiplyScalar(1 / distance);
    const steps = Math.max(2, Math.ceil(distance / 0.45));
    for (let i = 1; i <= steps; i += 1) {
      const probe = start.clone().add(direction.clone().multiplyScalar((distance * i) / steps));
      probe.y = start.y;
      if (!this.isWaypointWalkable(probe, clearanceRadius)) return false;
    }
    return !this.segmentIntersectsAnyBlocker(start, end, clearanceRadius);
  }

  segmentIntersectsAnyBlocker(start, end, clearanceRadius = NAV_CLEARANCE_RADIUS) {
    return Boolean(this.findBlockingRect(start, end, clearanceRadius));
  }

  findBlockingRect(start, end, clearanceRadius = NAV_CLEARANCE_RADIUS) {
    const blockers = this.collision?.blockerRects ?? [];
    let nearest = null;
    let nearestDistance = Infinity;
    for (const rect of blockers) {
      const inflated = inflateRect(rect, clearanceRadius);
      if (pointInExpandedRect(start, rect, clearanceRadius * 0.25) || pointInExpandedRect(end, rect, clearanceRadius * 0.25)) continue;
      if (!segmentIntersectsRect(start, end, inflated)) continue;
      const center = new THREE.Vector3((rect.minX + rect.maxX) / 2, 0, (rect.minZ + rect.maxZ) / 2);
      const distance = horizontalDistance(start, center);
      if (distance < nearestDistance) {
        nearest = { rect, inflated, distance };
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  findLocalDetourWaypoint(start, final, blockingRect) {
    const padded = inflateRect(blockingRect, LOCAL_DETOUR_PADDING);
    const candidates = [
      new THREE.Vector3(padded.minX, 0, padded.minZ),
      new THREE.Vector3(padded.minX, 0, padded.maxZ),
      new THREE.Vector3(padded.maxX, 0, padded.minZ),
      new THREE.Vector3(padded.maxX, 0, padded.maxZ),
      new THREE.Vector3((padded.minX + padded.maxX) / 2, 0, padded.minZ),
      new THREE.Vector3((padded.minX + padded.maxX) / 2, 0, padded.maxZ),
      new THREE.Vector3(padded.minX, 0, (padded.minZ + padded.maxZ) / 2),
      new THREE.Vector3(padded.maxX, 0, (padded.minZ + padded.maxZ) / 2),
    ];

    let best = null;
    let bestScore = Infinity;
    const directDistance = horizontalDistance(start, final);
    candidates.forEach((candidate) => {
      candidate.y = start.y;
      if (!this.isWaypointWalkable(candidate, NAV_CLEARANCE_RADIUS)) return;
      if (!this.hasClearMovementSegment(start, candidate, NAV_CLEARANCE_RADIUS * 0.8)) return;
      const candidateToFinalClear = this.hasClearMovementSegment(candidate, final, NAV_CLEARANCE_RADIUS * 0.8);
      const candidateDistance = horizontalDistance(start, candidate);
      const remainingDistance = horizontalDistance(candidate, final);
      if (remainingDistance > directDistance + 3.5) return;
      const progressBonus = Math.max(0, directDistance - remainingDistance) * 0.35;
      const clearBonus = candidateToFinalClear ? 6 : 0;
      const bodyPenalty = this.getEnemyBodyPenalty(candidate) * 3;
      const score = candidateDistance + remainingDistance * 0.85 - progressBonus - clearBonus + bodyPenalty;
      if (score < bestScore) {
        best = candidate.clone();
        bestScore = score;
      }
    });
    return best;
  }

  isWaypointWalkable(point, clearanceRadius = NAV_CLEARANCE_RADIUS) {
    if (!point || !this.collision?.canStandAt(point)) return false;
    const offsets = [
      [clearanceRadius, 0], [-clearanceRadius, 0], [0, clearanceRadius], [0, -clearanceRadius],
      [clearanceRadius * 0.7, clearanceRadius * 0.7], [-clearanceRadius * 0.7, clearanceRadius * 0.7],
      [clearanceRadius * 0.7, -clearanceRadius * 0.7], [-clearanceRadius * 0.7, -clearanceRadius * 0.7],
    ];
    return offsets.every(([x, z]) => this.collision.canStandAt(new THREE.Vector3(point.x + x, point.y, point.z + z)));
  }

  triggerUnstuck() {
    if (!this.group) return;
    const facing = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
    const lateralSign = Math.random() < 0.5 ? -1 : 1;
    this.unstuckDirection.set(
      -facing.x * 0.85 + facing.z * lateralSign * 0.75,
      0,
      -facing.z * 0.85 - facing.x * lateralSign * 0.75,
    ).normalize();
    this.unstuckTimer = UNSTUCK_SECONDS;
    this.stuckElapsed = 0;
    this.blockCurrentDirectSegment();
    this.pathRepathElapsed = WAYPOINT_REPATH_SECONDS;
    this.localAvoidanceWaypoint = null;
    this.activeWaypoint = null;
    this.pauseTimer = 0;
    this.patrolTargetIndex = (this.patrolTargetIndex + 1) % this.patrolPoints.length;
    if (IS_DEV) {
      console.warn('Black Grass Temple faction enemy unstuck recovery:', {
        id: this.id,
        species: this.species,
        position: vectorSummary(this.group.position),
        nextPatrolPoint: makeNavPointSummary(this.patrolPoints[this.patrolTargetIndex]),
      });
    }
  }

  moveToward(direction, speed, deltaSeconds, maxDistance = Infinity, movingState = 'patrol', { suppressStuckTracking = false, desiredTarget = null, faceTarget = null, minimumTargetDistance = 0 } = {}) {
    const targetLimitedDistance = desiredTarget && minimumTargetDistance > 0
      ? Math.max(0, horizontalDistance(this.group.position, desiredTarget) - minimumTargetDistance)
      : Infinity;
    const stepDistance = Math.min(maxDistance, targetLimitedDistance, speed * deltaSeconds);
    if (stepDistance <= 0.001) return 0;
    const previous = this.group.position.clone();
    const movementDirection = this.getAdjustedMovementDirection(direction, stepDistance, desiredTarget);
    const next = this.group.position.clone().add(movementDirection.clone().multiplyScalar(stepDistance));
    next.y = this.spawnAnchor.position.y;
    if (this.collision.canStandAt(next)) {
      this.group.position.copy(next);
      this.setBehaviorState(movingState);
    } else {
      const probeDirection = this.chooseSteeringProbeDirection(movementDirection, desiredTarget ?? next);
      if (probeDirection) {
        const probeNext = this.group.position.clone().add(probeDirection.clone().multiplyScalar(stepDistance));
        probeNext.y = this.spawnAnchor.position.y;
        if (this.collision.canStandAt(probeNext)) {
          this.group.position.copy(probeNext);
          this.steeringProbeDirection.copy(probeDirection);
          this.steeringProbeTimer = STEERING_PROBE_SECONDS;
          this.setBehaviorState(movingState);
        }
      }
      if (horizontalDistance(previous, this.group.position) < 0.001) {
        const slideX = this.group.position.clone();
        slideX.x = next.x;
        const slideZ = this.group.position.clone();
        slideZ.z = next.z;
        if (this.collision.canStandAt(slideX)) {
          this.group.position.copy(slideX);
          this.setBehaviorState(movingState);
        } else if (this.collision.canStandAt(slideZ)) {
          this.group.position.copy(slideZ);
          this.setBehaviorState(movingState);
        } else {
          this.activeWaypoint = null;
          this.localAvoidanceWaypoint = null;
          this.pathRepathElapsed = WAYPOINT_REPATH_SECONDS;
          this.setBehaviorState(movingState);
        }
      }
    }
    const movedDistance = horizontalDistance(previous, this.group.position);
    if (!suppressStuckTracking) {
      this.stuckElapsed = movedDistance < STUCK_MOVEMENT_THRESHOLD ? this.stuckElapsed + deltaSeconds : 0;
      if (this.stuckElapsed >= SOFT_STUCK_SECONDS && !this.localAvoidanceWaypoint && desiredTarget) {
        const blocker = this.findBlockingRect(this.group.position, desiredTarget, NAV_CLEARANCE_RADIUS)?.rect;
        const detour = blocker ? this.findLocalDetourWaypoint(this.group.position, desiredTarget, blocker) : null;
        if (detour) this.localAvoidanceWaypoint = detour;
      }
      if (this.stuckElapsed >= HARD_STUCK_SECONDS && this.unstuckTimer <= 0) this.triggerUnstuck();
      if (this.stuckElapsed >= ABANDON_STUCK_SECONDS) {
        this.currentTarget = null;
        this.blockCurrentDirectSegment();
      }
    }
    const combatFacing = faceTarget ? faceTarget.clone().sub(this.group.position) : null;
    if (combatFacing) combatFacing.y = 0;
    this.faceDirection(combatFacing?.lengthSq() > 0.001 ? combatFacing.normalize() : (movedDistance > 0.001 ? this.group.position.clone().sub(previous).normalize() : movementDirection), deltaSeconds);
    return movedDistance;
  }

  getAdjustedMovementDirection(direction, stepDistance, desiredTarget) {
    let adjusted = direction.clone();
    adjusted.y = 0;
    if (adjusted.lengthSq() < 0.001) return adjusted;
    adjusted.normalize();

    if (this.steeringProbeTimer > 0 && this.steeringProbeDirection.lengthSq() > 0.001) {
      adjusted.copy(this.steeringProbeDirection);
    } else {
      const probeEnd = this.group.position.clone().add(adjusted.clone().multiplyScalar(Math.max(stepDistance, STEERING_PROBE_DISTANCE)));
      if (!this.hasClearMovementSegment(this.group.position, probeEnd, NAV_CLEARANCE_RADIUS * 0.75)) {
        const probe = this.chooseSteeringProbeDirection(adjusted, desiredTarget ?? probeEnd);
        if (probe) {
          adjusted.copy(probe);
          this.steeringProbeDirection.copy(probe);
          this.steeringProbeTimer = STEERING_PROBE_SECONDS;
        }
      }
    }

    const separation = this.getEnemySeparationVector();
    if (separation.lengthSq() > 0.0001) {
      adjusted.add(separation.multiplyScalar(ENEMY_SEPARATION_STRENGTH)).normalize();
    }
    return adjusted;
  }

  chooseSteeringProbeDirection(direction, desiredTarget) {
    const angles = [20, -20, 40, -40, 70, -70, 100, -100, 135, -135];
    let best = null;
    let bestScore = -Infinity;
    const desired = desiredTarget ? desiredTarget.clone().sub(this.group.position) : direction.clone();
    desired.y = 0;
    if (desired.lengthSq() < 0.001) desired.copy(direction);
    desired.normalize();
    angles.forEach((degrees) => {
      const candidate = rotateHorizontal(direction, THREE.MathUtils.degToRad(degrees)).normalize();
      const probe = this.group.position.clone().add(candidate.clone().multiplyScalar(STEERING_PROBE_DISTANCE));
      probe.y = this.spawnAnchor.position.y;
      if (!this.isWaypointWalkable(probe, NAV_CLEARANCE_RADIUS * 0.75)) return;
      if (!this.hasClearMovementSegment(this.group.position, probe, NAV_CLEARANCE_RADIUS * 0.65)) return;
      const progress = candidate.dot(desired);
      const bodyPenalty = this.getEnemyBodyPenalty(probe);
      const score = progress - bodyPenalty * 0.25 - Math.abs(degrees) / 180;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    });
    return best;
  }

  getEnemySeparationVector() {
    const separation = new THREE.Vector3();
    const enemies = this.currentUpdateContext?.enemies ?? [];
    enemies.forEach((enemy) => {
      if (enemy === this || !enemy.isAlive || !enemy.group) return;
      const away = this.group.position.clone().sub(enemy.group.position);
      away.y = 0;
      const distance = away.length();
      const personalSpace = Math.max(ENEMY_PERSONAL_SPACE, enemy.template?.minimumBodySeparation ?? 0, this.template.minimumBodySeparation ?? 0);
      if (distance <= 0.001 || distance >= personalSpace) return;
      separation.add(away.normalize().multiplyScalar((personalSpace - distance) / personalSpace));
    });
    if (separation.lengthSq() > 0.001) separation.normalize();
    return separation;
  }

  getEnemyBodyPenalty(point) {
    let penalty = 0;
    const enemies = this.currentUpdateContext?.enemies ?? [];
    enemies.forEach((enemy) => {
      if (enemy === this || !enemy.isAlive || !enemy.group) return;
      const distance = horizontalDistance(point, enemy.group.position);
      if (distance < ENEMY_PERSONAL_SPACE) penalty += (ENEMY_PERSONAL_SPACE - distance) / ENEMY_PERSONAL_SPACE;
    });
    return penalty;
  }

  decayBlockedSegmentCooldowns(deltaSeconds) {
    for (const [key, value] of this.blockedSegmentCooldowns.entries()) {
      const next = value - deltaSeconds;
      if (next <= 0) this.blockedSegmentCooldowns.delete(key);
      else this.blockedSegmentCooldowns.set(key, next);
    }
  }

  blockCurrentDirectSegment() {
    const key = this.currentTarget?.type === 'enemy' ? this.currentTarget.enemy?.id : this.currentTarget?.type;
    if (key) this.blockedSegmentCooldowns.set(key, BLOCKED_SEGMENT_COOLDOWN_SECONDS);
  }

  logNavigationEvent(event, { movingState = null, blockingRect = null, waypoint = null, final = null } = {}) {
    if (!IS_DEV || !this.group) return;
    this.group.userData.navigation = {
      ...(this.group.userData.navigation ?? {}),
      event,
      movingState,
      blockingRectId: blockingRect?.id ?? null,
      waypoint: makeNavPointSummary(waypoint),
      final: makeNavPointSummary(final),
      lineOfMovement: blockingRect ? 'blocked' : 'clear',
      stuckSeconds: Number(this.stuckElapsed.toFixed(2)),
    };
  }

  faceDirection(direction, deltaSeconds, turnSpeed = this.template.turnSpeed ?? 5.2) {
    if (!this.group || !direction || direction.lengthSq() < 0.0004) return;
    const desiredYaw = Math.atan2(direction.x, direction.z);
    const yawDelta = THREE.MathUtils.euclideanModulo(desiredYaw - this.group.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    const maxDelta = Math.max(0.01, turnSpeed * deltaSeconds);
    const dampedDelta = yawDelta * (1 - Math.exp(-turnSpeed * deltaSeconds));
    this.group.rotation.y += THREE.MathUtils.clamp(dampedDelta, -maxDelta, maxDelta);
    this.group.rotation.y = THREE.MathUtils.euclideanModulo(this.group.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
  }

  resolveStateAnimation(state) {
    const requested = (state === 'attack_enemy_faction' || state === 'jump_attack_enemy_faction') && this.pendingAttackAnimation
      ? this.pendingAttackAnimation
      : this.template.animationMap[state] ?? 'idle';
    return resolveAnimationState({ species: this.species, requestedState: requested, assets: this.template.assets });
  }

  setBehaviorState(state, { force = false } = {}) {
    if (!this.animation || (!force && this.behaviorState === state)) return;
    const animationState = this.resolveStateAnimation(state);
    const currentAnimationState = this.resolveStateAnimation(this.behaviorState ?? 'spawn');
    const canOverride = force || IMMEDIATE_ANIMATION_STATES.has(state) || IMMEDIATE_ANIMATION_STATES.has(this.behaviorState);
    const minimumHold = LOCOMOTION_ANIMATION_HOLD_SECONDS[this.behaviorState] ?? 0;
    if (!canOverride && this.animationStateElapsed < minimumHold) return;
    this.group.visible = true;
    if (!this.actor?.setAnimationState(animationState, { force, fadeSeconds: 0.1 })) return;
    this.behaviorState = state;
    this.animationStateElapsed = 0;
    this.group.userData.behaviorState = state;
    this.group.userData.animationState = animationState;
    this.group.userData.visibleAnimationState = this.actor.animationSet.currentState ?? animationState;
    this.group.userData.visibleAnimationRootCount = 1;
  }

  getActionDuration(animationState, fallback) {
    return this.actor?.getActionDuration(animationState, fallback) ?? fallback;
  }
}

export class BlackGrassTempleFactionManager {
  constructor({ scene, collision, anchors, navigationGraph = null, encounterZones = null, onGoreEvent = null, enableBattleDirector = true, enableRespawns = true } = {}) {
    this.scene = scene;
    this.collision = collision;
    this.anchors = anchors;
    this.navigationGraph = navigationGraph;
    this.enemies = [];
    this.spawnSerial = 0;
    this.respawnTimers = { sheep_demon: null, neck_man: null };
    this.devStatusElapsed = 0;
    this.nearbyCombatQuietSeconds = 0;
    this.initialWaveSpawned = false;
    this.onGoreEvent = onGoreEvent;
    this.enableBattleDirector = enableBattleDirector;
    this.enableRespawns = enableRespawns;
    this.encounterZones = this.createEncounterZones(encounterZones);
    this.maxActiveByFaction = MAX_ACTIVE_BY_FACTION;
    this.respawnCooldownSeconds = RESPAWN_COOLDOWN_SECONDS;
    this.userData = {
      scope: 'Black Grass Temple only',
      factions: ['sheep_demon', 'neck_man'],
      stateMachine: FACTION_STATE_MACHINE,
      targetPriority: ['nearest living opposing-faction enemy', 'player fallback', 'patrol target'],
      retargetIntervalSeconds: RETARGET_INTERVAL_SECONDS,
      battleDirector: {
        preferredActionDistance: [ACTION_BUBBLE_PREFERRED_MIN, ACTION_BUBBLE_PREFERRED_MAX],
        hardFarDistance: ACTION_BUBBLE_HARD_RADIUS,
        minimumSpawnDistance: MIN_PLAYER_SPAWN_DISTANCE,
        quietCombatTimeoutSeconds: NEARBY_COMBAT_TIMEOUT_SECONDS,
      },
      awareness: {
        farRadius: FAR_AWARENESS_RADIUS,
        sameRoomRadius: SAME_ROOM_AWARENESS_RADIUS,
        adjacentRoomRadius: ADJACENT_ROOM_AWARENESS_RADIUS,
        combatRadius: COMBAT_AWARENESS_RADIUS,
        doorwayCombatRadius: DOORWAY_COMBAT_AWARENESS_RADIUS,
        shortRouteInvestigationRadius: SHORT_ROUTE_INVESTIGATION_RADIUS,
        maxShortRouteInvestigationSteps: MAX_SHORT_ROUTE_INVESTIGATION_STEPS,
      },
      respawnCooldownSeconds: RESPAWN_COOLDOWN_SECONDS,
      movementSmoothing: {
        likelySpinSource: 'retarget, waypoint, steering, maneuver, and combat-facing branches could each change yaw intent; yaw now uses shortest-angle clamped interpolation with target/waypoint/maneuver locks.',
        targetLockSeconds: TARGET_LOCK_SECONDS,
        waypointLockSeconds: WAYPOINT_LOCK_SECONDS,
        combatManeuverLockMinSeconds: COMBAT_MANEUVER_LOCK_MIN_SECONDS,
        directorTargetLockSeconds: DIRECTOR_TARGET_LOCK_SECONDS,
        steeringProbeSeconds: STEERING_PROBE_SECONDS,
        locomotionAnimationHoldSeconds: LOCOMOTION_ANIMATION_HOLD_SECONDS,
      },
      combatContact: Object.fromEntries(Object.entries(FACTIONS).map(([species, template]) => [species, {
        desiredCombatDistance: template.desiredCombatDistance,
        tooCloseDistance: template.tooCloseDistance,
        attackRange: template.attackRange,
        visualContactRange: template.visualContactRange,
        attackCommitRange: template.attackCommitRange,
        attackImpactRange: template.attackImpactRange,
        attackLungeDistance: template.attackLungeDistance,
        minimumBodySeparation: template.minimumBodySeparation,
        turnSpeed: template.turnSpeed,
      }])),
      localNavigation: {
        clearanceRadius: NAV_CLEARANCE_RADIUS,
        detourPadding: LOCAL_DETOUR_PADDING,
        steeringProbeDistance: STEERING_PROBE_DISTANCE,
        softStuckSeconds: SOFT_STUCK_SECONDS,
        hardStuckSeconds: HARD_STUCK_SECONDS,
        blockedSegmentCooldownSeconds: BLOCKED_SEGMENT_COOLDOWN_SECONDS,
        enemyPersonalSpace: ENEMY_PERSONAL_SPACE,
      },
      initialWaveByFaction: INITIAL_WAVE_BY_FACTION,
      maxActiveByFaction: MAX_ACTIVE_BY_FACTION,
      maxActiveTotal: Object.values(MAX_ACTIVE_BY_FACTION).reduce((sum, count) => sum + count, 0),
      animationReport: BLACK_GRASS_FACTION_ANIMATION_REPORT,
    };
  }

  createEncounterZones(authoredZones = null) {
    if (authoredZones?.length) {
      return Object.freeze(authoredZones.map((zone) => Object.freeze({
        id: zone.id,
        label: zone.label ?? zone.id,
        roomIds: Object.freeze([...(zone.roomIds ?? [])]),
        center: toVector3(zone.center),
        sheepOffset: toVector3(zone.userData?.sheepOffset ?? { x: -5, y: 0, z: 0 }),
        neckOffset: toVector3(zone.userData?.neckOffset ?? { x: 5, y: 0, z: 0 }),
        radius: zone.radius,
        weight: zone.weight,
        actionBubblePriority: zone.actionBubblePriority,
      })));
    }

    const roomCenter = (roomId, fallback) => this.navigationGraph?.rooms?.[roomId]?.center?.clone?.() ?? fallback;
    return Object.freeze([
      { id: 'early_first_branch', label: 'early battle zone near first branch', roomIds: ['R02', 'R03'], center: new THREE.Vector3(0, 0, -47), sheepOffset: new THREE.Vector3(-5.5, 0, -1.5), neckOffset: new THREE.Vector3(5.5, 0, 1.5) },
      { id: 'west_side_chamber', label: 'west side chamber skirmish zone', roomIds: ['R04', 'R07'], center: new THREE.Vector3(-32, 0, -10), sheepOffset: new THREE.Vector3(-3, 0, -3), neckOffset: new THREE.Vector3(3, 0, 3) },
      { id: 'middle_grass_tavern', label: 'middle grass tavern zone', roomIds: ['R06', 'R08'], center: roomCenter('R08', new THREE.Vector3(0, 0, 28)), sheepOffset: new THREE.Vector3(-6, 0, -4), neckOffset: new THREE.Vector3(6, 0, 4) },
      { id: 'central_reliquary', label: 'central reliquary zone', roomIds: ['R11', 'R12'], center: roomCenter('R11', new THREE.Vector3(0, 0, 62)), sheepOffset: new THREE.Vector3(-7, 0, -2), neckOffset: new THREE.Vector3(7, 0, 2) },
      { id: 'east_side_chamber', label: 'east side chamber skirmish zone', roomIds: ['R05', 'R10'], center: new THREE.Vector3(34, 0, -12), sheepOffset: new THREE.Vector3(-3, 0, 3), neckOffset: new THREE.Vector3(3, 0, -3) },
    ]);
  }

  chooseEncounterZone(playerPosition) {
    if (!playerPosition) return this.encounterZones[0];
    const playerRoom = this.findNearestNavigableRoom(playerPosition);
    let best = this.encounterZones[0];
    let bestScore = Infinity;
    this.encounterZones.forEach((zone) => {
      const directDistance = horizontalDistance(playerPosition, zone.center);
      const roomSteps = playerRoom ? Math.min(...zone.roomIds.map((roomId) => {
        const path = this.findRoomPath(playerRoom.id, roomId);
        return path.length ? path.length - 1 : 99;
      })) : 0;
      const preferredPenalty = Math.abs(directDistance - ACTION_BUBBLE_PREFERRED_MAX);
      const score = preferredPenalty + roomSteps * 9 + Math.max(0, directDistance - ACTION_BUBBLE_HARD_RADIUS) * 4;
      if (score < bestScore) {
        best = zone;
        bestScore = score;
      }
    });
    return best;
  }

  getEncounterPoint(zone, species) {
    const offset = species === 'sheep_demon' ? zone.sheepOffset : zone.neckOffset;
    const point = zone.center.clone().add(offset);
    return this.collision?.canStandAt(point) ? point : zone.center.clone();
  }

  updateBattleDirector(deltaSeconds, playerPosition) {
    const living = this.getLivingEnemies();
    const zone = this.chooseEncounterZone(playerPosition);
    const nearby = living.filter((enemy) => enemy.group && playerPosition && horizontalDistance(enemy.group.position, playerPosition) <= ACTION_BUBBLE_HARD_RADIUS);
    const combatPairs = [];
    nearby.forEach((enemy) => {
      if (enemy.currentTarget?.type === 'enemy' && enemy.currentTarget.enemy?.isAlive) {
        const target = enemy.currentTarget.enemy;
        const pairId = [enemy.id, target.id].sort().join('>');
        if (!combatPairs.some((pair) => pair.id === pairId)) {
          combatPairs.push({ id: pairId, a: enemy.id, b: target.id, distance: horizontalDistance(enemy.group.position, target.group.position) });
        }
      }
    });
    const activeNearbyCombat = combatPairs.some((pair) => pair.distance <= COMBAT_AWARENESS_RADIUS + 2);
    this.nearbyCombatQuietSeconds = activeNearbyCombat ? 0 : this.nearbyCombatQuietSeconds + deltaSeconds;

    living.forEach((enemy) => {
      if (!enemy.group || !playerPosition) return;
      const playerDistance = horizontalDistance(enemy.group.position, playerPosition);
      if (playerDistance > ACTION_BUBBLE_HARD_RADIUS || (!enemy.currentTarget && this.nearbyCombatQuietSeconds > FAR_IRRELEVANT_REDIRECT_SECONDS)) {
        enemy.farIrrelevantElapsed += deltaSeconds;
        if (!enemy.directorTarget || enemy.directorTargetLockTimer <= 0 || playerDistance > ACTION_BUBBLE_RECYCLE_RADIUS) {
          enemy.directorTarget = this.getEncounterPoint(zone, enemy.species);
          enemy.directorTargetReason = zone.id;
          enemy.directorTargetLockTimer = DIRECTOR_TARGET_LOCK_SECONDS;
        }
        enemy.retargetElapsed = RETARGET_INTERVAL_SECONDS;
      } else {
        enemy.farIrrelevantElapsed = Math.max(0, enemy.farIrrelevantElapsed - deltaSeconds * 0.5);
      }

      if (playerDistance > ACTION_BUBBLE_RECYCLE_RADIUS && enemy.farIrrelevantElapsed > FAR_IRRELEVANT_RECYCLE_SECONDS && !this.hasLineOfMovement(playerPosition, enemy.group.position)) {
        const anchor = this.chooseSpawnAnchor(enemy.species, 0, new Set(), { playerPosition, directorZone: zone });
        enemy.group.position.copy(anchor.position);
        enemy.spawnAnchor = anchor;
        enemy.patrolPoints = anchor.patrolPoints;
        enemy.directorTarget = this.getEncounterPoint(zone, enemy.species);
        enemy.directorTargetLockTimer = DIRECTOR_TARGET_LOCK_SECONDS;
        enemy.farIrrelevantElapsed = 0;
        enemy.retargetElapsed = RETARGET_INTERVAL_SECONDS;
        enemy.group.userData.recycledByBattleDirector = { zone: zone.id, reason: 'far_irrelevant', playerDistance: Number(playerDistance.toFixed(2)) };
      }
    });

    const livingSheep = this.getLivingEnemies('sheep_demon').length;
    const livingNeck = this.getLivingEnemies('neck_man').length;
    if (playerPosition && this.nearbyCombatQuietSeconds > NEARBY_COMBAT_TIMEOUT_SECONDS) {
      if (livingSheep < 1) this.spawnFaction('sheep_demon', 1, { playerPosition, directorZone: zone });
      if (livingNeck < 1) this.spawnFaction('neck_man', 1, { playerPosition, directorZone: zone });
      if (living.length < 3) {
        this.spawnFaction(livingSheep <= livingNeck ? 'sheep_demon' : 'neck_man', 1, { playerPosition, directorZone: zone });
      }
      this.nearbyCombatQuietSeconds = NEARBY_COMBAT_TIMEOUT_SECONDS * 0.35;
    }

    return { zone, nearbyCount: nearby.length, combatPairs, quietSeconds: this.nearbyCombatQuietSeconds };
  }

  findNearestNavigableRoom(position) {
    const rooms = Object.values(this.navigationGraph?.rooms ?? {});
    const containing = rooms.find((room) => position.x >= room.minX && position.x <= room.maxX && position.z >= room.minZ && position.z <= room.maxZ);
    if (containing) return containing;
    return rooms.reduce((best, room) => {
      const distance = horizontalDistance(position, room.center);
      return !best || distance < best.distance ? { room, distance } : best;
    }, null)?.room ?? null;
  }

  findRoomPath(startRoomId, targetRoomId) {
    if (startRoomId === targetRoomId) return [startRoomId];
    const queue = [[startRoomId]];
    const visited = new Set([startRoomId]);
    while (queue.length) {
      const path = queue.shift();
      const roomId = path[path.length - 1];
      for (const link of this.navigationGraph?.links?.[roomId] ?? []) {
        if (visited.has(link.to)) continue;
        const nextPath = [...path, link.to];
        if (link.to === targetRoomId) return nextPath;
        visited.add(link.to);
        queue.push(nextPath);
      }
    }
    return [];
  }

  hasLineOfMovement(start, end) {
    const delta = end.clone().sub(start);
    delta.y = 0;
    const distance = delta.length();
    if (distance < 0.001) return true;
    const direction = delta.multiplyScalar(1 / distance);
    const steps = Math.max(2, Math.ceil(distance / 0.75));
    for (let i = 1; i <= steps; i += 1) {
      const probe = start.clone().add(direction.clone().multiplyScalar((distance * i) / steps));
      probe.y = 0;
      if (!this.collision?.canStandAt(probe)) return false;
    }
    return true;
  }

  spawnInitialWave() {
    this.spawnFaction('sheep_demon', INITIAL_WAVE_BY_FACTION.sheep_demon, { initialWave: true });
    this.spawnFaction('neck_man', INITIAL_WAVE_BY_FACTION.neck_man, { initialWave: true });
    this.initialWaveSpawned = true;
    if (IS_DEV) {
      console.info('Black Grass Temple faction war initialized:', {
        ...this.userData,
        firstWaveNote: 'Initial wave intentionally reduced to one Sheep Demon and one Neck Man so both rigs become visible quickly on mobile.',
        status: this.getStatusSummary(),
      });
    }
  }

  spawnInitialAnchors(anchors = this.anchors.filter((anchor) => anchor.initialWave)) {
    anchors
      .filter((anchor) => FACTIONS[anchor.preferredFaction])
      .forEach((anchor) => {
        const species = anchor.preferredFaction;
        const enemy = new BlackGrassFactionEnemy({
          scene: this.scene,
          collision: this.collision,
          navigationGraph: this.navigationGraph,
          species,
          id: `${anchor.id ?? 'generated-anchor'}-${species}-${this.spawnSerial += 1}`,
          spawnAnchor: anchor,
          patrolPoints: anchor.patrolPoints,
          onLoaded: () => this.logDevStatus('enemy-loaded'),
          onGoreEvent: this.onGoreEvent,
        });
        this.enemies.push(enemy);
        enemy.load();
      });
    this.initialWaveSpawned = true;
  }

  update(deltaSeconds, playerPosition) {
    const director = this.enableBattleDirector
      ? this.updateBattleDirector(deltaSeconds, playerPosition)
      : { zone: null, nearbyCount: this.enemies.length, combatPairs: 0, quietSeconds: 0 };
    const context = { enemies: this.enemies, playerPosition, director };
    this.enemies.forEach((enemy) => enemy.update(deltaSeconds, context));
    this.updateDevStatus(deltaSeconds);

    if (!this.enableRespawns) {
      this.enemies = this.enemies.filter((enemy) => !enemy.isRemoved || enemy.isAlive);
      return;
    }

    Object.keys(this.respawnTimers).forEach((species) => {
      const livingCount = this.enemies.filter((enemy) => enemy.species === species && enemy.health > 0 && !enemy.isRemoved).length;
      if (livingCount === 0 && this.respawnTimers[species] === null) {
        this.respawnTimers[species] = RESPAWN_COOLDOWN_SECONDS;
        if (IS_DEV) console.info(`Black Grass Temple ${species} faction wiped; respawn pending in ${RESPAWN_COOLDOWN_SECONDS}s.`);
      }
      if (this.respawnTimers[species] !== null) {
        this.respawnTimers[species] -= deltaSeconds;
        if (this.respawnTimers[species] <= 0) {
          this.spawnFaction(species, 2, { playerPosition, directorZone: director.zone });
          this.respawnTimers[species] = null;
          this.forceRetargetOpposingFaction(species);
        }
      }
    });

    this.enemies = this.enemies.filter((enemy) => !enemy.isRemoved || enemy.isAlive);
  }

  spawnFaction(species, requestedCount, { initialWave = false, playerPosition = null, directorZone = null } = {}) {
    const livingCount = this.getLivingEnemies(species).length;
    const count = Math.max(0, Math.min(requestedCount, this.maxActiveByFaction[species] - livingCount));
    const usedAnchorIds = new Set();
    for (let i = 0; i < count; i += 1) {
      const anchor = this.chooseSpawnAnchor(species, i, usedAnchorIds, { initialWave, playerPosition, directorZone });
      usedAnchorIds.add(anchor.id);
      const enemy = new BlackGrassFactionEnemy({
        scene: this.scene,
        collision: this.collision,
        navigationGraph: this.navigationGraph,
        species,
        id: `black-grass-temple-${species}-${this.spawnSerial += 1}`,
        spawnAnchor: anchor,
        patrolPoints: anchor.patrolPoints,
        onLoaded: () => this.logDevStatus('enemy-loaded'),
        onGoreEvent: this.onGoreEvent,
      });
      this.enemies.push(enemy);
      enemy.load();
    }
  }

  chooseSpawnAnchor(species, offset = 0, excludedAnchorIds = new Set(), { initialWave = false, playerPosition = null, directorZone = null } = {}) {
    const initialPool = this.anchors.filter((anchor) => anchor.initialWave && anchor.preferredFaction === species);
    const pool = initialWave && initialPool.length
      ? initialPool
      : this.anchors.filter((anchor) => !anchor.initialWave && (anchor.preferredFaction === species || anchor.preferredFaction === 'neutral'));
    const opposing = this.getLivingEnemies(FACTIONS[species].opposingFactionId);
    let best = null;
    let bestScore = -Infinity;
    pool.forEach((anchor, index) => {
      const nearestOpposing = opposing.reduce((nearest, enemy) => Math.min(nearest, horizontalDistance(anchor.position, enemy.group.position)), Infinity);
      const playerDistance = playerPosition ? horizontalDistance(anchor.position, playerPosition) : ACTION_BUBBLE_PREFERRED_MAX;
      const zoneDistance = directorZone ? horizontalDistance(anchor.position, directorZone.center) : 0;
      const tooClosePenalty = playerDistance < MIN_PLAYER_SPAWN_DISTANCE ? -500 : 0;
      const tooFarPenalty = playerDistance > ACTION_BUBBLE_HARD_RADIUS ? -(playerDistance - ACTION_BUBBLE_HARD_RADIUS) * 4 : 0;
      const preferredDistanceScore = playerPosition ? -Math.abs(playerDistance - ACTION_BUBBLE_PREFERRED_MAX) * 1.8 : 0;
      const encounterScore = directorZone ? -zoneDistance * 2.4 : 0;
      const opposingMeetScore = Number.isFinite(nearestOpposing) ? -Math.abs(nearestOpposing - 14) * 1.1 : 0;
      const factionBias = anchor.preferredFaction === species ? 12 : 0;
      const repeatBias = -Math.abs(index - offset) * 0.01;
      const duplicateWavePenalty = excludedAnchorIds.has(anchor.id) ? -1000 : 0;
      const losPenalty = playerPosition && this.hasLineOfMovement(playerPosition, anchor.position) && playerDistance < ACTION_BUBBLE_PREFERRED_MAX ? -35 : 0;
      const score = factionBias + repeatBias + duplicateWavePenalty + preferredDistanceScore + encounterScore + opposingMeetScore + tooClosePenalty + tooFarPenalty + losPenalty;
      if (score > bestScore) {
        best = anchor;
        bestScore = score;
      }
    });
    return best ?? this.anchors[0];
  }

  getStatusSummary() {
    const living = this.getLivingEnemies();
    const loaded = this.enemies.filter((enemy) => enemy.isLoaded).length;
    const visible = this.enemies.filter((enemy) => enemy.group?.visible && Object.values(enemy.animation?.tracks ?? {}).some((track) => track.root.visible)).length;
    const countLiving = (species) => living.filter((enemy) => enemy.species === species).length;
    return {
      totalCreated: this.enemies.length,
      totalLoaded: loaded,
      totalVisible: visible,
      livingSheep: countLiving('sheep_demon'),
      livingNeck: countLiving('neck_man'),
      respawnTimers: Object.fromEntries(Object.entries(this.respawnTimers).map(([species, timer]) => [species, timer === null ? null : Number(timer.toFixed(2))])),
      battleDirector: {
        quietSeconds: Number(this.nearbyCombatQuietSeconds.toFixed(2)),
        encounterZones: this.encounterZones.map((zone) => zone.id),
      },
      targets: this.enemies.map((enemy) => ({
        id: enemy.id,
        species: enemy.species,
        loaded: enemy.isLoaded,
        visible: Boolean(enemy.group?.visible),
        state: enemy.group?.userData.behaviorState ?? enemy.behaviorState,
        animationState: enemy.group?.userData.animationState ?? null,
        targetType: enemy.group?.userData.targetType ?? null,
        targetId: enemy.group?.userData.targetId ?? null,
        position: enemy.group ? vectorSummary(enemy.group.position) : null,
      })),
    };
  }

  updateDevStatus(deltaSeconds) {
    if (!IS_DEV) return;
    this.devStatusElapsed += deltaSeconds;
    if (this.devStatusElapsed < DEV_DIAGNOSTIC_INTERVAL_SECONDS) return;
    this.devStatusElapsed = 0;
    this.logDevStatus('interval');
  }

  logDevStatus(reason) {
    if (!IS_DEV) return;
    console.info(`Black Grass Temple faction status (${reason}):`, this.getStatusSummary());
  }

  forceRetargetOpposingFaction(respawnedSpecies) {
    this.enemies.forEach((enemy) => {
      if (enemy.species === FACTIONS[respawnedSpecies].opposingFactionId && enemy.isAlive) {
        enemy.retargetElapsed = RETARGET_INTERVAL_SECONDS;
      }
    });
  }

  getLivingEnemies(species = null) {
    return this.enemies.filter((enemy) => enemy.isAlive && (!species || enemy.species === species));
  }

  consumeEnemyContactDamage(playerPosition) {
    for (const enemy of this.enemies) {
      const hit = enemy.consumePlayerDamage(playerPosition);
      if (hit) return hit;
    }
    return null;
  }

  damageEnemyFromPlayerAttack(attack) {
    for (const enemy of this.enemies) {
      const hit = enemy.receivePlayerAttack(attack);
      if (hit) {
        enemy.playerRevengeTimer = PLAYER_REVENGE_SECONDS;
        enemy.retargetElapsed = RETARGET_INTERVAL_SECONDS;
        this.enemies.forEach((ally) => {
          if (ally !== enemy && ally.species === enemy.species && ally.isAlive && ally.group && enemy.group && horizontalDistance(ally.group.position, enemy.group.position) <= PLAYER_DETECTION_RADIUS) {
            ally.playerRevengeTimer = Math.max(ally.playerRevengeTimer, PLAYER_REVENGE_SECONDS * 0.55);
            ally.retargetElapsed = RETARGET_INTERVAL_SECONDS;
          }
        });
        enemy.logCombatEvent('damage-applied', { maneuver: 'player_attack', damage: hit.damage, targetHp: hit.remainingHealth, killed: hit.killed }, { force: true });
        return hit;
      }
    }
    return null;
  }
}
