import { ARM_OVERLAY_ASSETS } from '../FirstPersonArmsOverlay.js';

export const fpvWeaponProfiles = Object.freeze({
  unarmed: Object.freeze({
    id: 'unarmed',
    baseClip: ARM_OVERLAY_ASSETS.unarmedIdle,
    weaponLayer: 'none',
  }),
  rusted_sword: Object.freeze({
    id: 'rusted_sword',
    baseClip: ARM_OVERLAY_ASSETS.unarmedIdle,
    weaponLayer: 'sword-placeholder',
    placeholder: true,
    note: 'Procedural DOM fallback until a dedicated FPV sword strip exists.',
  }),
});
