import * as THREE from 'three';
import { loadDungeonModel } from './ModelLoader.js';

export const BLACK_GRASS_SHEEP_DEMON_ANIMATION_ASSETS = Object.freeze({
  idle: './assets/enemies/sheep_demon/sheep_demon_01_optimized_idle.glb',
  walk: './assets/enemies/sheep_demon/sheep_demon_01_optimized_walk.glb',
  crouch_walk: './assets/enemies/sheep_demon/sheep_demon_01_optimized_crouch_walk.glb',
  run: './assets/enemies/sheep_demon/sheep_demon_01_optimized_run.glb',
  punch_left: './assets/enemies/sheep_demon/sheep_demon_01_optimized_punch_left.glb',
  jump: './assets/enemies/sheep_demon/sheep_demon_01_optimized_jump.glb',
  die: './assets/enemies/sheep_demon/sheep_demon_01_optimized_die.glb',
});

export const BLACK_GRASS_NECK_MAN_ANIMATION_ASSETS = Object.freeze({
  idle: './assets/enemies/neck_man/neckman_01_optimized_idle.glb',
  walk: './assets/enemies/neck_man/neckman_01_optimized_walk.glb',
  crawl: './assets/enemies/neck_man/neckman_01_optimized_crawl.glb',
  run: './assets/enemies/neck_man/neckman_01_optimized_run.glb',
  punch_left: './assets/enemies/neck_man/neckman_01_optimized_punch_left.glb',
  punch_right: './assets/enemies/neck_man/neckman_01_optimized_punch_right.glb',
  cross_punch_left: './assets/enemies/neck_man/neckman_01_optimized_cross_punch_left.glb',
  kick_right: './assets/enemies/neck_man/neckman_01_optimized_kick_right.glb',
  talk: './assets/enemies/neck_man/neckman_01_optimized_talk.glb',
  die: './assets/enemies/neck_man/neckman_01_optimized_die.glb',
});

const FACTIONS = Object.freeze({
  sheep_demon: Object.freeze({
    factionId: 'sheep_demon',
    displayName: 'Sheep Demon',
    opposingFactionId: 'neck_man',
    assets: BLACK_GRASS_SHEEP_DEMON_ANIMATION_ASSETS,
    animationMap: Object.freeze({
      spawn: 'idle',
      patrol: 'walk',
      seek_enemy_faction: 'run',
      attack_enemy_faction: 'punch_left',
      seek_player_fallback: 'walk',
      attack_player_fallback: 'punch_left',
      dead: 'die',
    }),
    targetHeight: 2.18,
    maxWidth: 1.5,
    maxHealth: 45,
    walkSpeed: 0.82,
    seekSpeed: 1.55,
    attackDamage: 12,
    playerAttackDamage: 15,
    playerAttackRange: 2.85,
    attackRange: 2.45,
    attackCooldownSeconds: 1.65,
    attackDamageWindow: Object.freeze({ start: 0.36, end: 0.68 }),
  }),
  neck_man: Object.freeze({
    factionId: 'neck_man',
    displayName: 'Neck Man',
    opposingFactionId: 'sheep_demon',
    assets: BLACK_GRASS_NECK_MAN_ANIMATION_ASSETS,
    animationMap: Object.freeze({
      spawn: 'idle',
      patrol: 'walk',
      seek_enemy_faction: 'run',
      attack_enemy_faction: 'punch_right',
      seek_player_fallback: 'walk',
      attack_player_fallback: 'punch_left',
      dead: 'die',
    }),
    targetHeight: 2.05,
    maxWidth: 1.35,
    maxHealth: 38,
    walkSpeed: 0.92,
    seekSpeed: 1.7,
    attackDamage: 10,
    playerAttackDamage: 15,
    playerAttackRange: 2.75,
    attackRange: 2.2,
    attackCooldownSeconds: 1.35,
    attackDamageWindow: Object.freeze({ start: 0.34, end: 0.64 }),
  }),
});

export const BLACK_GRASS_FACTION_ANIMATION_REPORT = Object.freeze({
  sheep_demon: Object.freeze({
    detectedFiles: Object.values(BLACK_GRASS_SHEEP_DEMON_ANIMATION_ASSETS),
    mapping: FACTIONS.sheep_demon.animationMap,
  }),
  neck_man: Object.freeze({
    detectedFiles: Object.values(BLACK_GRASS_NECK_MAN_ANIMATION_ASSETS),
    mapping: FACTIONS.neck_man.animationMap,
  }),
});

const FACTION_STATE_MACHINE = Object.freeze([
  'spawn',
  'patrol',
  'seek_enemy_faction',
  'attack_enemy_faction',
  'seek_player_fallback',
  'attack_player_fallback',
  'dead',
]);

const RETARGET_INTERVAL_SECONDS = 0.65;
const OPPOSING_DETECTION_RADIUS = 80;
const PLAYER_DETECTION_RADIUS = 18;
const LOSE_PLAYER_RADIUS = 28;
const RESPAWN_COOLDOWN_SECONDS = 10;
const CORPSE_SECONDS = 5;
const MAX_ACTIVE_BY_FACTION = Object.freeze({ sheep_demon: 2, neck_man: 2 });

function horizontalDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function chooseClipForAnimation(assetState, clips) {
  const normalizedState = assetState.toLowerCase();
  const withoutUnderscore = normalizedState.replaceAll('_', '');
  return clips.find((candidate) => {
    const name = (candidate.name || '').toLowerCase();
    return name.includes(normalizedState) || name.replaceAll('_', '').includes(withoutUnderscore);
  }) ?? clips[0];
}

const warnedFallbacks = new Set();

function resolveAnimationState({ species, requestedState, assets }) {
  if (assets[requestedState]) return requestedState;
  const fallback = assets.idle ? 'idle' : Object.keys(assets)[0];
  const key = `${species}:${requestedState}`;
  if (!warnedFallbacks.has(key)) {
    warnedFallbacks.add(key);
    console.warn(`Black Grass Temple faction enemy missing ${species} animation "${requestedState}"; falling back to "${fallback}".`);
  }
  return fallback;
}

function makeAnimationTrack({ state, root, gltf, scale }) {
  const mixer = new THREE.AnimationMixer(root);
  const clips = gltf.animations ?? [];
  const clip = chooseClipForAnimation(state, clips);

  if (!clip) {
    console.warn(`Black Grass Temple ${state} GLB loaded without animation clips.`);
    return { root, mixer, action: null, clip: null, clipNames: [], clipSummaries: [], scale };
  }

  const action = mixer.clipAction(clip);
  const isOneShot = ['punch_left', 'punch_right', 'cross_punch_left', 'kick_right', 'die'].includes(state);
  action.setLoop(isOneShot ? THREE.LoopOnce : THREE.LoopRepeat, isOneShot ? 1 : Infinity);
  action.clampWhenFinished = isOneShot;

  return {
    root,
    mixer,
    action,
    clip,
    clipNames: clips.map((candidate) => candidate.name || '(unnamed clip)'),
    clipSummaries: clips.map((candidate) => ({
      name: candidate.name || '(unnamed clip)',
      durationSeconds: Number(candidate.duration.toFixed(3)),
      trackCount: candidate.tracks.length,
    })),
    scale,
  };
}

function clampPatrolPoint(point, fallback) {
  return point instanceof THREE.Vector3 ? point : fallback;
}

function makePatrolPoints(origin, spread = 4.5) {
  return Object.freeze([
    new THREE.Vector3(origin.x - spread, 0, origin.z - spread * 0.45),
    new THREE.Vector3(origin.x + spread * 0.7, 0, origin.z - spread * 0.65),
    new THREE.Vector3(origin.x + spread, 0, origin.z + spread * 0.5),
    new THREE.Vector3(origin.x - spread * 0.65, 0, origin.z + spread * 0.72),
  ]);
}

class BlackGrassFactionEnemy {
  constructor({ scene, collision, species, id, spawnAnchor, patrolPoints = null }) {
    this.scene = scene;
    this.collision = collision;
    this.species = species;
    this.template = FACTIONS[species];
    this.id = id;
    this.spawnAnchor = spawnAnchor;
    this.group = null;
    this.animation = null;
    this.behaviorState = null;
    this.health = this.template.maxHealth;
    this.isLoaded = false;
    this.isRemoved = false;
    this.retargetElapsed = RETARGET_INTERVAL_SECONDS * Math.random();
    this.currentTarget = null;
    this.patrolPoints = Object.freeze((patrolPoints ?? makePatrolPoints(spawnAnchor.position)).map((point) => clampPatrolPoint(point, spawnAnchor.position)));
    this.patrolTargetIndex = Math.floor(Math.random() * this.patrolPoints.length);
    this.pauseTimer = 0.2 + Math.random() * 0.6;
    this.attackCooldown = 0.4 + Math.random() * 0.8;
    this.attackElapsed = 0;
    this.attackHasDamaged = false;
    this.corpseTimer = CORPSE_SECONDS;
  }

  load() {
    const loadRequests = Object.entries(this.template.assets).map(([state, url]) => (
      loadDungeonModel({ url, targetHeight: this.template.targetHeight, maxWidth: this.template.maxWidth })
        .then((model) => [state, model])
    ));

    return Promise.all(loadRequests)
      .then((entries) => {
        const rig = new THREE.Group();
        rig.name = this.id;
        rig.position.copy(this.spawnAnchor.position);
        rig.rotation.y = this.spawnAnchor.yaw ?? 0;

        const tracks = {};
        const mixers = [];
        const normalizedScale = {};
        entries.forEach(([state, model]) => {
          model.root.name = `${this.id}-${state}-model`;
          model.root.visible = false;
          const track = makeAnimationTrack({ state, ...model });
          tracks[state] = track;
          mixers.push(track.mixer);
          normalizedScale[state] = model.scale;
          rig.add(model.root);
        });

        rig.userData = {
          hostile: true,
          blackGrassTempleFactionEnemy: true,
          faction: this.species,
          opposingFaction: this.template.opposingFactionId,
          displayName: `${this.template.displayName} ${this.spawnAnchor.id}`,
          stateMachine: FACTION_STATE_MACHINE,
          targetPriority: ['nearest living opposing faction enemy', 'player fallback', 'patrol target'],
          animationMapping: this.template.animationMap,
          assetUrls: this.template.assets,
          animationClips: Object.fromEntries(Object.keys(this.template.assets).map((state) => [state, tracks[state].clipNames])),
          animationClipDetails: Object.fromEntries(Object.keys(this.template.assets).map((state) => [state, tracks[state].clipSummaries])),
          normalizedScale,
          health: this.health,
        };

        this.group = rig;
        this.animation = { mixers, tracks };
        this.scene.add(rig);
        this.setBehaviorState('spawn', { force: true });
        this.isLoaded = true;
        console.info(`Black Grass Temple ${this.template.displayName} faction animation clips detected:`, rig.userData.animationClipDetails);
      })
      .catch((error) => {
        console.warn(`Black Grass Temple ${this.template.displayName} failed to load; faction spawn skipped.`, error);
      });
  }

  get isAlive() {
    return Boolean(this.group) && this.health > 0 && this.behaviorState !== 'dead' && !this.isRemoved;
  }

  update(deltaSeconds, context) {
    this.animation?.mixers.forEach((mixer) => mixer.update(deltaSeconds));
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaSeconds);
    if (!this.group || this.isRemoved) return;

    if (this.behaviorState === 'dead') {
      this.corpseTimer -= deltaSeconds;
      if (this.corpseTimer <= 0) this.hideCorpse();
      return;
    }

    this.retargetElapsed += deltaSeconds;
    if (this.retargetElapsed >= RETARGET_INTERVAL_SECONDS || !this.isTargetStillValid(context)) {
      this.retargetElapsed = 0;
      this.selectTarget(context);
    }

    if (this.behaviorState === 'attack_enemy_faction' || this.behaviorState === 'attack_player_fallback') {
      this.updateAttack(deltaSeconds, context);
      return;
    }

    if (this.currentTarget?.type === 'enemy') {
      this.updateEnemyTarget(deltaSeconds);
      return;
    }

    if (this.currentTarget?.type === 'player') {
      this.updatePlayerTarget(deltaSeconds, context.playerPosition);
      return;
    }

    this.updatePatrol(deltaSeconds);
  }

  isTargetStillValid(context) {
    if (this.currentTarget?.type === 'enemy') return this.currentTarget.enemy?.isAlive;
    if (this.currentTarget?.type === 'player') {
      const enemyTarget = this.findNearestOpposingEnemy(context);
      if (enemyTarget) return false;
      return context.playerPosition && horizontalDistance(this.group.position, context.playerPosition) <= LOSE_PLAYER_RADIUS;
    }
    return false;
  }

  selectTarget(context) {
    const opposingEnemy = this.findNearestOpposingEnemy(context);
    if (opposingEnemy) {
      this.currentTarget = { type: 'enemy', enemy: opposingEnemy };
      this.group.userData.targetType = 'opposing_faction';
      this.group.userData.targetId = opposingEnemy.id;
      return;
    }

    if (context.playerPosition && horizontalDistance(this.group.position, context.playerPosition) <= PLAYER_DETECTION_RADIUS) {
      this.currentTarget = { type: 'player' };
      this.group.userData.targetType = 'player_fallback';
      this.group.userData.targetId = 'player';
      return;
    }

    this.currentTarget = null;
    this.group.userData.targetType = 'patrol';
    this.group.userData.targetId = null;
  }

  findNearestOpposingEnemy(context) {
    let nearest = null;
    let nearestDistance = Infinity;
    context.enemies.forEach((enemy) => {
      if (enemy === this || enemy.species !== this.template.opposingFactionId || !enemy.isAlive || !enemy.group) return;
      const distance = horizontalDistance(this.group.position, enemy.group.position);
      if (distance > OPPOSING_DETECTION_RADIUS || distance >= nearestDistance) return;
      nearest = enemy;
      nearestDistance = distance;
    });
    return nearest;
  }

  updateEnemyTarget(deltaSeconds) {
    const target = this.currentTarget.enemy;
    if (!target?.isAlive || !target.group) {
      this.currentTarget = null;
      return;
    }
    const toTarget = target.group.position.clone().sub(this.group.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    const direction = distance > 0.001 ? toTarget.normalize() : new THREE.Vector3(0, 0, 1);
    this.faceDirection(direction, deltaSeconds);

    if (distance <= this.template.attackRange && this.attackCooldown <= 0) {
      this.beginAttack('attack_enemy_faction');
      return;
    }

    if (distance > this.template.attackRange * 0.75) {
      this.moveToward(direction, this.template.seekSpeed, deltaSeconds, distance - this.template.attackRange * 0.72, 'seek_enemy_faction');
    } else {
      this.setBehaviorState('seek_enemy_faction');
    }
  }

  updatePlayerTarget(deltaSeconds, playerPosition) {
    const toPlayer = playerPosition.clone().sub(this.group.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();
    const direction = distance > 0.001 ? toPlayer.normalize() : new THREE.Vector3(0, 0, 1);
    this.faceDirection(direction, deltaSeconds);

    if (distance <= this.template.attackRange && this.attackCooldown <= 0) {
      this.beginAttack('attack_player_fallback');
      return;
    }

    this.moveToward(direction, this.template.walkSpeed, deltaSeconds, Math.max(0, distance - this.template.attackRange * 0.82), 'seek_player_fallback');
  }

  updatePatrol(deltaSeconds) {
    if (this.pauseTimer > 0) {
      this.pauseTimer = Math.max(0, this.pauseTimer - deltaSeconds);
      this.setBehaviorState('spawn');
      return;
    }

    const target = this.patrolPoints[this.patrolTargetIndex];
    const toTarget = target.clone().sub(this.group.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    if (distance < 0.16) {
      this.patrolTargetIndex = (this.patrolTargetIndex + 1) % this.patrolPoints.length;
      this.pauseTimer = 0.35 + Math.random() * 0.65;
      this.setBehaviorState('spawn');
      return;
    }

    this.moveToward(toTarget.normalize(), this.template.walkSpeed, deltaSeconds, distance, 'patrol');
  }

  beginAttack(state) {
    this.attackElapsed = 0;
    this.attackHasDamaged = false;
    this.attackCooldown = this.template.attackCooldownSeconds;
    this.setBehaviorState(state, { force: true });
  }

  updateAttack(deltaSeconds, context) {
    this.attackElapsed += deltaSeconds;
    const targetPosition = this.currentTarget?.type === 'enemy'
      ? this.currentTarget.enemy?.group?.position
      : context.playerPosition;

    if (targetPosition) {
      const face = targetPosition.clone().sub(this.group.position);
      face.y = 0;
      if (face.lengthSq() > 0.001) this.faceDirection(face.normalize(), deltaSeconds);
    }

    this.applyAttackDamageIfReady(context);

    const animationState = this.resolveStateAnimation(this.behaviorState);
    const duration = this.getActionDuration(animationState, 0.9);
    if (this.attackElapsed >= duration) {
      this.setBehaviorState(this.currentTarget?.type === 'player' ? 'seek_player_fallback' : 'seek_enemy_faction');
    }
  }

  applyAttackDamageIfReady() {
    if (this.attackHasDamaged) return;
    const animationState = this.resolveStateAnimation(this.behaviorState);
    const duration = this.getActionDuration(animationState, 0.9);
    const progress = this.attackElapsed / Math.max(duration, 0.001);
    const window = this.template.attackDamageWindow;
    if (progress < window.start || progress > window.end) return;

    if (this.currentTarget?.type === 'enemy') {
      const target = this.currentTarget.enemy;
      if (target?.isAlive && horizontalDistance(this.group.position, target.group.position) <= this.template.attackRange) {
        target.receiveFactionDamage(this.template.attackDamage, this.template.displayName);
        this.attackHasDamaged = true;
      }
    }
  }

  consumePlayerDamage(playerPosition) {
    if (!this.group || this.behaviorState !== 'attack_player_fallback' || this.attackHasDamaged) return null;
    const animationState = this.resolveStateAnimation(this.behaviorState);
    const duration = this.getActionDuration(animationState, 0.9);
    const progress = this.attackElapsed / Math.max(duration, 0.001);
    const window = this.template.attackDamageWindow;
    if (progress < window.start || progress > window.end) return null;
    const distance = horizontalDistance(this.group.position, playerPosition);
    if (distance > this.template.attackRange) return null;
    this.attackHasDamaged = true;
    return {
      source: this.template.displayName,
      amount: this.template.attackDamage,
      distance,
      attackWindowProgress: Number(progress.toFixed(2)),
    };
  }

  receiveFactionDamage(damage, source) {
    if (!this.isAlive) return null;
    this.health = Math.max(0, this.health - damage);
    this.group.userData.health = this.health;
    if (this.health <= 0) {
      this.kill(source);
      return { killed: true };
    }
    return { killed: false };
  }

  receivePlayerAttack({ position, direction, damage = this.template.playerAttackDamage } = {}) {
    if (!this.isAlive) return null;
    const toEnemy = this.group.position.clone().sub(position);
    toEnemy.y = 0;
    const distance = toEnemy.length();
    if (distance > this.template.playerAttackRange) return null;
    const attackDirection = direction.clone();
    attackDirection.y = 0;
    if (attackDirection.lengthSq() > 0.001 && toEnemy.lengthSq() > 0.001) {
      const angle = attackDirection.normalize().angleTo(toEnemy.normalize());
      if (angle > THREE.MathUtils.degToRad(72) * 0.5) return null;
    }
    this.health = Math.max(0, this.health - damage);
    this.group.userData.health = this.health;
    if (this.health <= 0) {
      this.kill('player');
      return { target: this.template.displayName, damage, remainingHealth: 0, killed: true };
    }
    return { target: this.template.displayName, damage, remainingHealth: this.health, killed: false };
  }

  kill(source = 'unknown') {
    if (!this.group || this.behaviorState === 'dead') return;
    this.health = 0;
    this.attackHasDamaged = true;
    this.currentTarget = null;
    this.group.userData.health = 0;
    this.group.userData.killedBy = source;
    this.setBehaviorState('dead', { force: true });
  }

  hideCorpse() {
    if (!this.group || this.isRemoved) return;
    this.group.visible = false;
    this.scene.remove(this.group);
    this.isRemoved = true;
  }

  moveToward(direction, speed, deltaSeconds, maxDistance = Infinity, movingState = 'patrol') {
    const stepDistance = Math.min(maxDistance, speed * deltaSeconds);
    if (stepDistance <= 0.001) return;
    const next = this.group.position.clone().add(direction.clone().multiplyScalar(stepDistance));
    next.y = this.spawnAnchor.position.y;
    if (this.collision.canStandAt(next)) {
      this.group.position.copy(next);
      this.setBehaviorState(movingState);
    } else {
      const slideX = this.group.position.clone();
      slideX.x = next.x;
      const slideZ = this.group.position.clone();
      slideZ.z = next.z;
      if (this.collision.canStandAt(slideX)) {
        this.group.position.copy(slideX);
        this.setBehaviorState(movingState);
      } else if (this.collision.canStandAt(slideZ)) {
        this.group.position.copy(slideZ);
        this.setBehaviorState(movingState);
      } else {
        this.pauseTimer = 0.25;
        this.patrolTargetIndex = (this.patrolTargetIndex + 1) % this.patrolPoints.length;
        this.setBehaviorState('spawn');
      }
    }
    this.faceDirection(direction, deltaSeconds);
  }

  faceDirection(direction, deltaSeconds) {
    const desiredYaw = Math.atan2(direction.x, direction.z);
    this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, desiredYaw, 5.4, deltaSeconds);
  }

  resolveStateAnimation(state) {
    const requested = this.template.animationMap[state] ?? 'idle';
    return resolveAnimationState({ species: this.species, requestedState: requested, assets: this.template.assets });
  }

  setBehaviorState(state, { force = false } = {}) {
    if (!this.animation || (!force && this.behaviorState === state)) return;
    const animationState = this.resolveStateAnimation(state);
    const nextTrack = this.animation.tracks[animationState];
    const previousTrack = this.animation.tracks[this.resolveStateAnimation(this.behaviorState ?? 'spawn')];
    if (!nextTrack) return;
    Object.entries(this.animation.tracks).forEach(([trackState, track]) => {
      track.root.visible = trackState === animationState;
    });
    nextTrack.action?.reset().fadeIn(0.1).play();
    if (previousTrack?.action && previousTrack !== nextTrack) previousTrack.action.fadeOut(0.1);
    this.behaviorState = state;
    this.group.userData.behaviorState = state;
    this.group.userData.animationState = animationState;
  }

  getActionDuration(animationState, fallback) {
    return this.animation?.tracks[animationState]?.clip?.duration || fallback;
  }
}

export class BlackGrassTempleFactionManager {
  constructor({ scene, collision, anchors }) {
    this.scene = scene;
    this.collision = collision;
    this.anchors = anchors;
    this.enemies = [];
    this.spawnSerial = 0;
    this.respawnTimers = { sheep_demon: null, neck_man: null };
    this.maxActiveByFaction = MAX_ACTIVE_BY_FACTION;
    this.respawnCooldownSeconds = RESPAWN_COOLDOWN_SECONDS;
    this.userData = {
      scope: 'Black Grass Temple only',
      factions: ['sheep_demon', 'neck_man'],
      stateMachine: FACTION_STATE_MACHINE,
      targetPriority: ['nearest living opposing-faction enemy', 'player fallback', 'patrol target'],
      retargetIntervalSeconds: RETARGET_INTERVAL_SECONDS,
      respawnCooldownSeconds: RESPAWN_COOLDOWN_SECONDS,
      maxActiveByFaction: MAX_ACTIVE_BY_FACTION,
      maxActiveTotal: Object.values(MAX_ACTIVE_BY_FACTION).reduce((sum, count) => sum + count, 0),
      animationReport: BLACK_GRASS_FACTION_ANIMATION_REPORT,
    };
  }

  spawnInitialWave() {
    this.spawnFaction('sheep_demon', 2);
    this.spawnFaction('neck_man', 2);
    console.info('Black Grass Temple faction war initialized:', this.userData);
  }

  update(deltaSeconds, playerPosition) {
    const context = { enemies: this.enemies, playerPosition };
    this.enemies.forEach((enemy) => enemy.update(deltaSeconds, context));

    Object.keys(this.respawnTimers).forEach((species) => {
      const livingCount = this.enemies.filter((enemy) => enemy.species === species && enemy.health > 0 && !enemy.isRemoved).length;
      if (livingCount === 0 && this.respawnTimers[species] === null) {
        this.respawnTimers[species] = RESPAWN_COOLDOWN_SECONDS;
        console.info(`Black Grass Temple ${species} faction wiped; respawn pending in ${RESPAWN_COOLDOWN_SECONDS}s.`);
      }
      if (this.respawnTimers[species] !== null) {
        this.respawnTimers[species] -= deltaSeconds;
        if (this.respawnTimers[species] <= 0) {
          this.spawnFaction(species, 2);
          this.respawnTimers[species] = null;
          this.forceRetargetOpposingFaction(species);
        }
      }
    });

    this.enemies = this.enemies.filter((enemy) => !enemy.isRemoved || enemy.isAlive);
  }

  spawnFaction(species, requestedCount) {
    const livingCount = this.getLivingEnemies(species).length;
    const count = Math.max(0, Math.min(requestedCount, this.maxActiveByFaction[species] - livingCount));
    const usedAnchorIds = new Set();
    for (let i = 0; i < count; i += 1) {
      const anchor = this.chooseSpawnAnchor(species, i, usedAnchorIds);
      usedAnchorIds.add(anchor.id);
      const enemy = new BlackGrassFactionEnemy({
        scene: this.scene,
        collision: this.collision,
        species,
        id: `black-grass-temple-${species}-${this.spawnSerial += 1}`,
        spawnAnchor: anchor,
        patrolPoints: anchor.patrolPoints,
      });
      this.enemies.push(enemy);
      enemy.load();
    }
  }

  chooseSpawnAnchor(species, offset = 0, excludedAnchorIds = new Set()) {
    const pool = this.anchors.filter((anchor) => anchor.preferredFaction === species || anchor.preferredFaction === 'neutral');
    const opposing = this.getLivingEnemies(FACTIONS[species].opposingFactionId);
    let best = null;
    let bestScore = -Infinity;
    pool.forEach((anchor, index) => {
      const nearestOpposing = opposing.reduce((nearest, enemy) => Math.min(nearest, horizontalDistance(anchor.position, enemy.group.position)), Infinity);
      const factionBias = anchor.preferredFaction === species ? 12 : 0;
      const repeatBias = -Math.abs(index - offset) * 0.01;
      const duplicateWavePenalty = excludedAnchorIds.has(anchor.id) ? -1000 : 0;
      const score = (Number.isFinite(nearestOpposing) ? nearestOpposing : 120) + factionBias + repeatBias + duplicateWavePenalty;
      if (score > bestScore) {
        best = anchor;
        bestScore = score;
      }
    });
    return best ?? this.anchors[0];
  }

  forceRetargetOpposingFaction(respawnedSpecies) {
    this.enemies.forEach((enemy) => {
      if (enemy.species === FACTIONS[respawnedSpecies].opposingFactionId && enemy.isAlive) {
        enemy.retargetElapsed = RETARGET_INTERVAL_SECONDS;
      }
    });
  }

  getLivingEnemies(species = null) {
    return this.enemies.filter((enemy) => enemy.isAlive && (!species || enemy.species === species));
  }

  consumeEnemyContactDamage(playerPosition) {
    for (const enemy of this.enemies) {
      const hit = enemy.consumePlayerDamage(playerPosition);
      if (hit) return hit;
    }
    return null;
  }

  damageEnemyFromPlayerAttack(attack) {
    for (const enemy of this.enemies) {
      const hit = enemy.receivePlayerAttack(attack);
      if (hit) return hit;
    }
    return null;
  }
}
