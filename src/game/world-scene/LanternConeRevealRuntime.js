import * as THREE from 'three';

export const LANTERN_REVEAL_ITEM_ID = 'keepers_lantern';
export const LANTERN_REVEAL_MODE = 'lanternCone';

const DEFAULTS = Object.freeze({
  revealDistance: 1.7,
  revealConeDegrees: 24,
  hiddenOpacity: 0,
  revealedOpacity: 0.86,
  fadeSpeed: 9,
  fadeOutSpeed: 12,
});

const HIDDEN_VISIBILITY_THRESHOLD = 0.001;

const toRevealPoint = new THREE.Vector3();

export function isPointInsideLanternCone(emitter, point, { revealDistance = DEFAULTS.revealDistance, revealConeDegrees = DEFAULTS.revealConeDegrees } = {}) {
  if (!emitter?.active || emitter.itemId !== LANTERN_REVEAL_ITEM_ID || !emitter.worldPosition?.isVector3 || !emitter.worldDirection?.isVector3) return false;
  toRevealPoint.copy(point).sub(emitter.worldPosition);
  const distance = toRevealPoint.length();
  const range = Math.min(Number(emitter.range) || revealDistance, revealDistance);
  if (distance <= 0.001 || distance > range) return false;
  const coneDegrees = Math.min(Number(emitter.coneAngleDegrees) || revealConeDegrees, revealConeDegrees);
  const minimumDot = Math.cos(THREE.MathUtils.degToRad(coneDegrees));
  return toRevealPoint.multiplyScalar(1 / distance).dot(emitter.worldDirection) >= minimumDot;
}

export class LanternConeRevealRuntime {
  constructor({ objects = [], getEmitterState = null } = {}) {
    this.getEmitterState = getEmitterState;
    this.entries = objects.map((object) => this.createEntry(object)).filter(Boolean);
  }

  createEntry(object) {
    if (!object?.isMesh || !object.material) return null;
    const config = { ...DEFAULTS, ...(object.userData ?? {}) };
    if (config.revealMode !== LANTERN_REVEAL_MODE || config.revealItemId !== LANTERN_REVEAL_ITEM_ID) return null;
    // Lantern-cone decals are secret art. Authored opacity must never make their
    // hidden state visible under ambient light or an ordinary Torch.
    config.hiddenOpacity = 0;
    object.material.transparent = true;
    object.material.depthWrite = false;
    object.material.alphaTest = 0;
    object.material.opacity = 0;
    object.material.needsUpdate = true;
    object.visible = false;
    return { object, material: object.material, config, revealPoint: new THREE.Vector3(), insideCone: false };
  }

  update(deltaSeconds) {
    if (!this.entries.length) return;
    const emitter = this.getEmitterState?.() ?? null;
    const dt = THREE.MathUtils.clamp(deltaSeconds, 0, 0.05);
    this.entries.forEach((entry) => {
      entry.object.getWorldPosition(entry.revealPoint);
      entry.insideCone = isPointInsideLanternCone(emitter, entry.revealPoint, entry.config);
      const targetOpacity = entry.insideCone ? entry.config.revealedOpacity : entry.config.hiddenOpacity;
      const speed = entry.insideCone ? entry.config.fadeSpeed : entry.config.fadeOutSpeed;
      if (entry.insideCone) entry.object.visible = true;
      entry.material.opacity = THREE.MathUtils.lerp(entry.material.opacity, targetOpacity, 1 - Math.exp(-speed * dt));
      if (!entry.insideCone && entry.material.opacity <= HIDDEN_VISIBILITY_THRESHOLD) {
        entry.material.opacity = 0;
        entry.object.visible = false;
      }
    });
  }

  getDebugState() {
    return this.entries.map((entry) => ({
      id: entry.object.name,
      insideCone: entry.insideCone,
      opacity: entry.material.opacity,
      revealPoint: entry.revealPoint.clone(),
    }));
  }

  dispose() {
    this.entries = [];
    this.getEmitterState = null;
  }
}
