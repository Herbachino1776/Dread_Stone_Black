import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOG_PATH = path.resolve(moduleDirectory, '..', '..', 'config', 'production-creature-packs.json');
export const PRODUCTION_CREATURE_PACK_CATALOG_SCHEMA = 'dreadstone.production_creature_pack_sources.v1';

const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

function catalogError(message) {
  return new Error(`[Creature Pack Catalog] ${message}`);
}

function requireIdentity(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw catalogError(`${label} must contain lowercase ASCII letters, numbers, and single underscores only`);
  }
  return value;
}

function canonicalSourceDir(enemySlug) {
  return `public/assets/enemies/${enemySlug}/damage`;
}

export function sanitizeEnemySlug(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export function suggestDisplayName(value) {
  const baseName = path.basename(String(value ?? ''), path.extname(String(value ?? '')))
    .replace(/(?:[_-]damage)?[_-]v\d+$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim();
  return baseName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');
}

export function suggestCreatureNames({ glbName = '', sourceDir = '' } = {}) {
  const sourceBase = path.basename(path.resolve(sourceDir || '.'));
  const sourceCandidate = /^damage$/i.test(sourceBase) ? path.basename(path.dirname(path.resolve(sourceDir))) : sourceBase;
  const displayName = suggestDisplayName(glbName) || suggestDisplayName(sourceCandidate) || 'New Creature';
  return {
    displayName,
    enemySlug: sanitizeEnemySlug(displayName),
  };
}

export function generateCreaturePackId(enemySlug) {
  requireIdentity(enemySlug, 'enemySlug');
  return `${enemySlug}_damage_v001`;
}

export function validateProductionCreaturePackCatalog(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw catalogError('catalog must be an object');
  if (value.schema !== PRODUCTION_CREATURE_PACK_CATALOG_SCHEMA) {
    throw catalogError(`schema must be ${PRODUCTION_CREATURE_PACK_CATALOG_SCHEMA}`);
  }
  if (!Array.isArray(value.creatures)) throw catalogError('creatures must be an array');

  const packIds = new Set();
  const enemySlugs = new Set();
  const sourceDirs = new Set();
  const creatures = value.creatures.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw catalogError(`creatures[${index}] must be an object`);
    const packId = requireIdentity(entry.packId, `creatures[${index}].packId`);
    const enemySlug = requireIdentity(entry.enemySlug, `creatures[${index}].enemySlug`);
    if (typeof entry.displayName !== 'string' || !entry.displayName.trim()) throw catalogError(`creatures[${index}].displayName is required`);
    const sourceDir = String(entry.sourceDir ?? '').replace(/\\/g, '/');
    const expectedSourceDir = canonicalSourceDir(enemySlug);
    if (sourceDir !== expectedSourceDir) throw catalogError(`creatures[${index}].sourceDir must be ${expectedSourceDir}`);
    if (packIds.has(packId)) throw catalogError(`duplicate packId ${packId}`);
    if (enemySlugs.has(enemySlug)) throw catalogError(`duplicate enemySlug ${enemySlug}`);
    if (sourceDirs.has(sourceDir)) throw catalogError(`duplicate sourceDir ${sourceDir}`);
    packIds.add(packId);
    enemySlugs.add(enemySlug);
    sourceDirs.add(sourceDir);
    return { packId, displayName: entry.displayName.trim(), enemySlug, sourceDir };
  });
  return {
    schema: PRODUCTION_CREATURE_PACK_CATALOG_SCHEMA,
    creatures: creatures.sort((left, right) => left.packId.localeCompare(right.packId)),
  };
}

export function serializeProductionCreaturePackCatalog(value) {
  return `${JSON.stringify(validateProductionCreaturePackCatalog(value), null, 2)}\n`;
}

export async function loadProductionCreaturePackCatalog(catalogPath = DEFAULT_CATALOG_PATH) {
  let source;
  try {
    source = await readFile(catalogPath, 'utf8');
  } catch (error) {
    throw catalogError(`could not read ${catalogPath}: ${error.message}`);
  }
  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw catalogError(`${catalogPath} is not valid JSON: ${error.message}`);
  }
  return validateProductionCreaturePackCatalog(value);
}

export async function writeProductionCreaturePackCatalog(value, catalogPath = DEFAULT_CATALOG_PATH) {
  const source = serializeProductionCreaturePackCatalog(value);
  await mkdir(path.dirname(catalogPath), { recursive: true });
  const temporaryPath = `${catalogPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, source, 'utf8');
  await rename(temporaryPath, catalogPath);
  return validateProductionCreaturePackCatalog(value);
}

export function resolveCreatureRegistration(catalog, {
  displayName,
  enemySlug,
  packId = null,
} = {}) {
  const validated = validateProductionCreaturePackCatalog(catalog);
  const normalizedSlug = requireIdentity(enemySlug, 'enemySlug');
  const normalizedDisplayName = String(displayName ?? '').trim();
  if (!normalizedDisplayName) throw catalogError('displayName is required');
  const explicitPackId = packId == null || packId === '' ? null : requireIdentity(packId, 'packId');
  const existingBySlug = validated.creatures.find((entry) => entry.enemySlug === normalizedSlug) ?? null;
  const existingByPackId = explicitPackId
    ? validated.creatures.find((entry) => entry.packId === explicitPackId) ?? null
    : null;
  if (existingByPackId && existingByPackId.enemySlug !== normalizedSlug) {
    throw catalogError(`packId ${explicitPackId} belongs to enemySlug ${existingByPackId.enemySlug}`);
  }
  if (existingBySlug && explicitPackId && explicitPackId !== existingBySlug.packId) {
    throw catalogError(`enemySlug ${normalizedSlug} is already registered as ${existingBySlug.packId}`);
  }
  const existing = existingBySlug ?? existingByPackId;
  const resolvedPackId = existing?.packId ?? explicitPackId ?? generateCreaturePackId(normalizedSlug);
  const collision = validated.creatures.find((entry) => entry.packId === resolvedPackId && entry.enemySlug !== normalizedSlug);
  if (collision) throw catalogError(`packId ${resolvedPackId} already belongs to enemySlug ${collision.enemySlug}`);
  return {
    mode: existing ? 'UPDATE' : 'NEW',
    existing,
    entry: {
      packId: resolvedPackId,
      displayName: normalizedDisplayName,
      enemySlug: normalizedSlug,
      sourceDir: canonicalSourceDir(normalizedSlug),
    },
  };
}

export function upsertCreatureRegistration(catalog, entry) {
  const validated = validateProductionCreaturePackCatalog(catalog);
  const resolution = resolveCreatureRegistration(validated, entry);
  const creatures = validated.creatures.filter((candidate) => candidate.packId !== resolution.entry.packId);
  creatures.push(resolution.entry);
  return validateProductionCreaturePackCatalog({
    schema: PRODUCTION_CREATURE_PACK_CATALOG_SCHEMA,
    creatures,
  });
}
