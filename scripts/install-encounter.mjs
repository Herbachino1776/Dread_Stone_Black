import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { installEncounterDefinition } from './encounter-installer-lib.mjs';

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

export async function installEncounterFile(sourcePath, options = {}) {
  if (!sourcePath) throw new Error('Usage: node scripts/install-encounter.mjs <encounter.json>');
  const serialized = await readFile(path.resolve(sourcePath), 'utf8');
  return installEncounterDefinition(serialized, options);
}

if (invokedDirectly) {
  try {
    const result = await installEncounterFile(process.argv[2]);
    console.log(`Installed ${result.encounterId} (${result.spawnCount} spawns) -> ${result.relativePath}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
