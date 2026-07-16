export const MELEE_INTENTS = Object.freeze({
  stab: 'stab',
  slash: 'slash',
  smash: 'smash',
  withdraw: 'withdraw',
  idle: 'idle',
  invalid: 'invalid',
});

const DAMAGING_INTENTS = new Set([MELEE_INTENTS.stab, MELEE_INTENTS.slash, MELEE_INTENTS.smash]);

export class MeleeIntentWeapon {
  constructor({ weaponId, minimumIntentSpeed = 0.035, slashBias = 0.52 } = {}) {
    this.weaponId = weaponId ?? 'unknown_melee_weapon';
    this.minimumIntentSpeed = minimumIntentSpeed;
    this.slashBias = slashBias;
    this.current = this.makeIdle('not-observed');
  }

  interpret({ ownerId = null, controlState = 'ready', localVelocity = null, embedded = false } = {}) {
    const x = Number(localVelocity?.x) || 0;
    const y = Number(localVelocity?.y) || 0;
    const z = Number(localVelocity?.z) || 0;
    const speed = Math.hypot(x, y, z);
    if (ownerId == null) return (this.current = this.makeIdle('no-input-owner', speed));
    if (['returning', 'ready'].includes(controlState) || speed < this.minimumIntentSpeed) return (this.current = this.makeIdle('below-intent-threshold', speed, ownerId));
    if (controlState === 'withdrawing' || embedded && z > Math.max(Math.abs(x), Math.abs(y)) * 0.45) {
      return (this.current = this.makeResult(MELEE_INTENTS.withdraw, ownerId, speed, false, 'owned-withdrawal'));
    }
    if (!['attacking', 'contact', 'embedded'].includes(controlState)) {
      return (this.current = this.makeResult(MELEE_INTENTS.invalid, ownerId, speed, false, `invalid-control-state:${controlState}`));
    }
    const axial = Math.abs(z);
    const tangential = Math.hypot(x, y);
    const intent = tangential >= axial * this.slashBias ? MELEE_INTENTS.slash : z < 0 ? MELEE_INTENTS.stab : MELEE_INTENTS.withdraw;
    return (this.current = this.makeResult(intent, ownerId, speed, DAMAGING_INTENTS.has(intent), `owned-${intent}-gesture`));
  }

  makeIdle(reason, speed = 0, ownerId = null) {
    return this.makeResult(MELEE_INTENTS.idle, ownerId, speed, false, reason);
  }

  makeResult(intent, ownerId, speed, damaging, reason) {
    return Object.freeze({ weaponId: this.weaponId, intent, ownerId, speed, intentional: ownerId != null, damaging, reason });
  }

  reset() {
    this.current = this.makeIdle('reset');
  }
}

export function isDamageIntent(intent = {}) {
  return intent.intentional === true && intent.damaging === true && intent.ownerId != null && DAMAGING_INTENTS.has(intent.intent);
}
