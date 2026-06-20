import * as THREE from 'three';
import { OUTDOOR_SMALL_FOLIAGE_SPRITES } from './OutdoorFoliageRegistry.js';

const TAU = Math.PI * 2;
const EPSILON = 1e-6;
const DEFAULT_VISIBLE_DISTANCE_SQ = 185 * 185;
export const POND_FOLIAGE_ALPHA_TEST = 0.35;

export const POND_VEGETATION_SPRITES = Object.freeze(
  OUTDOOR_SMALL_FOLIAGE_SPRITES.filter((sprite) => !`${sprite.id} ${sprite.path} ${sprite.type}`.toLowerCase().includes('redwood')),
);

function hashSeed(value) {
  const text = String(value ?? 'pond-decor');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = hashSeed(seed);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function normalizeRange(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  const min = Math.max(0, Math.floor(Number(source?.[0])));
  const max = Math.max(min, Math.floor(Number(source?.[1])));
  return Number.isFinite(min) && Number.isFinite(max) ? [min, max] : fallback;
}

function randomCount(random, range, fallback) {
  const [min, max] = normalizeRange(range, fallback);
  return min + Math.floor(random() * (max - min + 1));
}

function randomBetween(random, range, fallback) {
  const source = Array.isArray(range) ? range : fallback;
  const min = Number.isFinite(Number(source?.[0])) ? Number(source[0]) : fallback[0];
  const max = Math.max(min, Number.isFinite(Number(source?.[1])) ? Number(source[1]) : fallback[1]);
  return min + random() * (max - min);
}

function cross(ax, az, bx, bz) {
  return ax * bz - az * bx;
}

function rayOutlineDistance(center, angle, outline, fallbackRadius) {
  if (!Array.isArray(outline) || outline.length < 3) return fallbackRadius;
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  let nearest = Infinity;
  outline.forEach((point, index) => {
    const next = outline[(index + 1) % outline.length];
    const sx = next[0] - point[0];
    const sz = next[1] - point[1];
    const denominator = cross(dx, dz, sx, sz);
    if (Math.abs(denominator) <= EPSILON) return;
    const px = point[0] - center[0];
    const pz = point[1] - center[1];
    const distance = cross(px, pz, sx, sz) / denominator;
    const segmentT = cross(px, pz, dx, dz) / denominator;
    if (distance > EPSILON && segmentT >= -EPSILON && segmentT <= 1 + EPSILON) nearest = Math.min(nearest, distance);
  });
  return Number.isFinite(nearest) ? nearest : fallbackRadius;
}

function pointAt(center, angle, distance) {
  return [center[0] + Math.cos(angle) * distance, center[1] + Math.sin(angle) * distance];
}

export function pointInPondPolygon(point, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [xi, zi] = polygon[index];
    const [xj, zj] = polygon[previous];
    if (((zi > point[1]) !== (zj > point[1])) && point[0] < ((xj - xi) * (point[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPondDecorClearZone(point, zones = []) {
  return zones.some((zone) => {
    if (Array.isArray(zone?.center) && Number.isFinite(zone.radius)) {
      return Math.hypot(point[0] - zone.center[0], point[1] - zone.center[1]) < zone.radius;
    }
    const bounds = zone?.bounds;
    return bounds && point[0] >= bounds.minX && point[0] <= bounds.maxX && point[1] >= bounds.minZ && point[1] <= bounds.maxZ;
  });
}

function hasClearance(point, placements, minimumDistance) {
  return placements.every((placement) => Math.hypot(point[0] - placement.position[0], point[1] - placement.position[1]) >= minimumDistance);
}

function chooseSprite(random, type, excludeTags, foliagePool) {
  const excluded = (excludeTags ?? []).map((tag) => String(tag).toLowerCase());
  const allowedIds = Array.isArray(foliagePool) && foliagePool.length > 0 ? new Set(foliagePool) : null;
  const pool = POND_VEGETATION_SPRITES.filter((sprite) => sprite.type === type
    && (!allowedIds || allowedIds.has(sprite.id))
    && !excluded.some((tag) => `${sprite.id} ${sprite.path} ${sprite.type}`.toLowerCase().includes(tag)));
  return pool[Math.floor(random() * pool.length) % pool.length];
}

function outlineDistances(pond, angle) {
  const center = pond.center;
  const [rx, rz] = Array.isArray(pond.radius) ? pond.radius : [pond.radius, pond.radius];
  const ellipseRadius = (rx * rz) / Math.max(EPSILON, Math.hypot(rz * Math.cos(angle), rx * Math.sin(angle)));
  const water = rayOutlineDistance(center, angle, pond.footprint?.waterOutline, ellipseRadius);
  const fallbackMudOffset = Number.isFinite(pond.footprint?.mudOffset)
    ? pond.footprint.mudOffset
    : Number.isFinite(pond.shoreWidth) ? pond.shoreWidth * 0.55 : 1.2;
  const mud = rayOutlineDistance(center, angle, pond.footprint?.mudBedOutline, water + Math.max(0, fallbackMudOffset));
  const shore = rayOutlineDistance(center, angle, pond.footprint?.outerShoreOutline, Math.max(mud, ellipseRadius + Math.max(0, pond.shoreWidth ?? 2.5)));
  return { water, mud, shore };
}

function placeWithRetries({ random, pond, placements, clearZones, clusterAngles, clusterChance = 0.5, minimumDistance, distanceFor, makePlacement }) {
  for (let attempt = 0; attempt < 96; attempt += 1) {
    const cluster = clusterAngles[attempt % clusterAngles.length];
    const angle = attempt < 48 && random() < clusterChance ? cluster + (random() - 0.5) * 0.9 : random() * TAU;
    const distances = outlineDistances(pond, angle);
    const distance = distanceFor(distances, attempt);
    const position = pointAt(pond.center, angle, distance);
    if (pointInPondDecorClearZone(position, clearZones) || !hasClearance(position, placements, minimumDistance)) continue;
    const placement = makePlacement(position, angle, distances);
    placements.push(placement);
    return placement;
  }
  return null;
}

export function generatePondDecorPlacements(pond) {
  const recipe = pond?.pondDecor;
  if (!recipe || !Array.isArray(pond.center)) return { boulders: [], vegetation: [] };
  const random = createRandom(recipe.seed ?? pond.id ?? pond.userData?.pondExpoId);
  const clearZones = Array.isArray(recipe.clearZones) ? recipe.clearZones : [];
  const boulders = [];
  const vegetation = [];
  const boulderRecipe = recipe.boulders;
  if (boulderRecipe) {
    const count = randomCount(random, boulderRecipe.countRange, [2, 4]);
    const texturePool = Array.isArray(boulderRecipe.texturePool) ? boulderRecipe.texturePool : [];
    const clusters = [random() * TAU, random() * TAU];
    for (let index = 0; index < count; index += 1) {
      const roll = random();
      const waterEdgeChance = Number.isFinite(boulderRecipe.waterEdgeChance) ? boulderRecipe.waterEdgeChance : 0.2;
      const shoreChance = Number.isFinite(boulderRecipe.shoreChance) ? boulderRecipe.shoreChance : 0.55;
      const placementZone = roll < waterEdgeChance ? 'water-edge' : roll < waterEdgeChance + shoreChance ? 'shoreline' : 'grass-bank';
      placeWithRetries({
        random, pond, placements: boulders, clearZones, clusterAngles: clusters, clusterChance: boulderRecipe.clusterChance ?? 0.3, minimumDistance: 1.15,
        distanceFor: ({ water, mud, shore }) => {
          if (placementZone === 'water-edge') return water + 0.05 + random() * Math.max(0.12, (mud - water) * 0.35);
          if (placementZone === 'shoreline') return mud + 0.08 + random() * Math.max(0.15, shore - mud - 0.12);
          return shore + 0.4 + random() * 2.4;
        },
        makePlacement: (position, angle) => {
          const base = randomBetween(random, boulderRecipe.size, [0.6, 1.2]);
          const scaleVariance = Number.isFinite(boulderRecipe.boulderScaleVariance) ? boulderRecipe.boulderScaleVariance : 0.35;
          const rotationVariance = Number.isFinite(boulderRecipe.boulderRotationVariance) ? boulderRecipe.boulderRotationVariance : 1;
          return {
            id: `${pond.id}_boulder_${String(index + 1).padStart(2, '0')}`,
            kind: 'boulder',
            position,
            angle,
            placementZone,
            partiallySubmerged: placementZone === 'water-edge',
            materialKey: texturePool[Math.floor(random() * texturePool.length) % texturePool.length],
            scale: [base * (1 - scaleVariance * 0.5 + random() * scaleVariance), base * (0.55 + random() * 0.25), base * (1 - scaleVariance * 0.5 + random() * scaleVariance)],
            rotation: [(random() - 0.5) * 0.35 * rotationVariance, random() * TAU, (random() - 0.5) * 0.28 * rotationVariance],
            sinkRatio: randomBetween(random, boulderRecipe.sinkAmount, [0.2, 0.38]),
          };
        },
      });
    }
  }

  const vegetationRecipe = recipe.vegetation;
  if (vegetationRecipe) {
    const bushCount = randomCount(random, vegetationRecipe.bushesRange, [4, 8]);
    const treeCount = randomCount(random, vegetationRecipe.smallTreesRange, [1, 3]);
    const clusters = [random() * TAU, random() * TAU, random() * TAU];
    for (let index = 0; index < bushCount; index += 1) {
      const mudEdge = index === 0;
      const placement = placeWithRetries({
        random, pond, placements: [...boulders, ...vegetation], clearZones, clusterAngles: clusters, clusterChance: vegetationRecipe.bushClusterChance ?? 0.5, minimumDistance: 0.72 / Math.max(0.5, vegetationRecipe.vegetationDensity ?? 1),
        distanceFor: ({ mud, shore }) => {
          const range = vegetationRecipe.bushDistanceFromMud ?? [0.15, 3.8];
          return mudEdge ? mud + randomBetween(random, [range[0], Math.min(range[1], Math.max(range[0], shore - mud - 0.1))], [0.15, 0.8]) : shore + randomBetween(random, [0.5, range[1]], [0.8, 3.8]);
        },
        makePlacement: (position) => {
          const sprite = chooseSprite(random, 'bush', vegetationRecipe.excludeTags, vegetationRecipe.foliagePool);
          return {
            id: `${pond.id}_bush_${String(index + 1).padStart(2, '0')}`,
            kind: 'vegetation', layer: 'bush', placementZone: mudEdge ? 'mud-edge' : 'outer-bank', position,
            spriteId: sprite?.id, spritePath: sprite?.path, width: sprite?.width, scale: randomBetween(random, vegetationRecipe.bushSize, [1.05, 1.9]),
            sinkRatio: randomBetween(random, vegetationRecipe.vegetationSinkAmount, [0.03, 0.08]), yawOffset: (random() - 0.5) * (vegetationRecipe.vegetationRandomYaw ?? 0.36),
          };
        },
      });
      if (placement) vegetation.push(placement);
    }
    for (let index = 0; index < treeCount; index += 1) {
      const placement = placeWithRetries({
        random, pond, placements: [...boulders, ...vegetation], clearZones, clusterAngles: clusters.slice().reverse(), minimumDistance: 1.55,
        distanceFor: ({ shore }) => shore + randomBetween(random, vegetationRecipe.treeDistanceFromWater, [3.2, 6.8]),
        makePlacement: (position) => {
          const sprite = chooseSprite(random, 'tree', vegetationRecipe.excludeTags, vegetationRecipe.foliagePool);
          return {
            id: `${pond.id}_small_tree_${String(index + 1).padStart(2, '0')}`,
            kind: 'vegetation', layer: 'small-tree', placementZone: 'nearby-grass', position,
            spriteId: sprite?.id, spritePath: sprite?.path, width: sprite?.width, scale: randomBetween(random, vegetationRecipe.treeSize, [2.8, 4.6]),
            sinkRatio: randomBetween(random, vegetationRecipe.vegetationSinkAmount, [0.03, 0.08]), yawOffset: (random() - 0.5) * (vegetationRecipe.vegetationRandomYaw ?? 0.36),
          };
        },
      });
      if (placement) vegetation.push(placement);
    }
  }
  return { boulders, vegetation };
}

function createBoulderMaterial(materialKey, textures, makeMaterial) {
  const profile = textures?.[materialKey] ?? { color: 0x68645c, roughness: 0.99, metalness: 0 };
  const material = makeMaterial?.(profile, { materialKey, profile, usedFallback: !textures?.[materialKey] })
    ?? new THREE.MeshStandardMaterial({ color: profile.color, roughness: profile.roughness, metalness: profile.metalness });
  material.name = `OARB-pond-boulder-material-${materialKey}`;
  return material;
}

export function createPondDecorGroup(pond, { terrainSampler, textures = {}, makeMaterial, loadFoliageTexture } = {}) {
  if (typeof terrainSampler?.sampleOutdoorY !== 'function' || !pond?.pondDecor) return null;
  const placements = generatePondDecorPlacements(pond);
  const group = new THREE.Group();
  group.name = `OARB-pond-decor-${pond.id}`;
  group.userData = { id: pond.id, kind: 'pondDecor', seed: pond.pondDecor.seed ?? pond.id, placements };
  const boulderGeometry = new THREE.DodecahedronGeometry(1, 1);
  const boulderMaterials = new Map();
  placements.boulders.forEach((placement) => {
    if (!boulderMaterials.has(placement.materialKey)) boulderMaterials.set(placement.materialKey, createBoulderMaterial(placement.materialKey, textures, makeMaterial));
    const mesh = new THREE.Mesh(boulderGeometry, boulderMaterials.get(placement.materialKey));
    const [x, z] = placement.position;
    mesh.name = `OARB-${placement.id}`;
    mesh.position.set(x, terrainSampler.sampleOutdoorY(x, z) + placement.scale[1] * (1 - placement.sinkRatio), z);
    mesh.scale.set(...placement.scale);
    mesh.rotation.set(...placement.rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { ...placement, sourcePondId: pond.id, collision: 'visual-only pond boulder' };
    group.add(mesh);
  });

  const foliageMaterials = new Map();
  placements.vegetation.forEach((placement) => {
    if (!foliageMaterials.has(placement.spriteId)) {
      const map = loadFoliageTexture?.(placement.spritePath);
      const material = new THREE.SpriteMaterial({
        ...(map ? { map } : {}),
        alphaTest: POND_FOLIAGE_ALPHA_TEST,
        depthTest: true,
        depthWrite: true,
        transparent: false,
        toneMapped: false,
      });
      material.name = `${placement.spriteId}-pond-alpha-cutout-depth-billboard-material`;
      material.userData = {
        ...(material.userData ?? {}),
        pondFoliageAlphaCutout: true,
        occludesTransparentPondWater: true,
      };
      if (material.alphaTest < POND_FOLIAGE_ALPHA_TEST || !material.depthTest || !material.depthWrite || material.transparent) throw new Error(`Pond vegetation billboard ${placement.spriteId} must use alpha-cutout depth-writing material.`);
      foliageMaterials.set(placement.spriteId, material);
    }
    const sprite = new THREE.Sprite(foliageMaterials.get(placement.spriteId));
    const [x, z] = placement.position;
    const sinkDepth = placement.scale * placement.sinkRatio;
    sprite.name = `OARB-${placement.id}-${placement.spriteId}`;
    sprite.position.set(x, terrainSampler.sampleOutdoorY(x, z) + placement.scale * 0.5 - sinkDepth, z);
    sprite.scale.set(placement.scale * placement.width, placement.scale, 1);
    sprite.userData = { ...placement, sourcePondId: pond.id, billboard: true, alphaCutoutDepthWrite: true, visibleDistanceSq: DEFAULT_VISIBLE_DISTANCE_SQ, collision: 'none' };
    group.add(sprite);
  });
  return group;
}

export function createPondDecorGroups(waterBodies = [], options = {}) {
  if (!Array.isArray(waterBodies)) return [];
  return waterBodies.map((pond) => createPondDecorGroup(pond, options)).filter(Boolean);
}
