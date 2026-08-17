import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseEnemyPreset, serializeEnemyPreset } from '../src/contracts/EnemyPreset.js';
import { createNpcLoadoutForWeapon, NpcLoadoutRegistry, PRODUCTION_NPC_LOADOUTS } from '../src/game/combat/NpcLoadout.js';
import { NpcWeaponRegistry, PRODUCTION_WORLD_WEAPONS } from '../src/game/combat/NpcWeaponRegistry.js';
import { CreatureDefinitionRegistry, PRODUCTION_CREATURE_DEFINITIONS } from '../src/game/creatures/CreatureDefinitionRegistry.js';
import { CreatureFactory } from '../src/game/creatures/CreatureFactory.js';
import { CreaturePackRegistry } from '../src/game/creatures/CreaturePackRegistry.js';
import { DREAD_RAM_GOD_GREAT_MACE_PRESET, EnemyPresetRegistry } from '../src/game/creatures/EnemyPresetRegistry.js';
import { EnemyPresetResolver } from '../src/game/creatures/EnemyPresetResolver.js';

export const DEFAULT_ENEMY_PRESET_DIRECTORY = fileURLToPath(new URL('../src/game/creatures/presets/', import.meta.url));
const DEFINITION_DIRECTORY = fileURLToPath(new URL('../src/game/creatures/data/', import.meta.url));
const WEAPON_DIRECTORY = fileURLToPath(new URL('../src/game/combat/weapons/data/', import.meta.url));
const PUBLIC_DIRECTORY = fileURLToPath(new URL('../public/', import.meta.url));

export class EnemyPresetInstallerError extends Error {
  constructor(code, message, options = {}) {
    super(`[Enemy Preset Installer:${code}] ${message}`, options);
    this.name = 'EnemyPresetInstallerError';
    this.code = code;
  }
}

async function readJsonDirectory(directory) {
  await mkdir(directory, { recursive: true });
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name).sort();
  return Promise.all(names.map(async (name) => ({ name, value: JSON.parse(await readFile(path.join(directory, name), 'utf8')) })));
}

async function projectFetch(requestUrl) {
  const relative = decodeURIComponent(new URL(requestUrl).pathname).replace(/^\/+/, '');
  const root = path.resolve(PUBLIC_DIRECTORY);
  const filename = path.resolve(root, relative);
  if (filename !== root && !filename.startsWith(`${root}${path.sep}`)) return { ok: false, status: 403, json: async () => ({}) };
  try { return { ok: true, status: 200, json: async () => JSON.parse(await readFile(filename, 'utf8')) }; }
  catch (error) { return { ok: false, status: error.code === 'ENOENT' ? 404 : 500, json: async () => ({}) }; }
}

function safeFilename(presetId) {
  if (!/^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/.test(presetId)) throw new EnemyPresetInstallerError('UNSAFE_PRESET_ID', 'Preset ID cannot derive a project filename.');
  return `${presetId}.json`;
}

export async function readInstalledEnemyPresets(directory = DEFAULT_ENEMY_PRESET_DIRECTORY) {
  const records = await readJsonDirectory(directory);
  return records.map(({ name, value }) => {
    const preset = parseEnemyPreset(JSON.stringify(value));
    if (name !== safeFilename(preset.presetId)) throw new EnemyPresetInstallerError('INVALID_INSTALLED_CONTENT', `${name}: filename must be ${safeFilename(preset.presetId)}`);
    return preset;
  });
}

export async function validateEnemyPresetCatalog(authoredPresets) {
  const fileDefinitions = (await readJsonDirectory(DEFINITION_DIRECTORY)).map((entry) => entry.value);
  const fileWeapons = (await readJsonDirectory(WEAPON_DIRECTORY)).map((entry) => entry.value);
  const presetRegistry = new EnemyPresetRegistry({ presets: [
    ...(authoredPresets.some((preset) => preset.presetId === DREAD_RAM_GOD_GREAT_MACE_PRESET.presetId) ? [] : [DREAD_RAM_GOD_GREAT_MACE_PRESET]),
    ...authoredPresets,
  ] });
  const definitionRegistry = new CreatureDefinitionRegistry({ definitions: [...PRODUCTION_CREATURE_DEFINITIONS, ...fileDefinitions] });
  const weaponRegistry = new NpcWeaponRegistry({ definitions: [...PRODUCTION_WORLD_WEAPONS, ...fileWeapons] });
  const loadoutRegistry = new NpcLoadoutRegistry({ loadouts: [...PRODUCTION_NPC_LOADOUTS, ...fileWeapons.map(createNpcLoadoutForWeapon)] });
  const creaturePackRegistry = new CreaturePackRegistry({ baseUrl: 'http://dreadstone-project/', fetchImplementation: projectFetch });
  const creatureFactory = new CreatureFactory({ definitionRegistry, creaturePackRegistry });
  const resolver = new EnemyPresetResolver({ presetRegistry, definitionRegistry, creaturePackRegistry, creatureFactory, loadoutRegistry, weaponRegistry });
  for (const preset of presetRegistry.listPresets()) {
    try { await resolver.resolve(preset.presetId); }
    catch (error) { throw new EnemyPresetInstallerError('UNRESOLVABLE_PRESET', `${preset.presetId}: ${error.message}`, { cause: error }); }
  }
  return presetRegistry;
}

export async function installEnemyPreset(serializedOrPreset, { directory = DEFAULT_ENEMY_PRESET_DIRECTORY } = {}) {
  let preset;
  try { preset = parseEnemyPreset(typeof serializedOrPreset === 'string' ? serializedOrPreset : JSON.stringify(serializedOrPreset)); }
  catch (error) { throw new EnemyPresetInstallerError('INVALID_CONTRACT', error.message, { cause: error }); }
  const existing = await readInstalledEnemyPresets(directory);
  const replacement = existing.filter((entry) => entry.presetId !== preset.presetId).concat(preset);
  await validateEnemyPresetCatalog(replacement);
  await mkdir(directory, { recursive: true });
  const filename = safeFilename(preset.presetId);
  const destination = path.resolve(directory, filename);
  if (path.dirname(destination) !== path.resolve(directory)) throw new EnemyPresetInstallerError('PATH_TRAVERSAL', 'Preset destination escaped the production catalog.');
  const token = randomUUID().replaceAll('-', '');
  const temporary = path.join(directory, `.${filename}.${token}.tmp`);
  const backup = path.join(directory, `.${filename}.${token}.bak`);
  let installed = false;
  let backedUp = false;
  try {
    await writeFile(temporary, serializeEnemyPreset(preset), { encoding: 'utf8', flag: 'wx' });
    try { await rename(destination, backup); backedUp = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(temporary, destination);
    installed = true;
    await validateEnemyPresetCatalog(await readInstalledEnemyPresets(directory));
    if (backedUp) await rm(backup, { force: true });
    return { presetId: preset.presetId, destination, relativePath: path.posix.join('src/game/creatures/presets', filename) };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    if (installed) await rm(destination, { force: true }).catch(() => {});
    if (backedUp) await rename(backup, destination).catch(() => {});
    if (error instanceof EnemyPresetInstallerError) throw error;
    throw new EnemyPresetInstallerError('TRANSACTION_FAILED', `Preset install rolled back: ${error.message}`, { cause: error });
  }
}
