import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EQUIPMENT_EVENTS } from '../../engine/equipment/EquipmentEvents.js';
import { loadDungeonModel } from '../ModelLoader.js';
import { NECK_MAN_ANIMATION_FILES, neckManConfig } from '../creatures/neckMan.config.js';

const gltfLoader = new GLTFLoader();
const RIGHT_HAND_BONE = 'arm_right_hand';
const BROADSWORD_FPV_PROFILE_ID = 'broadsword_ritual_01';
const BROADSWORD_WEAPON_IDS = new Set(['broadsword_ritual_01', 'rusted_sword']);

function publicAssetUrl(path) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\.\//, '')}`;
}

function loadGltf(url) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, resolve, undefined, reject);
  });
}

function chooseClipForState(state, clips = []) {
  const normalized = state.toLowerCase();
  const compact = normalized.replaceAll('_', '');
  return clips.find((candidate) => {
    const name = (candidate.name || '').toLowerCase();
    return name.includes(normalized) || name.replaceAll('_', '').includes(compact);
  }) ?? clips[0] ?? null;
}

function makeAvatarMaterialsSafe(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.frustumCulled = false;
    child.castShadow = false;
    child.receiveShadow = true;
  });
}

function makeSwordMaterialsSafe(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.frustumCulled = false;
    child.castShadow = false;
    child.receiveShadow = false;
    const materials = Array.isArray(child.material) ? child.material : [child.material].filter(Boolean);
    materials.forEach((material) => {
      if ('roughness' in material) material.roughness = Math.max(material.roughness ?? 0.72, 0.64);
      if ('metalness' in material) material.metalness = Math.max(material.metalness ?? 0.12, 0.18);
      material.needsUpdate = true;
    });
  });
}

function removeRootMotionTracks(clip, rootName) {
  if (!clip) return null;
  const filteredTracks = clip.tracks.filter((track) => {
    const trackName = track.name ?? '';
    return !(
      trackName === '.position'
      || trackName === `${rootName}.position`
      || trackName.endsWith(':position')
      || (trackName.endsWith('.position') && trackName.includes(rootName))
    );
  });
  if (filteredTracks.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(`${clip.name}_NoRootMotion`, clip.duration, filteredTracks);
}

function isSwordProfile(profile) {
  return Boolean(
    profile
    && (
      profile.weaponType === 'sword'
      || BROADSWORD_WEAPON_IDS.has(profile.id)
      || profile.fpvProfileId === BROADSWORD_FPV_PROFILE_ID
    ),
  );
}

export const THIRD_PERSON_NECKMAN_PLAYER_CONFIG = Object.freeze({
  animationFiles: Object.freeze({
    idle: publicAssetUrl(NECK_MAN_ANIMATION_FILES.idle),
    walk: publicAssetUrl(NECK_MAN_ANIMATION_FILES.walk),
    run: publicAssetUrl(NECK_MAN_ANIMATION_FILES.run),
    attack: publicAssetUrl(NECK_MAN_ANIMATION_FILES.punch_right ?? NECK_MAN_ANIMATION_FILES.punch_left),
  }),
  weaponModelUrl: `${import.meta.env.BASE_URL}assets/models/weapons/weapon_broadsword_ritual_01.glb`,
  attackAnimationState: 'attack',
  attackSourceAnimationName: 'punch_right',
  avatarScale: 0.78,
  avatarPositionOffset: Object.freeze({ x: 0, y: 0, z: 0 }),
  avatarRotationOffset: 0,
  groundOffset: 0,
  playerEyeHeight: 1.55,
  targetHeight: neckManConfig.scale.targetHeight,
  maxWidth: neckManConfig.scale.maxWidth,
  turnSmoothing: 10,
  rootMotionEpsilon: 0.00001,
  runInputThreshold: 0.72,
  defaultFadeSeconds: 0.1,
  attackFallbackDuration: 0.72,
  swordPositionOffset: Object.freeze({ x: 0.02, y: -0.045, z: -0.018 }),
  swordRotationOffset: Object.freeze({ x: -1.36, y: 0.16, z: 0.22 }),
  swordScale: 52,
});

export class ThirdPersonNeckmanPlayerAvatar {
  constructor({
    scene,
    player,
    equipmentRuntime,
    config = THIRD_PERSON_NECKMAN_PLAYER_CONFIG,
  }) {
    this.scene = scene;
    this.player = player;
    this.equipmentRuntime = equipmentRuntime;
    this.config = config;
    this.root = new THREE.Group();
    this.root.name = 'ThirdPersonNeckmanPlayerAvatar';
    this.tracks = new Map();
    this.currentState = null;
    this.currentWeaponProfile = this.equipmentRuntime?.getEquippedWeaponProfile?.() ?? null;
    this.swordSource = null;
    this.swordHolders = [];
    this.isLoaded = false;
    this.isAttacking = false;
    this.attackElapsed = 0;
    this.lastFacingDirection = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));

    this.scene.add(this.root);
    this.unsubscribeEquipment = this.equipmentRuntime?.on?.(EQUIPMENT_EVENTS.equippedChanged, ({ weaponProfile }) => {
      this.setWeaponProfile(weaponProfile);
    });
    this.setWeaponProfile(this.currentWeaponProfile);
    this.load();
  }

  async load() {
    try {
      const states = Object.keys(this.config.animationFiles);
      const [swordGltf] = await Promise.all([
        loadGltf(this.config.weaponModelUrl),
        ...states.map((state) => this.loadTrack(state)),
      ]);
      this.installSwordSource(swordGltf);
      this.tracks.forEach((track) => this.attachSwordToTrack(track));
      this.setState('idle', { force: true });
      this.isLoaded = true;
      this.updateWeaponVisibility();
    } catch (error) {
      console.warn('Third-person Neckman player avatar failed to load.', error);
    }
  }

  async loadTrack(state) {
    const sourceState = state === this.config.attackAnimationState
      ? this.config.attackSourceAnimationName
      : state;
    const model = await loadDungeonModel({
      url: this.config.animationFiles[state],
      targetHeight: this.config.targetHeight,
      maxWidth: this.config.maxWidth,
      scaleMultiplier: this.config.avatarScale,
      groundOffset: this.config.groundOffset,
      yOffset: 0,
    });
    const track = this.createTrack(state, sourceState, model);
    this.tracks.set(state, track);
    this.root.add(track.root);
    this.attachSwordToTrack(track);
    return track;
  }

  createTrack(state, sourceState, { root, gltf, scale, box }) {
    root.name = `third-person-neckman-player-${state}`;
    root.visible = false;
    root.rotation.y += this.config.avatarRotationOffset;
    makeAvatarMaterialsSafe(root);

    const mixer = new THREE.AnimationMixer(root);
    const sourceClip = chooseClipForState(sourceState, gltf.animations ?? []);
    const clip = removeRootMotionTracks(sourceClip, root.name);
    const action = clip ? mixer.clipAction(clip) : null;
    const isAttack = state === this.config.attackAnimationState;
    if (action) {
      action.setLoop(isAttack ? THREE.LoopOnce : THREE.LoopRepeat, isAttack ? 1 : Infinity);
      action.clampWhenFinished = isAttack;
      action.enabled = true;
    }
    mixer.addEventListener('finished', () => {
      if (this.currentState === state && isAttack) {
        this.isAttacking = false;
        this.attackElapsed = Infinity;
      }
    });

    return {
      state,
      sourceState,
      root,
      mixer,
      action,
      clip,
      scale,
      box,
      swordHolder: null,
      handBoneName: RIGHT_HAND_BONE,
      clipName: clip?.name ?? null,
    };
  }

  installSwordSource(gltf) {
    const root = gltf.scene ?? gltf.scenes?.[0];
    if (!root) throw new Error(`Sword GLB loaded without a scene: ${this.config.weaponModelUrl}`);
    root.name = 'ThirdPersonRitualBroadswordSource';
    makeSwordMaterialsSafe(root);
    this.swordSource = root;
  }

  attachSwordToTrack(track) {
    if (!this.swordSource || track.swordHolder) return;
    const hand = track.root.getObjectByName(RIGHT_HAND_BONE);
    if (!hand) {
      console.warn(`Third-person Neckman player could not find "${RIGHT_HAND_BONE}" on ${track.state}.`);
      return;
    }
    const holder = new THREE.Group();
    holder.name = `ThirdPersonSwordHolder_${track.state}`;
    const sword = this.swordSource.clone(true);
    sword.name = `ThirdPersonRitualBroadsword_${track.state}`;
    holder.add(sword);
    hand.add(holder);
    track.swordHolder = holder;
    this.swordHolders.push(holder);
    this.applySwordTransform(holder);
    this.updateWeaponVisibility();
  }

  applySwordTransform(holder) {
    holder.position.set(
      this.config.swordPositionOffset.x,
      this.config.swordPositionOffset.y,
      this.config.swordPositionOffset.z,
    );
    holder.rotation.set(
      this.config.swordRotationOffset.x,
      this.config.swordRotationOffset.y,
      this.config.swordRotationOffset.z,
    );
    holder.scale.setScalar(this.config.swordScale);
  }

  setWeaponProfile(weaponProfile) {
    this.currentWeaponProfile = weaponProfile ?? null;
    this.updateWeaponVisibility();
  }

  updateWeaponVisibility() {
    const visible = isSwordProfile(this.currentWeaponProfile);
    this.swordHolders.forEach((holder) => {
      holder.visible = visible;
    });
  }

  playAttack(weaponProfile) {
    if (weaponProfile) this.setWeaponProfile(weaponProfile);
    this.isAttacking = true;
    this.attackElapsed = 0;
    this.setState(this.config.attackAnimationState, { force: true });
  }

  setState(state, { force = false } = {}) {
    const track = this.tracks.get(state);
    if (!track) return false;
    if (!force && this.currentState === state) {
      track.action?.play();
      return true;
    }

    this.tracks.forEach((candidate) => {
      candidate.root.visible = candidate === track;
    });
    track.action?.reset().fadeIn(this.config.defaultFadeSeconds).play();
    this.currentState = state;
    return true;
  }

  resolveLocomotionState() {
    const input = this.player.lastMoveInput ?? { x: 0, y: 0 };
    const moving = Math.hypot(input.x, input.y) > 0.08;
    if (!moving) return 'idle';
    if (Math.hypot(input.x, input.y) >= this.config.runInputThreshold && this.tracks.has('run')) return 'run';
    return this.tracks.has('walk') ? 'walk' : 'idle';
  }

  updateFacing(deltaSeconds) {
    const movementDirection = this.player.getMovementDirection?.();
    const targetDirection = movementDirection ?? this.player.getLookDirection();
    if (targetDirection?.lengthSq?.() > 0.0001) this.lastFacingDirection.copy(targetDirection).normalize();
    const desiredYaw = Math.atan2(this.lastFacingDirection.x, this.lastFacingDirection.z) + this.config.avatarRotationOffset;
    const yawDelta = THREE.MathUtils.euclideanModulo(desiredYaw - this.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    const alpha = 1 - Math.exp(-this.config.turnSmoothing * deltaSeconds);
    this.root.rotation.y += yawDelta * alpha;
    this.root.rotation.y = THREE.MathUtils.euclideanModulo(this.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
  }

  updatePosition() {
    this.root.position.set(
      this.player.position.x + this.config.avatarPositionOffset.x,
      this.player.position.y - this.config.playerEyeHeight + this.config.avatarPositionOffset.y,
      this.player.position.z + this.config.avatarPositionOffset.z,
    );
  }

  neutralizeRootMotion() {
    this.tracks.forEach((track) => {
      if (track.root.position.lengthSq() > this.config.rootMotionEpsilon) {
        track.root.position.set(0, 0, 0);
      }
    });
  }

  update(deltaSeconds) {
    this.updatePosition();
    this.updateFacing(deltaSeconds);

    this.tracks.forEach((track) => track.mixer.update(deltaSeconds));
    this.neutralizeRootMotion();
    if (this.isAttacking) {
      this.attackElapsed += deltaSeconds;
      const duration = this.tracks.get(this.config.attackAnimationState)?.clip?.duration ?? this.config.attackFallbackDuration;
      if (this.attackElapsed >= duration) {
        this.isAttacking = false;
        this.attackElapsed = Infinity;
      }
      return;
    }

    this.setState(this.resolveLocomotionState());
  }

  getDebugInfo() {
    return {
      loaded: this.isLoaded,
      currentState: this.currentState,
      weaponVisible: isSwordProfile(this.currentWeaponProfile),
      animationAssets: this.config.animationFiles,
      rootMotionNeutralized: true,
      loadedTracks: [...this.tracks.values()].map((track) => ({
        state: track.state,
        sourceState: track.sourceState,
        clipName: track.clipName,
        hasSwordHolder: Boolean(track.swordHolder),
      })),
    };
  }

  dispose() {
    this.unsubscribeEquipment?.();
    this.tracks.forEach((track) => {
      track.action?.stop();
      this.root.remove(track.root);
    });
    if (this.root.parent) this.root.parent.remove(this.root);
  }
}
