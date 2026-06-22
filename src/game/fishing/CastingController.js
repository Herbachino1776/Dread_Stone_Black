import * as THREE from 'three';
import { LureProjectile } from './LureProjectile.js';
import { FishingWaterResolver } from './FishingWaterResolver.js';
import { CAST_GESTURE_HISTORY_MS, CAST_MIN_DRAG_DISTANCE, CAST_MIN_RELEASE_SPEED, CAST_MAX_RELEASE_SPEED, CAST_POWER_FROM_VELOCITY, CAST_POWER_FROM_LOAD, CAST_SIDE_AIM_SCALE, CAST_VERTICAL_ARC_SCALE, CAST_ROD_BEND_SCALE, CAST_MAX_RANGE, ROD_GRAB_SPRING, ROD_GRAB_DAMPING, ROD_ANGULAR_SPRING, ROD_ANGULAR_DAMPING, ROD_MASS_FEEL, ROD_BEND_RELEASE_SCALE, ROD_RELEASE_SNAP_SCALE, REEL_GESTURE_INNER_DEADZONE, REEL_GESTURE_MIN_ARC_RAD, REEL_GESTURE_MAX_ARC_PER_SAMPLE, REEL_GESTURE_RATE_PER_RADIAN, REEL_GESTURE_MAX_RATE, REEL_GESTURE_TARGET_SMOOTHING, REEL_GESTURE_INPUT_HOLD_SECONDS, REEL_GESTURE_MAX_ACCELERATION, REEL_GESTURE_MAX_DECELERATION } from './CastingTuning.js';

const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3(0, 1, 0);

export function getClockwiseDeltaRadians(previousAngle, currentAngle) {
  let delta = currentAngle - previousAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  // Browser screen coordinates use +Y downward, so increasing atan2 angles are
  // clockwise on the player's glass. Only positive deltas should reel in.
  return delta;
}

export class CastingController {
  constructor({ app, camera, player, dungeon, hud, rodView, feedback = null }) {
    this.camera = camera; this.player = player; this.dungeon = dungeon; this.hud = hud; this.rodView = rodView; this.feedback = feedback;
    this.viewport = app.querySelector('[data-game="viewport"]') ?? app;
    this.state = this.createIdleState();
    this.reelState = this.createIdleReelState();
    this.debug = { enabled: false, loadAmount: 0, releaseSpeed: 0, castValid: false, launchVelocity: new THREE.Vector3(), lureHitType: 'none', lineLength: 0, minLineLength: 0, maxLineLength: 0, lineTension: 0, lureMode: 'held', lureSpeed: 0, spoolState: 'held', castAge: 0, lureDistance: 0, payoutAllowed: false, endpointConstraintActive: false, lureSpeedBeforeEndpointConstraint: 0, lureSpeedAfterEndpointConstraint: 0, castGraceActive: false, fishableWaterId: null, reelTargetRate: 0, reelActualRate: 0, reelAccelerationClamp: REEL_GESTURE_MAX_ACCELERATION, manualReelRate: 0, reelClockwiseDegrees: 0, reelZoneHit: false, reelZone: null, projectedReelCenter: null, fallbackReelCenter: null, activeReelPointerId: null, reelClockwiseDelta: 0, pointerMode: 'none', rodHitSamples: [], grabT: 0, hitRadius: 0, grabbedPointBefore: null, grabbedPointAfter: null, handPivot: null, rodTipVelocity: new THREE.Vector3(), releaseVelocity: { x: 0, y: 0 } };
    this.projectile = new LureProjectile({ scene: dungeon.scene, dungeon, waterResolver: new FishingWaterResolver({ dungeon }), maxCastRange: CAST_MAX_RANGE, onLanded: (result) => this.handleLanded(result) });
    this.dungeon.setFishingFeedback?.(this.feedback);
    this.bind();
  }
  createIdleState() { return { dragging: false, loadAmount: 0, gestureHistory: [], rodYaw: 0, rodPitch: 0, rodYawVelocity: 0, rodPitchVelocity: 0, targetYaw: 0, targetPitch: 0, rootOffsetX: 0, rootOffsetY: 0, rootOffsetZ: 0, rootVelocityX: 0, rootVelocityY: 0, rootVelocityZ: 0, targetRootOffsetX: 0, targetRootOffsetY: 0, targetRootOffsetZ: 0, releaseSnap: 0, motionSmoothness: 0, grabT: 0, angularVelocity: 0, tipSpeed: 0 }; }
  createIdleReelState() { return { active: false, pointerId: null, centerX: 0, centerY: 0, lastAngle: 0, lastTimeMs: 0, lastClockwiseTimeMs: -Infinity, targetRate: 0, actualRate: 0, rate: 0, accumulatedClockwise: 0, frameClockwiseRadians: 0 }; }
  isEquipped() { return this.rodView?.isEquipped?.() === true; }
  isLineDeployed() {
    const physics = this.projectile?.physics;
    return Boolean(physics && !physics.isLureHeldNearRod && (this.projectile.active || this.projectile.landed || physics.isLureAirborne || physics.isLureOnWater || physics.isLureGrounded));
  }
  bind() {
    this.viewport.addEventListener('pointerdown', (e) => {
      if (!this.isEquipped()) return;
      const reelHit = this.isLineDeployed() ? this.rodView?.projectReelGestureHit?.(e.clientX, e.clientY, this.viewport) : null;
      if (reelHit) {
        e.preventDefault(); this.viewport.setPointerCapture?.(e.pointerId);
        this.debug.pointerMode = 'reel';
        this.rodView.debug.pointerMode = 'reel';
        this.startReelGesture(e, reelHit);
        return;
      }
      const hit = this.rodView?.projectRodGrabHit?.(e.clientX, e.clientY, this.viewport);
      if (!hit) return;
      e.preventDefault(); this.viewport.setPointerCapture?.(e.pointerId);
      const sample = this.makeSample(e);
      this.debug.pointerMode = 'rod-grab';
      this.debug.grabT = hit.grabT;
      this.debug.hitRadius = hit.radius;
      this.debug.rodHitSamples = this.rodView?.debug?.rodHitSamples ?? [];
      this.state = { ...this.createIdleState(), dragging: true, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, grabT: hit.grabT, grabScreenX: hit.screenX, grabScreenY: hit.screenY, gestureHistory: [sample] };
      this.rodView?.setGestureState?.(this.state);
    }, { passive: false });
    this.viewport.addEventListener('pointermove', (e) => {
      if (this.reelState.active && e.pointerId === this.reelState.pointerId) { e.preventDefault(); this.recordReelGesture(e); return; }
      if (!this.state.dragging || e.pointerId !== this.state.pointerId) return;
      e.preventDefault(); this.recordGesture(e);
    }, { passive: false });
    const end = (e) => {
      if (this.reelState.active && e.pointerId === this.reelState.pointerId) { e.preventDefault(); this.endReelGesture(); return; }
      if (!this.state.dragging || e.pointerId !== this.state.pointerId) return; e.preventDefault(); this.release(e);
    };
    this.viewport.addEventListener('pointerup', end, { passive: false }); this.viewport.addEventListener('pointercancel', end, { passive: false });
  }

  startReelGesture(e, hit) {
    const angle = Math.atan2(e.clientY - hit.y, e.clientX - hit.x);
    const carriedRate = this.reelState.actualRate ?? this.reelState.rate ?? 0;
    this.reelState = { ...this.createIdleReelState(), active: true, pointerId: e.pointerId, centerX: hit.x, centerY: hit.y, lastAngle: angle, lastTimeMs: performance.now(), actualRate: carriedRate, rate: carriedRate };
    this.debug.reelZoneHit = true;
    this.debug.reelZone = { x: hit.x, y: hit.y, radius: hit.radius, projected: hit.projected, fallback: hit.fallback === true };
    const zones = hit.zones ?? [];
    this.debug.projectedReelCenter = zones.find((zone) => zone.projected) ?? (hit.projected ? this.debug.reelZone : null);
    this.debug.fallbackReelCenter = zones.find((zone) => zone.fallback) ?? (hit.fallback ? this.debug.reelZone : null);
    this.debug.activeReelPointerId = e.pointerId;
  }
  recordReelGesture(e) {
    const now = performance.now();
    const dx = e.clientX - this.reelState.centerX; const dy = e.clientY - this.reelState.centerY;
    const radius = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const dt = THREE.MathUtils.clamp((now - this.reelState.lastTimeMs) / 1000, 0.016, 0.08);
    const delta = getClockwiseDeltaRadians(this.reelState.lastAngle, angle);
    const clockwise = radius >= REEL_GESTURE_INNER_DEADZONE ? THREE.MathUtils.clamp(delta, 0, REEL_GESTURE_MAX_ARC_PER_SAMPLE) : 0;
    this.debug.reelClockwiseDelta = clockwise;
    this.debug.activeReelPointerId = e.pointerId;
    if (clockwise >= REEL_GESTURE_MIN_ARC_RAD) {
      const cleanliness = THREE.MathUtils.clamp((radius - REEL_GESTURE_INNER_DEADZONE) / 42, 0.2, 1);
      const instantRate = THREE.MathUtils.clamp((clockwise / dt) * REEL_GESTURE_RATE_PER_RADIAN * cleanliness, 0, REEL_GESTURE_MAX_RATE);
      const targetAlpha = 1 - Math.exp(-REEL_GESTURE_TARGET_SMOOTHING * dt);
      this.reelState.targetRate = THREE.MathUtils.lerp(this.reelState.targetRate, instantRate, targetAlpha);
      this.reelState.lastClockwiseTimeMs = now;
      this.reelState.accumulatedClockwise += clockwise;
      this.reelState.frameClockwiseRadians = (this.reelState.frameClockwiseRadians ?? 0) + clockwise;
      if (this.reelState.accumulatedClockwise >= Math.PI / 2) {
        navigator.vibrate?.(8);
        this.reelState.accumulatedClockwise %= Math.PI / 2;
      }
    }
    this.reelState.lastAngle = angle; this.reelState.lastTimeMs = now;
  }
  endReelGesture() {
    this.reelState.active = false;
    this.reelState.pointerId = null;
    this.reelState.targetRate = 0;
    this.debug.activeReelPointerId = null;
  }

  updateReelRate(dt, nowMs = performance.now()) {
    const freshInput = this.reelState.active && nowMs - this.reelState.lastClockwiseTimeMs <= REEL_GESTURE_INPUT_HOLD_SECONDS * 1000;
    if (!freshInput) this.reelState.targetRate = Math.max(0, this.reelState.targetRate - REEL_GESTURE_MAX_DECELERATION * dt);
    const difference = this.reelState.targetRate - this.reelState.actualRate;
    const accelerationLimit = (difference >= 0 ? REEL_GESTURE_MAX_ACCELERATION : REEL_GESTURE_MAX_DECELERATION) * dt;
    this.reelState.actualRate += THREE.MathUtils.clamp(difference, -accelerationLimit, accelerationLimit);
    if (this.reelState.actualRate < 0.001 && this.reelState.targetRate <= 0) this.reelState.actualRate = 0;
    this.reelState.rate = this.reelState.actualRate;
  }

  makeSample(e) { return { screenX: e.clientX, screenY: e.clientY, timeMs: performance.now(), rodYaw: this.state.rodYaw, rodPitch: this.state.rodPitch }; }
  recordGesture(e) {
    const previous = this.state.gestureHistory.at(-1) ?? this.makeSample(e);
    const beforeProjection = this.rodView?.projectGrabbedPoint?.(this.state.grabT ?? 0, this.viewport);
    const sample = this.makeSample(e);
    const dx = sample.screenX - previous.screenX; const dy = sample.screenY - previous.screenY;
    this.state.x = sample.screenX; this.state.y = sample.screenY;
    this.state.gestureHistory.push(sample);
    const cutoff = sample.timeMs - 520;
    this.state.gestureHistory = this.state.gestureHistory.filter((point) => point.timeMs >= cutoff);
    const leverage = THREE.MathUtils.lerp(0.72, 1.45, this.state.grabT ?? 0);
    // Screen-space sign convention: browser pointer X grows right and Y grows down.
    // In the Rod A1 view transform, positive yaw projects the tip left and positive pitch projects it up,
    // so pointer deltas are negated here to keep the projected rod tip under the player's thumb.
    this.state.targetYaw = THREE.MathUtils.clamp(this.state.targetYaw - dx * 0.0095 * leverage, -1.25, 1.25);
    this.state.targetPitch = THREE.MathUtils.clamp(this.state.targetPitch - dy * 0.0082 * leverage, -0.95, 1.05);
    // Camera-local grab target: move the whole rod root with the same screen direction as the thumb.
    this.state.targetRootOffsetX = THREE.MathUtils.clamp(this.state.targetRootOffsetX + dx * 0.0075 * leverage, -0.82, 0.82);
    this.state.targetRootOffsetY = THREE.MathUtils.clamp(this.state.targetRootOffsetY - dy * 0.0048 * leverage, -0.58, 0.62);
    this.state.targetRootOffsetZ = THREE.MathUtils.clamp(this.state.targetRootOffsetZ - dy * 0.0032 * leverage + Math.abs(dx) * -0.0009, -0.72, 0.38);
    const velocity = this.computeReleaseVelocity(sample.timeMs);
    const totalDx = sample.screenX - this.state.startX; const totalDy = sample.screenY - this.state.startY;
    const backwardLoad = Math.max(0, totalDy * 0.0045 + Math.abs(totalDx) * 0.0011 - Math.max(0, -velocity.y) * 0.00014);
    const momentumLoad = Math.min(0.75, velocity.length() / CAST_MAX_RELEASE_SPEED);
    this.state.loadAmount = THREE.MathUtils.clamp((backwardLoad + momentumLoad * 0.65 + this.state.angularVelocity * 0.08) * CAST_ROD_BEND_SCALE * leverage, 0, 1.2);
    this.state.motionSmoothness = this.computeMotionSmoothness();
    this.rodView?.setGestureState?.(this.state);
    const afterProjection = this.rodView?.projectGrabbedPoint?.(this.state.grabT ?? 0, this.viewport);
    this.debug.grabbedPointBefore = beforeProjection;
    this.debug.grabbedPointAfter = afterProjection;
    this.debug.loadAmount = this.state.loadAmount;
    if (this.rodView?.debug) {
      this.rodView.debug.grabbedPointBefore = beforeProjection;
      this.rodView.debug.grabbedPointAfter = afterProjection;
    }
  }
  update(deltaSeconds) {
    const dt = Math.max(0.001, Math.min(0.05, deltaSeconds));
    const equipped = this.isEquipped();
    if (equipped) {
      const rodTip = this.rodView?.getWorldTipPosition?.();
      this.updateReelRate(dt);
      const reelBoost = this.state.dragging ? Math.min(1.5, Math.max(0, this.state.tipSpeed ?? 0) / 5.5) : 0;
      this.projectile.update(dt, rodTip, { rodHeld: this.state.dragging === true, reelBoost, manualReelRate: this.reelState.actualRate });
      this.dungeon.updatePhysicalFishAngling?.(dt, { player: this.player, lure: this.projectile, rodTip, manualReelRate: this.reelState.actualRate, reelClockwiseRadians: this.reelState.frameClockwiseRadians ?? 0, rodState: this.state, physics: this.projectile.physics });
      this.reelState.frameClockwiseRadians = 0;
      if (this.projectile.physics?.isFishHooked) {
        this.projectile.physics.solveRope?.();
        this.projectile.syncVisuals?.();
      }
      Object.assign(this.debug, this.projectile.getDebugState?.() ?? {});
      Object.assign(this.debug, { handPivot: this.rodView?.debug?.handPivot ?? null, rodHitSamples: this.rodView?.debug?.rodHitSamples ?? [], pointerMode: this.debug.pointerMode });
      this.debug.reelTargetRate = this.reelState.targetRate;
      this.debug.reelActualRate = this.reelState.actualRate;
      this.debug.reelAccelerationClamp = this.reelState.targetRate >= this.reelState.actualRate ? REEL_GESTURE_MAX_ACCELERATION : REEL_GESTURE_MAX_DECELERATION;
      this.debug.manualReelRate = this.reelState.actualRate;
      this.debug.reelClockwiseDegrees = THREE.MathUtils.radToDeg(this.reelState.accumulatedClockwise);
      const rodTipVelocity = this.rodView?.getWorldTipVelocity?.();
      if (rodTipVelocity) this.debug.rodTipVelocity.copy(rodTipVelocity);
    }
    if (!equipped) { this.dungeon.cancelPhysicalFishAngling?.(this.projectile.physics, 'rodUnequipped'); this.projectile.cleanup(); this.reelState = this.createIdleReelState(); this.debug.activeReelPointerId = null; return; }
    if (this.state.dragging) {
      const gripPenalty = THREE.MathUtils.lerp(1, 1.38, this.state.grabT ?? 0);
      const rootSpring = ROD_GRAB_SPRING * 1.35;
      const rootDamping = ROD_GRAB_DAMPING * 0.72;
      const ax = ((this.state.targetRootOffsetX - this.state.rootOffsetX) * rootSpring - this.state.rootVelocityX * rootDamping) / (ROD_MASS_FEEL * gripPenalty);
      const ay = ((this.state.targetRootOffsetY - this.state.rootOffsetY) * rootSpring - this.state.rootVelocityY * rootDamping) / (ROD_MASS_FEEL * gripPenalty);
      const az = ((this.state.targetRootOffsetZ - this.state.rootOffsetZ) * rootSpring - this.state.rootVelocityZ * rootDamping) / (ROD_MASS_FEEL * gripPenalty);
      this.state.rootVelocityX += ax * dt; this.state.rootVelocityY += ay * dt; this.state.rootVelocityZ += az * dt;
      this.state.rootOffsetX = THREE.MathUtils.clamp(this.state.rootOffsetX + this.state.rootVelocityX * dt, -0.9, 0.9);
      this.state.rootOffsetY = THREE.MathUtils.clamp(this.state.rootOffsetY + this.state.rootVelocityY * dt, -0.65, 0.7);
      this.state.rootOffsetZ = THREE.MathUtils.clamp(this.state.rootOffsetZ + this.state.rootVelocityZ * dt, -0.8, 0.45);
      const yawAccel = ((this.state.targetYaw - this.state.rodYaw) * ROD_ANGULAR_SPRING - this.state.rodYawVelocity * ROD_ANGULAR_DAMPING) / (ROD_MASS_FEEL * gripPenalty);
      const pitchAccel = ((this.state.targetPitch - this.state.rodPitch) * ROD_ANGULAR_SPRING - this.state.rodPitchVelocity * ROD_ANGULAR_DAMPING) / (ROD_MASS_FEEL * gripPenalty);
      this.state.rodYawVelocity += yawAccel * dt; this.state.rodPitchVelocity += pitchAccel * dt;
      this.state.rodYaw = THREE.MathUtils.clamp(this.state.rodYaw + this.state.rodYawVelocity * dt, -1.25, 1.25);
      this.state.rodPitch = THREE.MathUtils.clamp(this.state.rodPitch + this.state.rodPitchVelocity * dt, -0.95, 1.05);
      this.state.angularVelocity = Math.hypot(this.state.rodYawVelocity, this.state.rodPitchVelocity);
      this.state.tipSpeed = this.rodView?.getWorldTipVelocity?.().length?.() ?? 0;
      this.rodView?.setGestureState?.(this.state);
    }
  }
  computeReleaseVelocity(nowMs = performance.now()) {
    const recent = this.state.gestureHistory.filter((point) => nowMs - point.timeMs <= CAST_GESTURE_HISTORY_MS);
    if (recent.length < 2) return new THREE.Vector2(0, 0);
    const first = recent[0]; const last = recent[recent.length - 1]; const dt = Math.max(0.016, (last.timeMs - first.timeMs) / 1000);
    const velocity = new THREE.Vector2((last.screenX - first.screenX) / dt, (last.screenY - first.screenY) / dt);
    const speed = velocity.length(); if (!Number.isFinite(speed) || speed <= 0) return new THREE.Vector2(0, 0);
    return velocity.multiplyScalar(Math.min(speed, CAST_MAX_RELEASE_SPEED) / speed);
  }
  computeMotionSmoothness() {
    const samples = this.state.gestureHistory; if (samples.length < 4) return 0.5;
    let turns = 0; let segments = 0; let last = null;
    for (let i = 1; i < samples.length; i += 1) { const v = new THREE.Vector2(samples[i].screenX - samples[i - 1].screenX, samples[i].screenY - samples[i - 1].screenY); if (v.lengthSq() < 9) continue; v.normalize(); if (last) turns += Math.max(0, 1 - v.dot(last)); last = v; segments += 1; }
    return THREE.MathUtils.clamp(1 - turns / Math.max(1, segments), 0, 1);
  }
  release(e) {
    this.recordGesture(e);
    const velocity = this.computeReleaseVelocity(); const releaseSpeed = velocity.length();
    const dragDistance = Math.hypot(e.clientX - this.state.startX, e.clientY - this.state.startY);
    const tipVelocity = this.rodView?.getWorldTipVelocity?.() ?? new THREE.Vector3();
    const tipSpeed = tipVelocity.length(); const angularRelease = Math.hypot(this.state.rodYawVelocity, this.state.rodPitchVelocity);
    const load = this.state.loadAmount; const forwardFlick = -velocity.y + Math.max(0, -this.state.rodPitchVelocity) * 140;
    const castValid = dragDistance >= CAST_MIN_DRAG_DISTANCE && (releaseSpeed >= CAST_MIN_RELEASE_SPEED || tipSpeed > 5.5) && forwardFlick > CAST_MIN_RELEASE_SPEED * 0.24 && (load > 0.16 || angularRelease > 2.3);
    this.debug.releaseSpeed = Math.max(releaseSpeed, tipSpeed * 105); this.debug.releaseVelocity = { x: velocity.x, y: velocity.y }; this.debug.castValid = castValid; this.debug.loadAmount = load;
    this.state.dragging = false; this.state.releaseSnap = castValid ? Math.min(1.25, ROD_RELEASE_SNAP_SCALE * (0.45 + load)) : 0; this.rodView?.setGestureState?.(this.state);
    if (!castValid) { this.hud.showMessage('Cast Failed'); return; }
    const start = this.rodView.getWorldTipPosition(); const dir = this.buildLaunchDirection(velocity, load, tipVelocity);
    const smoothBonus = THREE.MathUtils.lerp(0.82, 1.08, this.state.motionSmoothness);
    const motionPower = releaseSpeed * CAST_POWER_FROM_VELOCITY + tipSpeed * 1.6 + angularRelease * ROD_BEND_RELEASE_SCALE;
    const power = THREE.MathUtils.clamp(motionPower + load * CAST_POWER_FROM_LOAD, 8, 29) * smoothBonus;
    const launchVelocity = dir.multiplyScalar(power); this.debug.launchVelocity.copy(launchVelocity);
    this.projectile.launch(start, launchVelocity); this.hud.showMessage('Lure Cast');
  }
  buildLaunchDirection(velocity, load, tipVelocity = new THREE.Vector3()) {
    this.camera.getWorldDirection(tmpForward); tmpForward.normalize(); tmpRight.crossVectors(tmpForward, tmpUp).normalize();
    const side = THREE.MathUtils.clamp((velocity.x * CAST_SIDE_AIM_SCALE) + tipVelocity.dot(tmpRight) * 0.035, -0.48, 0.48);
    const arc = THREE.MathUtils.clamp(-velocity.y * CAST_VERTICAL_ARC_SCALE + tipVelocity.y * 0.035 + 0.2 + load * 0.18, 0.12, 0.72);
    return tmpForward.clone().addScaledVector(tmpRight, side).addScaledVector(tmpUp, arc).normalize();
  }
  handleLanded({ position, zone, success }) {
    this.debug.lureHitType = success ? 'fishable-water' : 'miss';
    if (!success) { this.hud.showMessage('Cast Failed'); return; }
    this.dungeon.registerPhysicalLureLanding?.(position, zone, this.player);
    this.hud.showMessage('Lure Landed');
  }
}
