import * as THREE from 'three';

export const BLUNT_IMPACT_SCHEMA = 'dreadstone.blunt-impact.v1';

export const BLUNT_IMPACT_CLASSIFICATIONS = Object.freeze({
  heavySmash: 'heavy_smash',
  committedBlunt: 'committed_blunt',
  glancingBlunt: 'glancing_blunt',
  haftContact: 'haft_contact',
  nonDamagingContact: 'non_damaging_contact',
});

export const BLUNT_PRIMITIVE_TRAUMA_MULTIPLIERS = Object.freeze({
  mace_head: 1,
  pommel: 0.38,
  haft: 0.18,
  grip: 0,
});

const HEAD_REGIONS = new Set(['head', 'face', 'skull']);
const TORSO_REGIONS = new Set(['neck', 'upper_chest', 'lower_chest', 'abdomen', 'pelvis']);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const cloneVector = (value, fallback = new THREE.Vector3()) => value?.isVector3 ? value.clone() : fallback.clone();

export function classifyBluntImpact({ primitive = 'grip', normalImpactSpeed = 0, tangentialSpeed = 0, estimatedEnergy = 0, loadProgress = 0, gesturePower = 0 } = {}) {
  const normalSpeed = Math.max(0, finite(normalImpactSpeed));
  const tangential = Math.max(0, finite(tangentialSpeed));
  const totalSpeed = Math.hypot(normalSpeed, tangential);
  const normalAlignment = totalSpeed > 1e-6 ? normalSpeed / totalSpeed : 0;
  if (primitive === 'grip') return BLUNT_IMPACT_CLASSIFICATIONS.nonDamagingContact;
  if (primitive === 'haft') return normalSpeed >= 0.42 && normalAlignment >= 0.2
    ? BLUNT_IMPACT_CLASSIFICATIONS.haftContact
    : BLUNT_IMPACT_CLASSIFICATIONS.nonDamagingContact;
  if (normalSpeed < 0.52 || normalAlignment < 0.34) return BLUNT_IMPACT_CLASSIFICATIONS.glancingBlunt;
  if (primitive === 'mace_head' && estimatedEnergy >= 42 && loadProgress >= 0.72 && gesturePower >= 0.58) return BLUNT_IMPACT_CLASSIFICATIONS.heavySmash;
  return BLUNT_IMPACT_CLASSIFICATIONS.committedBlunt;
}

export function estimateBluntImpactMetrics({ headCenterVelocity = new THREE.Vector3(), contactCenterVelocity = headCenterVelocity, worldNormal = new THREE.Vector3(0, 0, 1), actorVelocity = new THREE.Vector3(), effectiveMass = 0, primitive = 'grip', loadProgress = 0, gesturePower = 0 } = {}) {
  const relativeVelocity = cloneVector(contactCenterVelocity).sub(cloneVector(actorVelocity));
  const normal = cloneVector(worldNormal, new THREE.Vector3(0, 0, 1));
  if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1);
  normal.normalize();
  const mass = Math.max(0, finite(effectiveMass));
  const normalImpactSpeed = Math.max(0, -relativeVelocity.dot(normal));
  const normalVelocity = normal.clone().multiplyScalar(relativeVelocity.dot(normal));
  const tangentialSpeed = relativeVelocity.clone().sub(normalVelocity).length();
  const estimatedImpulse = mass * normalImpactSpeed;
  const estimatedEnergy = 0.5 * mass * normalImpactSpeed * normalImpactSpeed;
  const impactDirection = relativeVelocity.lengthSq() > 1e-8 ? relativeVelocity.clone().normalize() : normal.clone().negate();
  return {
    actorRelativeVelocity: relativeVelocity,
    contactCenterVelocity: cloneVector(contactCenterVelocity),
    impactDirection,
    normalImpactSpeed,
    tangentialSpeed,
    effectiveMass: mass,
    estimatedImpulse,
    estimatedEnergy,
    classification: classifyBluntImpact({ primitive, normalImpactSpeed, tangentialSpeed, estimatedEnergy, loadProgress, gesturePower }),
  };
}

export function deriveBluntImpactTrauma({ impact = null, region = null } = {}) {
  const primitiveMultiplier = BLUNT_PRIMITIVE_TRAUMA_MULTIPLIERS[impact?.primitive] ?? 0;
  const regionId = region?.id ?? impact?.regionId ?? '';
  const anatomyMultiplier = HEAD_REGIONS.has(regionId) ? 1.6 : TORSO_REGIONS.has(regionId) ? 1.15 : 0.8;
  const totalSpeed = Math.hypot(finite(impact?.normalImpactSpeed), finite(impact?.tangentialSpeed));
  const normalAlignment = totalSpeed > 1e-6 ? THREE.MathUtils.clamp(finite(impact?.normalImpactSpeed) / totalSpeed, 0, 1) : 0;
  const glancingMultiplier = impact?.classification === BLUNT_IMPACT_CLASSIFICATIONS.glancingBlunt ? 0.42 : 1;
  const commitmentMultiplier = THREE.MathUtils.lerp(0.72, 1.08, THREE.MathUtils.clamp(finite(impact?.gesturePower), 0, 1));
  const energyTerm = THREE.MathUtils.clamp(finite(impact?.estimatedEnergy) / 28, 0, 4) * 0.75;
  const impulseTerm = THREE.MathUtils.clamp(finite(impact?.estimatedImpulse) / 18, 0, 2) * 0.25;
  const trauma = (energyTerm + impulseTerm)
    * primitiveMultiplier
    * anatomyMultiplier
    * THREE.MathUtils.lerp(0.35, 1, normalAlignment)
    * glancingMultiplier
    * commitmentMultiplier;
  return Object.freeze({
    trauma: Math.max(0, trauma),
    primitiveMultiplier,
    anatomyMultiplier,
    normalAlignment,
    glancingMultiplier,
    commitmentMultiplier,
  });
}

export function createBluntImpactInteraction({ interactionId, weaponId = 'unknown_blunt_weapon', weaponFamily = 'blunt', primitive = 'grip', actorId = null, bodyId = null, regionId = null, worldPoint = null, worldNormal = null, impactDirection = null, headCenterVelocity = null, contactCenterVelocity = headCenterVelocity, actorRelativeVelocity = null, normalImpactSpeed = 0, tangentialSpeed = 0, effectiveMass = 0, estimatedImpulse = 0, estimatedEnergy = 0, loadProgress = 0, gesturePower = 0, impactRadiusEstimate = 0, classification = BLUNT_IMPACT_CLASSIFICATIONS.nonDamagingContact, startedAt = 0 } = {}) {
  return {
    schema: BLUNT_IMPACT_SCHEMA,
    interactionId,
    weaponId,
    weaponFamily,
    primitive,
    actorId,
    bodyId,
    regionId,
    worldPoint: cloneVector(worldPoint),
    worldNormal: cloneVector(worldNormal, new THREE.Vector3(0, 0, 1)).normalize(),
    impactDirection: cloneVector(impactDirection, new THREE.Vector3(0, 0, -1)).normalize(),
    headCenterVelocity: cloneVector(headCenterVelocity),
    contactCenterVelocity: cloneVector(contactCenterVelocity),
    actorRelativeVelocity: cloneVector(actorRelativeVelocity),
    normalImpactSpeed: Math.max(0, finite(normalImpactSpeed)),
    tangentialSpeed: Math.max(0, finite(tangentialSpeed)),
    effectiveMass: Math.max(0, finite(effectiveMass)),
    estimatedImpulse: Math.max(0, finite(estimatedImpulse)),
    estimatedEnergy: Math.max(0, finite(estimatedEnergy)),
    loadProgress: THREE.MathUtils.clamp(finite(loadProgress), 0, 1),
    gesturePower: THREE.MathUtils.clamp(finite(gesturePower), 0, 1),
    impactRadiusEstimate: Math.max(0, finite(impactRadiusEstimate)),
    startedAt: Math.max(0, finite(startedAt)),
    completedAt: null,
    classification,
    actorDamageApplied: 0,
    reactionEmitted: false,
    collapseRequested: false,
    deformationApplied: false,
    detachmentApplied: false,
  };
}

export function completeBluntImpactInteraction(interaction, { completedAt = interaction?.startedAt ?? 0, actorResult = null } = {}) {
  if (!interaction) return null;
  interaction.completedAt = Math.max(interaction.startedAt, finite(completedAt, interaction.startedAt));
  interaction.actorDamageApplied = Math.max(0, finite(actorResult?.damageApplied));
  interaction.reactionEmitted = actorResult?.reactionEmitted === true;
  interaction.collapseRequested = actorResult?.collapseRequested === true;
  interaction.deformationApplied = actorResult?.deformationApplied === true;
  interaction.detachmentApplied = actorResult?.detachmentApplied === true;
  return interaction;
}
