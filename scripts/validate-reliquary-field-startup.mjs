import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveFieldPlayerSpawn } from '../src/game/fieldSpawnResolution.js';
import { resolveStartupArea } from '../src/game/locationRouting.js';

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

const { spawnPosition, spawnYaw } = resolveFieldPlayerSpawn('start');
assert.deepEqual(spawnPosition.toArray(), [0, 1.55, -175]);
assert.equal(spawnYaw, 0);

console.log('Folsom default routing plus Reliquary Field fallback references and spawn resolution are valid.');
