import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CollisionWorld } from '../src/game/Collision.js';
import { CombatActorRouter } from '../src/game/combat/CombatActorRouter.js';
import { CombatDirector } from '../src/game/combat/CombatDirector.js';
import { CombatPhysicsWorld, initializeCombatPhysics } from '../src/game/combat/CombatPhysicsWorld.js';
import { CombatLabWalkerController, COMBAT_LAB_WALKER_CONFIG, ProceduralConsciousnessLossLayer, ProceduralHumanoidLocomotionLayer, WALKER_STATES, WalkerVitalStabPolicy } from '../src/game/combat/CombatLabWalkerController.js';
import { HumanoidCombatActor } from '../src/game/combat/HumanoidCombatActor.js';
import { RAGDOLL_HANDOFF_LIMITS } from '../src/game/combat/HumanoidCombatActor.js';
import { HumanoidGlbVisualAdapter, isolateObjectMaterials } from '../src/game/combat/HumanoidGlbVisualAdapter.js';
import { HUMANOID_BODY_CONFIG } from '../src/game/combat/CombatConfig.js';
import { MODEL_IDLE_BONE_MAP, MODEL_IDLE_COMBAT_PROFILE } from '../src/game/combat/HumanoidModelProfiles.js';
import { installKnifeWoundManifestForHeadlessTests } from '../src/game/combat/KnifeWoundDecalLibrary.js';
import { MELEE_INTENTS } from '../src/game/combat/MeleeIntentWeapon.js';

installKnifeWoundManifestForHeadlessTests(JSON.parse(readFileSync(new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url), 'utf8')));

function makeHit(actor, bodyId, localPoint = new THREE.Vector3(0, 0, 0.1)) {
  const entry = actor.bodies.get(bodyId);
  const collider = actor.colliders.get(bodyId);
  const translation = entry.body.translation();
  const rotation = entry.body.rotation();
  const worldPoint = localPoint.clone().applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)).add(new THREE.Vector3(translation.x, translation.y, translation.z));
  return { collider, worldPoint, hit: actor.resolveHit(collider, worldPoint) };
}

function createCollision() {
  return new CollisionWorld({
    walkableRects: [{ minX: -7.8, maxX: 7.8, minZ: -9.8, maxZ: 5.8 }],
    blockerRects: [{ minX: -3.05, maxX: -2.65, minZ: -6.7, maxZ: -1.1, type: 'combatLabWall' }],
    defaultFloorY: 0,
  });
}

function createBoneMap() {
  return new Map(Object.keys(MODEL_IDLE_BONE_MAP).map((id, index) => {
    const bone = new THREE.Bone();
    bone.name = MODEL_IDLE_BONE_MAP[id];
    bone.position.set(index * 0.001, index * 0.002, -index * 0.001);
    bone.quaternion.setFromEuler(new THREE.Euler(index * 0.0002, 0, 0));
    return [id, bone];
  }));
}

function installHeadlessVisualStub(actor) {
  const captured = new Map();
  actor.visualAdapter = {
    materialCloneCount: 0,
    setLocomotionController() {},
    setAuthoritativeTransform() {},
    updateAnimationAuthority() {},
    beginRagdoll() {
      actor.bodies.forEach(({ body }, id) => captured.set(id, { ...body.translation() }));
      return true;
    },
    updateRagdoll() {},
    beginFade() {},
    setOpacity() {},
    getMaterialOpacitySnapshot() { return []; },
    reset() {},
    dispose() {},
    getDiagnostics() { return {}; },
    captured,
  };
  actor.animationAuthorityReady = true;
  return actor.visualAdapter;
}

function installSyntheticAnimationAdapter(actor, { modelScale = 0.91, painQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04, -0.06, 0.035)) } = {}) {
  const presentationRoot = new THREE.Group();
  const modelScene = new THREE.Group();
  const bonesByBodyId = new Map();
  const bonesByName = new Map();
  const targetPositions = new Map(HUMANOID_BODY_CONFIG.map((config) => [config.id, new THREE.Vector3(config.position[0] * 0.82, config.position[1] * 0.82, (config.position[2] + 3.55) * 0.82)]));
  const configurations = new Map(HUMANOID_BODY_CONFIG.map((config) => [config.id, config]));
  HUMANOID_BODY_CONFIG.forEach((config) => {
    const bone = new THREE.Bone();
    bone.name = MODEL_IDLE_BONE_MAP[config.id];
    const parentPosition = config.parentId ? targetPositions.get(config.parentId) : new THREE.Vector3();
    bone.position.copy(targetPositions.get(config.id)).sub(parentPosition);
    bonesByBodyId.set(config.id, bone);
    bonesByName.set(bone.name, bone);
  });
  HUMANOID_BODY_CONFIG.forEach((config) => {
    const bone = bonesByBodyId.get(config.id);
    if (config.parentId) bonesByBodyId.get(config.parentId).add(bone);
    else modelScene.add(bone);
  });
  modelScene.scale.setScalar(modelScale);
  presentationRoot.add(modelScene);
  actor.scene.add(presentationRoot);
  const authoredPose = new Map([...bonesByBodyId].map(([id, bone]) => [id, { position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() }]));
  const adapter = Object.create(HumanoidGlbVisualAdapter.prototype);
  const reactionController = {
    baseYaw: 0,
    rootYawQuaternion: new THREE.Quaternion(),
    getPlaybackScale: () => 1,
    applyAfterMixer() { bonesByBodyId.get('upper_chest').quaternion.multiply(painQuaternion).normalize(); },
    reset() {},
  };
  Object.assign(adapter, {
    actor,
    parent: actor.root,
    profile: MODEL_IDLE_COMBAT_PROFILE,
    scene: modelScene,
    presentationRoot,
    skinnedMeshes: [],
    skeletons: [],
    bones: bonesByName,
    bindings: [],
    ragdollBindings: [],
    ragdollDiagnostics: HumanoidGlbVisualAdapter.prototype.createRagdollDiagnostics.call({}),
    mixer: {
      timeScale: 1,
      update() {
        authoredPose.forEach((pose, id) => {
          const bone = bonesByBodyId.get(id);
          bone.position.copy(pose.position);
          bone.quaternion.copy(pose.quaternion);
          bone.scale.copy(pose.scale);
        });
      },
      stopAllAction() {},
      uncacheRoot() {},
      setTime() {},
    },
    idleAction: { stop() {}, reset() { return this; }, play() { return this; } },
    idlePlaybackScale: 1,
    reactionController,
    reactionBones: bonesByBodyId,
    mixerAuthoredScales: new Map(),
    locomotionController: null,
    isolateMaterials: true,
    ownedMaterials: new Map(),
    fadePrepared: false,
    basePresentationPosition: actor.visualRootPosition.clone(),
    basePresentationYaw: actor.spawnYaw,
    uniformScale: modelScale,
    characterLightingPanel: null,
    disposed: false,
  });
  actor.visualAdapter = adapter;
  adapter.setAuthoritativeTransform(actor.visualRootPosition, actor.spawnYaw);
  presentationRoot.updateMatrixWorld(true);
  actor.setAnimationAuthorityReady(adapter);
  return { adapter, bonesByBodyId, authoredPose, configurations };
}

test('collider routing keeps two humanoids actor-local and drops stale walkers', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const idle = new HumanoidCombatActor({ physics, scene, visualProfile: MODEL_IDLE_COMBAT_PROFILE });
  const walker = new HumanoidCombatActor({ physics, scene, spawnOffset: new THREE.Vector3(3, 0, -1), visualProfile: MODEL_IDLE_COMBAT_PROFILE, automaticMortality: false });
  const idleDirector = new CombatDirector({ actor: idle });
  const walkerDirector = new CombatDirector({ actor: walker });
  const router = new CombatActorRouter();
  router.register(idle, idleDirector);
  router.register(walker, walkerDirector);
  assert.equal(router.getDiagnostics().actorCount, 2);

  const walkerChest = makeHit(walker, 'upper_chest');
  const routedWalker = router.resolveCollider(walkerChest.collider, walkerChest.worldPoint);
  assert.equal(routedWalker.actor, walker);
  assert.equal(routedWalker.director, walkerDirector);
  routedWalker.director.beginPuncture({ weapon: { id: 'test_knife' }, intent: { weaponId: 'test_knife', intent: MELEE_INTENTS.stab, ownerId: 1, intentional: true, damaging: true }, hit: routedWalker.hit, entryPoint: walkerChest.worldPoint, direction: new THREE.Vector3(0, 0, -1), depth: 0.01, force: 1 });
  walkerDirector.update(0.14);
  assert.equal(walker.woundSystem.wounds.length, 1);
  assert.equal(idle.woundSystem.wounds.length, 0);

  const idleChest = makeHit(idle, 'lower_chest');
  const routedIdle = router.resolveCollider(idleChest.collider, idleChest.worldPoint);
  assert.equal(routedIdle.actor, idle);
  routedIdle.director.beginPuncture({ weapon: { id: 'test_knife' }, intent: { weaponId: 'test_knife', intent: MELEE_INTENTS.stab, ownerId: 2, intentional: true, damaging: true }, hit: routedIdle.hit, entryPoint: idleChest.worldPoint, direction: new THREE.Vector3(0, 0, -1), depth: 0.01, force: 1 });
  idleDirector.update(0.14);
  assert.equal(idle.woundSystem.wounds.length, 1);
  assert.equal(walker.woundSystem.wounds.length, 1);

  const staleCollider = walkerChest.collider;
  router.unregister(walker);
  walker.dispose();
  assert.equal(router.resolveCollider(staleCollider, walkerChest.worldPoint), null);
  const replacement = new HumanoidCombatActor({ physics, scene, spawnOffset: new THREE.Vector3(4, 0, 0), visualProfile: MODEL_IDLE_COMBAT_PROFILE, automaticMortality: false });
  const replacementDirector = new CombatDirector({ actor: replacement });
  router.register(replacement, replacementDirector);
  assert.equal(router.resolveCollider(makeHit(replacement, 'upper_chest').collider, makeHit(replacement, 'upper_chest').worldPoint).actor, replacement);
  assert.equal(router.getDiagnostics().actorCount, 2);
  replacementDirector.dispose();
  replacement.dispose();
  idleDirector.dispose();
  walkerDirector.dispose();
  idle.dispose();
  router.dispose();
  physics.dispose();
});

test('procedural locomotion is additive, opposite-phased, bounded, and drift-free', () => {
  const bones = createBoneMap();
  const layer = new ProceduralHumanoidLocomotionLayer({ phaseOffset: 0.17 });
  layer.bindBones(bones);
  const authoredScales = new Map([...bones].map(([id, bone]) => [id, bone.scale.clone()]));
  const blends = [];
  for (let frame = 0; frame < 60; frame += 1) {
    layer.restoreAuthoredPose();
    layer.advance(1 / 60, { speed: 0.72, maximumSpeed: 0.72, walking: true });
    blends.push(layer.blendWeight);
    layer.applyAfterMixer();
  }
  assert.ok(blends.every((value, index) => index === 0 || value >= blends[index - 1]), 'idle-to-walk blend is monotonic');
  assert.ok(Math.abs(((layer.phase + 0.5) % 1) - layer.getDiagnostics().oppositePhase) < 1e-12);
  authoredScales.forEach((scale, id) => assert.deepEqual(bones.get(id).scale.toArray(), scale.toArray(), `${id} scale remains authored`));

  layer.phase = 0.23;
  layer.blendWeight = 1;
  layer.strideLength = 0.62;
  layer.restoreAuthoredPose();
  layer.applyAfterMixer();
  const firstPose = new Map([...bones].map(([id, bone]) => [id, bone.quaternion.clone()]));
  layer.restoreAuthoredPose();
  layer.applyAfterMixer();
  firstPose.forEach((quaternion, id) => assert.ok(1 - Math.abs(quaternion.dot(bones.get(id).quaternion)) < 1e-10, `${id} does not accumulate gait drift`));

  const stoppedPhase = layer.phase;
  for (let frame = 0; frame < 120; frame += 1) {
    layer.restoreAuthoredPose();
    layer.advance(1 / 60, { speed: 0, maximumSpeed: 0.72, walking: false });
    layer.applyAfterMixer();
  }
  assert.equal(layer.blendWeight, 0);
  assert.ok(Math.abs(layer.phase - stoppedPhase) <= 0.5, 'settling takes only the bounded nearest path to double support');
  layer.restoreAuthoredPose();
  [...bones].forEach(([id, bone]) => assert.ok(1 - Math.abs(bone.quaternion.dot(layer.boneEntries.get(id).authoredQuaternion)) < 1e-10));

  const idlePhase = layer.phase;
  for (let frame = 0; frame < 120; frame += 1) layer.advance(1 / 120, { speed: 0, walking: false });
  assert.ok(Math.abs(layer.phase - idlePhase) < 1e-12, 'gait phase does not advance once fully idle');
});

test('consciousness loss progressively relaxes the full pose without accumulating or changing scale', () => {
  const layer = new ProceduralConsciousnessLossLayer();
  const ids = ['pelvis', 'abdomen', 'lower_chest', 'upper_chest', 'neck', 'head', 'left_upper_arm', 'right_upper_arm', 'left_forearm', 'right_forearm', 'left_thigh', 'right_thigh', 'left_lower_leg', 'right_lower_leg', 'left_foot', 'right_foot'];
  const bones = new Map(ids.map((id) => [id, new THREE.Bone()]));
  layer.bindBones(bones);
  layer.begin(-1);
  const sample = (seconds) => {
    bones.forEach((bone) => {
      bone.position.set(0, bone === bones.get('pelvis') ? 1 : 0, 0);
      bone.quaternion.identity();
      bone.scale.set(1, 1, 1);
    });
    layer.advance(seconds, COMBAT_LAB_WALKER_CONFIG.consciousnessLossSeconds);
    layer.applyAfterLocomotion();
    return {
      diagnostics: layer.getDiagnostics(),
      head: bones.get('head').quaternion.angleTo(new THREE.Quaternion()),
      shoulder: bones.get('left_upper_arm').quaternion.angleTo(new THREE.Quaternion()),
      arm: bones.get('left_forearm').quaternion.angleTo(new THREE.Quaternion()),
      torso: bones.get('upper_chest').quaternion.angleTo(new THREE.Quaternion()),
      weakKnee: bones.get('left_lower_leg').quaternion.angleTo(new THREE.Quaternion()),
      strongKnee: bones.get('right_lower_leg').quaternion.angleTo(new THREE.Quaternion()),
      pelvisY: bones.get('pelvis').position.y,
    };
  };
  const early = sample(0.35);
  const middle = sample(1.35);
  const late = sample(2.8);
  for (const key of ['head', 'shoulder', 'arm', 'torso', 'weakKnee', 'strongKnee']) {
    assert.ok(early[key] <= middle[key] + 1e-9, `${key} relaxes progressively at mid collapse`);
    assert.ok(middle[key] <= late[key] + 1e-9, `${key} relaxes progressively at final collapse`);
  }
  assert.ok(early.pelvisY >= middle.pelvisY && middle.pelvisY >= late.pelvisY, 'pelvis descends progressively');
  assert.ok(late.weakKnee > late.strongKnee, 'one leg carries less weight instead of mirroring the other');
  assert.equal(late.diagnostics.collapseDirection, 'left');
  bones.forEach((bone) => assert.ok(bone.scale.equals(new THREE.Vector3(1, 1, 1))));
  const repeat = sample(2.8);
  assert.ok(Math.abs(repeat.pelvisY - late.pelvisY) < 1e-12, 'fresh-pose application does not accumulate pelvis translation');
  assert.ok(Math.abs(repeat.head - late.head) < 1e-12, 'fresh-pose application does not accumulate bone rotation');
});

test('walker movement accelerates, turns within bounds, stops with hysteresis, and resumes', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const collision = createCollision();
  const stationary = new HumanoidCombatActor({ physics, scene, visualProfile: MODEL_IDLE_COMBAT_PROFILE });
  collision.addBlocker(stationary.updatePlayerCollisionBlocker({ id: 'stationary' }));
  const router = new CombatActorRouter();
  const stationaryDirector = new CombatDirector({ actor: stationary });
  router.register(stationary, stationaryDirector);
  const player = { position: new THREE.Vector3(0, 1.55, -2.45) };
  const walker = new CombatLabWalkerController({ scene, physics, collision, combatRouter: router, stationaryActor: stationary, playerProvider: () => player });
  walker.prepareFrame(1 / 60, player);
  const spawnDistance = walker.position.distanceTo(new THREE.Vector3(player.position.x, 0, player.position.z));
  assert.ok(spawnDistance >= 5 && spawnDistance <= 7);
  let previousSpeed = walker.currentSpeed;
  let previousYaw = walker.currentYaw;
  let sawAcceleration = false;
  for (let frame = 0; frame < 720; frame += 1) {
    walker.prepareFrame(1 / 60, player);
    assert.ok(Math.abs(Math.atan2(Math.sin(walker.currentYaw - previousYaw), Math.cos(walker.currentYaw - previousYaw))) <= COMBAT_LAB_WALKER_CONFIG.turnRateRadians / 60 + 1e-8);
    if (walker.currentSpeed > previousSpeed + 1e-6) sawAcceleration = true;
    previousSpeed = walker.currentSpeed;
    previousYaw = walker.currentYaw;
  }
  assert.equal(sawAcceleration, true);
  assert.ok(walker.distanceToPlayer >= COMBAT_LAB_WALKER_CONFIG.stopEnterDistance - 0.08);
  assert.ok([WALKER_STATES.nearPlayer, WALKER_STATES.blendingToIdle].includes(walker.state));
  const stoppedPosition = walker.position.clone();
  player.position.z += 2.2;
  for (let frame = 0; frame < 120; frame += 1) walker.prepareFrame(1 / 60, player);
  assert.ok(walker.position.distanceTo(stoppedPosition) > 0.1, 'exit hysteresis resumes movement after the player creates distance');
  walker.dispose();
  stationaryDirector.dispose();
  stationary.dispose();
  router.dispose();
  physics.dispose();
});

async function simulateMovementAtRate(fps) {
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const collision = createCollision();
  const stationary = new HumanoidCombatActor({ physics, scene, visualProfile: MODEL_IDLE_COMBAT_PROFILE });
  collision.addBlocker(stationary.updatePlayerCollisionBlocker({ id: `stationary-${fps}` }));
  const router = new CombatActorRouter();
  const stationaryDirector = new CombatDirector({ actor: stationary });
  router.register(stationary, stationaryDirector);
  const player = { position: new THREE.Vector3(0, 1.55, -2.45) };
  const walker = new CombatLabWalkerController({ scene, physics, collision, combatRouter: router, stationaryActor: stationary, playerProvider: () => player });
  for (let frame = 0; frame < fps * 4; frame += 1) walker.prepareFrame(1 / fps, player);
  const result = { position: walker.position.clone(), speed: walker.currentSpeed, blend: walker.locomotion.blendWeight, yaw: walker.currentYaw };
  walker.dispose();
  stationaryDirector.dispose();
  stationary.dispose();
  router.dispose();
  physics.dispose();
  return result;
}

test('walker transition results remain stable at 30, 60, and 120 FPS', async () => {
  await initializeCombatPhysics();
  const samples = await Promise.all([30, 60, 120].map(simulateMovementAtRate));
  const reference = samples[1];
  samples.forEach((sample) => {
    assert.ok(sample.position.distanceTo(reference.position) < 0.06);
    assert.ok(Math.abs(sample.speed - reference.speed) < 0.025);
    assert.ok(Math.abs(sample.blend - reference.blend) < 0.025);
    assert.ok(Math.abs(Math.atan2(Math.sin(sample.yaw - reference.yaw), Math.cos(sample.yaw - reference.yaw))) < 0.035);
  });
});

test('walker lethality counts only two unique deliberate deep vital punctures', () => {
  const policy = new WalkerVitalStabPolicy();
  const base = { interactionKind: 'puncture', deliberateStab: true, surfaceRuptured: true, regionId: 'upper_chest' };
  assert.deepEqual(policy.evaluate([{ ...base, id: 'shallow', maximumDepth: 0.03 }]), []);
  assert.deepEqual(policy.evaluate([{ ...base, id: 'slash', interactionKind: 'slash', maximumDepth: 0.08 }]), []);
  assert.deepEqual(policy.evaluate([{ ...base, id: 'limb', regionId: 'left_forearm', maximumDepth: 0.08 }]), []);
  assert.deepEqual(policy.evaluate([{ ...base, id: 'touch', surfaceRuptured: false, maximumDepth: 0.08 }]), []);
  assert.equal(policy.evaluate([{ ...base, id: 'first', maximumDepth: 0.051 }]).length, 1);
  assert.equal(policy.criticalStabCount, 1);
  assert.equal(policy.evaluate([{ ...base, id: 'first', maximumDepth: 0.12, extracted: true }]).length, 0, 'embedded updates and extraction cannot count again');
  assert.equal(policy.evaluate([{ ...base, id: 'second', regionId: 'neck', maximumDepth: 0.044 }]).length, 0);
  assert.equal(policy.evaluate([{ ...base, id: 'second', regionId: 'neck', maximumDepth: 0.046 }]).length, 1);
  assert.equal(policy.criticalStabCount, 2);
  assert.equal(policy.evaluate([{ ...base, id: 'third', maximumDepth: 0.2 }]).length, 0, 'dying policy locks after the second puncture');
});

test('walker material cloning shares textures but isolates opacity from the idle target', () => {
  const texture = new THREE.Texture();
  const shared = new THREE.MeshStandardMaterial({ map: texture, opacity: 1 });
  const idleMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  const walkerRoot = new THREE.Group();
  const walkerA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  const walkerB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  walkerRoot.add(walkerA, walkerB);
  const clones = isolateObjectMaterials(walkerRoot);
  assert.equal(clones.size, 1);
  assert.notEqual(walkerA.material, shared);
  assert.equal(walkerA.material, walkerB.material);
  assert.equal(walkerA.material.map, texture);
  walkerA.material.transparent = true;
  walkerA.material.opacity = 0.2;
  assert.equal(idleMesh.material.opacity, 1);
  clones.forEach((material) => material.dispose());
  assert.equal(texture.isTexture, true, 'shared cached textures are not disposed with actor-owned materials');
  idleMesh.geometry.dispose();
  walkerA.geometry.dispose();
  walkerB.geometry.dispose();
  shared.dispose();
  texture.dispose();
});

test('two stabs hand off the final pose once, hold three seconds, fade, dispose, and respawn cleanly', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const collision = createCollision();
  const stationary = new HumanoidCombatActor({ physics, scene, visualProfile: MODEL_IDLE_COMBAT_PROFILE });
  collision.addBlocker(stationary.updatePlayerCollisionBlocker({ id: 'stationary-lifecycle' }));
  const stationaryDirector = new CombatDirector({ actor: stationary });
  const router = new CombatActorRouter();
  router.register(stationary, stationaryDirector);
  const player = { position: new THREE.Vector3(0, 1.55, -2.45) };
  const walker = new CombatLabWalkerController({ scene, physics, collision, combatRouter: router, stationaryActor: stationary, playerProvider: () => player });

  for (let cycle = 0; cycle < 3; cycle += 1) {
    if (!walker.actor) walker.prepareFrame(1 / 60, player);
    const actor = walker.actor;
    const visual = installHeadlessVisualStub(actor);
    const oldCollider = actor.colliders.get('upper_chest');
    assert.equal(walker.forceQualifyingStab() != null, true);
    assert.equal(walker.lethality.criticalStabCount, 1);
    assert.equal(actor.ragdollActive, false);
    assert.ok(walker.maximumSpeed <= walker.baseMaximumSpeed * 0.79);
    assert.equal(walker.forceQualifyingStab() != null, true);
    assert.equal(walker.state, WALKER_STATES.dying);
    const collapseSamples = [];
    for (let frame = 0; frame < 180; frame += 1) {
      walker.prepareFrame(1 / 60, player);
      actor.prepareFrame(1 / 60);
      walker.afterAnimationFrame();
      collapseSamples.push(walker.consciousnessLoss.getDiagnostics());
    }
    assert.equal(walker.state, WALKER_STATES.ragdoll);
    assert.equal(walker.ragdollActivationCount, 1);
    assert.ok(collapseSamples.some((sample) => sample.progress > 0.45 && sample.progress < 0.65));
    assert.ok(collapseSamples.at(-1).pelvisDescent > 0.2);
    visual.captured.forEach((position, id) => {
      const current = actor.bodies.get(id).body.translation();
      assert.ok(Math.hypot(current.x - position.x, current.y - position.y, current.z - position.z) < 1e-9, `${id} has no ragdoll teleport`);
    });
    while (walker.ragdollElapsed < COMBAT_LAB_WALKER_CONFIG.corpseHoldSeconds - 1 / 60 - 1e-6) walker.prepareFrame(1 / 60, player);
    assert.equal(walker.state, WALKER_STATES.ragdoll, 'corpse remains fully visible before three seconds');
    assert.equal(walker.fadeOpacity, 1);
    while (walker.state === WALKER_STATES.ragdoll) walker.prepareFrame(1 / 60, player);
    assert.equal(walker.state, WALKER_STATES.fading);
    for (let frame = 0; frame < 61; frame += 1) walker.prepareFrame(1 / 60, player);
    assert.equal(walker.actor, null);
    assert.equal(router.resolveCollider(oldCollider, new THREE.Vector3()), null);
    assert.equal(walker.lastDisposalSummary.remainingRigidBodies, 0);
    assert.equal(walker.lastDisposalSummary.remainingColliders, 0);
    assert.equal(walker.lastDisposalSummary.remainingJoints, 0);
    for (let frame = 0; frame < 20; frame += 1) walker.prepareFrame(1 / 60, player);
    assert.ok(walker.actor, 'fresh walker respawns after bounded separation');
    assert.equal(walker.lethality.criticalStabCount, 0);
    assert.equal(walker.actor.woundSystem.wounds.length, 0);
    assert.equal(walker.fadeOpacity, 1);
    assert.equal(router.getDiagnostics().actorCount, 2);
    assert.equal(physics.world.bodies.len(), 36);
    assert.equal(physics.world.colliders.len(), 36);
    assert.equal(physics.world.impulseJoints.len(), 34);
  }
  walker.dispose();
  stationaryDirector.dispose();
  stationary.dispose();
  router.dispose();
  physics.dispose();
});

test('adapter source preserves mixer, locomotion, pain, wounds, then proxy ordering', () => {
  const source = readFileSync(new URL('../src/game/combat/HumanoidGlbVisualAdapter.js', import.meta.url), 'utf8');
  const mixer = source.indexOf('this.mixer.update(dt)');
  const locomotion = source.indexOf('this.locomotionController?.applyAfterMixer?.(dt)');
  const pain = source.indexOf('this.reactionController?.applyAfterMixer(dt)');
  const wounds = source.indexOf('this.actor.woundSystem?.update?.(dt)');
  const proxies = source.indexOf('this.actor.syncAnimationProxyBodies(this)');
  assert.ok(mixer < locomotion && locomotion < pain && pain < wounds && wounds < proxies);
});

test('semantic proxy synchronization observes the final locomotion-plus-pain pose', () => {
  const calls = [];
  const bone = new THREE.Bone();
  const gaitRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0));
  const painRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.18, 0));
  const expected = gaitRotation.clone().multiply(painRotation);
  const adapter = Object.create(HumanoidGlbVisualAdapter.prototype);
  Object.assign(adapter, {
    mixer: { timeScale: 1, update() { calls.push('mixer'); bone.quaternion.identity(); } },
    presentationRoot: { updateMatrixWorld() { calls.push('matrices'); } },
    reactionController: { getPlaybackScale: () => 1, applyAfterMixer() { calls.push('pain'); bone.quaternion.multiply(painRotation); } },
    locomotionController: { restoreAuthoredPose() { calls.push('restore'); }, applyAfterMixer() { calls.push('locomotion'); bone.quaternion.multiply(gaitRotation); } },
    idlePlaybackScale: 1,
    mixerAuthoredScales: new Map(),
    reactionBones: new Map([['pelvis', bone]]),
    skeletons: [{ update() { calls.push('skeleton'); } }],
    characterLightingPanel: null,
    actor: {
      physiology: { breathInterruption: 0 },
      woundSystem: { update() { calls.push('wounds'); } },
      syncAnimationProxyBodies() {
        calls.push('proxies');
        assert.ok(1 - Math.abs(bone.quaternion.dot(expected)) < 1e-10);
      },
    },
  });
  adapter.updateAnimationAuthority(1 / 60);
  assert.ok(calls.indexOf('mixer') < calls.indexOf('locomotion'));
  assert.ok(calls.indexOf('locomotion') < calls.indexOf('pain'));
  assert.ok(calls.indexOf('pain') < calls.indexOf('wounds'));
  assert.ok(calls.indexOf('wounds') < calls.indexOf('proxies'));
});

test('mid-stride impaired pain pose completes gradual consciousness loss and the real ragdoll solver remains coherent', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  physics.createFixedBox({ position: { x: 0, y: -0.1, z: -2 }, halfExtents: { x: 8, y: 0.1, z: 8 } });
  const scene = new THREE.Scene();
  const collision = createCollision();
  const stationary = new HumanoidCombatActor({ physics, scene, visualProfile: MODEL_IDLE_COMBAT_PROFILE });
  const stationaryDirector = new CombatDirector({ actor: stationary });
  const router = new CombatActorRouter();
  router.register(stationary, stationaryDirector);
  const player = { position: new THREE.Vector3(0, 1.55, -2.45), yaw: THREE.MathUtils.degToRad(41) };
  let synthetic = null;
  const walker = new CombatLabWalkerController({
    scene,
    physics,
    collision,
    combatRouter: router,
    stationaryActor: stationary,
    playerProvider: () => player,
    actorFactory: (options) => {
      const actor = new HumanoidCombatActor(options);
      synthetic = installSyntheticAnimationAdapter(actor);
      return actor;
    },
  });
  const stepFrame = () => {
    walker.prepareFrame(1 / 60, player);
    walker.actor?.prepareFrame(1 / 60);
    walker.afterAnimationFrame();
    physics.stepSingle((dt) => walker.beforePhysics(dt, player.position), (dt) => walker.afterPhysicsStep(dt));
    walker.afterPhysics(0);
  };

  walker.prepareFrame(0, player);
  for (let frame = 0; frame < 85; frame += 1) stepFrame();
  assert.ok(walker.currentSpeed > 0.1);
  assert.ok(Math.abs(walker.currentYaw) > 0.05, 'handoff scenario uses nonzero world yaw');
  assert.ok(walker.locomotion.phase > 0.03 && walker.locomotion.phase < 0.97, 'walker is in a live gait phase');
  walker.forceQualifyingStab();
  for (let frame = 0; frame < 8; frame += 1) stepFrame();
  assert.equal(walker.lethality.criticalStabCount, 1);
  assert.ok(walker.maximumSpeed < walker.baseMaximumSpeed);
  walker.actor.reflex.regionId = 'upper_chest';
  walker.actor.reflex.intensity = 0.62;
  walker.actor.reflex.time = 0.55;
  walker.actor.lastReaction = { regionId: 'upper_chest', direction: new THREE.Vector3(-0.4, 0.05, 0.2), point: walker.actor.getBodyWorldPosition('upper_chest'), severity: 0.8 };
  const preFatalSpeed = walker.currentSpeed;
  const preFatalPelvisY = walker.actor.getBodyWorldPosition('pelvis').y;
  walker.forceQualifyingStab();
  assert.equal(walker.state, WALKER_STATES.losingConsciousness);
  stepFrame();
  assert.ok(walker.currentSpeed > preFatalSpeed * 0.8, 'locomotion weakens rather than stopping in the fatal frame');

  const samples = [];
  let elapsed = 1 / 60;
  while (walker.state !== WALKER_STATES.ragdoll && elapsed < 3.4) {
    stepFrame();
    elapsed += 1 / 60;
    samples.push({ ...walker.consciousnessLoss.getDiagnostics(), speed: walker.currentSpeed, gaitWeight: walker.locomotion.blendWeight });
  }
  assert.equal(walker.state, WALKER_STATES.ragdoll);
  assert.ok(elapsed >= 2.5 && elapsed <= 3.2);
  assert.equal(walker.ragdollActivationCount, 1);
  assert.ok(samples.every((sample, index) => index === 0 || sample.pelvisDescent + 1e-9 >= samples[index - 1].pelvisDescent));
  assert.ok(samples.every((sample, index) => index === 0 || sample.torsoPitch + 1e-9 >= samples[index - 1].torsoPitch));
  assert.ok(samples.every((sample, index) => index === 0 || sample.locomotionWeight <= samples[index - 1].locomotionWeight + 1e-9));
  assert.ok(samples.every((sample, index) => index === 0 || sample.gaitWeight <= samples[index - 1].gaitWeight + 1e-9));
  assert.ok(samples[0].gaitWeight > 0.8 && samples.at(-1).gaitWeight < 0.02, 'actual gait authority decays gradually across the collapse');
  assert.ok(samples.at(-1).pelvisDescent >= 0.09 && samples.at(-1).pelvisDescent <= 0.18);
  assert.ok(samples.at(-1).pelvisDescentTarget >= 0.22 && samples.at(-1).pelvisDescentTarget <= 0.25);
  assert.ok(THREE.MathUtils.radToDeg(samples.at(-1).torsoPitch) >= 20 && THREE.MathUtils.radToDeg(samples.at(-1).torsoPitch) <= 35);
  assert.ok(Math.abs(THREE.MathUtils.radToDeg(samples.at(-1).lateralImbalance)) >= 4 && Math.abs(THREE.MathUtils.radToDeg(samples.at(-1).lateralImbalance)) <= 10);

  const capturedTranslations = new Map(synthetic.adapter.ragdollBindings.filter((binding) => !binding.isTranslationRoot).map((binding) => [binding.bodyId, binding.capturedLocalPosition.clone()]));
  const capturedScales = new Map(synthetic.adapter.ragdollBindings.map((binding) => [binding.bodyId, binding.capturedLocalScale.clone()]));
  for (let frame = 0; frame < 45; frame += 1) {
    physics.stepSingle((dt) => walker.beforePhysics(dt, player.position), (dt) => walker.afterPhysicsStep(dt));
    walker.afterPhysics(0);
  }
  capturedTranslations.forEach((position, bodyId) => assert.ok(position.distanceTo(synthetic.bonesByBodyId.get(bodyId).position) < 1e-9, `${bodyId} preserves captured local translation`));
  capturedScales.forEach((scale, bodyId) => assert.ok(scale.distanceTo(synthetic.bonesByBodyId.get(bodyId).scale) < 1e-9, `${bodyId} preserves captured bone scale`));
  synthetic.bonesByBodyId.forEach((bone, bodyId) => {
    assert.ok(bone.position.toArray().every(Number.isFinite), `${bodyId} position remains finite`);
    assert.ok(bone.quaternion.toArray().every(Number.isFinite), `${bodyId} quaternion remains finite`);
    assert.ok(Math.abs(bone.quaternion.length() - 1) < 1e-6, `${bodyId} quaternion remains normalized`);
  });
  const handoff = walker.actor.ragdollHandoffDiagnostics;
  const ragdoll = synthetic.adapter.ragdollDiagnostics;
  assert.equal(handoff.jointsRebuilt, 17);
  assert.ok(handoff.finalAnimatedPelvisPosition[1] <= preFatalPelvisY - 0.08, 'world-space pelvis position lowers materially before ragdoll');
  assert.equal(walker.actor.joints.filter((joint) => joint.userData?.handoffRebuilt).length, 17);
  assert.ok(handoff.maximumJointAnchorSeparation <= RAGDOLL_HANDOFF_LIMITS.maximumJointAnchorSeparation);
  assert.ok(handoff.maximumBodyPositionJump <= RAGDOLL_HANDOFF_LIMITS.maximumBodyPositionJump, `handoff ${JSON.stringify(handoff)}`);
  assert.ok(handoff.maximumBodyRotationJump <= RAGDOLL_HANDOFF_LIMITS.maximumBodyRotationJumpRadians, `rotation jump ${handoff.maximumBodyRotationJump}`);
  assert.ok(handoff.maximumFirstFrameLinearVelocity <= RAGDOLL_HANDOFF_LIMITS.maximumInheritedLinearSpeed + 0.35);
  assert.ok(handoff.maximumFirstFrameAngularVelocity <= RAGDOLL_HANDOFF_LIMITS.maximumInheritedAngularSpeed + 1e-5, `angular velocity ${handoff.maximumFirstFrameAngularVelocity}`);
  assert.ok(ragdoll.maximumParentChildBoneLengthError < 1e-8);
  assert.equal(ragdoll.nonFiniteTransformCount, 0);
  assert.equal(ragdoll.changedBoneScaleCount, 0);
  assert.equal(ragdoll.activationCount, 1);
  assert.equal(synthetic.adapter.ragdollBindings.length, 18);

  walker.dispose();
  stationaryDirector.dispose();
  stationary.dispose();
  router.dispose();
  physics.dispose();
});
