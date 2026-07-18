import * as THREE from 'three';

export const ACTOR_SEPARATION_CONFIG = Object.freeze({
  livingClearance: 0.02,
  separationReleaseClearance: 0.06,
  maximumDepenetrationPerFrame: 0.08,
  contactEpsilon: 1e-6,
  solverIterations: 4,
});

const finiteHorizontal = (value) => Boolean(value && Number.isFinite(value.x) && Number.isFinite(value.z));

function stableHash(value = '') {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deterministicHorizontalNormal(key = 'combat-actor', target = new THREE.Vector3()) {
  const angle = (stableHash(key) / 0xffffffff) * Math.PI * 2;
  target.set(Math.cos(angle), 0, Math.sin(angle));
  if (!finiteHorizontal(target) || target.lengthSq() < ACTOR_SEPARATION_CONFIG.contactEpsilon) target.set(1, 0, 0);
  return target.normalize();
}

export function isAuthoritativeActorBlocker(blocker) {
  return Boolean(blocker
    && blocker.type === 'combatActor'
    && blocker.blocksPlayerLocomotion !== false
    && blocker.userData?.locomotionBlocker !== false
    && blocker.userData?.combatVolume !== true);
}

export function sortActorBlockers(blockers = []) {
  return blockers
    .filter(isAuthoritativeActorBlocker)
    .slice()
    .sort((first, second) => String(first.id ?? '').localeCompare(String(second.id ?? '')));
}

function closestBlockerPoint(position, blocker, target) {
  if (blocker.blockerShape === 'circle' && finiteHorizontal(blocker.center)) {
    return target.set(blocker.center.x, 0, blocker.center.z);
  }
  if (finiteHorizontal(blocker.from) && finiteHorizontal(blocker.to)) {
    const segmentX = blocker.to.x - blocker.from.x;
    const segmentZ = blocker.to.z - blocker.from.z;
    const lengthSq = segmentX * segmentX + segmentZ * segmentZ;
    const t = lengthSq > ACTOR_SEPARATION_CONFIG.contactEpsilon
      ? THREE.MathUtils.clamp(((position.x - blocker.from.x) * segmentX + (position.z - blocker.from.z) * segmentZ) / lengthSq, 0, 1)
      : 0;
    return target.set(blocker.from.x + segmentX * t, 0, blocker.from.z + segmentZ * t);
  }
  if (finiteHorizontal(blocker.center)) return target.set(blocker.center.x, 0, blocker.center.z);
  if (finiteHorizontal(blocker.from)) return target.set(blocker.from.x, 0, blocker.from.z);
  return null;
}

export function resolveHorizontalActorContact(position, blocker, playerRadius = 0.35) {
  if (!finiteHorizontal(position) || !isAuthoritativeActorBlocker(blocker)) return null;
  const closestPoint = closestBlockerPoint(position, blocker, new THREE.Vector3());
  if (!closestPoint) return null;
  const delta = new THREE.Vector3(position.x - closestPoint.x, 0, position.z - closestPoint.z);
  const distance = delta.length();
  const normal = distance > ACTOR_SEPARATION_CONFIG.contactEpsilon
    ? delta.multiplyScalar(1 / distance)
    : deterministicHorizontalNormal(blocker.id, delta);
  if (!finiteHorizontal(normal) || normal.lengthSq() < ACTOR_SEPARATION_CONFIG.contactEpsilon) return null;
  const radius = Math.max(0, Number(blocker.radius) || 0);
  const clearance = Math.max(0, Number(blocker.collisionClearance) || 0);
  const minimumCenterDistance = Math.max(0, Number(playerRadius) || 0) + radius + clearance;
  const center = finiteHorizontal(blocker.center)
    ? blocker.center
    : finiteHorizontal(blocker.from) && finiteHorizontal(blocker.to)
      ? { x: (blocker.from.x + blocker.to.x) * 0.5, z: (blocker.from.z + blocker.to.z) * 0.5 }
      : closestPoint;
  return {
    blocker,
    blockerId: blocker.id ?? null,
    normal,
    closestPoint,
    distance,
    centerDistance: Math.hypot(position.x - center.x, position.z - center.z),
    minimumCenterDistance,
    overlapDepth: Math.max(0, minimumCenterDistance - distance),
  };
}

export function constrainPlayerMovementAgainstActors({ position, movement, blockers = [], playerRadius = 0.35 } = {}) {
  const requested = finiteHorizontal(movement) ? new THREE.Vector3(movement.x, 0, movement.z) : new THREE.Vector3();
  const accepted = requested.clone();
  const orderedBlockers = sortActorBlockers(blockers);
  const constrainedActorIds = new Set();
  let invalidNormalCount = 0;
  let primaryNormal = null;

  for (let iteration = 0; iteration < ACTOR_SEPARATION_CONFIG.solverIterations; iteration += 1) {
    let changed = false;
    for (const blocker of orderedBlockers) {
      const contact = resolveHorizontalActorContact(position, blocker, playerRadius);
      if (!contact) {
        invalidNormalCount += 1;
        continue;
      }
      const availableInwardDistance = Math.max(0, contact.distance - contact.minimumCenterDistance);
      const radialMovement = accepted.dot(contact.normal);
      if (radialMovement >= -availableInwardDistance - ACTOR_SEPARATION_CONFIG.contactEpsilon) continue;
      accepted.addScaledVector(contact.normal, -availableInwardDistance - radialMovement);
      constrainedActorIds.add(String(contact.blockerId ?? 'combat-actor'));
      primaryNormal ??= contact.normal.clone();
      changed = true;
    }
    if (!changed) break;
  }

  const blockedInwardComponent = requested.clone().sub(accepted);
  const tangentialSlideComponent = primaryNormal
    ? accepted.clone().addScaledVector(primaryNormal, -accepted.dot(primaryNormal))
    : new THREE.Vector3();
  return {
    requested,
    accepted,
    blockedInwardComponent,
    tangentialSlideComponent,
    constrainedActorIds: [...constrainedActorIds],
    invalidNormalCount,
  };
}

export function buildPlayerDepenetrationCorrection({ position, blockers = [], playerRadius = 0.35, maximumCorrection = ACTOR_SEPARATION_CONFIG.maximumDepenetrationPerFrame } = {}) {
  const contacts = sortActorBlockers(blockers)
    .map((blocker) => resolveHorizontalActorContact(position, blocker, playerRadius))
    .filter((contact) => contact && contact.overlapDepth > ACTOR_SEPARATION_CONFIG.contactEpsilon)
    .sort((first, second) => second.overlapDepth - first.overlapDepth || String(first.blockerId ?? '').localeCompare(String(second.blockerId ?? '')));
  const correction = new THREE.Vector3();
  contacts.forEach((contact) => correction.addScaledVector(contact.normal, contact.overlapDepth));
  if (contacts.length && correction.lengthSq() <= ACTOR_SEPARATION_CONFIG.contactEpsilon) {
    correction.copy(contacts[0].normal).multiplyScalar(contacts[0].overlapDepth);
  }
  const cap = Math.max(0, Number(maximumCorrection) || 0);
  if (correction.length() > cap) correction.setLength(cap);
  return { correction, contacts };
}

export function resolveEnemyCloseRangeMotion({
  enemyPosition,
  playerPosition,
  desiredMovement,
  minimumCenterDistance,
  separationActive = false,
  separationReleaseClearance = ACTOR_SEPARATION_CONFIG.separationReleaseClearance,
  maximumCorrection = ACTOR_SEPARATION_CONFIG.maximumDepenetrationPerFrame,
  holdEnterDistance = minimumCenterDistance,
  fallbackKey = 'combat-actor',
} = {}) {
  const enemy = finiteHorizontal(enemyPosition) ? enemyPosition : { x: 0, z: 0 };
  const player = finiteHorizontal(playerPosition) ? playerPosition : { x: 0, z: 0 };
  const outwardNormal = new THREE.Vector3(enemy.x - player.x, 0, enemy.z - player.z);
  const distance = outwardNormal.length();
  if (distance > ACTOR_SEPARATION_CONFIG.contactEpsilon) outwardNormal.multiplyScalar(1 / distance);
  else deterministicHorizontalNormal(fallbackKey, outwardNormal);
  const minimum = Math.max(0, Number(minimumCenterDistance) || 0);
  const releaseDistance = minimum + Math.max(0, Number(separationReleaseClearance) || 0);
  const nextSeparationActive = separationActive ? distance < releaseDistance : distance < minimum;
  const movement = finiteHorizontal(desiredMovement) ? new THREE.Vector3(desiredMovement.x, 0, desiredMovement.z) : new THREE.Vector3();
  const availableInwardDistance = Math.max(0, distance - minimum);
  const radialMovement = movement.dot(outwardNormal);
  const blockedInwardAmount = radialMovement < -availableInwardDistance
    ? -availableInwardDistance - radialMovement
    : 0;
  if (blockedInwardAmount > 0) movement.addScaledVector(outwardNormal, blockedInwardAmount);
  const overlapDepth = Math.max(0, minimum - distance);
  const correctionMagnitude = Math.min(overlapDepth, Math.max(0, Number(maximumCorrection) || 0));
  if (correctionMagnitude > 0) movement.addScaledVector(outwardNormal, correctionMagnitude);
  return {
    movement,
    outwardNormal,
    distance,
    minimumCenterDistance: minimum,
    overlapDepth,
    blockedInwardAmount,
    separationActive: nextSeparationActive,
    mode: nextSeparationActive ? 'separate' : distance <= Math.max(minimum, Number(holdEnterDistance) || 0) ? 'hold' : 'approach',
  };
}
