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
    field_axe: Object.freeze({
      id: 'field_axe',
      name: 'Field Axe',
      displayName: 'Field Axe',
      itemType: 'tool',
      type: 'tool',
      slot: 'tool',
      tags: ['axe', 'woodcutting', 'field-survival'],
      source: 'field_survival_axe_chest',
    }),
    rusted_sword: Object.freeze({
      id: 'rusted_sword',
      displayName: 'Rusted Sword',
      itemType: 'weapon',
      weaponProfileId: 'rusted_sword',
      source: 'black_grass_temple_rusted_sword_chest',
    }),
  }),
});
