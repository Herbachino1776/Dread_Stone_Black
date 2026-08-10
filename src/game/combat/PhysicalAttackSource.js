import * as THREE from 'three';

export const PHYSICAL_ATTACK_PHASES = Object.freeze({
  windup: 'WINDUP',
  active: 'ACTIVE',
  recovery: 'RECOVERY',
  complete: 'COMPLETE',
});

const PHASE_ORDER = Object.freeze([
  PHYSICAL_ATTACK_PHASES.windup,
  PHYSICAL_ATTACK_PHASES.active,
  PHYSICAL_ATTACK_PHASES.recovery,
  PHYSICAL_ATTACK_PHASES.complete,
]);

const DEFAULT_PHASE_DURATIONS = Object.freeze({
  [PHYSICAL_ATTACK_PHASES.windup]: 0.52,
  [PHYSICAL_ATTACK_PHASES.active]: 0.32,
  [PHYSICAL_ATTACK_PHASES.recovery]: 0.58,
});

const EPSILON = 1e-8;

function isFiniteVector3(value) {
  return Boolean(value?.isVector3 && value.toArray().every(Number.isFinite));
}

function cloneCapsule(capsule) {
  if (!isFiniteVector3(capsule?.start) || !isFiniteVector3(capsule?.end)) return null;
  const radius = Number(capsule.radius);
  if (!Number.isFinite(radius) || radius <= 0) return null;
  return { start: capsule.start.clone(), end: capsule.end.clone(), radius };
}

function closestPointsOnSegments(firstStart, firstEnd, secondStart, secondEnd) {
  const firstDirection = firstEnd.clone().sub(firstStart);
  const secondDirection = secondEnd.clone().sub(secondStart);
  const offset = firstStart.clone().sub(secondStart);
  const firstLengthSq = firstDirection.lengthSq();
  const secondLengthSq = secondDirection.lengthSq();
  const secondOffset = secondDirection.dot(offset);
  let firstT = 0;
  let secondT = 0;

  if (firstLengthSq <= EPSILON && secondLengthSq <= EPSILON) {
    return { firstPoint: firstStart.clone(), secondPoint: secondStart.clone() };
  }
  if (firstLengthSq <= EPSILON) {
    secondT = THREE.MathUtils.clamp(secondOffset / secondLengthSq, 0, 1);
  } else {
    const firstOffset = firstDirection.dot(offset);
    if (secondLengthSq <= EPSILON) {
      firstT = THREE.MathUtils.clamp(-firstOffset / firstLengthSq, 0, 1);
    } else {
      const directionsDot = firstDirection.dot(secondDirection);
      const denominator = firstLengthSq * secondLengthSq - directionsDot * directionsDot;
      firstT = denominator !== 0
        ? THREE.MathUtils.clamp((directionsDot * secondOffset - firstOffset * secondLengthSq) / denominator, 0, 1)
        : 0;
      secondT = (directionsDot * firstT + secondOffset) / secondLengthSq;
      if (secondT < 0) {
        secondT = 0;
        firstT = THREE.MathUtils.clamp(-firstOffset / firstLengthSq, 0, 1);
      } else if (secondT > 1) {
        secondT = 1;
        firstT = THREE.MathUtils.clamp((directionsDot - firstOffset) / firstLengthSq, 0, 1);
      }
    }
  }

  return {
    firstPoint: firstStart.clone().addScaledVector(firstDirection, firstT),
    secondPoint: secondStart.clone().addScaledVector(secondDirection, secondT),
  };
}

function capsuleCrossSection(previous, current, alpha) {
  return {
    start: previous.start.clone().lerp(current.start, alpha),
    end: previous.end.clone().lerp(current.end, alpha),
  };
}

export function intersectSweptCapsules(previousShape, currentShape, targetCapsule) {
  const previous = cloneCapsule(previousShape);
  const current = cloneCapsule(currentShape);
  const target = cloneCapsule(targetCapsule);
  if (!previous || !current || !target) return { intersects: false, reason: 'invalid-capsule-data' };

  const previousMidpoint = previous.start.clone().lerp(previous.end, 0.5);
  const currentMidpoint = current.start.clone().lerp(current.end, 0.5);
  const sweepSegments = [
    [previous.start, previous.end, 'previous-shape'],
    [current.start, current.end, 'current-shape'],
    [previous.start, current.start, 'start-sweep'],
    [previous.end, current.end, 'end-sweep'],
    [previousMidpoint, currentMidpoint, 'midpoint-sweep'],
    ...[0.25, 0.5, 0.75].map((alpha) => {
      const section = capsuleCrossSection(previous, current, alpha);
      return [section.start, section.end, `cross-section-${alpha}`];
    }),
  ];
  let closest = null;
  for (const [start, end, primitive] of sweepSegments) {
    const points = closestPointsOnSegments(start, end, target.start, target.end);
    const distanceSq = points.firstPoint.distanceToSquared(points.secondPoint);
    if (!closest || distanceSq < closest.distanceSq) closest = { ...points, distanceSq, primitive };
  }

  const combinedRadius = Math.max(previous.radius, current.radius) + target.radius;
  return {
    intersects: closest.distanceSq <= combinedRadius * combinedRadius,
    distance: Math.sqrt(Math.max(0, closest.distanceSq)),
    combinedRadius,
    sourcePoint: closest.firstPoint,
    targetPoint: closest.secondPoint,
    primitive: closest.primitive,
    reason: closest.distanceSq <= combinedRadius * combinedRadius ? null : 'physical-miss',
  };
}

export class PhysicalAttackLifecycle {
  constructor({ sourceId = 'physical-attack', phaseDurations = DEFAULT_PHASE_DURATIONS } = {}) {
    this.sourceId = sourceId;
    this.phaseDurations = { ...DEFAULT_PHASE_DURATIONS, ...phaseDurations };
    this.serial = 0;
    this.reset();
  }

  trigger({ attackIdentity = null, commitment = null } = {}) {
    if (this.phase !== PHYSICAL_ATTACK_PHASES.complete) return { accepted: false, reason: 'attack-already-running', attackIdentity: this.attackIdentity };
    this.serial += 1;
    this.attackIdentity = attackIdentity ?? `${this.sourceId}:${this.serial}`;
    this.commitment = commitment;
    this.phase = PHYSICAL_ATTACK_PHASES.windup;
    this.phaseElapsed = 0;
    this.elapsed = 0;
    return { accepted: true, attackIdentity: this.attackIdentity, phase: this.phase };
  }

  update(deltaSeconds) {
    let remaining = Math.max(0, Number(deltaSeconds) || 0);
    const transitions = [];
    while (remaining > 0 && this.phase !== PHYSICAL_ATTACK_PHASES.complete) {
      const duration = Math.max(EPSILON, Number(this.phaseDurations[this.phase]) || EPSILON);
      const available = Math.max(0, duration - this.phaseElapsed);
      const step = Math.min(remaining, available);
      this.phaseElapsed += step;
      this.elapsed += step;
      remaining -= step;
      if (this.phaseElapsed + EPSILON < duration) break;
      const previousPhase = this.phase;
      this.phase = PHASE_ORDER[PHASE_ORDER.indexOf(this.phase) + 1] ?? PHYSICAL_ATTACK_PHASES.complete;
      this.phaseElapsed = 0;
      transitions.push({ previousPhase, phase: this.phase, attackIdentity: this.attackIdentity });
    }
    return { ...this.getState(), transitions };
  }

  getState() {
    const duration = Number(this.phaseDurations[this.phase]);
    return {
      attackIdentity: this.attackIdentity,
      phase: this.phase,
      active: this.phase === PHYSICAL_ATTACK_PHASES.active,
      phaseElapsed: this.phaseElapsed,
      phaseProgress: this.phase === PHYSICAL_ATTACK_PHASES.complete ? 1 : THREE.MathUtils.clamp(this.phaseElapsed / Math.max(EPSILON, duration), 0, 1),
      elapsed: this.elapsed,
      commitment: this.commitment,
    };
  }

  reset({ resetIdentity = false } = {}) {
    this.phase = PHYSICAL_ATTACK_PHASES.complete;
    this.phaseElapsed = 0;
    this.elapsed = 0;
    this.attackIdentity = null;
    this.commitment = null;
    if (resetIdentity) this.serial = 0;
  }
}

export class PhysicalAttackSource {
  constructor({ source = null, damageAmount = 34, damageType = 'blunt', impactStrength = 0.72 } = {}) {
    this.source = source;
    this.damageAmount = damageAmount;
    this.damageType = damageType;
    this.impactStrength = impactStrength;
    this.disposed = false;
    this.reset();
  }

  beginAttack(attackIdentity) {
    if (this.disposed) return { accepted: false, reason: 'attack-source-disposed' };
    if (attackIdentity == null || attackIdentity === '') return { accepted: false, reason: 'missing-attack-identity' };
    this.attackIdentity = String(attackIdentity);
    this.phase = PHYSICAL_ATTACK_PHASES.windup;
    this.hitTargets.clear();
    this.previousShape = null;
    this.currentShape = null;
    this.lastContact = null;
    this.lastRejectionReason = null;
    return { accepted: true, attackIdentity: this.attackIdentity };
  }

  setPhase(phase) {
    if (!PHASE_ORDER.includes(phase)) return { accepted: false, reason: 'invalid-attack-phase' };
    this.phase = phase;
    return { accepted: true, phase, active: phase === PHYSICAL_ATTACK_PHASES.active };
  }

  updateShape(shape) {
    const next = cloneCapsule(shape);
    if (!next || this.disposed) return { accepted: false, reason: this.disposed ? 'attack-source-disposed' : 'invalid-attack-shape' };
    this.previousShape = this.currentShape ? cloneCapsule(this.currentShape) : cloneCapsule(next);
    this.currentShape = next;
    return { accepted: true };
  }

  tryHit({ targetId = 'player', hurtVolume, receiver, impactDirection = null } = {}) {
    if (this.disposed) return this.reject('attack-source-disposed');
    if (this.phase !== PHYSICAL_ATTACK_PHASES.active) return this.reject(`phase-${String(this.phase).toLowerCase()}`);
    if (!this.attackIdentity) return this.reject('missing-attack-identity');
    if (this.hitTargets.has(targetId)) return this.reject('target-already-hit-this-attack');
    if (!this.previousShape || !this.currentShape) return this.reject('attack-shape-unavailable');

    const contact = intersectSweptCapsules(this.previousShape, this.currentShape, hurtVolume);
    if (!contact.intersects) return this.reject(contact.reason ?? 'physical-miss', contact);
    const direction = isFiniteVector3(impactDirection)
      ? impactDirection.clone().normalize()
      : this.currentShape.end.clone().sub(this.previousShape.end).normalize();
    if (!isFiniteVector3(direction) || direction.lengthSq() <= EPSILON) direction.set(0, 0, -1);
    const result = receiver?.receiveCombatImpact?.({
      source: this.source,
      damageAmount: this.damageAmount,
      damageType: this.damageType,
      impactPoint: contact.targetPoint,
      impactDirection: direction,
      impactStrength: this.impactStrength,
      attackIdentity: this.attackIdentity,
    }) ?? { accepted: false, reason: 'player-damage-receiver-unavailable' };
    if (result.accepted !== true) return this.reject(result.reason ?? 'player-impact-rejected', contact);

    this.hitTargets.add(targetId);
    this.acceptedHitCount += 1;
    this.lastContact = {
      targetId,
      attackIdentity: this.attackIdentity,
      impactPoint: contact.targetPoint.clone(),
      impactDirection: direction.clone(),
      primitive: contact.primitive,
      distance: contact.distance,
    };
    this.lastRejectionReason = null;
    return { ...result, accepted: true, contact: this.lastContact };
  }

  reject(reason, contact = null) {
    this.lastRejectionReason = reason;
    return { accepted: false, reason, contact };
  }

  getDiagnostics() {
    return {
      phase: this.phase,
      active: this.phase === PHYSICAL_ATTACK_PHASES.active,
      attackIdentity: this.attackIdentity,
      acceptedHitCount: this.acceptedHitCount,
      hitTargets: [...this.hitTargets],
      lastRejectionReason: this.lastRejectionReason,
      lastContact: this.lastContact ? {
        ...this.lastContact,
        impactPoint: this.lastContact.impactPoint.toArray(),
        impactDirection: this.lastContact.impactDirection.toArray(),
      } : null,
      hasPreviousShape: Boolean(this.previousShape),
      hasCurrentShape: Boolean(this.currentShape),
      disposed: this.disposed,
    };
  }

  reset() {
    this.phase = PHYSICAL_ATTACK_PHASES.complete;
    this.attackIdentity = null;
    this.hitTargets = new Set();
    this.previousShape = null;
    this.currentShape = null;
    this.acceptedHitCount = 0;
    this.lastContact = null;
    this.lastRejectionReason = null;
  }

  dispose() {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
  }
}
