import * as THREE from 'three';
import { createOutdoorTerrainSampler, OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE } from './OutdoorTerrainBuilder.js';

const DEFAULT_COLUMNS = 3;
const DEFAULT_ROWS = 9;
const MAX_CHUNK_VERTICES = 6500;

function finite(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function resolveMaterialZone(zones, centerX, centerZ, fallback) {
  return (zones ?? []).find((zone) => centerX >= zone.minX && centerX <= zone.maxX && centerZ >= zone.minZ && centerZ <= zone.maxZ)?.material ?? fallback;
}

function createChunkGeometry({ minX, maxX, minZ, maxZ, segmentsX, segmentsZ, sampler, profile }) {
  const vertices = [];
  const uvs = [];
  const indices = [];
  const tileX = finite(profile.worldTileSizeX, (maxX - minX) / Math.max(1, profile.repeat?.[0] ?? 12));
  const tileZ = finite(profile.worldTileSizeZ, (maxZ - minZ) / Math.max(1, profile.repeat?.[1] ?? 12));
  for (let zIndex = 0; zIndex <= segmentsZ; zIndex += 1) {
    const z = THREE.MathUtils.lerp(minZ, maxZ, zIndex / segmentsZ);
    for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
      const x = THREE.MathUtils.lerp(minX, maxX, xIndex / segmentsX);
      vertices.push(x, sampler.sampleOutdoorY(x, z), z);
      uvs.push(x / tileX, z / tileZ);
    }
  }
  const stride = segmentsX + 1;
  for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1) {
    for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
      const a = zIndex * stride + xIndex;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (geometry.attributes.position.count > MAX_CHUNK_VERTICES) throw new Error(`Outdoor terrain chunk exceeds ${MAX_CHUNK_VERTICES} vertices.`);
  return geometry;
}

function summarizeChunk(mesh, sampler, source) {
  const position = mesh.geometry.attributes.position;
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  let slopeTotal = 0;
  let maxSlope = 0;
  const step = Math.max(1, Math.floor(position.count / 180));
  for (let index = 0; index < position.count; index += step) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const dx = sampler.sampleOutdoorY(x + 0.5, z) - sampler.sampleOutdoorY(x - 0.5, z);
    const dz = sampler.sampleOutdoorY(x, z + 0.5) - sampler.sampleOutdoorY(x, z - 0.5);
    const slope = Math.hypot(dx, dz);
    minElevation = Math.min(minElevation, y);
    maxElevation = Math.max(maxElevation, y);
    slopeTotal += slope;
    maxSlope = Math.max(maxSlope, slope);
  }
  const samples = Math.ceil(position.count / step);
  return Object.freeze({
    id: source.id,
    bounds: Object.freeze({ minX: source.minX, maxX: source.maxX, minZ: source.minZ, maxZ: source.maxZ }),
    vertexCount: position.count,
    triangleCount: mesh.geometry.index.count / 3,
    minimumElevation: Number(minElevation.toFixed(3)),
    maximumElevation: Number(maxElevation.toFixed(3)),
    averageSlope: Number((slopeTotal / samples).toFixed(4)),
    maximumSlope: Number(maxSlope.toFixed(4)),
    materialZone: source.material,
    activeStamps: source.activeStamps,
    roadCorridorOverlap: source.roadCorridorOverlap,
    waterCorridorOverlap: source.waterCorridorOverlap,
    foliageCount: 0,
    collisionStatus: 'shared-global-heightfield',
  });
}

export function createOutdoorTerrainComposition(terrain, { textures = {}, makeMaterial, pathCorridors = [], waterways = [], name = 'OARB-terrain-composition' } = {}) {
  if (terrain?.composition?.chunked !== true) return null;
  const [sizeX, sizeZ] = terrain.size;
  const [globalSegmentsX, globalSegmentsZ] = terrain.segments;
  const columns = Math.max(1, Math.round(finite(terrain.composition.columns, DEFAULT_COLUMNS)));
  const rows = Math.max(1, Math.round(finite(terrain.composition.rows, DEFAULT_ROWS)));
  if (globalSegmentsX % columns || globalSegmentsZ % rows) throw new Error('Outdoor terrain composition segments must divide evenly across chunk columns and rows.');
  const terrainSampler = createOutdoorTerrainSampler(terrain, { pathCorridors, waterways });
  const group = new THREE.Group();
  group.name = name;
  const summaries = [];
  const chunks = [];
  const zones = terrain.materialZones ?? [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const minX = -sizeX * 0.5 + (column / columns) * sizeX;
      const maxX = -sizeX * 0.5 + ((column + 1) / columns) * sizeX;
      const minZ = -sizeZ * 0.5 + (row / rows) * sizeZ;
      const maxZ = -sizeZ * 0.5 + ((row + 1) / rows) * sizeZ;
      const centerX = (minX + maxX) * 0.5;
      const centerZ = (minZ + maxZ) * 0.5;
      const materialKey = resolveMaterialZone(zones, centerX, centerZ, terrain.material);
      const profile = textures[materialKey] ?? OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE;
      const material = typeof makeMaterial === 'function'
        ? makeMaterial({ ...OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE, ...profile, repeat: [1, 1] }, { materialKey, profile, usedFallback: !textures[materialKey] })
        : new THREE.MeshStandardMaterial({ color: profile.color ?? 0x77705d, roughness: profile.roughness ?? 0.98 });
      const id = `terrain_chunk_r${String(row).padStart(2, '0')}_c${String(column).padStart(2, '0')}`;
      const source = {
        id, minX, maxX, minZ, maxZ, material: materialKey,
        activeStamps: (terrain.heightStamps ?? []).filter((stamp) => {
          const [x, z] = stamp.center ?? [NaN, NaN];
          return Number.isFinite(x) ? x >= minX - (stamp.radius ?? 0) && x <= maxX + (stamp.radius ?? 0) && z >= minZ - (stamp.radius ?? 0) && z <= maxZ + (stamp.radius ?? 0) : true;
        }).map((stamp) => stamp.id),
        roadCorridorOverlap: pathCorridors.some((road) => road.points?.some(([x, z]) => x >= minX && x <= maxX && z >= minZ && z <= maxZ)),
        waterCorridorOverlap: waterways.some((waterway) => waterway.points?.some(([x, z]) => x >= minX && x <= maxX && z >= minZ && z <= maxZ)),
      };
      const geometry = createChunkGeometry({ minX, maxX, minZ, maxZ, segmentsX: globalSegmentsX / columns, segmentsZ: globalSegmentsZ / rows, sampler: terrainSampler, profile });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = id;
      mesh.receiveShadow = true;
      mesh.userData = { kind: 'oarbTerrainChunk', authoringRuntime: 'OARB', materialKey, bounds: { minX, maxX, minZ, maxZ }, collisionTruth: 'shared-global-heightfield' };
      group.add(mesh);
      chunks.push(mesh);
      summaries.push(summarizeChunk(mesh, terrainSampler, source));
    }
  }
  group.userData = {
    kind: 'oarbTerrainComposition', authoringRuntime: 'OARB', chunked: true,
    size: [...terrain.size], segments: [...terrain.segments], chunkGrid: [columns, rows],
    vertexCount: chunks.reduce((sum, chunk) => sum + chunk.geometry.attributes.position.count, 0),
    triangleCount: chunks.reduce((sum, chunk) => sum + chunk.geometry.index.count / 3, 0),
    terrainSampler, chunkSummaries: Object.freeze(summaries),
    collisionNote: 'All render chunks, roads, collision, and placement sample one global final heightfield.',
  };
  return Object.freeze({ group, terrainSampler, chunks: Object.freeze(chunks), summaries: Object.freeze(summaries) });
}
