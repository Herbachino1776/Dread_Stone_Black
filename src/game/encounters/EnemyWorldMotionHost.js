import * as THREE from 'three';

const MOVEMENT_EPSILON = 1e-8;

function finiteVector(value) {
  return Boolean(value?.isVector3 && value.toArray().every(Number.isFinite));
}

export class EnemyWorldMotionHost {
  constructor({ actor, collision = null, position, yaw = 0, blockerId = null, maximumGroundStep = 0.42 } = {}) {
    if (!actor) throw new Error('EnemyWorldMotionHost requires one runtime actor.');
    if (!finiteVector(position)) throw new Error('EnemyWorldMotionHost requires one finite authored position.');
    this.actor = actor;
    this.collision = collision;
    this.position = position.clone();
    this.yaw = Number.isFinite(yaw) ? yaw : 0;
    this.maximumGroundStep = Math.max(0, Number(maximumGroundStep) || 0.42);
    this.velocity = new THREE.Vector3();
    this.disposed = false;
    this.playerBlocker = this.actor.updatePlayerCollisionBlocker?.({
      id: blockerId ?? `encounter-enemy-blocker-${actor.instanceId ?? 'unknown'}`,
    }) ?? null;
    if (this.playerBlocker) {
      this.playerBlocker.userData.tryPlayerDepenetration = (correction, context) => this.tryPlayerDepenetration(correction, context);
      this.collision?.addBlocker?.(this.playerBlocker);
    }
    this.actor.setEnvironmentContactHints?.({ groundY: this.position.y });
    this.actor.setLivingRootTransform?.(this.position, this.yaw, this.velocity);
    this.updatePlayerBlocker();
  }

  getPosition() {
    return this.position;
  }

  setFacing(yaw) {
    if (!Number.isFinite(yaw) || this.disposed) return false;
    this.yaw = yaw;
    return true;
  }

  setPose(position, yaw = this.yaw, velocity = null) {
    if (this.disposed || !finiteVector(position)) return false;
    this.position.copy(position);
    if (Number.isFinite(yaw)) this.yaw = yaw;
    if (finiteVector(velocity)) this.velocity.copy(velocity);
    else this.velocity.set(0, 0, 0);
    this.actor?.setEnvironmentContactHints?.({ groundY: this.position.y });
    this.actor?.setLivingRootTransform?.(this.position, this.yaw, this.velocity);
    this.updatePlayerBlocker();
    return true;
  }

  setLocomotion(movement) {
    this.actor?.visualAdapter?.setMovementState?.(movement);
  }

  sampleGround(position) {
    const sample = this.collision?.sampleWalkableY?.(position.x, position.z, position.y);
    if (!sample) return { y: position.y, kind: 'authored-position' };
    return Number.isFinite(sample.y) ? sample : null;
  }

  getLocomotionRadius() {
    return Math.max(0.2, Number(this.playerBlocker?.radius) || 0.34);
  }

  getBlockingEntries(position) {
    const entries = this.collision?.getIntersectingBlockers?.(
      { x: position.x, y: position.y + Math.max(0.8, (this.actor?.visualProfile?.targetHeight ?? 1.7) * 0.55), z: position.z },
      this.getLocomotionRadius(),
    ) ?? [];
    return entries.filter((entry) => entry !== this.playerBlocker && entry?.userData?.actor !== this.actor);
  }

  isCandidateValid(candidate) {
    const ground = this.sampleGround(candidate);
    if (!ground || Math.abs(ground.y - this.position.y) > this.maximumGroundStep) return null;
    const grounded = candidate.clone();
    grounded.y = ground.y;
    if (this.collision?.canStandAtFloorPosition?.(grounded, { ignoreActorBlockers: true }) === false) return null;
    if (this.getBlockingEntries(grounded).length > 0) return null;
    return ground;
  }

  preservesPlayerSeparation(candidate, playerPosition, minimumPlayerDistance) {
    if (!finiteVector(playerPosition) || !(minimumPlayerDistance > 0)) return true;
    const currentDistance = Math.hypot(this.position.x - playerPosition.x, this.position.z - playerPosition.z);
    const nextDistance = Math.hypot(candidate.x - playerPosition.x, candidate.z - playerPosition.z);
    return currentDistance < minimumPlayerDistance ? nextDistance >= currentDistance - 1e-5 : nextDistance >= minimumPlayerDistance - 1e-5;
  }

  move(movement, { playerPosition = null, minimumPlayerDistance = 0 } = {}) {
    if (this.disposed) return new THREE.Vector3();
    const requested = finiteVector(movement) ? movement.clone().setY(0) : new THREE.Vector3();
    if (requested.lengthSq() <= MOVEMENT_EPSILON) return new THREE.Vector3();
    const start = this.position.clone();
    const result = this.position.clone();
    const fullCandidate = result.clone().add(requested);
    const fullGround = this.isCandidateValid(fullCandidate);
    let fullAccepted = false;
    if (fullGround && this.preservesPlayerSeparation(fullCandidate, playerPosition, minimumPlayerDistance)) {
      fullCandidate.y = fullGround.y;
      result.copy(fullCandidate);
      fullAccepted = true;
    }
    for (const axis of fullAccepted ? [] : ['x', 'z']) {
      if (Math.abs(requested[axis]) <= MOVEMENT_EPSILON) continue;
      const candidate = result.clone();
      candidate[axis] += requested[axis];
      const ground = this.isCandidateValid(candidate);
      if (!ground || !this.preservesPlayerSeparation(candidate, playerPosition, minimumPlayerDistance)) continue;
      candidate.y = ground.y;
      result.copy(candidate);
    }
    const accepted = result.sub(start);
    if (accepted.dot(requested) <= MOVEMENT_EPSILON) return new THREE.Vector3();
    this.position.copy(start).add(accepted);
    this.actor?.setEnvironmentContactHints?.({ groundY: this.position.y });
    this.actor?.setLivingRootTransform?.(this.position, this.yaw, accepted);
    this.updatePlayerBlocker();
    return accepted;
  }

  tryPlayerDepenetration(correction, context = {}) {
    const requested = new THREE.Vector3(Number(correction?.x) || 0, 0, Number(correction?.z) || 0);
    if (requested.length() > 0.12) requested.setLength(0.12);
    const accepted = this.move(requested, {
      playerPosition: context.playerPosition,
      minimumPlayerDistance: Number(context.minimumPlayerDistance) || 0,
    });
    return { x: accepted.x, z: accepted.z };
  }

  updatePlayerBlocker() {
    if (!this.playerBlocker || this.disposed) return;
    this.actor?.updatePlayerCollisionBlocker?.(this.playerBlocker);
  }

  releaseCollisionOwnership() {
    if (!this.playerBlocker) return false;
    this.collision?.removeBlocker?.(this.playerBlocker);
    this.playerBlocker = null;
    return true;
  }

  getDiagnostics() {
    return {
      position: this.position.toArray(),
      yaw: this.yaw,
      blockerActive: Boolean(this.playerBlocker),
      collisionAvailable: Boolean(this.collision),
      maximumGroundStep: this.maximumGroundStep,
      disposed: this.disposed,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.releaseCollisionOwnership();
    this.actor = null;
    this.collision = null;
    this.disposed = true;
  }
}
