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
  name: 'dreadguard_damage_v001_no_animation',
  voiceProfile: 'male_human',
  assetPath: './assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb',
  damageManifestPath: './assets/enemies/dreadguard/damage/dreadguard_damage_v001.json',
  damageValidationReportPath: './assets/enemies/dreadguard/damage/dreadguard_damage_v001_validation.json',
  rawHeight: 1.4635979019523002,
  targetHeight: 1.82,
  animationAuthoritative: false,
  authoredAnimationPack: false,
  authoredDeathAnimations: false,
  ignoreEmbeddedAnimations: true,
  noAnimationFallback: 'physics_bound_rest_pose',
  groundClearance: 0.02,
  rootYaw: 0,
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
  damageExpectedAnimationNames: Object.freeze([]),
  activeDamageSegmentIds: Object.freeze(['head_neck', 'left_elbow', 'right_elbow']),
  colliderFitNotes: 'Folsom and Combat Lab Forge v3.9.1 Dreadguard baseline. The exported rest pose uses the established physics-bound no-animation fallback; manifest-authored head/forearm detachment remains active.',
});

export function getHumanoidProfileScale(profile) {
  return profile.targetHeight / profile.rawHeight;
}
