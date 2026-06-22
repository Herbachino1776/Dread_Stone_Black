import * as THREE from 'three';
import {
  LINE_POINT_COUNT, LINE_MIN_LENGTH, LINE_START_LENGTH, LINE_MAX_LENGTH, LINE_SEGMENT_ITERATIONS,
  LINE_GRAVITY, LINE_AIR_DRAG, LINE_WATER_DRAG, LINE_TENSION_STIFFNESS, LINE_TENSION_DAMPING,
  LINE_SPOOL_OUT_SPEED, LINE_MAX_SPOOL_OUT_PER_FRAME, LINE_AUTO_REEL_SPEED, LINE_REEL_PULL_BOOST, LINE_MANUAL_REEL_PULL_ACCEL, LURE_MASS, LURE_WATER_BOB_HEIGHT,
  LURE_WATER_BOB_SPEED, LURE_SURFACE_PULL_SCALE, LURE_HELICOPTER_TENSION_SCALE, LURE_MAX_SPEED,
  LINE_GROUND_CLEARANCE, LURE_GROUND_CLEARANCE, LURE_GROUND_FRICTION, LINE_WATER_CONTROLLED_SLACK,
} from './CastingTuning.js';

const up = new THREE.Vector3(0, 1, 0);
const scratch = new THREE.Vector3();

export class FishingLinePhysics {
  constructor({ terrainSampler = null } = {}) {
    this.terrainSampler = terrainSampler;
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
    this.waterSurfaceY = 0; this.age = 0; this.castAge = 0; this.spoolState = 'held'; this.spoolLocked = true; this.activePoints = LINE_POINT_COUNT; this.emittedLineLength = LINE_START_LENGTH;
  }

  resetAtRodTip(rodTip) {
    this.rodTipWorldPosition.copy(rodTip); this.previousRodTipWorldPosition.copy(rodTip); this.rodTipVelocity.set(0, 0, 0);
    this.currentLineLength = LINE_START_LENGTH; this.targetLineLength = LINE_START_LENGTH; this.lineSegmentLength = this.currentLineLength / (LINE_POINT_COUNT - 1);
    this.lurePosition.copy(rodTip).add(new THREE.Vector3(0, -0.24, -0.09)); this.clampLureToTerrain(true); this.lurePreviousPosition.copy(this.lurePosition); this.lureVelocity.set(0, 0, 0);
    this.activePoints = LINE_POINT_COUNT; this.emittedLineLength = LINE_START_LENGTH; this.seedRope(); this.isLureHeldNearRod = true; this.isCasting = false; this.isLureAirborne = false; this.isLureOnWater = false; this.isLureGrounded = false; this.lineTension = 0; this.lineSlack = 1; this.age = 0; this.castAge = 0; this.spoolState = 'held'; this.spoolLocked = true;
  }

  seedRope({ collapseAtRodTip = false } = {}) {
    for (let i = 0; i < LINE_POINT_COUNT; i += 1) {
      const t = i / (LINE_POINT_COUNT - 1);
      if (collapseAtRodTip) {
        this.linePoints[i].copy(this.rodTipWorldPosition);
        if (i === LINE_POINT_COUNT - 1) this.linePoints[i].copy(this.lurePosition);
      } else {
        this.linePoints[i].lerpVectors(this.rodTipWorldPosition, this.lurePosition, t);
        if (!this.isLureAirborne) this.linePoints[i].y -= Math.sin(Math.PI * t) * this.lineSlack * 0.28;
      }
      this.previousPoints[i].copy(this.linePoints[i]);
    }
  }

  launch(rodTip, inheritedVelocity) { this.isLureHeldNearRod = false; this.isCasting = true; this.isLureAirborne = true; this.isLureOnWater = false; this.isLureGrounded = false; this.rodTipWorldPosition.copy(rodTip); this.currentLineLength = LINE_START_LENGTH; this.targetLineLength = LINE_START_LENGTH; this.emittedLineLength = LINE_START_LENGTH; this.activePoints = 2; this.lineSegmentLength = this.currentLineLength / (LINE_POINT_COUNT - 1); this.castAge = 0; this.lureVelocity.copy(inheritedVelocity).addScaledVector(this.rodTipVelocity, 0.35); this.lurePreviousPosition.copy(this.lurePosition); this.seedRope({ collapseAtRodTip: true }); this.spoolState = 'unspooling'; this.spoolLocked = false; }
  enterWater(surfaceY) { this.isCasting = false; this.isLureAirborne = false; this.isLureOnWater = true; this.isLureGrounded = false; this.waterSurfaceY = surfaceY; this.lurePosition.y = surfaceY + LURE_WATER_BOB_HEIGHT * 0.35; this.lureVelocity.y = 0; this.currentLineLength = THREE.MathUtils.clamp(this.currentLineLength, Math.min(this.minLineLength, this.currentLineLength), this.maxLineLength); this.targetLineLength = this.currentLineLength; this.activePoints = LINE_POINT_COUNT; this.emittedLineLength = this.currentLineLength; this.spoolState = 'locked-water'; this.spoolLocked = true; }
  enterGround(surfaceY) { this.isCasting = false; this.isLureAirborne = false; this.isLureOnWater = false; this.isLureGrounded = true; this.lurePosition.y = surfaceY + LURE_GROUND_CLEARANCE; this.lureVelocity.multiplyScalar(0.15); this.spoolState = 'locked-ground'; this.spoolLocked = true; }

  sampleTerrainY(position) {
    const y = this.terrainSampler?.sampleOutdoorY?.(position.x, position.z);
    return Number.isFinite(y) ? y : null;
  }

  clampLureToTerrain(forceGrounded = false) {
    if (this.isLureOnWater) return false;
    const terrainY = this.sampleTerrainY(this.lurePosition);
    if (!Number.isFinite(terrainY)) return false;
    const minY = terrainY + LURE_GROUND_CLEARANCE;
    if (forceGrounded || this.lurePosition.y < minY) {
      this.lurePosition.y = minY;
      if (this.lureVelocity.y < 0) this.lureVelocity.y = 0;
      this.lureVelocity.x *= LURE_GROUND_FRICTION; this.lureVelocity.z *= LURE_GROUND_FRICTION;
      this.isLureGrounded = true; this.isLureAirborne = false;
      return true;
    }
    this.isLureGrounded = false;
    return false;
  }

  clampLineToTerrain() {
    if (this.isLureOnWater || this.isLureAirborne || this.spoolState === 'unspooling') return;
    for (let i = 1; i < LINE_POINT_COUNT; i += 1) {
      const point = this.linePoints[i];
      const terrainY = this.sampleTerrainY(point);
      if (Number.isFinite(terrainY)) point.y = Math.max(point.y, terrainY + LINE_GROUND_CLEARANCE);
    }
  }

  update(dt, rodTip, { rodHeld = false, reelBoost = 0, manualReelRate = 0 } = {}) {
    this.age += dt; if (this.isLureAirborne || this.spoolState === 'unspooling') this.castAge += dt; this.previousRodTipWorldPosition.copy(this.rodTipWorldPosition); this.rodTipWorldPosition.copy(rodTip);
    this.rodTipVelocity.copy(this.rodTipWorldPosition).sub(this.previousRodTipWorldPosition).divideScalar(Math.max(dt, 0.001));
    const activeManualReelRate = Math.max(0, manualReelRate);
    this.integrateLure(dt, rodHeld, reelBoost, activeManualReelRate); this.updateSpool(dt, rodHeld, reelBoost, activeManualReelRate); this.solveRope();
  }

  integrateLure(dt, rodHeld, reelBoost, manualReelRate = 0) {
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
      this.lureVelocity.y = 0;
      const surfaceDir = dir.setY(0);
      if (surfaceDir.lengthSq() > 0.0001) surfaceDir.normalize();
      const manualPull = manualReelRate > 0 ? manualReelRate * LINE_MANUAL_REEL_PULL_ACCEL : 0;
      this.lureVelocity.addScaledVector(surfaceDir, ((this.lineTension + reelBoost * LINE_REEL_PULL_BOOST) * LURE_SURFACE_PULL_SCALE + manualPull) * dt);
    } else if (manualReelRate > 0 && (this.isLureGrounded || !this.isLureAirborne)) {
      const groundDir = dir.setY(0);
      if (groundDir.lengthSq() > 0.0001) {
        groundDir.normalize();
        this.lureVelocity.addScaledVector(groundDir, manualReelRate * LINE_MANUAL_REEL_PULL_ACCEL * dt);
      }
    }
    if (this.lureVelocity.length() > LURE_MAX_SPEED) this.lureVelocity.setLength(LURE_MAX_SPEED);
    this.lurePosition.addScaledVector(this.lureVelocity, dt);
    if (this.isLureOnWater) this.lurePosition.y = this.waterSurfaceY + Math.sin(this.age * LURE_WATER_BOB_SPEED) * LURE_WATER_BOB_HEIGHT;
    else this.clampLureToTerrain(this.isLureHeldNearRod && !this.isCasting);
    this.lineSlack = THREE.MathUtils.clamp(1 - this.lineTension / 8, 0, 1);
  }

  updateSpool(dt, rodHeld, reelBoost, manualReelRate = 0) {
    if (this.isLureAirborne) {
      const distance = this.rodTipWorldPosition.distanceTo(this.lurePosition);
      const neededLength = Math.min(this.maxLineLength, Math.max(LINE_START_LENGTH, distance + 0.16));
      const tensionScale = THREE.MathUtils.clamp((this.lineTension + distance * 0.18) / 7, 0.22, 1);
      const earlyReleaseScale = THREE.MathUtils.clamp(this.castAge / 0.26, 0.28, 1);
      const maxFrameRelease = Math.min(LINE_MAX_SPOOL_OUT_PER_FRAME, this.spoolOutSpeed * dt * tensionScale * earlyReleaseScale);
      this.currentLineLength += Math.min(maxFrameRelease, Math.max(0, neededLength - this.currentLineLength));
      this.spoolLocked = false;
      this.emittedLineLength = this.currentLineLength;
      this.activePoints = THREE.MathUtils.clamp(2 + Math.floor((this.currentLineLength / Math.max(distance, this.currentLineLength, 0.001)) * (LINE_POINT_COUNT - 2)), 2, LINE_POINT_COUNT);
    }
    if (this.isLureOnWater && (rodHeld || reelBoost > 0)) {
      this.currentLineLength -= (this.autoReelInSpeed + reelBoost * LINE_REEL_PULL_BOOST) * dt * 0.18;
      this.spoolState = 'auto-reel-in';
    }
    if (!this.isLureHeldNearRod && manualReelRate > 0) {
      this.currentLineLength -= manualReelRate * dt;
      this.spoolState = 'manual-reel-in'; this.spoolLocked = false;
      this.lineTension = Math.max(this.lineTension, Math.min(10, manualReelRate * 0.9));
    }
    if (this.isLureHeldNearRod && rodHeld) this.currentLineLength = THREE.MathUtils.lerp(this.currentLineLength, LINE_START_LENGTH, dt * 2.5);
    if (!this.isLureAirborne && manualReelRate <= 0 && !(this.isLureOnWater && (rodHeld || reelBoost > 0))) this.spoolLocked = true;
    this.currentLineLength = THREE.MathUtils.clamp(this.currentLineLength, this.minLineLength, this.maxLineLength); this.targetLineLength = this.currentLineLength; this.emittedLineLength = this.currentLineLength; this.lineSegmentLength = this.currentLineLength / (LINE_POINT_COUNT - 1);
  }

  solveRope() {
    if (this.isLureAirborne) { this.solveAirborneRope(); return; }
    this.linePoints[0].copy(this.rodTipWorldPosition); this.linePoints[LINE_POINT_COUNT - 1].copy(this.lurePosition);
    for (let i = 1; i < LINE_POINT_COUNT - 1; i += 1) this.linePoints[i].y += LINE_GRAVITY * 0.00045 * this.lineSlack;
    for (let iter = 0; iter < LINE_SEGMENT_ITERATIONS; iter += 1) {
      this.linePoints[0].copy(this.rodTipWorldPosition); this.linePoints[LINE_POINT_COUNT - 1].copy(this.lurePosition);
      for (let i = 0; i < LINE_POINT_COUNT - 1; i += 1) {
        const a = this.linePoints[i]; const b = this.linePoints[i + 1]; const delta = scratch.copy(b).sub(a); const len = Math.max(0.0001, delta.length()); const diff = (len - this.lineSegmentLength) / len; const movableA = i !== 0; const movableB = i + 1 !== LINE_POINT_COUNT - 1;
        if (movableA) a.addScaledVector(delta, diff * 0.5); if (movableB) b.addScaledVector(delta, -diff * 0.5);
      }
    }
    const sagScale = this.isLureOnWater ? 0.012 : 0.035;
    const sag = Math.min(this.isLureOnWater ? 0.42 : 1.6, this.lineSlack * this.currentLineLength * sagScale); for (let i = 1; i < LINE_POINT_COUNT - 1; i += 1) this.linePoints[i].addScaledVector(up, -Math.sin(Math.PI * i / (LINE_POINT_COUNT - 1)) * sag);
    if (this.isLureOnWater) {
      for (let i = 1; i < LINE_POINT_COUNT - 1; i += 1) {
        const t = i / (LINE_POINT_COUNT - 1);
        this.linePoints[i].lerp(scratch.copy(this.rodTipWorldPosition).lerp(this.lurePosition, t), 0.58);
      }
    }
    this.clampLineToTerrain();
  }

  solveAirborneRope() {
    const span = scratch.copy(this.lurePosition).sub(this.rodTipWorldPosition);
    const distance = Math.max(0.0001, span.length());
    const forward = span.clone().divideScalar(distance);
    const velocitySide = this.lureVelocity.clone().addScaledVector(forward, -this.lureVelocity.dot(forward));
    if (velocitySide.lengthSq() > 0.0001) velocitySide.normalize(); else velocitySide.set(0, 0, 0);
    const slackRatio = THREE.MathUtils.clamp((this.currentLineLength - distance) / Math.max(distance, 1), 0, 0.32);
    const trail = Math.min(0.8, this.lureVelocity.length() * 0.018) * (1 - slackRatio * 0.5);
    const sag = Math.min(0.24, slackRatio * 0.45 + this.castAge * 0.015);
    for (let i = 0; i < LINE_POINT_COUNT; i += 1) {
      const t = i / (LINE_POINT_COUNT - 1);
      this.linePoints[i].lerpVectors(this.rodTipWorldPosition, this.lurePosition, t);
      const arc = Math.sin(Math.PI * t);
      this.linePoints[i].addScaledVector(velocitySide, -trail * arc * (1 - t * 0.35));
      this.linePoints[i].y -= sag * arc;
      this.previousPoints[i].copy(this.linePoints[i]);
    }
    this.linePoints[0].copy(this.rodTipWorldPosition); this.linePoints[LINE_POINT_COUNT - 1].copy(this.lurePosition);
  }

  getDebugState() { return { lineLength: this.currentLineLength, lineTension: this.lineTension, lureMode: this.isLureOnWater ? 'water' : this.isLureAirborne ? 'airborne' : this.isLureGrounded ? 'grounded' : 'held', lureSpeed: this.lureVelocity.length(), spoolState: this.spoolLocked ? `${this.spoolState}-spool-locked` : this.spoolState }; }
}
