import * as THREE from 'three';

const projectedPoint = new THREE.Vector3();
const worldPoint = new THREE.Vector3();

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

  findSweepContact(start, end, profile) {
    const candidates = [];
    for (const target of this.getTargets()) {
      if (!this.isInWorldRange(target)) continue;
      const screen = this.projectTarget(target);
      if (!screen) continue;
      const radius = target.contactRadiusPx ?? profile?.contactRadiusPx ?? 58;
      const distance = distanceToSegment(screen, start, end);
      if (distance <= radius) candidates.push({ target, screen, distance, radius });
    }
    return candidates.sort((a, b) => a.distance - b.distance)[0] ?? null;
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
        kind: actionType === 'pry' ? 'planted-pry-contact' : 'swept-screen-contact',
        screen: { x: contact.screen.x, y: contact.screen.y },
        world: resolveVector(typeof target.target === 'function' ? target.target() : target.target).clone(),
      },
    };
    const result = target.receivePhysicalToolEvent?.(event) ?? { accepted: false, reason: 'no-receiver' };
    return { accepted: result?.accepted !== false && result?.changed !== false, ...result, event };
  }
}
