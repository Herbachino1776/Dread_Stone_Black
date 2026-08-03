import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CollisionWorld } from '../src/game/Collision.js';
import { FOLSOM_COMBAT_FOOTPRINT, FOLSOM_RAPIER_SUPPORT, FOLSOM_WALKER_CONFIG, FolsomCombatEncounter } from '../src/game/combat/FolsomCombatEncounter.js';
import { WALKER_STATES } from '../src/game/combat/CombatLabWalkerController.js';
import { CHEZWICK_DAMAGE_COMBAT_PROFILE } from '../src/game/combat/HumanoidModelProfiles.js';
import { installKnifeWoundManifestForHeadlessTests } from '../src/game/combat/KnifeWoundDecalLibrary.js';

installKnifeWoundManifestForHeadlessTests(JSON.parse(readFileSync(new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url), 'utf8')));

async function createEncounter({ yaw = 0 } = {}) {
  const scene = new THREE.Scene();
  const collision = new CollisionWorld({
    walkableRects: [{ minX: -18, maxX: 22, minZ: -20, maxZ: 18 }],
    blockerRects: [], defaultFloorY: 0.16,
    outdoorTerrainSampler: { sampleOutdoorY: () => 0.16 }, sourceLocationId: 'folsom',
  });
  const player = { position: new THREE.Vector3(-2, 1.71, -4), yaw };
  const dungeon = { scene, collision, isPositionInFishingWater: () => false };
  const encounter = await FolsomCombatEncounter.create({ dungeon, player });
  return { scene, collision, player, encounter };
}

const inside = (point, bounds, margin = 0) => point.x >= bounds.minX + margin && point.x <= bounds.maxX - margin
  && point.z >= bounds.minZ + margin && point.z <= bounds.maxZ - margin;

test('Folsom owns one router with four independently routed roaming Chezwick actors', async () => {
  const { encounter, collision } = await createEncounter();
  const controllers = encounter.getWalkerControllers();
  const actors = controllers.map((controller) => controller.actor);
  assert.equal(controllers.length, 4);
  assert.equal(new Set(actors.map((actor) => actor.instanceId)).size, 4);
  assert.ok(actors.every((actor) => actor.visualProfile === CHEZWICK_DAMAGE_COMBAT_PROFILE));
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 4);
  assert.equal(collision.blockerRects.filter((blocker) => blocker.type === 'combatActor').length, 4);
  actors.forEach((actor) => {
    const collider = actor.colliders.get('upper_chest');
    assert.equal(encounter.combatRouter.resolveCollider(collider, actor.getBodyWorldPosition('upper_chest')).actor, actor);
  });
  encounter.dispose();
});

test('all four spawn points are distributed, grounded, unblocked, and inside Folsom support', async () => {
  const { encounter, collision, player } = await createEncounter({ yaw: THREE.MathUtils.degToRad(37) });
  const controllers = encounter.getWalkerControllers();
  controllers.forEach((controller, index) => {
    const point = controller.position;
    assert.ok(inside(point, FOLSOM_COMBAT_FOOTPRINT, 0.4));
    assert.ok(inside(point, FOLSOM_RAPIER_SUPPORT, 0.35));
    assert.ok(Math.hypot(point.x - player.position.x, point.z - player.position.z) >= 5);
    assert.equal(collision.sampleWalkableY(point.x, point.z, point.y).y, 0.16);
    assert.equal(collision.getIntersectingBlockers({ x: point.x, y: point.y + 1.55, z: point.z }, 0.42).filter((entry) => entry !== controller.playerBlocker && entry.type !== 'combatActor').length, 0);
    controllers.slice(index + 1).forEach((other) => assert.ok(point.distanceTo(other.position) > 1.1));
  });
  encounter.dispose();
});

test('close-range steering preserves the intimate melee collision envelope', async () => {
  const { encounter, player } = await createEncounter();
  const controller = encounter.walkerController;
  const minimumDistance = controller.getMinimumPlayerDistance();
  assert.ok(Math.abs(minimumDistance - 0.95) < 1e-8);
  assert.ok(FOLSOM_WALKER_CONFIG.stopTargetDistance >= minimumDistance);
  controller.position.set(player.position.x + minimumDistance - 0.12, 0.16, player.position.z);
  controller.currentYaw = -Math.PI / 2;
  controller.state = WALKER_STATES.approaching;
  const before = controller.position.distanceTo(new THREE.Vector3(player.position.x, 0.16, player.position.z));
  controller.updateLivingState(1 / 60, player.position);
  assert.ok(controller.position.distanceTo(new THREE.Vector3(player.position.x, 0.16, player.position.z)) > before);
  assert.equal(controller.closeRangeMode, 'separate');
  encounter.dispose();
});

test('first accepted injury persistently threatens Chezwick and enters an authored guard cycle', async () => {
  const { encounter, player } = await createEncounter();
  const controller = encounter.walkerController;
  let guards = 0;
  controller.actor.visualAdapter = { dispose() {}, animationController: { playGuard: () => { guards += 1; return { name: 'DSB_Mace_Brace_Head_v001' }; } } };
  controller.actor.woundSystem.wounds.push({ id: 'threat-test' });
  controller.actor.reflex.time = 0;
  controller.updateLivingState(0.01, player.position);
  assert.equal(controller.threatened, true);
  assert.equal(guards, 1);
  assert.equal(controller.guardCycleCount, 1);
  controller.actor.woundSystem.wounds.length = 0;
  controller.updateLivingState(0.01, player.position);
  assert.equal(controller.threatened, true);
  encounter.dispose();
});

test('a grounded corpse remains for fifteen seconds and only its slot respawns', async () => {
  const { encounter, player } = await createEncounter();
  const controllers = encounter.getWalkerControllers();
  const target = controllers[2];
  const originalIds = controllers.map((controller) => controller.actor.instanceId);
  for (let hit = 0; hit < 4; hit += 1) target.forceQualifyingStab();
  assert.equal(target.state, WALKER_STATES.losingConsciousness);
  target.holdGroundedPose();
  for (let frame = 0; frame < 299; frame += 1) target.prepareFrame(0.05, player);
  assert.equal(target.actor.instanceId, originalIds[2]);
  target.prepareFrame(0.05, player);
  assert.equal(target.actor, null);
  target.prepareFrame(0, player);
  assert.ok(target.actor.instanceId !== originalIds[2]);
  assert.deepEqual(controllers.filter((_, index) => index !== 2).map((controller) => controller.actor.instanceId), originalIds.filter((_, index) => index !== 2));
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 4);
  encounter.dispose();
});

test('reset replaces all four actors without stale routing or physics ownership', async () => {
  const { encounter, player, collision } = await createEncounter();
  const actors = encounter.getWalkerControllers().map((controller) => controller.actor);
  const staleCollider = actors[0].colliders.get('upper_chest');
  encounter.reset(player);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 4);
  assert.equal(encounter.combatRouter.resolveCollider(staleCollider, new THREE.Vector3()), null);
  assert.ok(encounter.getWalkerControllers().every((controller) => !actors.includes(controller.actor)));
  encounter.dispose();
  assert.equal(collision.blockerRects.filter((entry) => entry.type === 'combatActor').length, 0);
});
