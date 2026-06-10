import { EquipmentInventory } from './EquipmentInventory.js';
import { EQUIPMENT_EVENTS } from './EquipmentEvents.js';
import { logEquipmentDebug } from './EquipmentDebug.js';
import { EQUIPMENT_SLOTS, isKnownEquipmentSlot } from './EquipmentSlot.js';

export class EquipmentRuntime {
  constructor({
    weaponProfiles,
    startingEquipment = {},
  }) {
    this.weaponProfiles = weaponProfiles;
    this.inventory = new EquipmentInventory(startingEquipment.acquiredItemIds ?? ['unarmed']);
    this.equipped = {
      [EQUIPMENT_SLOTS.weapon]: startingEquipment.equipped?.weapon ?? 'unarmed',
      [EQUIPMENT_SLOTS.armor]: startingEquipment.equipped?.armor ?? null,
      [EQUIPMENT_SLOTS.quickItem]: startingEquipment.equipped?.quickItem ?? null,
    };
    this.listeners = new Map();

    if (!this.weaponProfiles[this.equipped.weapon]) {
      console.warn(`Missing starting weapon profile "${this.equipped.weapon}"; falling back to unarmed.`);
      this.equipped.weapon = 'unarmed';
    }
    if (!this.inventory.has('unarmed')) this.inventory.acquire('unarmed', { tags: ['baseline'] });
  }

  on(eventName, listener) {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName).add(listener);
    return () => this.listeners.get(eventName)?.delete(listener);
  }

  emit(eventName, payload) {
    this.listeners.get(eventName)?.forEach((listener) => listener(payload));
  }

  acquireItem(itemId, metadata = {}) {
    const item = this.inventory.acquire(itemId, metadata);
    logEquipmentDebug(`Acquired ${itemId}`, item);
    this.emit(EQUIPMENT_EVENTS.itemAcquired, { item, metadata });
    return item;
  }

  hasItem(itemId) {
    return this.inventory.has(itemId);
  }

  equip(slotId, itemId) {
    if (!isKnownEquipmentSlot(slotId)) {
      console.warn(`Unknown equipment slot "${slotId}".`);
      return false;
    }

    if (itemId && !this.inventory.has(itemId)) {
      console.warn(`Cannot equip missing item "${itemId}".`);
      return false;
    }

    if (slotId === EQUIPMENT_SLOTS.weapon && itemId && !this.weaponProfiles[itemId]) {
      console.warn(`Cannot equip missing weapon profile "${itemId}".`);
      return false;
    }

    const previousItemId = this.equipped[slotId] ?? null;
    this.equipped[slotId] = itemId ?? null;
    logEquipmentDebug(`${slotId} changed`, { previousItemId, itemId: this.equipped[slotId] });
    this.emit(EQUIPMENT_EVENTS.equippedChanged, {
      slotId,
      previousItemId,
      itemId: this.equipped[slotId],
      weaponProfile: this.getEquippedWeaponProfile(),
    });
    return true;
  }

  unequip(slotId) {
    const fallback = slotId === EQUIPMENT_SLOTS.weapon ? 'unarmed' : null;
    return this.equip(slotId, fallback);
  }

  getEquippedWeaponProfile() {
    const weaponId = this.equipped.weapon ?? 'unarmed';
    const profile = this.weaponProfiles[weaponId];
    if (profile) return profile;

    console.warn(`Missing weapon profile "${weaponId}"; using unarmed fallback.`);
    return this.weaponProfiles.unarmed;
  }

  getAvailableWeapons() {
    return Object.values(this.weaponProfiles).filter((profile) => this.inventory.has(profile.id));
  }

  getInventoryItems() {
    return this.inventory.list();
  }

  emitAttack(payload) {
    this.emit(EQUIPMENT_EVENTS.attackResolved, payload);
  }

  getSnapshot() {
    return {
      acquiredItemIds: this.inventory.list().map((item) => item.id),
      equipped: {
        weapon: this.equipped.weapon ?? 'unarmed',
        armor: this.equipped.armor ?? null,
        quickItem: this.equipped.quickItem ?? null,
      },
    };
  }

  loadSnapshot(snapshot = {}) {
    this.inventory.load(['unarmed', ...(snapshot.acquiredItemIds ?? []).filter((id) => id !== 'unarmed')]);
    this.equipped.weapon = snapshot.equipped?.weapon && this.inventory.has(snapshot.equipped.weapon)
      ? snapshot.equipped.weapon
      : 'unarmed';
    this.equipped.armor = snapshot.equipped?.armor ?? null;
    this.equipped.quickItem = snapshot.equipped?.quickItem ?? null;
    this.emit(EQUIPMENT_EVENTS.equippedChanged, {
      slotId: EQUIPMENT_SLOTS.weapon,
      previousItemId: null,
      itemId: this.equipped.weapon,
      weaponProfile: this.getEquippedWeaponProfile(),
    });
  }
}
