import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { HumanoidAnimationPackController, HUMANOID_ANIMATION_STATES, resolveDeathIndex, resolveHurtKind } from '../src/game/combat/HumanoidAnimationPackController.js';
import { resolveAnimationPackManifest, isolateObjectMaterials } from '../src/game/combat/HumanoidGlbVisualAdapter.js';
import { COMBAT_LAB_WALKER_CONFIG, WalkerVitalStabPolicy } from '../src/game/combat/CombatLabWalkerController.js';

const manifest = JSON.parse(readFileSync(new URL('../public/assets/enemies/testman/testman_animpack_v002.json', import.meta.url), 'utf8'));

function createAnimationRig() {
  const root = new THREE.Group();
  const clips = manifest.animations.map((metadata, index) => {
    const start = metadata.frame_start / manifest.fps;
    const end = start + metadata.duration_seconds;
    return new THREE.AnimationClip(metadata.name, end, [
      new THREE.NumberKeyframeTrack('.position[x]', [start, end], [index * 0.01, index * 0.01 + 0.1]),
    ]);
  });
  const pack = resolveAnimationPackManifest(manifest, clips, 'testman-v002-test');
  const mixer = new THREE.AnimationMixer(root);
  const controller = new HumanoidAnimationPackController({ mixer, animationPack: pack, manifest, fadeSeconds: 0.05, walkReferenceSpeed: COMBAT_LAB_WALKER_CONFIG.baseWalkingSpeed });
  return { root, mixer, controller, pack };
}

test('v002 walk is the only looping base animation and follows walker motion', () => {
  const { controller } = createAnimationRig();
  assert.equal(controller.state, HUMANOID_ANIMATION_STATES.holding);
  assert.equal(controller.walkAction.paused, true);
  assert.equal(controller.walkAction.loop, THREE.LoopRepeat);
  controller.setMovement({ speed: 0.72, maximumSpeed: 0.85, walking: true });
  assert.equal(controller.state, HUMANOID_ANIMATION_STATES.walking);
  assert.equal(controller.walkAction.paused, false);
  const duration = controller.walkMetadata.duration_seconds;
  controller.update(duration * 2.4);
  assert.ok(controller.walkAction.time < duration, 'walk time wraps instead of completing');
  controller.setMovement({ speed: 0, maximumSpeed: 0.85, walking: false });
  const heldTime = controller.walkAction.time;
  controller.update(0.5);
  assert.equal(controller.walkAction.time, heldTime, 'stopped Testman holds the authored walk pose without a synthetic idle');
  controller.dispose();
});

test('left and right hurt clips play once and recover to the prior walking state', () => {
  const { controller } = createAnimationRig();
  controller.setMovement({ speed: 0.72, maximumSpeed: 0.85, walking: true });
  const left = controller.playHurt({ regionId: 'left_forearm' });
  assert.equal(left.name, 'DSB_Hurt_LEFT_Flank_v001');
  assert.equal(controller.state, HUMANOID_ANIMATION_STATES.hurt);
  controller.update(left.durationSeconds + 0.06);
  assert.equal(controller.state, HUMANOID_ANIMATION_STATES.walking);
  assert.equal(controller.hurtRecoveryCount, 1);
  const right = controller.playHurt({ regionId: 'right_thigh' });
  assert.equal(right.name, 'DSB_Hurt_RIGHT_Flank_v001');
  controller.update(right.durationSeconds + 0.06);
  assert.equal(controller.state, HUMANOID_ANIMATION_STATES.walking);
  assert.equal(controller.hurtRecoveryCount, 2);
  controller.dispose();
});

test('both v002 death clips play once, complete, and clamp their final pose', () => {
  const cases = [
    { regionId: 'upper_chest', expected: 'DSB_Death_ChestHold_LEFT_v001' },
    { regionId: 'neck', expected: 'DSB_Death_Faceplant_LEFT_v001' },
  ];
  cases.forEach(({ regionId, expected }) => {
    const { controller } = createAnimationRig();
    const death = controller.playDeath({ regionId });
    assert.equal(death.name, expected);
    assert.equal(controller.activeOneShot.loop, THREE.LoopOnce);
    assert.equal(controller.activeOneShot.clampWhenFinished, true);
    controller.update(death.durationSeconds + 0.06);
    assert.equal(controller.state, HUMANOID_ANIMATION_STATES.dead);
    assert.equal(controller.getDiagnostics().finalPoseHeld, true);
    const heldTime = controller.activeOneShot.time;
    controller.update(2);
    assert.equal(controller.activeOneShot.time, heldTime, 'death does not restart or recover');
    controller.dispose();
  });
});

test('authored reaction selection is deterministic for side and injury region', () => {
  assert.equal(resolveHurtKind({ regionId: 'left_hand' }), 'HURT_LEFT');
  assert.equal(resolveHurtKind({ regionId: 'right_foot' }), 'HURT_RIGHT');
  assert.equal(resolveHurtKind({ regionId: 'upper_chest', localHitX: -0.2 }), 'HURT_LEFT');
  assert.equal(resolveHurtKind({ regionId: 'upper_chest', localHitX: 0.2 }), 'HURT_RIGHT');
  assert.equal(resolveDeathIndex({ regionId: 'abdomen' }), 0);
  assert.equal(resolveDeathIndex({ regionId: 'head' }), 1);
  assert.equal(resolveDeathIndex({ regionId: 'left_foot', variation: 3 }), 1);
});

test('walker lethality counts only two unique deliberate deep vital punctures', () => {
  const policy = new WalkerVitalStabPolicy();
  const base = { interactionKind: 'puncture', deliberateStab: true, surfaceRuptured: true, regionId: 'upper_chest' };
  assert.deepEqual(policy.evaluate([{ ...base, id: 'shallow', maximumDepth: 0.03 }]), []);
  assert.deepEqual(policy.evaluate([{ ...base, id: 'slash', interactionKind: 'slash', maximumDepth: 0.08 }]), []);
  assert.deepEqual(policy.evaluate([{ ...base, id: 'limb', regionId: 'left_forearm', maximumDepth: 0.08 }]), []);
  assert.equal(policy.evaluate([{ ...base, id: 'first', maximumDepth: 0.051 }]).length, 1);
  assert.equal(policy.evaluate([{ ...base, id: 'first', maximumDepth: 0.12 }]).length, 0);
  assert.equal(policy.evaluate([{ ...base, id: 'second', regionId: 'neck', maximumDepth: 0.046 }]).length, 1);
  assert.equal(policy.criticalStabCount, 2);
  assert.equal(policy.evaluate([{ ...base, id: 'third', maximumDepth: 0.2 }]).length, 0);
});

test('walker material cloning shares textures while isolating actor opacity', () => {
  const texture = new THREE.Texture();
  const shared = new THREE.MeshStandardMaterial({ map: texture, opacity: 1 });
  const stationary = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  const walkerRoot = new THREE.Group();
  const walkerA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  const walkerB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  walkerRoot.add(walkerA, walkerB);
  const clones = isolateObjectMaterials(walkerRoot);
  assert.equal(clones.size, 1);
  assert.notEqual(walkerA.material, shared);
  assert.equal(walkerA.material, walkerB.material);
  assert.equal(walkerA.material.map, texture);
  walkerA.material.opacity = 0.2;
  assert.equal(stationary.material.opacity, 1);
  clones.forEach((material) => material.dispose());
  stationary.geometry.dispose();
  walkerA.geometry.dispose();
  walkerB.geometry.dispose();
  shared.dispose();
  texture.dispose();
});

test('Testman runtime contains no procedural skeletal animation fallback', () => {
  const adapter = readFileSync(new URL('../src/game/combat/HumanoidGlbVisualAdapter.js', import.meta.url), 'utf8');
  const walker = readFileSync(new URL('../src/game/combat/CombatLabWalkerController.js', import.meta.url), 'utf8');
  const death = readFileSync(new URL('../src/game/combat/AuthoredHumanoidDeathController.js', import.meta.url), 'utf8');
  [adapter, walker, death].forEach((source) => {
    assert.doesNotMatch(source, /ProceduralPainReaction|ProceduralHumanoidLocomotionLayer|ProceduralConsciousnessLossLayer|applyAfterMixer|applyAfterLocomotion/);
  });
  assert.ok(adapter.indexOf('this.animationController.update(dt)') < adapter.indexOf('this.actor.woundSystem?.update?.(dt)'));
  assert.ok(adapter.indexOf('this.actor.woundSystem?.update?.(dt)') < adapter.indexOf('this.actor.syncAnimationProxyBodies(this)'));
});
