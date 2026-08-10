import * as THREE from 'three';

export { PLAYER_COMBAT_HEALTH } from './PlayerCombatState.js';

const MAX_RETAINED_ATTACK_IDENTITIES = 128;

function finiteVector(value) {
  return Boolean(value?.isVector3 && value.toArray().every(Number.isFinite));
}

function sourceIdentity(source) {
  if (source == null) return null;
  if (typeof source === 'string' || typeof source === 'number') return String(source);
  return source.instanceId ?? source.id ?? source.definitionId ?? source.root?.name ?? 'physical-source';
}

export class PlayerCombatDamageReceiver {
  constructor({
    player = null,
    hudHost = null,
    feedback = null,
    combatState = null,
    onDeath = null,
    onReset = null,
  } = {}) {
    if (!combatState || typeof combatState.applyDamage !== 'function' || typeof combatState.reset !== 'function') {
      throw new Error('PlayerCombatDamageReceiver requires the game-owned PlayerCombatState authority.');
    }
    this.combatState = combatState;
    this.hudHost = hudHost;
    this.feedback = feedback;
    this.onDeath = onDeath;
    this.onReset = onReset;
    this.player = player;
    this.disposed = false;
    this.reset({ notify: false });
  }

  get maximumHealth() { return this.combatState.maximumHealth; }
  get currentHealth() { return this.combatState.currentHealth; }
  get dead() { return this.combatState.dead; }

  bindPlayer(player) {
    if (this.player && this.player.combatDamageReceiver === this) delete this.player.combatDamageReceiver;
    this.player = player ?? null;
    if (this.player) this.player.combatDamageReceiver = this;
    return this.player;
  }

  getHurtVolume() {
    const position = this.player?.position;
    if (!finiteVector(position)) return null;
    const eyeHeight = Math.max(1.2, Number(this.player.eyeHeight) || 1.55);
    const radius = THREE.MathUtils.clamp(Number(this.player.collisionWorld?.playerRadius) || 0.34, 0.24, 0.5);
    const floorY = position.y - eyeHeight;
    return {
      start: new THREE.Vector3(position.x, floorY + radius, position.z),
      end: new THREE.Vector3(position.x, Math.max(floorY + radius, position.y - 0.12), position.z),
      radius,
    };
  }

  receiveCombatImpact({
    source = null,
    damageAmount,
    damageType = 'physical',
    impactPoint,
    impactDirection,
    impactStrength = 0,
    attackIdentity,
  } = {}) {
    if (this.disposed) return this.reject('player-damage-receiver-disposed');
    if (this.dead) return this.reject('player-already-dead');
    const damage = Number(damageAmount);
    const strength = Number(impactStrength);
    if (!Number.isFinite(damage) || damage <= 0) return this.reject('invalid-damage-amount');
    if (!Number.isFinite(strength) || strength < 0) return this.reject('invalid-impact-strength');
    if (!finiteVector(impactPoint) || !finiteVector(impactDirection) || impactDirection.lengthSq() <= 1e-8) return this.reject('invalid-impact-data');
    if (attackIdentity == null || attackIdentity === '') return this.reject('missing-attack-identity');
    const identity = String(attackIdentity);
    if (this.acceptedAttackIdentities.has(identity)) return this.reject('attack-already-accepted');

    const damageResult = this.combatState.applyDamage({
      amount: damage,
      source: sourceIdentity(source),
      damageType,
      attackIdentity: identity,
    });
    if (!damageResult.accepted) return this.reject(damageResult.reason);
    this.acceptedAttackIdentities.add(identity);
    if (this.acceptedAttackIdentities.size > MAX_RETAINED_ATTACK_IDENTITIES) {
      const oldest = this.acceptedAttackIdentities.values().next().value;
      this.acceptedAttackIdentities.delete(oldest);
    }
    this.acceptedImpactCount += 1;
    this.lastImpact = {
      source: sourceIdentity(source),
      damageAmount: damage,
      damageType: String(damageType || 'physical'),
      impactPoint: impactPoint.clone(),
      impactDirection: impactDirection.clone().normalize(),
      impactStrength: strength,
      attackIdentity: identity,
      previousHealth: damageResult.previousHealth,
      currentHealth: damageResult.currentHealth,
      lethal: damageResult.lethal,
    };
    this.lastRejectionReason = null;
    this.hudHost?.hud?.flashDamage?.();
    this.feedback?.shake?.({
      durationMs: this.dead ? 520 : 340,
      intensity: THREE.MathUtils.clamp(0.075 + strength * 0.075, 0.075, 0.16),
      direction: this.lastImpact.impactDirection,
      polarity: 1,
      damping: this.dead ? 12 : 18,
    });
    if (damageResult.lethal) this.onDeath?.(this.getDiagnostics());
    return {
      accepted: true,
      attackIdentity: identity,
      damageApplied: damageResult.damageApplied,
      previousHealth: damageResult.previousHealth,
      currentHealth: damageResult.currentHealth,
      lethal: damageResult.lethal,
    };
  }

  reject(reason) {
    this.lastRejectionReason = reason;
    this.rejectedImpactCount += 1;
    return { accepted: false, reason, currentHealth: this.currentHealth, lethal: this.dead };
  }

  clearAttackOwnership() {
    this.acceptedAttackIdentities.clear();
    this.lastRejectionReason = null;
  }

  reset({ notify = true } = {}) {
    this.acceptedAttackIdentities = new Set();
    this.acceptedImpactCount = 0;
    this.rejectedImpactCount = 0;
    this.lastImpact = null;
    this.lastRejectionReason = null;
    const result = this.combatState.reset({ notify, reason: 'damage-receiver-reset' });
    if (notify && result.accepted) this.onReset?.(this.getDiagnostics());
    return result;
  }

  getDiagnostics() {
    return {
      currentHealth: this.currentHealth,
      maximumHealth: this.maximumHealth,
      dead: this.dead,
      authoritativeState: this.combatState.getDiagnostics(),
      acceptedImpactCount: this.acceptedImpactCount,
      rejectedImpactCount: this.rejectedImpactCount,
      retainedAttackIdentityCount: this.acceptedAttackIdentities.size,
      lastRejectionReason: this.lastRejectionReason,
      lastImpact: this.lastImpact ? {
        ...this.lastImpact,
        impactPoint: this.lastImpact.impactPoint.toArray(),
        impactDirection: this.lastImpact.impactDirection.toArray(),
      } : null,
      hurtVolumeAvailable: Boolean(this.getHurtVolume()),
      disposed: this.disposed,
    };
  }

  dispose() {
    if (this.disposed) return;
    if (this.player?.combatDamageReceiver === this) delete this.player.combatDamageReceiver;
    this.player = null;
    this.acceptedAttackIdentities.clear();
    this.disposed = true;
  }
}
