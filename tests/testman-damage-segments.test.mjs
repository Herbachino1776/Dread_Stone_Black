import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CombatPhysicsWorld, initializeCombatPhysics } from '../src/game/combat/CombatPhysicsWorld.js';
import { HumanoidCombatActor } from '../src/game/combat/HumanoidCombatActor.js';
import { COMBAT_MORTALITY_MODES } from '../src/game/combat/CombatMortality.js';
import { CombatLabScene } from '../src/game/combat/CombatLabScene.js';
import { ACTIVE_DAMAGE_SEGMENT_CONTRACTS, HumanoidDamageSegmentRuntime, validateDamageAsset } from '../src/game/combat/HumanoidDamageSegmentRuntime.js';
import { TESTMAN_COMBAT_PROFILE, TESTMAN_DAMAGE_COMBAT_PROFILE, getHumanoidProfileScale } from '../src/game/combat/HumanoidModelProfiles.js';
import { KNIFE_RUNTIME_COMBAT_MODE } from '../src/game/combat/WorldKnifeCombatController.js';
import { SWORD_RELEASE_EXTRACTION_DURATION, SWORD_RUNTIME_COMBAT_MODE } from '../src/game/combat/weapons/SwordWorldWeaponController.js';
import { installKnifeWoundManifestForHeadlessTests } from '../src/game/combat/KnifeWoundDecalLibrary.js';

const glbUrl = new URL('../public/assets/enemies/testman/damage/testman_damage_v001.glb', import.meta.url);
const manifestUrl = new URL('../public/assets/enemies/testman/damage/testman_damage_v001.json', import.meta.url);
const validationUrl = new URL('../public/assets/enemies/testman/damage/testman_damage_v001_validation.json', import.meta.url);
const animationManifestUrl = new URL('../public/assets/enemies/testman/damage/testman_damage_v001_animpack.json', import.meta.url);
const damageManifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
const validationReport = JSON.parse(readFileSync(validationUrl, 'utf8'));
const animationManifest = JSON.parse(readFileSync(animationManifestUrl, 'utf8'));
installKnifeWoundManifestForHeadlessTests(JSON.parse(readFileSync(new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url), 'utf8')));

globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class ProgressEvent { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

function parseGlbJson(buffer) {
  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'JSON') return JSON.parse(buffer.toString('utf8', offset + 8, offset + 8 + length).replace(/\u0000+$/, ''));
    offset += 8 + length;
  }
  throw new Error('GLB JSON chunk was not found');
}

async function loadDamageGltf() {
  const bytes = readFileSync(glbUrl);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new GLTFLoader().parseAsync(buffer, new URL('../public/assets/enemies/testman/damage/', import.meta.url).href);
}

async function createRuntimeFixture({ livingVelocity = new THREE.Vector3() } = {}) {
  await initializeCombatPhysics();
  const gltf = await loadDamageGltf();
  const physics = new CombatPhysicsWorld();
  const hostScene = new THREE.Scene();
  const presentationRoot = new THREE.Group();
  hostScene.add(presentationRoot);
  presentationRoot.add(gltf.scene);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations.find((clip) => clip.name === 'DSB_Walk_NORMAL_v001')).play();
  mixer.update(0);
  gltf.scene.scale.setScalar(getHumanoidProfileScale(TESTMAN_DAMAGE_COMBAT_PROFILE));
  presentationRoot.updateMatrixWorld(true);
  gltf.scene.traverse((object) => object.skeleton?.update?.());
  const actor = {
    physics,
    scene: hostScene,
    livingVelocity: livingVelocity.clone(),
    mortalityCount: 0,
    bloodCount: 0,
    nonfatalCount: 0,
    reactionCount: 0,
    lifeState: 'alive',
    detachedSemanticBodyIds: new Set(),
    requestFatalSegmentDetachment() {
      if (this.lifeState === 'dying' || this.lifeState === 'dead') return false;
      this.mortalityCount += 1;
      return true;
    },
    emitDetachmentBlood() { this.bloodCount += 1; return true; },
    disableDetachedSemanticBodies(bodyIds) { bodyIds.forEach((bodyId) => this.detachedSemanticBodyIds.add(bodyId)); },
    restoreDetachedSemanticBodies(bodyIds) { bodyIds.forEach((bodyId) => this.detachedSemanticBodyIds.delete(bodyId)); },
    getSemanticBodyVelocity(_bodyIds, target = new THREE.Vector3()) { return target.set(0, 0, 0); },
    applyNonfatalSegmentDetachment() { this.nonfatalCount += 1; this.reactionCount += 1; return { accepted: true, reactionTriggered: true }; },
  };
  const adapter = {
    profile: TESTMAN_DAMAGE_COMBAT_PROFILE,
    loadedClips: gltf.animations,
    animationManifest,
    presentationRoot,
    prepareVisibleSurfaceFrame() {
      presentationRoot.updateMatrixWorld(true);
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((object) => object.skeleton?.update?.());
      return true;
    },
  };
  const runtime = new HumanoidDamageSegmentRuntime({ actor, adapter, loadedGlbRoot: gltf.scene, damageManifest, physicsWorld: physics, hostScene });
  const dispose = () => { runtime.dispose(); physics.dispose(); };
  return { gltf, physics, hostScene, presentationRoot, actor, adapter, mixer, runtime, dispose };
}

function detach(runtime, overrides = {}) {
  return runtime.requestDetachment({
    segmentId: 'head_neck',
    cause: 'combat_lab_debug',
    impulse: new THREE.Vector3(0.35, 1.05, 0.3),
    angularImpulse: new THREE.Vector3(0.18, 0.32, -0.24),
    ...overrides,
  });
}

function detachSegment(runtime, segmentId, overrides = {}) {
  const side = segmentId === 'left_elbow' ? -1 : 1;
  return runtime.requestDetachment({
    segmentId,
    cause: 'combat_lab_debug',
    impulse: new THREE.Vector3(0.22 * side, -0.08, 0.18),
    angularImpulse: new THREE.Vector3(0.08, 0.12 * side, -0.16 * side),
    ...overrides,
  });
}

test('damage GLB has the approved rig, skinned intact pieces, rigid head, parenting, and clips', () => {
  const json = parseGlbJson(readFileSync(glbUrl));
  const parentByNode = new Map();
  json.nodes.forEach((node, index) => (node.children ?? []).forEach((child) => parentByNode.set(child, index)));
  const byName = new Map(json.nodes.map((node, index) => [node.name, { node, index }]));
  assert.ok(byName.has('DSB_DAMAGE_RIG'));
  for (const name of ['DSB_BODY_CORE', 'DSB_ATTACHED_HEAD', 'DSB_STUMP_NECK_TORSO']) assert.ok(Number.isInteger(byName.get(name).node.skin), `${name} must be skinned`);
  assert.equal(byName.get('DSB_SEGMENT_HEAD').node.skin, undefined);
  assert.equal(json.nodes[parentByNode.get(byName.get('DSB_STUMP_NECK_HEAD').index)].name, 'DSB_SEGMENT_HEAD');
  for (const side of ['L', 'R']) {
    const attached = byName.get(`DSB_ATTACHED_FOREARM_${side}`);
    const detached = byName.get(`DSB_SEGMENT_FOREARM_${side}`);
    const proximal = byName.get(`DSB_STUMP_ELBOW_${side}_UPPER`);
    const distal = byName.get(`DSB_STUMP_ELBOW_${side}_LOWER`);
    assert.ok(Number.isInteger(attached.node.skin), `${side} attached forearm must be skinned`);
    assert.ok(Number.isInteger(proximal.node.skin), `${side} proximal elbow stump must be skinned`);
    assert.equal(detached.node.skin, undefined, `${side} detached forearm must be rigid`);
    assert.equal(json.nodes[parentByNode.get(distal.index)].name, detached.node.name);
    const attachedPrimitive = json.meshes[attached.node.mesh].primitives[0];
    const detachedPrimitive = json.meshes[detached.node.mesh].primitives[0];
    assert.equal(json.accessors[detachedPrimitive.attributes.POSITION].count, json.accessors[attachedPrimitive.attributes.POSITION].count, `${side} rigid forearm retains the complete forearm-and-hand exterior`);
    assert.equal(json.accessors[detachedPrimitive.indices].count, json.accessors[attachedPrimitive.indices].count, `${side} rigid forearm retains the authored wrist/hand topology`);
  }
  assert.deepEqual(json.animations.map((animation) => animation.name).sort(), [...TESTMAN_DAMAGE_COMBAT_PROFILE.damageExpectedAnimationNames].sort());
});

test('damage and animation manifests resolve exact approved metadata and validation PASS', async () => {
  const fixture = await createRuntimeFixture();
  try {
    const resolved = validateDamageAsset({ manifest: damageManifest, root: fixture.gltf.scene, profile: TESTMAN_DAMAGE_COMBAT_PROFILE, clips: fixture.gltf.animations, animationManifest });
    assert.equal(damageManifest.schema, 'dreadstone.damage_authoring.v1');
    assert.equal(resolved.headSegment.detachedMassHint, 4.5);
    assert.equal(resolved.headSegment.colliderHint, 'convex_hull');
    assert.equal(resolved.headSegment.fatal, true);
    for (const segmentId of ['left_elbow', 'right_elbow']) {
      const segment = resolved.segments.get(segmentId);
      const contract = ACTIVE_DAMAGE_SEGMENT_CONTRACTS[segmentId];
      for (const key of ['attachedObject', 'detachedObject', 'proximalStump', 'distalStump', 'parentRegion', 'bone', 'fatal', 'detachedMassHint', 'colliderHint']) assert.equal(segment[key], contract[key], `${segmentId} ${key}`);
    }
    assert.equal(damageManifest.source.topologyFingerprint, validationReport.source_topology_sha256);
    assert.equal(damageManifest.source.weightFingerprint, validationReport.source_weight_sha256);
    assert.equal(validationReport.status, 'PASS');
    assert.equal(validationReport.authoring_version, '3.8.0');
    assert.equal(validationReport.authoring_build_id, '2026-07-15.segment-stump.3');
    assert.equal(validationReport.generated_object_count, 19);
    assert.deepEqual(validationReport.errors, []);
    assert.deepEqual(validationReport.warnings, []);
    const startupBounds = new THREE.Box3().makeEmpty();
    fixture.gltf.scene.traverse((object) => { if (object.isSkinnedMesh) startupBounds.union(new THREE.Box3().setFromObject(object, true)); });
    const unscaledHeight = startupBounds.getSize(new THREE.Vector3()).y / getHumanoidProfileScale(TESTMAN_DAMAGE_COMBAT_PROFILE);
    assert.ok(Math.abs(unscaledHeight - TESTMAN_DAMAGE_COMBAT_PROFILE.rawHeight) < 1e-6);
  } finally { fixture.dispose(); }
});

test('damage runtime explicitly enforces the intact startup contract', async () => {
  const fixture = await createRuntimeFixture();
  try {
    const diagnostics = fixture.runtime.getDiagnostics();
    assert.equal(fixture.gltf.scene.getObjectByName('DSB_BODY_CORE').visible, true);
    assert.equal(diagnostics.attachedHeadVisible, true);
    assert.equal(diagnostics.torsoStumpVisible, false);
    assert.equal(diagnostics.detachedHeadVisible, false);
    assert.equal(diagnostics.detachedHeadStumpVisible, false);
    assert.equal(diagnostics.perSegment.left_elbow.attachedVisible, true);
    assert.equal(diagnostics.perSegment.right_elbow.attachedVisible, true);
    assert.equal(diagnostics.perSegment.left_elbow.proximalStumpVisible, false);
    assert.equal(diagnostics.perSegment.right_elbow.proximalStumpVisible, false);
    for (const name of ['DSB_SEGMENT_FOREARM_L', 'DSB_SEGMENT_FOREARM_R', 'DSB_SEGMENT_UPPER_BODY', 'DSB_SEGMENT_LOWER_BODY', 'DSB_STUMP_WAIST_UPPER', 'DSB_STUMP_WAIST_LOWER']) assert.equal(fixture.gltf.scene.getObjectByName(name).visible, false, `${name} must start hidden`);
    assert.equal(fixture.runtime.getDamageAssetDiagnostics().intactStateValid, true);
  } finally { fixture.dispose(); }
});

test('detached head captures a non-rest animated head transform within tolerance', async () => {
  const fixture = await createRuntimeFixture();
  try {
    const restPosition = fixture.gltf.scene.getObjectByName('DSB_SEGMENT_HEAD').getWorldPosition(new THREE.Vector3());
    fixture.mixer.stopAllAction();
    fixture.mixer.clipAction(fixture.gltf.animations.find((clip) => clip.name === 'DSB_Hurt_LEFT_Flank_v001')).reset().play();
    fixture.mixer.update(0.3);
    fixture.adapter.prepareVisibleSurfaceFrame();
    fixture.runtime.captureAnimatedMotion(0.3);
    const result = detach(fixture.runtime);
    const diagnostics = fixture.runtime.getDiagnostics();
    const spawnPosition = new THREE.Vector3().fromArray(diagnostics.detachedHeadPosition);
    assert.equal(result.accepted, true);
    assert.ok(diagnostics.spawnPositionError <= 0.005, `position error ${diagnostics.spawnPositionError}`);
    assert.ok(diagnostics.spawnRotationErrorDegrees <= 2, `rotation error ${diagnostics.spawnRotationErrorDegrees}`);
    assert.ok(spawnPosition.distanceTo(restPosition) > 0.02, 'detachment must not reuse the rigid head rest-pose position');
  } finally { fixture.dispose(); }
});

test('head detachment performs one atomic visibility swap', async () => {
  const fixture = await createRuntimeFixture();
  try {
    detach(fixture.runtime);
    const diagnostics = fixture.runtime.getDiagnostics();
    assert.equal(diagnostics.attachedHeadVisible, false);
    assert.equal(diagnostics.torsoStumpVisible, true);
    assert.equal(diagnostics.detachedHeadVisible, true);
    assert.equal(diagnostics.detachedHeadStumpVisible, true);
    assert.equal(fixture.gltf.scene.getObjectByName('DSB_BODY_CORE').visible, true);
    assert.equal(fixture.gltf.scene.getObjectByName('DSB_ATTACHED_FOREARM_L').visible, true);
    assert.equal(fixture.gltf.scene.getObjectByName('DSB_ATTACHED_FOREARM_R').visible, true);
  } finally { fixture.dispose(); }
});

for (const segmentId of ['left_elbow', 'right_elbow']) {
  test(`${segmentId} captures the exact current animated forearm-and-hand transform`, async (context) => {
    const fixture = await createRuntimeFixture();
    try {
      const state = fixture.runtime.segmentStates.get(segmentId);
      const restPosition = state.detachedObject.getWorldPosition(new THREE.Vector3());
      fixture.mixer.stopAllAction();
      fixture.mixer.clipAction(fixture.gltf.animations.find((clip) => clip.name === (segmentId === 'left_elbow' ? 'DSB_Hurt_LEFT_Flank_v001' : 'DSB_Hurt_RIGHT_Flank_v001'))).reset().play();
      fixture.mixer.update(0.3);
      fixture.adapter.prepareVisibleSurfaceFrame();
      fixture.runtime.captureAnimatedMotion(0.3);
      const expectedMatrix = state.bone.matrixWorld.clone().multiply(state.boneToDetached);
      const expectedPosition = new THREE.Vector3();
      const expectedQuaternion = new THREE.Quaternion();
      expectedMatrix.decompose(expectedPosition, expectedQuaternion, new THREE.Vector3());
      const result = detachSegment(fixture.runtime, segmentId);
      const diagnostics = fixture.runtime.getDiagnostics().perSegment[segmentId];
      const actualPosition = state.detachedObject.getWorldPosition(new THREE.Vector3());
      const actualQuaternion = state.detachedObject.getWorldQuaternion(new THREE.Quaternion());
      assert.equal(result.accepted, true);
      assert.ok(diagnostics.spawnPositionError <= 0.005, `position error ${diagnostics.spawnPositionError}`);
      assert.ok(diagnostics.spawnRotationErrorDegrees <= 2, `rotation error ${diagnostics.spawnRotationErrorDegrees}`);
      context.diagnostic(`${segmentId} spawn error ${diagnostics.spawnPositionError.toFixed(9)} m / ${diagnostics.spawnRotationErrorDegrees.toFixed(6)} deg`);
      assert.ok(actualPosition.distanceTo(expectedPosition) <= 0.005);
      assert.ok(THREE.MathUtils.radToDeg(actualQuaternion.angleTo(expectedQuaternion)) <= 2);
      assert.ok(actualPosition.distanceTo(restPosition) > 0.005, 'the detached forearm must not spawn from its rigid rest pose');
      assert.equal(state.distalStump.parent, state.detachedObject);
      assert.equal(state.detachedObject.geometry.attributes.position.count, state.attachedObject.geometry.attributes.position.count, 'the detached prop includes the complete authored hand exterior');
    } finally { fixture.dispose(); }
  });
}

test('left and right forearm visibility swaps are atomic and independent', async () => {
  const fixture = await createRuntimeFixture();
  try {
    detachSegment(fixture.runtime, 'left_elbow');
    let diagnostics = fixture.runtime.getDiagnostics();
    assert.deepEqual({
      attached: diagnostics.perSegment.left_elbow.attachedVisible,
      proximal: diagnostics.perSegment.left_elbow.proximalStumpVisible,
      detached: diagnostics.perSegment.left_elbow.detachedVisible,
      distal: diagnostics.perSegment.left_elbow.distalStumpVisible,
    }, { attached: false, proximal: true, detached: true, distal: true });
    assert.equal(diagnostics.perSegment.right_elbow.attachedVisible, true);
    assert.equal(diagnostics.perSegment.right_elbow.detachedVisible, false);
    assert.equal(diagnostics.perSegment.head_neck.attachedVisible, true);
    assert.equal(fixture.gltf.scene.getObjectByName('DSB_BODY_CORE').visible, true);
    assert.equal(fixture.gltf.scene.getObjectByName('DSB_SEGMENT_UPPER_BODY').visible, false);
    detachSegment(fixture.runtime, 'right_elbow');
    diagnostics = fixture.runtime.getDiagnostics();
    assert.equal(diagnostics.perSegment.left_elbow.detached, true);
    assert.deepEqual({
      attached: diagnostics.perSegment.right_elbow.attachedVisible,
      proximal: diagnostics.perSegment.right_elbow.proximalStumpVisible,
      detached: diagnostics.perSegment.right_elbow.detachedVisible,
      distal: diagnostics.perSegment.right_elbow.distalStumpVisible,
    }, { attached: false, proximal: true, detached: true, distal: true });
    assert.equal(diagnostics.perSegment.head_neck.detached, false);
  } finally { fixture.dispose(); }
});

test('proximal elbow stumps remain skinned, opaque, shadowed, and animation-owned after detachment', async () => {
  const fixture = await createRuntimeFixture();
  try {
    detachSegment(fixture.runtime, 'left_elbow');
    const state = fixture.runtime.segmentStates.get('left_elbow');
    const before = new THREE.Box3().setFromObject(state.proximalStump, true).getCenter(new THREE.Vector3());
    fixture.mixer.stopAllAction();
    fixture.mixer.clipAction(fixture.gltf.animations.find((clip) => clip.name === 'DSB_Death_ChestHold_LEFT_v001')).reset().play();
    fixture.mixer.update(0.45);
    fixture.adapter.prepareVisibleSurfaceFrame();
    const after = new THREE.Box3().setFromObject(state.proximalStump, true).getCenter(new THREE.Vector3());
    assert.equal(state.proximalStump.isSkinnedMesh, true);
    assert.equal(state.proximalStump.visible, true);
    assert.equal(state.proximalStump.castShadow, true);
    assert.equal(state.proximalStump.receiveShadow, true);
    const materials = Array.isArray(state.proximalStump.material) ? state.proximalStump.material : [state.proximalStump.material];
    assert.equal(materials.every((material) => material.opacity === 1 && material.transparent === false), true);
    assert.ok(after.distanceTo(before) > 1e-5, 'the upper-arm stump continues following authored animation');
    assert.equal(state.detachedObject.visible, true);
    assert.equal(state.body != null, true);
  } finally { fixture.dispose(); }
});

test('detached head owns one finite convex-hull physics piece and follows Rapier', async () => {
  const fixture = await createRuntimeFixture({ livingVelocity: new THREE.Vector3(0.42, 0, 0) });
  try {
    detach(fixture.runtime);
    let diagnostics = fixture.runtime.getDiagnostics();
    assert.equal(diagnostics.detachedRigidBodyCount, 1);
    assert.equal(diagnostics.detachedColliderCount, 1);
    assert.equal(diagnostics.colliderTypeUsed, 'convex_hull');
    assert.equal(diagnostics.detachedMass, 4.5);
    assert.ok(diagnostics.detachedHeadPosition.every(Number.isFinite));
    assert.ok(diagnostics.detachedHeadQuaternion.every(Number.isFinite));
    assert.ok(diagnostics.inheritedLinearSpeed > 0.4);
    const before = new THREE.Vector3().fromArray(diagnostics.detachedHeadPosition);
    fixture.physics.stepSingle();
    fixture.runtime.updateAfterPhysics();
    diagnostics = fixture.runtime.getDiagnostics();
    const bodyPosition = new THREE.Vector3().fromArray(diagnostics.detachedHeadPosition);
    const visualPosition = fixture.runtime.detachedHead.getWorldPosition(new THREE.Vector3());
    assert.ok(bodyPosition.distanceTo(before) > 1e-5);
    assert.ok(visualPosition.distanceTo(bodyPosition) < 1e-6);
  } finally { fixture.dispose(); }
});

for (const segmentId of ['left_elbow', 'right_elbow']) {
  test(`${segmentId} owns one 1.8kg bounded physics piece and follows Rapier`, async () => {
    const fixture = await createRuntimeFixture({ livingVelocity: new THREE.Vector3(0.25, 0, 0.1) });
    try {
      detachSegment(fixture.runtime, segmentId);
      let diagnostics = fixture.runtime.getDiagnostics();
      let segment = diagnostics.perSegment[segmentId];
      assert.equal(diagnostics.detachedRigidBodyCount, 1);
      assert.equal(diagnostics.detachedColliderCount, 1);
      assert.ok(['convex_hull', 'box-fallback'].includes(segment.colliderType));
      assert.equal(segment.fallbackColliderUsed, segment.colliderType !== 'convex_hull');
      assert.ok(Math.abs(segment.detachedMass - 1.8) < 1e-5);
      assert.ok(segment.position.every(Number.isFinite));
      assert.ok(segment.quaternion.every(Number.isFinite));
      assert.ok(Number.isFinite(segment.inheritedLinearSpeed));
      assert.ok(Number.isFinite(segment.inheritedAngularSpeed));
      const before = new THREE.Vector3().fromArray(segment.position);
      fixture.physics.stepSingle();
      fixture.runtime.updateAfterPhysics();
      diagnostics = fixture.runtime.getDiagnostics();
      segment = diagnostics.perSegment[segmentId];
      const bodyPosition = new THREE.Vector3().fromArray(segment.position);
      const visualPosition = fixture.runtime.segmentStates.get(segmentId).detachedObject.getWorldPosition(new THREE.Vector3());
      assert.ok(bodyPosition.distanceTo(before) > 1e-6);
      assert.ok(visualPosition.distanceTo(bodyPosition) < 1e-6);
    } finally { fixture.dispose(); }
  });
}

test('detachment ownership is single-shot for body, mortality, and blood', async () => {
  const fixture = await createRuntimeFixture();
  try {
    const first = detach(fixture.runtime);
    const second = detach(fixture.runtime);
    const third = detach(fixture.runtime);
    const diagnostics = fixture.runtime.getDiagnostics();
    assert.equal(first.accepted, true);
    assert.equal(second.accepted, false);
    assert.equal(second.reason, 'already-detached');
    assert.equal(third.reason, 'already-detached');
    assert.equal(diagnostics.acceptedCount, 1);
    assert.equal(diagnostics.rejectedDuplicateCount, 2);
    assert.equal(diagnostics.detachedRigidBodyCount, 1);
    assert.equal(diagnostics.mortalityActivationCount, 1);
    assert.equal(diagnostics.bloodActivationCount, 1);
    assert.equal(fixture.actor.mortalityCount, 1);
    assert.equal(fixture.actor.bloodCount, 1);
    assert.equal(diagnostics.detachedWoundTransferImplemented, false);
  } finally { fixture.dispose(); }
});

test('head and forearm detachment stay physical during dying without a second mortality transition', async () => {
  const headFixture = await createRuntimeFixture();
  try {
    headFixture.actor.lifeState = 'dying';
    const result = detach(headFixture.runtime);
    const diagnostics = headFixture.runtime.getDiagnostics();
    assert.equal(result.accepted, true);
    assert.equal(result.mortalityTriggered, false);
    assert.equal(headFixture.actor.lifeState, 'dying');
    assert.equal(headFixture.actor.mortalityCount, 0);
    assert.equal(headFixture.actor.bloodCount, 1);
    assert.equal(diagnostics.detachedRigidBodyCount, 1);
    assert.equal(diagnostics.mortalityActivationCount, 0);
  } finally { headFixture.dispose(); }

  const armFixture = await createRuntimeFixture();
  try {
    armFixture.actor.lifeState = 'dying';
    const result = detachSegment(armFixture.runtime, 'left_elbow');
    assert.equal(result.accepted, true);
    assert.equal(result.fatal, false);
    assert.equal(result.mortalityTriggered, false);
    assert.equal(armFixture.actor.lifeState, 'dying');
    assert.equal(armFixture.actor.mortalityCount, 0);
    assert.equal(armFixture.actor.nonfatalCount, 1);
  } finally { armFixture.dispose(); }
});

test('forearm requests are independently single-shot, nonfatal, and consequence-bounded', async () => {
  const fixture = await createRuntimeFixture();
  try {
    const firstLeft = detachSegment(fixture.runtime, 'left_elbow');
    const duplicateLeft = detachSegment(fixture.runtime, 'left_elbow');
    const right = detachSegment(fixture.runtime, 'right_elbow');
    const diagnostics = fixture.runtime.getDiagnostics();
    assert.deepEqual({ accepted: firstLeft.accepted, fatal: firstLeft.fatal, mortality: firstLeft.mortalityTriggered, reaction: firstLeft.reactionTriggered }, { accepted: true, fatal: false, mortality: false, reaction: true });
    assert.equal(duplicateLeft.accepted, false);
    assert.equal(duplicateLeft.reason, 'already-detached');
    assert.equal(right.accepted, true);
    assert.equal(fixture.actor.lifeState, 'alive');
    assert.equal(fixture.actor.mortalityCount, 0);
    assert.equal(fixture.actor.nonfatalCount, 2);
    assert.equal(fixture.actor.reactionCount, 2);
    assert.equal(fixture.actor.bloodCount, 2);
    assert.equal(diagnostics.acceptedCount, 2);
    assert.equal(diagnostics.rejectedDuplicateCount, 1);
    assert.equal(diagnostics.detachedRigidBodyCount, 2);
    assert.equal(diagnostics.detachedColliderCount, 2);
    assert.equal(diagnostics.nonfatalConsequenceCount, 2);
    assert.equal(diagnostics.perSegment.left_elbow.bloodActivationCount, 1);
    assert.equal(diagnostics.perSegment.left_elbow.consequenceActivationCount, 1);
    assert.deepEqual(new Set(diagnostics.disabledProxyBodyIds), new Set(['left_forearm', 'left_hand', 'right_forearm', 'right_hand']));
  } finally { fixture.dispose(); }
});

test('head and forearm detachments coexist in either order without deleting existing props', async () => {
  for (const sequence of [
    ['left_elbow', 'head_neck'],
    ['head_neck', 'right_elbow'],
    ['left_elbow', 'right_elbow', 'head_neck'],
  ]) {
    const fixture = await createRuntimeFixture();
    try {
      sequence.forEach((segmentId) => segmentId === 'head_neck' ? detach(fixture.runtime) : detachSegment(fixture.runtime, segmentId));
      const diagnostics = fixture.runtime.getDiagnostics();
      assert.deepEqual(new Set(diagnostics.detachedSegments), new Set(sequence));
      assert.equal(diagnostics.detachedRigidBodyCount, sequence.length);
      assert.equal(diagnostics.detachedColliderCount, sequence.length);
      sequence.forEach((segmentId) => {
        assert.equal(diagnostics.perSegment[segmentId].detachedVisible, true);
        assert.equal(diagnostics.perSegment[segmentId].rigidBodyCreated, true);
      });
      assert.equal(fixture.actor.mortalityCount, sequence.includes('head_neck') ? 1 : 0);
    } finally { fixture.dispose(); }
  }
});

test('inactive waist and unknown segment requests reject cleanly', async () => {
  const fixture = await createRuntimeFixture();
  try {
    for (const segmentId of ['lower_spine', 'unknown_segment']) {
      const result = detachSegment(fixture.runtime, segmentId);
      assert.equal(result.accepted, false);
      assert.equal(result.reason, 'unsupported-segment');
    }
    assert.equal(fixture.runtime.getDiagnostics().detachedRigidBodyCount, 0);
  } finally { fixture.dispose(); }
});

test('reset removes detached physics, restores intact state, and re-arms detachment', async () => {
  const fixture = await createRuntimeFixture();
  try {
    const authoredParent = fixture.runtime.authoredDetachedParent;
    detach(fixture.runtime);
    fixture.runtime.reset();
    let diagnostics = fixture.runtime.getDiagnostics();
    assert.equal(diagnostics.detachedRigidBodyCount, 0);
    assert.equal(diagnostics.detachedColliderCount, 0);
    assert.equal(diagnostics.headDetached, false);
    assert.equal(diagnostics.attachedHeadVisible, true);
    assert.equal(diagnostics.torsoStumpVisible, false);
    assert.equal(fixture.runtime.detachedHead.parent, authoredParent);
    assert.equal(fixture.physics.world.bodies.len(), 0);
    assert.equal(fixture.physics.world.colliders.len(), 0);
    assert.equal(detach(fixture.runtime).accepted, true);
    diagnostics = fixture.runtime.getDiagnostics();
    assert.equal(diagnostics.acceptedCount, 1);
  } finally { fixture.dispose(); }
});

test('reset restores head and both forearms, clears all physics, and re-arms every segment', async () => {
  const fixture = await createRuntimeFixture();
  try {
    detach(fixture.runtime);
    detachSegment(fixture.runtime, 'left_elbow');
    detachSegment(fixture.runtime, 'right_elbow');
    fixture.runtime.reset();
    let diagnostics = fixture.runtime.getDiagnostics();
    assert.equal(diagnostics.detachedRigidBodyCount, 0);
    assert.equal(diagnostics.detachedColliderCount, 0);
    assert.deepEqual(diagnostics.detachedSegments, []);
    assert.deepEqual(diagnostics.disabledProxyBodyIds, []);
    assert.equal(fixture.physics.world.bodies.len(), 0);
    assert.equal(fixture.physics.world.colliders.len(), 0);
    for (const segmentId of ['head_neck', 'left_elbow', 'right_elbow']) {
      const segment = diagnostics.perSegment[segmentId];
      assert.equal(segment.attachedVisible, true);
      assert.equal(segment.proximalStumpVisible, false);
      assert.equal(segment.detachedVisible, false);
      assert.equal(segment.distalStumpVisible, false);
      assert.equal((segmentId === 'head_neck' ? detach(fixture.runtime) : detachSegment(fixture.runtime, segmentId)).accepted, true);
      fixture.runtime.reset();
      diagnostics = fixture.runtime.getDiagnostics();
    }
  } finally { fixture.dispose(); }
});

test('fatal segment detachment bypasses immortal recovery exactly once and actor reset restores life', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const actor = new HumanoidCombatActor({ physics, scene: new THREE.Scene(), mortalityMode: COMBAT_MORTALITY_MODES.immortalReactive });
  try {
    assert.equal(actor.requestFatalSegmentDetachment({ segmentId: 'head_neck', cause: 'combat_lab_debug' }), true);
    assert.equal(actor.requestFatalSegmentDetachment({ segmentId: 'head_neck', cause: 'combat_lab_debug' }), false);
    assert.equal(actor.lifeState, 'dying');
    assert.equal(actor.fatalSegmentDetachmentActivationCount, 1);
    actor.beforePhysics(0.25);
    assert.equal(actor.lifeState, 'dead');
    actor.reset();
    assert.equal(actor.lifeState, 'alive');
    assert.equal(actor.fatalSegmentDetachmentActive, false);
    assert.equal(actor.fatalSegmentDetachmentActivationCount, 0);
  } finally { actor.dispose(); physics.dispose(); }
});

test('detached forearm proxy colliders, hit routing, motors, and wound visuals disable reversibly', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const painEvents = [];
  const actor = new HumanoidCombatActor({ physics, scene: new THREE.Scene(), eventSink: (event) => { if (event === 'pain_vocal') painEvents.push(event); } });
  try {
    const leftIds = ['left_forearm', 'left_hand'];
    const rightIds = ['right_forearm', 'right_hand'];
    const leftCollider = actor.colliders.get('left_forearm');
    const rightCollider = actor.colliders.get('right_forearm');
    const leftPoint = actor.getBodyWorldPosition('left_forearm');
    const rightPoint = actor.getBodyWorldPosition('right_forearm');
    assert.ok(actor.resolveHit(leftCollider, leftPoint));
    assert.ok(actor.resolveHit(rightCollider, rightPoint));
    const slot = actor.woundSystem.visualSlots[0];
    slot.woundId = 'retained-left-wound';
    slot.puncture.visible = true;
    const retainedWound = { id: 'retained-left-wound', bodyId: 'left_forearm', visualSlot: slot, swordVisualSlot: null, surfaceBinding: null, slashSamples: [], slashPathPoints: [] };
    actor.woundSystem.wounds.push(retainedWound);
    actor.disableDetachedSemanticBodies(leftIds);
    assert.equal(leftCollider.isEnabled(), false);
    assert.equal(actor.resolveHit(leftCollider, leftPoint), null);
    assert.ok(actor.resolveHit(rightCollider, rightPoint), 'the opposite arm remains routable');
    assert.equal(slot.puncture.visible, false);
    assert.equal(retainedWound.detachmentVisualSuppressed, true);
    assert.equal(actor.woundSystem.wounds.includes(retainedWound), true, 'wound ownership is retained');
    const consequence = actor.applyNonfatalSegmentDetachment({ segmentId: 'left_elbow', worldPoint: leftPoint, direction: new THREE.Vector3(-1, 0, 0), detachedBodyIds: leftIds });
    assert.equal(consequence.accepted, true);
    assert.equal(actor.lifeState, 'alive');
    assert.equal(actor.regionState.get('left_forearm').structural, 1.5);
    assert.equal(actor.regionState.get('left_hand').motorWeakness, 1);
    assert.deepEqual(new Set(actor.detachedMotorBodyIds), new Set(leftIds));
    assert.equal(painEvents.length, 1);
    assert.equal(actor.applyNonfatalSegmentDetachment({ segmentId: 'left_elbow', detachedBodyIds: leftIds }).accepted, false);
    assert.equal(painEvents.length, 1);
    actor.restoreDetachedSemanticBodies(leftIds);
    assert.equal(leftCollider.isEnabled(), true);
    assert.ok(actor.resolveHit(leftCollider, leftPoint));
    actor.disableDetachedSemanticBodies(rightIds);
    assert.equal(actor.resolveHit(rightCollider, rightPoint), null);
    assert.ok(actor.resolveHit(leftCollider, leftPoint));
    assert.equal(actor.applyNonfatalSegmentDetachment({ segmentId: 'right_elbow', worldPoint: rightPoint, direction: new THREE.Vector3(1, 0, 0), detachedBodyIds: rightIds }).accepted, true);
    assert.equal(actor.lifeState, 'alive');
    assert.equal(actor.nonfatalSegmentConsequenceCount, 2);
    assert.equal(painEvents.length, 2);
    actor.reset();
    const resetLeftCollider = actor.colliders.get('left_forearm');
    assert.equal(resetLeftCollider.isEnabled(), true);
    assert.ok(actor.resolveHit(resetLeftCollider, actor.getBodyWorldPosition('left_forearm')));
    assert.deepEqual([...actor.detachedSemanticBodyIds], []);
    assert.deepEqual([...actor.detachedMotorBodyIds], []);
    assert.equal(actor.nonfatalSegmentConsequenceCount, 0);
  } finally { actor.dispose(); physics.dispose(); }
});

test('Combat Lab debug controls route J, K, and L through generic actor detachment requests', () => {
  const panelSource = readFileSync(new URL('../src/game/combat/CombatLabDebugPanel.js', import.meta.url), 'utf8');
  const sceneSource = readFileSync(new URL('../src/game/combat/CombatLabScene.js', import.meta.url), 'utf8');
  assert.match(panelSource, /event\.code === 'KeyJ'\) this\.dungeon\?\.debugDecapitate/);
  assert.match(panelSource, /event\.code === 'KeyK'\) this\.dungeon\?\.debugDetachLeftForearm/);
  assert.match(panelSource, /event\.code === 'KeyL'\) this\.dungeon\?\.debugDetachRightForearm/);
  assert.match(panelSource, /event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey \|\| event\.shiftKey/);
  assert.match(panelSource, /this\.dungeon\?\.disposed/);
  assert.match(sceneSource, /debugDetachLeftForearm\(\) \{ return this\.debugDetachForearm\('left_elbow', -1\); \}/);
  assert.match(sceneSource, /debugDetachRightForearm\(\) \{ return this\.debugDetachForearm\('right_elbow', 1\); \}/);
  assert.doesNotMatch(sceneSource, /DSB_ATTACHED_FOREARM|DSB_SEGMENT_FOREARM|DSB_STUMP_ELBOW/);
});

test('Combat Lab scene methods forward head and side-aware forearm requests through the actor API', () => {
  const requests = [];
  const lab = Object.create(CombatLabScene.prototype);
  lab.disposed = false;
  lab.actor = {
    visualRootYaw: 0,
    getDetachmentWorldPoint(segmentId, target) { return target.set(segmentId === 'left_elbow' ? -0.4 : segmentId === 'right_elbow' ? 0.4 : 0, 1.4, 0); },
    requestDetachment(request) { requests.push(request); return { accepted: true, segmentId: request.segmentId }; },
  };
  assert.equal(lab.debugDecapitate().segmentId, 'head_neck');
  assert.equal(lab.debugDetachLeftForearm().segmentId, 'left_elbow');
  assert.equal(lab.debugDetachRightForearm().segmentId, 'right_elbow');
  assert.equal(requests[1].impulse.x < 0, true);
  assert.equal(requests[2].impulse.x > 0, true);
  assert.equal(requests[1].impulse.y < 0, true);
  assert.equal(requests[2].impulse.y < 0, true);
  assert.equal(requests.every((request) => request.cause === 'combat_lab_debug'), true);
});

test('damage profile is validated for Combat Lab and Folsom while puncture-only weapon modes stay locked', () => {
  assert.equal(TESTMAN_COMBAT_PROFILE.assetPath, './assets/enemies/testman/testman_animpack_v002.glb');
  assert.equal(TESTMAN_DAMAGE_COMBAT_PROFILE.assetPath, './assets/enemies/testman/damage/testman_damage_v001.glb');
  assert.notEqual(TESTMAN_DAMAGE_COMBAT_PROFILE, TESTMAN_COMBAT_PROFILE);
  assert.deepEqual(TESTMAN_DAMAGE_COMBAT_PROFILE.activeDamageSegmentIds, ['head_neck', 'left_elbow', 'right_elbow']);
  assert.equal(KNIFE_RUNTIME_COMBAT_MODE, 'puncture_only');
  assert.equal(SWORD_RUNTIME_COMBAT_MODE, 'puncture_only');
  assert.equal(SWORD_RELEASE_EXTRACTION_DURATION, 0.15);
  assert.equal(TESTMAN_DAMAGE_COMBAT_PROFILE.activeDamageSegmentIds.includes('lower_spine'), false);
  const walkerSource = readFileSync(new URL('../src/game/combat/CombatLabWalkerController.js', import.meta.url), 'utf8');
  assert.match(walkerSource, /visualProfile: TESTMAN_COMBAT_PROFILE/);
  const folsomSource = readFileSync(new URL('../src/game/combat/FolsomCombatEncounter.js', import.meta.url), 'utf8');
  assert.match(folsomSource, /this\.modelProfile = TESTMAN_DAMAGE_COMBAT_PROFILE/);
  assert.match(folsomSource, /createDamageProfileActor/);
  for (const relativePath of ['../src/game/combat/WorldKnifeCombatController.js', '../src/game/combat/weapons/SwordWorldWeaponController.js']) {
    const weaponSource = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    assert.doesNotMatch(weaponSource, /requestDetachment|debugDetach|activeDamageSegmentIds/, `${relativePath} must not trigger structural detachment`);
  }
  const showcaseSource = readFileSync(new URL('../src/game/combat/FolsomShowcaseSwordDismemberment.js', import.meta.url), 'utf8');
  assert.match(showcaseSource, /cause: 'folsom_showcase_sword_sweep'/);
  assert.match(showcaseSource, /actor\.requestDetachment/);
});
