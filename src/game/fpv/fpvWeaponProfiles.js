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
    scale: 1.05,
    normalizedHeight: 1.65,
    position: { x: 0.34, y: -1.05, z: -2.35 },
    rotation: { x: -0.90, y: -0.18, z: 0.28 },
    attack: Object.freeze({
      durationMs: 500,
      windupPose: Object.freeze({
        position: Object.freeze({ x: 0.44, y: -0.90, z: -2.42 }),
        rotation: Object.freeze({ x: -1.02, y: -0.28, z: 0.12 }),
      }),
      strikePose: Object.freeze({
        position: Object.freeze({ x: 0.12, y: -1.18, z: -2.12 }),
        rotation: Object.freeze({ x: -0.68, y: -0.08, z: 0.72 }),
      }),
    }),
  }),
  rusted_sword: Object.freeze({
    id: 'rusted_sword',
    baseClip: ARM_OVERLAY_ASSETS.unarmedIdle,
    weaponLayer: 'glb-model',
    modelUrl: `${import.meta.env.BASE_URL}assets/models/weapons/weapon_broadsword_ritual_01.glb`,
    modelKind: 'sword',
    scale: 1.05,
    normalizedHeight: 1.65,
    position: { x: 0.34, y: -1.05, z: -2.35 },
    rotation: { x: -0.90, y: -0.18, z: 0.28 },
    note: 'Legacy DOM renderer fallback maps the rusted sword to the ritual broadsword GLB.',
  }),
});
