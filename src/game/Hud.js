import * as THREE from 'three';

export class Hud {
  constructor(root) {
    this.root = root;
    this.messageEl = root.querySelector('[data-hud="message"]');
    this.debugEl = root.querySelector('[data-hud="debug"]');
    this.timeoutId = null;
    this.debugFrameSkip = 0;
  }

  updateDebug(player) {
    // Keep this subtle, but visible enough to confirm touch controls move the player on a phone.
    this.debugFrameSkip = (this.debugFrameSkip + 1) % 8;
    if (this.debugFrameSkip !== 0 || !this.debugEl) return;

    const yawDegrees = Math.round(THREE.MathUtils.radToDeg(player.yaw));
    this.debugEl.textContent = `POS ${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)} · YAW ${yawDegrees}°`;
  }

  showMessage(message) {
    this.messageEl.textContent = message;
    window.clearTimeout(this.timeoutId);
    this.timeoutId = window.setTimeout(() => {
      this.messageEl.textContent = 'The air is cold and still.';
    }, 3200);
  }
}
