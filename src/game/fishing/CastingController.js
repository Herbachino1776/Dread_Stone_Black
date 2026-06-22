import * as THREE from 'three';
import { LureProjectile } from './LureProjectile.js';
import { FishingWaterResolver } from './FishingWaterResolver.js';
import { CAST_GESTURE_HISTORY_MS, CAST_MIN_DRAG_DISTANCE, CAST_MIN_RELEASE_SPEED, CAST_MAX_RELEASE_SPEED, CAST_POWER_FROM_VELOCITY, CAST_POWER_FROM_LOAD, CAST_SIDE_AIM_SCALE, CAST_VERTICAL_ARC_SCALE, CAST_ROD_BEND_SCALE, CAST_MAX_RANGE } from './CastingTuning.js';

const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3(0, 1, 0);

export class CastingController {
  constructor({ app, camera, player, dungeon, hud, rodView, equipmentRuntime }) {
    this.camera = camera; this.player = player; this.dungeon = dungeon; this.hud = hud; this.rodView = rodView; this.equipmentRuntime = equipmentRuntime;
    this.state = this.createIdleState();
    this.debug = { enabled: false, loadAmount: 0, releaseSpeed: 0, castValid: false, launchVelocity: new THREE.Vector3(), lureHitType: 'none' };
    this.zone = document.createElement('div'); this.zone.className = 'cast-zone'; this.zone.setAttribute('aria-label', 'Drag Rod A1 to Cast'); this.zone.textContent = 'Drag Rod';
    app.querySelector('[data-game="viewport"]')?.append(this.zone);
    this.projectile = new LureProjectile({ scene: dungeon.scene, dungeon, waterResolver: new FishingWaterResolver({ dungeon }), maxCastRange: CAST_MAX_RANGE, onLanded: (result) => this.handleLanded(result) });
    this.bind();
  }
  createIdleState() { return { dragging: false, loadAmount: 0, gestureHistory: [], rodYaw: 0, rodPitch: 0, releaseSnap: 0, motionSmoothness: 0 }; }
  isEquipped() { return this.rodView?.isEquipped?.() === true; }
  bind() {
    this.zone.addEventListener('pointerdown', (e) => {
      if (!this.isEquipped()) return;
      e.preventDefault(); this.zone.setPointerCapture(e.pointerId);
      const sample = this.makeSample(e);
      this.state = { ...this.createIdleState(), dragging: true, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, gestureHistory: [sample] };
      this.rodView?.setGestureState?.(this.state); this.zone.textContent = 'Swing + Release';
    });
    this.zone.addEventListener('pointermove', (e) => {
      if (!this.state.dragging || e.pointerId !== this.state.pointerId) return;
      e.preventDefault(); this.recordGesture(e);
    });
    const end = (e) => { if (!this.state.dragging || e.pointerId !== this.state.pointerId) return; e.preventDefault(); this.release(e); };
    this.zone.addEventListener('pointerup', end); this.zone.addEventListener('pointercancel', end);
  }
  makeSample(e) { return { screenX: e.clientX, screenY: e.clientY, timeMs: performance.now() }; }
  recordGesture(e) {
    const previous = this.state.gestureHistory.at(-1) ?? this.makeSample(e);
    const sample = this.makeSample(e);
    const dx = sample.screenX - previous.screenX; const dy = sample.screenY - previous.screenY;
    this.state.x = sample.screenX; this.state.y = sample.screenY;
    this.state.gestureHistory.push(sample);
    const cutoff = sample.timeMs - 520;
    this.state.gestureHistory = this.state.gestureHistory.filter((point) => point.timeMs >= cutoff);
    const totalDx = sample.screenX - this.state.startX; const totalDy = sample.screenY - this.state.startY;
    const velocity = this.computeReleaseVelocity(sample.timeMs);
    const backwardLoad = Math.max(0, totalDy * 0.005 + Math.abs(totalDx) * 0.0012 - Math.max(0, -velocity.y) * 0.00018);
    const momentumLoad = Math.min(0.65, velocity.length() / CAST_MAX_RELEASE_SPEED);
    this.state.loadAmount = THREE.MathUtils.clamp((backwardLoad + momentumLoad * 0.55) * CAST_ROD_BEND_SCALE, 0, 1);
    this.state.motionSmoothness = this.computeMotionSmoothness();
    this.state.rodYaw = THREE.MathUtils.clamp(this.state.rodYaw + dx * 0.006, -0.7, 0.7);
    this.state.rodPitch = THREE.MathUtils.clamp(this.state.rodPitch + dy * 0.005, -0.48, 0.72);
    this.rodView?.setGestureState?.(this.state);
  }
  update(deltaSeconds) {
    this.zone.classList.toggle('is-visible', this.isEquipped());
    this.projectile.update(deltaSeconds);
    if (this.isEquipped() && !this.state.dragging) this.zone.textContent = 'Drag Rod';
  }
  computeReleaseVelocity(nowMs = performance.now()) {
    const recent = this.state.gestureHistory.filter((point) => nowMs - point.timeMs <= CAST_GESTURE_HISTORY_MS);
    if (recent.length < 2) return new THREE.Vector2(0, 0);
    const first = recent[0]; const last = recent[recent.length - 1]; const dt = Math.max(0.016, (last.timeMs - first.timeMs) / 1000);
    const velocity = new THREE.Vector2((last.screenX - first.screenX) / dt, (last.screenY - first.screenY) / dt);
    const speed = velocity.length();
    if (!Number.isFinite(speed) || speed <= 0) return new THREE.Vector2(0, 0);
    return velocity.multiplyScalar(Math.min(speed, CAST_MAX_RELEASE_SPEED) / speed);
  }
  computeMotionSmoothness() {
    const samples = this.state.gestureHistory;
    if (samples.length < 4) return 0.5;
    let turns = 0; let segments = 0; let last = null;
    for (let i = 1; i < samples.length; i += 1) {
      const v = new THREE.Vector2(samples[i].screenX - samples[i - 1].screenX, samples[i].screenY - samples[i - 1].screenY);
      if (v.lengthSq() < 9) continue;
      v.normalize(); if (last) turns += Math.max(0, 1 - v.dot(last)); last = v; segments += 1;
    }
    return THREE.MathUtils.clamp(1 - turns / Math.max(1, segments), 0, 1);
  }
  release(e) {
    this.recordGesture(e);
    const velocity = this.computeReleaseVelocity(); const releaseSpeed = velocity.length();
    const dx = e.clientX - this.state.startX; const dy = e.clientY - this.state.startY; const dragDistance = Math.hypot(dx, dy);
    const load = this.state.loadAmount; const forwardFlick = -velocity.y;
    const castValid = dragDistance >= CAST_MIN_DRAG_DISTANCE && releaseSpeed >= CAST_MIN_RELEASE_SPEED && forwardFlick > CAST_MIN_RELEASE_SPEED * 0.28 && (load > 0.16 || releaseSpeed > CAST_MIN_RELEASE_SPEED * 1.35);
    this.debug.releaseSpeed = releaseSpeed; this.debug.castValid = castValid; this.debug.loadAmount = load;
    this.state.dragging = false; this.state.releaseSnap = castValid ? 1 : 0; this.rodView?.setGestureState?.(this.state);
    if (!castValid) { this.hud.showMessage('Cast Failed'); this.zone.textContent = 'Drag Rod'; return; }
    this.projectile.cleanup();
    const start = this.rodView.getWorldTipPosition(); const dir = this.buildLaunchDirection(velocity, load);
    const smoothBonus = THREE.MathUtils.lerp(0.82, 1.08, this.state.motionSmoothness);
    const power = THREE.MathUtils.clamp(releaseSpeed * CAST_POWER_FROM_VELOCITY + load * CAST_POWER_FROM_LOAD, 8, 29) * smoothBonus;
    const launchVelocity = dir.multiplyScalar(power);
    this.debug.launchVelocity.copy(launchVelocity);
    this.projectile.launch(start, launchVelocity); this.hud.showMessage('Lure Cast');
  }
  buildLaunchDirection(velocity, load) {
    this.camera.getWorldDirection(tmpForward); tmpForward.normalize();
    tmpRight.crossVectors(tmpForward, tmpUp).normalize();
    const side = THREE.MathUtils.clamp(velocity.x * CAST_SIDE_AIM_SCALE, -0.42, 0.42);
    const arc = THREE.MathUtils.clamp(-velocity.y * CAST_VERTICAL_ARC_SCALE + 0.2 + load * 0.18, 0.12, 0.68);
    return tmpForward.clone().multiplyScalar(1).addScaledVector(tmpRight, side).addScaledVector(tmpUp, arc).normalize();
  }
  handleLanded({ position, zone, success }) {
    this.debug.lureHitType = success ? 'fishable-water' : 'miss';
    if (!success) { this.hud.showMessage('Cast Failed'); return; }
    const pickup = this.dungeon.spawnRawFishPickupFromCast?.(position, zone, this.player);
    this.hud.showMessage(pickup ? 'Fish On' : 'Cast Failed');
  }
}
