import * as THREE from 'three';
import { LureProjectile } from './LureProjectile.js';
import { FishingWaterResolver } from './FishingWaterResolver.js';
import { CAST_GESTURE_HISTORY_MS, CAST_MIN_DRAG_DISTANCE, CAST_MIN_RELEASE_SPEED, CAST_MAX_RELEASE_SPEED, CAST_POWER_FROM_VELOCITY, CAST_POWER_FROM_LOAD, CAST_SIDE_AIM_SCALE, CAST_VERTICAL_ARC_SCALE, CAST_ROD_BEND_SCALE, CAST_MAX_RANGE, ROD_GRAB_SPRING, ROD_GRAB_DAMPING, ROD_ANGULAR_SPRING, ROD_ANGULAR_DAMPING, ROD_MASS_FEEL, ROD_BEND_RELEASE_SCALE, ROD_RELEASE_SNAP_SCALE } from './CastingTuning.js';

const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3(0, 1, 0);

export class CastingController {
  constructor({ app, camera, player, dungeon, hud, rodView }) {
    this.camera = camera; this.player = player; this.dungeon = dungeon; this.hud = hud; this.rodView = rodView;
    this.viewport = app.querySelector('[data-game="viewport"]') ?? app;
    this.state = this.createIdleState();
    this.debug = { enabled: false, loadAmount: 0, releaseSpeed: 0, castValid: false, launchVelocity: new THREE.Vector3(), lureHitType: 'none', lineLength: 0, lineTension: 0, lureMode: 'held', lureSpeed: 0, spoolState: 'held', fishableWaterId: null };
    this.projectile = new LureProjectile({ scene: dungeon.scene, dungeon, waterResolver: new FishingWaterResolver({ dungeon }), maxCastRange: CAST_MAX_RANGE, onLanded: (result) => this.handleLanded(result) });
    this.bind();
  }
  createIdleState() { return { dragging: false, loadAmount: 0, gestureHistory: [], rodYaw: 0, rodPitch: 0, rodYawVelocity: 0, rodPitchVelocity: 0, targetYaw: 0, targetPitch: 0, releaseSnap: 0, motionSmoothness: 0, grabT: 0, angularVelocity: 0, tipSpeed: 0 }; }
  isEquipped() { return this.rodView?.isEquipped?.() === true; }
  bind() {
    this.viewport.addEventListener('pointerdown', (e) => {
      if (!this.isEquipped()) return;
      const hit = this.rodView?.projectRodGrabHit?.(e.clientX, e.clientY, this.viewport);
      if (!hit) return;
      e.preventDefault(); this.viewport.setPointerCapture?.(e.pointerId);
      const sample = this.makeSample(e);
      this.state = { ...this.createIdleState(), dragging: true, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, grabT: hit.grabT, grabScreenX: hit.screenX, grabScreenY: hit.screenY, gestureHistory: [sample] };
      this.rodView?.setGestureState?.(this.state);
    }, { passive: false });
    this.viewport.addEventListener('pointermove', (e) => {
      if (!this.state.dragging || e.pointerId !== this.state.pointerId) return;
      e.preventDefault(); this.recordGesture(e);
    }, { passive: false });
    const end = (e) => { if (!this.state.dragging || e.pointerId !== this.state.pointerId) return; e.preventDefault(); this.release(e); };
    this.viewport.addEventListener('pointerup', end, { passive: false }); this.viewport.addEventListener('pointercancel', end, { passive: false });
  }
  makeSample(e) { return { screenX: e.clientX, screenY: e.clientY, timeMs: performance.now(), rodYaw: this.state.rodYaw, rodPitch: this.state.rodPitch }; }
  recordGesture(e) {
    const previous = this.state.gestureHistory.at(-1) ?? this.makeSample(e);
    const sample = this.makeSample(e);
    const dx = sample.screenX - previous.screenX; const dy = sample.screenY - previous.screenY;
    this.state.x = sample.screenX; this.state.y = sample.screenY;
    this.state.gestureHistory.push(sample);
    const cutoff = sample.timeMs - 520;
    this.state.gestureHistory = this.state.gestureHistory.filter((point) => point.timeMs >= cutoff);
    const leverage = THREE.MathUtils.lerp(0.72, 1.45, this.state.grabT ?? 0);
    this.state.targetYaw = THREE.MathUtils.clamp(this.state.targetYaw + dx * 0.007 * leverage, -0.95, 0.95);
    this.state.targetPitch = THREE.MathUtils.clamp(this.state.targetPitch + dy * 0.006 * leverage, -0.75, 0.9);
    const velocity = this.computeReleaseVelocity(sample.timeMs);
    const totalDx = sample.screenX - this.state.startX; const totalDy = sample.screenY - this.state.startY;
    const backwardLoad = Math.max(0, totalDy * 0.0045 + Math.abs(totalDx) * 0.0011 - Math.max(0, -velocity.y) * 0.00014);
    const momentumLoad = Math.min(0.75, velocity.length() / CAST_MAX_RELEASE_SPEED);
    this.state.loadAmount = THREE.MathUtils.clamp((backwardLoad + momentumLoad * 0.65 + this.state.angularVelocity * 0.08) * CAST_ROD_BEND_SCALE * leverage, 0, 1.2);
    this.state.motionSmoothness = this.computeMotionSmoothness();
    this.rodView?.setGestureState?.(this.state);
  }
  update(deltaSeconds) {
    const dt = Math.max(0.001, Math.min(0.05, deltaSeconds));
    const equipped = this.isEquipped();
    if (equipped) {
      const rodTip = this.rodView?.getWorldTipPosition?.();
      const reelBoost = this.state.dragging ? Math.min(1.5, Math.max(0, this.state.tipSpeed ?? 0) / 5.5) : 0;
      this.projectile.update(dt, rodTip, { rodHeld: this.state.dragging === true, reelBoost });
      Object.assign(this.debug, this.projectile.getDebugState?.() ?? {});
    }
    if (!equipped) { this.projectile.cleanup(); return; }
    if (this.state.dragging) {
      const gripPenalty = THREE.MathUtils.lerp(1, 1.38, this.state.grabT ?? 0);
      const yawAccel = ((this.state.targetYaw - this.state.rodYaw) * ROD_GRAB_SPRING - this.state.rodYawVelocity * ROD_GRAB_DAMPING) / (ROD_MASS_FEEL * gripPenalty);
      const pitchAccel = ((this.state.targetPitch - this.state.rodPitch) * ROD_ANGULAR_SPRING - this.state.rodPitchVelocity * ROD_ANGULAR_DAMPING) / (ROD_MASS_FEEL * gripPenalty);
      this.state.rodYawVelocity += yawAccel * dt; this.state.rodPitchVelocity += pitchAccel * dt;
      this.state.rodYaw = THREE.MathUtils.clamp(this.state.rodYaw + this.state.rodYawVelocity * dt, -0.95, 0.95);
      this.state.rodPitch = THREE.MathUtils.clamp(this.state.rodPitch + this.state.rodPitchVelocity * dt, -0.75, 0.9);
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
    this.debug.releaseSpeed = Math.max(releaseSpeed, tipSpeed * 105); this.debug.castValid = castValid; this.debug.loadAmount = load;
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
    const pickup = this.dungeon.spawnRawFishPickupFromCast?.(position, zone, this.player);
    this.hud.showMessage(pickup ? 'Fish On' : 'Cast Failed');
  }
}
