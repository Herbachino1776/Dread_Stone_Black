import * as THREE from 'three';

export const BLACK_GROWTH_TEXTURES = Object.freeze({
  intact: Object.freeze([
    './assets/textures/growth/black_growth_scab_intact_01.png',
    './assets/textures/growth/black_growth_scab_intact_02.png',
  ]),
  damaged: Object.freeze([
    './assets/textures/growth/black_growth_scab_damaged_01.png',
    './assets/textures/growth/black_growth_scab_damaged_02.png',
  ]),
  cord: './assets/textures/growth/black_growth_cord_surface_01.png',
  hit: './assets/sprites/effects/growth/black_growth_hit_decal_01.png',
});

const textureCache = new Map();

export function configureBlackGrowthTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 2;
  return texture;
}

export function loadBlackGrowthTexture(textureLoader, path) {
  if (!textureCache.has(path)) textureCache.set(path, configureBlackGrowthTexture(textureLoader.load(path)));
  return textureCache.get(path);
}

export function createBlackGrowthPlaneMaterial(map, { opacity = 1, color = 0x756f63 } = {}) {
  return new THREE.MeshBasicMaterial({
    map,
    color,
    transparent: true,
    opacity,
    alphaTest: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function createBlackGrowthKnotMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x171816,
    roughness: 0.38,
    metalness: 0.18,
    emissive: 0x090a08,
    emissiveIntensity: 0.18,
  });
}
