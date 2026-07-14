import * as THREE from 'three';

export const DEFAULT_WEAPON_POINTER_BLOCK_SELECTOR = 'button,[data-control="move"],[data-control="look"],[data-equipment-panel]';

export class WeaponGestureOwnership {
  constructor(workspace) {
    this.workspace = workspace;
    this.pointerId = null;
    this.startPoint = new THREE.Vector2();
    this.lastPoint = new THREE.Vector2();
    this.lastTimeMs = 0;
    this.deliberateVelocity = new THREE.Vector3();
    this.sample = { aimX: 0, aimY: 0, extension: 0, intentionalTravel: 0 };
  }

  acquire(pointerId, clientX, clientY, timeMs) {
    if (this.pointerId != null) return false;
    this.pointerId = pointerId;
    this.startPoint.set(clientX, clientY);
    this.lastPoint.set(clientX, clientY);
    this.lastTimeMs = timeMs;
    this.deliberateVelocity.set(0, 0, 0);
    return true;
  }

  update(pointerId, deltaX, deltaY, clientX, clientY, timeMs, previousExtension) {
    if (pointerId !== this.pointerId) return null;
    const dt = Math.max(0.008, Math.min(0.08, (timeMs - this.lastTimeMs) / 1000 || 1 / 60));
    const stepX = clientX - this.lastPoint.x;
    const stepY = clientY - this.lastPoint.y;
    const workspace = this.workspace;
    const sample = this.sample;
    sample.aimX = THREE.MathUtils.clamp(deltaX * workspace.lateralSensitivity, -1, 1);
    sample.aimY = THREE.MathUtils.clamp(-deltaY * workspace.verticalSensitivity, -1, 1);
    sample.extension = THREE.MathUtils.clamp(-deltaY * workspace.thrustSensitivity, 0, workspace.thrustDistance);
    sample.intentionalTravel = Math.hypot(deltaX, deltaY);
    this.deliberateVelocity.set(
      stepX * workspace.lateralSensitivity * workspace.lateralReach / dt,
      -stepY * workspace.verticalSensitivity * workspace.verticalReach / dt,
      -(sample.extension - previousExtension) / dt,
    );
    this.lastPoint.set(clientX, clientY);
    this.lastTimeMs = timeMs;
    return sample;
  }

  decayDeliberateVelocity(dt, rate = 18) {
    this.deliberateVelocity.multiplyScalar(Math.exp(-rate * dt));
  }

  release() {
    this.pointerId = null;
    this.deliberateVelocity.set(0, 0, 0);
  }
}

export function bindWeaponPointerEvents({ viewport, onPointerDown, onPointerMove, onPointerEnd, onSuspend }) {
  const down = (event) => onPointerDown(event);
  const move = (event) => onPointerMove(event);
  const end = (event) => onPointerEnd(event);
  const suspend = () => onSuspend();
  viewport?.addEventListener?.('pointerdown', down, { passive: false, capture: true });
  viewport?.addEventListener?.('pointermove', move, { passive: false, capture: true });
  viewport?.addEventListener?.('pointerup', end, { passive: false, capture: true });
  viewport?.addEventListener?.('pointercancel', end, { passive: false, capture: true });
  document.addEventListener('visibilitychange', suspend);
  window.addEventListener('pagehide', suspend);
  return () => {
    viewport?.removeEventListener?.('pointerdown', down, { capture: true });
    viewport?.removeEventListener?.('pointermove', move, { capture: true });
    viewport?.removeEventListener?.('pointerup', end, { capture: true });
    viewport?.removeEventListener?.('pointercancel', end, { capture: true });
    document.removeEventListener('visibilitychange', suspend);
    window.removeEventListener('pagehide', suspend);
  };
}
