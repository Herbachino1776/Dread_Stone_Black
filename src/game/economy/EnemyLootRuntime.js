import { LOOT_GOLD_MODES } from '../../contracts/LootProfile.js';

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
  constructor({ actor, lootProfile = null, playerCurrencyState = null, random = Math.random } = {}) {
    if (!actor) throw new Error('EnemyLootRuntime requires one runtime actor instance.');
    if (typeof random !== 'function') throw new Error('EnemyLootRuntime random source must be a function.');
    this.actor = actor;
    this.actorInstanceId = actor.instanceId ?? null;
    this.lootProfile = lootProfile;
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
    if (lifeState !== 'dead' || this.resolutionAttempted || !this.lootProfile) return false;
    this.resolutionAttempted = true;
    try {
      const gold = resolveGold(this.lootProfile.currency.gold, this.random);
      this.container = new LootContainerState({
        gold,
        playerCurrencyState: this.playerCurrencyState,
        context: Object.freeze({
          source: 'enemy-loot',
          actorInstanceId: this.actorInstanceId,
          lootProfileId: this.lootProfile.lootProfileId,
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
    return Object.freeze({
      actorInstanceId: this.actorInstanceId,
      lootProfileId: this.lootProfile?.lootProfileId ?? null,
      resolvedGold: container?.gold ?? null,
      state,
      claimed: container?.claimed ?? false,
      resolutionAttempted: this.resolutionAttempted,
      resolutionCount: this.resolutionCount,
      resolutionError: this.resolutionError,
      lastObservedLifeState: this.lastObservedLifeState,
      disposed: this.disposed,
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.container?.dispose?.();
    this.actor = null;
  }
}
