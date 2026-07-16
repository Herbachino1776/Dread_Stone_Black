import { COMBAT_LAB_WALKER_CONFIG, WALKER_STATES, WalkerVitalStabPolicy } from './CombatLabWalkerController.js';

const LIVING_STATE = WALKER_STATES.nearPlayer;

export class AuthoredHumanoidDeathController {
  constructor({ actor, config = COMBAT_LAB_WALKER_CONFIG, onDeathStarted = null, onGrounded = null } = {}) {
    this.actor = actor;
    this.config = config;
    this.onDeathStarted = onDeathStarted;
    this.onGrounded = onGrounded;
    this.state = LIVING_STATE;
    this.stateElapsed = 0;
    this.deathDurationSeconds = config.deathCollapseSeconds;
    this.selectedDeathName = null;
    this.lethality = new WalkerVitalStabPolicy();
  }

  prepareFrame(deltaSeconds) {
    this.synchronizeFatalSegmentDetachment();
    if (this.state !== WALKER_STATES.losingConsciousness) return;
    this.stateElapsed += Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
    const animationState = this.actor?.visualAdapter?.animationController?.state;
    if (animationState === 'DEAD' || this.stateElapsed >= this.deathDurationSeconds + 0.15) this.holdGroundedPose();
  }

  synchronizeFatalSegmentDetachment() {
    if (this.state !== LIVING_STATE || this.actor?.fatalSegmentDetachmentActive !== true || this.actor?.lifeState !== 'dying') return false;
    const animation = this.actor.visualAdapter?.animationController;
    this.selectedDeathName = animation?.activeAction?.getClip?.()?.name ?? animation?.activeAnimation ?? null;
    this.deathDurationSeconds = animation?.activeAction?.getClip?.()?.duration ?? this.config.deathCollapseSeconds;
    this.state = WALKER_STATES.losingConsciousness;
    this.stateElapsed = 0;
    this.onDeathStarted?.(this.actor);
    return true;
  }

  beforePhysics() {
    if (this.state !== LIVING_STATE || !this.actor || this.actor.ragdollActive) return [];
    const newlyQualified = this.lethality.evaluate(this.actor.woundSystem?.wounds ?? []);
    if (newlyQualified.length) this.handleQualifyingStabChange();
    return newlyQualified;
  }

  handleQualifyingStabChange() {
    if (this.lethality.criticalStabCount === 1) {
      this.actor.balanceImpairment = Math.max(this.actor.balanceImpairment, 0.18);
      return;
    }
    if (this.lethality.criticalStabCount < 2 || this.state !== LIVING_STATE) return;
    const regionId = this.lethality.lastQualifyingRegion ?? '';
    const result = this.actor.visualAdapter?.playDeathAnimation?.({ regionId, variation: this.lethality.criticalStabCount });
    this.selectedDeathName = result?.name ?? null;
    this.deathDurationSeconds = result?.durationSeconds ?? this.config.deathCollapseSeconds;
    this.actor.transitionLifeState?.('dying', 'authored-stationary-vital-stab', { externalCommit: true, forceFatal: true, presentationHandled: true });
    this.state = WALKER_STATES.losingConsciousness;
    this.stateElapsed = 0;
    this.onDeathStarted?.(this.actor);
  }

  forceQualifyingStab(regionId = 'upper_chest') {
    const wound = this.lethality.forceQualifyingStab(regionId);
    if (wound) this.handleQualifyingStabChange();
    return wound;
  }

  holdGroundedPose() {
    if (this.state !== WALKER_STATES.losingConsciousness) return false;
    this.actor?.transitionLifeState?.('dead', 'authored-stationary-grounded', { externalCommit: true, presentationHandled: true });
    this.state = WALKER_STATES.grounded;
    this.onGrounded?.(this.actor);
    return true;
  }

  shouldHoldFinalPose() {
    return this.state === WALKER_STATES.grounded;
  }

  reset() {
    this.state = LIVING_STATE;
    this.stateElapsed = 0;
    this.deathDurationSeconds = this.config.deathCollapseSeconds;
    this.selectedDeathName = null;
    this.lethality = new WalkerVitalStabPolicy();
  }

  getDiagnostics() {
    const animation = this.actor?.visualAdapter?.animationController?.getDiagnostics?.() ?? null;
    return {
      state: this.state,
      finalPoseHeld: this.shouldHoldFinalPose() && animation?.finalPoseHeld === true,
      ragdollActive: this.actor?.ragdollActive === true,
      selectedDeathName: this.selectedDeathName,
      deathDurationSeconds: this.deathDurationSeconds,
      deathProgress: Math.min(1, this.stateElapsed / Math.max(0.001, this.deathDurationSeconds)),
      animation,
      ...this.lethality.getDiagnostics(),
    };
  }

  dispose() {
    this.actor = null;
  }
}
