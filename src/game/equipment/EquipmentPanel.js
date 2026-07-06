import { EQUIPMENT_SLOTS } from '../../engine/equipment/EquipmentSlot.js';
import { EQUIPMENT_EVENTS } from '../../engine/equipment/EquipmentEvents.js';
import { SurvivalInventoryBridge } from './SurvivalInventoryBridge.js';

const POCKETS = Object.freeze([
  { id: 'weapons', label: 'Weapons', icon: '⚔' },
  { id: 'items', label: 'Items', icon: '♟' },
  { id: 'keyItems', label: 'Key Items', icon: '⚿' },
  { id: 'offhand', label: 'Offhand', icon: '◈' },
]);

const ITEM_DETAILS = Object.freeze({
  wood_axe: { type: 'Axe', damage: '6–10', weight: '2.0', icon: '🪓' },
  fishing_rod: { type: 'Tool', damage: '2', weight: '1.5', icon: '╱' },
  wood: { type: 'Material', restore: null, icon: '▰' },
  raw_fish: { type: 'Food', use: 'Cook at campfire', icon: '🐟' },
  cooked_fish: { type: 'Food', restore: '50%', icon: '◒' },
  flint_stick: { type: 'Key Item', use: 'Start campfires', icon: '⚿' },
  old_work_knife: { type: 'Work Tool', use: 'Cut tough fibers', weight: '0.6', icon: '╱' },
  iron_drain_bar: { type: 'Work Tool', use: 'Pry old ironwork', weight: '3.8', icon: '━' },
  keepers_lantern: { type: 'Offhand Utility', use: 'Reveal buried traces', weight: '1.8', light: 'Cold', icon: '◈' },
  torch: { type: 'Offhand', light: 'Yes', icon: '♨' },
});

export class EquipmentPanel {
  constructor({ root, equipmentRuntime, gameState = null }) {
    this.root = root;
    this.equipmentRuntime = equipmentRuntime;
    this.gameState = gameState;
    this.survivalInventory = new SurvivalInventoryBridge({ equipmentRuntime, gameState });
    this.panel = root.querySelector('[data-equipment-panel]');
    this.stopPanelEvent = (event) => event.stopPropagation();
    this.currentWeapon = root.querySelector('[data-equipment="current-weapon"]');
    this.pocketTabs = root.querySelector('[data-inventory="pocket-tabs"]');
    this.inventoryList = root.querySelector('[data-inventory="list"]');
    this.detailCard = root.querySelector('[data-inventory="detail"]');
    this.toggleButton = root.querySelector('[data-action="equipment"]');
    this.closeButton = root.querySelector('[data-equipment="close"]');
    this.activePocket = 'weapons';
    this.selectedByPocket = { weapons: null, items: null, keyItems: null, offhand: null };
    this.isOpen = false;

    this.bindEvents();
    this.render();
  }

  bindEvents() {
    this.toggleButton?.addEventListener('pointerdown', (event) => { event.preventDefault(); this.toggle(); });
    this.closeButton?.addEventListener('pointerdown', (event) => { event.preventDefault(); this.close(); });
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'KeyE' && event.code !== 'Tab') return;
      event.preventDefault();
      this.toggle();
    });
    ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'wheel'].forEach((eventName) => {
      this.panel?.addEventListener(eventName, this.stopPanelEvent, { passive: eventName !== 'wheel' });
    });
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.itemAcquired, () => this.render());
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, () => this.render());
    window.addEventListener('field-item-equipped-changed', () => this.render());
  }

  open() { this.isOpen = true; this.panel?.classList.add('is-open'); this.panel?.setAttribute('aria-hidden', 'false'); this.render(); }
  close() { this.isOpen = false; this.panel?.classList.remove('is-open'); this.panel?.setAttribute('aria-hidden', 'true'); }
  toggle() { if (this.isOpen) this.close(); else this.open(); }

  render() {
    const equippedWeapon = this.equipmentRuntime.getEquippedWeaponProfile();
    if (this.currentWeapon) this.currentWeapon.textContent = equippedWeapon.displayName;
    this.renderTabs();
    this.renderPocket(equippedWeapon);
  }

  renderTabs() {
    if (!this.pocketTabs) return;
    this.pocketTabs.innerHTML = '';
    POCKETS.forEach((pocket) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'inventory-tab';
      tab.setAttribute('aria-pressed', String(this.activePocket === pocket.id));
      tab.innerHTML = `<span class="inventory-tab__icon" aria-hidden="true">${pocket.icon}</span><span>${pocket.label}</span>`;
      tab.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.activePocket = pocket.id;
        this.render();
      });
      this.pocketTabs.append(tab);
    });
  }

  renderPocket(equippedWeapon) {
    if (!this.inventoryList) return;
    const entries = this.getPocketEntries(equippedWeapon);
    if (!this.selectedByPocket[this.activePocket] || !entries.some((entry) => entry.id === this.selectedByPocket[this.activePocket])) {
      this.selectedByPocket[this.activePocket] = entries[0]?.id ?? null;
    }
    this.renderDetail(entries.find((entry) => entry.id === this.selectedByPocket[this.activePocket]) ?? null);
    this.inventoryList.innerHTML = '';
    entries.forEach((entry) => this.inventoryList.append(this.createRow(entry)));
    if (!entries.length) this.renderEmpty(this.getEmptyMessage());
  }

  getPocketEntries(equippedWeapon) {
    if (this.activePocket === 'weapons') return this.equipmentRuntime.getAvailableWeapons()
      .filter((weapon) => weapon.id !== 'unarmed')
      .map((weapon) => this.createWeaponEntry(weapon, equippedWeapon));
    if (this.activePocket === 'items') return this.createItemEntries();
    if (this.activePocket === 'keyItems') return this.createKeyItemEntries();
    return this.createOffhandEntries();
  }

  createWeaponEntry(weapon, equippedWeapon) {
    const details = ITEM_DETAILS[weapon.id] ?? {};
    const equipped = equippedWeapon.id === weapon.id;
    return {
      id: weapon.id,
      name: weapon.displayName,
      stats: equipped ? 'Equipped' : `${details.damage ?? weapon.damage} DMG`,
      meta: details.weight ?? '—',
      description: weapon.description,
      equipped,
      detail: { ...details, damage: details.damage ?? weapon.damage, type: details.type ?? weapon.weaponType ?? 'Weapon' },
      onActivate: () => {
        const isEquipped = this.equipmentRuntime.getEquippedWeaponProfile().id === weapon.id;
        const nextWeaponId = isEquipped ? 'unarmed' : weapon.id;
        if (['wood_axe', 'fishing_rod'].includes(weapon.id)) {
          this.survivalInventory.equipWeapon(isEquipped ? null : weapon.id);
        } else {
          this.equipmentRuntime.equip(EQUIPMENT_SLOTS.weapon, nextWeaponId);
        }
      },
    };
  }

  createItemEntries() {
    const equippedItem = this.survivalInventory.getEquippedConsumable();
    const items = [
      ['wood', 'Wood', 'Campfire fuel.'],
      ['raw_fish', 'Raw Fish', 'Can be cooked at a campfire.'],
      ['cooked_fish', 'Cooked Fish', 'Restores hunger when eaten.'],
    ];
    return items.flatMap(([id, name, description]) => {
      const count = this.survivalInventory.getItemCount(id);
      if (count < 1) return [];
      return [{
        id, name, description, quantity: count,
        stats: equippedItem === id ? `Equipped · x${count}` : `x${count}`,
        meta: ITEM_DETAILS[id]?.use ?? ITEM_DETAILS[id]?.restore ?? '',
        equipped: equippedItem === id,
        detail: ITEM_DETAILS[id],
        onActivate: () => {
          const nextItem = this.survivalInventory.getEquippedConsumable() === id ? null : id;
          if (!this.survivalInventory.equipConsumable(nextItem)) this.survivalInventory.equipConsumable(null);
          window.dispatchEvent(new CustomEvent('field-item-equipped-changed'));
        },
      }];
    });
  }

  createOffhandEntries() {
    const equippedOffhand = this.survivalInventory.getEquippedOffhand();
    const offhands = [
      { id: 'torch', name: 'Torch', meta: 'Warm Light', description: 'A wooden torch wrapped in cloth. Provides light in dark places.' },
      { id: 'keepers_lantern', name: "Keeper's Lantern", meta: 'Cold Reveal', description: 'A hanging keeper lantern with clouded glass and a weak cold lens.' },
    ];
    return offhands.filter(({ id }) => this.survivalInventory.hasItem(id)).map(({ id, name, meta, description }) => ({
      id, name, stats: equippedOffhand === id ? 'Equipped' : 'Offhand', meta,
      description, equipped: equippedOffhand === id, detail: ITEM_DETAILS[id],
      onActivate: () => {
        const isEquipped = this.survivalInventory.getEquippedOffhand() === id;
        if (this.survivalInventory.equipOffhand(isEquipped ? null : id)) {
          window.dispatchEvent(new CustomEvent('field-offhand-equipped-changed'));
        }
      },
    }));
  }

  createKeyItemEntries() {
    const entries = [];
    if (this.survivalInventory.hasKeyItem('flint_stick')) entries.push({ id: 'flint_stick', name: 'Flint Stick', stats: 'Key Item', meta: 'Campfire', description: 'Reusable campfire starter.', detail: ITEM_DETAILS.flint_stick });
    if (this.equipmentRuntime.hasItem('old_work_knife')) entries.push({ id: 'old_work_knife', name: 'Old Work Knife', stats: 'Work Tool', meta: 'Cutting', description: 'A short rusted shed knife with a worn wooden grip.', detail: ITEM_DETAILS.old_work_knife });
    if (this.equipmentRuntime.hasItem('iron_drain_bar')) entries.push({ id: 'iron_drain_bar', name: 'Iron Drain Bar', stats: 'Work Tool', meta: 'Prying', description: 'A heavy rusted maintenance bar from the old drains.', detail: ITEM_DETAILS.iron_drain_bar });
    return entries;
  }

  renderDetail(entry) {
    if (!this.detailCard) return;
    if (!entry) {
      this.detailCard.innerHTML = '<p class="inventory-empty">No item selected.</p>';
      return;
    }
    const detail = entry.detail ?? {};
    const rows = [
      ['TYPE', detail.type], ['DAMAGE', detail.damage], ['WEIGHT', detail.weight], ['LIGHT', detail.light], ['RESTORE', detail.restore], ['USE', detail.use],
    ].filter(([, value]) => value);
    this.detailCard.innerHTML = `
      <div class="inventory-detail__icon" aria-hidden="true">${detail.icon ?? '◆'}</div>
      <div class="inventory-detail__body">
        <div class="inventory-detail__top"><h3>${entry.name}</h3>${entry.equipped ? '<span>Equipped</span>' : ''}</div>
        <p>${entry.description}</p>
        <dl>${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
      </div>`;
  }

  createRow(entry) {
    const row = document.createElement(entry.onActivate ? 'button' : 'div');
    if (entry.onActivate) row.type = 'button';
    row.className = 'equipment-row';
    row.dataset.itemId = entry.id;
    const selected = this.selectedByPocket[this.activePocket] === entry.id;
    row.setAttribute('aria-pressed', String(selected || entry.equipped));
    row.innerHTML = `<span class="equipment-row__icon" aria-hidden="true">${entry.detail?.icon ?? '◆'}</span><span class="equipment-row__name">${entry.name}</span><span class="equipment-row__stats">${entry.stats}</span><span class="equipment-row__description">${entry.description}</span><span class="equipment-row__meta">${entry.meta ?? ''}</span>`;
    if (entry.onActivate) row.addEventListener('click', (event) => {
      event.preventDefault();
      const wasSelected = this.selectedByPocket[this.activePocket] === entry.id;
      this.selectedByPocket[this.activePocket] = entry.id;
      if (wasSelected) entry.onActivate(); else this.render();
    });
    return row;
  }

  getEmptyMessage() {
    return { weapons: 'No weapons.', items: 'No items.', keyItems: 'No key items.', offhand: 'No offhand gear.' }[this.activePocket];
  }

  renderEmpty(message) {
    const empty = document.createElement('p');
    empty.className = 'inventory-empty';
    empty.textContent = message;
    this.inventoryList.append(empty);
  }
}
