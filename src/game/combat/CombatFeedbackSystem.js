import { COMBAT_AUDIO_CONFIG, HAPTIC_CONFIG } from './CombatStage2Config.js';

const EVENT_PROFILES = Object.freeze({
  knife_move: { type: 'noise', frequency: 1600, duration: 0.07, volume: 0.018 },
  clothing_contact: { type: 'noise', frequency: 520, duration: 0.08, volume: 0.035 },
  blunt_contact: { type: 'osc', frequency: 82, duration: 0.11, volume: 0.065 },
  blade_scrape: { type: 'noise', frequency: 1100, duration: 0.12, volume: 0.045 },
  failed_tip: { type: 'osc', frequency: 260, duration: 0.075, volume: 0.045 },
  puncture: { type: 'noise', frequency: 430, duration: 0.09, volume: 0.055 },
  soft_penetration: { type: 'noise', frequency: 260, duration: 0.12, volume: 0.045 },
  deep_penetration: { type: 'noise', frequency: 170, duration: 0.18, volume: 0.065 },
  bone_contact: { type: 'osc', frequency: 315, duration: 0.13, volume: 0.075 },
  embedded_move: { type: 'noise', frequency: 220, duration: 0.11, volume: 0.04 },
  blade_bind: { type: 'osc', frequency: 190, duration: 0.16, volume: 0.055 },
  extraction: { type: 'noise', frequency: 300, duration: 0.16, volume: 0.06 },
  shallow_slash: { type: 'noise', frequency: 780, duration: 0.11, volume: 0.05 },
  deep_slash: { type: 'noise', frequency: 390, duration: 0.2, volume: 0.075 },
  blood_spray: { type: 'noise', frequency: 600, duration: 0.1, volume: 0.032 },
  blood_drop: { type: 'osc', frequency: 145, duration: 0.045, volume: 0.018 },
  stagger_foot: { type: 'noise', frequency: 130, duration: 0.12, volume: 0.055 },
  body_ground: { type: 'noise', frequency: 90, duration: 0.24, volume: 0.1 },
  body_wall: { type: 'noise', frequency: 115, duration: 0.2, volume: 0.085 },
  limb_impact: { type: 'noise', frequency: 150, duration: 0.12, volume: 0.055 },
  body_settle: { type: 'noise', frequency: 75, duration: 0.16, volume: 0.04 },
  breathing: { type: 'vocal-noise', frequency: 180, duration: 0.32, volume: 0.032 },
  pain_vocal: { type: 'vocal', frequency: 105, duration: 0.22, volume: 0.07 },
  shock_gasp: { type: 'vocal-noise', frequency: 135, duration: 0.38, volume: 0.065 },
  unconscious: { type: 'vocal', frequency: 78, duration: 0.32, volume: 0.055 },
  final_exhale: { type: 'vocal-noise', frequency: 68, duration: 0.65, volume: 0.052 },
});

const HAPTIC_EVENT_MAP = Object.freeze({ puncture: 'penetration', soft_penetration: 'resistance', deep_penetration: 'penetration', bone_contact: 'hard_contact', blade_bind: 'resistance', extraction: 'extraction', deep_slash: 'deep_slash', body_ground: 'collapse', body_wall: 'severe_impact', surface_contact: 'surface_contact' });

export class CombatFeedbackSystem {
  constructor({ audioRuntime = null } = {}) {
    this.audioRuntime = audioRuntime;
    this.muted = false;
    this.hapticsEnabled = true;
    this.eventCooldowns = new Map();
    this.hapticCooldowns = new Map();
    this.activeVoices = new Set();
    this.eventCounts = new Map();
    this.eventLog = [];
    this.noiseBuffer = null;
    this.elapsed = 0;
    this.hapticEvents = [];
    this.disposed = false;
  }

  update(dt) {
    this.elapsed += dt;
    this.eventCooldowns.forEach((value, key) => { const next = value - dt; if (next <= 0) this.eventCooldowns.delete(key); else this.eventCooldowns.set(key, next); });
    this.hapticCooldowns.forEach((value, key) => { const next = value - dt; if (next <= 0) this.hapticCooldowns.delete(key); else this.hapticCooldowns.set(key, next); });
    this.hapticEvents = this.hapticEvents.filter((entry) => this.elapsed - entry.time < 1);
  }

  emit(event, { position = null, severity = 0.5, owner = 'combat-actor', force = false, audio = true, haptics = true } = {}) {
    if (this.disposed || !EVENT_PROFILES[event]) return false;
    const cooldownKey = `${owner}:${event}`;
    if (!force && this.eventCooldowns.has(cooldownKey)) return false;
    this.eventCooldowns.set(cooldownKey, COMBAT_AUDIO_CONFIG.eventCooldowns[event] ?? COMBAT_AUDIO_CONFIG.defaultCooldownSeconds);
    this.eventCounts.set(event, (this.eventCounts.get(event) ?? 0) + 1);
    this.eventLog.push({ event, owner, severity, time: this.elapsed });
    if (this.eventLog.length > 64) this.eventLog.shift();
    if (audio && !this.muted) this.playSynthesized(event, { position, severity, owner });
    const hapticEvent = HAPTIC_EVENT_MAP[event];
    if (haptics && hapticEvent) this.emitHaptic(hapticEvent);
    return true;
  }

  emitAudio(event, payload = {}) {
    return this.emit(event, { ...payload, haptics: false });
  }

  emitCombatHaptic(cue) {
    return this.emitHaptic(cue);
  }

  ensureNoiseBuffer(context) {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === context.sampleRate) return this.noiseBuffer;
    const length = Math.max(1, Math.floor(context.sampleRate * 0.7));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  playSynthesized(event, { position, severity, owner }) {
    const context = this.audioRuntime?.ensureContext?.();
    if (!context || context.state !== 'running') return false;
    const profile = EVENT_PROFILES[event];
    const isVocal = COMBAT_AUDIO_CONFIG.vocalEvents.includes(event);
    const vocalCount = [...this.activeVoices].filter((voice) => voice.vocal).length;
    if (isVocal && vocalCount >= COMBAT_AUDIO_CONFIG.maximumVocalVoices) return false;
    while (this.activeVoices.size >= COMBAT_AUDIO_CONFIG.maximumVoices) {
      const oldest = this.activeVoices.values().next().value;
      this.stopVoice(oldest);
    }
    const source = profile.type.includes('noise') ? context.createBufferSource() : context.createOscillator();
    if (profile.type.includes('noise')) source.buffer = this.ensureNoiseBuffer(context);
    else {
      source.type = isVocal ? 'sawtooth' : 'triangle';
      source.frequency.setValueAtTime(profile.frequency * (0.94 + Math.random() * 0.12), context.currentTime);
      source.frequency.exponentialRampToValueAtTime(Math.max(32, profile.frequency * 0.55), context.currentTime + profile.duration);
    }
    const filter = context.createBiquadFilter();
    filter.type = profile.type.includes('noise') ? 'bandpass' : 'lowpass';
    filter.frequency.value = profile.frequency;
    filter.Q.value = profile.type.includes('noise') ? 0.8 : 0.45;
    const gain = context.createGain();
    const volume = profile.volume * (0.65 + THREEClamp(severity, 0, 1.5) * 0.45);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + profile.duration);
    source.connect(filter); filter.connect(gain);
    let panner = null;
    if (position && this.audioRuntime?.createPanner) {
      panner = this.audioRuntime.createPanner({ refDistance: 0.8, maxDistance: 14, rolloffFactor: 1.5 }, position);
      gain.connect(panner);
      panner.connect(this.audioRuntime.busGains?.get?.('sfx') ?? this.audioRuntime.masterGain ?? context.destination);
    } else gain.connect(this.audioRuntime?.busGains?.get?.('sfx') ?? this.audioRuntime?.masterGain ?? context.destination);
    const voice = { source, filter, gain, panner, event, owner, vocal: isVocal, started: this.elapsed };
    this.activeVoices.add(voice);
    source.onended = () => this.cleanupVoice(voice);
    source.start(); source.stop(context.currentTime + profile.duration);
    return true;
  }

  emitHaptic(event) {
    if (!this.hapticsEnabled || this.hapticCooldowns.has(event)) return false;
    const vibrate = globalThis.navigator?.vibrate;
    if (typeof vibrate !== 'function') return false;
    if (this.hapticEvents.length >= HAPTIC_CONFIG.maximumEventsPerSecond) return false;
    const pattern = HAPTIC_CONFIG.patterns[event];
    if (!pattern) return false;
    try {
      vibrate.call(globalThis.navigator, [...pattern]);
      this.hapticCooldowns.set(event, HAPTIC_CONFIG.defaultCooldownSeconds);
      this.hapticEvents.push({ event, time: this.elapsed });
      return true;
    } catch {
      return false;
    }
  }

  stopOwnerVocal(owner = 'combat-actor') {
    [...this.activeVoices].filter((voice) => voice.owner === owner && voice.vocal).forEach((voice) => this.stopVoice(voice));
  }

  stopOwner(owner = 'combat-actor') {
    [...this.activeVoices].filter((voice) => voice.owner === owner).forEach((voice) => this.stopVoice(voice));
  }

  stopVoice(voice) {
    try { voice.source.stop(); } catch {}
    this.cleanupVoice(voice);
  }

  cleanupVoice(voice) {
    if (!this.activeVoices.delete(voice)) return;
    voice.source.disconnect?.(); voice.filter.disconnect?.(); voice.gain.disconnect?.(); voice.panner?.disconnect?.();
  }

  setMuted(muted) { this.muted = Boolean(muted); if (this.muted) [...this.activeVoices].forEach((voice) => this.stopVoice(voice)); }
  setHapticsEnabled(enabled) { this.hapticsEnabled = Boolean(enabled); if (!this.hapticsEnabled) { try { globalThis.navigator?.vibrate?.(0); } catch {} } }

  reset() {
    [...this.activeVoices].forEach((voice) => this.stopVoice(voice));
    this.eventCooldowns.clear();
    this.hapticCooldowns.clear();
    this.hapticEvents = [];
    this.eventCounts.clear();
    this.eventLog = [];
    this.elapsed = 0;
  }

  getDiagnostics() {
    return { muted: this.muted, hapticsEnabled: this.hapticsEnabled, activeVoices: this.activeVoices.size, vocalVoices: [...this.activeVoices].filter((voice) => voice.vocal).length, activeHapticEvents: this.hapticEvents.length, lastEvent: this.eventLog.at(-1)?.event ?? null, eventCounts: Object.fromEntries(this.eventCounts) };
  }

  dispose() {
    this.reset();
    this.disposed = true;
    this.noiseBuffer = null;
  }
}

function THREEClamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export { EVENT_PROFILES };
