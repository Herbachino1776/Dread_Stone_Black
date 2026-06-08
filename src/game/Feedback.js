import * as THREE from 'three';

export class Feedback {
  constructor(camera) {
    this.camera = camera;
    this.shakeTimeRemaining = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeOffset = new THREE.Vector3();
  }

  shake({ durationMs = 320, intensity = 0.11 } = {}) {
    this.shakeDuration = Math.max(durationMs / 1000, 0.001);
    this.shakeTimeRemaining = this.shakeDuration;
    this.shakeIntensity = intensity;
  }

  update(deltaSeconds) {
    if (this.shakeTimeRemaining <= 0) return;

    this.shakeTimeRemaining = Math.max(this.shakeTimeRemaining - deltaSeconds, 0);
    const progress = this.shakeTimeRemaining / this.shakeDuration;
    const decayedIntensity = this.shakeIntensity * progress * progress;

    this.shakeOffset.set(
      (Math.random() - 0.5) * decayedIntensity,
      (Math.random() - 0.5) * decayedIntensity * 0.55,
      0,
    );
    this.camera.position.add(this.shakeOffset);
  }
}
