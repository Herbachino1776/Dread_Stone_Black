import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { COMBAT_REQUIRED_REGION_IDS, HUMANOID_ANATOMY_REGIONS, HUMANOID_BODY_CONFIG, HUMANOID_JOINT_CONFIG, KNIFE_COMBAT_CONFIG, validateCombatConfiguration } from '../src/game/combat/CombatConfig.js';
import { advancePenetrationDepth, clampWorkspacePoint, classifyKnifeContact, classifySlashContact, computeWorldThrust, deriveBladeTip, extendSlashLength, normalizedBladeForward, visibleCollisionTransformsWithinTolerance } from '../src/game/combat/CombatMath.js';
import { CombatPhysicsWorld, initializeCombatPhysics } from '../src/game/combat/CombatPhysicsWorld.js';
import { CollisionWorld } from '../src/game/Collision.js';
import { HumanoidCombatActor } from '../src/game/combat/HumanoidCombatActor.js';
import { CombatFeedbackSystem } from '../src/game/combat/CombatFeedbackSystem.js';
import { FolsomCombatEncounter } from '../src/game/combat/FolsomCombatEncounter.js';
import { CURRENT_HUMANOID_PROFILE, MODEL_IDLE_COMBAT_PROFILE } from '../src/game/combat/HumanoidModelProfiles.js';
import { BLOOD_COLOR_PALETTE, BLOOD_EFFECT_CONFIG, SLASH_CONFIG, VESSEL_ZONES, WOUND_CONFIG, validateCombatStage2Configuration } from '../src/game/combat/CombatStage2Config.js';
import { WorldKnifeCombatController, computeBladeSurfaceCorrection, resolveSlashLeadingPart } from '../src/game/combat/WorldKnifeCombatController.js';
import { KNIFE_CONTROL_STATES, canKnifeCreateOffensiveContact, criticallyDampedReturnProgress, getKnifeReleasePlan } from '../src/game/combat/KnifeControlState.js';
import { COMBAT_MORTALITY_MODES, IMMORTAL_REACTIVE_CONFIG, resolveCombatMortalityMode } from '../src/game/combat/CombatMortality.js';
import { applySolvedBoneLocalTransform, captureModelSpaceBoneBinding, measureVisibleSkinnedBounds, resolveRequiredBoneMappings, solveModelSpaceBoneLocal } from '../src/game/combat/HumanoidGlbVisualAdapter.js';
import { PAIN_REACTION_LIMITS, ProceduralPainReactionController, buildReactionPose, getReactionFamily, resolveReactionTiming } from '../src/game/combat/ProceduralPainReaction.js';
import { MAX_SLASH_SURFACE_SAMPLES, WOUND_SURFACE_BIAS, findClosestSkinnedSurface, reconstructSkinnedSurface, sampleSlashPath, validateSurfaceBinding } from '../src/game/combat/SkinnedSurfaceBinding.js';
import { COMBAT_DIRECTOR_EVENTS, CombatDirector, PENETRATION_STAGES, resolveMeleeTimeline } from '../src/game/combat/CombatDirector.js';
import { isDamageIntent, MELEE_INTENTS, MeleeIntentWeapon } from '../src/game/combat/MeleeIntentWeapon.js';
import { Feedback } from '../src/game/Feedback.js';
import { applyMeleeSpacingEnvelope, resolveMeleeSpacingEnvelope, resolveWeaponMicroResponse, sampleTissueResistanceCurve } from '../src/game/combat/CombatPresentation.js';

async function createActor() {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  return { physics, scene, actor: new HumanoidCombatActor({ physics, scene }) };
}

function makeHit(actor, bodyId, localPoint = new THREE.Vector3(0, 0, 0.1), regionOverride = null) {
  const entry = actor.bodies.get(bodyId);
  const collider = actor.colliders.get(bodyId);
  const translation = entry.body.translation();
  const rotation = entry.body.rotation();
  const worldPoint = localPoint.clone().applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)).add(new THREE.Vector3(translation.x, translation.y, translation.z));
  const hit = actor.resolveHit(collider, worldPoint);
  if (regionOverride) {
    hit.regionId = regionOverride;
    hit.region = HUMANOID_ANATOMY_REGIONS.find((region) => region.id === regionOverride);
  }
  return { hit, worldPoint };
}

test('combat configuration has believable semantic anatomy and physical mass', () => {
  const result = validateCombatConfiguration();
  assert.equal(result.valid, true);
  assert.equal(result.bodyCount, 18);
  assert.equal(result.jointCount, 17);
  assert.ok(result.totalMass >= 65 && result.totalMass <= 90);
  assert.deepEqual(COMBAT_REQUIRED_REGION_IDS.filter((id) => !HUMANOID_ANATOMY_REGIONS.some((region) => region.id === id)), []);
  assert.equal(new Set(HUMANOID_BODY_CONFIG.map((body) => body.id)).size, HUMANOID_BODY_CONFIG.length);
  assert.equal(new Set(HUMANOID_JOINT_CONFIG.map((joint) => joint.id)).size, HUMANOID_JOINT_CONFIG.length);
});

test('tissue and hard structure depths remain physically bounded', () => {
  HUMANOID_ANATOMY_REGIONS.forEach((region) => {
    assert.ok(region.maximumTissueDepth > 0);
    if (region.hardStructure) assert.ok(region.hardStructureDepth > 0 && region.hardStructureDepth <= region.maximumTissueDepth);
  });
  assert.ok(KNIFE_COMBAT_CONFIG.maximumPenetrationDepth <= KNIFE_COMBAT_CONFIG.bladeLength);
  assert.ok(KNIFE_COMBAT_CONFIG.bladeLength >= 0.22 && KNIFE_COMBAT_CONFIG.bladeLength <= 0.26);
  assert.ok(KNIFE_COMBAT_CONFIG.handleLength >= 0.11 && KNIFE_COMBAT_CONFIG.handleLength <= 0.14);
  assert.equal(KNIFE_COMBAT_CONFIG.overallLength, KNIFE_COMBAT_CONFIG.bladeLength + KNIFE_COMBAT_CONFIG.handleLength);
});

test('thumb ownership and deliberate input are mandatory for offensive knife contact', () => {
  const attack = { pointerOwnerId: 7, state: KNIFE_CONTROL_STATES.attacking, deliberateSpeed: 1.2, minimumSpeed: 0.1 };
  assert.equal(canKnifeCreateOffensiveContact(attack), true, 'a grip-owned deliberate attack may damage');
  assert.equal(canKnifeCreateOffensiveContact({ ...attack, pointerOwnerId: null }), false, 'walking or camera movement without an owner cannot puncture or slash');
  assert.equal(canKnifeCreateOffensiveContact({ ...attack, deliberateSpeed: 0 }), false, 'idle sway and enemy motion cannot supply attack energy');
  assert.equal(canKnifeCreateOffensiveContact({ ...attack, state: KNIFE_CONTROL_STATES.returning }), false, 'spring return cannot cut');
  assert.equal(canKnifeCreateOffensiveContact({ ...attack, state: KNIFE_CONTROL_STATES.withdrawing }), false, 'assisted withdrawal cannot create a new wound');
});

test('generic melee intent separates owned attacks from locomotion, return, and withdrawal', () => {
  const intentWeapon = new MeleeIntentWeapon({ weaponId: 'test_melee', minimumIntentSpeed: 0.03 });
  assert.equal(intentWeapon.interpret({ ownerId: null, controlState: 'attacking', localVelocity: { x: 2, y: 0, z: -2 } }).intent, MELEE_INTENTS.idle);
  assert.equal(isDamageIntent(intentWeapon.current), false, 'passive world or player movement has no damaging owner');
  assert.equal(intentWeapon.interpret({ ownerId: 4, controlState: 'returning', localVelocity: { x: 0, y: 0, z: -2 } }).damaging, false);
  assert.equal(intentWeapon.interpret({ ownerId: 4, controlState: 'attacking', localVelocity: { x: 0, y: 0, z: -2 } }).intent, MELEE_INTENTS.stab);
  assert.equal(intentWeapon.interpret({ ownerId: 4, controlState: 'attacking', localVelocity: { x: 2, y: 0, z: 0 } }).intent, MELEE_INTENTS.slash);
  assert.equal(intentWeapon.interpret({ ownerId: 4, controlState: 'withdrawing', localVelocity: { x: 0, y: 0, z: 2 }, embedded: true }).intent, MELEE_INTENTS.withdraw);
});

test('Combat Director executes successful melee interactions on one deterministic staged timeline', () => {
  const director = new CombatDirector();
  const observed = [];
  director.subscribe('*', (event) => observed.push([event.time, event.sequence, event.type, event.payload.stage ?? event.payload.action ?? event.payload.cue]));
  const intent = { weaponId: 'future_spear', intent: MELEE_INTENTS.stab, ownerId: 9, speed: 1.2, intentional: true, damaging: true };
  const interaction = director.beginPuncture({ weapon: { id: 'future_spear', family: 'spear' }, intent, hit: {}, entryPoint: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, -1), depth: 0.01, force: 1 });
  assert.ok(interaction, 'weapon-agnostic profiles can enter the director');
  assert.equal(director.beginPuncture({ weapon: { id: 'passive_claw' }, intent: { ...intent, ownerId: null, intentional: false, damaging: false } }), null, 'unowned motion is rejected before damage scheduling');
  director.update(0.16);
  const stages = observed.filter((entry) => entry[2] === COMBAT_DIRECTOR_EVENTS.lifecycle).map((entry) => entry[3]);
  assert.deepEqual(stages, [PENETRATION_STAGES.approach, PENETRATION_STAGES.surfaceContact, PENETRATION_STAGES.surfaceCompression, PENETRATION_STAGES.surfaceRupture, PENETRATION_STAGES.softTissue, PENETRATION_STAGES.embedded]);
  assert.ok(observed.every((entry, index) => index === 0 || entry[0] > observed[index - 1][0] || entry[0] === observed[index - 1][0] && entry[1] > observed[index - 1][1]), 'equal-time events retain insertion order');
  assert.ok(new Set(observed.map((entry) => entry[0])).size >= 8, 'wound, reaction, audio, blood, camera, and haptic work does not collapse into one instant');
  const skinBreakTime = observed.find((entry) => entry[2] === COMBAT_DIRECTOR_EVENTS.audio && entry[3] === 'puncture')[0];
  const reactionTime = observed.find((entry) => entry[2] === COMBAT_DIRECTOR_EVENTS.reaction)[0];
  const bloodTime = observed.find((entry) => entry[2] === COMBAT_DIRECTOR_EVENTS.blood && entry[3] === 'entry')[0];
  const cameraTime = observed.find((entry) => entry[2] === COMBAT_DIRECTOR_EVENTS.camera)[0];
  assert.ok(skinBreakTime < reactionTime && reactionTime < bloodTime && bloodTime < cameraTime, 'skin break, reaction, seep, and camera impulse remain individually readable');
  assert.ok(director.getDiagnostics().pooledEvents > 0, 'executed timeline events return to the bounded event pool');
  director.dispose();
});

test('melee spacing leaves load room at minimum collision distance and reaches authored full depth', () => {
  const readyReach = Math.abs(KNIFE_COMBAT_CONFIG.workspace.ready[2]) + KNIFE_COMBAT_CONFIG.bladeLength;
  const envelope = resolveMeleeSpacingEnvelope({ playerRadius: 0.5, readyReach, gestureReach: KNIFE_COMBAT_CONFIG.workspace.thrustDistance, effectiveDepth: KNIFE_COMBAT_CONFIG.maximumPenetrationDepth });
  assert.ok(envelope.loadingClearance >= 0.06, 'the ready tip cannot touch the target at minimum player collision distance');
  assert.ok(envelope.fullGestureDepth >= KNIFE_COMBAT_CONFIG.maximumPenetrationDepth, 'one full comfortable gesture can still reach maximum penetration');
  assert.ok(envelope.fullGestureDepth - KNIFE_COMBAT_CONFIG.maximumPenetrationDepth <= 0.03, 'full gesture overtravel remains small and controlled');
  assert.ok(Math.abs(0.5 + envelope.blockerRadius - envelope.minimumCenterDistance) < 1e-8);
  const blocker = { radius: 0.29, userData: {} };
  assert.equal(applyMeleeSpacingEnvelope(blocker, { playerRadius: 0.5, readyReach, gestureReach: KNIFE_COMBAT_CONFIG.workspace.thrustDistance, effectiveDepth: KNIFE_COMBAT_CONFIG.maximumPenetrationDepth }).blockerRadius, blocker.radius);
});

test('continuous tissue curves progress from light skin to muscle, bone approach, and sticky release', () => {
  const base = { surfaceThickness: 0.012, softTissueResistance: 0.48, hardDepth: 0.1, hardStructureResistance: 1.8 };
  const skin = sampleTissueResistanceCurve({ ...base, depth: 0.004 });
  const muscle = sampleTissueResistanceCurve({ ...base, depth: 0.055 });
  const bone = sampleTissueResistanceCurve({ ...base, depth: 0.095 });
  const withdrawalDeep = sampleTissueResistanceCurve({ ...base, depth: 0.07, withdrawing: true });
  const withdrawalExit = sampleTissueResistanceCurve({ ...base, depth: 0.002, withdrawing: true });
  assert.ok(skin.effectiveResistance < muscle.effectiveResistance);
  assert.ok(muscle.effectiveResistance < bone.effectiveResistance);
  assert.equal(skin.phase, 'skin');
  assert.equal(muscle.phase, 'muscle');
  assert.equal(bone.phase, 'bone_approach');
  assert.ok(withdrawalDeep.effectiveResistance > withdrawalExit.effectiveResistance, 'adhesion releases progressively near the surface');
  assert.equal(withdrawalExit.phase, 'surface_release');
});

test('weapon micro responses stay within millimeter and few-degree presentation limits', () => {
  const response = resolveWeaponMicroResponse('hard_stop', 1, -0.7);
  assert.ok(response.compression <= 0.006);
  assert.ok(response.recoil <= 0.0045);
  assert.ok(Math.abs(THREE.MathUtils.radToDeg(response.roll)) <= 2.4);
  assert.ok(Math.abs(THREE.MathUtils.radToDeg(response.twist)) <= 2.4);
  assert.ok(response.vibration <= 0.00075);
});

test('camera combat impulse is directional, bounded, deterministic, and non-oscillating', () => {
  const camera = new THREE.PerspectiveCamera();
  const feedback = new Feedback(camera);
  feedback.shake({ durationMs: 110, intensity: 0.01, direction: new THREE.Vector3(0, 0, -1), polarity: -1, damping: 18 });
  const samples = [];
  for (let index = 0; index < 14; index += 1) {
    camera.position.set(0, 0, 0);
    feedback.update(0.01);
    samples.push(camera.position.z);
  }
  assert.ok(samples.some((value) => value > 0));
  assert.ok(samples.every((value) => value >= -1e-9 && value <= 0.010001), 'camera settles along one restrained recoil direction without oscillation');
  assert.equal(feedback.getDiagnostics().active, false);
});

test('future melee profiles can override bounded timing offsets without replacing the director', () => {
  const profile = { id: 'future_axe', family: 'axe', timeline: { slash: { audio: 0.03, recovery: 0.12 } } };
  const timeline = resolveMeleeTimeline('slash', profile);
  assert.equal(timeline.audio, 0.03);
  assert.equal(timeline.recovery, 0.12);
  assert.ok(timeline.rupture > 0, 'unspecified stages retain foundation defaults');
  assert.throws(() => resolveMeleeTimeline('slash', { timeline: { slash: { recovery: -1 } } }), /Invalid slash timeline offset/);
  assert.throws(() => resolveMeleeTimeline('slash', { timeline: { slash: { magicSmoke: 0.1 } } }), /Unknown slash timeline offset/);
});

test('penetration withdrawal cannot regress into a later embedded stage', () => {
  const director = new CombatDirector();
  const intent = { weaponId: 'test_spear', intent: MELEE_INTENTS.stab, ownerId: 3, speed: 1, intentional: true, damaging: true };
  const interaction = director.beginPuncture({ weapon: { id: 'test_spear', family: 'spear' }, intent, hit: {}, entryPoint: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, -1), depth: 0.01, force: 1 });
  director.beginWithdrawal(interaction.id, { direction: new THREE.Vector3(0, 0, 1), releaseSeverity: 0.01, position: new THREE.Vector3() });
  director.completeWithdrawal(interaction.id, { direction: new THREE.Vector3(0, 0, 1), releaseSeverity: 0.01, position: new THREE.Vector3() });
  director.update(0.25);
  assert.deepEqual(interaction.stageHistory.map((entry) => entry.stage), [PENETRATION_STAGES.approach, PENETRATION_STAGES.surfaceContact, PENETRATION_STAGES.surfaceCompression, PENETRATION_STAGES.surfaceRupture, PENETRATION_STAGES.softTissue, PENETRATION_STAGES.withdrawal, PENETRATION_STAGES.exit, PENETRATION_STAGES.recovery]);
  assert.equal(interaction.completed, true);
  director.dispose();
});

test('knife release plans use bounded free, failed-contact, and embedded returns', () => {
  const free = getKnifeReleasePlan({ config: KNIFE_COMBAT_CONFIG });
  const failed = getKnifeReleasePlan({ failedContact: true, config: KNIFE_COMBAT_CONFIG });
  const shallow = getKnifeReleasePlan({ embeddedDepth: 0.01, config: KNIFE_COMBAT_CONFIG });
  const deep = getKnifeReleasePlan({ embeddedDepth: KNIFE_COMBAT_CONFIG.maximumPenetrationDepth, config: KNIFE_COMBAT_CONFIG });
  assert.equal(free.state, KNIFE_CONTROL_STATES.returning);
  assert.ok(free.durationSeconds >= 0.12 && free.durationSeconds <= 0.18);
  assert.ok(failed.durationSeconds >= 0.16 && failed.durationSeconds <= 0.22);
  assert.equal(shallow.state, KNIFE_CONTROL_STATES.withdrawing);
  assert.ok(shallow.durationSeconds >= 0.25 && deep.durationSeconds <= 0.4);
  assert.ok(deep.durationSeconds > shallow.durationSeconds);
  const springSamples = [0, 0.03, 0.06, 0.09, 0.12, 0.15].map((time) => criticallyDampedReturnProgress(time, 0.15));
  assert.equal(springSamples[0], 0);
  assert.equal(springSamples.at(-1), 1);
  assert.ok(springSamples.every((value, index) => index === 0 || value >= springSamples[index - 1]), 'critical return is monotonic and cannot oscillate');
});

test('knife tip and forward axis derive from one world transform', () => {
  const grip = new THREE.Vector3(1, 2, 3);
  const rotation = new THREE.Quaternion();
  assert.deepEqual(normalizedBladeForward(rotation).toArray(), [0, 0, -1]);
  assert.deepEqual(deriveBladeTip(grip, rotation, 0.5).toArray(), [1, 2, 2.5]);
});

test('thrust advances along blade orientation in all aim directions', () => {
  const start = new THREE.Vector3();
  const directions = [
    [new THREE.Euler(0, 0, 0), new THREE.Vector3(0, 0, -1)],
    [new THREE.Euler(Math.PI / 2, 0, 0), new THREE.Vector3(0, 1, 0)],
    [new THREE.Euler(-Math.PI / 2, 0, 0), new THREE.Vector3(0, -1, 0)],
    [new THREE.Euler(0, -Math.PI / 2, 0), new THREE.Vector3(1, 0, 0)],
    [new THREE.Euler(0, Math.PI / 2, 0), new THREE.Vector3(-1, 0, 0)],
  ];
  directions.forEach(([euler, expected]) => assert.ok(computeWorldThrust(start, new THREE.Quaternion().setFromEuler(euler), 1).distanceTo(expected) < 1e-6));
});

test('world thrust does not converge on reticle or target centers', () => {
  const start = new THREE.Vector3(0.35, 0.2, 0);
  const targetTorso = new THREE.Vector3(0, 0, -3);
  const end = computeWorldThrust(start, new THREE.Quaternion(), 0.6);
  assert.equal(end.x, 0.35);
  assert.notEqual(end.x, targetTorso.x);
});

test('camera rotation rotates path without teleporting the grip', () => {
  const grip = new THREE.Vector3(0.2, 1.2, -0.5);
  const before = deriveBladeTip(grip, new THREE.Quaternion(), 0.52);
  const after = deriveBladeTip(grip, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.2), 0.52);
  assert.ok(after.distanceTo(before) < 0.12);
  assert.deepEqual(grip.toArray(), [0.2, 1.2, -0.5]);
});

test('hand workspace clamps extreme input and excludes behind-camera positions', () => {
  const result = clampWorkspacePoint(new THREE.Vector3(20, -20, 4), KNIFE_COMBAT_CONFIG.workspace, new THREE.Vector3());
  assert.equal(result.x, KNIFE_COMBAT_CONFIG.workspace.max[0]);
  assert.equal(result.y, KNIFE_COMBAT_CONFIG.workspace.min[1]);
  assert.equal(result.z, KNIFE_COMBAT_CONFIG.workspace.max[2]);
  assert.ok(result.z < 0);
});

test('visible and collision weapon transforms share authored tolerance', () => {
  const position = new THREE.Vector3(1, 2, 3);
  const quaternion = new THREE.Quaternion();
  assert.equal(visibleCollisionTransformsWithinTolerance(position, position.clone(), quaternion, quaternion.clone(), KNIFE_COMBAT_CONFIG.visibleCollisionTolerance), true);
  assert.equal(visibleCollisionTransformsWithinTolerance(position, position.clone().addScalar(0.2), quaternion, quaternion.clone(), KNIFE_COMBAT_CONFIG.visibleCollisionTolerance), false);
});

test('GLB physics binding preserves bind pose and authored bone scale under model normalization', () => {
  const modelRoot = new THREE.Group();
  modelRoot.position.set(3, 0.2, -5);
  modelRoot.rotation.y = 0.6;
  modelRoot.scale.setScalar(0.0243);
  const parent = new THREE.Bone();
  parent.position.set(0.4, 40, -0.3);
  const bone = new THREE.Bone();
  bone.position.set(0, 7.9, 0);
  bone.quaternion.setFromEuler(new THREE.Euler(0.12, -0.18, 0.04));
  bone.scale.set(1, 1, 1);
  parent.add(bone);
  modelRoot.add(parent);
  modelRoot.updateMatrixWorld(true);
  const authoredLocal = bone.matrix.clone();
  const authoredScale = bone.scale.clone();
  const bodyBindWorld = new THREE.Matrix4().compose(new THREE.Vector3(3.02, 1.55, -5.12), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04, 0.65, -0.02)), new THREE.Vector3(1, 1, 1));
  const bindOffset = captureModelSpaceBoneBinding({ modelRootWorld: modelRoot.matrixWorld, bodyBindWorld, boneBindWorld: bone.matrixWorld });
  const solvedLocal = solveModelSpaceBoneLocal({ modelRootWorld: modelRoot.matrixWorld, parentWorld: parent.matrixWorld, bodyWorld: bodyBindWorld, bindOffset });
  const solvedPosition = new THREE.Vector3();
  const solvedRotation = new THREE.Quaternion();
  const solvedScale = new THREE.Vector3();
  solvedLocal.decompose(solvedPosition, solvedRotation, solvedScale);
  const expectedPosition = new THREE.Vector3();
  const expectedRotation = new THREE.Quaternion();
  const expectedScale = new THREE.Vector3();
  authoredLocal.decompose(expectedPosition, expectedRotation, expectedScale);
  assert.ok(solvedPosition.distanceTo(expectedPosition) < 1e-5, 'bind solve retains authored local bone position');
  assert.ok(1 - Math.abs(solvedRotation.dot(expectedRotation)) < 1e-6, 'bind solve retains authored local bone rotation');
  assert.ok(solvedScale.distanceTo(authoredScale) < 1e-6, 'normalized model scale does not leak into local bone scale');
  const scaleContaminatedLocal = solvedLocal.clone().scale(new THREE.Vector3(1.000001, 0.999999, 1.000002));
  for (let frame = 0; frame < 600; frame += 1) applySolvedBoneLocalTransform(bone, scaleContaminatedLocal, authoredScale);
  assert.deepEqual(bone.scale.toArray(), authoredScale.toArray(), 'per-frame matrix decomposition cannot accumulate scale drift into the skin');
});

test('diagnostic GLB profiles fail clearly when a required mapped bone is missing', () => {
  const bodies = new Map([['pelvis', {}], ['head', {}]]);
  const bones = new Map([['body', new THREE.Bone()]]);
  assert.throws(
    () => resolveRequiredBoneMappings({ bones, bodies, boneMap: { pelvis: 'body', head: 'missing_head' }, profileName: 'diagnostic-test-profile' }),
    /diagnostic-test-profile is missing required mappings: head -> missing_head/,
  );
});

function createReactionRig() {
  const root = new THREE.Group();
  const bones = new Map(Object.keys(MODEL_IDLE_COMBAT_PROFILE.boneMap).map((id) => {
    const bone = new THREE.Bone();
    bone.name = id;
    bone.scale.set(1, 1, 1);
    root.add(bone);
    return [id, bone];
  }));
  const controller = new ProceduralPainReactionController({ bones, presentationRoot: root, basePosition: new THREE.Vector3(), baseYaw: 0 });
  return { root, bones, controller };
}

function createSkinnedSurfaceFixture() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0], 3));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(16), 4));
  const weights = new Float32Array(16);
  for (let index = 0; index < 4; index += 1) weights[index * 4] = 1;
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const bone = new THREE.Bone();
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.name = 'test-visible-skinned-surface';
  mesh.add(bone);
  mesh.bind(new THREE.Skeleton([bone]));
  const root = new THREE.Group();
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.skeleton.update();
  return { root, mesh, bone, geometry };
}

test('procedural reactions are region-specific, direction-aware, severity-scaled, and time-bounded', () => {
  assert.equal(getReactionFamily('upper_chest'), 'torso');
  assert.equal(getReactionFamily('neck'), 'neck');
  assert.equal(getReactionFamily('left_forearm'), 'arm');
  assert.equal(getReactionFamily('right_thigh'), 'leg');
  const shallow = buildReactionPose({ regionId: 'upper_chest', severity: 0.2, depth: 0.01, localDirection: new THREE.Vector3(-0.7, 0, -0.7).normalize() });
  const deep = buildReactionPose({ regionId: 'upper_chest', severity: 0.9, depth: 0.12, localDirection: new THREE.Vector3(-0.7, 0, -0.7).normalize() });
  const opposite = buildReactionPose({ regionId: 'upper_chest', severity: 0.9, depth: 0.12, localDirection: new THREE.Vector3(0.7, 0, -0.7).normalize() });
  assert.ok(deep.rotations.get('lower_chest').length() > shallow.rotations.get('lower_chest').length());
  assert.equal(Math.sign(deep.rotations.get('lower_chest').z), -Math.sign(opposite.rotations.get('lower_chest').z));
  assert.ok(deep.rootRecoil.dot(new THREE.Vector3(-0.7, 0, -0.7).normalize()) > 0, 'whole-root recoil follows blade travel away from the attacker');
  assert.ok([...deep.rotations.values()].every((rotation) => rotation.length() <= PAIN_REACTION_LIMITS.maximumBoneAngle + 1e-8));
  assert.deepEqual([...buildReactionPose({ regionId: 'neck', severity: 0.8 }).rotations.keys()].includes('head'), true);
  assert.deepEqual([...buildReactionPose({ regionId: 'left_forearm', severity: 0.8 }).rotations.keys()].filter((id) => id.includes('arm')), ['left_upper_arm', 'left_forearm']);
  assert.ok(buildReactionPose({ regionId: 'right_thigh', severity: 0.8 }).rotations.has('pelvis'));
  const neckTiming = resolveReactionTiming('neck', 0.8);
  const legTiming = resolveReactionTiming('right_thigh', 0.8);
  assert.ok(neckTiming.impact >= 0.05 && neckTiming.impact <= 0.09);
  assert.ok(legTiming.recovery > neckTiming.recovery);
});

test('reaction variation and impact memory change guarding without exceeding pose limits', () => {
  const base = { regionId: 'upper_chest', severity: 0.55, localDirection: new THREE.Vector3(0.35, 0, -1).normalize(), depth: 0.06 };
  const first = buildReactionPose({ ...base, variation: -0.75, impactMemory: 0.15 });
  const repeated = buildReactionPose({ ...base, variation: 0.75, impactMemory: 0.65, recoveryWeight: 0.4 });
  assert.ok(first.rotations.get('lower_chest').distanceTo(repeated.rotations.get('lower_chest')) > 0.001, 'deterministic variation prevents identical repeated chest motion');
  assert.ok(repeated.rotations.get('left_upper_arm').length() > first.rotations.get('left_upper_arm').length(), 'recent torso wounds increase restrained guarding');
  repeated.rotations.forEach((rotation) => assert.ok(rotation.length() <= PAIN_REACTION_LIMITS.maximumBoneAngle + 1e-8));
});

test('reaction controller preserves mixer-authored scales, clamps repeated hits, resets, and cannot accumulate pose drift', () => {
  const { root, bones, controller } = createReactionRig();
  const authoredScales = new Map([...bones].map(([id, bone]) => [id, bone.scale.clone()]));
  for (let hit = 0; hit < 40; hit += 1) controller.trigger({ regionId: hit % 2 ? 'neck' : 'upper_chest', severity: 1.4, depth: 0.16, worldDirection: new THREE.Vector3(hit % 2 ? 1 : -1, 0, -1).normalize(), actorState: 'alive' });
  for (let frame = 0; frame < 90; frame += 1) {
    bones.forEach((bone) => bone.quaternion.identity()); // stand-in for the fresh AnimationMixer-authored local pose
    controller.applyAfterMixer(1 / 60);
    assert.ok([...controller.currentRotations.values()].every((rotation) => rotation.length() <= PAIN_REACTION_LIMITS.maximumBoneAngle + 1e-8));
  }
  assert.equal(controller.getDiagnostics().phase, 'idle');
  bones.forEach((bone, id) => {
    assert.ok(1 - Math.abs(bone.quaternion.w) < 1e-8, `${id} returns to the fresh authored pose`);
    assert.deepEqual(bone.scale.toArray(), authoredScales.get(id).toArray(), `${id} scale remains mixer-authored`);
  });
  controller.trigger({ regionId: 'left_forearm', severity: 0.7, worldDirection: new THREE.Vector3(0, 0, -1), actorState: 'alive' });
  controller.reset();
  assert.equal(controller.getDiagnostics().phase, 'idle');
  assert.deepEqual(root.position.toArray(), [0, 0, 0]);
  controller.setEmbeddedTension({ regionId: 'upper_chest', depth: 0.12, worldDirection: new THREE.Vector3(0, 0, -1) });
  bones.forEach((bone) => bone.quaternion.identity());
  controller.applyAfterMixer(1 / 60);
  const firstTension = controller.embeddedTension;
  assert.ok(firstTension > 0 && firstTension < controller.embeddedTensionTarget, 'embedded depth eases into a bounded hold instead of snapping');
  bones.forEach((bone) => bone.quaternion.identity());
  controller.applyAfterMixer(1 / 60);
  assert.ok(controller.embeddedTension > firstTension && controller.embeddedTension < controller.embeddedTensionTarget);
});

test('puncture bindings store valid barycentrics and follow animated and procedural skinned movement', () => {
  const { root, mesh, bone, geometry } = createSkinnedSurfaceFixture();
  const hitPoint = new THREE.Vector3(0.12, 0.08, 0.03);
  const binding = findClosestSkinnedSurface([mesh], hitPoint, { regionId: 'upper_chest', bodyId: 'upper_chest' });
  assert.ok(validateSurfaceBinding(binding));
  assert.equal(binding.mesh, mesh);
  assert.ok(binding.triangleIndices.every((index) => index >= 0 && index < geometry.attributes.position.count));
  assert.ok(Math.abs(binding.barycentric.x + binding.barycentric.y + binding.barycentric.z - 1) < 1e-6);
  const initial = reconstructSkinnedSurface(binding);
  assert.ok(hitPoint.distanceTo(initial.point) < 0.05);
  assert.ok(WOUND_SURFACE_BIAS <= 0.003);
  bone.position.x = 0.18;
  root.updateMatrixWorld(true); mesh.skeleton.update();
  const animated = reconstructSkinnedSurface(binding);
  assert.ok(animated.point.distanceTo(initial.point) > 0.17, 'binding follows animated bone translation');
  bone.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.16);
  root.updateMatrixWorld(true); mesh.skeleton.update();
  const flinched = reconstructSkinnedSurface(binding);
  assert.ok(flinched.point.distanceTo(animated.point) > 0.001, 'binding follows additive procedural bone rotation');
  geometry.dispose(); mesh.material.dispose();
});

test('slash paths use bounded multi-sample surface bindings and never require one rigid quad', () => {
  const { mesh, geometry } = createSkinnedSurfaceFixture();
  const points = sampleSlashPath(new THREE.Vector3(-0.3, -0.2, 0.02), new THREE.Vector3(0.3, 0.25, 0.02), 8);
  const bindings = points.map((point) => findClosestSkinnedSurface([mesh], point, { regionId: 'upper_chest', bodyId: 'upper_chest' }));
  assert.ok(points.length >= 3 && points.length <= MAX_SLASH_SURFACE_SAMPLES);
  assert.ok(bindings.every(validateSurfaceBinding));
  assert.ok(bindings.every((binding) => reconstructSkinnedSurface(binding).point.distanceTo(binding.sourcePoint) < 0.05));
  const failed = findClosestSkinnedSurface([mesh], new THREE.Vector3(4, 4, 4));
  assert.equal(failed, null, 'failed projection can split the ribbon instead of bridging open space');
  geometry.dispose(); mesh.material.dispose();
});

test('wound and reaction lifecycle keeps one bounded pool and disposes generated resources', async () => {
  const { actor, physics } = await createActor();
  const geometryIds = actor.woundSystem.visualSlots.flatMap((slot) => [slot.puncture.geometry.uuid, slot.slash.geometry.uuid]);
  const punctureTexture = actor.woundSystem.punctureTexture;
  const slashTexture = actor.woundSystem.slashTexture;
  let disposedTextures = 0;
  punctureTexture.addEventListener('dispose', () => { disposedTextures += 1; });
  slashTexture.addEventListener('dispose', () => { disposedTextures += 1; });
  for (let cycle = 0; cycle < 4; cycle += 1) {
    const { hit, worldPoint } = makeHit(actor, cycle % 2 ? 'left_forearm' : 'upper_chest');
    const wound = actor.beginPunctureWound({ hit, entryPoint: worldPoint, direction: new THREE.Vector3(0, 0, -1), depth: 0.02 });
    actor.applyPenetration({ hit, entryPoint: worldPoint, direction: new THREE.Vector3(0, 0, -1), deltaDepth: 0.04, depth: 0.06, force: 1.2, woundId: wound.id });
    actor.reset();
    assert.equal(actor.woundSystem.wounds.length, 0);
    assert.equal(wound.surfaceBinding, null);
    assert.equal(wound.slashSamples.length, 0);
    assert.ok(actor.woundSystem.visualSlots.every((slot) => slot.woundId == null && !slot.puncture.visible && !slot.slash.visible));
    assert.deepEqual(actor.woundSystem.visualSlots.flatMap((slot) => [slot.puncture.geometry.uuid, slot.slash.geometry.uuid]), geometryIds, 'reset reuses the bounded geometry pool');
  }
  assert.equal(actor.visualAdapter, null, 'headless actor creates no duplicate mixer or reaction adapter');
  actor.dispose();
  assert.equal(disposedTextures, 2, 'generated alpha-mask textures are disposed exactly once');
  assert.equal(actor.woundSystem.visualSlots.length, 0);
  physics.dispose();
});

test('animation-authoritative bodies become dynamic only for bounded ragdoll collapse and reset to kinematic', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const actor = new HumanoidCombatActor({ physics, scene: new THREE.Scene(), visualProfile: MODEL_IDLE_COMBAT_PROFILE });
  actor.animationAuthorityReady = true;
  actor.visualAdapter = { beginRagdoll: () => true, updateRagdoll() {}, reset() {}, dispose() {} };
  assert.ok([...actor.bodies.values()].every(({ body }) => body.bodyType() === 2));
  assert.equal(actor.activateRagdoll({ forced: true }), true);
  assert.equal(actor.ragdollActive, true);
  assert.ok([...actor.bodies.values()].every(({ body }) => body.bodyType() === 0));
  actor.reset();
  assert.equal(actor.ragdollActive, false);
  assert.ok([...actor.bodies.values()].every(({ body }) => body.bodyType() === 2));
  actor.dispose();
  physics.dispose();
});

test('dynamic humanoid blocker prevents player pass-through and follows collapsed body footprint', async () => {
  const collision = new CollisionWorld({ walkableRects: [{ minX: -5, maxX: 5, minZ: -5, maxZ: 5 }], blockerRects: [], playerRadius: 0.35 });
  const blocker = { id: 'test-humanoid', type: 'combatActor', blockerShape: 'capsule', from: { x: 0, z: 0 }, to: { x: 0, z: 0 }, radius: 0.29 };
  collision.addBlocker(blocker);
  const start = new THREE.Vector3(0, 1.55, 1);
  const stopped = collision.moveWithCollision(start, new THREE.Vector3(0, 0, -1.4));
  assert.ok(stopped.z > 0.5, 'axis-separated substeps stop the player before entering the humanoid capsule');
  blocker.from.x = 2;
  blocker.to.x = 2.8;
  blocker.from.z = 0;
  blocker.to.z = 0;
  blocker.radius = 0.2;
  const clear = collision.moveWithCollision(start, new THREE.Vector3(0, 0, -1.4));
  assert.ok(clear.z < 0, 'moving ragdoll footprint does not leave an invisible standing blocker');
  collision.removeBlocker(blocker);
  assert.equal(collision.blockerRects.length, 0);
});

test('contact classifier distinguishes blunt, edge, glance, tip, failure, and puncture', () => {
  assert.equal(classifyKnifeContact({ part: 'pommel', speed: 2, alignment: 1 }).state, 'blunt_contact');
  assert.equal(classifyKnifeContact({ part: 'edge', speed: 2, alignment: 0 }).state, 'edge_contact');
  assert.equal(classifyKnifeContact({ speed: 2, alignment: 0.2 }).state, 'glancing_contact');
  assert.equal(classifyKnifeContact({ speed: 0.1, alignment: 1 }).state, 'failed_penetration');
  assert.equal(classifyKnifeContact({ speed: 2, alignment: 0.6 }).state, 'tip_contact');
  assert.equal(classifyKnifeContact({ speed: 2, alignment: 0.95 }).state, 'surface_puncture');
});

test('edge-aware slash classification rejects the flat, spine, jitter, and low pressure', () => {
  const valid = { edgeSpeed: 1.6, edgeAlignment: 0.92, pressure: 0.62, contactDuration: 0.08, travel: 0.12, tissueResistance: 0.45, clothingResistance: 0.12 };
  assert.equal(classifySlashContact({ ...valid, part: 'edge' }).state, 'deep_slash');
  assert.equal(classifySlashContact({ ...valid, part: 'flat' }).cuts, false);
  assert.equal(classifySlashContact({ ...valid, part: 'spine' }).cuts, false);
  assert.equal(classifySlashContact({ ...valid, part: 'edge', travel: 0.003 }).state, 'edge_touch_no_cut');
  assert.equal(classifySlashContact({ ...valid, part: 'edge', pressure: 0.02 }).cuts, false);
  assert.equal(classifySlashContact({ ...valid, part: 'edge', edgeAlignment: 0.1 }).state, 'scraping_contact');
  assert.equal(extendSlashLength(0.1, 2), 0.1 + SLASH_CONFIG.maximumStepLength);
  assert.ok(extendSlashLength(WOUND_CONFIG.maximumCutLength, 1) <= WOUND_CONFIG.maximumCutLength);
});

test('mobile slash gestures accept either lateral direction and stop inward blade tunneling', () => {
  assert.equal(resolveSlashLeadingPart(new THREE.Vector3(-1, 0.1, 0)), 'edge');
  assert.equal(resolveSlashLeadingPart(new THREE.Vector3(1, 0.1, 0)), 'edge');
  assert.equal(resolveSlashLeadingPart(new THREE.Vector3(0.08, 1, 0)), 'flat');
  assert.ok(SLASH_CONFIG.minimumContactSeconds <= 1 / 60);
  assert.ok(SLASH_CONFIG.minimumCutTravel <= 0.012);
  const correction = computeBladeSurfaceCorrection(new THREE.Vector3(0, 0, -0.08), new THREE.Vector3(0, 0, 1));
  assert.ok(correction.z > 0 && correction.length() <= 0.060001, 'inward edge travel is projected back toward the contacted skin');
  assert.equal(computeBladeSurfaceCorrection(new THREE.Vector3(0, 0, 0.08), new THREE.Vector3(0, 0, 1)).length(), 0, 'motion away from skin is unrestricted');
});

test('stage 2 tuning validates all vessel owners and bounded effect pools', () => {
  const result = validateCombatStage2Configuration(HUMANOID_ANATOMY_REGIONS.map((region) => region.id));
  assert.equal(result.valid, true);
  assert.equal(result.vesselCount, VESSEL_ZONES.length);
  assert.equal(result.woundLimit, 24);
  assert.ok(result.particleLimit > result.decalLimit);
  assert.equal(BLOOD_EFFECT_CONFIG.maximumParticles, 72);
  assert.equal(BLOOD_EFFECT_CONFIG.maximumDecals, 24);
  assert.ok(new THREE.Color(BLOOD_COLOR_PALETTE.arterial).getHSL({}).l > new THREE.Color(BLOOD_COLOR_PALETTE.dried).getHSL({}).l);
  assert.ok(new THREE.Color(BLOOD_COLOR_PALETTE.spray).getHSL({}).l > new THREE.Color(BLOOD_COLOR_PALETTE.pooled).getHSL({}).l);
});

test('penetration advances gradually, respects bone and extracts', () => {
  const base = { dt: 1 / 60, tissueResistance: 0.5, maximumDepth: 0.3, penetrationRate: 0.58, withdrawalRate: 0.72 };
  const shallow = advancePenetrationDepth({ ...base, currentDepth: 0, targetDepth: 0.2 });
  assert.ok(shallow.depth > 0 && shallow.depth < 0.2);
  const bone = advancePenetrationDepth({ ...base, currentDepth: 0.09, targetDepth: 0.2, hardDepth: 0.1 });
  assert.ok(bone.depth <= 0.1);
  assert.equal(bone.hardContact, true);
  const extracted = advancePenetrationDepth({ ...base, currentDepth: 0.001, targetDepth: -0.02 });
  assert.equal(extracted.extracted, true);
  assert.equal(extracted.depth, 0);
});

test('physics world initializes once, resets actors without leaks, and disposes', async () => {
  const rapierA = await initializeCombatPhysics();
  const rapierB = await initializeCombatPhysics();
  assert.equal(rapierA, rapierB);
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const actor = new HumanoidCombatActor({ physics, scene });
  assert.equal(physics.world.bodies.len(), 18);
  assert.equal(physics.world.impulseJoints.len(), 17);
  actor.reset();
  assert.equal(physics.world.bodies.len(), 18);
  assert.equal(physics.world.impulseJoints.len(), 17);
  assert.equal(physics.resetCount, 1);
  actor.dispose();
  assert.equal(physics.world.bodies.len(), 0);
  assert.equal(physics.world.impulseJoints.len(), 0);
  physics.dispose();
});

test('resume after suspension discards catch-up instead of exploding', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const actor = new HumanoidCombatActor({ physics, scene: new THREE.Scene() });
  const stepped = physics.step(3, (dt) => actor.beforePhysics(dt));
  assert.equal(stepped, 0);
  assert.equal(physics.resumeDiscardCount, 1);
  actor.bodies.forEach(({ body }) => assert.ok([body.translation().x, body.translation().y, body.translation().z].every(Number.isFinite)));
  actor.dispose();
  physics.dispose();
});

test('regional trauma affects balance and severe vital trauma releases standing control', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const actor = new HumanoidCombatActor({ physics, scene: new THREE.Scene() });
  const legCollider = actor.colliders.get('left_lower_leg');
  const legBody = actor.bodies.get('left_lower_leg').body;
  const legPosition = legBody.translation();
  const legPoint = new THREE.Vector3(legPosition.x, legPosition.y, legPosition.z);
  const legHit = actor.resolveHit(legCollider, legPoint);
  actor.applyPenetration({ hit: legHit, entryPoint: legPoint, direction: new THREE.Vector3(0, 0, -1), deltaDepth: 0.12, depth: 0.12, force: 1 });
  const legBalance = actor.balanceImpairment;
  const armCollider = actor.colliders.get('left_forearm');
  const armBody = actor.bodies.get('left_forearm').body;
  const armPosition = armBody.translation();
  const armPoint = new THREE.Vector3(armPosition.x, armPosition.y, armPosition.z);
  const armHit = actor.resolveHit(armCollider, armPoint);
  const balanceBeforeArm = actor.balanceImpairment;
  actor.applyPenetration({ hit: armHit, entryPoint: armPoint, direction: new THREE.Vector3(0, 0, -1), deltaDepth: 0.12, depth: 0.12, force: 1 });
  assert.ok(legBalance > actor.balanceImpairment - balanceBeforeArm);
  const neckCollider = actor.colliders.get('neck');
  const neckBody = actor.bodies.get('neck').body;
  const neckPosition = neckBody.translation();
  const neckPoint = new THREE.Vector3(neckPosition.x, neckPosition.y, neckPosition.z);
  const neckHit = actor.resolveHit(neckCollider, neckPoint);
  for (let i = 0; i < 5; i += 1) actor.applyPenetration({ hit: neckHit, entryPoint: neckPoint, direction: new THREE.Vector3(0, 0, -1), deltaDepth: 0.1, depth: 0.1, force: 2 });
  assert.equal(actor.lifeState, 'alive', 'high-durability actor survives a limited sequence without a vessel-owned wound');
  for (let i = 0; i < 8; i += 1) actor.applyPenetration({ hit: neckHit, entryPoint: neckPoint, direction: new THREE.Vector3(0, 0, -1), deltaDepth: 0.1, depth: 0.1, force: 2 });
  assert.ok(['incapacitated', 'dying', 'dead'].includes(actor.lifeState));
  for (let i = 0; i < 120; i += 1) actor.beforePhysics(1 / 60);
  assert.ok(actor.motorStrength < 0.5);
  if (actor.lifeState === 'dying') assert.fail('dying state should complete within the authored transition');
  actor.dispose();
  physics.dispose();
});

test('persistent wounds are region-owned, body-local, severity-aware, pooled, and reset cleanly', async () => {
  const { actor, physics } = await createActor();
  const { hit, worldPoint } = makeHit(actor, 'left_forearm');
  const shallow = actor.beginPunctureWound({ hit, entryPoint: worldPoint, direction: new THREE.Vector3(0, 0, -1), depth: 0.012 });
  actor.onWeaponExtracted(shallow.id, { direction: new THREE.Vector3(0, 0, 1) });
  const deepPoint = worldPoint.clone().add(new THREE.Vector3(0.12, 0, 0));
  const slash = actor.applySlashWound({ hit, startPoint: worldPoint, endPoint: deepPoint, surfaceNormal: new THREE.Vector3(0, 0, 1), cutDirection: new THREE.Vector3(1, 0, 0), depth: 0.065, cutLength: 0.12, severity: 0.9, classification: 'deep_slash' });
  assert.equal(shallow.regionId, 'left_forearm');
  assert.equal(slash.regionId, 'left_forearm');
  assert.ok(slash.severity > shallow.severity);
  assert.ok(slash.cutLength <= deepPoint.distanceTo(worldPoint) + 1e-9);
  const before = actor.woundSystem.getWorldPose(slash).point;
  actor.bodies.get('left_forearm').body.setTranslation({ x: 0.2, y: 2, z: -3 }, true);
  const after = actor.woundSystem.getWorldPose(slash).point;
  assert.ok(after.distanceTo(before) > 0.1, 'wound follows its moving physical region');
  for (let index = 0; index < WOUND_CONFIG.maximumWounds + 8; index += 1) {
    const point = new THREE.Vector3(index * 0.2, 0, 0.1);
    const synthetic = { ...hit, localPoint: point };
    actor.woundSystem.createBluntMarker({ hit: synthetic, severity: 0.1, createdTime: index });
  }
  assert.ok(actor.woundSystem.wounds.length <= WOUND_CONFIG.maximumWounds);
  actor.reset();
  assert.equal(actor.woundSystem.wounds.length, 0);
  assert.equal(actor.physiology.bloodReserve, 1);
  actor.dispose();
  physics.dispose();
});

test('neck vessels require authored depth and path; embedding obstructs and extraction releases flow', async () => {
  const { actor, physics } = await createActor();
  const shallowData = makeHit(actor, 'neck', new THREE.Vector3(-0.055, 0, 0.1), 'neck');
  const shallow = actor.beginPunctureWound({ hit: shallowData.hit, entryPoint: shallowData.worldPoint, direction: new THREE.Vector3(0, 0, -1), depth: 0.018 });
  assert.equal(shallow.vesselInvolvement, null);
  actor.onWeaponExtracted(shallow.id, {});
  const deepData = makeHit(actor, 'neck', new THREE.Vector3(0.055, 0, 0.1), 'neck');
  const arterial = actor.beginPunctureWound({ hit: deepData.hit, entryPoint: deepData.worldPoint, direction: new THREE.Vector3(0, 0, -1), depth: 0.07 });
  assert.equal(arterial.bleedingProfile.kind, 'arterial');
  actor.physiology.update(1 / 60);
  const obstructedRate = arterial.bleedingRate;
  actor.onWeaponExtracted(arterial.id, { releaseSeverity: 1, direction: new THREE.Vector3(0, 0, 1) });
  actor.physiology.update(1 / 60);
  assert.ok(arterial.bleedingRate > obstructedRate);
  actor.dispose();
  physics.dispose();
});

test('physiology permits shallow limb injury but differentiates blood loss and neurological failure', async () => {
  const { actor, physics } = await createActor();
  const armData = makeHit(actor, 'left_forearm');
  actor.beginPunctureWound({ hit: armData.hit, entryPoint: armData.worldPoint, direction: new THREE.Vector3(0, 0, -1), depth: 0.01 });
  for (let index = 0; index < 120; index += 1) actor.beforePhysics(1 / 60);
  assert.equal(actor.lifeState, 'alive');
  assert.ok(actor.physiology.consciousness > 0.85);
  actor.physiology.setBloodReserve(0.35);
  actor.physiology.update(1 / 60);
  assert.equal(actor.collapseFamily, 'blood_loss');
  actor.reset();
  const skullData = makeHit(actor, 'head', new THREE.Vector3(0, 0, 0.12), 'skull');
  actor.physiology.onTrauma({ hit: skullData.hit, severity: 1.2, depth: 0.11, deltaDepth: 0.11, hardContact: true });
  actor.physiology.update(1 / 60);
  assert.equal(actor.collapseFamily, 'neurological');
  assert.ok(['dying', 'dead'].includes(actor.lifeState));
  actor.dispose();
  physics.dispose();
});

test('heavy torso presentation briefly interrupts breathing and restores it smoothly', async () => {
  const { physics, actor } = await createActor();
  actor.physiology.interruptBreathing({ severity: 0.7, depth: 0.09 });
  actor.physiology.update(1 / 60);
  const interrupted = actor.physiology.breathInterruption;
  assert.equal(actor.physiology.breathingState, 'interrupted');
  assert.ok(interrupted > 0.4);
  for (let index = 0; index < 180; index += 1) actor.physiology.update(1 / 60);
  assert.ok(actor.physiology.breathInterruption < 0.01);
  assert.equal(actor.physiology.breathingState, 'steady');
  actor.dispose();
  physics.dispose();
});

test('Combat Director interrupts breathing once when a torso penetration becomes heavy', () => {
  const interruptions = [];
  const actor = {
    applyPenetration: () => 0.34,
    physiology: { interruptBreathing: (payload) => interruptions.push(payload) },
  };
  const director = new CombatDirector({ actor });
  const interaction = { result: { woundId: 'wound_test' }, flags: new Set() };
  const payload = { action: 'penetrate', hit: { regionId: 'upper_chest' }, depth: 0.07 };
  director.applyTissueEvent({ interaction, payload });
  director.applyTissueEvent({ interaction, payload });
  assert.equal(interruptions.length, 1, 'continuous depth events do not restart the breath interruption every physics step');
  assert.deepEqual(interruptions[0], { severity: 0.34, depth: 0.07 });
  director.dispose();
});

test('combat feedback guards unsupported haptics, cooldowns contact audio, and honors disable', () => {
  const feedback = new CombatFeedbackSystem();
  assert.doesNotThrow(() => feedback.emitHaptic('penetration'));
  assert.equal(feedback.emit('bone_contact', { owner: 'knife' }), true);
  assert.equal(feedback.emit('bone_contact', { owner: 'knife' }), false);
  feedback.setHapticsEnabled(false);
  assert.equal(feedback.emitHaptic('penetration'), false);
  feedback.setMuted(true);
  assert.equal(feedback.emit('extraction', { owner: 'knife' }), true);
  assert.equal(feedback.getDiagnostics().activeVoices, 0);
  feedback.reset();
  assert.deepEqual(feedback.getDiagnostics().eventCounts, {});
  feedback.dispose();
});

test('Folsom promotes one model_idle combat actor exactly ten meters from spawn and cleans up', async () => {
  const scene = new THREE.Scene();
  const dungeon = { scene, collision: { sampleWalkableY: () => ({ y: 0.16 }), canStandAtFloorPosition: () => true, getIntersectingBlockers: () => [] } };
  const encounter = await FolsomCombatEncounter.create({ dungeon });
  const pelvis = encounter.actor.getBodyWorldPosition('pelvis');
  const playerSpawn = new THREE.Vector3(-2, 1.71, -4);
  assert.equal(Math.hypot(encounter.spawnPosition.x - playerSpawn.x, encounter.spawnPosition.z - playerSpawn.z), 10);
  assert.equal(encounter.actor.visualProfile, MODEL_IDLE_COMBAT_PROFILE);
  assert.ok(scene.getObjectByName('folsom-model-idle-combat-subject'));
  assert.equal(scene.children.filter((child) => child.name.includes('combat-subject')).length, 1);
  assert.equal(scene.getObjectByName('folsom-model-idle-raw-reference'), undefined);
  assert.ok(pelvis.x > 7 && pelvis.z < -3);
  assert.equal(encounter.physics.world.bodies.len(), 19);
  encounter.reset();
  assert.equal(encounter.physics.world.bodies.len(), 19);
  assert.equal(scene.children.filter((child) => child.name.includes('combat-subject')).length, 1);
  encounter.dispose();
  assert.equal(scene.getObjectByName('folsom-model-idle-combat-subject'), undefined);
});

test('skinned-vertex bounds produce one uniform 1.82 meter model_idle scale', () => {
  const root = new THREE.Group();
  const bone = new THREE.Bone();
  const geometry = new THREE.BoxGeometry(1, 2, 0.5);
  const positionCount = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(positionCount * 4), 4));
  const weights = new Float32Array(positionCount * 4);
  for (let index = 0; index < positionCount; index += 1) weights[index * 4] = 1;
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const material = new THREE.MeshStandardMaterial();
  const skinned = new THREE.SkinnedMesh(geometry, material);
  skinned.add(bone);
  skinned.bind(new THREE.Skeleton([bone]));
  root.add(skinned);
  const rawHeight = measureVisibleSkinnedBounds(root).getSize(new THREE.Vector3()).y;
  const uniformScale = MODEL_IDLE_COMBAT_PROFILE.targetHeight / rawHeight;
  root.scale.setScalar(uniformScale);
  const normalized = measureVisibleSkinnedBounds(root);
  assert.ok(Math.abs(normalized.getSize(new THREE.Vector3()).y - 1.82) < 1e-6);
  assert.deepEqual(root.scale.toArray(), [uniformScale, uniformScale, uniformScale]);
  assert.equal(MODEL_IDLE_COMBAT_PROFILE.animationAuthoritative, true);
  assert.ok(MODEL_IDLE_COMBAT_PROFILE.rawHeight > 84.12 && MODEL_IDLE_COMBAT_PROFILE.rawHeight < 84.14);
  assert.equal(Object.keys(MODEL_IDLE_COMBAT_PROFILE.proxyFit).length, 18);
  geometry.dispose();
  material.dispose();
});

test('model_idle authoritative profile is independent and disables physics-to-bone binding', () => {
  assert.notEqual(CURRENT_HUMANOID_PROFILE.assetPath, MODEL_IDLE_COMBAT_PROFILE.assetPath);
  assert.notEqual(CURRENT_HUMANOID_PROFILE.boneMap, MODEL_IDLE_COMBAT_PROFILE.boneMap);
  assert.equal(MODEL_IDLE_COMBAT_PROFILE.assetPath, './assets/models/npc/human/model_idle.glb');
  assert.equal(MODEL_IDLE_COMBAT_PROFILE.name, 'model_idle_animation_authoritative');
});

test('fresh wound materials use the brighter non-emissive blood palette', async () => {
  const { actor, physics } = await createActor();
  assert.equal(actor.woundSystem.materials.puncture.color.getHex(), BLOOD_COLOR_PALETTE.fresh);
  assert.equal(actor.woundSystem.materials.cut.color.getHex(), BLOOD_COLOR_PALETTE.slashArterial);
  assert.equal(actor.woundSystem.materials.deepCut.color.getHex(), BLOOD_COLOR_PALETTE.slashArterial);
  assert.equal(actor.woundSystem.materials.arterialCut.color.getHex(), BLOOD_COLOR_PALETTE.slashArterial);
  assert.equal(actor.woundSystem.materials.deep.color.getHex(), BLOOD_COLOR_PALETTE.deep);
  assert.equal(actor.woundSystem.materials.arterial.color.getHex(), BLOOD_COLOR_PALETTE.arterial);
  Object.values(actor.woundSystem.materials).forEach((material) => {
    assert.equal(material.emissive.getHex(), 0, `${material.type} remains fully lighting-responsive`);
  });
  actor.dispose();
  physics.dispose();
});

test('one authoritative knife root keeps identity, scale, pose, ownership, and safe return', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const actor = new HumanoidCombatActor({ physics, scene });
  const camera = new THREE.PerspectiveCamera(70, 390 / 702, 0.1, 100);
  camera.position.set(0, 1.5, -1.5);
  const rect = { left: 0, top: 0, width: 390, height: 702 };
  const viewport = { querySelector: () => null, getBoundingClientRect: () => rect, addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, releasePointerCapture() {} };
  const equipment = { getEquippedToolId: () => 'old_work_knife', hasItem: () => true };
  let contactRange = false;
  const knife = new WorldKnifeCombatController({ app: viewport, scene, camera, actor, physics, equipmentRuntime: equipment, bindPointerInput: false, contactActivationProvider: () => contactRange });
  knife.afterPhysics();
  const identity = knife.visual.id;
  const scale = knife.visual.scale.clone();
  const ready = knife.actualGrip.clone();
  const readyLocal = camera.worldToLocal(ready.clone());
  camera.position.add(new THREE.Vector3(7, 0.5, -4));
  camera.rotateY(1.1);
  camera.rotateX(-0.35);
  camera.updateMatrixWorld(true);
  knife.beforePhysics(1 / 60);
  const movedLocal = camera.worldToLocal(knife.actualGrip.clone());
  assert.ok(movedLocal.distanceTo(readyLocal) < 1e-6, 'large camera translation and rotation preserve the camera-local ready pose in the same frame');
  assert.equal(actor.woundSystem.wounds.length, 0, 'large camera motion creates no wound or offensive velocity');
  assert.equal(knife.attackEnabled, false);
  assert.equal(knife.offensiveVelocity.length(), 0);
  const movedReady = knife.actualGrip.clone();
  contactRange = true;
  knife.beforePhysics(1 / 60); knife.afterPhysics();
  contactRange = false;
  knife.beforePhysics(1 / 60); knife.afterPhysics();
  assert.equal(knife.visual.id, identity, 'combat proximity does not swap the knife mesh');
  assert.deepEqual(knife.visual.scale.toArray(), scale.toArray(), 'combat proximity does not change knife scale');
  assert.ok(knife.actualGrip.distanceTo(movedReady) < 0.001, 'combat proximity does not change the ready pose');
  assert.equal(scene.children.filter((child) => child.name === 'old-work-knife-authoritative-world-weapon').length, 1);
  assert.equal(knife.acquireGrip(11, 300, 530, 0), true);
  assert.equal(knife.acquireGrip(12, 300, 530, 0), false, 'unrelated pointers cannot steal ownership');
  knife.applyGripGesture(11, 80, -120, 380, 410, 50);
  for (let index = 0; index < 4; index += 1) knife.beforePhysics(1 / 60);
  assert.equal(knife.state, KNIFE_CONTROL_STATES.attacking);
  knife.releaseGrip('test-release');
  assert.equal(knife.state, KNIFE_CONTROL_STATES.returning);
  assert.equal(knife.attackEnabled, false);
  for (let index = 0; index < 11; index += 1) knife.beforePhysics(1 / 60);
  assert.equal(knife.state, KNIFE_CONTROL_STATES.ready);
  assert.equal(knife.desiredExtension, 0, 'release never leaves the previous extension requested');
  assert.equal(actor.woundSystem.wounds.length, 0, 'return motion creates no wound');
  const embeddedHit = makeHit(actor, 'upper_chest');
  knife.acquireGrip(21, 300, 530, 500);
  knife.applyGripGesture(21, 0, -20, 300, 510, 516);
  knife.beginPenetration(embeddedHit.hit, embeddedHit.worldPoint, new THREE.Vector3(0, 0, -1), 1);
  knife.afterPhysicsStep(1 / 60);
  knife.afterPhysicsStep(1 / 60);
  const embeddedWounds = actor.woundSystem.wounds.length;
  knife.releaseGrip('embedded-test-release');
  assert.equal(knife.state, KNIFE_CONTROL_STATES.withdrawing);
  for (let index = 0; index < 30; index += 1) knife.beforePhysics(1 / 60);
  assert.equal(knife.entry, null, 'embedded release completes assisted extraction');
  assert.ok([KNIFE_CONTROL_STATES.returning, KNIFE_CONTROL_STATES.ready].includes(knife.state));
  assert.equal(actor.woundSystem.wounds.length, embeddedWounds, 'assisted withdrawal cannot create another wound');
  knife.cancel('pointer-cancel-test');
  assert.equal(knife.gripPointerId, null);
  const preResumeLocal = camera.worldToLocal(knife.actualGrip.clone());
  camera.position.addScalar(20);
  camera.updateMatrixWorld(true);
  knife.beforePhysics(1 / 60);
  assert.ok(camera.worldToLocal(knife.actualGrip.clone()).distanceTo(preResumeLocal) <= KNIFE_COMBAT_CONFIG.maximumVelocity / 60 + 1e-6, 'resume/teleport-style camera correction safely rebases pose history without world-space catch-up');
  knife.dispose();
  assert.equal(scene.getObjectByName('old-work-knife-authoritative-world-weapon'), undefined);
  actor.dispose();
  physics.dispose();
});

test('a grip-owned deliberate world-space thrust punctures through the authoritative tip', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const actor = new HumanoidCombatActor({ physics, scene, mortalityMode: COMBAT_MORTALITY_MODES.immortalReactive });
  const camera = new THREE.PerspectiveCamera(70, 390 / 702, 0.1, 100);
  camera.position.set(0, 1.81, -2.5);
  camera.updateMatrixWorld(true);
  const viewport = { querySelector: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 702 }) };
  const equipment = { getEquippedToolId: () => 'old_work_knife', hasItem: () => true };
  const knife = new WorldKnifeCombatController({ app: viewport, scene, camera, actor, physics, equipmentRuntime: equipment, bindPointerInput: false, contactActivationProvider: () => true });
  knife.acquireGrip(31, 280, 470, 0);
  for (let step = 1; step <= 12 && !knife.entry; step += 1) {
    knife.applyGripGesture(31, 0, -step * 5, 280, 470 - step * 5, step * 16);
    physics.stepSingle((dt) => { knife.beforePhysics(dt); actor.beforePhysics(dt); }, (dt) => knife.afterPhysicsStep(dt));
    knife.afterPhysics();
  }
  assert.equal(knife.state, KNIFE_CONTROL_STATES.embedded);
  assert.equal(knife.contactState, 'surface_puncture');
  assert.equal(knife.contactDamageReason, 'damaging:grip-owned-deliberate-motion');
  knife.afterPhysicsStep(1 / 60);
  assert.equal(actor.woundSystem.wounds.length, 1);
  knife.dispose(); actor.dispose(); physics.dispose();
});

test('a grip-owned deliberate lateral sweep creates an edge-led slash', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const actor = new HumanoidCombatActor({ physics, scene, mortalityMode: COMBAT_MORTALITY_MODES.immortalReactive });
  const camera = new THREE.PerspectiveCamera(70, 390 / 702, 0.1, 100);
  camera.position.set(0, 1.74, -2.77);
  camera.updateMatrixWorld(true);
  const viewport = { querySelector: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 702 }) };
  const equipment = { getEquippedToolId: () => 'old_work_knife', hasItem: () => true };
  const knife = new WorldKnifeCombatController({ app: viewport, scene, camera, actor, physics, equipmentRuntime: equipment, bindPointerInput: false, contactActivationProvider: () => true });
  knife.acquireGrip(32, 280, 470, 0);
  for (let step = 1; step <= 20; step += 1) {
    knife.applyGripGesture(32, -step * 5, 0, 280 - step * 5, 470, step * 16);
    physics.stepSingle((dt) => { knife.beforePhysics(dt); actor.beforePhysics(dt); }, (dt) => knife.afterPhysicsStep(dt));
    knife.afterPhysics();
  }
  assert.equal(knife.activeSlash?.part, 'edge');
  assert.ok(['shallow_cut', 'deep_slash'].includes(knife.contactState));
  assert.equal(knife.slashCount, 1);
  assert.equal(actor.woundSystem.wounds.length, 1);
  knife.dispose(); actor.dispose(); physics.dispose();
});

test('immortal reactive policy survives repeated severe attacks and recovers while normal mortality remains available', async () => {
  assert.equal(resolveCombatMortalityMode(''), COMBAT_MORTALITY_MODES.immortalReactive);
  assert.equal(resolveCombatMortalityMode('?combatMortality=normal'), COMBAT_MORTALITY_MODES.normal);
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const actor = new HumanoidCombatActor({ physics, scene: new THREE.Scene(), mortalityMode: COMBAT_MORTALITY_MODES.immortalReactive });
  for (let index = 0; index < 100; index += 1) {
    const bodyId = index % 2 ? 'upper_chest' : 'neck';
    const { hit, worldPoint } = makeHit(actor, bodyId, new THREE.Vector3(index % 3 * 0.015 - 0.015, 0, 0.1));
    const wound = actor.beginPunctureWound({ hit, entryPoint: worldPoint, direction: new THREE.Vector3(0, 0, -1), depth: Math.min(hit.region.maximumTissueDepth, 0.18) });
    actor.applyPenetration({ hit, entryPoint: worldPoint, direction: new THREE.Vector3(0, 0, -1), deltaDepth: 0.14, depth: Math.min(hit.region.maximumTissueDepth, 0.18), force: 2.4, woundId: wound.id });
    actor.onWeaponExtracted(wound.id, { releaseSeverity: 1, direction: new THREE.Vector3(0, 0, 1) });
    actor.beforePhysics(1 / 60);
    assert.notEqual(actor.lifeState, 'dying');
    assert.notEqual(actor.lifeState, 'dead');
  }
  const skull = makeHit(actor, 'head', new THREE.Vector3(0, 0, 0.12), 'skull');
  actor.physiology.onTrauma({ hit: skull.hit, severity: 2, depth: 0.12, deltaDepth: 0.12, hardContact: true });
  actor.beforePhysics(1 / 60);
  assert.equal(actor.lifeState, 'incapacitated', 'neurological lethality is converted into bounded reactive collapse');
  assert.ok(actor.physiology.bloodReserve >= IMMORTAL_REACTIVE_CONFIG.bloodReserveFloor);
  assert.ok(actor.physiology.consciousness >= IMMORTAL_REACTIVE_CONFIG.consciousnessFloor);
  assert.ok(actor.woundSystem.wounds.length <= WOUND_CONFIG.maximumWounds, 'wound visuals recycle at the pool limit');
  for (let index = 0; index < 1800; index += 1) actor.beforePhysics(1 / 60);
  assert.equal(actor.lifeState, 'alive');
  assert.ok(actor.physiology.consciousness > 0.4, 'consciousness recovers toward the testing baseline');
  assert.ok(actor.motorStrength > 0.7, 'motor strength and posture recover');
  assert.ok(actor.balanceImpairment < 0.1, 'balance impairment decays');
  actor.setMortalityMode(COMBAT_MORTALITY_MODES.normal);
  actor.physiology.neurologicalIntegrity = 0;
  actor.physiology.update(1 / 60);
  for (let index = 0; index < 120; index += 1) actor.beforePhysics(1 / 60);
  assert.equal(actor.lifeState, 'dead', 'normal mortality restores ordinary terminal behavior');
  actor.dispose();
  physics.dispose();
});
