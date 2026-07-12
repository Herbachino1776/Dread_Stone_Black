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
    const bones = new Map();
    this.scene.traverse((object) => { if (object.isBone) bones.set(object.name, object); });
    this.bindings = Object.entries(HUMANOID_GLB_BONE_MAP).map(([bodyId, boneName]) => {
      const bone = bones.get(boneName);
      const bodyEntry = this.actor.bodies.get(bodyId);
      if (!bone || !bodyEntry) throw new Error(`Humanoid GLB required mapping missing: ${bodyId} -> ${boneName}`);
      const bodyBind = new THREE.Matrix4().compose(bodyEntry.restPosition, bodyEntry.restQuaternion, new THREE.Vector3(1, 1, 1));
      const offset = bodyBind.clone().invert().multiply(bone.matrixWorld);
      return { bodyId, boneName, bone, offset };
    });
  }

  update() {
    if (!this.scene || !this.bindings.length) return;
    this.parent.updateMatrixWorld(true);
    for (const binding of this.bindings) {
      const entry = this.actor.bodies.get(binding.bodyId);
      if (!entry) continue;
      const bodyWorld = new THREE.Matrix4().compose(entry.visual.position, entry.visual.quaternion, new THREE.Vector3(1, 1, 1));
      const desiredWorld = bodyWorld.multiply(binding.offset);
      binding.bone.parent?.updateMatrixWorld(true);
      const local = (binding.bone.parent?.matrixWorld.clone().invert() ?? new THREE.Matrix4()).multiply(desiredWorld);
      local.decompose(binding.bone.position, binding.bone.quaternion, binding.bone.scale);
      binding.bone.updateMatrixWorld(true);
    }
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
