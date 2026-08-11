import * as THREE from 'three';

function belongsToAuthoringPreview(object) {
  let current = object;
  while (current) {
    if (current.userData?.encounterAuthoringPreview || current.userData?.devOnly) return true;
    current = current.parent;
  }
  return false;
}

function belongsToCamera(object, camera) {
  let current = object;
  while (current) {
    if (current === camera) return true;
    current = current.parent;
  }
  return false;
}

export class EncounterAuthoringPlacementResolver {
  constructor({ maximumDistance = 18, fallbackDistance = 4.5, raycaster = new THREE.Raycaster() } = {}) {
    this.maximumDistance = maximumDistance;
    this.fallbackDistance = fallbackDistance;
    this.raycaster = raycaster;
    this.center = new THREE.Vector2(0, 0);
    this.direction = new THREE.Vector3();
  }

  resolve({ camera, scene, collision } = {}) {
    if (!camera || !collision?.sampleWalkableY) return { valid: false, reason: 'world-placement-services-unavailable', position: null };
    const direct = this.resolveDirectRay({ camera, scene, collision });
    if (direct.valid) return direct;
    camera.getWorldDirection(this.direction);
    this.direction.y = 0;
    if (this.direction.lengthSq() < 1e-8) return { valid: false, reason: 'camera-direction-unavailable', position: null };
    this.direction.normalize();
    const origin = camera.getWorldPosition(new THREE.Vector3());
    const distances = [this.fallbackDistance, 3, 6, 2, 8, 11];
    for (const distance of distances) {
      const candidate = origin.clone().addScaledVector(this.direction, distance);
      const grounded = this.groundCandidate(candidate, collision, 'forward-ground-sample');
      if (grounded.valid) return grounded;
    }
    return { valid: false, reason: 'no-valid-ground-support', position: null };
  }

  resolveDirectRay({ camera, scene, collision }) {
    if (!scene?.children) return { valid: false, reason: 'scene-ray-unavailable', position: null };
    this.raycaster.far = this.maximumDistance;
    this.raycaster.setFromCamera(this.center, camera);
    const intersections = this.raycaster.intersectObjects(scene.children, true);
    for (const hit of intersections) {
      if (!hit.object?.isMesh || belongsToAuthoringPreview(hit.object) || belongsToCamera(hit.object, camera)) continue;
      const grounded = this.groundCandidate(hit.point, collision, 'center-world-ray');
      if (grounded.valid && Math.abs(hit.point.y - grounded.position[1]) <= 2.5) return grounded;
    }
    return { valid: false, reason: 'center-world-ray-missed-support', position: null };
  }

  groundCandidate(candidate, collision, source) {
    if (![candidate?.x, candidate?.z].every(Number.isFinite)) return { valid: false, reason: 'non-finite-placement', position: null };
    const support = collision.sampleWalkableY(candidate.x, candidate.z, Number.isFinite(candidate.y) ? candidate.y : 0);
    if (!Number.isFinite(support?.y)) return { valid: false, reason: 'ground-sample-unavailable', position: null };
    const floorPosition = new THREE.Vector3(candidate.x, support.y, candidate.z);
    if (collision.canStandAtFloorPosition?.(floorPosition) === false) return { valid: false, reason: 'ground-support-blocked', position: null };
    if (support.kind === 'fallback' && collision.canStandAtFloorPosition?.(floorPosition) !== true) return { valid: false, reason: 'fallback-is-not-walkable', position: null };
    return { valid: true, reason: null, source, position: floorPosition.toArray(), supportKind: support.kind ?? null };
  }
}
