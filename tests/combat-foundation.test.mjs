import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { COMBAT_REQUIRED_REGION_IDS, HUMANOID_ANATOMY_REGIONS, HUMANOID_BODY_CONFIG, HUMANOID_JOINT_CONFIG, KNIFE_COMBAT_CONFIG, validateCombatConfiguration } from '../src/game/combat/CombatConfig.js';
import { advancePenetrationDepth, clampWorkspacePoint, classifyKnifeContact, classifySlashContact, computeWorldThrust, deriveBladeTip, extendSlashLength, normalizedBladeForward, visibleCollisionTransformsWithinTolerance } from '../src/game/combat/CombatMath.js';
import { CombatPhysicsWorld, initializeCombatPhysics } from '../src/game/combat/CombatPhysicsWorld.js';
import { CollisionWorld } from '../src/game/Collision.js';
import { HumanoidCombatActor } from '../src/game/combat/HumanoidCombatActor.js';
import { CombatFeedbackSystem } from '../src/game/combat/CombatFeedbackSystem.js';
import { FolsomCombatEncounter } from '../src/game/combat/FolsomCombatEncounter.js';
import { CURRENT_HUMANOID_PROFILE, DREADGUARD_DAMAGE_COMBAT_PROFILE, getHumanoidProfileScale, isHumanoidPoseAuthoritative } from '../src/game/combat/HumanoidModelProfiles.js';
import { BLOOD_COLOR_PALETTE, BLOOD_EFFECT_CONFIG, SLASH_CONFIG, VESSEL_ZONES, WOUND_CONFIG, validateCombatStage2Configuration } from '../src/game/combat/CombatStage2Config.js';
import { COMBAT_KNIFE_VIEWMODEL_LAYER, COMBAT_KNIFE_WORLD_LAYER, KNIFE_EDGE_BASE_SAMPLE_COUNT, KNIFE_EDGE_COLLISION_RADIUS, KNIFE_EDGE_MAX_SAMPLE_COUNT, KNIFE_RUNTIME_COMBAT_MODE, WorldKnifeCombatController, computeBladeSurfaceCorrection, resolveKnifeEdgeSampleCount, resolveSlashLeadingPart, sampleKnifeCuttingEdgeLocal } from '../src/game/combat/WorldKnifeCombatController.js';
import { KNIFE_CONTROL_STATES, canKnifeCreateOffensiveContact, criticallyDampedReturnProgress, getKnifeReleasePlan } from '../src/game/combat/KnifeControlState.js';
import { COMBAT_MORTALITY_MODES, IMMORTAL_REACTIVE_CONFIG, resolveCombatMortalityMode } from '../src/game/combat/CombatMortality.js';
import { HumanoidGlbVisualAdapter, applySolvedBoneLocalTransform, captureModelSpaceBoneBinding, measureVisibleSkinnedBounds, resolveRequiredBoneMappings, solveModelSpaceBoneLocal } from '../src/game/combat/HumanoidGlbVisualAdapter.js';
import { MAX_ADJACENT_SURFACE_PROJECTION_DISTANCE, MAX_SLASH_SURFACE_SAMPLES, MAX_SURFACE_PROJECTION_DISTANCE, WOUND_SURFACE_BIAS, buildSkinnedTriangleInfluenceMetadata, createSurfaceBindingDiagnostics, findClosestSkinnedSurface, reconstructSkinnedSurface, sampleSlashPath, validateSurfaceBinding } from '../src/game/combat/SkinnedSurfaceBinding.js';
import { COMBAT_DIRECTOR_EVENTS, CombatDirector, PENETRATION_STAGES, resolveMeleeTimeline } from '../src/game/combat/CombatDirector.js';
import { isDamageIntent, MELEE_INTENTS, MeleeIntentWeapon } from '../src/game/combat/MeleeIntentWeapon.js';
import { Feedback } from '../src/game/Feedback.js';
import { applyMeleeSpacingEnvelope, resolveMeleeSpacingEnvelope, resolveWeaponMicroResponse, sampleTissueResistanceCurve } from '../src/game/combat/CombatPresentation.js';
import { installKnifeWoundManifestForHeadlessTests } from '../src/game/combat/KnifeWoundDecalLibrary.js';
import { EDGE_DAMAGE_SCHEMA } from '../src/game/combat/weapons/EdgeDamageInteraction.js';
import { DREADSTONE_SWORD_DIMENSIONS, DREADSTONE_SWORD_GLB_PATH, SWORD_CONTACT_PRIMITIVES, SWORD_EDGE_BASE_SAMPLE_COUNT, SWORD_EDGE_MAX_SAMPLE_COUNT, SWORD_MAXIMUM_PENETRATION_DEPTH, SWORD_PENETRATION_RATE_METERS_PER_SECOND, SWORD_RUNTIME_COMBAT_MODE, SWORD_THRUST_MIN_FORWARD_RATIO, SWORD_THRUST_MIN_FORWARD_SPEED, SWORD_THRUST_REARM_DISTANCE, SWORD_VIEWMODEL_LAYER, SWORD_WITHDRAWAL_RATE_METERS_PER_SECOND, SwordWorldWeaponController, classifySwordContact, resolveSwordEdgeSampleCount, resolveSwordLeadingPart } from '../src/game/combat/weapons/SwordWorldWeaponController.js';
import { deriveSwordCutTrauma } from '../src/game/combat/SwordCutDamage.js';
import { MAX_SWORD_CUT_SURFACE_SAMPLES, SWORD_CUT_TARGET_SAMPLE_SPACING } from '../src/game/combat/SwordCutWoundVisual.js';
import { CombatBloodEffects } from '../src/game/combat/CombatBloodEffects.js';
import { KNIFE_PUNCTURE_PRESENTATION_SCALE, SWORD_THRUST_PUNCTURE_PRESENTATION_SCALE, derivePuncturePhysicalDimensions } from '../src/game/combat/CombatWoundSystem.js';

installKnifeWoundManifestForHeadlessTests(JSON.parse(readFileSync(new URL('../public/assets/textures/combat/wounds/knife/knife_wound_decals.manifest.json', import.meta.url), 'utf8')));

test('authored sword dimensions drive complete weapon-neutral contact primitives', () => {
  assert.equal(DREADSTONE_SWORD_GLB_PATH, './assets/weapons/melee/dreadstone_sword_v002.glb');
  assert.equal(DREADSTONE_SWORD_DIMENSIONS.tipZ, -0.892469227);
  assert.ok(DREADSTONE_SWORD_DIMENSIONS.overallLength > 1.09 && DREADSTONE_SWORD_DIMENSIONS.overallLength < 1.11);
  assert.deepEqual(Object.keys(SWORD_CONTACT_PRIMITIVES), ['tip', 'leftEdge', 'rightEdge', 'flat', 'spine', 'guard', 'grip']);
  assert.equal(SWORD_CONTACT_PRIMITIVES.tip.point[2], DREADSTONE_SWORD_DIMENSIONS.tipZ);
  assert.equal(SWORD_CONTACT_PRIMITIVES.guard.points[0][0], -DREADSTONE_SWORD_DIMENSIONS.guardHalfSpan);
  assert.equal(KNIFE_RUNTIME_COMBAT_MODE, 'puncture_only');
  assert.equal(SWORD_RUNTIME_COMBAT_MODE, 'puncture_only');
  assert.equal(SWORD_THRUST_MIN_FORWARD_SPEED, 0.16);
  assert.equal(SWORD_THRUST_MIN_FORWARD_RATIO, 0.55);
  assert.equal(SWORD_THRUST_REARM_DISTANCE, 0.05);
  assert.equal(SWORD_PENETRATION_RATE_METERS_PER_SECOND, KNIFE_COMBAT_CONFIG.penetrationRate);
  assert.equal(SWORD_WITHDRAWAL_RATE_METERS_PER_SECOND, KNIFE_COMBAT_CONFIG.withdrawalRate);
  assert.equal(SWORD_THRUST_PUNCTURE_PRESENTATION_SCALE, 2.1875);
  assert.equal(SWORD_MAXIMUM_PENETRATION_DEPTH, Math.abs(DREADSTONE_SWORD_DIMENSIONS.tipZ - (DREADSTONE_SWORD_DIMENSIONS.guardCenterZ - DREADSTONE_SWORD_DIMENSIONS.guardRadius)));
});

test('long sword edges adapt sampling and classify every authored contact family', () => {
  const previousStart = new THREE.Vector3(-0.035, 0, -0.214);
  const previousEnd = new THREE.Vector3(0, 0, -0.892);
  const currentStart = previousStart.clone();
  const currentEnd = new THREE.Vector3(0, 0, 0.46);
  assert.equal(resolveSwordEdgeSampleCount(previousStart, previousEnd, previousStart, previousEnd), SWORD_EDGE_BASE_SAMPLE_COUNT);
  assert.equal(resolveSwordEdgeSampleCount(previousStart, previousEnd, currentStart, currentEnd), SWORD_EDGE_MAX_SAMPLE_COUNT);
  assert.equal(resolveSwordLeadingPart(new THREE.Vector3(0, 0, -1)), 'tip');
  assert.equal(resolveSwordLeadingPart(new THREE.Vector3(1, 0, 0)), 'edge');
  assert.equal(resolveSwordLeadingPart(new THREE.Vector3(0, 1, 0)), 'flat');
  assert.equal(resolveSwordLeadingPart(new THREE.Vector3(0, -1, 0)), 'spine');
  assert.equal(classifySwordContact({ part: 'tip', speed: 1, localMotion: new THREE.Vector3(0, 0, -1) }).classification, 'thrust');
  assert.equal(classifySwordContact({ part: 'leftEdge', speed: 1, localMotion: new THREE.Vector3(1, 0, 0) }).classification, 'cut');
  assert.equal(classifySwordContact({ part: 'rightEdge', speed: 0.05, localMotion: new THREE.Vector3(0.1, 0, 0) }).classification, 'scrape');
  assert.equal(classifySwordContact({ part: 'flat', speed: 1, localMotion: new THREE.Vector3(0, 1, 0) }).classification, 'flat_strike');
  assert.equal(classifySwordContact({ part: 'guard', speed: 1, localMotion: new THREE.Vector3(1, 0, 0) }).classification, 'guard_impact');
});

test('sword trauma rewards committed aligned motion and scales vital anatomy above limbs', () => {
  const base = { travel: 0.09, depth: 0.026, edgeAlignment: 0.9, swingSpeed: 1.5, severity: 0.78 };
  const limb = deriveSwordCutTrauma({ ...base, region: HUMANOID_ANATOMY_REGIONS.find((region) => region.id === 'left_forearm') });
  const chest = deriveSwordCutTrauma({ ...base, region: HUMANOID_ANATOMY_REGIONS.find((region) => region.id === 'upper_chest') });
  const neck = deriveSwordCutTrauma({ ...base, region: HUMANOID_ANATOMY_REGIONS.find((region) => region.id === 'neck') });
  const glance = deriveSwordCutTrauma({ travel: 0.008, depth: 0.002, edgeAlignment: 0.22, swingSpeed: 0.18, severity: 0.12, region: HUMANOID_ANATOMY_REGIONS.find((region) => region.id === 'neck') });
  assert.ok(chest.trauma > limb.trauma * 2);
  assert.ok(neck.trauma > chest.trauma * 1.4);
  assert.ok(glance.trauma < 0.01, 'light glancing contact remains non-lethal');
});

async function createActor() {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  return { physics, scene, actor: new HumanoidCombatActor({ physics, scene }) };
}

test('humanoid collapse notifies and clears an embedded weapon before corpse ownership', async () => {
  const { physics, actor } = await createActor();
  const transitions = [];
  const embeddedWeapon = {
    state: 'embedded',
    onTargetLifeStateChanged(target, transition) {
      transitions.push({ target, transition });
      target.setEmbeddedWeapon(null);
      return true;
    },
  };
  try {
    actor.setEmbeddedWeapon(embeddedWeapon);
    assert.equal(actor.transitionLifeState('dying', 'focused-sword-test', { externalCommit: true, forceFatal: true }), true);
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].target, actor);
    assert.equal(transitions[0].transition.previousState, 'alive');
    assert.equal(transitions[0].transition.nextState, 'dying');
    assert.equal(actor.activeEmbeddedWeapon, null, 'the dying/corpse actor cannot continue driving the weapon');
  } finally {
    actor.dispose();
    physics.dispose();
  }
});

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
  const actor = {
    lifeState: 'alive',
    physiology: { interruptBreathing() {} },
    beginPunctureWound: () => ({ id: 'confirmed-director-wound' }),
    applyPenetration: () => 0.1,
    triggerReflex() {},
  };
  const director = new CombatDirector({ actor });
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

test('puncture entry owns one reaction event and extraction owns none while preserving extraction events', () => {
  const director = new CombatDirector();
  const observed = [];
  director.subscribe('*', (event) => observed.push({ type: event.type, action: event.payload.action ?? event.payload.cue ?? event.payload.kind, source: event.payload.source }));
  const intent = { weaponId: 'test_knife', intent: MELEE_INTENTS.stab, ownerId: 3, speed: 1, intentional: true, damaging: true };
  const interaction = director.beginPuncture({ weapon: { id: 'test_knife', family: 'knife' }, intent, hit: { regionId: 'upper_chest' }, entryPoint: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, -1), depth: 0.012, force: 1 });
  director.update(0.13);
  assert.equal(observed.filter((event) => event.type === COMBAT_DIRECTOR_EVENTS.reaction && event.source === 'directed_puncture').length, 1);
  director.completeWithdrawal(interaction.id, { direction: new THREE.Vector3(0, 0, 1), releaseSeverity: 0.04, position: new THREE.Vector3() });
  director.update(0.25);
  assert.equal(observed.filter((event) => event.type === COMBAT_DIRECTOR_EVENTS.reaction).length, 1, 'extraction schedules no second body reaction');
  ['withdrawal_release', 'extract', 'extraction', 'withdrawal'].forEach((action) => assert.ok(observed.some((event) => event.action === action), `${action} remains scheduled`));
  assert.equal(director.getDiagnostics().extractionReactionAttempted, false);
  director.dispose();
});

test('knife release plans return free contact and leave a planted blade embedded', () => {
  const free = getKnifeReleasePlan({ config: KNIFE_COMBAT_CONFIG });
  const failed = getKnifeReleasePlan({ failedContact: true, config: KNIFE_COMBAT_CONFIG });
  const shallow = getKnifeReleasePlan({ embeddedDepth: 0.01, config: KNIFE_COMBAT_CONFIG });
  const deep = getKnifeReleasePlan({ embeddedDepth: KNIFE_COMBAT_CONFIG.maximumPenetrationDepth, config: KNIFE_COMBAT_CONFIG });
  assert.equal(free.state, KNIFE_CONTROL_STATES.returning);
  assert.ok(free.durationSeconds >= 0.12 && free.durationSeconds <= 0.18);
  assert.ok(failed.durationSeconds >= 0.16 && failed.durationSeconds <= 0.22);
  assert.equal(shallow.state, KNIFE_CONTROL_STATES.embedded);
  assert.equal(deep.state, KNIFE_CONTROL_STATES.embedded);
  assert.equal(shallow.durationSeconds, 0);
  assert.equal(deep.durationSeconds, 0);
  assert.equal(deep.reason, 'planted-embedded-hold');
  const springSamples = [0, 0.03, 0.06, 0.09, 0.12, 0.15].map((time) => criticallyDampedReturnProgress(time, 0.15));
  assert.equal(springSamples[0], 0);
  assert.equal(springSamples.at(-1), 1);
  assert.ok(springSamples.every((value, index) => index === 0 || value >= springSamples[index - 1]), 'critical return is monotonic and cannot oscillate');
});

test('a planted knife recalls as soon as the player walks beyond its short tether', () => {
  const controller = Object.create(WorldKnifeCombatController.prototype);
  controller.gripPointerId = null;
  controller.state = KNIFE_CONTROL_STATES.embedded;
  controller.config = KNIFE_COMBAT_CONFIG;
  controller.entry = { plantedDesiredGrip: new THREE.Vector3(1, 2, 3) };
  controller.desiredGrip = new THREE.Vector3(1, 2, 3);
  const observed = [];
  controller.extract = (reason) => { observed.push(reason); controller.entry = null; controller.state = KNIFE_CONTROL_STATES.returning; };
  controller.solveFreePose = (dt) => observed.push(dt);
  controller.desiredGrip.x += KNIFE_COMBAT_CONFIG.forcedExtractionDistance - 0.001;
  assert.equal(controller.recallPlantedKnifeIfSeparated(1 / 60), false, 'nearby planted hold remains available');
  controller.desiredGrip.x += 0.002;
  assert.equal(controller.recallPlantedKnifeIfSeparated(1 / 60), true, 'crossing the existing forced-extraction distance recalls immediately');
  assert.deepEqual(observed, ['walk-away-recall', 1 / 60]);
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

test('rest-pose authority applies the gameplay spawn without rewriting exported bone locals', () => {
  const fixture = createSkinnedSurfaceFixture();
  const rawHeight = measureVisibleSkinnedBounds(fixture.root).getSize(new THREE.Vector3()).y;
  const host = new THREE.Group();
  const actor = {
    visualRootPosition: new THREE.Vector3(8, 0.188, -4),
    spawnYaw: 0.4,
    readyAdapter: null,
    setAnimationAuthorityReady(adapter) { this.readyAdapter = adapter; },
  };
  const adapter = Object.assign(Object.create(HumanoidGlbVisualAdapter.prototype), {
    actor,
    parent: host,
    profile: {
      name: 'rest-pose-spawn-regression',
      rawHeight,
      targetHeight: 1.5,
      groundClearance: 0.02,
      rootYaw: 0,
      boneMap: { upper_chest: fixture.bone.name },
      proxyFit: { upper_chest: { bone: fixture.bone.name } },
    },
    scene: fixture.root,
    skeletons: [fixture.mesh.skeleton],
    bones: new Map([[fixture.bone.name, fixture.bone]]),
    animationBones: new Map(),
    restPoseBoneTransforms: new Map(),
    presentationRoot: null,
    rawVisibleBounds: null,
    normalizedVisibleBounds: null,
    uniformScale: null,
    basePresentationPosition: new THREE.Vector3(),
    basePresentationYaw: 0,
  });
  const localPosition = fixture.bone.position.clone();
  const localQuaternion = fixture.bone.quaternion.clone();
  const localScale = fixture.bone.scale.clone();

  adapter.initializeRestPoseAuthoritative();

  assert.equal(actor.readyAdapter, adapter);
  assert.deepEqual(adapter.presentationRoot.position.toArray(), actor.visualRootPosition.toArray());
  assert.equal(adapter.presentationRoot.rotation.y, actor.spawnYaw);
  assert.ok(Math.abs(adapter.normalizedVisibleBounds.getSize(new THREE.Vector3()).y - 1.5) < 1e-6);
  assert.ok(Math.abs(adapter.normalizedVisibleBounds.min.y - (actor.visualRootPosition.y + 0.02)) < 1e-6);
  assert.ok(fixture.bone.position.distanceTo(localPosition) < 1e-12);
  assert.ok(1 - Math.abs(fixture.bone.quaternion.dot(localQuaternion)) < 1e-12);
  assert.ok(fixture.bone.scale.distanceTo(localScale) < 1e-12);
  fixture.geometry.dispose();
  fixture.mesh.material.dispose();
});

test('diagnostic GLB profiles fail clearly when a required mapped bone is missing', () => {
  const bodies = new Map([['pelvis', {}], ['head', {}]]);
  const bones = new Map([['body', new THREE.Bone()]]);
  assert.throws(
    () => resolveRequiredBoneMappings({ bones, bodies, boneMap: { pelvis: 'body', head: 'missing_head' }, profileName: 'diagnostic-test-profile' }),
    /diagnostic-test-profile is missing required mappings: head -> missing_head/,
  );
});

function createSkinnedSurfaceFixture() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0], 3));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(16), 4));
  const weights = new Float32Array(16);
  for (let index = 0; index < 4; index += 1) weights[index * 4] = 1;
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const bone = new THREE.Bone();
  bone.name = 'body_top2';
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

function createAnatomySelectionFixture() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.08, -0.08, 0, 0.08, -0.08, 0, 0, 0.08, 0,
    -0.08, -0.08, 0.008, 0.08, -0.08, 0.008, 0, 0.08, 0.008,
  ], 3));
  geometry.setIndex([0, 1, 2, 3, 4, 5]);
  const skinIndices = new Uint16Array(24);
  for (let index = 3; index < 6; index += 1) skinIndices[index * 4] = 1;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  const skinWeights = new Float32Array(24);
  for (let index = 0; index < 6; index += 1) skinWeights[index * 4] = 1;
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  const abdomenBone = new THREE.Bone(); abdomenBone.name = 'abdomen_bone';
  const chestBone = new THREE.Bone(); chestBone.name = 'chest_bone';
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.name = 'semantic-selection-surface';
  mesh.add(abdomenBone, chestBone);
  mesh.bind(new THREE.Skeleton([abdomenBone, chestBone]));
  const root = new THREE.Group(); root.add(mesh); root.updateMatrixWorld(true); mesh.skeleton.update();
  const metadata = buildSkinnedTriangleInfluenceMetadata(mesh, { boneMap: { abdomen: 'abdomen_bone', upper_chest: 'chest_bone' } });
  return { root, mesh, geometry, metadata };
}

test('anatomy-aware projection prefers routed skin influence and rejects incompatible, distant, and reversed candidates', () => {
  const fixture = createAnatomySelectionFixture();
  const metadataByMesh = new Map([[fixture.mesh, fixture.metadata]]);
  const diagnostics = createSurfaceBindingDiagnostics();
  const binding = findClosestSkinnedSurface([fixture.mesh], new THREE.Vector3(0, 0, 0.002), {
    regionId: 'upper_chest', bodyId: 'upper_chest', referenceNormal: new THREE.Vector3(0, 0, 1),
    anatomyAware: true, triangleMetadataByMesh: metadataByMesh, diagnostics,
  });
  assert.ok(validateSurfaceBinding(binding));
  assert.equal(binding.triangleIndex, 1, 'the routed chest triangle wins over the geometrically closer abdomen triangle');
  assert.equal(binding.semanticCompatibility.kind, 'exact');
  assert.equal(binding.semanticCompatibility.dominantSemanticId, 'upper_chest');
  assert.ok(diagnostics.anatomyIncompatibleCandidateRejectionCount >= 1);
  assert.equal(diagnostics.successfulBindings, 1);
  assert.equal(diagnostics.selectedTriangleSemanticCompatibility.kind, 'exact');
  assert.equal(diagnostics.selectedTriangleSemanticCompatibility.triangleIndex, 1);

  const incompatibleDiagnostics = createSurfaceBindingDiagnostics();
  assert.equal(findClosestSkinnedSurface([fixture.mesh], new THREE.Vector3(0, 0, 0.002), {
    regionId: 'left_hand', bodyId: 'left_hand', anatomyAware: true, triangleMetadataByMesh: metadataByMesh, diagnostics: incompatibleDiagnostics,
  }), null);
  assert.ok(incompatibleDiagnostics.anatomyIncompatibleCandidateRejectionCount >= 2);

  const distanceDiagnostics = createSurfaceBindingDiagnostics();
  assert.equal(findClosestSkinnedSurface([fixture.mesh], new THREE.Vector3(0, 0, MAX_ADJACENT_SURFACE_PROJECTION_DISTANCE + 0.02), {
    regionId: 'upper_chest', bodyId: 'upper_chest', referenceNormal: new THREE.Vector3(0, 0, 1), anatomyAware: true, triangleMetadataByMesh: metadataByMesh, diagnostics: distanceDiagnostics,
  }), null);
  assert.ok(distanceDiagnostics.excessiveDistanceRejectionCount > 0);

  const normalDiagnostics = createSurfaceBindingDiagnostics();
  assert.equal(findClosestSkinnedSurface([fixture.mesh], new THREE.Vector3(0, 0, 0.01), {
    regionId: 'upper_chest', bodyId: 'upper_chest', referenceNormal: new THREE.Vector3(0, 0, -1), anatomyAware: true, triangleMetadataByMesh: metadataByMesh, diagnostics: normalDiagnostics,
  }), null);
  assert.ok(normalDiagnostics.normalIncompatibilityRejectionCount > 0);
  fixture.geometry.dispose(); fixture.mesh.material.dispose();
});

test('puncture bindings store valid barycentrics and follow authored skinned animation', () => {
  const { root, mesh, bone, geometry } = createSkinnedSurfaceFixture();
  const hitPoint = new THREE.Vector3(0.12, 0.08, 0.03);
  const binding = findClosestSkinnedSurface([mesh], hitPoint, { regionId: 'upper_chest', bodyId: 'upper_chest' });
  assert.ok(validateSurfaceBinding(binding));
  assert.equal(binding.mesh, mesh);
  assert.ok(binding.triangleIndices.every((index) => index >= 0 && index < geometry.attributes.position.count));
  assert.ok(Math.abs(binding.barycentric.x + binding.barycentric.y + binding.barycentric.z - 1) < 1e-6);
  const initial = reconstructSkinnedSurface(binding);
  assert.ok(hitPoint.distanceTo(initial.point) < 0.05);
  assert.ok(WOUND_SURFACE_BIAS <= 0.001, 'decals stay close enough to the animated skin to avoid visibly floating');
  bone.position.x = 0.18;
  root.updateMatrixWorld(true); mesh.skeleton.update();
  const animated = reconstructSkinnedSurface(binding);
  assert.ok(animated.point.distanceTo(initial.point) > 0.17, 'binding follows animated bone translation');
  bone.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.16);
  root.updateMatrixWorld(true); mesh.skeleton.update();
  const flinched = reconstructSkinnedSurface(binding);
  assert.ok(flinched.point.distanceTo(animated.point) > 0.001, 'binding follows the next authored bone pose');
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

test('sword cuts retain bounded skinned-surface samples while persistent ribbon presentation stays retired', async () => {
  const { actor, physics, scene } = await createActor();
  const { hit, worldPoint } = makeHit(actor, 'upper_chest', new THREE.Vector3(-0.12, 0, 0.1));
  const fixture = createSkinnedSurfaceFixture();
  fixture.root.position.copy(worldPoint).add(new THREE.Vector3(0.12, 0, 0));
  scene.add(fixture.root);
  fixture.root.updateMatrixWorld(true);
  fixture.mesh.skeleton.update();
  actor.visualAdapter = {
    bindVisibleSurface: (point, options) => findClosestSkinnedSurface([fixture.mesh], point, options),
    reconstructVisibleSurface: (binding, target) => reconstructSkinnedSurface(binding, target),
    dispose() {},
    reset() {},
  };

  const director = new CombatDirector({ actor });
  const weapon = { id: 'dreadstone_sword', family: 'sword' };
  const intent = new MeleeIntentWeapon({ weaponId: weapon.id }).interpret({ ownerId: 5, controlState: 'attacking', localVelocity: new THREE.Vector3(1.4, 0, 0) });
  const interaction = director.beginEdgeDamage({ weapon, intent, hit, point: worldPoint, localPoint: hit.localPoint, surfaceNormal: new THREE.Vector3(0, 0, 1), direction: new THREE.Vector3(1, 0, 0), travel: 0.07, depth: 0.024, severity: 0.75, edgeAlignment: 0.92, swingSpeed: 1.4, classification: 'cut', part: 'leftEdge' });
  const adjacentHit = { ...hit, regionId: 'lower_chest', region: HUMANOID_ANATOMY_REGIONS.find((region) => region.id === 'lower_chest'), localPoint: hit.localPoint.clone().add(new THREE.Vector3(0.12, -0.04, 0)) };
  director.extendEdgeDamage(interaction.id, { hit: adjacentHit, point: worldPoint.clone().add(new THREE.Vector3(0.12, -0.04, 0)), localPoint: adjacentHit.localPoint, surfaceNormal: new THREE.Vector3(0, 0, 1), direction: new THREE.Vector3(1, -0.1, 0).normalize(), travel: 0.126, depth: 0.026, severity: 0.82, edgeAlignment: 0.9, swingSpeed: 1.55 });
  director.finishEdgeDamage(interaction.id);
  director.update(0.4);
  actor.woundSystem.update(1 / 60);

  const wound = interaction.result.wound;
  assert.ok(wound);
  assert.equal(wound.visualFamily, 'sword');
  assert.equal(wound.visualSlot, null, 'sword never allocates the knife decal renderer');
  assert.equal(wound.decalVariantId, null);
  assert.ok(wound.swordSamples.length > 2, 'fast edge travel is spatially resampled instead of joined by one chord');
  assert.ok(wound.swordSamples.every((sample) => validateSurfaceBinding(sample.binding)));
  assert.ok(wound.swordSamples.slice(1).every((sample, index) => sample.sourcePoint.distanceTo(wound.swordSamples[index].sourcePoint) <= SWORD_CUT_TARGET_SAMPLE_SPACING + 1e-6));
  assert.ok(wound.swordVisualDiagnostics.insertedResampleCount > 0);
  assert.ok(wound.swordVisualDiagnostics.bindingAttempts >= wound.swordSamples.length);
  assert.ok(wound.swordVisualDiagnostics.successfulBindings >= wound.swordSamples.length);
  assert.equal(wound.swordVisualDiagnostics.failedBindings, 0);
  assert.ok(wound.swordVisualDiagnostics.maximumAcceptedBindDistance <= MAX_SURFACE_PROJECTION_DISTANCE);
  for (const key of ['bindingAttempts', 'successfulBindings', 'failedBindings', 'anatomyIncompatibleCandidateRejectionCount', 'excessiveDistanceRejectionCount', 'normalIncompatibilityRejectionCount', 'rebindAttempts', 'rebindSuccesses', 'insertedResampleCount', 'renderedSegmentCount', 'hiddenSegmentCount', 'maximumAcceptedBindDistance', 'maximumRenderedSegmentLength', 'maximumMidpointToSurfaceError', 'oneSampleSeedUsageCount']) {
    assert.ok(Object.hasOwn(wound.swordVisualDiagnostics, key), `bounded sword diagnostics expose ${key}`);
  }
  assert.deepEqual(wound.impactedRegionIds, ['upper_chest', 'lower_chest']);
  assert.equal(wound.continuousRegionTransitionCount, 0);
  assert.equal(wound.renderedSegmentCount, 0);
  assert.equal(wound.swordVisualDiagnostics.renderedPrimitiveCount, 0);
  assert.equal(wound.swordVisualDiagnostics.oneSampleSeedUsageCount, 0);
  assert.equal(wound.swordVisualDiagnostics.presentationStatus, 'retired_no_persistent_slash');
  assert.equal(wound.surfaceVisualStatus, 'retired_no_persistent_slash');
  assert.equal(wound.swordVisualSlot.ribbon.visible, false);
  assert.equal(wound.swordVisualSlot.ribbon.geometry.drawRange.count, 0);
  const firstBoundPose = reconstructSkinnedSurface(wound.swordSamples[0].binding);
  fixture.bone.position.x = 0.12;
  fixture.root.updateMatrixWorld(true);
  fixture.mesh.skeleton.update();
  actor.woundSystem.update(1 / 60);
  const animatedBoundPose = reconstructSkinnedSurface(wound.swordSamples[0].binding);
  assert.ok(animatedBoundPose.point.x > firstBoundPose.point.x + 0.1, 'retired presentation does not discard animation-following surface bindings');
  assert.equal(wound.swordVisualSlot.ribbon.visible, false);
  assert.ok(wound.swordSamples.length <= MAX_SWORD_CUT_SURFACE_SAMPLES);

  director.dispose();
  actor.dispose();
  physics.dispose();
  fixture.geometry.dispose();
  fixture.mesh.material.dispose();
});

test('surface projection reaches animation-following skin from bounded proxy depth without accepting distant geometry', () => {
  const { mesh, geometry } = createSkinnedSurfaceFixture();
  const proxyDepthPoint = new THREE.Vector3(0.1, 0.08, MAX_SURFACE_PROJECTION_DISTANCE - 0.005);
  const binding = findClosestSkinnedSurface([mesh], proxyDepthPoint, { regionId: 'upper_chest', bodyId: 'upper_chest', referenceNormal: new THREE.Vector3(0, 0, 1) });
  assert.ok(validateSurfaceBinding(binding), 'a contact from inside the animated torso proxy reaches the visible skin');
  assert.ok(reconstructSkinnedSurface(binding).point.distanceTo(proxyDepthPoint) <= MAX_SURFACE_PROJECTION_DISTANCE + 1e-8);
  assert.equal(findClosestSkinnedSurface([mesh], new THREE.Vector3(0.1, 0.08, MAX_SURFACE_PROJECTION_DISTANCE + 0.005)), null, 'projection remains tightly bounded and cannot jump to unrelated distant surfaces');
  geometry.dispose(); mesh.material.dispose();
});

test('puncture decals hide when no valid visible-surface binding exists and never use proxy fallback anchors', async () => {
  const { actor, physics } = await createActor();
  for (const bodyId of ['upper_chest', 'lower_chest', 'abdomen']) {
    const { hit, worldPoint } = makeHit(actor, bodyId, new THREE.Vector3(0.035, 0.01, 0.1));
    const wound = actor.beginPunctureWound({ hit, entryPoint: worldPoint, direction: new THREE.Vector3(0, 0, -1), surfaceNormal: new THREE.Vector3(0, 0, 1), depth: 0.018 });
    const attached = actor.woundSystem.getAttachedSurfacePose(wound);
    assert.equal(attached, null, `${bodyId} has no floating physics-body visual fallback`);
    assert.equal(wound.surfaceBinding, null);
    assert.equal(wound.surfaceBindingStatus, 'puncture_hidden_invalid_surface');
    assert.equal(wound.fallbackAnchorUsage, false);
    assert.equal(wound.visualSlot.puncture.visible, false);
  }
  actor.dispose(); physics.dispose();
});

test('failed slash projection retains wound data without rendering a fallback slit chain', async () => {
  const { actor, physics } = await createActor();
  const { hit, worldPoint } = makeHit(actor, 'upper_chest', new THREE.Vector3(-0.08, 0, 0.1));
  const endPoint = worldPoint.clone().add(new THREE.Vector3(0.18, 0.035, 0));
  const materialCount = actor.woundSystem.decalLibrary.materialsById.size;
  const wound = actor.applySlashWound({ hit, startPoint: worldPoint, endPoint, surfaceNormal: new THREE.Vector3(0, 0, 1), cutDirection: endPoint.clone().sub(worldPoint).normalize(), depth: 0.018, cutLength: worldPoint.distanceTo(endPoint), severity: 0.32, classification: 'shallow_cut' });
  assert.equal(wound.surfaceBindingStatus, 'slash_surface_invalid');
  assert.equal(wound.fallbackReason, 'insufficient_slash_surface_samples');
  assert.equal(wound.renderedSegmentCount, 0);
  assert.equal(wound.visualSlot.puncture.visible, false);
  assert.equal(wound.visualSlot.slash.visible, false);
  assert.equal(wound.surfaceVisualStatus, 'retired_no_persistent_slash');
  assert.equal(wound.slashVisualDiagnostics.oneSampleSeedUsageCount, 0);
  assert.equal(wound.slashVisualDiagnostics.drawCallCount, 0);
  assert.match(wound.decalVariantId, /knife_puncture_(?:slit|split)_/);
  assert.equal(actor.woundSystem.decalLibrary.materialsById.size, materialCount, 'fallback creates no material or texture');
  actor.reset();
  assert.ok(actor.woundSystem.visualSlots.every((slot) => slot.woundId == null && !slot.puncture.visible && !slot.slash.visible));
  assert.equal(wound.slashFallbackUsage, false);
  assert.equal(wound.fallbackReason, null);
  actor.dispose(); physics.dispose();
});

test('knife slashes preserve bleeding physiology without the retired contact streak burst', async () => {
  const { actor, physics, scene } = await createActor();
  const bloodEffects = new CombatBloodEffects({ scene, woundSystem: actor.woundSystem, physiology: actor.physiology });
  const director = new CombatDirector({ actor, bloodEffects });
  const { hit, worldPoint } = makeHit(actor, 'upper_chest');
  const weapon = { id: KNIFE_COMBAT_CONFIG.itemId, family: 'knife', ...KNIFE_COMBAT_CONFIG };
  const intent = new MeleeIntentWeapon({ weaponId: weapon.id }).interpret({ ownerId: 10, controlState: 'attacking', localVelocity: new THREE.Vector3(1, 0, 0) });
  const endPoint = worldPoint.clone().add(new THREE.Vector3(0.12, 0, 0));
  const interaction = director.beginSlash({ weapon, intent, hit, startPoint: worldPoint, endPoint, surfaceNormal: new THREE.Vector3(0, 0, 1), cutDirection: new THREE.Vector3(1, 0, 0), depth: 0.026, cutLength: 0.12, severity: 0.62, classification: 'deep_slash', edgeAlignment: 0.9 });
  director.finishSlash(interaction.id);
  director.update(0.4);
  const wound = interaction.result.wound;
  assert.ok(wound);
  assert.equal(wound.bloodEmitted, 0);
  assert.equal(wound.visualSlot.slash.visible, false);
  assert.equal(director.eventLog.some((event) => event.type === COMBAT_DIRECTOR_EVENTS.blood && event.action === 'slash'), false);
  actor.beforePhysics(1 / 60);
  bloodEffects.update(1.2);
  assert.ok(wound.bleedingRate > 0);
  assert.ok(wound.bloodEmitted > 0, 'continuous wound bleeding remains active after the contact burst is removed');

  director.dispose();
  bloodEffects.dispose();
  actor.dispose();
  physics.dispose();
});

test('wound visuals reselect only on material category changes, remain bounded, and lock at completion', async () => {
  const { actor, physics } = await createActor();
  const { hit, worldPoint } = makeHit(actor, 'upper_chest', new THREE.Vector3(0, 0, 0.1));
  const wound = actor.beginPunctureWound({ hit, entryPoint: worldPoint, direction: new THREE.Vector3(0, 0, -1), surfaceNormal: new THREE.Vector3(0, 0, 1), depth: 0.012, impactSeverity: 0.2 });
  assert.equal(wound.decalPhysicalCategory, 'slit');
  assert.equal(wound.decalSelectionRevisionCount, 0);
  actor.woundSystem.extendPuncture(wound.id, { depth: 0.06 });
  assert.equal(wound.decalPhysicalCategory, 'split');
  const splitVariant = wound.decalVariantId;
  const splitRevision = wound.decalSelectionRevisionCount;
  actor.woundSystem.extendPuncture(wound.id, { depth: 0.061 });
  assert.equal(wound.decalVariantId, splitVariant, 'same physical category cannot flicker');
  assert.equal(wound.decalSelectionRevisionCount, splitRevision);
  actor.woundSystem.extendPuncture(wound.id, { depth: 0.075, lateralMotion: 0.016 });
  assert.equal(wound.decalPhysicalCategory, 'double');
  wound.impactSeverity = 0.96;
  wound.entryObliqueness = 0.62;
  actor.woundSystem.extendPuncture(wound.id, { depth: 0.11, lateralMotion: 0.03 });
  assert.equal(wound.decalPhysicalCategory, 'burst');
  assert.ok(wound.decalSelectionRevisionCount <= 3);
  actor.woundSystem.markExtracted(wound.id, { releaseSeverity: 0.11 });
  assert.equal(wound.decalSelectionState, 'locked');
  const lockedVariant = wound.decalVariantId;
  wound.decalPhysicalCategory = 'slit';
  actor.woundSystem.updateDecalSelection(wound, 'puncture');
  assert.equal(wound.decalVariantId, lockedVariant, 'locked wound never reselects');
  assert.ok(wound.decalSelectionRevisionCount <= 3);

  const slashStart = worldPoint.clone().add(new THREE.Vector3(-0.12, 0.12, 0));
  const slashEnd = slashStart.clone().add(new THREE.Vector3(0.1, 0, 0));
  const slash = actor.applySlashWound({ hit: { ...hit, localPoint: hit.localPoint.clone().add(new THREE.Vector3(-0.12, 0.12, 0)) }, startPoint: slashStart, endPoint: slashEnd, surfaceNormal: new THREE.Vector3(0, 0, 1), cutDirection: new THREE.Vector3(1, 0, 0), depth: 0.03, cutLength: 0.1, severity: 0.45, classification: 'shallow_cut' });
  const curvedEnd = slashEnd.clone().add(new THREE.Vector3(0, 0.1, 0));
  actor.woundSystem.extendSlash(slash.id, { localEnd: slash.localCutEnd.clone().add(new THREE.Vector3(0, 0.1, 0)), worldEnd: curvedEnd, surfaceNormal: new THREE.Vector3(0, 0, 1), addedTravel: 0.1, depth: 0.03, severity: 0.52, edgeAlignment: 0.8 });
  assert.ok(slash.pathCurvature >= 0.32, 'curvature derives from the sampled physical path');
  assert.match(slash.decalVariantId, /knife_puncture_(?:slit|split)_/);
  actor.woundSystem.finishSlash(slash.id, true);
  assert.equal(slash.lastContactInterrupted, true);
  assert.equal(slash.decalSelectionState, 'locked');
  actor.dispose(); physics.dispose();
});

test('wound and reaction lifecycle keeps one bounded pool while retaining the session decal cache', async () => {
  const { actor, physics } = await createActor();
  const geometryIds = actor.woundSystem.visualSlots.flatMap((slot) => [slot.puncture.geometry.uuid, slot.slash.geometry.uuid]);
  const decalLibrary = actor.woundSystem.decalLibrary;
  const cachedMaterialCount = decalLibrary.materialsById.size;
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
  assert.equal(decalLibrary.loadCount, 1, 'reset and actor disposal do not reload the authored pack');
  assert.equal(decalLibrary.materialsById.size, cachedMaterialCount, 'actor disposal retains session-owned authored materials');
  assert.equal(actor.woundSystem.visualSlots.length, 0);
  physics.dispose();
});

test('Dreadguard holds its exported rest pose kinematically before a dynamic ragdoll handoff', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const actor = new HumanoidCombatActor({ physics, scene: new THREE.Scene(), visualProfile: DREADGUARD_DAMAGE_COMBAT_PROFILE });
  let ragdollBeginCount = 0;
  const visualAdapter = {
    beginRagdoll: () => { ragdollBeginCount += 1; return true; },
    getProxyPose: (bodyId) => {
      const body = actor.bodies.get(bodyId)?.body;
      const position = body?.translation();
      const quaternion = body?.rotation();
      return body ? {
        position: new THREE.Vector3(position.x, position.y, position.z),
        quaternion: new THREE.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w),
      } : null;
    },
    updateRagdoll() {},
    reset() {},
    dispose() {},
  };
  actor.visualAdapter = visualAdapter;
  actor.setAnimationAuthorityReady(visualAdapter);
  assert.equal(isHumanoidPoseAuthoritative(DREADGUARD_DAMAGE_COMBAT_PROFILE), true);
  assert.ok([...actor.bodies.values()].every(({ body }) => body.isKinematic()), 'the exported rest pose owns kinematic combat proxies while alive');
  assert.equal(actor.activateRagdoll({ forced: true }), true);
  assert.equal(actor.ragdollActive, true);
  assert.equal(ragdollBeginCount, 1);
  assert.ok([...actor.bodies.values()].every(({ body }) => body.isDynamic()), 'ragdoll handoff releases every proxy to dynamic physics');
  actor.dispose();
  physics.dispose();
});

test('Dreadguard progressive head impacts stay upright through Light and Medium, then collapse immediately at Heavy', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const actor = new HumanoidCombatActor({
    physics,
    scene: new THREE.Scene(),
    visualProfile: DREADGUARD_DAMAGE_COMBAT_PROFILE,
    automaticMortality: false,
    mortalityMode: COMBAT_MORTALITY_MODES.immortalReactive,
  });
  const stageResults = [
    { stage: 'LIGHT', stageIndex: 0, terminalStageReached: false },
    { stage: 'MEDIUM', stageIndex: 1, terminalStageReached: false },
    { stage: 'HEAVY', stageIndex: 2, terminalStageReached: true },
  ];
  let stageCallCount = 0;
  let ragdollBeginCount = 0;
  const visualAdapter = {
    applyForgeMaceDamage: () => ({
      applied: true,
      progressiveSite: true,
      siteId: 'damage_site',
      stageCount: 3,
      terminalStage: 'HEAVY',
      ...stageResults[stageCallCount++],
    }),
    playDeathAnimation: () => null,
    beginRagdoll: () => { ragdollBeginCount += 1; return true; },
    getProxyPose: (bodyId) => {
      const body = actor.bodies.get(bodyId)?.body;
      const position = body?.translation();
      const quaternion = body?.rotation();
      return body ? {
        position: new THREE.Vector3(position.x, position.y, position.z),
        quaternion: new THREE.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w),
      } : null;
    },
    updateRagdoll() {},
    reset() {},
    dispose() {},
  };
  actor.visualAdapter = visualAdapter;
  actor.setAnimationAuthorityReady(visualAdapter);
  const { hit, worldPoint } = makeHit(actor, 'head', new THREE.Vector3(-0.05, 0.04, 0.08));
  const createImpact = (serial) => ({
    schema: 'dreadstone.blunt-impact.v1',
    interactionId: `three-stage-head-impact-${serial}`,
    primitive: 'mace_head',
    classification: 'committed_blunt',
    worldPoint: worldPoint.clone(),
    worldNormal: new THREE.Vector3(0, 0, 1),
    impactDirection: new THREE.Vector3(0.1, -0.15, -1).normalize(),
    normalImpactSpeed: 4,
    tangentialSpeed: 0.3,
    estimatedImpulse: 21.6,
    estimatedEnergy: 43.2,
    gesturePower: 0.7,
    impactRadiusEstimate: 0.11,
  });
  try {
    const light = actor.applyBluntImpact({ hit, impact: createImpact(1) });
    assert.equal(light.forgeDamage.stage, 'LIGHT');
    assert.equal(light.fatalHeadHitTriggered, false);
    assert.equal(actor.lifeState, 'alive');
    assert.ok([...actor.bodies.values()].every(({ body }) => body.isKinematic()));

    const medium = actor.applyBluntImpact({ hit, impact: createImpact(2) });
    assert.equal(medium.forgeDamage.stage, 'MEDIUM');
    assert.equal(medium.fatalHeadHitTriggered, false);
    assert.equal(actor.lifeState, 'alive');
    assert.ok([...actor.bodies.values()].every(({ body }) => body.isKinematic()));

    const heavy = actor.applyBluntImpact({ hit, impact: createImpact(3) });
    assert.equal(heavy.forgeDamage.stage, 'HEAVY');
    assert.equal(heavy.fatalHeadHitTriggered, true);
    assert.equal(heavy.collapseRequested, true);
    assert.equal(actor.lifeState, 'dying');
    assert.equal(actor.ragdollActive, true);
    assert.equal(ragdollBeginCount, 1);
    assert.equal(actor.fatalMaceHeadImpactActivationCount, 1);
    assert.ok([...actor.bodies.values()].every(({ body }) => body.isDynamic()));
  } finally {
    actor.dispose();
    physics.dispose();
  }
});

test('sword edge damage keeps its physiological wound while slash ribbons and contact streak bursts stay disabled', async () => {
  const { actor, physics, scene } = await createActor();
  const bloodEffects = new CombatBloodEffects({ scene, woundSystem: actor.woundSystem, physiology: actor.physiology });
  const director = new CombatDirector({ actor, bloodEffects });
  const { hit, worldPoint } = makeHit(actor, 'upper_chest');
  const beforeTrauma = actor.regionState.get(hit.regionId).trauma;
  const weapon = { id: 'dreadstone_sword', family: 'sword' };
  const intent = new MeleeIntentWeapon({ weaponId: weapon.id }).interpret({ ownerId: 9, controlState: 'attacking', localVelocity: new THREE.Vector3(0.8, 0, 0) });
  const interaction = director.beginEdgeDamage({ weapon, intent, hit, point: worldPoint, localPoint: hit.localPoint, surfaceNormal: new THREE.Vector3(0, 0, 1), direction: new THREE.Vector3(1, 0, 0), travel: 0.08, depth: 0.018, severity: 0.72, edgeAlignment: 0.9, swingSpeed: 1.35, classification: 'cut', part: 'leftEdge' });
  assert.ok(interaction);
  assert.equal(interaction.result.edgeDamage.schema, EDGE_DAMAGE_SCHEMA);
  assert.equal(interaction.result.edgeDamage.target.regionId, hit.regionId);
  assert.equal(interaction.result.wound, undefined);
  director.extendEdgeDamage(interaction.id, { hit, point: worldPoint.clone().add(new THREE.Vector3(0.06, 0, 0)), localPoint: hit.localPoint.clone().add(new THREE.Vector3(0.06, 0, 0)), surfaceNormal: new THREE.Vector3(0, 0, 1), direction: new THREE.Vector3(1, 0, 0), travel: 0.06, depth: 0.015, severity: 0.6, edgeAlignment: 0.86, swingSpeed: 1.2 });
  director.finishEdgeDamage(interaction.id);
  director.update(0.4);
  assert.equal(actor.woundSystem.wounds.length, 1);
  assert.equal(interaction.result.wound.visualFamily, 'sword');
  assert.equal(interaction.result.wound.visualSlot, null, 'sword damage never enters the knife wound/decal renderer');
  assert.equal(interaction.result.wound.decalVariantId, null);
  assert.equal(interaction.result.wound.physiologyRegistered, true);
  assert.ok(interaction.result.wound.bleedingProfile.baseRate > 0);
  assert.equal(interaction.result.wound.bloodEmitted, 0, 'sword slashes do not emit the retired floating contact streak');
  assert.equal(interaction.result.wound.swordVisualSlot.ribbon.visible, false);
  assert.equal(interaction.result.wound.surfaceVisualStatus, 'retired_no_persistent_slash');
  const contactBloodCount = interaction.result.wound.bloodEmitted;
  actor.beforePhysics(1 / 60);
  bloodEffects.update(1.2);
  assert.ok(interaction.result.wound.bleedingRate > 0);
  assert.ok(interaction.result.wound.bloodEmitted > contactBloodCount, 'ongoing emission reads the persistent wound entity');
  assert.equal(actor.physiology.getDiagnostics().registeredWounds, 1);
  assert.ok(actor.regionState.get(hit.regionId).trauma > beforeTrauma, 'edge damage applies trauma through semantic anatomy');
  assert.equal(interaction.result.edgeDamage.completed, true);
  assert.equal(interaction.result.edgeDamage.samples.length, 2);
  assert.equal(director.eventLog.some((event) => event.type === COMBAT_DIRECTOR_EVENTS.wound), false);
  director.dispose();
  bloodEffects.dispose();
  actor.dispose();
  physics.dispose();
});

test('sword thrusts use larger bound puncture decals from the authored puncture pack', async () => {
  const { actor, physics, scene } = await createActor();
  const { hit, worldPoint } = makeHit(actor, 'upper_chest', new THREE.Vector3(0, 0, 0.1));
  const fixture = createSkinnedSurfaceFixture();
  fixture.root.position.copy(worldPoint);
  scene.add(fixture.root);
  fixture.root.updateMatrixWorld(true);
  fixture.mesh.skeleton.update();
  actor.visualAdapter = {
    scene: fixture.root,
    bindVisibleSurface: (point, options) => findClosestSkinnedSurface([fixture.mesh], point, options),
    reconstructVisibleSurface: (binding, target) => reconstructSkinnedSurface(binding, target),
    dispose() {},
    reset() {},
  };
  const director = new CombatDirector({ actor });
  const weapon = {
    id: 'dreadstone_sword',
    family: 'sword',
    bladeLength: DREADSTONE_SWORD_DIMENSIONS.bladeLength,
    bladeWidth: DREADSTONE_SWORD_DIMENSIONS.bladeWidth,
    bladeThickness: DREADSTONE_SWORD_DIMENSIONS.bladeThickness,
    maximumPenetrationDepth: SWORD_MAXIMUM_PENETRATION_DEPTH,
  };
  const intent = new MeleeIntentWeapon({ weaponId: weapon.id }).interpret({ ownerId: 12, controlState: 'attacking', localVelocity: new THREE.Vector3(0, 0, -1.2) });
  const interaction = director.beginSwordPuncture({ weapon, intent, hit, entryPoint: worldPoint, surfaceNormal: new THREE.Vector3(0, 0, 1), direction: new THREE.Vector3(0, 0, -1), contactDirection: new THREE.Vector3(0, 0, -1), depth: 0.04, force: 1.2 });
  director.update(0.4);
  actor.woundSystem.update(1 / 60);

  const wound = interaction.result.wound;
  assert.ok(wound);
  assert.equal(wound.interactionKind, 'sword_thrust');
  assert.equal(wound.weaponFamily, 'sword');
  assert.equal(wound.bladeWidth, DREADSTONE_SWORD_DIMENSIONS.bladeWidth);
  assert.equal(wound.bladeThickness, DREADSTONE_SWORD_DIMENSIONS.bladeThickness);
  assert.equal(wound.puncturePresentationScale, SWORD_THRUST_PUNCTURE_PRESENTATION_SCALE);
  assert.ok(wound.maximumDepth < SWORD_MAXIMUM_PENETRATION_DEPTH, 'the entry decal exists at rupture before maximum penetration');
  assert.equal(wound.decalFamily, 'puncture');
  assert.match(wound.decalVariantId, /^knife_puncture_/);
  assert.equal(validateSurfaceBinding(wound.surfaceBinding), true);
  assert.equal(wound.visualSlot.puncture.visible, true);
  assert.equal(wound.swordVisualSlot, null);
  assert.ok(Math.abs(wound.visualSlot.puncture.scale.x - wound.visualMajorMeters * SWORD_THRUST_PUNCTURE_PRESENTATION_SCALE) < 1e-9);
  assert.ok(Math.abs(wound.visualSlot.puncture.scale.y - wound.visualMinorMeters * SWORD_THRUST_PUNCTURE_PRESENTATION_SCALE) < 1e-9);
  const knifeDimensions = derivePuncturePhysicalDimensions({ bladeWidth: KNIFE_COMBAT_CONFIG.bladeWidth, bladeThickness: KNIFE_COMBAT_CONFIG.bladeThickness, maximumPenetrationDepth: KNIFE_COMBAT_CONFIG.maximumPenetrationDepth, penetrationDepth: 0.04, impactSeverity: 0.72 });
  assert.ok(wound.visualSlot.puncture.scale.x > knifeDimensions.visualMajorMeters * KNIFE_PUNCTURE_PRESENTATION_SCALE);
  assert.ok(wound.visualSlot.puncture.scale.y > knifeDimensions.visualMinorMeters * KNIFE_PUNCTURE_PRESENTATION_SCALE);
  assert.equal(interaction.kind, 'sword_puncture');
  assert.equal(interaction.result.edgeDamage, undefined, 'sword thrusts no longer enter the continuous edge-damage accumulator');

  director.dispose();
  actor.dispose();
  physics.dispose();
  fixture.geometry.dispose();
  fixture.mesh.material.dispose();
});

test('knife and sword punctures remain available during dying without replaying mortality', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  let deathTransitionCount = 0;
  const acceptedCombatAudio = {
    registerActor() {},
    unregisterActor() {},
    handleLifeStateTransition: (_actor, transition) => {
      if (transition.nextState === 'dying') deathTransitionCount += 1;
      return true;
    },
    shouldSuppressSynthesizedDeathVocal: () => true,
  };
  const actor = new HumanoidCombatActor({ physics, scene, acceptedCombatAudio });
  const director = new CombatDirector({ actor });
  assert.equal(actor.transitionLifeState('dying', 'test-falling-window', { externalCommit: true, forceFatal: true }), true);
  assert.equal(deathTransitionCount, 1);
  const { hit, worldPoint } = makeHit(actor, 'upper_chest');
  const stabIntent = new MeleeIntentWeapon({ weaponId: 'old_work_knife' }).interpret({ ownerId: 91, controlState: 'attacking', localVelocity: new THREE.Vector3(0, 0, -1.1) });
  const knife = director.beginPuncture({
    weapon: { id: 'old_work_knife', family: 'knife' },
    intent: stabIntent,
    hit,
    entryPoint: worldPoint,
    surfaceNormal: new THREE.Vector3(0, 0, 1),
    direction: new THREE.Vector3(0, 0, -1),
    depth: 0.05,
    force: 1,
  });
  const sword = director.beginSwordPuncture({
    weapon: { id: 'dreadstone_sword', family: 'sword' },
    intent: { ...stabIntent, weaponId: 'dreadstone_sword' },
    hit,
    entryPoint: worldPoint.clone().add(new THREE.Vector3(0.02, 0, 0)),
    surfaceNormal: new THREE.Vector3(0, 0, 1),
    direction: new THREE.Vector3(0, 0, -1),
    contactDirection: new THREE.Vector3(0, 0, -1),
    depth: 0.08,
    force: 1.2,
  });
  director.update(0.4);
  assert.equal(knife.result.wound?.interactionKind, 'puncture');
  assert.equal(sword.result.wound?.interactionKind, 'sword_thrust');
  assert.equal(knife.result.wound?.targetLifeStateAtCreation, 'dying');
  assert.equal(sword.result.wound?.targetLifeStateAtCreation, 'dying');
  assert.equal(actor.lifeState, 'dying');
  assert.equal(actor.transitionLifeState('dying', 'duplicate-terminal-request', { externalCommit: true, forceFatal: true }), false);
  assert.equal(deathTransitionCount, 1, 'the accepted death transition remains one-shot');
  director.dispose();
  actor.dispose();
  physics.dispose();
});

test('normal humanoids survive glancing sword contact but repeated committed chest cuts become lethal', async () => {
  const { actor, physics } = await createActor();
  const director = new CombatDirector({ actor });
  const weapon = { id: 'dreadstone_sword', family: 'sword' };
  const intent = new MeleeIntentWeapon({ weaponId: weapon.id }).interpret({ ownerId: 11, controlState: 'attacking', localVelocity: new THREE.Vector3(1.5, 0, 0) });
  const { hit, worldPoint } = makeHit(actor, 'upper_chest');

  const glance = director.beginEdgeDamage({ weapon, intent, hit, point: worldPoint, localPoint: hit.localPoint, surfaceNormal: new THREE.Vector3(0, 0, 1), direction: new THREE.Vector3(1, 0, 0), travel: 0.008, depth: 0.002, severity: 0.12, edgeAlignment: 0.22, swingSpeed: 0.18, classification: 'cut', part: 'leftEdge' });
  director.finishEdgeDamage(glance.id);
  director.update(0.4);
  assert.equal(actor.lifeState, 'alive');

  for (let stroke = 0; stroke < 6 && actor.lifeState === 'alive'; stroke += 1) {
    const point = worldPoint.clone().add(new THREE.Vector3(stroke * 0.006, 0, 0));
    const cut = director.beginEdgeDamage({ weapon, intent, hit, point, localPoint: hit.localPoint, surfaceNormal: new THREE.Vector3(0, 0, 1), direction: new THREE.Vector3(1, 0, 0), travel: 0.09, depth: 0.026, severity: 0.8, edgeAlignment: 0.92, swingSpeed: 1.55, classification: 'cut', part: 'leftEdge' });
    director.finishEdgeDamage(cut.id);
    director.update(0.4);
  }
  assert.equal(actor.lifeState, 'dying');
  actor.beforePhysics(2);
  assert.equal(actor.lifeState, 'dead');
  assert.ok(actor.woundSystem.wounds.filter((wound) => wound.visualFamily === 'sword').length >= 2);

  director.dispose();
  actor.dispose();
  physics.dispose();
});

test('sword controller loads the grip-origin GLB and directly follows owned world-space input', async () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 390 / 702, 0.05, 100);
  camera.updateMatrixWorld(true);
  const viewport = { querySelector: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 702 }) };
  const equipment = { hasItem: (id) => id === 'dreadstone_sword', getEquippedWeaponProfile: () => ({ id: 'dreadstone_sword' }) };
  const source = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.9), new THREE.MeshStandardMaterial());
  source.add(mesh);
  const sword = new SwordWorldWeaponController({ app: viewport, scene, camera, equipmentRuntime: equipment, physics: null, contactActivationProvider: () => false, visualAssetLoader: async () => source, bindPointerInput: false });
  await sword.visualLoadPromise;
  assert.equal(sword.visualAssetState, 'loaded');
  assert.equal(sword.visual.children[0].position.length(), 0, 'the authored grip origin is used without a corrective mesh offset');
  assert.equal(sword.visual.children[0].children[0].layers.mask, 1 << SWORD_VIEWMODEL_LAYER);
  const before = sword.actualGrip.clone();
  assert.equal(sword.acquireGrip(4, 195, 560, 0), true);
  assert.equal(sword.applyGripGesture(4, 90, -30, 285, 530, 16), true);
  sword.beforePhysics(1 / 60);
  assert.ok(sword.actualGrip.distanceTo(before) > 0.05);
  assert.ok(sword.actualGrip.distanceTo(sword.desiredGrip) < 1e-9, 'free-space collision follows the desired hand with no smoothing delay');
  const cameraLocalPose = camera.worldToLocal(sword.actualGrip.clone());
  camera.position.set(5, 2, -4);
  camera.rotateY(0.8);
  camera.updateMatrixWorld(true);
  sword.beforePhysics(1 / 60);
  assert.ok(camera.worldToLocal(sword.actualGrip.clone()).distanceTo(cameraLocalPose) < 1e-6, 'camera rebasing preserves the owned sword pose without generating attack travel');
  assert.deepEqual(Object.keys(sword.primitives), ['leftEdge', 'rightEdge', 'flat', 'spine', 'guard', 'grip']);
  sword.afterPhysics();
  assert.ok(sword.visual.position.distanceTo(sword.actualGrip) < 1e-9);
  sword.dispose();
  assert.equal(scene.children.includes(sword.visual), false);
});

test('a deliberate lateral sword sweep is combat-silent in puncture-only mode', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const actor = new HumanoidCombatActor({ physics, scene, mortalityMode: COMBAT_MORTALITY_MODES.immortalReactive });
  const camera = new THREE.PerspectiveCamera(70, 390 / 702, 0.1, 100);
  camera.position.set(-0.02, 1.81, -2.3);
  camera.updateMatrixWorld(true);
  const viewport = { querySelector: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 702 }) };
  const equipment = { getEquippedWeaponProfile: () => ({ id: 'dreadstone_sword' }), hasItem: () => true };
  const sword = new SwordWorldWeaponController({ app: viewport, scene, camera, actor, physics, equipmentRuntime: equipment, bindPointerInput: false, contactActivationProvider: () => true, visualAssetLoader: async () => new THREE.Group() });
  sword.acquireGrip(42, 280, 470, 0);
  for (let step = 1; step <= 12; step += 1) {
    sword.applyGripGesture(42, -step * 4, 0, 280 - step * 4, 470, step * 16);
    physics.stepSingle((dt) => { sword.beforePhysics(dt); actor.beforePhysics(dt); }, (dt) => sword.afterPhysicsStep(dt));
  }
  sword.releaseGrip('test-complete');
  for (let step = 0; step < 18; step += 1) physics.stepSingle((dt) => { sword.beforePhysics(dt); actor.beforePhysics(dt); }, (dt) => sword.afterPhysicsStep(dt));
  const totalTrauma = [...actor.regionState.values()].reduce((sum, state) => sum + state.trauma, 0);
  assert.equal(sword.edgeDamageCount, 0);
  assert.equal(sword.lastContactPart, 'none');
  assert.equal(totalTrauma, 0);
  assert.equal(actor.woundSystem.wounds.length, 0);
  assert.ok(sword.suppressedNonTipContacts > 0);
  assert.equal(sword.combatDirector.eventLog.length, 0, 'lateral sword motion schedules no hidden presentation or Combat Director work');
  assert.equal(sword.combatDirector.queue.length, 0);
  sword.dispose();
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

test('knife edge sweeps the authored heel, midpoint, and tip with rotation-only adaptive density', () => {
  const heel = sampleKnifeCuttingEdgeLocal(0);
  const midpoint = sampleKnifeCuttingEdgeLocal(0.5);
  const tip = sampleKnifeCuttingEdgeLocal(1);
  assert.deepEqual(heel.toArray(), [-KNIFE_COMBAT_CONFIG.bladeWidth * 0.5, 0, -0.006]);
  assert.ok(midpoint.x < -KNIFE_COMBAT_CONFIG.bladeWidth * 0.4 && midpoint.z < -0.11 && midpoint.z > -0.14, 'midpoint follows the long straight cutting edge instead of an oversized blade-center hitbox');
  assert.deepEqual(tip.toArray(), [0, 0, -KNIFE_COMBAT_CONFIG.bladeLength]);
  assert.equal(KNIFE_EDGE_COLLISION_RADIUS, KNIFE_COMBAT_CONFIG.bladeThickness * 0.5);
  assert.ok(KNIFE_EDGE_COLLISION_RADIUS < KNIFE_COMBAT_CONFIG.tipRadius);
  const previousStart = new THREE.Vector3(0, 0, 0);
  const previousEnd = new THREE.Vector3(0, 0, -KNIFE_COMBAT_CONFIG.bladeLength);
  const translatedStart = new THREE.Vector3(0.2, 0, 0);
  const translatedEnd = new THREE.Vector3(0.2, 0, -KNIFE_COMBAT_CONFIG.bladeLength);
  assert.equal(resolveKnifeEdgeSampleCount(previousStart, previousEnd, translatedStart, translatedEnd), KNIFE_EDGE_BASE_SAMPLE_COUNT, 'translation alone stays at heel/midpoint/tip');
  const fastRotatedEnd = new THREE.Vector3(-KNIFE_COMBAT_CONFIG.bladeLength, 0, 0);
  assert.equal(resolveKnifeEdgeSampleCount(previousStart, previousEnd, previousStart, fastRotatedEnd), KNIFE_EDGE_MAX_SAMPLE_COUNT, 'fast rotation adds bounded samples rather than widening the collision radius');
});

test('knife edge sweep selects earliest contact and retains its sample anchor through a brief miss', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
  camera.updateMatrixWorld(true);
  const viewport = { querySelector: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 702 }) };
  const collider = { handle: 7, userData: { bodyId: 'abdomen' } };
  const castCalls = [];
  let preparedCount = 0;
  let castMode = 'earliest-midpoint';
  let routedPoint = new THREE.Vector3();
  const physics = {
    prepareWeaponSweepBatch() { preparedCount += 1; return true; },
    castWeaponTip(previous, current, radius, _predicate, positionsPrepared) {
      const sampleIndex = castCalls.length % KNIFE_EDGE_BASE_SAMPLE_COUNT;
      castCalls.push({ previous: previous.clone(), current: current.clone(), radius, positionsPrepared });
      if (castMode === 'miss') return null;
      const toi = castMode === 'equal' ? 0.2 : [0.7, 0.12, 0.45][sampleIndex];
      return { collider, time_of_impact: toi, witness1: { x: sampleIndex, y: 1, z: -3 }, normal1: { x: -1, y: 0, z: 0 } };
    },
  };
  const targetActor = {};
  const targetDirector = { beginSlash: () => ({ id: 'slash-edge-sweep' }), extendSlash: () => true, finishSlash: () => true, reportContact() {} };
  const semanticHit = { bodyId: 'abdomen', regionId: 'abdomen', region: { softTissueResistance: 0.4 }, body: { applyImpulseAtPoint() {}, translation: () => ({ x: 0, y: 1, z: -3 }) }, collider, localPoint: new THREE.Vector3() };
  const equipment = { getEquippedToolId: () => 'old_work_knife', hasItem: () => true };
  const knife = new WorldKnifeCombatController({ app: viewport, scene, camera, actor: null, physics, equipmentRuntime: equipment, bindPointerInput: false });
  knife.resolveCombatTarget = (_collider, point) => { routedPoint.copy(point); return { actor: targetActor, director: targetDirector, hit: semanticHit }; };
  knife.previousGrip.copy(knife.actualGrip).add(new THREE.Vector3(-0.02, 0, 0));
  knife.previousQuaternion.copy(knife.actualQuaternion);
  knife.previousEdgeStart.copy(knife.edgeStart).add(new THREE.Vector3(-0.02, 0, 0));
  knife.previousEdgeEnd.copy(knife.edgeEnd).add(new THREE.Vector3(-0.02, 0, 0));
  knife.offensiveVelocity.set(1, 0, 0);
  assert.equal(knife.resolveSweptEdgeContact(1 / 60), true);
  assert.equal(preparedCount, 1, 'the edge batch propagates colliders once');
  assert.equal(castCalls.length, KNIFE_EDGE_BASE_SAMPLE_COUNT);
  assert.ok(castCalls.every((call) => call.radius === KNIFE_EDGE_COLLISION_RADIUS && call.positionsPrepared));
  assert.equal(routedPoint.x, 1, 'the earliest midpoint contact wins even though heel was sampled first');
  assert.equal(knife.activeSlash.edgeAnchorT, 0.5);
  const activeSlash = knife.activeSlash;
  castMode = 'miss';
  assert.equal(knife.resolveSweptEdgeContact(1 / 60), false);
  assert.equal(knife.activeSlash, activeSlash);
  assert.equal(knife.activeSlash.edgeAnchorT, 0.5, 'a brief miss does not move or discard the contact anchor');
  castMode = 'equal';
  assert.equal(knife.resolveSweptEdgeContact(1 / 60), true);
  assert.equal(routedPoint.x, 1, 'equal-time contact resumes at the stable midpoint anchor');
  knife.dispose();
});

test('knife slash extensions batch tiny travel and flush the final attached endpoint', () => {
  const controller = Object.create(WorldKnifeCombatController.prototype);
  const extensions = [];
  const slash = {
    directorInteractionId: 'slash-test',
    director: { extendSlash: (interactionId, payload) => { extensions.push({ interactionId, ...payload }); return true; } },
    hit: { regionId: 'abdomen' },
    startPoint: new THREE.Vector3(),
    lastPoint: new THREE.Vector3(),
    surfaceNormal: new THREE.Vector3(0, 0, 1),
    direction: new THREE.Vector3(1, 0, 0),
    lastCommittedDirection: new THREE.Vector3(1, 0, 0),
    pendingTravel: 0,
    pendingDepth: 0,
    pendingSeverity: 0,
    pendingDamageSeverity: 0,
    pendingDepthWeightedSeverity: 0,
    pendingEdgeAlignment: 0,
    pendingClassification: null,
    lastCommittedClassification: 'shallow_cut',
    extensionCommitCount: 0,
  };
  const sample = { depth: 0.02, severity: 0.3, classification: 'shallow_cut', edgeAlignment: 0.8 };
  controller.accumulateSlashExtension(slash, { ...sample, addedTravel: 0.003 });
  controller.accumulateSlashExtension(slash, { ...sample, addedTravel: 0.003 });
  controller.accumulateSlashExtension(slash, { ...sample, addedTravel: 0.003 });
  assert.equal(extensions.length, 0, 'sub-centimeter physics samples do not schedule redundant wound rebuilds');
  controller.accumulateSlashExtension(slash, { ...sample, addedTravel: 0.002 });
  assert.equal(extensions.length, 1);
  assert.ok(Math.abs(extensions[0].cutLength - 0.011) < 1e-9, 'the committed extension retains all accumulated physical travel');
  assert.ok(Math.abs(extensions[0].damageSeverity - 1.2) < 1e-9, 'batched presentation work retains every sample contribution to slash trauma');
  assert.ok(Math.abs(extensions[0].depthWeightedSeverity - 0.024) < 1e-9);
  controller.accumulateSlashExtension(slash, { ...sample, addedTravel: 0.003 });
  assert.equal(extensions.length, 1);
  controller.commitSlashExtension(slash, true);
  assert.equal(extensions.length, 2, 'contact completion flushes the residual endpoint so the slash shape stays attached');
  assert.equal(extensions[1].cutLength, 0.003);
  assert.equal(slash.extensionCommitCount, 2);
  assert.ok(SLASH_CONFIG.extensionCommitDistance >= 0.008 && SLASH_CONFIG.extensionCommitDistance <= 0.012);
});

test('knife slash ownership survives misses shorter than the release window', () => {
  const controller = Object.create(WorldKnifeCombatController.prototype);
  const slash = { missedTime: 0 };
  controller.activeSlash = slash;
  let finished = false;
  controller.finishActiveSlash = () => { finished = true; controller.activeSlash = null; };
  for (let frame = 0; frame < 6; frame += 1) controller.releaseSlashContact(1 / 60, false);
  assert.equal(finished, false);
  assert.equal(controller.activeSlash, slash);
  slash.missedTime = 0;
  controller.releaseSlashContact(1 / 60, false);
  assert.equal(controller.activeSlash, slash, 'a resumed same-owner contact can reset hysteresis without starting another slash');
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
  const extensionLocal = hit.localPoint.clone().add(new THREE.Vector3(0.16, 0.03, 0));
  const bodyTranslation = hit.body.translation();
  const bodyRotation = hit.body.rotation();
  const extensionWorld = extensionLocal.clone()
    .applyQuaternion(new THREE.Quaternion(bodyRotation.x, bodyRotation.y, bodyRotation.z, bodyRotation.w))
    .add(new THREE.Vector3(bodyTranslation.x, bodyTranslation.y, bodyTranslation.z));
  actor.applySlashWound({ hit: { ...hit, localPoint: extensionLocal }, startPoint: deepPoint, endPoint: extensionWorld, surfaceNormal: new THREE.Vector3(0, 0, 1), cutDirection: new THREE.Vector3(1, 0, 0), depth: 0.065, cutLength: 0.05, severity: 0.9, classification: 'deep_slash', woundId: slash.id });
  assert.ok(slash.localCutEnd.distanceTo(extensionLocal) < 1e-9, 'slash extensions store the current semantic local hit without applying world travel twice');
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

test('Folsom keeps one stationary Dreadguard and routes all three walkers independently', async () => {
  const scene = new THREE.Scene();
  const dungeon = { scene, collision: { sampleWalkableY: () => ({ y: 0.16 }), canStandAtFloorPosition: () => true, getIntersectingBlockers: () => [] } };
  const encounter = await FolsomCombatEncounter.create({ dungeon });
  const pelvis = encounter.actor.getBodyWorldPosition('pelvis');
  const playerSpawn = new THREE.Vector3(-2, 1.71, -4);
  assert.equal(Math.hypot(encounter.spawnPosition.x - playerSpawn.x, encounter.spawnPosition.z - playerSpawn.z), 10);
  assert.equal(encounter.actor.visualProfile, DREADGUARD_DAMAGE_COMBAT_PROFILE);
  assert.ok(scene.getObjectByName('folsom-dreadguard-stationary-1'));
  assert.equal(scene.children.filter((child) => child.name.startsWith('folsom-dreadguard-stationary-')).length, 1);
  assert.equal(scene.children.some((child) => child.name.toLowerCase().includes('testman')), false);
  assert.ok(pelvis.x > 7 && pelvis.z < -3);
  assert.ok(encounter.walkerController.actor);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 4);
  assert.equal(encounter.getActiveCombatActors().length, 4);
  assert.equal(encounter.physics.world.bodies.len(), 73);
  encounter.reset();
  assert.equal(encounter.physics.world.bodies.len(), 73);
  assert.equal(encounter.combatRouter.getDiagnostics().actorCount, 4);
  assert.equal(scene.children.filter((child) => child.name.startsWith('folsom-dreadguard-stationary-')).length, 1);
  encounter.dispose();
  assert.equal(scene.children.some((child) => child.name.startsWith('folsom-dreadguard-stationary-')), false);
  assert.equal(scene.children.some((child) => child.name.startsWith('folsom-authored-walker-')), false);
});

test('loaded Dreadguard damage bundle preserves world scale and the no-animation baseline contract', async () => {
  globalThis.self ??= globalThis;
  globalThis.ProgressEvent ??= class ProgressEvent { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });
  const bytes = readFileSync(new URL('../public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb', import.meta.url));
  const assetBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(assetBuffer, new URL('../public/assets/enemies/dreadguard/damage/', import.meta.url).href);
  const manifest = JSON.parse(readFileSync(new URL('../public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.json', import.meta.url), 'utf8'));
  const root = gltf.scene;
  root.traverse((object) => {
    if (object.userData?.dsb_default_visible === false || object.userData?.dsb_gore_default_visible === false || object.name?.startsWith('DSB_GORE_')) object.visible = false;
  });
  root.updateMatrixWorld(true);
  const rawHeight = measureVisibleSkinnedBounds(root).getSize(new THREE.Vector3()).y;
  const uniformScale = getHumanoidProfileScale(DREADGUARD_DAMAGE_COMBAT_PROFILE);
  assert.ok(Math.abs(rawHeight - DREADGUARD_DAMAGE_COMBAT_PROFILE.rawHeight) < 1e-6);
  assert.ok(uniformScale > 1.024 && uniformScale < 1.025);
  root.scale.setScalar(uniformScale);
  const scaled = measureVisibleSkinnedBounds(root);
  root.position.y = DREADGUARD_DAMAGE_COMBAT_PROFILE.groundClearance - scaled.min.y;
  const normalized = measureVisibleSkinnedBounds(root);
  assert.ok(Math.abs(normalized.getSize(new THREE.Vector3()).y - 1.5) < 1e-6);
  assert.deepEqual(root.scale.toArray(), [uniformScale, uniformScale, uniformScale]);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.animationAuthoritative, false);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.restPoseAuthoritative, true);
  assert.equal(isHumanoidPoseAuthoritative(DREADGUARD_DAMAGE_COMBAT_PROFILE), true);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.authoredDeathAnimations, false);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.noAnimationFallback, 'exported_rest_pose');
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.animationManifestPath, undefined);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.ignoreEmbeddedAnimations, true);
  assert.equal(gltf.animations.length, 1, 'the bundle clip is present but intentionally not registered as an authored animation pack');
  assert.deepEqual(DREADGUARD_DAMAGE_COMBAT_PROFILE.damageExpectedAnimationNames, []);
  assert.notEqual(CURRENT_HUMANOID_PROFILE.assetPath, DREADGUARD_DAMAGE_COMBAT_PROFILE.assetPath);
  assert.notEqual(CURRENT_HUMANOID_PROFILE.boneMap, DREADGUARD_DAMAGE_COMBAT_PROFILE.boneMap);
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.assetPath, './assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb');
  assert.equal(DREADGUARD_DAMAGE_COMBAT_PROFILE.damageManifestPath, './assets/enemies/dreadguard/damage/dreadguard_damage_v001.json');
  assert.equal(manifest.glb, 'dreadguard_damage_v001.glb');
  const site = manifest.deformations.progressiveDamageSites[0];
  assert.deepEqual(site.stageOrder, ['LIGHT', 'MEDIUM', 'HEAVY']);
  assert.deepEqual(site.stages.map(({ deformationKeyName }) => deformationKeyName), ['Left_Head_Impact_v003', 'Left_Head_Impact_v002', 'Left_Head_Impact_v001']);
});

test('authored wound materials preserve authored color and remain lighting-responsive', async () => {
  const { actor, physics } = await createActor();
  assert.equal(actor.woundSystem.decalLibrary.materialsById.size, 13);
  actor.woundSystem.decalLibrary.materialsById.forEach((material, variantId) => {
    assert.equal(material.color.getHex(), 0xffffff, `${variantId} is not multiplied by a destructive red tint`);
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
  const knifeBytes = readFileSync(new URL('../public/assets/weapons/melee/old_work_knife_v004.glb', import.meta.url));
  const knifeBuffer = knifeBytes.buffer.slice(knifeBytes.byteOffset, knifeBytes.byteOffset + knifeBytes.byteLength);
  const knifeGltf = await new GLTFLoader().parseAsync(knifeBuffer, new URL('../public/assets/weapons/melee/', import.meta.url).href);
  let contactRange = false;
  const knife = new WorldKnifeCombatController({ app: viewport, scene, camera, actor, physics, equipmentRuntime: equipment, bindPointerInput: false, contactActivationProvider: () => contactRange, visualAssetLoader: async () => knifeGltf.scene });
  await knife.visualLoadPromise;
  assert.equal(knife.visualAssetState, 'loaded');
  const knifeMeshes = [];
  knife.visual.traverse((object) => { if (object.isMesh) knifeMeshes.push(object); });
  assert.ok(knifeMeshes.length > 0);
  assert.ok(knifeMeshes.every((mesh) => mesh.layers.mask === 1 << COMBAT_KNIFE_VIEWMODEL_LAYER), 'the free knife uses the stable depth-cleared viewmodel pass');
  assert.ok(knifeMeshes.every((mesh) => mesh.castShadow === false && mesh.receiveShadow === false && mesh.frustumCulled === false), 'camera motion cannot introduce world-shadow shimmer or near-frustum flicker');
  assert.ok(knife.materials.every((material) => material.depthTest === true && material.depthWrite === true), 'knife materials retain normal depth behavior');
  assert.ok(knifeMeshes.every((mesh) => mesh.renderOrder === 10030));
  knife.afterPhysics();
  const identity = knife.visual.id;
  const scale = knife.visual.scale.clone();
  const ready = knife.actualGrip.clone();
  const readyLocal = camera.worldToLocal(ready.clone());
  assert.deepEqual(readyLocal.toArray().map((value) => Number(value.toFixed(6))), KNIFE_COMBAT_CONFIG.workspace.ready, 'knife ready anchor uses the lower-right camera-local position');
  assert.ok(readyLocal.x >= 0.095 && readyLocal.y <= -0.215, 'knife is visibly anchored lower and farther right');
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
  assert.equal(knife.visualDepthMode, 'world-occluded');
  assert.ok(knifeMeshes.every((mesh) => mesh.layers.mask === 1 << COMBAT_KNIFE_WORLD_LAYER), 'an implanted knife returns to world depth so the body occludes the buried blade');
  assert.ok(knifeMeshes.every((mesh) => mesh.renderOrder === 0));
  knife.afterPhysicsStep(1 / 60);
  knife.afterPhysicsStep(1 / 60);
  const embeddedWounds = actor.woundSystem.wounds.length;
  const plantedDepth = knife.penetrationDepth;
  knife.releaseGrip('embedded-test-release');
  assert.equal(knife.state, KNIFE_CONTROL_STATES.embedded);
  for (let index = 0; index < 30; index += 1) knife.beforePhysics(1 / 60);
  assert.ok(knife.entry, 'releasing the grip leaves the knife planted in the enemy');
  assert.ok(Math.abs(knife.penetrationDepth - plantedDepth) < 1e-8, 'an unattended planted knife keeps its penetration depth');
  const plantedEntryBeforeAnimation = knife.getEntryWorldPose().point.clone();
  const animatedBody = embeddedHit.hit.body;
  const animatedBodyPosition = animatedBody.translation();
  animatedBody.setTranslation({ x: animatedBodyPosition.x + 0.08, y: animatedBodyPosition.y + 0.04, z: animatedBodyPosition.z - 0.03 }, true);
  animatedBody.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.18), true);
  knife.beforePhysics(1 / 60);
  const plantedEntryAfterAnimation = knife.getEntryWorldPose();
  assert.ok(plantedEntryAfterAnimation.point.distanceTo(plantedEntryBeforeAnimation) > 0.05, 'the planted anchor follows the authored animated proxy body');
  assert.ok(knife.currentTip.distanceTo(plantedEntryAfterAnimation.point.clone().addScaledVector(plantedEntryAfterAnimation.axis, knife.penetrationDepth)) < 1e-8, 'the buried tip remains constrained to the animated entry axis');
  knife.afterPhysics();
  assert.ok(knife.visibleCollisionError < 1e-8, 'embedded presentation stays exactly on its animated collision anchor');
  knife.state = KNIFE_CONTROL_STATES.withdrawing;
  for (let index = 0; index < 30 && knife.entry; index += 1) knife.beforePhysics(1 / 60);
  assert.equal(knife.entry, null, 'an explicit withdrawal still extracts the blade');
  assert.ok([KNIFE_CONTROL_STATES.returning, KNIFE_CONTROL_STATES.ready].includes(knife.state));
  assert.equal(knife.visualDepthMode, 'viewmodel');
  assert.ok(knifeMeshes.every((mesh) => mesh.layers.mask === 1 << COMBAT_KNIFE_VIEWMODEL_LAYER));
  assert.equal(actor.woundSystem.wounds.length, embeddedWounds, 'withdrawal cannot create another wound');
  for (let index = 0; index < 15; index += 1) knife.beforePhysics(1 / 60);
  knife.cancel('pointer-cancel-test');
  assert.equal(knife.gripPointerId, null);
  const preResumeLocal = camera.worldToLocal(knife.actualGrip.clone());
  camera.position.addScalar(20);
  camera.updateMatrixWorld(true);
  knife.beforePhysics(1 / 60);
  assert.ok(camera.worldToLocal(knife.actualGrip.clone()).distanceTo(preResumeLocal) <= KNIFE_COMBAT_CONFIG.maximumVelocity / 60 + 1e-6, 'resume/teleport-style camera correction safely rebases pose history without world-space catch-up');
  const disposedGeometries = new Set();
  const disposedMaterials = new Set();
  knife.visualGeometries.forEach((geometry) => geometry.addEventListener('dispose', () => disposedGeometries.add(geometry)));
  knife.materials.forEach((material) => material.addEventListener('dispose', () => disposedMaterials.add(material)));
  const ownedGeometryCount = knife.visualGeometries.length;
  const ownedMaterialCount = knife.materials.length;
  knife.dispose();
  assert.equal(disposedGeometries.size, ownedGeometryCount, 'every cloned GLB geometry is disposed with the knife controller');
  assert.equal(disposedMaterials.size, ownedMaterialCount, 'every cloned GLB material is disposed with the knife controller');
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

test('a grip-owned deliberate lateral knife sweep is combat-silent in puncture-only mode', async () => {
  await initializeCombatPhysics();
  const physics = new CombatPhysicsWorld();
  const scene = new THREE.Scene();
  const actor = new HumanoidCombatActor({ physics, scene, mortalityMode: COMBAT_MORTALITY_MODES.immortalReactive });
  const camera = new THREE.PerspectiveCamera(70, 390 / 702, 0.1, 100);
  camera.position.set(-0.02, 1.81, -2.77);
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
  assert.equal(knife.activeSlash, null);
  assert.equal(knife.slashCount, 0);
  assert.equal(actor.woundSystem.wounds.length, 0);
  assert.ok(knife.suppressedSlashAttempts > 0);
  assert.equal(knife.attackEnabled, false);
  assert.equal(knife.combatDirector.eventLog.length, 0, 'lateral knife motion schedules no hidden presentation or Combat Director work');
  assert.equal(knife.combatDirector.queue.length, 0);
  assert.equal(knife.getDiagnostics().runtimeCombatMode, 'puncture_only');
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
