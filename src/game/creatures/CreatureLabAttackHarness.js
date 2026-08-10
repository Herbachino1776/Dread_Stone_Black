import * as THREE from 'three';
import {
  PHYSICAL_ATTACK_PHASES,
  PhysicalAttackLifecycle,
  PhysicalAttackSource,
} from '../combat/PhysicalAttackSource.js';
import { PLAYER_COMBAT_HEALTH } from '../combat/PlayerCombatDamageReceiver.js';

export const CREATURE_LAB_ATTACK_TUNING = Object.freeze({
  damage: PLAYER_COMBAT_HEALTH.labAttackDamage,
  damageType: 'heavy-blunt',
  impactStrength: 0.82,
  sourceRadius: 0.16,
  sourceInnerReach: 0.55,
  sourceOuterReach: 1.72,
  phaseDurations: Object.freeze({
    [PHYSICAL_ATTACK_PHASES.windup]: 0.52,
    [PHYSICAL_ATTACK_PHASES.active]: 0.32,
    [PHYSICAL_ATTACK_PHASES.recovery]: 0.58,
  }),
});

const UP = new THREE.Vector3(0, 1, 0);

function disposeMaterial(material) {
  if (Array.isArray(material)) material.forEach((entry) => entry?.dispose?.());
  else material?.dispose?.();
}

function finiteVector(value) {
  return Boolean(value?.isVector3 && value.toArray().every(Number.isFinite));
}

export class CreatureLabAttackHarness {
  constructor({ scene, playerProvider = null, damageReceiverProvider = null, tuning = CREATURE_LAB_ATTACK_TUNING } = {}) {
    this.scene = scene;
    this.playerProvider = playerProvider;
    this.damageReceiverProvider = damageReceiverProvider;
    this.tuning = tuning;
    this.lifecycle = new PhysicalAttackLifecycle({ sourceId: 'creature-lab-physical-attack', phaseDurations: tuning.phaseDurations });
    this.source = new PhysicalAttackSource({
      damageAmount: tuning.damage,
      damageType: tuning.damageType,
      impactStrength: tuning.impactStrength,
    });
    this.subject = null;
    this.subjectGeneration = 0;
    this.showAttackGeometry = false;
    this.outcome = 'idle';
    this.triggeredAttackCount = 0;
    this.lastAttackResult = null;
    this.lastClearReason = null;
    this.disposed = false;
    this.createPresentation();
  }

  createPresentation() {
    this.presentation = new THREE.Group();
    this.presentation.name = 'CreatureLabPhysicalAttackProxy';
    this.presentation.visible = false;
    this.presentation.userData.creatureLabOnly = true;

    this.shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.048, 1, 8),
      new THREE.MeshStandardMaterial({ color: 0x33261e, roughness: 0.92, metalness: 0.04 }),
    );
    this.shaft.name = 'CreatureLabAttackProxyShaft';
    this.shaft.castShadow = true;
    this.maceHead = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.17, 0),
      new THREE.MeshStandardMaterial({ color: 0x383a39, roughness: 0.64, metalness: 0.62 }),
    );
    this.maceHead.name = 'CreatureLabAttackProxyHead';
    this.maceHead.castShadow = true;
    this.grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.054, 0.054, 0.26, 8),
      new THREE.MeshStandardMaterial({ color: 0x17110e, roughness: 0.96 }),
    );
    this.grip.name = 'CreatureLabAttackProxyGrip';
    this.presentation.add(this.shaft, this.maceHead, this.grip);

    const positions = new Float32Array(16 * 3);
    this.diagnosticGeometry = new THREE.BufferGeometry();
    this.diagnosticGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.diagnosticLines = new THREE.LineSegments(
      this.diagnosticGeometry,
      new THREE.LineBasicMaterial({ color: 0xe6b567, transparent: true, opacity: 0.9, depthTest: false }),
    );
    this.diagnosticLines.name = 'CreatureLabPhysicalAttackSweepDiagnostics';
    this.diagnosticLines.renderOrder = 250;
    this.diagnosticLines.visible = false;
    this.diagnosticLines.frustumCulled = false;
    this.presentation.add(this.diagnosticLines);
    this.scene?.add?.(this.presentation);
  }

  setSubject(actor) {
    if (this.disposed) return { accepted: false, reason: 'attack-harness-disposed' };
    this.clearSubject('creature-lab-subject-replaced');
    this.subject = actor ?? null;
    this.subjectGeneration += 1;
    this.source.source = this.subject;
    this.presentation.visible = Boolean(this.subject);
    this.lastClearReason = null;
    this.updatePresentation(this.createReadyPose());
    return { accepted: Boolean(this.subject), subjectInstanceId: this.subject?.instanceId ?? null };
  }

  clearSubject(reason = 'creature-lab-subject-cleared') {
    this.lifecycle.reset();
    this.source.reset();
    this.source.source = null;
    this.damageReceiverProvider?.()?.reset?.();
    this.subject = null;
    this.outcome = 'idle';
    this.triggeredAttackCount = 0;
    this.lastAttackResult = null;
    this.lastClearReason = reason;
    if (this.presentation) this.presentation.visible = false;
    return { accepted: true, reason };
  }

  getAttackOrigin() {
    const chest = this.subject?.getBodyWorldPosition?.('upper_chest');
    if (finiteVector(chest)) return chest.clone().addScaledVector(UP, 0.06);
    const position = this.subject?.root?.getWorldPosition?.(new THREE.Vector3());
    return finiteVector(position) ? position.addScaledVector(UP, 1.15) : null;
  }

  createCommitment() {
    const origin = this.getAttackOrigin();
    const hurtVolume = this.damageReceiverProvider?.()?.getHurtVolume?.();
    if (!origin || !hurtVolume) return null;
    const target = hurtVolume.start.clone().lerp(hurtVolume.end, 0.6);
    const forward = target.clone().sub(origin).setY(0);
    if (forward.lengthSq() <= 1e-8) {
      const yaw = Number(this.subject?.visualRootYaw ?? this.subject?.spawnYaw) || 0;
      forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    }
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(UP, forward).normalize();
    return { origin, forward, right, targetAtCommit: target };
  }

  triggerAttack() {
    if (!this.subject || this.subject.disposed || this.subject.lifeState !== 'alive') return this.reject('living-creature-subject-unavailable');
    const receiver = this.damageReceiverProvider?.();
    if (!receiver) return this.reject('player-damage-receiver-unavailable');
    if (receiver.dead) return this.reject('player-already-dead');
    const commitment = this.createCommitment();
    if (!commitment) return this.reject('attack-commitment-unavailable');
    const identity = `creature-lab-subject-${this.subjectGeneration}:attack-${this.lifecycle.serial + 1}`;
    const result = this.lifecycle.trigger({ attackIdentity: identity, commitment });
    if (!result.accepted) return this.reject(result.reason);
    this.source.beginAttack(result.attackIdentity);
    this.source.setPhase(PHYSICAL_ATTACK_PHASES.windup);
    this.outcome = 'pending';
    this.triggeredAttackCount += 1;
    this.lastAttackResult = { accepted: true, outcome: this.outcome, attackIdentity: result.attackIdentity };
    this.updatePresentation(this.computePose(this.lifecycle.getState()));
    return this.lastAttackResult;
  }

  reject(reason) {
    this.lastAttackResult = { accepted: false, reason, outcome: this.outcome };
    return this.lastAttackResult;
  }

  createReadyPose() {
    const origin = this.getAttackOrigin();
    if (!origin) return null;
    const yaw = Number(this.subject?.visualRootYaw ?? this.subject?.spawnYaw) || 0;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    const right = new THREE.Vector3().crossVectors(UP, forward).normalize();
    return this.poseAlongDirection({ origin, forward, right }, THREE.MathUtils.degToRad(22));
  }

  computePose(state) {
    const commitment = state.commitment;
    if (!commitment) return this.createReadyPose();
    let angleDegrees = 22;
    if (state.phase === PHYSICAL_ATTACK_PHASES.windup) angleDegrees = THREE.MathUtils.lerp(22, 70, state.phaseProgress);
    else if (state.phase === PHYSICAL_ATTACK_PHASES.active) angleDegrees = THREE.MathUtils.lerp(70, -75, state.phaseProgress);
    else if (state.phase === PHYSICAL_ATTACK_PHASES.recovery) angleDegrees = THREE.MathUtils.lerp(-75, -18, state.phaseProgress);
    return this.poseAlongDirection(commitment, THREE.MathUtils.degToRad(angleDegrees));
  }

  poseAlongDirection(commitment, angle) {
    const direction = commitment.forward.clone().multiplyScalar(Math.cos(angle))
      .addScaledVector(commitment.right, Math.sin(angle))
      .normalize();
    const sourceStart = commitment.origin.clone().addScaledVector(direction, this.tuning.sourceInnerReach);
    const sourceEnd = commitment.origin.clone().addScaledVector(direction, this.tuning.sourceOuterReach);
    return {
      pivot: commitment.origin.clone(),
      direction,
      sourceStart,
      sourceEnd,
      radius: this.tuning.sourceRadius,
    };
  }

  update(deltaSeconds) {
    if (this.disposed || !this.subject) return;
    const state = this.lifecycle.update(deltaSeconds);
    this.source.setPhase(state.phase);
    const pose = this.computePose(state);
    if (!pose) return;
    this.source.updateShape({ start: pose.sourceStart, end: pose.sourceEnd, radius: pose.radius });
    this.updatePresentation(pose);

    if (state.active && this.outcome !== 'hit') {
      const receiver = this.damageReceiverProvider?.();
      const hurtVolume = receiver?.getHurtVolume?.();
      if (hurtVolume) {
        const previousEnd = this.source.previousShape?.end ?? pose.sourceEnd;
        const impactDirection = pose.sourceEnd.clone().sub(previousEnd);
        if (impactDirection.lengthSq() <= 1e-8) impactDirection.copy(state.commitment.forward);
        const result = this.source.tryHit({ targetId: 'player', hurtVolume, receiver, impactDirection });
        if (result.accepted) {
          this.outcome = 'hit';
          this.lastAttackResult = {
            accepted: true,
            outcome: 'hit',
            attackIdentity: state.attackIdentity,
            lethal: result.lethal,
            currentHealth: result.currentHealth,
          };
        } else if (result.reason !== 'target-already-hit-this-attack') {
          this.lastAttackResult = { accepted: false, outcome: 'pending', attackIdentity: state.attackIdentity, reason: result.reason };
        }
      }
    }
    if (state.phase === PHYSICAL_ATTACK_PHASES.complete && this.outcome === 'pending') {
      this.outcome = 'miss';
      this.lastAttackResult = { accepted: true, outcome: 'miss', attackIdentity: state.attackIdentity, reason: 'physical-miss' };
    }
    this.updateDiagnosticsGeometry();
  }

  updatePresentation(pose) {
    if (!pose || !this.presentation) return;
    this.presentation.visible = Boolean(this.subject);
    const length = pose.pivot.distanceTo(pose.sourceEnd);
    const midpoint = pose.pivot.clone().lerp(pose.sourceEnd, 0.5);
    const rotation = new THREE.Quaternion().setFromUnitVectors(UP, pose.direction);
    this.shaft.position.copy(midpoint);
    this.shaft.quaternion.copy(rotation);
    this.shaft.scale.set(1, length, 1);
    this.maceHead.position.copy(pose.sourceEnd);
    this.grip.position.copy(pose.pivot).addScaledVector(pose.direction, 0.12);
    this.grip.quaternion.copy(rotation);
  }

  updateDiagnosticsGeometry() {
    if (!this.diagnosticLines) return;
    this.diagnosticLines.visible = this.showAttackGeometry && Boolean(this.subject);
    if (!this.diagnosticLines.visible) return;
    const previous = this.source.previousShape;
    const current = this.source.currentShape;
    const hurt = this.damageReceiverProvider?.()?.getHurtVolume?.();
    if (!previous || !current || !hurt) return;
    const previousMid = previous.start.clone().lerp(previous.end, 0.5);
    const currentMid = current.start.clone().lerp(current.end, 0.5);
    const hurtMid = hurt.start.clone().lerp(hurt.end, 0.5);
    const segments = [
      previous.start, previous.end,
      current.start, current.end,
      previous.start, current.start,
      previous.end, current.end,
      previousMid, currentMid,
      hurt.start, hurt.end,
      hurtMid.clone().add(new THREE.Vector3(-hurt.radius, 0, 0)), hurtMid.clone().add(new THREE.Vector3(hurt.radius, 0, 0)),
      hurtMid.clone().add(new THREE.Vector3(0, 0, -hurt.radius)), hurtMid.clone().add(new THREE.Vector3(0, 0, hurt.radius)),
    ];
    const attribute = this.diagnosticGeometry.getAttribute('position');
    segments.forEach((point, index) => attribute.setXYZ(index, point.x, point.y, point.z));
    attribute.needsUpdate = true;
    this.diagnosticGeometry.setDrawRange(0, segments.length);
    this.diagnosticGeometry.computeBoundingSphere();
  }

  toggleAttackGeometry() {
    this.showAttackGeometry = !this.showAttackGeometry;
    this.updateDiagnosticsGeometry();
    return { accepted: true, enabled: this.showAttackGeometry };
  }

  resetPlayer() {
    const receiver = this.damageReceiverProvider?.();
    const player = this.playerProvider?.();
    this.lifecycle.reset();
    this.source.reset();
    this.source.source = this.subject;
    this.outcome = 'idle';
    this.triggeredAttackCount = 0;
    this.lastAttackResult = null;
    receiver?.reset?.();
    player?.reset?.();
    this.updatePresentation(this.createReadyPose());
    return { accepted: Boolean(receiver && player), currentHealth: receiver?.currentHealth ?? null };
  }

  getDiagnostics() {
    const lifecycle = this.lifecycle.getState();
    const receiver = this.damageReceiverProvider?.();
    const receiverDiagnostics = receiver?.getDiagnostics?.() ?? null;
    const sourceDiagnostics = this.source.getDiagnostics();
    return {
      enabled: true,
      subjectInstanceId: this.subject?.instanceId ?? null,
      subjectGeneration: this.subjectGeneration,
      attackPhase: lifecycle.phase,
      attackId: lifecycle.attackIdentity,
      active: lifecycle.active,
      phaseProgress: Number(lifecycle.phaseProgress.toFixed(3)),
      outcome: this.outcome,
      triggeredAttackCount: this.triggeredAttackCount,
      acceptedPlayerHitCount: sourceDiagnostics.acceptedHitCount,
      currentPlayerHealth: receiverDiagnostics?.currentHealth ?? null,
      playerDead: receiverDiagnostics?.dead ?? false,
      lastImpactPoint: receiverDiagnostics?.lastImpact?.impactPoint ?? null,
      lastImpactDirection: receiverDiagnostics?.lastImpact?.impactDirection ?? null,
      lastRejectionReason: sourceDiagnostics.lastRejectionReason ?? receiverDiagnostics?.lastRejectionReason ?? this.lastAttackResult?.reason ?? null,
      showAttackGeometry: this.showAttackGeometry,
      lastAttackResult: this.lastAttackResult,
      lastClearReason: this.lastClearReason,
      source: sourceDiagnostics,
      playerReceiver: receiverDiagnostics,
      disposed: this.disposed,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.clearSubject('creature-lab-attack-harness-disposed');
    this.disposed = true;
    this.source.dispose();
    this.scene?.remove?.(this.presentation);
    this.presentation?.traverse?.((child) => {
      child.geometry?.dispose?.();
      disposeMaterial(child.material);
    });
    this.presentation = null;
    this.diagnosticLines = null;
    this.diagnosticGeometry = null;
  }
}
