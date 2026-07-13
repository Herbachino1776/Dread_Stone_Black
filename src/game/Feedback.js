import * as THREE from 'three';

export class Feedback {
  constructor(camera) {
    this.camera = camera;
    this.shakeTimeRemaining = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeOffset = new THREE.Vector3();
    this.shakeDirection = new THREE.Vector3(0, 0, 1);
    this.incomingDirection = new THREE.Vector3();
    this.shakeElapsed = 0;
    this.impulseCount = 0;
    this.damping = 18;
  }

  shake({ durationMs = 320, intensity = 0.11, direction = null, polarity = -1, damping = 18 } = {}) {
    const duration = Math.max(durationMs / 1000, 0.001);
    if (direction?.lengthSq?.() > 1e-8) this.incomingDirection.copy(direction).normalize().multiplyScalar(polarity);
    else this.camera.getWorldDirection(this.incomingDirection).multiplyScalar(-1);
    if (this.shakeTimeRemaining > 0) this.shakeDirection.lerp(this.incomingDirection, 0.58).normalize();
    else this.shakeDirection.copy(this.incomingDirection);
    this.shakeDuration = Math.max(duration, this.shakeTimeRemaining > 0 ? this.shakeDuration * 0.72 : 0);
    this.shakeTimeRemaining = this.shakeDuration;
    this.shakeElapsed = 0;
    this.shakeIntensity = Math.min(0.16, Math.max(Number(intensity) || 0, this.shakeIntensity * 0.42));
    this.damping = Math.max(8, Number(damping) || 18);
    this.impulseCount += 1;
  }

  update(deltaSeconds) {
    if (this.shakeTimeRemaining <= 0) return;

    const dt = Math.max(0, Number(deltaSeconds) || 0);
    this.shakeElapsed = Math.min(this.shakeDuration, this.shakeElapsed + dt);
    this.shakeTimeRemaining = Math.max(this.shakeDuration - this.shakeElapsed, 0);
    const t = Math.min(1, this.shakeElapsed / this.shakeDuration);
    const riseEnd = 0.16;
    let envelope;
    if (t < riseEnd) {
      const rise = t / riseEnd;
      envelope = rise * rise * (3 - 2 * rise);
    } else {
      const recovery = (t - riseEnd) / (1 - riseEnd);
      const x = recovery * Math.max(4, this.damping * 0.3);
      const raw = (1 + x) * Math.exp(-x);
      const endX = Math.max(4, this.damping * 0.3);
      const end = (1 + endX) * Math.exp(-endX);
      envelope = Math.max(0, (raw - end) / Math.max(0.001, 1 - end));
    }
    this.shakeOffset.copy(this.shakeDirection).multiplyScalar(this.shakeIntensity * envelope);
    this.camera.position.add(this.shakeOffset);
    if (this.shakeTimeRemaining <= 0) this.shakeIntensity = 0;
  }

  getDiagnostics() {
    return { active: this.shakeTimeRemaining > 0, timeRemaining: this.shakeTimeRemaining, intensity: this.shakeIntensity, impulseCount: this.impulseCount, offset: this.shakeOffset.toArray() };
  }
}
