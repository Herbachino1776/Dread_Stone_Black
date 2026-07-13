import * as THREE from 'three';

export const COMBAT_PRESENTATION_CONFIG = Object.freeze({
  bloodActivationDelaySeconds: 0.055,
  resistanceEventCadenceSeconds: 0.05,
  impactMemoryDecayPerSecond: 0.075,
  impactMemoryMaximum: 1,
  tissue: Object.freeze({
    skinMinimumMultiplier: 0.68,
    skinMaximumMultiplier: 0.94,
    muscleMaximumMultiplier: 1.48,
    muscleRampDepth: 0.11,
    boneApproachDistance: 0.018,
    boneApproachMultiplier: 0.72,
    withdrawalMinimumMultiplier: 1.06,
    withdrawalMaximumMultiplier: 1.42,
  }),
  weapon: Object.freeze({
    maximumCompression: 0.006,
    maximumRecoil: 0.0045,
    maximumVibration: 0.00075,
    maximumRotation: THREE.MathUtils.degToRad(2.4),
  }),
});

export const MELEE_SPACING_CONFIG = Object.freeze({
  minimumLoadClearance: 0.06,
  penetrationOvertravelReserve: 0.025,
  standingTargetSurfaceExtent: 0.12,
});

const clamp01 = (value) => THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
const smoothstep = (value) => { const t = clamp01(value); return t * t * (3 - 2 * t); };

export function deterministicCombatVariation(value = '') {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 0xffffffff) * 2 - 1;
}

export function resolveMeleeSpacingEnvelope({ playerRadius = 0.35, readyReach = 0, gestureReach = 0, effectiveDepth = 0, targetSurfaceExtent = MELEE_SPACING_CONFIG.standingTargetSurfaceExtent } = {}) {
  const loadingClearance = Math.max(MELEE_SPACING_CONFIG.minimumLoadClearance, gestureReach - effectiveDepth - MELEE_SPACING_CONFIG.penetrationOvertravelReserve);
  const minimumCenterDistance = targetSurfaceExtent + readyReach + loadingClearance;
  const blockerRadius = Math.max(0.2, minimumCenterDistance - playerRadius);
  const fullGestureDepth = readyReach + gestureReach - (minimumCenterDistance - targetSurfaceExtent);
  return Object.freeze({ playerRadius, readyReach, gestureReach, effectiveDepth, targetSurfaceExtent, loadingClearance, minimumCenterDistance, blockerRadius, fullGestureDepth });
}

export function applyMeleeSpacingEnvelope(blocker, options = {}) {
  if (!blocker) return null;
  const envelope = resolveMeleeSpacingEnvelope(options);
  blocker.meleeSpacingRadius = envelope.blockerRadius;
  blocker.radius = envelope.blockerRadius;
  blocker.userData = { ...(blocker.userData ?? {}), meleeSpacing: envelope };
  return envelope;
}

export function getImpactMemoryChannel(regionId = '') {
  if (['upper_chest', 'lower_chest', 'abdomen', 'neck'].includes(regionId)) return 'torso';
  if (regionId.startsWith('left_') && /arm|forearm|hand/.test(regionId)) return 'leftArm';
  if (regionId.startsWith('right_') && /arm|forearm|hand/.test(regionId)) return 'rightArm';
  if (regionId.startsWith('left_') && /thigh|leg|foot/.test(regionId)) return 'leftLeg';
  if (regionId.startsWith('right_') && /thigh|leg|foot/.test(regionId)) return 'rightLeg';
  return null;
}

export function sampleTissueResistanceCurve({
  depth = 0,
  surfaceThickness = 0.012,
  softTissueResistance = 0.5,
  hardDepth = null,
  hardStructureResistance = 0,
  withdrawing = false,
} = {}, target = {}) {
  const config = COMBAT_PRESENTATION_CONFIG.tissue;
  const boundedDepth = Math.max(0, Number(depth) || 0);
  const skinDepth = Math.max(0.004, Number(surfaceThickness) || 0.012);
  const skinProgress = smoothstep(boundedDepth / skinDepth);
  const muscleProgress = smoothstep((boundedDepth - skinDepth) / config.muscleRampDepth);
  const skinMultiplier = THREE.MathUtils.lerp(config.skinMinimumMultiplier, config.skinMaximumMultiplier, skinProgress);
  const muscleMultiplier = THREE.MathUtils.lerp(1, config.muscleMaximumMultiplier, muscleProgress);
  const boneProgress = hardDepth == null
    ? 0
    : smoothstep((boundedDepth - Math.max(0, hardDepth - config.boneApproachDistance)) / config.boneApproachDistance);
  const withdrawalProgress = smoothstep(boundedDepth / (skinDepth * 2.2));
  const withdrawalMultiplier = withdrawing
    ? THREE.MathUtils.lerp(config.withdrawalMinimumMultiplier, config.withdrawalMaximumMultiplier, withdrawalProgress)
    : 1;
  const softResistance = Math.max(0.2, softTissueResistance) * (boundedDepth <= skinDepth ? skinMultiplier : muscleMultiplier);
  const boneResistance = Math.max(0, hardStructureResistance) * boneProgress * config.boneApproachMultiplier;
  target.phase = withdrawing
    ? withdrawalProgress < 0.22 ? 'surface_release' : 'withdrawal_stick'
    : boneProgress > 0.78 ? 'bone_approach' : boundedDepth <= skinDepth ? 'skin' : 'muscle';
  target.skinProgress = skinProgress;
  target.muscleProgress = muscleProgress;
  target.boneProgress = boneProgress;
  target.withdrawalProgress = withdrawalProgress;
  target.effectiveResistance = Math.max(0.3, (softResistance + boneResistance) * withdrawalMultiplier);
  target.drag = clamp01((target.effectiveResistance - 0.3) / 1.8);
  target.deflection = boneProgress * clamp01(hardStructureResistance / 2);
  return target;
}

export function resolveWeaponMicroResponse(kind = 'surface_stop', intensity = 0.2, variation = 0, target = {}) {
  const amount = clamp01(intensity);
  const sign = variation < 0 ? -1 : 1;
  let duration = 0.13;
  let compression = 0.0024;
  let recoil = 0;
  let roll = THREE.MathUtils.degToRad(0.65);
  let twist = THREE.MathUtils.degToRad(0.4);
  let vibration = 0.00022;

  if (kind === 'surface_compression') {
    duration = 0.145; compression = 0.0032; roll = THREE.MathUtils.degToRad(0.9); twist = THREE.MathUtils.degToRad(0.55);
  } else if (kind === 'surface_rupture') {
    duration = 0.16; compression = 0.0038; roll = THREE.MathUtils.degToRad(1.2); twist = THREE.MathUtils.degToRad(0.8); vibration = 0.00038;
  } else if (kind === 'muscle_drag' || kind === 'lateral_bind') {
    duration = 0.17; compression = 0.0042; roll = THREE.MathUtils.degToRad(1.45); twist = THREE.MathUtils.degToRad(1.05); vibration = 0.00032;
  } else if (kind === 'hard_stop' || kind === 'bone_approach') {
    duration = 0.2; compression = 0.006; recoil = 0.0022; roll = THREE.MathUtils.degToRad(2.2); twist = THREE.MathUtils.degToRad(1.6); vibration = 0.00075;
  } else if (kind === 'failed_tip_stop' || kind === 'glancing_contact' || kind === 'surface_scrape') {
    duration = 0.17; compression = 0.0036; recoil = 0.0018; roll = THREE.MathUtils.degToRad(1.8); twist = THREE.MathUtils.degToRad(1.3); vibration = 0.00042;
  } else if (kind === 'withdrawal_stick') {
    duration = 0.15; compression = 0.0034; roll = THREE.MathUtils.degToRad(1.1); twist = THREE.MathUtils.degToRad(0.85); vibration = 0.00026;
  } else if (kind === 'surface_release' || kind === 'withdrawal_release') {
    duration = 0.19; compression = 0; recoil = 0.0045; roll = THREE.MathUtils.degToRad(1.15); twist = THREE.MathUtils.degToRad(0.7); vibration = 0.0003;
  } else if (kind === 'recovery_settle' || kind === 'tissue_settle') {
    duration = 0.18; compression = 0.0012; recoil = 0.001; roll = THREE.MathUtils.degToRad(0.5); twist = THREE.MathUtils.degToRad(0.3); vibration = 0;
  }

  const scale = 0.55 + amount * 0.45;
  const limits = COMBAT_PRESENTATION_CONFIG.weapon;
  target.kind = kind;
  target.duration = duration;
  target.compression = Math.min(limits.maximumCompression, compression * scale);
  target.recoil = Math.min(limits.maximumRecoil, recoil * scale);
  target.roll = THREE.MathUtils.clamp(roll * scale * sign, -limits.maximumRotation, limits.maximumRotation);
  target.twist = THREE.MathUtils.clamp(twist * scale * variation, -limits.maximumRotation, limits.maximumRotation);
  target.vibration = Math.min(limits.maximumVibration, vibration * scale);
  return target;
}
