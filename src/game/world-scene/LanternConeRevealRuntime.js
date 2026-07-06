import * as THREE from 'three';

export const LANTERN_REVEAL_ITEM_ID = 'keepers_lantern';
export const LANTERN_REVEAL_MODE = 'lanternCone';

export const LANTERN_REVEAL_DEFAULTS = Object.freeze({
  revealDistance: 4,
  revealConeDegrees: 40,
  nearFieldRevealRadius: 1.35,
  nearFieldConeDegrees: 80,
  exitConePaddingDegrees: 7,
  exitDistancePadding: 0.35,
  revealLingerSeconds: 0.18,
  hiddenOpacity: 0,
  revealedOpacity: 0.86,
  fadeSpeed: 8,
  fadeOutSpeed: 10,
});

const HIDDEN_VISIBILITY_THRESHOLD = 0.001;

const toRevealPoint = new THREE.Vector3();
const localEmitterPoint = new THREE.Vector3();
const localClosestPoint = new THREE.Vector3();

export function isLanternRevealEmitterActive(emitter) {
  return Boolean(emitter?.active
    && emitter.itemId === LANTERN_REVEAL_ITEM_ID
    && emitter.worldPosition?.isVector3
    && emitter.worldDirection?.isVector3);
}

export function isPointInsideLanternCone(emitter, point, config = {}, { wasRevealed = false } = {}) {
  if (!emitter?.active || emitter.itemId !== LANTERN_REVEAL_ITEM_ID || !emitter.worldPosition?.isVector3 || !emitter.worldDirection?.isVector3) return false;
  toRevealPoint.copy(point).sub(emitter.worldPosition);
  const distance = toRevealPoint.length();
  const revealDistance = config.revealDistance ?? LANTERN_REVEAL_DEFAULTS.revealDistance;
  const revealConeDegrees = config.revealConeDegrees ?? LANTERN_REVEAL_DEFAULTS.revealConeDegrees;
  const nearFieldRevealRadius = config.nearFieldRevealRadius ?? LANTERN_REVEAL_DEFAULTS.nearFieldRevealRadius;
  const nearFieldConeDegrees = config.nearFieldConeDegrees ?? LANTERN_REVEAL_DEFAULTS.nearFieldConeDegrees;
  const exitConePaddingDegrees = config.exitConePaddingDegrees ?? LANTERN_REVEAL_DEFAULTS.exitConePaddingDegrees;
  const distancePadding = wasRevealed ? (config.exitDistancePadding ?? LANTERN_REVEAL_DEFAULTS.exitDistancePadding) : 0;
  const range = Math.min(Number(emitter.range) || revealDistance, revealDistance) + distancePadding;
  if (distance > range) return false;
  if (distance <= 0.001) return true;
  const directionDot = toRevealPoint.multiplyScalar(1 / distance).dot(emitter.worldDirection);
  const nearConeDegrees = nearFieldConeDegrees + (wasRevealed ? exitConePaddingDegrees : 0);
  if (distance <= nearFieldRevealRadius + distancePadding) {
    return directionDot >= Math.cos(THREE.MathUtils.degToRad(nearConeDegrees));
  }
  const coneDegrees = Math.min(Number(emitter.coneAngleDegrees) || revealConeDegrees, revealConeDegrees)
    + (wasRevealed ? exitConePaddingDegrees : 0);
  const minimumDot = Math.cos(THREE.MathUtils.degToRad(coneDegrees));
  return directionDot >= minimumDot;
}

export function isObjectInsideLanternWash(emitter, object, config = {}, { wasRevealed = false } = {}) {
  if (!isLanternRevealEmitterActive(emitter) || !object?.geometry) return false;
  if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
  if (!object.geometry.boundingBox) return false;
  localEmitterPoint.copy(emitter.worldPosition);
  object.worldToLocal(localEmitterPoint);
  object.geometry.boundingBox.clampPoint(localEmitterPoint, localClosestPoint);
  object.localToWorld(localClosestPoint);
  return isPointInsideLanternCone(emitter, localClosestPoint, config, { wasRevealed });
}

export class LanternConeRevealRuntime {
  constructor({ objects = [], getEmitterState = null } = {}) {
    this.getEmitterState = getEmitterState;
    this.entries = objects.map((object) => this.createEntry(object)).filter(Boolean);
  }

  createEntry(object) {
    if (!object?.isMesh || !object.material) return null;
    const config = { ...LANTERN_REVEAL_DEFAULTS, ...(object.userData ?? {}) };
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
    return {
      object,
      material: object.material,
      config,
      revealPoint: new THREE.Vector3(),
      directHit: false,
      insideCone: false,
      lingerRemaining: 0,
    };
  }

  update(deltaSeconds) {
    if (!this.entries.length) return;
    const emitter = this.getEmitterState?.() ?? null;
    const dt = THREE.MathUtils.clamp(deltaSeconds, 0, 0.05);
    this.entries.forEach((entry) => {
      entry.object.getWorldPosition(entry.revealPoint);
      const emitterActive = isLanternRevealEmitterActive(emitter);
      entry.directHit = emitterActive && isObjectInsideLanternWash(emitter, entry.object, entry.config, { wasRevealed: entry.insideCone });
      if (entry.directHit) entry.lingerRemaining = entry.config.revealLingerSeconds;
      else if (emitterActive) entry.lingerRemaining = Math.max(0, entry.lingerRemaining - dt);
      else entry.lingerRemaining = 0;
      entry.insideCone = entry.directHit || entry.lingerRemaining > 0;
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
      directHit: entry.directHit,
      insideCone: entry.insideCone,
      lingerRemaining: entry.lingerRemaining,
      opacity: entry.material.opacity,
      revealPoint: entry.revealPoint.clone(),
    }));
  }

  dispose() {
    this.entries = [];
    this.getEmitterState = null;
  }
}
