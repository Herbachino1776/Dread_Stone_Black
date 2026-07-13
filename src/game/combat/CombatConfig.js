export const COMBAT_PHYSICS_CONFIG = Object.freeze({
  fixedStep: 1 / 60,
  maxSubsteps: 4,
  maxFrameDelta: 0.1,
  gravity: Object.freeze([0, -9.81, 0]),
  maxLinearSpeed: 11,
  maxAngularSpeed: 18,
  sleepLinearThreshold: 0.04,
});

export const KNIFE_COMBAT_CONFIG = Object.freeze({
  itemId: 'old_work_knife',
  visualImplementation: 'world-knife-combat-controller',
  bladeLength: 0.24,
  bladeWidth: 0.052,
  bladeThickness: 0.012,
  handleLength: 0.13,
  overallLength: 0.37,
  tipRadius: 0.018,
  maximumPenetrationDepth: 0.225,
  minimumPunctureSpeed: 0.34,
  minimumPunctureAlignment: 0.72,
  failedPenetrationAlignment: 0.48,
  maximumVelocity: 3.8,
  maximumAngularVelocity: 8,
  visibleCollisionTolerance: 0.012,
  penetrationRate: 0.58,
  withdrawalRate: 0.72,
  lateralBindDistance: 0.08,
  forcedExtractionDistance: 0.24,
  forceTransfer: 5.5,
  gripZone: Object.freeze({ viewportRatio: 0.16, minimumRadiusPx: 58, maximumRadiusPx: 86 }),
  return: Object.freeze({
    freeSeconds: 0.15,
    failedContactSeconds: 0.19,
    embeddedMinimumSeconds: 0.25,
    embeddedMaximumSeconds: 0.4,
  }),
  workspace: Object.freeze({
    relaxed: Object.freeze([0.1, -0.22, -0.48]),
    ready: Object.freeze([0.1, -0.22, -0.48]),
    min: Object.freeze([-0.16, -0.31, -0.84]),
    max: Object.freeze([0.3, 0.03, -0.42]),
    lateralReach: 0.22,
    verticalReach: 0.15,
    thrustDistance: 0.34,
    positionFollow: 38,
    rotationFollow: 32,
    lateralSensitivity: 1 / 150,
    verticalSensitivity: 1 / 360,
    thrustSensitivity: 1 / 190,
  }),
});

const region = (definition) => Object.freeze({
  surfaceThickness: 0.012,
  softTissueResistance: 0.48,
  maximumTissueDepth: 0.18,
  hardStructure: false,
  hardStructureDepth: null,
  hardStructureResistance: 1,
  vital: 'none',
  painResponse: 0.45,
  structuralImportance: 0.35,
  consciousnessImpact: 0.1,
  balanceImpact: 0.1,
  bloodProfile: 'limited-first-pass',
  ...definition,
});

export const HUMANOID_ANATOMY_REGIONS = Object.freeze([
  region({ id: 'head', parentId: 'neck', bodyId: 'head', maximumTissueDepth: 0.12, hardStructure: true, hardStructureDepth: 0.025, hardStructureResistance: 1.9, vital: 'critical', painResponse: 1, structuralImportance: 0.95, consciousnessImpact: 0.9, balanceImpact: 0.45 }),
  region({ id: 'face', parentId: 'head', bodyId: 'head', maximumTissueDepth: 0.1, hardStructure: true, hardStructureDepth: 0.035, hardStructureResistance: 1.65, vital: 'critical', painResponse: 1, structuralImportance: 0.72, consciousnessImpact: 0.72, balanceImpact: 0.32 }),
  region({ id: 'skull', parentId: 'head', bodyId: 'head', maximumTissueDepth: 0.085, hardStructure: true, hardStructureDepth: 0.014, hardStructureResistance: 2.3, vital: 'critical', painResponse: 1, structuralImportance: 1, consciousnessImpact: 1, balanceImpact: 0.55 }),
  region({ id: 'neck', parentId: 'upper_chest', bodyId: 'neck', maximumTissueDepth: 0.105, hardStructure: true, hardStructureDepth: 0.055, hardStructureResistance: 1.7, vital: 'critical', painResponse: 1, structuralImportance: 0.9, consciousnessImpact: 0.82, balanceImpact: 0.5 }),
  region({ id: 'upper_chest', parentId: 'lower_chest', bodyId: 'upper_chest', maximumTissueDepth: 0.24, hardStructure: true, hardStructureDepth: 0.095, hardStructureResistance: 1.72, vital: 'major', painResponse: 0.9, structuralImportance: 0.86, consciousnessImpact: 0.56, balanceImpact: 0.42 }),
  region({ id: 'lower_chest', parentId: 'abdomen', bodyId: 'lower_chest', maximumTissueDepth: 0.26, hardStructure: true, hardStructureDepth: 0.13, hardStructureResistance: 1.6, vital: 'major', painResponse: 0.86, structuralImportance: 0.78, consciousnessImpact: 0.48, balanceImpact: 0.42 }),
  region({ id: 'abdomen', parentId: 'pelvis', bodyId: 'abdomen', maximumTissueDepth: 0.31, softTissueResistance: 0.4, vital: 'major', painResponse: 0.82, structuralImportance: 0.68, consciousnessImpact: 0.42, balanceImpact: 0.38 }),
  region({ id: 'pelvis', parentId: null, bodyId: 'pelvis', maximumTissueDepth: 0.24, hardStructure: true, hardStructureDepth: 0.1, hardStructureResistance: 1.9, vital: 'major', painResponse: 0.9, structuralImportance: 1, consciousnessImpact: 0.34, balanceImpact: 0.82 }),
  region({ id: 'left_upper_arm', parentId: 'upper_chest', bodyId: 'left_upper_arm', maximumTissueDepth: 0.13, hardStructure: true, hardStructureDepth: 0.065, hardStructureResistance: 1.55, painResponse: 0.66, structuralImportance: 0.44, balanceImpact: 0.08 }),
  region({ id: 'left_forearm', parentId: 'left_upper_arm', bodyId: 'left_forearm', maximumTissueDepth: 0.105, hardStructure: true, hardStructureDepth: 0.052, hardStructureResistance: 1.62, painResponse: 0.62, structuralImportance: 0.38, balanceImpact: 0.05 }),
  region({ id: 'left_hand', parentId: 'left_forearm', bodyId: 'left_hand', maximumTissueDepth: 0.065, hardStructure: true, hardStructureDepth: 0.025, hardStructureResistance: 1.45, painResponse: 0.72, structuralImportance: 0.3, balanceImpact: 0.03 }),
  region({ id: 'right_upper_arm', parentId: 'upper_chest', bodyId: 'right_upper_arm', maximumTissueDepth: 0.13, hardStructure: true, hardStructureDepth: 0.065, hardStructureResistance: 1.55, painResponse: 0.66, structuralImportance: 0.44, balanceImpact: 0.08 }),
  region({ id: 'right_forearm', parentId: 'right_upper_arm', bodyId: 'right_forearm', maximumTissueDepth: 0.105, hardStructure: true, hardStructureDepth: 0.052, hardStructureResistance: 1.62, painResponse: 0.62, structuralImportance: 0.38, balanceImpact: 0.05 }),
  region({ id: 'right_hand', parentId: 'right_forearm', bodyId: 'right_hand', maximumTissueDepth: 0.065, hardStructure: true, hardStructureDepth: 0.025, hardStructureResistance: 1.45, painResponse: 0.72, structuralImportance: 0.3, balanceImpact: 0.03 }),
  region({ id: 'left_thigh', parentId: 'pelvis', bodyId: 'left_thigh', maximumTissueDepth: 0.19, hardStructure: true, hardStructureDepth: 0.095, hardStructureResistance: 1.7, painResponse: 0.72, structuralImportance: 0.72, balanceImpact: 0.64 }),
  region({ id: 'left_lower_leg', parentId: 'left_thigh', bodyId: 'left_lower_leg', maximumTissueDepth: 0.13, hardStructure: true, hardStructureDepth: 0.06, hardStructureResistance: 1.7, painResponse: 0.72, structuralImportance: 0.78, balanceImpact: 0.78 }),
  region({ id: 'left_foot', parentId: 'left_lower_leg', bodyId: 'left_foot', maximumTissueDepth: 0.075, hardStructure: true, hardStructureDepth: 0.03, hardStructureResistance: 1.55, painResponse: 0.65, structuralImportance: 0.76, balanceImpact: 0.72 }),
  region({ id: 'right_thigh', parentId: 'pelvis', bodyId: 'right_thigh', maximumTissueDepth: 0.19, hardStructure: true, hardStructureDepth: 0.095, hardStructureResistance: 1.7, painResponse: 0.72, structuralImportance: 0.72, balanceImpact: 0.64 }),
  region({ id: 'right_lower_leg', parentId: 'right_thigh', bodyId: 'right_lower_leg', maximumTissueDepth: 0.13, hardStructure: true, hardStructureDepth: 0.06, hardStructureResistance: 1.7, painResponse: 0.72, structuralImportance: 0.78, balanceImpact: 0.78 }),
  region({ id: 'right_foot', parentId: 'right_lower_leg', bodyId: 'right_foot', maximumTissueDepth: 0.075, hardStructure: true, hardStructureDepth: 0.03, hardStructureResistance: 1.55, painResponse: 0.65, structuralImportance: 0.76, balanceImpact: 0.72 }),
]);

export const HUMANOID_BODY_CONFIG = Object.freeze([
  { id: 'pelvis', regionId: 'pelvis', parentId: null, shape: 'box', size: [0.38, 0.2, 0.19], position: [0, 1.02, -3.55], mass: 10, motor: 1 },
  { id: 'abdomen', regionId: 'abdomen', parentId: 'pelvis', shape: 'capsule', radius: 0.22, halfHeight: 0.16, position: [0, 1.33, -3.55], mass: 7.5, motor: 0.94 },
  { id: 'lower_chest', regionId: 'lower_chest', parentId: 'abdomen', shape: 'box', size: [0.35, 0.2, 0.19], position: [0, 1.63, -3.55], mass: 8.5, motor: 0.92 },
  { id: 'upper_chest', regionId: 'upper_chest', parentId: 'lower_chest', shape: 'box', size: [0.43, 0.22, 0.21], position: [0, 1.94, -3.55], mass: 11, motor: 0.96 },
  { id: 'neck', regionId: 'neck', parentId: 'upper_chest', shape: 'capsule', radius: 0.105, halfHeight: 0.07, position: [0, 2.19, -3.55], mass: 1.2, motor: 0.76 },
  { id: 'head', regionId: 'head', parentId: 'neck', shape: 'capsule', radius: 0.18, halfHeight: 0.11, position: [0, 2.43, -3.55], mass: 4.7, motor: 0.8 },
  { id: 'left_upper_arm', regionId: 'left_upper_arm', parentId: 'upper_chest', shape: 'capsule', radius: 0.105, halfHeight: 0.22, position: [-0.5, 1.83, -3.55], rotation: [0, 0, -0.13], mass: 2.1, motor: 0.65 },
  { id: 'left_forearm', regionId: 'left_forearm', parentId: 'left_upper_arm', shape: 'capsule', radius: 0.085, halfHeight: 0.2, position: [-0.56, 1.39, -3.51], rotation: [0.08, 0, -0.06], mass: 1.35, motor: 0.56 },
  { id: 'left_hand', regionId: 'left_hand', parentId: 'left_forearm', shape: 'box', size: [0.09, 0.13, 0.055], position: [-0.58, 1.08, -3.49], mass: 0.5, motor: 0.45 },
  { id: 'right_upper_arm', regionId: 'right_upper_arm', parentId: 'upper_chest', shape: 'capsule', radius: 0.105, halfHeight: 0.22, position: [0.5, 1.83, -3.55], rotation: [0, 0, 0.13], mass: 2.1, motor: 0.65 },
  { id: 'right_forearm', regionId: 'right_forearm', parentId: 'right_upper_arm', shape: 'capsule', radius: 0.085, halfHeight: 0.2, position: [0.56, 1.39, -3.51], rotation: [0.08, 0, 0.06], mass: 1.35, motor: 0.56 },
  { id: 'right_hand', regionId: 'right_hand', parentId: 'right_forearm', shape: 'box', size: [0.09, 0.13, 0.055], position: [0.58, 1.08, -3.49], mass: 0.5, motor: 0.45 },
  { id: 'left_thigh', regionId: 'left_thigh', parentId: 'pelvis', shape: 'capsule', radius: 0.13, halfHeight: 0.27, position: [-0.2, 0.66, -3.55], mass: 5.7, motor: 0.82 },
  { id: 'left_lower_leg', regionId: 'left_lower_leg', parentId: 'left_thigh', shape: 'capsule', radius: 0.105, halfHeight: 0.25, position: [-0.2, 0.2, -3.54], mass: 3.6, motor: 0.78 },
  { id: 'left_foot', regionId: 'left_foot', parentId: 'left_lower_leg', shape: 'box', size: [0.13, 0.08, 0.25], position: [-0.2, 0.09, -3.36], mass: 0.95, motor: 0.8 },
  { id: 'right_thigh', regionId: 'right_thigh', parentId: 'pelvis', shape: 'capsule', radius: 0.13, halfHeight: 0.27, position: [0.2, 0.66, -3.55], mass: 5.7, motor: 0.82 },
  { id: 'right_lower_leg', regionId: 'right_lower_leg', parentId: 'right_thigh', shape: 'capsule', radius: 0.105, halfHeight: 0.25, position: [0.2, 0.2, -3.54], mass: 3.6, motor: 0.78 },
  { id: 'right_foot', regionId: 'right_foot', parentId: 'right_lower_leg', shape: 'box', size: [0.13, 0.08, 0.25], position: [0.2, 0.09, -3.36], mass: 0.95, motor: 0.8 },
].map(Object.freeze));

export const HUMANOID_JOINT_CONFIG = Object.freeze([
  ['pelvis', 'abdomen', 'spherical', [0, 0.2, 0], [0, -0.11, 0], 0.34],
  ['abdomen', 'lower_chest', 'spherical', [0, 0.16, 0], [0, -0.14, 0], 0.28],
  ['lower_chest', 'upper_chest', 'spherical', [0, 0.2, 0], [0, -0.11, 0], 0.3],
  ['upper_chest', 'neck', 'spherical', [0, 0.22, 0], [0, -0.03, 0], 0.42],
  ['neck', 'head', 'spherical', [0, 0.07, 0], [0, -0.17, 0], 0.55],
  ['upper_chest', 'left_upper_arm', 'spherical', [-0.43, 0.12, 0], [0, 0.22, 0], 1.25],
  ['left_upper_arm', 'left_forearm', 'revolute', [0, -0.22, 0], [0, 0.2, 0], 2.25],
  ['left_forearm', 'left_hand', 'spherical', [0, -0.2, 0], [0, 0.13, 0], 0.8],
  ['upper_chest', 'right_upper_arm', 'spherical', [0.43, 0.12, 0], [0, 0.22, 0], 1.25],
  ['right_upper_arm', 'right_forearm', 'revolute', [0, -0.22, 0], [0, 0.2, 0], 2.25],
  ['right_forearm', 'right_hand', 'spherical', [0, -0.2, 0], [0, 0.13, 0], 0.8],
  ['pelvis', 'left_thigh', 'spherical', [-0.2, -0.16, 0], [0, 0.2, 0], 1.05],
  ['left_thigh', 'left_lower_leg', 'revolute', [0, -0.21, 0], [0, 0.25, 0], 2.35],
  ['left_lower_leg', 'left_foot', 'revolute', [0, -0.25, 0], [0, 0.05, -0.18], 0.72],
  ['pelvis', 'right_thigh', 'spherical', [0.2, -0.16, 0], [0, 0.2, 0], 1.05],
  ['right_thigh', 'right_lower_leg', 'revolute', [0, -0.21, 0], [0, 0.25, 0], 2.35],
  ['right_lower_leg', 'right_foot', 'revolute', [0, -0.25, 0], [0, 0.05, -0.18], 0.72],
].map((joint, index) => Object.freeze({ id: `joint_${index}_${joint[0]}_${joint[1]}`, parentId: joint[0], childId: joint[1], type: joint[2], parentAnchor: Object.freeze(joint[3]), childAnchor: Object.freeze(joint[4]), limitRadians: joint[5] })));

export const COMBAT_REQUIRED_REGION_IDS = Object.freeze(['head', 'face', 'skull', 'neck', 'upper_chest', 'lower_chest', 'abdomen', 'pelvis', 'left_upper_arm', 'left_forearm', 'left_hand', 'right_upper_arm', 'right_forearm', 'right_hand', 'left_thigh', 'left_lower_leg', 'left_foot', 'right_thigh', 'right_lower_leg', 'right_foot']);

export function validateCombatConfiguration() {
  const errors = [];
  const regionIds = new Set();
  HUMANOID_ANATOMY_REGIONS.forEach((entry) => {
    if (regionIds.has(entry.id)) errors.push(`duplicate region ${entry.id}`);
    regionIds.add(entry.id);
    if (entry.maximumTissueDepth <= 0) errors.push(`invalid tissue depth ${entry.id}`);
    if (entry.hardStructure && (!(entry.hardStructureDepth > 0) || entry.hardStructureDepth > entry.maximumTissueDepth)) errors.push(`invalid hard structure ${entry.id}`);
  });
  COMBAT_REQUIRED_REGION_IDS.forEach((id) => { if (!regionIds.has(id)) errors.push(`missing required region ${id}`); });
  HUMANOID_ANATOMY_REGIONS.forEach((entry) => { if (entry.parentId && !regionIds.has(entry.parentId)) errors.push(`invalid region parent ${entry.id}`); });
  const bodyIds = new Set(HUMANOID_BODY_CONFIG.map((body) => body.id));
  HUMANOID_BODY_CONFIG.forEach((body) => { if (!(body.mass > 0)) errors.push(`invalid mass ${body.id}`); });
  HUMANOID_JOINT_CONFIG.forEach((joint) => { if (!bodyIds.has(joint.parentId) || !bodyIds.has(joint.childId) || !(joint.limitRadians > 0)) errors.push(`invalid joint ${joint.id}`); });
  const totalMass = HUMANOID_BODY_CONFIG.reduce((sum, body) => sum + body.mass, 0);
  if (totalMass < 55 || totalMass > 105) errors.push(`implausible total mass ${totalMass}`);
  if (KNIFE_COMBAT_CONFIG.maximumPenetrationDepth > KNIFE_COMBAT_CONFIG.bladeLength) errors.push('knife penetration exceeds blade length');
  if (Math.abs(KNIFE_COMBAT_CONFIG.overallLength - KNIFE_COMBAT_CONFIG.bladeLength - KNIFE_COMBAT_CONFIG.handleLength) > 1e-6) errors.push('knife overall length does not match blade and handle');
  if (KNIFE_COMBAT_CONFIG.bladeLength < 0.22 || KNIFE_COMBAT_CONFIG.bladeLength > 0.26) errors.push('knife blade is outside work-knife range');
  if (KNIFE_COMBAT_CONFIG.handleLength < 0.11 || KNIFE_COMBAT_CONFIG.handleLength > 0.14) errors.push('knife handle is outside work-knife range');
  if (KNIFE_COMBAT_CONFIG.bladeLength <= 0 || KNIFE_COMBAT_CONFIG.bladeWidth <= 0) errors.push('invalid knife dimensions');
  const { min, max } = KNIFE_COMBAT_CONFIG.workspace;
  if (min.some((value, index) => value >= max[index])) errors.push('invalid hand workspace bounds');
  if (errors.length) throw new Error(`Invalid combat configuration:\n${errors.join('\n')}`);
  return { valid: true, totalMass, bodyCount: HUMANOID_BODY_CONFIG.length, jointCount: HUMANOID_JOINT_CONFIG.length, regionCount: regionIds.size };
}
