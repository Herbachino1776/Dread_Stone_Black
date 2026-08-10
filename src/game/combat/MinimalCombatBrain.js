import * as THREE from 'three';

export const MINIMAL_COMBAT_BRAIN_STATES = Object.freeze({
  idle: 'IDLE',
  acquire: 'ACQUIRE',
  approach: 'APPROACH',
  ready: 'READY',
  commitAttack: 'COMMIT_ATTACK',
  attacking: 'ATTACKING',
  recovery: 'RECOVERY',
  reevaluate: 'REEVALUATE',
  returnHome: 'RETURN_HOME',
});

export const MINIMAL_COMBAT_BRAIN_CONFIG = Object.freeze({
  detectionRange: 4.75,
  disengageRange: 6.5,
  homeLeashRadius: 8.5,
  approachSpeed: 0.82,
  returnSpeed: 0.72,
  turnRateRadians: 2.5,
  readyFacingToleranceRadians: THREE.MathUtils.degToRad(11),
  readySeconds: 0.22,
  recoverySeconds: 0.58,
  returnHomeTolerance: 0.14,
  returnYawToleranceRadians: THREE.MathUtils.degToRad(5),
  minimumPlayerSeparation: 0.82,
  attackRangeBodyHeightFactor: 0.33,
  attackRangePadding: 0.08,
  minimumAttackRange: 1.15,
  maximumAttackRange: 2.1,
  attackExitPadding: 0.24,
});

function finiteVector(value) {
  return Boolean(value?.isVector3 && value.toArray().every(Number.isFinite));
}

function horizontalDistance(first, second) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function angleDelta(from, to) {
  return normalizeAngle(to - from);
}

function moveAngleToward(current, target, maximumDelta) {
  const delta = angleDelta(current, target);
  return normalizeAngle(current + THREE.MathUtils.clamp(delta, -maximumDelta, maximumDelta));
}

function copyCalibration(weapon) {
  if (!weapon) return null;
  return {
    assetScale: weapon.assetScale,
    gripTransform: structuredClone(weapon.gripTransform),
    attackCapsule: structuredClone(weapon.attackCapsule),
  };
}

export function resolveCombatBrainAttackRange({ weapon = null, bodyHeight = 1.7, config = MINIMAL_COMBAT_BRAIN_CONFIG } = {}) {
  const scale = Math.max(0.01, Number(weapon?.assetScale) || 1);
  const start = Array.isArray(weapon?.attackCapsule?.start) ? new THREE.Vector3().fromArray(weapon.attackCapsule.start) : new THREE.Vector3();
  const end = Array.isArray(weapon?.attackCapsule?.end) ? new THREE.Vector3().fromArray(weapon.attackCapsule.end) : new THREE.Vector3();
  const radius = Math.max(0, Number(weapon?.attackCapsule?.radius) || 0) * scale;
  const weaponReach = Math.max(start.length(), end.length()) * scale + radius;
  const bodyReach = Math.max(0.5, Number(bodyHeight) || 1.7) * config.attackRangeBodyHeightFactor;
  return THREE.MathUtils.clamp(
    bodyReach + weaponReach + config.attackRangePadding,
    config.minimumAttackRange,
    config.maximumAttackRange,
  );
}

export class MinimalCombatBrain {
  constructor({
    actor,
    armamentRuntime,
    playerProvider,
    playerCombatState,
    homePosition,
    homeYaw = 0,
    approvedActionId,
    resolvedWeapon = null,
    bodyHeight = 1.7,
    motionHost = null,
    config = {},
  } = {}) {
    if (!actor || !armamentRuntime) throw new Error('MinimalCombatBrain requires one creature actor and NpcArmamentRuntime.');
    if (!finiteVector(homePosition)) throw new Error('MinimalCombatBrain requires one finite host-owned home position.');
    if (typeof approvedActionId !== 'string' || !approvedActionId) throw new Error('MinimalCombatBrain requires one approved offensive Action ID.');
    this.actor = actor;
    this.armamentRuntime = armamentRuntime;
    this.playerProvider = playerProvider;
    this.playerCombatState = playerCombatState;
    this.homePosition = homePosition.clone();
    this.homeYaw = Number.isFinite(homeYaw) ? homeYaw : 0;
    this.approvedActionId = approvedActionId;
    this.resolvedWeapon = resolvedWeapon;
    this.bodyHeight = Math.max(0.5, Number(bodyHeight) || 1.7);
    this.motionHost = motionHost;
    this.config = Object.freeze({ ...MINIMAL_COMBAT_BRAIN_CONFIG, ...config });
    this.attackRange = resolveCombatBrainAttackRange({ weapon: resolvedWeapon, bodyHeight: this.bodyHeight, config: this.config });
    this.state = MINIMAL_COMBAT_BRAIN_STATES.idle;
    this.stateElapsed = 0;
    this.currentYaw = Number.isFinite(actor.visualRootYaw) ? actor.visualRootYaw : this.homeYaw;
    this.enabled = false;
    this.disposed = false;
    this.targetAcquired = false;
    this.targetDistance = null;
    this.homeDistance = 0;
    this.committedYaw = null;
    this.orientationLocked = false;
    this.pendingReturnHome = false;
    this.lastTransitionReason = 'constructed';
    this.lastEnableResult = null;
    this.lastTriggerResult = null;
    this.triggerRequestCount = 0;
  }

  async enable() {
    if (this.disposed) return { accepted: false, reason: 'combat-brain-disposed' };
    if (!this.isActorUsable()) return { accepted: false, reason: 'living-creature-subject-unavailable' };
    if (this.resolvedWeapon) {
      const calibrated = this.armamentRuntime.setCalibrationOverride(copyCalibration(this.resolvedWeapon));
      if (calibrated.accepted === false) return (this.lastEnableResult = calibrated);
    }
    const equipped = await this.armamentRuntime.equip();
    if (equipped.accepted === false) return (this.lastEnableResult = equipped);
    const selected = this.armamentRuntime.selectOffensiveAction(this.approvedActionId);
    if (selected.accepted === false) return (this.lastEnableResult = selected);
    this.enabled = true;
    this.targetAcquired = false;
    this.pendingReturnHome = false;
    this.committedYaw = null;
    this.orientationLocked = false;
    this.transition(MINIMAL_COMBAT_BRAIN_STATES.idle, 'enabled');
    this.stopLocomotion();
    this.lastEnableResult = { accepted: true, weaponId: equipped.weaponId, combatActionId: selected.combatActionId };
    return this.lastEnableResult;
  }

  disable(reason = 'disabled') {
    if (this.disposed) return { accepted: false, reason: 'combat-brain-disposed' };
    this.enabled = false;
    this.targetAcquired = false;
    this.pendingReturnHome = false;
    this.committedYaw = null;
    this.orientationLocked = false;
    this.transition(MINIMAL_COMBAT_BRAIN_STATES.idle, reason);
    if (this.isActorUsable()) this.stopLocomotion();
    return { accepted: true, reason };
  }

  resetForDev(reason = 'dev-reset') {
    if (this.disposed) return { accepted: false, reason: 'combat-brain-disposed' };
    this.armamentRuntime.resetCombatState?.();
    this.targetAcquired = false;
    this.pendingReturnHome = false;
    this.committedYaw = null;
    this.orientationLocked = false;
    this.transition(MINIMAL_COMBAT_BRAIN_STATES.idle, reason);
    this.stopLocomotion();
    return { accepted: true, enabled: this.enabled, reason };
  }

  transition(state, reason) {
    if (this.state !== state) this.stateElapsed = 0;
    this.state = state;
    this.lastTransitionReason = reason;
    return state;
  }

  isActorUsable() {
    return Boolean(this.actor && !this.actor.disposed && this.actor.lifeState === 'alive');
  }

  getActorPosition() {
    const hosted = this.motionHost?.getPosition?.();
    if (finiteVector(hosted)) return hosted.clone();
    return finiteVector(this.actor?.visualRootPosition) ? this.actor.visualRootPosition.clone() : null;
  }

  getValidTargetPosition() {
    if (this.playerCombatState?.isAlive !== true) return null;
    const position = this.playerProvider?.()?.position;
    return finiteVector(position) ? position.clone() : null;
  }

  getDesiredYaw(from, to) {
    return Math.atan2(to.x - from.x, to.z - from.z);
  }

  faceToward(position, target, deltaSeconds) {
    const desiredYaw = this.getDesiredYaw(position, target);
    this.currentYaw = moveAngleToward(this.currentYaw, desiredYaw, this.config.turnRateRadians * deltaSeconds);
    return Math.abs(angleDelta(this.currentYaw, desiredYaw));
  }

  setMotion({ position, yaw = this.currentYaw, velocity = null, walking = false, speed = 0 } = {}) {
    this.currentYaw = Number.isFinite(yaw) ? yaw : this.currentYaw;
    this.motionHost?.setFacing?.(this.currentYaw);
    const acceptedPosition = finiteVector(position) ? position : this.getActorPosition();
    this.motionHost?.setPose?.(acceptedPosition, this.currentYaw, velocity);
    if (!this.motionHost?.setPose) this.actor.setLivingRootTransform?.(acceptedPosition, this.currentYaw, velocity);
    this.motionHost?.setLocomotion?.({ speed, maximumSpeed: Math.max(speed, this.config.approachSpeed), walking });
    if (!this.motionHost?.setLocomotion) this.actor.visualAdapter?.setMovementState?.({ speed, maximumSpeed: Math.max(speed, this.config.approachSpeed), walking });
  }

  stopLocomotion() {
    const position = this.getActorPosition();
    if (position) this.setMotion({ position, yaw: this.currentYaw, velocity: new THREE.Vector3(), walking: false, speed: 0 });
  }

  moveToward(target, speed, deltaSeconds, playerPosition = null) {
    const position = this.getActorPosition();
    if (!position) return false;
    this.faceToward(position, target, deltaSeconds);
    this.motionHost?.setFacing?.(this.currentYaw);
    const direction = target.clone().sub(position).setY(0);
    if (direction.lengthSq() <= 1e-8) {
      this.stopLocomotion();
      return false;
    }
    const requested = direction.normalize().multiplyScalar(Math.max(0, speed) * deltaSeconds);
    let accepted = requested;
    if (this.motionHost?.move) {
      accepted = this.motionHost.move(requested, {
        playerPosition,
        minimumPlayerDistance: playerPosition ? this.config.minimumPlayerSeparation : 0,
      });
      if (!finiteVector(accepted)) accepted = new THREE.Vector3();
    } else {
      const next = position.clone().add(requested);
      if (playerPosition && horizontalDistance(next, playerPosition) < this.config.minimumPlayerSeparation) {
        requested.setLength(Math.max(0, horizontalDistance(position, playerPosition) - this.config.minimumPlayerSeparation));
      }
      accepted = requested;
    }
    const finalPosition = this.motionHost?.move ? this.getActorPosition() : position.clone().add(accepted);
    const actualSpeed = accepted.length() / Math.max(1e-5, deltaSeconds);
    this.setMotion({ position: finalPosition, yaw: this.currentYaw, velocity: accepted.clone().multiplyScalar(1 / Math.max(1e-5, deltaSeconds)), walking: actualSpeed > 0.025, speed: actualSpeed });
    return accepted.lengthSq() > 1e-8;
  }

  targetWithinLeash(targetPosition) {
    return horizontalDistance(targetPosition, this.homePosition) <= this.config.homeLeashRadius;
  }

  settleAfterAggression(reason) {
    const position = this.getActorPosition();
    this.targetAcquired = false;
    if (position && horizontalDistance(position, this.homePosition) > this.config.returnHomeTolerance) {
      this.transition(MINIMAL_COMBAT_BRAIN_STATES.returnHome, reason);
    } else {
      this.transition(MINIMAL_COMBAT_BRAIN_STATES.idle, reason);
      this.stopLocomotion();
    }
  }

  updateAttacking(deltaSeconds, targetPosition) {
    const attack = this.armamentRuntime.activeAttack;
    const action = attack?.action ?? this.armamentRuntime.selectedAction;
    const currentClipTime = action ? this.armamentRuntime.animationController?.getActionClipTime?.(action.actionName) : null;
    const commitment = action?.commitment;
    const shouldLock = commitment?.lockOrientationThroughActive === true
      && Number.isFinite(currentClipTime)
      && currentClipTime >= commitment.timeSeconds;
    if (shouldLock && !this.orientationLocked) {
      this.committedYaw = this.currentYaw;
      this.orientationLocked = true;
    }
    const position = this.getActorPosition();
    if (this.orientationLocked) this.currentYaw = this.committedYaw;
    else if (position && targetPosition && this.targetWithinLeash(targetPosition)) this.faceToward(position, targetPosition, deltaSeconds);
    else {
      this.committedYaw = this.currentYaw;
      this.orientationLocked = true;
    }
    this.stopLocomotion();
    this.armamentRuntime.update(deltaSeconds);
    if (!this.armamentRuntime.activeAttack) {
      this.orientationLocked = false;
      this.committedYaw = null;
      this.transition(MINIMAL_COMBAT_BRAIN_STATES.recovery, 'authored-attack-complete');
    }
  }

  update(deltaSeconds = 0) {
    if (this.disposed || !this.enabled) return this.getDiagnostics();
    const dt = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
    this.stateElapsed += dt;
    if (!this.isActorUsable()) {
      this.enabled = false;
      this.targetAcquired = false;
      this.armamentRuntime.unequip('combat-brain-actor-death-or-disposal');
      this.transition(MINIMAL_COMBAT_BRAIN_STATES.idle, 'actor-death-or-disposal');
      return this.getDiagnostics();
    }

    const position = this.getActorPosition();
    const targetPosition = this.getValidTargetPosition();
    this.homeDistance = position ? horizontalDistance(position, this.homePosition) : null;
    this.targetDistance = position && targetPosition ? horizontalDistance(position, targetPosition) : null;
    const targetUsable = Boolean(targetPosition && this.targetWithinLeash(targetPosition));

    if (this.state === MINIMAL_COMBAT_BRAIN_STATES.attacking) {
      if (!targetUsable) this.pendingReturnHome = true;
      this.updateAttacking(dt, targetUsable ? targetPosition : null);
      return this.getDiagnostics();
    }

    this.armamentRuntime.update(dt);
    if (!targetUsable && ![MINIMAL_COMBAT_BRAIN_STATES.idle, MINIMAL_COMBAT_BRAIN_STATES.returnHome].includes(this.state)) {
      this.pendingReturnHome = true;
      this.settleAfterAggression(targetPosition ? 'target-left-leash' : 'target-invalid');
    }

    switch (this.state) {
      case MINIMAL_COMBAT_BRAIN_STATES.idle:
        this.stopLocomotion();
        if (targetUsable && this.targetDistance <= this.config.detectionRange) this.transition(MINIMAL_COMBAT_BRAIN_STATES.acquire, 'living-target-detected');
        break;
      case MINIMAL_COMBAT_BRAIN_STATES.acquire:
        if (!targetUsable) this.settleAfterAggression('target-invalid-during-acquire');
        else {
          this.targetAcquired = true;
          this.transition(this.targetDistance <= this.attackRange ? MINIMAL_COMBAT_BRAIN_STATES.ready : MINIMAL_COMBAT_BRAIN_STATES.approach, 'target-acquired');
        }
        break;
      case MINIMAL_COMBAT_BRAIN_STATES.approach:
        if (this.targetDistance > this.config.disengageRange || this.homeDistance >= this.config.homeLeashRadius) this.settleAfterAggression('engagement-bound-exceeded');
        else if (this.targetDistance <= this.attackRange) {
          this.stopLocomotion();
          this.transition(MINIMAL_COMBAT_BRAIN_STATES.ready, 'weapon-range-reached');
        } else this.moveToward(targetPosition, this.config.approachSpeed, dt, targetPosition);
        break;
      case MINIMAL_COMBAT_BRAIN_STATES.ready: {
        this.stopLocomotion();
        const facingError = this.faceToward(position, targetPosition, dt);
        this.setMotion({ position, yaw: this.currentYaw, velocity: new THREE.Vector3(), walking: false, speed: 0 });
        if (this.targetDistance > this.attackRange + this.config.attackExitPadding) this.transition(MINIMAL_COMBAT_BRAIN_STATES.approach, 'target-left-weapon-range');
        else if (facingError <= this.config.readyFacingToleranceRadians && this.stateElapsed >= this.config.readySeconds) this.transition(MINIMAL_COMBAT_BRAIN_STATES.commitAttack, 'ready-to-commit');
        break;
      }
      case MINIMAL_COMBAT_BRAIN_STATES.commitAttack:
        this.stopLocomotion();
        if (!targetUsable) this.settleAfterAggression('target-invalid-before-trigger');
        else if (this.armamentRuntime.activeAttack) this.transition(MINIMAL_COMBAT_BRAIN_STATES.attacking, 'armament-already-active');
        else {
          this.triggerRequestCount += 1;
          this.lastTriggerResult = this.armamentRuntime.triggerAttack();
          if (this.lastTriggerResult.accepted) this.transition(MINIMAL_COMBAT_BRAIN_STATES.attacking, 'armament-trigger-accepted');
          else this.transition(MINIMAL_COMBAT_BRAIN_STATES.recovery, `armament-trigger-rejected:${this.lastTriggerResult.reason}`);
        }
        break;
      case MINIMAL_COMBAT_BRAIN_STATES.recovery:
        this.stopLocomotion();
        if (this.stateElapsed >= this.config.recoverySeconds) this.transition(MINIMAL_COMBAT_BRAIN_STATES.reevaluate, 'recovery-complete');
        break;
      case MINIMAL_COMBAT_BRAIN_STATES.reevaluate:
        this.pendingReturnHome = false;
        if (!targetUsable) this.settleAfterAggression('reevaluate-target-invalid');
        else if (this.targetDistance <= this.attackRange + this.config.attackExitPadding) this.transition(MINIMAL_COMBAT_BRAIN_STATES.ready, 'reevaluate-in-range');
        else this.transition(MINIMAL_COMBAT_BRAIN_STATES.approach, 'reevaluate-approach');
        break;
      case MINIMAL_COMBAT_BRAIN_STATES.returnHome: {
        this.targetAcquired = false;
        const homeDistance = horizontalDistance(position, this.homePosition);
        if (homeDistance > this.config.returnHomeTolerance) this.moveToward(this.homePosition, this.config.returnSpeed, dt);
        else {
          this.currentYaw = moveAngleToward(this.currentYaw, this.homeYaw, this.config.turnRateRadians * dt);
          this.setMotion({ position: this.homePosition, yaw: this.currentYaw, velocity: new THREE.Vector3(), walking: false, speed: 0 });
          if (Math.abs(angleDelta(this.currentYaw, this.homeYaw)) <= this.config.returnYawToleranceRadians) this.transition(MINIMAL_COMBAT_BRAIN_STATES.idle, 'home-settled');
        }
        break;
      }
      default:
        this.transition(MINIMAL_COMBAT_BRAIN_STATES.idle, 'unknown-state-recovered');
    }
    return this.getDiagnostics();
  }

  getDiagnostics() {
    const armament = this.armamentRuntime?.getDiagnostics?.() ?? {};
    return {
      enabled: this.enabled,
      state: this.state,
      targetAcquired: this.targetAcquired,
      targetDistance: Number.isFinite(this.targetDistance) ? Number(this.targetDistance.toFixed(3)) : null,
      homeDistance: Number.isFinite(this.homeDistance) ? Number(this.homeDistance.toFixed(3)) : null,
      attackRange: Number(this.attackRange.toFixed(3)),
      homePosition: this.homePosition.toArray(),
      homeYaw: this.homeYaw,
      currentYaw: this.currentYaw,
      committedYaw: this.committedYaw,
      orientationLocked: this.orientationLocked,
      pendingReturnHome: this.pendingReturnHome,
      equippedWeapon: armament.weaponId ?? null,
      selectedAction: armament.combatActionId ?? null,
      attackPhase: armament.attackPhase ?? 'COMPLETE',
      attackOutcome: armament.outcome ?? 'idle',
      triggerRequestCount: this.triggerRequestCount,
      lastTriggerResult: this.lastTriggerResult,
      lastTransitionReason: this.lastTransitionReason,
      disposed: this.disposed,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disable('combat-brain-disposed');
    this.armamentRuntime?.unequip?.('combat-brain-disposed');
    this.disposed = true;
    this.actor = null;
    this.motionHost = null;
    this.playerProvider = null;
    this.playerCombatState = null;
  }
}
