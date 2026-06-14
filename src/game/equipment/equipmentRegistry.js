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
      id: 'fishing_rod', name: 'Fishing Rod', displayName: 'Fishing Rod', itemType: 'weapon', type: 'tool', slot: 'weapon', weaponProfileId: 'fishing_rod', tags: ['fishing', 'tool', 'field-survival'], source: 'field_survival_fishing_rod_chest',
    }),
    flint_stick: Object.freeze({
      id: 'flint_stick',
      name: 'Flint Stick',
      displayName: 'Flint Stick',
      itemType: 'keyItem',
      tags: ['key-item', 'campfire', 'field-survival'],
      source: 'field_survival_flint_stick_chest',
    }),
    broadsword_ritual_01: Object.freeze({
      id: 'broadsword_ritual_01',
      displayName: 'Ritual Broadsword',
      itemType: 'weapon',
      weaponProfileId: 'broadsword_ritual_01',
      source: 'field_bgt_broadsword_chest',
      tags: ['weapon', 'sword', 'black_grass_temple', 'ritual'],
    }),
    rusted_sword: Object.freeze({
      id: 'rusted_sword',
      displayName: 'Rusted Sword',
      itemType: 'weapon',
      weaponProfileId: 'rusted_sword',
      source: 'black_grass_temple_rusted_sword_chest',
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
