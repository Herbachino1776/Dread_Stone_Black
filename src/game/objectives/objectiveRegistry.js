import { southReliquaryCryptObjectivePackId, southReliquaryCryptObjectives } from './southReliquaryCryptObjectives.js';

const objectivePacks = Object.freeze({
  [southReliquaryCryptObjectivePackId]: Object.freeze({
    id: southReliquaryCryptObjectivePackId,
    locationId: 'south-reliquary-crypt',
    definitions: southReliquaryCryptObjectives,
  }),
});

const locationObjectivePackIds = Object.freeze({
  'south-reliquary-crypt': southReliquaryCryptObjectivePackId,
});

export function getObjectivePackForLocation(locationId, objectivePackId = null) {
  const packId = objectivePackId ?? locationObjectivePackIds[locationId];
  return objectivePacks[packId] ?? null;
}

export function listObjectivePacks() {
  return Object.values(objectivePacks);
}
