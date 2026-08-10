import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneObject3D } from 'three/examples/jsm/utils/SkeletonUtils.js';

function resolveDocumentBaseUrl() {
  return globalThis.document?.baseURI
    ?? globalThis.location?.href
    ?? 'http://localhost/';
}

export function resolveWorldWeaponPublicBaseUrl(explicitBaseUrl = null) {
  if (explicitBaseUrl) return new URL(explicitBaseUrl, resolveDocumentBaseUrl());
  const viteBase = import.meta.env?.BASE_URL ?? './';
  return new URL(viteBase, resolveDocumentBaseUrl());
}

const TEXTURE_FIELDS = Object.freeze([
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
]);

function materialsOf(material) {
  return (Array.isArray(material) ? material : [material]).filter(Boolean);
}

function disposeMaterial(material, { textures = false, disposedTextures = new Set() } = {}) {
  materialsOf(material).forEach((entry) => {
    if (textures) TEXTURE_FIELDS.forEach((field) => {
      const texture = entry[field];
      if (texture?.isTexture && !disposedTextures.has(texture)) {
        disposedTextures.add(texture);
        texture.dispose?.();
      }
    });
    entry.dispose?.();
  });
}

function disposeObjectResources(root, { textures = false } = {}) {
  const disposedGeometries = new Set();
  const disposedMaterials = new Set();
  const disposedTextures = new Set();
  root?.traverse?.((object) => {
    if (object.geometry && !disposedGeometries.has(object.geometry)) {
      disposedGeometries.add(object.geometry);
      object.geometry.dispose?.();
    }
    materialsOf(object.material).forEach((material) => {
      if (disposedMaterials.has(material)) return;
      disposedMaterials.add(material);
      disposeMaterial(material, { textures, disposedTextures });
    });
  });
}

function cloneInstanceResources(root) {
  const geometryClones = new Map();
  const materialClones = new Map();
  root.traverse((object) => {
    if (object.geometry) {
      if (!geometryClones.has(object.geometry)) geometryClones.set(object.geometry, object.geometry.clone());
      object.geometry = geometryClones.get(object.geometry);
    }
    if (object.material) {
      const cloneMaterial = (material) => {
        if (!materialClones.has(material)) materialClones.set(material, material.clone());
        return materialClones.get(material);
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material);
    }
  });
  return root;
}

export class WorldWeaponGlbLoadError extends Error {
  constructor(assetPath, cause) {
    super(`[World Weapon GLB:${assetPath}] ${cause?.message ?? String(cause)}`, { cause });
    this.name = 'WorldWeaponGlbLoadError';
    this.code = 'WORLD_WEAPON_GLB_LOAD_FAILED';
    this.assetPath = assetPath;
  }
}

/**
 * Caches parsed source GLBs and creates a separately disposable Object3D tree
 * for every equipped/world instance. This loader is deliberately view-neutral:
 * it has no player-viewmodel or NPC-host assumptions.
 */
export class WorldWeaponGlbLoader {
  constructor({ loader = new GLTFLoader(), cloneScene = cloneObject3D, baseUrl = null } = {}) {
    this.loader = loader;
    this.cloneScene = cloneScene;
    this.baseUrl = resolveWorldWeaponPublicBaseUrl(baseUrl);
    this.sourcePromises = new Map();
    this.sources = new Map();
    this.resolvedAssetUrls = new Map();
    this.instances = new Set();
    this.loadAttempts = new Map();
    this.disposed = false;
  }

  async loadSource(assetPath) {
    if (this.disposed) throw new Error('World weapon GLB loader is disposed');
    if (this.sourcePromises.has(assetPath)) return this.sourcePromises.get(assetPath);
    this.loadAttempts.set(assetPath, (this.loadAttempts.get(assetPath) ?? 0) + 1);
    const resolvedAssetUrl = new URL(assetPath.replace(/^\/+/, ''), this.baseUrl).href;
    this.resolvedAssetUrls.set(assetPath, resolvedAssetUrl);
    const promise = this.loader.loadAsync(resolvedAssetUrl)
      .then((gltf) => {
        if (!gltf?.scene?.isObject3D) throw new Error('GLTFLoader returned no scene Object3D');
        if (this.disposed) {
          disposeObjectResources(gltf.scene, { textures: true });
          throw new Error('World weapon GLB loader was disposed while the asset loaded');
        }
        this.sources.set(assetPath, gltf);
        return gltf;
      })
      .catch((error) => {
        this.sourcePromises.delete(assetPath);
        if (error instanceof WorldWeaponGlbLoadError) throw error;
        throw new WorldWeaponGlbLoadError(assetPath, error);
      });
    this.sourcePromises.set(assetPath, promise);
    return promise;
  }

  async preload(assetPath) {
    await this.loadSource(assetPath);
    return { accepted: true, assetPath, cached: true };
  }

  async instantiate(assetPath) {
    const gltf = await this.loadSource(assetPath);
    if (this.disposed) throw new Error('World weapon GLB loader is disposed');
    const instance = cloneInstanceResources(this.cloneScene(gltf.scene));
    instance.name = instance.name || `WorldWeapon:${assetPath.split('/').pop()}`;
    instance.userData.worldWeaponAssetPath = assetPath;
    instance.userData.worldWeaponGlbInstance = true;
    instance.traverse((object) => {
      if (object.isMesh) object.castShadow = true;
    });
    this.instances.add(instance);
    return instance;
  }

  release(instance) {
    if (!instance?.isObject3D || !this.instances.has(instance)) return false;
    instance.removeFromParent?.();
    disposeObjectResources(instance, { textures: false });
    this.instances.delete(instance);
    return true;
  }

  getDiagnostics() {
    return {
      cachedAssetPaths: [...this.sources.keys()],
      pendingAssetPaths: [...this.sourcePromises.keys()].filter((path) => !this.sources.has(path)),
      resolvedAssetUrls: Object.fromEntries(this.resolvedAssetUrls),
      activeInstanceCount: this.instances.size,
      loadAttempts: Object.fromEntries(this.loadAttempts),
      disposed: this.disposed,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    [...this.instances].forEach((instance) => this.release(instance));
    this.sources.forEach((gltf) => disposeObjectResources(gltf.scene, { textures: true }));
    this.sources.clear();
    this.sourcePromises.clear();
    this.resolvedAssetUrls.clear();
    this.loader = null;
    this.cloneScene = null;
  }
}

export const worldWeaponGlbLoader = new WorldWeaponGlbLoader();
