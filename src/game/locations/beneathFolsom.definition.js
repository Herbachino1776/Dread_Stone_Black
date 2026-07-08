const FLOOR_Y = 0;
const CEILING_Y = 3.45;

const textures = Object.freeze({
  wall: { path: './assets/textures/wall_black_stone_01.png', repeat: [3.4, 1.4], roughness: 0.99 },
  floor: { path: './assets/textures/floor_worn_stone_01.png', repeat: [3.2, 4.2], roughness: 1 },
  ceiling: { path: './assets/textures/ceiling_dark_stone_01.png', repeat: [3.2, 3.2], roughness: 1 },
  wetStone: { path: './assets/textures/floor_worn_stone_01.png', repeat: [2.2, 3.4], roughness: 0.72, metalness: 0.08 },
  mud: { path: './assets/textures/outdoor/field_dead_grass_01.png', repeat: [2.2, 2.2], roughness: 1 },
  timber: { path: './assets/textures/pack1/wood_dark_aged_01.png', repeat: [1.6, 1.2], roughness: 1 },
  rustedIron: { path: './assets/textures/metal_gate_rusted_01.png', repeat: [1.2, 1.4], roughness: 0.9, metalness: 0.36 },
  blackGrowth: { path: './assets/textures/growth/black_growth_cord_surface_01.png', repeat: [2.8, 1.1], roughness: 0.84 },
  blackScab: { path: './assets/textures/growth/black_growth_scab_intact_02.png', repeat: [1.2, 1.2], roughness: 0.82 },
  paleWall: { path: './assets/textures/pack1/stone_limestone_block_01.png', repeat: [2.2, 1.4], color: 0xc7d0cb, roughness: 0.82, metalness: 0.04, emissive: 0x172120, emissiveIntensity: 0.13 },
  paleFloor: { path: './assets/textures/pack1/floor_limestone_temple_01.png', repeat: [2.8, 3.6], color: 0xaebbb8, roughness: 0.9, emissive: 0x101918, emissiveIntensity: 0.1 },
  paleCeiling: { path: './assets/textures/pack1/ceiling_dark_stone_01.png', repeat: [2.6, 2.6], color: 0x879693, roughness: 0.96, emissive: 0x0b1111, emissiveIntensity: 0.08 },
  paleMechanism: { path: './assets/textures/pack2/column_cracked_marble_trim_01.png', repeat: [1.3, 1.3], color: 0xe0e7e2, roughness: 0.68, metalness: 0.1, emissive: 0x243736, emissiveIntensity: 0.2 },
  glyphSymbol01: { path: './assets/revealed_glyphs/symbols/symbol_001.png', repeat: [1, 1], roughness: 0.98, metalness: 0, transparent: true, opacity: 0 },
  glyphScript01: { path: './assets/revealed_glyphs/scripts/script_001.png', repeat: [1, 1], roughness: 0.98, metalness: 0, transparent: true, opacity: 0 },
  glyphLetter01: { path: './assets/revealed_glyphs/letters/letter_001.png', repeat: [1, 1], roughness: 0.98, metalness: 0, transparent: true, opacity: 0 },
  glyphLetter02: { path: './assets/revealed_glyphs/letters/letter_002.png', repeat: [1, 1], roughness: 0.98, metalness: 0, transparent: true, opacity: 0 },
  glyphFace01: { path: './assets/revealed_glyphs/faces/face_001.png', repeat: [1, 1], roughness: 1, metalness: 0, transparent: true, opacity: 0 },
  glyphBlackCord: { path: './assets/textures/growth/black_growth_cord_surface_01.png', repeat: [1, 1], roughness: 1, metalness: 0, transparent: true, opacity: 0 },
  coldThresholdStone: { path: './assets/textures/wall_black_stone_01.png', repeat: [2.4, 1.2], color: 0x7186a0, roughness: 0.94, emissive: 0x102d52, emissiveIntensity: 0.32 },
});

function room(id, label, minX, maxX, minZ, maxZ, options = {}) {
  return {
    id, label, minX, maxX, minZ, maxZ,
    floorY: FLOOR_Y,
    ceilingY: options.ceilingY ?? CEILING_Y,
    floorTexture: options.floorTexture ?? 'floor',
    wallTexture: options.wallTexture ?? 'wall',
    ceilingTexture: options.ceilingTexture ?? 'ceiling',
    safeForSpawn: options.safeForSpawn ?? false,
    encounterWeight: 0,
    tags: options.tags ?? ['underworks'],
    userData: options.userData ?? {},
  };
}

function wallGap(roomId, x, z, width) {
  return { roomId, position: { x, y: FLOOR_Y, z }, width };
}

function prop(id, roomId, position, dimensions, material, options = {}) {
  return {
    id,
    kind: options.kind ?? 'underworks-prop',
    roomId,
    position,
    rotation: options.rotation ?? { x: 0, y: 0, z: 0 },
    dimensions,
    material,
    collisionRef: options.collisionRef,
    tags: ['beneath-folsom', options.blocking ? 'solid' : 'non-blocking-decor', ...(options.tags ?? [])],
    userData: {
      blockingMode: options.blocking ? 'solid' : 'nonBlockingDecor',
      collisionPurpose: options.collisionPurpose ?? 'production-intentional environmental dressing',
      ...(options.userData ?? {}),
    },
  };
}

function lanternRevealDecal(id, position, dimensions, material, options = {}) {
  return prop(id, 'BF03', position, { ...dimensions, depth: 0.01 }, material, {
    kind: 'decal',
    rotation: options.rotation ?? { x: 0, y: 0, z: 0 },
    tags: ['lantern-reveal-decal', 'keepers-lantern-revealed', 'hidden-under-normal-light', 'chapter-2-route-truth', 'blocked-future-route', ...(options.tags ?? [])],
    userData: {
      revealItemId: 'keepers_lantern',
      hiddenByDefault: true,
      revealMode: 'lanternCone',
      revealDistance: options.revealDistance ?? 4,
      revealConeDegrees: options.revealConeDegrees ?? 40,
      nearFieldRevealRadius: options.nearFieldRevealRadius ?? 1.35,
      nearFieldConeDegrees: options.nearFieldConeDegrees ?? 80,
      exitConePaddingDegrees: options.exitConePaddingDegrees ?? 7,
      exitDistancePadding: options.exitDistancePadding ?? 0.35,
      revealLingerSeconds: options.revealLingerSeconds ?? 0.18,
      hiddenOpacity: 0,
      revealedOpacity: options.revealedOpacity ?? 0.78,
      fadeSpeed: options.fadeSpeed ?? 8,
      fadeOutSpeed: options.fadeOutSpeed ?? 10,
      revealStateKey: 'beneath_folsom_keepers_lantern_reveal_seen',
      alphaTest: 0,
    },
  });
}

const props = [
  // A broad, readable descent silhouette without adding risky step collision.
  prop('beneath_folsom_step_upper', 'BF01', { x: 0, y: 0.06, z: -20.4 }, { width: 6.2, height: 0.12, depth: 2.1 }, 'wetStone', { tags: ['entry-stair', 'non-blocking-step'] }),
  prop('beneath_folsom_step_middle', 'BF01', { x: 0, y: 0.045, z: -17.9 }, { width: 6.8, height: 0.09, depth: 2.1 }, 'wetStone', { tags: ['entry-stair', 'non-blocking-step'] }),
  prop('beneath_folsom_step_lower', 'BF01', { x: 0, y: 0.03, z: -15.4 }, { width: 7.4, height: 0.06, depth: 2.1 }, 'wetStone', { tags: ['entry-stair', 'non-blocking-step'] }),
  prop('beneath_folsom_return_threshold', 'BF01', { x: 0, y: 0.08, z: -22.35 }, { width: 5.6, height: 0.16, depth: 1.1 }, 'rustedIron', { tags: ['return-route', 'obvious-threshold'] }),

  // Timber retaining frames make the short route feel built beneath a town.
  ...[-19.5, -11.4, 1.5, 10.8].flatMap((z, index) => [
    prop(`beneath_folsom_timber_${index}_left`, z < -10 ? 'BF01' : 'BF02', { x: z < -10 ? -4.35 : -8.5, y: 1.65, z }, { width: 0.55, height: 3.3, depth: 0.65 }, 'timber', { tags: ['timber-support'] }),
    prop(`beneath_folsom_timber_${index}_right`, z < -10 ? 'BF01' : 'BF02', { x: z < -10 ? 4.35 : 8.5, y: 1.65, z }, { width: 0.55, height: 3.3, depth: 0.65 }, 'timber', { tags: ['timber-support'] }),
    prop(`beneath_folsom_timber_${index}_header`, z < -10 ? 'BF01' : 'BF02', { x: 0, y: 3.12, z }, { width: z < -10 ? 9.2 : 17.6, height: 0.45, depth: 0.7 }, 'timber', { tags: ['timber-support', 'low-ceiling-frame'] }),
  ]),

  // Wet floor language: one drainage run and two broad muddy deposits.
  prop('beneath_folsom_drain_channel', 'BF02', { x: -5.8, y: 0.025, z: 2.5 }, { width: 1.3, height: 0.05, depth: 21 }, 'wetStone', { tags: ['drainage', 'wet-stone'] }),
  prop('beneath_folsom_mud_patch_west', 'BF02', { x: -3.2, y: 0.035, z: -4.2 }, { width: 4.4, height: 0.07, depth: 5.8 }, 'mud', { tags: ['mud', 'damp-floor'] }),
  prop('beneath_folsom_mud_patch_east', 'BF02', { x: 4.3, y: 0.035, z: 6.4 }, { width: 5.2, height: 0.07, depth: 4.2 }, 'mud', { tags: ['mud', 'damp-floor'] }),

  // The lower drain throat becomes reachable after the old service grate is pried aside.
  prop('beneath_folsom_hidden_gate_wall', 'BF03', { x: 0, y: 1.48, z: 21.72 }, { width: 6.55, height: 2.96, depth: 0.36 }, 'wall', { tags: ['sealed-lower-wall', 'hidden-growth-gate-wall', 'chapter-2-capstone'] }),
  ...[-2.5, -1.25, 0, 1.25, 2.5].map((x, index) => prop(`beneath_folsom_deeper_grate_bar_${index}`, 'BF02', { x, y: 1.55, z: 13.48 }, { width: 0.18, height: 2.85, depth: 0.18 }, 'rustedIron', { tags: ['future-passage', 'old-drain-grate'] })),
  prop('beneath_folsom_deeper_grate_header', 'BF02', { x: 0, y: 2.92, z: 13.48 }, { width: 6.2, height: 0.22, depth: 0.25 }, 'rustedIron', { tags: ['future-passage', 'old-drain-grate'] }),
  prop('beneath_folsom_drain_bar_visual', 'BF02', { x: -7.55, y: 0.62, z: -1.8 }, { width: 0.16, height: 1.9, depth: 0.16 }, 'rustedIron', { rotation: { x: 0, y: 0, z: -0.19 }, tags: ['iron-drain-bar', 'maintenance-tool', 'pickup-visual'] }),
  prop('beneath_folsom_alcove_mud', 'BF03', { x: 0, y: 0.035, z: 18 }, { width: 5.6, height: 0.07, depth: 6.5 }, 'mud', { tags: ['drain-throat', 'opened-threshold'] }),
  prop('beneath_folsom_alcove_timber_left', 'BF03', { x: -3.1, y: 1.55, z: 18.2 }, { width: 0.48, height: 3.1, depth: 0.58 }, 'timber', { tags: ['timber-support', 'opened-threshold'] }),
  prop('beneath_folsom_alcove_timber_right', 'BF03', { x: 3.1, y: 1.55, z: 18.2 }, { width: 0.48, height: 3.1, depth: 0.58 }, 'timber', { tags: ['timber-support', 'opened-threshold'] }),
  prop('beneath_folsom_keeper_niche_shelf', 'BF03', { x: -2.75, y: 0.72, z: 18.8 }, { width: 1.2, height: 0.14, depth: 0.72 }, 'timber', { tags: ['keeper-niche', 'lantern-pickup-setting'] }),
  prop('beneath_folsom_keeper_niche_backplate', 'BF03', { x: -2.75, y: 1.42, z: 19.17 }, { width: 1.35, height: 1.62, depth: 0.12 }, 'wetStone', { tags: ['keeper-niche', 'empty-lantern-outline', 'retired-pickup-setting'] }),
  prop('beneath_folsom_keeper_niche_bracket_left', 'BF03', { x: -3.22, y: 1.02, z: 19.02 }, { width: 0.09, height: 0.62, depth: 0.09 }, 'rustedIron', { rotation: { x: 0, y: 0, z: -0.42 }, tags: ['keeper-niche', 'empty-shelf-bracket'] }),
  prop('beneath_folsom_keeper_niche_bracket_right', 'BF03', { x: -2.28, y: 1.02, z: 19.02 }, { width: 0.09, height: 0.62, depth: 0.09 }, 'rustedIron', { rotation: { x: 0, y: 0, z: 0.42 }, tags: ['keeper-niche', 'empty-shelf-bracket'] }),
  prop('beneath_folsom_keeper_niche_empty_hook', 'BF03', { x: -2.75, y: 1.55, z: 19.08 }, { width: 0.08, height: 0.62, depth: 0.08 }, 'rustedIron', { rotation: { x: 0, y: 0, z: 0.18 }, tags: ['keeper-niche', 'empty-lantern-hook', 'post-backfill-dressing'] }),
  prop('beneath_folsom_keeper_niche_empty_ring', 'BF03', { x: -2.68, y: 1.25, z: 19.02 }, { width: 0.28, height: 0.07, depth: 0.28 }, 'rustedIron', { tags: ['keeper-niche', 'empty-lantern-ring', 'no-pickup'] }),
  prop('beneath_folsom_keeper_niche_dust_shadow', 'BF03', { x: -2.75, y: 0.805, z: 18.78 }, { width: 0.62, height: 0.025, depth: 0.42 }, 'mud', { tags: ['keeper-niche', 'lantern-removed-dust-shadow', 'no-pickup'] }),
  // A fractured threshold composition on the sealed lower wall. The large central
  // seal, lintel/base script, and leaning side marks read as one buried gate language,
  // while independent planes still let the moving lantern wash uncover it in pieces.
  lanternRevealDecal('beneath_folsom_lower_wall_glyph_cluster_gate_symbol', { x: -0.08, y: 1.62, z: 21.49 }, { width: 1.72, height: 1.92 }, 'glyphSymbol01', { rotation: { x: 0, y: 0, z: -0.045 }, revealedOpacity: 0.76 }),
  lanternRevealDecal('beneath_folsom_lower_wall_glyph_cluster_gate_lintel_script', { x: 0, y: 2.72, z: 21.485 }, { width: 4.45, height: 0.68 }, 'glyphScript01', { rotation: { x: 0, y: 0, z: -0.018 }, revealedOpacity: 0.66 }),
  lanternRevealDecal('beneath_folsom_lower_wall_glyph_cluster_gate_base_script', { x: -0.08, y: 0.4, z: 21.48 }, { width: 4.1, height: 0.62 }, 'glyphScript01', { rotation: { x: 0, y: 0, z: 0.026 }, revealedOpacity: 0.62 }),
  lanternRevealDecal('beneath_folsom_lower_wall_glyph_cluster_gate_letter_left_upper', { x: -1.75, y: 2.05, z: 21.475 }, { width: 0.72, height: 0.92 }, 'glyphLetter01', { rotation: { x: 0, y: 0, z: -0.16 }, revealedOpacity: 0.78 }),
  lanternRevealDecal('beneath_folsom_lower_wall_glyph_cluster_gate_letter_left_lower', { x: -1.86, y: 1.12, z: 21.47 }, { width: 0.62, height: 0.82 }, 'glyphLetter02', { rotation: { x: 0, y: 0, z: 0.11 }, revealedOpacity: 0.7 }),
  lanternRevealDecal('beneath_folsom_lower_wall_glyph_cluster_gate_letter_right_upper', { x: 1.68, y: 2.03, z: 21.465 }, { width: 0.68, height: 0.88 }, 'glyphLetter02', { rotation: { x: 0, y: 0, z: 0.18 }, revealedOpacity: 0.74 }),
  lanternRevealDecal('beneath_folsom_lower_wall_glyph_cluster_gate_letter_right_lower', { x: 1.82, y: 1.08, z: 21.46 }, { width: 0.66, height: 0.86 }, 'glyphLetter01', { rotation: { x: 0, y: 0, z: -0.12 }, revealedOpacity: 0.72 }),
  lanternRevealDecal('beneath_folsom_lower_wall_glyph_cluster_gate_face', { x: 0.04, y: 2.45, z: 21.455 }, { width: 0.72, height: 0.82 }, 'glyphFace01', { rotation: { x: 0, y: 0, z: 0.035 }, revealedOpacity: 0.56 }),
  lanternRevealDecal('beneath_folsom_lower_wall_glyph_cluster_gate_cord_left', { x: -1.2, y: 1.62, z: 21.45 }, { width: 2.42, height: 0.22 }, 'glyphBlackCord', { rotation: { x: 0, y: 0, z: -0.9 }, revealedOpacity: 0.58 }),
  lanternRevealDecal('beneath_folsom_lower_wall_glyph_cluster_gate_cord_right', { x: 1.18, y: 1.56, z: 21.445 }, { width: 2.34, height: 0.2 }, 'glyphBlackCord', { rotation: { x: 0, y: 0, z: 0.88 }, revealedOpacity: 0.56 }),

  // A long but deliberately bounded Chapter 2 threshold. The hidden wall occludes
  // it until the growth gate runtime finishes its collapse and slow wall fade.
  ...[26, 33, 40, 47, 54].flatMap((z, index) => [
    prop(`beneath_folsom_blue_hall_rib_${index}_left`, 'BF04', { x: -3.05, y: 1.72, z }, { width: 0.42, height: 3.44, depth: 0.55 }, 'coldThresholdStone', { tags: ['blue-flame-hallway', 'threshold-rib'] }),
    prop(`beneath_folsom_blue_hall_rib_${index}_right`, 'BF04', { x: 3.05, y: 1.72, z }, { width: 0.42, height: 3.44, depth: 0.55 }, 'coldThresholdStone', { tags: ['blue-flame-hallway', 'threshold-rib'] }),
    prop(`beneath_folsom_blue_hall_rib_${index}_lintel`, 'BF04', { x: 0, y: 3.2, z }, { width: 6.5, height: 0.3, depth: 0.58 }, 'coldThresholdStone', { tags: ['blue-flame-hallway', 'threshold-rib'] }),
  ]),

  // A buried shrine maintenance hatch closes the Chapter 2/3 seam. Its broad
  // stone face and iron restraints read from the far end of the blue-flame hall.
  prop('beneath_folsom_lower_shrine_hatch', 'BF04', { x: 0, y: 1.55, z: 61.62 }, { width: 5.75, height: 3.1, depth: 0.44 }, 'wall', { tags: ['lower-shrine-hatch', 'chapter-2-endpoint', 'pryable-shrine-stone'], userData: { saveKey: 'beneath_folsom_lower_shrine_hatch_open', requiredItemId: 'iron_drain_bar' } }),
  prop('beneath_folsom_lower_shrine_hatch_band_left', 'BF04', { x: -1.72, y: 1.55, z: 61.36 }, { width: 0.28, height: 2.8, depth: 0.14 }, 'rustedIron', { tags: ['lower-shrine-hatch', 'iron-restraint', 'moving-hatch-part'] }),
  prop('beneath_folsom_lower_shrine_hatch_band_right', 'BF04', { x: 1.72, y: 1.55, z: 61.36 }, { width: 0.28, height: 2.8, depth: 0.14 }, 'rustedIron', { tags: ['lower-shrine-hatch', 'iron-restraint', 'moving-hatch-part'] }),
  prop('beneath_folsom_lower_shrine_hatch_crossbar', 'BF04', { x: 0, y: 1.2, z: 61.25 }, { width: 4.65, height: 0.3, depth: 0.22 }, 'rustedIron', { tags: ['lower-shrine-hatch', 'maintenance-pry-bar', 'moving-hatch-part'] }),
  prop('beneath_folsom_lower_shrine_hatch_frame_left', 'BF04', { x: -3.02, y: 1.62, z: 61.78 }, { width: 0.58, height: 3.24, depth: 0.78 }, 'coldThresholdStone', { tags: ['lower-shrine-hatch', 'buried-frame'] }),
  prop('beneath_folsom_lower_shrine_hatch_frame_right', 'BF04', { x: 3.02, y: 1.62, z: 61.78 }, { width: 0.58, height: 3.24, depth: 0.78 }, 'coldThresholdStone', { tags: ['lower-shrine-hatch', 'buried-frame'] }),
  prop('beneath_folsom_lower_shrine_hatch_frame_lintel', 'BF04', { x: 0, y: 3.22, z: 61.78 }, { width: 6.62, height: 0.42, depth: 0.82 }, 'coldThresholdStone', { tags: ['lower-shrine-hatch', 'buried-frame', 'shrine-lintel'] }),

  // Chapter 3 begins where the blue-flame hall gives way to older, colder stone.
  // Shallow visual treads preserve a readable descent without adding step collision.
  ...[64.2, 67.4, 70.6, 73.8, 77, 80.2].map((z, index) => prop(
    `beneath_folsom_lower_shrine_tread_${index}`,
    'BF05',
    { x: 0, y: 0.025 + index * 0.006, z },
    { width: 6.7 - index * 0.18, height: 0.05 + index * 0.012, depth: 2.25 },
    'paleFloor',
    { tags: ['chapter-3', 'lower-shrine-stair', 'non-blocking-stair-silhouette'] },
  )),
  ...[65.5, 72.5, 79.2].flatMap((z, index) => [
    prop(`beneath_folsom_lower_shrine_rib_${index}_left`, 'BF05', { x: -3.55, y: 1.82, z }, { width: 0.48, height: 3.64, depth: 0.62 }, 'paleWall', { tags: ['chapter-3', 'lower-shrine-stair', 'pale-rib'] }),
    prop(`beneath_folsom_lower_shrine_rib_${index}_right`, 'BF05', { x: 3.55, y: 1.82, z }, { width: 0.48, height: 3.64, depth: 0.62 }, 'paleWall', { tags: ['chapter-3', 'lower-shrine-stair', 'pale-rib'] }),
    prop(`beneath_folsom_lower_shrine_rib_${index}_lintel`, 'BF05', { x: 0, y: 3.48, z }, { width: 7.35, height: 0.32, depth: 0.64 }, 'paleMechanism', { tags: ['chapter-3', 'lower-shrine-stair', 'impossible-lintel'] }),
  ]),

  // A single pale floor line leads through the hall. Black scab is concentrated on
  // the route target instead of being spread across every wall.
  prop('beneath_folsom_white_scab_hall_floor_line', 'BF06', { x: 0, y: 0.035, z: 95 }, { width: 0.34, height: 0.07, depth: 24.5 }, 'paleMechanism', { tags: ['chapter-3', 'white-scab-hall', 'pale-floor-line', 'future-reveal-target'] }),
  ...[87.5, 94.5, 101.5].map((z, index) => prop(`beneath_folsom_white_scab_patch_${index}`, 'BF06', { x: index % 2 ? 0.15 : -0.12, y: 0.11, z }, { width: 2.6 + index * 0.3, height: 0.18, depth: 2.8 }, 'blackScab', { tags: ['chapter-3', 'white-scab-hall', 'black-scab', 'future-white-scab-clear'] })),
  ...[86, 96, 105].flatMap((z, index) => [
    prop(`beneath_folsom_white_hall_buttress_${index}_left`, 'BF06', { x: -5.35, y: 1.35, z }, { width: 0.62, height: 2.7, depth: 1.2 }, 'paleWall', { tags: ['chapter-3', 'white-scab-hall', 'buried-buttress'] }),
    prop(`beneath_folsom_white_hall_buttress_${index}_right`, 'BF06', { x: 5.35, y: 1.35, z }, { width: 0.62, height: 2.7, depth: 1.2 }, 'paleWall', { tags: ['chapter-3', 'white-scab-hall', 'buried-buttress'] }),
  ]),
  prop('beneath_folsom_white_scab_hall_future_seal', 'BF06', { x: 0, y: 0.23, z: 107.45 }, { width: 7.4, height: 0.46, depth: 1.05 }, 'blackScab', { collisionRef: 'beneath_folsom_ch3_white_scab_hall_blocker', tags: ['chapter-3', 'future-blocker-visual', 'white-scab-clear-required'] }),

  // Human shrine masonry surrounds an older central block and rear pale panel.
  prop('beneath_folsom_shrine_mechanism_central_block', 'BF07', { x: 0, y: 1.05, z: 118.6 }, { width: 4.4, height: 2.1, depth: 4.6 }, 'paleWall', { blocking: true, collisionRef: 'beneath_folsom_ch3_mechanism_central_block_collision', collisionPurpose: 'central mechanism block with explicit authored collision', tags: ['chapter-3', 'shrine-mechanism-room', 'central-block', 'noninteractive-foreshadowing'] }),
  prop('beneath_folsom_shrine_mechanism_block_cap', 'BF07', { x: 0, y: 2.18, z: 118.6 }, { width: 5.05, height: 0.18, depth: 5.25 }, 'paleMechanism', { tags: ['chapter-3', 'shrine-mechanism-room', 'central-block'] }),
  ...[-7.6, 7.6].flatMap((x, index) => [
    prop(`beneath_folsom_mechanism_support_${index}_front`, 'BF07', { x, y: 1.75, z: 112.2 }, { width: 1.05, height: 3.5, depth: 1.05 }, 'paleWall', { tags: ['chapter-3', 'shrine-mechanism-room', 'old-support'] }),
    prop(`beneath_folsom_mechanism_support_${index}_rear`, 'BF07', { x, y: 1.75, z: 128.2 }, { width: 1.05, height: 3.5, depth: 1.05 }, 'paleWall', { tags: ['chapter-3', 'shrine-mechanism-room', 'old-support'] }),
  ]),
  prop('beneath_folsom_pale_panel_silhouette', 'BF07', { x: 0, y: 1.72, z: 133.55 }, { width: 6.2, height: 2.75, depth: 0.18 }, 'paleMechanism', { collisionRef: 'beneath_folsom_ch3_pale_panel_chamber_blocker', tags: ['chapter-3', 'pale-panel-area', 'buried-panel-silhouette', 'noninteractive-foreshadowing'] }),
  prop('beneath_folsom_pale_panel_scab', 'BF07', { x: 0.3, y: 1.72, z: 133.42 }, { width: 5.4, height: 2.25, depth: 0.12 }, 'blackScab', { tags: ['chapter-3', 'pale-panel-area', 'black-scab', 'future-panel-clear'] }),

  // The chamber is authored now but remains sealed behind the deferred panel action.
  ...[137.5, 144.8, 152].flatMap((z, index) => [
    prop(`beneath_folsom_buried_white_rib_${index}_left`, 'BF08', { x: -7.25, y: 1.9, z }, { width: 0.55, height: 3.8, depth: 0.7 }, 'paleMechanism', { tags: ['chapter-3', 'buried-white-chamber', 'pale-machine-rib'] }),
    prop(`beneath_folsom_buried_white_rib_${index}_right`, 'BF08', { x: 7.25, y: 1.9, z }, { width: 0.55, height: 3.8, depth: 0.7 }, 'paleMechanism', { tags: ['chapter-3', 'buried-white-chamber', 'pale-machine-rib'] }),
  ]),
  prop('beneath_folsom_buried_white_collapse_left', 'BF08', { x: -5.7, y: 0.48, z: 147 }, { width: 3.4, height: 0.96, depth: 5.6 }, 'wall', { blocking: true, collisionRef: 'beneath_folsom_ch3_chamber_collapse_left_collision', collisionPurpose: 'bounded chamber collapse with explicit authored collision', rotation: { x: 0, y: -0.22, z: 0.08 }, tags: ['chapter-3', 'buried-white-chamber', 'collapsed-shrine-stone'] }),
  prop('beneath_folsom_buried_white_collapse_right', 'BF08', { x: 5.9, y: 0.36, z: 140.8 }, { width: 2.8, height: 0.72, depth: 4.2 }, 'wall', { blocking: true, collisionRef: 'beneath_folsom_ch3_chamber_collapse_right_collision', collisionPurpose: 'bounded chamber collapse with explicit authored collision', rotation: { x: 0, y: 0.3, z: -0.06 }, tags: ['chapter-3', 'buried-white-chamber', 'collapsed-shrine-stone'] }),
  prop('beneath_folsom_crypt_root_mat_visual', 'BF08', { x: 0, y: 1.7, z: 157.58 }, { width: 6.1, height: 3.05, depth: 0.28 }, 'blackScab', { collisionRef: 'beneath_folsom_ch3_crypt_root_mat_blocker', tags: ['chapter-3', 'crypt-access-root-mat', 'future-blocker-visual', 'axe-knife-bar-sequence-deferred'] }),
  ...[-2.2, -1.05, 0.2, 1.45, 2.45].map((x, index) => prop(`beneath_folsom_crypt_root_cord_${index}`, 'BF08', { x, y: 1.65 + (index % 2) * 0.35, z: 157.36 }, { width: 0.22, height: 3.4, depth: 0.18 }, 'blackGrowth', { rotation: { x: 0, y: 0, z: -0.22 + index * 0.1 }, tags: ['chapter-3', 'crypt-access-root-mat', 'black-cord'] })),

  // The crypt stair is a bounded Chapter 3 endpoint. Its treads foreshadow descent,
  // while the final wall remains a hard no-Chapter-4 boundary.
  ...[160.2, 162.7, 165.2, 167.7, 170.2, 172.7].map((z, index) => prop(`beneath_folsom_crypt_access_tread_${index}`, 'BF09', { x: 0, y: 0.035 + index * 0.008, z }, { width: 7.1 - index * 0.24, height: 0.07 + index * 0.016, depth: 1.8 }, index < 3 ? 'paleFloor' : 'wall', { tags: ['chapter-3', 'crypt-access-stair', 'non-blocking-stair-silhouette'] })),
  prop('beneath_folsom_first_crypt_future_stop', 'BF09', { x: 0, y: 1.72, z: 175.65 }, { width: 7.5, height: 3.44, depth: 0.38 }, 'wall', { collisionRef: 'beneath_folsom_ch3_first_crypt_boundary_blocker', tags: ['chapter-3-endpoint', 'future-blocker-visual', 'first-crypt-deferred', 'no-chapter-4'] }),

  // Atmospheric roots only: no interaction, hit count, or clear state.
  prop('beneath_folsom_root_wall_west', 'BF02', { x: -8.78, y: 1.72, z: 4 }, { width: 0.18, height: 0.42, depth: 12 }, 'blackGrowth', { rotation: { x: 0, y: 0, z: -0.18 }, tags: ['black-growth', 'atmospheric-only'] }),
  prop('beneath_folsom_root_ceiling', 'BF02', { x: 3.2, y: 3.15, z: 1.5 }, { width: 0.38, height: 0.18, depth: 14 }, 'blackGrowth', { rotation: { x: 0, y: 0.25, z: 0 }, tags: ['black-growth', 'atmospheric-only'] }),
  prop('beneath_folsom_root_grate', 'BF02', { x: 0.8, y: 1.85, z: 13.28 }, { width: 5.1, height: 0.32, depth: 0.22 }, 'blackGrowth', { rotation: { x: 0, y: 0, z: 0.12 }, tags: ['black-growth', 'atmospheric-only', 'future-passage'] }),
];

export const beneathFolsomDefinition = Object.freeze({
  id: 'beneath-folsom',
  displayName: 'Beneath Folsom',
  type: 'underworks',
  tags: ['interior', 'underworks', 'compiled-runtime', 'folsom-chapter-2', 'folsom-chapter-3', 'lower-shrine'],
  notes: 'Continuous Beneath Folsom route through the Chapter 2 underworks and the authored Chapter 3 lower-shrine room skeleton.',
  fog: { color: 0x030403, near: 5, far: 34 },
  lighting: { background: 0x030403 },
  textures,
  defaultFloorY: FLOOR_Y,
  defaultCeilingY: CEILING_Y,
  geometry: { wallHeight: CEILING_Y, wallThickness: 0.42, floorThickness: 0.2, ceilingThickness: 0.2, roomEdgePolicy: 'sealedUnlessDeclaredOpening' },
  rooms: [
    room('BF01', 'Underworks Entry Stair', -5, 5, -24, -10, { safeForSpawn: true, ceilingY: 3.25, tags: ['entry', 'return-route', 'descending-threshold'] }),
    room('BF02', 'First Drain Landing', -9, 9, -10, 14, { tags: ['main-chamber', 'damp-stone', 'no-encounters'] }),
    room('BF03', 'Lower Drain Throat', -3.6, 3.6, 14, 22, { tags: ['maintenance-alcove', 'opened-threshold', 'no-encounters'] }),
    room('BF04', 'Blue Flame Threshold', -3.6, 3.6, 22, 62, { tags: ['chapter-2-capstone', 'blue-flame-hallway', 'chapter-3-seam', 'no-encounters'] }),
    room('BF05', 'Lower Shrine Stair', -4.2, 4.2, 62, 82, { ceilingY: 3.75, floorTexture: 'paleFloor', wallTexture: 'paleWall', ceilingTexture: 'paleCeiling', tags: ['chapter-3', 'lower-shrine-stair', 'cold-descent', 'no-encounters'] }),
    room('BF06', 'White-Scab Hall', -6, 6, 82, 108, { ceilingY: 3.8, floorTexture: 'paleFloor', wallTexture: 'paleWall', ceilingTexture: 'paleCeiling', tags: ['chapter-3', 'white-scab-hall', 'future-mechanic-proof', 'no-encounters'] }),
    room('BF07', 'Shrine Mechanism Room', -10, 10, 108, 134, { ceilingY: 4.2, floorTexture: 'paleFloor', wallTexture: 'paleWall', ceilingTexture: 'paleCeiling', tags: ['chapter-3', 'shrine-mechanism-room', 'pale-panel-area', 'no-encounters'] }),
    room('BF08', 'Buried White Chamber', -8, 8, 134, 158, { ceilingY: 4, floorTexture: 'paleFloor', wallTexture: 'paleWall', ceilingTexture: 'paleCeiling', tags: ['chapter-3', 'buried-white-chamber', 'collapsed', 'no-encounters'] }),
    room('BF09', 'Crypt Access Stair', -4.4, 4.4, 158, 176, { ceilingY: 3.6, floorTexture: 'paleFloor', wallTexture: 'paleWall', ceilingTexture: 'paleCeiling', tags: ['chapter-3', 'crypt-access-stair', 'chapter-endpoint', 'first-crypt-deferred', 'no-encounters'] }),
  ],
  doors: [{
    id: 'beneath_folsom_entry_to_landing',
    fromRoom: 'BF01',
    toRoom: 'BF02',
    position: { x: 0, y: FLOOR_Y, z: -10 },
    navWaypoint: { x: 0, y: FLOOR_Y, z: -10 },
    width: 5.2,
    wallGaps: [wallGap('BF01', 0, -10, 5.2), wallGap('BF02', 0, -10, 5.2)],
    tags: ['open-threshold'],
  }, {
    id: 'beneath_folsom_landing_to_drain_throat',
    fromRoom: 'BF02',
    toRoom: 'BF03',
    position: { x: 0, y: FLOOR_Y, z: 14 },
    navWaypoint: { x: 0, y: FLOOR_Y, z: 14 },
    width: 6.2,
    wallGaps: [wallGap('BF02', 0, 14, 6.2), wallGap('BF03', 0, 14, 6.2)],
    tags: ['jammed-threshold', 'opens-after-pry'],
  }, {
    id: 'beneath_folsom_hidden_gate_to_blue_hall',
    fromRoom: 'BF03',
    toRoom: 'BF04',
    position: { x: 0, y: FLOOR_Y, z: 22 },
    navWaypoint: { x: 0, y: FLOOR_Y, z: 22 },
    width: 6.2,
    wallGaps: [wallGap('BF03', 0, 22, 6.2), wallGap('BF04', 0, 22, 6.2)],
    tags: ['hidden-growth-gate', 'opens-after-five-hits', 'chapter-2-capstone'],
  }, {
    id: 'beneath_folsom_blue_hall_to_lower_shrine_stair',
    fromRoom: 'BF04', toRoom: 'BF05', position: { x: 0, y: FLOOR_Y, z: 62 }, navWaypoint: { x: 0, y: FLOOR_Y, z: 62 }, width: 6.2,
    wallGaps: [wallGap('BF04', 0, 62, 6.2), wallGap('BF05', 0, 62, 6.2)], tags: ['chapter-2-to-3-seam', 'open-after-existing-chapter-2-clear-path'],
  }, {
    id: 'beneath_folsom_lower_shrine_stair_to_white_scab_hall',
    fromRoom: 'BF05', toRoom: 'BF06', position: { x: 0, y: FLOOR_Y, z: 82 }, navWaypoint: { x: 0, y: FLOOR_Y, z: 82 }, width: 7,
    wallGaps: [wallGap('BF05', 0, 82, 7), wallGap('BF06', 0, 82, 7)], tags: ['chapter-3-route', 'open-threshold'],
  }, {
    id: 'beneath_folsom_white_scab_hall_to_shrine_mechanism',
    fromRoom: 'BF06', toRoom: 'BF07', position: { x: 0, y: FLOOR_Y, z: 108 }, navWaypoint: { x: 0, y: FLOOR_Y, z: 108 }, width: 7.4,
    wallGaps: [wallGap('BF06', 0, 108, 7.4), wallGap('BF07', 0, 108, 7.4)], tags: ['chapter-3-route', 'future-white-scab-clear'],
  }, {
    id: 'beneath_folsom_shrine_mechanism_to_buried_white_chamber',
    fromRoom: 'BF07', toRoom: 'BF08', position: { x: 0, y: FLOOR_Y, z: 134 }, navWaypoint: { x: 0, y: FLOOR_Y, z: 134 }, width: 8,
    wallGaps: [wallGap('BF07', 0, 134, 8), wallGap('BF08', 0, 134, 8)], tags: ['chapter-3-route', 'future-pale-panel-activation'],
  }, {
    id: 'beneath_folsom_buried_white_chamber_to_crypt_access',
    fromRoom: 'BF08', toRoom: 'BF09', position: { x: 0, y: FLOOR_Y, z: 158 }, navWaypoint: { x: 0, y: FLOOR_Y, z: 158 }, width: 6.2,
    wallGaps: [wallGap('BF08', 0, 158, 6.2), wallGap('BF09', 0, 158, 6.2)], tags: ['chapter-3-route', 'future-root-mat-and-pry'],
  }],
  blockers: [{ id: 'beneath_folsom_drain_grate_blocker', type: 'gate', minX: -3.1, maxX: 3.1, minZ: 13.15, maxZ: 13.85, height: 3.1, blocksPlayer: true, blocksActors: true, tags: ['jammed-drain-grate', 'pryable', 'blocks-deeper-access'], userData: { requiredItemId: 'iron_drain_bar', saveKey: 'beneath_folsom_drain_grate_pried' } },
    { id: 'beneath_folsom_hidden_growth_gate_blocker', type: 'gate', minX: -3.25, maxX: 3.25, minZ: 21.48, maxZ: 22.02, height: 3.3, blocksPlayer: true, blocksActors: true, tags: ['hidden-growth-gate', 'chapter-2-capstone'], userData: { requiredItemId: 'old_work_knife', revealItemId: 'keepers_lantern', hitsRequired: 5, saveKey: 'beneath_folsom_hidden_growth_gate_cleared' } },
    { id: 'beneath_folsom_lower_shrine_hatch_blocker', type: 'gate', minX: -3.05, maxX: 3.05, minZ: 61.28, maxZ: 62.02, height: 3.3, blocksPlayer: true, blocksActors: true, tags: ['lower-shrine-hatch', 'chapter-2-endpoint', 'pryable'], userData: { requiredItemId: 'iron_drain_bar', prerequisiteStateKey: 'beneath_folsom_hidden_growth_gate_cleared', saveKey: 'beneath_folsom_lower_shrine_hatch_open' } },
    { id: 'beneath_folsom_ch3_white_scab_hall_blocker', type: 'futureGate', minX: -3.7, maxX: 3.7, minZ: 107.25, maxZ: 108.15, height: 1, blocksPlayer: true, blocksActors: true, tags: ['chapter-3', 'future-blocker', 'white-scab-clear-deferred'], userData: { plannedSaveKey: 'beneath_folsom_white_mechanism_exposed', requiredItems: ['keepers_lantern', 'wood_axe', 'old_work_knife'], implementationState: 'deferred' } },
    { id: 'beneath_folsom_ch3_pale_panel_chamber_blocker', type: 'futureGate', minX: -4, maxX: 4, minZ: 133.35, maxZ: 134.2, height: 3.3, blocksPlayer: true, blocksActors: true, tags: ['chapter-3', 'future-blocker', 'pale-panel-activation-deferred'], userData: { plannedSaveKey: 'beneath_folsom_pale_panel_activated', requiredItem: 'keepers_lantern', implementationState: 'deferred' } },
    { id: 'beneath_folsom_ch3_crypt_root_mat_blocker', type: 'futureGate', minX: -3.1, maxX: 3.1, minZ: 157.25, maxZ: 158.2, height: 3.3, blocksPlayer: true, blocksActors: true, tags: ['chapter-3', 'future-blocker', 'crypt-root-mat-deferred'], userData: { plannedSaveKey: 'beneath_folsom_crypt_access_stair_open', requiredItems: ['wood_axe', 'old_work_knife', 'iron_drain_bar'], implementationState: 'deferred' } },
    { id: 'beneath_folsom_ch3_first_crypt_boundary_blocker', type: 'chapterBoundary', minX: -3.8, maxX: 3.8, minZ: 175.35, maxZ: 176, height: 3.6, blocksPlayer: true, blocksActors: true, tags: ['chapter-3-endpoint', 'future-blocker', 'first-crypt-deferred', 'no-chapter-4'], userData: { implementationState: 'hard-boundary', nextChapter: 4, nextLocation: 'First Crypt' } },
    { id: 'beneath_folsom_ch3_mechanism_central_block_collision', type: 'environment', minX: -2.2, maxX: 2.2, minZ: 116.3, maxZ: 120.9, height: 2.1, blocksPlayer: true, blocksActors: true, tags: ['chapter-3', 'environment-collision', 'central-block'] },
    { id: 'beneath_folsom_ch3_chamber_collapse_left_collision', type: 'environment', minX: -7.6, maxX: -3.8, minZ: 144.1, maxZ: 149.9, height: 1, blocksPlayer: true, blocksActors: true, tags: ['chapter-3', 'environment-collision', 'collapsed-shrine-stone'] },
    { id: 'beneath_folsom_ch3_chamber_collapse_right_collision', type: 'environment', minX: 4.3, maxX: 7.5, minZ: 138.5, maxZ: 143.1, height: 0.75, blocksPlayer: true, blocksActors: true, tags: ['chapter-3', 'environment-collision', 'collapsed-shrine-stone'] },
  ],
  props,
  spawns: [
    { id: 'beneath_folsom_underworks_arrival', kind: 'player', position: { x: 0, y: 1.55, z: -19.2 }, yaw: 0, roomId: 'BF01', tags: ['entry', 'safe-spawn', 'from-folsom'] },
  ],
  exits: [{
    id: 'beneath_folsom_return_to_folsom',
    fromLocation: 'beneath-folsom',
    toLocation: 'folsom',
    triggerRect: { minX: -2.8, maxX: 2.8, minZ: -23.8, maxZ: -20.8 },
    position: { x: 0, y: 1.2, z: -22.4 },
    destinationSpawnId: 'folsom_underworks_return',
    promptText: 'Return to Folsom',
    roomId: 'BF01',
    wallGaps: [wallGap('BF01', 0, -24, 5.2)],
    tags: ['folsom-return', 'obvious-return-route'],
    userData: { transitionMessage: 'Daylight waits above.' },
  }],
  lights: [
    { id: 'beneath_folsom_damp_ambient', kind: 'ambient', skyColor: 0x52615c, groundColor: 0x111715, intensity: 0.55 },
    { id: 'beneath_folsom_entry_cold_fill', kind: 'point', color: 0x91a99e, intensity: 0.95, distance: 12, decay: 1.55, position: { x: 0, y: 2.25, z: -19 }, roomId: 'BF01' },
    { id: 'beneath_folsom_landing_wet_fill', kind: 'point', color: 0x718f83, intensity: 0.8, distance: 15, decay: 1.6, position: { x: -4.5, y: 1.25, z: 1 }, roomId: 'BF02' },
    { id: 'beneath_folsom_deeper_boundary_fill', kind: 'point', color: 0x544f3b, intensity: 0.42, distance: 10, decay: 1.7, position: { x: 1.5, y: 1.8, z: 10 }, roomId: 'BF02' },
    { id: 'beneath_folsom_lower_shrine_cold_light', kind: 'point', color: 0x9cb8b5, intensity: 0.62, distance: 15, decay: 1.8, position: { x: 0, y: 2.5, z: 73 }, roomId: 'BF05' },
    { id: 'beneath_folsom_white_scab_hall_pale_light', kind: 'point', color: 0xb8cfcb, intensity: 0.7, distance: 17, decay: 1.85, position: { x: -1.5, y: 2.1, z: 96 }, roomId: 'BF06' },
    { id: 'beneath_folsom_mechanism_room_dead_light', kind: 'point', color: 0xcbd8d4, intensity: 0.66, distance: 18, decay: 1.9, position: { x: 0, y: 3.05, z: 120 }, roomId: 'BF07' },
    { id: 'beneath_folsom_buried_white_chamber_light', kind: 'point', color: 0x91aaa7, intensity: 0.5, distance: 16, decay: 1.95, position: { x: 2.5, y: 2.6, z: 146 }, roomId: 'BF08' },
    { id: 'beneath_folsom_crypt_stair_dark_light', kind: 'point', color: 0x657b82, intensity: 0.35, distance: 12, decay: 2, position: { x: 0, y: 1.9, z: 166 }, roomId: 'BF09' },
  ],
  interactions: [{ id: 'beneath_folsom_iron_drain_bar_pickup', type: 'equipmentPickup', itemId: 'iron_drain_bar', target: { x: -7.55, y: 0.9, z: -1.8 }, range: 3.1, hint: 'Iron Drain Bar', message: 'Iron Drain Bar Acquired.', acquiredMessage: 'Iron Drain Bar Acquired.', repeatMessage: '', roomId: 'BF02', tags: ['maintenance-tool', 'environmental-discovery'] }, {
    id: 'beneath_folsom_drain_grate_pry',
    type: 'beneathFolsomDrainGrate',
    target: { x: 0, y: 1.3, z: 11.2 },
    range: 3.2,
    hint: 'Jammed drain grate',
    message: 'The old drain bars shriek open.',
    failMessage: 'The grate will not move by hand.',
    requiredItemId: 'iron_drain_bar',
    saveKey: 'beneath_folsom_drain_grate_pried',
    roomId: 'BF02',
  }, {
    id: 'beneath_folsom_lower_shrine_hatch_pry',
    type: 'beneathFolsomLowerShrineHatch',
    target: { x: 0, y: 1.3, z: 59.65 },
    range: 3.25,
    hint: 'Buried lower shrine hatch',
    message: 'Iron bites stone. The lower shrine hatch tears open.',
    failMessage: 'The stone-bound hatch will not move by hand.',
    prerequisiteStateKey: 'beneath_folsom_hidden_growth_gate_cleared',
    saveKey: 'beneath_folsom_lower_shrine_hatch_open',
    roomId: 'BF04',
  }],
  navigation: { roomGraph: { roomIds: ['BF01', 'BF02', 'BF03', 'BF04', 'BF05', 'BF06', 'BF07', 'BF08', 'BF09'], links: [
    { id: 'beneath_folsom_entry_to_landing', fromRoom: 'BF01', toRoom: 'BF02', navWaypoint: { x: 0, y: 0, z: -10 } },
    { id: 'beneath_folsom_landing_to_drain_throat', fromRoom: 'BF02', toRoom: 'BF03', navWaypoint: { x: 0, y: 0, z: 14 } },
    { id: 'beneath_folsom_hidden_gate_to_blue_hall', fromRoom: 'BF03', toRoom: 'BF04', navWaypoint: { x: 0, y: 0, z: 22 } },
    { id: 'beneath_folsom_blue_hall_to_lower_shrine_stair', fromRoom: 'BF04', toRoom: 'BF05', navWaypoint: { x: 0, y: 0, z: 62 } },
    { id: 'beneath_folsom_lower_shrine_stair_to_white_scab_hall', fromRoom: 'BF05', toRoom: 'BF06', navWaypoint: { x: 0, y: 0, z: 82 } },
    { id: 'beneath_folsom_white_scab_hall_to_shrine_mechanism', fromRoom: 'BF06', toRoom: 'BF07', navWaypoint: { x: 0, y: 0, z: 108 } },
    { id: 'beneath_folsom_shrine_mechanism_to_buried_white_chamber', fromRoom: 'BF07', toRoom: 'BF08', navWaypoint: { x: 0, y: 0, z: 134 } },
    { id: 'beneath_folsom_buried_white_chamber_to_crypt_access', fromRoom: 'BF08', toRoom: 'BF09', navWaypoint: { x: 0, y: 0, z: 158 } },
  ] }, localAvoidanceHints: [], forbiddenZones: [], preferredPatrolRoutes: [] },
  encounterZones: [],
});
