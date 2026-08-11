function element(tag, text = null) { const node = document.createElement(tag); if (text != null) node.textContent = text; return node; }

export class DevToolsLauncher {
  constructor({ root = document.body, encounterAuthoringController, beforeOpenEncounterAuthoring = null } = {}) {
    this.root = root;
    this.encounterAuthoringController = encounterAuthoringController;
    this.beforeOpenEncounterAuthoring = beforeOpenEncounterAuthoring;
    this.disposers = [];
    this.build();
  }

  build() {
    this.toggle = element('button', 'DEV TOOLS'); this.toggle.type = 'button';
    this.toggle.style.cssText = 'position:fixed;z-index:1820;right:max(8px,env(safe-area-inset-right));top:max(8px,env(safe-area-inset-top));min-height:48px;padding:0 12px;border:1px solid #907956;border-radius:7px;background:#17120eee;color:#f0dfbd;font:700 11px/1 ui-monospace,monospace;letter-spacing:.06em;touch-action:manipulation;';
    this.panel = element('section'); this.panel.hidden = true;
    this.panel.style.cssText = 'position:fixed;z-index:1821;right:max(8px,env(safe-area-inset-right));top:max(64px,calc(env(safe-area-inset-top) + 56px));width:min(300px,calc(100vw - 16px));padding:10px;border:1px solid #78664d;border-radius:9px;background:#0d0b09f5;box-shadow:0 8px 28px #000b;display:none;gap:8px;';
    const title = element('strong', 'DEV TOOLS'); title.style.cssText = 'color:#e6bd85;font:700 13px/1.2 Georgia,serif;letter-spacing:.12em;'; this.panel.append(title);
    this.addButton('CREATURE LAB', () => this.navigate({ creatureLab: '1', combatLab: null }));
    this.addButton('ENCOUNTER AUTHORING', async () => { this.setPanelOpen(false); await this.beforeOpenEncounterAuthoring?.(); await this.encounterAuthoringController.open(); });
    this.addButton('COMBAT DEBUG', () => this.navigate({ combatLab: '1', creatureLab: null }));
    this.toggle.addEventListener('click', (event) => { event.stopPropagation(); this.setPanelOpen(this.panel.hidden); });
    const stop = (event) => event.stopPropagation();
    ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend'].forEach((eventName) => { this.panel.addEventListener(eventName, stop); this.toggle.addEventListener(eventName, stop); });
    this.root.append(this.toggle, this.panel);
  }

  setPanelOpen(open) {
    this.panel.hidden = !open;
    this.panel.style.display = open ? 'grid' : 'none';
    this.toggle.setAttribute('aria-expanded', String(open));
  }

  addButton(label, action) {
    const button = element('button', label); button.type = 'button';
    button.style.cssText = 'min-height:52px;padding:8px;border:1px solid #786650;border-radius:7px;background:#2a231c;color:#f2e7d8;font:700 12px/1.2 ui-monospace,monospace;touch-action:manipulation;';
    button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); void action(); });
    this.panel.append(button);
  }

  navigate(changes) {
    const query = new URLSearchParams(window.location.search);
    Object.entries(changes).forEach(([key, value]) => value == null ? query.delete(key) : query.set(key, value));
    window.location.assign(`${window.location.pathname}?${query.toString()}`);
  }

  dispose() { this.toggle?.remove(); this.panel?.remove(); this.disposers.forEach((dispose) => dispose()); this.disposers = []; }
}
