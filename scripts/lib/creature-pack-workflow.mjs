import { spawn } from 'node:child_process';
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_GENERATED_DIRECTORY,
  DEFAULT_REPOSITORY_ROOT,
  inspectCreatureBundleMetadata,
} from './creature-pack-importer.mjs';
import {
  DEFAULT_CATALOG_PATH,
  generateCreaturePackId,
  loadProductionCreaturePackCatalog,
  resolveCreatureRegistration,
  suggestCreatureNames,
  upsertCreatureRegistration,
  writeProductionCreaturePackCatalog,
} from './creature-pack-catalog.mjs';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const importerScript = path.resolve(moduleDirectory, '..', 'import-creature-pack.mjs');

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function relativeRepositoryPath(repositoryRoot, targetPath, { trailingSlash = false } = {}) {
  const value = path.relative(repositoryRoot, targetPath).split(path.sep).join('/');
  return trailingSlash ? `${value.replace(/\/$/, '')}/` : value;
}

function workflowError(message, cause = null) {
  const error = new Error(`[Creature Import Workflow] ${message}`, cause ? { cause } : undefined);
  if (cause?.stdout) error.stdout = cause.stdout;
  if (cause?.stderr) error.stderr = cause.stderr;
  return error;
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    throw workflowError(`${label} could not be read: ${filePath}: ${error.message}`, error);
  }
}

export async function inspectCreatureImportSource({
  sourceDir,
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  catalogPath = DEFAULT_CATALOG_PATH,
} = {}) {
  const bundle = await inspectCreatureBundleMetadata({ sourceDir, repositoryRoot });
  const catalog = await loadProductionCreaturePackCatalog(catalogPath);
  const names = suggestCreatureNames({ glbName: path.basename(bundle.glbPath), sourceDir: bundle.sourceDir });
  const inferredPackId = generateCreaturePackId(names.enemySlug);
  const existing = catalog.creatures.find((entry) => entry.enemySlug === names.enemySlug || entry.packId === inferredPackId) ?? null;
  const animationManifest = bundle.animationManifestPath
    ? await readJson(bundle.animationManifestPath, 'animation manifest')
    : null;
  const runtimeAnimations = bundle.manifest.runtimeAnimations;
  const enabledSockets = Array.isArray(bundle.manifest.runtimeAttachmentSockets?.sockets)
    ? bundle.manifest.runtimeAttachmentSockets.sockets.filter((socket) => socket?.enabled !== false)
    : [];
  const offensiveActions = Array.isArray(runtimeAnimations?.offensiveActions) ? runtimeAnimations.offensiveActions : [];
  return {
    sourceDir: bundle.sourceDir,
    files: {
      glb: bundle.glbPath,
      manifest: bundle.manifestPath,
      validationReport: bundle.validationReportPath,
      animationManifest: bundle.animationManifestPath,
      animationValidationReport: bundle.animationValidationReportPath,
    },
    forgeStatus: bundle.report.status,
    runtimeRig: bundle.manifest.runtimeSkeleton?.armature ?? bundle.manifest.source?.armature ?? null,
    animationCount: Number.isInteger(animationManifest?.approved_animation_count)
      ? animationManifest.approved_animation_count
      : (Number.isInteger(runtimeAnimations?.exportedCount) ? runtimeAnimations.exportedCount : null),
    socketsAvailable: enabledSockets.length > 0,
    socketCount: enabledSockets.length,
    attacksAvailable: offensiveActions.length > 0,
    offensiveActionCount: offensiveActions.length,
    suggestedDisplayName: existing?.displayName ?? names.displayName,
    suggestedEnemySlug: existing?.enemySlug ?? names.enemySlug,
    suggestedPackId: existing?.packId ?? inferredPackId,
    existing,
    bundle,
  };
}

export function publicInspectionSummary(inspection) {
  const { bundle: _bundle, ...summary } = inspection;
  return summary;
}

const FAILED_PROCESS_STREAM_LIMIT = 4000;

function summarizeFailedProcessStream(label, value) {
  const output = value.trim();
  if (!output) return null;
  if (output.length <= FAILED_PROCESS_STREAM_LIMIT) return `${label}:\n${output}`;
  const omitted = output.length - FAILED_PROCESS_STREAM_LIMIT;
  return `${label}:\n[... ${omitted} earlier characters omitted ...]\n${output.slice(-FAILED_PROCESS_STREAM_LIMIT)}`;
}

export function formatFailedProcessOutput({ stdout = '', stderr = '', exitCode = null } = {}) {
  const sections = [
    summarizeFailedProcessStream('stdout', stdout),
    summarizeFailedProcessStream('stderr', stderr),
  ].filter(Boolean);
  return sections.join('\n\n') || `exit code ${exitCode}`;
}

export function runProcess(command, args, { cwd, verbose = false, phase = 'command' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      shell: false,
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (verbose) process.stderr.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (verbose) process.stderr.write(chunk);
    });
    child.on('error', (error) => reject(workflowError(`${phase} could not start: ${error.message}`, error)));
    child.on('close', (exitCode) => {
      if (exitCode === 0) resolve({ exitCode, stdout, stderr });
      else {
        const detail = formatFailedProcessOutput({ stdout, stderr, exitCode });
        const error = workflowError(`${phase} failed: ${detail}`);
        error.exitCode = exitCode;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

function npmProcessArguments(args) {
  if (process.platform !== 'win32') return { command: 'npm', args };
  return {
    command: process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/s', '/c', 'npm.cmd', ...args],
  };
}

async function copyDiscoveredBundle(inspection, stagingRoot) {
  const damageDirectory = path.join(stagingRoot, 'payload', 'damage');
  await mkdir(damageDirectory, { recursive: true });
  for (const sourcePath of [
    inspection.files.glb,
    inspection.files.manifest,
    inspection.files.validationReport,
  ]) {
    await copyFile(sourcePath, path.join(damageDirectory, path.basename(sourcePath)));
  }
  let animationDirectory = null;
  if (inspection.files.animationManifest) {
    animationDirectory = path.join(stagingRoot, 'payload', 'animations');
    await mkdir(animationDirectory, { recursive: true });
    await copyFile(inspection.files.animationManifest, path.join(animationDirectory, path.basename(inspection.files.animationManifest)));
    await copyFile(inspection.files.animationValidationReport, path.join(animationDirectory, path.basename(inspection.files.animationValidationReport)));
  }
  return { damageDirectory, animationDirectory };
}

async function restoreTransaction({
  destinationDamage,
  destinationAnimations,
  replacedAnimations,
  backupDamage,
  backupAnimations,
  hadDamage,
  hadAnimations,
  generatedDirectory,
  backupGenerated,
  hadGenerated,
  catalogPath,
  catalogSource,
  hadCatalog,
}) {
  const failures = [];
  const attempt = async (label, operation) => {
    try {
      await operation();
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
    }
  };
  await attempt('damage bundle', async () => {
    await rm(destinationDamage, { recursive: true, force: true });
    if (hadDamage && await pathExists(backupDamage)) {
      await mkdir(path.dirname(destinationDamage), { recursive: true });
      await rename(backupDamage, destinationDamage);
    }
  });
  if (replacedAnimations) await attempt('animation sidecar', async () => {
    await rm(destinationAnimations, { recursive: true, force: true });
    if (hadAnimations && await pathExists(backupAnimations)) {
      await rename(backupAnimations, destinationAnimations);
    }
  });
  await attempt('generated Creature Packs', async () => {
    await rm(generatedDirectory, { recursive: true, force: true });
    if (hadGenerated && await pathExists(backupGenerated)) await rename(backupGenerated, generatedDirectory);
  });
  await attempt('production catalog', async () => {
    if (hadCatalog) await writeFile(catalogPath, catalogSource, 'utf8');
    else await rm(catalogPath, { force: true });
  });
  if (failures.length) throw workflowError(failures.join('; '));
}

export async function installCreaturePack({
  sourceDir,
  displayName,
  enemySlug,
  packId = null,
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  catalogPath = DEFAULT_CATALOG_PATH,
  generatedDirectory = DEFAULT_GENERATED_DIRECTORY,
  fullValidation = false,
  whatIf = false,
  verbose = false,
  inspectSource = inspectCreatureImportSource,
  execute = runProcess,
} = {}) {
  const inspection = await inspectSource({ sourceDir, repositoryRoot, catalogPath });
  const catalog = await loadProductionCreaturePackCatalog(catalogPath);
  const resolution = resolveCreatureRegistration(catalog, { displayName, enemySlug, packId });
  const destinationDamage = path.resolve(repositoryRoot, resolution.entry.sourceDir);
  const destinationAnimations = path.resolve(destinationDamage, '..', 'animations');
  const plan = {
    mode: resolution.mode,
    displayName: resolution.entry.displayName,
    enemySlug: resolution.entry.enemySlug,
    packId: resolution.entry.packId,
    sourceDir: inspection.sourceDir,
    destinationDamage,
    descriptorPath: path.join(generatedDirectory, `${resolution.entry.packId}.json`),
    catalogPath,
    forgeStatus: inspection.forgeStatus,
    socketsAvailable: inspection.socketsAvailable,
    socketCount: inspection.socketCount,
    attacksAvailable: inspection.attacksAvailable,
    offensiveActionCount: inspection.offensiveActionCount,
  };
  if (whatIf) return { ...plan, whatIf: true };

  const stagingParent = path.resolve(repositoryRoot, 'public', 'assets', 'enemies');
  await mkdir(stagingParent, { recursive: true });
  const stagingRoot = await mkdtemp(path.join(stagingParent, '.creature-import-staging-'));
  const backupRoot = await mkdtemp(path.join(repositoryRoot, '.creature-import-backup-'));
  const backupDamage = path.join(backupRoot, 'damage');
  const backupAnimations = path.join(backupRoot, 'animations');
  const backupGenerated = path.join(backupRoot, 'generated-creature-packs');
  const hadDamage = await pathExists(destinationDamage);
  const hadAnimations = await pathExists(destinationAnimations);
  const hadGenerated = await pathExists(generatedDirectory);
  const hadCatalog = await pathExists(catalogPath);
  const catalogSource = hadCatalog ? await readFile(catalogPath, 'utf8') : null;
  let productionChanged = false;
  let replacedAnimations = false;
  let keepBackup = false;
  try {
    const staged = await copyDiscoveredBundle(inspection, stagingRoot);
    const preflightOutput = path.join(stagingRoot, 'generated');
    await execute(process.execPath, [
      importerScript,
      '--id', resolution.entry.packId,
      '--display-name', resolution.entry.displayName,
      '--source', staged.damageDirectory,
      '--out', preflightOutput,
    ], { cwd: repositoryRoot, verbose, phase: 'authoritative staging preflight' });

    if (hadGenerated) await cp(generatedDirectory, backupGenerated, { recursive: true });
    productionChanged = true;
    replacedAnimations = Boolean(staged.animationDirectory);
    if (hadDamage) await rename(destinationDamage, backupDamage);
    if (staged.animationDirectory && hadAnimations) await rename(destinationAnimations, backupAnimations);
    await mkdir(path.dirname(destinationDamage), { recursive: true });
    await rename(staged.damageDirectory, destinationDamage);
    if (staged.animationDirectory) {
      await rename(staged.animationDirectory, destinationAnimations);
    }

    const updatedCatalog = upsertCreatureRegistration(catalog, resolution.entry);
    await writeProductionCreaturePackCatalog(updatedCatalog, catalogPath);

    await execute(process.execPath, [
      importerScript,
      '--id', resolution.entry.packId,
      '--display-name', resolution.entry.displayName,
      '--source', destinationDamage,
    ], { cwd: repositoryRoot, verbose, phase: 'authoritative production import' });

    const creaturePackValidation = npmProcessArguments(['run', 'validate:creature-packs']);
    await execute(creaturePackValidation.command, creaturePackValidation.args, {
      cwd: repositoryRoot,
      verbose,
      phase: 'Creature Pack validation',
    });
    if (fullValidation) {
      const combatValidation = npmProcessArguments(['run', 'validate:combat']);
      const productionBuild = npmProcessArguments(['run', 'build']);
      await execute(combatValidation.command, combatValidation.args, { cwd: repositoryRoot, verbose, phase: 'combat validation' });
      await execute(productionBuild.command, productionBuild.args, { cwd: repositoryRoot, verbose, phase: 'production build' });
    }

    const descriptor = await readJson(plan.descriptorPath, 'generated Creature Pack descriptor');
    return {
      ...plan,
      whatIf: false,
      installedPath: relativeRepositoryPath(repositoryRoot, destinationDamage, { trailingSlash: true }),
      descriptorPath: relativeRepositoryPath(repositoryRoot, plan.descriptorPath),
      catalogStatus: resolution.mode === 'NEW' ? 'REGISTERED' : 'UPDATED',
      creaturePackValidation: 'PASS',
      fullValidation: fullValidation ? 'PASS' : 'NOT REQUESTED',
      socketsAvailable: descriptor.attachmentSockets?.available === true,
      socketCount: descriptor.attachmentSockets?.sockets?.length ?? 0,
      attacksAvailable: descriptor.offensiveActions?.available === true,
      offensiveActionCount: descriptor.offensiveActions?.actions?.length ?? 0,
    };
  } catch (error) {
    let rollbackError = null;
    if (productionChanged) {
      try {
        await restoreTransaction({
          destinationDamage,
          destinationAnimations,
          replacedAnimations,
          backupDamage,
          backupAnimations,
          hadDamage,
          hadAnimations,
          generatedDirectory,
          backupGenerated,
          hadGenerated,
          catalogPath,
          catalogSource,
          hadCatalog,
        });
      } catch (restoreError) {
        rollbackError = restoreError;
        keepBackup = true;
      }
    }
    const rollbackMessage = productionChanged
      ? (rollbackError
        ? `rollback FAILED: ${rollbackError.message}; recovery backup retained at ${backupRoot}`
        : 'rollback PASS; previous production files were restored')
      : 'production was not changed';
    throw workflowError(`${error.message}; ${rollbackMessage}`, error);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
    if (!keepBackup) await rm(backupRoot, { recursive: true, force: true }).catch(() => {});
  }
}
