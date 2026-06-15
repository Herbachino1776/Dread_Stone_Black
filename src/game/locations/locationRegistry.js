import { blackGrassTempleDefinition } from './blackGrassTemple.definition.js';
import { fieldKeeperHouseDefinition } from './fieldKeeperHouse.definition.js';
import { level1Definition } from './generated/level1.definition.js';
import { sumerianCityBlockV0Definition } from './generated/sumerianCityBlockV0.definition.js';
import { sumerianSunPalaceDistrictV1Definition } from './generated/sumerianSunPalaceDistrictV1.definition.js';
import { sumerianCanalMarketDistrictV2Definition } from './generated/sumerianCanalMarketDistrictV2.definition.js';
import { reliquaryFieldDefinition } from './reliquaryField.definition.js';
import { southReliquaryCryptDefinition } from './southReliquaryCrypt.definition.js';
import { v2TestShrineDefinition } from './v2TestShrine.definition.js';
import { v2CanalShrineDefinition } from './v2CanalShrine.definition.js';

const locationDefinitions = Object.freeze({
  [blackGrassTempleDefinition.id]: blackGrassTempleDefinition,
  [fieldKeeperHouseDefinition.id]: fieldKeeperHouseDefinition,
  [level1Definition.id]: level1Definition,
  [sumerianCityBlockV0Definition.id]: sumerianCityBlockV0Definition,
  [sumerianSunPalaceDistrictV1Definition.id]: sumerianSunPalaceDistrictV1Definition,
  [sumerianCanalMarketDistrictV2Definition.id]: sumerianCanalMarketDistrictV2Definition,
  [southReliquaryCryptDefinition.id]: southReliquaryCryptDefinition,
  [reliquaryFieldDefinition.id]: reliquaryFieldDefinition,
  [v2TestShrineDefinition.id]: v2TestShrineDefinition,
  [v2CanalShrineDefinition.id]: v2CanalShrineDefinition,
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
