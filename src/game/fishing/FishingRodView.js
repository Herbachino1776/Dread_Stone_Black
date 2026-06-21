import * as THREE from 'three';
import { createRodA1Mesh, resolveGameplayRodForItem, CANONICAL_GAMEPLAY_ROD_ID } from './FishingRodFactory.js';

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
  }

  isEquipped() {
    return resolveGameplayRodForItem(this.equipmentRuntime?.getEquippedWeaponProfile?.().id)?.id === CANONICAL_GAMEPLAY_ROD_ID;
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
    const load = Math.max(0, Math.min(1, castState.loadAmount ?? 0));
    const t = performance.now() / 1000;
    this.root.rotation.x = -0.62 - load * 0.22 + Math.sin(t * 2.1) * 0.006;
    this.root.rotation.z = 0.44 + load * 0.12;
  }
}
