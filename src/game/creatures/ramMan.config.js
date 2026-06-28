export const RAM_MAN_CANONICAL_MOBILE_MODEL_FILE = './assets/npcs/ram_man_friendly_01_optimized.glb';
export const RAM_MAN_MOBILE_CLIP_NAMES = Object.freeze(['idle', 'walk', 'die']);
export const RAM_MAN_MOBILE_CLIP_MAP = Object.freeze({ idle: 'idle', walk: 'walk', die: 'idle' });

export const RAM_MAN_ANIMATION_FILES = Object.freeze({
  idle: './assets/npcs/ram_man/ram_man_friendly_idle_01.glb',
  walk: './assets/npcs/ram_man/ram_man_friendly_walk_01.glb',
  die: './assets/npcs/ram_man/ram_man_friendly_idle_01.glb',
});

export const RAM_MAN_PREY_STATE_TO_ANIMATION = Object.freeze({
  spawn: 'idle',
  patrol: 'walk',
  investigate_enemy_faction: 'walk',
  seek_enemy_faction: 'walk',
  combat_enter: 'walk',
  combat_circle: 'walk',
  combat_feint: 'walk',
  combat_lunge: 'walk',
  attack_enemy_faction: 'idle',
  jump_attack_enemy_faction: 'idle',
  defensive_backstep: 'walk',
  defensive_strafe: 'walk',
  recover: 'idle',
  seek_player_fallback: 'walk',
  attack_player_fallback: 'idle',
  dead: 'die',
});

export const ramManConfig = Object.freeze({
  id: 'ram_man',
  identity: Object.freeze({
    id: 'ram_man',
    displayName: 'Ram Man',
    species: 'ram_man',
    role: 'prey_neutral_herd',
    factionId: 'ram_man',
    opposingFactionId: 'neck_man',
    tags: Object.freeze(['prey', 'neutral', 'herd', 'folsom', 'mobile-safe']),
  }),
  assets: Object.freeze({
    basePath: './assets/npcs/',
    canonicalModelFile: RAM_MAN_CANONICAL_MOBILE_MODEL_FILE,
    mobileModelFile: RAM_MAN_CANONICAL_MOBILE_MODEL_FILE,
    clipBundle: Object.freeze({
      strategy: 'canonical-multiclip-pending-die',
      modelFile: RAM_MAN_CANONICAL_MOBILE_MODEL_FILE,
      requiredClips: RAM_MAN_MOBILE_CLIP_NAMES,
      clipMap: RAM_MAN_MOBILE_CLIP_MAP,
      legacyFallback: 'singleActorRoot-existing-friendly-ram-man',
      note: 'Repo has a RamMan optimized GLB and separate idle/walk GLBs, but no authored die GLB yet; die safely falls back to idle until the canonical herd bundle is rebuilt.',
    }),
    mobileClipNames: RAM_MAN_MOBILE_CLIP_NAMES,
    animationFiles: RAM_MAN_ANIMATION_FILES,
    legacyAnimationFiles: RAM_MAN_ANIMATION_FILES,
    expectedAnimations: RAM_MAN_MOBILE_CLIP_NAMES,
    fallbackAnimations: Object.freeze({ run: 'walk', flee: 'walk', hit: 'idle', attack: 'idle', jump: 'idle', special: 'idle', dead: 'die' }),
  }),
  scale: Object.freeze({ targetHeight: 1.72, maxWidth: 1.15, groundOffset: 0, yOffset: 0, rotationOffset: 0, scaleMultiplier: 1, bodyRadius: 0.42 }),
  animationProfile: Object.freeze({
    idle: 'idle', walk: 'walk', run: 'walk', attack: 'idle', jump: 'idle', die: 'die', special: 'idle',
    mobileClipMap: RAM_MAN_MOBILE_CLIP_MAP,
    factionStateToAnimation: RAM_MAN_PREY_STATE_TO_ANIMATION,
    fallbackMapping: Object.freeze({ patrol: 'walk', defensive_backstep: 'walk', defensive_strafe: 'walk', dead: 'die' }),
    defaultFadeSeconds: 0.16,
    minimumHoldTimes: Object.freeze({ idle: 0.25, walk: 0.25 }),
    disabledAnimations: Object.freeze(['attack', 'jump']),
    rareAnimations: Object.freeze([]),
    attackAnimationChoices: Object.freeze([]),
    oneShotStates: Object.freeze([]),
  }),
  materialProfile: Object.freeze({ id: 'ram_man_folsom_herd_mobile_lite', cloneMaterials: true }),
  combatProfile: Object.freeze({ maxHealth: 20, attackDamage: 0, playerAttackDamage: 0, playerAttackRange: 1.2, attackRange: 0, visualContactRange: 0.65, attackCommitRange: 0, attackImpactRange: 0, lungeDistance: 0, minimumBodySeparation: 0.55, desiredCombatDistance: 0, tooCloseDistance: 0, defensiveManeuverChance: 0, offensiveLungeChance: 0, jumpAttackChance: 0 }),
  aiProfile: Object.freeze({ behaviorType: 'folsom_prey_herd', detectionRanges: Object.freeze({ threatRadius: 8, fleeRadius: 5 }), navigationPreferences: Object.freeze({ patrolSpeed: 0.34, fleeSpeed: 1.05 }), targetPriority: Object.freeze(['avoid nearest living neck_man from cached predator list']) }),
  spawnProfile: Object.freeze({ maxFolsomHerdCount: 5, placement: 'Folsom open field shoulder, clear of pond, campfire, buildings, gates, and spawn blockers.' }),
  debugProfile: Object.freeze({ showBounds: false, showGrounding: false, showTargetLine: false, showCurrentAnimation: true, showCurrentState: true }),
});
