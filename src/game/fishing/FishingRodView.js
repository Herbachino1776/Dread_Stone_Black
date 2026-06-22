import * as THREE from 'three';
import { createRodA1Mesh, resolveGameplayRodForItem, CANONICAL_GAMEPLAY_ROD_ID, COMPATIBLE_FISHING_ROD_ITEM_ID } from './FishingRodFactory.js';
import { REEL_GESTURE_FALLBACK_RADIUS, REEL_GESTURE_ZONE_RADIUS, ROD_GRAB_HIT_RADIUS, ROD_REST_POS, ROD_REST_ROT } from './CastingTuning.js';

const screenPoint = new THREE.Vector3();
const worldPoint = new THREE.Vector3();
const lastTipScratch = new THREE.Vector3();

export class FishingRodView {
  constructor({ camera, equipmentRuntime, gameState } = {}) {
    this.camera = camera;
    this.equipmentRuntime = equipmentRuntime;
    this.gameState = gameState;
    this.lastVisibleStateReason = 'not equipped';
    this.root = new THREE.Group();
    this.root.name = 'first-person-canonical-Rod-A1-view-raised-diagonal-touch-surface';
    this.root.visible = false;
    this.root.position.set(ROD_REST_POS.x, ROD_REST_POS.y, ROD_REST_POS.z);
    this.root.rotation.set(ROD_REST_ROT.x, ROD_REST_ROT.y, ROD_REST_ROT.z);
    this.rod = createRodA1Mesh({ id: 'first-person-rodA1', origin: new THREE.Vector3(), yaw: Math.PI / 2, includeLine: false });
    this.rod.scale.setScalar(0.66);
    this.root.add(this.rod);
    this.camera.add(this.root);
    this.gestureState = { dragging: false, loadAmount: 0, rodYaw: 0, rodPitch: 0, releaseSnap: 0, grabT: 0, rootOffsetX: 0, rootOffsetY: 0, rootOffsetZ: 0 };
    this.pose = { yaw: 0, pitch: 0, bend: 0, snap: 0, rootOffset: new THREE.Vector3() };
    this.lastTipPosition = new THREE.Vector3();
    this.tipVelocity = new THREE.Vector3();
    this.hasLastTip = false;
  }

  getVisibleStateReason() {
    const equippedWeaponId = this.equipmentRuntime?.getEquippedWeaponProfile?.().id ?? null;
    if (resolveGameplayRodForItem(equippedWeaponId)?.id === CANONICAL_GAMEPLAY_ROD_ID) return 'equipped via EquipmentRuntime weapon';

    const equippedFieldToolId = this.gameState?.getEquippedFieldTool?.() ?? this.gameState?.fieldSurvivalState?.equipment?.equippedTool ?? null;
    if (equippedFieldToolId === COMPATIBLE_FISHING_ROD_ITEM_ID || resolveGameplayRodForItem(equippedFieldToolId)?.id === CANONICAL_GAMEPLAY_ROD_ID) return 'equipped via GameState field tool';

    return 'not equipped';
  }

  isEquipped() {
    this.lastVisibleStateReason = this.getVisibleStateReason();
    return this.lastVisibleStateReason !== 'not equipped';
  }

  validateEquippedStateMatchesFieldTool() {
    const fieldToolIsRod = (this.gameState?.getEquippedFieldTool?.() ?? this.gameState?.fieldSurvivalState?.equipment?.equippedTool ?? null) === COMPATIBLE_FISHING_ROD_ITEM_ID;
    if (fieldToolIsRod && !this.isEquipped()) throw new Error('Fishing invalid: Rod A1 is equipped but FishingRodView reports not equipped.');
    return true;
  }

  setGestureState(castState = {}) { this.gestureState = { ...this.gestureState, ...castState }; }

  getRodLocalPointAt(t) {
    const tip = this.rod?.userData?.tipLocalPosition?.clone?.() ?? new THREE.Vector3(0, 0.34, 2.25);
    const handle = this.rod?.userData?.handleLocalPosition?.clone?.() ?? new THREE.Vector3(0, 0.16, -2.4);
    return handle.lerp(tip, THREE.MathUtils.clamp(t, 0, 1));
  }

  getWorldPointAt(t) {
    const point = this.getRodLocalPointAt(t);
    return this.rod.localToWorld(point);
  }

  getRodTipWorldPosition() {
    const tipAnchor = this.rod?.userData?.tipAnchor;
    if (tipAnchor?.getWorldPosition) return tipAnchor.getWorldPosition(new THREE.Vector3());
    return this.getWorldPointAt(1);
  }

  getWorldTipPosition() { return this.getRodTipWorldPosition(); }
  getWorldTipVelocity() { return this.tipVelocity.clone(); }


  getProjectedReelCenter(viewport) {
    if (!this.isEquipped() || !this.root.visible || !viewport) return null;
    this.camera.updateMatrixWorld();
    this.root.updateMatrixWorld(true);
    const rect = viewport.getBoundingClientRect();
    const handle = this.rod?.userData?.handleLocalPosition?.clone?.() ?? this.getRodLocalPointAt(0);
    const reelLocal = handle.add(new THREE.Vector3(0.18, -0.16, 0.34));
    worldPoint.copy(this.rod.localToWorld(reelLocal));
    screenPoint.copy(worldPoint).project(this.camera);
    if (screenPoint.z >= -1 && screenPoint.z <= 1) {
      return {
        x: (screenPoint.x * 0.5 + 0.5) * rect.width + rect.left,
        y: (-screenPoint.y * 0.5 + 0.5) * rect.height + rect.top,
        radius: REEL_GESTURE_ZONE_RADIUS,
        projected: true,
      };
    }
    return this.getFallbackReelCenter(viewport);
  }

  getFallbackReelCenter(viewport) {
    const rect = viewport.getBoundingClientRect();
    const radius = Math.min(REEL_GESTURE_FALLBACK_RADIUS, Math.max(70, Math.min(rect.width, rect.height) * 0.12));
    const hudSafeBottom = rect.top + rect.height - radius - 18;
    const joystickSafeRight = rect.left + rect.width - radius - 22;
    return {
      x: THREE.MathUtils.clamp(rect.left + rect.width * 0.8, rect.left + radius, joystickSafeRight),
      y: THREE.MathUtils.clamp(rect.top + rect.height * 0.76, rect.top + radius, hudSafeBottom),
      radius,
      projected: false,
      fallback: true,
    };
  }

  getReelGestureZones(viewport) {
    const zones = [];
    const projected = this.getProjectedReelCenter(viewport);
    if (projected) zones.push(projected);
    const fallback = this.getFallbackReelCenter(viewport);
    if (fallback && (!projected || Math.hypot(projected.x - fallback.x, projected.y - fallback.y) > 8)) zones.push(fallback);
    return zones;
  }

  projectReelGestureHit(clientX, clientY, viewport) {
    const zones = this.getReelGestureZones(viewport);
    let best = null;
    for (const center of zones) {
      const distance = Math.hypot(clientX - center.x, clientY - center.y);
      if (distance <= center.radius && (!best || distance < best.distance)) best = { ...center, distance, zones };
    }
    return best;
  }

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
    this.root.userData.visibleStateReason = this.lastVisibleStateReason;
    if (!equipped) return;
    this.setGestureState(castState);
    const dt = Math.max(0.001, Math.min(0.05, deltaSeconds));
    const active = this.gestureState.dragging === true;
    const load = THREE.MathUtils.clamp(this.gestureState.loadAmount ?? 0, 0, 1.25);
    const targetYaw = active ? THREE.MathUtils.clamp(this.gestureState.rodYaw ?? 0, -1.25, 1.25) : 0;
    const targetPitch = active ? THREE.MathUtils.clamp(this.gestureState.rodPitch ?? 0, -0.95, 1.05) : 0;
    const targetOffset = active
      ? new THREE.Vector3(this.gestureState.rootOffsetX ?? 0, this.gestureState.rootOffsetY ?? 0, this.gestureState.rootOffsetZ ?? 0)
      : new THREE.Vector3();
    const follow = active ? 0.62 : Math.min(1, dt * 7.4);
    this.pose.rootOffset.lerp(targetOffset, active ? 0.55 : Math.min(1, dt * 8.4));
    this.pose.yaw = THREE.MathUtils.lerp(this.pose.yaw, targetYaw, follow);
    this.pose.pitch = THREE.MathUtils.lerp(this.pose.pitch, targetPitch, follow);
    this.pose.bend = THREE.MathUtils.lerp(this.pose.bend, active ? load : 0, active ? 0.32 : Math.min(1, dt * 9));
    this.pose.snap = Math.max(0, Math.max(this.pose.snap, this.gestureState.releaseSnap ?? 0) - dt * 5.4);
    const t = performance.now() / 1000;
    const snapForward = Math.sin(this.pose.snap * Math.PI) * 0.38;
    this.root.position.x = ROD_REST_POS.x + this.pose.rootOffset.x + this.pose.yaw * 0.18;
    this.root.position.y = ROD_REST_POS.y + this.pose.rootOffset.y - this.pose.bend * 0.08 + snapForward * 0.04;
    this.root.position.z = ROD_REST_POS.z + this.pose.rootOffset.z - Math.abs(this.pose.pitch) * 0.055;
    this.root.rotation.x = ROD_REST_ROT.x + this.pose.pitch * 0.72 - this.pose.bend * 0.3 + snapForward + Math.sin(t * 2.1) * 0.004;
    this.root.rotation.y = ROD_REST_ROT.y + this.pose.yaw * 0.72;
    this.root.rotation.z = ROD_REST_ROT.z + this.pose.yaw * 0.46 + this.pose.bend * 0.18 - snapForward * 0.2;
    this.rod.rotation.z = Math.PI / 2 - this.pose.bend * 0.2 + snapForward * 0.24;
    this.rod.rotation.x = this.pose.yaw * 0.09;
    lastTipScratch.copy(this.getWorldTipPosition());
    if (this.hasLastTip) this.tipVelocity.copy(lastTipScratch).sub(this.lastTipPosition).divideScalar(dt);
    this.lastTipPosition.copy(lastTipScratch); this.hasLastTip = true;
  }
}
