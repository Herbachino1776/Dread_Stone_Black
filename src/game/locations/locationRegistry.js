import { folsomDefinition } from './folsom.definition.js';

const KEROVAC_EXPO_ENTRANCE_BLOCKER_ID = 'K_expo_west_observation_tier_01';
const KEROVAC_EXPO_OVERLAY_Y = 0.055;

function withPositionY(position, y) {
  if (!Array.isArray(position)) return position;
  return [position[0], Math.max(Number(position[1] ?? 0), y), position[2]];
}

function isKerovacExpoGroundOverlay(primitive) {
  if (primitive?.roomId !== 'K10') return false;
  const id = primitive.id ?? '';
  const tags = new Set(primitive.tags ?? []);
  return id.startsWith('K_expo_pad_')
    || id.startsWith('K_expo_marker_')
    || id.startsWith('K_expo_rail_')
    || tags.has('display-pad')
    || tags.has('display-grid-marker')
    || tags.has('low-profile-display-trim');
}

function normalizeKerovacPrimitive(primitive) {
  if (!primitive) return primitive;

  let next = primitive;

  if (primitive.id === KEROVAC_EXPO_ENTRANCE_BLOCKER_ID) {
    next = {
      ...next,
      blocksPlayer: false,
      blocksActors: false,
      tags: [
        ...(next.tags ?? []),
        'expo-entrance-clearance-fix',
        'non-blocking-entrance-trim',
      ],
      userData: {
        ...(next.userData ?? {}),
        entranceClearanceFix: 'Disabled blocking on this west observation tier because it crosses the K09-to-K10 Expo entrance path.',
      },
    };
  }

  if (isKerovacExpoGroundOverlay(primitive)) {
    next = {
      ...next,
      y: Math.max(Number(next.y ?? 0), KEROVAC_EXPO_OVERLAY_Y),
      position: withPositionY(next.position, KEROVAC_EXPO_OVERLAY_Y),
      tags: [
        ...(next.tags ?? []),
        'z-fight-clearance-fix',
      ],
      userData: {
        ...(next.userData ?? {}),
        zFightClearanceFix: `Raised low-profile Expo floor overlay to y=${KEROVAC_EXPO_OVERLAY_Y} so it no longer renders coplanar with the room floor.`,
      },
    };
  }

  return next;
}

function withKerovacRuntimeFixes(definition) {
  return Object.freeze({
    ...definition,
    architecturalPrimitives: (definition.architecturalPrimitives ?? []).map(normalizeKerovacPrimitive),
  });
}

const eagerLocationDefinitions = Object.freeze({
  [folsomDefinition.id]: folsomDefinition,
});

const lazyLocationLoaders = Object.freeze({
  'black-grass-temple': () => import('./blackGrassTemple.definition.js').then((module) => module.blackGrassTempleDefinition),
  'beneath-folsom': () => import('./beneathFolsom.definition.js').then((module) => module.beneathFolsomDefinition),
  'under-shrine-labyrinth': () => import('./underShrineLabyrinth.definition.js').then((module) => module.underShrineLabyrinthDefinition),
  'field-keeper-house': () => import('./fieldKeeperHouse.definition.js').then((module) => module.fieldKeeperHouseDefinition),
  'level-1': () => import('./generated/level1.definition.js').then((module) => module.level1Definition),
  balthazan: () => import('./generated/balthazan.definition.js').then((module) => module.balthazanDefinition),
  'sumerian-city-block-v0': () => import('./generated/sumerianCityBlockV0.definition.js').then((module) => module.sumerianCityBlockV0Definition),
  'sumerian-sun-palace-district-v1': () => import('./generated/sumerianSunPalaceDistrictV1.definition.js').then((module) => module.sumerianSunPalaceDistrictV1Definition),
  'sumerian-canal-market-district-v2': () => import('./generated/sumerianCanalMarketDistrictV2.definition.js').then((module) => module.sumerianCanalMarketDistrictV2Definition),
  kerovac: () => import('./generated/kerovac.definition.js').then((module) => withKerovacRuntimeFixes(module.kerovacDefinition)),
  oarbFeatureYard: () => import('./oarbFeatureYard.definition.js').then((module) => module.oarbFeatureYardDefinition),
  oarbOutdoorExpo: () => import('./oarbOutdoorExpo.definition.js').then((module) => module.oarbOutdoorExpoDefinition),
  'south-reliquary-crypt': () => import('./southReliquaryCrypt.definition.js').then((module) => module.southReliquaryCryptDefinition),
  'reliquary-field': () => import('./reliquaryField.definition.js').then((module) => module['reliquary' + 'FieldDefinition']),
  'v2-test-shrine': () => import('./v2TestShrine.definition.js').then((module) => module.v2TestShrineDefinition),
});

const loadedLocationDefinitions = new Map(Object.entries(eagerLocationDefinitions));
const loadingLocationDefinitions = new Map();

export function getLocationDefinition(id) {
  return loadedLocationDefinitions.get(id) ?? null;
}

export function hasLocationDefinition(id) {
  return loadedLocationDefinitions.has(id) || Object.hasOwn(lazyLocationLoaders, id);
}

export function isLocationDefinitionLoaded(id) {
  return loadedLocationDefinitions.has(id);
}

export function getLoadedLocationDefinitionIds() {
  return [...loadedLocationDefinitions.keys()];
}

export function getLocationRegistryDebugSummary() {
  const lazyIds = Object.keys(lazyLocationLoaders);
  return {
    loadedLocationIds: getLoadedLocationDefinitionIds(),
    lazyLocationIds: lazyIds,
    loadingLocationIds: [...loadingLocationDefinitions.keys()],
    routeRegistryLoaded: true,
    lazyLocationsPending: lazyIds.some((id) => !loadedLocationDefinitions.has(id)),
  };
}

export async function loadLocationDefinition(id) {
  const cached = getLocationDefinition(id);
  if (cached) return cached;

  const loader = lazyLocationLoaders[id];
  if (!loader) {
    throw new Error(`Unknown location definition: ${id}`);
  }

  if (!loadingLocationDefinitions.has(id)) {
    loadingLocationDefinitions.set(id, loader().then((definition) => {
      if (!definition?.id) throw new Error(`Location definition module for ${id} did not export a valid definition.`);
      if (definition.id !== id) throw new Error(`Location definition id mismatch: requested ${id}, loaded ${definition.id}.`);
      loadedLocationDefinitions.set(id, definition);
      loadingLocationDefinitions.delete(id);
      return definition;
    }).catch((error) => {
      loadingLocationDefinitions.delete(id);
      throw error;
    }));
  }

  return loadingLocationDefinitions.get(id);
}

export async function preloadLocationDefinition(id) {
  return loadLocationDefinition(id);
}

export async function listLocationDefinitions() {
  return Promise.all([
    ...loadedLocationDefinitions.keys(),
    ...Object.keys(lazyLocationLoaders).filter((id) => !loadedLocationDefinitions.has(id)),
  ].map((id) => loadLocationDefinition(id)));
}
