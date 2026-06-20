import { outdoorTextureProfiles } from './outdoorTextureProfiles.js';

const textures = Object.freeze({
  ...outdoorTextureProfiles,
  forestGround: { ...outdoorTextureProfiles.grassMatted, repeat: [28, 28], color: 0xb9b68f, emissive: 0x2b2d20, emissiveIntensity: 0.12 },
  mudTrail: { ...outdoorTextureProfiles.mudWetDark, repeat: [18, 3], color: 0x6b5136, emissive: 0x1b1209, emissiveIntensity: 0.06, worldTileLength: 8, worldTileWidth: 3 },
  mudShore: { ...outdoorTextureProfiles.mudChurnedWet, repeat: [14, 14], color: 0x6f553b, emissive: 0x1d1108, emissiveIntensity: 0.07 },
  pondWater: { color: 0x2d7f92, roughness: 0.5, metalness: 0.0, transparent: true, opacity: 0.78, emissive: 0x0b4858, emissiveIntensity: 0.34 },
  rockWall: { path: './assets/textures/wall_black_stone_01.png', repeat: [2.5, 1.5], color: 0x5d5a51, roughness: 0.98, metalness: 0.0, emissive: 0x151311, emissiveIntensity: 0.1 },
  stoneOutcrop: { path: './assets/textures/wall_black_stone_01.png', repeat: [1.4, 1.2], color: 0x747066, roughness: 0.99, metalness: 0.0, emissive: 0x171410, emissiveIntensity: 0.08 },
  darkRoot: { path: './assets/textures/outdoor/field_dead_grass_01.png', repeat: [2.0, 1.0], color: 0x321b12, roughness: 1.0, metalness: 0.0, emissive: 0x0b0503, emissiveIntensity: 0.06 },
});

export const oarbFeatureYardDefinition = Object.freeze({
  id: 'oarbFeatureYard',
  displayName: 'OARB Feature Yard',
  type: 'field',
  tags: ['temporary', 'oarb', 'feature-yard', 'compiled-runtime', 'outdoor-proving-patch'],
  notes: [
    'Temporary removable OARB systems proving yard; not part of Kerovac.',
    'Delete this definition plus the single oarb_feature_yard_gate hook in Reliquary Field to remove the yard.',
  ],
  fog: { color: 0xb7b08a, near: 70, far: 245 },
  lighting: { background: 0x9aa37d },
  textures,
  defaultFloorY: 0,
  terrain: {
    size: [190, 190],
    segments: [72, 72],
    baseY: 0,
    material: 'forestGround',
    heightStamps: [
      { id: 'oarb_yard_spawn_landing_pad', kind: 'flatten', center: [0, -74], radius: 18, y: 0.15 },
      { id: 'oarb_yard_low_hill', kind: 'hill', center: [-42, -18], radius: 32, height: 3.2 },
      { id: 'oarb_yard_shallow_hollow', kind: 'hollow', center: [44, 10], radius: 30, depth: 1.8 },
      { id: 'oarb_yard_training_pond_bowl', kind: 'hollow', center: [50, 16], radius: 22, depth: 1.35 },
      { id: 'oarb_yard_training_pond_shore_flatten', kind: 'flatten', center: [50, 16], radius: 16, y: -0.62 },
      { id: 'oarb_yard_small_ridge', kind: 'ridge', path: [[-72, 38], [-32, 54], [18, 46]], width: 18, height: 2.8 },
      { id: 'oarb_yard_shallow_ravine', kind: 'ravine', path: [[38, -54], [54, -12], [32, 34]], width: 14, depth: 1.9 },
    ],
  },
  rooms: [
    { id: 'oarb_feature_yard_bounds', label: 'Temporary OARB Feature Yard Bounds', minX: -94, maxX: 94, minZ: -94, maxZ: 94, floorY: 0, ceilingY: 18, visibleGeometry: false, wallGeometry: false, safeForSpawn: true, tags: ['field-bounds', 'oarb'] },
  ],
  splineTrails: [
    { id: 'oarb_yard_test_trail', points: [[0, -76], [-30, -48], [-48, -12], [-22, 24], [22, 46], [58, 20]], width: 5.4, material: 'mudTrail', flatten: true, tags: ['terrain-following', 'temporary'] },
    { id: 'oarb_yard_pond_approach_trail', points: [[0, -74], [18, -48], [34, -18], [46, 4], [42, 28]], width: 4.4, material: 'mudTrail', flatten: true, tags: ['terrain-following', 'pond-cue'] },
  ],
  waterBodies: [
    { id: 'oarb_training_pond', kind: 'pond', center: [50, 16], radius: [13, 9], y: -0.54, material: 'pondWater', fishable: true, fishableRadius: 17, shoreMaterial: 'mudShore', shoreWidth: 4.2, tags: ['fishable', 'oarb-proving-ground'] },
  ],
  outdoorChests: [
    { id: 'oarb_training_pond_fishing_rod_chest', label: 'Fishing Rod Chest', position: { x: 35, y: -0.46, z: 27 }, itemId: 'fishing_rod', acquiredMessage: 'Fishing Rod Acquired.', tags: ['fishing', 'pond-cue'] },
  ],
  outdoorPrimitives: [
    { id: 'oarb_yard_cliff_wall_visible', kind: 'cliffWall', points: [[-80, 24], [-62, 52], [-18, 66], [24, 58]], height: 7.5, thickness: 3.2, material: 'rockWall', tags: ['visible-boundary', 'paired-blocker'] },
    { id: 'oarb_yard_root_wall_visible', kind: 'rootWall', points: [[-78, -50], [-58, -28], [-38, -8], [-30, 18]], height: 4.2, thickness: 2.8, material: 'darkRoot', tags: ['visible-boundary', 'paired-blocker'] },
    { id: 'oarb_yard_fallen_tree_visible', kind: 'fallenTreeBarrier', from: [20, -60], to: [58, -44], radius: 1.9, material: 'darkRoot', tags: ['visible-boundary', 'paired-blocker'] },
    { id: 'oarb_yard_boulder_cluster_visible', kind: 'boulderCluster', center: [58, 54], radius: 7.5, material: 'stoneOutcrop', tags: ['visible-boundary', 'paired-blocker'] },
    { id: 'oarb_yard_pond_stones_visible', kind: 'boulderCluster', center: [36, 16], radius: 3.2, material: 'stoneOutcrop', tags: ['pond-cue', 'shoreline'] },
  ],
  curvedBlockers: [
    { id: 'oarb_yard_cliff_blocker', kind: 'cliff', points: [[-80, 24], [-62, 52], [-18, 66], [24, 58]], thickness: 4.2, visibleStructureId: 'oarb_yard_cliff_wall_visible', tags: ['paired-visible-boundary'] },
    { id: 'oarb_yard_root_wall_blocker', kind: 'spline', points: [[-78, -50], [-58, -28], [-38, -8], [-30, 18]], thickness: 3.4, visibleStructureId: 'oarb_yard_root_wall_visible', tags: ['paired-visible-boundary'] },
    { id: 'oarb_yard_fallen_tree_blocker', kind: 'capsule', from: [20, -60], to: [58, -44], radius: 2.2, visibleStructureId: 'oarb_yard_fallen_tree_visible', tags: ['paired-visible-boundary'] },
    { id: 'oarb_yard_boulder_cluster_blocker', kind: 'circle', center: [58, 54], radius: 8.2, visibleStructureId: 'oarb_yard_boulder_cluster_visible', tags: ['paired-visible-boundary'] },
  ],
  spawns: [
    { id: 'oarb_feature_yard_player_start', kind: 'player', position: { x: 0, y: 1.55, z: -74 }, yaw: 0, roomId: 'oarb_feature_yard_bounds', tags: ['entry', 'temporary', 'reliquary-field'] },
    { id: 'oarb_feature_yard_return_spawn', kind: 'return', position: { x: 0, y: 1.55, z: -82 }, yaw: Math.PI, roomId: 'oarb_feature_yard_bounds', tags: ['return-gate', 'temporary'] },
  ],
  exits: [
    {
      id: 'oarb_feature_yard_return_gate',
      fromLocation: 'oarbFeatureYard',
      toLocation: 'reliquary-field',
      triggerRect: { minX: -5, maxX: 5, minZ: -88, maxZ: -80 },
      position: { x: 0, y: 1.1, z: -84 },
      destinationSpawnId: 'field_oarb_feature_yard_return',
      promptText: 'Tap INTERACT to return to Reliquary Field.',
      roomId: 'oarb_feature_yard_bounds',
      tags: ['temporary', 'field-return', 'oarb-feature-yard'],
      userData: { temporary: true, removalNote: 'Return gate belongs to the temporary OARB Feature Yard definition.' },
    },
  ],
  lights: [
    { id: 'oarb_feature_yard_ambient', kind: 'ambient', skyColor: 0xded49d, groundColor: 0x4c4a32, intensity: 0.62 },
    { id: 'oarb_feature_yard_spawn_marker_light', kind: 'point', color: 0xffd58a, intensity: 0.55, distance: 20, decay: 1.5, position: { x: 0, y: 3, z: -80 }, roomId: 'oarb_feature_yard_bounds' },
  ],
  navigation: { roomGraph: { roomIds: ['oarb_feature_yard_bounds'], links: [] }, localAvoidanceHints: [], forbiddenZones: [], preferredPatrolRoutes: [] },
  encounterZones: [],
});
