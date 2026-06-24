import * as THREE from 'three';
import { OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE } from './OutdoorTerrainBuilder.js';

export const OARB_SPLINE_TRAIL_MAX_POINTS = 64;
export const OARB_SPLINE_TRAIL_MAX_WIDTH = 32;
export const OARB_SPLINE_TRAIL_Y_OFFSET = 0.035;
export const OARB_SPLINE_PATH_SUPPORT_Y_OFFSET = 0.055;
export const OARB_SPLINE_PATH_EDGE_DEFAULTS = Object.freeze({
  materialKey: 'darkStone',
  height: 0.28,
  thickness: 0.26,
  ySink: 0.035,
});
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
    edgeMaterialKey: typeof trail.edgeMaterial === 'string' && trail.edgeMaterial.trim() ? trail.edgeMaterial : null,
    edgeHeight: Number.isFinite(Number(trail.edgeHeight)) ? Number(trail.edgeHeight) : null,
    edgeThickness: Number.isFinite(Number(trail.edgeThickness)) ? Number(trail.edgeThickness) : null,
    supportYOffset: Number.isFinite(Number(trail.supportYOffset)) ? Number(trail.supportYOffset) : null,
    visualYOffset: Number.isFinite(Number(trail.visualYOffset)) ? Number(trail.visualYOffset) : null,
    edgeMeshes: trail.edgeMeshes !== false,
    pathSupport: trail.pathSupport !== false,
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
  const normal = geometry.attributes.normal;
  if (!position || !uv || position.count === 0 || uv.count !== position.count) throw new Error('OARB spline trail generated invalid geometry attributes.');
  if (!normal || normal.count !== position.count) throw new Error('OARB spline trail generated invalid geometry normals.');
  for (let index = 0; index < position.count; index += 1) {
    if (!Number.isFinite(position.getX(index)) || !Number.isFinite(position.getY(index)) || !Number.isFinite(position.getZ(index))) throw new Error(`OARB spline trail generated non-finite position at ${index}.`);
    if (!Number.isFinite(uv.getX(index)) || !Number.isFinite(uv.getY(index))) throw new Error(`OARB spline trail generated non-finite UV at ${index}.`);
    if (!Number.isFinite(normal.getX(index)) || !Number.isFinite(normal.getY(index)) || !Number.isFinite(normal.getZ(index))) throw new Error(`OARB spline trail generated non-finite normal at ${index}.`);
    if (normal.getY(index) < -0.001) throw new Error(`OARB spline trail generated downward-facing normal at ${index}.`);
  }
}

function makeSegmentEdgeMesh({ id, from, to, side, width, height, thickness, ySink, material }) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0.0001) return null;
  const ux = dx / length;
  const uz = dz / length;
  const nx = -uz;
  const nz = ux;
  const edgeOffset = side * (width * 0.5 + thickness * 0.5);
  const x0 = from.x + nx * edgeOffset;
  const z0 = from.z + nz * edgeOffset;
  const x1 = to.x + nx * edgeOffset;
  const z1 = to.z + nz * edgeOffset;
  const y0 = Math.min(from.pathY, from.edgeGroundY ?? from.pathY) - ySink;
  const y1 = Math.min(to.pathY, to.edgeGroundY ?? to.pathY) - ySink;
  const retainingHeight = Math.max(height, Math.abs(from.pathY - y0), Math.abs(to.pathY - y1)) + ySink;
  const centerY = Math.min(y0, y1) + retainingHeight * 0.5;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length + thickness * 0.55, retainingHeight, thickness), material);
  mesh.position.set((x0 + x1) * 0.5, centerY, (z0 + z1) * 0.5);
  mesh.rotation.y = Math.atan2(dx, dz);
  mesh.name = id;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { kind: 'oarbSplinePathEdge', side: side < 0 ? 'right' : 'left', visualOnlyCollision: true, width, height: retainingHeight, thickness, ySink };
  return mesh;
}

export function createOutdoorSplinePathSupportSurfaces(splineTrails = [], { terrainSampler, yOffset = OARB_SPLINE_PATH_SUPPORT_Y_OFFSET, priority = 18 } = {}) {
  if (!Array.isArray(splineTrails) || typeof terrainSampler?.sampleOutdoorY !== 'function') return [];
  const surfaces = [];
  splineTrails.forEach((trail) => {
    const safe = sanitizeTrail(trail);
    if (!safe || !safe.pathSupport) return;
    const supportOffset = safe.supportYOffset ?? yOffset;
    for (let index = 0; index < safe.points.length - 1; index += 1) {
      const from = safe.points[index];
      const to = safe.points[index + 1];
      surfaces.push({
        id: `${safe.id}_path_support_${index}`,
        kind: 'ramp',
        from: [from.x, from.z],
        to: [to.x, to.z],
        width: safe.width,
        y0: terrainSampler.sampleOutdoorY(from.x, from.z) + supportOffset,
        y1: terrainSampler.sampleOutdoorY(to.x, to.z) + supportOffset,
        priority,
        tags: ['oarb-spline-path-support', 'walkable-route', ...(trail.tags ?? [])],
        userData: { sourceTrailId: safe.id, supportOffset, collisionTruth: 'Player ground height is interpolated from authored path centerline endpoints so visual paths bridge gullies instead of sampling depressed terrain underneath.' },
      });
    }
  });
  return surfaces;
}

export function createOutdoorSplineVisibleSurfaceSampler(splineTrails = [], { terrainSampler, yOffset = OARB_SPLINE_TRAIL_Y_OFFSET } = {}) {
  if (!Array.isArray(splineTrails) || typeof terrainSampler?.sampleOutdoorY !== 'function') return null;
  const segments = [];
  splineTrails.forEach((trail) => {
    const safe = sanitizeTrail(trail);
    if (!safe) return;
    for (let index = 0; index < safe.points.length - 1; index += 1) {
      const from = safe.points[index];
      const to = safe.points[index + 1];
      segments.push({
        id: `${safe.id}_visible_surface_${index}`,
        sourceTrailId: safe.id,
        from,
        to,
        width: safe.width,
        y0: terrainSampler.sampleOutdoorY(from.x, from.z) + yOffset,
        y1: terrainSampler.sampleOutdoorY(to.x, to.z) + yOffset,
        yOffset,
        tags: ['oarb-spline-visible-path-surface', ...(trail.tags ?? [])],
      });
    }
  });
  if (!segments.length) return null;
  return {
    kind: 'oarbSplineVisibleSurfaceSampler',
    sampleOutdoorY(x, z) {
      let best = null;
      segments.forEach((segment) => {
        const dx = segment.to.x - segment.from.x;
        const dz = segment.to.z - segment.from.z;
        const lengthSq = dx * dx + dz * dz;
        if (lengthSq <= 0.0001) return;
        const t = THREE.MathUtils.clamp(((x - segment.from.x) * dx + (z - segment.from.z) * dz) / lengthSq, 0, 1);
        const closestX = segment.from.x + dx * t;
        const closestZ = segment.from.z + dz * t;
        const distanceSq = (x - closestX) ** 2 + (z - closestZ) ** 2;
        const halfWidth = segment.width * 0.5;
        if (distanceSq > halfWidth * halfWidth) return;
        if (!best || distanceSq < best.distanceSq) {
          best = { y: THREE.MathUtils.lerp(segment.y0, segment.y1, t), segment, t, distanceSq };
        }
      });
      return best?.y ?? null;
    },
    sampleSurface(x, z) {
      const y = this.sampleOutdoorY(x, z);
      if (!Number.isFinite(y)) return null;
      return { y, kind: 'visibleSplinePath', source: 'visible-path-ribbon' };
    },
    userData: { segments, yOffset, collision: 'none; query-only visible dirt path surface' },
  };
}

export function createOutdoorSplineTrailEdgeMeshes(splineTrails = [], { terrainSampler, textures = {}, makeMaterial, yOffset = OARB_SPLINE_PATH_SUPPORT_Y_OFFSET } = {}) {
  if (!Array.isArray(splineTrails) || typeof terrainSampler?.sampleOutdoorY !== 'function') return [];
  const groups = [];
  splineTrails.forEach((trail) => {
    const safe = sanitizeTrail(trail);
    if (!safe || !safe.edgeMeshes) return;
    const materialKey = safe.edgeMaterialKey ?? OARB_SPLINE_PATH_EDGE_DEFAULTS.materialKey;
    const profile = textures[materialKey] ?? textures.darkStone ?? OARB_SPLINE_TRAIL_FALLBACK_MATERIAL_PROFILE;
    const material = typeof makeMaterial === 'function'
      ? makeMaterial({ ...profile, repeat: [1, 1] }, { materialKey, profile, usedFallback: !textures[materialKey] })
      : new THREE.MeshStandardMaterial({ color: profile.color ?? 0x55534d, roughness: profile.roughness ?? 1, metalness: profile.metalness ?? 0 });
    material.name = material.name || `OARB-spline-path-edge-material-${materialKey}`;
    const group = new THREE.Group();
    group.name = `OARB-spline-path-edges-${safe.id}`;
    const supportOffset = safe.supportYOffset ?? yOffset;
    const height = safe.edgeHeight ?? OARB_SPLINE_PATH_EDGE_DEFAULTS.height;
    const thickness = safe.edgeThickness ?? OARB_SPLINE_PATH_EDGE_DEFAULTS.thickness;
    const points = safe.points.map((point, index) => {
      const tangent = makeTangent(safe.points, index);
      const normal = { x: -tangent.z, z: tangent.x };
      const half = safe.width * 0.5 + thickness * 0.5;
      const leftGround = terrainSampler.sampleOutdoorY(point.x + normal.x * half, point.z + normal.z * half);
      const rightGround = terrainSampler.sampleOutdoorY(point.x - normal.x * half, point.z - normal.z * half);
      return { ...point, pathY: terrainSampler.sampleOutdoorY(point.x, point.z) + supportOffset, leftGround, rightGround };
    });
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      const left = makeSegmentEdgeMesh({ id: `${safe.id}_left_paver_edge_${index}`, from: { ...from, edgeGroundY: from.leftGround }, to: { ...to, edgeGroundY: to.leftGround }, side: 1, width: safe.width, height, thickness, ySink: OARB_SPLINE_PATH_EDGE_DEFAULTS.ySink, material });
      const right = makeSegmentEdgeMesh({ id: `${safe.id}_right_paver_edge_${index}`, from: { ...from, edgeGroundY: from.rightGround }, to: { ...to, edgeGroundY: to.rightGround }, side: -1, width: safe.width, height, thickness, ySink: OARB_SPLINE_PATH_EDGE_DEFAULTS.ySink, material });
      if (left) group.add(left);
      if (right) group.add(right);
    }
    group.userData = { kind: 'oarbSplinePathEdges', sourceTrailId: safe.id, materialKey, collision: 'visual-only paver edging; path support surface handles walkability without curb snagging' };
    groups.push(group);
  });
  return groups;
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
    const visualOffset = safe.visualYOffset ?? yOffset;
    const y = terrainSampler.sampleOutdoorY(point.x, point.z) + visualOffset;
    sampledHeights.push(y - visualOffset);
    const half = safe.width * 0.5;
    vertices.push(point.x + normal.x * half, y, point.z + normal.z * half, point.x - normal.x * half, y, point.z - normal.z * half);
    uvs.push(distance / tileLength, 0, distance / tileLength, safe.width / tileWidth);
  });

  for (let index = 0; index < safe.points.length - 1; index += 1) {
    const a = index * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
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
    yOffset: safe.visualYOffset ?? yOffset,
    flattenRequested: safe.flattenRequested,
    collisionNote: safe.pathSupport
      ? 'Visual dirt ribbon; optional generated spline path support may be attached by DungeonScene.'
      : 'Visual dirt ribbon only; this trail intentionally uses terrain/polygon floors for player grounding instead of hidden path support slabs.',
  };
  return mesh;
}

export function createOutdoorSplineTrailMeshes(splineTrails = [], options = {}) {
  if (!Array.isArray(splineTrails)) return [];
  return splineTrails.map((trail) => createOutdoorSplineTrailMesh(trail, options)).filter(Boolean);
}
