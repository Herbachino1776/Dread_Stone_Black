export const COMBAT_MORTALITY_MODES = Object.freeze({
  immortalReactive: 'immortal_reactive',
  normal: 'normal',
});

export const IMMORTAL_REACTIVE_CONFIG = Object.freeze({
  bloodReserveFloor: 0.3,
  consciousnessFloor: 0.12,
  neurologicalIntegrityFloor: 0.28,
  breathingIntegrityFloor: 0.32,
  recoveryDelaySeconds: 1.15,
  postureRecoverySeconds: 2.8,
  traumaDecayPerSecond: 0.09,
  motorWeaknessDecayPerSecond: 0.22,
  balanceRecoveryPerSecond: 0.34,
  physiologyRecoveryPerSecond: 0.1,
});

export function resolveCombatMortalityMode(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('combatMortality') === COMBAT_MORTALITY_MODES.normal
    ? COMBAT_MORTALITY_MODES.normal
    : COMBAT_MORTALITY_MODES.immortalReactive;
}
