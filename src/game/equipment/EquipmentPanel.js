import { EQUIPMENT_SLOTS } from '../../engine/equipment/EquipmentSlot.js';
import { EQUIPMENT_EVENTS } from '../../engine/equipment/EquipmentEvents.js';

export class EquipmentPanel {
  constructor({ root, equipmentRuntime }) {
    this.root = root;
    this.equipmentRuntime = equipmentRuntime;
    this.panel = root.querySelector('[data-equipment-panel]');
    this.weaponList = root.querySelector('[data-equipment="weapon-list"]');
    this.currentWeapon = root.querySelector('[data-equipment="current-weapon"]');
    this.toggleButton = root.querySelector('[data-action="equipment"]');
    this.closeButton = root.querySelector('[data-equipment="close"]');
    this.isOpen = false;

    this.bindEvents();
    this.render();
  }

  bindEvents() {
    this.toggleButton?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.toggle();
    });
    this.closeButton?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.close();
    });
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'KeyE' && event.code !== 'Tab') return;
      event.preventDefault();
      this.toggle();
    });
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.itemAcquired, () => this.render());
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, () => this.render());
  }

  open() {
    this.isOpen = true;
    this.panel?.classList.add('is-open');
    this.panel?.setAttribute('aria-hidden', 'false');
    this.render();
  }

  close() {
    this.isOpen = false;
    this.panel?.classList.remove('is-open');
    this.panel?.setAttribute('aria-hidden', 'true');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  render() {
    const equippedWeapon = this.equipmentRuntime.getEquippedWeaponProfile();
    if (this.currentWeapon) this.currentWeapon.textContent = equippedWeapon.displayName;
    if (!this.weaponList) return;

    this.weaponList.innerHTML = '';
    this.equipmentRuntime.getAvailableWeapons().forEach((weapon) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'equipment-row';
      row.dataset.weaponId = weapon.id;
      row.setAttribute('aria-pressed', String(equippedWeapon.id === weapon.id));
      row.innerHTML = `
        <span class="equipment-row__name">${weapon.displayName}</span>
        <span class="equipment-row__stats">${weapon.damage} DMG / ${weapon.attackRange.toFixed(1)} RNG</span>
        <span class="equipment-row__description">${weapon.description}</span>
      `;
      row.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.equipmentRuntime.equip(EQUIPMENT_SLOTS.weapon, weapon.id);
      });
      this.weaponList.append(row);
    });
  }
}
