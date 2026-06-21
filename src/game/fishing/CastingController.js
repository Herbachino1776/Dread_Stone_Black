import * as THREE from 'three';
import { LureProjectile } from './LureProjectile.js';
import { FishingWaterResolver } from './FishingWaterResolver.js';

export class CastingController {
  constructor({ app, camera, player, dungeon, hud, rodView, equipmentRuntime }) {
    this.camera = camera; this.player = player; this.dungeon = dungeon; this.hud = hud; this.rodView = rodView; this.equipmentRuntime = equipmentRuntime;
    this.state = { dragging: false, loadAmount: 0 };
    this.zone = document.createElement('div'); this.zone.className = 'cast-zone'; this.zone.setAttribute('aria-label', 'Drag to Cast'); this.zone.textContent = 'Drag to Cast';
    app.querySelector('[data-game="viewport"]')?.append(this.zone);
    this.projectile = new LureProjectile({ scene: dungeon.scene, dungeon, waterResolver: new FishingWaterResolver({ dungeon }), onLanded: (result) => this.handleLanded(result) });
    this.bind();
  }
  isEquipped() { return this.rodView?.isEquipped?.() === true; }
  bind() {
    this.zone.addEventListener('pointerdown', (e) => { if (!this.isEquipped()) return; e.preventDefault(); this.zone.setPointerCapture(e.pointerId); this.state = { dragging: true, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, loadAmount: 0 }; this.zone.textContent = 'Release to Cast'; });
    this.zone.addEventListener('pointermove', (e) => { if (!this.state.dragging || e.pointerId !== this.state.pointerId) return; e.preventDefault(); const dx = e.clientX - this.state.startX; const dy = e.clientY - this.state.startY; this.state.x = e.clientX; this.state.y = e.clientY; this.state.loadAmount = Math.max(0, Math.min(1, (dy + Math.abs(dx) * 0.25) / 150)); });
    const end = (e) => { if (!this.state.dragging || e.pointerId !== this.state.pointerId) return; e.preventDefault(); this.release(e); };
    this.zone.addEventListener('pointerup', end); this.zone.addEventListener('pointercancel', end);
  }
  update(deltaSeconds) {
    this.zone.classList.toggle('is-visible', this.isEquipped());
    this.projectile.update(deltaSeconds);
    if (this.isEquipped() && !this.state.dragging) this.zone.textContent = 'Drag to Cast';
  }
  release(e) {
    const dx = e.clientX - this.state.startX; const dy = e.clientY - this.state.startY; const load = this.state.loadAmount; this.state.dragging = false;
    if (load < 0.18 || dy < 22) { this.hud.showMessage('Cast Failed'); this.zone.textContent = 'Drag to Cast'; return; }
    this.projectile.cleanup();
    const start = this.rodView.getWorldTipPosition(); const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
    dir.y = Math.max(0.18, dir.y + 0.18 + load * 0.28); dir.x += THREE.MathUtils.clamp(dx / 600, -0.22, 0.22); dir.normalize();
    const power = THREE.MathUtils.lerp(10, 25, load); this.projectile.launch(start, dir.multiplyScalar(power)); this.hud.showMessage('Lure Cast');
  }
  handleLanded({ position, zone, success }) {
    if (!success) { this.hud.showMessage('Cast Failed'); return; }
    const pickup = this.dungeon.spawnRawFishPickupFromCast?.(position, zone, this.player);
    this.hud.showMessage(pickup ? 'Fish On' : 'Cast Failed');
  }
}
