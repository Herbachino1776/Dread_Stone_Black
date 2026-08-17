import { NpcArmamentRuntime } from '../combat/NpcArmamentRuntime.js';
import {
  CREATURE_LAB_MACE_LOADOUT,
  CREATURE_LAB_WEAPON_LOADOUTS,
  getCreatureLabLoadoutForWeapon,
} from '../combat/NpcLoadout.js';
import { npcWeaponRegistry } from '../combat/NpcWeaponRegistry.js';

// The historical integration name remains stable for Folsom/Creature Lab.
// M6 replaces its procedural swing with the reusable authored armament runtime.
export class CreatureLabAttackHarness {
  constructor({
    scene,
    playerProvider = null,
    damageReceiverProvider = null,
    weaponRegistry = npcWeaponRegistry,
    defaultLoadout = CREATURE_LAB_MACE_LOADOUT,
  } = {}) {
    this.scene = scene;
    this.playerProvider = playerProvider;
    this.damageReceiverProvider = damageReceiverProvider;
    this.weaponRegistry = weaponRegistry;
    this.defaultLoadout = defaultLoadout;
    this.selectedLoadout = defaultLoadout;
    this.subject = null;
    this.creaturePack = null;
    this.armament = null;
    this.subjectGeneration = 0;
    this.lastClearReason = null;
    this.disposed = false;
  }

  get source() { return this.armament?.physicalSource ?? null; }

  setSubject(actor, { pack = null, loadout = this.selectedLoadout } = {}) {
    if (this.disposed) return { accepted: false, reason: 'attack-harness-disposed' };
    this.clearSubject('creature-lab-subject-replaced');
    this.subject = actor ?? null;
    this.creaturePack = pack ?? null;
    this.selectedLoadout = loadout;
    this.subjectGeneration += 1;
    this.lastClearReason = null;
    if (!this.subject) return { accepted: false, reason: 'creature-lab-subject-unavailable' };
    this.armament = new NpcArmamentRuntime({
      actor: this.subject,
      creaturePack: this.creaturePack,
      loadout,
      weaponRegistry: this.weaponRegistry,
      damageReceiverProvider: this.damageReceiverProvider,
      playerProvider: this.playerProvider,
    });
    return {
      accepted: true,
      subjectInstanceId: this.subject.instanceId ?? null,
      capabilityAvailable: this.armament.capabilityAvailable,
      capabilityReason: this.armament.capabilityReason,
    };
  }

  clearSubject(reason = 'creature-lab-subject-cleared') {
    this.armament?.dispose?.();
    this.armament = null;
    this.subject = null;
    this.creaturePack = null;
    this.lastClearReason = reason;
    return { accepted: true, reason };
  }

  async equip() {
    return await this.armament?.equip?.() ?? { accepted: false, reason: 'creature-lab-armament-unavailable' };
  }

  unequip() {
    return this.armament?.unequip?.('creature-lab-unequip') ?? { accepted: false, reason: 'creature-lab-armament-unavailable' };
  }

  selectOffensiveAction(combatActionId) {
    return this.armament?.selectOffensiveAction?.(combatActionId) ?? { accepted: false, reason: 'creature-lab-armament-unavailable' };
  }

  listWeapons() {
    return CREATURE_LAB_WEAPON_LOADOUTS.map((loadout) => this.weaponRegistry.require(loadout.mainHandWeaponId));
  }

  getSelectedWeaponId() {
    return this.selectedLoadout?.mainHandWeaponId ?? null;
  }

  getSelectedLoadout() {
    return this.selectedLoadout ?? null;
  }

  selectWeapon(weaponId) {
    const loadout = getCreatureLabLoadoutForWeapon(weaponId);
    if (!loadout || !this.weaponRegistry.get(weaponId)) return { accepted: false, reason: `creature-lab-weapon-unavailable:${weaponId}` };
    this.selectedLoadout = loadout;
    const result = this.armament?.setLoadout?.(loadout) ?? { accepted: true, loadoutId: loadout.loadoutId };
    return { ...result, weaponId };
  }

  setCalibrationOverride(calibration) {
    return this.armament?.setCalibrationOverride?.(calibration)
      ?? { accepted: false, reason: 'creature-lab-armament-unavailable' };
  }

  triggerAttack() {
    return this.armament?.triggerAttack?.() ?? { accepted: false, reason: 'creature-lab-armament-unavailable' };
  }

  toggleAttackGeometry() {
    return this.armament?.toggleAttackGeometry?.() ?? { accepted: false, reason: 'creature-lab-armament-unavailable' };
  }

  resetPlayer() {
    const receiver = this.damageReceiverProvider?.();
    const player = this.playerProvider?.();
    receiver?.reset?.();
    player?.reset?.();
    this.armament?.resetCombatState?.();
    return { accepted: Boolean(receiver && player), currentHealth: receiver?.currentHealth ?? null };
  }

  update(deltaSeconds) {
    this.armament?.update?.(deltaSeconds);
  }

  getDiagnostics() {
    const diagnostics = this.armament?.getDiagnostics?.() ?? {
      enabled: false,
      capabilityAvailable: false,
      capabilityReason: this.creaturePack ? 'armament-runtime-unavailable' : 'creature-pack-unavailable',
      equipped: false,
      attackPhase: 'COMPLETE',
      attackId: null,
      acceptedPlayerHitCount: 0,
      showAttackGeometry: false,
      disposed: false,
    };
    return {
      ...diagnostics,
      subjectInstanceId: this.subject?.instanceId ?? null,
      subjectGeneration: this.subjectGeneration,
      lastClearReason: diagnostics.lastClearReason ?? this.lastClearReason,
      harnessDisposed: this.disposed,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.clearSubject('creature-lab-attack-harness-disposed');
    this.disposed = true;
    this.scene = null;
  }
}
