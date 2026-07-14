export const KNIFE_CONTROL_STATES = Object.freeze({
  ready: 'ready',
  gripped: 'gripped',
  attacking: 'attacking',
  contact: 'contact',
  embedded: 'embedded',
  withdrawing: 'withdrawing',
  returning: 'returning',
});

export function canKnifeCreateOffensiveContact({ pointerOwnerId = null, state = KNIFE_CONTROL_STATES.ready, deliberateSpeed = 0, minimumSpeed = 0 } = {}) {
  return pointerOwnerId != null
    && deliberateSpeed >= minimumSpeed
    && [KNIFE_CONTROL_STATES.attacking, KNIFE_CONTROL_STATES.contact, KNIFE_CONTROL_STATES.embedded].includes(state);
}

export function getKnifeReleasePlan({ embeddedDepth = 0, failedContact = false, config } = {}) {
  if (embeddedDepth > 0) {
    return {
      state: KNIFE_CONTROL_STATES.embedded,
      durationSeconds: 0,
      reason: 'planted-embedded-hold',
    };
  }
  return {
    state: KNIFE_CONTROL_STATES.returning,
    durationSeconds: failedContact ? config.return.failedContactSeconds : config.return.freeSeconds,
    reason: failedContact ? 'failed-contact-return' : 'released-return',
  };
}

export function criticallyDampedReturnProgress(elapsedSeconds, durationSeconds) {
  const duration = Math.max(0.001, durationSeconds);
  const normalized = Math.min(1, Math.max(0, elapsedSeconds / duration));
  if (normalized >= 1) return 1;
  const omegaTime = normalized * 6;
  const raw = 1 - (1 + omegaTime) * Math.exp(-omegaTime);
  const end = 1 - 7 * Math.exp(-6);
  return Math.min(1, raw / end);
}
