import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { HumanoidAnimationPackController, HUMANOID_ANIMATION_STATES, resolveDeathIndex, resolveHurtKind } from '../src/game/combat/HumanoidAnimationPackController.js';
import { HumanoidGlbVisualAdapter, resolveAnimationPackManifest, isolateObjectMaterials } from '../src/game/combat/HumanoidGlbVisualAdapter.js';
import { COMBAT_LAB_WALKER_CONFIG, WalkerVitalStabPolicy } from '../src/game/combat/CombatLabWalkerController.js';

const manifest = Object.freeze({
  schema: 'dreadstone.animation_pack.v1',
  asset: 'synthetic_humanoid.glb',
  fps: 24,
  approved_animation_count: 5,
  animations: Object.freeze([
    Object.freeze({ name: 'DSB_Walk_NORMAL_v001', approved_kind: 'WALK', frame_start: 0, duration_seconds: 1, loop: true, play_once: false, hold_final_pose: false, return_to_previous_state: false }),
    Object.freeze({ name: 'DSB_Hurt_LEFT_Flank_v001', approved_kind: 'HURT_LEFT', frame_start: 0, duration_seconds: 0.5, loop: false, play_once: true, hold_final_pose: false, return_to_previous_state: true }),
    Object.freeze({ name: 'DSB_Hurt_RIGHT_Flank_v001', approved_kind: 'HURT_RIGHT', frame_start: 0, duration_seconds: 0.5, loop: false, play_once: true, hold_final_pose: false, return_to_previous_state: true }),
    Object.freeze({ name: 'DSB_Death_ChestHold_LEFT_v001', approved_kind: 'DEATH', frame_start: 0, duration_seconds: 0.8, loop: false, play_once: true, hold_final_pose: true, return_to_previous_state: false }),
    Object.freeze({ name: 'DSB_Death_Faceplant_LEFT_v001', approved_kind: 'DEATH', frame_start: 0, duration_seconds: 0.8, loop: false, play_once: true, hold_final_pose: true, return_to_previous_state: false }),
  ]),
});

function createAnimationRig() {
  const root = new THREE.Group();
  const clips = manifest.animations.map((metadata, index) => {
    const start = metadata.frame_start / manifest.fps;
    const end = start + metadata.duration_seconds;
    return new THREE.AnimationClip(metadata.name, end, [
      new THREE.NumberKeyframeTrack('.position[x]', [start, end], [index * 0.01, index * 0.01 + 0.1]),
    ]);
  });
  const pack = resolveAnimationPackManifest(manifest, clips, 'synthetic-authored-pack-test');
  const mixer = new THREE.AnimationMixer(root);
  const controller = new HumanoidAnimationPackController({ mixer, animationPack: pack, manifest, fadeSeconds: 0.05, walkReferenceSpeed: COMBAT_LAB_WALKER_CONFIG.baseWalkingSpeed });
  return { root, mixer, controller, pack };
}

function createFadeAdapter(root) {
  const adapter = Object.create(HumanoidGlbVisualAdapter.prototype);
  adapter.isolateMaterials = true;
  adapter.ownedMaterials = isolateObjectMaterials(root);
  adapter.fadePrepared = false;
  adapter.fadeMaterialBaselines = new Map();
  return adapter;
}

test('authored walk is the only looping base animation and follows walker motion', () => {
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
  assert.equal(controller.walkAction.time, heldTime, 'stopped authored humanoid holds the walk pose without a synthetic idle');
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

test('both authored death clips play once, complete, and clamp their final pose', () => {
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

test('walker lethality accepts physiological sword cuts with vital weighting and bounded limb accumulation', () => {
  const vitalPolicy = new WalkerVitalStabPolicy();
  const sword = { interactionKind: 'sword_cut', physiologyRegistered: true, regionId: 'upper_chest', impactedRegionIds: ['upper_chest'], maximumDepth: 0.026 };
  assert.deepEqual(vitalPolicy.evaluate([{ ...sword, id: 'glance', swordLethality: 0.4 }]), []);
  assert.equal(vitalPolicy.evaluate([{ ...sword, id: 'first', swordLethality: 1.1 }]).length, 1);
  assert.equal(vitalPolicy.criticalStabCount, 1);
  assert.equal(vitalPolicy.evaluate([{ ...sword, id: 'second', impactedRegionIds: ['upper_chest', 'neck'], swordLethality: 1.2 }]).length, 1);
  assert.equal(vitalPolicy.criticalStabCount, 2);

  const decisivePolicy = new WalkerVitalStabPolicy();
  assert.equal(decisivePolicy.evaluate([{ ...sword, id: 'decisive', regionId: 'neck', impactedRegionIds: ['neck'], swordLethality: 2.7 }]).length, 1);
  assert.equal(decisivePolicy.criticalStabCount, 2, 'one sufficiently deep vital sword cut can select authored death');

  const limbPolicy = new WalkerVitalStabPolicy();
  const limb = { ...sword, regionId: 'left_forearm', impactedRegionIds: ['left_forearm'], swordLethality: 1.1 };
  for (let index = 0; index < 5; index += 1) limbPolicy.evaluate([{ ...limb, id: `limb-${index}` }]);
  assert.ok(limbPolicy.criticalStabCount < 2, 'limb cuts accumulate materially slower than vital cuts');
  limbPolicy.evaluate([{ ...limb, id: 'limb-5' }]);
  assert.ok(limbPolicy.criticalStabCount >= 2, 'repeated sword cuts can still incapacitate an authored humanoid');
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

test('character fade state stays opaque until explicitly begun, remains isolated, and resets exactly', () => {
  const texture = new THREE.Texture();
  let textureDisposeCount = 0;
  texture.addEventListener('dispose', () => { textureDisposeCount += 1; });
  const shared = new THREE.MeshStandardMaterial({ map: texture, opacity: 0.82, transparent: false, depthWrite: true, alphaTest: 0.24 });
  const stationaryRoot = new THREE.Group();
  const walkerRoot = new THREE.Group();
  const nextWaveRoot = new THREE.Group();
  const stationaryMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  const walkerMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  const nextWaveMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  stationaryMesh.renderOrder = 7;
  walkerMesh.renderOrder = 7;
  nextWaveMesh.renderOrder = 7;
  stationaryRoot.add(stationaryMesh);
  walkerRoot.add(walkerMesh);
  nextWaveRoot.add(nextWaveMesh);
  const stationaryAdapter = createFadeAdapter(stationaryRoot);
  const walkerAdapter = createFadeAdapter(walkerRoot);
  const nextWaveAdapter = createFadeAdapter(nextWaveRoot);
  const stationaryMaterial = stationaryMesh.material;
  const walkerMaterial = walkerMesh.material;
  const nextWaveMaterial = nextWaveMesh.material;

  assert.notEqual(stationaryMaterial, walkerMaterial, 'each actor owns its cloned material');
  assert.notEqual(walkerMaterial, nextWaveMaterial, 'a fresh wave receives a fresh clone');
  assert.equal(walkerAdapter.setOpacity(1), false, 'assigning full opacity cannot implicitly prepare a fade');
  assert.equal(walkerAdapter.setOpacity(0.999), false, 'the safe opaque threshold remains outside the transparent queue');
  assert.deepEqual(
    { opacity: walkerMaterial.opacity, transparent: walkerMaterial.transparent, depthWrite: walkerMaterial.depthWrite, alphaTest: walkerMaterial.alphaTest, renderOrder: walkerMesh.renderOrder },
    { opacity: 0.82, transparent: false, depthWrite: true, alphaTest: 0.24, renderOrder: 7 },
  );

  assert.equal(walkerAdapter.beginFade(), true);
  const preparedVersion = walkerMaterial.version;
  assert.equal(walkerAdapter.beginFade(), false, 'fade preparation is idempotent');
  assert.equal(walkerMaterial.transparent, true);
  assert.equal(walkerMaterial.depthWrite, false);
  assert.equal(walkerMaterial.alphaTest, 0.24, 'fade preparation preserves alpha-test behavior');
  assert.equal(walkerMesh.renderOrder, 7, 'fade preparation never changes mesh render order');
  assert.equal(walkerAdapter.setFadeOpacity(0.5), true);
  assert.equal(walkerMaterial.opacity, 0.41);
  assert.equal(walkerMaterial.version, preparedVersion, 'alpha updates do not retoggle shader-defining state');
  assert.deepEqual(
    { opacity: stationaryMaterial.opacity, transparent: stationaryMaterial.transparent, depthWrite: stationaryMaterial.depthWrite },
    { opacity: 0.82, transparent: false, depthWrite: true },
    'one actor fading cannot mutate another actor',
  );

  assert.equal(walkerAdapter.resetFade(), true);
  assert.equal(walkerAdapter.resetFade(), false, 'fade reset is idempotent');
  assert.deepEqual(
    { opacity: walkerMaterial.opacity, transparent: walkerMaterial.transparent, depthWrite: walkerMaterial.depthWrite, alphaTest: walkerMaterial.alphaTest, renderOrder: walkerMesh.renderOrder },
    { opacity: 0.82, transparent: false, depthWrite: true, alphaTest: 0.24, renderOrder: 7 },
  );
  assert.deepEqual(
    { opacity: nextWaveMaterial.opacity, transparent: nextWaveMaterial.transparent, depthWrite: nextWaveMaterial.depthWrite },
    { opacity: 0.82, transparent: false, depthWrite: true },
    'next-wave character materials begin genuinely opaque',
  );
  const woundBehindBody = new THREE.MeshBasicMaterial({ transparent: true, depthTest: true, depthWrite: false });
  assert.equal(walkerMaterial.depthWrite && woundBehindBody.depthTest, true, 'opaque body depth fully occludes wound decals behind the torso');

  let walkerMaterialDisposeCount = 0;
  walkerMaterial.addEventListener('dispose', () => { walkerMaterialDisposeCount += 1; });
  walkerAdapter.ownedMaterials.forEach((material) => material.dispose());
  assert.equal(walkerMaterialDisposeCount, 1, 'walker-owned cloned materials dispose after its fade');
  assert.equal(textureDisposeCount, 0, 'disposing an actor clone never disposes its shared texture');

  stationaryAdapter.ownedMaterials.forEach((material) => material.dispose());
  nextWaveAdapter.ownedMaterials.forEach((material) => material.dispose());
  [stationaryMesh, walkerMesh, nextWaveMesh].forEach((mesh) => mesh.geometry.dispose());
  woundBehindBody.dispose();
  shared.dispose();
  texture.dispose();
});

test('authored animation controller remains free of procedural skeletal pose layers', () => {
  const adapter = readFileSync(new URL('../src/game/combat/HumanoidGlbVisualAdapter.js', import.meta.url), 'utf8');
  const walker = readFileSync(new URL('../src/game/combat/CombatLabWalkerController.js', import.meta.url), 'utf8');
  const death = readFileSync(new URL('../src/game/combat/AuthoredHumanoidDeathController.js', import.meta.url), 'utf8');
  [adapter, walker, death].forEach((source) => {
    assert.doesNotMatch(source, /ProceduralPainReaction|ProceduralHumanoidLocomotionLayer|ProceduralConsciousnessLossLayer|applyAfterMixer|applyAfterLocomotion/);
  });
  assert.ok(adapter.indexOf('this.animationController.update(dt)') < adapter.indexOf('this.actor.woundSystem?.update?.(dt)'));
  assert.ok(adapter.indexOf('this.actor.woundSystem?.update?.(dt)') < adapter.indexOf('this.actor.syncAnimationProxyBodies(this)'));
});
