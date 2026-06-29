import * as THREE from 'three';
import { createRodA1Mesh, resolveGameplayRodForItem, CANONICAL_GAMEPLAY_ROD_ID, COMPATIBLE_FISHING_ROD_ITEM_ID } from './FishingRodFactory.js';
import { REEL_GESTURE_FALLBACK_RADIUS, REEL_GESTURE_ZONE_RADIUS, ROD_GRAB_HIT_RADIUS, ROD_GRAB_HIT_RADIUS_HANDLE, ROD_GRAB_HIT_RADIUS_SHAFT, ROD_GRAB_HIT_RADIUS_TIP, ROD_REST_POS, ROD_REST_ROT } from './CastingTuning.js';

const screenPoint = new THREE.Vector3();
const worldPoint = new THREE.Vector3();
const lastTipScratch = new THREE.Vector3();
const targetOffsetScratch = new THREE.Vector3();
const rodLocalScratch = new THREE.Vector3();
const rodHandleScratch = new THREE.Vector3();
const rodTipScratch = new THREE.Vector3();
const pivotDesiredWorld = new THREE.Vector3();
const pivotActualWorld = new THREE.Vector3();
const pivotDesiredCamera = new THREE.Vector3();
const pivotActualCamera = new THREE.Vector3();

const ROD_DOWNWARD_PITCH_SCALE = 0.42;
const ROD_DOWNWARD_PITCH_MAX = 0.38;
const ROD_STABLE_FORWARD_PITCH_OFFSET = -0.12;
const ROD_STABLE_CAMERA_Y_OFFSET = 0.08;
const ROD_CAMERA_SPACE_MIN_Y = -0.92;
const ROD_CAMERA_SPACE_MAX_Y = 0.72;

const HELD_ROD_VIEWMODEL_RENDER_ORDER = 10000;
const HELD_ROD_VIEWMODEL_DEPTH_OVERRIDE_NOTE = 'held Rod A1 overlay layer; rendered after world depth clear so water/terrain/grass cannot cover it';
export const HELD_ROD_VIEWMODEL_LAYER = 1;

function markHeldRodViewmodel(object) {
  let meshCount = 0;
  object.userData = {
    ...object.userData,
    viewmodelDepthOverride: HELD_ROD_VIEWMODEL_DEPTH_OVERRIDE_NOTE,
    viewmodelRenderOrder: HELD_ROD_VIEWMODEL_RENDER_ORDER,
  };
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    meshCount += 1;
    child.layers.set(HELD_ROD_VIEWMODEL_LAYER);
    child.renderOrder = HELD_ROD_VIEWMODEL_RENDER_ORDER;
    child.userData = {
      ...child.userData,
      viewmodelDepthOverride: HELD_ROD_VIEWMODEL_DEPTH_OVERRIDE_NOTE,
      viewmodelRenderOrder: HELD_ROD_VIEWMODEL_RENDER_ORDER,
    };
    const isMaterialArray = Array.isArray(child.material);
    const materials = isMaterialArray ? child.material : [child.material];
    const cloned = materials.map((material) => {
      const next = material.clone();
      next.depthTest = true;
      next.depthWrite = true;
      next.needsUpdate = true;
      next.userData = {
        ...(next.userData ?? {}),
        viewmodelDepthOverride: HELD_ROD_VIEWMODEL_DEPTH_OVERRIDE_NOTE,
        isolatedFromSharedRodMaterials: true,
      };
      return next;
    });
    child.material = isMaterialArray ? cloned : cloned[0];
  });
  object.userData.viewmodelMarkedMeshCount = meshCount;
  return meshCount;
}

export class FishingRodView {
  constructor({ camera, equipmentRuntime, gameState, dungeon } = {}) {
    this.camera = camera;
    this.equipmentRuntime = equipmentRuntime;
    this.gameState = gameState;
    this.dungeon = dungeon;
    this.lastVisibleStateReason = 'not equipped';
    this.root = new THREE.Group();
    this.root.name = 'first-person-canonical-Rod-A1-view-raised-diagonal-touch-surface';
    this.root.visible = false;
    this.root.layers.set(HELD_ROD_VIEWMODEL_LAYER);
    this.root.position.set(ROD_REST_POS.x, ROD_REST_POS.y + ROD_STABLE_CAMERA_Y_OFFSET, ROD_REST_POS.z);
    this.root.rotation.set(ROD_REST_ROT.x + ROD_STABLE_FORWARD_PITCH_OFFSET, ROD_REST_ROT.y, ROD_REST_ROT.z);
    this.rod = createRodA1Mesh({ id: 'first-person-rodA1', origin: new THREE.Vector3(), yaw: Math.PI / 2, includeLine: false });
    this.rod.layers.set(HELD_ROD_VIEWMODEL_LAYER);
    this.heldRodViewmodelMeshCount = markHeldRodViewmodel(this.rod);
    this.rod.scale.setScalar(0.66);
    this.root.add(this.rod);
    this.camera.add(this.root);
    this.gestureState = { dragging: false, loadAmount: 0, rodYaw: 0, rodPitch: 0, releaseSnap: 0, grabT: 0, rootOffsetX: 0, rootOffsetY: 0, rootOffsetZ: 0 };
    this.pose = { yaw: 0, pitch: 0, bend: 0, snap: 0, rootOffset: new THREE.Vector3() };
    this.lastTipPosition = new THREE.Vector3();
    this.tipVelocity = new THREE.Vector3();
    this.hasLastTip = false;
    this.debug = { enabled: false, rodHitSamples: [], grabPoint: null, grabT: 0, hitRadius: 0, grabbedPointBefore: null, grabbedPointAfter: null, handPivot: null, pointerMode: 'none', downwardPitch: null, cameraSpaceClamp: 0 };
    this.root.traverse((child) => child.layers?.set?.(HELD_ROD_VIEWMODEL_LAYER));
  }


  applyCameraSpaceClamp() {
    const clampedY = THREE.MathUtils.clamp(this.root.position.y, ROD_CAMERA_SPACE_MIN_Y, ROD_CAMERA_SPACE_MAX_Y);
    const correction = clampedY - this.root.position.y;
    if (correction !== 0) this.root.position.y = clampedY;
    this.debug.cameraSpaceClamp = correction;
    return correction;
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

  setGestureState(castState = {}) {
    const previousReleaseSnap = this.gestureState.releaseSnap ?? 0;
    const nextReleaseSnap = castState.releaseSnap ?? previousReleaseSnap;
    if (nextReleaseSnap > previousReleaseSnap) this.pose.snap = Math.max(this.pose.snap, nextReleaseSnap);
    this.gestureState = { ...this.gestureState, ...castState };
  }

  getRodLocalPointAt(t, target = new THREE.Vector3()) {
    const tipSource = this.rod?.userData?.tipLocalPosition;
    const handleSource = this.rod?.userData?.handleLocalPosition;
    rodTipScratch.copy(tipSource ?? { x: 0, y: 0.34, z: 2.25 });
    rodHandleScratch.copy(handleSource ?? { x: 0, y: 0.16, z: -2.4 });
    return target.lerpVectors(rodHandleScratch, rodTipScratch, THREE.MathUtils.clamp(t, 0, 1));
  }

  getWorldPointAt(t, target = new THREE.Vector3()) {
    this.getRodLocalPointAt(t, target);
    return this.rod.localToWorld(target);
  }

  getRodTipWorldPosition() {
    const tipAnchor = this.rod?.userData?.tipAnchor;
    if (tipAnchor?.getWorldPosition) return tipAnchor.getWorldPosition(lastTipScratch);
    return lastTipScratch.copy(this.getWorldPointAt(1, rodLocalScratch));
  }

  getWorldTipPosition() { return this.getRodTipWorldPosition(); }
  getWorldTipVelocity(target = new THREE.Vector3()) { return target.copy(this.tipVelocity); }


  getProjectedReelCenter(viewport) {
    if (!this.isEquipped() || !this.root.visible || !viewport) return null;
    this.camera.updateMatrixWorld();
    this.root.updateMatrixWorld(true);
    const rect = viewport.getBoundingClientRect();
    const handle = this.rod?.userData?.handleLocalPosition?.clone?.() ?? this.getRodLocalPointAt(0);
    const tip = this.rod?.userData?.tipLocalPosition?.clone?.() ?? this.getRodLocalPointAt(1);
    // The upright rest pose leaves the very butt of the grip on the screen edge,
    // so project the active reel gesture center from the visible lower grip area
    // rather than the off-screen end cap.
    const reelLocal = handle.lerp(tip, 0.16).add(new THREE.Vector3(0.08, 0, 0));
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

  getGrabHitRadius(t, rect) {
    const mobileBoost = Math.min(rect.width, rect.height) < 760 ? 1.18 : 1;
    const base = t < 0.24
      ? THREE.MathUtils.lerp(ROD_GRAB_HIT_RADIUS_HANDLE, ROD_GRAB_HIT_RADIUS_SHAFT, t / 0.24)
      : THREE.MathUtils.lerp(ROD_GRAB_HIT_RADIUS_SHAFT, ROD_GRAB_HIT_RADIUS_TIP, (t - 0.24) / 0.76);
    return Math.max(ROD_GRAB_HIT_RADIUS, base * mobileBoost);
  }

  projectWorldPointToViewport(point, viewport) {
    const rect = viewport.getBoundingClientRect();
    screenPoint.copy(point).project(this.camera);
    if (screenPoint.z < -1 || screenPoint.z > 1) return null;
    return {
      x: (screenPoint.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-screenPoint.y * 0.5 + 0.5) * rect.height + rect.top,
      z: screenPoint.z,
    };
  }

  projectGrabbedPoint(grabT, viewport) {
    if (!this.isEquipped() || !this.root.visible || !viewport) return null;
    this.camera.updateMatrixWorld();
    this.root.updateMatrixWorld(true);
    return this.projectWorldPointToViewport(this.getWorldPointAt(grabT), viewport);
  }

  projectRodGrabHit(clientX, clientY, viewport) {
    if (!this.isEquipped() || !this.root.visible || !viewport) return null;
    this.camera.updateMatrixWorld();
    this.root.updateMatrixWorld(true);
    const rect = viewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const samples = [];
    let best = null;
    const steps = 28;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      worldPoint.copy(this.getWorldPointAt(t, rodLocalScratch));
      screenPoint.copy(worldPoint).project(this.camera);
      if (screenPoint.z < -1 || screenPoint.z > 1) continue;
      const sx = (screenPoint.x * 0.5 + 0.5) * rect.width;
      const sy = (-screenPoint.y * 0.5 + 0.5) * rect.height;
      const radius = this.getGrabHitRadius(t, rect);
      const dist = Math.hypot(x - sx, y - sy);
      const candidate = { grabT: t, distance: dist, radius, screenX: sx + rect.left, screenY: sy + rect.top };
      samples.push(candidate);
      if (dist <= radius && (!best || dist / radius < best.distance / best.radius)) best = candidate;
    }
    this.debug.rodHitSamples = samples;
    this.debug.pointerMode = best ? 'rod-grab' : 'none';
    if (!best) return null;
    this.debug.grabPoint = { x: best.screenX, y: best.screenY };
    this.debug.grabT = best.grabT;
    this.debug.hitRadius = best.radius;
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
      ? targetOffsetScratch.set(this.gestureState.rootOffsetX ?? 0, this.gestureState.rootOffsetY ?? 0, this.gestureState.rootOffsetZ ?? 0)
      : targetOffsetScratch.set(0, 0, 0);
    const follow = 1 - Math.exp(-(active ? 48 : 7.4) * dt);
    const rootFollow = 1 - Math.exp(-(active ? 42 : 8.4) * dt);
    this.pose.rootOffset.lerp(targetOffset, rootFollow);
    this.pose.yaw = THREE.MathUtils.lerp(this.pose.yaw, targetYaw, follow);
    this.pose.pitch = THREE.MathUtils.lerp(this.pose.pitch, targetPitch, follow);
    const bendFollow = 1 - Math.exp(-(active ? 23 : 9) * dt);
    this.pose.bend = THREE.MathUtils.lerp(this.pose.bend, active ? load : 0, bendFollow);
    this.pose.snap = Math.max(0, this.pose.snap - dt * 5.4);
    const downwardPitch = Math.max(0, this.pose.pitch);
    const effectivePitch = this.pose.pitch < 0 ? this.pose.pitch : Math.min(ROD_DOWNWARD_PITCH_MAX, downwardPitch * ROD_DOWNWARD_PITCH_SCALE);
    this.debug.downwardPitch = { raw: this.pose.pitch, effective: effectivePitch, scale: ROD_DOWNWARD_PITCH_SCALE, max: ROD_DOWNWARD_PITCH_MAX };
    const snapForward = Math.sin(this.pose.snap * Math.PI) * 0.32;
    this.root.position.x = ROD_REST_POS.x + this.pose.rootOffset.x;
    this.root.position.y = ROD_REST_POS.y + ROD_STABLE_CAMERA_Y_OFFSET + this.pose.rootOffset.y;
    this.root.position.z = ROD_REST_POS.z + this.pose.rootOffset.z;
    this.root.rotation.set(ROD_REST_ROT.x + ROD_STABLE_FORWARD_PITCH_OFFSET, ROD_REST_ROT.y, ROD_REST_ROT.z);
    this.root.updateMatrixWorld(true);
    // Keep the lower grip planted in camera space so casts pivot from an implied hand instead of the rod root.
    pivotDesiredWorld.copy(this.getWorldPointAt(0.08, rodLocalScratch));
    this.root.rotation.x = ROD_REST_ROT.x + ROD_STABLE_FORWARD_PITCH_OFFSET + effectivePitch * 0.72 - this.pose.bend * 0.3 + snapForward;
    this.root.rotation.y = ROD_REST_ROT.y + this.pose.yaw * 0.72;
    this.root.rotation.z = ROD_REST_ROT.z + this.pose.yaw * 0.46 + this.pose.bend * 0.18 - snapForward * 0.2;
    this.root.position.y -= this.pose.bend * 0.03;
    this.root.position.z -= Math.max(0, effectivePitch) * 0.035;
    this.root.updateMatrixWorld(true);
    pivotActualWorld.copy(this.getWorldPointAt(0.08, rodLocalScratch));
    pivotDesiredCamera.copy(pivotDesiredWorld); this.camera.worldToLocal(pivotDesiredCamera);
    pivotActualCamera.copy(pivotActualWorld); this.camera.worldToLocal(pivotActualCamera);
    this.root.position.add(pivotDesiredCamera.sub(pivotActualCamera));
    this.debug.handPivot = { x: pivotDesiredWorld.x, y: pivotDesiredWorld.y, z: pivotDesiredWorld.z, cameraLocal: { x: this.root.position.x, y: this.root.position.y, z: this.root.position.z } };
    this.rod.rotation.z = Math.PI / 2 - this.pose.bend * 0.2 + snapForward * 0.24;
    this.rod.rotation.x = this.pose.yaw * 0.09;
    this.applyCameraSpaceClamp();
    lastTipScratch.copy(this.getWorldTipPosition());
    if (this.hasLastTip) this.tipVelocity.copy(lastTipScratch).sub(this.lastTipPosition).divideScalar(dt);
    this.lastTipPosition.copy(lastTipScratch); this.hasLastTip = true;
  }
}
