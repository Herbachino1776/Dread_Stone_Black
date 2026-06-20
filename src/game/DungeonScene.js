import * as THREE from 'three';
import { compileDungeonLocation } from '../engine/dungeon-authoring/DungeonCompiler.js';
import { DungeonDebugRenderer } from '../engine/dungeon-authoring/DungeonDebugRenderer.js';
import { registerDungeonRuntime } from '../engine/dungeon-authoring/DungeonRuntimeRegistry.js';
import { createOutdoorTerrainMesh } from '../engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { createOutdoorSplineTrailMeshes } from '../engine/outdoor-authoring/OutdoorSplineBuilder.js';
import { createOutdoorCurvedBlockers } from '../engine/outdoor-authoring/OutdoorBlockerBuilder.js';
import { createOutdoorPrimitiveMeshes } from '../engine/outdoor-authoring/OutdoorPrimitiveBuilder.js';
import { createCreatureActor } from '../engine/creatures/CreatureActorFactory.js';
import { GoreRuntime } from '../engine/gore/GoreRuntime.js';
import { TorchFlickerController } from '../engine/lighting/TorchFlickerController.js';
import { CollisionWorld } from './Collision.js';
import { loadDungeonModel } from './ModelLoader.js';
import { BlackGrassTempleFactionManager } from './BlackGrassTempleFactions.js';
import { SheepDemonEnemy } from './SheepDemonEnemy.js';
import { createGameGoreRegistry } from './gore/goreRegistry.js';
import { getLocationDefinition } from './locations/locationRegistry.js';
import { resolveFieldPlayerSpawn } from './fieldSpawnResolution.js';
import './creatures/creatureRegistry.js';
import { RAM_MAN_FRIENDLY_ANIMATION_FILES } from './creatures/ramManFriendly.config.js';

const WALL_HEIGHT = 3.2;
const FLOOR_Y = 0;
const RAM_MAN_NPC_POSITION = new THREE.Vector3(0, FLOOR_Y, 14);
const RAM_MAN_NPC_PATROL_POINTS = [
  new THREE.Vector3(-7, FLOOR_Y, 10),
  new THREE.Vector3(7, FLOOR_Y, 10),
  new THREE.Vector3(5, FLOOR_Y, 19),
  new THREE.Vector3(-5, FLOOR_Y, 19),
];
const RAM_MAN_NPC_PATROL_SPEED = 0.34;
const RAM_MAN_NPC_TURN_SPEED = 3.2;
const RAM_MAN_NPC_PATROL_PAUSE_SECONDS = 0.9;
const ROOM_DOORWAY_Z = -4.35;
const INDOOR_BACKGROUND_COLOR = 0x171311;
const INDOOR_FOG_COLOR = 0x2b241d;
const INDOOR_FOG_NEAR = 9;
const INDOOR_FOG_FAR = 42;
const INDOOR_AMBIENT_SKY_COLOR = 0xb8b0a3;
const INDOOR_AMBIENT_GROUND_COLOR = 0x51463c;
const INDOOR_AMBIENT_INTENSITY = 1.42;
const INDOOR_ROOM_FILL_COLOR = 0xffd4a0;
const INDOOR_ROOM_FILL_INTENSITY = 0.62;
const INDOOR_STONE_EMISSIVE = 0x211b16;
const INDOOR_STONE_EMISSIVE_INTENSITY = 0.13;
const INDOOR_FLOOR_EMISSIVE = 0x21180f;
const INDOOR_FLOOR_EMISSIVE_INTENSITY = 0.17;
const INDOOR_CEILING_EMISSIVE = 0x1f1b18;
const INDOOR_CEILING_EMISSIVE_INTENSITY = 0.12;
const INDOOR_TORCH_COLOR = 0xffa85a;
const INDOOR_TORCH_INTENSITY = 2.65;
const INDOOR_TORCH_DISTANCE = 8.4;
const INDOOR_TORCH_DECAY = 1.28;

const TEXTURE_PATHS = {
  wall: './assets/textures/wall_black_stone_01.png',
  floor: './assets/textures/floor_worn_stone_01.png',
  ceiling: './assets/textures/ceiling_dark_stone_01.png',
  gate: './assets/textures/metal_gate_rusted_01.png',
  fieldGrass: './assets/textures/outdoor/field_dead_grass_01.png',
};

const FIELD_SMALL_FOLIAGE_SPRITES = Object.freeze([
  { id: 'billboard_tree_windswept_field_01', path: './assets/sprites/foliage/billboard_tree_windswept_field_01.png', type: 'tree', width: 0.78 },
  { id: 'billboard_bush_ritual_seedpod_01', path: './assets/sprites/foliage/billboard_bush_ritual_seedpod_01.png', type: 'bush', width: 0.98 },
  { id: 'billboard_bush_dead_scrub_01', path: './assets/sprites/foliage/billboard_bush_dead_scrub_01.png', type: 'bush', width: 1.12 },
  { id: 'billboard_bush_dark_bramble_01', path: './assets/sprites/foliage/billboard_bush_dark_bramble_01.png', type: 'bush', width: 1.08 },
  { id: 'billboard_tree_pale_ashen_willow_01', path: './assets/sprites/foliage/billboard_tree_pale_ashen_willow_01.png', type: 'tree', width: 0.86 },
  { id: 'billboard_tree_black_cypress_01', path: './assets/sprites/foliage/billboard_tree_black_cypress_01.png', type: 'tree', width: 0.72 },
  { id: 'billboard_tree_gnarled_ritual_01', path: './assets/sprites/foliage/billboard_tree_gnarled_ritual_01.png', type: 'tree', width: 0.92 },
  { id: 'billboard_tree_thorn_crowned_01', path: './assets/sprites/foliage/billboard_tree_thorn_crowned_01.png', type: 'tree', width: 0.88 },
]);
const FIELD_REDWOOD_SPRITES = Object.freeze([
  { id: 'billboard_tree_redwood_tiered_sacred_01', path: './assets/sprites/foliage/billboard_tree_redwood_tiered_sacred_01.png', type: 'redwood', width: 0.66 },
  { id: 'billboard_tree_redwood_umbrella_crown_01', path: './assets/sprites/foliage/billboard_tree_redwood_umbrella_crown_01.png', type: 'redwood', width: 0.74 },
  { id: 'billboard_tree_redwood_cathedral_01', path: './assets/sprites/foliage/billboard_tree_redwood_cathedral_01.png', type: 'redwood', width: 0.7 },
  { id: 'billboard_tree_redwood_moss_draped_01', path: './assets/sprites/foliage/billboard_tree_redwood_moss_draped_01.png', type: 'redwood', width: 0.76 },
  { id: 'billboard_tree_redwood_ancient_carved_01', path: './assets/sprites/foliage/billboard_tree_redwood_ancient_carved_01.png', type: 'redwood', width: 0.68 },
  { id: 'billboard_tree_redwood_runic_giant_01', path: './assets/sprites/foliage/billboard_tree_redwood_runic_giant_01.png', type: 'redwood', width: 0.72 },
]);
const FIELD_FOLIAGE_SPRITES = Object.freeze([...FIELD_SMALL_FOLIAGE_SPRITES, ...FIELD_REDWOOD_SPRITES]);
const FIELD_FOREST_DENSITY = 0.95;
const FIELD_TREE_WALL_ENABLED = true;
const FIELD_TREE_WALL_REDWOOD_COUNT = 120;
const FIELD_TREE_WALL_UNDERGROWTH_COUNT = 180;
const FIELD_TREE_WALL_MIN_RADIUS = 175;
const FIELD_TREE_WALL_MAX_RADIUS = 205;
const FIELD_REDWOOD_COUNT_TARGET = 60 + FIELD_TREE_WALL_REDWOOD_COUNT;
const FIELD_MID_FOLIAGE_COUNT_TARGET = 190 + Math.floor(FIELD_TREE_WALL_UNDERGROWTH_COUNT * 0.45);
const FIELD_BUSH_COUNT_TARGET = 190 + Math.ceil(FIELD_TREE_WALL_UNDERGROWTH_COUNT * 0.55);
const FIELD_FOLIAGE_INSTANCE_TARGET = FIELD_REDWOOD_COUNT_TARGET + FIELD_MID_FOLIAGE_COUNT_TARGET + FIELD_BUSH_COUNT_TARGET;
const FIELD_FOLIAGE_ALPHA_TEST = 0.35;
const FIELD_FOLIAGE_GROUND_Y = 0;
const FIELD_REDWOOD_SINK_RATIO_MIN = 0.04;
const FIELD_REDWOOD_SINK_RATIO_MAX = 0.08;
const FIELD_MID_FOLIAGE_SINK_RATIO_MIN = 0.03;
const FIELD_MID_FOLIAGE_SINK_RATIO_MAX = 0.07;
const FIELD_BUSH_SINK_RATIO_MIN = 0.02;
const FIELD_BUSH_SINK_RATIO_MAX = 0.06;
const FIELD_FOLIAGE_VISIBLE_DISTANCE = 185;
const FIELD_REDWOOD_VISIBLE_DISTANCE = 260;
const FIELD_FOLIAGE_VISIBLE_DISTANCE_SQ = FIELD_FOLIAGE_VISIBLE_DISTANCE * FIELD_FOLIAGE_VISIBLE_DISTANCE;
const FIELD_REDWOOD_VISIBLE_DISTANCE_SQ = FIELD_REDWOOD_VISIBLE_DISTANCE * FIELD_REDWOOD_VISIBLE_DISTANCE;
const FIELD_SIZE = 400;
const FIELD_HALF_SIZE = FIELD_SIZE / 2;
const FIELD_GRASS_REPEAT = [50, 50];
const FIELD_FISHING_INTERACT_PADDING = 9;
const MAX_FIELD_RAW_FISH_PICKUPS = 6;
const OUTDOOR_DAWN_SKY_COLOR = 0x4d5660;
const OUTDOOR_DAWN_FOG_COLOR = 0x8a8170;
const OUTDOOR_FOG_NEAR = 42;
const OUTDOOR_FOG_FAR = 335;
const FIELD_SKYDOME_RADIUS = 620;
const FIELD_HORIZON_RIDGE_RADIUS = 284;
const FIELD_HORIZON_RIDGE_SEGMENTS = 96;
const FIELD_HORIZON_FOREST_RADIUS = 242;
const FIELD_HORIZON_FOREST_COUNT = 88;
const FIELD_PLAYER_START = new THREE.Vector3(0, 1.55, -175);
const FIELD_PLAYER_YAW = 0;
const FIELD_CRYPT_A_RETURN_START = new THREE.Vector3(-60, 1.55, -112);
const FIELD_CRYPT_A_RETURN_YAW = 0;
const FIELD_BLACK_GRASS_TEMPLE_RETURN_START = new THREE.Vector3(-184, 1.55, 25);
const FIELD_BLACK_GRASS_TEMPLE_RETURN_YAW = 0;
const FIELD_KEEPER_HOUSE_RETURN_START = new THREE.Vector3(142, 1.55, -82);
const FIELD_KEEPER_HOUSE_RETURN_YAW = 0;
const FIELD_DDPLUS_LEVEL1_RETURN_START = new THREE.Vector3(154, 1.55, 104);
const FIELD_DDPLUS_LEVEL1_RETURN_YAW = Math.PI;
const FIELD_SUMERIAN_CITY_BLOCK_V0_RETURN_START = new THREE.Vector3(122, 1.55, 144.5);
const FIELD_SUMERIAN_CITY_BLOCK_V0_RETURN_YAW = Math.PI;
const FIELD_SUMERIAN_SUN_PALACE_DISTRICT_V1_RETURN_START = new THREE.Vector3(96, 1.55, 144.5);
const FIELD_SUMERIAN_SUN_PALACE_DISTRICT_V1_RETURN_YAW = Math.PI;
const FIELD_SUMERIAN_CANAL_MARKET_DISTRICT_V2_RETURN_START = new THREE.Vector3(110, 1.55, 118);
const FIELD_SUMERIAN_CANAL_MARKET_DISTRICT_V2_RETURN_YAW = Math.PI;
const FIELD_BALTHAZAN_RETURN_START = new THREE.Vector3(72, 1.55, 116);
const FIELD_BALTHAZAN_RETURN_YAW = Math.PI;
const FIELD_KEROVAC_RETURN_START = new THREE.Vector3(60, 1.55, 134);
const FIELD_KEROVAC_RETURN_YAW = Math.PI;
const FIELD_OARB_FEATURE_YARD_RETURN_START = new THREE.Vector3(83, 1.55, 155);
const FIELD_OARB_FEATURE_YARD_RETURN_YAW = Math.PI;
const FIELD_WALKABLE_RECT = { minX: -197.5, maxX: 197.5, minZ: -197.5, maxZ: 197.5 };

const OUTDOOR_INTERACTION_RANGE = 4.25;
const GENERATED_ENEMY_ACTIVE_CAP = 3;
const GENERATED_ENEMY_INITIAL_CAP = 2;
const GENERATED_ENEMY_WAKE_RADIUS = 20;
const GENERATED_ENEMY_SLEEP_RADIUS = 38;
const GENERATED_ENEMY_AI_NEAR_RADIUS = 18;
const GENERATED_ENEMY_AI_MID_RADIUS = 30;
const GENERATED_ENEMY_RESPAWN_COOLDOWN_MS = 15000;
const GENERATED_ENEMY_MAX_WAKE_PER_SECOND = 1;
const BGT_EXTERIOR_ENTRANCE_TARGET = new THREE.Vector3(-184, 1, 31);
const FIELD_KEEPER_HOUSE_ENTRANCE_TARGET = new THREE.Vector3(142, 1, -77);
const DDPLUS_LEVEL1_TEST_ENTRANCE_TARGET = new THREE.Vector3(154, 1, 110);
const SUMERIAN_CITY_BLOCK_V0_TEST_ENTRANCE_TARGET = new THREE.Vector3(122, 1, 149);
const SUMERIAN_SUN_PALACE_DISTRICT_V1_TEST_ENTRANCE_TARGET = new THREE.Vector3(96, 1, 149);
const SUMERIAN_CANAL_MARKET_DISTRICT_V2_ENTRANCE_TARGET = new THREE.Vector3(110, 1, 128);
const BALTHAZAN_ENTRANCE_TARGET = new THREE.Vector3(72, 1, 126);
const KEROVAC_ENTRANCE_TARGET = new THREE.Vector3(60, 1, 146);
const OARB_PROVING_GROUNDS_ENTRANCE_TARGET = new THREE.Vector3(70, 1, 164);
const FIELD_FOLIAGE_CLEAR_ZONES = Object.freeze([
  { x: FIELD_PLAYER_START.x, z: FIELD_PLAYER_START.z, radius: 22 },
  { x: 0, z: -8, radius: 18 },
  { x: -60, z: -107, radius: 24 },
  { x: BGT_EXTERIOR_ENTRANCE_TARGET.x, z: BGT_EXTERIOR_ENTRANCE_TARGET.z, radius: 28 },
  { x: FIELD_KEEPER_HOUSE_ENTRANCE_TARGET.x, z: FIELD_KEEPER_HOUSE_ENTRANCE_TARGET.z, radius: 24 },
  { x: DDPLUS_LEVEL1_TEST_ENTRANCE_TARGET.x, z: DDPLUS_LEVEL1_TEST_ENTRANCE_TARGET.z, radius: 18 },
  { x: SUMERIAN_CITY_BLOCK_V0_TEST_ENTRANCE_TARGET.x, z: SUMERIAN_CITY_BLOCK_V0_TEST_ENTRANCE_TARGET.z, radius: 18 },
  { x: SUMERIAN_SUN_PALACE_DISTRICT_V1_TEST_ENTRANCE_TARGET.x, z: SUMERIAN_SUN_PALACE_DISTRICT_V1_TEST_ENTRANCE_TARGET.z, radius: 18 },
  { x: SUMERIAN_CANAL_MARKET_DISTRICT_V2_ENTRANCE_TARGET.x, z: SUMERIAN_CANAL_MARKET_DISTRICT_V2_ENTRANCE_TARGET.z, radius: 20 },
  { x: BALTHAZAN_ENTRANCE_TARGET.x, z: BALTHAZAN_ENTRANCE_TARGET.z, radius: 24 },
  { x: KEROVAC_ENTRANCE_TARGET.x, z: KEROVAC_ENTRANCE_TARGET.z, radius: 18 },
  { x: OARB_PROVING_GROUNDS_ENTRANCE_TARGET.x, z: OARB_PROVING_GROUNDS_ENTRANCE_TARGET.z, radius: 24 },
  { x: 35, z: 124, radius: 22 },
]);
function getReliquaryFieldColliders() {
  return getLocationDefinition('reliquary-field')?.blockers ?? [];
}

const TEXTURE_REPEATS = {
  roomWall: [4, 1.35],
  corridorWall: [4, 1.35],
  roomFloor: [6, 6],
  corridorFloor: [1.5, 6],
  roomCeiling: [6, 6],
  corridorCeiling: [1.5, 6],
  branchWall: [3, 1.35],
  branchFloor: [4, 4],
  branchCeiling: [4, 4],
  longWall: [6, 1.35],
  returnFloor: [1.5, 8],
  returnCeiling: [1.5, 8],
  gateBars: [0.45, 2.5],
  gateBeams: [2.75, 0.45],
};

const BABY_LABYRINTH_WALL_SEGMENTS = [
  // R01 entry corridor with an open field-return threshold and open north split-hall connection.
  { id: 'R01_W', size: [0.35, WALL_HEIGHT, 18], pos: [-4, WALL_HEIGHT / 2, -25] },
  { id: 'R01_E', size: [0.35, WALL_HEIGHT, 18], pos: [4, WALL_HEIGHT / 2, -25] },
  { id: 'R01_S_W', size: [2, WALL_HEIGHT, 0.35], pos: [-3, WALL_HEIGHT / 2, -34] },
  { id: 'R01_S_E', size: [2, WALL_HEIGHT, 0.35], pos: [3, WALL_HEIGHT / 2, -34] },

  // R02 split hall. West/east gaps are centered on D03/D04; north gap leads through D05.
  { id: 'R02_S_W', size: [7, WALL_HEIGHT, 0.35], pos: [-7.5, WALL_HEIGHT / 2, -18] },
  { id: 'R02_S_E', size: [7, WALL_HEIGHT, 0.35], pos: [7.5, WALL_HEIGHT / 2, -18] },
  { id: 'R02_W_S', size: [0.35, WALL_HEIGHT, 4.2], pos: [-11, WALL_HEIGHT / 2, -13.9] },
  { id: 'R02_W_N', size: [0.35, WALL_HEIGHT, 2.2], pos: [-11, WALL_HEIGHT / 2, -7.1] },
  { id: 'R02_E_S', size: [0.35, WALL_HEIGHT, 4.2], pos: [11, WALL_HEIGHT / 2, -13.9] },
  { id: 'R02_E_N', size: [0.35, WALL_HEIGHT, 2.2], pos: [11, WALL_HEIGHT / 2, -7.1] },
  { id: 'R02_N_W', size: [8.8, WALL_HEIGHT, 0.35], pos: [-6.6, WALL_HEIGHT / 2, -6] },
  { id: 'R02_N_E', size: [8.8, WALL_HEIGHT, 0.35], pos: [6.6, WALL_HEIGHT / 2, -6] },

  // R03 west shrine chamber. East and north walls are split only at the intended D03/D06 openings.
  { id: 'R03_W', size: [0.35, WALL_HEIGHT, 16], pos: [-30, WALL_HEIGHT / 2, -8] },
  { id: 'R03_S', size: [16, WALL_HEIGHT, 0.35], pos: [-22, WALL_HEIGHT / 2, -16] },
  { id: 'R03_E_S', size: [0.35, WALL_HEIGHT, 4.2], pos: [-14, WALL_HEIGHT / 2, -13.9] },
  { id: 'R03_E_N', size: [0.35, WALL_HEIGHT, 8.2], pos: [-14, WALL_HEIGHT / 2, -4.1] },
  { id: 'R03_N_W', size: [10.2, WALL_HEIGHT, 0.35], pos: [-24.9, WALL_HEIGHT / 2, 0] },
  { id: 'R03_N_E', size: [2.2, WALL_HEIGHT, 0.35], pos: [-15.1, WALL_HEIGHT / 2, 0] },

  // R04 east chamber. West and north walls are split only at the intended D04/D08 openings.
  { id: 'R04_W_S', size: [0.35, WALL_HEIGHT, 4.2], pos: [14, WALL_HEIGHT / 2, -13.9] },
  { id: 'R04_W_N', size: [0.35, WALL_HEIGHT, 8.2], pos: [14, WALL_HEIGHT / 2, -4.1] },
  { id: 'R04_E', size: [0.35, WALL_HEIGHT, 16], pos: [30, WALL_HEIGHT / 2, -8] },
  { id: 'R04_S', size: [16, WALL_HEIGHT, 0.35], pos: [22, WALL_HEIGHT / 2, -16] },
  { id: 'R04_N_W', size: [2.2, WALL_HEIGHT, 0.35], pos: [15.1, WALL_HEIGHT / 2, 0] },
  { id: 'R04_N_E', size: [10.2, WALL_HEIGHT, 0.35], pos: [24.9, WALL_HEIGHT / 2, 0] },

  // D05 connector from split hall to guardian chamber; side walls close the void around the doorway run.
  { id: 'D05_W', size: [0.35, WALL_HEIGHT, 8], pos: [-2.2, WALL_HEIGHT / 2, -2] },
  { id: 'D05_E', size: [0.35, WALL_HEIGHT, 8], pos: [2.2, WALL_HEIGHT / 2, -2] },

  // Loop corridors keep the baby labyrinth compact while reconnecting to the main room.
  { id: 'C01_W', size: [0.35, WALL_HEIGHT, 20], pos: [-22, WALL_HEIGHT / 2, 10] },
  { id: 'C01_E_S', size: [0.35, WALL_HEIGHT, 6.2], pos: [-14, WALL_HEIGHT / 2, 3.1] },
  { id: 'C01_E_N', size: [0.35, WALL_HEIGHT, 10.2], pos: [-14, WALL_HEIGHT / 2, 14.9] },
  { id: 'C02_E', size: [0.35, WALL_HEIGHT, 20], pos: [22, WALL_HEIGHT / 2, 10] },
  { id: 'C02_W_S', size: [0.35, WALL_HEIGHT, 6.2], pos: [14, WALL_HEIGHT / 2, 3.1] },
  { id: 'C02_W_N', size: [0.35, WALL_HEIGHT, 10.2], pos: [14, WALL_HEIGHT / 2, 14.9] },

  // R05 guardian chamber. South wall is split for D05; side gaps accept the loops; north opens to alcove.
  { id: 'R05_S_W', size: [12.8, WALL_HEIGHT, 0.35], pos: [-8.6, WALL_HEIGHT / 2, 2] },
  { id: 'R05_S_E', size: [12.8, WALL_HEIGHT, 0.35], pos: [8.6, WALL_HEIGHT / 2, 2] },
  { id: 'R05_W_S', size: [0.35, WALL_HEIGHT, 4.2], pos: [-15, WALL_HEIGHT / 2, 4.1] },
  { id: 'R05_W_N', size: [0.35, WALL_HEIGHT, 16.2], pos: [-15, WALL_HEIGHT / 2, 17.9] },
  { id: 'R05_E_S', size: [0.35, WALL_HEIGHT, 4.2], pos: [15, WALL_HEIGHT / 2, 4.1] },
  { id: 'R05_E_N', size: [0.35, WALL_HEIGHT, 16.2], pos: [15, WALL_HEIGHT / 2, 17.9] },
  { id: 'R05_N_W', size: [13, WALL_HEIGHT, 0.35], pos: [-8.5, WALL_HEIGHT / 2, 26] },
  { id: 'R05_N_E', size: [13, WALL_HEIGHT, 0.35], pos: [8.5, WALL_HEIGHT / 2, 26] },

  // R06 reliquary alcove.
  { id: 'R06_W', size: [0.35, WALL_HEIGHT, 10], pos: [-7, WALL_HEIGHT / 2, 30] },
  { id: 'R06_E', size: [0.35, WALL_HEIGHT, 10], pos: [7, WALL_HEIGHT / 2, 30] },
  { id: 'R06_N', size: [14, WALL_HEIGHT, 0.35], pos: [0, WALL_HEIGHT / 2, 35] },
];

function babyLabyrinthWallBlockerRects() {
  return BABY_LABYRINTH_WALL_SEGMENTS.map((wall) => ({
    id: wall.id,
    minX: wall.pos[0] - wall.size[0] / 2,
    maxX: wall.pos[0] + wall.size[0] / 2,
    minZ: wall.pos[2] - wall.size[2] / 2,
    maxZ: wall.pos[2] + wall.size[2] / 2,
  }));
}

function horizontalDistance(a, b) {
  if (!a || !b) return Infinity;
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

export const FIELD_SURVIVAL_PLACEMENTS = Object.freeze({
  axeChest: { id: 'field_survival_axe_chest', position: { x: -34, y: 0, z: -118 } },
  flintStickChest: { id: 'field_survival_flint_stick_chest', position: { x: 116, y: 0, z: -24 } },
  fishingRodChest: { id: 'field_survival_fishing_rod_chest', position: { x: -156, y: 0, z: -122 } },
  harvestableTree: { id: 'field_survival_redwood_01', position: { x: 46, y: 0, z: -132 } },
});

export class DungeonScene {
  constructor({ area = 'field', fieldSpawn = 'start', gameState = null } = {}) {
    this.area = area;
    this.fieldSpawn = fieldSpawn;
    this.gameState = gameState;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(INDOOR_BACKGROUND_COLOR);
    this.scene.fog = new THREE.Fog(INDOOR_FOG_COLOR, INDOOR_FOG_NEAR, INDOOR_FOG_FAR);
    this.textureLoader = new THREE.TextureLoader();
    this.textureCheckRig = null;
    this.playerSpawn = this.area === 'field'
      ? this.getFieldPlayerSpawn()
      : this.getIndoorPlayerSpawn();
    this.outdoorInteractions = [];
    this.fieldShrineGroup = null;
    this.fieldShrineAnswerLight = null;
    this.fieldFoliageGroup = null;
    this.fieldFoliageBillboards = [];
    this.fieldRedwoodHarvestables = [];
    this.fieldSurvivalObjects = new Map();
    this.fieldFishingZones = [];
    this.fieldRawFishPickups = [];
    this.outdoorTerrainRuntime = null;
    this.fieldCookedFishPickups = [];
    this.giantRamManFieldManifestation = null;
    this.giantRamManFieldManifestationLoading = false;
    this.reliquaryBlock = null;
    this.reliquaryAwakeLight = null;

    this.gate = null;
    this.gateOpen = false;
    this.gateOpening = false;
    this.gateTarget = new THREE.Vector3(11, 1.2, -8);
    this.key = null;
    this.keyTarget = new THREE.Vector3(999, 999, 999);
    this.lever = null;
    this.leverUsed = false;
    this.leverTarget = null;
    this.shortcutTarget = null;
    this.indoorExitTarget = new THREE.Vector3(0, 1.2, -32);
    this.secretTarget = null;
    this.shortcutDoor = null;
    this.shortcutOpen = false;
    this.secretWall = null;
    this.secretRevealed = false;
    this.ramManNpcActor = null;
    this.ramManNpc = null;
    this.ramManNpcPatrolIndex = 0;
    this.ramManNpcMoveTarget = 1;
    this.ramManNpcPauseTimer = 0;
    this.ramManNpcAnimation = null;
    this.sheepDemonEnemy = null;
    this.blackGrassFactionManager = null;
    this.generatedEnemyRuntime = null;
    this.blackGrassRuntime = null;
    this.compiledLocationRuntime = null;
    this.dungeonDebugRenderer = null;
    this.goreRuntime = new GoreRuntime({
      scene: this.scene,
      registry: createGameGoreRegistry(),
      locationId: this.area,
      getRoomIdForPosition: (position) => this.findRoomIdForPosition(position),
      getFloorYForPosition: (position) => this.getFloorYForPosition(position),
    });
    this.torchFlickerController = new TorchFlickerController();
    this.torchLights = [];
    this.gateBlocker = { minX: 10.72, maxX: 11.28, minZ: -10.85, maxZ: -5.15 };
    const indoorWallBlockers = babyLabyrinthWallBlockerRects();
    const indoorWalkableRects = [
      { id: 'R01', minX: -4, maxX: 4, minZ: -34, maxZ: -16 },
      { id: 'R02', minX: -11, maxX: 11, minZ: -18, maxZ: -6 },
      { id: 'R03', minX: -30, maxX: -14, minZ: -16, maxZ: 0 },
      { id: 'R04', minX: 14, maxX: 30, minZ: -16, maxZ: 0 },
      { id: 'R05', minX: -15, maxX: 15, minZ: 2, maxZ: 26 },
      { id: 'R06', minX: -7, maxX: 7, minZ: 25, maxZ: 35 },
      { id: 'C01', minX: -22, maxX: -15, minZ: 0, maxZ: 20 },
      { id: 'C02', minX: 15, maxX: 22, minZ: 0, maxZ: 20 },
      { id: 'D03', minX: -14, maxX: -11, minZ: -11.8, maxZ: -8.2 },
      { id: 'D04', minX: 11, maxX: 14, minZ: -11.8, maxZ: -8.2 },
      { id: 'D05', minX: -2.2, maxX: 2.2, minZ: -6, maxZ: 2 },
      { id: 'D07', minX: -15, maxX: -12, minZ: 6.2, maxZ: 9.8 },
      { id: 'D09', minX: 12, maxX: 15, minZ: 6.2, maxZ: 9.8 },
    ];
    this.inspectInteractions = [
      {
        id: 'INT02',
        target: new THREE.Vector3(-22, 1.2, -14),
        range: 3.0,
        hint: 'Tap INTERACT to inspect the shrine slab.',
        message: 'The slab is carved with a door that was never meant to open.',
      },
      {
        id: 'INT03',
        target: this.gateTarget,
        range: 3.1,
        hint: 'Tap INTERACT to test the east grate.',
        message: 'The rusted grate gives a little, then holds.',
      },
      {
        id: 'INT04',
        target: new THREE.Vector3(0, 1.2, 32),
        range: 3.2,
        hint: this.gameState?.hasSouthReliquaryFragment ? 'The black reliquary is awake.' : 'Tap INTERACT to wake the reliquary block.',
        message: this.gameState?.hasSouthReliquaryFragment ? 'The black reliquary hums inside the stone.' : 'Something black sleeps inside the stone.',
        type: 'southReliquary',
      },
    ];

    if (this.area === 'black-grass-temple') {
      this.configureBlackGrassTempleRuntime();
    } else if (this.isCompiledRuntimeArea()) {
      this.configureCompiledLocationRuntime(this.area);
    } else {
      this.collision = this.area === 'field'
        ? new CollisionWorld({ walkableRects: [FIELD_WALKABLE_RECT], blockerRects: this.createOutdoorBlockers(), playerRadius: 0.5, outdoorTerrainSampler: this.outdoorTerrainRuntime })
        : new CollisionWorld({
          walkableRects: indoorWalkableRects,
          blockerRects: [this.gateBlocker, ...indoorWallBlockers],
        });
    }
  }

  getIndoorPlayerSpawn() {
    const definition = getLocationDefinition(this.area);
    const playerSpawn = definition?.spawns?.find((spawn) => spawn.kind === 'player');
    if (playerSpawn?.position) {
      return { spawnPosition: this.toVector3(playerSpawn.position, 1.55), spawnYaw: playerSpawn.yaw ?? 0 };
    }

    return { spawnPosition: new THREE.Vector3(0, 1.55, -30), spawnYaw: 0 };
  }

  isCompiledRuntimeArea() {
    return this.area !== 'field' && this.area !== 'dungeon' && getLocationDefinition(this.area)?.tags?.includes('compiled-runtime');
  }

  configureCompiledLocationRuntime(locationId = this.area) {
    const runtime = this.compileLocationRuntime(locationId);
    this.blackGrassRuntime = locationId === 'black-grass-temple' ? runtime : this.blackGrassRuntime;
    this.compiledLocationRuntime = runtime;
    this.collision = runtime.collisionWorld;

    const exit = runtime.exits.find((candidate) => candidate.toLocation === 'reliquary-field') ?? runtime.exits[0];
    this.indoorExitTarget = exit?.position?.clone() ?? new THREE.Vector3(0, 1.2, -30);
    this.inspectInteractions = (runtime.definition.interactions ?? []).map((interaction) => ({
      ...interaction,
      target: this.toVector3(interaction.target, 1.2),
    }));

    const playerStart = runtime.spawnAnchors.find((spawn) => spawn.kind === 'player');
    if (playerStart) {
      this.playerSpawn = {
        spawnPosition: playerStart.position.clone(),
        spawnYaw: playerStart.yaw ?? 0,
      };
    }

    return runtime;
  }

  configureBlackGrassTempleRuntime() {
    this.blackGrassRuntime = this.configureCompiledLocationRuntime('black-grass-temple');
    this.blackGrassNavigationGraph = this.blackGrassRuntime.navGraph;
    this.blackGrassFactionSpawnAnchors = Object.freeze(this.blackGrassRuntime.spawnAnchors
      .filter((spawn) => spawn.tags?.includes('faction-war-anchor'))
      .map((spawn) => ({
        id: spawn.id,
        preferredFaction: spawn.preferredFaction,
        position: spawn.position.clone(),
        yaw: spawn.yaw,
        roomId: spawn.roomId,
        initialWave: spawn.initialWave,
        patrolPoints: Object.freeze((spawn.patrolPoints?.length ? spawn.patrolPoints : [
          spawn.position.clone().add(new THREE.Vector3(-3, 0, -2)),
          spawn.position.clone().add(new THREE.Vector3(3, 0, -2)),
          spawn.position.clone().add(new THREE.Vector3(3, 0, 2)),
          spawn.position.clone().add(new THREE.Vector3(-3, 0, 2)),
        ]).map((point) => point.clone())),
      })));

    const exit = this.blackGrassRuntime.exits.find((candidate) => candidate.id === 'bgt_exit_to_reliquary_field');
    this.indoorExitTarget = exit?.position?.clone() ?? this.indoorExitTarget;
    this.gateTarget = this.inspectInteractions.find((interaction) => interaction.id === 'BGT_INT04')?.target?.clone() ?? new THREE.Vector3(30, 1.2, -20);
  }

  compileLocationRuntime(locationId) {
    const definition = getLocationDefinition(locationId);
    if (!definition) throw new Error(`Missing location definition: ${locationId}`);
    return registerDungeonRuntime(compileDungeonLocation(definition, {
      materialFactory: (profile) => this.makeDefinitionMaterial(profile),
      torchFactory: (light) => this.createTorchGroup(this.toVector3(light.position, 1.55), light.rotationY ?? 0),
    }));
  }

  toVector3(value, fallbackY = 0) {
    if (value instanceof THREE.Vector3) return value.clone();
    return new THREE.Vector3(
      Number(value?.x ?? value?.[0] ?? 0),
      Number(value?.y ?? value?.[1] ?? fallbackY),
      Number(value?.z ?? value?.[2] ?? 0),
    );
  }

  makeDefinitionMaterial(profile = {}) {
    if (profile.path) {
      const material = this.makeTexturedMaterial({
        path: profile.path,
        repeat: profile.repeat ?? [1, 1],
        color: profile.color ?? 0xffffff,
        roughness: profile.roughness ?? 0.9,
        metalness: profile.metalness ?? 0,
        emissive: profile.emissive ?? 0x000000,
        emissiveIntensity: profile.emissiveIntensity ?? 0,
        transparent: profile.transparent,
        opacity: profile.opacity,
      });
      this.applyBalthazanTextureDiagnosticMap(material, profile);
      material.userData.definitionProfile = {
        ...profile,
        baseEmissiveIntensity: profile.emissiveIntensity ?? 0,
      };
      return material;
    }

    const material = new THREE.MeshStandardMaterial({
      color: profile.color ?? 0xffffff,
      roughness: profile.roughness ?? 0.9,
      metalness: profile.metalness ?? 0,
      emissive: profile.emissive ?? 0x000000,
      emissiveIntensity: profile.emissiveIntensity ?? 0,
    });
    material.userData.definitionProfile = {
      ...profile,
      baseEmissiveIntensity: profile.emissiveIntensity ?? 0,
    };
    return material;
  }

  isBalthazanTextureDiagnosticEnabled() {
    if (!import.meta.env.DEV || this.area !== 'balthazan') return false;
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('balthazanTextureQa') === 'checker';
  }

  getBalthazanTextureDiagnosticTexture() {
    if (this.balthazanTextureDiagnosticTexture) return this.balthazanTextureDiagnosticTexture;
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const colors = ['#ffffff', '#111111', '#ff40d0', '#18d8ff'];
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        context.fillStyle = colors[(x + y) % colors.length];
        context.fillRect(x * 16, y * 16, 16, 16);
      }
    }
    context.fillStyle = '#ffff00';
    context.fillRect(0, 0, size, 3);
    context.fillRect(0, 0, 3, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = 'balthazan-dev-uv-checker';
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    this.balthazanTextureDiagnosticTexture = texture;
    return texture;
  }

  applyBalthazanTextureDiagnosticMap(material, profile = {}) {
    if (!this.isBalthazanTextureDiagnosticEnabled()) return;
    const targets = ['floor', 'stone', 'roof', 'wood', 'grass'];
    const path = String(profile.path ?? '').toLowerCase();
    if (!targets.some((target) => path.includes(target))) return;
    material.map = this.getBalthazanTextureDiagnosticTexture();
    material.color.setHex(0xffffff);
    material.needsUpdate = true;
  }

  averageMeshNormalY(mesh) {
    const normals = mesh?.geometry?.getAttribute?.('normal');
    if (!normals?.count) return 0;
    let sum = 0;
    for (let i = 0; i < normals.count; i += 1) sum += normals.getY(i);
    return sum / normals.count;
  }

  materialSideName(side) {
    if (side === THREE.DoubleSide) return 'DoubleSide';
    if (side === THREE.BackSide) return 'BackSide';
    return 'FrontSide';
  }

  meshUvRange(mesh) {
    const uv = mesh?.geometry?.getAttribute?.('uv');
    if (!uv?.count) return null;
    let minU = Infinity; let maxU = -Infinity; let minV = Infinity; let maxV = -Infinity;
    for (let i = 0; i < uv.count; i += 1) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    return { minU, maxU, minV, maxV };
  }

  meshWorldSize(mesh) {
    mesh.geometry?.computeBoundingBox?.();
    const box = mesh.geometry?.boundingBox?.clone?.();
    if (!box) return null;
    box.applyMatrix4(mesh.matrixWorld);
    return { width: box.max.x - box.min.x, height: box.max.y - box.min.y, depth: box.max.z - box.min.z };
  }

  logBalthazanTextureQa(runtime) {
    if (!import.meta.env.DEV || runtime?.locationId !== 'balthazan') return;
    const surfaces = [];
    runtime.group.traverse((object) => {
      if (object.isMesh && object.userData?.horizontalSurfaceId) surfaces.push(object);
    });
    surfaces.forEach((mesh) => {
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const uv = mesh.geometry?.getAttribute('uv');
      const uvRange = this.meshUvRange(mesh);
      const size = this.meshWorldSize(mesh) ?? mesh.userData.horizontalSurfaceWorldSize;
      const materialPath = mesh.userData.horizontalSurfaceMaterialPath ?? material?.userData?.definitionProfile?.path ?? 'none';
      console.info(`[Balthazan horizontal QA] id=${mesh.userData.horizontalSurfaceId} kind=${mesh.userData.horizontalSurfaceKind} material=${materialPath} map=${Boolean(material?.map)} uv=${Boolean(uv)} uvRange=${uvRange ? `[${uvRange.minU.toFixed(2)},${uvRange.minV.toFixed(2)}..${uvRange.maxU.toFixed(2)},${uvRange.maxV.toFixed(2)}]` : 'none'} normalY=${Number(mesh.userData.horizontalSurfaceNormalY ?? this.averageMeshNormalY(mesh)).toFixed(2)} worldSize=${size ? `[${size.width.toFixed(2)}x${size.depth.toFixed(2)}]` : 'unknown'}`);
    });

    runtime.blockerRects
      ?.filter((rect) => rect.id?.startsWith('V2-WALL-BLOCKER-'))
      .forEach((rect) => {
        const footprint = rect.blockerShape === 'segment' && rect.from && rect.to
          ? `from=[${rect.from.x.toFixed(2)},${rect.from.z.toFixed(2)}] to=[${rect.to.x.toFixed(2)},${rect.to.z.toFixed(2)}] thickness=${(rect.thickness ?? 0).toFixed(2)}`
          : `aabb=[${rect.minX.toFixed(2)},${rect.minZ.toFixed(2)}..${rect.maxX.toFixed(2)},${rect.maxZ.toFixed(2)}]`;
        console.info(`[Balthazan collision QA] ${rect.id} shape=${rect.blockerShape ?? 'aabb'} ${footprint}`);
      });
  }

  updateBalthazanFloorCoverageQa(player = null) {
    if (!import.meta.env.DEV || this.compiledLocationRuntime?.locationId !== 'balthazan' || !player?.position) return;
    const now = performance.now();
    if (now - (this.lastBalthazanFloorCoverageQaAt ?? 0) < 3500) return;
    this.lastBalthazanFloorCoverageQaAt = now;
    const position = player.position;
    const floorMeshes = [];
    this.compiledLocationRuntime.group.traverse((object) => {
      if (!object.isMesh) return;
      if (object.name.startsWith('V2-FLOOR-') || object.name.startsWith('V2-PATH-') || object.name.startsWith('V2-PLATFORM-TOP-')) floorMeshes.push(object);
      if (object.userData?.horizontalSurfaceId && !['ceiling', 'roof'].includes(object.userData.horizontalSurfaceKind)) floorMeshes.push(object);
    });
    const visibleFloorUnderfoot = floorMeshes.some((mesh) => {
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      return position.x >= box.min.x - 0.15 && position.x <= box.max.x + 0.15 && position.z >= box.min.z - 0.15 && position.z <= box.max.z + 0.15;
    });
    const floorPosition = { x: position.x, y: position.y - (this.collision?.eyeHeight ?? 1.55), z: position.z };
    const walkable = this.collision?.canStandAtFloorPosition?.(floorPosition) ?? false;
    if (walkable && !visibleFloorUnderfoot) {
      const sampled = this.collision?.sampleWalkableY?.(position.x, position.z, 0);
      console.warn(`[Balthazan floor coverage QA] walkable player position has no visible floor/path/platform bounds underneath x=${position.x.toFixed(2)} z=${position.z.toFixed(2)} sampledSurface=${sampled?.surface?.id ?? sampled?.kind ?? 'none'}`);
    }
  }

  getFieldPlayerSpawn() {
    return resolveFieldPlayerSpawn(this.fieldSpawn, {
      fallbackPosition: FIELD_PLAYER_START,
      fallbackYaw: FIELD_PLAYER_YAW,
      logger: console,
    });
  }

  build() {
    if (this.area === 'field') {
      this.buildOutdoorField();
    } else {
      this.buildIndoorDungeon();
    }

    this.addTextureVerificationMode();
    return this.scene;
  }

  buildIndoorDungeon() {
    if (this.area === 'black-grass-temple') {
      this.buildBlackGrassTempleInterior();
      return;
    }

    if (this.isCompiledRuntimeArea()) {
      this.buildCompiledLocationInterior();
      return;
    }

    this.addLights();
    this.addBabyLabyrinthInterior();
    this.addBabyLabyrinthStaging();
    this.addTorches();
    this.addRamManNpc();
    this.addSheepDemonEnemy();
  }

  buildOutdoorField() {
    const fieldDefinition = getLocationDefinition('reliquary-field');
    this.scene.background = new THREE.Color(OUTDOOR_DAWN_SKY_COLOR);
    this.scene.fog = new THREE.Fog(OUTDOOR_DAWN_FOG_COLOR, OUTDOOR_FOG_NEAR, OUTDOOR_FOG_FAR);
    this.addOutdoorLights();
    this.addReliquaryFieldSkyDome();
    this.addOutdoorTerrain(fieldDefinition.terrain, fieldDefinition.textures, fieldDefinition);
    this.addReliquaryFieldRiverBoundary();
    this.addReliquaryFieldHorizonSystem();
    this.addOutdoorBoundary();
    this.addReliquaryFieldStructures();
    this.addReliquaryFieldFoliage();
    this.addFieldSurvivalLoopObjects();
    this.ensureGiantRamManFieldManifestation();
  }

  shouldManifestGiantRamManInField(manifestation) {
    if (this.area !== 'field' || !manifestation) return false;
    if (manifestation.conditionFlag === 'blackGrassTempleAltarActivated') {
      return Boolean(this.gameState?.hasBlackGrassTempleAltarActivated?.());
    }
    return false;
  }

  getGiantRamManFieldManifestationDefinition() {
    return (getLocationDefinition('reliquary-field')?.fieldManifestations ?? [])
      .find((manifestation) => manifestation.id === 'giant_ram_man_field_altar_manifestation') ?? null;
  }

  ensureGiantRamManFieldManifestation() {
    const manifestation = this.getGiantRamManFieldManifestationDefinition();
    if (!this.shouldManifestGiantRamManInField(manifestation)) return;
    if (this.giantRamManFieldManifestation || this.giantRamManFieldManifestationLoading) return;

    this.giantRamManFieldManifestationLoading = true;
    loadDungeonModel({
      url: manifestation.asset,
      targetHeight: manifestation.targetHeight,
      maxWidth: manifestation.maxWidth,
      scaleMultiplier: manifestation.scaleMultiplier,
    })
      .then(({ root, scale, box }) => {
        const group = new THREE.Group();
        group.name = manifestation.id;
        group.position.copy(this.toVector3(manifestation.position));
        group.rotation.y = manifestation.yaw ?? 0;
        group.userData = {
          ...(manifestation.userData ?? {}),
          fieldManifestation: true,
          staticVisualActor: true,
          id: manifestation.id,
          species: manifestation.species,
          asset: manifestation.asset,
          conditionFlag: manifestation.conditionFlag,
          collision: manifestation.collision ?? 'none',
          combat: 'none',
          interaction: 'none',
          scale,
          bounds: {
            min: { x: box.min.x, y: box.min.y, z: box.min.z },
            max: { x: box.max.x, y: box.max.y, z: box.max.z },
          },
          tags: manifestation.tags ?? [],
        };

        root.name = `${manifestation.id}-model`;
        root.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
        });
        group.add(root);
        this.enableOutdoorReadableShadows(group);
        this.scene.add(group);
        this.giantRamManFieldManifestation = group;

        if (!this.giantRamManFieldManifestationLight) {
          this.giantRamManFieldManifestationLight = new THREE.PointLight(0xd69a45, 1.1, 28, 1.45);
          this.giantRamManFieldManifestationLight.name = 'S01-giant-ram-man-field-altar-manifestation-glow';
          this.giantRamManFieldManifestationLight.position.set(0, 3.8, 3.2);
          this.fieldShrineGroup?.add(this.giantRamManFieldManifestationLight);
        }
      })
      .catch((error) => {
        console.warn(`Giant Ram Man field manifestation failed to load from ${manifestation.asset}.`, error);
      })
      .finally(() => {
        this.giantRamManFieldManifestationLoading = false;
      });
  }

  update(deltaSeconds, player = null) {
    if (this.key) {
      this.key.rotation.y += deltaSeconds * 1.7;
      this.key.position.y = this.keyTarget.y + Math.sin(performance.now() * 0.003) * 0.035;
    }

    if (this.gateOpening && this.gate) {
      this.gate.position.y = Math.min(this.gate.position.y + deltaSeconds * 1.35, 2.45);

      if (this.gate.position.y >= 2.45) {
        this.gateOpening = false;
      }
    }

    this.updateTorchFlicker(deltaSeconds);
    this.updateRamManNpcPatrol(deltaSeconds);
    this.updateBlackGrassFactionEnemies(deltaSeconds, player);
    this.updateSheepDemonEnemy(deltaSeconds, player);
    this.updateReliquaryFieldFoliage(player);
    this.updateRawFishPickups(deltaSeconds);
    this.updateCookedFishPickups(deltaSeconds);
    this.goreRuntime.update(deltaSeconds, { playerPosition: player?.position });
    this.updateAnimatedDungeonMaterials(deltaSeconds);
    this.dungeonDebugRenderer?.update(player?.position);
    this.updateBalthazanFloorCoverageQa(player);
  }

  updateReliquaryFieldFoliage(player = null) {
    if (this.area !== 'field' || !player?.position || !this.fieldFoliageBillboards.length) return;

    this.fieldFoliageBillboards.forEach((billboard) => {
      const dx = player.position.x - billboard.position.x;
      const dz = player.position.z - billboard.position.z;
      const harvested = billboard.userData.harvestableTreeId && this.gameState?.hasHarvestedFieldTree?.(billboard.userData.harvestableTreeId);
      billboard.visible = !harvested && dx * dx + dz * dz <= (billboard.userData.visibleDistanceSq ?? FIELD_FOLIAGE_VISIBLE_DISTANCE_SQ);
      if (!billboard.visible) return;
      billboard.rotation.y = Math.atan2(dx, dz) + (billboard.userData.yawOffset ?? 0);
    });
  }

  activateSouthReliquary() {
    const changed = this.gameState?.collectSouthReliquaryFragment() ?? false;
    this.wakeReliquaryVisuals();

    const reliquaryInteraction = this.inspectInteractions.find((interaction) => interaction.type === 'southReliquary');
    if (reliquaryInteraction) {
      reliquaryInteraction.hint = 'The black reliquary is awake.';
      reliquaryInteraction.message = 'The black reliquary hums inside the stone.';
    }

    return changed;
  }

  wakeReliquaryVisuals() {
    if (this.reliquaryBlock?.material) {
      this.reliquaryBlock.material.color.setHex(0x8f7a5a);
      this.reliquaryBlock.material.emissive.setHex(0x2f1f11);
      this.reliquaryBlock.material.emissiveIntensity = 0.82;
    }

    if (!this.reliquaryAwakeLight) {
      this.reliquaryAwakeLight = new THREE.PointLight(0xc98a3a, 1.8, 13, 1.35);
      this.reliquaryAwakeLight.name = 'RELIC01-black-reliquary-awake-amber-light';
      this.reliquaryAwakeLight.position.set(0, 1.45, 32);
      this.scene.add(this.reliquaryAwakeLight);
    }
  }

  awakenFieldShrine() {
    const shrineInteraction = this.outdoorInteractions.find((interaction) => interaction.type === 'centralShrine');
    if (shrineInteraction) {
      shrineInteraction.hint = 'Tap INTERACT to touch the awakened shrine.';
      shrineInteraction.message = 'The field answers.';
    }

    this.ensureGiantRamManFieldManifestation();

    if (!this.fieldShrineGroup || this.fieldShrineAnswerLight) return;

    this.fieldShrineAnswerLight = new THREE.PointLight(0xd7a13b, 1.9, 22, 1.35);
    this.fieldShrineAnswerLight.name = 'S01-field-answer-warm-unlock-light';
    this.fieldShrineAnswerLight.position.set(0, 2.1, -3.6);
    this.fieldShrineGroup.add(this.fieldShrineAnswerLight);

    this.fieldShrineGroup.traverse((child) => {
      if (!child.material) return;
      if (child.name.includes('answer-seam')) {
        child.material.color.setHex(0xd4bb67);
        child.material.emissive.setHex(0xb18226);
        child.material.emissiveIntensity = 1.15;
        child.material.opacity = 0.82;
      } else if (child.material.emissive) {
        child.material.emissive.setHex(0x241a0e);
        child.material.emissiveIntensity = Math.max(child.material.emissiveIntensity ?? 0, 0.24);
      }
    });
  }

  collectKey() {
    if (!this.key) return false;

    this.scene.remove(this.key);
    this.key.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
    this.key = null;
    return true;
  }

  openGate() {
    if (this.gateOpen) return false;

    this.gateOpen = true;
    this.gateOpening = true;
    this.collision.removeBlocker(this.gateBlocker);

    if (this.gate) {
      this.gate.children.forEach((child) => {
        if (child.material?.emissive) {
          child.material.emissive.setHex(0x332617);
          child.material.emissiveIntensity = 0.45;
        }
      });
    }

    return true;
  }

  openShortcutDoor() {
    if (this.shortcutOpen) return false;

    this.shortcutOpen = true;
    this.collision.removeBlocker(this.shortcutBlocker);

    if (this.shortcutDoor) {
      this.shortcutDoor.rotation.y = -Math.PI / 2;
      this.shortcutDoor.position.x = -6.42;
      this.shortcutDoor.position.z = ROOM_DOORWAY_Z - 0.62;
    }

    return true;
  }

  revealSecret() {
    if (this.secretRevealed) return false;

    this.secretRevealed = true;
    this.collision.removeBlocker(this.secretWallBlocker);

    if (this.secretWall) {
      this.secretWall.position.y = -0.35;
      this.secretWall.rotation.x = -0.08;
    }

    return true;
  }

  useLever() {
    if (this.leverUsed) return false;

    this.leverUsed = true;
    if (this.lever) {
      const handle = this.lever.getObjectByName('lever-handle');
      if (handle) {
        handle.rotation.z = -0.95;
      }
    }
    return true;
  }

  createOutdoorBlockers() {
    const fieldDefinition = getLocationDefinition('reliquary-field');
    const rectangularBlockers = getReliquaryFieldColliders()
      .filter((blocker) => blocker.blocksPlayer !== false)
      .map(({ id, minX, maxX, minZ, maxZ, height, type, tags, userData }) => ({
        id,
        minX,
        maxX,
        minZ,
        maxZ,
        height,
        type,
        tags,
        userData,
      }));
    return [
      ...rectangularBlockers,
      ...createOutdoorCurvedBlockers(fieldDefinition.curvedBlockers),
    ];
  }

  addOutdoorLights() {
    const coldDawnFill = new THREE.HemisphereLight(0x9aa9bb, 0x3d352d, 0.92);
    coldDawnFill.name = 'outdoor-cold-blue-gray-dawn-ambient-fill';
    this.scene.add(coldDawnFill);

    const sunrise = new THREE.DirectionalLight(0xffd79a, 1.08);
    sunrise.name = 'outdoor-low-east-southeast-pale-gold-sunrise';
    sunrise.position.set(135, 28, 95);
    sunrise.target.position.set(-35, 0, -55);
    sunrise.castShadow = true;
    sunrise.shadow.mapSize.set(1024, 1024);
    sunrise.shadow.camera.left = -120;
    sunrise.shadow.camera.right = 120;
    sunrise.shadow.camera.top = 120;
    sunrise.shadow.camera.bottom = -120;
    sunrise.shadow.camera.near = 10;
    sunrise.shadow.camera.far = 260;
    sunrise.shadow.bias = -0.00025;
    this.scene.add(sunrise);
    this.scene.add(sunrise.target);

    const horizonBounce = new THREE.DirectionalLight(0xb9c7d8, 0.22);
    horizonBounce.name = 'outdoor-soft-cool-horizon-readable-fill';
    horizonBounce.position.set(-80, 18, -110);
    this.scene.add(horizonBounce);

    const tombMouthFill = new THREE.PointLight(0xc0a47c, 0.95, 46, 1.75);
    tombMouthFill.name = 'outdoor-muted-warm-crypt-threshold-fill';
    tombMouthFill.position.set(0, 3.2, -25);
    this.scene.add(tombMouthFill);
  }

  addReliquaryFieldSkyDome() {
    const skyUniforms = {
      upperColor: { value: new THREE.Color(0x252b33) },
      midColor: { value: new THREE.Color(0x596065) },
      horizonColor: { value: new THREE.Color(0x9a8662) },
      groundHazeColor: { value: new THREE.Color(0x6f6758) },
    };
    const skyMaterial = new THREE.ShaderMaterial({
      name: 'FIELD-SKYDOME-haunted-dawn-vertical-gradient-material',
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        uniform vec3 upperColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 groundHazeColor;
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float vertical = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
          float horizon = 1.0 - smoothstep(0.48, 0.68, vertical);
          vec3 dawn = mix(horizonColor, midColor, smoothstep(0.46, 0.74, vertical));
          vec3 sky = mix(dawn, upperColor, smoothstep(0.62, 1.0, vertical));
          sky = mix(sky, groundHazeColor, horizon * 0.22);
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(FIELD_SKYDOME_RADIUS, 32, 16), skyMaterial);
    dome.name = 'FIELD-SKYDOME-haunted-dawn-dust-horizon-gradient';
    dome.renderOrder = -1000;
    dome.userData = {
      fieldOnly: true,
      visualOnly: true,
      purpose: 'Replaces flat gray outdoor void with a cheap haunted dawn gradient and warm dusty horizon band.',
      collision: 'none',
    };
    this.scene.add(dome);
  }

  addReliquaryFieldHorizonSystem() {
    const horizonGroup = new THREE.Group();
    horizonGroup.name = 'FIELD-HORIZON-layered-world-edge-ridge-forest-haze-system';
    horizonGroup.userData = {
      fieldOnly: true,
      visualOnly: true,
      collision: 'none',
      performance: 'static low-poly ridge mesh plus a fixed count of non-interactive distant billboard silhouettes; no shadows, colliders, particles, or per-frame work',
    };

    horizonGroup.add(this.createReliquaryFieldRidgeRing());
    horizonGroup.add(this.createReliquaryFieldDistantForestBand());
    horizonGroup.add(this.createReliquaryFieldRuinSilhouettes());
    this.scene.add(horizonGroup);
  }

  createReliquaryFieldRidgeRing() {
    const vertices = [];
    const indices = [];
    const color = new THREE.Color();
    const colors = [];
    const pushVertex = (x, y, z, hex) => {
      vertices.push(x, y, z);
      color.setHex(hex);
      colors.push(color.r, color.g, color.b);
      return (vertices.length / 3) - 1;
    };

    for (let i = 0; i <= FIELD_HORIZON_RIDGE_SEGMENTS; i += 1) {
      const t = i / FIELD_HORIZON_RIDGE_SEGMENTS;
      const angle = t * Math.PI * 2;
      const wave = Math.sin(angle * 3.0 + 0.5) * 6 + Math.sin(angle * 7.0) * 4 + Math.sin(angle * 13.0 + 1.7) * 2.5;
      const radius = FIELD_HORIZON_RIDGE_RADIUS + Math.sin(angle * 5.0) * 12 + Math.sin(angle * 11.0 + 0.4) * 5;
      const baseY = -3.6 + Math.sin(angle * 4.0) * 0.8;
      const crestY = 12 + wave + (Math.sin(angle - 0.4) > 0.78 ? 8 : 0);
      const innerBase = pushVertex(Math.cos(angle) * (radius - 18), baseY, Math.sin(angle) * (radius - 18), 0x2a241d);
      const crest = pushVertex(Math.cos(angle) * radius, crestY, Math.sin(angle) * radius, 0x171412);
      const outerBase = pushVertex(Math.cos(angle) * (radius + 20), baseY - 1.2, Math.sin(angle) * (radius + 20), 0x3b342b);
      if (i < FIELD_HORIZON_RIDGE_SEGMENTS) {
        const n = i * 3;
        indices.push(n, n + 1, n + 3, n + 1, n + 4, n + 3, n + 1, n + 2, n + 4, n + 2, n + 5, n + 4);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, side: THREE.DoubleSide });
    material.name = 'FIELD-HORIZON-broken-black-earth-ridge-fogged-basic-material';
    const ridge = new THREE.Mesh(geometry, material);
    ridge.name = 'FIELD-HORIZON-distant-broken-ridge-ring-visual-only';
    ridge.userData = { collision: 'none', visualOnly: true, radius: FIELD_HORIZON_RIDGE_RADIUS };
    return ridge;
  }

  createReliquaryFieldDistantForestBand() {
    const group = new THREE.Group();
    group.name = `FIELD-HORIZON-distant-redwood-lod-strip-${FIELD_HORIZON_FOREST_COUNT}-billboards`;
    const geometry = new THREE.PlaneGeometry(1, 1);
    const materials = FIELD_REDWOOD_SPRITES.map((sprite) => new THREE.MeshBasicMaterial({
      map: this.loadFoliageTexture(sprite.path),
      color: 0x2c3028,
      transparent: true,
      opacity: 0.72,
      alphaTest: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
      toneMapped: false,
    }));
    materials.forEach((material, index) => { material.name = `${FIELD_REDWOOD_SPRITES[index].id}-distant-haze-lod-material`; });

    for (let i = 0; i < FIELD_HORIZON_FOREST_COUNT; i += 1) {
      const angle = (i / FIELD_HORIZON_FOREST_COUNT) * Math.PI * 2;
      const radius = FIELD_HORIZON_FOREST_RADIUS + Math.sin(angle * 9.0) * 10 + ((i % 5) - 2) * 2.5;
      const height = 22 + (i % 7) * 2.1 + Math.sin(angle * 6.0) * 4;
      const width = height * (0.32 + (i % 3) * 0.035);
      const mesh = new THREE.Mesh(geometry, materials[i % materials.length]);
      mesh.name = `FIELD-HORIZON-redwood-silhouette-lod-${String(i + 1).padStart(3, '0')}`;
      mesh.position.set(Math.cos(angle) * radius, height * 0.5 - 2.5, Math.sin(angle) * radius);
      mesh.scale.set(width, height, 1);
      mesh.rotation.y = -angle + Math.PI / 2 + (((i % 4) - 1.5) * 0.05);
      mesh.userData = { collision: 'none', visualOnly: true, harvestable: false, distantHorizonLod: true };
      group.add(mesh);
    }
    return group;
  }

  createReliquaryFieldRuinSilhouettes() {
    const group = new THREE.Group();
    group.name = 'FIELD-HORIZON-sparse-broken-ritual-ruin-silhouettes';
    const material = new THREE.MeshBasicMaterial({ color: 0x181411, fog: true });
    material.name = 'FIELD-HORIZON-distant-ruin-silhouette-material';
    [-2.55, -0.78, 0.42, 1.88, 2.72].forEach((angle, index) => {
      const radius = FIELD_HORIZON_RIDGE_RADIUS - 6 + (index % 2) * 10;
      const height = 10 + index * 1.6;
      const ruin = new THREE.Mesh(new THREE.BoxGeometry(3.2 + index * 0.5, height, 2.5), material);
      ruin.name = `FIELD-HORIZON-broken-monolith-silhouette-${String(index + 1).padStart(2, '0')}`;
      ruin.position.set(Math.cos(angle) * radius, height * 0.5 - 1.8, Math.sin(angle) * radius);
      ruin.rotation.y = -angle + 0.25;
      ruin.rotation.z = (index % 2 === 0 ? -0.1 : 0.08);
      ruin.userData = { collision: 'none', visualOnly: true };
      group.add(ruin);
    });
    return group;
  }

  addOutdoorTerrain(terrainDefinition, textureProfiles = {}, outdoorDefinition = {}) {
    const terrain = createOutdoorTerrainMesh(terrainDefinition ?? {
      size: [FIELD_SIZE, FIELD_SIZE],
      segments: [1, 1],
      baseY: 0,
      material: 'fieldGrass',
      heightStamps: [],
    }, {
      textures: textureProfiles,
      name: 'TERRAIN01-reliquary-field-oarb-heightfield-terrain',
      makeMaterial: (profile, metadata) => {
        const material = this.makeTexturedMaterial(profile);
        material.userData = {
          ...(material.userData ?? {}),
          oarbTerrainMaterial: true,
          materialKey: metadata.materialKey,
          materialFallbackUsed: metadata.usedFallback,
          sourceProfile: metadata.profile,
        };
        return material;
      },
    });
    terrain.userData = {
      ...terrain.userData,
      blueprint: 'docs/DARB_OUTDOOR_AUTHORING_RUNTIME_MILESTONE.md',
      legacyFieldBlueprint: 'docs/world/overworld/reliquary_field_v01.md',
      longTermBlueprintSize: 800,
      playerGroundingChanged: true,
    };
    this.outdoorTerrainRuntime = terrain.userData.terrainSampler;
    if (this.collision && this.area === 'field') this.collision.outdoorTerrainSampler = this.outdoorTerrainRuntime;
    this.scene.add(terrain);

    createOutdoorSplineTrailMeshes(outdoorDefinition.splineTrails, {
      terrainSampler: this.outdoorTerrainRuntime,
      textures: textureProfiles,
      makeMaterial: (profile, metadata) => {
        const material = this.makeTexturedMaterial(profile);
        material.userData = {
          ...(material.userData ?? {}),
          oarbSplineTrailMaterial: true,
          materialKey: metadata.materialKey,
          materialFallbackUsed: metadata.usedFallback,
          sourceProfile: metadata.profile,
        };
        return material;
      },
    }).forEach((trailMesh) => this.scene.add(trailMesh));

    createOutdoorPrimitiveMeshes(outdoorDefinition.outdoorPrimitives, {
      terrainSampler: this.outdoorTerrainRuntime,
      textures: textureProfiles,
      makeMaterial: (profile, metadata) => {
        const material = this.makeTexturedMaterial(profile);
        material.userData = {
          ...(material.userData ?? {}),
          oarbOutdoorPrimitiveMaterial: true,
          materialKey: metadata.materialKey,
          materialFallbackUsed: metadata.usedFallback,
          sourceProfile: metadata.profile,
        };
        return material;
      },
    }).forEach((primitiveGroup) => this.scene.add(primitiveGroup));
  }

  addReliquaryFieldRiverBoundary() {
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0c1820, roughness: 0.88, metalness: 0.0, transparent: true, opacity: 0.82, emissive: 0x020609, emissiveIntensity: 0.28 });
    const specs = [
      { name: 'north', size: [FIELD_SIZE + 46, 24], pos: [0, -194] },
      { name: 'south', size: [FIELD_SIZE + 46, 24], pos: [0, 194] },
      { name: 'west', size: [24, FIELD_SIZE + 46], pos: [-194, 0] },
      { name: 'east', size: [24, FIELD_SIZE + 46], pos: [194, 0] },
    ];
    specs.forEach((spec) => {
      const geometry = new THREE.PlaneGeometry(spec.size[0], spec.size[1], 1, 1);
      geometry.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geometry, waterMat);
      mesh.name = `FIELD-RIVER-${spec.name}-dark-cursed-water-boundary-seam-cover`;
      mesh.position.set(spec.pos[0], 0.035, spec.pos[1]);
      mesh.userData = { collision: 'visual-only water boundary', fishing: true, performance: 'single static low-poly strip; no reflections, physics, or per-frame raycasts' };
      this.scene.add(mesh);
    });
    this.fieldFishingZones = specs.map((spec) => ({
      id: `field_river_fishing_${spec.name}`,
      name: spec.name,
      minX: spec.pos[0] - spec.size[0] / 2,
      maxX: spec.pos[0] + spec.size[0] / 2,
      minZ: spec.pos[1] - spec.size[1] / 2,
      maxZ: spec.pos[1] + spec.size[1] / 2,
      interactPadding: FIELD_FISHING_INTERACT_PADDING,
      position: new THREE.Vector3(spec.pos[0], 0, spec.pos[1]),
    }));
  }

  getNearbyFishingZone(position) {
    if (this.area !== 'field' || !position) return null;
    return this.fieldFishingZones.find((zone) => (
      position.x >= zone.minX - zone.interactPadding
      && position.x <= zone.maxX + zone.interactPadding
      && position.z >= zone.minZ - zone.interactPadding
      && position.z <= zone.maxZ + zone.interactPadding
    )) ?? null;
  }

  isPositionInFishingWater(position, margin = 0.35) {
    if (this.area !== 'field' || !position) return false;
    return this.fieldFishingZones.some((zone) => (
      position.x >= zone.minX - margin
      && position.x <= zone.maxX + margin
      && position.z >= zone.minZ - margin
      && position.z <= zone.maxZ + margin
    ));
  }

  getRawFishLandingPosition(player) {
    if (!player?.position) return null;
    const forward = typeof player.getLookDirection === 'function'
      ? player.getLookDirection().clone()
      : new THREE.Vector3(Math.sin(player.yaw ?? 0), 0, Math.cos(player.yaw ?? 0));
    forward.y = 0;
    if (forward.lengthSq() < 0.001) forward.set(0, 0, 1);
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
    const base = player.position.clone();
    const clampToField = (position) => {
      position.x = THREE.MathUtils.clamp(position.x, -FIELD_HALF_SIZE + 3, FIELD_HALF_SIZE - 3);
      position.z = THREE.MathUtils.clamp(position.z, -FIELD_HALF_SIZE + 3, FIELD_HALF_SIZE - 3);
      position.y = 0.24;
      return position;
    };
    const candidates = [
      base.clone().addScaledVector(forward, 1.15),
      base.clone().addScaledVector(forward, 1.35),
      base.clone().addScaledVector(forward, 0.95).addScaledVector(right, 0.55),
      base.clone().addScaledVector(forward, 0.95).addScaledVector(right, -0.55),
      base.clone().addScaledVector(right, 0.75),
      base.clone().addScaledVector(right, -0.75),
    ].map(clampToField);
    return candidates.find((candidate) => !this.isPositionInFishingWater(candidate)) ?? candidates[0] ?? null;
  }

  addOutdoorBoundary() {
    const boundaryMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const boundarySpecs = [
      { id: 'BOUND01', size: new THREE.Vector3(400, 3, 2), position: new THREE.Vector3(0, 1.5, 200) },
      { id: 'BOUND02', size: new THREE.Vector3(400, 3, 2), position: new THREE.Vector3(0, 1.5, -200) },
      { id: 'BOUND03', size: new THREE.Vector3(2, 3, 400), position: new THREE.Vector3(-200, 1.5, 0) },
      { id: 'BOUND04', size: new THREE.Vector3(2, 3, 400), position: new THREE.Vector3(200, 1.5, 0) },
    ];

    boundarySpecs.forEach((boundary) => {
      const mesh = this.addBox({ ...boundary, material: boundaryMaterial, name: `${boundary.id}-invisible-solid-slice-boundary` });
      mesh.userData.collision = 'solid invisible boundary';
    });
  }

  createFieldFoliageRandom(seed = 0x5eedf011) {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  isFieldFoliageSafePosition(x, z) {
    if (z < -188 && Math.abs(x) < 34) return false;
    if (Math.abs(x) < 12 && z > -185 && z < 18) return false;
    if (x > -83 && x < -37 && z > -123 && z < -84) return false;
    if (x > -196 && x < -165 && z > 4 && z < 48) return false;
    if (x > 122 && x < 162 && z > -90 && z < -48) return false;
    if (x > 80 && x < 164 && z > 132 && z < 160) return false;

    return !FIELD_FOLIAGE_CLEAR_ZONES.some((zone) => {
      const dx = x - zone.x;
      const dz = z - zone.z;
      return dx * dx + dz * dz < zone.radius * zone.radius;
    });
  }

  createReliquaryFieldFoliagePlacements() {
    const random = this.createFieldFoliageRandom();
    const placements = [];
    const counts = { redwood: 0, mid: 0, bush: 0 };
    const spritePools = {
      redwood: FIELD_REDWOOD_SPRITES,
      mid: FIELD_SMALL_FOLIAGE_SPRITES.filter((sprite) => sprite.type === 'tree'),
      bush: FIELD_SMALL_FOLIAGE_SPRITES.filter((sprite) => sprite.type === 'bush'),
    };
    const targetForLayer = (layer) => (layer === 'redwood'
      ? FIELD_REDWOOD_COUNT_TARGET
      : layer === 'mid'
        ? FIELD_MID_FOLIAGE_COUNT_TARGET
        : FIELD_BUSH_COUNT_TARGET);
    const chooseSprite = (layer, preferredIndex = null) => {
      const sprites = spritePools[layer];
      if (preferredIndex !== null) return sprites[preferredIndex % sprites.length];
      return sprites[Math.floor(random() * sprites.length) % sprites.length];
    };
    const sinkRatioForLayer = (layer) => {
      const [min, max] = layer === 'redwood'
        ? [FIELD_REDWOOD_SINK_RATIO_MIN, FIELD_REDWOOD_SINK_RATIO_MAX]
        : layer === 'mid'
          ? [FIELD_MID_FOLIAGE_SINK_RATIO_MIN, FIELD_MID_FOLIAGE_SINK_RATIO_MAX]
          : [FIELD_BUSH_SINK_RATIO_MIN, FIELD_BUSH_SINK_RATIO_MAX];
      return min + random() * (max - min);
    };
    const pushPlacement = ({ x, z, zone, layer, minScale, maxScale, hero = false, preferredIndex = null }) => {
      if (counts[layer] >= targetForLayer(layer) || !this.isFieldFoliageSafePosition(x, z)) return false;
      const sprite = chooseSprite(layer, preferredIndex);
      const scale = minScale + random() * (maxScale - minScale);
      const sinkRatio = sinkRatioForLayer(layer);
      const sinkDepth = scale * sinkRatio;
      counts[layer] += 1;
      placements.push({
        id: `field-foliage-${String(placements.length + 1).padStart(3, '0')}`,
        spriteId: sprite.id,
        x,
        z,
        y: FIELD_FOLIAGE_GROUND_Y + scale * 0.5 - sinkDepth,
        scale,
        sinkRatio,
        sinkDepth,
        width: sprite.width,
        yawOffset: (random() - 0.5) * (layer === 'redwood' ? 0.18 : 0.36),
        zone,
        layer,
        hero,
        visibleDistanceSq: layer === 'redwood' ? FIELD_REDWOOD_VISIBLE_DISTANCE_SQ : FIELD_FOLIAGE_VISIBLE_DISTANCE_SQ,
      });
      return true;
    };

    if (FIELD_TREE_WALL_ENABLED) {
      for (let i = 0; i < FIELD_TREE_WALL_REDWOOD_COUNT; i += 1) {
        const angle = (Math.PI * 2 * i) / FIELD_TREE_WALL_REDWOOD_COUNT;
        const radius = FIELD_TREE_WALL_MIN_RADIUS + random() * (FIELD_TREE_WALL_MAX_RADIUS - FIELD_TREE_WALL_MIN_RADIUS);
        pushPlacement({
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
          zone: 'continuous-perimeter-redwood-wall',
          layer: 'redwood',
          minScale: 12.5,
          maxScale: 18.0,
          preferredIndex: i,
        });
      }
      for (let i = 0; i < FIELD_TREE_WALL_UNDERGROWTH_COUNT; i += 1) {
        const angle = (Math.PI * 2 * (i + 0.5)) / FIELD_TREE_WALL_UNDERGROWTH_COUNT;
        const radius = FIELD_TREE_WALL_MIN_RADIUS - 8 + random() * (FIELD_TREE_WALL_MAX_RADIUS - FIELD_TREE_WALL_MIN_RADIUS + 10);
        pushPlacement({
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
          zone: 'continuous-perimeter-understory-wall',
          layer: i % 2 === 0 ? 'mid' : 'bush',
          minScale: i % 2 === 0 ? 3.4 : 1.3,
          maxScale: i % 2 === 0 ? 6.5 : 2.8,
          preferredIndex: i,
        });
      }
    }

    const heroRedwoods = [
      { x: -44, z: -142 }, { x: 46, z: -132 }, { x: -112, z: -42 },
      { x: 96, z: -34 }, { x: -142, z: 82 }, { x: 132, z: 58 },
      { x: -52, z: 142 }, { x: 58, z: 116 },
    ];
    heroRedwoods.forEach((tree, index) => {
      pushPlacement({ ...tree, zone: 'hero-carved-legend-redwood', layer: 'redwood', minScale: 15.0, maxScale: 18.0, hero: true, preferredIndex: index });
    });

    for (let i = 0; counts.redwood < 40 && i < 260; i += 1) {
      const side = i % 4;
      const edgeJitter = random() * 26;
      const x = side === 0 ? -190 + edgeJitter : side === 1 ? 190 - edgeJitter : -186 + random() * 372;
      const z = side === 2 ? -190 + edgeJitter : side === 3 ? 190 - edgeJitter : -186 + random() * 372;
      pushPlacement({ x, z, zone: 'outer-redwood-forest-ring', layer: 'redwood', minScale: 11.5, maxScale: 17.0 });
    }

    const clusterCenters = [
      { x: -92, z: -126 }, { x: -102, z: -70 }, { x: -164, z: 70 }, { x: -130, z: 118 },
      { x: 112, z: -116 }, { x: 172, z: -18 }, { x: 78, z: 88 }, { x: 18, z: 166 },
      { x: -24, z: 62 }, { x: 118, z: 18 },
    ];
    clusterCenters.forEach((center, clusterIndex) => {
      for (let i = 0; i < 5; i += 1) {
        const angle = random() * Math.PI * 2;
        const radius = 8 + random() * 30;
        pushPlacement({
          x: center.x + Math.cos(angle) * radius,
          z: center.z + Math.sin(angle) * radius,
          zone: clusterIndex < 2 ? 'crypt-framing-redwood-cluster' : 'interior-redwood-cluster',
          layer: 'redwood',
          minScale: 10.0,
          maxScale: 15.5,
        });
      }
    });

    const pushLayerScatter = (layer, zone, minScale, maxScale, bounds, desiredAdds = Infinity, attemptsLimit = 1400) => {
      let attempts = 0;
      let added = 0;
      while (counts[layer] < targetForLayer(layer) && added < desiredAdds && attempts < attemptsLimit) {
        attempts += 1;
        const before = counts[layer];
        const angle = random() * Math.PI * 2;
        const radius = bounds.minRadius + random() * (bounds.maxRadius - bounds.minRadius);
        pushPlacement({
          x: bounds.x + Math.cos(angle) * radius,
          z: bounds.z + Math.sin(angle) * radius,
          zone,
          layer,
          minScale,
          maxScale,
        });
        if (counts[layer] > before) added += 1;
      }
    };

    clusterCenters.forEach((center) => {
      pushLayerScatter('mid', 'mid-forest-body-cluster', 3.0, 6.2, { ...center, minRadius: 5, maxRadius: 48 }, 14, 360);
      pushLayerScatter('bush', 'dark-understory-path-edge', 1.2, 2.7, { ...center, minRadius: 4, maxRadius: 42 }, 13, 320);
    });
    pushLayerScatter('redwood', 'landmark-redwood-backfill-grove', 10.5, 16.5, { x: 0, z: 0, minRadius: 70, maxRadius: 182 }, Infinity, 900);
    pushLayerScatter('mid', 'outer-mid-tree-wall', 3.2, 6.0, { x: 0, z: 0, minRadius: 92, maxRadius: 194 }, Infinity, 2400);
    pushLayerScatter('bush', 'outer-bramble-understory', 1.2, 2.6, { x: 0, z: 0, minRadius: 42, maxRadius: 192 }, Infinity, 2400);

    return placements;
  }

  loadFoliageTexture(path) {
    const texture = this.textureLoader.load(path);
    texture.name = path;
    texture.userData = { path, foliageBillboard: true };
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  addReliquaryFieldFoliage() {
    const group = new THREE.Group();
    group.name = `FIELD-FOLIAGE-rich-billboard-forest-${FIELD_FOLIAGE_INSTANCE_TARGET}-instances`;
    group.userData = {
      fieldOnly: true,
      billboardCount: FIELD_FOLIAGE_INSTANCE_TARGET,
      forestDensity: FIELD_FOREST_DENSITY,
      redwoodCount: FIELD_REDWOOD_COUNT_TARGET,
      midFoliageCount: FIELD_MID_FOLIAGE_COUNT_TARGET,
      bushCount: FIELD_BUSH_COUNT_TARGET,
      spriteCount: FIELD_FOLIAGE_SPRITES.length,
      redwoodSpriteCount: FIELD_REDWOOD_SPRITES.length,
      placementStrategy: 'seeded dense outer redwood ring, deterministic continuous perimeter tree wall, rich interior forest clusters, path-safe understory, and landmark carved legend trees',
      treeWallEnabled: FIELD_TREE_WALL_ENABLED,
      treeWallRedwoodCount: FIELD_TREE_WALL_REDWOOD_COUNT,
      treeWallUndergrowthCount: FIELD_TREE_WALL_UNDERGROWTH_COUNT,
      grounding: 'centered planes placed at ground plus half height minus per-layer sink depth',
      collision: 'visual only; no per-sprite blockers',
    };

    const geometry = new THREE.PlaneGeometry(1, 1);
    const materials = new Map(FIELD_FOLIAGE_SPRITES.map((sprite) => {
      const material = new THREE.MeshBasicMaterial({
        map: this.loadFoliageTexture(sprite.path),
        transparent: true,
        alphaTest: FIELD_FOLIAGE_ALPHA_TEST,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      material.name = `${sprite.id}-alpha-tested-billboard-material`;
      return [sprite.id, material];
    }));

    this.fieldFoliageBillboards = this.createReliquaryFieldFoliagePlacements().map((placement) => {
      const mesh = new THREE.Mesh(geometry, materials.get(placement.spriteId));
      mesh.name = `${placement.id}-${placement.spriteId}-${placement.zone}`;
      mesh.position.set(placement.x, placement.y, placement.z);
      mesh.scale.set(placement.scale * placement.width, placement.scale, 1);
      mesh.rotation.y = placement.yawOffset;
      mesh.userData = { ...placement, billboard: true, collision: 'none' };
      if (placement.layer === 'redwood' && placement.harvestable !== false) {
        const harvestable = this.createRedwoodHarvestable(placement, mesh);
        mesh.userData.harvestableTreeId = harvestable.id;
      }
      group.add(mesh);
      return mesh;
    });

    this.fieldFoliageGroup = group;
    this.scene.add(group);
  }

  addReliquaryFieldStructures() {
    this.addBrokenShrine();
    this.addSouthReliquaryCrypt();
    this.addBlackGrassTempleExterior();
    this.addFieldKeeperHouseExterior();
    this.addDdplusLevel1TestEntrance();
    this.addSumerianCityBlockV0TestEntrance();
    this.addSumerianSunPalaceDistrictV1TestEntrance();
    this.addSumerianCanalMarketDistrictV2Entrance();
    this.addKerovacEntrance();
    this.addOarbProvingGroundsEntrance();
    this.addBalthazanEntrance();
    this.addSunkenCentralTomb();
    this.addStandingStoneCluster();
    this.addLowRuinWalls();
  }

  addFieldSurvivalLoopObjects() {
    this.addFieldSurvivalChest({
      id: FIELD_SURVIVAL_PLACEMENTS.axeChest.id,
      label: 'Wood Axe Chest',
      position: FIELD_SURVIVAL_PLACEMENTS.axeChest.position,
      itemId: 'wood_axe',
      acquiredMessage: 'Wood Axe Acquired.',
    });
    this.addFieldSurvivalChest({
      id: FIELD_SURVIVAL_PLACEMENTS.flintStickChest.id,
      label: 'Flint Stick Chest',
      position: FIELD_SURVIVAL_PLACEMENTS.flintStickChest.position,
      itemId: 'flint_stick',
      acquiredMessage: 'Flint Stick Acquired.',
    });
    this.addFieldSurvivalChest({ id: FIELD_SURVIVAL_PLACEMENTS.fishingRodChest.id, label: 'Fishing Rod Chest', position: FIELD_SURVIVAL_PLACEMENTS.fishingRodChest.position, itemId: 'fishing_rod', acquiredMessage: 'Fishing Rod Acquired.' });
    this.restoreHarvestedRedwoodVisuals();
    this.addCampfireCraftingPrompt();

    const savedCampfires = this.gameState?.getFieldCampfires?.() ?? [];
    savedCampfires.forEach((campfire) => {
      const position = campfire.position;
      if (position) this.addFieldCampfire(new THREE.Vector3(position.x, position.y ?? 0, position.z), campfire.id);
    });
  }

  addFieldSurvivalChest({ id, label, position, itemId, acquiredMessage }) {
    const opened = this.gameState?.hasOpenedFieldChest?.(id) ?? false;
    const looted = this.gameState?.hasLootedFieldChest?.(id) ?? false;
    const group = this.createFieldChestGroup(opened);
    group.name = `${id}-visual`;
    group.position.set(position.x, position.y, position.z);
    this.scene.add(group);
    this.fieldSurvivalObjects.set(id, group);

    this.outdoorInteractions.push({
      id,
      label,
      target: new THREE.Vector3(position.x, 1, position.z),
      range: 4.0,
      hint: looted ? 'Empty.' : opened ? 'Retrieve item' : 'Open chest',
      message: looted ? 'Empty.' : opened ? acquiredMessage : 'Chest opened.',
      type: 'fieldSurvivalChest',
      itemId,
      acquiredMessage,
      repeatHint: 'Empty.',
      repeatMessage: 'Empty.',
    });
  }

  createFieldChestGroup(opened = false) {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2b18, roughness: 0.92, metalness: 0.0, emissive: 0x100805, emissiveIntensity: 0.12 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f1d1b, roughness: 0.78, metalness: 0.35 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.65, 0.9), woodMat);
    base.position.y = 0.33;
    group.add(base);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.18, 0.96), woodMat);
    lid.position.set(0, opened ? 0.92 : 0.73, opened ? -0.42 : 0);
    lid.rotation.x = opened ? -0.72 : 0;
    group.add(lid);
    [-0.48, 0.48].forEach((x) => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.78, 0.98), ironMat);
      band.position.set(x, 0.42, 0);
      group.add(band);
    });
    return group;
  }

  createRedwoodHarvestable(placement, mesh) {
    const isHero = Boolean(placement.hero);
    const isBoundary = placement.zone === 'continuous-perimeter-redwood-wall';
    const id = `redwood_harvest_${String(this.fieldRedwoodHarvestables.length + 1).padStart(3, '0')}`;
    const harvestable = {
      id,
      kind: 'redwood',
      position: new THREE.Vector3(placement.x, 0, placement.z),
      target: new THREE.Vector3(placement.x, 1, placement.z),
      interactRadius: isHero ? 7.0 : 5.5,
      range: isHero ? 7.0 : 5.5,
      yield: isHero ? 3 : isBoundary ? 2 : 1,
      assetId: placement.spriteId,
      label: isHero ? 'Hero Redwood' : 'Redwood',
      type: 'fieldHarvestableTree',
      treeObject: mesh,
      stumpPosition: new THREE.Vector3(placement.x, 0, placement.z),
      zone: placement.zone,
    };
    this.fieldRedwoodHarvestables.push(harvestable);
    return harvestable;
  }

  restoreHarvestedRedwoodVisuals() {
    this.fieldRedwoodHarvestables.forEach((tree) => {
      if (!this.gameState?.hasHarvestedFieldTree?.(tree.id)) return;
      if (tree.treeObject) tree.treeObject.visible = false;
      this.addFieldStump(tree.stumpPosition, tree.id);
    });
  }

  getNearbyFieldHarvestableRedwood(position) {
    if (this.area !== 'field' || !position || !this.fieldRedwoodHarvestables.length) return null;
    let nearest = null;
    let nearestDistanceSq = Infinity;
    this.fieldRedwoodHarvestables.forEach((tree) => {
      if (this.gameState?.hasHarvestedFieldTree?.(tree.id)) return;
      const dx = position.x - tree.position.x;
      const dz = position.z - tree.position.z;
      const range = tree.interactRadius ?? 5.5;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq > range * range || distanceSq >= nearestDistanceSq) return;
      nearest = tree;
      nearestDistanceSq = distanceSq;
    });
    return nearest;
  }

  addHarvestableFieldTree() {
    const { id, position } = FIELD_SURVIVAL_PLACEMENTS.harvestableTree;
    const harvested = this.gameState?.hasHarvestedFieldTree?.(id) ?? false;
    const harvestableBillboard = this.fieldFoliageBillboards.find((mesh) => mesh.userData?.hero && Math.abs(mesh.position.x - position.x) < 1 && Math.abs(mesh.position.z - position.z) < 1);
    if (harvestableBillboard) {
      harvestableBillboard.name = `${id}-harvestable-${harvestableBillboard.name}`;
      harvestableBillboard.userData.harvestableTreeId = id;
      harvestableBillboard.visible = !harvested;
    }
    if (harvested) this.addFieldStump(new THREE.Vector3(position.x, 0, position.z), id);

    this.outdoorInteractions.push({
      id,
      label: 'Harvestable Redwood',
      target: new THREE.Vector3(position.x, 1, position.z),
      range: 6.5,
      hint: harvested ? 'The chopped stump is dry and bare.' : '',
      message: harvested ? 'The chopped stump is dry and bare.' : 'Equip Wood Axe.',
      type: 'fieldHarvestableTree',
      treeObject: harvestableBillboard,
      stumpPosition: new THREE.Vector3(position.x, 0, position.z),
    });
  }

  addFieldStump(position, id = 'field-stump') {
    const stumpMat = new THREE.MeshStandardMaterial({ color: 0x3b2114, roughness: 0.96, emissive: 0x0b0503, emissiveIntensity: 0.1 });
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.94, 0.62, 9), stumpMat);
    stump.name = `${id}-chopped-stump`;
    stump.position.set(position.x, 0.31, position.z);
    this.scene.add(stump);
    this.fieldSurvivalObjects.set(`${id}-stump`, stump);
    return stump;
  }

  addCampfireCraftingPrompt() {
    this.outdoorInteractions.push({
      id: 'field_survival_craft_campfire',
      label: 'Campfire Crafting',
      target: new THREE.Vector3(0, 1, -146),
      range: 7.5,
      hint: 'Need Wood.',
      message: 'Need Wood.',
      type: 'fieldCampfireCraft',
      fixedCraftStation: true,
    });
  }

  isFieldCampfireOpenGround(position) {
    if (!position || this.area !== 'field') return false;
    const x = position.x;
    const z = position.z;
    if (Math.abs(x) > 168 || Math.abs(z) > 168) return false;
    if (!this.isFieldFoliageSafePosition(x, z)) return false;
    const protectedTargets = this.outdoorInteractions.filter((interaction) => interaction.type !== 'fieldCampfireCraft');
    return !protectedTargets.some((interaction) => {
      const dx = x - interaction.target.x;
      const dz = z - interaction.target.z;
      const radius = Math.max(5.5, (interaction.range ?? 4) + 2.5);
      return dx * dx + dz * dz < radius * radius;
    });
  }

  getFieldCampfirePlacement(player) {
    if (!player?.position || this.area !== 'field') return null;
    const forward = typeof player.getLookDirection === 'function'
      ? player.getLookDirection()
      : new THREE.Vector3(Math.sin(player.yaw ?? 0), 0, Math.cos(player.yaw ?? 0)).normalize();
    const base = player.position.clone();
    const candidates = [3.0, 4.2, 2.2].map((distance) => base.clone().addScaledVector(forward, distance));
    candidates.push(base.clone().add(new THREE.Vector3(2.8, 0, 0)), base.clone().add(new THREE.Vector3(-2.8, 0, 0)));
    const open = candidates.find((candidate) => {
      candidate.y = 0;
      return this.isFieldCampfireOpenGround(candidate);
    });
    return open ? new THREE.Vector3(open.x, 0, open.z) : null;
  }

  spawnCookedFishPickup(position) {
    const pickupId = `field_cooked_fish_${Date.now()}_${this.fieldCookedFishPickups.length + 1}`;
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.9, emissive: 0x120805, emissiveIntensity: 0.15 });
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 4, 8), mat);
    mesh.name = `${pickupId}-brown-placeholder-pickup`;
    mesh.position.set(position.x, 0.75, position.z);
    mesh.rotation.z = Math.PI / 2;
    this.scene.add(mesh);
    const landing = new THREE.Vector3(position.x + 1.15, 0.28, position.z + 0.45);
    const pickup = { id: pickupId, mesh, start: mesh.position.clone(), target: landing.clone(), elapsed: 0, duration: 0.65 };
    this.fieldCookedFishPickups.push(pickup);
    this.outdoorInteractions.push({ id: pickupId, label: 'Cooked Fish', target: landing.clone().setY(1), range: 2.4, hint: 'Pick up Cooked Fish', message: 'Cooked Fish Acquired.', type: 'cookedFishPickup', pickup });
    return pickup;
  }

  createRawFishPickupMesh() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6f766f, roughness: 0.82, emissive: 0x101413, emissiveIntensity: 0.12 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x4e5a55, roughness: 0.88, emissive: 0x090d0c, emissiveIntensity: 0.1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), bodyMat);
    body.scale.set(1.7, 0.38, 0.56);
    body.rotation.z = Math.PI / 2;
    group.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 3), tailMat);
    tail.position.x = -0.47;
    tail.rotation.z = -Math.PI / 2;
    tail.scale.z = 0.42;
    group.add(tail);
    return group;
  }

  spawnRawFishPickupForPlayer(player) {
    if (this.area !== 'field') return null;
    const landing = this.getRawFishLandingPosition(player);
    if (!landing) return null;
    if (this.fieldRawFishPickups.length >= MAX_FIELD_RAW_FISH_PICKUPS) {
      this.removeRawFishPickup(this.fieldRawFishPickups[0]);
    }
    const pickupId = `field_raw_fish_${Date.now()}_${this.fieldRawFishPickups.length + 1}`;
    const mesh = this.createRawFishPickupMesh();
    mesh.name = `${pickupId}-gray-raw-fish-placeholder-pickup`;
    mesh.position.set(landing.x, 0.9, landing.z);
    mesh.rotation.y = player?.yaw ?? 0;
    this.scene.add(mesh);
    const pickup = { id: pickupId, mesh, start: mesh.position.clone(), target: landing.clone().setY(0.26), elapsed: 0, duration: 0.55 };
    this.fieldRawFishPickups.push(pickup);
    this.outdoorInteractions.push({ id: pickupId, label: 'Raw Fish', target: landing.clone().setY(0.9), range: 2.85, hint: 'Pick up Raw Fish', message: 'Raw Fish Acquired.', type: 'rawFishPickup', pickup });
    return pickup;
  }

  updateRawFishPickups(deltaSeconds) {
    this.fieldRawFishPickups.forEach((pickup) => {
      if (!pickup.mesh || pickup.elapsed >= pickup.duration) return;
      pickup.elapsed = Math.min(pickup.duration, pickup.elapsed + deltaSeconds);
      const t = pickup.elapsed / pickup.duration;
      pickup.mesh.position.lerpVectors(pickup.start, pickup.target, t);
      pickup.mesh.position.y = 0.26 + Math.sin(t * Math.PI) * 0.45;
    });
  }

  removeRawFishPickup(pickup) {
    if (!pickup) return;
    if (pickup.mesh) this.scene.remove(pickup.mesh);
    this.fieldRawFishPickups = this.fieldRawFishPickups.filter((entry) => entry !== pickup);
    this.outdoorInteractions = this.outdoorInteractions.filter((entry) => entry.pickup !== pickup);
  }

  updateCookedFishPickups(deltaSeconds) {
    this.fieldCookedFishPickups.forEach((pickup) => {
      if (!pickup.mesh || pickup.elapsed >= pickup.duration) return;
      pickup.elapsed = Math.min(pickup.duration, pickup.elapsed + deltaSeconds);
      const t = pickup.elapsed / pickup.duration;
      pickup.mesh.position.lerpVectors(pickup.start, pickup.target, t);
      pickup.mesh.position.y = 0.28 + Math.sin(t * Math.PI) * 1.2;
      pickup.mesh.rotation.y += deltaSeconds * 4;
    });
  }

  removeCookedFishPickup(pickup) {
    if (!pickup) return;
    if (pickup.mesh) this.scene.remove(pickup.mesh);
    this.fieldCookedFishPickups = this.fieldCookedFishPickups.filter((entry) => entry !== pickup);
    this.outdoorInteractions = this.outdoorInteractions.filter((entry) => entry.pickup !== pickup);
  }

  addFieldCampfire(position, id = null) {
    const campfireId = id ?? `field_survival_campfire_${this.fieldSurvivalObjects.size}`;
    const group = this.createFieldCampfireGroup();
    group.name = `${campfireId}-visual`;
    group.position.set(position.x, 0, position.z);
    this.scene.add(group);
    this.fieldSurvivalObjects.set(campfireId, group);
    if (!this.outdoorInteractions.some((interaction) => interaction.id === `${campfireId}_use`)) {
      this.outdoorInteractions.push({
        id: `${campfireId}_use`,
        label: 'Small Campfire',
        target: new THREE.Vector3(position.x, 1, position.z),
        range: 4.25,
        hint: 'Use campfire',
        message: 'The fire is ready for cooking.',
        type: 'fieldCampfire',
      });
    }
    return group;
  }

  createFieldCampfireGroup() {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x332015, roughness: 0.95, emissive: 0x160804, emissiveIntensity: 0.18 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x2c2a27, roughness: 0.98 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xd96b24, transparent: true, opacity: 0.9 });
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6;
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.22), stoneMat);
      stone.position.set(Math.cos(angle) * 0.75, 0.09, Math.sin(angle) * 0.75);
      stone.rotation.y = angle;
      group.add(stone);
    }
    [0, Math.PI / 2].forEach((angle) => {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.25, 7), woodMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = angle;
      log.position.y = 0.22;
      group.add(log);
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.72, 7), flameMat);
    flame.position.y = 0.65;
    group.add(flame);
    const light = new THREE.PointLight(0xff8a32, 1.15, 14, 1.7);
    light.position.set(0, 0.9, 0);
    group.add(light);
    return group;
  }

  addBrokenShrine() {
    const shrineAwake = Boolean(
      this.gameState?.hasSouthReliquaryFragment
      || this.gameState?.hasBlackGrassTempleAltarActivated?.(),
    );
    const stoneMat = this.makeTexturedMaterial({
      path: TEXTURE_PATHS.wall,
      repeat: [1.4, 1.8],
      color: shrineAwake ? 0xb2a780 : 0x9a9587,
      roughness: 0.97,
      metalness: 0.0,
      emissive: shrineAwake ? 0x3b2d12 : 0x000000,
      emissiveIntensity: shrineAwake ? 0.36 : 0,
    });
    const floorMat = this.makeTexturedMaterial({
      path: TEXTURE_PATHS.floor,
      repeat: [2.4, 2.4],
      color: shrineAwake ? 0xa99d7e : 0x8f8779,
      roughness: 0.96,
      metalness: 0.0,
      emissive: shrineAwake ? 0x241a0e : 0x000000,
      emissiveIntensity: shrineAwake ? 0.24 : 0,
    });
    const group = new THREE.Group();
    group.name = 'S01-Broken-Shrine';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(18, 0.5, 18), position: new THREE.Vector3(0, 0.25, 0), material: floorMat, name: 'S01_A-broken-shrine-base-floor_worn_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(12, 6, 1.5), position: new THREE.Vector3(0, 3, 5), material: stoneMat, name: 'S01_B-shrine-rear-slab-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(2, 5, 2), position: new THREE.Vector3(-7, 2.5, 0), material: stoneMat, name: 'S01_C-shrine-left-broken-pillar-wall_black_stone_01', rotation: new THREE.Euler(0, 0.06, -0.03) }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(2, 3.5, 2), position: new THREE.Vector3(7, 1.75, -1), material: stoneMat, name: 'S01_D-shrine-right-broken-pillar-wall_black_stone_01', rotation: new THREE.Euler(0, -0.08, 0.04) }));

    const answerMat = new THREE.MeshStandardMaterial({
      color: shrineAwake ? 0xd4bb67 : 0x2b2822,
      roughness: 0.8,
      metalness: 0.0,
      emissive: shrineAwake ? 0xb18226 : 0x050403,
      emissiveIntensity: shrineAwake ? 1.15 : 0.14,
      transparent: true,
      opacity: shrineAwake ? 0.82 : 0.32,
    });
    group.add(this.createBoxMesh({ size: new THREE.Vector3(8.5, 0.14, 1.8), position: new THREE.Vector3(0, 0.64, -3.6), material: answerMat, name: 'S01_E-shrine-answer-seam-unlocked-glow' }));

    if (shrineAwake) {
      this.fieldShrineAnswerLight = new THREE.PointLight(0xd7a13b, 1.9, 22, 1.35);
      this.fieldShrineAnswerLight.name = 'S01-field-answer-warm-unlock-light';
      this.fieldShrineAnswerLight.position.set(0, 2.1, -3.6);
      group.add(this.fieldShrineAnswerLight);
    }

    this.fieldShrineGroup = group;
    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'INT03',
      label: 'Broken Shrine',
      target: new THREE.Vector3(0, 1, -8),
      range: OUTDOOR_INTERACTION_RANGE,
      hint: shrineAwake ? 'Tap INTERACT to touch the awakened shrine.' : 'Tap INTERACT to inspect the sealed shrine.',
      message: shrineAwake ? 'The field answers.' : 'The shrine is cold. Something is missing.',
      functional: false,
      type: 'centralShrine',
    });
  }

  addSouthReliquaryCrypt() {
    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [2.2, 1.7], color: 0x8e8a7f, roughness: 0.96, metalness: 0.0 });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: [3.2, 2.6], color: 0x918a7d, roughness: 0.94, metalness: 0.0 });
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x030303 });
    const group = new THREE.Group();
    group.name = 'C01-South-Reliquary-Crypt-exterior';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(28, 0.5, 24), position: new THREE.Vector3(-60, 0.25, -95), material: floorMat, name: 'C01_A-crypt-platform-floor_worn_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(3, 6, 22), position: new THREE.Vector3(-72, 3, -95), material: stoneMat, name: 'C01_B-crypt-left-wall-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(3, 6, 22), position: new THREE.Vector3(-48, 3, -95), material: stoneMat, name: 'C01_C-crypt-right-wall-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(27, 6, 3), position: new THREE.Vector3(-60, 3, -84), material: stoneMat, name: 'C01_D-crypt-rear-wall-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(28, 2, 5), position: new THREE.Vector3(-60, 6.5, -95), material: stoneMat, name: 'C01_E-crypt-lintel-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(10, 4.5, 0.2), position: new THREE.Vector3(-60, 2.25, -106), material: voidMat, name: 'C01_G-dark-entrance-plane' }));

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'INT01',
      label: 'South Reliquary Crypt',
      target: new THREE.Vector3(-60, 1, -107),
      range: OUTDOOR_INTERACTION_RANGE,
      hint: 'Tap INTERACT to enter the South Reliquary Crypt.',
      message: 'The crypt air moves inward.',
      functional: true,
    });
  }

  addFieldKeeperHouseExterior() {
    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [2.2, 1.6], color: 0x6f695f, roughness: 0.97, metalness: 0.0, emissive: 0x080605, emissiveIntensity: 0.08 });
    const darkStoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [1.8, 1.3], color: 0x4e4942, roughness: 0.98, metalness: 0.0, emissive: 0x050403, emissiveIntensity: 0.09 });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: [3.2, 2.8], color: 0x7f7668, roughness: 0.96, metalness: 0.0, emissive: 0x0f0b08, emissiveIntensity: 0.08 });
    const thresholdMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: [1, 1], color: 0x9a8564, roughness: 0.94, metalness: 0.0, emissive: 0x1a1008, emissiveIntensity: 0.18 });
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x030202 });
    const group = new THREE.Group();
    group.name = 'FKH-Field-Keeper-House-exterior-ruined-shell';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(28, 0.4, 24), position: new THREE.Vector3(142, 0.2, -64), material: floorMat, name: 'FKH_EXT_BASE-low-house-foundation-floor_worn_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(28, 4.8, 2), position: new THREE.Vector3(142, 2.4, -54), material: darkStoneMat, name: 'FKH_EXT_WALL_REAR-ruined-rear-wall-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(2, 4.0, 22), position: new THREE.Vector3(128, 2.0, -64), material: stoneMat, name: 'FKH_EXT_WALL_W-west-broken-wall-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(2, 3.6, 22), position: new THREE.Vector3(156, 1.8, -64), material: stoneMat, name: 'FKH_EXT_WALL_E-east-broken-wall-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(10, 3.2, 2), position: new THREE.Vector3(135, 1.6, -76), material: stoneMat, name: 'FKH_EXT_FRONT_L-front-left-return-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(10, 3.2, 2), position: new THREE.Vector3(149, 1.6, -76), material: stoneMat, name: 'FKH_EXT_FRONT_R-front-right-return-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(5, 0.12, 3.2), position: new THREE.Vector3(142, 0.46, -77.2), material: thresholdMat, name: 'FKH_EXT_DOOR-cracked-threshold-entrance-trigger-visual' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4.2, 3.1, 0.18), position: new THREE.Vector3(142, 1.55, -77.15), material: voidMat, name: 'FKH_EXT_DOOR-dark-empty-house-mouth' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(3, 8, 3), position: new THREE.Vector3(134, 4, -63), material: darkStoneMat, name: 'FKH_EXT_CHIMNEY-chimney-block-wall_black_stone_01' }));

    const mouthFill = new THREE.PointLight(0xc27b42, 0.75, 15, 1.55);
    mouthFill.name = 'FKH_EXT_MOUTH-dim-warm-house-threshold-fill';
    mouthFill.position.set(142, 2.1, -76.4);
    group.add(mouthFill);

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'FKH_INT_ENTER',
      label: 'Field Keeper House',
      target: FIELD_KEEPER_HOUSE_ENTRANCE_TARGET.clone(),
      range: 5.0,
      hint: 'Tap INTERACT to enter the Field Keeper House.',
      message: 'The ruined field house exhales cold dust.',
      functional: true,
      area: 'field-keeper-house',
      type: 'areaEntrance',
    });
  }

  addDdplusLevel1TestEntrance() {
    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [1.4, 1.2], color: 0x6a675f, roughness: 0.98, metalness: 0.0, emissive: 0x0d0b08, emissiveIntensity: 0.1 });
    const gateMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: [1.1, 1.2], color: 0xa3835f, roughness: 0.82, metalness: 0.35, emissive: 0x24150c, emissiveIntensity: 0.22 });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: [2.2, 2.2], color: 0x8b8170, roughness: 0.97, metalness: 0.0, emissive: 0x100b08, emissiveIntensity: 0.1 });
    const group = new THREE.Group();
    group.name = 'DDPLUS_LEVEL1-temporary-test-chamber-entrance';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(8, 0.28, 8), position: new THREE.Vector3(154, 0.14, 110), material: floorMat, name: 'DDPLUS_LEVEL1_TEMP_BASE-floor_worn_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.4, 4.2, 1.4), position: new THREE.Vector3(150.6, 2.1, 110), material: stoneMat, name: 'DDPLUS_LEVEL1_TEMP_LEFT_PIER-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.4, 4.2, 1.4), position: new THREE.Vector3(157.4, 2.1, 110), material: stoneMat, name: 'DDPLUS_LEVEL1_TEMP_RIGHT_PIER-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(6.8, 1.1, 1.2), position: new THREE.Vector3(154, 4.05, 110), material: stoneMat, name: 'DDPLUS_LEVEL1_TEMP_LINTEL-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4.4, 3.0, 0.22), position: new THREE.Vector3(154, 1.5, 109.35), material: gateMat, name: 'DDPLUS_LEVEL1_TEMP_TEST_GATE-metal_gate_rusted_01' }));

    const glow = new THREE.PointLight(0xd69a54, 0.95, 15, 1.45);
    glow.name = 'DDPLUS_LEVEL1_TEMP_GATE-warm-test-light';
    glow.position.set(154, 2.2, 108.8);
    group.add(glow);

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'DDPLUS_LEVEL1_INT_ENTER',
      label: 'Level 1 DDplus Test',
      target: DDPLUS_LEVEL1_TEST_ENTRANCE_TARGET.clone(),
      range: 5.0,
      hint: 'Tap INTERACT to enter the Level 1 DDplus Test.',
      message: 'The temporary DDplus test chamber opens.',
      functional: true,
      area: 'level-1',
      type: 'areaEntrance',
    });
  }

  addSumerianCityBlockV0TestEntrance() {
    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [1.8, 1.3], color: 0x8a7552, roughness: 0.98, metalness: 0.0, emissive: 0x130d07, emissiveIntensity: 0.12 });
    const gateMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: [1.0, 1.35], color: 0xa07955, roughness: 0.84, metalness: 0.32, emissive: 0x241409, emissiveIntensity: 0.2 });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: [2.6, 2.6], color: 0x9a865e, roughness: 0.98, metalness: 0.0, emissive: 0x120d07, emissiveIntensity: 0.1 });
    const group = new THREE.Group();
    group.name = 'SUMERIAN_CITY_BLOCK_V0-temporary-city-gate-entrance';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(10, 0.28, 8), position: new THREE.Vector3(122, 0.14, 149), material: floorMat, name: 'SUMERIAN_CITY_BLOCK_V0_TEMP_BASE-floor_worn_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.6, 4.6, 1.6), position: new THREE.Vector3(118.2, 2.3, 149), material: stoneMat, name: 'SUMERIAN_CITY_BLOCK_V0_TEMP_LEFT_PIER-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.6, 4.6, 1.6), position: new THREE.Vector3(125.8, 2.3, 149), material: stoneMat, name: 'SUMERIAN_CITY_BLOCK_V0_TEMP_RIGHT_PIER-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(7.6, 1.2, 1.2), position: new THREE.Vector3(122, 4.4, 149), material: stoneMat, name: 'SUMERIAN_CITY_BLOCK_V0_TEMP_LINTEL-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4.8, 3.1, 0.22), position: new THREE.Vector3(122, 1.55, 148.35), material: gateMat, name: 'SUMERIAN_CITY_BLOCK_V0_TEMP_TEST_GATE-metal_gate_rusted_01' }));

    const glow = new THREE.PointLight(0xd8a25a, 1.05, 16, 1.45);
    glow.name = 'SUMERIAN_CITY_BLOCK_V0_TEMP_GATE-warm-test-light';
    glow.position.set(122, 2.35, 147.8);
    group.add(glow);

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'SUMERIAN_CITY_BLOCK_V0_INT_ENTER',
      label: 'Sumerian City Block v0',
      target: SUMERIAN_CITY_BLOCK_V0_TEST_ENTRANCE_TARGET.clone(),
      range: 5.0,
      hint: 'Tap INTERACT to enter Sumerian City Block v0.',
      message: 'The temporary Sumerian city gate opens.',
      functional: true,
      area: 'sumerian-city-block-v0',
      type: 'areaEntrance',
    });
  }

  addSumerianSunPalaceDistrictV1TestEntrance() {
    const stoneMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/wall_sandstone_ritual_01.png', repeat: [1.8, 1.3], color: 0xc9a763, roughness: 0.98, metalness: 0.0, emissive: 0x2b1a08, emissiveIntensity: 0.18 });
    const gateMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/metal_bronze_ritual_01.png', repeat: [1.0, 1.35], color: 0xd7a15f, roughness: 0.84, metalness: 0.32, emissive: 0x2b1606, emissiveIntensity: 0.22 });
    const floorMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/floor_limestone_temple_01.png', repeat: [2.6, 2.6], color: 0xd4bd85, roughness: 0.98, metalness: 0.0, emissive: 0x201507, emissiveIntensity: 0.12 });
    const group = new THREE.Group();
    group.name = 'SUMERIAN_SUN_PALACE_DISTRICT_V1-temporary-sun-gate-entrance';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(10, 0.28, 8), position: new THREE.Vector3(96, 0.14, 149), material: floorMat, name: 'SUMERIAN_SUN_PALACE_DISTRICT_V1_TEMP_BASE-pack1-floor_limestone_temple_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.6, 4.8, 1.6), position: new THREE.Vector3(92.2, 2.4, 149), material: stoneMat, name: 'SUMERIAN_SUN_PALACE_DISTRICT_V1_TEMP_LEFT_PIER-pack1-wall_sandstone_ritual_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.6, 4.8, 1.6), position: new THREE.Vector3(99.8, 2.4, 149), material: stoneMat, name: 'SUMERIAN_SUN_PALACE_DISTRICT_V1_TEMP_RIGHT_PIER-pack1-wall_sandstone_ritual_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(7.6, 1.2, 1.2), position: new THREE.Vector3(96, 4.55, 149), material: stoneMat, name: 'SUMERIAN_SUN_PALACE_DISTRICT_V1_TEMP_LINTEL-pack1-wall_sandstone_ritual_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4.8, 3.1, 0.22), position: new THREE.Vector3(96, 1.55, 148.35), material: gateMat, name: 'SUMERIAN_SUN_PALACE_DISTRICT_V1_TEMP_TEST_GATE-pack1-metal_bronze_ritual_01' }));

    const glow = new THREE.PointLight(0xffc56d, 1.25, 18, 1.35);
    glow.name = 'SUMERIAN_SUN_PALACE_DISTRICT_V1_TEMP_GATE-bright-test-light';
    glow.position.set(96, 2.35, 147.8);
    group.add(glow);

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'SUMERIAN_SUN_PALACE_DISTRICT_V1_INT_ENTER',
      label: 'Sumerian Sun Palace',
      target: SUMERIAN_SUN_PALACE_DISTRICT_V1_TEST_ENTRANCE_TARGET.clone(),
      range: 5.0,
      hint: 'Tap INTERACT to enter the Sumerian Sun Palace.',
      message: 'The temporary Sumerian Sun Palace gate opens.',
      functional: true,
      area: 'sumerian-sun-palace-district-v1',
      type: 'areaEntrance',
    });
  }

  addSumerianCanalMarketDistrictV2Entrance() {
    const sandstoneMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/wall_sandstone_ritual_01.png', repeat: [1.7, 1.2], color: 0xb99761, roughness: 0.98, metalness: 0.0, emissive: 0x221306, emissiveIntensity: 0.14 });
    const bronzeMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/metal_bronze_ritual_01.png', repeat: [1.0, 1.2], color: 0xb47b44, roughness: 0.84, metalness: 0.3, emissive: 0x201006, emissiveIntensity: 0.18 });
    const floorMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/floor_limestone_temple_01.png', repeat: [2.8, 2.4], color: 0xc0a66f, roughness: 0.98, metalness: 0.0, emissive: 0x1c1207, emissiveIntensity: 0.1 });
    const waterMat = new THREE.MeshBasicMaterial({ color: 0x07141b, transparent: true, opacity: 0.72, depthWrite: false });
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x020304 });
    const group = new THREE.Group();
    group.name = 'SUMERIAN_CANAL_MARKET_DISTRICT_V2-field-canal-gate-entrance';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(11, 0.28, 8), position: new THREE.Vector3(110, 0.14, 128), material: floorMat, name: 'SUMERIAN_CANAL_MARKET_DISTRICT_V2_BASE-pack1-floor_limestone_temple_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(8.5, 0.08, 1.35), position: new THREE.Vector3(110, 0.34, 125.2), material: waterMat, name: 'SUMERIAN_CANAL_MARKET_DISTRICT_V2_WATER-dark-canal-threshold' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.2, 4.5, 1.2), position: new THREE.Vector3(106.4, 2.25, 129.1), material: sandstoneMat, name: 'SUMERIAN_CANAL_MARKET_DISTRICT_V2_ARCH-left-sandstone-pier' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.2, 4.1, 1.2), position: new THREE.Vector3(113.6, 2.05, 129.1), material: sandstoneMat, name: 'SUMERIAN_CANAL_MARKET_DISTRICT_V2_ARCH-right-sandstone-pier' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(8.2, 1.0, 1.1), position: new THREE.Vector3(110, 4.35, 129.1), material: sandstoneMat, name: 'SUMERIAN_CANAL_MARKET_DISTRICT_V2_ARCH-warning-lintel' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4.6, 2.7, 0.2), position: new THREE.Vector3(110, 1.5, 128.45), material: voidMat, name: 'SUMERIAN_CANAL_MARKET_DISTRICT_V2_DOOR-market-shadow' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(0.7, 2.3, 0.3), position: new THREE.Vector3(103.6, 1.15, 127.1), material: bronzeMat, name: 'SUMERIAN_CANAL_MARKET_DISTRICT_V2_STELA-left-bronze-warning' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(0.7, 2.0, 0.3), position: new THREE.Vector3(116.4, 1.0, 127.1), material: bronzeMat, name: 'SUMERIAN_CANAL_MARKET_DISTRICT_V2_STELA-right-bronze-warning' }));

    const glow = new THREE.PointLight(0xd6974e, 1.1, 16, 1.45);
    glow.name = 'SUMERIAN_CANAL_MARKET_DISTRICT_V2_GATE-warm-canal-market-light';
    glow.position.set(110, 2.2, 126.8);
    group.add(glow);

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'SUMERIAN_CANAL_MARKET_DISTRICT_V2_INT_ENTER',
      label: 'Sumerian Canal Market',
      target: SUMERIAN_CANAL_MARKET_DISTRICT_V2_ENTRANCE_TARGET.clone(),
      range: 5.0,
      hint: 'Enter Sumerian Canal Market',
      message: 'The canal market opens.',
      functional: true,
      area: 'sumerian-canal-market-district-v2',
      type: 'areaEntrance',
    });
  }

  addKerovacEntrance() {
    const limestoneMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/stone_limestone_block_01.png', repeat: [1.7, 1.25], color: 0xe3d0a1, roughness: 0.97, metalness: 0.0, emissive: 0x2d210f, emissiveIntensity: 0.16 });
    const sandstoneMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/wall_sandstone_ritual_01.png', repeat: [1.5, 1.1], color: 0xd8b875, roughness: 0.98, metalness: 0.0, emissive: 0x2b1a08, emissiveIntensity: 0.18 });
    const bronzeMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/metal_bronze_ritual_01.png', repeat: [1.0, 1.0], color: 0xd09445, roughness: 0.76, metalness: 0.38, emissive: 0x3a1c06, emissiveIntensity: 0.32 });
    const floorMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/floor_limestone_temple_01.png', repeat: [2.6, 2.4], color: 0xe0c78a, roughness: 0.98, metalness: 0.0, emissive: 0x2d1d0a, emissiveIntensity: 0.14 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffc56d, transparent: true, opacity: 0.38, depthWrite: false });
    const group = new THREE.Group();
    group.name = 'KEROVAC-field-bright-sun-city-gate-entrance';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(11, 0.3, 8), position: new THREE.Vector3(60, 0.15, 146), material: floorMat, name: 'KEROVAC_EXT_BASE-limestone-threshold-floor_limestone_temple_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.2, 5.2, 5), position: new THREE.Vector3(57, 2.6, 146), material: limestoneMat, name: 'KEROVAC_EXT_LEFT_PIER-limestone-sun-gate' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.2, 5.2, 5), position: new THREE.Vector3(63, 2.6, 146), material: limestoneMat, name: 'KEROVAC_EXT_RIGHT_PIER-limestone-sun-gate' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(8.4, 1.05, 1.1), position: new THREE.Vector3(60, 5.05, 148.05), material: sandstoneMat, name: 'KEROVAC_EXT_LINTEL-sun-sealed-sandstone-ritual-slab' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(5.4, 3.2, 0.18), position: new THREE.Vector3(60, 1.72, 147.46), material: glowMat, name: 'KEROVAC_EXT_GATE-warm-lit-sun-sealed-mouth' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(2.7, 2.7, 0.2), position: new THREE.Vector3(60, 3.25, 147.34), material: bronzeMat, name: 'KEROVAC_EXT_BRONZE_SUN_DISK-visible-ritual-marker' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(0.5, 2.2, 0.35), position: new THREE.Vector3(55.2, 1.1, 143.9), material: bronzeMat, name: 'KEROVAC_EXT_LEFT_BRONZE_LAMP-ritual-flame-marker' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(0.5, 2.2, 0.35), position: new THREE.Vector3(64.8, 1.1, 143.9), material: bronzeMat, name: 'KEROVAC_EXT_RIGHT_BRONZE_LAMP-ritual-flame-marker' }));

    const leftLamp = new THREE.PointLight(0xffb76a, 1.25, 16, 1.4);
    leftLamp.name = 'KEROVAC_EXT_LEFT_LAMP-bright-warm-field-light';
    leftLamp.position.set(55.2, 2.5, 143.9);
    group.add(leftLamp);
    const rightLamp = new THREE.PointLight(0xffb76a, 1.25, 16, 1.4);
    rightLamp.name = 'KEROVAC_EXT_RIGHT_LAMP-bright-warm-field-light';
    rightLamp.position.set(64.8, 2.5, 143.9);
    group.add(rightLamp);
    const diskGlow = new THREE.PointLight(0xffd08a, 1.55, 20, 1.35);
    diskGlow.name = 'KEROVAC_EXT_SUN_DISK-bright-threshold-light';
    diskGlow.position.set(60, 3.2, 144.8);
    group.add(diskGlow);

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'KEROVAC_INT_ENTER',
      label: 'Kerovac',
      target: KEROVAC_ENTRANCE_TARGET.clone(),
      range: 5.0,
      hint: 'Enter Kerovac',
      message: 'The sun-sealed city of Kerovac opens beneath the field.',
      functional: true,
      area: 'kerovac',
      type: 'areaEntrance',
    });
  }

  addOarbProvingGroundsEntrance() {
    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [1.1, 1.6], color: 0x9b9588, roughness: 0.98, metalness: 0.0, emissive: 0x17130f, emissiveIntensity: 0.14 });
    const pathMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.fieldGrass, repeat: [3.0, 1.0], color: 0x7a6446, roughness: 1.0, metalness: 0.0, emissive: 0x191007, emissiveIntensity: 0.1 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x78d8ff, transparent: true, opacity: 0.34, depthWrite: false });
    const group = new THREE.Group();
    group.name = 'OARB_PROVING_GROUNDS-river-standing-stone-gate-marker';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(4.2, 0.08, 22), position: new THREE.Vector3(65, 0.05, 154), material: pathMat, name: 'OARB_PROVING_GROUNDS_PATH-cleared-mud-trail-from-kerovac', rotation: new THREE.Euler(0, -0.52, 0) }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.6, 5.8, 2.4), position: new THREE.Vector3(66, 2.9, 164), material: stoneMat, name: 'OARB_PROVING_GROUNDS_LEFT_STONE-river-marker' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.6, 5.8, 2.4), position: new THREE.Vector3(74, 2.9, 164), material: stoneMat, name: 'OARB_PROVING_GROUNDS_RIGHT_STONE-river-marker' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(9.2, 1.0, 1.2), position: new THREE.Vector3(70, 5.55, 164), material: stoneMat, name: 'OARB_PROVING_GROUNDS_LINTEL-obvious-river-arch' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4.8, 3.0, 0.16), position: new THREE.Vector3(70, 1.7, 163.35), material: glowMat, name: 'OARB_PROVING_GROUNDS_GATE-blue-debug-threshold' }));

    const glow = new THREE.PointLight(0x78d8ff, 1.45, 22, 1.35);
    glow.name = 'OARB_PROVING_GROUNDS_GATE-bright-blue-proving-light';
    glow.position.set(70, 2.8, 162.5);
    group.add(glow);

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'OARB_PROVING_GROUNDS_INT_ENTER',
      label: 'OARB Proving Grounds',
      target: OARB_PROVING_GROUNDS_ENTRANCE_TARGET.clone(),
      range: 5.0,
      hint: 'Tap INTERACT to enter the OARB Proving Grounds.',
      message: 'The OARB Proving Grounds gate opens by the river.',
      functional: true,
      area: 'oarbFeatureYard',
      type: 'areaEntrance',
    });
  }

  addBalthazanEntrance() {
    const blackStoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [1.6, 1.2], color: 0x39342f, roughness: 0.99, metalness: 0.0, emissive: 0x050404, emissiveIntensity: 0.13 });
    const sandstoneMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/wall_sandstone_ritual_01.png', repeat: [1.45, 1.05], color: 0xb9955f, roughness: 0.98, metalness: 0.0, emissive: 0x1d1005, emissiveIntensity: 0.16 });
    const bronzeMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/metal_bronze_ritual_01.png', repeat: [1.0, 1.1], color: 0xa66d3d, roughness: 0.84, metalness: 0.32, emissive: 0x1f0f05, emissiveIntensity: 0.18 });
    const floorMat = this.makeTexturedMaterial({ path: './assets/textures/pack1/floor_limestone_temple_01.png', repeat: [2.8, 2.4], color: 0xb69a63, roughness: 0.98, metalness: 0.0, emissive: 0x171006, emissiveIntensity: 0.11 });
    const waterMat = new THREE.MeshBasicMaterial({ color: 0x07131a, transparent: true, opacity: 0.66, depthWrite: false });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xd6a75a, transparent: true, opacity: 0.26, depthWrite: false });
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x020304 });
    const group = new THREE.Group();
    group.name = 'BALTHAZAN-field-canal-city-gate-entrance';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(10.5, 0.28, 8), position: new THREE.Vector3(72, 0.14, 126), material: floorMat, name: 'BALTHAZAN_BASE-sandstone-canal-threshold-floor_limestone_temple_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(7.5, 0.08, 1.2), position: new THREE.Vector3(72, 0.36, 123.35), material: waterMat, name: 'BALTHAZAN_WATER-dark-canal-threshold' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(5.8, 0.05, 0.88), position: new THREE.Vector3(72, 0.42, 123.35), material: glowMat, name: 'BALTHAZAN_WATER-subtle-gold-sheen' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.25, 5.4, 1.25), position: new THREE.Vector3(68.7, 2.7, 127.2), material: blackStoneMat, name: 'BALTHAZAN_ARCH-left-black-stone-pier' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(1.25, 5.4, 1.25), position: new THREE.Vector3(75.3, 2.7, 127.2), material: blackStoneMat, name: 'BALTHAZAN_ARCH-right-black-stone-pier' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(7.8, 1.05, 1.18), position: new THREE.Vector3(72, 5.15, 127.2), material: sandstoneMat, name: 'BALTHAZAN_ARCH-tall-sandstone-lintel' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4.7, 3.45, 0.22), position: new THREE.Vector3(72, 1.72, 126.63), material: voidMat, name: 'BALTHAZAN_GATE-black-canal-city-mouth' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(0.58, 2.25, 0.32), position: new THREE.Vector3(66.9, 1.13, 125.15), material: bronzeMat, name: 'BALTHAZAN_STELA-left-bronze-warning' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(0.58, 2.25, 0.32), position: new THREE.Vector3(77.1, 1.13, 125.15), material: bronzeMat, name: 'BALTHAZAN_STELA-right-bronze-warning' }));

    const glow = new THREE.PointLight(0xd79a58, 0.95, 15, 1.55);
    glow.name = 'BALTHAZAN_GATE-subtle-gold-threshold-light';
    glow.position.set(72, 2.55, 124.65);
    group.add(glow);

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'BALTHAZAN_INT_ENTER',
      label: 'Balthazan',
      target: BALTHAZAN_ENTRANCE_TARGET.clone(),
      range: 5.0,
      hint: 'Enter Balthazan',
      message: 'The gates of Balthazan open.',
      functional: true,
      area: 'balthazan',
      type: 'areaEntrance',
    });
  }

  addSunkenCentralTomb() {
    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [2.6, 2.0], color: 0x8d897f, roughness: 0.96, metalness: 0.0 });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: [4.0, 3.0], color: 0x8f887b, roughness: 0.95, metalness: 0.0 });
    const gateMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: [1.2, 1.8], color: 0x97836e, roughness: 0.82, metalness: 0.42, emissive: 0x18110d, emissiveIntensity: 0.16 });
    const group = new THREE.Group();
    group.name = 'C03-Sunken-Central-Tomb-exterior-shell';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(36, 0.4, 28), position: new THREE.Vector3(35, 0.2, 140), material: floorMat, name: 'C03_A-sunken-tomb-platform-floor_worn_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(34, 8, 4), position: new THREE.Vector3(35, 4, 152), material: stoneMat, name: 'C03_B-sunken-tomb-rear-wall-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(12, 5, 1), position: new THREE.Vector3(35, 2.5, 128), material: gateMat, name: 'C03_C-sealed-gate-metal_gate_rusted_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4, 5, 24), position: new THREE.Vector3(17, 2.5, 140), material: stoneMat, name: 'C03_D-left-tomb-block-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4, 5, 24), position: new THREE.Vector3(53, 2.5, 140), material: stoneMat, name: 'C03_E-right-tomb-block-wall_black_stone_01' }));

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'INT02',
      label: 'Sunken Central Tomb Gate',
      target: new THREE.Vector3(35, 1, 124),
      range: OUTDOOR_INTERACTION_RANGE,
      hint: 'Tap INTERACT to inspect the sealed Sunken Central Tomb gate.',
      message: 'The rusted gate will not yield.',
      functional: false,
    });
  }

  addStandingStoneCluster() {
    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [0.8, 1.4], color: 0x8c8a82, roughness: 0.98, metalness: 0.0 });
    const group = new THREE.Group();
    group.name = 'Standing-Stone-cluster-near-115--70';
    const stones = [
      { id: 'STONE01', size: new THREE.Vector3(3, 5, 2), position: new THREE.Vector3(115, 2.5, -70), rotation: new THREE.Euler(0, 0.18, -0.04) },
      { id: 'STONE02', size: new THREE.Vector3(2, 3.5, 2), position: new THREE.Vector3(122, 1.75, -64), rotation: new THREE.Euler(0, -0.24, 0.05) },
      { id: 'STONE03', size: new THREE.Vector3(2, 2.5, 2), position: new THREE.Vector3(108, 1.25, -58), rotation: new THREE.Euler(0, 0.1, -0.08) },
    ];

    stones.forEach((stone) => {
      group.add(this.createBoxMesh({ ...stone, material: stoneMat, name: `${stone.id}-standing-stone-wall_black_stone_01` }));
    });

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
  }

  addLowRuinWalls() {
    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [3.0, 0.7], color: 0x858178, roughness: 0.97, metalness: 0.0 });
    const group = new THREE.Group();
    group.name = 'Reliquary-Field-low-ruin-walls';
    group.add(this.createBoxMesh({ size: new THREE.Vector3(28, 2, 3), position: new THREE.Vector3(-130, 1, 20), material: stoneMat, name: 'RUIN01-low-ruin-wall-west-wall_black_stone_01', rotation: new THREE.Euler(0, 0.08, 0) }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(24, 2, 3), position: new THREE.Vector3(85, 1, 55), material: stoneMat, name: 'RUIN02-low-ruin-wall-east-wall_black_stone_01', rotation: new THREE.Euler(0, -0.1, 0) }));
    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
  }

  createBoxMesh({ size, position, material, name, rotation }) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    if (name) mesh.name = name;
    mesh.position.copy(position);
    if (rotation) mesh.rotation.copy(rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  enableOutdoorReadableShadows(root) {
    root.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }

  addBlackGrassTempleExterior() {
    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [3.4, 2.1], color: 0x34312d, roughness: 0.98, metalness: 0.0, emissive: 0x050403, emissiveIntensity: 0.08 });
    const darkStoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [2.0, 1.7], color: 0x1f1c19, roughness: 0.99, metalness: 0.0, emissive: 0x030201, emissiveIntensity: 0.1 });
    const edgeStoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [1.6, 1.5], color: 0x4d4941, roughness: 0.98, metalness: 0.0, emissive: 0x080503, emissiveIntensity: 0.08 });
    const gateMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: [1.1, 1.8], color: 0xd3a865, roughness: 0.76, metalness: 0.42, emissive: 0x7f3b12, emissiveIntensity: 0.72 });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: [5.5, 4.2], color: 0x777064, roughness: 0.97, metalness: 0.0, emissive: 0x080604, emissiveIntensity: 0.08 });
    const grassMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.fieldGrass, repeat: [8, 7], color: 0x1d210f, roughness: 1.0, metalness: 0.0, emissive: 0x020501, emissiveIntensity: 0.08 });
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x020202 });
    const thresholdGlowMat = new THREE.MeshBasicMaterial({ color: 0xff9a37, transparent: true, opacity: 0.42, depthWrite: false });
    const group = new THREE.Group();
    group.name = 'C02-Black-Grass-Temple-grounded-field-entrance';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(54, 0.08, 44), position: new THREE.Vector3(-184, 0.04, 43), material: grassMat, name: 'C02_G-black-grass-corruption-approach-field_dead_grass_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(24, 0.5, 28), position: new THREE.Vector3(-184, 0.25, 39), material: floorMat, name: 'C02_A-temple-approach-stone-run-floor_worn_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(7.5, 10.5, 22), position: new THREE.Vector3(-195, 5.25, 44.5), material: stoneMat, name: 'C02_B-left-heavy-pylon-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(7.5, 9.4, 22), position: new THREE.Vector3(-173, 4.7, 44.5), material: stoneMat, name: 'C02_C-right-heavy-pylon-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(30, 9.2, 8), position: new THREE.Vector3(-184, 4.6, 57), material: darkStoneMat, name: 'C02_D-deep-rear-temple-mass-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(13, 2.3, 5.5), position: new THREE.Vector3(-184, 9.45, 39.5), material: edgeStoneMat, name: 'C02_E-bright-threshold-lintel-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4.2, 6.2, 2.2), position: new THREE.Vector3(-190.5, 3.1, 35.5), material: edgeStoneMat, name: 'C02_F-left-door-jamb-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4.2, 6.2, 2.2), position: new THREE.Vector3(-177.5, 3.1, 35.5), material: edgeStoneMat, name: 'C02_H-right-door-jamb-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(7.8, 5.2, 0.34), position: new THREE.Vector3(-184, 2.6, 32.5), material: gateMat, name: 'C02_I-bright-rusted-gate-focal-metal_gate_rusted_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(7.0, 4.9, 0.22), position: new THREE.Vector3(-184, 2.45, 32.25), material: voidMat, name: 'C02_J-dark-descending-stair-mouth-visual' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(11, 4.2, 5), position: new THREE.Vector3(-198, 2.1, 45.5), material: darkStoneMat, name: 'C02_K-left-broken-wall-wing-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(11, 3.8, 5), position: new THREE.Vector3(-170, 1.9, 45.5), material: darkStoneMat, name: 'C02_L-right-broken-wall-wing-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(8, 6.5, 25), position: new THREE.Vector3(-166, 3.25, 66.5), material: darkStoneMat, name: 'C02_S-right-rear-return-wall-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(36, 3.5, 18), position: new THREE.Vector3(-180, 1.75, 70), material: darkStoneMat, name: 'C02_T-buried-rear-backfill-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(18, 0.04, 6.5), position: new THREE.Vector3(-184, 0.53, 29.2), material: thresholdGlowMat, name: 'C02_M-warm-threshold-light-spill' }));

    this.createOutdoorFlameChalice({ parent: group, position: new THREE.Vector3(-191, 0, 28), name: 'C02_N-left-front-grounded-flame-chalice' });
    this.createOutdoorFlameChalice({ parent: group, position: new THREE.Vector3(-177, 0, 28), name: 'C02_O-right-front-grounded-flame-chalice' });
    this.createOutdoorFlameChalice({ parent: group, position: new THREE.Vector3(-193.5, 0, 38), name: 'C02_P-left-rear-grounded-flame-chalice', scale: 0.86 });
    this.createOutdoorFlameChalice({ parent: group, position: new THREE.Vector3(-174.5, 0, 38), name: 'C02_Q-right-rear-grounded-flame-chalice', scale: 0.86 });

    const gateGlow = new THREE.PointLight(0xffa24a, 2.4, 28, 1.45);
    gateGlow.name = 'C02_R-bright-warm-temple-mouth-light';
    gateGlow.position.set(-184, 3.2, 32.5);
    group.add(gateGlow);

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'BGT_INT01',
      label: 'Black Grass Temple',
      target: BGT_EXTERIOR_ENTRANCE_TARGET.clone(),
      range: 4.5,
      hint: 'Tap INTERACT to descend into Black Grass Temple.',
      message: 'The black grass bends away from the temple stair.',
      functional: true,
      area: 'black-grass-temple',
      type: 'areaEntrance',
    });
  }

  createOutdoorFlameChalice({ parent, position, name, scale = 1 }) {
    const group = new THREE.Group();
    group.name = name;
    group.position.copy(position);
    group.scale.setScalar(scale);

    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [0.8, 0.8], color: 0x2c2823, roughness: 0.96, metalness: 0.0, emissive: 0x050302, emissiveIntensity: 0.08 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b211a, roughness: 0.82, metalness: 0.55, emissive: 0x120805, emissiveIntensity: 0.16 });
    const flameOuterMat = new THREE.MeshBasicMaterial({ color: 0xff7a21, transparent: true, opacity: 0.86, depthWrite: false });
    const flameInnerMat = new THREE.MeshBasicMaterial({ color: 0xffdf8a, transparent: true, opacity: 0.94, depthWrite: false });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 0.42, 12), stoneMat);
    base.name = `${name}-ground-base`;
    base.position.y = 0.21;
    group.add(base);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.76, 1.05, 12), stoneMat);
    pedestal.name = `${name}-stone-pedestal`;
    pedestal.position.y = 0.95;
    group.add(pedestal);

    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 0.72, 0.48, 14), ironMat);
    bowl.name = `${name}-iron-bowl`;
    bowl.position.y = 1.64;
    group.add(bowl);

    const flame = new THREE.Group();
    flame.name = `${name}-flame`;
    flame.position.y = 2.05;
    group.add(flame);

    const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.25, 9), flameOuterMat);
    flameOuter.name = `${name}-flame-outer`;
    flameOuter.position.y = 0.38;
    flame.add(flameOuter);

    const flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.92, 8), flameInnerMat);
    flameInner.name = `${name}-flame-inner`;
    flameInner.position.y = 0.42;
    flame.add(flameInner);

    const light = new THREE.PointLight(0xff9b42, 2.9, 20, 1.38);
    light.name = `${name}-warm-point-light`;
    light.position.copy(flame.position);
    group.add(light);

    this.torchFlickerController.registerFixture({
      pointLight: light,
      flame,
      flameOuter,
      flameInner,
      baseIntensity: light.intensity,
      baseDistance: light.distance,
      baseOuterOpacity: flameOuter.material.opacity,
      baseInnerOpacity: flameInner.material.opacity,
      phase: this.torchLights.length * 1.73,
      profile: { flickerAmount: 0.18, flickerSpeed: 1.08 },
    });
    this.torchLights.push({ light, flame, baseIntensity: light.intensity, baseDistance: light.distance, phase: this.torchLights.length * 1.73 });

    parent.add(group);
    return group;
  }

  buildCompiledLocationInterior() {
    const runtime = this.compiledLocationRuntime ?? this.configureCompiledLocationRuntime(this.area);
    this.compiledLocationRuntime = runtime;
    this.scene.background = new THREE.Color(runtime.definition.lighting?.background ?? 0x100f0d);
    this.scene.fog = new THREE.Fog(
      runtime.definition.fog?.color ?? 0x242018,
      runtime.definition.fog?.near ?? 10,
      runtime.definition.fog?.far ?? 52,
    );
    this.scene.add(runtime.group);
    this.logBalthazanTextureQa(runtime);
    this.torchFlickerController.registerFromObject(runtime.group);
    this.dungeonDebugRenderer = new DungeonDebugRenderer({ scene: this.scene, runtime });
    this.addCompiledLocationEnemies(runtime);
    if (runtime.locationId === 'sumerian-sun-palace-district-v1') this.addSumerianSunPalaceTorchChest();
  }

  addSumerianSunPalaceTorchChest() {
    const id = 'sumerian_sun_palace_spawn_torch_chest';
    const position = { x: 46.6, y: 0, z: 4.2 };
    const opened = this.gameState?.hasOpenedFieldChest?.(id) ?? false;
    const group = this.createFieldChestGroup(opened);
    group.name = `${id}-visual`;
    group.position.set(position.x, position.y, position.z);
    group.rotation.y = Math.PI * 0.5;
    this.scene.add(group);
    this.fieldSurvivalObjects.set(id, group);
  }

  addCompiledLocationEnemies(runtime = this.compiledLocationRuntime) {
    if (!runtime || runtime.locationId === 'black-grass-temple') return;
    const factionAnchors = runtime.spawnAnchors.filter((spawn) => (
      spawn.kind === 'enemy'
      && ['sheep_demon', 'neck_man'].includes(spawn.species)
      && (spawn.allowedForInitialWave || spawn.initialWave || spawn.tags?.includes('initial-wave'))
    )).map((spawn) => this.createRuntimeEnemyAnchor(spawn, runtime)).filter(Boolean);
    if (factionAnchors.length === 0) return;

    this.blackGrassFactionManager = new BlackGrassTempleFactionManager({
      scene: this.scene,
      collision: this.collision,
      anchors: factionAnchors,
      navigationGraph: runtime.navGraph,
      encounterZones: runtime.encounterZones,
      onGoreEvent: (payload) => this.handleFactionGoreEvent(payload),
      enableBattleDirector: false,
      enableRespawns: false,
    });
    const policy = this.createGeneratedEnemySpawnPolicy(runtime);
    this.generatedEnemyRuntime = {
      anchors: factionAnchors,
      activeAnchorIds: new Set(),
      sleepingUntil: new Map(),
      lastWakeAt: 0,
      devStats: { wakeCount: 0, sleepCount: 0, elapsedSeconds: 0 },
      policy,
    };
    const initialPlayerPosition = this.playerSpawn?.spawnPosition ?? factionAnchors[0]?.position;
    const initialAnchors = this.selectGeneratedEnemyWakeAnchors(initialPlayerPosition, policy.initialEnemyCap);
    this.spawnGeneratedEnemyAnchors(initialAnchors);
  }

  createGeneratedEnemySpawnPolicy(runtime) {
    const policy = runtime?.definition?.runtimeSpawnPolicy ?? {};
    const activeEnemyCap = Math.max(1, Number(policy.activeEnemyCap ?? GENERATED_ENEMY_ACTIVE_CAP));
    return {
      activeEnemyCap,
      initialEnemyCap: Math.max(1, Math.min(activeEnemyCap, Number(policy.initialEnemyCap ?? GENERATED_ENEMY_INITIAL_CAP))),
      wakeRadius: Math.max(1, Number(policy.wakeRadius ?? GENERATED_ENEMY_WAKE_RADIUS)),
      sleepRadius: Math.max(1, Number(policy.sleepRadius ?? GENERATED_ENEMY_SLEEP_RADIUS)),
      respawnCooldownMs: Math.max(0, Number(policy.respawnCooldownMs ?? GENERATED_ENEMY_RESPAWN_COOLDOWN_MS)),
      maxWakePerSecond: Math.max(0.1, Number(policy.maxWakePerSecond ?? GENERATED_ENEMY_MAX_WAKE_PER_SECOND)),
      generatedAiLod: policy.generatedAiLod !== false,
      aiNearRadius: Math.max(1, Number(policy.aiNearRadius ?? GENERATED_ENEMY_AI_NEAR_RADIUS)),
      aiMidRadius: Math.max(1, Number(policy.aiMidRadius ?? GENERATED_ENEMY_AI_MID_RADIUS)),
    };
  }

  selectGeneratedEnemyWakeAnchors(playerPosition, limit) {
    if (!this.generatedEnemyRuntime || !playerPosition) return [];
    const now = Date.now();
    const { anchors, activeAnchorIds, sleepingUntil, policy } = this.generatedEnemyRuntime;
    const capacity = Math.max(0, Math.min(limit, policy.activeEnemyCap - activeAnchorIds.size));
    if (capacity <= 0) return [];
    return anchors
      .filter((anchor) => !activeAnchorIds.has(anchor.id) && (sleepingUntil.get(anchor.id) ?? 0) <= now)
      .map((anchor) => ({ anchor, distance: horizontalDistance(anchor.position, playerPosition) }))
      .filter(({ distance }) => distance <= policy.wakeRadius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, capacity)
      .map(({ anchor }) => anchor);
  }

  spawnGeneratedEnemyAnchors(anchors) {
    if (!anchors?.length || !this.blackGrassFactionManager || !this.generatedEnemyRuntime) return;
    this.blackGrassFactionManager.spawnInitialAnchors(anchors);
    anchors.forEach((anchor) => this.generatedEnemyRuntime.activeAnchorIds.add(anchor.id));
  }

  updateGeneratedEnemyActivation(playerPosition) {
    if (!this.generatedEnemyRuntime || !this.blackGrassFactionManager || !playerPosition) return;
    const { activeAnchorIds, sleepingUntil, policy, devStats } = this.generatedEnemyRuntime;
    const now = Date.now();

    this.blackGrassFactionManager.enemies.forEach((enemy) => {
      const anchorId = enemy.spawnAnchor?.id;
      if (!anchorId || !activeAnchorIds.has(anchorId) || !enemy.group || enemy.isRemoved) return;
      const distance = horizontalDistance(enemy.group.position, playerPosition);
      const isEngaged = enemy.playerRevengeTimer > 0
        || enemy.behaviorState === 'attack_player_fallback'
        || enemy.behaviorState === 'attack_enemy_faction'
        || enemy.behaviorState === 'jump_attack_enemy_faction';
      if (distance > policy.sleepRadius && !isEngaged) {
        enemy.hideCorpse();
        activeAnchorIds.delete(anchorId);
        sleepingUntil.set(anchorId, now + policy.respawnCooldownMs);
        if (devStats) devStats.sleepCount += 1;
      }
    });

    this.blackGrassFactionManager.enemies = this.blackGrassFactionManager.enemies.filter((enemy) => !enemy.isRemoved || enemy.isAlive);
    const wakeIntervalMs = 1000 / policy.maxWakePerSecond;
    if (now - (this.generatedEnemyRuntime.lastWakeAt ?? 0) >= wakeIntervalMs) {
      const anchors = this.selectGeneratedEnemyWakeAnchors(playerPosition, 1);
      if (anchors.length) {
        this.spawnGeneratedEnemyAnchors(anchors);
        this.generatedEnemyRuntime.lastWakeAt = now;
        if (devStats) devStats.wakeCount += anchors.length;
      }
    }
  }

  createRuntimeEnemyAnchor(spawn, runtime) {
    const safePosition = this.findSafeCompiledEnemySpawnPosition(spawn, runtime);
    if (!safePosition) {
      console.warn(`Skipping generated enemy spawn ${spawn.id}: no safe walkable point found.`);
      return null;
    }
    const preferredFaction = ['sheep_demon', 'neck_man'].includes(spawn.preferredFaction)
      ? spawn.preferredFaction
      : ['sheep_demon', 'neck_man'].includes(spawn.faction)
        ? spawn.faction
        : spawn.species;
    const patrolPoints = (spawn.patrolPoints?.length ? spawn.patrolPoints : this.createFallbackPatrolPoints(safePosition))
      .map((point) => this.findSafeCompiledEnemySpawnPosition({ ...spawn, id: `${spawn.id}:patrol`, position: point }, runtime) ?? safePosition.clone());
    return {
      id: spawn.id,
      preferredFaction,
      faction: spawn.faction,
      species: spawn.species,
      position: safePosition,
      yaw: spawn.yaw,
      scale: spawn.scale,
      roomId: spawn.roomId ?? this.findCompiledRoomIdForPoint(safePosition, runtime),
      initialWave: spawn.initialWave || spawn.allowedForInitialWave || spawn.tags?.includes('initial-wave'),
      allowedForInitialWave: spawn.allowedForInitialWave,
      allowedForRespawn: spawn.allowedForRespawn,
      minDistanceFromPlayer: spawn.minDistanceFromPlayer,
      actionBubblePriority: spawn.actionBubblePriority,
      tags: spawn.tags ?? [],
      userData: spawn.userData ?? {},
      patrolPoints: Object.freeze(patrolPoints.map((point) => point.clone())),
    };
  }

  findSafeCompiledEnemySpawnPosition(spawn, runtime) {
    const position = spawn.position?.clone?.() ?? this.toVector3(spawn.position, 0);
    position.y = this.collision?.sampleWalkableY?.(position.x, position.z, position.y)?.y ?? position.y;
    if (this.collision?.canStandAtFloorPosition?.(position) ?? this.collision?.canStandAt(position)) return position;
    const room = runtime.navGraph?.rooms?.[spawn.roomId] ?? this.findCompiledRoomForPoint(position, runtime);
    const candidates = [];
    if (room) {
      const clamped = position.clone();
      clamped.x = THREE.MathUtils.clamp(clamped.x, room.minX + 0.9, room.maxX - 0.9);
      clamped.z = THREE.MathUtils.clamp(clamped.z, room.minZ + 0.9, room.maxZ - 0.9);
      candidates.push(clamped, room.center?.clone?.());
    }
    candidates.push(...this.createFallbackPatrolPoints(position, 1.5));
    return candidates.find((candidate) => candidate && (this.collision?.canStandAtFloorPosition?.(candidate) ?? this.collision?.canStandAt(candidate)))?.clone() ?? null;
  }

  findCompiledRoomForPoint(point, runtime) {
    return Object.values(runtime.navGraph?.rooms ?? {}).find((room) => (
      point.x >= room.minX && point.x <= room.maxX && point.z >= room.minZ && point.z <= room.maxZ
    )) ?? null;
  }

  findCompiledRoomIdForPoint(point, runtime) {
    return this.findCompiledRoomForPoint(point, runtime)?.id ?? null;
  }

  createFallbackPatrolPoints(position, radius = 3) {
    return [
      position.clone().add(new THREE.Vector3(-radius, 0, -radius)),
      position.clone().add(new THREE.Vector3(radius, 0, -radius)),
      position.clone().add(new THREE.Vector3(radius, 0, radius)),
      position.clone().add(new THREE.Vector3(-radius, 0, radius)),
    ];
  }

  buildBlackGrassTempleInterior() {
    const runtime = this.blackGrassRuntime ?? this.compileLocationRuntime('black-grass-temple');
    this.blackGrassRuntime = runtime;
    this.scene.background = new THREE.Color(runtime.definition.lighting?.background ?? 0x100f0d);
    this.scene.fog = new THREE.Fog(
      runtime.definition.fog?.color ?? 0x242018,
      runtime.definition.fog?.near ?? 12,
      runtime.definition.fog?.far ?? 58,
    );
    this.scene.add(runtime.group);
    this.torchFlickerController.registerFromObject(runtime.group);
    this.reliquaryBlock = runtime.group.getObjectByName('BGT-P14-central-reliquary-block');
    this.rustedSwordChest = runtime.group.getObjectByName('BGT-P16-rusted-sword-chest-placeholder');
    if (this.gameState?.hasRustedSwordChestOpened?.()) {
      this.markInteractionCollected('BGT_INT_RUSTED_SWORD_CHEST');
    }
    this.dungeonDebugRenderer = new DungeonDebugRenderer({ scene: this.scene, runtime });
    this.addBlackGrassTempleEnemies();
  }

  addBlackGrassTempleEnemies() {
    this.blackGrassFactionManager = new BlackGrassTempleFactionManager({
      scene: this.scene,
      collision: this.collision,
      anchors: this.blackGrassFactionSpawnAnchors,
      navigationGraph: this.blackGrassNavigationGraph,
      encounterZones: this.blackGrassRuntime?.encounterZones,
      onGoreEvent: (payload) => this.handleFactionGoreEvent(payload),
    });
    this.blackGrassFactionManager.spawnInitialWave();
  }

  findRoomIdForPosition(position) {
    if (!position) return this.area;
    const rooms = this.blackGrassRuntime?.rooms?.length
      ? this.blackGrassRuntime.rooms
      : [
        { id: 'R01', minX: -4, maxX: 4, minZ: -34, maxZ: -16 },
        { id: 'R02', minX: -11, maxX: 11, minZ: -18, maxZ: -6 },
        { id: 'R03', minX: -30, maxX: -14, minZ: -16, maxZ: 0 },
        { id: 'R04', minX: 14, maxX: 30, minZ: -16, maxZ: 0 },
        { id: 'R05', minX: -15, maxX: 15, minZ: 2, maxZ: 26 },
        { id: 'R06', minX: -7, maxX: 7, minZ: 25, maxZ: 35 },
      ];
    const room = rooms.find((candidate) => (
      position.x >= candidate.minX
      && position.x <= candidate.maxX
      && position.z >= candidate.minZ
      && position.z <= candidate.maxZ
    ));
    return room?.id ?? this.area;
  }

  getFloorYForPosition(position) {
    const roomId = this.findRoomIdForPosition(position);
    const authoredRoom = this.blackGrassRuntime?.rooms?.find((room) => room.id === roomId);
    return authoredRoom?.floorY ?? FLOOR_Y;
  }

  handleFactionGoreEvent({ kind, event }) {
    if (!event) return;
    if (kind === 'death') this.goreRuntime.emitDeathGore(event);
    else this.goreRuntime.emitHitGore(event);
  }

  emitPlayerAttackGore(hit, attack) {
    if (!hit?.goreEvent) return;
    const event = {
      ...hit.goreEvent,
      weaponId: hit.goreEvent.weaponId ?? attack.goreProfileId ?? attack.weaponId ?? 'sword',
      direction: hit.goreEvent.direction ?? attack.direction,
      roomId: hit.goreEvent.roomId ?? this.findRoomIdForPosition(hit.goreEvent.position),
      damageAmount: hit.damage,
      hitStrength: hit.killed ? 1.7 : 1.05,
      tags: ['player_attack', ...(hit.goreEvent.tags ?? [])],
    };
    if (hit.killed) this.goreRuntime.emitDeathGore(event);
    else this.goreRuntime.emitHitGore(event);
  }

  markInteractionCollected(interactionId) {
    const interaction = this.inspectInteractions.find((candidate) => candidate.id === interactionId);
    if (!interaction) return false;
    interaction.collected = true;
    const propId = interaction.userData?.propId;
    const prop = propId ? this.scene.getObjectByName(propId) : null;
    if (prop?.material) {
      prop.material = prop.material.clone();
      prop.material.color.setHex(0x42382f);
      prop.material.emissive?.setHex?.(0x120d0a);
      prop.material.emissiveIntensity = 0.08;
    }
    return true;
  }

  addLights() {
    this.scene.background = new THREE.Color(INDOOR_BACKGROUND_COLOR);
    this.scene.fog = new THREE.Fog(INDOOR_FOG_COLOR, INDOOR_FOG_NEAR, INDOOR_FOG_FAR);

    const ambient = new THREE.HemisphereLight(INDOOR_AMBIENT_SKY_COLOR, INDOOR_AMBIENT_GROUND_COLOR, INDOOR_AMBIENT_INTENSITY);
    this.scene.add(ambient);

    const roomFill = new THREE.DirectionalLight(INDOOR_ROOM_FILL_COLOR, INDOOR_ROOM_FILL_INTENSITY);
    roomFill.position.set(2.5, 5, 4);
    this.scene.add(roomFill);

    const entryTorchGlow = new THREE.PointLight(0xffad63, 2.35, 17, 1.22);
    entryTorchGlow.name = 'R01-entry-corridor-readable-warm-fill';
    entryTorchGlow.position.set(0, 2.05, -27);
    this.scene.add(entryTorchGlow);

    const splitGlow = new THREE.PointLight(0xffbd78, 2.5, 20, 1.24);
    splitGlow.name = 'R02-split-hall-readable-warm-fill';
    splitGlow.position.set(0, 2.15, -12);
    this.scene.add(splitGlow);

    const guardianGlow = new THREE.PointLight(0xffae67, 3.1, 24, 1.3);
    guardianGlow.name = 'R05-guardian-chamber-dirty-warm-fill';
    guardianGlow.position.set(0, 2.35, 14);
    this.scene.add(guardianGlow);

    const sheepDemonReadabilityGlow = new THREE.PointLight(0xf0b06e, 1.8, 13, 1.45);
    sheepDemonReadabilityGlow.name = 'R04-sheep-demon-animation-readable-fill';
    sheepDemonReadabilityGlow.position.set(22, 2.15, -8.2);
    this.scene.add(sheepDemonReadabilityGlow);

    const reliquaryGlow = new THREE.PointLight(0x9fb7d6, 1.65, 15, 1.38);
    reliquaryGlow.name = 'R06-reliquary-alcove-dim-cold-fill';
    reliquaryGlow.position.set(0, 1.85, 32);
    this.scene.add(reliquaryGlow);
  }

  loadRepeatingTexture(path, repeat) {
    const texture = this.textureLoader.load(path, (loadedTexture) => {
      if (import.meta.env.DEV) {
        console.info(`Texture loaded: ${path} @ repeat ${repeat[0]}x${repeat[1]}`, loadedTexture.image?.width, loadedTexture.image?.height);
      }
    });
    texture.name = path;
    texture.userData = { path, repeat: [...repeat] };
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }

  makeTexturedMaterial({ path, repeat, color = 0xffffff, roughness = 0.92, metalness = 0.02, emissive, emissiveIntensity, transparent = false, opacity = 1 } = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      map: this.loadRepeatingTexture(path, repeat),
      roughness,
      metalness,
      transparent,
      opacity,
      ...(emissive !== undefined ? { emissive, emissiveIntensity } : {}),
    });
  }

  updateAnimatedDungeonMaterials(deltaSeconds) {
    if (!this.scene) return;
    this.scene.traverse((object) => {
      if (!object.isMesh || object.userData?.animated !== 'canalWater') return;
      const material = object.material;
      const texture = material?.map;
      if (!texture) return;
      const profile = material.userData?.definitionProfile ?? {};
      const speed = object.userData.scrollSpeed ?? profile.scrollSpeed ?? [0.025, 0.008];
      texture.offset.x = (texture.offset.x + deltaSeconds * (speed[0] ?? 0.025)) % 1;
      texture.offset.y = (texture.offset.y + deltaSeconds * (speed[1] ?? 0.008)) % 1;
      if (material.emissiveIntensity !== undefined) {
        const shimmer = profile.shimmerIntensity ?? 0.025;
        material.emissiveIntensity = (profile.baseEmissiveIntensity ?? 0.42) + Math.sin(performance.now() * 0.0017 + object.id) * shimmer;
      }
    });
  }

  addBox({ size, position, material, name }) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    if (name) mesh.name = name;
    mesh.position.copy(position);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  addBabyLabyrinthInterior() {
    const wallMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: TEXTURE_REPEATS.longWall, color: 0xffffff, roughness: 0.94, metalness: 0.01, emissive: INDOOR_STONE_EMISSIVE, emissiveIntensity: INDOOR_STONE_EMISSIVE_INTENSITY });

    const floorAndCeilingSlabs = [
      // Trimmed slabs meet at doorway edges instead of overlapping at the same Y plane.
      { id: 'R01', minX: -4, maxX: 4, minZ: -34, maxZ: -18, repeat: [2, 4.5] },
      { id: 'R02', minX: -11, maxX: 11, minZ: -18, maxZ: -6, repeat: [6, 3] },
      { id: 'R03', minX: -30, maxX: -14, minZ: -16, maxZ: 0, repeat: [4, 4] },
      { id: 'R04', minX: 14, maxX: 30, minZ: -16, maxZ: 0, repeat: [4, 4] },
      { id: 'R05', minX: -15, maxX: 15, minZ: 2, maxZ: 25, repeat: [8, 5.75] },
      { id: 'R06', minX: -7, maxX: 7, minZ: 25, maxZ: 35, repeat: [4, 3] },
      { id: 'C01', minX: -22, maxX: -15, minZ: 0, maxZ: 20, repeat: [2, 5] },
      { id: 'C02', minX: 15, maxX: 22, minZ: 0, maxZ: 20, repeat: [2, 5] },
      { id: 'D03', minX: -14, maxX: -11, minZ: -11.8, maxZ: -8.2, repeat: [1, 1] },
      { id: 'D04', minX: 11, maxX: 14, minZ: -11.8, maxZ: -8.2, repeat: [1, 1] },
      { id: 'D05', minX: -2.2, maxX: 2.2, minZ: -6, maxZ: 2, repeat: [1.25, 2.25] },
    ];

    floorAndCeilingSlabs.forEach((slab) => {
      const width = slab.maxX - slab.minX;
      const depth = slab.maxZ - slab.minZ;
      const centerX = (slab.minX + slab.maxX) / 2;
      const centerZ = (slab.minZ + slab.maxZ) / 2;
      const slabFloorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: slab.repeat, color: 0xffffff, roughness: 0.9, metalness: 0.0, emissive: INDOOR_FLOOR_EMISSIVE, emissiveIntensity: INDOOR_FLOOR_EMISSIVE_INTENSITY });
      const slabCeilingMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.ceiling, repeat: slab.repeat, color: 0xffffff, roughness: 0.95, metalness: 0.0, emissive: INDOOR_CEILING_EMISSIVE, emissiveIntensity: INDOOR_CEILING_EMISSIVE_INTENSITY });
      this.addBox({ size: new THREE.Vector3(width, 0.18, depth), position: new THREE.Vector3(centerX, FLOOR_Y - 0.09, centerZ), material: slabFloorMat, name: `FLOOR-${slab.id}-floor_worn_stone_01` });
      this.addBox({ size: new THREE.Vector3(width, 0.18, depth), position: new THREE.Vector3(centerX, WALL_HEIGHT, centerZ), material: slabCeilingMat, name: `CEIL-${slab.id}-ceiling_dark_stone_01` });
    });

    const walls = BABY_LABYRINTH_WALL_SEGMENTS;

    walls.forEach((wall) => {
      this.addBox({ size: new THREE.Vector3(...wall.size), position: new THREE.Vector3(...wall.pos), material: wallMat, name: `${wall.id}-WALL_PERIM-wall_black_stone_01` });
    });

    const thresholdMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: [1, 1], color: 0xb7a07f, roughness: 0.91, metalness: 0.0, emissive: 0x2b1c10, emissiveIntensity: 0.18 });
    this.addBox({ size: new THREE.Vector3(4, 0.08, 1.2), position: new THREE.Vector3(0, FLOOR_Y + 0.02, -32), material: thresholdMat, name: 'INT01-D01-field-return-threshold-floor_worn_stone_01' });

    this.addEastGrate();
  }

  addBabyLabyrinthStaging() {
    const slabMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [2.2, 1.4], color: 0xa99d89, roughness: 0.96, metalness: 0.0, emissive: 0x1f1711, emissiveIntensity: 0.14 });
    const relicMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [1.4, 0.8], color: 0x6d6255, roughness: 0.98, metalness: 0.0, emissive: 0x080606, emissiveIntensity: 0.22 });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: [1.4, 1], color: 0x9e927f, roughness: 0.95, metalness: 0.0 });

    this.addBox({ size: new THREE.Vector3(7, 3.2, 0.45), position: new THREE.Vector3(-22, 1.6, -14.5), material: slabMat, name: 'SLAB01-R03-west-shrine-slab-wall_black_stone_01' });
    if (this.gameState?.hasSouthReliquaryFragment) {
      relicMat.color.setHex(0x8f7a5a);
      relicMat.emissive.setHex(0x2f1f11);
      relicMat.emissiveIntensity = 0.82;
    }

    this.reliquaryBlock = this.addBox({ size: new THREE.Vector3(5, 1.5, 2), position: new THREE.Vector3(0, 0.75, 32), material: relicMat, name: 'RELIC01-R06-reliquary-block-wall_black_stone_01' });
    if (this.gameState?.hasSouthReliquaryFragment) this.wakeReliquaryVisuals();
    this.addBox({ size: new THREE.Vector3(7, 0.28, 4), position: new THREE.Vector3(0, 0.14, 32), material: floorMat, name: 'RELIC01-low-alcove-dais-floor_worn_stone_01' });

    const guardianDaisMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: [2.5, 2.5], color: 0x8b7a67, roughness: 0.94, metalness: 0.0, emissive: 0x1b120b, emissiveIntensity: 0.16 });
    this.addBox({ size: new THREE.Vector3(9, 0.22, 7), position: new THREE.Vector3(0, 0.11, 14), material: guardianDaisMat, name: 'R05-guardian-chamber-central-dais-floor_worn_stone_01' });
  }

  addEastGrate() {
    const gateGroup = new THREE.Group();
    gateGroup.name = 'GATE01-R04-east-grate-metal_gate_rusted_01';
    const barMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: TEXTURE_REPEATS.gateBars, color: 0xffffff, roughness: 0.72, metalness: 0.48, emissive: 0x26160f, emissiveIntensity: 0.28 });
    const beamMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: TEXTURE_REPEATS.gateBeams, color: 0xffffff, roughness: 0.72, metalness: 0.48, emissive: 0x26160f, emissiveIntensity: 0.28 });

    for (let z = -10.35; z <= -5.65; z += 0.72) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.7, 0.16), barMat);
      bar.name = 'GATE01-vertical-rusted-bar';
      bar.position.set(11, 1.35, z);
      gateGroup.add(bar);
    }

    [-10.75, -5.25].forEach((z) => {
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.85, 0.18), beamMat);
      upright.name = 'GATE01-rusted-side-upright';
      upright.position.set(11, 1.42, z);
      gateGroup.add(upright);
    });

    [0.35, 1.45, 2.55].forEach((y) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 5.5), beamMat);
      rail.name = 'GATE01-rusted-cross-rail';
      rail.position.set(11, y, -8);
      gateGroup.add(rail);
    });

    this.gate = gateGroup;
    this.scene.add(gateGroup);
  }

  addRoom() {
    const wallMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: TEXTURE_REPEATS.roomWall, color: 0xffffff, roughness: 0.94, metalness: 0.01, emissive: INDOOR_STONE_EMISSIVE, emissiveIntensity: INDOOR_STONE_EMISSIVE_INTENSITY });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: TEXTURE_REPEATS.roomFloor, color: 0xffffff, roughness: 0.9, metalness: 0.0, emissive: INDOOR_FLOOR_EMISSIVE, emissiveIntensity: INDOOR_FLOOR_EMISSIVE_INTENSITY });
    const ceilingMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.ceiling, repeat: TEXTURE_REPEATS.roomCeiling, color: 0xffffff, roughness: 0.95, metalness: 0.0, emissive: INDOOR_CEILING_EMISSIVE, emissiveIntensity: INDOOR_CEILING_EMISSIVE_INTENSITY });

    this.addBox({ size: new THREE.Vector3(12, 0.18, 12), position: new THREE.Vector3(0, FLOOR_Y - 0.09, 0), material: floorMat, name: 'room-floor-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(3.9, 0.08, 1.0), position: new THREE.Vector3(0, FLOOR_Y + 0.02, 5.38), material: floorMat, name: 'field-return-threshold-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(12, 0.18, 12), position: new THREE.Vector3(0, WALL_HEIGHT, 0), material: ceilingMat, name: 'room-ceiling-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(12, WALL_HEIGHT, 0.4), position: new THREE.Vector3(0, WALL_HEIGHT / 2, 6), material: wallMat });
    // West wall leaves a barred shortcut slit that only opens from the return passage.
    this.addBox({ size: new THREE.Vector3(0.4, WALL_HEIGHT, 9.7), position: new THREE.Vector3(-6, WALL_HEIGHT / 2, 1.15), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.4, WALL_HEIGHT, 0.95), position: new THREE.Vector3(-6, WALL_HEIGHT / 2, -5.52), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.4, WALL_HEIGHT, 12), position: new THREE.Vector3(6, WALL_HEIGHT / 2, 0), material: wallMat });

    // Back wall is split to leave a readable corridor opening.
    this.addBox({ size: new THREE.Vector3(4.7, WALL_HEIGHT, 0.4), position: new THREE.Vector3(-3.65, WALL_HEIGHT / 2, -6), material: wallMat });
    this.addBox({ size: new THREE.Vector3(4.7, WALL_HEIGHT, 0.4), position: new THREE.Vector3(3.65, WALL_HEIGHT / 2, -6), material: wallMat });
  }

  addCorridor() {
    const wallMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: TEXTURE_REPEATS.corridorWall, color: 0xffffff, roughness: 0.94, metalness: 0.01, emissive: INDOOR_STONE_EMISSIVE, emissiveIntensity: INDOOR_STONE_EMISSIVE_INTENSITY });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: TEXTURE_REPEATS.corridorFloor, color: 0xffffff, roughness: 0.9, metalness: 0.0, emissive: INDOOR_FLOOR_EMISSIVE, emissiveIntensity: INDOOR_FLOOR_EMISSIVE_INTENSITY });
    const ceilingMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.ceiling, repeat: TEXTURE_REPEATS.corridorCeiling, color: 0xffffff, roughness: 0.95, metalness: 0.0, emissive: INDOOR_CEILING_EMISSIVE, emissiveIntensity: INDOOR_CEILING_EMISSIVE_INTENSITY });

    this.addBox({ size: new THREE.Vector3(3.1, 0.18, 12), position: new THREE.Vector3(0, FLOOR_Y - 0.09, -11.6), material: floorMat, name: 'corridor-floor-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(3.1, 0.18, 12), position: new THREE.Vector3(0, WALL_HEIGHT, -11.6), material: ceilingMat, name: 'corridor-ceiling-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 12), position: new THREE.Vector3(-1.7, WALL_HEIGHT / 2, -11.6), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 12), position: new THREE.Vector3(1.7, WALL_HEIGHT / 2, -11.6), material: wallMat });
  }

  addDungeonExpansion() {
    const wallMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: TEXTURE_REPEATS.branchWall, color: 0xffffff, roughness: 0.94, metalness: 0.01, emissive: INDOOR_STONE_EMISSIVE, emissiveIntensity: INDOOR_STONE_EMISSIVE_INTENSITY });
    const longWallMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: TEXTURE_REPEATS.longWall, color: 0xffffff, roughness: 0.94, metalness: 0.01, emissive: INDOOR_STONE_EMISSIVE, emissiveIntensity: INDOOR_STONE_EMISSIVE_INTENSITY });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: TEXTURE_REPEATS.branchFloor, color: 0xffffff, roughness: 0.9, metalness: 0.0, emissive: INDOOR_FLOOR_EMISSIVE, emissiveIntensity: INDOOR_FLOOR_EMISSIVE_INTENSITY });
    const returnFloorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: TEXTURE_REPEATS.returnFloor, color: 0xffffff, roughness: 0.9, metalness: 0.0, emissive: INDOOR_FLOOR_EMISSIVE, emissiveIntensity: INDOOR_FLOOR_EMISSIVE_INTENSITY });
    const ceilingMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.ceiling, repeat: TEXTURE_REPEATS.branchCeiling, color: 0xffffff, roughness: 0.95, metalness: 0.0, emissive: INDOOR_CEILING_EMISSIVE, emissiveIntensity: INDOOR_CEILING_EMISSIVE_INTENSITY });
    const returnCeilingMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.ceiling, repeat: TEXTURE_REPEATS.returnCeiling, color: 0xffffff, roughness: 0.95, metalness: 0.0, emissive: INDOOR_CEILING_EMISSIVE, emissiveIntensity: INDOOR_CEILING_EMISSIVE_INTENSITY });
    const doorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: TEXTURE_REPEATS.gateBeams, color: 0xf0ddbd, roughness: 0.74, metalness: 0.36, emissive: 0x3a2412, emissiveIntensity: 0.3 });

    // Space 1: a tight vestibule immediately beyond the locked gate.
    this.addBox({ size: new THREE.Vector3(3.1, 0.18, 5.25), position: new THREE.Vector3(0, FLOOR_Y - 0.09, -19.72), material: floorMat, name: 'post-gate-vestibule-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(3.1, 0.18, 5.25), position: new THREE.Vector3(0, WALL_HEIGHT, -19.72), material: ceilingMat, name: 'post-gate-vestibule-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 2.65), position: new THREE.Vector3(-1.7, WALL_HEIGHT / 2, -18.55), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 2.65), position: new THREE.Vector3(1.7, WALL_HEIGHT / 2, -18.55), material: wallMat });

    // Space 2: a cross passage that turns east into the encounter chamber and west into the return shortcut.
    this.addBox({ size: new THREE.Vector3(9.85, 0.18, 3.05), position: new THREE.Vector3(0, FLOOR_Y - 0.09, -20.8), material: floorMat, name: 'cross-passage-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(9.85, 0.18, 3.05), position: new THREE.Vector3(0, WALL_HEIGHT, -20.8), material: ceilingMat, name: 'cross-passage-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(3.1, WALL_HEIGHT, 0.35), position: new THREE.Vector3(-3.25, WALL_HEIGHT / 2, -18.95), material: wallMat });
    this.addBox({ size: new THREE.Vector3(3.1, WALL_HEIGHT, 0.35), position: new THREE.Vector3(3.25, WALL_HEIGHT / 2, -18.95), material: wallMat });
    this.addBox({ size: new THREE.Vector3(9.85, WALL_HEIGHT, 0.35), position: new THREE.Vector3(0, WALL_HEIGHT / 2, -22.55), material: wallMat });

    // Space 3: a small east crypt chamber for the first enemy encounter.
    this.addBox({ size: new THREE.Vector3(5.15, 0.18, 6.55), position: new THREE.Vector3(7.18, FLOOR_Y - 0.09, -21.05), material: floorMat, name: 'east-crypt-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(5.15, 0.18, 6.55), position: new THREE.Vector3(7.18, WALL_HEIGHT, -21.05), material: ceilingMat, name: 'east-crypt-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 6.55), position: new THREE.Vector3(9.85, WALL_HEIGHT / 2, -21.05), material: longWallMat });
    this.addBox({ size: new THREE.Vector3(3.85, WALL_HEIGHT, 0.35), position: new THREE.Vector3(7.78, WALL_HEIGHT / 2, -17.6), material: wallMat });
    this.addBox({ size: new THREE.Vector3(2.05, WALL_HEIGHT, 0.35), position: new THREE.Vector3(5.78, WALL_HEIGHT / 2, -24.5), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 1.85), position: new THREE.Vector3(4.55, WALL_HEIGHT / 2, -18.55), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 1.85), position: new THREE.Vector3(4.55, WALL_HEIGHT / 2, -23.15), material: wallMat });

    // A compact hidden alcove behind a false north wall.
    this.addBox({ size: new THREE.Vector3(2.55, 0.18, 2.9), position: new THREE.Vector3(8.2, FLOOR_Y - 0.09, -25.68), material: floorMat, name: 'hidden-alcove-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(2.55, 0.18, 2.9), position: new THREE.Vector3(8.2, WALL_HEIGHT, -25.68), material: ceilingMat, name: 'hidden-alcove-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 2.9), position: new THREE.Vector3(6.83, WALL_HEIGHT / 2, -25.68), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 2.9), position: new THREE.Vector3(9.57, WALL_HEIGHT / 2, -25.68), material: wallMat });
    this.addBox({ size: new THREE.Vector3(2.75, WALL_HEIGHT, 0.35), position: new THREE.Vector3(8.2, WALL_HEIGHT / 2, -27.25), material: wallMat });
    this.secretWall = this.addBox({ size: new THREE.Vector3(2.35, WALL_HEIGHT, 0.32), position: new THREE.Vector3(8.2, WALL_HEIGHT / 2, -24.38), material: wallMat, name: 'secret-cracked-wall' });

    // West return passage: a readable loop back to the entry chamber after the gate is conquered.
    this.addBox({ size: new THREE.Vector3(3.25, 0.18, 18.95), position: new THREE.Vector3(-6.3, FLOOR_Y - 0.09, -12.72), material: returnFloorMat, name: 'west-return-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(3.25, 0.18, 18.95), position: new THREE.Vector3(-6.3, WALL_HEIGHT, -12.72), material: returnCeilingMat, name: 'west-return-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 18.95), position: new THREE.Vector3(-8.05, WALL_HEIGHT / 2, -12.72), material: longWallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 13.85), position: new THREE.Vector3(-4.55, WALL_HEIGHT / 2, -13.82), material: longWallMat });
    this.addBox({ size: new THREE.Vector3(3.25, WALL_HEIGHT, 0.35), position: new THREE.Vector3(-6.3, WALL_HEIGHT / 2, -3.12), material: wallMat });

    this.shortcutDoor = this.addBox({ size: new THREE.Vector3(0.22, 2.35, 1.28), position: new THREE.Vector3(-5.82, 1.18, ROOM_DOORWAY_Z), material: doorMat, name: 'entry-return-shortcut-door' });
  }

  addPathCues() {
    const pathMat = new THREE.MeshBasicMaterial({ color: 0xc99b5b, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf0cf87, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });

    const centerPath = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 22), pathMat);
    centerPath.rotation.x = -Math.PI / 2;
    centerPath.position.set(0, 0.012, -6.2);
    this.scene.add(centerPath);

    [-1.28, 1.28].forEach((x) => {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 11.4), edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.018, -11.6);
      this.scene.add(edge);
    });
  }

  addTorches() {
    this.addTorch(new THREE.Vector3(-3.82, 1.55, -27), Math.PI / 2);
    this.addTorch(new THREE.Vector3(3.82, 1.55, -13), -Math.PI / 2);
    this.addTorch(new THREE.Vector3(-28.2, 1.5, -9), Math.PI / 2);
    this.addTorch(new THREE.Vector3(13.8, 1.5, 9), -Math.PI / 2);
    this.addTorch(new THREE.Vector3(-13.8, 1.5, 10), Math.PI / 2);
    this.addTorch(new THREE.Vector3(6.6, 1.55, 30), -Math.PI / 2);
  }

  addTorch(position, rotationY) {
    const group = this.createTorchGroup(position, rotationY);
    this.scene.add(group);
    return group;
  }

  createTorchGroup(position, rotationY) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotationY;

    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.75, metalness: 0.45, emissive: 0x1d130c, emissiveIntensity: 0.18 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b4d27, roughness: 0.9, emissive: 0x201008, emissiveIntensity: 0.12 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa23f });

    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.48), bracketMat);
    bracket.position.z = 0.2;
    group.add(bracket);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.75, 6), woodMat);
    handle.rotation.x = Math.PI / 2.7;
    handle.position.set(0, -0.18, 0.44);
    group.add(handle);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.48, 7), flameMat);
    flame.position.set(0, 0.22, 0.72);
    group.add(flame);

    const glow = new THREE.PointLight(INDOOR_TORCH_COLOR, INDOOR_TORCH_INTENSITY, INDOOR_TORCH_DISTANCE, INDOOR_TORCH_DECAY);
    glow.position.copy(flame.position);
    group.add(glow);
    const phase = this.torchLights.length * 1.93;
    this.torchLights.push({
      light: glow,
      flame,
      baseIntensity: glow.intensity,
      baseDistance: glow.distance,
      phase,
    });
    this.torchFlickerController.registerFixture({
      pointLight: glow,
      flame,
      baseIntensity: glow.intensity,
      baseDistance: glow.distance,
      phase,
      profile: { flickerAmount: 0.11, flickerSpeed: 1 },
    });

    return group;
  }

  addKeyPickup() {
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x51463c, roughness: 0.86, metalness: 0.05, emissive: 0x1c1712, emissiveIntensity: 0.14 });
    const keyMat = new THREE.MeshStandardMaterial({ color: 0xd7b76a, roughness: 0.42, metalness: 0.72, emissive: 0x3a2406, emissiveIntensity: 0.34 });

    const group = new THREE.Group();
    group.position.copy(this.keyTarget);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.58, 8), pedestalMat);
    pedestal.position.y = -0.32;
    group.add(pedestal);

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.08), keyMat);
    shaft.position.x = 0.08;
    group.add(shaft);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 16), keyMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = -0.36;
    group.add(ring);

    [0.25, 0.43].forEach((x, index) => {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18 + index * 0.08, 0.08), keyMat);
      tooth.position.set(x, -0.11 - index * 0.02, 0);
      group.add(tooth);
    });

    const glow = new THREE.PointLight(0xf3c76f, 1.7, 4.5, 1.8);
    glow.position.set(0, 0.3, 0);
    group.add(glow);

    this.key = group;
    this.scene.add(group);
  }

  addLever() {
    const group = new THREE.Group();
    group.position.copy(this.leverTarget);
    group.rotation.y = -Math.PI / 2;

    const plateMat = new THREE.MeshStandardMaterial({ color: 0x5a4c3e, roughness: 0.68, metalness: 0.45, emissive: 0x1d130c, emissiveIntensity: 0.16 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xb7834b, roughness: 0.62, metalness: 0.25, emissive: 0x2b1809, emissiveIntensity: 0.28 });

    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.5), plateMat);
    group.add(plate);

    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12), handleMat);
    pivot.rotation.z = Math.PI / 2;
    pivot.position.x = -0.12;
    group.add(pivot);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.12), handleMat);
    handle.name = 'lever-handle';
    handle.position.set(-0.15, 0.18, 0);
    handle.rotation.z = 0.45;
    group.add(handle);

    this.lever = group;
    this.scene.add(group);
  }

  addTextureVerificationMode() {
    if (!import.meta.env.DEV) return;

    const query = new URLSearchParams(window.location.search);
    this.textureCheckRig = this.createTextureCheckRig();
    this.textureCheckRig.visible = query.get('textureCheck') === '1';
    this.scene.add(this.textureCheckRig);

    window.addEventListener('keydown', (event) => {
      if (event.code !== 'KeyT') return;
      this.textureCheckRig.visible = !this.textureCheckRig.visible;
      console.info(`Texture check mode ${this.textureCheckRig.visible ? 'enabled' : 'disabled'}`);
    });
  }

  createTextureCheckRig() {
    const rig = new THREE.Group();
    rig.name = 'dev-texture-check-rig';
    rig.position.set(-5.35, 1.6, 5.75);

    Object.entries(TEXTURE_PATHS).forEach(([name, path], index) => {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: this.loadRepeatingTexture(path, [1, 1]),
        side: THREE.DoubleSide,
      });
      const swatch = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), material);
      swatch.name = `dev-texture-check-${name}`;
      swatch.position.set(index * 1.06, 0, 0);
      rig.add(swatch);
    });

    return rig;
  }

  updateTorchFlicker(deltaSeconds) {
    this.torchFlickerController.update(deltaSeconds);
  }

  updateRamManNpcPatrol(deltaSeconds) {
    this.ramManNpcActor?.update(deltaSeconds, { behaviorState: this.ramManNpcAnimation?.state ?? 'idle' });

    if (!this.ramManNpc || RAM_MAN_NPC_PATROL_POINTS.length < 2) {
      this.setRamManNpcAnimation('idle');
      return;
    }

    if (this.ramManNpcPauseTimer > 0) {
      this.ramManNpcPauseTimer = Math.max(0, this.ramManNpcPauseTimer - deltaSeconds);
      this.setRamManNpcAnimation('idle');
      return;
    }

    const target = RAM_MAN_NPC_PATROL_POINTS[this.ramManNpcMoveTarget];
    const current = this.ramManNpc.position;
    const toTarget = target.clone().sub(current);
    toTarget.y = 0;
    const distance = toTarget.length();

    if (distance < 0.08) {
      this.ramManNpcPatrolIndex = this.ramManNpcMoveTarget;
      this.ramManNpcMoveTarget = (this.ramManNpcMoveTarget + 1) % RAM_MAN_NPC_PATROL_POINTS.length;
      this.ramManNpcPauseTimer = RAM_MAN_NPC_PATROL_PAUSE_SECONDS;
      this.setRamManNpcAnimation('idle');
      return;
    }

    const direction = toTarget.normalize();
    const stepDistance = Math.min(distance, RAM_MAN_NPC_PATROL_SPEED * deltaSeconds);
    const next = current.clone().add(direction.clone().multiplyScalar(stepDistance));
    next.y = FLOOR_Y;

    if (this.collision.canStandAt(next)) {
      current.copy(next);
      this.setRamManNpcAnimation(stepDistance > 0.001 ? 'walk' : 'idle');
    } else {
      this.ramManNpcMoveTarget = (this.ramManNpcMoveTarget + 1) % RAM_MAN_NPC_PATROL_POINTS.length;
      this.ramManNpcPauseTimer = RAM_MAN_NPC_PATROL_PAUSE_SECONDS;
      this.setRamManNpcAnimation('idle');
    }

    const desiredYaw = Math.atan2(direction.x, direction.z);
    this.ramManNpc.rotation.y = THREE.MathUtils.damp(this.ramManNpc.rotation.y, desiredYaw, RAM_MAN_NPC_TURN_SPEED, deltaSeconds);
  }

  setRamManNpcAnimation(state) {
    const animation = this.ramManNpcAnimation;
    if (!animation || animation.state === state) return;

    if (!this.ramManNpcActor?.setAnimationState(state, { fadeSeconds: 0.16 })) return;
    animation.state = state;
    if (this.ramManNpc) this.ramManNpc.userData.behaviorState = state;
  }

  createRamManNpcAnimationTrack({ state, root, gltf, scale }) {
    const mixer = new THREE.AnimationMixer(root);
    const clips = gltf.animations ?? [];
    const clip = clips.find((candidate) => candidate.name.toLowerCase().includes(state)) ?? clips[0];

    if (!clip) {
      console.warn(`Friendly Ram Man ${state} GLB loaded without animation clips.`);
      return { root, mixer, action: null, clip: null, clipNames: [], clipSummaries: [] };
    }

    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.enabled = true;

    return {
      root,
      mixer,
      action,
      clip,
      scale,
      clipNames: clips.map((candidate) => candidate.name || '(unnamed clip)'),
      clipSummaries: clips.map((candidate) => ({
        name: candidate.name || '(unnamed clip)',
        durationSeconds: Number(candidate.duration.toFixed(3)),
        trackCount: candidate.tracks.length,
      })),
    };
  }

  addRamManNpc() {
    // Friendly ambience-only NPC: no collision blocker, no enemy registration, no combat hooks.
    const actor = createCreatureActor('ram_man_friendly', {
      scene: this.scene,
      position: RAM_MAN_NPC_POSITION,
      yaw: 0,
      name: 'ram-man-friendly-01',
    });

    actor.load({ initialStates: ['idle', 'walk'] })
      .then(() => {
        actor.group.userData = {
          ...actor.group.userData,
          friendly: true,
          collision: 'none - visual roaming NPC only',
          combat: 'none - not registered as an enemy or target',
          placement: 'R05 guardian chamber around X 0, Z 14, clear of the reliquary route',
          patrolSpeed: RAM_MAN_NPC_PATROL_SPEED,
          patrolPauseSeconds: RAM_MAN_NPC_PATROL_PAUSE_SECONDS,
          patrolPoints: RAM_MAN_NPC_PATROL_POINTS.map((point) => ({ x: point.x, y: point.y, z: point.z })),
        };

        this.ramManNpcActor = actor;
        this.ramManNpc = actor.group;
        this.ramManNpcAnimation = {
          state: null,
          tracks: actor.animationSet.tracks,
        };
        this.setRamManNpcAnimation('idle');

        if (import.meta.env.DEV) console.info('Friendly Ram Man CreatureActor loaded:', actor.group.userData.debug);
      })
      .catch((error) => {
        this.ramManNpcActor = null;
        this.ramManNpcAnimation = null;
        console.warn(
          `Friendly Ram Man animated GLBs failed to load from ${RAM_MAN_FRIENDLY_ANIMATION_FILES.idle} or ${RAM_MAN_FRIENDLY_ANIMATION_FILES.walk}. The dungeon remains playable.`,
          error,
        );
      });
  }

  addSheepDemonEnemy() {
    if (this.area !== 'dungeon') return;

    this.sheepDemonEnemy = new SheepDemonEnemy({
      scene: this.scene,
      collision: this.collision,
    });
    this.sheepDemonEnemy.load();
  }

  updateBlackGrassFactionEnemies(deltaSeconds, player) {
    if (!this.blackGrassFactionManager || !player?.position) return;
    this.updateGeneratedEnemyActivation(player.position);
    this.blackGrassFactionManager.update(deltaSeconds, player.position, { generatedRuntime: this.generatedEnemyRuntime });
  }

  updateSheepDemonEnemy(deltaSeconds, player) {
    if (!player || this.area === 'black-grass-temple') return;

    if (this.sheepDemonEnemies?.length) {
      this.sheepDemonEnemies.forEach((enemy) => enemy.update(deltaSeconds, player.position));
      return;
    }

    if (!this.sheepDemonEnemy) return;
    this.sheepDemonEnemy.update(deltaSeconds, player.position);
  }

  consumeEnemyContactDamage(playerPosition) {
    if (this.area === 'black-grass-temple' || this.generatedEnemyRuntime) {
      return this.blackGrassFactionManager?.consumeEnemyContactDamage(playerPosition) ?? null;
    }

    if (this.sheepDemonEnemies?.length) {
      for (const enemy of this.sheepDemonEnemies) {
        const hit = enemy.consumeContactDamage(playerPosition);
        if (hit) return hit;
      }
      return null;
    }

    return this.sheepDemonEnemy?.consumeContactDamage(playerPosition) ?? null;
  }

  damageEnemyFromPlayerAttack(attack) {
    if (this.area === 'black-grass-temple' || this.generatedEnemyRuntime) {
      const hit = this.blackGrassFactionManager?.damageEnemyFromPlayerAttack(attack) ?? null;
      this.emitPlayerAttackGore(hit, attack);
      return hit;
    }

    if (this.sheepDemonEnemies?.length) {
      for (const enemy of this.sheepDemonEnemies) {
        const hit = enemy.receivePlayerAttack(attack);
        this.emitPlayerAttackGore(hit, attack);
        if (hit) return hit;
      }
      return null;
    }

    const hit = this.sheepDemonEnemy?.receivePlayerAttack(attack) ?? null;
    this.emitPlayerAttackGore(hit, attack);
    return hit;
  }

  addGate() {
    const gateGroup = new THREE.Group();
    const barMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: TEXTURE_REPEATS.gateBars, color: 0xffffff, roughness: 0.7, metalness: 0.48, emissive: 0x372313, emissiveIntensity: 0.34 });
    const beamMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: TEXTURE_REPEATS.gateBeams, color: 0xffffff, roughness: 0.7, metalness: 0.48, emissive: 0x372313, emissiveIntensity: 0.34 });
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xd5a159, transparent: true, opacity: 0.82 });

    for (let x = -1.05; x <= 1.05; x += 0.42) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.45, 0.18), barMat);
      bar.position.set(x, 1.25, -17.25);
      gateGroup.add(bar);
    }

    const top = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.18, 0.2), beamMat);
    top.position.set(0, 2.4, -17.25);
    gateGroup.add(top);

    const middle = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.16, 0.2), beamMat);
    middle.position.set(0, 1.35, -17.25);
    gateGroup.add(middle);

    [-1.48, 1.48].forEach((x) => {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.7, 0.08), markerMat);
      marker.position.set(x, 1.35, -17.08);
      gateGroup.add(marker);
    });

    this.gate = gateGroup;
    this.scene.add(gateGroup);
  }
}
