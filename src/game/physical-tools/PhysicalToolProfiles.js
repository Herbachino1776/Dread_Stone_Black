export const PHYSICAL_TOOL_ACTIONS = Object.freeze({
  cut: 'cut',
  chop: 'chop',
  pry: 'pry',
});

export const PHYSICAL_TOOL_PROFILES = Object.freeze({
  old_work_knife: Object.freeze({
    id: 'old_work_knife',
    actionType: PHYSICAL_TOOL_ACTIONS.cut,
    equipmentSlot: 'tool',
    minTravelPx: 42,
    minVelocityPxPerSecond: 120,
    maxVelocityPxPerSecond: 4200,
    minSmoothness: 0.28,
    preferredAngleRadians: Math.PI * 0.25,
    angleMode: 'axis',
    angleToleranceRadians: 1,
    cooldownSeconds: 0.28,
    contactRadiusPx: 54,
    recoilSeconds: 0.18,
    shake: Object.freeze({ durationMs: 115, intensity: 0.038 }),
    finalShake: Object.freeze({ durationMs: 390, intensity: 0.15 }),
    viewmodel: Object.freeze({
      ready: Object.freeze({ screen: Object.freeze([0.48, -0.5]), depth: 1.18, rotation: Object.freeze([-0.18, -0.18, 0.34]), motion: Object.freeze([0.55, 0.46]) }),
      grip: Object.freeze({ local: Object.freeze([0, -0.3, 0]), viewportRatio: 0.2, minRadiusPx: 72, maxRadiusPx: 112 }),
      active: Object.freeze({ local: Object.freeze([0, 0.5, 0]) }),
      follow: 22,
      recoil: Object.freeze({ depth: 0.13, pitch: 0.18 }),
    }),
  }),
  wood_axe: Object.freeze({
    id: 'wood_axe',
    actionType: PHYSICAL_TOOL_ACTIONS.chop,
    equipmentSlot: 'weapon',
    minTravelPx: 86,
    minVelocityPxPerSecond: 115,
    maxVelocityPxPerSecond: 720,
    minSmoothness: 0.7,
    preferredAngleRadians: Math.PI * 0.5,
    angleMode: 'axis',
    angleToleranceRadians: 0.78,
    cooldownSeconds: 0.62,
    contactRadiusPx: 64,
    recoilSeconds: 0.3,
    shake: Object.freeze({ durationMs: 210, intensity: 0.085 }),
    finalShake: Object.freeze({ durationMs: 650, intensity: 0.205 }),
    viewmodel: Object.freeze({
      ready: Object.freeze({ screen: Object.freeze([0.82, -0.56]), depth: 1.58, rotation: Object.freeze([-0.1, -0.2, 0.12]), motion: Object.freeze([0.42, 0.34]) }),
      grip: Object.freeze({ local: Object.freeze([0, -0.28, 0]), viewportRatio: 0.21, minRadiusPx: 76, maxRadiusPx: 122 }),
      active: Object.freeze({ local: Object.freeze([-0.4, 0.62, 0]) }),
      follow: 9.2,
      recoil: Object.freeze({ depth: 0.2, pitch: 0.25 }),
    }),
  }),
  iron_drain_bar: Object.freeze({
    id: 'iron_drain_bar',
    actionType: PHYSICAL_TOOL_ACTIONS.pry,
    equipmentSlot: 'tool',
    minTravelPx: 92,
    minVelocityPxPerSecond: 42,
    maxVelocityPxPerSecond: 480,
    minSmoothness: 0.74,
    preferredAngleRadians: -Math.PI * 0.5,
    angleToleranceRadians: 1.15,
    cooldownSeconds: 0.78,
    contactRadiusPx: 68,
    recoilSeconds: 0.38,
    shake: Object.freeze({ durationMs: 330, intensity: 0.11 }),
    finalShake: Object.freeze({ durationMs: 980, intensity: 0.235 }),
    viewmodel: Object.freeze({
      ready: Object.freeze({ screen: Object.freeze([0.65, -0.62]), depth: 1.48, rotation: Object.freeze([-0.18, -0.12, 0.22]), motion: Object.freeze([0.38, 0.34]) }),
      grip: Object.freeze({ local: Object.freeze([0.02, -0.3, 0]), viewportRatio: 0.21, minRadiusPx: 76, maxRadiusPx: 122 }),
      active: Object.freeze({ local: Object.freeze([-0.31, 0.9, 0]) }),
      follow: 7.5,
      recoil: Object.freeze({ depth: 0.16, pitch: 0.3 }),
    }),
  }),
});

export function getPhysicalToolProfile(toolId) {
  return PHYSICAL_TOOL_PROFILES[toolId] ?? null;
}

function angleDelta(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

export function getPhysicalToolAngleError(profile, angleRadians = 0) {
  const preferred = profile?.preferredAngleRadians ?? angleRadians;
  const directError = angleDelta(angleRadians, preferred);
  if (profile?.angleMode !== 'axis') return directError;
  return Math.min(directError, angleDelta(angleRadians, preferred + Math.PI));
}

export function evaluatePhysicalToolGesture(profile, gesture = {}) {
  if (!profile) return { effective: false, reason: 'no-profile', quality: 0 };
  if ((gesture.travelPx ?? 0) < profile.minTravelPx) return { effective: false, reason: 'short', quality: 0 };
  if ((gesture.velocityPxPerSecond ?? 0) < profile.minVelocityPxPerSecond) return { effective: false, reason: 'too-slow', quality: 0.1 };
  if ((gesture.velocityPxPerSecond ?? 0) > profile.maxVelocityPxPerSecond) return { effective: false, reason: 'too-fast', quality: 0.2 };
  if ((gesture.smoothness ?? 0) < profile.minSmoothness) return { effective: false, reason: 'erratic', quality: gesture.smoothness ?? 0 };
  const angleError = getPhysicalToolAngleError(profile, gesture.angleRadians ?? 0);
  if (angleError > profile.angleToleranceRadians) return { effective: false, reason: 'wrong-angle', quality: 0.25 };
  const speedCenter = (profile.minVelocityPxPerSecond + profile.maxVelocityPxPerSecond) * 0.5;
  const speedSpan = Math.max(1, (profile.maxVelocityPxPerSecond - profile.minVelocityPxPerSecond) * 0.5);
  const speedQuality = 1 - Math.min(1, Math.abs((gesture.velocityPxPerSecond ?? 0) - speedCenter) / speedSpan);
  const angleQuality = 1 - angleError / Math.max(0.001, profile.angleToleranceRadians);
  return {
    effective: true,
    reason: 'effective',
    quality: Math.max(0.2, Math.min(1, speedQuality * 0.25 + angleQuality * 0.25 + gesture.smoothness * 0.5)),
  };
}
