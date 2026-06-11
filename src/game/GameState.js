const SOUTH_RELIQUARY_FRAGMENT_KEY = 'dreadStoneBlack.hasSouthReliquaryFragment';
const FIELD_SHRINE_REACTION_KEY = 'dreadStoneBlack.fieldShrineReactionSeen';
const EQUIPMENT_STATE_KEY = 'dreadStoneBlack.equipmentState';
const OBJECTIVE_STATE_KEY = 'dreadStoneBlack.objectiveState';
const RUSTED_SWORD_CHEST_OPENED_KEY = 'dreadStoneBlack.blackGrassTemple.rustedSwordChestOpened';
const RUSTED_SWORD_ITEM_ID = 'rusted_sword';
const RUSTED_SWORD_CHEST_INTERACTION_ID = 'BGT_INT_RUSTED_SWORD_CHEST';

export class GameState {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.hasSouthReliquaryFragment = this.readFlag(SOUTH_RELIQUARY_FRAGMENT_KEY, false);
    this.fieldShrineReactionSeen = this.readFlag(FIELD_SHRINE_REACTION_KEY, false);
    this.rustedSwordChestOpened = this.readFlag(RUSTED_SWORD_CHEST_OPENED_KEY, false)
      || this.inferRustedSwordChestOpenedFromObjectives();
    if (this.rustedSwordChestOpened) {
      this.writeFlag(RUSTED_SWORD_CHEST_OPENED_KEY, true);
    }
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
    return this.repairEquipmentSnapshot(this.readJson(EQUIPMENT_STATE_KEY, null));
  }

  saveEquipmentSnapshot(snapshot) {
    this.writeJson(EQUIPMENT_STATE_KEY, this.repairEquipmentSnapshot(snapshot));
  }

  getObjectiveSnapshot() {
    return this.readJson(OBJECTIVE_STATE_KEY, null);
  }

  saveObjectiveSnapshot(snapshot) {
    this.writeJson(OBJECTIVE_STATE_KEY, snapshot);
  }

  hasRustedSwordChestOpened() {
    return this.rustedSwordChestOpened;
  }

  markRustedSwordChestOpened() {
    if (this.rustedSwordChestOpened) return false;

    this.rustedSwordChestOpened = true;
    this.writeFlag(RUSTED_SWORD_CHEST_OPENED_KEY, true);
    return true;
  }

  repairEquipmentSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || this.rustedSwordChestOpened) return snapshot;

    const acquiredItemIds = (snapshot.acquiredItemIds ?? []).filter((itemId) => itemId !== RUSTED_SWORD_ITEM_ID);
    const equipped = {
      ...(snapshot.equipped ?? {}),
      weapon: snapshot.equipped?.weapon === RUSTED_SWORD_ITEM_ID ? 'unarmed' : (snapshot.equipped?.weapon ?? 'unarmed'),
    };

    return {
      ...snapshot,
      acquiredItemIds,
      equipped,
    };
  }

  inferRustedSwordChestOpenedFromObjectives() {
    const snapshot = this.readJson(OBJECTIVE_STATE_KEY, null);
    if (!snapshot || typeof snapshot !== 'object') return false;

    const facts = snapshot.facts ?? {};
    if ((facts.chestOpenedInteractionIds ?? []).includes(RUSTED_SWORD_CHEST_INTERACTION_ID)) return true;
    if (snapshot.lastEvent?.type === 'chest_opened' && snapshot.lastEvent?.interactionId === RUSTED_SWORD_CHEST_INTERACTION_ID) return true;

    return (snapshot.objectiveStates ?? []).some((objectiveState) => (
      objectiveState?.id === 'bgt_arm_yourself'
      && objectiveState.stepStates?.take_rusted_sword?.status === 'complete'
    ));
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
