export const OUTDOOR_SMALL_FOLIAGE_SPRITES = Object.freeze([
  { id: 'billboard_tree_windswept_field_01', path: './assets/sprites/foliage/billboard_tree_windswept_field_01.png', type: 'tree', width: 0.78, groundOffset: -0.04, rootOffsetY: -0.1, bottomTransparentPaddingRatio: 0.035 },
  { id: 'billboard_bush_ritual_seedpod_01', path: './assets/sprites/foliage/billboard_bush_ritual_seedpod_01.png', type: 'bush', width: 0.98, groundOffset: -0.025, rootOffsetY: -0.06, bottomTransparentPaddingRatio: 0.06 },
  { id: 'billboard_bush_dead_scrub_01', path: './assets/sprites/foliage/billboard_bush_dead_scrub_01.png', type: 'bush', width: 1.12, groundOffset: -0.025, rootOffsetY: -0.07, bottomTransparentPaddingRatio: 0.07 },
  { id: 'billboard_bush_dark_bramble_01', path: './assets/sprites/foliage/billboard_bush_dark_bramble_01.png', type: 'bush', width: 1.08, groundOffset: -0.025, rootOffsetY: -0.075, bottomTransparentPaddingRatio: 0.065 },
  { id: 'billboard_tree_pale_ashen_willow_01', path: './assets/sprites/foliage/billboard_tree_pale_ashen_willow_01.png', type: 'tree', width: 0.86 },
  { id: 'billboard_tree_black_cypress_01', path: './assets/sprites/foliage/billboard_tree_black_cypress_01.png', type: 'tree', width: 0.72, groundOffset: -0.04, rootOffsetY: -0.12, bottomTransparentPaddingRatio: 0.04 },
  { id: 'billboard_tree_gnarled_ritual_01', path: './assets/sprites/foliage/billboard_tree_gnarled_ritual_01.png', type: 'tree', width: 0.92, groundOffset: -0.03, rootOffsetY: -0.09, bottomTransparentPaddingRatio: 0.055 },
  { id: 'billboard_tree_thorn_crowned_01', path: './assets/sprites/foliage/billboard_tree_thorn_crowned_01.png', type: 'tree', width: 0.88 },
]);

export const OUTDOOR_FOLSOM_DARK_GROVE_FOLIAGE_SPRITES = Object.freeze([
  { id: 'folsom_dark_grove_tree_01_broad_canopy', path: './assets/sprites/foliage/folsom_dark_grove_tree_01_broad_canopy.png', type: 'folsom-dark-grove', width: 0.84, groundOffset: -0.06, rootOffsetY: -0.18, bottomTransparentPaddingRatio: 0.045 },
  { id: 'folsom_dark_grove_tree_02_tall_spire', path: './assets/sprites/foliage/folsom_dark_grove_tree_02_tall_spire.png', type: 'folsom-dark-grove', width: 0.58, groundOffset: -0.065, rootOffsetY: -0.2, bottomTransparentPaddingRatio: 0.04 },
  { id: 'folsom_dark_grove_tree_03_column_canopy', path: './assets/sprites/foliage/folsom_dark_grove_tree_03_column_canopy.png', type: 'folsom-dark-grove', width: 0.66, groundOffset: -0.06, rootOffsetY: -0.19, bottomTransparentPaddingRatio: 0.045 },
  { id: 'folsom_dark_grove_tree_04_wide_tiered', path: './assets/sprites/foliage/folsom_dark_grove_tree_04_wide_tiered.png', type: 'folsom-dark-grove', width: 0.9, groundOffset: -0.06, rootOffsetY: -0.18, bottomTransparentPaddingRatio: 0.05 },
  { id: 'folsom_dark_grove_tree_05_mossy_roots', path: './assets/sprites/foliage/folsom_dark_grove_tree_05_mossy_roots.png', type: 'folsom-dark-grove', width: 0.78, groundOffset: -0.08, rootOffsetY: -0.24, bottomTransparentPaddingRatio: 0.035 },
  { id: 'folsom_dark_grove_tree_06_twisted_deadwood', path: './assets/sprites/foliage/folsom_dark_grove_tree_06_twisted_deadwood.png', type: 'folsom-dark-grove', width: 0.72, groundOffset: -0.07, rootOffsetY: -0.22, bottomTransparentPaddingRatio: 0.035 },
  { id: 'folsom_dark_grove_tree_07_haunted_sentinel', path: './assets/sprites/foliage/folsom_dark_grove_tree_07_haunted_sentinel.png', type: 'folsom-dark-grove', width: 0.7, groundOffset: -0.07, rootOffsetY: -0.22, bottomTransparentPaddingRatio: 0.04 },
  { id: 'folsom_dark_grove_tree_08_moody_foliage', path: './assets/sprites/foliage/folsom_dark_grove_tree_08_moody_foliage.png', type: 'folsom-dark-grove', width: 0.82, groundOffset: -0.06, rootOffsetY: -0.18, bottomTransparentPaddingRatio: 0.045 },
]);

export const OUTDOOR_REDWOOD_FOLIAGE_SPRITES = Object.freeze([
  { id: 'billboard_tree_redwood_tiered_sacred_01', path: './assets/sprites/foliage/billboard_tree_redwood_tiered_sacred_01.png', type: 'redwood', width: 0.66 },
  { id: 'billboard_tree_redwood_umbrella_crown_01', path: './assets/sprites/foliage/billboard_tree_redwood_umbrella_crown_01.png', type: 'redwood', width: 0.74 },
  { id: 'billboard_tree_redwood_cathedral_01', path: './assets/sprites/foliage/billboard_tree_redwood_cathedral_01.png', type: 'redwood', width: 0.7 },
  { id: 'billboard_tree_redwood_moss_draped_01', path: './assets/sprites/foliage/billboard_tree_redwood_moss_draped_01.png', type: 'redwood', width: 0.76 },
  { id: 'billboard_tree_redwood_ancient_carved_01', path: './assets/sprites/foliage/billboard_tree_redwood_ancient_carved_01.png', type: 'redwood', width: 0.68 },
  { id: 'billboard_tree_redwood_runic_giant_01', path: './assets/sprites/foliage/billboard_tree_redwood_runic_giant_01.png', type: 'redwood', width: 0.72 },
]);

export const OUTDOOR_FOLIAGE_SPRITES = Object.freeze([
  ...OUTDOOR_SMALL_FOLIAGE_SPRITES,
  ...OUTDOOR_REDWOOD_FOLIAGE_SPRITES,
  ...OUTDOOR_FOLSOM_DARK_GROVE_FOLIAGE_SPRITES,
]);
