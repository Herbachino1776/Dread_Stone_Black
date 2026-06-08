import * as THREE from 'three';
import { loadDungeonModel } from './ModelLoader.js';

export const SHEEP_DEMON_ANIMATION_ASSETS = Object.freeze({
  idle: './assets/enemies/sheep_demon/sheep_demon_01_optimized_idle.glb',
  walk: './assets/enemies/sheep_demon/sheep_demon_01_optimized_walk.glb',
  crouch_walk: './assets/enemies/sheep_demon/sheep_demon_01_optimized_crouch_walk.glb',
  run: './assets/enemies/sheep_demon/sheep_demon_01_optimized_run.glb',
  punch_left: './assets/enemies/sheep_demon/sheep_demon_01_optimized_punch_left.glb',
  jump: './assets/enemies/sheep_demon/sheep_demon_01_optimized_jump.glb',
  die: './assets/enemies/sheep_demon/sheep_demon_01_optimized_die.glb',
});

export const SHEEP_DEMON_STATES = Object.freeze({
  idle: 'idle',
  patrol: 'patrol',
  alert: 'alert',
  chase: 'chase',
  stalk: 'stalk',
  attack: 'attack',
  jump: 'jump',
  hurt_optional_placeholder: 'hurt_optional_placeholder',
  dead: 'dead',
});

const SHEEP_DEMON_STATE_TO_ANIMATION = Object.freeze({
  idle: 'idle',
  patrol: 'walk',
  alert: 'walk',
  chase: 'run',
  stalk: 'crouch_walk',
  attack: 'punch_left',
  jump: 'jump',
  hurt_optional_placeholder: 'idle',
  dead: 'die',
});

const SHEEP_DEMON_NEUTRAL_COLOR = new THREE.Color(0xffffff);
const SHEEP_DEMON_SHADOW_FILL = new THREE.Color(0x101217);
const SHEEP_DEMON_ASSET_STATES = Object.freeze(Object.keys(SHEEP_DEMON_ANIMATION_ASSETS));
const SHEEP_DEMON_DEV_KEYS = Object.freeze({
  Digit1: 'idle',
  Digit2: 'patrol',
  Digit3: 'chase',
  Digit4: 'stalk',
  Digit5: 'attack',
  Digit6: 'jump',
  Digit7: 'dead',
});

function tuneSheepDemonMaterialTexture(texture, colorSpace) {
  if (!texture) return false;

  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
  return true;
}

function tuneSheepDemonMaterials(root) {
  const tunedMaterials = new Set();
  const summary = {
    meshes: 0,
    materials: 0,
    baseColorMapsSetToSrgb: 0,
    nonColorMapsKeptLinear: 0,
    neutralizedColorMultipliers: 0,
  };

  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    summary.meshes += 1;
    const materials = Array.isArray(child.material) ? child.material : [child.material];

    materials.forEach((material) => {
      if (!material || tunedMaterials.has(material)) return;
      tunedMaterials.add(material);
      summary.materials += 1;

      if (tuneSheepDemonMaterialTexture(material.map, THREE.SRGBColorSpace)) {
        summary.baseColorMapsSetToSrgb += 1;
      }

      [
        material.normalMap,
        material.roughnessMap,
        material.metalnessMap,
        material.aoMap,
        material.bumpMap,
        material.displacementMap,
        material.alphaMap,
      ].forEach((texture) => {
        if (tuneSheepDemonMaterialTexture(texture, THREE.NoColorSpace)) {
          summary.nonColorMapsKeptLinear += 1;
        }
      });

      if (material.color instanceof THREE.Color) {
        if (!material.color.equals(SHEEP_DEMON_NEUTRAL_COLOR)) {
          summary.neutralizedColorMultipliers += 1;
        }
        material.color.copy(SHEEP_DEMON_NEUTRAL_COLOR);
      }

      // Sheep Demon readability pass: counteracts warm dungeon fill without changing Ram Man or global lighting.
      if ('emissive' in material && material.emissive instanceof THREE.Color) {
        material.emissive.copy(SHEEP_DEMON_SHADOW_FILL);
        material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.12);
      }

      if ('metalness' in material) {
        material.metalness = Math.min(material.metalness ?? 0, 0.02);
      }

      if ('roughness' in material) {
        material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.82, 0.78, 0.92);
      }

      material.needsUpdate = true;
    });
  });

  return summary;
}

export const SHEEP_DEMON_CONFIG = Object.freeze({
  id: 'sheep-demon-01',
  displayName: 'Sheep Demon',
  placement: 'R04 east crypt chamber in the first functional dungeon interior',
  startPosition: new THREE.Vector3(21.5, 0, -8.4),
  patrolPoints: Object.freeze([
    new THREE.Vector3(18.2, 0, -11.4),
    new THREE.Vector3(24.9, 0, -10.5),
    new THREE.Vector3(24.4, 0, -4.8),
    new THREE.Vector3(18.4, 0, -5.6),
  ]),
  targetHeight: 2.18,
  maxWidth: 1.5,
  modelYawOffset: 0,
  maxHealth: 45,
  playerAttackRange: 2.85,
  playerAttackArcRadians: THREE.MathUtils.degToRad(72),
  playerAttackDamage: 15,
  walkSpeed: 0.72,
  stalkSpeed: 0.42,
  runSpeed: 2.25,
  jumpSpeed: 1.85,
  turnSpeed: 5.8,
  pauseSeconds: 0.65,
  detectionRadius: 22,
  chaseRunRadius: 13.5,
  stalkRadius: 6.2,
  attackRange: 2.35,
  loseInterestRadius: 32,
  runBurstSeconds: 1.45,
  runCooldownSeconds: 2.25,
  attackDamage: 12,
  attackCooldownSeconds: 1.65,
  punchDamageWindow: Object.freeze({ start: 0.4, end: 0.65 }),
  jumpCooldownSeconds: 8.5,
  jumpChancePerSecond: 0.18,
  jumpMaxDistance: 2.2,
  jumpVisualHeight: 0.36,
});

function chooseClipForAnimation(assetState, clips) {
  const normalizedState = assetState.toLowerCase();
  const withoutUnderscore = normalizedState.replaceAll('_', '');

  return clips.find((candidate) => {
    const name = (candidate.name || '').toLowerCase();
    return name.includes(normalizedState) || name.replaceAll('_', '').includes(withoutUnderscore);
  }) ?? clips[0];
}

function makeAnimationTrack({ state, root, gltf, scale }) {
  const mixer = new THREE.AnimationMixer(root);
  const clips = gltf.animations ?? [];
  const clip = chooseClipForAnimation(state, clips);

  if (!clip) {
    console.warn(`Sheep Demon ${state} GLB loaded without animation clips.`);
    return { root, mixer, action: null, clip: null, clipNames: [], clipSummaries: [], scale };
  }

  const action = mixer.clipAction(clip);
  const isOneShot = ['punch_left', 'jump', 'die'].includes(state);
  action.setLoop(isOneShot ? THREE.LoopOnce : THREE.LoopRepeat, isOneShot ? 1 : Infinity);
  action.clampWhenFinished = isOneShot;
  action.enabled = true;

  return {
    root,
    mixer,
    action,
    clip,
    scale,
    clipNames: clips.map((candidate) => candidate.name || '(unnamed clip)'),
    clipSummaries: clips.map((candidate) => ({
      name: candidate.name || '(unnamed clip)',
      durationSeconds: Number(candidate.duration.toFixed(3)),
      trackCount: candidate.tracks.length,
    })),
  };
}

function horizontalDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export class SheepDemonEnemy {
  constructor({ scene, collision, config = SHEEP_DEMON_CONFIG } = {}) {
    this.scene = scene;
    this.collision = collision;
    this.config = config;
    this.group = null;
    this.animation = null;
    this.behaviorState = null;
    this.patrolTargetIndex = 1;
    this.pauseTimer = 0;
    this.attackCooldown = 0;
    this.attackElapsed = 0;
    this.attackHasDamaged = false;
    this.runBurstTimer = 0;
    this.runCooldown = 0;
    this.jumpCooldown = 2.5;
    this.jumpElapsed = 0;
    this.jumpDuration = 0.8;
    this.jumpDirection = new THREE.Vector3();
    this.health = this.config.maxHealth;
    this.hasDetectedPlayer = false;
    this.isLoaded = false;
    this.loadError = null;
    this.devForcedState = null;
    this.debugKeyHandler = null;
  }

  load() {
    const loadRequests = SHEEP_DEMON_ASSET_STATES.map((state) => (
      loadDungeonModel({
        url: SHEEP_DEMON_ANIMATION_ASSETS[state],
        targetHeight: this.config.targetHeight,
        maxWidth: this.config.maxWidth,
      }).then((model) => [state, model])
    ));

    return Promise.all(loadRequests)
      .then((entries) => {
        const enemyRig = new THREE.Group();
        enemyRig.name = this.config.id;
        enemyRig.position.copy(this.config.startPosition);
        enemyRig.rotation.y = this.config.modelYawOffset;

        const materialTuning = {};
        const tracks = {};
        const mixers = [];
        const normalizedScale = {};

        entries.forEach(([state, model]) => {
          model.root.name = `${this.config.id}-${state}-model`;
          model.root.visible = false;
          materialTuning[state] = tuneSheepDemonMaterials(model.root);
          const track = makeAnimationTrack({ state, ...model });
          tracks[state] = track;
          mixers.push(track.mixer);
          normalizedScale[state] = model.scale;
          enemyRig.add(model.root);
        });

        enemyRig.userData = {
          hostile: true,
          displayName: this.config.displayName,
          placement: this.config.placement,
          assetUrls: SHEEP_DEMON_ANIMATION_ASSETS,
          activeAnimations: SHEEP_DEMON_ASSET_STATES,
          // Animation prototype strategy: each uploaded GLB is loaded as its own normalized scene under one enemy rig.
          // Swapping child visibility is safer for this asset set than retargeting clips across possibly mismatched skeleton/node names.
          animationStrategy: 'separate GLB scenes are swapped inside one positioned Sheep Demon rig',
          animationClips: Object.fromEntries(SHEEP_DEMON_ASSET_STATES.map((state) => [state, tracks[state].clipNames])),
          animationClipDetails: Object.fromEntries(SHEEP_DEMON_ASSET_STATES.map((state) => [state, tracks[state].clipSummaries])),
          normalizedScale,
          materialTuning,
          groundingY: this.config.startPosition.y,
          targetHeight: this.config.targetHeight,
          maxWidth: this.config.maxWidth,
          rotationYOffsetRadians: this.config.modelYawOffset,
          stateMachine: Object.keys(SHEEP_DEMON_STATES),
          health: this.health,
          combat: {
            maxHealth: this.config.maxHealth,
            playerAttackDamage: this.config.playerAttackDamage,
            playerAttackRange: this.config.playerAttackRange,
            attackDamage: this.config.attackDamage,
            attackRange: this.config.attackRange,
            attackCooldownSeconds: this.config.attackCooldownSeconds,
            punchDamageWindow: this.config.punchDamageWindow,
          },
        };

        this.group = enemyRig;
        this.animation = { state: null, mixers, tracks };

        this.setBehaviorState('idle');
        this.scene.add(enemyRig);
        this.installDevAnimationKeys();
        this.isLoaded = true;
        console.info('Sheep Demon animation clips detected:', enemyRig.userData.animationClipDetails);
        console.info('Sheep Demon behavior prototype loaded:', enemyRig.userData);
      })
      .catch((error) => {
        this.loadError = error;
        console.warn('Sheep Demon GLBs failed to load. Enemy prototype was skipped.', error);
      });
  }

  installDevAnimationKeys() {
    if (typeof window === 'undefined' || this.debugKeyHandler) return;

    this.debugKeyHandler = (event) => {
      if (!event.altKey || !SHEEP_DEMON_DEV_KEYS[event.code]) return;
      event.preventDefault();
      const state = SHEEP_DEMON_DEV_KEYS[event.code];
      this.devForcedState = state === this.devForcedState ? null : state;
      if (state === 'dead') {
        this.kill();
      } else {
        this.setBehaviorState(this.devForcedState ?? 'idle', { force: true });
      }
      console.info(`Sheep Demon dev animation key: ${this.devForcedState ? `forced ${this.devForcedState}` : 'released to AI'}`);
    };

    window.addEventListener('keydown', this.debugKeyHandler);
  }

  update(deltaSeconds, playerPosition) {
    this.animation?.mixers.forEach((mixer) => mixer.update(deltaSeconds));
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaSeconds);
    this.runCooldown = Math.max(0, this.runCooldown - deltaSeconds);
    this.jumpCooldown = Math.max(0, this.jumpCooldown - deltaSeconds);

    if (!this.group || this.behaviorState === 'dead') return;

    if (this.devForcedState) {
      if (this.devForcedState !== 'attack' && this.devForcedState !== 'jump') return;
    }

    const toPlayer = playerPosition.clone().sub(this.group.position);
    toPlayer.y = 0;
    const playerDistance = toPlayer.length();
    const playerDirection = playerDistance > 0.001 ? toPlayer.clone().normalize() : new THREE.Vector3(0, 0, 1);

    if (this.behaviorState === 'attack') {
      this.updateAttack(deltaSeconds, playerDirection, playerDistance);
      return;
    }

    if (this.behaviorState === 'jump') {
      this.updateJump(deltaSeconds, playerPosition);
      return;
    }

    if (playerDistance <= this.config.detectionRadius) {
      this.hasDetectedPlayer = true;
    } else if (playerDistance >= this.config.loseInterestRadius) {
      if (this.hasDetectedPlayer) this.pauseTimer = this.config.pauseSeconds;
      this.hasDetectedPlayer = false;
      this.runBurstTimer = 0;
    }

    if (!this.hasDetectedPlayer) {
      this.updatePatrol(deltaSeconds);
      return;
    }

    this.faceDirection(playerDirection, deltaSeconds);

    if (playerDistance <= this.config.attackRange && this.attackCooldown <= 0) {
      this.beginAttack();
      return;
    }

    if (this.shouldJump(playerDistance, deltaSeconds)) {
      this.beginJump(playerDirection, playerDistance);
      return;
    }

    if (playerDistance <= this.config.stalkRadius) {
      this.setBehaviorState('stalk');
      if (playerDistance > this.config.attackRange * 0.82) {
        this.moveToward(playerDirection, this.config.stalkSpeed, deltaSeconds, playerDistance - this.config.attackRange * 0.78, 'stalk');
      }
      return;
    }

    if (playerDistance >= this.config.chaseRunRadius && this.runCooldown <= 0) {
      if (this.runBurstTimer <= 0) this.runBurstTimer = this.config.runBurstSeconds;
      this.runBurstTimer = Math.max(0, this.runBurstTimer - deltaSeconds);
      this.setBehaviorState('chase');
      this.moveToward(playerDirection, this.config.runSpeed, deltaSeconds, playerDistance - this.config.stalkRadius, 'chase');
      if (this.runBurstTimer <= 0) this.runCooldown = this.config.runCooldownSeconds;
      return;
    }

    this.runBurstTimer = 0;
    this.setBehaviorState(playerDistance > this.config.stalkRadius ? 'alert' : 'stalk');
    this.moveToward(playerDirection, this.config.walkSpeed, deltaSeconds, Math.max(0, playerDistance - this.config.stalkRadius * 0.85), 'alert');
  }

  updatePatrol(deltaSeconds) {
    if (this.pauseTimer > 0) {
      this.pauseTimer = Math.max(0, this.pauseTimer - deltaSeconds);
      this.setBehaviorState('idle');
      return;
    }

    const target = this.config.patrolPoints[this.patrolTargetIndex];
    const toTarget = target.clone().sub(this.group.position);
    toTarget.y = 0;
    const distance = toTarget.length();

    if (distance < 0.08) {
      this.patrolTargetIndex = (this.patrolTargetIndex + 1) % this.config.patrolPoints.length;
      this.pauseTimer = this.config.pauseSeconds;
      this.setBehaviorState('idle');
      return;
    }

    this.setBehaviorState('patrol');
    this.moveToward(toTarget.normalize(), this.config.walkSpeed, deltaSeconds, distance, 'patrol');
  }

  beginAttack() {
    this.attackElapsed = 0;
    this.attackHasDamaged = false;
    this.attackCooldown = this.config.attackCooldownSeconds;
    this.setBehaviorState('attack', { force: true });
  }

  updateAttack(deltaSeconds, playerDirection, playerDistance) {
    this.attackElapsed += deltaSeconds;
    this.faceDirection(playerDirection, deltaSeconds);

    const duration = this.getActionDuration('punch_left', 0.95);
    if (this.attackElapsed >= duration) {
      this.setBehaviorState(playerDistance <= this.config.stalkRadius ? 'stalk' : 'alert');
    }
  }

  shouldJump(playerDistance, deltaSeconds) {
    if (this.jumpCooldown > 0) return false;
    if (playerDistance <= this.config.attackRange * 1.1 || playerDistance >= this.config.stalkRadius + 3.5) return false;
    return Math.random() < this.config.jumpChancePerSecond * deltaSeconds;
  }

  beginJump(playerDirection, playerDistance) {
    this.jumpElapsed = 0;
    this.jumpDuration = this.getActionDuration('jump', 0.82);
    const sideBias = Math.random() < 0.45 ? (Math.random() < 0.5 ? -1 : 1) : 0;
    const sideDirection = new THREE.Vector3(playerDirection.z, 0, -playerDirection.x).multiplyScalar(sideBias * 0.55);
    this.jumpDirection.copy(playerDirection).add(sideDirection).normalize();
    if (playerDistance <= this.config.stalkRadius) this.jumpDirection.multiplyScalar(0.65);
    this.jumpCooldown = this.config.jumpCooldownSeconds;
    this.setBehaviorState('jump', { force: true });
  }

  updateJump(deltaSeconds, playerPosition) {
    this.jumpElapsed += deltaSeconds;
    const progress = THREE.MathUtils.clamp(this.jumpElapsed / Math.max(this.jumpDuration, 0.001), 0, 1);
    const remainingBudget = this.config.jumpMaxDistance * deltaSeconds / Math.max(this.jumpDuration, 0.001);
    this.moveToward(this.jumpDirection, this.config.jumpSpeed, deltaSeconds, remainingBudget, 'jump', false);
    this.group.position.y = this.config.startPosition.y + Math.sin(progress * Math.PI) * this.config.jumpVisualHeight;

    const face = playerPosition.clone().sub(this.group.position);
    face.y = 0;
    if (face.lengthSq() > 0.001) this.faceDirection(face.normalize(), deltaSeconds);

    if (progress >= 1) {
      this.group.position.y = this.config.startPosition.y;
      const distance = horizontalDistance(this.group.position, playerPosition);
      this.setBehaviorState(distance <= this.config.stalkRadius ? 'stalk' : 'alert');
    }
  }

  moveToward(direction, speed, deltaSeconds, maxDistance = Infinity, movingState = 'patrol', updateAnimation = true) {
    const stepDistance = Math.min(maxDistance, speed * deltaSeconds);
    if (stepDistance <= 0.001) {
      if (updateAnimation) this.setBehaviorState(this.hasDetectedPlayer ? 'alert' : 'idle');
      return;
    }

    const next = this.group.position.clone().add(direction.clone().multiplyScalar(stepDistance));
    next.y = this.config.startPosition.y;

    if (this.collision.canStandAt(next)) {
      this.group.position.copy(next);
      if (updateAnimation) this.setBehaviorState(movingState);
    } else {
      this.pauseTimer = this.config.pauseSeconds;
      this.runBurstTimer = 0;
      if (updateAnimation) this.setBehaviorState(this.hasDetectedPlayer ? 'alert' : 'idle');
    }

    this.faceDirection(direction, deltaSeconds);
  }

  faceDirection(direction, deltaSeconds) {
    const desiredYaw = Math.atan2(direction.x, direction.z) + this.config.modelYawOffset;
    this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, desiredYaw, this.config.turnSpeed, deltaSeconds);
  }

  setBehaviorState(state, { force = false } = {}) {
    if (!this.animation || (!force && this.behaviorState === state)) return;

    const animationState = SHEEP_DEMON_STATE_TO_ANIMATION[state] ?? 'idle';
    const nextTrack = this.animation.tracks[animationState];
    const previousTrack = this.animation.tracks[SHEEP_DEMON_STATE_TO_ANIMATION[this.behaviorState]];
    if (!nextTrack) return;

    Object.entries(this.animation.tracks).forEach(([trackState, track]) => {
      track.root.visible = trackState === animationState;
    });

    nextTrack.action?.reset().fadeIn(0.12).play();
    if (previousTrack?.action && previousTrack !== nextTrack) {
      previousTrack.action.fadeOut(0.12);
    }

    const previousState = this.behaviorState;
    this.behaviorState = state;
    if (this.group) {
      this.group.userData.behaviorState = state;
      this.group.userData.health = this.health;
    }
    if (previousState !== state) console.info(`Sheep Demon state: ${previousState} -> ${state} (${animationState})`);
  }

  getActionDuration(animationState, fallback) {
    return this.animation?.tracks[animationState]?.clip?.duration || fallback;
  }

  consumeContactDamage(playerPosition) {
    if (!this.group || this.behaviorState !== 'attack' || this.attackHasDamaged) return null;

    const duration = this.getActionDuration('punch_left', 0.95);
    const progress = this.attackElapsed / Math.max(duration, 0.001);
    const window = this.config.punchDamageWindow;
    if (progress < window.start || progress > window.end) return null;

    const distance = horizontalDistance(this.group.position, playerPosition);
    if (distance > this.config.attackRange) return null;

    this.attackHasDamaged = true;
    return {
      source: this.config.displayName,
      amount: this.config.attackDamage,
      distance,
      attackWindowProgress: Number(progress.toFixed(2)),
    };
  }

  receivePlayerAttack({ position, direction, damage = this.config.playerAttackDamage } = {}) {
    if (!this.group || this.behaviorState === 'dead') return null;

    const toEnemy = this.group.position.clone().sub(position);
    toEnemy.y = 0;
    const distance = toEnemy.length();
    if (distance > this.config.playerAttackRange) return null;

    const attackDirection = direction.clone();
    attackDirection.y = 0;
    if (attackDirection.lengthSq() > 0.001 && toEnemy.lengthSq() > 0.001) {
      const angle = attackDirection.normalize().angleTo(toEnemy.normalize());
      if (angle > this.config.playerAttackArcRadians * 0.5) return null;
    }

    this.health = Math.max(0, this.health - damage);
    this.hasDetectedPlayer = true;
    if (this.group) this.group.userData.health = this.health;

    if (this.health <= 0) {
      this.kill();
      return { target: this.config.displayName, damage, remainingHealth: 0, killed: true };
    }

    console.info(`Sheep Demon took ${damage} damage (${this.health}/${this.config.maxHealth} HP remaining).`);
    return { target: this.config.displayName, damage, remainingHealth: this.health, killed: false };
  }

  kill() {
    if (!this.group || this.behaviorState === 'dead') return;

    this.health = 0;
    this.attackHasDamaged = true;
    this.hasDetectedPlayer = false;
    this.group.position.y = this.config.startPosition.y;
    this.group.userData.health = 0;
    this.setBehaviorState('dead', { force: true });
    const dieAction = this.animation?.tracks.die?.action;
    if (dieAction) {
      dieAction.setLoop(THREE.LoopOnce, 1);
      dieAction.clampWhenFinished = true;
    }
    console.info('Sheep Demon died; body remains visible and damage is disabled.');
  }
}
