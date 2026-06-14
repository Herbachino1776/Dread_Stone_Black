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
  fishing_rod: Object.freeze({
    id: 'fishing_rod', baseClip: ARM_OVERLAY_ASSETS.unarmedIdle, weaponLayer: 'fishing-rod-placeholder', placeholder: true, note: 'Procedural Fishing Rod FPV placeholder.',
  }),
  broadsword_ritual_01: Object.freeze({
    id: 'broadsword_ritual_01',
    baseClip: ARM_OVERLAY_ASSETS.unarmedIdle,
    weaponLayer: 'glb-model',
    modelUrl: `${import.meta.env.BASE_URL}assets/models/weapons/weapon_broadsword_ritual_01.glb`,
    modelKind: 'sword',
    scale: 1.15,
    position: { x: 0.42, y: -0.38, z: -1.35 },
    rotation: { x: -0.45, y: -0.35, z: -0.28 },
  }),
  rusted_sword: Object.freeze({
    id: 'rusted_sword',
    baseClip: ARM_OVERLAY_ASSETS.unarmedIdle,
    weaponLayer: 'sword-placeholder',
    placeholder: true,
    note: 'Procedural DOM fallback until a dedicated FPV sword strip exists.',
  }),
});
