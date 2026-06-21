import * as THREE from 'three';
import { getLocationDefinition } from './locations/locationRegistry.js';

export const FIELD_SPAWN_IDS_BY_RUNTIME_KEY = Object.freeze({
  start: 'field_player_start',
  cryptAExit: 'field_south_reliquary_crypt_return',
  blackGrassTempleExit: 'field_black_grass_temple_return',
  fieldKeeperHouseExit: 'field_keeper_house_return',
  ddplusLevel1Exit: 'field_ddplus_level_1_return',
  sumerianCityBlockV0Exit: 'field_sumerian_city_block_v0_return',
  sumerianSunPalaceDistrictV1Exit: 'field_sumerian_sun_palace_district_v1_return',
  sumerianCanalMarketDistrictV2Exit: 'field_sumerian_canal_market_district_v2_return',
  balthazanExit: 'field_balthazan_return',
  kerovacExit: 'field_kerovac_return',
  oarbFeatureYardExit: 'field_oarb_feature_yard_return',
  oarbOutdoorExpoExit: 'field_oarb_outdoor_expo_return',
  folsomExit: 'field_folsom_return',
});

export function isFiniteAuthoredPosition(position) {
  return position
    && Number.isFinite(position.x)
    && Number.isFinite(position.y ?? 1.55)
    && Number.isFinite(position.z);
}

export function authoredPositionToVector3(position, fallbackY = 1.55) {
  return new THREE.Vector3(
    position.x,
    Number.isFinite(position.y) ? position.y : fallbackY,
    position.z,
  );
}

export function resolveFieldPlayerSpawn(fieldSpawn = 'start', {
  fallbackPosition = new THREE.Vector3(0, 1.55, -175),
  fallbackYaw = 0,
  logger = console,
} = {}) {
  const spawnKey = FIELD_SPAWN_IDS_BY_RUNTIME_KEY[fieldSpawn] ? fieldSpawn : 'start';
  const spawnId = FIELD_SPAWN_IDS_BY_RUNTIME_KEY[spawnKey];
  const spawn = getLocationDefinition('reliquary-field')?.spawns?.find((candidate) => candidate.id === spawnId);

  if (isFiniteAuthoredPosition(spawn?.position)) {
    return {
      spawnPosition: authoredPositionToVector3(spawn.position, 1.55),
      spawnYaw: Number.isFinite(spawn.yaw) ? spawn.yaw : fallbackYaw,
    };
  }

  logger.error(`[Dread Stone Black] Reliquary Field startup spawn ${spawnId} is missing or invalid; falling back to FIELD_PLAYER_START.`);
  return { spawnPosition: fallbackPosition.clone(), spawnYaw: fallbackYaw };
}
