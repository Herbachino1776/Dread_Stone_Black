export const ENCOUNTER_DEFINITION_SCHEMA = 'dreadstone.encounter_definition.v1';
export const ENCOUNTER_DEFINITION_VERSION = 1;

const STABLE_ID = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;
const TOP_LEVEL_FIELDS = Object.freeze(['schema', 'version', 'encounterId', 'displayName', 'locationId', 'spawns']);
const SPAWN_FIELDS = Object.freeze(['spawnId', 'presetId', 'transform', 'homeRadius', 'rewardOverride']);
const TRANSFORM_FIELDS = Object.freeze(['position', 'yaw']);
const REWARD_OVERRIDE_FIELDS = Object.freeze(['gold']);

function isPlainRecord(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonemptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStableId(value) {
  return isNonemptyString(value) && STABLE_ID.test(value);
}

function isFinitePosition(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function requireCondition(errors, condition, path, message) {
  if (!condition) errors.push(`${path} ${message}`);
}

function requireExactFields(errors, value, allowedFields, path) {
  if (!isPlainRecord(value)) return;
  const allowed = new Set(allowedFields);
  Object.keys(value).forEach((field) => {
    if (!allowed.has(field)) errors.push(`${path}.${field} is not part of ${ENCOUNTER_DEFINITION_SCHEMA}`);
  });
}

function validateSpawn(spawn, index, errors) {
  const path = `encounter.spawns[${index}]`;
  requireCondition(errors, isPlainRecord(spawn), path, 'must be a plain JSON object');
  if (!isPlainRecord(spawn)) return;
  requireExactFields(errors, spawn, SPAWN_FIELDS, path);
  requireCondition(errors, isStableId(spawn.spawnId), `${path}.spawnId`, 'must be a stable lowercase authored identifier');
  requireCondition(errors, isStableId(spawn.presetId), `${path}.presetId`, 'must reference a stable Enemy Preset ID');
  requireCondition(errors, Number.isFinite(spawn.homeRadius) && spawn.homeRadius > 0, `${path}.homeRadius`, 'must be finite and positive');

  requireCondition(errors, isPlainRecord(spawn.transform), `${path}.transform`, 'must be a plain JSON object');
  if (isPlainRecord(spawn.transform)) {
    requireExactFields(errors, spawn.transform, TRANSFORM_FIELDS, `${path}.transform`);
    requireCondition(errors, isFinitePosition(spawn.transform.position), `${path}.transform.position`, 'must be one finite world-space [x,y,z] vector');
    requireCondition(errors, Number.isFinite(spawn.transform.yaw), `${path}.transform.yaw`, 'must be one finite world-space yaw');
  }

  if (Object.hasOwn(spawn, 'rewardOverride')) {
    requireCondition(errors, isPlainRecord(spawn.rewardOverride), `${path}.rewardOverride`, 'must be a plain JSON object');
    if (isPlainRecord(spawn.rewardOverride)) {
      requireExactFields(errors, spawn.rewardOverride, REWARD_OVERRIDE_FIELDS, `${path}.rewardOverride`);
      requireCondition(
        errors,
        Number.isSafeInteger(spawn.rewardOverride.gold) && spawn.rewardOverride.gold > 0,
        `${path}.rewardOverride.gold`,
        'must be a positive safe integer fixed amount',
      );
    }
  }
}

export function validateEncounterDefinition(encounter) {
  const errors = [];
  requireCondition(errors, isPlainRecord(encounter), 'encounter', 'must be a plain JSON object');
  if (!isPlainRecord(encounter)) return { valid: false, errors };

  requireExactFields(errors, encounter, TOP_LEVEL_FIELDS, 'encounter');
  requireCondition(errors, encounter.schema === ENCOUNTER_DEFINITION_SCHEMA, 'encounter.schema', `must be ${ENCOUNTER_DEFINITION_SCHEMA}`);
  requireCondition(errors, encounter.version === ENCOUNTER_DEFINITION_VERSION, 'encounter.version', `must be ${ENCOUNTER_DEFINITION_VERSION}`);
  requireCondition(errors, isStableId(encounter.encounterId), 'encounter.encounterId', 'must be a stable lowercase identifier');
  requireCondition(errors, isNonemptyString(encounter.displayName), 'encounter.displayName', 'must be a non-empty string');
  requireCondition(errors, isStableId(encounter.locationId), 'encounter.locationId', 'must use the game location-ID convention');
  requireCondition(errors, Array.isArray(encounter.spawns), 'encounter.spawns', 'must be an array');

  const spawnIds = new Set();
  if (Array.isArray(encounter.spawns)) {
    encounter.spawns.forEach((spawn, index) => {
      validateSpawn(spawn, index, errors);
      if (!isStableId(spawn?.spawnId)) return;
      if (spawnIds.has(spawn.spawnId)) errors.push(`encounter.spawns[${index}].spawnId duplicates authored spawnId "${spawn.spawnId}" within the encounter`);
      spawnIds.add(spawn.spawnId);
    });
  }
  return { valid: errors.length === 0, errors };
}

export function assertValidEncounterDefinition(encounter) {
  const validation = validateEncounterDefinition(encounter);
  if (!validation.valid) throw new Error(`Invalid ${ENCOUNTER_DEFINITION_SCHEMA}: ${validation.errors.join('; ')}`);
  return encounter;
}

function canonicalNumber(value) {
  const rounded = Number(value.toFixed(8));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function canonicalizeEncounterDefinition(encounter) {
  assertValidEncounterDefinition(encounter);
  return {
    schema: ENCOUNTER_DEFINITION_SCHEMA,
    version: ENCOUNTER_DEFINITION_VERSION,
    encounterId: encounter.encounterId,
    displayName: encounter.displayName,
    locationId: encounter.locationId,
    spawns: encounter.spawns.map((spawn) => ({
      spawnId: spawn.spawnId,
      presetId: spawn.presetId,
      transform: {
        position: spawn.transform.position.map(canonicalNumber),
        yaw: canonicalNumber(spawn.transform.yaw),
      },
      homeRadius: canonicalNumber(spawn.homeRadius),
      ...(spawn.rewardOverride ? { rewardOverride: { gold: spawn.rewardOverride.gold } } : {}),
    })),
  };
}

export function serializeEncounterDefinition(encounter, { space = 2, trailingNewline = true } = {}) {
  const serialized = JSON.stringify(canonicalizeEncounterDefinition(encounter), null, space);
  return trailingNewline ? `${serialized}\n` : serialized;
}

export function parseEncounterDefinition(serialized) {
  if (typeof serialized !== 'string') throw new Error('Encounter JSON must be a string.');
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`Encounter JSON could not be parsed: ${error.message}`, { cause: error });
  }
  return canonicalizeEncounterDefinition(parsed);
}
