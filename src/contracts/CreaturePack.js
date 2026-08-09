export const CREATURE_PACK_SCHEMA = 'dreadstone.creature_pack.v1';
export const CREATURE_PACK_VERSION = 1;
export const CREATURE_PACK_REGISTRY_SCHEMA = 'dreadstone.creature_pack_registry.v1';

const PACK_ID_PATTERN = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

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

export function validateCreaturePack(pack) {
  const errors = [];
  requireCondition(errors, isRecord(pack), 'pack', 'must be an object');
  if (!isRecord(pack)) return { valid: false, errors };

  requireCondition(errors, pack.schema === CREATURE_PACK_SCHEMA, 'schema', `must be ${CREATURE_PACK_SCHEMA}`);
  requireCondition(errors, pack.version === CREATURE_PACK_VERSION, 'version', `must be ${CREATURE_PACK_VERSION}`);
  requireCondition(errors, isNonemptyString(pack.packId) && PACK_ID_PATTERN.test(pack.packId), 'packId', 'must be a stable lowercase identifier');
  requireCondition(errors, isNonemptyString(pack.displayName), 'displayName', 'must be a non-empty string');

  const assets = pack.assets;
  requireCondition(errors, isRecord(assets), 'assets', 'must be an object');
  if (isRecord(assets)) {
    requireCondition(errors, isNonemptyString(assets.glb), 'assets.glb', 'must be a path');
    requireCondition(errors, isNonemptyString(assets.damageManifest), 'assets.damageManifest', 'must be a path');
    requireCondition(errors, isNonemptyString(assets.damageValidationReport), 'assets.damageValidationReport', 'must be a path');
    requireCondition(errors, isOptionalString(assets.animationManifest), 'assets.animationManifest', 'must be null or a path');
    requireCondition(errors, isOptionalString(assets.animationValidationReport), 'assets.animationValidationReport', 'must be null or a path');
  }

  const source = pack.source;
  requireCondition(errors, isRecord(source), 'source', 'must be an object');
  if (isRecord(source)) {
    requireCondition(errors, isNonemptyString(source.object), 'source.object', 'must be a non-empty string');
    requireCondition(errors, isNonemptyString(source.armature), 'source.armature', 'must be a non-empty string');
    requireCondition(errors, isNonemptyString(source.readinessContractSchema), 'source.readinessContractSchema', 'must be a non-empty string');
    requireCondition(errors, SHA256_PATTERN.test(source.topologyFingerprint ?? ''), 'source.topologyFingerprint', 'must be a lowercase SHA-256');
    requireCondition(errors, SHA256_PATTERN.test(source.weightFingerprint ?? ''), 'source.weightFingerprint', 'must be a lowercase SHA-256');
    for (const key of ['objectId', 'meshDataId', 'armatureObjectId', 'armatureDataId', 'readinessAnalyzerRevision', 'readinessAnalyzerBuildId', 'exportGeneratedAtUtc']) {
      requireCondition(errors, isOptionalString(source[key]), `source.${key}`, 'must be null or a non-empty string');
    }
  }

  const authoring = pack.authoring;
  requireCondition(errors, isRecord(authoring), 'authoring', 'must be an object');
  if (isRecord(authoring)) {
    for (const key of ['damageVersion', 'damageBuildId', 'deformationVersion', 'deformationBuildId']) {
      requireCondition(errors, isNonemptyString(authoring[key]), `authoring.${key}`, 'must be a non-empty string');
    }
  }

  const presentation = pack.presentation;
  requireCondition(errors, isRecord(presentation), 'presentation', 'must be an object');
  if (isRecord(presentation)) {
    requireCondition(errors, Number.isFinite(presentation.rawHeight) && presentation.rawHeight > 0, 'presentation.rawHeight', 'must be positive');
    requireCondition(errors, isRecord(presentation.rawBounds), 'presentation.rawBounds', 'must be an object');
    if (isRecord(presentation.rawBounds)) {
      for (const key of ['min', 'max', 'size']) requireCondition(errors, isFiniteVector(presentation.rawBounds[key]), `presentation.rawBounds.${key}`, 'must be a finite 3-vector');
    }
    requireCondition(errors, isOptionalString(presentation.authoredForwardAxis), 'presentation.authoredForwardAxis', 'must be null or a non-empty string');
    requireCondition(errors, isOptionalString(presentation.upAxis), 'presentation.upAxis', 'must be null or a non-empty string');
    requireCondition(errors, Number.isFinite(presentation.unitScaleMeters) && presentation.unitScaleMeters > 0, 'presentation.unitScaleMeters', 'must be positive');
    requireCondition(errors, isNonemptyString(presentation.skeletonFamilyId), 'presentation.skeletonFamilyId', 'must be a non-empty string');
    requireCondition(errors, isNonemptyString(presentation.boneMapProfileId), 'presentation.boneMapProfileId', 'must be a non-empty string');
  }

  const capabilities = pack.capabilities;
  requireCondition(errors, isRecord(capabilities), 'capabilities', 'must be an object');
  if (isRecord(capabilities)) {
    for (const key of ['progressiveDamage', 'deformations', 'gore', 'surfaceStains', 'pairedDetachableSegments', 'embeddedAnimations', 'separatelyValidatedAnimations']) {
      requireCondition(errors, typeof capabilities[key] === 'boolean', `capabilities.${key}`, 'must be boolean');
    }
  }

  const damage = pack.damage;
  requireCondition(errors, isRecord(damage), 'damage', 'must be an object');
  if (isRecord(damage)) {
    for (const key of ['availableSegmentIds', 'activeRuntimeSegmentIds', 'deformationRegionIds', 'progressiveDamageSiteIds']) {
      requireCondition(errors, isUniqueStringArray(damage[key]), `damage.${key}`, 'must be an array of unique non-empty strings');
    }
    if (isUniqueStringArray(damage.activeRuntimeSegmentIds) && isUniqueStringArray(damage.availableSegmentIds)) {
      requireCondition(errors, damage.activeRuntimeSegmentIds.every((id) => damage.availableSegmentIds.includes(id)), 'damage.activeRuntimeSegmentIds', 'must be a subset of availableSegmentIds');
    }
  }

  const animations = pack.animations;
  requireCondition(errors, isRecord(animations), 'animations', 'must be an object');
  if (isRecord(animations)) {
    requireCondition(errors, ['none', 'embedded'].includes(animations.delivery), 'animations.delivery', 'must be none or embedded');
    requireCondition(errors, typeof animations.manifestValidated === 'boolean', 'animations.manifestValidated', 'must be boolean');
    requireCondition(errors, Number.isInteger(animations.unapprovedClipCount) && animations.unapprovedClipCount >= 0, 'animations.unapprovedClipCount', 'must be a non-negative integer');
    requireCondition(errors, Array.isArray(animations.approvedClips), 'animations.approvedClips', 'must be an array');
    if (Array.isArray(animations.approvedClips)) {
      const names = [];
      animations.approvedClips.forEach((clip, index) => {
        requireCondition(errors, isRecord(clip), `animations.approvedClips[${index}]`, 'must be an object');
        if (!isRecord(clip)) return;
        requireCondition(errors, isNonemptyString(clip.name), `animations.approvedClips[${index}].name`, 'must be a non-empty string');
        requireCondition(errors, isNonemptyString(clip.kind), `animations.approvedClips[${index}].kind`, 'must be a non-empty string');
        names.push(clip.name);
      });
      requireCondition(errors, new Set(names).size === names.length, 'animations.approvedClips', 'must not contain duplicate names');
    }
  }

  const diagnostics = pack.importDiagnostics;
  requireCondition(errors, Array.isArray(diagnostics), 'importDiagnostics', 'must be an array');
  if (Array.isArray(diagnostics)) diagnostics.forEach((entry, index) => {
    requireCondition(errors, isRecord(entry), `importDiagnostics[${index}]`, 'must be an object');
    if (!isRecord(entry)) return;
    requireCondition(errors, ['info', 'warning'].includes(entry.level), `importDiagnostics[${index}].level`, 'must be info or warning');
    requireCondition(errors, isNonemptyString(entry.code), `importDiagnostics[${index}].code`, 'must be a non-empty string');
    requireCondition(errors, isNonemptyString(entry.message), `importDiagnostics[${index}].message`, 'must be a non-empty string');
  });

  const cost = pack.cost;
  requireCondition(errors, isRecord(cost), 'cost', 'must be an object');
  if (isRecord(cost)) for (const [key, value] of Object.entries(cost)) {
    requireCondition(errors, Number.isInteger(value) && value >= 0, `cost.${key}`, 'must be a non-negative integer');
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidCreaturePack(pack) {
  const validation = validateCreaturePack(pack);
  if (!validation.valid) throw new Error(`Invalid ${CREATURE_PACK_SCHEMA}: ${validation.errors.join('; ')}`);
  return pack;
}

export function validateCreaturePackRegistry(registry) {
  const errors = [];
  requireCondition(errors, isRecord(registry), 'registry', 'must be an object');
  if (!isRecord(registry)) return { valid: false, errors };
  requireCondition(errors, registry.schema === CREATURE_PACK_REGISTRY_SCHEMA, 'schema', `must be ${CREATURE_PACK_REGISTRY_SCHEMA}`);
  requireCondition(errors, registry.version === CREATURE_PACK_VERSION, 'version', `must be ${CREATURE_PACK_VERSION}`);
  requireCondition(errors, Array.isArray(registry.packs), 'packs', 'must be an array');
  if (Array.isArray(registry.packs)) {
    const ids = [];
    registry.packs.forEach((entry, index) => {
      requireCondition(errors, isRecord(entry), `packs[${index}]`, 'must be an object');
      if (!isRecord(entry)) return;
      requireCondition(errors, isNonemptyString(entry.packId) && PACK_ID_PATTERN.test(entry.packId), `packs[${index}].packId`, 'must be a stable lowercase identifier');
      requireCondition(errors, isNonemptyString(entry.displayName), `packs[${index}].displayName`, 'must be a non-empty string');
      requireCondition(errors, isNonemptyString(entry.descriptorPath), `packs[${index}].descriptorPath`, 'must be a path');
      ids.push(entry.packId);
    });
    requireCondition(errors, new Set(ids).size === ids.length, 'packs', 'must not contain duplicate pack IDs');
    requireCondition(errors, ids.every((id, index) => index === 0 || ids[index - 1].localeCompare(id) <= 0), 'packs', 'must be sorted by packId');
  }
  return { valid: errors.length === 0, errors };
}
