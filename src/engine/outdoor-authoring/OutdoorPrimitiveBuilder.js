import * as THREE from 'three';
import { OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE } from './OutdoorTerrainBuilder.js';

export const OARB_OUTDOOR_PRIMITIVE_KINDS = Object.freeze(['cliffWall', 'rootWall', 'fallenTreeBarrier', 'boulderCluster']);
export const OARB_OUTDOOR_PRIMITIVE_MAX_POINTS = 64;
export const OARB_OUTDOOR_PRIMITIVE_MAX_COORDINATE = 2000;
export const OARB_OUTDOOR_PRIMITIVE_MAX_HEIGHT = 80;
export const OARB_OUTDOOR_PRIMITIVE_MAX_THICKNESS = 80;
export const OARB_OUTDOOR_PRIMITIVE_MAX_RADIUS = 80;
export const OARB_OUTDOOR_PRIMITIVE_Y_OFFSET = 0.045;

export const OARB_OUTDOOR_PRIMITIVE_FALLBACK_MATERIAL_PROFILES = Object.freeze({
  rockWall: Object.freeze({ path: './assets/textures/wall_black_stone_01.png', repeat: [2.5, 1.5], color: 0x514d49, roughness: 0.98, metalness: 0.0, emissive: 0x12100f, emissiveIntensity: 0.08 }),
  stoneOutcrop: Object.freeze({ path: './assets/textures/wall_black_stone_01.png', repeat: [1.4, 1.2], color: 0x68645c, roughness: 0.99, metalness: 0.0, emissive: 0x141210, emissiveIntensity: 0.06 }),
  darkRoot: Object.freeze({ path: './assets/textures/outdoor/field_dead_grass_01.png', repeat: [2.0, 1.0], color: 0x2a160f, roughness: 1.0, metalness: 0.0, emissive: 0x090403, emissiveIntensity: 0.05 }),
});

function finitePoint(value) {
  const x = Number(value?.x ?? value?.[0]);
  const z = Number(value?.z ?? value?.[1]);
  return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function resolvePrimitiveMaterialProfile(materialKey, textures = {}) {
  const requestedKey = typeof materialKey === 'string' && materialKey.trim() ? materialKey : 'rockWall';
  const profile = textures[requestedKey] ?? OARB_OUTDOOR_PRIMITIVE_FALLBACK_MATERIAL_PROFILES[requestedKey] ?? OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE;
  return { materialKey: requestedKey, profile, usedFallback: !textures[requestedKey] };
}

function makePrimitiveMaterial(materialKey, textures, makeMaterial) {
  const { profile, usedFallback } = resolvePrimitiveMaterialProfile(materialKey, textures);
  const material = typeof makeMaterial === 'function'
    ? makeMaterial({ ...OARB_TERRAIN_FALLBACK_MATERIAL_PROFILE, ...profile, repeat: profile.repeat ?? [1, 1] }, { materialKey, profile, usedFallback })
    : new THREE.MeshStandardMaterial({ color: profile.color ?? 0x66615a, roughness: profile.roughness ?? 0.98, metalness: profile.metalness ?? 0 });
  material.name = material.name || `OARB-outdoor-primitive-material-${materialKey}`;
  return { material, usedFallback };
}

function segmentTransform(mesh, from, to, y, thickness, height) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  mesh.position.set((from.x + to.x) * 0.5, y + height * 0.5 + OARB_OUTDOOR_PRIMITIVE_Y_OFFSET, (from.z + to.z) * 0.5);
  mesh.rotation.y = Math.atan2(dx, dz);
  mesh.scale.set(thickness, height, length);
  return length;
}

function addPolylineWall(group, safe, material, terrainSampler, { organic = false } = {}) {
  for (let i = 0; i < safe.points.length - 1; i += 1) {
    const from = safe.points[i];
    const to = safe.points[i + 1];
    const y = Math.min(terrainSampler.sampleOutdoorY(from.x, from.z), terrainSampler.sampleOutdoorY(to.x, to.z));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 1, 1, 2), material);
    segmentTransform(mesh, from, to, y, safe.thickness, safe.height);
    mesh.name = `${group.name}-segment-${i}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const detailCount = organic ? Math.min(5, Math.max(2, Math.ceil(length / 12))) : Math.min(6, Math.max(2, Math.ceil(length / 16)));
    for (let j = 0; j < detailCount; j += 1) {
      const t = (j + 0.5) / detailCount;
      const x = THREE.MathUtils.lerp(from.x, to.x, t);
      const z = THREE.MathUtils.lerp(from.z, to.z, t);
      const detailY = terrainSampler.sampleOutdoorY(x, z) + safe.height * (organic ? 0.35 : 0.54) + OARB_OUTDOOR_PRIMITIVE_Y_OFFSET;
      const lumpGeometry = organic ? new THREE.CapsuleGeometry(0.45, 1.2, 3, 6) : new THREE.DodecahedronGeometry(0.8, 0);
      const lump = new THREE.Mesh(lumpGeometry, material);
      lump.name = `${group.name}-rough-visible-detail-${i}-${j}`;
      lump.position.set(x, detailY, z);
      lump.rotation.set(0.25 * (j % 2), Math.atan2(to.x - from.x, to.z - from.z) + (organic ? 0.35 : 0), 0.12 * ((j % 3) - 1));
      const scale = organic ? safe.thickness * 0.55 : safe.thickness * 0.72;
      lump.scale.set(scale, safe.height * (organic ? 0.42 : 0.34), scale * 0.75);
      lump.castShadow = true;
      lump.receiveShadow = true;
      group.add(lump);
    }
  }
}

function assertObjectGeometrySafe(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    const position = object.geometry?.attributes?.position;
    const uv = object.geometry?.attributes?.uv;
    if (!position || position.count === 0) throw new Error(`OARB outdoor primitive ${root.userData.id} generated invalid geometry.`);
    for (let index = 0; index < position.count; index += 1) {
      if (!Number.isFinite(position.getX(index)) || !Number.isFinite(position.getY(index)) || !Number.isFinite(position.getZ(index))) throw new Error(`OARB outdoor primitive ${root.userData.id} generated non-finite position at ${index}.`);
    }
    if (uv) {
      for (let index = 0; index < uv.count; index += 1) {
        if (!Number.isFinite(uv.getX(index)) || !Number.isFinite(uv.getY(index))) throw new Error(`OARB outdoor primitive ${root.userData.id} generated non-finite UV at ${index}.`);
      }
    }
  });
}

function makeGroup(safe, source, materialKey, materialFallbackUsed) {
  const group = new THREE.Group();
  group.name = `OARB-outdoor-primitive-${safe.id}`;
  group.userData = {
    kind: safe.kind,
    id: safe.id,
    authoringRuntime: 'OARB',
    materialKey,
    materialFallbackUsed,
    points: source.points?.map((point) => [...point]),
    from: source.from ? [...source.from] : undefined,
    to: source.to ? [...source.to] : undefined,
    center: source.center ? [...source.center] : undefined,
    height: safe.height,
    thickness: safe.thickness,
    radius: safe.radius,
    pairedCollisionNote: 'Pair with curvedBlockers.visibleStructureId using this primitive id; no collision is generated here.',
    visibleBoundaryNote: 'Generated OARB visible outdoor boundary scaffold follows sampled terrain.',
    collisionNote: 'No collision is generated from OARB outdoor primitives yet.',
  };
  return group;
}

function sanitizePrimitive(primitive) {
  const id = typeof primitive?.id === 'string' && primitive.id.trim() ? primitive.id : null;
  const kind = primitive?.kind;
  if (!id || !OARB_OUTDOOR_PRIMITIVE_KINDS.includes(kind)) return null;
  const materialKey = typeof primitive.material === 'string' && primitive.material.trim() ? primitive.material : (kind === 'boulderCluster' ? 'stoneOutcrop' : kind === 'cliffWall' ? 'rockWall' : 'darkRoot');
  if (kind === 'cliffWall' || kind === 'rootWall') {
    const points = Array.isArray(primitive.points) ? primitive.points.map(finitePoint).filter(Boolean) : [];
    if (points.length < 2 || points.length > OARB_OUTDOOR_PRIMITIVE_MAX_POINTS) return null;
    return { id, kind, materialKey, points, height: positive(primitive.height, kind === 'cliffWall' ? 8 : 4), thickness: positive(primitive.thickness, kind === 'cliffWall' ? 3.5 : 2.5) };
  }
  if (kind === 'fallenTreeBarrier') {
    const from = finitePoint(primitive.from);
    const to = finitePoint(primitive.to);
    if (!from || !to) return null;
    return { id, kind, materialKey, from, to, radius: positive(primitive.radius, 1.8) };
  }
  const center = finitePoint(primitive.center);
  if (!center) return null;
  return { id, kind, materialKey, center, radius: positive(primitive.radius, 4) };
}

export function createOutdoorPrimitive(primitive, { terrainSampler, textures = {}, makeMaterial } = {}) {
  const safe = sanitizePrimitive(primitive);
  if (!safe || typeof terrainSampler?.sampleOutdoorY !== 'function') return null;
  const { material, usedFallback } = makePrimitiveMaterial(safe.materialKey, textures, makeMaterial);
  const group = makeGroup(safe, primitive, safe.materialKey, usedFallback);
  if (safe.kind === 'cliffWall') addPolylineWall(group, safe, material, terrainSampler, { organic: false });
  if (safe.kind === 'rootWall') addPolylineWall(group, safe, material, terrainSampler, { organic: true });
  if (safe.kind === 'fallenTreeBarrier') {
    const y0 = terrainSampler.sampleOutdoorY(safe.from.x, safe.from.z);
    const y1 = terrainSampler.sampleOutdoorY(safe.to.x, safe.to.z);
    const length = Math.hypot(safe.to.x - safe.from.x, safe.to.z - safe.from.z);
    const geometry = new THREE.CylinderGeometry(safe.radius, safe.radius * 1.08, length, 10, 1, false);
    geometry.rotateX(Math.PI / 2);
    const trunk = new THREE.Mesh(geometry, material);
    trunk.name = `${group.name}-trunk`;
    trunk.position.set((safe.from.x + safe.to.x) * 0.5, (y0 + y1) * 0.5 + safe.radius + OARB_OUTDOOR_PRIMITIVE_Y_OFFSET, (safe.from.z + safe.to.z) * 0.5);
    trunk.rotation.y = Math.atan2(safe.to.x - safe.from.x, safe.to.z - safe.from.z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);
  }
  if (safe.kind === 'boulderCluster') {
    const offsets = [[0, 0, 1], [0.58, 0.18, 0.72], [-0.46, 0.24, 0.58], [0.12, -0.54, 0.48]];
    offsets.forEach(([ox, oz, scale], index) => {
      const x = safe.center.x + ox * safe.radius;
      const z = safe.center.z + oz * safe.radius;
      const r = safe.radius * scale * 0.42;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), material);
      stone.name = `${group.name}-stone-${index}`;
      stone.position.set(x, terrainSampler.sampleOutdoorY(x, z) + r * 0.72 + OARB_OUTDOOR_PRIMITIVE_Y_OFFSET, z);
      stone.scale.set(1.15, 0.72 + index * 0.08, 0.92);
      stone.rotation.set(0.17 * index, 0.8 * index, 0.11 * (index - 1));
      stone.castShadow = true;
      stone.receiveShadow = true;
      group.add(stone);
    });
  }
  assertObjectGeometrySafe(group);
  return group;
}

export function createOutdoorPrimitiveMeshes(outdoorPrimitives = [], options = {}) {
  if (!Array.isArray(outdoorPrimitives)) return [];
  return outdoorPrimitives.map((primitive) => createOutdoorPrimitive(primitive, options)).filter(Boolean);
}
