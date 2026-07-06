import { EQUIPMENT_SLOTS } from '../../engine/equipment/EquipmentSlot.js';

export const SURVIVAL_ITEM_IDS = Object.freeze([
  'wood_axe',
  'fishing_rod',
  'torch',
  'keepers_lantern',
  'wood',
  'raw_fish',
  'cooked_fish',
  'flint_stick',
]);

const WEAPON_IDS = new Set(['wood_axe', 'fishing_rod']);
const OFFHAND_IDS = new Set(['torch', 'keepers_lantern']);
const CONSUMABLE_IDS = new Set(['wood', 'raw_fish', 'cooked_fish']);
const KEY_ITEM_IDS = new Set(['flint_stick']);

export class SurvivalInventoryBridge {
  constructor({ equipmentRuntime = null, gameState = null } = {}) {
    this.equipmentRuntime = equipmentRuntime;
    this.gameState = gameState;
    this.syncRuntimeFromFieldState();
  }

  normalizeItemId(itemId) {
    return itemId === 'field_axe' ? 'wood_axe' : itemId;
  }

  isSurvivalItem(itemId) {
    return SURVIVAL_ITEM_IDS.includes(this.normalizeItemId(itemId));
  }

  hasItem(itemId) {
    const normalizedItemId = this.normalizeItemId(itemId);
    if (KEY_ITEM_IDS.has(normalizedItemId)) return this.hasKeyItem(normalizedItemId);
    if (WEAPON_IDS.has(normalizedItemId) || OFFHAND_IDS.has(normalizedItemId)) {
      return Boolean(this.gameState?.hasFieldItem?.(normalizedItemId) || this.equipmentRuntime?.hasItem?.(normalizedItemId));
    }
    return this.getItemCount(normalizedItemId) > 0;
  }

  getItemCount(itemId) {
    const normalizedItemId = this.normalizeItemId(itemId);
    if (KEY_ITEM_IDS.has(normalizedItemId)) return this.hasKeyItem(normalizedItemId) ? 1 : 0;
    if (WEAPON_IDS.has(normalizedItemId) || OFFHAND_IDS.has(normalizedItemId)) return this.hasItem(normalizedItemId) ? 1 : 0;
    return this.gameState?.getFieldItemCount?.(normalizedItemId) ?? 0;
  }

  acquireItem(itemId, metadata = {}) {
    const normalizedItemId = this.normalizeItemId(itemId);
    if (!this.isSurvivalItem(normalizedItemId)) return false;

    const amount = Number.isFinite(metadata.amount) ? metadata.amount : 1;
    this.gameState?.addFieldItem?.(normalizedItemId, amount, metadata);
    if (WEAPON_IDS.has(normalizedItemId) || OFFHAND_IDS.has(normalizedItemId)) {
      this.equipmentRuntime?.acquireItem?.(normalizedItemId, metadata);
    }
    return true;
  }

  equipWeapon(itemId) {
    const normalizedItemId = this.normalizeItemId(itemId);
    const runtimeItemId = normalizedItemId ?? 'unarmed';
    if (normalizedItemId && !WEAPON_IDS.has(normalizedItemId)) return false;
    if (normalizedItemId && !this.hasItem(normalizedItemId)) return false;
    const equipped = this.equipmentRuntime?.equip?.(EQUIPMENT_SLOTS.weapon, runtimeItemId) ?? true;
    if (!equipped) return false;
    this.gameState?.equipFieldTool?.(normalizedItemId && WEAPON_IDS.has(normalizedItemId) ? normalizedItemId : null);
    return true;
  }

  equipOffhand(itemId) {
    const normalizedItemId = this.normalizeItemId(itemId);
    if (normalizedItemId && (!OFFHAND_IDS.has(normalizedItemId) || !this.hasItem(normalizedItemId))) return false;
    const equipped = this.equipmentRuntime?.equip?.(EQUIPMENT_SLOTS.offhand, normalizedItemId ?? null) ?? true;
    if (!equipped) return false;
    if (normalizedItemId) this.gameState?.acquireFieldOffhand?.(normalizedItemId);
    this.gameState?.equipFieldOffhand?.(normalizedItemId ?? null);
    return true;
  }

  equipConsumable(itemId) {
    const normalizedItemId = this.normalizeItemId(itemId);
    if (normalizedItemId && (!CONSUMABLE_IDS.has(normalizedItemId) || this.getItemCount(normalizedItemId) < 1)) return false;
    return Boolean(this.gameState?.equipFieldItem?.(normalizedItemId ?? null));
  }

  getEquippedConsumable() {
    return this.gameState?.getEquippedFieldItem?.() ?? null;
  }

  getEquippedOffhand() {
    return this.equipmentRuntime?.getEquippedOffhandId?.() ?? this.gameState?.getEquippedFieldOffhand?.() ?? null;
  }

  hasKeyItem(itemId) {
    return Boolean(this.gameState?.hasFieldKeyItem?.(this.normalizeItemId(itemId)));
  }

  syncRuntimeFromFieldState() {
    for (const itemId of ['wood_axe', 'fishing_rod', 'torch', 'keepers_lantern']) {
      if (this.gameState?.hasFieldItem?.(itemId) && !this.equipmentRuntime?.hasItem?.(itemId)) {
        this.equipmentRuntime?.acquireItem?.(itemId, { source: 'field_survival_state_sync', tags: ['field-survival', 'save-compat'] });
      }
    }
    const equippedTool = this.gameState?.getEquippedFieldTool?.();
    if (WEAPON_IDS.has(equippedTool) && this.equipmentRuntime?.hasItem?.(equippedTool)) this.equipmentRuntime?.equip?.(EQUIPMENT_SLOTS.weapon, equippedTool);
    const equippedOffhand = this.gameState?.getEquippedFieldOffhand?.();
    if (OFFHAND_IDS.has(equippedOffhand) && this.equipmentRuntime?.hasItem?.(equippedOffhand)) this.equipmentRuntime?.equip?.(EQUIPMENT_SLOTS.offhand, equippedOffhand);
  }
}
