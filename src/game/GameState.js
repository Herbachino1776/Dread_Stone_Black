const SOUTH_RELIQUARY_FRAGMENT_KEY = 'dreadStoneBlack.hasSouthReliquaryFragment';
const FIELD_SHRINE_REACTION_KEY = 'dreadStoneBlack.fieldShrineReactionSeen';
const EQUIPMENT_STATE_KEY = 'dreadStoneBlack.equipmentState';
const OBJECTIVE_STATE_KEY = 'dreadStoneBlack.objectiveState';
const FIELD_SURVIVAL_STATE_KEY = 'dreadStoneBlack.reliquaryField.survivalState';
const FOLSOM_TOOL_SHED_OPEN_KEY = 'folsom_tool_shed_open';
const FOLSOM_SHRINE_SIDE_ROOM_OPEN_KEY = 'folsom_shrine_side_room_open';
const FOLSOM_UNDER_SHRINE_NETWORK_REVEALED_KEY = 'folsom_under_shrine_network_revealed';
const FOLSOM_SHRINE_CRAWLSPACE_OPEN_KEY = 'folsom_shrine_crawlspace_open';
const BENEATH_FOLSOM_DRAIN_GRATE_PRIED_KEY = 'beneath_folsom_drain_grate_pried';
const BENEATH_FOLSOM_KEEPERS_LANTERN_REVEAL_SEEN_KEY = 'beneath_folsom_keepers_lantern_reveal_seen';
const BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_CLEARED_KEY = 'beneath_folsom_hidden_growth_gate_cleared';
const BENEATH_FOLSOM_LOWER_SHRINE_HATCH_OPEN_KEY = 'beneath_folsom_lower_shrine_hatch_open';
const BENEATH_FOLSOM_WHITE_SCAB_LOWER_KNOT_DESTROYED_KEY = 'beneath_folsom_white_scab_lower_knot_destroyed';
const FOLSOM_SHRINE_CRAWLSPACE_TERMINAL_OPEN_KEY = 'folsom_shrine_crawlspace_terminal_open';
const UNDER_SHRINE_LABYRINTH_END_HATCH_OPEN_KEY = 'under_shrine_labyrinth_end_hatch_open';
const BENEATH_FOLSOM_LOWER_SHRINE_HATCH_MIGRATION_KEY = 'dreadStoneBlack.lowerShrineHatchMigrationV1';
const PHYSICAL_TOOL_ACTION_MIGRATION_KEY = 'dreadStoneBlack.physicalToolActionMigrationV1';
export const NORTH_ROAD_WORLD_KEYS = Object.freeze({
  folsomNorthGateOpen: 'folsom_north_gate_open',
  mapUpdated: 'north_road_map_updated',
  hunterCampMarked: 'north_road_hunter_camp_marked',
  churchCampMarked: 'north_road_church_camp_marked',
  scoutCampMarked: 'north_road_scout_camp_marked',
  hunterRootCleared: 'north_road_hunter_root_cleared',
  churchRootCleared: 'north_road_church_root_cleared',
  scoutRootCleared: 'north_road_scout_root_cleared',
  bentRoadCorrected: 'north_road_bent_road_corrected',
  growthGateLeftKnotCleared: 'north_road_growth_gate_left_knot_cleared',
  growthGateRightCordsCleared: 'north_road_growth_gate_right_cords_cleared',
  growthGateSoftMatCleared: 'north_road_growth_gate_soft_mat_cleared',
  growthGateOpen: 'north_road_growth_gate_open',
  emptyFortApproachMarked: 'north_road_empty_fort_approach_marked',
});
const BENEATH_FOLSOM_CHAPTER_3_PLANNED_KEYS = Object.freeze([
  'beneath_folsom_white_mechanism_exposed',
  'beneath_folsom_pale_panel_activated',
  'beneath_folsom_crypt_access_stair_open',
]);
const FOLSOM_GROWTH_WORLD_KEYS = Object.freeze({
  fire: 'folsom_growth_anchor_fire_cleared',
  pond: 'folsom_growth_anchor_pond_cleared',
  shrine: 'folsom_growth_anchor_shrine_cleared',
  underworks: 'folsom_underworks_growth_unsealed',
});

const DEFAULT_FIELD_SURVIVAL_STATE = Object.freeze({
  inventory: { wood_axe: false, fishing_rod: false, wood: 0, raw_fish: 0, cooked_fish: 0, torch: false },
  fishStacks: { raw_fish: [], cooked_fish: [] },
  keyItems: { flint_stick: false },
  equipment: { owned: {}, equippedTool: null, equippedItem: null, equippedOffhand: null },
  campfires: [],
  campfireBuilt: false,
  campfirePosition: null,
  openedChests: {},
  lootedChests: {},
  harvestedTrees: {},
  hungerMaxSeconds: 20 * 60,
  hungerSecondsRemaining: 3 * 60,
  starvationDamageTimer: 0,
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
      storage.removeItem(FOLSOM_TOOL_SHED_OPEN_KEY);
      storage.removeItem(FOLSOM_SHRINE_SIDE_ROOM_OPEN_KEY);
      storage.removeItem(FOLSOM_UNDER_SHRINE_NETWORK_REVEALED_KEY);
      storage.removeItem(FOLSOM_SHRINE_CRAWLSPACE_OPEN_KEY);
      storage.removeItem(BENEATH_FOLSOM_DRAIN_GRATE_PRIED_KEY);
      storage.removeItem(BENEATH_FOLSOM_KEEPERS_LANTERN_REVEAL_SEEN_KEY);
      storage.removeItem(BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_CLEARED_KEY);
      storage.removeItem(BENEATH_FOLSOM_LOWER_SHRINE_HATCH_OPEN_KEY);
      storage.removeItem(BENEATH_FOLSOM_WHITE_SCAB_LOWER_KNOT_DESTROYED_KEY);
      storage.removeItem(FOLSOM_SHRINE_CRAWLSPACE_TERMINAL_OPEN_KEY);
      storage.removeItem(UNDER_SHRINE_LABYRINTH_END_HATCH_OPEN_KEY);
      storage.removeItem(BENEATH_FOLSOM_LOWER_SHRINE_HATCH_MIGRATION_KEY);
      storage.removeItem(PHYSICAL_TOOL_ACTION_MIGRATION_KEY);
      storage.removeItem('dreadStoneBlack.outdoorWorldClock.v1');
      storage.removeItem('road_warden_proof_accepted');
      Object.values(FOLSOM_GROWTH_WORLD_KEYS).forEach((key) => storage.removeItem(key));
      Object.values(NORTH_ROAD_WORLD_KEYS).forEach((key) => storage.removeItem(key));
    } catch {
      // Reset should never wipe unrelated storage or crash if localStorage is blocked.
    }

    return keysToRemove.length;
  }

  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.hasSouthReliquaryFragment = this.readFlag(SOUTH_RELIQUARY_FRAGMENT_KEY, false);
    this.fieldShrineReactionSeen = this.readFlag(FIELD_SHRINE_REACTION_KEY, false);
    this.fieldSurvivalState = this.repairFieldSurvivalState(this.readJson(FIELD_SURVIVAL_STATE_KEY, null));
    this.migrateFolsomChapter2Backfill();
    this.migrateBeneathFolsomLowerShrineHatch();
    this.syncFolsomNorthGateWithChapter2Completion();
    this.migratePhysicalToolActions();
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

  isFolsomToolShedOpen() {
    return this.readFlag(FOLSOM_TOOL_SHED_OPEN_KEY, false);
  }

  markFolsomToolShedOpen() {
    if (this.isFolsomToolShedOpen()) return false;
    this.writeFlag(FOLSOM_TOOL_SHED_OPEN_KEY, true);
    return true;
  }

  isWorldStateSet(key) {
    return typeof key === 'string' && key.length > 0 ? this.readFlag(key, false) : false;
  }

  markWorldState(key) {
    if (typeof key !== 'string' || !key.length || this.isWorldStateSet(key)) return false;
    this.writeFlag(key, true);
    return true;
  }

  isFolsomShrineSideRoomOpen() {
    return this.readFlag(FOLSOM_SHRINE_SIDE_ROOM_OPEN_KEY, false);
  }

  markFolsomShrineSideRoomOpen() {
    if (this.isFolsomShrineSideRoomOpen()) return false;
    this.writeFlag(FOLSOM_SHRINE_SIDE_ROOM_OPEN_KEY, true);
    return true;
  }

  isFolsomUnderShrineNetworkRevealed() {
    return this.readFlag(FOLSOM_UNDER_SHRINE_NETWORK_REVEALED_KEY, false);
  }

  markFolsomUnderShrineNetworkRevealed() {
    if (this.isFolsomUnderShrineNetworkRevealed()) return false;
    this.writeFlag(FOLSOM_UNDER_SHRINE_NETWORK_REVEALED_KEY, true);
    return true;
  }

  isFolsomShrineCrawlspaceOpen() {
    return this.readFlag(FOLSOM_SHRINE_CRAWLSPACE_OPEN_KEY, false);
  }

  markFolsomShrineCrawlspaceOpen() {
    if (this.isFolsomShrineCrawlspaceOpen()) return false;
    this.writeFlag(FOLSOM_SHRINE_CRAWLSPACE_OPEN_KEY, true);
    return true;
  }

  migrateFolsomChapter2Backfill() {
    if (this.isFolsomUnderShrineNetworkRevealed()) return false;
    const hasExistingChapter2Progress = Object.keys(FOLSOM_GROWTH_WORLD_KEYS)
      .some((key) => this.readFlag(FOLSOM_GROWTH_WORLD_KEYS[key], false))
      || this.readFlag(BENEATH_FOLSOM_DRAIN_GRATE_PRIED_KEY, false)
      || this.readFlag(BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_CLEARED_KEY, false);
    if (!hasExistingChapter2Progress) return false;
    this.writeFlag(FOLSOM_UNDER_SHRINE_NETWORK_REVEALED_KEY, true);
    return true;
  }

  isBeneathFolsomDrainGratePried() {
    return this.readFlag(BENEATH_FOLSOM_DRAIN_GRATE_PRIED_KEY, false);
  }

  markBeneathFolsomDrainGratePried() {
    if (this.isBeneathFolsomDrainGratePried()) return false;
    this.writeFlag(BENEATH_FOLSOM_DRAIN_GRATE_PRIED_KEY, true);
    return true;
  }

  isBeneathFolsomKeepersLanternRevealSeen() {
    return this.readFlag(BENEATH_FOLSOM_KEEPERS_LANTERN_REVEAL_SEEN_KEY, false);
  }

  markBeneathFolsomKeepersLanternRevealSeen() {
    if (this.isBeneathFolsomKeepersLanternRevealSeen()) return false;
    this.writeFlag(BENEATH_FOLSOM_KEEPERS_LANTERN_REVEAL_SEEN_KEY, true);
    return true;
  }

  isBeneathFolsomHiddenGrowthGateCleared() {
    return this.readFlag(BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_CLEARED_KEY, false);
  }

  markBeneathFolsomHiddenGrowthGateCleared() {
    if (this.isBeneathFolsomHiddenGrowthGateCleared()) return false;
    this.writeFlag(BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_CLEARED_KEY, true);
    return true;
  }

  isBeneathFolsomLowerShrineHatchOpen() {
    return this.readFlag(BENEATH_FOLSOM_LOWER_SHRINE_HATCH_OPEN_KEY, false);
  }

  markBeneathFolsomLowerShrineHatchOpen() {
    if (this.isBeneathFolsomLowerShrineHatchOpen()) {
      this.syncFolsomNorthGateWithChapter2Completion();
      return false;
    }
    this.writeFlag(BENEATH_FOLSOM_LOWER_SHRINE_HATCH_OPEN_KEY, true);
    this.syncFolsomNorthGateWithChapter2Completion();
    return true;
  }

  isFolsomNorthGateOpen() {
    this.syncFolsomNorthGateWithChapter2Completion();
    return this.readFlag(NORTH_ROAD_WORLD_KEYS.folsomNorthGateOpen, false);
  }

  syncFolsomNorthGateWithChapter2Completion() {
    if (!this.readFlag(BENEATH_FOLSOM_LOWER_SHRINE_HATCH_OPEN_KEY, false)
      || this.readFlag(NORTH_ROAD_WORLD_KEYS.folsomNorthGateOpen, false)) return false;
    this.writeFlag(NORTH_ROAD_WORLD_KEYS.folsomNorthGateOpen, true);
    return true;
  }

  isBeneathFolsomWhiteScabLowerKnotDestroyed() {
    return this.readFlag(BENEATH_FOLSOM_WHITE_SCAB_LOWER_KNOT_DESTROYED_KEY, false);
  }

  markBeneathFolsomWhiteScabLowerKnotDestroyed() {
    if (this.isBeneathFolsomWhiteScabLowerKnotDestroyed()) return false;
    this.writeFlag(BENEATH_FOLSOM_WHITE_SCAB_LOWER_KNOT_DESTROYED_KEY, true);
    this.writeFlag(FOLSOM_SHRINE_CRAWLSPACE_TERMINAL_OPEN_KEY, true);
    return true;
  }

  isFolsomShrineCrawlspaceTerminalOpen() {
    return this.readFlag(FOLSOM_SHRINE_CRAWLSPACE_TERMINAL_OPEN_KEY, false)
      || this.isBeneathFolsomWhiteScabLowerKnotDestroyed();
  }

  markFolsomShrineCrawlspaceTerminalOpen() {
    if (this.isFolsomShrineCrawlspaceTerminalOpen()) return false;
    this.writeFlag(FOLSOM_SHRINE_CRAWLSPACE_TERMINAL_OPEN_KEY, true);
    return true;
  }

  isUnderShrineLabyrinthEndHatchOpen() {
    return this.readFlag(UNDER_SHRINE_LABYRINTH_END_HATCH_OPEN_KEY, false);
  }

  markUnderShrineLabyrinthEndHatchOpen() {
    if (this.isUnderShrineLabyrinthEndHatchOpen()) return false;
    this.writeFlag(UNDER_SHRINE_LABYRINTH_END_HATCH_OPEN_KEY, true);
    return true;
  }

  migrateBeneathFolsomLowerShrineHatch() {
    const hasChapter3Progress = BENEATH_FOLSOM_CHAPTER_3_PLANNED_KEYS
      .some((key) => this.readFlag(key, false));
    const migrationAlreadyRun = this.readFlag(BENEATH_FOLSOM_LOWER_SHRINE_HATCH_MIGRATION_KEY, false);
    const crossedLegacyOpenSeam = !migrationAlreadyRun
      && this.readFlag(BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_CLEARED_KEY, false);
    if ((hasChapter3Progress || crossedLegacyOpenSeam) && !this.isBeneathFolsomLowerShrineHatchOpen()) {
      this.writeFlag(BENEATH_FOLSOM_LOWER_SHRINE_HATCH_OPEN_KEY, true);
    }
    if (hasChapter3Progress) {
      this.writeFlag(FOLSOM_UNDER_SHRINE_NETWORK_REVEALED_KEY, true);
      this.writeFlag(FOLSOM_SHRINE_CRAWLSPACE_OPEN_KEY, true);
      this.writeFlag(BENEATH_FOLSOM_WHITE_SCAB_LOWER_KNOT_DESTROYED_KEY, true);
      this.writeFlag(FOLSOM_SHRINE_CRAWLSPACE_TERMINAL_OPEN_KEY, true);
      this.writeFlag(UNDER_SHRINE_LABYRINTH_END_HATCH_OPEN_KEY, true);
    }
    if (!migrationAlreadyRun) this.writeFlag(BENEATH_FOLSOM_LOWER_SHRINE_HATCH_MIGRATION_KEY, true);
    return hasChapter3Progress || crossedLegacyOpenSeam;
  }

  migratePhysicalToolActions() {
    if (this.readFlag(PHYSICAL_TOOL_ACTION_MIGRATION_KEY, false)) return false;
    const hadLegacyChapter3LeadIn = this.readFlag(BENEATH_FOLSOM_WHITE_SCAB_LOWER_KNOT_DESTROYED_KEY, false)
      || this.readFlag(FOLSOM_SHRINE_CRAWLSPACE_TERMINAL_OPEN_KEY, false);
    if (hadLegacyChapter3LeadIn && !this.isUnderShrineLabyrinthEndHatchOpen()) {
      this.writeFlag(UNDER_SHRINE_LABYRINTH_END_HATCH_OPEN_KEY, true);
    }
    this.writeFlag(PHYSICAL_TOOL_ACTION_MIGRATION_KEY, true);
    return hadLegacyChapter3LeadIn;
  }

  isFolsomGrowthAnchorCleared(anchorType) {
    const key = FOLSOM_GROWTH_WORLD_KEYS[anchorType];
    return key ? this.readFlag(key, false) : false;
  }

  markFolsomGrowthAnchorCleared(anchorType) {
    const key = FOLSOM_GROWTH_WORLD_KEYS[anchorType];
    if (!key || this.readFlag(key, false)) return false;
    this.writeFlag(key, true);
    return true;
  }

  isFolsomUnderworksGrowthUnsealed() {
    return this.readFlag(FOLSOM_GROWTH_WORLD_KEYS.underworks, false);
  }

  markFolsomUnderworksGrowthUnsealed() {
    if (this.isFolsomUnderworksGrowthUnsealed()) return false;
    this.writeFlag(FOLSOM_GROWTH_WORLD_KEYS.underworks, true);
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

  getFieldSurvivalSnapshot() {
    return this.repairFieldSurvivalState(this.fieldSurvivalState);
  }

  normalizeFieldItemId(itemId) {
    return itemId === 'field_axe' ? 'wood_axe' : itemId;
  }

  hasFieldItem(itemId) {
    const normalizedItemId = this.normalizeFieldItemId(itemId);
    return Boolean(this.fieldSurvivalState.inventory?.[normalizedItemId]);
  }

  hasFieldOffhandItem(itemId) {
    return Boolean(this.fieldSurvivalState.inventory?.[itemId] && this.fieldSurvivalState.equipment?.owned?.[itemId]);
  }

  hasFieldKeyItem(itemId) {
    return Boolean(this.fieldSurvivalState.keyItems?.[itemId]);
  }

  getFieldItemCount(itemId) {
    const value = this.fieldSurvivalState.inventory?.[this.normalizeFieldItemId(itemId)];
    return Number.isFinite(value) ? value : (value ? 1 : 0);
  }

  addFieldItem(itemId, amount = 1, metadata = {}) {
    const normalizedItemId = this.normalizeFieldItemId(itemId);
    if (['wood', 'raw_fish', 'cooked_fish'].includes(normalizedItemId)) {
      this.fieldSurvivalState.inventory[normalizedItemId] = Math.max(0, this.getFieldItemCount(normalizedItemId) + amount);
      if (['raw_fish', 'cooked_fish'].includes(normalizedItemId)) this.addFishStackMetadata(normalizedItemId, amount, metadata);
    } else if (normalizedItemId === 'flint_stick') {
      this.fieldSurvivalState.keyItems.flint_stick = true;
    } else {
      this.fieldSurvivalState.inventory[normalizedItemId] = true;
    }
    if (normalizedItemId === 'wood_axe') this.acquireFieldTool('wood_axe');
    if (normalizedItemId === 'fishing_rod') this.acquireFieldTool('fishing_rod');
    if (['torch', 'keepers_lantern'].includes(normalizedItemId)) this.acquireFieldOffhand(normalizedItemId);
    this.saveFieldSurvivalState();
    return true;
  }

  acquireFieldTool(itemId) {
    if (!itemId) return false;
    const normalizedItemId = this.normalizeFieldItemId(itemId);
    this.fieldSurvivalState.equipment.owned[normalizedItemId] = true;
    if (!this.fieldSurvivalState.equipment.equippedTool) {
      this.fieldSurvivalState.equipment.equippedTool = null;
    }
    this.saveFieldSurvivalState();
    return true;
  }

  acquireFieldOffhand(itemId) {
    if (!itemId) return false;
    this.fieldSurvivalState.inventory[itemId] = true;
    this.fieldSurvivalState.equipment.owned[itemId] = true;
    this.saveFieldSurvivalState();
    return true;
  }

  equipFieldOffhand(itemId) {
    if (itemId && !this.fieldSurvivalState.equipment.owned?.[itemId]) return false;
    this.fieldSurvivalState.equipment.equippedOffhand = itemId ?? null;
    this.saveFieldSurvivalState();
    return true;
  }

  getEquippedFieldOffhand() {
    return this.fieldSurvivalState.equipment?.equippedOffhand ?? null;
  }

  equipFieldTool(itemId) {
    const normalizedItemId = this.normalizeFieldItemId(itemId);
    if (normalizedItemId && !this.fieldSurvivalState.equipment.owned?.[normalizedItemId]) return false;
    this.fieldSurvivalState.equipment.equippedTool = normalizedItemId ?? null;
    this.saveFieldSurvivalState();
    return true;
  }

  getEquippedFieldTool() {
    return this.fieldSurvivalState.equipment?.equippedTool ?? null;
  }

  equipFieldItem(itemId) {
    if (itemId && !['wood', 'raw_fish', 'cooked_fish'].includes(itemId)) return false;
    if (itemId && this.getFieldItemCount(itemId) < 1) return false;
    this.fieldSurvivalState.equipment.equippedItem = itemId ?? null;
    this.saveFieldSurvivalState();
    return true;
  }

  getEquippedFieldItem() {
    return this.fieldSurvivalState.equipment?.equippedItem ?? null;
  }

  addFishStackMetadata(itemId, amount = 1, metadata = {}) {
    const stacks = this.fieldSurvivalState.fishStacks ??= { raw_fish: [], cooked_fish: [] };
    const stack = stacks[itemId] ??= [];
    for (let i = 0; i < Math.max(0, amount); i += 1) {
      stack.push({ fishSizeGroup: metadata.fishSizeGroup ?? 'medium', hungerSeconds: metadata.hungerSeconds ?? 10 * 60 });
    }
  }

  popFishStackMetadata(itemId) {
    const stacks = this.fieldSurvivalState.fishStacks ??= { raw_fish: [], cooked_fish: [] };
    return (stacks[itemId] ??= []).shift() ?? { fishSizeGroup: 'medium', hungerSeconds: 10 * 60 };
  }

  peekFishStackMetadata(itemId) {
    const stacks = this.fieldSurvivalState.fishStacks ??= { raw_fish: [], cooked_fish: [] };
    return (stacks[itemId] ?? [])[0] ?? { fishSizeGroup: 'medium', hungerSeconds: 10 * 60 };
  }

  consumeFieldItems(cost = {}) {
    for (const [itemId, amount] of Object.entries(cost)) {
      if (itemId === 'flint_stick') continue;
      if (this.getFieldItemCount(itemId) < (amount ?? 0)) return false;
    }
    if ((cost.flint_stick ?? 0) > 0 && !this.hasFieldKeyItem('flint_stick')) return false;

    for (const [itemId, amount] of Object.entries(cost)) {
      if (itemId === 'flint_stick') continue;
      this.fieldSurvivalState.inventory[itemId] = Math.max(0, this.getFieldItemCount(itemId) - (amount ?? 0));
      if (['raw_fish', 'cooked_fish'].includes(itemId)) { for (let i = 0; i < (amount ?? 0); i += 1) this.popFishStackMetadata(itemId); }
      if (this.fieldSurvivalState.inventory[itemId] < 1 && this.fieldSurvivalState.equipment?.equippedItem === itemId) {
        this.fieldSurvivalState.equipment.equippedItem = null;
      }
    }
    this.saveFieldSurvivalState();
    return true;
  }


  updateHunger(deltaSeconds, { paused = false, applyStarvationDamage = null } = {}) {
    if (paused || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return null;
    const state = this.fieldSurvivalState;
    state.hungerSecondsRemaining = Math.max(0, (state.hungerSecondsRemaining ?? DEFAULT_FIELD_SURVIVAL_STATE.hungerSecondsRemaining) - deltaSeconds);
    let damaged = false;
    if (state.hungerSecondsRemaining <= 0) {
      state.starvationDamageTimer = (state.starvationDamageTimer ?? 0) + deltaSeconds;
      while (state.starvationDamageTimer >= 10) {
        state.starvationDamageTimer -= 10;
        applyStarvationDamage?.(1);
        damaged = true;
      }
    } else {
      state.starvationDamageTimer = 0;
    }
    return { hungerSecondsRemaining: state.hungerSecondsRemaining, hungerMaxSeconds: state.hungerMaxSeconds, damaged };
  }

  eatCookedFish() {
    if (this.getFieldItemCount('cooked_fish') < 1) return false;
    const fishMeta = this.peekFishStackMetadata('cooked_fish');
    this.consumeFieldItems({ cooked_fish: 1 });
    this.fieldSurvivalState.hungerSecondsRemaining = Math.min(this.fieldSurvivalState.hungerMaxSeconds, this.fieldSurvivalState.hungerSecondsRemaining + (fishMeta.hungerSeconds ?? 10 * 60));
    this.fieldSurvivalState.starvationDamageTimer = 0;
    this.saveFieldSurvivalState();
    return true;
  }

  hasLootedFieldChest(chestId) {
    return Boolean(this.fieldSurvivalState.lootedChests?.[chestId]);
  }

  markFieldChestLooted(chestId) {
    if (this.hasLootedFieldChest(chestId)) return false;
    this.fieldSurvivalState.lootedChests[chestId] = true;
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
    return this.getFieldCampfires().length > 0;
  }

  getFieldCampfires() {
    return Array.isArray(this.fieldSurvivalState.campfires) ? this.fieldSurvivalState.campfires : [];
  }

  markFieldCampfireBuilt(position) {
    if (!position) return false;
    const campfire = {
      id: `field_campfire_${Date.now()}_${this.getFieldCampfires().length + 1}`,
      position: { x: position.x, y: position.y ?? 0, z: position.z },
      createdAt: Date.now(),
    };
    this.fieldSurvivalState.campfires.push(campfire);
    this.fieldSurvivalState.campfireBuilt = true;
    this.fieldSurvivalState.campfirePosition = this.fieldSurvivalState.campfirePosition ?? campfire.position;
    this.saveFieldSurvivalState();
    return campfire;
  }

  saveFieldSurvivalState() {
    this.fieldSurvivalState = this.repairFieldSurvivalState(this.fieldSurvivalState);
    this.writeJson(FIELD_SURVIVAL_STATE_KEY, this.fieldSurvivalState);
  }

  repairFieldSurvivalState(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
      inventory: {
        field_axe: false,
        wood_axe: Boolean(source.inventory?.wood_axe || source.inventory?.field_axe),
        fishing_rod: Boolean(source.inventory?.fishing_rod || source.equipment?.owned?.fishing_rod),
        wood: Math.max(0, Number(source.inventory?.wood) || 0),
        raw_fish: Math.max(0, Number(source.inventory?.raw_fish) || 0),
        cooked_fish: Math.max(0, Number(source.inventory?.cooked_fish) || 0),
        torch: Boolean(source.inventory?.torch || source.equipment?.owned?.torch),
        keepers_lantern: Boolean(source.inventory?.keepers_lantern || source.equipment?.owned?.keepers_lantern),
      },
      keyItems: {
        flint_stick: Boolean(source.keyItems?.flint_stick || source.inventory?.flint_stick),
      },
      equipment: {
        owned: {
          ...(source.equipment?.owned ?? {}),
          ...(source.equipment?.owned?.field_axe ? { wood_axe: true } : {}),
          ...(source.inventory?.field_axe || source.inventory?.wood_axe ? { wood_axe: true } : {}),
          ...(source.inventory?.fishing_rod || source.equipment?.owned?.fishing_rod ? { fishing_rod: true } : {}),
          ...(source.inventory?.torch || source.equipment?.owned?.torch ? { torch: true } : {}),
          ...(source.inventory?.keepers_lantern || source.equipment?.owned?.keepers_lantern ? { keepers_lantern: true } : {}),
        },
        equippedTool: source.equipment?.equippedTool === 'field_axe' ? 'wood_axe' : (['wood_axe', 'fishing_rod'].includes(source.equipment?.equippedTool) ? source.equipment.equippedTool : null),
        equippedItem: ['wood', 'raw_fish', 'cooked_fish'].includes(source.equipment?.equippedItem) && Math.max(0, Number(source.inventory?.[source.equipment.equippedItem]) || 0) > 0 ? source.equipment.equippedItem : null,
        equippedOffhand: ['torch', 'keepers_lantern'].includes(source.equipment?.equippedOffhand)
          && Boolean(source.inventory?.[source.equipment.equippedOffhand] || source.equipment?.owned?.[source.equipment.equippedOffhand])
          ? source.equipment.equippedOffhand
          : null,
      },
      campfires: this.repairFieldCampfires(source),
      fishStacks: {
        raw_fish: Array.isArray(source.fishStacks?.raw_fish) ? source.fishStacks.raw_fish : [],
        cooked_fish: Array.isArray(source.fishStacks?.cooked_fish) ? source.fishStacks.cooked_fish : [],
      },
      campfireBuilt: Boolean(source.campfireBuilt || source.campfirePosition || source.campfires?.length),
      campfirePosition: source.campfirePosition ?? source.campfires?.[0]?.position ?? null,
      openedChests: { ...(source.openedChests ?? DEFAULT_FIELD_SURVIVAL_STATE.openedChests) },
      lootedChests: { ...(source.lootedChests ?? {}) },
      harvestedTrees: { ...(source.harvestedTrees ?? DEFAULT_FIELD_SURVIVAL_STATE.harvestedTrees) },
      hungerMaxSeconds: Math.max(1, Number(source.hungerMaxSeconds) || DEFAULT_FIELD_SURVIVAL_STATE.hungerMaxSeconds),
      hungerSecondsRemaining: Math.max(0, Number.isFinite(Number(source.hungerSecondsRemaining)) ? Number(source.hungerSecondsRemaining) : DEFAULT_FIELD_SURVIVAL_STATE.hungerSecondsRemaining),
      starvationDamageTimer: Math.max(0, Number(source.starvationDamageTimer) || 0),
    };
  }

  repairFieldCampfires(source) {
    const campfires = Array.isArray(source.campfires) ? source.campfires : [];
    const repaired = campfires
      .filter((campfire) => campfire?.position)
      .map((campfire, index) => ({
        id: campfire.id ?? `field_campfire_legacy_${index + 1}`,
        position: { x: campfire.position.x, y: campfire.position.y ?? 0, z: campfire.position.z },
        createdAt: campfire.createdAt ?? 0,
      }));
    if (!repaired.length && source.campfirePosition) {
      repaired.push({ id: 'field_campfire_legacy_1', position: { x: source.campfirePosition.x, y: source.campfirePosition.y ?? 0, z: source.campfirePosition.z }, createdAt: 0 });
    }
    return repaired;
  }

  repairEquipmentSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return snapshot;

    const acquiredItemIds = (snapshot.acquiredItemIds ?? [])
      .filter((itemId) => itemId !== 'rusted_sword')
      .map((itemId) => itemId === 'field_axe' ? 'wood_axe' : itemId);
    const weapon = snapshot.equipped?.weapon === 'rusted_sword'
      ? 'unarmed'
      : snapshot.equipped?.weapon === 'field_axe'
        ? 'wood_axe'
        : (snapshot.equipped?.weapon ?? 'unarmed');
    const equipped = {
      ...(snapshot.equipped ?? {}),
      weapon,
      tool: snapshot.equipped?.tool === 'field_axe' ? null : (snapshot.equipped?.tool ?? null),
      offhand: acquiredItemIds.includes(snapshot.equipped?.offhand) ? snapshot.equipped?.offhand : null,
    };

    return {
      ...snapshot,
      acquiredItemIds,
      equipped,
    };
  }


  readFlag(key, fallback = false) {
    try {
      const value = this.storage?.getItem(key);
      if (value === null || value === undefined) return fallback;
      return value === 'true';
    } catch {
      return fallback;
    }
  }

  writeFlag(key, value) {
    try {
      this.storage?.setItem(key, value ? 'true' : 'false');
    } catch {
      // Progress still works for the current tab if storage is unavailable.
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
