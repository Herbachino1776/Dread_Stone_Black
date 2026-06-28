import { getLocationDefinition, hasLocationDefinition, loadLocationDefinition } from './locations/locationRegistry.js';

const FIELD_AREA_ALIASES = Object.freeze(new Set(['field', 'reliquary-field']));
const DEFAULT_STARTUP_LOCATION = 'folsom';
const RELIQUARY_FIELD_LOCATION_ID = 'reliquary-field';

const LEGACY_FIELD_RETURN_SPAWNS_BY_LOCATION = Object.freeze({
  'black-grass-temple': 'blackGrassTempleExit',
  'field-keeper-house': 'fieldKeeperHouseExit',
  'level-1': 'ddplusLevel1Exit',
  'sumerian-city-block-v0': 'sumerianCityBlockV0Exit',
  'sumerian-sun-palace-district-v1': 'sumerianSunPalaceDistrictV1Exit',
  'sumerian-canal-market-district-v2': 'sumerianCanalMarketDistrictV2Exit',
  balthazan: 'balthazanExit',
  kerovac: 'kerovacExit',
  oarbFeatureYard: 'oarbFeatureYardExit',
  oarbOutdoorExpo: 'oarbOutdoorExpoExit',
  'v2-test-shrine': 'v2TestShrineExit',
  folsom: 'folsomExit',
  dungeon: 'cryptAExit',
  'south-reliquary-crypt': 'cryptAExit',
});

export function resolveStartupArea(requestedArea) {
  if (!requestedArea) return DEFAULT_STARTUP_LOCATION;
  if (FIELD_AREA_ALIASES.has(requestedArea)) return 'field';
  if (requestedArea === 'dungeon') return 'dungeon';

  const requestedLocation = getLocationDefinition(requestedArea);
  if (requestedLocation?.tags?.includes('compiled-runtime')) return requestedArea;
  if (hasLocationDefinition(requestedArea)) return requestedArea;

  return DEFAULT_STARTUP_LOCATION;
}

export function resolveLocationIdForArea(area) {
  if (area === 'dungeon') return 'south-reliquary-crypt';
  if (area === 'field') return RELIQUARY_FIELD_LOCATION_ID;
  return area || DEFAULT_STARTUP_LOCATION;
}

export function getLocationExitDefinition(locationDefinition, { toLocation = null, exitId = null } = {}) {
  const exits = locationDefinition?.exits ?? [];
  if (exitId) return exits.find((exit) => exit.id === exitId) ?? null;
  if (toLocation) return exits.find((exit) => exit.toLocation === toLocation) ?? null;
  return null;
}

function findSpawnById(locationDefinition, spawnId) {
  return (locationDefinition?.spawns ?? []).find((spawn) => spawn.id === spawnId) ?? null;
}

function findReturnSpawnForLocation(targetDefinition, fromLocationId) {
  return (targetDefinition?.spawns ?? []).find((spawn) => (
    spawn.userData?.returnFromLocation === fromLocationId
    || spawn.tags?.includes(fromLocationId)
  )) ?? null;
}

function getRuntimeSpawnKeyForReturnSpawn(targetDefinition, spawnId, fromLocationId) {
  const spawn = findSpawnById(targetDefinition, spawnId) ?? findReturnSpawnForLocation(targetDefinition, fromLocationId);
  return spawn?.userData?.runtimeSpawnKey ?? null;
}

export function resolveLoadedLocationReturnSpawn(fromLocationId, {
  targetLocationId = RELIQUARY_FIELD_LOCATION_ID,
} = {}) {
  if (!fromLocationId) return 'start';

  const normalizedFromLocationId = fromLocationId === 'dungeon' ? 'south-reliquary-crypt' : fromLocationId;
  const fromDefinition = getLocationDefinition(normalizedFromLocationId);
  const targetDefinition = getLocationDefinition(targetLocationId);
  const exit = getLocationExitDefinition(fromDefinition, { toLocation: targetLocationId });
  const authoredRuntimeSpawnKey = getRuntimeSpawnKeyForReturnSpawn(
    targetDefinition,
    exit?.destinationSpawnId,
    normalizedFromLocationId,
  );
  if (authoredRuntimeSpawnKey) return authoredRuntimeSpawnKey;

  const authoredReturnSpawn = findReturnSpawnForLocation(targetDefinition, normalizedFromLocationId);
  if (authoredReturnSpawn?.userData?.runtimeSpawnKey) return authoredReturnSpawn.userData.runtimeSpawnKey;

  return LEGACY_FIELD_RETURN_SPAWNS_BY_LOCATION[fromLocationId]
    ?? LEGACY_FIELD_RETURN_SPAWNS_BY_LOCATION[normalizedFromLocationId]
    ?? 'start';
}

export async function resolveLocationReturnSpawn(fromLocationId, options = {}) {
  if (!fromLocationId) return 'start';
  const targetLocationId = options.targetLocationId ?? RELIQUARY_FIELD_LOCATION_ID;
  const normalizedFromLocationId = fromLocationId === 'dungeon' ? 'south-reliquary-crypt' : fromLocationId;

  await Promise.all([
    hasLocationDefinition(normalizedFromLocationId) ? loadLocationDefinition(normalizedFromLocationId).catch(() => null) : null,
    hasLocationDefinition(targetLocationId) ? loadLocationDefinition(targetLocationId).catch(() => null) : null,
  ]);

  return resolveLoadedLocationReturnSpawn(fromLocationId, { targetLocationId });
}
