import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { initializeCombatPhysics, CombatPhysicsWorld } from '../src/game/combat/CombatPhysicsWorld.js';
import { HumanoidCombatActor } from '../src/game/combat/HumanoidCombatActor.js';
import { CombatDirector } from '../src/game/combat/CombatDirector.js';
import { MELEE_INTENTS } from '../src/game/combat/MeleeIntentWeapon.js';
import { weaponProfiles } from '../src/game/equipment/weaponProfiles.js';
import { equipmentRegistry } from '../src/game/equipment/equipmentRegistry.js';
import { KNIFE_RUNTIME_COMBAT_MODE } from '../src/game/combat/WorldKnifeCombatController.js';
import { SWORD_RUNTIME_COMBAT_MODE } from '../src/game/combat/weapons/SwordWorldWeaponController.js';
import { installKnifeWoundManifestForHeadlessTests } from '../src/game/combat/KnifeWoundDecalLibrary.js';
import {
  DREADMACE_ASSET_CORRECTION,
  DREADMACE_CONTACT_PRIMITIVES,
  DREADMACE_DIMENSIONS,
  DREADMACE_GESTURE_THRESHOLDS,
  DREADMACE_GLB_PATH,
  DREADMACE_MAX_SWEEP_SAMPLE_COUNT,
  DREADMACE_READY_QUATERNION,
  DREADMACE_WORLD_WEAPON_CONFIG,
  MACE_GESTURE_STATES,
  MACE_HAMMER_PHASES,
  MACE_VIEWMODEL_LAYER,
  MaceWorldWeaponController,
  applyDreadmaceAssetCorrection,
  computeDreadmaceGesturePower,
  criticallyDampedMaceReturnProgress,
  resolveDreadmaceSweepSampleCount,
  sampleDreadmaceDirectPose,
} from '../src/game/combat/weapons/MaceWorldWeaponController.js';
import {
  BLUNT_IMPACT_CLASSIFICATIONS,
  BLUNT_IMPACT_SCHEMA,
  createBluntImpactInteraction,
  deriveBluntImpactTrauma,
  estimateBluntImpactMetrics,
} from '../src/game/combat/weapons/BluntImpactInteraction.js';

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });
installKnifeWoundManifestForHeadlessTests(JSON.parse(readFileSync(new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url), 'utf8')));

const viewportRect = { left: 0, top: 0, width: 390, height: 700 };

function makeViewport() {
  return {
    querySelector: () => null,
    getBoundingClientRect: () => viewportRect,
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    releasePointerCapture() {},
  };
}

function makeVisualSource() {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x888078, map: new THREE.Texture(), normalMap: new THREE.Texture(), metalnessMap: new THREE.Texture(), roughnessMap: new THREE.Texture(), metalness: 1, roughness: 1 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.69), material);
  mesh.name = 'dreadmace-test-visual';
  root.add(mesh);
  return root;
}

function makeController(overrides = {}) {
  const scene = overrides.scene ?? new THREE.Scene();
  const camera = overrides.camera ?? new THREE.PerspectiveCamera(70, viewportRect.width / viewportRect.height, 0.1, 100);
  camera.position.set(0, 1.55, -2.45);
  camera.updateMatrixWorld(true);
  const equipmentRuntime = overrides.equipmentRuntime ?? { getEquippedWeaponProfile: () => ({ id: 'dreadstone_mace' }), hasItem: () => true };
  return new MaceWorldWeaponController({
    app: overrides.app ?? makeViewport(),
    scene,
    camera,
    equipmentRuntime,
    bindPointerInput: false,
    visualAssetLoader: async () => makeVisualSource(),
    ...overrides,
  });
}

function moveMace(controller, pointerId, deltaX, deltaY, timeMs, dt = 1 / 60) {
  controller.applyGripGesture(pointerId, deltaX, deltaY, 300 + deltaX, 520 + deltaY, timeMs);
  controller.beforePhysics(dt);
}

test('approved Dreadmace GLB parses at authored scale with measured bounds and PBR textures', async () => {
  assert.equal(DREADMACE_GLB_PATH, './assets/weapons/melee/dreadmacev001_mobile_1k.glb');
  const bytes = readFileSync(new URL('../public/assets/weapons/melee/dreadmacev001_mobile_1k.glb', import.meta.url));
  assert.ok(bytes.byteLength > 0);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, new URL('../public/assets/weapons/melee/', import.meta.url).href);
  gltf.scene.updateMatrixWorld(true);
  const meshes = [];
  gltf.scene.traverse((object) => { if (object.isMesh && object.visible) meshes.push(object); });
  assert.equal(meshes.length, 1);
  assert.deepEqual(gltf.scene.scale.toArray(), [1, 1, 1]);
  const bounds = new THREE.Box3().setFromObject(gltf.scene, true);
  const size = bounds.getSize(new THREE.Vector3());
  DREADMACE_DIMENSIONS.measuredSize.forEach((expected, index) => assert.ok(Math.abs(size.getComponent(index) - expected) < 1e-6));
  DREADMACE_DIMENSIONS.boundsMin.forEach((expected, index) => assert.ok(Math.abs(bounds.min.getComponent(index) - expected) < 1e-6));
  DREADMACE_DIMENSIONS.boundsMax.forEach((expected, index) => assert.ok(Math.abs(bounds.max.getComponent(index) - expected) < 1e-6));
  const materials = Array.isArray(meshes[0].material) ? meshes[0].material : [meshes[0].material];
  assert.ok(materials.every((material) => material.map && material.normalMap && material.metalnessMap && material.roughnessMap));
  assert.ok(materials.every((material) => material.transparent === false && material.opacity === 1));
  const controllerSource = readFileSync(new URL('../src/game/combat/weapons/MaceWorldWeaponController.js', import.meta.url), 'utf8');
  assert.doesNotMatch(controllerSource, /buildFallbackVisual|IcosahedronGeometry|CylinderGeometry/, 'runtime never replaces the approved asset with simplified geometry');
});

test('one explicit load-time correction preserves grip origin and imported -Z active axis', () => {
  const root = new THREE.Group();
  root.position.set(3, 4, 5);
  root.scale.setScalar(2);
  applyDreadmaceAssetCorrection(root);
  assert.deepEqual(root.position.toArray(), [0, 0, 0]);
  assert.deepEqual(root.quaternion.toArray(), [0, 0, 0, 1]);
  assert.deepEqual(root.scale.toArray(), [1, 1, 1]);
  assert.equal(root.userData.dreadmaceAssetCorrectionApplied, true);
  const revision = root.matrixWorld.clone();
  applyDreadmaceAssetCorrection(root);
  assert.deepEqual(root.matrixWorld.elements, revision.elements, 'correction is idempotent and never becomes a per-frame rotation');
  assert.equal(DREADMACE_ASSET_CORRECTION.authoredActiveAxis, '+Y');
  assert.equal(DREADMACE_ASSET_CORRECTION.runtimeActiveAxis, '-Z');
});

test('canonical mace ready pose angles the imported -Z head without separating visual and physical ownership', async () => {
  const readyQuaternion = new THREE.Quaternion().fromArray(DREADMACE_READY_QUATERNION);
  assert.ok(readyQuaternion.angleTo(new THREE.Quaternion()) > 0.4, 'ready rotation is intentionally non-identity');
  const readyDirection = new THREE.Vector3(...DREADMACE_DIMENSIONS.runtimeActiveDirection).applyQuaternion(readyQuaternion);
  assert.ok(readyDirection.y > 0.4, 'positive hammer pitch raises the imported -Z active axis');
  assert.ok(readyDirection.dot(new THREE.Vector3(0, 0, -1)) < 0.95, 'head no longer aims straight into the horizon');

  const controller = makeController();
  await controller.visualLoadPromise;
  controller.beforePhysics(1 / 60);
  controller.afterPhysics();
  assert.ok(controller.localQuaternion.angleTo(readyQuaternion) < 1e-12);
  assert.ok(controller.displayedQuaternion.angleTo(controller.actualQuaternion) < 1e-7);
  assert.ok(controller.displayedHeadCenter.distanceTo(controller.currentHeadCenter) < 1e-12);
  assert.equal(controller.getDiagnostics().maceDirectControl.visualPhysicalHeadError, 0);
  controller.dispose();
});

test('deterministic semantic primitives fit the inspected mace and contain no blade contacts', () => {
  assert.deepEqual(Object.keys(DREADMACE_CONTACT_PRIMITIVES), ['mace_head', 'haft', 'grip', 'pommel']);
  assert.equal(DREADMACE_CONTACT_PRIMITIVES.mace_head.kind, 'sphere');
  assert.equal(DREADMACE_CONTACT_PRIMITIVES.haft.kind, 'capsule');
  assert.equal(DREADMACE_CONTACT_PRIMITIVES.grip.effectiveMass, 0);
  assert.ok(DREADMACE_CONTACT_PRIMITIVES.mace_head.effectiveMass > DREADMACE_CONTACT_PRIMITIVES.haft.effectiveMass);
  assert.ok(DREADMACE_CONTACT_PRIMITIVES.mace_head.center[2] < DREADMACE_CONTACT_PRIMITIVES.haft.points[0][2]);
  assert.ok(DREADMACE_CONTACT_PRIMITIVES.pommel.center[2] <= DREADMACE_DIMENSIONS.boundsMax[2]);
  assert.ok(Object.values(DREADMACE_CONTACT_PRIMITIVES).every((primitive) => !['cutting_edge', 'puncture_tip', 'triangle_mesh'].includes(primitive.kind)));
});

test('Dreadmace is an independent right-hand profile awarded by the Folsom courtyard chest', () => {
  assert.equal(weaponProfiles.dreadstone_mace.displayName, 'Dreadmace');
  assert.equal(weaponProfiles.dreadstone_mace.weaponType, 'mace');
  assert.equal(equipmentRegistry.items.dreadstone_mace.slot, 'weapon');
  assert.equal(equipmentRegistry.items.dreadstone_mace.source, 'folsom_courtyard_mace_chest');
  assert.ok(weaponProfiles.old_work_knife == null, 'knife remains a tool rather than being replaced in the weapon registry');
  assert.ok(weaponProfiles.dreadstone_sword);
  const gameSource = readFileSync(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const panelSource = readFileSync(new URL('../src/game/combat/CombatLabDebugPanel.js', import.meta.url), 'utf8');
  const folsomSource = readFileSync(new URL('../src/game/locations/folsom.definition.js', import.meta.url), 'utf8');
  assert.match(gameSource, /combatLabEnabled \? \['dreadstone_sword', 'dreadstone_mace'\]/);
  assert.match(panelSource, /EQUIP MACE/);
  assert.doesNotMatch(panelSource, /KeyD.*dreadstone_mace|dreadstone_mace.*KeyD/);
  assert.match(folsomSource, /folsom_courtyard_mace_chest/);
  assert.match(folsomSource, /itemId: 'dreadstone_mace'/);
});

test('held Dreadmace reaches the unrestricted workspace and visual/physical ownership stays unified', async () => {
  const controller = makeController();
  await controller.visualLoadPromise;
  controller.acquireGrip(1, 300, 520, 0);
  controller.beforePhysics(1 / 60);
  moveMace(controller, 1, -400, 0, 40);
  assert.equal(controller.localGrip.x, DREADMACE_WORLD_WEAPON_CONFIG.workspace.min[0]);
  moveMace(controller, 1, 400, 0, 80);
  assert.equal(controller.localGrip.x, DREADMACE_WORLD_WEAPON_CONFIG.workspace.max[0]);
  moveMace(controller, 1, 0, 400, 120);
  assert.equal(controller.localGrip.y, DREADMACE_WORLD_WEAPON_CONFIG.workspace.min[1]);
  moveMace(controller, 1, 0, -400, 160);
  assert.equal(controller.localGrip.y, DREADMACE_WORLD_WEAPON_CONFIG.workspace.max[1]);
  moveMace(controller, 1, -220, -210, 200, 0.05);
  const diagonalStart = controller.currentHeadCenter.clone();
  moveMace(controller, 1, 180, 100, 250, 0.08);
  const diagonal = controller.currentHeadCenter.clone().sub(diagonalStart);
  assert.ok(diagonal.x > 0.2 && diagonal.y < -0.2, 'diagonal pointer input owns diagonal head motion');
  const heldPose = controller.localGrip.clone();
  for (let frame = 0; frame < 60; frame += 1) controller.beforePhysics(1 / 60);
  assert.ok(controller.localGrip.distanceTo(heldPose) < 1e-12, 'no endpoint pulls a held weapon back toward center');
  controller.afterPhysics();
  const diagnostics = controller.getDiagnostics().maceDirectControl;
  assert.equal(diagnostics.visualPhysicalHeadError, 0);
  assert.deepEqual(diagnostics.localGrip, diagnostics.targetLocalGrip);
  controller.dispose();
});

test('sword impalement cleanup does not alter mace direct-control ownership or tracking', async () => {
  const controller = makeController();
  await controller.visualLoadPromise;
  try {
    assert.equal(controller.acquireGrip(71, 300, 520, 0), true);
    controller.beforePhysics(1 / 60);
    moveMace(controller, 71, 96, -84, 40);
    const heldTarget = controller.targetLocalGrip.clone();
    const heldActual = controller.localGrip.clone();
    const diagnostics = controller.getDiagnostics().maceDirectControl;
    assert.ok(heldActual.distanceTo(heldTarget) < 1e-12);
    assert.equal(diagnostics.positionTrackingError, 0);
    assert.equal(diagnostics.visualPhysicalHeadError, 0);
    assert.equal('cleanupSwordImpalement' in controller, false);
    assert.equal('entryResistanceActive' in controller, false);
  } finally {
    controller.dispose();
  }
});

test('Dreadmace load uses actual upward head travel, speed qualification, and decaying memory', async () => {
  const tiny = makeController();
  await tiny.visualLoadPromise;
  tiny.acquireGrip(1, 300, 520, 0);
  tiny.beforePhysics(1 / 60);
  moveMace(tiny, 1, 0, -56, 50);
  assert.ok(tiny.accumulatedUpwardTravel > 0);
  assert.ok(tiny.loadEnergy < 0.5, 'eight percent of viewport travel cannot guarantee full load');
  const tinyLoad = tiny.loadEnergy;
  moveMace(tiny, 1, 0, -210, 100, 0.05);
  assert.ok(tiny.loadEnergy > tinyLoad);
  assert.ok(tiny.accumulatedUpwardTravel >= DREADMACE_GESTURE_THRESHOLDS.fullLoadTravel);
  const loaded = tiny.loadEnergy;
  for (let frame = 0; frame < 72; frame += 1) tiny.beforePhysics(1 / 60);
  assert.ok(tiny.loadEnergy < loaded, 'stationary holding decays recent load');
  assert.ok(tiny.loadEnergy < DREADMACE_GESTURE_THRESHOLDS.minimumRecentLoadEnergy, 'load is not latched for the pointer hold');
  tiny.dispose();

  const fast = makeController();
  const slow = makeController();
  await Promise.all([fast.visualLoadPromise, slow.visualLoadPromise]);
  for (const [controller, dt] of [[fast, 0.05], [slow, 0.6]]) {
    controller.acquireGrip(2, 300, 520, 0);
    controller.beforePhysics(1 / 60);
    moveMace(controller, 2, 0, -130, 100, dt);
  }
  assert.ok(fast.loadEnergy > slow.loadEnergy, 'actual upward head speed qualifies the same travel differently');
  slow.cancel();
  slow.acquireGrip(3, 300, 520, 200);
  slow.beforePhysics(1 / 60);
  moveMace(slow, 3, 220, 0, 240);
  assert.equal(slow.loadEnergy, 0, 'lateral motion alone cannot load');
  fast.dispose();
  slow.dispose();
});

test('player-authored raises progressively cock the hammer and preserve unrestricted lateral grip placement', async () => {
  const controller = makeController();
  await controller.visualLoadPromise;
  const orientation = DREADMACE_WORLD_WEAPON_CONFIG.hammerOrientation;
  controller.acquireGrip(1, 300, 520, 0);
  controller.beforePhysics(1 / 60);

  const restPitch = controller.hammerPitch;
  moveMace(controller, 1, 0, -20, 40, 0.08);
  const smallPitch = controller.hammerPitch;
  assert.ok(smallPitch > restPitch && smallPitch - restPitch < 0.2, 'small grip raise produces only a small rotation');
  assert.ok(controller.hammerRaiseProgress > 0 && controller.hammerRaiseProgress < 0.2);

  moveMace(controller, 1, 0, -70, 120, 0.18);
  const halfPitch = controller.hammerPitch;
  assert.ok(halfPitch > smallPitch && halfPitch < orientation.topPitch, 'half raise stays intermediate');
  assert.ok(Math.abs(controller.hammerRaiseProgress - 0.5) < 1e-8);

  moveMace(controller, 1, 0, -140, 260, 0.25);
  assert.ok(controller.hammerPitch >= Math.PI * 0.5, 'full raise reaches a hammer-overhead orientation');
  moveMace(controller, 1, 0, -210, 310, 0.05);
  assert.ok(controller.hammerPitch > orientation.topPitch, 'strong complete raise carries over center');
  assert.ok(controller.hammerPitch <= orientation.maximumTopPitch + 1e-12, 'over-center pitch stays bounded');

  const overheadPitch = controller.hammerPitch;
  moveMace(controller, 1, -400, -210, 350, 0.05);
  assert.equal(controller.localGrip.x, DREADMACE_WORLD_WEAPON_CONFIG.workspace.min[0]);
  assert.equal(controller.hammerPitch, overheadPitch);
  moveMace(controller, 1, 400, -210, 390, 0.05);
  assert.equal(controller.localGrip.x, DREADMACE_WORLD_WEAPON_CONFIG.workspace.max[0]);
  assert.equal(controller.hammerPitch, overheadPitch);
  controller.dispose();
});

test('cocked hold keeps overhead rotation independent of load-memory decay and remains laterally responsive', async () => {
  const controller = makeController();
  await controller.visualLoadPromise;
  controller.acquireGrip(1, 300, 520, 0);
  controller.beforePhysics(1 / 60);
  moveMace(controller, 1, 0, -210, 50, 0.05);
  controller.beforePhysics(1 / 60);
  assert.equal(controller.hammerPhase, MACE_HAMMER_PHASES.cocked);
  const cockedPitch = controller.hammerPitch;
  const cockedGripY = controller.localGrip.y;
  const loaded = controller.loadEnergy;
  for (let frame = 0; frame < 90; frame += 1) controller.beforePhysics(1 / 60);
  assert.ok(controller.loadEnergy < loaded);
  assert.ok(controller.loadEnergy < DREADMACE_GESTURE_THRESHOLDS.minimumRecentLoadEnergy);
  assert.equal(controller.hammerPitch, cockedPitch, 'load memory cannot lower a held hammer');
  assert.equal(controller.localGrip.y, cockedGripY);
  moveMace(controller, 1, 120, -210, 1700, 0.05);
  assert.ok(controller.localGrip.x > DREADMACE_WORLD_WEAPON_CONFIG.workspace.ready[0]);
  assert.equal(controller.localGrip.y, cockedGripY, 'cocked pose has no fixed top grip position');
  assert.equal(controller.hammerPitch, cockedPitch);
  controller.dispose();
});

test('left, center, right, and diagonal player-authored downward paths qualify without a canned arc', async () => {
  for (const [label, endX] of [['down-left', -200], ['straight-down', 0], ['down-right', 180], ['diagonal-down', 95]]) {
    const controller = makeController();
    await controller.visualLoadPromise;
    controller.acquireGrip(1, 300, 520, 0);
    controller.beforePhysics(1 / 60);
    moveMace(controller, 1, 0, -210, 50, 0.05);
    const raisedHead = controller.currentHeadCenter.clone();
    moveMace(controller, 1, endX, 100, 100, 0.08);
    const motion = controller.currentHeadCenter.clone().sub(raisedHead);
    assert.equal(controller.hammerPhase, MACE_HAMMER_PHASES.descending, label);
    assert.equal(controller.state, MACE_GESTURE_STATES.striking, label);
    assert.equal(controller.strikeQualified, true, label);
    assert.ok(motion.y < -DREADMACE_GESTURE_THRESHOLDS.minimumDownwardStrikeTravel, label);
    if (endX < 0) assert.ok(motion.x < 0, label);
    if (endX > 0) assert.ok(motion.x > 0, label);
    controller.dispose();
  }
  const source = readFileSync(new URL('../src/game/combat/weapons/MaceWorldWeaponController.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /sampleDreadmaceSmashArc|loadedGrip|finishGrip|loadedEuler|finishEuler/);
  const pose = sampleDreadmaceDirectPose({ aimX: -1, aimY: 1, extension: 0.2 });
  assert.ok([...pose.grip.toArray(), ...pose.quaternion.toArray()].every(Number.isFinite));
});

test('downstroke pitch unwinds from captured top pose by grip travel and reverses upward without a snap', async () => {
  const controller = makeController();
  await controller.visualLoadPromise;
  controller.acquireGrip(1, 300, 520, 0);
  controller.beforePhysics(1 / 60);
  moveMace(controller, 1, 0, -210, 50, 0.05);
  controller.beforePhysics(1 / 60);
  const topPitch = controller.hammerPitch;

  moveMace(controller, 1, 0, -175, 100, 0.08);
  assert.equal(controller.hammerPhase, MACE_HAMMER_PHASES.descending);
  const earlyPitch = controller.hammerPitch;
  const earlyProgress = controller.hammerDownstrokeProgress;
  assert.ok(earlyPitch < topPitch && earlyProgress > 0 && earlyProgress < 0.5);
  moveMace(controller, 1, 0, -140, 150, 0.08);
  const middlePitch = controller.hammerPitch;
  assert.ok(middlePitch < earlyPitch);
  assert.ok(controller.hammerDownstrokeProgress > earlyProgress);
  moveMace(controller, 1, 0, 100, 200, 0.08);
  assert.ok(controller.hammerPitch < middlePitch);
  assert.equal(controller.hammerDownstrokeProgress, 1);
  assert.ok(Math.abs(controller.hammerPitch - DREADMACE_WORLD_WEAPON_CONFIG.hammerOrientation.impactPitch) < 1e-12);

  controller.cancel();
  controller.acquireGrip(2, 300, 520, 300);
  controller.beforePhysics(1 / 60);
  moveMace(controller, 2, 0, -210, 350, 0.05);
  moveMace(controller, 2, 0, -175, 400, 0.08);
  const beforeReverseQuaternion = controller.localQuaternion.clone();
  const beforeReversePitch = controller.hammerPitch;
  moveMace(controller, 2, 0, -190, 450, 0.08);
  assert.equal(controller.hammerPhase, MACE_HAMMER_PHASES.raising);
  assert.ok(controller.hammerPitch >= beforeReversePitch);
  assert.ok(controller.localQuaternion.angleTo(beforeReverseQuaternion) < 0.08, 'upward reversal continues from the exact descending pose');
  assert.ok(controller.swingCommitCount <= 2, 'reversal cannot duplicate a strike token');
  controller.dispose();
});

test('authoritative hammer quaternion supplies angular head velocity to both presentation and swept physics', async () => {
  const controller = makeController();
  await controller.visualLoadPromise;
  controller.acquireGrip(1, 300, 520, 0);
  controller.beforePhysics(1 / 60);
  moveMace(controller, 1, 0, -210, 50, 0.05);
  moveMace(controller, 1, 80, -120, 100, 0.08);
  assert.ok(controller.angularVelocity.length() > 1);
  const expectedAngularContribution = controller.angularVelocity.clone().cross(
    controller.localHeadOffset.clone().applyQuaternion(controller.actualQuaternion),
  );
  const measuredAngularContribution = controller.headCenterVelocity.clone().sub(controller.gripVelocity);
  assert.ok(measuredAngularContribution.distanceTo(expectedAngularContribution) < 1e-9);
  assert.ok(measuredAngularContribution.length() > 0.1, 'visible rotation materially moves the head');
  controller.afterPhysics();
  assert.ok(controller.displayedQuaternion.angleTo(controller.actualQuaternion) < 1e-7);
  assert.ok(controller.displayedHeadCenter.distanceTo(controller.currentHeadCenter) < 1e-12);
  assert.equal(controller.getDiagnostics().maceDirectControl.visualPhysicalHeadError, 0);
  controller.dispose();
});

test('upward, lateral-only, and weak downward mace movement cannot become damaging smash motion', async () => {
  const upward = makeController();
  await upward.visualLoadPromise;
  upward.acquireGrip(1, 300, 520, 0);
  upward.beforePhysics(1 / 60);
  moveMace(upward, 1, 0, -210, 50, 0.05);
  assert.equal(upward.activeStrikeId, null);
  assert.equal(upward.strikeQualified, false);
  upward.dispose();

  const lateral = makeController();
  await lateral.visualLoadPromise;
  lateral.acquireGrip(2, 300, 520, 0);
  lateral.beforePhysics(1 / 60);
  moveMace(lateral, 2, 220, 0, 50, 0.05);
  assert.equal(lateral.activeStrikeId, null);
  lateral.dispose();

  const weak = makeController();
  await weak.visualLoadPromise;
  weak.acquireGrip(3, 300, 520, 0);
  weak.beforePhysics(1 / 60);
  moveMace(weak, 3, 0, -210, 50, 0.05);
  moveMace(weak, 3, 0, -175, 100, 0.12);
  assert.ok(weak.activeStrikeId);
  assert.equal(weak.strikeQualified, false);
  weak.dispose();
});

test('held impact preserves pointer control; only release returns and reacquire captures the displayed pose', async () => {
  const controller = makeController();
  await controller.visualLoadPromise;
  controller.acquireGrip(4, 300, 520, 0);
  controller.beforePhysics(1 / 60);
  moveMace(controller, 4, 0, -210, 50, 0.05);
  moveMace(controller, 4, 100, 100, 100, 0.08);
  assert.equal(controller.state, MACE_GESTURE_STATES.striking);
  for (let frame = 0; frame < 60; frame += 1) controller.beforePhysics(1 / 60);
  assert.notEqual(controller.state, MACE_GESTURE_STATES.returning, 'holding never auto-returns');
  controller.releaseGrip();
  assert.equal(controller.state, MACE_GESTURE_STATES.returning);
  assert.equal(controller.strikeQualified, false, 'safe return cannot damage');
  controller.beforePhysics(0.1);
  const displayedGrip = controller.localGrip.clone();
  const displayedQuaternion = controller.localQuaternion.clone();
  assert.equal(controller.acquireGrip(5, 260, 500, 200), true);
  controller.beforePhysics(0);
  assert.ok(controller.localGrip.distanceTo(displayedGrip) < 1e-12);
  assert.ok(controller.localQuaternion.angleTo(displayedQuaternion) < 1e-12);
  assert.equal(controller.state, MACE_GESTURE_STATES.held);
  controller.releaseGrip();
  assert.equal(controller.config.returnDuration, 0.31);
  const halfAt60 = criticallyDampedMaceReturnProgress(0.155, controller.config.returnDuration);
  const halfAt120 = criticallyDampedMaceReturnProgress(31 / 200, controller.config.returnDuration);
  assert.ok(Math.abs(halfAt60 - halfAt120) < 1e-12);
  controller.beforePhysics(1);
  const readyQuaternion = new THREE.Quaternion().fromArray(DREADMACE_READY_QUATERNION);
  assert.ok(controller.localQuaternion.angleTo(readyQuaternion) < 1e-12);
  assert.ok(controller.localQuaternion.angleTo(new THREE.Quaternion()) > 0.4, 'safe return never targets identity');
  controller.dispose();
});

test('projected lower-handle capsule is forgiving while rejecting head-only, distant, and blocked UI touches', async () => {
  const controller = makeController();
  await controller.visualLoadPromise;
  controller.beforePhysics(1 / 60);
  controller.afterPhysics();
  const grip = controller.projectGrip();
  assert.deepEqual(grip.localSegmentStart, [0, -0.006, 0.14]);
  assert.deepEqual(grip.localSegmentEnd, [0, -0.014, -0.12]);
  assert.equal(grip.radius, 50);
  assert.equal(controller.projectGrabHit(grip.x, grip.y), true, 'mathematical grip origin remains compatible');
  assert.equal(controller.projectGrabHit(grip.segmentStart.x, grip.segmentStart.y), true, 'lower handle is accepted');
  assert.equal(controller.projectGrabHit(grip.segmentEnd.x, grip.segmentEnd.y), true, 'upper usable grip is accepted');

  const segmentX = grip.segmentEnd.x - grip.segmentStart.x;
  const segmentY = grip.segmentEnd.y - grip.segmentStart.y;
  const segmentLength = Math.hypot(segmentX, segmentY);
  const midpointX = (grip.segmentStart.x + grip.segmentEnd.x) * 0.5;
  const midpointY = (grip.segmentStart.y + grip.segmentEnd.y) * 0.5;
  const normalX = -segmentY / segmentLength;
  const normalY = segmentX / segmentLength;
  assert.equal(controller.projectGrabHit(midpointX + normalX * grip.radius * 0.8, midpointY + normalY * grip.radius * 0.8), true, 'near-handle margin is forgiving');
  assert.equal(controller.projectGrabHit(midpointX + normalX * grip.radius * 2, midpointY + normalY * grip.radius * 2), false, 'far touch stays rejected');

  const head = controller.getProjectedActivePoint();
  assert.equal(controller.projectGrabHit(head.x, head.y), false, 'mace-head-only touch cannot acquire the grip');
  const blockedSelectors = [];
  for (const control of ['move', 'look']) {
    controller.pointerDown({
      pointerId: control,
      clientX: grip.x,
      clientY: grip.y,
      timeStamp: 10,
      target: { closest: (selector) => { blockedSelectors.push(selector); return { dataset: { control } }; } },
    });
    assert.equal(controller.gripPointerId, null, `${control} pad blocks weapon acquisition`);
  }
  assert.ok(blockedSelectors.every((selector) => selector.includes('[data-control="move"]') && selector.includes('[data-control="look"]')));
  const diagnostics = controller.getDiagnostics().maceDirectControl;
  assert.deepEqual(diagnostics.projectedGrabSegmentStart, grip.segmentStart);
  assert.deepEqual(diagnostics.projectedGrabSegmentEnd, grip.segmentEnd);
  assert.equal(diagnostics.projectedGrabRadius, grip.radius);
  assert.equal(diagnostics.lastGrabAccepted, false);
  controller.dispose();
});

test('rotational sweep sampling is bounded and earliest semantic contact wins', async () => {
  const collider = { handle: 7 };
  const hit = { actor: null, bodyId: 'upper_chest', regionId: 'upper_chest', region: { id: 'upper_chest' }, body: { linvel: () => ({ x: 0, y: 0, z: 0 }) } };
  const routedActor = { instanceId: 'earliest-actor' };
  hit.actor = routedActor;
  let resolvedPayload = null;
  let resolveCount = 0;
  const director = { resolveBluntImpact: (payload) => {
    resolveCount += 1;
    resolvedPayload = payload;
    return { id: 'blunt-1', result: { bluntImpact: createBluntImpactInteraction({ interactionId: 'blunt-1', primitive: payload.primitive, actorId: routedActor.instanceId, worldPoint: payload.worldPoint, worldNormal: payload.worldNormal, impactDirection: payload.impactDirection, headCenterVelocity: payload.headCenterVelocity, contactCenterVelocity: payload.contactCenterVelocity, actorRelativeVelocity: payload.actorRelativeVelocity, normalImpactSpeed: payload.normalImpactSpeed, tangentialSpeed: payload.tangentialSpeed, effectiveMass: payload.effectiveMass, estimatedImpulse: payload.estimatedImpulse, estimatedEnergy: payload.estimatedEnergy, loadProgress: payload.loadProgress, gesturePower: payload.gesturePower, impactRadiusEstimate: payload.impactRadiusEstimate, classification: payload.classification }) } };
  } };
  const combatRouter = { ownsCollider: () => true, resolveCollider: () => ({ actor: routedActor, director, hit }) };
  const physics = {
    prepareWeaponSweepBatch: () => true,
    castWeaponTip: (_from, _to, radius) => {
      if (radius === DREADMACE_CONTACT_PRIMITIVES.haft.radius) return { collider, time_of_impact: 0.82, normal1: { x: 0, y: 0, z: 1 }, witness1: { x: 0, y: 1.8, z: -3.5 } };
      if (radius === DREADMACE_CONTACT_PRIMITIVES.mace_head.radius) return { collider, time_of_impact: 0.18, normal1: { x: 0, y: 0, z: 1 }, witness1: { x: 0, y: 2, z: -3.5 } };
      return null;
    },
  };
  const controller = makeController({ physics, combatRouter });
  await controller.visualLoadPromise;
  controller.acquireGrip('test-owner', 300, 520, 0);
  controller.state = MACE_GESTURE_STATES.striking;
  controller.activeStrikeId = 'dreadmace-strike-test';
  controller.strikeOwnerId = 'test-owner';
  controller.strikeQualified = true;
  controller.swingPower = 0.9;
  controller.loadEnergy = 1;
  controller.previousGrip.set(0, 1.8, -3);
  controller.actualGrip.copy(controller.previousGrip);
  controller.previousQuaternion.identity();
  controller.actualQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * 0.5);
  controller.gripVelocity.set(0, -2.5, -5.5);
  controller.angularVelocity.set(0, 0, 0);
  controller.headCenterVelocity.set(0, -2.5, -5.5);
  assert.equal(controller.resolveSmashContact(), true);
  assert.equal(resolvedPayload.primitive, 'mace_head', 'the head must be the earliest valid damaging primitive');
  assert.equal(controller.resolveSmashContact(), false, 'continued overlap cannot resolve the same actor twice in one swing');
  assert.equal(resolveCount, 1);
  assert.equal(controller.rejectedRepeatContactCount, 1);
  assert.equal(controller.feedbackCount, 1);
  assert.equal(controller.gripPointerId, 'test-owner', 'solid contact preserves thumb ownership');
  assert.equal(controller.state, MACE_GESTURE_STATES.impactResistance);
  assert.ok(controller.lastSweepSampleCount > 2);
  assert.ok(controller.lastSweepSampleCount <= DREADMACE_MAX_SWEEP_SAMPLE_COUNT);
  assert.equal(resolveDreadmaceSweepSampleCount({ translationDistance: 8, angularDistance: Math.PI, leverArm: 0.7, radius: 0.01 }), DREADMACE_MAX_SWEEP_SAMPLE_COUNT);
  controller.dispose();
});

test('a meaningful raise rearms one new strike token while resting and vibration do not', async () => {
  const controller = makeController();
  await controller.visualLoadPromise;
  controller.acquireGrip(1, 300, 520, 0);
  controller.beforePhysics(1 / 60);
  moveMace(controller, 1, 0, -210, 50, 0.05);
  moveMace(controller, 1, 80, 100, 100, 0.08);
  const firstStrike = controller.activeStrikeId;
  assert.ok(firstStrike);
  moveMace(controller, 1, 81, 99, 130, 1 / 60);
  assert.equal(controller.activeStrikeId, firstStrike, 'small vibration cannot mint another strike');
  controller.beforePhysics(0.1);
  assert.equal(controller.activeStrikeId, firstStrike, 'resting contact state cannot rearm itself');
  moveMace(controller, 1, 80, -210, 200, 0.05);
  assert.equal(controller.activeStrikeId, null, 'meaningful actual upward travel rearms');
  moveMace(controller, 1, -90, 100, 260, 0.08);
  assert.ok(controller.activeStrikeId);
  assert.notEqual(controller.activeStrikeId, firstStrike);
  assert.equal(controller.swingCommitCount, 2);
  controller.dispose();
});

test('head, haft, grip, and glancing contacts produce sharply differentiated blunt trauma', () => {
  const normal = new THREE.Vector3(0, 0, 1);
  const velocity = new THREE.Vector3(0, 0, -6);
  const makeImpact = (primitive, mass, contactVelocity = velocity) => {
    const metrics = estimateBluntImpactMetrics({ headCenterVelocity: velocity, contactCenterVelocity: contactVelocity, worldNormal: normal, effectiveMass: mass, primitive, loadProgress: 1, gesturePower: 1 });
    return { ...metrics, primitive, loadProgress: 1, gesturePower: 1 };
  };
  const head = makeImpact('mace_head', DREADMACE_CONTACT_PRIMITIVES.mace_head.effectiveMass);
  const haft = makeImpact('haft', DREADMACE_CONTACT_PRIMITIVES.haft.effectiveMass);
  const grip = makeImpact('grip', 0);
  const glance = makeImpact('mace_head', DREADMACE_CONTACT_PRIMITIVES.mace_head.effectiveMass, new THREE.Vector3(5.7, 0, -0.6));
  const weak = makeImpact('mace_head', DREADMACE_CONTACT_PRIMITIVES.mace_head.effectiveMass, new THREE.Vector3(0, 0, -0.35));
  const region = { id: 'skull' };
  const headTrauma = deriveBluntImpactTrauma({ impact: head, region }).trauma;
  const haftTrauma = deriveBluntImpactTrauma({ impact: haft, region }).trauma;
  const gripTrauma = deriveBluntImpactTrauma({ impact: grip, region }).trauma;
  const glanceTrauma = deriveBluntImpactTrauma({ impact: glance, region }).trauma;
  assert.equal(head.classification, BLUNT_IMPACT_CLASSIFICATIONS.heavySmash);
  assert.equal(haft.classification, BLUNT_IMPACT_CLASSIFICATIONS.haftContact);
  assert.equal(grip.classification, BLUNT_IMPACT_CLASSIFICATIONS.nonDamagingContact);
  assert.equal(glance.classification, BLUNT_IMPACT_CLASSIFICATIONS.glancingBlunt);
  assert.equal(weak.classification, BLUNT_IMPACT_CLASSIFICATIONS.glancingBlunt);
  assert.ok(headTrauma > haftTrauma * 10);
  assert.equal(gripTrauma, 0);
  assert.ok(glanceTrauma < headTrauma * 0.1);
});

test('one swing owns one actor damage, reaction, feedback, sound, and camera response', async () => {
  const actor = {
    instanceId: 'single-shot-actor', lifeState: 'alive', visualAdapter: null, physiology: null,
    applyBluntImpact: () => ({ accepted: true, damageApplied: 1.2, reactionEmitted: true, collapseRequested: false }),
    triggerReflexCalls: 0,
    triggerReflex() { this.triggerReflexCalls += 1; },
  };
  const feedbackSystem = { audio: 0, haptic: 0, emitAudio() { this.audio += 1; return true; }, emitCombatHaptic() { this.haptic += 1; return true; } };
  const cameraFeedback = { count: 0, shake() { this.count += 1; } };
  const director = new CombatDirector({ actor, feedbackSystem, cameraFeedback });
  const point = new THREE.Vector3(0, 2, -3.5);
  const intent = { weaponId: 'dreadstone_mace', intent: MELEE_INTENTS.smash, ownerId: 'swing-1', speed: 6, intentional: true, damaging: true };
  const interaction = director.resolveBluntImpact({ weapon: { id: 'dreadstone_mace', family: 'mace' }, intent, hit: { actor, bodyId: 'head', regionId: 'skull', region: { id: 'skull' } }, primitive: 'mace_head', worldPoint: point, worldNormal: new THREE.Vector3(0, 0, 1), impactDirection: new THREE.Vector3(0, 0, -1), headCenterVelocity: new THREE.Vector3(0, 0, -6), contactCenterVelocity: new THREE.Vector3(0, 0, -6), actorRelativeVelocity: new THREE.Vector3(0, 0, -6), normalImpactSpeed: 6, tangentialSpeed: 0, effectiveMass: 5.4, estimatedImpulse: 32.4, estimatedEnergy: 97.2, loadProgress: 1, gesturePower: 1, impactRadiusEstimate: 0.11, classification: 'heavy_smash' });
  assert.ok(interaction);
  director.update(0.12);
  assert.equal(actor.triggerReflexCalls, 1);
  assert.equal(feedbackSystem.audio, 1);
  assert.equal(feedbackSystem.haptic, 1);
  assert.equal(cameraFeedback.count, 1);
  assert.equal(interaction.result.bluntImpact.actorDamageApplied, 1.2);
  assert.equal(interaction.result.bluntImpact.reactionEmitted, true);
  assert.equal(director.eventLog.filter((event) => event.type === 'blood').length, 0);
  director.dispose();
});

test('strong skull impact yields a finite deformation-ready record without deformation or detachment', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const actor = new HumanoidCombatActor({ physics, scene });
  const director = new CombatDirector({ actor });
  const collider = actor.colliders.get('head');
  const center = actor.getBodyWorldPosition('head');
  const point = center.clone().add(new THREE.Vector3(0, 0, 0.15));
  const hit = actor.resolveHit(collider, point);
  const intent = { weaponId: 'dreadstone_mace', intent: MELEE_INTENTS.smash, ownerId: 'head-smash', speed: 6.2, intentional: true, damaging: true };
  const interaction = director.resolveBluntImpact({ weapon: { id: 'dreadstone_mace', family: 'mace' }, intent, hit, primitive: 'mace_head', worldPoint: point, worldNormal: new THREE.Vector3(0, 0, 1), impactDirection: new THREE.Vector3(0, 0, -1), headCenterVelocity: new THREE.Vector3(0, 0, -6.2), contactCenterVelocity: new THREE.Vector3(0, 0, -6.2), actorRelativeVelocity: new THREE.Vector3(0, 0, -6.2), normalImpactSpeed: 6.2, tangentialSpeed: 0, effectiveMass: 5.4, estimatedImpulse: 33.48, estimatedEnergy: 103.788, loadProgress: 1, gesturePower: 1, impactRadiusEstimate: 0.11, classification: 'heavy_smash' });
  director.update(0.12);
  const record = interaction.result.bluntImpact;
  assert.equal(record.schema, BLUNT_IMPACT_SCHEMA);
  assert.ok(record.completedAt != null);
  assert.ok([...record.worldPoint.toArray(), ...record.worldNormal.toArray(), record.impactRadiusEstimate, record.estimatedEnergy, record.estimatedImpulse].every(Number.isFinite));
  assert.equal(actor.lastBluntImpact.deformationFootprint.skullOrHead, true);
  assert.equal(actor.lastBluntImpact.deformationApplied, false);
  assert.equal(actor.lastBluntImpact.detachmentApplied, false);
  assert.equal(actor.detachedSemanticBodyIds.size, 0);
  assert.equal(actor.fatalSegmentDetachmentActive, false);
  director.dispose();
  actor.dispose();
  physics.dispose();
});

test('reset/disposal clears gesture state and registrations while preserving existing weapon regressions', async () => {
  const lighting = { registered: 0, unregistered: 0, registerOrdinaryObject() { this.registered += 1; return { status: 'registered', registered: true, eligibleMaterialCount: 1 }; }, unregisterOrdinaryObject() { this.unregistered += 1; } };
  const scene = new THREE.Scene();
  const controller = makeController({ scene, outdoorLightingDirector: lighting });
  await controller.visualLoadPromise;
  controller.acquireGrip(1, 300, 520, 0);
  controller.applyGripGesture(1, 0, -70, 300, 450, 80);
  controller.reset();
  assert.equal(controller.state, MACE_GESTURE_STATES.ready);
  assert.equal(controller.activeStrikeId, null);
  assert.equal(controller.lastBluntImpactRecord, null);
  assert.equal(controller.isEquipped(), true, 'reset preserves equipment ownership');
  const visual = controller.visual;
  controller.dispose();
  assert.equal(visual.parent, null);
  assert.equal(lighting.registered, 1);
  assert.equal(lighting.unregistered, 1);
  assert.equal(KNIFE_RUNTIME_COMBAT_MODE, 'puncture_only');
  assert.equal(SWORD_RUNTIME_COMBAT_MODE, 'puncture_only');
  const panelSource = readFileSync(new URL('../src/game/combat/CombatLabDebugPanel.js', import.meta.url), 'utf8');
  assert.match(panelSource, /KeyJ/);
  assert.match(panelSource, /KeyK/);
  assert.match(panelSource, /KeyL/);
});

test('free Dreadmace stays opaque on the shared viewmodel render layer', async () => {
  const controller = makeController();
  await controller.visualLoadPromise;
  const meshes = [];
  controller.visual.traverse((object) => { if (object.isMesh) meshes.push(object); });
  assert.ok(meshes.length > 0);
  assert.ok(meshes.every((mesh) => mesh.layers.mask === 1 << MACE_VIEWMODEL_LAYER));
  assert.ok(meshes.every((mesh) => mesh.renderOrder === 10027));
  assert.ok(controller.visualMaterials.every((material) => material.transparent === false && material.opacity === 1 && material.depthWrite === true));
  assert.ok(controller.visualMaterials.every((material) => material.map && material.normalMap && material.metalnessMap && material.roughnessMap));
  controller.dispose();
});
