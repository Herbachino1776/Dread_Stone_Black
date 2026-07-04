const FLOOR_Y = 0;
const CEILING_Y = 3.45;

const textures = Object.freeze({
  wall: { path: './assets/textures/wall_black_stone_01.png', repeat: [3.4, 1.4], color: 0x4d5049, roughness: 0.99, emissive: 0x080b09, emissiveIntensity: 0.12 },
  floor: { path: './assets/textures/floor_worn_stone_01.png', repeat: [3.2, 4.2], color: 0x53564e, roughness: 1, emissive: 0x090b09, emissiveIntensity: 0.12 },
  ceiling: { path: './assets/textures/ceiling_dark_stone_01.png', repeat: [3.2, 3.2], color: 0x353833, roughness: 1, emissive: 0x050706, emissiveIntensity: 0.08 },
  wetStone: { path: './assets/textures/floor_worn_stone_01.png', repeat: [2.2, 3.4], color: 0x293635, roughness: 0.72, metalness: 0.08, emissive: 0x06100f, emissiveIntensity: 0.14 },
  mud: { path: './assets/textures/outdoor/field_dead_grass_01.png', repeat: [2.2, 2.2], color: 0x242118, roughness: 1, emissive: 0x080704, emissiveIntensity: 0.08 },
  timber: { path: './assets/textures/pack1/wood_dark_aged_01.png', repeat: [1.6, 1.2], color: 0x4a3528, roughness: 1, emissive: 0x090503, emissiveIntensity: 0.08 },
  rustedIron: { path: './assets/textures/metal_gate_rusted_01.png', repeat: [1.2, 1.4], color: 0x51443b, roughness: 0.9, metalness: 0.36 },
  blackGrowth: { path: './assets/textures/growth/black_growth_cord_surface_01.png', repeat: [2.8, 1.1], color: 0x1d211d, roughness: 0.84, emissive: 0x020302, emissiveIntensity: 0.12 },
  blackScab: { path: './assets/textures/growth/black_growth_scab_intact_02.png', repeat: [1.2, 1.2], color: 0x242824, roughness: 0.82, emissive: 0x020302, emissiveIntensity: 0.1 },
});

function room(id, label, minX, maxX, minZ, maxZ, options = {}) {
  return {
    id, label, minX, maxX, minZ, maxZ,
    floorY: FLOOR_Y,
    ceilingY: options.ceilingY ?? CEILING_Y,
    floorTexture: options.floorTexture ?? 'floor',
    wallTexture: 'wall',
    ceilingTexture: 'ceiling',
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
    tags: ['beneath-folsom', options.blocking ? 'solid' : 'non-blocking-decor', ...(options.tags ?? [])],
    userData: {
      blockingMode: options.blocking ? 'solid' : 'nonBlockingDecor',
      collisionPurpose: options.collisionPurpose ?? 'production-intentional environmental dressing',
    },
  };
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

  // The lower route is visible but physically remains part of the sealed north wall.
  prop('beneath_folsom_deeper_dark_recess', 'BF02', { x: 0, y: 1.48, z: 13.72 }, { width: 6.6, height: 2.75, depth: 0.12 }, 'blackScab', { tags: ['future-passage', 'inaccessible', 'growth-boundary'] }),
  ...[-2.5, -1.25, 0, 1.25, 2.5].map((x, index) => prop(`beneath_folsom_deeper_grate_bar_${index}`, 'BF02', { x, y: 1.55, z: 13.48 }, { width: 0.18, height: 2.85, depth: 0.18 }, 'rustedIron', { tags: ['future-passage', 'old-drain-grate'] })),
  prop('beneath_folsom_deeper_grate_header', 'BF02', { x: 0, y: 2.92, z: 13.48 }, { width: 6.2, height: 0.22, depth: 0.25 }, 'rustedIron', { tags: ['future-passage', 'old-drain-grate'] }),

  // Atmospheric roots only: no interaction, hit count, or clear state.
  prop('beneath_folsom_root_wall_west', 'BF02', { x: -8.78, y: 1.72, z: 4 }, { width: 0.18, height: 0.42, depth: 12 }, 'blackGrowth', { rotation: { x: 0, y: 0, z: -0.18 }, tags: ['black-growth', 'atmospheric-only'] }),
  prop('beneath_folsom_root_ceiling', 'BF02', { x: 3.2, y: 3.15, z: 1.5 }, { width: 0.38, height: 0.18, depth: 14 }, 'blackGrowth', { rotation: { x: 0, y: 0.25, z: 0 }, tags: ['black-growth', 'atmospheric-only'] }),
  prop('beneath_folsom_root_grate', 'BF02', { x: 0.8, y: 1.85, z: 13.28 }, { width: 5.1, height: 0.32, depth: 0.22 }, 'blackGrowth', { rotation: { x: 0, y: 0, z: 0.12 }, tags: ['black-growth', 'atmospheric-only', 'future-passage'] }),
];

export const beneathFolsomDefinition = Object.freeze({
  id: 'beneath-folsom',
  displayName: 'Beneath Folsom',
  type: 'underworks',
  tags: ['interior', 'underworks', 'compiled-runtime', 'folsom-chapter-2', 'entry-slice'],
  notes: 'First playable under-town landing only. The deeper north drain remains intentionally inaccessible.',
  fog: { color: 0x18201e, near: 5, far: 34 },
  lighting: { background: 0x090c0b },
  textures,
  defaultFloorY: FLOOR_Y,
  defaultCeilingY: CEILING_Y,
  geometry: { wallHeight: CEILING_Y, wallThickness: 0.42, floorThickness: 0.2, ceilingThickness: 0.2, roomEdgePolicy: 'sealedUnlessDeclaredOpening' },
  rooms: [
    room('BF01', 'Underworks Entry Stair', -5, 5, -24, -10, { safeForSpawn: true, ceilingY: 3.25, tags: ['entry', 'return-route', 'descending-threshold'] }),
    room('BF02', 'First Drain Landing', -9, 9, -10, 14, { tags: ['main-chamber', 'damp-stone', 'no-encounters'] }),
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
  }],
  blockers: [],
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
  ],
  interactions: [{
    id: 'beneath_folsom_deeper_passage_inspect',
    type: 'inspect',
    target: { x: 0, y: 1.3, z: 11.2 },
    range: 3.2,
    hint: 'Inspect the lower drain',
    message: 'Black roots have packed the lower drain shut.',
    roomId: 'BF02',
  }],
  navigation: { roomGraph: { roomIds: ['BF01', 'BF02'], links: [{ id: 'beneath_folsom_entry_to_landing', fromRoom: 'BF01', toRoom: 'BF02', navWaypoint: { x: 0, y: 0, z: -10 } }] }, localAvoidanceHints: [], forbiddenZones: [], preferredPatrolRoutes: [] },
  encounterZones: [],
});
