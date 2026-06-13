const defaultFloorY = 0;
const streetCeilingY = 7.2;
const interiorCeilingY = 3.4;
const templeCeilingY = 5.2;

// Sumerian City Block v0 is intentionally authored against the current
// Dread Stone Black compiled-runtime rectangle contract. It is blocky on purpose:
// a playable architecture skeleton that can evolve into richer city systems later.
const textureProfiles = Object.freeze({
  mudWall: { path: './assets/textures/wall_black_stone_01.png', repeat: [4.5, 1.2], color: 0xa88a55, roughness: 0.98, metalness: 0.0, emissive: 0x21180d, emissiveIntensity: 0.12 },
  sunFloor: { path: './assets/textures/floor_worn_stone_01.png', repeat: [5, 5], color: 0x9b8051, roughness: 0.99, metalness: 0.0, emissive: 0x1c1408, emissiveIntensity: 0.13 },
  alleyFloor: { path: './assets/textures/floor_worn_stone_01.png', repeat: [4, 5], color: 0x77613e, roughness: 0.99, metalness: 0.0, emissive: 0x140f08, emissiveIntensity: 0.12 },
  templeFloor: { path: './assets/textures/floor_worn_stone_01.png', repeat: [4, 4], color: 0x8f7c61, roughness: 0.98, metalness: 0.0, emissive: 0x20160e, emissiveIntensity: 0.16 },
  ceiling: { path: './assets/textures/ceiling_dark_stone_01.png', repeat: [5, 5], color: 0x756a58, roughness: 0.99, metalness: 0.0, emissive: 0x17110b, emissiveIntensity: 0.11 },
  darkInterior: { path: './assets/textures/wall_black_stone_01.png', repeat: [3, 1], color: 0x6f5636, roughness: 0.98, metalness: 0.0, emissive: 0x120b06, emissiveIntensity: 0.1 },
  gate: { path: './assets/textures/metal_gate_rusted_01.png', repeat: [1, 1.5], color: 0x9a7556, roughness: 0.82, metalness: 0.28, emissive: 0x21130b, emissiveIntensity: 0.16 },
  propStone: { path: './assets/textures/wall_black_stone_01.png', repeat: [1.6, 1], color: 0x82694c, roughness: 0.97, metalness: 0.0, emissive: 0x120d08, emissiveIntensity: 0.1 },
  offeringStone: { path: './assets/textures/wall_black_stone_01.png', repeat: [1.2, 0.9], color: 0x5e4936, roughness: 0.98, metalness: 0.0, emissive: 0x160e09, emissiveIntensity: 0.1 },
  bonePale: { path: './assets/textures/floor_worn_stone_01.png', repeat: [1, 1], color: 0xb4a17a, roughness: 0.94, metalness: 0.0, emissive: 0x1c1510, emissiveIntensity: 0.08 },
  bloodDark: { path: './assets/textures/floor_worn_stone_01.png', repeat: [1, 1], color: 0x26100d, roughness: 0.99, metalness: 0.0, emissive: 0x070101, emissiveIntensity: 0.12 },
});

function room({ id, label, minX, maxX, minZ, maxZ, floorTexture = 'sunFloor', wallTexture = 'mudWall', ceilingTexture = 'ceiling', ceilingY = streetCeilingY, tags = [], encounterWeight = 1, safeForSpawn = true, wallGeometry = true, userData = {} }) {
  return {
    id,
    label,
    minX,
    maxX,
    minZ,
    maxZ,
    floorY: defaultFloorY,
    ceilingY,
    floorTexture: { texture: floorTexture },
    wallTexture,
    ceilingTexture,
    tags,
    encounterWeight,
    safeForSpawn,
    wallGeometry,
    userData,
  };
}

function citySpace(id, label, minX, maxX, minZ, maxZ, tags = []) {
  return room({ id, label, minX, maxX, minZ, maxZ, floorTexture: 'sunFloor', wallTexture: 'mudWall', ceilingY: streetCeilingY, tags: ['city-space', ...tags], encounterWeight: 1, safeForSpawn: true });
}

function alley(id, label, minX, maxX, minZ, maxZ, tags = []) {
  return room({ id, label, minX, maxX, minZ, maxZ, floorTexture: 'alleyFloor', wallTexture: 'mudWall', ceilingY: streetCeilingY, tags: ['alley', ...tags], encounterWeight: 1, safeForSpawn: true });
}

function interior(id, label, minX, maxX, minZ, maxZ, tags = [], options = {}) {
  return room({ id, label, minX, maxX, minZ, maxZ, floorTexture: options.floorTexture ?? 'templeFloor', wallTexture: options.wallTexture ?? 'darkInterior', ceilingY: options.ceilingY ?? interiorCeilingY, tags: ['building', 'interior', ...tags], encounterWeight: options.encounterWeight ?? 1, safeForSpawn: options.safeForSpawn ?? true, userData: { buildingNumber: options.buildingNumber, role: options.role, ...options.userData } });
}

function wallGap(roomId, x, z, width) {
  return { roomId, position: { x, y: 0, z }, width };
}

function door(id, fromRoom, toRoom, x, z, width, kind = 'door', orientation = 'horizontal', wallSide = 'south', tags = []) {
  const kindTags = kind === 'lockedDoor' ? ['locked'] : kind === 'secretDoor' ? ['secret'] : [];
  return {
    id,
    fromRoom,
    toRoom,
    position: { x, y: 0, z },
    width,
    kind,
    navWaypoint: { x, y: 0, z },
    wallGaps: [wallGap(fromRoom, x, z, width), wallGap(toRoom, x, z, width)],
    tags: ['doorway', ...kindTags, ...tags],
    userData: {
      authoredBy: 'ChatGPT architecture pass',
      orientation,
      wallSide,
      primaryRoomId: fromRoom,
      secondaryRoomId: toRoom,
      snapped: true,
    },
  };
}

function blocker(id, type, minX, maxX, minZ, maxZ, height = 1.1, tags = []) {
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
    tags: ['solid', ...tags],
  };
}

function prop(id, kind, roomId, x, y, z, width, height, depth, collisionRef = null, material = 'propStone', tags = []) {
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
    tags: ['compiled-prop', ...tags],
  };
}

function floorPatch(id, roomId, x, z, width, depth, material = 'bloodDark') {
  return prop(id, 'floor_patch', roomId, x, 0.025, z, width, 0.05, depth, null, material, ['nonBlockingDecor']);
}

function torchFixture(id, roomId, wallSide, distanceAlongWall, profile = 'weakTorch', options = {}) {
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
    debug: { note: options.note ?? 'Sumerian city wall-mounted torch fixture' },
  };
}

function enemySpawn(id, species, faction, roomId, x, z, tags = [], userData = {}) {
  return {
    id,
    kind: 'enemy',
    species,
    faction,
    roomId,
    position: { x, y: 0, z },
    yaw: 0,
    allowedForInitialWave: true,
    allowedForRespawn: true,
    tags,
    userData,
  };
}

export const sumerianCityBlockV0Definition = Object.freeze({
  id: 'sumerian-city-block-v0',
  displayName: 'Sumerian City Block v0',
  type: 'temple-city',
  tags: ['city', 'temple', 'compiled-runtime', 'ai-authored-location', 'sumerian', 'blockout'],
  notes: 'Direct-authored blocky Sumerian city complex. Built as a playable rectangle-runtime skeleton for later city-system evolution and future artist texture swaps.',
  fog: { color: 0x2a2014, near: 18, far: 95 },
  lighting: { background: 0x17120c },
  textures: textureProfiles,
  defaultFloorY,
  defaultCeilingY: streetCeilingY,
  collision: { playerRadius: 0.5 },
  geometry: { wallThickness: 0.35, floorThickness: 0.18, ceilingThickness: 0.18 },
  integrity: {
    roomEdgePolicy: 'sealedUnlessDeclaredOpening',
    leakSampleStep: 1,
    collisionTruth: { visibleStructuralPropsRequireCollisionOrNonBlockingMetadata: true },
  },

  rooms: [
    citySpace('G01', 'South Gate Throat', 43, 57, 0, 10, ['gate', 'entry']),
    alley('S01', 'Lower Processional Street', 46, 54, 10, 22, ['processional']),
    citySpace('M01', 'Market Court of Measures', 24, 76, 22, 42, ['market', 'central']),
    alley('S02', 'Upper Processional Street', 46, 54, 42, 60, ['processional']),
    citySpace('P01', 'Temple Plaza of the Black Reed', 24, 76, 60, 82, ['plaza', 'temple-approach']),
    room({ id: 'Z01', label: 'Low Ziggurat Base', minX: 36, maxX: 64, minZ: 82, maxZ: 94, floorTexture: 'templeFloor', wallTexture: 'mudWall', ceilingY: templeCeilingY, tags: ['temple', 'ziggurat', 'sanctum'], encounterWeight: 0, safeForSpawn: false, userData: { role: 'future vertical temple entrance' } }),
    alley('W01', 'West Potters Alley', 14, 24, 10, 60, ['west-district']),
    alley('E01', 'East Tax Alley', 76, 86, 10, 60, ['east-district']),
    citySpace('W02', 'Residential Water Court', 6, 24, 60, 82, ['residential', 'court']),
    citySpace('E02', 'Guard Ledger Court', 76, 94, 60, 82, ['guard', 'court']),

    interior('B01', 'West Gatehouse', 32, 43, 0, 10, ['gatehouse'], { buildingNumber: 1, role: 'gate watch' }),
    interior('B02', 'East Gatehouse', 57, 68, 0, 10, ['gatehouse'], { buildingNumber: 2, role: 'gate watch' }),
    interior('B03', 'Potter House', 6, 14, 12, 22, ['home'], { buildingNumber: 3, role: 'potter dwelling' }),
    interior('B04', 'Weaver House', 6, 14, 24, 34, ['home'], { buildingNumber: 4, role: 'weaver dwelling' }),
    interior('B05', 'Beer Jar Room', 6, 14, 36, 46, ['tavernish'], { buildingNumber: 5, role: 'stored beer jars' }),
    interior('B06', 'Dead Scribe Cell', 6, 14, 48, 58, ['scribe'], { buildingNumber: 6, role: 'scribe cell' }),
    interior('B07', 'Tax Grain Office', 86, 94, 12, 22, ['ledger'], { buildingNumber: 7, role: 'tax room' }),
    interior('B08', 'East Storehouse', 86, 94, 24, 34, ['storage'], { buildingNumber: 8, role: 'storage' }),
    interior('B09', 'Bone Washer Room', 86, 94, 36, 46, ['ritual'], { buildingNumber: 9, role: 'ritual wash room' }),
    interior('B10', 'Neck Guard Post', 86, 94, 48, 58, ['guard'], { buildingNumber: 10, role: 'guard post' }),

    interior('B11', 'North Market Stall A', 24, 34, 42, 52, ['market-stall'], { buildingNumber: 11, role: 'market stall' }),
    interior('B12', 'North Market Stall B', 34, 44, 42, 52, ['market-stall'], { buildingNumber: 12, role: 'market stall' }),
    interior('B13', 'North Market Stall C', 56, 66, 42, 52, ['market-stall'], { buildingNumber: 13, role: 'market stall' }),
    interior('B14', 'North Market Stall D', 66, 76, 42, 52, ['market-stall'], { buildingNumber: 14, role: 'market stall' }),
    interior('B15', 'South Market Stall A', 24, 34, 12, 22, ['market-stall'], { buildingNumber: 15, role: 'market stall' }),
    interior('B16', 'South Market Stall B', 34, 44, 12, 22, ['market-stall'], { buildingNumber: 16, role: 'market stall' }),
    interior('B17', 'South Market Stall C', 56, 66, 12, 22, ['market-stall'], { buildingNumber: 17, role: 'market stall' }),
    interior('B18', 'South Market Stall D', 66, 76, 12, 22, ['market-stall'], { buildingNumber: 18, role: 'market stall' }),

    interior('B19', 'West Temple Store', 24, 36, 82, 94, ['temple-store'], { buildingNumber: 19, role: 'temple store', ceilingY: templeCeilingY, safeForSpawn: false }),
    interior('B20', 'East Temple Store', 64, 76, 82, 94, ['temple-store'], { buildingNumber: 20, role: 'temple store', ceilingY: templeCeilingY, safeForSpawn: false }),
    interior('B21', 'Priest Water House', 14, 24, 62, 72, ['priest-house'], { buildingNumber: 21, role: 'priest dwelling' }),
    interior('B22', 'Priest Sleep Cell', 14, 24, 72, 82, ['priest-house'], { buildingNumber: 22, role: 'priest sleeping room' }),
    interior('B23', 'Guard Barracks A', 76, 86, 62, 72, ['barracks'], { buildingNumber: 23, role: 'guard barracks' }),
    interior('B24', 'Guard Barracks B', 76, 86, 72, 82, ['barracks'], { buildingNumber: 24, role: 'guard barracks' }),
  ],

  doors: [
    door('D001', 'G01', 'S01', 50, 10, 3.6, 'doubleDoor', 'horizontal', 'south'),
    door('D002', 'S01', 'M01', 50, 22, 4.0, 'doubleDoor', 'horizontal', 'south'),
    door('D003', 'M01', 'S02', 50, 42, 4.0, 'doubleDoor', 'horizontal', 'north'),
    door('D004', 'S02', 'P01', 50, 60, 4.0, 'doubleDoor', 'horizontal', 'south'),
    door('D005', 'P01', 'Z01', 50, 82, 4.2, 'lockedDoor', 'horizontal', 'south', ['temple-lock']),
    door('D006', 'M01', 'W01', 24, 32, 3.2, 'door', 'vertical', 'west'),
    door('D007', 'M01', 'E01', 76, 32, 3.2, 'door', 'vertical', 'east'),
    door('D008', 'W01', 'W02', 19, 60, 3.2, 'door', 'horizontal', 'south'),
    door('D009', 'E01', 'E02', 81, 60, 3.2, 'door', 'horizontal', 'south'),
    door('D010', 'P01', 'W02', 24, 72, 2.8, 'door', 'vertical', 'west'),
    door('D011', 'P01', 'E02', 76, 72, 2.8, 'door', 'vertical', 'east'),

    door('D012', 'B01', 'G01', 43, 5, 1.8, 'door', 'vertical', 'east'),
    door('D013', 'B02', 'G01', 57, 5, 1.8, 'door', 'vertical', 'west'),
    door('D014', 'B03', 'W01', 14, 17, 1.6, 'door', 'vertical', 'east'),
    door('D015', 'B04', 'W01', 14, 29, 1.6, 'door', 'vertical', 'east'),
    door('D016', 'B05', 'W01', 14, 41, 1.6, 'secretDoor', 'vertical', 'east'),
    door('D017', 'B06', 'W01', 14, 53, 1.6, 'door', 'vertical', 'east'),
    door('D018', 'B07', 'E01', 86, 17, 1.6, 'lockedDoor', 'vertical', 'west'),
    door('D019', 'B08', 'E01', 86, 29, 1.6, 'door', 'vertical', 'west'),
    door('D020', 'B09', 'E01', 86, 41, 1.6, 'secretDoor', 'vertical', 'west'),
    door('D021', 'B10', 'E01', 86, 53, 1.6, 'door', 'vertical', 'west'),

    door('D022', 'B11', 'M01', 29, 42, 1.6, 'door', 'horizontal', 'south'),
    door('D023', 'B12', 'M01', 39, 42, 1.6, 'door', 'horizontal', 'south'),
    door('D024', 'B13', 'M01', 61, 42, 1.6, 'door', 'horizontal', 'south'),
    door('D025', 'B14', 'M01', 71, 42, 1.6, 'door', 'horizontal', 'south'),
    door('D026', 'B15', 'M01', 29, 22, 1.6, 'door', 'horizontal', 'north'),
    door('D027', 'B16', 'M01', 39, 22, 1.6, 'door', 'horizontal', 'north'),
    door('D028', 'B17', 'M01', 61, 22, 1.6, 'door', 'horizontal', 'north'),
    door('D029', 'B18', 'M01', 71, 22, 1.6, 'door', 'horizontal', 'north'),

    door('D030', 'B19', 'P01', 30, 82, 1.8, 'lockedDoor', 'horizontal', 'north'),
    door('D031', 'B20', 'P01', 70, 82, 1.8, 'lockedDoor', 'horizontal', 'north'),
    door('D032', 'B21', 'W02', 24, 67, 1.6, 'door', 'vertical', 'east'),
    door('D033', 'B22', 'W02', 24, 77, 1.6, 'door', 'vertical', 'east'),
    door('D034', 'B23', 'E02', 76, 67, 1.6, 'door', 'vertical', 'west'),
    door('D035', 'B24', 'E02', 76, 77, 1.6, 'door', 'vertical', 'west'),
  ],

  blockers: [
    blocker('BLK-ZIG-STEP-01', 'ziggurat_step', 39, 61, 84, 86, 0.6, ['temple-stone']),
    blocker('BLK-ZIG-STEP-02', 'ziggurat_step', 41, 59, 87, 89, 0.9, ['temple-stone']),
    blocker('BLK-ZIG-ALTAR', 'altar', 47, 53, 90, 92, 1.2, ['altar']),
    blocker('BLK-MARKET-WELL', 'well', 48, 52, 30, 34, 1.0, ['well']),
    blocker('BLK-MARKET-TABLE-W', 'market_table', 31, 39, 27, 29, 0.8, ['market']),
    blocker('BLK-MARKET-TABLE-E', 'market_table', 61, 69, 35, 37, 0.8, ['market']),
    blocker('BLK-GATE-RUBBLE-W', 'rubble', 44, 47, 2, 5, 0.7, ['rubble']),
    blocker('BLK-GATE-RUBBLE-E', 'rubble', 53, 56, 5, 8, 0.7, ['rubble']),
    blocker('BLK-PLAZA-IDOL', 'idol', 48, 52, 70, 74, 1.7, ['ritual']),
    blocker('BLK-RES-FOUNTAIN', 'basin', 12, 17, 68, 72, 0.75, ['water']),
    blocker('BLK-GUARD-RACK', 'weapon_rack', 83, 88, 68, 70, 1.3, ['guard']),
    blocker('BLK-SCRIBE-TABLE', 'table', 8, 12, 52, 54, 0.75, ['scribe']),
    blocker('BLK-TAX-CHEST', 'chest', 88, 91, 17, 19, 0.8, ['loot']),
    blocker('BLK-TEMPLE-CHEST-W', 'chest', 27, 30, 88, 90, 0.8, ['temple-store']),
    blocker('BLK-TEMPLE-CHEST-E', 'chest', 70, 73, 88, 90, 0.8, ['temple-store']),
  ],

  props: [
    prop('P-ZIG-STEP-01', 'ziggurat_step', 'Z01', 50, 0.3, 85, 22, 0.6, 2, 'BLK-ZIG-STEP-01', 'offeringStone'),
    prop('P-ZIG-STEP-02', 'ziggurat_step', 'Z01', 50, 0.45, 88, 18, 0.9, 2, 'BLK-ZIG-STEP-02', 'offeringStone'),
    prop('P-ZIG-ALTAR', 'altar', 'Z01', 50, 0.6, 91, 6, 1.2, 2, 'BLK-ZIG-ALTAR', 'propStone'),
    prop('P-MARKET-WELL', 'well', 'M01', 50, 0.5, 32, 4, 1, 4, 'BLK-MARKET-WELL', 'propStone'),
    prop('P-MARKET-TABLE-W', 'market_table', 'M01', 35, 0.4, 28, 8, 0.8, 2, 'BLK-MARKET-TABLE-W', 'offeringStone'),
    prop('P-MARKET-TABLE-E', 'market_table', 'M01', 65, 0.4, 36, 8, 0.8, 2, 'BLK-MARKET-TABLE-E', 'offeringStone'),
    prop('P-GATE-RUBBLE-W', 'rubble', 'G01', 45.5, 0.35, 3.5, 3, 0.7, 3, 'BLK-GATE-RUBBLE-W', 'propStone'),
    prop('P-GATE-RUBBLE-E', 'rubble', 'G01', 54.5, 0.35, 6.5, 3, 0.7, 3, 'BLK-GATE-RUBBLE-E', 'propStone'),
    prop('P-PLAZA-IDOL', 'idol', 'P01', 50, 0.85, 72, 4, 1.7, 4, 'BLK-PLAZA-IDOL', 'offeringStone'),
    prop('P-RES-FOUNTAIN', 'basin', 'W02', 14.5, 0.375, 70, 5, 0.75, 4, 'BLK-RES-FOUNTAIN', 'propStone'),
    prop('P-GUARD-RACK', 'weapon_rack', 'E02', 85.5, 0.65, 69, 5, 1.3, 2, 'BLK-GUARD-RACK', 'gate'),
    prop('P-SCRIBE-TABLE', 'table', 'B06', 10, 0.375, 53, 4, 0.75, 2, 'BLK-SCRIBE-TABLE', 'offeringStone'),
    prop('P-TAX-CHEST', 'chest', 'B07', 89.5, 0.4, 18, 3, 0.8, 2, 'BLK-TAX-CHEST', 'gate'),
    prop('P-TEMPLE-CHEST-W', 'chest', 'B19', 28.5, 0.4, 89, 3, 0.8, 2, 'BLK-TEMPLE-CHEST-W', 'gate'),
    prop('P-TEMPLE-CHEST-E', 'chest', 'B20', 71.5, 0.4, 89, 3, 0.8, 2, 'BLK-TEMPLE-CHEST-E', 'gate'),
    prop('P-NOTE-GATE', 'lore_tablet', 'G01', 50, 0.1, 2, 1.2, 0.2, 0.8, null, 'bonePale', ['nonBlockingDecor']),
    prop('P-NOTE-MARKET', 'lore_tablet', 'M01', 54, 0.1, 30, 1.2, 0.2, 0.8, null, 'bonePale', ['nonBlockingDecor']),
    prop('P-NOTE-ZIG', 'lore_tablet', 'Z01', 50, 0.1, 93, 1.2, 0.2, 0.8, null, 'bonePale', ['nonBlockingDecor']),
    floorPatch('P-BLOOD-ALLEY-W', 'W01', 18, 44, 3, 2, 'bloodDark'),
    floorPatch('P-BLOOD-GUARD', 'E02', 83, 76, 4, 2.5, 'bloodDark'),
  ],

  torchFixtures: [
    torchFixture('L001', 'G01', 'north', 3, 'dungeonTorch'),
    torchFixture('L002', 'G01', 'north', 11, 'dungeonTorch'),
    torchFixture('L003', 'S01', 'west', 4, 'weakTorch'),
    torchFixture('L004', 'S01', 'east', 8, 'weakTorch'),
    torchFixture('L005', 'M01', 'north', 6, 'dungeonTorch'),
    torchFixture('L006', 'M01', 'north', 44, 'dungeonTorch'),
    torchFixture('L007', 'M01', 'south', 8, 'weakTorch'),
    torchFixture('L008', 'M01', 'south', 42, 'weakTorch'),
    torchFixture('L009', 'S02', 'west', 6, 'weakTorch'),
    torchFixture('L010', 'S02', 'east', 12, 'weakTorch'),
    torchFixture('L011', 'P01', 'north', 10, 'dungeonTorch'),
    torchFixture('L012', 'P01', 'north', 42, 'dungeonTorch'),
    torchFixture('L013', 'P01', 'south', 12, 'weakTorch'),
    torchFixture('L014', 'P01', 'south', 40, 'weakTorch'),
    torchFixture('L015', 'Z01', 'north', 8, 'dungeonTorch'),
    torchFixture('L016', 'Z01', 'north', 20, 'dungeonTorch'),
    torchFixture('L017', 'W01', 'west', 8, 'weakTorch'),
    torchFixture('L018', 'W01', 'west', 28, 'weakTorch'),
    torchFixture('L019', 'W01', 'west', 44, 'weakTorch'),
    torchFixture('L020', 'E01', 'east', 8, 'weakTorch'),
    torchFixture('L021', 'E01', 'east', 28, 'weakTorch'),
    torchFixture('L022', 'E01', 'east', 44, 'weakTorch'),
    torchFixture('L023', 'W02', 'west', 9, 'weakTorch'),
    torchFixture('L024', 'E02', 'east', 9, 'weakTorch'),
    torchFixture('L025', 'B06', 'north', 3, 'weakTorch'),
    torchFixture('L026', 'B09', 'north', 3, 'weakTorch'),
    torchFixture('L027', 'B19', 'north', 4, 'dungeonTorch'),
    torchFixture('L028', 'B20', 'north', 4, 'dungeonTorch'),
  ],

  lights: [
    { id: 'SUN-DIR-01', kind: 'directional', color: 0xffd38a, intensity: 0.75, position: { x: -24, y: 34, z: -18 } },
    { id: 'SKY-AMB-01', kind: 'ambient', color: 0x9b8462, groundColor: 0x21170f, intensity: 0.52 },
  ],

  spawns: [
    { id: 'sumerian_city_block_player_start', kind: 'player', roomId: 'G01', position: { x: 50, y: 1.55, z: 4 }, yaw: 0, tags: ['start', 'city-gate'], userData: { note: 'Start just inside the south gate.' } },
    enemySpawn('E001', 'sheep_demon', 'sheep_demon', 'M01', 38, 34, ['market-patrol'], { encounter: 'market brute' }),
    enemySpawn('E002', 'neck_man', 'neck_man', 'E01', 82, 45, ['alley-patrol'], { encounter: 'east alley stalker' }),
    enemySpawn('E003', 'sheep_demon', 'sheep_demon', 'W01', 18, 48, ['alley-patrol'], { encounter: 'west alley guard' }),
    enemySpawn('E004', 'neck_man', 'neck_man', 'P01', 60, 71, ['plaza-patrol'], { encounter: 'temple plaza watcher' }),
    enemySpawn('E005', 'sheep_demon', 'sheep_demon', 'E02', 84, 75, ['guard-court'], { encounter: 'guard court heavy' }),
    enemySpawn('E006', 'neck_man', 'neck_man', 'B09', 90, 42, ['interior-ambush'], { encounter: 'bone washer ambush' }),
  ],

  exits: [
    {
      id: 'X01',
      fromLocation: 'sumerian-city-block-v0',
      toLocation: 'reliquary-field',
      roomId: 'G01',
      position: { x: 50, y: 1.2, z: 1 },
      triggerRect: { minX: 47, maxX: 53, minZ: 0, maxZ: 2.5 },
      destinationSpawnId: 'field_sumerian_city_block_v0_return',
      promptText: 'Tap INTERACT to return to Reliquary Field.',
      wallGaps: [wallGap('G01', 50, 0, 6)],
      tags: ['field-return', 'temporary-test-exit'],
      userData: { note: 'Temporary test return until city routing is formalized.' },
    },
  ],

  interactions: [],

  userData: {
    authoredBy: 'ChatGPT direct architecture pass',
    architecturePass: 'Sumerian City Block v0',
    contract: 'Dread Stone Black compiled-runtime rectangle definition',
    designIntent: 'Playable blockout town complex: gate, market, alleys, residential court, guard court, temple plaza, low ziggurat base, 24 building interiors.',
    futureTexturePlan: 'Texture profile keys are stable placeholders. Swap paths/colors to future 1024 artist textures without changing room/door/collision architecture.',
    buildingCount: 24,
    knownLimitations: [
      'Blocky rectangle runtime version; not final city geometry.',
      'Outdoor spaces use high ceilings because the current compiler is room/ceiling based.',
      'Ziggurat is a low blockout, not true stepped vertical traversal yet.',
      'Some locked/secret doors are tagged but do not have full gameplay interactions wired here.',
      'Future ziggurat-depths exit is intentionally not registered until that destination exists.',
    ],
  },
});
