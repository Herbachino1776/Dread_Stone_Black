import { LOOT_GOLD_MODES } from '../../contracts/LootProfile.js';

function deepFreeze(value) {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export function createEnemyRuntimeRewardConfiguration({ lootProfile = null, fixedGoldOverride = null, spawnId = null } = {}) {
  if (fixedGoldOverride != null) {
    if (!Number.isSafeInteger(fixedGoldOverride) || fixedGoldOverride <= 0) {
      throw new Error('Encounter fixed gold override must be a positive safe integer.');
    }
    return deepFreeze({
      source: 'encounter-fixed-gold',
      lootProfileId: null,
      spawnId,
      gold: { mode: LOOT_GOLD_MODES.fixed, amount: fixedGoldOverride },
    });
  }
  if (!lootProfile) return null;
  return deepFreeze({
    source: 'enemy-preset-loot-profile',
    lootProfileId: lootProfile.lootProfileId,
    spawnId,
    gold: structuredClone(lootProfile.currency.gold),
  });
}

function resolveGold(gold, random) {
  if (gold.mode === LOOT_GOLD_MODES.fixed) return gold.amount;
  const sample = Number(random());
  if (!Number.isFinite(sample) || sample < 0 || sample > 1) {
    throw new Error('Loot random source must return a finite value between 0 and 1.');
  }
  const unit = Math.min(sample, 1 - Number.EPSILON);
  return gold.min + Math.floor(unit * (gold.max - gold.min + 1));
}

export class LootContainerState {
  constructor({ gold, playerCurrencyState, context = null } = {}) {
    if (!Number.isSafeInteger(gold) || gold < 0) throw new Error('Loot container gold must be a non-negative safe integer.');
    this.gold = gold;
    this.playerCurrencyState = playerCurrencyState;
    this.context = context;
    this.claimed = false;
    this.disposed = false;
    this.claimAttemptCount = 0;
    this.successfulClaimCount = 0;
    this.lastClaimResult = null;
  }

  claim(context = null) {
    this.claimAttemptCount += 1;
    if (this.disposed) return this.reject('loot-container-disposed');
    if (this.claimed) return this.reject('loot-already-claimed');
    if (!this.playerCurrencyState?.addGold) return this.reject('player-currency-state-unavailable');
    const transaction = this.playerCurrencyState.addGold(this.gold, context ?? this.context);
    if (transaction?.accepted !== true) return this.reject(transaction?.reason ?? 'wallet-transaction-failed', transaction);
    this.claimed = true;
    this.successfulClaimCount = 1;
    this.lastClaimResult = Object.freeze({
      accepted: true,
      gold: this.gold,
      claimed: true,
      transaction,
    });
    return this.lastClaimResult;
  }

  reject(reason, transaction = null) {
    this.lastClaimResult = Object.freeze({
      accepted: false,
      reason,
      gold: this.gold,
      claimed: this.claimed,
      transaction,
    });
    return this.lastClaimResult;
  }

  getSnapshot() {
    return Object.freeze({
      gold: this.gold,
      claimed: this.claimed,
      disposed: this.disposed,
      claimAttemptCount: this.claimAttemptCount,
      successfulClaimCount: this.successfulClaimCount,
    });
  }

  dispose() {
    this.disposed = true;
  }
}

export class EnemyLootRuntime {
  constructor({ actor, lootProfile = null, rewardConfiguration = undefined, playerCurrencyState = null, random = Math.random } = {}) {
    if (!actor) throw new Error('EnemyLootRuntime requires one runtime actor instance.');
    if (typeof random !== 'function') throw new Error('EnemyLootRuntime random source must be a function.');
    this.actor = actor;
    this.actorInstanceId = actor.instanceId ?? null;
    this.lootProfile = lootProfile;
    this.rewardConfiguration = rewardConfiguration === undefined
      ? createEnemyRuntimeRewardConfiguration({ lootProfile })
      : rewardConfiguration;
    this.playerCurrencyState = playerCurrencyState;
    this.random = random;
    this.container = null;
    this.resolutionAttempted = false;
    this.resolutionCount = 0;
    this.lastObservedLifeState = actor.lifeState ?? null;
    this.resolutionError = null;
    this.disposed = false;
  }

  update() {
    if (this.disposed) return false;
    const lifeState = this.actor?.lifeState ?? null;
    this.lastObservedLifeState = lifeState;
    if (lifeState !== 'dead' || this.resolutionAttempted || !this.rewardConfiguration) return false;
    this.resolutionAttempted = true;
    try {
      const gold = resolveGold(this.rewardConfiguration.gold, this.random);
      if (gold <= 0) return false;
      this.container = new LootContainerState({
        gold,
        playerCurrencyState: this.playerCurrencyState,
        context: Object.freeze({
          source: 'enemy-loot',
          actorInstanceId: this.actorInstanceId,
          spawnId: this.rewardConfiguration.spawnId,
          rewardSource: this.rewardConfiguration.source,
          lootProfileId: this.rewardConfiguration.lootProfileId,
        }),
      });
      this.resolutionCount = 1;
      return true;
    } catch (error) {
      this.resolutionError = error.message;
      return false;
    }
  }

  claim(context = null) {
    if (this.disposed) return { accepted: false, reason: 'enemy-loot-runtime-disposed' };
    if (!this.container) return { accepted: false, reason: 'loot-unavailable' };
    return this.container.claim(context);
  }

  getSnapshot() {
    const container = this.container?.getSnapshot?.() ?? null;
    const state = container?.claimed ? 'claimed' : container ? 'available' : 'unavailable';
    const snapshot = {
      actorInstanceId: this.actorInstanceId,
      lootProfileId: this.rewardConfiguration?.lootProfileId ?? null,
      resolvedGold: container?.gold ?? null,
      state,
      claimed: container?.claimed ?? false,
      resolutionAttempted: this.resolutionAttempted,
      resolutionCount: this.resolutionCount,
      resolutionError: this.resolutionError,
      lastObservedLifeState: this.lastObservedLifeState,
      disposed: this.disposed,
    };
    if (this.rewardConfiguration?.source === 'encounter-fixed-gold') {
      snapshot.rewardSource = this.rewardConfiguration.source;
      snapshot.spawnId = this.rewardConfiguration.spawnId;
    }
    return Object.freeze(snapshot);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.container?.dispose?.();
    this.actor = null;
  }
}
