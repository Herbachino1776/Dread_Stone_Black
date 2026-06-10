import * as THREE from 'three';
import { loadDungeonModel } from '../../game/ModelLoader.js';

const DEFAULT_ONE_SHOT_STATES = Object.freeze([
  'attack',
  'punch_left',
  'punch_right',
  'cross_punch_left',
  'kick_right',
  'jump',
  'die',
  'dead',
]);

function chooseClipForState(state, clips = []) {
  const normalized = state.toLowerCase();
  const compact = normalized.replaceAll('_', '');
  return clips.find((candidate) => {
    const name = (candidate.name || '').toLowerCase();
    return name.includes(normalized) || name.replaceAll('_', '').includes(compact);
  }) ?? clips[0] ?? null;
}

function summarizeClips(clips = []) {
  return clips.map((clip) => ({
    name: clip.name || '(unnamed clip)',
    durationSeconds: Number(clip.duration.toFixed(3)),
    trackCount: clip.tracks.length,
  }));
}

export class CreatureAnimationSet {
  constructor({ config, rootGroup, materialProfile = null, onTrackLoaded = null } = {}) {
    this.config = config;
    this.rootGroup = rootGroup;
    this.materialProfile = materialProfile;
    this.onTrackLoaded = onTrackLoaded;
    this.tracks = {};
    this.mixers = [];
    this.currentState = null;
    this.currentRequestedState = null;
    this.missingStates = new Set();
    this.loadingStates = new Map();
    this.warnedFallbacks = new Set();
  }

  get animationFiles() {
    return this.config.assets?.animationFiles ?? {};
  }

  get animationProfile() {
    return this.config.animationProfile ?? {};
  }

  resolveState(requestedState) {
    if (this.animationFiles[requestedState]) return requestedState;
    const fallbackMap = {
      ...(this.config.assets?.fallbackAnimations ?? {}),
      ...(this.animationProfile.fallbackMapping ?? {}),
    };
    const fallback = fallbackMap[requestedState] ?? this.animationProfile.idle ?? 'idle';
    if (this.animationFiles[fallback]) return fallback;
    return Object.keys(this.animationFiles)[0] ?? requestedState;
  }

  loadStates(states = []) {
    const uniqueStates = [...new Set(states.map((state) => this.resolveState(state)).filter(Boolean))];
    return Promise.all(uniqueStates.map((state) => this.loadState(state).catch((error) => {
      this.missingStates.add(state);
      if (import.meta.env.DEV) {
        console.warn(`Creature ${this.config.id} animation "${state}" failed to load.`, error);
      }
      return null;
    })));
  }

  loadState(state) {
    const resolvedState = this.resolveState(state);
    if (this.tracks[resolvedState]) return Promise.resolve(this.tracks[resolvedState]);
    if (this.loadingStates.has(resolvedState)) return this.loadingStates.get(resolvedState);

    const url = this.animationFiles[resolvedState];
    if (!url) {
      this.missingStates.add(resolvedState);
      return Promise.reject(new Error(`Missing animation file for ${this.config.id}:${resolvedState}`));
    }

    const scale = this.config.scale ?? {};
    const loadPromise = loadDungeonModel({
      url,
      targetHeight: scale.targetHeight,
      maxWidth: scale.maxWidth,
      scaleMultiplier: scale.scaleMultiplier,
      groundOffset: scale.groundOffset,
      yOffset: scale.yOffset,
    }).then((model) => {
      const track = this.createTrack(resolvedState, model);
      this.tracks[resolvedState] = track;
      this.mixers.push(track.mixer);
      this.rootGroup.add(track.root);
      this.onTrackLoaded?.(resolvedState, track);
      return track;
    }).finally(() => {
      this.loadingStates.delete(resolvedState);
    });

    this.loadingStates.set(resolvedState, loadPromise);
    return loadPromise;
  }

  createTrack(state, { root, gltf, scale, box }) {
    root.name = `${this.config.id}-${state}-model`;
    root.visible = false;
    root.rotation.y += this.config.scale?.rotationOffset ?? 0;
    const materialSummary = this.materialProfile?.apply(root) ?? null;

    const mixer = new THREE.AnimationMixer(root);
    const clips = gltf.animations ?? [];
    const clip = chooseClipForState(state, clips);
    let action = null;

    if (clip) {
      action = mixer.clipAction(clip);
      const oneShotStates = this.animationProfile.oneShotStates ?? DEFAULT_ONE_SHOT_STATES;
      const isOneShot = oneShotStates.includes(state);
      action.setLoop(isOneShot ? THREE.LoopOnce : THREE.LoopRepeat, isOneShot ? 1 : Infinity);
      action.clampWhenFinished = isOneShot;
      action.enabled = true;
    }

    return {
      state,
      root,
      mixer,
      action,
      clip,
      scale,
      box,
      materialSummary,
      clipNames: clips.map((candidate) => candidate.name || '(unnamed clip)'),
      clipSummaries: summarizeClips(clips),
    };
  }

  setState(requestedState, { force = false, fadeSeconds = null } = {}) {
    const resolvedState = this.resolveState(requestedState);
    const nextTrack = this.tracks[resolvedState];
    if (!nextTrack) {
      this.loadState(resolvedState).then(() => this.setState(requestedState, { force: true, fadeSeconds })).catch(() => {});
      return false;
    }

    if (!force && this.currentState === resolvedState && this.currentRequestedState === requestedState) {
      nextTrack.action?.play();
      return true;
    }

    const previousTrack = this.currentState ? this.tracks[this.currentState] : null;
    Object.entries(this.tracks).forEach(([state, track]) => {
      track.root.visible = state === resolvedState;
    });

    const fade = fadeSeconds ?? this.animationProfile.fadeDurations?.[requestedState] ?? this.animationProfile.defaultFadeSeconds ?? 0.12;
    if (previousTrack === nextTrack) {
      nextTrack.action?.play();
    } else {
      nextTrack.action?.reset().fadeIn(fade).play();
      previousTrack?.action?.fadeOut(fade);
    }

    this.currentState = resolvedState;
    this.currentRequestedState = requestedState;
    return true;
  }

  update(deltaSeconds) {
    this.mixers.forEach((mixer) => mixer.update(deltaSeconds));
  }

  getDuration(state = this.currentState, fallback = 0) {
    const resolvedState = state ? this.resolveState(state) : state;
    return this.tracks[resolvedState]?.clip?.duration || fallback;
  }

  getLoadedStates() {
    return Object.keys(this.tracks);
  }

  getMissingStates() {
    return [...this.missingStates];
  }

  dispose() {
    Object.values(this.tracks).forEach((track) => {
      track.action?.stop();
      this.rootGroup.remove(track.root);
    });
    this.tracks = {};
    this.mixers = [];
    this.currentState = null;
    this.currentRequestedState = null;
  }
}
