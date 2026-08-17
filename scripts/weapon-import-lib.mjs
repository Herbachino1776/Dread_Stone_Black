import { constants } from 'node:fs';
import { copyFile, mkdir, open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FORGE_WEAPON_CLASSES } from '../src/contracts/ForgeRuntimeArmament.js';
import { createNpcLoadoutForWeapon, NpcLoadoutRegistry } from '../src/game/combat/NpcLoadout.js';
import { NPC_WEAPON_SCHEMA, NpcWeaponRegistry, PRODUCTION_WORLD_WEAPONS } from '../src/game/combat/NpcWeaponRegistry.js';

export const DEFAULT_IMPORTED_WEAPON_DATA_DIRECTORY = fileURLToPath(new URL('../src/game/combat/weapons/data/', import.meta.url));
export const DEFAULT_IMPORTED_WEAPON_ASSET_DIRECTORY = fileURLToPath(new URL('../public/assets/weapons/imported/', import.meta.url));

const CLASS_DEFAULTS = Object.freeze({
  ONE_HAND_BLADE: { capsule: [[0, 0, -0.82], [0, 0, -0.16], 0.055], damage: 30, damageType: 'slash', impactStrength: 0.7, reachCategory: 'long' },
  ONE_HAND_BLUNT: { capsule: [[0, 0, -0.48], [0, 0, -0.29], 0.13], damage: 34, damageType: 'heavy-blunt', impactStrength: 0.82, reachCategory: 'medium' },
  TWO_HAND_BLADE: { capsule: [[0, 0, -1.2], [0, 0, -0.2], 0.07], damage: 42, damageType: 'slash', impactStrength: 0.88, reachCategory: 'very-long' },
  TWO_HAND_BLUNT: { capsule: [[0, 0, -1.05], [0, 0, -0.28], 0.15], damage: 48, damageType: 'heavy-blunt', impactStrength: 1, reachCategory: 'very-long' },
  POLEARM: { capsule: [[0, 0, -1.55], [0, 0, -0.7], 0.08], damage: 38, damageType: 'piercing', impactStrength: 0.8, reachCategory: 'polearm' },
});

export class WeaponImportError extends Error {
  constructor(code, message, options = {}) {
    super(`[Weapon Import:${code}] ${message}`, options);
    this.name = 'WeaponImportError';
    this.code = code;
  }
}

export function deriveWeaponId(filename) {
  return path.basename(filename, path.extname(filename)).toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function deriveDisplayName(weaponId) {
  return weaponId.split('_').filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

async function assertGlb(filename) {
  if (path.extname(filename).toLowerCase() !== '.glb') throw new WeaponImportError('UNSUPPORTED_FILE', 'Weapon source must be a .glb file.');
  const details = await stat(filename).catch((error) => { throw new WeaponImportError('SOURCE_UNAVAILABLE', `${filename}: ${error.message}`, { cause: error }); });
  if (!details.isFile() || details.size < 20) throw new WeaponImportError('INVALID_GLB', 'Weapon GLB is empty or truncated.');
  const handle = await open(filename, 'r');
  try {
    const header = Buffer.alloc(20);
    await handle.read(header, 0, 20, 0);
    const firstChunkLength = header.readUInt32LE(12);
    const firstChunkType = header.readUInt32LE(16);
    if (header.toString('ascii', 0, 4) !== 'glTF' || header.readUInt32LE(4) !== 2 || header.readUInt32LE(8) !== details.size
      || firstChunkType !== 0x4E4F534A || firstChunkLength < 2 || 20 + firstChunkLength > details.size) {
      throw new WeaponImportError('INVALID_GLB', 'Weapon file is not a complete GLB 2.0 asset.');
    }
  } finally { await handle.close(); }
}

export function createImportedWeaponDefinition({ weaponId, displayName, weaponClass }) {
  if (!FORGE_WEAPON_CLASSES.includes(weaponClass)) throw new WeaponImportError('INVALID_WEAPON_CLASS', `Choose one of: ${FORGE_WEAPON_CLASSES.join(', ')}.`);
  const defaults = CLASS_DEFAULTS[weaponClass];
  const definition = {
    schema: NPC_WEAPON_SCHEMA,
    weaponId,
    displayName,
    assetPath: `/assets/weapons/imported/${weaponId}.glb`,
    assetScale: 1,
    weaponClass,
    compatibleSocketRoles: ['MAIN_HAND_R'],
    gripTransform: { position: [0, 0, 0], quaternion: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] },
    attackCapsule: { start: defaults.capsule[0], end: defaults.capsule[1], radius: defaults.capsule[2] },
    damage: defaults.damage,
    damageType: defaults.damageType,
    impactStrength: defaults.impactStrength,
    reachCategory: defaults.reachCategory,
  };
  new NpcWeaponRegistry({ definitions: [definition] });
  new NpcLoadoutRegistry({ loadouts: [createNpcLoadoutForWeapon(definition)] });
  return definition;
}

export async function importWeaponGlb(sourceFilename, {
  weaponId = deriveWeaponId(sourceFilename),
  displayName = null,
  weaponClass,
  dataDirectory = DEFAULT_IMPORTED_WEAPON_DATA_DIRECTORY,
  assetDirectory = DEFAULT_IMPORTED_WEAPON_ASSET_DIRECTORY,
} = {}) {
  await assertGlb(sourceFilename);
  if (PRODUCTION_WORLD_WEAPONS.some((weapon) => weapon.weaponId === weaponId)) {
    throw new WeaponImportError('RESERVED_WEAPON_ID', `Weapon ID "${weaponId}" is already owned by the canonical catalog. Rename the GLB before importing it.`);
  }
  const definition = createImportedWeaponDefinition({ weaponId, displayName: displayName ?? deriveDisplayName(weaponId), weaponClass });
  await mkdir(dataDirectory, { recursive: true });
  await mkdir(assetDirectory, { recursive: true });
  const jsonDestination = path.resolve(dataDirectory, `${weaponId}.json`);
  const assetDestination = path.resolve(assetDirectory, `${weaponId}.glb`);
  if (path.dirname(jsonDestination) !== path.resolve(dataDirectory) || path.dirname(assetDestination) !== path.resolve(assetDirectory)) {
    throw new WeaponImportError('PATH_TRAVERSAL', 'Derived weapon destination escaped the project catalog.');
  }
  const canonicalJson = `${JSON.stringify(definition, null, 2)}\n`;
  let copied = false;
  let wroteDefinition = false;
  try {
    await copyFile(sourceFilename, assetDestination, constants.COPYFILE_EXCL);
    copied = true;
    await writeFile(jsonDestination, canonicalJson, { encoding: 'utf8', flag: 'wx' });
    wroteDefinition = true;
    const installed = JSON.parse(await readFile(jsonDestination, 'utf8'));
    new NpcWeaponRegistry({ definitions: [installed] });
    return { definition, loadout: createNpcLoadoutForWeapon(definition), jsonDestination, assetDestination };
  } catch (error) {
    if (copied) await rm(assetDestination, { force: true }).catch(() => {});
    if (wroteDefinition) await rm(jsonDestination, { force: true }).catch(() => {});
    if (error.code === 'EEXIST') throw new WeaponImportError('ALREADY_EXISTS', `Weapon "${weaponId}" already exists. Rename the source file to create a distinct stable weapon ID.`, { cause: error });
    if (error instanceof WeaponImportError) throw error;
    throw new WeaponImportError('INSTALL_FAILED', `Weapon import rolled back: ${error.message}`, { cause: error });
  }
}
