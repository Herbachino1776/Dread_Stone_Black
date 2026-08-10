export const PLAYER_CURRENCY_LIMITS = Object.freeze({
  minimumGold: 0,
  maximumGold: Number.MAX_SAFE_INTEGER,
});

function isGoldAmount(value) {
  return Number.isSafeInteger(value) && value >= PLAYER_CURRENCY_LIMITS.minimumGold;
}

function normalizeInitialGold(value) {
  return isGoldAmount(value) ? value : 0;
}

function snapshot(state) {
  return Object.freeze({
    currentGold: state.currentGold,
    transactionCount: state.transactionCount,
    resetCount: state.resetCount,
    disposed: state.disposed,
  });
}

export class PlayerCurrencyState {
  constructor({ initialGold = null, persistenceAdapter = null, diagnosticLimit = 20 } = {}) {
    this.persistenceAdapter = persistenceAdapter;
    const persisted = initialGold == null ? this.loadPersistedState() : null;
    this.currentGold = normalizeInitialGold(initialGold ?? persisted?.gold);
    this.transactionCount = 0;
    this.resetCount = 0;
    this.lastTransaction = null;
    this.lastRejectionReason = null;
    this.transactionDiagnostics = [];
    this.diagnosticLimit = Math.max(1, Math.min(100, Number(diagnosticLimit) || 20));
    this.listeners = new Set();
    this.disposed = false;
  }

  loadPersistedState() {
    try {
      return this.persistenceAdapter?.load?.() ?? null;
    } catch {
      return null;
    }
  }

  subscribe(listener, { emitCurrent = true } = {}) {
    if (typeof listener !== 'function' || this.disposed) return () => {};
    this.listeners.add(listener);
    if (emitCurrent) listener(this.getSnapshot(), Object.freeze({ type: 'snapshot' }));
    return () => this.listeners.delete(listener);
  }

  emit(event) {
    const current = this.getSnapshot();
    this.listeners.forEach((listener) => listener(current, Object.freeze({ ...event })));
    return current;
  }

  validateAmount(amount) {
    return isGoldAmount(amount) ? null : 'gold-amount-must-be-a-non-negative-safe-integer';
  }

  persist(nextGold) {
    if (!this.persistenceAdapter?.save) return true;
    try {
      return this.persistenceAdapter.save(Object.freeze({ version: 1, gold: nextGold })) === true;
    } catch {
      return false;
    }
  }

  recordTransaction(type, amount, previousGold, currentGold, context, { changed = true } = {}) {
    if (changed) this.transactionCount += 1;
    const transaction = Object.freeze({
      transactionId: changed ? this.transactionCount : null,
      type,
      amount,
      previousGold,
      currentGold,
      changed,
      context: context == null ? null : context,
    });
    this.lastTransaction = transaction;
    this.lastRejectionReason = null;
    this.transactionDiagnostics.push(transaction);
    if (this.transactionDiagnostics.length > this.diagnosticLimit) this.transactionDiagnostics.shift();
    if (changed) this.emit({ type, transaction });
    return { accepted: true, ...transaction };
  }

  reject(reason, type, amount) {
    this.lastRejectionReason = reason;
    return {
      accepted: false,
      reason,
      type,
      amount,
      currentGold: this.currentGold,
    };
  }

  addGold(amount, context = null) {
    if (this.disposed) return this.reject('player-currency-state-disposed', 'add', amount);
    const invalidReason = this.validateAmount(amount);
    if (invalidReason) return this.reject(invalidReason, 'add', amount);
    const previousGold = this.currentGold;
    if (amount === 0) return this.recordTransaction('add', amount, previousGold, previousGold, context, { changed: false });
    if (amount > PLAYER_CURRENCY_LIMITS.maximumGold - previousGold) {
      return this.reject('gold-overflow', 'add', amount);
    }
    const nextGold = previousGold + amount;
    if (!this.persist(nextGold)) return this.reject('currency-persistence-failed', 'add', amount);
    this.currentGold = nextGold;
    return this.recordTransaction('add', amount, previousGold, nextGold, context);
  }

  spendGold(amount, context = null) {
    if (this.disposed) return this.reject('player-currency-state-disposed', 'spend', amount);
    const invalidReason = this.validateAmount(amount);
    if (invalidReason) return this.reject(invalidReason, 'spend', amount);
    const previousGold = this.currentGold;
    if (amount === 0) return this.recordTransaction('spend', amount, previousGold, previousGold, context, { changed: false });
    if (amount > previousGold) return this.reject('insufficient-gold', 'spend', amount);
    const nextGold = previousGold - amount;
    if (!this.persist(nextGold)) return this.reject('currency-persistence-failed', 'spend', amount);
    this.currentGold = nextGold;
    return this.recordTransaction('spend', amount, previousGold, nextGold, context);
  }

  canAfford(amount) {
    return !this.disposed && isGoldAmount(amount) && amount <= this.currentGold;
  }

  reset({ gold = 0, persist = true, notify = true, reason = 'dev-reset' } = {}) {
    if (this.disposed) return this.reject('player-currency-state-disposed', 'reset', gold);
    if (!isGoldAmount(gold)) return this.reject('gold-amount-must-be-a-non-negative-safe-integer', 'reset', gold);
    if (persist && !this.persist(gold)) return this.reject('currency-persistence-failed', 'reset', gold);
    const previousGold = this.currentGold;
    this.currentGold = gold;
    this.resetCount += 1;
    this.lastRejectionReason = null;
    if (notify) this.emit({ type: 'reset', reason, previousGold, currentGold: gold });
    return { accepted: true, previousGold, currentGold: gold, changed: previousGold !== gold };
  }

  getSnapshot() {
    return snapshot(this);
  }

  getDiagnostics() {
    return {
      ...this.getSnapshot(),
      persistenceKind: this.persistenceAdapter?.kind ?? 'none',
      lastTransaction: this.lastTransaction,
      lastRejectionReason: this.lastRejectionReason,
      recentTransactions: [...this.transactionDiagnostics],
      subscriberCount: this.listeners.size,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.listeners.clear();
    this.disposed = true;
  }
}
