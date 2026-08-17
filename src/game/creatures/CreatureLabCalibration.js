import * as THREE from 'three';
import {
  assertValidEnemyPreset,
  ENEMY_PRESET_V2_SCHEMA,
  ENEMY_PRESET_V2_VERSION,
} from '../../contracts/EnemyPreset.js';
import {
  composeCreaturePresentationHeight,
  HUMANOID_PRESENTATION_HEIGHT_RANGE,
} from './CreaturePresentationResolution.js';

export const CREATURE_LAB_WEAPON_CALIBRATION_LEGACY_NAMESPACE = 'dreadstone.creature_lab.weapon_calibration.v1';
export const CREATURE_LAB_WEAPON_CALIBRATION_NAMESPACE = 'dreadstone.creature_lab.weapon_calibration.v2';
export const CREATURE_LAB_WEAPON_SCALE_RANGE = Object.freeze({ min: 0.05, max: 8, step: 0.01 });
export const CREATURE_LAB_HEIGHT_RANGE = HUMANOID_PRESENTATION_HEIGHT_RANGE;

function round(value, places = 8) {
  return Number(Number(value).toFixed(places));
}

function vector(value, fallback) {
  return Array.isArray(value) && value.length === fallback.length && value.every(Number.isFinite)
    ? value.map(Number)
    : [...fallback];
}

function stableId(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/.test(value);
}

function normalizeContext(context) {
  const kind = context?.kind;
  const id = context?.id;
  if (!['preset', 'definition'].includes(kind) || !stableId(id)) {
    throw new Error('Creature Lab calibration context must identify one preset or Creature Definition');
  }
  return { kind, id };
}

function canonicalQuaternion(values) {
  const quaternion = new THREE.Quaternion().fromArray(values).normalize();
  const entries = quaternion.toArray();
  const firstMeaningful = [...entries].reverse().find((entry) => Math.abs(entry) > 1e-12) ?? 1;
  return (firstMeaningful < 0 ? entries.map((entry) => -entry) : entries).map((entry) => round(entry));
}

export function weaponDefinitionToLabCalibration(definition) {
  const quaternion = new THREE.Quaternion().fromArray(definition.gripTransform.quaternion).normalize();
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
  return {
    weaponId: definition.weaponId,
    assetScale: definition.assetScale,
    gripPosition: [...definition.gripTransform.position],
    gripEulerDegrees: [euler.x, euler.y, euler.z].map((angle) => round(THREE.MathUtils.radToDeg(angle))),
    attackCapsule: {
      start: [...definition.attackCapsule.start],
      end: [...definition.attackCapsule.end],
      radius: definition.attackCapsule.radius,
    },
  };
}

export function normalizeLabWeaponCalibration(definition, value) {
  const baseline = weaponDefinitionToLabCalibration(definition);
  const assetScale = Number(value?.assetScale);
  const radius = Number(value?.attackCapsule?.radius);
  return {
    weaponId: definition.weaponId,
    assetScale: Number.isFinite(assetScale) && assetScale > 0 ? assetScale : baseline.assetScale,
    gripPosition: vector(value?.gripPosition, baseline.gripPosition),
    gripEulerDegrees: vector(value?.gripEulerDegrees, baseline.gripEulerDegrees),
    attackCapsule: {
      start: vector(value?.attackCapsule?.start, baseline.attackCapsule.start),
      end: vector(value?.attackCapsule?.end, baseline.attackCapsule.end),
      radius: Number.isFinite(radius) && radius > 0 ? radius : baseline.attackCapsule.radius,
    },
  };
}

export function labCalibrationToWeaponDefinitionPatch(definition, calibration) {
  const normalized = normalizeLabWeaponCalibration(definition, calibration);
  const radians = normalized.gripEulerDegrees.map(THREE.MathUtils.degToRad);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...radians, 'XYZ')).normalize();
  return {
    weaponId: definition.weaponId,
    assetScale: round(normalized.assetScale),
    gripTransform: {
      position: normalized.gripPosition.map((entry) => round(entry)),
      quaternion: canonicalQuaternion(quaternion.toArray()),
    },
    attackCapsule: {
      start: normalized.attackCapsule.start.map((entry) => round(entry)),
      end: normalized.attackCapsule.end.map((entry) => round(entry)),
      radius: round(normalized.attackCapsule.radius),
    },
  };
}

export function createEnemyPresetRecordFromLabCalibration({
  preset,
  presetId = preset?.presetId,
  displayName = preset?.displayName,
  creatureDefinitionId = preset?.creatureDefinitionId,
  loadoutId = preset?.armament?.loadoutId,
  lootProfileId = preset?.rewards?.lootProfileId ?? null,
  targetHeight,
  weaponDefinition,
  calibration,
} = {}) {
  const patch = labCalibrationToWeaponDefinitionPatch(weaponDefinition, calibration);
  const record = {
    schema: preset?.schema ?? ENEMY_PRESET_V2_SCHEMA,
    version: preset?.version ?? ENEMY_PRESET_V2_VERSION,
    presetId,
    displayName,
    creatureDefinitionId,
    presentation: {
      targetHeight: round(Number(targetHeight)),
    },
    armament: {
      loadoutId,
      weaponOverride: {
        assetScale: patch.assetScale,
        gripTransform: patch.gripTransform,
        attackCapsule: patch.attackCapsule,
      },
    },
    ...(lootProfileId ? {
      rewards: {
        lootProfileId,
      },
    } : {}),
  };
  assertValidEnemyPreset(record);
  return record;
}

export function serializeEnemyPresetFromLabCalibration(options) {
  return JSON.stringify(createEnemyPresetRecordFromLabCalibration(options), null, 2);
}

export function setLabCalibrationField(calibration, field, value) {
  const next = structuredClone(calibration);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return next;
  if (field === 'assetScale') next.assetScale = numeric;
  else if (/^gripPosition\.[0-2]$/.test(field)) next.gripPosition[Number(field.at(-1))] = numeric;
  else if (/^gripEulerDegrees\.[0-2]$/.test(field)) next.gripEulerDegrees[Number(field.at(-1))] = numeric;
  else if (/^attackCapsule\.(start|end)\.[0-2]$/.test(field)) {
    const [, endpoint, index] = field.match(/^attackCapsule\.(start|end)\.([0-2])$/);
    next.attackCapsule[endpoint][Number(index)] = numeric;
  } else if (field === 'attackCapsule.radius') next.attackCapsule.radius = numeric;
  return next;
}

export class CreatureLabCalibrationStore {
  constructor({ storage = globalThis.localStorage, namespace = CREATURE_LAB_WEAPON_CALIBRATION_NAMESPACE } = {}) {
    this.storage = storage;
    this.namespace = namespace;
  }

  key(context, weaponId) {
    const normalized = normalizeContext(context);
    if (!stableId(weaponId)) throw new Error('Creature Lab calibration weaponId must be stable');
    return `${this.namespace}.${normalized.kind}.${normalized.id}.${weaponId}`;
  }

  loadDraft({ context, weaponDefinition, targetHeight }) {
    const baselineHeight = Number(targetHeight);
    if (!(Number.isFinite(baselineHeight) && baselineHeight >= CREATURE_LAB_HEIGHT_RANGE.min && baselineHeight <= CREATURE_LAB_HEIGHT_RANGE.max)) {
      throw new Error(`Creature Lab target height must be ${CREATURE_LAB_HEIGHT_RANGE.min}-${CREATURE_LAB_HEIGHT_RANGE.max} meters`);
    }
    try {
      const raw = this.storage?.getItem?.(this.key(context, weaponDefinition.weaponId));
      const value = raw ? JSON.parse(raw) : null;
      const storedHeight = Number(value?.targetHeight);
      return {
        targetHeight: Number.isFinite(storedHeight)
          && storedHeight >= CREATURE_LAB_HEIGHT_RANGE.min
          && storedHeight <= CREATURE_LAB_HEIGHT_RANGE.max
          ? storedHeight
          : baselineHeight,
        weaponCalibration: normalizeLabWeaponCalibration(weaponDefinition, value?.weaponCalibration),
      };
    } catch {
      return {
        targetHeight: baselineHeight,
        weaponCalibration: weaponDefinitionToLabCalibration(weaponDefinition),
      };
    }
  }

  saveDraft({ context, weaponDefinition, targetHeight, weaponCalibration }) {
    const normalizedHeight = Number(targetHeight);
    if (!(Number.isFinite(normalizedHeight) && normalizedHeight >= CREATURE_LAB_HEIGHT_RANGE.min && normalizedHeight <= CREATURE_LAB_HEIGHT_RANGE.max)) {
      throw new Error(`Creature Lab target height must be ${CREATURE_LAB_HEIGHT_RANGE.min}-${CREATURE_LAB_HEIGHT_RANGE.max} meters`);
    }
    const normalized = {
      targetHeight: normalizedHeight,
      weaponCalibration: normalizeLabWeaponCalibration(weaponDefinition, weaponCalibration),
    };
    try { this.storage?.setItem?.(this.key(context, weaponDefinition.weaponId), JSON.stringify(normalized)); } catch { /* Lab convenience persistence is optional. */ }
    return normalized;
  }

  resetDraft({ context, weaponDefinition, targetHeight }) {
    try { this.storage?.removeItem?.(this.key(context, weaponDefinition.weaponId)); } catch { /* Lab convenience persistence is optional. */ }
    return {
      targetHeight,
      weaponCalibration: weaponDefinitionToLabCalibration(weaponDefinition),
    };
  }

  hasDraft(context, weaponId) {
    try { return this.storage?.getItem?.(this.key(context, weaponId)) != null; } catch { return false; }
  }

  // Compatibility wrappers for external M6 tooling. New production callers must
  // supply the real definition/preset context through the draft methods above.
  load(definition, context = { kind: 'definition', id: 'definition_only' }) {
    return this.loadDraft({ context, weaponDefinition: definition, targetHeight: 1 }).weaponCalibration;
  }

  save(definition, calibration, context = { kind: 'definition', id: 'definition_only' }) {
    return this.saveDraft({ context, weaponDefinition: definition, targetHeight: 1, weaponCalibration: calibration }).weaponCalibration;
  }

  reset(definition, context = { kind: 'definition', id: 'definition_only' }) {
    return this.resetDraft({ context, weaponDefinition: definition, targetHeight: 1 }).weaponCalibration;
  }
}

export function createCreatureLabHeightResolution(resolved, targetHeight = null) {
  if (targetHeight == null) return resolved;
  return composeCreaturePresentationHeight(resolved, targetHeight, { source: 'Creature Lab' });
}
