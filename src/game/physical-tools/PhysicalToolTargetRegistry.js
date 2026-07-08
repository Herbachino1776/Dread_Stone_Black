import * as THREE from 'three';

const projectedPoint = new THREE.Vector3();
const worldPoint = new THREE.Vector3();
const worldSweepStart = new THREE.Vector3();
const worldSweepEnd = new THREE.Vector3();
const worldRadiusEdge = new THREE.Vector3();

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.0001) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = THREE.MathUtils.clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

function resolveVector(value) {
  if (value?.isVector3) return value;
  if (Array.isArray(value)) return worldPoint.set(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
  return worldPoint.set(Number(value?.x) || 0, Number(value?.y) || 0, Number(value?.z) || 0);
}

function unprojectScreenPoint(point, depth, camera, rect, target) {
  return target.set(
    ((point.x - rect.left) / rect.width) * 2 - 1,
    -(((point.y - rect.top) / rect.height) * 2 - 1),
    depth,
  ).unproject(camera);
}

function distanceToWorldSegment(point, start, end) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentZ = end.z - start.z;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY + segmentZ * segmentZ;
  if (lengthSquared <= 0.0000001) return point.distanceTo(start);
  const t = THREE.MathUtils.clamp(
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY + (point.z - start.z) * segmentZ) / lengthSquared,
    0,
    1,
  );
  const contactX = start.x + segmentX * t;
  const contactY = start.y + segmentY * t;
  const contactZ = start.z + segmentZ * t;
  return Math.hypot(point.x - contactX, point.y - contactY, point.z - contactZ);
}

export class PhysicalToolTargetRegistry {
  constructor({ dungeon = null, camera = null, player = null, viewport = null } = {}) {
    this.rebind({ dungeon, camera, player, viewport });
  }

  rebind({ dungeon = this.dungeon, camera = this.camera, player = this.player, viewport = this.viewport } = {}) {
    this.dungeon = dungeon;
    this.camera = camera;
    this.player = player;
    this.viewport = viewport;
  }

  getTargets() {
    return (this.dungeon?.getPhysicalToolTargets?.() ?? [])
      .filter((target) => target && target.id && target.target && target.complete !== true && target.available !== false);
  }

  projectTarget(target) {
    if (!this.camera || !this.viewport) return null;
    const rect = this.viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    projectedPoint.copy(resolveVector(typeof target.target === 'function' ? target.target() : target.target)).project(this.camera);
    if (projectedPoint.z < -1 || projectedPoint.z > 1) return null;
    return {
      x: rect.left + (projectedPoint.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-projectedPoint.y * 0.5 + 0.5) * rect.height,
      depth: projectedPoint.z,
    };
  }

  isInWorldRange(target) {
    const point = resolveVector(typeof target.target === 'function' ? target.target() : target.target);
    if (!this.player?.position) return true;
    const dx = point.x - this.player.position.x;
    const dz = point.z - this.player.position.z;
    return Math.hypot(dx, dz) <= (target.range ?? 3.5);
  }

  findActivePartSweepContact(start, end, profile) {
    const candidates = [];
    const rect = this.viewport?.getBoundingClientRect?.();
    if (!rect?.width || !rect?.height || !this.camera) return null;
    for (const target of this.getTargets()) {
      if (!this.isInWorldRange(target)) continue;
      const screen = this.projectTarget(target);
      if (!screen) continue;
      const radius = target.contactRadiusPx ?? profile?.contactRadiusPx ?? 58;
      const distance = distanceToSegment(screen, start, end);
      const targetWorld = resolveVector(typeof target.target === 'function' ? target.target() : target.target).clone();
      unprojectScreenPoint(start, screen.depth, this.camera, rect, worldSweepStart);
      unprojectScreenPoint(end, screen.depth, this.camera, rect, worldSweepEnd);
      unprojectScreenPoint({ x: screen.x + radius, y: screen.y }, screen.depth, this.camera, rect, worldRadiusEdge);
      const worldRadius = targetWorld.distanceTo(worldRadiusEdge);
      const worldDistance = distanceToWorldSegment(targetWorld, worldSweepStart, worldSweepEnd);
      if (distance <= radius && worldDistance <= worldRadius * 1.001) candidates.push({
        target,
        screen,
        distance,
        radius,
        worldDistance,
        worldRadius,
        sweep: { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } },
        worldSweep: { start: worldSweepStart.clone(), end: worldSweepEnd.clone() },
        activePartKind: end.kind ?? (profile?.actionType === 'pry' ? 'pry-tip' : profile?.actionType === 'chop' ? 'axe-head' : 'knife-blade'),
      });
    }
    return candidates.sort((a, b) => a.distance - b.distance)[0] ?? null;
  }

  findSweepContact(start, end, profile) {
    return this.findActivePartSweepContact(start, end, profile);
  }

  evaluate(target, { toolId, actionType, gesture, contact } = {}) {
    if (!target || target.complete === true || target.available === false) return { accepted: false, reason: 'unavailable' };
    const prerequisitesMet = typeof target.prerequisitesMet === 'function' ? target.prerequisitesMet() : target.prerequisitesMet !== false;
    if (!prerequisitesMet) return { accepted: false, reason: 'prerequisite', feedback: target.failFeedback?.prerequisite };
    if (target.acceptedToolId !== toolId) return { accepted: false, reason: 'wrong-tool', feedback: target.failFeedback?.wrongTool };
    if (target.acceptedActionType !== actionType) return { accepted: false, reason: 'wrong-action', feedback: target.failFeedback?.wrongAction };
    if (!contact) return { accepted: false, reason: 'miss' };

    const requirements = target.requiredGesture ?? {};
    if ((gesture?.travelPx ?? 0) < (requirements.minTravelPx ?? 0)) return { accepted: false, reason: 'weak-gesture' };
    if ((gesture?.velocityPxPerSecond ?? 0) < (requirements.minVelocityPxPerSecond ?? 0)) return { accepted: false, reason: 'slow-gesture' };
    if ((gesture?.velocityPxPerSecond ?? 0) > (requirements.maxVelocityPxPerSecond ?? Infinity)) return { accepted: false, reason: 'fast-gesture' };
    if ((gesture?.smoothness ?? 0) < (requirements.minSmoothness ?? 0)) return { accepted: false, reason: 'erratic-gesture' };
    if (actionType === 'pry' && (gesture?.leverTravelPx ?? 0) < (requirements.minLeverTravelPx ?? requirements.minTravelPx ?? 0)) {
      return { accepted: false, reason: 'short-pry' };
    }

    const event = {
      type: 'physical-tool-contact',
      toolId,
      actionType,
      targetId: target.id,
      stage: target.stage,
      gesture: { ...gesture },
      contact: {
        kind: actionType === 'pry' ? 'planted-pry-tip-contact' : 'swept-active-part-contact',
        activePart: contact.activePartKind ?? (actionType === 'chop' ? 'axe-head' : actionType === 'pry' ? 'pry-tip' : 'knife-blade'),
        screen: { x: contact.screen.x, y: contact.screen.y },
        sweep: contact.sweep ? {
          start: { ...contact.sweep.start },
          end: { ...contact.sweep.end },
        } : null,
        worldSweep: contact.worldSweep ? {
          start: contact.worldSweep.start.clone(),
          end: contact.worldSweep.end.clone(),
          radius: contact.worldRadius,
        } : null,
        world: resolveVector(typeof target.target === 'function' ? target.target() : target.target).clone(),
      },
    };
    const result = target.receivePhysicalToolEvent?.(event) ?? { accepted: false, reason: 'no-receiver' };
    return { accepted: result?.accepted !== false && result?.changed !== false, ...result, event };
  }
}
