import * as THREE from 'three';

const AIM_LIMIT_X = 1;
const AIM_LIMIT_Y = 1;
const DRAG_RANGE_X = 150;
const DRAG_RANGE_Y = 130;
const AIM_SPRING = 72;
const AIM_DAMPING = 15;

export class OffhandAimController {
  constructor({ app, viewmodels = [] } = {}) {
    this.viewport = app?.querySelector?.('[data-game="viewport"]') ?? app;
    this.viewmodels = viewmodels;
    this.state = { x: 0, y: 0, velocityX: 0, velocityY: 0, targetX: 0, targetY: 0 };
    this.pointerId = null;
    this.startX = 0;
    this.startY = 0;
    this.startAimX = 0;
    this.startAimY = 0;
    this.disposers = [];
    this.bind();
  }

  getActiveViewmodel() {
    return this.viewmodels.find((viewmodel) => viewmodel?.isActive?.() && viewmodel?.root?.visible) ?? null;
  }

  bind() {
    if (!this.viewport?.addEventListener) return;
    const onPointerDown = (event) => {
      const viewmodel = this.getActiveViewmodel();
      if (!viewmodel?.projectAimHit?.(event.clientX, event.clientY, this.viewport)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.pointerId = event.pointerId;
      this.startX = event.clientX;
      this.startY = event.clientY;
      this.startAimX = this.state.x;
      this.startAimY = this.state.y;
      this.viewport.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event) => {
      if (event.pointerId !== this.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.state.targetX = THREE.MathUtils.clamp(this.startAimX + (event.clientX - this.startX) / DRAG_RANGE_X, -AIM_LIMIT_X, AIM_LIMIT_X);
      this.state.targetY = THREE.MathUtils.clamp(this.startAimY - (event.clientY - this.startY) / DRAG_RANGE_Y, -AIM_LIMIT_Y, AIM_LIMIT_Y);
    };
    const onPointerEnd = (event) => {
      if (event.pointerId !== this.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.pointerId = null;
      this.state.targetX = 0;
      this.state.targetY = 0;
    };
    this.viewport.addEventListener('pointerdown', onPointerDown, { passive: false });
    this.viewport.addEventListener('pointermove', onPointerMove, { passive: false });
    this.viewport.addEventListener('pointerup', onPointerEnd, { passive: false });
    this.viewport.addEventListener('pointercancel', onPointerEnd, { passive: false });
    this.disposers.push(
      () => this.viewport.removeEventListener('pointerdown', onPointerDown),
      () => this.viewport.removeEventListener('pointermove', onPointerMove),
      () => this.viewport.removeEventListener('pointerup', onPointerEnd),
      () => this.viewport.removeEventListener('pointercancel', onPointerEnd),
    );
  }

  update(deltaSeconds) {
    const dt = THREE.MathUtils.clamp(deltaSeconds, 0.001, 0.05);
    if (!this.getActiveViewmodel()) {
      this.pointerId = null;
      this.state.targetX = 0;
      this.state.targetY = 0;
    }
    const accelerationX = (this.state.targetX - this.state.x) * AIM_SPRING - this.state.velocityX * AIM_DAMPING;
    const accelerationY = (this.state.targetY - this.state.y) * AIM_SPRING - this.state.velocityY * AIM_DAMPING;
    this.state.velocityX += accelerationX * dt;
    this.state.velocityY += accelerationY * dt;
    this.state.x = THREE.MathUtils.clamp(this.state.x + this.state.velocityX * dt, -AIM_LIMIT_X, AIM_LIMIT_X);
    this.state.y = THREE.MathUtils.clamp(this.state.y + this.state.velocityY * dt, -AIM_LIMIT_Y, AIM_LIMIT_Y);
    this.viewmodels.forEach((viewmodel) => viewmodel?.setAimState?.(this.state));
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.viewmodels = [];
    this.viewport = null;
  }
}
