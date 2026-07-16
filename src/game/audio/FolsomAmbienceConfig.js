export const FOLSOM_DAY_AMBIENCE_CUES = Object.freeze({
  baseLoop: 'audio_ch1_folsom_exterior_day_base_ambience_loop',
  grassLoop: 'audio_ch1_folsom_exterior_day_grass_texture_loop',
  distantLife: Object.freeze([
    'audio_ch1_folsom_exterior_day_distant_life_01_oneshot',
    'audio_ch1_folsom_exterior_day_distant_life_02_oneshot',
  ]),
  woodSettle: 'audio_ch1_folsom_exterior_day_wood_settle_01_oneshot',
});

export const FOLSOM_DAY_AMBIENCE_LOOP_KEYS = Object.freeze({
  base: 'folsom:exterior-day-base',
  grass: 'folsom:exterior-day-grass',
});

export const FOLSOM_DAY_AMBIENCE_PROFILE = Object.freeze({
  activationDayWeight: 0.015,
  baseVolume: 0.58,
  grassVolume: 0.24,
  loopFadeSeconds: 1.6,
  locationExitFadeSeconds: 2,
  distantLifeIntervalSeconds: Object.freeze([12, 28]),
  woodSettleIntervalSeconds: Object.freeze([22, 50]),
  randomizedOneShotCooldownSeconds: 3,
  distantLifeAudibleRange: 48,
  woodSettleAudibleRange: 25,
});

// These descriptors resolve against DungeonScene.outdoorSurfaceDefinition at playback time.
// Foliage positions and wooden-structure centers remain owned by the canonical Folsom definition.
export const FOLSOM_DISTANT_LIFE_ANCHORS = Object.freeze([
  Object.freeze({
    id: 'folsom-distant-life-west-courtyard-grove',
    sourceCollection: 'foliageBillboards',
    sourceId: 'folsom_inside_cedar_redwood_belt_001',
    heightOffset: 3.2,
    meaning: 'The inner western cedar-redwood belt beyond the courtyard and shrine path.',
  }),
  Object.freeze({
    id: 'folsom-distant-life-south-pond-bank',
    sourceCollection: 'foliageBillboards',
    sourceId: 'folsom_pond_west_reed_bank_003',
    heightOffset: 3.2,
    meaning: 'The cedar and reed bank beyond the southwest edge of the Folsom pond.',
  }),
  Object.freeze({
    id: 'folsom-distant-life-southeast-screen',
    sourceCollection: 'foliageBillboards',
    sourceId: 'folsom_southeast_redwood_screen_002',
    heightOffset: 3.2,
    meaning: 'The southeast redwood screen beyond the house and pond approach.',
  }),
  Object.freeze({
    id: 'folsom-distant-life-northeast-road-grove',
    sourceCollection: 'foliageBillboards',
    sourceId: 'folsom_north_road_cedar_redwoods_003',
    heightOffset: 3.2,
    meaning: 'The northeast cedar-redwood grove bordering the North Road corridor.',
  }),
]);

export const FOLSOM_WOOD_STRUCTURE_ANCHORS = Object.freeze([
  Object.freeze({
    id: 'folsom-wood-settle-tool-shed-roof',
    sourceCollection: 'props',
    sourceId: 'folsom_shed_roof_west_pitch',
    meaning: 'The west pitch of the rebuilt wooden tool-shed roof.',
  }),
  Object.freeze({
    id: 'folsom-wood-settle-tool-shed-east-roof',
    sourceCollection: 'props',
    sourceId: 'folsom_shed_roof_east_pitch',
    meaning: 'The east pitch of the rebuilt wooden tool-shed roof.',
  }),
  Object.freeze({
    id: 'folsom-wood-settle-caretaker-house-west-wall',
    sourceCollection: 'wallSegments',
    sourceId: 'folsom_house_west',
    heightRatio: 0.55,
    meaning: 'The aged-wood west wall of the caretaker house.',
  }),
  Object.freeze({
    id: 'folsom-wood-settle-caretaker-house-north-wall',
    sourceCollection: 'wallSegments',
    sourceId: 'folsom_house_north',
    heightRatio: 0.55,
    meaning: 'The aged-wood north wall of the caretaker house.',
  }),
  Object.freeze({
    id: 'folsom-wood-settle-shrine-keeper-header',
    sourceCollection: 'architecturalPrimitives',
    sourceId: 'folsom_shrine_keeper_frame_north_header',
    heightRatio: 0.5,
    meaning: 'The old wooden maintenance header in the shrine keeper side room.',
  }),
  Object.freeze({
    id: 'folsom-wood-settle-north-palisade',
    sourceCollection: 'wallSegments',
    sourceId: 'folsom_city_border_wooden_wall_panel_014',
    heightRatio: 0.5,
    meaning: 'The wooden north palisade immediately west of the North Road opening.',
  }),
]);
