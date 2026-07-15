import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createCachedWeaponGlbLoader(assetPath, assetLabel = 'Weapon') {
  let assetPromise = null;
  return function loadWeaponAsset() {
    if (!assetPromise) {
      assetPromise = new GLTFLoader().loadAsync(assetPath).then((gltf) => {
        const root = gltf.scene ?? gltf.scenes?.[0];
        if (!root) throw new Error(`${assetLabel} GLB loaded without a scene: ${assetPath}`);
        return root;
      });
    }
    return assetPromise;
  };
}

export function cloneOwnedWeaponVisual(source) {
  const root = source.clone(true);
  const geometryClones = new Map();
  const materialClones = new Map();
  const cloneGeometry = (geometry) => {
    if (!geometryClones.has(geometry)) geometryClones.set(geometry, geometry.clone());
    return geometryClones.get(geometry);
  };
  const cloneMaterial = (material) => {
    if (!materialClones.has(material)) materialClones.set(material, material.clone());
    return materialClones.get(material);
  };
  root.traverse((object) => {
    if (!object.isMesh) return;
    if (object.geometry) object.geometry = cloneGeometry(object.geometry);
    if (object.material) object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
  });
  return { root, geometries: [...geometryClones.values()], materials: [...materialClones.values()] };
}

export function applyWeaponRenderLayer(root, { layer, renderOrder, itemId, viewmodel, configureMesh = null }) {
  root.traverse((object) => {
    object.layers.set(layer);
    if (!object.isMesh) return;
    object.renderOrder = renderOrder;
    object.castShadow = false;
    object.receiveShadow = false;
    object.frustumCulled = false;
    object.userData.itemId = itemId;
    object.userData.combatWeaponPart = object.name;
    object.userData.combatWeaponViewmodel = viewmodel;
    configureMesh?.(object);
  });
}

export function captureWeaponMaterialLightingState(root) {
  const materials = new Map();
  root?.traverse?.((object) => {
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => {
      if (materials.has(material.uuid)) return;
      materials.set(material.uuid, {
        uuid: material.uuid,
        color: material.color?.getHex?.() ?? null,
        metalness: material.metalness ?? null,
        roughness: material.roughness ?? null,
        map: material.map?.uuid ?? null,
        normalMap: material.normalMap?.uuid ?? null,
        emissive: material.emissive?.getHex?.() ?? null,
        emissiveIntensity: material.emissiveIntensity ?? null,
        baseOutdoorEmissiveIntensity: material.userData?.baseOutdoorEmissiveIntensity ?? null,
      });
    });
  });
  return [...materials.values()].sort((a, b) => a.uuid.localeCompare(b.uuid));
}

export function weaponMaterialLightingStateChanged(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

export function getWeaponRenderLayer(root) {
  let mask = root?.layers?.mask ?? 0;
  let foundMesh = false;
  root?.traverse?.((object) => {
    if (!foundMesh && object.isMesh) {
      mask = object.layers.mask;
      foundMesh = true;
    }
  });
  if (mask <= 0 || (mask & (mask - 1)) !== 0) return null;
  return Math.log2(mask);
}

export function getWeaponWorldLightIntersectionStatus(root, scene) {
  const meshMasks = new Set();
  root?.traverse?.((object) => { if (object.isMesh) meshMasks.add(object.layers.mask); });
  if (meshMasks.size === 0 && root?.layers) meshMasks.add(root.layers.mask);
  const intersectingLights = [];
  const registeredLights = scene?.userData?.outdoorLightSourceRegistry?.entries;
  const inspectLight = (object) => {
    if (!object?.isLight || !object.userData?.outdoorLightSource) return;
    for (const mask of meshMasks) {
      if ((mask & object.layers.mask) === 0) continue;
      intersectingLights.push(object.name || object.type);
      break;
    }
  };
  if (registeredLights instanceof Map) registeredLights.forEach((entry) => inspectLight(entry.light));
  else scene?.traverse?.(inspectLight);
  intersectingLights.sort();
  return {
    intersects: intersectingLights.length > 0,
    intersectingLights,
  };
}

export function disposeOwnedWeaponVisual({ root = null, geometries = [], materials = [] } = {}) {
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  root?.removeFromParent?.();
}
