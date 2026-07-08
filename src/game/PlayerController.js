import * as THREE from 'three';

const DUNGEON_MOVE_SPEED = 3.7;
const DUNGEON_STRAFE_SPEED = 2.9;
const OUTDOOR_MOVE_SPEED = 9.25;
const OUTDOOR_STRAFE_SPEED = 7.25;
const TERRAIN_GROUND_MIN_CLEARANCE = 0.015;
const TERRAIN_GROUND_MAX_SMOOTH_DROP_PER_SECOND = 2.4;

function isOutdoorAuthoredGround(sampledFloor) {
  return sampledFloor?.kind === 'oarbTerrain'
    || sampledFloor?.surface?.tags?.includes?.('oarb-spline-path-support');
}

export class PlayerController {
  constructor(camera, collisionWorld, {
    spawnPosition = new THREE.Vector3(0, 1.55, 3.2),
    spawnYaw = Math.PI,
    moveSpeed = DUNGEON_MOVE_SPEED,
    strafeSpeed = DUNGEON_STRAFE_SPEED,
  } = {}) {
    this.camera = camera;
    this.collisionWorld = collisionWorld;
    this.spawnPosition = spawnPosition.clone();
    this.spawnYaw = spawnYaw;
    this.position = this.spawnPosition.clone();
    this.eyeHeight = Math.max(0.1, this.spawnPosition.y - (this.collisionWorld?.sampleWalkableY?.(this.spawnPosition.x, this.spawnPosition.z, 0)?.y ?? 0));
    this.baseEyeHeight = this.eyeHeight;
    this.targetEyeHeight = this.eyeHeight;
    if (this.collisionWorld) this.collisionWorld.eyeHeight = this.eyeHeight;
    this.yaw = this.spawnYaw;
    this.walkSpeed = moveSpeed;
    this.strafeSpeed = strafeSpeed;
    this.turnSpeed = 0.0018;
    this.lookYawSpeed = 1.9;
    this.lookPitchSpeed = 0.76;
    this.maxPitch = THREE.MathUtils.degToRad(35);
    this.pitch = 0;
    this.keyboard = new Set();

    this.bindKeyboard();
    this.syncCamera();
  }

  static get DUNGEON_MOVE_SPEED() {
    return DUNGEON_MOVE_SPEED;
  }

  static get DUNGEON_STRAFE_SPEED() {
    return DUNGEON_STRAFE_SPEED;
  }

  static get OUTDOOR_MOVE_SPEED() {
    return OUTDOOR_MOVE_SPEED;
  }

  static get OUTDOOR_STRAFE_SPEED() {
    return OUTDOOR_STRAFE_SPEED;
  }

  bindKeyboard() {
    this.onKeyDown = (event) => this.keyboard.add(event.code);
    this.onKeyUp = (event) => this.keyboard.delete(event.code);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.keyboard.clear();
  }

  update(deltaSeconds, controls) {
    const previousEyeHeight = this.eyeHeight;
    this.eyeHeight = THREE.MathUtils.lerp(
      this.eyeHeight,
      this.targetEyeHeight,
      THREE.MathUtils.clamp(deltaSeconds * (this.targetEyeHeight < this.eyeHeight ? 7.5 : 5.5), 0, 1),
    );
    if (Math.abs(this.eyeHeight - this.targetEyeHeight) < 0.002) this.eyeHeight = this.targetEyeHeight;
    this.position.y += this.eyeHeight - previousEyeHeight;
    if (this.collisionWorld) this.collisionWorld.eyeHeight = this.eyeHeight;
    const inputConstrained = controls.physicalToolSeated === true;
    const keyboardMove = inputConstrained ? { x: 0, y: 0 } : this.getKeyboardMove();
    const moveX = inputConstrained ? 0 : (controls.move.x || keyboardMove.x);
    const moveY = inputConstrained ? 0 : (controls.move.y || keyboardMove.y);

    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    // Keep positive X input as camera-relative right for both the touch stick and keyboard strafing.
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const movement = new THREE.Vector3();

    movement.addScaledVector(forward, moveY * this.walkSpeed * deltaSeconds);
    movement.addScaledVector(right, moveX * this.strafeSpeed * deltaSeconds);

    this.position = this.collisionWorld.moveWithCollision(this.position, movement);
    const sampledFloor = this.collisionWorld.sampleWalkableY?.(this.position.x, this.position.z, this.position.y - this.eyeHeight);
    if (sampledFloor) {
      const targetY = sampledFloor.y + this.eyeHeight;
      const isOutdoorGround = isOutdoorAuthoredGround(sampledFloor);
      const minimumTerrainY = isOutdoorGround
        ? targetY + TERRAIN_GROUND_MIN_CLEARANCE
        : targetY;
      if (this.position.y <= minimumTerrainY) {
        this.position.y = minimumTerrainY;
      } else {
        const smoothing = sampledFloor.kind === 'stairRamp' ? 0.35 : 0.55;
        const smoothedY = THREE.MathUtils.lerp(this.position.y, targetY, THREE.MathUtils.clamp(smoothing + deltaSeconds * 4, 0, 1));
        if (isOutdoorGround) {
          const maxDrop = TERRAIN_GROUND_MAX_SMOOTH_DROP_PER_SECOND * Math.max(0, deltaSeconds);
          this.position.y = Math.max(smoothedY, this.position.y - maxDrop, minimumTerrainY);
        } else {
          this.position.y = smoothedY;
        }
      }
    }

    const look = inputConstrained ? { x: 0, y: 0 } : controls.consumeLookDelta();
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

    if (!inputConstrained && this.keyboard.has('ArrowLeft')) this.yaw += 1.25 * deltaSeconds;
    if (!inputConstrained && this.keyboard.has('ArrowRight')) this.yaw -= 1.25 * deltaSeconds;
    if (!inputConstrained && this.keyboard.has('PageUp')) this.pitch = THREE.MathUtils.clamp(this.pitch - 1.1 * deltaSeconds, -this.maxPitch, this.maxPitch);
    if (!inputConstrained && this.keyboard.has('PageDown')) this.pitch = THREE.MathUtils.clamp(this.pitch + 1.1 * deltaSeconds, -this.maxPitch, this.maxPitch);

    this.syncCamera();
  }

  resolveGroundSupport(deltaSeconds = 0, { snapDown = false } = {}) {
    const sampledFloor = this.collisionWorld?.sampleWalkableY?.(this.position.x, this.position.z, this.position.y - this.eyeHeight);
    if (!sampledFloor) return;

    const targetY = sampledFloor.y + this.eyeHeight;
    if (!Number.isFinite(targetY)) return;

    // Uphill terrain/path support must be authoritative so the camera never lags
    // below the visible outdoor mesh; first-person items clipping away is a
    // symptom of that camera/ground mismatch, not a view-model rendering issue.
    if (targetY >= this.position.y || snapDown) {
      this.position.y = targetY;
      return;
    }

    const smoothing = sampledFloor.kind === 'stairRamp' ? 0.35 : 0.55;
    const smoothedY = THREE.MathUtils.lerp(this.position.y, targetY, THREE.MathUtils.clamp(smoothing + deltaSeconds * 4, 0, 1));
    const maxDownwardStep = Math.max(0.08, deltaSeconds * 3.5);
    this.position.y = Math.max(targetY, Math.max(smoothedY, this.position.y - maxDownwardStep));
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

  setTargetEyeHeight(eyeHeight = this.baseEyeHeight) {
    this.targetEyeHeight = THREE.MathUtils.clamp(eyeHeight, 0.65, this.baseEyeHeight);
  }

  reset() {
    this.position.copy(this.spawnPosition);
    this.resolveGroundSupport(0, { snapDown: true });
    this.yaw = this.spawnYaw;
    this.pitch = 0;
    this.syncCamera();
  }

  syncCamera() {
    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw + Math.PI, 0, 'YXZ');
  }
}
