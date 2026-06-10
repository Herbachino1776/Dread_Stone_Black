import * as THREE from 'three';

export const SHEEP_DEMON_ANIMATION_FILES = Object.freeze({
  idle: './assets/enemies/sheep_demon/sheep_demon_01_optimized_idle.glb',
  walk: './assets/enemies/sheep_demon/sheep_demon_01_optimized_walk.glb',
  crouch_walk: './assets/enemies/sheep_demon/sheep_demon_01_optimized_crouch_walk.glb',
  run: './assets/enemies/sheep_demon/sheep_demon_01_optimized_run.glb',
  punch_left: './assets/enemies/sheep_demon/sheep_demon_01_optimized_punch_left.glb',
  jump: './assets/enemies/sheep_demon/sheep_demon_01_optimized_jump.glb',
  die: './assets/enemies/sheep_demon/sheep_demon_01_optimized_die.glb',
});

export const SHEEP_DEMON_STATE_TO_ANIMATION = Object.freeze({
  idle: 'idle',
  patrol: 'walk',
  alert: 'walk',
  chase: 'run',
  stalk: 'crouch_walk',
  attack: 'punch_left',
  jump: 'jump',
  hurt_optional_placeholder: 'idle',
  dead: 'die',
});

export const SHEEP_DEMON_FACTION_STATE_TO_ANIMATION = Object.freeze({
  spawn: 'idle',
  patrol: 'walk',
  investigate_enemy_faction: 'walk',
  seek_enemy_faction: 'run',
  combat_enter: 'walk',
  combat_circle: 'crouch_walk',
  combat_feint: 'crouch_walk',
  combat_lunge: 'run',
  attack_enemy_faction: 'punch_left',
  jump_attack_enemy_faction: 'jump',
  defensive_backstep: 'crouch_walk',
  defensive_strafe: 'crouch_walk',
  recover: 'idle',
  seek_player_fallback: 'walk',
  attack_player_fallback: 'punch_left',
  dead: 'die',
});

const SHEEP_DEMON_NEUTRAL_COLOR = new THREE.Color(0xffffff);
const SHEEP_DEMON_SHADOW_FILL = new THREE.Color(0x101217);

export const sheepDemonConfig = Object.freeze({
  id: 'sheep_demon',
  identity: Object.freeze({
    id: 'sheep_demon',
    displayName: 'Sheep Demon',
    species: 'sheep_demon',
    role: 'faction_enemy',
    factionId: 'sheep_demon',
    opposingFactionId: 'neck_man',
    tags: Object.freeze(['enemy', 'black_grass_temple', 'prototype_creature']),
  }),
  assets: Object.freeze({
    basePath: './assets/enemies/sheep_demon/',
    animationFiles: SHEEP_DEMON_ANIMATION_FILES,
    expectedAnimations: Object.freeze(Object.keys(SHEEP_DEMON_ANIMATION_FILES)),
    fallbackAnimations: Object.freeze({
      hurt: 'idle',
      talk: 'idle',
      special: 'jump',
      attack: 'punch_left',
      dead: 'die',
    }),
    materialMetadata: Object.freeze({
      note: 'High-contrast low-sepia pass for readability under Black Grass Temple lighting.',
    }),
  }),
  scale: Object.freeze({
    targetHeight: 2.18,
    maxWidth: 1.5,
    groundOffset: 0,
    yOffset: 0,
    rotationOffset: 0,
    scaleMultiplier: 1,
    bodyRadius: 0.58,
  }),
  animationProfile: Object.freeze({
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    attack: 'punch_left',
    jump: 'jump',
    die: 'die',
    talk: 'idle',
    special: 'jump',
    stateToAnimation: SHEEP_DEMON_STATE_TO_ANIMATION,
    factionStateToAnimation: SHEEP_DEMON_FACTION_STATE_TO_ANIMATION,
    fallbackMapping: Object.freeze({
      alert: 'walk',
      hurt_optional_placeholder: 'idle',
      attack_player_fallback: 'punch_left',
      attack_enemy_faction: 'punch_left',
      dead: 'die',
    }),
    defaultFadeSeconds: 0.12,
    fadeDurations: Object.freeze({
      attack: 0.12,
      jump: 0.1,
      dead: 0.1,
    }),
    minimumHoldTimes: Object.freeze({
      patrol: 0.8,
      chase: 0.7,
      stalk: 0.55,
    }),
    disabledAnimations: Object.freeze([]),
    rareAnimations: Object.freeze(['jump']),
    attackAnimationChoices: Object.freeze(['punch_left']),
    oneShotStates: Object.freeze(['punch_left', 'jump', 'die']),
  }),
  materialProfile: Object.freeze({
    id: 'sheep_demon_high_contrast_low_sepia',
    cloneMaterials: true,
    tint: 0xffffff,
    emissive: SHEEP_DEMON_SHADOW_FILL,
    emissiveIntensity: 0.12,
    roughness: 0.84,
    metalness: 0.02,
    adjustMaterial(material, child, summary) {
      if (material.color instanceof THREE.Color && !material.color.equals(SHEEP_DEMON_NEUTRAL_COLOR)) {
        summary.neutralizedColorMultipliers = (summary.neutralizedColorMultipliers ?? 0) + 1;
        material.color.copy(SHEEP_DEMON_NEUTRAL_COLOR);
      }
      if ('emissiveIntensity' in material) {
        material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.12);
      }
      if ('roughness' in material) {
        material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.82, 0.78, 0.92);
      }
      if ('metalness' in material) {
        material.metalness = Math.min(material.metalness ?? 0, 0.02);
      }
    },
  }),
  combatProfile: Object.freeze({
    maxHealth: 45,
    attackDamage: 12,
    playerAttackDamage: 15,
    playerAttackRange: 2.85,
    playerAttackArcRadians: THREE.MathUtils.degToRad(72),
    attackRange: 2.35,
    visualContactRange: 1.82,
    attackImpactRange: 1.98,
    attackCommitRange: 2.72,
    attackCooldown: 1.65,
    attackCooldownSeconds: 1.65,
    damageWindow: Object.freeze({ start: 0.4, end: 0.65 }),
    punchDamageWindow: Object.freeze({ start: 0.4, end: 0.65 }),
    lungeDistance: 0.72,
    desiredCombatDistance: 2.12,
    tooCloseDistance: 1.04,
    bodySeparation: 0.98,
    minimumBodySeparation: 0.98,
    jumpAttackChance: 0.18,
    defensiveManeuverChance: 0.2,
    offensiveLungeChance: 0.62,
    turnSpeed: 5.8,
  }),
  aiProfile: Object.freeze({
    behaviorType: 'faction_combatant',
    detectionRanges: Object.freeze({
      detectionRadius: 22,
      chaseRunRadius: 13.5,
      stalkRadius: 6.2,
      loseInterestRadius: 32,
      combatEngageDistance: 6.2,
    }),
    targetPriority: Object.freeze(['opposing_faction', 'player_fallback', 'patrol']),
    playerFallbackRules: Object.freeze({ detectionRadius: 13.5, revengeSeconds: 6 }),
    factionPriorityRules: Object.freeze({ opposingFactionId: 'neck_man' }),
    navigationPreferences: Object.freeze({ walkSpeed: 0.82, seekSpeed: 1.55, clearanceRadius: 0.58 }),
    patrolBehavior: Object.freeze({ pauseSeconds: 0.65 }),
    combatManeuverPreferences: Object.freeze({
      jumpAttackChance: 0.18,
      defensiveManeuverChance: 0.2,
      offensiveLungeChance: 0.62,
    }),
  }),
  spawnProfile: Object.freeze({
    metadataOnly: true,
    placement: 'Standalone R04 encounter and Black Grass Temple faction-war anchors.',
    initialFactionWave: 1,
    maxActiveFactionCount: 2,
  }),
  debugProfile: Object.freeze({
    showBounds: false,
    showGrounding: false,
    showAttackRange: false,
    showTargetLine: false,
    showCurrentAnimation: true,
    showCurrentState: true,
  }),
});
