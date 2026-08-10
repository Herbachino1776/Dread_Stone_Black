import { CREATURE_LAB_HEIGHT_RANGE, CREATURE_LAB_WEAPON_SCALE_RANGE } from './CreatureLabCalibration.js';

export const CREATURE_LAB_TOUCH_TARGET_PX = 48;

export function getCreatureLabPrimaryActions(controller) {
  return [
    { id: 'respawn', label: 'Respawn', run: () => controller.respawn() },
    { id: 'reset_damage', label: 'Reset Damage', run: () => controller.resetDamage() },
  ];
}

export function getCreatureLabDefinitionActions(controller, state) {
  return state.definitions.map((definition) => ({
    id: `definition:${definition.definitionId}`,
    label: definition.supported ? definition.displayName : `${definition.displayName} — Unsupported`,
    definition,
    run: () => controller.selectDefinition(definition.definitionId),
  }));
}

export function getCreatureLabPresetActions(controller, state) {
  return (state.presets ?? []).map((preset) => ({
    id: `preset:${preset.presetId}`,
    label: preset.supported ? preset.displayName : `${preset.displayName} — Unsupported`,
    preset,
    run: () => controller.selectPreset(preset.presetId),
  }));
}

// Temporary helper name retained for external lab tooling; it delegates to definitions.
export const getCreatureLabPackActions = getCreatureLabDefinitionActions;

export function getCreatureLabAnimationPanelActions(controller, state) {
  return state.animationActions.map((action) => ({
    ...action,
    run: () => controller.playAnimation(action.id),
  }));
}

export function getCreatureLabOffensiveCombatActions(controller, state = {}) {
  const combat = state.offensiveCombat ?? {};
  const selectedWeapon = state.weapons?.find?.((weapon) => weapon.weaponId === state.selectedWeaponId);
  return [
    {
      id: 'offense:equip',
      label: combat.equipped ? `Unequip ${selectedWeapon?.displayName ?? 'Weapon'}` : `Equip ${selectedWeapon?.displayName ?? 'Weapon'}`,
      run: () => combat.equipped ? controller.unequipArmament() : controller.equipArmament(),
      pressed: combat.equipped === true,
      wide: true,
    },
    ...(combat.compatibleActions ?? []).map((action) => ({
      id: `offense:action:${action.combatActionId}`,
      label: action.combatActionId.replaceAll('_', ' '),
      run: () => controller.selectOffensiveAction(action.combatActionId),
      pressed: combat.combatActionId === action.combatActionId,
      disabled: !combat.equipped,
      wide: true,
    })),
    { id: 'offense:trigger', label: 'Trigger Attack', run: () => controller.triggerAttack(), disabled: !combat.equipped },
    { id: 'offense:reset_player', label: 'Reset Player', run: () => controller.resetPlayer() },
    {
      id: 'offense:geometry',
      label: combat.showAttackGeometry ? 'Hide Attack Capsule' : 'Show Attack Capsule',
      run: () => controller.toggleAttackGeometry(),
      pressed: combat.showAttackGeometry === true,
      wide: true,
      disabled: !combat.equipped,
    },
  ];
}

export function getCreatureLabWeaponActions(controller, state = {}) {
  return (state.weapons ?? []).map((weapon) => ({
    id: `weapon:${weapon.weaponId}`,
    label: weapon.displayName,
    weapon,
    pressed: state.selectedWeaponId === weapon.weaponId,
    run: () => controller.selectWeapon(weapon.weaponId),
  }));
}

export function getCreatureLabDamagePanelActions(controller, state = {}) {
  return [
    { id: 'site:previous', label: 'Previous Site', run: () => controller.selectRelativeSite(-1) },
    { id: 'site:next', label: 'Next Site', run: () => controller.selectRelativeSite(1) },
    { id: 'sites:show', label: state.showSites ? 'Hide Sites' : 'Show Sites', run: () => controller.toggleSiteMarkers(), pressed: state.showSites === true },
    { id: 'sites:radius', label: state.showSelectedRadius ? 'Hide Selected Radius' : 'Show Selected Radius', run: () => controller.toggleSelectedRadius(), pressed: state.showSelectedRadius === true },
    { id: 'damage:light', label: 'Light', run: () => controller.setSelectedSiteStage('LIGHT') },
    { id: 'damage:medium', label: 'Medium', run: () => controller.setSelectedSiteStage('MEDIUM') },
    { id: 'damage:heavy', label: 'Heavy', run: () => controller.setSelectedSiteStage('HEAVY') },
    { id: 'damage:next', label: 'Next Stage', run: () => controller.advanceSelectedSite() },
    { id: 'damage:reset_site', label: 'Reset Site', run: () => controller.resetSelectedSite() },
    { id: 'damage:center', label: 'Center Hit', run: () => controller.strikeSelectedSite('center') },
    { id: 'damage:edge', label: 'Edge Hit', run: () => controller.strikeSelectedSite('edge') },
    { id: 'damage:outside', label: 'Outside Hit', run: () => controller.strikeSelectedSite('outside'), wide: true },
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
      .creature-lab-region{margin:10px 0 5px;color:#a99c8b;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
      .creature-lab-site-row{display:block;width:100%;text-align:left}
      .creature-lab-site-name{display:block;color:inherit;font-size:14px}
      .creature-lab-site-meta{display:block;margin-top:4px;color:#b9ad9c;font:11px/1.35 ui-monospace,monospace;white-space:pre-line;overflow-wrap:anywhere}
      .creature-lab-info{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;margin:0;font-size:12px}
      .creature-lab-info dt{color:#a99c8b;overflow-wrap:anywhere}.creature-lab-info dd{margin:0;text-align:right;overflow-wrap:anywhere}
      .creature-lab-range{display:block;margin:9px 0;padding:8px;border:1px solid #3f382f;border-radius:6px;background:#100e0b}
      .creature-lab-range-title{display:flex;justify-content:space-between;gap:10px;color:#d8c8b4;font-size:13px}
      .creature-lab-range output{color:#e6bd85;font:12px/1.2 ui-monospace,monospace}
      .creature-lab-range input{width:100%;min-height:34px;margin:5px 0 0;accent-color:#c99c65;touch-action:pan-x}
      .creature-lab-note{margin:8px 0 0;color:#bdb1a3;font-size:12px;overflow-wrap:anywhere}
      .creature-lab-status{margin:9px 0 0;padding:8px;border-radius:5px;background:#090807;color:#b9d7ce;font:12px/1.35 ui-monospace,monospace;overflow-wrap:anywhere}
      .creature-lab-draft{margin:9px 0;padding:8px;border:1px solid #b47b41;border-radius:5px;background:#2a180d;color:#ffd39b;font:700 12px/1.35 ui-monospace,monospace;letter-spacing:.08em;text-align:center}
      .creature-lab-defaults{margin:9px 0;padding:8px;border:1px solid #537368;border-radius:5px;background:#0b1713;color:#b9d7ce;font:700 12px/1.35 ui-monospace,monospace;letter-spacing:.08em;text-align:center}
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

  createRangeControl({ label, value, min, max, step, field, suffix = '' }) {
    const wrapper = element('label', null, 'creature-lab-range');
    const title = element('span', null, 'creature-lab-range-title');
    const output = element('output', `${Number(value).toFixed(step < 0.01 ? 3 : 2)}${suffix}`);
    title.append(element('span', label), output);
    const input = element('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute('aria-label', label);
    input.addEventListener('input', () => {
      const numeric = Number(input.value);
      output.textContent = `${numeric.toFixed(step < 0.01 ? 3 : 2)}${suffix}`;
      this.controller.setWeaponCalibrationField(field, numeric);
      if (this.offensiveReadout) this.offensiveReadout.textContent = this.formatOffensiveCombat(this.controller.getViewState().offensiveCombat);
    });
    input.addEventListener('change', () => this.controller.notify());
    wrapper.append(title, input);
    return wrapper;
  }

  createHeightRangeControl(state) {
    const wrapper = element('label', null, 'creature-lab-range');
    const title = element('span', null, 'creature-lab-range-title');
    const output = element('output', `${Number(state.resultingCreatureHeight).toFixed(2)} m`);
    title.append(element('span', 'Creature Height / Creature Scale'), output);
    const input = element('input');
    input.type = 'range';
    input.min = String(CREATURE_LAB_HEIGHT_RANGE.min);
    input.max = String(CREATURE_LAB_HEIGHT_RANGE.max);
    input.step = String(CREATURE_LAB_HEIGHT_RANGE.step);
    input.value = String(state.resultingCreatureHeight);
    input.setAttribute('aria-label', 'Creature Height / Creature Scale');
    input.addEventListener('change', async () => {
      input.disabled = true;
      await this.controller.setCreatureHeight(Number(input.value));
      this.render();
    });
    wrapper.append(title, input);
    return wrapper;
  }

  createSiteButton(site, selected) {
    const bindingLabel = site.bindingMode === 'SKINNED_SURFACE'
      ? 'SKINNED'
      : site.bindingMode === 'STATIC_ACTOR_LOCAL_FALLBACK' ? 'STATIC FALLBACK' : 'UNTARGETABLE';
    const radius = Number.isFinite(site.radius) ? site.radius.toFixed(3) : 'n/a';
    const button = this.createButton('', () => this.controller.selectSite(site.siteId), { pressed: selected, wide: true });
    button.classList.add('creature-lab-site-row');
    button.replaceChildren(
      element('span', `${site.displayName} — ${site.authority}`, 'creature-lab-site-name'),
      element('span', `${site.siteId}\nr=${radius} m · stage=${site.currentStage ?? 'INTACT'} · hits=${site.acceptedHitCount ?? 0} · ${bindingLabel}`, 'creature-lab-site-meta'),
    );
    return button;
  }

  render() {
    if (!this.panel) return;
    const scrollTop = this.panel.scrollTop;
    const state = this.controller.getViewState();
    this.panel.replaceChildren();
    const header = element('header', null, 'creature-lab-header');
    header.append(element('h2', 'CREATURE LAB', 'creature-lab-title'));
    header.append(element('p', `Current ${state.selectedPresetId ? 'preset' : 'definition'}: ${state.selectedDisplayName}${state.loading ? ' — loading…' : ''}`, 'creature-lab-current'));
    const top = this.createGrid();
    top.append(this.createButton('Close', () => this.close()));
    getCreatureLabPrimaryActions(this.controller).forEach((action) => top.append(this.createButton(action.label, action.run, { disabled: state.loading })));
    header.append(top);
    this.panel.append(header);

    const presets = this.createSection('Enemy Preset Selector');
    const presetGrid = this.createGrid();
    getCreatureLabPresetActions(this.controller, state).forEach(({ label, preset, run }) => {
      presetGrid.append(this.createButton(label, run, {
        pressed: state.selectedPresetId === preset.presetId,
        disabled: state.loading || !preset.supported,
        title: preset.supported ? `Resolves Creature Definition ${preset.creatureDefinitionId}` : `REGISTERED BUT CURRENT RUNTIME UNSUPPORTED: ${preset.reason}`,
      }));
      if (!preset.supported) presets.append(element('p', `${preset.displayName}: REGISTERED BUT CURRENT RUNTIME UNSUPPORTED — ${preset.reason}`, 'creature-lab-note'));
    });
    presets.prepend(presetGrid);
    presets.append(element('p', 'A preset is reusable production tuning. Select a Creature Definition below for definition-only or ad-hoc Lab work.', 'creature-lab-note'));
    this.panel.append(presets);

    const definitions = this.createSection('Definition Selector');
    const definitionGrid = this.createGrid();
    getCreatureLabDefinitionActions(this.controller, state).forEach(({ label, definition, run }) => {
      definitionGrid.append(this.createButton(label, run, {
        pressed: !state.selectedPresetId && state.selectedDefinitionId === definition.definitionId,
        disabled: state.loading || !definition.supported,
        title: definition.supported ? `Resolves Creature Pack ${definition.creaturePackId}` : `REGISTERED BUT CURRENT RUNTIME UNSUPPORTED: ${definition.reason}`,
      }));
      if (!definition.supported) definitions.append(element('p', `${definition.displayName}: REGISTERED BUT CURRENT RUNTIME UNSUPPORTED — ${definition.reason}`, 'creature-lab-note'));
    });
    definitions.prepend(definitionGrid);
    this.panel.append(definitions);

    if (state.pack) this.panel.append(this.renderPackInfo(state));
    this.panel.append(this.renderCreatureCalibration(state));
    this.panel.append(this.renderWeaponCalibration(state));
    this.panel.append(this.renderAnimations(state));
    this.panel.append(this.renderOffensiveCombat(state));
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
    const definition = state.definition;
    const section = this.createSection('Definition + Pack Info');
    const info = element('dl', null, 'creature-lab-info');
    const rows = [
      ['Definition ID', definition.definitionId],
      ['Target height', `${definition.presentation.targetHeight.toFixed(2)} m`],
      ['Pack ID', pack.packId],
      ['Technical body', pack.displayName],
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

  renderCreatureCalibration(state) {
    const section = this.createSection('Creature Calibration');
    if (!Number.isFinite(state.resultingCreatureHeight)) {
      section.append(element('p', 'Creature presentation is not ready.', 'creature-lab-note'));
      return section;
    }
    section.append(this.createHeightRangeControl(state));
    const grid = this.createGrid();
    const step = CREATURE_LAB_HEIGHT_RANGE.step;
    const clamp = (value) => Math.max(CREATURE_LAB_HEIGHT_RANGE.min, Math.min(CREATURE_LAB_HEIGHT_RANGE.max, value));
    grid.append(
      this.createButton(`− ${step.toFixed(2)} m`, () => this.controller.setCreatureHeight(clamp(state.resultingCreatureHeight - step))),
      this.createButton(`+ ${step.toFixed(2)} m`, () => this.controller.setCreatureHeight(clamp(state.resultingCreatureHeight + step))),
      this.createButton('Reset Creature Height', () => this.controller.resetCreatureHeight(), { wide: true }),
    );
    section.append(grid);
    section.append(element('p', `${state.selectedPresetId ? 'Production preset' : 'Creature Definition'} height ${Number(state.productionCreatureHeight).toFixed(2)} m · resulting height ${Number(state.resultingCreatureHeight).toFixed(2)} m. This uniform override uses the production presentation path and never mutates source data.`, 'creature-lab-note'));
    return section;
  }

  renderWeaponCalibration(state) {
    const section = this.createSection('Weapon Calibration');
    if (state.selectedPresetId) {
      section.append(element('p', 'PRODUCTION PRESET DEFAULTS', 'creature-lab-defaults'));
      section.append(element('pre', JSON.stringify({
        targetHeight: state.productionCreatureHeight,
        weaponOverride: state.productionWeaponCalibrationReadout && {
          assetScale: state.productionWeaponCalibrationReadout.assetScale,
          gripTransform: state.productionWeaponCalibrationReadout.gripTransform,
          attackCapsule: state.productionWeaponCalibrationReadout.attackCapsule,
        },
      }, null, 2), 'creature-lab-diagnostics'));
      section.append(element(
        'p',
        state.hasUnsavedLabDraft ? 'UNSAVED LAB DRAFT' : 'LOCAL LAB DRAFT — MATCHES PRODUCTION',
        state.hasUnsavedLabDraft ? 'creature-lab-draft' : 'creature-lab-defaults',
      ));
    } else {
      section.append(element('p', 'LOCAL DEFINITION-SCOPED LAB DRAFT', 'creature-lab-defaults'));
    }
    const selector = this.createGrid();
    getCreatureLabWeaponActions(this.controller, state).forEach((action) => selector.append(this.createButton(action.label, action.run, {
      pressed: action.pressed,
      disabled: state.loading,
    })));
    section.append(selector);

    const equipAction = getCreatureLabOffensiveCombatActions(this.controller, state).find((action) => action.id === 'offense:equip');
    if (equipAction) section.append(this.createButton(equipAction.label, equipAction.run, {
      pressed: equipAction.pressed,
      disabled: state.loading || state.offensiveCombat?.capabilityAvailable !== true,
      wide: true,
    }));

    const calibration = state.weaponCalibration;
    if (!calibration) {
      section.append(element('p', 'Select a registered real weapon to calibrate it.', 'creature-lab-note'));
      return section;
    }
    section.append(element('p', 'Weapon Transform', 'creature-lab-region'));
    section.append(this.createRangeControl({
      label: 'Scale', value: calibration.assetScale,
      min: CREATURE_LAB_WEAPON_SCALE_RANGE.min, max: CREATURE_LAB_WEAPON_SCALE_RANGE.max, step: CREATURE_LAB_WEAPON_SCALE_RANGE.step,
      field: 'assetScale',
    }));
    ['X', 'Y', 'Z'].forEach((axis, index) => section.append(this.createRangeControl({
      label: `Grip ${axis}`, value: calibration.gripPosition[index], min: -1.5, max: 1.5, step: 0.005,
      field: `gripPosition.${index}`, suffix: ' m',
    })));
    ['Pitch', 'Yaw', 'Roll'].forEach((label, index) => section.append(this.createRangeControl({
      label, value: calibration.gripEulerDegrees[index], min: -180, max: 180, step: 1,
      field: `gripEulerDegrees.${index}`, suffix: '°',
    })));

    section.append(element('p', 'Attack Capsule', 'creature-lab-region'));
    ['Start', 'End'].forEach((endpointLabel) => {
      const endpoint = endpointLabel.toLowerCase();
      ['X', 'Y', 'Z'].forEach((axis, index) => section.append(this.createRangeControl({
        label: `${endpointLabel} ${axis}`, value: calibration.attackCapsule[endpoint][index], min: -3, max: 3, step: 0.01,
        field: `attackCapsule.${endpoint}.${index}`, suffix: ' m',
      })));
    });
    section.append(this.createRangeControl({
      label: 'Radius', value: calibration.attackCapsule.radius, min: 0.005, max: 1, step: 0.005,
      field: 'attackCapsule.radius', suffix: ' m',
    }));

    const controls = this.createGrid();
    if (state.selectedPresetId) {
      controls.append(
        this.createButton('Reset to Preset Defaults', () => this.controller.resetToPresetDefaults(), { wide: true }),
        this.createButton('COPY ENEMY PRESET JSON', () => this.copyEnemyPresetJson(), { wide: true }),
      );
    } else {
      controls.append(
        this.createButton('Reset Weapon Calibration', () => this.controller.resetWeaponCalibration(), { wide: true }),
        this.createButton('Copy Calibration JSON', () => this.copyCalibrationJson(), { wide: true }),
      );
    }
    section.append(controls);
    const readoutText = state.selectedPresetId ? state.enemyPresetJson : JSON.stringify(state.weaponCalibrationReadout, null, 2);
    this.calibrationReadout = element('pre', readoutText, 'creature-lab-diagnostics');
    this.calibrationReadout.setAttribute('aria-label', state.selectedPresetId ? 'Enemy Preset JSON' : 'Weapon calibration JSON');
    this.calibrationReadout.tabIndex = 0;
    this.enemyPresetReadout = state.selectedPresetId ? this.calibrationReadout : null;
    section.append(this.calibrationReadout);
    if (state.offensiveCombat?.capabilityAvailable !== true) section.append(element('p', `This pack cannot equip weapons: ${state.offensiveCombat?.capabilityReason ?? 'Forge socket/offensive Action capability unavailable'}. Calibration values remain isolated lab data.`, 'creature-lab-note'));
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

  formatOffensiveCombat(combat = {}) {
    const point = Array.isArray(combat.lastImpactPoint) ? combat.lastImpactPoint.map((value) => Number(value).toFixed(2)).join(', ') : 'none';
    const direction = Array.isArray(combat.lastImpactDirection) ? combat.lastImpactDirection.map((value) => Number(value).toFixed(2)).join(', ') : 'none';
    const capsule = combat.currentWorldCapsule;
    const capsuleText = capsule ? `${capsule.start?.join?.(', ') ?? '?'} -> ${capsule.end?.join?.(', ') ?? '?'} r=${capsule.radius}` : 'none';
    const phases = combat.phases;
    const grip = combat.gripTransform;
    const gripText = grip ? `p=${grip.position?.join?.(', ') ?? '?'} q=${grip.quaternion?.join?.(', ') ?? '?'}` : 'none';
    const world = combat.weaponWorldTransform;
    const worldText = world ? `p=${world.position?.join?.(', ') ?? '?'} q=${world.quaternion?.join?.(', ') ?? '?'} s=${world.scale?.join?.(', ') ?? '?'}` : 'none';
    const localCapsule = combat.localAttackCapsule;
    const localCapsuleText = localCapsule ? `${localCapsule.start?.join?.(', ') ?? '?'} -> ${localCapsule.end?.join?.(', ') ?? '?'} r=${localCapsule.radius}` : 'none';
    const timing = phases
      ? `W ${phases.windup.startSeconds}-${phases.windup.endSeconds} | A ${phases.active.startSeconds}-${phases.active.endSeconds} | R ${phases.recovery.startSeconds}-${phases.recovery.endSeconds}`
      : 'unavailable';
    return [
      `CAPABILITY ${combat.capabilityAvailable ? 'AVAILABLE' : `UNAVAILABLE (${combat.capabilityReason ?? 'unknown'})`} | ${combat.equipped ? 'EQUIPPED' : 'UNEQUIPPED'}`,
      `WEAPON ${combat.weaponId ?? 'none'} | SOCKET ${combat.socketId ?? 'none'} -> ${combat.parentRuntimeBone ?? 'none'}`,
      `GLB ${combat.assetPath ?? 'none'} | ASSET SCALE ${combat.assetScale ?? 'none'}`,
      `GRIP ${gripText}`,
      `WEAPON WORLD ${worldText}`,
      `ACTION ${combat.actionName ?? 'none'} | COMBAT ID ${combat.combatActionId ?? 'none'}`,
      `PHASE ${combat.attackPhase ?? 'COMPLETE'} | CLIP ${Number(combat.clipTimeSeconds ?? 0).toFixed(3)}s | ${String(combat.outcome ?? 'idle').toUpperCase()}`,
      `TIMING ${timing}`,
      `ATTACK ${combat.attackIdentity ?? combat.attackId ?? 'none'} | HITS ${combat.acceptedPlayerHitCount ?? 0} | PLAYER HP ${combat.currentPlayerHealth ?? 'n/a'}${combat.playerDead ? ' | DEAD' : ''}`,
      `LOCAL CAPSULE ${localCapsuleText}`,
      `WORLD CAPSULE ${capsuleText}`,
      `IMPACT ${point} | DIR ${direction}`,
      `REJECTION ${combat.lastRejectionReason ?? 'none'}`,
    ].join('\n');
  }

  renderOffensiveCombat(state) {
    const section = this.createSection('Offensive Combat Proof');
    const combat = state.offensiveCombat ?? { enabled: false };
    const grid = this.createGrid();
    getCreatureLabOffensiveCombatActions(this.controller, state).filter((action) => action.id !== 'offense:equip').forEach((action) => grid.append(this.createButton(action.label, action.run, {
      disabled: state.loading || combat.capabilityAvailable !== true || action.disabled === true,
      pressed: action.pressed === true,
      wide: action.wide === true,
    })));
    section.append(grid);
    this.offensiveReadout = element('pre', this.formatOffensiveCombat(combat), 'creature-lab-status');
    this.offensiveReadout.setAttribute('aria-label', 'Creature Lab offensive combat diagnostics');
    section.append(this.offensiveReadout);
    section.append(element('p', 'Forge-authored clip time gates a weapon capsule attached to the animated hand. Only ACTIVE physical intersection can damage the player.', 'creature-lab-note'));
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
    let activeRegion = null;
    state.sites.forEach((site) => {
      const region = site.regionId ?? site.structuralGroup ?? 'unassigned';
      if (region !== activeRegion) {
        activeRegion = region;
        section.append(element('p', region.replaceAll('_', ' '), 'creature-lab-region'));
      }
      section.append(this.createSiteButton(site, state.selectedSiteId === site.siteId));
    });
    section.append(element('p', `Selected site: ${state.selectedSiteId ?? 'None'}`, 'creature-lab-note'));
    const controls = this.createGrid();
    getCreatureLabDamagePanelActions(this.controller, state).forEach((action) => controls.append(this.createButton(action.label, action.run, {
      disabled: !state.selectedSiteId,
      wide: action.wide === true,
      pressed: action.pressed === true,
    })));
    section.append(controls);
    const physical = state.lastPhysicalTargetingDecision;
    section.append(element('p', physical?.selectedSiteId
      ? `LAST PHYSICAL SITE: ${physical.selectedSiteId} · stage=${physical.stage ?? 'INTACT'} · region=${physical.impactRegion ?? 'n/a'} · distance=${physical.selectedDistance?.toFixed?.(3) ?? 'n/a'} · radius=${physical.selectedRadius?.toFixed?.(3) ?? 'n/a'} · alignment=${physical.directionAlignment?.toFixed?.(2) ?? 'n/a'}`
      : 'LAST PHYSICAL SITE: none', 'creature-lab-note'));
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
    const probe = operation.result?.probe;
    const actualSiteId = operation.result?.actualSiteId;
    const probeResult = probe ? ` · ${probe.toUpperCase()} actual=${actualSiteId ?? 'none'} expected=${operation.result?.expectedSiteId ?? 'none'} ${operation.result?.probePassed ? 'PASS' : 'FAIL'}` : '';
    return `${operation.operation}: ${operation.ok ? 'OK' : 'NOT APPLIED'}${reason ? ` — ${reason}` : ''}${probeResult}`;
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
    if (this.offensiveReadout) this.offensiveReadout.textContent = this.formatOffensiveCombat(this.controller.getViewState().offensiveCombat);
    if (this.status) this.status.textContent = this.transientStatus ?? this.formatLastOperation(this.controller.lastOperation);
  }

  async copyEnemyPresetJson() {
    const text = this.controller.getEnemyPresetJson();
    if (!text) {
      this.transientStatus = 'Select an Enemy Preset before copying production JSON.';
      if (this.status) this.status.textContent = this.transientStatus;
      return;
    }
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      this.transientStatus = 'Enemy Preset JSON copied.';
    } catch {
      if (this.enemyPresetReadout) {
        this.enemyPresetReadout.textContent = text;
        this.enemyPresetReadout.focus?.();
        const selection = globalThis.getSelection?.();
        const range = document.createRange?.();
        if (selection && range) { range.selectNodeContents(this.enemyPresetReadout); selection.removeAllRanges(); selection.addRange(range); }
      }
      this.transientStatus = 'Clipboard permission failed. Enemy Preset JSON is visible and selected for manual copy.';
    }
    if (this.status) this.status.textContent = this.transientStatus;
  }

  async copyCalibrationJson() {
    const text = JSON.stringify(this.controller.getWeaponCalibrationReadout(), null, 2);
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      this.transientStatus = 'Weapon calibration JSON copied.';
    } catch {
      if (this.calibrationReadout) {
        this.calibrationReadout.textContent = text;
        this.calibrationReadout.focus?.();
        const selection = globalThis.getSelection?.();
        const range = document.createRange?.();
        if (selection && range) { range.selectNodeContents(this.calibrationReadout); selection.removeAllRanges(); selection.addRange(range); }
      }
      this.transientStatus = 'Clipboard permission failed. Calibration JSON is visible and selected for manual copy.';
    }
    if (this.status) this.status.textContent = this.transientStatus;
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
