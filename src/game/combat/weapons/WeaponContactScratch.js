import * as THREE from 'three';
import { createSweptCuttingEdgeScratch } from './SweptCuttingEdge.js';

export function createWeaponContactScratch() {
  return {
    prospectiveTip: new THREE.Vector3(),
    travel: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    movementDirection: new THREE.Vector3(),
    offensiveSweepStart: new THREE.Vector3(),
    contactPoint: new THREE.Vector3(),
    contactNormal: new THREE.Vector3(),
    point: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    localMotion: new THREE.Vector3(),
    bodyCenter: new THREE.Vector3(),
    edgeMotion: new THREE.Vector3(),
    correction: new THREE.Vector3(),
    impulse: new THREE.Vector3(),
    inverseQuaternion: new THREE.Quaternion(),
    edgeSweep: createSweptCuttingEdgeScratch(),
  };
}

export function getRigidBodyWorldPosition(body, target = new THREE.Vector3()) {
  const translation = body.translation();
  return target.set(translation.x, translation.y, translation.z);
}
