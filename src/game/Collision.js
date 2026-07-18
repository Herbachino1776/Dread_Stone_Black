import * as THREE from 'three';
import {
  ACTOR_SEPARATION_CONFIG,
  buildPlayerDepenetrationCorrection,
  constrainPlayerMovementAgainstActors,
  isAuthoritativeActorBlocker,
  resolveHorizontalActorContact,
  sortActorBlockers,
} from './ActorSeparation.js';

const MAX_COLLISION_STEP_DISTANCE = 0.12;
const TERRAIN_GROUND_PRIORITY = 0;
const FALLBACK_GROUND_PRIORITY = -1000;

function pointInRect(point, rect) {
  return point.x >= rect.minX && point.x <= rect.maxX && point.z >= rect.minZ && point.z <= rect.maxZ;
}

function circleIntersectsRect(point, radius, rect) {
  const closestX = THREE.MathUtils.clamp(point.x, rect.minX, rect.maxX);
  const closestZ = THREE.MathUtils.clamp(point.z, rect.minZ, rect.maxZ);
  const dx = point.x - closestX;
  const dz = point.z - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

function circleIntersectsSegment(point, radius, rect) {
  const from = rect.from; const to = rect.to;
  if (!from || !to) return circleIntersectsRect(point, radius, rect);
  const dx = to.x - from.x; const dz = to.z - from.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 0.0001) return circleIntersectsRect(point, radius, rect);
  const t = THREE.MathUtils.clamp(((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSq, 0, 1);
  const closestX = from.x + dx * t;
  const closestZ = from.z + dz * t;
  const px = point.x - closestX;
  const pz = point.z - closestZ;
  const combinedRadius = radius + (rect.thickness ?? 0) / 2;
  return px * px + pz * pz < combinedRadius * combinedRadius;
}

function circleIntersectsCircle(point, radius, blocker) {
  const center = blocker.center;
  if (!center) return false;
  const dx = point.x - center.x;
  const dz = point.z - center.z;
  const combinedRadius = radius + (blocker.radius ?? 0);
  return dx * dx + dz * dz < combinedRadius * combinedRadius;
}

function circleIntersectsCapsule(point, radius, blocker) {
  if (blocker.from && blocker.to) {
    const dx = blocker.to.x - blocker.from.x;
    const dz = blocker.to.z - blocker.from.z;
    if (dx * dx + dz * dz <= 0.0001) return circleIntersectsCircle(point, radius, { center: blocker.from, radius: blocker.radius });
  }
  return circleIntersectsSegment(point, radius, { ...blocker, thickness: (blocker.radius ?? 0) * 2 });
}

function circleIntersectsPolyline(point, radius, blocker) {
  const points = Array.isArray(blocker.points) ? blocker.points : [];
  for (let index = 0; index < points.length - 1; index += 1) {
    if (circleIntersectsSegment(point, radius, { from: points[index], to: points[index + 1], thickness: blocker.thickness ?? 0 })) return true;
  }
  return false;
}

function circleIntersectsBlocker(point, radius, rect) {
  if (rect.blockerShape === 'segment') return circleIntersectsSegment(point, radius, rect);
  if (rect.blockerShape === 'circle') return circleIntersectsCircle(point, radius, rect);
  if (rect.blockerShape === 'capsule') return circleIntersectsCapsule(point, radius, rect);
  if (rect.blockerShape === 'polyline') return circleIntersectsPolyline(point, radius, rect);
  return circleIntersectsRect(point, radius, rect);
}

function pointInPolygon(point, footprint) {
  let inside = false;
  for (let i = 0, j = footprint.length - 1; i < footprint.length; j = i, i += 1) {
    const xi = footprint[i][0]; const zi = footprint[i][1];
    const xj = footprint[j][0]; const zj = footprint[j][1];
    const intersects = ((zi > point.z) !== (zj > point.z))
      && (point.x < ((xj - xi) * (point.z - zi)) / ((zj - zi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function sampleSegmentSurface(point, surface) {
  const [x0, z0] = surface.from;
  const [x1, z1] = surface.to;
  const dx = x1 - x0; const dz = z1 - z0;
  const length = Math.hypot(dx, dz);
  if (length <= 0.0001) return null;
  const ux = dx / length; const uz = dz / length;
  const px = point.x - x0; const pz = point.z - z0;
  const along = px * ux + pz * uz;
  const across = Math.abs(px * -uz + pz * ux);
  if (along < 0 || along > length || across > (surface.width ?? 1) / 2) return null;
  const t = THREE.MathUtils.clamp(along / length, 0, 1);
  if (surface.kind === 'bridgeDeck') return { y: surface.y ?? 0, t };
  const steppedT = surface.kind === 'stairRamp' && surface.steps > 0
    ? Math.floor(t * surface.steps) / surface.steps
    : t;
  return { y: THREE.MathUtils.lerp(surface.y0 ?? 0, surface.y1 ?? 0, steppedT), t: steppedT };
}

export class CollisionWorld {
  constructor({ walkableRects, blockerRects = [], playerRadius = 0.35, walkableSurfaces = [], defaultFloorY = 0, outdoorTerrainSampler = null, sourceLocationId = null }) {
    this.walkableRects = walkableRects;
    this.walkableSurfaces = walkableSurfaces;
    this.blockerRects = blockerRects;
    this.playerRadius = playerRadius;
    this.defaultFloorY = defaultFloorY;
    this.outdoorTerrainSampler = outdoorTerrainSampler;
    this.sourceLocationId = sourceLocationId;
    this.eyeHeight = 1.55;
    this.maxStepUp = 0.38;
    this.lastMovementDiagnostics = this.createMovementDiagnostics();
  }

  createMovementDiagnostics() {
    return {
      playerRadius: this.playerRadius,
      nearestEnemyId: null,
      nearestEnemyCenterDistance: null,
      requiredMinimumCenterDistance: null,
      overlapDepth: 0,
      depenetrationActive: false,
      correctionVector: [0, 0, 0],
      enemyCorrectionVector: [0, 0, 0],
      movementRequested: [0, 0, 0],
      movementAccepted: [0, 0, 0],
      blockedInwardComponent: [0, 0, 0],
      tangentialSlideComponent: [0, 0, 0],
      nearbyBlockingActorCount: 0,
      constrainedActorIds: [],
      lastMovementBlockReason: null,
    };
  }

  getMovementDiagnostics() {
    return {
      ...this.lastMovementDiagnostics,
      correctionVector: [...this.lastMovementDiagnostics.correctionVector],
      enemyCorrectionVector: [...this.lastMovementDiagnostics.enemyCorrectionVector],
      movementRequested: [...this.lastMovementDiagnostics.movementRequested],
      movementAccepted: [...this.lastMovementDiagnostics.movementAccepted],
      blockedInwardComponent: [...this.lastMovementDiagnostics.blockedInwardComponent],
      tangentialSlideComponent: [...this.lastMovementDiagnostics.tangentialSlideComponent],
      constrainedActorIds: [...this.lastMovementDiagnostics.constrainedActorIds],
    };
  }

  removeBlocker(blockerRect) {
    this.blockerRects = this.blockerRects.filter((rect) => rect !== blockerRect);
  }

  addBlocker(blockerRect) {
    if (blockerRect && !this.blockerRects.includes(blockerRect)) this.blockerRects = [...this.blockerRects, blockerRect];
    return blockerRect;
  }

  sampleWalkableY(x, z, fallbackY = this.defaultFloorY) {
    const point = { x, z };
    const outdoorY = this.outdoorTerrainSampler?.sampleOutdoorY?.(x, z);
    const hasOutdoorTerrain = Number.isFinite(outdoorY);
    const resolvedFallbackY = hasOutdoorTerrain ? outdoorY : fallbackY;
    let best = {
      y: resolvedFallbackY,
      priority: hasOutdoorTerrain ? TERRAIN_GROUND_PRIORITY : FALLBACK_GROUND_PRIORITY,
      kind: hasOutdoorTerrain ? 'oarbTerrain' : 'fallback',
      surface: this.outdoorTerrainSampler ?? null,
    };
    this.walkableSurfaces.forEach((surface) => {
      let sample = null;
      if ((surface.kind === 'flatPolygon' || surface.kind === 'platformTop') && pointInPolygon(point, surface.footprint ?? [])) {
        sample = { y: surface.y ?? fallbackY, t: 0 };
      } else if (['ramp', 'stairRamp', 'bridgeDeck'].includes(surface.kind)) {
        sample = sampleSegmentSurface(point, surface);
      }
      if (!sample) return;
      const priority = surface.priority ?? 0;
      if (priority > best.priority || (priority === best.priority && sample.y > best.y)) {
        best = { y: sample.y, priority, kind: surface.kind, surface, t: sample.t };
      }
    });
    return best;
  }

  getIntersectingBlockers(position, radius = this.playerRadius) {
    if (!position) return [];
    const testPoint = { x: position.x, z: position.z };
    return this.blockerRects.filter((rect) => circleIntersectsBlocker(testPoint, radius, rect));
  }

  canStandAt(position, { ignoreActorBlockers = false } = {}) {
    const testPoint = { x: position.x, z: position.z };
    const inWalkableSpace = this.walkableRects.some((rect) => pointInRect(testPoint, rect));

    if (!inWalkableSpace) return false;

    const targetSurface = this.sampleWalkableY(position.x, position.z, this.defaultFloorY);
    const currentFloorY = Number.isFinite(position.y) ? position.y - this.eyeHeight : this.defaultFloorY;
    const heightDelta = targetSurface.y - currentFloorY;
    if (heightDelta > this.maxStepUp && !['ramp', 'stairRamp'].includes(targetSurface.kind)) return false;

    return !this.getIntersectingBlockers(position).some((rect) => {
      if (ignoreActorBlockers && rect.type === 'combatActor') return false;
      if (rect.type === 'canal' && targetSurface.kind === 'bridgeDeck') return false;
      return true;
    });
  }

  canStandAtFloorPosition(position) {
    if (!position) return false;
    return this.canStandAt(new THREE.Vector3(position.x, position.y + this.eyeHeight, position.z));
  }

  moveWithCollision(position, movement) {
    const distance = movement.length();
    const steps = Math.max(1, Math.ceil(distance / MAX_COLLISION_STEP_DISTANCE));
    const stepMovement = movement.clone().multiplyScalar(1 / steps);
    const actorBlockers = sortActorBlockers(this.blockerRects);
    const movementStart = position.clone();
    let next = position.clone();
    const blockedInwardComponent = new THREE.Vector3();
    const tangentialSlideComponent = new THREE.Vector3();
    const constrainedActorIds = new Set();
    let invalidNormalCount = 0;
    let worldBlocked = false;

    for (let i = 0; i < steps; i += 1) {
      next = this.moveSingleStepWithCollision(next, stepMovement, {
        actorBlockers,
        blockedInwardComponent,
        tangentialSlideComponent,
        constrainedActorIds,
        recordInvalidNormals: (count) => { invalidNormalCount += count; },
        recordWorldBlock: () => { worldBlocked = true; },
      });
    }
    const movementAccepted = next.clone().sub(movementStart);
    const recovery = this.recoverPlayerActorOverlaps(next, actorBlockers);
    next.copy(recovery.position);
    const initialContacts = actorBlockers
      .map((blocker) => resolveHorizontalActorContact(movementStart, blocker, this.playerRadius))
      .filter(Boolean)
      .sort((first, second) => first.centerDistance - second.centerDistance || String(first.blockerId ?? '').localeCompare(String(second.blockerId ?? '')));
    const nearest = initialContacts[0] ?? null;
    const nearbyBlockingActorCount = initialContacts.filter((contact) => contact.distance <= contact.minimumCenterDistance + 0.5).length;
    const constrainedCount = constrainedActorIds.size;
    const lastMovementBlockReason = invalidNormalCount > 0
      ? 'invalid_collision_normal'
      : recovery.active
        ? 'enemy_overlap_recovery'
        : constrainedCount > 1
          ? 'multiple_enemy_constraint'
          : constrainedCount === 1
            ? 'enemy_inward_component'
            : worldBlocked
              ? 'world_geometry'
              : null;
    this.lastMovementDiagnostics = {
      playerRadius: this.playerRadius,
      nearestEnemyId: nearest?.blockerId ?? null,
      nearestEnemyCenterDistance: nearest?.centerDistance ?? null,
      requiredMinimumCenterDistance: nearest?.minimumCenterDistance ?? null,
      overlapDepth: recovery.initialMaximumOverlap,
      depenetrationActive: recovery.active,
      correctionVector: recovery.playerCorrection.toArray(),
      enemyCorrectionVector: recovery.enemyCorrection.toArray(),
      movementRequested: movement.toArray(),
      movementAccepted: movementAccepted.toArray(),
      blockedInwardComponent: blockedInwardComponent.toArray(),
      tangentialSlideComponent: tangentialSlideComponent.toArray(),
      nearbyBlockingActorCount,
      constrainedActorIds: [...constrainedActorIds],
      lastMovementBlockReason,
    };
    return next;
  }

  moveSingleStepAgainstWorld(position, movement) {
    const next = position.clone();
    const xStep = next.clone();
    xStep.x += movement.x;

    if (this.canStandAt(xStep, { ignoreActorBlockers: true })) {
      next.x = xStep.x;
    }

    const zStep = next.clone();
    zStep.z += movement.z;

    if (this.canStandAt(zStep, { ignoreActorBlockers: true })) {
      next.z = zStep.z;
    }

    return next;
  }

  moveSingleStepWithCollision(position, movement, diagnostics = null) {
    const actorBlockers = diagnostics?.actorBlockers ?? sortActorBlockers(this.blockerRects);
    const firstConstraint = constrainPlayerMovementAgainstActors({ position, movement, blockers: actorBlockers, playerRadius: this.playerRadius });
    const worldPosition = this.moveSingleStepAgainstWorld(position, firstConstraint.accepted);
    const worldMovement = worldPosition.clone().sub(position);
    const secondConstraint = constrainPlayerMovementAgainstActors({ position, movement: worldMovement, blockers: actorBlockers, playerRadius: this.playerRadius });
    const next = this.moveSingleStepAgainstWorld(position, secondConstraint.accepted);
    if (diagnostics) {
      diagnostics.blockedInwardComponent.add(firstConstraint.blockedInwardComponent).add(secondConstraint.blockedInwardComponent);
      diagnostics.tangentialSlideComponent.copy(secondConstraint.tangentialSlideComponent.lengthSq() > 0 ? secondConstraint.tangentialSlideComponent : firstConstraint.tangentialSlideComponent);
      [...firstConstraint.constrainedActorIds, ...secondConstraint.constrainedActorIds].forEach((id) => diagnostics.constrainedActorIds.add(id));
      diagnostics.recordInvalidNormals(firstConstraint.invalidNormalCount + secondConstraint.invalidNormalCount);
      if (worldMovement.distanceTo(firstConstraint.accepted) > ACTOR_SEPARATION_CONFIG.contactEpsilon
        || next.clone().sub(position).distanceTo(secondConstraint.accepted) > ACTOR_SEPARATION_CONFIG.contactEpsilon) diagnostics.recordWorldBlock();
    }
    return next;
  }

  recoverPlayerActorOverlaps(position, actorBlockers = sortActorBlockers(this.blockerRects)) {
    const next = position.clone();
    const playerCorrection = new THREE.Vector3();
    const enemyCorrection = new THREE.Vector3();
    const ownerCorrectionById = new Map();
    const initial = buildPlayerDepenetrationCorrection({ position: next, blockers: actorBlockers, playerRadius: this.playerRadius });
    const initialMaximumOverlap = initial.contacts.reduce((maximum, contact) => Math.max(maximum, contact.overlapDepth), 0);
    if (!initial.contacts.length) return { position: next, playerCorrection, enemyCorrection, active: false, initialMaximumOverlap: 0 };

    for (let iteration = 0; iteration < ACTOR_SEPARATION_CONFIG.solverIterations; iteration += 1) {
      let recovery = buildPlayerDepenetrationCorrection({ position: next, blockers: actorBlockers, playerRadius: this.playerRadius });
      if (!recovery.contacts.length) break;

      for (const contact of recovery.contacts) {
        const moveOwner = contact.blocker.userData?.tryPlayerDepenetration;
        if (typeof moveOwner !== 'function') continue;
        const ownerId = String(contact.blockerId ?? 'combat-actor');
        const ownerCorrectionUsed = ownerCorrectionById.get(ownerId) ?? 0;
        const ownerCorrectionRemaining = Math.max(0, ACTOR_SEPARATION_CONFIG.maximumDepenetrationPerFrame - ownerCorrectionUsed);
        const magnitude = Math.min(contact.overlapDepth, ownerCorrectionRemaining);
        if (magnitude <= ACTOR_SEPARATION_CONFIG.contactEpsilon) continue;
        const requested = contact.normal.clone().multiplyScalar(-magnitude);
        const moved = moveOwner({ x: requested.x, z: requested.z }, { playerPosition: next, blocker: contact.blocker });
        if (finiteHorizontalVector(moved)) {
          const acceptedOwnerCorrection = new THREE.Vector3(moved.x, 0, moved.z);
          enemyCorrection.add(acceptedOwnerCorrection);
          ownerCorrectionById.set(ownerId, ownerCorrectionUsed + acceptedOwnerCorrection.length());
        }
      }

      recovery = buildPlayerDepenetrationCorrection({
        position: next,
        blockers: actorBlockers,
        playerRadius: this.playerRadius,
        maximumCorrection: Math.max(0, ACTOR_SEPARATION_CONFIG.maximumDepenetrationPerFrame - playerCorrection.length()),
      });
      if (!recovery.contacts.length || recovery.correction.lengthSq() <= ACTOR_SEPARATION_CONFIG.contactEpsilon) break;
      const beforeOverlap = recovery.contacts.reduce((sum, contact) => sum + contact.overlapDepth, 0);
      let candidate = this.moveSingleStepAgainstWorld(next, recovery.correction);
      let candidateOverlap = totalActorOverlap(candidate, actorBlockers, this.playerRadius);
      if (candidate.distanceTo(next) <= ACTOR_SEPARATION_CONFIG.contactEpsilon || candidateOverlap >= beforeOverlap - ACTOR_SEPARATION_CONFIG.contactEpsilon) {
        candidate = next;
        candidateOverlap = beforeOverlap;
        for (const contact of recovery.contacts) {
          const remaining = Math.max(0, ACTOR_SEPARATION_CONFIG.maximumDepenetrationPerFrame - playerCorrection.length());
          if (remaining <= ACTOR_SEPARATION_CONFIG.contactEpsilon) break;
          const individualCorrection = contact.normal.clone().multiplyScalar(Math.min(contact.overlapDepth, remaining));
          const individualCandidate = this.moveSingleStepAgainstWorld(next, individualCorrection);
          const individualOverlap = totalActorOverlap(individualCandidate, actorBlockers, this.playerRadius);
          if (individualCandidate.distanceTo(next) > ACTOR_SEPARATION_CONFIG.contactEpsilon && individualOverlap < candidateOverlap - ACTOR_SEPARATION_CONFIG.contactEpsilon) {
            candidate = individualCandidate;
            candidateOverlap = individualOverlap;
          }
        }
      }
      if (candidate === next || candidate.distanceTo(next) <= ACTOR_SEPARATION_CONFIG.contactEpsilon) break;
      const acceptedCorrection = candidate.clone().sub(next);
      next.copy(candidate);
      playerCorrection.add(acceptedCorrection);
      if (playerCorrection.length() >= ACTOR_SEPARATION_CONFIG.maximumDepenetrationPerFrame - ACTOR_SEPARATION_CONFIG.contactEpsilon) break;
    }
    return { position: next, playerCorrection, enemyCorrection, active: true, initialMaximumOverlap };
  }
}

function finiteHorizontalVector(value) {
  return Boolean(value && Number.isFinite(value.x) && Number.isFinite(value.z));
}

function totalActorOverlap(position, actorBlockers, playerRadius) {
  return actorBlockers.reduce((sum, blocker) => sum + (resolveHorizontalActorContact(position, blocker, playerRadius)?.overlapDepth ?? 0), 0);
}
