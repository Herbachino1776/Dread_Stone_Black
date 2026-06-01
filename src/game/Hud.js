import * as THREE from 'three';

export class Hud {
  constructor(root) {
    this.root = root;
    this.hintEl = root.querySelector('[data-hud="hint"]');
    this.debugEl = root.querySelector('[data-hud="debug"]');
    this.hpEl = root.querySelector('[data-stat="hp"]');
    this.powerEl = root.querySelector('[data-stat="power"]');
    this.damageEl = root.querySelector('[data-hud="damage"]');
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
    // Keep this subtle, but visible enough to confirm touch controls move the player on a phone.
    this.debugFrameSkip = (this.debugFrameSkip + 1) % 8;
    if (this.debugFrameSkip !== 0 || !this.debugEl) return;

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
}
