const textures = Object.freeze({
  limestoneFloor: { path: './assets/textures/pack1/floor_limestone_temple_01.png', repeat: [6, 6], color: 0xe6d7ad, roughness: 0.96, metalness: 0, emissive: 0x3c2a12, emissiveIntensity: 0.2, boxUvScale: [0.18, 0.18], polygonUvScale: [0.18, 0.18] },
  wornCivicFloor: { path: './assets/textures/pack1/floor_worn_stone_01.png', repeat: [5, 5], color: 0xd2bd88, roughness: 0.98, metalness: 0, emissive: 0x2d1f0e, emissiveIntensity: 0.18, boxUvScale: [0.16, 0.16], polygonUvScale: [0.16, 0.16] },
  sandstoneWall: { path: './assets/textures/pack1/wall_sandstone_ritual_01.png', repeat: [4, 1.6], color: 0xd7b978, roughness: 0.98, metalness: 0, emissive: 0x33200b, emissiveIntensity: 0.18, boxUvScale: [0.18, 0.2] },
  limestoneWall: { path: './assets/textures/pack1/stone_limestone_block_01.png', repeat: [4, 1.7], color: 0xe1d0a2, roughness: 0.97, metalness: 0, emissive: 0x332612, emissiveIntensity: 0.18, boxUvScale: [0.16, 0.18] },
  ritualWall: { path: './assets/textures/pack1/wall_ritual_stone_01.png', repeat: [3.6, 1.5], color: 0xd6b36f, roughness: 0.98, metalness: 0, emissive: 0x39230d, emissiveIntensity: 0.2, boxUvScale: [0.16, 0.18] },
  pyramidWall: { path: './assets/textures/pack1/wall_pyramid_face_01.png', repeat: [3.2, 1.4], color: 0xdcc38b, roughness: 0.97, metalness: 0, emissive: 0x38240c, emissiveIntensity: 0.2, boxUvScale: [0.16, 0.18] },
  ceilingPale: { path: './assets/textures/pack1/stone_limestone_block_01.png', repeat: [5, 5], color: 0xd9c898, roughness: 0.98, metalness: 0, emissive: 0x322410, emissiveIntensity: 0.18, boxUvScale: [0.16, 0.16] },
  ceilingCoffer: { path: './assets/textures/pack1/wall_pyramid_face_01.png', repeat: [4, 4], color: 0xcaae73, roughness: 0.98, metalness: 0, emissive: 0x2d1d0b, emissiveIntensity: 0.16, boxUvScale: [0.15, 0.15] },
  bronze: { path: './assets/textures/pack1/metal_bronze_ritual_01.png', repeat: [1.4, 1.1], color: 0xc58b44, roughness: 0.76, metalness: 0.35, emissive: 0x3a1c06, emissiveIntensity: 0.24, boxUvScale: [0.22, 0.22] },
  wood: { path: './assets/textures/pack1/wood_dark_aged_01.png', repeat: [2, 1], color: 0x7b4a22, roughness: 0.9, metalness: 0, emissive: 0x160905, emissiveIntensity: 0.1, boxUvScale: [0.26, 0.18] },
  warningSumerian: { path: './assets/textures/pack1/panel_sumerian_warning_01.png', repeat: [1, 1], color: 0xf0cf82, roughness: 0.9, metalness: 0, emissive: 0x5a360d, emissiveIntensity: 0.36 },
  warningHieroglyphA: { path: './assets/textures/pack1/panel_hieroglyph_warning_01.png', repeat: [1, 1], color: 0xf2d18a, roughness: 0.9, metalness: 0, emissive: 0x5a360d, emissiveIntensity: 0.36 },
  warningHieroglyphB: { path: './assets/textures/pack1/panel_hieroglyph_warning_02.png', repeat: [1, 1], color: 0xecc77d, roughness: 0.9, metalness: 0, emissive: 0x57320c, emissiveIntensity: 0.34 },
  celestialMap: { path: './assets/textures/pack1/panel_celestial_map_01.png', repeat: [1, 1], color: 0xd8c99b, roughness: 0.88, metalness: 0, emissive: 0x1b3d59, emissiveIntensity: 0.38 },
  priesthoodRite: { path: './assets/textures/pack1/panel_priesthood_rite_01.png', repeat: [1, 1], color: 0xe4c78a, roughness: 0.9, metalness: 0, emissive: 0x4c2b0c, emissiveIntensity: 0.32 },
  astralGateway: { path: './assets/textures/pack1/panel_astral_gateway_warning_01.png', repeat: [1, 1], color: 0xd7c7a0, roughness: 0.88, metalness: 0, emissive: 0x1b4c5c, emissiveIntensity: 0.42 },
  extradimensionalThreat: { path: './assets/textures/pack1/panel_extradimensional_threat_01.png', repeat: [1, 1], color: 0xe7bd78, roughness: 0.9, metalness: 0, emissive: 0x643012, emissiveIntensity: 0.44 },
  watcherFace: { path: './assets/textures/pack1/panel_watcher_face_01.png', repeat: [1, 1], color: 0xe7cd94, roughness: 0.9, metalness: 0, emissive: 0x4c2a13, emissiveIntensity: 0.4 },
  turquoiseWater: { color: 0x38b9bd, roughness: 0.42, metalness: 0, emissive: 0x1e7f87, emissiveIntensity: 0.72 },
  turquoiseGlow: { color: 0x31c6c2, roughness: 0.65, metalness: 0, emissive: 0x20a9a4, emissiveIntensity: 0.56 },
});

function room({
  id,
  label,
  minX,
  maxX,
  minZ,
  maxZ,
  ceilingY,
  floorTexture = 'limestoneFloor',
  wallTexture = 'limestoneWall',
  ceilingTexture = 'ceilingPale',
  tags = [],
  encounterWeight = 0,
}) {
  return {
    id,
    label,
    minX,
    maxX,
    minZ,
    maxZ,
    floorY: 0,
    ceilingY,
    floorTexture: { texture: floorTexture },
    wallTexture,
    ceilingTexture,
    wallGeometry: true,
    visibleGeometry: true,
    safeForSpawn: true,
    encounterWeight,
    tags: ['kerovac-main-route', ...tags],
  };
}

function wallGap(roomId, x, z, width) {
  return { roomId, position: { x, y: 0, z }, width };
}

function door(id, fromRoom, toRoom, x, z, width, tags = []) {
  return {
    id,
    fromRoom,
    toRoom,
    position: { x, y: 0, z },
    navWaypoint: { x, y: 0, z },
    width,
    kind: 'sacredArchway',
    wallGaps: [wallGap(fromRoom, x, z, width), wallGap(toRoom, x, z, width)],
    tags: ['wide-archway', 'main-route', ...tags],
  };
}

function panelWall(id, roomId, from, to, material) {
  return { id, from, to, y: 0, height: 5.6, thickness: 0.18, material, roomId, tags: ['panel-backing', 'intentional-gap'] };
}

function wallPanel(id, wallSegmentId, material, t = 0.5, width = 2.2, height = 3.2) {
  return { id, kind: 'wallPanel', wallSegmentId, t, y: 1.1, width, height, thickness: 0.08, offset: 0.16, material, blocksPlayer: false, tags: ['readable-warning-panel'] };
}

function pillar(id, roomId, x, z, height, radius = 0.48, material = 'limestoneWall') {
  return { id, kind: 'pillar', position: [x, 0, z], radius, height, sides: 12, material, roomId, tags: ['visible-column'] };
}

function sunstone(id, roomId, x, y, z, intensity = 1.35, distance = 24) {
  return { id, kind: 'point', color: 0xffc875, intensity, distance, decay: 1.35, position: { x, y, z }, roomId };
}

function expoStair(id, kind, x, z, overrides = {}) {
  return {
    id,
    kind,
    position: [x, 0, z],
    yaw: overrides.yaw ?? 0,
    width: overrides.width ?? 2.4,
    height: overrides.height ?? 1.2,
    length: overrides.length ?? 4.2,
    stepCount: overrides.stepCount ?? 6,
    treadMaterial: overrides.treadMaterial ?? 'limestoneFloor',
    riserMaterial: overrides.riserMaterial ?? 'limestoneWall',
    sideMaterial: overrides.sideMaterial ?? 'ritualWall',
    trimMaterial: overrides.trimMaterial ?? 'bronze',
    railingMaterial: overrides.railingMaterial ?? 'bronze',
    railings: overrides.railings ?? false,
    missingSteps: overrides.missingSteps ?? [],
    roomId: 'K03',
    tags: ['geometry-expo-center', 'darb-staircase-preview', kind, ...(overrides.tags ?? [])],
    userData: {
      purpose: 'Permanent Kerovac Geometry Expo Center swappable preview zone. For future DARB primitive batches, remove this batch of preview objects and insert the new batch here rather than creating a separate debug location.',
      displayChamber: 'K03 Civic Reliquary Court',
      basePlacedOnCityFloor: true,
      authoredAsLocationDefinitionData: true,
      ...(overrides.userData ?? {}),
    },
  };
}

export const kerovacDefinition = Object.freeze({
  id: 'kerovac',
  displayName: 'Kerovac',
  type: 'interior-city',
  tags: ['generated', 'compiled-runtime', 'darb-v2', 'darb-v2.3', 'kerovac', 'bright-interior-city', 'sacred-sun-city'],
  notes: 'Bright first-pass interior sacred city test: simple rectangular chambers, explicit floors and ceilings, clear route, visible canal edges, high warm fill lighting, and the permanent Kerovac Geometry Expo Center in the early Civic Reliquary Court for swappable DARB primitive previews.',
  fog: { color: 0xd9c69a, near: 72, far: 185 },
  lighting: { background: 0xc7b583 },
  textures,
  defaultFloorY: 0,
  defaultCeilingY: 9,
  geometry: { wallHeight: 8.8, wallThickness: 0.42, floorThickness: 0.2, ceilingThickness: 0.24 },
  collision: { playerRadius: 0.5 },
  runtimeSpawnPolicy: {
    activeEnemyCap: 1,
    initialEnemyCap: 1,
    wakeRadius: 18,
    sleepRadius: 34,
    respawnCooldownMs: 0,
    maxWakePerSecond: 1,
    generatedAiLod: true,
  },
  integrity: {
    roomEdgePolicy: 'sealedUnlessDeclaredOpening',
    leakSampleStep: 1,
    collisionTruth: { visibleStructuralPropsRequireCollisionOrNonBlockingMetadata: true },
  },

  rooms: [
    room({ id: 'K01', label: 'Sun-Sealed Threshold', minX: -12, maxX: 12, minZ: -44, maxZ: -26, ceilingY: 8, wallTexture: 'sandstoneWall', tags: ['entry', 'threshold'] }),
    room({ id: 'K02', label: 'Alabaster Processional Avenue', minX: -10, maxX: 10, minZ: -26, maxZ: 2, ceilingY: 9, wallTexture: 'limestoneWall', tags: ['avenue', 'processional'] }),
    room({ id: 'K03', label: 'Civic Reliquary Court', minX: -22, maxX: 22, minZ: 2, maxZ: 32, ceilingY: 10.5, wallTexture: 'ritualWall', tags: ['civic-court', 'reliquary'] }),
    room({ id: 'K04', label: 'Turquoise Canal Hall', minX: -20, maxX: 20, minZ: 32, maxZ: 58, ceilingY: 9.2, wallTexture: 'limestoneWall', tags: ['canal', 'bridges'] }),
    room({ id: 'K05', label: 'Market of Solar Warnings', minX: -24, maxX: 24, minZ: 58, maxZ: 88, ceilingY: 9.4, floorTexture: 'wornCivicFloor', wallTexture: 'sandstoneWall', tags: ['market', 'warning-panels'] }),
    room({ id: 'K06', label: 'High Sun Temple Approach', minX: -18, maxX: 18, minZ: 88, maxZ: 114, ceilingY: 10.2, wallTexture: 'pyramidWall', tags: ['stairs', 'temple-approach'] }),
    room({ id: 'K07', label: 'Priest-King Vestibule', minX: -20, maxX: 20, minZ: 114, maxZ: 138, ceilingY: 10.4, wallTexture: 'ritualWall', tags: ['vestibule', 'bronze-turquoise'] }),
    room({ id: 'K08', label: 'Radiant Warning Sanctum', minX: -24, maxX: 24, minZ: 138, maxZ: 168, ceilingY: 11, wallTexture: 'pyramidWall', ceilingTexture: 'ceilingCoffer', tags: ['sanctum', 'final-warning'] }),
  ],

  doors: [
    door('K_D01_threshold_to_avenue', 'K01', 'K02', 0, -26, 7.0),
    door('K_D02_avenue_to_court', 'K02', 'K03', 0, 2, 7.2),
    door('K_D03_court_to_canal', 'K03', 'K04', 0, 32, 7.4),
    door('K_D04_canal_to_market', 'K04', 'K05', 0, 58, 7.0),
    door('K_D05_market_to_approach', 'K05', 'K06', 0, 88, 7.0),
    door('K_D06_approach_to_vestibule', 'K06', 'K07', 0, 114, 7.4),
    door('K_D07_vestibule_to_sanctum', 'K07', 'K08', 0, 138, 7.8),
  ],

  wallSegments: [
    panelWall('K_PANEL_WALL_early_southwest', 'K01', [-10.8, -33.5], [-10.8, -28.5], 'sandstoneWall'),
    panelWall('K_PANEL_WALL_early_southeast', 'K02', [9.8, -17], [9.8, -9], 'limestoneWall'),
    panelWall('K_PANEL_WALL_court_west', 'K03', [-21.8, 9], [-21.8, 20], 'ritualWall'),
    panelWall('K_PANEL_WALL_market_east', 'K05', [23.8, 64], [23.8, 78], 'sandstoneWall'),
    panelWall('K_PANEL_WALL_vestibule_west', 'K07', [-19.8, 121], [-19.8, 132], 'ritualWall'),
    panelWall('K_PANEL_WALL_sanctum_north', 'K08', [-12, 167.8], [12, 167.8], 'pyramidWall'),
  ],

  architecturalPrimitives: [
    { id: 'K_entry_bronze_sun_disk', kind: 'stela', position: [0, 0, -42.8], yaw: 0, width: 3.4, height: 3.2, thickness: 0.22, material: 'bronze', blocksPlayer: false, roomId: 'K01', tags: ['bronze-sun-disk'] },
    { id: 'K_entry_left_warning_stela', kind: 'stela', position: [-6.8, 0, -35.2], yaw: 0.12, width: 1.5, height: 3.1, thickness: 0.28, material: 'warningSumerian', roomId: 'K01', tags: ['early-warning'] },
    { id: 'K_entry_right_hieroglyph_stela', kind: 'stela', position: [6.8, 0, -35.2], yaw: -0.12, width: 1.5, height: 3.1, thickness: 0.28, material: 'warningHieroglyphA', roomId: 'K01', tags: ['early-warning'] },
    wallPanel('K_panel_threshold_sumerian', 'K_PANEL_WALL_early_southwest', 'warningSumerian', 0.5, 2.0, 3.0),
    wallPanel('K_panel_avenue_hieroglyph', 'K_PANEL_WALL_early_southeast', 'warningHieroglyphB', 0.5, 2.0, 3.0),
    wallPanel('K_panel_court_celestial_map', 'K_PANEL_WALL_court_west', 'celestialMap', 0.5, 2.5, 3.3),
    wallPanel('K_panel_market_priesthood_rite', 'K_PANEL_WALL_market_east', 'priesthoodRite', 0.36, 2.2, 3.2),
    wallPanel('K_panel_market_astral_warning', 'K_PANEL_WALL_market_east', 'astralGateway', 0.72, 2.2, 3.2),
    wallPanel('K_panel_vestibule_threat', 'K_PANEL_WALL_vestibule_west', 'extradimensionalThreat', 0.5, 2.4, 3.4),
    wallPanel('K_panel_sanctum_watcher', 'K_PANEL_WALL_sanctum_north', 'watcherFace', 0.32, 2.7, 3.6),
    wallPanel('K_panel_sanctum_extradimensional', 'K_PANEL_WALL_sanctum_north', 'extradimensionalThreat', 0.68, 2.7, 3.6),

    pillar('K_avenue_pillar_w1', 'K02', -7.2, -18, 7.2),
    pillar('K_avenue_pillar_e1', 'K02', 7.2, -18, 7.2),
    pillar('K_avenue_pillar_w2', 'K02', -7.2, -6, 7.4),
    pillar('K_avenue_pillar_e2', 'K02', 7.2, -6, 7.4),
    pillar('K_court_pillar_sw', 'K03', -16, 8, 8.8, 0.58, 'ritualWall'),
    pillar('K_court_pillar_se', 'K03', 16, 8, 8.8, 0.58, 'ritualWall'),
    pillar('K_court_pillar_nw', 'K03', -16, 26, 9.2, 0.58, 'ritualWall'),
    pillar('K_court_pillar_ne', 'K03', 16, 26, 9.2, 0.58, 'ritualWall'),
    { id: 'K_court_central_sunstone_altar', kind: 'altar', position: [0, 0, 17], yaw: 0, width: 4.6, depth: 3.2, height: 1.2, material: 'limestoneWall', topMaterial: 'bronze', roomId: 'K03', tags: ['central-sunstone', 'visible-blocker'] },

    // Permanent Kerovac Geometry Expo Center: this early civic-court chamber is the swappable preview zone for DARB primitive batches.
    // When a future primitive batch needs a display, retire the previous expo preview objects here and replace them in this chamber.
    expoStair('K_expo_straight_stair', 'straightStair', -17, 8, { width: 2.2, height: 1.0, length: 4.0, stepCount: 5, yaw: Math.PI / 2 }),
    expoStair('K_expo_wide_sacred_stair', 'wideSacredStair', -10, 8, { width: 4.2, height: 1.25, length: 4.4, stepCount: 6, yaw: Math.PI / 2, railings: true, treadMaterial: 'wornCivicFloor' }),
    expoStair('K_expo_narrow_crypt_stair', 'narrowCryptStair', 10, 8, { width: 1.35, height: 1.05, length: 4.0, stepCount: 7, yaw: -Math.PI / 2, treadMaterial: 'wornCivicFloor', riserMaterial: 'sandstoneWall' }),
    expoStair('K_expo_broken_stair', 'brokenStair', 17, 8, { width: 2.3, height: 1.15, length: 4.1, stepCount: 6, yaw: -Math.PI / 2, missingSteps: [1, 4], sideMaterial: 'sandstoneWall', userData: { missingStepVariation: 'Two authored gaps demonstrate optional broken-step variation.' } }),
    expoStair('K_expo_sunken_steps', 'sunkenSteps', -17, 17, { width: 2.4, height: 0.75, length: 3.6, stepCount: 5, yaw: Math.PI / 2, treadMaterial: 'wornCivicFloor' }),
    expoStair('K_expo_dais_stair', 'daisStair', -10, 25, { width: 3.0, height: 1.15, length: 3.8, stepCount: 5, yaw: Math.PI / 2, railings: true, trimMaterial: 'bronze' }),
    expoStair('K_expo_split_stair', 'splitStair', 10, 25, { width: 4.0, height: 1.2, length: 4.4, stepCount: 6, yaw: -Math.PI / 2, sideMaterial: 'limestoneWall' }),
    expoStair('K_expo_bridge_stair', 'bridgeStair', 17, 17, { width: 2.4, height: 1.0, length: 4.5, stepCount: 6, yaw: -Math.PI / 2, railings: true, treadMaterial: 'bronze', riserMaterial: 'limestoneWall' }),
    expoStair('K_expo_corner_stair', 'cornerStair', -17, 25, { width: 2.4, height: 1.0, length: 3.5, stepCount: 5, yaw: Math.PI / 2, trimMaterial: 'bronze' }),
    expoStair('K_expo_processional_stair', 'processionalStair', 17, 25, { width: 4.6, height: 1.4, length: 4.8, stepCount: 7, yaw: -Math.PI / 2, railings: true, treadMaterial: 'limestoneFloor', riserMaterial: 'ritualWall' }),

    { id: 'K_canal_water_trench', kind: 'canalWater', from: [-18, 45], to: [18, 45], width: 5.2, y: 0.035, height: 0.035, material: 'turquoiseWater', emissiveColor: 0x2fb8b7, roomId: 'K04', tags: ['visible-water-boundary'] },
    { id: 'K_canal_south_curb_west', kind: 'curb', from: [-18, 42.1], to: [-4.1, 42.1], y: 0.04, height: 0.28, thickness: 0.2, material: 'limestoneWall', blocksPlayer: false, roomId: 'K04' },
    { id: 'K_canal_south_curb_east', kind: 'curb', from: [4.1, 42.1], to: [18, 42.1], y: 0.04, height: 0.28, thickness: 0.2, material: 'limestoneWall', blocksPlayer: false, roomId: 'K04' },
    { id: 'K_canal_north_curb_west', kind: 'curb', from: [-18, 47.9], to: [-4.1, 47.9], y: 0.04, height: 0.28, thickness: 0.2, material: 'limestoneWall', blocksPlayer: false, roomId: 'K04' },
    { id: 'K_canal_north_curb_east', kind: 'curb', from: [4.1, 47.9], to: [18, 47.9], y: 0.04, height: 0.28, thickness: 0.2, material: 'limestoneWall', blocksPlayer: false, roomId: 'K04' },
    { id: 'K_canal_bridge_rail_w', kind: 'railing', from: [-3.25, 38], to: [-3.25, 52], height: 0.8, thickness: 0.12, postSpacing: 1.4, material: 'bronze', blocksPlayer: false, roomId: 'K04' },
    { id: 'K_canal_bridge_rail_e', kind: 'railing', from: [3.25, 38], to: [3.25, 52], height: 0.8, thickness: 0.12, postSpacing: 1.4, material: 'bronze', blocksPlayer: false, roomId: 'K04' },

    { id: 'K_market_stall_w1', kind: 'lowWall', from: [-19, 67], to: [-10, 67], height: 1.05, thickness: 0.28, material: 'wood', blocksPlayer: true, roomId: 'K05', tags: ['visible-market-stall'] },
    { id: 'K_market_stall_w2', kind: 'lowWall', from: [-20, 78], to: [-11, 78], height: 1.05, thickness: 0.28, material: 'wood', blocksPlayer: true, roomId: 'K05', tags: ['visible-market-stall'] },
    { id: 'K_market_stall_e1', kind: 'lowWall', from: [10, 68], to: [19, 68], height: 1.05, thickness: 0.28, material: 'wood', blocksPlayer: true, roomId: 'K05', tags: ['visible-market-stall'] },
    { id: 'K_market_stall_e2', kind: 'lowWall', from: [11, 80], to: [20, 80], height: 1.05, thickness: 0.28, material: 'wood', blocksPlayer: true, roomId: 'K05', tags: ['visible-market-stall'] },

    { id: 'K_approach_left_bronze_obelisk', kind: 'obelisk', position: [-12.5, 0, 104], height: 4.8, baseWidth: 1.0, material: 'bronze', roomId: 'K06' },
    { id: 'K_approach_right_bronze_obelisk', kind: 'obelisk', position: [12.5, 0, 104], height: 4.8, baseWidth: 1.0, material: 'bronze', roomId: 'K06' },
    { id: 'K_vestibule_priest_altar', kind: 'altar', position: [0, 0, 127], yaw: 0, width: 3.4, depth: 2.2, height: 1.05, material: 'ritualWall', topMaterial: 'bronze', roomId: 'K07', tags: ['visible-blocker', 'route-centerpiece'] },
    { id: 'K_sanctum_radiant_tablet', kind: 'stela', position: [0, 0, 160], yaw: Math.PI, width: 3.2, height: 4.2, thickness: 0.34, material: 'astralGateway', roomId: 'K08', tags: ['final-warning-tablet'] },

    { id: 'K_threshold_coffered_ceiling_band', kind: 'ceilingSlab', position: [0, 7.72, -35], yaw: 0, width: 18, depth: 5.5, thickness: 0.22, material: 'ceilingCoffer', roomId: 'K01', blocksPlayer: false },
    { id: 'K_court_coffered_ceiling_cross', kind: 'ceilingSlab', position: [0, 10.16, 17], yaw: 0, width: 30, depth: 6, thickness: 0.24, material: 'ceilingCoffer', roomId: 'K03', blocksPlayer: false },
    { id: 'K_sanctum_coffered_ceiling_panel', kind: 'ceilingSlab', position: [0, 10.7, 153], yaw: 0, width: 34, depth: 16, thickness: 0.28, material: 'ceilingCoffer', roomId: 'K08', blocksPlayer: false },
  ],

  stairs: [
    { id: 'K_high_sun_broad_stairs', from: [0, 92], to: [0, 106], width: 11.0, y0: 0, y1: 0.45, steps: 7, material: 'limestoneFloor', tags: ['broad-visible-stairs', 'main-route'] },
  ],

  bridges: [
    { id: 'K_turquoise_canal_main_bridge', from: [0, 38], to: [0, 52], width: 6.0, y: 0.34, thickness: 0.28, material: 'bronze', railing: false, tags: ['wide-visible-bridge', 'main-route'] },
  ],

  blockers: [
    { id: 'K_canal_water_blocker_west', type: 'hazard', minX: -18.8, maxX: -3.6, minZ: 42.1, maxZ: 47.9, height: 0.2, blocksPlayer: true, blocksEnemies: true, blocksLineOfMovement: false, tags: ['canal', 'water-boundary'], userData: { visualStructureId: 'K_canal_water_trench', visibleBoundary: 'curbs and turquoise water trench' } },
    { id: 'K_canal_water_blocker_east', type: 'hazard', minX: 3.6, maxX: 18.8, minZ: 42.1, maxZ: 47.9, height: 0.2, blocksPlayer: true, blocksEnemies: true, blocksLineOfMovement: false, tags: ['canal', 'water-boundary'], userData: { visualStructureId: 'K_canal_water_trench', visibleBoundary: 'curbs and turquoise water trench' } },
  ],

  props: [],
  spawns: [
    { id: 'kerovac_player_start', kind: 'player', position: { x: 0, y: 1.55, z: -38 }, yaw: 0, roomId: 'K01', tags: ['entry', 'playerStart'] },
    { id: 'kerovac_return_threshold', kind: 'return', position: { x: 0, y: 1.2, z: -42 }, yaw: Math.PI, roomId: 'K01', tags: ['exit', 'allow-near-wall'] },
    { id: 'kerovac_solar_guardian_01', kind: 'enemy', species: 'neck_man', faction: 'kerovac_solar_remnant', position: { x: 14, y: 0, z: 72 }, yaw: -0.6, roomId: 'K05', allowedForInitialWave: true, allowedForRespawn: false, tags: ['minimal-test-enemy', 'open-room'] },
    { id: 'kerovac_solar_guardian_02', kind: 'enemy', species: 'sheep_demon', faction: 'kerovac_solar_remnant', position: { x: -13, y: 0, z: 124 }, yaw: 0.5, roomId: 'K07', allowedForInitialWave: false, allowedForRespawn: false, tags: ['minimal-test-enemy', 'open-room'] },
  ],

  exits: [
    {
      id: 'kerovac_exit_to_reliquary_field',
      fromLocation: 'kerovac',
      toLocation: 'reliquary-field',
      triggerRect: { minX: -3.5, maxX: 3.5, minZ: -44, maxZ: -41 },
      position: { x: 0, y: 1.2, z: -42.5 },
      destinationSpawnId: 'field_kerovac_return',
      promptText: 'Return to Reliquary Field',
      roomId: 'K01',
      wallGaps: [wallGap('K01', 0, -44, 7.0)],
      tags: ['field-return', 'kerovac'],
    },
  ],

  lights: [
    { id: 'K_ambient_warm_sun_city_fill', kind: 'ambient', skyColor: 0xffe5b0, groundColor: 0xb8965f, intensity: 1.52 },
    { id: 'K_overhead_bounce_directional', kind: 'directional', color: 0xffd08a, intensity: 1.08, position: { x: -20, y: 34, z: -28 } },
    sunstone('K_light_threshold_sun_disk', 'K01', 0, 4.2, -39, 1.35, 24),
    sunstone('K_light_avenue_overhead', 'K02', 0, 6.2, -12, 1.05, 28),
    sunstone('K_light_court_sunstone', 'K03', 0, 5.3, 17, 1.55, 34),
    { id: 'K_light_canal_turquoise_fill', kind: 'point', color: 0x57d2cb, intensity: 1.0, distance: 30, decay: 1.45, position: { x: 0, y: 2.2, z: 45 }, roomId: 'K04' },
    sunstone('K_light_market_warning_lamps', 'K05', 0, 5.6, 72, 1.18, 32),
    sunstone('K_light_temple_stairs', 'K06', 0, 6.6, 103, 1.28, 30),
    { id: 'K_light_vestibule_turquoise_gold', kind: 'point', color: 0x76d8c7, intensity: 0.85, distance: 24, decay: 1.5, position: { x: 0, y: 4.2, z: 126 }, roomId: 'K07' },
    sunstone('K_light_sanctum_radiant_center', 'K08', 0, 6.4, 153, 1.7, 40),
    { id: 'K_light_sanctum_panel_readability', kind: 'point', color: 0xffb56a, intensity: 1.0, distance: 20, decay: 1.5, position: { x: 0, y: 4.4, z: 164 }, roomId: 'K08' },
  ],

  navigation: {
    roomGraph: {
      roomIds: ['K01', 'K02', 'K03', 'K04', 'K05', 'K06', 'K07', 'K08'],
      links: [
        { id: 'K_NAV_01', fromRoom: 'K01', toRoom: 'K02', navWaypoint: { x: 0, y: 0, z: -26 } },
        { id: 'K_NAV_02', fromRoom: 'K02', toRoom: 'K03', navWaypoint: { x: 0, y: 0, z: 2 } },
        { id: 'K_NAV_03', fromRoom: 'K03', toRoom: 'K04', navWaypoint: { x: 0, y: 0, z: 32 } },
        { id: 'K_NAV_04', fromRoom: 'K04', toRoom: 'K05', navWaypoint: { x: 0, y: 0, z: 58 } },
        { id: 'K_NAV_05', fromRoom: 'K05', toRoom: 'K06', navWaypoint: { x: 0, y: 0, z: 88 } },
        { id: 'K_NAV_06', fromRoom: 'K06', toRoom: 'K07', navWaypoint: { x: 0, y: 0, z: 114 } },
        { id: 'K_NAV_07', fromRoom: 'K07', toRoom: 'K08', navWaypoint: { x: 0, y: 0, z: 138 } },
      ],
    },
    forbiddenZones: [{ id: 'K_NAV_AVOID_CANAL_WATER', minX: -19, maxX: 19, minZ: 42, maxZ: 48, tags: ['canal-water'] }],
    localAvoidanceHints: [],
    preferredPatrolRoutes: [],
  },

  encounterZones: [
    { id: 'K_ENCOUNTER_MARKET_LOW_PRESSURE', label: 'Market warning patrol test', roomIds: ['K05'], center: { x: 0, y: 0, z: 72 }, radius: 18, maxThreat: 1, tags: ['minimal', 'geometry-test'] },
  ],
});
