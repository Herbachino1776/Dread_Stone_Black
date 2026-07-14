import * as THREE from 'three';

// Puncture coordinate contract:
// - actor-local: presentationRoot local space (spawn translation/yaw are not applied)
// - physics-body local: one Rapier rigid body's local space
// - skinned-mesh local: BufferGeometry / SkinnedMesh vertex output space
// - world: the host THREE.Scene world space used by weapons and wound visuals
export const COMBAT_COORDINATE_SPACES = Object.freeze({
  actorLocal: 'actor_presentation_local',
  physicsBodyLocal: 'physics_body_local',
  skinnedMeshLocal: 'skinned_mesh_local',
  world: 'world',
});

function readPhysicsBodyTransform(bodyOrTransform) {
  if (!bodyOrTransform) return null;
  if (bodyOrTransform.position?.isVector3 && bodyOrTransform.quaternion?.isQuaternion) return bodyOrTransform;
  const translation = bodyOrTransform.translation?.();
  const rotation = bodyOrTransform.rotation?.();
  if (!translation || !rotation) return null;
  return {
    position: new THREE.Vector3(translation.x, translation.y, translation.z),
    quaternion: new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).normalize(),
  };
}

export function capturePhysicsBodyTransform(body) {
  const transform = readPhysicsBodyTransform(body);
  return transform ? {
    position: transform.position.clone(),
    quaternion: transform.quaternion.clone(),
  } : null;
}

export function actorLocalToWorld(presentationRoot, actorLocalPoint, target = new THREE.Vector3()) {
  if (!presentationRoot || !actorLocalPoint) return null;
  presentationRoot.updateWorldMatrix?.(true, false);
  return presentationRoot.localToWorld(target.copy(actorLocalPoint));
}

export function worldToActorLocal(presentationRoot, worldPoint, target = new THREE.Vector3()) {
  if (!presentationRoot || !worldPoint) return null;
  presentationRoot.updateWorldMatrix?.(true, false);
  return presentationRoot.worldToLocal(target.copy(worldPoint));
}

export function actorLocalDirectionToWorld(presentationRoot, actorLocalDirection, target = new THREE.Vector3()) {
  if (!presentationRoot || !actorLocalDirection) return null;
  presentationRoot.updateWorldMatrix?.(true, false);
  return target.copy(actorLocalDirection)
    .applyQuaternion(presentationRoot.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();
}

export function worldDirectionToActorLocal(presentationRoot, worldDirection, target = new THREE.Vector3()) {
  if (!presentationRoot || !worldDirection) return null;
  presentationRoot.updateWorldMatrix?.(true, false);
  return target.copy(worldDirection)
    .applyQuaternion(presentationRoot.getWorldQuaternion(new THREE.Quaternion()).invert())
    .normalize();
}

export function physicsBodyLocalToWorld(bodyOrTransform, bodyLocalPoint, target = new THREE.Vector3()) {
  const transform = readPhysicsBodyTransform(bodyOrTransform);
  if (!transform || !bodyLocalPoint) return null;
  return target.copy(bodyLocalPoint).applyQuaternion(transform.quaternion).add(transform.position);
}

export function worldToPhysicsBodyLocal(bodyOrTransform, worldPoint, target = new THREE.Vector3()) {
  const transform = readPhysicsBodyTransform(bodyOrTransform);
  if (!transform || !worldPoint) return null;
  return target.copy(worldPoint).sub(transform.position).applyQuaternion(transform.quaternion.clone().invert());
}

export function physicsBodyLocalDirectionToWorld(bodyOrTransform, bodyLocalDirection, target = new THREE.Vector3()) {
  const transform = readPhysicsBodyTransform(bodyOrTransform);
  if (!transform || !bodyLocalDirection) return null;
  return target.copy(bodyLocalDirection).applyQuaternion(transform.quaternion).normalize();
}

export function worldDirectionToPhysicsBodyLocal(bodyOrTransform, worldDirection, target = new THREE.Vector3()) {
  const transform = readPhysicsBodyTransform(bodyOrTransform);
  if (!transform || !worldDirection) return null;
  return target.copy(worldDirection).applyQuaternion(transform.quaternion.clone().invert()).normalize();
}

export function skinnedMeshLocalToWorld(mesh, meshLocalPoint, target = new THREE.Vector3()) {
  if (!mesh?.isSkinnedMesh || !meshLocalPoint) return null;
  return mesh.localToWorld(target.copy(meshLocalPoint));
}

export function worldToSkinnedMeshLocal(mesh, worldPoint, target = new THREE.Vector3()) {
  if (!mesh?.isSkinnedMesh || !worldPoint) return null;
  return mesh.worldToLocal(target.copy(worldPoint));
}

function vectorArray(vector) {
  return vector?.toArray?.().map((value) => Number(value.toFixed(9))) ?? null;
}

function quaternionArray(quaternion) {
  return quaternion?.toArray?.().map((value) => Number(value.toFixed(9))) ?? null;
}

function matrixArray(matrix) {
  return matrix?.toArray?.().map((value) => Number(value.toFixed(9))) ?? null;
}

function objectWorldTransform(object) {
  if (!object) return null;
  object.updateWorldMatrix?.(true, false);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  object.matrixWorld.decompose(position, quaternion, scale);
  return {
    name: object.name || object.uuid,
    matrixWorld: matrixArray(object.matrixWorld),
    positionWorld: vectorArray(position),
    quaternionWorld: quaternionArray(quaternion),
    scaleWorld: vectorArray(scale),
  };
}

// Pure snapshot builder used by deterministic tests and by the bounded DEV-only
// wound trace. It never changes the binding or reconstructs from a body pose.
export function createPunctureCoordinateSnapshot({
  collisionEntryWorld,
  collisionEntryBodyLocal,
  collisionNormalWorld = null,
  bodyTransformAtCollision = null,
  presentationRoot,
  binding,
  reconstructed,
} = {}) {
  const reconstructedActorLocal = reconstructed?.point && presentationRoot
    ? worldToActorLocal(presentationRoot, reconstructed.point)
    : null;
  const collisionActorLocal = collisionEntryWorld && presentationRoot
    ? worldToActorLocal(presentationRoot, collisionEntryWorld)
    : null;
  return {
    spaces: COMBAT_COORDINATE_SPACES,
    collisionEntryWorld: vectorArray(collisionEntryWorld),
    collisionEntryActorLocal: vectorArray(collisionActorLocal),
    collisionEntryBodyLocal: vectorArray(collisionEntryBodyLocal),
    collisionNormalWorld: vectorArray(collisionNormalWorld),
    physicsBodyAtCollision: bodyTransformAtCollision ? {
      positionWorld: vectorArray(bodyTransformAtCollision.position),
      quaternionWorld: quaternionArray(bodyTransformAtCollision.quaternion),
    } : null,
    presentationRoot: objectWorldTransform(presentationRoot),
    skinnedMesh: objectWorldTransform(binding?.mesh),
    surfaceBindingSourceWorld: vectorArray(binding?.sourcePoint),
    triangleIndex: binding?.triangleIndex ?? null,
    triangleIndices: binding?.triangleIndices ? [...binding.triangleIndices] : null,
    barycentric: vectorArray(binding?.barycentric),
    reconstructedWorld: vectorArray(reconstructed?.point),
    reconstructedNormalWorld: vectorArray(reconstructed?.normal),
    reconstructedActorLocal: vectorArray(reconstructedActorLocal),
    anchorErrorMeters: reconstructed?.point && collisionEntryWorld
      ? reconstructed.point.distanceTo(collisionEntryWorld)
      : null,
  };
}
