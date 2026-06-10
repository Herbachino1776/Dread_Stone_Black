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
  offeringStone: { path: './assets/textures/wall_black_stone_01.png', repeat: [1.5, 1], color: 0x5f5548, roughness: 0.98, metalness: 0.0, emissive: 0x160e09, emissiveIntensity: 0.1 },
  rootDark: { path: './assets/textures/outdoor/field_dead_grass_01.png', repeat: [3, 2], color: 0x161b0f, roughness: 1.0, metalness: 0.0, emissive: 0x010301, emissiveIntensity: 0.08 },
  bonePale: { path: './assets/textures/floor_worn_stone_01.png', repeat: [1, 1], color: 0xb2a58f, roughness: 0.94, metalness: 0.0, emissive: 0x1c1510, emissiveIntensity: 0.08 },
  bloodDark: { path: './assets/textures/floor_worn_stone_01.png', repeat: [1, 1], color: 0x26100d, roughness: 0.99, metalness: 0.0, emissive: 0x070101, emissiveIntensity: 0.12 },
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

function floorPatch(id, roomId, x, z, width, depth, material = 'rootDark') {
  return prop(id, 'floor_patch', roomId, x, 0.025, z, width, 0.05, depth, null, material);
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
    room({ id: 'R01', label: 'Entry Threshold', minX: -5, maxX: 5, minZ: -80, maxZ: -57, repeat: [2, 5], encounterWeight: 0.1, safeForSpawn: false, userData: { role: 'field return and descent', landmark: 'cold stair mouth' } }),
    room({ id: 'R02', label: 'Descent Vestibule', minX: -12, maxX: 12, minZ: -58, maxZ: -42, repeat: [4, 3], encounterWeight: 0.35, safeForSpawn: false, userData: { role: 'first safe orientation room', landmark: 'paired wall torches' } }),
    room({ id: 'R03', label: 'Broken Offering Room', minX: -17, maxX: 17, minZ: -41, maxZ: -23, repeat: [5, 3], encounterWeight: 0.9, userData: { role: 'rusted sword chest and first authored objective beat', landmark: 'broken central offering slab' } }),
    room({ id: 'R04', label: 'West Shrine Nook', minX: -44, maxX: -24, minZ: -31, maxZ: -9, repeat: [3, 4], encounterWeight: 1.0, userData: { role: 'first Sheep Demon pressure branch', landmark: 'failed west shrine stones' } }),
    room({ id: 'R05', label: 'Rusted Gate Watch', minX: 24, maxX: 44, minZ: -31, maxZ: -9, repeat: [3, 4], encounterWeight: 1.0, userData: { role: 'first Neck Man pressure branch and return shortcut landmark', landmark: 'standing rusted gate' } }),
    room({ id: 'R06', label: 'Black Grass Hall', minX: -25, maxX: 25, minZ: -13, maxZ: 13, floorTexture: 'grassFloor', repeat: [8, 5], encounterWeight: 1.2, userData: { role: 'wide early combat and navigation hub', landmark: 'grass where stone should be' } }),
    room({ id: 'R07', label: 'Rooted Service Loop', minX: -42, maxX: -26, minZ: -8, maxZ: 25, repeat: [3, 6], encounterWeight: 0.9, userData: { role: 'side loop back into the main route', landmark: 'thin root crawl along west wall' } }),
    room({ id: 'R08', label: 'Warring Crossing', minX: -31, maxX: 31, minZ: 13, maxZ: 43, floorTexture: 'grassFloor', repeat: [9, 5], encounterWeight: 1.65, userData: { role: 'main faction combat arena', landmark: 'split grass floor and broken dividers' } }),
    room({ id: 'R09', label: 'Sheep Demon Rookery', minX: -56, maxX: -32, minZ: 39, maxZ: 65, floorTexture: 'mixedFloor', repeat: [4, 4], encounterWeight: 0.9, userData: { role: 'optional west threat pocket', landmark: 'pale bone line' } }),
    room({ id: 'R10', label: 'Neck Man Bone Store', minX: 32, maxX: 56, minZ: 39, maxZ: 65, floorTexture: 'mixedFloor', repeat: [4, 4], encounterWeight: 0.9, userData: { role: 'optional east threat pocket', landmark: 'low counter and dark smear' } }),
    room({ id: 'R11', label: 'Lower Rooted Room', minX: -25, maxX: 25, minZ: 50, maxZ: 74, repeat: [7, 4], encounterWeight: 1.25, userData: { navCenter: { x: 0, y: 0, z: 62 }, role: 'deep approach and survival objective space', landmark: 'four square pillars' } }),
    room({ id: 'R12', label: 'Silent Altar Chamber', minX: -27, maxX: 27, minZ: 74, maxZ: 90, floorTexture: 'grassFloor', repeat: [8, 3], encounterWeight: 1.35, userData: { navCenter: { x: 10, y: 0, z: 84 }, role: 'ritual endpoint for v0.2', landmark: 'rooted reliquary block' } }),
    room({ id: 'R13', label: 'Sealed Root Gate', minX: -11, maxX: 11, minZ: 90, maxZ: 100, repeat: [3, 2], encounterWeight: 0.1, safeForSpawn: false, userData: { role: 'future progression gate', landmark: 'black roots over iron' } }),
    room({ id: 'D03C', label: 'R02/R03 Connector', minX: -2.1, maxX: 2.1, minZ: -42, maxZ: -41, repeat: [1, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D04C', label: 'West Branch Connector', minX: -24, maxX: -17, minZ: -26, maxZ: -23, repeat: [1.4, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D05C', label: 'East Branch Connector', minX: 17, maxX: 24, minZ: -26, maxZ: -23, repeat: [1.4, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D06C', label: 'West Storage Loop Connector', minX: -36, maxX: -32, minZ: -9, maxZ: -8, repeat: [1, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D07C', label: 'Service/Tavern Connector', minX: -26, maxX: -25, minZ: 2, maxZ: 6, repeat: [1, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D12C', label: 'West Drinking Hall Connector', minX: -32, maxX: -31, minZ: 44, maxZ: 48, repeat: [1, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D13C', label: 'East Drinking Hall Connector', minX: 31, maxX: 32, minZ: 44, maxZ: 48, repeat: [1, 1], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'D14C', label: 'Lower Hall Connector', minX: -2.5, maxX: 2.5, minZ: 43, maxZ: 50, repeat: [1, 1.4], tags: ['connector'], safeForSpawn: false, wallGeometry: false }),
    room({ id: 'R14A', label: 'Return Threshold East Run', minX: 27, maxX: 66, minZ: 76, maxZ: 84, repeat: [7, 1.5], encounterWeight: 0.25, userData: { role: 'readable return route from the silent altar', landmark: 'long eastward crawl' } }),
    room({ id: 'R14B', label: 'Return Threshold North Run', minX: 62, maxX: 72, minZ: -50, maxZ: 84, repeat: [2, 14], encounterWeight: 0.25, userData: { role: 'safe navigation spine back toward the gate watch', landmark: 'straight north-south wall run' } }),
    room({ id: 'R14C', label: 'Return Threshold Gate Run', minX: 44, maxX: 66, minZ: -24, maxZ: -16, repeat: [4, 1.5], encounterWeight: 0.25, userData: { role: 'shortcut re-entry at the first gate hall', landmark: 'return stair mark' } }),
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
    prop('BGT-P16-rusted-sword-chest-placeholder', 'equipment_chest', 'R03', -12.6, 0.42, -36.2, 1.55, 0.84, 1.05, null, 'offeringStone'),
    prop('BGT-P17-empty-offering-stone-a', 'offering_stone', 'R03', -6.2, 0.22, -35.6, 1.25, 0.44, 0.85, null, 'offeringStone'),
    prop('BGT-P18-empty-offering-stone-b', 'offering_stone', 'R03', 6.4, 0.2, -34.6, 1.1, 0.4, 0.9, null, 'offeringStone'),
    prop('BGT-P19-cracked-west-shrine', 'shrine_stone', 'R04', -39.5, 0.55, -24.5, 2.2, 1.1, 1.4, null, 'offeringStone'),
    prop('BGT-P20-neck-man-scratch-stone', 'scratch_stone', 'R05', 39.2, 0.5, -26.2, 2.1, 1.0, 1.2, null, 'propStone'),
    prop('BGT-P21-sheep-bone-line-west', 'bone_marker', 'R09', -51.2, 0.08, 61.5, 4.6, 0.16, 0.55, null, 'bonePale'),
    prop('BGT-P22-neck-bone-line-east', 'bone_marker', 'R10', 51.4, 0.08, 44.2, 4.2, 0.16, 0.55, null, 'bonePale'),
    prop('BGT-P23-silent-altar-basin', 'ritual_basin', 'R12', 0, 1.75, 82, 3.4, 0.24, 2.0, null, 'bloodDark'),
    floorPatch('BGT-GR01-entry-root-trickle', 'R01', 0, -58.8, 2.2, 3.2),
    floorPatch('BGT-GR02-offering-chest-grass', 'R03', -12.4, -34.6, 4.2, 2.6),
    floorPatch('BGT-GR03-west-shrine-creep', 'R04', -34.5, -13.5, 6.8, 4.4),
    floorPatch('BGT-GR04-gate-hall-creep', 'R05', 34, -14.5, 6.4, 3.6),
    floorPatch('BGT-GR05-warring-crossing-dark-heart', 'R08', 0, 28.5, 12, 6.2),
    floorPatch('BGT-GR06-lower-pillar-root-track', 'R11', 0, 62, 7.8, 14),
    floorPatch('BGT-GR07-silent-altar-root-ring', 'R12', 0, 82, 10, 5.6),
    floorPatch('BGT-BL01-old-blood-west', 'R04', -31.5, -25.4, 3.4, 1.1, 'bloodDark'),
    floorPatch('BGT-BL02-old-blood-crossing', 'R08', 12.5, 35.6, 5.2, 1.4, 'bloodDark'),
  ],

  spawns: [
    { id: 'bgt_player_start', kind: 'player', position: { x: 0, y: 1.55, z: -72 }, yaw: 0, roomId: 'R01', tags: ['entry'] },
    { id: 'bgt_field_exit_interaction', kind: 'return', position: { x: 0, y: 1.2, z: -76 }, yaw: Math.PI, roomId: 'R01', tags: ['exit'] },
    debugEnemySpawn('E01', 10.5, -28, 'R03', true),
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
    factionSpawn('sheep_initial_west_shrine', 'sheep_demon', -35.5, -23.5, 'R04', 3.4, true),
    factionSpawn('neck_initial_gate_watch', 'neck_man', 34.5, -24, 'R05', 3.4, true),
    factionSpawn('sheep_spawn_early_branch', 'sheep_demon', -9.5, -27.2, 'R03', 2.8),
    factionSpawn('neck_spawn_early_branch', 'neck_man', 10.5, -29.2, 'R03', 2.8),
    factionSpawn('sheep_spawn_west_skirmish', 'sheep_demon', -39, -15.5, 'R04', 3.8),
    factionSpawn('neck_spawn_east_skirmish', 'neck_man', 39, -15.5, 'R05', 3.8),
    factionSpawn('sheep_spawn_black_grass_hall', 'sheep_demon', -17.5, 6.5, 'R06', 4.2),
    factionSpawn('neck_spawn_black_grass_hall', 'neck_man', 17.5, -6.5, 'R06', 4.2),
    factionSpawn('sheep_spawn_warring_crossing', 'sheep_demon', -20, 33, 'R08', 4.0),
    factionSpawn('neck_spawn_warring_crossing', 'neck_man', 20, 32, 'R08', 4.0),
    factionSpawn('sheep_spawn_central_reliquary', 'sheep_demon', -14, 60, 'R11', 3.8),
    factionSpawn('neck_spawn_central_reliquary', 'neck_man', 14, 66, 'R11', 3.8),
    factionSpawn('neutral_spawn_rooted_loop', 'neutral', -34, 15, 'R07', 4.0),
    factionSpawn('neutral_spawn_east_deep', 'neutral', 51, 58, 'R10', 3.6),
  ],

  encounterZones: [
    { id: 'early_branch_glimpse', label: 'first faction glimpse around the offering side branches', roomIds: ['R03', 'R04', 'R05'], center: { x: 0, y: 0, z: -25.5 }, radius: 28, weight: 1.15, allowedFactions: ['sheep_demon', 'neck_man'], actionBubblePriority: 2, userData: { sheepOffset: { x: -13, y: 0, z: 0.5 }, neckOffset: { x: 13, y: 0, z: 0.5 } } },
    { id: 'west_rooted_loop', label: 'west shrine and rooted service loop pressure zone', roomIds: ['R04', 'R07'], center: { x: -34, y: 0, z: 4 }, radius: 19, weight: 0.85, allowedFactions: ['sheep_demon', 'neck_man'], actionBubblePriority: 1, userData: { sheepOffset: { x: -4, y: 0, z: -4 }, neckOffset: { x: 4, y: 0, z: 4 } } },
    { id: 'black_grass_hall_pressure', label: 'black grass hall pressure zone', roomIds: ['R06'], center: { x: 0, y: 0, z: 0 }, radius: 22, weight: 1.1, allowedFactions: ['sheep_demon', 'neck_man'], actionBubblePriority: 2, userData: { sheepOffset: { x: -8, y: 0, z: 5 }, neckOffset: { x: 8, y: 0, z: -5 } } },
    { id: 'warring_crossing', label: 'main faction combat crossing', roomIds: ['R08', 'R09', 'R10'], center: { x: 0, y: 0, z: 31 }, radius: 28, weight: 1.45, allowedFactions: ['sheep_demon', 'neck_man'], actionBubblePriority: 4, userData: { sheepOffset: { x: -10, y: 0, z: -3 }, neckOffset: { x: 10, y: 0, z: 3 } } },
    { id: 'lower_rooted_room', label: 'lower rooted room and silent altar approach', roomIds: ['R11', 'R12'], center: { x: 0, y: 0, z: 66 }, radius: 25, weight: 1.25, allowedFactions: ['sheep_demon', 'neck_man'], actionBubblePriority: 3, userData: { sheepOffset: { x: -8, y: 0, z: -4 }, neckOffset: { x: 8, y: 0, z: 4 } } },
    { id: 'east_return_watch', label: 'east gate and return threshold pressure zone', roomIds: ['R05', 'R14C'], center: { x: 44, y: 0, z: -20 }, radius: 18, weight: 0.65, allowedFactions: ['sheep_demon', 'neck_man'], actionBubblePriority: 1, userData: { sheepOffset: { x: -5, y: 0, z: 0 }, neckOffset: { x: 5, y: 0, z: 0 } } },
  ],

  exits: [
    {
      id: 'bgt_exit_to_reliquary_field',
      fromLocation: 'black-grass-temple',
      toLocation: 'reliquary-field',
      triggerRect: { minX: -3.5, maxX: 3.5, minZ: -79, maxZ: -73 },
      position: { x: 0, y: 1.2, z: -76 },
      destinationSpawnId: 'field_black_grass_temple_return',
      promptText: '',
      roomId: 'R01',
      wallGaps: [wallGap('R01', 0, -80, 4)],
      tags: ['field-return'],
    },
  ],

  torchFixtures: [
    torchFixture('BGT_T01_entry_threshold_west_wall', 'R01', 'west', 11, 'weakTorch', { note: 'Low entry pool that leaves the field-return trigger readable.' }),
    torchFixture('BGT_T02_vestibule_west_wall', 'R02', 'west', 5, 'dungeonTorch', { note: 'First safe orientation torch, away from the R01/R02 threshold.' }),
    torchFixture('BGT_T03_vestibule_east_wall', 'R02', 'east', 11, 'dungeonTorch', { note: 'Opposing vestibule torch points the player toward the offering room.' }),
    torchFixture('BGT_T04_offering_chest_south_wall', 'R03', 'south', 4.2, 'strongTorch', { note: 'Highlights the rusted sword chest and broken offering stones.' }),
    torchFixture('BGT_T05_offering_east_wall', 'R03', 'east', 13, 'weakTorch', { note: 'Distant branch silhouette without fullbrighting the offering room.' }),
    torchFixture('BGT_T06_west_shrine_wall', 'R04', 'west', 8, 'dungeonTorch', { note: 'Warms the failed shrine and keeps the branch readable.' }),
    torchFixture('BGT_T07_gate_watch_south_wall', 'R05', 'south', 15, 'strongTorch', { note: 'Reads the rusted gate watch and return landmark without occupying the return doorway.' }),
    torchFixture('BGT_T08_black_grass_hall_west_wall', 'R06', 'west', 6, 'dungeonTorch'),
    torchFixture('BGT_T09_black_grass_hall_east_wall', 'R06', 'east', 19, 'dungeonTorch'),
    torchFixture('BGT_T10_rooted_service_loop_west_wall', 'R07', 'west', 9, 'weakTorch'),
    torchFixture('BGT_T11_warring_crossing_west_wall', 'R08', 'west', 12, 'strongTorch'),
    torchFixture('BGT_T12_warring_crossing_east_wall', 'R08', 'east', 24, 'dungeonTorch'),
    torchFixture('BGT_T13_lower_rooted_room_west_wall', 'R11', 'west', 7, 'ritualTorch'),
    torchFixture('BGT_T14_lower_rooted_room_east_wall', 'R11', 'east', 17, 'ritualTorch'),
    torchFixture('BGT_T15_silent_altar_west_wall', 'R12', 'west', 10.5, 'ritualTorch'),
    torchFixture('BGT_T16_silent_altar_east_wall', 'R12', 'east', 12.2, 'ritualTorch'),
    torchFixture('BGT_T17_return_threshold_west_wall', 'R14B', 'west', 50, 'weakTorch', { note: 'Single return-route cue; the corridor keeps dark falloff.' }),
  ],

  lights: [
    { id: 'bgt_ambient_hemi', kind: 'ambient', skyColor: 0x6d6558, groundColor: 0x16110d, intensity: 0.72 },
    { id: 'bgt_warm_directional_fill', kind: 'directional', color: 0xc09a72, intensity: 0.2, position: { x: 8, y: 6, z: -10 } },
    { id: 'T12_black_grass_sanctum_cold_fill', kind: 'point', color: 0x8faebe, intensity: 0.9, distance: 16, decay: 1.35, position: { x: 0, y: 1.45, z: 82 }, roomId: 'R12' },
  ],

  interactions: [
    { id: 'BGT_INT03', target: { x: 0, y: 1.2, z: -32 }, range: 3.0, hint: '', message: '' },
    {
      id: 'BGT_INT_RUSTED_SWORD_CHEST',
      target: { x: -12.6, y: 1.0, z: -36.2 },
      range: 3.1,
      hint: '',
      message: '',
      acquiredMessage: '',
      repeatHint: '',
      repeatMessage: '',
      type: 'equipmentPickup',
      itemId: 'rusted_sword',
      autoEquip: true,
      userData: { propId: 'BGT-P16-rusted-sword-chest-placeholder', placeholder: true },
    },
    { id: 'BGT_INT04', target: { x: 30, y: 1.2, z: -20 }, range: 3.0, hint: '', message: '' },
    { id: 'BGT_INT06', target: { x: 0, y: 1.2, z: 82 }, range: 3.0, hint: '', message: '' },
    { id: 'BGT_INT07', target: { x: 0, y: 1.2, z: 94 }, range: 3.0, hint: '', message: '' },
    { id: 'BGT_INT05', target: { x: 44, y: 1.2, z: -20 }, range: 3.5, hint: '', message: '' },
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
