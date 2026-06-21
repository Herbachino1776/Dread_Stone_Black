import { expandPondOutlinePerVertex, expandPondOutlineRadially } from './PondCompositeBuilder.js';

const TAU = Math.PI * 2;
const WATER_FRAMES = Object.freeze(
  Array.from({ length: 6 }, (_, index) => `./assets/textures/water/pond/pond_water_anim_0${index + 1}.png`),
);
const ROCK_TEXTURE_POOL = Object.freeze(['pondBoulderRock01', 'pondBoulderRock02', 'pondBoulderRock03', 'pondBoulderRock04']);

function hashSeed(value) {
  const text = String(value ?? 'outdoor-pond');
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

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundWorld(value) {
  return Number(value.toFixed(3));
}

function normalizeRange(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  const min = finite(Number(source[0]), fallback[0]);
  return [min, Math.max(min, finite(Number(source[1]), fallback[1]))];
}

function colorValue(value, fallback) {
  const named = {
    clearBlueGreen: 0x66877c,
    darkGreenBlue: 0x3f6866,
    murkyGreen: 0x6d8061,
    springBlue: 0x6d8d86,
    warmMud: 0xd0a06c,
    paleMud: 0xd7ad79,
    marshMud: 0xc19a67,
  };
  return Number.isFinite(value) ? value : named[value] ?? fallback;
}

function describeRecipe(recipe) {
  return `${recipe.style}: seeded ${recipe.shape.outlinePointCount}-point irregular water outline with bright mud underlay, wet-shore transition, ${recipe.terrain.stampKind} terrain support, low-poly boulders, and non-redwood foliage`;
}

function buildWaterOutline(center, size, shape, random) {
  const count = Math.round(clamp(finite(shape.outlinePointCount, 20), 12, 40));
  const phaseA = random() * TAU;
  const phaseB = random() * TAU;
  const phaseC = random() * TAU;
  const asymmetryDirection = random() * TAU;
  const pinchDirection = finite(shape.pinchDirection, random() * TAU);
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const baseAngle = (index / count) * TAU;
    const angleJitter = (random() - 0.5) * finite(shape.edgeRoughness, 0.06) * (TAU / count);
    const angle = baseAngle + angleJitter;
    const lobes = Math.sin(angle * Math.max(1, Math.round(finite(shape.lobeCount, 2))) + phaseA);
    const bays = Math.max(0, Math.cos(angle * Math.max(1, Math.round(finite(shape.bayCount, 2))) + phaseB));
    const rough = Math.sin(angle * 5 + phaseC) * 0.55 + Math.sin(angle * 9 + phaseA * 0.7) * 0.25 + (random() - 0.5) * 0.9;
    const asymmetry = Math.cos(angle - asymmetryDirection) * finite(shape.asymmetry, 0.1) * 0.28;
    const pinchFacing = Math.max(0, Math.cos(angle - pinchDirection));
    const crescentFacing = Math.max(0, Math.cos(angle - pinchDirection));
    let radialScale = 1
      + lobes * finite(shape.outlineWobble, 0.12) * 0.45
      - bays * finite(shape.outlineWobble, 0.12) * finite(shape.bayCount, 0) * 0.045
      + rough * finite(shape.edgeRoughness, 0.06)
      + Math.sin(angle * 7 + phaseB) * finite(shape.radiusVariation, 0.08) * 0.22
      + asymmetry
      - pinchFacing * pinchFacing * finite(shape.pinchAmount, 0) * 0.38
      - crescentFacing * crescentFacing * finite(shape.crescentBias, 0) * 0.34;
    radialScale = clamp(radialScale, 0.48, 1.42);
    const crescentShift = finite(shape.crescentBias, 0) * size.radiusX * 0.13;
    const ovalBias = clamp(finite(shape.ovalBias, 0), -0.8, 0.8);
    points.push([
      roundWorld(center[0] + Math.cos(angle) * size.radiusX * (1 + ovalBias * 0.12) * radialScale - Math.cos(pinchDirection) * crescentShift),
      roundWorld(center[1] + Math.sin(angle) * size.radiusZ * (1 - ovalBias * 0.08) * radialScale - Math.sin(pinchDirection) * crescentShift),
    ]);
  }
  return points;
}

function variedOffsets(count, base, variation, random) {
  const phase = random() * TAU;
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin((index / count) * TAU * 3 + phase) * 0.55 + (random() - 0.5) * 0.9;
    return roundWorld(Math.max(0.4, base * (1 + wave * variation)));
  });
}

function buildTerrainStamps(recipe, footprint, layers) {
  const { id, label, center, terrain } = recipe;
  const radius = finite(terrain.stampRadius, Math.max(recipe.size.radiusX, recipe.size.radiusZ) + recipe.mud.mudMargin + recipe.wetShore.wetShoreWidth);
  const tags = ['pond-expo', label, recipe.style, 'procedural-pond'];
  const stamps = [];
  const stampKind = terrain.stampKind;
  if (stampKind === 'ravinePlusBasin' || stampKind === 'ravine' || stampKind === 'gully') {
    const path = terrain.gullyPath ?? terrain.stampPath ?? [[center[0] - 4, center[1] - radius - 4], center, [center[0] + 4, center[1] + radius + 4]];
    stamps.push({ id: `${id}_gully`, kind: 'ravine', path, width: finite(terrain.stampWidth, finite(terrain.gullyWidth, 5.2)), depth: finite(terrain.stampDepth, finite(terrain.gullyDepth, 0.32)), tags: [...tags, 'gully'] });
    if (stampKind === 'ravinePlusBasin') stamps.push({ id: `${id}_basin`, kind: 'hollow', center, radius, depth: terrain.basinDepth, tags: [...tags, 'gully-basin'] });
  } else if (stampKind === 'hill' || stampKind === 'outerBank') {
    stamps.push({ id: `${id}_bank_hill`, kind: 'hill', center, radius: finite(terrain.bankHillRadius, radius + 2), height: finite(terrain.bankHillHeight, terrain.bankHeight), tags: [...tags, 'outer-bank'] });
  } else if (stampKind === 'flatten') {
    stamps.push({ id: `${id}_flatten`, kind: 'flatten', center, radius: finite(terrain.flattenRadius, radius), y: layers.outerBankY, tags: [...tags, 'flattened-basin'] });
  } else if (stampKind === 'shelf' || stampKind === 'terraced') {
    stamps.push({ id: `${id}_terrace`, kind: 'flatten', center, radius: finite(terrain.flattenRadius, finite(terrain.shelfRadius, radius + 1.5)), y: layers.outerBankY, tags: [...tags, 'shore-shelf'] });
  } else {
    stamps.push({ id: `${id}_basin`, kind: 'hollow', center, radius: finite(terrain.hollowRadius, radius), depth: finite(terrain.stampDepth, terrain.basinDepth), tags: [...tags, 'basin'] });
  }
  if (terrain.bankHeight > 0.01 && stampKind !== 'hill') {
    stamps.push({ id: `${id}_outer_bank`, kind: 'hill', center, radius: finite(terrain.bankHillRadius, radius + 1.8), height: terrain.bankHeight, tags: [...tags, 'outer-bank'] });
  }
  stamps.push({
    id: `${id}_outline_support`, kind: 'flattenOutline', outline: footprint.terrainSupportOutline,
    sourceOutline: 'outerShoreOutline', derivedFrom: 'waterOutline', expansion: footprint.terrainSafetyMargin,
    feather: Math.max(3.5, finite(terrain.bankSoftness, 0.7) * 6), y: layers.terrainMaxY, tags: [...tags, 'outline-derived-support'],
  });
  stamps.push({
    id: `${id}_water_floor`, kind: 'flattenOutline', outline: footprint.waterOutline,
    sourceOutline: 'waterOutline', derivedFrom: 'waterOutline', expansion: 0,
    feather: finite(terrain.bankSoftness, 0.7) * 0.45, y: layers.waterFloorY, tags: [...tags, 'water-floor'],
  });
  return stamps;
}

function normalizeRecipe(input) {
  const id = String(input.id);
  const label = String(input.label);
  const seed = input.seed ?? id;
  const overallScale = finite(input.size?.overallScale, 1);
  const waterAreaScale = finite(input.size?.waterAreaScale, 1);
  const shoreScale = finite(input.size?.shoreScale, 1);
  const radiusX = finite(input.size?.radiusX, 6) * overallScale * waterAreaScale;
  const radiusZ = finite(input.size?.radiusZ, 5) * overallScale * waterAreaScale;
  return {
    ...input,
    id, label, seed,
    style: input.style ?? 'irregular-natural',
    center: [...input.center],
    size: { radiusX, radiusZ, overallScale, waterAreaScale, shoreScale },
    shape: {
      outlinePointCount: 24, outlineWobble: 0.18, asymmetry: 0.18, ovalBias: 0.1, crescentBias: 0,
      pinchAmount: 0, bayCount: 2, lobeCount: 3, edgeRoughness: 0.08, radiusVariation: 0.1, ...(input.shape ?? {}),
    },
    terrain: {
      stampKind: 'hollow', basinDepth: 0.35, waterFloorY: null, mudBedY: null, outerBankY: 0.02,
      shoreShelfY: null, bankHeight: 0, bankSoftness: 0.7, stampRadius: null, stampDepth: null,
      stampWidth: null, stampPath: null, gullyPath: null, gullyWidth: 5.2, gullyDepth: 0.32,
      shelfRadius: null, flattenRadius: null, hollowRadius: null, bankHillRadius: null, bankHillHeight: null,
      ...(input.terrain ?? {}),
    },
    mud: {
      mudMargin: 1.5, mudBedWidth: null, mudBedBrightness: 1, mudTextureRepeat: [14, 14],
      mudColorTint: 'warmMud', mudYOffset: 0, ...(input.mud ?? {}),
    },
    wetShore: {
      wetShoreWidth: 1, wetShoreDarkness: 0x4b392b, wetShoreTexture: 'mudWetDark', wetShoreOpacity: 1,
      shoreTransitionWidth: 0.8, ...(input.wetShore ?? {}),
    },
    water: {
      waterOpacity: 0.62, waterTint: 'clearBlueGreen', waterRoughness: 0.88, waterEmissiveIntensity: 0.07,
      waterTextureRepeatX: 2.6, waterTextureRepeatZ: 2.4, waterAnimationSpeed: 1, waterPlaybackMode: 'pingPong',
      frameDurationMs: 220, waterYOffset: 0, ...(input.water ?? {}),
    },
    boulders: {
      countRange: [2, 4], size: [0.6, 1.2], boulderScaleVariance: 0.35, boulderRotationVariance: 1,
      clusterChance: 0.3, submergedCountRange: [1, 2], submergedChance: 0.35, waterEdgeChance: 0.45, shoreChance: 0.4, bankChance: 0.15, grassBankChance: 0.15,
      sinkAmount: [0.2, 0.38], sinkAmountRange: [0.2, 0.65], texturePool: [...ROCK_TEXTURE_POOL], ...(input.boulders ?? {}),
    },
    vegetation: {
      bushesRange: [4, 8], smallTreesRange: [1, 3], bushSize: [1.05, 1.9], treeSize: [2.8, 4.6],
      bushClusterChance: 0.5, treeDistanceFromWater: [3.2, 6.8], bushDistanceFromMud: [0.15, 3.8],
      vegetationDensity: 1, vegetationSideBias: null, vegetationRandomYaw: 0.36, vegetationSinkAmount: [0.03, 0.08],
      foliagePool: null, excludeTags: ['redwood'], ...(input.vegetation ?? {}),
    },
    clearances: {
      avoidLabels: true, avoidChests: true, avoidGates: true, avoidPaths: true, avoidWaterInterior: true,
      minPathClearance: 2.5, minLabelClearance: 4, minChestClearance: 4, zones: [], ...(input.clearances ?? {}),
    },
    debug: { enabled: false, showWaterOutline: false, showMudBedOutline: false, showWetShoreOutline: false, showBoulderCandidates: false, showVegetationCandidates: false, showFailedSamples: false, ...(input.debug ?? {}) },
  };
}

export function buildOutdoorPond(input) {
  const recipe = normalizeRecipe(input);
  const random = createRandom(recipe.seed);
  const waterOutline = buildWaterOutline(recipe.center, recipe.size, recipe.shape, random);
  const mudMargin = finite(recipe.mud.mudBedWidth, recipe.mud.mudMargin) * recipe.size.shoreScale;
  const wetShoreWidth = recipe.wetShore.wetShoreWidth * recipe.size.shoreScale;
  const mudOffsets = variedOffsets(waterOutline.length, mudMargin, 0.12 + recipe.shape.edgeRoughness * 0.35, random);
  const shoreOffsets = variedOffsets(waterOutline.length, wetShoreWidth, 0.14 + recipe.shape.edgeRoughness * 0.3, random);
  const mudBedOutline = expandPondOutlinePerVertex(waterOutline, recipe.center, mudOffsets);
  const outerShoreOutline = expandPondOutlinePerVertex(mudBedOutline, recipe.center, shoreOffsets);
  // The Expo terrain grid is intentionally coarse for mobile. Keep the support
  // outline wider than one grid cell so bilinear terrain sampling cannot leak
  // grass up through the generated mud/shore meshes at polygon boundaries.
  const terrainSafetyMargin = Math.max(6, recipe.wetShore.shoreTransitionWidth);
  const terrainSupportOutline = expandPondOutlineRadially(outerShoreOutline, recipe.center, terrainSafetyMargin);
  const waterY = finite(recipe.water.waterSurfaceY, -0.17) + recipe.water.waterYOffset;
  const mudBedY = finite(recipe.terrain.mudBedY, waterY - 0.045) + recipe.mud.mudYOffset;
  const wetShoreY = finite(recipe.terrain.shoreShelfY, mudBedY + 0.004);
  const terrainMaxY = Math.min(mudBedY, wetShoreY) - 0.045;
  const layers = {
    waterY, mudBedY, wetShoreY, terrainMaxY,
    waterFloorY: finite(recipe.terrain.waterFloorY, waterY - recipe.terrain.basinDepth),
    outerBankY: finite(recipe.terrain.outerBankY, 0.02),
  };
  const footprint = {
    recipe: 'per-vertex-expansion-irregular-polygon', center: recipe.center, waterRadius: [recipe.size.radiusX, recipe.size.radiusZ],
    waterOutline, mudBedOutline, outerShoreOutline, mudOffsets, outerShoreOffsets: shoreOffsets,
    mudOffset: mudMargin, outerShoreOffset: 0.4, terrainSupportOutline, terrainSafetyMargin,
    terrainMaxY, minMudMarginWorld: 0.4,
    minVisibleMudBandWorld: 0.4, shorelineSampleStepWorld: 0.25,
    layerHeights: { ...layers, terrainSafetyGap: 0.035, waterAboveMud: waterY - mudBedY }, debug: recipe.debug,
  };
  const terrainStamps = buildTerrainStamps(recipe, footprint, layers);
  const markerOffset = recipe.markerOffset ?? [-6.8, 0, -7.2];
  const clearZones = [...(recipe.clearances.zones ?? [])];
  if (recipe.clearances.avoidLabels) clearZones.push({ id: `${recipe.id}_label_clearance`, center: [recipe.center[0] + markerOffset[0], recipe.center[1] + markerOffset[2]], radius: recipe.clearances.minLabelClearance });
  const waterMaterialKey = `${recipe.id}_water`;
  const mudMaterialKey = `${recipe.id}_bright_mud`;
  const shoreMaterialKey = `${recipe.id}_wet_shore`;
  const body = {
    id: recipe.id, kind: 'pond', center: recipe.center, radius: footprint.waterRadius, y: waterY,
    material: waterMaterialKey, bedMaterial: mudMaterialKey, shoreMaterial: shoreMaterialKey,
    shoreWidth: mudMargin + wetShoreWidth, fishable: Boolean(recipe.fishable), fishSpeciesPool: [...(recipe.fishSpeciesPool ?? [])], fishCatchSeed: `${recipe.seed ?? recipe.id}-catch`,
    footprint,
    pondDecor: {
      seed: recipe.seed,
      boulders: { ...recipe.boulders, countRange: normalizeRange(recipe.boulders.countRange, [2, 4]), texturePool: recipe.boulders.texturePool },
      vegetation: { ...recipe.vegetation, bushesRange: normalizeRange(recipe.vegetation.bushesRange, [4, 8]), smallTreesRange: normalizeRange(recipe.vegetation.smallTreesRange, [1, 3]) },
      aquaticBrush: { clusterCountRange: [2, 5], spritesPerClusterRange: [3, 7], scaleRange: [0.35, 0.75], placement: 'shallow-water-and-mud-edge', excludeTags: ['redwood'], ...(recipe.aquaticBrush ?? {}) },
      clearZones,
      clearFishingLanes: recipe.clearFishingLanes ?? [{ angle: -Math.PI / 2, width: 0.7, reason: 'player approach / casting lane' }],
      clearances: recipe.clearances,
    },
    tags: ['pond-expo', recipe.label, recipe.style, 'procedural-pond', ...(recipe.tags ?? [])],
    userData: {
      pondExpoId: recipe.label, name: recipe.name ?? recipe.style, style: recipe.style, seed: recipe.seed,
      recipe: describeRecipe(recipe), recipeData: recipe, recipeSource: input, generatedBy: 'OutdoorPondBuilder',
      terrainStampIds: terrainStamps.map((stamp) => stamp.id),
      visibleMarker: { id: recipe.markerId ?? `${recipe.id}_marker`, label: recipe.label, offset: markerOffset },
      keeperCandidate: Boolean(recipe.keeperCandidate), futureFishable: Boolean(recipe.futureFishable),
      noDownwardFacingTopNormals: true, usesSquareDecalFallback: false,
      waterMeshSource: 'waterOutline', brightMudMeshSource: 'mudBedOutline', wetShoreMeshSource: 'outerShoreOutline',
      validation: { coordinateBasis: recipe.center, waterInsideMud: true, wetShoreOutsideMud: true, avoidsGrassContact: true, generatedGeometry: footprint },
    },
  };
  const wetShorePaths = { mudWetDark: './assets/textures/outdoor/mud_wet_dark_01.png', mudChurnedWet: './assets/textures/outdoor/mud_churned_wet_03.png' };
  const textures = {
    [waterMaterialKey]: {
      color: colorValue(recipe.water.waterTint, 0x66877c), roughness: recipe.water.waterRoughness, metalness: 0,
      transparent: true, opacity: recipe.water.waterOpacity, emissive: 0x0b1713,
      emissiveIntensity: recipe.water.waterEmissiveIntensity,
      repeat: [recipe.water.waterTextureRepeatX, recipe.water.waterTextureRepeatZ], animatedFrames: [...WATER_FRAMES],
      playbackMode: recipe.water.waterPlaybackMode, frameDurationMs: recipe.water.frameDurationMs / Math.max(0.1, recipe.water.waterAnimationSpeed),
    },
    [mudMaterialKey]: {
      path: './assets/textures/outdoor/mud_churned_wet_03.png', repeat: recipe.mud.mudTextureRepeat,
      color: colorValue(recipe.mud.mudColorTint, 0xd0a06c), roughness: 0.98, metalness: 0,
      emissive: 0x3a260f, emissiveIntensity: 0.08 + recipe.mud.mudBedBrightness * 0.04,
    },
    [shoreMaterialKey]: {
      path: wetShorePaths[recipe.wetShore.wetShoreTexture] ?? recipe.wetShore.wetShoreTexture, repeat: [10, 10], color: colorValue(recipe.wetShore.wetShoreDarkness, 0x4b392b),
      roughness: 1, metalness: 0, transparent: recipe.wetShore.wetShoreOpacity < 1, opacity: recipe.wetShore.wetShoreOpacity,
      emissive: 0x100a07, emissiveIntensity: 0.05,
    },
  };
  return { recipe, body, textures, terrainStamps };
}

export function buildOutdoorPondSystem(recipes = []) {
  const generated = recipes.map(buildOutdoorPond);
  return Object.freeze({
    recipes: Object.freeze(generated.map((entry) => entry.recipe)),
    waterBodies: Object.freeze(generated.map((entry) => entry.body)),
    terrainStamps: Object.freeze(generated.flatMap((entry) => entry.terrainStamps)),
    textures: Object.freeze(Object.assign({}, ...generated.map((entry) => entry.textures))),
  });
}

export const OUTDOOR_POND_WATER_FRAMES = WATER_FRAMES;
export const OUTDOOR_POND_ROCK_TEXTURE_POOL = ROCK_TEXTURE_POOL;
