import { ENCOUNTER_DEFINITION_SCHEMA, ENCOUNTER_DEFINITION_VERSION } from '../../contracts/EncounterDefinition.js';

export const M9_DEV_ENCOUNTER_ID = 'm9_folsom_two_ram_gods_proof';

// Explicit dev-only fixture. It is never imported by EncounterRegistry and is
// therefore not canonical Folsom placement.
export const M9_FOLSOM_TWO_RAM_GODS_PROOF = Object.freeze({
  schema: ENCOUNTER_DEFINITION_SCHEMA,
  version: ENCOUNTER_DEFINITION_VERSION,
  encounterId: M9_DEV_ENCOUNTER_ID,
  displayName: 'M9 Folsom Two Ram Gods Proof',
  locationId: 'folsom',
  spawns: Object.freeze([
    Object.freeze({
      spawnId: 'm9_folsom_ram_god_proof_01',
      presetId: 'dread_ram_god_great_mace',
      transform: Object.freeze({ position: Object.freeze([-4.05, 0.16, 1.65]), yaw: 2.82 }),
      homeRadius: 7,
    }),
    Object.freeze({
      spawnId: 'm9_folsom_ram_god_proof_02',
      presetId: 'dread_ram_god_great_mace',
      transform: Object.freeze({ position: Object.freeze([3.8, 0.16, -1.5]), yaw: -2.35 }),
      homeRadius: 10,
      rewardOverride: Object.freeze({ gold: 27 }),
    }),
  ]),
});
