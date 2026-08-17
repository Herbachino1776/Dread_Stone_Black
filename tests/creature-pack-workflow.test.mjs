import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  generateCreaturePackId,
  loadProductionCreaturePackCatalog,
  PRODUCTION_CREATURE_PACK_CATALOG_SCHEMA,
  resolveCreatureRegistration,
  sanitizeEnemySlug,
  serializeProductionCreaturePackCatalog,
  suggestCreatureNames,
  suggestDisplayName,
  upsertCreatureRegistration,
  writeProductionCreaturePackCatalog,
} from '../scripts/lib/creature-pack-catalog.mjs';
import { installCreaturePack, runProcess } from '../scripts/lib/creature-pack-workflow.mjs';
import { importProductionCreaturePacks } from '../scripts/lib/production-creature-pack-import.mjs';
import {
  createCreatureLabDefaultDefinition,
  ensureCreatureLabDefinition,
} from '../scripts/lib/creature-lab-definition.mjs';

const emptyCatalog = () => ({
  schema: PRODUCTION_CREATURE_PACK_CATALOG_SCHEMA,
  creatures: [],
});

async function temporaryDirectory(t, label = 'dreadstone workflow with spaces-') {
  const directory = await mkdtemp(path.join(tmpdir(), label));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function createFakeSource(root, name = 'Dread_Ram_God') {
  const sourceDir = path.join(root, 'Forge Exports', name, 'damage');
  await mkdir(sourceDir, { recursive: true });
  const files = {
    glb: path.join(sourceDir, `${name}.glb`),
    manifest: path.join(sourceDir, `${name}.json`),
    validationReport: path.join(sourceDir, `${name}_validation.json`),
    animationManifest: null,
    animationValidationReport: null,
  };
  await writeFile(files.glb, `new glb for ${name}`, 'utf8');
  await writeFile(files.manifest, '{"schema":"fixture"}', 'utf8');
  await writeFile(files.validationReport, '{"status":"PASS"}', 'utf8');
  await writeFile(path.join(sourceDir, 'do-not-copy.blend'), 'junk', 'utf8');
  return { sourceDir, files };
}

function fakeInspection(source) {
  return async () => ({
    sourceDir: source.sourceDir,
    files: source.files,
    forgeStatus: 'PASS',
    socketsAvailable: false,
    socketCount: 0,
    attacksAvailable: false,
    offensiveActionCount: 0,
  });
}

async function createFakeRepository(t, catalog = emptyCatalog()) {
  const repositoryRoot = await temporaryDirectory(t);
  const catalogPath = path.join(repositoryRoot, 'config', 'production-creature-packs.json');
  const generatedDirectory = path.join(repositoryRoot, 'public', 'generated', 'creature-packs');
  await writeProductionCreaturePackCatalog(catalog, catalogPath);
  return { repositoryRoot, catalogPath, generatedDirectory };
}

function successfulExecutor(generatedDirectory) {
  return async (_command, args, options) => {
    if (options.phase === 'authoritative production import') {
      const packId = args[args.indexOf('--id') + 1];
      await mkdir(generatedDirectory, { recursive: true });
      await writeFile(path.join(generatedDirectory, `${packId}.json`), JSON.stringify({
        attachmentSockets: { available: false, sockets: [] },
        offensiveActions: { available: false, actions: [] },
      }), 'utf8');
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  };
}

const fakeDefinitionRegistration = async () => ({
  status: 'CREATED',
  created: false,
  filePath: null,
});

test('naming sanitization, display suggestion, slug suggestion, and automatic Pack ID are deterministic', () => {
  assert.equal(suggestDisplayName('Dread_Ram_God.glb'), 'Dread Ram God');
  assert.equal(suggestDisplayName('northRoadBandit_damage_v001.glb'), 'North Road Bandit');
  assert.equal(sanitizeEnemySlug('Crème Brûlée  Guard!'), 'creme_brulee_guard');
  assert.deepEqual(suggestCreatureNames({ glbName: 'Dread_Ram_God.glb', sourceDir: 'E:/Forge Exports/Damage' }), {
    displayName: 'Dread Ram God',
    enemySlug: 'dread_ram_god',
  });
  assert.equal(generateCreaturePackId('dread_ram_god'), 'dread_ram_god_damage_v001');
});

test('a compatible imported pack creates one conservative Creature Lab definition file', async (t) => {
  const directory = await temporaryDirectory(t);
  const pack = {
    packId: 'lab_fixture_damage_v001',
    presentation: { rawHeight: 1.62 },
    animations: { approvedClips: [
      { kind: 'IDLE', name: 'Idle' },
      { kind: 'WALK', name: 'Walk' },
      { kind: 'ATTACK_OVERHEAD_ONE_HAND', name: 'Attack' },
    ] },
    damage: { activeRuntimeSegmentIds: ['head_neck', 'left_elbow', 'right_elbow'] },
  };
  const definition = createCreatureLabDefaultDefinition(pack, { definitionId: 'lab_fixture', displayName: 'Lab Fixture' });
  assert.equal(definition.presentation.targetHeight, 1.62);
  assert.deepEqual(definition.animation.selectedAnimationNames, ['Idle', 'Walk', 'Attack']);
  const first = await ensureCreatureLabDefinition(pack, { definitionId: 'lab_fixture', displayName: 'Lab Fixture', definitionDirectory: directory });
  const second = await ensureCreatureLabDefinition(pack, { definitionId: 'lab_fixture', displayName: 'Lab Fixture', definitionDirectory: directory });
  assert.equal(first.status, 'CREATED');
  assert.equal(second.status, 'EXISTING');
  assert.equal(first.filePath, second.filePath);
});

test('existing and new creature detection preserve a stable v001 identity', () => {
  const catalog = {
    schema: PRODUCTION_CREATURE_PACK_CATALOG_SCHEMA,
    creatures: [{
      packId: 'dread_ram_god_damage_v001',
      displayName: 'Dread Ram God',
      enemySlug: 'dread_ram_god',
      sourceDir: 'public/assets/enemies/dread_ram_god/damage',
    }],
  };
  const update = resolveCreatureRegistration(catalog, { displayName: 'Dread Ram God', enemySlug: 'dread_ram_god' });
  const fresh = resolveCreatureRegistration(catalog, { displayName: 'North Road Bandit', enemySlug: 'north_road_bandit' });
  assert.equal(update.mode, 'UPDATE');
  assert.equal(update.entry.packId, 'dread_ram_god_damage_v001');
  assert.equal(fresh.mode, 'NEW');
  assert.equal(fresh.entry.packId, 'north_road_bandit_damage_v001');
  assert.throws(
    () => resolveCreatureRegistration(catalog, { displayName: 'Dread Ram God', enemySlug: 'dread_ram_god', packId: 'dread_ram_god_damage_v002' }),
    /already registered as dread_ram_god_damage_v001/,
  );
});

test('catalog upsert prevents duplicates and sorts deterministically by Pack ID', () => {
  let catalog = emptyCatalog();
  catalog = upsertCreatureRegistration(catalog, {
    packId: 'zeta_damage_v001', displayName: 'Zeta', enemySlug: 'zeta', sourceDir: 'public/assets/enemies/zeta/damage',
  });
  catalog = upsertCreatureRegistration(catalog, {
    packId: 'alpha_damage_v001', displayName: 'Alpha', enemySlug: 'alpha', sourceDir: 'public/assets/enemies/alpha/damage',
  });
  catalog = upsertCreatureRegistration(catalog, {
    packId: 'zeta_damage_v001', displayName: 'Zeta Renamed', enemySlug: 'zeta', sourceDir: 'public/assets/enemies/zeta/damage',
  });
  assert.deepEqual(catalog.creatures.map((entry) => entry.packId), ['alpha_damage_v001', 'zeta_damage_v001']);
  assert.equal(catalog.creatures[1].displayName, 'Zeta Renamed');
  assert.equal((serializeProductionCreaturePackCatalog(catalog).match(/zeta_damage_v001/g) ?? []).length, 1);
});

test('--all authority reads the persistent catalog and keeps a custom fourth creature', async (t) => {
  const directory = await temporaryDirectory(t);
  const catalogPath = path.join(directory, 'production-creature-packs.json');
  const creatures = ['alpha', 'bravo', 'charlie', 'fourth_creature'].map((enemySlug) => ({
    packId: `${enemySlug}_damage_v001`,
    displayName: suggestDisplayName(enemySlug),
    enemySlug,
    sourceDir: `public/assets/enemies/${enemySlug}/damage`,
  }));
  await writeProductionCreaturePackCatalog({ schema: PRODUCTION_CREATURE_PACK_CATALOG_SCHEMA, creatures }, catalogPath);
  const calls = [];
  const imported = await importProductionCreaturePacks({
    catalogPath,
    repositoryRoot: directory,
    importer: async (entry) => {
      calls.push(entry);
      return { packId: entry.packId };
    },
  });
  assert.equal(imported.length, 4);
  assert.deepEqual(calls.map((entry) => entry.packId), creatures.map((entry) => entry.packId).sort());
  assert.ok(calls.some((entry) => entry.packId === 'fourth_creature_damage_v001'));
});

test('invalid source inspection fails before changing the current production bundle', async (t) => {
  const existing = {
    packId: 'keeper_damage_v001', displayName: 'Keeper', enemySlug: 'keeper', sourceDir: 'public/assets/enemies/keeper/damage',
  };
  const repo = await createFakeRepository(t, { schema: PRODUCTION_CREATURE_PACK_CATALOG_SCHEMA, creatures: [existing] });
  const destination = path.join(repo.repositoryRoot, existing.sourceDir);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'known-good.glb'), 'known good', 'utf8');
  await assert.rejects(installCreaturePack({
    sourceDir: 'invalid', displayName: 'Keeper', enemySlug: 'keeper', ...repo,
    inspectSource: async () => { throw new Error('Forge status FAIL'); },
  }), /Forge status FAIL/);
  assert.equal(await readFile(path.join(destination, 'known-good.glb'), 'utf8'), 'known good');
});

test('failed authoritative production import rolls back bundle, descriptor registry, and catalog', async (t) => {
  const existing = {
    packId: 'keeper_damage_v001', displayName: 'Keeper', enemySlug: 'keeper', sourceDir: 'public/assets/enemies/keeper/damage',
  };
  const repo = await createFakeRepository(t, { schema: PRODUCTION_CREATURE_PACK_CATALOG_SCHEMA, creatures: [existing] });
  const source = await createFakeSource(repo.repositoryRoot, 'Keeper');
  const destination = path.join(repo.repositoryRoot, existing.sourceDir);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'known-good.glb'), 'known good', 'utf8');
  await mkdir(repo.generatedDirectory, { recursive: true });
  await writeFile(path.join(repo.generatedDirectory, 'index.json'), 'known registry', 'utf8');
  const originalCatalog = await readFile(repo.catalogPath, 'utf8');

  await assert.rejects(installCreaturePack({
    sourceDir: source.sourceDir,
    displayName: 'Keeper',
    enemySlug: 'keeper',
    ...repo,
    inspectSource: fakeInspection(source),
    execute: async (_command, _args, options) => {
      if (options.phase === 'authoritative production import') throw new Error('simulated importer failure');
      return { exitCode: 0, stdout: '', stderr: '' };
    },
  }), /rollback PASS/);
  assert.equal(await readFile(path.join(destination, 'known-good.glb'), 'utf8'), 'known good');
  assert.equal(await readFile(path.join(repo.generatedDirectory, 'index.json'), 'utf8'), 'known registry');
  assert.equal(await readFile(repo.catalogPath, 'utf8'), originalCatalog);
});

test('failed workflow processes report concise stdout and stderr together', async () => {
  const command = [
    "process.stdout.write('x'.repeat(5000) + '\\nactual assertion failure\\n');",
    "process.stderr.write('npm wrapper failure\\n');",
    'process.exitCode = 1;',
  ].join('');
  await assert.rejects(
    runProcess(process.execPath, ['--eval', command], {
      cwd: path.resolve(import.meta.dirname, '..'),
      phase: 'fixture validation',
    }),
    (error) => {
      assert.match(error.message, /stdout:\n[\s\S]*actual assertion failure/);
      assert.match(error.message, /stderr:\n[\s\S]*npm wrapper failure/);
      assert.match(error.message, /earlier characters omitted/);
      assert.equal(error.stdout.endsWith('actual assertion failure\n'), true);
      assert.equal(error.stderr, 'npm wrapper failure\n');
      return true;
    },
  );
});

test('successful new install handles spaces, copies only required files, and registers once', async (t) => {
  const repo = await createFakeRepository(t);
  const source = await createFakeSource(repo.repositoryRoot, 'North Road Bandit');
  const result = await installCreaturePack({
    sourceDir: source.sourceDir,
    displayName: 'North Road Bandit',
    enemySlug: 'north_road_bandit',
    ...repo,
    inspectSource: fakeInspection(source),
    execute: successfulExecutor(repo.generatedDirectory),
    registerDefinition: fakeDefinitionRegistration,
  });
  assert.equal(result.mode, 'NEW');
  assert.equal(result.packId, 'north_road_bandit_damage_v001');
  const destination = path.join(repo.repositoryRoot, 'public', 'assets', 'enemies', 'north_road_bandit', 'damage');
  assert.equal(await readFile(path.join(destination, 'North Road Bandit.glb'), 'utf8'), 'new glb for North Road Bandit');
  await assert.rejects(readFile(path.join(destination, 'do-not-copy.blend')), /ENOENT/);
  const catalog = await loadProductionCreaturePackCatalog(repo.catalogPath);
  assert.deepEqual(catalog.creatures.map((entry) => entry.packId), ['north_road_bandit_damage_v001']);
});

test('successful update replaces the technical bundle without creating v002', async (t) => {
  const existing = {
    packId: 'keeper_damage_v001', displayName: 'Keeper', enemySlug: 'keeper', sourceDir: 'public/assets/enemies/keeper/damage',
  };
  const repo = await createFakeRepository(t, { schema: PRODUCTION_CREATURE_PACK_CATALOG_SCHEMA, creatures: [existing] });
  const source = await createFakeSource(repo.repositoryRoot, 'Keeper');
  const destination = path.join(repo.repositoryRoot, existing.sourceDir);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'old.glb'), 'old', 'utf8');
  const result = await installCreaturePack({
    sourceDir: source.sourceDir,
    displayName: 'Keeper',
    enemySlug: 'keeper',
    ...repo,
    inspectSource: fakeInspection(source),
    execute: successfulExecutor(repo.generatedDirectory),
    registerDefinition: fakeDefinitionRegistration,
  });
  assert.equal(result.mode, 'UPDATE');
  assert.equal(result.packId, 'keeper_damage_v001');
  await assert.rejects(readFile(path.join(destination, 'old.glb')), /ENOENT/);
  assert.equal((await loadProductionCreaturePackCatalog(repo.catalogPath)).creatures.length, 1);
});

test('WhatIf proposes the canonical destination without copying or importing', async (t) => {
  const repo = await createFakeRepository(t);
  const source = await createFakeSource(repo.repositoryRoot, 'Observer');
  let executed = false;
  const result = await installCreaturePack({
    sourceDir: source.sourceDir,
    displayName: 'Observer',
    enemySlug: 'observer',
    whatIf: true,
    ...repo,
    inspectSource: fakeInspection(source),
    execute: async () => { executed = true; },
  });
  assert.equal(result.whatIf, true);
  assert.equal(executed, false);
  assert.equal(await loadProductionCreaturePackCatalog(repo.catalogPath).then((catalog) => catalog.creatures.length), 0);
});

test('CMD drag/drop launcher preserves quoted arguments and bypasses policy only for this invocation', async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, '..');
  const launcher = await readFile(path.join(repositoryRoot, 'IMPORT_CREATURE.cmd'), 'utf8');
  const powerShell = await readFile(path.join(repositoryRoot, 'scripts', 'Import-CreaturePack.ps1'), 'utf8');
  assert.match(launcher, /-ExecutionPolicy Bypass -File "%REPO_ROOT%scripts\\Import-CreaturePack\.ps1" %\*/);
  assert.match(powerShell, /\[Parameter\(Position = 0\)\]/);
  assert.match(powerShell, /\[switch\]\$Yes/);
  assert.match(powerShell, /\[switch\]\$FullValidation/);
  assert.match(powerShell, /\[switch\]\$WhatIf/);
});

test('legacy production packs remain registered without requiring sockets or attacks', async () => {
  const catalog = await loadProductionCreaturePackCatalog();
  const registeredPackIds = new Set(catalog.creatures.map((entry) => entry.packId));
  [
    'chezwick_damage_v001',
    'dread_ram_god_damage_v001',
    'dreadguard_damage_v001',
  ].forEach((packId) => assert.equal(registeredPackIds.has(packId), true));
});
