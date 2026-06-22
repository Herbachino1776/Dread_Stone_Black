import * as THREE from 'three';
import {
  LINE_POINT_COUNT, LINE_MIN_LENGTH, LINE_START_LENGTH, LINE_MAX_LENGTH, LINE_SEGMENT_ITERATIONS,
  LINE_GRAVITY, LINE_AIR_DRAG, LINE_WATER_DRAG, LINE_TENSION_STIFFNESS, LINE_TENSION_DAMPING,
  LINE_SPOOL_OUT_SPEED, LINE_AUTO_REEL_SPEED, LINE_REEL_PULL_BOOST, LURE_MASS, LURE_WATER_BOB_HEIGHT,
  LURE_WATER_BOB_SPEED, LURE_SURFACE_PULL_SCALE, LURE_HELICOPTER_TENSION_SCALE, LURE_MAX_SPEED,
} from './CastingTuning.js';

const up = new THREE.Vector3(0, 1, 0);
const scratch = new THREE.Vector3();

export class FishingLinePhysics {
  constructor() {
    this.linePoints = Array.from({ length: LINE_POINT_COUNT }, () => new THREE.Vector3());
    this.previousPoints = Array.from({ length: LINE_POINT_COUNT }, () => new THREE.Vector3());
    this.rodTipWorldPosition = new THREE.Vector3();
    this.previousRodTipWorldPosition = new THREE.Vector3();
    this.rodTipVelocity = new THREE.Vector3();
    this.lurePosition = new THREE.Vector3();
    this.lurePreviousPosition = new THREE.Vector3();
    this.lureVelocity = new THREE.Vector3();
    this.lureMass = LURE_MASS; this.airDrag = LINE_AIR_DRAG; this.waterDrag = LINE_WATER_DRAG;
    this.currentLineLength = LINE_START_LENGTH; this.targetLineLength = LINE_START_LENGTH; this.maxLineLength = LINE_MAX_LENGTH; this.minLineLength = LINE_MIN_LENGTH;
    this.spoolOutSpeed = LINE_SPOOL_OUT_SPEED; this.autoReelInSpeed = LINE_AUTO_REEL_SPEED; this.lineSegmentLength = LINE_START_LENGTH / (LINE_POINT_COUNT - 1);
    this.lineTension = 0; this.lineSlack = 1; this.isLureHeldNearRod = true; this.isCasting = false; this.isLureAirborne = false; this.isLureOnWater = false; this.isLureGrounded = false;
    this.waterSurfaceY = 0; this.age = 0; this.spoolState = 'held';
  }

  resetAtRodTip(rodTip) {
    this.rodTipWorldPosition.copy(rodTip); this.previousRodTipWorldPosition.copy(rodTip); this.rodTipVelocity.set(0, 0, 0);
    this.currentLineLength = LINE_START_LENGTH; this.targetLineLength = LINE_START_LENGTH; this.lineSegmentLength = this.currentLineLength / (LINE_POINT_COUNT - 1);
    this.lurePosition.copy(rodTip).add(new THREE.Vector3(0, -0.45, -0.18)); this.lurePreviousPosition.copy(this.lurePosition); this.lureVelocity.set(0, 0, 0);
    this.seedRope(); this.isLureHeldNearRod = true; this.isCasting = false; this.isLureAirborne = false; this.isLureOnWater = false; this.isLureGrounded = false; this.lineTension = 0; this.lineSlack = 1; this.age = 0; this.spoolState = 'held';
  }

  seedRope() {
    for (let i = 0; i < LINE_POINT_COUNT; i += 1) {
      const t = i / (LINE_POINT_COUNT - 1); this.linePoints[i].lerpVectors(this.rodTipWorldPosition, this.lurePosition, t); this.linePoints[i].y -= Math.sin(Math.PI * t) * this.lineSlack * 0.28; this.previousPoints[i].copy(this.linePoints[i]);
    }
  }

  launch(rodTip, inheritedVelocity) { this.isLureHeldNearRod = false; this.isCasting = true; this.isLureAirborne = true; this.isLureOnWater = false; this.isLureGrounded = false; this.rodTipWorldPosition.copy(rodTip); this.lureVelocity.copy(inheritedVelocity).addScaledVector(this.rodTipVelocity, 0.35); this.spoolState = 'unspooling'; }
  enterWater(surfaceY) { this.isCasting = false; this.isLureAirborne = false; this.isLureOnWater = true; this.isLureGrounded = false; this.waterSurfaceY = surfaceY; this.lurePosition.y = surfaceY + LURE_WATER_BOB_HEIGHT * 0.35; this.lureVelocity.y = 0; this.spoolState = 'auto-reel'; }
  enterGround(surfaceY) { this.isCasting = false; this.isLureAirborne = false; this.isLureOnWater = false; this.isLureGrounded = true; this.lurePosition.y = surfaceY + 0.04; this.lureVelocity.multiplyScalar(0.15); this.spoolState = 'failed'; }

  update(dt, rodTip, { rodHeld = false, reelBoost = 0 } = {}) {
    this.age += dt; this.previousRodTipWorldPosition.copy(this.rodTipWorldPosition); this.rodTipWorldPosition.copy(rodTip);
    this.rodTipVelocity.copy(this.rodTipWorldPosition).sub(this.previousRodTipWorldPosition).divideScalar(Math.max(dt, 0.001));
    this.integrateLure(dt, rodHeld, reelBoost); this.updateSpool(dt, rodHeld, reelBoost); this.solveRope();
  }

  integrateLure(dt, rodHeld, reelBoost) {
    this.lurePreviousPosition.copy(this.lurePosition);
    const drag = this.isLureOnWater ? this.waterDrag : this.airDrag;
    if (this.isLureAirborne || this.isLureHeldNearRod) this.lureVelocity.y += LINE_GRAVITY * dt;
    this.lureVelocity.multiplyScalar(Math.pow(drag, dt * 60));
    const distance = this.lurePosition.distanceTo(this.rodTipWorldPosition); const stretch = Math.max(0, distance - this.currentLineLength); const dir = scratch.copy(this.rodTipWorldPosition).sub(this.lurePosition);
    if (dir.lengthSq() > 0.0001) dir.normalize();
    const awaySpeed = this.lureVelocity.dot(dir) * -1 + this.rodTipVelocity.dot(dir);
    this.lineTension = Math.max(0, stretch * LINE_TENSION_STIFFNESS + Math.max(0, awaySpeed) * LINE_TENSION_DAMPING);
    const heldScale = this.isLureHeldNearRod ? LURE_HELICOPTER_TENSION_SCALE : 1;
    this.lureVelocity.addScaledVector(dir, this.lineTension * heldScale * dt / Math.max(0.2, this.lureMass));
    if (this.isLureOnWater) {
      this.lureVelocity.y = 0; this.lureVelocity.addScaledVector(dir.setY(0).normalize(), (this.lineTension + reelBoost * LINE_REEL_PULL_BOOST) * LURE_SURFACE_PULL_SCALE * dt);
    }
    if (this.lureVelocity.length() > LURE_MAX_SPEED) this.lureVelocity.setLength(LURE_MAX_SPEED);
    this.lurePosition.addScaledVector(this.lureVelocity, dt);
    if (this.isLureOnWater) this.lurePosition.y = this.waterSurfaceY + Math.sin(this.age * LURE_WATER_BOB_SPEED) * LURE_WATER_BOB_HEIGHT;
    this.lineSlack = THREE.MathUtils.clamp(1 - this.lineTension / 8, 0, 1);
  }

  updateSpool(dt, rodHeld, reelBoost) {
    if (this.isLureAirborne && this.lineTension > 0.7) this.currentLineLength += this.spoolOutSpeed * dt * THREE.MathUtils.clamp(this.lineTension / 7, 0.15, 1);
    if (this.isLureOnWater) this.currentLineLength -= (this.autoReelInSpeed + reelBoost * LINE_REEL_PULL_BOOST) * dt;
    if (this.isLureHeldNearRod && rodHeld) this.currentLineLength = THREE.MathUtils.lerp(this.currentLineLength, LINE_START_LENGTH, dt * 2.5);
    this.currentLineLength = THREE.MathUtils.clamp(this.currentLineLength, this.minLineLength, this.maxLineLength); this.targetLineLength = this.currentLineLength; this.lineSegmentLength = this.currentLineLength / (LINE_POINT_COUNT - 1);
  }

  solveRope() {
    this.linePoints[0].copy(this.rodTipWorldPosition); this.linePoints[LINE_POINT_COUNT - 1].copy(this.lurePosition);
    for (let i = 1; i < LINE_POINT_COUNT - 1; i += 1) this.linePoints[i].y += LINE_GRAVITY * 0.00045 * this.lineSlack;
    for (let iter = 0; iter < LINE_SEGMENT_ITERATIONS; iter += 1) {
      this.linePoints[0].copy(this.rodTipWorldPosition); this.linePoints[LINE_POINT_COUNT - 1].copy(this.lurePosition);
      for (let i = 0; i < LINE_POINT_COUNT - 1; i += 1) {
        const a = this.linePoints[i]; const b = this.linePoints[i + 1]; const delta = scratch.copy(b).sub(a); const len = Math.max(0.0001, delta.length()); const diff = (len - this.lineSegmentLength) / len; const movableA = i !== 0; const movableB = i + 1 !== LINE_POINT_COUNT - 1;
        if (movableA) a.addScaledVector(delta, diff * 0.5); if (movableB) b.addScaledVector(delta, -diff * 0.5);
      }
    }
    const sag = Math.min(1.6, this.lineSlack * this.currentLineLength * 0.035); for (let i = 1; i < LINE_POINT_COUNT - 1; i += 1) this.linePoints[i].addScaledVector(up, -Math.sin(Math.PI * i / (LINE_POINT_COUNT - 1)) * sag);
  }

  getDebugState() { return { lineLength: this.currentLineLength, lineTension: this.lineTension, lureMode: this.isLureOnWater ? 'water' : this.isLureAirborne ? 'airborne' : this.isLureGrounded ? 'grounded' : 'held', lureSpeed: this.lureVelocity.length(), spoolState: this.spoolState }; }
}
