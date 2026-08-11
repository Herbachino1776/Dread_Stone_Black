import { canonicalizeEncounterDefinition, serializeEncounterDefinition } from '../../../contracts/EncounterDefinition.js';
import { EnemyPresetRegistry } from '../../creatures/EnemyPresetRegistry.js';
import { EnemyPresetResolver } from '../../creatures/EnemyPresetResolver.js';
import { EncounterAuthoringDraftStore } from './EncounterAuthoringDraftStore.js';
import {
  changeSpawnPreset,
  cloneEncounterDraft,
  createEncounterDraft,
  deleteSpawn,
  duplicateSpawn,
  encountersEqual,
  moveSpawn,
  normalizeEncounterYaw,
  placeSpawn,
  removeSpawnGoldOverride,
  rotateSpawn,
  setSpawnGoldOverride,
  setSpawnHomeRadius,
} from './EncounterAuthoringOperations.js';
import { EncounterAuthoringPlacementResolver } from './EncounterAuthoringPlacementResolver.js';
import { EncounterAuthoringPreviewRuntime } from './EncounterAuthoringPreviewRuntime.js';

export const ENCOUNTER_AUTHORING_MODES = Object.freeze({
  idle: 'idle',
  placing: 'placing',
  moving: 'moving',
  changingPreset: 'changing-preset',
  testing: 'testing',
});

export const ENCOUNTER_AUTHORING_BRIDGE_PATH = '/__dreadstone/encounter-authoring';

function lootSummary(profile) {
  const gold = profile?.currency?.gold;
  if (!gold) return 'No default gold';
  if (gold.mode === 'FIXED') return `${gold.amount} gold`;
  if (Number.isSafeInteger(gold.minimum) && Number.isSafeInteger(gold.maximum)) return `${gold.minimum}-${gold.maximum} gold`;
  return `${gold.mode ?? 'Configured'} gold`;
}

function publicState(state) {
  return {
    ...state,
    draft: state.draft ? structuredClone(state.draft) : null,
    productionBaseline: state.productionBaseline ? structuredClone(state.productionBaseline) : null,
    productionEncounters: [...state.productionEncounters],
    localDrafts: [...state.localDrafts],
    enemyBank: state.enemyBank.map((entry) => ({ ...entry })),
    recentPresetIds: [...state.recentPresetIds],
    placementTarget: state.placementTarget ? structuredClone(state.placementTarget) : null,
  };
}

export class EncounterAuthoringController {
  constructor({
    sceneSessionHost,
    encounterRuntimeHost,
    playerDamageReceiver = null,
    registry = encounterRuntimeHost?.registry,
    presetRegistry = new EnemyPresetRegistry(),
    enemyPresetResolver = new EnemyPresetResolver({ presetRegistry }),
    draftStore = new EncounterAuthoringDraftStore(),
    placementResolver = new EncounterAuthoringPlacementResolver(),
    previewRuntimeFactory = (options) => new EncounterAuthoringPreviewRuntime(options),
    fetchImplementation = globalThis.fetch?.bind?.(globalThis),
    setTimeoutImplementation = globalThis.setTimeout?.bind?.(globalThis),
    clearTimeoutImplementation = globalThis.clearTimeout?.bind?.(globalThis),
    now = () => Date.now(),
    autosaveDelayMs = 220,
  } = {}) {
    this.sceneSessionHost = sceneSessionHost;
    this.encounterRuntimeHost = encounterRuntimeHost;
    this.playerDamageReceiver = playerDamageReceiver;
    this.registry = registry;
    this.presetRegistry = presetRegistry;
    this.enemyPresetResolver = enemyPresetResolver;
    this.draftStore = draftStore;
    this.placementResolver = placementResolver;
    this.previewRuntimeFactory = previewRuntimeFactory;
    this.fetchImplementation = fetchImplementation;
    this.setTimeoutImplementation = setTimeoutImplementation;
    this.clearTimeoutImplementation = clearTimeoutImplementation;
    this.now = now;
    this.autosaveDelayMs = autosaveDelayMs;
    this.listeners = new Set();
    this.previewRuntime = null;
    this.autosaveTimer = null;
    this.moveOriginalTransform = null;
    this.lastPlacementSignature = '';
    this.disposed = false;
    this.state = {
      open: false,
      minimized: false,
      tab: 'encounter',
      locationId: null,
      productionEncounters: [],
      localDrafts: [],
      enemyBank: [],
      recentPresetIds: [],
      enemyBankLoading: false,
      draft: null,
      productionBaseline: null,
      draftSource: null,
      dirty: false,
      selectedSpawnId: null,
      mode: ENCOUNTER_AUTHORING_MODES.idle,
      placementPresetId: null,
      previewYaw: 0,
      placementTarget: null,
      status: 'Encounter Authoring is closed.',
      busy: false,
      deleteConfirmationSpawnId: null,
      deleteConfirmationExpiresAt: 0,
      resetProductionConfirmationExpiresAt: 0,
      bridgeAvailable: typeof fetchImplementation === 'function',
      lastSavedPath: null,
      testEncounterId: null,
    };
  }

  get isOpen() { return this.state.open; }
  getState() { return publicState(this.state); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit() { const snapshot = this.getState(); this.listeners.forEach((listener) => listener(snapshot)); return snapshot; }

  ensurePreviewRuntime() {
    if (!this.previewRuntime || this.previewRuntime.disposed) {
      this.previewRuntime = this.previewRuntimeFactory({ enemyPresetResolver: this.enemyPresetResolver });
    }
    this.previewRuntime.attachSession({
      scene: this.sceneSessionHost?.scene,
      camera: this.sceneSessionHost?.camera,
      playerProvider: () => this.sceneSessionHost?.player,
    });
    return this.previewRuntime;
  }

  async open() {
    if (this.disposed) throw new Error('Encounter Authoring controller is disposed.');
    if (this.state.open) { this.state.minimized = false; return this.emit(); }
    this.state.open = true;
    this.state.minimized = false;
    this.state.locationId = this.sceneSessionHost?.locationId ?? null;
    await this.encounterRuntimeHost?.setRegisteredActivationSuppressed?.(true);
    this.ensurePreviewRuntime();
    this.refreshEncounterLists();
    await this.loadEnemyBank();
    const last = this.state.locationId ? this.draftStore.loadLast(this.state.locationId) : null;
    if (last) this.loadDraftRecord(last);
    else this.state.status = `AUTHORING ${this.state.locationId ?? 'unknown location'} — choose an Encounter or create a new one.`;
    return this.emit();
  }

  async close() {
    if (!this.state.open) return this.emit();
    this.flushAutosave();
    if (this.state.mode === ENCOUNTER_AUTHORING_MODES.testing && this.state.testEncounterId) {
      this.encounterRuntimeHost?.despawnEncounter?.(this.state.testEncounterId, 'encounter-authoring-close-test');
      this.playerDamageReceiver?.reset?.();
    }
    this.previewRuntime?.dispose?.();
    this.previewRuntime = null;
    this.state.open = false;
    this.state.minimized = false;
    this.state.mode = ENCOUNTER_AUTHORING_MODES.idle;
    this.state.placementTarget = null;
    this.state.placementPresetId = null;
    this.state.testEncounterId = null;
    this.state.status = 'Encounter Authoring closed. Production encounters restored.';
    await this.encounterRuntimeHost?.setRegisteredActivationSuppressed?.(false);
    return this.emit();
  }

  setMinimized(minimized) { this.state.minimized = minimized === true; return this.emit(); }
  setTab(tab) { if (['encounter', 'bank', 'selected', 'save'].includes(tab)) this.state.tab = tab; return this.emit(); }

  refreshEncounterLists() {
    const locationId = this.state.locationId;
    this.state.productionEncounters = locationId ? this.registry?.listByLocation?.(locationId) ?? [] : [];
    this.state.localDrafts = locationId ? this.draftStore.list(locationId).map((record) => ({
      encounterId: record.encounterId,
      displayName: record.encounter.displayName,
      spawnCount: record.encounter.spawns.length,
      savedAt: record.savedAt,
      hasProductionBaseline: this.registry?.hasEncounter?.(record.encounterId) === true,
    })) : [];
  }

  async loadEnemyBank() {
    this.state.enemyBankLoading = true;
    this.state.enemyBank = this.presetRegistry.listPresets().map((preset) => ({
      presetId: preset.presetId,
      displayName: preset.displayName,
      creatureDefinitionId: preset.creatureDefinitionId,
      supported: null,
      loadoutSummary: preset.armament?.loadoutId ?? 'No loadout',
      lootSummary: preset.rewards?.lootProfileId ?? 'No default loot',
      failureReason: null,
    }));
    this.emit();
    for (const entry of this.state.enemyBank) {
      try {
        const resolved = await this.enemyPresetResolver.resolve(entry.presetId);
        entry.supported = true;
        entry.creatureDefinitionId = resolved.definition.definitionId;
        entry.loadoutSummary = `${resolved.loadout.loadoutId} / ${resolved.weapon.displayName ?? resolved.weapon.weaponId}`;
        entry.lootSummary = lootSummary(resolved.lootProfile);
      } catch (error) {
        entry.supported = false;
        entry.failureReason = error.message;
      }
    }
    this.state.enemyBankLoading = false;
    return this.emit();
  }

  openEncounter(encounterId) {
    const baseline = this.registry.getEncounter(encounterId);
    if (baseline.locationId !== this.state.locationId) throw new Error(`Encounter "${encounterId}" does not belong to ${this.state.locationId}.`);
    const local = this.draftStore.load(this.state.locationId, encounterId);
    if (local) this.loadDraftRecord(local, baseline);
    else this.setActiveDraft(cloneEncounterDraft(baseline), { baseline, source: 'production', selectedSpawnId: null });
    this.state.status = local ? 'LOCAL DRAFT restored over the immutable PRODUCTION BASELINE.' : 'PRODUCTION BASELINE cloned into a local editable draft.';
    return this.emit();
  }

  openLocalDraft(encounterId) {
    const record = this.draftStore.load(this.state.locationId, encounterId);
    if (!record) throw new Error(`No valid LOCAL DRAFT exists for ${encounterId}.`);
    this.loadDraftRecord(record);
    this.state.status = 'LOCAL DRAFT restored. It is not production content until SAVE TO PROJECT succeeds.';
    return this.emit();
  }

  createNewEncounter({ displayName, encounterId } = {}) {
    if (this.registry?.hasEncounter?.(encounterId)) throw new Error(`Encounter ID "${encounterId}" already belongs to production content. Open it instead.`);
    const draft = createEncounterDraft({ displayName, encounterId, locationId: this.state.locationId });
    this.setActiveDraft(draft, { baseline: null, source: 'new', selectedSpawnId: null });
    this.state.status = 'New LOCAL DRAFT created. Choose an Enemy Preset to begin placement.';
    this.scheduleAutosave();
    return this.emit();
  }

  loadDraftRecord(record, baseline = null) {
    const production = baseline ?? (this.registry?.hasEncounter?.(record.encounterId) ? this.registry.getEncounter(record.encounterId) : null);
    this.setActiveDraft(record.encounter, {
      baseline: production,
      source: 'local',
      selectedSpawnId: record.editor?.selectedSpawnId,
      tab: record.editor?.tab,
    });
  }

  setActiveDraft(draft, { baseline = null, source = 'local', selectedSpawnId = null, tab = null } = {}) {
    this.cancelPlacement(false);
    this.state.draft = cloneEncounterDraft(draft);
    this.state.productionBaseline = baseline ? cloneEncounterDraft(baseline) : null;
    this.state.draftSource = source;
    this.state.selectedSpawnId = this.state.draft.spawns.some((spawn) => spawn.spawnId === selectedSpawnId) ? selectedSpawnId : null;
    if (tab) this.state.tab = tab;
    this.recomputeDirty();
    this.previewRuntime?.setDraft?.(this.state.draft, { selectedSpawnId: this.state.selectedSpawnId });
    this.refreshEncounterLists();
  }

  recomputeDirty() {
    this.state.dirty = this.state.productionBaseline ? !encountersEqual(this.state.draft, this.state.productionBaseline) : Boolean(this.state.draft);
  }

  globalSpawnIdsOwnedElsewhere() {
    return (this.registry?.listEncounters?.() ?? [])
      .filter((encounter) => encounter.encounterId !== this.state.draft?.encounterId)
      .flatMap((encounter) => encounter.spawns.map((spawn) => spawn.spawnId));
  }

  applyDraft(draft, { selectedSpawnId = this.state.selectedSpawnId, status = 'LOCAL DRAFT updated.' } = {}) {
    this.state.draft = canonicalizeEncounterDefinition(draft);
    this.state.selectedSpawnId = this.state.draft.spawns.some((spawn) => spawn.spawnId === selectedSpawnId) ? selectedSpawnId : null;
    this.state.draftSource = 'local';
    this.state.status = status;
    this.recomputeDirty();
    this.previewRuntime?.setDraft?.(this.state.draft, { selectedSpawnId: this.state.selectedSpawnId });
    this.scheduleAutosave();
    return this.emit();
  }

  scheduleAutosave() {
    if (!this.state.draft) return;
    if (this.autosaveTimer) this.clearTimeoutImplementation?.(this.autosaveTimer);
    if (!this.setTimeoutImplementation) return this.flushAutosave();
    this.autosaveTimer = this.setTimeoutImplementation(() => {
      this.autosaveTimer = null;
      this.flushAutosave();
    }, this.autosaveDelayMs);
  }

  flushAutosave() {
    if (this.autosaveTimer) this.clearTimeoutImplementation?.(this.autosaveTimer);
    this.autosaveTimer = null;
    if (!this.state.draft) return null;
    const record = this.draftStore.save(this.state.draft, { selectedSpawnId: this.state.selectedSpawnId, tab: this.state.tab });
    this.refreshEncounterLists();
    return record;
  }

  selectSpawn(spawnId) {
    if (!this.state.draft?.spawns.some((spawn) => spawn.spawnId === spawnId)) return false;
    this.state.selectedSpawnId = spawnId;
    this.state.tab = 'selected';
    this.state.deleteConfirmationSpawnId = null;
    this.previewRuntime?.setSelection?.(spawnId);
    this.scheduleAutosave();
    this.emit();
    return true;
  }

  clearSelection() {
    this.state.selectedSpawnId = null;
    this.state.deleteConfirmationSpawnId = null;
    this.state.deleteConfirmationExpiresAt = 0;
    this.previewRuntime?.setSelection?.(null);
    this.scheduleAutosave();
    return this.emit();
  }

  selectSpawnAtReticle() {
    const spawnId = this.previewRuntime?.pickCenter?.(this.sceneSessionHost?.camera);
    if (!spawnId) { this.state.status = 'No authoring marker is centered in the reticle.'; this.emit(); return null; }
    this.selectSpawn(spawnId);
    this.state.status = `Selected ${spawnId} from the world reticle.`;
    this.emit();
    return spawnId;
  }

  selectPreset(presetId) {
    const entry = this.state.enemyBank.find((candidate) => candidate.presetId === presetId);
    if (!entry || entry.supported !== true) throw new Error(entry?.failureReason ?? `Enemy Preset "${presetId}" is unavailable.`);
    this.state.recentPresetIds = [presetId, ...this.state.recentPresetIds.filter((id) => id !== presetId)].slice(0, 3);
    if (this.state.mode === ENCOUNTER_AUTHORING_MODES.changingPreset) {
      const spawnId = this.state.selectedSpawnId;
      this.state.mode = ENCOUNTER_AUTHORING_MODES.idle;
      return this.applyDraft(changeSpawnPreset(this.state.draft, spawnId, presetId), {
        selectedSpawnId: spawnId,
        status: `Changed ${spawnId} to Enemy Preset ${presetId}; authored identity and placement were preserved.`,
      });
    }
    this.state.mode = ENCOUNTER_AUTHORING_MODES.placing;
    this.state.placementPresetId = presetId;
    this.state.previewYaw = normalizeEncounterYaw(this.sceneSessionHost?.player?.yaw ?? 0);
    this.state.placementTarget = null;
    this.state.minimized = true;
    this.state.status = `PLACEMENT MODE — ${entry.displayName}. Aim at supported ground.`;
    this.emit();
    return this.state;
  }

  beginChangePreset() {
    if (!this.state.selectedSpawnId) throw new Error('Select a spawn before changing its preset.');
    this.state.mode = ENCOUNTER_AUTHORING_MODES.changingPreset;
    this.state.tab = 'bank';
    this.state.status = 'Choose the replacement Enemy Preset. Spawn identity, transform, home radius, and reward override will remain.';
    return this.emit();
  }

  rotatePlacement(deltaRadians) {
    this.state.previewYaw = normalizeEncounterYaw(this.state.previewYaw + deltaRadians);
    this.syncPlacementPreview();
    return this.emit();
  }

  commitPlacement() {
    if (this.state.mode !== ENCOUNTER_AUTHORING_MODES.placing) throw new Error('Placement mode is not active.');
    if (!this.state.placementTarget?.valid) throw new Error('NO VALID PLACEMENT: aim at supported walkable ground.');
    const result = placeSpawn(this.state.draft, {
      presetId: this.state.placementPresetId,
      position: this.state.placementTarget.position,
      yaw: this.state.previewYaw,
      spawnIdOptions: { globallyOwnedSpawnIds: this.globalSpawnIdsOwnedElsewhere() },
    });
    this.applyDraft(result.draft, {
      selectedSpawnId: result.spawn.spawnId,
      status: `Placed ${result.spawn.spawnId}. Placement mode remains active for rapid population.`,
    });
    this.state.mode = ENCOUNTER_AUTHORING_MODES.placing;
    this.state.placementPresetId = result.spawn.presetId;
    this.syncPlacementPreview();
    return result.spawn;
  }

  beginMove(spawnId = this.state.selectedSpawnId) {
    const spawn = this.state.draft?.spawns.find((entry) => entry.spawnId === spawnId);
    if (!spawn) throw new Error('Select a spawn before moving it.');
    this.state.selectedSpawnId = spawnId;
    this.moveOriginalTransform = structuredClone(spawn.transform);
    this.state.mode = ENCOUNTER_AUTHORING_MODES.moving;
    this.state.placementPresetId = spawn.presetId;
    this.state.previewYaw = spawn.transform.yaw;
    this.state.placementTarget = { valid: true, position: [...spawn.transform.position], source: 'original-transform' };
    this.state.minimized = true;
    this.previewRuntime?.setSelection?.(null);
    this.syncPlacementPreview();
    this.state.status = `MOVE MODE — ${spawnId}. Original transform is preserved until CONFIRM MOVE.`;
    return this.emit();
  }

  confirmMove() {
    if (this.state.mode !== ENCOUNTER_AUTHORING_MODES.moving) throw new Error('Move mode is not active.');
    if (!this.state.placementTarget?.valid) throw new Error('NO VALID PLACEMENT: move cannot be confirmed.');
    const spawnId = this.state.selectedSpawnId;
    const draft = moveSpawn(this.state.draft, spawnId, {
      position: this.state.placementTarget.position,
      yaw: this.state.previewYaw,
    });
    this.finishPlacementMode();
    return this.applyDraft(draft, { selectedSpawnId: spawnId, status: `Moved ${spawnId}; identity and preset were preserved.` });
  }

  cancelMove() {
    if (this.state.mode !== ENCOUNTER_AUTHORING_MODES.moving) return this.emit();
    const spawnId = this.state.selectedSpawnId;
    this.finishPlacementMode();
    this.previewRuntime?.setSelection?.(spawnId);
    this.state.status = `Move canceled. ${spawnId} retained its exact prior transform.`;
    return this.emit();
  }

  cancelPlacement(emit = true) {
    if ([ENCOUNTER_AUTHORING_MODES.placing, ENCOUNTER_AUTHORING_MODES.moving, ENCOUNTER_AUTHORING_MODES.changingPreset].includes(this.state.mode)) {
      this.finishPlacementMode();
      this.state.status = 'Authoring operation canceled.';
    }
    return emit ? this.emit() : this.state;
  }

  finishPlacementMode() {
    this.state.mode = ENCOUNTER_AUTHORING_MODES.idle;
    this.state.minimized = false;
    this.state.placementPresetId = null;
    this.state.placementTarget = null;
    this.moveOriginalTransform = null;
    this.previewRuntime?.clearPlacement?.();
    this.previewRuntime?.setSelection?.(this.state.selectedSpawnId);
  }

  rotateSelected(deltaRadians) {
    const spawn = this.getSelectedSpawn();
    return this.applyDraft(rotateSpawn(this.state.draft, spawn.spawnId, spawn.transform.yaw + deltaRadians), {
      selectedSpawnId: spawn.spawnId,
      status: `Rotated ${spawn.spawnId}.`,
    });
  }

  duplicateSelected() {
    const source = this.getSelectedSpawn();
    const result = duplicateSpawn(this.state.draft, source.spawnId, {
      spawnIdOptions: { globallyOwnedSpawnIds: this.globalSpawnIdsOwnedElsewhere() },
    });
    this.applyDraft(result.draft, { selectedSpawnId: result.spawn.spawnId, status: `Duplicated ${source.spawnId} as ${result.spawn.spawnId}.` });
    this.beginMove(result.spawn.spawnId);
    return result.spawn;
  }

  requestDeleteSelected() {
    const spawn = this.getSelectedSpawn();
    const now = this.now();
    if (this.state.deleteConfirmationSpawnId === spawn.spawnId && now <= this.state.deleteConfirmationExpiresAt) {
      const draft = deleteSpawn(this.state.draft, spawn.spawnId);
      this.state.deleteConfirmationSpawnId = null;
      this.state.deleteConfirmationExpiresAt = 0;
      return this.applyDraft(draft, { selectedSpawnId: null, status: `Deleted ${spawn.spawnId}. Remaining authored identities were not renumbered.` });
    }
    this.state.deleteConfirmationSpawnId = spawn.spawnId;
    this.state.deleteConfirmationExpiresAt = now + 4000;
    this.state.status = `Tap CONFIRM DELETE within 4 seconds to remove ${spawn.spawnId}.`;
    return this.emit();
  }

  setSelectedHomeRadius(homeRadius) {
    const spawn = this.getSelectedSpawn();
    return this.applyDraft(setSpawnHomeRadius(this.state.draft, spawn.spawnId, Number(homeRadius)), { selectedSpawnId: spawn.spawnId, status: `Home radius set to ${Number(homeRadius).toFixed(1)} m.` });
  }

  setSelectedGoldOverride(gold) {
    const spawn = this.getSelectedSpawn();
    return this.applyDraft(setSpawnGoldOverride(this.state.draft, spawn.spawnId, Number(gold)), { selectedSpawnId: spawn.spawnId, status: `Fixed gold override set to ${Number(gold)}.` });
  }

  removeSelectedGoldOverride() {
    const spawn = this.getSelectedSpawn();
    return this.applyDraft(removeSpawnGoldOverride(this.state.draft, spawn.spawnId), { selectedSpawnId: spawn.spawnId, status: 'Gold behavior restored to Enemy Preset default.' });
  }

  getSelectedSpawn() {
    const spawn = this.state.draft?.spawns.find((entry) => entry.spawnId === this.state.selectedSpawnId);
    if (!spawn) throw new Error('No encounter spawn is selected.');
    return spawn;
  }

  requestResetToProduction() {
    if (!this.state.productionBaseline) throw new Error('This encounter has no production baseline.');
    const now = this.now();
    if (now <= this.state.resetProductionConfirmationExpiresAt) {
      const baseline = cloneEncounterDraft(this.state.productionBaseline);
      this.draftStore.remove(baseline.locationId, baseline.encounterId);
      this.setActiveDraft(baseline, { baseline, source: 'production' });
      this.state.resetProductionConfirmationExpiresAt = 0;
      this.state.status = 'LOCAL DRAFT reset to the immutable PRODUCTION BASELINE.';
      return this.emit();
    }
    this.state.resetProductionConfirmationExpiresAt = now + 4000;
    this.state.status = 'Tap CONFIRM RESET TO PRODUCTION within 4 seconds to discard local changes.';
    return this.emit();
  }

  getCanonicalJson() {
    if (!this.state.draft) throw new Error('Open or create an Encounter first.');
    return serializeEncounterDefinition(this.state.draft);
  }

  async testEncounter() {
    if (!this.state.draft) throw new Error('Open or create an Encounter first.');
    const definition = canonicalizeEncounterDefinition(this.state.draft);
    this.state.busy = true;
    this.emit();
    try {
      this.cancelPlacement(false);
      this.previewRuntime?.clearWorldVisuals?.();
      this.encounterRuntimeHost?.despawnAll?.('encounter-authoring-test-start');
      const runtime = await this.encounterRuntimeHost.spawnDefinition(definition);
      this.state.mode = ENCOUNTER_AUTHORING_MODES.testing;
      this.state.testEncounterId = definition.encounterId;
      this.state.minimized = true;
      this.state.status = `TESTING: ${definition.displayName} through the real EncounterRuntimeHost (${runtime.enemies.length} enemies).`;
      return runtime;
    } finally {
      this.state.busy = false;
      this.emit();
    }
  }

  async resetTest() {
    if (this.state.mode !== ENCOUNTER_AUTHORING_MODES.testing || !this.state.testEncounterId) throw new Error('No authored encounter test is active.');
    const result = await this.encounterRuntimeHost.resetEncounter(this.state.testEncounterId);
    this.state.status = result.accepted ? 'Test reset through EncounterRuntime reset semantics; draft and spawn IDs are unchanged.' : `Test reset rejected: ${result.reason}`;
    this.emit();
    return result;
  }

  returnToAuthoring() {
    if (this.state.testEncounterId) this.encounterRuntimeHost?.despawnEncounter?.(this.state.testEncounterId, 'encounter-authoring-return');
    this.playerDamageReceiver?.reset?.();
    this.state.mode = ENCOUNTER_AUTHORING_MODES.idle;
    this.state.testEncounterId = null;
    this.state.minimized = false;
    this.previewRuntime?.setDraft?.(this.state.draft, { selectedSpawnId: this.state.selectedSpawnId });
    this.state.status = 'Returned to authoring with the same LOCAL DRAFT and stable spawn IDs.';
    return this.emit();
  }

  async saveToProject() {
    if (!this.fetchImplementation) throw new Error('SAVE TO PROJECT bridge is unavailable. Export JSON and use IMPORT_ENCOUNTER.cmd.');
    const canonicalJson = this.getCanonicalJson();
    this.state.busy = true;
    this.emit();
    try {
      const origin = globalThis.location?.origin ?? 'http://localhost';
      const response = await this.fetchImplementation(new URL(ENCOUNTER_AUTHORING_BRIDGE_PATH, origin), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: canonicalJson,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) throw new Error(payload.message ?? `Dev bridge returned HTTP ${response.status}.`);
      this.state.productionBaseline = cloneEncounterDraft(this.state.draft);
      this.state.draftSource = 'local';
      this.state.lastSavedPath = payload.relativePath;
      this.state.bridgeAvailable = true;
      this.recomputeDirty();
      this.flushAutosave();
      this.state.status = `SAVED TO PROJECT — ${payload.relativePath}`;
      return payload;
    } catch (error) {
      this.state.bridgeAvailable = false;
      this.state.status = `SAVE FAILED: ${error.message} Export JSON and use IMPORT_ENCOUNTER.cmd.`;
      throw error;
    } finally {
      this.state.busy = false;
      this.emit();
    }
  }

  async handleSessionChanged(session = this.sceneSessionHost) {
    if (!this.state.open) return;
    this.flushAutosave();
    this.previewRuntime?.clearWorldVisuals?.();
    this.state.mode = ENCOUNTER_AUTHORING_MODES.idle;
    this.state.placementTarget = null;
    this.state.placementPresetId = null;
    this.state.testEncounterId = null;
    this.state.locationId = session?.locationId ?? null;
    this.state.draft = null;
    this.state.productionBaseline = null;
    this.state.selectedSpawnId = null;
    this.ensurePreviewRuntime();
    this.refreshEncounterLists();
    const last = this.state.locationId ? this.draftStore.loadLast(this.state.locationId) : null;
    if (last) this.loadDraftRecord(last);
    this.state.status = last
      ? `Entered ${this.state.locationId}; its scoped LOCAL DRAFT was restored.`
      : `Entered ${this.state.locationId}; choose a location-matching Encounter.`;
    return this.emit();
  }

  syncPlacementPreview() {
    if (![ENCOUNTER_AUTHORING_MODES.placing, ENCOUNTER_AUTHORING_MODES.moving].includes(this.state.mode)) return;
    this.previewRuntime?.setPlacement?.({
      presetId: this.state.placementPresetId,
      position: this.state.placementTarget?.position,
      yaw: this.state.previewYaw,
      valid: this.state.placementTarget?.valid === true,
      mode: this.state.mode,
    });
  }

  update(deltaSeconds) {
    if (!this.state.open) return;
    this.previewRuntime?.update?.(deltaSeconds);
    if (![ENCOUNTER_AUTHORING_MODES.placing, ENCOUNTER_AUTHORING_MODES.moving].includes(this.state.mode)) return;
    const target = this.placementResolver.resolve({
      camera: this.sceneSessionHost?.camera,
      scene: this.sceneSessionHost?.scene,
      collision: this.sceneSessionHost?.dungeon?.collision,
    });
    this.state.placementTarget = target;
    this.syncPlacementPreview();
    const signature = `${target.valid}:${target.reason}:${target.position?.map((value) => value.toFixed(2)).join(',') ?? ''}`;
    if (signature !== this.lastPlacementSignature) {
      this.lastPlacementSignature = signature;
      this.emit();
    }
  }

  dispose() {
    if (this.disposed) return;
    this.flushAutosave();
    this.previewRuntime?.dispose?.();
    this.previewRuntime = null;
    this.listeners.clear();
    this.disposed = true;
  }
}
