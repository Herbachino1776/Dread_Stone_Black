import { suggestEncounterId } from './EncounterAuthoringOperations.js';
import { ENCOUNTER_AUTHORING_MODES } from './EncounterAuthoringController.js';

const ROTATE_STEP = Math.PI / 12;

export const ENCOUNTER_AUTHORING_DRAWERS = Object.freeze({
  bank: 'bank',
  spawns: 'spawns',
  inspector: 'inspector',
  encounters: 'encounters',
  more: 'more',
});

export const ENCOUNTER_AUTHORING_PRESENTATIONS = Object.freeze({
  closed: 'closed',
  normal: 'normal',
  selected: 'selected',
  radius: 'radius',
  spatial: 'spatial',
  testing: 'testing',
});

export function resolveEncounterAuthoringPresentation(state = {}, { drawer = null, radiusEditing = false } = {}) {
  if (state.open !== true) return { presentation: ENCOUNTER_AUTHORING_PRESENTATIONS.closed, drawer: null };
  if (state.mode === ENCOUNTER_AUTHORING_MODES.testing) return { presentation: ENCOUNTER_AUTHORING_PRESENTATIONS.testing, drawer: null };
  if ([ENCOUNTER_AUTHORING_MODES.placing, ENCOUNTER_AUTHORING_MODES.moving].includes(state.mode)) {
    return { presentation: ENCOUNTER_AUTHORING_PRESENTATIONS.spatial, drawer: null };
  }
  const selected = Boolean(state.draft?.spawns?.some((spawn) => spawn.spawnId === state.selectedSpawnId));
  if (selected && radiusEditing) return { presentation: ENCOUNTER_AUTHORING_PRESENTATIONS.radius, drawer: null };
  return {
    presentation: selected ? ENCOUNTER_AUTHORING_PRESENTATIONS.selected : ENCOUNTER_AUTHORING_PRESENTATIONS.normal,
    drawer: Object.values(ENCOUNTER_AUTHORING_DRAWERS).includes(drawer) ? drawer : null,
  };
}

function element(tag, text = null, className = '') {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function stopWorldInput(node, disposers) {
  const stop = (event) => event.stopPropagation();
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'wheel'].forEach((eventName) => {
    node.addEventListener(eventName, stop, { passive: eventName !== 'wheel' });
    disposers.push(() => node.removeEventListener(eventName, stop));
  });
}

function presetDisplayName(state, presetId) {
  return state.enemyBank?.find((entry) => entry.presetId === presetId)?.displayName ?? presetId ?? 'Enemy';
}

export class EncounterAuthoringPanel {
  constructor({ controller, root = document.body } = {}) {
    this.controller = controller;
    this.root = root;
    this.surface = root.querySelector?.('[data-game="viewport"]') ?? root;
    this.filterText = '';
    this.drawerName = null;
    this.radiusEditing = false;
    this.jsonVisible = false;
    this.transientStatus = null;
    this.saveFlash = false;
    this.saveFlashTimer = null;
    this.disposers = [];
    this.build();
    this.disposers.push(controller.subscribe((state) => this.render(state)));
    this.render(controller.getState());
  }

  build() {
    this.style = element('style');
    this.style.dataset.encounterAuthoringStyle = 'true';
    this.style.textContent = `
      .ea-layer{position:absolute;inset:0;z-index:7;box-sizing:border-box;color:#eadfcf;font:12px/1.35 system-ui,-apple-system,sans-serif;pointer-events:none}
      .ea-layer[hidden],.ea-drawer[hidden],.ea-notice[hidden]{display:none}
      .ea-hud{position:absolute;left:max(6px,env(safe-area-inset-left));right:max(6px,env(safe-area-inset-right));top:max(6px,env(safe-area-inset-top));display:flex;align-items:flex-start;justify-content:space-between;gap:6px;pointer-events:none}
      .ea-chip{display:grid;gap:1px;min-width:0;max-width:min(42vw,310px);min-height:44px;padding:6px 9px;box-sizing:border-box;border:1px solid #665740;border-radius:7px;background:#0c0a08dc;box-shadow:0 3px 14px #0009;backdrop-filter:blur(5px);pointer-events:none}
      .ea-chip strong{min-width:0;overflow:hidden;color:#e6bd85;font:700 10px/1.15 ui-monospace,monospace;letter-spacing:.09em;text-overflow:ellipsis;white-space:nowrap}
      .ea-chip small{min-width:0;overflow:hidden;color:#a9c9bf;font:9px/1.2 ui-monospace,monospace;text-overflow:ellipsis;white-space:nowrap}
      .ea-chip.is-invalid{border-color:#925445}.ea-chip.is-invalid small{color:#ffb49e}
      .ea-actions{display:flex;flex:0 1 auto;justify-content:flex-end;gap:4px;pointer-events:auto}
      .ea-button,.ea-input{box-sizing:border-box;border:1px solid #786650;border-radius:6px;background:#211b16e8;color:#f2e7d8;font:700 10px/1.1 ui-monospace,monospace;letter-spacing:.035em;touch-action:manipulation}
      .ea-button{min-width:44px;min-height:44px;padding:5px 7px}.ea-button:disabled{opacity:.4}.ea-button[aria-pressed=true]{border-color:#e1bd7e;background:#523d27}.ea-button:active{transform:scale(.96)}.ea-button-wide{width:100%;grid-column:1/-1}
      .ea-button-primary{border-color:#9b825d;background:#3b2d20}.ea-button-danger{border-color:#994e42;background:#351713}.ea-button-wide{width:100%}.ea-button-save{position:relative}.ea-button-save.is-dirty::after{content:"";position:absolute;right:4px;top:4px;width:7px;height:7px;border-radius:50%;background:#e5a65f;box-shadow:0 0 7px #d58538}
      .ea-drawer{position:absolute;z-index:2;right:max(6px,env(safe-area-inset-right));top:max(58px,calc(env(safe-area-inset-top) + 6px));bottom:max(6px,env(safe-area-inset-bottom));width:min(330px,calc(100% - max(12px,env(safe-area-inset-left)) - max(12px,env(safe-area-inset-right))));box-sizing:border-box;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:9px;border:1px solid #74634b;border-radius:9px;background:#0c0a08f3;color:#eadfcf;box-shadow:0 8px 28px #000c;pointer-events:auto;touch-action:pan-y}
      .ea-drawer-head{position:sticky;top:-9px;z-index:1;display:flex;align-items:center;gap:8px;margin:-9px -9px 8px;padding:9px;border-bottom:1px solid #554735;background:#0c0a08fa}.ea-drawer-title{min-width:0;flex:1;margin:0;color:#e6bd85;font:700 13px/1.2 Georgia,serif;letter-spacing:.11em}.ea-drawer-close{min-width:44px}
      .ea-section{display:grid;gap:7px;margin:0 0 8px;padding:8px;border:1px solid #4c4133;border-radius:7px;background:#17130fdb}.ea-section:last-child{margin-bottom:0}.ea-section h3{margin:0;color:#d4b47f;font-size:10px;letter-spacing:.1em;text-transform:uppercase}
      .ea-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.ea-list{display:grid;gap:6px}.ea-wide{grid-column:1/-1}.ea-note{margin:0;color:#bdb1a3;font-size:10px}.ea-card{text-align:left;white-space:normal}.ea-card strong,.ea-card small{display:block}.ea-card small{margin-top:3px;color:#b9ad9c;font:9px/1.3 ui-monospace,monospace;overflow-wrap:anywhere}
      .ea-label{display:grid;gap:4px;color:#b8aa98;font-size:9px;letter-spacing:.06em}.ea-input{width:100%;min-height:44px;padding:7px;background:#100e0b;font-weight:500;user-select:text;-webkit-user-select:text}.ea-info{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 8px;margin:0;font-size:10px}.ea-info dt{color:#a99c8b}.ea-info dd{max-width:180px;margin:0;overflow-wrap:anywhere;text-align:right}
      .ea-readout{max-height:34vh;overflow:auto;margin:0;padding:7px;border:1px solid #3e514b;background:#070908;color:#c4ddd5;font:9px/1.35 ui-monospace,monospace;white-space:pre;user-select:text;-webkit-user-select:text}
      .ea-notice{position:absolute;left:max(6px,env(safe-area-inset-left));top:max(56px,calc(env(safe-area-inset-top) + 54px));z-index:1;max-width:min(320px,60%);margin:0;padding:6px 8px;border:1px solid #795f42;border-radius:6px;background:#181008e8;color:#ffd39b;font:9px/1.3 ui-monospace,monospace;box-shadow:0 3px 12px #0009;pointer-events:none}.ea-notice.is-error{border-color:#8f4a3b;color:#ffb49e}
      @media(max-width:620px){.ea-chip{max-width:38%}.ea-actions{flex-wrap:wrap}.ea-button{padding-inline:5px}.ea-drawer{top:max(104px,calc(env(safe-area-inset-top) + 52px))}.ea-notice{top:max(104px,calc(env(safe-area-inset-top) + 102px))}}
      @media(max-width:430px){.ea-hud{display:grid;grid-template-columns:1fr}.ea-chip{max-width:58%;grid-row:1}.ea-actions{grid-row:2;justify-self:end;max-width:100%}.ea-drawer{top:max(154px,calc(env(safe-area-inset-top) + 102px));width:calc(100% - max(12px,env(safe-area-inset-left)) - max(12px,env(safe-area-inset-right)))}.ea-grid{grid-template-columns:1fr}.ea-wide{grid-column:auto}}
      @media(max-height:360px) and (min-width:621px){.ea-chip{max-width:34vw}.ea-drawer{width:min(310px,44%)}.ea-button{font-size:9px;padding-inline:5px}}
    `;
    this.layer = element('section', null, 'ea-layer');
    this.layer.dataset.encounterAuthoringPanel = 'true';
    this.layer.setAttribute('aria-label', 'Encounter Authoring');
    this.hud = element('section', null, 'ea-hud');
    this.drawerElement = element('aside', null, 'ea-drawer');
    this.drawerElement.hidden = true;
    this.notice = element('p', null, 'ea-notice');
    this.notice.setAttribute('aria-live', 'polite');
    this.notice.hidden = true;
    stopWorldInput(this.hud, this.disposers);
    stopWorldInput(this.drawerElement, this.disposers);
    this.layer.append(this.hud, this.drawerElement, this.notice);
    this.surface.append(this.style, this.layer);
  }

  button(label, action, { wide = false, danger = false, primary = false, disabled = false, pressed = false, className = '', title = '' } = {}) {
    const classes = ['ea-button', wide ? 'ea-button-wide' : '', danger ? 'ea-button-danger' : '', primary ? 'ea-button-primary' : '', className].filter(Boolean).join(' ');
    const button = element('button', label, classes);
    button.type = 'button';
    button.disabled = disabled;
    button.setAttribute('aria-pressed', String(pressed));
    if (title) { button.title = title; button.setAttribute('aria-label', title); }
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.run(action);
    });
    return button;
  }

  async run(action) {
    this.transientStatus = null;
    try { await action?.(); }
    catch (error) {
      this.transientStatus = `ERROR: ${error.message}`;
      this.render(this.controller.getState());
    }
  }

  section(title) {
    const section = element('section', null, 'ea-section');
    section.append(element('h3', title));
    return section;
  }

  grid() { return element('div', null, 'ea-grid'); }

  render(state) {
    this.normalizeUiState(state);
    this.layer.hidden = !state.open;
    if (!state.open) return;
    const resolved = resolveEncounterAuthoringPresentation(state, { drawer: this.drawerName, radiusEditing: this.radiusEditing });
    this.renderHud(state, resolved.presentation);
    this.renderDrawer(state, resolved.drawer);
    this.renderNotice(state);
  }

  normalizeUiState(state) {
    if (!state.open) {
      this.drawerName = null;
      this.radiusEditing = false;
      return;
    }
    if ([ENCOUNTER_AUTHORING_MODES.placing, ENCOUNTER_AUTHORING_MODES.moving, ENCOUNTER_AUTHORING_MODES.testing].includes(state.mode)) {
      this.drawerName = null;
      this.radiusEditing = false;
      return;
    }
    if (state.mode === ENCOUNTER_AUTHORING_MODES.changingPreset) this.drawerName = ENCOUNTER_AUTHORING_DRAWERS.bank;
    if (!state.selectedSpawnId) {
      this.radiusEditing = false;
      if (this.drawerName === ENCOUNTER_AUTHORING_DRAWERS.inspector) this.drawerName = null;
    }
  }

  renderHud(state, presentation) {
    this.hud.replaceChildren();
    const chip = this.createStatusChip(state, presentation);
    const actions = element('nav', null, 'ea-actions');
    actions.setAttribute('aria-label', 'Current authoring actions');

    if (presentation === ENCOUNTER_AUTHORING_PRESENTATIONS.testing) {
      actions.append(
        this.button('RESET', () => this.controller.resetTest(), { title: 'Reset encounter test' }),
        this.button('AUTHOR', () => this.controller.returnToAuthoring(), { primary: true, title: 'Return to authoring' }),
      );
    } else if (presentation === ENCOUNTER_AUTHORING_PRESENTATIONS.spatial) {
      const valid = state.placementTarget?.valid === true;
      const moving = state.mode === ENCOUNTER_AUTHORING_MODES.moving;
      actions.append(
        this.button('TURN -', () => this.controller.rotatePlacement(-ROTATE_STEP), { title: 'Rotate left 15 degrees' }),
        this.button('TURN +', () => this.controller.rotatePlacement(ROTATE_STEP), { title: 'Rotate right 15 degrees' }),
        this.button(moving ? 'CONFIRM' : 'PLACE', () => moving ? this.controller.confirmMove() : this.controller.commitPlacement(), { primary: true, disabled: !valid, title: moving ? 'Confirm move' : 'Place enemy' }),
        this.button('CANCEL', () => moving ? this.controller.cancelMove() : this.controller.cancelPlacement(), { danger: true, title: moving ? 'Cancel move' : 'Cancel placement' }),
      );
    } else if (presentation === ENCOUNTER_AUTHORING_PRESENTATIONS.radius) {
      actions.append(
        this.button('-1', () => this.adjustRadius(state, -1), { title: 'Decrease home radius by 1 meter' }),
        this.button('-.5', () => this.adjustRadius(state, -0.5), { title: 'Decrease home radius by 0.5 meters' }),
        this.button('+.5', () => this.adjustRadius(state, 0.5), { title: 'Increase home radius by 0.5 meters' }),
        this.button('+1', () => this.adjustRadius(state, 1), { title: 'Increase home radius by 1 meter' }),
        this.button('DONE', () => { this.radiusEditing = false; this.render(this.controller.getState()); }, { primary: true, title: 'Finish home radius adjustment' }),
      );
    } else if (!state.draft) {
      actions.append(
        this.button('OPEN', () => this.openDrawer(ENCOUNTER_AUTHORING_DRAWERS.encounters), { primary: true, title: 'Open or create encounter' }),
        this.button('EXIT', () => this.controller.close(), { danger: true, title: 'Exit Encounter Authoring' }),
      );
    } else if (presentation === ENCOUNTER_AUTHORING_PRESENTATIONS.selected) {
      const confirmDelete = state.deleteConfirmationSpawnId === state.selectedSpawnId && this.controller.now() <= state.deleteConfirmationExpiresAt;
      actions.append(
        this.button('AIM', () => this.controller.selectSpawnAtReticle(), { title: 'Select authored enemy at reticle' }),
        this.button('MOVE', () => this.controller.beginMove(), { primary: true, title: 'Move selected enemy' }),
        this.button('TURN -', () => this.controller.rotateSelected(-ROTATE_STEP), { title: 'Rotate selected enemy left 15 degrees' }),
        this.button('TURN +', () => this.controller.rotateSelected(ROTATE_STEP), { title: 'Rotate selected enemy right 15 degrees' }),
        this.button('COPY', () => this.controller.duplicateSelected(), { title: 'Duplicate selected enemy and move the copy' }),
        this.button('PROPS', () => this.openDrawer(ENCOUNTER_AUTHORING_DRAWERS.inspector), { title: 'Open selected enemy properties' }),
        this.button(confirmDelete ? 'CONFIRM' : 'DELETE', () => this.controller.requestDeleteSelected(), { danger: true, title: confirmDelete ? 'Confirm deletion' : 'Delete selected enemy' }),
        this.button('DONE', () => this.controller.clearSelection(), { title: 'Clear selection' }),
      );
    } else {
      actions.append(
        this.button('ADD', () => this.openDrawer(ENCOUNTER_AUTHORING_DRAWERS.bank), { primary: true, title: 'Open Enemy Bank' }),
        this.button('SELECT', () => this.controller.selectSpawnAtReticle(), { disabled: state.draft.spawns.length === 0, title: 'Select authored enemy at reticle' }),
        this.button('SPAWNS', () => this.openDrawer(ENCOUNTER_AUTHORING_DRAWERS.spawns), { disabled: state.draft.spawns.length === 0, title: 'Open spawn list' }),
        this.button('TEST', () => this.startTest(), { disabled: state.busy, title: 'Test encounter in real gameplay' }),
        this.button(this.saveFlash ? 'SAVED' : 'SAVE', () => this.saveToProject(), { disabled: state.busy || !state.bridgeAvailable, className: `ea-button-save${state.dirty ? ' is-dirty' : ''}`, title: state.dirty ? 'Save local draft changes to project' : 'Save encounter to project' }),
        this.button('MORE', () => this.openDrawer(ENCOUNTER_AUTHORING_DRAWERS.more), { title: 'More encounter actions' }),
      );
    }
    this.hud.append(chip, actions);
  }

  createStatusChip(state, presentation) {
    const chip = element('div', null, 'ea-chip');
    let primary = 'AUTHOR';
    let secondary = `${state.locationId ?? 'no location'} / ${state.draft?.encounterId ?? 'choose encounter'}`;
    if (presentation === ENCOUNTER_AUTHORING_PRESENTATIONS.testing) {
      primary = 'TEST ENCOUNTER';
      secondary = state.draft?.displayName ?? state.testEncounterId ?? 'runtime';
    } else if (presentation === ENCOUNTER_AUTHORING_PRESENTATIONS.spatial) {
      const valid = state.placementTarget?.valid === true;
      primary = `${state.mode === ENCOUNTER_AUTHORING_MODES.moving ? 'MOVE' : 'PLACE'} / ${valid ? 'VALID GROUND' : 'NO VALID GROUND'}`;
      secondary = presetDisplayName(state, state.placementPresetId);
      chip.classList.toggle('is-invalid', !valid);
    } else if (presentation === ENCOUNTER_AUTHORING_PRESENTATIONS.selected || presentation === ENCOUNTER_AUTHORING_PRESENTATIONS.radius) {
      const spawn = state.draft?.spawns.find((entry) => entry.spawnId === state.selectedSpawnId);
      primary = presentation === ENCOUNTER_AUTHORING_PRESENTATIONS.radius ? `HOME RADIUS / ${spawn?.homeRadius.toFixed(1) ?? '?'} m` : `SELECTED / ${presetDisplayName(state, spawn?.presetId)}`;
      secondary = spawn?.spawnId ?? 'selection unavailable';
    } else if (state.draft) {
      primary = `AUTHOR / ${state.locationId} / ${state.draft.spawns.length} SPAWN${state.draft.spawns.length === 1 ? '' : 'S'}`;
      secondary = `${state.draft.encounterId} / ${state.dirty ? 'LOCAL DRAFT' : 'MATCHES PROJECT'}`;
    }
    chip.append(element('strong', primary), element('small', secondary));
    return chip;
  }

  renderDrawer(state, drawerName) {
    this.drawerElement.hidden = !drawerName;
    this.drawerElement.replaceChildren();
    if (!drawerName) return;
    const titles = { bank: 'ENEMY BANK', spawns: 'SPAWNS', inspector: 'SPAWN PROPERTIES', encounters: 'ENCOUNTERS', more: 'MORE' };
    const header = element('header', null, 'ea-drawer-head');
    header.append(element('h2', titles[drawerName], 'ea-drawer-title'), this.button('CLOSE', () => this.closeDrawer(state), { className: 'ea-drawer-close', title: `Close ${titles[drawerName]}` }));
    this.drawerElement.append(header);
    if (drawerName === ENCOUNTER_AUTHORING_DRAWERS.bank) this.renderBank(state);
    if (drawerName === ENCOUNTER_AUTHORING_DRAWERS.spawns) this.renderSpawnList(state);
    if (drawerName === ENCOUNTER_AUTHORING_DRAWERS.inspector) this.renderInspector(state);
    if (drawerName === ENCOUNTER_AUTHORING_DRAWERS.encounters) this.renderEncounters(state);
    if (drawerName === ENCOUNTER_AUTHORING_DRAWERS.more) this.renderMore(state);
  }

  openDrawer(drawerName) {
    this.radiusEditing = false;
    this.drawerName = this.drawerName === drawerName ? null : drawerName;
    const tabByDrawer = { bank: 'bank', spawns: 'selected', inspector: 'selected', encounters: 'encounter', more: 'save' };
    this.controller.setTab(tabByDrawer[drawerName]);
    this.render(this.controller.getState());
  }

  closeDrawer(state = this.controller.getState()) {
    this.drawerName = null;
    if (state.mode === ENCOUNTER_AUTHORING_MODES.changingPreset) this.controller.cancelPlacement();
    else this.render(state);
  }

  renderBank(state) {
    const bank = this.section(state.mode === ENCOUNTER_AUTHORING_MODES.changingPreset ? 'Choose replacement' : 'Production presets');
    const filter = element('input', null, 'ea-input');
    filter.type = 'search';
    filter.placeholder = 'Search name or preset ID';
    filter.value = this.filterText;
    filter.setAttribute('aria-label', 'Filter Enemy Presets');
    const list = element('div', null, 'ea-list');
    const renderList = () => {
      this.filterText = filter.value.toLowerCase().trim();
      list.replaceChildren();
      const entries = state.enemyBank.filter((entry) => !this.filterText || entry.displayName.toLowerCase().includes(this.filterText) || entry.presetId.includes(this.filterText));
      const recent = this.filterText ? [] : state.recentPresetIds.map((id) => entries.find((entry) => entry.presetId === id)).filter(Boolean);
      if (recent.length) {
        list.append(element('p', 'RECENT', 'ea-note'));
        recent.forEach((entry) => list.append(this.createPresetButton(state, entry)));
        list.append(element('p', 'ALL PRESETS', 'ea-note'));
      }
      entries.filter((entry) => !recent.includes(entry)).forEach((entry) => list.append(this.createPresetButton(state, entry)));
      if (!entries.length) list.append(element('p', 'No Enemy Presets match that search.', 'ea-note'));
    };
    filter.addEventListener('input', renderList);
    renderList();
    bank.append(filter, element('p', 'Selection closes the bank and returns the world to full placement view.', 'ea-note'), list);
    this.drawerElement.append(bank);
  }

  createPresetButton(state, entry) {
    const button = this.button('', () => {
      this.drawerName = null;
      this.controller.selectPreset(entry.presetId);
    }, { wide: true, disabled: entry.supported !== true, title: `Select ${entry.displayName}` });
    button.classList.add('ea-card');
    button.replaceChildren(
      element('strong', entry.displayName),
      element('small', `${entry.presetId}\n${entry.loadoutSummary} / ${entry.lootSummary}${entry.failureReason ? `\nUNSUPPORTED: ${entry.failureReason}` : ''}`),
    );
    return button;
  }

  renderSpawnList(state) {
    const section = this.section(`${state.draft.spawns.length} authored individual${state.draft.spawns.length === 1 ? '' : 's'}`);
    const list = element('div', null, 'ea-list');
    state.draft.spawns.forEach((spawn, index) => {
      const button = this.button('', () => {
        this.drawerName = null;
        this.controller.selectSpawn(spawn.spawnId);
      }, { wide: true, pressed: spawn.spawnId === state.selectedSpawnId, title: `Select spawn ${index + 1}` });
      button.classList.add('ea-card');
      button.replaceChildren(element('strong', `${index + 1}. ${presetDisplayName(state, spawn.presetId)}`), element('small', `${spawn.spawnId}\n${spawn.transform.position.map((value) => value.toFixed(1)).join(', ')}`));
      list.append(button);
    });
    section.append(this.button('SELECT AT RETICLE', () => {
      this.drawerName = null;
      this.controller.selectSpawnAtReticle();
    }, { wide: true, primary: true }), list);
    this.drawerElement.append(section);
  }

  renderInspector(state) {
    const spawn = state.draft.spawns.find((entry) => entry.spawnId === state.selectedSpawnId);
    if (!spawn) return;
    const infoSection = this.section('Identity');
    const info = element('dl', null, 'ea-info');
    [
      ['Preset', spawn.presetId],
      ['Spawn ID', spawn.spawnId],
      ['Position', spawn.transform.position.map((value) => value.toFixed(2)).join(', ')],
      ['Yaw', `${(spawn.transform.yaw * 180 / Math.PI).toFixed(1)} deg`],
      ['Home', `${spawn.homeRadius.toFixed(1)} m`],
      ['Gold', spawn.rewardOverride ? `${spawn.rewardOverride.gold} fixed` : 'Preset default'],
    ].forEach(([key, value]) => info.append(element('dt', key), element('dd', value)));
    const identityActions = this.grid();
    identityActions.append(
      this.button('CHANGE PRESET', () => this.controller.beginChangePreset(), { wide: true }),
      this.button('ADJUST RADIUS IN WORLD', () => {
        this.drawerName = null;
        this.radiusEditing = true;
        this.render(this.controller.getState());
      }, { wide: true, primary: true }),
    );
    infoSection.append(info, identityActions);
    this.drawerElement.append(infoSection);

    const tuning = this.section('Exact tuning');
    const radiusLabel = element('label', null, 'ea-label');
    radiusLabel.append(element('span', 'HOME RADIUS (METERS)'));
    const radiusInput = element('input', null, 'ea-input');
    radiusInput.type = 'number'; radiusInput.min = '0.1'; radiusInput.step = '0.5'; radiusInput.value = String(spawn.homeRadius);
    radiusLabel.append(radiusInput);
    const goldLabel = element('label', null, 'ea-label');
    goldLabel.append(element('span', 'FIXED GOLD OVERRIDE'));
    const goldInput = element('input', null, 'ea-input');
    goldInput.type = 'number'; goldInput.min = '1'; goldInput.step = '1'; goldInput.value = String(spawn.rewardOverride?.gold ?? 1);
    goldLabel.append(goldInput);
    const tuningActions = this.grid();
    tuningActions.append(
      this.button('APPLY RADIUS', () => this.controller.setSelectedHomeRadius(radiusInput.value)),
      this.button('SET GOLD', () => this.controller.setSelectedGoldOverride(goldInput.value)),
      this.button('PRESET GOLD', () => this.controller.removeSelectedGoldOverride(), { wide: true, disabled: !spawn.rewardOverride }),
    );
    tuning.append(radiusLabel, goldLabel, tuningActions);
    this.drawerElement.append(tuning);
  }

  adjustRadius(state, delta) {
    const spawn = state.draft?.spawns.find((entry) => entry.spawnId === state.selectedSpawnId);
    if (!spawn) return;
    this.controller.setSelectedHomeRadius(Math.max(0.1, spawn.homeRadius + delta));
  }

  renderEncounters(state) {
    if (state.draft) {
      const current = this.section('Current');
      current.append(element('p', `${state.draft.displayName}\n${state.draft.encounterId} / ${state.draft.spawns.length} spawns`, 'ea-note'));
      this.drawerElement.append(current);
    }
    const production = this.section('Production encounters');
    const productionList = element('div', null, 'ea-list');
    state.productionEncounters.forEach((encounter) => productionList.append(this.button(`${encounter.displayName} / ${encounter.spawns.length}`, () => {
      this.drawerName = null;
      this.controller.openEncounter(encounter.encounterId);
    }, { wide: true })));
    if (!state.productionEncounters.length) productionList.append(element('p', `No production encounters belong to ${state.locationId}.`, 'ea-note'));
    production.append(productionList);
    this.drawerElement.append(production);

    const locals = this.section('Local drafts');
    const localList = element('div', null, 'ea-list');
    state.localDrafts.forEach((draft) => localList.append(this.button(`${draft.displayName} / ${draft.spawnCount}`, () => {
      this.drawerName = null;
      this.controller.openLocalDraft(draft.encounterId);
    }, { wide: true })));
    if (!state.localDrafts.length) localList.append(element('p', 'No recoverable local drafts for this location.', 'ea-note'));
    locals.append(localList);
    this.drawerElement.append(locals);

    const create = this.section('New encounter');
    const displayLabel = element('label', null, 'ea-label');
    displayLabel.append(element('span', 'DISPLAY NAME'));
    const displayInput = element('input', null, 'ea-input');
    displayInput.placeholder = 'North Road Bandit Camp';
    displayLabel.append(displayInput);
    const idLabel = element('label', null, 'ea-label');
    idLabel.append(element('span', 'ENCOUNTER ID'));
    const idInput = element('input', null, 'ea-input');
    idInput.placeholder = 'north_road_bandit_camp';
    idLabel.append(idInput);
    displayInput.addEventListener('input', () => { if (idInput.dataset.userEdited !== 'true') idInput.value = suggestEncounterId(displayInput.value); });
    idInput.addEventListener('input', () => { idInput.dataset.userEdited = 'true'; });
    create.append(displayLabel, idLabel, element('p', `Location is fixed to ${state.locationId}.`, 'ea-note'), this.button('CREATE LOCAL DRAFT', () => {
      this.drawerName = null;
      this.controller.createNewEncounter({ displayName: displayInput.value.trim(), encounterId: idInput.value.trim() });
    }, { wide: true, primary: true }));
    this.drawerElement.append(create);
  }

  renderMore(state) {
    const summary = this.section('Encounter');
    const info = element('dl', null, 'ea-info');
    [
      ['ID', state.draft.encounterId],
      ['Location', state.draft.locationId],
      ['Spawns', state.draft.spawns.length],
      ['Project', state.dirty ? 'Local changes' : 'Matches baseline'],
      ['Last save', state.lastSavedPath ?? 'Not this session'],
    ].forEach(([key, value]) => info.append(element('dt', key), element('dd', String(value))));
    const grid = this.grid();
    const confirmReset = state.productionBaseline && this.controller.now() <= state.resetProductionConfirmationExpiresAt;
    grid.append(
      this.button('OPEN / NEW', () => this.openDrawer(ENCOUNTER_AUTHORING_DRAWERS.encounters), { wide: true }),
      this.button(confirmReset ? 'CONFIRM RESET' : 'RESET TO PROJECT', () => this.controller.requestResetToProduction(), { wide: true, danger: true, disabled: !state.productionBaseline }),
      this.button(this.jsonVisible ? 'HIDE JSON' : 'VIEW JSON', () => { this.jsonVisible = !this.jsonVisible; this.render(this.controller.getState()); }),
      this.button('COPY JSON', () => this.copyJson()),
      this.button('EXPORT JSON', () => this.exportJson()),
      this.button('EXIT AUTHORING', () => this.controller.close(), { danger: true }),
    );
    summary.append(info, grid);
    if (this.jsonVisible) {
      this.readout = element('pre', this.controller.getCanonicalJson(), 'ea-readout');
      this.readout.tabIndex = 0;
      summary.append(this.readout);
    }
    this.drawerElement.append(summary);
  }

  async startTest() {
    this.drawerName = null;
    await this.controller.testEncounter();
  }

  async saveToProject() {
    this.drawerName = null;
    await this.controller.saveToProject();
    this.saveFlash = true;
    this.transientStatus = 'SAVED TO PROJECT';
    window.clearTimeout(this.saveFlashTimer);
    this.saveFlashTimer = window.setTimeout(() => {
      this.saveFlash = false;
      this.transientStatus = null;
      this.render(this.controller.getState());
    }, 1600);
    this.render(this.controller.getState());
  }

  renderNotice(state) {
    const needsAttention = /ERROR|FAILED|CONFIRM|unavailable|No authoring marker/i.test(state.status ?? '');
    const message = this.transientStatus ?? (state.busy ? 'WORKING...' : needsAttention ? state.status : null);
    this.notice.hidden = !message;
    this.notice.textContent = message ?? '';
    this.notice.classList.toggle('is-error', /ERROR|FAILED/i.test(message ?? ''));
  }

  async copyJson() {
    const value = this.controller.getCanonicalJson();
    try {
      await navigator.clipboard.writeText(value);
      this.transientStatus = 'Canonical Encounter JSON copied.';
    } catch {
      this.drawerName = ENCOUNTER_AUTHORING_DRAWERS.more;
      this.jsonVisible = true;
      this.render(this.controller.getState());
      this.readout?.focus?.();
      const selection = window.getSelection?.();
      const range = document.createRange?.();
      if (selection && range && this.readout) { range.selectNodeContents(this.readout); selection.removeAllRanges(); selection.addRange(range); }
      this.transientStatus = 'Clipboard unavailable. JSON is selected for manual copy.';
    }
    this.render(this.controller.getState());
  }

  exportJson() {
    const draft = this.controller.getState().draft;
    const blob = new Blob([this.controller.getCanonicalJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = element('a');
    anchor.href = url;
    anchor.download = `${draft.encounterId}.json`;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.transientStatus = `Exported ${draft.encounterId}.json.`;
    this.render(this.controller.getState());
  }

  dispose() {
    window.clearTimeout(this.saveFlashTimer);
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.style?.remove();
    this.layer?.remove();
  }
}
