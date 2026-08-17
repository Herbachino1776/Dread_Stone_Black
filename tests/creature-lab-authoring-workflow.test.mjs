import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateEnemyPreset } from '../src/contracts/EnemyPreset.js';
import { createNpcLoadoutForWeapon, resolveNpcLoadout } from '../src/game/combat/NpcLoadout.js';
import { DREADSTONE_SWORD_WEAPON } from '../src/game/combat/NpcWeaponRegistry.js';
import { createEnemyPresetRecordFromLabCalibration, weaponDefinitionToLabCalibration } from '../src/game/creatures/CreatureLabCalibration.js';
import { installEnemyPreset, readInstalledEnemyPresets } from '../scripts/enemy-preset-installer-lib.mjs';
import { importWeaponGlb } from '../scripts/weapon-import-lib.mjs';

function fixtureGlb() {
  const json = Buffer.from('{}  ', 'ascii');
  const glb = Buffer.alloc(20 + json.length);
  glb.write('glTF', 0, 'ascii');
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(json.length, 12);
  glb.writeUInt32LE(0x4E4F534A, 16);
  json.copy(glb, 20);
  return glb;
}

test('drag/drop weapon import installs a validated GLB catalog record and generated loadout transactionally', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dreadstone-weapon-import-'));
  const source = path.join(root, 'Bone Saber.glb');
  const dataDirectory = path.join(root, 'data');
  const assetDirectory = path.join(root, 'assets');
  await writeFile(source, fixtureGlb());
  try {
    const result = await importWeaponGlb(source, { weaponClass: 'ONE_HAND_BLADE', dataDirectory, assetDirectory });
    assert.equal(result.definition.weaponId, 'bone_saber');
    assert.equal(result.loadout.loadoutId, 'humanoid_bone_saber_main_hand');
    assert.ok(result.loadout.allowedOffensiveActionIds.includes('humanoid_one_hand_thrust'));
    assert.equal((await stat(result.assetDestination)).size, fixtureGlb().length);
    assert.deepEqual(JSON.parse(await readFile(result.jsonDestination, 'utf8')), result.definition);
    await assert.rejects(
      importWeaponGlb(source, { weaponClass: 'ONE_HAND_BLADE', dataDirectory, assetDirectory }),
      /already exists/i,
    );
    assert.equal((await stat(result.assetDestination)).size, fixtureGlb().length, 'collision rollback preserves the installed asset');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('definition-only Creature Lab calibration creates an installable preset for a newer creature and its Forge weapon action', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dreadstone-enemy-presets-'));
  const preset = createEnemyPresetRecordFromLabCalibration({
    presetId: 'rusted_knight_sword',
    displayName: 'Rusted Knight — Sword',
    creatureDefinitionId: 'rusted_warrior_001',
    loadoutId: 'humanoid_dreadstone_sword_main_hand',
    targetHeight: 1.8,
    weaponDefinition: DREADSTONE_SWORD_WEAPON,
    calibration: weaponDefinitionToLabCalibration(DREADSTONE_SWORD_WEAPON),
  });
  assert.equal(validateEnemyPreset(preset).valid, true);
  try {
    const installed = await installEnemyPreset(preset, { directory });
    assert.equal(installed.relativePath, 'src/game/creatures/presets/rusted_knight_sword.json');
    assert.deepEqual((await readInstalledEnemyPresets(directory)).map((entry) => entry.presetId), ['rusted_knight_sword']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('weapon class plus Forge capability selects the authored thrust instead of an unrelated animation', () => {
  const loadout = createNpcLoadoutForWeapon({ weaponId: 'fixture_blade' });
  const weaponRegistry = { require: () => ({ weaponId: 'fixture_blade', weaponClass: 'ONE_HAND_BLADE', compatibleSocketRoles: ['MAIN_HAND_R'] }) };
  const resolved = resolveNpcLoadout({
    loadout,
    weaponRegistry,
    offensiveActions: {
      schema: 'dreadstone.offensive_action.v1',
      available: true,
      actions: [
        { combatActionId: 'humanoid_one_hand_overhead', compatibleWeaponClasses: ['ONE_HAND_BLUNT'], socketRole: 'MAIN_HAND_R' },
        { combatActionId: 'humanoid_one_hand_thrust', compatibleWeaponClasses: ['ONE_HAND_BLADE'], socketRole: 'MAIN_HAND_R' },
      ],
    },
  });
  assert.deepEqual(resolved.compatibleActions.map((entry) => entry.combatActionId), ['humanoid_one_hand_thrust']);
});
