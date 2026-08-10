export const PLAYER_COMBAT_HEALTH = Object.freeze({
  maximum: 100,
  labAttackDamage: 34,
});

function cloneSnapshot(state) {
  return Object.freeze({
    maximumHealth: state.maximumHealth,
    currentHealth: state.currentHealth,
    alive: state.alive,
    dead: !state.alive,
    damageEventCount: state.damageEventCount,
    deathTransitionCount: state.deathTransitionCount,
    resetCount: state.resetCount,
    disposed: state.disposed,
  });
}

export class PlayerCombatState {
  constructor({ maximumHealth = PLAYER_COMBAT_HEALTH.maximum } = {}) {
    this.maximumHealth = Math.max(1, Number(maximumHealth) || PLAYER_COMBAT_HEALTH.maximum);
    this.currentHealth = this.maximumHealth;
    this.alive = true;
    this.damageEventCount = 0;
    this.deathTransitionCount = 0;
    this.resetCount = 0;
    this.lastDamage = null;
    this.lastRejectionReason = null;
    this.listeners = new Set();
    this.disposed = false;
  }

  get dead() { return !this.alive; }
  get isAlive() { return this.alive; }
  get isDead() { return !this.alive; }

  subscribe(listener, { emitCurrent = true } = {}) {
    if (typeof listener !== 'function' || this.disposed) return () => {};
    this.listeners.add(listener);
    if (emitCurrent) listener(this.getSnapshot(), Object.freeze({ type: 'snapshot' }));
    return () => this.listeners.delete(listener);
  }

  emit(event) {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot, Object.freeze({ ...event })));
    return snapshot;
  }

  applyDamage({ amount, source = null, damageType = 'physical', attackIdentity = null } = {}) {
    if (this.disposed) return this.reject('player-combat-state-disposed');
    if (!this.alive) return this.reject('player-already-dead');
    const damage = Number(amount);
    if (!Number.isFinite(damage) || damage <= 0) return this.reject('invalid-damage-amount');

    const previousHealth = this.currentHealth;
    this.currentHealth = Math.max(0, previousHealth - damage);
    const damageApplied = previousHealth - this.currentHealth;
    const lethal = this.currentHealth <= 0;
    this.damageEventCount += 1;
    if (lethal) {
      this.alive = false;
      this.deathTransitionCount += 1;
    }
    this.lastDamage = Object.freeze({
      amount: damage,
      damageApplied,
      source,
      damageType: String(damageType || 'physical'),
      attackIdentity: attackIdentity == null ? null : String(attackIdentity),
      previousHealth,
      currentHealth: this.currentHealth,
      lethal,
    });
    this.lastRejectionReason = null;
    this.emit({ type: lethal ? 'death' : 'damage', damage: this.lastDamage });
    return {
      accepted: true,
      damageApplied,
      previousHealth,
      currentHealth: this.currentHealth,
      lethal,
    };
  }

  reject(reason) {
    this.lastRejectionReason = reason;
    return { accepted: false, reason, currentHealth: this.currentHealth, lethal: this.dead };
  }

  reset({ notify = true, reason = 'dev-reset' } = {}) {
    if (this.disposed) return this.reject('player-combat-state-disposed');
    const wasDead = this.dead;
    this.currentHealth = this.maximumHealth;
    this.alive = true;
    this.lastDamage = null;
    this.lastRejectionReason = null;
    this.resetCount += 1;
    if (notify) this.emit({ type: 'reset', reason, revived: wasDead });
    return { accepted: true, currentHealth: this.currentHealth, lethal: false, revived: wasDead };
  }

  getSnapshot() {
    return cloneSnapshot(this);
  }

  getDiagnostics() {
    return {
      ...this.getSnapshot(),
      lastDamage: this.lastDamage ? { ...this.lastDamage } : null,
      lastRejectionReason: this.lastRejectionReason,
      subscriberCount: this.listeners.size,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.listeners.clear();
    this.disposed = true;
  }
}
