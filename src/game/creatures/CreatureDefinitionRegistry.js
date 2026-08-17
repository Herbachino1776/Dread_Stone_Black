import {
  assertValidCreatureDefinition,
  CREATURE_DEFINITION_SCHEMA,
  CREATURE_DEFINITION_VERSION,
} from '../../contracts/CreatureDefinition.js';
import {
  CHEZWICK_RUNTIME_ANIMATION_NAMES,
  DREADGUARD_IGNORED_GUARD_ANIMATION_NAMES,
  DREADGUARD_RUNTIME_ANIMATION_KINDS,
  DREADGUARD_RUNTIME_ANIMATION_NAMES,
} from '../combat/HumanoidModelProfiles.js';

export const CURRENT_HUMANOID_COLLISION_PROFILE_ID = 'dreadstone.humanoid.current_collision.v1';
export const CHEZWICK_PROGRESSIVE_SITE_COMPATIBILITY_PROFILE_ID = 'chezwick.left_face.compatibility.v1';
export const DREADGUARD_PROGRESSIVE_SITE_COMPATIBILITY_PROFILE_ID = 'dreadguard.left_head.compatibility.v1';

export const DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES = Object.freeze([
  'DSB_Idle_Humanoid_v002',
  'DSB_Walk_NORMAL_v002',
  'DSB_Hurt_LEFT_Flank_v001',
  'DSB_Hurt_RIGHT_Flank_v001',
  'DSB_Death_ChestHold_LEFT_v001',
  'DSB_Death_ChestHold_LEFT_v002',
]);

function deepFreeze(value) {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
}

const SHARED_PRESENTATION = Object.freeze({
  groundClearance: 0.02,
  rootYaw: Math.PI,
  rootOffset: Object.freeze([0, 0, 0]),
});

const SHARED_ANIMATION = Object.freeze({
  animationAuthoritative: true,
  restPoseAuthoritative: false,
  authoredAnimationPack: true,
  authoredDeathAnimations: true,
  ignoreEmbeddedAnimations: false,
  holdingPoseMode: 'exported_rest_pose',
  fadeSeconds: 0.12,
  requireEmbeddedApprovalMetadata: true,
});

const SHARED_DAMAGE_SEGMENTS = Object.freeze(['head_neck', 'left_elbow', 'right_elbow']);

export const CHEZWICK_CREATURE_DEFINITION = deepFreeze({
  schema: CREATURE_DEFINITION_SCHEMA,
  version: CREATURE_DEFINITION_VERSION,
  definitionId: 'chezwick',
  displayName: 'Chezwick',
  creaturePackId: 'chezwick_damage_v001',
  voiceProfile: 'male_human',
  collisionProfileId: CURRENT_HUMANOID_COLLISION_PROFILE_ID,
  presentation: {
    ...SHARED_PRESENTATION,
    targetHeight: 1.5,
    colliderFitNotes: 'Creature Lab Chezwick definition: current humanoid collision fit, selected embedded combat clips, bilateral face progression, and two-times survivability.',
  },
  movement: { walkReferenceSpeed: 0.72 },
  animation: {
    ...SHARED_ANIMATION,
    runtimeKinds: ['IDLE', 'WALK', 'HURT_LEFT', 'HURT_RIGHT', 'MACE_GUARD_RIGHT_ARM', 'DEATH'],
    selectedAnimationNames: [...CHEZWICK_RUNTIME_ANIMATION_NAMES],
    ignoredEmbeddedAnimationNames: null,
  },
  damage: {
    supportedSegmentIds: [...SHARED_DAMAGE_SEGMENTS],
    compatibilityProgressiveSiteProfileId: CHEZWICK_PROGRESSIVE_SITE_COMPATIBILITY_PROFILE_ID,
    progressiveHitsPerStage: 2,
    maceImpactBlood: true,
  },
  mortality: { terminalProgressiveDamageFatal: true },
  durability: { multiplier: 2, piercingLethalityMultiplier: 2 },
});

export const DREADGUARD_CREATURE_DEFINITION = deepFreeze({
  schema: CREATURE_DEFINITION_SCHEMA,
  version: CREATURE_DEFINITION_VERSION,
  definitionId: 'dreadguard',
  displayName: 'Dreadguard',
  creaturePackId: 'dreadguard_damage_v001',
  voiceProfile: 'male_human',
  collisionProfileId: CURRENT_HUMANOID_COLLISION_PROFILE_ID,
  presentation: {
    ...SHARED_PRESENTATION,
    targetHeight: 1.5,
    colliderFitNotes: 'Creature Lab Dreadguard definition: current humanoid collision fit, exported holding pose, selected walk/hurt/death clips, and compatibility-only left-head progression.',
  },
  movement: { walkReferenceSpeed: 0.72 },
  animation: {
    ...SHARED_ANIMATION,
    runtimeKinds: [...DREADGUARD_RUNTIME_ANIMATION_KINDS],
    selectedAnimationNames: [...DREADGUARD_RUNTIME_ANIMATION_NAMES],
    ignoredEmbeddedAnimationNames: [...DREADGUARD_IGNORED_GUARD_ANIMATION_NAMES],
  },
  damage: {
    supportedSegmentIds: [...SHARED_DAMAGE_SEGMENTS],
    compatibilityProgressiveSiteProfileId: DREADGUARD_PROGRESSIVE_SITE_COMPATIBILITY_PROFILE_ID,
    progressiveHitsPerStage: 1,
    maceImpactBlood: false,
  },
  mortality: { terminalProgressiveDamageFatal: true },
  durability: { multiplier: 1, piercingLethalityMultiplier: 1 },
});

export const DREAD_RAM_GOD_CREATURE_DEFINITION = deepFreeze({
  schema: CREATURE_DEFINITION_SCHEMA,
  version: CREATURE_DEFINITION_VERSION,
  definitionId: 'dread_ram_god',
  displayName: 'Dread Ram God',
  creaturePackId: 'dread_ram_god_damage_v001',
  voiceProfile: 'male_human',
  collisionProfileId: CURRENT_HUMANOID_COLLISION_PROFILE_ID,
  presentation: {
    ...SHARED_PRESENTATION,
    targetHeight: 1.7,
    colliderFitNotes: 'Creature Lab Dread Ram God definition: current humanoid collision fit, six selected embedded clips, four native progressive sites, and the three currently certified detachable segments.',
  },
  movement: { walkReferenceSpeed: 0.72 },
  animation: {
    ...SHARED_ANIMATION,
    runtimeKinds: ['IDLE', 'WALK', 'HURT_LEFT', 'HURT_RIGHT', 'DEATH'],
    selectedAnimationNames: [...DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES],
    ignoredEmbeddedAnimationNames: null,
  },
  damage: {
    supportedSegmentIds: [...SHARED_DAMAGE_SEGMENTS],
    compatibilityProgressiveSiteProfileId: null,
    progressiveHitsPerStage: 1,
    maceImpactBlood: false,
  },
  mortality: { terminalProgressiveDamageFatal: false },
  durability: { multiplier: 1, piercingLethalityMultiplier: 1 },
});

function discoverFileCreatureDefinitions() {
  let modules = {};
  if (import.meta.env?.DEV || import.meta.env?.PROD) {
    modules = import.meta.glob('./data/*.json', { eager: true, import: 'default' });
  }
  return Object.freeze(Object.entries(modules)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([, definition]) => deepFreeze(cloneValue(definition))));
}

export const FILE_CREATURE_DEFINITIONS = discoverFileCreatureDefinitions();

export const PRODUCTION_CREATURE_DEFINITIONS = Object.freeze([
  CHEZWICK_CREATURE_DEFINITION,
  DREADGUARD_CREATURE_DEFINITION,
  DREAD_RAM_GOD_CREATURE_DEFINITION,
  ...FILE_CREATURE_DEFINITIONS,
]);

export class CreatureDefinitionRegistryError extends Error {
  constructor(code, message, options = {}) {
    super(`[Creature Definition Registry:${code}] ${message}`, options);
    this.name = 'CreatureDefinitionRegistryError';
    this.code = code;
  }
}

export class CreatureDefinitionRegistry {
  constructor({ definitions = PRODUCTION_CREATURE_DEFINITIONS } = {}) {
    if (!Array.isArray(definitions)) {
      throw new CreatureDefinitionRegistryError('INVALID_REGISTRY', 'definitions must be an array.');
    }
    this.definitions = new Map();
    definitions.forEach((candidate, index) => {
      let definition;
      try {
        definition = deepFreeze(cloneValue(candidate));
        assertValidCreatureDefinition(definition);
      } catch (error) {
        throw new CreatureDefinitionRegistryError('INVALID_DEFINITION', `definitions[${index}]: ${error.message}`, { cause: error });
      }
      if (this.definitions.has(definition.definitionId)) {
        throw new CreatureDefinitionRegistryError('DUPLICATE_DEFINITION', `definitionId "${definition.definitionId}" is registered more than once.`);
      }
      this.definitions.set(definition.definitionId, definition);
    });
  }

  listDefinitions() {
    return [...this.definitions.values()];
  }

  hasDefinition(definitionId) {
    return this.definitions.has(definitionId);
  }

  getDefinition(definitionId) {
    const definition = this.definitions.get(definitionId);
    if (!definition) throw new CreatureDefinitionRegistryError('UNKNOWN_DEFINITION', `No registered Creature Definition has definitionId "${definitionId}".`);
    return definition;
  }

  findDefinitionsForPack(creaturePackId) {
    return this.listDefinitions().filter((definition) => definition.creaturePackId === creaturePackId);
  }
}

export const creatureDefinitionRegistry = new CreatureDefinitionRegistry();
