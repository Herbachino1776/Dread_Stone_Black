import * as THREE from 'three';
import { PROGRESSIVE_SITE_RADIUS_TOLERANCE_METERS } from '../combat/ProgressiveDamageSiteTargeting.js';
import { BLUNT_IMPACT_CLASSIFICATIONS, BLUNT_IMPACT_SCHEMA } from '../combat/weapons/BluntImpactInteraction.js';
import { CreatureLabPanel } from './CreatureLabPanel.js';
import { CreatureDefinitionRegistry } from './CreatureDefinitionRegistry.js';
import { CreatureFactory } from './CreatureFactory.js';
import { CreaturePackRegistry } from './CreaturePackRegistry.js';
import { CreatureLabSiteMarkerRenderer } from './CreatureLabSiteMarkerRenderer.js';
import {
  createEnemyPresetRecordFromLabCalibration,
  createCreatureLabHeightResolution,
  CreatureLabCalibrationStore,
  labCalibrationToWeaponDefinitionPatch,
  serializeEnemyPresetFromLabCalibration,
  setLabCalibrationField,
  weaponDefinitionToLabCalibration,
} from './CreatureLabCalibration.js';
import { summarizeCreatureDefinition } from './CreatureRuntimePolicies.js';
import { EnemyPresetRegistry } from './EnemyPresetRegistry.js';
import { EnemyPresetResolver } from './EnemyPresetResolver.js';

const DEFAULT_DEFINITION_ID = 'chezwick';
const CREATURE_LAB_QUERY_KEY = 'creatureLab';
const SEGMENT_LABELS = Object.freeze({
  head_neck: 'Head / Neck',
  left_elbow: 'Left Elbow',
  right_elbow: 'Right Elbow',
  lower_spine: 'Lower Spine',
});

function serializable(value, depth = 0, seen = new WeakSet()) {
  if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (value?.isVector3 || value?.isQuaternion || value?.isEuler) return value.toArray();
  if (typeof value !== 'object' || depth >= 4) return String(value);
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 32).map((entry) => serializable(entry, depth + 1, seen));
  const result = {};
  Object.entries(value).slice(0, 64).forEach(([key, entry]) => {
    if (['actor', 'body', 'collider', 'object', 'node', 'material'].includes(key)) return;
    result[key] = serializable(entry, depth + 1, seen);
  });
  return result;
}

export function resolveCreatureLabMode(query = new URLSearchParams()) {
  return query?.get?.(CREATURE_LAB_QUERY_KEY) === '1';
}

export function createCreatureLabReadOnlyStorage(storage) {
  const readOnly = {
    getItem: (key) => storage?.getItem?.(key) ?? null,
    key: (index) => storage?.key?.(index) ?? null,
    setItem() {},
    removeItem() {},
    clear() {},
  };
  Object.defineProperty(readOnly, 'length', { enumerable: true, get: () => Number(storage?.length) || 0 });
  return readOnly;
}

export class CreatureLabController {
  constructor({
    registry = new CreaturePackRegistry(),
    definitionRegistry = new CreatureDefinitionRegistry(),
    creatureFactory = null,
    presetRegistry = new EnemyPresetRegistry(),
    enemyPresetResolver = null,
    walkerController,
    combatRouter = null,
    playerProvider = null,
    weaponControllerProvider = null,
    onSubjectChanged = null,
    initialDefinitionId = DEFAULT_DEFINITION_ID,
    initialPackId = null,
    initialPresetId = null,
    attackHarness = null,
    calibrationStorage = globalThis.localStorage,
    panelFactory = (options) => new CreatureLabPanel(options),
  } = {}) {
    if (!walkerController) throw new Error('Creature Lab requires one isolated walker lifecycle host.');
    this.registry = registry;
    this.definitionRegistry = definitionRegistry;
    this.creatureFactory = creatureFactory ?? new CreatureFactory({
      definitionRegistry: this.definitionRegistry,
      creaturePackRegistry: this.registry,
    });
    this.presetRegistry = presetRegistry;
    this.enemyPresetResolver = enemyPresetResolver ?? new EnemyPresetResolver({
      presetRegistry: this.presetRegistry,
      definitionRegistry: this.definitionRegistry,
      creaturePackRegistry: this.registry,
      creatureFactory: this.creatureFactory,
      weaponRegistry: attackHarness?.weaponRegistry,
    });
    this.walkerController = walkerController;
    this.combatRouter = combatRouter;
    this.playerProvider = playerProvider;
    this.weaponControllerProvider = weaponControllerProvider;
    this.onSubjectChanged = onSubjectChanged;
    this.initialDefinitionId = initialDefinitionId;
    this.initialPackId = initialPackId;
    this.initialPresetId = initialPresetId;
    this.attackHarness = attackHarness;
    this.calibrationStore = new CreatureLabCalibrationStore({ storage: calibrationStorage });
    this.panelFactory = panelFactory;
    this.definitionOptions = [];
    this.presetOptions = [];
    this.weaponOptions = this.attackHarness?.listWeapons?.() ?? [];
    this.selectedWeaponId = this.attackHarness?.getSelectedWeaponId?.() ?? this.weaponOptions[0]?.weaponId ?? null;
    this.weaponCalibration = null;
    this.creatureHeightOverride = null;
    this.calibrationContext = null;
    this.productionWeaponDefinition = null;
    this.selectedPreset = null;
    this.resolvedPreset = null;
    this.selectedDefinition = null;
    this.selectedPack = null;
    this.resolvedCreature = null;
    this.effectiveProfile = null;
    this.selectedSiteId = null;
    this.showSites = false;
    this.showSelectedRadius = false;
    this.siteMarkerRenderer = null;
    this.lastOperation = null;
    this.loading = false;
    this.disposed = false;
    this.selectionSerial = 0;
    this.impactSerial = 0;
    this.listeners = new Set();
    this.panel = null;
    this.debugCommands = null;
  }

  get actor() { return this.walkerController?.actor ?? null; }

  async initialize() {
    const definitions = this.definitionRegistry.listDefinitions();
    this.definitionOptions = await Promise.all(definitions.map(async (definition) => {
      try {
        const resolved = await this.creatureFactory.resolve(definition.definitionId);
        return {
          definitionId: definition.definitionId,
          displayName: definition.displayName,
          creaturePackId: definition.creaturePackId,
          definition,
          resolved,
          descriptor: resolved.pack,
          profile: resolved.profile,
          supported: true,
          code: 'SUPPORTED',
          reason: null,
        };
      } catch (error) {
        return {
          definitionId: definition.definitionId,
          displayName: definition.displayName,
          creaturePackId: definition.creaturePackId,
          definition,
          resolved: null,
          descriptor: null,
          profile: null,
          supported: false,
          code: error.code ?? 'DEFINITION_RESOLUTION_FAILED',
          reason: error.message,
        };
      }
    }));
    this.presetOptions = await Promise.all(this.presetRegistry.listPresets().map(async (preset) => {
      try {
        const resolved = await this.enemyPresetResolver.resolve(preset.presetId);
        return {
          presetId: preset.presetId,
          displayName: preset.displayName,
          creatureDefinitionId: preset.creatureDefinitionId,
          preset,
          resolved,
          supported: true,
          code: 'SUPPORTED',
          reason: null,
        };
      } catch (error) {
        return {
          presetId: preset.presetId,
          displayName: preset.displayName,
          creatureDefinitionId: preset.creatureDefinitionId,
          preset,
          resolved: null,
          supported: false,
          code: error.code ?? 'PRESET_RESOLUTION_FAILED',
          reason: error.message,
        };
      }
    }));
    const requestedPreset = this.presetOptions.find((entry) => entry.presetId === this.initialPresetId && entry.supported);
    const requested = this.definitionOptions.find((entry) => entry.definitionId === this.initialDefinitionId && entry.supported);
    const legacyRequested = this.initialPackId
      ? this.definitionOptions.filter((entry) => entry.creaturePackId === this.initialPackId && entry.supported)
      : [];
    const initial = requested ?? (legacyRequested.length === 1 ? legacyRequested[0] : null) ?? this.definitionOptions.find((entry) => entry.supported) ?? null;
    if (requestedPreset) await this.selectPreset(requestedPreset.presetId);
    else if (initial) await this.selectDefinition(initial.definitionId);
    else this.recordOperation('initialize', { accepted: false, reason: 'No registered Creature Definition is supported by the current humanoid runtime.' });
    if (globalThis.document?.body && !this.disposed) this.panel = this.panelFactory({ controller: this, parent: document.body });
    this.installDebugCommands();
    return this.getDiagnostics();
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const snapshot = this.getViewState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  recordOperation(operation, result, error = null) {
    this.lastOperation = {
      operation,
      ok: error == null && result?.accepted !== false && result?.applied !== false,
      result: serializable(result),
      error: error?.message ?? null,
      at: new Date().toISOString(),
    };
    this.notify();
    return error ? { accepted: false, reason: error.message } : result;
  }

  async selectDefinition(definitionId, options = {}) {
    if (this.disposed) return { accepted: false, reason: 'Creature Lab is disposed.' };
    const option = this.definitionOptions.find((entry) => entry.definitionId === definitionId);
    if (!option) return this.recordOperation('selectDefinition', { accepted: false, reason: `Unknown registered definition ${definitionId}.` });
    if (!option.supported) return this.recordOperation('selectDefinition', { accepted: false, reason: option.reason, code: option.code });
    return this.activateCreatureSelection({
      baseResolved: option.resolved ?? await this.creatureFactory.resolve(definitionId),
      presetResolution: null,
      options,
      operation: options.operation ?? 'selectDefinition',
    });
  }

  async selectPreset(presetId, options = {}) {
    if (this.disposed) return { accepted: false, reason: 'Creature Lab is disposed.' };
    const option = this.presetOptions.find((entry) => entry.presetId === presetId);
    if (!option) return this.recordOperation('selectPreset', { accepted: false, reason: `Unknown registered Enemy Preset ${presetId}.` });
    if (!option.supported) return this.recordOperation('selectPreset', { accepted: false, reason: option.reason, code: option.code });
    const resolved = option.resolved ?? await this.enemyPresetResolver.resolve(presetId);
    return this.activateCreatureSelection({
      baseResolved: resolved,
      presetResolution: resolved,
      options,
      operation: 'selectPreset',
    });
  }

  async activateCreatureSelection({ baseResolved, presetResolution = null, options = {}, operation }) {
    const serial = ++this.selectionSerial;
    this.loading = true;
    this.notify();
    try {
      const definition = baseResolved.definition;
      const productionHeight = presetResolution?.preset.presentation.targetHeight
        ?? definition.presentation.targetHeight;
      const requestedWeaponId = presetResolution?.weapon.weaponId
        ?? options.selectedWeaponId
        ?? this.selectedWeaponId
        ?? this.weaponOptions[0]?.weaponId;
      const productionWeapon = presetResolution?.weapon
        ?? this.weaponOptions.find((weapon) => weapon.weaponId === requestedWeaponId);
      if (!productionWeapon) throw new Error(`Creature Lab weapon ${requestedWeaponId ?? 'unknown'} is unavailable.`);
      const calibrationContext = presetResolution
        ? { kind: 'preset', id: presetResolution.preset.presetId }
        : { kind: 'definition', id: definition.definitionId };
      const draft = this.calibrationStore.loadDraft({
        context: calibrationContext,
        weaponDefinition: productionWeapon,
        targetHeight: productionHeight,
      });
      const requestedHeight = Object.hasOwn(options, 'heightOverride')
        ? (options.heightOverride ?? productionHeight)
        : draft.targetHeight;
      const restoreArmament = options.restoreArmament === true
        && this.attackHarness?.getDiagnostics?.().equipped === true;
      const resolved = createCreatureLabHeightResolution(baseResolved, requestedHeight);
      const { pack, profile } = resolved;
      this.weaponControllerProvider?.()?.cancel?.('creature-lab-definition-switch');
      this.attackHarness?.clearSubject?.('creature-lab-definition-switch');
      this.disposeSiteMarkers();
      if (this.actor) this.walkerController.disposeWalker({ respawn: false });
      this.selectedDefinition = definition;
      this.selectedPreset = presetResolution?.preset ?? null;
      this.resolvedPreset = presetResolution;
      this.selectedPack = pack;
      this.resolvedCreature = resolved;
      this.effectiveProfile = profile;
      this.calibrationContext = calibrationContext;
      this.productionWeaponDefinition = productionWeapon;
      this.selectedWeaponId = requestedWeaponId;
      this.weaponCalibration = draft.weaponCalibration;
      this.creatureHeightOverride = Math.abs(requestedHeight - productionHeight) > 1e-8 ? requestedHeight : null;
      this.selectedSiteId = null;
      this.walkerController.actorFactory = (options) => this.creatureFactory.createActorFromResolved(resolved, options).actor;
      this.walkerController.enabled = true;
      this.walkerController.pauseLocomotion = true;
      const spawned = this.walkerController.reset(this.playerProvider?.());
      this.onSubjectChanged?.(this.getSubjectState());
      if (!spawned || !this.actor) throw new Error(`Creature Lab could not find a safe Folsom spawn for ${definition.definitionId}.`);
      await this.actor.visualAdapter?.ready;
      if (serial !== this.selectionSerial || this.disposed) return { accepted: false, reason: 'Definition selection was superseded.' };
      this.attackHarness?.setSubject?.(this.actor, {
        pack: this.selectedPack,
        ...(presetResolution ? { loadout: presetResolution.loadout } : {}),
      });
      if (!presetResolution && this.selectedWeaponId) this.attackHarness?.selectWeapon?.(this.selectedWeaponId);
      this.applyWeaponCalibrationToHarness();
      const armamentRestoreResult = restoreArmament ? await this.attackHarness?.equip?.() : null;
      this.selectedSiteId = this.getProgressiveSites()[0]?.siteId ?? null;
      this.createSiteMarkers();
      this.onSubjectChanged?.(this.getSubjectState());
      return this.recordOperation(operation, {
        accepted: true,
        definitionId: definition.definitionId,
        presetId: presetResolution?.preset.presetId ?? null,
        creaturePackId: pack.packId,
        actorInstanceId: this.actor.instanceId,
        resultingHeight: profile.targetHeight,
        armamentRestored: armamentRestoreResult?.accepted === true,
        armamentRestoreReason: restoreArmament && armamentRestoreResult?.accepted !== true
          ? armamentRestoreResult?.reason ?? 'armament-restore-unavailable'
          : null,
      });
    } catch (error) {
      this.disposeSiteMarkers();
      if (serial === this.selectionSerial && this.actor) this.walkerController.disposeWalker({ respawn: false });
      this.onSubjectChanged?.(this.getSubjectState());
      return this.recordOperation(operation, null, error);
    } finally {
      if (serial === this.selectionSerial) this.loading = false;
      this.notify();
    }
  }

  async selectPack(packId) {
    const matches = this.definitionOptions.filter((entry) => entry.creaturePackId === packId);
    if (matches.length !== 1) {
      const reason = matches.length === 0
        ? `No Creature Definition references pack ${packId}.`
        : `Pack ${packId} is referenced by multiple Creature Definitions; select a definition ID explicitly.`;
      return this.recordOperation('selectPackCompatibility', { accepted: false, reason });
    }
    return this.selectDefinition(matches[0].definitionId);
  }

  getSubjectState() {
    return {
      actor: this.actor,
      director: this.walkerController?.director ?? null,
      bloodEffects: this.walkerController?.bloodEffects ?? null,
      playerBlocker: this.walkerController?.playerBlocker ?? null,
      profile: this.effectiveProfile,
    };
  }

  async respawn() {
    if (!this.selectedDefinition) return this.recordOperation('respawn', { accepted: false, reason: 'No supported definition is selected.' });
    const options = { restoreArmament: true, operation: 'respawn' };
    return this.selectedPreset
      ? this.selectPreset(this.selectedPreset.presetId, options)
      : this.selectDefinition(this.selectedDefinition.definitionId, options);
  }

  getSelectedWeaponDefinition() {
    return this.weaponOptions.find((weapon) => weapon.weaponId === this.selectedWeaponId) ?? null;
  }

  applyWeaponCalibrationToHarness() {
    const definition = this.getSelectedWeaponDefinition();
    if (!definition || !this.weaponCalibration) return { accepted: false, reason: 'No Creature Lab weapon calibration is selected.' };
    const patch = labCalibrationToWeaponDefinitionPatch(definition, this.weaponCalibration);
    return this.attackHarness?.setCalibrationOverride?.(patch)
      ?? { accepted: false, reason: 'Creature Lab armament runtime is unavailable.' };
  }

  getProductionTargetHeight() {
    return this.selectedPreset?.presentation?.targetHeight
      ?? this.selectedDefinition?.presentation?.targetHeight
      ?? null;
  }

  saveCurrentCalibrationDraft({ targetHeight = this.effectiveProfile?.targetHeight, weaponCalibration = this.weaponCalibration } = {}) {
    if (!this.calibrationContext || !this.productionWeaponDefinition) {
      throw new Error('Creature Lab calibration context is unavailable.');
    }
    return this.calibrationStore.saveDraft({
      context: this.calibrationContext,
      weaponDefinition: this.productionWeaponDefinition,
      targetHeight,
      weaponCalibration,
    });
  }

  async selectWeapon(weaponId) {
    const definition = this.weaponOptions.find((weapon) => weapon.weaponId === weaponId);
    if (!definition) return this.recordOperation('selectWeapon', { accepted: false, reason: `Unknown Creature Lab weapon ${weaponId}.` });
    if (this.selectedPreset && weaponId === this.selectedWeaponId) {
      return this.recordOperation('selectWeapon', { accepted: true, weaponId, presetId: this.selectedPreset.presetId, alreadySelected: true });
    }
    if (this.selectedDefinition) {
      return this.selectDefinition(this.selectedDefinition.definitionId, {
        selectedWeaponId: weaponId,
        restoreArmament: this.attackHarness?.getDiagnostics?.().equipped === true,
        operation: 'selectWeapon',
      });
    }
    const selected = this.attackHarness?.selectWeapon?.(weaponId)
      ?? { accepted: false, reason: 'Creature Lab armament runtime is unavailable.' };
    if (selected.accepted === false) return this.recordOperation('selectWeapon', selected);
    this.selectedWeaponId = weaponId;
    this.productionWeaponDefinition = definition;
    this.calibrationContext = { kind: 'definition', id: 'definition_only' };
    this.weaponCalibration = this.calibrationStore.loadDraft({
      context: this.calibrationContext,
      weaponDefinition: definition,
      targetHeight: 1,
    }).weaponCalibration;
    const applied = this.applyWeaponCalibrationToHarness();
    return this.recordOperation('selectWeapon', {
      accepted: true,
      weaponId,
      loadoutId: selected.loadoutId,
      calibrationApplied: applied.accepted === true,
    });
  }

  setWeaponCalibrationField(field, value, { notify = false } = {}) {
    const definition = this.getSelectedWeaponDefinition();
    if (!definition || !this.weaponCalibration) return { accepted: false, reason: 'No Creature Lab weapon is selected.' };
    const updated = setLabCalibrationField(this.weaponCalibration, field, value);
    this.weaponCalibration = this.saveCurrentCalibrationDraft({ weaponCalibration: updated }).weaponCalibration;
    const applied = this.applyWeaponCalibrationToHarness();
    this.lastOperation = {
      operation: 'weaponCalibration',
      ok: true,
      result: { accepted: true, weaponId: definition.weaponId, field, value: Number(value), runtimeApplied: applied.accepted === true },
      error: null,
      at: new Date().toISOString(),
    };
    if (notify) this.notify();
    return this.lastOperation.result;
  }

  resetWeaponCalibration() {
    const definition = this.getSelectedWeaponDefinition();
    if (!definition) return this.recordOperation('resetWeaponCalibration', { accepted: false, reason: 'No Creature Lab weapon is selected.' });
    this.weaponCalibration = weaponDefinitionToLabCalibration(this.productionWeaponDefinition ?? definition);
    this.saveCurrentCalibrationDraft({ weaponCalibration: this.weaponCalibration });
    const applied = this.applyWeaponCalibrationToHarness();
    return this.recordOperation('resetWeaponCalibration', {
      accepted: true,
      weaponId: definition.weaponId,
      runtimeApplied: applied.accepted === true,
    });
  }

  getWeaponCalibrationReadout() {
    const definition = this.getSelectedWeaponDefinition();
    return definition && this.weaponCalibration
      ? labCalibrationToWeaponDefinitionPatch(definition, this.weaponCalibration)
      : null;
  }

  async setCreatureHeight(targetHeight) {
    if (!this.selectedDefinition) return this.recordOperation('creatureHeight', { accepted: false, reason: 'No supported definition is selected.' });
    const height = Number(targetHeight);
    try {
      this.saveCurrentCalibrationDraft({ targetHeight: height });
      return this.selectedPreset
        ? await this.selectPreset(this.selectedPreset.presetId, { restoreArmament: true, operation: 'creatureHeight' })
        : await this.selectDefinition(this.selectedDefinition.definitionId, { restoreArmament: true, operation: 'creatureHeight' });
    } catch (error) {
      return this.recordOperation('creatureHeight', null, error);
    }
  }

  async resetCreatureHeight() {
    if (!this.selectedDefinition) return this.recordOperation('resetCreatureHeight', { accepted: false, reason: 'No supported definition is selected.' });
    this.saveCurrentCalibrationDraft({ targetHeight: this.getProductionTargetHeight() });
    return this.selectedPreset
      ? this.selectPreset(this.selectedPreset.presetId, { restoreArmament: true, operation: 'resetCreatureHeight' })
      : this.selectDefinition(this.selectedDefinition.definitionId, { restoreArmament: true, operation: 'resetCreatureHeight' });
  }

  async resetToPresetDefaults() {
    if (!this.selectedPreset || !this.resolvedPreset) {
      return this.recordOperation('resetToPresetDefaults', { accepted: false, reason: 'Select an Enemy Preset before resetting production defaults.' });
    }
    const presetId = this.selectedPreset.presetId;
    this.calibrationStore.resetDraft({
      context: this.calibrationContext,
      weaponDefinition: this.resolvedPreset.weapon,
      targetHeight: this.selectedPreset.presentation.targetHeight,
    });
    return this.selectPreset(presetId, { restoreArmament: true, operation: 'resetToPresetDefaults' });
  }

  hasUnsavedLabDraft() {
    if (!this.productionWeaponDefinition || !this.weaponCalibration) return false;
    const definition = this.getSelectedWeaponDefinition();
    if (!definition) return false;
    const currentPatch = labCalibrationToWeaponDefinitionPatch(definition, this.weaponCalibration);
    const baselineCalibration = weaponDefinitionToLabCalibration(this.productionWeaponDefinition);
    const baselinePatch = labCalibrationToWeaponDefinitionPatch(this.productionWeaponDefinition, baselineCalibration);
    return Math.abs((this.effectiveProfile?.targetHeight ?? 0) - (this.getProductionTargetHeight() ?? 0)) > 1e-8
      || JSON.stringify(currentPatch) !== JSON.stringify(baselinePatch);
  }

  getEnemyPresetRecord() {
    if (!this.selectedPreset || !this.weaponCalibration) return null;
    return createEnemyPresetRecordFromLabCalibration({
      preset: this.selectedPreset,
      targetHeight: this.effectiveProfile?.targetHeight,
      weaponDefinition: this.getSelectedWeaponDefinition(),
      calibration: this.weaponCalibration,
    });
  }

  getEnemyPresetJson() {
    if (!this.selectedPreset || !this.weaponCalibration) return null;
    return serializeEnemyPresetFromLabCalibration({
      preset: this.selectedPreset,
      targetHeight: this.effectiveProfile?.targetHeight,
      weaponDefinition: this.getSelectedWeaponDefinition(),
      calibration: this.weaponCalibration,
    });
  }

  resetDamage() {
    const accepted = this.walkerController?.resetActorDamage?.() === true;
    this.onSubjectChanged?.(this.getSubjectState());
    return this.recordOperation('resetDamage', {
      accepted,
      reason: accepted ? null : 'Damage reset is available only while the current subject is alive; use Respawn after death.',
    });
  }

  triggerAttack() {
    return this.recordOperation('triggerAttack', this.attackHarness?.triggerAttack?.()
      ?? { accepted: false, reason: 'Creature Lab offensive harness is unavailable.' });
  }

  async equipArmament() {
    const result = await this.attackHarness?.equip?.()
      ?? { accepted: false, reason: 'Creature Lab armament runtime is unavailable.' };
    return this.recordOperation('equipArmament', result);
  }

  unequipArmament() {
    return this.recordOperation('unequipArmament', this.attackHarness?.unequip?.()
      ?? { accepted: false, reason: 'Creature Lab armament runtime is unavailable.' });
  }

  selectOffensiveAction(combatActionId) {
    return this.recordOperation('selectOffensiveAction', this.attackHarness?.selectOffensiveAction?.(combatActionId)
      ?? { accepted: false, reason: 'Creature Lab armament runtime is unavailable.' });
  }

  resetPlayer() {
    return this.recordOperation('resetPlayer', this.attackHarness?.resetPlayer?.()
      ?? { accepted: false, reason: 'Creature Lab player receiver is unavailable.' });
  }

  toggleAttackGeometry() {
    return this.recordOperation('attackGeometry', this.attackHarness?.toggleAttackGeometry?.()
      ?? { accepted: false, reason: 'Creature Lab attack diagnostics are unavailable.' });
  }

  getProgressiveSites() {
    return this.actor?.visualAdapter?.listProgressiveDamageSites?.() ?? [];
  }

  getSiteTargeting() {
    return this.actor?.visualAdapter?.getProgressiveDamageSiteTargeting?.() ?? null;
  }

  createSiteMarkers() {
    this.disposeSiteMarkers();
    const targeting = this.getSiteTargeting();
    if (!targeting || !this.actor?.scene) return null;
    this.siteMarkerRenderer = new CreatureLabSiteMarkerRenderer({ scene: this.actor.scene, targeting });
    this.updateSiteMarkers();
    return this.siteMarkerRenderer;
  }

  disposeSiteMarkers() {
    this.siteMarkerRenderer?.dispose?.();
    this.siteMarkerRenderer = null;
  }

  updateSiteMarkers() {
    this.siteMarkerRenderer?.setSettings?.({
      selectedSiteId: this.selectedSiteId,
      showSites: this.showSites,
      showSelectedRadius: this.showSelectedRadius,
    });
  }

  selectSite(siteId) {
    const site = this.getProgressiveSites().find((entry) => entry.siteId === siteId);
    if (!site) return this.recordOperation('selectSite', { accepted: false, reason: `Progressive site ${siteId} is unavailable.` });
    this.selectedSiteId = site.siteId;
    this.updateSiteMarkers();
    return this.recordOperation('selectSite', { accepted: true, siteId: site.siteId, authority: site.authority });
  }

  selectRelativeSite(offset) {
    const sites = this.getProgressiveSites();
    if (!sites.length) return this.recordOperation('selectRelativeSite', { accepted: false, reason: 'No progressive sites are available.' });
    const currentIndex = Math.max(0, sites.findIndex((site) => site.siteId === this.selectedSiteId));
    const nextIndex = (currentIndex + offset + sites.length) % sites.length;
    return this.selectSite(sites[nextIndex].siteId);
  }

  toggleSiteMarkers() {
    this.showSites = !this.showSites;
    this.updateSiteMarkers();
    return this.recordOperation('showSites', { accepted: true, enabled: this.showSites });
  }

  toggleSelectedRadius() {
    this.showSelectedRadius = !this.showSelectedRadius;
    this.updateSiteMarkers();
    return this.recordOperation('showSelectedRadius', { accepted: true, enabled: this.showSelectedRadius });
  }

  setSelectedSiteStage(stageName) {
    const siteId = this.selectedSiteId;
    const result = this.actor?.visualAdapter?.setProgressiveDamageStage?.(siteId, stageName, {
      source: 'creature_lab_panel',
      hitRegion: 'manual',
      hitSide: 'manual',
    }) ?? { applied: false, reason: 'damage-runtime-not-ready', siteId };
    return this.recordOperation(`site${String(stageName).toLowerCase()}`, result);
  }

  advanceSelectedSite() {
    const result = this.actor?.visualAdapter?.advanceProgressiveDamageSite?.(this.selectedSiteId, {
      source: 'creature_lab_panel',
      hitRegion: 'manual',
      hitSide: 'manual',
    }) ?? { applied: false, reason: 'damage-runtime-not-ready', siteId: this.selectedSiteId };
    return this.recordOperation('nextStage', result);
  }

  resetSelectedSite() {
    const result = this.actor?.visualAdapter?.resetProgressiveDamageSite?.(this.selectedSiteId)
      ?? { applied: false, reason: 'damage-runtime-not-ready', siteId: this.selectedSiteId };
    return this.recordOperation('resetSite', result);
  }

  resolveSiteStrikeBodyId(site) {
    const identity = `${site?.regionId ?? ''} ${site?.structuralGroup ?? ''} ${site?.displayName ?? ''} ${site?.siteId ?? ''}`.toLowerCase();
    if (/head|face|skull/.test(identity)) return 'head';
    if (/forearm_left|left_forearm/.test(identity)) return 'left_forearm';
    if (/forearm_right|right_forearm/.test(identity)) return 'right_forearm';
    if (/pelvis/.test(identity)) return 'pelvis';
    if (/body|chest|torso|abdomen/.test(identity)) return 'upper_chest';
    return null;
  }

  strikeSelectedSite(probe = 'center') {
    const actor = this.actor;
    const adapter = actor?.visualAdapter;
    const site = this.getProgressiveSites().find((entry) => entry.siteId === this.selectedSiteId);
    const target = adapter?.getProgressiveDamageSiteTarget?.(this.selectedSiteId, { refresh: true });
    const bodyId = this.resolveSiteStrikeBodyId(site);
    const collider = bodyId ? actor?.colliders?.get?.(bodyId) : null;
    if (!actor || !adapter || !site || !target || !collider || !target.currentWorldCenter || !(target.radiusWorld > 0)) {
      return this.recordOperation('strikeSelectedSite', { accepted: false, probe, reason: 'The selected site has no current production target pose or safe semantic collider path.' });
    }
    const worldDirection = target.currentWorldPreferredDirection?.clone?.() ?? new THREE.Vector3(0, 0, -1);
    if (worldDirection.lengthSq() < 1e-8) worldDirection.set(0, 0, -1);
    worldDirection.normalize();
    const tangent = new THREE.Vector3().crossVectors(worldDirection, Math.abs(worldDirection.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)).normalize();
    const probeDistance = probe === 'edge'
      ? target.radiusWorld * 0.96
      : probe === 'outside' ? target.radiusWorld + PROGRESSIVE_SITE_RADIUS_TOLERANCE_METERS + Math.max(0.012, target.radiusWorld * 0.15) : 0;
    const worldPoint = target.currentWorldCenter.clone().addScaledVector(tangent, probeDistance);
    const hit = actor.resolveHit(collider, worldPoint);
    if (!hit?.region) return this.recordOperation('strikeSelectedSite', { accepted: false, reason: `Could not resolve the ${bodyId} collider at the authored capture center.` });
    const result = actor.applyBluntImpact({
      hit,
      impact: {
        schema: BLUNT_IMPACT_SCHEMA,
        interactionId: `creature-lab-site-strike-${++this.impactSerial}`,
        targetingSource: 'creature_lab_probe',
        primitive: 'mace_head',
        classification: BLUNT_IMPACT_CLASSIFICATIONS.committedBlunt,
        worldPoint,
        worldNormal: worldDirection.clone().negate(),
        impactDirection: worldDirection,
        normalImpactSpeed: 4,
        tangentialSpeed: 0.3,
        estimatedImpulse: 21.6,
        estimatedEnergy: 43.2,
        loadProgress: 0.76,
        gesturePower: 0.7,
        impactRadiusEstimate: 0.11,
      },
    });
    const decision = this.getSiteTargeting()?.getDiagnostics?.().lastTargetingDecision ?? null;
    const actualSiteId = decision?.selectedSiteId ?? null;
    const expectedToResolve = probe !== 'outside';
    const probePassed = expectedToResolve ? actualSiteId === site.siteId : actualSiteId !== site.siteId;
    this.updateSiteMarkers();
    return this.recordOperation('strikeSelectedSite', {
      ...result,
      accepted: probePassed,
      probe,
      expectedSiteId: site.siteId,
      actualSiteId,
      expectedToResolve,
      probePassed,
      impactRegion: hit.regionId,
      distance: decision?.selectedDistance ?? decision?.candidates?.find?.((candidate) => candidate.siteId === site.siteId)?.distance ?? null,
      radius: target.radiusWorld,
    });
  }

  getAnimationActions() {
    if (!this.effectiveProfile) return [];
    const kinds = new Set(this.effectiveProfile.animationRuntimeKinds ?? []);
    return [
      { id: 'idle', label: 'Idle', enabled: true },
      { id: 'walk', label: 'Walk', enabled: kinds.has('WALK') },
      { id: 'hurt_left', label: 'Hurt Left', enabled: kinds.has('HURT_LEFT') },
      { id: 'hurt_right', label: 'Hurt Right', enabled: kinds.has('HURT_RIGHT') },
      { id: 'guard', label: 'Guard', enabled: [...kinds].some((kind) => kind.startsWith('MACE_GUARD_')) },
      { id: 'death', label: 'Death', enabled: kinds.has('DEATH') },
    ].filter((entry) => entry.enabled);
  }

  playAnimation(actionId) {
    const actor = this.actor;
    const animation = actor?.visualAdapter?.animationController;
    if (!actor || !animation || actor.lifeState !== 'alive') return this.recordOperation('animation', { accepted: false, reason: 'Animation testing requires a ready, living subject.' });
    let result = null;
    if (actionId === 'idle') {
      animation.reset();
      result = { accepted: true, animation: 'holding' };
    } else if (actionId === 'walk') {
      animation.reset();
      result = { accepted: animation.setMovement({ speed: this.effectiveProfile.walkReferenceSpeed, maximumSpeed: this.effectiveProfile.walkReferenceSpeed, walking: true }), animation: 'WALK' };
    } else if (actionId === 'hurt_left') result = animation.playHurt({ regionId: 'left_forearm' });
    else if (actionId === 'hurt_right') result = animation.playHurt({ regionId: 'right_forearm' });
    else if (actionId === 'guard') result = animation.playGuard({ side: 'right' });
    else if (actionId === 'death') return this.kill();
    return this.recordOperation('animation', result ? { accepted: true, actionId, ...result } : { accepted: false, actionId, reason: 'Animation role is unavailable or already active.' });
  }

  getDetachmentActions() {
    const supported = new Set(this.effectiveProfile?.activeDamageSegmentIds ?? []);
    return (this.selectedPack?.damage?.availableSegmentIds ?? []).map((segmentId) => ({
      segmentId,
      label: SEGMENT_LABELS[segmentId] ?? segmentId,
      availableInPack: true,
      supportedByRuntime: supported.has(segmentId),
    }));
  }

  detachSegment(segmentId) {
    const entry = this.getDetachmentActions().find((candidate) => candidate.segmentId === segmentId);
    if (!entry?.supportedByRuntime) return this.recordOperation('detachSegment', { accepted: false, segmentId, reason: 'Segment is available in the pack but unsupported by the current runtime.' });
    const side = segmentId.startsWith('left') ? -1 : 1;
    const yaw = this.actor?.visualRootYaw ?? this.actor?.spawnYaw ?? 0;
    const impulse = new THREE.Vector3(segmentId === 'head_neck' ? 0.35 : 0.22 * side, segmentId === 'head_neck' ? 1.05 : -0.08, segmentId === 'head_neck' ? 0.3 : 0.18)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const result = this.actor?.requestDetachment?.({
      segmentId,
      cause: 'creature_lab_panel',
      worldPoint: this.actor.getDetachmentWorldPoint(segmentId, new THREE.Vector3()),
      impulse,
      angularImpulse: new THREE.Vector3(0.12, 0.24 * side, -0.18 * side).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    }) ?? { accepted: false, segmentId, reason: 'actor-not-ready' };
    this.walkerController?.synchronizeFatalSegmentDetachment?.();
    return this.recordOperation('detachSegment', result);
  }

  kill() {
    const actor = this.actor;
    if (!actor || actor.lifeState !== 'alive') return this.recordOperation('kill', { accepted: false, reason: 'The current subject is not alive.' });
    const accepted = actor.requestFatalMaceHeadImpact?.({
      hit: { regionId: 'head' },
      impact: {
        worldPoint: actor.getBodyWorldPosition('head'),
        impactDirection: new THREE.Vector3(0, 0, -1),
      },
      damageApplied: 1,
      forgeDamage: { source: 'creature_lab_death_test' },
    }) === true;
    this.walkerController?.synchronizeAuthoredDeath?.();
    return this.recordOperation('kill', {
      accepted,
      deathAnimation: actor.visualAdapter?.animationController?.activeMetadata?.name ?? null,
    });
  }

  canRagdoll() {
    return Boolean(this.actor?.forceRagdoll && this.effectiveProfile?.authoredDeathAnimations !== true);
  }

  ragdoll() {
    if (!this.canRagdoll()) return this.recordOperation('ragdoll', { accepted: false, reason: 'This pack uses authored death animation authority; forced ragdoll is unavailable.' });
    return this.recordOperation('ragdoll', { accepted: this.actor.forceRagdoll() === true });
  }

  getViewState() {
    return {
      loading: this.loading,
      presets: this.presetOptions.map(({ preset: _preset, resolved: _resolved, ...entry }) => entry),
      definitions: this.definitionOptions.map(({ descriptor: _descriptor, definition: _definition, resolved: _resolved, profile: _profile, ...entry }) => entry),
      selectedPresetId: this.selectedPreset?.presetId ?? null,
      selectedDefinitionId: this.selectedDefinition?.definitionId ?? null,
      selectedPackId: this.selectedPack?.packId ?? null,
      selectedDisplayName: this.selectedPreset?.displayName ?? this.selectedDefinition?.displayName ?? 'None',
      selectedSiteId: this.selectedSiteId,
      showSites: this.showSites,
      showSelectedRadius: this.showSelectedRadius,
      sites: this.getProgressiveSites(),
      animationActions: this.getAnimationActions(),
      detachmentActions: this.getDetachmentActions(),
      ragdollAvailable: this.canRagdoll(),
      definition: this.selectedDefinition,
      pack: this.selectedPack,
      profile: this.effectiveProfile,
      weapons: this.weaponOptions.map((weapon) => ({
        weaponId: weapon.weaponId,
        displayName: weapon.displayName,
        assetPath: weapon.assetPath,
        weaponClass: weapon.weaponClass,
      })),
      selectedWeaponId: this.selectedWeaponId,
      weaponCalibration: this.weaponCalibration ? structuredClone(this.weaponCalibration) : null,
      weaponCalibrationReadout: this.getWeaponCalibrationReadout(),
      productionWeaponCalibrationReadout: this.productionWeaponDefinition
        ? labCalibrationToWeaponDefinitionPatch(this.productionWeaponDefinition, weaponDefinitionToLabCalibration(this.productionWeaponDefinition))
        : null,
      productionCreatureHeight: this.getProductionTargetHeight(),
      resultingCreatureHeight: this.effectiveProfile?.targetHeight ?? null,
      creatureHeightOverride: this.creatureHeightOverride,
      calibrationContext: this.calibrationContext ? { ...this.calibrationContext } : null,
      hasUnsavedLabDraft: this.hasUnsavedLabDraft(),
      enemyPresetRecord: this.getEnemyPresetRecord(),
      enemyPresetJson: this.getEnemyPresetJson(),
      lastOperation: this.lastOperation,
      lastPhysicalTargetingDecision: this.getSiteTargeting()?.getDiagnostics?.().lastPhysicalTargetingDecision ?? null,
      offensiveCombat: this.attackHarness?.getDiagnostics?.() ?? { enabled: false },
    };
  }

  getDiagnostics() {
    const actorDiagnostics = this.actor?.getDiagnostics?.() ?? null;
    const deformation = actorDiagnostics?.damageAsset?.deformation
      ?? actorDiagnostics?.dismemberment?.deformation
      ?? null;
    const siteStates = deformation?.progressiveSites ?? {};
    const nativeSiteCount = this.getProgressiveSites().filter((site) => site.authority === 'NATIVE').length;
    const compatibilitySiteCount = this.getProgressiveSites().filter((site) => site.authority === 'COMPATIBILITY').length;
    return {
      enabled: true,
      selectedPreset: this.selectedPreset?.presetId ?? null,
      selectedDefinition: this.selectedDefinition?.definitionId ?? null,
      selectedPack: this.selectedPack?.packId ?? null,
      selectedDisplayName: this.selectedPreset?.displayName ?? this.selectedDefinition?.displayName ?? null,
      effectiveCreatureDefinition: summarizeCreatureDefinition(this.selectedDefinition),
      effectiveProfileName: this.effectiveProfile?.name ?? null,
      productionCreatureHeight: this.getProductionTargetHeight(),
      resultingCreatureHeight: this.effectiveProfile?.targetHeight ?? null,
      creatureHeightOverride: this.creatureHeightOverride,
      selectedWeaponId: this.selectedWeaponId,
      weaponCalibration: this.getWeaponCalibrationReadout(),
      calibrationContext: this.calibrationContext,
      hasUnsavedLabDraft: this.hasUnsavedLabDraft(),
      enemyPresetRecord: this.getEnemyPresetRecord(),
      actorInstanceId: this.actor?.instanceId ?? null,
      actorLifeState: this.actor?.lifeState ?? null,
      activeAnimation: actorDiagnostics?.visualAdapter?.animation?.activeAnimation
        ?? actorDiagnostics?.visualAdapter?.animation?.holdingPose
        ?? null,
      nativeSiteCount,
      compatibilitySiteCount,
      selectedSiteId: this.selectedSiteId,
      progressiveSites: siteStates,
      progressiveTargeting: deformation?.progressiveTargeting ?? this.getSiteTargeting()?.getDiagnostics?.() ?? null,
      deformationRuntime: deformation ? {
        enabled: deformation.enabled,
        schema: deformation.schema,
        authoringVersion: deformation.authoringVersion,
        progressiveSiteSource: deformation.progressiveSiteSource,
      } : null,
      activeGoreCount: deformation?.visibleGoreNodes?.length ?? 0,
      activeStainCount: deformation?.visibleSurfaceStainNodes?.length ?? 0,
      activeDetachableSegments: actorDiagnostics?.dismemberment?.detachedSegments ?? [],
      colliderCount: (this.actor?.colliders?.size ?? 0) + (actorDiagnostics?.dismemberment?.detachedColliderCount ?? 0),
      packCost: this.selectedPack?.cost ?? null,
      definitionSupport: this.definitionOptions.map(({ definitionId, displayName, creaturePackId, supported, code, reason }) => ({ definitionId, displayName, creaturePackId, supported, code, reason })),
      presetSupport: this.presetOptions.map(({ presetId, displayName, creatureDefinitionId, supported, code, reason }) => ({ presetId, displayName, creatureDefinitionId, supported, code, reason })),
      lastOperation: this.lastOperation,
      offensiveCombat: this.attackHarness?.getDiagnostics?.() ?? { enabled: false },
    };
  }

  update(deltaSeconds = 1 / 60) {
    this.attackHarness?.update?.(deltaSeconds);
    this.siteMarkerRenderer?.update?.();
    this.panel?.update?.();
  }

  installDebugCommands() {
    if (import.meta.env?.DEV !== true || typeof globalThis === 'undefined') return;
    this.debugCommands = Object.freeze({
      selectPreset: (presetId) => this.selectPreset(presetId),
      selectDefinition: (definitionId) => this.selectDefinition(definitionId),
      selectPack: (packId) => this.selectPack(packId),
      respawn: () => this.respawn(),
      resetDamage: () => this.resetDamage(),
      selectSite: (siteId) => this.selectSite(siteId),
      strikeSelectedSite: (probe = 'center') => this.strikeSelectedSite(probe),
      triggerAttack: () => this.triggerAttack(),
      equipArmament: () => this.equipArmament(),
      unequipArmament: () => this.unequipArmament(),
      selectOffensiveAction: (combatActionId) => this.selectOffensiveAction(combatActionId),
      selectWeapon: (weaponId) => this.selectWeapon(weaponId),
      setWeaponCalibrationField: (field, value) => this.setWeaponCalibrationField(field, value, { notify: true }),
      resetWeaponCalibration: () => this.resetWeaponCalibration(),
      resetToPresetDefaults: () => this.resetToPresetDefaults(),
      copyEnemyPresetJson: () => this.getEnemyPresetJson(),
      setCreatureHeight: (height) => this.setCreatureHeight(height),
      resetCreatureHeight: () => this.resetCreatureHeight(),
      resetPlayer: () => this.resetPlayer(),
      toggleAttackGeometry: () => this.toggleAttackGeometry(),
      diagnostics: () => this.getDiagnostics(),
    });
    globalThis.__DSB_CREATURE_LAB__ = this.debugCommands;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.selectionSerial += 1;
    this.panel?.dispose?.();
    this.panel = null;
    this.attackHarness?.dispose?.();
    this.attackHarness = null;
    this.disposeSiteMarkers();
    if (this.actor) this.walkerController.disposeWalker({ respawn: false });
    this.onSubjectChanged?.(this.getSubjectState());
    this.listeners.clear();
    if (globalThis.__DSB_CREATURE_LAB__ === this.debugCommands) delete globalThis.__DSB_CREATURE_LAB__;
    this.debugCommands = null;
  }
}
