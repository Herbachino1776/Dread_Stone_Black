import * as THREE from 'three';

export const HUMANOID_ANIMATION_STATES = Object.freeze({
  holding: 'HOLDING',
  walking: 'WALKING',
  hurt: 'HURT',
  guarding: 'GUARDING',
  dying: 'DYING',
  dead: 'DEAD',
});

export const EXPORTED_REST_POSE_CLIP_NAME = 'DSB_RUNTIME_EXPORTED_REST_POSE';

const REQUIRED_KINDS = Object.freeze(['WALK', 'HURT_LEFT', 'HURT_RIGHT', 'DEATH']);
const TORSO_REGIONS = new Set(['upper_chest', 'lower_chest', 'abdomen']);

function normalizeClipToManifest(clip, metadata, fps) {
  const normalized = clip.clone();
  normalized.name = metadata.name;
  const startSeconds = Number(metadata.frame_start) / Math.max(1, Number(fps) || 24);
  normalized.tracks.forEach((track) => track.shift(-startSeconds));
  normalized.duration = Number(metadata.duration_seconds);
  return normalized;
}

function configureAction(action, metadata) {
  const repeats = metadata.loop === true;
  action.enabled = true;
  action.clampWhenFinished = metadata.hold_final_pose === true || metadata.return_to_previous_state === true;
  action.setLoop(repeats ? THREE.LoopRepeat : THREE.LoopOnce, repeats ? Infinity : 1);
  return action;
}

export function createExportedRestPoseClip(root, sourceClip, durationSeconds = 1) {
  if (!root || !sourceClip?.tracks?.length) throw new Error('Exported rest-pose holding requires a loaded rig and authored source clip');
  const tracks = [];
  const registeredTrackNames = new Set();
  sourceClip.tracks.forEach((sourceTrack) => {
    if (registeredTrackNames.has(sourceTrack.name)) return;
    const separator = sourceTrack.name.lastIndexOf('.');
    const nodeName = separator >= 0 ? sourceTrack.name.slice(0, separator) : '';
    const propertyName = separator >= 0 ? sourceTrack.name.slice(separator + 1) : '';
    if (!['position', 'quaternion', 'scale'].includes(propertyName)) return;
    const object = root.getObjectByName(nodeName);
    const property = object?.[propertyName];
    const values = property?.toArray?.();
    if (!object || !Array.isArray(values) || values.length !== sourceTrack.getValueSize()) {
      throw new Error(`Exported rest-pose holding cannot resolve ${sourceTrack.name}`);
    }
    const track = new sourceTrack.constructor(
      sourceTrack.name,
      [0, durationSeconds],
      [...values, ...values],
      sourceTrack.getInterpolation(),
    );
    tracks.push(track);
    registeredTrackNames.add(sourceTrack.name);
  });
  if (!tracks.length) throw new Error('Exported rest-pose holding resolved no transform tracks');
  return new THREE.AnimationClip(EXPORTED_REST_POSE_CLIP_NAME, durationSeconds, tracks);
}

export function resolveHurtKind({ regionId = '', localHitX = null, worldDirection = null } = {}) {
  if (regionId.startsWith('left_')) return 'HURT_LEFT';
  if (regionId.startsWith('right_')) return 'HURT_RIGHT';
  if (Number.isFinite(localHitX) && Math.abs(localHitX) > 0.015) return localHitX < 0 ? 'HURT_LEFT' : 'HURT_RIGHT';
  if (Number.isFinite(worldDirection?.x) && Math.abs(worldDirection.x) > 0.015) return worldDirection.x > 0 ? 'HURT_LEFT' : 'HURT_RIGHT';
  return 'HURT_LEFT';
}

export function resolveDeathIndex({ regionId = '', variation = 0 } = {}) {
  if (TORSO_REGIONS.has(regionId)) return 0;
  if (regionId === 'neck' || regionId === 'head' || regionId === 'face' || regionId === 'skull') return 1;
  return Math.abs(Math.trunc(Number(variation) || 0)) % 2;
}

export class HumanoidAnimationPackController {
  constructor({ mixer, animationPack, manifest, restPoseClip, fadeSeconds = 0.1, walkReferenceSpeed = 0.72 } = {}) {
    if (!mixer || !animationPack || !manifest || !restPoseClip) throw new Error('Authored humanoid animation controller requires a mixer, resolved pack, manifest, and exported rest pose');
    REQUIRED_KINDS.forEach((kind) => {
      if (!animationPack.entriesByKind.get(kind)?.length) throw new Error(`Authored humanoid animation pack is missing required kind ${kind}`);
    });
    if (animationPack.entriesByKind.get('WALK').length !== 1) throw new Error('Authored humanoid animation pack requires exactly one WALK clip');
    if (animationPack.entriesByKind.get('HURT_LEFT').length !== 1 || animationPack.entriesByKind.get('HURT_RIGHT').length !== 1) throw new Error('Authored humanoid animation pack requires one hurt clip per side');
    if (animationPack.entriesByKind.get('DEATH').length < 1) throw new Error('Authored humanoid animation pack requires at least one DEATH clip');

    this.mixer = mixer;
    this.animationPack = animationPack;
    this.manifest = manifest;
    this.fadeSeconds = Math.max(0, Number(fadeSeconds) || 0);
    this.walkReferenceSpeed = Math.max(0.01, Number(walkReferenceSpeed) || 0.72);
    this.actionsByName = new Map();
    this.metadataByAction = new Map();
    this.state = HUMANOID_ANIMATION_STATES.holding;
    this.moving = false;
    this.speed = 0;
    this.maximumSpeed = this.walkReferenceSpeed;
    this.activeOneShot = null;
    this.activeMetadata = null;
    this.selectedDeathName = null;
    this.hurtRecoveryCount = 0;
    this.deathCompleted = false;
    this.disposed = false;
    this.walkStopFadeRemaining = 0;

    animationPack.entriesByName.forEach((metadata) => {
      const sourceClip = animationPack.clipsByName.get(metadata.name);
      const clip = normalizeClipToManifest(sourceClip, metadata, manifest.fps);
      const action = configureAction(mixer.clipAction(clip), metadata);
      this.actionsByName.set(metadata.name, action);
      this.metadataByAction.set(action, metadata);
    });
    this.walkMetadata = animationPack.entriesByKind.get('WALK')[0];
    this.walkAction = this.actionsByName.get(this.walkMetadata.name);
    this.walkAction.stop();
    this.walkAction.paused = true;
    const idleMetadata = animationPack.entriesByKind.get('IDLE')?.[0] ?? null;
    this.idleMetadata = idleMetadata;
    this.restAction = idleMetadata ? this.actionsByName.get(idleMetadata.name) : mixer.clipAction(restPoseClip);
    this.restAction.enabled = true;
    this.restAction.clampWhenFinished = false;
    this.restAction.setLoop(THREE.LoopRepeat, Infinity);
    this.restAction.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    this.baseAction = this.restAction;
    this.finishedHandler = (event) => this.handleFinished(event.action);
    this.mixer.addEventListener('finished', this.finishedHandler);
  }

  setMovement({ speed = 0, maximumSpeed = this.walkReferenceSpeed, walking = false } = {}) {
    if (this.disposed || this.state === HUMANOID_ANIMATION_STATES.dying || this.state === HUMANOID_ANIMATION_STATES.dead) return false;
    const wasMoving = this.moving;
    this.speed = Math.max(0, Number(speed) || 0);
    this.maximumSpeed = Math.max(0.01, Number(maximumSpeed) || this.walkReferenceSpeed);
    this.moving = walking === true && this.speed > 0.025;
    const speedRatio = THREE.MathUtils.clamp(this.speed / this.walkReferenceSpeed, 0.65, 1.35);
    this.walkAction.setEffectiveTimeScale(this.moving ? speedRatio : 1);
    if (this.moving !== wasMoving && !this.activeOneShot) this.transitionToMovementBase();
    if (!this.activeOneShot) this.state = this.moving ? HUMANOID_ANIMATION_STATES.walking : HUMANOID_ANIMATION_STATES.holding;
    return true;
  }

  transitionToMovementBase() {
    const nextAction = this.moving ? this.walkAction : this.restAction;
    const previousAction = this.baseAction;
    nextAction.enabled = true;
    nextAction.paused = false;
    nextAction.reset().setEffectiveWeight(1).play();
    if (previousAction && previousAction !== nextAction) {
      if (this.fadeSeconds > 0) previousAction.crossFadeTo(nextAction, this.fadeSeconds, false);
      else previousAction.stop();
    }
    this.baseAction = nextAction;
    this.walkStopFadeRemaining = this.moving ? 0 : this.fadeSeconds;
    return nextAction;
  }

  playHurt(options = {}) {
    if (this.disposed || this.state === HUMANOID_ANIMATION_STATES.dying || this.state === HUMANOID_ANIMATION_STATES.dead) return null;
    const kind = resolveHurtKind(options);
    const metadata = this.animationPack.entriesByKind.get(kind)[0];
    if (this.state === HUMANOID_ANIMATION_STATES.hurt && this.activeMetadata?.approved_kind === kind) return null;
    return this.playOneShot(metadata, HUMANOID_ANIMATION_STATES.hurt);
  }

  playDeath({ regionId = '', variation = 0, deathIndex = null } = {}) {
    if (this.disposed || this.state === HUMANOID_ANIMATION_STATES.dying || this.state === HUMANOID_ANIMATION_STATES.dead) return null;
    const deaths = this.animationPack.entriesByKind.get('DEATH');
    const requestedIndex = Number.isInteger(deathIndex)
      ? THREE.MathUtils.clamp(deathIndex, 0, deaths.length - 1)
      : resolveDeathIndex({ regionId, variation });
    const index = THREE.MathUtils.clamp(requestedIndex, 0, deaths.length - 1);
    const metadata = deaths[index];
    this.selectedDeathName = metadata.name;
    this.deathCompleted = false;
    this.playOneShot(metadata, HUMANOID_ANIMATION_STATES.dying);
    return { name: metadata.name, durationSeconds: metadata.duration_seconds, holdFinalPose: metadata.hold_final_pose === true };
  }

  playGuard({ side = 'right' } = {}) {
    if (this.disposed || this.state === HUMANOID_ANIMATION_STATES.dying || this.state === HUMANOID_ANIMATION_STATES.dead) return null;
    const requested = side === 'left' ? 'MACE_GUARD_LEFT_ARM' : 'MACE_GUARD_RIGHT_ARM';
    const metadata = this.animationPack.entriesByKind.get(requested)?.[0]
      ?? this.animationPack.entriesByKind.get('MACE_GUARD_TWO_ARM')?.[0]
      ?? [...this.animationPack.entriesByKind.entries()].find(([kind]) => kind.startsWith('MACE_GUARD_'))?.[1]?.[0];
    if (!metadata || (this.state === HUMANOID_ANIMATION_STATES.guarding && this.activeMetadata === metadata)) return null;
    return this.playOneShot(metadata, HUMANOID_ANIMATION_STATES.guarding);
  }

  playOneShot(metadata, state) {
    const nextAction = this.actionsByName.get(metadata.name);
    if (!nextAction) return null;
    const previousAction = this.activeOneShot ?? this.baseAction;
    if (this.activeOneShot && this.activeOneShot !== nextAction) this.activeOneShot.fadeOut(this.fadeSeconds);
    nextAction.reset();
    configureAction(nextAction, metadata);
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);
    nextAction.play();
    if (previousAction !== nextAction) {
      if (this.fadeSeconds > 0) previousAction.crossFadeTo(nextAction, this.fadeSeconds, false);
      else previousAction.stop();
    }
    this.activeOneShot = nextAction;
    this.activeMetadata = metadata;
    this.state = state;
    return { name: metadata.name, durationSeconds: metadata.duration_seconds };
  }

  handleFinished(action) {
    if (action !== this.activeOneShot) return;
    const metadata = this.metadataByAction.get(action);
    if (metadata?.approved_kind === 'DEATH') {
      this.state = HUMANOID_ANIMATION_STATES.dead;
      this.deathCompleted = true;
      return;
    }
    if (metadata?.return_to_previous_state === true) {
      const baseAction = this.moving ? this.walkAction : this.restAction;
      baseAction.enabled = true;
      baseAction.paused = false;
      baseAction.setEffectiveWeight(1).play();
      if (this.fadeSeconds > 0) action.crossFadeTo(baseAction, this.fadeSeconds, false);
      else action.stop();
      this.activeOneShot = null;
      this.activeMetadata = null;
      this.baseAction = baseAction;
      this.walkStopFadeRemaining = this.moving ? 0 : this.fadeSeconds;
      this.state = this.moving ? HUMANOID_ANIMATION_STATES.walking : HUMANOID_ANIMATION_STATES.holding;
      this.hurtRecoveryCount += 1;
    }
  }

  update(deltaSeconds) {
    if (this.disposed) return;
    const dt = Math.max(0, Number(deltaSeconds) || 0);
    this.mixer.update(dt);
    if (this.walkStopFadeRemaining > 0) {
      this.walkStopFadeRemaining = Math.max(0, this.walkStopFadeRemaining - dt);
      if (this.walkStopFadeRemaining === 0 && !this.moving && this.baseAction === this.restAction) this.walkAction.paused = true;
    }
  }

  reset() {
    if (this.disposed) return;
    this.mixer.stopAllAction();
    this.activeOneShot = null;
    this.activeMetadata = null;
    this.selectedDeathName = null;
    this.deathCompleted = false;
    this.hurtRecoveryCount = 0;
    this.moving = false;
    this.speed = 0;
    this.walkAction.stop();
    this.walkAction.paused = true;
    this.restAction.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    this.baseAction = this.restAction;
    this.walkStopFadeRemaining = 0;
    this.state = HUMANOID_ANIMATION_STATES.holding;
  }

  getDiagnostics() {
    return {
      state: this.state,
      activeAnimation: this.activeMetadata?.name ?? (this.moving ? this.walkMetadata.name : null),
      holdingPose: this.moving || this.activeMetadata ? null : (this.idleMetadata?.name ?? 'exported_rest_pose'),
      holdingPoseClip: this.restAction.getClip().name,
      walkAnimation: this.walkMetadata.name,
      walkLooping: this.walkMetadata.loop === true,
      walkPaused: !this.walkAction.isRunning() || this.walkAction.paused,
      moving: this.moving,
      hurtRecoveryCount: this.hurtRecoveryCount,
      selectedDeathName: this.selectedDeathName,
      deathCompleted: this.deathCompleted,
      finalPoseHeld: this.state === HUMANOID_ANIMATION_STATES.dead && this.activeMetadata?.hold_final_pose === true,
      availableAnimationNames: [...this.actionsByName.keys()],
      ignoredAnimationNames: this.animationPack.ignoredEntries.map((entry) => entry.name),
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.removeEventListener('finished', this.finishedHandler);
    this.mixer.stopAllAction();
    this.actionsByName.clear();
    this.metadataByAction.clear();
    this.activeOneShot = null;
    this.activeMetadata = null;
  }
}
