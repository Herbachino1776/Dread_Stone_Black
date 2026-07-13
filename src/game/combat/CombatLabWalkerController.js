import * as THREE from 'three';
import { CombatBloodEffects } from './CombatBloodEffects.js';
import { CombatDirector } from './CombatDirector.js';
import { HumanoidCombatActor } from './HumanoidCombatActor.js';
import { TESTMAN_COMBAT_PROFILE } from './HumanoidModelProfiles.js';

export const WALKER_STATES = Object.freeze({
  spawning: 'SPAWNING',
  blendingToWalk: 'BLENDING_TO_WALK',
  approaching: 'APPROACHING',
  blendingToIdle: 'BLENDING_TO_IDLE',
  nearPlayer: 'NEAR_PLAYER',
  hitReacting: 'HIT_REACTING',
  losingConsciousness: 'LOSING_CONSCIOUSNESS',
  dying: 'LOSING_CONSCIOUSNESS',
  grounded: 'GROUNDED',
  disposed: 'DISPOSED',
  respawning: 'RESPAWNING',
});

export const COMBAT_LAB_WALKER_CONFIG = Object.freeze({
  spawnRadiusMinimum: 5,
  spawnRadiusMaximum: 7,
  fallbackPosition: Object.freeze([4.5, 0, -6.5]),
  baseWalkingSpeed: 0.72,
  minimumWalkingSpeed: 0.55,
  maximumWalkingSpeed: 0.85,
  acceleration: 0.78,
  deceleration: 1.05,
  turnRateRadians: THREE.MathUtils.degToRad(72),
  stopTargetDistance: 1.34,
  stopEnterDistance: 1.45,
  resumeDistance: 1.86,
  slowDistance: 2.35,
  idleToWalkSeconds: 0.82,
  walkToIdleSeconds: 0.96,
  deathCollapseSeconds: 5.4,
  respawnDelaySeconds: 0.32,
  firstStabSpeedMultiplier: 0.78,
  torsoQualifyingDepth: 0.05,
  neckQualifyingDepth: 0.045,
  maximumGroundStep: 0.14,
  maximumGroundVariation: 0.16,
  spawnCandidateCount: 12,
});

const VITAL_REGIONS = new Set(['upper_chest', 'lower_chest', 'abdomen', 'neck']);
const LIVING_MOVEMENT_STATES = new Set([
  WALKER_STATES.spawning,
  WALKER_STATES.blendingToWalk,
  WALKER_STATES.approaching,
  WALKER_STATES.blendingToIdle,
  WALKER_STATES.nearPlayer,
  WALKER_STATES.hitReacting,
]);
const ALLOWED_TRANSITIONS = Object.freeze({
  [WALKER_STATES.respawning]: new Set([WALKER_STATES.spawning, WALKER_STATES.disposed]),
  [WALKER_STATES.spawning]: new Set([WALKER_STATES.blendingToWalk, WALKER_STATES.dying, WALKER_STATES.disposed]),
  [WALKER_STATES.blendingToWalk]: new Set([WALKER_STATES.approaching, WALKER_STATES.blendingToIdle, WALKER_STATES.hitReacting, WALKER_STATES.dying, WALKER_STATES.disposed]),
  [WALKER_STATES.approaching]: new Set([WALKER_STATES.blendingToIdle, WALKER_STATES.hitReacting, WALKER_STATES.dying, WALKER_STATES.disposed]),
  [WALKER_STATES.blendingToIdle]: new Set([WALKER_STATES.nearPlayer, WALKER_STATES.blendingToWalk, WALKER_STATES.hitReacting, WALKER_STATES.dying, WALKER_STATES.disposed]),
  [WALKER_STATES.nearPlayer]: new Set([WALKER_STATES.blendingToWalk, WALKER_STATES.hitReacting, WALKER_STATES.dying, WALKER_STATES.disposed]),
  [WALKER_STATES.hitReacting]: new Set([WALKER_STATES.approaching, WALKER_STATES.blendingToIdle, WALKER_STATES.nearPlayer, WALKER_STATES.dying, WALKER_STATES.disposed]),
  [WALKER_STATES.losingConsciousness]: new Set([WALKER_STATES.grounded, WALKER_STATES.disposed]),
  [WALKER_STATES.grounded]: new Set([WALKER_STATES.disposed]),
  [WALKER_STATES.disposed]: new Set([WALKER_STATES.respawning]),
});

const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);
const smoothstep01 = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const moveToward = (current, target, maximumDelta) => current < target ? Math.min(target, current + maximumDelta) : Math.max(target, current - maximumDelta);
const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const moveAngleToward = (current, target, maximumDelta) => current + THREE.MathUtils.clamp(angleDelta(current, target), -maximumDelta, maximumDelta);

export class WalkerVitalStabPolicy {
  constructor({ torsoDepth = COMBAT_LAB_WALKER_CONFIG.torsoQualifyingDepth, neckDepth = COMBAT_LAB_WALKER_CONFIG.neckQualifyingDepth } = {}) {
    this.torsoDepth = torsoDepth;
    this.neckDepth = neckDepth;
    this.countedWoundIds = new Set();
    this.lastQualifyingRegion = null;
    this.lastQualifyingDepth = 0;
    this.criticalStabCount = 0;
    this.locked = false;
  }

  qualifies(wound) {
    if (!wound || this.countedWoundIds.has(wound.id)) return false;
    if (wound.interactionKind !== 'puncture' || wound.deliberateStab !== true || wound.surfaceRuptured !== true) return false;
    if (!VITAL_REGIONS.has(wound.regionId)) return false;
    const threshold = wound.regionId === 'neck' ? this.neckDepth : this.torsoDepth;
    return Number.isFinite(wound.maximumDepth) && wound.maximumDepth >= threshold;
  }

  evaluate(wounds = []) {
    if (this.locked) return [];
    const newlyQualified = [];
    for (const wound of wounds) {
      if (!this.qualifies(wound)) continue;
      this.countedWoundIds.add(wound.id);
      this.criticalStabCount += 1;
      this.lastQualifyingRegion = wound.regionId;
      this.lastQualifyingDepth = wound.maximumDepth;
      newlyQualified.push(wound);
      if (this.criticalStabCount >= 2) {
        this.locked = true;
        break;
      }
    }
    return newlyQualified;
  }

  forceQualifyingStab(regionId = 'upper_chest', depth = this.torsoDepth + 0.01) {
    if (this.locked) return null;
    const id = `walker_debug_wound_${this.criticalStabCount + 1}`;
    const wound = { id, interactionKind: 'puncture', deliberateStab: true, surfaceRuptured: true, regionId, maximumDepth: depth };
    return this.evaluate([wound])[0] ?? null;
  }

  getDiagnostics() {
    return {
      criticalStabCount: this.criticalStabCount,
      qualifyingWoundIds: [...this.countedWoundIds],
      lastQualifyingRegion: this.lastQualifyingRegion,
      lastQualifyingDepth: this.lastQualifyingDepth,
      locked: this.locked,
    };
  }
}

export class CombatLabWalkerController {
  constructor({ scene, physics, collision, combatRouter, stationaryActor, feedbackSystem = null, playerProvider = null, eventSink = null, beforeActorDisposal = null, enabled = true, query = null, actorFactory = null, config = COMBAT_LAB_WALKER_CONFIG, environment = null } = {}) {
    this.scene = scene;
    this.physics = physics;
    this.collision = collision;
    this.combatRouter = combatRouter;
    this.stationaryActor = stationaryActor;
    this.feedbackSystem = feedbackSystem;
    this.playerProvider = playerProvider;
    this.eventSink = eventSink;
    this.beforeActorDisposal = beforeActorDisposal;
    this.actorFactory = actorFactory;
    this.config = config;
    this.environment = environment ?? {};
    this.query = query ?? new URLSearchParams();
    this.enabled = Boolean(enabled);
    const pauseQueryKey = this.environment.queryKeys?.pause ?? 'walkerPause';
    const speedQueryKey = this.environment.queryKeys?.speed ?? 'walkerSpeed';
    this.pauseLocomotion = this.query.get?.(pauseQueryKey) === '1';
    const requestedSpeedValue = this.query.get?.(speedQueryKey);
    const requestedSpeed = requestedSpeedValue == null || requestedSpeedValue === '' ? NaN : Number(requestedSpeedValue);
    this.baseMaximumSpeed = Number.isFinite(requestedSpeed) ? THREE.MathUtils.clamp(requestedSpeed, config.minimumWalkingSpeed, config.maximumWalkingSpeed) : config.baseWalkingSpeed;
    this.state = this.enabled ? WALKER_STATES.respawning : WALKER_STATES.disposed;
    this.stateElapsed = 0;
    this.respawnGeneration = 0;
    this.actor = null;
    this.director = null;
    this.bloodEffects = null;
    this.playerBlocker = null;
    this.routingRegistered = false;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1);
    this.nextPosition = new THREE.Vector3();
    this.spawnCandidate = new THREE.Vector3();
    this.pathProbe = new THREE.Vector3();
    this.toPlayer = new THREE.Vector3();
    this.currentYaw = 0;
    this.desiredYaw = 0;
    this.currentSpeed = 0;
    this.desiredSpeed = 0;
    this.distanceToPlayer = Infinity;
    this.maximumSpeed = this.baseMaximumSpeed;
    this.lethality = new WalkerVitalStabPolicy();
    this.reactionResumeState = WALKER_STATES.approaching;
    this.deathCollisionReleased = false;
    this.collapseDirection = 1;
    this.deathInitialSpeed = 0;
    this.deathDurationSeconds = config.deathCollapseSeconds;
    this.selectedDeathName = null;
    this.stateHistory = [this.state];
    this.lastDisposalSummary = null;
    this.footprintActive = true;
    this.spawnGroundHeight = 0;
    this.spawnDiagnostics = null;
  }

  setState(nextState) {
    if (this.state === nextState) return false;
    if (!ALLOWED_TRANSITIONS[this.state]?.has(nextState)) throw new Error(`Invalid walker transition ${this.state} -> ${nextState}`);
    this.state = nextState;
    this.stateElapsed = 0;
    this.stateHistory.push(nextState);
    if (this.stateHistory.length > 24) this.stateHistory.shift();
    return true;
  }

  resolvePlayerPosition(player) {
    return this.environment.getPlayerPosition?.(player) ?? player?.position ?? null;
  }

  resolvePlayerFacingYaw(player) {
    const yaw = this.environment.getPlayerFacingYaw?.(player);
    return Number.isFinite(yaw) ? yaw : Number.isFinite(player?.yaw) ? player.yaw : 0;
  }

  sampleGround(position) {
    const sample = this.environment.sampleGround?.(position.x, position.z)
      ?? this.collision?.sampleWalkableY?.(position.x, position.z, position.y ?? 0)
      ?? { y: position.y ?? 0, kind: 'fallback' };
    return Number.isFinite(sample?.y) ? sample : null;
  }

  chooseSpawnPosition(player) {
    const playerPosition = this.resolvePlayerPosition(player);
    if (!playerPosition || this.environment.canSpawnForPlayer?.(player, playerPosition) === false) return null;
    const forwardCone = this.environment.spawnMode === 'forwardCone';
    const facingYaw = this.resolvePlayerFacingYaw(player);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const side = this.respawnGeneration % 2 ? -1 : 1;
    const forwardAngles = [18, 24, 12, 29, 21, 15].map((degrees) => THREE.MathUtils.degToRad(degrees));
    for (let attempt = 0; attempt < this.config.spawnCandidateCount; attempt += 1) {
      const angle = forwardCone
        ? facingYaw + side * forwardAngles[attempt % forwardAngles.length] * (attempt % 2 ? -1 : 1)
        : 0.58 + (this.respawnGeneration * 3 + attempt) * goldenAngle;
      const radiusT = ((this.respawnGeneration * 5 + attempt * 7) % 11) / 10;
      const radius = THREE.MathUtils.lerp(this.config.spawnRadiusMinimum + 0.15, this.config.spawnRadiusMaximum - 0.15, radiusT);
      this.spawnCandidate.set(playerPosition.x + Math.sin(angle) * radius, 0, playerPosition.z + Math.cos(angle) * radius);
      const ground = this.sampleGround(this.spawnCandidate);
      if (ground) this.spawnCandidate.y = ground.y;
      if (this.isSpawnCandidateValid(this.spawnCandidate, playerPosition, player)) return this.spawnCandidate.clone();
    }
    const fallback = this.environment.getFallbackSpawn?.({ player, playerPosition, facingYaw, generation: this.respawnGeneration, side, controller: this })
      ?? new THREE.Vector3().fromArray(this.config.fallbackPosition);
    const fallbackGround = this.sampleGround(fallback);
    if (fallbackGround) fallback.y = fallbackGround.y;
    return this.isSpawnCandidateValid(fallback, playerPosition, player, { fallback: true }) ? fallback.clone() : null;
  }

  isInsideEncounter(position, margin = 0.45) {
    return this.environment.isInsideEncounter?.(position, margin)
      ?? (position.x >= -7.8 + margin && position.x <= 7.8 - margin && position.z >= -9.8 + margin && position.z <= 5.8 - margin);
  }

  getBlockingEntries(position, radius = 0.4) {
    const entries = this.environment.getBlockingEntries?.(position, radius, this)
      ?? this.collision?.getIntersectingBlockers?.({ x: position.x, y: position.y + 1.55, z: position.z }, radius)
      ?? [];
    return entries.filter((blocker) => blocker !== this.playerBlocker);
  }

  isGroundLocallyStable(candidate) {
    const center = this.sampleGround(candidate);
    if (!center) return false;
    let minimum = center.y;
    let maximum = center.y;
    for (const [dx, dz] of [[0.42, 0], [-0.42, 0], [0, 0.42], [0, -0.42]]) {
      const sample = this.sampleGround({ x: candidate.x + dx, y: center.y, z: candidate.z + dz });
      if (!sample) return false;
      minimum = Math.min(minimum, sample.y);
      maximum = Math.max(maximum, sample.y);
    }
    return maximum - minimum <= this.config.maximumGroundVariation;
  }

  isSpawnCandidateValid(candidate, playerPosition, player = null, options = {}) {
    const flatPlayer = new THREE.Vector3(playerPosition.x, 0, playerPosition.z);
    const flatCandidate = new THREE.Vector3(candidate.x, 0, candidate.z);
    const distance = flatCandidate.distanceTo(flatPlayer);
    if (!this.isInsideEncounter(candidate) || distance < this.config.spawnRadiusMinimum || distance > this.config.spawnRadiusMaximum + 0.2) return false;
    if (!this.isGroundLocallyStable(candidate) || this.environment.isInsideWater?.(candidate) === true) return false;
    if (this.getBlockingEntries(candidate, 0.48).length) return false;
    const stationary = this.stationaryActor?.getBodyWorldPosition?.('pelvis', this.toPlayer);
    if (stationary && Math.hypot(candidate.x - stationary.x, candidate.z - stationary.z) < 1.15) return false;
    if (this.environment.validateSpawnCandidate?.(candidate, { player, playerPosition, fallback: options.fallback === true, controller: this }) === false) return false;
    for (let step = 1; step <= 8; step += 1) {
      const t = step / 9;
      this.pathProbe.set(THREE.MathUtils.lerp(candidate.x, playerPosition.x, t), candidate.y, THREE.MathUtils.lerp(candidate.z, playerPosition.z, t));
      const ground = this.sampleGround(this.pathProbe);
      if (!ground || Math.abs(ground.y - candidate.y) > this.config.maximumGroundVariation || this.getBlockingEntries(this.pathProbe, 0.28).length || this.environment.isInsideWater?.(this.pathProbe) === true) return false;
    }
    return true;
  }

  spawn(player = this.playerProvider?.()) {
    const playerPosition = this.resolvePlayerPosition(player);
    if (!this.enabled || this.actor || !playerPosition) return false;
    this.respawnGeneration += 1;
    const spawnPosition = this.chooseSpawnPosition(player);
    if (!spawnPosition) {
      this.respawnGeneration -= 1;
      return false;
    }
    this.toPlayer.set(playerPosition.x - spawnPosition.x, 0, playerPosition.z - spawnPosition.z);
    const targetYaw = Math.atan2(this.toPlayer.x, this.toPlayer.z);
    const yawOffset = THREE.MathUtils.degToRad(this.respawnGeneration % 2 ? 10 : -12);
    this.currentYaw = targetYaw + yawOffset;
    this.desiredYaw = targetYaw;
    this.position.copy(spawnPosition);
    const spawnOffset = new THREE.Vector3(spawnPosition.x, spawnPosition.y, spawnPosition.z + 3.55);
    const actorOptions = { physics: this.physics, scene: this.scene, spawnOffset, spawnYaw: this.currentYaw, visualProfile: TESTMAN_COMBAT_PROFILE, automaticMortality: false, isolateVisualMaterials: true, eventSink: (event, payload) => this.handleActorEvent(event, payload) };
    this.actor = this.actorFactory ? this.actorFactory(actorOptions) : new HumanoidCombatActor(actorOptions);
    this.actor.root.name = this.environment.getActorName?.(this.respawnGeneration) ?? `combat-lab-authored-walker-${this.respawnGeneration}`;
    this.actor.setLivingRootTransform?.(this.position, this.currentYaw);
    this.spawnGroundHeight = spawnPosition.y;
    const bloodGroundY = this.environment.getBloodGroundHeight?.(spawnPosition) ?? spawnPosition.y;
    const wallX = this.environment.getBloodWallX ? this.environment.getBloodWallX(spawnPosition) : -2.65;
    this.bloodEffects = new CombatBloodEffects({ scene: this.scene, woundSystem: this.actor.woundSystem, physiology: this.actor.physiology, groundY: bloodGroundY, wallX, eventSink: (event, payload) => this.handleActorEvent(event, payload) });
    this.director = new CombatDirector({ actor: this.actor, bloodEffects: this.bloodEffects, feedbackSystem: this.feedbackSystem });
    this.combatRouter?.register?.(this.actor, this.director);
    this.routingRegistered = true;
    this.playerBlocker = this.actor.updatePlayerCollisionBlocker({ id: this.environment.getBlockerName?.(this.respawnGeneration) ?? `combat-lab-walker-blocker-${this.respawnGeneration}` });
    this.collision?.addBlocker?.(this.playerBlocker);
    this.actor.setEnvironmentContactHints({ groundY: spawnPosition.y, wallX });
    this.lethality = new WalkerVitalStabPolicy();
    this.currentSpeed = 0;
    this.desiredSpeed = 0;
    this.velocity.set(0, 0, 0);
    this.deathCollisionReleased = false;
    this.collapseDirection = 1;
    this.deathInitialSpeed = 0;
    this.deathDurationSeconds = this.config.deathCollapseSeconds;
    this.selectedDeathName = null;
    this.footprintActive = this.isInsideEncounter(playerPosition, 0);
    this.spawnDiagnostics = {
      point: spawnPosition.toArray(),
      groundHeight: spawnPosition.y,
      playerYaw: this.resolvePlayerFacingYaw(player),
      distance: Math.hypot(spawnPosition.x - playerPosition.x, spawnPosition.z - playerPosition.z),
      support: this.environment.ensureRapierGroundSupport?.({ spawnPosition, playerPosition, controller: this }) ?? null,
    };
    this.environment.onWalkerSpawned?.({ actor: this.actor, director: this.director, bloodEffects: this.bloodEffects, blocker: this.playerBlocker, spawnPosition, generation: this.respawnGeneration, controller: this });
    this.setState(WALKER_STATES.spawning);
    this.assertBoundedState();
    return true;
  }

  handleActorEvent(event, payload = {}) {
    if (!this.actor || this.actor.disposed) return;
    const owner = this.environment.getFeedbackOwner?.(this.respawnGeneration) ?? `combat-lab-walker-${this.respawnGeneration}`;
    if (event === 'final_exhale') this.feedbackSystem?.stopOwnerVocal?.(owner);
    if (this.director) this.director.forwardFeedbackEvent(event, { ...payload, owner });
    else this.eventSink?.(event, { ...payload, owner });
  }

  prepareFrame(deltaSeconds, player = this.playerProvider?.()) {
    const dt = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
    if (!this.enabled) return;
    if (!this.actor) {
      if (this.state === WALKER_STATES.respawning) {
        this.stateElapsed += dt;
        if (this.stateElapsed >= (this.respawnGeneration ? this.config.respawnDelaySeconds : 0)) this.spawn(player);
      }
      return;
    }
    this.stateElapsed += dt;
    if (this.state === WALKER_STATES.grounded) {
      this.currentSpeed = 0;
      this.velocity.set(0, 0, 0);
      this.actor.setLivingRootTransform?.(this.position, this.currentYaw, this.velocity);
      return;
    }
    if (this.state === WALKER_STATES.losingConsciousness) {
      const deathProgress = clamp01(this.stateElapsed / Math.max(0.001, this.deathDurationSeconds));
      const momentumWeight = 1 - smoothstep01(deathProgress / 0.34);
      const targetSpeed = this.deathInitialSpeed * momentumWeight;
      this.currentSpeed = moveToward(this.currentSpeed, targetSpeed, this.config.deceleration * 0.58 * dt);
      this.desiredSpeed = 0;
      this.forward.set(Math.sin(this.currentYaw), 0, Math.cos(this.currentYaw));
      this.nextPosition.copy(this.position).addScaledVector(this.forward, this.currentSpeed * dt);
      const ground = this.sampleGround(this.nextPosition);
      if (ground && this.isInsideEncounter(this.nextPosition) && Math.abs(ground.y - this.position.y) <= this.config.maximumGroundStep && this.getBlockingEntries(this.nextPosition, 0.34).length === 0) {
        this.nextPosition.y = ground.y;
        this.position.copy(this.nextPosition);
      } else {
        this.currentSpeed = moveToward(this.currentSpeed, 0, this.config.deceleration * dt);
      }
      this.velocity.copy(this.forward).multiplyScalar(this.currentSpeed);
      this.actor.setLivingRootTransform?.(this.position, this.currentYaw, this.velocity);
      const authoredDeathComplete = this.actor.visualAdapter?.animationController?.state === 'DEAD';
      if (authoredDeathComplete || this.stateElapsed >= this.deathDurationSeconds + 0.15) this.holdGroundedPose();
      this.assertBoundedState();
      return;
    }
    const playerPosition = this.resolvePlayerPosition(player);
    if (!playerPosition) return;
    this.updateLivingState(dt, playerPosition);
    this.assertBoundedState();
  }

  updateLivingState(dt, playerPosition) {
    this.footprintActive = this.isInsideEncounter(playerPosition, 0);
    this.toPlayer.set(playerPosition.x - this.position.x, 0, playerPosition.z - this.position.z);
    this.distanceToPlayer = this.toPlayer.length();
    if (this.distanceToPlayer > 1e-5) this.desiredYaw = Math.atan2(this.toPlayer.x, this.toPlayer.z);
    const reacting = this.actor?.reflex?.time > 0.04;
    if (reacting && this.state !== WALKER_STATES.hitReacting && this.state !== WALKER_STATES.spawning) {
      this.reactionResumeState = this.distanceToPlayer <= this.config.stopEnterDistance ? WALKER_STATES.blendingToIdle : WALKER_STATES.approaching;
      this.setState(WALKER_STATES.hitReacting);
    } else if (this.state === WALKER_STATES.hitReacting && !reacting && this.stateElapsed >= 0.2) {
      this.setState(this.distanceToPlayer <= this.config.stopEnterDistance ? WALKER_STATES.blendingToIdle : this.distanceToPlayer > this.config.resumeDistance ? WALKER_STATES.approaching : WALKER_STATES.nearPlayer);
    }
    if (this.state === WALKER_STATES.spawning && this.stateElapsed >= 0.45 && (this.actor.animationAuthorityReady || !this.actor.visualAdapter)) this.setState(WALKER_STATES.blendingToWalk);
    if (!this.footprintActive && [WALKER_STATES.blendingToWalk, WALKER_STATES.approaching, WALKER_STATES.hitReacting].includes(this.state)) this.setState(WALKER_STATES.blendingToIdle);
    if (this.state === WALKER_STATES.blendingToWalk && this.distanceToPlayer <= this.config.stopEnterDistance) this.setState(WALKER_STATES.blendingToIdle);
    else if (this.state === WALKER_STATES.blendingToWalk && this.stateElapsed >= this.config.idleToWalkSeconds) this.setState(WALKER_STATES.approaching);
    if (this.state === WALKER_STATES.approaching && this.distanceToPlayer <= this.config.stopEnterDistance) this.setState(WALKER_STATES.blendingToIdle);
    if (this.footprintActive && this.state === WALKER_STATES.blendingToIdle && this.distanceToPlayer > this.config.resumeDistance) this.setState(WALKER_STATES.blendingToWalk);
    if (this.footprintActive && this.state === WALKER_STATES.nearPlayer && this.distanceToPlayer > this.config.resumeDistance) this.setState(WALKER_STATES.blendingToWalk);

    this.maximumSpeed = this.baseMaximumSpeed * (this.lethality.criticalStabCount >= 1 ? this.config.firstStabSpeedMultiplier : 1);
    const canApproach = this.footprintActive && [WALKER_STATES.blendingToWalk, WALKER_STATES.approaching, WALKER_STATES.hitReacting].includes(this.state) && !this.pauseLocomotion;
    const distanceBlend = smoothstep01((this.distanceToPlayer - this.config.stopTargetDistance) / (this.config.slowDistance - this.config.stopTargetDistance));
    this.desiredSpeed = canApproach ? this.maximumSpeed * distanceBlend * (this.state === WALKER_STATES.hitReacting ? 0.62 : 1) : 0;
    const turnError = Math.abs(angleDelta(this.currentYaw, this.desiredYaw));
    if (turnError > THREE.MathUtils.degToRad(55)) this.desiredSpeed *= THREE.MathUtils.lerp(0.28, 1, clamp01((Math.PI - turnError) / (Math.PI - THREE.MathUtils.degToRad(55))));
    const rate = this.desiredSpeed > this.currentSpeed ? this.config.acceleration : this.config.deceleration;
    this.currentSpeed = moveToward(this.currentSpeed, this.desiredSpeed, rate * dt);
    this.currentYaw = moveAngleToward(this.currentYaw, this.desiredYaw, this.config.turnRateRadians * dt);
    this.forward.set(Math.sin(this.currentYaw), 0, Math.cos(this.currentYaw));
    this.nextPosition.copy(this.position).addScaledVector(this.forward, this.currentSpeed * dt);
    const nextGround = this.sampleGround(this.nextPosition);
    if (this.currentSpeed > 0 && nextGround && this.isInsideEncounter(this.nextPosition) && Math.abs(nextGround.y - this.position.y) <= this.config.maximumGroundStep && this.getBlockingEntries(this.nextPosition, 0.34).length === 0) {
      this.nextPosition.y = nextGround.y;
      this.position.copy(this.nextPosition);
      this.actor.setEnvironmentContactHints({ groundY: nextGround.y });
    }
    else if (this.currentSpeed > 0) {
      this.desiredSpeed = 0;
      this.currentSpeed = moveToward(this.currentSpeed, 0, this.config.deceleration * dt);
    }
    this.velocity.copy(this.forward).multiplyScalar(this.currentSpeed);
    const walking = canApproach && (this.desiredSpeed > 0.025 || this.currentSpeed > 0.045);
    this.actor.visualAdapter?.setMovementState?.({ speed: this.currentSpeed, maximumSpeed: this.maximumSpeed, walking });
    if (this.state === WALKER_STATES.blendingToIdle && this.currentSpeed <= 0.025) this.setState(WALKER_STATES.nearPlayer);
    this.actor.setLivingRootTransform?.(this.position, this.currentYaw, this.velocity);
  }

  beforePhysics(dt, playerPosition = null) {
    if (!this.actor) return;
    if (this.state === WALKER_STATES.grounded) return;
    this.director?.update?.(dt);
    this.evaluateQualifyingWounds();
    this.actor.beforePhysics(dt, playerPosition);
  }

  afterPhysicsStep(dt) {
    this.bloodEffects?.update?.(dt);
  }

  afterPhysics(alpha = 1) {
    if (!this.actor) return;
    this.actor.afterPhysics(alpha);
    if (this.playerBlocker && !this.deathCollisionReleased) this.actor.updatePlayerCollisionBlocker(this.playerBlocker);
  }

  evaluateQualifyingWounds() {
    if (!this.actor || !LIVING_MOVEMENT_STATES.has(this.state) || this.actor.ragdollActive) return [];
    const newlyQualified = this.lethality.evaluate(this.actor.woundSystem?.wounds ?? []);
    if (newlyQualified.length) this.handleQualifyingStabChange();
    return newlyQualified;
  }

  handleQualifyingStabChange() {
    if (this.lethality.criticalStabCount === 1) {
      this.maximumSpeed = this.baseMaximumSpeed * this.config.firstStabSpeedMultiplier;
      this.actor.balanceImpairment = Math.max(this.actor.balanceImpairment, 0.18);
      return;
    }
    if (this.lethality.criticalStabCount >= 2 && LIVING_MOVEMENT_STATES.has(this.state)) {
      this.desiredSpeed = 0;
      this.deathInitialSpeed = this.currentSpeed;
      const region = this.lethality.lastQualifyingRegion ?? '';
      const impactX = this.actor?.lastReaction?.direction?.x;
      this.collapseDirection = region.startsWith('left_') ? -1 : region.startsWith('right_') ? 1 : Number.isFinite(impactX) && Math.abs(impactX) > 0.05 ? Math.sign(impactX) : this.respawnGeneration % 2 ? -1 : 1;
      const death = this.actor.visualAdapter?.playDeathAnimation?.({ regionId: region, variation: this.respawnGeneration });
      this.deathDurationSeconds = death?.durationSeconds ?? this.config.deathCollapseSeconds;
      this.selectedDeathName = death?.name ?? null;
      this.setState(WALKER_STATES.losingConsciousness);
      this.releaseDeathCollisionOwnership();
    }
  }

  forceQualifyingStab() {
    const wound = this.lethality.forceQualifyingStab();
    if (wound) this.handleQualifyingStabChange();
    return wound;
  }

  holdGroundedPose() {
    if (!this.actor || this.state !== WALKER_STATES.losingConsciousness) return false;
    this.currentSpeed = 0;
    this.desiredSpeed = 0;
    this.velocity.set(0, 0, 0);
    this.setState(WALKER_STATES.grounded);
    this.releaseDeathCollisionOwnership();
    return true;
  }

  shouldHoldFinalPose() {
    return this.state === WALKER_STATES.grounded;
  }

  releaseDeathCollisionOwnership() {
    if (!this.actor || this.deathCollisionReleased) return;
    this.deathCollisionReleased = true;
    this.beforeActorDisposal?.(this.actor, 'walker-death-collision-release');
    if (this.routingRegistered) this.combatRouter?.unregister?.(this.actor);
    this.routingRegistered = false;
    this.actor.colliders?.forEach?.((collider) => collider.setEnabled?.(false));
    if (this.playerBlocker) this.collision?.removeBlocker?.(this.playerBlocker);
  }

  disposeWalker({ respawn = true } = {}) {
    const actor = this.actor;
    if (!actor) return false;
    this.beforeActorDisposal?.(actor, 'walker-dispose');
    if (this.routingRegistered) this.combatRouter?.unregister?.(actor);
    this.routingRegistered = false;
    if (this.playerBlocker) this.collision?.removeBlocker?.(this.playerBlocker);
    const before = {
      actorInstanceId: actor.instanceId,
      rigidBodies: actor.bodies.size,
      colliders: actor.colliders.size,
      joints: actor.joints.length,
      characterMaterials: actor.visualAdapter?.materialCloneCount ?? 0,
      woundMaterials: actor.woundSystem?.materialCloneCount ?? 0,
      wounds: actor.woundSystem?.wounds?.length ?? 0,
      subscriptions: this.director?.getDiagnostics?.().subscriberCount ?? 0,
      sceneNodes: actor.root?.children?.length ?? 0,
    };
    this.director?.dispose?.();
    this.bloodEffects?.dispose?.();
    actor.dispose();
    this.lastDisposalSummary = { ...before, remainingRigidBodies: actor.bodies.size, remainingColliders: actor.colliders.size, remainingJoints: actor.joints.length, routingEntries: this.combatRouter?.getDiagnostics?.().actorCount ?? 0 };
    this.actor = null;
    this.director = null;
    this.bloodEffects = null;
    this.playerBlocker = null;
    this.environment.onWalkerDisposed?.({ actor, generation: this.respawnGeneration, summary: this.lastDisposalSummary });
    this.setState(WALKER_STATES.disposed);
    if (respawn && this.enabled) this.setState(WALKER_STATES.respawning);
    return true;
  }

  forceRespawn() {
    if (this.actor) this.disposeWalker({ respawn: true });
    else if (this.enabled && this.state === WALKER_STATES.disposed) this.setState(WALKER_STATES.respawning);
  }

  reset(player = this.playerProvider?.()) {
    if (this.actor) this.disposeWalker({ respawn: false });
    this.stateElapsed = 0;
    this.lethality = new WalkerVitalStabPolicy();
    if (!this.enabled) return false;
    if (this.state === WALKER_STATES.disposed) this.setState(WALKER_STATES.respawning);
    this.stateElapsed = this.config.respawnDelaySeconds;
    return this.spawn(player);
  }

  toggleLocomotionPaused() {
    this.pauseLocomotion = !this.pauseLocomotion;
    return this.pauseLocomotion;
  }

  assertBoundedState() {
    if (this.actor && this.actor.disposed) throw new Error('Disposed walker remained active.');
    if (![this.position.x, this.position.y, this.position.z, this.currentSpeed, this.currentYaw, this.desiredYaw].every(Number.isFinite)) throw new Error('Walker movement became non-finite.');
    if (this.actor?.ragdollActive && [WALKER_STATES.losingConsciousness, WALKER_STATES.grounded].includes(this.state)) throw new Error('Walker skeletal death entered ragdoll.');
    if (this.lethality.countedWoundIds.size !== this.lethality.criticalStabCount) throw new Error('Walker counted a puncture more than once.');
  }

  getDiagnostics() {
    const lethality = this.lethality.getDiagnostics();
    const animation = this.actor?.visualAdapter?.animationController?.getDiagnostics?.() ?? null;
    const deathProgress = this.state === WALKER_STATES.grounded ? 1 : this.state === WALKER_STATES.losingConsciousness ? clamp01(this.stateElapsed / Math.max(0.001, this.deathDurationSeconds)) : 0;
    return {
      enabled: this.enabled,
      state: this.state,
      worldPosition: this.position.toArray().map((value) => Number(value.toFixed(3))),
      distanceToPlayer: Number.isFinite(this.distanceToPlayer) ? Number(this.distanceToPlayer.toFixed(3)) : null,
      currentSpeed: Number(this.currentSpeed.toFixed(3)),
      desiredSpeed: Number(this.desiredSpeed.toFixed(3)),
      maximumSpeed: Number(this.maximumSpeed.toFixed(3)),
      currentYaw: Number(this.currentYaw.toFixed(3)),
      desiredYaw: Number(this.desiredYaw.toFixed(3)),
      turnError: Number(angleDelta(this.currentYaw, this.desiredYaw).toFixed(3)),
      animation,
      activeAnimation: animation?.activeAnimation ?? null,
      walkLooping: animation?.walkLooping ?? false,
      firstStabImpaired: lethality.criticalStabCount === 1,
      ...lethality,
      deathState: this.state,
      deathAnimation: this.selectedDeathName,
      deathDurationSeconds: this.deathDurationSeconds,
      deathProgress: Number(deathProgress.toFixed(3)),
      deathCollisionReleased: this.deathCollisionReleased,
      finalPoseHeld: this.state === WALKER_STATES.grounded && animation?.finalPoseHeld === true,
      ragdollActive: this.actor?.ragdollActive === true,
      actorInstanceId: this.actor?.instanceId ?? null,
      materialCloneCount: (this.actor?.visualAdapter?.materialCloneCount ?? 0) + (this.actor?.woundSystem?.materialCloneCount ?? 0),
      ownedRigidBodyCount: this.actor?.bodies?.size ?? 0,
      ownedColliderCount: this.actor?.colliders?.size ?? 0,
      ownedJointCount: this.actor?.joints?.length ?? 0,
      activeWoundCount: this.actor?.woundSystem?.getActiveWounds?.().length ?? 0,
      remainingEventSubscriptions: this.director?.getDiagnostics?.().subscriberCount ?? 0,
      respawnGeneration: this.respawnGeneration,
      liveWalkers: this.actor ? 1 : 0,
      paused: this.pauseLocomotion,
      encounterFootprintActive: this.footprintActive,
      spawnPoint: this.spawnDiagnostics?.point ?? null,
      spawnGroundHeight: this.spawnDiagnostics?.groundHeight ?? null,
      ragdollActivationCount: this.actor?.ragdollHandoffDiagnostics?.activationCount ?? 0,
      stateHistory: [...this.stateHistory],
      lastDisposalSummary: this.lastDisposalSummary,
    };
  }

  dispose() {
    this.enabled = false;
    if (this.actor) this.disposeWalker({ respawn: false });
    else if (this.state !== WALKER_STATES.disposed) this.setState(WALKER_STATES.disposed);
  }
}
