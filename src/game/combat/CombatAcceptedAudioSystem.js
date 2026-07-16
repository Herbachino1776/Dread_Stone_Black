import * as THREE from 'three';
import { getAudioCue } from '../audio/audioCueManifest.js';

const MAX_DIAGNOSTIC_COUNT = 1_000_000;
const ACCEPTED_STAB_VOICE_GROUP = 'accepted-combat-stab';
const ACCEPTED_DEATH_VOICE_GROUP = 'accepted-male-death-sigh';
const RECENT_PUNCTURE_WINDOW_SECONDS = 0.75;
const NON_PUNCTURE_DEATH_DELAY_MAX_SECONDS = 0.08;

export const MALE_HUMAN_VOICE_PROFILE = 'male_human';
export const FLESH_STAB_POOL_ID = 'flesh_stab';
export const LETHAL_STAB_DEATH_DELAY_RANGE_SECONDS = Object.freeze([0.09, 0.18]);

export const FLESH_STAB_CUE_IDS = Object.freeze([
  'audio_system_combat_sword_stab_flesh_01_oneshot',
  'audio_system_combat_sword_stab_flesh_02_oneshot',
  'audio_system_combat_sword_stab_flesh_03_oneshot',
  'audio_system_combat_sword_stab_flesh_04_oneshot',
  'audio_system_combat_sword_stab_flesh_05_oneshot',
  'audio_system_combat_sword_stab_flesh_06_oneshot',
]);

export const MALE_HUMAN_DEATH_SIGH_CUE_IDS = Object.freeze([
  'audio_system_combat_male_death_sigh_01_oneshot',
  'audio_system_combat_male_death_sigh_02_oneshot',
  'audio_system_combat_male_death_sigh_03_oneshot',
  'audio_system_combat_male_death_sigh_04_oneshot',
  'audio_system_combat_male_death_sigh_05_oneshot',
  'audio_system_combat_male_death_sigh_06_oneshot',
  'audio_system_combat_male_death_sigh_07_oneshot',
  'audio_system_combat_male_death_sigh_08_oneshot',
  'audio_system_combat_male_death_sigh_09_oneshot',
  'audio_system_combat_male_death_sigh_10_oneshot',
  'audio_system_combat_male_death_sigh_11_oneshot',
  'audio_system_combat_male_death_sigh_12_oneshot',
]);

export function createPiercingAudioProfile(overrides = {}) {
  return Object.freeze({
    enabled: true,
    pool: FLESH_STAB_POOL_ID,
    volumeMultiplier: 1,
    playbackRate: 1,
    ...overrides,
  });
}

export const DREADSTONE_SWORD_PIERCING_AUDIO_PROFILE = createPiercingAudioProfile();
export const OLD_WORK_KNIFE_PIERCING_AUDIO_PROFILE = createPiercingAudioProfile({ volumeMultiplier: 0.85, playbackRate: 1.04 });

export function selectNonRepeatingCue(cueIds, previousCueId = null, random = Math.random) {
  if (!Array.isArray(cueIds) || cueIds.length === 0) return null;
  if (cueIds.length === 1) return cueIds[0];
  const eligible = previousCueId == null ? cueIds : cueIds.filter((cueId) => cueId !== previousCueId);
  const value = Math.max(0, Math.min(0.999999999, Number(random?.()) || 0));
  return eligible[Math.floor(value * eligible.length)] ?? eligible[0];
}

function createActorAudioState(actor) {
  return {
    actor,
    actorId: actor?.instanceId ?? actor?.id ?? null,
    voiceProfile: actor?.visualProfile?.voiceProfile ?? actor?.voiceProfile ?? null,
    injuryVoicePlayed: false,
    deathSighPlayed: false,
    deathSighScheduled: false,
    deathStateCommitted: false,
    restoredDeadFromSave: false,
    lastAcceptedStabPlaybackTime: null,
    lastAcceptedStabInteractionId: null,
  };
}

function isTerminalState(state) {
  return state === 'dying' || state === 'dead';
}

function finitePosition(position) {
  return Boolean(position && [position.x, position.y, position.z].every(Number.isFinite));
}

export class CombatAcceptedAudioSystem {
  constructor({ audioRuntime = null, random = Math.random, maximumDeathVoices = 3 } = {}) {
    this.audioRuntime = audioRuntime;
    this.random = random;
    this.maximumDeathVoices = Math.max(1, Math.floor(maximumDeathVoices));
    this.time = 0;
    this.pendingDelayedCues = [];
    this.actorStates = new Map();
    this.lastStabCueId = null;
    this.lastDeathCueId = null;
    this.disposed = false;
    this.clearDiagnostics();
  }

  clearDiagnostics() {
    this.diagnostics = {
      registeredStabCueCount: FLESH_STAB_CUE_IDS.filter((cueId) => getAudioCue(cueId)).length,
      registeredDeathCueCount: MALE_HUMAN_DEATH_SIGH_CUE_IDS.filter((cueId) => getAudioCue(cueId)).length,
      stabEmissionCount: 0,
      stabSuppressedRepeatCount: 0,
      stabCorpseSuppressionCount: 0,
      stabLastCueId: null,
      stabLastWeaponId: null,
      stabLastActorId: null,
      deathSighScheduledCount: 0,
      deathSighEmissionCount: 0,
      deathSighDuplicateSuppressionCount: 0,
      restoredCorpseSuppressionCount: 0,
      offscreenDeathPlaybackCount: 0,
      deathSighLastCueId: null,
      deathSighLastActorId: null,
    };
  }

  increment(key) {
    this.diagnostics[key] = Math.min(MAX_DIAGNOSTIC_COUNT, (this.diagnostics[key] ?? 0) + 1);
  }

  canRequestCue(cueId) {
    return Boolean(!this.disposed && this.audioRuntime?.play3D && getAudioCue(cueId) && (this.audioRuntime.hasCue?.(cueId) ?? true));
  }

  ownsFleshStabProfile(weaponProfile) {
    const profile = weaponProfile?.piercingAudio;
    return Boolean(profile?.enabled === true && profile.pool === FLESH_STAB_POOL_ID && FLESH_STAB_CUE_IDS.some((cueId) => this.canRequestCue(cueId)));
  }

  registerActor(actor) {
    if (!actor) return null;
    const actorId = actor.instanceId ?? actor.id;
    if (!actorId) return null;
    const existing = this.actorStates.get(actorId);
    if (existing?.actor === actor) {
      existing.voiceProfile = actor.visualProfile?.voiceProfile ?? actor.voiceProfile ?? existing.voiceProfile;
      actor.acceptedCombatAudioState = existing;
      return existing;
    }
    const state = createActorAudioState(actor);
    this.actorStates.set(actorId, state);
    actor.acceptedCombatAudioState = state;
    return state;
  }

  getActorState(actor) {
    return this.registerActor(actor);
  }

  confirmFleshPenetration({ actor, wound, interactionId, weaponProfile, penetrationAudioGate = null, position = null } = {}) {
    const state = this.getActorState(actor);
    const piercingAudio = weaponProfile?.piercingAudio;
    const validIntent = wound?.surfaceRuptured === true && wound?.deliberateStab === true;
    if (!state || !validIntent || piercingAudio?.enabled !== true || piercingAudio.pool !== FLESH_STAB_POOL_ID) return false;
    if (actor.lifeState === 'dead' || state.restoredDeadFromSave) {
      this.increment('stabCorpseSuppressionCount');
      if (state.restoredDeadFromSave) this.increment('restoredCorpseSuppressionCount');
      return false;
    }
    const emit = () => {
      const availableCueIds = FLESH_STAB_CUE_IDS.filter((cueId) => this.canRequestCue(cueId));
      const cueId = selectNonRepeatingCue(availableCueIds, this.lastStabCueId, this.random);
      if (!cueId) return false;
      const emitterPosition = finitePosition(position) ? position : this.resolveActorEmitterPosition(actor);
      if (!finitePosition(emitterPosition)) return false;
      this.lastStabCueId = cueId;
      state.lastAcceptedStabPlaybackTime = this.time;
      state.lastAcceptedStabInteractionId = interactionId;
      this.increment('stabEmissionCount');
      this.diagnostics.stabLastCueId = cueId;
      this.diagnostics.stabLastWeaponId = weaponProfile?.id ?? null;
      this.diagnostics.stabLastActorId = state.actorId;
      this.requestPlayback(cueId, emitterPosition, {
        owner: state.actorId,
        voiceGroup: ACCEPTED_STAB_VOICE_GROUP,
        maximumVoices: 8,
        cancellable: true,
        volume: piercingAudio.volumeMultiplier,
        playbackRate: piercingAudio.playbackRate,
      });
      return true;
    };
    if (penetrationAudioGate) {
      const before = penetrationAudioGate.suppressedRepeatCount ?? 0;
      const accepted = penetrationAudioGate.tryEmit(interactionId, emit);
      const added = Math.max(0, (penetrationAudioGate.suppressedRepeatCount ?? 0) - before);
      this.diagnostics.stabSuppressedRepeatCount = Math.min(MAX_DIAGNOSTIC_COUNT, this.diagnostics.stabSuppressedRepeatCount + added);
      return accepted;
    }
    if (state.lastAcceptedStabInteractionId === interactionId) {
      this.increment('stabSuppressedRepeatCount');
      return false;
    }
    return emit();
  }

  handleLifeStateTransition(actor, { previousState, nextState, restored = false } = {}) {
    const state = this.getActorState(actor);
    if (!state) return false;
    if (restored) {
      this.markRestoredLifeState(actor, nextState);
      return false;
    }
    const firstTerminalCommit = isTerminalState(nextState) && ['alive', 'incapacitated'].includes(previousState);
    if (!firstTerminalCommit) {
      if (isTerminalState(nextState) && (state.deathSighScheduled || state.deathSighPlayed)) this.increment('deathSighDuplicateSuppressionCount');
      return false;
    }
    state.deathStateCommitted = true;
    if (state.restoredDeadFromSave) {
      this.increment('restoredCorpseSuppressionCount');
      return false;
    }
    if (state.voiceProfile !== MALE_HUMAN_VOICE_PROFILE) return false;
    if (state.deathSighScheduled || state.deathSighPlayed) {
      this.increment('deathSighDuplicateSuppressionCount');
      return false;
    }
    if (!MALE_HUMAN_DEATH_SIGH_CUE_IDS.some((cueId) => this.canRequestCue(cueId))) return false;
    const sinceStab = state.lastAcceptedStabPlaybackTime == null ? Infinity : this.time - state.lastAcceptedStabPlaybackTime;
    const followsRecentPuncture = sinceStab >= 0 && sinceStab <= RECENT_PUNCTURE_WINDOW_SECONDS;
    const delay = followsRecentPuncture
      ? LETHAL_STAB_DEATH_DELAY_RANGE_SECONDS[0] + this.sampleRandom() * (LETHAL_STAB_DEATH_DELAY_RANGE_SECONDS[1] - LETHAL_STAB_DEATH_DELAY_RANGE_SECONDS[0])
      : this.sampleRandom() * NON_PUNCTURE_DEATH_DELAY_MAX_SECONDS;
    const dueTime = followsRecentPuncture
      ? Math.max(this.time, state.lastAcceptedStabPlaybackTime + delay)
      : this.time + delay;
    state.deathSighScheduled = true;
    this.pendingDelayedCues.push({ actor, actorId: state.actorId, dueTime, scheduledAt: this.time, followsRecentPuncture });
    this.pendingDelayedCues.sort((a, b) => a.dueTime - b.dueTime);
    this.increment('deathSighScheduledCount');
    return true;
  }

  shouldSuppressSynthesizedDeathVocal(actor, event) {
    const state = this.getActorState(actor);
    if (!state || state.voiceProfile !== MALE_HUMAN_VOICE_PROFILE) return false;
    if (!['shock_gasp', 'unconscious', 'final_exhale'].includes(event)) return false;
    return state.deathSighScheduled || state.deathSighPlayed;
  }

  sampleRandom() {
    return Math.max(0, Math.min(0.999999999, Number(this.random?.()) || 0));
  }

  requestPlayback(cueId, position, options) {
    try {
      const result = this.audioRuntime.play3D(cueId, position, options);
      result?.catch?.(() => {});
    } catch {}
  }

  update(deltaSeconds) {
    if (this.disposed) return;
    this.time += Math.max(0, Number(deltaSeconds) || 0);
    while (this.pendingDelayedCues.length && this.pendingDelayedCues[0].dueTime <= this.time + 1e-7) {
      this.playScheduledDeathSigh(this.pendingDelayedCues.shift());
    }
  }

  playScheduledDeathSigh(event) {
    const state = this.actorStates.get(event.actorId);
    if (!state || state.actor !== event.actor || state.restoredDeadFromSave || !state.deathStateCommitted || state.deathSighPlayed) return false;
    const position = this.resolveActorEmitterPosition(event.actor);
    state.deathSighScheduled = false;
    const availableCueIds = MALE_HUMAN_DEATH_SIGH_CUE_IDS.filter((cueId) => this.canRequestCue(cueId));
    const cueId = selectNonRepeatingCue(availableCueIds, this.lastDeathCueId, this.random);
    if (!finitePosition(position) || !cueId) return false;
    state.deathSighPlayed = true;
    this.lastDeathCueId = cueId;
    this.increment('deathSighEmissionCount');
    if (event.actor.root?.visible === false) this.increment('offscreenDeathPlaybackCount');
    this.diagnostics.deathSighLastCueId = cueId;
    this.diagnostics.deathSighLastActorId = event.actorId;
    this.requestPlayback(cueId, position, {
      owner: event.actorId,
      voiceGroup: ACCEPTED_DEATH_VOICE_GROUP,
      maximumVoices: this.maximumDeathVoices,
      cancellable: true,
      positionProvider: () => this.resolveActorEmitterPosition(event.actor),
    });
    return true;
  }

  resolveActorEmitterPosition(actor) {
    if (!actor) return null;
    const headAvailable = actor.isSemanticBodyDetached?.('head') !== true;
    const head = headAvailable ? actor.getBodyWorldPosition?.('head') : null;
    if (finitePosition(head)) return head;
    const upperBody = actor.getBodyWorldPosition?.('upper_chest');
    if (finitePosition(upperBody)) return upperBody;
    const root = actor.root?.getWorldPosition?.(new THREE.Vector3());
    if (finitePosition(root)) return root;
    return finitePosition(actor.root?.position) ? actor.root.position : null;
  }

  cancelActor(actor, { stopVoices = true } = {}) {
    const actorId = actor?.instanceId ?? actor?.id;
    if (!actorId) return;
    this.pendingDelayedCues = this.pendingDelayedCues.filter((entry) => entry.actorId !== actorId);
    const state = this.actorStates.get(actorId);
    if (state) state.deathSighScheduled = false;
    if (stopVoices) this.audioRuntime?.stopOneShotsByOwner?.(actorId, { voiceGroup: ACCEPTED_DEATH_VOICE_GROUP });
  }

  resetActor(actor) {
    const actorId = actor?.instanceId ?? actor?.id;
    if (!actorId) return null;
    this.cancelActor(actor);
    const state = createActorAudioState(actor);
    this.actorStates.set(actorId, state);
    actor.acceptedCombatAudioState = state;
    return state;
  }

  markRestoredLifeState(actor, lifeState) {
    const state = this.resetActor(actor);
    if (!state) return false;
    state.restoredDeadFromSave = lifeState === 'dead';
    state.deathStateCommitted = lifeState === 'dead';
    if (state.restoredDeadFromSave) this.increment('restoredCorpseSuppressionCount');
    return true;
  }

  unregisterActor(actor) {
    const actorId = actor?.instanceId ?? actor?.id;
    if (!actorId) return;
    this.cancelActor(actor);
    this.audioRuntime?.stopOneShotsByOwner?.(actorId, { voiceGroup: ACCEPTED_STAB_VOICE_GROUP });
    this.actorStates.delete(actorId);
    if (actor.acceptedCombatAudioState) actor.acceptedCombatAudioState = null;
  }

  reset() {
    this.pendingDelayedCues = [];
    this.actorStates.forEach(({ actor }) => {
      this.audioRuntime?.stopOneShotsByOwner?.(actor?.instanceId ?? actor?.id, { voiceGroup: ACCEPTED_DEATH_VOICE_GROUP });
      this.resetActor(actor);
    });
    this.time = 0;
    this.lastStabCueId = null;
    this.lastDeathCueId = null;
    this.clearDiagnostics();
  }

  getDiagnostics({ actor = null, penetrationAudioGate = null } = {}) {
    const state = actor ? this.getActorState(actor) : null;
    const gate = penetrationAudioGate?.getDiagnostics?.() ?? null;
    return {
      ...this.diagnostics,
      penetrationAudioArmed: gate?.penetrationAudioArmed ?? null,
      penetrationAudioRearmCount: gate?.rearmCount ?? 0,
      pendingDelayedCueCount: this.pendingDelayedCues.length,
      activeAcceptedVoiceCount: this.audioRuntime?.getActiveOneShotCount?.(ACCEPTED_DEATH_VOICE_GROUP) ?? 0,
      voiceProfile: state?.voiceProfile ?? null,
      injuryVoicePlayed: state?.injuryVoicePlayed ?? false,
      deathSighPlayed: state?.deathSighPlayed ?? false,
      deathSighScheduled: state?.deathSighScheduled ?? false,
      deathStateCommitted: state?.deathStateCommitted ?? false,
      restoredDeadFromSave: state?.restoredDeadFromSave ?? false,
      lastAcceptedStabPlaybackTime: state?.lastAcceptedStabPlaybackTime ?? null,
      lastAcceptedStabInteractionId: state?.lastAcceptedStabInteractionId ?? null,
    };
  }

  dispose() {
    if (this.disposed) return;
    [...this.actorStates.values()].forEach(({ actor }) => this.unregisterActor(actor));
    this.pendingDelayedCues = [];
    this.actorStates.clear();
    this.disposed = true;
  }
}
