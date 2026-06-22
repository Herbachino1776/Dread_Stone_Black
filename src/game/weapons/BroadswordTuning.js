export const BROADSWORD_MODEL_URL = `${import.meta.env.BASE_URL}assets/models/weapons/weapon_broadsword_ritual_01.glb`;
export const BROADSWORD_ITEM_ID = 'rusted_sword';
export const BROADSWORD_DISPLAY_NAME = 'Broadsword';
export const BROADSWORD_VIEW = Object.freeze({
  restPosition: Object.freeze({ x: 0.36, y: -0.42, z: -0.78 }), restRotation: Object.freeze({ x: -0.32, y: -0.42, z: -0.18 }), modelRotation: Object.freeze({ x: -0.18, y: Math.PI * 0.06, z: -0.08 }), scale: 0.62, targetHeight: 1.55, maxWidth: 0.42, springLag: 10.5, settleSpeed: 8.2, idleBobScale: 0.008, dragPositionScale: 0.0021, dragRotationScale: 0.0046, maxVisualOffset: 0.18, maxVisualRotation: 0.58, slashSwingRotation: Object.freeze({ x: -0.34, y: 0.18, z: -0.84 }), thrustSwingPosition: Object.freeze({ x: -0.03, y: 0.02, z: -0.34 }), thrustSwingRotation: Object.freeze({ x: -0.18, y: 0.04, z: 0.1 }),
});
export const BROADSWORD_GESTURE = Object.freeze({ hitRadius: 86, fallbackZoneRadius: 112, minDragDistance: 46, minReleaseSpeed: 420, historyMs: 140, maxReleaseSpeed: 1550, swingDuration: 0.22, recoveryDuration: 0.34, cooldown: 0.28, damageWindowStart: 0.2, damageWindowEnd: 0.58 });
