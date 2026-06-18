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
      blocksEnemies: false,
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

const kerovacBirthdayGreeting = Object.freeze({
  id: 'K_jake_31st_birthday_greeting',
  kind: 'stela',
  // K03's east wall is the player’s right-hand side on entering from K02. The Expo doorway is farther north on this wall.
  position: [21.68, 0, 7.15],
  yaw: Math.PI / 2,
  width: 10.2,
  height: 4.55,
  thickness: 0.14,
  material: 'birthdayJakeGreeting',
  blocksPlayer: false,
  blocksEnemies: false,
  roomId: 'K03',
  tags: ['kerovac-birthday-greeting', 'jake-31st', 'right-wall-welcome'],
  userData: {
    message: 'Happy 31st Jake',
    purpose: 'Birthday welcome sign on the right-hand wall before the Kerovac Expo entrance.',
    visualOnly: true,
  },
});

const kerovacDefinitionWithRuntimeFixes = Object.freeze({
  ...kerovacDefinition,
  textures: {
    ...(kerovacDefinition.textures ?? {}),
    birthdayJakeGreeting: {
      path: './assets/textures/kerovac/happy_31st_jake.svg',
      repeat: [1, 1],
      color: 0xffffff,
      roughness: 0.76,
      metalness: 0.08,
      emissive: 0x4b2b0d,
      emissiveIntensity: 0.24,
      boxUvScale: [1, 1],
    },
  },
  architecturalPrimitives: [
    ...(kerovacDefinition.architecturalPrimitives ?? []).map(normalizeKerovacPrimitive),
    kerovacBirthdayGreeting,
  ],
});

const locationDefinitions = Object.freeze({
  [blackGrassTempleDefinition.id]: blackGrassTempleDefinition,
  [fieldKeeperHouseDefinition.id]: fieldKeeperHouseDefinition,
  [level1Definition.id]: level1Definition,
  [balthazanDefinition.id]: balthazanDefinition,
  [sumerianCityBlockV0Definition.id]: sumerianCityBlockV0Definition,
  [sumerianSunPalaceDistrictV1Definition.id]: sumerianSunPalaceDistrictV1Definition,
  [sumerianCanalMarketDistrictV2Definition.id]: sumerianCanalMarketDistrictV2Definition,
  [kerovacDefinitionWithRuntimeFixes.id]: kerovacDefinitionWithRuntimeFixes,
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
