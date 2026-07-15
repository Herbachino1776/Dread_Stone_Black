import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { KNIFE_COMBAT_CONFIG } from '../src/game/combat/CombatConfig.js';
import { COMBAT_DIRECTOR_EVENTS, CombatDirector } from '../src/game/combat/CombatDirector.js';
import { MELEE_INTENTS } from '../src/game/combat/MeleeIntentWeapon.js';
import { KNIFE_RUNTIME_COMBAT_MODE } from '../src/game/combat/WorldKnifeCombatController.js';
import {
  DREADSTONE_SWORD_DIMENSIONS,
  SWORD_IMPALEMENT_STATES,
  SWORD_MAXIMUM_PENETRATION_DEPTH,
  SWORD_PENETRATION_RATE_METERS_PER_SECOND,
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

async function createSwordHarness({ tipHit = true } = {}) {
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
    disposed: false,
    bodies: new Map([['upper_chest', { body }]]),
    activeEmbeddedWeapon: null,
    setEmbeddedWeapon(weapon) { this.activeEmbeddedWeapon = weapon; },
    woundSystem: { markExtracted() {} },
  };
  const director = {
    nextId: 1,
    beginCalls: [],
    advanceCalls: [],
    withdrawalCalls: [],
    completionCalls: [],
    resistanceCalls: [],
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
    cancelInteraction(id, reason) { this.cancelled.push({ id, reason }); return true; },
    beginEdgeDamage() { throw new Error('edge damage must remain dormant in puncture-only mode'); },
    reportContact() { throw new Error('non-tip contact must remain silent in puncture-only mode'); },
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
    castWeaponTip(previousTip, currentTip) {
      this.castCount += 1;
      if (!this.tipHit) return null;
      return { collider, time_of_impact: 0.5, normal1: { x: 0, y: 0, z: 1 } };
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
  return { controller, actor, body, collider, director, hit, physics, scene };
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
  controller.beforePhysics(dt);
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

test('sword thrust recognition is independent of resolveSwordLeadingPart and pointer-local intent classification', async () => {
  assert.doesNotMatch(SwordWorldWeaponController.prototype.solveFreeSwordPose.toString(), /resolveSwordLeadingPart/);
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

test('one tip contact owns one wound before progressive fixed-axis penetration', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, director, physics } = harness;
  try {
    const entry = beginHarnessThrust(harness);
    assert.equal(controller.state, SWORD_IMPALEMENT_STATES.surfaceContact);
    assert.equal(controller.punctureBeginCount, 1);
    assert.equal(director.beginCalls.length, 1);
    assert.equal(entry.woundId, null);
    const wound = director.rupture();
    assert.equal(entry.woundId, wound.id);
    assert.equal(entry.surfaceRuptured, true);
    const initialDepth = controller.penetrationDepth;
    stepAxial(controller, -1);
    assert.equal(controller.state, SWORD_IMPALEMENT_STATES.penetrating);
    assert.ok(controller.penetrationDepth > initialDepth);
    assert.equal(controller.penetrationDepth, initialDepth + SWORD_PENETRATION_RATE_METERS_PER_SECOND * FIXED_DT);
    assert.equal(director.beginCalls.length, 1);
    assert.equal(controller.punctureBeginCount, 1);
    assert.equal(physics.castCount, 1, 'embedded ownership prevents all further collider searches');
    assert.equal(actor.activeEmbeddedWeapon, controller);
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
    const guardDepth = guardCenter.clone().sub(worldEntry.point).dot(worldEntry.axis);
    assert.ok(guardDepth < 0, 'the guard remains outside the entry surface at maximum depth');
    assert.equal(SWORD_MAXIMUM_PENETRATION_DEPTH, DREADSTONE_SWORD_DIMENSIONS.bladeLength - 0.06);
  } finally {
    controller.dispose();
  }
});

test('release plants the sword on the owned animated body and projected reacquisition permits withdrawal', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, body, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    for (let frame = 0; frame < 16; frame += 1) stepAxial(controller, -1);
    const plantedDepth = controller.penetrationDepth;
    controller.releaseGrip('test-planted-release');
    assert.equal(controller.state, SWORD_IMPALEMENT_STATES.embedded);
    assert.equal(controller.entry.planted, true);
    const before = controller.getEntryWorldPose().point.clone();
    body.position.add(new THREE.Vector3(0.18, 0.07, -0.11));
    body.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.24);
    controller.beforePhysics(FIXED_DT);
    const after = controller.getEntryWorldPose();
    assert.ok(after.point.distanceTo(before) > 0.2);
    assert.equal(controller.penetrationDepth, plantedDepth);
    assert.ok(controller.currentTip.distanceTo(after.point.clone().addScaledVector(after.axis, plantedDepth)) < 1e-9);
    assert.equal(actor.activeEmbeddedWeapon, controller);
    assert.equal(controller.acquireGrip(8, 195, 560, 100), true);
    stepAxial(controller, 1);
    assert.equal(controller.state, SWORD_IMPALEMENT_STATES.withdrawing);
    assert.ok(controller.penetrationDepth < plantedDepth);
    assert.equal(director.withdrawalCalls.length, 1);
  } finally {
    controller.dispose();
  }
});

test('complete withdrawal is single-shot and rearming requires the full surface clearance', async () => {
  const harness = await createSwordHarness();
  const { controller, actor, director } = harness;
  try {
    beginHarnessThrust(harness);
    director.rupture();
    for (let frame = 0; frame < 10; frame += 1) stepAxial(controller, -1);
    for (let frame = 0; frame < 40 && controller.entry; frame += 1) stepAxial(controller, 1);
    assert.equal(controller.entry, null);
    assert.equal(controller.state, SWORD_IMPALEMENT_STATES.returning);
    assert.equal(controller.extractionCount, 1);
    assert.equal(director.withdrawalCalls.length, 1);
    assert.equal(director.completionCalls.length, 1);
    assert.equal(actor.activeEmbeddedWeapon, null);
    assert.equal(controller.rearmReady, false);
    const gate = controller.rearmGate;
    const entryPoint = gate.localPoint.clone().applyQuaternion(gate.body.quaternion).add(gate.body.position);
    const entryAxis = gate.localAxis.clone().applyQuaternion(gate.body.quaternion).normalize();
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
    assert.equal(physics.castCount, 1);
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
    actor.disposed = true;
    controller.beforePhysics(FIXED_DT);
    assert.equal(controller.entry, null);
    assert.equal(controller.state, SWORD_IMPALEMENT_STATES.ready);
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

test('sword diagnostics expose bounded impalement ownership and rate counters without console logging', async () => {
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
    assert.equal(diagnostics.penetrationRate, SWORD_PENETRATION_RATE_METERS_PER_SECOND);
    assert.equal(diagnostics.withdrawalRate, SWORD_WITHDRAWAL_RATE_METERS_PER_SECOND);
    assert.equal(diagnostics.punctureBeginCount, 1);
    assert.equal(diagnostics.punctureWoundId, 'sword-wound-1');
    assert.ok(diagnostics.suppressedNonTipContacts <= 1_000_000);
  } finally {
    controller.dispose();
  }
});
