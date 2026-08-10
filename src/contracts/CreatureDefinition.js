export const CREATURE_DEFINITION_SCHEMA = 'dreadstone.creature_definition.v1';
export const CREATURE_DEFINITION_VERSION = 1;

const DEFINITION_ID_PATTERN = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;

export const CREATURE_DEFINITION_TECHNICAL_FIELDS = Object.freeze([
  'assetPath',
  'assets',
  'animationManifestPath',
  'animationValidationReportPath',
  'damageManifestPath',
  'damageValidationReportPath',
  'sourceFingerprint',
  'topologyFingerprint',
  'weightFingerprint',
  'authoringVersion',
  'authoringBuildId',
  'rawHeight',
  'rawBounds',
  'progressiveDamageSites',
  'morphKeys',
  'goreBindings',
  'stainBindings',
  'exportedSegments',
  'skeleton',
  'skeletonFamilyId',
  'boneMap',
  'runtimeSkeleton',
]);

const TOP_LEVEL_FIELDS = Object.freeze([
  'schema',
  'version',
  'definitionId',
  'displayName',
  'creaturePackId',
  'voiceProfile',
  'collisionProfileId',
  'presentation',
  'movement',
  'animation',
  'damage',
  'mortality',
  'durability',
]);
const PRESENTATION_FIELDS = Object.freeze(['targetHeight', 'groundClearance', 'rootYaw', 'rootOffset', 'colliderFitNotes']);
const MOVEMENT_FIELDS = Object.freeze(['walkReferenceSpeed']);
const ANIMATION_FIELDS = Object.freeze([
  'animationAuthoritative',
  'restPoseAuthoritative',
  'authoredAnimationPack',
  'authoredDeathAnimations',
  'ignoreEmbeddedAnimations',
  'holdingPoseMode',
  'fadeSeconds',
  'runtimeKinds',
  'selectedAnimationNames',
  'ignoredEmbeddedAnimationNames',
  'requireEmbeddedApprovalMetadata',
]);
const DAMAGE_FIELDS = Object.freeze([
  'supportedSegmentIds',
  'compatibilityProgressiveSiteProfileId',
  'progressiveHitsPerStage',
  'maceImpactBlood',
]);
const MORTALITY_FIELDS = Object.freeze(['terminalProgressiveDamageFatal']);
const DURABILITY_FIELDS = Object.freeze(['multiplier', 'piercingLethalityMultiplier']);

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value) {
  return value == null || isNonemptyString(value);
}

function isFiniteVector(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function isUniqueStringArray(value) {
  return Array.isArray(value)
    && value.every(isNonemptyString)
    && new Set(value).size === value.length;
}

function requireCondition(errors, condition, path, message) {
  if (!condition) errors.push(`${path} ${message}`);
}

function requireExactFields(errors, value, allowedFields, path) {
  if (!isRecord(value)) return;
  const allowed = new Set(allowedFields);
  Object.keys(value).forEach((field) => {
    if (!allowed.has(field)) errors.push(`${path}.${field} is not part of ${CREATURE_DEFINITION_SCHEMA}`);
  });
}

function findTechnicalFields(value, path = 'definition', matches = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findTechnicalFields(entry, `${path}[${index}]`, matches));
    return matches;
  }
  if (!isRecord(value)) return matches;
  Object.entries(value).forEach(([field, entry]) => {
    const entryPath = `${path}.${field}`;
    if (CREATURE_DEFINITION_TECHNICAL_FIELDS.includes(field)) matches.push(entryPath);
    findTechnicalFields(entry, entryPath, matches);
  });
  return matches;
}

export function validateCreatureDefinition(definition) {
  const errors = [];
  requireCondition(errors, isRecord(definition), 'definition', 'must be an object');
  if (!isRecord(definition)) return { valid: false, errors };

  requireExactFields(errors, definition, TOP_LEVEL_FIELDS, 'definition');
  requireCondition(errors, definition.schema === CREATURE_DEFINITION_SCHEMA, 'schema', `must be ${CREATURE_DEFINITION_SCHEMA}`);
  requireCondition(errors, definition.version === CREATURE_DEFINITION_VERSION, 'version', `must be ${CREATURE_DEFINITION_VERSION}`);
  requireCondition(errors, isNonemptyString(definition.definitionId) && DEFINITION_ID_PATTERN.test(definition.definitionId), 'definitionId', 'must be a stable lowercase identifier');
  requireCondition(errors, isNonemptyString(definition.displayName), 'displayName', 'must be a non-empty string');
  requireCondition(errors, isNonemptyString(definition.creaturePackId) && DEFINITION_ID_PATTERN.test(definition.creaturePackId), 'creaturePackId', 'must reference a stable Creature Pack ID');
  requireCondition(errors, isNonemptyString(definition.voiceProfile), 'voiceProfile', 'must be a non-empty string');
  requireCondition(errors, isNonemptyString(definition.collisionProfileId), 'collisionProfileId', 'must be a non-empty runtime collision-profile reference');

  const presentation = definition.presentation;
  requireCondition(errors, isRecord(presentation), 'presentation', 'must be an object');
  if (isRecord(presentation)) {
    requireExactFields(errors, presentation, PRESENTATION_FIELDS, 'presentation');
    requireCondition(errors, Number.isFinite(presentation.targetHeight) && presentation.targetHeight > 0, 'presentation.targetHeight', 'must be positive');
    requireCondition(errors, Number.isFinite(presentation.groundClearance) && presentation.groundClearance >= 0, 'presentation.groundClearance', 'must be non-negative');
    requireCondition(errors, Number.isFinite(presentation.rootYaw), 'presentation.rootYaw', 'must be finite');
    requireCondition(errors, isFiniteVector(presentation.rootOffset), 'presentation.rootOffset', 'must be a finite 3-vector');
    requireCondition(errors, isNonemptyString(presentation.colliderFitNotes), 'presentation.colliderFitNotes', 'must be a non-empty string');
  }

  const movement = definition.movement;
  requireCondition(errors, isRecord(movement), 'movement', 'must be an object');
  if (isRecord(movement)) {
    requireExactFields(errors, movement, MOVEMENT_FIELDS, 'movement');
    requireCondition(errors, Number.isFinite(movement.walkReferenceSpeed) && movement.walkReferenceSpeed > 0, 'movement.walkReferenceSpeed', 'must be positive');
  }

  const animation = definition.animation;
  requireCondition(errors, isRecord(animation), 'animation', 'must be an object');
  if (isRecord(animation)) {
    requireExactFields(errors, animation, ANIMATION_FIELDS, 'animation');
    for (const field of ['animationAuthoritative', 'restPoseAuthoritative', 'authoredAnimationPack', 'authoredDeathAnimations', 'ignoreEmbeddedAnimations', 'requireEmbeddedApprovalMetadata']) {
      requireCondition(errors, typeof animation[field] === 'boolean', `animation.${field}`, 'must be boolean');
    }
    requireCondition(errors, isNonemptyString(animation.holdingPoseMode), 'animation.holdingPoseMode', 'must be a non-empty string');
    requireCondition(errors, Number.isFinite(animation.fadeSeconds) && animation.fadeSeconds >= 0, 'animation.fadeSeconds', 'must be non-negative');
    requireCondition(errors, isUniqueStringArray(animation.runtimeKinds), 'animation.runtimeKinds', 'must be an array of unique non-empty strings');
    requireCondition(errors, isUniqueStringArray(animation.selectedAnimationNames), 'animation.selectedAnimationNames', 'must be an array of unique non-empty strings');
    requireCondition(errors, animation.ignoredEmbeddedAnimationNames == null || isUniqueStringArray(animation.ignoredEmbeddedAnimationNames), 'animation.ignoredEmbeddedAnimationNames', 'must be null or an array of unique non-empty strings');
  }

  const damage = definition.damage;
  requireCondition(errors, isRecord(damage), 'damage', 'must be an object');
  if (isRecord(damage)) {
    requireExactFields(errors, damage, DAMAGE_FIELDS, 'damage');
    requireCondition(errors, isUniqueStringArray(damage.supportedSegmentIds), 'damage.supportedSegmentIds', 'must be an array of unique non-empty strings');
    requireCondition(errors, isOptionalString(damage.compatibilityProgressiveSiteProfileId), 'damage.compatibilityProgressiveSiteProfileId', 'must be null or a non-empty compatibility-profile reference');
    requireCondition(errors, Number.isInteger(damage.progressiveHitsPerStage) && damage.progressiveHitsPerStage > 0, 'damage.progressiveHitsPerStage', 'must be a positive integer');
    requireCondition(errors, typeof damage.maceImpactBlood === 'boolean', 'damage.maceImpactBlood', 'must be boolean');
  }

  const mortality = definition.mortality;
  requireCondition(errors, isRecord(mortality), 'mortality', 'must be an object');
  if (isRecord(mortality)) {
    requireExactFields(errors, mortality, MORTALITY_FIELDS, 'mortality');
    requireCondition(errors, typeof mortality.terminalProgressiveDamageFatal === 'boolean', 'mortality.terminalProgressiveDamageFatal', 'must be boolean');
  }

  const durability = definition.durability;
  requireCondition(errors, isRecord(durability), 'durability', 'must be an object');
  if (isRecord(durability)) {
    requireExactFields(errors, durability, DURABILITY_FIELDS, 'durability');
    requireCondition(errors, Number.isFinite(durability.multiplier) && durability.multiplier >= 1, 'durability.multiplier', 'must be at least 1');
    requireCondition(errors, Number.isFinite(durability.piercingLethalityMultiplier) && durability.piercingLethalityMultiplier >= 1, 'durability.piercingLethalityMultiplier', 'must be at least 1');
  }

  findTechnicalFields(definition).forEach((path) => errors.push(`${path} duplicates Creature Pack or Forge technical truth`));
  return { valid: errors.length === 0, errors };
}

export function assertValidCreatureDefinition(definition) {
  const validation = validateCreatureDefinition(definition);
  if (!validation.valid) throw new Error(`Invalid ${CREATURE_DEFINITION_SCHEMA}: ${validation.errors.join('; ')}`);
  return definition;
}
