import { EQUIPMENT_SLOTS } from '../../engine/equipment/EquipmentSlot.js';
import { EQUIPMENT_EVENTS } from '../../engine/equipment/EquipmentEvents.js';

const POCKETS = Object.freeze([
  { id: 'weapons', label: 'Weapons' },
  { id: 'items', label: 'Items' },
  { id: 'keyItems', label: 'Key Items' },
  { id: 'offhand', label: 'Offhand' },
]);

export class EquipmentPanel {
  constructor({ root, equipmentRuntime, gameState = null }) {
    this.root = root;
    this.equipmentRuntime = equipmentRuntime;
    this.gameState = gameState;
    this.panel = root.querySelector('[data-equipment-panel]');
    this.currentWeapon = root.querySelector('[data-equipment="current-weapon"]');
    this.pocketTabs = root.querySelector('[data-inventory="pocket-tabs"]');
    this.inventoryList = root.querySelector('[data-inventory="list"]');
    this.toggleButton = root.querySelector('[data-action="equipment"]');
    this.closeButton = root.querySelector('[data-equipment="close"]');
    this.activePocket = 'weapons';
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
      tab.textContent = pocket.label;
      tab.setAttribute('aria-pressed', String(this.activePocket === pocket.id));
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
    this.inventoryList.innerHTML = '';
    if (this.activePocket === 'weapons') return this.renderWeapons(equippedWeapon);
    if (this.activePocket === 'items') return this.renderItems();
    if (this.activePocket === 'keyItems') return this.renderKeyItems();
    return this.renderOffhand();
  }

  renderWeapons(equippedWeapon) {
    this.equipmentRuntime.getAvailableWeapons().filter((weapon) => weapon.id !== 'unarmed').forEach((weapon) => {
      this.inventoryList.append(this.createRow({
        id: weapon.id,
        name: weapon.displayName,
        stats: equippedWeapon.id === weapon.id ? 'Equipped' : `${weapon.damage} DMG`,
        description: weapon.description,
        pressed: equippedWeapon.id === weapon.id,
        onSelect: () => {
          const isEquipped = this.equipmentRuntime.getEquippedWeaponProfile().id === weapon.id;
          if (this.equipmentRuntime.equip(EQUIPMENT_SLOTS.weapon, isEquipped ? 'unarmed' : weapon.id)) {
            this.gameState?.equipFieldTool?.(!isEquipped && weapon.id === 'wood_axe' ? 'wood_axe' : null);
          }
        },
      }));
    });
    if (!this.inventoryList.children.length) this.renderEmpty('No weapons.');
  }

  renderItems() {
    const wood = this.gameState?.getFieldItemCount?.('wood') ?? 0;
    const equippedItem = this.gameState?.getEquippedFieldItem?.();
    if (wood > 0) {
      this.inventoryList.append(this.createRow({
        id: 'wood',
        name: 'Wood',
        stats: equippedItem === 'wood' ? `Equipped · x${wood}` : `x${wood}`,
        description: 'Campfire fuel.',
        pressed: equippedItem === 'wood',
        onSelect: () => {
          const nextItem = this.gameState?.getEquippedFieldItem?.() === 'wood' ? null : 'wood';
          if (!this.gameState?.equipFieldItem?.(nextItem)) this.gameState?.equipFieldItem?.(null);
          window.dispatchEvent(new CustomEvent('field-item-equipped-changed'));
        },
      }));
    } else {
      this.renderEmpty('No items.');
    }
  }

  renderOffhand() {
    if (this.gameState?.hasFieldOffhandItem?.('torch') || this.equipmentRuntime?.hasItem?.('torch')) {
      const equippedOffhand = this.equipmentRuntime?.getEquippedOffhandId?.() ?? this.gameState?.getEquippedFieldOffhand?.();
      this.inventoryList.append(this.createRow({
        id: 'torch',
        name: 'Torch',
        stats: equippedOffhand === 'torch' ? 'Equipped' : 'Offhand',
        description: 'Left-hand utility light.',
        pressed: equippedOffhand === 'torch',
        onSelect: () => {
          const isEquipped = this.equipmentRuntime?.getEquippedOffhandId?.() === 'torch';
          if (this.equipmentRuntime?.equip(EQUIPMENT_SLOTS.offhand, isEquipped ? null : 'torch')) {
            this.gameState?.equipFieldOffhand?.(isEquipped ? null : 'torch');
            window.dispatchEvent(new CustomEvent('field-offhand-equipped-changed'));
          }
        },
      }));
    } else {
      this.renderEmpty('No offhand gear.');
    }
  }

  renderKeyItems() {
    if (this.gameState?.hasFieldKeyItem?.('flint_stick')) {
      this.inventoryList.append(this.createRow({ id: 'flint_stick', name: 'Flint Stick', stats: 'Key Item', description: 'Reusable campfire starter.' }));
    } else {
      this.renderEmpty('No key items.');
    }
  }

  createRow({ id, name, stats, description, pressed = false, onSelect = null }) {
    const row = document.createElement(onSelect ? 'button' : 'div');
    if (onSelect) row.type = 'button';
    row.className = 'equipment-row';
    row.dataset.itemId = id;
    row.setAttribute('aria-pressed', String(pressed));
    row.innerHTML = `<span class="equipment-row__name">${name}</span><span class="equipment-row__stats">${stats}</span><span class="equipment-row__description">${description}</span>`;
    if (onSelect) row.addEventListener('pointerdown', (event) => { event.preventDefault(); onSelect(); });
    return row;
  }

  renderEmpty(message) {
    const empty = document.createElement('p');
    empty.className = 'inventory-empty';
    empty.textContent = message;
    this.inventoryList.append(empty);
  }
}
