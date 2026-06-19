import * as THREE from 'three';

export const OARB_TERRAIN_MAX_SEGMENTS_PER_AXIS = 160;
export const OARB_TERRAIN_MAX_TOTAL_CELLS = 16384;
export const OARB_TERRAIN_FALLBACK_MATERIAL_KEY = 'forestGround';
export const OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE = Object.freeze({
  path: './assets/textures/outdoor/field_dead_grass_01.png',
  repeat: [48, 48],
  color: 0xb0aa91,
  roughness: 0.98,
  metalness: 0.0,
  emissive: 0x20232a,
  emissiveIntensity: 0.08,
});

function finitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function sanitizeTerrain(terrain) {
  const [sizeX, sizeZ] = Array.isArray(terrain?.size) ? terrain.size : [];
  const [segmentsX, segmentsZ] = Array.isArray(terrain?.segments) ? terrain.segments : [];
  const baseY = terrain?.baseY ?? 0;

  if (!finitePositive(sizeX) || !finitePositive(sizeZ)) throw new Error('OARB terrain size must contain two finite positive values.');
  if (!Number.isInteger(segmentsX) || !Number.isInteger(segmentsZ) || segmentsX <= 0 || segmentsZ <= 0) throw new Error('OARB terrain segments must contain two finite positive integers.');
  if (segmentsX > OARB_TERRAIN_MAX_SEGMENTS_PER_AXIS || segmentsZ > OARB_TERRAIN_MAX_SEGMENTS_PER_AXIS || segmentsX * segmentsZ > OARB_TERRAIN_MAX_TOTAL_CELLS) {
    throw new Error(`OARB terrain segments exceed mobile-safe limits (${OARB_TERRAIN_MAX_SEGMENTS_PER_AXIS} per axis, ${OARB_TERRAIN_MAX_TOTAL_CELLS} total cells).`);
  }
  if (!Number.isFinite(baseY)) throw new Error('OARB terrain baseY must be finite.');

  return { sizeX, sizeZ, segmentsX, segmentsZ, baseY };
}

function resolveTerrainMaterialProfile(terrain, textures = {}) {
  const materialKey = terrain?.material || OARB_TERRAIN_FALLBACK_MATERIAL_KEY;
  const profile = textures[materialKey] ?? OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE;
  return { materialKey, profile, usedFallback: !textures[materialKey] };
}

function applyWorldScaleUvs(geometry, { sizeX, sizeZ }, profile = {}) {
  const uv = geometry.attributes.uv;
  const position = geometry.attributes.position;
  const repeat = Array.isArray(profile.repeat) ? profile.repeat : OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE.repeat;
  const tileSizeX = finitePositive(profile.worldTileSizeX) ? profile.worldTileSizeX : sizeX / Math.max(repeat[0] ?? 1, 1);
  const tileSizeZ = finitePositive(profile.worldTileSizeZ) ? profile.worldTileSizeZ : sizeZ / Math.max(repeat[1] ?? 1, 1);

  for (let index = 0; index < position.count; index += 1) {
    const worldX = position.getX(index);
    const worldZ = -position.getY(index);
    uv.setXY(index, (worldX + sizeX * 0.5) / tileSizeX, (worldZ + sizeZ * 0.5) / tileSizeZ);
  }
  uv.needsUpdate = true;
  return { tileSize: [tileSizeX, tileSizeZ] };
}

function assertGeneratedGeometrySafe(geometry) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (!position || position.count === 0) throw new Error('OARB terrain generated no vertex positions.');
  if (!uv || uv.count !== position.count) throw new Error('OARB terrain generated invalid UVs.');
  for (let index = 0; index < position.count; index += 1) {
    if (!Number.isFinite(position.getX(index)) || !Number.isFinite(position.getY(index)) || !Number.isFinite(position.getZ(index))) {
      throw new Error(`OARB terrain generated non-finite vertex position at ${index}.`);
    }
    if (!Number.isFinite(uv.getX(index)) || !Number.isFinite(uv.getY(index))) {
      throw new Error(`OARB terrain generated non-finite UV at ${index}.`);
    }
  }
}

export function createOutdoorTerrainMesh(terrain, {
  textures = {},
  makeMaterial,
  name = 'OARB-terrain-heightfield-mesh',
} = {}) {
  const safe = sanitizeTerrain(terrain);
  const { materialKey, profile, usedFallback } = resolveTerrainMaterialProfile(terrain, textures);
  const geometry = new THREE.PlaneGeometry(safe.sizeX, safe.sizeZ, safe.segmentsX, safe.segmentsZ);
  const uvMetadata = applyWorldScaleUvs(geometry, safe, profile);
  geometry.rotateX(-Math.PI / 2);
  assertGeneratedGeometrySafe(geometry);

  const material = typeof makeMaterial === 'function'
    ? makeMaterial({ ...OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE, ...profile, repeat: [1, 1] }, { materialKey, profile, usedFallback })
    : new THREE.MeshStandardMaterial({ color: profile.color ?? OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE.color, roughness: profile.roughness ?? 0.98, metalness: profile.metalness ?? 0.0 });
  if (material) material.name = material.name || `OARB-terrain-material-${materialKey}`;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.y = safe.baseY;
  mesh.receiveShadow = true;
  mesh.userData = {
    kind: 'oarbTerrain',
    authoringRuntime: 'OARB',
    terrain: true,
    materialKey,
    materialFallbackUsed: usedFallback,
    size: [safe.sizeX, safe.sizeZ],
    segments: [safe.segmentsX, safe.segmentsZ],
    baseY: safe.baseY,
    vertexCount: geometry.attributes.position.count,
    uvMode: 'world-scale-xz-distance',
    uvTileSize: uvMetadata.tileSize,
    heightStampsApplied: 0,
    collisionNote: 'Visual terrain mesh only; terrain height sampling and player grounding are deferred to a later OARB PR.',
  };
  return mesh;
}
