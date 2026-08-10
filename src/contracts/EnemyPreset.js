export const ENEMY_PRESET_V1_SCHEMA = 'dreadstone.enemy_preset.v1';
export const ENEMY_PRESET_V1_VERSION = 1;
export const ENEMY_PRESET_V2_SCHEMA = 'dreadstone.enemy_preset.v2';
export const ENEMY_PRESET_V2_VERSION = 2;

// Compatibility aliases retain the original v1 contract identity. New
// production records must opt into v2 explicitly rather than silently changing
// the meaning of existing v1 callers.
export const ENEMY_PRESET_SCHEMA = ENEMY_PRESET_V1_SCHEMA;
export const ENEMY_PRESET_VERSION = ENEMY_PRESET_V1_VERSION;

const STABLE_ID = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;
const V1_TOP_LEVEL_FIELDS = Object.freeze([
  'schema',
  'version',
  'presetId',
  'displayName',
  'creatureDefinitionId',
  'presentation',
  'armament',
]);
const V2_TOP_LEVEL_FIELDS = Object.freeze([...V1_TOP_LEVEL_FIELDS, 'rewards']);
const PRESENTATION_FIELDS = Object.freeze(['targetHeight']);
const ARMAMENT_FIELDS = Object.freeze(['loadoutId', 'weaponOverride']);
const REWARDS_FIELDS = Object.freeze(['lootProfileId']);
const WEAPON_OVERRIDE_FIELDS = Object.freeze(['assetScale', 'gripTransform', 'attackCapsule']);
const GRIP_TRANSFORM_FIELDS = Object.freeze(['position', 'quaternion']);
const ATTACK_CAPSULE_FIELDS = Object.freeze(['start', 'end', 'radius']);

export const ENEMY_PRESET_FORBIDDEN_FIELDS = Object.freeze([
  'creaturePackId',
  'creaturePackPath',
  'assets',
  'assetPath',
  'bones',
  'boneMap',
  'attachmentSocket',
  'attachmentSockets',
  'socketTransform',
  'animationPhases',
  'phases',
  'weaponAssetPath',
  'damage',
  'baseDamage',
  'ai',
  'brainProfileId',
  'faction',
  'gold',
  'loot',
  'coordinates',
  'spawnId',
  'persistence',
  'persistenceState',
]);

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStableId(value) {
  return isNonemptyString(value) && STABLE_ID.test(value);
}

function isFiniteVector(value, length) {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}

function requireCondition(errors, condition, path, message) {
  if (!condition) errors.push(`${path} ${message}`);
}

function requireExactFields(errors, value, allowedFields, path, schema = 'supported Enemy Preset contracts') {
  if (!isRecord(value)) return;
  const allowed = new Set(allowedFields);
  Object.keys(value).forEach((field) => {
    if (!allowed.has(field)) errors.push(`${path}.${field} is not part of ${schema}`);
  });
}

function findForbiddenFields(value, path = 'preset', matches = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findForbiddenFields(entry, `${path}[${index}]`, matches));
    return matches;
  }
  if (!isRecord(value)) return matches;
  Object.entries(value).forEach(([field, entry]) => {
    const entryPath = `${path}.${field}`;
    if (ENEMY_PRESET_FORBIDDEN_FIELDS.includes(field)) matches.push(entryPath);
    findForbiddenFields(entry, entryPath, matches);
  });
  return matches;
}

export function validateEnemyPresetWeaponOverride(override) {
  const errors = [];
  requireCondition(errors, isRecord(override), 'weaponOverride', 'must be an object');
  if (!isRecord(override)) return { valid: false, errors };
  requireExactFields(errors, override, WEAPON_OVERRIDE_FIELDS, 'weaponOverride');
  requireCondition(errors, Number.isFinite(override.assetScale) && override.assetScale > 0, 'weaponOverride.assetScale', 'must be one finite positive uniform scalar');

  requireCondition(errors, isRecord(override.gripTransform), 'weaponOverride.gripTransform', 'must be an object');
  if (isRecord(override.gripTransform)) {
    requireExactFields(errors, override.gripTransform, GRIP_TRANSFORM_FIELDS, 'weaponOverride.gripTransform');
    requireCondition(errors, isFiniteVector(override.gripTransform.position, 3), 'weaponOverride.gripTransform.position', 'must be a finite 3-vector');
    requireCondition(
      errors,
      isFiniteVector(override.gripTransform.quaternion, 4)
        && Math.abs(Math.hypot(...override.gripTransform.quaternion) - 1) <= 1e-4,
      'weaponOverride.gripTransform.quaternion',
      'must be a finite normalized [x,y,z,w] quaternion',
    );
  }

  requireCondition(errors, isRecord(override.attackCapsule), 'weaponOverride.attackCapsule', 'must be an object');
  if (isRecord(override.attackCapsule)) {
    requireExactFields(errors, override.attackCapsule, ATTACK_CAPSULE_FIELDS, 'weaponOverride.attackCapsule');
    requireCondition(errors, isFiniteVector(override.attackCapsule.start, 3), 'weaponOverride.attackCapsule.start', 'must be a finite 3-vector');
    requireCondition(errors, isFiniteVector(override.attackCapsule.end, 3), 'weaponOverride.attackCapsule.end', 'must be a finite 3-vector');
    requireCondition(errors, Number.isFinite(override.attackCapsule.radius) && override.attackCapsule.radius > 0, 'weaponOverride.attackCapsule.radius', 'must be finite and positive');
  }
  return { valid: errors.length === 0, errors };
}

export function validateEnemyPreset(preset) {
  const errors = [];
  requireCondition(errors, isRecord(preset), 'preset', 'must be an object');
  if (!isRecord(preset)) return { valid: false, errors };

  const isV1 = preset.schema === ENEMY_PRESET_V1_SCHEMA && preset.version === ENEMY_PRESET_V1_VERSION;
  const isV2 = preset.schema === ENEMY_PRESET_V2_SCHEMA && preset.version === ENEMY_PRESET_V2_VERSION;
  const supported = isV1 || isV2;
  const schema = isV2 ? ENEMY_PRESET_V2_SCHEMA : ENEMY_PRESET_V1_SCHEMA;
  requireExactFields(errors, preset, isV2 ? V2_TOP_LEVEL_FIELDS : V1_TOP_LEVEL_FIELDS, 'preset', schema);
  requireCondition(errors, supported, 'preset.schema/version', `must be ${ENEMY_PRESET_V1_SCHEMA}@${ENEMY_PRESET_V1_VERSION} or ${ENEMY_PRESET_V2_SCHEMA}@${ENEMY_PRESET_V2_VERSION}`);
  requireCondition(errors, isStableId(preset.presetId), 'preset.presetId', 'must be a stable lowercase identifier');
  requireCondition(errors, isNonemptyString(preset.displayName), 'preset.displayName', 'must be a non-empty string');
  requireCondition(errors, isStableId(preset.creatureDefinitionId), 'preset.creatureDefinitionId', 'must reference a stable Creature Definition ID');

  requireCondition(errors, isRecord(preset.presentation), 'preset.presentation', 'must be an object');
  if (isRecord(preset.presentation)) {
    requireExactFields(errors, preset.presentation, PRESENTATION_FIELDS, 'preset.presentation');
    requireCondition(errors, Number.isFinite(preset.presentation.targetHeight) && preset.presentation.targetHeight > 0, 'preset.presentation.targetHeight', 'must be finite and positive');
  }

  requireCondition(errors, isRecord(preset.armament), 'preset.armament', 'must be an object');
  if (isRecord(preset.armament)) {
    requireExactFields(errors, preset.armament, ARMAMENT_FIELDS, 'preset.armament');
    requireCondition(errors, isStableId(preset.armament.loadoutId), 'preset.armament.loadoutId', 'must reference a stable NPC Loadout ID');
    if (preset.armament.weaponOverride != null) {
      const overrideValidation = validateEnemyPresetWeaponOverride(preset.armament.weaponOverride);
      overrideValidation.errors.forEach((error) => errors.push(`preset.armament.${error}`));
    }
  }

  if (isV2 && Object.hasOwn(preset, 'rewards')) {
    requireCondition(errors, isRecord(preset.rewards), 'preset.rewards', 'must be an object');
    if (isRecord(preset.rewards)) {
      requireExactFields(errors, preset.rewards, REWARDS_FIELDS, 'preset.rewards', ENEMY_PRESET_V2_SCHEMA);
      requireCondition(errors, isStableId(preset.rewards.lootProfileId), 'preset.rewards.lootProfileId', 'must reference a stable Loot Profile ID');
    }
  }

  findForbiddenFields(preset).forEach((path) => errors.push(`${path} belongs to another authority layer`));
  return { valid: errors.length === 0, errors };
}

export function assertValidEnemyPreset(preset) {
  const validation = validateEnemyPreset(preset);
  if (!validation.valid) throw new Error(`Invalid Enemy Preset: ${validation.errors.join('; ')}`);
  return preset;
}
