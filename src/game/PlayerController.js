import * as THREE from 'three';

export class PlayerController {
  constructor(camera, collisionWorld, { spawnPosition = new THREE.Vector3(0, 1.55, 3.2), spawnYaw = Math.PI } = {}) {
    this.camera = camera;
    this.collisionWorld = collisionWorld;
    this.spawnPosition = spawnPosition.clone();
    this.spawnYaw = spawnYaw;
    this.position = this.spawnPosition.clone();
    this.yaw = this.spawnYaw;
    this.walkSpeed = 1.85;
    this.strafeSpeed = 1.45;
    this.turnSpeed = 0.0018;
    this.lookYawSpeed = 1.9;
    this.lookPitchSpeed = 0.76;
    this.maxPitch = THREE.MathUtils.degToRad(35);
    this.pitch = 0;
    this.keyboard = new Set();

    this.bindKeyboard();
    this.syncCamera();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (event) => this.keyboard.add(event.code));
    window.addEventListener('keyup', (event) => this.keyboard.delete(event.code));
  }

  update(deltaSeconds, controls) {
    const keyboardMove = this.getKeyboardMove();
    const moveX = controls.move.x || keyboardMove.x;
    const moveY = controls.move.y || keyboardMove.y;

    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    // Keep positive X input as camera-relative right for both the touch stick and keyboard strafing.
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const movement = new THREE.Vector3();

    movement.addScaledVector(forward, moveY * this.walkSpeed * deltaSeconds);
    movement.addScaledVector(right, moveX * this.strafeSpeed * deltaSeconds);

    this.position = this.collisionWorld.moveWithCollision(this.position, movement);

    const look = controls.consumeLookDelta();
    if (typeof look === 'number') {
      this.yaw -= look * this.turnSpeed;
    } else {
      this.yaw -= look.x * this.lookYawSpeed * deltaSeconds;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + look.y * this.lookPitchSpeed * deltaSeconds,
        -this.maxPitch,
        this.maxPitch,
      );
    }

    if (this.keyboard.has('ArrowLeft')) this.yaw += 1.25 * deltaSeconds;
    if (this.keyboard.has('ArrowRight')) this.yaw -= 1.25 * deltaSeconds;
    if (this.keyboard.has('PageUp')) this.pitch = THREE.MathUtils.clamp(this.pitch - 1.1 * deltaSeconds, -this.maxPitch, this.maxPitch);
    if (this.keyboard.has('PageDown')) this.pitch = THREE.MathUtils.clamp(this.pitch + 1.1 * deltaSeconds, -this.maxPitch, this.maxPitch);

    this.syncCamera();
  }

  getKeyboardMove() {
    let x = 0;
    let y = 0;

    if (this.keyboard.has('KeyW') || this.keyboard.has('ArrowUp')) y += 1;
    if (this.keyboard.has('KeyS') || this.keyboard.has('ArrowDown')) y -= 1;
    if (this.keyboard.has('KeyA')) x -= 1;
    if (this.keyboard.has('KeyD')) x += 1;

    return { x, y };
  }

  getLookDirection() {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
  }

  reset() {
    this.position.copy(this.spawnPosition);
    this.yaw = this.spawnYaw;
    this.pitch = 0;
    this.syncCamera();
  }

  syncCamera() {
    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw + Math.PI, 0, 'YXZ');
  }
}
