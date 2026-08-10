import { FORGE_OFFENSIVE_ACTION_SCHEMA } from '../../contracts/ForgeRuntimeArmament.js';

export const NPC_LOADOUT_SCHEMA = 'dreadstone.npc_loadout.v1';
const STABLE_ID = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;

export const CREATURE_LAB_MACE_LOADOUT = Object.freeze({
  schema: NPC_LOADOUT_SCHEMA,
  loadoutId: 'creature_lab_mace_main_hand',
  mainHandWeaponId: 'dreadstone_lab_mace',
  offensiveActionIds: Object.freeze([
    'humanoid_one_hand_slash_rtl',
    'humanoid_one_hand_slash_ltr',
    'humanoid_one_hand_overhead',
    'humanoid_one_hand_heavy',
  ]),
});

export function validateNpcLoadout(loadout) {
  const errors = [];
  if (!loadout || typeof loadout !== 'object' || Array.isArray(loadout)) return { valid: false, errors: ['loadout must be an object'] };
  if (loadout.schema !== NPC_LOADOUT_SCHEMA) errors.push(`loadout.schema must be ${NPC_LOADOUT_SCHEMA}`);
  if (typeof loadout.loadoutId !== 'string' || !STABLE_ID.test(loadout.loadoutId)) errors.push('loadout.loadoutId must be a stable lowercase identifier');
  if (typeof loadout.mainHandWeaponId !== 'string' || !STABLE_ID.test(loadout.mainHandWeaponId)) errors.push('loadout.mainHandWeaponId must be a stable lowercase identifier');
  if (!Array.isArray(loadout.offensiveActionIds) || !loadout.offensiveActionIds.length || !loadout.offensiveActionIds.every((id) => typeof id === 'string' && STABLE_ID.test(id)) || new Set(loadout.offensiveActionIds).size !== loadout.offensiveActionIds.length) {
    errors.push('loadout.offensiveActionIds must contain unique stable IDs');
  }
  return { valid: errors.length === 0, errors };
}

export function resolveNpcLoadout({ loadout, weaponRegistry, offensiveActions }) {
  const validation = validateNpcLoadout(loadout);
  if (!validation.valid) throw new Error(`Invalid ${NPC_LOADOUT_SCHEMA}: ${validation.errors.join('; ')}`);
  const weapon = weaponRegistry.require(loadout.mainHandWeaponId);
  if (offensiveActions?.schema !== FORGE_OFFENSIVE_ACTION_SCHEMA || !offensiveActions.available) {
    throw new Error('Creature Pack offensive Action capability is unavailable');
  }
  const requested = new Set(loadout.offensiveActionIds);
  const compatibleActions = offensiveActions.actions.filter((action) => (
    requested.has(action.combatActionId)
    && action.compatibleWeaponClasses.includes(weapon.weaponClass)
    && weapon.compatibleSocketRoles.includes(action.socketRole)
  ));
  if (!compatibleActions.length) throw new Error(`Loadout ${loadout.loadoutId} has no compatible Forge offensive Action for ${weapon.weaponId}`);
  return { loadout, weapon, compatibleActions };
}
