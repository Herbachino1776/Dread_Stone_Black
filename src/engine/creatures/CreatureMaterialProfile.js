import * as THREE from 'three';

const MATERIAL_TEXTURE_SLOTS = Object.freeze({
  srgb: Object.freeze(['map', 'emissiveMap']),
  nonColor: Object.freeze([
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'bumpMap',
    'displacementMap',
    'alphaMap',
  ]),
});

function cloneMeshMaterial(child) {
  if (!child.material) return [];
  if (Array.isArray(child.material)) {
    child.material = child.material.map((material) => material?.clone?.() ?? material);
    return child.material.filter(Boolean);
  }

  child.material = child.material.clone?.() ?? child.material;
  return child.material ? [child.material] : [];
}

function tuneTexture(texture, colorSpace) {
  if (!texture) return false;
  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
  return true;
}

function applyColor(material, slot, value) {
  if (!(material[slot] instanceof THREE.Color) || value === undefined || value === null) return false;
  material[slot].set(value);
  return true;
}

function applyNumber(material, slot, value) {
  if (!(slot in material) || value === undefined || value === null) return false;
  material[slot] = value;
  return true;
}

export function applyCreatureMaterialProfile(root, profile = {}) {
  const summary = {
    profileId: profile.id ?? 'default',
    meshes: 0,
    materials: 0,
    clonedMaterials: 0,
    baseColorMapsSetToSrgb: 0,
    emissiveMapsSetToSrgb: 0,
    nonColorMapsKeptLinear: 0,
    colorTinted: 0,
    emissiveTuned: 0,
    roughnessTuned: 0,
    metalnessTuned: 0,
  };

  if (!root) return summary;

  root.traverse((child) => {
    if (!child.isMesh) return;
    summary.meshes += 1;
    child.castShadow = Boolean(profile.castShadow ?? child.castShadow);
    child.receiveShadow = profile.receiveShadow ?? true;

    const materials = profile.cloneMaterials === false
      ? (Array.isArray(child.material) ? child.material : [child.material]).filter(Boolean)
      : cloneMeshMaterial(child);
    if (profile.cloneMaterials !== false) summary.clonedMaterials += materials.length;

    materials.forEach((material) => {
      summary.materials += 1;

      MATERIAL_TEXTURE_SLOTS.srgb.forEach((slot) => {
        if (tuneTexture(material[slot], THREE.SRGBColorSpace)) {
          if (slot === 'map') summary.baseColorMapsSetToSrgb += 1;
          if (slot === 'emissiveMap') summary.emissiveMapsSetToSrgb += 1;
        }
      });

      MATERIAL_TEXTURE_SLOTS.nonColor.forEach((slot) => {
        if (tuneTexture(material[slot], THREE.NoColorSpace)) summary.nonColorMapsKeptLinear += 1;
      });

      if (applyColor(material, 'color', profile.tint ?? profile.colorMultiplier)) summary.colorTinted += 1;
      if (applyColor(material, 'emissive', profile.emissive)) summary.emissiveTuned += 1;
      if (applyNumber(material, 'emissiveIntensity', profile.emissiveIntensity)) summary.emissiveTuned += 1;
      if (applyNumber(material, 'roughness', profile.roughness)) summary.roughnessTuned += 1;
      if (applyNumber(material, 'metalness', profile.metalness)) summary.metalnessTuned += 1;

      if (typeof profile.adjustMaterial === 'function') {
        profile.adjustMaterial(material, child, summary);
      }

      material.needsUpdate = true;
    });
  });

  return summary;
}

export class CreatureMaterialProfile {
  constructor(profile = {}) {
    this.profile = profile;
  }

  apply(root) {
    return applyCreatureMaterialProfile(root, this.profile);
  }
}
