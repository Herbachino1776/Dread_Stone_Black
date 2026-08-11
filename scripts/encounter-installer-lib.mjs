import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseEncounterDefinition, serializeEncounterDefinition } from '../src/contracts/EncounterDefinition.js';
import { EnemyPresetRegistry } from '../src/game/creatures/EnemyPresetRegistry.js';
import { EnemyPresetResolver } from '../src/game/creatures/EnemyPresetResolver.js';
import { CreaturePackRegistry } from '../src/game/creatures/CreaturePackRegistry.js';
import { EncounterRegistry } from '../src/game/encounters/EncounterRegistry.js';
import { hasLocationDefinition } from '../src/game/locations/locationRegistry.js';

export const DEFAULT_ENCOUNTER_DATA_DIRECTORY = fileURLToPath(new URL('../src/game/encounters/data/', import.meta.url));
const PROJECT_PUBLIC_DIRECTORY = fileURLToPath(new URL('../public/', import.meta.url));

export class EncounterInstallerError extends Error {
  constructor(code, message, options = {}) {
    super(`[Encounter Installer:${code}] ${message}`, options);
    this.name = 'EncounterInstallerError';
    this.code = code;
  }
}

function assertSafeEncounterId(encounterId) {
  if (!/^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/.test(encounterId)) {
    throw new EncounterInstallerError('UNSAFE_ENCOUNTER_ID', `Encounter ID "${encounterId}" cannot derive a project filename.`);
  }
  const filename = `${encounterId}.json`;
  if (path.basename(filename) !== filename || filename.includes('..') || path.isAbsolute(filename)) {
    throw new EncounterInstallerError('PATH_TRAVERSAL', 'Encounter destination must remain inside the production encounter directory.');
  }
  return filename;
}

async function readProjectPublicJson(requestUrl) {
  const relativePath = decodeURIComponent(new URL(requestUrl).pathname).replace(/^\/+/, '');
  const root = path.resolve(PROJECT_PUBLIC_DIRECTORY);
  const filename = path.resolve(root, relativePath);
  if (filename !== root && !filename.startsWith(`${root}${path.sep}`)) return { ok: false, status: 403, json: async () => ({}) };
  try {
    const serialized = await readFile(filename, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(serialized) };
  } catch (error) {
    return { ok: false, status: error.code === 'ENOENT' ? 404 : 500, json: async () => ({}) };
  }
}

export function createProjectEnemyPresetResolver({ presetRegistry = new EnemyPresetRegistry() } = {}) {
  const creaturePackRegistry = new CreaturePackRegistry({
    baseUrl: 'http://dreadstone-project/',
    fetchImplementation: readProjectPublicJson,
  });
  return new EnemyPresetResolver({ presetRegistry, creaturePackRegistry });
}

export async function readInstalledEncounterDefinitions(dataDirectory = DEFAULT_ENCOUNTER_DATA_DIRECTORY) {
  await mkdir(dataDirectory, { recursive: true });
  const filenames = (await readdir(dataDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((first, second) => first.localeCompare(second));
  const definitions = [];
  for (const filename of filenames) {
    const serialized = await readFile(path.join(dataDirectory, filename), 'utf8');
    try {
      const definition = parseEncounterDefinition(serialized);
      const expectedFilename = assertSafeEncounterId(definition.encounterId);
      if (filename !== expectedFilename) throw new Error(`filename must be ${expectedFilename}`);
      definitions.push(definition);
    } catch (error) {
      throw new EncounterInstallerError('INVALID_INSTALLED_CONTENT', `${filename}: ${error.message}`, { cause: error });
    }
  }
  return definitions;
}

export async function validateEncounterInstallSemantics(definition, {
  hasLocation = hasLocationDefinition,
  presetRegistry = new EnemyPresetRegistry(),
  enemyPresetResolver = createProjectEnemyPresetResolver({ presetRegistry }),
} = {}) {
  if (!hasLocation(definition.locationId)) {
    throw new EncounterInstallerError('UNKNOWN_LOCATION', `Encounter locationId "${definition.locationId}" is not registered by the game.`);
  }
  const resolvedPresetIds = new Set();
  for (const spawn of definition.spawns) {
    if (!presetRegistry.hasPreset(spawn.presetId)) {
      throw new EncounterInstallerError('UNKNOWN_PRESET', `Spawn "${spawn.spawnId}" references unknown Enemy Preset "${spawn.presetId}".`);
    }
    if (resolvedPresetIds.has(spawn.presetId)) continue;
    try {
      await enemyPresetResolver.resolve(spawn.presetId);
      resolvedPresetIds.add(spawn.presetId);
    } catch (error) {
      throw new EncounterInstallerError(
        'UNRESOLVABLE_PRESET',
        `Spawn "${spawn.spawnId}" references Enemy Preset "${spawn.presetId}", but its production dependencies do not resolve: ${error.message}`,
        { cause: error },
      );
    }
  }
  return definition;
}

export async function validateInstalledEncounterCatalog(dataDirectory = DEFAULT_ENCOUNTER_DATA_DIRECTORY, options = {}) {
  const definitions = await readInstalledEncounterDefinitions(dataDirectory);
  const presetRegistry = options.presetRegistry ?? new EnemyPresetRegistry();
  const enemyPresetResolver = options.enemyPresetResolver ?? createProjectEnemyPresetResolver({ presetRegistry });
  for (const definition of definitions) {
    await validateEncounterInstallSemantics(definition, { ...options, presetRegistry, enemyPresetResolver });
  }
  try {
    const registry = new EncounterRegistry({ encounters: definitions });
    return {
      definitions,
      encounterIds: registry.listEncounters().map((entry) => entry.encounterId).sort(),
      spawnIds: registry.listEncounters().flatMap((entry) => entry.spawns.map((spawn) => spawn.spawnId)).sort(),
    };
  } catch (error) {
    throw new EncounterInstallerError(error.code ?? 'INVALID_CATALOG', error.message, { cause: error });
  }
}

export async function installEncounterDefinition(serializedOrDefinition, {
  dataDirectory = DEFAULT_ENCOUNTER_DATA_DIRECTORY,
  hasLocation = hasLocationDefinition,
  presetRegistry = new EnemyPresetRegistry(),
  enemyPresetResolver = createProjectEnemyPresetResolver({ presetRegistry }),
  afterInstallValidation = null,
} = {}) {
  let definition;
  try {
    definition = typeof serializedOrDefinition === 'string'
      ? parseEncounterDefinition(serializedOrDefinition)
      : parseEncounterDefinition(JSON.stringify(serializedOrDefinition));
  } catch (error) {
    throw new EncounterInstallerError('INVALID_CONTRACT', error.message, { cause: error });
  }
  await validateEncounterInstallSemantics(definition, { hasLocation, presetRegistry, enemyPresetResolver });
  const filename = assertSafeEncounterId(definition.encounterId);
  await mkdir(dataDirectory, { recursive: true });
  const destination = path.resolve(dataDirectory, filename);
  const resolvedDirectory = path.resolve(dataDirectory);
  if (path.dirname(destination) !== resolvedDirectory) throw new EncounterInstallerError('PATH_TRAVERSAL', 'Resolved encounter destination escaped the production encounter directory.');

  const installedBefore = await readInstalledEncounterDefinitions(dataDirectory);
  const replacementCatalog = installedBefore.filter((entry) => entry.encounterId !== definition.encounterId).concat(definition);
  for (const entry of replacementCatalog) {
    await validateEncounterInstallSemantics(entry, { hasLocation, presetRegistry, enemyPresetResolver });
  }
  try {
    new EncounterRegistry({ encounters: replacementCatalog });
  } catch (error) {
    throw new EncounterInstallerError(error.code ?? 'INVALID_CATALOG', error.message, { cause: error });
  }

  const transactionId = randomUUID().replaceAll('-', '');
  const temporary = path.join(resolvedDirectory, `.${filename}.${transactionId}.tmp`);
  const backup = path.join(resolvedDirectory, `.${filename}.${transactionId}.bak`);
  const canonicalJson = serializeEncounterDefinition(definition);
  let backedUp = false;
  let installed = false;
  try {
    await writeFile(temporary, canonicalJson, { encoding: 'utf8', flag: 'wx' });
    try {
      await rename(destination, backup);
      backedUp = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await rename(temporary, destination);
    installed = true;
    const catalog = await validateInstalledEncounterCatalog(dataDirectory, { hasLocation, presetRegistry, enemyPresetResolver });
    await afterInstallValidation?.({ definition, destination, catalog });
    if (backedUp) await rm(backup, { force: true });
    return {
      encounterId: definition.encounterId,
      locationId: definition.locationId,
      spawnCount: definition.spawns.length,
      destination,
      relativePath: path.posix.join('src/game/encounters/data', filename),
      canonicalJson,
      catalogEncounterIds: catalog.encounterIds,
    };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    if (installed) await rm(destination, { force: true }).catch(() => {});
    if (backedUp) await rename(backup, destination).catch(() => {});
    if (error instanceof EncounterInstallerError) throw error;
    throw new EncounterInstallerError('TRANSACTION_FAILED', `Encounter install rolled back: ${error.message}`, { cause: error });
  }
}
