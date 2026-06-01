export class MobileControls {
  constructor(root) {
    this.root = root;
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.interactPressed = false;
    this.attackPressed = false;
    this.lookVerticalDeadzone = 0.24;

    this.movePointerId = null;
    this.lookPointerId = null;
    this.moveCenter = { x: 0, y: 0 };
    this.lookCenter = { x: 0, y: 0 };

    this.moveZone = root.querySelector('[data-control="move"]');
    this.moveKnob = root.querySelector('[data-control="move-knob"]');
    this.lookZone = root.querySelector('[data-control="look"]');
    this.lookKnob = root.querySelector('[data-control="look-knob"]');
    this.interactButton = root.querySelector('[data-action="interact"]');
    this.attackButton = root.querySelector('[data-action="attack"]');

    this.bindEvents();
  }

  bindEvents() {
    this.moveZone.addEventListener('pointerdown', (event) => this.startMove(event));
    this.moveZone.addEventListener('pointermove', (event) => this.updateMove(event));
    this.moveZone.addEventListener('pointerup', (event) => this.endMove(event));
    this.moveZone.addEventListener('pointercancel', (event) => this.endMove(event));

    this.lookZone.addEventListener('pointerdown', (event) => this.startLook(event));
    this.lookZone.addEventListener('pointermove', (event) => this.updateLook(event));
    this.lookZone.addEventListener('pointerup', (event) => this.endLook(event));
    this.lookZone.addEventListener('pointercancel', (event) => this.endLook(event));

    this.interactButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.interactPressed = true;
    });

    this.attackButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.queueAttack();
    });
  }

  startMove(event) {
    event.preventDefault();
    this.movePointerId = event.pointerId;
    this.moveCenter = this.getZoneCenter(this.moveZone);
    this.moveZone.setPointerCapture(event.pointerId);
    this.updateMove(event);
  }

  updateMove(event) {
    if (event.pointerId !== this.movePointerId) return;
    event.preventDefault();

    const stick = this.getStickVector(event, this.moveCenter, this.moveZone);
    this.move.x = stick.x;
    this.move.y = -stick.y;
    this.moveKnob.style.transform = `translate(${stick.knobX}px, ${stick.knobY}px)`;
  }

  endMove(event) {
    if (event.pointerId !== this.movePointerId) return;
    event.preventDefault();
    this.movePointerId = null;
    this.move = { x: 0, y: 0 };
    this.moveKnob.style.transform = 'translate(0, 0)';
  }

  startLook(event) {
    event.preventDefault();
    this.lookPointerId = event.pointerId;
    this.lookCenter = this.getZoneCenter(this.lookZone);
    this.lookZone.setPointerCapture(event.pointerId);
    this.updateLook(event);
  }

  updateLook(event) {
    if (event.pointerId !== this.lookPointerId) return;
    event.preventDefault();

    const stick = this.getStickVector(event, this.lookCenter, this.lookZone);
    this.look.x = stick.x;
    this.look.y = this.applyLookVerticalDeadzone(-stick.y);
    this.lookKnob.style.transform = `translate(${stick.knobX}px, ${stick.knobY}px)`;
  }

  endLook(event) {
    if (event.pointerId !== this.lookPointerId) return;
    event.preventDefault();
    this.lookPointerId = null;
    this.look = { x: 0, y: 0 };
    this.lookKnob.style.transform = 'translate(0, 0)';
  }

  applyLookVerticalDeadzone(value) {
    return Math.abs(value) >= this.lookVerticalDeadzone ? value : 0;
  }

  getZoneCenter(zone) {
    const rect = zone.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  getStickVector(event, center, zone) {
    const maxDistance = Math.min(50, Math.max(36, zone.clientWidth * 0.28));
    const dx = event.clientX - center.x;
    const dy = event.clientY - center.y;
    const rawDistance = Math.hypot(dx, dy);
    const distance = Math.min(maxDistance, rawDistance);
    const angle = Math.atan2(dy, dx);
    const knobX = rawDistance > 0 ? Math.cos(angle) * distance : 0;
    const knobY = rawDistance > 0 ? Math.sin(angle) * distance : 0;

    return {
      x: knobX / maxDistance,
      y: knobY / maxDistance,
      knobX,
      knobY,
    };
  }

  consumeInteract() {
    const wasPressed = this.interactPressed;
    this.interactPressed = false;
    return wasPressed;
  }

  queueAttack() {
    this.attackPressed = true;
  }

  consumeAttack() {
    const wasPressed = this.attackPressed;
    this.attackPressed = false;
    return wasPressed;
  }

  consumeLookDelta() {
    return { x: this.look.x, y: this.look.y };
  }
}
