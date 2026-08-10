import {
  assertValidEnemyPreset,
  ENEMY_PRESET_V2_SCHEMA,
  ENEMY_PRESET_V2_VERSION,
} from '../../contracts/EnemyPreset.js';

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

export const DREAD_RAM_GOD_GREAT_MACE_PRESET = deepFreeze({
  schema: ENEMY_PRESET_V2_SCHEMA,
  version: ENEMY_PRESET_V2_VERSION,
  presetId: 'dread_ram_god_great_mace',
  displayName: 'Dread Ram God — Great Mace',
  creatureDefinitionId: 'dread_ram_god',
  presentation: {
    targetHeight: 2.1,
  },
  armament: {
    loadoutId: 'humanoid_dreadstone_mace_main_hand',
    weaponOverride: {
      assetScale: 1.41,
      gripTransform: {
        position: [0.005, 0.085, -0.015],
        quaternion: [0.70710678, 0, 0, 0.70710678],
      },
      attackCapsule: {
        start: [0, 0, -0.48],
        end: [0, 0, -0.29],
        radius: 0.13,
      },
    },
  },
  rewards: {
    lootProfileId: 'dread_ram_god_standard',
  },
});

export const PRODUCTION_ENEMY_PRESETS = Object.freeze([
  DREAD_RAM_GOD_GREAT_MACE_PRESET,
]);

export class EnemyPresetRegistryError extends Error {
  constructor(code, message, options = {}) {
    super(`[Enemy Preset Registry:${code}] ${message}`, options);
    this.name = 'EnemyPresetRegistryError';
    this.code = code;
  }
}

export class EnemyPresetRegistry {
  constructor({ presets = PRODUCTION_ENEMY_PRESETS } = {}) {
    if (!Array.isArray(presets)) {
      throw new EnemyPresetRegistryError('INVALID_REGISTRY', 'presets must be an array.');
    }
    this.presets = new Map();
    presets.forEach((candidate, index) => {
      let preset;
      try {
        preset = deepFreeze(cloneValue(candidate));
        assertValidEnemyPreset(preset);
      } catch (error) {
        throw new EnemyPresetRegistryError('INVALID_PRESET', `presets[${index}]: ${error.message}`, { cause: error });
      }
      if (this.presets.has(preset.presetId)) {
        throw new EnemyPresetRegistryError('DUPLICATE_PRESET', `presetId "${preset.presetId}" is registered more than once.`);
      }
      this.presets.set(preset.presetId, preset);
    });
  }

  listPresets() {
    return [...this.presets.values()];
  }

  hasPreset(presetId) {
    return this.presets.has(presetId);
  }

  getPreset(presetId) {
    const preset = this.presets.get(presetId);
    if (!preset) throw new EnemyPresetRegistryError('UNKNOWN_PRESET', `No registered Enemy Preset has presetId "${presetId}".`);
    return preset;
  }
}

export const enemyPresetRegistry = new EnemyPresetRegistry();
