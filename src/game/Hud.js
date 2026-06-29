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
    this.startupDebugEl = root.querySelector('[data-hud="startup-debug"]');
    this.fieldKitEl = root.querySelector('[data-hud="field-kit"]');
    this.timedActionProgressEl = root.querySelector('[data-hud="timed-action-progress"]') ?? root.querySelector('[data-hud="hold-progress"]');
    this.debugFrameSkip = 0;
  }

  updateStats({ hp, power }) {
    if (this.hpEl) this.hpEl.textContent = Math.ceil(hp);
    if (this.powerEl) this.powerEl.textContent = Math.floor(power);
  }

  playAttack() {
    // Attack feedback remains HUD-only; no first-person arm or hand overlay is rendered.
  }

  flashDamage() {
    if (!this.damageEl) return;

    this.damageEl.classList.remove('is-flashing');
    void this.damageEl.offsetWidth;
    this.damageEl.classList.add('is-flashing');
  }

  updateDebug(player, fishing = null, broadsword = null) {
    if (!this.debugEnabled || !this.debugEl) return;

    this.debugFrameSkip = (this.debugFrameSkip + 1) % 8;
    if (this.debugFrameSkip !== 0) return;

    const yawDegrees = Math.round(THREE.MathUtils.radToDeg(player.yaw));
    const pitchDegrees = Math.round(THREE.MathUtils.radToDeg(player.pitch));
    const playerState = `POS ${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)} · YAW ${yawDegrees}° · PITCH ${pitchDegrees}°`;
    if (!fishing && !broadsword) { this.debugEl.textContent = playerState; return; }
    const number = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '-';
    const tipSpeed = fishing?.rodTipVelocity?.length?.() ?? 0;
    const fishingState = fishing ? ` · FISH ${fishing.lureMode ?? 'none'} · SPOOL ${number(fishing.lineLength)} [${number(fishing.minLineLength)}, ${number(fishing.maxLineLength)}] · DIST ${number(fishing.lureDistance)} · REEL ${number(fishing.reelTargetRate)}/${number(fishing.reelActualRate)} @${number(fishing.reelAccelerationClamp, 0)} · GRACE ${fishing.castGraceActive ? 'Y' : 'N'} · END ${fishing.endpointConstraintActive ? 'Y' : 'N'} · TENSION ${number(fishing.lineTension)} · LURE V ${number(fishing.lureSpeed)} · GRAB ${number(fishing.grabT)} · TIP V ${number(tipSpeed)}` : '';
    const swordState = broadsword ? ` · SWORD ${broadsword.equipped ? 'Y' : 'N'} · GEST ${broadsword.gestureActive ? 'Y' : 'N'} · SWIPE ${number(broadsword.swipeDistance, 0)} · RELEASE ${number(broadsword.releaseSpeed, 0)} · ${broadsword.attackType}/${broadsword.attackPhase} · CD ${number(broadsword.cooldown)} · HIT ${broadsword.hitWindowActive ? 'Y' : 'N'}` : '';
    this.debugEl.textContent = `${playerState}${fishingState}${swordState}`;
  }

  setStartupDebug(message) {
    if (!this.startupDebugEl) return;
    this.startupDebugEl.textContent = message || '';
    this.startupDebugEl.hidden = !message;
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

  updateTimedActionProgress(progress = 0, label = '') {
    if (!this.timedActionProgressEl) return;
    const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
    this.timedActionProgressEl.style.setProperty('--timed-action-progress', `${clamped * 360}deg`);
    if (label) this.timedActionProgressEl.dataset.label = label;
    else if (clamped <= 0) this.timedActionProgressEl.dataset.label = '';
    this.timedActionProgressEl.classList.toggle('is-visible', clamped > 0 && clamped < 1);
  }

  updateHoldProgress(progress = 0, label = '') {
    this.updateTimedActionProgress(progress, label);
  }

  updateFieldKitStatus() {
    if (!this.fieldKitEl) return;
    this.fieldKitEl.hidden = true;
    this.fieldKitEl.classList.remove('is-visible');
    this.fieldKitEl.textContent = '';
  }
}
