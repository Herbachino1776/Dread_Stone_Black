import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  LOOT_GOLD_MODES,
  LOOT_PROFILE_SCHEMA,
  LOOT_PROFILE_VERSION,
  validateLootProfile,
} from '../src/contracts/LootProfile.js';
import {
  ENEMY_PRESET_V1_SCHEMA,
  ENEMY_PRESET_V1_VERSION,
  ENEMY_PRESET_V2_SCHEMA,
  ENEMY_PRESET_V2_VERSION,
  validateEnemyPreset,
} from '../src/contracts/EnemyPreset.js';
import { GameState, PLAYER_CURRENCY_STATE_KEY } from '../src/game/GameState.js';
import { PlayerCurrencyState } from '../src/game/economy/PlayerCurrencyState.js';
import {
  GameStateCurrencyPersistenceAdapter,
  SessionCurrencyPersistenceAdapter,
} from '../src/game/economy/PlayerCurrencyPersistence.js';
import {
  DREAD_RAM_GOD_STANDARD_LOOT_PROFILE,
  LootProfileRegistry,
} from '../src/game/economy/LootProfileRegistry.js';
import { EnemyLootRuntime } from '../src/game/economy/EnemyLootRuntime.js';
import {
  DREAD_RAM_GOD_GREAT_MACE_PRESET,
  EnemyPresetRegistry,
} from '../src/game/creatures/EnemyPresetRegistry.js';
import { EnemyPresetResolver } from '../src/game/creatures/EnemyPresetResolver.js';
import { CreatureDefinitionRegistry } from '../src/game/creatures/CreatureDefinitionRegistry.js';
import { CreatureFactory } from '../src/game/creatures/CreatureFactory.js';
import { CreatureLabController } from '../src/game/creatures/CreatureLabController.js';
import { getCreatureLabLootActions } from '../src/game/creatures/CreatureLabPanel.js';
import { NpcWeaponRegistry } from '../src/game/combat/NpcWeaponRegistry.js';
import { PlayerCombatState } from '../src/game/combat/PlayerCombatState.js';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
    clear: () => values.clear(),
    get length() { return values.size; },
    values,
  };
}

function fixedProfile({ id = 'fixed_gold', amount = 20 } = {}) {
  return {
    schema: LOOT_PROFILE_SCHEMA,
    version: LOOT_PROFILE_VERSION,
    lootProfileId: id,
    displayName: id,
    currency: { gold: { mode: LOOT_GOLD_MODES.fixed, amount } },
  };
}

function rangeProfile({ id = 'range_gold', min = 4, max = 11 } = {}) {
  return {
    schema: LOOT_PROFILE_SCHEMA,
    version: LOOT_PROFILE_VERSION,
    lootProfileId: id,
    displayName: id,
    currency: { gold: { mode: LOOT_GOLD_MODES.range, min, max } },
  };
}

function actor(instanceId = 'enemy-1', lifeState = 'alive') {
  return { instanceId, lifeState, disposed: false };
}

function legacyPreset() {
  const preset = structuredClone(DREAD_RAM_GOD_GREAT_MACE_PRESET);
  preset.schema = ENEMY_PRESET_V1_SCHEMA;
  preset.version = ENEMY_PRESET_V1_VERSION;
  preset.presetId = 'legacy_ram_god';
  delete preset.rewards;
  return preset;
}

const ramPack = JSON.parse(await readFile(new URL('../public/generated/creature-packs/dread_ram_god_damage_v001.json', import.meta.url), 'utf8'));

function ramPackRegistry() {
  return {
    async loadPack(packId) {
      if (packId !== ramPack.packId) throw new Error(`Unknown Creature Pack ${packId}`);
      return ramPack;
    },
  };
}

test('PlayerCurrencyState starts valid and performs exact add/spend/canAfford transactions', () => {
  const wallet = new PlayerCurrencyState({ initialGold: 10 });
  assert.equal(wallet.currentGold, 10);
  assert.equal(wallet.canAfford(10), true);
  assert.deepEqual(wallet.addGold(7), {
    accepted: true,
    transactionId: 1,
    type: 'add',
    amount: 7,
    previousGold: 10,
    currentGold: 17,
    changed: true,
    context: null,
  });
  assert.equal(wallet.spendGold(5).accepted, true);
  assert.equal(wallet.currentGold, 12);
  assert.equal(wallet.canAfford(13), false);
});

test('PlayerCurrencyState rejects invalid amounts, insufficient funds, and overflow without mutation', () => {
  const invalidAmounts = [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1];
  invalidAmounts.forEach((amount) => {
    const wallet = new PlayerCurrencyState({ initialGold: 9 });
    assert.equal(wallet.addGold(amount).accepted, false);
    assert.equal(wallet.spendGold(amount).accepted, false);
    assert.equal(wallet.currentGold, 9);
  });
  const wallet = new PlayerCurrencyState({ initialGold: 9 });
  assert.equal(wallet.spendGold(10).accepted, false);
  assert.equal(wallet.currentGold, 9);
  const full = new PlayerCurrencyState({ initialGold: Number.MAX_SAFE_INTEGER });
  assert.equal(full.addGold(1).reason, 'gold-overflow');
  assert.equal(full.currentGold, Number.MAX_SAFE_INTEGER);
});

test('zero currency operations are accepted no-ops and do not emit mutation snapshots', () => {
  const wallet = new PlayerCurrencyState({ initialGold: 3 });
  const events = [];
  wallet.subscribe((snapshot, event) => events.push({ snapshot, event }), { emitCurrent: false });
  assert.deepEqual(wallet.addGold(0), {
    accepted: true,
    transactionId: null,
    type: 'add',
    amount: 0,
    previousGold: 3,
    currentGold: 3,
    changed: false,
    context: null,
  });
  assert.equal(wallet.spendGold(0).accepted, true);
  assert.equal(events.length, 0);
  assert.equal(wallet.currentGold, 3);
});

test('currency subscribers receive authoritative immutable snapshots', () => {
  const wallet = new PlayerCurrencyState({ initialGold: 2 });
  const events = [];
  wallet.subscribe((snapshot, event) => events.push({ snapshot, event }));
  wallet.addGold(4, { source: 'test' });
  assert.deepEqual(events.map(({ snapshot }) => snapshot.currentGold), [2, 6]);
  assert.equal(events[1].event.type, 'add');
  assert.equal(Object.isFrozen(events[1].snapshot), true);
});

test('a failed currency persistence transaction is atomic', () => {
  const persistenceAdapter = { kind: 'rejecting-test', load: () => ({ version: 1, gold: 8 }), save: () => false };
  const wallet = new PlayerCurrencyState({ persistenceAdapter });
  assert.equal(wallet.addGold(2).reason, 'currency-persistence-failed');
  assert.equal(wallet.spendGold(2).reason, 'currency-persistence-failed');
  assert.equal(wallet.currentGold, 8);
  assert.equal(wallet.getSnapshot().transactionCount, 0);
});

test('normal GameState persistence restores the same authoritative gold in a reconstructed wallet', () => {
  const storage = memoryStorage();
  const firstGameState = new GameState(storage);
  const firstAdapter = new GameStateCurrencyPersistenceAdapter(firstGameState);
  const firstWallet = new PlayerCurrencyState({ persistenceAdapter: firstAdapter });
  assert.equal(firstWallet.currentGold, 0);
  assert.equal(firstWallet.addGold(37).accepted, true);
  const secondWallet = new PlayerCurrencyState({
    persistenceAdapter: new GameStateCurrencyPersistenceAdapter(new GameState(storage)),
  });
  assert.equal(secondWallet.currentGold, 37);
  assert.deepEqual(JSON.parse(storage.getItem(PLAYER_CURRENCY_STATE_KEY)), { version: 1, gold: 37 });
  assert.equal('currentGold' in firstAdapter, false);
});

test('malformed persisted currency repairs to zero and resetAllProgress clears the currency key', () => {
  const malformedRecords = [
    '{bad-json',
    JSON.stringify({ version: 1, gold: -1 }),
    JSON.stringify({ version: 1, gold: 1.2 }),
    JSON.stringify({ version: 2, gold: 8 }),
    JSON.stringify({ version: 1, gold: Number.MAX_SAFE_INTEGER + 1 }),
    JSON.stringify({ version: 1, gold: 3, items: [] }),
  ];
  malformedRecords.forEach((record) => {
    const storage = memoryStorage({ [PLAYER_CURRENCY_STATE_KEY]: record });
    const wallet = new PlayerCurrencyState({
      persistenceAdapter: new GameStateCurrencyPersistenceAdapter(new GameState(storage)),
    });
    assert.equal(wallet.currentGold, 0);
    assert.deepEqual(JSON.parse(storage.getItem(PLAYER_CURRENCY_STATE_KEY)), { version: 1, gold: 0 });
  });
  const storage = memoryStorage({ [PLAYER_CURRENCY_STATE_KEY]: JSON.stringify({ version: 1, gold: 5 }) });
  GameState.resetAllProgress(storage);
  assert.equal(storage.getItem(PLAYER_CURRENCY_STATE_KEY), null);
});

test('Creature Lab session persistence uses the same wallet class without mutating normal saved gold', () => {
  const storage = memoryStorage({ [PLAYER_CURRENCY_STATE_KEY]: JSON.stringify({ version: 1, gold: 91 }) });
  const labAdapter = new SessionCurrencyPersistenceAdapter();
  const labWallet = new PlayerCurrencyState({ persistenceAdapter: labAdapter });
  assert.equal(labWallet.currentGold, 0);
  assert.equal(labWallet.addGold(12).accepted, true);
  assert.equal(labWallet.currentGold, 12);
  assert.deepEqual(JSON.parse(storage.getItem(PLAYER_CURRENCY_STATE_KEY)), { version: 1, gold: 91 });
  assert.equal('currentGold' in labAdapter, false);
});

test('loot profile v1 strictly accepts FIXED and RANGE gold rewards', () => {
  assert.equal(validateLootProfile(fixedProfile()).valid, true);
  assert.equal(validateLootProfile(rangeProfile()).valid, true);
  assert.equal(validateLootProfile(fixedProfile({ amount: 0 })).valid, true);
});

test('loot profile v1 rejects malformed values, modes, unexpected fields, and fake item schema', () => {
  const cases = [];
  const malformedId = fixedProfile(); malformedId.lootProfileId = 'Bad ID'; cases.push(malformedId);
  const negative = fixedProfile(); negative.currency.gold.amount = -1; cases.push(negative);
  const fractional = fixedProfile(); fractional.currency.gold.amount = 1.5; cases.push(fractional);
  const unsafe = fixedProfile(); unsafe.currency.gold.amount = Number.MAX_SAFE_INTEGER + 1; cases.push(unsafe);
  const reversed = rangeProfile(); reversed.currency.gold.min = 12; reversed.currency.gold.max = 3; cases.push(reversed);
  const unknownMode = fixedProfile(); unknownMode.currency.gold.mode = 'DICE'; cases.push(unknownMode);
  const extra = fixedProfile(); extra.rarity = 'legendary'; cases.push(extra);
  const fakeItems = fixedProfile(); fakeItems.items = [{ itemId: 'sword' }]; cases.push(fakeItems);
  cases.forEach((profile) => assert.equal(validateLootProfile(profile).valid, false));
});

test('LootProfileRegistry rejects duplicates and unknown IDs while deep-freezing stored clones', () => {
  const source = rangeProfile();
  const registry = new LootProfileRegistry({ profiles: [source] });
  const stored = registry.getProfile(source.lootProfileId);
  source.currency.gold.min = 99;
  assert.equal(stored.currency.gold.min, 4);
  assert.equal(Object.isFrozen(stored.currency.gold), true);
  assert.throws(() => registry.getProfile('missing'), (error) => error.code === 'UNKNOWN_LOOT_PROFILE');
  assert.throws(
    () => new LootProfileRegistry({ profiles: [fixedProfile(), fixedProfile()] }),
    (error) => error.code === 'DUPLICATE_PROFILE',
  );
});

test('Enemy Preset v1 remains reward-free while v2 accepts only strict rewards.lootProfileId', () => {
  const v1 = legacyPreset();
  assert.equal(validateEnemyPreset(v1).valid, true);
  v1.rewards = { lootProfileId: 'dread_ram_god_standard' };
  assert.equal(validateEnemyPreset(v1).valid, false);

  const v2 = structuredClone(DREAD_RAM_GOD_GREAT_MACE_PRESET);
  assert.equal(v2.schema, ENEMY_PRESET_V2_SCHEMA);
  assert.equal(v2.version, ENEMY_PRESET_V2_VERSION);
  assert.equal(validateEnemyPreset(v2).valid, true);
  v2.rewards.extra = true;
  assert.equal(validateEnemyPreset(v2).valid, false);
  delete v2.rewards.extra;
  v2.rewards.lootProfileId = 'Bad ID';
  assert.equal(validateEnemyPreset(v2).valid, false);
});

test('EnemyPresetResolver fails closed on an unknown v2 Loot Profile', async () => {
  const preset = structuredClone(DREAD_RAM_GOD_GREAT_MACE_PRESET);
  preset.rewards.lootProfileId = 'missing_profile';
  const resolver = new EnemyPresetResolver({
    presetRegistry: new EnemyPresetRegistry({ presets: [preset] }),
    lootProfileRegistry: new LootProfileRegistry({ profiles: [] }),
  });
  await assert.rejects(resolver.resolve(preset.presetId), (error) => error.code === 'UNKNOWN_LOOT_PROFILE');
});

test('migrated Ram God v2 preserves M7 calibration and resolves immutable production loot', async () => {
  assert.deepEqual(DREAD_RAM_GOD_GREAT_MACE_PRESET.presentation, { targetHeight: 2.1 });
  assert.equal(DREAD_RAM_GOD_GREAT_MACE_PRESET.armament.loadoutId, 'humanoid_dreadstone_mace_main_hand');
  assert.deepEqual(DREAD_RAM_GOD_GREAT_MACE_PRESET.armament.weaponOverride, {
    assetScale: 1.41,
    gripTransform: {
      position: [0.005, 0.085, -0.015],
      quaternion: [0.70710678, 0, 0, 0.70710678],
    },
    attackCapsule: {
      start: [0, 0, -0.48],
      end: [0, 0, -0.29],
      radius: 0.13,
    },
  });
  const definitionRegistry = new CreatureDefinitionRegistry();
  const creaturePackRegistry = ramPackRegistry();
  const resolver = new EnemyPresetResolver({
    definitionRegistry,
    creaturePackRegistry,
    creatureFactory: new CreatureFactory({ definitionRegistry, creaturePackRegistry }),
  });
  const resolved = await resolver.resolve('dread_ram_god_great_mace');
  assert.equal(resolved.weapon.weaponId, 'dreadstone_mace');
  assert.deepEqual(resolved.compatibleActions.map((entry) => entry.combatActionId), ['humanoid_one_hand_overhead']);
  assert.deepEqual(resolved.lootProfile, DREAD_RAM_GOD_STANDARD_LOOT_PROFILE);
  assert.equal(Object.isFrozen(resolved.lootProfile), true);
});

test('living enemies expose no loot and authoritative dead state resolves FIXED reward exactly once', () => {
  const enemy = actor();
  const runtime = new EnemyLootRuntime({
    actor: enemy,
    lootProfile: fixedProfile({ amount: 20 }),
    playerCurrencyState: new PlayerCurrencyState(),
  });
  assert.equal(runtime.update(), false);
  assert.deepEqual(runtime.getSnapshot(), {
    actorInstanceId: 'enemy-1',
    lootProfileId: 'fixed_gold',
    resolvedGold: null,
    state: 'unavailable',
    claimed: false,
    resolutionAttempted: false,
    resolutionCount: 0,
    resolutionError: null,
    lastObservedLifeState: 'alive',
    disposed: false,
  });
  enemy.lifeState = 'dead';
  assert.equal(runtime.update(), true);
  assert.equal(runtime.getSnapshot().resolvedGold, 20);
  assert.equal(runtime.update(), false);
  assert.equal(runtime.getSnapshot().resolutionCount, 1);
});

test('RANGE reward uses injected randomness once and never rerolls during inspection or claim', () => {
  const enemy = actor('range-enemy', 'dead');
  let calls = 0;
  const runtime = new EnemyLootRuntime({
    actor: enemy,
    lootProfile: rangeProfile({ min: 4, max: 11 }),
    playerCurrencyState: new PlayerCurrencyState(),
    random: () => { calls += 1; return 0.5; },
  });
  runtime.update();
  const amount = runtime.getSnapshot().resolvedGold;
  assert.equal(amount, 8);
  assert.ok(amount >= 4 && amount <= 11);
  runtime.getSnapshot();
  runtime.getSnapshot();
  runtime.claim();
  runtime.claim();
  runtime.update();
  assert.equal(calls, 1);
  assert.equal(runtime.getSnapshot().resolvedGold, amount);
});

test('first loot claim credits the wallet and every later claim is rejected without another credit', () => {
  const wallet = new PlayerCurrencyState({ initialGold: 5 });
  const runtime = new EnemyLootRuntime({ actor: actor('claim-enemy', 'dead'), lootProfile: fixedProfile({ amount: 7 }), playerCurrencyState: wallet });
  runtime.update();
  assert.equal(runtime.claim().accepted, true);
  assert.equal(wallet.currentGold, 12);
  assert.equal(runtime.getSnapshot().state, 'claimed');
  assert.equal(runtime.claim().reason, 'loot-already-claimed');
  assert.equal(wallet.currentGold, 12);
  assert.equal(runtime.container.successfulClaimCount, 1);
});

test('failed wallet transaction leaves the loot available and unclaimed', () => {
  const wallet = { addGold: () => ({ accepted: false, reason: 'test-wallet-failure' }) };
  const runtime = new EnemyLootRuntime({ actor: actor('failed-claim', 'dead'), lootProfile: fixedProfile(), playerCurrencyState: wallet });
  runtime.update();
  assert.equal(runtime.claim().reason, 'test-wallet-failure');
  assert.equal(runtime.getSnapshot().state, 'available');
  assert.equal(runtime.container.claimed, false);
});

test('no-profile enemies create no empty container or zero-gold pickup', () => {
  const runtime = new EnemyLootRuntime({ actor: actor('animal', 'dead'), lootProfile: null, playerCurrencyState: new PlayerCurrencyState() });
  assert.equal(runtime.update(), false);
  assert.equal(runtime.container, null);
  assert.equal(runtime.getSnapshot().resolvedGold, null);
  assert.equal(runtime.claim().reason, 'loot-unavailable');
});

test('disposed loot cannot duplicate rewards and new actor instances own independent runtime state', () => {
  const wallet = new PlayerCurrencyState();
  const first = new EnemyLootRuntime({ actor: actor('first', 'dead'), lootProfile: fixedProfile({ amount: 3 }), playerCurrencyState: wallet });
  first.update();
  first.claim();
  first.dispose();
  assert.equal(first.claim().reason, 'enemy-loot-runtime-disposed');
  const second = new EnemyLootRuntime({ actor: actor('second', 'dead'), lootProfile: fixedProfile({ amount: 3 }), playerCurrencyState: wallet });
  second.update();
  assert.equal(second.getSnapshot().state, 'available');
  second.claim();
  assert.equal(wallet.currentGold, 6);
});

function createLabFixture() {
  const definitionRegistry = new CreatureDefinitionRegistry();
  const creaturePackRegistry = ramPackRegistry();
  const realFactory = new CreatureFactory({ definitionRegistry, creaturePackRegistry });
  let actorSerial = 0;
  const labFactory = {
    resolve: (definitionId) => realFactory.resolve(definitionId),
    createActorFromResolved(resolved) {
      return {
        ...resolved,
        actor: {
          instanceId: `m8-lab-${++actorSerial}`,
          lifeState: 'alive',
          disposed: false,
          visualAdapter: { ready: Promise.resolve(), listProgressiveDamageSites: () => [] },
        },
      };
    },
  };
  const presetRegistry = new EnemyPresetRegistry();
  const weaponRegistry = new NpcWeaponRegistry();
  const enemyPresetResolver = new EnemyPresetResolver({
    presetRegistry,
    definitionRegistry,
    creaturePackRegistry,
    creatureFactory: labFactory,
    weaponRegistry,
  });
  const walkerController = {
    actor: null,
    actorFactory: null,
    enabled: true,
    pauseLocomotion: true,
    externalLocomotionAuthority: false,
    reset() { this.actor = this.actorFactory({}); return true; },
    disposeWalker() { if (this.actor) this.actor.disposed = true; this.actor = null; },
  };
  const harness = {
    weaponRegistry,
    selectedWeaponId: 'dreadstone_mace',
    listWeapons: () => weaponRegistry.list(),
    getSelectedWeaponId() { return this.selectedWeaponId; },
    getDiagnostics() { return { enabled: true, capabilityAvailable: true, equipped: false }; },
    clearSubject() {},
    setSubject(actorValue, options) { this.actor = actorValue; this.loadout = options.loadout; return { accepted: true }; },
    selectWeapon(weaponId) { this.selectedWeaponId = weaponId; return { accepted: true }; },
    setCalibrationOverride() { return { accepted: true }; },
    update() {},
    dispose() {},
  };
  const wallet = new PlayerCurrencyState({ persistenceAdapter: new SessionCurrencyPersistenceAdapter() });
  const controller = new CreatureLabController({
    registry: creaturePackRegistry,
    definitionRegistry,
    creatureFactory: labFactory,
    presetRegistry,
    enemyPresetResolver,
    walkerController,
    attackHarness: harness,
    playerCurrencyState: wallet,
    calibrationStorage: memoryStorage(),
    initialPresetId: 'dread_ram_god_great_mace',
    initialDefinitionId: null,
  });
  return { controller, wallet };
}

test('Creature Lab proves unavailable -> available -> claimed and respawn creates independent loot', async () => {
  const { controller, wallet } = createLabFixture();
  await controller.initialize();
  let state = controller.getViewState();
  assert.equal(state.lootEconomy.enemyPresetId, 'dread_ram_god_great_mace');
  assert.equal(state.lootEconomy.lootProfileId, 'dread_ram_god_standard');
  assert.equal(state.lootEconomy.lootState, 'unavailable');
  assert.equal(state.lootEconomy.playerGold, 0);
  assert.equal(getCreatureLabLootActions(controller, state)[0].disabled, true);

  const firstActorId = controller.actor.instanceId;
  controller.actor.lifeState = 'dead';
  controller.update();
  state = controller.getViewState();
  assert.equal(state.lootEconomy.resolvedGold, 12);
  assert.equal(state.lootEconomy.lootState, 'available');
  assert.equal(getCreatureLabLootActions(controller, state)[0].disabled, false);
  assert.equal(controller.claimLoot().accepted, true);
  assert.equal(wallet.currentGold, 12);
  assert.equal(controller.claimLoot().accepted, false);
  assert.equal(wallet.currentGold, 12);
  assert.equal(controller.getViewState().lootEconomy.lootState, 'claimed');

  await controller.respawn();
  assert.notEqual(controller.actor.instanceId, firstActorId);
  assert.equal(controller.getViewState().lootEconomy.lootState, 'unavailable');
  assert.equal(wallet.currentGold, 12);
  controller.dispose();
});

test('M8 reward code remains independent from player HP mutation and MinimalCombatBrain gold logic', async () => {
  const [runtimeSource, brainSource, combatStateSource] = await Promise.all([
    readFile(new URL('../src/game/economy/EnemyLootRuntime.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/game/combat/MinimalCombatBrain.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/game/combat/PlayerCombatState.js', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(runtimeSource, /applyDamage|currentHealth|maximumHealth/);
  assert.doesNotMatch(brainSource, /\bgold\b|lootProfile|LootContainer|PlayerCurrency/i);
  assert.doesNotMatch(combatStateSource, /PlayerCurrency|LootProfile|EnemyLoot/);
  const combatState = new PlayerCombatState();
  assert.deepEqual(combatState.getSnapshot(), {
    maximumHealth: 100,
    currentHealth: 100,
    alive: true,
    dead: false,
    damageEventCount: 0,
    deathTransitionCount: 0,
    resetCount: 0,
    disposed: false,
  });
});
