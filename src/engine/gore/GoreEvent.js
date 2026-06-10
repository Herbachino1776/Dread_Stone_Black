import * as THREE from 'three';

export const GORE_EVENT_TYPES = Object.freeze({
  HIT: 'hit',
  HEAVY_HIT: 'heavy_hit',
  KILL: 'kill',
  CORPSE_DECAY: 'corpse_decay',
  DRAG: 'drag',
});

let goreEventSerial = 0;

function cloneVector(value, fallback = new THREE.Vector3()) {
  if (value instanceof THREE.Vector3) return value.clone();
  if (Array.isArray(value)) return new THREE.Vector3(value[0] ?? fallback.x, value[1] ?? fallback.y, value[2] ?? fallback.z);
  if (value && typeof value === 'object') {
    return new THREE.Vector3(value.x ?? fallback.x, value.y ?? fallback.y, value.z ?? fallback.z);
  }
  return fallback.clone();
}

function normalizeDirection(value) {
  const direction = cloneVector(value, new THREE.Vector3(0, 0, 1));
  if (direction.lengthSq() < 0.0001) direction.set(0, 0, 1);
  return direction.normalize();
}

export function createGoreEvent({
  id = null,
  type = GORE_EVENT_TYPES.HIT,
  position = null,
  normal = null,
  direction = null,
  sourceId = null,
  targetId = null,
  creatureId = null,
  weaponId = null,
  damageAmount = 0,
  hitStrength = 1,
  surfaceType = 'body',
  roomId = null,
  timestamp = null,
  tags = [],
  targetRoot = null,
  sourceRoot = null,
  factionId = null,
  species = null,
} = {}) {
  const eventDirection = normalizeDirection(direction ?? normal);
  const eventNormal = normalizeDirection(normal ?? direction);

  return Object.freeze({
    id: id ?? `gore-event-${goreEventSerial += 1}`,
    type,
    position: cloneVector(position),
    normal: eventNormal,
    direction: eventDirection,
    sourceId,
    targetId,
    creatureId,
    weaponId,
    damageAmount,
    hitStrength,
    surfaceType,
    roomId,
    timestamp: timestamp ?? performance.now(),
    tags: Object.freeze([...tags]),
    targetRoot,
    sourceRoot,
    factionId,
    species,
  });
}

