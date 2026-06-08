import * as THREE from 'three';
import { CollisionWorld } from './Collision.js';
import { loadDungeonModel } from './ModelLoader.js';
import { BlackGrassTempleFactionManager } from './BlackGrassTempleFactions.js';
import { SHEEP_DEMON_CONFIG, SheepDemonEnemy } from './SheepDemonEnemy.js';

const WALL_HEIGHT = 3.2;
const FLOOR_Y = 0;
const RAM_MAN_NPC_IDLE_URL = './assets/npcs/ram_man/ram_man_friendly_idle_01.glb';
const RAM_MAN_NPC_WALK_URL = './assets/npcs/ram_man/ram_man_friendly_walk_01.glb';
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

const FIELD_SIZE = 400;
const FIELD_GRASS_REPEAT = [50, 50];
const OUTDOOR_DAWN_SKY_COLOR = 0x64727d;
const OUTDOOR_DAWN_FOG_COLOR = 0x717a80;
const FIELD_PLAYER_START = new THREE.Vector3(0, 1.55, -175);
const FIELD_PLAYER_YAW = 0;
const FIELD_CRYPT_A_RETURN_START = new THREE.Vector3(-60, 1.55, -112);
const FIELD_CRYPT_A_RETURN_YAW = 0;
const FIELD_BLACK_GRASS_TEMPLE_RETURN_START = new THREE.Vector3(-184, 1.55, 45);
const FIELD_BLACK_GRASS_TEMPLE_RETURN_YAW = -Math.PI / 2;
const FIELD_WALKABLE_RECT = { minX: -197.5, maxX: 197.5, minZ: -197.5, maxZ: 197.5 };
const OUTDOOR_INTERACTION_RANGE = 4.25;
const RELIQUARY_FIELD_COLLIDERS = [
  // Invisible 400 x 400 slice boundaries from the Reliquary Field v0.1 blueprint.
  { id: 'BOUND02', minX: -205, maxX: 205, minZ: -205, maxZ: -199 },
  { id: 'BOUND01', minX: -205, maxX: 205, minZ: 199, maxZ: 205 },
  { id: 'BOUND03', minX: -205, maxX: -199, minZ: -205, maxZ: 205 },
  { id: 'BOUND04', minX: 199, maxX: 205, minZ: -205, maxZ: 205 },

  // Broken Shrine slabs and pillars.
  { id: 'S01_A', minX: -9, maxX: 9, minZ: -9, maxZ: 9 },
  { id: 'S01_B', minX: -6, maxX: 6, minZ: 4.25, maxZ: 5.75 },
  { id: 'S01_C', minX: -8, maxX: -6, minZ: -1, maxZ: 1 },
  { id: 'S01_D', minX: 6, maxX: 8, minZ: -2, maxZ: 0 },

  // South Reliquary Crypt exterior shell.
  { id: 'C01_A', minX: -74, maxX: -46, minZ: -107, maxZ: -83 },
  { id: 'C01_B', minX: -73.5, maxX: -70.5, minZ: -106, maxZ: -84 },
  { id: 'C01_C', minX: -49.5, maxX: -46.5, minZ: -106, maxZ: -84 },
  { id: 'C01_D', minX: -73.5, maxX: -46.5, minZ: -85.5, maxZ: -82.5 },
  { id: 'C01_E', minX: -74, maxX: -46, minZ: -97.5, maxZ: -92.5 },

  // Sunken Central Tomb exterior shell and sealed gate.
  { id: 'C03_A', minX: 17, maxX: 53, minZ: 126, maxZ: 154 },
  { id: 'C03_B', minX: 18, maxX: 52, minZ: 150, maxZ: 154 },
  { id: 'C03_C', minX: 29, maxX: 41, minZ: 127.5, maxZ: 128.5 },
  { id: 'C03_D', minX: 15, maxX: 19, minZ: 128, maxZ: 152 },
  { id: 'C03_E', minX: 51, maxX: 55, minZ: 128, maxZ: 152 },

  // Black Grass Temple temporary west-edge exterior shell. Intended C02 is X -210, Z 55; this v0.1 hook stays inside the first 400 x 400 field slice.
  { id: 'C02_A', minX: -198, maxX: -170, minZ: 30, maxZ: 60 },
  { id: 'C02_B', minX: -197, maxX: -193, minZ: 38, maxZ: 58 },
  { id: 'C02_C', minX: -179, maxX: -175, minZ: 38, maxZ: 58 },
  { id: 'C02_D', minX: -198, maxX: -170, minZ: 56, maxZ: 60 },
  { id: 'C02_E', minX: -190, maxX: -180, minZ: 29, maxZ: 33 },

  // Standing stones and low ruin walls.
  { id: 'STONE01', minX: 113.5, maxX: 116.5, minZ: -71, maxZ: -69 },
  { id: 'STONE02', minX: 121, maxX: 123, minZ: -65, maxZ: -63 },
  { id: 'STONE03', minX: 107, maxX: 109, minZ: -59, maxZ: -57 },
  { id: 'RUIN01', minX: -144, maxX: -116, minZ: 18.5, maxZ: 21.5 },
  { id: 'RUIN02', minX: 73, maxX: 97, minZ: 53.5, maxZ: 56.5 },
];

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
    this.ramManNpc = null;
    this.ramManNpcPatrolIndex = 0;
    this.ramManNpcMoveTarget = 1;
    this.ramManNpcPauseTimer = 0;
    this.ramManNpcAnimation = null;
    this.sheepDemonEnemy = null;
    this.blackGrassFactionManager = null;
    this.torchLights = [];
    this.lightTime = 0;
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
    } else {
      this.collision = this.area === 'field'
        ? new CollisionWorld({ walkableRects: [FIELD_WALKABLE_RECT], blockerRects: this.createOutdoorBlockers(), playerRadius: 0.5 })
        : new CollisionWorld({
          walkableRects: indoorWalkableRects,
          blockerRects: [this.gateBlocker, ...indoorWallBlockers],
        });
    }
  }


  getIndoorPlayerSpawn() {
    if (this.area === 'black-grass-temple') {
      return { spawnPosition: new THREE.Vector3(0, 1.55, -72), spawnYaw: 0 };
    }

    return { spawnPosition: new THREE.Vector3(0, 1.55, -30), spawnYaw: 0 };
  }

  configureBlackGrassTempleRuntime() {
    this.indoorExitTarget = new THREE.Vector3(0, 1.2, -76);
    this.gateTarget = new THREE.Vector3(30, 1.2, -20);
    this.blackGrassEnemyConfigs = this.createBlackGrassEnemyConfigs();
    this.blackGrassFactionSpawnAnchors = this.createBlackGrassFactionSpawnAnchors();
    this.inspectInteractions = [
      {
        id: 'BGT_INT03',
        target: new THREE.Vector3(0, 1.2, -32),
        range: 3.0,
        hint: 'Tap INTERACT to inspect the broken offering slab.',
        message: 'Old cups are carved into the altar stone. None are empty.',
      },
      {
        id: 'BGT_INT04',
        target: new THREE.Vector3(30, 1.2, -20),
        range: 3.0,
        hint: 'Tap INTERACT to test the first rusted gate.',
        message: 'The rusted gate holds, but its hinges remember movement.',
      },
      {
        id: 'BGT_INT06',
        target: new THREE.Vector3(0, 1.2, 82),
        range: 3.0,
        hint: 'Tap INTERACT to inspect the central reliquary.',
        message: 'The grass grows from inside the reliquary block.',
      },
      {
        id: 'BGT_INT07',
        target: new THREE.Vector3(0, 1.2, 94),
        range: 3.0,
        hint: 'Tap INTERACT to inspect the sealed future gate.',
        message: 'The gate is sealed with roots blacker than iron.',
      },
      {
        id: 'BGT_INT05',
        target: new THREE.Vector3(44, 1.2, -20),
        range: 3.5,
        hint: 'Tap INTERACT to mark the return stair.',
        message: 'A return stair opens behind the old wall.',
      },
    ];

    this.collision = new CollisionWorld({
      walkableRects: this.getBlackGrassWalkableRects(),
      blockerRects: this.getBlackGrassBlockers(),
      playerRadius: 0.5,
    });
  }

  getBlackGrassWalkableRects() {
    return [
      { id: 'R01', minX: -5, maxX: 5, minZ: -80, maxZ: -57 },
      { id: 'R02', minX: -12, maxX: 12, minZ: -58, maxZ: -42 },
      { id: 'R03', minX: -17, maxX: 17, minZ: -41, maxZ: -23 },
      { id: 'R04', minX: -44, maxX: -24, minZ: -31, maxZ: -9 },
      { id: 'R05', minX: 24, maxX: 44, minZ: -31, maxZ: -9 },
      { id: 'R06', minX: -25, maxX: 25, minZ: -13, maxZ: 13 },
      { id: 'R07', minX: -42, maxX: -26, minZ: -8, maxZ: 25 },
      { id: 'R08', minX: -31, maxX: 31, minZ: 13, maxZ: 43 },
      { id: 'R09', minX: -56, maxX: -32, minZ: 39, maxZ: 65 },
      { id: 'R10', minX: 32, maxX: 56, minZ: 39, maxZ: 65 },
      { id: 'R11', minX: -25, maxX: 25, minZ: 50, maxZ: 74 },
      { id: 'R12', minX: -27, maxX: 27, minZ: 74, maxZ: 90 },
      { id: 'R13', minX: -11, maxX: 11, minZ: 90, maxZ: 100 },
      { id: 'D03C', minX: -2.1, maxX: 2.1, minZ: -42, maxZ: -41 },
      { id: 'D04C', minX: -24, maxX: -17, minZ: -26, maxZ: -23 },
      { id: 'D05C', minX: 17, maxX: 24, minZ: -26, maxZ: -23 },
      { id: 'D12C', minX: -32, maxX: -31, minZ: 44, maxZ: 48 },
      { id: 'D13C', minX: 31, maxX: 32, minZ: 44, maxZ: 48 },
      { id: 'D14C', minX: -2.5, maxX: 2.5, minZ: 43, maxZ: 50 },
      { id: 'R14A', minX: 27, maxX: 66, minZ: 76, maxZ: 84 },
      { id: 'R14B', minX: 62, maxX: 72, minZ: -50, maxZ: 84 },
      { id: 'R14C', minX: 44, maxX: 66, minZ: -24, maxZ: -16 },
    ];
  }

  getBlackGrassBlockers() {
    return [
      { minX: -3.5, maxX: 3.5, minZ: -33.5, maxZ: -30.5 },
      { minX: -18, maxX: -6, minZ: -3, maxZ: -1 },
      { minX: 8, maxX: 18, minZ: 4, maxZ: 6 },
      { minX: -23, maxX: -13, minZ: 29, maxZ: 31 },
      { minX: 13, maxX: 23, minZ: 25, maxZ: 27 },
      { minX: -51, maxX: -39, minZ: 48, maxZ: 56 },
      { minX: 36, maxX: 52, minZ: 49, maxZ: 51 },
      { minX: -19, maxX: -17, minZ: 57, maxZ: 59 },
      { minX: -10, maxX: -8, minZ: 65, maxZ: 67 },
      { minX: 8, maxX: 10, minZ: 57, maxZ: 59 },
      { minX: 17, maxX: 19, minZ: 65, maxZ: 67 },
      { minX: -3, maxX: 3, minZ: 80.5, maxZ: 83.5 },
      { minX: -4, maxX: 4, minZ: 93.78, maxZ: 94.22 },
    ];
  }

  createBlackGrassEnemyConfigs() {
    const activeIds = new Set(['E01', 'E06', 'E12']);
    return [
      ['E01', 8, -31], ['E02', -39, -18], ['E03', -14, 2], ['E04', 16, 6],
      ['E05', -35, 12], ['E06', -20, 28], ['E07', 2, 33], ['E08', 22, 25],
      ['E09', -48, 54], ['E10', -10, 61], ['E11', 12, 66], ['E12', 0, 80],
    ].map(([id, x, z]) => ({
      id,
      markerPosition: new THREE.Vector3(x, 0, z),
      active: activeIds.has(id),
      config: {
        ...SHEEP_DEMON_CONFIG,
        id: `black-grass-temple-${id.toLowerCase()}-sheep-demon`,
        displayName: `Temple Sheep Demon ${id}`,
        placement: `Black Grass Temple spawn ${id}`,
        startPosition: new THREE.Vector3(x, 0, z),
        patrolPoints: Object.freeze([
          new THREE.Vector3(x - 2.2, 0, z - 2.2),
          new THREE.Vector3(x + 2.2, 0, z - 1.4),
          new THREE.Vector3(x + 1.8, 0, z + 2.2),
          new THREE.Vector3(x - 2.0, 0, z + 1.6),
        ]),
      },
    }));
  }


  createBlackGrassFactionSpawnAnchors() {
    const anchor = (id, preferredFaction, x, z, patrolSpread = 5.5) => {
      const origin = new THREE.Vector3(x, 0, z);
      return {
        id,
        preferredFaction,
        position: origin,
        patrolPoints: Object.freeze([
          new THREE.Vector3(x - patrolSpread, 0, z - patrolSpread * 0.45),
          new THREE.Vector3(x + patrolSpread * 0.7, 0, z - patrolSpread * 0.65),
          new THREE.Vector3(x + patrolSpread, 0, z + patrolSpread * 0.5),
          new THREE.Vector3(x - patrolSpread * 0.65, 0, z + patrolSpread * 0.72),
        ]),
      };
    };

    return Object.freeze([
      { ...anchor('sheep_initial_west_branch', 'sheep_demon', -30, -22, 3.8), initialWave: true },
      { ...anchor('neck_initial_east_branch', 'neck_man', 30, -22, 3.8), initialWave: true },
      anchor('sheep_spawn_a', 'sheep_demon', -39, -18, 4.5),
      anchor('sheep_spawn_b', 'sheep_demon', -48, 54, 5.0),
      anchor('neck_spawn_a', 'neck_man', 22, 25, 5.5),
      anchor('neck_spawn_b', 'neck_man', 44, 50, 4.8),
      anchor('neutral_spawn_a', 'neutral', -20, 28, 5.2),
      anchor('neutral_spawn_b', 'neutral', 12, 66, 4.8),
    ]);
  }

  getFieldPlayerSpawn() {
    if (this.fieldSpawn === 'cryptAExit') {
      return { spawnPosition: FIELD_CRYPT_A_RETURN_START, spawnYaw: FIELD_CRYPT_A_RETURN_YAW };
    }

    if (this.fieldSpawn === 'blackGrassTempleExit') {
      return { spawnPosition: FIELD_BLACK_GRASS_TEMPLE_RETURN_START, spawnYaw: FIELD_BLACK_GRASS_TEMPLE_RETURN_YAW };
    }

    return { spawnPosition: FIELD_PLAYER_START, spawnYaw: FIELD_PLAYER_YAW };
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

    this.addLights();
    this.addBabyLabyrinthInterior();
    this.addBabyLabyrinthStaging();
    this.addTorches();
    this.addRamManNpc();
    this.addSheepDemonEnemy();
  }

  buildOutdoorField() {
    this.scene.background = new THREE.Color(OUTDOOR_DAWN_SKY_COLOR);
    this.scene.fog = new THREE.Fog(OUTDOOR_DAWN_FOG_COLOR, 38, 215);
    this.addOutdoorLights();
    this.addOutdoorTerrain();
    this.addOutdoorBoundary();
    this.addReliquaryFieldStructures();
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

    this.lightTime += deltaSeconds;
    this.updateTorchFlicker();
    this.updateRamManNpcPatrol(deltaSeconds);
    this.updateBlackGrassFactionEnemies(deltaSeconds, player);
    this.updateSheepDemonEnemy(deltaSeconds, player);
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
    return RELIQUARY_FIELD_COLLIDERS.map(({ minX, maxX, minZ, maxZ }) => ({ minX, maxX, minZ, maxZ }));
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

  addOutdoorTerrain() {
    const grassMaterial = this.makeTexturedMaterial({
      path: TEXTURE_PATHS.fieldGrass,
      repeat: FIELD_GRASS_REPEAT,
      color: 0xb0aa91,
      roughness: 0.98,
      metalness: 0.0,
      emissive: 0x20232a,
      emissiveIntensity: 0.08,
    });
    const geometry = new THREE.PlaneGeometry(FIELD_SIZE, FIELD_SIZE);
    geometry.rotateX(-Math.PI / 2);

    const terrain = new THREE.Mesh(geometry, grassMaterial);
    terrain.name = 'TERRAIN01-reliquary-field-400x400-dead-grass-repeat-50x50';
    terrain.receiveShadow = true;
    terrain.userData = {
      blueprint: 'docs/world/overworld/reliquary_field_v01.md',
      implementedFieldSize: FIELD_SIZE,
      longTermBlueprintSize: 800,
      textureRepeat: FIELD_GRASS_REPEAT,
      collisionNote: 'Flat first-slice terrain plane; boundaries and landmark blockers define navigation.',
    };
    this.scene.add(terrain);
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

  addReliquaryFieldStructures() {
    this.addBrokenShrine();
    this.addSouthReliquaryCrypt();
    this.addBlackGrassTempleExterior();
    this.addSunkenCentralTomb();
    this.addStandingStoneCluster();
    this.addLowRuinWalls();
  }

  addBrokenShrine() {
    const shrineAwake = Boolean(this.gameState?.hasSouthReliquaryFragment);
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
    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [2.8, 1.8], color: 0x77746f, roughness: 0.97, metalness: 0.0, emissive: 0x0c0907, emissiveIntensity: 0.05 });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: [4, 3], color: 0x80796d, roughness: 0.96, metalness: 0.0 });
    const grassMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.fieldGrass, repeat: [7, 6], color: 0x252816, roughness: 1.0, metalness: 0.0, emissive: 0x030603, emissiveIntensity: 0.08 });
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x020202 });
    const group = new THREE.Group();
    group.name = 'C02-Black-Grass-Temple-temporary-west-edge-exterior';

    group.add(this.createBoxMesh({ size: new THREE.Vector3(45, 0.08, 38), position: new THREE.Vector3(-184, 0.04, 45), material: grassMat, name: 'C02_G-flat-black-grass-corruption-field_dead_grass_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(28, 0.5, 30), position: new THREE.Vector3(-184, 0.25, 45), material: floorMat, name: 'C02_A-temple-approach-slab-floor_worn_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4, 8, 5), position: new THREE.Vector3(-196, 4, 48), material: stoneMat, name: 'C02_B-left-broken-pylon-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(4, 6.4, 5), position: new THREE.Vector3(-176, 3.2, 48), material: stoneMat, name: 'C02_C-right-broken-pylon-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(28, 8, 4), position: new THREE.Vector3(-184, 4, 58), material: stoneMat, name: 'C02_D-rear-temple-wall-wall_black_stone_01' }));
    group.add(this.createBoxMesh({ size: new THREE.Vector3(10, 4.4, 0.3), position: new THREE.Vector3(-184, 2.2, 32), material: voidMat, name: 'C02_F-dark-stair-mouth-visual' }));

    this.enableOutdoorReadableShadows(group);
    this.scene.add(group);
    this.outdoorInteractions.push({
      id: 'BGT_INT01',
      label: 'Black Grass Temple',
      target: new THREE.Vector3(-184, 1, 31),
      range: 4.5,
      hint: 'Tap INTERACT to descend into Black Grass Temple.',
      message: 'The black grass bends away from the temple stair.',
      functional: true,
      area: 'black-grass-temple',
      type: 'areaEntrance',
    });
  }

  buildBlackGrassTempleInterior() {
    this.scene.background = new THREE.Color(0x100f0d);
    this.scene.fog = new THREE.Fog(0x242018, 12, 58);
    this.addBlackGrassTempleLights();
    this.addBlackGrassTempleRooms();
    this.addBlackGrassTempleProps();
    this.addBlackGrassTempleSpawnMarkers();
    this.addBlackGrassTempleEnemies();
  }

  addBlackGrassTempleLights() {
    this.scene.add(new THREE.HemisphereLight(0x80786b, 0x211b16, 1.05));
    const fill = new THREE.DirectionalLight(0xd0b18a, 0.35);
    fill.position.set(8, 6, -10);
    this.scene.add(fill);
    [
      [0, 2.0, -61], [-8, 2.0, -50], [8, 2.0, -50], [0, 2.1, -34], [27, 2.1, -20],
      [-18, 2.0, 0], [18, 2.0, 0], [-25, 2.0, 28], [25, 2.0, 28], [-15, 2.1, 62], [15, 2.1, 62],
    ].forEach(([x, y, z]) => this.addTorch(new THREE.Vector3(x, y - 0.45, z), x < 0 ? Math.PI / 2 : -Math.PI / 2));
    const sanctum = new THREE.PointLight(0x9fb7c8, 1.25, 18, 1.2);
    sanctum.name = 'T12-black-grass-sanctum-cold-dim-center-fill';
    sanctum.position.set(0, 1.6, 82);
    this.scene.add(sanctum);
  }

  getBlackGrassRoomSpecs() {
    return [
      { id: 'R01', minX: -5, maxX: 5, minZ: -80, maxZ: -58, floor: 'stone', repeat: [2, 5] },
      { id: 'R02', minX: -12, maxX: 12, minZ: -58, maxZ: -42, floor: 'stone', repeat: [4, 3] },
      { id: 'R03', minX: -17, maxX: 17, minZ: -41, maxZ: -23, floor: 'stone', repeat: [5, 3] },
      { id: 'R04', minX: -44, maxX: -24, minZ: -31, maxZ: -9, floor: 'stone', repeat: [3, 4] },
      { id: 'R05', minX: 24, maxX: 44, minZ: -31, maxZ: -9, floor: 'stone', repeat: [3, 4] },
      { id: 'R06', minX: -25, maxX: 25, minZ: -13, maxZ: 13, floor: 'grass', repeat: [8, 5] },
      { id: 'R07', minX: -42, maxX: -26, minZ: -8, maxZ: 25, floor: 'stone', repeat: [3, 6] },
      { id: 'R08', minX: -31, maxX: 31, minZ: 13, maxZ: 43, floor: 'grass', repeat: [9, 5] },
      { id: 'R09', minX: -56, maxX: -32, minZ: 39, maxZ: 65, floor: 'mixed', repeat: [4, 4] },
      { id: 'R10', minX: 32, maxX: 56, minZ: 39, maxZ: 65, floor: 'mixed', repeat: [4, 4] },
      { id: 'R11', minX: -25, maxX: 25, minZ: 50, maxZ: 74, floor: 'stone', repeat: [7, 4] },
      { id: 'R12', minX: -27, maxX: 27, minZ: 74, maxZ: 90, floor: 'grass', repeat: [8, 3] },
      { id: 'R13', minX: -11, maxX: 11, minZ: 90, maxZ: 100, floor: 'stone', repeat: [3, 2] },
      { id: 'D03C', minX: -2.1, maxX: 2.1, minZ: -42, maxZ: -41, floor: 'stone', repeat: [1, 1] },
      { id: 'D04C', minX: -24, maxX: -17, minZ: -26, maxZ: -23, floor: 'stone', repeat: [1.4, 1] },
      { id: 'D05C', minX: 17, maxX: 24, minZ: -26, maxZ: -23, floor: 'stone', repeat: [1.4, 1] },
      { id: 'D12C', minX: -32, maxX: -31, minZ: 44, maxZ: 48, floor: 'stone', repeat: [1, 1] },
      { id: 'D13C', minX: 31, maxX: 32, minZ: 44, maxZ: 48, floor: 'stone', repeat: [1, 1] },
      { id: 'D14C', minX: -2.5, maxX: 2.5, minZ: 43, maxZ: 50, floor: 'stone', repeat: [1, 1.4] },
      { id: 'R14A', minX: 27, maxX: 62, minZ: 76, maxZ: 84, floor: 'stone', repeat: [7, 1.5] },
      { id: 'R14B', minX: 62, maxX: 72, minZ: -50, maxZ: 84, floor: 'stone', repeat: [2, 14] },
      { id: 'R14C', minX: 44, maxX: 62, minZ: -24, maxZ: -16, floor: 'stone', repeat: [4, 1.5] },
    ];
  }

  addBlackGrassTempleRooms() {
    const wallMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [5, 1.4], color: 0x8c877b, roughness: 0.96, metalness: 0.0, emissive: 0x18120e, emissiveIntensity: 0.14 });
    const ceilingMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.ceiling, repeat: [5, 5], color: 0x807a72, roughness: 0.98, metalness: 0.0, emissive: 0x151312, emissiveIntensity: 0.12 });
    this.getBlackGrassRoomSpecs().forEach((room) => {
      const width = room.maxX - room.minX;
      const depth = room.maxZ - room.minZ;
      const center = new THREE.Vector3((room.minX + room.maxX) / 2, 0, (room.minZ + room.maxZ) / 2);
      const floorPath = room.floor === 'grass' ? TEXTURE_PATHS.fieldGrass : TEXTURE_PATHS.floor;
      const floorColor = room.floor === 'grass' ? 0x242716 : room.floor === 'mixed' ? 0x4c4f32 : 0x9c9282;
      const floorMat = this.makeTexturedMaterial({ path: floorPath, repeat: room.repeat, color: floorColor, roughness: 0.98, metalness: 0.0, emissive: room.floor === 'grass' ? 0x030703 : 0x1c140d, emissiveIntensity: room.floor === 'grass' ? 0.12 : 0.16 });
      this.addBox({ size: new THREE.Vector3(width, 0.18, depth), position: new THREE.Vector3(center.x, FLOOR_Y - 0.09, center.z), material: floorMat, name: `BGT-${room.id}-clean-floor-${room.floor}` });
      this.addBox({ size: new THREE.Vector3(width, 0.18, depth), position: new THREE.Vector3(center.x, WALL_HEIGHT, center.z), material: ceilingMat, name: `BGT-${room.id}-clean-ceiling-ceiling_dark_stone_01` });
      this.addRoomWallsWithDoorGaps(room, wallMat);
    });
  }

  addRoomWallsWithDoorGaps(room, material) {
    const t = 0.35;
    const doors = [
      { x: 0, z: -78, w: 4.0 }, { x: 0, z: -59, w: 4.0 }, { x: 0, z: -41, w: 4.2 },
      { x: -17, z: -24, w: 3.6 }, { x: -24, z: -24, w: 3.6 }, { x: 17, z: -24, w: 3.6 }, { x: 24, z: -24, w: 3.6 }, { x: 0, z: -13, w: 4.6 },
      { x: -34, z: -8, w: 3.6 }, { x: 22, z: -4, w: 4.0 }, { x: -25, z: 4, w: 3.6 },
      { x: 0, z: 14, w: 5.0 }, { x: -25, z: 22, w: 3.6 }, { x: -31, z: 46, w: 4.0 },
      { x: 31, z: 46, w: 4.0 }, { x: 0, z: 43, w: 5.0 }, { x: 0, z: 50, w: 5.0 }, { x: 0, z: 74, w: 5.0 },
      { x: 0, z: 90, w: 4.0 }, { x: 27, z: 80, w: 3.6 }, { x: 44, z: -20, w: 3.6 },
    ];
    const addHorizontal = (z, side) => {
      const gaps = doors.filter((d) => Math.abs(d.z - z) < 1.05 && d.x >= room.minX - 0.1 && d.x <= room.maxX + 0.1);
      let cursor = room.minX;
      gaps.sort((a, b) => a.x - b.x).forEach((gap) => {
        const start = Math.max(room.minX, gap.x - gap.w / 2);
        const end = Math.min(room.maxX, gap.x + gap.w / 2);
        if (start - cursor > 0.2) this.addBox({ size: new THREE.Vector3(start - cursor, WALL_HEIGHT, t), position: new THREE.Vector3((cursor + start) / 2, WALL_HEIGHT / 2, z + side * t / 2), material, name: `BGT-${room.id}-wall-z-${z}` });
        cursor = end;
      });
      if (room.maxX - cursor > 0.2) this.addBox({ size: new THREE.Vector3(room.maxX - cursor, WALL_HEIGHT, t), position: new THREE.Vector3((cursor + room.maxX) / 2, WALL_HEIGHT / 2, z + side * t / 2), material, name: `BGT-${room.id}-wall-z-${z}` });
    };
    const addVertical = (x, side) => {
      const gaps = doors.filter((d) => Math.abs(d.x - x) < 1.05 && d.z >= room.minZ - 0.1 && d.z <= room.maxZ + 0.1);
      let cursor = room.minZ;
      gaps.sort((a, b) => a.z - b.z).forEach((gap) => {
        const start = Math.max(room.minZ, gap.z - gap.w / 2);
        const end = Math.min(room.maxZ, gap.z + gap.w / 2);
        if (start - cursor > 0.2) this.addBox({ size: new THREE.Vector3(t, WALL_HEIGHT, start - cursor), position: new THREE.Vector3(x + side * t / 2, WALL_HEIGHT / 2, (cursor + start) / 2), material, name: `BGT-${room.id}-wall-x-${x}` });
        cursor = end;
      });
      if (room.maxZ - cursor > 0.2) this.addBox({ size: new THREE.Vector3(t, WALL_HEIGHT, room.maxZ - cursor), position: new THREE.Vector3(x + side * t / 2, WALL_HEIGHT / 2, (cursor + room.maxZ) / 2), material, name: `BGT-${room.id}-wall-x-${x}` });
    };
    addHorizontal(room.minZ, -1);
    addHorizontal(room.maxZ, 1);
    addVertical(room.minX, -1);
    addVertical(room.maxX, 1);
  }

  addBlackGrassTempleProps() {
    const stone = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [2, 1], color: 0x7f7768, roughness: 0.97, metalness: 0.0, emissive: 0x120d0a, emissiveIntensity: 0.12 });
    const gate = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: [1, 2], color: 0xa28b73, roughness: 0.78, metalness: 0.4, emissive: 0x21130b, emissiveIntensity: 0.24 });
    const prop = (name, x, y, z, w, h, d, mat = stone) => this.addBox({ size: new THREE.Vector3(w, h, d), position: new THREE.Vector3(x, y, z), material: mat, name });
    prop('BGT-P01-broken-offering-slab', 0, 0.55, -32, 7, 1.1, 3);
    prop('BGT-P02-broken-counter-west', -12, 0.6, -2, 12, 1.2, 2);
    prop('BGT-P03-broken-counter-east', 13, 0.6, 5, 10, 1.2, 2);
    prop('BGT-P04-low-divider-A', -18, 0.55, 30, 10, 1.1, 2);
    prop('BGT-P05-low-divider-B', 18, 0.55, 26, 10, 1.1, 2);
    prop('BGT-P06-booth-divider-cluster', -45, 0.55, 52, 12, 1.1, 8);
    prop('BGT-P07-back-bar-block', 44, 0.7, 50, 16, 1.4, 2);
    [[-18,58],[-9,66],[9,58],[18,66]].forEach(([x,z], i) => prop(`BGT-P0${8+i}-square-pillar`, x, 1.6, z, 2, 3.2, 2));
    this.reliquaryBlock = prop('BGT-P14-central-reliquary-block', 0, 0.8, 82, 6, 1.6, 3);
    prop('BGT-P15-sealed-future-gate', 0, 1.6, 94, 8, 3.2, 0.45, gate);
    prop('BGT-G01-first-gate-inspect-rusted-metal', 30, 1.6, -20, 0.45, 3.2, 8, gate);
  }

  addBlackGrassTempleSpawnMarkers() {
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x6f1616, transparent: true, opacity: 0.52 });
    this.blackGrassEnemyConfigs.forEach(({ id, markerPosition, active }) => {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.65), markerMat);
      marker.name = `BGT-${id}-${active ? 'active' : 'inactive'}-enemy-spawn-marker`;
      marker.position.set(markerPosition.x, 0.05, markerPosition.z);
      marker.userData = { spawnId: id, active };
      this.scene.add(marker);
    });

    const factionMarkerMat = new THREE.MeshBasicMaterial({ color: 0x2c6f9f, transparent: true, opacity: 0.42 });
    this.blackGrassFactionSpawnAnchors.forEach((anchor) => {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.85), factionMarkerMat);
      marker.name = `BGT-${anchor.id}-${anchor.preferredFaction}-faction-spawn-anchor`;
      marker.position.set(anchor.position.x, 0.09, anchor.position.z);
      marker.userData = { spawnId: anchor.id, preferredFaction: anchor.preferredFaction, factionWarAnchor: true };
      this.scene.add(marker);
    });
  }

  addBlackGrassTempleEnemies() {
    this.blackGrassFactionManager = new BlackGrassTempleFactionManager({
      scene: this.scene,
      collision: this.collision,
      anchors: this.blackGrassFactionSpawnAnchors,
    });
    this.blackGrassFactionManager.spawnInitialWave();
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
    return texture;
  }

  makeTexturedMaterial({ path, repeat, color = 0xffffff, roughness = 0.92, metalness = 0.02, emissive, emissiveIntensity } = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      map: this.loadRepeatingTexture(path, repeat),
      roughness,
      metalness,
      ...(emissive !== undefined ? { emissive, emissiveIntensity } : {}),
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
    this.torchLights.push({
      light: glow,
      flame,
      baseIntensity: glow.intensity,
      baseDistance: glow.distance,
      phase: this.torchLights.length * 1.93,
    });

    this.scene.add(group);
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


  updateTorchFlicker() {
    this.torchLights.forEach(({ light, flame, baseIntensity, baseDistance, phase }) => {
      const slowPulse = Math.sin(this.lightTime * 7.5 + phase) * 0.11;
      const fastPulse = Math.sin(this.lightTime * 18.0 + phase * 2.7) * 0.055;
      const emberPulse = Math.sin(this.lightTime * 31.0 + phase * 0.6) * 0.025;
      const flicker = THREE.MathUtils.clamp(1 + slowPulse + fastPulse + emberPulse, 0.78, 1.18);

      light.intensity = baseIntensity * flicker;
      light.distance = baseDistance * THREE.MathUtils.clamp(0.96 + (flicker - 1) * 0.35, 0.9, 1.05);
      flame.scale.setScalar(THREE.MathUtils.clamp(0.94 + (flicker - 1) * 0.28, 0.9, 1.05));
    });
  }


  updateRamManNpcPatrol(deltaSeconds) {
    this.ramManNpcAnimation?.mixers.forEach((mixer) => mixer.update(deltaSeconds));

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

    const nextTrack = animation.tracks[state];
    const previousTrack = animation.tracks[animation.state];
    if (!nextTrack) return;

    Object.entries(animation.tracks).forEach(([trackState, track]) => {
      track.root.visible = trackState === state;
    });

    nextTrack.action?.reset().fadeIn(0.16).play();
    if (previousTrack?.action && previousTrack !== nextTrack) {
      previousTrack.action.fadeOut(0.16);
    }

    animation.state = state;
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
    Promise.all([
      loadDungeonModel({ url: RAM_MAN_NPC_IDLE_URL, targetHeight: 1.72, maxWidth: 1.15 }),
      loadDungeonModel({ url: RAM_MAN_NPC_WALK_URL, targetHeight: 1.72, maxWidth: 1.15 }),
    ])
      .then(([idleModel, walkModel]) => {
        idleModel.root.name = 'ram-man-friendly-idle-01-model';
        walkModel.root.name = 'ram-man-friendly-walk-01-model';
        walkModel.root.visible = false;

        const idleTrack = this.createRamManNpcAnimationTrack({ state: 'idle', ...idleModel });
        const walkTrack = this.createRamManNpcAnimationTrack({ state: 'walk', ...walkModel });

        const patrolRig = new THREE.Group();
        patrolRig.name = 'ram-man-friendly-01';
        patrolRig.position.copy(RAM_MAN_NPC_POSITION);
        patrolRig.userData = {
          assetUrls: {
            idle: RAM_MAN_NPC_IDLE_URL,
            walk: RAM_MAN_NPC_WALK_URL,
          },
          animationClips: {
            idle: idleTrack.clipNames,
            walk: walkTrack.clipNames,
          },
          animationClipDetails: {
            idle: idleTrack.clipSummaries,
            walk: walkTrack.clipSummaries,
          },
          normalizedScale: {
            idle: idleModel.scale,
            walk: walkModel.scale,
          },
          friendly: true,
          collision: 'none - visual roaming NPC only',
          combat: 'none - not registered as an enemy or target',
          placement: 'R05 guardian chamber around X 0, Z 14, clear of the reliquary route',
          patrolSpeed: RAM_MAN_NPC_PATROL_SPEED,
          patrolPauseSeconds: RAM_MAN_NPC_PATROL_PAUSE_SECONDS,
          patrolPoints: RAM_MAN_NPC_PATROL_POINTS.map((point) => ({ x: point.x, y: point.y, z: point.z })),
        };
        patrolRig.add(idleModel.root, walkModel.root);

        this.ramManNpc = patrolRig;
        this.ramManNpcAnimation = {
          state: null,
          mixers: [idleTrack.mixer, walkTrack.mixer],
          tracks: {
            idle: idleTrack,
            walk: walkTrack,
          },
        };
        this.setRamManNpcAnimation('idle');
        this.scene.add(patrolRig);

        console.info('Friendly Ram Man animation clips detected:', patrolRig.userData.animationClipDetails);
      })
      .catch((error) => {
        this.ramManNpcAnimation = null;
        console.warn(
          `Friendly Ram Man animated GLBs failed to load from ${RAM_MAN_NPC_IDLE_URL} or ${RAM_MAN_NPC_WALK_URL}. The dungeon remains playable.`,
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
    if (this.area !== 'black-grass-temple' || !this.blackGrassFactionManager || !player?.position) return;
    this.blackGrassFactionManager.update(deltaSeconds, player.position);
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
    if (this.area === 'black-grass-temple') {
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
    if (this.area === 'black-grass-temple') {
      return this.blackGrassFactionManager?.damageEnemyFromPlayerAttack(attack) ?? null;
    }

    if (this.sheepDemonEnemies?.length) {
      for (const enemy of this.sheepDemonEnemies) {
        const hit = enemy.receivePlayerAttack(attack);
        if (hit) return hit;
      }
      return null;
    }

    return this.sheepDemonEnemy?.receivePlayerAttack(attack) ?? null;
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
