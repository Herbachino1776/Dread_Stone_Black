import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const HUMANOID_GLB_PATH = './assets/models/npc/human/human_retro_256.glb';
export const HUMANOID_GLB_AUTHORED_HEIGHT = 84.771304;
export const HUMANOID_GLB_TARGET_HEIGHT = 2.06;
export const HUMANOID_GLB_SCALE = HUMANOID_GLB_TARGET_HEIGHT / HUMANOID_GLB_AUTHORED_HEIGHT;

export const HUMANOID_GLB_BONE_MAP = Object.freeze({
  pelvis: 'body', abdomen: 'body_top0', lower_chest: 'body_top1', upper_chest: 'body_top2', neck: 'neck', head: 'head',
  left_upper_arm: 'arm_left_top', left_forearm: 'arm_left_bot', left_hand: 'arm_left_hand',
  right_upper_arm: 'arm_right_top', right_forearm: 'arm_right_bot', right_hand: 'arm_right_hand',
  left_thigh: 'leg_left_top', left_lower_leg: 'leg_left_bot', left_foot: 'leg_left_foot',
  right_thigh: 'leg_right_top', right_lower_leg: 'leg_right_bot', right_foot: 'leg_right_foot',
});

let cachedAssetPromise = null;
let assetLoadCount = 0;
const unitScale = new THREE.Vector3(1, 1, 1);
const decomposedBoneScale = new THREE.Vector3();

function hierarchyDepth(object) {
  let depth = 0;
  for (let parent = object.parent; parent; parent = parent.parent) depth += 1;
  return depth;
}

export function captureModelSpaceBoneBinding({ modelRootWorld, bodyBindWorld, boneBindWorld }) {
  const worldToModel = modelRootWorld.clone().invert();
  const bodyBindModel = worldToModel.clone().multiply(bodyBindWorld);
  const boneBindModel = worldToModel.clone().multiply(boneBindWorld);
  return bodyBindModel.invert().multiply(boneBindModel);
}

export function solveModelSpaceBoneLocal({ modelRootWorld, parentWorld, bodyWorld, bindOffset }) {
  const worldToModel = modelRootWorld.clone().invert();
  const bodyModel = worldToModel.clone().multiply(bodyWorld);
  const desiredBoneModel = bodyModel.multiply(bindOffset);
  const parentModel = worldToModel.multiply(parentWorld);
  return parentModel.invert().multiply(desiredBoneModel);
}

export function applySolvedBoneLocalTransform(bone, localMatrix, bindLocalScale) {
  localMatrix.decompose(bone.position, bone.quaternion, decomposedBoneScale);
  bone.scale.copy(bindLocalScale);
}

function loadCachedAsset() {
  if (!cachedAssetPromise) {
    assetLoadCount += 1;
    cachedAssetPromise = new GLTFLoader().loadAsync(HUMANOID_GLB_PATH).catch((error) => {
      cachedAssetPromise = null;
      throw error;
    });
  }
  return cachedAssetPromise;
}

export class HumanoidGlbVisualAdapter {
  constructor({ actor, parent }) {
    this.actor = actor;
    this.parent = parent;
    this.scene = null;
    this.skinnedMeshes = [];
    this.skeletons = [];
    this.bindings = [];
    this.disposed = false;
    this.ready = this.load();
  }

  async load() {
    const asset = await loadCachedAsset();
    if (this.disposed) return;
    this.scene = clone(asset.scene);
    this.scene.name = 'humanoid-combat-glb-visual';
    this.scene.scale.setScalar(HUMANOID_GLB_SCALE);
    this.scene.updateMatrixWorld(true);
    this.scene.traverse((object) => {
      if (!object.isSkinnedMesh) return;
      this.skinnedMeshes.push(object);
      if (object.skeleton && !this.skeletons.includes(object.skeleton)) this.skeletons.push(object.skeleton);
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.magFilter = THREE.NearestFilter;
          material.map.minFilter = THREE.LinearMipmapLinearFilter;
          material.map.generateMipmaps = true;
        }
        if (material.normalMap) {
          material.normalMap.colorSpace = THREE.NoColorSpace;
          material.normalMap.magFilter = THREE.NearestFilter;
          material.normalMap.minFilter = THREE.LinearMipmapLinearFilter;
          material.normalMap.generateMipmaps = true;
        }
        material.needsUpdate = true;
      });
    });
    if (!this.skinnedMeshes.length || !this.skeletons.length) throw new Error(`Humanoid GLB has no SkinnedMesh/skeleton: ${HUMANOID_GLB_PATH}`);
    this.parent.add(this.scene);
    this.captureBindings();
    this.update(1);
  }

  captureBindings() {
    this.scene.updateMatrixWorld(true);
    const modelRootWorld = this.scene.matrixWorld.clone();
    const bones = new Map();
    this.scene.traverse((object) => { if (object.isBone) bones.set(object.name, object); });
    this.bindings = Object.entries(HUMANOID_GLB_BONE_MAP).map(([bodyId, boneName]) => {
      const bone = bones.get(boneName);
      const bodyEntry = this.actor.bodies.get(bodyId);
      if (!bone || !bodyEntry) throw new Error(`Humanoid GLB required mapping missing: ${bodyId} -> ${boneName}`);
      const bodyBindWorld = new THREE.Matrix4().compose(bodyEntry.restPosition, bodyEntry.restQuaternion, unitScale);
      const offset = captureModelSpaceBoneBinding({ modelRootWorld, bodyBindWorld, boneBindWorld: bone.matrixWorld });
      return { bodyId, boneName, bone, offset, bindLocalScale: bone.scale.clone() };
    });
    this.bindings.sort((a, b) => hierarchyDepth(a.bone) - hierarchyDepth(b.bone));
  }

  update() {
    if (!this.scene || !this.bindings.length) return;
    this.parent.updateMatrixWorld(true);
    const modelRootWorld = this.scene.matrixWorld.clone();
    for (const binding of this.bindings) {
      const entry = this.actor.bodies.get(binding.bodyId);
      if (!entry) continue;
      const bodyWorld = new THREE.Matrix4().compose(entry.visual.position, entry.visual.quaternion, unitScale);
      binding.bone.parent?.updateMatrixWorld(true);
      const local = solveModelSpaceBoneLocal({ modelRootWorld, parentWorld: binding.bone.parent?.matrixWorld ?? modelRootWorld, bodyWorld, bindOffset: binding.offset });
      applySolvedBoneLocalTransform(binding.bone, local, binding.bindLocalScale);
      binding.bone.updateMatrixWorld(true);
    }
    this.skeletons.forEach((skeleton) => skeleton.update());
  }

  reset() {
    this.update();
  }

  getDiagnostics() {
    return { path: HUMANOID_GLB_PATH, loadCount: assetLoadCount, skinnedMeshCount: this.skinnedMeshes.length, skeletonCount: this.skeletons.length, mappedBoneCount: this.bindings.length, height: HUMANOID_GLB_TARGET_HEIGHT, scale: HUMANOID_GLB_SCALE };
  }

  dispose() {
    this.disposed = true;
    this.scene?.removeFromParent();
    this.scene = null;
    this.bindings = [];
    this.skinnedMeshes = [];
    this.skeletons = [];
  }
}
