import { blackGrassTempleDefinition } from './blackGrassTemple.definition.js';
import { fieldKeeperHouseDefinition } from './fieldKeeperHouse.definition.js';
import { level1Definition } from './generated/level1.definition.js';
import { sumerianCityBlockV0Definition } from './generated/sumerianCityBlockV0.definition.js';
import { reliquaryFieldDefinition } from './reliquaryField.definition.js';
import { southReliquaryCryptDefinition } from './southReliquaryCrypt.definition.js';

const locationDefinitions = Object.freeze({
  [blackGrassTempleDefinition.id]: blackGrassTempleDefinition,
  [fieldKeeperHouseDefinition.id]: fieldKeeperHouseDefinition,
  [level1Definition.id]: level1Definition,
  [sumerianCityBlockV0Definition.id]: sumerianCityBlockV0Definition,
  [southReliquaryCryptDefinition.id]: southReliquaryCryptDefinition,
  [reliquaryFieldDefinition.id]: reliquaryFieldDefinition,
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
