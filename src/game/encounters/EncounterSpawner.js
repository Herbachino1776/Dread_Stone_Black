import { assertValidEncounterDefinition, canonicalizeEncounterDefinition } from '../../contracts/EncounterDefinition.js';
import { EnemyPresetResolver } from '../creatures/EnemyPresetResolver.js';
import { EncounterEnemyRuntime } from './EncounterEnemyRuntime.js';
import { EncounterRuntime } from './EncounterRuntime.js';

function deepFreeze(value) {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export class EncounterSpawnerError extends Error {
  constructor(code, message, options = {}) {
    super(`[Encounter Spawner:${code}] ${message}`, options);
    this.name = 'EncounterSpawnerError';
    this.code = code;
  }
}

export class EncounterSpawner {
  constructor({ enemyPresetResolver = new EnemyPresetResolver(), creatureFactory = null, enemyRuntimeFactory = EncounterEnemyRuntime.create } = {}) {
    this.enemyPresetResolver = enemyPresetResolver;
    this.creatureFactory = creatureFactory ?? enemyPresetResolver.creatureFactory;
    this.enemyRuntimeFactory = enemyRuntimeFactory;
  }

  validateServices(services, definition) {
    const required = ['scene', 'physics', 'combatRouter', 'collision', 'playerProvider', 'playerDamageReceiverProvider', 'playerCombatState', 'playerCurrencyState'];
    const missing = required.filter((key) => services?.[key] == null);
    if (missing.length) throw new EncounterSpawnerError('MISSING_RUNTIME_SERVICES', `Encounter "${definition.encounterId}" is missing runtime services: ${missing.join(', ')}.`);
    if (services.locationId != null && services.locationId !== definition.locationId) {
      throw new EncounterSpawnerError('LOCATION_MISMATCH', `Encounter "${definition.encounterId}" belongs to "${definition.locationId}", not active location "${services.locationId}".`);
    }
  }

  async preflight(definition, services) {
    assertValidEncounterDefinition(definition);
    this.validateServices(services, definition);
    const resolvedByPresetId = new Map();
    for (const spawn of definition.spawns) {
      if (resolvedByPresetId.has(spawn.presetId)) continue;
      try {
        resolvedByPresetId.set(spawn.presetId, await this.enemyPresetResolver.resolve(spawn.presetId));
      } catch (error) {
        throw new EncounterSpawnerError(
          'PRESET_RESOLUTION_FAILED',
          `Encounter "${definition.encounterId}" spawn "${spawn.spawnId}" could not resolve Enemy Preset "${spawn.presetId}": ${error.message}`,
          { cause: error },
        );
      }
    }
    return definition.spawns.map((spawnRecord) => ({ spawnRecord, resolvedPreset: resolvedByPresetId.get(spawnRecord.presetId) }));
  }

  async spawn(encounterDefinition, services = {}) {
    let definition;
    try {
      definition = deepFreeze(canonicalizeEncounterDefinition(encounterDefinition));
    } catch (error) {
      throw new EncounterSpawnerError('INVALID_DEFINITION', error.message, { cause: error });
    }
    const preflight = await this.preflight(definition, services);
    const runtimeServices = Object.freeze({ ...services, encounterId: definition.encounterId });
    const createEnemies = async () => {
      const created = [];
      try {
        for (const entry of preflight) {
          const enemy = await this.enemyRuntimeFactory({
            ...entry,
            services: runtimeServices,
            creatureFactory: this.creatureFactory,
          });
          created.push(enemy);
        }
        return created;
      } catch (error) {
        created.reverse().forEach((enemy) => enemy.dispose?.('encounter-transaction-rollback'));
        throw new EncounterSpawnerError('TRANSACTION_FAILED', `Encounter "${definition.encounterId}" rolled back after runtime construction failed: ${error.message}`, { cause: error });
      }
    };
    return await new EncounterRuntime({ definition, createEnemies }).initialize();
  }
}
