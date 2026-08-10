import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';

import {
  ENCOUNTER_DEFINITION_SCHEMA,
  ENCOUNTER_DEFINITION_VERSION,
  parseEncounterDefinition,
  serializeEncounterDefinition,
  validateEncounterDefinition,
} from '../src/contracts/EncounterDefinition.js';
import { CombatActorRouter } from '../src/game/combat/CombatActorRouter.js';
import { PlayerCombatDamageReceiver } from '../src/game/combat/PlayerCombatDamageReceiver.js';
import { PlayerCombatState } from '../src/game/combat/PlayerCombatState.js';
import { PlayerCurrencyState } from '../src/game/economy/PlayerCurrencyState.js';
import { createEnemyRuntimeRewardConfiguration, EnemyLootRuntime } from '../src/game/economy/EnemyLootRuntime.js';
import { EnemyWorldMotionHost } from '../src/game/encounters/EnemyWorldMotionHost.js';
import { EncounterRegistry, EncounterRegistryError, PRODUCTION_ENCOUNTER_DEFINITIONS } from '../src/game/encounters/EncounterRegistry.js';
import { EncounterRuntimeHost } from '../src/game/encounters/EncounterRuntimeHost.js';
import { EncounterSpawner, EncounterSpawnerError } from '../src/game/encounters/EncounterSpawner.js';
import { M9_FOLSOM_TWO_RAM_GODS_PROOF } from '../src/game/encounters/EncounterDevFixtures.js';

function spawn(overrides = {}) {
  return {
    spawnId: 'test_enemy_01',
    presetId: 'test_preset',
    transform: { position: [1.25, 0.5, -3.75], yaw: 1.2 },
    homeRadius: 8,
    ...overrides,
  };
}

function encounter(overrides = {}) {
  return {
    schema: ENCOUNTER_DEFINITION_SCHEMA,
    version: ENCOUNTER_DEFINITION_VERSION,
    encounterId: 'test_encounter',
    displayName: 'Test Encounter',
    locationId: 'folsom',
    spawns: [spawn()],
    ...overrides,
  };
}

function resolvedPreset(presetId = 'test_preset') {
  return Object.freeze({
    preset: Object.freeze({ presetId }),
    definition: Object.freeze({ definitionId: 'test_definition' }),
    pack: Object.freeze({ packId: 'test_pack' }),
    profile: Object.freeze({ targetHeight: 1.8 }),
    loadout: Object.freeze({ loadoutId: 'test_loadout', mainHandWeaponId: 'test_weapon' }),
    weapon: Object.freeze({ weaponId: 'test_weapon' }),
    compatibleActions: Object.freeze([Object.freeze({ combatActionId: 'test_action' })]),
    lootProfile: Object.freeze({ lootProfileId: 'test_loot', currency: Object.freeze({ gold: Object.freeze({ mode: 'FIXED', amount: 12 }) }) }),
  });
}

function fakeServices(overrides = {}) {
  return {
    locationId: 'folsom',
    scene: {},
    physics: {},
    combatRouter: new CombatActorRouter(),
    collision: {},
    playerProvider: () => ({ position: new THREE.Vector3() }),
    playerDamageReceiverProvider: () => ({}),
    playerCombatState: new PlayerCombatState(),
    playerCurrencyState: new PlayerCurrencyState(),
    ...overrides,
  };
}

function createFakeEnemyFactory({ failAt = null, captures = [] } = {}) {
  let serial = 0;
  return async (options) => {
    if (failAt != null && captures.length === failAt) throw new Error('injected construction failure');
    const enemy = {
      spawnId: options.spawnRecord.spawnId,
      presetId: options.spawnRecord.presetId,
      actor: { instanceId: `fake-actor-${++serial}`, lifeState: 'alive' },
      brain: {},
      armamentRuntime: {},
      lootRuntime: {},
      disposed: false,
      updates: 0,
      update() { this.updates += 1; },
      beforePhysics() {},
      afterPhysicsStep() {},
      afterPhysics() {},
      isContactable() { return !this.disposed && this.actor.lifeState === 'alive'; },
      getDiagnostics() {
        return {
          spawnId: this.spawnId,
          presetId: this.presetId,
          actorInstanceId: this.actor.instanceId,
          brainState: 'IDLE',
          lifeState: this.actor.lifeState,
          lootState: 'unavailable',
          distanceToHome: 0,
        };
      },
      dispose() { this.disposed = true; },
    };
    captures.push({ options, enemy });
    return enemy;
  };
}

test('valid Encounter Definition v1 accepts exact JSON production fields', () => {
  assert.deepEqual(validateEncounterDefinition(encounter()), { valid: true, errors: [] });
});

test('malformed top-level encounter and unsupported schema/version are rejected', () => {
  assert.equal(validateEncounterDefinition(null).valid, false);
  assert.equal(validateEncounterDefinition({ ...encounter(), schema: 'wrong', version: 2 }).valid, false);
});

test('unexpected top-level and spawn fields are rejected', () => {
  assert.match(validateEncounterDefinition({ ...encounter(), actor: {} }).errors.join(' '), /actor is not part/);
  assert.match(validateEncounterDefinition(encounter({ spawns: [spawn({ weaponAssetPath: 'wrong' })] })).errors.join(' '), /weaponAssetPath is not part/);
});

test('malformed spawn records are rejected', () => {
  assert.equal(validateEncounterDefinition(encounter({ spawns: [null] })).valid, false);
  assert.equal(validateEncounterDefinition(encounter({ spawns: [spawn({ spawnId: 'Bad ID' })] })).valid, false);
  assert.equal(validateEncounterDefinition(encounter({ spawns: [spawn({ presetId: '' })] })).valid, false);
});

test('position must be exactly one finite three-vector', () => {
  for (const position of [[1, 2], [1, 2, 3, 4], [1, NaN, 3], new THREE.Vector3(1, 2, 3)]) {
    assert.equal(validateEncounterDefinition(encounter({ spawns: [spawn({ transform: { position, yaw: 0 } })] })).valid, false);
  }
});

test('yaw must be finite and placement cannot add scale or Euler rotation', () => {
  assert.equal(validateEncounterDefinition(encounter({ spawns: [spawn({ transform: { position: [0, 0, 0], yaw: Infinity } })] })).valid, false);
  assert.equal(validateEncounterDefinition(encounter({ spawns: [spawn({ transform: { position: [0, 0, 0], yaw: 0, scale: 2 } })] })).valid, false);
});

test('homeRadius must be finite and positive', () => {
  for (const homeRadius of [0, -1, Infinity, NaN]) assert.equal(validateEncounterDefinition(encounter({ spawns: [spawn({ homeRadius })] })).valid, false);
});

test('rewardOverride is optional and only accepts one positive safe integer gold amount', () => {
  assert.equal(validateEncounterDefinition(encounter({ spawns: [spawn({ rewardOverride: { gold: 27 } })] })).valid, true);
  for (const rewardOverride of [{ gold: 0 }, { gold: -1 }, { gold: 1.5 }, { gold: Number.MAX_SAFE_INTEGER + 1 }, { gold: 2, items: [] }, {}]) {
    assert.equal(validateEncounterDefinition(encounter({ spawns: [spawn({ rewardOverride })] })).valid, false);
  }
});

test('duplicate spawnId inside one encounter fails validation', () => {
  const definition = encounter({ spawns: [spawn(), spawn({ presetId: 'another_preset' })] });
  assert.match(validateEncounterDefinition(definition).errors.join(' '), /duplicates authored spawnId/);
});

test('canonical serialization has fixed field order, eight-place numeric normalization, and stable round trip', () => {
  const definition = encounter({ spawns: [spawn({ transform: { position: [-0, 0.1234567894, 4], yaw: Math.PI }, homeRadius: 8.123456789 })] });
  const first = serializeEncounterDefinition(definition);
  const second = serializeEncounterDefinition(parseEncounterDefinition(first));
  assert.equal(first, second);
  assert.ok(first.indexOf('"schema"') < first.indexOf('"encounterId"'));
  assert.match(first, /0\.12345679/);
  assert.doesNotMatch(first, /-0[,\n]/);
});

test('serialization rejects runtime-only fields instead of leaking them', () => {
  assert.throws(() => serializeEncounterDefinition({ ...encounter(), runtime: { actor: {} } }), /runtime is not part/);
});

test('EncounterRegistry clones, freezes, resolves, and filters records by real locationId', () => {
  const source = encounter();
  const registry = new EncounterRegistry({ encounters: [source] });
  source.displayName = 'Mutated outside';
  const registered = registry.getEncounter('test_encounter');
  assert.equal(registered.displayName, 'Test Encounter');
  assert.equal(Object.isFrozen(registered), true);
  assert.equal(Object.isFrozen(registered.spawns[0].transform.position), true);
  assert.deepEqual(registry.listByLocation('folsom'), [registered]);
  assert.deepEqual(registry.listByLocation('north-road'), []);
  assert.throws(() => registry.getEncounter('missing'), (error) => error instanceof EncounterRegistryError && error.code === 'UNKNOWN_ENCOUNTER');
});

test('EncounterRegistry rejects duplicate encounterId', () => {
  assert.throws(() => new EncounterRegistry({ encounters: [encounter(), encounter()] }), (error) => error.code === 'DUPLICATE_ENCOUNTER');
});

test('EncounterRegistry rejects duplicate global spawnId across encounters', () => {
  const other = encounter({ encounterId: 'other_encounter', spawns: [spawn()] });
  assert.throws(() => new EncounterRegistry({ encounters: [encounter(), other] }), (error) => error.code === 'DUPLICATE_GLOBAL_SPAWN');
});

test('production Encounter registry data begins empty and dev fixture remains separate', () => {
  assert.deepEqual(PRODUCTION_ENCOUNTER_DEFINITIONS, []);
  assert.equal(M9_FOLSOM_TWO_RAM_GODS_PROOF.spawns.length, 2);
});

test('registry preflight fails closed on an unknown Enemy Preset reference', async () => {
  const registry = new EncounterRegistry({ encounters: [encounter()] });
  await assert.rejects(registry.preflight('test_encounter', { resolve: async () => { throw new Error('unknown preset'); } }), (error) => error.code === 'UNKNOWN_PRESET_REFERENCE');
});

test('EncounterSpawner preflights through EnemyPresetResolver before constructing anything', async () => {
  const calls = [];
  const captures = [];
  const spawner = new EncounterSpawner({
    enemyPresetResolver: { creatureFactory: {}, resolve: async (presetId) => { calls.push(presetId); return resolvedPreset(presetId); } },
    creatureFactory: {},
    enemyRuntimeFactory: createFakeEnemyFactory({ captures }),
  });
  const definition = encounter({ spawns: [spawn(), spawn({ spawnId: 'test_enemy_02', transform: { position: [4, 0, 2], yaw: -1 }, homeRadius: 12 })] });
  const runtime = await spawner.spawn(definition, fakeServices());
  assert.deepEqual(calls, ['test_preset']);
  assert.equal(captures.length, 2);
  assert.equal(runtime.enemies.length, 2);
});

test('Spawner preserves authored position, yaw, home radius, stable spawn IDs, and separate runtime identities', async () => {
  const captures = [];
  const spawner = new EncounterSpawner({
    enemyPresetResolver: { creatureFactory: {}, resolve: async () => resolvedPreset() },
    creatureFactory: {},
    enemyRuntimeFactory: createFakeEnemyFactory({ captures }),
  });
  const definition = encounter({ spawns: [spawn(), spawn({ spawnId: 'test_enemy_02', transform: { position: [9, 2, -7], yaw: -2.4 }, homeRadius: 13 })] });
  const runtime = await spawner.spawn(definition, fakeServices());
  assert.deepEqual(captures[1].options.spawnRecord.transform.position, [9, 2, -7]);
  assert.equal(captures[1].options.spawnRecord.transform.yaw, -2.4);
  assert.equal(captures[1].options.spawnRecord.homeRadius, 13);
  assert.deepEqual(runtime.enemies.map((enemy) => enemy.spawnId), ['test_enemy_01', 'test_enemy_02']);
  assert.equal(new Set(runtime.enemies.map((enemy) => enemy.actor.instanceId)).size, 2);
  assert.notEqual(runtime.enemies[0].brain, runtime.enemies[1].brain);
  assert.notEqual(runtime.enemies[0].armamentRuntime, runtime.enemies[1].armamentRuntime);
  assert.notEqual(runtime.enemies[0].lootRuntime, runtime.enemies[1].lootRuntime);
});

test('EncounterSpawner rejects location mismatch and missing runtime dependencies before mutation', async () => {
  let constructionCount = 0;
  const spawner = new EncounterSpawner({
    enemyPresetResolver: { creatureFactory: {}, resolve: async () => resolvedPreset() },
    creatureFactory: {},
    enemyRuntimeFactory: async () => { constructionCount += 1; },
  });
  await assert.rejects(spawner.spawn(encounter(), fakeServices({ locationId: 'north-road' })), (error) => error instanceof EncounterSpawnerError && error.code === 'LOCATION_MISMATCH');
  await assert.rejects(spawner.spawn(encounter(), fakeServices({ physics: null })), (error) => error.code === 'MISSING_RUNTIME_SERVICES');
  assert.equal(constructionCount, 0);
});

test('transactional construction failure disposes all already-created enemies', async () => {
  const captures = [];
  const spawner = new EncounterSpawner({
    enemyPresetResolver: { creatureFactory: {}, resolve: async () => resolvedPreset() },
    creatureFactory: {},
    enemyRuntimeFactory: createFakeEnemyFactory({ failAt: 1, captures }),
  });
  const definition = encounter({ spawns: [spawn(), spawn({ spawnId: 'test_enemy_02' })] });
  await assert.rejects(spawner.spawn(definition, fakeServices()), (error) => error.code === 'TRANSACTION_FAILED');
  assert.equal(captures[0].enemy.disposed, true);
});

test('EncounterRuntime update, despawn, idempotent dispose, and reset use correct lifecycle', async () => {
  const captures = [];
  const spawner = new EncounterSpawner({
    enemyPresetResolver: { creatureFactory: {}, resolve: async () => resolvedPreset() },
    creatureFactory: {},
    enemyRuntimeFactory: createFakeEnemyFactory({ captures }),
  });
  const runtime = await spawner.spawn(encounter(), fakeServices());
  const firstActorId = runtime.enemies[0].actor.instanceId;
  runtime.update(0.016);
  assert.equal(runtime.enemies[0].updates, 1);
  const reset = await runtime.reset();
  assert.equal(reset.accepted, true);
  assert.equal(captures[0].enemy.disposed, true);
  assert.equal(runtime.enemies[0].spawnId, 'test_enemy_01');
  assert.notEqual(runtime.enemies[0].actor.instanceId, firstActorId);
  assert.equal(runtime.despawn(), 1);
  runtime.dispose();
  runtime.dispose();
  assert.equal(runtime.disposed, true);
});

test('fixed encounter gold override wins without mutating preset profile and cannot pay twice', () => {
  const profile = Object.freeze({ lootProfileId: 'default_profile', currency: Object.freeze({ gold: Object.freeze({ mode: 'FIXED', amount: 12 }) }) });
  const rewardConfiguration = createEnemyRuntimeRewardConfiguration({ lootProfile: profile, fixedGoldOverride: 27, spawnId: 'override_enemy' });
  const actor = { instanceId: 'runtime-1', lifeState: 'dead' };
  const wallet = new PlayerCurrencyState();
  const runtime = new EnemyLootRuntime({ actor, lootProfile: profile, rewardConfiguration, playerCurrencyState: wallet });
  assert.equal(runtime.update(), true);
  assert.equal(runtime.getSnapshot().resolvedGold, 27);
  assert.equal(runtime.getSnapshot().rewardSource, 'encounter-fixed-gold');
  assert.equal(runtime.claim().accepted, true);
  assert.equal(runtime.claim().accepted, false);
  assert.equal(wallet.currentGold, 27);
  assert.equal(profile.currency.gold.amount, 12);
});

test('explicit fixed override works without a preset Loot Profile', () => {
  const actor = { instanceId: 'runtime-2', lifeState: 'dead' };
  const wallet = new PlayerCurrencyState();
  const runtime = new EnemyLootRuntime({
    actor,
    rewardConfiguration: createEnemyRuntimeRewardConfiguration({ fixedGoldOverride: 5, spawnId: 'reward_only_enemy' }),
    playerCurrencyState: wallet,
  });
  assert.equal(runtime.update(), true);
  assert.equal(runtime.claim().accepted, true);
  assert.equal(wallet.currentGold, 5);
});

test('same-preset instance loot and death state remain independent', () => {
  const wallet = new PlayerCurrencyState();
  const firstActor = { instanceId: 'a', lifeState: 'dead' };
  const secondActor = { instanceId: 'b', lifeState: 'alive' };
  const config = createEnemyRuntimeRewardConfiguration({ fixedGoldOverride: 3 });
  const first = new EnemyLootRuntime({ actor: firstActor, rewardConfiguration: config, playerCurrencyState: wallet });
  const second = new EnemyLootRuntime({ actor: secondActor, rewardConfiguration: config, playerCurrencyState: wallet });
  first.update();
  second.update();
  assert.equal(first.claim().accepted, true);
  assert.equal(second.getSnapshot().state, 'unavailable');
  assert.equal(secondActor.lifeState, 'alive');
});

test('CombatActorRouter registers spawned colliders and routes through the existing actor hit path', () => {
  const collider = { handle: 71 };
  const director = { id: 'director' };
  const actor = { instanceId: 'encounter-actor', disposed: false, colliders: new Map([['pelvis', collider]]), colliderRegions: new Map([[71, 'torso']]), resolveHit: () => ({ regionId: 'torso' }) };
  const router = new CombatActorRouter();
  router.register(actor, director);
  assert.equal(router.ownsCollider(collider), true);
  assert.deepEqual(router.resolveCollider(collider, new THREE.Vector3()), { actor, director, hit: { regionId: 'torso' } });
  assert.equal(router.unregister(actor), true);
  assert.equal(router.ownsCollider(collider), false);
});

test('normal game receiver can rebind scenes without duplicating or resetting PlayerCombatState', () => {
  const state = new PlayerCombatState();
  const firstPlayer = { position: new THREE.Vector3(0, 1.6, 0), eyeHeight: 1.6 };
  const secondPlayer = { position: new THREE.Vector3(2, 1.6, 0), eyeHeight: 1.6 };
  const receiver = new PlayerCombatDamageReceiver({ combatState: state, player: firstPlayer });
  state.applyDamage({ amount: 15, attackIdentity: 'proof', source: 'proof' });
  receiver.bindPlayer(secondPlayer);
  receiver.clearAttackOwnership();
  assert.equal(state.currentHealth, 85);
  assert.equal(firstPlayer.combatDamageReceiver, undefined);
  assert.equal(secondPlayer.combatDamageReceiver, receiver);
  assert.equal(receiver.combatState, state);
});

test('Game constructs one normal-session receiver and Creature Lab resolves that same player-bound receiver', async () => {
  const [gameSource, harnessSource] = await Promise.all([
    readFile(new URL('../src/game/Game.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/game/creatures/CreatureLabAttackHarness.js', import.meta.url), 'utf8'),
  ]);
  assert.match(gameSource, /this\.playerCombatDamageReceiver = new PlayerCombatDamageReceiver/);
  assert.doesNotMatch(gameSource, /this\.creatureLabEnabled \? new PlayerCombatDamageReceiver/);
  assert.match(harnessSource, /this\.damageReceiverProvider\?\.\(\)/);
});

test('EnemyWorldMotionHost applies authored pose, samples ground, respects blockers, and releases player collision ownership', () => {
  const blockers = [];
  const actor = {
    instanceId: 'motion-actor',
    visualProfile: { targetHeight: 1.8 },
    setLivingRootTransform(position, yaw) { this.position = position.clone(); this.yaw = yaw; },
    setEnvironmentContactHints() {},
    updatePlayerCollisionBlocker(blocker) { blocker.radius = 0.3; blocker.userData ??= {}; return blocker; },
  };
  const collision = {
    addBlocker(value) { blockers.push(value); },
    removeBlocker(value) { blockers.splice(blockers.indexOf(value), 1); },
    sampleWalkableY() { return { y: 0.5 }; },
    canStandAtFloorPosition() { return true; },
    getIntersectingBlockers() { return []; },
  };
  const host = new EnemyWorldMotionHost({ actor, collision, position: new THREE.Vector3(1, 0.5, 2), yaw: 0.7 });
  assert.deepEqual(actor.position.toArray(), [1, 0.5, 2]);
  assert.equal(actor.yaw, 0.7);
  assert.deepEqual(host.move(new THREE.Vector3(0.5, 0, 0)).toArray(), [0.5, 0, 0]);
  assert.equal(blockers.length, 1);
  host.dispose();
  assert.equal(blockers.length, 0);
});

test('EncounterRuntimeHost activates only matching locations, remains harmless when empty, and cleans scene transitions', async () => {
  const folsom = encounter();
  const northRoad = encounter({ encounterId: 'north_encounter', locationId: 'north-road', spawns: [spawn({ spawnId: 'north_enemy' })] });
  const registry = new EncounterRegistry({ encounters: [folsom, northRoad] });
  const spawned = [];
  const disposed = [];
  const spawner = {
    enemyPresetResolver: { weaponRegistry: {} },
    async spawn(definition) {
      spawned.push(definition.encounterId);
      return {
        encounterId: definition.encounterId,
        enemies: [],
        update() {}, beforePhysics() {}, afterPhysicsStep() {}, afterPhysics() {},
        getContactableActors: () => [],
        getDiagnostics: () => ({ encounterId: definition.encounterId, enemies: [] }),
        dispose: () => disposed.push(definition.encounterId),
      };
    },
  };
  const combatRuntime = { physics: {}, combatRouter: new CombatActorRouter(), attachEncounterRuntimeHost(host) { this.host = host; }, detachEncounterRuntimeHost() { this.host = null; } };
  const dungeon = { scene: {}, collision: {}, combatEncounter: combatRuntime };
  const host = new EncounterRuntimeHost({ registry, spawner });
  await host.initializeForSession({ dungeon, scene: dungeon.scene, locationId: 'folsom' });
  assert.deepEqual(spawned, ['test_encounter']);
  assert.equal(host.getRuntime('north_encounter'), null);
  host.detachSession();
  assert.deepEqual(disposed, ['test_encounter']);
  assert.equal(combatRuntime.host, null);

  const emptyHost = new EncounterRuntimeHost({ registry: new EncounterRegistry(), spawner });
  await emptyHost.initializeForSession({ dungeon, scene: dungeon.scene, locationId: 'folsom' });
  assert.equal(emptyHost.getDiagnostics().activeEncounterCount, 0);
  emptyHost.dispose();
});

test('runtime composition remains on CreatureFactory, NpcArmamentRuntime, MinimalCombatBrain, and EnemyLootRuntime authorities', async () => {
  const source = await readFile(new URL('../src/game/encounters/EncounterEnemyRuntime.js', import.meta.url), 'utf8');
  assert.match(source, /creatureFactory\.createActorFromResolved/);
  assert.match(source, /new NpcArmamentRuntime/);
  assert.match(source, /new MinimalCombatBrain/);
  assert.match(source, /new EnemyLootRuntime/);
  assert.doesNotMatch(source, /GLTFLoader|\.glb/);
});
