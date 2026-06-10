let corpseSerial = 0;

export class CorpseManager {
  constructor({ budget, decalSystem }) {
    this.budget = budget;
    this.decalSystem = decalSystem;
    this.corpses = [];
  }

  registerCorpse({
    id = null,
    creatureId,
    species,
    factionId = null,
    position,
    rotation = null,
    yaw = null,
    roomId = null,
    deathTime = performance.now(),
    corpseRoot = null,
    bloodPoolIds = [],
    decayTimer = 34,
    collisionMode = 'none',
    lootState = 'placeholder',
    tags = [],
    persistenceWeight = 1,
  }) {
    const corpse = {
      id: id ?? `corpse-${corpseSerial += 1}`,
      creatureId,
      species,
      factionId,
      position: position.clone(),
      rotation,
      yaw: yaw ?? rotation?.y ?? corpseRoot?.rotation?.y ?? 0,
      roomId,
      deathTime,
      corpseRoot,
      bloodPoolIds: [...bloodPoolIds],
      decayTimer,
      collisionMode,
      lootState,
      tags: [...tags],
      persistenceWeight,
      age: 0,
    };

    this.corpses.push(corpse);
    this.budget.trackCorpse(roomId);
    this.trimForBudget(roomId);
    return corpse.id;
  }

  trimForBudget(roomId) {
    while (
      this.corpses.length > this.budget.corpseGlobalLimit
      || this.budget.getRoomCorpseCount(roomId) > this.budget.corpseRoomLimit
    ) {
      this.removeCorpse(this.corpses[0], { removeVisual: true });
      if (!this.corpses.length) break;
    }
  }

  update(deltaSeconds) {
    for (let i = this.corpses.length - 1; i >= 0; i -= 1) {
      const corpse = this.corpses[i];
      corpse.age += deltaSeconds;
      if (corpse.age >= corpse.decayTimer) {
        this.removeCorpse(corpse, { removeVisual: false });
      }
    }
  }

  removeCorpse(corpse, { removeVisual = false } = {}) {
    const index = this.corpses.indexOf(corpse);
    if (index >= 0) this.corpses.splice(index, 1);
    this.budget.untrackCorpse(corpse.roomId);
    if (removeVisual && corpse.corpseRoot?.parent) corpse.corpseRoot.removeFromParent();
  }

  clearRoom(roomId) {
    [...this.corpses].filter((corpse) => corpse.roomId === roomId).forEach((corpse) => this.removeCorpse(corpse));
  }

  clearAll() {
    [...this.corpses].forEach((corpse) => this.removeCorpse(corpse));
  }

  get count() {
    return this.corpses.length;
  }
}

