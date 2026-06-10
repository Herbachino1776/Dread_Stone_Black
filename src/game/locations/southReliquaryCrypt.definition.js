export const southReliquaryCryptDefinition = Object.freeze({
  id: 'south-reliquary-crypt',
  displayName: 'South Reliquary Crypt',
  type: 'crypt',
  objectivePackId: 'south-reliquary-crypt-partial-foundation',
  tags: ['interior', 'baby-labyrinth', 'partial-definition'],
  notes: [
    'Partial authoring definition only. The live South Reliquary Crypt still uses DungeonScene baby labyrinth code.',
    'Future migration should move BABY_LABYRINTH_WALL_SEGMENTS, walkable rectangles, props, gate, shortcut, and reliquary interactions here.',
  ],
  fog: { color: 0x2b241d, near: 9, far: 42 },
  lighting: { background: 0x171311 },
  textures: {
    wall: { path: './assets/textures/wall_black_stone_01.png' },
    floor: { path: './assets/textures/floor_worn_stone_01.png' },
    ceiling: { path: './assets/textures/ceiling_dark_stone_01.png' },
    gate: { path: './assets/textures/metal_gate_rusted_01.png' },
  },
  defaultFloorY: 0,
  defaultCeilingY: 3.2,
  rooms: [
    { id: 'R01', label: 'Entry Corridor', minX: -4, maxX: 4, minZ: -34, maxZ: -16, safeForSpawn: true, tags: ['known-walkable'] },
    { id: 'R02', label: 'Split Hall', minX: -11, maxX: 11, minZ: -18, maxZ: -6, safeForSpawn: true, tags: ['known-walkable'] },
    { id: 'R05', label: 'Guardian Chamber', minX: -15, maxX: 15, minZ: 2, maxZ: 26, safeForSpawn: true, tags: ['known-walkable'] },
    { id: 'R06', label: 'Reliquary Alcove', minX: -7, maxX: 7, minZ: 25, maxZ: 35, safeForSpawn: false, tags: ['known-walkable'] },
  ],
  blockers: [
    { id: 'GATE01', type: 'gate', minX: 10.72, maxX: 11.28, minZ: -10.85, maxZ: -5.15, height: 2.7, blocksPlayer: true, blocksEnemies: true, blocksLineOfMovement: true, tags: ['live-hand-coded'] },
    { id: 'RELIC01', type: 'altar', minX: -2.5, maxX: 2.5, minZ: 31, maxZ: 33, height: 1.5, blocksPlayer: true, blocksEnemies: true, blocksLineOfMovement: true, tags: ['live-hand-coded'] },
  ],
  spawns: [
    { id: 'south_crypt_player_start', kind: 'player', position: { x: 0, y: 1.55, z: -30 }, yaw: 0, roomId: 'R01', tags: ['live'] },
    { id: 'south_crypt_field_exit', kind: 'return', position: { x: 0, y: 1.2, z: -32 }, yaw: Math.PI, roomId: 'R01', tags: ['live'] },
    { id: 'south_crypt_ram_man_npc', kind: 'npc', species: 'ram_man', position: { x: 0, y: 0, z: 14 }, yaw: 0, roomId: 'R05', tags: ['live', 'friendly'] },
  ],
  exits: [
    {
      id: 'south_crypt_exit_to_field',
      fromLocation: 'south-reliquary-crypt',
      toLocation: 'reliquary-field',
      triggerRect: { minX: -3, maxX: 3, minZ: -34, maxZ: -30 },
      position: { x: 0, y: 1.2, z: -32 },
      destinationSpawnId: 'field_south_reliquary_crypt_return',
      promptText: 'Tap INTERACT to climb back to the tomb-field.',
      tags: ['live'],
    },
  ],
  interactions: [
    { id: 'INT02', target: { x: -22, y: 1.2, z: -14 }, range: 3, message: 'The slab is carved with a door that was never meant to open.' },
    { id: 'INT03', target: { x: 11, y: 1.2, z: -8 }, range: 3.1, message: 'The rusted grate gives a little, then holds.' },
    { id: 'INT04', target: { x: 0, y: 1.2, z: 32 }, range: 3.2, message: 'Something black sleeps inside the stone.' },
  ],
});
