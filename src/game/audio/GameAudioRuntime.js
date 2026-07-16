import * as THREE from 'three';
import { AUDIO_CUE_MANIFEST, getAudioCue } from './audioCueManifest.js';
import { FolsomDayAmbienceRuntime } from './FolsomDayAmbienceRuntime.js';
import { ensureSharedAudioContext, unlockSharedAudioContext } from './sharedAudioContext.js';

const BUS_DEFAULTS = Object.freeze({
  master: 1,
  ambience: 0.82,
  sfx: 1,
  ui: 0.85,
  tools: 0.95,
  growth: 0.96,
  machinery: 0.95,
  footsteps: 0.55,
  prybar: 0.95,
  combat: 1,
  voice: 1,
});

const DEFERRED_ONE_SHOT_MAX_AGE_MS = 3000;
const DEFERRED_ONE_SHOT_LIMIT = 8;
const TMP_VECTOR = new THREE.Vector3();
const TMP_FORWARD = new THREE.Vector3();
const TMP_UP = new THREE.Vector3(0, 1, 0);

function toVector3Like(position) {
  if (!position) return null;
  if (position.isVector3) return position;
  const x = Number(position.x ?? position[0]);
  const y = Number(position.y ?? position[1]);
  const z = Number(position.z ?? position[2]);
  if (![x, y, z].every(Number.isFinite)) return null;
  TMP_VECTOR.set(x, y, z);
  return TMP_VECTOR;
}

function randomAround(base, amount = 0) {
  return base * (1 + (Math.random() * 2 - 1) * amount);
}

export class GameAudioRuntime {
  constructor({ root = null, random = Math.random } = {}) {
    this.root = root;
    this.context = null;
    this.readiness = 'locked';
    this.contextState = 'none';
    this.unlockAttemptCount = 0;
    this.masterGain = null;
    this.busGains = new Map();
    this.buffers = new Map();
    this.loading = new Map();
    this.loops = new Map();
    this.startingLoops = new Map();
    this.pendingLoops = new Map();
    this.deferredOneShots = new Map();
    this.warnedMissing = new Set();
    this.loggedEvents = new Set();
    this.oneShotNodes = new Set();
    this.oneShotOwnerTokens = new Map();
    this.previousPlayerPosition = null;
    this.previousLocationId = null;
    this.previousLowerShrineZone = null;
    this.underworksTensionPlayed = false;
    this.muted = false;
    this.paused = false;
    this.folsomDayAmbience = new FolsomDayAmbienceRuntime({ audioRuntime: this, random });
    this.boundUnlock = (event) => this.unlock({ reason: event?.type ?? 'gesture' });
    this.boundVisibility = () => this.handleVisibilityChanged();
    this.unlockTargets = [];
    this.bindUnlockEvents();
    document.addEventListener('visibilitychange', this.boundVisibility);
  }

  bindUnlockEvents() {
    const targets = [window, document, this.root].filter(Boolean);
    const uniqueTargets = [...new Set(targets)];
    ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'].forEach((eventName) => {
      uniqueTargets.forEach((target) => {
        target.addEventListener?.(eventName, this.boundUnlock, { passive: true, capture: true });
        this.unlockTargets.push([target, eventName]);
      });
    });
  }

  ensureContext() {
    if (this.context) return this.context;
    this.context = ensureSharedAudioContext();
    if (!this.context) return null;
    this.contextState = this.context.state;
    this.context.onstatechange = () => this.handleContextStateChanged();
    this.logDev('context-created', `Audio context created with state "${this.context.state}".`);
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = BUS_DEFAULTS.master;
    this.masterGain.connect(this.context.destination);
    Object.entries(BUS_DEFAULTS).forEach(([name, volume]) => {
      if (name === 'master') return;
      const gain = this.context.createGain();
      gain.gain.value = volume;
      gain.connect(this.masterGain);
      this.busGains.set(name, gain);
    });
    return this.context;
  }

  isAudioRunning() {
    return this.context?.state === 'running';
  }

  async unlock({ reason = 'gesture' } = {}) {
    const context = this.ensureContext();
    if (!context) return false;
    this.contextState = context.state;
    if (context.state === 'running') {
      this.markUnlocked();
      return true;
    }

    this.readiness = 'unlocking';
    this.unlockAttemptCount += 1;
    this.logUnlockAttempt(reason, context.state);
    try {
      await unlockSharedAudioContext();
      this.contextState = context.state;
      if (context.state === 'running') {
        this.markUnlocked();
        return true;
      }
      if (this.readiness !== 'unlocked') this.readiness = 'locked';
      this.logDev('unlock-not-running', `Audio unlock did not reach running state; context state "${context.state}".`);
    } catch (error) {
      if (context.state === 'running') {
        this.markUnlocked();
        return true;
      }
      this.readiness = 'locked';
      this.warnDev('audio-unlock', 'Audio context resume failed.', error);
    }
    return false;
  }

  hasCue(cueId) {
    return Boolean(getAudioCue(cueId));
  }

  async loadCue(cueId) {
    const cue = getAudioCue(cueId);
    if (!cue) {
      this.warnMissingCue(cueId);
      return null;
    }
    if (this.buffers.has(cueId)) return this.buffers.get(cueId);
    if (this.loading.has(cueId)) return this.loading.get(cueId);
    const context = this.ensureContext();
    if (!context) return null;
    const loadPromise = fetch(cue.path)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
      .then((buffer) => {
        this.buffers.set(cueId, buffer);
        this.loading.delete(cueId);
        return buffer;
      })
      .catch((error) => {
        this.loading.delete(cueId);
        this.warnDev(`cue-load:${cueId}`, `Could not load audio cue ${cueId}.`, error);
        return null;
      });
    this.loading.set(cueId, loadPromise);
    return loadPromise;
  }

  play2D(cueId, options = {}) {
    return this.playOneShot(cueId, { ...options, spatial: false });
  }

  play3D(cueId, position, options = {}) {
    return this.playOneShot(cueId, { ...options, spatial: true, position });
  }

  async playOneShot(cueId, options = {}) {
    if (this.muted) return false;
    const cue = getAudioCue(cueId);
    if (!cue) {
      this.warnMissingCue(cueId);
      return false;
    }
    const context = this.ensureContext();
    if (!context) return false;
    const owner = options.owner ?? null;
    let ownerToken = null;
    if (owner && options.cancellable === true) {
      ownerToken = this.oneShotOwnerTokens.get(owner) ?? {};
      this.oneShotOwnerTokens.set(owner, ownerToken);
    }
    if (!this.isAudioRunning() && !options.skipDefer) {
      if (options.deferUntilUnlocked ?? cue.deferUntilUnlocked ?? true) {
        this.deferOneShot(cueId, options);
        this.unlock({ reason: `one-shot:${cueId}` });
        return false;
      }
      this.unlock({ reason: `one-shot:${cueId}` });
    }
    const buffer = await this.loadCue(cueId);
    if (!buffer || this.muted || ownerToken && this.oneShotOwnerTokens.get(owner) !== ownerToken || (!this.isAudioRunning() && !options.allowSuspendedStart)) return false;

    const voiceGroup = options.voiceGroup ?? null;
    const maximumVoices = Number.isFinite(options.maximumVoices) ? Math.max(1, Math.floor(options.maximumVoices)) : null;
    if (voiceGroup && maximumVoices) {
      const groupedNodes = [...this.oneShotNodes].filter((nodes) => nodes.voiceGroup === voiceGroup).sort((a, b) => a.startedAt - b.startedAt);
      while (groupedNodes.length >= maximumVoices) this.stopOneShotNodes(groupedNodes.shift());
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = randomAround(options.playbackRate ?? 1, options.pitchVariation ?? cue.pitchVariation ?? 0);
    gain.gain.value = randomAround((options.volume ?? cue.volume ?? 1), options.volumeVariation ?? cue.volumeVariation ?? 0);
    source.connect(gain);

    const category = options.category ?? cue.category ?? 'sfx';
    let output = this.busGains.get(category) ?? this.busGains.get('sfx') ?? this.masterGain;
    const useSpatial = options.spatial ?? cue.spatial;
    const position = toVector3Like(typeof options.positionProvider === 'function' ? options.positionProvider() : options.position);
    let panner = null;
    if (useSpatial && position) {
      panner = this.createPanner(cue, position);
      gain.connect(panner);
      output = this.busGains.get(category) ?? output;
      panner.connect(output);
    } else {
      gain.connect(output);
    }

    const nodes = { source, gain, panner, owner, ownerToken, voiceGroup, startedAt: context.currentTime };
    this.oneShotNodes.add(nodes);
    source.onended = () => this.cleanupOneShotNodes(nodes);
    source.start();
    return true;
  }

  cleanupOneShotNodes(nodes) {
    if (!nodes || !this.oneShotNodes.delete(nodes)) return;
    nodes.source.disconnect?.();
    nodes.gain.disconnect?.();
    nodes.panner?.disconnect?.();
  }

  stopOneShotNodes(nodes) {
    if (!nodes || !this.oneShotNodes.has(nodes)) return false;
    try { nodes.source.stop(); } catch {}
    this.cleanupOneShotNodes(nodes);
    return true;
  }

  stopOneShotsByOwner(owner, { voiceGroup = null } = {}) {
    if (!owner) return 0;
    this.oneShotOwnerTokens.delete(owner);
    let stopped = 0;
    [...this.deferredOneShots.entries()].forEach(([key, entry]) => {
      if (entry.options?.owner === owner && (!voiceGroup || entry.options?.voiceGroup === voiceGroup)) {
        this.deferredOneShots.delete(key);
        stopped += 1;
      }
    });
    [...this.oneShotNodes]
      .filter((nodes) => nodes.owner === owner && (!voiceGroup || nodes.voiceGroup === voiceGroup))
      .forEach((nodes) => { if (this.stopOneShotNodes(nodes)) stopped += 1; });
    return stopped;
  }

  getActiveOneShotCount(voiceGroup = null) {
    return voiceGroup ? [...this.oneShotNodes].filter((nodes) => nodes.voiceGroup === voiceGroup).length : this.oneShotNodes.size;
  }

  async startLoop(cueId, key, options = {}) {
    if (this.muted || !key) return false;
    const cue = getAudioCue(cueId);
    if (!cue) {
      this.warnMissingCue(cueId);
      return false;
    }
    const existing = this.loops.get(key);
    if (existing) {
      existing.targetVolume = options.volume ?? cue.volume ?? existing.targetVolume;
      this.setLoopPosition(key, options.position);
      this.fadeGain(existing.gain, existing.targetVolume, options.fadeSeconds ?? 0.6);
      this.pendingLoops.delete(key);
      return true;
    }
    const starting = this.startingLoops.get(key);
    if (starting) {
      starting.options = this.cloneLoopStartOptions(options);
      return false;
    }

    const context = this.ensureContext();
    if (!context) return false;
    if (!this.isAudioRunning() && !options.skipDefer) {
      this.rememberPendingLoop(cueId, key, options);
      this.unlock({ reason: `loop:${cueId}` });
      return false;
    }
    const startRequest = { cueId, key, options: this.cloneLoopStartOptions(options) };
    this.startingLoops.set(key, startRequest);
    const buffer = await this.loadCue(cueId);
    if (!buffer || this.muted || this.startingLoops.get(key) !== startRequest || this.loops.has(key) || (!this.isAudioRunning() && !startRequest.options.allowSuspendedStart)) {
      if (this.startingLoops.get(key) === startRequest) this.startingLoops.delete(key);
      return false;
    }
    const startOptions = startRequest.options;

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain);

    const category = startOptions.category ?? cue.category ?? 'ambience';
    const position = toVector3Like(startOptions.position);
    let panner = null;
    if ((startOptions.spatial ?? cue.spatial) && position) {
      panner = this.createPanner(cue, position);
      gain.connect(panner);
      panner.connect(this.busGains.get(category) ?? this.busGains.get('ambience') ?? this.masterGain);
    } else {
      gain.connect(this.busGains.get(category) ?? this.busGains.get('ambience') ?? this.masterGain);
    }

    const loop = {
      key,
      cueId,
      source,
      gain,
      panner,
      targetVolume: startOptions.volume ?? cue.volume ?? 1,
    };
    this.startingLoops.delete(key);
    this.loops.set(key, loop);
    this.pendingLoops.delete(key);
    source.start();
    this.fadeGain(gain, loop.targetVolume, startOptions.fadeSeconds ?? 0.8);
    return true;
  }

  stopLoop(key, fadeSeconds = 0.5) {
    this.startingLoops.delete(key);
    this.pendingLoops.delete(key);
    const loop = this.loops.get(key);
    if (!loop) return;
    this.loops.delete(key);
    this.fadeGain(loop.gain, 0.0001, fadeSeconds);
    const stopAt = (this.context?.currentTime ?? 0) + Math.max(0.02, fadeSeconds);
    try {
      loop.source.stop(stopAt);
    } catch {
      // Already stopped loops are harmless during session disposal.
    }
    window.setTimeout(() => {
      loop.source.disconnect();
      loop.gain.disconnect();
      loop.panner?.disconnect();
    }, Math.max(40, fadeSeconds * 1000 + 40));
  }

  stopLoopsWithPrefix(prefix, fadeSeconds = 0.4) {
    const keys = new Set([...this.loops.keys(), ...this.startingLoops.keys(), ...this.pendingLoops.keys()]);
    [...keys].filter((key) => key.startsWith(prefix)).forEach((key) => this.stopLoop(key, fadeSeconds));
  }

  hasLoopOwnership(key) {
    return this.loops.has(key) || this.startingLoops.has(key) || this.pendingLoops.has(key);
  }

  setLoopPosition(key, position) {
    const loop = this.loops.get(key);
    const vector = toVector3Like(position);
    if (!loop?.panner || !vector) return;
    this.setPannerPosition(loop.panner, vector);
  }

  createPanner(cue, position) {
    const panner = this.context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = cue.refDistance ?? 1.4;
    panner.maxDistance = cue.maxDistance ?? 18;
    panner.rolloffFactor = cue.rolloffFactor ?? 1.35;
    this.setPannerPosition(panner, position);
    return panner;
  }

  setPannerPosition(panner, position) {
    if (panner.positionX) {
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
      return;
    }
    panner.setPosition?.(position.x, position.y, position.z);
  }

  fadeGain(gain, target, seconds = 0.5) {
    if (!this.context || !gain) return;
    const now = this.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, target), now + Math.max(0.02, seconds));
  }

  markUnlocked() {
    const wasUnlocked = this.readiness === 'unlocked';
    this.readiness = 'unlocked';
    this.contextState = this.context?.state ?? 'none';
    if (!wasUnlocked) this.logDev('unlock-succeeded', `Audio unlock succeeded; context state "${this.contextState}".`);
    this.resumePendingLoops();
    this.flushDeferredOneShots();
  }

  handleContextStateChanged() {
    this.contextState = this.context?.state ?? 'none';
    this.logDev(`context-state:${this.contextState}`, `Audio context state changed to "${this.contextState}".`);
    if (this.contextState === 'running') this.markUnlocked();
    else if (this.readiness === 'unlocking') this.readiness = 'locked';
  }

  rememberPendingLoop(cueId, key, options = {}) {
    this.pendingLoops.set(key, {
      cueId,
      key,
      options: this.clonePlaybackOptions(options),
    });
  }

  resumePendingLoops() {
    if (!this.isAudioRunning() || this.muted || this.paused || this.pendingLoops.size === 0) return;
    const pending = [...this.pendingLoops.values()];
    pending.forEach(({ cueId, key, options }) => {
      if (!this.pendingLoops.has(key) || this.loops.has(key)) return;
      this.logDev(`deferred-loop:${key}`, `Deferred loop resumed: ${cueId}.`);
      this.startLoop(cueId, key, { ...options, skipDefer: true });
    });
  }

  deferOneShot(cueId, options = {}) {
    const key = this.getOneShotDeferKey(cueId, options);
    if (this.deferredOneShots.has(key)) return;
    if (this.deferredOneShots.size >= DEFERRED_ONE_SHOT_LIMIT) {
      const oldestKey = this.deferredOneShots.keys().next().value;
      this.deferredOneShots.delete(oldestKey);
      this.logDev('deferred-one-shot-drop-oldest', 'Dropped oldest deferred one-shot because the queue is full.');
    }
    this.deferredOneShots.set(key, {
      cueId,
      options: this.clonePlaybackOptions(options),
      queuedAt: performance.now(),
    });
  }

  flushDeferredOneShots() {
    if (!this.isAudioRunning() || this.muted || this.paused || this.deferredOneShots.size === 0) return;
    const now = performance.now();
    const entries = [...this.deferredOneShots.entries()];
    entries.forEach(([key, entry]) => {
      this.deferredOneShots.delete(key);
      if (now - entry.queuedAt > DEFERRED_ONE_SHOT_MAX_AGE_MS) {
        this.logDev(`deferred-one-shot-dropped:${key}`, `Deferred one-shot dropped as stale: ${entry.cueId}.`);
        return;
      }
      this.logDev(`deferred-one-shot-played:${key}`, `Deferred one-shot played after unlock: ${entry.cueId}.`);
      this.playOneShot(entry.cueId, { ...entry.options, skipDefer: true });
    });
  }

  getOneShotDeferKey(cueId, options = {}) {
    const position = toVector3Like(options.position);
    const owner = options.owner ? `:${options.owner}` : '';
    if (!position) return `${cueId}${owner}`;
    return `${cueId}${owner}:${position.x.toFixed(2)},${position.y.toFixed(2)},${position.z.toFixed(2)}`;
  }

  clonePlaybackOptions(options = {}) {
    const clone = { ...options };
    delete clone.skipDefer;
    delete clone.allowSuspendedStart;
    if (options.position?.isVector3) clone.position = options.position.clone();
    else if (options.position) clone.position = { ...options.position };
    return clone;
  }

  cloneLoopStartOptions(options = {}) {
    const clone = this.clonePlaybackOptions(options);
    if (options.allowSuspendedStart != null) clone.allowSuspendedStart = options.allowSuspendedStart;
    return clone;
  }

  update(deltaSeconds, { camera = null, player = null, dungeon = null, locationId = null, controls = null, paused = false } = {}) {
    this.updateLocationChange(locationId);
    this.folsomDayAmbience.update(deltaSeconds, {
      player,
      dungeon,
      locationId,
      paused: paused || this.paused,
    });
    if (paused || this.paused) return;
    this.updateListener(camera);
    this.updateShedGrowthLoop(player, dungeon, locationId);
    this.updateBlueFlameHall(player, dungeon, locationId);
    this.updateLowerShrineLanding(player, locationId);
    this.updateUnderShrineLabyrinth(locationId);
    this.updateUnderworksTension(player, dungeon, locationId);
    this.updateFootsteps(deltaSeconds, player, locationId, controls);
  }

  updateListener(camera) {
    if (!this.context || !camera) return;
    const listener = this.context.listener;
    camera.getWorldDirection(TMP_FORWARD);
    const position = camera.position;
    if (listener.positionX) {
      listener.positionX.value = position.x;
      listener.positionY.value = position.y;
      listener.positionZ.value = position.z;
      listener.forwardX.value = TMP_FORWARD.x;
      listener.forwardY.value = TMP_FORWARD.y;
      listener.forwardZ.value = TMP_FORWARD.z;
      listener.upX.value = TMP_UP.x;
      listener.upY.value = TMP_UP.y;
      listener.upZ.value = TMP_UP.z;
    } else {
      listener.setPosition?.(position.x, position.y, position.z);
      listener.setOrientation?.(TMP_FORWARD.x, TMP_FORWARD.y, TMP_FORWARD.z, TMP_UP.x, TMP_UP.y, TMP_UP.z);
    }
  }

  updateLocationChange(locationId) {
    if (locationId === this.previousLocationId) return;
    this.folsomDayAmbience.handleLocationChanged(locationId);
    this.stopLoopsWithPrefix('location:', 0.65);
    this.stopLoopsWithPrefix('folsom:', 0.45);
    this.stopLoopsWithPrefix('beneath:', 0.45);
    this.stopLoopsWithPrefix('footsteps:', 0.2);
    this.previousPlayerPosition = null;
    this.previousLowerShrineZone = null;
    this.previousLocationId = locationId;
  }

  handleLocationTransition(locationId) {
    this.folsomDayAmbience.handleLocationChanged(locationId);
    if (locationId === 'beneath-folsom') {
      this.play2D('audio_ch2_beneath_folsom_entry_stinger_oneshot');
    }
  }

  updateShedGrowthLoop(player, dungeon, locationId) {
    const key = 'folsom:shed-growth-tension';
    const shed = locationId === 'folsom' ? dungeon?.folsomShedGrowthRuntime : null;
    const target = shed?.getTarget?.();
    if (!player?.position || !shed || shed.open || !target) {
      this.stopLoop(key, 0.55);
      return;
    }
    const distance = player.position.distanceTo(target);
    if (distance <= 9.5) {
      this.startLoop('audio_ch1_folsom_shed_growth_tension_loop', key, { position: target, fadeSeconds: 0.65 });
    } else if (distance >= 11.5) {
      this.stopLoop(key, 0.75);
    }
  }

  updateBlueFlameHall(player, dungeon, locationId) {
    const active = locationId === 'beneath-folsom'
      && dungeon?.gameState?.isBeneathFolsomHiddenGrowthGateCleared?.() === true
      && player?.position?.z >= 22
      && player.position.z <= 62;
    const specs = [
      ['beneath:blue-flame-main', 'audio_ch2_blue_flame_hall_ambience_loop', new THREE.Vector3(0, 1.7, 42), 0.62],
      ['beneath:blue-flame-layer-a', 'audio_ch2_blue_flame_hall_ambience_layer_a_loop', new THREE.Vector3(-2.6, 1.8, 34), 0.32],
      ['beneath:blue-flame-layer-b', 'audio_ch2_blue_flame_hall_ambience_layer_b_loop', new THREE.Vector3(2.6, 1.8, 50), 0.28],
    ];
    specs.forEach(([key, cueId, position, volume]) => {
      if (active) this.startLoop(cueId, key, { position, volume, fadeSeconds: 0.8 });
      else this.stopLoop(key, 0.65);
    });
  }

  updateLowerShrineLanding(player, locationId) {
    const key = 'beneath:lower-shrine-landing';
    const inZone = locationId === 'beneath-folsom' && player?.position?.z >= 62;
    if (inZone) {
      this.startLoop('audio_ch2_lower_shrine_landing_ambience_loop', key, { fadeSeconds: 0.9 });
      if (this.previousLowerShrineZone === false) this.play2D('audio_ch2_lower_shrine_landing_reveal_stinger_oneshot');
    } else {
      this.stopLoop(key, 0.65);
    }
    if (this.previousLowerShrineZone == null) this.previousLowerShrineZone = inZone;
    else this.previousLowerShrineZone = inZone;
  }

  updateUnderShrineLabyrinth(locationId) {
    const key = 'location:under-shrine-labyrinth-void-bed';
    const cueId = 'audio_ch3_under_shrine_labyrinth_void_bed_loop';
    if (locationId === 'under-shrine-labyrinth' && this.hasCue(cueId)) {
      this.startLoop(cueId, key, { fadeSeconds: 1 });
    } else {
      this.stopLoop(key, 0.65);
    }
  }

  updateUnderworksTension(player, dungeon, locationId) {
    if (this.underworksTensionPlayed || locationId !== 'folsom' || !player?.position) return;
    const revealed = dungeon?.gameState?.isFolsomUnderShrineNetworkRevealed?.() === true;
    const unsealed = dungeon?.gameState?.isFolsomUnderworksGrowthUnsealed?.() === true;
    if (!revealed || unsealed) return;
    const target = new THREE.Vector3(42, 1.45, 40.5);
    if (player.position.distanceTo(target) > 8) return;
    this.underworksTensionPlayed = true;
    this.play3D('audio_ch2_underworks_gate_ambient_tension_stinger_oneshot', target);
  }

  updateFootsteps(deltaSeconds, player, locationId, controls) {
    const key = 'footsteps:player';
    if (!player?.position || deltaSeconds <= 0) {
      this.stopLoop(key, 0.18);
      return;
    }
    const previous = this.previousPlayerPosition;
    this.previousPlayerPosition = player.position.clone();
    if (!previous) return;
    const speed = player.position.clone().sub(previous).setY(0).length() / Math.max(0.001, deltaSeconds);
    const physicallyLocked = controls?.physicalToolSeated === true;
    const moving = !physicallyLocked && speed > 0.12;
    if (!moving) {
      this.stopLoop(key, 0.22);
      return;
    }
    const cueId = locationId === 'folsom'
      ? 'audio_system_footsteps_grass_walk_loop'
      : ['beneath-folsom', 'under-shrine-labyrinth'].includes(locationId)
        ? 'audio_system_footsteps_temple_stone_walk_loop'
        : null;
    if (cueId) this.startLoop(cueId, key, { fadeSeconds: 0.16 });
    else this.stopLoop(key, 0.22);
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    const context = this.context;
    if (!context) return;
    if (this.paused && context.state === 'running') context.suspend?.();
    if (!this.paused && context.state === 'suspended') this.unlock({ reason: 'resume' });
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.masterGain) this.fadeGain(this.masterGain, this.muted ? 0.0001 : BUS_DEFAULTS.master, 0.12);
  }

  reset() {
    this.folsomDayAmbience.reset();
    this.previousPlayerPosition = null;
    this.previousLowerShrineZone = null;
    this.underworksTensionPlayed = false;
  }

  getDiagnostics() {
    return {
      readiness: this.readiness,
      contextState: this.contextState,
      muted: this.muted,
      paused: this.paused,
      activeLoopCount: this.loops.size,
      pendingLoopCount: this.pendingLoops.size + this.startingLoops.size,
      deferredOneShotCount: this.deferredOneShots.size,
      activeOneShotCount: this.oneShotNodes.size,
      folsomDayAmbience: this.folsomDayAmbience.getDiagnostics(),
    };
  }

  handleVisibilityChanged() {
    if (document.hidden) this.setPaused(true);
    else this.setPaused(false);
  }

  warnMissingCue(cueId) {
    this.warnDev(`missing:${cueId}`, `Missing audio cue "${cueId}".`);
  }

  warnDev(key, message, error = null) {
    if (!import.meta.env?.DEV || this.warnedMissing.has(key)) return;
    this.warnedMissing.add(key);
    console.warn(`[Dread Stone Black Audio] ${message}`, error ?? '');
  }

  logDev(key, message, data = null) {
    if (!import.meta.env?.DEV || this.loggedEvents.has(key)) return;
    this.loggedEvents.add(key);
    console.info(`[Dread Stone Black Audio] ${message}`, data ?? '');
  }

  logUnlockAttempt(reason, contextState) {
    if (!import.meta.env?.DEV) return;
    console.info(`[Dread Stone Black Audio] Audio unlock attempted (${reason}); attempt ${this.unlockAttemptCount}; context state "${contextState}".`);
  }

  dispose() {
    this.folsomDayAmbience.dispose();
    this.unlockTargets.forEach(([target, eventName]) => {
      target.removeEventListener?.(eventName, this.boundUnlock, { capture: true });
    });
    this.unlockTargets = [];
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.pendingLoops.clear();
    this.deferredOneShots.clear();
    const ownedLoopKeys = new Set([...this.loops.keys(), ...this.startingLoops.keys(), ...this.pendingLoops.keys()]);
    [...ownedLoopKeys].forEach((key) => this.stopLoop(key, 0.05));
    this.startingLoops.clear();
    [...this.oneShotNodes].forEach((nodes) => this.stopOneShotNodes(nodes));
    this.oneShotNodes.clear();
    this.oneShotOwnerTokens.clear();
    this.context?.close?.();
    this.context = null;
    this.readiness = 'locked';
    this.contextState = 'none';
  }
}

export { AUDIO_CUE_MANIFEST };
