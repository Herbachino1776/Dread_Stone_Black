import * as THREE from 'three';
import { BROADSWORD_GESTURE, BROADSWORD_ITEM_ID } from './BroadswordTuning.js';
export class BroadswordGestureController {
  constructor({ app, view, controls, equipmentRuntime } = {}) { this.viewport = app.querySelector('[data-game="viewport"]') ?? app; this.view = view; this.controls = controls; this.equipmentRuntime = equipmentRuntime; this.state = this.createIdleState(); this.debug = { equipped: false, gestureActive: false, swipeDistance: 0, releaseSpeed: 0, attackType: 'rightSlash', attackPhase: 'idle', cooldown: 0, hitWindowActive: false, constants: BROADSWORD_GESTURE }; this.bind(); }
  createIdleState() { return { active: false, pointerId: null, startX: 0, startY: 0, history: [], cooldown: 0, attackAge: Infinity, attackType: 'rightSlash' }; }
  isEquipped() { return this.equipmentRuntime?.getEquippedWeaponProfile?.().id === BROADSWORD_ITEM_ID; }
  bind() { this.viewport.addEventListener('pointerdown', (e) => { if (!this.isEquipped() || this.state.active || this.state.cooldown > 0) return; const hit = this.view?.projectGestureHit?.(e.clientX, e.clientY, this.viewport, BROADSWORD_GESTURE.hitRadius); if (!hit) return; e.preventDefault(); this.viewport.setPointerCapture?.(e.pointerId); this.state = { ...this.state, active: true, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, history: [this.sample(e)] }; this.view?.setGestureState?.({ active: true, dx: 0, dy: 0 }); }, { passive: false }); this.viewport.addEventListener('pointermove', (e) => { if (!this.state.active || e.pointerId !== this.state.pointerId) return; e.preventDefault(); this.record(e); }, { passive: false }); const end = (e) => { if (!this.state.active || e.pointerId !== this.state.pointerId) return; e.preventDefault(); this.release(e); }; this.viewport.addEventListener('pointerup', end, { passive: false }); this.viewport.addEventListener('pointercancel', end, { passive: false }); }
  sample(e) { return { x: e.clientX, y: e.clientY, timeMs: performance.now() }; }
  record(e) { this.state.history.push(this.sample(e)); this.state.history = this.state.history.slice(-10); this.view?.setGestureState?.({ active: true, dx: e.clientX - this.state.startX, dy: e.clientY - this.state.startY }); }
  release(e) { this.record(e); const dx = e.clientX - this.state.startX; const dy = e.clientY - this.state.startY; const distance = Math.hypot(dx, dy); const velocity = this.computeVelocity(); const speed = velocity.length(); const valid = distance >= BROADSWORD_GESTURE.minDragDistance || speed >= BROADSWORD_GESTURE.minReleaseSpeed; const type = this.classifyAttack(dx, dy, velocity); this.debug.swipeDistance = distance; this.debug.releaseSpeed = speed; this.debug.attackType = type; this.state.active = false; this.view?.setGestureState?.({ active: false, dx: 0, dy: 0 }); if (!valid) return; this.state.cooldown = BROADSWORD_GESTURE.cooldown; this.state.attackAge = 0; this.state.attackType = type; this.view?.triggerAttack?.(type); this.controls?.queueAttack?.(); navigator.vibrate?.(10); }
  computeVelocity() { const now = performance.now(); const recent = this.state.history.filter((p) => now - p.timeMs <= BROADSWORD_GESTURE.historyMs); if (recent.length < 2) return new THREE.Vector2(); const first = recent[0]; const last = recent[recent.length - 1]; const dt = Math.max(0.016, (last.timeMs - first.timeMs) / 1000); const v = new THREE.Vector2((last.x - first.x) / dt, (last.y - first.y) / dt); const speed = v.length(); return speed > BROADSWORD_GESTURE.maxReleaseSpeed ? v.multiplyScalar(BROADSWORD_GESTURE.maxReleaseSpeed / speed) : v; }
  classifyAttack(dx, dy, velocity) {
    const releaseDx = Math.abs(velocity.x) > Math.abs(dx) * 7 ? velocity.x * 0.12 : dx;
    const releaseDy = Math.abs(velocity.y) > Math.abs(dy) * 7 ? velocity.y * 0.12 : dy;
    const absX = Math.abs(releaseDx);
    const absY = Math.abs(releaseDy);
    const rect = this.viewport?.getBoundingClientRect?.();
    const lowStart = rect ? this.state.startY >= rect.top + rect.height * BROADSWORD_GESTURE.lowStartViewportRatio : false;
    const upward = releaseDy < 0;
    const downward = releaseDy > 0;

    if (downward && absX >= BROADSWORD_GESTURE.diagonalDownMinComponent * absY && absY >= BROADSWORD_GESTURE.diagonalDownMinComponent * absX) return 'diagonalDown';
    if (upward && (lowStart || absY >= absX * BROADSWORD_GESTURE.stabVerticalDominance)) return 'stab';
    if (absX >= absY * BROADSWORD_GESTURE.horizontalDominance) return releaseDx < 0 ? 'leftSlash' : 'rightSlash';
    if (downward && absX > 18) return 'diagonalDown';
    return upward ? 'stab' : (releaseDx < 0 ? 'leftSlash' : 'rightSlash');
  }
  notifyFallbackAttack(type = 'rightSlash') { if (!this.isEquipped() || this.view?.debug?.attackPhase === 'swing') return; this.state.attackAge = 0; this.state.attackType = type; this.debug.attackType = type; this.view?.triggerAttack?.(type); }
  update(deltaSeconds) { this.state.cooldown = Math.max(0, this.state.cooldown - deltaSeconds); this.state.attackAge += deltaSeconds; this.debug.equipped = this.isEquipped(); this.debug.gestureActive = this.state.active; this.debug.cooldown = this.state.cooldown; this.debug.attackPhase = this.view?.debug?.attackPhase ?? 'idle'; const p = this.state.attackAge / BROADSWORD_GESTURE.swingDuration; this.debug.hitWindowActive = p >= BROADSWORD_GESTURE.damageWindowStart && p <= BROADSWORD_GESTURE.damageWindowEnd; }
}
