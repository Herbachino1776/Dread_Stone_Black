export class MobileControls {
  constructor(root) {
    this.root = root;
    this.move = { x: 0, y: 0 };
    this.look = { x: 0 };
    this.interactPressed = false;
    this.attackPressed = false;

    this.movePointerId = null;
    this.lookPointerId = null;
    this.moveOrigin = { x: 0, y: 0 };

    this.moveZone = root.querySelector('[data-control="move"]');
    this.moveKnob = root.querySelector('[data-control="move-knob"]');
    this.lookZone = root.querySelector('[data-control="look"]');
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
    this.moveOrigin = { x: event.clientX, y: event.clientY };
    this.moveZone.setPointerCapture(event.pointerId);
    this.updateMove(event);
  }

  updateMove(event) {
    if (event.pointerId !== this.movePointerId) return;
    event.preventDefault();

    const maxDistance = 46;
    const dx = event.clientX - this.moveOrigin.x;
    const dy = event.clientY - this.moveOrigin.y;
    const distance = Math.min(maxDistance, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * distance;
    const knobY = Math.sin(angle) * distance;

    this.move.x = knobX / maxDistance;
    this.move.y = -knobY / maxDistance;
    this.moveKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
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
    this.lastLookX = event.clientX;
    this.lookZone.setPointerCapture(event.pointerId);
  }

  updateLook(event) {
    if (event.pointerId !== this.lookPointerId) return;
    event.preventDefault();
    const dx = event.clientX - this.lastLookX;
    this.lastLookX = event.clientX;
    this.look.x = dx;
  }

  endLook(event) {
    if (event.pointerId !== this.lookPointerId) return;
    event.preventDefault();
    this.lookPointerId = null;
    this.look.x = 0;
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
    const delta = this.look.x;
    this.look.x = 0;
    return delta;
  }
}
