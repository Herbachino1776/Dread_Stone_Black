#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_GENERATED_DIRECTORY,
  DEFAULT_REPOSITORY_ROOT,
  emitCreaturePacks,
  importCreaturePack,
  loadGeneratedCreaturePacks,
} from './lib/creature-pack-importer.mjs';
import { DEFAULT_CATALOG_PATH } from './lib/creature-pack-catalog.mjs';
import { importProductionCreaturePacks } from './lib/production-creature-pack-import.mjs';

const optionNames = new Set([
  '--id',
  '--display-name',
  '--source',
  '--glb',
  '--manifest',
  '--validation-report',
  '--animation-manifest',
  '--animation-validation-report',
  '--catalog',
  '--out',
]);

function usage() {
  return `Dreadstone Creature Pack importer

Usage:
  node scripts/import-creature-pack.mjs --id <pack_id> --source <damage_bundle_directory>
  node scripts/import-creature-pack.mjs --all

Options:
  --display-name <name>                 Debug/display name stored in the descriptor
  --glb <path>                          Explicit damage GLB (normally auto-discovered)
  --manifest <path>                     Explicit Forge damage manifest
  --validation-report <path>            Explicit Forge damage validation report
  --animation-manifest <path>           Optional Animation Forge manifest
  --animation-validation-report <path> Optional Animation Forge validation report
  --out <directory>                     Generated output directory
  --check                               Verify committed generated output without writing
  --catalog <path>                      Production source catalog (normally config/production-creature-packs.json)
  --all                                 Import every entry in the production source catalog
  --help                                Show this help
`;
}

function parseArguments(argv) {
  const values = new Map();
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (['--all', '--check', '--help'].includes(argument)) {
      flags.add(argument);
      continue;
    }
    if (!optionNames.has(argument)) throw new Error(`Unknown option ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
    values.set(argument, value);
    index += 1;
  }
  return { values, flags };
}

function summarize(pack) {
  return {
    packId: pack.packId,
    assetPath: pack.assets.glb,
    rawHeight: pack.presentation.rawHeight,
    topologyFingerprint: pack.source.topologyFingerprint,
    nativeProgressiveSites: pack.cost.progressiveSiteCount,
    deformationKeys: pack.cost.deformationKeyCount,
    goreMeshes: pack.cost.generatedGoreMeshCount,
    stainMeshes: pack.cost.stainMeshCount,
    availableSegments: pack.damage.availableSegmentIds,
    activeRuntimeSegments: pack.damage.activeRuntimeSegmentIds,
    animations: pack.cost.animationCount,
    approvedAnimations: pack.cost.approvedAnimationCount,
    glbFileBytes: pack.cost.glbFileBytes,
    vertices: pack.cost.vertexCount,
    triangles: pack.cost.triangleCount,
    diagnostics: pack.importDiagnostics.map((entry) => entry.code),
  };
}

async function main() {
  const { values, flags } = parseArguments(process.argv.slice(2));
  if (flags.has('--help')) {
    process.stdout.write(usage());
    return;
  }
  const repositoryRoot = DEFAULT_REPOSITORY_ROOT;
  const generatedDirectory = values.has('--out')
    ? path.resolve(repositoryRoot, values.get('--out'))
    : DEFAULT_GENERATED_DIRECTORY;
  const importAll = flags.has('--all');
  if (importAll && (values.has('--id') || values.has('--source'))) throw new Error('--all cannot be combined with --id or --source');

  let imported;
  if (importAll) {
    const catalogPath = values.has('--catalog')
      ? path.resolve(repositoryRoot, values.get('--catalog'))
      : DEFAULT_CATALOG_PATH;
    imported = await importProductionCreaturePacks({ catalogPath, repositoryRoot });
  } else {
    const packId = values.get('--id');
    const sourceDir = values.get('--source');
    if (!packId || !sourceDir) throw new Error('single-pack import requires --id and --source');
    imported = [await importCreaturePack({
      packId,
      displayName: values.get('--display-name') ?? null,
      sourceDir,
      repositoryRoot,
      glbPath: values.get('--glb') ?? null,
      manifestPath: values.get('--manifest') ?? null,
      validationReportPath: values.get('--validation-report') ?? null,
      animationManifestPath: values.get('--animation-manifest') ?? null,
      animationValidationReportPath: values.get('--animation-validation-report') ?? null,
    })];
  }

  const existing = importAll ? [] : await loadGeneratedCreaturePacks(generatedDirectory);
  const packsById = new Map(existing.map((pack) => [pack.packId, pack]));
  imported.forEach((pack) => packsById.set(pack.packId, pack));
  const result = await emitCreaturePacks([...packsById.values()], {
    repositoryRoot,
    generatedDirectory,
    check: flags.has('--check'),
  });
  for (const pack of imported) process.stdout.write(`${JSON.stringify(summarize(pack))}\n`);
  process.stdout.write(`${flags.has('--check') ? 'Verified' : 'Generated'} ${result.packs.length} Creature Pack descriptor(s) and registry at ${generatedDirectory}\n`);
}

main().catch((error) => {
  const scriptName = path.basename(fileURLToPath(import.meta.url));
  process.stderr.write(`${scriptName}: ${error.message}\n`);
  process.exitCode = 1;
});
