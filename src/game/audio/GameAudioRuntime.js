import * as THREE from 'three';
import { AUDIO_CUE_MANIFEST, getAudioCue } from './audioCueManifest.js';

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
});

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
  constructor({ root = null } = {}) {
    this.root = root;
    this.context = null;
    this.masterGain = null;
    this.busGains = new Map();
    this.buffers = new Map();
    this.loading = new Map();
    this.loops = new Map();
    this.warnedMissing = new Set();
    this.oneShotNodes = new Set();
    this.previousPlayerPosition = null;
    this.previousLocationId = null;
    this.previousLowerShrineZone = null;
    this.underworksTensionPlayed = false;
    this.muted = false;
    this.paused = false;
    this.boundUnlock = () => this.unlock();
    this.boundVisibility = () => this.handleVisibilityChanged();
    this.bindUnlockEvents();
    document.addEventListener('visibilitychange', this.boundVisibility);
  }

  bindUnlockEvents() {
    const target = this.root ?? window;
    ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
      target.addEventListener?.(eventName, this.boundUnlock, { passive: true });
    });
  }

  ensureContext() {
    if (this.context) return this.context;
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) return null;
    this.context = new AudioContextClass();
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

  async unlock() {
    const context = this.ensureContext();
    if (!context || context.state !== 'suspended') return;
    try {
      await context.resume();
    } catch (error) {
      this.warnDev('audio-unlock', 'Audio context resume failed.', error);
    }
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
    if (context.state === 'suspended') this.unlock();
    const buffer = await this.loadCue(cueId);
    if (!buffer || this.muted) return false;

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = randomAround(options.playbackRate ?? 1, options.pitchVariation ?? cue.pitchVariation ?? 0);
    gain.gain.value = randomAround((options.volume ?? cue.volume ?? 1), options.volumeVariation ?? cue.volumeVariation ?? 0);
    source.connect(gain);

    const category = options.category ?? cue.category ?? 'sfx';
    let output = this.busGains.get(category) ?? this.busGains.get('sfx') ?? this.masterGain;
    const useSpatial = options.spatial ?? cue.spatial;
    const position = toVector3Like(options.position);
    let panner = null;
    if (useSpatial && position) {
      panner = this.createPanner(cue, position);
      gain.connect(panner);
      output = this.busGains.get(category) ?? output;
      panner.connect(output);
    } else {
      gain.connect(output);
    }

    const nodes = { source, gain, panner };
    this.oneShotNodes.add(nodes);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
      this.oneShotNodes.delete(nodes);
    };
    source.start();
    return true;
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
      return true;
    }

    const context = this.ensureContext();
    if (!context) return false;
    if (context.state === 'suspended') this.unlock();
    const buffer = await this.loadCue(cueId);
    if (!buffer || this.muted || this.loops.has(key)) return false;

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain);

    const category = options.category ?? cue.category ?? 'ambience';
    const position = toVector3Like(options.position);
    let panner = null;
    if ((options.spatial ?? cue.spatial) && position) {
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
      targetVolume: options.volume ?? cue.volume ?? 1,
    };
    this.loops.set(key, loop);
    source.start();
    this.fadeGain(gain, loop.targetVolume, options.fadeSeconds ?? 0.8);
    return true;
  }

  stopLoop(key, fadeSeconds = 0.5) {
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
    [...this.loops.keys()].filter((key) => key.startsWith(prefix)).forEach((key) => this.stopLoop(key, fadeSeconds));
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

  update(deltaSeconds, { camera = null, player = null, dungeon = null, locationId = null, controls = null, paused = false } = {}) {
    if (paused || this.paused) return;
    this.updateListener(camera);
    this.updateLocationChange(locationId);
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
    this.stopLoopsWithPrefix('location:', 0.65);
    this.stopLoopsWithPrefix('folsom:', 0.45);
    this.stopLoopsWithPrefix('beneath:', 0.45);
    this.stopLoopsWithPrefix('footsteps:', 0.2);
    this.previousPlayerPosition = null;
    this.previousLowerShrineZone = null;
    this.previousLocationId = locationId;
  }

  handleLocationTransition(locationId) {
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
    if (!this.paused && context.state === 'suspended') this.unlock();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.masterGain) this.fadeGain(this.masterGain, this.muted ? 0.0001 : BUS_DEFAULTS.master, 0.12);
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

  dispose() {
    const target = this.root ?? window;
    ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
      target.removeEventListener?.(eventName, this.boundUnlock);
    });
    document.removeEventListener('visibilitychange', this.boundVisibility);
    [...this.loops.keys()].forEach((key) => this.stopLoop(key, 0.05));
    this.oneShotNodes.forEach(({ source, gain, panner }) => {
      try { source.stop(); } catch {}
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
    });
    this.oneShotNodes.clear();
    this.context?.close?.();
    this.context = null;
  }
}

export { AUDIO_CUE_MANIFEST };
