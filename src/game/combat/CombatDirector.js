import { isDamageIntent, MELEE_INTENTS } from './MeleeIntentWeapon.js';

export const PENETRATION_STAGES = Object.freeze({
  approach: 'approach',
  surfaceContact: 'surface_contact',
  surfaceCompression: 'surface_compression',
  surfaceRupture: 'surface_rupture',
  softTissue: 'soft_tissue',
  hardTissue: 'hard_tissue',
  embedded: 'embedded',
  withdrawal: 'withdrawal',
  exit: 'exit',
  recovery: 'recovery',
});

export const COMBAT_DIRECTOR_EVENTS = Object.freeze({
  lifecycle: 'lifecycle',
  tissue: 'tissue',
  wound: 'wound',
  reaction: 'reaction',
  blood: 'blood',
  audio: 'audio',
  camera: 'camera',
  haptic: 'haptic',
  resistance: 'resistance',
  recovery: 'recovery',
});

export const DEFAULT_MELEE_TIMELINE = Object.freeze({
  puncture: Object.freeze({ contact: 0.002, compression: 0.005, rupture: 0.008, tissue: 0.011, reaction: 0.014, audio: 0.019, blood: 0.026, camera: 0.032, haptic: 0.036, embedded: 0.044 }),
  slash: Object.freeze({ contact: 0.002, compression: 0.005, rupture: 0.009, tissue: 0.011, reaction: 0.014, audio: 0.02, blood: 0.028, camera: 0.034, haptic: 0.038, recovery: 0.075 }),
  extraction: Object.freeze({ withdrawal: 0, wound: 0.006, reaction: 0.012, blood: 0.02, audio: 0.025, haptic: 0.029, exit: 0.035, recovery: 0.08 }),
});

const roundTime = (value) => Math.round(value * 1e6) / 1e6;

export function resolveMeleeTimeline(kind, weapon = null) {
  const defaults = DEFAULT_MELEE_TIMELINE[kind];
  if (!defaults) throw new Error(`Unknown melee timeline kind: ${kind}`);
  const overrides = weapon?.timeline?.[kind] ?? {};
  const resolved = { ...defaults };
  Object.entries(overrides).forEach(([key, value]) => {
    if (!(key in defaults)) throw new Error(`Unknown ${kind} timeline offset: ${key}`);
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid ${kind} timeline offset ${key}: ${value}`);
    resolved[key] = value;
  });
  return Object.freeze(resolved);
}

export class CombatDirector {
  constructor({ actor = null, bloodEffects = null, feedbackSystem = null, cameraFeedback = null } = {}) {
    this.actor = actor;
    this.bloodEffects = bloodEffects;
    this.feedbackSystem = feedbackSystem;
    this.cameraFeedback = cameraFeedback;
    this.time = 0;
    this.nextInteractionId = 1;
    this.nextSequence = 1;
    this.queue = [];
    this.interactions = new Map();
    this.subscribers = new Map();
    this.eventLog = [];
    this.disposed = false;
    this.connectDefaultSubscribers();
  }

  subscribe(type, handler) {
    const listeners = this.subscribers.get(type) ?? new Set();
    listeners.add(handler);
    this.subscribers.set(type, listeners);
    return () => listeners.delete(handler);
  }

  setCameraFeedback(cameraFeedback) {
    this.cameraFeedback = cameraFeedback;
  }

  connectDefaultSubscribers() {
    this.subscribe(COMBAT_DIRECTOR_EVENTS.lifecycle, (event) => {
      event.interaction.stage = event.payload.stage;
      event.interaction.stageHistory.push({ stage: event.payload.stage, time: event.time });
    });
    this.subscribe(COMBAT_DIRECTOR_EVENTS.tissue, (event) => this.applyTissueEvent(event));
    this.subscribe(COMBAT_DIRECTOR_EVENTS.wound, (event) => this.applyWoundEvent(event));
    this.subscribe(COMBAT_DIRECTOR_EVENTS.reaction, (event) => this.applyReactionEvent(event));
    this.subscribe(COMBAT_DIRECTOR_EVENTS.blood, (event) => this.applyBloodEvent(event));
    this.subscribe(COMBAT_DIRECTOR_EVENTS.audio, (event) => this.feedbackSystem?.emitAudio?.(event.payload.cue, event.payload) ?? this.feedbackSystem?.emit?.(event.payload.cue, { ...event.payload, haptics: false }));
    this.subscribe(COMBAT_DIRECTOR_EVENTS.haptic, (event) => this.feedbackSystem?.emitCombatHaptic?.(event.payload.cue));
    this.subscribe(COMBAT_DIRECTOR_EVENTS.camera, (event) => this.cameraFeedback?.shake?.(event.payload));
    this.subscribe(COMBAT_DIRECTOR_EVENTS.resistance, (event) => {
      event.interaction.resistance = { ...event.payload, time: event.time };
      event.interaction.weaponAdapter?.onCombatResistance?.(event.payload, event.interaction);
    });
    this.subscribe(COMBAT_DIRECTOR_EVENTS.recovery, (event) => {
      event.interaction.completed = true;
      event.interaction.completedAt = event.time;
    });
  }

  createInteraction({ kind, weapon, intent, target, weaponAdapter = null } = {}) {
    if (!isDamageIntent(intent)) return null;
    if (kind === 'puncture' && intent.intent !== MELEE_INTENTS.stab) return null;
    if (kind === 'slash' && intent.intent !== MELEE_INTENTS.slash) return null;
    const id = `combat-${this.nextInteractionId++}`;
    const interaction = {
      id,
      kind,
      weapon: { id: weapon?.id ?? intent.weaponId ?? 'unknown_melee_weapon', family: weapon?.family ?? 'melee', profile: weapon ?? null },
      intent,
      target,
      weaponAdapter,
      startedAt: this.time,
      stage: PENETRATION_STAGES.approach,
      stageHistory: [],
      result: {},
      resistance: null,
      completed: false,
      cancelled: false,
      flags: new Set(),
    };
    this.interactions.set(id, interaction);
    this.schedule(id, COMBAT_DIRECTOR_EVENTS.lifecycle, 0, { stage: PENETRATION_STAGES.approach });
    return interaction;
  }

  beginPuncture({ weapon, intent, hit, entryPoint, direction, depth = 0.004, force = 0, weaponAdapter = null, onWoundCreated = null } = {}) {
    const interaction = this.createInteraction({ kind: 'puncture', weapon, intent, target: hit, weaponAdapter });
    if (!interaction) return null;
    const t = resolveMeleeTimeline('puncture', weapon);
    interaction.readyAt = this.time + t.rupture;
    interaction.tissueReadyAt = this.time + t.tissue;
    interaction.context = { hit, entryPoint, direction, depth, force, onWoundCreated };
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.contact, { stage: PENETRATION_STAGES.surfaceContact });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, t.contact, { kind: 'surface_stop', intensity: 0.2, depth: 0 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.compression, { stage: PENETRATION_STAGES.surfaceCompression });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.rupture, { stage: PENETRATION_STAGES.surfaceRupture });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.wound, t.rupture, { action: 'create_puncture', hit, entryPoint, direction, depth, weaponId: interaction.weapon.id, onWoundCreated });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.tissue, { stage: PENETRATION_STAGES.softTissue });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.tissue, t.tissue, { action: 'penetrate', hit, entryPoint, direction, deltaDepth: depth, depth, force, hardContact: false });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.reaction, t.reaction, { hit, point: entryPoint, direction, depth, force, severity: 0.2, source: 'directed_puncture' });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, t.audio, { cue: 'puncture', position: entryPoint, severity: 0.25 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.blood, t.blood, { action: 'entry', direction, severity: 0.2 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.camera, t.camera, { durationMs: 75, intensity: 0.018 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, t.haptic, { cue: 'penetration' });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.embedded, { stage: PENETRATION_STAGES.embedded });
    return interaction;
  }

  advancePenetration(interactionId, { hit, entryPoint, direction, deltaDepth, depth, force, hardContact = false } = {}) {
    const interaction = this.getActiveInteraction(interactionId);
    if (!interaction || deltaDepth < 0) return false;
    const delay = Math.max(0.002, (interaction.readyAt ?? this.time) - this.time);
    if (deltaDepth > 0) this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.tissue, delay, { action: 'penetrate', hit, entryPoint, direction, deltaDepth, depth, force, hardContact });
    if (hardContact && !interaction.flags.has('hard_tissue')) {
      interaction.flags.add('hard_tissue');
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, delay, { stage: PENETRATION_STAGES.hardTissue });
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, delay + 0.002, { kind: 'hard_stop', intensity: 0.85, depth });
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, delay + 0.004, { cue: 'bone_contact', position: entryPoint, severity: 0.85 });
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.camera, delay + 0.007, { durationMs: 85, intensity: 0.022 });
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, delay + 0.009, { cue: 'hard_contact' });
    } else if (depth >= 0.075 && !interaction.flags.has('deep_tissue')) {
      interaction.flags.add('deep_tissue');
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, delay + 0.004, { cue: 'deep_penetration', position: entryPoint, severity: 0.85 });
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, delay + 0.008, { cue: 'penetration' });
    } else if (depth >= 0.025 && !interaction.flags.has('soft_tissue')) {
      interaction.flags.add('soft_tissue');
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, delay + 0.004, { cue: 'soft_penetration', position: entryPoint, severity: 0.4 });
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, delay + 0.008, { cue: 'resistance' });
    } else if (depth > 0.025) this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, delay + 0.004, { cue: 'embedded_move', position: entryPoint, severity: deltaDepth * 8 });
    return true;
  }

  beginSlash({ weapon, intent, hit, startPoint, endPoint, surfaceNormal, cutDirection, depth, cutLength, severity, classification, weaponAdapter = null, onWoundCreated = null } = {}) {
    const interaction = this.createInteraction({ kind: 'slash', weapon, intent, target: hit, weaponAdapter });
    if (!interaction) return null;
    const t = resolveMeleeTimeline('slash', weapon);
    interaction.readyAt = this.time + t.rupture;
    interaction.recoveryOffset = t.recovery;
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.contact, { stage: PENETRATION_STAGES.surfaceContact });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, t.contact, { kind: 'surface_drag', intensity: severity * 0.3, depth: 0 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.compression, { stage: PENETRATION_STAGES.surfaceCompression });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.rupture, { stage: PENETRATION_STAGES.surfaceRupture });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.wound, t.rupture, { action: 'create_slash', hit, startPoint, endPoint, surfaceNormal, cutDirection, depth, cutLength, severity, classification, onWoundCreated });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.tissue, { stage: PENETRATION_STAGES.softTissue });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.reaction, t.reaction, { hit, point: endPoint, direction: cutDirection, depth, force: severity, severity: Math.max(0.16, severity * 0.3), slashSeverity: severity, source: 'directed_slash' });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, t.audio, { cue: classification === 'deep_slash' ? 'deep_slash' : 'shallow_slash', position: endPoint, severity });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.blood, t.blood, { action: 'slash', direction: cutDirection, severity });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.camera, t.camera, { durationMs: 65, intensity: Math.min(0.018, 0.008 + severity * 0.01) });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, t.haptic, { cue: classification === 'deep_slash' ? 'deep_slash' : 'surface_contact' });
    return interaction;
  }

  extendSlash(interactionId, payload = {}) {
    const interaction = this.getActiveInteraction(interactionId);
    if (!interaction) return false;
    const delay = Math.max(0.002, (interaction.readyAt ?? this.time) - this.time);
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.wound, delay, { action: 'extend_slash', ...payload });
    return true;
  }

  finishSlash(interactionId, interrupted = false) {
    const interaction = this.getActiveInteraction(interactionId);
    if (!interaction) return false;
    const afterWound = Math.max(0, (interaction.readyAt ?? this.time) - this.time) + 0.002;
    const recoveryDelay = Math.max(0.01, interaction.recoveryOffset ?? 0.04);
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.wound, afterWound, { action: 'finish_slash', interrupted });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, afterWound + recoveryDelay, { stage: PENETRATION_STAGES.recovery });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.recovery, afterWound + recoveryDelay, { reason: interrupted ? 'slash-interrupted' : 'slash-complete' });
    return true;
  }

  beginWithdrawal(interactionId, { direction = null, releaseSeverity = 0, position = null } = {}) {
    const interaction = this.interactions.get(interactionId);
    if (!interaction) return null;
    const t = resolveMeleeTimeline('extraction', interaction.weapon.profile);
    const afterReady = Math.max(0, (interaction.tissueReadyAt ?? interaction.readyAt ?? this.time) - this.time);
    this.queue = this.queue.filter((event) => !(event.interaction.id === interaction.id && event.type === COMBAT_DIRECTOR_EVENTS.lifecycle && event.payload.stage === PENETRATION_STAGES.embedded));
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, afterReady + t.withdrawal, { stage: PENETRATION_STAGES.withdrawal });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.wound, afterReady + t.wound, { action: 'extract', direction, releaseSeverity });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.reaction, afterReady + t.reaction, { hit: interaction.target, point: position, direction, depth: releaseSeverity, severity: Math.min(1, releaseSeverity * 4), source: 'directed_extraction' });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.blood, afterReady + t.blood, { action: 'withdrawal', direction, severity: releaseSeverity });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, afterReady + t.audio, { cue: 'extraction', position, severity: interaction.weapon.profile?.maximumPenetrationDepth ? releaseSeverity / interaction.weapon.profile.maximumPenetrationDepth : releaseSeverity });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, afterReady + t.haptic, { cue: 'extraction' });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, afterReady + t.exit, { stage: PENETRATION_STAGES.exit });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, afterReady + t.recovery, { stage: PENETRATION_STAGES.recovery });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.recovery, afterReady + t.recovery, { reason: 'weapon-extracted' });
    return interaction;
  }

  reportContact({ weapon, intent, hit = null, position = null, cue = 'clothing_contact', severity = 0.2, resistance = 'surface_stop' } = {}) {
    if (!isDamageIntent(intent)) return null;
    const interaction = this.createInteraction({ kind: 'contact', weapon, intent, target: hit });
    if (!interaction) return null;
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, 0.002, { stage: PENETRATION_STAGES.surfaceContact });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, 0.003, { kind: resistance, intensity: severity, depth: 0 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, 0.008, { cue, position, severity });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, 0.012, { cue: 'surface_contact' });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, 0.05, { stage: PENETRATION_STAGES.recovery });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.recovery, 0.05, { reason: 'surface-contact-complete' });
    return interaction;
  }

  reportResistance(interactionId, { kind = 'friction', intensity = 0.2, depth = 0, cue = null, position = null, severity = intensity, haptic = null, camera = null } = {}) {
    const interaction = this.getActiveInteraction(interactionId);
    if (!interaction) return false;
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, 0.002, { kind, intensity, depth });
    if (cue) this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, 0.006, { cue, position, severity });
    if (camera) this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.camera, 0.009, camera);
    if (haptic) this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, 0.011, { cue: haptic });
    return true;
  }

  forwardFeedbackEvent(cue, payload = {}) {
    const interaction = this.createSystemInteraction('actor_feedback');
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, 0, { cue, ...payload });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.recovery, 0.001, { reason: 'forwarded-feedback-complete' });
    return interaction;
  }

  createSystemInteraction(kind) {
    const id = `combat-${this.nextInteractionId++}`;
    const interaction = { id, kind, weapon: { id: 'system', family: 'system' }, intent: null, target: null, weaponAdapter: null, startedAt: this.time, stage: null, stageHistory: [], result: {}, resistance: null, completed: false, cancelled: false, flags: new Set() };
    this.interactions.set(id, interaction);
    return interaction;
  }

  schedule(interactionId, type, offset, payload = {}) {
    const interaction = this.interactions.get(interactionId);
    if (!interaction || interaction.cancelled || this.disposed) return null;
    const event = { type, payload, interaction, time: roundTime(this.time + Math.max(0, offset)), sequence: this.nextSequence++ };
    this.queue.push(event);
    return event;
  }

  update(dt) {
    if (this.disposed) return;
    this.time = roundTime(this.time + Math.max(0, Number(dt) || 0));
    this.flushDueEvents();
    this.pruneInteractions();
  }

  pruneInteractions() {
    if (this.interactions.size <= 128) return;
    [...this.interactions.values()]
      .filter((interaction) => interaction.cancelled || interaction.completed && this.time - (interaction.completedAt ?? interaction.startedAt) > 2)
      .sort((a, b) => a.startedAt - b.startedAt)
      .slice(0, this.interactions.size - 96)
      .forEach((interaction) => this.interactions.delete(interaction.id));
  }

  flushDueEvents() {
    this.queue.sort((a, b) => a.time - b.time || a.sequence - b.sequence);
    let count = 0;
    while (this.queue.length && this.queue[0].time <= this.time + 1e-7) {
      const event = this.queue.shift();
      if (!event.interaction.cancelled) this.dispatch(event);
      count += 1;
      if (count > 4096) throw new Error('Combat Director event loop exceeded its deterministic safety bound.');
      this.queue.sort((a, b) => a.time - b.time || a.sequence - b.sequence);
    }
  }

  dispatch(event) {
    this.eventLog.push({ interactionId: event.interaction.id, type: event.type, stage: event.payload.stage ?? null, action: event.payload.action ?? event.payload.cue ?? null, time: event.time, sequence: event.sequence });
    if (this.eventLog.length > 256) this.eventLog.shift();
    this.subscribers.get(event.type)?.forEach((handler) => handler(event));
    this.subscribers.get('*')?.forEach((handler) => handler(event));
  }

  applyWoundEvent({ interaction, payload }) {
    if (!this.actor) return;
    if (payload.action === 'create_puncture') {
      const wound = this.actor.beginPunctureWound({ hit: payload.hit, entryPoint: payload.entryPoint, direction: payload.direction, depth: payload.depth, weaponId: payload.weaponId, deferReaction: true, deferAudio: true });
      interaction.result.wound = wound;
      interaction.result.woundId = wound?.id ?? null;
      payload.onWoundCreated?.(wound, interaction);
    } else if (payload.action === 'create_slash') {
      const wound = this.actor.applySlashWound({ ...payload, deferReaction: true });
      interaction.result.wound = wound;
      interaction.result.woundId = wound?.id ?? null;
      payload.onWoundCreated?.(wound, interaction);
    } else if (payload.action === 'extend_slash' && interaction.result.woundId) {
      interaction.result.wound = this.actor.applySlashWound({ ...payload, woundId: interaction.result.woundId, deferReaction: true });
    } else if (payload.action === 'finish_slash' && interaction.result.woundId) {
      this.actor.woundSystem.finishSlash(interaction.result.woundId, payload.interrupted);
    } else if (payload.action === 'extract' && interaction.result.woundId) {
      interaction.result.wound = this.actor.onWeaponExtracted(interaction.result.woundId, { releaseSeverity: payload.releaseSeverity, direction: payload.direction });
    }
  }

  applyTissueEvent({ interaction, payload }) {
    if (!this.actor || payload.action !== 'penetrate') return;
    this.actor.applyPenetration({ ...payload, woundId: interaction.result.woundId });
  }

  applyReactionEvent({ payload }) {
    if (!payload.hit?.regionId || !this.actor || this.actor.lifeState === 'dead') return;
    this.actor.triggerReflex(payload.hit.regionId, payload.severity, payload.direction, { point: payload.point, depth: payload.depth, slashSeverity: payload.slashSeverity, force: payload.force, source: payload.source });
  }

  applyBloodEvent({ interaction, payload }) {
    const wound = interaction.result.wound;
    if (!wound || !this.bloodEffects) return;
    if (payload.action === 'entry') this.bloodEffects.emitEntry(wound, payload.severity);
    else if (payload.action === 'slash') this.bloodEffects.emitSlash(wound, payload.direction);
    else if (payload.action === 'withdrawal') this.bloodEffects.emitWithdrawal(wound, payload.direction);
  }

  getActiveInteraction(interactionId) {
    const interaction = this.interactions.get(interactionId);
    return interaction && !interaction.cancelled && !interaction.completed ? interaction : null;
  }

  cancelInteraction(interactionId, reason = 'cancelled') {
    const interaction = this.interactions.get(interactionId);
    if (!interaction || interaction.completed) return false;
    interaction.cancelled = true;
    interaction.cancelReason = reason;
    this.queue = this.queue.filter((event) => event.interaction.id !== interactionId);
    return true;
  }

  reset() {
    this.queue = [];
    this.interactions.clear();
    this.eventLog = [];
    this.time = 0;
    this.nextInteractionId = 1;
    this.nextSequence = 1;
  }

  getDiagnostics() {
    return { time: this.time, queuedEvents: this.queue.length, interactions: this.interactions.size, activeInteractions: [...this.interactions.values()].filter((entry) => !entry.completed && !entry.cancelled).length, lastEvent: this.eventLog.at(-1) ?? null, eventLog: [...this.eventLog] };
  }

  dispose() {
    this.reset();
    this.subscribers.clear();
    this.disposed = true;
  }
}
