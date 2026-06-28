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
  constructor({ config, rootGroup, materialProfile = null, onTrackLoaded = null, singleActorRoot = false } = {}) {
    this.config = config;
    this.rootGroup = rootGroup;
    this.materialProfile = materialProfile;
    this.onTrackLoaded = onTrackLoaded;
    this.tracks = {};
    this.mixers = [];
    this.currentState = null;
    this.currentRequestedState = null;
    this.previousFade = null;
    this.lastActiveMixerCount = 0;
    this.missingStates = new Set();
    this.loadingStates = new Map();
    this.warnedFallbacks = new Set();
    this.singleActorRoot = singleActorRoot;
    this.actorRootTrack = null;
    this.actorMixer = null;
    this.assetStrategy = this.config.assets?.clipBundle?.strategy ?? (this.singleActorRoot ? 'singleActorRoot-extracted-clips' : 'legacy-separate-roots');
    this.canonicalPath = this.config.assets?.clipBundle?.modelFile ?? this.config.assets?.canonicalModelFile ?? null;
    this.canonicalError = null;
    this.canonicalAttempted = false;
    this.canonicalDisabled = false;
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
    if (this.shouldUseCanonicalBundle()) {
      return this.loadCanonicalBundle(states).catch((error) => {
        this.canonicalError = error;
        this.canonicalDisabled = true;
        this.assetStrategy = 'singleActorRoot-extracted-clips';
        console.warn(`[CreatureAnimationSet] Canonical multi-clip GLB failed for ${this.config.id}: ${this.canonicalPath}. Falling back to legacy singleActorRoot extraction.`, error);
        return this.loadStates(states);
      });
    }
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
    if (this.shouldUseCanonicalBundle()) return this.loadCanonicalBundle([state]).then(() => this.tracks[this.resolveState(state)]);
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
      const track = this.singleActorRoot
        ? this.createSingleRootTrack(resolvedState, model)
        : this.createTrack(resolvedState, model);
      this.tracks[resolvedState] = track;
      if (!this.mixers.includes(track.mixer)) this.mixers.push(track.mixer);
      if (track.root && !track.root.parent) this.rootGroup.add(track.root);
      this.onTrackLoaded?.(resolvedState, track);
      return track;
    }).finally(() => {
      this.loadingStates.delete(resolvedState);
    });

    this.loadingStates.set(resolvedState, loadPromise);
    return loadPromise;
  }

  shouldUseCanonicalBundle() {
    return Boolean(this.config.assets?.clipBundle?.modelFile) && !this.canonicalDisabled;
  }

  resolveCanonicalClip(state, clips = []) {
    const map = this.animationProfile.mobileClipMap ?? this.config.assets?.clipBundle?.clipMap ?? {};
    const wanted = map[state] ?? state;
    const lowerWanted = String(wanted).toLowerCase();
    const exact = clips.find((clip) => String(clip.name ?? '').toLowerCase() === lowerWanted);
    return exact ?? chooseClipForState(wanted, clips);
  }

  loadCanonicalBundle(states = []) {
    const bundle = this.config.assets?.clipBundle ?? {};
    const url = bundle.modelFile ?? this.config.assets?.canonicalModelFile;
    const requiredStates = [...new Set([...(bundle.requiredClips ?? []), ...states].filter(Boolean))];
    if (requiredStates.every((state) => this.tracks[state])) return Promise.resolve(requiredStates.map((state) => this.tracks[state]));
    if (this.loadingStates.has('__canonical_bundle__')) return this.loadingStates.get('__canonical_bundle__');
    const scale = this.config.scale ?? {};
    this.canonicalAttempted = true;
    const loadPromise = loadDungeonModel({
      url,
      targetHeight: scale.targetHeight,
      maxWidth: scale.maxWidth,
      scaleMultiplier: scale.scaleMultiplier,
      groundOffset: scale.groundOffset,
      yOffset: scale.yOffset,
    }).then((model) => {
      const clips = model.gltf.animations ?? [];
      const clipNames = clips.map((clip) => clip.name || '(unnamed clip)');
      const missing = requiredStates.filter((state) => !this.resolveCanonicalClip(state, clips));
      if (missing.length) throw new Error(`Canonical multi-clip GLB ${url} is missing required clips/states: ${missing.join(', ')}. Available clips: ${clipNames.join(', ') || 'none'}.`);
      model.root.name = `${this.config.id}-canonical-mobile-actor-model`;
      model.root.visible = true;
      model.root.rotation.y += this.config.scale?.rotationOffset ?? 0;
      const materialSummary = this.materialProfile?.apply(model.root) ?? null;
      this.actorMixer = new THREE.AnimationMixer(model.root);
      const clipSummaries = summarizeClips(clips);
      requiredStates.forEach((state) => {
        const clip = this.resolveCanonicalClip(state, clips);
        const action = this.createActionForClipWithMixer(state, clip, this.actorMixer, model.root);
        this.tracks[state] = {
          state,
          root: model.root,
          mixer: this.actorMixer,
          action,
          clip,
          scale: model.scale,
          box: model.box,
          materialSummary,
          clipNames,
          clipSummaries,
          usesCanonicalClipBundle: true,
          canonicalPath: url,
        };
      });
      this.actorRootTrack = this.tracks[requiredStates[0]];
      if (!this.mixers.includes(this.actorMixer)) this.mixers.push(this.actorMixer);
      if (model.root && !model.root.parent) this.rootGroup.add(model.root);
      this.assetStrategy = 'canonical-multiclip';
      requiredStates.forEach((state) => this.onTrackLoaded?.(state, this.tracks[state]));
      return requiredStates.map((state) => this.tracks[state]);
    }).finally(() => this.loadingStates.delete('__canonical_bundle__'));
    this.loadingStates.set('__canonical_bundle__', loadPromise);
    return loadPromise;
  }

  createActionForClipWithMixer(state, clip, mixer, root = undefined) {
    if (!clip || !mixer) return null;
    const action = mixer.clipAction(clip, root);
    const oneShotStates = this.animationProfile.oneShotStates ?? DEFAULT_ONE_SHOT_STATES;
    const isOneShot = oneShotStates.includes(state);
    action.setLoop(isOneShot ? THREE.LoopOnce : THREE.LoopRepeat, isOneShot ? 1 : Infinity);
    action.clampWhenFinished = isOneShot;
    action.enabled = true;
    return action;
  }

  createSingleRootTrack(state, { root, gltf, scale, box }) {
    const clips = gltf.animations ?? [];
    const clip = chooseClipForState(state, clips);
    const clipNames = clips.map((candidate) => candidate.name || '(unnamed clip)');
    const clipSummaries = summarizeClips(clips);

    if (!this.actorRootTrack) {
      root.name = `${this.config.id}-mobile-actor-model`;
      root.visible = true;
      root.rotation.y += this.config.scale?.rotationOffset ?? 0;
      const materialSummary = this.materialProfile?.apply(root) ?? null;
      this.actorMixer = new THREE.AnimationMixer(root);
      const action = this.createActionForClip(state, clip);
      const track = {
        state,
        root,
        mixer: this.actorMixer,
        action,
        clip,
        scale,
        box,
        materialSummary,
        clipNames,
        clipSummaries,
        usesSharedActorRoot: true,
      };
      this.actorRootTrack = track;
      return track;
    }

    this.disposeDetachedModelRoot(root);
    return {
      state,
      root: this.actorRootTrack.root,
      mixer: this.actorMixer,
      action: this.createActionForClip(state, clip),
      clip,
      scale: this.actorRootTrack.scale ?? scale,
      box: this.actorRootTrack.box ?? box,
      materialSummary: this.actorRootTrack.materialSummary,
      clipNames,
      clipSummaries,
      usesSharedActorRoot: true,
      detachedSourceRootDisposed: true,
    };
  }

  createActionForClip(state, clip) {
    return this.createActionForClipWithMixer(state, clip, this.actorMixer, this.actorRootTrack?.root);
  }

  disposeDetachedModelRoot(root) {
    root?.traverse?.((child) => {
      if (!child.isMesh) return;
      child.geometry?.dispose?.();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.filter(Boolean).forEach((material) => material.dispose?.());
    });
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
    if (!this.singleActorRoot) {
      Object.entries(this.tracks).forEach(([state, track]) => {
        track.root.visible = state === resolvedState;
      });
    } else if (this.actorRootTrack?.root) {
      this.actorRootTrack.root.visible = true;
    }

    const fade = fadeSeconds ?? this.animationProfile.fadeDurations?.[requestedState] ?? this.animationProfile.defaultFadeSeconds ?? 0.12;
    if (previousTrack === nextTrack) {
      nextTrack.action?.play();
    } else {
      nextTrack.action?.reset().fadeIn(fade).play();
      previousTrack?.action?.fadeOut(fade);
      this.previousFade = previousTrack && fade > 0 ? { track: previousTrack, remaining: fade } : null;
    }

    this.currentState = resolvedState;
    this.currentRequestedState = requestedState;
    return true;
  }

  update(deltaSeconds) {
    const activeMixers = new Set();
    const currentTrack = this.currentState ? this.tracks[this.currentState] : null;
    if (currentTrack?.mixer) activeMixers.add(currentTrack.mixer);
    if (this.previousFade?.track?.mixer && this.previousFade.remaining > 0) {
      activeMixers.add(this.previousFade.track.mixer);
      this.previousFade.remaining -= deltaSeconds;
      if (this.previousFade.remaining <= 0) this.previousFade = null;
    }
    activeMixers.forEach((mixer) => mixer.update(deltaSeconds));
    this.lastActiveMixerCount = activeMixers.size;
  }

  getActiveMixerCount() {
    return this.lastActiveMixerCount;
  }

  getLoadedRootCount() {
    return this.singleActorRoot && this.actorRootTrack ? 1 : Object.keys(this.tracks).length;
  }

  getLiveAnimationRootCount() {
    return this.getLoadedRootCount();
  }

  getLiveSkinnedRootCount() {
    const root = this.singleActorRoot ? this.actorRootTrack?.root : this.rootGroup;
    let count = 0;
    root?.traverse?.((child) => { if (child.isSkinnedMesh) count += 1; });
    return count;
  }

  hasExtraStateRootsAlive() {
    if (this.assetStrategy === 'canonical-multiclip') return false;
    return this.singleActorRoot ? false : Object.keys(this.tracks).length > 1;
  }

  getAssetStrategy() {
    return this.assetStrategy;
  }

  getCanonicalPath() {
    return this.canonicalPath;
  }

  getActionCount() {
    return Object.values(this.tracks).filter((track) => track.action).length;
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
      if (!this.singleActorRoot || track === this.actorRootTrack) this.rootGroup.remove(track.root);
    });
    this.tracks = {};
    this.mixers = [];
    this.currentState = null;
    this.currentRequestedState = null;
    this.previousFade = null;
    this.lastActiveMixerCount = 0;
    this.actorRootTrack = null;
    this.actorMixer = null;
    this.assetStrategy = this.config.assets?.clipBundle?.strategy ?? (this.singleActorRoot ? 'singleActorRoot-extracted-clips' : 'legacy-separate-roots');
    this.canonicalPath = this.config.assets?.clipBundle?.modelFile ?? this.config.assets?.canonicalModelFile ?? null;
    this.canonicalError = null;
    this.canonicalAttempted = false;
    this.canonicalDisabled = false;
  }
}
