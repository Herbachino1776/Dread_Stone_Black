import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { KNIFE_COMBAT_CONFIG } from '../src/game/combat/CombatConfig.js';
import { COMBAT_DIRECTOR_EVENTS, CombatDirector } from '../src/game/combat/CombatDirector.js';
import { MELEE_INTENTS } from '../src/game/combat/MeleeIntentWeapon.js';
import { KNIFE_RUNTIME_COMBAT_MODE } from '../src/game/combat/WorldKnifeCombatController.js';
import {
  DREADSTONE_SWORD_DIMENSIONS,
  SWORD_ENTRY_RESISTANCE_DURATION,
  SWORD_ENTRY_RESISTANCE_MAXIMUM_LAG,
  SWORD_ENTRY_RESISTANCE_MIN_FOLLOW,
  SWORD_IMPALEMENT_STATES,
  SWORD_MAXIMUM_PENETRATION_DEPTH,
  SWORD_PENETRATION_RATE_METERS_PER_SECOND,
  SWORD_EXTRACTION_CONTINUITY_DURATION,
  SWORD_RUNTIME_COMBAT_MODE,
  SWORD_THRUST_MIN_FORWARD_RATIO,
  SWORD_THRUST_MIN_FORWARD_SPEED,
  SWORD_THRUST_REARM_DISTANCE,
  SWORD_WITHDRAWAL_RATE_METERS_PER_SECOND,
  SwordWorldWeaponController,
} from '../src/game/combat/weapons/SwordWorldWeaponController.js';

const FIXED_DT = 1 / 60;

function createBody() {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  return {
    position,
    quaternion,
    translation: () => ({ x: position.x, y: position.y, z: position.z }),
    rotation: () => ({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }),
    applyImpulseAtPoint() {},
  };
}

function bodyLocalPoint(body, worldPoint) {
  return worldPoint.clone().sub(body.position).applyQuaternion(body.quaternion.clone().invert());
}

async function createSwordHarness({ tipHit = true, tipToi = 0.5 } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 390 / 702, 0.1, 100);
  camera.updateMatrixWorld(true);
  const viewport = { querySelector: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 702 }) };
  const equipment = { getEquippedWeaponProfile: () => ({ id: 'dreadstone_sword' }), hasItem: () => true };
  const body = createBody();
  const collider = { handle: 1 };
  const region = { id: 'upper_chest', surfaceThickness: 0.012, softTissueResistance: 0.48, maximumTissueDepth: 0.24 };
  const hit = {
    body,
    collider,
    bodyId: 'upper_chest',
    regionId: 'upper_chest',
    region,
    localPoint: new THREE.Vector3(),
    collisionPointWorld: new THREE.Vector3(),
    bodyTransformAtCollision: { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() },
  };
  const actor = {
    id: 'testman-owner',
    instanceId: 'testman-owner',
    disposed: false,
    lifeState: 'alive',
    bodies: new Map([['upper_chest', { body }]]),
    colliders: new Map([['upper_chest', collider]]),
    colliderRegions: new Map([[collider.handle, region]]),
    activeEmbeddedWeapon: null,
    embeddedWeaponAssignments: [],
    setEmbeddedWeapon(weapon) { this.activeEmbeddedWeapon = weapon; this.embeddedWeaponAssignments.push(weapon); },
    transitionLifeState(nextState, reason = 'test-transition') {
      const previousState = this.lifeState;
      this.lifeState = nextState;
      this.activeEmbeddedWeapon?.onTargetLifeStateChanged?.(this, { previousState, nextState, reason });
    },
    woundSystem: { markExtracted() {} },
  };
  const director = {
    nextId: 1,
    beginCalls: [],
    advanceCalls: [],
    withdrawalCalls: [],
    completionCalls: [],
    resistanceCalls: [],
    contactCalls: [],
    cancelled: [],
    beginSwordPuncture(payload) {
      const interaction = { id: `sword-puncture-${this.nextId++}` };
      this.beginCalls.push({ payload, interaction });
      return interaction;
    },
    rupture(index = 0) {
      const call = this.beginCalls[index];
      const wound = { id: `sword-wound-${index + 1}` };
      call.payload.onWoundCreated(wound, call.interaction);
      return wound;
    },
    advancePenetration(id, payload) { this.advanceCalls.push({ id, payload: { ...payload } }); return true; },
    beginWithdrawal(id, payload) { this.withdrawalCalls.push({ id, payload: { ...payload } }); return true; },
    completeWithdrawal(id, payload) { this.completionCalls.push({ id, payload: { ...payload } }); return true; },
    reportResistance(id, payload) { this.resistanceCalls.push({ id, payload: { ...payload } }); return true; },
    reportContact(payload) { this.contactCalls.push(payload); return true; },
    cancelInteraction(id, reason) { this.cancelled.push({ id, reason }); return true; },
    beginEdgeDamage() { throw new Error('edge damage must remain dormant in puncture-only mode'); },
  };
  const combatRouter = {
    ownsCollider: (candidate) => candidate === collider,
    resolveCollider: (candidate, worldPoint) => {
      if (candidate !== collider) return null;
      hit.localPoint.copy(bodyLocalPoint(body, worldPoint));
      hit.collisionPointWorld.copy(worldPoint);
      hit.bodyTransformAtCollision = { position: body.position.clone(), quaternion: body.quaternion.clone() };
      return { actor, director, hit };
    },
  };
  const physics = {
    tipHit,
    castCount: 0,
    edgeCastCount: 0,
    prepareWeaponSweepBatch: () => false,
    castWeaponTip(previousTip, currentTip, _radius, predicate = null) {
      this.castCount += 1;
      if (!this.tipHit || (predicate && !predicate(collider))) return null;
      return { collider, time_of_impact: tipToi, normal1: { x: 0, y: 0, z: 1 } };
    },
    castSweptEdgeSphere() { this.edgeCastCount += 1; throw new Error('edge sweep must not run'); },
  };
  const controller = new SwordWorldWeaponController({
    app: viewport,
    scene,
    camera,
    actor,
    physics,
    equipmentRuntime: equipment,
    combatDirector: director,
    combatRouter,
    contactActivationProvider: () => true,
    visualAssetLoader: async () => new THREE.Group(),
    bindPointerInput: false,
  });
  await controller.visualLoadPromise;
  return { controller, actor, body, collider, director, hit, physics, scene, camera, combatRouter };
}

function beginHarnessThrust(harness, extension = 0.012) {
  const { controller } = harness;
  assert.equal(controller.acquireGrip(7, 195, 560, 0), true);
  controller.nudgeExtension(extension);
  controller.beforePhysics(FIXED_DT);
  assert.ok(controller.entry, 'the deterministic tip hit begins sword ownership');
  return controller.entry;
}

function stepAxial(controller, localZ, dt = FIXED_DT) {
  controller.deliberateInputVelocity.set(0, 0, localZ);
  if (controller.entry) {
    const worldEntry = controller.getEntryWorldPose();
    const controlDelta = -localZ * 0.025;
    controller.desiredTip.addScaledVector(worldEntry.axis, controlDelta);
    controller.desiredGrip.addScaledVector(worldEntry.axis, controlDelta);
    controller.solveSwordImpalement(dt);
  } else controller.beforePhysics(dt);
  controller.afterPhysics();
}

test('approved knife puncture tuning remains locked while runtime mode is puncture-only', () => {
  assert.equal(KNIFE_RUNTIME_COMBAT_MODE, 'puncture_only');
  assert.deepEqual(KNIFE_COMBAT_CONFIG, {
    itemId: 'old_work_knife',
    visualImplementation: 'world-knife-combat-controller',
    bladeLength: 0.24,
    bladeWidth: 0.052,
    bladeThickness: 0.012,
    handleLength: 0.13,
    overallLength: 0.37,
    tipRadius: 0.018,
    maximumPenetrationDepth: 0.225,
    minimumPunctureSpeed: 0.34,
    minimumPunctureAlignment: 0.72,
    failedPenetrationAlignment: 0.48,
    maximumVelocity: 3.8,
    maximumAngularVelocity: 8,
    visibleCollisionTolerance: 0.012,
    penetrationRate: 0.58,
    withdrawalRate: 0.72,
    lateralBindDistance: 0.08,
    forcedExtractionDistance: 0.24,
    forceTransfer: 5.5,
    gripZone: { viewportRatio: 0.16, minimumRadiusPx: 58, maximumRadiusPx: 86 },
    return: { freeSeconds: 0.15, failedContactSeconds: 0.19 },
    workspace: {
      relaxed: [0.1, -0.22, -0.48],
      ready: [0.1, -0.22, -0.48],
      min: [-0.16, -0.31, -0.84],
      max: [0.3, 0.03, -0.42],
      lateralReach: 0.22,
      verticalReach: 0.15,
      thrustDistance: 0.34,
      positionFollow: 38,
      rotationFollow: 32,
      lateralSensitivity: 1 / 150,
      verticalSensitivity: 1 / 360,
      thrustSensitivity: 1 / 190,
    },
  });
});

test('actual sword tip displacement above both thresholds performs the only contact sweep', async () => {
  const harness = await createSwordHarness({ tipHit: false });
  const { controller, physics } = harness;
  try {
    controller.acquireGrip(7, 195, 560, 0);
    controller.nudgeExtension(0.012);
    controller.beforePhysics(FIXED_DT);
    assert.ok(controller.actualTipSpeed >= SWORD_THRUST_MIN_FORWARD_SPEED);
    assert.ok(controller.forwardSpeed >= SWORD_THRUST_MIN_FORWARD_SPEED);
    assert.ok(controller.forwardRatio >= SWORD_THRUST_MIN_FORWARD_RATIO);
    assert.equal(controller.thrustEligible, true);
    assert.equal(physics.castCount, 1);
    assert.equal(physics.edgeCastCount, 0);
  } finally {
    controller.dispose();
  }
});

test('free sword display, physical pose, collision primitives, and thumb response are one authority', async () => {
  const harness = await createSwordHarness({ tipHit: false });
  const { controller } = harness;
  try {
    controller.acquireGrip(7, 195, 560, 0);
    controller.applyGripGesture(7, 90, -35, 285, 525, 40);
    controller.beforePhysics(FIXED_DT);
    controller.afterPhysics(1, FIXED_DT);
    const diagnostics = controller.getDiagnostics().swordPresentationUnity;
    assert.deepEqual(diagnostics.authoritativeLocalGrip, diagnostics.displayedLocalGrip);
    assert.equal(diagnostics.positionError, 0);
    assert.equal(diagnostics.rotationErrorDegrees, 0);
    assert.ok(diagnostics.tipError < 0.002);
    assert.ok(diagnostics.edgeError < 0.002);
    for (const primitive of Object.values(controller.primitives)) {
      const displayedStart = primitive.path.points[0].clone().applyQuaternion(controller.displayedWorldQuaternion).add(controller.displayedWorldGrip);
      const displayedEnd = primitive.path.points.at(-1).clone().applyQuaternion(controller.displayedWorldQuaternion).add(controller.displayedWorldGrip);
      assert.ok(displayedStart.distanceTo(primitive.currentStart) < 1e-9);
      assert.ok(displayedEnd.distanceTo(primitive.currentEnd) < 1e-9);
    }
    const source = SwordWorldWeaponController.toString();
    assert.doesNotMatch(source, /presentationContinuityActive|SWORD_CONTINUITY_POSITION_STEP|SWORD_CONTINUITY_ROTATION_STEP|renderTargetLocal/);
  } finally {
    controller.dispose();
  }
});

test('extraction continuity is an authoritative non-stacking offset with immediate thumb response', async () => {
  assert.equal(SWORD_EXTRACTION_CONTINUITY_DURATION, 0.1);
  const harness = await createSwordHarness({ tipHit: false });
  const { controller, camera } = harness;
  try {
    controller.computeDesiredPose();
    const canonicalPosition = controller.desiredGrip.clone();
    const canonicalQuaternion = controller.desiredQuaternion.clone();
    const preservedPosition = canonicalPosition.clone().add(new THREE.Vector3(0.08, 0.03, -0.04));
    const preservedQuaternion = canonicalQuaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(18)));
    controller.beginAuthoritativeExtractionContinuity(preservedPosition, preservedQuaternion);
    assert.ok(controller.actualGrip.distanceTo(preservedPosition) < 1e-9, 'the embedded world pose survives world-to-viewmodel conversion');
    assert.ok(controller.actualQuaternion.angleTo(preservedQuaternion) < 1e-9);
    controller.afterPhysics(1, 0);
    assert.ok(controller.getDiagnostics().swordPresentationUnity.tipError < 0.002);

    controller.applyFreeSwordAuthoritativePose(0.02);
    const beforeInput = controller.actualGrip.clone();
    controller.desiredGrip.x += 0.06;
    controller.applyFreeSwordAuthoritativePose(0);
    assert.ok(Math.abs(controller.actualGrip.x - beforeInput.x - 0.06) < 1e-9, 'new thumb input remains one-to-one during offset decay');
    controller.captureFreeRenderPose();
    controller.afterPhysics(1, 0.02);
    assert.ok(controller.getDiagnostics().swordPresentationUnity.edgeError < 0.002);
    controller.applyFreeSwordAuthoritativePose(0.08);
    assert.equal(controller.extractionOffsetActive, false);
    assert.ok(controller.actualGrip.distanceTo(controller.desiredGrip) < 1e-9);
    assert.ok(controller.actualQuaternion.angleTo(controller.desiredQuaternion) < 1e-9);

    const replacementPreserved = controller.desiredGrip.clone().add(new THREE.Vector3(0.025, 0, 0));
    controller.beginAuthoritativeExtractionContinuity(replacementPreserved, controller.desiredQuaternion);
    assert.ok(Math.abs(controller.extractionPositionOffset.length() - 0.025) < 1e-9, 'a fresh extraction replaces rather than stacks the prior offset');
    assert.equal(controller.extractionCycleCount, 2);
    assert.ok(camera.worldToLocal(controller.actualGrip.clone()).distanceTo(controller.renderLocalGrip) < 1e-9);
  } finally {
    controller.dispose();
  }
});

test('sword thrust recognition is independent of resolveSwordLeadingPart and pointer-local intent classification', async () => {
  assert.doesNotMatch(SwordWorldWeaponController.prototype.solveFreeSwordPose.toString(), /resolveSwordLeadingPart/);
  assert.doesNotMatch(SwordWorldWeaponController.prototype.solveSwordImpalement.toString(), /SWORD_(PENETRATION|WITHDRAWAL)_RATE_METERS_PER_SECOND/, 'gripped depth is not advanced by fixed rate constants');
  const harness = await createSwordHarness();
  const { controller, director } = harness;
  try {
    controller.acquireGrip(7, 195, 560, 0);
    controller.desiredExtension += 0.012;
    controller.deliberateInputVelocity.set(4, 0, -0.2);
    controller.state = SWORD_IMPALEMENT_STATES.attacking;
    controller.beforePhysics(FIXED_DT);
    assert.equal(director.beginCalls.length, 1);
    assert.equal(director.beginCalls[0].payload.intent.intent, MELEE_INTENTS.stab);
    assert.equal(director.beginCalls[0].payload.intent.reason, 'actual-tip-forward-thrust');
  } finally {
    controller.dispose();
  }
});

test('one tip crossing consumes the collision-frame remainder and owns one projection-driven wound', async () => {
  const harness = await createSwordHarness({ tipToi: 0.1 });
  const { controller, actor, director, physics } = harness;
  try {
    const entry = beginHarnessThrust(harness, 0.2);
    assert.equal(controller.state, SWORD_IMPALEMENT_STATES.surfaceContact);
    assert.equal(controller.punctureBeginCount, 1);
    assert.equal(director.beginCalls.length, 1);
    assert.equal(entry.woundId, null);
    assert.ok(Math.abs(controller.penetrationDepth - 0.18) < 1e-9, 'the remaining 90% of the 20 cm crossing becomes same-frame depth');
    assert.equal(director.advanceCalls.length, 1);
    assert.ok(Math.abs(director.advanceCalls[0].payload.deltaDepth - (controller.penetrationDepth - 0.004)) < 1e-9);
    const wound = director.rupture();
    assert.equal(entry.woundId, wound.id);
    assert.equal(entry.surfaceRuptured, true);
    const initialDepth = controller.penetrationDepth;
    stepAxial(controller, -1);
    assert.equal(controller.state, SWORD_IMPALEMENT_STATES.penetrating);
    assert.ok(controller.penetrationDepth > initialDepth);
    assert.ok(controller.penetrationDepth >= initialDepth + 0.025 * SWORD_ENTRY_RESISTANCE_MIN_FOLLOW);
    assert.ok(controller.penetrationDepth < initialDepth + 0.025, 'entry resistance briefly trails only inward input');
    assert.ok(controller.projectionError > 0 && controller.projectionError < 0.012);
    assert.equal(controller.entryResistanceActive, true);
    assert.equal(director.beginCalls.length, 1);
    assert.equal(controller.punctureBeginCount, 1);
    assert.ok(physics.castCount > 1, 'embedded motion still searches for non-owned contacts');
    assert.ok(controller.sameTargetCollisionSuppressionCount > 0, 'the owned interior overlap is filtered from those searches');
    assert.equal(actor.activeEmbeddedWeapon, controller);
  } finally {
    controller.dispose();
  }
});

test('entry resistance is bounded by both distance and time on a large thumb jump', async () => {
  const harness = await createSwordHarness();
  const { controller, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    const worldEntry = controller.getEntryWorldPose();
    controller.desiredTip.copy(worldEntry.point).addScaledVector(worldEntry.axis, SWORD_MAXIMUM_PENETRATION_DEPTH);
    controller.desiredGrip.copy(controller.desiredTip).addScaledVector(worldEntry.axis, -controller.config.tipLength);
    controller.desiredQuaternion.copy(worldEntry.quaternion);
    controller.solveSwordImpalement(0.001);
    assert.ok(controller.projectionError > 0);
    assert.ok(controller.projectionError <= SWORD_ENTRY_RESISTANCE_MAXIMUM_LAG + 1e-12);
    controller.solveSwordImpalement(SWORD_ENTRY_RESISTANCE_DURATION);
    assert.equal(controller.entryResistanceActive, false);
    assert.ok(Math.abs(controller.penetrationDepth - controller.desiredProjectedDepth) < 1e-12);
    assert.ok(Math.abs(controller.projectionError) < 1e-12);
  } finally {
    controller.dispose();
  }
});

test('rendered sword pose follows penetration depth and permits body traversal without guard penetration', async () => {
  const harness = await createSwordHarness();
  const { controller, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    for (let frame = 0; frame < 90 && controller.penetrationDepth < SWORD_MAXIMUM_PENETRATION_DEPTH; frame += 1) stepAxial(controller, -1);
    assert.equal(controller.penetrationDepth, SWORD_MAXIMUM_PENETRATION_DEPTH);
    assert.ok(controller.penetrationDepth > 0.42, 'the point can traverse the full upper-chest proxy thickness');
    const worldEntry = controller.getEntryWorldPose();
    const expectedTip = worldEntry.point.clone().addScaledVector(worldEntry.axis, controller.penetrationDepth);
    assert.ok(controller.currentTip.distanceTo(expectedTip) < 1e-9);
    controller.afterPhysics();
    assert.ok(controller.visual.position.distanceTo(controller.actualGrip) < 1e-9);
    const guardCenter = controller.actualGrip.clone().addScaledVector(worldEntry.axis, -DREADSTONE_SWORD_DIMENSIONS.guardCenterZ);
    const guardBladeFacingEdge = guardCenter.clone().addScaledVector(worldEntry.axis, DREADSTONE_SWORD_DIMENSIONS.guardRadius);
    const guardDepth = guardCenter.clone().sub(worldEntry.point).dot(worldEntry.axis);
    const guardEdgeDepth = guardBladeFacingEdge.clone().sub(worldEntry.point).dot(worldEntry.axis);
    assert.ok(guardDepth < 0, 'the guard remains outside the entry surface at maximum depth');
    assert.ok(Math.abs(guardEdgeDepth) < 1e-9, 'maximum depth buries the full blade up to the blade-facing edge of the hand guard');
    assert.equal(SWORD_MAXIMUM_PENETRATION_DEPTH, Math.abs(DREADSTONE_SWORD_DIMENSIONS.tipZ - (DREADSTONE_SWORD_DIMENSIONS.guardCenterZ - DREADSTONE_SWORD_DIMENSIONS.guardRadius)));
  } finally {
    controller.dispose();
  }
});

test('accepted puncture keeps its wound-space visual anchor while thumb deltas remain one-to-one', async () => {
  const harness = await createSwordHarness({ tipHit: false });
  const { controller, collider, combatRouter, director, camera } = harness;
  try {
    assert.equal(controller.acquireGrip(7, 195, 560, 0), true);
    controller.nudgeExtension(0.08);
    controller.beforePhysics(FIXED_DT);
    const entryAxis = controller.bladeForward.clone();
    const point = controller.desiredTip
      .clone()
      .addScaledVector(entryAxis, -0.045)
      .add(new THREE.Vector3(0.065, -0.018, 0));
    const routed = combatRouter.resolveCollider(collider, point);
    const rawThumbTipAtContact = controller.desiredTip.clone();
    const rawThumbGripAtContact = controller.desiredGrip.clone();
    assert.equal(controller.beginSwordPenetration({
      routed,
      point,
      normal: entryAxis.clone().negate(),
      contactDirection: entryAxis,
    }), true);
    director.rupture();

    const expectedAcceptedTip = point.clone().addScaledVector(entryAxis, controller.penetrationDepth);
    assert.ok(controller.currentTip.distanceTo(expectedAcceptedTip) < 1e-9, 'the visible blade is placed through the accepted wound point');
    assert.ok(controller.currentTip.distanceTo(rawThumbTipAtContact) > 0.05, 'the accepted wound pose is not discarded for the raw screen-space thumb pose');

    const acceptedGrip = controller.actualGrip.clone();
    controller.nudgeAim(0.1, 0);
    controller.computeDesiredPose();
    const deliberateThumbDelta = controller.desiredGrip.clone().sub(rawThumbGripAtContact);
    controller.solveSwordImpalement(FIXED_DT);
    assert.ok(controller.actualGrip.distanceTo(acceptedGrip.clone().add(deliberateThumbDelta)) < 1e-9, 'held-thumb movement applies as an immediate one-to-one delta from the wound pose');

    const anchoredBeforeCameraMotion = controller.actualGrip.clone();
    camera.position.set(0.45, 0.2, 0.3);
    camera.rotation.y = THREE.MathUtils.degToRad(18);
    camera.updateMatrixWorld(true);
    controller.computeDesiredPose();
    controller.solveSwordImpalement(FIXED_DT);
    assert.ok(controller.actualGrip.distanceTo(anchoredBeforeCameraMotion) < 1e-9, 'camera/viewmodel motion cannot pull an embedded sword back onto the thumb');
  } finally {
    controller.dispose();
  }
});

test('release while embedded clears ownership immediately and re-grabs without a stale lock', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, director } = harness;
  try {
    const ownedEntry = beginHarnessThrust(harness);
    director.rupture();
    stepAxial(controller, -1);
    const woundId = ownedEntry.woundId;
    const releasePosition = controller.actualGrip.clone();
    const releaseQuaternion = controller.actualQuaternion.clone();
    controller.releaseGrip('test-shallow-release');
    assert.equal(controller.state, SWORD_IMPALEMENT_STATES.returning);
    assert.equal(controller.entry, null);
    assert.equal(controller.penetrationDepth, 0);
    assert.equal('releaseWithdrawal' in controller, false, 'release owns no delayed impalement timer');
    assert.equal(controller.gripPointerId, null);
    assert.equal(controller.lastExtractionReason, 'weapon_released');
    assert.equal(controller.lastImpalementCleanupReason, 'weapon_released');
    assert.equal(ownedEntry.woundId, woundId, 'the original puncture wound remains authoritative after sword recovery');
    assert.equal(director.withdrawalCalls.length, 1);
    assert.equal(director.completionCalls.length, 1);
    assert.equal(actor.embeddedWeaponAssignments.filter((weapon) => weapon == null).length, 1);
    assert.equal(actor.activeEmbeddedWeapon, null);
    assert.ok(controller.actualGrip.distanceTo(releasePosition) < 1e-9, 'release cleanup does not teleport the sword');
    assert.ok(controller.actualQuaternion.angleTo(releaseQuaternion) < 1e-9);
    assert.equal(controller.acquireGrip(8, 195, 560, 100), true, 'a new thumb can immediately reacquire the cleaned sword');
    controller.desiredGrip.x += 0.04;
    const beforeMove = controller.actualGrip.x;
    controller.applyFreeSwordAuthoritativePose(0);
    assert.ok(Math.abs(controller.actualGrip.x - beforeMove - 0.04) < 1e-9);
  } finally {
    controller.dispose();
  }
});

test('release at maximum depth uses the same immediate target-independent cleanup', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    for (let frame = 0; frame < 90 && controller.penetrationDepth < SWORD_MAXIMUM_PENETRATION_DEPTH; frame += 1) stepAxial(controller, -1);
    assert.equal(controller.penetrationDepth, SWORD_MAXIMUM_PENETRATION_DEPTH);
    controller.releaseGrip('test-maximum-depth-release');
    assert.equal(controller.entry, null);
    assert.equal(controller.penetrationDepth, 0);
    assert.equal(controller.state, SWORD_IMPALEMENT_STATES.returning);
    assert.equal(controller.extractionCount, 1);
    assert.equal(controller.lastExtractionReason, 'weapon_released');
    assert.equal(controller.lastImpalementCleanupReason, 'weapon_released');
    assert.equal(director.withdrawalCalls.length, 1);
    assert.equal(director.completionCalls.length, 1);
    assert.equal(actor.activeEmbeddedWeapon, null);
  } finally {
    controller.dispose();
  }
});

test('complete withdrawal is single-shot and rearming requires the full surface clearance', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, body, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    for (let frame = 0; frame < 10; frame += 1) stepAxial(controller, -1);
    body.position.add(new THREE.Vector3(0.035, 0.012, -0.02));
    body.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(16));
    for (let frame = 0; frame < 40 && controller.entry; frame += 1) stepAxial(controller, 1);
    assert.equal(controller.entry, null);
    assert.equal(controller.state, SWORD_IMPALEMENT_STATES.attacking);
    assert.equal(controller.extractionCount, 1);
    assert.equal(director.withdrawalCalls.length, 1);
    assert.equal(director.completionCalls.length, 1);
    assert.equal(actor.activeEmbeddedWeapon, null);
    assert.equal(controller.rearmReady, false);
    assert.equal(controller.gripPointerId, 7, 'the held pointer remains authoritative after extraction');
    assert.ok(controller.embeddedToFreePositionDiscontinuity <= 0.01);
    assert.ok(THREE.MathUtils.radToDeg(controller.embeddedToFreeRotationDiscontinuity) <= 3);
    controller.beforePhysics(FIXED_DT);
    assert.notEqual(controller.state, SWORD_IMPALEMENT_STATES.returning);
    assert.ok(controller.embeddedToFreePositionDiscontinuity <= 0.010001);
    assert.ok(THREE.MathUtils.radToDeg(controller.embeddedToFreeRotationDiscontinuity) <= 3.0001);
    const gate = controller.rearmGate;
    const entryPoint = gate.worldPoint.clone();
    const entryAxis = gate.worldAxis.clone();
    assert.equal('actor' in gate, false, 'post-extraction rearm keeps no actor or corpse reference');
    assert.equal('body' in gate, false);
    controller.currentTip.copy(entryPoint).addScaledVector(entryAxis, -(SWORD_THRUST_REARM_DISTANCE - 0.001));
    controller.updateSwordRearmGate();
    assert.equal(controller.rearmReady, false, '0.049 m of clearance cannot rearm');
    assert.equal(controller.rearmCount, 0);
    controller.currentTip.copy(entryPoint).addScaledVector(entryAxis, -SWORD_THRUST_REARM_DISTANCE);
    controller.updateSwordRearmGate();
    assert.equal(controller.rearmReady, true);
    assert.equal(controller.rearmCount, 1);
    assert.equal(controller.punctureBeginCount, 1);
  } finally {
    controller.dispose();
  }
});

test('held-thumb projection withdrawal and repeated controlled puncture ownership remain available', async () => {
  const harness = await createSwordHarness();
  const { controller, collider, combatRouter, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    const advancedDepth = controller.penetrationDepth;
    stepAxial(controller, -1);
    assert.ok(controller.penetrationDepth > advancedDepth);
    const withdrawalDepth = controller.penetrationDepth;
    stepAxial(controller, 1);
    assert.ok(controller.penetrationDepth < withdrawalDepth);
    assert.equal(controller.gripPointerId, 7);
    for (let frame = 0; frame < 40 && controller.entry; frame += 1) stepAxial(controller, 1);
    const gate = controller.rearmGate;
    const point = gate.worldPoint.clone();
    const axis = gate.worldAxis.clone();
    controller.currentTip.copy(point).addScaledVector(axis, -SWORD_THRUST_REARM_DISTANCE);
    controller.updateSwordRearmGate();
    assert.equal(controller.rearmReady, true);
    assert.equal(controller.gripPointerId, 7, 'control stays owned between punctures');
    controller.desiredTip.copy(point).addScaledVector(axis, 0.04);
    const routed = combatRouter.resolveCollider(collider, point);
    assert.equal(controller.beginSwordPenetration({ routed, point, normal: axis.clone().negate(), contactDirection: axis }), true);
    assert.equal(controller.punctureBeginCount, 2);
    assert.equal(director.beginCalls.length, 2);
    assert.equal(controller.gripPointerId, 7);
  } finally {
    controller.dispose();
  }
});

test('ten continuous-hold impalement cycles retain rearm, immediate response, and presentation unity', async () => {
  const harness = await createSwordHarness();
  const { controller, collider, combatRouter, director, physics } = harness;
  const offsetMagnitudes = [];
  try {
    beginHarnessThrust(harness);
    physics.tipHit = false;
    for (let cycle = 0; cycle < 10; cycle += 1) {
      director.rupture(cycle);
      stepAxial(controller, -1);
      for (let frame = 0; frame < 80 && controller.entry; frame += 1) stepAxial(controller, 1);
      assert.equal(controller.entry, null, `cycle ${cycle + 1} fully extracts`);
      assert.equal(controller.gripPointerId, 7, `cycle ${cycle + 1} keeps the original thumb`);
      assert.equal(controller.extractionCount, cycle + 1);
      offsetMagnitudes.push(controller.extractionPositionOffset.length());
      controller.captureFreeRenderPose();
      controller.afterPhysics(1, 0);
      let unity = controller.getDiagnostics().swordPresentationUnity;
      assert.ok(unity.tipError < 0.005, `cycle ${cycle + 1} tip unity`);
      assert.ok(unity.edgeError < 0.01, `cycle ${cycle + 1} edge unity`);
      assert.equal(controller.getWeaponPresentationDiagnostics().visibleAuthoritativeRootCount, 1);

      const beforeLateral = controller.actualGrip.clone();
      controller.desiredGrip.x += cycle % 2 === 0 ? 0.03 : -0.03;
      controller.applyFreeSwordAuthoritativePose(0);
      assert.ok(Math.abs(controller.actualGrip.x - beforeLateral.x - (cycle % 2 === 0 ? 0.03 : -0.03)) < 1e-9, `cycle ${cycle + 1} has no response delay`);
      controller.updateDerivedPose();
      controller.updatePrimitiveEndpoints();
      controller.captureFreeRenderPose();
      controller.afterPhysics(1, 0);
      unity = controller.getDiagnostics().swordPresentationUnity;
      assert.ok(unity.tipError < 0.005);
      assert.ok(unity.edgeError < 0.01);

      controller.applyFreeSwordAuthoritativePose(SWORD_EXTRACTION_CONTINUITY_DURATION);
      controller.updateDerivedPose();
      const gate = controller.rearmGate;
      const point = gate.worldPoint.clone();
      const axis = gate.worldAxis.clone();
      controller.currentTip.copy(point).addScaledVector(axis, -SWORD_THRUST_REARM_DISTANCE);
      controller.updateSwordRearmGate();
      assert.equal(controller.rearmReady, true, `cycle ${cycle + 1} rearms`);
      assert.equal(controller.rearmCount, cycle + 1);

      if (cycle < 9) {
        const routed = combatRouter.resolveCollider(collider, point);
        assert.equal(controller.beginSwordPenetration({ routed, point, normal: axis.clone().negate(), contactDirection: axis }), true);
        assert.equal(controller.punctureBeginCount, cycle + 2);
      }
    }
    assert.ok(offsetMagnitudes.every((magnitude) => Number.isFinite(magnitude) && magnitude < 1.25));
    assert.equal(controller.extractionCycleCount, 10, 'each extraction replaces one offset without stacking');
    const unity = controller.getDiagnostics().swordPresentationUnity;
    assert.equal(unity.maximumTipError, 0);
    assert.equal(unity.maximumEdgeError, 0);
  } finally {
    controller.dispose();
  }
});

test('stab then lateral drag and outward thumb extraction stay authoritative while the living enemy remains', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    for (let frame = 0; frame < 8; frame += 1) stepAxial(controller, -1);
    assert.equal(controller.entryResistanceActive, false, 'entry resistance expires instead of becoming an embedded drag');

    const desiredLateral = controller.desiredGrip.clone().add(new THREE.Vector3(0.085, -0.025, 0));
    controller.desiredGrip.copy(desiredLateral);
    controller.desiredTip.add(new THREE.Vector3(0.085, -0.025, 0));
    const desiredRotation = controller.desiredQuaternion.clone().multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(9)),
    );
    controller.desiredQuaternion.copy(desiredRotation);
    controller.solveSwordImpalement(FIXED_DT);
    assert.ok(Math.abs(controller.actualGrip.x - desiredLateral.x) < 1e-9, 'lateral thumb position is not replaced by the entry anchor');
    assert.ok(Math.abs(controller.actualGrip.y - desiredLateral.y) < 1e-9);
    assert.ok(controller.actualQuaternion.angleTo(desiredRotation) < 1e-9, 'embedded target rotation does not replace thumb rotation');

    for (let frame = 0; frame < 80 && controller.entry; frame += 1) stepAxial(controller, 1);
    assert.equal(controller.entry, null);
    assert.equal(controller.lastImpalementCleanupReason, 'extracted');
    assert.equal(controller.gripPointerId, 7);
    assert.equal(actor.disposed, false);
    assert.equal(actor.lifeState, 'alive');
    assert.equal(actor.activeEmbeddedWeapon, null);

    const freeBefore = controller.actualGrip.x;
    controller.desiredGrip.x += 0.045;
    controller.applyFreeSwordAuthoritativePose(0);
    assert.ok(Math.abs(controller.actualGrip.x - freeBefore - 0.045) < 1e-9, 'normal direct response returns in the extraction frame');
  } finally {
    controller.dispose();
  }
});

test('target collapse preserves the puncture visual but detaches corpse physics until held-thumb extraction', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, body, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    stepAxial(controller, -1);
    const embeddedPose = controller.actualGrip.clone();
    actor.transitionLifeState('dying', 'fatal-test-stab');
    assert.ok(controller.entry, 'the accepted puncture remains visually active after lethal damage');
    assert.equal(controller.entry.corpseDetached, true);
    assert.equal(controller.entry.body, null, 'the dead target body no longer owns the sword transform');
    assert.equal(controller.lastImpalementCleanupReason, null);
    assert.equal(controller.gripPointerId, 7);
    assert.equal(actor.activeEmbeddedWeapon, null);
    assert.equal(actor.disposed, false, 'the corpse owner remains in the scene');
    assert.ok(controller.actualGrip.distanceTo(embeddedPose) < 1e-9, 'death transition does not teleport or visually withdraw the sword');

    body.position.add(new THREE.Vector3(0.8, -0.6, 0.5));
    body.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(70));
    controller.solveSwordImpalement(FIXED_DT);
    assert.ok(controller.actualGrip.distanceTo(embeddedPose) < 1e-9, 'corpse ragdoll motion cannot drag the embedded sword');

    const swordBeforeThumbMotion = controller.actualGrip.clone();
    controller.desiredGrip.add(new THREE.Vector3(-0.07, 0.03, 0));
    controller.desiredTip.add(new THREE.Vector3(-0.07, 0.03, 0));
    controller.solveSwordImpalement(FIXED_DT);
    assert.ok(controller.actualGrip.distanceTo(swordBeforeThumbMotion) > 0.07, 'thumb drag moves immediately while the corpse remains');
    assert.ok(controller.actualGrip.distanceTo(body.position) > 0.1, 'corpse transform no longer drives sword position');

    for (let frame = 0; frame < 80 && controller.entry; frame += 1) stepAxial(controller, 1);
    assert.equal(controller.entry, null, 'held-thumb withdrawal clears before corpse despawn');
    assert.equal(controller.lastImpalementCleanupReason, 'extracted');
    assert.equal(controller.gripPointerId, 7);

    actor.transitionLifeState('dead', 'corpse-grounded');
    actor.disposed = true;
    assert.equal(controller.cleanupSwordImpalement('target_removed'), false, 'later corpse despawn cleanup is safely idempotent');
  } finally {
    controller.dispose();
  }
});

test('corpse despawn cleans a still-visible puncture without teleporting or releasing the thumb', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    stepAxial(controller, -1);
    actor.transitionLifeState('dying', 'fatal-test-stab');
    assert.equal(controller.entry?.corpseDetached, true);
    const poseBeforeDespawn = controller.actualGrip.clone();

    assert.equal(controller.cancelTarget(actor, 'folsom-corpse-despawn'), true);
    assert.equal(controller.entry, null);
    assert.equal(controller.lastImpalementCleanupReason, 'target_removed');
    assert.equal(controller.gripPointerId, 7);
    assert.ok(controller.actualGrip.distanceTo(poseBeforeDespawn) < 1e-9, 'corpse removal cleanup preserves the last visible sword pose');
    assert.equal(controller.cancelTarget(actor, 'folsom-corpse-despawn'), false, 'repeat despawn notification is idempotent');
  } finally {
    controller.dispose();
  }
});

test('same-target interior contact is suppressed while outward motion and other contacts remain live', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, collider, combatRouter, director, hit, physics } = harness;
  const otherBody = createBody();
  const otherCollider = { handle: 2 };
  const worldCollider = { handle: 3 };
  const otherActor = { id: 'other-enemy', instanceId: 'other-enemy', disposed: false };
  const otherHit = { ...hit, body: otherBody, collider: otherCollider, bodyId: 'abdomen', regionId: 'abdomen' };
  const otherDirector = { contactCalls: [], reportContact(payload) { this.contactCalls.push(payload); return true; } };
  try {
    beginHarnessThrust(harness);
    director.rupture();
    const initialDepth = controller.penetrationDepth;
    stepAxial(controller, -1);
    assert.ok(controller.penetrationDepth < controller.desiredProjectedDepth, 'inward entry movement receives only bounded transient resistance');
    assert.ok(controller.penetrationDepth > initialDepth);
    stepAxial(controller, 1);
    assert.equal(controller.penetrationDepth, controller.desiredProjectedDepth, 'outward movement has no same-target resistance or snap-back');
    assert.equal(controller.directControlTrackingErrorWhileEmbedded, 0);

    combatRouter.ownsCollider = (candidate) => [collider, otherCollider, worldCollider].includes(candidate);
    combatRouter.resolveCollider = (candidate) => candidate === otherCollider ? { actor: otherActor, director: otherDirector, hit: otherHit } : candidate === collider ? { actor, director, hit } : null;
    assert.equal(controller.shouldResolveEmbeddedCollider(collider), false);
    assert.equal(controller.shouldResolveEmbeddedCollider(otherCollider), true);
    assert.equal(controller.shouldResolveEmbeddedCollider(worldCollider), true, 'the scoped suppression preserves any pre-existing world-contact predicate');

    physics.castWeaponTip = function castOther(_previousTip, _currentTip, _radius, predicate) {
      this.castCount += 1;
      return predicate?.(otherCollider) ? { collider: otherCollider, time_of_impact: 0.4, normal1: { x: 0, y: 0, z: 1 } } : null;
    };
    controller.actualTipSpeed = 0.8;
    controller.tipDisplacement.set(0, 0, -0.02);
    assert.equal(controller.resolveEmbeddedExternalTipContact(), true);
    assert.equal(otherDirector.contactCalls.length, 1, 'another actor retains a meaningful routed contact');
    assert.equal(controller.otherTargetContactWhileEmbeddedCount, 1);
    assert.ok(controller.sameTargetCollisionSuppressionCount > 0);
  } finally {
    controller.dispose();
  }
});

test('authoritative impalement cleanup is idempotent and clears the whole stab session once', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    stepAxial(controller, -1);
    const assignmentsBefore = actor.embeddedWeaponAssignments.length;
    assert.equal(controller.cleanupSwordImpalement('target_removed'), true);
    assert.equal(controller.entry, null);
    assert.equal(controller.penetrationDepth, 0);
    assert.equal(controller.rearmGate, null);
    assert.equal('releaseWithdrawal' in controller, false);
    assert.equal(controller.entryResistanceActive, false);
    assert.equal(actor.activeEmbeddedWeapon, null);
    assert.equal(director.cancelled.length, 1);
    assert.equal(controller.impalementCleanupCount, 1);
    assert.equal(controller.cleanupSwordImpalement('target_removed'), false);
    assert.equal(director.cancelled.length, 1);
    assert.equal(actor.embeddedWeaponAssignments.length, assignmentsBefore + 1);
    assert.equal(controller.impalementCleanupCount, 1);
  } finally {
    controller.dispose();
  }
});

test('the first actor, body, region, and wound remain authoritative across neighboring collider motion', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, director, physics } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    const ownedEntry = controller.entry;
    const ownedWound = ownedEntry.woundId;
    for (let frame = 0; frame < 12; frame += 1) stepAxial(controller, -1);
    assert.equal(controller.entry, ownedEntry);
    assert.equal(controller.entry.actor, actor);
    assert.equal(controller.entry.bodyId, 'upper_chest');
    assert.equal(controller.entry.regionId, 'upper_chest');
    assert.equal(controller.entry.woundId, ownedWound);
    assert.equal(controller.punctureBeginCount, 1);
    assert.ok(physics.castCount > 1);
    assert.ok(controller.sameTargetCollisionSuppressionCount >= 12);
  } finally {
    controller.dispose();
  }
});

test('puncture-only normal loop never invokes sword edge, flat, spine, guard, or grip work', async () => {
  const harness = await createSwordHarness({ tipHit: false });
  const { controller, physics } = harness;
  let edgeCalls = 0;
  let primitiveCalls = 0;
  controller.resolveEdgeContact = () => { edgeCalls += 1; return false; };
  controller.resolvePrimitiveContact = () => { primitiveCalls += 1; return false; };
  try {
    controller.acquireGrip(7, 195, 560, 0);
    controller.nudgeAim(0.4, 0);
    controller.beforePhysics(FIXED_DT);
    assert.equal(controller.thrustEligible, false);
    assert.equal(edgeCalls, 0);
    assert.equal(primitiveCalls, 0);
    assert.equal(physics.edgeCastCount, 0);
    assert.equal(physics.castCount, 0);
    assert.ok(controller.suppressedNonTipContacts > 0);
  } finally {
    controller.dispose();
  }
});

test('disposed embedded target clears safely without a replacement wound', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    const positionBeforeDespawn = controller.actualGrip.clone();
    actor.disposed = true;
    controller.beforePhysics(FIXED_DT);
    assert.equal(controller.entry, null);
    assert.equal(controller.state, SWORD_IMPALEMENT_STATES.attacking);
    assert.equal(controller.gripPointerId, 7, 'target removal cannot silently release the live thumb owner');
    assert.equal(controller.lastImpalementCleanupReason, 'target_removed');
    assert.equal(actor.activeEmbeddedWeapon, null);
    assert.ok(controller.actualGrip.distanceTo(positionBeforeDespawn) < 0.1, 'despawn cleanup uses continuity instead of teleporting');
    assert.equal(controller.punctureBeginCount, 1);
    assert.equal(director.beginCalls.length, 1);
    assert.equal(director.cancelled.length, 1);
  } finally {
    controller.dispose();
  }
});

test('one sword puncture schedules one entry sequence and progressive depth adds no duplicate presentation', () => {
  const counts = { wound: 0, penetration: 0, reaction: 0, entryBlood: 0, withdrawalBlood: 0, extraction: 0, audio: [], haptic: [], camera: 0 };
  const wound = { id: 'wound-1', directedBloodReady: false };
  const actor = {
    lifeState: 'alive',
    visualAdapter: { animationController: { getDiagnostics: () => ({ state: 'HOLDING' }) } },
    physiology: { interruptBreathing() {} },
    beginSwordThrustWound(payload) { counts.wound += 1; this.lastSwordPayload = payload; return wound; },
    applyPenetration() { counts.penetration += 1; return 0.01; },
    triggerReflex() { counts.reaction += 1; },
    onWeaponExtracted() { counts.extraction += 1; return wound; },
  };
  const bloodEffects = {
    emitEntry() { counts.entryBlood += 1; },
    emitWithdrawal() { counts.withdrawalBlood += 1; },
  };
  const feedbackSystem = {
    emitAudio(cue) { counts.audio.push(cue); },
    emitCombatHaptic(cue) { counts.haptic.push(cue); },
  };
  const director = new CombatDirector({ actor, bloodEffects, feedbackSystem, cameraFeedback: { shake() { counts.camera += 1; } } });
  const hit = { regionId: 'abdomen', region: { id: 'abdomen' } };
  const intent = { weaponId: 'dreadstone_sword', intent: MELEE_INTENTS.stab, ownerId: 2, speed: 1, intentional: true, damaging: true };
  const weapon = { id: 'dreadstone_sword', family: 'sword', bladeWidth: DREADSTONE_SWORD_DIMENSIONS.bladeWidth, bladeThickness: DREADSTONE_SWORD_DIMENSIONS.bladeThickness, maximumPenetrationDepth: SWORD_MAXIMUM_PENETRATION_DEPTH };
  const interaction = director.beginSwordPuncture({ weapon, intent, hit, entryPoint: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, -1), contactDirection: new THREE.Vector3(0, 0, -1), surfaceNormal: new THREE.Vector3(0, 0, 1), depth: 0.004, force: 1 });
  director.advancePenetration(interaction.id, { hit, entryPoint: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, -1), deltaDepth: 0.08, depth: 0.084, force: 0.5, resistanceProfile: { phase: 'muscle', drag: 0.4 } });
  director.advancePenetration(interaction.id, { hit, entryPoint: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, -1), deltaDepth: 0.08, depth: 0.164, force: 0.5, resistanceProfile: { phase: 'muscle', drag: 0.4 } });
  director.update(0.2);
  assert.equal(counts.wound, 1);
  assert.equal(counts.reaction, 1);
  assert.equal(counts.entryBlood, 1);
  assert.deepEqual(counts.audio, ['puncture']);
  assert.deepEqual(counts.haptic, ['penetration']);
  assert.equal(counts.camera, 1);
  assert.ok(counts.penetration >= 3);
  assert.equal(actor.lastSwordPayload.weaponProfile.maximumPenetrationDepth, SWORD_MAXIMUM_PENETRATION_DEPTH);
  director.beginWithdrawal(interaction.id, { direction: new THREE.Vector3(0, 0, 1), releaseSeverity: 0.164, position: new THREE.Vector3() });
  director.completeWithdrawal(interaction.id, { direction: new THREE.Vector3(0, 0, 1), releaseSeverity: 0.164, position: new THREE.Vector3() });
  director.completeWithdrawal(interaction.id, { direction: new THREE.Vector3(0, 0, 1), releaseSeverity: 0.164, position: new THREE.Vector3() });
  director.update(0.3);
  assert.equal(counts.extraction, 1);
  assert.equal(counts.withdrawalBlood, 1);
  assert.equal(counts.audio.filter((cue) => cue === 'extraction').length, 1);
  assert.equal(counts.haptic.filter((cue) => cue === 'extraction').length, 1);
  assert.equal(counts.camera, 2);
  assert.equal(director.eventLog.filter((event) => event.type === COMBAT_DIRECTOR_EVENTS.reaction).length, 1);
  director.dispose();
});

test('sword diagnostics expose bounded entry resistance and authoritative impalement cleanup state', async () => {
  const harness = await createSwordHarness();
  const { controller, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    stepAxial(controller, -1);
    const diagnostics = controller.getDiagnostics();
    assert.equal(diagnostics.runtimeCombatMode, SWORD_RUNTIME_COMBAT_MODE);
    assert.equal(diagnostics.impalementState, SWORD_IMPALEMENT_STATES.penetrating);
    assert.equal(diagnostics.ownedTargetActor, 'testman-owner');
    assert.equal(diagnostics.entryBody, 'upper_chest');
    assert.equal(diagnostics.entryRegion, 'upper_chest');
    assert.equal(diagnostics.maximumPenetrationDepth, SWORD_MAXIMUM_PENETRATION_DEPTH);
    assert.equal(diagnostics.depthInputMode, 'entry-anchored-thumb-delta-projection');
    assert.ok(diagnostics.desiredProjectedDepth > diagnostics.penetrationDepth);
    assert.ok(diagnostics.projectionError > 0 && diagnostics.projectionError < 0.012);
    assert.equal(diagnostics.penetrationActive, true);
    assert.equal(diagnostics.embeddedTargetId, 'testman-owner');
    assert.equal(diagnostics.embeddedTargetLifeState, 'alive');
    assert.equal(diagnostics.entryResistanceActive, true);
    assert.equal(diagnostics.entryResistanceDuration, SWORD_ENTRY_RESISTANCE_DURATION);
    assert.equal(diagnostics.entryResistanceMaximumLag, SWORD_ENTRY_RESISTANCE_MAXIMUM_LAG);
    assert.equal(diagnostics.extractionDetected, false);
    assert.equal(diagnostics.sameTargetCollisionSuppressionActive, true);
    assert.ok(diagnostics.sameTargetCollisionSuppressionCount > 0);
    assert.ok(diagnostics.directControlTrackingErrorWhileEmbedded < 0.012);
    assert.equal(diagnostics.lastImpalementCleanupReason, null);
    assert.equal(diagnostics.penetrationRate, SWORD_PENETRATION_RATE_METERS_PER_SECOND);
    assert.equal(diagnostics.withdrawalRate, SWORD_WITHDRAWAL_RATE_METERS_PER_SECOND);
    assert.equal('planted' in diagnostics, false);
    assert.equal('plantedAutoExtractionDistance' in diagnostics, false);
    assert.equal('automaticExtractionCount' in diagnostics, false);
    assert.equal('recallPlantedSwordIfSeparated' in SwordWorldWeaponController.prototype, false);
    assert.doesNotMatch(SwordWorldWeaponController.toString(), /plantedDesiredGrip|SWORD_PLANTED_AUTO_EXTRACTION_DISTANCE|walk-away-auto-extraction/);
    assert.equal(diagnostics.punctureBeginCount, 1);
    assert.equal(diagnostics.punctureWoundId, 'sword-wound-1');
    assert.ok(diagnostics.suppressedNonTipContacts <= 1_000_000);
  } finally {
    controller.dispose();
  }
});
