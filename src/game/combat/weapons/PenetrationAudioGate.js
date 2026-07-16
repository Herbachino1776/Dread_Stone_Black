const MAX_DIAGNOSTIC_COUNT = 1_000_000;

export class PenetrationAudioGate {
  constructor({ weaponId = 'unknown-piercing-weapon' } = {}) {
    this.weaponId = weaponId;
    this.reset();
  }

  tryEmit(interactionId, emit) {
    if (!interactionId || typeof emit !== 'function') return false;
    if (!this.penetrationAudioArmed || this.lastEmittedInteractionId === interactionId) {
      this.suppressedRepeatCount = Math.min(MAX_DIAGNOSTIC_COUNT, this.suppressedRepeatCount + 1);
      return false;
    }
    if (emit() !== true) return false;
    this.penetrationAudioArmed = false;
    this.activeInteractionId = interactionId;
    this.lastEmittedInteractionId = interactionId;
    this.emissionCount = Math.min(MAX_DIAGNOSTIC_COUNT, this.emissionCount + 1);
    return true;
  }

  rearmAfterFullExtraction(interactionId = this.activeInteractionId) {
    if (interactionId && this.activeInteractionId && interactionId !== this.activeInteractionId) return false;
    if (this.penetrationAudioArmed && this.activeInteractionId == null) return false;
    this.penetrationAudioArmed = true;
    this.activeInteractionId = null;
    this.rearmCount = Math.min(MAX_DIAGNOSTIC_COUNT, this.rearmCount + 1);
    return true;
  }

  reset() {
    this.penetrationAudioArmed = true;
    this.activeInteractionId = null;
    this.lastEmittedInteractionId = null;
    this.emissionCount = 0;
    this.suppressedRepeatCount = 0;
    this.rearmCount = 0;
  }

  getDiagnostics() {
    return {
      penetrationAudioArmed: this.penetrationAudioArmed,
      activeInteractionId: this.activeInteractionId,
      lastEmittedInteractionId: this.lastEmittedInteractionId,
      emissionCount: this.emissionCount,
      suppressedRepeatCount: this.suppressedRepeatCount,
      rearmCount: this.rearmCount,
      weaponId: this.weaponId,
    };
  }
}
