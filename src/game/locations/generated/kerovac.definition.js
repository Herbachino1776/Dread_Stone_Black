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

  pack2SandstoneWorn: { path: './assets/textures/pack2/column_sandstone_worn_01.png', repeat: [3, 2], color: 0xd0ae76, roughness: 0.96, metalness: 0, emissive: 0x2f1e0d, emissiveIntensity: 0.16, boxUvScale: [0.2, 0.2], cylinderUvScale: [0.32, 0.18] },
  pack2LimestoneCarved: { path: './assets/textures/pack2/column_limestone_carved_01.png', repeat: [3, 2], color: 0xdfd0a5, roughness: 0.95, metalness: 0, emissive: 0x302613, emissiveIntensity: 0.18, boxUvScale: [0.18, 0.2], cylinderUvScale: [0.3, 0.18] },
  pack2BlackBasaltGlyph: { path: './assets/textures/pack2/column_black_basalt_glyph_01.png', repeat: [2.4, 1.8], color: 0x3c3837, roughness: 0.9, metalness: 0, emissive: 0x100f17, emissiveIntensity: 0.24, boxUvScale: [0.18, 0.18], cylinderUvScale: [0.28, 0.17] },
  pack2BronzeTurquoiseBand: { path: './assets/textures/pack2/column_bronze_turquoise_band_01.png', repeat: [1.8, 1.2], color: 0xb98a55, roughness: 0.72, metalness: 0.42, emissive: 0x0c3f42, emissiveIntensity: 0.24, boxUvScale: [0.24, 0.2], cylinderUvScale: [0.36, 0.18] },
  pack2ChippedBlackstoneTrim: { path: './assets/textures/pack2/column_chipped_blackstone_trim_01.png', repeat: [2.4, 1.2], color: 0x4b4640, roughness: 0.94, metalness: 0, emissive: 0x15110f, emissiveIntensity: 0.14, boxUvScale: [0.22, 0.18], cylinderUvScale: [0.3, 0.16] },
  pack2CrackedMarbleTrim: { path: './assets/textures/pack2/column_cracked_marble_trim_01.png', repeat: [2.5, 1.4], color: 0xd8d0bd, roughness: 0.88, metalness: 0, emissive: 0x2c271d, emissiveIntensity: 0.14, boxUvScale: [0.2, 0.18], cylinderUvScale: [0.3, 0.16] },
  pack2DirtyBaseStone: { path: './assets/textures/pack2/column_dirty_base_stone_01.png', repeat: [2.6, 1.4], color: 0x8f8067, roughness: 0.98, metalness: 0, emissive: 0x21180f, emissiveIntensity: 0.12, boxUvScale: [0.2, 0.18], cylinderUvScale: [0.28, 0.16] },
  pack2TurquoiseInlay: { path: './assets/textures/pack2/column_turquoise_inlay_01.png', repeat: [2.2, 1.5], color: 0x74b9ad, roughness: 0.74, metalness: 0.08, emissive: 0x135d5d, emissiveIntensity: 0.34, boxUvScale: [0.22, 0.18], cylinderUvScale: [0.32, 0.17] },
  pack2OxidizedArchTrim: { path: './assets/textures/pack2/metal_oxidized_arch_trim_01.png', repeat: [2, 1.2], color: 0x6a8377, roughness: 0.68, metalness: 0.48, emissive: 0x113b35, emissiveIntensity: 0.2, boxUvScale: [0.24, 0.2], cylinderUvScale: [0.34, 0.18] },
  pack2RitualGlyphPanel: { path: './assets/textures/pack2/panel_ritual_glyph_column_01.png', repeat: [1, 1], color: 0xe0bd77, roughness: 0.88, metalness: 0, emissive: 0x56310c, emissiveIntensity: 0.38, boxUvScale: [0.18, 0.18] },
  turquoiseGlow: { color: 0x31c6c2, roughness: 0.65, metalness: 0, emissive: 0x20a9a4, emissiveIntensity: 0.56 },
  jakeBirthdayBanner: { path: './assets/textures/kerovac/happy_31st_jake_banner.svg', repeat: [1, 1], color: 0xffffff, roughness: 0.82, metalness: 0, emissive: 0xffcc66, emissiveIntensity: 0.58 },
  expoBlackInk: { color: 0x050403, roughness: 0.92, metalness: 0, emissive: 0x000000, emissiveIntensity: 0 },
  fishFinAmber: { path: './assets/textures/fish/fish_fin_membrane_amber_01.png', repeat: [1, 1], color: 0xd18a35, roughness: 0.82, metalness: 0, emissive: 0x2f1606, emissiveIntensity: 0.08 },
  fishFinDark: { path: './assets/textures/fish/fish_fin_membrane_dark_01.png', repeat: [1, 1], color: 0x242825, roughness: 0.86, metalness: 0, emissive: 0x050604, emissiveIntensity: 0.04 },
  fishFinSpottedTeal: { path: './assets/textures/fish/fish_fin_spotted_teal_01.png', repeat: [1, 1], color: 0x2a817c, roughness: 0.82, metalness: 0, emissive: 0x0b3d3a, emissiveIntensity: 0.12 },
  fishScaleEelSkinDark: { path: './assets/textures/fish/fish_scale_eel_skin_dark_01.png', repeat: [2, 1], color: 0x293126, roughness: 0.88, metalness: 0.02, emissive: 0x040604, emissiveIntensity: 0.04 },
  fishScaleGold: { path: './assets/textures/fish/fish_scale_gold_01.png', repeat: [2, 1], color: 0xc8a14b, roughness: 0.8, metalness: 0.04, emissive: 0x2f1f07, emissiveIntensity: 0.08 },
  fishScaleIridescentTeal: { path: './assets/textures/fish/fish_scale_iridescent_teal_01.png', repeat: [2, 1], color: 0x35b7aa, roughness: 0.74, metalness: 0.05, emissive: 0x16766f, emissiveIntensity: 0.28 },
  fishScaleKoiCreamOrange: { path: './assets/textures/fish/fish_scale_koi_cream_orange_01.png', repeat: [2, 1], color: 0xd9b474, roughness: 0.84, metalness: 0.01, emissive: 0x331908, emissiveIntensity: 0.06 },
  fishScaleMottledDark: { path: './assets/textures/fish/fish_scale_mottled_dark_01.png', repeat: [2, 1], color: 0x3d3a31, roughness: 0.9, metalness: 0.01, emissive: 0x050504, emissiveIntensity: 0.04 },
  fishScaleSilver: { path: './assets/textures/fish/fish_scale_silver_01.png', repeat: [2, 1], color: 0xaeb8b4, roughness: 0.78, metalness: 0.06, emissive: 0x101918, emissiveIntensity: 0.06 },
  fishScaleZebraOlive: { path: './assets/textures/fish/fish_scale_zebra_olive_01.png', repeat: [2, 1], color: 0x66704a, roughness: 0.86, metalness: 0.01, emissive: 0x0b0d07, emissiveIntensity: 0.05 },
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




function expoPad(id, label, zone, x, z, width, depth, material = 'wornCivicFloor') {
  return {
    id: `K_expo_pad_${id}`,
    kind: 'altar',
    position: [x, 0, z],
    yaw: 0,
    width,
    depth,
    height: 0.055,
    material,
    topMaterial: material,
    roomId: 'K10',
    blocksPlayer: false,
    tags: ['geometry-expo-center', 'display-pad', `display-pad-${zone}`, label],
    userData: { displayPadId: label, displayZone: zone, officialDarbExpoPad: true, swappablePreviewSlot: true, lowProfileWalkableMarker: true },
  };
}


function expoFloorStroke(id, from, to, thickness = 0.34) {
  return { id: `K_expo_floor_mark_${id}`, kind: 'lowWall', from, to, y: 0.235, height: 0.032, thickness, material: 'expoBlackInk', blocksPlayer: false, roomId: 'K10', tags: ['geometry-expo-center', 'bold-floor-lettering', 'display-pad-id-marking'] };
}

const LETTER_SEGMENTS = Object.freeze({
  A: ['top', 'upperLeft', 'upperRight', 'middle', 'lowerLeft', 'lowerRight'],
  B: ['upperLeft', 'upperRight', 'middle', 'lowerLeft', 'lowerRight', 'bottom'],
  C: ['top', 'upperLeft', 'lowerLeft', 'bottom'],
  D: ['upperLeft', 'upperRight', 'lowerLeft', 'lowerRight', 'bottom'],
});

const DIGIT_SEGMENTS = Object.freeze({
  1: ['upperRight', 'lowerRight'],
  2: ['top', 'upperRight', 'middle', 'lowerLeft', 'bottom'],
  3: ['top', 'upperRight', 'middle', 'lowerRight', 'bottom'],
  4: ['upperLeft', 'upperRight', 'middle', 'lowerRight'],
  5: ['top', 'upperLeft', 'middle', 'lowerRight', 'bottom'],
});

function expoSevenSegmentGlyph(prefix, char, cx, z, scale = 1, thickness = 0.28) {
  const segments = LETTER_SEGMENTS[char] ?? DIGIT_SEGMENTS[char] ?? [];
  const w = 1.15 * scale;
  const h = 1.8 * scale;
  const yTop = z - h / 2;
  const yMid = z;
  const yBot = z + h / 2;
  const xL = cx - w / 2;
  const xR = cx + w / 2;
  const strokes = [];
  const add = (name, from, to) => strokes.push(expoFloorStroke(`${prefix}_${char}_${name}`, from, to, thickness));
  if (segments.includes('top')) add('top', [xL, yTop], [xR, yTop]);
  if (segments.includes('middle')) add('mid', [xL, yMid], [xR, yMid]);
  if (segments.includes('bottom')) add('bottom', [xL, yBot], [xR, yBot]);
  if (segments.includes('upperLeft')) add('upper_left', [xL, yTop], [xL, yMid]);
  if (segments.includes('upperRight')) add('upper_right', [xR, yTop], [xR, yMid]);
  if (segments.includes('lowerLeft')) add('lower_left', [xL, yMid], [xL, yBot]);
  if (segments.includes('lowerRight')) add('lower_right', [xR, yMid], [xR, yBot]);
  return strokes;
}

function expoPadIdMark(label, x, z) {
  const scale = 0.9;
  return [
    ...expoSevenSegmentGlyph(`${label}_section`, label[0], x - 0.62, z + 1.55, scale, 0.22),
    ...expoSevenSegmentGlyph(`${label}_number`, label.slice(1), x + 0.62, z + 1.55, scale, 0.22),
  ];
}

function expoSectionLetterMark(letter, x, z) {
  return expoSevenSegmentGlyph(`${letter}_row_letter`, letter, x, z, 1.55, 0.38);
}

function expoMarker(id, x, z, width, depth, material = 'bronze') {
  const horizontal = width >= depth;
  const half = (horizontal ? width : depth) / 2;
  return { id: `K_expo_marker_${id}`, kind: 'lowWall', from: horizontal ? [x - half, z] : [x, z - half], to: horizontal ? [x + half, z] : [x, z + half], height: 0.08, thickness: Math.max(0.08, Math.min(width, depth)), material, blocksPlayer: false, roomId: 'K10', tags: ['geometry-expo-center', 'display-grid-marker'] };
}

function expoRail(id, from, to, material = 'pack2OxidizedArchTrim') {
  return { id: `K_expo_rail_${id}`, kind: 'lowWall', from, to, height: 0.34, thickness: 0.16, material, blocksPlayer: false, roomId: 'K10', tags: ['geometry-expo-center', 'low-profile-display-trim'] };
}

function expoColumn(id, kind, x, z, overrides = {}) {
  return {
    id, kind, position: [x, 0, z], yaw: overrides.yaw ?? 0, height: overrides.height ?? 4.2, radius: overrides.radius, width: overrides.width, depth: overrides.depth, segments: overrides.segments, baseSize: overrides.baseSize, capitalSize: overrides.capitalSize, columnSpacing: overrides.columnSpacing, state: overrides.state, broken: overrides.broken, cracked: overrides.cracked, ruined: overrides.ruined,
    shaftMaterial: overrides.shaftMaterial ?? 'pack2SandstoneWorn', baseMaterial: overrides.baseMaterial ?? 'pack2DirtyBaseStone', capitalMaterial: overrides.capitalMaterial ?? 'pack2CrackedMarbleTrim', bandMaterial: overrides.bandMaterial ?? 'pack2BronzeTurquoiseBand', glyphMaterial: overrides.glyphMaterial ?? 'pack2RitualGlyphPanel', trimMaterial: overrides.trimMaterial ?? 'pack2ChippedBlackstoneTrim',
    blocksPlayer: overrides.blocksPlayer ?? true, blocksEnemies: overrides.blocksEnemies ?? true, roomId: overrides.roomId ?? 'K03',
    tags: ['geometry-expo-center', 'darb-column-pillar-support-preview', kind, ...(overrides.tags ?? [])],
    userData: { purpose: 'Permanent Kerovac Geometry Expo Center swappable preview zone. Batch 4 displays DARB pillar, column, and structural support primitives using pack2 texture profiles.', displayChamber: overrides.displayChamber ?? 'K03 Civic Reliquary Court', authoredAsLocationDefinitionData: true, collisionTruth: 'Column primitives generate compact collision blockers from their visible footprint unless blocksPlayer is false.', debugOverlay: 'Primitive userData includes debugFootprint with dimensions, state, material slots, and blocker behavior.', ...(overrides.userData ?? {}) },
  };
}

function expoFishingRod(id, itemId, padId, x, z, variant, overrides = {}) {
  return {
    id, kind: 'fishingRodDisplay', itemId, variant, position: [x, 0, z], yaw: overrides.yaw ?? -0.72, roomId: 'K10', blocksPlayer: false,
    tags: ['geometry-expo-center', 'fishing-rod-expo-batch', 'reusable-fishing-rod-asset', itemId],
    userData: { itemId, displayPadId: padId, objectCategory: 'fishingRod', expoBatchPurpose: 'Kerovac fishing rod and fish expo batch', futureReuse: ['held fishing rod tuning', 'inventory references', 'fishing system integration'], label: overrides.label ?? `ROD-${String(overrides.index ?? 0).padStart(2, '0')}` },
  };
}

function expoFish(id, itemId, padId, x, z, variant, overrides = {}) {
  return {
    id, kind: 'fishDisplay', itemId, variant, position: [x, 0, z], yaw: overrides.yaw ?? 0.45, roomId: 'K10', blocksPlayer: false,
    tags: ['geometry-expo-center', 'fish-expo-batch', 'reusable-fish-asset', itemId],
    userData: { itemId, displayPadId: padId, objectCategory: 'fish', expoBatchPurpose: 'Kerovac fishing rod and fish expo batch', futureReuse: ['catchable fish items', 'cooked fish pipeline', 'inventory references'], label: overrides.label ?? `FISH-${String(overrides.index ?? 0).padStart(2, '0')}` },
  };
}

function expoBridge(id, kind, x, z, overrides = {}) {
  const state = overrides.state ?? (overrides.broken ? 'broken' : kind === 'collapsedWalkway' ? 'collapsed' : 'intact');
  return {
    id,
    kind,
    position: [x, 0, z],
    yaw: overrides.yaw ?? Math.PI / 2,
    width: overrides.width ?? 2.6,
    length: overrides.length ?? 6.2,
    height: overrides.height ?? 0.28,
    deckY: overrides.deckY ?? 0.22,
    deckMaterial: overrides.deckMaterial ?? 'limestoneFloor',
    sideMaterial: overrides.sideMaterial ?? 'limestoneWall',
    trimMaterial: overrides.trimMaterial ?? 'bronze',
    railingMaterial: overrides.railingMaterial ?? 'bronze',
    undersideMaterial: overrides.undersideMaterial ?? 'ritualWall',
    waterMaterial: overrides.waterMaterial ?? 'turquoiseWater',
    railings: overrides.railings ?? ['bridgeWithRailings', 'wideCeremonialBridge', 'ritualSpanBridge', 'raisedWalkway'].includes(kind),
    curbs: overrides.curbs ?? ['canalCrossing', 'archedStoneBridge', 'narrowStoneBridge'].includes(kind),
    broken: overrides.broken ?? ['brokenBridge', 'collapsedWalkway'].includes(kind),
    state,
    gapLength: overrides.gapLength,
    gapOffset: overrides.gapOffset,
    canalContext: overrides.canalContext ?? kind === 'canalCrossing',
    walkable: true,
    blocksPlayer: true,
    roomId: overrides.roomId ?? 'K03',
    tags: ['geometry-expo-center', 'darb-bridge-crossing-walkway-preview', kind, ...(overrides.tags ?? [])],
    userData: {
      purpose: 'Permanent Kerovac Geometry Expo Center swappable preview zone. Batch 2 displays DARB bridge, canal crossing, and walkway primitives generated from location definition data.',
      displayChamber: overrides.displayChamber ?? 'K03 Civic Reliquary Court',
      basePlacedOnCityFloor: true,
      physicallyUsable: true,
      authoredAsLocationDefinitionData: true,
      collisionTruth: 'Generated walkable bridgeDeck elevation plus generated blockers for railings, curbs, broken gaps, canal edges, water, or void context.',
      debugOverlay: 'Primitive footprint and generated blocker metadata identify this bridge/crossing/walkway batch item.',
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
    room({ id: 'K09', label: 'Kerovac Expo Megalithic Entrance', minX: 22, maxX: 38, minZ: 7, maxZ: 27, ceilingY: 12, floorTexture: 'limestoneFloor', wallTexture: 'pack2LimestoneCarved', ceilingTexture: 'ceilingCoffer', tags: ['geometry-expo-center', 'expo-entrance', 'optional-side-district'], encounterWeight: 0 }),
    room({ id: 'K10', label: 'DARB Geometry Expo Stadium', minX: 38, maxX: 120, minZ: -38, maxZ: 72, ceilingY: 16, floorTexture: 'wornCivicFloor', wallTexture: 'pack2SandstoneWorn', ceilingTexture: 'ceilingCoffer', tags: ['geometry-expo-center', 'massive-expo-stadium', 'optional-side-district'], encounterWeight: 0 }),
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
    door('K_D_EXPO_01_court_to_entrance', 'K03', 'K09', 22, 17, 8.2, ['geometry-expo-center', 'optional-side-district', 'return-path']),
    door('K_D_EXPO_02_entrance_to_stadium', 'K09', 'K10', 38, 17, 10.4, ['geometry-expo-center', 'optional-side-district', 'monumental-entrance']),
    door('K_D04_canal_to_market', 'K04', 'K05', 0, 58, 7.0),
    door('K_D05_market_to_approach', 'K05', 'K06', 0, 88, 7.0),
    door('K_D06_approach_to_vestibule', 'K06', 'K07', 0, 114, 7.4),
    door('K_D07_vestibule_to_sanctum', 'K07', 'K08', 0, 138, 7.8),
  ],

  wallSegments: [
    panelWall('K_PANEL_WALL_early_southwest', 'K01', [-10.8, -33.5], [-10.8, -28.5], 'sandstoneWall'),
    panelWall('K_PANEL_WALL_early_southeast', 'K02', [9.8, -17], [9.8, -9], 'limestoneWall'),
    panelWall('K_PANEL_WALL_court_west', 'K03', [-21.8, 9], [-21.8, 20], 'ritualWall'),
    panelWall('K_PANEL_WALL_jake_birthday_east', 'K03', [21.8, 23], [21.8, 31], 'ritualWall'),
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
    { id: 'K_court_jake_birthday_hanging_scoreboard', kind: 'hangingSign', position: [0, 5.8, 23.8], yaw: Math.PI, width: 12.6, height: 3.8, thickness: 0.34, material: 'jakeBirthdayBanner', frameMaterial: 'bronze', chainMaterial: 'pack2OxidizedArchTrim', chainTopY: 9.45, chainWidth: 0.12, blocksPlayer: false, roomId: 'K03', tags: ['jake-birthday', 'hanging-scoreboard', 'ceiling-suspended', 'expo-entrance-clear'], userData: { message: 'HAPPY 31ST JAKE', placement: 'Suspended over the Civic Reliquary Court sightline near the Expo entrance without touching the K09 route.', readableFromEntry: true } },

    // Permanent Kerovac Geometry Expo Center: official swappable DARB showroom annex. Keep K09/K10 structure intact; future batches should replace only preview objects assigned to display pad IDs.
    // Workflow: remove previous preview set, insert new primitive/object batch into pads A1-D5, M1-M8, LARGE-01-LARGE-04, VLARGE-01-VLARGE-02, and preserve the wide aisles, water-demo lane, roof, lighting, return route, and metadata.
    pillar('K_expo_entry_megalith_column_sw', 'K09', 25.5, 11, 10.8, 0.92, 'pack2BlackBasaltGlyph'),
    pillar('K_expo_entry_megalith_column_nw', 'K09', 25.5, 23, 10.8, 0.92, 'pack2BlackBasaltGlyph'),
    pillar('K_expo_entry_megalith_column_se', 'K09', 34.5, 11, 10.8, 0.92, 'pack2LimestoneCarved'),
    pillar('K_expo_entry_megalith_column_ne', 'K09', 34.5, 23, 10.8, 0.92, 'pack2LimestoneCarved'),
    { id: 'K_expo_entry_ceiling_beam', kind: 'ceilingSlab', position: [30, 11.72, 17], yaw: 0, width: 14, depth: 18, thickness: 0.28, material: 'pack2OxidizedArchTrim', roomId: 'K09', blocksPlayer: false, tags: ['geometry-expo-center', 'sealed-roof'] },

    ...Array.from({ length: 20 }, (_, i) => expoPad(`small_${i + 1}`, `${String.fromCharCode(65 + Math.floor(i / 5))}${(i % 5) + 1}`, 'small', 48 + (i % 5) * 8, -26 + Math.floor(i / 5) * 10, 5.6, 5.6)),
    ...Array.from({ length: 8 }, (_, i) => expoPad(`medium_${i + 1}`, `M${i + 1}`, 'medium', 48 + (i % 4) * 12, 22 + Math.floor(i / 4) * 14, 8.4, 8.4, 'limestoneFloor')),
    ...Array.from({ length: 4 }, (_, i) => expoPad(`large_${i + 1}`, `LARGE-0${i + 1}`, 'large', 92 + (i % 2) * 18, -23 + Math.floor(i / 2) * 24, 13.8, 15.8, 'limestoneFloor')),
    ...Array.from({ length: 2 }, (_, i) => expoPad(`vlarge_${i + 1}`, `VLARGE-0${i + 1}`, 'very-large', 94 + i * 18, 50, 17.2, 22.0, 'wornCivicFloor')),
    expoPad('water_lane', 'WATER-DEMO-LANE', 'reserved-water-demo', 75, 58, 48, 6.4, 'turquoiseWater'),
    ...[-34, -6, 16, 38, 70].map((z, i) => expoMarker(`cross_aisle_${i + 1}`, 79, z, 76, 0.18)),
    ...[44, 84, 116].map((x, i) => expoMarker(`long_aisle_${i + 1}`, x, 17, 0.18, 104)),
    expoRail('small_zone_south', [42, -32], [82, -32]),
    expoRail('small_zone_north', [42, 13], [82, 13]),
    expoRail('large_zone_west', [85, -34], [85, 17]),
    expoRail('water_lane_south', [51, 54.4], [99, 54.4], 'pack2TurquoiseInlay'),
    expoRail('water_lane_north', [51, 61.6], [99, 61.6], 'pack2TurquoiseInlay'),
    ...['A1','A2','A3','B1','B2','B3','C1','C2','C3','C4','D1','D2','D3'].flatMap((label) => { const row = label.charCodeAt(0) - 65; const col = Number(label.slice(1)) - 1; return expoPadIdMark(label, 48 + col * 8, -26 + row * 10); }),
    ...expoSectionLetterMark('A', 43.9, -26),
    ...expoSectionLetterMark('B', 43.9, -16),
    ...expoSectionLetterMark('C', 43.9, -6),
    ...expoSectionLetterMark('D', 43.9, 4),

    { id: 'K_expo_west_observation_tier_01', kind: 'lowWall', from: [40.5, -36], to: [40.5, 70], height: 1.05, thickness: 2.0, material: 'pack2DirtyBaseStone', blocksPlayer: true, roomId: 'K10', tags: ['geometry-expo-center', 'raised-observation-tier'] },
    { id: 'K_expo_east_observation_tier_01', kind: 'lowWall', from: [118, -36], to: [118, 70], height: 1.05, thickness: 2.0, material: 'pack2DirtyBaseStone', blocksPlayer: true, roomId: 'K10', tags: ['geometry-expo-center', 'raised-observation-tier'] },
    { id: 'K_expo_ceiling_coffer_stadium', kind: 'ceilingSlab', position: [79, 15.72, 17], yaw: 0, width: 74, depth: 102, thickness: 0.3, material: 'ceilingCoffer', roomId: 'K10', blocksPlayer: false, tags: ['geometry-expo-center', 'high-sealed-ceiling'] },
    { id: 'K_expo_north_banner', kind: 'stela', position: [79, 0, 70.4], yaw: Math.PI, width: 13, height: 5.2, thickness: 0.3, material: 'pack2RitualGlyphPanel', blocksPlayer: false, roomId: 'K10', tags: ['geometry-expo-center', 'expo-banner'], userData: { label: 'OFFICIAL SWAPPABLE DARB DISPLAY GRID' } },

    // Fishing Rod and Fish Expo Batch: rods occupy A1-A3/B1-B3; fish occupy C1-C4/D1-D3. These reusable preview objects replace starter display candidates only.
    expoFishingRod('K_expo_rod_A1_reed_pole', 'reedPoleRod', 'A1', 48, -26, 'reedPoleRod', { index: 1, label: 'ROD-01 / reedPoleRod' }),
    expoFishingRod('K_expo_rod_A2_hooked_branch', 'hookedBranchRod', 'A2', 56, -26, 'hookedBranchRod', { index: 2, label: 'ROD-02 / hookedBranchRod', yaw: -0.35 }),
    expoFishingRod('K_expo_rod_A3_bronze_spined', 'bronzeSpinedRod', 'A3', 64, -26, 'bronzeSpinedRod', { index: 3, label: 'ROD-03 / bronzeSpinedRod', yaw: -0.86 }),
    expoFishingRod('K_expo_rod_B1_ritual_bone', 'ritualBoneRod', 'B1', 48, -16, 'ritualBoneRod', { index: 4, label: 'ROD-04 / ritualBoneRod', yaw: -0.95 }),
    expoFishingRod('K_expo_rod_B2_traveler_wood', 'travelerWoodRod', 'B2', 56, -16, 'travelerWoodRod', { index: 5, label: 'ROD-05 / travelerWoodRod', yaw: -0.62 }),
    expoFishingRod('K_expo_rod_B3_heavy_river', 'heavyRiverRod', 'B3', 64, -16, 'heavyRiverRod', { index: 6, label: 'ROD-06 / heavyRiverRod', yaw: -0.48 }),
    expoFish('K_expo_fish_C1_small_river', 'smallRiverFish', 'C1', 48, -6, 'smallRiverFish', { index: 1, label: 'FISH-01 / smallRiverFish' }),
    expoFish('K_expo_fish_C2_broad_carp', 'broadCarpFish', 'C2', 56, -6, 'broadCarpFish', { index: 2, label: 'FISH-02 / broadCarpFish', yaw: 0.12 }),
    expoFish('K_expo_fish_C3_long_eel', 'longEelFish', 'C3', 64, -6, 'longEelFish', { index: 3, label: 'FISH-03 / longEelFish', yaw: 0.78 }),
    expoFish('K_expo_fish_C4_spine_back', 'spineBackFish', 'C4', 72, -6, 'spineBackFish', { index: 4, label: 'FISH-04 / spineBackFish', yaw: 0.28 }),
    expoFish('K_expo_fish_D1_flat_marsh', 'flatMarshFish', 'D1', 48, 4, 'flatMarshFish', { index: 5, label: 'FISH-05 / flatMarshFish', yaw: -0.2 }),
    expoFish('K_expo_fish_D2_jaw_hunter', 'jawHunterFish', 'D2', 56, 4, 'jawHunterFish', { index: 6, label: 'FISH-06 / jawHunterFish', yaw: 0.5 }),
    expoFish('K_expo_fish_D3_sacred_glow', 'sacredGlowFish', 'D3', 64, 4, 'sacredGlowFish', { index: 7, label: 'FISH-07 / sacredGlowFish', yaw: -0.5 }),
    { id: 'K_expo_starter_large_platform', kind: 'altar', position: [92, 0, -23], yaw: 0, width: 8.6, depth: 10.2, height: 0.8, material: 'pack2DirtyBaseStone', topMaterial: 'pack2CrackedMarbleTrim', roomId: 'K10', tags: ['geometry-expo-center', 'starter-display-object'], userData: { displayPadId: 'LARGE-01', label: 'DARB EXPO — LARGE-01 / Future Building Demo Slot' } },
    { id: 'K_expo_water_demo_canal_strip', kind: 'canalWater', from: [53, 58], to: [97, 58], width: 4.8, y: 0.08, height: 0.035, material: 'turquoiseWater', emissiveColor: 0x2fb8b7, roomId: 'K10', tags: ['geometry-expo-center', 'reserved-water-demo-lane'], userData: { displayPadId: 'WATER-DEMO-LANE', futureUse: 'boat, fishing, water, dock, and bridge tests' } },

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
    sunstone('K_light_expo_entry_gold', 'K09', 30, 8.2, 17, 1.55, 34),
    sunstone('K_light_expo_stadium_center', 'K10', 79, 11.5, 17, 2.1, 92),
    { id: 'K_light_expo_small_grid_readability', kind: 'point', color: 0xffdca0, intensity: 1.25, distance: 54, decay: 1.2, position: { x: 58, y: 7.2, z: -10 }, roomId: 'K10' },
    { id: 'K_light_expo_large_grid_readability', kind: 'point', color: 0xffdca0, intensity: 1.25, distance: 58, decay: 1.2, position: { x: 101, y: 7.5, z: 10 }, roomId: 'K10' },
    { id: 'K_light_expo_water_lane_turquoise', kind: 'point', color: 0x57d2cb, intensity: 1.1, distance: 48, decay: 1.35, position: { x: 75, y: 3.2, z: 58 }, roomId: 'K10' },
    { id: 'K_light_canal_turquoise_fill', kind: 'point', color: 0x57d2cb, intensity: 1.0, distance: 30, decay: 1.45, position: { x: 0, y: 2.2, z: 45 }, roomId: 'K04' },
    sunstone('K_light_market_warning_lamps', 'K05', 0, 5.6, 72, 1.18, 32),
    sunstone('K_light_temple_stairs', 'K06', 0, 6.6, 103, 1.28, 30),
    { id: 'K_light_vestibule_turquoise_gold', kind: 'point', color: 0x76d8c7, intensity: 0.85, distance: 24, decay: 1.5, position: { x: 0, y: 4.2, z: 126 }, roomId: 'K07' },
    sunstone('K_light_sanctum_radiant_center', 'K08', 0, 6.4, 153, 1.7, 40),
    { id: 'K_light_sanctum_panel_readability', kind: 'point', color: 0xffb56a, intensity: 1.0, distance: 20, decay: 1.5, position: { x: 0, y: 4.4, z: 164 }, roomId: 'K08' },
  ],


  displayPads: {
    officialSwappableDisplayArea: true,
    location: 'Optional east annex from K03 Civic Reliquary Court through K09 Megalithic Entrance into K10 DARB Geometry Expo Stadium.',
    futureWorkflow: ['Remove previous preview display set only.', 'Insert new DARB primitive/object batches onto declared displayPad IDs.', 'Keep K09/K10 expo architecture, roof, lighting, aisles, observation tiers, and return path intact.', 'Use pad IDs for best-in-show review and permanent DARB library selection.'],
    zones: {
      small: { count: 20, ids: ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5'], padSize: [5.6, 5.6] },
      medium: { count: 8, ids: ['M1','M2','M3','M4','M5','M6','M7','M8'], padSize: [8.4, 8.4] },
      large: { count: 4, ids: ['LARGE-01','LARGE-02','LARGE-03','LARGE-04'], padSize: [13.8, 15.8] },
      veryLarge: { count: 2, ids: ['VLARGE-01','VLARGE-02'], padSize: [17.2, 22.0] },
      reservedWaterDemoLane: { ids: ['WATER-DEMO-LANE'], capacity: 'Future canal, fishing rod/fish, boat, dock, water, bridge, and torch reflection demos.' },
    },
    pack2TexturesUsed: true,
  },

  navigation: {
    roomGraph: {
      roomIds: ['K01', 'K02', 'K03', 'K09', 'K10', 'K04', 'K05', 'K06', 'K07', 'K08'],
      links: [
        { id: 'K_NAV_01', fromRoom: 'K01', toRoom: 'K02', navWaypoint: { x: 0, y: 0, z: -26 } },
        { id: 'K_NAV_02', fromRoom: 'K02', toRoom: 'K03', navWaypoint: { x: 0, y: 0, z: 2 } },
        { id: 'K_NAV_03', fromRoom: 'K03', toRoom: 'K04', navWaypoint: { x: 0, y: 0, z: 32 } },
        { id: 'K_NAV_EXPO_01', fromRoom: 'K03', toRoom: 'K09', navWaypoint: { x: 22, y: 0, z: 17 } },
        { id: 'K_NAV_EXPO_02', fromRoom: 'K09', toRoom: 'K10', navWaypoint: { x: 38, y: 0, z: 17 } },
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
