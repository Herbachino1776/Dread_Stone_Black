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

export function disposeOwnedWeaponVisual({ root = null, geometries = [], materials = [] } = {}) {
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  root?.removeFromParent?.();
}
