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

function polygonSignedArea(points) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function sampleShorelinePoint(random, outline, center) {
  if (!Array.isArray(outline) || outline.length < 3) return null;
  const index = Math.floor(random() * outline.length) % outline.length;
  const point = outline[index];
  const next = outline[(index + 1) % outline.length];
  const t = random();
  const edgePoint = [point[0] + (next[0] - point[0]) * t, point[1] + (next[1] - point[1]) * t];
  const dx = next[0] - point[0];
  const dz = next[1] - point[1];
  const length = Math.max(EPSILON, Math.hypot(dx, dz));
  const orientation = polygonSignedArea(outline) >= 0 ? 1 : -1;
  let outward = orientation > 0 ? [dz / length, -dx / length] : [-dz / length, dx / length];
  const away = [edgePoint[0] - center[0], edgePoint[1] - center[1]];
  if (outward[0] * away[0] + outward[1] * away[1] < 0) outward = [-outward[0], -outward[1]];
  return { edgePoint, outward, inward: [-outward[0], -outward[1]], angle: Math.atan2(edgePoint[1] - center[1], edgePoint[0] - center[0]) };
}

function offsetPoint(edgeSample, offset) {
  const direction = offset >= 0 ? edgeSample.outward : edgeSample.inward;
  const distance = Math.abs(offset);
  return [edgeSample.edgePoint[0] + direction[0] * distance, edgeSample.edgePoint[1] + direction[1] * distance];
}

function pointInFishingLane(point, pond, lanes = []) {
  return lanes.some((lane) => {
    const angle = Number(lane.angle);
    const width = Number(lane.width ?? 0.55);
    if (!Number.isFinite(angle) || !Number.isFinite(width)) return false;
    const pointAngle = Math.atan2(point[1] - pond.center[1], point[0] - pond.center[0]);
    const delta = Math.abs(Math.atan2(Math.sin(pointAngle - angle), Math.cos(pointAngle - angle)));
    return delta < width * 0.5;
  });
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
    let position;
    let edgeSample = null;
    const distance = distanceFor(distances, attempt);
    if (distance && typeof distance === 'object' && Number.isFinite(distance.edgeOffset)) {
      edgeSample = sampleShorelinePoint(random, pond.footprint?.waterOutline, pond.center);
      if (!edgeSample) continue;
      position = offsetPoint(edgeSample, distance.edgeOffset);
    } else {
      position = pointAt(pond.center, angle, distance);
    }
    if (pointInPondDecorClearZone(position, clearZones) || pointInFishingLane(position, pond, pond.pondDecor?.clearFishingLanes) || !hasClearance(position, placements, minimumDistance)) continue;
    const placement = makePlacement(position, edgeSample?.angle ?? angle, distances, edgeSample);
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
      const submergedTarget = randomCount(random, boulderRecipe.submergedCountRange, [1, 2]);
      const submergedChance = Number.isFinite(boulderRecipe.submergedChance) ? boulderRecipe.submergedChance : 0.35;
      const waterEdgeChance = Number.isFinite(boulderRecipe.waterEdgeChance) ? boulderRecipe.waterEdgeChance : 0.45;
      const shoreChance = Number.isFinite(boulderRecipe.shoreChance) ? boulderRecipe.shoreChance : 0.4;
      const placementZone = index < submergedTarget || roll < submergedChance ? 'submerged' : roll < submergedChance + waterEdgeChance ? 'water-edge' : roll < submergedChance + waterEdgeChance + shoreChance ? 'shoreline' : 'grass-bank';
      placeWithRetries({
        random, pond, placements: boulders, clearZones, clusterAngles: clusters, clusterChance: boulderRecipe.clusterChance ?? 0.3, minimumDistance: 1.15,
        distanceFor: ({ water, mud, shore }) => {
          if (placementZone === 'submerged') return { edgeOffset: -randomBetween(random, [0.25, 1.15], [0.25, 1.15]) };
          if (placementZone === 'water-edge') return { edgeOffset: randomBetween(random, [0.05, Math.max(0.18, mud - water)], [0.05, 1.1]) };
          if (placementZone === 'shoreline') return { edgeOffset: randomBetween(random, [Math.max(0.35, mud - water), Math.max(0.6, shore - water)], [0.7, 2.4]) };
          return { edgeOffset: randomBetween(random, [Math.max(1.2, shore - water), Math.max(1.8, shore - water + 2.4)], [1.8, 4.2]) };
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
            partiallySubmerged: placementZone === 'submerged',
            materialKey: texturePool[Math.floor(random() * texturePool.length) % texturePool.length],
            scale: [base * (1 - scaleVariance * 0.5 + random() * scaleVariance), base * (0.55 + random() * 0.25), base * (1 - scaleVariance * 0.5 + random() * scaleVariance)],
            rotation: [(random() - 0.5) * 0.35 * rotationVariance, random() * TAU, (random() - 0.5) * 0.28 * rotationVariance],
            sinkRatio: placementZone === 'submerged' ? randomBetween(random, boulderRecipe.sinkAmountRange, [0.2, 0.65]) : randomBetween(random, boulderRecipe.sinkAmount, [0.2, 0.38]),
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
            spriteId: sprite?.id, spritePath: sprite?.path, width: sprite?.width, groundOffset: sprite?.groundOffset ?? 0, rootOffsetY: sprite?.rootOffsetY ?? 0, bottomTransparentPaddingRatio: sprite?.bottomTransparentPaddingRatio ?? 0, scale: randomBetween(random, vegetationRecipe.bushSize, [1.05, 1.9]),
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
            spriteId: sprite?.id, spritePath: sprite?.path, width: sprite?.width, groundOffset: sprite?.groundOffset ?? 0, rootOffsetY: sprite?.rootOffsetY ?? 0, bottomTransparentPaddingRatio: sprite?.bottomTransparentPaddingRatio ?? 0, scale: randomBetween(random, vegetationRecipe.treeSize, [2.8, 4.6]),
            sinkRatio: randomBetween(random, vegetationRecipe.vegetationSinkAmount, [0.03, 0.08]), yawOffset: (random() - 0.5) * (vegetationRecipe.vegetationRandomYaw ?? 0.36),
          };
        },
      });
      if (placement) vegetation.push(placement);
    }
  }
  const aquaticRecipe = recipe.aquaticBrush;
  if (aquaticRecipe) {
    const clusterCount = randomCount(random, aquaticRecipe.clusterCountRange, [2, 5]);
    for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
      const edgeSample = sampleShorelinePoint(random, pond.footprint?.waterOutline, pond.center);
      if (!edgeSample) continue;
      const sprites = randomCount(random, aquaticRecipe.spritesPerClusterRange, [3, 7]);
      for (let spriteIndex = 0; spriteIndex < sprites; spriteIndex += 1) {
        const offset = randomBetween(random, [-0.65, 0.95], [-0.65, 0.95]);
        const along = (random() - 0.5) * 1.2;
        const tangent = [-edgeSample.outward[1], edgeSample.outward[0]];
        const base = offsetPoint(edgeSample, offset);
        const position = [base[0] + tangent[0] * along, base[1] + tangent[1] * along];
        if (pointInPondDecorClearZone(position, clearZones) || pointInFishingLane(position, pond, recipe.clearFishingLanes) || !hasClearance(position, [...boulders, ...vegetation], 0.28)) continue;
        const sprite = chooseSprite(random, 'bush', aquaticRecipe.excludeTags, aquaticRecipe.foliagePool);
        vegetation.push({
          id: `${pond.id}_aquatic_brush_${String(clusterIndex + 1).padStart(2, '0')}_${String(spriteIndex + 1).padStart(2, '0')}`,
          kind: 'vegetation', layer: 'aquatic-brush', placementZone: offset < 0 ? 'shallow-water-edge' : 'wet-mud-edge', position,
          spriteId: sprite?.id, spritePath: sprite?.path, width: sprite?.width, groundOffset: sprite?.groundOffset ?? 0, rootOffsetY: sprite?.rootOffsetY ?? 0, bottomTransparentPaddingRatio: sprite?.bottomTransparentPaddingRatio ?? 0, scale: randomBetween(random, aquaticRecipe.scaleRange, [0.35, 0.75]),
          sinkRatio: randomBetween(random, [0.12, 0.28], [0.12, 0.28]), yawOffset: (random() - 0.5) * 0.55,
        });
      }
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

export function createPondDecorGroup(pond, { terrainSampler, textures = {}, makeMaterial, makeFoliageMaterial, loadFoliageTexture } = {}) {
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
  const foliageGeometry = new THREE.PlaneGeometry(1, 1);
  placements.vegetation.forEach((placement) => {
    if (!foliageMaterials.has(placement.spriteId)) {
      const map = loadFoliageTexture?.(placement.spritePath);
      const material = makeFoliageMaterial?.(map, {
        alphaTest: POND_FOLIAGE_ALPHA_TEST,
        name: `${placement.spriteId}-pond-alpha-cutout-depth-billboard-material`,
      }) ?? new THREE.MeshLambertMaterial({ map, color: 0xffffff, alphaTest: POND_FOLIAGE_ALPHA_TEST, side: THREE.DoubleSide, transparent: false, depthTest: true, depthWrite: true, fog: true, toneMapped: true });
      material.name = `${placement.spriteId}-pond-alpha-cutout-depth-billboard-material`;
      material.userData = {
        ...(material.userData ?? {}),
        outdoorFoliage: material.userData?.outdoorFoliage ?? { baseColor: new THREE.Color(0xffffff) },
        pondFoliageAlphaCutout: true,
        occludesTransparentPondWater: true,
      };
      if (!material.isMeshLambertMaterial || material.toneMapped === false || material.fog === false) throw new Error(`Pond vegetation billboard ${placement.spriteId} must use shared light-reactive outdoor foliage material.`);
      if (material.alphaTest < POND_FOLIAGE_ALPHA_TEST || !material.depthTest || !material.depthWrite || material.transparent) throw new Error(`Pond vegetation billboard ${placement.spriteId} must use alpha-cutout depth-writing material.`);
      foliageMaterials.set(placement.spriteId, material);
    }
    const sprite = new THREE.Mesh(foliageGeometry, foliageMaterials.get(placement.spriteId));
    const [x, z] = placement.position;
    const sinkDepth = placement.scale * placement.sinkRatio;
    const visualBaseOffset = placement.scale * (placement.bottomTransparentPaddingRatio ?? 0);
    const rootOffsetY = placement.rootOffsetY ?? 0;
    const groundOffset = placement.groundOffset ?? 0;
    sprite.name = `OARB-${placement.id}-${placement.spriteId}`;
    sprite.position.set(x, terrainSampler.sampleOutdoorY(x, z) + placement.scale * 0.5 + groundOffset + rootOffsetY - sinkDepth - visualBaseOffset, z);
    sprite.scale.set(placement.scale * placement.width, placement.scale, 1);
    sprite.userData = { ...placement, sourcePondId: pond.id, visualBaseOffset, rootOffsetY, groundOffset, billboard: true, pondFoliageBillboard: true, alphaCutoutDepthWrite: true, visibleDistanceSq: DEFAULT_VISIBLE_DISTANCE_SQ, collision: 'none' };
    group.add(sprite);
  });
  return group;
}

export function createPondDecorGroups(waterBodies = [], options = {}) {
  if (!Array.isArray(waterBodies)) return [];
  return waterBodies.map((pond) => createPondDecorGroup(pond, options)).filter(Boolean);
}
