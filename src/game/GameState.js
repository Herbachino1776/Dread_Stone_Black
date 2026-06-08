const SOUTH_RELIQUARY_FRAGMENT_KEY = 'dreadStoneBlack.hasSouthReliquaryFragment';
const FIELD_SHRINE_REACTION_KEY = 'dreadStoneBlack.fieldShrineReactionSeen';

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
}
