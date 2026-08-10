export class EncounterRuntime {
  constructor({ definition, createEnemies } = {}) {
    this.definition = definition;
    this.encounterId = definition?.encounterId ?? null;
    this.createEnemies = createEnemies;
    this.enemies = [];
    this.enabled = false;
    this.disposed = false;
    this.resetCount = 0;
    this.lastError = null;
  }

  async initialize() {
    if (this.disposed) throw new Error(`EncounterRuntime "${this.encounterId}" is disposed.`);
    this.enemies = await this.createEnemies();
    this.enabled = true;
    return this;
  }

  update(deltaSeconds = 0) {
    if (!this.enabled || this.disposed) return this.getDiagnostics();
    this.enemies.forEach((enemy) => enemy.update?.(deltaSeconds));
    return this.getDiagnostics();
  }

  beforePhysics(deltaSeconds, playerPosition = null) {
    if (!this.enabled || this.disposed) return;
    this.enemies.forEach((enemy) => enemy.beforePhysics?.(deltaSeconds, playerPosition));
  }

  afterPhysicsStep(deltaSeconds) {
    if (!this.enabled || this.disposed) return;
    this.enemies.forEach((enemy) => enemy.afterPhysicsStep?.(deltaSeconds));
  }

  afterPhysics(alpha = 1) {
    if (!this.enabled || this.disposed) return;
    this.enemies.forEach((enemy) => enemy.afterPhysics?.(alpha));
  }

  despawn(reason = 'encounter-despawn') {
    const enemies = this.enemies.splice(0);
    enemies.forEach((enemy) => enemy.dispose?.(reason));
    this.enabled = false;
    return enemies.length;
  }

  async reset() {
    if (this.disposed) return { accepted: false, reason: 'encounter-runtime-disposed' };
    this.despawn('encounter-reset');
    try {
      this.enemies = await this.createEnemies();
      this.enabled = true;
      this.resetCount += 1;
      this.lastError = null;
      return { accepted: true, encounterId: this.encounterId, spawnCount: this.enemies.length };
    } catch (error) {
      this.lastError = error.message;
      this.enabled = false;
      throw error;
    }
  }

  getContactableActors() {
    return this.enemies.filter((enemy) => enemy.isContactable?.()).map((enemy) => enemy.actor).filter(Boolean);
  }

  getDiagnostics() {
    const enemies = this.enemies.map((enemy) => enemy.getDiagnostics?.() ?? {});
    return {
      encounterId: this.encounterId,
      locationId: this.definition?.locationId ?? null,
      spawnCount: this.definition?.spawns?.length ?? 0,
      liveCount: enemies.filter((enemy) => enemy.lifeState === 'alive').length,
      deadCount: enemies.filter((enemy) => enemy.lifeState === 'dead').length,
      enabled: this.enabled,
      resetCount: this.resetCount,
      lastError: this.lastError,
      enemies,
      disposed: this.disposed,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.despawn('encounter-runtime-dispose');
    this.disposed = true;
    this.createEnemies = null;
  }
}
