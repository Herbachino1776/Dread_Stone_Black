export class GoreDebug {
  constructor({ runtime, onClear }) {
    this.runtime = runtime;
    this.onClear = onClear;
    this.enabled = false;
    this.elapsed = 0;
    this.panel = null;
    this.keyHandler = null;

    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    this.panel = document.createElement('pre');
    this.panel.dataset.goreDebug = 'true';
    this.panel.style.cssText = [
      'position:fixed',
      'left:12px',
      'bottom:12px',
      'z-index:20',
      'max-width:320px',
      'margin:0',
      'padding:10px 12px',
      'background:rgba(10,6,5,0.78)',
      'color:#d8b8a2',
      'font:12px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace',
      'pointer-events:none',
      'white-space:pre-wrap',
      'display:none',
    ].join(';');
    document.body.appendChild(this.panel);

    this.keyHandler = (event) => {
      if (event.code === 'F6') {
        this.setEnabled(!this.enabled);
        console.info(`Gore debug ${this.enabled ? 'enabled' : 'disabled'}.`);
      } else if (event.code === 'F7') {
        this.onClear?.();
        console.info('Gore cleared for current location.');
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.panel) this.panel.style.display = this.enabled ? 'block' : 'none';
  }

  update(deltaSeconds) {
    if (!this.enabled || !this.panel) return;
    this.elapsed += deltaSeconds;
    if (this.elapsed < 0.2) return;
    this.elapsed = 0;
    const summary = this.runtime.getDebugSummary();
    this.panel.textContent = [
      'GORE DEBUG',
      `particles ${summary.activeParticles}/${summary.maxActiveParticles}`,
      `decals ${summary.decals}/${summary.maxDecalsGlobal}`,
      `corpses ${summary.corpses}/${summary.maxCorpsesGlobal}`,
      `wounds ${summary.wounds}`,
      `lowPower ${summary.lowPowerMode}`,
      `last ${summary.lastEventType ?? 'none'} ${summary.lastEventRoom ?? ''}`,
      `rooms decals ${JSON.stringify(summary.roomDecals)}`,
      `rooms corpses ${JSON.stringify(summary.roomCorpses)}`,
      'F6 toggle / F7 clear',
    ].join('\n');
  }

  dispose() {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.panel?.remove();
  }
}

