import * as THREE from 'three';

export const THIRD_PERSON_CAMERA_CONFIG = Object.freeze({
  cameraDistance: 3.2,
  cameraHeight: 1.72,
  cameraLookAtHeight: 1.18,
  cameraSideOffset: 0.28,
  cameraSmoothing: 13,
  collisionProbeEnabled: true,
  collisionProbeMinDistance: 1.15,
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
    this.desiredPosition = new THREE.Vector3();
    this.probePosition = new THREE.Vector3();
  }

  update(deltaSeconds) {
    const groundY = this.player.position.y - this.config.playerEyeHeight;
    const pitch = THREE.MathUtils.clamp(
      this.player.pitch ?? 0,
      this.config.pitchClampMin,
      this.config.pitchClampMax,
    );
    const forward = this.player.getLookDirection();
    const right = new THREE.Vector3(-Math.cos(this.player.yaw), 0, Math.sin(this.player.yaw));
    const pitchLift = Math.sin(-pitch) * 0.72;

    this.lookAt.set(
      this.player.position.x,
      groundY + this.config.cameraLookAtHeight + pitchLift * 0.28,
      this.player.position.z,
    );

    const distance = this.resolveCameraDistance(forward, right, groundY);
    this.desiredPosition.copy(this.lookAt)
      .addScaledVector(forward, -distance)
      .addScaledVector(right, this.config.cameraSideOffset);
    this.desiredPosition.y = groundY + this.config.cameraHeight + pitchLift;

    const alpha = 1 - Math.exp(-this.config.cameraSmoothing * deltaSeconds);
    this.camera.position.lerp(this.desiredPosition, alpha);
    this.camera.lookAt(this.lookAt);
  }

  resolveCameraDistance(forward, right, groundY) {
    if (!this.config.collisionProbeEnabled || !this.collisionWorld?.canStandAt) {
      return this.config.cameraDistance;
    }

    for (
      let distance = this.config.cameraDistance;
      distance >= this.config.collisionProbeMinDistance;
      distance -= this.config.collisionProbeStep
    ) {
      this.probePosition.copy(this.lookAt)
        .addScaledVector(forward, -distance)
        .addScaledVector(right, this.config.cameraSideOffset);
      this.probePosition.y = groundY + this.config.cameraHeight;
      if (this.collisionWorld.canStandAt(this.probePosition)) return distance;
    }

    return this.config.collisionProbeMinDistance;
  }
}
