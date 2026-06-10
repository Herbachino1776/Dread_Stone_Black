import { blackGrassTempleDefinition } from './blackGrassTemple.definition.js';
import { reliquaryFieldDefinition } from './reliquaryField.definition.js';
import { southReliquaryCryptDefinition } from './southReliquaryCrypt.definition.js';

const locationDefinitions = Object.freeze({
  [blackGrassTempleDefinition.id]: blackGrassTempleDefinition,
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
