import * as THREE from 'three';

export const SWORD_VITALITY_MULTIPLIERS = Object.freeze({
  head: 3.35,
  face: 3.05,
  skull: 3.45,
  neck: 3.7,
  upper_chest: 2.5,
  lower_chest: 2.4,
  abdomen: 1.5,
  pelvis: 1.25,
  limb: 1,
});

const smoothstep01 = (value) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

export function resolveSwordVitalityMultiplier(regionId, vitalClass = 'none') {
  if (regionId in SWORD_VITALITY_MULTIPLIERS) return SWORD_VITALITY_MULTIPLIERS[regionId];
  if (vitalClass === 'critical') return 3;
  if (vitalClass === 'major') return 1.45;
  return SWORD_VITALITY_MULTIPLIERS.limb;
}

export function deriveSwordCutTrauma({
  travel = 0,
  depth = 0,
  edgeAlignment = 0,
  swingSpeed = 0,
  severity = 0,
  region = null,
} = {}) {
  const travelRatio = THREE.MathUtils.clamp(Math.max(0, travel) / 0.1, 0, 1.5);
  const maximumTissueDepth = Math.max(0.04, Number(region?.maximumTissueDepth) || 0.18);
  const depthRatio = THREE.MathUtils.clamp(Math.max(0, depth) / maximumTissueDepth, 0, 1.25);
  const severityRatio = THREE.MathUtils.clamp(Math.max(0, severity), 0, 1.5);
  const alignmentQuality = smoothstep01((Math.max(0, edgeAlignment) - 0.18) / 0.82);
  const speedQuality = smoothstep01((Math.max(0, swingSpeed) - 0.12) / 1.4);
  const contactQuality = alignmentQuality * (0.25 + speedQuality * 0.75);
  const physicalLoad = travelRatio * 0.4
    + depthRatio * 0.95
    + severityRatio * 0.32
    + travelRatio * depthRatio * 0.42
    + speedQuality * 0.16;
  const vitalityMultiplier = resolveSwordVitalityMultiplier(region?.id, region?.vital);
  const trauma = physicalLoad * contactQuality * vitalityMultiplier * 0.72;
  return {
    trauma: THREE.MathUtils.clamp(trauma, 0, 6),
    travelRatio,
    depthRatio,
    severityRatio,
    alignmentQuality,
    speedQuality,
    contactQuality,
    vitalityMultiplier,
  };
}
