import { OUTDOOR_REDWOOD_FOLIAGE_SPRITES, OUTDOOR_SMALL_FOLIAGE_SPRITES } from '../../../engine/outdoor-authoring/OutdoorFoliageRegistry.js';

export const FOLSOM_REDWOOD_SOURCE_SPRITES = Object.freeze(OUTDOOR_REDWOOD_FOLIAGE_SPRITES.map((sprite) => sprite.path));

const CEDAR_LIKE_IDS = new Set(['billboard_tree_black_cypress_01', 'billboard_tree_windswept_field_01']);
const UNDERSTORY_IDS = new Set(['billboard_bush_ritual_seedpod_01', 'billboard_bush_dead_scrub_01', 'billboard_bush_dark_bramble_01', 'billboard_tree_gnarled_ritual_01']);

const FOLSOM_FOLIAGE_GROUNDING = Object.freeze({
  redwood: Object.freeze({ bottomTransparentPaddingRatio: 0.055, rootOffsetY: -0.18, groundOffset: -0.06 }),
  cedar: Object.freeze({ bottomTransparentPaddingRatio: 0.04, rootOffsetY: -0.12, groundOffset: -0.04 }),
  rush: Object.freeze({ bottomTransparentPaddingRatio: 0.08, rootOffsetY: -0.045, groundOffset: -0.02 }),
  brush: Object.freeze({ bottomTransparentPaddingRatio: 0.065, rootOffsetY: -0.075, groundOffset: -0.025 }),
  shrub: Object.freeze({ bottomTransparentPaddingRatio: 0.055, rootOffsetY: -0.095, groundOffset: -0.03 }),
});

export const FOLSOM_CEDAR_LIKE_SOURCE_SPRITES = Object.freeze(OUTDOOR_SMALL_FOLIAGE_SPRITES.filter((sprite) => CEDAR_LIKE_IDS.has(sprite.id)).map((sprite) => sprite.path));
export const FOLSOM_UNDERSTORY_SOURCE_SPRITES = Object.freeze(OUTDOOR_SMALL_FOLIAGE_SPRITES.filter((sprite) => UNDERSTORY_IDS.has(sprite.id)).map((sprite) => sprite.path));

const FOLSOM_FOLIAGE_SPRITES_BY_PATH = Object.freeze([...OUTDOOR_REDWOOD_FOLIAGE_SPRITES, ...OUTDOOR_SMALL_FOLIAGE_SPRITES].reduce((lookup, sprite) => ({ ...lookup, [sprite.path]: sprite }), {}));

const FOLSOM_FOLIAGE_SIZE_BANDS = Object.freeze({
  redwood: Object.freeze([
    ['young', { height: 7.6, widthScale: 0.47, weight: 1.1, scaleJitter: 0.11 }],
    ['tall', { height: 10.2, widthScale: 0.5, weight: 1.35, scaleJitter: 0.1 }],
    ['giant', { height: 13.4, widthScale: 0.52, weight: 0.95, scaleJitter: 0.09 }],
    ['ancient', { height: 16.2, widthScale: 0.54, weight: 0.42, scaleJitter: 0.08 }],
  ]),
  cedar: Object.freeze([
    ['small', { height: 5.2, widthScale: 0.58, weight: 1.2, scaleJitter: 0.13 }],
    ['medium', { height: 6.8, widthScale: 0.6, weight: 1.4, scaleJitter: 0.12 }],
    ['tall', { height: 8.6, widthScale: 0.62, weight: 0.75, scaleJitter: 0.1 }],
  ]),
  understory: Object.freeze([
    ['rush', { height: 1.45, widthScale: 0.95, weight: 1.35, scaleJitter: 0.18 }],
    ['brush', { height: 2.05, widthScale: 1.08, weight: 1.2, scaleJitter: 0.16 }],
    ['shrub', { height: 2.85, widthScale: 0.82, weight: 0.55, scaleJitter: 0.15 }],
  ]),
});

const FOLSOM_MAX_BILLBOARD_YAW_OFFSET = 0.18;

function seededRandom(seed) { let state = seed >>> 0; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; }; }
function chooseWeighted(items, random) { const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0); let cursor = random() * total; for (const item of items) { cursor -= item.weight ?? 1; if (cursor <= 0) return item; } return items.at(-1); }
function inZone(point, zone) { const [x, z] = point; if (zone.radius) return Math.hypot(x - zone.center[0], z - zone.center[1]) <= zone.radius; if (zone.radiusX && zone.radiusZ) return (((x - zone.center[0]) ** 2) / (zone.radiusX ** 2)) + (((z - zone.center[1]) ** 2) / (zone.radiusZ ** 2)) <= 1; if (zone.minX !== undefined) return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ; return false; }
function inBounds(x, z, bounds) { return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ; }

function groundingFor(layer, band) {
  return FOLSOM_FOLIAGE_GROUNDING[band] ?? FOLSOM_FOLIAGE_GROUNDING[layer] ?? FOLSOM_FOLIAGE_GROUNDING.brush;
}

function createLayerVariants(layer, spritePaths, sizeBands = FOLSOM_FOLIAGE_SIZE_BANDS[layer]) {
  return spritePaths.flatMap((path, spriteIndex) => {
    const sprite = FOLSOM_FOLIAGE_SPRITES_BY_PATH[path];
    return sizeBands.map(([band, metrics]) => Object.freeze({
      id: `folsom_${layer}_${String(spriteIndex + 1).padStart(2, '0')}_${band}`,
      sourceSpriteId: sprite?.id ?? `folsom_${layer}_${String(spriteIndex + 1).padStart(2, '0')}`,
      path,
      band,
      layer,
      type: `folsom-${layer}-billboard`,
      height: metrics.height,
      width: Number((metrics.height * (sprite?.width ?? 0.75) * metrics.widthScale).toFixed(3)),
      scaleJitter: metrics.scaleJitter,
      yawJitter: layer === 'understory' ? 0.34 : FOLSOM_MAX_BILLBOARD_YAW_OFFSET,
      bottomTransparentPaddingRatio: groundingFor(layer, band).bottomTransparentPaddingRatio,
      rootOffsetY: groundingFor(layer, band).rootOffsetY,
      groundOffset: groundingFor(layer, band).groundOffset,
      sinkIntoGround: metrics.sinkIntoGround ?? Math.abs(groundingFor(layer, band).rootOffsetY),
      weight: metrics.weight,
    }));
  });
}

export function createFolsomFoliageBillboardVariants() {
  return Object.freeze([
    ...createLayerVariants('redwood', FOLSOM_REDWOOD_SOURCE_SPRITES),
    ...createLayerVariants('cedar', FOLSOM_CEDAR_LIKE_SOURCE_SPRITES),
    ...createLayerVariants('understory', FOLSOM_UNDERSTORY_SOURCE_SPRITES),
  ]);
}

export function createFolsomFoliageSwathe({ idPrefix, center, radiusX, radiusZ, count, seed = 1, layerMix = { redwood: 1 }, variants, variantWeights = {}, avoidZones = [], terrainSampler, bounds, tags = [] }) {
  const random = seededRandom(seed);
  const layerChoices = Object.entries(layerMix).map(([layer, weight]) => ({ layer, weight }));
  const byLayer = new Map();
  variants.forEach((variant) => {
    if (!byLayer.has(variant.layer)) byLayer.set(variant.layer, []);
    byLayer.get(variant.layer).push({ ...variant, weight: variantWeights[variant.band] ?? variantWeights[variant.layer] ?? variant.weight ?? 1 });
  });
  const placements = [];
  let attempts = 0;
  while (placements.length < count && attempts < count * 120) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    const x = center[0] + Math.cos(angle) * radiusX * radius;
    const z = center[1] + Math.sin(angle) * radiusZ * radius;
    if (bounds && !inBounds(x, z, bounds)) continue;
    if (avoidZones.some((zone) => inZone([x, z], zone))) continue;
    const layer = chooseWeighted(layerChoices, random).layer;
    const variant = chooseWeighted(byLayer.get(layer), random);
    const jitter = 1 + (random() * 2 - 1) * variant.scaleJitter;
    placements.push(Object.freeze({
      id: `${idPrefix}_${String(placements.length + 1).padStart(3, '0')}`,
      variantId: variant.id,
      spritePath: variant.path,
      position: [Number(x.toFixed(3)), Number((terrainSampler?.sampleOutdoorY?.(x, z) ?? 0).toFixed(3)), Number(z.toFixed(3))],
      height: Number((variant.height * jitter).toFixed(3)),
      width: Number((variant.width * jitter).toFixed(3)),
      yawOffset: Number(((random() * 2 - 1) * (variant.yawJitter ?? FOLSOM_MAX_BILLBOARD_YAW_OFFSET)).toFixed(3)),
      bottomTransparentPaddingRatio: variant.bottomTransparentPaddingRatio ?? 0,
      rootOffsetY: variant.rootOffsetY ?? 0,
      groundOffset: variant.groundOffset ?? 0,
      sinkIntoGround: variant.sinkIntoGround,
      layer,
      tags: ['folsom-foliage-billboard', `${layer}-layer`, ...tags],
    }));
  }
  return Object.freeze(placements);
}
