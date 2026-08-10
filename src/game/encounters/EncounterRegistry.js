import {
  assertValidEncounterDefinition,
  canonicalizeEncounterDefinition,
} from '../../contracts/EncounterDefinition.js';

function deepFreeze(value) {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

// Canonical encounter content is intentionally empty until M9.5 authors real
// placement. Dev fixtures live outside this production collection.
export const PRODUCTION_ENCOUNTER_DEFINITIONS = Object.freeze([]);

export class EncounterRegistryError extends Error {
  constructor(code, message, options = {}) {
    super(`[Encounter Registry:${code}] ${message}`, options);
    this.name = 'EncounterRegistryError';
    this.code = code;
  }
}

export class EncounterRegistry {
  constructor({ encounters = PRODUCTION_ENCOUNTER_DEFINITIONS } = {}) {
    if (!Array.isArray(encounters)) throw new EncounterRegistryError('INVALID_REGISTRY', 'encounters must be an array.');
    this.encounters = new Map();
    this.encountersByLocation = new Map();
    this.spawnOwners = new Map();

    encounters.forEach((candidate, index) => {
      let encounter;
      try {
        encounter = deepFreeze(canonicalizeEncounterDefinition(candidate));
        assertValidEncounterDefinition(encounter);
      } catch (error) {
        throw new EncounterRegistryError('INVALID_ENCOUNTER', `encounters[${index}]: ${error.message}`, { cause: error });
      }
      if (this.encounters.has(encounter.encounterId)) {
        throw new EncounterRegistryError('DUPLICATE_ENCOUNTER', `encounterId "${encounter.encounterId}" is registered more than once.`);
      }
      for (const spawn of encounter.spawns) {
        const owner = this.spawnOwners.get(spawn.spawnId);
        if (owner) {
          throw new EncounterRegistryError(
            'DUPLICATE_GLOBAL_SPAWN',
            `spawnId "${spawn.spawnId}" belongs to both "${owner}" and "${encounter.encounterId}". Authored spawn IDs are globally unique.`,
          );
        }
        this.spawnOwners.set(spawn.spawnId, encounter.encounterId);
      }
      this.encounters.set(encounter.encounterId, encounter);
      const locationEncounters = this.encountersByLocation.get(encounter.locationId) ?? [];
      locationEncounters.push(encounter);
      this.encountersByLocation.set(encounter.locationId, locationEncounters);
    });
    this.encountersByLocation.forEach((records) => Object.freeze(records));
  }

  listEncounters() {
    return [...this.encounters.values()];
  }

  listByLocation(locationId) {
    return [...(this.encountersByLocation.get(locationId) ?? [])];
  }

  hasEncounter(encounterId) {
    return this.encounters.has(encounterId);
  }

  ownsSpawnId(spawnId) {
    return this.spawnOwners.has(spawnId);
  }

  getSpawnOwner(spawnId) {
    return this.spawnOwners.get(spawnId) ?? null;
  }

  getEncounter(encounterId) {
    const encounter = this.encounters.get(encounterId);
    if (!encounter) throw new EncounterRegistryError('UNKNOWN_ENCOUNTER', `No registered Encounter Definition has encounterId "${encounterId}".`);
    return encounter;
  }

  async preflight(encounterOrId, enemyPresetResolver) {
    const encounter = typeof encounterOrId === 'string' ? this.getEncounter(encounterOrId) : encounterOrId;
    assertValidEncounterDefinition(encounter);
    if (!enemyPresetResolver?.resolve) throw new EncounterRegistryError('MISSING_PRESET_RESOLVER', 'EnemyPresetResolver is required for encounter preflight.');
    const resolvedByPresetId = new Map();
    for (const spawn of encounter.spawns) {
      if (resolvedByPresetId.has(spawn.presetId)) continue;
      try {
        resolvedByPresetId.set(spawn.presetId, await enemyPresetResolver.resolve(spawn.presetId));
      } catch (error) {
        throw new EncounterRegistryError(
          'UNKNOWN_PRESET_REFERENCE',
          `Encounter "${encounter.encounterId}" spawn "${spawn.spawnId}" could not resolve Enemy Preset "${spawn.presetId}": ${error.message}`,
          { cause: error },
        );
      }
    }
    return encounter.spawns.map((spawnRecord) => Object.freeze({ spawnRecord, resolvedPreset: resolvedByPresetId.get(spawnRecord.presetId) }));
  }
}

export const encounterRegistry = new EncounterRegistry();
