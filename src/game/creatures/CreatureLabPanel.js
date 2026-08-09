export const CREATURE_LAB_TOUCH_TARGET_PX = 48;

export function getCreatureLabPrimaryActions(controller) {
  return [
    { id: 'respawn', label: 'Respawn', run: () => controller.respawn() },
    { id: 'reset_damage', label: 'Reset Damage', run: () => controller.resetDamage() },
  ];
}

export function getCreatureLabPackActions(controller, state) {
  return state.packs.map((pack) => ({
    id: `pack:${pack.packId}`,
    label: pack.supported ? pack.displayName : `${pack.displayName} — Unsupported`,
    pack,
    run: () => controller.selectPack(pack.packId),
  }));
}

export function getCreatureLabAnimationPanelActions(controller, state) {
  return state.animationActions.map((action) => ({
    ...action,
    run: () => controller.playAnimation(action.id),
  }));
}

export function getCreatureLabDamagePanelActions(controller) {
  return [
    { id: 'damage:light', label: 'Light', run: () => controller.setSelectedSiteStage('LIGHT') },
    { id: 'damage:medium', label: 'Medium', run: () => controller.setSelectedSiteStage('MEDIUM') },
    { id: 'damage:heavy', label: 'Heavy', run: () => controller.setSelectedSiteStage('HEAVY') },
    { id: 'damage:next', label: 'Next Stage', run: () => controller.advanceSelectedSite() },
    { id: 'damage:reset_site', label: 'Reset Site', run: () => controller.resetSelectedSite() },
    { id: 'damage:strike', label: 'Strike Selected Site', run: () => controller.strikeSelectedSite(), wide: true },
  ];
}

export function getCreatureLabDetachmentPanelActions(controller, state) {
  return state.detachmentActions.map((entry) => ({
    id: `detach:${entry.segmentId}`,
    label: entry.label,
    entry,
    run: () => controller.detachSegment(entry.segmentId),
  }));
}

export function getCreatureLabBodyStateActions(controller, state) {
  return [
    { id: 'body:kill', label: 'Kill / Death Test', run: () => controller.kill() },
    { id: 'body:ragdoll', label: state.ragdollAvailable ? 'Ragdoll Test' : 'Ragdoll Unavailable', run: () => controller.ragdoll(), disabled: !state.ragdollAvailable },
    { id: 'body:respawn', label: 'Respawn', run: () => controller.respawn() },
  ];
}

function element(tag, text = null, className = '') {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function formatBytesAsMb(bytes) {
  return Number.isFinite(bytes) ? (bytes / (1024 * 1024)).toFixed(1) : '—';
}

export class CreatureLabPanel {
  constructor({ controller, parent = document.body } = {}) {
    this.controller = controller;
    this.parent = parent;
    this.opened = false;
    this.sitesExpanded = true;
    this.diagnosticsExpanded = false;
    this.lastDiagnosticsUpdate = 0;
    this.transientStatus = null;
    this.disposers = [];
    this.build();
    this.disposers.push(this.controller.subscribe(() => this.render()));
    this.render();
  }

  build() {
    this.style = element('style');
    this.style.dataset.creatureLabStyle = 'true';
    this.style.textContent = `
      .creature-lab-toggle{position:fixed;z-index:1900;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));min-width:64px;min-height:${CREATURE_LAB_TOUCH_TARGET_PX}px;border:2px solid #b79b75;border-radius:8px;background:#17130f;color:#f4dfbd;font:700 15px/1 system-ui;letter-spacing:.12em;touch-action:manipulation}
      .creature-lab-panel{position:fixed;z-index:1901;top:max(6px,env(safe-area-inset-top));right:max(6px,env(safe-area-inset-right));bottom:max(6px,env(safe-area-inset-bottom));width:min(430px,calc(100vw - 12px));overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:0 12px 18px;box-sizing:border-box;border:1px solid #74644f;border-radius:10px;background:#0d0b09f2;color:#e9dfd0;font:14px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 8px 32px #000b}
      .creature-lab-panel[hidden],.creature-lab-toggle[hidden]{display:none}
      .creature-lab-header{position:sticky;top:0;z-index:1;margin:0 -12px 10px;padding:14px 12px 10px;background:#0d0b09f8;border-bottom:1px solid #574a3b}
      .creature-lab-title{margin:0;color:#e6bd85;font-size:17px;letter-spacing:.14em}
      .creature-lab-current{margin:5px 0 0;color:#c8d9d3;font-size:13px;overflow-wrap:anywhere}
      .creature-lab-section{margin:12px 0;padding:10px;border:1px solid #4f4437;border-radius:8px;background:#17130fd9}
      .creature-lab-section h3{margin:0 0 8px;color:#d9b782;font-size:13px;letter-spacing:.1em;text-transform:uppercase}
      .creature-lab-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .creature-lab-button{min-width:0;min-height:${CREATURE_LAB_TOUCH_TARGET_PX}px;padding:9px 8px;border:1px solid #786651;border-radius:6px;background:#2a231c;color:#f2e7d8;font:600 14px/1.2 system-ui;overflow-wrap:anywhere;touch-action:manipulation}
      .creature-lab-button[aria-pressed="true"]{border-color:#d2ae7b;background:#513c27;color:#fff3dc}
      .creature-lab-button:disabled{opacity:.48;color:#c3b8aa}
      .creature-lab-wide{grid-column:1/-1}
      .creature-lab-info{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;margin:0;font-size:12px}
      .creature-lab-info dt{color:#a99c8b;overflow-wrap:anywhere}.creature-lab-info dd{margin:0;text-align:right;overflow-wrap:anywhere}
      .creature-lab-note{margin:8px 0 0;color:#bdb1a3;font-size:12px;overflow-wrap:anywhere}
      .creature-lab-status{margin:9px 0 0;padding:8px;border-radius:5px;background:#090807;color:#b9d7ce;font:12px/1.35 ui-monospace,monospace;overflow-wrap:anywhere}
      .creature-lab-diagnostics{max-height:42vh;overflow:auto;margin:9px 0 0;padding:9px;border:1px solid #3e514b;background:#070908;color:#b9d7ce;font:11px/1.4 ui-monospace,monospace;white-space:pre-wrap;user-select:text;overflow-wrap:anywhere}
      @media (max-width:380px){.creature-lab-panel{width:calc(100vw - 8px);right:4px;padding-left:9px;padding-right:9px}.creature-lab-header{margin-left:-9px;margin-right:-9px}.creature-lab-grid{grid-template-columns:1fr}}
    `;
    this.toggleButton = element('button', 'LAB', 'creature-lab-toggle');
    this.toggleButton.type = 'button';
    this.toggleButton.dataset.creatureLabToggle = 'true';
    this.toggleButton.setAttribute('aria-label', 'Open Creature Lab');
    this.toggleButton.addEventListener('click', () => this.open());
    this.panel = element('aside', null, 'creature-lab-panel');
    this.panel.dataset.creatureLabPanel = 'true';
    this.panel.setAttribute('aria-label', 'Creature Lab controls');
    this.panel.hidden = true;
    const stop = (event) => event.stopPropagation();
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'wheel'].forEach((eventName) => {
      this.panel.addEventListener(eventName, stop, { passive: eventName !== 'wheel' });
      this.disposers.push(() => this.panel?.removeEventListener?.(eventName, stop));
    });
    this.parent.append(this.style, this.toggleButton, this.panel);
  }

  createButton(label, action, { pressed = false, disabled = false, wide = false, title = '' } = {}) {
    const button = element('button', label, `creature-lab-button${wide ? ' creature-lab-wide' : ''}`);
    button.type = 'button';
    button.disabled = disabled;
    button.setAttribute('aria-pressed', String(pressed));
    if (title) button.title = title;
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      this.transientStatus = null;
      try { await action?.(); } finally { this.render(); }
    });
    return button;
  }

  createSection(title) {
    const section = element('section', null, 'creature-lab-section');
    section.append(element('h3', title));
    return section;
  }

  createGrid() { return element('div', null, 'creature-lab-grid'); }

  render() {
    if (!this.panel) return;
    const scrollTop = this.panel.scrollTop;
    const state = this.controller.getViewState();
    this.panel.replaceChildren();
    const header = element('header', null, 'creature-lab-header');
    header.append(element('h2', 'CREATURE LAB', 'creature-lab-title'));
    header.append(element('p', `Current pack: ${state.selectedDisplayName}${state.loading ? ' — loading…' : ''}`, 'creature-lab-current'));
    const top = this.createGrid();
    top.append(this.createButton('Close', () => this.close()));
    getCreatureLabPrimaryActions(this.controller).forEach((action) => top.append(this.createButton(action.label, action.run, { disabled: state.loading })));
    header.append(top);
    this.panel.append(header);

    const packs = this.createSection('Pack Selector');
    const packGrid = this.createGrid();
    getCreatureLabPackActions(this.controller, state).forEach(({ label, pack, run }) => {
      packGrid.append(this.createButton(label, run, {
        pressed: state.selectedPackId === pack.packId,
        disabled: state.loading || !pack.supported,
        title: pack.supported ? 'Registered and supported' : `REGISTERED BUT CURRENT RUNTIME UNSUPPORTED: ${pack.reason}`,
      }));
      if (!pack.supported) packs.append(element('p', `${pack.displayName}: REGISTERED BUT CURRENT RUNTIME UNSUPPORTED — ${pack.reason}`, 'creature-lab-note'));
    });
    packs.prepend(packGrid);
    this.panel.append(packs);

    if (state.pack) this.panel.append(this.renderPackInfo(state));
    this.panel.append(this.renderAnimations(state));
    this.panel.append(this.renderDamage(state));
    this.panel.append(this.renderDetachments(state));
    this.panel.append(this.renderBodyState(state));
    this.panel.append(this.renderDiagnosticsSection());
    this.status = element('p', this.transientStatus ?? this.formatLastOperation(state.lastOperation), 'creature-lab-status');
    this.status.setAttribute('aria-live', 'polite');
    this.panel.append(this.status);
    this.panel.scrollTop = scrollTop;
    this.updateDiagnostics(true);
  }

  renderPackInfo(state) {
    const pack = state.pack;
    const section = this.createSection('Pack Info');
    const info = element('dl', null, 'creature-lab-info');
    const rows = [
      ['Pack ID', pack.packId],
      ['Character', pack.displayName],
      ['Raw height', `${pack.presentation.rawHeight.toFixed(3)} m`],
      ['GLB', `${formatBytesAsMb(pack.cost.glbFileBytes)} MB`],
      ['Triangles', pack.cost.triangleCount.toLocaleString()],
      ['Morph targets', pack.cost.morphTargetCount],
      ['Native progressive sites', pack.damage.progressiveDamageSiteIds.length],
      ['Damage keys', pack.cost.deformationKeyCount],
      ['Gore meshes', pack.cost.generatedGoreMeshCount],
      ['Stain meshes', pack.cost.stainMeshCount],
      ['Available segments', pack.damage.availableSegmentIds.join(', ')],
      ['Active runtime segments', state.profile?.activeDamageSegmentIds?.join(', ') ?? 'None'],
      ['Approved animations', pack.animations.approvedClips.map((clip) => clip.kind).join(', ')],
    ];
    rows.forEach(([label, value]) => { info.append(element('dt', String(label)), element('dd', String(value))); });
    section.append(info);
    return section;
  }

  renderAnimations(state) {
    const section = this.createSection('Animation Testing');
    const grid = this.createGrid();
    getCreatureLabAnimationPanelActions(this.controller, state).forEach((action) => grid.append(this.createButton(action.label, action.run, { disabled: state.loading })));
    if (!state.animationActions.length) section.append(element('p', 'Animation runtime is not ready.', 'creature-lab-note'));
    else section.append(grid);
    return section;
  }

  renderDamage(state) {
    const section = this.createSection('Damage Testing');
    const toggle = this.createButton('List Sites', () => { this.sitesExpanded = !this.sitesExpanded; }, { wide: true, pressed: this.sitesExpanded });
    section.append(toggle);
    if (!this.sitesExpanded) return section;
    if (!state.sites.length) {
      section.append(element('p', 'No native or compatibility progressive sites resolved.', 'creature-lab-note'));
      return section;
    }
    const siteGrid = this.createGrid();
    state.sites.forEach((site) => siteGrid.append(this.createButton(`${site.displayName} — ${site.authority}`, () => this.controller.selectSite(site.siteId), {
      pressed: state.selectedSiteId === site.siteId,
      wide: true,
    })));
    section.append(siteGrid);
    section.append(element('p', `Selected site: ${state.selectedSiteId ?? 'None'}`, 'creature-lab-note'));
    const controls = this.createGrid();
    getCreatureLabDamagePanelActions(this.controller).forEach((action) => controls.append(this.createButton(action.label, action.run, {
      disabled: !state.selectedSiteId,
      wide: action.wide === true,
    })));
    section.append(controls);
    return section;
  }

  renderDetachments(state) {
    const section = this.createSection('Detachment / Structural');
    const grid = this.createGrid();
    getCreatureLabDetachmentPanelActions(this.controller, state).forEach(({ entry, label, run }) => grid.append(this.createButton(label, run, {
      disabled: !entry.supportedByRuntime,
      title: entry.supportedByRuntime ? 'Available in pack and supported by runtime' : 'AVAILABLE IN PACK — NOT SUPPORTED BY RUNTIME',
    })));
    section.append(grid);
    section.append(element('p', 'Disabled entries are AVAILABLE IN PACK but not SUPPORTED BY RUNTIME.', 'creature-lab-note'));
    return section;
  }

  renderBodyState(state) {
    const section = this.createSection('Death / Body State');
    const grid = this.createGrid();
    getCreatureLabBodyStateActions(this.controller, state).forEach((action) => grid.append(this.createButton(action.label, action.run, {
      disabled: action.disabled === true,
      wide: true,
      title: action.id === 'body:ragdoll' && action.disabled ? 'Current packs retain authored death animation authority.' : '',
    })));
    section.append(grid);
    return section;
  }

  renderDiagnosticsSection() {
    const section = this.createSection('Diagnostics');
    const grid = this.createGrid();
    grid.append(this.createButton('Diagnostics', () => { this.diagnosticsExpanded = !this.diagnosticsExpanded; }, { pressed: this.diagnosticsExpanded }));
    grid.append(this.createButton('Copy Diagnostics', () => this.copyDiagnostics()));
    section.append(grid);
    this.diagnostics = element('pre', '', 'creature-lab-diagnostics');
    this.diagnostics.tabIndex = 0;
    this.diagnostics.hidden = !this.diagnosticsExpanded;
    section.append(this.diagnostics);
    return section;
  }

  formatLastOperation(operation) {
    if (!operation) return 'Ready. Open a control group to begin.';
    if (operation.error) return `${operation.operation}: ERROR — ${operation.error}`;
    const reason = operation.result?.reason;
    return `${operation.operation}: ${operation.ok ? 'OK' : 'NOT APPLIED'}${reason ? ` — ${reason}` : ''}`;
  }

  open() {
    this.opened = true;
    this.panel.hidden = false;
    this.toggleButton.hidden = true;
    this.controller.weaponControllerProvider?.()?.cancel?.('creature-lab-panel-open');
    this.render();
  }

  close() {
    this.opened = false;
    this.panel.hidden = true;
    this.toggleButton.hidden = false;
  }

  updateDiagnostics(force = false) {
    if (!this.diagnosticsExpanded || !this.diagnostics) return;
    const now = performance.now();
    if (!force && now - this.lastDiagnosticsUpdate < 250) return;
    this.lastDiagnosticsUpdate = now;
    this.diagnostics.textContent = JSON.stringify(this.controller.getDiagnostics(), null, 2);
  }

  update() {
    this.updateDiagnostics();
    if (this.status) this.status.textContent = this.transientStatus ?? this.formatLastOperation(this.controller.lastOperation);
  }

  async copyDiagnostics() {
    this.diagnosticsExpanded = true;
    this.render();
    const text = JSON.stringify(this.controller.getDiagnostics(), null, 2);
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      this.transientStatus = 'Diagnostics copied.';
      this.status.textContent = this.transientStatus;
    } catch {
      this.diagnostics.hidden = false;
      this.diagnostics.textContent = text;
      this.diagnostics.focus();
      const selection = globalThis.getSelection?.();
      const range = document.createRange?.();
      if (selection && range) { range.selectNodeContents(this.diagnostics); selection.removeAllRanges(); selection.addRange(range); }
      this.transientStatus = 'Clipboard permission failed. Diagnostics are visible and selected for manual copy.';
      this.status.textContent = this.transientStatus;
    }
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.panel?.remove();
    this.toggleButton?.remove();
    this.style?.remove();
    this.panel = null;
    this.toggleButton = null;
    this.style = null;
  }
}
