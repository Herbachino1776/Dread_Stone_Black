import * as THREE from 'three';
import { clampWorkspacePoint, deriveBladeTip } from '../CombatMath.js';

export function createWeaponPoseWorkspace() {
  return {
    localGrip: new THREE.Vector3(),
    localEuler: new THREE.Euler(0, 0, 0, 'YXZ'),
    localQuaternion: new THREE.Quaternion(),
    cameraDelta: new THREE.Matrix4(),
    cameraInverse: new THREE.Matrix4(),
    cameraRotation: new THREE.Quaternion(),
    lastCameraWorldMatrix: null,
  };
}

export function initializeCameraRelativeWeaponPose({
  camera,
  workspace,
  poseWorkspace,
  actualGrip,
  previousGrip,
  desiredGrip,
  actualQuaternion,
  previousQuaternion,
  desiredQuaternion,
}) {
  camera.updateMatrixWorld(true);
  if (poseWorkspace.lastCameraWorldMatrix) poseWorkspace.lastCameraWorldMatrix.copy(camera.matrixWorld);
  else poseWorkspace.lastCameraWorldMatrix = new THREE.Matrix4().copy(camera.matrixWorld);
  poseWorkspace.localGrip.fromArray(workspace.ready);
  actualGrip.copy(poseWorkspace.localGrip);
  camera.localToWorld(actualGrip);
  desiredGrip.copy(actualGrip);
  previousGrip.copy(actualGrip);
  camera.getWorldQuaternion(actualQuaternion);
  previousQuaternion.copy(actualQuaternion);
  desiredQuaternion.copy(actualQuaternion);
}

export function rebaseWorldWeaponPoseToCamera({ camera, poseWorkspace, anchored = false, positions = [], quaternions = [] }) {
  camera.updateMatrixWorld(true);
  if (!poseWorkspace.lastCameraWorldMatrix) {
    poseWorkspace.lastCameraWorldMatrix = new THREE.Matrix4().copy(camera.matrixWorld);
    return false;
  }
  const delta = poseWorkspace.cameraDelta
    .copy(camera.matrixWorld)
    .multiply(poseWorkspace.cameraInverse.copy(poseWorkspace.lastCameraWorldMatrix).invert());
  poseWorkspace.lastCameraWorldMatrix.copy(camera.matrixWorld);
  if (anchored) return false;
  const rotationDelta = poseWorkspace.cameraRotation.setFromRotationMatrix(delta);
  for (let index = 0; index < positions.length; index += 1) positions[index].applyMatrix4(delta);
  for (let index = 0; index < quaternions.length; index += 1) quaternions[index].premultiply(rotationDelta).normalize();
  return true;
}

export function computeCameraRelativeWeaponPose({
  camera,
  workspace,
  poseWorkspace,
  aimX,
  aimY,
  extension,
  pitchFromAimY,
  yawFromAimX,
  rollFromAimX,
  tipLength,
  desiredGrip,
  desiredQuaternion,
  desiredTip,
}) {
  const local = poseWorkspace.localGrip.set(
    workspace.ready[0] + aimX * workspace.lateralReach,
    workspace.ready[1] + aimY * workspace.verticalReach,
    workspace.ready[2] - extension,
  );
  clampWorkspacePoint(local, workspace);
  camera.updateMatrixWorld(true);
  desiredGrip.copy(local);
  camera.localToWorld(desiredGrip);
  camera.getWorldQuaternion(desiredQuaternion);
  poseWorkspace.localQuaternion.setFromEuler(poseWorkspace.localEuler.set(
    aimY * pitchFromAimY,
    aimX * yawFromAimX,
    aimX * rollFromAimX,
  ));
  desiredQuaternion.multiply(poseWorkspace.localQuaternion).normalize();
  deriveBladeTip(desiredGrip, desiredQuaternion, tipLength, desiredTip);
  return desiredGrip;
}
