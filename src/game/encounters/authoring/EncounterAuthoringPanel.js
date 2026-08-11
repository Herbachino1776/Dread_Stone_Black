import { suggestEncounterId } from './EncounterAuthoringOperations.js';
import { ENCOUNTER_AUTHORING_MODES } from './EncounterAuthoringController.js';

const ROTATE_STEP = Math.PI / 12;

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

export class EncounterAuthoringPanel {
  constructor({ controller, root = document.body } = {}) {
    this.controller = controller;
    this.root = root;
    this.filterText = '';
    this.jsonVisible = false;
    this.transientStatus = null;
    this.disposers = [];
    this.build();
    this.disposers.push(controller.subscribe((state) => this.render(state)));
    this.render(controller.getState());
  }

  build() {
    this.style = element('style');
    this.style.dataset.encounterAuthoringStyle = 'true';
    this.style.textContent = `
      .ea-shell{position:fixed;z-index:1850;left:50%;bottom:max(5px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(560px,calc(100vw - 10px));max-height:min(70vh,680px);display:flex;flex-direction:column;box-sizing:border-box;border:1px solid #7d6b51;border-radius:12px;background:#0c0a08f2;color:#eadfcf;font:13px/1.38 system-ui,-apple-system,sans-serif;box-shadow:0 8px 34px #000c;overflow:hidden;overscroll-behavior:contain}
      .ea-shell[hidden],.ea-restore[hidden],.ea-modebar[hidden]{display:none}.ea-header{padding:10px 10px 8px;border-bottom:1px solid #594b39;background:#15110df7}.ea-headrow{display:flex;align-items:center;gap:8px}.ea-title{min-width:0;flex:1;margin:0;color:#e6bd85;font:700 15px/1.2 Georgia,serif;letter-spacing:.12em}.ea-location{margin:4px 0 0;color:#a9c9bf;font:11px/1.3 ui-monospace,monospace;overflow-wrap:anywhere}.ea-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:9px}.ea-body{min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:10px}.ea-section{margin:0 0 10px;padding:9px;border:1px solid #4c4133;border-radius:8px;background:#17130fdb}.ea-section h3{margin:0 0 8px;color:#d4b47f;font-size:12px;letter-spacing:.1em;text-transform:uppercase}.ea-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.ea-list{display:grid;gap:7px}.ea-button,.ea-input{min-height:48px;box-sizing:border-box;border:1px solid #786650;border-radius:7px;background:#2a231c;color:#f2e7d8;font:600 13px/1.2 system-ui;padding:8px;touch-action:manipulation}.ea-button:disabled{opacity:.43}.ea-button[aria-pressed=true]{border-color:#e1bd7e;background:#523d27}.ea-button-danger{border-color:#994e42;background:#351713}.ea-wide{grid-column:1/-1}.ea-input{width:100%;background:#100e0b;font-weight:500;user-select:text;-webkit-user-select:text}.ea-label{display:grid;gap:5px;color:#b8aa98;font-size:11px;letter-spacing:.05em}.ea-card{width:100%;text-align:left;white-space:pre-line}.ea-card strong,.ea-card small{display:block}.ea-card small{margin-top:4px;color:#b9ad9c;font:10px/1.35 ui-monospace,monospace;overflow-wrap:anywhere}.ea-state{margin:0;padding:8px;border:1px solid #4f665e;border-radius:6px;background:#0b1512;color:#b9d7ce;font:11px/1.4 ui-monospace,monospace;overflow-wrap:anywhere}.ea-dirty{border-color:#ad7440;background:#2b180d;color:#ffd39b}.ea-note{margin:7px 0 0;color:#bdb1a3;font-size:11px}.ea-readout{max-height:32vh;overflow:auto;margin:8px 0 0;padding:8px;border:1px solid #3e514b;background:#070908;color:#c4ddd5;font:10px/1.4 ui-monospace,monospace;white-space:pre;user-select:text;-webkit-user-select:text}.ea-info{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;margin:0;font-size:11px}.ea-info dt{color:#a99c8b}.ea-info dd{margin:0;text-align:right;overflow-wrap:anywhere}.ea-modebar{position:fixed;z-index:1852;left:50%;bottom:max(5px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(560px,calc(100vw - 10px));padding:8px;box-sizing:border-box;border:1px solid #9b825d;border-radius:10px;background:#0d0b09f5;color:#eadfcf;box-shadow:0 6px 28px #000c}.ea-mode-title{margin:0 0 7px;text-align:center;color:#e6bd85;font:700 11px/1.2 ui-monospace,monospace;letter-spacing:.08em}.ea-restore{position:fixed;z-index:1851;right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));min-height:48px;padding:0 13px;border:1px solid #a88b62;border-radius:7px;background:#17120eee;color:#f0dfbd;font:700 11px/1 ui-monospace,monospace;touch-action:manipulation}.ea-compact{min-height:42px;padding:6px;font-size:11px}.ea-error{color:#ffb49e;border-color:#8f4a3b}.ea-separator{height:1px;margin:8px 0;background:#3f372e}
      @media(max-width:380px){.ea-shell,.ea-modebar{width:calc(100vw - 6px)}.ea-body{padding:7px}.ea-grid{grid-template-columns:1fr}.ea-wide{grid-column:auto}.ea-tabs{gap:3px}.ea-tabs .ea-button{min-height:44px;padding:5px;font-size:10px}}
    `;
    this.shell = element('aside', null, 'ea-shell');
    this.shell.setAttribute('aria-label', 'Encounter Authoring');
    this.restore = element('button', 'AUTHOR', 'ea-restore');
    this.restore.type = 'button';
    this.restore.addEventListener('click', () => this.controller.setMinimized(false));
    this.modebar = element('section', null, 'ea-modebar');
    stopWorldInput(this.shell, this.disposers);
    stopWorldInput(this.restore, this.disposers);
    stopWorldInput(this.modebar, this.disposers);
    this.root.append(this.style, this.shell, this.restore, this.modebar);
  }

  button(label, action, { wide = false, danger = false, disabled = false, pressed = false } = {}) {
    const button = element('button', label, `ea-button${wide ? ' ea-wide' : ''}${danger ? ' ea-button-danger' : ''}`);
    button.type = 'button';
    button.disabled = disabled;
    button.setAttribute('aria-pressed', String(pressed));
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
    catch (error) { this.transientStatus = `ERROR: ${error.message}`; this.render(this.controller.getState()); }
  }

  section(title) { const section = element('section', null, 'ea-section'); section.append(element('h3', title)); return section; }
  grid() { return element('div', null, 'ea-grid'); }

  render(state) {
    this.shell.hidden = !state.open || state.minimized;
    this.restore.hidden = !state.open || !state.minimized || [ENCOUNTER_AUTHORING_MODES.placing, ENCOUNTER_AUTHORING_MODES.moving, ENCOUNTER_AUTHORING_MODES.testing].includes(state.mode);
    this.shell.replaceChildren();
    if (state.open && !state.minimized) this.renderShell(state);
    this.renderModebar(state);
  }

  renderShell(state) {
    const header = element('header', null, 'ea-header');
    const headrow = element('div', null, 'ea-headrow');
    headrow.append(
      element('h2', 'Encounter Authoring', 'ea-title'),
      this.button('MINIMIZE', () => this.controller.setMinimized(true), { disabled: state.busy }),
      this.button('EXIT', () => this.controller.close(), { danger: true, disabled: state.busy }),
    );
    header.append(headrow, element('p', `LOCATION ${state.locationId ?? 'unavailable'} · ${state.draft?.encounterId ?? 'no encounter selected'}`, 'ea-location'));
    const tabs = element('nav', null, 'ea-tabs');
    [['encounter', 'ENCOUNTER'], ['bank', 'ENEMY BANK'], ['selected', 'SELECTED'], ['save', 'SAVE']].forEach(([id, label]) => {
      tabs.append(this.button(label, () => this.controller.setTab(id), { pressed: state.tab === id, disabled: id !== 'encounter' && !state.draft }));
    });
    header.append(tabs);
    const body = element('div', null, 'ea-body');
    const status = element('p', this.transientStatus ?? state.status, `ea-state${state.dirty ? ' ea-dirty' : ''}${this.transientStatus ? ' ea-error' : ''}`);
    body.append(status);
    if (state.tab === 'encounter') this.renderEncounter(body, state);
    if (state.tab === 'bank') this.renderBank(body, state);
    if (state.tab === 'selected') this.renderSelected(body, state);
    if (state.tab === 'save') this.renderSave(body, state);
    this.shell.append(header, body);
  }

  renderEncounter(body, state) {
    const current = this.section('Current draft');
    if (state.draft) {
      const info = element('dl', null, 'ea-info');
      [['Name', state.draft.displayName], ['Encounter ID', state.draft.encounterId], ['Location', state.draft.locationId], ['Spawns', state.draft.spawns.length], ['Source', state.draftSource === 'production' ? 'PRODUCTION BASELINE CLONE' : 'LOCAL DRAFT'], ['State', state.dirty ? 'UNSAVED CHANGES' : 'MATCHES SESSION BASELINE']].forEach(([key, value]) => info.append(element('dt', key), element('dd', String(value))));
      const actions = this.grid();
      actions.append(this.button('SELECT AT RETICLE', () => this.controller.selectSpawnAtReticle(), { wide: true, disabled: state.draft.spawns.length === 0 }));
      if (state.productionBaseline) actions.append(this.button(this.controller.now() <= state.resetProductionConfirmationExpiresAt ? 'CONFIRM RESET TO PRODUCTION' : 'RESET TO PRODUCTION', () => this.controller.requestResetToProduction(), { danger: true, wide: true }));
      current.append(info, actions);
    } else current.append(element('p', 'Choose production content, restore a location-scoped local draft, or create a new encounter.', 'ea-note'));
    body.append(current);

    const production = this.section('Open existing encounter');
    const productionList = element('div', null, 'ea-list');
    state.productionEncounters.forEach((encounter) => productionList.append(this.button(`${encounter.displayName}\n${encounter.encounterId} · ${encounter.spawns.length} spawns`, () => this.controller.openEncounter(encounter.encounterId), { wide: true })));
    if (!state.productionEncounters.length) productionList.append(element('p', `No installed production encounters belong to ${state.locationId}.`, 'ea-note'));
    production.append(productionList);
    body.append(production);

    const locals = this.section('Recover local drafts');
    const localList = element('div', null, 'ea-list');
    state.localDrafts.forEach((draft) => localList.append(this.button(`${draft.displayName}\n${draft.encounterId} · ${draft.spawnCount} spawns${draft.hasProductionBaseline ? ' · production baseline exists' : ''}`, () => this.controller.openLocalDraft(draft.encounterId), { wide: true })));
    if (!state.localDrafts.length) localList.append(element('p', 'No recoverable LOCAL DRAFT exists for this location.', 'ea-note'));
    locals.append(localList);
    body.append(locals);

    const create = this.section('New encounter');
    const displayLabel = element('label', null, 'ea-label');
    displayLabel.append(element('span', 'Display Name'));
    const displayInput = element('input', null, 'ea-input');
    displayInput.placeholder = 'North Road Bandit Camp';
    const idLabel = element('label', null, 'ea-label');
    idLabel.append(element('span', 'Encounter ID'));
    const idInput = element('input', null, 'ea-input');
    idInput.placeholder = 'north_road_bandit_camp';
    displayInput.addEventListener('input', () => { if (idInput.dataset.userEdited !== 'true') idInput.value = suggestEncounterId(displayInput.value); });
    idInput.addEventListener('input', () => { idInput.dataset.userEdited = 'true'; });
    displayLabel.append(displayInput); idLabel.append(idInput);
    create.append(displayLabel, idLabel, element('p', `Location is fixed by the active SceneSession: ${state.locationId}`, 'ea-note'), this.button('CREATE LOCAL DRAFT', () => this.controller.createNewEncounter({ displayName: displayInput.value.trim(), encounterId: idInput.value.trim() }), { wide: true }));
    body.append(create);
  }

  renderBank(body, state) {
    const bank = this.section('Enemy Bank');
    const filter = element('input', null, 'ea-input');
    filter.type = 'search'; filter.placeholder = 'Filter display name or preset ID'; filter.value = this.filterText;
    const list = element('div', null, 'ea-list');
    const renderList = () => {
      this.filterText = filter.value.toLowerCase().trim();
      list.replaceChildren();
      const entries = state.enemyBank.filter((entry) => !this.filterText || entry.displayName.toLowerCase().includes(this.filterText) || entry.presetId.includes(this.filterText));
      entries.forEach((entry) => {
        const label = `${entry.displayName}\n${entry.presetId}\nCreature: ${entry.creatureDefinitionId}\n${entry.loadoutSummary}\n${entry.lootSummary}${entry.failureReason ? `\nUNSUPPORTED: ${entry.failureReason}` : ''}`;
        const button = this.button(label, () => this.controller.selectPreset(entry.presetId), { wide: true, disabled: entry.supported !== true });
        button.classList.add('ea-card');
        list.append(button);
      });
      if (!entries.length) list.append(element('p', 'No Enemy Presets match that filter.', 'ea-note'));
    };
    filter.addEventListener('input', renderList);
    renderList();
    bank.append(filter, element('p', state.mode === ENCOUNTER_AUTHORING_MODES.changingPreset ? 'Choose a replacement preset for the selected authored individual.' : 'Selecting a supported preset enters touch-first placement mode.', 'ea-note'), list);
    body.append(bank);
  }

  renderSelected(body, state) {
    const listSection = this.section('Spawn list');
    const list = element('div', null, 'ea-list');
    state.draft?.spawns.forEach((spawn) => list.append(this.button(`${spawn.spawnId}\n${spawn.presetId}`, () => this.controller.selectSpawn(spawn.spawnId), { wide: true, pressed: spawn.spawnId === state.selectedSpawnId })));
    if (!state.draft?.spawns.length) list.append(element('p', 'No authored individuals have been placed.', 'ea-note'));
    listSection.append(this.button('SELECT AT RETICLE', () => this.controller.selectSpawnAtReticle(), { wide: true, disabled: !state.draft?.spawns.length }), list);
    body.append(listSection);
    const spawn = state.draft?.spawns.find((entry) => entry.spawnId === state.selectedSpawnId);
    if (!spawn) return;
    const inspector = this.section('Selected individual');
    const info = element('dl', null, 'ea-info');
    [['Spawn ID', spawn.spawnId], ['Preset', spawn.presetId], ['Position', spawn.transform.position.map((value) => value.toFixed(2)).join(', ')], ['Yaw', `${(spawn.transform.yaw * 180 / Math.PI).toFixed(1)}°`], ['Home Radius', `${spawn.homeRadius.toFixed(1)} m`], ['Gold', spawn.rewardOverride ? `Fixed Override: ${spawn.rewardOverride.gold}` : 'Preset Default']].forEach(([key, value]) => info.append(element('dt', key), element('dd', value)));
    const operations = this.grid();
    operations.append(
      this.button('MOVE', () => this.controller.beginMove()),
      this.button('ROTATE LEFT', () => this.controller.rotateSelected(-ROTATE_STEP)),
      this.button('ROTATE RIGHT', () => this.controller.rotateSelected(ROTATE_STEP)),
      this.button('DUPLICATE', () => this.controller.duplicateSelected()),
      this.button('CHANGE PRESET', () => this.controller.beginChangePreset(), { wide: true }),
      this.button(state.deleteConfirmationSpawnId === spawn.spawnId && this.controller.now() <= state.deleteConfirmationExpiresAt ? 'CONFIRM DELETE' : 'DELETE', () => this.controller.requestDeleteSelected(), { danger: true, wide: true }),
    );
    inspector.append(info, operations);

    const radiusLabel = element('label', null, 'ea-label');
    radiusLabel.append(element('span', 'HOME RADIUS (meters)'));
    const radiusInput = element('input', null, 'ea-input'); radiusInput.type = 'number'; radiusInput.min = '0.1'; radiusInput.step = '0.5'; radiusInput.value = String(spawn.homeRadius); radiusLabel.append(radiusInput);
    const radiusActions = this.grid();
    radiusActions.append(this.button('- 1 m', () => this.controller.setSelectedHomeRadius(Math.max(0.1, spawn.homeRadius - 1))), this.button('+ 1 m', () => this.controller.setSelectedHomeRadius(spawn.homeRadius + 1)), this.button('APPLY RADIUS', () => this.controller.setSelectedHomeRadius(radiusInput.value), { wide: true }));
    inspector.append(element('div', null, 'ea-separator'), radiusLabel, radiusActions);

    const goldLabel = element('label', null, 'ea-label'); goldLabel.append(element('span', 'FIXED GOLD OVERRIDE'));
    const goldInput = element('input', null, 'ea-input'); goldInput.type = 'number'; goldInput.min = '1'; goldInput.step = '1'; goldInput.value = String(spawn.rewardOverride?.gold ?? 1); goldLabel.append(goldInput);
    const goldActions = this.grid();
    goldActions.append(this.button('SET FIXED OVERRIDE', () => this.controller.setSelectedGoldOverride(goldInput.value), { wide: true }), this.button('REMOVE OVERRIDE', () => this.controller.removeSelectedGoldOverride(), { wide: true, disabled: !spawn.rewardOverride }));
    inspector.append(element('div', null, 'ea-separator'), goldLabel, goldActions);
    body.append(inspector);
  }

  renderSave(body, state) {
    const actions = this.section('Canonical encounter');
    const summary = element('dl', null, 'ea-info');
    [['Encounter ID', state.draft.encounterId], ['Location', state.draft.locationId], ['Spawn Count', state.draft.spawns.length], ['Authority', state.dirty ? 'LOCAL DRAFT · UNSAVED CHANGES' : 'SESSION PRODUCTION BASELINE'], ['Last project path', state.lastSavedPath ?? 'Not saved this session']].forEach(([key, value]) => summary.append(element('dt', key), element('dd', String(value))));
    const grid = this.grid();
    grid.append(
      this.button(this.jsonVisible ? 'HIDE JSON' : 'VIEW JSON', () => { this.jsonVisible = !this.jsonVisible; this.render(this.controller.getState()); }),
      this.button('COPY JSON', () => this.copyJson()),
      this.button('EXPORT JSON', () => this.exportJson()),
      this.button('TEST ENCOUNTER', () => this.controller.testEncounter()),
      this.button('SAVE TO PROJECT', () => this.controller.saveToProject(), { wide: true, disabled: state.busy || !state.bridgeAvailable }),
    );
    actions.append(summary, grid, element('p', state.bridgeAvailable ? 'SAVE TO PROJECT posts only canonical JSON to the same-origin development bridge.' : 'Bridge unavailable. EXPORT JSON, then drag the file onto IMPORT_ENCOUNTER.cmd.', 'ea-note'));
    if (this.jsonVisible) {
      this.readout = element('pre', this.controller.getCanonicalJson(), 'ea-readout');
      this.readout.tabIndex = 0;
      actions.append(this.readout);
    }
    body.append(actions);
  }

  async copyJson() {
    const value = this.controller.getCanonicalJson();
    try { await navigator.clipboard.writeText(value); this.transientStatus = 'Canonical Encounter JSON copied.'; }
    catch {
      this.jsonVisible = true;
      this.render(this.controller.getState());
      this.readout?.focus?.();
      const selection = window.getSelection?.();
      const range = document.createRange?.();
      if (selection && range && this.readout) { range.selectNodeContents(this.readout); selection.removeAllRanges(); selection.addRange(range); }
      this.transientStatus = 'Clipboard unavailable. The selectable JSON readout is focused for manual copy.';
    }
    this.render(this.controller.getState());
  }

  exportJson() {
    const draft = this.controller.getState().draft;
    const blob = new Blob([this.controller.getCanonicalJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = element('a'); anchor.href = url; anchor.download = `${draft.encounterId}.json`; anchor.style.display = 'none';
    document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.transientStatus = `Exported ${draft.encounterId}.json.`;
    this.render(this.controller.getState());
  }

  renderModebar(state) {
    const active = state.open && [ENCOUNTER_AUTHORING_MODES.placing, ENCOUNTER_AUTHORING_MODES.moving, ENCOUNTER_AUTHORING_MODES.testing].includes(state.mode);
    this.modebar.hidden = !active;
    this.modebar.replaceChildren();
    if (!active) return;
    if (state.mode === ENCOUNTER_AUTHORING_MODES.testing) {
      this.modebar.append(element('p', `TESTING: ${state.draft?.displayName ?? state.testEncounterId}`, 'ea-mode-title'));
      const grid = this.grid(); grid.append(this.button('RESET TEST', () => this.controller.resetTest()), this.button('RETURN TO AUTHORING', () => this.controller.returnToAuthoring())); this.modebar.append(grid); return;
    }
    const valid = state.placementTarget?.valid === true;
    this.modebar.append(element('p', `${state.mode === ENCOUNTER_AUTHORING_MODES.moving ? 'MOVE' : 'PLACE'} · ${valid ? 'VALID GROUND' : 'NO VALID PLACEMENT'}`, 'ea-mode-title'));
    const grid = this.grid();
    grid.append(
      this.button('ROTATE -15°', () => this.controller.rotatePlacement(-ROTATE_STEP)),
      this.button('ROTATE +15°', () => this.controller.rotatePlacement(ROTATE_STEP)),
      this.button(state.mode === ENCOUNTER_AUTHORING_MODES.moving ? 'CONFIRM MOVE' : 'PLACE', () => state.mode === ENCOUNTER_AUTHORING_MODES.moving ? this.controller.confirmMove() : this.controller.commitPlacement(), { disabled: !valid }),
      this.button(state.mode === ENCOUNTER_AUTHORING_MODES.moving ? 'CANCEL MOVE' : 'CANCEL', () => state.mode === ENCOUNTER_AUTHORING_MODES.moving ? this.controller.cancelMove() : this.controller.cancelPlacement(), { danger: true }),
    );
    this.modebar.append(grid);
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.style?.remove(); this.shell?.remove(); this.restore?.remove(); this.modebar?.remove();
  }
}
