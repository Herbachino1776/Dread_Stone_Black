import { weaponProfiles } from './weaponProfiles.js';

export const equipmentRegistry = Object.freeze({
  weapons: weaponProfiles,
  items: Object.freeze({
    unarmed: Object.freeze({
      id: 'unarmed',
      displayName: 'Unarmed',
      itemType: 'weapon',
      weaponProfileId: 'unarmed',
    }),
    wood_axe: Object.freeze({
      id: 'wood_axe',
      name: 'Wood Axe',
      displayName: 'Wood Axe',
      itemType: 'weapon',
      weaponProfileId: 'wood_axe',
      tags: ['axe', 'woodcutting', 'field-survival'],
      source: 'field_survival_axe_chest',
    }),
    fishing_rod: Object.freeze({
      id: 'fishing_rod', name: 'Fishing Rod', displayName: 'Rod A1', itemType: 'weapon', type: 'tool', slot: 'weapon', weaponProfileId: 'fishing_rod', tags: ['fishing', 'tool', 'field-survival'], source: 'field_survival_fishing_rod_chest',
    }),
    flint_stick: Object.freeze({
      id: 'flint_stick',
      name: 'Flint Stick',
      displayName: 'Flint Stick',
      itemType: 'keyItem',
      tags: ['key-item', 'campfire', 'field-survival'],
      source: 'field_survival_flint_stick_chest',
    }),
    old_work_knife: Object.freeze({
      id: 'old_work_knife',
      name: 'Old Work Knife',
      displayName: 'Old Work Knife',
      itemType: 'tool',
      type: 'tool',
      slot: 'tool',
      tags: ['tool', 'work-knife', 'folsom'],
      source: 'folsom_shed_rear_knife_pickup',
    }),
    iron_drain_bar: Object.freeze({
      id: 'iron_drain_bar',
      name: 'Iron Drain Bar',
      displayName: 'Iron Drain Bar',
      itemType: 'tool',
      type: 'tool',
      slot: 'tool',
      tags: ['tool', 'pry-bar', 'beneath-folsom'],
      source: 'beneath_folsom_iron_drain_bar_pickup',
    }),
    keepers_lantern: Object.freeze({
      id: 'keepers_lantern', name: "Keeper's Lantern", displayName: "Keeper's Lantern", itemType: 'offhand', type: 'offhand', slot: 'offhand',
      tags: ['utility', 'lantern', 'reveal', 'beneath-folsom'], source: 'beneath_folsom_keepers_lantern_pickup',
    }),
    torch: Object.freeze({
      id: 'torch',
      name: 'Torch',
      displayName: 'Torch',
      itemType: 'offhand',
      type: 'offhand',
      slot: 'offhand',
      tags: ['torch', 'light', 'dungeon-utility'],
      source: 'sumerian_sun_palace_spawn_torch_chest',
    }),
  }),
});
