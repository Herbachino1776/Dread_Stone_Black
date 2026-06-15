import * as THREE from 'three';

export const THIRD_PERSON_CAMERA_CONFIG = Object.freeze({
  cameraDistance: 6.1,
  cameraHeight: 3.0,
  cameraLookAtHeight: 1.42,
  cameraSideOffset: 0.22,
  cameraSmoothing: 0.18,
  cameraPitch: THREE.MathUtils.degToRad(-8),
  minCameraDistance: 2.35,
  maxCameraDistance: 7.25,
  collisionProbeEnabled: true,
  collisionProbeMinDistance: 2.35,
  collisionProbeStep: 0.22,
  pitchClampMin: THREE.MathUtils.degToRad(-28),
  pitchClampMax: THREE.MathUtils.degToRad(28),
  playerEyeHeight: 1.55,
});

export class ThirdPersonCameraController {
  constructor({
    camera,
    player,
    collisionWorld = null,
    config = THIRD_PERSON_CAMERA_CONFIG,
  }) {
    this.camera = camera;
    this.player = player;
    this.collisionWorld = collisionWorld;
    this.config = config;
    this.lookAt = new THREE.Vector3();
    this.smoothedLookAt = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.probePosition = new THREE.Vector3();
  }

  update(deltaSeconds) {
    const groundY = this.player.position.y - this.config.playerEyeHeight;
    const lookPitch = THREE.MathUtils.clamp(
      this.player.pitch ?? 0,
      this.config.pitchClampMin,
      this.config.pitchClampMax,
    );
    const cameraPitch = THREE.MathUtils.clamp(
      (this.config.cameraPitch ?? 0) + lookPitch * 0.35,
      this.config.pitchClampMin,
      this.config.pitchClampMax,
    );
    const forward = this.player.getLookDirection();
    const right = new THREE.Vector3(-Math.cos(this.player.yaw), 0, Math.sin(this.player.yaw));
    const pitchLift = Math.sin(-cameraPitch) * 0.72;

    this.lookAt.set(
      this.player.position.x,
      groundY + this.config.cameraLookAtHeight + pitchLift * 0.28,
      this.player.position.z,
    );

    const alpha = 1 - Math.pow(1 - this.config.cameraSmoothing, deltaSeconds * 60);
    if (this.smoothedLookAt.lengthSq() <= 0.000001) this.smoothedLookAt.copy(this.lookAt);
    this.smoothedLookAt.lerp(this.lookAt, alpha);

    const distance = this.resolveCameraDistance(forward, right, groundY);
    this.desiredPosition.copy(this.smoothedLookAt)
      .addScaledVector(forward, -distance)
      .addScaledVector(right, this.config.cameraSideOffset);
    this.desiredPosition.y = groundY + this.config.cameraHeight + pitchLift;

    this.camera.position.lerp(this.desiredPosition, alpha);
    this.camera.lookAt(this.smoothedLookAt);
  }

  resolveCameraDistance(forward, right, groundY) {
    if (!this.config.collisionProbeEnabled || !this.collisionWorld?.canStandAt) {
      return THREE.MathUtils.clamp(this.config.cameraDistance, this.config.minCameraDistance, this.config.maxCameraDistance);
    }

    for (
      let distance = THREE.MathUtils.clamp(this.config.cameraDistance, this.config.minCameraDistance, this.config.maxCameraDistance);
      distance >= Math.max(this.config.collisionProbeMinDistance, this.config.minCameraDistance);
      distance -= this.config.collisionProbeStep
    ) {
      this.probePosition.copy(this.smoothedLookAt)
        .addScaledVector(forward, -distance)
        .addScaledVector(right, this.config.cameraSideOffset);
      this.probePosition.y = groundY + this.config.cameraHeight;
      if (this.collisionWorld.canStandAt(this.probePosition)) return distance;
    }

    return Math.max(this.config.collisionProbeMinDistance, this.config.minCameraDistance);
  }
}
