import { Hud } from '../Hud.js';

export class HudHost {
  constructor({ root, debugEnabled = false, onPauseToggle = null, onResume = null, onReset = null } = {}) {
    this.root = root;
    this.debugEnabled = debugEnabled;
    this.callbacks = { onPauseToggle, onResume, onReset };
    this.disposers = [];

    this.root.innerHTML = this.renderShell();
    this.viewport = this.root.querySelector('[data-game="viewport"]');
    this.canvas = this.root.querySelector('#game-canvas');
    this.pauseOverlay = this.root.querySelector('[data-pause-overlay]');
    this.pauseButton = this.root.querySelector('[data-action="pause"]');
    this.resumeButton = this.root.querySelector('[data-action="resume"]');
    this.resetButtons = [...this.root.querySelectorAll('[data-action="reset"]')];
    this.elements = {
      canvas: this.canvas,
      viewport: this.viewport,
      pauseOverlay: this.pauseOverlay,
      pauseButton: this.pauseButton,
      resumeButton: this.resumeButton,
      resetButtons: this.resetButtons,
    };

    this.hud = new Hud(this.root, { debugEnabled });
    this.bindToolbarEvents();
  }

  bindToolbarEvents() {
    this.addPointerHandler(this.pauseButton, (event) => {
      event.preventDefault();
      this.callbacks.onPauseToggle?.();
    });
    this.addPointerHandler(this.resumeButton, (event) => {
      event.preventDefault();
      this.callbacks.onResume?.();
    });
    this.resetButtons.forEach((button) => {
      this.addPointerHandler(button, (event) => {
        event.preventDefault();
        this.callbacks.onReset?.();
      });
    });

    const onKeyDown = (event) => {
      if (event.code !== 'Escape') return;
      event.preventDefault();
      this.callbacks.onPauseToggle?.();
    };
    window.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => window.removeEventListener('keydown', onKeyDown));
  }

  addPointerHandler(element, handler) {
    if (!element) return;
    element.addEventListener('click', handler);
    this.disposers.push(() => element.removeEventListener('click', handler));
  }

  setPaused(isPaused) {
    this.root.classList.toggle('is-paused', Boolean(isPaused));
    this.pauseOverlay?.classList.toggle('is-open', Boolean(isPaused));
    this.pauseOverlay?.setAttribute('aria-hidden', String(!isPaused));
    if (this.pauseButton) this.pauseButton.textContent = isPaused ? 'RESUME' : 'PAUSE';
  }

  setResetButtonLabels(label) {
    this.resetButtons.forEach((button) => {
      button.textContent = label;
    });
  }

  setMessage(message) {
    this.hud.showMessage(message);
  }

  setInteractionPrompt(message) {
    this.hud.showHint(message);
  }

  updateVitals({ hp, power, hunger } = {}) {
    if (hp !== undefined && this.hud.hpEl) this.hud.hpEl.textContent = Math.ceil(hp);
    if (power !== undefined && this.hud.powerEl) this.hud.powerEl.textContent = Math.floor(power);
    if (hunger) this.hud.updateHunger(hunger);
  }

  updateObjective() {
    // Objective UI is currently owned by ObjectivePanel; Game coordinates that panel.
  }

  updateEquipment() {
    // Equipment UI is currently owned by EquipmentPanel; Game coordinates that panel.
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
  }

  renderShell() {
    const debugReadout = this.debugEnabled
      ? '<p class="debug-readout" data-hud="debug" aria-label="Debug runtime state">POS 0.0, 0.0 · YAW 0° · PITCH 0°</p>'
      : '';

    return `
      <main class="reliquary-shell" aria-label="Dread Stone Black game interface">
        <header class="hud-top" aria-label="Player status and game toolbar">
          <section class="top-stat-row" aria-label="Player status">
            <div class="stat stat-hp"><span>HP</span><strong data-stat="hp">100</strong></div>
            <div class="stat stat-mp"><span>MP</span><strong>24</strong></div>
            <div class="stat stat-power"><span>POWER</span><strong data-stat="power">10</strong></div>
            <div class="stat stat-magic"><span>MAGIC</span><strong>3</strong></div>
            <div class="stat stat-hunger"><span>HUNGER</span><strong data-stat="hunger">3:00</strong></div>
          </section>

          <nav class="top-toolbar" aria-label="Game toolbar">
            <button class="ui-button toolbar-button toolbar-button--equipment" data-action="equipment" type="button" aria-label="Open equipment">Equipment</button>
            <button class="ui-button toolbar-button toolbar-button--reset" data-action="reset" type="button" aria-label="Reset progress">Reset</button>
            <button class="ui-button toolbar-button toolbar-button--pause" data-action="pause" type="button" aria-label="Pause game">Pause</button>
          </nav>
        </header>

        <section class="viewport-frame" aria-label="Game viewport">
          <div class="viewport-ornament viewport-ornament-top" aria-hidden="true">✦</div>
          <div class="viewport-stage" data-game="viewport">
            <canvas id="game-canvas" aria-label="Dread Stone Black game view"></canvas>
            <p class="interaction-hint" data-hud="hint" aria-live="polite"></p>
            <p class="field-kit-status" data-hud="field-kit" aria-live="polite" hidden></p>
            <div class="timed-action-progress-ring" data-hud="timed-action-progress" aria-hidden="true"></div>
            <div class="damage-flash" data-hud="damage" aria-hidden="true"></div>
            <section class="pause-overlay" data-pause-overlay aria-label="Paused" aria-hidden="true">
              <div class="pause-card">
                <p class="pause-title">PAUSED</p>
                <div class="pause-actions">
                  <button class="ui-button pause-action-button" data-action="resume" type="button">Resume</button>
                  <button class="ui-button pause-action-button pause-action-button--reset" data-action="reset" type="button">Reset</button>
                </div>
              </div>
            </section>
            <section class="ui-surface equipment-panel" data-equipment-panel aria-label="Inventory and equipment" aria-hidden="true">
              <div class="equipment-panel__header">
                <div>
                  <p class="equipment-panel__eyebrow">Carried gear</p>
                  <h2>Inventory</h2>
                </div>
                <button class="equipment-close" data-equipment="close" type="button" aria-label="Close inventory">&times;</button>
              </div>
              <div class="equipment-current" aria-label="Currently equipped gear">
                <span>Right Hand <strong data-equipment="current-weapon">Unarmed</strong></span>
                <span>Offhand <strong data-equipment="current-offhand">None</strong></span>
              </div>
              <div class="inventory-shell">
                <div class="inventory-tabs" data-inventory="pocket-tabs" role="tablist" aria-label="Inventory pockets"></div>
                <div class="inventory-content">
                  <article class="inventory-detail" data-inventory="detail" aria-live="polite"></article>
                  <div class="ui-scroll equipment-list" data-inventory="list"></div>
                </div>
              </div>
            </section>
          </div>
          <div class="viewport-ornament viewport-ornament-bottom" aria-hidden="true">◆</div>
        </section>

        <section class="control-deck" aria-label="Touch controls">
          <div class="deck-engraving" aria-hidden="true"></div>
          <div class="stick-zone move-zone" data-control="move" aria-label="Move">
            <div class="stick-ring">
              <div class="stick-cardinal stick-cardinal-up">▲</div>
              <div class="stick-cardinal stick-cardinal-down">▼</div>
              <div class="stick-knob" data-control="move-knob"></div>
            </div>
            <span>MOVE</span>
          </div>

          <div class="action-cluster" aria-label="Action buttons">
            <button class="interact-button action-button" data-action="interact" type="button" aria-label="Interact"><span>X</span></button>
            <button class="attack-button action-button" data-action="attack" type="button" aria-label="Attack"><span>A</span></button>
          </div>

          <div class="stick-zone look-zone" data-control="look" aria-label="Look">
            <div class="stick-ring">
              <div class="stick-cardinal stick-cardinal-left">◀</div>
              <div class="stick-cardinal stick-cardinal-right">▶</div>
              <div class="stick-knob" data-control="look-knob"></div>
            </div>
            <span>LOOK</span>
          </div>
        </section>

        ${debugReadout}
      </main>
    `;
  }
}
