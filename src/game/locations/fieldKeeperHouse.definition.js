const defaultFloorY = 0;
const defaultCeilingY = 3.0;

const textureProfiles = Object.freeze({
  wall: { path: './assets/textures/wall_black_stone_01.png', repeat: [3.2, 1.2], color: 0x706a60, roughness: 0.97, metalness: 0.0, emissive: 0x0f0c09, emissiveIntensity: 0.1 },
  floor: { path: './assets/textures/floor_worn_stone_01.png', repeat: [3.4, 3.4], color: 0x82796a, roughness: 0.98, metalness: 0.0, emissive: 0x15100c, emissiveIntensity: 0.12 },
  ceiling: { path: './assets/textures/ceiling_dark_stone_01.png', repeat: [3.2, 3.2], color: 0x625d56, roughness: 0.98, metalness: 0.0, emissive: 0x0f0e0d, emissiveIntensity: 0.09 },
  gate: { path: './assets/textures/metal_gate_rusted_01.png', repeat: [1, 1], color: 0x8d735d, roughness: 0.82, metalness: 0.35, emissive: 0x140c08, emissiveIntensity: 0.14 },
  mixedFloor: { path: './assets/textures/floor_worn_stone_01.png', repeat: [2.6, 2.6], color: 0x3e432c, roughness: 0.99, metalness: 0.0, emissive: 0x0d1008, emissiveIntensity: 0.1 },
  propStone: { path: './assets/textures/wall_black_stone_01.png', repeat: [1.4, 0.9], color: 0x6d6659, roughness: 0.97, metalness: 0.0, emissive: 0x0d0907, emissiveIntensity: 0.1 },
  offeringStone: { path: './assets/textures/wall_black_stone_01.png', repeat: [1.2, 0.9], color: 0x5a5044, roughness: 0.98, metalness: 0.0, emissive: 0x130b07, emissiveIntensity: 0.1 },
  rootDark: { path: './assets/textures/outdoor/field_dead_grass_01.png', repeat: [2.6, 2.0], color: 0x151a0d, roughness: 1.0, metalness: 0.0, emissive: 0x010301, emissiveIntensity: 0.08 },
  bonePale: { path: './assets/textures/floor_worn_stone_01.png', repeat: [1, 1], color: 0xa99c86, roughness: 0.94, metalness: 0.0, emissive: 0x18110c, emissiveIntensity: 0.06 },
});

function room({ id, label, minX, maxX, minZ, maxZ, floorTexture = 'floor', ceilingY = defaultCeilingY, tags = [], encounterWeight = 0.05, safeForSpawn = false, userData = {} }) {
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
    wallTexture: 'wall',
    ceilingTexture: 'ceiling',
    tags,
    encounterWeight,
    safeForSpawn,
    userData,
  };
}

function wallGap(roomId, x, z, width) {
  return { roomId, position: { x, y: 0, z }, width };
}

function connector(id, fromRoom, toRoom, x, z, width, wallGaps, notes = '') {
  return {
    id,
    fromRoom,
    toRoom,
    position: { x, y: 0, z },
    width,
    navWaypoint: { x, y: 0, z },
    wallGaps,
    tags: ['doorway'],
    userData: { notes },
  };
}

function blockerFromProp(id, type, x, z, width, depth, height, options = {}) {
  return {
    id,
    type,
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    height,
    blocksPlayer: options.blocksPlayer ?? true,
    blocksEnemies: options.blocksEnemies ?? true,
    blocksLineOfMovement: options.blocksLineOfMovement ?? true,
    tags: ['solid', ...(options.tags ?? [])],
    userData: options.userData ?? {},
  };
}

function prop(id, kind, roomId, x, y, z, width, height, depth, collisionRef, material = 'propStone', options = {}) {
  return {
    id,
    kind,
    roomId,
    position: { x, y, z },
    rotation: options.rotation ?? { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    dimensions: { width, height, depth },
    collisionRef,
    material,
    tags: ['compiled-prop', options.blockingMode ?? (collisionRef ? 'solid' : 'nonBlockingDecor')],
    userData: {
      blockingMode: options.blockingMode ?? (collisionRef ? 'solid' : 'nonBlockingDecor'),
      collisionPurpose: options.collisionPurpose ?? (collisionRef ? 'visible structural prop' : 'decorative non-blocking geometry'),
      ...(options.userData ?? {}),
    },
  };
}

function floorPatch(id, roomId, x, y, z, width, depth, material = 'rootDark') {
  return prop(id, 'floor_patch', roomId, x, y, z, width, 0.04, depth, null, material, { blockingMode: 'nonBlockingDecor' });
}

function torchFixture(id, roomId, wallSide, distanceAlongWall, profile = 'dungeonTorch', options = {}) {
  return {
    id,
    kind: 'torch',
    roomId,
    wallSide,
    distanceAlongWall,
    height: options.height ?? 1.65,
    insetFromCorner: options.insetFromCorner ?? 1.25,
    offsetFromWall: options.offsetFromWall ?? 0.16,
    profile,
    visualKind: 'procedural-sconce',
    flameKind: 'procedural-warm-flame',
    debug: { note: options.note ?? 'Field Keeper House wall-mounted torch fixture' },
  };
}

export const fieldKeeperHouseDefinition = Object.freeze({
  id: 'field-keeper-house',
  displayName: 'Field Keeper House',
  type: 'house',
  tags: ['interior', 'house', 'ruined-house', 'compiled-runtime', 'physical-structure-test'],
  notes: 'Compact ruined field house connected to Reliquary Field. Physical structure only for v0.1; no enemies or encounters.',
  fog: { color: 0x1d1a16, near: 8, far: 46 },
  lighting: { background: 0x0f0e0c },
  textures: textureProfiles,
  defaultFloorY,
  defaultCeilingY,
  geometry: {
    wallHeight: 3.0,
    wallThickness: 0.35,
    floorThickness: 0.18,
    ceilingThickness: 0.18,
    roomEdgePolicy: 'sealedUnlessDeclaredOpening',
  },
  integrity: {
    roomEdgePolicy: 'sealedUnlessDeclaredOpening',
    leakDetection: true,
    collisionTruth: {
      visibleStructuralPropsRequireCollisionOrNonBlockingMetadata: true,
      allowedInvisiblePurposes: ['safetyBoundary', 'worldBoundary', 'futureGate', 'debugOnly'],
    },
  },

  rooms: [
    room({ id: 'R01', label: 'Entry Mudroom', minX: -8, maxX: 4, minZ: -30, maxZ: -18, encounterWeight: 0.05, userData: { role: 'field entry / return room', landmark: 'low cracked threshold' } }),
    room({ id: 'R02', label: 'Main Hearth Room', minX: -18, maxX: 18, minZ: -18, maxZ: 2, encounterWeight: 0.15, userData: { role: 'central house room', landmark: 'hearth/chimney block' } }),
    room({ id: 'R03', label: 'Sleeping Alcove', minX: -22, maxX: -4, minZ: 2, maxZ: 16, encounterWeight: 0.1, userData: { role: 'west private room', landmark: 'stone bed slab' } }),
    room({ id: 'R04', label: 'Storage Room', minX: 4, maxX: 22, minZ: 2, maxZ: 16, encounterWeight: 0.1, userData: { role: 'east storage room', landmark: 'shelves/crates made from blocks' } }),
    room({ id: 'R05', label: 'Collapsed Back Room', minX: -16, maxX: 16, minZ: 16, maxZ: 30, encounterWeight: 0.05, userData: { role: 'ruined rear chamber / future hook', landmark: 'collapsed rear stones' } }),
    room({ id: 'R06', label: 'Cellar Stair', minX: 18, maxX: 24, minZ: -18, maxZ: -4, encounterWeight: 0.05, userData: { role: 'descent connector', landmark: 'dark cellar hatch/stair', constructionNote: 'Shifted to the east edge to keep structural floor slabs non-overlapping in the rectangular room compiler.' } }),
    room({ id: 'R07', label: 'Root Cellar', minX: 8, maxX: 24, minZ: -32, maxZ: -18, floorTexture: 'mixedFloor', ceilingY: 2.8, encounterWeight: 0.05, userData: { role: 'underfloor chamber', landmark: 'root shelves / dirt-dark floor' } }),
  ],

  doors: [
    connector('D02', 'R01', 'R02', 0, -18, 3.6, [wallGap('R01', 0, -18, 3.6), wallGap('R02', 0, -18, 3.6)], 'Mudroom to hearth'),
    connector('D03', 'R02', 'R03', -8, 2, 3.4, [wallGap('R02', -8, 2, 3.4), wallGap('R03', -8, 2, 3.4)], 'Hearth to sleeping alcove'),
    connector('D04', 'R02', 'R04', 8, 2, 3.4, [wallGap('R02', 8, 2, 3.4), wallGap('R04', 8, 2, 3.4)], 'Hearth to storage'),
    connector('D05', 'R02', 'R06', 18, -10, 3.4, [wallGap('R02', 18, -10, 3.4), wallGap('R06', 18, -10, 3.4)], 'Hearth to cellar stair'),
    connector('D06', 'R03', 'R05', -8, 16, 3.2, [wallGap('R03', -8, 16, 3.2), wallGap('R05', -8, 16, 3.2)], 'Sleeping alcove to collapsed rear'),
    connector('D07', 'R04', 'R05', 8, 16, 3.2, [wallGap('R04', 8, 16, 3.2), wallGap('R05', 8, 16, 3.2)], 'Storage to collapsed rear'),
    connector('D08', 'R06', 'R07', 21, -18, 3.2, [wallGap('R06', 21, -18, 3.2), wallGap('R07', 21, -18, 3.2)], 'Cellar stair to root cellar'),
  ],

  blockers: [
    blockerFromProp('BLK_HEARTH', 'hearth', -10, -8, 5, 2.2, 1.8),
    blockerFromProp('BLK_LOW_TABLE', 'table', 4, -7, 5, 2, 0.9, { tags: ['low-cover'] }),
    blockerFromProp('BLK_BED', 'bed', -16, 8, 7, 3, 0.9),
    blockerFromProp('BLK_STORAGE_A', 'shelf', 17, 6, 1.6, 7, 1.7),
    blockerFromProp('BLK_STORAGE_B', 'shelf', 13, 13, 8, 1.4, 1.4),
    blockerFromProp('BLK_COLLAPSE', 'futureGate', 0, 29, 14, 2.2, 2.0, { tags: ['futureGate'], userData: { purpose: 'futureGate', visibleSupport: 'PROP_COLLAPSE', blocksCollapsedRearWall: true } }),
    blockerFromProp('BLK_CELLAR_RAIL', 'cellar_rail', 23.2, -12, 1.2, 8, 1.2),
    blockerFromProp('BLK_ROOT_SHELF', 'root_shelf', 23.1, -25, 1.5, 8, 1.5),
  ],

  props: [
    prop('PROP_THRESHOLD', 'threshold_slab', 'R01', 0, 0.12, -29, 5, 0.24, 1.2, null, 'propStone', { blockingMode: 'nonBlockingDecor/low' }),
    prop('PROP_HEARTH', 'hearth', 'R02', -10, 0.9, -8, 5, 1.8, 2.2, 'BLK_HEARTH', 'offeringStone'),
    prop('PROP_LOW_TABLE', 'low_stone_table', 'R02', 4, 0.45, -7, 5, 0.9, 2, 'BLK_LOW_TABLE', 'propStone', { blockingMode: 'lowCover' }),
    prop('PROP_BED', 'stone_bed_slab', 'R03', -16, 0.45, 8, 7, 0.9, 3, 'BLK_BED', 'propStone'),
    prop('PROP_BED_MARK', 'cracked_pillow_stone', 'R03', -18, 0.85, 9.2, 2, 0.3, 1.2, null, 'bonePale', { blockingMode: 'nonBlockingDecor' }),
    prop('PROP_SHELF_A', 'storage_shelf', 'R04', 17, 0.85, 6, 1.6, 1.7, 7, 'BLK_STORAGE_A', 'propStone'),
    prop('PROP_SHELF_B', 'rear_storage_shelf', 'R04', 13, 0.7, 13, 8, 1.4, 1.4, 'BLK_STORAGE_B', 'propStone'),
    prop('PROP_COLLAPSE', 'collapsed_rear_stones', 'R05', 0, 1.0, 29, 14, 2.0, 2.2, 'BLK_COLLAPSE', 'wall', { blockingMode: 'futureGate', collisionPurpose: 'visible collapsed rear wall / future gate' }),
    prop('PROP_CRACKED_BACK_BEAM', 'fallen_beam_slab', 'R05', -6, 0.35, 22, 8, 0.7, 1.5, null, 'propStone', { blockingMode: 'nonBlockingDecor/low' }),
    prop('PROP_CELLAR_RAIL', 'cellar_stair_side_stone', 'R06', 23.2, 0.6, -12, 1.2, 1.2, 8, 'BLK_CELLAR_RAIL', 'propStone'),
    prop('PROP_CELLAR_HATCH', 'cellar_hatch_frame', 'R06', 21, 0.12, -17, 5, 0.24, 2, null, 'gate', { blockingMode: 'nonBlockingDecor' }),
    prop('PROP_ROOT_SHELF', 'root_cellar_shelf', 'R07', 23.1, 0.75, -25, 1.5, 1.5, 8, 'BLK_ROOT_SHELF', 'propStone'),
    prop('PROP_ROOT_JARS', 'small_jar_blocks', 'R07', 18, 0.35, -29, 5, 0.7, 1, null, 'bonePale', { blockingMode: 'nonBlockingDecor' }),
    floorPatch('PATCH_R07_DIRT', 'R07', 17, 0.035, -25, 11, 9, 'rootDark'),
  ],

  spawns: [
    { id: 'field_keeper_house_player_start', kind: 'player', position: { x: 0, y: 1.55, z: -27 }, yaw: 0, roomId: 'R01', tags: ['entry', 'playerStart'] },
    { id: 'field_keeper_house_return_threshold', kind: 'return', position: { x: 0, y: 1.2, z: -28.5 }, yaw: Math.PI, roomId: 'R01', tags: ['exit'] },
    { id: 'FKH_E01_FUTURE_CELLAR', kind: 'debug', species: 'sheep_demon', faction: 'none', position: { x: 15, y: 0, z: -24 }, yaw: 0, roomId: 'R07', allowedForInitialWave: false, allowedForRespawn: false, tags: ['inactive-marker', 'future'], userData: { activeMarker: false } },
  ],

  exits: [
    {
      id: 'field_keeper_house_exit_to_reliquary_field',
      fromLocation: 'field-keeper-house',
      toLocation: 'reliquary-field',
      triggerRect: { minX: -2.2, maxX: 2.2, minZ: -30.6, maxZ: -27.8 },
      position: { x: 0, y: 1.2, z: -30 },
      destinationSpawnId: 'field_keeper_house_return',
      promptText: 'Tap INTERACT to return to Reliquary Field.',
      roomId: 'R01',
      wallGaps: [wallGap('R01', 0, -30, 3.6)],
      tags: ['field-return'],
    },
  ],

  torchFixtures: [
    torchFixture('FKH-T01', 'R01', 'north', 2.0, 'dungeonTorch', { height: 1.65, note: 'Entry readability, offset west of D02.' }),
    torchFixture('FKH-T02', 'R02', 'east', 16.0, 'dungeonTorch', { height: 1.7, note: 'Main hearth room readability away from D05.' }),
    torchFixture('FKH-T03', 'R03', 'west', 4.0, 'weakTorch', { height: 1.6, note: 'Sleeping alcove mood light over the bed side.' }),
    torchFixture('FKH-T04', 'R04', 'east', 4.0, 'weakTorch', { height: 1.6, note: 'Storage readability along shelves.' }),
    torchFixture('FKH-T05', 'R06', 'west', 4.0, 'weakTorch', { height: 1.55, note: 'Cellar descent wall light, kept out of D08.' }),
  ],

  lights: [
    { id: 'fkh_ambient_hemi', kind: 'ambient', skyColor: 0x5d554a, groundColor: 0x090806, intensity: 0.46 },
    { id: 'fkh_hearth_room_warm_readability', kind: 'point', color: 0xb56f35, intensity: 0.75, distance: 10, decay: 1.5, position: { x: -7, y: 1.4, z: -8 }, roomId: 'R02' },
    { id: 'FKH-T06-root-cellar-cold-fill', kind: 'point', color: 0x7891a2, intensity: 0.72, distance: 9.5, decay: 1.45, position: { x: 16, y: 1.2, z: -25 }, roomId: 'R07', tags: ['special', 'coldCellarFill'], userData: { specialFixture: true, reason: 'Dim non-torch cold fill for root cellar navigation; no floating torch visual.' } },
  ],

  interactions: [
    { id: 'FKH_INT_HEARTH', type: 'inspect', target: { x: -10, y: 1.0, z: -8 }, range: 3.0, hint: 'Tap INTERACT to inspect the cold hearth.', message: 'The hearth is cold, but the stone around it is burned smooth.', roomId: 'R02' },
    { id: 'FKH_INT_BED', type: 'inspect', target: { x: -16, y: 1.0, z: 8 }, range: 3.0, hint: 'Tap INTERACT to inspect the bed slab.', message: 'The bed slab is too short for a man and too long for a child.', roomId: 'R03' },
    { id: 'FKH_INT_STORAGE', type: 'inspect', target: { x: 14, y: 1.0, z: 12 }, range: 3.0, hint: 'Tap INTERACT to inspect the storage shelf.', message: 'Old storage niches face the wall, as if hiding what they held.', roomId: 'R04' },
    { id: 'FKH_INT_COLLAPSE', type: 'inspect', target: { x: 0, y: 1.2, z: 28 }, range: 3.0, hint: 'Tap INTERACT to inspect the collapsed rear wall.', message: 'The rear stones have fallen inward. Something pressed from below.', roomId: 'R05' },
    { id: 'FKH_INT_CELLAR', type: 'inspect', target: { x: 21, y: 1.0, z: -17 }, range: 3.0, hint: 'Tap INTERACT to inspect the cellar hatch.', message: 'A cellar breathes through the floor.', roomId: 'R06' },
    { id: 'FKH_INT_ROOTS', type: 'inspect', target: { x: 18, y: 1.0, z: -26 }, range: 3.0, hint: 'Tap INTERACT to inspect the root cellar shelf.', message: 'The roots grew around the shelves, not through them.', roomId: 'R07' },
  ],

  encounterZones: [
    { id: 'FKH_ZONE_INTERIOR', label: 'interior traversal/debug grouping', roomIds: ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07'], center: { x: 2, y: 0, z: -3 }, radius: 40, weight: 0, maxActive: 0, allowedFactions: [], actionBubblePriority: 0, tags: ['no-combat'] },
  ],

  navigation: {
    roomGraph: {
      roomIds: ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07'],
      links: [
        { id: 'D02_NAV', fromRoom: 'R01', toRoom: 'R02', navWaypoint: { x: 0, y: 0, z: -18 } },
        { id: 'D03_NAV', fromRoom: 'R02', toRoom: 'R03', navWaypoint: { x: -8, y: 0, z: 2 } },
        { id: 'D04_NAV', fromRoom: 'R02', toRoom: 'R04', navWaypoint: { x: 8, y: 0, z: 2 } },
        { id: 'D05_NAV', fromRoom: 'R02', toRoom: 'R06', navWaypoint: { x: 18, y: 0, z: -10 } },
        { id: 'D06_NAV', fromRoom: 'R03', toRoom: 'R05', navWaypoint: { x: -8, y: 0, z: 16 } },
        { id: 'D07_NAV', fromRoom: 'R04', toRoom: 'R05', navWaypoint: { x: 8, y: 0, z: 16 } },
        { id: 'D08_NAV', fromRoom: 'R06', toRoom: 'R07', navWaypoint: { x: 21, y: 0, z: -18 } },
      ],
    },
    localAvoidanceHints: [
      { id: 'avoid-hearth', blockerId: 'BLK_HEARTH', padding: 0.8 },
      { id: 'avoid-cellar-rail', blockerId: 'BLK_CELLAR_RAIL', padding: 0.65 },
      { id: 'avoid-root-shelf', blockerId: 'BLK_ROOT_SHELF', padding: 0.65 },
    ],
    forbiddenZones: [
      { id: 'F01_COLLAPSED_REAR_BEHIND_BLOCK', minX: -5, maxX: 5, minZ: 30, maxZ: 34, purpose: 'futureGate' },
    ],
    preferredPatrolRoutes: [],
  },
});
