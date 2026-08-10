export class GameStateCurrencyPersistenceAdapter {
  constructor(gameState) {
    if (!gameState?.loadCurrencyState || !gameState?.saveCurrencyState) {
      throw new Error('GameState currency persistence requires loadCurrencyState() and saveCurrencyState().');
    }
    this.kind = 'game-state';
    this.gameState = gameState;
  }

  load() {
    return this.gameState.loadCurrencyState();
  }

  save(record) {
    return this.gameState.saveCurrencyState(record);
  }
}

export class SessionCurrencyPersistenceAdapter {
  constructor({ initialGold = 0 } = {}) {
    this.kind = 'session-isolated';
    this.initialGold = Number.isSafeInteger(initialGold) && initialGold >= 0 ? initialGold : 0;
  }

  load() {
    return Object.freeze({ version: 1, gold: this.initialGold });
  }

  save() {
    // PlayerCurrencyState remains the sole mutable balance. Creature Lab accepts
    // transactions for this session without writing any durable save record.
    return true;
  }
}

export function createPlayerCurrencyPersistence({ gameState, isolated = false, initialGold = 0 } = {}) {
  return isolated
    ? new SessionCurrencyPersistenceAdapter({ initialGold })
    : new GameStateCurrencyPersistenceAdapter(gameState);
}
