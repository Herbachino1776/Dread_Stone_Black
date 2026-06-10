export class CreatureCombatProfile {
  constructor(profile = {}) {
    this.profile = profile;
    this.maxHealth = profile.maxHealth ?? 1;
  }

  createRuntimeState() {
    return {
      health: this.maxHealth,
      maxHealth: this.maxHealth,
      alive: this.maxHealth > 0,
    };
  }
}
