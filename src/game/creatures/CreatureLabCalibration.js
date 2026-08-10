import * as THREE from 'three';

export const CREATURE_LAB_WEAPON_CALIBRATION_NAMESPACE = 'dreadstone.creature_lab.weapon_calibration.v1';
export const CREATURE_LAB_WEAPON_SCALE_RANGE = Object.freeze({ min: 0.05, max: 8, step: 0.01 });
export const CREATURE_LAB_HEIGHT_RANGE = Object.freeze({ min: 0.5, max: 3.5, step: 0.05 });

function round(value, places = 8) {
  return Number(Number(value).toFixed(places));
}

function vector(value, fallback) {
  return Array.isArray(value) && value.length === fallback.length && value.every(Number.isFinite)
    ? value.map(Number)
    : [...fallback];
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
      quaternion: quaternion.toArray().map((entry) => round(entry)),
    },
    attackCapsule: {
      start: normalized.attackCapsule.start.map((entry) => round(entry)),
      end: normalized.attackCapsule.end.map((entry) => round(entry)),
      radius: round(normalized.attackCapsule.radius),
    },
  };
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

  key(weaponId) {
    return `${this.namespace}.${weaponId}`;
  }

  load(definition) {
    try {
      const raw = this.storage?.getItem?.(this.key(definition.weaponId));
      return normalizeLabWeaponCalibration(definition, raw ? JSON.parse(raw) : null);
    } catch {
      return weaponDefinitionToLabCalibration(definition);
    }
  }

  save(definition, calibration) {
    const normalized = normalizeLabWeaponCalibration(definition, calibration);
    try { this.storage?.setItem?.(this.key(definition.weaponId), JSON.stringify(normalized)); } catch { /* Lab convenience persistence is optional. */ }
    return normalized;
  }

  reset(definition) {
    try { this.storage?.removeItem?.(this.key(definition.weaponId)); } catch { /* Lab convenience persistence is optional. */ }
    return weaponDefinitionToLabCalibration(definition);
  }
}

export function createCreatureLabHeightResolution(resolved, targetHeight = null) {
  if (targetHeight == null) return resolved;
  if (!(Number.isFinite(targetHeight) && targetHeight >= CREATURE_LAB_HEIGHT_RANGE.min && targetHeight <= CREATURE_LAB_HEIGHT_RANGE.max)) {
    throw new Error(`Creature Lab target height must be ${CREATURE_LAB_HEIGHT_RANGE.min}-${CREATURE_LAB_HEIGHT_RANGE.max} meters`);
  }
  const profile = Object.freeze({ ...resolved.profile, targetHeight });
  return Object.freeze({ definition: resolved.definition, pack: resolved.pack, profile });
}
