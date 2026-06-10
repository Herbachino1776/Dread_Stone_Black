const defaultFloorY = 0;
const defaultCeilingY = 3.2;

const textureProfiles = Object.freeze({
  wall: { path: './assets/textures/wall_black_stone_01.png', repeat: [5, 1.4], color: 0x8c877b, roughness: 0.96, metalness: 0.0, emissive: 0x18120e, emissiveIntensity: 0.14 },
  floor: { path: './assets/textures/floor_worn_stone_01.png', repeat: [4, 4], color: 0x9c9282, roughness: 0.98, metalness: 0.0, emissive: 0x1c140d, emissiveIntensity: 0.16 },
  grassFloor: { path: './assets/textures/outdoor/field_dead_grass_01.png', repeat: [8, 5], color: 0x242716, roughness: 0.98, metalness: 0.0, emissive: 0x030703, emissiveIntensity: 0.12 },
  mixedFloor: { path: './assets/textures/floor_worn_stone_01.png', repeat: [4, 4], color: 0x4c4f32, roughness: 0.98, metalness: 0.0, emissive: 0x1c140d, emissiveIntensity: 0.16 },
  ceiling: { path: './assets/textures/ceiling_dark_stone_01.png', repeat: [5, 5], color: 0x807a72, roughness: 0.98, metalness: 0.0, emissive: 0x151312, emissiveIntensity: 0.12 },
  gate: { path: './assets/textures/metal_gate_rusted_01.png', repeat: [1, 2], color: 0xa28b73, roughness: 0.78, metalness: 0.4, emissive: 0x21130b, emissiveIntensity: 0.24 },
  propStone: { path: './assets/textures/wall_black_stone_01.png', repeat: [2, 1], color: 0x7f7768, roughness: 0.97, metalness: 0.0, emissive: 0x120d0a, emissiveIntensity: 0.12 },
});

function room({ id, label, minX, maxX, minZ, maxZ, floorTexture = 'floor', repeat, tags = [], encounterWeight = 1, safeForSpawn = true, userData = {}, wallGeometry = true }) {
  return {
    id,
    label,
    minX,
    maxX,
    minZ,
    maxZ,
    floorY: defaultFloorY,
    ceilingY: defaultCeilingY,
    floorTexture: { texture: floorTexture, repeat },
    wallTexture: 'wall',
    ceilingTexture: 'ceiling',
    tags,
    encounterWeight,
    safeForSpawn,
    wallGeometry,
    userData,
  };
}

function wallGap(roomId, x, z, width) {
  return { roomId, position: { x, y: 0, z }, width };
}

function connector(id, fromRoom, toRoom, x, z, width, wallGaps) {
  return {
    id,
    fromRoom,
    toRoom,
    position: { x, y: 0, z },
    width,
    navWaypoint: { x, y: 0, z },
    wallGaps,
    tags: ['doorway'],
  };
}

function patrolPoints(x, z, patrolSpread) {
  return [
    { x: x - patrolSpread, y: 0, z: z - patrolSpread * 0.45 },
    { x: x + patrolSpread * 0.7, y: 0, z: z - patrolSpread * 0.65 },
    { x: x + patrolSpread, y: 0, z: z + patrolSpread * 0.5 },
    { x: x - patrolSpread * 0.65, y: 0, z: z + patrolSpread * 0.72 },
  ];
}

function factionSpawn(id, faction, x, z, roomId, patrolSpread = 5.5, allowedForInitialWave = false) {
  return {
    id,
    kind: 'enemy',
    species: faction,
    faction,
    position: { x, y: 0, z },
    yaw: 0,
    roomId,
    minDistanceFromPlayer: 10,
    allowedForInitialWave,
    allowedForRespawn: true,
    tags: ['faction-war-anchor'],
    userData: {
      preferredFaction: faction,
      patrolPoints: patrolPoints(x, z, patrolSpread),
    },
  };
}

function debugEnemySpawn(id, x, z, roomId, active = false) {
  return {
    id,
    kind: 'debug',
    species: 'sheep_demon',
    faction: 'sheep_demon',
    position: { x, y: 0, z },
    yaw: 0,
    roomId,
    allowedForInitialWave: false,
    allowedForRespawn: false,
    tags: ['legacy-marker', active ? 'active-marker' : 'inactive-marker'],
    userData: { activeMarker: active },
  };
}

function blocker(id, type, minX, maxX, minZ, maxZ, height = 1.2) {
  return {
    id,
    type,
    minX,
    maxX,
    minZ,
    maxZ,
    height,
    blocksPlayer: true,
    blocksEnemies: true,
    blocksLineOfMovement: true,
    tags: ['solid'],
  };
}

function prop(id, kind, roomId, x, y, z, width, height, depth, collisionRef, material = 'propStone') {
  return {
    id,
    kind,
    roomId,
    position: { x, y, z },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    dimensions: { width, height, depth },
    collisionRef,
    material,
    tags: ['compiled-prop'],
  };
}

function torchFixture(id, roomId, wallSide, distanceAlongWall, profile = 'dungeonTorch', options = {}) {
  return {
    id,
    kind: 'torch',
    roomId,
    wallSide,
    distanceAlongWall,
    height: options.height ?? 1.72,
    insetFromCorner: options.insetFromCorner ?? 1.35,
    offsetFromWall: options.offsetFromWall ?? 0.16,
    profile,
    visualKind: options.visualKind ?? 'procedural-sconce',
    flameKind: options.flameKind ?? 'procedural-warm-flame',
    debug: {
      note: options.note ?? 'Black Grass Temple wall-mounted torch fixture',
    },
  };
}

export const blackGrassTempleDefinition = Object.freeze({
  id: 'black-grass-temple',
  displayName: 'Black Grass Temple',
  type: 'temple',
  objectivePackId: 'black-grass-temple-foundation',
  tags: ['interior', 'dungeon', 'faction-war', 'compiled-runtime'],
  notes: 'Migrated from the hand-built Black Grass Temple scene. Keep this definition as the source of truth for BGT rooms, collision, spawns, nav, lights, exits, and encounter zones.',
  fog: { color: 0x242018, near: 12, far: 58 },
  lighting: { background: 0x100f0d },
  textures: textureProfiles,
  defaultFloorY,
  defaultCeilingY,
  collision: { playerRadius: 0.5 },
  geometry: { wallThickness: 0.35, floorThickness: 0.18, ceilingThickness: 0.18 },

  rooms: [
    room({ id: 'R01', label: 'Entry Stair Hall', minX: -5, maxX: 5, minZ: -80, maxZ: -57, repeat: [2, 5], encounterWeight: 0.2 }),
    room({ id: 'R02', label: 'Torch Vestibule', minX: -12, maxX: 12, minZ: -58, maxZ: -42, repeat: [4, 3], encounterWeight: 0.8 }),
    room({ id: 'R03', label: 'Broken Offering Room', minX: -17, maxX: 17, minZ: -41, maxZ: -23, repeat: [5, 3], encounterWeight: 1.2 }),
    room({ id: 'R04', label: 'West Storage Ruin', minX: -44, maxX: -24, minZ: -31, maxZ: -9, repeat: [3, 4], encounterWeight: 1.1 }),
    room({ id: 'R05', label: 'First Gate Hall', minX: 24, maxX: 44, minZ: -31, maxZ: -9, repeat: [3, 4], encounterWeight: 1.1 }),
    room({ id: 'R06', label: 'First Grass Tavern', minX: -25, maxX: 25, minZ: -13, maxZ: 13, floorTexture: 'grassFloor', repeat: [8, 5], encounterWeight: 1.4 }),
    room({ id: 'R07', label: 'Service Passage Loop', minX: -42, maxX: -26, minZ: -8, maxZ: 25, repeat: [3, 6], encounterWeight: 1.1 }),
    room({ id: 'R08', label: 'Sunken Drinking Hall', minX: -31, maxX: 31, minZ: 13, maxZ: 43, floorTexture: 'grassFloor', repeat: [9, 5], encounterWeight: 1.6 }),
    room({ id: 'R09', label: 'Collapsed Booth Chamber', minX: -56, maxX: -32, minZ: 39, maxZ: 65, floorTexture: 'mixedFloor', repeat: [4, 4], encounterWeight: 1.0 }),
    room({ id: 'R10', label: 'Back Bar Storage Pit', minX: 32, maxX: 56, minZ: 39, maxZ: 65, floorTexture: 'mixedFloor', repeat: [4, 4], encounterWeight: 1.0 }),
    room({ id: 'R11', label: 'Lower Pillar Hall', minX: -25, maxX: 25, minZ: 50, maxZ: 74, repeat: [7, 4], encounterWeight: 1.3, userData: { navCenter: { x: 0, y: 0, z: 62 } } }),
    room({ id: 'R12', label: 'Black Grass Sanctum', minX: -27, maxX: 27, minZ: 74, maxZ: 90, floorTexture: 'grassFloor', repeat: [8, 3], encounterWeight: 1.5, userData: { navCenter: { x: 10, y: 0, z: 84 } } }),
    room({ id: 'R13', label: 'Reliquary Gate', minX: -11, maxX: 11, minZ: 90, maxZ: 100, repeat: [3, 2], encounterWeight: 0.2, safeForSpawn: false }),
    room({ id: 'D03C', label: 'R02/R03 Connector', minX: -2.1, maxX: 2.1, minZ: -42, maxZ: -41, repeat: [1, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D04C', label: 'West Branch Connector', minX: -24, maxX: -17, minZ: -26, maxZ: -23, repeat: [1.4, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D05C', label: 'East Branch Connector', minX: 17, maxX: 24, minZ: -26, maxZ: -23, repeat: [1.4, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D06C', label: 'West Storage Loop Connector', minX: -36, maxX: -32, minZ: -9, maxZ: -8, repeat: [1, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D07C', label: 'Service/Tavern Connector', minX: -26, maxX: -25, minZ: 2, maxZ: 6, repeat: [1, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D12C', label: 'West Drinking Hall Connector', minX: -32, maxX: -31, minZ: 44, maxZ: 48, repeat: [1, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D13C', label: 'East Drinking Hall Connector', minX: 31, maxX: 32, minZ: 44, maxZ: 48, repeat: [1, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D14C', label: 'Lower Hall Connector', minX: -2.5, maxX: 2.5, minZ: 43, maxZ: 50, repeat: [1, 1.4], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'R14A', label: 'Shortcut Return East-West Run', minX: 27, maxX: 66, minZ: 76, maxZ: 84, repeat: [7, 1.5], encounterWeight: 0.6 }),
    room({ id: 'R14B', label: 'Shortcut Return North-South Run', minX: 62, maxX: 72, minZ: -50, maxZ: 84, repeat: [2, 14], encounterWeight: 0.6 }),
    room({ id: 'R14C', label: 'Shortcut Return Gate Hall Run', minX: 44, maxX: 66, minZ: -24, maxZ: -16, repeat: [4, 1.5], encounterWeight: 0.6 }),
  ],

  doors: [
    connector('D02', 'R01', 'R02', 0, -58.5, 4.0, [wallGap('R01', 0, -57, 4), wallGap('R02', 0, -58, 4)]),
    connector('D03', 'R02', 'R03', 0, -41.5, 4.2, [wallGap('R02', 0, -42, 4.2), wallGap('D03C', 0, -42, 4.2), wallGap('D03C', 0, -41, 4.2), wallGap('R03', 0, -41, 4.2)]),
    connector('D04', 'R03', 'R04', -20.5, -24.5, 3.6, [wallGap('R03', -17, -24.5, 3.6), wallGap('D04C', -17, -24.5, 3.6), wallGap('D04C', -24, -24.5, 3.6), wallGap('R04', -24, -24.5, 3.6)]),
    connector('D05', 'R03', 'R05', 20.5, -24.5, 3.6, [wallGap('R03', 17, -24.5, 3.6), wallGap('D05C', 17, -24.5, 3.6), wallGap('D05C', 24, -24.5, 3.6), wallGap('R05', 24, -24.5, 3.6)]),
    connector('D07', 'R04', 'R07', -34, -8.5, 3.6, [wallGap('R04', -34, -9, 3.6), wallGap('D06C', -34, -9, 3.6), wallGap('D06C', -34, -8, 3.6), wallGap('R07', -34, -8, 3.6)]),
    connector('D08', 'R05', 'R06', 24.2, -4, 4.0, [wallGap('R05', 24, -4, 4), wallGap('R06', 25, -4, 4)]),
    connector('D09', 'R07', 'R06', -25.5, 4, 3.6, [wallGap('R07', -26, 4, 3.6), wallGap('D07C', -26, 4, 3.6), wallGap('D07C', -25, 4, 3.6), wallGap('R06', -25, 4, 3.6)]),
    connector('D10', 'R06', 'R08', 0, 13.5, 5.0, [wallGap('R06', 0, 13, 5), wallGap('R08', 0, 13, 5)]),
    connector('D11', 'R07', 'R08', -25, 22, 3.6, [wallGap('R07', -26, 22, 3.6), wallGap('R08', -31, 22, 3.6)]),
    connector('D12', 'R08', 'R09', -31.5, 46, 4.0, [wallGap('R08', -31, 46, 4), wallGap('D12C', -31, 46, 4), wallGap('D12C', -32, 46, 4), wallGap('R09', -32, 46, 4)]),
    connector('D13', 'R08', 'R10', 31.5, 46, 4.0, [wallGap('R08', 31, 46, 4), wallGap('D13C', 31, 46, 4), wallGap('D13C', 32, 46, 4), wallGap('R10', 32, 46, 4)]),
    connector('D14', 'R08', 'R11', 0, 46.5, 5.0, [wallGap('R08', 0, 43, 5), wallGap('D14C', 0, 43, 5), wallGap('D14C', 0, 50, 5), wallGap('R11', 0, 50, 5)]),
    connector('D15', 'R11', 'R12', 0, 74, 5.0, [wallGap('R11', 0, 74, 5), wallGap('R12', 0, 74, 5)]),
    connector('D16', 'R12', 'R13', 0, 90, 4.0, [wallGap('R12', 0, 90, 4), wallGap('R13', 0, 90, 4)]),
    connector('D17', 'R12', 'R14A', 27, 80, 3.6, [wallGap('R12', 27, 80, 3.6), wallGap('R14A', 27, 80, 3.6)]),
    connector('D18', 'R14A', 'R14B', 64, 80, 3.6, [wallGap('R14A', 66, 80, 3.6), wallGap('R14B', 62, 80, 3.6)]),
    connector('D19', 'R14B', 'R14C', 64, -20, 3.6, [wallGap('R14B', 64, -50, 3.6), wallGap('R14C', 64, -24, 3.6)]),
    connector('D20', 'R14C', 'R05', 44, -20, 3.6, [wallGap('R14C', 44, -20, 3.6), wallGap('R05', 44, -20, 3.6)]),
  ],

  blockers: [
    blocker('BGT_BROKEN_OFFERING_SLAB', 'altar', -3.5, 3.5, -33.5, -30.5, 1.1),
    blocker('BGT_WEST_LOW_COUNTER', 'counter', -18, -6, -3, -1, 1.2),
    blocker('BGT_EAST_LOW_COUNTER', 'counter', 8, 18, 4, 6, 1.2),
    blocker('BGT_WEST_BAR_BLOCK', 'divider', -23, -13, 29, 31, 1.1),
    blocker('BGT_EAST_BOOTH_DIVIDER', 'divider', 13, 23, 25, 27, 1.1),
    blocker('BGT_WEST_DEEP_PILLAR_CLUSTER', 'divider', -51, -39, 48, 56, 1.1),
    blocker('BGT_EAST_DEEP_BAR_BLOCK', 'counter', 36, 52, 49, 51, 1.4),
    blocker('BGT_RELIQUARY_PILLAR_NW', 'prop', -19, -17, 57, 59, 3.2),
    blocker('BGT_RELIQUARY_PILLAR_SW', 'prop', -10, -8, 65, 67, 3.2),
    blocker('BGT_RELIQUARY_PILLAR_NE', 'prop', 8, 10, 57, 59, 3.2),
    blocker('BGT_RELIQUARY_PILLAR_SE', 'prop', 17, 19, 65, 67, 3.2),
    blocker('BGT_CENTRAL_RELIQUARY_BLOCK', 'altar', -3, 3, 80.5, 83.5, 1.6),
    blocker('BGT_SEALED_NORTH_GATE', 'gate', -4, 4, 93.78, 94.22, 3.2),
  ],

  props: [
    prop('BGT-P01-broken-offering-slab', 'altar', 'R03', 0, 0.55, -32, 7, 1.1, 3, 'BGT_BROKEN_OFFERING_SLAB'),
    prop('BGT-P02-broken-counter-west', 'counter', 'R06', -12, 0.6, -2, 12, 1.2, 2, 'BGT_WEST_LOW_COUNTER'),
    prop('BGT-P03-broken-counter-east', 'counter', 'R06', 13, 0.6, 5, 10, 1.2, 2, 'BGT_EAST_LOW_COUNTER'),
    prop('BGT-P04-low-divider-A', 'divider', 'R08', -18, 0.55, 30, 10, 1.1, 2, 'BGT_WEST_BAR_BLOCK'),
    prop('BGT-P05-low-divider-B', 'divider', 'R08', 18, 0.55, 26, 10, 1.1, 2, 'BGT_EAST_BOOTH_DIVIDER'),
    prop('BGT-P06-booth-divider-cluster', 'divider', 'R09', -45, 0.55, 52, 12, 1.1, 8, 'BGT_WEST_DEEP_PILLAR_CLUSTER'),
    prop('BGT-P07-back-bar-block', 'counter', 'R10', 44, 0.7, 50, 16, 1.4, 2, 'BGT_EAST_DEEP_BAR_BLOCK'),
    prop('BGT-P08-square-pillar', 'pillar', 'R11', -18, 1.6, 58, 2, 3.2, 2, 'BGT_RELIQUARY_PILLAR_NW'),
    prop('BGT-P09-square-pillar', 'pillar', 'R11', -9, 1.6, 66, 2, 3.2, 2, 'BGT_RELIQUARY_PILLAR_SW'),
    prop('BGT-P10-square-pillar', 'pillar', 'R11', 9, 1.6, 58, 2, 3.2, 2, 'BGT_RELIQUARY_PILLAR_NE'),
    prop('BGT-P11-square-pillar', 'pillar', 'R11', 18, 1.6, 66, 2, 3.2, 2, 'BGT_RELIQUARY_PILLAR_SE'),
    prop('BGT-P14-central-reliquary-block', 'reliquary', 'R12', 0, 0.8, 82, 6, 1.6, 3, 'BGT_CENTRAL_RELIQUARY_BLOCK'),
    prop('BGT-P15-sealed-future-gate', 'gate', 'R13', 0, 1.6, 94, 8, 3.2, 0.45, 'BGT_SEALED_NORTH_GATE', 'gate'),
    prop('BGT-G01-first-gate-inspect-rusted-metal', 'gate', 'R05', 30, 1.6, -20, 0.45, 3.2, 8, null, 'gate'),
    prop('BGT-P16-rusted-sword-chest-placeholder', 'equipment_chest', 'R03', -10.8, 0.42, -34.8, 1.55, 0.84, 1.05, null, 'propStone'),
  ],

  spawns: [
    { id: 'bgt_player_start', kind: 'player', position: { x: 0, y: 1.55, z: -72 }, yaw: 0, roomId: 'R01', tags: ['entry'] },
    { id: 'bgt_field_exit_interaction', kind: 'return', position: { x: 0, y: 1.2, z: -76 }, yaw: Math.PI, roomId: 'R01', tags: ['exit'] },
    debugEnemySpawn('E01', 8, -31, 'R03', true),
    debugEnemySpawn('E02', -39, -18, 'R04'),
    debugEnemySpawn('E03', -14, 2, 'R06'),
    debugEnemySpawn('E04', 16, 6, 'R06'),
    debugEnemySpawn('E05', -35, 12, 'R07'),
    debugEnemySpawn('E06', -20, 28, 'R08', true),
    debugEnemySpawn('E07', 2, 33, 'R08'),
    debugEnemySpawn('E08', 22, 25, 'R08'),
    debugEnemySpawn('E09', -48, 54, 'R09'),
    debugEnemySpawn('E10', -10, 61, 'R11'),
    debugEnemySpawn('E11', 12, 66, 'R11'),
    debugEnemySpawn('E12', 0, 80, 'R12', true),
    factionSpawn('sheep_initial_first_branch', 'sheep_demon', -6.5, -49, 'R02', 2.8, true),
    factionSpawn('neck_initial_first_branch', 'neck_man', 6.5, -47, 'R02', 2.8, true),
    factionSpawn('sheep_spawn_early_branch', 'sheep_demon', -9, -33, 'R03', 3.4),
    factionSpawn('neck_spawn_early_branch', 'neck_man', 9, -31, 'R03', 3.4),
    factionSpawn('sheep_spawn_west_skirmish', 'sheep_demon', -36, -18, 'R04', 3.8),
    factionSpawn('neck_spawn_east_skirmish', 'neck_man', 34, -18, 'R05', 3.8),
    factionSpawn('sheep_spawn_middle_tavern', 'sheep_demon', -18, 25, 'R08', 4.0),
    factionSpawn('neck_spawn_middle_tavern', 'neck_man', 18, 29, 'R08', 4.0),
    factionSpawn('sheep_spawn_central_reliquary', 'sheep_demon', -12, 64, 'R11', 3.8),
    factionSpawn('neck_spawn_central_reliquary', 'neck_man', 12, 66, 'R11', 3.8),
    factionSpawn('neutral_spawn_west_side', 'neutral', -32, 12, 'R07', 4.0),
    factionSpawn('neutral_spawn_east_deep', 'neutral', 52, 58, 'R10', 3.6),
  ],

  encounterZones: [
    { id: 'early_first_branch', roomIds: ['R02', 'R03'], center: { x: 0, y: 0, z: -47 }, radius: 18, weight: 1, allowedFactions: ['sheep_demon', 'neck_man'], actionBubblePriority: 2, userData: { sheepOffset: { x: -5.5, y: 0, z: -1.5 }, neckOffset: { x: 5.5, y: 0, z: 1.5 } } },
    { id: 'west_side_chamber', roomIds: ['R04', 'R07'], center: { x: -32, y: 0, z: -10 }, radius: 18, weight: 1, allowedFactions: ['sheep_demon', 'neck_man'], actionBubblePriority: 1, userData: { sheepOffset: { x: -3, y: 0, z: -3 }, neckOffset: { x: 3, y: 0, z: 3 } } },
    { id: 'middle_grass_tavern', roomIds: ['R06', 'R08'], center: { x: 0, y: 0, z: 28 }, radius: 24, weight: 1.3, allowedFactions: ['sheep_demon', 'neck_man'], actionBubblePriority: 3, userData: { sheepOffset: { x: -6, y: 0, z: -4 }, neckOffset: { x: 6, y: 0, z: 4 } } },
    { id: 'central_reliquary', roomIds: ['R11', 'R12'], center: { x: 0, y: 0, z: 62 }, radius: 24, weight: 1.4, allowedFactions: ['sheep_demon', 'neck_man'], actionBubblePriority: 4, userData: { sheepOffset: { x: -7, y: 0, z: -2 }, neckOffset: { x: 7, y: 0, z: 2 } } },
    { id: 'east_side_chamber', roomIds: ['R05', 'R10'], center: { x: 34, y: 0, z: -12 }, radius: 18, weight: 1, allowedFactions: ['sheep_demon', 'neck_man'], actionBubblePriority: 1, userData: { sheepOffset: { x: -3, y: 0, z: 3 }, neckOffset: { x: 3, y: 0, z: -3 } } },
  ],

  exits: [
    {
      id: 'bgt_exit_to_reliquary_field',
      fromLocation: 'black-grass-temple',
      toLocation: 'reliquary-field',
      triggerRect: { minX: -3.5, maxX: 3.5, minZ: -79, maxZ: -73 },
      position: { x: 0, y: 1.2, z: -76 },
      destinationSpawnId: 'field_black_grass_temple_return',
      promptText: 'Tap INTERACT to climb back to Reliquary Field.',
      roomId: 'R01',
      wallGaps: [wallGap('R01', 0, -80, 4)],
      tags: ['field-return'],
    },
  ],

  torchFixtures: [
    torchFixture('BGT_T01_entry_west_wall', 'R01', 'west', 14, 'weakTorch', { note: 'Entry stair pool, clear of field-return and vestibule doorways.' }),
    torchFixture('BGT_T02_vestibule_west_wall', 'R02', 'west', 6, 'dungeonTorch'),
    torchFixture('BGT_T03_vestibule_east_wall', 'R02', 'east', 10, 'dungeonTorch'),
    torchFixture('BGT_T04_offering_west_wall', 'R03', 'west', 7, 'dungeonTorch', { note: 'Moved off the broken offering room centerline.' }),
    torchFixture('BGT_T05_gate_hall_east_wall', 'R05', 'east', 17.5, 'strongTorch', { note: 'Reads the first gate hall without blocking the gate interaction.' }),
    torchFixture('BGT_T06_tavern_west_wall', 'R06', 'west', 20, 'dungeonTorch'),
    torchFixture('BGT_T07_tavern_east_wall', 'R06', 'east', 5, 'dungeonTorch'),
    torchFixture('BGT_T08_service_loop_west_wall', 'R07', 'west', 19, 'weakTorch'),
    torchFixture('BGT_T09_drinking_hall_west_wall', 'R08', 'west', 15, 'dungeonTorch'),
    torchFixture('BGT_T10_drinking_hall_east_wall', 'R08', 'east', 15, 'dungeonTorch'),
    torchFixture('BGT_T11_reliquary_hall_west_wall', 'R11', 'west', 12, 'ritualTorch'),
    torchFixture('BGT_T12_reliquary_hall_east_wall', 'R11', 'east', 12, 'ritualTorch'),
  ],

  lights: [
    { id: 'bgt_ambient_hemi', kind: 'ambient', skyColor: 0x80786b, groundColor: 0x211b16, intensity: 1.05 },
    { id: 'bgt_warm_directional_fill', kind: 'directional', color: 0xd0b18a, intensity: 0.35, position: { x: 8, y: 6, z: -10 } },
    { id: 'T12_black_grass_sanctum_cold_fill', kind: 'point', color: 0x9fb7c8, intensity: 1.25, distance: 18, decay: 1.2, position: { x: 0, y: 1.6, z: 82 }, roomId: 'R12' },
  ],

  interactions: [
    { id: 'BGT_INT03', target: { x: 0, y: 1.2, z: -32 }, range: 3.0, hint: 'Tap INTERACT to inspect the broken offering slab.', message: 'Old cups are carved into the altar stone. None are empty.' },
    {
      id: 'BGT_INT_RUSTED_SWORD_CHEST',
      target: { x: -10.8, y: 1.0, z: -34.8 },
      range: 3.1,
      hint: 'Tap INTERACT to open the rusted sword chest.',
      message: 'A rusted sword rests inside the black stone chest.',
      acquiredMessage: 'You take the Rusted Sword.',
      repeatHint: 'The rusted sword chest is open.',
      repeatMessage: 'The chest lies open and empty.',
      type: 'equipmentPickup',
      itemId: 'rusted_sword',
      userData: { propId: 'BGT-P16-rusted-sword-chest-placeholder', placeholder: true },
    },
    { id: 'BGT_INT04', target: { x: 30, y: 1.2, z: -20 }, range: 3.0, hint: 'Tap INTERACT to test the first rusted gate.', message: 'The rusted gate holds, but its hinges remember movement.' },
    { id: 'BGT_INT06', target: { x: 0, y: 1.2, z: 82 }, range: 3.0, hint: 'Tap INTERACT to inspect the central reliquary.', message: 'The grass grows from inside the reliquary block.' },
    { id: 'BGT_INT07', target: { x: 0, y: 1.2, z: 94 }, range: 3.0, hint: 'Tap INTERACT to inspect the sealed future gate.', message: 'The gate is sealed with roots blacker than iron.' },
    { id: 'BGT_INT05', target: { x: 44, y: 1.2, z: -20 }, range: 3.5, hint: 'Tap INTERACT to mark the return stair.', message: 'A return stair opens behind the old wall.' },
  ],

  navigation: {
    roomGraph: {
      roomIds: ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13', 'R14A', 'R14B', 'R14C'],
      links: [
        { id: 'D02_NAV', fromRoom: 'R01', toRoom: 'R02', navWaypoint: { x: 0, y: 0, z: -58.5 } },
        { id: 'D03_NAV', fromRoom: 'R02', toRoom: 'R03', navWaypoint: { x: 0, y: 0, z: -41.5 } },
        { id: 'D04_NAV', fromRoom: 'R03', toRoom: 'R04', navWaypoint: { x: -20.5, y: 0, z: -24.5 } },
        { id: 'D05_NAV', fromRoom: 'R03', toRoom: 'R05', navWaypoint: { x: 20.5, y: 0, z: -24.5 } },
        { id: 'D07_NAV', fromRoom: 'R04', toRoom: 'R07', navWaypoint: { x: -34, y: 0, z: -8.5 } },
        { id: 'D08_NAV', fromRoom: 'R05', toRoom: 'R06', navWaypoint: { x: 24.2, y: 0, z: -4 } },
        { id: 'D09_NAV', fromRoom: 'R07', toRoom: 'R06', navWaypoint: { x: -25.5, y: 0, z: 4 } },
        { id: 'D10_NAV', fromRoom: 'R06', toRoom: 'R08', navWaypoint: { x: 0, y: 0, z: 13.5 } },
        { id: 'D11_NAV', fromRoom: 'R07', toRoom: 'R08', navWaypoint: { x: -25, y: 0, z: 22 } },
        { id: 'D12_NAV', fromRoom: 'R08', toRoom: 'R09', navWaypoint: { x: -31.5, y: 0, z: 46 } },
        { id: 'D13_NAV', fromRoom: 'R08', toRoom: 'R10', navWaypoint: { x: 31.5, y: 0, z: 46 } },
        { id: 'D14_NAV', fromRoom: 'R08', toRoom: 'R11', navWaypoint: { x: 0, y: 0, z: 46.5 } },
        { id: 'D15_NAV', fromRoom: 'R11', toRoom: 'R12', navWaypoint: { x: 0, y: 0, z: 74 } },
        { id: 'D16_NAV', fromRoom: 'R12', toRoom: 'R13', navWaypoint: { x: 0, y: 0, z: 90 } },
        { id: 'D17_NAV', fromRoom: 'R12', toRoom: 'R14A', navWaypoint: { x: 27, y: 0, z: 80 } },
        { id: 'D18_NAV', fromRoom: 'R14A', toRoom: 'R14B', navWaypoint: { x: 64, y: 0, z: 80 } },
        { id: 'D19_NAV', fromRoom: 'R14B', toRoom: 'R14C', navWaypoint: { x: 64, y: 0, z: -20 } },
        { id: 'D20_NAV', fromRoom: 'R14C', toRoom: 'R05', navWaypoint: { x: 44, y: 0, z: -20 } },
      ],
    },
    localAvoidanceHints: [
      { id: 'avoid-central-reliquary', blockerId: 'BGT_CENTRAL_RELIQUARY_BLOCK', padding: 1.05 },
      { id: 'avoid-lower-pillars', tags: ['pillar'], padding: 0.9 },
    ],
    forbiddenZones: [],
    preferredPatrolRoutes: [],
  },
});
