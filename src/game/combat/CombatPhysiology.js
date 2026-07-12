import * as THREE from 'three';
import { PHYSIOLOGY_CONFIG } from './CombatStage2Config.js';

export class CombatPhysiology {
  constructor({ actor, woundSystem, eventSink = null } = {}) {
    this.actor = actor;
    this.woundSystem = woundSystem;
    this.eventSink = eventSink;
    this.reset();
  }

  reset() {
    this.bloodReserve = PHYSIOLOGY_CONFIG.initialBloodReserve;
    this.circulation = 1;
    this.bloodLossRate = 0;
    this.totalBloodLost = 0;
    this.painLoad = 0;
    this.shock = 0;
    this.consciousness = 1;
    this.neurologicalIntegrity = 1;
    this.breathingIntegrity = 1;
    this.breathingState = 'steady';
    this.timeSinceMortalInjury = 0;
    this.mortalInjury = false;
    this.lastState = 'conscious';
  }

  setEventSink(eventSink) { this.eventSink = eventSink; }

  onTrauma({ hit, severity = 0, depth = 0, deltaDepth = 0, hardContact = false } = {}) {
    if (!hit?.regionId) return;
    this.painLoad = THREE.MathUtils.clamp(this.painLoad + severity * hit.region.painResponse, 0, 2.5);
    if (['upper_chest', 'lower_chest'].includes(hit.regionId) && depth >= 0.075) {
      this.breathingIntegrity = Math.max(0, this.breathingIntegrity - deltaDepth * 2.8 - severity * 0.06);
      if (depth >= 0.14) this.mortalInjury = true;
    }
    if (hit.regionId === 'neck') {
      this.breathingIntegrity = Math.max(0, this.breathingIntegrity - deltaDepth * 3.5);
      if (depth >= PHYSIOLOGY_CONFIG.neckNeurologicalDepth) this.neurologicalIntegrity = Math.max(0, this.neurologicalIntegrity - severity * 0.75 - deltaDepth * 2.4);
    }
    if (['skull', 'head', 'face'].includes(hit.regionId) && depth >= PHYSIOLOGY_CONFIG.decisiveNeurologicalDepth) {
      const neurologicalLoss = depth * (hardContact ? 8.5 : 6.5) + severity * 0.5;
      this.neurologicalIntegrity = Math.max(0, this.neurologicalIntegrity - neurologicalLoss);
      if (this.neurologicalIntegrity <= 0.18) this.actor?.requestCollapse?.('neurological', { immediate: true, lethal: true, regionId: hit.regionId });
    }
  }

  onWoundCreated(wound) {
    if (!wound) return;
    if (wound.vesselInvolvement?.vesselType?.includes('arterial')) {
      this.mortalInjury = wound.regionId === 'neck' || wound.severity >= 1;
      this.shock = Math.min(1, this.shock + (wound.regionId === 'neck' ? 0.2 : 0.08));
    }
  }

  update(dt) {
    const wounds = this.woundSystem?.getActiveWounds?.() ?? [];
    let bloodLossRate = 0;
    let vesselConsciousnessDrain = 0;
    wounds.forEach((wound) => {
      const profile = wound.bleedingProfile ?? { kind: 'none', baseRate: 0 };
      const embeddedFactor = wound.embeddedWeaponId
        ? profile.kind.includes('arterial') ? PHYSIOLOGY_CONFIG.arterialEmbeddedObstruction : PHYSIOLOGY_CONFIG.venousEmbeddedObstruction
        : 1;
      const withdrawalFactor = wound.withdrawalBoostRemaining > 0 ? PHYSIOLOGY_CONFIG.withdrawalBoost : 1;
      const age = Math.max(0, this.actor.elapsed - wound.createdTime);
      const clotFactor = age > PHYSIOLOGY_CONFIG.clottingDelaySeconds && !profile.kind.includes('arterial')
        ? Math.max(0.18, 1 - (age - PHYSIOLOGY_CONFIG.clottingDelaySeconds) * PHYSIOLOGY_CONFIG.clottingPerSecond)
        : 1;
      const rate = profile.baseRate * embeddedFactor * withdrawalFactor * clotFactor * this.circulation;
      wound.bleedingRate = Math.max(0, rate);
      bloodLossRate += wound.bleedingRate;
      vesselConsciousnessDrain += (wound.vesselInvolvement?.consciousnessRate ?? 0) * embeddedFactor * this.circulation;
    });
    if (this.actor.lifeState === 'dead') this.circulation = Math.max(0, this.circulation - PHYSIOLOGY_CONFIG.circulationDecayAfterDeath * dt);
    else this.circulation = THREE.MathUtils.clamp(this.bloodReserve * (1 - this.shock * 0.22), 0, 1);
    this.bloodLossRate = bloodLossRate;
    const lost = Math.min(this.bloodReserve, bloodLossRate * dt);
    this.bloodReserve = THREE.MathUtils.clamp(this.bloodReserve - lost, 0, 1);
    this.totalBloodLost += lost;
    this.painLoad = Math.max(0, this.painLoad - PHYSIOLOGY_CONFIG.painRecoveryPerSecond * dt);
    const shockTarget = THREE.MathUtils.clamp((1 - this.bloodReserve) * 1.12 + this.painLoad * 0.18 + (1 - this.breathingIntegrity) * 0.28, 0, 1);
    this.shock = shockTarget > this.shock ? THREE.MathUtils.lerp(this.shock, shockTarget, 1 - Math.exp(-1.5 * dt)) : Math.max(shockTarget, this.shock - PHYSIOLOGY_CONFIG.shockRecoveryPerSecond * dt);
    const consciousnessTarget = THREE.MathUtils.clamp(this.neurologicalIntegrity * (1 - this.shock * 0.82) * (0.55 + this.bloodReserve * 0.45) * (0.7 + this.breathingIntegrity * 0.3), 0, 1);
    this.consciousness = Math.max(0, Math.min(this.consciousness, consciousnessTarget) - vesselConsciousnessDrain * dt);
    if (this.consciousnessTargetCanRecover()) this.consciousness = Math.min(consciousnessTarget, this.consciousness + dt * 0.025);
    this.updateBreathing();
    this.updateActorState(dt);
  }

  consciousnessTargetCanRecover() {
    return this.actor.lifeState === 'alive' && this.bloodLossRate < 0.002 && this.neurologicalIntegrity > 0.75;
  }

  updateBreathing() {
    if (this.actor.lifeState === 'dead' || this.circulation <= 0.01) this.breathingState = 'still';
    else if (this.breathingIntegrity < 0.22 || this.consciousness < 0.2) this.breathingState = 'failing';
    else if (this.shock > 0.65) this.breathingState = 'gasping';
    else if (this.painLoad > 0.35 || this.breathingIntegrity < 0.7) this.breathingState = 'strained';
    else this.breathingState = 'steady';
  }

  updateActorState(dt) {
    if (this.mortalInjury) this.timeSinceMortalInjury += dt;
    if (this.actor.lifeState === 'dead') return;
    if (this.neurologicalIntegrity <= 0.1) {
      this.actor.requestCollapse?.('neurological', { immediate: true, lethal: true });
      return;
    }
    const neckArterial = this.woundSystem?.getActiveWounds?.().some((wound) => wound.regionId === 'neck' && wound.bleedingProfile.kind.includes('arterial'));
    if (neckArterial && (this.consciousness < 0.55 || this.timeSinceMortalInjury > 1.2)) this.actor.requestCollapse?.('neck_failure', { immediate: this.consciousness < 0.28, lethal: this.bloodReserve < 0.35 });
    if (this.bloodReserve <= PHYSIOLOGY_CONFIG.bloodCollapseThreshold || this.consciousness <= PHYSIOLOGY_CONFIG.unconsciousThreshold) this.actor.requestCollapse?.('blood_loss', { immediate: false, lethal: this.bloodReserve <= PHYSIOLOGY_CONFIG.deathBloodThreshold });
    if (this.bloodReserve <= PHYSIOLOGY_CONFIG.deathBloodThreshold || this.consciousness <= 0.035 && this.mortalInjury) this.actor.transitionLifeState?.('dying', 'circulatory-failure');
  }

  setBloodReserve(value) {
    this.bloodReserve = THREE.MathUtils.clamp(value, PHYSIOLOGY_CONFIG.minimumBloodReserve, PHYSIOLOGY_CONFIG.maximumBloodReserve);
    this.circulation = this.bloodReserve;
  }

  setConsciousness(value) {
    this.consciousness = THREE.MathUtils.clamp(value, 0, 1);
  }

  getDiagnostics() {
    return { bloodReserve: this.bloodReserve, circulation: this.circulation, bloodLossRate: this.bloodLossRate, totalBloodLost: this.totalBloodLost, pain: this.painLoad, shock: this.shock, consciousness: this.consciousness, neurologicalIntegrity: this.neurologicalIntegrity, breathingIntegrity: this.breathingIntegrity, breathingState: this.breathingState, mortalInjury: this.mortalInjury, timeSinceMortalInjury: this.timeSinceMortalInjury };
  }
}
