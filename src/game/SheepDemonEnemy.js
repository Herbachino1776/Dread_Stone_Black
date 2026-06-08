import * as THREE from 'three';
import { loadDungeonModel } from './ModelLoader.js';

export const SHEEP_DEMON_ANIMATION_ASSETS = Object.freeze({
  idle: './assets/enemies/sheep_demon/sheep_demon_01_optimized_idle.glb',
  walk: './assets/enemies/sheep_demon/sheep_demon_01_optimized_walk.glb',
  crouch_walk: './assets/enemies/sheep_demon/sheep_demon_01_optimized_crouch_walk.glb',
  die: './assets/enemies/sheep_demon/sheep_demon_01_optimized_die.glb',
  jump: './assets/enemies/sheep_demon/sheep_demon_01_optimized_jump.glb',
  punch_left: './assets/enemies/sheep_demon/sheep_demon_01_optimized_punch_left.glb',
  run: './assets/enemies/sheep_demon/sheep_demon_01_optimized_run.glb',
});

const SHEEP_DEMON_NEUTRAL_COLOR = new THREE.Color(0xffffff);
const SHEEP_DEMON_SHADOW_FILL = new THREE.Color(0x101217);

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
  walkSpeed: 0.62,
  chaseSpeed: 0.86,
  turnSpeed: 4.2,
  pauseSeconds: 0.65,
  detectionRadius: 11.5,
  leashRadius: 15,
  contactRadius: 1.05,
  contactDamage: 7,
  contactDamageCooldownSeconds: 1.35,
});

function makeAnimationTrack({ state, root, gltf, scale }) {
  const mixer = new THREE.AnimationMixer(root);
  const clips = gltf.animations ?? [];
  const clip = clips.find((candidate) => candidate.name.toLowerCase().includes(state)) ?? clips[0];

  if (!clip) {
    console.warn(`Sheep Demon ${state} GLB loaded without animation clips.`);
    return { root, mixer, action: null, clip: null, clipNames: [], clipSummaries: [], scale };
  }

  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.clampWhenFinished = false;
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

export class SheepDemonEnemy {
  constructor({ scene, collision, config = SHEEP_DEMON_CONFIG } = {}) {
    this.scene = scene;
    this.collision = collision;
    this.config = config;
    this.group = null;
    this.animation = null;
    this.patrolTargetIndex = 1;
    this.pauseTimer = 0;
    this.contactCooldown = 0;
    this.isLoaded = false;
    this.loadError = null;
  }

  load() {
    return Promise.all([
      loadDungeonModel({ url: SHEEP_DEMON_ANIMATION_ASSETS.idle, targetHeight: this.config.targetHeight, maxWidth: this.config.maxWidth }),
      loadDungeonModel({ url: SHEEP_DEMON_ANIMATION_ASSETS.walk, targetHeight: this.config.targetHeight, maxWidth: this.config.maxWidth }),
    ])
      .then(([idleModel, walkModel]) => {
        idleModel.root.name = `${this.config.id}-idle-model`;
        walkModel.root.name = `${this.config.id}-walk-model`;
        walkModel.root.visible = false;

        const materialTuning = {
          idle: tuneSheepDemonMaterials(idleModel.root),
          walk: tuneSheepDemonMaterials(walkModel.root),
        };

        const idleTrack = makeAnimationTrack({ state: 'idle', ...idleModel });
        const walkTrack = makeAnimationTrack({ state: 'walk', ...walkModel });
        const enemyRig = new THREE.Group();
        enemyRig.name = this.config.id;
        enemyRig.position.copy(this.config.startPosition);
        enemyRig.rotation.y = this.config.modelYawOffset;
        enemyRig.userData = {
          hostile: true,
          displayName: this.config.displayName,
          placement: this.config.placement,
          assetUrls: SHEEP_DEMON_ANIMATION_ASSETS,
          activeAnimations: ['idle', 'walk'],
          reservedAnimations: ['crouch_walk', 'die', 'jump', 'punch_left', 'run'],
          // TODO: wire punch_left/die/run into a deliberate combat animation state machine later.
          animationClips: {
            idle: idleTrack.clipNames,
            walk: walkTrack.clipNames,
          },
          animationClipDetails: {
            idle: idleTrack.clipSummaries,
            walk: walkTrack.clipSummaries,
          },
          normalizedScale: {
            idle: idleModel.scale,
            walk: walkModel.scale,
          },
          materialTuning,
          groundingY: this.config.startPosition.y,
          targetHeight: this.config.targetHeight,
          maxWidth: this.config.maxWidth,
          rotationYOffsetRadians: this.config.modelYawOffset,
          behavior: 'patrols the east chamber, then slowly chases nearby players with walk animation only',
          contactDamage: {
            enabled: true,
            amount: this.config.contactDamage,
            radius: this.config.contactRadius,
            cooldownSeconds: this.config.contactDamageCooldownSeconds,
          },
        };
        enemyRig.add(idleModel.root, walkModel.root);

        this.group = enemyRig;
        this.animation = {
          state: null,
          mixers: [idleTrack.mixer, walkTrack.mixer],
          tracks: {
            idle: idleTrack,
            walk: walkTrack,
          },
        };

        this.setAnimation('idle');
        this.scene.add(enemyRig);
        this.isLoaded = true;
        console.info('Sheep Demon prototype loaded:', enemyRig.userData);
      })
      .catch((error) => {
        this.loadError = error;
        console.warn('Sheep Demon idle/walk GLBs failed to load. Enemy prototype was skipped.', error);
      });
  }

  update(deltaSeconds, playerPosition) {
    this.animation?.mixers.forEach((mixer) => mixer.update(deltaSeconds));
    this.contactCooldown = Math.max(0, this.contactCooldown - deltaSeconds);

    if (!this.group) return;

    const toPlayer = playerPosition.clone().sub(this.group.position);
    toPlayer.y = 0;
    const playerDistance = toPlayer.length();
    const shouldChase = playerDistance <= this.config.detectionRadius
      && this.config.startPosition.distanceTo(this.group.position) <= this.config.leashRadius;

    if (shouldChase && playerDistance > this.config.contactRadius * 0.92) {
      this.moveToward(toPlayer.normalize(), this.config.chaseSpeed, deltaSeconds);
      return;
    }

    this.updatePatrol(deltaSeconds);
  }

  updatePatrol(deltaSeconds) {
    if (this.pauseTimer > 0) {
      this.pauseTimer = Math.max(0, this.pauseTimer - deltaSeconds);
      this.setAnimation('idle');
      return;
    }

    const target = this.config.patrolPoints[this.patrolTargetIndex];
    const toTarget = target.clone().sub(this.group.position);
    toTarget.y = 0;
    const distance = toTarget.length();

    if (distance < 0.08) {
      this.patrolTargetIndex = (this.patrolTargetIndex + 1) % this.config.patrolPoints.length;
      this.pauseTimer = this.config.pauseSeconds;
      this.setAnimation('idle');
      return;
    }

    this.moveToward(toTarget.normalize(), this.config.walkSpeed, deltaSeconds, distance);
  }

  moveToward(direction, speed, deltaSeconds, maxDistance = Infinity) {
    const stepDistance = Math.min(maxDistance, speed * deltaSeconds);
    const next = this.group.position.clone().add(direction.clone().multiplyScalar(stepDistance));
    next.y = this.config.startPosition.y;

    if (this.collision.canStandAt(next)) {
      this.group.position.copy(next);
      this.setAnimation(stepDistance > 0.001 ? 'walk' : 'idle');
    } else {
      this.pauseTimer = this.config.pauseSeconds;
      this.setAnimation('idle');
    }

    const desiredYaw = Math.atan2(direction.x, direction.z) + this.config.modelYawOffset;
    this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, desiredYaw, this.config.turnSpeed, deltaSeconds);
  }

  setAnimation(state) {
    if (!this.animation || this.animation.state === state) return;

    const nextTrack = this.animation.tracks[state];
    const previousTrack = this.animation.tracks[this.animation.state];
    if (!nextTrack) return;

    Object.entries(this.animation.tracks).forEach(([trackState, track]) => {
      track.root.visible = trackState === state;
    });

    nextTrack.action?.reset().fadeIn(0.16).play();
    if (previousTrack?.action && previousTrack !== nextTrack) {
      previousTrack.action.fadeOut(0.16);
    }

    this.animation.state = state;
  }

  consumeContactDamage(playerPosition) {
    if (!this.group || this.contactCooldown > 0) return null;

    const distance = this.group.position.distanceTo(new THREE.Vector3(playerPosition.x, this.group.position.y, playerPosition.z));
    if (distance > this.config.contactRadius) return null;

    this.contactCooldown = this.config.contactDamageCooldownSeconds;
    return {
      source: this.config.displayName,
      amount: this.config.contactDamage,
      distance,
    };
  }
}
