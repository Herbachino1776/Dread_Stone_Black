export const LOOT_PROFILE_SCHEMA = 'dreadstone.loot_profile.v1';
export const LOOT_PROFILE_VERSION = 1;

export const LOOT_GOLD_MODES = Object.freeze({
  fixed: 'FIXED',
  range: 'RANGE',
});

const STABLE_ID = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;
const TOP_LEVEL_FIELDS = Object.freeze(['schema', 'version', 'lootProfileId', 'displayName', 'currency']);
const CURRENCY_FIELDS = Object.freeze(['gold']);
const FIXED_GOLD_FIELDS = Object.freeze(['mode', 'amount']);
const RANGE_GOLD_FIELDS = Object.freeze(['mode', 'min', 'max']);

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStableId(value) {
  return isNonemptyString(value) && STABLE_ID.test(value);
}

function isGoldAmount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function requireCondition(errors, condition, path, message) {
  if (!condition) errors.push(`${path} ${message}`);
}

function requireExactFields(errors, value, allowedFields, path) {
  if (!isRecord(value)) return;
  const allowed = new Set(allowedFields);
  Object.keys(value).forEach((field) => {
    if (!allowed.has(field)) errors.push(`${path}.${field} is not part of ${LOOT_PROFILE_SCHEMA}`);
  });
}

export function validateLootProfile(profile) {
  const errors = [];
  requireCondition(errors, isRecord(profile), 'profile', 'must be an object');
  if (!isRecord(profile)) return { valid: false, errors };

  requireExactFields(errors, profile, TOP_LEVEL_FIELDS, 'profile');
  requireCondition(errors, profile.schema === LOOT_PROFILE_SCHEMA, 'profile.schema', `must be ${LOOT_PROFILE_SCHEMA}`);
  requireCondition(errors, profile.version === LOOT_PROFILE_VERSION, 'profile.version', `must be ${LOOT_PROFILE_VERSION}`);
  requireCondition(errors, isStableId(profile.lootProfileId), 'profile.lootProfileId', 'must be a stable lowercase identifier');
  requireCondition(errors, isNonemptyString(profile.displayName), 'profile.displayName', 'must be a non-empty string');

  requireCondition(errors, isRecord(profile.currency), 'profile.currency', 'must be an object');
  if (!isRecord(profile.currency)) return { valid: errors.length === 0, errors };
  requireExactFields(errors, profile.currency, CURRENCY_FIELDS, 'profile.currency');

  const gold = profile.currency.gold;
  requireCondition(errors, isRecord(gold), 'profile.currency.gold', 'must be an object');
  if (!isRecord(gold)) return { valid: errors.length === 0, errors };

  if (gold.mode === LOOT_GOLD_MODES.fixed) {
    requireExactFields(errors, gold, FIXED_GOLD_FIELDS, 'profile.currency.gold');
    requireCondition(errors, isGoldAmount(gold.amount), 'profile.currency.gold.amount', 'must be a non-negative safe integer');
  } else if (gold.mode === LOOT_GOLD_MODES.range) {
    requireExactFields(errors, gold, RANGE_GOLD_FIELDS, 'profile.currency.gold');
    requireCondition(errors, isGoldAmount(gold.min), 'profile.currency.gold.min', 'must be a non-negative safe integer');
    requireCondition(errors, isGoldAmount(gold.max), 'profile.currency.gold.max', 'must be a non-negative safe integer');
    if (isGoldAmount(gold.min) && isGoldAmount(gold.max)) {
      requireCondition(errors, gold.min <= gold.max, 'profile.currency.gold', 'must have min less than or equal to max');
    }
  } else {
    errors.push(`profile.currency.gold.mode must be ${LOOT_GOLD_MODES.fixed} or ${LOOT_GOLD_MODES.range}`);
    requireExactFields(errors, gold, ['mode'], 'profile.currency.gold');
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidLootProfile(profile) {
  const validation = validateLootProfile(profile);
  if (!validation.valid) throw new Error(`Invalid ${LOOT_PROFILE_SCHEMA}: ${validation.errors.join('; ')}`);
  return profile;
}
