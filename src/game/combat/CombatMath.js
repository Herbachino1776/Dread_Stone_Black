import * as THREE from 'three';

export function normalizedBladeForward(quaternion, target = new THREE.Vector3()) {
  return target.set(0, 0, -1).applyQuaternion(quaternion).normalize();
}

export function deriveBladeTip(gripPosition, quaternion, bladeLength, target = new THREE.Vector3()) {
  return normalizedBladeForward(quaternion, target).multiplyScalar(bladeLength).add(gripPosition);
}

export function clampWorkspacePoint(point, bounds, target = point) {
  target.copy(point);
  target.x = THREE.MathUtils.clamp(target.x, bounds.min[0], bounds.max[0]);
  target.y = THREE.MathUtils.clamp(target.y, bounds.min[1], bounds.max[1]);
  target.z = THREE.MathUtils.clamp(target.z, bounds.min[2], bounds.max[2]);
  return target;
}

export function computeWorldThrust(startPosition, quaternion, distance, target = new THREE.Vector3()) {
  return target.copy(startPosition).addScaledVector(normalizedBladeForward(quaternion, new THREE.Vector3()), distance);
}

export function classifyKnifeContact({ speed = 0, alignment = 0, part = 'tip', minimumSpeed = 0.34, minimumAlignment = 0.72, failedAlignment = 0.48 } = {}) {
  if (part === 'edge') return { state: 'edge_contact', penetrates: false, reason: 'edge-contact' };
  if (part !== 'tip') return { state: 'blunt_contact', penetrates: false, reason: 'non-penetrating-weapon-part' };
  if (alignment < failedAlignment) return { state: 'glancing_contact', penetrates: false, reason: 'poor-entry-angle' };
  if (speed < minimumSpeed) return { state: 'failed_penetration', penetrates: false, reason: 'insufficient-forward-pressure' };
  if (alignment < minimumAlignment) return { state: 'tip_contact', penetrates: false, reason: 'tip-motion-misaligned' };
  return { state: 'surface_puncture', penetrates: true, reason: 'aligned-tip-punctured-surface' };
}

export function advancePenetrationDepth({ currentDepth, targetDepth, dt, tissueResistance, hardDepth = null, maximumDepth, penetrationRate, withdrawalRate } = {}) {
  const hardContact = hardDepth != null && targetDepth >= hardDepth;
  const boundedTarget = THREE.MathUtils.clamp(hardContact ? Math.min(targetDepth, hardDepth) : targetDepth, -0.04, maximumDepth);
  const resistance = Math.max(0.3, tissueResistance);
  let depth = currentDepth;
  if (boundedTarget > depth) depth = Math.min(boundedTarget, depth + penetrationRate * dt / resistance);
  else depth = Math.max(boundedTarget, depth - withdrawalRate * dt / Math.max(0.35, resistance * 0.65));
  return { depth: THREE.MathUtils.clamp(depth, 0, maximumDepth), hardContact, targetDepth: boundedTarget, extracted: depth <= 0.0005 && boundedTarget < 0 };
}

export function visibleCollisionTransformsWithinTolerance(visiblePosition, collisionPosition, visibleQuaternion, collisionQuaternion, tolerance) {
  return visiblePosition.distanceTo(collisionPosition) <= tolerance && visibleQuaternion.angleTo(collisionQuaternion) <= tolerance * 4;
}
