import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { COMBAT_REQUIRED_REGION_IDS, HUMANOID_ANATOMY_REGIONS, HUMANOID_BODY_CONFIG, HUMANOID_JOINT_CONFIG, KNIFE_COMBAT_CONFIG, validateCombatConfiguration } from '../src/game/combat/CombatConfig.js';
import { advancePenetrationDepth, clampWorkspacePoint, classifyKnifeContact, computeWorldThrust, deriveBladeTip, normalizedBladeForward, visibleCollisionTransformsWithinTolerance } from '../src/game/combat/CombatMath.js';
import { CombatPhysicsWorld, initializeCombatPhysics } from '../src/game/combat/CombatPhysicsWorld.js';
import { HumanoidCombatActor } from '../src/game/combat/HumanoidCombatActor.js';

test('combat configuration has believable semantic anatomy and physical mass', () => {
  const result = validateCombatConfiguration();
  assert.equal(result.valid, true);
  assert.equal(result.bodyCount, 18);
  assert.equal(result.jointCount, 17);
  assert.ok(result.totalMass >= 65 && result.totalMass <= 90);
  assert.deepEqual(COMBAT_REQUIRED_REGION_IDS.filter((id) => !HUMANOID_ANATOMY_REGIONS.some((region) => region.id === id)), []);
  assert.equal(new Set(HUMANOID_BODY_CONFIG.map((body) => body.id)).size, HUMANOID_BODY_CONFIG.length);
  assert.equal(new Set(HUMANOID_JOINT_CONFIG.map((joint) => joint.id)).size, HUMANOID_JOINT_CONFIG.length);
});

test('tissue and hard structure depths remain physically bounded', () => {
  HUMANOID_ANATOMY_REGIONS.forEach((region) => {
    assert.ok(region.maximumTissueDepth > 0);
    if (region.hardStructure) assert.ok(region.hardStructureDepth > 0 && region.hardStructureDepth <= region.maximumTissueDepth);
  });
  assert.ok(KNIFE_COMBAT_CONFIG.maximumPenetrationDepth <= KNIFE_COMBAT_CONFIG.bladeLength);
});

test('knife tip and forward axis derive from one world transform', () => {
  const grip = new THREE.Vector3(1, 2, 3);
  const rotation = new THREE.Quaternion();
  assert.deepEqual(normalizedBladeForward(rotation).toArray(), [0, 0, -1]);
  assert.deepEqual(deriveBladeTip(grip, rotation, 0.5).toArray(), [1, 2, 2.5]);
});

test('thrust advances along blade orientation in all aim directions', () => {
  const start = new THREE.Vector3();
  const directions = [
    [new THREE.Euler(0, 0, 0), new THREE.Vector3(0, 0, -1)],
    [new THREE.Euler(Math.PI / 2, 0, 0), new THREE.Vector3(0, 1, 0)],
    [new THREE.Euler(-Math.PI / 2, 0, 0), new THREE.Vector3(0, -1, 0)],
    [new THREE.Euler(0, -Math.PI / 2, 0), new THREE.Vector3(1, 0, 0)],
    [new THREE.Euler(0, Math.PI / 2, 0), new THREE.Vector3(-1, 0, 0)],
  ];
  directions.forEach(([euler, expected]) => assert.ok(computeWorldThrust(start, new THREE.Quaternion().setFromEuler(euler), 1).distanceTo(expected) < 1e-6));
});

test('world thrust does not converge on reticle or target centers', () => {
  const start = new THREE.Vector3(0.35, 0.2, 0);
  const targetTorso = new THREE.Vector3(0, 0, -3);
  const end = computeWorldThrust(start, new THREE.Quaternion(), 0.6);
  assert.equal(end.x, 0.35);
  assert.notEqual(end.x, targetTorso.x);
});

test('camera rotation rotates path without teleporting the grip', () => {
  const grip = new THREE.Vector3(0.2, 1.2, -0.5);
  const before = deriveBladeTip(grip, new THREE.Quaternion(), 0.52);
  const after = deriveBladeTip(grip, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.2), 0.52);
  assert.ok(after.distanceTo(before) < 0.12);
  assert.deepEqual(grip.toArray(), [0.2, 1.2, -0.5]);
});

test('hand workspace clamps extreme input and excludes behind-camera positions', () => {
  const result = clampWorkspacePoint(new THREE.Vector3(20, -20, 4), KNIFE_COMBAT_CONFIG.workspace, new THREE.Vector3());
  assert.equal(result.x, KNIFE_COMBAT_CONFIG.workspace.max[0]);
  assert.equal(result.y, KNIFE_COMBAT_CONFIG.workspace.min[1]);
  assert.equal(result.z, KNIFE_COMBAT_CONFIG.workspace.max[2]);
  assert.ok(result.z < 0);
});

test('visible and collision weapon transforms share authored tolerance', () => {
  const position = new THREE.Vector3(1, 2, 3);
  const quaternion = new THREE.Quaternion();
  assert.equal(visibleCollisionTransformsWithinTolerance(position, position.clone(), quaternion, quaternion.clone(), KNIFE_COMBAT_CONFIG.visibleCollisionTolerance), true);
  assert.equal(visibleCollisionTransformsWithinTolerance(position, position.clone().addScalar(0.2), quaternion, quaternion.clone(), KNIFE_COMBAT_CONFIG.visibleCollisionTolerance), false);
});

test('contact classifier distinguishes blunt, edge, glance, tip, failure, and puncture', () => {
  assert.equal(classifyKnifeContact({ part: 'pommel', speed: 2, alignment: 1 }).state, 'blunt_contact');
  assert.equal(classifyKnifeContact({ part: 'edge', speed: 2, alignment: 0 }).state, 'edge_contact');
  assert.equal(classifyKnifeContact({ speed: 2, alignment: 0.2 }).state, 'glancing_contact');
  assert.equal(classifyKnifeContact({ speed: 0.1, alignment: 1 }).state, 'failed_penetration');
  assert.equal(classifyKnifeContact({ speed: 2, alignment: 0.6 }).state, 'tip_contact');
  assert.equal(classifyKnifeContact({ speed: 2, alignment: 0.95 }).state, 'surface_puncture');
});

test('penetration advances gradually, respects bone and extracts', () => {
  const base = { dt: 1 / 60, tissueResistance: 0.5, maximumDepth: 0.3, penetrationRate: 0.58, withdrawalRate: 0.72 };
  const shallow = advancePenetrationDepth({ ...base, currentDepth: 0, targetDepth: 0.2 });
  assert.ok(shallow.depth > 0 && shallow.depth < 0.2);
  const bone = advancePenetrationDepth({ ...base, currentDepth: 0.09, targetDepth: 0.2, hardDepth: 0.1 });
  assert.ok(bone.depth <= 0.1);
  assert.equal(bone.hardContact, true);
  const extracted = advancePenetrationDepth({ ...base, currentDepth: 0.001, targetDepth: -0.02 });
  assert.equal(extracted.extracted, true);
  assert.equal(extracted.depth, 0);
});

test('physics world initializes once, resets actors without leaks, and disposes', async () => {
  const rapierA = await initializeCombatPhysics();
  const rapierB = await initializeCombatPhysics();
  assert.equal(rapierA, rapierB);
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const actor = new HumanoidCombatActor({ physics, scene });
  assert.equal(physics.world.bodies.len(), 18);
  assert.equal(physics.world.impulseJoints.len(), 17);
  actor.reset();
  assert.equal(physics.world.bodies.len(), 18);
  assert.equal(physics.world.impulseJoints.len(), 17);
  assert.equal(physics.resetCount, 1);
  actor.dispose();
  assert.equal(physics.world.bodies.len(), 0);
  assert.equal(physics.world.impulseJoints.len(), 0);
  physics.dispose();
});

test('resume after suspension discards catch-up instead of exploding', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const actor = new HumanoidCombatActor({ physics, scene: new THREE.Scene() });
  const stepped = physics.step(3, (dt) => actor.beforePhysics(dt));
  assert.equal(stepped, 0);
  assert.equal(physics.resumeDiscardCount, 1);
  actor.bodies.forEach(({ body }) => assert.ok([body.translation().x, body.translation().y, body.translation().z].every(Number.isFinite)));
  actor.dispose();
  physics.dispose();
});

test('regional trauma affects balance and severe vital trauma releases standing control', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const actor = new HumanoidCombatActor({ physics, scene: new THREE.Scene() });
  const legCollider = actor.colliders.get('left_lower_leg');
  const legBody = actor.bodies.get('left_lower_leg').body;
  const legPosition = legBody.translation();
  const legPoint = new THREE.Vector3(legPosition.x, legPosition.y, legPosition.z);
  const legHit = actor.resolveHit(legCollider, legPoint);
  actor.applyPenetration({ hit: legHit, entryPoint: legPoint, direction: new THREE.Vector3(0, 0, -1), deltaDepth: 0.12, depth: 0.12, force: 1 });
  const legBalance = actor.balanceImpairment;
  const armCollider = actor.colliders.get('left_forearm');
  const armBody = actor.bodies.get('left_forearm').body;
  const armPosition = armBody.translation();
  const armPoint = new THREE.Vector3(armPosition.x, armPosition.y, armPosition.z);
  const armHit = actor.resolveHit(armCollider, armPoint);
  const balanceBeforeArm = actor.balanceImpairment;
  actor.applyPenetration({ hit: armHit, entryPoint: armPoint, direction: new THREE.Vector3(0, 0, -1), deltaDepth: 0.12, depth: 0.12, force: 1 });
  assert.ok(legBalance > actor.balanceImpairment - balanceBeforeArm);
  const neckCollider = actor.colliders.get('neck');
  const neckBody = actor.bodies.get('neck').body;
  const neckPosition = neckBody.translation();
  const neckPoint = new THREE.Vector3(neckPosition.x, neckPosition.y, neckPosition.z);
  const neckHit = actor.resolveHit(neckCollider, neckPoint);
  for (let i = 0; i < 5; i += 1) actor.applyPenetration({ hit: neckHit, entryPoint: neckPoint, direction: new THREE.Vector3(0, 0, -1), deltaDepth: 0.1, depth: 0.1, force: 2 });
  assert.ok(['incapacitated', 'dying', 'dead'].includes(actor.lifeState));
  for (let i = 0; i < 120; i += 1) actor.beforePhysics(1 / 60);
  assert.ok(actor.motorStrength < 0.5);
  if (actor.lifeState === 'dying') assert.fail('dying state should complete within the authored transition');
  actor.dispose();
  physics.dispose();
});
