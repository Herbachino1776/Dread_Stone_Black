import * as THREE from 'three';
import {
  COMBAT_LAB_WALKER_CONFIG,
  ProceduralConsciousnessLossLayer,
  ProceduralHumanoidLocomotionLayer,
  WALKER_STATES,
  WalkerVitalStabPolicy,
} from './CombatLabWalkerController.js';

const LIVING_STATE = WALKER_STATES.nearPlayer;

export class AuthoredHumanoidDeathController {
  constructor({ actor, groundY = 0, config = COMBAT_LAB_WALKER_CONFIG, onGrounded = null } = {}) {
    this.actor = actor;
    this.groundY = groundY;
    this.config = config;
    this.onGrounded = onGrounded;
    this.state = LIVING_STATE;
    this.stateElapsed = 0;
    this.collapseDirection = 1;
    this.locomotion = new ProceduralHumanoidLocomotionLayer({ config });
    this.consciousnessLoss = new ProceduralConsciousnessLossLayer();
    this.lethality = new WalkerVitalStabPolicy();
    this.actor?.visualAdapter?.setLocomotionController?.(this);
  }

  bindBones(bones) {
    this.locomotion.bindBones(bones);
    this.consciousnessLoss.bindBones(bones);
  }

  restoreAuthoredPose() {
    this.locomotion.restoreAuthoredPose();
  }

  applyAfterMixer() {
    this.locomotion.applyAfterMixer();
    this.consciousnessLoss.applyAfterLocomotion();
    this.consciousnessLoss.preserveFootGroundClearance(this.groundY);
  }

  prepareFrame(deltaSeconds) {
    const dt = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
    if (this.state === WALKER_STATES.grounded || this.state === LIVING_STATE) return;
    this.stateElapsed += dt;
    if (this.state === WALKER_STATES.losingConsciousness) {
      this.consciousnessLoss.advance(this.stateElapsed, this.config.consciousnessLossSeconds);
      this.locomotion.advance(dt, { speed: 0, walking: false, impaired: true, dying: true, locomotionWeight: this.consciousnessLoss.locomotionWeight });
      if (this.stateElapsed >= this.config.consciousnessLossSeconds) {
        this.state = WALKER_STATES.settlingToGround;
        this.stateElapsed = 0;
        this.consciousnessLoss.advanceGroundCollapse(0, this.config.groundCollapseSeconds);
      }
      return;
    }
    if (this.state === WALKER_STATES.settlingToGround) {
      this.locomotion.advance(dt, { speed: 0, walking: false, impaired: true, dying: true, locomotionWeight: 0 });
      this.consciousnessLoss.advanceGroundCollapse(this.stateElapsed, this.config.groundCollapseSeconds);
      if (this.stateElapsed >= this.config.groundCollapseSeconds) this.holdGroundedPose();
    }
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
    const region = this.lethality.lastQualifyingRegion ?? '';
    const impactX = this.actor?.lastReaction?.direction?.x;
    this.collapseDirection = region.startsWith('left_')
      ? -1
      : region.startsWith('right_')
        ? 1
        : Number.isFinite(impactX) && Math.abs(impactX) > 0.05
          ? Math.sign(impactX)
          : 1;
    this.consciousnessLoss.begin(this.collapseDirection);
    this.state = WALKER_STATES.losingConsciousness;
    this.stateElapsed = 0;
  }

  forceQualifyingStab(regionId = 'upper_chest') {
    const wound = this.lethality.forceQualifyingStab(regionId);
    if (wound) this.handleQualifyingStabChange();
    return wound;
  }

  holdGroundedPose() {
    if (this.state !== WALKER_STATES.settlingToGround) return false;
    this.consciousnessLoss.holdGroundedPose();
    this.state = WALKER_STATES.grounded;
    this.stateElapsed = 0;
    this.onGrounded?.(this.actor);
    return true;
  }

  shouldHoldFinalPose() {
    return this.state === WALKER_STATES.grounded;
  }

  reset() {
    this.restoreAuthoredPose();
    this.state = LIVING_STATE;
    this.stateElapsed = 0;
    this.collapseDirection = 1;
    this.lethality = new WalkerVitalStabPolicy();
    this.consciousnessLoss.reset();
  }

  getDiagnostics() {
    const collapse = this.consciousnessLoss.getDiagnostics();
    return {
      state: this.state,
      finalPoseHeld: this.shouldHoldFinalPose(),
      ragdollActive: this.actor?.ragdollActive === true,
      ...this.lethality.getDiagnostics(),
      consciousnessLossProgress: Number(collapse.progress.toFixed(3)),
      collapseDirection: collapse.collapseDirection,
      groundingProgress: Number(collapse.groundingProgress.toFixed(3)),
      finalRelaxation: Number(collapse.finalRelaxation.toFixed(3)),
      pelvisGroundHeight: Number.isFinite(collapse.pelvisGroundHeight) ? Number(collapse.pelvisGroundHeight.toFixed(3)) : null,
      chestGroundHeight: Number.isFinite(collapse.chestGroundHeight) ? Number(collapse.chestGroundHeight.toFixed(3)) : null,
      torsoGroundSpan: Number.isFinite(collapse.torsoGroundSpan) ? Number(collapse.torsoGroundSpan.toFixed(3)) : null,
    };
  }

  dispose() {
    if (this.actor?.visualAdapter?.locomotionController === this) this.actor.visualAdapter.setLocomotionController(null);
    this.locomotion.bindBones(null);
    this.consciousnessLoss.bindBones(null);
    this.actor = null;
  }
}
