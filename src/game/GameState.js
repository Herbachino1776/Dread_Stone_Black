const SOUTH_RELIQUARY_FRAGMENT_KEY = 'dreadStoneBlack.hasSouthReliquaryFragment';
const FIELD_SHRINE_REACTION_KEY = 'dreadStoneBlack.fieldShrineReactionSeen';
const EQUIPMENT_STATE_KEY = 'dreadStoneBlack.equipmentState';

export class GameState {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.hasSouthReliquaryFragment = this.readFlag(SOUTH_RELIQUARY_FRAGMENT_KEY, false);
    this.fieldShrineReactionSeen = this.readFlag(FIELD_SHRINE_REACTION_KEY, false);
  }

  collectSouthReliquaryFragment() {
    if (this.hasSouthReliquaryFragment) return false;

    this.hasSouthReliquaryFragment = true;
    this.writeFlag(SOUTH_RELIQUARY_FRAGMENT_KEY, true);
    return true;
  }

  markFieldShrineReactionSeen() {
    if (this.fieldShrineReactionSeen) return false;

    this.fieldShrineReactionSeen = true;
    this.writeFlag(FIELD_SHRINE_REACTION_KEY, true);
    return true;
  }

  getEquipmentSnapshot() {
    return this.readJson(EQUIPMENT_STATE_KEY, null);
  }

  saveEquipmentSnapshot(snapshot) {
    this.writeJson(EQUIPMENT_STATE_KEY, snapshot);
  }

  readFlag(key, fallback) {
    try {
      return this.storage?.getItem(key) === 'true' || fallback;
    } catch {
      return fallback;
    }
  }

  writeFlag(key, value) {
    try {
      this.storage?.setItem(key, String(value));
    } catch {
      // Progression can still work for the current tab if storage is unavailable.
    }
  }

  readJson(key, fallback) {
    try {
      const value = this.storage?.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  writeJson(key, value) {
    try {
      this.storage?.setItem(key, JSON.stringify(value));
    } catch {
      // Equipment still works for the current tab if storage is unavailable.
    }
  }
}
