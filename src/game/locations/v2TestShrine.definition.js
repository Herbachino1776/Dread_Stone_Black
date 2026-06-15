const textures = Object.freeze({
  wall: { path: './assets/textures/wall_black_stone_01.png', repeat: [2.2, 1.1], color: 0x7a6651, roughness: 0.96, metalness: 0, emissive: 0x120b06, emissiveIntensity: 0.08 },
  floor: { path: './assets/textures/floor_worn_stone_01.png', repeat: [2.8, 2.8], color: 0x9a8d76, roughness: 0.98, metalness: 0, emissive: 0x15100b, emissiveIntensity: 0.06 },
  altar: { path: './assets/textures/wall_black_stone_01.png', repeat: [1, 1], color: 0x403832, roughness: 0.98, metalness: 0, emissive: 0x090604, emissiveIntensity: 0.05 },
});

const shrinePoints = Object.freeze([
  [-6, -5],
  [5, -5],
  [7, -2],
  [5, 5],
  [-4, 6],
  [-7, 1],
]);

function prop(id, kind, roomId, x, y, z, width, height, depth, collisionRef, material = 'altar') {
  return {
    id,
    kind,
    roomId,
    position: { x, y, z },
    dimensions: { width, height, depth },
    collisionRef,
    material,
    tags: ['compiled-prop', collisionRef ? 'solid' : 'nonBlockingDecor'],
    userData: { blockingMode: collisionRef ? 'solid' : 'nonBlockingDecor' },
  };
}

export const v2TestShrineDefinition = Object.freeze({
  id: 'v2-test-shrine',
  displayName: 'V2 Test Shrine',
  type: 'shrine',
  tags: ['interior', 'compiled-runtime', 'v2-polygon-authoring-test'],
  notes: 'Small proof location for Dungeon Authoring Runtime v2 polygon floors, explicit wall segments, door gaps, and wall prop anchors.',
  fog: { color: 0x18120d, near: 8, far: 44 },
  lighting: { background: 0x100c09 },
  textures,
  defaultFloorY: 0,
  defaultCeilingY: 4,
  geometry: { wallHeight: 4, wallThickness: 0.35, floorThickness: 0.18, ceilingThickness: 0.18 },

  rooms: [
    {
      id: 'v2_test_shrine',
      label: 'Irregular six-sided shrine chamber',
      minX: -7.2,
      maxX: 7.2,
      minZ: -5.2,
      maxZ: 6.2,
      floorY: 0,
      ceilingY: 4,
      visibleGeometry: false,
      wallGeometry: false,
      safeForSpawn: true,
      encounterWeight: 0,
      tags: ['v2-polygon-bounds', 'connector'],
      integrity: { edgePolicy: 'connector' },
      userData: { navCenter: { x: 0, y: 0, z: 0 }, note: 'Legacy bounds retained for spawn/navigation compatibility; visible floor and walls come from v2 primitives.' },
    },
  ],

  polygonFloors: [
    { id: 'v2_test_shrine_floor', points: shrinePoints, y: 0, material: 'floor', roomId: 'v2_test_shrine' },
  ],

  wallSegments: [
    { id: 'v2_test_shrine_wall_south', from: [-6, -5], to: [5, -5], y: 0, height: 4, thickness: 0.35, material: 'wall', roomId: 'v2_test_shrine' },
    { id: 'v2_test_shrine_wall_southeast', from: [5, -5], to: [7, -2], y: 0, height: 4, thickness: 0.35, material: 'wall', roomId: 'v2_test_shrine' },
    { id: 'v2_test_shrine_wall_east', from: [7, -2], to: [5, 5], y: 0, height: 4, thickness: 0.35, material: 'wall', roomId: 'v2_test_shrine' },
    { id: 'v2_test_shrine_wall_north', from: [5, 5], to: [-4, 6], y: 0, height: 4, thickness: 0.35, material: 'wall', roomId: 'v2_test_shrine' },
    { id: 'v2_test_shrine_wall_northwest', from: [-4, 6], to: [-7, 1], y: 0, height: 4, thickness: 0.35, material: 'wall', roomId: 'v2_test_shrine' },
    { id: 'v2_test_shrine_wall_west', from: [-7, 1], to: [-6, -5], y: 0, height: 4, thickness: 0.35, material: 'wall', roomId: 'v2_test_shrine' },
  ],

  doorGaps: [
    { id: 'v2_test_shrine_entry_gap', wallSegmentId: 'v2_test_shrine_wall_south', centerT: 0.5, width: 2.2 },
  ],

  wallPropAnchors: [
    { id: 'v2_test_shrine_torch_left', wallSegmentId: 'v2_test_shrine_wall_northwest', t: 0.45, height: 2.15, offset: 0.16, kind: 'torchFixture', roomId: 'v2_test_shrine' },
  ],

  blockers: [
    { id: 'v2_test_shrine_altar_blocker', type: 'altar', minX: -1.05, maxX: 1.05, minZ: -0.7, maxZ: 0.7, height: 1.0, tags: ['solid', 'altar'] },
  ],

  props: [prop('v2_test_shrine_center_altar', 'altar', 'v2_test_shrine', 0, 0.5, 0, 2.1, 1, 1.4, 'v2_test_shrine_altar_blocker')],

  spawns: [
    { id: 'v2_test_shrine_player_start', kind: 'player', position: { x: 0, y: 1.55, z: -3.4 }, yaw: 0, roomId: 'v2_test_shrine', tags: ['entry', 'playerStart'] },
    { id: 'v2_test_shrine_return_threshold', kind: 'return', position: { x: 0, y: 1.2, z: -4.7 }, yaw: Math.PI, roomId: 'v2_test_shrine', tags: ['exit', 'allow-near-wall'] },
  ],

  exits: [
    {
      id: 'v2_test_shrine_exit_to_reliquary_field',
      fromLocation: 'v2-test-shrine',
      toLocation: 'reliquary-field',
      triggerRect: { minX: -1.3, maxX: 1.3, minZ: -5.4, maxZ: -4.15 },
      position: { x: 0, y: 1.2, z: -4.8 },
      destinationSpawnId: 'field_v2_test_shrine_return',
      promptText: 'Tap INTERACT to return to Reliquary Field.',
      roomId: 'v2_test_shrine',
      wallGaps: [{ roomId: 'v2_test_shrine', position: { x: 0, y: 0, z: -5.2 }, width: 2.2 }],
      tags: ['field-return', 'v2-test'],
    },
  ],

  lights: [
    { id: 'v2_test_shrine_ambient', kind: 'ambient', skyColor: 0x4a3827, groundColor: 0x080504, intensity: 0.42 },
    { id: 'v2_test_shrine_altar_glow', kind: 'point', color: 0xd18a4a, intensity: 0.85, distance: 8, decay: 1.5, position: { x: 0, y: 1.1, z: 0 }, roomId: 'v2_test_shrine' },
  ],

  navigation: { roomGraph: { roomIds: ['v2_test_shrine'], links: [] }, localAvoidanceHints: [], forbiddenZones: [], preferredPatrolRoutes: [] },
  encounterZones: [],
});
