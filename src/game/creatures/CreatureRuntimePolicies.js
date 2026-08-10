import { assertValidCreaturePack } from '../../contracts/CreaturePack.js';
import { validateCreatureDefinition } from '../../contracts/CreatureDefinition.js';
import {
  CHEZWICK_LEFT_PROGRESSIVE_DAMAGE_SITE_COMPATIBILITY,
  CURRENT_HUMANOID_BONE_MAP,
  DREADGUARD_DAMAGE_COMBAT_PROFILE,
  DREADGUARD_PROGRESSIVE_DAMAGE_SITE_FALLBACK,
} from '../combat/HumanoidModelProfiles.js';
import {
  CHEZWICK_CREATURE_DEFINITION,
  CHEZWICK_PROGRESSIVE_SITE_COMPATIBILITY_PROFILE_ID,
  CURRENT_HUMANOID_COLLISION_PROFILE_ID,
  DREADGUARD_CREATURE_DEFINITION,
  DREADGUARD_PROGRESSIVE_SITE_COMPATIBILITY_PROFILE_ID,
  DREAD_RAM_GOD_CREATURE_DEFINITION,
  DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES,
  creatureDefinitionRegistry,
} from './CreatureDefinitionRegistry.js';

export const CURRENT_CREATURE_LAB_SKELETON_FAMILY = 'DSB_HUMANOID_V1';
export const CURRENT_CREATURE_LAB_BONE_MAP_PROFILE = 'dreadstone.humanoid.current_bone_map.v1';

export const CREATURE_PACK_TECHNICAL_PROFILE_FIELDS = Object.freeze([
  'assetPath',
  'animationManifestPath',
  'animationValidationReportPath',
  'damageManifestPath',
  'damageValidationReportPath',
  'rawHeight',
  'authoredForwardAxis',
  'damageAuthoringVersion',
  'damageAuthoringBuildId',
  'damageTopologyFingerprint',
  'damageWeightFingerprint',
  'embeddedAnimationPack',
]);

const COLLISION_PROFILES = new Map([
  [CURRENT_HUMANOID_COLLISION_PROFILE_ID, Object.freeze({
    boneMap: CURRENT_HUMANOID_BONE_MAP,
    proxyFit: DREADGUARD_DAMAGE_COMBAT_PROFILE.proxyFit,
  })],
]);

const PROGRESSIVE_SITE_COMPATIBILITY_PROFILES = new Map([
  [CHEZWICK_PROGRESSIVE_SITE_COMPATIBILITY_PROFILE_ID, Object.freeze([CHEZWICK_LEFT_PROGRESSIVE_DAMAGE_SITE_COMPATIBILITY])],
  [DREADGUARD_PROGRESSIVE_SITE_COMPATIBILITY_PROFILE_ID, Object.freeze([DREADGUARD_PROGRESSIVE_DAMAGE_SITE_FALLBACK])],
]);

// Temporary Milestone 4 aliases for callers that still import the former policy names.
// The values are the production definitions themselves, so there is no second policy registry.
export const CHEZWICK_CREATURE_RUNTIME_POLICY = CHEZWICK_CREATURE_DEFINITION;
export const DREADGUARD_CREATURE_RUNTIME_POLICY = DREADGUARD_CREATURE_DEFINITION;
export const DREAD_RAM_GOD_CREATURE_RUNTIME_POLICY = DREAD_RAM_GOD_CREATURE_DEFINITION;
export { DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES };

function animationManifestAssetName(path) {
  if (!path) return null;
  const basename = path.split('/').pop()?.split(/[?#]/, 1)[0] ?? '';
  return basename.replace(/\.json$/i, '.glb');
}

function resolveCollisionProfile(definition) {
  return COLLISION_PROFILES.get(definition?.collisionProfileId) ?? null;
}

function resolveProgressiveSiteCompatibilityProfile(definition) {
  const profileId = definition?.damage?.compatibilityProgressiveSiteProfileId;
  if (!profileId) return Object.freeze([]);
  return PROGRESSIVE_SITE_COMPATIBILITY_PROFILES.get(profileId) ?? null;
}

// Compatibility helper only. Pack IDs no longer define gameplay identity; this returns
// a definition only while exactly one registered definition references the requested pack.
export function getCreatureRuntimePolicy(packId) {
  const definitions = creatureDefinitionRegistry.findDefinitionsForPack(packId);
  return definitions.length === 1 ? definitions[0] : null;
}

export function listCreatureRuntimePolicies() {
  return creatureDefinitionRegistry.listDefinitions();
}

export function assessCreaturePackRuntimeSupport(pack, definition) {
  try {
    assertValidCreaturePack(pack);
  } catch (error) {
    return { supported: false, reason: error.message, code: 'INVALID_DESCRIPTOR' };
  }
  const definitionValidation = validateCreatureDefinition(definition);
  if (!definitionValidation.valid) {
    return { supported: false, reason: definitionValidation.errors.join('; '), code: 'INVALID_DEFINITION' };
  }
  if (definition.creaturePackId !== pack.packId) {
    return { supported: false, reason: `Definition references ${definition.creaturePackId}, but ${pack.packId} was resolved.`, code: 'DEFINITION_PACK_MISMATCH' };
  }
  if (pack.presentation.skeletonFamilyId !== CURRENT_CREATURE_LAB_SKELETON_FAMILY) {
    return { supported: false, reason: `Skeleton family ${pack.presentation.skeletonFamilyId} is not supported; expected ${CURRENT_CREATURE_LAB_SKELETON_FAMILY}.`, code: 'UNSUPPORTED_SKELETON_FAMILY' };
  }
  if (pack.presentation.boneMapProfileId !== CURRENT_CREATURE_LAB_BONE_MAP_PROFILE) {
    return { supported: false, reason: `Bone-map profile ${pack.presentation.boneMapProfileId} is not supported; expected ${CURRENT_CREATURE_LAB_BONE_MAP_PROFILE}.`, code: 'UNSUPPORTED_BONE_MAP' };
  }
  if (!resolveCollisionProfile(definition)) {
    return { supported: false, reason: `Collision profile ${definition.collisionProfileId} is not supported by the current humanoid actor.`, code: 'UNSUPPORTED_COLLISION_PROFILE' };
  }
  if (resolveProgressiveSiteCompatibilityProfile(definition) == null) {
    return { supported: false, reason: `Progressive-site compatibility profile ${definition.damage.compatibilityProgressiveSiteProfileId} is unavailable.`, code: 'MISSING_COMPATIBILITY_PROFILE' };
  }
  const unavailableSegments = definition.damage.supportedSegmentIds.filter((segmentId) => !pack.damage.availableSegmentIds.includes(segmentId));
  if (unavailableSegments.length) {
    return { supported: false, reason: `Definition requests segment(s) absent from the Creature Pack: ${unavailableSegments.join(', ')}.`, code: 'UNAVAILABLE_PACK_SEGMENT' };
  }
  const unsupportedSegments = definition.damage.supportedSegmentIds.filter((segmentId) => !pack.damage.activeRuntimeSegmentIds.includes(segmentId));
  if (unsupportedSegments.length) {
    return { supported: false, reason: `Definition requests segment(s) unsupported by the current humanoid runtime: ${unsupportedSegments.join(', ')}.`, code: 'UNSUPPORTED_RUNTIME_SEGMENT' };
  }
  const approvedNames = new Set(pack.animations.approvedClips.map((clip) => clip.name));
  const unavailableAnimations = definition.animation.selectedAnimationNames.filter((name) => !approvedNames.has(name));
  if (unavailableAnimations.length) {
    return { supported: false, reason: `Definition requests unapproved animation(s): ${unavailableAnimations.join(', ')}.`, code: 'UNAVAILABLE_RUNTIME_ANIMATION' };
  }
  return { supported: true, reason: null, code: 'SUPPORTED' };
}

export function composeHumanoidCreatureRuntimeProfile(pack, definition = getCreatureRuntimePolicy(pack?.packId)) {
  const support = assessCreaturePackRuntimeSupport(pack, definition);
  if (!support.supported) throw new Error(`Creature Definition ${definition?.definitionId ?? 'unknown'} cannot compose with Creature Pack ${pack?.packId ?? 'unknown'}: ${support.reason}`);
  const collisionProfile = resolveCollisionProfile(definition);
  const progressiveDamageSiteFallbacks = resolveProgressiveSiteCompatibilityProfile(definition);
  const selectedAnimationNames = [...definition.animation.selectedAnimationNames];
  const embeddedAnimationPack = pack.animations.delivery === 'embedded' && !pack.assets.animationManifest;
  return Object.freeze({
    name: `creature-definition:${definition.definitionId}`,
    creatureDefinitionId: definition.definitionId,
    creatureDefinitionSchema: definition.schema,
    creaturePackId: pack.packId,
    runtimePolicyId: definition.definitionId,
    voiceProfile: definition.voiceProfile,
    assetPath: pack.assets.glb,
    animationManifestPath: pack.assets.animationManifest,
    animationValidationReportPath: pack.assets.animationValidationReport,
    animationManifestAssetName: animationManifestAssetName(pack.assets.animationManifest),
    damageManifestPath: pack.assets.damageManifest,
    damageValidationReportPath: pack.assets.damageValidationReport,
    rawHeight: pack.presentation.rawHeight,
    targetHeight: definition.presentation.targetHeight,
    animationAuthoritative: definition.animation.animationAuthoritative,
    restPoseAuthoritative: definition.animation.restPoseAuthoritative,
    authoredAnimationPack: definition.animation.authoredAnimationPack,
    authoredDeathAnimations: definition.animation.authoredDeathAnimations,
    ignoreEmbeddedAnimations: definition.animation.ignoreEmbeddedAnimations,
    holdingPoseMode: definition.animation.holdingPoseMode,
    animationFadeSeconds: definition.animation.fadeSeconds,
    walkReferenceSpeed: definition.movement.walkReferenceSpeed,
    animationRuntimeKinds: definition.animation.runtimeKinds,
    embeddedAnimationNames: embeddedAnimationPack ? Object.freeze(selectedAnimationNames) : undefined,
    embeddedAnimationPack,
    ignoredEmbeddedAnimationNames: definition.animation.ignoredEmbeddedAnimationNames,
    requireEmbeddedAnimationApprovalMetadata: definition.animation.requireEmbeddedApprovalMetadata,
    groundClearance: definition.presentation.groundClearance,
    authoredForwardAxis: pack.presentation.authoredForwardAxis,
    rootYaw: definition.presentation.rootYaw,
    rootOffset: definition.presentation.rootOffset,
    boneMap: collisionProfile.boneMap,
    proxyFit: collisionProfile.proxyFit,
    damageAuthoringVersion: pack.authoring.damageVersion,
    damageAuthoringBuildId: pack.authoring.damageBuildId,
    damageTopologyFingerprint: pack.source.topologyFingerprint,
    damageWeightFingerprint: pack.source.weightFingerprint,
    progressiveDamageSiteFallbacks,
    progressiveDamageHitsPerStage: definition.damage.progressiveHitsPerStage,
    terminalProgressiveDamageFatal: definition.mortality.terminalProgressiveDamageFatal,
    durabilityMultiplier: definition.durability.multiplier,
    piercingLethalityMultiplier: definition.durability.piercingLethalityMultiplier,
    maceImpactBlood: definition.damage.maceImpactBlood,
    damageExpectedAnimationNames: Object.freeze(selectedAnimationNames),
    activeDamageSegmentIds: definition.damage.supportedSegmentIds,
    colliderFitNotes: definition.presentation.colliderFitNotes,
  });
}

export function summarizeCreatureDefinition(definition) {
  if (!definition) return null;
  return {
    schema: definition.schema,
    definitionId: definition.definitionId,
    displayName: definition.displayName,
    creaturePackId: definition.creaturePackId,
    targetHeight: definition.presentation.targetHeight,
    groundClearance: definition.presentation.groundClearance,
    rootYaw: definition.presentation.rootYaw,
    holdingPoseMode: definition.animation.holdingPoseMode,
    walkReferenceSpeed: definition.movement.walkReferenceSpeed,
    progressiveDamageHitsPerStage: definition.damage.progressiveHitsPerStage,
    terminalProgressiveDamageFatal: definition.mortality.terminalProgressiveDamageFatal,
    durabilityMultiplier: definition.durability.multiplier,
    piercingLethalityMultiplier: definition.durability.piercingLethalityMultiplier,
    activeDamageSegmentIds: [...definition.damage.supportedSegmentIds],
    selectedAnimationNames: [...definition.animation.selectedAnimationNames],
    compatibilityProgressiveSiteProfileId: definition.damage.compatibilityProgressiveSiteProfileId,
  };
}

export const summarizeCreatureRuntimePolicy = summarizeCreatureDefinition;
