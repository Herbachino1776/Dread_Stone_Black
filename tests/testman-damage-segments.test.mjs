import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CombatPhysicsWorld, initializeCombatPhysics } from '../src/game/combat/CombatPhysicsWorld.js';
import { HumanoidCombatActor } from '../src/game/combat/HumanoidCombatActor.js';
import { COMBAT_MORTALITY_MODES } from '../src/game/combat/CombatMortality.js';
import { HumanoidDamageSegmentRuntime, validateDamageAsset } from '../src/game/combat/HumanoidDamageSegmentRuntime.js';
import { TESTMAN_COMBAT_PROFILE, TESTMAN_DAMAGE_COMBAT_PROFILE, getHumanoidProfileScale } from '../src/game/combat/HumanoidModelProfiles.js';
import { KNIFE_RUNTIME_COMBAT_MODE } from '../src/game/combat/WorldKnifeCombatController.js';
import { SWORD_RUNTIME_COMBAT_MODE } from '../src/game/combat/weapons/SwordWorldWeaponController.js';
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
    requestFatalSegmentDetachment() { this.mortalityCount += 1; return true; },
    emitDetachmentBlood() { this.bloodCount += 1; return true; },
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

test('damage GLB has the approved rig, skinned intact pieces, rigid head, parenting, and clips', () => {
  const json = parseGlbJson(readFileSync(glbUrl));
  const parentByNode = new Map();
  json.nodes.forEach((node, index) => (node.children ?? []).forEach((child) => parentByNode.set(child, index)));
  const byName = new Map(json.nodes.map((node, index) => [node.name, { node, index }]));
  assert.ok(byName.has('DSB_DAMAGE_RIG'));
  for (const name of ['DSB_BODY_CORE', 'DSB_ATTACHED_HEAD', 'DSB_STUMP_NECK_TORSO']) assert.ok(Number.isInteger(byName.get(name).node.skin), `${name} must be skinned`);
  assert.equal(byName.get('DSB_SEGMENT_HEAD').node.skin, undefined);
  assert.equal(json.nodes[parentByNode.get(byName.get('DSB_STUMP_NECK_HEAD').index)].name, 'DSB_SEGMENT_HEAD');
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

test('damage profile remains Combat Lab-only while puncture-only weapon modes stay locked', () => {
  assert.equal(TESTMAN_COMBAT_PROFILE.assetPath, './assets/enemies/testman/testman_animpack_v002.glb');
  assert.equal(TESTMAN_DAMAGE_COMBAT_PROFILE.assetPath, './assets/enemies/testman/damage/testman_damage_v001.glb');
  assert.notEqual(TESTMAN_DAMAGE_COMBAT_PROFILE, TESTMAN_COMBAT_PROFILE);
  assert.deepEqual(TESTMAN_DAMAGE_COMBAT_PROFILE.activeDamageSegmentIds, ['head_neck']);
  assert.equal(KNIFE_RUNTIME_COMBAT_MODE, 'puncture_only');
  assert.equal(SWORD_RUNTIME_COMBAT_MODE, 'puncture_only');
});
