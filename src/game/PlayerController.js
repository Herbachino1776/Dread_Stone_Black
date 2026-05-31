import * as THREE from 'three';

export class PlayerController {
  constructor(camera, collisionWorld) {
    this.camera = camera;
    this.collisionWorld = collisionWorld;
    this.position = new THREE.Vector3(0, 1.55, 3.2);
    this.yaw = Math.PI;
    this.walkSpeed = 1.85;
    this.strafeSpeed = 1.45;
    this.turnSpeed = 0.0018;
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
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const movement = new THREE.Vector3();

    movement.addScaledVector(forward, moveY * this.walkSpeed * deltaSeconds);
    movement.addScaledVector(right, moveX * this.strafeSpeed * deltaSeconds);

    this.position = this.collisionWorld.moveWithCollision(this.position, movement);

    this.yaw -= controls.consumeLookDelta() * this.turnSpeed;

    if (this.keyboard.has('ArrowLeft')) this.yaw += 1.25 * deltaSeconds;
    if (this.keyboard.has('ArrowRight')) this.yaw -= 1.25 * deltaSeconds;

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

  syncCamera() {
    this.camera.position.copy(this.position);
    this.camera.rotation.set(0, this.yaw + Math.PI, 0, 'YXZ');
  }
}
