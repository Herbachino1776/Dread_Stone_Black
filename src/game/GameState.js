const SOUTH_RELIQUARY_FRAGMENT_KEY = 'dreadStoneBlack.hasSouthReliquaryFragment';
const FIELD_SHRINE_REACTION_KEY = 'dreadStoneBlack.fieldShrineReactionSeen';
const EQUIPMENT_STATE_KEY = 'dreadStoneBlack.equipmentState';
const OBJECTIVE_STATE_KEY = 'dreadStoneBlack.objectiveState';
const RUSTED_SWORD_CHEST_OPENED_KEY = 'dreadStoneBlack.blackGrassTemple.rustedSwordChestOpened';
const BLACK_GRASS_TEMPLE_ALTAR_ACTIVATED_KEY = 'dreadStoneBlack.blackGrassTemple.altarActivated';
const FIELD_SURVIVAL_STATE_KEY = 'dreadStoneBlack.reliquaryField.survivalState';
const RUSTED_SWORD_ITEM_ID = 'rusted_sword';
const RUSTED_SWORD_CHEST_INTERACTION_ID = 'BGT_INT_RUSTED_SWORD_CHEST';

const DEFAULT_FIELD_SURVIVAL_STATE = Object.freeze({
  inventory: { field_axe: false, flint_stick: false, wood: 0 },
  equipment: { owned: {}, equippedTool: null },
  campfireBuilt: false,
  campfirePosition: null,
  openedChests: {},
  harvestedTrees: {},
});

export class GameState {
  static resetAllProgress(storage = window.localStorage) {
    const prefix = 'dreadStoneBlack.';
    const keysToRemove = [];

    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(prefix)) keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => storage.removeItem(key));
    } catch {
      // Reset should never wipe unrelated storage or crash if localStorage is blocked.
    }

    return keysToRemove.length;
  }

  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.hasSouthReliquaryFragment = this.readFlag(SOUTH_RELIQUARY_FRAGMENT_KEY, false);
    this.fieldShrineReactionSeen = this.readFlag(FIELD_SHRINE_REACTION_KEY, false);
    this.rustedSwordChestOpened = this.readFlag(RUSTED_SWORD_CHEST_OPENED_KEY, false)
      || this.inferRustedSwordChestOpenedFromObjectives();
    this.blackGrassTempleAltarActivated = this.readFlag(BLACK_GRASS_TEMPLE_ALTAR_ACTIVATED_KEY, false)
      || this.inferBlackGrassTempleAltarActivatedFromObjectives();
    this.fieldSurvivalState = this.repairFieldSurvivalState(this.readJson(FIELD_SURVIVAL_STATE_KEY, null));
    if (this.rustedSwordChestOpened) {
      this.writeFlag(RUSTED_SWORD_CHEST_OPENED_KEY, true);
    }
    if (this.blackGrassTempleAltarActivated) {
      this.writeFlag(BLACK_GRASS_TEMPLE_ALTAR_ACTIVATED_KEY, true);
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

  hasBlackGrassTempleAltarActivated() {
    return this.blackGrassTempleAltarActivated;
  }

  markBlackGrassTempleAltarActivated() {
    if (this.blackGrassTempleAltarActivated) return false;

    this.blackGrassTempleAltarActivated = true;
    this.writeFlag(BLACK_GRASS_TEMPLE_ALTAR_ACTIVATED_KEY, true);
    return true;
  }

  markRustedSwordChestOpened() {
    if (this.rustedSwordChestOpened) return false;

    this.rustedSwordChestOpened = true;
    this.writeFlag(RUSTED_SWORD_CHEST_OPENED_KEY, true);
    return true;
  }

  getFieldSurvivalSnapshot() {
    return this.repairFieldSurvivalState(this.fieldSurvivalState);
  }

  hasFieldItem(itemId) {
    return Boolean(this.fieldSurvivalState.inventory?.[itemId]);
  }

  getFieldItemCount(itemId) {
    const value = this.fieldSurvivalState.inventory?.[itemId];
    return Number.isFinite(value) ? value : (value ? 1 : 0);
  }

  addFieldItem(itemId, amount = 1) {
    if (itemId === 'wood') {
      this.fieldSurvivalState.inventory.wood = Math.max(0, this.getFieldItemCount('wood') + amount);
    } else {
      this.fieldSurvivalState.inventory[itemId] = true;
    }
    if (itemId === 'field_axe') this.acquireFieldTool('field_axe');
    this.saveFieldSurvivalState();
    return true;
  }

  acquireFieldTool(itemId) {
    if (!itemId) return false;
    this.fieldSurvivalState.equipment.owned[itemId] = true;
    if (!this.fieldSurvivalState.equipment.equippedTool) {
      this.fieldSurvivalState.equipment.equippedTool = itemId;
    }
    this.saveFieldSurvivalState();
    return true;
  }

  equipFieldTool(itemId) {
    if (itemId && !this.fieldSurvivalState.equipment.owned?.[itemId]) return false;
    this.fieldSurvivalState.equipment.equippedTool = itemId ?? null;
    this.saveFieldSurvivalState();
    return true;
  }

  getEquippedFieldTool() {
    return this.fieldSurvivalState.equipment?.equippedTool ?? null;
  }

  consumeFieldItems(cost = {}) {
    if (this.getFieldItemCount('wood') < (cost.wood ?? 0)) return false;
    if ((cost.flint_stick ?? 0) > 0 && !this.hasFieldItem('flint_stick')) return false;

    this.fieldSurvivalState.inventory.wood -= cost.wood ?? 0;
    if ((cost.flint_stick ?? 0) > 0) this.fieldSurvivalState.inventory.flint_stick = false;
    this.saveFieldSurvivalState();
    return true;
  }

  hasOpenedFieldChest(chestId) {
    return Boolean(this.fieldSurvivalState.openedChests?.[chestId]);
  }

  markFieldChestOpened(chestId) {
    if (this.hasOpenedFieldChest(chestId)) return false;
    this.fieldSurvivalState.openedChests[chestId] = true;
    this.saveFieldSurvivalState();
    return true;
  }

  hasHarvestedFieldTree(treeId) {
    return Boolean(this.fieldSurvivalState.harvestedTrees?.[treeId]);
  }

  markFieldTreeHarvested(treeId) {
    if (this.hasHarvestedFieldTree(treeId)) return false;
    this.fieldSurvivalState.harvestedTrees[treeId] = true;
    this.saveFieldSurvivalState();
    return true;
  }

  hasFieldCampfireBuilt() {
    return Boolean(this.fieldSurvivalState.campfireBuilt);
  }

  markFieldCampfireBuilt(position) {
    if (this.hasFieldCampfireBuilt()) return false;
    this.fieldSurvivalState.campfireBuilt = true;
    this.fieldSurvivalState.campfirePosition = position ? { x: position.x, y: position.y ?? 0, z: position.z } : null;
    this.saveFieldSurvivalState();
    return true;
  }

  saveFieldSurvivalState() {
    this.fieldSurvivalState = this.repairFieldSurvivalState(this.fieldSurvivalState);
    this.writeJson(FIELD_SURVIVAL_STATE_KEY, this.fieldSurvivalState);
  }

  repairFieldSurvivalState(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
      inventory: {
        field_axe: Boolean(source.inventory?.field_axe),
        flint_stick: Boolean(source.inventory?.flint_stick),
        wood: Math.max(0, Number(source.inventory?.wood) || 0),
      },
      equipment: {
        owned: {
          ...(source.equipment?.owned ?? {}),
          ...(source.inventory?.field_axe ? { field_axe: true } : {}),
        },
        equippedTool: source.equipment?.equippedTool ?? (source.inventory?.field_axe ? 'field_axe' : null),
      },
      campfireBuilt: Boolean(source.campfireBuilt),
      campfirePosition: source.campfirePosition ?? null,
      openedChests: { ...(source.openedChests ?? DEFAULT_FIELD_SURVIVAL_STATE.openedChests) },
      harvestedTrees: { ...(source.harvestedTrees ?? DEFAULT_FIELD_SURVIVAL_STATE.harvestedTrees) },
    };
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


  inferBlackGrassTempleAltarActivatedFromObjectives() {
    const snapshot = this.readJson(OBJECTIVE_STATE_KEY, null);
    if (!snapshot || typeof snapshot !== 'object') return false;

    const facts = snapshot.facts ?? {};
    if ((facts.flags ?? []).includes('bgt_silent_altar_touched')) return true;
    if ((facts.usedInteractionIds ?? []).includes('BGT_INT06')) return true;
    if (snapshot.lastEvent?.type === 'interaction_used' && snapshot.lastEvent?.interactionId === 'BGT_INT06') return true;

    return (snapshot.objectiveStates ?? []).some((objectiveState) => (
      objectiveState?.id === 'bgt_touch_silent_altar'
      && (
        objectiveState.status === 'complete'
        || objectiveState.stepStates?.inspect_silent_altar?.status === 'complete'
      )
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
