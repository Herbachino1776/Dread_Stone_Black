export const BROADSWORD_MODEL_URL = `${import.meta.env.BASE_URL}assets/models/weapons/weapon_broadsword_ritual_01.glb`;
export const BROADSWORD_ITEM_ID = 'rusted_sword';
export const BROADSWORD_DISPLAY_NAME = 'Broadsword';

export const BROADSWORD_VIEW = Object.freeze({
  // Camera-local first-person ready stance: handle stays lower-right while the blade
  // leans north-northwest back toward screen center instead of pointing off-screen right.
  restPosition: Object.freeze({ x: 0.24, y: -0.4, z: -0.82 }),
  restRotation: Object.freeze({ x: -0.44, y: -0.58, z: 1.16 }),
  modelRotation: Object.freeze({ x: -0.2, y: Math.PI * 0.02, z: -0.14 }),
  scale: 0.64,
  targetHeight: 1.55,
  maxWidth: 0.42,

  // Gesture follow tuning. Translation intentionally carries more of the screen-space
  // motion than rotation so the sword follows the thumb naturally instead of feeling inverted.
  springLag: 13.5,
  settleSpeed: 10.5,
  idleBobScale: 0.008,
  dragPositionScale: 0.00265,
  dragRotationScale: 0.0038,
  maxVisualOffsetX: 0.24,
  maxVisualOffsetY: 0.2,
  maxVisualOffsetZ: 0.08,
  maxVisualRotationX: 0.5,
  maxVisualRotationY: 0.32,
  maxVisualRotationZ: 0.46,
  swingDuration: 0.24,
  recoveryDuration: 0.32,

  slashLeftSwingPosition: Object.freeze({ x: -0.16, y: 0.05, z: -0.08 }),
  slashLeftSwingRotation: Object.freeze({ x: -0.2, y: 0.2, z: 0.74 }),
  slashRightSwingPosition: Object.freeze({ x: 0.14, y: 0.04, z: -0.08 }),
  slashRightSwingRotation: Object.freeze({ x: -0.24, y: -0.18, z: -0.78 }),
  diagonalDownSwingPosition: Object.freeze({ x: -0.1, y: -0.16, z: -0.1 }),
  diagonalDownSwingRotation: Object.freeze({ x: 0.46, y: 0.14, z: 0.62 }),
  thrustSwingPosition: Object.freeze({ x: -0.02, y: 0.04, z: -0.36 }),
  thrustSwingRotation: Object.freeze({ x: -0.18, y: 0.02, z: 0.06 }),
});

export const BROADSWORD_GESTURE = Object.freeze({
  hitRadius: 92,
  fallbackZoneRadius: 112,
  minDragDistance: 38,
  minReleaseSpeed: 360,
  historyMs: 150,
  maxReleaseSpeed: 1650,
  swingDuration: 0.24,
  recoveryDuration: 0.32,
  cooldown: 0.26,
  damageWindowStart: 0.18,
  damageWindowEnd: 0.62,
  horizontalDominance: 1.08,
  stabVerticalDominance: 1.22,
  diagonalDownMinComponent: 0.42,
  lowStartViewportRatio: 0.58,
});
