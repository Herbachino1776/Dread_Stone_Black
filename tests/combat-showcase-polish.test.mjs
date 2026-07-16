import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  FOLSOM_PIERCING_LETHALITY_CONFIG,
  WalkerVitalStabPolicy,
  isAcceptedPiercingWound,
} from '../src/game/combat/CombatLabWalkerController.js';
import {
  isFolsomCombatActorContactable,
  isFolsomCombatActorLiving,
} from '../src/game/combat/FolsomCombatEncounter.js';
import { WorldKnifeCombatController } from '../src/game/combat/WorldKnifeCombatController.js';
import { SwordWorldWeaponController } from '../src/game/combat/weapons/SwordWorldWeaponController.js';
import { MaceWorldWeaponController } from '../src/game/combat/weapons/MaceWorldWeaponController.js';
import { createWeaponViewmodelAnchor, disposeWeaponViewmodelAnchor } from '../src/game/combat/weapons/WeaponViewmodelAnchor.js';

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

function makeVisualSource(name = 'weapon-test-mesh') {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.8 }));
  mesh.name = name;
  root.add(mesh);
  return root;
}

function makeEquipmentRuntime(itemId) {
  return {
    getEquippedToolId: () => itemId,
    getEquippedWeaponProfile: () => ({ id: itemId }),
    hasItem: (candidate) => candidate === itemId,
  };
}

function makePresentationHarness(Controller, itemId) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, viewportRect.width / viewportRect.height, 0.1, 100);
  camera.name = `${itemId}-gameplay-camera`;
  camera.position.set(0.7, 1.6, -2.4);
  camera.rotation.set(-0.12, 0.24, 0.03);
  scene.add(camera);
  camera.updateMatrixWorld(true);
  const viewmodelAnchor = createWeaponViewmodelAnchor(camera);
  const controller = new Controller({
    app: makeViewport(),
    scene,
    camera,
    viewmodelAnchor,
    equipmentRuntime: makeEquipmentRuntime(itemId),
    bindPointerInput: false,
    visualAssetLoader: async () => makeVisualSource(`${itemId}-mesh`),
  });
  return { scene, camera, viewmodelAnchor, controller };
}

const swordWound = (id, regionId, maximumDepth, overrides = {}) => ({
  id,
  interactionKind: 'sword_thrust',
  weaponId: 'dreadstone_sword',
  weaponFamily: 'sword',
  deliberateStab: true,
  surfaceRuptured: true,
  regionId,
  maximumDepth,
  targetLifeStateAtCreation: 'alive',
  targetWasDeadAtCreation: false,
  ...overrides,
});

const knifeWound = (id, regionId, maximumDepth, overrides = {}) => ({
  id,
  interactionKind: 'puncture',
  weaponId: 'old_work_knife',
  weaponFamily: 'knife',
  deliberateStab: true,
  surfaceRuptured: true,
  regionId,
  maximumDepth,
  targetLifeStateAtCreation: 'alive',
  targetWasDeadAtCreation: false,
  ...overrides,
});

test('shared piercing classification accepts knife punctures and sword thrusts with one-wound upgrade credit', () => {
  assert.equal(isAcceptedPiercingWound(knifeWound('knife', 'upper_chest', 0.05)), true);
  assert.equal(isAcceptedPiercingWound(swordWound('sword', 'neck', 0.065)), true);
  assert.equal(isAcceptedPiercingWound(swordWound('slash', 'neck', 0.2, { interactionKind: 'slash' })), false);
  assert.equal(isAcceptedPiercingWound(swordWound('limb', 'left_forearm', 0.2)), false);
  assert.equal(isAcceptedPiercingWound(swordWound('dead', 'neck', 0.2, { targetLifeStateAtCreation: 'dead', targetWasDeadAtCreation: true })), false);
  assert.equal(new WalkerVitalStabPolicy().resolveQualifyingWeight(swordWound('unknown-weapon', 'neck', 0.2, { weaponId: 'unknown', weaponFamily: null })), 0);

  const policy = new WalkerVitalStabPolicy();
  const wound = swordWound('upgrade-once', 'upper_chest', 0.075);
  assert.equal(policy.evaluate([wound]).length, 1);
  assert.equal(policy.criticalStabCount, 1);
  assert.equal(policy.evaluate([wound]).length, 0, 'the same depth cannot add credit again');
  wound.maximumDepth = 0.125;
  assert.equal(policy.evaluate([wound]).length, 1, 'the wound can upgrade from good to decisive');
  assert.equal(policy.criticalStabCount, 2, 'the decisive upgrade adds only the positive one-credit difference');
  assert.equal(policy.getDiagnostics().qualifyingWoundWeights['upgrade-once'], 2);
});

test('Folsom sword thresholds make shallow and limb contacts safe while good and decisive vital wounds kill', () => {
  assert.deepEqual(FOLSOM_PIERCING_LETHALITY_CONFIG.sword.qualifyingDepthByRegion, {
    head: 0.065, face: 0.065, skull: 0.065, neck: 0.065,
    upper_chest: 0.075, lower_chest: 0.075, abdomen: 0.085,
  });
  assert.deepEqual(FOLSOM_PIERCING_LETHALITY_CONFIG.sword.decisiveDepthByRegion, {
    head: 0.1, face: 0.1, skull: 0.1, neck: 0.1,
    upper_chest: 0.125, lower_chest: 0.125, abdomen: Number.POSITIVE_INFINITY,
  });

  const ordinary = new WalkerVitalStabPolicy();
  assert.equal(ordinary.evaluate([swordWound('shallow', 'upper_chest', 0.074)]).length, 0);
  assert.equal(ordinary.evaluate([swordWound('limb', 'left_forearm', 0.3)]).length, 0);
  ordinary.evaluate([swordWound('good-one', 'upper_chest', 0.08)]);
  assert.equal(ordinary.criticalStabCount, 1);
  ordinary.evaluate([swordWound('good-two', 'lower_chest', 0.08)]);
  assert.equal(ordinary.locked, true);

  for (const [regionId, depth] of [['neck', 0.1], ['head', 0.1], ['upper_chest', 0.125]]) {
    const decisive = new WalkerVitalStabPolicy();
    decisive.evaluate([swordWound(`decisive-${regionId}`, regionId, depth)]);
    assert.equal(decisive.criticalStabCount, 2);
    assert.equal(decisive.locked, true);
  }

  const abdomen = new WalkerVitalStabPolicy();
  abdomen.evaluate([swordWound('abdomen-one', 'abdomen', 0.2)]);
  assert.equal(abdomen.criticalStabCount, 1, 'abdomen never receives decisive one-hit credit');
});

test('knife two-hit lethality remains unchanged and all four showcase policy owners reject prolonged pursuit', () => {
  const knife = new WalkerVitalStabPolicy();
  knife.evaluate([knifeWound('knife-one', 'upper_chest', 0.05)]);
  assert.equal(knife.criticalStabCount, 1);
  knife.evaluate([knifeWound('knife-two', 'neck', 0.045)]);
  assert.equal(knife.criticalStabCount, 2);
  assert.equal(knife.locked, true);

  const showcasePolicies = Array.from({ length: 4 }, () => new WalkerVitalStabPolicy());
  for (const [actorIndex, policy] of showcasePolicies.entries()) {
    for (let hit = 0; hit < 10; hit += 1) policy.evaluate([swordWound(`actor-${actorIndex}-hit-${hit}`, 'upper_chest', 0.08)]);
    assert.equal(policy.criticalStabCount, 2);
    assert.equal(policy.locked, true);
    assert.equal(policy.countedWoundIds.size, 2, 'terminal evaluation stops after the second good vital thrust');
  }
});

test('living and contactable actor predicates keep only the active dying fall in offensive routing', () => {
  const actor = { lifeState: 'alive', combatContactState: 'alive', disposed: false };
  assert.equal(isFolsomCombatActorLiving(actor), true);
  assert.equal(isFolsomCombatActorContactable(actor), true);
  actor.lifeState = 'dying';
  actor.combatContactState = 'dying';
  assert.equal(isFolsomCombatActorLiving(actor), false);
  assert.equal(isFolsomCombatActorContactable(actor), true);
  actor.lifeState = 'dead';
  actor.combatContactState = 'grounded';
  assert.equal(isFolsomCombatActorContactable(actor), false);
  actor.disposed = true;
  actor.combatContactState = 'disposed';
  assert.equal(isFolsomCombatActorContactable(actor), false);
});

for (const [label, Controller, itemId] of [
  ['knife', WorldKnifeCombatController, 'old_work_knife'],
  ['sword', SwordWorldWeaponController, 'dreadstone_sword'],
  ['mace', MaceWorldWeaponController, 'dreadstone_mace'],
]) {
  test(`${label} free presentation is one camera-anchor root with zero movement-frame pose error`, async () => {
    const harness = makePresentationHarness(Controller, itemId);
    const { controller, camera, viewmodelAnchor } = harness;
    await controller.visualLoadPromise;
    controller.beforePhysics(1 / 60);
    controller.afterPhysics(1, 1 / 60);
    assert.equal(controller.visual.parent, viewmodelAnchor);
    const localPosition = controller.visual.position.clone();
    const localQuaternion = controller.visual.quaternion.clone();

    camera.position.add(new THREE.Vector3(0.31, -0.08, 0.24));
    camera.rotateY(0.27);
    camera.rotateX(-0.09);
    camera.updateMatrixWorld(true);
    controller.afterPhysics(1, 1 / 60);

    assert.ok(controller.visual.position.distanceTo(localPosition) < 1e-12);
    assert.ok(controller.visual.quaternion.angleTo(localQuaternion) < 1e-12);
    const expectedWorldPosition = viewmodelAnchor.localToWorld(localPosition.clone());
    const actualWorldPosition = controller.visual.getWorldPosition(new THREE.Vector3());
    assert.ok(actualWorldPosition.distanceTo(expectedWorldPosition) < 1e-9);
    const expectedWorldQuaternion = camera.getWorldQuaternion(new THREE.Quaternion()).multiply(localQuaternion);
    const actualWorldQuaternion = controller.visual.getWorldQuaternion(new THREE.Quaternion());
    assert.ok(THREE.MathUtils.radToDeg(actualWorldQuaternion.angleTo(expectedWorldQuaternion)) < 1e-5);

    const diagnostics = controller.getWeaponPresentationDiagnostics();
    assert.equal(diagnostics.visibleAuthoritativeRootCount, 1);
    assert.equal(diagnostics.duplicateVisualRootCount, 0);
    assert.equal(diagnostics.transformWritesThisFrame, 1);
    assert.ok(diagnostics.visibleTaggedMeshCount >= 1);
    assert.ok(diagnostics.maximumMovementFramePositionError < 0.001);
    assert.ok(diagnostics.maximumMovementFrameRotationErrorDegrees < 0.1);
    controller.dispose();
    disposeWeaponViewmodelAnchor(viewmodelAnchor);
  });
}

for (const [label, Controller, itemId, switchOwnership] of [
  ['knife', WorldKnifeCombatController, 'old_work_knife', (controller) => controller.syncVisualDepthMode()],
  ['sword', SwordWorldWeaponController, 'dreadstone_sword', (controller) => controller.applyVisualLayer()],
]) {
  test(`${label} embed and extraction preserve the same root and exact world pose`, async () => {
    const harness = makePresentationHarness(Controller, itemId);
    const { controller, scene, viewmodelAnchor } = harness;
    await controller.visualLoadPromise;
    controller.beforePhysics(1 / 60);
    controller.afterPhysics(1, 1 / 60);
    const root = controller.visual;
    const baselineLayers = controller.getWeaponPresentationDiagnostics().layerTransitionCount;
    const beforePosition = root.getWorldPosition(new THREE.Vector3());
    const beforeQuaternion = root.getWorldQuaternion(new THREE.Quaternion());

    controller.entry = {};
    switchOwnership(controller);
    assert.equal(root.parent, scene);
    assert.equal(viewmodelAnchor.children.includes(root), false);
    assert.ok(root.getWorldPosition(new THREE.Vector3()).distanceTo(beforePosition) < 1e-9);
    assert.ok(root.getWorldQuaternion(new THREE.Quaternion()).angleTo(beforeQuaternion) < 1e-9);

    controller.entry = null;
    switchOwnership(controller);
    assert.equal(root.parent, viewmodelAnchor);
    assert.equal(scene.children.filter((child) => child === root).length, 0);
    assert.ok(root.getWorldPosition(new THREE.Vector3()).distanceTo(beforePosition) < 1e-9);
    assert.ok(root.getWorldQuaternion(new THREE.Quaternion()).angleTo(beforeQuaternion) < 1e-9);
    const diagnostics = controller.getWeaponPresentationDiagnostics();
    assert.equal(diagnostics.layerTransitionCount, baselineLayers + 2);
    assert.equal(diagnostics.visibleAuthoritativeRootCount, 1);
    assert.equal(diagnostics.duplicateVisualRootCount, 0);
    assert.ok(diagnostics.postExtractionPositionJump < 1e-9);
    assert.ok(diagnostics.postExtractionRotationJumpDegrees < 1e-7);

    controller.beginFreePresentationContinuity();
    controller.renderTargetLocalGrip.copy(root.position).add(new THREE.Vector3(0.1, 0.04, -0.06));
    controller.renderTargetLocalQuaternion.copy(root.quaternion)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(20)))
      .normalize();
    controller.afterPhysics(1, 1 / 60);
    const recovered = controller.getWeaponPresentationDiagnostics();
    assert.ok(recovered.postExtractionPositionJump > 0);
    assert.ok(recovered.postExtractionPositionJump <= 0.010001);
    assert.ok(recovered.postExtractionRotationJumpDegrees > 0);
    assert.ok(recovered.postExtractionRotationJumpDegrees <= 3.0001);
    controller.dispose();
    disposeWeaponViewmodelAnchor(viewmodelAnchor);
  });
}
