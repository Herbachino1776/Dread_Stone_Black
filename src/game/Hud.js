import * as THREE from 'three';

export class Hud {
  constructor(root, { debugEnabled = false } = {}) {
    this.root = root;
    this.debugEnabled = debugEnabled;
    this.hintEl = root.querySelector('[data-hud="hint"]');
    this.debugEl = root.querySelector('[data-hud="debug"]');
    this.hpEl = root.querySelector('[data-stat="hp"]');
    this.powerEl = root.querySelector('[data-stat="power"]');
    this.hungerEl = root.querySelector('[data-stat="hunger"]');
    this.damageEl = root.querySelector('[data-hud="damage"]');
    this.fieldKitEl = root.querySelector('[data-hud="field-kit"]');
    this.holdProgressEl = root.querySelector('[data-hud="hold-progress"]');
    this.debugFrameSkip = 0;
  }

  updateStats({ hp, power }) {
    if (this.hpEl) this.hpEl.textContent = Math.ceil(hp);
    if (this.powerEl) this.powerEl.textContent = Math.floor(power);
  }

  playAttack() {
    // First-person weapon/arms attack strips can hook in here later without changing combat input.
  }

  flashDamage() {
    if (!this.damageEl) return;

    this.damageEl.classList.remove('is-flashing');
    void this.damageEl.offsetWidth;
    this.damageEl.classList.add('is-flashing');
  }

  updateDebug(player) {
    if (!this.debugEnabled || !this.debugEl) return;

    this.debugFrameSkip = (this.debugFrameSkip + 1) % 8;
    if (this.debugFrameSkip !== 0) return;

    const yawDegrees = Math.round(THREE.MathUtils.radToDeg(player.yaw));
    const pitchDegrees = Math.round(THREE.MathUtils.radToDeg(player.pitch));
    this.debugEl.textContent = `POS ${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)} · YAW ${yawDegrees}° · PITCH ${pitchDegrees}°`;
  }

  showHint(message) {
    if (!this.hintEl) return;

    this.hintEl.textContent = message;
    this.hintEl.classList.toggle('is-visible', Boolean(message));
  }

  showMessage(message) {
    // Gameplay message calls intentionally stay non-visual while the message panel is removed.
    if (message) console.debug(`[Dread Stone Black] ${message}`);
  }

  updateHunger({ hungerSecondsRemaining = 0, hungerMaxSeconds = 1 } = {}) {
    if (!this.hungerEl) return;
    const seconds = Math.max(0, Math.ceil(hungerSecondsRemaining));
    const minutes = Math.floor(seconds / 60);
    const remainder = String(seconds % 60).padStart(2, '0');
    this.hungerEl.textContent = `${minutes}:${remainder}`;
    this.hungerEl.parentElement?.style.setProperty('--hunger-ratio', String(Math.max(0, Math.min(1, seconds / Math.max(1, hungerMaxSeconds)))));
  }

  updateHoldProgress(progress = 0, label = '') {
    if (!this.holdProgressEl) return;
    const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
    this.holdProgressEl.style.setProperty('--hold-progress', `${clamped * 360}deg`);
    this.holdProgressEl.dataset.label = label || this.holdProgressEl.dataset.label || '';
    this.holdProgressEl.classList.toggle('is-visible', clamped > 0 && clamped < 1);
  }

  updateFieldKitStatus() {
    if (!this.fieldKitEl) return;
    this.fieldKitEl.hidden = true;
    this.fieldKitEl.classList.remove('is-visible');
    this.fieldKitEl.textContent = '';
  }
}
