import { blackGrassTempleObjectivePackId, blackGrassTempleObjectives } from './blackGrassTempleObjectives.js';
import { southReliquaryCryptObjectivePackId, southReliquaryCryptObjectives } from './southReliquaryCryptObjectives.js';

const objectivePacks = Object.freeze({
  [blackGrassTempleObjectivePackId]: Object.freeze({
    id: blackGrassTempleObjectivePackId,
    locationId: 'black-grass-temple',
    silent: true,
    definitions: blackGrassTempleObjectives,
  }),
  [southReliquaryCryptObjectivePackId]: Object.freeze({
    id: southReliquaryCryptObjectivePackId,
    locationId: 'south-reliquary-crypt',
    definitions: southReliquaryCryptObjectives,
  }),
});

const locationObjectivePackIds = Object.freeze({
  'black-grass-temple': blackGrassTempleObjectivePackId,
  'south-reliquary-crypt': southReliquaryCryptObjectivePackId,
});

export function getObjectivePackForLocation(locationId, objectivePackId = null) {
  const packId = objectivePackId ?? locationObjectivePackIds[locationId];
  return objectivePacks[packId] ?? null;
}

export function listObjectivePacks() {
  return Object.values(objectivePacks);
}
