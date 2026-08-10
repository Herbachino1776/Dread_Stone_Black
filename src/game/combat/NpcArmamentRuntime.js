import * as THREE from 'three';
import { offensivePhaseAtTime } from '../../contracts/ForgeRuntimeArmament.js';
import { PHYSICAL_ATTACK_PHASES, PhysicalAttackSource } from './PhysicalAttackSource.js';
import { CREATURE_LAB_MACE_LOADOUT, resolveNpcLoadout, validateNpcLoadout } from './NpcLoadout.js';
import { npcWeaponRegistry } from './NpcWeaponRegistry.js';
import { RuntimeAttachmentSocketResolver } from './RuntimeAttachmentSocketResolver.js';

function disposeMaterial(material) {
  if (Array.isArray(material)) material.forEach((entry) => entry?.dispose?.());
  else material?.dispose?.();
}

function vectorArray(vector) {
  return vector?.toArray?.().map((value) => Number(value.toFixed(4))) ?? null;
}

function cloneCapsule(capsule) {
  return capsule ? { start: capsule.start.clone(), end: capsule.end.clone(), radius: capsule.radius } : null;
}

function finiteVector(value, length) {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}

function copyCalibration(weapon, override = null) {
  const calibration = {
    assetScale: override?.assetScale ?? weapon.assetScale,
    gripTransform: {
      position: [...(override?.gripTransform?.position ?? weapon.gripTransform.position)],
      quaternion: [...(override?.gripTransform?.quaternion ?? weapon.gripTransform.quaternion)],
    },
    attackCapsule: {
      start: [...(override?.attackCapsule?.start ?? weapon.attackCapsule.start)],
      end: [...(override?.attackCapsule?.end ?? weapon.attackCapsule.end)],
      radius: override?.attackCapsule?.radius ?? weapon.attackCapsule.radius,
    },
  };
  if (!(Number.isFinite(calibration.assetScale) && calibration.assetScale > 0)) throw new Error('Weapon calibration assetScale must be one positive uniform scalar');
  if (!finiteVector(calibration.gripTransform.position, 3)) throw new Error('Weapon calibration grip position must be a finite 3-vector');
  if (!finiteVector(calibration.gripTransform.quaternion, 4) || Math.abs(Math.hypot(...calibration.gripTransform.quaternion) - 1) > 1e-4) throw new Error('Weapon calibration grip quaternion must be normalized');
  if (!finiteVector(calibration.attackCapsule.start, 3) || !finiteVector(calibration.attackCapsule.end, 3)) throw new Error('Weapon calibration attack capsule endpoints must be finite 3-vectors');
  if (!(Number.isFinite(calibration.attackCapsule.radius) && calibration.attackCapsule.radius > 0)) throw new Error('Weapon calibration attack capsule radius must be positive');
  return calibration;
}

export class NpcArmamentRuntime {
  constructor({
    actor,
    creaturePack,
    loadout = CREATURE_LAB_MACE_LOADOUT,
    weaponRegistry = npcWeaponRegistry,
    damageReceiverProvider = null,
    playerProvider = null,
  } = {}) {
    this.actor = actor ?? null;
    this.creaturePack = creaturePack ?? null;
    this.loadout = loadout;
    this.weaponRegistry = weaponRegistry;
    this.damageReceiverProvider = damageReceiverProvider;
    this.playerProvider = playerProvider;
    this.visualAdapter = actor?.visualAdapter ?? null;
    this.animationController = this.visualAdapter?.animationController ?? null;
    this.attachmentResolver = null;
    this.binding = null;
    this.weapon = null;
    this.weaponVisual = null;
    this.calibrationOverride = null;
    this.effectiveCalibration = null;
    this.physicalSource = null;
    this.compatibleActions = [];
    this.selectedAction = null;
    this.activeAttack = null;
    this.lastCompletedAttack = null;
    this.serial = 0;
    this.outcome = 'idle';
    this.triggeredAttackCount = 0;
    this.lastAttackResult = null;
    this.lastRejectionReason = null;
    this.lastClearReason = null;
    this.showAttackGeometry = false;
    this.diagnosticLines = null;
    this.disposed = false;
    this.equipSerial = 0;
    this.equipInFlight = null;
    this.capabilityAvailable = Boolean(
      creaturePack?.attachmentSockets?.available
      && creaturePack?.offensiveActions?.available,
    );
    this.capabilityReason = this.capabilityAvailable
      ? null
      : !creaturePack?.attachmentSockets?.available
        ? 'attachment-capability-unavailable'
        : 'offensive-action-capability-unavailable';
  }

  async equip() {
    if (this.disposed) return this.reject('armament-runtime-disposed');
    if (this.binding) return { accepted: true, alreadyEquipped: true, weaponId: this.weapon.weaponId };
    if (this.equipInFlight) return this.equipInFlight;
    if (!this.actor || this.actor.disposed || this.actor.lifeState !== 'alive') return this.reject('living-creature-subject-unavailable');
    if (!this.capabilityAvailable) return this.reject(this.capabilityReason);
    if (!this.visualAdapter || !this.animationController) return this.reject('animated-visual-adapter-unavailable');
    const equipSerial = ++this.equipSerial;
    this.equipInFlight = (async () => {
      let loadedVisual = null;
      try {
        const resolved = resolveNpcLoadout({
          loadout: this.loadout,
          weaponRegistry: this.weaponRegistry,
          offensiveActions: this.creaturePack.offensiveActions,
        });
        this.weapon = resolved.weapon;
        this.compatibleActions = resolved.compatibleActions;
        this.selectedAction = this.compatibleActions[0];
        const socket = this.creaturePack.attachmentSockets.sockets.find((entry) => (
          this.weapon.compatibleSocketRoles.includes(entry.semanticRole)
          && this.compatibleActions.some((action) => action.socketRole === entry.semanticRole)
        ));
        if (!socket) throw new Error(`No compatible authored socket exists for ${this.weapon.weaponId}`);
        this.effectiveCalibration = copyCalibration(this.weapon, this.calibrationOverride);
        loadedVisual = await this.weaponRegistry.createVisual(this.weapon);
        if (this.disposed || equipSerial !== this.equipSerial) {
          this.weaponRegistry.disposeVisual(loadedVisual);
          loadedVisual = null;
          return this.reject('weapon-equip-superseded');
        }
        this.attachmentResolver = new RuntimeAttachmentSocketResolver({ visualAdapter: this.visualAdapter });
        this.binding = this.attachmentResolver.resolve(socket);
        this.weaponVisual = loadedVisual;
        loadedVisual = null;
        this.attachmentResolver.attachWeapon(
          this.weaponVisual,
          this.effectiveCalibration.gripTransform,
          this.effectiveCalibration.assetScale,
        );
        this.physicalSource = new PhysicalAttackSource({
          source: this.actor,
          damageAmount: this.weapon.damage,
          damageType: this.weapon.damageType,
          impactStrength: this.weapon.impactStrength,
        });
        this.createDiagnosticsGeometry();
        this.updateWeaponCapsule();
        this.lastRejectionReason = null;
        this.lastClearReason = null;
        return {
          accepted: true,
          weaponId: this.weapon.weaponId,
          socketId: socket.socketId,
          parentRuntimeBone: socket.parentRuntimeBone,
          compatibleActionIds: this.compatibleActions.map((action) => action.combatActionId),
        };
      } catch (error) {
        if (loadedVisual) this.weaponRegistry.disposeVisual(loadedVisual);
        this.unequip('equip-failed');
        return this.reject(error.message);
      } finally {
        this.equipInFlight = null;
      }
    })();
    return this.equipInFlight;
  }

  setLoadout(loadout) {
    const validation = validateNpcLoadout(loadout);
    if (!validation.valid) return this.reject(`invalid-loadout: ${validation.errors.join('; ')}`);
    this.unequip('loadout-changed');
    this.loadout = loadout;
    this.calibrationOverride = null;
    this.effectiveCalibration = null;
    return { accepted: true, loadoutId: loadout.loadoutId };
  }

  setCalibrationOverride(override = null) {
    try {
      const weapon = this.weapon ?? this.weaponRegistry.require(this.loadout.mainHandWeaponId);
      const effective = copyCalibration(weapon, override);
      this.calibrationOverride = override ? copyCalibration(weapon, override) : null;
      this.effectiveCalibration = effective;
      if (this.binding) {
        this.attachmentResolver.updateWeaponTransform(effective.gripTransform, effective.assetScale);
        this.updateWeaponCapsule();
        this.updateDiagnosticsGeometry();
      }
      this.lastRejectionReason = null;
      return { accepted: true, weaponId: weapon.weaponId, calibration: structuredClone(effective) };
    } catch (error) {
      return this.reject(`invalid-weapon-calibration: ${error.message}`);
    }
  }

  selectOffensiveAction(combatActionId) {
    if (this.activeAttack) return this.reject('attack-already-running');
    const action = this.compatibleActions.find((entry) => entry.combatActionId === combatActionId);
    if (!action) return this.reject(`offensive-action-unavailable:${combatActionId}`);
    this.selectedAction = action;
    this.lastRejectionReason = null;
    return { accepted: true, combatActionId, actionName: action.actionName };
  }

  createCommitment() {
    this.weaponVisual?.updateWorldMatrix?.(true, true);
    const capsule = this.getWorldCapsule();
    if (!capsule) return null;
    const origin = capsule.start.clone().lerp(capsule.end, 0.5);
    const hurtVolume = this.damageReceiverProvider?.()?.getHurtVolume?.();
    const targetAtCommit = hurtVolume?.start?.clone?.().lerp?.(hurtVolume.end, 0.5) ?? null;
    const forward = targetAtCommit ? targetAtCommit.clone().sub(origin).setY(0) : new THREE.Vector3(0, 0, 1);
    if (forward.lengthSq() <= 1e-8) {
      const yaw = Number(this.actor?.visualRootYaw ?? this.actor?.spawnYaw) || 0;
      forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    }
    return {
      origin,
      forward: forward.normalize(),
      targetAtCommit,
      actorYaw: Number(this.actor?.visualRootYaw ?? this.actor?.spawnYaw) || 0,
    };
  }

  triggerAttack() {
    if (!this.binding || !this.weapon || !this.selectedAction) return this.reject('armament-not-equipped');
    if (this.activeAttack) return this.reject('attack-already-running');
    if (!this.actor || this.actor.disposed || this.actor.lifeState !== 'alive') return this.reject('living-creature-subject-unavailable');
    const receiver = this.damageReceiverProvider?.();
    if (!receiver) return this.reject('player-damage-receiver-unavailable');
    if (receiver.dead) return this.reject('player-already-dead');
    const commitment = this.createCommitment();
    if (!commitment) return this.reject('attack-commitment-unavailable');
    const playback = this.animationController.playOffensiveAction?.(this.selectedAction.actionName);
    if (!playback) return this.reject(`approved-offensive-animation-unavailable:${this.selectedAction.actionName}`);
    const identity = `${this.actor.instanceId ?? 'npc'}:${this.selectedAction.combatActionId}:${++this.serial}`;
    this.physicalSource.beginAttack(identity);
    this.physicalSource.setPhase(PHYSICAL_ATTACK_PHASES.windup);
    this.updateWeaponCapsule();
    this.activeAttack = {
      identity,
      action: this.selectedAction,
      commitment,
      phase: PHYSICAL_ATTACK_PHASES.windup,
      clipTimeSeconds: 0,
      startingCompletionCount: Number(this.animationController.offensiveCompletionCount) || 0,
    };
    this.outcome = 'pending';
    this.triggeredAttackCount += 1;
    this.lastAttackResult = { accepted: true, outcome: 'pending', attackIdentity: identity };
    this.lastRejectionReason = null;
    return { ...this.lastAttackResult, actionName: this.selectedAction.actionName, combatActionId: this.selectedAction.combatActionId };
  }

  updateWeaponCapsule() {
    if (!this.weaponVisual || !this.weapon) return null;
    const calibration = this.effectiveCalibration ?? copyCalibration(this.weapon, this.calibrationOverride);
    this.weaponVisual.updateWorldMatrix(true, true);
    const start = new THREE.Vector3().fromArray(calibration.attackCapsule.start);
    const end = new THREE.Vector3().fromArray(calibration.attackCapsule.end);
    this.weaponVisual.localToWorld(start);
    this.weaponVisual.localToWorld(end);
    const shape = { start, end, radius: calibration.attackCapsule.radius * calibration.assetScale };
    this.physicalSource?.updateShape?.(shape);
    return shape;
  }

  getWorldCapsule() {
    if (this.physicalSource?.currentShape) return cloneCapsule(this.physicalSource.currentShape);
    if (!this.weaponVisual || !this.weapon) return null;
    const calibration = this.effectiveCalibration ?? copyCalibration(this.weapon, this.calibrationOverride);
    this.weaponVisual.updateWorldMatrix(true, true);
    return {
      start: this.weaponVisual.localToWorld(new THREE.Vector3().fromArray(calibration.attackCapsule.start)),
      end: this.weaponVisual.localToWorld(new THREE.Vector3().fromArray(calibration.attackCapsule.end)),
      radius: calibration.attackCapsule.radius * calibration.assetScale,
    };
  }

  update(deltaSeconds = 0) {
    if (this.disposed || !this.binding) return;
    if (!this.actor || this.actor.disposed || this.actor.lifeState !== 'alive') {
      this.unequip('actor-death-or-disposal');
      return;
    }
    const previousShape = cloneCapsule(this.physicalSource.currentShape);
    this.updateWeaponCapsule();
    if (previousShape && this.physicalSource.previousShape == null) this.physicalSource.previousShape = previousShape;
    if (!this.activeAttack) {
      this.updateDiagnosticsGeometry();
      return;
    }
    const completionCount = Number(this.animationController.offensiveCompletionCount) || 0;
    const completedByController = completionCount > this.activeAttack.startingCompletionCount;
    const sampledTime = this.animationController.getActionClipTime?.(this.activeAttack.action.actionName);
    const clipTime = completedByController
      ? this.activeAttack.action.clipDurationSeconds
      : Math.max(0, Math.min(this.activeAttack.action.clipDurationSeconds, Number(sampledTime) || 0));
    const phase = offensivePhaseAtTime(this.activeAttack.action, clipTime);
    this.activeAttack.clipTimeSeconds = clipTime;
    this.activeAttack.phase = phase;
    this.physicalSource.setPhase(phase);

    if (phase === PHYSICAL_ATTACK_PHASES.active && this.outcome !== 'hit') {
      const receiver = this.damageReceiverProvider?.();
      const hurtVolume = receiver?.getHurtVolume?.();
      if (hurtVolume) {
        const impactDirection = this.physicalSource.currentShape.end.clone().sub(this.physicalSource.previousShape.end);
        if (impactDirection.lengthSq() <= 1e-8) impactDirection.copy(this.activeAttack.commitment.forward);
        const result = this.physicalSource.tryHit({ targetId: 'player', hurtVolume, receiver, impactDirection });
        if (result.accepted) {
          this.outcome = 'hit';
          this.lastAttackResult = {
            accepted: true,
            outcome: 'hit',
            attackIdentity: this.activeAttack.identity,
            lethal: result.lethal,
            currentHealth: result.currentHealth,
          };
        } else if (result.reason !== 'target-already-hit-this-attack') {
          this.lastAttackResult = { accepted: false, outcome: 'pending', attackIdentity: this.activeAttack.identity, reason: result.reason };
        }
      }
    }
    if (phase === PHYSICAL_ATTACK_PHASES.complete) {
      if (this.outcome === 'pending') {
        this.outcome = 'miss';
        this.lastAttackResult = { accepted: true, outcome: 'miss', attackIdentity: this.activeAttack.identity, reason: 'physical-miss' };
      }
      this.lastCompletedAttack = this.activeAttack;
      this.activeAttack = null;
    }
    this.updateDiagnosticsGeometry();
  }

  createDiagnosticsGeometry() {
    if (this.diagnosticLines || !this.actor?.scene?.add) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
    this.diagnosticLines = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: 0xe6b567, transparent: true, opacity: 0.9, depthTest: false }),
    );
    this.diagnosticLines.name = 'NpcArmamentPhysicalSweepDiagnostics';
    this.diagnosticLines.visible = false;
    this.diagnosticLines.frustumCulled = false;
    this.diagnosticLines.renderOrder = 250;
    this.actor.scene.add(this.diagnosticLines);
  }

  updateDiagnosticsGeometry() {
    if (!this.diagnosticLines) return;
    this.diagnosticLines.visible = this.showAttackGeometry && Boolean(this.binding);
    const previous = this.physicalSource?.previousShape;
    const current = this.physicalSource?.currentShape;
    if (!this.diagnosticLines.visible || !previous || !current) return;
    const points = [
      previous.start, previous.end,
      current.start, current.end,
      previous.start, current.start,
      previous.end, current.end,
      previous.start.clone().lerp(previous.end, 0.5), current.start.clone().lerp(current.end, 0.5),
      current.start, current.end,
    ];
    const attribute = this.diagnosticLines.geometry.getAttribute('position');
    points.forEach((point, index) => attribute.setXYZ(index, point.x, point.y, point.z));
    attribute.needsUpdate = true;
    this.diagnosticLines.geometry.setDrawRange(0, points.length);
  }

  toggleAttackGeometry() {
    this.showAttackGeometry = !this.showAttackGeometry;
    this.updateDiagnosticsGeometry();
    return { accepted: true, enabled: this.showAttackGeometry };
  }

  resetCombatState() {
    this.physicalSource?.reset?.();
    if (this.physicalSource) this.physicalSource.source = this.actor;
    this.activeAttack = null;
    this.lastCompletedAttack = null;
    this.outcome = 'idle';
    this.triggeredAttackCount = 0;
    this.lastAttackResult = null;
    this.lastRejectionReason = null;
    return { accepted: true };
  }

  reject(reason) {
    this.lastRejectionReason = reason;
    this.lastAttackResult = { accepted: false, reason, outcome: this.outcome };
    return this.lastAttackResult;
  }

  unequip(reason = 'unequipped') {
    this.equipSerial += 1;
    const wasEquipped = Boolean(this.binding);
    this.activeAttack = null;
    this.lastCompletedAttack = null;
    this.physicalSource?.dispose?.();
    this.physicalSource = null;
    this.attachmentResolver?.dispose?.();
    this.attachmentResolver = null;
    if (this.weaponVisual) this.weaponRegistry.disposeVisual?.(this.weaponVisual);
    this.weaponVisual = null;
    this.binding = null;
    this.weapon = null;
    this.effectiveCalibration = null;
    this.compatibleActions = [];
    this.selectedAction = null;
    this.outcome = 'idle';
    this.lastAttackResult = null;
    this.lastClearReason = reason;
    if (this.diagnosticLines) {
      this.diagnosticLines.removeFromParent();
      this.diagnosticLines.geometry?.dispose?.();
      disposeMaterial(this.diagnosticLines.material);
      this.diagnosticLines = null;
    }
    return { accepted: true, wasEquipped, reason };
  }

  getDiagnostics() {
    const attack = this.activeAttack ?? this.lastCompletedAttack;
    const source = this.physicalSource?.getDiagnostics?.() ?? null;
    const receiver = this.damageReceiverProvider?.();
    const receiverDiagnostics = receiver?.getDiagnostics?.() ?? null;
    const configuredWeapon = this.weapon ?? this.weaponRegistry.get?.(this.loadout?.mainHandWeaponId) ?? null;
    const worldPosition = this.weaponVisual?.getWorldPosition?.(new THREE.Vector3()) ?? null;
    const worldQuaternion = this.weaponVisual?.getWorldQuaternion?.(new THREE.Quaternion()) ?? null;
    const worldScale = this.weaponVisual?.getWorldScale?.(new THREE.Vector3()) ?? null;
    const calibration = this.effectiveCalibration ?? (configuredWeapon ? copyCalibration(configuredWeapon, this.calibrationOverride) : null);
    return {
      enabled: this.capabilityAvailable,
      capabilityAvailable: this.capabilityAvailable,
      capabilityReason: this.capabilityReason,
      equipped: Boolean(this.binding),
      weaponId: configuredWeapon?.weaponId ?? null,
      weaponDisplayName: configuredWeapon?.displayName ?? null,
      assetPath: configuredWeapon?.assetPath ?? null,
      assetScale: calibration?.assetScale ?? null,
      gripTransform: calibration ? structuredClone(calibration.gripTransform) : null,
      localAttackCapsule: calibration ? structuredClone(calibration.attackCapsule) : null,
      weaponWorldTransform: this.weaponVisual ? {
        position: vectorArray(worldPosition),
        quaternion: vectorArray(worldQuaternion),
        scale: vectorArray(worldScale),
      } : null,
      loadoutId: this.loadout?.loadoutId ?? null,
      socketId: this.binding?.socket?.socketId ?? null,
      socketRole: this.binding?.socket?.semanticRole ?? null,
      parentRuntimeBone: this.binding?.socket?.parentRuntimeBone ?? null,
      actionName: this.selectedAction?.actionName ?? attack?.action?.actionName ?? null,
      combatActionId: this.selectedAction?.combatActionId ?? attack?.action?.combatActionId ?? null,
      compatibleActions: this.compatibleActions.map((action) => ({ actionName: action.actionName, combatActionId: action.combatActionId })),
      attackPhase: this.activeAttack?.phase ?? PHYSICAL_ATTACK_PHASES.complete,
      phase: this.activeAttack?.phase ?? PHYSICAL_ATTACK_PHASES.complete,
      clipTimeSeconds: this.activeAttack?.clipTimeSeconds ?? attack?.clipTimeSeconds ?? 0,
      phases: attack?.action?.phases ?? this.selectedAction?.phases ?? null,
      attackId: this.activeAttack?.identity ?? null,
      attackIdentity: this.activeAttack?.identity ?? this.lastCompletedAttack?.identity ?? null,
      commitment: attack?.commitment ? {
        origin: vectorArray(attack.commitment.origin),
        forward: vectorArray(attack.commitment.forward),
        targetAtCommit: vectorArray(attack.commitment.targetAtCommit),
        actorYaw: attack.commitment.actorYaw,
      } : null,
      outcome: this.outcome,
      triggeredAttackCount: this.triggeredAttackCount,
      acceptedPlayerHitCount: source?.acceptedHitCount ?? 0,
      currentPlayerHealth: receiverDiagnostics?.currentHealth ?? null,
      playerDead: receiverDiagnostics?.dead ?? false,
      lastImpactPoint: receiverDiagnostics?.lastImpact?.impactPoint ?? null,
      lastImpactDirection: receiverDiagnostics?.lastImpact?.impactDirection ?? null,
      previousWorldCapsule: this.physicalSource?.previousShape ? {
        start: vectorArray(this.physicalSource.previousShape.start),
        end: vectorArray(this.physicalSource.previousShape.end),
        radius: this.physicalSource.previousShape.radius,
      } : null,
      currentWorldCapsule: this.physicalSource?.currentShape ? {
        start: vectorArray(this.physicalSource.currentShape.start),
        end: vectorArray(this.physicalSource.currentShape.end),
        radius: this.physicalSource.currentShape.radius,
      } : null,
      lastRejectionReason: this.lastRejectionReason ?? source?.lastRejectionReason ?? this.lastAttackResult?.reason ?? null,
      lastAttackResult: this.lastAttackResult,
      lastClearReason: this.lastClearReason,
      showAttackGeometry: this.showAttackGeometry,
      source,
      disposed: this.disposed,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.unequip('armament-runtime-disposed');
    this.disposed = true;
    this.actor = null;
    this.visualAdapter = null;
    this.animationController = null;
    this.creaturePack = null;
  }
}
