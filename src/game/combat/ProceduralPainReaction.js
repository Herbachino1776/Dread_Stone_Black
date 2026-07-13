import * as THREE from 'three';

export const PAIN_REACTION_LIMITS = Object.freeze({
  maximumBoneAngle: THREE.MathUtils.degToRad(15),
  maximumRootRecoil: 0.07,
  embeddedTensionAngle: THREE.MathUtils.degToRad(2.5),
});

export const REACTION_KINDS = Object.freeze({
  punctureEntry: 'puncture_entry',
  slash: 'slash',
  blunt: 'blunt',
  diagnostic: 'diagnostic_forced',
});

const REGION_TIMING = Object.freeze({
  torso: Object.freeze({ impact: [0.065, 0.09], hold: [0.07, 0.12], recovery: [0.28, 0.42] }),
  neck: Object.freeze({ impact: [0.05, 0.068], hold: [0.04, 0.075], recovery: [0.2, 0.3] }),
  head: Object.freeze({ impact: [0.052, 0.075], hold: [0.045, 0.085], recovery: [0.21, 0.32] }),
  arm: Object.freeze({ impact: [0.06, 0.082], hold: [0.05, 0.095], recovery: [0.22, 0.34] }),
  leg: Object.freeze({ impact: [0.07, 0.09], hold: [0.065, 0.11], recovery: [0.3, 0.42] }),
});

const SOURCE_REACTION_KIND = Object.freeze({
  directed_puncture: REACTION_KINDS.punctureEntry,
  new_puncture: REACTION_KINDS.punctureEntry,
  directed_slash: REACTION_KINDS.slash,
  new_slash: REACTION_KINDS.slash,
  new_blunt_contact: REACTION_KINDS.blunt,
  diagnostic_forced: REACTION_KINDS.diagnostic,
});

export const REACTION_PROFILES = Object.freeze({
  [REACTION_KINDS.punctureEntry]: Object.freeze({
    amplitudeMultiplier: 0.58,
    rootMultiplier: 0.48,
    maximumBoneAngle: THREE.MathUtils.degToRad(8),
    maximumRootRecoil: 0.025,
    timing: Object.freeze({
      torso: Object.freeze({ impact: [0.125, 0.165], hold: [0.055, 0.085], recovery: [0.4, 0.52] }),
      neck: Object.freeze({ impact: [0.11, 0.145], hold: [0.045, 0.07], recovery: [0.35, 0.46] }),
      head: Object.freeze({ impact: [0.115, 0.15], hold: [0.045, 0.07], recovery: [0.35, 0.46] }),
      arm: Object.freeze({ impact: [0.12, 0.155], hold: [0.05, 0.075], recovery: [0.36, 0.48] }),
      leg: Object.freeze({ impact: [0.13, 0.17], hold: [0.055, 0.085], recovery: [0.41, 0.53] }),
    }),
  }),
  [REACTION_KINDS.slash]: Object.freeze({
    amplitudeMultiplier: 0.26,
    rootMultiplier: 0.18,
    maximumBoneAngle: THREE.MathUtils.degToRad(4.5),
    maximumRootRecoil: 0.012,
    timing: Object.freeze({
      torso: Object.freeze({ impact: [0.115, 0.145], hold: [0.04, 0.065], recovery: [0.3, 0.4] }),
      neck: Object.freeze({ impact: [0.105, 0.135], hold: [0.035, 0.055], recovery: [0.27, 0.36] }),
      head: Object.freeze({ impact: [0.105, 0.14], hold: [0.035, 0.055], recovery: [0.27, 0.36] }),
      arm: Object.freeze({ impact: [0.11, 0.14], hold: [0.04, 0.06], recovery: [0.28, 0.38] }),
      leg: Object.freeze({ impact: [0.12, 0.15], hold: [0.045, 0.07], recovery: [0.32, 0.42] }),
    }),
  }),
  [REACTION_KINDS.blunt]: Object.freeze({ amplitudeMultiplier: 1, rootMultiplier: 1, maximumBoneAngle: PAIN_REACTION_LIMITS.maximumBoneAngle, maximumRootRecoil: PAIN_REACTION_LIMITS.maximumRootRecoil, timing: REGION_TIMING }),
  [REACTION_KINDS.diagnostic]: Object.freeze({ amplitudeMultiplier: 1, rootMultiplier: 1, maximumBoneAngle: PAIN_REACTION_LIMITS.maximumBoneAngle, maximumRootRecoil: PAIN_REACTION_LIMITS.maximumRootRecoil, timing: REGION_TIMING }),
});

const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);
const smoothstep = (value) => { const t = clamp01(value); return t * t * (3 - 2 * t); };

export function getReactionFamily(regionId = '') {
  if (['upper_chest', 'lower_chest', 'abdomen'].includes(regionId)) return 'torso';
  if (regionId === 'neck') return 'neck';
  if (['head', 'face', 'skull'].includes(regionId)) return 'head';
  if (/arm|forearm|hand/.test(regionId)) return 'arm';
  if (/thigh|leg|foot/.test(regionId)) return 'leg';
  return 'torso';
}

export function getReactionSide(regionId = '', localDirection = new THREE.Vector3(), localHitPoint = null) {
  if (regionId.startsWith('left_')) return 'left';
  if (regionId.startsWith('right_')) return 'right';
  if (localHitPoint && Math.abs(localHitPoint.x) > 0.04) return localHitPoint.x < 0 ? 'left' : 'right';
  return localDirection.x < 0 ? 'left' : 'right';
}

export function resolveReactionKind(source = 'diagnostic_forced', explicitKind = null) {
  if (explicitKind && REACTION_PROFILES[explicitKind]) return explicitKind;
  return SOURCE_REACTION_KIND[source] ?? REACTION_KINDS.diagnostic;
}

export function resolveReactionTiming(regionId, severity, reactionKind = REACTION_KINDS.diagnostic) {
  const family = getReactionFamily(regionId);
  const timing = (REACTION_PROFILES[reactionKind] ?? REACTION_PROFILES[REACTION_KINDS.diagnostic]).timing[family];
  const t = clamp01(severity);
  return {
    impact: THREE.MathUtils.lerp(timing.impact[0], timing.impact[1], t),
    hold: THREE.MathUtils.lerp(timing.hold[0], timing.hold[1], t),
    recovery: THREE.MathUtils.lerp(timing.recovery[0], timing.recovery[1], t),
  };
}

function setRotation(target, boneId, x = 0, y = 0, z = 0) {
  const limit = PAIN_REACTION_LIMITS.maximumBoneAngle;
  const rotation = new THREE.Vector3(
    THREE.MathUtils.clamp(x, -limit, limit),
    THREE.MathUtils.clamp(y, -limit, limit),
    THREE.MathUtils.clamp(z, -limit, limit),
  );
  if (rotation.length() > limit) rotation.setLength(limit);
  target.set(boneId, rotation);
}

export function buildReactionPose({ regionId, severity = 0, localDirection = new THREE.Vector3(0, 0, -1), localHitPoint = null, depth = 0, slashSeverity = 0, variation = 0, impactMemory = 0, recoveryWeight = 0, reactionKind = REACTION_KINDS.diagnostic } = {}) {
  const family = getReactionFamily(regionId);
  const side = getReactionSide(regionId, localDirection, localHitPoint);
  const s = clamp01(Math.max(severity, depth * 6.5, slashSeverity * 0.72));
  const deep = clamp01(depth / 0.12);
  const sideSign = side === 'left' ? -1 : 1;
  const varied = THREE.MathUtils.clamp(variation, -1, 1);
  const memory = clamp01(impactMemory);
  const recoveryBlend = clamp01(recoveryWeight);
  const lateral = THREE.MathUtils.clamp(localDirection.x, -1, 1);
  const front = THREE.MathUtils.clamp(-localDirection.z, -1, 1);
  const rotations = new Map();
  const deg = THREE.MathUtils.degToRad;
  let rootRecoil = localDirection.clone().normalize().multiplyScalar((0.02 + 0.05 * s) * (1 - memory * 0.12) * (1 - recoveryBlend * 0.08));
  rootRecoil.y = family === 'leg' ? -0.012 * s : Math.min(rootRecoil.y, 0.015);
  if (rootRecoil.length() > PAIN_REACTION_LIMITS.maximumRootRecoil) rootRecoil.setLength(PAIN_REACTION_LIMITS.maximumRootRecoil);

  if (family === 'torso') {
    const fold = deg(3 + 6 * s + 5 * deep) * Math.max(0.45, Math.abs(front)) * (1 + varied * 0.07);
    const sideBend = deg((4 + 5 * s) * (Math.abs(lateral) > 0.15 ? -Math.sign(lateral) : -sideSign * (0.25 + varied * 0.08)));
    setRotation(rotations, 'abdomen', fold * 0.62, 0, sideBend * 0.55);
    setRotation(rotations, 'lower_chest', fold * 0.72, sideBend * 0.28, sideBend * 0.72);
    setRotation(rotations, 'upper_chest', fold * 0.4, sideBend * 0.62, sideBend * 0.48);
    setRotation(rotations, 'neck', fold * 0.18, -sideBend * 0.2, sideBend * 0.16);
    setRotation(rotations, 'head', fold * 0.24, -sideBend * 0.16, sideBend * 0.14);
    setRotation(rotations, 'left_upper_arm', deg(1.5 + s * 2.5 + memory * 1.8), 0, deg(-1.5 - s * 2 - memory * 1.4));
    setRotation(rotations, 'right_upper_arm', deg(1.5 + s * 2.5 + memory * 1.8), 0, deg(1.5 + s * 2 + memory * 1.4));
  } else if (family === 'neck') {
    const withdraw = deg(5 + 7 * s);
    const turn = deg((5 + 8 * s) * -sideSign);
    setRotation(rotations, 'upper_chest', withdraw * 0.25, turn * 0.18, -sideSign * withdraw * 0.22);
    setRotation(rotations, 'neck', -withdraw * 0.72, turn * 0.72, -sideSign * withdraw * 0.68);
    setRotation(rotations, 'head', -withdraw, turn, -sideSign * withdraw * 0.82);
    setRotation(rotations, `${side}_upper_arm`, 0, 0, sideSign * deg(4 + s * 3));
  } else if (family === 'head') {
    const snap = deg(5 + 10 * s) * (1 + varied * 0.09);
    setRotation(rotations, 'head', -snap * 0.55, -sideSign * snap, -sideSign * snap * 0.72);
    setRotation(rotations, 'neck', -snap * 0.36, -sideSign * snap * 0.54, -sideSign * snap * 0.42);
    setRotation(rotations, 'upper_chest', snap * 0.12, sideSign * snap * 0.16, sideSign * snap * 0.14);
  } else if (family === 'arm') {
    const pull = deg(4 + 8 * s + memory * 2.2) * (1 + varied * 0.06);
    setRotation(rotations, `${side}_upper_arm`, -pull * 0.58, sideSign * pull * 0.45, -sideSign * pull);
    setRotation(rotations, `${side}_forearm`, -pull * 0.75, sideSign * pull * 0.18, -sideSign * pull * 0.26);
    setRotation(rotations, 'upper_chest', pull * 0.12, -sideSign * pull * 0.16, -sideSign * pull * 0.22);
    rootRecoil.multiplyScalar(0.35);
  } else if (family === 'leg') {
    const dip = deg(3 + 6 * s + memory * 2.1) * (1 + varied * 0.055);
    setRotation(rotations, 'pelvis', dip * 0.12, -sideSign * dip * 0.18, -sideSign * dip * 0.72);
    setRotation(rotations, 'abdomen', dip * 0.22, sideSign * dip * 0.12, sideSign * dip * 0.58);
    setRotation(rotations, `${side}_thigh`, -dip * 0.64, 0, sideSign * dip * 0.24);
    setRotation(rotations, `${side}_lower_leg`, dip * 0.48, 0, 0);
  }
  const profile = REACTION_PROFILES[reactionKind] ?? REACTION_PROFILES[REACTION_KINDS.diagnostic];
  rotations.forEach((rotation) => {
    rotation.multiplyScalar(profile.amplitudeMultiplier);
    if (rotation.length() > profile.maximumBoneAngle) rotation.setLength(profile.maximumBoneAngle);
  });
  rootRecoil.multiplyScalar(profile.rootMultiplier);
  if (rootRecoil.length() > profile.maximumRootRecoil) rootRecoil.setLength(profile.maximumRootRecoil);
  return { family, side, severity: s, rotations, rootRecoil, reactionKind, profile };
}

export class ProceduralPainReactionController {
  constructor({ bones, presentationRoot, basePosition, baseYaw = 0 } = {}) {
    this.bones = bones;
    this.presentationRoot = presentationRoot;
    this.basePosition = basePosition;
    this.baseYaw = baseYaw;
    this.active = null;
    this.elapsed = 0;
    this.currentWeight = 0;
    this.currentRotations = new Map();
    this.currentRootRecoil = new THREE.Vector3();
    this.affectedBones = [];
    this.embeddedTension = 0;
    this.embeddedTensionTarget = 0;
    this.embeddedRegion = null;
    this.embeddedDirection = new THREE.Vector3();
    this.embeddedDirectionTarget = new THREE.Vector3();
    this.impactMemory = { torso: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
    this.impactMemoryTarget = { torso: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
    this.tmpQuaternion = new THREE.Quaternion();
    this.tmpEuler = new THREE.Euler(0, 0, 0, 'XYZ');
    this.rootYawQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), baseYaw);
    this.lastSource = null;
    this.lastReactionKind = null;
    this.extractionAttemptedToTrigger = false;
  }

  trigger({ regionId, severity, worldDirection, hitWorldPosition = null, depth = 0, slashSeverity = 0, impactForce = 0, actorState = 'alive', variation = 0, impactMemory = 0, recoveryState = 'idle', source = 'diagnostic_forced', reactionKind = null } = {}) {
    if (actorState === 'dead') return false;
    const resolvedKind = resolveReactionKind(source, reactionKind);
    const localDirection = (worldDirection?.clone?.() ?? new THREE.Vector3(0, 0, -1)).applyQuaternion(this.rootYawQuaternion.clone().invert()).normalize();
    const localHitPoint = hitWorldPosition?.clone?.() ? this.presentationRoot.worldToLocal(hitWorldPosition.clone()) : null;
    const stateScale = ['incapacitated', 'dying'].includes(actorState) ? 0.72 : 1;
    const pose = buildReactionPose({ regionId, severity: Math.max(severity ?? 0, impactForce * 0.18) * stateScale, localDirection, localHitPoint, depth, slashSeverity, variation, impactMemory, recoveryWeight: recoveryState === 'recovery' ? this.currentWeight : 0, reactionKind: resolvedKind });
    const timing = resolveReactionTiming(regionId, pose.severity, resolvedKind);
    const timingVariation = 1 + THREE.MathUtils.clamp(variation, -1, 1) * 0.055;
    timing.impact *= recoveryState === 'recovery' ? 0.84 : timingVariation;
    timing.hold *= 1 + impactMemory * 0.08 - variation * 0.035;
    timing.recovery *= 1 + impactMemory * 0.1 + variation * 0.04;
    if (resolvedKind === REACTION_KINDS.punctureEntry) {
      timing.impact = THREE.MathUtils.clamp(timing.impact, 0.11, 0.17);
      timing.recovery = THREE.MathUtils.clamp(timing.recovery, 0.35, 0.55);
    }
    const fromRotations = new Map([...this.currentRotations].map(([id, value]) => [id, value.clone()]));
    if (this.active && this.active.pose.severity > pose.severity) {
      pose.severity = Math.max(pose.severity, this.active.pose.severity * 0.82);
      pose.rotations.forEach((value, id) => value.lerp(this.active.pose.rotations.get(id) ?? value, 0.28));
    }
    fromRotations.forEach((value, id) => { if (!pose.rotations.has(id)) pose.rotations.set(id, new THREE.Vector3()); });
    this.active = { regionId, pose, timing, fromRotations, fromRootRecoil: this.currentRootRecoil.clone(), source, reactionKind: resolvedKind };
    this.elapsed = 0;
    this.affectedBones = [...pose.rotations.keys()];
    this.lastSource = source;
    this.lastReactionKind = resolvedKind;
    return true;
  }

  setImpactMemory(memory = {}) {
    Object.keys(this.impactMemoryTarget).forEach((key) => { this.impactMemoryTarget[key] = clamp01(memory[key] ?? 0); });
  }

  setEmbeddedTension({ regionId, depth = 0, worldDirection } = {}) {
    this.embeddedRegion = regionId ?? null;
    this.embeddedTensionTarget = THREE.MathUtils.clamp(depth / 0.16, 0, 1);
    if (worldDirection) this.embeddedDirectionTarget.copy(worldDirection).applyQuaternion(this.rootYawQuaternion.clone().invert()).normalize();
  }

  releaseEmbeddedTension() {
    this.embeddedTensionTarget = 0;
    this.embeddedDirectionTarget.set(0, 0, 0);
    this.extractionAttemptedToTrigger = false;
    return true;
  }

  releaseEmbedded() {
    this.releaseEmbeddedTension();
    return false;
  }

  sample(dt) {
    this.elapsed += Math.max(0, dt);
    if (!this.active) return { phase: 'idle', weight: 0 };
    const { timing } = this.active;
    let phase;
    let weight;
    if (this.elapsed < timing.impact) {
      phase = 'impact';
      weight = smoothstep(this.elapsed / timing.impact);
    } else if (this.elapsed < timing.impact + timing.hold) {
      phase = 'pain_hold';
      weight = 1;
    } else {
      phase = 'recovery';
      const recoveryT = (this.elapsed - timing.impact - timing.hold) / timing.recovery;
      const t = clamp01(recoveryT);
      weight = 1 - smoothstep(t);
      if (recoveryT >= 1) {
        this.active = null;
        this.currentRotations.clear();
        this.currentRootRecoil.set(0, 0, 0);
        this.currentWeight = 0;
        return { phase: 'idle', weight: 0 };
      }
    }
    this.currentWeight = weight;
    return { phase, weight };
  }

  applyAfterMixer(dt) {
    const tensionResponse = 1 - Math.exp(-Math.max(0, dt) * 9);
    const memoryResponse = 1 - Math.exp(-Math.max(0, dt) * 3.4);
    Object.keys(this.impactMemory).forEach((key) => { this.impactMemory[key] = THREE.MathUtils.lerp(this.impactMemory[key], this.impactMemoryTarget[key], memoryResponse); });
    this.embeddedTension = THREE.MathUtils.lerp(this.embeddedTension, this.embeddedTensionTarget, tensionResponse);
    if (this.embeddedDirectionTarget.lengthSq() > 1e-8) this.embeddedDirection.lerp(this.embeddedDirectionTarget, tensionResponse).normalize();
    if (this.embeddedTensionTarget === 0 && this.embeddedTension < 0.001) {
      this.embeddedTension = 0;
      this.embeddedRegion = null;
      this.embeddedDirection.set(0, 0, 0);
    }
    const sample = this.sample(dt);
    this.currentRotations.clear();
    const activePose = this.active?.pose;
    if (activePose) {
      activePose.rotations.forEach((target, boneId) => {
        const bone = this.bones.get(boneId);
        if (!bone) return;
        const from = this.active.fromRotations.get(boneId) ?? new THREE.Vector3();
        const rotation = this.elapsed < this.active.timing.impact
          ? from.clone().lerp(target, sample.weight)
          : target.clone().multiplyScalar(sample.weight);
        rotation.x = THREE.MathUtils.clamp(rotation.x, -PAIN_REACTION_LIMITS.maximumBoneAngle, PAIN_REACTION_LIMITS.maximumBoneAngle);
        rotation.y = THREE.MathUtils.clamp(rotation.y, -PAIN_REACTION_LIMITS.maximumBoneAngle, PAIN_REACTION_LIMITS.maximumBoneAngle);
        rotation.z = THREE.MathUtils.clamp(rotation.z, -PAIN_REACTION_LIMITS.maximumBoneAngle, PAIN_REACTION_LIMITS.maximumBoneAngle);
        if (rotation.length() > PAIN_REACTION_LIMITS.maximumBoneAngle) rotation.setLength(PAIN_REACTION_LIMITS.maximumBoneAngle);
        this.tmpQuaternion.setFromEuler(this.tmpEuler.set(rotation.x, rotation.y, rotation.z));
        bone.quaternion.multiply(this.tmpQuaternion).normalize();
        this.currentRotations.set(boneId, rotation);
      });
    }
    if (this.embeddedTension > 0 && this.embeddedRegion) {
      const tensionPose = buildReactionPose({ regionId: this.embeddedRegion, severity: this.embeddedTension * 0.18, localDirection: this.embeddedDirection, depth: this.embeddedTension * 0.025 });
      tensionPose.rotations.forEach((rotation, boneId) => {
        const bone = this.bones.get(boneId);
        if (!bone) return;
        const bounded = rotation.clone().multiplyScalar(0.22);
        if (bounded.length() > PAIN_REACTION_LIMITS.embeddedTensionAngle) bounded.setLength(PAIN_REACTION_LIMITS.embeddedTensionAngle);
        this.tmpQuaternion.setFromEuler(this.tmpEuler.set(bounded.x, bounded.y, bounded.z));
        bone.quaternion.multiply(this.tmpQuaternion).normalize();
        const combined = this.currentRotations.get(boneId) ?? new THREE.Vector3();
        combined.add(bounded);
        this.currentRotations.set(boneId, combined);
      });
    }
    this.applyImpactMemoryPose();
    const root = activePose
      ? (this.elapsed < this.active.timing.impact
        ? this.active.fromRootRecoil.clone().lerp(activePose.rootRecoil, sample.weight)
        : activePose.rootRecoil.clone().multiplyScalar(sample.weight))
      : new THREE.Vector3();
    if (this.embeddedTension > 0) root.addScaledVector(this.embeddedDirection, -Math.min(0.012, this.embeddedTension * 0.012));
    if (root.length() > PAIN_REACTION_LIMITS.maximumRootRecoil) root.setLength(PAIN_REACTION_LIMITS.maximumRootRecoil);
    this.currentRootRecoil.copy(root);
    root.applyQuaternion(this.rootYawQuaternion);
    this.presentationRoot.position.copy(this.basePosition).add(root);
    this.presentationRoot.rotation.set(0, this.baseYaw, 0);
    return sample;
  }

  applyImpactMemoryPose() {
    const deg = THREE.MathUtils.degToRad;
    const torso = this.impactMemory.torso;
    if (torso > 0.001) {
      this.applyMemoryRotation('abdomen', deg(1.25) * torso, 0, 0);
      this.applyMemoryRotation('lower_chest', deg(0.72) * torso, 0, 0);
      this.applyMemoryRotation('left_upper_arm', deg(0.9) * torso, 0, deg(-0.8) * torso);
      this.applyMemoryRotation('right_upper_arm', deg(0.9) * torso, 0, deg(0.8) * torso);
    }
    const leftArm = this.impactMemory.leftArm;
    if (leftArm > 0.001) {
      this.applyMemoryRotation('left_upper_arm', deg(-0.7) * leftArm, 0, deg(-1.1) * leftArm);
      this.applyMemoryRotation('left_forearm', deg(-0.8) * leftArm, 0, deg(-0.35) * leftArm);
    }
    const rightArm = this.impactMemory.rightArm;
    if (rightArm > 0.001) {
      this.applyMemoryRotation('right_upper_arm', deg(-0.7) * rightArm, 0, deg(1.1) * rightArm);
      this.applyMemoryRotation('right_forearm', deg(-0.8) * rightArm, 0, deg(0.35) * rightArm);
    }
    const leftLeg = this.impactMemory.leftLeg;
    const rightLeg = this.impactMemory.rightLeg;
    if (leftLeg > 0.001 || rightLeg > 0.001) {
      this.applyMemoryRotation('pelvis', 0, 0, deg(0.8) * (leftLeg - rightLeg));
      if (leftLeg > 0.001) this.applyMemoryRotation('left_thigh', deg(-0.85) * leftLeg, 0, deg(0.35) * leftLeg);
      if (rightLeg > 0.001) this.applyMemoryRotation('right_thigh', deg(-0.85) * rightLeg, 0, deg(-0.35) * rightLeg);
    }
  }

  applyMemoryRotation(boneId, x, y, z) {
    const bone = this.bones.get(boneId);
    if (!bone) return;
    this.tmpQuaternion.setFromEuler(this.tmpEuler.set(x, y, z));
    bone.quaternion.multiply(this.tmpQuaternion).normalize();
  }

  getPlaybackScale() {
    return 1;
  }

  reset() {
    this.active = null;
    this.elapsed = 0;
    this.currentWeight = 0;
    this.currentRotations.clear();
    this.currentRootRecoil.set(0, 0, 0);
    this.affectedBones = [];
    this.embeddedTension = 0;
    this.embeddedTensionTarget = 0;
    this.embeddedRegion = null;
    this.embeddedDirection.set(0, 0, 0);
    this.embeddedDirectionTarget.set(0, 0, 0);
    this.lastSource = null;
    this.lastReactionKind = null;
    this.extractionAttemptedToTrigger = false;
    Object.keys(this.impactMemory).forEach((key) => { this.impactMemory[key] = 0; this.impactMemoryTarget[key] = 0; });
    this.presentationRoot?.position.copy(this.basePosition);
    if (this.presentationRoot) this.presentationRoot.rotation.set(0, this.baseYaw, 0);
  }

  getDiagnostics() {
    const total = this.active ? this.active.timing.impact + this.active.timing.hold + this.active.timing.recovery : 0;
    const phase = !this.active ? 'idle' : this.elapsed < this.active.timing.impact ? 'impact' : this.elapsed < this.active.timing.impact + this.active.timing.hold ? 'pain_hold' : 'recovery';
    return {
      source: this.active?.source ?? this.lastSource,
      reactionKind: this.active?.reactionKind ?? this.lastReactionKind,
      region: this.active?.regionId ?? this.embeddedRegion,
      severity: Number((this.active?.pose.severity ?? this.embeddedTension * 0.18).toFixed(3)),
      phase,
      timeRemaining: Number(Math.max(0, total - this.elapsed).toFixed(3)),
      affectedBones: [...new Set([...this.affectedBones, ...this.currentRotations.keys()])],
      additiveAngles: Object.fromEntries([...this.currentRotations].map(([id, value]) => [id, Number(THREE.MathUtils.radToDeg(value.length()).toFixed(2))])),
      timingProfile: this.active ? { impact: Number(this.active.timing.impact.toFixed(3)), hold: Number(this.active.timing.hold.toFixed(3)), recovery: Number(this.active.timing.recovery.toFixed(3)) } : null,
      targetPoseAmplitudeDegrees: Number(THREE.MathUtils.radToDeg(Math.max(0, ...[...(this.active?.pose.rotations.values() ?? [])].map((value) => value.length()))).toFixed(2)),
      maximumCurrentAdditiveAngleDegrees: Number(THREE.MathUtils.radToDeg(Math.max(0, ...[...this.currentRotations.values()].map((value) => value.length()))).toFixed(2)),
      rootRecoilDistance: Number(this.currentRootRecoil.length().toFixed(4)),
      extractionAttemptedToTrigger: this.extractionAttemptedToTrigger,
      embeddedTension: Number(this.embeddedTension.toFixed(3)),
      impactMemory: this.impactMemory,
    };
  }
}
