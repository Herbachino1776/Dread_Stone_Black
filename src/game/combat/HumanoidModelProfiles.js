export const CURRENT_HUMANOID_BONE_MAP = Object.freeze({
  pelvis: 'body', abdomen: 'body_top0', lower_chest: 'body_top1', upper_chest: 'body_top2', neck: 'neck', head: 'head',
  left_upper_arm: 'arm_left_top', left_forearm: 'arm_left_bot', left_hand: 'arm_left_hand',
  right_upper_arm: 'arm_right_top', right_forearm: 'arm_right_bot', right_hand: 'arm_right_hand',
  left_thigh: 'leg_left_top', left_lower_leg: 'leg_left_bot', left_foot: 'leg_left_foot',
  right_thigh: 'leg_right_top', right_lower_leg: 'leg_right_bot', right_foot: 'leg_right_foot',
});

export const MODEL_IDLE_BONE_MAP = Object.freeze({
  pelvis: 'body', abdomen: 'body_top0', lower_chest: 'body_top1', upper_chest: 'body_top2', neck: 'neck', head: 'head',
  left_upper_arm: 'arm_left_top', left_forearm: 'arm_left_bot', left_hand: 'arm_left_hand',
  right_upper_arm: 'arm_right_top', right_forearm: 'arm_right_bot', right_hand: 'arm_right_hand',
  left_thigh: 'leg_left_top', left_lower_leg: 'leg_left_bot', left_foot: 'leg_left_foot',
  right_thigh: 'leg_right_top', right_lower_leg: 'leg_right_bot', right_foot: 'leg_right_foot',
});

export const CURRENT_HUMANOID_PROFILE = Object.freeze({
  name: 'human_retro_256_combat',
  assetPath: './assets/models/npc/human/human_retro_256.glb',
  rawHeight: 84.771304,
  targetHeight: 2.06,
  rootYaw: 0,
  rootOffset: Object.freeze([0, 0, 0]),
  boneMap: CURRENT_HUMANOID_BONE_MAP,
  idleClipName: 'rig|rig|idle|rig|idle',
  colliderFitNotes: 'Canonical 2.06 m combat profile; existing 18-body/17-joint collider layout is unchanged.',
});

export const MODEL_IDLE_COMBAT_PROFILE = Object.freeze({
  name: 'model_idle_combat_diagnostic',
  assetPath: './assets/models/npc/human/model_idle.glb',
  rawHeight: 84.1329999069915,
  targetHeight: 1.82,
  rootYaw: 0,
  rootOffset: Object.freeze([0, 0, 0]),
  boneMap: MODEL_IDLE_BONE_MAP,
  idleClipName: 'rig|rig|idle|rig|idle',
  colliderFitNotes: 'Diagnostic-only profile. Uses the unchanged canonical anatomy proxies, which are taller than this 1.82 m visual and are intentionally not refit in the A/B pass.',
});

export function getHumanoidProfileScale(profile) {
  return profile.targetHeight / profile.rawHeight;
}
