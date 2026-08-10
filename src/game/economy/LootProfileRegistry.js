import {
  assertValidLootProfile,
  LOOT_GOLD_MODES,
  LOOT_PROFILE_SCHEMA,
  LOOT_PROFILE_VERSION,
} from '../../contracts/LootProfile.js';

function deepFreeze(value) {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
}

export const DREAD_RAM_GOD_STANDARD_LOOT_PROFILE = deepFreeze({
  schema: LOOT_PROFILE_SCHEMA,
  version: LOOT_PROFILE_VERSION,
  lootProfileId: 'dread_ram_god_standard',
  displayName: 'Dread Ram God Standard Reward',
  currency: {
    gold: {
      mode: LOOT_GOLD_MODES.fixed,
      // Provisional production tuning for the M8 proof, not an economy constant.
      amount: 12,
    },
  },
});

export const PRODUCTION_LOOT_PROFILES = Object.freeze([
  DREAD_RAM_GOD_STANDARD_LOOT_PROFILE,
]);

export class LootProfileRegistryError extends Error {
  constructor(code, message, options = {}) {
    super(`[Loot Profile Registry:${code}] ${message}`, options);
    this.name = 'LootProfileRegistryError';
    this.code = code;
  }
}

export class LootProfileRegistry {
  constructor({ profiles = PRODUCTION_LOOT_PROFILES } = {}) {
    if (!Array.isArray(profiles)) {
      throw new LootProfileRegistryError('INVALID_REGISTRY', 'profiles must be an array.');
    }
    this.profiles = new Map();
    profiles.forEach((candidate, index) => {
      let profile;
      try {
        profile = deepFreeze(cloneValue(candidate));
        assertValidLootProfile(profile);
      } catch (error) {
        throw new LootProfileRegistryError('INVALID_PROFILE', `profiles[${index}]: ${error.message}`, { cause: error });
      }
      if (this.profiles.has(profile.lootProfileId)) {
        throw new LootProfileRegistryError('DUPLICATE_PROFILE', `lootProfileId "${profile.lootProfileId}" is registered more than once.`);
      }
      this.profiles.set(profile.lootProfileId, profile);
    });
  }

  listProfiles() {
    return [...this.profiles.values()];
  }

  hasProfile(lootProfileId) {
    return this.profiles.has(lootProfileId);
  }

  getProfile(lootProfileId) {
    const profile = this.profiles.get(lootProfileId);
    if (!profile) throw new LootProfileRegistryError('UNKNOWN_LOOT_PROFILE', `No registered Loot Profile has lootProfileId "${lootProfileId}".`);
    return profile;
  }
}

export const lootProfileRegistry = new LootProfileRegistry();
