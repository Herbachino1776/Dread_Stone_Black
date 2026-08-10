import { FORGE_OFFENSIVE_ACTION_SCHEMA } from '../../contracts/ForgeRuntimeArmament.js';
import { npcWeaponRegistry } from './NpcWeaponRegistry.js';

export const NPC_LOADOUT_SCHEMA = 'dreadstone.npc_loadout.v1';
const STABLE_ID = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;

function loadout(loadoutId, mainHandWeaponId, allowedOffensiveActionIds) {
  return Object.freeze({
    schema: NPC_LOADOUT_SCHEMA,
    loadoutId,
    mainHandWeaponId,
    allowedOffensiveActionIds: Object.freeze([...allowedOffensiveActionIds]),
  });
}

export const HUMANOID_DREADSTONE_MACE_MAIN_HAND_LOADOUT = loadout(
  'humanoid_dreadstone_mace_main_hand',
  'dreadstone_mace',
  [
    'humanoid_one_hand_slash_rtl',
    'humanoid_one_hand_slash_ltr',
    'humanoid_one_hand_overhead',
    'humanoid_one_hand_heavy',
  ],
);

export const HUMANOID_DREADSTONE_SWORD_MAIN_HAND_LOADOUT = loadout(
  'humanoid_dreadstone_sword_main_hand',
  'dreadstone_sword',
  [
    'humanoid_one_hand_slash_rtl',
    'humanoid_one_hand_slash_ltr',
    'humanoid_one_hand_overhead',
  ],
);

export const HUMANOID_OLD_WORK_KNIFE_MAIN_HAND_LOADOUT = loadout(
  'humanoid_old_work_knife_main_hand',
  'old_work_knife',
  [
    'humanoid_one_hand_slash_rtl',
    'humanoid_one_hand_slash_ltr',
  ],
);

export const PRODUCTION_NPC_LOADOUTS = Object.freeze([
  HUMANOID_DREADSTONE_MACE_MAIN_HAND_LOADOUT,
  HUMANOID_DREADSTONE_SWORD_MAIN_HAND_LOADOUT,
  HUMANOID_OLD_WORK_KNIFE_MAIN_HAND_LOADOUT,
]);

// Stable compatibility aliases for the existing Creature Lab API. The records
// themselves are production-neutral and no longer carry Lab-specific IDs.
export const CREATURE_LAB_DREADSTONE_MACE_LOADOUT = HUMANOID_DREADSTONE_MACE_MAIN_HAND_LOADOUT;
export const CREATURE_LAB_DREADSTONE_SWORD_LOADOUT = HUMANOID_DREADSTONE_SWORD_MAIN_HAND_LOADOUT;
export const CREATURE_LAB_OLD_WORK_KNIFE_LOADOUT = HUMANOID_OLD_WORK_KNIFE_MAIN_HAND_LOADOUT;
export const CREATURE_LAB_WEAPON_LOADOUTS = PRODUCTION_NPC_LOADOUTS;
export const CREATURE_LAB_MACE_LOADOUT = CREATURE_LAB_DREADSTONE_MACE_LOADOUT;

function actionIds(value) {
  return value?.allowedOffensiveActionIds ?? value?.offensiveActionIds;
}

export function validateNpcLoadout(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { valid: false, errors: ['loadout must be an object'] };
  if (value.schema !== NPC_LOADOUT_SCHEMA) errors.push(`loadout.schema must be ${NPC_LOADOUT_SCHEMA}`);
  if (typeof value.loadoutId !== 'string' || !STABLE_ID.test(value.loadoutId)) errors.push('loadout.loadoutId must be a stable lowercase identifier');
  if (typeof value.mainHandWeaponId !== 'string' || !STABLE_ID.test(value.mainHandWeaponId)) errors.push('loadout.mainHandWeaponId must be a stable lowercase identifier');
  if (value.allowedOffensiveActionIds != null && value.offensiveActionIds != null) {
    errors.push('loadout must not define both allowedOffensiveActionIds and legacy offensiveActionIds');
  }
  const ids = actionIds(value);
  if (!Array.isArray(ids) || !ids.length || !ids.every((id) => typeof id === 'string' && STABLE_ID.test(id)) || new Set(ids).size !== ids.length) {
    errors.push('loadout.allowedOffensiveActionIds must contain unique stable IDs');
  }
  return { valid: errors.length === 0, errors };
}

export class NpcLoadoutRegistryError extends Error {
  constructor(code, message, options = {}) {
    super(`[NPC Loadout Registry:${code}] ${message}`, options);
    this.name = 'NpcLoadoutRegistryError';
    this.code = code;
  }
}

export class NpcLoadoutRegistry {
  constructor({ loadouts = PRODUCTION_NPC_LOADOUTS } = {}) {
    if (!Array.isArray(loadouts)) throw new NpcLoadoutRegistryError('INVALID_REGISTRY', 'loadouts must be an array.');
    this.loadouts = new Map();
    loadouts.forEach((candidate, index) => {
      const validation = validateNpcLoadout(candidate);
      if (!validation.valid) {
        throw new NpcLoadoutRegistryError('INVALID_LOADOUT', `loadouts[${index}]: ${validation.errors.join('; ')}`);
      }
      if (this.loadouts.has(candidate.loadoutId)) {
        throw new NpcLoadoutRegistryError('DUPLICATE_LOADOUT', `loadoutId "${candidate.loadoutId}" is registered more than once.`);
      }
      const stored = loadout(candidate.loadoutId, candidate.mainHandWeaponId, actionIds(candidate));
      this.loadouts.set(stored.loadoutId, stored);
    });
  }

  list() {
    return [...this.loadouts.values()];
  }

  get(loadoutId) {
    return this.loadouts.get(loadoutId) ?? null;
  }

  require(loadoutId) {
    const value = this.get(loadoutId);
    if (!value) throw new NpcLoadoutRegistryError('UNKNOWN_LOADOUT', `No registered NPC Loadout has loadoutId "${loadoutId}".`);
    return value;
  }
}

export const npcLoadoutRegistry = new NpcLoadoutRegistry();

export function resolveNpcLoadout({
  loadout: value = null,
  loadoutId = null,
  loadoutRegistry = npcLoadoutRegistry,
  weaponRegistry = npcWeaponRegistry,
  offensiveActions,
} = {}) {
  const selectedLoadout = value ?? loadoutRegistry.require(loadoutId);
  const validation = validateNpcLoadout(selectedLoadout);
  if (!validation.valid) throw new Error(`Invalid ${NPC_LOADOUT_SCHEMA}: ${validation.errors.join('; ')}`);
  const weapon = weaponRegistry.require(selectedLoadout.mainHandWeaponId);
  if (offensiveActions?.schema !== FORGE_OFFENSIVE_ACTION_SCHEMA || !offensiveActions.available) {
    throw new Error('Creature Pack offensive Action capability is unavailable');
  }
  const requested = new Set(actionIds(selectedLoadout));
  const compatibleActions = offensiveActions.actions.filter((action) => (
    requested.has(action.combatActionId)
    && action.compatibleWeaponClasses.includes(weapon.weaponClass)
    && weapon.compatibleSocketRoles.includes(action.socketRole)
  ));
  if (!compatibleActions.length) throw new Error(`Loadout ${selectedLoadout.loadoutId} has no compatible Forge offensive Action for ${weapon.weaponId}`);
  return Object.freeze({
    loadout: selectedLoadout,
    weapon,
    compatibleActions: Object.freeze([...compatibleActions]),
  });
}

export function getCreatureLabLoadoutForWeapon(weaponId) {
  return PRODUCTION_NPC_LOADOUTS.find((entry) => entry.mainHandWeaponId === weaponId) ?? null;
}
