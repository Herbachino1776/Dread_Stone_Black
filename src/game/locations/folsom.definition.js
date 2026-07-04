import { buildOutdoorPondSystem } from '../../engine/outdoor-authoring/OutdoorPondBuilder.js';
import { createOutdoorTerrainSampler } from '../../engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { outdoorTextureProfiles } from './outdoorTextureProfiles.js';
import { terrainStampKit } from './terrainStampKit.js';
import { createCityBorderWoodenWall } from '../world-kits/walls/CityBorderWoodenWallKit.js';
import { createFolsomFoliageBillboardVariants, createFolsomFoliageSwathe } from '../world-kits/vegetation/FolsomFoliageBillboardKit.js';

const folsomPondSystem = buildOutdoorPondSystem([{
  id: 'folsom_starter_pond',
  name: 'Folsom Reed Bank',
  style: 'irregular-natural',
  seed: 17760621,
  center: [0, -58],
  fishable: true,
  // Duplicate early fish entries intentionally weight the established array picker;
  // spineBackFish remains an uncommon catch without introducing a second pool format.
  fishSpeciesPool: ['smallRiverFish', 'smallRiverFish', 'broadCarpFish', 'flatMarshFish', 'spineBackFish'],
  size: { radiusX: 15.2, radiusZ: 11.4, overallScale: 1, waterAreaScale: 1.1, shoreScale: 1 },
  shape: { outlinePointCount: 34, outlineWobble: 0.3, asymmetry: 0.42, ovalBias: 0.28, bayCount: 4, lobeCount: 5, edgeRoughness: 0.15, radiusVariation: 0.18 },
  terrain: { depthProfile: 'starter-terraced', basinDepth: 0.72, pondFloorY: -0.88, shoreShelfDepth: 0.14, bankHeight: 0.09, bankSlope: 0.48, stampKind: 'terraced', shelfRadius: 20.5, bankSoftness: 0.58, centerDepthBias: 0.55 },
  mud: { mudMargin: 1.15, mudBedBrightness: 1.24, mudTextureRepeat: [15, 12], mudColorTint: 'paleMud' },
  wetShore: { wetShoreWidth: 0.68, wetShoreDarkness: 0x44352a, shoreTransitionWidth: 1.05 },
  water: { waterOpacity: 0.62, waterTint: 0x52766f, waterPlaybackMode: 'pingPong', frameDurationMs: 235, waterTextureRepeatX: 3.2, waterTextureRepeatZ: 2.5 },
  boulders: { countRange: [4, 6], size: [0.65, 1.55], waterEdgeChance: 0.48, shoreChance: 0.42, clusterChance: 0.36 },
  vegetation: {
    bushesRange: [18, 24], smallTreesRange: [2, 3], bushClusterChance: 0.76, vegetationDensity: 1.45,
    foliagePool: ['billboard_bush_ritual_seedpod_01', 'billboard_bush_dead_scrub_01', 'billboard_bush_dark_bramble_01', 'billboard_tree_black_cypress_01'],
    bushSize: [0.95, 2.15], treeSize: [2.8, 4.9], vegetationSinkAmount: [0.06, 0.13], keepCastingLaneClear: true,
  },
  aquaticBrush: {
    clusterCountRange: [6, 8], spritesPerClusterRange: [5, 9], scaleRange: [0.52, 1.05], placement: 'shallow-water-and-mud-edge',
    foliagePool: ['billboard_bush_ritual_seedpod_01', 'billboard_bush_dead_scrub_01', 'billboard_bush_dark_bramble_01'], excludeTags: ['redwood', 'pine'],
  },
  clearFishingLanes: [{ angle: 0, width: 0.82, reason: 'clear north-bank starter casting lane' }],
}]);

const FOLSOM_BORDER_WALL_HEIGHT = 6.1;
const FOLSOM_BORDER_WALL_THICKNESS = 0.65;
const FOLSOM_BORDER_WALL_PANEL_LENGTH = 5.75;
const FOLSOM_BORDER_WALL_MATERIALS = Object.freeze([
  'cityBorderWoodenWall01',
  'cityBorderWoodenWall02',
  'cityBorderWoodenWall03',
  'cityBorderWoodenWall04',
  'cityBorderWoodenWall05',
  'cityBorderWoodenWall06',
]);
const FOLSOM_BORDER_WALL_PERIMETER = Object.freeze([
  [-92, -86], [-58, -96], [8, -94], [68, -88], [94, -54], [94, -12], [88, -2], [88, 10],
  [90, 20], [78, 72], [34, 96], [9, 96], [-9, 96], [-18, 96], [-76, 76], [-96, 28], [-96, -38], [-92, -86],
]);
const FOLSOM_BORDER_WALL_GATES = Object.freeze([
  { id: 'folsom_reliquary_palisade_gate', center: [88, 4], width: 12, tolerance: 8, routeId: 'folsom_rusted_reliquary_door' },
  { id: 'folsom_north_future_road_gate', center: [0, 96], width: 18, tolerance: 10, routeId: 'folsom_north_future_road' },
]);

const FOLSOM_NATURAL_BOULDER_MATERIAL = 'pondBoulderRock02';
const FOLSOM_NATURAL_BOULDER_MATERIAL_POOL = Object.freeze(['pondBoulderRock01', 'pondBoulderRock02', 'pondBoulderRock03', 'pondBoulderRock04']);

const textures = Object.freeze({
  ...outdoorTextureProfiles,
  ...folsomPondSystem.textures,
  folsomGrass: { ...outdoorTextureProfiles.grassMatted, repeat: [42, 42], color: 0xaab689, emissive: 0x26341b, emissiveIntensity: 0.08 },
  townPath: { ...outdoorTextureProfiles.mudPebblyEarth, repeat: [20, 4], color: 0x9b8461, emissive: 0x20170d, emissiveIntensity: 0.05, worldTileLength: 8, worldTileWidth: 3 },
  courtyardStone: { path: './assets/textures/floor_worn_stone_01.png', repeat: [5, 5], color: 0xaaa698, roughness: 0.97, metalness: 0, emissive: 0x15120e, emissiveIntensity: 0.06 },
  shrineStone: { path: './assets/textures/pack1/floor_limestone_temple_01.png', repeat: [3, 3], color: 0xb9ab86, roughness: 0.98, metalness: 0, emissive: 0x18130b, emissiveIntensity: 0.06 },
  darkStone: { path: './assets/textures/wall_black_stone_01.png', repeat: [2.2, 1.6], color: 0x74736b, roughness: 0.99, metalness: 0, emissive: 0x11100c, emissiveIntensity: 0.05 },
  agedWood: { path: './assets/textures/pack1/wood_dark_aged_01.png', repeat: [2.2, 1.5], color: 0x8b6a49, roughness: 0.96, metalness: 0, emissive: 0x160d08, emissiveIntensity: 0.05 },
  shedRoofWood: { path: './assets/textures/pack1/wood_dark_aged_01.png', repeat: [3.2, 2.4], color: 0x4d4034, roughness: 0.99, metalness: 0, emissive: 0x0b0806, emissiveIntensity: 0.035 },
  rustedIron: { path: './assets/textures/metal_gate_rusted_01.png', repeat: [1.2, 1.6], color: 0x806757, roughness: 0.84, metalness: 0.42, emissive: 0x160b06, emissiveIntensity: 0.06 },
  cityBorderWoodenWall01: { path: './assets/textures/wall/wooden/city_border_wooden_wall_01.png', repeat: [1, 1], roughness: 0.95, metalness: 0 },
  cityBorderWoodenWall02: { path: './assets/textures/wall/wooden/city_border_wooden_wall_02.png', repeat: [1, 1], roughness: 0.95, metalness: 0 },
  cityBorderWoodenWall03: { path: './assets/textures/wall/wooden/city_border_wooden_wall_03.png', repeat: [1, 1], roughness: 0.95, metalness: 0 },
  cityBorderWoodenWall04: { path: './assets/textures/wall/wooden/city_border_wooden_wall_04.png', repeat: [1, 1], roughness: 0.95, metalness: 0 },
  cityBorderWoodenWall05: { path: './assets/textures/wall/wooden/city_border_wooden_wall_05.png', repeat: [1, 1], roughness: 0.95, metalness: 0 },
  cityBorderWoodenWall06: { path: './assets/textures/wall/wooden/city_border_wooden_wall_06.png', repeat: [1, 1], roughness: 0.95, metalness: 0 },
  pondWaterAnimated: {
    color: 0x52766f, roughness: 0.88, metalness: 0, transparent: true, opacity: 0.62,
    emissive: 0x071511, emissiveIntensity: 0.08, repeat: [3.2, 2.5], playbackMode: 'pingPong', frameDurationMs: 235,
    animatedFrames: [1, 2, 3, 4, 5, 6].map((index) => `./assets/textures/water/pond/pond_water_anim_0${index}.png`),
  },
});

const rectFloor = (id, minX, maxX, minZ, maxZ, material, roomId, tags = [], y = 0.188) => ({
  id, points: [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]], y, material, roomId, tags,
});

const folsomTerrain = Object.freeze({
  size: [200, 200], segments: [64, 64], baseY: 0, material: 'folsomGrass',
  heightStamps: [
      terrainStampKit.softTownRise({ id: 'folsom_west_shoulder_hill', center: [-74, 4], radius: 34, height: 2.65, tags: ['terrain-frame', 'large-landform'] }),
      terrainStampKit.softTownRise({ id: 'folsom_southwest_roll', center: [-48, -62], radius: 30, height: 1.15, tags: ['pond-bank-rise', 'large-landform'] }),
      terrainStampKit.softTownRise({ id: 'folsom_east_border_ridge_mass', center: [70, -18], radius: 31, height: 1.55, tags: ['east-border', 'large-landform'] }),
      terrainStampKit.shrineKnoll({ id: 'folsom_shrine_knoll', center: [-42, 38], radius: 30, height: 1.82, tags: ['raised-shrine-knoll', 'landmark-grade', 'large-landform'] }),
      terrainStampKit.softTownRise({ id: 'folsom_underworks_mound', center: [42, 42], radius: 24, height: 1.22, tags: ['embedded-dungeon-entrance', 'large-landform'] }),
      terrainStampKit.pondApproachBasin({ id: 'folsom_pond_lowland_basin', center: [-2, -55], radius: 39, depth: 1.05, tags: ['pond-approach-slope', 'wet-low-ground', 'large-landform'] }),
      terrainStampKit.shallowGully({ id: 'folsom_north_road_shallow_valley', center: [0, 58], radius: 32, depth: 0.48, tags: ['future-road-exit', 'large-landform'] }),
      terrainStampKit.boundaryRidge({ id: 'folsom_reliquary_boundary_rise', path: [[68, -22], [82, -10], [86, 18], [73, 30]], width: 18, height: 1.18, tags: ['boundary-grade', 'rusty-door', 'large-landform'] }),
      terrainStampKit.roadCut({ id: 'folsom_rusty_door_cut', path: [[54, 8], [69, 6], [84, 4]], width: 7.2, depth: 0.44, tags: ['rusty-door', 'boundary-cut'] }),
      terrainStampKit.linearDrainageGully({ id: 'folsom_future_stream_dry_gully', path: [[-9, 18], [-4, 42], [4, 66], [0, 96]], width: 10.5, depth: 0.58, tags: ['future-stream-corridor'] }),
      terrainStampKit.roadCut({ id: 'folsom_cellar_dug_cut', path: [[26, 28], [36, 38], [45, 48]], width: 9, depth: 0.46, tags: ['embedded-dungeon-entrance'] }),
      terrainStampKit.linearDrainageGully({ id: 'folsom_work_yard_drainage_swale', path: [[-52, -48], [-34, -43], [-17, -48], [-2, -56]], width: 7.4, depth: 0.36, tags: ['work-yard-drainage'] }),
      terrainStampKit.shallowGully({ id: 'folsom_courtyard_to_pond_draw', center: [-8, -31], radius: 20, depth: 0.34, tags: ['between-feature-relief', 'pond-route'] }),
      terrainStampKit.softTownRise({ id: 'folsom_courtyard_shrine_roll', center: [-22, 18], radius: 18, height: 0.52, tags: ['between-feature-relief', 'shrine-route'] }),
      terrainStampKit.shallowGully({ id: 'folsom_shrine_underworks_saddle', center: [-2, 40], radius: 22, depth: 0.38, tags: ['between-feature-relief', 'dungeon-route'] }),
      terrainStampKit.softTownRise({ id: 'folsom_house_yard_mound', center: [40, -20], radius: 22, height: 0.74, tags: ['between-feature-relief', 'house-grade'] }),
      terrainStampKit.softTownRise({ id: 'folsom_northeast_between_feature_roll', center: [36, 38], radius: 20, height: 0.42, tags: ['between-feature-relief', 'north-road'] }),
      terrainStampKit.shallowGully({ id: 'folsom_west_courtyard_side_hollow', center: [-44, -8], radius: 18, depth: 0.26, tags: ['between-feature-relief', 'courtyard-edge'] }),
      terrainStampKit.softTownRise({ id: 'folsom_south_campfire_back_roll', center: [6, -34], radius: 18, height: 0.3, tags: ['between-feature-relief', 'campfire-pond'] }),
      terrainStampKit.courtyardShelf({ id: 'folsom_courtyard_pad', center: [0, 0], radius: 18, y: 0.16, tags: ['spawn-courtyard'] }),
      terrainStampKit.buildingPad({ id: 'folsom_tool_shed_pad', center: [-34, -30], radius: 10.5, y: 0.16, tags: ['tool-shed'] }),
      terrainStampKit.buildingPad({ id: 'folsom_shrine_pad', center: [-42, 38], radius: 11.5, y: 0.76, tags: ['shrine'] }),
      terrainStampKit.buildingPad({ id: 'folsom_house_pad', center: [42, -8], radius: 11.5, y: 0.16, tags: ['house'] }),
      terrainStampKit.buildingPad({ id: 'folsom_cellar_pad', center: [42, 42], radius: 10, y: 0.34, tags: ['cellar-gate', 'embedded-entrance-pad'] }),
      terrainStampKit.buildingPad({ id: 'folsom_rusted_door_pad', center: [82, 4], radius: 9.5, y: 0.28, tags: ['legacy-door', 'boundary-shelf'] }),
      terrainStampKit.buildingPad({ id: 'folsom_north_road_pad', center: [0, 86], radius: 9.5, y: -0.06, tags: ['future-road-exit'] }),
      ...folsomPondSystem.terrainStamps,
      ...terrainStampKit.microBumpField({ idPrefix: 'folsom_safe_grass_bump', bumps: [
        { center: [-56, 20], radius: 8, height: 0.18 }, { center: [-28, -8], radius: 7, height: -0.14 },
        { center: [20, -38], radius: 8, height: 0.16 }, { center: [59, -38], radius: 7, height: -0.16 },
        { center: [58, 24], radius: 7, height: 0.2 }, { center: [-15, 58], radius: 8, height: 0.15 },
        { center: [-62, -28], radius: 7, height: -0.12 }, { center: [18, 26], radius: 7, height: 0.14 },
        { center: [30, 58], radius: 8, height: -0.15 }, { center: [-30, -55], radius: 6, height: 0.12 },
      ], tags: ['safe-grass-texture'] }),
  ],
});
const folsomTerrainSampler = createOutdoorTerrainSampler(folsomTerrain);

const folsomFoliageBillboardVariants = createFolsomFoliageBillboardVariants();
const folsomFoliageAvoidZones = Object.freeze([
  { center: [0, 0], radius: 24 }, { center: [0, -7], radius: 10 }, { center: [12, -22], radius: 9 },
  { center: [0, -58], radiusX: 25, radiusZ: 18 }, { center: [-12, -43], radius: 10 },
  { center: [-34, -30], radius: 15 }, { center: [-36, -34], radius: 10 }, { center: [42, -8], radius: 16 },
  { center: [-42, 38], radius: 13 }, { center: [-42, 31], radius: 9 }, { center: [42, 42], radius: 14 },
  { center: [82, 4], radius: 13 }, { center: [88, 4], radius: 12 }, { center: [0, 94], radius: 14 },
  { minX: -8, maxX: 8, minZ: 14, maxZ: 99 }, { minX: 68, maxX: 94, minZ: -6, maxZ: 14 },
  { minX: -7, maxX: 7, minZ: -48, maxZ: 10 }, { minX: -50, maxX: -18, minZ: -42, maxZ: -18 },
  { minX: -48, maxX: -25, minZ: 25, maxZ: 47 }, { minX: 28, maxX: 55, minZ: -24, maxZ: 5 },
]);
export const FOLSOM_VISIBLE_TREE_BOUNDS = Object.freeze({ minX: -96, maxX: 96, minZ: -96, maxZ: 96 });
export const FOLSOM_FOLIAGE_SWATHE_SPECS = Object.freeze([
  { idPrefix: 'folsom_outer_redwood_south', center: [-10, -82], radiusX: 84, radiusZ: 14, count: 56, seed: 177601, layerMix: { redwood: 7, cedar: 2, understory: 2 }, tags: ['outside-wall-forest', 'south-visible-belt'], harvestable: false },
  { idPrefix: 'folsom_outer_redwood_west', center: [-82, -8], radiusX: 13, radiusZ: 78, count: 58, seed: 177602, layerMix: { redwood: 7, cedar: 2, understory: 2 }, tags: ['outside-wall-forest', 'west-visible-belt'], harvestable: false },
  { idPrefix: 'folsom_outer_redwood_east', center: [82, 8], radiusX: 12, radiusZ: 70, count: 54, seed: 177603, layerMix: { redwood: 6, cedar: 3, understory: 2 }, tags: ['outside-wall-forest', 'east-visible-belt', 'rusty-reliquary-ominous'], harvestable: false },
  { idPrefix: 'folsom_outer_redwood_north', center: [0, 82], radiusX: 76, radiusZ: 12, count: 50, seed: 177604, layerMix: { redwood: 6, cedar: 2, understory: 2 }, tags: ['outside-wall-forest', 'north-road-corridor', 'north-visible-belt'], harvestable: false },
  { idPrefix: 'folsom_inside_cedar_redwood_belt', center: [-55, 0], radiusX: 30, radiusZ: 58, count: 46, seed: 177605, layerMix: { redwood: 4, cedar: 3, understory: 2 }, tags: ['inside-edge-tree-belt'], harvestable: false },
  { idPrefix: 'folsom_pond_rush_brush_clusters', center: [22, -66], radiusX: 42, radiusZ: 20, count: 52, seed: 177606, layerMix: { redwood: 1, cedar: 2, understory: 8 }, tags: ['pond-side-rush-brush-cluster'], harvestable: false },
  { idPrefix: 'folsom_pond_west_reed_bank', center: [-23, -61], radiusX: 16, radiusZ: 18, count: 28, seed: 177610, layerMix: { cedar: 1, understory: 9 }, variantWeights: { rush: 2.4, brush: 1.7, shrub: 0.6 }, tags: ['pond-edge-reed-bank'], harvestable: false },
  { idPrefix: 'folsom_southeast_redwood_screen', center: [48, -64], radiusX: 26, radiusZ: 20, count: 34, seed: 177611, layerMix: { redwood: 5, cedar: 3, understory: 2 }, tags: ['inside-edge-tree-belt', 'pond-backdrop-grove'], harvestable: false },
  { idPrefix: 'folsom_shrine_redwood_grove', center: [-58, 54], radiusX: 26, radiusZ: 18, count: 38, seed: 177607, layerMix: { redwood: 7, cedar: 2, understory: 1 }, variantWeights: { tall: 2, giant: 1.8, ancient: 1.4, young: 0.35 }, tags: ['shrine-grove'], harvestable: false, intentionalHarvestableCount: 2 },
  { idPrefix: 'folsom_north_road_cedar_redwoods', center: [24, 62], radiusX: 28, radiusZ: 28, count: 36, seed: 177608, layerMix: { redwood: 4, cedar: 3, understory: 2 }, tags: ['north-road-corridor', 'inside-edge-tree-belt'], harvestable: false, intentionalHarvestableCount: 1 },
  { idPrefix: 'folsom_reliquary_dark_cedar_redwoods', center: [76, 24], radiusX: 14, radiusZ: 24, count: 28, seed: 177609, layerMix: { redwood: 5, cedar: 4, understory: 1 }, variantWeights: { tall: 2.2, giant: 1.6, ancient: 1.2, young: 0.2 }, tags: ['rusty-reliquary-ominous'], harvestable: false },
]);
export const FOLSOM_PINE_SWATHE_SPECS = FOLSOM_FOLIAGE_SWATHE_SPECS;
const folsomFoliageBillboards = Object.freeze(FOLSOM_FOLIAGE_SWATHE_SPECS.flatMap((spec) => createFolsomFoliageSwathe({
  ...spec, variants: folsomFoliageBillboardVariants, avoidZones: folsomFoliageAvoidZones, terrainSampler: folsomTerrainSampler, bounds: FOLSOM_VISIBLE_TREE_BOUNDS,
})));

const folsomCityBorderWoodenWall = createCityBorderWoodenWall({
  idPrefix: 'folsom_city_border_wooden_wall',
  points: FOLSOM_BORDER_WALL_PERIMETER,
  height: FOLSOM_BORDER_WALL_HEIGHT,
  thickness: FOLSOM_BORDER_WALL_THICKNESS,
  panelLength: FOLSOM_BORDER_WALL_PANEL_LENGTH,
  materialKeys: FOLSOM_BORDER_WALL_MATERIALS,
  gateOpenings: FOLSOM_BORDER_WALL_GATES,
  terrainSampler: folsomTerrainSampler,
  terrainSamplerAware: true,
  tags: ['folsom', 'protective-perimeter'],
});

export const FOLSOM_CONNECTED_GROWTH_NETWORK = Object.freeze({
  id: 'folsom_underworks_growth_network',
  anchorGroup: 'folsom_underworks',
  tags: Object.freeze(['connected-growth-root', 'chapter-2-preview', 'static-world-authoring']),
  lock: Object.freeze({
    id: 'folsom_underworks_growth_lock',
    position: Object.freeze([42, 2.42, 43.58]),
    anchorGroup: 'folsom_underworks',
    tags: Object.freeze(['underworks-growth-lock', 'connected-growth-root', 'chapter-2-preview', 'blocks-underworks']),
  }),
  anchors: Object.freeze([
    Object.freeze({
      id: 'folsom_growth_anchor_fire', type: 'fire', position: Object.freeze([-10.8, -15.8]), fallbackY: 0.16,
      anchorGroup: 'folsom_underworks', tags: Object.freeze(['fire-anchor', 'connected-growth-anchor', 'common-fire', 'not-collectible']),
    }),
    Object.freeze({
      id: 'folsom_growth_anchor_pond', type: 'pond', position: Object.freeze([8.8, -47.2]), fallbackY: -0.05,
      anchorGroup: 'folsom_underworks', tags: Object.freeze(['pond-anchor', 'wet-root-anchor', 'connected-growth-anchor', 'not-collectible']),
    }),
    Object.freeze({
      id: 'folsom_growth_anchor_shrine', type: 'shrine', position: Object.freeze([-42, 39.12]), fallbackY: 0.788,
      anchorGroup: 'folsom_underworks', tags: Object.freeze(['shrine-anchor', 'white-stone-anchor', 'connected-growth-anchor', 'not-collectible']),
    }),
  ]),
  feeds: Object.freeze([
    Object.freeze({
      id: 'folsom_growth_feed_fire', anchorId: 'folsom_growth_anchor_fire', width: 0.46,
      tags: Object.freeze(['connected-growth-feed', 'fire-feed']), knotPointIndices: Object.freeze([2, 4, 6]),
      points: Object.freeze([[42, 43.35], [35, 36], [27, 28], [18, 19], [9, 10], [1, 0], [-5, -9], [-10.8, -15.8]]),
    }),
    Object.freeze({
      id: 'folsom_growth_feed_pond', anchorId: 'folsom_growth_anchor_pond', width: 0.4,
      tags: Object.freeze(['connected-growth-feed', 'pond-feed', 'wet-root-feed']), knotPointIndices: Object.freeze([2, 4, 6]),
      points: Object.freeze([[42, 43.35], [34, 33], [25, 22], [17, 10], [12, -5], [11, -21], [10, -37], [8.8, -47.2]]),
    }),
    Object.freeze({
      id: 'folsom_growth_feed_shrine', anchorId: 'folsom_growth_anchor_shrine', width: 0.44,
      tags: Object.freeze(['connected-growth-feed', 'shrine-feed', 'white-stone-feed']), knotPointIndices: Object.freeze([1, 3, 5]),
      points: Object.freeze([[42, 43.35], [28, 41], [12, 40.5], [-4, 40], [-20, 39.6], [-34, 39.25], [-42, 39.12]]),
    }),
  ]),
});

export const folsomDefinition = Object.freeze({
  id: 'folsom',
  displayName: 'Folsom',
  type: 'field',
  tags: ['folsom', 'starter-town', 'game-root', 'compiled-runtime', 'oarb', 'darb', 'mixed-authored-location'],
  notes: [
    'Folsom v1 is the compact real-game root, combining OARB terrain and pond systems with DARB structures.',
    'Reliquary Field remains preserved behind the rusted east border door.',
  ],
  fog: { color: 0xc8d8e6, near: 145, far: 420 },
  lighting: { background: 0x9fc8ee },
  skyDome: {
    presentation: 'scene-background',
    texturePath: './assets/textures/sky/sunny_noon_skybox_folsom_01.png',
    textureName: 'folsom-sunny-noon-panorama-background',
    horizonAlignment: 'Equirectangular scene background keeps the sunny noon texture fixed at infinity so the blue daylight sky fills the upper and middle sky without sphere poles, caps, circular artifacts, or a lowered near-field dome.',
  },
  textures,
  defaultFloorY: 0,
  geometry: { wallHeight: 3.8, wallThickness: 0.38, floorThickness: 0.18, ceilingThickness: 0.18 },
  terrain: folsomTerrain,
  connectedGrowthNetwork: FOLSOM_CONNECTED_GROWTH_NETWORK,
  rooms: [{ id: 'folsom_bounds', label: 'Folsom Town Bounds', minX: -98, maxX: 98, minZ: -98, maxZ: 98, floorY: 0, ceilingY: 18, visibleGeometry: false, wallGeometry: false, safeForSpawn: true, tags: ['field-bounds', 'starter-town'] }],
  splineTrails: [
    { id: 'folsom_courtyard_to_pond', points: [[0, -5], [-2, -22], [-8, -38], [0, -45]], width: 5.6, material: 'townPath', flatten: true, tags: ['walkable-route', 'pond-route'], edgeMeshes: false, pathSupport: false, visualYOffset: 0.055 },
    { id: 'folsom_courtyard_to_shrine', points: [[-6, 5], [-18, 18], [-30, 28], [-42, 31]], width: 4.8, material: 'townPath', flatten: true, tags: ['walkable-route', 'shrine-route'], edgeMeshes: false, pathSupport: false, visualYOffset: 0.055 },
    { id: 'folsom_courtyard_to_house', points: [[8, -10], [24, -20], [42, -22], [42, -15]], width: 4.6, material: 'townPath', flatten: true, tags: ['walkable-route', 'house-route'], edgeMeshes: false, pathSupport: false, visualYOffset: 0.055 },
    { id: 'folsom_courtyard_to_cellar', points: [[7, 7], [20, 20], [34, 35]], width: 4.8, material: 'townPath', flatten: true, tags: ['walkable-route', 'dungeon-route'], edgeMeshes: false, pathSupport: false, visualYOffset: 0.055 },
    { id: 'folsom_courtyard_to_reliquary', points: [[10, 6], [32, 12], [58, 8], [76, 4]], width: 5.2, material: 'townPath', flatten: true, tags: ['walkable-route', 'rusty-door-route'], edgeMeshes: false, pathSupport: false, visualYOffset: 0.055 },
    { id: 'folsom_courtyard_to_north_road', points: [[0, 9], [-2, 34], [2, 60], [0, 94]], width: 5.8, material: 'townPath', flatten: true, tags: ['walkable-route', 'future-road-route'], edgeMeshes: false, pathSupport: false, visualYOffset: 0.055 },
    { id: 'folsom_tool_yard_path', points: [[-5, -14], [-18, -25], [-28, -36], [-9, -47]], width: 4.2, material: 'townPath', flatten: true, tags: ['walkable-route', 'work-yard'], edgeMeshes: false, pathSupport: false, visualYOffset: 0.055 },
  ],
  waterBodies: [...folsomPondSystem.waterBodies],
  foliageBillboardVariants: folsomFoliageBillboardVariants,
  foliageBillboards: folsomFoliageBillboards,
  polygonFloors: [
    rectFloor('folsom_courtyard_floor', -16, 16, -13, 13, 'courtyardStone', 'folsom_bounds', ['courtyard', 'terrain-pad-aligned']),
    {
      ...rectFloor('folsom_tool_shed_floor', -42, -28, -35, -25, 'agedWood', 'folsom_bounds', ['tool-shed', 'terrain-pad-aligned', 'future-shed-reward-space']),
      userData: { structureId: 'tool-shed', futureRewardItems: ['wood_axe', 'torch'] },
    },
    rectFloor('folsom_shrine_floor', -53, -31, 30, 46, 'shrineStone', 'folsom_bounds', ['open-ceiling-shrine', 'terrain-pad-aligned'], 0.788),
    rectFloor('folsom_house_floor', 32, 52, -17, 3, 'agedWood', 'folsom_bounds', ['house-interior', 'terrain-pad-aligned']),
    rectFloor('folsom_cellar_apron', 34, 50, 34, 48, 'courtyardStone', 'folsom_bounds', ['dungeon-placeholder', 'terrain-pad-aligned'], 0.368),
    rectFloor('folsom_rusted_door_apron', 74, 90, -3, 11, 'courtyardStone', 'folsom_bounds', ['legacy-door', 'terrain-pad-aligned'], 0.308),
  ],
  wallSegments: [
    ...folsomCityBorderWoodenWall.wallSegments,
    { id: 'folsom_shed_back_wall', from: [-42, -25], to: [-28, -25], y: 0.16, height: 4.2, thickness: 0.42, material: 'agedWood', roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-back'] },
    { id: 'folsom_shed_west_wall', from: [-42, -35], to: [-42, -25], y: 0.16, height: 4.2, thickness: 0.42, material: 'agedWood', roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-side'] },
    { id: 'folsom_shed_east_wall', from: [-28, -35], to: [-28, -25], y: 0.16, height: 4.2, thickness: 0.42, material: 'agedWood', roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-side'] },
    { id: 'folsom_shed_front_wall', from: [-42, -35], to: [-28, -35], y: 0.16, height: 4.2, thickness: 0.42, material: 'agedWood', roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-front', 'door-wall'] },
    { id: 'folsom_shrine_north', from: [-51, 45], to: [-33, 45], y: 0.76, height: 2.4, thickness: 0.46, material: 'darkStone', roomId: 'folsom_bounds', tags: ['shrine', 'ruined-wall'] },
    { id: 'folsom_shrine_west', from: [-52, 31], to: [-52, 43], y: 0.76, height: 2.0, thickness: 0.46, material: 'darkStone', roomId: 'folsom_bounds', tags: ['shrine', 'ruined-wall'] },
    { id: 'folsom_shrine_east', from: [-32, 31], to: [-32, 43], y: 0.76, height: 1.55, thickness: 0.46, material: 'darkStone', roomId: 'folsom_bounds', tags: ['shrine', 'ruined-wall'] },
    { id: 'folsom_house_north', from: [32, 3], to: [52, 3], y: 0.16, height: 4.2, thickness: 0.42, material: 'agedWood', roomId: 'folsom_bounds', tags: ['house'] },
    { id: 'folsom_house_west', from: [32, -17], to: [32, 3], y: 0.16, height: 4.2, thickness: 0.42, material: 'agedWood', roomId: 'folsom_bounds', tags: ['house'] },
    { id: 'folsom_house_east', from: [52, -17], to: [52, 3], y: 0.16, height: 4.2, thickness: 0.42, material: 'agedWood', roomId: 'folsom_bounds', tags: ['house'] },
    { id: 'folsom_house_south', from: [32, -17], to: [52, -17], y: 0.16, height: 4.2, thickness: 0.42, material: 'agedWood', roomId: 'folsom_bounds', tags: ['house', 'door-wall'] },
    { id: 'folsom_east_border_north', from: [82, 7], to: [82, 22], y: 0.28, height: 3.2, thickness: 0.7, material: 'darkStone', roomId: 'folsom_bounds', tags: ['border-wall'] },
    { id: 'folsom_east_border_south', from: [82, -14], to: [82, 1], y: 0.28, height: 3.2, thickness: 0.7, material: 'darkStone', roomId: 'folsom_bounds', tags: ['border-wall'] },
  ],
  doorGaps: [
    { id: 'folsom_shed_door_gap', wallSegmentId: 'folsom_shed_front_wall', centerT: 0.5, width: 4.6, tags: ['tool-shed', 'shed-door'] },
    { id: 'folsom_house_entry_gap', wallSegmentId: 'folsom_house_south', centerT: 0.5, width: 3.2 },
  ],
  horizontalSurfaces: [
    { id: 'folsom_shed_ceiling', kind: 'ceiling', shape: 'rect', center: [-35, 4.36, -30], width: 14, depth: 10, y: 4.36, thickness: 0.18, material: 'shedRoofWood', roomId: 'folsom_bounds', walkable: false, tags: ['tool-shed', 'shed-ceiling'] },
    { id: 'folsom_shed_rear_canopy', kind: 'roof', shape: 'rect', center: [-35, 3.08, -23.95], width: 7.2, depth: 2.4, y: 3.08, thickness: 0.24, material: 'shedRoofWood', roomId: 'folsom_bounds', walkable: false, tags: ['tool-shed', 'shed-back', 'future-knife-hiding-area'] },
    { id: 'folsom_house_roof', kind: 'roof', shape: 'rect', center: [42, 4.35, -7], width: 21.4, depth: 21.4, y: 4.35, material: 'darkStone', roomId: 'folsom_bounds', walkable: false, tags: ['house-roof'] },
  ],
  architecturalPrimitives: [
    ...folsomCityBorderWoodenWall.architecturalPrimitives,
    { id: 'folsom_shed_door_frame', kind: 'doorFrame', position: [-35, 0.188, -35.28], yaw: 0, width: 4.45, height: 4.08, thickness: 0.46, depth: 0.62, material: 'agedWood', blocksPlayer: false, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-door-frame', 'future-growth-target'], userData: { futureGrowthCoverage: 'door seam and frame' } },
    { id: 'folsom_shed_door_left', kind: 'stela', position: [-35.82, 0.188, -35.34], yaw: 0, width: 1.58, height: 3.34, thickness: 0.24, material: 'agedWood', blocksPlayer: true, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-door', 'closed-door'] },
    { id: 'folsom_shed_door_right', kind: 'stela', position: [-34.18, 0.188, -35.34], yaw: 0, width: 1.58, height: 3.34, thickness: 0.24, material: 'agedWood', blocksPlayer: true, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-door', 'closed-door'] },
    { id: 'folsom_shed_door_seam', kind: 'stela', position: [-35, 0.188, -35.48], yaw: 0, width: 0.055, height: 3.34, thickness: 0.035, material: 'rustedIron', blocksPlayer: false, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-door-seam', 'future-growth-target'], userData: { futureInteraction: 'three-swipe black-growth proof loop' } },
    { id: 'folsom_shed_door_strap_low', kind: 'lowWall', from: [-36.58, -35.49], to: [-33.42, -35.49], y: 1.03, height: 0.16, thickness: 0.11, material: 'rustedIron', blocksPlayer: false, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-door-hardware'] },
    { id: 'folsom_shed_door_strap_high', kind: 'lowWall', from: [-36.58, -35.49], to: [-33.42, -35.49], y: 2.42, height: 0.16, thickness: 0.11, material: 'rustedIron', blocksPlayer: false, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-door-hardware'] },
    ...[
      [-42, -35], [-28, -35], [-42, -25], [-28, -25], [-38.25, -25], [-31.75, -25],
    ].map(([x, z], index) => ({
      id: `folsom_shed_frame_post_${index + 1}`,
      kind: 'stela', position: [x, 0.16, z], width: 0.5, height: z === -25 && x > -40 && x < -30 ? 3.1 : 4.35, thickness: 0.5,
      material: 'agedWood', blocksPlayer: false, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-frame', z === -25 ? 'shed-back' : 'shed-corner'],
    })),
    { id: 'folsom_shed_west_eave', kind: 'lowWall', from: [-42.75, -35.72], to: [-42.75, -24.28], y: 4.25, height: 0.28, thickness: 0.3, material: 'shedRoofWood', blocksPlayer: false, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-roof', 'side-eave'] },
    { id: 'folsom_shed_east_eave', kind: 'lowWall', from: [-27.25, -35.72], to: [-27.25, -24.28], y: 4.25, height: 0.28, thickness: 0.3, material: 'shedRoofWood', blocksPlayer: false, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-roof', 'side-eave'] },
    ...[
      { suffix: 'center', x: -35, width: 3, height: 1.12 },
      { suffix: 'west', x: -37.25, width: 1.5, height: 0.85 },
      { suffix: 'east', x: -32.75, width: 1.5, height: 0.85 },
      { suffix: 'far_west', x: -38.75, width: 1.5, height: 0.55 },
      { suffix: 'far_east', x: -31.25, width: 1.5, height: 0.55 },
    ].flatMap(({ suffix, x, width, height }) => [-35.06, -24.94].map((z, sideIndex) => ({
      id: `folsom_shed_${sideIndex === 0 ? 'front' : 'back'}_gable_${suffix}`,
      kind: 'stela', position: [x, 4.3, z], width, height, thickness: 0.2, material: 'agedWood', blocksPlayer: false, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-gable', sideIndex === 0 ? 'shed-front' : 'shed-back'],
    }))),
    { id: 'folsom_shed_west_mid_beam', kind: 'lowWall', from: [-42.24, -34.75], to: [-42.24, -25.25], y: 2.02, height: 0.28, thickness: 0.18, material: 'agedWood', blocksPlayer: false, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-frame'] },
    { id: 'folsom_shed_east_mid_beam', kind: 'lowWall', from: [-27.76, -34.75], to: [-27.76, -25.25], y: 2.02, height: 0.28, thickness: 0.18, material: 'agedWood', blocksPlayer: false, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-frame'] },
    { id: 'folsom_shed_reward_bench', kind: 'altar', position: [-35, 0.188, -26.15], width: 5.2, depth: 1.15, height: 0.82, material: 'agedWood', topMaterial: 'agedWood', blocksPlayer: true, roomId: 'folsom_bounds', tags: ['tool-shed', 'future-shed-reward-space'], userData: { futureRewardItems: ['wood_axe', 'torch'] } },
    { id: 'folsom_shed_rear_work_shelf', kind: 'altar', position: [-35, 0.188, -23.62], width: 4.5, depth: 0.86, height: 0.86, material: 'agedWood', topMaterial: 'agedWood', blocksPlayer: true, roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-back', 'future-knife-hiding-area'], userData: { futurePickupItem: 'old_work_knife' } },
    { id: 'folsom_central_plinth', kind: 'altar', position: [0, 0.16, 0], width: 2.4, depth: 2.4, height: 0.78, material: 'shrineStone', blocksPlayer: true, tags: ['courtyard-landmark', 'old-stone-basin'] },
    { id: 'folsom_shrine_altar', kind: 'altar', position: [-42, 0.76, 40], width: 2.8, depth: 1.5, height: 1, material: 'shrineStone', blocksPlayer: true, tags: ['shrine', 'interactable-placeholder'] },
    { id: 'folsom_shrine_column_left', kind: 'brokenColumn', position: [-49, 0.76, 34], radius: 0.65, height: 4.4, material: 'darkStone', blocksPlayer: true, tags: ['shrine', 'open-ceiling'] },
    { id: 'folsom_shrine_column_right', kind: 'brokenColumn', position: [-35, 0.76, 34], radius: 0.65, height: 3.2, material: 'darkStone', blocksPlayer: true, tags: ['shrine', 'open-ceiling'] },
    { id: 'folsom_cellar_gate', kind: 'lockedRitualGate', position: [42, 0.34, 44], yaw: 0, width: 5.8, height: 4.5, depth: 0.7, material: 'rustedIron', state: 'locked', passable: false, blocksPlayer: false, tags: ['first-dungeon-placeholder', 'folsom-underworks', 'blocks-underworks'], userData: { collision: 'visual-only locked gate; connected growth and inspect interaction keep the Underworks sealed', growthLockId: 'folsom_underworks_growth_lock' } },
    { id: 'folsom_reliquary_door', kind: 'brokenGateFrame', position: [82, 0.28, 4], yaw: Math.PI / 2, width: 6, height: 4.6, depth: 0.75, material: 'rustedIron', state: 'open', passable: true, blocksOpening: false, tags: ['authored-gate', 'rusty-border-door', 'legacy-route'] },
    { id: 'folsom_north_road_marker_left', kind: 'brokenColumn', position: [-4.5, 0.08, 88], radius: 0.55, height: 2.2, material: 'darkStone', blocksPlayer: true, tags: ['future-road-exit'] },
    { id: 'folsom_north_road_marker_right', kind: 'brokenColumn', position: [4.5, 0.08, 88], radius: 0.55, height: 1.7, material: 'darkStone', blocksPlayer: true, tags: ['future-road-exit'] },
  ],
  props: [
    { id: 'folsom_shed_roof_west_pitch', position: [-38.82, 4.89, -30], rotation: [0, 0, 0.13], dimensions: { width: 8.15, height: 0.3, depth: 11.6 }, material: 'shedRoofWood', roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-roof', 'pitched-roof', 'broad-overhang'] },
    { id: 'folsom_shed_roof_east_pitch', position: [-31.18, 4.89, -30], rotation: [0, 0, -0.13], dimensions: { width: 8.15, height: 0.3, depth: 11.6 }, material: 'shedRoofWood', roomId: 'folsom_bounds', tags: ['tool-shed', 'shed-roof', 'pitched-roof', 'broad-overhang'] },
  ],
  outdoorPrimitives: [
    { id: 'folsom_west_boundary_boulders', kind: 'boulderCluster', center: [-86, 6], radius: 7.5, material: FOLSOM_NATURAL_BOULDER_MATERIAL, tags: ['town-boundary', 'paired-blocker'] },
    { id: 'folsom_pond_bank_boulders', kind: 'boulderCluster', center: [15, -62], radius: 3.4, material: FOLSOM_NATURAL_BOULDER_MATERIAL, tags: ['pond', 'partially-submerged', 'paired-blocker'] },
  ],
  curvedBlockers: [
    { id: 'folsom_west_boundary_blocker', kind: 'circle', center: [-86, 6], radius: 8.2, visibleStructureId: 'folsom_west_boundary_boulders', tags: ['town-boundary'] },
    { id: 'folsom_pond_bank_boulder_blocker', kind: 'circle', center: [15, -62], radius: 3.8, visibleStructureId: 'folsom_pond_bank_boulders', tags: ['pond-boulder'] },
  ],
  outdoorChests: [
    { id: 'folsom_fishing_rod_chest', bodyMaterial: 'agedWood', strapMaterial: 'rustedIron', label: 'Pond-Side Fishing Chest', position: { x: -12, y: -0.015, z: -43 }, itemId: 'fishing_rod', acquiredMessage: 'Rod A1 Acquired.', tags: ['pond', 'starter-loop'] },
    { id: 'folsom_wood_axe_chest', bodyMaterial: 'agedWood', strapMaterial: 'rustedIron', label: 'Shed Axe Chest', position: { x: -37.4, y: 0.188, z: -28.2 }, itemId: 'wood_axe', acquiredMessage: 'Wood Axe Acquired.', tags: ['tool-shed', 'shed-reward', 'starter-loop'] },
    { id: 'folsom_flint_stick_chest', bodyMaterial: 'agedWood', strapMaterial: 'rustedIron', label: 'Work Yard Flint Chest', position: { x: -22, y: -0.343, z: -39 }, itemId: 'flint_stick', acquiredMessage: 'Flint Stick Acquired.', tags: ['work-yard', 'starter-loop'] },
    { id: 'folsom_torch_chest', bodyMaterial: 'agedWood', strapMaterial: 'rustedIron', label: 'Shed Torch Chest', position: { x: -32.6, y: 0.188, z: -28.2 }, itemId: 'torch', acquiredMessage: 'Torch Acquired.', tags: ['tool-shed', 'shed-reward', 'starter-loop'] },
  ],
  outdoorPickups: [
    { id: 'folsom_shed_rear_knife_pickup', itemId: 'old_work_knife', label: 'Old Work Knife', position: { x: -35, y: 1.1, z: -23.62 }, range: 3.2, acquiredMessage: 'Old Work Knife Acquired.', tags: ['tool-shed', 'shed-back', 'environmental-discovery'] },
  ],
  outdoorCampfires: [{ id: 'folsom_courtyard_campfire', position: { x: -8, y: 0.16, z: -14 }, tags: ['courtyard', 'pond-path', 'starter-loop'] }],
  // The old folsom_work_yard_tree primitive cylinder/cone fake tree was removed; Folsom harvesting now uses the dark redwood billboard swathes.
  harvestableTrees: [],
  outdoorInteractions: [
    { id: 'folsom_shrine_altar_inspect', label: 'Weathered Shrine Altar', target: { x: -42, y: 1.7, z: 38.5 }, range: 3.4, hint: 'Inspect the weathered altar', message: 'Old offerings have weathered into the stone.', type: 'outdoorInspect' },
    { id: 'folsom_house_note_placeholder', label: 'Caretaker Note', target: { x: 37, y: 1, z: -7 }, range: 3, hint: 'Read the faded note', message: 'The last caretaker left the lamps trimmed.', type: 'outdoorInspect' },
    { id: 'folsom_underworks_locked', label: 'Folsom Underworks', target: { x: 42, y: 1.4, z: 40.5 }, range: 4, hint: 'Inspect the locked Underworks gate', message: 'The Underworks are sealed by living growth.', type: 'areaEntrance', targetLocationId: 'beneath-folsom', destinationSpawnId: 'beneath_folsom_underworks_arrival', requiredWorldState: 'folsom_underworks_growth_unsealed', tags: ['folsom-underworks', 'conditional-transition'] },
    { id: 'folsom_future_road', label: 'North Road', target: { x: 0, y: 1, z: 88 }, range: 5, hint: 'Look beyond the north road', message: 'The old road follows a dry channel into the wilds.', type: 'outdoorInspect' },
  ],
  spawns: [
    { id: 'folsom_player_start', kind: 'player', position: { x: -2, y: 1.71, z: -4 }, yaw: 0, roomId: 'folsom_bounds', tags: ['default-start', 'courtyard'] },
    { id: 'folsom_reliquary_return', kind: 'return', position: { x: 73, y: 1.67, z: 4 }, yaw: -Math.PI / 2, roomId: 'folsom_bounds', tags: ['legacy-door-return'] },
    { id: 'folsom_underworks_return', kind: 'return', position: { x: 42, y: 1.9, z: 38.2 }, yaw: Math.PI, roomId: 'folsom_bounds', tags: ['beneath-folsom', 'underworks-return'], userData: { returnFromLocation: 'beneath-folsom' } },
  ],
  exits: [{
    id: 'folsom_rusted_reliquary_door', fromLocation: 'folsom', toLocation: 'reliquary-field',
    triggerRect: { minX: 78.5, maxX: 84.5, minZ: 1, maxZ: 7 }, position: { x: 81, y: 1.3, z: 4 },
    destinationSpawnId: 'field_folsom_return', promptText: 'Open Rusted Field Door', roomId: 'folsom_bounds',
    tags: ['authored-gate', 'rusty-border-door', 'legacy-route'], userData: { interactionLabel: 'Enter the Old Reliquary Grounds' },
  }],
  lights: [
    { id: 'folsom_noon_ambient', kind: 'ambient', skyColor: 0xddeeff, groundColor: 0x8f866d, intensity: 0.92 },
    { id: 'folsom_noon_sun', kind: 'directional', color: 0xfff2cf, intensity: 1.18, position: { x: 38, y: 92, z: -28 }, target: { x: 0, y: 0, z: 2 }, castShadow: true },
    { id: 'folsom_courtyard_fire_fill', kind: 'point', color: 0xffbd72, intensity: 0.34, distance: 16, decay: 1.7, position: { x: -8, y: 2.4, z: -14 } },
    { id: 'folsom_shrine_fill', kind: 'point', color: 0xd8c59a, intensity: 0.18, distance: 14, decay: 1.75, position: { x: -42, y: 2.8, z: 39 } },
  ],
  validation: { naturalBoulderMaterialPool: FOLSOM_NATURAL_BOULDER_MATERIAL_POOL, cityBorderWoodenWall: folsomCityBorderWoodenWall.validation },
  navigation: { roomGraph: { roomIds: ['folsom_bounds'], links: [] }, localAvoidanceHints: [], forbiddenZones: [], preferredPatrolRoutes: [] },
  encounterZones: [],
  structurePads: [
    { id: 'tool-shed', center: [-34, -30], stampId: 'folsom_tool_shed_pad', floorId: 'folsom_tool_shed_floor' },
    { id: 'shrine', center: [-42, 38], stampId: 'folsom_shrine_pad', floorId: 'folsom_shrine_floor' },
    { id: 'house', center: [42, -8], stampId: 'folsom_house_pad', floorId: 'folsom_house_floor' },
    { id: 'cellar', center: [42, 42], stampId: 'folsom_cellar_pad', floorId: 'folsom_cellar_apron' },
    { id: 'rusted-door', center: [82, 4], stampId: 'folsom_rusted_door_pad', floorId: 'folsom_rusted_door_apron' },
  ],
  validationRoutes: [
    { id: 'pond', points: [[0, -7], [0, -22], [-7, -39], [-12, -43]] },
    { id: 'shed', points: [[0, -7], [-12, -18], [-22, -34], [-22, -39], [-35, -39], [-35, -37.2]] },
    { id: 'shrine', points: [[0, -7], [-10, 8], [-25, 23], [-42, 31]] },
    { id: 'house', points: [[0, -7], [16, -16], [30, -22], [42, -21], [42, -14]] },
    { id: 'underworks', points: [[0, -7], [12, 9], [26, 24], [38, 36]] },
    { id: 'reliquary-door', points: [[0, -7], [12, 7], [30, 12], [50, 9], [66, 5], [76, 4]] },
    { id: 'north-road', points: [[0, -7], [6, -4], [6, 8], [2, 20], [0, 48], [0, 78], [0, 88]] },
  ],
});
