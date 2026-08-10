#!/usr/bin/env node
import path from 'node:path';
import {
  inspectCreatureImportSource,
  installCreaturePack,
  publicInspectionSummary,
} from './lib/creature-pack-workflow.mjs';

const valueOptions = new Set(['--source', '--display-name', '--enemy-slug', '--pack-id']);
const flagOptions = new Set(['--full-validation', '--what-if', '--verbose']);

function usage() {
  return `Dreadstone Creature Pack Windows-workflow bridge

Usage:
  node scripts/creature-pack-workflow.mjs inspect --source <damage-folder>
  node scripts/creature-pack-workflow.mjs install --source <damage-folder> --display-name <name> --enemy-slug <slug>

The existing scripts/import-creature-pack.mjs importer remains authoritative.
`;
}

function parseArguments(argv) {
  const command = argv[0];
  if (!['inspect', 'install'].includes(command)) throw new Error(usage());
  const values = new Map();
  const flags = new Set();
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (flagOptions.has(argument)) {
      flags.add(argument);
      continue;
    }
    if (!valueOptions.has(argument)) throw new Error(`Unknown option ${argument}\n\n${usage()}`);
    const value = argv[index + 1];
    if (value == null || value.startsWith('--')) throw new Error(`${argument} requires a value`);
    values.set(argument, value);
    index += 1;
  }
  return { command, values, flags };
}

async function main() {
  const { command, values, flags } = parseArguments(process.argv.slice(2));
  const sourceDir = values.get('--source');
  if (!sourceDir) throw new Error('--source is required');
  if (command === 'inspect') {
    const inspection = await inspectCreatureImportSource({ sourceDir });
    process.stdout.write(`${JSON.stringify(publicInspectionSummary(inspection))}\n`);
    return;
  }
  const displayName = values.get('--display-name');
  const enemySlug = values.get('--enemy-slug');
  if (!displayName || !enemySlug) throw new Error('install requires --display-name and --enemy-slug');
  const result = await installCreaturePack({
    sourceDir,
    displayName,
    enemySlug,
    packId: values.get('--pack-id') ?? null,
    fullValidation: flags.has('--full-validation'),
    whatIf: flags.has('--what-if'),
    verbose: flags.has('--verbose'),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  const details = error.stderr?.trim() || error.stdout?.trim();
  process.stderr.write(`${path.basename(process.argv[1])}: ${error.message}${details && !error.message.includes(details) ? `\n${details}` : ''}\n`);
  process.exitCode = 1;
});
