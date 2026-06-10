export const reliquaryFieldDefinition = Object.freeze({
  id: 'reliquary-field',
  displayName: 'Reliquary Field',
  type: 'field',
  tags: ['field', 'hub', 'partial-definition'],
  notes: [
    'Partial authoring definition only. The live field still uses DungeonScene outdoor field builders.',
    'This captures bounds, return spawns, and transition metadata so future field migration has stable ids.',
  ],
  fog: { color: 0x717a80, near: 38, far: 215 },
  lighting: { background: 0x64727d },
  textures: {
    fieldGrass: { path: './assets/textures/outdoor/field_dead_grass_01.png', repeat: [50, 50] },
    wall: { path: './assets/textures/wall_black_stone_01.png' },
    floor: { path: './assets/textures/floor_worn_stone_01.png' },
    gate: { path: './assets/textures/metal_gate_rusted_01.png' },
  },
  defaultFloorY: 0,
  rooms: [
    { id: 'FIELD01', label: 'Reliquary Field First Slice', minX: -197.5, maxX: 197.5, minZ: -197.5, maxZ: 197.5, tags: ['field-bounds'], safeForSpawn: true },
  ],
  spawns: [
    { id: 'field_player_start', kind: 'player', position: { x: 0, y: 1.55, z: -175 }, yaw: 0, roomId: 'FIELD01', tags: ['live'] },
    { id: 'field_south_reliquary_crypt_return', kind: 'return', position: { x: -60, y: 1.55, z: -112 }, yaw: 0, roomId: 'FIELD01', tags: ['live', 'south-reliquary-crypt'] },
    { id: 'field_black_grass_temple_return', kind: 'return', position: { x: -184, y: 1.55, z: 25 }, yaw: 0, roomId: 'FIELD01', tags: ['live', 'black-grass-temple'] },
  ],
  exits: [
    {
      id: 'field_enter_south_reliquary_crypt',
      fromLocation: 'reliquary-field',
      toLocation: 'south-reliquary-crypt',
      triggerRect: { minX: -65, maxX: -55, minZ: -111, maxZ: -103 },
      position: { x: -60, y: 1, z: -107 },
      destinationSpawnId: 'south_crypt_player_start',
      promptText: 'Tap INTERACT to enter the South Reliquary Crypt.',
      tags: ['live'],
    },
    {
      id: 'field_enter_black_grass_temple',
      fromLocation: 'reliquary-field',
      toLocation: 'black-grass-temple',
      triggerRect: { minX: -189, maxX: -179, minZ: 27, maxZ: 35 },
      position: { x: -184, y: 1, z: 31 },
      destinationSpawnId: 'bgt_player_start',
      promptText: 'Tap INTERACT to descend into Black Grass Temple.',
      tags: ['live', 'temporary-west-edge-c02'],
      userData: {
        intendedLongTermC02Position: { x: -210, y: 0, z: 55 },
      },
    },
  ],
});
