import { assertValidCreaturePack } from '../../contracts/CreaturePack.js';
import {
  CHEZWICK_BONE_MAP,
  CHEZWICK_LEFT_PROGRESSIVE_DAMAGE_SITE_COMPATIBILITY,
  CHEZWICK_RUNTIME_ANIMATION_NAMES,
  CURRENT_HUMANOID_BONE_MAP,
  DREADGUARD_BONE_MAP,
  DREADGUARD_DAMAGE_COMBAT_PROFILE,
  DREADGUARD_IGNORED_GUARD_ANIMATION_NAMES,
  DREADGUARD_PROGRESSIVE_DAMAGE_SITE_FALLBACK,
  DREADGUARD_RUNTIME_ANIMATION_KINDS,
  DREADGUARD_RUNTIME_ANIMATION_NAMES,
} from '../combat/HumanoidModelProfiles.js';

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

const SHARED_HUMANOID_POLICY = Object.freeze({
  voiceProfile: 'male_human',
  targetHeight: 1.5,
  animationAuthoritative: true,
  restPoseAuthoritative: false,
  authoredAnimationPack: true,
  authoredDeathAnimations: true,
  ignoreEmbeddedAnimations: false,
  holdingPoseMode: 'exported_rest_pose',
  animationFadeSeconds: 0.12,
  walkReferenceSpeed: 0.72,
  groundClearance: 0.02,
  rootYaw: Math.PI,
  rootOffset: Object.freeze([0, 0, 0]),
  proxyFit: DREADGUARD_DAMAGE_COMBAT_PROFILE.proxyFit,
  activeDamageSegmentIds: Object.freeze(['head_neck', 'left_elbow', 'right_elbow']),
});

export const DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES = Object.freeze([
  'DSB_Idle_Humanoid_v002',
  'DSB_Walk_NORMAL_v002',
  'DSB_Hurt_LEFT_Flank_v001',
  'DSB_Hurt_RIGHT_Flank_v001',
  'DSB_Death_ChestHold_LEFT_v001',
  'DSB_Death_ChestHold_LEFT_v002',
]);

export const DREAD_RAM_GOD_CREATURE_RUNTIME_POLICY = Object.freeze({
  ...SHARED_HUMANOID_POLICY,
  policyId: 'dread_ram_god_damage_v001.runtime.v1',
  packId: 'dread_ram_god_damage_v001',
  boneMap: CURRENT_HUMANOID_BONE_MAP,
  animationRuntimeKinds: Object.freeze(['IDLE', 'WALK', 'HURT_LEFT', 'HURT_RIGHT', 'DEATH']),
  selectedAnimationNames: DREAD_RAM_GOD_RUNTIME_ANIMATION_NAMES,
  ignoredEmbeddedAnimationNames: null,
  requireEmbeddedAnimationApprovalMetadata: true,
  progressiveDamageSiteFallbacks: Object.freeze([]),
  progressiveDamageHitsPerStage: 1,
  terminalProgressiveDamageFatal: false,
  colliderFitNotes: 'Creature Lab Dread Ram God policy: current humanoid collision fit, six selected embedded clips, four native progressive sites, and the three currently certified detachable segments.',
});

export const DREADGUARD_CREATURE_RUNTIME_POLICY = Object.freeze({
  ...SHARED_HUMANOID_POLICY,
  policyId: 'dreadguard_damage_v001.runtime.v1',
  packId: 'dreadguard_damage_v001',
  boneMap: DREADGUARD_BONE_MAP,
  animationRuntimeKinds: DREADGUARD_RUNTIME_ANIMATION_KINDS,
  selectedAnimationNames: DREADGUARD_RUNTIME_ANIMATION_NAMES,
  ignoredEmbeddedAnimationNames: DREADGUARD_IGNORED_GUARD_ANIMATION_NAMES,
  requireEmbeddedAnimationApprovalMetadata: true,
  progressiveDamageSiteFallbacks: Object.freeze([DREADGUARD_PROGRESSIVE_DAMAGE_SITE_FALLBACK]),
  colliderFitNotes: 'Creature Lab Dreadguard policy: current humanoid collision fit, exported holding pose, selected walk/hurt/death clips, and compatibility-only left-head progression.',
});

export const CHEZWICK_CREATURE_RUNTIME_POLICY = Object.freeze({
  ...SHARED_HUMANOID_POLICY,
  policyId: 'chezwick_damage_v001.runtime.v1',
  packId: 'chezwick_damage_v001',
  boneMap: CHEZWICK_BONE_MAP,
  animationRuntimeKinds: Object.freeze(['IDLE', 'WALK', 'HURT_LEFT', 'HURT_RIGHT', 'MACE_GUARD_RIGHT_ARM', 'DEATH']),
  selectedAnimationNames: CHEZWICK_RUNTIME_ANIMATION_NAMES,
  ignoredEmbeddedAnimationNames: null,
  requireEmbeddedAnimationApprovalMetadata: true,
  progressiveDamageSiteFallbacks: Object.freeze([CHEZWICK_LEFT_PROGRESSIVE_DAMAGE_SITE_COMPATIBILITY]),
  progressiveDamageHitsPerStage: 2,
  terminalProgressiveDamageFatal: true,
  durabilityMultiplier: 2,
  piercingLethalityMultiplier: 2,
  maceImpactBlood: true,
  colliderFitNotes: 'Creature Lab Chezwick policy: current humanoid collision fit, selected embedded combat clips, bilateral face progression, and two-times survivability.',
});

const POLICIES = new Map([
  [CHEZWICK_CREATURE_RUNTIME_POLICY.packId, CHEZWICK_CREATURE_RUNTIME_POLICY],
  [DREAD_RAM_GOD_CREATURE_RUNTIME_POLICY.packId, DREAD_RAM_GOD_CREATURE_RUNTIME_POLICY],
  [DREADGUARD_CREATURE_RUNTIME_POLICY.packId, DREADGUARD_CREATURE_RUNTIME_POLICY],
]);

function animationManifestAssetName(path) {
  if (!path) return null;
  const basename = path.split('/').pop()?.split(/[?#]/, 1)[0] ?? '';
  return basename.replace(/\.json$/i, '.glb');
}

function validatePolicyBoundary(policy) {
  const duplicated = CREATURE_PACK_TECHNICAL_PROFILE_FIELDS.filter((field) => field in (policy ?? {}));
  if (duplicated.length) throw new Error(`Creature runtime policy ${policy?.policyId ?? 'unknown'} duplicates Creature Pack truth: ${duplicated.join(', ')}`);
}

export function getCreatureRuntimePolicy(packId) {
  return POLICIES.get(packId) ?? null;
}

export function listCreatureRuntimePolicies() {
  return [...POLICIES.values()];
}

export function assessCreaturePackRuntimeSupport(pack, policy = getCreatureRuntimePolicy(pack?.packId)) {
  try {
    assertValidCreaturePack(pack);
  } catch (error) {
    return { supported: false, reason: error.message, code: 'INVALID_DESCRIPTOR' };
  }
  if (pack.presentation.skeletonFamilyId !== CURRENT_CREATURE_LAB_SKELETON_FAMILY) {
    return { supported: false, reason: `Skeleton family ${pack.presentation.skeletonFamilyId} is not supported; expected ${CURRENT_CREATURE_LAB_SKELETON_FAMILY}.`, code: 'UNSUPPORTED_SKELETON_FAMILY' };
  }
  if (pack.presentation.boneMapProfileId !== CURRENT_CREATURE_LAB_BONE_MAP_PROFILE) {
    return { supported: false, reason: `Bone-map profile ${pack.presentation.boneMapProfileId} is not supported; expected ${CURRENT_CREATURE_LAB_BONE_MAP_PROFILE}.`, code: 'UNSUPPORTED_BONE_MAP' };
  }
  if (!policy) return { supported: false, reason: `No game-authored runtime policy is registered for ${pack.packId}.`, code: 'MISSING_RUNTIME_POLICY' };
  try {
    validatePolicyBoundary(policy);
  } catch (error) {
    return { supported: false, reason: error.message, code: 'INVALID_RUNTIME_POLICY' };
  }
  const unavailableSegments = (policy.activeDamageSegmentIds ?? []).filter((segmentId) => !pack.damage.availableSegmentIds.includes(segmentId));
  if (unavailableSegments.length) {
    return { supported: false, reason: `Runtime policy requests unavailable segment(s): ${unavailableSegments.join(', ')}.`, code: 'UNAVAILABLE_RUNTIME_SEGMENT' };
  }
  const approvedNames = new Set(pack.animations.approvedClips.map((clip) => clip.name));
  const unavailableAnimations = (policy.selectedAnimationNames ?? []).filter((name) => !approvedNames.has(name));
  if (unavailableAnimations.length) {
    return { supported: false, reason: `Runtime policy requests unapproved animation(s): ${unavailableAnimations.join(', ')}.`, code: 'UNAVAILABLE_RUNTIME_ANIMATION' };
  }
  return { supported: true, reason: null, code: 'SUPPORTED' };
}

export function composeHumanoidCreatureRuntimeProfile(pack, policy = getCreatureRuntimePolicy(pack?.packId)) {
  const support = assessCreaturePackRuntimeSupport(pack, policy);
  if (!support.supported) throw new Error(`Creature Pack ${pack?.packId ?? 'unknown'} cannot compose: ${support.reason}`);
  const selectedAnimationNames = [...policy.selectedAnimationNames];
  const embeddedAnimationPack = pack.animations.delivery === 'embedded' && !pack.assets.animationManifest;
  return Object.freeze({
    name: `creature-pack:${pack.packId}`,
    creaturePackId: pack.packId,
    runtimePolicyId: policy.policyId,
    voiceProfile: policy.voiceProfile,
    assetPath: pack.assets.glb,
    animationManifestPath: pack.assets.animationManifest,
    animationValidationReportPath: pack.assets.animationValidationReport,
    animationManifestAssetName: animationManifestAssetName(pack.assets.animationManifest),
    damageManifestPath: pack.assets.damageManifest,
    damageValidationReportPath: pack.assets.damageValidationReport,
    rawHeight: pack.presentation.rawHeight,
    targetHeight: policy.targetHeight,
    animationAuthoritative: policy.animationAuthoritative,
    restPoseAuthoritative: policy.restPoseAuthoritative,
    authoredAnimationPack: policy.authoredAnimationPack,
    authoredDeathAnimations: policy.authoredDeathAnimations,
    ignoreEmbeddedAnimations: policy.ignoreEmbeddedAnimations,
    holdingPoseMode: policy.holdingPoseMode,
    animationFadeSeconds: policy.animationFadeSeconds,
    walkReferenceSpeed: policy.walkReferenceSpeed,
    animationRuntimeKinds: policy.animationRuntimeKinds,
    embeddedAnimationNames: embeddedAnimationPack ? Object.freeze(selectedAnimationNames) : undefined,
    embeddedAnimationPack,
    ignoredEmbeddedAnimationNames: policy.ignoredEmbeddedAnimationNames,
    requireEmbeddedAnimationApprovalMetadata: policy.requireEmbeddedAnimationApprovalMetadata === true,
    groundClearance: policy.groundClearance,
    authoredForwardAxis: pack.presentation.authoredForwardAxis,
    rootYaw: policy.rootYaw,
    rootOffset: policy.rootOffset,
    boneMap: policy.boneMap,
    proxyFit: policy.proxyFit,
    damageAuthoringVersion: pack.authoring.damageVersion,
    damageAuthoringBuildId: pack.authoring.damageBuildId,
    damageTopologyFingerprint: pack.source.topologyFingerprint,
    damageWeightFingerprint: pack.source.weightFingerprint,
    progressiveDamageSiteFallbacks: policy.progressiveDamageSiteFallbacks,
    progressiveDamageHitsPerStage: policy.progressiveDamageHitsPerStage,
    terminalProgressiveDamageFatal: policy.terminalProgressiveDamageFatal,
    durabilityMultiplier: policy.durabilityMultiplier,
    piercingLethalityMultiplier: policy.piercingLethalityMultiplier,
    maceImpactBlood: policy.maceImpactBlood,
    damageExpectedAnimationNames: Object.freeze(selectedAnimationNames),
    activeDamageSegmentIds: policy.activeDamageSegmentIds,
    colliderFitNotes: policy.colliderFitNotes,
  });
}

export function summarizeCreatureRuntimePolicy(policy) {
  if (!policy) return null;
  return {
    policyId: policy.policyId,
    packId: policy.packId,
    targetHeight: policy.targetHeight,
    groundClearance: policy.groundClearance,
    rootYaw: policy.rootYaw,
    holdingPoseMode: policy.holdingPoseMode,
    walkReferenceSpeed: policy.walkReferenceSpeed,
    progressiveDamageHitsPerStage: policy.progressiveDamageHitsPerStage ?? 1,
    terminalProgressiveDamageFatal: policy.terminalProgressiveDamageFatal === true,
    durabilityMultiplier: policy.durabilityMultiplier ?? 1,
    piercingLethalityMultiplier: policy.piercingLethalityMultiplier ?? 1,
    activeDamageSegmentIds: [...(policy.activeDamageSegmentIds ?? [])],
    selectedAnimationNames: [...(policy.selectedAnimationNames ?? [])],
    compatibilityProgressiveSiteIds: (policy.progressiveDamageSiteFallbacks ?? []).map((site) => site.siteId),
  };
}
