import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getFieldSpawnIdsByRuntimeKey, resolveFieldPlayerSpawn } from '../src/game/fieldSpawnResolution.js';
import { resolveLoadedLocationReturnSpawn, resolveLocationReturnSpawn, resolveStartupArea } from '../src/game/locationRouting.js';
import { loadLocationDefinition } from '../src/game/locations/locationRegistry.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const definingModule = path.normalize('src/game/locations/reliquaryField.definition.js');
const identifier = ['reliquary', 'Field', 'Definition'].join('');
const ignoredDirectories = new Set(['.git', 'dist', 'node_modules']);

async function findJavaScriptFiles(directory, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findJavaScriptFiles(absolutePath, relativePath));
    } else if (/\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(entry.name)) {
      files.push({ absolutePath, relativePath: path.normalize(relativePath) });
    }
  }

  return files;
}

const unresolvedReferences = [];
for (const file of await findJavaScriptFiles(repoRoot)) {
  if (file.relativePath === definingModule) continue;

  const source = await readFile(file.absolutePath, 'utf8');
  if (!source.includes(identifier)) continue;

  const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namedImport = new RegExp(`import\\s*\\{[^}]*\\b${escapedIdentifier}\\b[^}]*}\\s*from\\s*['\"][^'\"]+['\"]`, 's');
  if (!namedImport.test(source)) unresolvedReferences.push(file.relativePath);
}

assert.deepEqual(
  unresolvedReferences,
  [],
  `${identifier} must not be referenced outside its defining module without an explicit named import`,
);

assert.equal(resolveStartupArea(undefined), 'folsom');
assert.equal(resolveStartupArea('field'), 'field');
assert.equal(resolveStartupArea('reliquary-field'), 'field');
assert.equal(resolveStartupArea('kerovac'), 'kerovac');
assert.equal(resolveStartupArea('oarbFeatureYard'), 'oarbFeatureYard');
assert.equal(resolveStartupArea('not-a-real-area'), 'folsom');

await Promise.all([
  loadLocationDefinition('reliquary-field'),
  loadLocationDefinition('folsom'),
  loadLocationDefinition('black-grass-temple'),
  loadLocationDefinition('kerovac'),
  loadLocationDefinition('oarbFeatureYard'),
  loadLocationDefinition('oarbOutdoorExpo'),
  loadLocationDefinition('v2-test-shrine'),
]);

const authoredSpawnIdsByRuntimeKey = getFieldSpawnIdsByRuntimeKey();
assert.equal(authoredSpawnIdsByRuntimeKey.start, 'field_player_start', 'Reliquary Field declares the startup runtime spawn key.');
assert.equal(authoredSpawnIdsByRuntimeKey.folsomExit, 'field_folsom_return', 'Reliquary Field declares the Folsom return runtime spawn key.');
assert.equal(authoredSpawnIdsByRuntimeKey.blackGrassTempleExit, 'field_black_grass_temple_return', 'Reliquary Field declares the BGT return runtime spawn key.');
assert.equal(authoredSpawnIdsByRuntimeKey.kerovacExit, 'field_kerovac_return', 'Reliquary Field declares the Kerovac return runtime spawn key.');
assert.equal(authoredSpawnIdsByRuntimeKey.oarbFeatureYardExit, 'field_oarb_feature_yard_return', 'Reliquary Field declares the OARB Feature Yard return runtime spawn key.');
assert.equal(authoredSpawnIdsByRuntimeKey.oarbOutdoorExpoExit, 'field_oarb_outdoor_expo_return', 'Reliquary Field declares the OARB Outdoor Expo return runtime spawn key.');
assert.equal(authoredSpawnIdsByRuntimeKey.v2TestShrineExit, 'field_v2_test_shrine_return', 'Reliquary Field declares the V2 Test Shrine return runtime spawn key.');

assert.equal(resolveLoadedLocationReturnSpawn('folsom'), 'folsomExit', 'Folsom return resolves from authored exit/spawn metadata.');
assert.equal(resolveLoadedLocationReturnSpawn('black-grass-temple'), 'blackGrassTempleExit', 'BGT return resolves from authored exit/spawn metadata.');
assert.equal(resolveLoadedLocationReturnSpawn('kerovac'), 'kerovacExit', 'Kerovac return resolves from authored exit/spawn metadata.');
assert.equal(resolveLoadedLocationReturnSpawn('oarbFeatureYard'), 'oarbFeatureYardExit', 'OARB Feature Yard return resolves from authored exit/spawn metadata.');
assert.equal(resolveLoadedLocationReturnSpawn('oarbOutdoorExpo'), 'oarbOutdoorExpoExit', 'OARB Outdoor Expo return resolves from authored exit/spawn metadata.');
assert.equal(resolveLoadedLocationReturnSpawn('v2-test-shrine'), 'v2TestShrineExit', 'V2 Test Shrine return resolves from authored exit/spawn metadata.');
assert.equal(await resolveLocationReturnSpawn('dungeon'), 'cryptAExit', 'Legacy dungeon from= value still resolves to the South Reliquary Crypt field return.');

const { spawnPosition, spawnYaw } = resolveFieldPlayerSpawn('start');
assert.deepEqual(spawnPosition.toArray(), [0, 1.55, -175]);
assert.equal(spawnYaw, 0);

const folsomReturn = resolveFieldPlayerSpawn('folsomExit');
assert.deepEqual(folsomReturn.spawnPosition.toArray(), [0, 1.55, -176]);
assert.equal(folsomReturn.spawnYaw, Math.PI);

console.log('Folsom default routing plus authored Reliquary Field return routing and spawn resolution are valid.');
