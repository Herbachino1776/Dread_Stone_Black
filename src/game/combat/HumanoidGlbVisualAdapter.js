import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CURRENT_HUMANOID_BONE_MAP, CURRENT_HUMANOID_PROFILE, getHumanoidProfileScale } from './HumanoidModelProfiles.js';

export const HUMANOID_GLB_PATH = CURRENT_HUMANOID_PROFILE.assetPath;
export const HUMANOID_GLB_AUTHORED_HEIGHT = CURRENT_HUMANOID_PROFILE.rawHeight;
export const HUMANOID_GLB_TARGET_HEIGHT = CURRENT_HUMANOID_PROFILE.targetHeight;
export const HUMANOID_GLB_SCALE = getHumanoidProfileScale(CURRENT_HUMANOID_PROFILE);
export const HUMANOID_GLB_BONE_MAP = CURRENT_HUMANOID_BONE_MAP;

const cachedAssetPromises = new Map();
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

export function resolveRequiredBoneMappings({ bones, bodies, boneMap, profileName }) {
  const missing = [];
  const resolved = Object.entries(boneMap).map(([bodyId, boneName]) => {
    const bone = bones.get(boneName);
    const bodyEntry = bodies.get(bodyId);
    if (!bone || !bodyEntry) {
      missing.push(`${bodyId} -> ${boneName}`);
      return null;
    }
    return { bodyId, boneName, bone, bodyEntry };
  }).filter(Boolean);
  if (missing.length) throw new Error(`Humanoid GLB profile ${profileName} is missing required mappings: ${missing.join(', ')}`);
  return resolved;
}

function loadCachedAsset(assetPath) {
  if (!cachedAssetPromises.has(assetPath)) {
    assetLoadCount += 1;
    const promise = new GLTFLoader().loadAsync(assetPath).catch((error) => {
      cachedAssetPromises.delete(assetPath);
      throw error;
    });
    cachedAssetPromises.set(assetPath, promise);
  }
  return cachedAssetPromises.get(assetPath);
}

export class HumanoidGlbVisualAdapter {
  constructor({ actor, parent, profile = CURRENT_HUMANOID_PROFILE }) {
    this.actor = actor;
    this.parent = parent;
    this.profile = profile;
    this.scene = null;
    this.skinnedMeshes = [];
    this.skeletons = [];
    this.bindings = [];
    this.disposed = false;
    this.ready = this.load();
  }

  async load() {
    const asset = await loadCachedAsset(this.profile.assetPath);
    if (this.disposed) return;
    this.scene = clone(asset.scene);
    this.scene.name = 'humanoid-combat-glb-visual';
    this.scene.position.fromArray(this.profile.rootOffset);
    this.scene.rotation.y = this.profile.rootYaw;
    this.scene.scale.setScalar(getHumanoidProfileScale(this.profile));
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
    if (!this.skinnedMeshes.length || !this.skeletons.length) throw new Error(`Humanoid GLB has no SkinnedMesh/skeleton: ${this.profile.assetPath}`);
    this.parent.add(this.scene);
    this.captureBindings();
    this.update(1);
  }

  captureBindings() {
    this.scene.updateMatrixWorld(true);
    const modelRootWorld = this.scene.matrixWorld.clone();
    const bones = new Map();
    this.scene.traverse((object) => { if (object.isBone) bones.set(object.name, object); });
    this.bindings = resolveRequiredBoneMappings({ bones, bodies: this.actor.bodies, boneMap: this.profile.boneMap, profileName: this.profile.name }).map(({ bodyId, boneName, bone, bodyEntry }) => {
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
    return { path: this.profile.assetPath, profileName: this.profile.name, loadCount: assetLoadCount, cacheKeys: [...cachedAssetPromises.keys()], skinnedMeshCount: this.skinnedMeshes.length, skeletonCount: this.skeletons.length, mappedBoneCount: this.bindings.length, missingMappedBones: [], bindOffsetCount: this.bindings.length, height: this.profile.targetHeight, scale: getHumanoidProfileScale(this.profile) };
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
