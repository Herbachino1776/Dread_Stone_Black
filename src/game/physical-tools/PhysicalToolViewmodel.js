import * as THREE from 'three';
import { KEEPERS_LANTERN_VIEWMODEL_LAYER } from '../viewmodels/KeepersLanternViewmodel.js';

const READY_POSES = Object.freeze({
  old_work_knife: Object.freeze({ screen: [0.25, -0.5], depth: 1.18, rotation: [-0.18, -0.18, -0.56], motion: [0.38, 0.3] }),
  wood_axe: Object.freeze({ screen: [0.05, -0.56], depth: 1.58, rotation: [-0.1, -0.2, -0.5], motion: [0.34, 0.26] }),
  iron_drain_bar: Object.freeze({ screen: [0.02, -0.54], depth: 1.48, rotation: [-0.18, -0.12, -0.62], motion: [0.34, 0.27] }),
});

const screenPoint = new THREE.Vector3();
const readyPosition = new THREE.Vector3();
const projectedBox = new THREE.Box3();
const projectedCorner = new THREE.Vector3();

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
    this.addTool('old_work_knife', knife, new THREE.Vector3(0, 0.5, 0));

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
    this.addTool('wood_axe', axe, new THREE.Vector3(-0.4, 0.62, 0));

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
    this.addTool('iron_drain_bar', bar, new THREE.Vector3(-0.31, 0.9, 0));
  }

  addTool(id, group, contactPoint) {
    group.visible = false;
    group.userData.contactPoint = contactPoint;
    this.motionPivot.add(group);
    this.toolGroups.set(id, group);
  }

  getActiveToolId() {
    const weaponId = this.equipmentRuntime?.getEquippedWeaponProfile?.()?.id;
    if (weaponId === 'fishing_rod') return null;
    if (weaponId === 'wood_axe') return 'wood_axe';
    const toolId = this.equipmentRuntime?.getEquippedToolId?.();
    return ['old_work_knife', 'iron_drain_bar'].includes(toolId) ? toolId : null;
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
    const pose = READY_POSES[toolId];
    const dt = THREE.MathUtils.clamp(deltaSeconds, 0.001, 0.05);
    this.elapsed += dt;
    const gesture = this.gesture?.active ? this.gesture : null;
    const nx = THREE.MathUtils.clamp((gesture?.deltaX ?? 0) / 170, -1, 1);
    const ny = THREE.MathUtils.clamp((gesture?.deltaY ?? 0) / 170, -1, 1);
    const pry = toolId === 'iron_drain_bar' && gesture?.planted;
    const follow = toolId === 'old_work_knife' ? 22 : toolId === 'wood_axe' ? 10.5 : 8.5;
    const alpha = 1 - Math.exp(-follow * dt);
    const readyPosition = this.getReadyPosition(pose);
    const verticalHalfExtent = Math.tan(THREE.MathUtils.degToRad((this.camera?.fov ?? 68) * 0.5)) * pose.depth;
    const horizontalHalfExtent = verticalHalfExtent * (this.camera?.aspect ?? 1);
    const desired = {
      x: nx * horizontalHalfExtent * pose.motion[0],
      y: -ny * verticalHalfExtent * pose.motion[1],
      z: gesture ? (pry ? -0.34 : -0.08 * Math.min(1, (gesture.travelPx ?? 0) / 90)) : 0,
      pitch: ny * (pry ? 0.78 : 0.34),
      yaw: -nx * (pry ? 0.38 : 0.24),
      roll: -nx * (pry ? 0.72 : toolId === 'wood_axe' ? 0.92 : 0.66),
    };
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
      this.root.position.z += kick * 0.18;
      this.motionPivot.rotation.x -= kick * 0.2;
    }
  }

  projectGrabHit(clientX, clientY, viewport) {
    const toolId = this.getActiveToolId();
    const group = this.toolGroups.get(toolId);
    if (!toolId || !group?.visible || !viewport || !this.camera) return false;
    this.camera.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);
    const point = group.userData.contactPoint.clone();
    group.localToWorld(point);
    point.project(this.camera);
    const rect = viewport.getBoundingClientRect();
    const x = rect.left + (point.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-point.y * 0.5 + 0.5) * rect.height;
    const radius = Math.max(76, Math.min(125, Math.min(rect.width, rect.height) * 0.2));
    screenPoint.set(x, y, point.z);
    return point.z >= -1 && point.z <= 1 && Math.hypot(clientX - x, clientY - y) <= radius;
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
