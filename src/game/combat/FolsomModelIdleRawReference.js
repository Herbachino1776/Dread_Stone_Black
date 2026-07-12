import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const MODEL_IDLE_RAW_ASSET_PATH = './assets/models/npc/human/model_idle.glb';
export const MODEL_IDLE_RAW_TARGET_HEIGHT = 1.82;
export const FOLSOM_AUTHORED_PLAYER_SPAWN = Object.freeze([-2, 1.71, -4]);
export const FOLSOM_MODEL_IDLE_DIAGNOSTIC_XZ = Object.freeze([8, -4]);

const cachedRawAssets = new Map();
let rawAssetLoadCount = 0;

function loadRawAsset(path) {
  if (!cachedRawAssets.has(path)) {
    rawAssetLoadCount += 1;
    const promise = new GLTFLoader().loadAsync(path).catch((error) => {
      cachedRawAssets.delete(path);
      throw error;
    });
    cachedRawAssets.set(path, promise);
  }
  return cachedRawAssets.get(path);
}

function vectorBounds(box) {
  return { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray() };
}

function configureMaterial(material, materials, textures) {
  if (!material) return;
  materials.add(material);
  if (material.map) {
    material.map.colorSpace = THREE.SRGBColorSpace;
    textures.add(material.map);
  }
  if (material.normalMap) {
    material.normalMap.colorSpace = THREE.NoColorSpace;
    textures.add(material.normalMap);
  }
  material.needsUpdate = true;
}

export class FolsomModelIdleRawReference {
  static async create(options = {}) {
    const reference = new FolsomModelIdleRawReference(options);
    await reference.load();
    return reference;
  }

  constructor({ scene, groundY = 0.16, spawnXZ = FOLSOM_MODEL_IDLE_DIAGNOSTIC_XZ, assetLoader = loadRawAsset } = {}) {
    this.scene = scene;
    this.groundY = groundY;
    this.spawnXZ = [...spawnXZ];
    this.assetLoader = assetLoader;
    this.root = new THREE.Group();
    this.root.name = 'folsom-model-idle-raw-reference';
    this.model = null;
    this.mixer = null;
    this.selectedAction = null;
    this.marker = null;
    this.loaded = false;
    this.disposed = false;
    this.diagnostics = { assetPath: MODEL_IDLE_RAW_ASSET_PATH, loadSuccess: false, loadFailure: null };
  }

  async load() {
    try {
      const asset = await this.assetLoader(MODEL_IDLE_RAW_ASSET_PATH);
      if (this.disposed) return this;
      this.model = clone(asset.scene);
      const rawBounds = new THREE.Box3().setFromObject(this.model);
      const rawHeight = rawBounds.getSize(new THREE.Vector3()).y;
      if (!(rawHeight > 0)) throw new Error('model_idle.glb has empty visual bounds');
      const uniformScale = MODEL_IDLE_RAW_TARGET_HEIGHT / rawHeight;
      const player = new THREE.Vector3(...FOLSOM_AUTHORED_PLAYER_SPAWN);
      const position = new THREE.Vector3(this.spawnXZ[0], 0, this.spawnXZ[1]);
      const yaw = Math.atan2(player.x - position.x, player.z - position.z);
      this.root.scale.setScalar(uniformScale);
      this.root.rotation.y = yaw;
      this.root.position.set(position.x, this.groundY - rawBounds.min.y * uniformScale, position.z);
      this.root.add(this.model);

      const bones = [];
      const skinnedMeshes = [];
      const skins = new Set();
      const materials = new Set();
      const textures = new Set();
      this.model.traverse((object) => {
        if (object.isBone) bones.push(object.name);
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.isSkinnedMesh) {
          skinnedMeshes.push(object);
          if (object.skeleton) skins.add(object.skeleton);
        }
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => configureMaterial(material, materials, textures));
      });

      const clips = asset.animations ?? [];
      const idleClip = clips.find((clip) => /idle/i.test(clip.name) && clip.tracks.length > 0) ?? clips.find((clip) => clip.tracks.length > 0) ?? null;
      if (idleClip) {
        this.mixer = new THREE.AnimationMixer(this.model);
        this.selectedAction = this.mixer.clipAction(idleClip);
        this.selectedAction.setLoop(THREE.LoopRepeat, Infinity).play();
      }
      this.scene.add(this.root);
      this.root.updateMatrixWorld(true);
      const normalizedBounds = new THREE.Box3().setFromObject(this.model);
      if (import.meta.env?.DEV && typeof document !== 'undefined') this.createMarker(normalizedBounds.max.y + 0.18);
      this.loaded = true;
      this.diagnostics = {
        assetPath: MODEL_IDLE_RAW_ASSET_PATH,
        loadSuccess: true,
        loadFailure: null,
        rawBounds: vectorBounds(rawBounds),
        normalizedBounds: vectorBounds(normalizedBounds),
        uniformScale,
        rootPosition: this.root.position.toArray(),
        rootYaw: yaw,
        horizontalDistanceFromPlayerSpawn: Math.hypot(position.x - player.x, position.z - player.z),
        skinnedMeshCount: skinnedMeshes.length,
        skinCount: skins.size,
        boneCount: bones.length,
        boneNames: bones,
        animationClipNames: clips.map((clip) => clip.name),
        selectedIdleClip: idleClip?.name ?? null,
        selectedClipDuration: idleClip?.duration ?? null,
        selectedClipTrackCount: idleClip?.tracks.length ?? 0,
        textureCount: textures.size,
        materialCount: materials.size,
        assetLoadCount: rawAssetLoadCount,
        physicsDriven: false,
      };
      console.info('[Dread Stone Black] RAW model_idle.glb diagnostic', this.diagnostics);
    } catch (error) {
      this.diagnostics.loadFailure = error instanceof Error ? error.message : String(error);
      console.error('[Dread Stone Black] RAW model_idle.glb failed to load.', error);
      throw error;
    }
    return this;
  }

  createMarker(worldY) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 48;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(8, 8, 8, 0.72)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f2dfb7';
    context.font = '20px monospace';
    context.textAlign = 'center';
    context.fillText('RAW model_idle.glb', 128, 31);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false });
    this.marker = new THREE.Sprite(material);
    this.marker.name = 'folsom-model-idle-raw-reference-label';
    this.marker.position.set(this.spawnXZ[0], worldY, this.spawnXZ[1]);
    this.marker.scale.set(2.8, 0.52, 1);
    this.scene.add(this.marker);
  }

  update(deltaSeconds) {
    this.mixer?.update(Math.max(0, deltaSeconds));
  }

  getDiagnostics() {
    return { ...this.diagnostics };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.selectedAction?.stop();
    this.mixer?.stopAllAction();
    if (this.model && this.mixer) this.mixer.uncacheRoot(this.model);
    this.root.removeFromParent();
    if (this.marker) {
      this.marker.material?.map?.dispose?.();
      this.marker.material?.dispose?.();
      this.marker.removeFromParent();
    }
    this.model = null;
    this.mixer = null;
    this.selectedAction = null;
    this.marker = null;
  }
}
