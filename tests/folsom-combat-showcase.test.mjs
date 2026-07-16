import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CollisionWorld } from '../src/game/Collision.js';
import { FOLSOM_COMBAT_FOOTPRINT, FOLSOM_RAPIER_SUPPORT, FolsomCombatEncounter } from '../src/game/combat/FolsomCombatEncounter.js';
import { TESTMAN_DAMAGE_COMBAT_PROFILE } from '../src/game/combat/HumanoidModelProfiles.js';
import { FOLSOM_SHOWCASE_COMBAT_CONFIG } from '../src/game/combat/FolsomShowcaseCombatExtras.js';
import { FolsomShowcaseSwordDismemberment } from '../src/game/combat/FolsomShowcaseSwordDismemberment.js';
import { installKnifeWoundManifestForHeadlessTests } from '../src/game/combat/KnifeWoundDecalLibrary.js';
import { folsomDefinition } from '../src/game/locations/folsom.definition.js';
import { buildDungeonCollision } from '../src/engine/dungeon-authoring/DungeonCollisionBuilder.js';
import { EquipmentRuntime } from '../src/engine/equipment/EquipmentRuntime.js';
import { equipmentRegistry } from '../src/game/equipment/equipmentRegistry.js';
import { startingEquipment } from '../src/game/equipment/startingEquipment.js';
import { GameState } from '../src/game/GameState.js';
import { Interactions } from '../src/game/Interactions.js';
import { resolveSupportedCombatRuntime } from '../src/game/hosts/FirstPersonViewmodelHost.js';

installKnifeWoundManifestForHeadlessTests(JSON.parse(readFileSync(new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url), 'utf8')));

function createStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

async function createShowcaseEncounter(query = new URLSearchParams()) {
  const scene = new THREE.Scene();
  const collision = new CollisionWorld({
    walkableRects: [{ minX: -18, maxX: 22, minZ: -20, maxZ: 18 }],
    blockerRects: [],
    defaultFloorY: 0.16,
    outdoorTerrainSampler: { sampleOutdoorY: () => 0.16 },
    sourceLocationId: 'folsom',
  });
  const player = { position: new THREE.Vector3(-2, 1.71, -4), yaw: 0 };
  const dungeon = { scene, collision, isPositionInFishingWater: () => false };
  const encounter = await FolsomCombatEncounter.create({ dungeon, player, query });
  return { encounter, collision, player };
}

async function createAuthoredFolsomShowcaseEncounter(query = new URLSearchParams()) {
  const scene = new THREE.Scene();
  const collision = buildDungeonCollision(folsomDefinition).collisionWorld;
  const player = { position: new THREE.Vector3(-2, 1.71, -4), yaw: 0 };
  const dungeon = { scene, collision, definition: folsomDefinition, isPositionInFishingWater: () => false };
  const encounter = await FolsomCombatEncounter.create({ dungeon, player, query });
  return { encounter, collision, player };
}

function inside(position, bounds, margin = 0) {
  return position.x >= bounds.minX + margin && position.x <= bounds.maxX - margin
    && position.z >= bounds.minZ + margin && position.z <= bounds.maxZ - margin;
}

test('default Folsom showcase owns four distinct damage-profile actors on one router', async () => {
  const { encounter, collision, player } = await createAuthoredFolsomShowcaseEncounter();
  const controllers = encounter.getWalkerControllers();
  const actors = [encounter.actor, ...controllers.map((controller) => controller.actor)];
  assert.equal(actors.length, 4);
  assert.equal(controllers.length, 3);
  assert.equal(encounter.showcaseExtras.getWalkerControllers().length, 2);
  assert.ok(actors.every((actor) => actor.visualProfile === TESTMAN_DAMAGE_COMBAT_PROFILE));
  assert.ok(actors.every((actor) => actor.visualProfile.activeDamageSegmentIds.join(',') === 'head_neck,left_elbow,right_elbow'));
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 4);
  assert.equal(encounter.combatRouter.getDiagnostics().colliderCount, actors.reduce((sum, actor) => sum + actor.colliders.size, 0));

  for (const actor of actors) {
    for (const collider of actor.colliders.values()) {
      const point = actor.getBodyWorldPosition(collider.userData?.bodyId ?? 'pelvis');
      const routed = encounter.combatRouter.resolveCollider(collider, point);
      assert.equal(routed?.actor, actor);
    }
  }

  const spawnPoints = [encounter.spawnPosition, ...controllers.map((controller) => controller.position)];
  for (let index = 0; index < spawnPoints.length; index += 1) {
    const point = spawnPoints[index];
    assert.ok(inside(point, FOLSOM_COMBAT_FOOTPRINT, 0.4));
    assert.ok(inside(point, FOLSOM_RAPIER_SUPPORT, 0.35));
    assert.ok(collision.sampleWalkableY(point.x, point.z, point.y));
    assert.equal(collision.getIntersectingBlockers({ x: point.x, y: point.y + 1.55, z: point.z }, 0.48).filter((entry) => entry.type !== 'combatActor').length, 0);
    assert.ok(Math.hypot(point.x - player.position.x, point.z - player.position.z) > 1.1);
    for (let other = index + 1; other < spawnPoints.length; other += 1) assert.ok(point.distanceTo(spawnPoints[other]) > 1.1);
  }

  const diagnostics = encounter.getDiagnostics().folsomShowcase;
  assert.equal(diagnostics.enabled, true);
  assert.equal(diagnostics.totalActorCount, 4);
  assert.equal(diagnostics.livingActorCount, 4);
  assert.equal(diagnostics.additionalWalkerCount, 2);
  assert.equal(diagnostics.damageProfileActorCount, 4);
  const authoredSpawnPoints = spawnPoints.map((point) => point.toArray());
  encounter.reset(player);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 4);
  assert.equal(encounter.getActiveCombatActors().length, 4);
  assert.deepEqual(
    [encounter.spawnPosition, ...encounter.getWalkerControllers().map((controller) => controller.position)].map((point) => point.toArray()),
    authoredSpawnPoints,
  );
  encounter.dispose();
});

test('folsomShowcase=0 removes only the two extra walkers and temporary sword qualification', async () => {
  const { encounter } = await createShowcaseEncounter(new URLSearchParams('folsomShowcase=0'));
  assert.equal(encounter.showcaseEnabled, false);
  assert.equal(encounter.getWalkerControllers().length, 1);
  assert.equal(encounter.getActiveCombatActors().length, 2);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 2);
  assert.ok(encounter.getActiveCombatActors().every((actor) => actor.visualProfile === TESTMAN_DAMAGE_COMBAT_PROFILE));
  encounter.dispose();
});

test('all four Folsom actors own independent death, voice, corpse cleanup, and wave replacement', async () => {
  const { encounter, collision } = await createShowcaseEncounter();
  const firstActors = [encounter.actor, ...encounter.getWalkerControllers().map((controller) => controller.actor)];
  const firstActorIds = firstActors.map((actor) => actor.instanceId);
  assert.equal(new Set(firstActorIds).size, 4);
  assert.equal(encounter.acceptedCombatAudio.actorStates.size, 4);

  encounter.stationaryDeathController.forceQualifyingStab('upper_chest');
  encounter.stationaryDeathController.forceQualifyingStab('abdomen');
  encounter.getWalkerControllers().forEach((controller) => {
    controller.forceQualifyingStab();
    controller.forceQualifyingStab();
  });
  assert.ok(Object.values(encounter.enemyWaveCorpses).every((slot) => slot.despawned === false));
  for (let frame = 0; frame < 200; frame += 1) encounter.updateEnemyWaveLifecycle(0.05);
  assert.ok(Object.values(encounter.enemyWaveCorpses).every((slot) => slot.despawned === true));
  assert.equal(encounter.actor, null);
  assert.ok(encounter.getWalkerControllers().every((controller) => controller.actor === null));
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 0);
  assert.equal(encounter.acceptedCombatAudio.actorStates.size, 0);
  assert.equal(collision.blockerRects.filter((entry) => entry.type === 'combatActor').length, 0);
  assert.ok(firstActors.every((actor) => actor.disposed && actor.bodies.size === 0 && actor.colliders.size === 0));

  for (let frame = 0; frame < 40; frame += 1) encounter.updateEnemyWaveLifecycle(0.05);
  const replacements = [encounter.actor, ...encounter.getWalkerControllers().map((controller) => controller.actor)];
  assert.equal(replacements.length, 4);
  assert.ok(replacements.every(Boolean));
  assert.ok(replacements.every((actor) => !firstActorIds.includes(actor.instanceId)));
  assert.ok(replacements.every((actor) => actor.visualProfile === TESTMAN_DAMAGE_COMBAT_PROFILE));
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 4);
  assert.equal(encounter.acceptedCombatAudio.actorStates.size, 4);
  encounter.reset();
  assert.equal(encounter.getActiveCombatActors().length, 4);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 4);
  encounter.dispose();
  encounter.dispose();
  assert.equal(collision.blockerRects.filter((entry) => entry.type === 'combatActor').length, 0);
});

test('stationary Testman and all three walkers share corrected two-hit sword thrust mortality', async () => {
  const { encounter } = await createShowcaseEncounter();
  const slots = [
    { actor: encounter.actor, controller: encounter.stationaryDeathController },
    ...encounter.getWalkerControllers().map((controller) => ({ actor: controller.actor, controller })),
  ];
  for (const [actorIndex, { actor, controller }] of slots.entries()) {
    for (let hitIndex = 0; hitIndex < 10; hitIndex += 1) {
      const wound = {
        id: `folsom-sword-${actorIndex}-${hitIndex}`,
        interactionKind: 'sword_thrust',
        weaponId: 'dreadstone_sword',
        weaponFamily: 'sword',
        deliberateStab: true,
        surfaceRuptured: true,
        regionId: 'upper_chest',
        maximumDepth: 0.08,
        targetLifeStateAtCreation: 'alive',
        targetWasDeadAtCreation: false,
      };
      const accepted = controller.lethality.evaluate([wound]);
      if (accepted.length) controller.handleQualifyingStabChange();
    }
    assert.equal(controller.lethality.criticalStabCount, 2);
    assert.equal(controller.lethality.locked, true);
    assert.equal(actor.lifeState, 'dying');
  }
  assert.equal(encounter.getLivingCombatActors().length, 0);
  assert.equal(encounter.getContactableCombatActors().length, 4);
  encounter.dispose();
});

test('fatal authored head consequences enter the existing Folsom corpse lifecycle', async () => {
  const { encounter } = await createShowcaseEncounter();
  const stationary = encounter.actor;
  const walkerController = encounter.getWalkerControllers()[1];
  const walker = walkerController.actor;
  assert.equal(stationary.requestFatalSegmentDetachment({ segmentId: 'head_neck', cause: 'test' }), true);
  encounter.stationaryDeathController.prepareFrame(0.01);
  assert.equal(stationary.lifeState, 'dying');
  assert.equal(encounter.stationaryDeathController.state, 'LOSING_CONSCIOUSNESS');
  assert.equal(encounter.combatRouter.getDirector(stationary), encounter.combatDirector);
  assert.equal(encounter.getContactableCombatActors().includes(stationary), true);
  assert.equal(walker.requestFatalSegmentDetachment({ segmentId: 'head_neck', cause: 'test' }), true);
  walkerController.prepareFrame(0.01, encounter.player);
  assert.equal(walker.lifeState, 'dying');
  assert.equal(walkerController.state, 'LOSING_CONSCIOUSNESS');
  assert.equal(encounter.combatRouter.getDirector(walker), walkerController.director);
  assert.equal(encounter.getContactableCombatActors().includes(walker), true);
  encounter.dispose();
});

function makeDamageActor(id, seamBySegment = {}) {
  const requests = [];
  const activeSegments = ['head_neck', 'left_elbow', 'right_elbow'];
  const actor = {
    instanceId: id,
    lifeState: 'alive',
    visualProfile: { activeDamageSegmentIds: activeSegments },
    visualAdapter: {
      damageSegmentRuntime: {
        validation: { diagnostics: { requiredObjectsResolved: true } },
        segmentStates: new Map(activeSegments.map((segmentId) => [segmentId, {}])),
      },
    },
    getBodyWorldPosition: () => new THREE.Vector3(0, 1.2, 0),
    getDetachmentWorldPoint(segmentId, target) { return target.copy(seamBySegment[segmentId] ?? new THREE.Vector3()); },
    requestDetachment(request) { requests.push(request); return { accepted: true, segmentId: request.segmentId }; },
  };
  return { actor, requests };
}

function attempt(adapter, actorFixture, { bodyId, regionId, point, primitiveName = 'leftEdge', edgeSpeed = 1.2, lateralRatio = 0.8, travel = 0.12 } = {}) {
  return adapter.attemptContact({
    controller: { config: { minimumAttackSpeed: 0.05 } },
    routed: { actor: actorFixture.actor, hit: { bodyId, regionId } },
    point,
    edgeMotion: new THREE.Vector3(0.12, 0.01, 0),
    primitiveName,
    edgeSpeed,
    lateralRatio,
    swingTravel: travel,
    deliberateSpeed: 1,
  });
}

function armedAdapter() {
  const adapter = new FolsomShowcaseSwordDismemberment();
  adapter.beginGesture({ pointerId: 1 });
  return adapter;
}

test('showcase sword intent rejects passive, return, thrust, non-edge, and weak contacts', () => {
  const fixture = makeDamageActor('intent-target', { head_neck: new THREE.Vector3(0, 1.6, 0) });
  const passive = armedAdapter();
  const primitive = (name) => ({ name, previousStart: new THREE.Vector3(), previousEnd: new THREE.Vector3(0, 0, -1), currentStart: new THREE.Vector3(), currentEnd: new THREE.Vector3(0, 0, -1), scratch: { selectedPrevious: new THREE.Vector3(), selectedCurrent: new THREE.Vector3() } });
  const passiveController = {
    gripPointerId: 1, state: 'attacking', deliberateInputVelocity: new THREE.Vector3(), primitives: { leftEdge: primitive('leftEdge'), rightEdge: primitive('rightEdge') },
    isEquipped: () => true, physics: { prepareWeaponSweepBatch: () => true }, sweepPrimitive: () => { throw new Error('passive overlap must not sweep'); },
  };
  assert.equal(passive.update({ controller: passiveController, dt: 1 / 60, contactActive: true, intentionalState: true, deliberateEnergy: false, embedded: false }), false);
  passiveController.state = 'returning';
  assert.equal(passive.update({ controller: passiveController, dt: 1 / 60, contactActive: true, intentionalState: true, deliberateEnergy: true, embedded: false }), false);
  assert.equal(fixture.requests.length, 0);

  assert.equal(attempt(armedAdapter(), fixture, { bodyId: 'neck', regionId: 'neck', point: new THREE.Vector3(0, 1.6, 0), lateralRatio: 0.1 }), false, 'forward thrust ratio is rejected');
  for (const primitiveName of ['flat', 'spine', 'guard', 'grip']) {
    assert.equal(attempt(armedAdapter(), fixture, { bodyId: 'neck', regionId: 'neck', point: new THREE.Vector3(0, 1.6, 0), primitiveName }), false);
  }
  assert.equal(attempt(armedAdapter(), fixture, { bodyId: 'neck', regionId: 'neck', point: new THREE.Vector3(0, 1.6, 0), edgeSpeed: 0.4 }), false);
  assert.equal(fixture.requests.length, 0);
});

test('committed lateral edge motion routes the earliest edge contact into one candidate', () => {
  const fixture = makeDamageActor('committed-edge-target', { head_neck: new THREE.Vector3(0.12, 1.55, 0) });
  const adapter = armedAdapter();
  const makePrimitive = (name, offset = 0) => ({
    name,
    previousStart: new THREE.Vector3(0, 1.55, offset),
    previousEnd: new THREE.Vector3(0, 1.55, offset - 0.7),
    currentStart: new THREE.Vector3(0.12, 1.55, offset),
    currentEnd: new THREE.Vector3(0.12, 1.55, offset - 0.7),
    scratch: { selectedPrevious: new THREE.Vector3(0, 1.55, 0), selectedCurrent: new THREE.Vector3(0.12, 1.55, 0) },
  });
  const leftEdge = makePrimitive('leftEdge');
  const rightEdge = makePrimitive('rightEdge', 0.02);
  const collider = { handle: 42 };
  const controller = {
    gripPointerId: 1,
    state: 'attacking',
    deliberateInputVelocity: new THREE.Vector3(1.2, 0, 0),
    primitives: { leftEdge, rightEdge },
    config: { minimumAttackSpeed: 0.05 },
    isEquipped: () => true,
    physics: { prepareWeaponSweepBatch: () => true },
    sweepPrimitive: (primitive) => ({
      hit: { collider, witness1: { x: 0.12, y: 1.55, z: 0 } },
      toi: primitive.name === 'leftEdge' ? 0.2 : 0.6,
      anchorDistance: 0,
    }),
    weaponContactRouter: { resolveTarget: () => ({ actor: fixture.actor, hit: { bodyId: 'neck', regionId: 'neck' } }) },
  };
  assert.equal(adapter.update({ controller, dt: 0.1, contactActive: true, intentionalState: true, deliberateEnergy: true, embedded: false }), true);
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].segmentId, 'head_neck');
  assert.ok(adapter.getDiagnostics().swingEdgeSpeed >= FOLSOM_SHOWCASE_COMBAT_CONFIG.minimumSwordEdgeSpeed);
  assert.ok(adapter.getDiagnostics().swingTravel >= FOLSOM_SHOWCASE_COMBAT_CONFIG.minimumSwordAccumulatedEdgeTravel);
});

test('showcase sword uses authored neck and elbow seams and rejects badly aimed contacts', () => {
  const cases = [
    { bodyId: 'neck', regionId: 'neck', segmentId: 'head_neck', seam: new THREE.Vector3(0, 1.55, 0), point: new THREE.Vector3(0.12, 1.55, 0), accepted: true },
    { bodyId: 'head', regionId: 'skull', segmentId: 'head_neck', seam: new THREE.Vector3(0, 1.55, 0), point: new THREE.Vector3(0, 1.83, 0), accepted: false },
    { bodyId: 'left_forearm', regionId: 'arm_left_bot', segmentId: 'left_elbow', seam: new THREE.Vector3(-0.42, 1.25, 0), point: new THREE.Vector3(-0.34, 1.25, 0), accepted: true },
    { bodyId: 'right_upper_arm', regionId: 'arm_right_top', segmentId: 'right_elbow', seam: new THREE.Vector3(0.42, 1.25, 0), point: new THREE.Vector3(0.5, 1.25, 0), accepted: true },
    { bodyId: 'left_hand', regionId: 'arm_left_hand', segmentId: 'left_elbow', seam: new THREE.Vector3(-0.42, 1.25, 0), point: new THREE.Vector3(-0.78, 0.95, 0), accepted: false },
    { bodyId: 'upper_chest', regionId: 'upper_chest', segmentId: null, seam: new THREE.Vector3(), point: new THREE.Vector3(0, 1.3, 0), accepted: false },
  ];
  cases.forEach((entry, index) => {
    const fixture = makeDamageActor(`seam-target-${index}`, entry.segmentId ? { [entry.segmentId]: entry.seam } : {});
    const adapter = armedAdapter();
    assert.equal(attempt(adapter, fixture, entry), entry.accepted);
    assert.equal(fixture.requests.length, entry.accepted ? 1 : 0);
    if (entry.accepted) {
      assert.equal(fixture.requests[0].segmentId, entry.segmentId);
      assert.equal(fixture.requests[0].cause, 'folsom_showcase_sword_sweep');
    }
    if (!entry.accepted && entry.segmentId && entry.bodyId !== 'left_hand') assert.equal(adapter.getDiagnostics().lastResult, 'rejected_seam_distance');
  });
});

test('dying actors remain eligible for accurate neck and elbow detachments only until grounded', () => {
  const neck = makeDamageActor('dying-neck', { head_neck: new THREE.Vector3(0, 1.55, 0) });
  neck.actor.lifeState = 'dying';
  neck.actor.combatContactState = 'dying';
  assert.equal(attempt(armedAdapter(), neck, {
    bodyId: 'neck',
    regionId: 'neck',
    point: new THREE.Vector3(0.08, 1.55, 0),
  }), true);
  assert.equal(neck.requests.length, 1);
  assert.equal(neck.requests[0].segmentId, 'head_neck');

  const elbow = makeDamageActor('dying-elbow', { left_elbow: new THREE.Vector3(-0.42, 1.25, 0) });
  elbow.actor.lifeState = 'dying';
  elbow.actor.combatContactState = 'dying';
  const elbowAdapter = armedAdapter();
  assert.equal(attempt(elbowAdapter, elbow, {
    bodyId: 'left_forearm',
    regionId: 'arm_left_bot',
    point: new THREE.Vector3(-0.36, 1.25, 0),
  }), true);
  assert.equal(elbow.requests[0].segmentId, 'left_elbow');
  assert.equal(attempt(elbowAdapter, elbow, {
    bodyId: 'left_forearm',
    regionId: 'arm_left_bot',
    point: new THREE.Vector3(-0.36, 1.25, 0),
  }), false, 'one swing cannot repeat a segment consequence on the same actor');

  for (const state of [
    { lifeState: 'dead', combatContactState: 'grounded' },
    { lifeState: 'dying', combatContactState: 'grounded' },
    { lifeState: 'dead', combatContactState: 'disposed', disposed: true },
  ]) {
    const grounded = makeDamageActor(`ineligible-${state.combatContactState}`, { head_neck: new THREE.Vector3(0, 1.55, 0) });
    Object.assign(grounded.actor, state);
    assert.equal(attempt(armedAdapter(), grounded, {
      bodyId: 'neck',
      regionId: 'neck',
      point: new THREE.Vector3(0.08, 1.55, 0),
    }), false);
    assert.equal(grounded.requests.length, 0);
  }
});

test('showcase sword resolves once per actor and caps a gesture at two actors', () => {
  const adapter = armedAdapter();
  const swingOne = adapter.activeSwingId;
  const first = makeDamageActor('cap-one', { head_neck: new THREE.Vector3(0, 1.5, 0) });
  const second = makeDamageActor('cap-two', { left_elbow: new THREE.Vector3(-0.4, 1.2, 0) });
  const third = makeDamageActor('cap-three', { right_elbow: new THREE.Vector3(0.4, 1.2, 0) });
  assert.equal(attempt(adapter, first, { bodyId: 'neck', regionId: 'neck', point: new THREE.Vector3(0.05, 1.5, 0) }), true);
  assert.equal(attempt(adapter, first, { bodyId: 'left_forearm', regionId: 'arm_left_bot', point: new THREE.Vector3(-0.4, 1.2, 0) }), false);
  assert.equal(attempt(adapter, second, { bodyId: 'left_forearm', regionId: 'arm_left_bot', point: new THREE.Vector3(-0.4, 1.2, 0) }), true);
  assert.equal(attempt(adapter, third, { bodyId: 'right_forearm', regionId: 'arm_right_bot', point: new THREE.Vector3(0.4, 1.2, 0) }), false);
  assert.equal(adapter.getDiagnostics().actorsResolvedThisSwing.length, 2);
  assert.equal(adapter.getDiagnostics().actorCapPerGesture, 2);
  adapter.endGesture('pointer-release');
  const swingTwo = adapter.beginGesture({ pointerId: 2 });
  assert.notEqual(swingTwo, swingOne);
  assert.equal(attempt(adapter, third, { bodyId: 'right_forearm', regionId: 'arm_right_bot', point: new THREE.Vector3(0.4, 1.2, 0) }), true);
});

test('Folsom mace chest is unique, walkable, persistent, and preserves other right-hand items', () => {
  const maceChests = folsomDefinition.outdoorChests.filter((chest) => chest.id === 'folsom_courtyard_mace_chest');
  assert.equal(maceChests.length, 1);
  const maceChest = maceChests[0];
  const swordChest = folsomDefinition.outdoorChests.find((chest) => chest.id === 'folsom_courtyard_sword_chest');
  const playerStart = folsomDefinition.spawns.find((spawn) => spawn.id === 'folsom_player_start').position;
  assert.equal(maceChest.itemId, 'dreadstone_mace');
  assert.equal(maceChest.label, 'Courtyard Mace Chest');
  assert.equal(maceChest.acquiredMessage, 'Dreadmace Acquired.');
  assert.ok(Math.hypot(maceChest.position.x - swordChest.position.x, maceChest.position.z - swordChest.position.z) > 2);
  assert.ok(Math.hypot(maceChest.position.x - playerStart.x, maceChest.position.z - playerStart.z) < 6);
  const collision = buildDungeonCollision(folsomDefinition).collisionWorld;
  assert.equal(collision.canStandAt(new THREE.Vector3(maceChest.position.x, 1.55, maceChest.position.z)), true);
  assert.equal(collision.getIntersectingBlockers(new THREE.Vector3(maceChest.position.x, 1.55, maceChest.position.z), 0.8).length, 0);

  const storage = createStorage();
  const gameState = new GameState(storage);
  const equipmentRuntime = new EquipmentRuntime({ weaponProfiles: equipmentRegistry.weapons, startingEquipment });
  equipmentRuntime.acquireItem('old_work_knife', { source: 'test' });
  equipmentRuntime.acquireItem('dreadstone_sword', { source: 'test' });
  const interaction = { ...maceChest, type: 'fieldSurvivalChest', hint: 'Open chest', message: 'Chest opened.' };
  const dungeon = { gameState, fieldSurvivalObjects: new Map() };
  const hud = { showHint() {}, showMessage() {}, updateFieldKitStatus() {} };
  const interactions = new Interactions({ player: { position: new THREE.Vector3() }, dungeon, hud, equipmentRuntime });
  assert.equal(gameState.hasFieldItem('dreadstone_mace'), false);
  interactions.useFieldSurvivalChest(interaction);
  interactions.useFieldSurvivalChest(interaction);
  interactions.useFieldSurvivalChest(interaction);
  assert.equal(equipmentRuntime.getInventoryItems().find((item) => item.id === 'dreadstone_mace')?.quantity, 1);
  assert.equal(equipmentRuntime.hasItem('dreadstone_mace'), true);
  assert.equal(equipmentRuntime.hasItem('dreadstone_sword'), true);
  assert.equal(equipmentRuntime.hasItem('old_work_knife'), true);
  assert.equal(interactions.survivalInventory.equipWeapon('dreadstone_mace'), true);
  assert.equal(equipmentRuntime.getEquippedWeaponProfile().id, 'dreadstone_mace');
  assert.equal(gameState.hasLootedFieldChest(maceChest.id), true);

  const restoredState = new GameState(storage);
  const restoredEquipment = new EquipmentRuntime({ weaponProfiles: equipmentRegistry.weapons, startingEquipment });
  const restoredInteractions = new Interactions({ player: { position: new THREE.Vector3() }, dungeon: { gameState: restoredState, fieldSurvivalObjects: new Map() }, hud, equipmentRuntime: restoredEquipment });
  assert.equal(restoredInteractions.survivalInventory.hasItem('dreadstone_mace'), true);
  assert.equal(restoredEquipment.getEquippedWeaponProfile().id, 'dreadstone_mace');
  assert.equal(startingEquipment.acquiredItemIds.includes('dreadstone_mace'), false);
});

test('showcase configuration remains in the requested tuning bands and waist stays inactive', () => {
  assert.equal(FOLSOM_SHOWCASE_COMBAT_CONFIG.enabled, true);
  assert.equal(FOLSOM_SHOWCASE_COMBAT_CONFIG.additionalWalkerCount, 2);
  assert.equal(FOLSOM_SHOWCASE_COMBAT_CONFIG.swordDismembermentEnabled, true);
  assert.ok(FOLSOM_SHOWCASE_COMBAT_CONFIG.minimumSwordEdgeSpeed >= 0.75 && FOLSOM_SHOWCASE_COMBAT_CONFIG.minimumSwordEdgeSpeed <= 0.95);
  assert.ok(FOLSOM_SHOWCASE_COMBAT_CONFIG.minimumSwordLateralMotionRatio >= 0.62 && FOLSOM_SHOWCASE_COMBAT_CONFIG.minimumSwordLateralMotionRatio <= 0.72);
  assert.ok(FOLSOM_SHOWCASE_COMBAT_CONFIG.minimumSwordAccumulatedEdgeTravel >= 0.08 && FOLSOM_SHOWCASE_COMBAT_CONFIG.minimumSwordAccumulatedEdgeTravel <= 0.12);
  assert.deepEqual(FOLSOM_SHOWCASE_COMBAT_CONFIG.maximumSwordSeamDistance, { head_neck: 0.18, left_elbow: 0.16, right_elbow: 0.16 });
  assert.equal(FOLSOM_SHOWCASE_COMBAT_CONFIG.maximumSwordDetachmentsPerGesture, 2);
  assert.equal(TESTMAN_DAMAGE_COMBAT_PROFILE.activeDamageSegmentIds.includes('lower_spine'), false);
});

test('combat mace runtime is available only for Combat Lab and Folsom and cannot request detachment', () => {
  const lab = { isCombatLab: true };
  const folsomCombat = { id: 'folsom-combat' };
  assert.equal(resolveSupportedCombatRuntime(lab), lab);
  assert.equal(resolveSupportedCombatRuntime({ isCombatLab: false, combatEncounter: folsomCombat }), folsomCombat);
  assert.equal(resolveSupportedCombatRuntime({ isCombatLab: false }), null);
  const hostSource = readFileSync(new URL('../src/game/hosts/FirstPersonViewmodelHost.js', import.meta.url), 'utf8');
  const maceSource = readFileSync(new URL('../src/game/combat/weapons/MaceWorldWeaponController.js', import.meta.url), 'utf8');
  assert.match(hostSource, /this\.combatMaceController = combatRuntime/);
  assert.doesNotMatch(maceSource, /requestDetachment|folsom_showcase_sword_sweep/);
});
