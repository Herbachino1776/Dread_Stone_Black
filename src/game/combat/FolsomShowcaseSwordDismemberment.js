import * as THREE from 'three';
import { FOLSOM_SHOWCASE_COMBAT_CONFIG } from './FolsomShowcaseCombatExtras.js';

const VALID_EDGE_PRIMITIVES = new Set(['leftEdge', 'rightEdge']);
const MAX_DIAGNOSTIC_COUNT = 1_000_000;
const SEGMENT_BY_BODY_OR_REGION = Object.freeze({
  head: 'head_neck',
  face: 'head_neck',
  skull: 'head_neck',
  neck: 'head_neck',
  left_upper_arm: 'left_elbow',
  left_forearm: 'left_elbow',
  arm_left_top: 'left_elbow',
  arm_left_bot: 'left_elbow',
  right_upper_arm: 'right_elbow',
  right_forearm: 'right_elbow',
  arm_right_top: 'right_elbow',
  arm_right_bot: 'right_elbow',
});

const incrementBounded = (value) => Math.min(MAX_DIAGNOSTIC_COUNT, value + 1);
const finiteVector = (value) => Boolean(value?.isVector3 && value.toArray().every(Number.isFinite));
const actorIdOf = (actor) => actor?.instanceId ?? actor?.id ?? null;

function resolveCandidateSegment(hit = {}) {
  return SEGMENT_BY_BODY_OR_REGION[hit.bodyId] ?? SEGMENT_BY_BODY_OR_REGION[hit.regionId] ?? null;
}

function hasValidatedSegmentRuntime(actor, segmentId) {
  const runtime = actor?.visualAdapter?.damageSegmentRuntime;
  const validated = runtime?.validation?.diagnostics?.requiredObjectsResolved === true;
  return Boolean(validated
    && actor?.visualProfile?.activeDamageSegmentIds?.includes?.(segmentId)
    && runtime?.segmentStates?.has?.(segmentId));
}

export function isFolsomShowcaseDismembermentTargetEligible(actor) {
  return Boolean(actor
    && !actor.disposed
    && ['alive', 'dying'].includes(actor.lifeState)
    && actor.combatContactState !== 'grounded'
    && actor.combatContactState !== 'disposed');
}

function edgeCenter(primitive, previous, target) {
  return target.addVectors(
    previous ? primitive.previousStart : primitive.currentStart,
    previous ? primitive.previousEnd : primitive.currentEnd,
  ).multiplyScalar(0.5);
}

// Temporary qualification only: it observes owned sword edge sweeps and asks
// HumanoidDamageSegmentRuntime for an authored detachment. It does not revive
// slash wounds, inspect render triangles, or own structural damage itself.
// Remove this module when Dismemberment 2.0 supplies production qualification.
export class FolsomShowcaseSwordDismemberment {
  constructor({ enabled = true, config = FOLSOM_SHOWCASE_COMBAT_CONFIG } = {}) {
    this.config = config;
    this.enabled = Boolean(enabled && config.enabled && config.swordDismembermentEnabled);
    this.swingSerial = 0;
    this.activeSwingId = null;
    this.actorsResolvedThisSwing = new Set();
    this.acceptedThisSwing = 0;
    this.scratch = {
      previousCenter: new THREE.Vector3(),
      currentCenter: new THREE.Vector3(),
      frameMotion: new THREE.Vector3(),
      contactPoint: new THREE.Vector3(),
      seamPoint: new THREE.Vector3(),
      impulse: new THREE.Vector3(),
      angularImpulse: new THREE.Vector3(),
      outward: new THREE.Vector3(),
    };
    this.resetDiagnostics();
  }

  resetDiagnostics() {
    this.swingEdgeSpeed = 0;
    this.swingLateralRatio = 0;
    this.swingTravel = 0;
    this.lastContactActorId = null;
    this.lastContactBodyId = null;
    this.lastContactRegionId = null;
    this.lastCandidateSegmentId = null;
    this.lastSeamDistance = null;
    this.lastResult = 'idle';
    this.acceptedDetachmentCount = 0;
    this.rejectedSpeedCount = 0;
    this.rejectedIntentCount = 0;
    this.rejectedSeamDistanceCount = 0;
    this.rejectedRepeatCount = 0;
  }

  beginGesture({ pointerId = null } = {}) {
    if (!this.enabled || pointerId == null) return null;
    this.swingSerial += 1;
    this.activeSwingId = `folsom-showcase-sword-swing-${this.swingSerial}`;
    this.actorsResolvedThisSwing.clear();
    this.acceptedThisSwing = 0;
    this.swingEdgeSpeed = 0;
    this.swingLateralRatio = 0;
    this.swingTravel = 0;
    this.lastResult = 'gesture_started';
    return this.activeSwingId;
  }

  endGesture(reason = 'gesture-ended') {
    if (!this.activeSwingId) return false;
    this.activeSwingId = null;
    this.actorsResolvedThisSwing.clear();
    this.acceptedThisSwing = 0;
    this.lastResult = reason;
    return true;
  }

  measureFrame(controller, dt) {
    const safeDt = Math.max(1e-5, Number(dt) || 0);
    let maximumTravel = 0;
    for (const name of VALID_EDGE_PRIMITIVES) {
      const primitive = controller.primitives?.[name];
      if (!primitive) continue;
      edgeCenter(primitive, true, this.scratch.previousCenter);
      edgeCenter(primitive, false, this.scratch.currentCenter);
      const travel = this.scratch.frameMotion.subVectors(this.scratch.currentCenter, this.scratch.previousCenter).length();
      maximumTravel = Math.max(maximumTravel, travel);
    }
    const deliberate = controller.deliberateInputVelocity;
    const deliberateSpeed = finiteVector(deliberate) ? deliberate.length() : 0;
    const lateralInputSpeed = finiteVector(deliberate) ? Math.abs(deliberate.x) : 0;
    this.swingLateralRatio = lateralInputSpeed / Math.max(1e-6, deliberateSpeed);
    const lateralEdgeTravel = maximumTravel * this.swingLateralRatio;
    this.swingEdgeSpeed = lateralEdgeTravel / safeDt;
    this.swingTravel += lateralEdgeTravel;
    return { maximumTravel, lateralEdgeTravel, deliberateSpeed };
  }

  findEarliestEdgeContact(controller) {
    if (!controller.physics || !controller.sweepPrimitive) return null;
    const positionsPrepared = controller.physics.prepareWeaponSweepBatch?.() === true;
    const candidates = [...VALID_EDGE_PRIMITIVES].map((name) => {
      const primitive = controller.primitives?.[name];
      return primitive ? { primitive, contact: controller.sweepPrimitive(primitive, positionsPrepared) } : null;
    }).filter((candidate) => candidate?.contact?.hit);
    return candidates.sort((a, b) => a.contact.toi - b.contact.toi || a.contact.anchorDistance - b.contact.anchorDistance)[0] ?? null;
  }

  resolveContactPoint(candidate) {
    const { primitive, contact } = candidate;
    return contact.hit.witness1
      ? this.scratch.contactPoint.set(contact.hit.witness1.x, contact.hit.witness1.y, contact.hit.witness1.z)
      : this.scratch.contactPoint.copy(primitive.scratch.selectedPrevious).lerp(primitive.scratch.selectedCurrent, contact.toi);
  }

  reject(kind, result) {
    if (kind === 'speed') this.rejectedSpeedCount = incrementBounded(this.rejectedSpeedCount);
    else if (kind === 'seam') this.rejectedSeamDistanceCount = incrementBounded(this.rejectedSeamDistanceCount);
    else if (kind === 'repeat') this.rejectedRepeatCount = incrementBounded(this.rejectedRepeatCount);
    else this.rejectedIntentCount = incrementBounded(this.rejectedIntentCount);
    this.lastResult = result;
    return false;
  }

  createImpulse({ actor, segmentId, point, edgeMotion, edgeSpeed }) {
    const direction = this.scratch.impulse.copy(edgeMotion);
    if (direction.lengthSq() < 1e-8) direction.set(1, 0, 0);
    direction.normalize();
    const center = actor?.getBodyWorldPosition?.('upper_chest');
    if (finiteVector(center)) {
      this.scratch.outward.copy(point).sub(center);
      this.scratch.outward.y = Math.max(0, this.scratch.outward.y);
      if (this.scratch.outward.lengthSq() > 1e-8) direction.addScaledVector(this.scratch.outward.normalize(), 0.14);
    }
    direction.y += segmentId === 'head_neck' ? 0.2 : 0.1;
    direction.normalize();
    const magnitude = segmentId === 'head_neck'
      ? THREE.MathUtils.clamp(edgeSpeed * 0.72, 0.55, 1.45)
      : THREE.MathUtils.clamp(edgeSpeed * 0.42, 0.3, 0.82);
    direction.multiplyScalar(magnitude);
    const angularMagnitude = segmentId === 'head_neck' ? 0.34 : 0.2;
    this.scratch.angularImpulse.set(-direction.z, direction.x * 0.25, direction.x).normalize().multiplyScalar(angularMagnitude);
    return { impulse: direction.clone(), angularImpulse: this.scratch.angularImpulse.clone() };
  }

  attemptContact({ controller, routed, point, edgeMotion, primitiveName, edgeSpeed = this.swingEdgeSpeed, lateralRatio = this.swingLateralRatio, swingTravel = this.swingTravel, deliberateSpeed = Infinity } = {}) {
    const actor = routed?.actor;
    const hit = routed?.hit;
    const actorId = actorIdOf(actor);
    this.lastContactActorId = actorId;
    this.lastContactBodyId = hit?.bodyId ?? null;
    this.lastContactRegionId = hit?.regionId ?? null;
    this.lastCandidateSegmentId = resolveCandidateSegment(hit);
    this.lastSeamDistance = null;

    if (!this.activeSwingId) return this.reject('intent', 'rejected_no_active_gesture');
    if (!VALID_EDGE_PRIMITIVES.has(primitiveName)) return this.reject('intent', 'rejected_non_edge_contact');
    if (!isFolsomShowcaseDismembermentTargetEligible(actor)) return this.reject('intent', 'rejected_target_not_contactable');
    if (this.actorsResolvedThisSwing.has(actorId)) return this.reject('repeat', 'rejected_actor_already_resolved');
    if (this.acceptedThisSwing >= this.config.maximumSwordDetachmentsPerGesture) return this.reject('repeat', 'rejected_gesture_actor_cap');
    if (!(edgeSpeed >= this.config.minimumSwordEdgeSpeed)) return this.reject('speed', 'rejected_edge_speed');
    if (!(deliberateSpeed >= (controller?.config?.minimumAttackSpeed ?? 0.05)) || !(lateralRatio >= this.config.minimumSwordLateralMotionRatio)) return this.reject('intent', 'rejected_lateral_intent');
    if (!(swingTravel >= this.config.minimumSwordAccumulatedEdgeTravel)) return this.reject('intent', 'rejected_edge_travel');
    const segmentId = this.lastCandidateSegmentId;
    if (!segmentId) return this.reject('intent', 'rejected_non_seam_region');
    if (!hasValidatedSegmentRuntime(actor, segmentId)) return this.reject('intent', 'rejected_damage_runtime_unavailable');
    const seamPoint = actor.getDetachmentWorldPoint?.(segmentId, this.scratch.seamPoint);
    if (!finiteVector(seamPoint) || !finiteVector(point)) return this.reject('intent', 'rejected_seam_unavailable');
    this.lastSeamDistance = point.distanceTo(seamPoint);
    if (this.lastSeamDistance > this.config.maximumSwordSeamDistance[segmentId]) return this.reject('seam', 'rejected_seam_distance');

    const impulses = this.createImpulse({ actor, segmentId, point, edgeMotion, edgeSpeed });
    const result = actor.requestDetachment({
      segmentId,
      cause: 'folsom_showcase_sword_sweep',
      worldPoint: point.clone(),
      impulse: impulses.impulse,
      angularImpulse: impulses.angularImpulse,
    });
    if (result?.accepted !== true) return this.reject('repeat', `rejected_runtime_${result?.reason ?? 'unknown'}`);
    this.actorsResolvedThisSwing.add(actorId);
    this.acceptedThisSwing += 1;
    this.acceptedDetachmentCount = incrementBounded(this.acceptedDetachmentCount);
    this.lastResult = `accepted_${segmentId}`;
    return true;
  }

  update({ controller, dt, contactActive, intentionalState, deliberateEnergy, embedded } = {}) {
    if (!this.enabled || !this.activeSwingId || !controller?.isEquipped?.() || controller.gripPointerId == null) return false;
    if (embedded || controller.state !== 'attacking') return false;
    const metrics = this.measureFrame(controller, dt);
    if (metrics.maximumTravel <= 1e-6) return false;
    const candidate = this.findEarliestEdgeContact(controller);
    if (!candidate) return false;
    const point = this.resolveContactPoint(candidate).clone();
    const routed = controller.weaponContactRouter?.resolveTarget?.(candidate.contact.hit.collider, point);
    if (!routed) return false;
    if (!contactActive || !intentionalState || !deliberateEnergy) return this.reject('intent', 'rejected_unowned_or_inactive_intent');
    const edgeMotion = candidate.primitive.scratch.selectedCurrent.clone().sub(candidate.primitive.scratch.selectedPrevious);
    return this.attemptContact({
      controller,
      routed,
      point,
      edgeMotion,
      primitiveName: candidate.primitive.name,
      edgeSpeed: this.swingEdgeSpeed,
      lateralRatio: this.swingLateralRatio,
      swingTravel: this.swingTravel,
      deliberateSpeed: metrics.deliberateSpeed,
    });
  }

  reset() {
    this.endGesture('reset');
    this.resetDiagnostics();
  }

  getDiagnostics() {
    return {
      enabled: this.enabled,
      activeSwingId: this.activeSwingId,
      swingEdgeSpeed: Number(this.swingEdgeSpeed.toFixed(4)),
      swingLateralRatio: Number(this.swingLateralRatio.toFixed(4)),
      swingTravel: Number(this.swingTravel.toFixed(4)),
      lastContactActorId: this.lastContactActorId,
      lastContactBodyId: this.lastContactBodyId,
      lastContactRegionId: this.lastContactRegionId,
      lastCandidateSegmentId: this.lastCandidateSegmentId,
      lastSeamDistance: this.lastSeamDistance == null ? null : Number(this.lastSeamDistance.toFixed(4)),
      lastResult: this.lastResult,
      acceptedDetachmentCount: this.acceptedDetachmentCount,
      rejectedSpeedCount: this.rejectedSpeedCount,
      rejectedIntentCount: this.rejectedIntentCount,
      rejectedSeamDistanceCount: this.rejectedSeamDistanceCount,
      rejectedRepeatCount: this.rejectedRepeatCount,
      actorsResolvedThisSwing: [...this.actorsResolvedThisSwing].slice(0, this.config.maximumSwordDetachmentsPerGesture),
      actorCapPerGesture: this.config.maximumSwordDetachmentsPerGesture,
    };
  }

  dispose() {
    this.endGesture('disposed');
  }
}
