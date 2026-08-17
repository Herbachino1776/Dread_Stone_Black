#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProductionCreaturePackCatalog } from './lib/creature-pack-catalog.mjs';
import { ensureCreatureLabDefinition } from './lib/creature-lab-definition.mjs';
import { DEFAULT_GENERATED_DIRECTORY } from './lib/creature-pack-importer.mjs';

const check = process.argv.slice(2).includes('--check');
const unknown = process.argv.slice(2).filter((argument) => argument !== '--all' && argument !== '--check');
if (unknown.length || !process.argv.slice(2).includes('--all')) {
  process.stderr.write('Usage: node scripts/register-creature-lab-definitions.mjs --all [--check]\n');
  process.exit(1);
}

try {
  const catalog = await loadProductionCreaturePackCatalog();
  for (const entry of catalog.creatures) {
    const descriptorPath = path.join(DEFAULT_GENERATED_DIRECTORY, `${entry.packId}.json`);
    const pack = JSON.parse(await readFile(descriptorPath, 'utf8'));
    const result = await ensureCreatureLabDefinition(pack, {
      definitionId: entry.enemySlug,
      displayName: entry.displayName,
      check,
    });
    process.stdout.write(`${result.status} ${entry.packId}${result.filePath ? ` -> ${result.filePath}` : ''}\n`);
  }
} catch (error) {
  process.stderr.write(`${path.basename(fileURLToPath(import.meta.url))}: ${error.message}\n`);
  process.exitCode = 1;
}
