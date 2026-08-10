import { FORGE_OFFENSIVE_ACTION_SCHEMA } from '../../contracts/ForgeRuntimeArmament.js';

export const NPC_LOADOUT_SCHEMA = 'dreadstone.npc_loadout.v1';
const STABLE_ID = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;

function loadout(loadoutId, mainHandWeaponId, offensiveActionIds) {
  return Object.freeze({
    schema: NPC_LOADOUT_SCHEMA,
    loadoutId,
    mainHandWeaponId,
    offensiveActionIds: Object.freeze(offensiveActionIds),
  });
}

export const CREATURE_LAB_DREADSTONE_MACE_LOADOUT = loadout(
  'creature_lab_dreadstone_mace_main_hand',
  'dreadstone_mace',
  [
    'humanoid_one_hand_slash_rtl',
    'humanoid_one_hand_slash_ltr',
    'humanoid_one_hand_overhead',
    'humanoid_one_hand_heavy',
  ],
);

export const CREATURE_LAB_DREADSTONE_SWORD_LOADOUT = loadout(
  'creature_lab_dreadstone_sword_main_hand',
  'dreadstone_sword',
  [
    'humanoid_one_hand_slash_rtl',
    'humanoid_one_hand_slash_ltr',
    'humanoid_one_hand_overhead',
  ],
);

export const CREATURE_LAB_OLD_WORK_KNIFE_LOADOUT = loadout(
  'creature_lab_old_work_knife_main_hand',
  'old_work_knife',
  [
    'humanoid_one_hand_slash_rtl',
    'humanoid_one_hand_slash_ltr',
  ],
);

export const CREATURE_LAB_WEAPON_LOADOUTS = Object.freeze([
  CREATURE_LAB_DREADSTONE_MACE_LOADOUT,
  CREATURE_LAB_DREADSTONE_SWORD_LOADOUT,
  CREATURE_LAB_OLD_WORK_KNIFE_LOADOUT,
]);

// Retained as an API alias for callers introduced in M6; it now resolves the
// real Dreadstone Mace GLB rather than the removed procedural lab placeholder.
export const CREATURE_LAB_MACE_LOADOUT = CREATURE_LAB_DREADSTONE_MACE_LOADOUT;

export function validateNpcLoadout(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { valid: false, errors: ['loadout must be an object'] };
  if (value.schema !== NPC_LOADOUT_SCHEMA) errors.push(`loadout.schema must be ${NPC_LOADOUT_SCHEMA}`);
  if (typeof value.loadoutId !== 'string' || !STABLE_ID.test(value.loadoutId)) errors.push('loadout.loadoutId must be a stable lowercase identifier');
  if (typeof value.mainHandWeaponId !== 'string' || !STABLE_ID.test(value.mainHandWeaponId)) errors.push('loadout.mainHandWeaponId must be a stable lowercase identifier');
  if (!Array.isArray(value.offensiveActionIds) || !value.offensiveActionIds.length || !value.offensiveActionIds.every((id) => typeof id === 'string' && STABLE_ID.test(id)) || new Set(value.offensiveActionIds).size !== value.offensiveActionIds.length) {
    errors.push('loadout.offensiveActionIds must contain unique stable IDs');
  }
  return { valid: errors.length === 0, errors };
}

export function resolveNpcLoadout({ loadout: value, weaponRegistry, offensiveActions }) {
  const validation = validateNpcLoadout(value);
  if (!validation.valid) throw new Error(`Invalid ${NPC_LOADOUT_SCHEMA}: ${validation.errors.join('; ')}`);
  const weapon = weaponRegistry.require(value.mainHandWeaponId);
  if (offensiveActions?.schema !== FORGE_OFFENSIVE_ACTION_SCHEMA || !offensiveActions.available) {
    throw new Error('Creature Pack offensive Action capability is unavailable');
  }
  const requested = new Set(value.offensiveActionIds);
  const compatibleActions = offensiveActions.actions.filter((action) => (
    requested.has(action.combatActionId)
    && action.compatibleWeaponClasses.includes(weapon.weaponClass)
    && weapon.compatibleSocketRoles.includes(action.socketRole)
  ));
  if (!compatibleActions.length) throw new Error(`Loadout ${value.loadoutId} has no compatible Forge offensive Action for ${weapon.weaponId}`);
  return { loadout: value, weapon, compatibleActions };
}

export function getCreatureLabLoadoutForWeapon(weaponId) {
  return CREATURE_LAB_WEAPON_LOADOUTS.find((entry) => entry.mainHandWeaponId === weaponId) ?? null;
}
