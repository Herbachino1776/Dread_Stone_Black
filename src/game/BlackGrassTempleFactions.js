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
      investigate_enemy_faction: 'walk',
      seek_enemy_faction: 'run',
      combat_enter: 'walk',
      combat_circle: 'crouch_walk',
      combat_feint: 'crouch_walk',
      combat_lunge: 'run',
      attack_enemy_faction: 'punch_left',
      jump_attack_enemy_faction: 'jump',
      defensive_backstep: 'crouch_walk',
      defensive_strafe: 'crouch_walk',
      recover: 'idle',
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
    desiredCombatDistance: 3.05,
    tooCloseDistance: 1.65,
    combatEngageDistance: 4.65,
    circleSpeed: 0.58,
    backstepSpeed: 1.05,
    lungeSpeed: 2.25,
    defensiveManeuverChance: 0.28,
    offensiveLungeChance: 0.4,
    jumpAttackChance: 0.16,
    jumpAttackCooldownSeconds: 7.5,
    enemyAttackAnimations: Object.freeze(['punch_left']),
  }),
  neck_man: Object.freeze({
    factionId: 'neck_man',
    displayName: 'Neck Man',
    opposingFactionId: 'sheep_demon',
    assets: BLACK_GRASS_NECK_MAN_ANIMATION_ASSETS,
    animationMap: Object.freeze({
      spawn: 'idle',
      patrol: 'walk',
      investigate_enemy_faction: 'walk',
      seek_enemy_faction: 'run',
      combat_enter: 'walk',
      combat_circle: 'walk',
      combat_feint: 'crawl',
      combat_lunge: 'run',
      attack_enemy_faction: 'punch_right',
      jump_attack_enemy_faction: 'kick_right',
      defensive_backstep: 'crawl',
      defensive_strafe: 'walk',
      recover: 'idle',
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
    desiredCombatDistance: 2.65,
    tooCloseDistance: 1.5,
    combatEngageDistance: 4.45,
    circleSpeed: 0.82,
    backstepSpeed: 1.25,
    lungeSpeed: 2.55,
    defensiveManeuverChance: 0.38,
    offensiveLungeChance: 0.32,
    jumpAttackChance: 0,
    jumpAttackCooldownSeconds: 999,
    enemyAttackAnimations: Object.freeze(['punch_left', 'punch_right', 'cross_punch_left', 'kick_right']),
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
  'investigate_enemy_faction',
  'seek_enemy_faction',
  'combat_enter',
  'combat_circle',
  'combat_feint',
  'combat_lunge',
  'attack_enemy_faction',
  'jump_attack_enemy_faction',
  'defensive_backstep',
  'defensive_strafe',
  'recover',
  'seek_player_fallback',
  'attack_player_fallback',
  'dead',
]);

const RETARGET_INTERVAL_SECONDS = 0.65;
const FAR_AWARENESS_RADIUS = 34;
const SAME_ROOM_AWARENESS_RADIUS = 42;
const ADJACENT_ROOM_AWARENESS_RADIUS = 36;
const COMBAT_AWARENESS_RADIUS = 12;
const DOORWAY_COMBAT_AWARENESS_RADIUS = 8;
const MAX_FAR_ROOM_PATH_STEPS = 3;
const SHORT_ROUTE_INVESTIGATION_RADIUS = 72;
const MAX_SHORT_ROUTE_INVESTIGATION_STEPS = 2;
const PLAYER_DETECTION_RADIUS = 18;
const LOSE_PLAYER_RADIUS = 28;
const RESPAWN_COOLDOWN_SECONDS = 10;
const CORPSE_SECONDS = 5;
const MAX_ACTIVE_BY_FACTION = Object.freeze({ sheep_demon: 2, neck_man: 2 });
const INITIAL_WAVE_BY_FACTION = Object.freeze({ sheep_demon: 1, neck_man: 1 });
const DEV_DIAGNOSTIC_INTERVAL_SECONDS = 5;
const IS_DEV = import.meta.env.DEV;
const WAYPOINT_REPATH_SECONDS = 0.75;
const STUCK_MOVEMENT_THRESHOLD = 0.03;
const STUCK_SECONDS = 1.15;
const UNSTUCK_SECONDS = 0.42;
const NAV_CLEARANCE_RADIUS = 0.5;
const SHEEP_DEMON_BLACK_GRASS_NEUTRAL_COLOR = new THREE.Color(0xffffff);
const SHEEP_DEMON_BLACK_GRASS_SHADOW_FILL = new THREE.Color(0x0d1118);


function vectorSummary(vector) {
  return {
    x: Number(vector.x.toFixed(2)),
    y: Number(vector.y.toFixed(2)),
    z: Number(vector.z.toFixed(2)),
  };
}

function boxSizeSummary(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return { x: 0, y: 0, z: 0 };
  return vectorSummary(box.getSize(new THREE.Vector3()));
}

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

function tuneMaterialTexture(texture, colorSpace) {
  if (!texture) return false;
  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
  return true;
}

function tuneBlackGrassSheepDemonMaterials(root) {
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

      if (tuneMaterialTexture(material.map, THREE.SRGBColorSpace)) summary.baseColorMapsSetToSrgb += 1;
      [
        material.normalMap,
        material.roughnessMap,
        material.metalnessMap,
        material.aoMap,
        material.bumpMap,
        material.displacementMap,
        material.alphaMap,
      ].forEach((texture) => {
        if (tuneMaterialTexture(texture, THREE.NoColorSpace)) summary.nonColorMapsKeptLinear += 1;
      });

      if (material.color instanceof THREE.Color) {
        if (!material.color.equals(SHEEP_DEMON_BLACK_GRASS_NEUTRAL_COLOR)) summary.neutralizedColorMultipliers += 1;
        material.color.copy(SHEEP_DEMON_BLACK_GRASS_NEUTRAL_COLOR);
      }

      if ('emissive' in material && material.emissive instanceof THREE.Color) {
        material.emissive.copy(SHEEP_DEMON_BLACK_GRASS_SHADOW_FILL);
        material.emissiveIntensity = Math.min(Math.max(material.emissiveIntensity ?? 0, 0.1), 0.16);
      }
      if ('metalness' in material) material.metalness = Math.min(material.metalness ?? 0, 0.02);
      if ('roughness' in material) material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.84, 0.76, 0.9);
      material.needsUpdate = true;
    });
  });

  return summary;
}

function makeNavPointSummary(point) {
  return point ? { x: Number(point.x.toFixed(2)), z: Number(point.z.toFixed(2)) } : null;
}


class BlackGrassFactionEnemy {
  constructor({ scene, collision, navigationGraph = null, species, id, spawnAnchor, patrolPoints = null, onLoaded = null }) {
    this.scene = scene;
    this.collision = collision;
    this.navigationGraph = navigationGraph;
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
    this.pendingAttackAnimation = null;
    this.jumpAttackCooldown = Math.random() * this.template.jumpAttackCooldownSeconds;
    this.awarenessReactionDelay = 0;
    this.awarenessTier = 'none';
    this.combatManeuver = 'none';
    this.combatManeuverTimer = 0;
    this.combatStrafeSign = Math.random() < 0.5 ? -1 : 1;
    this.recoverTimer = 0;
    this.devCombatLogElapsed = Math.random();
    this.devLastCombatLogKey = '';
    this.corpseTimer = CORPSE_SECONDS;
    this.onLoaded = onLoaded;
    this.devMarker = null;
    this.pathMarker = null;
    this.stuckMarker = null;
    this.pathRepathElapsed = WAYPOINT_REPATH_SECONDS;
    this.activeWaypoint = null;
    this.stuckElapsed = 0;
    this.unstuckTimer = 0;
    this.unstuckDirection = new THREE.Vector3();
  }

  load() {
    const idleState = this.resolveStateAnimation('spawn');
    const primaryStates = new Set([
      idleState,
      this.resolveStateAnimation('patrol'),
      this.resolveStateAnimation('investigate_enemy_faction'),
      this.resolveStateAnimation('seek_enemy_faction'),
      this.resolveStateAnimation('combat_circle'),
      this.resolveStateAnimation('combat_lunge'),
      this.resolveStateAnimation('defensive_backstep'),
      this.resolveStateAnimation('attack_enemy_faction'),
      this.resolveStateAnimation('jump_attack_enemy_faction'),
      this.resolveStateAnimation('dead'),
      ...this.template.enemyAttackAnimations,
    ]);
    const loadState = (state) => loadDungeonModel({
      url: this.template.assets[state],
      targetHeight: this.template.targetHeight,
      maxWidth: this.template.maxWidth,
    }).then((model) => [state, model]);

    return loadState(idleState)
      .then(([state, model]) => {
        const rig = new THREE.Group();
        rig.name = this.id;
        rig.visible = true;
        rig.position.copy(this.spawnAnchor.position);
        rig.position.y = Math.max(0, rig.position.y);
        rig.rotation.y = this.spawnAnchor.yaw ?? 0;

        const tracks = {};
        const mixers = [];
        const normalizedScale = {};
        const addTrack = (trackState, trackModel) => {
          trackModel.root.name = `${this.id}-${trackState}-model`;
          if (this.species === 'sheep_demon') {
            const materialSummary = tuneBlackGrassSheepDemonMaterials(trackModel.root);
            trackModel.root.userData.blackGrassSheepDemonMaterialTuning = materialSummary;
          }
          trackModel.root.visible = false;
          trackModel.root.updateMatrixWorld(true);
          const track = makeAnimationTrack({ state: trackState, ...trackModel });
          tracks[trackState] = track;
          mixers.push(track.mixer);
          normalizedScale[trackState] = trackModel.scale;
          rig.add(trackModel.root);
          return track;
        };

        addTrack(state, model);

        rig.userData = {
          hostile: true,
          blackGrassTempleFactionEnemy: true,
          faction: this.species,
          opposingFaction: this.template.opposingFactionId,
          displayName: `${this.template.displayName} ${this.spawnAnchor.id}`,
          spawnAnchorId: this.spawnAnchor.id,
          spawnPosition: vectorSummary(this.spawnAnchor.position),
          stateMachine: FACTION_STATE_MACHINE,
          targetPriority: ['nearest living opposing faction enemy', 'player fallback', 'patrol target'],
          animationMapping: this.template.animationMap,
          assetUrls: this.template.assets,
          animationClips: {},
          animationClipDetails: {},
          loadedAnimationStates: [state],
          expectedAnimationStates: Object.keys(this.template.assets),
          normalizedScale,
          health: this.health,
        };

        this.group = rig;
        this.animation = { mixers, tracks };
        this.scene.add(rig);
        this.setBehaviorState('spawn', { force: true });
        this.ensureSingleVisibleAnimationRoot();
        this.addDevMarker();
        this.isLoaded = true;
        this.refreshAnimationUserData();
        this.logLoadDiagnostics('idle-visible');
        this.onLoaded?.(this);

        const remainingStates = Object.keys(this.template.assets).filter((candidate) => candidate !== state);
        const priorityRemaining = remainingStates.filter((candidate) => primaryStates.has(candidate));
        const optionalRemaining = remainingStates.filter((candidate) => !primaryStates.has(candidate));
        [...priorityRemaining, ...optionalRemaining].forEach((remainingState) => {
          loadState(remainingState)
            .then(([, remainingModel]) => {
              addTrack(remainingState, remainingModel);
              if (this.resolveStateAnimation(this.behaviorState ?? 'spawn') === remainingState) {
                this.setBehaviorState(this.behaviorState ?? 'spawn', { force: true });
              }
              this.refreshAnimationUserData();
              this.ensureSingleVisibleAnimationRoot();
              if (IS_DEV && this.group) {
                console.info('Black Grass Temple faction animation state loaded:', {
                  species: this.species,
                  id: this.id,
                  spawnAnchorId: this.spawnAnchor.id,
                  state: remainingState,
                  glbTrackCount: tracks[remainingState].clip?.tracks.length ?? 0,
                  totalLoadedStates: Object.keys(tracks).length,
                });
              }
            })
            .catch((error) => {
              if (IS_DEV) {
                console.warn(`Black Grass Temple ${this.template.displayName} ${remainingState} animation failed to lazy-load.`, error);
              }
            });
        });
      })
      .catch((error) => {
        console.warn(`Black Grass Temple ${this.template.displayName} failed to load idle model; faction spawn skipped.`, error);
      });
  }

  addDevMarker() {
    if (!IS_DEV || !this.group || this.devMarker) return;
    const color = this.species === 'sheep_demon' ? 0xff3131 : 0x20d6a4;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8),
      new THREE.MeshBasicMaterial({ color, depthTest: false }),
    );
    marker.name = `${this.id}-dev-visible-faction-marker`;
    marker.position.set(0, this.template.targetHeight + 0.45, 0);
    marker.renderOrder = 999;
    marker.userData = { devOnly: true, blackGrassFactionMarker: true, species: this.species, enemyId: this.id };
    this.group.add(marker);
    this.devMarker = marker;
  }



  ensurePathMarker() {
    if (!IS_DEV || this.pathMarker) return;
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xf7dc4f, depthTest: false, transparent: true, opacity: 0.72 }),
    );
    marker.name = `${this.id}-dev-current-path-waypoint`;
    marker.renderOrder = 998;
    marker.userData = { devOnly: true, blackGrassFactionPathWaypoint: true, species: this.species, enemyId: this.id };
    this.scene.add(marker);
    this.pathMarker = marker;
  }

  ensureStuckMarker() {
    if (!IS_DEV || this.stuckMarker) return;
    const marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.7, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd000, depthTest: false, transparent: true, opacity: 0.86 }),
    );
    marker.name = `${this.id}-dev-stuck-marker`;
    marker.renderOrder = 1000;
    marker.visible = false;
    marker.userData = { devOnly: true, blackGrassFactionStuckMarker: true, species: this.species, enemyId: this.id };
    this.scene.add(marker);
    this.stuckMarker = marker;
  }

  updateDevNavigationMarkers() {
    if (!IS_DEV || !this.group) return;
    if (this.activeWaypoint) {
      this.ensurePathMarker();
      this.pathMarker.position.set(this.activeWaypoint.x, 0.55, this.activeWaypoint.z);
      this.pathMarker.visible = true;
    } else if (this.pathMarker) {
      this.pathMarker.visible = false;
    }
    this.ensureStuckMarker();
    this.stuckMarker.position.set(this.group.position.x, this.template.targetHeight + 0.95, this.group.position.z);
    this.stuckMarker.visible = this.unstuckTimer > 0 || this.stuckElapsed > STUCK_SECONDS * 0.65;
  }

  refreshAnimationUserData() {
    if (!this.group || !this.animation) return;
    const tracks = this.animation.tracks;
    this.group.userData.animationClips = Object.fromEntries(Object.entries(tracks).map(([state, track]) => [state, track.clipNames]));
    this.group.userData.animationClipDetails = Object.fromEntries(Object.entries(tracks).map(([state, track]) => [state, track.clipSummaries]));
    this.group.userData.loadedAnimationStates = Object.keys(tracks);
    this.group.userData.normalizedScale = Object.fromEntries(Object.entries(tracks).map(([state, track]) => [state, track.scale]));
    this.group.userData.visibleAnimationState = this.group.userData.animationState;
    this.group.userData.visibleAnimationRootCount = Object.values(tracks).filter((track) => track.root.visible).length;
    this.group.userData.boundingBoxSize = boxSizeSummary(this.group);
    this.group.userData.worldPosition = vectorSummary(this.group.getWorldPosition(new THREE.Vector3()));
  }

  ensureSingleVisibleAnimationRoot() {
    if (!this.group || !this.animation) return;
    this.group.visible = true;
    const animationState = this.resolveStateAnimation(this.behaviorState ?? 'spawn');
    const visibleState = this.animation.tracks[animationState] ? animationState : Object.keys(this.animation.tracks)[0];
    Object.entries(this.animation.tracks).forEach(([trackState, track]) => {
      track.root.visible = trackState === visibleState;
    });
    this.group.userData.animationState = visibleState;
    this.group.userData.visibleAnimationState = visibleState;
    this.group.userData.visibleAnimationRootCount = 1;
  }

  logLoadDiagnostics(stage) {
    if (!IS_DEV || !this.group || !this.animation) return;
    this.refreshAnimationUserData();
    const visibleAnimationState = this.group.userData.visibleAnimationState;
    console.info('Black Grass Temple faction enemy visibility diagnostic:', {
      stage,
      species: this.species,
      id: this.id,
      spawnAnchorId: this.spawnAnchor.id,
      spawnPosition: vectorSummary(this.spawnAnchor.position),
      loadedAnimationStates: this.group.userData.loadedAnimationStates,
      glbTrackCount: this.animation.tracks[visibleAnimationState]?.clip?.tracks.length ?? 0,
      visibleAnimationState,
      visibleAnimationRootCount: this.group.userData.visibleAnimationRootCount,
      groupVisible: this.group.visible,
      scaleByState: this.group.userData.normalizedScale,
      boundingBoxSize: this.group.userData.boundingBoxSize,
      finalWorldPosition: this.group.userData.worldPosition,
    });
  }

  get isAlive() {
    return Boolean(this.group) && this.health > 0 && this.behaviorState !== 'dead' && !this.isRemoved;
  }

  update(deltaSeconds, context) {
    this.animation?.mixers.forEach((mixer) => mixer.update(deltaSeconds));
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaSeconds);
    this.devCombatLogElapsed += deltaSeconds;
    this.jumpAttackCooldown = Math.max(0, this.jumpAttackCooldown - deltaSeconds);
    this.awarenessReactionDelay = Math.max(0, this.awarenessReactionDelay - deltaSeconds);
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

    this.pathRepathElapsed += deltaSeconds;

    if (this.unstuckTimer > 0) {
      this.unstuckTimer = Math.max(0, this.unstuckTimer - deltaSeconds);
      this.activeWaypoint = null;
      this.moveToward(this.unstuckDirection, this.template.walkSpeed * 0.75, deltaSeconds, Infinity, 'patrol', { suppressStuckTracking: true });
      this.updateDevNavigationMarkers();
      return;
    }

    if (this.behaviorState === 'recover') {
      this.recoverTimer = Math.max(0, this.recoverTimer - deltaSeconds);
      const targetPosition = this.currentTarget?.type === 'enemy' ? this.currentTarget.enemy?.group?.position : null;
      if (targetPosition) {
        const face = targetPosition.clone().sub(this.group.position);
        face.y = 0;
        if (face.lengthSq() > 0.001) this.faceDirection(face.normalize(), deltaSeconds);
      }
      if (this.recoverTimer > 0) {
        this.updateDevNavigationMarkers();
        return;
      }
    }

    if (this.behaviorState === 'attack_enemy_faction' || this.behaviorState === 'jump_attack_enemy_faction' || this.behaviorState === 'attack_player_fallback') {
      this.updateAttack(deltaSeconds, context);
      this.updateDevNavigationMarkers();
      return;
    }

    if (this.currentTarget?.type === 'enemy') {
      this.updateEnemyTarget(deltaSeconds);
      this.updateDevNavigationMarkers();
      return;
    }

    if (this.currentTarget?.type === 'player') {
      this.updatePlayerTarget(deltaSeconds, context.playerPosition);
      this.updateDevNavigationMarkers();
      return;
    }

    this.updatePatrol(deltaSeconds);
    this.updateDevNavigationMarkers();
  }

  isTargetStillValid(context) {
    if (this.currentTarget?.type === 'enemy') {
      const enemy = this.currentTarget.enemy;
      return enemy?.isAlive && this.getOpposingAwareness(enemy).tier !== 'none';
    }
    if (this.currentTarget?.type === 'player') {
      const enemyTarget = this.findNearestOpposingEnemy(context);
      if (enemyTarget) return false;
      return context.playerPosition && horizontalDistance(this.group.position, context.playerPosition) <= LOSE_PLAYER_RADIUS;
    }
    return false;
  }

  selectTarget(context) {
    const previousTargetId = this.currentTarget?.type === 'enemy' ? this.currentTarget.enemy?.id : null;
    const opposingEnemy = this.findNearestOpposingEnemy(context);
    if (opposingEnemy) {
      if (previousTargetId !== opposingEnemy.id) {
        this.awarenessReactionDelay = 0.4 + Math.random() * 0.8;
        this.combatManeuverTimer = 0;
        this.logCombatEvent('target-acquired', { target: opposingEnemy, maneuver: this.awarenessTier, distance: horizontalDistance(this.group.position, opposingEnemy.group.position) });
      }
      this.currentTarget = { type: 'enemy', enemy: opposingEnemy };
      this.group.userData.targetType = 'opposing_faction';
      this.group.userData.targetId = opposingEnemy.id;
      this.group.userData.awarenessTier = this.awarenessTier;
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
    this.group.userData.awarenessTier = 'none';
  }

  findNearestOpposingEnemy(context) {
    let nearest = null;
    let nearestDistance = Infinity;
    let nearestAwareness = null;
    context.enemies.forEach((enemy) => {
      if (enemy === this || enemy.species !== this.template.opposingFactionId || !enemy.isAlive || !enemy.group) return;
      const awareness = this.getOpposingAwareness(enemy);
      if (awareness.tier === 'none' || awareness.distance >= nearestDistance) return;
      nearest = enemy;
      nearestDistance = awareness.distance;
      nearestAwareness = awareness;
    });
    this.awarenessTier = nearestAwareness?.tier ?? 'none';
    this.group.userData.awarenessTier = this.awarenessTier;
    this.group.userData.roomPathToEnemy = nearestAwareness?.roomPath ?? [];
    return nearest;
  }

  getOpposingAwareness(enemy) {
    if (!this.group || !enemy?.group) return { tier: 'none', distance: Infinity, roomPath: [] };
    const distance = horizontalDistance(this.group.position, enemy.group.position);
    const visible = this.hasLineOfMovement(this.group.position, enemy.group.position);
    const selfRoom = this.findNearestNavigableRoom(this.group.position);
    const targetRoom = this.findNearestNavigableRoom(enemy.group.position);
    const sameRoom = Boolean(selfRoom && targetRoom && selfRoom.id === targetRoom.id);
    const roomPath = selfRoom && targetRoom ? this.findRoomPath(selfRoom.id, targetRoom.id) : [];
    const roomSteps = roomPath.length > 1 ? roomPath.length - 1 : (sameRoom ? 0 : Infinity);
    const adjacentRoom = roomSteps === 1;
    const nearDoorway = adjacentRoom && distance <= DOORWAY_COMBAT_AWARENESS_RADIUS;

    if ((sameRoom && distance <= this.template.combatEngageDistance) || distance <= this.template.combatEngageDistance || nearDoorway) {
      return { tier: 'melee', distance, roomPath };
    }
    if ((sameRoom && distance <= COMBAT_AWARENESS_RADIUS) || (visible && distance <= COMBAT_AWARENESS_RADIUS) || nearDoorway) {
      return { tier: 'combat', distance, roomPath };
    }
    if (sameRoom && distance <= SAME_ROOM_AWARENESS_RADIUS) {
      return { tier: 'same_room', distance, roomPath };
    }
    if (adjacentRoom && distance <= ADJACENT_ROOM_AWARENESS_RADIUS) {
      return { tier: 'adjacent_room', distance, roomPath };
    }
    if (roomSteps <= MAX_FAR_ROOM_PATH_STEPS && distance <= FAR_AWARENESS_RADIUS) {
      return { tier: 'far', distance, roomPath };
    }
    if (roomSteps <= MAX_SHORT_ROUTE_INVESTIGATION_STEPS && distance <= SHORT_ROUTE_INVESTIGATION_RADIUS) {
      return { tier: 'short_route', distance, roomPath };
    }
    return { tier: 'none', distance, roomPath };
  }

  updateEnemyTarget(deltaSeconds) {
    const target = this.currentTarget.enemy;
    if (!target?.isAlive || !target.group) {
      this.currentTarget = null;
      return;
    }

    const awareness = this.getOpposingAwareness(target);
    this.awarenessTier = awareness.tier;
    this.group.userData.awarenessTier = awareness.tier;
    this.group.userData.roomPathToEnemy = awareness.roomPath;
    if (awareness.tier === 'none') {
      this.currentTarget = null;
      return;
    }

    const toTarget = target.group.position.clone().sub(this.group.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    if (distance > 0.001) this.faceDirection(toTarget.clone().normalize(), deltaSeconds);

    if (this.awarenessReactionDelay > 0) {
      this.setBehaviorState(awareness.tier === 'far' || awareness.tier === 'adjacent_room' || awareness.tier === 'short_route' ? 'investigate_enemy_faction' : 'combat_enter');
      return;
    }

    if (distance <= this.template.combatEngageDistance || awareness.tier === 'melee' || awareness.tier === 'combat') {
      this.updateEnemyCombat(deltaSeconds, target, distance, toTarget);
      return;
    }

    const investigativeTier = awareness.tier === 'far' || awareness.tier === 'adjacent_room' || awareness.tier === 'short_route';
    const speed = investigativeTier
      ? this.template.walkSpeed * (0.78 + Math.random() * 0.1)
      : this.template.seekSpeed * 0.72;
    const state = investigativeTier ? 'investigate_enemy_faction' : 'seek_enemy_faction';
    const stopDistance = investigativeTier ? Math.max(this.template.combatEngageDistance + 3, this.template.desiredCombatDistance + 2) : this.template.combatEngageDistance * 0.9;
    this.moveToPosition(target.group.position, speed, deltaSeconds, Math.max(0, distance - stopDistance), state);
  }

  updateEnemyCombat(deltaSeconds, target, distance, toTarget) {
    this.activeWaypoint = null;
    this.combatManeuverTimer = Math.max(0, this.combatManeuverTimer - deltaSeconds);
    const direction = distance > 0.001 ? toTarget.clone().normalize() : new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
    const strafe = new THREE.Vector3(direction.z * this.combatStrafeSign, 0, -direction.x * this.combatStrafeSign).normalize();

    if (distance <= this.template.attackRange && this.attackCooldown <= 0 && this.hasLineOfMovement(this.group.position, target.group.position)) {
      this.chooseAndBeginEnemyAttack(distance);
      return;
    }

    if (this.combatManeuverTimer <= 0) this.chooseCombatManeuver(distance);

    if (distance < this.template.tooCloseDistance) {
      const sideBias = Math.random() < 0.55 ? strafe.multiplyScalar(0.75) : new THREE.Vector3();
      const backstep = direction.clone().multiplyScalar(-1).add(sideBias).normalize();
      this.moveToward(backstep, this.template.backstepSpeed, deltaSeconds, Infinity, 'defensive_backstep');
      this.logCombatEvent('maneuver', { target, maneuver: 'backstep', distance });
      return;
    }

    if (this.combatManeuver === 'lunge' && distance > this.template.attackRange * 0.82) {
      this.moveToward(direction, this.template.lungeSpeed, deltaSeconds, Math.max(0, distance - this.template.attackRange * 0.78), 'combat_lunge');
      this.logCombatEvent('maneuver', { target, maneuver: 'lunge', distance });
      return;
    }

    if (distance > this.template.desiredCombatDistance + 0.75) {
      this.moveToward(direction, this.template.seekSpeed * 0.82, deltaSeconds, Math.max(0, distance - this.template.desiredCombatDistance), 'combat_lunge');
      return;
    }

    if (this.combatManeuver === 'feint') {
      this.setBehaviorState('combat_feint');
      this.logCombatEvent('maneuver', { target, maneuver: 'feint', distance });
      return;
    }

    if (this.combatManeuver === 'backstep') {
      this.moveToward(direction.clone().multiplyScalar(-1).add(strafe.clone().multiplyScalar(0.35)).normalize(), this.template.backstepSpeed, deltaSeconds, Infinity, 'defensive_backstep');
      return;
    }

    this.moveToward(strafe, this.template.circleSpeed, deltaSeconds, Infinity, Math.random() < 0.35 ? 'defensive_strafe' : 'combat_circle');
    this.logCombatEvent('maneuver', { target, maneuver: 'circle', distance });
  }

  chooseCombatManeuver(distance) {
    this.combatStrafeSign = Math.random() < 0.5 ? -1 : 1;
    const roll = Math.random();
    if (distance < this.template.tooCloseDistance || roll < this.template.defensiveManeuverChance * 0.45) {
      this.combatManeuver = 'backstep';
      this.combatManeuverTimer = 0.45 + Math.random() * 0.45;
    } else if (roll < this.template.defensiveManeuverChance) {
      this.combatManeuver = 'strafe';
      this.combatManeuverTimer = 0.55 + Math.random() * 0.65;
    } else if (roll < this.template.defensiveManeuverChance + this.template.offensiveLungeChance) {
      this.combatManeuver = 'lunge';
      this.combatManeuverTimer = 0.28 + Math.random() * 0.34;
    } else {
      this.combatManeuver = 'feint';
      this.combatManeuverTimer = 0.22 + Math.random() * 0.32;
    }
    this.group.userData.combatManeuver = this.combatManeuver;
  }

  chooseAndBeginEnemyAttack(distance) {
    const canJump = this.species === 'sheep_demon'
      && this.jumpAttackCooldown <= 0
      && distance >= this.template.tooCloseDistance
      && Math.random() < this.template.jumpAttackChance;
    const attackState = canJump ? 'jump_attack_enemy_faction' : 'attack_enemy_faction';
    const choices = canJump ? ['jump'] : this.template.enemyAttackAnimations;
    this.pendingAttackAnimation = choices[Math.floor(Math.random() * choices.length)] ?? this.template.animationMap[attackState];
    if (canJump) this.jumpAttackCooldown = this.template.jumpAttackCooldownSeconds * (0.75 + Math.random() * 0.5);
    this.beginAttack(attackState, { maneuver: canJump ? 'jump_attack' : this.pendingAttackAnimation });
  }

  updatePlayerTarget(deltaSeconds, playerPosition) {
    const toPlayer = playerPosition.clone().sub(this.group.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();
    if (distance <= this.template.attackRange && this.attackCooldown <= 0 && this.hasLineOfMovement(this.group.position, playerPosition)) {
      this.beginAttack('attack_player_fallback');
      return;
    }

    this.moveToPosition(playerPosition, this.template.walkSpeed, deltaSeconds, Math.max(0, distance - this.template.attackRange * 0.82), 'seek_player_fallback');
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

    this.moveToPosition(target, this.template.walkSpeed, deltaSeconds, distance, 'patrol');
  }

  beginAttack(state, { maneuver = null } = {}) {
    this.attackElapsed = 0;
    this.attackHasDamaged = false;
    this.attackCooldown = this.template.attackCooldownSeconds * (0.85 + Math.random() * 0.35);
    this.combatManeuverTimer = 0;
    this.setBehaviorState(state, { force: true });
    this.logCombatEvent('attack-started', {
      target: this.currentTarget?.enemy,
      maneuver: maneuver ?? this.pendingAttackAnimation ?? state,
      distance: this.currentTarget?.enemy?.group ? horizontalDistance(this.group.position, this.currentTarget.enemy.group.position) : null,
    }, { force: true });
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
      this.pendingAttackAnimation = null;
      if (this.currentTarget?.type === 'player') {
        this.setBehaviorState('seek_player_fallback');
      } else {
        this.recoverTimer = 0.22 + Math.random() * 0.28;
        this.setBehaviorState('recover');
      }
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
        const result = target.receiveFactionDamage(this.template.attackDamage, this.template.displayName);
        this.attackHasDamaged = true;
        this.logCombatEvent('damage-applied', {
          target,
          maneuver: this.pendingAttackAnimation ?? this.behaviorState,
          distance: horizontalDistance(this.group.position, target.group.position),
          damage: this.template.attackDamage,
          targetHp: target.health,
          killed: Boolean(result?.killed),
        }, { force: true });
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
      return { killed: true, remainingHealth: 0 };
    }
    return { killed: false, remainingHealth: this.health };
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
    this.logCombatEvent('death', { maneuver: source, targetHp: 0 }, { force: true });
  }

  hideCorpse() {
    if (!this.group || this.isRemoved) return;
    this.group.visible = false;
    this.scene.remove(this.group);
    if (this.pathMarker) this.scene.remove(this.pathMarker);
    if (this.stuckMarker) this.scene.remove(this.stuckMarker);
    this.isRemoved = true;
  }


  logCombatEvent(event, { target = null, maneuver = null, distance = null, damage = null, targetHp = null, killed = null } = {}, { force = false } = {}) {
    if (!IS_DEV || !this.group) return;
    this.devCombatLogElapsed += force ? DEV_DIAGNOSTIC_INTERVAL_SECONDS : 0;
    const key = `${event}:${this.behaviorState}:${target?.id ?? 'none'}:${maneuver ?? 'none'}`;
    if (!force && this.devCombatLogElapsed < 1.5 && this.devLastCombatLogKey === key) return;
    if (!force && this.devCombatLogElapsed < 0.75) return;
    this.devCombatLogElapsed = 0;
    this.devLastCombatLogKey = key;
    console.info('Black Grass Temple faction combat:', {
      event,
      id: this.id,
      species: this.species,
      targetId: target?.id ?? null,
      targetSpecies: target?.species ?? null,
      combatState: this.behaviorState,
      awarenessTier: this.awarenessTier,
      distance: distance === null || distance === undefined ? null : Number(distance.toFixed(2)),
      maneuver,
      damage,
      targetRemainingHp: targetHp,
      killed,
    });
  }

  moveToPosition(finalTarget, speed, deltaSeconds, maxDistance = Infinity, movingState = 'patrol') {
    const waypoint = this.getMovementWaypoint(finalTarget, movingState);
    this.activeWaypoint = this.hasLineOfMovement(this.group.position, finalTarget) ? null : waypoint;
    const toWaypoint = waypoint.clone().sub(this.group.position);
    toWaypoint.y = 0;
    const waypointDistance = toWaypoint.length();
    if (waypointDistance < 0.2) {
      this.activeWaypoint = null;
      return;
    }
    const direction = toWaypoint.normalize();
    const allowedDistance = Math.min(maxDistance, waypointDistance);
    this.moveToward(direction, speed, deltaSeconds, allowedDistance, movingState);
  }

  getMovementWaypoint(finalTarget, movingState) {
    if (!this.navigationGraph) return finalTarget.clone();
    if (this.activeWaypoint) return this.activeWaypoint.clone();
    this.pathRepathElapsed = 0;
    const final = finalTarget.clone();
    final.y = 0;
    if (this.hasLineOfMovement(this.group.position, final)) return final;

    const startRoom = this.findNearestNavigableRoom(this.group.position);
    const targetRoom = this.findNearestNavigableRoom(final);
    if (!startRoom || !targetRoom || startRoom.id === targetRoom.id) return final;

    const roomPath = this.findRoomPath(startRoom.id, targetRoom.id);
    if (roomPath.length < 2) return final;
    const nextRoomId = roomPath[1];
    const link = (this.navigationGraph.links[startRoom.id] ?? []).find((candidate) => candidate.to === nextRoomId);
    const doorway = link?.waypoint?.clone?.() ?? this.navigationGraph.rooms[nextRoomId]?.center?.clone?.();
    const nextCenter = this.navigationGraph.rooms[nextRoomId]?.center?.clone?.();
    const waypoint = doorway && horizontalDistance(this.group.position, doorway) > 0.65 ? doorway : (nextCenter ?? final);
    if (!this.isWaypointWalkable(waypoint)) return nextCenter && this.isWaypointWalkable(nextCenter) ? nextCenter : final;

    if (IS_DEV && this.group) {
      this.group.userData.navigation = {
        movingState,
        startRoom: startRoom.id,
        targetRoom: targetRoom.id,
        roomPath,
        waypoint: makeNavPointSummary(waypoint),
      };
    }
    return waypoint;
  }

  findNearestNavigableRoom(position) {
    const rooms = Object.values(this.navigationGraph?.rooms ?? {});
    const containing = rooms.find((room) => position.x >= room.minX && position.x <= room.maxX && position.z >= room.minZ && position.z <= room.maxZ);
    if (containing) return containing;
    return rooms.reduce((best, room) => {
      const distance = horizontalDistance(position, room.center);
      return !best || distance < best.distance ? { room, distance } : best;
    }, null)?.room ?? null;
  }

  findRoomPath(startRoomId, targetRoomId) {
    if (startRoomId === targetRoomId) return [startRoomId];
    const queue = [[startRoomId]];
    const visited = new Set([startRoomId]);
    while (queue.length) {
      const path = queue.shift();
      const roomId = path[path.length - 1];
      for (const link of this.navigationGraph.links[roomId] ?? []) {
        if (visited.has(link.to)) continue;
        const nextPath = [...path, link.to];
        if (link.to === targetRoomId) return nextPath;
        visited.add(link.to);
        queue.push(nextPath);
      }
    }
    return [];
  }

  hasLineOfMovement(start, end) {
    const delta = end.clone().sub(start);
    delta.y = 0;
    const distance = delta.length();
    if (distance < 0.001) return true;
    const direction = delta.multiplyScalar(1 / distance);
    const steps = Math.max(2, Math.ceil(distance / 0.65));
    for (let i = 1; i <= steps; i += 1) {
      const probe = start.clone().add(direction.clone().multiplyScalar((distance * i) / steps));
      probe.y = start.y;
      if (!this.isWaypointWalkable(probe)) return false;
    }
    return true;
  }

  isWaypointWalkable(point) {
    if (!point || !this.collision?.canStandAt(point)) return false;
    const offsets = [
      [NAV_CLEARANCE_RADIUS, 0], [-NAV_CLEARANCE_RADIUS, 0], [0, NAV_CLEARANCE_RADIUS], [0, -NAV_CLEARANCE_RADIUS],
    ];
    return offsets.every(([x, z]) => this.collision.canStandAt(new THREE.Vector3(point.x + x, point.y, point.z + z)));
  }

  triggerUnstuck() {
    if (!this.group) return;
    const facing = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
    const lateralSign = Math.random() < 0.5 ? -1 : 1;
    this.unstuckDirection.set(
      -facing.x * 0.75 + facing.z * lateralSign * 0.55,
      0,
      -facing.z * 0.75 - facing.x * lateralSign * 0.55,
    ).normalize();
    this.unstuckTimer = UNSTUCK_SECONDS;
    this.stuckElapsed = 0;
    this.pathRepathElapsed = WAYPOINT_REPATH_SECONDS;
    this.activeWaypoint = null;
    this.pauseTimer = 0;
    this.patrolTargetIndex = (this.patrolTargetIndex + 1) % this.patrolPoints.length;
    if (IS_DEV) {
      console.warn('Black Grass Temple faction enemy unstuck recovery:', {
        id: this.id,
        species: this.species,
        position: vectorSummary(this.group.position),
        nextPatrolPoint: makeNavPointSummary(this.patrolPoints[this.patrolTargetIndex]),
      });
    }
  }

  moveToward(direction, speed, deltaSeconds, maxDistance = Infinity, movingState = 'patrol', { suppressStuckTracking = false } = {}) {
    const stepDistance = Math.min(maxDistance, speed * deltaSeconds);
    if (stepDistance <= 0.001) return 0;
    const previous = this.group.position.clone();
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
        this.activeWaypoint = null;
        this.pathRepathElapsed = WAYPOINT_REPATH_SECONDS;
        this.setBehaviorState(movingState);
      }
    }
    const movedDistance = horizontalDistance(previous, this.group.position);
    if (!suppressStuckTracking) {
      this.stuckElapsed = movedDistance < STUCK_MOVEMENT_THRESHOLD ? this.stuckElapsed + deltaSeconds : 0;
      if (this.stuckElapsed >= STUCK_SECONDS) this.triggerUnstuck();
    }
    this.faceDirection(movedDistance > 0.001 ? this.group.position.clone().sub(previous).normalize() : direction, deltaSeconds);
    return movedDistance;
  }

  faceDirection(direction, deltaSeconds) {
    const desiredYaw = Math.atan2(direction.x, direction.z);
    this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, desiredYaw, 5.4, deltaSeconds);
  }

  resolveStateAnimation(state) {
    const requested = (state === 'attack_enemy_faction' || state === 'jump_attack_enemy_faction') && this.pendingAttackAnimation
      ? this.pendingAttackAnimation
      : this.template.animationMap[state] ?? 'idle';
    return resolveAnimationState({ species: this.species, requestedState: requested, assets: this.template.assets });
  }

  setBehaviorState(state, { force = false } = {}) {
    if (!this.animation || (!force && this.behaviorState === state)) return;
    const animationState = this.resolveStateAnimation(state);
    const nextTrack = this.animation.tracks[animationState];
    const previousTrack = this.animation.tracks[this.resolveStateAnimation(this.behaviorState ?? 'spawn')];
    if (!nextTrack) return;
    this.group.visible = true;
    Object.entries(this.animation.tracks).forEach(([trackState, track]) => {
      track.root.visible = trackState === animationState;
    });
    nextTrack.action?.reset().fadeIn(0.1).play();
    if (previousTrack?.action && previousTrack !== nextTrack) previousTrack.action.fadeOut(0.1);
    this.behaviorState = state;
    this.group.userData.behaviorState = state;
    this.group.userData.animationState = animationState;
    this.group.userData.visibleAnimationState = animationState;
    this.group.userData.visibleAnimationRootCount = 1;
  }

  getActionDuration(animationState, fallback) {
    return this.animation?.tracks[animationState]?.clip?.duration || fallback;
  }
}

export class BlackGrassTempleFactionManager {
  constructor({ scene, collision, anchors, navigationGraph = null }) {
    this.scene = scene;
    this.collision = collision;
    this.anchors = anchors;
    this.navigationGraph = navigationGraph;
    this.enemies = [];
    this.spawnSerial = 0;
    this.respawnTimers = { sheep_demon: null, neck_man: null };
    this.devStatusElapsed = 0;
    this.initialWaveSpawned = false;
    this.maxActiveByFaction = MAX_ACTIVE_BY_FACTION;
    this.respawnCooldownSeconds = RESPAWN_COOLDOWN_SECONDS;
    this.userData = {
      scope: 'Black Grass Temple only',
      factions: ['sheep_demon', 'neck_man'],
      stateMachine: FACTION_STATE_MACHINE,
      targetPriority: ['nearest living opposing-faction enemy', 'player fallback', 'patrol target'],
      retargetIntervalSeconds: RETARGET_INTERVAL_SECONDS,
      awareness: {
        farRadius: FAR_AWARENESS_RADIUS,
        sameRoomRadius: SAME_ROOM_AWARENESS_RADIUS,
        adjacentRoomRadius: ADJACENT_ROOM_AWARENESS_RADIUS,
        combatRadius: COMBAT_AWARENESS_RADIUS,
        doorwayCombatRadius: DOORWAY_COMBAT_AWARENESS_RADIUS,
        shortRouteInvestigationRadius: SHORT_ROUTE_INVESTIGATION_RADIUS,
        maxShortRouteInvestigationSteps: MAX_SHORT_ROUTE_INVESTIGATION_STEPS,
      },
      respawnCooldownSeconds: RESPAWN_COOLDOWN_SECONDS,
      initialWaveByFaction: INITIAL_WAVE_BY_FACTION,
      maxActiveByFaction: MAX_ACTIVE_BY_FACTION,
      maxActiveTotal: Object.values(MAX_ACTIVE_BY_FACTION).reduce((sum, count) => sum + count, 0),
      animationReport: BLACK_GRASS_FACTION_ANIMATION_REPORT,
    };
  }

  spawnInitialWave() {
    this.spawnFaction('sheep_demon', INITIAL_WAVE_BY_FACTION.sheep_demon, { initialWave: true });
    this.spawnFaction('neck_man', INITIAL_WAVE_BY_FACTION.neck_man, { initialWave: true });
    this.initialWaveSpawned = true;
    if (IS_DEV) {
      console.info('Black Grass Temple faction war initialized:', {
        ...this.userData,
        firstWaveNote: 'Initial wave intentionally reduced to one Sheep Demon and one Neck Man so both rigs become visible quickly on mobile.',
        status: this.getStatusSummary(),
      });
    }
  }

  update(deltaSeconds, playerPosition) {
    const context = { enemies: this.enemies, playerPosition };
    this.enemies.forEach((enemy) => enemy.update(deltaSeconds, context));
    this.updateDevStatus(deltaSeconds);

    Object.keys(this.respawnTimers).forEach((species) => {
      const livingCount = this.enemies.filter((enemy) => enemy.species === species && enemy.health > 0 && !enemy.isRemoved).length;
      if (livingCount === 0 && this.respawnTimers[species] === null) {
        this.respawnTimers[species] = RESPAWN_COOLDOWN_SECONDS;
        if (IS_DEV) console.info(`Black Grass Temple ${species} faction wiped; respawn pending in ${RESPAWN_COOLDOWN_SECONDS}s.`);
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

  spawnFaction(species, requestedCount, { initialWave = false } = {}) {
    const livingCount = this.getLivingEnemies(species).length;
    const count = Math.max(0, Math.min(requestedCount, this.maxActiveByFaction[species] - livingCount));
    const usedAnchorIds = new Set();
    for (let i = 0; i < count; i += 1) {
      const anchor = this.chooseSpawnAnchor(species, i, usedAnchorIds, { initialWave });
      usedAnchorIds.add(anchor.id);
      const enemy = new BlackGrassFactionEnemy({
        scene: this.scene,
        collision: this.collision,
        navigationGraph: this.navigationGraph,
        species,
        id: `black-grass-temple-${species}-${this.spawnSerial += 1}`,
        spawnAnchor: anchor,
        patrolPoints: anchor.patrolPoints,
        onLoaded: () => this.logDevStatus('enemy-loaded'),
      });
      this.enemies.push(enemy);
      enemy.load();
    }
  }

  chooseSpawnAnchor(species, offset = 0, excludedAnchorIds = new Set(), { initialWave = false } = {}) {
    const initialPool = this.anchors.filter((anchor) => anchor.initialWave && anchor.preferredFaction === species);
    const pool = initialWave && initialPool.length
      ? initialPool
      : this.anchors.filter((anchor) => !anchor.initialWave && (anchor.preferredFaction === species || anchor.preferredFaction === 'neutral'));
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

  getStatusSummary() {
    const living = this.getLivingEnemies();
    const loaded = this.enemies.filter((enemy) => enemy.isLoaded).length;
    const visible = this.enemies.filter((enemy) => enemy.group?.visible && Object.values(enemy.animation?.tracks ?? {}).some((track) => track.root.visible)).length;
    const countLiving = (species) => living.filter((enemy) => enemy.species === species).length;
    return {
      totalCreated: this.enemies.length,
      totalLoaded: loaded,
      totalVisible: visible,
      livingSheep: countLiving('sheep_demon'),
      livingNeck: countLiving('neck_man'),
      respawnTimers: Object.fromEntries(Object.entries(this.respawnTimers).map(([species, timer]) => [species, timer === null ? null : Number(timer.toFixed(2))])),
      targets: this.enemies.map((enemy) => ({
        id: enemy.id,
        species: enemy.species,
        loaded: enemy.isLoaded,
        visible: Boolean(enemy.group?.visible),
        state: enemy.group?.userData.behaviorState ?? enemy.behaviorState,
        animationState: enemy.group?.userData.animationState ?? null,
        targetType: enemy.group?.userData.targetType ?? null,
        targetId: enemy.group?.userData.targetId ?? null,
        position: enemy.group ? vectorSummary(enemy.group.position) : null,
      })),
    };
  }

  updateDevStatus(deltaSeconds) {
    if (!IS_DEV) return;
    this.devStatusElapsed += deltaSeconds;
    if (this.devStatusElapsed < DEV_DIAGNOSTIC_INTERVAL_SECONDS) return;
    this.devStatusElapsed = 0;
    this.logDevStatus('interval');
  }

  logDevStatus(reason) {
    if (!IS_DEV) return;
    console.info(`Black Grass Temple faction status (${reason}):`, this.getStatusSummary());
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
