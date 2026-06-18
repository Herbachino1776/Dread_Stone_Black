import { blackGrassTempleDefinition } from './blackGrassTemple.definition.js';
import { fieldKeeperHouseDefinition } from './fieldKeeperHouse.definition.js';
import { level1Definition } from './generated/level1.definition.js';
import { balthazanDefinition } from './generated/balthazan.definition.js';
import { sumerianCityBlockV0Definition } from './generated/sumerianCityBlockV0.definition.js';
import { sumerianSunPalaceDistrictV1Definition } from './generated/sumerianSunPalaceDistrictV1.definition.js';
import { sumerianCanalMarketDistrictV2Definition } from './generated/sumerianCanalMarketDistrictV2.definition.js';
import { kerovacDefinition } from './generated/kerovac.definition.js';
import { reliquaryFieldDefinition } from './reliquaryField.definition.js';
import { southReliquaryCryptDefinition } from './southReliquaryCrypt.definition.js';
import { v2TestShrineDefinition } from './v2TestShrine.definition.js';

const KEROVAC_EXPO_ENTRANCE_BLOCKER_ID = 'K_expo_west_observation_tier_01';

const kerovacDefinitionWithExpoEntranceFix = Object.freeze({
  ...kerovacDefinition,
  architecturalPrimitives: (kerovacDefinition.architecturalPrimitives ?? []).map((primitive) => {
    if (primitive?.id !== KEROVAC_EXPO_ENTRANCE_BLOCKER_ID) {
      return primitive;
    }

    return {
      ...primitive,
      blocksPlayer: false,
      blocksEnemies: false,
      tags: [
        ...(primitive.tags ?? []),
        'expo-entrance-clearance-fix',
        'non-blocking-entrance-trim',
      ],
      userData: {
        ...(primitive.userData ?? {}),
        entranceClearanceFix: 'Disabled blocking on this west observation tier because it crosses the K09-to-K10 Expo entrance path.',
      },
    };
  }),
});

const locationDefinitions = Object.freeze({
  [blackGrassTempleDefinition.id]: blackGrassTempleDefinition,
  [fieldKeeperHouseDefinition.id]: fieldKeeperHouseDefinition,
  [level1Definition.id]: level1Definition,
  [balthazanDefinition.id]: balthazanDefinition,
  [sumerianCityBlockV0Definition.id]: sumerianCityBlockV0Definition,
  [sumerianSunPalaceDistrictV1Definition.id]: sumerianSunPalaceDistrictV1Definition,
  [sumerianCanalMarketDistrictV2Definition.id]: sumerianCanalMarketDistrictV2Definition,
  [kerovacDefinitionWithExpoEntranceFix.id]: kerovacDefinitionWithExpoEntranceFix,
  [southReliquaryCryptDefinition.id]: southReliquaryCryptDefinition,
  [reliquaryFieldDefinition.id]: reliquaryFieldDefinition,
  [v2TestShrineDefinition.id]: v2TestShrineDefinition,
});

export function getLocationDefinition(id) {
  return locationDefinitions[id] ?? null;
}

export function hasLocationDefinition(id) {
  return Boolean(locationDefinitions[id]);
}

export function listLocationDefinitions() {
  return Object.values(locationDefinitions);
}
