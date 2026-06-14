import * as THREE from 'three';
import { compileDungeonLocation } from '../engine/dungeon-authoring/DungeonCompiler.js';
import { DungeonDebugRenderer } from '../engine/dungeon-authoring/DungeonDebugRenderer.js';
import { registerDungeonRuntime } from '../engine/dungeon-authoring/DungeonRuntimeRegistry.js';
import { createCreatureActor } from '../engine/creatures/CreatureActorFactory.js';
import { GoreRuntime } from '../engine/gore/GoreRuntime.js';
import { TorchFlickerController } from '../engine/lighting/TorchFlickerController.js';
import { CollisionWorld } from './Collision.js';
import { loadDungeonModel } from './ModelLoader.js';
import { BlackGrassTempleFactionManager } from './BlackGrassTempleFactions.js';
import { SheepDemonEnemy } from './SheepDemonEnemy.js';
import { createGameGoreRegistry } from './gore/goreRegistry.js';
import { getLocationDefinition } from './locations/locationRegistry.js';
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

const FIELD_SIZE = 400;
const FIELD_GRASS_REPEAT = [50, 50];
const OUTDOOR_DAWN_SKY_COLOR = 0x64727d;
const OUTDOOR_DAWN_FOG_COLOR = 0x717a80;
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
        ? new CollisionWorld({ walkableRects: [FIELD_WALKABLE_RECT], blockerRects: this.createOutdoorBlockers(), playerRadius: 0.5 })
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
      return this.makeTexturedMaterial({
        path: profile.path,
        repeat: profile.repeat ?? [1, 1],
        color: profile.color ?? 0xffffff,
        roughness: profile.roughness ?? 0.9,
        metalness: profile.metalness ?? 0,
        emissive: profile.emissive ?? 0x000000,
        emissiveIntensity: profile.emissiveIntensity ?? 0,
      });
    }

    return new THREE.MeshStandardMaterial({
      color: profile.color ?? 0xffffff,
      roughness: profile.roughness ?? 0.9,
      metalness: profile.metalness ?? 0,
      emissive: profile.emissive ?? 0x000000,
      emissiveIntensity: profile.emissiveIntensity ?? 0,
    });
  }

  getFieldPlayerSpawn() {
    if (this.fieldSpawn === 'cryptAExit') {
      return { spawnPosition: FIELD_CRYPT_A_RETURN_START, spawnYaw: FIELD_CRYPT_A_RETURN_YAW };
    }

    if (this.fieldSpawn === 'blackGrassTempleExit') {
      return { spawnPosition: FIELD_BLACK_GRASS_TEMPLE_RETURN_START, spawnYaw: FIELD_BLACK_GRASS_TEMPLE_RETURN_YAW };
    }

    if (this.fieldSpawn === 'fieldKeeperHouseExit') {
      return { spawnPosition: FIELD_KEEPER_HOUSE_RETURN_START, spawnYaw: FIELD_KEEPER_HOUSE_RETURN_YAW };
    }

    if (this.fieldSpawn === 'ddplusLevel1Exit') {
      return { spawnPosition: FIELD_DDPLUS_LEVEL1_RETURN_START, spawnYaw: FIELD_DDPLUS_LEVEL1_RETURN_YAW };
    }

    if (this.fieldSpawn === 'sumerianCityBlockV0Exit') {
      return { spawnPosition: FIELD_SUMERIAN_CITY_BLOCK_V0_RETURN_START, spawnYaw: FIELD_SUMERIAN_CITY_BLOCK_V0_RETURN_YAW };
    }

    if (this.fieldSpawn === 'sumerianSunPalaceDistrictV1Exit') {
      return { spawnPosition: FIELD_SUMERIAN_SUN_PALACE_DISTRICT_V1_RETURN_START, spawnYaw: FIELD_SUMERIAN_SUN_PALACE_DISTRICT_V1_RETURN_YAW };
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
    this.scene.background = new THREE.Color(OUTDOOR_DAWN_SKY_COLOR);
    this.scene.fog = new THREE.Fog(OUTDOOR_DAWN_FOG_COLOR, 38, 215);
    this.addOutdoorLights();
    this.addOutdoorTerrain();
    this.addOutdoorBoundary();
    this.addReliquaryFieldStructures();
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
    this.goreRuntime.update(deltaSeconds, { playerPosition: player?.position });
    this.dungeonDebugRenderer?.update(player?.position);
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
    return getReliquaryFieldColliders()
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
    this.addFieldKeeperHouseExterior();
    this.addDdplusLevel1TestEntrance();
    this.addSumerianCityBlockV0TestEntrance();
    this.addSumerianSunPalaceDistrictV1TestEntrance();
    this.addSunkenCentralTomb();
    this.addStandingStoneCluster();
    this.addLowRuinWalls();
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
    this.torchFlickerController.registerFromObject(runtime.group);
    this.dungeonDebugRenderer = new DungeonDebugRenderer({ scene: this.scene, runtime });
    this.addCompiledLocationEnemies(runtime);
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
    const patrolPoints = (spawn.patrolPoints?.length ? spawn.patrolPoints : this.createFallbackPatrolPoints(safePosition))
      .map((point) => this.findSafeCompiledEnemySpawnPosition({ ...spawn, id: `${spawn.id}:patrol`, position: point }, runtime) ?? safePosition.clone());
    return {
      id: spawn.id,
      preferredFaction: spawn.faction ?? spawn.preferredFaction ?? spawn.species,
      faction: spawn.faction,
      species: spawn.species,
      position: safePosition,
      yaw: spawn.yaw,
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
    position.y = 0;
    if (this.collision?.canStandAt(position)) return position;
    const room = runtime.navGraph?.rooms?.[spawn.roomId] ?? this.findCompiledRoomForPoint(position, runtime);
    const candidates = [];
    if (room) {
      const clamped = position.clone();
      clamped.x = THREE.MathUtils.clamp(clamped.x, room.minX + 0.9, room.maxX - 0.9);
      clamped.z = THREE.MathUtils.clamp(clamped.z, room.minZ + 0.9, room.maxZ - 0.9);
      candidates.push(clamped, room.center?.clone?.());
    }
    candidates.push(...this.createFallbackPatrolPoints(position, 1.5));
    return candidates.find((candidate) => candidate && this.collision?.canStandAt(candidate))?.clone() ?? null;
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
