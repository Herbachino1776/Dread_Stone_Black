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
  NECK_MAN_CANONICAL_MOBILE_MODEL_FILE,
  NECK_MAN_FOLSOM_MOBILE_CLIP_MAP,
  NECK_MAN_FACTION_STATE_TO_ANIMATION,
} from './creatures/neckMan.config.js';
import {
  ramManConfig,
  RAM_MAN_ANIMATION_FILES,
  RAM_MAN_CANONICAL_MOBILE_MODEL_FILE,
  RAM_MAN_PREY_STATE_TO_ANIMATION,
} from './creatures/ramMan.config.js';
import {
  MOBILE_ENEMY_BUDGETS,
  FOLSOM_NECKMAN_MOBILE_ANIMATION_STATES,
  createMobileEnemyLifecycle,
  assertMobileEnemyBudget,
} from './creatures/MobileEnemyRuntimeContract.js';

export const BLACK_GRASS_SHEEP_DEMON_ANIMATION_ASSETS = SHEEP_DEMON_ANIMATION_FILES;
export const BLACK_GRASS_NECK_MAN_ANIMATION_ASSETS = NECK_MAN_ANIMATION_FILES;

const FACTIONS = Object.freeze({
  ram_man: Object.freeze({
    creatureConfigId: ramManConfig.id,
    factionId: 'ram_man',
    displayName: ramManConfig.identity.displayName,
    opposingFactionId: 'neck_man',
    assets: RAM_MAN_ANIMATION_FILES,
    animationMap: RAM_MAN_PREY_STATE_TO_ANIMATION,
    targetHeight: ramManConfig.scale.targetHeight,
    maxWidth: ramManConfig.scale.maxWidth,
    maxHealth: ramManConfig.combatProfile.maxHealth,
    walkSpeed: ramManConfig.aiProfile.navigationPreferences.patrolSpeed,
    seekSpeed: ramManConfig.aiProfile.navigationPreferences.fleeSpeed,
    attackDamage: 0, playerAttackDamage: 0, playerAttackRange: ramManConfig.combatProfile.playerAttackRange,
    attackRange: 0, visualContactRange: ramManConfig.combatProfile.visualContactRange, attackCommitRange: 0, attackImpactRange: 0,
    attackLungeDistance: 0, minimumBodySeparation: ramManConfig.combatProfile.minimumBodySeparation,
    attackCooldownSeconds: 999, attackDamageWindow: Object.freeze({ start: 0, end: 0 }), desiredCombatDistance: 0, tooCloseDistance: 0,
    combatEngageDistance: ramManConfig.aiProfile.detectionRanges.threatRadius, circleSpeed: 0, backstepSpeed: ramManConfig.aiProfile.navigationPreferences.fleeSpeed, lungeSpeed: 0,
    defensiveManeuverChance: 0, offensiveLungeChance: 0, jumpAttackChance: 0, jumpAttackCooldownSeconds: 999, turnSpeed: 4.2,
    enemyAttackAnimations: Object.freeze([]),
  }),
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

const CREATURE_CONFIGS_BY_SPECIES = Object.freeze({
  ram_man: ramManConfig,
  sheep_demon: sheepDemonConfig,
  neck_man: neckManConfig,
});

const SCALE_SENSITIVE_TEMPLATE_KEYS = Object.freeze([
  'targetHeight',
  'maxWidth',
  'playerAttackRange',
  'attackRange',
  'visualContactRange',
  'attackCommitRange',
  'attackImpactRange',
  'attackLungeDistance',
  'minimumBodySeparation',
  'desiredCombatDistance',
  'tooCloseDistance',
  'combatEngageDistance',
]);

function finitePositiveNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function resolveSpawnScaleMultiplier(spawnAnchor = {}) {
  return finitePositiveNumber(spawnAnchor.scale)
    ?? finitePositiveNumber(spawnAnchor.userData?.scaleMultiplier)
    ?? 1;
}

function createScaledFactionTemplate(template, scaleMultiplier) {
  if (scaleMultiplier === 1) return template;
  const scaled = { ...template, spawnScaleMultiplier: scaleMultiplier };
  SCALE_SENSITIVE_TEMPLATE_KEYS.forEach((key) => {
    if (Number.isFinite(template[key])) scaled[key] = template[key] * scaleMultiplier;
  });
  return Object.freeze(scaled);
}

function createFactionTemplate(template, scaleMultiplier, encounterMode) {
  const scaled = createScaledFactionTemplate(template, scaleMultiplier);
  if (encounterMode !== 'folsom_neckman_blood_feud' || template.factionId !== 'neck_man') return scaled;
  return Object.freeze({
    ...scaled,
    attackRange: FOLSOM_BLOOD_FEUD_COMBAT_SPACING.attackRange,
    visualContactRange: FOLSOM_BLOOD_FEUD_COMBAT_SPACING.visualContactRange,
    attackCommitRange: FOLSOM_BLOOD_FEUD_COMBAT_SPACING.attackCommitRange,
    attackImpactRange: FOLSOM_BLOOD_FEUD_COMBAT_SPACING.attackImpactRange,
    minimumBodySeparation: FOLSOM_BLOOD_FEUD_COMBAT_SPACING.minimumBodySeparation,
    desiredCombatDistance: FOLSOM_BLOOD_FEUD_COMBAT_SPACING.desiredCombatDistance,
    tooCloseDistance: FOLSOM_BLOOD_FEUD_COMBAT_SPACING.tooCloseDistance,
    enemyAttackAnimations: Object.freeze(['punch_right']),
    animationMap: Object.freeze({
      ...scaled.animationMap,
      seek_enemy_faction: 'walk',
      combat_lunge: 'walk',
      jump_attack_enemy_faction: 'punch_right',
      attack_player_fallback: 'punch_right',
    }),
  });
}

function createFolsomNeckmanMobileConfig(scaleMultiplier = 1) {
  const multiplier = Number.isFinite(scaleMultiplier) && scaleMultiplier > 0 ? scaleMultiplier : 1;
  return {
    ...neckManConfig,
    assets: Object.freeze({
      ...neckManConfig.assets,
      expectedAnimations: FOLSOM_BLOOD_FEUD_ANIMATION_STATES,
      clipBundle: Object.freeze({
        ...neckManConfig.assets.clipBundle,
        strategy: 'canonical-multiclip',
        modelFile: NECK_MAN_CANONICAL_MOBILE_MODEL_FILE,
        requiredClips: FOLSOM_BLOOD_FEUD_ANIMATION_STATES,
        clipMap: NECK_MAN_FOLSOM_MOBILE_CLIP_MAP,
      }),
    }),
    animationProfile: Object.freeze({
      ...neckManConfig.animationProfile,
      mobileClipMap: NECK_MAN_FOLSOM_MOBILE_CLIP_MAP,
      attack: 'punch_right',
      jump: 'punch_right',
      attackAnimationChoices: Object.freeze(['punch_right']),
      oneShotStates: Object.freeze(['punch_right', 'die']),
    }),
    scale: Object.freeze({
      ...neckManConfig.scale,
      scaleMultiplier: (neckManConfig.scale?.scaleMultiplier ?? 1) * multiplier,
    }),
  };
}

function createScaledCreatureConfig(species, scaleMultiplier, encounterMode = null) {
  if (encounterMode === 'folsom_neckman_blood_feud' && species === 'neck_man') return createFolsomNeckmanMobileConfig(scaleMultiplier);
  if (encounterMode === 'folsom_neckman_blood_feud' && species === 'ram_man') return { ...ramManConfig, scale: Object.freeze({ ...ramManConfig.scale, scaleMultiplier: (ramManConfig.scale?.scaleMultiplier ?? 1) * (Number.isFinite(scaleMultiplier) && scaleMultiplier > 0 ? scaleMultiplier : 1) }) };
  const baseConfig = CREATURE_CONFIGS_BY_SPECIES[species];
  if (!baseConfig || scaleMultiplier === 1) return null;
  return {
    ...baseConfig,
    scale: Object.freeze({
      ...baseConfig.scale,
      scaleMultiplier: (baseConfig.scale?.scaleMultiplier ?? 1) * scaleMultiplier,
    }),
  };
}

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
const IS_DEV = import.meta.env?.DEV;
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
const FOLSOM_BLOOD_FEUD_IDLE_RETARGET_SECONDS = 0.18;
const FOLSOM_BLOOD_FEUD_STUCK_RETARGET_SECONDS = 0.55;
const FOLSOM_BLOOD_FEUD_TARGET_SCAN_SECONDS = 0.33;
const FOLSOM_BLOOD_FEUD_TARGET_HOLD_SECONDS = 2.1;
const FOLSOM_BLOOD_FEUD_MAX_TARGETING_OPS_PER_FRAME = 1;
const FOLSOM_BLOOD_FEUD_TARGET_LOSE_RANGE = 64;
const ENEMY_PERSONAL_SPACE = 1.15;
const ENEMY_SEPARATION_STRENGTH = 0.32;
const FOLSOM_BLOOD_FEUD_FOOT_LIFT = 0.02;
const FOLSOM_BLOOD_FEUD_AI_TICK_SECONDS = MOBILE_ENEMY_BUDGETS.folsomNeckmanBloodFeud.aiTickSeconds;
const FOLSOM_BLOOD_FEUD_FRAME_BUDGET_MS = MOBILE_ENEMY_BUDGETS.folsomNeckmanBloodFeud.frameBudgetMs;
const FOLSOM_BLOOD_FEUD_MAX_BEHAVIOR_SLICES_PER_FRAME = MOBILE_ENEMY_BUDGETS.folsomNeckmanBloodFeud.maxBehaviorSlicesPerFrame;
const FOLSOM_BLOOD_FEUD_GROUND_RESAMPLE_SECONDS = 0.18;
const FOLSOM_BLOOD_FEUD_GROUND_RESAMPLE_DISTANCE = 0.18;
const FOLSOM_BLOOD_FEUD_CLOSE_COLLISION_RANGE = 1.65;
const FOLSOM_BLOOD_FEUD_ANIMATION_STATES = FOLSOM_NECKMAN_MOBILE_ANIMATION_STATES;
const FOLSOM_RAM_MAN_HERD_MAX = 5;
const FOLSOM_RAM_MAN_AI_TICK_SECONDS = 0.24;
const FOLSOM_RAM_MAN_THREAT_RADIUS = 8;
const FOLSOM_RAM_MAN_FLEE_RADIUS = 5;
const FOLSOM_BLOOD_FEUD_COMBAT_SPACING = Object.freeze({
  desiredCombatDistance: 0.9,
  tooCloseDistance: 0.45,
  minimumBodySeparation: 0.35,
  attackRange: 1.15,
  visualContactRange: 1.05,
  attackImpactRange: 1.25,
  attackCommitRange: 1.5,
  separationStrengthNearAttackRange: 0,
  attackCommitHoldSeconds: 0.2,
  facingDot: 0.18,
});
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

function horizontalDistanceSq(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function horizontalDistance(a, b) {
  return Math.sqrt(horizontalDistanceSq(a, b));
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
  constructor({ scene, collision, navigationGraph = null, outdoorVisibleSurfaceSampler = null, species, id, spawnAnchor, patrolPoints = null, onLoaded = null, onGoreEvent = null, encounterMode = 'faction_war' }) {
    this.scene = scene;
    this.collision = collision;
    this.navigationGraph = navigationGraph;
    this.outdoorVisibleSurfaceSampler = outdoorVisibleSurfaceSampler;
    this.species = species;
    this.spawnScaleMultiplier = resolveSpawnScaleMultiplier(spawnAnchor);
    this.template = createFactionTemplate(FACTIONS[species], this.spawnScaleMultiplier, encounterMode);
    this.creatureConfigOverride = createScaledCreatureConfig(species, this.spawnScaleMultiplier, encounterMode);
    this.id = id;
    this.spawnAnchor = spawnAnchor;
    this.actor = null;
    this.group = null;
    this.lifecycle = createMobileEnemyLifecycle('spawned', { spawnedAt: performance?.now?.() ?? Date.now() });
    this.loadFailure = null;
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
    this.encounterMode = encounterMode;
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
    this.bloodFeudNoTargetElapsed = 0;
    this.bloodFeudAttackCommitElapsed = 0;
    this.lastSeparationSuppressedApproach = false;
    this.lastMovedDistance = 0;
    this.bloodFeudDiagnosticLogElapsed = Math.random() * DEV_DIAGNOSTIC_INTERVAL_SECONDS;
    this.bloodFeudAiElapsed = Math.random() * FOLSOM_BLOOD_FEUD_AI_TICK_SECONDS;
    this.bloodFeudGroundElapsed = FOLSOM_BLOOD_FEUD_GROUND_RESAMPLE_SECONDS;
    this.bloodFeudGroundSample = null;
    this.bloodFeudGroundSamplePosition = null;
  }

  load() {
    this.lifecycle.state = 'loading';
    this.lifecycle.loadStartedAt = performance?.now?.() ?? Date.now();
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
    const isFolsomFeudNeckman = this.encounterMode === 'folsom_neckman_blood_feud' && this.species === 'neck_man';
    const isFolsomRamMan = this.encounterMode === 'folsom_neckman_blood_feud' && this.species === 'ram_man';
    const allStates = isFolsomFeudNeckman
      ? FOLSOM_BLOOD_FEUD_ANIMATION_STATES.filter((state) => this.template.assets[state])
      : (isFolsomRamMan ? ['idle', 'walk', 'die'].filter((state) => this.template.assets[state]) : Object.keys(this.template.assets));
    assertMobileEnemyBudget({ encounterMode: this.encounterMode, species: this.species, animationStates: allStates, stagedLoading: isFolsomFeudNeckman });
    const priorityRemaining = allStates.filter((candidate) => candidate !== idleState && primaryStates.has(candidate));
    const optionalRemaining = isFolsomFeudNeckman
      ? allStates.filter((candidate) => candidate !== idleState && !primaryStates.has(candidate))
      : allStates.filter((candidate) => candidate !== idleState && !primaryStates.has(candidate));

    this.actor = createCreatureActor(this.template.creatureConfigId, {
      scene: this.scene,
      position: this.spawnAnchor.position,
      yaw: this.spawnAnchor.yaw ?? 0,
      name: this.id,
      config: this.creatureConfigOverride,
      singleActorRoot: isFolsomFeudNeckman || isFolsomRamMan,
    });

    return this.actor.load({ initialStates: [idleState], lazyStates: [...priorityRemaining, ...optionalRemaining], lazyLoadDelayMs: isFolsomFeudNeckman || isFolsomRamMan ? MOBILE_ENEMY_BUDGETS.folsomNeckmanBloodFeud.loadStaggerMs : 0 })
      .then((actor) => {
        this.group = actor.group;
        this.group.visible = true;
        this.animation = actor.animationSet;
        this.group.userData = {
          ...this.group.userData,
          hostile: this.species !== 'ram_man',
          blackGrassTempleFactionEnemy: true,
          faction: this.species,
          opposingFaction: this.template.opposingFactionId,
          displayName: `${this.template.displayName} ${this.spawnAnchor.id}`,
          spawnAnchorId: this.spawnAnchor.id,
          spawnPosition: vectorSummary(this.spawnAnchor.position),
          stateMachine: FACTION_STATE_MACHINE,
          targetPriority: this.encounterMode === 'folsom_neckman_blood_feud' ? (this.species === 'neck_man' ? ['cached living ram_man prey', 'nearest living blood-feud neckman fallback'] : ['wander', 'flee cached living neck_man predators']) : ['nearest living opposing faction enemy', 'player fallback', 'patrol target'],
          animationMapping: this.template.animationMap,
          assetUrls: isFolsomFeudNeckman ? { canonical: NECK_MAN_CANONICAL_MOBILE_MODEL_FILE } : (isFolsomRamMan ? { canonical: RAM_MAN_CANONICAL_MOBILE_MODEL_FILE, separateFallback: this.template.assets } : this.template.assets),
          animationStrategy: this.animation?.getAssetStrategy?.() ?? undefined,
          canonicalModelPath: this.animation?.getCanonicalPath?.() ?? undefined,
          expectedAnimationStates: allStates,
          health: this.health,
          spawnScaleMultiplier: this.spawnScaleMultiplier,
          bloodFeud: this.encounterMode === 'folsom_neckman_blood_feud',
          prey: this.species === 'ram_man',
          freeForAllFaction: this.encounterMode === 'folsom_neckman_blood_feud',
          groundDiagnostics: this.encounterMode === 'folsom_neckman_blood_feud' ? this.sampleCurrentGroundY(this.spawnAnchor.position) : undefined,
          combatSpacingProfile: this.encounterMode === 'folsom_neckman_blood_feud' ? 'folsom_blood_feud_close_combat' : undefined,
          mobileEnemyLifecycle: this.lifecycle,
        };
        if (this.encounterMode === 'folsom_neckman_blood_feud') this.applyDynamicGrounding(this.group.position, { force: true });

        this.setBehaviorState('spawn', { force: true });
        this.ensureSingleVisibleAnimationRoot();
        this.applyEncounterVisualTreatment();
        this.applyEncounterPerformanceTreatment();
        this.addDevMarker();
        this.isLoaded = true;
        const now = performance?.now?.() ?? Date.now();
        this.lifecycle.state = 'active';
        this.lifecycle.loadedAt = now;
        this.lifecycle.visibleAt = now;
        this.lifecycle.activeAt = now;
        this.lifecycle.loadedStates = this.animation?.getLoadedStates?.() ?? [];
        this.refreshAnimationUserData();
        this.logLoadDiagnostics('idle-visible');
        this.onLoaded?.(this);
      })
      .catch((error) => {
        if (this.encounterMode === 'folsom_neckman_blood_feud') {
          console.error('[FolsomBloodFeud] Neckman model asset load failed', {
            creatureConfigId: this.template.creatureConfigId,
            spawnAnchorId: this.spawnAnchor?.id,
            idleState,
            idleAsset: this.template.assets?.[idleState],
            assetUrls: this.template.assets,
            error,
          });
        }
        this.loadFailure = { message: error?.message ?? String(error), path: this.template.assets?.[idleState] ?? null, state: idleState };
        this.lifecycle.state = 'failed';
        this.lifecycle.failedAt = performance?.now?.() ?? Date.now();
        this.lifecycle.failure = this.loadFailure;
        console.warn(`Black Grass Temple ${this.template.displayName} failed to load idle model; faction spawn skipped.`, error);
      });
  }

  applyEncounterVisualTreatment() {
    if (this.encounterMode !== 'folsom_neckman_blood_feud' || !this.group) return;
    this.group.traverse((child) => {
      if (!child.isMesh) return;
      const materials = (Array.isArray(child.material) ? child.material : [child.material]).filter(Boolean);
      materials.forEach((material) => {
        material.color?.multiplyScalar?.(1.18);
        material.emissive?.setHex?.(0x1a0b06);
        material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.035);
        if ('roughness' in material) material.roughness = Math.min(1, Math.max(0.72, material.roughness ?? 0.9));
        material.needsUpdate = true;
      });
    });
    this.group.userData.visualTreatment = 'folsom_blood_feud_high_contrast_cloned_materials';
  }

  applyEncounterPerformanceTreatment() {
    if (this.encounterMode !== 'folsom_neckman_blood_feud' || !this.group) return;
    this.group.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
    });
    this.group.userData.performanceTreatment = 'folsom_blood_feud_shadows_disabled_limited_animation_set';
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
    this.group.userData.visibleAnimationRootCount = new Set(Object.values(tracks).map((track) => track.root).filter((root) => root?.visible)).size;
    this.group.userData.loadedCreatureAnimationRoots = this.animation.getLoadedRootCount?.() ?? Object.keys(tracks).length;
    this.group.userData.liveAnimationRoots = this.animation.getLiveAnimationRootCount?.() ?? this.group.userData.loadedCreatureAnimationRoots;
    this.group.userData.liveSkinnedRoots = this.animation.getLiveSkinnedRootCount?.() ?? 0;
    this.group.userData.extraStateRootsAlive = this.animation.hasExtraStateRootsAlive?.() ?? false;
    this.group.userData.animationActionCount = this.animation.getActionCount?.() ?? 0;
    this.group.userData.animationStrategy = this.animation.getAssetStrategy?.() ?? this.group.userData.animationStrategy;
    this.group.userData.canonicalModelPath = this.animation.getCanonicalPath?.() ?? this.group.userData.canonicalModelPath;
    this.group.userData.activeAnimationMixerCount = this.animation.getActiveMixerCount?.() ?? 0;
    this.lifecycle.loadedStates = this.animation.getLoadedStates?.() ?? [];
    this.group.userData.mobileEnemyLifecycle = this.lifecycle;
    this.group.userData.loadedCreatureAnimationStateCount = Object.keys(tracks).length;
    this.group.userData.boundingBoxSize = boxSizeSummary(this.group);
    this.group.userData.worldPosition = vectorSummary(this.group.getWorldPosition(new THREE.Vector3()));
  }

  ensureSingleVisibleAnimationRoot() {
    if (!this.group || !this.animation) return;
    this.group.visible = true;
    const animationState = this.resolveStateAnimation(this.behaviorState ?? 'spawn');
    const visibleState = this.animation.tracks[animationState] ? animationState : Object.keys(this.animation.tracks)[0];
    if (this.animation.singleActorRoot) {
      const root = this.animation.actorRootTrack?.root ?? Object.values(this.animation.tracks)[0]?.root;
      if (root) root.visible = true;
    } else {
      Object.entries(this.animation.tracks).forEach(([trackState, track]) => {
        track.root.visible = trackState === visibleState;
      });
    }
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
    const generatedRuntime = context?.generatedRuntime === true;
    const updateTier = context?.updateTier ?? 'near';
    const aiTickAllowed = context?.aiTickAllowed !== false;
    const animationDelta = ((this.species === 'neck_man' && context?.perfDebugToggles?.neckmanStatic === true) || (this.species === 'ram_man' && context?.perfDebugToggles?.rammanStatic === true) || (generatedRuntime && updateTier === 'sleep')) ? 0 : deltaSeconds;
    if (animationDelta > 0) {
      const mixerStart = performance?.now?.() ?? Date.now();
      this.animation?.update(animationDelta);
      if (context?.perfStats) context.perfStats.mixerMs += (performance?.now?.() ?? Date.now()) - mixerStart;
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaSeconds);
    this.devCombatLogElapsed += deltaSeconds;
    this.jumpAttackCooldown = Math.max(0, this.jumpAttackCooldown - deltaSeconds);
    this.playerRevengeTimer = Math.max(0, this.playerRevengeTimer - deltaSeconds);
    this.awarenessReactionDelay = Math.max(0, this.awarenessReactionDelay - deltaSeconds);
    this.currentUpdateContext = context;
    this.steeringProbeTimer = Math.max(0, this.steeringProbeTimer - deltaSeconds);
    if (this.encounterMode === 'folsom_neckman_blood_feud') this.bloodFeudGroundElapsed += deltaSeconds;
    if (aiTickAllowed) this.decayBlockedSegmentCooldowns(deltaSeconds);
    if (!this.group || this.isRemoved || this.lifecycle.state === 'loading' || this.lifecycle.state === 'pendingLoad') {
      this.skippedAiTicks = (this.skippedAiTicks ?? 0) + 1;
      if (context?.perfStats) context.perfStats.intentionallySkippedAiTicks += 1;
      return;
    }

    if (this.encounterMode === 'folsom_neckman_blood_feud' && this.species === 'ram_man') {
      this.updateFolsomRamManPrey(deltaSeconds, context, aiTickAllowed);
      return;
    }

    if (this.encounterMode === 'folsom_neckman_blood_feud' && !aiTickAllowed) {
      this.skippedAiTicks = (this.skippedAiTicks ?? 0) + 1;
      if (context?.perfStats) context.perfStats.intentionallySkippedAiTicks += 1;
      this.group.userData.mobileAiSkipped = true;
      this.group.userData.mobileAiTickSeconds = FOLSOM_BLOOD_FEUD_AI_TICK_SECONDS;
      return;
    }

    if (generatedRuntime && !aiTickAllowed) {
      this.group.userData.generatedAiLod = updateTier;
      this.group.userData.generatedAiSkipped = true;
      return;
    }
    if (generatedRuntime) {
      this.group.userData.generatedAiLod = updateTier;
      this.group.userData.generatedAiSkipped = false;
    }

    const isFolsomFeud = this.encounterMode === 'folsom_neckman_blood_feud';
    const aiStart = performance?.now?.() ?? Date.now();
    this.applyDynamicGrounding(this.group.position);

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
    this.updateFolsomBloodFeudNoTargetTimer(deltaSeconds, context, attackCommitted);
    if (isFolsomFeud && !attackCommitted && context?.folsomBehaviorSlice !== true) {
      this.bloodFeudAiElapsed += deltaSeconds;
      if (this.bloodFeudAiElapsed < FOLSOM_BLOOD_FEUD_AI_TICK_SECONDS) {
        const targetPosition = this.currentTarget?.type === 'enemy' ? this.currentTarget.enemy?.group?.position : null;
        if (targetPosition) {
          const face = targetPosition.clone().sub(this.group.position);
          face.y = 0;
          if (face.lengthSq() > 0.001) this.faceDirection(face.normalize(), deltaSeconds);
        }
        this.updateDevNavigationMarkers();
        return;
      }
      this.bloodFeudAiElapsed = 0;
    }
    if (isFolsomFeud && context?.perfStats) context.perfStats.aiUpdatesRun += 1;
    if (!attackCommitted && (this.retargetElapsed >= RETARGET_INTERVAL_SECONDS || !this.isTargetStillValid(context))) {
      if (context?.perfDebugToggles?.neckmanTargetingOff === true) {
        this.retargetElapsed = 0;
        this.currentTarget = null;
      } else if (this.encounterMode !== 'folsom_neckman_blood_feud' || context?.requestFolsomTargetingOperation?.(this) === true) {
        this.retargetElapsed = 0;
        const targetStart = performance?.now?.() ?? Date.now();
        this.selectTarget(context);
        if (context?.perfStats) {
          const elapsedTargetMs = (performance?.now?.() ?? Date.now()) - targetStart;
          context.perfStats.targetingMs += elapsedTargetMs;
          context.perfStats.targetingRollingMs = context.perfStats.targetingRollingMs > 0
            ? (context.perfStats.targetingRollingMs * 0.9) + (elapsedTargetMs * 0.1)
            : elapsedTargetMs;
          context.perfStats.targetingWorstMs = Math.max(context.perfStats.targetingWorstMs ?? 0, elapsedTargetMs);
        }
      } else if (context?.perfStats) {
        context.perfStats.deferredTargetingOps += 1;
      }
    }

    this.updateDirectorPressureTimers(deltaSeconds, context);
    this.pathRepathElapsed += deltaSeconds;

    if (this.unstuckTimer > 0) {
      this.unstuckTimer = Math.max(0, this.unstuckTimer - deltaSeconds);
      this.activeWaypoint = null;
      this.moveToward(this.unstuckDirection, this.template.walkSpeed * 0.75, deltaSeconds, Infinity, 'patrol', { suppressStuckTracking: true });
      this.updateDevNavigationMarkers();
      if (context?.perfStats) context.perfStats.aiMs += (performance?.now?.() ?? Date.now()) - aiStart;
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
      const combatStart = performance?.now?.() ?? Date.now();
      this.updateAttack(deltaSeconds, context);
      if (context?.perfStats) context.perfStats.combatMs += (performance?.now?.() ?? Date.now()) - combatStart;
      this.updateDevNavigationMarkers();
      return;
    }

    if (this.currentTarget?.type === 'enemy') {
      const combatStart = performance?.now?.() ?? Date.now();
      this.updateEnemyTarget(deltaSeconds, context);
      if (context?.perfStats) context.perfStats.combatMs += (performance?.now?.() ?? Date.now()) - combatStart;
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

  updateFolsomRamManPrey(deltaSeconds, context, aiTickAllowed) {
    if (!this.group || this.isRemoved || this.lifecycle.state === 'loading' || this.lifecycle.state === 'pendingLoad') return;
    this.applyDynamicGrounding(this.group.position);
    if (this.behaviorState === 'dead') {
      this.corpseTimer -= deltaSeconds;
      if (this.corpseTimer <= 0) this.hideCorpse();
      return;
    }
    this.bloodFeudAiElapsed = (this.bloodFeudAiElapsed ?? Math.random() * FOLSOM_RAM_MAN_AI_TICK_SECONDS) + deltaSeconds;
    if (!aiTickAllowed || context?.perfDebugToggles?.rammanAiOff === true || this.bloodFeudAiElapsed < FOLSOM_RAM_MAN_AI_TICK_SECONDS) {
      this.setBehaviorState(this.pauseTimer > 0 ? 'spawn' : this.behaviorState ?? 'spawn');
      return;
    }
    this.bloodFeudAiElapsed = 0;
    if (context?.perfStats) context.perfStats.ramManAiUpdates += 1;
    const predators = context?.folsomBloodFeudTargeting?.predatorCandidates ?? [];
    let nearest = null;
    let nearestDistanceSq = Infinity;
    for (let i = 0; i < predators.length; i += 1) {
      const predator = predators[i];
      if (!predator?.isAlive || !predator.group) continue;
      const d = horizontalDistanceSq(this.group.position, predator.group.position);
      if (d < nearestDistanceSq) { nearest = predator; nearestDistanceSq = d; }
    }
    const fleeSq = FOLSOM_RAM_MAN_FLEE_RADIUS * FOLSOM_RAM_MAN_FLEE_RADIUS;
    const threatSq = FOLSOM_RAM_MAN_THREAT_RADIUS * FOLSOM_RAM_MAN_THREAT_RADIUS;
    if (nearest && nearestDistanceSq <= threatSq) {
      const away = this.group.position.clone().sub(nearest.group.position); away.y = 0;
      if (away.lengthSq() < 0.001) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      this.moveToward(away.normalize(), nearestDistanceSq <= fleeSq ? this.template.seekSpeed : this.template.walkSpeed * 1.25, deltaSeconds, Infinity, 'defensive_backstep');
      this.group.userData.preyState = nearestDistanceSq <= fleeSq ? 'flee' : 'avoid';
      this.group.userData.nearestPredatorId = nearest.id;
      return;
    }
    this.group.userData.preyState = 'wander';
    this.updatePatrol(deltaSeconds);
  }

  updateFolsomBloodFeudNoTargetTimer(deltaSeconds, context, attackCommitted) {
    if (this.encounterMode !== 'folsom_neckman_blood_feud' || attackCommitted || !this.isAlive) {
      this.bloodFeudNoTargetElapsed = 0;
      return;
    }
    const livingFeudCount = context.folsomBloodFeudTargeting?.candidates?.length ?? 0;
    if (livingFeudCount <= 1) {
      this.bloodFeudNoTargetElapsed = 0;
      return;
    }
    this.bloodFeudNoTargetElapsed = this.currentTarget?.type === 'enemy'
      ? 0
      : this.bloodFeudNoTargetElapsed + deltaSeconds;
    if (this.bloodFeudNoTargetElapsed >= FOLSOM_BLOOD_FEUD_IDLE_RETARGET_SECONDS) {
      this.forceFolsomBloodFeudRetarget();
    }
  }

  forceFolsomBloodFeudRetarget() {
    if (this.encounterMode !== 'folsom_neckman_blood_feud') return;
    this.currentTarget = null;
    this.targetLockTimer = 0;
    this.retargetElapsed = RETARGET_INTERVAL_SECONDS;
    this.pathRepathElapsed = WAYPOINT_REPATH_SECONDS;
    this.activeWaypoint = null;
    this.localAvoidanceWaypoint = null;
    this.blockedSegmentCooldowns.clear();
    this.stuckElapsed = 0;
    this.bloodFeudNoTargetElapsed = 0;
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
      if (this.encounterMode === 'folsom_neckman_blood_feud') return this.isFolsomBloodFeudTargetStillValid(enemy);
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
    if (this.encounterMode === 'folsom_neckman_blood_feud') {
      this.selectFolsomBloodFeudTarget(context, previousTargetId);
      return;
    }
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

  isFolsomBloodFeudTargetStillValid(enemy) {
    if (!enemy?.isAlive || !enemy.group || enemy === this || enemy.encounterMode !== this.encounterMode) return false;
    if (this.species === 'neck_man' && enemy.species !== 'neck_man' && enemy.species !== 'ram_man') return false;
    else if (this.species !== 'neck_man' && enemy.species !== this.species) return false;
    if (!this.group) return false;
    return horizontalDistanceSq(this.group.position, enemy.group.position) <= FOLSOM_BLOOD_FEUD_TARGET_LOSE_RANGE * FOLSOM_BLOOD_FEUD_TARGET_LOSE_RANGE;
  }

  selectFolsomBloodFeudTarget(context, previousTargetId = null) {
    const cache = context?.folsomBloodFeudTargeting;
    if (this.targetLockTimer > 0 && this.isTargetStillValid(context)) {
      this.group.userData.targetLockRemaining = Number(this.targetLockTimer.toFixed(2));
      if (cache?.perfStats) cache.perfStats.targetCacheReuses += 1;
      return;
    }
    const candidates = (this.species === 'neck_man' && context?.perfDebugToggles?.neckmanTargetRamMen !== false && (cache?.preyCandidates?.length ?? 0) > 0) ? cache.preyCandidates : (cache?.candidates ?? context?.enemies ?? []);
    let nearest = null;
    let nearestDistance = Infinity;
    for (let i = 0; i < candidates.length; i += 1) {
      const enemy = candidates[i];
      if (enemy === this || !this.isFolsomBloodFeudTargetStillValid(enemy)) continue;
      const distance = horizontalDistanceSq(this.group.position, enemy.group.position);
      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }
    if (nearest) {
      this.awarenessTier = nearestDistance <= this.template.combatEngageDistance * this.template.combatEngageDistance ? 'melee' : 'combat';
      this.noOpposingTargetElapsed = 0;
      this.currentTarget = { type: 'enemy', enemy: nearest };
      if (previousTargetId !== nearest.id) {
        this.targetLockTimer = FOLSOM_BLOOD_FEUD_TARGET_HOLD_SECONDS;
        if (cache?.perfStats) cache.perfStats.targetSwitches += 1;
        this.awarenessReactionDelay = 0.06;
        this.combatManeuverTimer = 0;
      }
      this.group.userData.targetType = nearest.species === 'ram_man' ? 'folsom_ram_man_prey' : 'folsom_blood_feud';
      this.group.userData.targetSpecies = nearest.species;
      this.group.userData.targetId = nearest.id;
      this.group.userData.awarenessTier = this.awarenessTier;
      this.group.userData.roomPathToEnemy = [];
      return;
    }
    this.currentTarget = null;
    this.targetLockTimer = 0;
    this.awarenessTier = 'none';
    this.group.userData.targetType = 'patrol';
    this.group.userData.targetId = null;
    this.group.userData.awarenessTier = 'none';
  }

  shouldTargetPlayer(context, opposingEnemy) {
    if (this.encounterMode === 'folsom_neckman_blood_feud') return false;
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
    if (this.encounterMode === 'folsom_neckman_blood_feud') return this.findNearestFolsomBloodFeudEnemy(context);
    if (this.currentUpdateContext?.perfStats) this.currentUpdateContext.perfStats.targetScans += 1;
    let nearest = null;
    let nearestDistance = Infinity;
    let nearestAwareness = null;
    context.enemies.forEach((enemy) => {
      const hostileByEncounter = this.encounterMode === 'folsom_neckman_blood_feud'
        ? enemy !== this && enemy.encounterMode === this.encounterMode && enemy.species === this.species
        : enemy !== this && enemy.species === this.template.opposingFactionId;
      if (!hostileByEncounter || !enemy.isAlive || !enemy.group) return;
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

  findNearestFolsomBloodFeudEnemy(context) {
    const candidates = context?.folsomBloodFeudTargeting?.candidates ?? context?.enemies ?? [];
    let nearest = null;
    let nearestDistance = Infinity;
    for (let i = 0; i < candidates.length; i += 1) {
      const enemy = candidates[i];
      if (enemy === this || !this.isFolsomBloodFeudTargetStillValid(enemy)) continue;
      const distance = horizontalDistanceSq(this.group.position, enemy.group.position);
      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }
    this.awarenessTier = nearest ? (nearestDistance <= this.template.combatEngageDistance * this.template.combatEngageDistance ? 'melee' : 'combat') : 'none';
    if (this.group) {
      this.group.userData.awarenessTier = this.awarenessTier;
      this.group.userData.roomPathToEnemy = [];
    }
    return nearest;
  }

  getOpposingAwareness(enemy, context = null) {
    if (!this.group || !enemy?.group) return { tier: 'none', distance: Infinity, roomPath: [] };
    if (this.isFolsomBloodFeudEnemyTarget(enemy)) {
      const distanceSq = horizontalDistanceSq(this.group.position, enemy.group.position);
      const loseRangeSq = FOLSOM_BLOOD_FEUD_TARGET_LOSE_RANGE * FOLSOM_BLOOD_FEUD_TARGET_LOSE_RANGE;
      if (distanceSq > loseRangeSq) return { tier: 'none', distance: Math.sqrt(distanceSq), roomPath: [] };
      const engageSq = this.template.combatEngageDistance * this.template.combatEngageDistance;
      return { tier: distanceSq <= engageSq ? 'melee' : 'combat', distance: Math.sqrt(distanceSq), roomPath: [] };
    }
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
    if (context?.perfDebugToggles?.neckmanMovementOff === true && this.encounterMode === 'folsom_neckman_blood_feud') {
      if (distance > 0.001) this.faceDirection(toTarget.clone().multiplyScalar(1 / distance), deltaSeconds);
      return;
    }

    if (this.awarenessReactionDelay > 0) {
      this.setBehaviorState(awareness.tier === 'far' || awareness.tier === 'adjacent_room' || awareness.tier === 'short_route' ? 'investigate_enemy_faction' : 'combat_enter');
      return;
    }

    const isFolsomFeudTarget = this.isFolsomBloodFeudEnemyTarget(target);
    const directClear = context?.perfDebugToggles?.neckmanCollisionOff === true
      ? true
      : (isFolsomFeudTarget && distance <= FOLSOM_BLOOD_FEUD_CLOSE_COLLISION_RANGE
        ? true
        : this.hasClearMovementSegment(this.group.position, target.group.position, NAV_CLEARANCE_RADIUS));
    this.blockedTargetElapsed = directClear ? 0 : this.blockedTargetElapsed + deltaSeconds;
    if (this.blockedTargetElapsed >= BLOCKED_TARGET_REPATH_SECONDS) this.blockCurrentDirectSegment();

    if (context?.perfDebugToggles?.neckmanCombatOff !== true && (distance <= this.template.combatEngageDistance || awareness.tier === 'melee' || awareness.tier === 'combat') && directClear) {
      this.updateEnemyCombat(deltaSeconds, target, distance, toTarget, context);
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


  isFolsomBloodFeudEnemyTarget(enemy) {
    return this.encounterMode === 'folsom_neckman_blood_feud'
      && enemy?.encounterMode === this.encounterMode
      && enemy !== this
      && (enemy?.species === this.species || (this.species === 'neck_man' && enemy?.species === 'ram_man'));
  }

  sampleCurrentGroundY(position, { force = false } = {}) {
    const x = position?.x;
    const z = position?.z;
    const fallbackY = Number.isFinite(position?.y) ? position.y : this.spawnAnchor?.position?.y ?? 0;
    if (this.encounterMode === 'folsom_neckman_blood_feud' && !force && this.bloodFeudGroundSample && this.bloodFeudGroundSamplePosition) {
      const moved = horizontalDistance(position, this.bloodFeudGroundSamplePosition);
      if (moved < FOLSOM_BLOOD_FEUD_GROUND_RESAMPLE_DISTANCE && this.bloodFeudGroundElapsed < FOLSOM_BLOOD_FEUD_GROUND_RESAMPLE_SECONDS) return this.bloodFeudGroundSample;
    }
    const visible = this.outdoorVisibleSurfaceSampler?.(x, z, { water: false, fallbackY });
    if (visible && Number.isFinite(visible.y)) {
      const ground = {
        y: visible.y,
        visualY: visible.y + FOLSOM_BLOOD_FEUD_FOOT_LIFT,
        source: visible.floorId ?? visible.zoneId ?? visible.source ?? 'visible-outdoor-surface',
        kind: visible.source ?? 'visible-outdoor-surface',
        priority: 'visible',
      };
      this.cacheFolsomBloodFeudGround(position, ground);
      return ground;
    }
    const sampled = this.collision?.sampleWalkableY?.(x, z, fallbackY);
    if (sampled && Number.isFinite(sampled.y)) {
      const ground = {
        y: sampled.y,
        visualY: sampled.y + FOLSOM_BLOOD_FEUD_FOOT_LIFT,
        source: sampled.surface?.id ?? sampled.surface?.userData?.id ?? sampled.kind ?? 'walkable-surface',
        kind: sampled.kind ?? 'unknown',
        priority: sampled.priority ?? null,
      };
      this.cacheFolsomBloodFeudGround(position, ground);
      return ground;
    }
    const ground = { y: fallbackY, visualY: fallbackY + FOLSOM_BLOOD_FEUD_FOOT_LIFT, source: 'spawn-fallback', kind: 'fallback', priority: null };
    this.cacheFolsomBloodFeudGround(position, ground);
    return ground;
  }

  cacheFolsomBloodFeudGround(position, ground) {
    if (this.encounterMode !== 'folsom_neckman_blood_feud' || !position || !ground) return;
    this.bloodFeudGroundSample = ground;
    this.bloodFeudGroundSamplePosition = position.clone();
    this.bloodFeudGroundElapsed = 0;
  }

  applyDynamicGrounding(position = this.group?.position, { force = false } = {}) {
    if (this.encounterMode !== 'folsom_neckman_blood_feud' || !position) return position;
    const ground = this.sampleCurrentGroundY(position, { force });
    position.y = ground.visualY;
    if (this.group?.userData) this.group.userData.folsomBloodFeudGrounding = ground;
    return position;
  }

  isTargetRoughlyInFront(target) {
    if (!target?.group || !this.group) return false;
    const toTarget = target.group.position.clone().sub(this.group.position);
    toTarget.y = 0;
    if (toTarget.lengthSq() < 0.001) return true;
    toTarget.normalize();
    const facing = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y)).normalize();
    const requiredDot = this.isFolsomBloodFeudEnemyTarget(target) ? FOLSOM_BLOOD_FEUD_COMBAT_SPACING.facingDot : 0.45;
    return facing.dot(toTarget) >= requiredDot;
  }

  getAttackImpactRangeForTarget(target) {
    return this.isFolsomBloodFeudEnemyTarget(target)
      ? FOLSOM_BLOOD_FEUD_COMBAT_SPACING.attackImpactRange
      : this.template.attackImpactRange;
  }

  getVisualContactRangeForTarget(target) {
    return this.isFolsomBloodFeudEnemyTarget(target)
      ? FOLSOM_BLOOD_FEUD_COMBAT_SPACING.visualContactRange
      : this.template.visualContactRange;
  }

  shouldForceBloodFeudAttack(deltaSeconds, target, distance, attackCommitRange) {
    if (!this.isFolsomBloodFeudEnemyTarget(target) || this.attackCooldown > 0) {
      this.bloodFeudAttackCommitElapsed = 0;
      return false;
    }
    const inCommitRange = distance <= attackCommitRange;
    const inFront = this.isTargetRoughlyInFront(target);
    if (!inCommitRange || !inFront) {
      this.bloodFeudAttackCommitElapsed = 0;
      return false;
    }
    this.bloodFeudAttackCommitElapsed += deltaSeconds;
    return this.bloodFeudAttackCommitElapsed >= FOLSOM_BLOOD_FEUD_COMBAT_SPACING.attackCommitHoldSeconds;
  }

  updateBloodFeudCombatDiagnostics(target, distance, { attackCommitRange, impactRange, separationSuppressed, attackAllowed = false, attackBlockedByDistance = false } = {}) {
    if (this.encounterMode !== 'folsom_neckman_blood_feud' || !this.group) return;
    const diagnostics = {
      targetId: target?.id ?? null,
      targetDistance: Number(distance.toFixed(3)),
      desiredCombatDistance: Number(this.template.desiredCombatDistance.toFixed(3)),
      minimumBodySeparation: Number(this.template.minimumBodySeparation.toFixed(3)),
      attackCommitRange: Number((attackCommitRange ?? this.template.attackCommitRange).toFixed(3)),
      attackImpactRange: Number((impactRange ?? this.getAttackImpactRangeForTarget(target)).toFixed(3)),
      visualContactRange: Number(this.getVisualContactRangeForTarget(target).toFixed(3)),
      separationIgnoredOrReducedForCurrentTarget: Boolean(separationSuppressed),
      sampledGroundY: this.group.userData.folsomBloodFeudGrounding?.y ?? null,
      modelRootY: Number(this.group.position.y.toFixed(3)),
      actualMovedDistanceThisFrame: Number((this.lastMovedDistance ?? 0).toFixed(3)),
      attackAllowed: Boolean(attackAllowed),
      attackBlockedByDistance: Boolean(attackBlockedByDistance),
      attackAttempted: ['attack_enemy_faction', 'jump_attack_enemy_faction'].includes(this.behaviorState),
      attackCommitElapsed: Number((this.bloodFeudAttackCommitElapsed ?? 0).toFixed(3)),
    };
    this.group.userData.folsomBloodFeudCombat = diagnostics;
    if (IS_DEV) {
      this.bloodFeudDiagnosticLogElapsed = (this.bloodFeudDiagnosticLogElapsed ?? 0) + FOLSOM_BLOOD_FEUD_AI_TICK_SECONDS;
      if (this.bloodFeudDiagnosticLogElapsed >= DEV_DIAGNOSTIC_INTERVAL_SECONDS) {
        this.bloodFeudDiagnosticLogElapsed = 0;
        console.info('[FolsomBloodFeud] combat geometry diagnostic', { id: this.id, ...diagnostics });
      }
    }
  }

  updateEnemyCombat(deltaSeconds, target, distance, toTarget, context = null) {
    if (context?.perfDebugToggles?.neckmanCombatOff === true && this.encounterMode === 'folsom_neckman_blood_feud') return;
    const isFolsomFeudTarget = this.isFolsomBloodFeudEnemyTarget(target);
    if (context?.perfStats) context.perfStats.combatChecks += 1;
    const directClear = context?.perfDebugToggles?.neckmanCollisionOff === true
      ? true
      : (isFolsomFeudTarget && distance <= FOLSOM_BLOOD_FEUD_CLOSE_COLLISION_RANGE
        ? true
        : this.hasClearMovementSegment(this.group.position, target.group.position, NAV_CLEARANCE_RADIUS));
    const feudAttackCommitRange = FOLSOM_BLOOD_FEUD_COMBAT_SPACING.attackCommitRange;
    if (!directClear && !(isFolsomFeudTarget && distance <= feudAttackCommitRange && this.isTargetRoughlyInFront(target))) {
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

    const minimumBodySeparation = isFolsomFeudTarget ? FOLSOM_BLOOD_FEUD_COMBAT_SPACING.minimumBodySeparation : this.template.minimumBodySeparation;
    const tooCloseDistance = isFolsomFeudTarget ? FOLSOM_BLOOD_FEUD_COMBAT_SPACING.tooCloseDistance : this.template.tooCloseDistance;
    const attackCommitRange = isFolsomFeudTarget ? feudAttackCommitRange : this.template.attackCommitRange;
    const visualContactRange = this.getVisualContactRangeForTarget(target);
    this.updateBloodFeudCombatDiagnostics(target, distance, { attackCommitRange, impactRange: this.getAttackImpactRangeForTarget(target), separationSuppressed: this.lastSeparationSuppressedApproach, attackAllowed: this.attackCooldown <= 0 && distance <= attackCommitRange, attackBlockedByDistance: this.attackCooldown <= 0 && distance > attackCommitRange });
    if (isFolsomFeudTarget && this.shouldForceBloodFeudAttack(deltaSeconds, target, distance, attackCommitRange)) {
      this.chooseAndBeginEnemyAttack(distance);
      return;
    }

    if (distance < minimumBodySeparation) {
      const sideBias = Math.random() < 0.55 ? strafe.multiplyScalar(0.75) : new THREE.Vector3();
      const backstep = direction.clone().multiplyScalar(-1).add(sideBias).normalize();
      this.moveToward(backstep, this.template.backstepSpeed, deltaSeconds, Infinity, 'defensive_backstep');
      this.logCombatEvent('maneuver', { target, maneuver: 'minimum-separation-backstep', distance });
      return;
    }

    if (this.attackCooldown <= 0 && distance <= attackCommitRange && (directClear || isFolsomFeudTarget)) {
      if (isFolsomFeudTarget && (!directClear || this.lastMovedDistance < STUCK_MOVEMENT_THRESHOLD || distance <= visualContactRange || this.isTargetRoughlyInFront(target))) {
        this.chooseAndBeginEnemyAttack(distance);
        return;
      }
      if (distance > visualContactRange) {
        this.moveToward(direction, this.template.lungeSpeed, deltaSeconds, Math.max(0, distance - visualContactRange), 'combat_lunge', { desiredTarget: target.group.position, faceTarget: target.group.position, minimumTargetDistance: minimumBodySeparation });
        this.logCombatEvent('maneuver', { target, maneuver: 'contact-lunge', distance });
        return;
      }
      this.chooseAndBeginEnemyAttack(distance);
      return;
    }

    if (this.combatManeuverTimer <= 0) this.chooseCombatManeuver(distance);

    if (distance < tooCloseDistance) {
      const sideBias = Math.random() < 0.55 ? strafe.multiplyScalar(0.75) : new THREE.Vector3();
      const backstep = direction.clone().multiplyScalar(-1).add(sideBias).normalize();
      this.moveToward(backstep, this.template.backstepSpeed, deltaSeconds, Infinity, 'defensive_backstep');
      this.logCombatEvent('maneuver', { target, maneuver: 'backstep', distance });
      return;
    }

    if (this.combatManeuver === 'lunge' && distance > visualContactRange * 0.9) {
      this.moveToward(direction, this.template.lungeSpeed, deltaSeconds, Math.max(0, distance - visualContactRange * 0.88), 'combat_lunge', { desiredTarget: target.group.position, faceTarget: target.group.position, minimumTargetDistance: minimumBodySeparation });
      this.logCombatEvent('maneuver', { target, maneuver: 'lunge', distance });
      return;
    }

    const desiredCombatDistance = isFolsomFeudTarget ? FOLSOM_BLOOD_FEUD_COMBAT_SPACING.desiredCombatDistance : this.template.desiredCombatDistance;
    if (distance > desiredCombatDistance + 0.2) {
      this.moveToward(direction, this.template.seekSpeed * 0.86, deltaSeconds, Math.max(0, distance - desiredCombatDistance), 'combat_lunge', { desiredTarget: target.group.position, faceTarget: target.group.position, minimumTargetDistance: minimumBodySeparation });
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
        const target = this.currentTarget?.type === 'enemy' ? this.currentTarget.enemy : null;
        const visualContactRange = target ? this.getVisualContactRangeForTarget(target) : this.template.visualContactRange;
        const attackCommitRange = target && this.isFolsomBloodFeudEnemyTarget(target)
          ? FOLSOM_BLOOD_FEUD_COMBAT_SPACING.attackCommitRange
          : this.template.attackCommitRange;
        const directClear = context?.perfDebugToggles?.neckmanCollisionOff === true ? true : this.hasClearMovementSegment(this.group.position, targetPosition, NAV_CLEARANCE_RADIUS);
        const canLungeIn = progress < this.template.attackDamageWindow.start
          && distance > visualContactRange
          && distance <= attackCommitRange
          && directClear
          && !(target && this.isFolsomBloodFeudEnemyTarget(target) && this.lastMovedDistance < STUCK_MOVEMENT_THRESHOLD);
        if (canLungeIn) {
          this.moveToward(
            direction,
            this.template.lungeSpeed * 0.82,
            deltaSeconds,
            Math.min(this.template.attackLungeDistance, Math.max(0, distance - visualContactRange)),
            this.behaviorState,
            { suppressStuckTracking: true, desiredTarget: targetPosition, faceTarget: targetPosition, minimumTargetDistance: target && this.isFolsomBloodFeudEnemyTarget(target) ? FOLSOM_BLOOD_FEUD_COMBAT_SPACING.minimumBodySeparation : this.template.minimumBodySeparation },
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
      if (target?.isAlive && horizontalDistance(this.group.position, target.group.position) <= this.getAttackImpactRangeForTarget(target) && this.isTargetRoughlyInFront(target) && this.hasClearMovementSegment(this.group.position, target.group.position, NAV_CLEARANCE_RADIUS)) {
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
    if (this.encounterMode === 'folsom_neckman_blood_feud') {
      event.hitStrength = result?.killed ? 3.2 : 2.35;
      event.tags = ['folsom_neckman_blood_feud', 'heavy_feud_gore', ...(event.tags ?? [])];
    }
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
    this.lifecycle.state = 'disposed';
    this.lifecycle.disposedAt = performance?.now?.() ?? Date.now();
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
    const collisionStart = performance?.now?.() ?? Date.now();
    try {
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
    } finally {
      if (this.currentUpdateContext?.perfStats) this.currentUpdateContext.perfStats.collisionMs += (performance?.now?.() ?? Date.now()) - collisionStart;
    }
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
    if (!this.canStandAtFloorPosition(point)) return false;
    const offsets = [
      [clearanceRadius, 0], [-clearanceRadius, 0], [0, clearanceRadius], [0, -clearanceRadius],
      [clearanceRadius * 0.7, clearanceRadius * 0.7], [-clearanceRadius * 0.7, clearanceRadius * 0.7],
      [clearanceRadius * 0.7, -clearanceRadius * 0.7], [-clearanceRadius * 0.7, -clearanceRadius * 0.7],
    ];
    return offsets.every(([x, z]) => this.canStandAtFloorPosition(new THREE.Vector3(point.x + x, point.y, point.z + z)));
  }

  canStandAtFloorPosition(point) {
    if (!point) return false;
    return this.collision?.canStandAtFloorPosition?.(point) ?? this.collision?.canStandAt(point) ?? false;
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
    const movementStart = performance?.now?.() ?? Date.now();
    try {
    const targetLimitedDistance = desiredTarget && minimumTargetDistance > 0
      ? Math.max(0, horizontalDistance(this.group.position, desiredTarget) - minimumTargetDistance)
      : Infinity;
    const stepDistance = Math.min(maxDistance, targetLimitedDistance, speed * deltaSeconds);
    if (stepDistance <= 0.001) return 0;
    const previous = this.group.position.clone();
    const movementDirection = this.getAdjustedMovementDirection(direction, stepDistance, desiredTarget);
    const next = this.group.position.clone().add(movementDirection.clone().multiplyScalar(stepDistance));
    this.applyDynamicGrounding(next);
    if (this.canStandAtFloorPosition(next)) {
      this.group.position.copy(next);
      this.setBehaviorState(movingState);
    } else {
      const probeDirection = this.chooseSteeringProbeDirection(movementDirection, desiredTarget ?? next);
      if (probeDirection) {
        const probeNext = this.group.position.clone().add(probeDirection.clone().multiplyScalar(stepDistance));
        this.applyDynamicGrounding(probeNext);
        if (this.canStandAtFloorPosition(probeNext)) {
          this.group.position.copy(probeNext);
          this.steeringProbeDirection.copy(probeDirection);
          this.steeringProbeTimer = STEERING_PROBE_SECONDS;
          this.setBehaviorState(movingState);
        }
      }
      if (horizontalDistance(previous, this.group.position) < 0.001) {
        const slideX = this.group.position.clone();
        slideX.x = next.x;
        this.applyDynamicGrounding(slideX);
        const slideZ = this.group.position.clone();
        slideZ.z = next.z;
        this.applyDynamicGrounding(slideZ);
        if (this.canStandAtFloorPosition(slideX)) {
          this.group.position.copy(slideX);
          this.setBehaviorState(movingState);
        } else if (this.canStandAtFloorPosition(slideZ)) {
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
    this.lastMovedDistance = movedDistance;
    if (!suppressStuckTracking) {
      this.stuckElapsed = movedDistance < STUCK_MOVEMENT_THRESHOLD ? this.stuckElapsed + deltaSeconds : 0;
      if (this.stuckElapsed >= SOFT_STUCK_SECONDS && !this.localAvoidanceWaypoint && desiredTarget) {
        const blocker = this.findBlockingRect(this.group.position, desiredTarget, NAV_CLEARANCE_RADIUS)?.rect;
        const detour = blocker ? this.findLocalDetourWaypoint(this.group.position, desiredTarget, blocker) : null;
        if (detour) this.localAvoidanceWaypoint = detour;
      }
      if (this.encounterMode === 'folsom_neckman_blood_feud' && this.stuckElapsed >= FOLSOM_BLOOD_FEUD_STUCK_RETARGET_SECONDS) {
        this.forceFolsomBloodFeudRetarget();
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
    } finally {
      if (this.currentUpdateContext?.perfStats) this.currentUpdateContext.perfStats.movementMs += (performance?.now?.() ?? Date.now()) - movementStart;
    }
  }

  getAdjustedMovementDirection(direction, stepDistance, desiredTarget) {
    if (this.currentUpdateContext?.perfStats) this.currentUpdateContext.perfStats.movementUpdates += 1;
    let adjusted = direction.clone();
    adjusted.y = 0;
    if (adjusted.lengthSq() < 0.001) return adjusted;
    adjusted.normalize();

    if (this.steeringProbeTimer > 0 && this.steeringProbeDirection.lengthSq() > 0.001) {
      adjusted.copy(this.steeringProbeDirection);
    } else {
      const probeEnd = this.group.position.clone().add(adjusted.clone().multiplyScalar(Math.max(stepDistance, STEERING_PROBE_DISTANCE)));
      const isFolsomFeud = this.encounterMode === 'folsom_neckman_blood_feud';
      const targetDistanceSq = desiredTarget ? horizontalDistanceSq(this.group.position, desiredTarget) : 0;
      const needsCloseCollision = !isFolsomFeud || targetDistanceSq <= FOLSOM_BLOOD_FEUD_CLOSE_COLLISION_RANGE * FOLSOM_BLOOD_FEUD_CLOSE_COLLISION_RANGE;
      if (needsCloseCollision && !this.hasClearMovementSegment(this.group.position, probeEnd, NAV_CLEARANCE_RADIUS * 0.75)) {
        const probe = this.chooseSteeringProbeDirection(adjusted, desiredTarget ?? probeEnd);
        if (probe) {
          adjusted.copy(probe);
          this.steeringProbeDirection.copy(probe);
          this.steeringProbeTimer = STEERING_PROBE_SECONDS;
        }
      }
    }

    const separation = this.getEnemySeparationVector(desiredTarget);
    this.lastSeparationSuppressedApproach = separation.suppressedApproach;
    if (separation.vector.lengthSq() > 0.0001) {
      adjusted.add(separation.vector.multiplyScalar(separation.strength)).normalize();
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
      this.applyDynamicGrounding(probe);
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

  getEnemySeparationVector(desiredTarget = null) {
    if (this.currentUpdateContext?.perfDebugToggles?.neckmanCollisionOff === true) return { vector: new THREE.Vector3(), strength: 0, suppressedApproach: false };
    const sepStart = performance?.now?.() ?? Date.now();
    if (this.encounterMode === 'folsom_neckman_blood_feud' && desiredTarget && horizontalDistanceSq(this.group.position, desiredTarget) > FOLSOM_BLOOD_FEUD_CLOSE_COLLISION_RANGE * FOLSOM_BLOOD_FEUD_CLOSE_COLLISION_RANGE) {
      return { vector: new THREE.Vector3(), strength: 0, suppressedApproach: false };
    }
    if (this.currentUpdateContext?.perfStats) this.currentUpdateContext.perfStats.collisionChecks += 1;
    const separation = new THREE.Vector3();
    let strength = ENEMY_SEPARATION_STRENGTH;
    let suppressedApproach = false;
    const enemies = this.currentUpdateContext?.enemies ?? [];
    enemies.forEach((enemy) => {
      if (enemy === this || !enemy.isAlive || !enemy.group) return;
      const away = this.group.position.clone().sub(enemy.group.position);
      away.y = 0;
      const distance = away.length();
      const targetEnemy = this.currentTarget?.type === 'enemy' ? this.currentTarget.enemy : null;
      const isFeudTarget = this.isFolsomBloodFeudEnemyTarget(enemy) && enemy === targetEnemy;
      const nearAttackRange = isFeudTarget && distance <= FOLSOM_BLOOD_FEUD_COMBAT_SPACING.attackCommitRange;
      if (isFeudTarget) {
        if (nearAttackRange) strength = Math.min(strength, FOLSOM_BLOOD_FEUD_COMBAT_SPACING.separationStrengthNearAttackRange);
        suppressedApproach = true;
        return;
      }
      const personalSpace = isFeudTarget
        ? FOLSOM_BLOOD_FEUD_COMBAT_SPACING.minimumBodySeparation
        : Math.max(ENEMY_PERSONAL_SPACE, enemy.template?.minimumBodySeparation ?? 0, this.template.minimumBodySeparation ?? 0);
      if (distance <= 0.001 || distance >= personalSpace) return;
      separation.add(away.normalize().multiplyScalar((personalSpace - distance) / personalSpace));
    });
    if (separation.lengthSq() > 0.001) separation.normalize();
    const result = { vector: separation, strength, suppressedApproach };
    if (this.currentUpdateContext?.perfStats) this.currentUpdateContext.perfStats.collisionMs += (performance?.now?.() ?? Date.now()) - sepStart;
    return result;
  }

  getEnemyBodyPenalty(point) {
    let penalty = 0;
    const enemies = this.currentUpdateContext?.enemies ?? [];
    enemies.forEach((enemy) => {
      if (enemy === this || !enemy.isAlive || !enemy.group) return;
      const distance = horizontalDistance(point, enemy.group.position);
      const targetEnemy = this.currentTarget?.type === 'enemy' ? this.currentTarget.enemy : null;
      if (this.isFolsomBloodFeudEnemyTarget(enemy) && enemy === targetEnemy) return;
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
    const encounterRequested = this.encounterMode === 'folsom_neckman_blood_feud' && requested === 'run'
      ? 'walk'
      : requested;
    return resolveAnimationState({ species: this.species, requestedState: encounterRequested, assets: this.template.assets });
  }

  setBehaviorState(state, { force = false } = {}) {
    const stateStart = performance?.now?.() ?? Date.now();
    if (this.currentUpdateContext?.perfDebugToggles?.neckmanStateMachineOff === true && this.encounterMode === 'folsom_neckman_blood_feud' && !force) return;
    if (!this.animation || (!force && this.behaviorState === state)) return;
    const animationState = this.resolveStateAnimation(state);
    const currentAnimationState = this.resolveStateAnimation(this.behaviorState ?? 'spawn');
    const canOverride = force || IMMEDIATE_ANIMATION_STATES.has(state) || IMMEDIATE_ANIMATION_STATES.has(this.behaviorState);
    const minimumHold = LOCOMOTION_ANIMATION_HOLD_SECONDS[this.behaviorState] ?? 0;
    if (!canOverride && this.animationStateElapsed < minimumHold) return;
    this.group.visible = true;
    if (!this.actor?.setAnimationState(animationState, { force, fadeSeconds: 0.1 })) return;
    if (this.currentUpdateContext?.perfStats && this.behaviorState !== state) this.currentUpdateContext.perfStats.stateTransitions += 1;
    this.behaviorState = state;
    this.animationStateElapsed = 0;
    this.group.userData.behaviorState = state;
    this.group.userData.animationState = animationState;
    this.group.userData.visibleAnimationState = this.actor.animationSet.currentState ?? animationState;
    this.group.userData.visibleAnimationRootCount = 1;
    if (this.currentUpdateContext?.perfStats) this.currentUpdateContext.perfStats.stateMachineMs += (performance?.now?.() ?? Date.now()) - stateStart;
  }

  getActionDuration(animationState, fallback) {
    return this.actor?.getActionDuration(animationState, fallback) ?? fallback;
  }
}

export class BlackGrassTempleFactionManager {
  constructor({ scene, collision, anchors, navigationGraph = null, outdoorVisibleSurfaceSampler = null, encounterZones = null, onGoreEvent = null, enableBattleDirector = true, enableRespawns = true, encounterMode = 'faction_war', respawnCooldownSeconds = RESPAWN_COOLDOWN_SECONDS, perfDebugToggles = null } = {}) {
    this.scene = scene;
    this.collision = collision;
    this.anchors = anchors;
    this.navigationGraph = navigationGraph;
    this.outdoorVisibleSurfaceSampler = outdoorVisibleSurfaceSampler;
    this.enemies = [];
    this.spawnSerial = 0;
    this.respawnTimers = { sheep_demon: null, neck_man: null };
    this.devStatusElapsed = 0;
    this.nearbyCombatQuietSeconds = 0;
    this.initialWaveSpawned = false;
    this.onGoreEvent = onGoreEvent;
    this.enableBattleDirector = enableBattleDirector;
    this.enableRespawns = enableRespawns;
    this.encounterMode = encounterMode;
    this.respawnCooldownSeconds = respawnCooldownSeconds;
    this.perfDebugToggles = perfDebugToggles;
    this.perfStats = this.createPerfStats();
    this.bloodFeudRespawnTimer = null;
    this.mobileLoadQueue = [];
    this.mobileLoadQueueActive = 0;
    this.mobileLoadQueueWarmupComplete = false;
    this.mobileAiSkippedTicks = 0;
    this.mobileAiAllowedTicks = 0;
    this.mobileAiEnemyIndex = 0;
    this.perfSpikeHistory = [];
    this.folsomBloodFeudTargeting = this.createFolsomBloodFeudTargetingCache();
    this.encounterZones = this.createEncounterZones(encounterZones);
    this.maxActiveByFaction = MAX_ACTIVE_BY_FACTION;
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
    return (this.collision?.canStandAtFloorPosition?.(point) ?? this.collision?.canStandAt(point)) ? point : zone.center.clone();
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
      if (!(this.collision?.canStandAtFloorPosition?.(probe) ?? this.collision?.canStandAt(probe))) return false;
    }
    return true;
  }


  createPerfStats() {
    return {
      frameStartedAt: 0,
      frames: 0,
      subsystemMs: 0,
      managerMs: 0,
      enemyUpdateMs: [],
      mixerMs: 0,
      aiMs: 0,
      targetingMs: 0,
      collisionMs: 0,
      movementMs: 0,
      combatMs: 0,
      stateMachineMs: 0,
      debugMs: 0,
      targetScans: 0,
      targetSwitches: 0,
      targetCandidatesConsidered: 0,
      targetCacheReuses: 0,
      targetCacheAgeSeconds: 0,
      targetScanRollingMs: 0,
      targetingRollingMs: 0,
      targetingWorstMs: 0,
      targetCacheSize: 0,
      predatorTargetCacheSize: 0,
      ramMenSpawned: 0, ramMenAlive: 0, ramMenDead: 0, ramMenFailed: 0,
      ramManUpdateMs: 0, ramManAiUpdates: 0, ramManAiUpdatesPerSecond: 0,
      targetingOpsThisFrame: 0,
      targetingOps: 0,
      targetingOpsPerSecond: 0,
      deferredTargetingOps: 0,
      deferredTargetingOpsPerSecond: 0,
      burstedTargetingFrames: 0,
      targetingWorkMode: 'spread one-enemy-per-frame',
      collisionChecks: 0,
      stateTransitions: 0,
      skippedAiTicks: 0,
      intentionallySkippedAiTicks: 0,
      deferredAiTicks: 0,
      droppedCatchUpTicks: 0,
      aiUpdatesRun: 0,
      combatChecks: 0,
      movementUpdates: 0,
      enemiesProcessedThisFrame: 0,
      schedulerMs: 0,
      budgetExceededFrames: 0,
      catchUpTicks: 0,
      lastSecondAt: performance?.now?.() ?? Date.now(),
      targetScansPerSecond: 0,
      targetSwitchesPerSecond: 0,
      targetCandidatesPerScan: 0,
      targetCacheReusesPerSecond: 0,
      collisionChecksPerSecond: 0,
      combatChecksPerSecond: 0,
      movementUpdatesPerSecond: 0,
      aiUpdatesRunPerSecond: 0,
      intentionallySkippedPerSecond: 0,
      deferredAiPerSecond: 0,
      droppedCatchUpPerSecond: 0,
      stateTransitionsPerSecond: 0,
      recentWorst: null,
    };
  }

  timePerf(bucket, callback) {
    const start = performance?.now?.() ?? Date.now();
    const result = callback();
    this.perfStats[bucket] += (performance?.now?.() ?? Date.now()) - start;
    return result;
  }

  resetFramePerf() {
    const now = performance?.now?.() ?? Date.now();
    const keep = {
      targetScansPerSecond: this.perfStats.targetScansPerSecond,
      targetSwitchesPerSecond: this.perfStats.targetSwitchesPerSecond,
      targetCandidatesPerScan: this.perfStats.targetCandidatesPerScan,
      targetCacheReusesPerSecond: this.perfStats.targetCacheReusesPerSecond,
      targetScanRollingMs: this.perfStats.targetScanRollingMs,
      targetingRollingMs: this.perfStats.targetingRollingMs,
      targetingWorstMs: this.perfStats.targetingWorstMs,
      targetingOpsPerSecond: this.perfStats.targetingOpsPerSecond,
      deferredTargetingOpsPerSecond: this.perfStats.deferredTargetingOpsPerSecond,
      collisionChecksPerSecond: this.perfStats.collisionChecksPerSecond,
      combatChecksPerSecond: this.perfStats.combatChecksPerSecond,
      movementUpdatesPerSecond: this.perfStats.movementUpdatesPerSecond,
      aiUpdatesRunPerSecond: this.perfStats.aiUpdatesRunPerSecond,
      intentionallySkippedPerSecond: this.perfStats.intentionallySkippedPerSecond,
      deferredAiPerSecond: this.perfStats.deferredAiPerSecond,
      droppedCatchUpPerSecond: this.perfStats.droppedCatchUpPerSecond,
      stateTransitionsPerSecond: this.perfStats.stateTransitionsPerSecond,
      ramManAiUpdatesPerSecond: this.perfStats.ramManAiUpdatesPerSecond,
      recentWorst: this.perfStats.recentWorst ?? null,
      lastSecondAt: this.perfStats.lastSecondAt,
    };
    this.perfStats = { ...this.createPerfStats(), ...keep, frameStartedAt: now };
  }

  recordNeckmanSpikeSample(now) {
    const enemyWorst = (this.perfStats.enemyUpdateMs ?? []).reduce((best, entry) => (!best || entry.ms > best.ms ? entry : best), null);
    const sample = {
      t: now,
      frame: this.perfStats.frames + 1,
      subsystemMs: this.perfStats.subsystemMs,
      managerMs: this.perfStats.managerMs,
      schedulerMs: this.perfStats.schedulerMs,
      enemyMs: enemyWorst?.ms ?? 0,
      enemyId: enemyWorst?.id ?? null,
      targetingMs: this.perfStats.targetingMs,
      movementMs: this.perfStats.movementMs,
      collisionMs: this.perfStats.collisionMs,
      combatMs: this.perfStats.combatMs,
      mixerMs: this.perfStats.mixerMs,
      stateMachineMs: this.perfStats.stateMachineMs,
      debugMs: this.perfStats.debugMs,
    };
    this.perfSpikeHistory.push(sample);
    while (this.perfSpikeHistory.length > 120 || (this.perfSpikeHistory[0] && now - this.perfSpikeHistory[0].t > 5000)) this.perfSpikeHistory.shift();
    const worst = this.perfSpikeHistory.reduce((best, entry) => (!best || entry.subsystemMs > best.subsystemMs ? entry : best), null);
    this.perfStats.recentWorst = worst ? { ...worst, ageFrames: Math.max(0, this.perfStats.frames + 1 - worst.frame), ageSeconds: Math.max(0, (now - worst.t) / 1000) } : null;
  }

  finishFramePerf() {
    const now = performance?.now?.() ?? Date.now();
    this.perfStats.subsystemMs = now - this.perfStats.frameStartedAt;
    this.recordNeckmanSpikeSample(now);
    this.perfStats.frames += 1;
    if (now - this.perfStats.lastSecondAt >= 1000) {
      const scale = 1000 / Math.max(1, now - this.perfStats.lastSecondAt);
      this.perfStats.targetScansPerSecond = Math.round(this.perfStats.targetScans * scale);
      this.perfStats.collisionChecksPerSecond = Math.round(this.perfStats.collisionChecks * scale);
      this.perfStats.combatChecksPerSecond = Math.round(this.perfStats.combatChecks * scale);
      this.perfStats.movementUpdatesPerSecond = Math.round(this.perfStats.movementUpdates * scale);
      this.perfStats.aiUpdatesRunPerSecond = Math.round(this.perfStats.aiUpdatesRun * scale);
      this.perfStats.intentionallySkippedPerSecond = Math.round(this.perfStats.intentionallySkippedAiTicks * scale);
      this.perfStats.deferredAiPerSecond = Math.round(this.perfStats.deferredAiTicks * scale);
      this.perfStats.droppedCatchUpPerSecond = Math.round(this.perfStats.droppedCatchUpTicks * scale);
      this.perfStats.targetSwitchesPerSecond = Math.round(this.perfStats.targetSwitches * scale);
      this.perfStats.targetingOpsPerSecond = Math.round(this.perfStats.targetingOps * scale);
      this.perfStats.deferredTargetingOpsPerSecond = Math.round(this.perfStats.deferredTargetingOps * scale);
      this.perfStats.targetCacheReusesPerSecond = Math.round(this.perfStats.targetCacheReuses * scale);
      this.perfStats.targetCandidatesPerScan = this.perfStats.targetScans > 0 ? Number((this.perfStats.targetCandidatesConsidered / this.perfStats.targetScans).toFixed(1)) : 0;
      this.perfStats.stateTransitionsPerSecond = Math.round(this.perfStats.stateTransitions * scale);
      this.perfStats.ramManAiUpdatesPerSecond = Math.round((this.perfStats.ramManAiUpdates ?? 0) * scale);
      this.perfStats.targetScans = 0;
      this.perfStats.collisionChecks = 0;
      this.perfStats.combatChecks = 0;
      this.perfStats.movementUpdates = 0;
      this.perfStats.aiUpdatesRun = 0;
      this.perfStats.intentionallySkippedAiTicks = 0;
      this.perfStats.deferredAiTicks = 0;
      this.perfStats.droppedCatchUpTicks = 0;
      this.perfStats.stateTransitions = 0;
      this.perfStats.ramManAiUpdates = 0;
      this.perfStats.targetSwitches = 0;
      this.perfStats.targetingOps = 0;
      this.perfStats.deferredTargetingOps = 0;
      this.perfStats.targetCandidatesConsidered = 0;
      this.perfStats.targetCacheReuses = 0;
      this.perfStats.lastSecondAt = now;
    }
  }

  createFolsomBloodFeudTargetingCache() {
    return {
      candidates: [],
      preyCandidates: [],
      predatorCandidates: [],
      elapsed: FOLSOM_BLOOD_FEUD_TARGET_SCAN_SECONDS,
      lastBuiltAt: performance?.now?.() ?? Date.now(),
      scanFrameUsed: false,
      nextEnemyIndex: 0,
      opsThisFrame: 0,
      perfStats: null,
    };
  }

  updateFolsomBloodFeudTargetingCache(deltaSeconds) {
    const cache = this.folsomBloodFeudTargeting;
    if (!cache) return null;
    cache.perfStats = this.perfStats;
    cache.scanFrameUsed = false;
    cache.opsThisFrame = 0;
    this.perfStats.targetingOpsThisFrame = 0;
    this.perfStats.targetCacheAgeSeconds = ((performance?.now?.() ?? Date.now()) - cache.lastBuiltAt) / 1000;
    if (this.perfDebugToggles?.neckmanTargetingOff === true) {
      cache.candidates.length = 0;
      cache.preyCandidates.length = 0;
      cache.predatorCandidates.length = 0;
      this.perfStats.targetCacheSize = 0;
      this.perfStats.predatorTargetCacheSize = 0;
      return cache;
    }
    // Folsom blood-feud targeting has exactly three authored Neckmen. Keep one shared,
    // stable living list and refresh it incrementally from the enemy registry only;
    // never scan scene objects, meshes, colliders, paths, or LOS during targeting.
    cache.elapsed += deltaSeconds;
    if (cache.elapsed >= FOLSOM_BLOOD_FEUD_TARGET_SCAN_SECONDS || cache.candidates.length === 0) {
      cache.elapsed = 0;
      const start = performance?.now?.() ?? Date.now();
      cache.candidates.length = 0;
      cache.preyCandidates.length = 0;
      cache.predatorCandidates.length = 0;
      let considered = 0;
      for (let i = 0; i < this.enemies.length; i += 1) {
        const enemy = this.enemies[i];
        if (!enemy || enemy.encounterMode !== 'folsom_neckman_blood_feud') continue;
        if (enemy.species !== 'neck_man' && enemy.species !== 'ram_man') continue;
        considered += 1;
        if (enemy.isAlive && !enemy.isRemoved && enemy.group) {
          if (enemy.species === 'neck_man') { cache.candidates.push(enemy); cache.predatorCandidates.push(enemy); }
          if (enemy.species === 'ram_man') cache.preyCandidates.push(enemy);
        }
      }
      const elapsedMs = (performance?.now?.() ?? Date.now()) - start;
      this.perfStats.targetScans += 1;
      this.perfStats.targetCandidatesConsidered += considered;
      this.perfStats.targetScanRollingMs = this.perfStats.targetScanRollingMs > 0
        ? (this.perfStats.targetScanRollingMs * 0.85) + (elapsedMs * 0.15)
        : elapsedMs;
      cache.lastBuiltAt = performance?.now?.() ?? Date.now();
      this.perfStats.targetCacheAgeSeconds = 0;
    }
    this.perfStats.targetCacheSize = cache.preyCandidates.length || cache.candidates.length;
    this.perfStats.predatorTargetCacheSize = cache.predatorCandidates.length;
    return cache;
  }

  requestFolsomTargetingOperation(enemy) {
    const cache = this.folsomBloodFeudTargeting;
    if (!cache || this.perfDebugToggles?.neckmanTargetingOff === true) return false;
    if (cache.opsThisFrame >= FOLSOM_BLOOD_FEUD_MAX_TARGETING_OPS_PER_FRAME) return false;
    const candidates = enemy?.species === 'neck_man' && this.perfDebugToggles?.neckmanTargetRamMen !== false && cache.preyCandidates.length ? cache.preyCandidates : cache.candidates;
    const count = candidates.length;
    if (count > 1) {
      const expected = candidates[cache.nextEnemyIndex % count];
      if (expected !== enemy && enemy.currentTarget?.type === 'enemy' && enemy.isTargetStillValid({ folsomBloodFeudTargeting: cache })) return false;
      cache.nextEnemyIndex = (cache.nextEnemyIndex + 1) % count;
    }
    cache.opsThisFrame += 1;
    cache.scanFrameUsed = true;
    this.perfStats.targetingOpsThisFrame = cache.opsThisFrame;
    this.perfStats.targetingOps += 1;
    if (cache.opsThisFrame > 1) this.perfStats.burstedTargetingFrames += 1;
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

  spawnRamManHerd(anchors = []) {
    if (this.encounterMode !== 'folsom_neckman_blood_feud' || this.perfDebugToggles?.ramHerd === false) return 0;
    const herdAnchors = anchors.filter((anchor) => anchor.preferredFaction === 'ram_man').slice(0, FOLSOM_RAM_MAN_HERD_MAX);
    herdAnchors.forEach((anchor) => {
      const enemy = new BlackGrassFactionEnemy({
        scene: this.scene,
        collision: this.collision,
        navigationGraph: this.navigationGraph,
        outdoorVisibleSurfaceSampler: this.outdoorVisibleSurfaceSampler,
        species: 'ram_man',
        id: `${anchor.id ?? 'folsom-ram-man'}-${this.spawnSerial += 1}`,
        spawnAnchor: anchor,
        patrolPoints: anchor.patrolPoints,
        onLoaded: () => this.logDevStatus('folsom-ram-man-loaded'),
        onGoreEvent: this.onGoreEvent,
        encounterMode: this.encounterMode,
      });
      enemy.lifecycle.state = 'pendingLoad';
      this.enemies.push(enemy);
      this.mobileLoadQueue.push(enemy);
    });
    this.pumpMobileLoadQueue();
    return herdAnchors.length;
  }

  spawnInitialAnchors(anchors = this.anchors.filter((anchor) => anchor.initialWave)) {
    let spawnedCount = 0;
    anchors
      .filter((anchor) => FACTIONS[anchor.preferredFaction])
      .forEach((anchor) => {
        const species = anchor.preferredFaction;
        const enemy = new BlackGrassFactionEnemy({
          scene: this.scene,
          collision: this.collision,
          navigationGraph: this.navigationGraph,
          outdoorVisibleSurfaceSampler: this.outdoorVisibleSurfaceSampler,
          species,
          id: `${anchor.id ?? 'generated-anchor'}-${species}-${this.spawnSerial += 1}`,
          spawnAnchor: anchor,
          patrolPoints: anchor.patrolPoints,
          onLoaded: () => this.logDevStatus('enemy-loaded'),
          onGoreEvent: this.onGoreEvent,
          encounterMode: this.encounterMode,
        });
        this.enemies.push(enemy);
        spawnedCount += 1;
        if (this.encounterMode === 'folsom_neckman_blood_feud') {
          enemy.lifecycle.state = 'pendingLoad';
          this.mobileLoadQueue.push(enemy);
        } else {
          enemy.load();
        }
      });
    if (this.encounterMode === 'folsom_neckman_blood_feud') this.pumpMobileLoadQueue();
    this.initialWaveSpawned = true;
    if (IS_DEV && this.encounterMode === 'folsom_neckman_blood_feud') {
      console.info(`[FolsomBloodFeud] spawned initial neckmen: ${spawnedCount}`);
    }
  }

  pumpMobileLoadQueue() {
    if (this.encounterMode !== 'folsom_neckman_blood_feud') return;
    const budget = MOBILE_ENEMY_BUDGETS.folsomNeckmanBloodFeud;
    if (this.mobileLoadQueueActive >= budget.loadQueueConcurrency) return;
    const enemy = this.mobileLoadQueue.shift();
    if (!enemy) {
      this.mobileLoadQueueWarmupComplete = this.enemies.length > 0 && this.enemies.every((candidate) => ['active', 'failed', 'disposed'].includes(candidate.lifecycle?.state));
      return;
    }
    this.mobileLoadQueueActive += 1;
    enemy.load().finally(() => {
      this.mobileLoadQueueActive = Math.max(0, this.mobileLoadQueueActive - 1);
      setTimeout(() => this.pumpMobileLoadQueue(), budget.loadStaggerMs);
    });
  }

  update(deltaSeconds, playerPosition, options = {}) {
    const isMobileFolsomFeud = this.encounterMode === 'folsom_neckman_blood_feud';
    if (isMobileFolsomFeud) this.resetFramePerf();
    const managerStart = performance?.now?.() ?? Date.now();
    this.pumpMobileLoadQueue();
    const schedulerStart = performance?.now?.() ?? Date.now();
    let folsomAiEnemyIndex = -1;
    let mobileAiTickAllowed = !isMobileFolsomFeud;
    if (isMobileFolsomFeud) {
      // Mobile Folsom Neckmen do not accrue AI debt. Each render frame may run at
      // most one expensive behavior slice; missed cadence is dropped instead of
      // recovered in a later catch-up burst.
      if (deltaSeconds > FOLSOM_BLOOD_FEUD_AI_TICK_SECONDS * 1.5) this.perfStats.droppedCatchUpTicks += 1;
      const livingCount = this.enemies.filter((enemy) => enemy?.isAlive && enemy.group && !enemy.isRemoved).length;
      const elapsedMs = (performance?.now?.() ?? Date.now()) - managerStart;
      mobileAiTickAllowed = livingCount > 0
        && this.perfDebugToggles?.neckmanAiOff !== true
        && elapsedMs < FOLSOM_BLOOD_FEUD_FRAME_BUDGET_MS
        && FOLSOM_BLOOD_FEUD_MAX_BEHAVIOR_SLICES_PER_FRAME > 0;
      if (mobileAiTickAllowed) {
        const count = Math.max(1, this.enemies.length);
        for (let attempts = 0; attempts < count; attempts += 1) {
          const candidateIndex = this.mobileAiEnemyIndex % count;
          this.mobileAiEnemyIndex = (this.mobileAiEnemyIndex + 1) % count;
          const candidate = this.enemies[candidateIndex];
          if (candidate?.species === 'neck_man' && candidate?.isAlive && candidate.group && !candidate.isRemoved) {
            folsomAiEnemyIndex = candidateIndex;
            this.mobileAiAllowedTicks += 1;
            break;
          }
        }
      }
      if (folsomAiEnemyIndex < 0) this.perfStats.deferredAiTicks += livingCount;
    }
    if (isMobileFolsomFeud) this.perfStats.schedulerMs += (performance?.now?.() ?? Date.now()) - schedulerStart;
    if (isMobileFolsomFeud && this.perfDebugToggles?.neckmanFeudOff === true) {
      this.enemies.forEach((enemy) => { enemy.currentTarget = null; });
      this.perfStats.managerMs = (performance?.now?.() ?? Date.now()) - managerStart;
      this.finishFramePerf();
      return;
    }
    const generatedRuntime = options.generatedRuntime ?? null;
    const director = this.enableBattleDirector
      ? this.updateBattleDirector(deltaSeconds, playerPosition)
      : { zone: null, nearbyCount: this.enemies.length, combatPairs: 0, quietSeconds: 0 };
    const folsomBloodFeudTargeting = isMobileFolsomFeud ? this.updateFolsomBloodFeudTargetingCache(deltaSeconds) : null;
    const baseContext = { enemies: this.enemies, playerPosition, director, generatedRuntime: Boolean(generatedRuntime), folsomBloodFeudTargeting, requestFolsomTargetingOperation: (enemy) => this.requestFolsomTargetingOperation(enemy) };
    const policy = generatedRuntime?.policy ?? null;
    const lodEnabled = Boolean(generatedRuntime && policy?.generatedAiLod);
    this.enemies.forEach((enemy, index) => {
      if (!lodEnabled || !enemy.group || enemy.isRemoved || !enemy.isAlive) {
        const enemyStart = performance?.now?.() ?? Date.now();
        const ramManAiAllowed = isMobileFolsomFeud && enemy.species === 'ram_man' ? (this.perfDebugToggles?.rammanAiOff !== true && this.perfStats.frames % 3 === index % 3) : null;
        enemy.update(deltaSeconds, { ...baseContext, aiTickAllowed: ramManAiAllowed ?? (this.perfDebugToggles?.neckmanAiOff === true ? false : (isMobileFolsomFeud ? index === folsomAiEnemyIndex : mobileAiTickAllowed)), folsomBehaviorSlice: isMobileFolsomFeud && index === folsomAiEnemyIndex, perfStats: this.perfStats, perfDebugToggles: this.perfDebugToggles });
        if (isMobileFolsomFeud && (index === folsomAiEnemyIndex || ramManAiAllowed)) this.perfStats.enemiesProcessedThisFrame += 1;
        if (isMobileFolsomFeud) {
          const elapsedEnemyMs = (performance?.now?.() ?? Date.now()) - enemyStart;
          this.perfStats.enemyUpdateMs.push({ id: enemy.id, ms: elapsedEnemyMs });
          if (enemy.species === 'ram_man') this.perfStats.ramManUpdateMs += elapsedEnemyMs;
          if (index === folsomAiEnemyIndex && elapsedEnemyMs > FOLSOM_BLOOD_FEUD_FRAME_BUDGET_MS) this.perfStats.budgetExceededFrames += 1;
        }
        return;
      }
      const distance = playerPosition ? horizontalDistance(enemy.group.position, playerPosition) : Infinity;
      const isCombatRelevant = enemy.playerRevengeTimer > 0
        || enemy.behaviorState === 'attack_player_fallback'
        || enemy.behaviorState === 'attack_enemy_faction'
        || enemy.behaviorState === 'jump_attack_enemy_faction'
        || enemy.currentTarget?.type === 'player';
      let updateTier = 'sleep';
      if (isCombatRelevant || distance <= policy.aiNearRadius) updateTier = 'near';
      else if (distance <= policy.aiMidRadius) updateTier = 'mid';
      const interval = updateTier === 'near' ? 0 : updateTier === 'mid' ? 0.16 : 0.5;
      enemy.generatedAiElapsed = (enemy.generatedAiElapsed ?? (index % 3) * 0.055) + deltaSeconds;
      const aiTickAllowed = mobileAiTickAllowed && (updateTier === 'near' || enemy.generatedAiElapsed >= interval);
      if (aiTickAllowed) enemy.generatedAiElapsed = 0;
      const enemyStart = performance?.now?.() ?? Date.now();
      enemy.update(deltaSeconds, { ...baseContext, updateTier, aiTickAllowed, perfStats: this.perfStats, perfDebugToggles: this.perfDebugToggles });
      if (isMobileFolsomFeud) this.perfStats.enemyUpdateMs.push({ id: enemy.id, ms: (performance?.now?.() ?? Date.now()) - enemyStart });
    });
    this.updateDevStatus(deltaSeconds);

    if (this.encounterMode === 'folsom_neckman_blood_feud') {
      this.perfStats.managerMs = (performance?.now?.() ?? Date.now()) - managerStart;
      if (this.perfDebugToggles?.neckmanFeudOff !== true) this.timePerf('debugMs', () => this.updateFolsomNeckmanBloodFeud(deltaSeconds));
      this.enemies = this.enemies.filter((enemy) => !enemy.isRemoved || enemy.isAlive);
      this.finishFramePerf();
      return;
    }

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


  updateFolsomNeckmanBloodFeud(deltaSeconds) {
    const living = this.getLivingEnemies('neck_man');
    if (living.length > 1) {
      this.bloodFeudRespawnTimer = null;
      living.forEach((enemy) => {
        if (!enemy.currentTarget || !enemy.isTargetStillValid({ enemies: living, playerPosition: null })) enemy.forceFolsomBloodFeudRetarget?.();
      });
      return;
    }
    if (living.length !== 1) return;
    if (this.bloodFeudRespawnTimer === null) {
      this.bloodFeudRespawnTimer = this.respawnCooldownSeconds;
      if (IS_DEV) console.info(`[FolsomBloodFeud] living count: ${living.length} when the respawn timer starts`);
      return;
    }
    this.bloodFeudRespawnTimer -= deltaSeconds;
    if (this.bloodFeudRespawnTimer > 0) return;

    const livingIds = new Set(living.map((enemy) => enemy.spawnAnchor?.id));
    const missingAnchors = this.anchors.filter((anchor) => anchor.preferredFaction === 'neck_man' && !livingIds.has(anchor.id)).slice(0, 2);
    if (IS_DEV) console.info(`[FolsomBloodFeud] living count: ${living.length} when the respawn timer completes`);
    missingAnchors.forEach((anchor) => {
      const enemy = new BlackGrassFactionEnemy({
        scene: this.scene,
        collision: this.collision,
        navigationGraph: this.navigationGraph,
        outdoorVisibleSurfaceSampler: this.outdoorVisibleSurfaceSampler,
        species: 'neck_man',
        id: anchor.id,
        spawnAnchor: anchor,
        patrolPoints: anchor.patrolPoints,
        onLoaded: () => this.logDevStatus('folsom-blood-feud-respawn-loaded'),
        onGoreEvent: this.onGoreEvent,
        encounterMode: this.encounterMode,
      });
      this.enemies.push(enemy);
      if (this.encounterMode === 'folsom_neckman_blood_feud') {
        enemy.lifecycle.state = 'pendingLoad';
        this.mobileLoadQueue.push(enemy);
      } else {
        enemy.load();
      }
    });
    this.pumpMobileLoadQueue();
    this.bloodFeudRespawnTimer = null;
    this.enemies.forEach((enemy) => { enemy.forceFolsomBloodFeudRetarget?.(); });
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
        outdoorVisibleSurfaceSampler: this.outdoorVisibleSurfaceSampler,
        species,
        id: `black-grass-temple-${species}-${this.spawnSerial += 1}`,
        spawnAnchor: anchor,
        patrolPoints: anchor.patrolPoints,
        onLoaded: () => this.logDevStatus('enemy-loaded'),
        onGoreEvent: this.onGoreEvent,
        encounterMode: this.encounterMode,
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

  getMobileRuntimeSummary() {
    const enemies = this.enemies ?? [];
    const byState = (state, species = null) => enemies.filter((enemy) => (!species || enemy.species === species) && enemy.lifecycle?.state === state).length;
    const neckmen = enemies.filter((enemy) => enemy.species === 'neck_man');
    const ramMen = enemies.filter((enemy) => enemy.species === 'ram_man');
    return {
      encounterMode: this.encounterMode,
      warmupComplete: this.encounterMode === 'folsom_neckman_blood_feud' ? this.mobileLoadQueueWarmupComplete : true,
      queueDepth: this.mobileLoadQueue.length,
      queueActive: this.mobileLoadQueueActive,
      enemyAiTickRate: this.encounterMode === 'folsom_neckman_blood_feud' ? 'one-enemy-per-frame no-catch-up' : 'legacy faction-war variable',
      skippedAiTicks: this.mobileAiSkippedTicks,
      allowedAiTicks: this.mobileAiAllowedTicks,
      spawnedNeckmen: neckmen.length,
      ramManHerd: { enabled: this.perfDebugToggles?.ramHerd !== false, spawned: ramMen.length, alive: ramMen.filter((enemy) => enemy.isAlive).length, dead: ramMen.filter((enemy) => enemy.behaviorState === 'dead' || (!enemy.isAlive && enemy.lifecycle?.state !== 'failed')).length, failed: byState('failed', 'ram_man'), assetStrategy: [...new Set(ramMen.map((enemy) => enemy.animation?.getAssetStrategy?.() ?? 'pending'))].join(',') || 'none', canonicalPath: RAM_MAN_CANONICAL_MOBILE_MODEL_FILE, actorRoots: ramMen.filter((enemy) => enemy.actor?.group).length, skinnedRoots: ramMen.reduce((sum, enemy) => sum + (enemy.animation?.getLiveSkinnedRootCount?.() ?? 0), 0), mixers: ramMen.reduce((sum, enemy) => sum + (enemy.animation?.getActiveMixerCount?.() ?? 0), 0), updateMs: this.perfStats.ramManUpdateMs, aiUpdatesPerSecond: this.perfStats.ramManAiUpdatesPerSecond },
      pendingLoadNeckmen: byState('pendingLoad', 'neck_man'),
      loadingNeckmen: byState('loading', 'neck_man'),
      loadedNeckmen: neckmen.filter((enemy) => ['loaded', 'visible', 'active'].includes(enemy.lifecycle?.state) || enemy.isLoaded).length,
      visibleNeckmen: neckmen.filter((enemy) => enemy.group?.visible).length,
      failedNeckmen: byState('failed', 'neck_man'),
      sleepingEnemies: byState('sleeping'),
      loadedActorRoots: enemies.filter((enemy) => enemy.actor?.group).length,
      loadedAnimationRoots: enemies.reduce((sum, enemy) => sum + (enemy.animation?.getLoadedRootCount?.() ?? 0), 0),
      liveSkinnedRoots: enemies.reduce((sum, enemy) => sum + (enemy.animation?.getLiveSkinnedRootCount?.() ?? 0), 0),
      extraStateRootsAlive: enemies.some((enemy) => enemy.animation?.hasExtraStateRootsAlive?.()),
      assetStrategy: [...new Set(neckmen.map((enemy) => enemy.animation?.getAssetStrategy?.() ?? 'unknown'))].join(',') || 'none',
      canonicalPath: NECK_MAN_CANONICAL_MOBILE_MODEL_FILE,
      clipsActionsPerEnemy: neckmen.map((enemy) => ({ id: enemy.id, strategy: enemy.animation?.getAssetStrategy?.() ?? 'unknown', canonicalPath: enemy.animation?.getCanonicalPath?.() ?? null, clips: enemy.animation?.getLoadedStates?.().length ?? 0, actions: enemy.animation?.getActionCount?.() ?? 0 })),
      activeMixers: enemies.reduce((sum, enemy) => sum + (enemy.animation?.getActiveMixerCount?.() ?? 0), 0),
      loadFailures: enemies.map((enemy) => enemy.loadFailure).filter(Boolean),
      loadedStatesPerEnemy: neckmen.map((enemy) => ({ id: enemy.id, lifecycle: enemy.lifecycle?.state, states: enemy.animation?.getLoadedStates?.() ?? enemy.lifecycle?.loadedStates ?? [], failure: enemy.loadFailure ?? null })),
      perfDebugFlags: this.perfDebugToggles ?? {},
      actorVisible: neckmen.every((enemy) => enemy.group?.visible !== false),
      mixersActive: (this.perfDebugToggles?.neckmanStatic !== true),
      aiActive: this.perfDebugToggles?.neckmanAiOff !== true,
      feudManagerActive: this.perfDebugToggles?.neckmanFeudOff !== true,
      targetingActive: this.perfDebugToggles?.neckmanTargetingOff !== true,
      collisionActive: this.perfDebugToggles?.neckmanCollisionOff !== true,
      movementActive: this.perfDebugToggles?.neckmanMovementOff !== true,
      combatActive: this.perfDebugToggles?.neckmanCombatOff !== true,
      stateMachineActive: this.perfDebugToggles?.neckmanStateMachineOff !== true,
      perfTrace: this.perfStats,
      targetSummary: neckmen.map((enemy) => ({ id: enemy.id, target: enemy.group?.userData.targetId ?? null, type: enemy.group?.userData.targetType ?? null, targetSpecies: enemy.group?.userData.targetSpecies ?? null, lock: enemy.group?.userData.targetLockRemaining ?? 0 })),
    };
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
