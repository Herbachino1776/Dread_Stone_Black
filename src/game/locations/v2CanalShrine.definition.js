const textures = Object.freeze({
  wall: { path: './assets/textures/wall_black_stone_01.png', repeat: [2.5, 1.2], color: 0x6f604b, roughness: 0.98, metalness: 0, emissive: 0x100b06, emissiveIntensity: 0.08 },
  floor: { path: './assets/textures/floor_worn_stone_01.png', repeat: [3, 3], color: 0x8f836f, roughness: 0.98, metalness: 0, emissive: 0x15100b, emissiveIntensity: 0.06 },
  temple: { path: './assets/textures/floor_worn_stone_01.png', repeat: [2, 2], color: 0xa49272, roughness: 0.97, metalness: 0, emissive: 0x1a1208, emissiveIntensity: 0.08 },
  wood: { path: './assets/textures/wall_black_stone_01.png', repeat: [1.5, 1], color: 0x5a3520, roughness: 0.92, metalness: 0, emissive: 0x0b0502, emissiveIntensity: 0.05 },
});

const courtyard = Object.freeze([[-12, -9], [10, -9], [14, -2], [9, 9], [-7, 10], [-14, 2]]);

export const v2CanalShrineDefinition = Object.freeze({
  id: 'v2-canal-shrine',
  displayName: 'V2 Canal Shrine',
  type: 'shrine',
  tags: ['interior', 'compiled-runtime', 'v2.1-authoring-test'],
  notes: 'Proof location for DARB v2.1 path ribbons, raised platforms, ramps/stairs, bridges, and debug overlay metadata.',
  fog: { color: 0x17110c, near: 10, far: 52 },
  lighting: { background: 0x0d0a08 },
  textures,
  defaultFloorY: 0,
  defaultCeilingY: 4.2,
  geometry: { wallHeight: 4.2, wallThickness: 0.35, floorThickness: 0.18, ceilingThickness: 0.18 },
  rooms: [{
    id: 'v2_canal_shrine_courtyard', label: 'Irregular canal shrine courtyard', minX: -15, maxX: 15, minZ: -10, maxZ: 11,
    floorY: 0, ceilingY: 4.2, visibleGeometry: false, wallGeometry: false, safeForSpawn: true, encounterWeight: 0,
    tags: ['v2-polygon-bounds', 'connector'], integrity: { edgePolicy: 'connector' },
    userData: { navCenter: { x: 0, y: 0, z: 0 }, note: 'Visible architecture comes from v2.1 primitives.' },
  }],
  polygonFloors: [{ id: 'canal_shrine_courtyard_floor', points: courtyard, y: 0, material: 'floor', roomId: 'v2_canal_shrine_courtyard' }],
  pathRibbons: [{ id: 'canal_shrine_causeway', points: [[-11, -6], [-5, -3], [0, -4], [5, -1], [10, 3]], width: 3.2, y: 0.025, material: 'floor', tags: ['street', 'main-path'] }],
  platforms: [{ id: 'canal_shrine_raised_plinth', footprint: [[-4, 2], [5, 2], [6, 7], [-5, 8]], y: 0, height: 1.1, material: 'wall', topMaterial: 'temple', tags: ['raised', 'temple'] }],
  ramps: [{ id: 'canal_shrine_plinth_ramp', from: [0, 0.7], to: [0.4, 2.6], width: 2.8, y0: 0, y1: 1.1, material: 'temple' }],
  stairs: [{ id: 'canal_shrine_front_steps', from: [-2.8, 0.6], to: [-2.5, 2.3], width: 1.8, y0: 0, y1: 1.1, steps: 5, material: 'wall' }],
  bridges: [{ id: 'canal_shrine_bridge', from: [-11, 1.5], to: [-5.5, 1.5], width: 2.5, y: 0.35, thickness: 0.25, material: 'wood', railing: true }],
  wallSegments: [
    { id: 'canal_shrine_wall_south', from: [-12, -9], to: [10, -9], y: 0, height: 4.2, thickness: 0.35, material: 'wall', roomId: 'v2_canal_shrine_courtyard' },
    { id: 'canal_shrine_wall_east_low', from: [10, -9], to: [14, -2], y: 0, height: 4.2, thickness: 0.35, material: 'wall', roomId: 'v2_canal_shrine_courtyard' },
    { id: 'canal_shrine_wall_east_high', from: [14, -2], to: [9, 9], y: 0, height: 4.2, thickness: 0.35, material: 'wall', roomId: 'v2_canal_shrine_courtyard' },
    { id: 'canal_shrine_wall_north', from: [9, 9], to: [-7, 10], y: 0, height: 4.2, thickness: 0.35, material: 'wall', roomId: 'v2_canal_shrine_courtyard' },
    { id: 'canal_shrine_wall_west_high', from: [-7, 10], to: [-14, 2], y: 0, height: 4.2, thickness: 0.35, material: 'wall', roomId: 'v2_canal_shrine_courtyard' },
    { id: 'canal_shrine_wall_west_low', from: [-14, 2], to: [-12, -9], y: 0, height: 4.2, thickness: 0.35, material: 'wall', roomId: 'v2_canal_shrine_courtyard' },
  ],
  doorGaps: [{ id: 'canal_shrine_entry_gap', wallSegmentId: 'canal_shrine_wall_south', centerT: 0.48, width: 2.8 }],
  wallPropAnchors: [{ id: 'canal_shrine_wall_torch', wallSegmentId: 'canal_shrine_wall_east_high', t: 0.42, height: 2.2, offset: 0.16, kind: 'torchFixture', roomId: 'v2_canal_shrine_courtyard' }],
  blockers: [
    { id: 'canal_void_south', type: 'canal', minX: -12.5, maxX: -4.2, minZ: -0.1, maxZ: 0.35, height: 0.2, blocksPlayer: true, blocksEnemies: true, blocksLineOfMovement: false, tags: ['water', 'canal', 'v2-blocker', 'invisible'], invisible: true, purpose: 'canal water boundary' },
    { id: 'canal_void_north', type: 'canal', minX: -12.5, maxX: -4.2, minZ: 2.65, maxZ: 3.1, height: 0.2, blocksPlayer: true, blocksEnemies: true, blocksLineOfMovement: false, tags: ['water', 'canal', 'v2-blocker', 'invisible'], invisible: true, purpose: 'canal water boundary' },
  ],
  props: [],
  spawns: [
    { id: 'v2_canal_shrine_player_start', kind: 'player', position: { x: 0, y: 1.55, z: -6.6 }, yaw: 0, roomId: 'v2_canal_shrine_courtyard', tags: ['entry', 'playerStart'] },
    { id: 'v2_canal_shrine_return_threshold', kind: 'return', position: { x: 0, y: 1.2, z: -8.2 }, yaw: Math.PI, roomId: 'v2_canal_shrine_courtyard', tags: ['exit', 'allow-near-wall'] },
  ],
  exits: [{ id: 'v2_canal_shrine_exit_to_reliquary_field', fromLocation: 'v2-canal-shrine', toLocation: 'reliquary-field', triggerRect: { minX: -1.6, maxX: 1.6, minZ: -9.4, maxZ: -8.0 }, position: { x: 0, y: 1.2, z: -8.6 }, destinationSpawnId: 'field_v2_test_shrine_return', promptText: 'Tap INTERACT to return to Reliquary Field.', roomId: 'v2_canal_shrine_courtyard', wallGaps: [{ roomId: 'v2_canal_shrine_courtyard', position: { x: -0.8, y: 0, z: -9 }, width: 3.2 }], tags: ['field-return', 'v2.1-test'] }],
  lights: [
    { id: 'v2_canal_shrine_ambient', kind: 'ambient', skyColor: 0x4c3a29, groundColor: 0x080504, intensity: 0.44 },
    { id: 'v2_canal_shrine_plinth_glow', kind: 'point', color: 0xd79a58, intensity: 0.9, distance: 9, decay: 1.5, position: { x: 0, y: 1.8, z: 5 }, roomId: 'v2_canal_shrine_courtyard' },
  ],
  navigation: { roomGraph: { roomIds: ['v2_canal_shrine_courtyard'], links: [] }, localAvoidanceHints: [], forbiddenZones: [], preferredPatrolRoutes: [] },
  encounterZones: [],
});
