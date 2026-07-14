import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CollisionWorld } from '../src/game/Collision.js';
import { FOLSOM_COMBAT_FOOTPRINT, FOLSOM_ENEMY_WAVE_CONFIG, FOLSOM_RAPIER_SUPPORT, FolsomCombatEncounter } from '../src/game/combat/FolsomCombatEncounter.js';
import { WALKER_STATES } from '../src/game/combat/CombatLabWalkerController.js';
import { installKnifeWoundManifestForHeadlessTests } from '../src/game/combat/KnifeWoundDecalLibrary.js';
import { MELEE_INTENTS } from '../src/game/combat/MeleeIntentWeapon.js';

installKnifeWoundManifestForHeadlessTests(JSON.parse(readFileSync(new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url), 'utf8')));

function createFolsomCollision(blockerRects = []) {
  return new CollisionWorld({
    walkableRects: [{ minX: -18, maxX: 22, minZ: -20, maxZ: 18 }],
    blockerRects,
    defaultFloorY: 0.16,
    outdoorTerrainSampler: { sampleOutdoorY: () => 0.16 },
    sourceLocationId: 'folsom',
  });
}

async function createEncounter({ yaw = 0, query = new URLSearchParams(), blockerRects = [] } = {}) {
  const scene = new THREE.Scene();
  const collision = createFolsomCollision(blockerRects);
  const player = { position: new THREE.Vector3(-2, 1.71, -4), yaw };
  const dungeon = { scene, collision, isPositionInFishingWater: () => false };
  const encounter = await FolsomCombatEncounter.create({ dungeon, player, query });
  return { scene, collision, player, dungeon, encounter };
}

function makeHit(actor, bodyId) {
  const collider = actor.colliders.get(bodyId);
  const point = actor.getBodyWorldPosition(bodyId).add(new THREE.Vector3(0, 0, 0.08));
  return { collider, point, hit: actor.resolveHit(collider, point) };
}

function addPuncture(routed, id) {
  const interaction = routed.director.beginPuncture({
    weapon: { id: 'folsom_test_knife' },
    intent: { weaponId: 'folsom_test_knife', intent: MELEE_INTENTS.stab, ownerId: id, intentional: true, damaging: true },
    hit: routed.hit,
    entryPoint: routed.hit.worldPoint,
    direction: new THREE.Vector3(0, 0, -1),
    depth: 0.01,
    force: 1,
  });
  routed.director.update(0.14);
  return interaction;
}

test('Folsom owns one router with independently routed stationary and walker actors', async () => {
  const { encounter } = await createEncounter();
  const walker = encounter.walkerController.actor;
  assert.ok(walker);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 2);
  assert.equal(encounter.getDiagnostics().routerColliderCount, 36);

  const walkerContact = makeHit(walker, 'upper_chest');
  const stationaryContact = makeHit(encounter.actor, 'lower_chest');
  const routedWalker = encounter.combatRouter.resolveCollider(walkerContact.collider, walkerContact.point);
  const routedStationary = encounter.combatRouter.resolveCollider(stationaryContact.collider, stationaryContact.point);
  assert.equal(routedWalker.actor, walker);
  assert.equal(routedStationary.actor, encounter.actor);
  addPuncture({ ...routedWalker, hit: { ...routedWalker.hit, worldPoint: walkerContact.point } }, 'walker');
  assert.equal(walker.woundSystem.wounds.length, 1);
  assert.equal(encounter.actor.woundSystem.wounds.length, 0);
  addPuncture({ ...routedStationary, hit: { ...routedStationary.hit, worldPoint: stationaryContact.point } }, 'stationary');
  assert.equal(walker.woundSystem.wounds.length, 1);
  assert.equal(encounter.actor.woundSystem.wounds.length, 1);
  encounter.dispose();
});

test('Folsom combat activation and readability priority use the nearest relevant actor', async () => {
  const { encounter, player } = await createEncounter();
  const walker = encounter.walkerController.actor;
  player.position.copy(encounter.actor.getBodyWorldPosition('pelvis')).add(new THREE.Vector3(0, 0.7, 0.4));
  assert.equal(encounter.getPriorityCombatActor(player), encounter.actor);
  assert.equal(encounter.isPlayerInCombatRange(player), true);
  assert.equal(encounter.getDiagnostics().combatActiveDueToActor, encounter.actor.instanceId);
  player.position.copy(walker.getBodyWorldPosition('pelvis')).add(new THREE.Vector3(0, 0.7, 0.4));
  assert.equal(encounter.getPriorityCombatActor(player), walker);
  assert.equal(encounter.isPlayerInCombatRange(player), true);
  encounter.walkerController.state = WALKER_STATES.grounded;
  assert.equal(encounter.getPriorityCombatActor(player), encounter.actor, 'grounded walker cannot retain lighting or knife priority');
  encounter.dispose();
});

test('first Folsom walker spawn is deterministic, grounded, unblocked, and inside the forward cone', async () => {
  const yaw = THREE.MathUtils.degToRad(37);
  const { encounter, player, collision } = await createEncounter({ yaw });
  const spawn = encounter.walkerController.position;
  const dx = spawn.x - player.position.x;
  const dz = spawn.z - player.position.z;
  const spawnYaw = Math.atan2(dx, dz);
  const angle = Math.abs(Math.atan2(Math.sin(spawnYaw - yaw), Math.cos(spawnYaw - yaw)));
  const distance = Math.hypot(dx, dz);
  assert.ok(THREE.MathUtils.radToDeg(angle) >= 10 && THREE.MathUtils.radToDeg(angle) <= 30);
  assert.ok(distance >= 5 && distance <= 7);
  assert.equal(spawn.y, 0.16);
  assert.equal(collision.getIntersectingBlockers({ x: spawn.x, y: spawn.y + 1.55, z: spawn.z }, 0.42).filter((entry) => entry !== encounter.walkerController.playerBlocker).length, 0);
  assert.ok(spawn.x >= FOLSOM_COMBAT_FOOTPRINT.minX && spawn.x <= FOLSOM_COMBAT_FOOTPRINT.maxX);
  assert.ok(spawn.z >= FOLSOM_COMBAT_FOOTPRINT.minZ && spawn.z <= FOLSOM_COMBAT_FOOTPRINT.maxZ);
  encounter.dispose();
});

test('Folsom generations alternate forward-cone sides and replace stale routing', async () => {
  const { encounter, player } = await createEncounter();
  const controller = encounter.walkerController;
  const firstActor = controller.actor;
  const firstCollider = firstActor.colliders.get('upper_chest');
  const firstPoint = firstActor.getBodyWorldPosition('upper_chest');
  const firstSide = Math.sign(Math.atan2(controller.position.x - player.position.x, controller.position.z - player.position.z) - player.yaw);
  controller.forceRespawn();
  controller.stateElapsed = controller.config.respawnDelaySeconds;
  controller.prepareFrame(0, player);
  const secondActor = controller.actor;
  const secondSide = Math.sign(Math.atan2(controller.position.x - player.position.x, controller.position.z - player.position.z) - player.yaw);
  assert.notEqual(secondActor.instanceId, firstActor.instanceId);
  assert.equal(firstSide, -secondSide);
  assert.equal(encounter.combatRouter.resolveCollider(firstCollider, firstPoint), null);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 2);
  assert.equal(encounter.combatRouter.resolveCollider(secondActor.colliders.get('upper_chest'), secondActor.getBodyWorldPosition('upper_chest')).actor, secondActor);
  encounter.dispose();
});

test('walker pursuit remains bounded, idles outside the footprint, and resumes without teleporting', async () => {
  const { encounter, player } = await createEncounter();
  const controller = encounter.walkerController;
  for (let frame = 0; frame < 150; frame += 1) controller.prepareFrame(1 / 60, player);
  assert.ok(controller.currentSpeed > 0);
  const insidePosition = controller.position.clone();
  player.position.set(FOLSOM_COMBAT_FOOTPRINT.maxX + 4, 1.71, 0);
  for (let frame = 0; frame < 150; frame += 1) controller.prepareFrame(1 / 60, player);
  assert.equal(controller.footprintActive, false);
  assert.ok(controller.currentSpeed < 0.03);
  assert.ok(controller.position.x >= FOLSOM_COMBAT_FOOTPRINT.minX && controller.position.x <= FOLSOM_COMBAT_FOOTPRINT.maxX);
  assert.ok(controller.position.z >= FOLSOM_COMBAT_FOOTPRINT.minZ && controller.position.z <= FOLSOM_COMBAT_FOOTPRINT.maxZ);
  const outsideStop = controller.position.clone();
  assert.ok(outsideStop.distanceTo(insidePosition) < 1, 'leaving the footprint decelerates instead of teleporting or pursuing across town');
  player.position.set(-2, 1.71, -4);
  for (let frame = 0; frame < 90; frame += 1) controller.prepareFrame(1 / 60, player);
  assert.equal(controller.footprintActive, true);
  assert.ok(controller.position.distanceTo(outsideStop) > 0.05);
  encounter.dispose();
});

test('bounded Rapier support covers spawn, approach, stop, collapse, and landing space', async () => {
  const { encounter, player } = await createEncounter();
  const spawn = encounter.walkerController.position.clone();
  const stop = player.position.clone().setY(0.16);
  const approach = spawn.clone().lerp(stop, 0.5);
  const likelyLanding = stop.clone().add(new THREE.Vector3(1.3, 0, 1.3));
  [spawn, approach, stop, likelyLanding].forEach((point) => assert.equal(encounter.isRapierSupported(point), true));
  assert.equal(encounter.supportFloors.length, 1);
  assert.ok(FOLSOM_RAPIER_SUPPORT.maxX - FOLSOM_RAPIER_SUPPORT.minX < 32);
  assert.ok(FOLSOM_RAPIER_SUPPORT.maxZ - FOLSOM_RAPIER_SUPPORT.minZ < 30);
  encounter.dispose();
});

test('Folsom reset leaves exactly two fresh active actors and no stale walker collider', async () => {
  const { encounter, player } = await createEncounter();
  const oldWalker = encounter.walkerController.actor;
  const staleCollider = oldWalker.colliders.get('upper_chest');
  const stationaryContact = makeHit(encounter.actor, 'upper_chest');
  const routedStationary = encounter.combatRouter.resolveCollider(stationaryContact.collider, stationaryContact.point);
  addPuncture({ ...routedStationary, hit: { ...routedStationary.hit, worldPoint: stationaryContact.point } }, 'reset-stationary');
  encounter.reset(player);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 2);
  assert.equal(encounter.walkerController.actor === oldWalker, false);
  assert.equal(encounter.combatRouter.resolveCollider(staleCollider, new THREE.Vector3()), null);
  assert.equal(encounter.actor.woundSystem.wounds.length, 0);
  assert.equal(encounter.walkerController.actor.woundSystem.wounds.length, 0);
  assert.equal(encounter.physics.world.bodies.len(), 37);
  assert.equal(encounter.physics.world.colliders.len(), 37);
  assert.equal(encounter.physics.world.impulseJoints.len(), 34);
  encounter.dispose();
});

test('authored Folsom spawn completes its death state without procedural collapse or ragdoll', async () => {
  const { encounter, player, collision } = await createEncounter();
  const actor = encounter.actor;
  const controller = encounter.stationaryDeathController;
  assert.equal(actor.automaticMortality, false);
  controller.forceQualifyingStab('upper_chest');
  controller.forceQualifyingStab('abdomen');
  assert.equal(controller.state, WALKER_STATES.losingConsciousness);
  assert.equal(encounter.stationaryDeathCollisionReleased, true);
  assert.equal(encounter.combatRouter.getDirector(actor), null);
  assert.equal(encounter.getActiveCombatActors().includes(actor), false);
  assert.equal([...actor.colliders.values()].every((collider) => collider.isEnabled() === false), true);
  assert.equal(collision.blockerRects.includes(encounter.playerBlocker), false);

  for (let frame = 0; frame < 120; frame += 1) controller.prepareFrame(0.05);
  actor.prepareFrame(0.05);

  assert.equal(controller.state, WALKER_STATES.grounded);
  assert.equal(controller.shouldHoldFinalPose(), true);
  assert.equal(actor.ragdollActive, false);
  assert.equal(actor.getDiagnostics().ragdollHandoff.activationCount, 0);
  assert.equal(actor.visualAdapter?.ragdollDiagnostics.activationCount ?? 0, 0);
  assert.equal(encounter.stationaryDeathCollisionReleased, true);
  assert.equal(encounter.combatRouter.getDirector(actor), null);
  assert.equal(encounter.getActiveCombatActors().includes(actor), false);
  assert.equal([...actor.colliders.values()].every((collider) => collider.isEnabled() === false), true);
  assert.equal(collision.blockerRects.includes(encounter.playerBlocker), false);

  encounter.reset(player);
  assert.equal(controller.state, WALKER_STATES.nearPlayer);
  assert.equal(encounter.stationaryDeathCollisionReleased, false);
  assert.equal(encounter.combatRouter.getDirector(actor), encounter.combatDirector);
  assert.equal([...actor.colliders.values()].every((collider) => collider.isEnabled()), true);
  assert.equal(collision.blockerRects.includes(encounter.playerBlocker), true);
  encounter.dispose();
});

test('dying Folsom walker releases player and combat collision immediately', async () => {
  const { encounter, collision } = await createEncounter();
  const controller = encounter.walkerController;
  const actor = controller.actor;
  const blocker = controller.playerBlocker;
  assert.equal(collision.blockerRects.includes(blocker), true);

  controller.forceQualifyingStab();
  controller.forceQualifyingStab();

  assert.equal(controller.state, WALKER_STATES.losingConsciousness);
  assert.equal(controller.deathCollisionReleased, true);
  assert.equal(encounter.combatRouter.getDirector(actor), null);
  assert.equal(encounter.getActiveCombatActors().includes(actor), false);
  assert.equal([...actor.colliders.values()].every((collider) => collider.isEnabled() === false), true);
  assert.equal(collision.blockerRects.includes(blocker), false);
  encounter.dispose();
});

test('two dead enemies fade-despawn at ten seconds and a fresh wave of two returns two seconds later', async () => {
  const { encounter } = await createEncounter();
  const stationaryActor = encounter.actor;
  const firstWalkerInstanceId = encounter.walkerController.actor.instanceId;
  encounter.stationaryDeathController.forceQualifyingStab('upper_chest');
  encounter.stationaryDeathController.forceQualifyingStab('abdomen');
  encounter.walkerController.forceQualifyingStab();
  encounter.walkerController.forceQualifyingStab();

  assert.equal(FOLSOM_ENEMY_WAVE_CONFIG.corpseDespawnSeconds, 10);
  assert.equal(FOLSOM_ENEMY_WAVE_CONFIG.respawnDelaySeconds, 2);
  for (let frame = 0; frame < 190; frame += 1) encounter.updateEnemyWaveLifecycle(0.05);
  assert.ok(encounter.enemyWaveCorpses.stationary.opacity > 0.49 && encounter.enemyWaveCorpses.stationary.opacity < 0.51);
  assert.ok(encounter.enemyWaveCorpses.walker.opacity > 0.49 && encounter.enemyWaveCorpses.walker.opacity < 0.51);
  assert.equal(encounter.enemyWaveCorpses.stationary.despawned, false);
  assert.equal(encounter.enemyWaveCorpses.walker.despawned, false);

  for (let frame = 0; frame < 10; frame += 1) encounter.updateEnemyWaveLifecycle(0.05);
  assert.equal(encounter.enemyWaveCorpses.stationary.despawned, true);
  assert.equal(encounter.enemyWaveCorpses.walker.despawned, true);
  assert.equal(stationaryActor.root.visible, false);
  assert.equal(encounter.walkerController.actor?.instanceId ?? null, null);

  for (let frame = 0; frame < 39; frame += 1) encounter.updateEnemyWaveLifecycle(0.05);
  assert.equal(encounter.walkerController.actor?.instanceId ?? null, null);
  encounter.updateEnemyWaveLifecycle(0.05);
  assert.equal(encounter.waveGeneration, 2);
  assert.equal(stationaryActor.root.visible, true);
  assert.ok(encounter.walkerController.actor);
  assert.notEqual(encounter.walkerController.actor.instanceId, firstWalkerInstanceId);
  assert.equal(encounter.getActiveCombatActors().length, 2);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 2);
  assert.equal(encounter.enemyWaveCorpses.stationary.started, false);
  assert.equal(encounter.enemyWaveCorpses.walker.started, false);
  encounter.dispose();
});

test('Folsom disposal is idempotent and removes actors, blockers, support, and routing', async () => {
  const { encounter, collision } = await createEncounter();
  const walkerController = encounter.walkerController;
  const walkerActor = walkerController.actor;
  const stationaryActor = encounter.actor;
  encounter.dispose();
  encounter.dispose();
  assert.equal(walkerActor.bodies.size, 0);
  assert.equal(walkerActor.colliders.size, 0);
  assert.equal(walkerActor.joints.length, 0);
  assert.equal(stationaryActor.bodies.size, 0);
  assert.equal(encounter.supportFloors.length, 0);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 0);
  assert.equal(collision.blockerRects.filter((entry) => entry.type === 'combatActor').length, 0);
  assert.equal(walkerController.enabled, false);
  assert.equal(walkerController.actor, null);
});

test('folsomWalker=0 isolates the stationary actor without creating parallel combat systems', async () => {
  const { encounter } = await createEncounter({ query: new URLSearchParams('folsomWalker=0') });
  assert.equal(encounter.walkerController.actor, null);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 1);
  assert.equal(encounter.physics.world.bodies.len(), 19);
  assert.equal(encounter.supportFloors.length, 1);
  encounter.dispose();
});
