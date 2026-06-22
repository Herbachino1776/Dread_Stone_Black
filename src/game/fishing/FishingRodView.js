import * as THREE from 'three';
import { createRodA1Mesh, resolveGameplayRodForItem, CANONICAL_GAMEPLAY_ROD_ID } from './FishingRodFactory.js';
import { ROD_GRAB_HIT_RADIUS, ROD_REST_POS, ROD_REST_ROT } from './CastingTuning.js';

const screenPoint = new THREE.Vector3();
const worldPoint = new THREE.Vector3();
const lastTipScratch = new THREE.Vector3();

export class FishingRodView {
  constructor({ camera, equipmentRuntime }) {
    this.camera = camera;
    this.equipmentRuntime = equipmentRuntime;
    this.root = new THREE.Group();
    this.root.name = 'first-person-canonical-Rod-A1-view-raised-diagonal-touch-surface';
    this.root.visible = false;
    this.root.position.set(ROD_REST_POS.x, ROD_REST_POS.y, ROD_REST_POS.z);
    this.root.rotation.set(ROD_REST_ROT.x, ROD_REST_ROT.y, ROD_REST_ROT.z);
    this.rod = createRodA1Mesh({ id: 'first-person-rodA1', origin: new THREE.Vector3(), yaw: Math.PI / 2, includeLine: true });
    this.rod.scale.setScalar(0.66);
    this.root.add(this.rod);
    this.camera.add(this.root);
    this.gestureState = { dragging: false, loadAmount: 0, rodYaw: 0, rodPitch: 0, releaseSnap: 0, grabT: 0 };
    this.pose = { yaw: 0, pitch: 0, bend: 0, snap: 0 };
    this.lastTipPosition = new THREE.Vector3();
    this.tipVelocity = new THREE.Vector3();
    this.hasLastTip = false;
  }

  isEquipped() {
    return resolveGameplayRodForItem(this.equipmentRuntime?.getEquippedWeaponProfile?.().id)?.id === CANONICAL_GAMEPLAY_ROD_ID;
  }

  setGestureState(castState = {}) { this.gestureState = { ...this.gestureState, ...castState }; }

  getRodLocalPointAt(t) {
    const tip = this.rod?.userData?.tipLocalPosition?.clone?.() ?? new THREE.Vector3(0, 0.34, 2.25);
    const handle = this.rod?.userData?.handleLocalPosition?.clone?.() ?? new THREE.Vector3(0, 0.16, -2.4);
    return handle.lerp(tip, THREE.MathUtils.clamp(t, 0, 1));
  }

  getWorldPointAt(t) {
    const point = this.getRodLocalPointAt(t).multiply(this.rod.scale);
    return this.rod.localToWorld(point);
  }

  getWorldTipPosition() { return this.getWorldPointAt(1); }
  getWorldTipVelocity() { return this.tipVelocity.clone(); }

  projectRodGrabHit(clientX, clientY, viewport) {
    if (!this.isEquipped() || !this.root.visible || !viewport) return null;
    this.camera.updateMatrixWorld();
    this.root.updateMatrixWorld(true);
    const rect = viewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best = null;
    const steps = 18;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      worldPoint.copy(this.getWorldPointAt(t));
      screenPoint.copy(worldPoint).project(this.camera);
      if (screenPoint.z < -1 || screenPoint.z > 1) continue;
      const sx = (screenPoint.x * 0.5 + 0.5) * rect.width;
      const sy = (-screenPoint.y * 0.5 + 0.5) * rect.height;
      const dist = Math.hypot(x - sx, y - sy);
      if (!best || dist < best.distance) best = { grabT: t, distance: dist, screenX: sx + rect.left, screenY: sy + rect.top };
    }
    if (!best || best.distance > ROD_GRAB_HIT_RADIUS) return null;
    return best;
  }

  update(deltaSeconds, castState = {}) {
    const equipped = this.isEquipped();
    this.root.visible = equipped;
    if (!equipped) return;
    this.setGestureState(castState);
    const dt = Math.max(0.001, Math.min(0.05, deltaSeconds));
    const active = this.gestureState.dragging === true;
    const load = THREE.MathUtils.clamp(this.gestureState.loadAmount ?? 0, 0, 1.25);
    const targetYaw = active ? THREE.MathUtils.clamp(this.gestureState.rodYaw ?? 0, -0.95, 0.95) : 0;
    const targetPitch = active ? THREE.MathUtils.clamp(this.gestureState.rodPitch ?? 0, -0.75, 0.9) : 0;
    const follow = active ? 0.38 : Math.min(1, dt * 6.2);
    this.pose.yaw = THREE.MathUtils.lerp(this.pose.yaw, targetYaw, follow);
    this.pose.pitch = THREE.MathUtils.lerp(this.pose.pitch, targetPitch, follow);
    this.pose.bend = THREE.MathUtils.lerp(this.pose.bend, active ? load : 0, active ? 0.2 : Math.min(1, dt * 8));
    this.pose.snap = Math.max(0, Math.max(this.pose.snap, this.gestureState.releaseSnap ?? 0) - dt * 5.4);
    const t = performance.now() / 1000;
    const snapForward = Math.sin(this.pose.snap * Math.PI) * 0.32;
    this.root.position.x = ROD_REST_POS.x + this.pose.yaw * 0.1;
    this.root.position.y = ROD_REST_POS.y - this.pose.bend * 0.06 + snapForward * 0.035;
    this.root.position.z = ROD_REST_POS.z - Math.abs(this.pose.pitch) * 0.035;
    this.root.rotation.x = ROD_REST_ROT.x + this.pose.pitch * 0.54 - this.pose.bend * 0.25 + snapForward + Math.sin(t * 2.1) * 0.004;
    this.root.rotation.y = ROD_REST_ROT.y + this.pose.yaw * 0.45;
    this.root.rotation.z = ROD_REST_ROT.z + this.pose.yaw * 0.3 + this.pose.bend * 0.14 - snapForward * 0.2;
    this.rod.rotation.z = Math.PI / 2 - this.pose.bend * 0.2 + snapForward * 0.24;
    this.rod.rotation.x = this.pose.yaw * 0.09;
    lastTipScratch.copy(this.getWorldTipPosition());
    if (this.hasLastTip) this.tipVelocity.copy(lastTipScratch).sub(this.lastTipPosition).divideScalar(dt);
    this.lastTipPosition.copy(lastTipScratch); this.hasLastTip = true;
  }
}
