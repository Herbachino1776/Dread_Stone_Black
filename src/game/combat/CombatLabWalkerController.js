import * as THREE from 'three';
import { CombatBloodEffects } from './CombatBloodEffects.js';
import { CombatDirector } from './CombatDirector.js';
import { HumanoidCombatActor } from './HumanoidCombatActor.js';
import { MODEL_IDLE_COMBAT_PROFILE } from './HumanoidModelProfiles.js';

export const WALKER_STATES = Object.freeze({
  spawning: 'SPAWNING',
  blendingToWalk: 'BLENDING_TO_WALK',
  approaching: 'APPROACHING',
  blendingToIdle: 'BLENDING_TO_IDLE',
  nearPlayer: 'NEAR_PLAYER',
  hitReacting: 'HIT_REACTING',
  dying: 'DYING',
  ragdoll: 'RAGDOLL',
  fading: 'FADING',
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
  dyingBlendSeconds: 0.24,
  corpseHoldSeconds: 3,
  fadeSeconds: 1,
  respawnDelaySeconds: 0.32,
  firstStabSpeedMultiplier: 0.78,
  torsoQualifyingDepth: 0.05,
  neckQualifyingDepth: 0.045,
  cadenceMinimum: 0.8,
  cadenceMaximum: 1.12,
  strideMaximum: 0.65,
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
  [WALKER_STATES.dying]: new Set([WALKER_STATES.ragdoll, WALKER_STATES.disposed]),
  [WALKER_STATES.ragdoll]: new Set([WALKER_STATES.fading, WALKER_STATES.disposed]),
  [WALKER_STATES.fading]: new Set([WALKER_STATES.disposed]),
  [WALKER_STATES.disposed]: new Set([WALKER_STATES.respawning]),
});

const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);
const smoothstep01 = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const moveToward = (current, target, maximumDelta) => current < target ? Math.min(target, current + maximumDelta) : Math.max(target, current - maximumDelta);
const wrapPhase = (phase) => ((phase % 1) + 1) % 1;
const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const moveAngleToward = (current, target, maximumDelta) => current + THREE.MathUtils.clamp(angleDelta(current, target), -maximumDelta, maximumDelta);

function phaseDistance(from, to) {
  const direct = to - from;
  return direct - Math.round(direct);
}

function sampleFootCycle(phase, target) {
  const p = wrapPhase(phase);
  if (p < 0.58) {
    const stance = smoothstep01(p / 0.58);
    const heel = smoothstep01((p - 0.39) / 0.19);
    target.foreAft = THREE.MathUtils.lerp(1, -1, stance);
    target.lift = heel * 0.12;
    target.knee = Math.sin(stance * Math.PI) * 0.12;
    target.planted = true;
    return target;
  }
  const swing = smoothstep01((p - 0.58) / 0.42);
  target.foreAft = THREE.MathUtils.lerp(-1, 1, swing);
  target.lift = Math.sin(swing * Math.PI);
  target.knee = Math.sin(swing * Math.PI);
  target.planted = false;
  return target;
}

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

export class ProceduralHumanoidLocomotionLayer {
  constructor({ phaseOffset = 0, config = COMBAT_LAB_WALKER_CONFIG } = {}) {
    this.config = config;
    this.phase = wrapPhase(phaseOffset);
    this.blendWeight = 0;
    this.cadence = 0;
    this.strideLength = 0;
    this.stanceLeg = 'both';
    this.impaired = false;
    this.reacting = false;
    this.dying = false;
    this.boneEntries = new Map();
    this.leftFoot = { foreAft: 0, lift: 0, knee: 0, planted: true };
    this.rightFoot = { foreAft: 0, lift: 0, knee: 0, planted: true };
    this.tmpEuler = new THREE.Euler(0, 0, 0, 'XYZ');
    this.tmpQuaternion = new THREE.Quaternion();
  }

  bindBones(bones) {
    this.boneEntries.clear();
    bones?.forEach?.((bone, id) => this.boneEntries.set(id, {
      bone,
      authoredPosition: bone.position.clone(),
      authoredQuaternion: bone.quaternion.clone(),
      authoredScale: bone.scale.clone(),
    }));
  }

  restoreAuthoredPose() {
    this.boneEntries.forEach((entry) => {
      entry.bone.position.copy(entry.authoredPosition);
      entry.bone.quaternion.copy(entry.authoredQuaternion);
      entry.bone.scale.copy(entry.authoredScale);
    });
  }

  captureAuthoredPose() {
    this.boneEntries.forEach((entry) => {
      entry.authoredPosition.copy(entry.bone.position);
      entry.authoredQuaternion.copy(entry.bone.quaternion);
      entry.authoredScale.copy(entry.bone.scale);
    });
  }

  advance(dt, { speed = 0, maximumSpeed = this.config.baseWalkingSpeed, walking = false, reacting = false, impaired = false, dying = false } = {}) {
    const safeDt = Math.max(0, Math.min(0.05, Number(dt) || 0));
    const speedRatio = clamp01(speed / Math.max(0.001, maximumSpeed));
    this.reacting = reacting;
    this.impaired = impaired;
    this.dying = dying;
    const targetBlend = walking && !dying ? 1 : 0;
    const duration = targetBlend > this.blendWeight ? this.config.idleToWalkSeconds : dying ? this.config.dyingBlendSeconds : this.config.walkToIdleSeconds;
    this.blendWeight = moveToward(this.blendWeight, targetBlend, safeDt / Math.max(0.001, duration));
    if (speed > 0.035 && this.blendWeight > 0.015 && !dying) {
      this.cadence = THREE.MathUtils.lerp(this.config.cadenceMinimum, this.config.cadenceMaximum, speedRatio);
      this.strideLength = Math.min(this.config.strideMaximum, speed / Math.max(0.001, this.cadence));
      this.phase = wrapPhase(this.phase + this.cadence * safeDt);
    } else {
      this.cadence = 0;
      this.strideLength = moveToward(this.strideLength, 0, safeDt * 0.72);
      if (this.blendWeight > 0.001) {
        const restPhase = Math.abs(phaseDistance(this.phase, 0)) <= Math.abs(phaseDistance(this.phase, 0.5)) ? 0 : 0.5;
        this.phase = wrapPhase(this.phase + THREE.MathUtils.clamp(phaseDistance(this.phase, restPhase), -safeDt * 0.42, safeDt * 0.42));
      }
    }
    if (!Number.isFinite(this.phase) || !Number.isFinite(this.blendWeight)) throw new Error('Walker gait state became non-finite.');
    this.blendWeight = clamp01(this.blendWeight);
  }

  rotate(id, x = 0, y = 0, z = 0) {
    const bone = this.boneEntries.get(id)?.bone;
    if (!bone) return;
    this.tmpQuaternion.setFromEuler(this.tmpEuler.set(x, y, z));
    bone.quaternion.multiply(this.tmpQuaternion).normalize();
  }

  offset(id, x = 0, y = 0, z = 0) {
    const bone = this.boneEntries.get(id)?.bone;
    if (!bone) return;
    bone.position.x += x;
    bone.position.y += y;
    bone.position.z += z;
  }

  applyAfterMixer() {
    this.captureAuthoredPose();
    const active = this.blendWeight * (this.reacting ? 0.72 : 1);
    if (active <= 0.0001) return;
    sampleFootCycle(this.phase, this.leftFoot);
    sampleFootCycle(this.phase + 0.5, this.rightFoot);
    this.stanceLeg = this.leftFoot.planted && !this.rightFoot.planted ? 'left' : this.rightFoot.planted && !this.leftFoot.planted ? 'right' : 'both';
    const speedStride = clamp01(this.strideLength / this.config.strideMaximum);
    const amplitude = active * speedStride;
    const left = this.leftFoot;
    const right = this.rightFoot;
    const weightTransfer = smoothstep01((Math.sin(this.phase * Math.PI * 2) + 1) * 0.5) * 2 - 1;
    const vertical = (1 - Math.abs(Math.sin(this.phase * Math.PI * 2))) * 0.018 * active;
    const lateral = weightTransfer * 0.021 * active;
    const asymmetry = this.impaired ? 0.88 : 1;
    this.offset('pelvis', lateral, vertical, 0);
    this.rotate('pelvis', 0, THREE.MathUtils.degToRad(weightTransfer * 2.4) * active, THREE.MathUtils.degToRad(-weightTransfer * 2.2) * active);
    this.rotate('abdomen', THREE.MathUtils.degToRad(1.8) * active, THREE.MathUtils.degToRad(-weightTransfer * 2.4) * active, THREE.MathUtils.degToRad(weightTransfer * 0.8) * active);
    this.rotate('lower_chest', THREE.MathUtils.degToRad(-0.6) * active, THREE.MathUtils.degToRad(-weightTransfer * 1.5) * active, 0);
    this.rotate('upper_chest', THREE.MathUtils.degToRad(-0.5) * active, THREE.MathUtils.degToRad(-weightTransfer * 1.2) * active, 0);
    const thighMaximum = THREE.MathUtils.degToRad(21) * amplitude;
    const kneeMaximum = THREE.MathUtils.degToRad(34) * amplitude;
    this.rotate('left_thigh', -left.foreAft * thighMaximum * asymmetry, THREE.MathUtils.degToRad(-2.1) * active, THREE.MathUtils.degToRad(0.7) * active);
    this.rotate('right_thigh', -right.foreAft * thighMaximum, THREE.MathUtils.degToRad(2.1) * active, THREE.MathUtils.degToRad(-0.7) * active);
    this.rotate('left_lower_leg', left.knee * kneeMaximum * asymmetry, 0, 0);
    this.rotate('right_lower_leg', right.knee * kneeMaximum, 0, 0);
    this.rotate('left_foot', (left.foreAft * 0.12 - left.lift * 0.32) * amplitude, THREE.MathUtils.degToRad(-1.8) * active, 0);
    this.rotate('right_foot', (right.foreAft * 0.12 - right.lift * 0.32) * amplitude, THREE.MathUtils.degToRad(1.8) * active, 0);
    const armMaximum = THREE.MathUtils.degToRad(15) * amplitude;
    this.rotate('left_upper_arm', right.foreAft * armMaximum * (this.impaired ? 0.78 : 1), 0, THREE.MathUtils.degToRad(-0.7) * active);
    this.rotate('right_upper_arm', left.foreAft * armMaximum, 0, THREE.MathUtils.degToRad(0.7) * active);
    this.rotate('left_forearm', Math.max(0, -right.foreAft) * THREE.MathUtils.degToRad(5) * amplitude, 0, 0);
    this.rotate('right_forearm', Math.max(0, -left.foreAft) * THREE.MathUtils.degToRad(5) * amplitude, 0, 0);
    if (this.impaired) {
      this.rotate('upper_chest', THREE.MathUtils.degToRad(1.2) * active, THREE.MathUtils.degToRad(-1.4) * active, THREE.MathUtils.degToRad(1.1) * active);
      this.rotate('right_upper_arm', THREE.MathUtils.degToRad(-2.2) * active, 0, THREE.MathUtils.degToRad(1.2) * active);
    }
    this.boneEntries.forEach((entry) => entry.bone.scale.copy(entry.authoredScale));
  }

  getDiagnostics() {
    return {
      phase: this.phase,
      oppositePhase: wrapPhase(this.phase + 0.5),
      blendWeight: this.blendWeight,
      cadence: this.cadence,
      strideLength: this.strideLength,
      stanceLeg: this.stanceLeg,
      mappedBoneCount: this.boneEntries.size,
    };
  }
}

export class CombatLabWalkerController {
  constructor({ scene, physics, collision, combatRouter, stationaryActor, feedbackSystem = null, playerProvider = null, eventSink = null, beforeActorDisposal = null, enabled = true, query = null, actorFactory = null, config = COMBAT_LAB_WALKER_CONFIG } = {}) {
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
    this.query = query ?? new URLSearchParams();
    this.enabled = Boolean(enabled);
    this.pauseLocomotion = this.query.get?.('walkerPause') === '1';
    const requestedSpeedValue = this.query.get?.('walkerSpeed');
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
    this.locomotion = new ProceduralHumanoidLocomotionLayer({ config });
    this.lethality = new WalkerVitalStabPolicy();
    this.reactionResumeState = WALKER_STATES.approaching;
    this.ragdollElapsed = 0;
    this.fadeProgress = 0;
    this.fadeOpacity = 1;
    this.collisionDisabledForFade = false;
    this.collapsePending = false;
    this.collapseRequested = false;
    this.ragdollActivationCount = 0;
    this.stateHistory = [this.state];
    this.lastDisposalSummary = null;
    this.stationaryMaterialSnapshot = [];
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

  bindBones(bones) {
    this.locomotion.bindBones(bones);
  }

  restoreAuthoredPose() {
    this.locomotion.restoreAuthoredPose();
  }

  applyAfterMixer() {
    this.locomotion.applyAfterMixer();
  }

  chooseSpawnPosition(playerPosition) {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const angle = 0.58 + (this.respawnGeneration * 3 + attempt) * goldenAngle;
      const radiusT = ((this.respawnGeneration * 5 + attempt * 7) % 11) / 10;
      const radius = THREE.MathUtils.lerp(this.config.spawnRadiusMinimum + 0.15, this.config.spawnRadiusMaximum - 0.15, radiusT);
      this.spawnCandidate.set(playerPosition.x + Math.sin(angle) * radius, 0, playerPosition.z + Math.cos(angle) * radius);
      if (this.isSpawnCandidateValid(this.spawnCandidate, playerPosition)) return this.spawnCandidate.clone();
    }
    return new THREE.Vector3().fromArray(this.config.fallbackPosition);
  }

  isInsideLab(position, margin = 0.45) {
    return position.x >= -7.8 + margin && position.x <= 7.8 - margin && position.z >= -9.8 + margin && position.z <= 5.8 - margin;
  }

  getBlockingEntries(position, radius = 0.4) {
    return (this.collision?.getIntersectingBlockers?.({ x: position.x, y: 1.55, z: position.z }, radius) ?? []).filter((blocker) => blocker !== this.playerBlocker);
  }

  isSpawnCandidateValid(candidate, playerPosition) {
    if (!this.isInsideLab(candidate) || candidate.distanceToSquared(new THREE.Vector3(playerPosition.x, 0, playerPosition.z)) < this.config.spawnRadiusMinimum ** 2) return false;
    if (this.getBlockingEntries(candidate, 0.48).length) return false;
    const stationary = this.stationaryActor?.getBodyWorldPosition?.('pelvis', this.toPlayer);
    if (stationary && Math.hypot(candidate.x - stationary.x, candidate.z - stationary.z) < 1.15) return false;
    for (let step = 1; step <= 8; step += 1) {
      const t = step / 9;
      this.pathProbe.set(THREE.MathUtils.lerp(candidate.x, playerPosition.x, t), 0, THREE.MathUtils.lerp(candidate.z, playerPosition.z, t));
      if (this.getBlockingEntries(this.pathProbe, 0.28).length) return false;
    }
    return true;
  }

  spawn(player = this.playerProvider?.()) {
    if (!this.enabled || this.actor || !player?.position) return false;
    this.respawnGeneration += 1;
    const spawnPosition = this.chooseSpawnPosition(player.position);
    this.toPlayer.set(player.position.x - spawnPosition.x, 0, player.position.z - spawnPosition.z);
    const targetYaw = Math.atan2(this.toPlayer.x, this.toPlayer.z);
    const yawOffset = THREE.MathUtils.degToRad(this.respawnGeneration % 2 ? 10 : -12);
    this.currentYaw = targetYaw + yawOffset;
    this.desiredYaw = targetYaw;
    this.position.copy(spawnPosition);
    const spawnOffset = new THREE.Vector3(spawnPosition.x, spawnPosition.y, spawnPosition.z + 3.55);
    const actorOptions = { physics: this.physics, scene: this.scene, spawnOffset, spawnYaw: this.currentYaw, visualProfile: MODEL_IDLE_COMBAT_PROFILE, automaticMortality: false, isolateVisualMaterials: true, eventSink: (event, payload) => this.handleActorEvent(event, payload) };
    this.actor = this.actorFactory ? this.actorFactory(actorOptions) : new HumanoidCombatActor(actorOptions);
    this.actor.setLivingRootTransform?.(this.position, this.currentYaw);
    this.bloodEffects = new CombatBloodEffects({ scene: this.scene, woundSystem: this.actor.woundSystem, physiology: this.actor.physiology, groundY: 0, wallX: -2.65, eventSink: (event, payload) => this.handleActorEvent(event, payload) });
    this.director = new CombatDirector({ actor: this.actor, bloodEffects: this.bloodEffects, feedbackSystem: this.feedbackSystem });
    this.combatRouter?.register?.(this.actor, this.director);
    this.routingRegistered = true;
    this.playerBlocker = this.actor.updatePlayerCollisionBlocker({ id: `combat-lab-walker-blocker-${this.respawnGeneration}` });
    this.collision?.addBlocker?.(this.playerBlocker);
    this.actor.setEnvironmentContactHints({ groundY: 0, wallX: -2.65 });
    this.lethality = new WalkerVitalStabPolicy();
    this.locomotion = new ProceduralHumanoidLocomotionLayer({ phaseOffset: wrapPhase(this.respawnGeneration * 0.173), config: this.config });
    this.actor.visualAdapter?.setLocomotionController?.(this);
    this.currentSpeed = 0;
    this.desiredSpeed = 0;
    this.velocity.set(0, 0, 0);
    this.ragdollElapsed = 0;
    this.fadeProgress = 0;
    this.fadeOpacity = 1;
    this.collisionDisabledForFade = false;
    this.collapsePending = false;
    this.collapseRequested = false;
    this.ragdollActivationCount = 0;
    this.setState(WALKER_STATES.spawning);
    this.assertBoundedState();
    return true;
  }

  handleActorEvent(event, payload = {}) {
    if (!this.actor || this.actor.disposed) return;
    const owner = `combat-lab-walker-${this.respawnGeneration}`;
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
    if (this.state === WALKER_STATES.ragdoll) {
      this.ragdollElapsed += dt;
      if (this.ragdollElapsed >= this.config.corpseHoldSeconds) this.beginFade();
      return;
    }
    if (this.state === WALKER_STATES.fading) {
      this.fadeProgress = clamp01(this.stateElapsed / this.config.fadeSeconds);
      this.applyFadeOpacity(1 - smoothstep01(this.fadeProgress));
      if (!this.collisionDisabledForFade && this.fadeProgress >= 0.68) this.disableCollisionOwnership();
      if (this.fadeProgress >= 1) this.disposeWalker({ respawn: true });
      return;
    }
    if (this.state === WALKER_STATES.dying) {
      this.currentSpeed = moveToward(this.currentSpeed, 0, this.config.deceleration * 1.4 * dt);
      this.desiredSpeed = 0;
      this.velocity.set(0, 0, 0);
      this.locomotion.advance(dt, { speed: this.currentSpeed, maximumSpeed: this.maximumSpeed, walking: false, impaired: true, dying: true });
      this.actor.setLivingRootTransform?.(this.position, this.currentYaw);
      if (this.stateElapsed >= this.config.dyingBlendSeconds) this.collapsePending = true;
      this.assertBoundedState();
      return;
    }
    if (!player?.position) return;
    this.updateLivingState(dt, player.position);
    this.assertBoundedState();
  }

  updateLivingState(dt, playerPosition) {
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
    if (this.state === WALKER_STATES.blendingToWalk && this.distanceToPlayer <= this.config.stopEnterDistance) this.setState(WALKER_STATES.blendingToIdle);
    else if (this.state === WALKER_STATES.blendingToWalk && this.locomotion.blendWeight >= 0.98) this.setState(WALKER_STATES.approaching);
    if (this.state === WALKER_STATES.approaching && this.distanceToPlayer <= this.config.stopEnterDistance) this.setState(WALKER_STATES.blendingToIdle);
    if (this.state === WALKER_STATES.blendingToIdle && this.distanceToPlayer > this.config.resumeDistance) this.setState(WALKER_STATES.blendingToWalk);
    if (this.state === WALKER_STATES.nearPlayer && this.distanceToPlayer > this.config.resumeDistance) this.setState(WALKER_STATES.blendingToWalk);

    this.maximumSpeed = this.baseMaximumSpeed * (this.lethality.criticalStabCount >= 1 ? this.config.firstStabSpeedMultiplier : 1);
    const canApproach = [WALKER_STATES.blendingToWalk, WALKER_STATES.approaching, WALKER_STATES.hitReacting].includes(this.state) && !this.pauseLocomotion;
    const distanceBlend = smoothstep01((this.distanceToPlayer - this.config.stopTargetDistance) / (this.config.slowDistance - this.config.stopTargetDistance));
    this.desiredSpeed = canApproach ? this.maximumSpeed * distanceBlend * (this.state === WALKER_STATES.hitReacting ? 0.62 : 1) : 0;
    const turnError = Math.abs(angleDelta(this.currentYaw, this.desiredYaw));
    if (turnError > THREE.MathUtils.degToRad(55)) this.desiredSpeed *= THREE.MathUtils.lerp(0.28, 1, clamp01((Math.PI - turnError) / (Math.PI - THREE.MathUtils.degToRad(55))));
    const rate = this.desiredSpeed > this.currentSpeed ? this.config.acceleration : this.config.deceleration;
    this.currentSpeed = moveToward(this.currentSpeed, this.desiredSpeed, rate * dt);
    this.currentYaw = moveAngleToward(this.currentYaw, this.desiredYaw, this.config.turnRateRadians * dt);
    this.forward.set(Math.sin(this.currentYaw), 0, Math.cos(this.currentYaw));
    this.nextPosition.copy(this.position).addScaledVector(this.forward, this.currentSpeed * dt);
    if (this.currentSpeed > 0 && this.isInsideLab(this.nextPosition) && this.getBlockingEntries(this.nextPosition, 0.34).length === 0) this.position.copy(this.nextPosition);
    else if (this.currentSpeed > 0) {
      this.desiredSpeed = 0;
      this.currentSpeed = moveToward(this.currentSpeed, 0, this.config.deceleration * dt);
    }
    this.velocity.copy(this.forward).multiplyScalar(this.currentSpeed);
    const walking = canApproach && (this.desiredSpeed > 0.025 || this.currentSpeed > 0.045);
    this.locomotion.advance(dt, { speed: this.currentSpeed, maximumSpeed: this.maximumSpeed, walking, reacting: this.state === WALKER_STATES.hitReacting, impaired: this.lethality.criticalStabCount >= 1 });
    if (this.state === WALKER_STATES.blendingToIdle && this.currentSpeed <= 0.025 && this.locomotion.blendWeight <= 0.03) this.setState(WALKER_STATES.nearPlayer);
    this.actor.setLivingRootTransform?.(this.position, this.currentYaw, this.velocity);
  }

  afterAnimationFrame() {
    if (!this.actor || this.state !== WALKER_STATES.dying || !this.collapsePending || this.collapseRequested || !this.actor.animationAuthorityReady) return false;
    if (!this.actor.forceRagdoll()) return false;
    this.collapseRequested = true;
    this.ragdollActivationCount += 1;
    this.ragdollElapsed = 0;
    this.setState(WALKER_STATES.ragdoll);
    return true;
  }

  beforePhysics(dt, playerPosition = null) {
    if (!this.actor) return;
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
    if (this.playerBlocker && !this.collisionDisabledForFade) this.actor.updatePlayerCollisionBlocker(this.playerBlocker);
  }

  evaluateQualifyingWounds() {
    if (!this.actor || this.state === WALKER_STATES.dying || this.actor.ragdollActive) return [];
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
      this.setState(WALKER_STATES.dying);
    }
  }

  forceQualifyingStab() {
    const wound = this.lethality.forceQualifyingStab();
    if (wound) this.handleQualifyingStabChange();
    return wound;
  }

  beginFade() {
    if (!this.actor || this.state !== WALKER_STATES.ragdoll) return false;
    this.stationaryMaterialSnapshot = this.stationaryActor?.visualAdapter?.getMaterialOpacitySnapshot?.() ?? [];
    this.actor.visualAdapter?.beginFade?.();
    this.actor.woundSystem?.beginFade?.();
    this.bloodEffects?.beginFade?.();
    this.fadeProgress = 0;
    this.fadeOpacity = 1;
    this.setState(WALKER_STATES.fading);
    return true;
  }

  applyFadeOpacity(opacity) {
    this.fadeOpacity = clamp01(Number.isFinite(opacity) ? opacity : 0);
    this.actor?.visualAdapter?.setOpacity?.(this.fadeOpacity);
    this.actor?.woundSystem?.setOpacity?.(this.fadeOpacity);
    this.bloodEffects?.setOpacity?.(this.fadeOpacity);
    const currentStationary = this.stationaryActor?.visualAdapter?.getMaterialOpacitySnapshot?.() ?? [];
    if (this.stationaryMaterialSnapshot.some((value, index) => Math.abs(value - (currentStationary[index] ?? value)) > 1e-8)) throw new Error('Walker fade changed a stationary-target material.');
  }

  disableCollisionOwnership() {
    if (!this.actor || this.collisionDisabledForFade) return;
    this.collisionDisabledForFade = true;
    this.beforeActorDisposal?.(this.actor, 'walker-fade-collision-disable');
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
    this.locomotion.bindBones(null);
    this.setState(WALKER_STATES.disposed);
    if (respawn && this.enabled) this.setState(WALKER_STATES.respawning);
    return true;
  }

  forceRespawn() {
    if (this.actor) this.disposeWalker({ respawn: true });
    else if (this.enabled && this.state === WALKER_STATES.disposed) this.setState(WALKER_STATES.respawning);
  }

  toggleLocomotionPaused() {
    this.pauseLocomotion = !this.pauseLocomotion;
    return this.pauseLocomotion;
  }

  assertBoundedState() {
    if (this.actor && this.actor.disposed) throw new Error('Disposed walker remained active.');
    if (![this.position.x, this.position.y, this.position.z, this.currentSpeed, this.currentYaw, this.desiredYaw].every(Number.isFinite)) throw new Error('Walker movement became non-finite.');
    if (!Number.isFinite(this.fadeOpacity) || this.fadeOpacity < 0 || this.fadeOpacity > 1) throw new Error('Walker fade opacity escaped its bounds.');
    if (!Number.isFinite(this.locomotion.blendWeight) || this.locomotion.blendWeight < 0 || this.locomotion.blendWeight > 1) throw new Error('Walker locomotion blend escaped its bounds.');
    if (this.ragdollActivationCount > 1) throw new Error('Walker ragdoll activated more than once.');
    if (this.lethality.countedWoundIds.size !== this.lethality.criticalStabCount) throw new Error('Walker counted a puncture more than once.');
  }

  getDiagnostics() {
    const gait = this.locomotion.getDiagnostics();
    const lethality = this.lethality.getDiagnostics();
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
      locomotionBlendWeight: Number(gait.blendWeight.toFixed(3)),
      gaitPhase: Number(gait.phase.toFixed(3)),
      oppositeGaitPhase: Number(gait.oppositePhase.toFixed(3)),
      cadence: Number(gait.cadence.toFixed(3)),
      strideLength: Number(gait.strideLength.toFixed(3)),
      stanceLeg: gait.stanceLeg,
      firstStabImpaired: lethality.criticalStabCount === 1,
      ...lethality,
      ragdollActive: this.actor?.ragdollActive === true,
      ragdollElapsed: Number(this.ragdollElapsed.toFixed(3)),
      fadeProgress: Number(this.fadeProgress.toFixed(3)),
      fadeOpacity: Number(this.fadeOpacity.toFixed(3)),
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
