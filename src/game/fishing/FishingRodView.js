import * as THREE from 'three';
import { createRodA1Mesh, resolveGameplayRodForItem, CANONICAL_GAMEPLAY_ROD_ID } from './FishingRodFactory.js';
import { CAST_ROD_RETURN_SPEED, CAST_ROD_SMOOTHING } from './CastingTuning.js';

export class FishingRodView {
  constructor({ camera, equipmentRuntime }) {
    this.camera = camera;
    this.equipmentRuntime = equipmentRuntime;
    this.root = new THREE.Group();
    this.root.name = 'first-person-canonical-Rod-A1-view';
    this.root.visible = false;
    this.root.position.set(0.72, -0.78, -1.35);
    this.root.rotation.set(-0.62, -0.28, 0.44);
    this.rod = createRodA1Mesh({ id: 'first-person-rodA1', origin: new THREE.Vector3(), yaw: Math.PI / 2, includeLine: true });
    this.rod.scale.setScalar(0.62);
    this.root.add(this.rod);
    this.camera.add(this.root);
    this.gestureState = { dragging: false, loadAmount: 0, rodYaw: 0, rodPitch: 0, releaseSnap: 0 };
    this.pose = { yaw: 0, pitch: 0, bend: 0, snap: 0 };
  }

  isEquipped() {
    return resolveGameplayRodForItem(this.equipmentRuntime?.getEquippedWeaponProfile?.().id)?.id === CANONICAL_GAMEPLAY_ROD_ID;
  }

  setGestureState(castState = {}) {
    this.gestureState = { ...this.gestureState, ...castState };
  }

  getWorldTipPosition() {
    const tip = this.rod?.userData?.tipLocalPosition?.clone?.() ?? new THREE.Vector3(1.4, 0.5, 0);
    tip.multiply(this.rod.scale);
    return this.rod.localToWorld(tip);
  }

  update(deltaSeconds, castState = {}) {
    const equipped = this.isEquipped();
    this.root.visible = equipped;
    if (!equipped) return;
    this.setGestureState(castState);
    const dt = Math.max(0.001, Math.min(0.05, deltaSeconds));
    const active = this.gestureState.dragging === true;
    const load = THREE.MathUtils.clamp(this.gestureState.loadAmount ?? 0, 0, 1);
    const targetYaw = active ? THREE.MathUtils.clamp(this.gestureState.rodYaw ?? 0, -0.7, 0.7) : 0;
    const targetPitch = active ? THREE.MathUtils.clamp(this.gestureState.rodPitch ?? 0, -0.48, 0.72) : 0;
    const smoothing = active ? CAST_ROD_SMOOTHING : Math.min(1, dt * CAST_ROD_RETURN_SPEED);
    this.pose.yaw = THREE.MathUtils.lerp(this.pose.yaw, targetYaw, smoothing);
    this.pose.pitch = THREE.MathUtils.lerp(this.pose.pitch, targetPitch, smoothing);
    this.pose.bend = THREE.MathUtils.lerp(this.pose.bend, active ? load : 0, active ? 0.18 : Math.min(1, dt * CAST_ROD_RETURN_SPEED));
    this.pose.snap = Math.max(0, Math.max(this.pose.snap, this.gestureState.releaseSnap ?? 0) - dt * 5.2);
    const t = performance.now() / 1000;
    const snapForward = Math.sin(this.pose.snap * Math.PI) * 0.28;
    this.root.position.x = 0.72 + this.pose.yaw * 0.12;
    this.root.position.y = -0.78 - this.pose.bend * 0.08 + snapForward * 0.03;
    this.root.rotation.x = -0.62 + this.pose.pitch * 0.48 - this.pose.bend * 0.24 + snapForward + Math.sin(t * 2.1) * 0.006;
    this.root.rotation.y = -0.28 + this.pose.yaw * 0.42;
    this.root.rotation.z = 0.44 + this.pose.yaw * 0.34 + this.pose.bend * 0.12 - snapForward * 0.18;
    this.rod.rotation.z = Math.PI / 2 - this.pose.bend * 0.18 + snapForward * 0.22;
    this.rod.rotation.x = this.pose.yaw * 0.08;
  }
}
