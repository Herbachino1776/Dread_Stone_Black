import { buildOutdoorPondSystem } from '../../engine/outdoor-authoring/OutdoorPondBuilder.js';
import { outdoorTextureProfiles } from './outdoorTextureProfiles.js';
import { createNorthRoadFoliage } from '../world-kits/vegetation/NorthRoadFoliageKit.js';

const SECTOR_BOUNDS = Object.freeze([
  ['NR00', 'Folsom North Gate Exterior Shelf', -600, -467, 'grassWorn'],
  ['NR01', 'North Road Rise', -467, -333, 'grassMatted'],
  ['NR02', 'Hunter Hollow', -333, -200, 'grassPatchyDirt'],
  ['NR03', 'Creek Lowland', -200, -67, 'grassMatted'],
  ['NR04', 'Church Grove', -67, 67, 'grassMatted'],
  ['NR05', 'Scout Ridge', 67, 200, 'grassDryStraw'],
  ['NR06', 'Bent Road Basin', 200, 333, 'grassWorn'],
  ['NR07', 'Growth Gate Ravine', 333, 467, 'grassPatchyDirt'],
  ['NR08', 'Empty Fort Approach', 467, 600, 'grassDryStraw'],
]);

const MAIN_ROAD_POINTS = Object.freeze([
  [-8, -560], [0, -520], [18, -455], [24, -405], [10, -350], [-18, -292], [-25, -235],
  [-10, -170], [18, -108], [12, -45], [-8, 18], [5, 82], [22, 142], [18, 205],
  [-10, 265], [-2, 324], [18, 382], [10, 444], [0, 510], [0, 558],
]);

function gradedPath({ id, points, width = 7, material = 'northRoadPackedEarth', tags = [], sampleSpacing = 1.35, grade = {} }) {
  return Object.freeze({
    id, points, width, material, surfaceMode: 'graded', sampleSpacing,
    grade: { smoothingDistance: 10, maxSlope: 0.15, maxCrossSlope: 0.2, maxCut: 1.6, maxFill: 1.3, ...grade },
    crossSection: { crownHeight: 0.045, shoulderWidth: width >= 7 ? 1.25 : 0.65, shoulderDrop: 0.08, terrainBlendWidth: width >= 7 ? 2.1 : 1.1, lateralSamples: 7 },
    pathSupport: false, edgeMeshes: false, tags: ['north-road', 'terrain-integrated', ...tags],
  });
}

function conformPath({ id, points, width = 3.2, material = 'northRoadPackedEarth', tags = [], sampleSpacing = 1.1 }) {
  return Object.freeze({
    id, points, width, material, surfaceMode: 'conform', sampleSpacing,
    grade: { smoothingDistance: 0, maxSlope: 0.55, maxCrossSlope: 0.65, maxCut: 0, maxFill: 0 },
    crossSection: { crownHeight: 0, shoulderWidth: 0.35, shoulderDrop: 0, terrainBlendWidth: 0.55, lateralSamples: 7 },
    pathSupport: false, edgeMeshes: false, tags: ['north-road', 'terrain-conforming-footpath', ...tags],
  });
}

function bridgePath({ id, points, width = 7, material = 'agedWood', tags = [] }) {
  return Object.freeze({ id, points, width, material, surfaceMode: 'bridge', sampleSpacing: 0.6, grade: { smoothingDistance: 4, maxSlope: 0.16, maxCrossSlope: 0.2, maxCut: 0, maxFill: 0 }, crossSection: { crownHeight: 0, shoulderWidth: 0, shoulderDrop: 0, terrainBlendWidth: 0.1, lateralSamples: 7 }, pathSupport: true, edgeMeshes: false, tags: ['north-road', 'constructed-span', ...tags] });
}

const POND_RECIPES = Object.freeze([
  {
    id: 'north_road_hunters_mere', name: "Hunter's Mere", style: 'broad-woodland-mere', seed: 51021, center: [-112, -258], fishable: true, fishSpeciesPool: ['broadCarpFish', 'smallRiverFish', 'flatMarshFish'],
    size: { radiusX: 17, radiusZ: 13, overallScale: 1, waterAreaScale: 1, shoreScale: 1 },
    shape: { outlinePointCount: 34, outlineWobble: 0.24, asymmetry: 0.38, ovalBias: 0.26, bayCount: 4, lobeCount: 4, edgeRoughness: 0.12 },
    terrain: { depthProfile: 'woodland-mere', basinDepth: 1.1, pondFloorY: 2.2, outerBankY: 3.18, shoreShelfY: 3.12, stampKind: 'terraced', shelfRadius: 25, bankSoftness: 0.62, bankHeight: 0.12 },
    mud: { mudMargin: 2.2, mudColorTint: 0x8b6c49 }, wetShore: { wetShoreWidth: 1.5, wetShoreDarkness: 0x49382a }, water: { waterSurfaceY: 3.05, waterTint: 0x566e63, waterOpacity: 0.62 },
    clearFishingLanes: [{ angle: 0.35, width: 0.8, reason: 'broad hunter bank' }, { angle: 3.4, width: 0.55, reason: 'secluded bank' }],
  },
  {
    id: 'north_road_prayer_pool', name: 'Prayer Pool', style: 'spring-grove-pool', seed: 51022, center: [-86, -16], fishable: true, fishSpeciesPool: ['flatMarshFish', 'smallRiverFish'],
    size: { radiusX: 11, radiusZ: 8.5, overallScale: 1, waterAreaScale: 1, shoreScale: 1 },
    shape: { outlinePointCount: 28, outlineWobble: 0.2, asymmetry: 0.25, ovalBias: 0.18, bayCount: 3, lobeCount: 3, edgeRoughness: 0.1 },
    terrain: { depthProfile: 'spring-pool', basinDepth: 0.8, pondFloorY: 8.1, outerBankY: 8.86, shoreShelfY: 8.8, stampKind: 'hollow', hollowRadius: 17, bankSoftness: 0.58, bankHeight: 0.08 },
    mud: { mudMargin: 1.5, mudColorTint: 0x70563d }, wetShore: { wetShoreWidth: 1.2, wetShoreDarkness: 0x3f3328 }, water: { waterSurfaceY: 8.72, waterTint: 0x4f6863, waterOpacity: 0.64 },
    clearFishingLanes: [{ angle: 1.2, width: 0.65, reason: 'prayer-tree casting shelf' }],
  },
  {
    id: 'north_road_scout_tarn', name: 'Scout Tarn', style: 'rocky-upland-tarn', seed: 51023, center: [104, 137], fishable: true, fishSpeciesPool: ['smallRiverFish', 'spineBackFish'],
    size: { radiusX: 13, radiusZ: 10, overallScale: 1, waterAreaScale: 1, shoreScale: 1 },
    shape: { outlinePointCount: 30, outlineWobble: 0.18, asymmetry: 0.3, ovalBias: 0.2, bayCount: 2, lobeCount: 3, edgeRoughness: 0.09 },
    terrain: { depthProfile: 'rocky-tarn', basinDepth: 1.15, pondFloorY: 10.35, outerBankY: 11.5, shoreShelfY: 11.4, stampKind: 'terraced', shelfRadius: 20, bankSoftness: 0.7, bankHeight: 0.18 },
    mud: { mudMargin: 1.2, mudColorTint: 0x8b7658 }, wetShore: { wetShoreWidth: 0.9, wetShoreDarkness: 0x544a3c }, water: { waterSurfaceY: 11.27, waterTint: 0x647b76, waterOpacity: 0.66 },
    clearFishingLanes: [{ angle: 2.8, width: 0.7, reason: 'safe ridge casting shelf' }],
  },
]);

const pondSystem = buildOutdoorPondSystem(POND_RECIPES);

const waterways = Object.freeze([
  {
    id: 'north_road_scout_rill', displayName: 'Scout Rill', kind: 'rill', points: [[104, 137], [78, 115], [58, 90], [22, 62], [-5, 35], [-38, 8], [-68, -20]], sampleSpacing: 0.8,
    flow: { mode: 'downhill', sourceY: 11.27, outletY: 8.75, minimumSlope: 0.004, maximumSlope: 0.09, smoothingDistance: 5 },
    channel: { width: [4.6, 5.6], depth: [0.42, 0.72], bedWidthRatio: 0.52, lateralSamples: 9 },
    banks: { submergedShelfWidth: 0.45, innerWetBankWidth: 0.75, outerWetBankWidth: 1, dryTransitionWidth: 2.2, maximumBankSlope: 0.62 },
    materials: { bed: 'mudPebblyEarth', submergedShelf: 'mudChurnedWet', wetBank: 'mudWetDark', dryBank: 'grassMatted' }, water: { material: 'northRoadCreekWater', opacity: 0.6, yOffset: 0.018, flowUvScale: 1.2 },
    fishing: { enabled: true, minimumWidth: 2.4, minimumDepth: 0.35, zones: [{ id: 'scout_rill_lower_run_fishing', startDistance: 120, endDistance: 205, fishSpeciesPool: ['smallRiverFish', 'spineBackFish'], castingBank: [-18, 31], standingArea: { center: [-16, 31], radius: 3 }, noFoliageLane: { center: [-10, 29], radius: 7 } }] },
    crossings: [{ id: 'scout_rill_footbridge_crossing', kind: 'footbridge', center: [39, 75], radius: 7 }], tags: ['named-waterway', 'upland-outlet', 'scout-tarn-outlet'],
  },
  {
    id: 'north_road_prayer_run', displayName: 'Prayer Run', kind: 'run', points: [[-86, -16], [-66, -42], [-43, -62], [0, -82], [22, -105], [42, -126]], sampleSpacing: 0.75,
    flow: { mode: 'downhill', sourceY: 8.72, outletY: 5.25, minimumSlope: 0.003, maximumSlope: 0.08, smoothingDistance: 5 },
    channel: { width: [3.2, 4.8], depth: [0.48, 0.82], bedWidthRatio: 0.5, lateralSamples: 9 },
    banks: { submergedShelfWidth: 0.5, innerWetBankWidth: 0.8, outerWetBankWidth: 1.1, dryTransitionWidth: 2.4, maximumBankSlope: 0.64 },
    materials: { bed: 'mudPebblyEarth', submergedShelf: 'mudChurnedWet', wetBank: 'mudWetDark', dryBank: 'grassMatted' }, water: { material: 'northRoadCreekWater', opacity: 0.62, yOffset: 0.018 },
    fishing: { enabled: true, minimumWidth: 2.8, minimumDepth: 0.4, zones: [{ id: 'prayer_run_slow_pool_fishing', startDistance: 35, endDistance: 105, fishSpeciesPool: ['flatMarshFish', 'smallRiverFish'], castingBank: [-53, -54], standingArea: { center: [-51, -51], radius: 3 }, noFoliageLane: { center: [-45, -58], radius: 7 } }] },
    crossings: [{ id: 'prayer_run_main_road_bridge', kind: 'bridge', center: [21, -104], radius: 8 }], tags: ['named-waterway', 'prayer-pool-outlet', 'hunter-creek-tributary'],
  },
  {
    id: 'north_road_hunter_creek', displayName: 'Hunter Creek', kind: 'creek', points: [[42, -126], [34, -141], [-7, -155], [-40, -190], [-82, -224], [-112, -258], [-150, -320], [-205, -410], [-238, -520]], sampleSpacing: 0.9,
    flow: { mode: 'downhill', sourceY: 5.2, outletY: -0.5, minimumSlope: 0.0025, maximumSlope: 0.075, smoothingDistance: 7 },
    channel: { width: [4.8, 7.2], depth: [0.65, 1.15], bedWidthRatio: 0.52, lateralSamples: 11 },
    banks: { submergedShelfWidth: 0.7, innerWetBankWidth: 1.05, outerWetBankWidth: 1.35, dryTransitionWidth: 3, maximumBankSlope: 0.62 },
    materials: { bed: 'mudPebblyEarth', submergedShelf: 'mudChurnedWet', wetBank: 'mudWetDark', dryBank: 'grassMatted' }, water: { material: 'northRoadCreekWater', opacity: 0.66, yOffset: 0.018 },
    fishing: { enabled: true, minimumWidth: 3.8, minimumDepth: 0.5, zones: [
      { id: 'hunter_creek_road_bend_fishing', startDistance: 70, endDistance: 145, fishSpeciesPool: ['smallRiverFish', 'spineBackFish'], castingBank: [-20, -175], standingArea: { center: [-20, -175], radius: 3.5 }, noFoliageLane: { center: [-20, -175], radius: 8 } },
      { id: 'hunter_creek_mere_outlet_fishing', startDistance: 150, endDistance: 260, fishSpeciesPool: ['smallRiverFish', 'spineBackFish', 'flatMarshFish'], castingBank: [-117, -282], standingArea: { center: [-117, -282], radius: 3.5 }, noFoliageLane: { center: [-117, -282], radius: 9 } },
    ] },
    crossings: [{ id: 'hunter_creek_main_road_ford', kind: 'ford', center: [-7, -155], radius: 10, depth: 0.3 }], tags: ['named-waterway', 'primary-creek', 'hunter-mere-connection', 'south-boundary-outlet'],
  },
  {
    id: 'north_road_fort_drain', displayName: 'Fort Approach Drain', kind: 'drainage', points: [[92, 532], [48, 510], [0, 486], [-54, 456]], sampleSpacing: 0.9,
    flow: { mode: 'downhill', sourceY: 21.2, outletY: 18.5, minimumSlope: 0.004, maximumSlope: 0.08 }, channel: { width: [3.6, 4.2], depth: [0.35, 0.55], bedWidthRatio: 0.45, lateralSamples: 9 },
    banks: { submergedShelfWidth: 0.35, innerWetBankWidth: 0.55, outerWetBankWidth: 0.8, dryTransitionWidth: 1.6, maximumBankSlope: 0.65 }, materials: { bed: 'mudPebblyEarth', submergedShelf: 'mudChurnedWet', wetBank: 'mudWetDark', dryBank: 'grassDryStraw' }, water: { material: 'northRoadCreekWater', opacity: 0.48, yOffset: 0.015 },
    fishing: { enabled: false, zones: [] }, crossings: [{ id: 'fort_approach_military_culvert', kind: 'culvert', center: [0, 486], radius: 7 }], tags: ['minor-drainage', 'military-culvert'],
  },
]);

const textures = Object.freeze({
  ...outdoorTextureProfiles, ...pondSystem.textures,
  northRoadPackedEarth: { ...outdoorTextureProfiles.mudPebblyEarth, color: 0x8a755a, emissive: 0x090704, emissiveIntensity: 0.015, worldTileLength: 7, worldTileWidth: 3.5 },
  northRoadWetTrack: { ...outdoorTextureProfiles.mudChurnedWet, color: 0x76614b, emissive: 0x080504, emissiveIntensity: 0.012, worldTileLength: 6, worldTileWidth: 3 },
  northRoadDryTrack: { ...outdoorTextureProfiles.mudCrackedDry, color: 0x947e5f, emissive: 0x080604, emissiveIntensity: 0.01, worldTileLength: 7, worldTileWidth: 3 },
  northRoadCreekWater: { color: 0x607c76, roughness: 0.86, metalness: 0, transparent: true, opacity: 0.64, emissive: 0x081512, emissiveIntensity: 0.045, repeat: [3.4, 2.2], animatedFrames: [1, 2, 3, 4, 5, 6].map((index) => `./assets/textures/water/pond/pond_water_anim_0${index}.png`), playbackMode: 'pingPong', frameDurationMs: 210 },
  agedWood: { path: './assets/textures/pack1/wood_dark_aged_01.png', repeat: [2, 2], color: 0xb0a18b, roughness: 0.96, metalness: 0 },
  rustedIron: { path: './assets/textures/metal_gate_rusted_01.png', repeat: [2, 2], color: 0x9a8775, roughness: 0.9, metalness: 0.28 },
  prayerCloth: { color: 0x9a8d77, roughness: 1, metalness: 0, side: 'double' },
  militaryStone: { path: './assets/textures/floor_worn_stone_01.png', repeat: [4, 4], color: 0xa29b8e, roughness: 0.98, metalness: 0 },
  rockWall: { path: './assets/textures/rock/rock_wall_dark_cliff_03.png', repeat: [3, 2], color: 0x9b978f, roughness: 0.99, metalness: 0, emissive: 0x1c1b19, emissiveIntensity: 0.16 },
  stoneOutcrop: { path: './assets/textures/rock/rock_wall_dark_cliff_04.png', repeat: [2, 2], color: 0x89857c, roughness: 0.99, metalness: 0 },
  darkRoot: { path: './assets/textures/growth/black_growth_cord_surface_01.png', repeat: [3, 1], color: 0x5a5149, roughness: 1, metalness: 0 },
});

const heightStamps = [
  { id: 'nr_regional_south_shelf', kind: 'flatten', center: [0, -548], radius: 58, y: 0.4, tags: ['large-landform', 'entry-shelf'] },
  { id: 'nr_road_rise_landform', kind: 'hill', center: [10, -414], radius: 165, height: 6.2, tags: ['large-landform', 'road-rise'] },
  { id: 'nr_hunter_hollow_basin', kind: 'hollow', center: [-42, -274], radius: 112, depth: 2.5, tags: ['large-landform', 'hunter-hollow'] },
  { id: 'nr_creek_lowland', kind: 'ravine', path: [[-150, -245], [-62, -184], [22, -120], [86, -55]], width: 48, depth: 3.2, tags: ['large-landform', 'drainage-basin'] },
  { id: 'nr_hunter_ford_approach_shelf', kind: 'flatten', center: [-7, -155], radius: 48, y: 4.25, tags: ['large-landform', 'engineered-ford-approach'] },
  { id: 'nr_church_grove_rise_lower', kind: 'hill', center: [-20, -10], radius: 190, height: 4.2, tags: ['large-landform', 'church-grove'] },
  { id: 'nr_church_grove_rise_upper', kind: 'hill', center: [-20, -10], radius: 190, height: 4.2, tags: ['large-landform', 'church-grove'] },
  { id: 'nr_scout_ridge_lower', kind: 'ridge', path: [[-190, 85], [-35, 120], [130, 165], [205, 205]], width: 105, height: 4.9, tags: ['large-landform', 'scout-ridge'] },
  { id: 'nr_scout_ridge_upper', kind: 'ridge', path: [[-190, 85], [-35, 120], [130, 165], [205, 205]], width: 105, height: 4.9, tags: ['large-landform', 'scout-ridge'] },
  { id: 'nr_bent_road_basin', kind: 'hollow', center: [-8, 270], radius: 132, depth: 3.4, tags: ['large-landform', 'bent-road-basin'] },
  { id: 'nr_growth_gate_ravine', kind: 'ravine', path: [[-150, 355], [5, 390], [150, 420]], width: 36, depth: 4.4, tags: ['large-landform', 'growth-gate-ravine'] },
  ...['lower', 'middle', 'upper'].map((band) => ({ id: `nr_fort_approach_upland_${band}`, kind: 'hill', center: [0, 525], radius: 240, height: 6.2, tags: ['large-landform', 'fort-approach'] })),
  ...['lower', 'upper'].map((band) => ({ id: `nr_west_boundary_ridge_${band}`, kind: 'ridge', path: [[-226, -575], [-220, -240], [-218, 80], [-224, 575]], width: 42, height: 7.5, tags: ['large-landform', 'natural-boundary'] })),
  ...['lower', 'upper'].map((band) => ({ id: `nr_east_boundary_ridge_${band}`, kind: 'ridge', path: [[226, -575], [218, -220], [222, 120], [228, 575]], width: 42, height: 7.5, tags: ['large-landform', 'natural-boundary'] })),
  { id: 'nr_hunter_camp_shelf', kind: 'flatten', center: [-78, -300], radius: 24, y: 3.4, tags: ['building-pad', 'camp-shelf'] },
  { id: 'nr_church_camp_shelf', kind: 'flatten', center: [-52, -42], radius: 22, y: 9.1, tags: ['building-pad', 'camp-shelf'] },
  { id: 'nr_scout_camp_shelf', kind: 'flatten', center: [64, 130], radius: 20, y: 11.7, tags: ['building-pad', 'camp-shelf'] },
  ...pondSystem.terrainStamps,
];

const splineTrails = Object.freeze([
  gradedPath({ id: 'north_road_main', points: MAIN_ROAD_POINTS, width: 8.4, sampleSpacing: 2, grade: { maxCut: 4.5, maxFill: 4 }, tags: ['main-road', 'graded-military-route', 'ford-and-ravine-earthwork'] }),
  gradedPath({ id: 'north_road_hunter_camp_approach', points: [[-28, -292], [-54, -300], [-78, -300]], width: 4.8, tags: ['side-path', 'hunter-camp'] }),
  conformPath({ id: 'north_road_hunters_mere_casting_path', points: [[-78, -300], [-79, -276], [-88, -255], [-92.96, -251.05]], width: 3.4, tags: ['footpath', 'fishing-access', 'casting-bank-approach'] }),
  gradedPath({ id: 'north_road_church_camp_approach', points: [[12, -45], [-20, -45], [-52, -42]], width: 4.4, tags: ['side-path', 'church-camp'] }),
  conformPath({ id: 'north_road_prayer_pool_casting_path', points: [[-52, -42], [-62, -27], [-72, -12], [-81.6, -4.69]], width: 3.2, tags: ['footpath', 'fishing-access', 'casting-bank-approach'] }),
  gradedPath({ id: 'north_road_scout_camp_approach', points: [[22, 142], [34, 117], [52, 114], [64, 130]], width: 4.2, material: 'northRoadDryTrack', tags: ['side-path', 'scout-camp'] }),
  conformPath({ id: 'north_road_scout_tarn_casting_path', points: [[64, 130], [75, 137], [84, 141], [89.67, 142.09]], width: 3.2, material: 'northRoadDryTrack', tags: ['footpath', 'fishing-access', 'casting-bank-approach'] }),
  gradedPath({ id: 'north_road_bent_inspection_loop', points: [[-18, 265], [-58, 244], [-78, 276], [-45, 305], [-2, 324]], width: 4.2, tags: ['side-path', 'bent-road-loop'] }),
  gradedPath({ id: 'north_road_empty_fort_overlook', points: [[0, 510], [36, 524], [72, 540]], width: 4.5, material: 'northRoadDryTrack', tags: ['side-path', 'fort-overlook'] }),
  bridgePath({ id: 'north_road_prayer_run_bridge_span', points: [[18, -116], [22, -104], [19, -92]], width: 7.2, tags: ['timber-bridge', 'prayer-run-crossing'] }),
]);

const foliageAvoidZones = [
  ...splineTrails.map((path) => ({ id: `${path.id}_foliage_clearance`, kind: 'corridor', points: path.points, width: path.width + ((path.crossSection?.shoulderWidth ?? 0) + (path.crossSection?.terrainBlendWidth ?? 0) + 1.2) * 2 })),
  ...waterways.map((waterway) => ({ id: `${waterway.id}_water_clearance`, kind: 'corridor', points: waterway.points, width: Math.max(...waterway.channel.width) + (waterway.banks.submergedShelfWidth + waterway.banks.innerWetBankWidth + waterway.banks.outerWetBankWidth + 1.2) * 2 })),
  ...waterways.flatMap((waterway) => (waterway.fishing?.zones ?? []).filter((zone) => zone.noFoliageLane).map((zone) => ({ id: `${zone.id}_lane_clearance`, ...zone.noFoliageLane }))),
  ...pondSystem.waterBodies.map((body) => ({ id: `${body.id}_water_and_bank_clearance`, center: body.center, radiusX: body.radius[0] + body.shoreWidth + 2, radiusZ: body.radius[1] + body.shoreWidth + 2 })),
  ...pondSystem.waterBodies.flatMap((body) => body.fishingBanks.map((bank) => ({ id: `${bank.id}_lane_clearance`, center: bank.position, radius: bank.noFoliageRadius }))),
  { id: 'hunter_camp_clearing', center: [-78, -300], radius: 24 }, { id: 'church_camp_clearing', center: [-52, -42], radius: 23 }, { id: 'scout_camp_clearing', center: [64, 130], radius: 21 },
  { id: 'ford_clearance', center: [-7, -155], radius: 13 }, { id: 'bridge_clearance', center: [21, -104], radius: 12 }, { id: 'culvert_clearance', center: [0, 486], radius: 10 },
  { id: 'empty_fort_sightline', kind: 'corridor', points: [[0, 405], [0, 585]], width: 48 },
];
const northRoadFoliage = createNorthRoadFoliage({
  avoidZones: foliageAvoidZones,
  communities: [
    { id: 'nr_redwood_upland', preset: 'redwoodUpland', center: [0, -410], radiusX: 220, radiusZ: 118, count: 130, seed: 52001 },
    { id: 'nr_hunter_hollow', preset: 'hunterHollow', center: [-58, -278], radiusX: 180, radiusZ: 88, count: 100, seed: 52002 },
    { id: 'nr_creek_lowland', preset: 'creekLowland', center: [-35, -155], radiusX: 198, radiusZ: 74, count: 115, seed: 52003 },
    { id: 'nr_church_grove', preset: 'churchGrove', center: [-35, -4], radiusX: 175, radiusZ: 78, count: 105, seed: 52004 },
    { id: 'nr_scout_ridge', preset: 'scoutRidge', center: [24, 135], radiusX: 205, radiusZ: 72, count: 75, seed: 52005 },
    { id: 'nr_bent_road', preset: 'bentRoad', center: [0, 275], radiusX: 205, radiusZ: 75, count: 90, seed: 52006 },
    { id: 'nr_growth_ravine', preset: 'redwoodUpland', center: [0, 395], radiusX: 175, radiusZ: 58, count: 55, seed: 52007 },
    { id: 'nr_fort_approach', preset: 'fortApproach', center: [0, 520], radiusX: 220, radiusZ: 60, count: 42, seed: 52008 },
  ],
});

const outdoorStructureKits = Object.freeze([
  { id: 'north_road_hunter_camp', kind: 'camp', style: 'hunter', center: [-78, -300], cluePosition: [-71, -296], clueYaw: 0.25, tags: ['hunter-camp', 'chapter-5-route'] },
  { id: 'north_road_church_camp', kind: 'camp', style: 'church', center: [-52, -42], cluePosition: [-44, -39], clueYaw: -0.2, tags: ['church-camp', 'chapter-5-route'] },
  { id: 'north_road_scout_camp', kind: 'camp', style: 'scout', center: [64, 130], cluePosition: [58, 126], clueYaw: 0.3, tags: ['scout-camp', 'chapter-5-route'] },
  { id: 'north_road_rise_retaining_wall', kind: 'retainingWall', points: [[48, -438], [57, -410], [44, -382]], height: 2.6, thickness: 1.2, material: 'militaryStone', tags: ['road-rise', 'old-roadwork'] },
  { id: 'north_road_fort_retaining_wall_west', kind: 'retainingWall', points: [[-28, 470], [-31, 520], [-30, 557]], height: 3.1, thickness: 1.4, material: 'militaryStone', tags: ['fort-approach', 'military-roadwork'] },
  { id: 'north_road_empty_fort_silhouette', kind: 'fortSilhouette', center: [0, 582], tags: ['empty-fort', 'exterior-only', 'chapter-6-boundary'] },
  { id: 'north_road_empty_fort_boundary_gate', kind: 'boundaryGate', center: [0, 558], tags: ['empty-fort', 'intentional-production-boundary'] },
  { id: 'north_road_fort_boundary_west', kind: 'retainingWall', points: [[-240, 558], [-25, 558]], height: 6.5, thickness: 3.2, material: 'militaryStone', tags: ['empty-fort-boundary', 'collapsed-roadwork'] },
  { id: 'north_road_fort_boundary_east', kind: 'retainingWall', points: [[25, 558], [240, 558]], height: 6.5, thickness: 3.2, material: 'militaryStone', tags: ['empty-fort-boundary', 'collapsed-roadwork'] },
  ...[[-18, 472], [18, 482], [-16, 501], [17, 516], [-15, 531], [15, 542]].map(([x, z], index) => ({ id: `north_road_military_marker_${index + 1}`, kind: 'roadMarker', center: [x, z], height: 3.1 + (index % 2) * 0.5, yaw: index * 0.31, lean: (index % 2 ? -1 : 1) * 0.08, wooden: index < 2, tags: ['fort-approach', 'broken-road-marker'] })),
]);

export const northRoadDefinition = Object.freeze({
  id: 'north-road', displayName: 'The North Road', type: 'field',
  tags: ['compiled-runtime', 'north-road', 'chapter-5-parallel-production', 'large-outdoor-location'],
  notes: ['Chapter 5 terrain foundation built early; normal entry opens from Folsom when the canonical Chapter 2 lower-shrine hatch state resolves the north gate.', 'North Road entry does not grant Chapter 3-5 progression, and no enemy or Empty Fort interior content is authored.'],
  defaultFloorY: 0, fog: { color: 0x78807a, near: 110, far: 620 }, lighting: { background: 0x89938e }, textures,
  terrain: {
    size: [500, 1200], segments: [192, 360], baseY: 0, material: 'grassMatted', heightStamps,
    composition: { chunked: true, columns: 3, rows: 9 },
    materialZones: SECTOR_BOUNDS.map(([id, label, minZ, maxZ, material]) => ({ id: `${id}_material_zone`, label, minX: -250, maxX: 250, minZ, maxZ, material })),
  },
  rooms: SECTOR_BOUNDS.map(([id, label, minZ, maxZ]) => ({ id, label, minX: -245, maxX: 245, minZ, maxZ, floorY: 0, ceilingY: 60, visibleGeometry: false, wallGeometry: false, safeForSpawn: true, tags: ['north-road-sector', 'connector'], integrity: { edgePolicy: 'connector' } })),
  splineTrails, waterways, waterBodies: pondSystem.waterBodies,
  foliageBillboardVariants: northRoadFoliage.variants, foliageBillboards: northRoadFoliage.placements,
  foliageCommunities: northRoadFoliage.summaries, foliageDebug: northRoadFoliage.debug,
  foliageRejectedPlacements: northRoadFoliage.rejected,
  outdoorStructureKits,
  outdoorPrimitives: [
    { id: 'north_road_west_ridge_wall', kind: 'cliffWall', points: [[-238, -585], [-235, -220], [-236, 160], [-240, 585]], height: 9, thickness: 5, material: 'rockWall' },
    { id: 'north_road_east_ridge_wall', kind: 'cliffWall', points: [[238, -585], [234, -180], [235, 180], [240, 585]], height: 10, thickness: 5, material: 'rockWall' },
    { id: 'north_road_bent_barrier_west', kind: 'rootWall', points: [[-240, 305], [-11, 329]], height: 5.5, thickness: 4.2, material: 'darkRoot' },
    { id: 'north_road_bent_barrier_east', kind: 'rootWall', points: [[11, 332], [240, 353]], height: 5.5, thickness: 4.2, material: 'darkRoot' },
    { id: 'north_road_growth_ravine_west', kind: 'cliffWall', points: [[-240, 348], [13, 379]], height: 8.5, thickness: 6, material: 'rockWall' },
    { id: 'north_road_growth_ravine_east', kind: 'cliffWall', points: [[38, 390], [240, 424]], height: 8.5, thickness: 6, material: 'rockWall' },
  ],
  curvedBlockers: [
    { id: 'north_road_west_boundary', kind: 'cliff', points: [[-243, -590], [-242, -200], [-242, 200], [-244, 590]], thickness: 10, visibleStructureId: 'north_road_west_ridge_wall' },
    { id: 'north_road_east_boundary', kind: 'cliff', points: [[243, -590], [242, -200], [242, 200], [244, 590]], thickness: 10, visibleStructureId: 'north_road_east_ridge_wall' },
    { id: 'north_road_hunter_camp_shelter_blocker', kind: 'circle', center: [-79, -297], radius: 2.4, visibleStructureId: 'north_road_hunter_camp' },
    { id: 'north_road_church_camp_shelter_blocker', kind: 'circle', center: [-53, -39], radius: 2.3, visibleStructureId: 'north_road_church_camp' },
    { id: 'north_road_scout_camp_shelter_blocker', kind: 'circle', center: [63, 133], radius: 2.2, visibleStructureId: 'north_road_scout_camp' },
    { id: 'north_road_bent_barrier_west_blocker', kind: 'cliff', points: [[-240, 305], [-11, 329]], thickness: 9, visibleStructureId: 'north_road_bent_barrier_west' },
    { id: 'north_road_bent_barrier_east_blocker', kind: 'cliff', points: [[11, 332], [240, 353]], thickness: 9, visibleStructureId: 'north_road_bent_barrier_east' },
    { id: 'north_road_bent_road_blocker', kind: 'capsule', from: [-13, 326], to: [13, 334], radius: 4.2, visibleStructureId: 'north_road_bent_road_false_landmark' },
    { id: 'north_road_growth_ravine_west_blocker', kind: 'cliff', points: [[-240, 348], [13, 379]], thickness: 12, visibleStructureId: 'north_road_growth_ravine_west' },
    { id: 'north_road_growth_ravine_east_blocker', kind: 'cliff', points: [[38, 390], [240, 424]], thickness: 12, visibleStructureId: 'north_road_growth_ravine_east' },
    { id: 'north_road_growth_gate_blocker', kind: 'capsule', from: [14, 378], to: [38, 390], radius: 4.4, visibleStructureId: 'north_road_growth_gate' },
    { id: 'north_road_fort_boundary_west_blocker', kind: 'cliff', points: [[-240, 558], [-25, 558]], thickness: 8, visibleStructureId: 'north_road_fort_boundary_west' },
    { id: 'north_road_empty_fort_boundary_blocker', kind: 'capsule', from: [-26, 558], to: [26, 558], radius: 6, visibleStructureId: 'north_road_empty_fort_boundary_gate' },
    { id: 'north_road_fort_boundary_east_blocker', kind: 'cliff', points: [[25, 558], [240, 558]], thickness: 8, visibleStructureId: 'north_road_fort_boundary_east' },
  ],
  outdoorCrossings: [
    { id: 'hunter_creek_main_road_ford', kind: 'ford', center: [-7, -155], width: 10, length: 16, material: 'northRoadWetTrack', rotationY: 0.38, tags: ['main-road', 'hunter-creek'] },
    { id: 'prayer_run_main_road_bridge', kind: 'bridge', center: [21, -104], pathId: 'north_road_prayer_run_bridge_span', width: 7.2, material: 'agedWood', hardwareMaterial: 'rustedIron', tags: ['main-road', 'prayer-run'] },
    { id: 'fort_approach_military_culvert', kind: 'culvert', center: [0, 486], length: 12, hardwareMaterial: 'rustedIron', rotationY: 1.08, tags: ['military-road', 'drainage'] },
  ],
  routeStateStructures: [{ id: 'north_road_bent_road_false_landmark' }, { id: 'north_road_growth_gate' }],
  outdoorInteractions: [
    { id: 'north_road_map_board', label: 'North Road survey stone', target: { x: 6, y: 1.4, z: -510 }, range: 3.4, hint: 'Inspect the old survey stone', message: 'The road climbs north through three abandoned camps.', type: 'outdoorInspect', saveKey: 'north_road_map_updated', tags: ['route-state', 'map-inspection'] },
    { id: 'north_road_hunter_camp_clue', label: 'Hunter Camp clue board', target: { x: -71, y: 1.5, z: -296 }, range: 3.2, hint: 'Inspect the cut-marked board', message: 'Three cuts point toward the Bent Road basin.', type: 'outdoorInspect', saveKey: 'north_road_hunter_camp_marked', oneTimeWorldState: true, tags: ['hunter-camp', 'route-state', 'not-inventory'] },
    { id: 'north_road_church_camp_clue', label: 'Church Camp prayer board', target: { x: -44, y: 1.5, z: -39 }, range: 3.2, hint: 'Inspect the weathered prayer board', message: 'The strips name a buried cord beneath the Bent Road.', type: 'outdoorInspect', saveKey: 'north_road_church_camp_marked', oneTimeWorldState: true, tags: ['church-camp', 'route-state', 'not-inventory'] },
    { id: 'north_road_scout_camp_clue', label: 'Scout Camp lookout board', target: { x: 58, y: 1.5, z: 126 }, range: 3.2, hint: 'Inspect the scout marks', message: 'A straight sightline to the fort has been crossed out three times.', type: 'outdoorInspect', saveKey: 'north_road_scout_camp_marked', oneTimeWorldState: true, tags: ['scout-camp', 'route-state', 'not-inventory'] },
    { id: 'north_road_empty_fort_approach_marker', label: 'Empty Fort approach stone', target: { x: 0, y: 1.5, z: 535 }, range: 3.6, hint: 'Inspect the failed military marker', message: 'The Empty Fort stands ahead. The closed approach turns you back.', type: 'outdoorInspect', saveKey: 'north_road_empty_fort_approach_marked', tags: ['empty-fort', 'route-state', 'production-boundary'] },
  ],
  spawns: [
    ['north-gate-exterior', -8, -545, 0], ['road-rise', 28, -420, 0.2], ['hunter-camp', -76, -298, -1.4], ['hunter-mere', -100, -278, -1],
    ['creek-ford', -4, -155, 0], ['church-camp', -52, -40, -1.2], ['prayer-pool', -72, -26, -1], ['scout-camp', 52, 118, 0.8],
    ['scout-tarn', 88, 135, 1.5], ['bent-road', -18, 266, 0], ['growth-gate', 18, 372, 0.2], ['empty-fort-approach', 0, 510, 0],
  ].map(([id, x, z, yaw], index) => ({ id, kind: index === 0 ? 'player' : 'development', position: { x, y: 1.55, z }, yaw, roomId: SECTOR_BOUNDS.find(([, , minZ, maxZ]) => z >= minZ && z <= maxZ)?.[0] ?? 'NR00', tags: ['north-road-spawn', ...(index ? ['development-only'] : ['entry'])], userData: { developmentOnly: index > 0 } })),
  exits: [{
    id: 'north_road_return_to_folsom', fromLocation: 'north-road', toLocation: 'folsom',
    triggerRect: { minX: -14, maxX: 4, minZ: -575, maxZ: -548 }, position: { x: -8, y: 1.2, z: -558 },
    wallGaps: [{ roomId: 'NR00', position: { x: -8, y: 0, z: -600 }, width: 18 }],
    destinationSpawnId: 'folsom_north_gate_return', promptText: 'Return through the Folsom north gate', roomId: 'NR00',
    tags: ['safe-return', 'folsom-transition'], userData: { transitionMessage: 'Folsom waits behind the old timber gate.' },
  }],
  lights: [
    { id: 'north_road_overcast_ambient', kind: 'ambient', skyColor: 0xc6d1ce, groundColor: 0x65645c, intensity: 0.78 },
    { id: 'north_road_overcast_sun', kind: 'directional', color: 0xe6e2d4, intensity: 0.9, position: { x: -90, y: 150, z: -80 }, target: { x: 0, y: 8, z: 120 }, castShadow: false },
  ],
  navigation: { roomGraph: { roomIds: SECTOR_BOUNDS.map(([id]) => id), links: SECTOR_BOUNDS.slice(0, -1).map(([id], index) => ({ id: `north_road_sector_link_${index}`, fromRoom: id, toRoom: SECTOR_BOUNDS[index + 1][0] })) }, localAvoidanceHints: [], forbiddenZones: [], preferredPatrolRoutes: [] },
  encounterZones: [],
  integrity: { leakDetection: false },
  audioZones: [
    ['folsom-gate-exterior', -565, -470], ['redwood-road', -470, -330], ['hunter-hollow', -330, -200], ['creek-lowland', -200, -67], ['church-grove', -67, 67], ['scout-ridge-wind', 67, 200], ['bent-road-tension', 200, 333], ['growth-gate', 333, 467], ['empty-fort-distance', 467, 558],
  ].map(([id, minZ, maxZ]) => ({ id: `north_road_audio_${id}`, bounds: { minX: -245, maxX: 245, minZ, maxZ }, acceptedCueId: null, status: 'future-cue-contract-no-placeholder-audio', tags: ['outdoor-audio-zone'] })),
  surfaceMetadata: Object.freeze({ grass: { profile: 'grassMatted', footstep: 'grass' }, dryGrass: { profile: 'grassDryStraw', footstep: 'grass' }, packedDirt: { profile: 'northRoadPackedEarth', futureFootstep: 'packed-dirt' }, wetMud: { profile: 'mudWetDark', futureFootstep: 'wet-mud' }, churnedFord: { profile: 'northRoadWetTrack', futureFootstep: 'churned-ford' }, rock: { profile: 'rockWall', footstep: 'stone' }, bridgeTimber: { profile: 'agedWood', futureFootstep: 'bridge-timber' }, shallowWater: { profile: 'northRoadCreekWater', futureFootstep: 'shallow-water' } }),
  development: { directEntry: '?area=north-road&spawn=north-gate-exterior', loadoutQuery: 'devLoadout=1', productionStartupAllowed: false, grantsProgression: false, materialGallery: { query: '?area=north-road&debug=outdoor-material-gallery', origin: [-188, -535], maxProfiles: 20 }, spawnIds: ['north-gate-exterior', 'road-rise', 'hunter-camp', 'hunter-mere', 'creek-ford', 'church-camp', 'prayer-pool', 'scout-camp', 'scout-tarn', 'bent-road', 'growth-gate', 'empty-fort-approach'] },
  metrics: { authoredBounds: { width: 500, length: 1200 }, sectorCount: 9, terrainChunkCount: 27, generatedMainRoadLengthMeters: 1156.47, progressionChapter: 5, emptyFortInteriorBuilt: false },
});

export { MAIN_ROAD_POINTS, POND_RECIPES, SECTOR_BOUNDS, waterways as NORTH_ROAD_WATERWAYS };
