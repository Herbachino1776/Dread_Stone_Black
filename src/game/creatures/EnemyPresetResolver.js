import { NpcLoadoutRegistry, resolveNpcLoadout } from '../combat/NpcLoadout.js';
import { NpcWeaponRegistry, resolveNpcWeaponDefinitionOverride } from '../combat/NpcWeaponRegistry.js';
import { CreatureDefinitionRegistry } from './CreatureDefinitionRegistry.js';
import { CreatureFactory } from './CreatureFactory.js';
import { CreaturePackRegistry } from './CreaturePackRegistry.js';
import { composeCreaturePresentationHeight } from './CreaturePresentationResolution.js';
import { EnemyPresetRegistry } from './EnemyPresetRegistry.js';
import { LootProfileRegistry } from '../economy/LootProfileRegistry.js';

export class EnemyPresetResolverError extends Error {
  constructor(code, message, options = {}) {
    super(`[Enemy Preset Resolver:${code}] ${message}`, options);
    this.name = 'EnemyPresetResolverError';
    this.code = code;
  }
}

export class EnemyPresetResolver {
  constructor({
    presetRegistry = new EnemyPresetRegistry(),
    definitionRegistry = new CreatureDefinitionRegistry(),
    creaturePackRegistry = new CreaturePackRegistry(),
    creatureFactory = null,
    loadoutRegistry = new NpcLoadoutRegistry(),
    weaponRegistry = new NpcWeaponRegistry(),
    lootProfileRegistry = new LootProfileRegistry(),
  } = {}) {
    this.presetRegistry = presetRegistry;
    this.definitionRegistry = definitionRegistry;
    this.creaturePackRegistry = creaturePackRegistry;
    this.creatureFactory = creatureFactory ?? new CreatureFactory({
      definitionRegistry,
      creaturePackRegistry,
    });
    this.loadoutRegistry = loadoutRegistry;
    this.weaponRegistry = weaponRegistry;
    this.lootProfileRegistry = lootProfileRegistry;
  }

  async resolve(presetId) {
    let preset;
    try {
      preset = this.presetRegistry.getPreset(presetId);
    } catch (error) {
      throw new EnemyPresetResolverError(error.code ?? 'UNKNOWN_PRESET', error.message, { cause: error });
    }

    let lootProfile = null;
    if (preset.rewards?.lootProfileId) {
      try {
        lootProfile = this.lootProfileRegistry.getProfile(preset.rewards.lootProfileId);
      } catch (error) {
        throw new EnemyPresetResolverError(error.code ?? 'UNKNOWN_LOOT_PROFILE', `Enemy Preset "${presetId}" could not resolve Loot Profile "${preset.rewards.lootProfileId}": ${error.message}`, { cause: error });
      }
    }

    let creature;
    try {
      creature = await this.creatureFactory.resolve(preset.creatureDefinitionId);
    } catch (error) {
      throw new EnemyPresetResolverError(error.code ?? 'CREATURE_RESOLUTION_FAILED', `Enemy Preset "${presetId}" could not resolve Creature Definition "${preset.creatureDefinitionId}": ${error.message}`, { cause: error });
    }

    let presentation;
    try {
      presentation = composeCreaturePresentationHeight(creature, preset.presentation.targetHeight, { source: `Enemy Preset "${presetId}"` });
    } catch (error) {
      throw new EnemyPresetResolverError('INVALID_TARGET_HEIGHT', error.message, { cause: error });
    }

    let loadout;
    try {
      loadout = this.loadoutRegistry.require(preset.armament.loadoutId);
    } catch (error) {
      throw new EnemyPresetResolverError(error.code ?? 'UNKNOWN_LOADOUT', `Enemy Preset "${presetId}" could not resolve NPC Loadout "${preset.armament.loadoutId}": ${error.message}`, { cause: error });
    }

    let canonicalWeapon;
    try {
      canonicalWeapon = this.weaponRegistry.require(loadout.mainHandWeaponId);
    } catch (error) {
      throw new EnemyPresetResolverError('UNKNOWN_WEAPON', `Enemy Preset "${presetId}" could not resolve NPC weapon "${loadout.mainHandWeaponId}": ${error.message}`, { cause: error });
    }

    let armament;
    try {
      armament = resolveNpcLoadout({
        loadout,
        weaponRegistry: this.weaponRegistry,
        offensiveActions: presentation.pack.offensiveActions,
      });
    } catch (error) {
      throw new EnemyPresetResolverError('INCOMPATIBLE_LOADOUT', `Enemy Preset "${presetId}" armament is incompatible with Forge capability: ${error.message}`, { cause: error });
    }

    let resolvedWeapon;
    try {
      resolvedWeapon = resolveNpcWeaponDefinitionOverride(canonicalWeapon, preset.armament.weaponOverride ?? null);
    } catch (error) {
      throw new EnemyPresetResolverError('INVALID_WEAPON_OVERRIDE', `Enemy Preset "${presetId}" has an invalid weapon override: ${error.message}`, { cause: error });
    }

    const socket = presentation.pack.attachmentSockets?.available
      ? presentation.pack.attachmentSockets.sockets.find((candidate) => (
        resolvedWeapon.compatibleSocketRoles.includes(candidate.semanticRole)
        && armament.compatibleActions.some((action) => action.socketRole === candidate.semanticRole)
      ))
      : null;
    if (!socket) {
      throw new EnemyPresetResolverError('REQUIRED_SOCKET_UNAVAILABLE', `Enemy Preset "${presetId}" cannot resolve a required authored hand socket for ${resolvedWeapon.weaponId}.`);
    }

    return Object.freeze({
      preset,
      definition: presentation.definition,
      pack: presentation.pack,
      profile: presentation.profile,
      loadout,
      canonicalWeapon,
      weapon: resolvedWeapon,
      compatibleActions: armament.compatibleActions,
      attachmentSocket: socket,
      lootProfile,
    });
  }
}
