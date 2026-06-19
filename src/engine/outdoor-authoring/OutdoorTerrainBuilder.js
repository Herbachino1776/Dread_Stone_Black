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

function smoothFalloff01(distance, radius) {
  if (!finitePositive(radius)) return 0;
  const t = THREE.MathUtils.clamp(1 - distance / radius, 0, 1);
  return t * t * (3 - 2 * t);
}

function distanceToSegment2D(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const lengthSq = abx * abx + abz * abz;
  if (lengthSq <= Number.EPSILON) {
    const dx = px - ax;
    const dz = pz - az;
    return Math.hypot(dx, dz);
  }
  const t = THREE.MathUtils.clamp(((px - ax) * abx + (pz - az) * abz) / lengthSq, 0, 1);
  const closestX = ax + abx * t;
  const closestZ = az + abz * t;
  return Math.hypot(px - closestX, pz - closestZ);
}

function distanceToPolyline2D(x, z, path) {
  let closest = Infinity;
  for (let index = 0; index < path.length - 1; index += 1) {
    const [ax, az] = path[index];
    const [bx, bz] = path[index + 1];
    closest = Math.min(closest, distanceToSegment2D(x, z, ax, az, bx, bz));
  }
  return closest;
}

function applyHeightStampAtPoint(currentY, stamp, x, z) {
  switch (stamp?.kind) {
    case 'hill': {
      const [cx, cz] = Array.isArray(stamp.center) ? stamp.center : [];
      const falloff = smoothFalloff01(Math.hypot(x - cx, z - cz), stamp.radius);
      return currentY + (stamp.height * falloff);
    }
    case 'hollow': {
      const [cx, cz] = Array.isArray(stamp.center) ? stamp.center : [];
      const falloff = smoothFalloff01(Math.hypot(x - cx, z - cz), stamp.radius);
      return currentY - (stamp.depth * falloff);
    }
    case 'ridge': {
      const falloff = smoothFalloff01(distanceToPolyline2D(x, z, stamp.path), stamp.width);
      return currentY + (stamp.height * falloff);
    }
    case 'ravine': {
      const falloff = smoothFalloff01(distanceToPolyline2D(x, z, stamp.path), stamp.width);
      return currentY - (stamp.depth * falloff);
    }
    case 'flatten': {
      const [cx, cz] = Array.isArray(stamp.center) ? stamp.center : [];
      const falloff = smoothFalloff01(Math.hypot(x - cx, z - cz), stamp.radius);
      return THREE.MathUtils.lerp(currentY, stamp.y, falloff);
    }
    default:
      return currentY;
  }
}

function pointForHeightIndex(index, { sizeX, sizeZ, segmentsX, segmentsZ }) {
  const stride = segmentsX + 1;
  const gridX = index % stride;
  const gridZ = Math.floor(index / stride);
  return [
    (gridX / segmentsX) * sizeX - sizeX * 0.5,
    (gridZ / segmentsZ) * sizeZ - sizeZ * 0.5,
  ];
}

function createFlatHeightData({ segmentsX, segmentsZ, baseY }) {
  return new Float32Array((segmentsX + 1) * (segmentsZ + 1)).fill(baseY);
}

function createStampedHeightData(safe, heightStamps = []) {
  const heightData = createFlatHeightData(safe);
  if (!Array.isArray(heightStamps) || heightStamps.length === 0) return heightData;

  for (let index = 0; index < heightData.length; index += 1) {
    const [x, z] = pointForHeightIndex(index, safe);
    let y = safe.baseY;
    for (const stamp of heightStamps) {
      y = applyHeightStampAtPoint(y, stamp, x, z);
      if (!Number.isFinite(y)) {
        y = safe.baseY;
        break;
      }
    }
    heightData[index] = y;
  }
  return heightData;
}

function sampleHeightDataBilinear(heightData, { sizeX, sizeZ, segmentsX, segmentsZ, baseY }, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return baseY;
  const halfX = sizeX * 0.5;
  const halfZ = sizeZ * 0.5;
  const localX = THREE.MathUtils.clamp(x + halfX, 0, sizeX);
  const localZ = THREE.MathUtils.clamp(z + halfZ, 0, sizeZ);
  const gridX = (localX / sizeX) * segmentsX;
  const gridZ = (localZ / sizeZ) * segmentsZ;
  const x0 = Math.min(Math.floor(gridX), segmentsX);
  const z0 = Math.min(Math.floor(gridZ), segmentsZ);
  const x1 = Math.min(x0 + 1, segmentsX);
  const z1 = Math.min(z0 + 1, segmentsZ);
  const tx = THREE.MathUtils.clamp(gridX - x0, 0, 1);
  const tz = THREE.MathUtils.clamp(gridZ - z0, 0, 1);
  const stride = segmentsX + 1;
  const h00 = heightData[z0 * stride + x0] ?? baseY;
  const h10 = heightData[z0 * stride + x1] ?? baseY;
  const h01 = heightData[z1 * stride + x0] ?? baseY;
  const h11 = heightData[z1 * stride + x1] ?? baseY;
  const hx0 = THREE.MathUtils.lerp(h00, h10, tx);
  const hx1 = THREE.MathUtils.lerp(h01, h11, tx);
  const y = THREE.MathUtils.lerp(hx0, hx1, tz);
  return Number.isFinite(y) ? y : baseY;
}

export function createOutdoorTerrainSampler(terrain) {
  const safe = sanitizeTerrain(terrain);
  const heightData = createStampedHeightData(safe, terrain?.heightStamps);
  const bounds = Object.freeze({
    minX: -safe.sizeX * 0.5,
    maxX: safe.sizeX * 0.5,
    minZ: -safe.sizeZ * 0.5,
    maxZ: safe.sizeZ * 0.5,
  });
  const sampleOutdoorY = (x, z) => sampleHeightDataBilinear(heightData, safe, x, z);
  return Object.freeze({
    authoringRuntime: 'OARB',
    kind: 'oarbTerrainSampler',
    baseY: safe.baseY,
    size: Object.freeze([safe.sizeX, safe.sizeZ]),
    segments: Object.freeze([safe.segmentsX, safe.segmentsZ]),
    bounds,
    heightData,
    heightStampsApplied: Array.isArray(terrain?.heightStamps) ? terrain.heightStamps.length : 0,
    sampleOutdoorY,
  });
}

export function createOutdoorTerrainMesh(terrain, {
  textures = {},
  makeMaterial,
  name = 'OARB-terrain-heightfield-mesh',
} = {}) {
  const safe = sanitizeTerrain(terrain);
  const terrainSampler = createOutdoorTerrainSampler(terrain);
  const { materialKey, profile, usedFallback } = resolveTerrainMaterialProfile(terrain, textures);
  const geometry = new THREE.PlaneGeometry(safe.sizeX, safe.sizeZ, safe.segmentsX, safe.segmentsZ);
  const uvMetadata = applyWorldScaleUvs(geometry, safe, profile);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    position.setY(index, terrainSampler.heightData[index] - safe.baseY);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
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
    heightStampsApplied: Array.isArray(terrain?.heightStamps) ? terrain.heightStamps.length : 0,
    terrainSampler,
    sampleOutdoorY: terrainSampler.sampleOutdoorY,
    collisionNote: 'OARB terrain mesh and runtime sampler share the same generated height data.',
  };
  return mesh;
}
