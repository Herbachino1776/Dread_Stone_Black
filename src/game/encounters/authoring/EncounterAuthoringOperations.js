import {
  canonicalizeEncounterDefinition,
  ENCOUNTER_DEFINITION_SCHEMA,
  ENCOUNTER_DEFINITION_VERSION,
  serializeEncounterDefinition,
} from '../../../contracts/EncounterDefinition.js';

export const DEFAULT_AUTHORED_HOME_RADIUS = 8;
const FULL_TURN = Math.PI * 2;

function clone(value) {
  return structuredClone(value);
}

function requireSpawn(draft, spawnId) {
  const index = draft.spawns.findIndex((spawn) => spawn.spawnId === spawnId);
  if (index < 0) throw new Error(`Encounter spawn "${spawnId}" does not exist.`);
  return { index, spawn: draft.spawns[index] };
}

function finitePosition(position) {
  if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) {
    throw new Error('Encounter authoring position must be one finite [x,y,z] vector.');
  }
  return [...position];
}

function positiveFinite(value, label) {
  if (!(Number.isFinite(value) && value > 0)) throw new Error(`${label} must be finite and positive.`);
  return value;
}

export function suggestEncounterId(displayName = '') {
  return String(displayName)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);
}

export function normalizeEncounterYaw(yaw) {
  if (!Number.isFinite(yaw)) throw new Error('Encounter authoring yaw must be finite.');
  const normalized = ((yaw % FULL_TURN) + FULL_TURN) % FULL_TURN;
  return Math.abs(normalized - FULL_TURN) < 1e-10 ? 0 : normalized;
}

export function createEncounterDraft({ displayName, encounterId, locationId } = {}) {
  return canonicalizeEncounterDefinition({
    schema: ENCOUNTER_DEFINITION_SCHEMA,
    version: ENCOUNTER_DEFINITION_VERSION,
    encounterId,
    displayName,
    locationId,
    spawns: [],
  });
}

function randomHex(byteCount = 6, cryptoImplementation = globalThis.crypto) {
  const bytes = new Uint8Array(byteCount);
  if (typeof cryptoImplementation?.getRandomValues === 'function') cryptoImplementation.getRandomValues(bytes);
  else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export function generateSpawnId(encounterId, {
  existingSpawnIds = [],
  globallyOwnedSpawnIds = [],
  suffixFactory = () => randomHex(),
  maximumAttempts = 32,
} = {}) {
  const prefix = `${encounterId}_enemy_`;
  const unavailable = new Set([...existingSpawnIds, ...globallyOwnedSpawnIds]);
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const suffix = String(suffixFactory()).toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 16);
    if (suffix.length < 6) continue;
    const spawnId = `${prefix}${suffix}`;
    if (!unavailable.has(spawnId)) return spawnId;
  }
  throw new Error(`Could not generate a unique stable spawnId for encounter "${encounterId}".`);
}

export function placeSpawn(draft, {
  presetId,
  position,
  yaw = 0,
  homeRadius = DEFAULT_AUTHORED_HOME_RADIUS,
  spawnId = null,
  spawnIdOptions = {},
} = {}) {
  const next = clone(draft);
  const created = {
    spawnId: spawnId ?? generateSpawnId(next.encounterId, {
      ...spawnIdOptions,
      existingSpawnIds: next.spawns.map((spawn) => spawn.spawnId),
    }),
    presetId,
    transform: { position: finitePosition(position), yaw: normalizeEncounterYaw(yaw) },
    homeRadius: positiveFinite(homeRadius, 'homeRadius'),
  };
  next.spawns.push(created);
  const canonical = canonicalizeEncounterDefinition(next);
  return { draft: canonical, spawn: canonical.spawns.at(-1) };
}

export function moveSpawn(draft, spawnId, { position, yaw } = {}) {
  const next = clone(draft);
  const { spawn } = requireSpawn(next, spawnId);
  spawn.transform = {
    position: finitePosition(position),
    yaw: normalizeEncounterYaw(yaw),
  };
  return canonicalizeEncounterDefinition(next);
}

export function rotateSpawn(draft, spawnId, yaw) {
  const next = clone(draft);
  const { spawn } = requireSpawn(next, spawnId);
  spawn.transform.yaw = normalizeEncounterYaw(yaw);
  return canonicalizeEncounterDefinition(next);
}

export function duplicateSpawn(draft, spawnId, {
  offsetDistance = 0.9,
  spawnId: duplicateSpawnId = null,
  spawnIdOptions = {},
} = {}) {
  const next = clone(draft);
  const { spawn: source } = requireSpawn(next, spawnId);
  const yaw = normalizeEncounterYaw(source.transform.yaw);
  const copy = clone(source);
  copy.spawnId = duplicateSpawnId ?? generateSpawnId(next.encounterId, {
    ...spawnIdOptions,
    existingSpawnIds: next.spawns.map((spawn) => spawn.spawnId),
  });
  copy.transform.position[0] += Math.cos(yaw) * offsetDistance;
  copy.transform.position[2] -= Math.sin(yaw) * offsetDistance;
  next.spawns.push(copy);
  const canonical = canonicalizeEncounterDefinition(next);
  return { draft: canonical, spawn: canonical.spawns.at(-1) };
}

export function changeSpawnPreset(draft, spawnId, presetId) {
  const next = clone(draft);
  requireSpawn(next, spawnId).spawn.presetId = presetId;
  return canonicalizeEncounterDefinition(next);
}

export function setSpawnHomeRadius(draft, spawnId, homeRadius) {
  const next = clone(draft);
  requireSpawn(next, spawnId).spawn.homeRadius = positiveFinite(homeRadius, 'homeRadius');
  return canonicalizeEncounterDefinition(next);
}

export function setSpawnGoldOverride(draft, spawnId, gold) {
  if (!(Number.isSafeInteger(gold) && gold > 0)) throw new Error('Gold override must be a positive safe integer.');
  const next = clone(draft);
  requireSpawn(next, spawnId).spawn.rewardOverride = { gold };
  return canonicalizeEncounterDefinition(next);
}

export function removeSpawnGoldOverride(draft, spawnId) {
  const next = clone(draft);
  delete requireSpawn(next, spawnId).spawn.rewardOverride;
  return canonicalizeEncounterDefinition(next);
}

export function deleteSpawn(draft, spawnId) {
  const next = clone(draft);
  const { index } = requireSpawn(next, spawnId);
  next.spawns.splice(index, 1);
  return canonicalizeEncounterDefinition(next);
}

export function cloneEncounterDraft(draft) {
  return canonicalizeEncounterDefinition(clone(draft));
}

export function encountersEqual(first, second) {
  if (!first || !second) return false;
  return serializeEncounterDefinition(first) === serializeEncounterDefinition(second);
}
