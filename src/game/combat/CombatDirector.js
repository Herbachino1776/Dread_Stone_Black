import { isDamageIntent, MELEE_INTENTS } from './MeleeIntentWeapon.js';
import { COMBAT_PRESENTATION_CONFIG, deterministicCombatVariation, getImpactMemoryChannel } from './CombatPresentation.js';

const AUTHORED_REACTION_KINDS = Object.freeze({ punctureEntry: 'puncture_entry', slash: 'slash' });

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
  puncture: Object.freeze({ contact: 0, compression: 0.014, surfaceAudio: 0.02, rupture: 0.031, audio: 0.044, tissue: 0.05, reaction: 0.062, blood: 0.08, camera: 0.096, haptic: 0.105, embedded: 0.12 }),
  slash: Object.freeze({ contact: 0, compression: 0.012, surfaceAudio: 0.02, rupture: 0.03, audio: 0.045, tissue: 0.052, reaction: 0.064, blood: 0.082, camera: 0.098, haptic: 0.108, recovery: 0.16 }),
  extraction: Object.freeze({ withdrawal: 0, wound: 0.026, audio: 0.04, reaction: 0.052, blood: 0.07, camera: 0.084, haptic: 0.094, exit: 0.108, recovery: 0.19 }),
});

const roundTime = (value) => Math.round(value * 1e6) / 1e6;
const cloneVector = (value) => value?.clone?.() ?? value ?? null;

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
    this.eventPool = [];
    this.interactions = new Map();
    this.subscribers = new Map();
    this.eventLog = [];
    this.impactMemory = { torso: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
    this.extractionReactionAttempted = false;
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
      if (event.payload.stage === PENETRATION_STAGES.embedded) event.interaction.weaponAdapter?.onCombatResistance?.({ kind: 'tissue_settle', intensity: 0.22, depth: event.interaction.context?.depth ?? 0 }, event.interaction);
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
      event.interaction.weaponAdapter?.onCombatRecovery?.(event.payload, event.interaction);
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
      variation: deterministicCombatVariation(`${id}:${target?.regionId ?? 'surface'}:${weapon?.id ?? intent.weaponId}`),
      resistanceTimes: new Map(),
    };
    this.interactions.set(id, interaction);
    this.schedule(id, COMBAT_DIRECTOR_EVENTS.lifecycle, 0, { stage: PENETRATION_STAGES.approach });
    return interaction;
  }

  beginPuncture({ weapon, intent, hit, entryPoint, direction, surfaceNormal = null, entryTangent = null, depth = 0.004, force = 0, weaponAdapter = null, onWoundCreated = null } = {}) {
    const interaction = this.createInteraction({ kind: 'puncture', weapon, intent, target: hit, weaponAdapter });
    if (!interaction) return null;
    const t = resolveMeleeTimeline('puncture', weapon);
    const directedPoint = cloneVector(entryPoint);
    const directedAxis = cloneVector(direction);
    const directedNormal = cloneVector(surfaceNormal ?? direction?.clone?.().negate?.());
    const directedTangent = cloneVector(entryTangent);
    interaction.readyAt = this.time + t.rupture;
    interaction.tissueReadyAt = this.time + t.tissue;
    interaction.context = { hit, entryPoint: directedPoint, direction: directedAxis, surfaceNormal: directedNormal, entryTangent: directedTangent, depth, force, onWoundCreated };
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.contact, { stage: PENETRATION_STAGES.surfaceContact });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, t.contact, { kind: 'surface_stop', intensity: Math.min(1, 0.18 + force * 0.1), depth: 0 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.compression, { stage: PENETRATION_STAGES.surfaceCompression });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, t.compression, { kind: 'surface_compression', intensity: Math.min(1, 0.24 + force * 0.1), depth });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, t.surfaceAudio, { cue: 'clothing_contact', position: directedPoint, severity: 0.14 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.rupture, { stage: PENETRATION_STAGES.surfaceRupture });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, t.rupture, { kind: 'surface_rupture', intensity: Math.min(1, 0.32 + force * 0.08), depth });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.wound, t.rupture, { action: 'create_puncture', hit, entryPoint: directedPoint, direction: directedAxis, surfaceNormal: directedNormal, entryTangent: directedTangent, depth, impactSeverity: Math.max(0, Math.min(1, force / 1.5)), weaponProfile: interaction.weapon.profile, weaponId: interaction.weapon.id, onWoundCreated });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, t.audio, { cue: 'puncture', position: directedPoint, severity: 0.25 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.tissue, { stage: PENETRATION_STAGES.softTissue });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.tissue, t.tissue, { action: 'penetrate', hit, entryPoint: directedPoint, direction: directedAxis, deltaDepth: depth, depth, force, hardContact: false });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.reaction, t.reaction, { hit, point: directedPoint, direction: directedAxis, depth, force, severity: 0.2, source: 'directed_puncture', reactionKind: AUTHORED_REACTION_KINDS.punctureEntry });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.blood, t.blood, { action: 'entry', direction: directedAxis, severity: 0.2 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.blood, t.blood + COMBAT_PRESENTATION_CONFIG.bloodActivationDelaySeconds, { action: 'activate' });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.camera, t.camera, { durationMs: 105, intensity: 0.0095, direction: directedAxis, polarity: -1, damping: 18 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, t.haptic, { cue: 'penetration' });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.embedded, { stage: PENETRATION_STAGES.embedded });
    return interaction;
  }

  advancePenetration(interactionId, { hit, entryPoint, direction, deltaDepth, depth, force, lateralMotion = 0, hardContact = false, resistanceProfile = null } = {}) {
    const interaction = this.getActiveInteraction(interactionId);
    if (!interaction || deltaDepth < 0) return false;
    const directedPoint = cloneVector(entryPoint);
    const directedAxis = cloneVector(direction);
    const delay = Math.max(0.008, (interaction.readyAt ?? this.time) - this.time);
    if (deltaDepth > 0 || lateralMotion > 0) this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.tissue, delay, { action: 'penetrate', hit, entryPoint: directedPoint, direction: directedAxis, deltaDepth, depth, force, lateralMotion, hardContact });
    const phase = resistanceProfile?.phase;
    if (phase && !interaction.flags.has(`resistance:${phase}`)) {
      interaction.flags.add(`resistance:${phase}`);
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, delay + 0.006, { kind: phase === 'muscle' ? 'muscle_drag' : phase, intensity: resistanceProfile.drag ?? 0.3, depth });
    }
    if (hardContact && !interaction.flags.has('hard_tissue')) {
      interaction.flags.add('hard_tissue');
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, delay, { stage: PENETRATION_STAGES.hardTissue });
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, delay + 0.008, { kind: 'hard_stop', intensity: 0.85, depth });
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, delay + 0.022, { cue: 'bone_contact', position: directedPoint, severity: 0.85 });
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.camera, delay + 0.038, { durationMs: 125, intensity: 0.012, direction: directedAxis, polarity: -1, damping: 20 });
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, delay + 0.05, { cue: 'hard_contact' });
    } else if (depth >= 0.075 && !interaction.flags.has('deep_tissue')) {
      interaction.flags.add('deep_tissue');
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, delay + 0.018, { cue: 'deep_penetration', position: directedPoint, severity: 0.85 });
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, delay + 0.032, { cue: 'penetration' });
    } else if (depth >= 0.025 && !interaction.flags.has('soft_tissue')) {
      interaction.flags.add('soft_tissue');
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, delay + 0.016, { cue: 'soft_penetration', position: directedPoint, severity: 0.4 });
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, delay + 0.03, { cue: 'resistance' });
    } else if (depth > 0.025 && this.time - (interaction.lastEmbeddedAudioTime ?? -Infinity) >= 0.18) {
      interaction.lastEmbeddedAudioTime = this.time;
      this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, delay + 0.016, { cue: 'embedded_move', position: directedPoint, severity: deltaDepth * 8 });
    }
    return true;
  }

  beginSlash({ weapon, intent, hit, startPoint, endPoint, surfaceNormal, cutDirection, depth, cutLength, severity, classification, edgeAlignment = 1, weaponAdapter = null, onWoundCreated = null } = {}) {
    const interaction = this.createInteraction({ kind: 'slash', weapon, intent, target: hit, weaponAdapter });
    if (!interaction) return null;
    const t = resolveMeleeTimeline('slash', weapon);
    const directedStart = cloneVector(startPoint);
    const directedEnd = cloneVector(endPoint);
    const directedNormal = cloneVector(surfaceNormal);
    const directedCut = cloneVector(cutDirection);
    interaction.readyAt = this.time + t.rupture;
    interaction.recoveryOffset = t.recovery;
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.contact, { stage: PENETRATION_STAGES.surfaceContact });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, t.contact, { kind: 'surface_drag', intensity: severity * 0.3, depth: 0 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.compression, { stage: PENETRATION_STAGES.surfaceCompression });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, t.compression, { kind: 'surface_compression', intensity: severity * 0.32, depth });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, t.surfaceAudio, { cue: 'clothing_contact', position: directedEnd, severity: Math.min(0.3, severity * 0.22) });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.rupture, { stage: PENETRATION_STAGES.surfaceRupture });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, t.rupture, { kind: 'surface_rupture', intensity: severity * 0.4, depth });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.wound, t.rupture, { action: 'create_slash', hit, startPoint: directedStart, endPoint: directedEnd, surfaceNormal: directedNormal, cutDirection: directedCut, depth, cutLength, severity, classification, edgeAlignment, onWoundCreated });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, t.audio, { cue: classification === 'deep_slash' ? 'deep_slash' : 'shallow_slash', position: directedEnd, severity });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.tissue, { stage: PENETRATION_STAGES.softTissue });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.reaction, t.reaction, { hit, point: directedEnd, direction: directedCut, depth, force: severity, severity: Math.max(0.16, severity * 0.3), slashSeverity: severity, source: 'directed_slash', reactionKind: AUTHORED_REACTION_KINDS.slash });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.blood, t.blood, { action: 'slash', direction: directedCut, severity });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.blood, t.blood + COMBAT_PRESENTATION_CONFIG.bloodActivationDelaySeconds, { action: 'activate' });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.camera, t.camera, { durationMs: 105, intensity: Math.min(0.011, 0.005 + severity * 0.005), direction: directedCut, polarity: -1, damping: 18 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, t.haptic, { cue: classification === 'deep_slash' ? 'deep_slash' : 'surface_contact' });
    return interaction;
  }

  extendSlash(interactionId, payload = {}) {
    const interaction = this.getActiveInteraction(interactionId);
    if (!interaction) return false;
    const delay = Math.max(0.002, (interaction.readyAt ?? this.time) - this.time);
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.wound, delay, {
      action: 'extend_slash',
      hit: payload.hit,
      startPoint: cloneVector(payload.startPoint),
      endPoint: cloneVector(payload.endPoint),
      surfaceNormal: cloneVector(payload.surfaceNormal),
      cutDirection: cloneVector(payload.cutDirection),
      depth: payload.depth,
      cutLength: payload.cutLength,
      severity: payload.severity,
      damageSeverity: payload.damageSeverity,
      depthWeightedSeverity: payload.depthWeightedSeverity,
      classification: payload.classification,
      edgeAlignment: payload.edgeAlignment,
    });
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
    const interaction = this.getActiveInteraction(interactionId);
    if (!interaction) return null;
    if (interaction.flags.has('withdrawal_started')) return interaction;
    interaction.flags.add('withdrawal_started');
    const t = resolveMeleeTimeline('extraction', interaction.weapon.profile);
    const afterReady = Math.max(0, (interaction.tissueReadyAt ?? interaction.readyAt ?? this.time) - this.time);
    interaction.withdrawalContext = { direction: cloneVector(direction), releaseSeverity, position: cloneVector(position), timeline: t };
    this.removeQueuedEvents((event) => event.interaction.id === interaction.id && event.type === COMBAT_DIRECTOR_EVENTS.lifecycle && event.payload.stage === PENETRATION_STAGES.embedded);
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, afterReady + t.withdrawal, { stage: PENETRATION_STAGES.withdrawal });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, afterReady + 0.008, { kind: 'withdrawal_stick', intensity: Math.min(1, 0.25 + releaseSeverity * 3), depth: releaseSeverity });
    return interaction;
  }

  completeWithdrawal(interactionId, { direction = null, releaseSeverity = null, position = null } = {}) {
    const interaction = this.getActiveInteraction(interactionId);
    if (!interaction || interaction.flags.has('withdrawal_completed')) return interaction ?? null;
    if (!interaction.flags.has('withdrawal_started')) this.beginWithdrawal(interactionId, { direction, releaseSeverity: releaseSeverity ?? 0, position });
    interaction.flags.add('withdrawal_completed');
    const context = interaction.withdrawalContext ?? {};
    const t = context.timeline ?? resolveMeleeTimeline('extraction', interaction.weapon.profile);
    const directedAxis = cloneVector(direction ?? context.direction);
    const directedPoint = cloneVector(position ?? context.position);
    const severity = releaseSeverity ?? context.releaseSeverity ?? 0;
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, 0, { kind: 'withdrawal_release', intensity: Math.min(1, 0.25 + severity * 3), depth: severity });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.wound, t.wound, { action: 'extract', direction: directedAxis, releaseSeverity: severity });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, t.audio, { cue: 'extraction', position: directedPoint, severity: interaction.weapon.profile?.maximumPenetrationDepth ? severity / interaction.weapon.profile.maximumPenetrationDepth : severity });
    interaction.result.extractionReactionAttempted = false;
    this.extractionReactionAttempted = false;
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.blood, t.blood, { action: 'withdrawal', direction: directedAxis, severity });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.camera, t.camera, { durationMs: 115, intensity: Math.min(0.008, 0.003 + severity * 0.018), direction: directedAxis, polarity: 0.65, damping: 19 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, t.haptic, { cue: 'extraction' });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.exit, { stage: PENETRATION_STAGES.exit });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, t.recovery, { stage: PENETRATION_STAGES.recovery });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.recovery, t.recovery, { reason: 'weapon-extracted' });
    return interaction;
  }

  reportContact({ weapon, intent, hit = null, position = null, direction = null, cue = 'clothing_contact', severity = 0.2, resistance = 'surface_stop', weaponAdapter = null } = {}) {
    if (!isDamageIntent(intent)) return null;
    const interaction = this.createInteraction({ kind: 'contact', weapon, intent, target: hit, weaponAdapter });
    if (!interaction) return null;
    const directedPoint = cloneVector(position);
    const directedAxis = cloneVector(direction);
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, 0, { stage: PENETRATION_STAGES.surfaceContact });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, 0.012, { kind: resistance, intensity: severity, depth: 0 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, 0.025, { cue, position: directedPoint, severity });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.camera, 0.04, { durationMs: 95, intensity: Math.min(0.005, 0.002 + severity * 0.003), direction: directedAxis, polarity: -1, damping: 20 });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, 0.052, { cue: 'surface_contact' });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.lifecycle, 0.12, { stage: PENETRATION_STAGES.recovery });
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.recovery, 0.12, { reason: 'surface-contact-complete' });
    return interaction;
  }

  reportResistance(interactionId, { kind = 'friction', intensity = 0.2, depth = 0, cue = null, position = null, severity = intensity, haptic = null, camera = null } = {}) {
    const interaction = this.getActiveInteraction(interactionId);
    if (!interaction) return false;
    const lastTime = interaction.resistanceTimes.get(kind) ?? -Infinity;
    if (this.time - lastTime < COMBAT_PRESENTATION_CONFIG.resistanceEventCadenceSeconds) return false;
    interaction.resistanceTimes.set(kind, this.time);
    this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.resistance, 0.008, { kind, intensity, depth });
    if (cue) this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.audio, 0.022, { cue, position: cloneVector(position), severity });
    if (camera) this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.camera, 0.036, { ...camera, direction: cloneVector(camera.direction) });
    if (haptic) this.schedule(interaction.id, COMBAT_DIRECTOR_EVENTS.haptic, 0.048, { cue: haptic });
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
    const event = this.eventPool.pop() ?? {};
    event.type = type;
    event.payload = payload;
    event.interaction = interaction;
    event.time = roundTime(this.time + Math.max(0, offset));
    event.sequence = this.nextSequence++;
    let low = 0;
    let high = this.queue.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      const queued = this.queue[middle];
      if (queued.time < event.time || queued.time === event.time && queued.sequence < event.sequence) low = middle + 1;
      else high = middle;
    }
    this.queue.splice(low, 0, event);
    return event;
  }

  update(dt) {
    if (this.disposed) return;
    this.time = roundTime(this.time + Math.max(0, Number(dt) || 0));
    this.updateImpactMemory(dt);
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
    let count = 0;
    while (this.queue.length && this.queue[0].time <= this.time + 1e-7) {
      const event = this.queue.shift();
      if (!event.interaction.cancelled) this.dispatch(event);
      this.releaseEvent(event);
      count += 1;
      if (count > 4096) throw new Error('Combat Director event loop exceeded its deterministic safety bound.');
    }
  }

  releaseEvent(event) {
    event.type = null;
    event.payload = null;
    event.interaction = null;
    event.time = 0;
    event.sequence = 0;
    if (this.eventPool.length < 192) this.eventPool.push(event);
  }

  removeQueuedEvents(predicate) {
    let writeIndex = 0;
    for (let index = 0; index < this.queue.length; index += 1) {
      const event = this.queue[index];
      if (predicate(event)) this.releaseEvent(event);
      else this.queue[writeIndex++] = event;
    }
    this.queue.length = writeIndex;
  }

  updateImpactMemory(dt) {
    const decay = COMBAT_PRESENTATION_CONFIG.impactMemoryDecayPerSecond * Math.max(0, Number(dt) || 0);
    Object.keys(this.impactMemory).forEach((key) => { this.impactMemory[key] = Math.max(0, this.impactMemory[key] - decay); });
    this.actor?.visualAdapter?.setImpactMemory?.(this.impactMemory);
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
      const wound = this.actor.beginPunctureWound({ hit: payload.hit, entryPoint: payload.entryPoint, direction: payload.direction, surfaceNormal: payload.surfaceNormal, entryTangent: payload.entryTangent, depth: payload.depth, impactSeverity: payload.impactSeverity, weaponProfile: payload.weaponProfile, weaponId: payload.weaponId, deferReaction: true, deferAudio: true });
      if (wound) {
        wound.directedBloodReady = false;
        wound.interactionKind = 'puncture';
        wound.deliberateStab = interaction.intent?.intent === MELEE_INTENTS.stab && interaction.intent?.intentional === true && interaction.intent?.damaging === true;
        wound.surfaceRuptured = true;
        wound.punctureInteractionId ??= interaction.id;
      }
      interaction.result.wound = wound;
      interaction.result.woundId = wound?.id ?? null;
      payload.onWoundCreated?.(wound, interaction);
    } else if (payload.action === 'create_slash') {
      const wound = this.actor.applySlashWound({ ...payload, deferReaction: true });
      if (wound) wound.directedBloodReady = false;
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
    const traumaSeverity = this.actor.applyPenetration({ ...payload, woundId: interaction.result.woundId });
    const isHeavyTorsoPenetration = ['upper_chest', 'lower_chest'].includes(payload.hit?.regionId)
      && (payload.depth >= 0.035 || traumaSeverity >= 0.28);
    if (isHeavyTorsoPenetration && !interaction.flags.has('breath_interrupted')) {
      interaction.flags.add('breath_interrupted');
      this.actor.physiology?.interruptBreathing?.({ severity: traumaSeverity, depth: payload.depth });
    }
  }

  applyReactionEvent({ interaction, payload }) {
    if (!payload.hit?.regionId || !this.actor || this.actor.lifeState === 'dead') return;
    const memoryChannel = getImpactMemoryChannel(payload.hit.regionId);
    if (memoryChannel) this.impactMemory[memoryChannel] = Math.min(COMBAT_PRESENTATION_CONFIG.impactMemoryMaximum, this.impactMemory[memoryChannel] + 0.14 + Math.min(1, payload.severity ?? 0) * 0.16);
    const memory = memoryChannel ? this.impactMemory[memoryChannel] : 0;
    const currentAnimation = this.actor.visualAdapter?.animationController?.getDiagnostics?.() ?? null;
    this.actor.triggerReflex(payload.hit.regionId, payload.severity, payload.direction, { point: payload.point, depth: payload.depth, slashSeverity: payload.slashSeverity, force: payload.force, source: payload.source, reactionKind: payload.reactionKind, variation: interaction.variation, impactMemory: memory, recoveryState: currentAnimation?.state ?? 'HOLDING' });
    if (['upper_chest', 'lower_chest'].includes(payload.hit.regionId) && (payload.depth >= 0.035 || payload.severity >= 0.28)) this.actor.physiology?.interruptBreathing?.({ severity: payload.severity, depth: payload.depth });
  }

  applyBloodEvent({ interaction, payload }) {
    const wound = interaction.result.wound;
    if (!wound || !this.bloodEffects) return;
    if (payload.action === 'entry') this.bloodEffects.emitEntry(wound, payload.severity);
    else if (payload.action === 'slash') this.bloodEffects.emitSlash(wound, payload.direction);
    else if (payload.action === 'activate') wound.directedBloodReady = true;
    else if (payload.action === 'withdrawal') { wound.directedBloodReady = true; this.bloodEffects.emitWithdrawal(wound, payload.direction); }
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
    this.removeQueuedEvents((event) => event.interaction.id === interactionId);
    return true;
  }

  reset() {
    this.removeQueuedEvents(() => true);
    this.interactions.clear();
    this.eventLog = [];
    this.time = 0;
    this.nextInteractionId = 1;
    this.nextSequence = 1;
    Object.keys(this.impactMemory).forEach((key) => { this.impactMemory[key] = 0; });
    this.extractionReactionAttempted = false;
    this.actor?.visualAdapter?.setImpactMemory?.(this.impactMemory);
  }

  getDiagnostics() {
    return { time: this.time, queuedEvents: this.queue.length, pooledEvents: this.eventPool.length, interactions: this.interactions.size, activeInteractions: [...this.interactions.values()].filter((entry) => !entry.completed && !entry.cancelled).length, subscriberCount: [...this.subscribers.values()].reduce((sum, listeners) => sum + listeners.size, 0), impactMemory: { ...this.impactMemory }, extractionReactionAttempted: this.extractionReactionAttempted, lastEvent: this.eventLog.at(-1) ?? null, eventLog: [...this.eventLog] };
  }

  dispose() {
    this.reset();
    this.eventPool = [];
    this.subscribers.clear();
    this.disposed = true;
  }
}
