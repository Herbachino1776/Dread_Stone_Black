import RAPIER from '@dimforge/rapier3d-compat';
import { COMBAT_PHYSICS_CONFIG } from './CombatConfig.js';

let rapierInitialization = null;

export async function initializeCombatPhysics() {
  rapierInitialization ??= RAPIER.init({});
  await rapierInitialization;
  return RAPIER;
}

export class CombatPhysicsWorld {
  constructor({ config = COMBAT_PHYSICS_CONFIG } = {}) {
    this.config = config;
    this.world = new RAPIER.World({ x: config.gravity[0], y: config.gravity[1], z: config.gravity[2] });
    this.world.timestep = config.fixedStep;
    this.accumulator = 0;
    this.interpolationAlpha = 0;
    this.paused = false;
    this.timeScale = 1;
    this.stepDurationMs = 0;
    this.lastSubsteps = 0;
    this.resetCount = 0;
    this.resumeDiscardCount = 0;
    this.disposed = false;
    this.contactCount = 0;
    this.sweepCount = 0;
    this.eventQueue = new RAPIER.EventQueue(true);
  }

  createFixedBox({ position, halfExtents, rotation = null, friction = 0.92, restitution = 0.02, userData = null } = {}) {
    const descriptor = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    if (rotation) descriptor.setRotation(rotation);
    const body = this.world.createRigidBody(descriptor);
    body.userData = userData;
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setFriction(friction)
        .setRestitution(restitution)
        .setCollisionGroups(0x0001ffff),
      body,
    );
    collider.userData = userData;
    return { body, collider };
  }

  step(frameDelta, beforeStep = null, afterStep = null) {
    if (this.disposed || this.paused) return 0;
    if (!Number.isFinite(frameDelta) || frameDelta < 0 || frameDelta > 0.5) {
      this.accumulator = 0;
      this.resumeDiscardCount += 1;
      return 0;
    }
    const delta = Math.min(frameDelta, this.config.maxFrameDelta) * this.timeScale;
    this.accumulator = Math.min(this.accumulator + delta, this.config.fixedStep * this.config.maxSubsteps);
    let substeps = 0;
    const started = performance.now();
    while (this.accumulator >= this.config.fixedStep && substeps < this.config.maxSubsteps) {
      beforeStep?.(this.config.fixedStep);
      this.contactCount = 0;
      this.world.step(this.eventQueue);
      this.eventQueue.drainCollisionEvents(() => { this.contactCount += 1; });
      this.clampDynamicBodies();
      afterStep?.(this.config.fixedStep);
      this.accumulator -= this.config.fixedStep;
      substeps += 1;
    }
    this.interpolationAlpha = this.accumulator / this.config.fixedStep;
    this.stepDurationMs = performance.now() - started;
    this.lastSubsteps = substeps;
    return substeps;
  }

  clampDynamicBodies() {
    this.world.bodies.forEach((body) => {
      if (!body.isDynamic()) return;
      const translation = body.translation();
      const rotation = body.rotation();
      if (![translation.x, translation.y, translation.z, rotation.x, rotation.y, rotation.z, rotation.w].every(Number.isFinite)) {
        body.setTranslation({ x: 0, y: 1, z: -3.5 }, false);
        body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, false);
        body.setLinvel({ x: 0, y: 0, z: 0 }, false);
        body.setAngvel({ x: 0, y: 0, z: 0 }, false);
        return;
      }
      const linear = body.linvel();
      const angular = body.angvel();
      const linearLength = Math.hypot(linear.x, linear.y, linear.z);
      const angularLength = Math.hypot(angular.x, angular.y, angular.z);
      if (linearLength > this.config.maxLinearSpeed) body.setLinvel({ x: linear.x / linearLength * this.config.maxLinearSpeed, y: linear.y / linearLength * this.config.maxLinearSpeed, z: linear.z / linearLength * this.config.maxLinearSpeed }, true);
      if (angularLength > this.config.maxAngularSpeed) body.setAngvel({ x: angular.x / angularLength * this.config.maxAngularSpeed, y: angular.y / angularLength * this.config.maxAngularSpeed, z: angular.z / angularLength * this.config.maxAngularSpeed }, true);
    });
  }

  castWeaponTip(previousTip, nextTip, radius, predicate = null) {
    const velocity = { x: nextTip.x - previousTip.x, y: nextTip.y - previousTip.y, z: nextTip.z - previousTip.z };
    const distance = Math.hypot(velocity.x, velocity.y, velocity.z);
    if (distance < 1e-6) return null;
    this.sweepCount += 1;
    this.world.propagateModifiedBodyPositionsToColliders();
    return this.world.castShape(
      previousTip,
      { x: 0, y: 0, z: 0, w: 1 },
      velocity,
      new RAPIER.Ball(radius),
      0,
      1,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      predicate,
    );
  }

  getDiagnostics() {
    return {
      physicsStepMs: this.stepDurationMs,
      substeps: this.lastSubsteps,
      rigidBodies: this.world.bodies.len(),
      colliders: this.world.colliders.len(),
      constraints: this.world.impulseJoints.len(),
      activeContacts: this.contactCount,
      weaponSweeps: this.sweepCount,
      interpolationAlpha: this.interpolationAlpha,
      paused: this.paused,
      timeScale: this.timeScale,
      resumeDiscardCount: this.resumeDiscardCount,
      resetCount: this.resetCount,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.eventQueue.free();
    this.world.free();
  }
}

export { RAPIER };
