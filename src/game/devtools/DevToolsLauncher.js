export const DEV_TOOL_IDS = Object.freeze({
  creatureLab: 'creature-lab',
  encounterAuthoring: 'encounter-authoring',
  combatDebug: 'combat-debug',
});

export const DEV_TOOL_MENU_ITEMS = Object.freeze([
  Object.freeze({ id: DEV_TOOL_IDS.creatureLab, label: 'CREATURE LAB', detail: 'Bodies, damage and calibration' }),
  Object.freeze({ id: DEV_TOOL_IDS.encounterAuthoring, label: 'ENCOUNTER AUTHORING', detail: 'Place and test encounter spawns' }),
  Object.freeze({ id: DEV_TOOL_IDS.combatDebug, label: 'COMBAT DEBUG', detail: 'Combat instrumentation route' }),
]);

const DEV_QUERY_KEYS = Object.freeze(['creatureLab', 'encounterAuthoring', 'combatLab']);

export function createDevToolUrl(toolId, href = globalThis.location?.href ?? 'http://localhost/') {
  const url = new URL(href, 'http://localhost/');
  DEV_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
  if (toolId === DEV_TOOL_IDS.creatureLab) {
    url.searchParams.set('area', 'folsom');
    url.searchParams.set('creatureLab', '1');
  } else if (toolId === DEV_TOOL_IDS.encounterAuthoring) url.searchParams.set('encounterAuthoring', '1');
  else if (toolId === DEV_TOOL_IDS.combatDebug) url.searchParams.set('combatLab', '1');
  else throw new Error(`Unknown development tool "${toolId}".`);
  return `${url.pathname}${url.search}${url.hash}`;
}

function element(tag, text = null, className = '') {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export class DevToolsLauncher {
  constructor({ root = document.body, encounterAuthoringController, beforeOpenEncounterAuthoring = null } = {}) {
    this.root = root;
    this.encounterAuthoringController = encounterAuthoringController;
    this.beforeOpenEncounterAuthoring = beforeOpenEncounterAuthoring;
    this.disposers = [];
    this.build();
    if (encounterAuthoringController?.subscribe) {
      this.disposers.push(encounterAuthoringController.subscribe((state) => this.setAuthoringActive(state.open === true)));
      this.setAuthoringActive(encounterAuthoringController.getState?.().open === true);
    }
  }

  build() {
    this.style = element('style');
    this.style.dataset.devToolsLauncherStyle = 'true';
    this.style.textContent = `
      .top-toolbar.has-dev-tools{grid-template-columns:repeat(4,auto)}
      .dev-tools-toggle{min-width:44px!important;min-height:44px!important;padding:0 7px!important;border-color:#816c4e!important;color:#d9bd91!important;font:800 10px/1 ui-monospace,monospace!important;letter-spacing:.08em;overflow:visible!important;touch-action:manipulation}
      .dev-tools-toggle::after{content:none!important}.dev-tools-toggle[hidden],.dev-tools-menu[hidden]{display:none!important}
      .dev-tools-menu{position:fixed;z-index:1840;display:grid;gap:5px;width:min(238px,calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right) - 12px));box-sizing:border-box;padding:8px;border:1px solid #74634b;border-radius:8px;background:#0c0a08f5;box-shadow:0 8px 28px #000c;color:#eadfcf}
      .dev-tools-title{margin:0 0 2px;color:#e6bd85;font:700 11px/1.2 Georgia,serif;letter-spacing:.13em}
      .dev-tools-action{display:grid;gap:2px;min-height:48px;padding:7px 9px;border:1px solid #675742;border-radius:6px;background:#211b16;color:#f2e7d8;text-align:left;touch-action:manipulation}
      .dev-tools-action strong{font:700 10px/1.15 ui-monospace,monospace;letter-spacing:.05em}.dev-tools-action small{color:#aa9d8b;font:9px/1.2 system-ui,-apple-system,sans-serif}
      @media(max-width:430px){.top-toolbar.has-dev-tools{grid-template-columns:repeat(2,44px)}}
    `;
    this.toolbar = this.root.querySelector?.('.top-toolbar') ?? this.root;
    this.toolbar.classList?.add?.('has-dev-tools');
    this.toggle = element('button', 'DEV', 'ui-button toolbar-button dev-tools-toggle');
    this.toggle.type = 'button';
    this.toggle.dataset.devToolsLauncher = 'true';
    this.toggle.setAttribute('aria-label', 'Open development tools');
    this.toggle.setAttribute('aria-expanded', 'false');
    this.panel = element('section', null, 'dev-tools-menu');
    this.panel.dataset.devToolsMenu = 'true';
    this.panel.setAttribute('aria-label', 'Development tools');
    this.panel.hidden = true;
    this.panel.append(element('h2', 'DEVELOPMENT TOOLS', 'dev-tools-title'));
    DEV_TOOL_MENU_ITEMS.forEach((item) => this.panel.append(this.createAction(item)));
    this.toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.setPanelOpen(this.panel.hidden);
    });
    const stop = (event) => event.stopPropagation();
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend'].forEach((eventName) => {
      this.panel.addEventListener(eventName, stop);
      this.toggle.addEventListener(eventName, stop);
      this.disposers.push(() => this.panel?.removeEventListener?.(eventName, stop));
      this.disposers.push(() => this.toggle?.removeEventListener?.(eventName, stop));
    });
    const closeFromOutside = (event) => {
      if (!this.panel.hidden && !this.panel.contains(event.target) && !this.toggle.contains(event.target)) this.setPanelOpen(false);
    };
    const reposition = () => { if (!this.panel.hidden) this.positionPanel(); };
    document.addEventListener('pointerdown', closeFromOutside);
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener?.('resize', reposition);
    this.disposers.push(() => document.removeEventListener('pointerdown', closeFromOutside));
    this.disposers.push(() => window.removeEventListener('resize', reposition));
    this.disposers.push(() => window.visualViewport?.removeEventListener?.('resize', reposition));
    this.root.append(this.style, this.panel);
    this.toolbar.append(this.toggle);
  }

  createAction(item) {
    const button = element('button', null, 'dev-tools-action');
    button.type = 'button';
    button.dataset.devTool = item.id;
    button.replaceChildren(element('strong', item.label), element('small', item.detail));
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.chooseTool(item.id);
    });
    return button;
  }

  async chooseTool(toolId) {
    this.setPanelOpen(false);
    if (toolId === DEV_TOOL_IDS.encounterAuthoring) {
      const query = new URLSearchParams(window.location.search);
      if (query.get('creatureLab') === '1' || query.get('combatLab') === '1') {
        window.location.assign(createDevToolUrl(toolId));
        return;
      }
      await this.beforeOpenEncounterAuthoring?.();
      await this.encounterAuthoringController.open();
      return;
    }
    window.location.assign(createDevToolUrl(toolId));
  }

  setAuthoringActive(active) {
    this.toggle.hidden = active;
    if (active) this.setPanelOpen(false);
  }

  setPanelOpen(open) {
    this.panel.hidden = !open;
    this.toggle.setAttribute('aria-expanded', String(open));
    if (open) this.positionPanel();
  }

  positionPanel() {
    const rect = this.toggle.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const panelWidth = this.panel.offsetWidth || 238;
    const panelHeight = this.panel.offsetHeight || 176;
    const left = Math.max(6, Math.min(viewportWidth - panelWidth - 6, rect.right - panelWidth));
    const top = Math.max(6, Math.min(viewportHeight - panelHeight - 6, rect.bottom + 5));
    this.panel.style.left = `${left}px`;
    this.panel.style.top = `${top}px`;
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.toolbar?.classList?.remove?.('has-dev-tools');
    this.toggle?.remove();
    this.panel?.remove();
    this.style?.remove();
  }
}
