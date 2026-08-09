import * as THREE from 'three';
import { HumanoidCombatActor } from '../combat/HumanoidCombatActor.js';
import { BLUNT_IMPACT_CLASSIFICATIONS, BLUNT_IMPACT_SCHEMA } from '../combat/weapons/BluntImpactInteraction.js';
import { CreatureLabPanel } from './CreatureLabPanel.js';
import { CreaturePackRegistry } from './CreaturePackRegistry.js';
import {
  assessCreaturePackRuntimeSupport,
  composeHumanoidCreatureRuntimeProfile,
  getCreatureRuntimePolicy,
  summarizeCreatureRuntimePolicy,
} from './CreatureRuntimePolicies.js';

const DEFAULT_PACK_ID = 'chezwick_damage_v001';
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

export function resolveCreatureLabMode(query = new URLSearchParams(), { development = import.meta.env?.DEV === true } = {}) {
  return development === true && query?.get?.(CREATURE_LAB_QUERY_KEY) === '1';
}

export class CreatureLabController {
  constructor({
    registry = new CreaturePackRegistry(),
    walkerController,
    combatRouter = null,
    playerProvider = null,
    weaponControllerProvider = null,
    onSubjectChanged = null,
    initialPackId = DEFAULT_PACK_ID,
    panelFactory = (options) => new CreatureLabPanel(options),
  } = {}) {
    if (!walkerController) throw new Error('Creature Lab requires one isolated walker lifecycle host.');
    this.registry = registry;
    this.walkerController = walkerController;
    this.combatRouter = combatRouter;
    this.playerProvider = playerProvider;
    this.weaponControllerProvider = weaponControllerProvider;
    this.onSubjectChanged = onSubjectChanged;
    this.initialPackId = initialPackId;
    this.panelFactory = panelFactory;
    this.packOptions = [];
    this.selectedPack = null;
    this.selectedPolicy = null;
    this.effectiveProfile = null;
    this.selectedSiteId = null;
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
    const summaries = await this.registry.listPacks();
    this.packOptions = await Promise.all(summaries.map(async (summary) => {
      try {
        const descriptor = await this.registry.loadPack(summary.packId);
        const policy = getCreatureRuntimePolicy(summary.packId);
        const support = assessCreaturePackRuntimeSupport(descriptor, policy);
        return { ...summary, descriptor, policy, ...support };
      } catch (error) {
        return { ...summary, descriptor: null, policy: null, supported: false, code: error.code ?? 'DESCRIPTOR_LOAD_FAILED', reason: error.message };
      }
    }));
    const requested = this.packOptions.find((entry) => entry.packId === this.initialPackId && entry.supported);
    const initial = requested ?? this.packOptions.find((entry) => entry.supported) ?? null;
    if (initial) await this.selectPack(initial.packId);
    else this.recordOperation('initialize', { accepted: false, reason: 'No registered Creature Pack is supported by the current humanoid runtime.' });
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

  async selectPack(packId) {
    if (this.disposed) return { accepted: false, reason: 'Creature Lab is disposed.' };
    const option = this.packOptions.find((entry) => entry.packId === packId);
    if (!option) return this.recordOperation('selectPack', { accepted: false, reason: `Unknown registered pack ${packId}.` });
    if (!option.supported) return this.recordOperation('selectPack', { accepted: false, reason: option.reason, code: option.code });
    const serial = ++this.selectionSerial;
    this.loading = true;
    this.notify();
    try {
      const descriptor = option.descriptor ?? await this.registry.loadPack(packId);
      const policy = option.policy ?? getCreatureRuntimePolicy(packId);
      const profile = composeHumanoidCreatureRuntimeProfile(descriptor, policy);
      this.weaponControllerProvider?.()?.cancel?.('creature-lab-pack-switch');
      if (this.actor) this.walkerController.disposeWalker({ respawn: false });
      this.selectedPack = descriptor;
      this.selectedPolicy = policy;
      this.effectiveProfile = profile;
      this.selectedSiteId = null;
      this.walkerController.actorFactory = (options) => new HumanoidCombatActor({ ...options, visualProfile: profile });
      this.walkerController.enabled = true;
      this.walkerController.pauseLocomotion = true;
      const spawned = this.walkerController.reset(this.playerProvider?.());
      this.onSubjectChanged?.(this.getSubjectState());
      if (!spawned || !this.actor) throw new Error(`Creature Lab could not find a safe Folsom spawn for ${packId}.`);
      await this.actor.visualAdapter?.ready;
      if (serial !== this.selectionSerial || this.disposed) return { accepted: false, reason: 'Pack selection was superseded.' };
      this.selectedSiteId = this.getProgressiveSites()[0]?.siteId ?? null;
      this.onSubjectChanged?.(this.getSubjectState());
      return this.recordOperation('selectPack', { accepted: true, packId, actorInstanceId: this.actor.instanceId });
    } catch (error) {
      if (serial === this.selectionSerial && this.actor) this.walkerController.disposeWalker({ respawn: false });
      this.onSubjectChanged?.(this.getSubjectState());
      return this.recordOperation('selectPack', null, error);
    } finally {
      if (serial === this.selectionSerial) this.loading = false;
      this.notify();
    }
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
    if (!this.selectedPack) return this.recordOperation('respawn', { accepted: false, reason: 'No supported pack is selected.' });
    return this.selectPack(this.selectedPack.packId);
  }

  resetDamage() {
    const accepted = this.walkerController?.resetActorDamage?.() === true;
    this.onSubjectChanged?.(this.getSubjectState());
    return this.recordOperation('resetDamage', {
      accepted,
      reason: accepted ? null : 'Damage reset is available only while the current subject is alive; use Respawn after death.',
    });
  }

  getProgressiveSites() {
    return this.actor?.visualAdapter?.listProgressiveDamageSites?.() ?? [];
  }

  selectSite(siteId) {
    const site = this.getProgressiveSites().find((entry) => entry.siteId === siteId);
    if (!site) return this.recordOperation('selectSite', { accepted: false, reason: `Progressive site ${siteId} is unavailable.` });
    this.selectedSiteId = site.siteId;
    return this.recordOperation('selectSite', { accepted: true, siteId: site.siteId, authority: site.authority });
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

  strikeSelectedSite() {
    const actor = this.actor;
    const adapter = actor?.visualAdapter;
    const site = this.getProgressiveSites().find((entry) => entry.siteId === this.selectedSiteId);
    const bodyId = this.resolveSiteStrikeBodyId(site);
    const collider = bodyId ? actor?.colliders?.get?.(bodyId) : null;
    if (!actor || !adapter || !site || !collider || !Array.isArray(site.captureCenterLocal)) {
      return this.recordOperation('strikeSelectedSite', { accepted: false, reason: 'The selected site has no safe authored strike path in the current humanoid runtime.' });
    }
    const worldPoint = adapter.actorLocalToWorld(new THREE.Vector3().fromArray(site.captureCenterLocal));
    const hit = actor.resolveHit(collider, worldPoint);
    if (!hit?.region) return this.recordOperation('strikeSelectedSite', { accepted: false, reason: `Could not resolve the ${bodyId} collider at the authored capture center.` });
    const preferredLocal = new THREE.Vector3().fromArray(site.preferredDirectionLocal ?? [0, 0, -1]);
    if (preferredLocal.lengthSq() < 1e-8) preferredLocal.set(0, 0, -1);
    const rootQuaternion = adapter.getActorCoordinateRoot()?.getWorldQuaternion?.(new THREE.Quaternion()) ?? new THREE.Quaternion();
    const worldDirection = preferredLocal.normalize().applyQuaternion(rootQuaternion).normalize();
    const result = actor.applyBluntImpact({
      hit,
      impact: {
        schema: BLUNT_IMPACT_SCHEMA,
        interactionId: `creature-lab-site-strike-${++this.impactSerial}`,
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
    return this.recordOperation('strikeSelectedSite', result);
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
      packs: this.packOptions.map(({ descriptor: _descriptor, policy: _policy, ...entry }) => entry),
      selectedPackId: this.selectedPack?.packId ?? null,
      selectedDisplayName: this.selectedPack?.displayName ?? 'None',
      selectedSiteId: this.selectedSiteId,
      sites: this.getProgressiveSites(),
      animationActions: this.getAnimationActions(),
      detachmentActions: this.getDetachmentActions(),
      ragdollAvailable: this.canRagdoll(),
      pack: this.selectedPack,
      profile: this.effectiveProfile,
      lastOperation: this.lastOperation,
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
      selectedPack: this.selectedPack?.packId ?? null,
      selectedDisplayName: this.selectedPack?.displayName ?? null,
      effectiveRuntimePolicy: summarizeCreatureRuntimePolicy(this.selectedPolicy),
      effectiveProfileName: this.effectiveProfile?.name ?? null,
      actorInstanceId: this.actor?.instanceId ?? null,
      actorLifeState: this.actor?.lifeState ?? null,
      activeAnimation: actorDiagnostics?.visualAdapter?.animation?.activeAnimation
        ?? actorDiagnostics?.visualAdapter?.animation?.holdingPose
        ?? null,
      nativeSiteCount,
      compatibilitySiteCount,
      selectedSiteId: this.selectedSiteId,
      progressiveSites: siteStates,
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
      packSupport: this.packOptions.map(({ packId, displayName, supported, code, reason }) => ({ packId, displayName, supported, code, reason })),
      lastOperation: this.lastOperation,
    };
  }

  update() {
    this.panel?.update?.();
  }

  installDebugCommands() {
    if (import.meta.env?.DEV !== true || typeof globalThis === 'undefined') return;
    this.debugCommands = Object.freeze({
      selectPack: (packId) => this.selectPack(packId),
      respawn: () => this.respawn(),
      resetDamage: () => this.resetDamage(),
      selectSite: (siteId) => this.selectSite(siteId),
      strikeSelectedSite: () => this.strikeSelectedSite(),
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
    if (this.actor) this.walkerController.disposeWalker({ respawn: false });
    this.onSubjectChanged?.(this.getSubjectState());
    this.listeners.clear();
    if (globalThis.__DSB_CREATURE_LAB__ === this.debugCommands) delete globalThis.__DSB_CREATURE_LAB__;
    this.debugCommands = null;
  }
}
