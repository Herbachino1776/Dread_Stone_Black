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
    rusted_sword: Object.freeze({
      id: 'rusted_sword',
      displayName: 'Rusted Sword',
      itemType: 'weapon',
      weaponProfileId: 'rusted_sword',
      source: 'black_grass_temple_rusted_sword_chest',
    }),
  }),
});
