import { EQUIPMENT_EVENTS } from '../../engine/equipment/EquipmentEvents.js';
import { fpvWeaponProfiles } from './fpvWeaponProfiles.js';

const warnedMissingProfiles = new Set();

export class FPVEquipmentRenderer {
  constructor({ root, armsOverlay, equipmentRuntime }) {
    this.root = root;
    this.armsOverlay = armsOverlay;
    this.equipmentRuntime = equipmentRuntime;
    this.weaponLayer = root.querySelector('[data-fpv-equipment-layer]');
    this.currentProfileId = null;

    this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, ({ weaponProfile }) => {
      this.setWeaponProfile(weaponProfile);
    });
    this.setWeaponProfile(this.equipmentRuntime.getEquippedWeaponProfile());
  }

  setWeaponProfile(weaponProfile) {
    const fpvProfileId = weaponProfile?.fpvProfileId ?? 'unarmed';
    const fpvProfile = fpvWeaponProfiles[fpvProfileId] ?? fpvWeaponProfiles.unarmed;
    if (!fpvWeaponProfiles[fpvProfileId] && !warnedMissingProfiles.has(fpvProfileId)) {
      warnedMissingProfiles.add(fpvProfileId);
      console.warn(`Missing FPV weapon profile "${fpvProfileId}"; using unarmed fallback.`);
    }

    if (this.currentProfileId === fpvProfile.id) return;
    this.currentProfileId = fpvProfile.id;
    this.armsOverlay.play(fpvProfile.baseClip);
    this.renderWeaponLayer(fpvProfile, weaponProfile);
  }

  renderWeaponLayer(fpvProfile, weaponProfile) {
    if (!this.weaponLayer) return;

    this.weaponLayer.className = 'first-person-weapon';
    this.weaponLayer.dataset.weaponId = weaponProfile?.id ?? fpvProfile.id;
    this.weaponLayer.hidden = fpvProfile.weaponLayer === 'none';

    if (fpvProfile.weaponLayer === 'sword-placeholder') {
      this.weaponLayer.classList.add('first-person-weapon--rusted-sword');
      this.weaponLayer.title = 'Rusted Sword FPV placeholder';
    }
  }

  playAttack(weaponProfile) {
    this.setWeaponProfile(weaponProfile);
    if (!this.weaponLayer || this.weaponLayer.hidden) return;

    this.weaponLayer.classList.remove('is-attacking');
    void this.weaponLayer.offsetWidth;
    this.weaponLayer.classList.add('is-attacking');
  }
}
