import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ACTOR_SEPARATION_CONFIG,
  buildPlayerDepenetrationCorrection,
  constrainPlayerMovementAgainstActors,
  resolveEnemyCloseRangeMotion,
  resolveHorizontalActorContact,
} from '../src/game/ActorSeparation.js';
import { CollisionWorld } from '../src/game/Collision.js';

function actorCircle(id, x, z, radius = 0.3, options = {}) {
  return {
    id,
    type: 'combatActor',
    blockerShape: 'circle',
    center: { x, z },
    radius,
    collisionClearance: options.clearance ?? 0.02,
    blocksPlayerLocomotion: options.blocksPlayerLocomotion ?? true,
    userData: {
      locomotionBlocker: true,
      collisionPolicy: options.collisionPolicy ?? 'living_actor',
      ...(options.userData ?? {}),
    },
  };
}

function collisionWorld(blockerRects = [], extra = {}) {
  return new CollisionWorld({
    walkableRects: [{ minX: -5, maxX: 5, minZ: -5, maxZ: 5 }],
    blockerRects,
    playerRadius: 0.35,
    ...extra,
  });
}

test('player movement away from an existing enemy overlap is accepted and reduces penetration', () => {
  const blocker = actorCircle('enemy-a', 0, 0);
  const collision = collisionWorld([blocker]);
  const start = new THREE.Vector3(0.5, 1.55, 0);
  const before = resolveHorizontalActorContact(start, blocker, collision.playerRadius).overlapDepth;
  const result = collision.moveWithCollision(start, new THREE.Vector3(0.04, 0, 0));
  const after = resolveHorizontalActorContact(result, blocker, collision.playerRadius).overlapDepth;
  assert.ok(result.x > start.x, 'outward input is never rejected from an invalid start');
  assert.ok(after < before, 'accepted movement and bounded recovery reduce overlap');
  assert.ok(collision.getMovementDiagnostics().movementAccepted[0] > 0);
});

test('inward player movement is projected away while its tangential component slides', () => {
  const blocker = actorCircle('enemy-slide', 0, 0);
  const position = new THREE.Vector3(0.67, 0, 0);
  const result = constrainPlayerMovementAgainstActors({
    position,
    movement: new THREE.Vector3(-0.18, 0, 0.12),
    blockers: [blocker],
    playerRadius: 0.35,
  });
  assert.ok(Math.abs(result.accepted.x) < 1e-8, 'radial inward motion is removed at contact');
  assert.ok(Math.abs(result.accepted.z - 0.12) < 1e-8, 'tangential motion remains');
  assert.equal(result.constrainedActorIds[0], 'enemy-slide');
});

test('pure strafe remains available around a touching enemy', () => {
  const blocker = actorCircle('enemy-strafe', 0, 0);
  const movement = new THREE.Vector3(0, 0, 0.1);
  const result = constrainPlayerMovementAgainstActors({ position: new THREE.Vector3(0.67, 0, 0), movement, blockers: [blocker], playerRadius: 0.35 });
  assert.ok(result.accepted.distanceTo(movement) < 1e-8);
});

test('exactly coincident centers use one deterministic finite fallback normal', () => {
  const blocker = actorCircle('same-center-enemy', 0, 0);
  const first = resolveHorizontalActorContact(new THREE.Vector3(), blocker, 0.35);
  const second = resolveHorizontalActorContact(new THREE.Vector3(), blocker, 0.35);
  assert.ok(first.normal.toArray().every(Number.isFinite));
  assert.ok(first.normal.distanceTo(second.normal) < 1e-12);
  assert.ok(Math.abs(first.normal.length() - 1) < 1e-12);
  const correction = buildPlayerDepenetrationCorrection({ position: new THREE.Vector3(), blockers: [blocker], playerRadius: 0.35 }).correction;
  assert.ok(correction.toArray().every(Number.isFinite));
  assert.ok(correction.length() > 0 && correction.length() <= ACTOR_SEPARATION_CONFIG.maximumDepenetrationPerFrame + 1e-12);
});

test('enemy pursuit at minimum range suppresses radial pressure but preserves tangential repositioning', () => {
  const result = resolveEnemyCloseRangeMotion({
    enemyPosition: new THREE.Vector3(1, 0, 0),
    playerPosition: new THREE.Vector3(),
    desiredMovement: new THREE.Vector3(-0.08, 0, 0.05),
    minimumCenterDistance: 1,
    holdEnterDistance: 1.4,
    fallbackKey: 'minimum-range-enemy',
  });
  assert.ok(Math.abs(result.movement.x) < 1e-8);
  assert.ok(Math.abs(result.movement.z - 0.05) < 1e-8);
  assert.equal(result.mode, 'hold');
  assert.ok(result.blockedInwardAmount > 0);
});

test('an already-overlapping enemy separates outward and never continues inward', () => {
  const result = resolveEnemyCloseRangeMotion({
    enemyPosition: new THREE.Vector3(0.72, 0, 0),
    playerPosition: new THREE.Vector3(),
    desiredMovement: new THREE.Vector3(-0.06, 0, 0),
    minimumCenterDistance: 1,
    fallbackKey: 'overlapping-enemy',
  });
  assert.equal(result.mode, 'separate');
  assert.ok(result.movement.x > 0);
  assert.ok(result.movement.x <= ACTOR_SEPARATION_CONFIG.maximumDepenetrationPerFrame + 1e-12);
  assert.ok(result.movement.dot(result.outwardNormal) > 0);
});

test('emergency recovery prefers bounded enemy displacement before correcting the player', () => {
  const blocker = actorCircle('movable-overlap-enemy', 0.5, 0);
  blocker.userData.tryPlayerDepenetration = (correction) => {
    blocker.center.x += correction.x;
    blocker.center.z += correction.z;
    return correction;
  };
  const collision = collisionWorld([blocker]);
  const start = new THREE.Vector3(0, 1.55, 0);
  const result = collision.moveWithCollision(start, new THREE.Vector3());
  const diagnostics = collision.getMovementDiagnostics();
  assert.ok(blocker.center.x > 0.5, 'enemy owns the first outward correction');
  assert.ok(new THREE.Vector3().fromArray(diagnostics.enemyCorrectionVector).length() <= ACTOR_SEPARATION_CONFIG.maximumDepenetrationPerFrame + 1e-12);
  assert.ok(new THREE.Vector3().fromArray(diagnostics.correctionVector).length() <= ACTOR_SEPARATION_CONFIG.maximumDepenetrationPerFrame + 1e-12);
  assert.ok(result.x < start.x, 'remaining safe recovery moves the player away from the enemy');
});

test('two opposing enemies cannot cancel recovery into a zero direction or suppress a valid strafe', () => {
  const blockers = [actorCircle('enemy-left', -0.5, 0), actorCircle('enemy-right', 0.5, 0)];
  const position = new THREE.Vector3();
  const correction = buildPlayerDepenetrationCorrection({ position, blockers, playerRadius: 0.35 }).correction;
  const movement = new THREE.Vector3(0, 0, 0.08);
  const constrained = constrainPlayerMovementAgainstActors({ position, movement, blockers, playerRadius: 0.35 });
  assert.ok(correction.length() > 0, 'stable actor ordering selects a deterministic escape when aggregate normals cancel');
  assert.ok(constrained.accepted.z > 0.07, 'a shared tangential escape remains usable');
});

test('three-enemy crowding stays finite, bounded, and accepts an available outward path', () => {
  const blockers = [
    actorCircle('enemy-1', -0.52, 0),
    actorCircle('enemy-2', 0.52, 0),
    actorCircle('enemy-3', 0, -0.52),
  ];
  const collision = collisionWorld(blockers);
  const start = new THREE.Vector3(0, 1.55, 0);
  const result = collision.moveWithCollision(start, new THREE.Vector3(0, 0, 0.06));
  const displacement = result.clone().sub(start);
  assert.ok(result.toArray().every(Number.isFinite));
  assert.ok(displacement.z > 0, 'movement away from the rear actor remains accepted');
  assert.ok(displacement.length() <= 0.06 + ACTOR_SEPARATION_CONFIG.maximumDepenetrationPerFrame + 1e-8, 'recovery is capped instead of teleporting');
  assert.ok(collision.getMovementDiagnostics().nearbyBlockingActorCount === 3);
});

test('world wall plus enemy recovery never pushes through geometry and leaves wall-parallel slide', () => {
  const wall = { id: 'world-wall', minX: -0.6, maxX: -0.4, minZ: -2, maxZ: 2 };
  const enemy = actorCircle('wall-crowding-enemy', 0.5, 0);
  const collision = collisionWorld([wall, enemy]);
  const start = new THREE.Vector3(0, 1.55, 0);
  const result = collision.moveWithCollision(start, new THREE.Vector3(0, 0, 0.08));
  assert.ok(result.x >= -0.05 - 1e-8, 'player radius remains outside the wall');
  assert.ok(result.z > 0.07, 'wall-parallel escape remains available');
  assert.equal(collision.canStandAt(result, { ignoreActorBlockers: true }), true);
});

test('corpse footprint contact slides and overlap recovery cannot create a full movement lock', () => {
  const corpse = {
    id: 'corpse-footprint',
    type: 'combatActor',
    blockerShape: 'capsule',
    from: { x: -0.25, z: 0 },
    to: { x: 0.25, z: 0 },
    radius: 0.16,
    collisionClearance: 0,
    userData: { locomotionBlocker: true, collisionPolicy: 'corpse_footprint', ragdoll: true },
  };
  const collision = collisionWorld([corpse]);
  const start = new THREE.Vector3(0, 1.55, 0.42);
  const result = collision.moveWithCollision(start, new THREE.Vector3(0.08, 0, 0.05));
  assert.ok(result.x > start.x, 'low corpse contact preserves tangential movement');
  assert.ok(result.z > start.z, 'movement reducing corpse overlap is accepted');
  assert.ok(result.toArray().every(Number.isFinite));
});

test('only the authoritative locomotion proxy constrains movement while combat volumes remain independent', () => {
  const locomotionBlocker = actorCircle('enemy-authoritative-proxy', 0, 0);
  const hurtbox = actorCircle('enemy-upper-chest-hurtbox', 0.3, 0, 0.4, { userData: { locomotionBlocker: false, combatVolume: true } });
  const result = constrainPlayerMovementAgainstActors({
    position: new THREE.Vector3(0.67, 0, 0),
    movement: new THREE.Vector3(-0.1, 0, 0.05),
    blockers: [locomotionBlocker, hurtbox],
    playerRadius: 0.35,
  });
  assert.deepEqual(result.constrainedActorIds, ['enemy-authoritative-proxy']);
  assert.ok(result.accepted.z > 0);
  const collision = collisionWorld([hurtbox]);
  const start = new THREE.Vector3(0.9, 1.55, 0);
  const passed = collision.moveWithCollision(start, new THREE.Vector3(-1.8, 0, 0));
  assert.ok(passed.x < -0.8, 'combat-only hurt volume is absent from player locomotion constraints');
});

test('normal walking without nearby enemies preserves the exact requested displacement', () => {
  const collision = collisionWorld([]);
  const start = new THREE.Vector3(0, 1.55, 0);
  const requested = new THREE.Vector3(0.07, 0, -0.09);
  const result = collision.moveWithCollision(start, requested);
  assert.ok(result.distanceTo(start.clone().add(requested)) < 1e-12);
  assert.equal(collision.getMovementDiagnostics().lastMovementBlockReason, null);
});
