const CATEGORY_DEFAULTS = Object.freeze({ tree: { sinkIntoGround: 0.12, rootFootprintRadius: 0.14, maximumPlacementSlope: 0.48, placementCategory: 'canopy-tree' }, redwood: { sinkIntoGround: 0.16, rootFootprintRadius: 0.18, maximumPlacementSlope: 0.4, placementCategory: 'large-canopy-tree' }, bush: { sinkIntoGround: 0.06, rootFootprintRadius: 0.12, maximumPlacementSlope: 0.58, placementCategory: 'understory-bush' }, 'folsom-dark-grove': { sinkIntoGround: 0.15, rootFootprintRadius: 0.17, maximumPlacementSlope: 0.43, placementCategory: 'grove-tree' } });
const grounded = (sprite) => {
  if (!Number.isFinite(sprite.bottomTransparentPaddingRatio)) throw new Error(`Outdoor foliage sprite ${sprite.id} is missing an audited alpha baseline.`);
  return Object.freeze({ groundOffset: 0, rootOffsetY: 0, ...CATEGORY_DEFAULTS[sprite.type], ...sprite, alphaBaselineAudited: true });
};
export const resolveOutdoorFoliageGrounding = (placement={},variant={},registry={}) => ({ ...CATEGORY_DEFAULTS[registry.type] ?? CATEGORY_DEFAULTS.tree, ...registry, ...variant, ...placement });

export const OUTDOOR_SMALL_FOLIAGE_SPRITES = Object.freeze([
  { id: 'billboard_tree_windswept_field_01', path: './assets/sprites/foliage/billboard_tree_windswept_field_01.png', type: 'tree', width: 0.78, groundOffset: -0.04, rootOffsetY: -0.1, bottomTransparentPaddingRatio: 0.0557 },
  { id: 'billboard_bush_ritual_seedpod_01', path: './assets/sprites/foliage/billboard_bush_ritual_seedpod_01.png', type: 'bush', width: 0.98, groundOffset: -0.025, rootOffsetY: -0.06, bottomTransparentPaddingRatio: 0.0547 },
  { id: 'billboard_bush_dead_scrub_01', path: './assets/sprites/foliage/billboard_bush_dead_scrub_01.png', type: 'bush', width: 1.12, groundOffset: -0.025, rootOffsetY: -0.07, bottomTransparentPaddingRatio: 0.0537 },
  { id: 'billboard_bush_dark_bramble_01', path: './assets/sprites/foliage/billboard_bush_dark_bramble_01.png', type: 'bush', width: 1.08, groundOffset: -0.025, rootOffsetY: -0.075, bottomTransparentPaddingRatio: 0.0537 },
  { id: 'billboard_tree_pale_ashen_willow_01', path: './assets/sprites/foliage/billboard_tree_pale_ashen_willow_01.png', type: 'tree', width: 0.86, groundOffset: -0.04, rootOffsetY: -0.12, bottomTransparentPaddingRatio: 0.0508, rootFootprintRadius: 0.2 },
  { id: 'billboard_tree_black_cypress_01', path: './assets/sprites/foliage/billboard_tree_black_cypress_01.png', type: 'tree', width: 0.72, groundOffset: -0.04, rootOffsetY: -0.12, bottomTransparentPaddingRatio: 0.0508 },
  { id: 'billboard_tree_gnarled_ritual_01', path: './assets/sprites/foliage/billboard_tree_gnarled_ritual_01.png', type: 'tree', width: 0.92, groundOffset: -0.03, rootOffsetY: -0.09, bottomTransparentPaddingRatio: 0.0508, rootFootprintRadius: 0.2 },
  { id: 'billboard_tree_thorn_crowned_01', path: './assets/sprites/foliage/billboard_tree_thorn_crowned_01.png', type: 'tree', width: 0.88, groundOffset: -0.04, rootOffsetY: -0.12, bottomTransparentPaddingRatio: 0.0518, rootFootprintRadius: 0.2 },
].map(grounded));

export const OUTDOOR_FOLSOM_DARK_GROVE_FOLIAGE_SPRITES = Object.freeze([
  { id: 'folsom_dark_grove_tree_01_broad_canopy', path: './assets/sprites/foliage/folsom_dark_grove_tree_01_broad_canopy.png', type: 'folsom-dark-grove', width: 0.84, groundOffset: -0.03, rootOffsetY: -0.08, bottomTransparentPaddingRatio: 0.0027 },
  { id: 'folsom_dark_grove_tree_02_tall_spire', path: './assets/sprites/foliage/folsom_dark_grove_tree_02_tall_spire.png', type: 'folsom-dark-grove', width: 0.58, groundOffset: -0.03, rootOffsetY: -0.09, bottomTransparentPaddingRatio: 0.0027 },
  { id: 'folsom_dark_grove_tree_03_column_canopy', path: './assets/sprites/foliage/folsom_dark_grove_tree_03_column_canopy.png', type: 'folsom-dark-grove', width: 0.66, groundOffset: -0.03, rootOffsetY: -0.085, bottomTransparentPaddingRatio: 0.0027 },
  { id: 'folsom_dark_grove_tree_04_wide_tiered', path: './assets/sprites/foliage/folsom_dark_grove_tree_04_wide_tiered.png', type: 'folsom-dark-grove', width: 0.9, groundOffset: -0.03, rootOffsetY: -0.08, bottomTransparentPaddingRatio: 0.0028 },
  { id: 'folsom_dark_grove_tree_05_mossy_roots', path: './assets/sprites/foliage/folsom_dark_grove_tree_05_mossy_roots.png', type: 'folsom-dark-grove', width: 0.78, groundOffset: -0.04, rootOffsetY: -0.12, bottomTransparentPaddingRatio: 0.0028 },
  { id: 'folsom_dark_grove_tree_06_twisted_deadwood', path: './assets/sprites/foliage/folsom_dark_grove_tree_06_twisted_deadwood.png', type: 'folsom-dark-grove', width: 0.72, groundOffset: -0.035, rootOffsetY: -0.105, bottomTransparentPaddingRatio: 0.0028 },
  { id: 'folsom_dark_grove_tree_07_haunted_sentinel', path: './assets/sprites/foliage/folsom_dark_grove_tree_07_haunted_sentinel.png', type: 'folsom-dark-grove', width: 0.7, groundOffset: -0.035, rootOffsetY: -0.105, bottomTransparentPaddingRatio: 0.0028 },
  { id: 'folsom_dark_grove_tree_08_moody_foliage', path: './assets/sprites/foliage/folsom_dark_grove_tree_08_moody_foliage.png', type: 'folsom-dark-grove', width: 0.82, groundOffset: -0.03, rootOffsetY: -0.08, bottomTransparentPaddingRatio: 0.0029 },
].map(grounded));

export const OUTDOOR_REDWOOD_FOLIAGE_SPRITES = Object.freeze([
  { id: 'billboard_tree_redwood_tiered_sacred_01', path: './assets/sprites/foliage/billboard_tree_redwood_tiered_sacred_01.png', type: 'redwood', width: 0.66, bottomTransparentPaddingRatio: 0.0508, rootFootprintRadius: 0.22 },
  { id: 'billboard_tree_redwood_umbrella_crown_01', path: './assets/sprites/foliage/billboard_tree_redwood_umbrella_crown_01.png', type: 'redwood', width: 0.74, bottomTransparentPaddingRatio: 0.0508, rootFootprintRadius: 0.22 },
  { id: 'billboard_tree_redwood_cathedral_01', path: './assets/sprites/foliage/billboard_tree_redwood_cathedral_01.png', type: 'redwood', width: 0.7, bottomTransparentPaddingRatio: 0.0508, rootFootprintRadius: 0.22 },
  { id: 'billboard_tree_redwood_moss_draped_01', path: './assets/sprites/foliage/billboard_tree_redwood_moss_draped_01.png', type: 'redwood', width: 0.76, bottomTransparentPaddingRatio: 0.0508, rootFootprintRadius: 0.22 },
  { id: 'billboard_tree_redwood_ancient_carved_01', path: './assets/sprites/foliage/billboard_tree_redwood_ancient_carved_01.png', type: 'redwood', width: 0.68, bottomTransparentPaddingRatio: 0.0508, rootFootprintRadius: 0.22 },
  { id: 'billboard_tree_redwood_runic_giant_01', path: './assets/sprites/foliage/billboard_tree_redwood_runic_giant_01.png', type: 'redwood', width: 0.72, bottomTransparentPaddingRatio: 0.0508, rootFootprintRadius: 0.22 },
].map(grounded));

export const OUTDOOR_FOLIAGE_SPRITES = Object.freeze([
  ...OUTDOOR_SMALL_FOLIAGE_SPRITES,
  ...OUTDOOR_REDWOOD_FOLIAGE_SPRITES,
  ...OUTDOOR_FOLSOM_DARK_GROVE_FOLIAGE_SPRITES,
]);
