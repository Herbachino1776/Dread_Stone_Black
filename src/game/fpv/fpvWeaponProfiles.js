import { ARM_OVERLAY_ASSETS } from '../FirstPersonArmsOverlay.js';

export const fpvWeaponProfiles = Object.freeze({
  unarmed: Object.freeze({
    id: 'unarmed',
    baseClip: ARM_OVERLAY_ASSETS.unarmedIdle,
    weaponLayer: 'none',
  }),
  wood_axe: Object.freeze({
    id: 'wood_axe',
    baseClip: ARM_OVERLAY_ASSETS.unarmedIdle,
    weaponLayer: 'axe-placeholder',
    placeholder: true,
    note: 'Procedural DOM fallback for Wood Axe FPV placeholder.',
  }),
  rusted_sword: Object.freeze({
    id: 'rusted_sword',
    baseClip: ARM_OVERLAY_ASSETS.unarmedIdle,
    weaponLayer: 'sword-placeholder',
    placeholder: true,
    note: 'Procedural DOM fallback until a dedicated FPV sword strip exists.',
  }),
});
