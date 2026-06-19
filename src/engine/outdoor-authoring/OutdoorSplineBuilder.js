import * as THREE from 'three';
import { OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE } from './OutdoorTerrainBuilder.js';

export const OARB_SPLINE_TRAIL_MAX_POINTS = 64;
export const OARB_SPLINE_TRAIL_MAX_WIDTH = 32;
export const OARB_SPLINE_TRAIL_Y_OFFSET = 0.035;
export const OARB_SPLINE_TRAIL_FALLBACK_MATERIAL_KEY = 'mudTrail';
export const OARB_SPLINE_TRAIL_FALLBACK_MATERIAL_PROFILE = Object.freeze({
  path: './assets/textures/outdoor/field_dead_grass_01.png',
  repeat: [18, 3],
  color: 0x5f4b37,
  roughness: 1.0,
  metalness: 0.0,
  emissive: 0x140e09,
  emissiveIntensity: 0.04,
  worldTileLength: 8,
  worldTileWidth: 3,
});

function finitePoint(value) {
  const x = Number(value?.x ?? value?.[0]);
  const z = Number(value?.z ?? value?.[1]);
  return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
}

function sanitizeTrail(trail) {
  const id = typeof trail?.id === 'string' && trail.id.trim() ? trail.id : null;
  const points = Array.isArray(trail?.points) ? trail.points.map(finitePoint).filter(Boolean) : [];
  const width = Number(trail?.width);
  if (!id || points.length < 2 || !Number.isFinite(width) || width <= 0 || width > OARB_SPLINE_TRAIL_MAX_WIDTH || points.length > OARB_SPLINE_TRAIL_MAX_POINTS) return null;
  return {
    id,
    points,
    width,
    materialKey: typeof trail.material === 'string' && trail.material.trim() ? trail.material : OARB_SPLINE_TRAIL_FALLBACK_MATERIAL_KEY,
    flattenRequested: trail.flatten === true,
  };
}

function resolveTrailMaterialProfile(materialKey, textures = {}) {
  const profile = textures[materialKey] ?? textures[OARB_SPLINE_TRAIL_FALLBACK_MATERIAL_KEY] ?? OARB_SPLINE_TRAIL_FALLBACK_MATERIAL_PROFILE;
  return { profile, usedFallback: !textures[materialKey] };
}

function makeTangent(points, index) {
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const dx = next.x - previous.x;
  const dz = next.z - previous.z;
  const length = Math.hypot(dx, dz);
  if (length <= Number.EPSILON) return { x: 1, z: 0 };
  return { x: dx / length, z: dz / length };
}

function assertGeometrySafe(geometry) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (!position || !uv || position.count === 0 || uv.count !== position.count) throw new Error('OARB spline trail generated invalid geometry attributes.');
  for (let index = 0; index < position.count; index += 1) {
    if (!Number.isFinite(position.getX(index)) || !Number.isFinite(position.getY(index)) || !Number.isFinite(position.getZ(index))) throw new Error(`OARB spline trail generated non-finite position at ${index}.`);
    if (!Number.isFinite(uv.getX(index)) || !Number.isFinite(uv.getY(index))) throw new Error(`OARB spline trail generated non-finite UV at ${index}.`);
  }
}

export function createOutdoorSplineTrailMesh(trail, { terrainSampler, textures = {}, makeMaterial, yOffset = OARB_SPLINE_TRAIL_Y_OFFSET } = {}) {
  const safe = sanitizeTrail(trail);
  if (!safe || typeof terrainSampler?.sampleOutdoorY !== 'function') return null;

  const vertices = [];
  const uvs = [];
  const indices = [];
  const sampledHeights = [];
  const { profile, usedFallback } = resolveTrailMaterialProfile(safe.materialKey, textures);
  const tileLength = Number.isFinite(profile.worldTileLength) && profile.worldTileLength > 0 ? profile.worldTileLength : 8;
  const tileWidth = Number.isFinite(profile.worldTileWidth) && profile.worldTileWidth > 0 ? profile.worldTileWidth : Math.max(safe.width, 1);
  let distance = 0;

  safe.points.forEach((point, index) => {
    if (index > 0) distance += Math.hypot(point.x - safe.points[index - 1].x, point.z - safe.points[index - 1].z);
    const tangent = makeTangent(safe.points, index);
    const normal = { x: -tangent.z, z: tangent.x };
    const y = terrainSampler.sampleOutdoorY(point.x, point.z) + yOffset;
    sampledHeights.push(y - yOffset);
    const half = safe.width * 0.5;
    vertices.push(point.x + normal.x * half, y, point.z + normal.z * half, point.x - normal.x * half, y, point.z - normal.z * half);
    uvs.push(distance / tileLength, 0, distance / tileLength, safe.width / tileWidth);
  });

  for (let index = 0; index < safe.points.length - 1; index += 1) {
    const a = index * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  assertGeometrySafe(geometry);

  const material = typeof makeMaterial === 'function'
    ? makeMaterial({ ...OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE, ...OARB_SPLINE_TRAIL_FALLBACK_MATERIAL_PROFILE, ...profile, repeat: [1, 1] }, { materialKey: safe.materialKey, profile, usedFallback })
    : new THREE.MeshStandardMaterial({ color: profile.color ?? OARB_SPLINE_TRAIL_FALLBACK_MATERIAL_PROFILE.color, roughness: profile.roughness ?? 1, metalness: profile.metalness ?? 0 });
  material.name = material.name || `OARB-spline-trail-material-${safe.materialKey}`;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `OARB-spline-trail-${safe.id}`;
  mesh.receiveShadow = true;
  mesh.userData = {
    kind: 'oarbSplineTrail',
    authoringRuntime: 'OARB',
    id: safe.id,
    points: safe.points.map(({ x, z }) => [x, z]),
    width: safe.width,
    materialKey: safe.materialKey,
    materialFallbackUsed: usedFallback,
    sampledTerrainSource: terrainSampler.kind ?? 'oarbTerrainSampler',
    sampledHeights,
    yOffset,
    flattenRequested: safe.flattenRequested,
    collisionNote: 'No collision is generated from OARB spline trails yet.',
  };
  return mesh;
}

export function createOutdoorSplineTrailMeshes(splineTrails = [], options = {}) {
  if (!Array.isArray(splineTrails)) return [];
  return splineTrails.map((trail) => createOutdoorSplineTrailMesh(trail, options)).filter(Boolean);
}
