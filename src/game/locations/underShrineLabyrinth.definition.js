const textures = Object.freeze({
  wall: { path: './assets/textures/wall_black_stone_01.png', repeat: [2.2, 1.1], color: 0x403b35, roughness: 1 },
  floor: { path: './assets/textures/floor_worn_stone_01.png', repeat: [2.2, 2.8], color: 0x39342e, roughness: 1 },
  ceiling: { path: './assets/textures/ceiling_dark_stone_01.png', repeat: [2, 2], color: 0x302c28, roughness: 1 },
  dirt: { path: './assets/textures/outdoor/field_dead_grass_01.png', repeat: [1.8, 1.8], color: 0x51483b, roughness: 1 },
  root: { path: './assets/textures/growth/black_growth_cord_surface_01.png', repeat: [2.4, 1], color: 0x29231f, roughness: 0.95 },
  scab: { path: './assets/textures/growth/black_growth_scab_intact_01.png', repeat: [1.2, 1.2], color: 0x322c27, roughness: 0.9 },
  iron: { path: './assets/textures/metal_gate_rusted_01.png', repeat: [1.2, 1.2], roughness: 0.9, metalness: 0.35 },
  paleStone: { path: './assets/textures/pack1/stone_limestone_block_01.png', repeat: [1.8, 1.2], color: 0x8c918b, roughness: 0.94 },
  timber: { path: './assets/textures/pack1/wood_dark_aged_01.png', repeat: [1.4, 1.2], roughness: 1 },
});

const route = [
  ['USL01', 'Terminal Throat', -3, 3, -3, 13, 0, 2.15],
  ['USL02', 'First Turn', 3, 15, 7, 13, -0.28, 2.05],
  ['USL03', 'North Squeeze', 11, 15, -5, 7, -0.56, 1.82],
  ['USL04', 'Root Elbow', 15, 27, -5, 1, -0.84, 1.95],
  ['USL05', 'Buried Rise', 21, 27, 1, 13, -1.12, 1.9],
  ['USL06', 'Breathing Pocket', 27, 39, 7, 13, -1.4, 2.45],
  ['USL07', 'Stone Squeeze', 35, 39, -5, 7, -1.68, 1.76],
  ['USL08', 'Maintenance Bend', 39, 51, -5, 1, -1.96, 1.9],
  ['USL09', 'Final Coil', 45, 51, 1, 13, -2.24, 1.86],
  ['USL10', 'End Hatch Pocket', 51, 65, 7, 13, -2.52, 2.2],
];

const rooms = route.map(([id, label, minX, maxX, minZ, maxZ, floorY, headroom], index) => ({
  id, label, minX, maxX, minZ, maxZ, floorY, ceilingY: floorY + headroom,
  floorTexture: index % 3 === 1 ? 'dirt' : 'floor', wallTexture: 'wall', ceilingTexture: 'ceiling',
  safeForSpawn: index === 0 || index === route.length - 1, encounterWeight: 0,
  tags: ['under-shrine-labyrinth', 'claustrophobic', 'no-encounters', index === 2 || index === 6 ? 'tight-squeeze' : 'twisting-descent'],
}));

const connections = [
  ['USL01', 'USL02', 3, 10], ['USL02', 'USL03', 13, 7], ['USL03', 'USL04', 15, -2],
  ['USL04', 'USL05', 24, 1], ['USL05', 'USL06', 27, 10], ['USL06', 'USL07', 37, 7],
  ['USL07', 'USL08', 39, -2], ['USL08', 'USL09', 48, 1], ['USL09', 'USL10', 51, 10],
];

const doors = connections.map(([fromRoom, toRoom, x, z], index) => ({
  id: `under_shrine_labyrinth_bend_${index + 1}`, fromRoom, toRoom,
  position: { x, y: route[index + 1][6], z }, navWaypoint: { x, y: route[index + 1][6], z }, width: index === 1 || index === 5 ? 2.45 : 3.2,
  wallGaps: [{ roomId: fromRoom, position: { x, y: 0, z }, width: index === 1 || index === 5 ? 2.45 : 3.2 }, { roomId: toRoom, position: { x, y: 0, z }, width: index === 1 || index === 5 ? 2.45 : 3.2 }],
  tags: ['meaningful-bend', 'descending-connector'],
}));

const ramps = connections.map(([, , x, z], index) => {
  const fromCenter = { x: (route[index][2] + route[index][3]) * 0.5, z: (route[index][4] + route[index][5]) * 0.5 };
  const toCenter = { x: (route[index + 1][2] + route[index + 1][3]) * 0.5, z: (route[index + 1][4] + route[index + 1][5]) * 0.5 };
  const dx = Math.sign(toCenter.x - fromCenter.x);
  const dz = Math.sign(toCenter.z - fromCenter.z);
  return {
    id: `under_shrine_labyrinth_descent_${index + 1}`,
    from: [x - dx * 1.5, z - dz * 1.5],
    to: [x + dx * 1.5, z + dz * 1.5],
    width: index === 1 || index === 5 ? 2.35 : 3,
    y0: route[index][6], y1: route[index + 1][6], material: 'floor',
    tags: ['continuous-descent', 'mobile-safe-ramp'],
  };
});

const segmentCenters = [[0, 5], [9, 10], [13, 1], [21, -2], [24, 7], [33, 10], [37, 1], [45, -2], [48, 7], [58, 10]];
const props = segmentCenters.flatMap(([x, z], index) => {
  const floorY = route[index][6];
  const horizontal = index % 2 === 1;
  const width = index === 2 || index === 6 ? 3.25 : horizontal ? 6.2 : 5.2;
  return [
    { id: `under_shrine_labyrinth_root_band_${index + 1}`, roomId: route[index][0], position: { x, y: floorY + 0.12, z }, rotation: { x: 0, y: horizontal ? Math.PI / 2 : 0, z: 0 }, dimensions: { width, height: 0.16, depth: 0.42 }, material: 'root', tags: ['black-cord', 'route-pressure'] },
    { id: `under_shrine_labyrinth_timber_header_${index + 1}`, roomId: route[index][0], position: { x, y: floorY + route[index][7] - 0.18, z }, rotation: { x: 0, y: horizontal ? Math.PI / 2 : 0, z: 0 }, dimensions: { width, height: 0.24, depth: 0.34 }, material: 'timber', tags: ['maintenance-fragment', 'low-overhead'] },
  ];
});

props.push(
  { id: 'under_shrine_labyrinth_impossible_pressure_root', roomId: 'USL05', position: { x: 24, y: 0.25, z: 6.2 }, rotation: { x: 0.14, y: 0, z: -0.18 }, dimensions: { width: 5.5, height: 1.05, depth: 1.2 }, material: 'scab', tags: ['impossible-root-stone-pressure', 'visible-overhead-obstruction', 'non-blocking-decor'] },
  { id: 'under_shrine_labyrinth_impossible_pressure_stone', roomId: 'USL05', position: { x: 25.2, y: 0.48, z: 6.2 }, rotation: { x: 0, y: 0.16, z: 0.12 }, dimensions: { width: 3.4, height: 1.1, depth: 1.3 }, material: 'paleStone', tags: ['impossible-root-stone-pressure', 'crushing-mountain'] },
  { id: 'under_shrine_labyrinth_breathing_pocket_slab', roomId: 'USL06', position: { x: 32.5, y: -1.31, z: 10 }, dimensions: { width: 4.4, height: 0.18, depth: 3.5 }, material: 'paleStone', tags: ['breathing-pocket', 'rest-marker'] },
  { id: 'under_shrine_labyrinth_end_hatch', roomId: 'USL10', position: { x: 64.65, y: -1.45, z: 10 }, rotation: { x: 0, y: Math.PI / 2, z: 0 }, dimensions: { width: 3.8, height: 2.05, depth: 0.38 }, material: 'iron', collisionRef: 'under_shrine_labyrinth_end_hatch_blocker', tags: ['physical-end-hatch', 'chapter-3-lead-in-exit'], userData: { saveKey: 'under_shrine_labyrinth_end_hatch_open' } },
  { id: 'under_shrine_labyrinth_end_hatch_frame_left', roomId: 'USL10', position: { x: 64.42, y: -1.45, z: 7.92 }, dimensions: { width: 0.62, height: 2.4, depth: 0.52 }, material: 'paleStone', tags: ['end-hatch-frame', 'buried-threshold'] },
  { id: 'under_shrine_labyrinth_end_hatch_frame_right', roomId: 'USL10', position: { x: 64.42, y: -1.45, z: 12.08 }, dimensions: { width: 0.62, height: 2.4, depth: 0.52 }, material: 'paleStone', tags: ['end-hatch-frame', 'buried-threshold'] },
  { id: 'under_shrine_labyrinth_end_hatch_frame_lintel', roomId: 'USL10', position: { x: 64.42, y: -0.28, z: 10 }, dimensions: { width: 0.62, height: 0.34, depth: 4.7 }, material: 'paleStone', tags: ['end-hatch-frame', 'buried-threshold'] },
);

export const underShrineLabyrinthDefinition = Object.freeze({
  id: 'under-shrine-labyrinth', displayName: 'Under-Shrine Labyrinth', type: 'dungeon', version: 1,
  tags: ['compiled-runtime', 'authored-location', 'chapter-3-lead-in', 'pitch-black', 'no-enemies'],
  notes: 'A bounded, ten-segment spiral-like crawlspace descent from the Folsom shrine terminal to the backside of the impossible White-Scab threshold.',
  lighting: { background: 0x000000 }, fog: { color: 0x000000, near: 0.9, far: 7.5 }, textures, defaultFloorY: 0, defaultCeilingY: 2.1,
  geometry: { wallHeight: 2.1, wallThickness: 0.42, floorThickness: 0.22, ceilingThickness: 0.22, roomEdgePolicy: 'sealedUnlessDeclaredOpening' },
  rooms, doors, ramps,
  blockers: [{ id: 'under_shrine_labyrinth_end_hatch_blocker', type: 'gate', minX: 64.15, maxX: 64.95, minZ: 8.05, maxZ: 11.95, height: 2.2, blocksPlayer: true, blocksActors: true, tags: ['physical-end-hatch'], userData: { saveKey: 'under_shrine_labyrinth_end_hatch_open' } }],
  props,
  spawns: [{ id: 'under_shrine_labyrinth_shrine_terminal_arrival', kind: 'player', position: { x: 0, y: 1.55, z: 0 }, yaw: 0, roomId: 'USL01', tags: ['from-folsom-shrine', 'safe-spawn'] }],
  exits: [{ id: 'under_shrine_labyrinth_end_hatch_exit', fromLocation: 'under-shrine-labyrinth', toLocation: 'beneath-folsom', destinationSpawnId: 'beneath_folsom_white_scab_threshold_backside', position: { x: 65, y: -0.97, z: 10 }, triggerRect: { minX: 62.4, maxX: 64.8, minZ: 8.2, maxZ: 11.8 }, promptText: 'Force the buried end hatch', roomId: 'USL10', wallGaps: [{ roomId: 'USL10', position: { x: 65, y: -2.52, z: 10 }, width: 3.8 }], tags: ['interaction-controlled', 'backside-threshold-exit'] }],
  lights: [{ id: 'under_shrine_labyrinth_dark_ambient', kind: 'ambient', skyColor: 0x050606, groundColor: 0x000000, intensity: 0.018 }],
  interactions: [{ id: 'under_shrine_labyrinth_end_hatch', type: 'underShrineLabyrinthEndHatch', target: { x: 62.4, y: -0.95, z: 10 }, range: 3.2, hint: 'Buried end hatch', message: 'The end hatch tears inward.', roomId: 'USL10', destinationLocationId: 'beneath-folsom', destinationSpawnId: 'beneath_folsom_white_scab_threshold_backside', saveKey: 'under_shrine_labyrinth_end_hatch_open' }],
  navigation: { roomGraph: { roomIds: route.map(([id]) => id), links: doors.map((door) => ({ id: door.id, fromRoom: door.fromRoom, toRoom: door.toRoom, navWaypoint: door.navWaypoint })) }, localAvoidanceHints: [], forbiddenZones: [], preferredPatrolRoutes: [] },
  encounterZones: [],
});
