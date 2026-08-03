export const CURRENT_HUMANOID_BONE_MAP = Object.freeze({
  pelvis: 'body', abdomen: 'body_top0', lower_chest: 'body_top1', upper_chest: 'body_top2', neck: 'neck', head: 'head',
  left_upper_arm: 'arm_left_top', left_forearm: 'arm_left_bot', left_hand: 'arm_left_hand',
  right_upper_arm: 'arm_right_top', right_forearm: 'arm_right_bot', right_hand: 'arm_right_hand',
  left_thigh: 'leg_left_top', left_lower_leg: 'leg_left_bot', left_foot: 'leg_left_foot',
  right_thigh: 'leg_right_top', right_lower_leg: 'leg_right_bot', right_foot: 'leg_right_foot',
});

export const DREADGUARD_BONE_MAP = Object.freeze({
  pelvis: 'body', abdomen: 'body_top0', lower_chest: 'body_top1', upper_chest: 'body_top2', neck: 'neck', head: 'head',
  left_upper_arm: 'arm_left_top', left_forearm: 'arm_left_bot', left_hand: 'arm_left_hand',
  right_upper_arm: 'arm_right_top', right_forearm: 'arm_right_bot', right_hand: 'arm_right_hand',
  left_thigh: 'leg_left_top', left_lower_leg: 'leg_left_bot', left_foot: 'leg_left_foot',
  right_thigh: 'leg_right_top', right_lower_leg: 'leg_right_bot', right_foot: 'leg_right_foot',
});

// The portable-surface-stain v001 bundle accidentally exported its authored site as a disabled
// draft. Keep this asset-specific compatibility record until Forge re-exports the site itself.
// Forge manifest sites always take precedence in the runtime.
export const DREADGUARD_PROGRESSIVE_DAMAGE_SITE_FALLBACK = Object.freeze({
  schema: 'dreadstone.progressive_damage_sites.v1',
  version: 1,
  siteId: 'damage_site',
  siteGuid: 'site_9516243fee05472998641a696b301d8f',
  displayName: 'Left Head',
  regionId: 'head',
  structuralGroup: 'head',
  anchorLocal: Object.freeze([0, 0, 0]),
  radius: 0.10000000149011612,
  preferredDirectionLocal: Object.freeze([0.7922517896593416, -0.6004434409317817, -0.1086497861183932]),
  severityAnchors: Object.freeze({
    light: 0.33000001311302185,
    medium: 0.6600000262260437,
    heavy: 1,
  }),
  transitionMode: 'ADJACENT_CROSSFADE',
  transitionCurve: 'SMOOTHSTEP',
  goreTransitionMode: 'MIDPOINT_REPLACE',
  stageOrder: Object.freeze(['LIGHT', 'MEDIUM', 'HEAVY']),
  stages: Object.freeze([
    Object.freeze({
      stage: 'LIGHT',
      stageId: 'stage_7b94d1649b65f203658a1f751b7b1c08',
      damageKeyId: 'damage_key_7446127ace1ec130620c7570f54a620b',
      deformationKeyName: 'Left_Head_Impact_v003_v001',
      activeStampId: 'stamp_6c4f2c90718f4ffc97080f55467bc0f6',
      regionId: 'head',
      regionMode: 'PAIRED_SEGMENT',
      targetObject: 'DSB_ATTACHED_HEAD',
      attachedObject: 'DSB_ATTACHED_HEAD',
      detachedObject: 'DSB_SEGMENT_HEAD',
      recommendedSeverity: 0.33000001311302185,
      measurements: Object.freeze({
        captureCenterLocal: Object.freeze([-0.040580134838819504, 0.06774935126304626, 1.4481897354125977]),
      }),
    }),
    Object.freeze({
      stage: 'MEDIUM',
      stageId: 'stage_e4db37972e51d478f0e34128fb52403d',
      damageKeyId: 'damage_key_d706b05c08d67f84b0912b9d2e94c2b5',
      deformationKeyName: 'Left_Head_Impact_v002',
      activeStampId: 'stamp_8c9120e5e878458786cc6cf2947faa70',
      regionId: 'head',
      regionMode: 'PAIRED_SEGMENT',
      targetObject: 'DSB_ATTACHED_HEAD',
      attachedObject: 'DSB_ATTACHED_HEAD',
      detachedObject: 'DSB_SEGMENT_HEAD',
      recommendedSeverity: 0.6600000262260437,
      measurements: Object.freeze({
        captureCenterLocal: Object.freeze([-0.03496432304382324, 0.07522126287221909, 1.4404948949813843]),
      }),
    }),
    Object.freeze({
      stage: 'HEAVY',
      stageId: 'stage_7fd5c9ed1d06d490ac77d985b9ea8b51',
      damageKeyId: 'damage_key_b582bc132d4554056f5b215562e085d9',
      deformationKeyName: 'Left_Head_Impact_v001',
      activeStampId: 'stamp_ed6dd8537f7b4b33bd19925acff93064',
      regionId: 'head',
      regionMode: 'PAIRED_SEGMENT',
      targetObject: 'DSB_ATTACHED_HEAD',
      attachedObject: 'DSB_ATTACHED_HEAD',
      detachedObject: 'DSB_SEGMENT_HEAD',
      recommendedSeverity: 1,
      measurements: Object.freeze({
        captureCenterLocal: Object.freeze([-0.03496432304382324, 0.07522126287221909, 1.4404948949813843]),
      }),
    }),
  ]),
});

export const CHEZWICK_BONE_MAP = DREADGUARD_BONE_MAP;

const chezwickStage = (stage, key, center) => Object.freeze({
  stage,
  stageId: `chezwick-left-${stage.toLowerCase()}`,
  damageKeyId: `chezwick-${key}`,
  deformationKeyName: key,
  activeStampId: `chezwick-${key}-stamp`,
  regionId: 'body_core',
  regionMode: 'CORE_SINGLE',
  targetObject: 'DSB_BODY_CORE',
  attachedObject: 'DSB_BODY_CORE',
  detachedObject: '',
  recommendedSeverity: stage === 'LIGHT' ? 0.33 : stage === 'MEDIUM' ? 0.66 : 1,
  measurements: Object.freeze({ captureCenterLocal: Object.freeze(center) }),
});

// Forge 3.9.1 exported every left artifact, but intentionally omitted the draft left site.
// These coordinates come from the corresponding authored stamp captures in Chezwick_v001.json.
export const CHEZWICK_LEFT_PROGRESSIVE_DAMAGE_SITE_COMPATIBILITY = Object.freeze({
  schema: 'dreadstone.progressive_damage_sites.v1', version: 1,
  siteId: 'damage_site_face_left_compatibility', displayName: 'Face Left',
  regionId: 'body_core', structuralGroup: 'body_core',
  anchorLocal: Object.freeze([-0.04232534021139145, 0.05473930016160011, 1.3806248903274536]),
  radius: 0.07535883784294128,
  preferredDirectionLocal: Object.freeze([0.8441301282377759, -0.5290202309255155, 0.08707423196784572]),
  severityAnchors: Object.freeze({ light: 0.33, medium: 0.66, heavy: 1 }),
  transitionMode: 'ADJACENT_CROSSFADE', transitionCurve: 'SMOOTHSTEP', goreTransitionMode: 'MIDPOINT_REPLACE',
  stageOrder: Object.freeze(['LIGHT', 'MEDIUM', 'HEAVY']),
  stages: Object.freeze([
    chezwickStage('LIGHT', 'Body_Core_Damage_Left_v003', [-0.04232534021139145, 0.05473930016160011, 1.3806248903274536]),
    chezwickStage('MEDIUM', 'Body_Core_Damage_Left_v002', [-0.04232534021139145, 0.05473930016160011, 1.3806248903274536]),
    chezwickStage('HEAVY', 'Body_Core_Damage_Left_v001', [-0.04232534021139145, 0.05473930016160011, 1.3806248903274536]),
  ]),
  compatibilityDiagnostic: 'CHEZWICK_LEFT_SITE_USING_COMPATIBILITY_FALLBACK',
});

export const CHEZWICK_RUNTIME_ANIMATION_NAMES = Object.freeze([
  'DSB_Death_InstantUnconscious_v001', 'DSB_Hurt_LEFT_Flank_v001', 'DSB_Hurt_RIGHT_Flank_v001',
  'DSB_Idle_Humanoid_v001', 'DSB_Mace_Brace_Head_v001', 'DSB_Walk_NORMAL_v001',
]);

export const DREADGUARD_RUNTIME_ANIMATION_KINDS = Object.freeze([
  'WALK',
  'HURT_LEFT',
  'HURT_RIGHT',
  'DEATH',
]);

export const DREADGUARD_RUNTIME_ANIMATION_NAMES = Object.freeze([
  'DSB_Death_KneesFirst_RIGHT_v001',
  'DSB_Hurt_LEFT_Flank_v001',
  'DSB_Hurt_RIGHT_Flank_v001',
  'DSB_Walk_NORMAL_v001',
]);

export const DREADGUARD_IGNORED_GUARD_ANIMATION_NAMES = Object.freeze([
  'DSB_Mace_Brace_Head_LeftArm_v001',
  'DSB_Mace_Brace_Head_RightArm_v001',
  'DSB_Mace_Brace_Head_TwoArm_v001',
]);

export const CURRENT_HUMANOID_PROFILE = Object.freeze({
  name: 'human_retro_256_combat',
  voiceProfile: 'male_human',
  assetPath: './assets/models/npc/human/human_retro_256.glb',
  rawHeight: 84.771304,
  targetHeight: 2.06,
  rootYaw: 0,
  rootOffset: Object.freeze([0, 0, 0]),
  boneMap: CURRENT_HUMANOID_BONE_MAP,
  idleClipName: 'rig|rig|idle|rig|idle',
  colliderFitNotes: 'Canonical 2.06 m combat profile; existing 18-body/17-joint collider layout is unchanged.',
});

export const DREADGUARD_DAMAGE_COMBAT_PROFILE = Object.freeze({
  name: 'dreadguard_damage_v001_animpack_v003',
  voiceProfile: 'male_human',
  assetPath: './assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb',
  animationManifestPath: './assets/enemies/dreadguard/animations/dreadguard_animpack_v003.json',
  animationValidationReportPath: './assets/enemies/dreadguard/animations/dreadguard_animpack_v003_validation.json',
  animationManifestAssetName: 'dreadguard_animpack_v003.glb',
  damageManifestPath: './assets/enemies/dreadguard/damage/dreadguard_damage_v001.json',
  damageValidationReportPath: './assets/enemies/dreadguard/damage/dreadguard_damage_v001_validation.json',
  rawHeight: 1.4635979019523002,
  targetHeight: 1.5,
  animationAuthoritative: true,
  restPoseAuthoritative: false,
  authoredAnimationPack: true,
  authoredDeathAnimations: true,
  ignoreEmbeddedAnimations: false,
  holdingPoseMode: 'exported_rest_pose',
  animationFadeSeconds: 0.12,
  walkReferenceSpeed: 0.72,
  animationRuntimeKinds: DREADGUARD_RUNTIME_ANIMATION_KINDS,
  ignoredEmbeddedAnimationNames: DREADGUARD_IGNORED_GUARD_ANIMATION_NAMES,
  requireEmbeddedAnimationApprovalMetadata: true,
  groundClearance: 0.02,
  authoredForwardAxis: '+Y',
  rootYaw: Math.PI,
  rootOffset: Object.freeze([0, 0, 0]),
  boneMap: DREADGUARD_BONE_MAP,
  proxyFit: Object.freeze({
    pelvis: Object.freeze({ shape: 'box', halfExtents: Object.freeze([0.17, 0.11, 0.11]), bone: 'body' }),
    abdomen: Object.freeze({ shape: 'box', halfExtents: Object.freeze([0.16, 0.09, 0.11]), start: 'body', end: 'body_top0' }),
    lower_chest: Object.freeze({ shape: 'box', halfExtents: Object.freeze([0.21, 0.09, 0.12]), start: 'body_top0', end: 'body_top1' }),
    upper_chest: Object.freeze({ shape: 'box', halfExtents: Object.freeze([0.25, 0.11, 0.13]), start: 'body_top1', end: 'body_top2' }),
    neck: Object.freeze({ shape: 'capsule', radius: 0.065, halfHeight: 0.02, start: 'neck', end: 'head' }),
    head: Object.freeze({ shape: 'capsule', radius: 0.105, halfHeight: 0.035, bone: 'head', offset: Object.freeze([0, 0.065, 0]) }),
    left_upper_arm: Object.freeze({ shape: 'capsule', radius: 0.07, halfHeight: 0.045, start: 'arm_left_top', end: 'arm_left_bot' }),
    left_forearm: Object.freeze({ shape: 'capsule', radius: 0.058, halfHeight: 0.09, start: 'arm_left_bot', end: 'arm_left_hand' }),
    left_hand: Object.freeze({ shape: 'box', halfExtents: Object.freeze([0.055, 0.085, 0.04]), bone: 'arm_left_hand', offset: Object.freeze([0, 0.055, 0]) }),
    right_upper_arm: Object.freeze({ shape: 'capsule', radius: 0.07, halfHeight: 0.045, start: 'arm_right_top', end: 'arm_right_bot' }),
    right_forearm: Object.freeze({ shape: 'capsule', radius: 0.058, halfHeight: 0.09, start: 'arm_right_bot', end: 'arm_right_hand' }),
    right_hand: Object.freeze({ shape: 'box', halfExtents: Object.freeze([0.055, 0.085, 0.04]), bone: 'arm_right_hand', offset: Object.freeze([0, 0.055, 0]) }),
    left_thigh: Object.freeze({ shape: 'capsule', radius: 0.09, halfHeight: 0.075, start: 'leg_left_top', end: 'leg_left_bot' }),
    left_lower_leg: Object.freeze({ shape: 'capsule', radius: 0.07, halfHeight: 0.145, start: 'leg_left_bot', end: 'leg_left_foot' }),
    left_foot: Object.freeze({ shape: 'box', halfExtents: Object.freeze([0.075, 0.055, 0.13]), bone: 'leg_left_foot', offset: Object.freeze([0, 0.08, 0]) }),
    right_thigh: Object.freeze({ shape: 'capsule', radius: 0.09, halfHeight: 0.075, start: 'leg_right_top', end: 'leg_right_bot' }),
    right_lower_leg: Object.freeze({ shape: 'capsule', radius: 0.07, halfHeight: 0.145, start: 'leg_right_bot', end: 'leg_right_foot' }),
    right_foot: Object.freeze({ shape: 'box', halfExtents: Object.freeze([0.075, 0.055, 0.13]), bone: 'leg_right_foot', offset: Object.freeze([0, 0.08, 0]) }),
  }),
  damageAuthoringVersion: '3.9.1',
  damageAuthoringBuildId: '2026-07-18.source-contract.1',
  damageTopologyFingerprint: '880eabb3e8810327a1e60bd9e8313ad1acd65dff33970f6ae3c01ce2a459a2c8',
  damageWeightFingerprint: '17ab81330545a1a9c2506bf9151f3b99deaa7a674835bbb15d77228a2e5b9b97',
  progressiveDamageSiteFallbacks: Object.freeze([DREADGUARD_PROGRESSIVE_DAMAGE_SITE_FALLBACK]),
  damageExpectedAnimationNames: DREADGUARD_RUNTIME_ANIMATION_NAMES,
  activeDamageSegmentIds: Object.freeze(['head_neck', 'left_elbow', 'right_elbow']),
  colliderFitNotes: 'Folsom and Combat Lab Forge Dreadguard baseline. Approved pack v003 owns walk, side hurt, and knees-first death while the exported rest pose remains the stationary holding pose. The three embedded mace guard clips are intentionally unregistered. The +Y authored forward axis is converted by the profile yaw. Manifest-authored head/forearm detachment remains active.',
});

export const CHEZWICK_DAMAGE_COMBAT_PROFILE = Object.freeze({
  ...DREADGUARD_DAMAGE_COMBAT_PROFILE,
  name: 'chezwick_damage_v001',
  assetPath: './assets/enemies/chezwick/damage/chezwick_v001.glb',
  animationManifestPath: null,
  animationValidationReportPath: null,
  animationManifestAssetName: null,
  damageManifestPath: './assets/enemies/chezwick/damage/chezwick_v001.json',
  damageValidationReportPath: './assets/enemies/chezwick/damage/chezwick_v001_validation.json',
  rawHeight: 1.5001617883459184,
  targetHeight: 1.5,
  rootYaw: Math.PI,
  animationRuntimeKinds: Object.freeze(['IDLE', 'WALK', 'HURT_LEFT', 'HURT_RIGHT', 'MACE_GUARD_RIGHT_ARM', 'DEATH']),
  embeddedAnimationNames: CHEZWICK_RUNTIME_ANIMATION_NAMES,
  ignoredEmbeddedAnimationNames: null,
  embeddedAnimationPack: true,
  progressiveDamageSiteFallbacks: Object.freeze([CHEZWICK_LEFT_PROGRESSIVE_DAMAGE_SITE_COMPATIBILITY]),
  progressiveDamageHitsPerStage: 2,
  terminalProgressiveDamageFatal: true,
  durabilityMultiplier: 2,
  piercingLethalityMultiplier: 2,
  maceImpactBlood: true,
  damageAuthoringVersion: '3.9.1',
  damageAuthoringBuildId: '2026-07-18.source-contract.1',
  damageTopologyFingerprint: '243b1dd1253950ad92a27385f429c427c25d002519e510e5f7e9e55735e255a4',
  damageWeightFingerprint: 'b8ea4c943563c8831f9975bfdbe1249f236ad782f07f8d1825a6e474d6d97050',
  damageExpectedAnimationNames: CHEZWICK_RUNTIME_ANIMATION_NAMES,
  activeDamageSegmentIds: Object.freeze(['head_neck', 'left_elbow', 'right_elbow']),
  colliderFitNotes: 'Chezwick Folsom baseline: 1.5 m +Y humanoid, embedded approved combat clips, bilateral face damage, and two-times survivability.',
});

export function getHumanoidProfileScale(profile) {
  return profile.targetHeight / profile.rawHeight;
}

export function isHumanoidPoseAuthoritative(profile) {
  return profile?.animationAuthoritative === true || profile?.restPoseAuthoritative === true;
}
