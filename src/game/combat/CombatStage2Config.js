export const SLASH_CONFIG = Object.freeze({
  minimumContactSeconds: 0.025,
  contactReleaseSeconds: 0.075,
  minimumEdgeSpeed: 0.28,
  drawCutSpeed: 0.72,
  deepSlashSpeed: 1.45,
  minimumEdgeAlignment: 0.42,
  minimumPressure: 0.12,
  deepPressure: 0.48,
  minimumCutTravel: 0.026,
  maximumStepLength: 0.11,
  maximumWoundLength: 0.52,
  shallowDepth: 0.012,
  drawCutDepth: 0.032,
  deepSlashDepth: 0.072,
  jitterDeadzone: 0.006,
  duplicateDistance: 0.055,
  reopenDistance: 0.075,
  clothingResistance: Object.freeze({ head: 0, face: 0, skull: 0, neck: 0.08, upper_chest: 0.32, lower_chest: 0.3, abdomen: 0.24, pelvis: 0.36, arm: 0.2, leg: 0.27, hand: 0.05, foot: 0.42 }),
});

export const WOUND_CONFIG = Object.freeze({
  maximumWounds: 24,
  visualNormalOffset: 0.006,
  shallowSeverity: 0.22,
  seriousSeverity: 0.58,
  mortalSeverity: 1.15,
  maximumCutLength: SLASH_CONFIG.maximumWoundLength,
  maximumDepth: 0.46,
  reopenResistanceFactor: 0.58,
});

export const VESSEL_ZONES = Object.freeze([
  Object.freeze({ id: 'neck_carotid_left', regionId: 'neck', surfaceCenter: Object.freeze([-0.055, 0]), surfaceRadius: 0.034, minimumDepth: 0.052, vesselType: 'arterial', rate: 0.155, consciousnessRate: 0.24 }),
  Object.freeze({ id: 'neck_carotid_right', regionId: 'neck', surfaceCenter: Object.freeze([0.055, 0]), surfaceRadius: 0.034, minimumDepth: 0.052, vesselType: 'arterial', rate: 0.155, consciousnessRate: 0.24 }),
  Object.freeze({ id: 'neck_jugular_left', regionId: 'neck', surfaceCenter: Object.freeze([-0.086, -0.015]), surfaceRadius: 0.032, minimumDepth: 0.032, vesselType: 'major_venous', rate: 0.065, consciousnessRate: 0.09 }),
  Object.freeze({ id: 'neck_jugular_right', regionId: 'neck', surfaceCenter: Object.freeze([0.086, -0.015]), surfaceRadius: 0.032, minimumDepth: 0.032, vesselType: 'major_venous', rate: 0.065, consciousnessRate: 0.09 }),
  Object.freeze({ id: 'left_brachial', regionId: 'left_upper_arm', surfaceCenter: Object.freeze([0, -0.02]), surfaceRadius: 0.035, minimumDepth: 0.052, vesselType: 'limited_arterial', rate: 0.052, consciousnessRate: 0.025 }),
  Object.freeze({ id: 'right_brachial', regionId: 'right_upper_arm', surfaceCenter: Object.freeze([0, -0.02]), surfaceRadius: 0.035, minimumDepth: 0.052, vesselType: 'limited_arterial', rate: 0.052, consciousnessRate: 0.025 }),
  Object.freeze({ id: 'left_femoral', regionId: 'left_thigh', surfaceCenter: Object.freeze([0.055, 0]), surfaceRadius: 0.038, minimumDepth: 0.082, vesselType: 'arterial', rate: 0.105, consciousnessRate: 0.1 }),
  Object.freeze({ id: 'right_femoral', regionId: 'right_thigh', surfaceCenter: Object.freeze([-0.055, 0]), surfaceRadius: 0.038, minimumDepth: 0.082, vesselType: 'arterial', rate: 0.105, consciousnessRate: 0.1 }),
]);

export const PHYSIOLOGY_CONFIG = Object.freeze({
  initialBloodReserve: 1,
  minimumBloodReserve: 0,
  maximumBloodReserve: 1,
  mildShockThreshold: 0.22,
  severeShockThreshold: 0.62,
  unconsciousThreshold: 0.22,
  bloodCollapseThreshold: 0.42,
  deathBloodThreshold: 0.08,
  painRecoveryPerSecond: 0.008,
  shockRecoveryPerSecond: 0.006,
  circulationDecayAfterDeath: 0.7,
  arterialEmbeddedObstruction: 0.28,
  venousEmbeddedObstruction: 0.48,
  withdrawalBoost: 1.9,
  withdrawalBoostSeconds: 0.7,
  clottingDelaySeconds: 5,
  clottingPerSecond: 0.018,
  breathingFailureThreshold: 0.34,
  decisiveNeurologicalDepth: 0.07,
  neckNeurologicalDepth: 0.085,
});

export const BLOOD_EFFECT_CONFIG = Object.freeze({
  maximumParticles: 72,
  maximumDecals: 24,
  particleRadius: 0.012,
  maximumLifetime: 2.8,
  gravity: -9.81,
  entryBurstMaximum: 5,
  withdrawalBurstMaximum: 8,
  slashBurstMaximum: 7,
  arterialPulseInterval: 0.48,
  arterialPulseParticles: 4,
  venousDripInterval: 0.42,
  capillaryDripInterval: 1.15,
  decalMinimumSpeed: 0.32,
  cessationSecondsAfterDeath: 2.2,
});

export const COMBAT_AUDIO_CONFIG = Object.freeze({
  maximumVoices: 8,
  maximumVocalVoices: 2,
  defaultCooldownSeconds: 0.09,
  eventCooldowns: Object.freeze({ knife_move: 0.18, clothing_contact: 0.18, blunt_contact: 0.18, blade_scrape: 0.16, failed_tip: 0.18, puncture: 0.11, soft_penetration: 0.14, deep_penetration: 0.22, bone_contact: 0.28, embedded_move: 0.2, blade_bind: 0.25, extraction: 0.2, shallow_slash: 0.22, deep_slash: 0.34, blood_spray: 0.18, blood_drop: 0.32, stagger_foot: 0.28, body_ground: 0.32, body_wall: 0.32, limb_impact: 0.22, body_settle: 1, breathing: 1.7, pain_vocal: 0.75, shock_gasp: 1.2, unconscious: 2, final_exhale: 4 }),
  vocalEvents: Object.freeze(['breathing', 'pain_vocal', 'shock_gasp', 'unconscious', 'final_exhale']),
});

export const HAPTIC_CONFIG = Object.freeze({
  defaultCooldownSeconds: 0.08,
  maximumEventsPerSecond: 8,
  patterns: Object.freeze({ surface_contact: Object.freeze([5]), penetration: Object.freeze([9, 20, 7]), hard_contact: Object.freeze([16, 28, 12]), resistance: Object.freeze([7]), extraction: Object.freeze([8, 18, 5]), deep_slash: Object.freeze([12, 22, 10]), severe_impact: Object.freeze([18, 30, 18]), collapse: Object.freeze([20, 40, 28]) }),
});

export const COLLAPSE_CONFIG = Object.freeze({
  families: Object.freeze(['chest_fold', 'neck_failure', 'neurological', 'leg_failure', 'blood_loss', 'general_trauma']),
  corpseSettleSpeed: 0.22,
  corpseSettleSeconds: 1.1,
  corpseSleepSpeed: 0.075,
  motorReleaseRates: Object.freeze({ chest_fold: 0.72, neck_failure: 1.35, neurological: 4.5, leg_failure: 0.55, blood_loss: 0.38, general_trauma: 0.82 }),
});

export const HUMANOID_DURABILITY_CONFIG = Object.freeze({
  traumaScale: 0.55,
  balanceCollapseThreshold: 1.65,
  accumulatedCollapseThreshold: 6.5,
  criticalDyingThreshold: 4.2,
  accumulatedDyingThreshold: 10,
  designIntent: 'high-durability-combat-subject-with-decisive-neurological-and-vessel-exceptions',
});

export const COMBAT_MOBILE_LIMITS = Object.freeze({ wounds: WOUND_CONFIG.maximumWounds, particles: BLOOD_EFFECT_CONFIG.maximumParticles, decals: BLOOD_EFFECT_CONFIG.maximumDecals, audioVoices: COMBAT_AUDIO_CONFIG.maximumVoices, physicsBodies: 24, physicsConstraints: 20 });

export function validateCombatStage2Configuration(regionIds = []) {
  const errors = [];
  const knownRegions = new Set(regionIds);
  if (SLASH_CONFIG.maximumStepLength <= 0 || SLASH_CONFIG.maximumWoundLength < SLASH_CONFIG.maximumStepLength) errors.push('invalid slash length bounds');
  if (WOUND_CONFIG.maximumWounds <= 0 || WOUND_CONFIG.maximumDepth <= 0) errors.push('invalid wound limits');
  VESSEL_ZONES.forEach((zone) => {
    if (!knownRegions.has(zone.regionId)) errors.push(`vessel ${zone.id} references missing region`);
    if (zone.surfaceRadius <= 0 || zone.minimumDepth <= 0 || zone.rate < 0) errors.push(`invalid vessel ${zone.id}`);
  });
  if (PHYSIOLOGY_CONFIG.unconsciousThreshold < 0 || PHYSIOLOGY_CONFIG.unconsciousThreshold > 1) errors.push('invalid consciousness threshold');
  Object.entries(BLOOD_EFFECT_CONFIG).forEach(([key, value]) => {
    if (typeof value === 'number' && value < 0 && key !== 'gravity') errors.push(`negative blood effect tuning: ${key}`);
  });
  if (!Number.isFinite(BLOOD_EFFECT_CONFIG.gravity) || BLOOD_EFFECT_CONFIG.gravity >= 0) errors.push('blood gravity must point downward');
  if (COMBAT_AUDIO_CONFIG.maximumVoices < COMBAT_AUDIO_CONFIG.maximumVocalVoices) errors.push('invalid audio voice limits');
  if (!HAPTIC_CONFIG.patterns.penetration || !HAPTIC_CONFIG.patterns.hard_contact) errors.push('missing haptic categories');
  if (new Set(COLLAPSE_CONFIG.families).size !== COLLAPSE_CONFIG.families.length) errors.push('duplicate collapse family');
  if (errors.length) throw new Error(`Invalid stage 2 combat configuration:\n${errors.join('\n')}`);
  return { valid: true, vesselCount: VESSEL_ZONES.length, woundLimit: WOUND_CONFIG.maximumWounds, particleLimit: BLOOD_EFFECT_CONFIG.maximumParticles, decalLimit: BLOOD_EFFECT_CONFIG.maximumDecals };
}
