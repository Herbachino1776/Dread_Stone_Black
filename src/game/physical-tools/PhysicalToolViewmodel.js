import * as THREE from 'three';
import { KEEPERS_LANTERN_VIEWMODEL_LAYER } from '../viewmodels/KeepersLanternViewmodel.js';
import { getPhysicalToolProfile } from './PhysicalToolProfiles.js';

const readyPosition = new THREE.Vector3();
const projectedBox = new THREE.Box3();
const projectedCorner = new THREE.Vector3();
const projectedToolPoint = new THREE.Vector3();
const motionTranslation = new THREE.Vector3();
const rootEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const motionEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function makeMaterial(color, roughness = 0.82, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function cylinderBetween(parent, radius, length, material, name) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function markViewmodel(root) {
  root.traverse((object) => {
    object.layers?.set?.(KEEPERS_LANTERN_VIEWMODEL_LAYER);
    if (!object.isMesh) return;
    object.renderOrder = 10020;
    object.castShadow = false;
    object.receiveShadow = false;
    object.userData.physicalToolViewmodel = true;
  });
}

export class PhysicalToolViewmodel {
  constructor({ camera = null, equipmentRuntime = null } = {}) {
    this.camera = camera;
    this.equipmentRuntime = equipmentRuntime;
    this.elapsed = 0;
    this.recoilRemaining = 0;
    this.recoilStrength = 0;
    this.gesture = null;
    this.motionPhase = 'ready';
    this.smoothedMotion = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
    this.toolGroups = new Map();
    this.root = new THREE.Group();
    this.root.name = 'physical-held-tool-viewmodel';
    this.root.visible = false;
    this.motionPivot = new THREE.Group();
    this.motionPivot.name = 'physical-held-tool-motion-pivot';
    this.root.add(this.motionPivot);
    this.buildTools();
    markViewmodel(this.root);
    this.camera?.add?.(this.root);
  }

  buildTools() {
    const rust = makeMaterial(0x655348, 0.68, 0.62);
    const darkRust = makeMaterial(0x392f2a, 0.78, 0.56);
    const wood = makeMaterial(0x62452d, 0.96, 0.02);

    const knife = new THREE.Group();
    knife.name = 'old-work-knife-held';
    const knifeHandle = cylinderBetween(knife, 0.055, 0.38, wood, 'old-work-knife-worn-wood-handle');
    knifeHandle.position.y = -0.18;
    const knifeBlade = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.055, 0, 0), new THREE.Vector3(0.055, 0, 0), new THREE.Vector3(0.042, 0.42, 0),
      new THREE.Vector3(0, 0.52, 0), new THREE.Vector3(-0.045, 0.42, 0),
    ]), rust);
    knifeBlade.geometry.setIndex([0, 1, 2, 0, 2, 4, 4, 2, 3]);
    knifeBlade.geometry.computeVertexNormals();
    knifeBlade.name = 'old-work-knife-short-rusted-blade';
    knifeBlade.position.y = 0.02;
    knife.add(knifeBlade);
    this.addTool('old_work_knife', knife);

    const axe = new THREE.Group();
    axe.name = 'wood-axe-held';
    const axeHandle = cylinderBetween(axe, 0.047, 0.92, wood, 'wood-axe-worn-handle');
    axeHandle.position.y = 0.14;
    const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.11), darkRust);
    axeHead.name = 'wood-axe-heavy-rusted-head';
    axeHead.position.set(-0.09, 0.62, 0);
    axeHead.rotation.z = -0.12;
    axe.add(axeHead);
    const axeEdge = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.26, 4), rust);
    axeEdge.name = 'wood-axe-dull-cutting-edge';
    axeEdge.position.set(-0.31, 0.61, 0);
    axeEdge.rotation.z = Math.PI / 2;
    axe.add(axeEdge);
    this.addTool('wood_axe', axe);

    const bar = new THREE.Group();
    bar.name = 'iron-drain-bar-held';
    const shaft = cylinderBetween(bar, 0.045, 1.18, darkRust, 'iron-drain-bar-heavy-shaft');
    shaft.position.y = 0.18;
    shaft.rotation.z = -0.04;
    const hookedEnd = cylinderBetween(bar, 0.043, 0.34, rust, 'iron-drain-bar-pry-hook');
    hookedEnd.position.set(-0.11, 0.77, 0);
    hookedEnd.rotation.z = 0.72;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.075, 0.12), rust);
    foot.name = 'iron-drain-bar-flat-pry-foot';
    foot.position.set(-0.23, 0.88, 0);
    foot.rotation.z = 0.18;
    bar.add(foot);
    this.addTool('iron_drain_bar', bar);
  }

  addTool(id, group) {
    group.visible = false;
    this.motionPivot.add(group);
    this.toolGroups.set(id, group);
  }

  getActiveToolId() {
    if (this.combatKnifeActive && this.equipmentRuntime?.getEquippedToolId?.() === 'old_work_knife') return null;
    const weaponId = this.equipmentRuntime?.getEquippedWeaponProfile?.()?.id;
    if (weaponId === 'fishing_rod') return null;
    if (weaponId === 'wood_axe') return 'wood_axe';
    const toolId = this.equipmentRuntime?.getEquippedToolId?.();
    return ['old_work_knife', 'iron_drain_bar'].includes(toolId) ? toolId : null;
  }

  setCombatKnifeActive(active) {
    this.combatKnifeActive = active === true;
  }

  setGestureState(gesture) {
    this.gesture = gesture;
  }

  impact({ strength = 1 } = {}) {
    this.recoilRemaining = 1;
    this.recoilStrength = THREE.MathUtils.clamp(strength, 0.35, 1.6);
  }

  getReadyPosition(pose, target = readyPosition) {
    const depth = pose.depth;
    const verticalHalfExtent = Math.tan(THREE.MathUtils.degToRad((this.camera?.fov ?? 68) * 0.5)) * depth;
    const horizontalHalfExtent = verticalHalfExtent * (this.camera?.aspect ?? 1);
    return target.set(
      pose.screen[0] * horizontalHalfExtent,
      pose.screen[1] * verticalHalfExtent,
      -depth,
    );
  }

  getDesiredMotion(toolId, gesture = null) {
    const config = getPhysicalToolProfile(toolId)?.viewmodel;
    const pose = config?.ready;
    if (!pose) return { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
    const socketed = toolId === 'iron_drain_bar' && gesture?.planted;
    const inputX = socketed ? (gesture?.constrainedDeltaX ?? 0) : (gesture?.deltaX ?? 0);
    const inputY = socketed ? (gesture?.constrainedDeltaY ?? 0) : (gesture?.deltaY ?? 0);
    const nx = THREE.MathUtils.clamp(inputX / 170, -1, 1);
    const ny = THREE.MathUtils.clamp(inputY / 170, -1, 1);
    const verticalHalfExtent = Math.tan(THREE.MathUtils.degToRad((this.camera?.fov ?? 68) * 0.5)) * pose.depth;
    const horizontalHalfExtent = verticalHalfExtent * (this.camera?.aspect ?? 1);
    const motion = {
      x: nx * horizontalHalfExtent * pose.motion[0],
      y: -ny * verticalHalfExtent * pose.motion[1],
      z: gesture ? (socketed ? -0.12 - 0.22 * (gesture.settle ?? 0) : -0.08 * Math.min(1, (gesture.travelPx ?? 0) / 90)) : 0,
      pitch: ny * (socketed ? 0.78 : 0.34),
      yaw: -nx * (socketed ? 0.38 : 0.24),
      roll: -nx * (socketed ? 0.72 : toolId === 'wood_axe' ? 0.92 : 0.66),
    };
    if (socketed && gesture.socketScreen && gesture.activePartPoint && gesture.viewportSize) {
      const settle = THREE.MathUtils.clamp(gesture.settle ?? 0, 0, 1);
      const correctionX = gesture.socketScreen.x - gesture.activePartPoint.x;
      const correctionY = gesture.socketScreen.y - gesture.activePartPoint.y;
      motion.x += (correctionX / Math.max(1, gesture.viewportSize.width)) * horizontalHalfExtent * 2 * settle;
      motion.y -= (correctionY / Math.max(1, gesture.viewportSize.height)) * verticalHalfExtent * 2 * settle;
    }
    return motion;
  }

  update(deltaSeconds) {
    const toolId = this.getActiveToolId();
    this.root.visible = Boolean(toolId);
    this.toolGroups.forEach((group, id) => { group.visible = id === toolId; });
    if (!toolId) {
      this.lastToolId = null;
      return;
    }
    if (toolId !== this.lastToolId) {
      Object.keys(this.smoothedMotion).forEach((key) => { this.smoothedMotion[key] = 0; });
      this.gesture = null;
      this.lastToolId = toolId;
    }
    const profile = getPhysicalToolProfile(toolId);
    const pose = profile?.viewmodel?.ready;
    if (!pose) return;
    const dt = THREE.MathUtils.clamp(deltaSeconds, 0.001, 0.05);
    this.elapsed += dt;
    const gesture = this.gesture?.active ? this.gesture : null;
    const follow = profile.viewmodel.follow;
    const alpha = 1 - Math.exp(-follow * dt);
    const readyPosition = this.getReadyPosition(pose);
    const desired = this.getDesiredMotion(toolId, gesture);
    Object.keys(this.smoothedMotion).forEach((key) => {
      this.smoothedMotion[key] = THREE.MathUtils.lerp(this.smoothedMotion[key], desired[key], alpha);
    });
    this.root.position.set(
      readyPosition.x + this.smoothedMotion.x,
      readyPosition.y + this.smoothedMotion.y,
      readyPosition.z,
    );
    this.root.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'YXZ');
    this.motionPivot.rotation.set(
      this.smoothedMotion.pitch,
      this.smoothedMotion.yaw,
      this.smoothedMotion.roll,
      'YXZ',
    );
    this.motionPivot.position.z = this.smoothedMotion.z;

    if (this.recoilRemaining > 0) {
      this.recoilRemaining = Math.max(0, this.recoilRemaining - dt * 5.2);
      const kick = Math.sin(this.recoilRemaining * Math.PI) * this.recoilStrength;
      this.root.position.z += kick * profile.viewmodel.recoil.depth;
      this.motionPivot.rotation.x -= kick * profile.viewmodel.recoil.pitch;
    }
    const motionMagnitude = Object.values(this.smoothedMotion).reduce((sum, value) => sum + Math.abs(value), 0);
    this.motionPhase = gesture
      ? (gesture.socketState ?? ((gesture.travelPx ?? 0) < profile.minTravelPx * 0.3 ? 'windup' : (gesture.planted ? 'plant-and-pry' : 'action')))
      : (this.recoilRemaining > 0 ? 'recoil' : (motionMagnitude > 0.025 ? 'return' : 'ready'));
  }

  projectGrabHit(clientX, clientY, viewport) {
    const point = this.getProjectedGripZone(viewport);
    if (!point) return false;
    return Math.hypot(clientX - point.x, clientY - point.y) <= point.radius;
  }

  getProjectedGrabPoint(viewport) {
    return this.getProjectedGripZone(viewport);
  }

  getProjectedGripZone(viewport) {
    const toolId = this.getActiveToolId();
    const group = this.toolGroups.get(toolId);
    if (!toolId || !group?.visible || !viewport || !this.camera) return null;
    const profile = getPhysicalToolProfile(toolId);
    const grip = profile?.viewmodel?.grip;
    if (!grip) return null;
    this.camera.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);
    // The grip zone only captures input. It never counts as physical tool contact.
    const point = new THREE.Vector3(...grip.local);
    group.localToWorld(point);
    point.project(this.camera);
    const rect = viewport.getBoundingClientRect();
    const x = rect.left + (point.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-point.y * 0.5 + 0.5) * rect.height;
    const radius = Math.max(grip.minRadiusPx, Math.min(grip.maxRadiusPx, Math.min(rect.width, rect.height) * grip.viewportRatio));
    return point.z >= -1 && point.z <= 1 ? { x, y, depth: point.z, radius, toolId, kind: 'grip-input-capture' } : null;
  }

  getProjectedActivePoint(viewport, gesture = null) {
    const toolId = gesture?.toolId ?? this.getActiveToolId();
    const profile = getPhysicalToolProfile(toolId);
    const pose = profile?.viewmodel?.ready;
    const active = profile?.viewmodel?.active;
    if (!toolId || !pose || !active || !viewport || !this.camera) return null;
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    // The blade/head/pry tip is the physical contact surface. Predict its camera-local
    // transform from the captured grip gesture so contact never follows the finger itself.
    const motion = this.getDesiredMotion(toolId, gesture?.active ? gesture : null);
    projectedToolPoint.set(...active.local);
    motionEuler.set(motion.pitch, motion.yaw, motion.roll, 'YXZ');
    projectedToolPoint.applyEuler(motionEuler);
    projectedToolPoint.add(motionTranslation.set(motion.x, motion.y, motion.z));
    rootEuler.set(...pose.rotation, 'YXZ');
    projectedToolPoint.applyEuler(rootEuler).add(this.getReadyPosition(pose));
    this.camera.localToWorld(projectedToolPoint);
    projectedToolPoint.project(this.camera);
    if (projectedToolPoint.z < -1 || projectedToolPoint.z > 1) return null;
    return {
      x: rect.left + (projectedToolPoint.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-projectedToolPoint.y * 0.5 + 0.5) * rect.height,
      depth: projectedToolPoint.z,
      toolId,
      kind: profile.actionType === 'pry' ? 'pry-tip' : profile.actionType === 'chop' ? 'axe-head' : 'knife-blade',
    };
  }

  getProjectedBounds(toolId = this.getActiveToolId()) {
    const group = this.toolGroups.get(toolId);
    if (!group || !this.camera) return null;
    this.camera.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);
    projectedBox.setFromObject(group);
    if (projectedBox.isEmpty()) return null;
    const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minDepth: Infinity, maxDepth: -Infinity };
    for (const x of [projectedBox.min.x, projectedBox.max.x]) {
      for (const y of [projectedBox.min.y, projectedBox.max.y]) {
        for (const z of [projectedBox.min.z, projectedBox.max.z]) {
          projectedCorner.set(x, y, z).project(this.camera);
          bounds.minX = Math.min(bounds.minX, projectedCorner.x);
          bounds.maxX = Math.max(bounds.maxX, projectedCorner.x);
          bounds.minY = Math.min(bounds.minY, projectedCorner.y);
          bounds.maxY = Math.max(bounds.maxY, projectedCorner.y);
          bounds.minDepth = Math.min(bounds.minDepth, projectedCorner.z);
          bounds.maxDepth = Math.max(bounds.maxDepth, projectedCorner.z);
        }
      }
    }
    return bounds;
  }

  rebind({ camera = this.camera } = {}) {
    if (camera === this.camera) return;
    this.camera?.remove?.(this.root);
    this.camera = camera;
    this.camera?.add?.(this.root);
  }

  dispose() {
    this.camera?.remove?.(this.root);
    this.root.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material?.dispose?.());
      else object.material?.dispose?.();
    });
    this.root.clear();
  }
}
