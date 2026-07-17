import * as THREE from 'three';
import { MELEE_INTENTS } from '../MeleeIntentWeapon.js';
import { CombatDirector } from '../CombatDirector.js';
import { createWeaponContactScratch, getRigidBodyWorldPosition } from './WeaponContactScratch.js';
import { WeaponContactRouter } from './WeaponContactRouter.js';
import { bindWeaponPointerEvents, DEFAULT_WEAPON_POINTER_BLOCK_SELECTOR, WeaponGestureOwnership } from './WeaponGestureOwnership.js';
import { createWeaponPoseWorkspace, initializeCameraRelativeWeaponPose, rebaseWorldWeaponPoseToCamera } from './WeaponPoseWorkspace.js';
import { applyWeaponRenderLayer, cloneOwnedWeaponVisual, createCachedWeaponGlbLoader, disposeOwnedWeaponVisual, getWeaponRenderLayer, getWeaponWorldLightIntersectionStatus } from './WeaponVisualAsset.js';
import { WEAPON_VIEWMODEL_LAYER } from './WeaponRenderLayers.js';
import { BLUNT_IMPACT_CLASSIFICATIONS, createBluntImpactInteraction, estimateBluntImpactMetrics } from './BluntImpactInteraction.js';
import { WeaponPresentationRuntime } from './WeaponViewmodelAnchor.js';

export const DREADMACE_GLB_PATH = './assets/weapons/melee/dreadmacev001_mobile_1k.glb';
export const MACE_VIEWMODEL_LAYER = WEAPON_VIEWMODEL_LAYER;
export const DREADMACE_MAX_SWEEP_SAMPLE_COUNT = 12;

// Measured from the approved GLB after GLTFLoader's Blender (+Y up-axis) to
// glTF (Y-up) basis conversion. The imported head points along runtime -Z.
export const DREADMACE_DIMENSIONS = Object.freeze({
  authoredBlenderDimensions: Object.freeze([0.236, 0.699, 0.194]),
  boundsMin: Object.freeze([-0.115588591, -0.155819446, -0.482144892]),
  boundsMax: Object.freeze([0.12024349, 0.038429633, 0.216372088]),
  measuredSize: Object.freeze([0.23583208, 0.194249079, 0.69851698]),
  gripOrigin: Object.freeze([0, 0, 0]),
  runtimeActiveDirection: Object.freeze([0, 0, -1]),
  headCenter: Object.freeze([0.0023, -0.0587, -0.31]),
  overallLength: 0.69851698,
});

// This is the single load-time asset correction. GLTFLoader has already
// converted authored +Y into runtime -Z, so applying an additional quarter
// turn would be incorrect. The explicit identity correction locks that fact,
// preserves the grip-centered origin, and prevents per-frame asset rotations.
export const DREADMACE_ASSET_CORRECTION = Object.freeze({
  position: Object.freeze([0, 0, 0]),
  quaternion: Object.freeze([0, 0, 0, 1]),
  authoredActiveAxis: '+Y',
  importedActiveAxis: '-Z',
  runtimeActiveAxis: '-Z',
  appliedOnceAtLoad: true,
});

export const DREADMACE_CONTACT_PRIMITIVES = Object.freeze({
  mace_head: Object.freeze({ kind: 'sphere', center: DREADMACE_DIMENSIONS.headCenter, radius: 0.11, effectiveMass: 5.4, traumaMultiplier: 1, impactRadiusEstimate: 0.11 }),
  haft: Object.freeze({ kind: 'capsule', points: Object.freeze([Object.freeze([0, -0.02, -0.18]), Object.freeze([0, -0.012, -0.035])]), radius: 0.029, effectiveMass: 2.2, traumaMultiplier: 0.18, impactRadiusEstimate: 0.032 }),
  grip: Object.freeze({ kind: 'capsule', points: Object.freeze([Object.freeze([0, -0.008, -0.035]), Object.freeze([0, -0.006, 0.11])]), radius: 0.028, effectiveMass: 0, traumaMultiplier: 0, impactRadiusEstimate: 0.028 }),
  pommel: Object.freeze({ kind: 'sphere', center: Object.freeze([0, -0.012, 0.164]), radius: 0.044, effectiveMass: 1.4, traumaMultiplier: 0.38, impactRadiusEstimate: 0.044 }),
});

export const MACE_GESTURE_STATES = Object.freeze({
  ready: 'ready',
  held: 'held',
  loading: 'loading',
  striking: 'striking',
  impactResistance: 'impact_resistance',
  returning: 'returning',
});

export const MACE_HAMMER_PHASES = Object.freeze({
  resting: 'resting',
  raising: 'raising',
  cocked: 'cocked',
  descending: 'descending',
  recovering: 'recovering',
});

export const DREADMACE_GESTURE_THRESHOLDS = Object.freeze({
  loadStartTravel: 0.10,
  fullLoadTravel: 0.42,
  minimumUpwardSpeed: 0.22,
  strongUpwardSpeed: 0.9,
  loadMemorySeconds: 0.6,
  minimumRecentLoadEnergy: 0.46,
  minimumDownwardPhaseSpeed: 0.28,
  minimumDownwardHeadSpeed: 0.65,
  minimumTotalHeadSpeed: 0.82,
  minimumDownwardStrikeTravel: 0.12,
  minimumContactNormalSpeed: 0.52,
  minimumContactNormalAlignment: 0.34,
  safeResetHeadSpeed: 0.18,
  meaningfulRearmRaiseTravel: 0.10,
  safeResetRearmRaiseTravel: 0.08,
});

export const DREADMACE_WORLD_WEAPON_CONFIG = Object.freeze({
  itemId: 'dreadstone_mace',
  gripZone: Object.freeze({
    minimumRadiusPx: 50,
    maximumRadiusPx: 90,
    viewportRatio: 0.105,
    localSegmentStart: Object.freeze([0, -0.006, 0.14]),
    localSegmentEnd: Object.freeze([0, -0.014, -0.12]),
  }),
  workspace: Object.freeze({
    ready: Object.freeze([0.18, -0.30, -0.58]),
    min: Object.freeze([-0.30, -0.46, -0.92]),
    max: Object.freeze([0.42, 0.28, -0.38]),
    lateralSensitivity: 1 / 260,
    verticalSensitivity: 1 / 300,
    thrustSensitivity: 1 / 900,
    lateralReach: 0.50,
    verticalReach: 0.60,
    thrustDistance: 0.40,
  }),
  directRotation: Object.freeze({ yaw: -0.28, roll: -0.22 }),
  hammerOrientation: Object.freeze({
    restPitch: 0.42,
    fullRaiseGripTravel: 0.28,
    topPitch: 1.92,
    maximumTopPitch: 2.08,
    maximumSpeedOvershoot: 0.16,
    overshootSpeedStart: 0.55,
    overshootSpeedFull: 1.10,
    fullDownstrokeGripTravel: 0.26,
    impactPitch: -0.28,
    motionSpeedThreshold: 0.025,
    cockedProgressThreshold: 0.70,
    maximumTrackedGripSpeed: 20,
  }),
  impactResistanceDuration: Object.freeze({ minimum: 0.06, maximum: 0.13 }),
  maximumTargetsPerStrike: 2,
  returnDuration: 0.31,
});

const MACE_RENDER_ORDER = 10027;
const EPSILON = 1e-6;
const identityQuaternion = new THREE.Quaternion();
const readyGrip = new THREE.Vector3().fromArray(DREADMACE_WORLD_WEAPON_CONFIG.workspace.ready);
export const DREADMACE_READY_QUATERNION = Object.freeze(new THREE.Quaternion()
  .setFromEuler(new THREE.Euler(DREADMACE_WORLD_WEAPON_CONFIG.hammerOrientation.restPitch, 0, 0, 'YXZ'))
  .toArray());
const readyQuaternion = new THREE.Quaternion().fromArray(DREADMACE_READY_QUATERNION);
const heldFreeEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const heldFreeRotation = new THREE.Quaternion();
const loadDreadmaceAsset = createCachedWeaponGlbLoader(DREADMACE_GLB_PATH, 'Dreadmace');

function smoothstep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function samplePrimitiveLocalPoints(primitive) {
  if (primitive.kind === 'sphere') return [primitive.center];
  const [start, end] = primitive.points;
  return [start, [
    (start[0] + end[0]) * 0.5,
    (start[1] + end[1]) * 0.5,
    (start[2] + end[2]) * 0.5,
  ], end];
}

const primitiveLocalPoints = Object.freeze(Object.fromEntries(
  Object.entries(DREADMACE_CONTACT_PRIMITIVES).map(([name, primitive]) => [name, Object.freeze(samplePrimitiveLocalPoints(primitive).map((point) => Object.freeze([...point])))])
));
const primitiveLeverArms = Object.freeze(Object.fromEntries(
  Object.entries(primitiveLocalPoints).map(([name, points]) => [name, Math.max(...points.map((point) => Math.hypot(...point)))])
));

export function applyDreadmaceAssetCorrection(root) {
  if (!root || root.userData?.dreadmaceAssetCorrectionApplied) return root;
  root.position.fromArray(DREADMACE_ASSET_CORRECTION.position);
  root.quaternion.fromArray(DREADMACE_ASSET_CORRECTION.quaternion).normalize();
  root.scale.set(1, 1, 1);
  root.userData.dreadmaceAssetCorrectionApplied = true;
  root.userData.dreadmaceAssetCorrection = DREADMACE_ASSET_CORRECTION;
  root.updateMatrixWorld(true);
  return root;
}

export function resolveDreadmaceSweepSampleCount({ translationDistance = 0, angularDistance = 0, leverArm = 0, radius = DREADMACE_CONTACT_PRIMITIVES.mace_head.radius } = {}) {
  const sweptDistance = Math.max(0, Number(translationDistance) || 0) + Math.max(0, Number(angularDistance) || 0) * Math.max(0, Number(leverArm) || 0);
  const spacing = Math.max(0.018, Math.max(EPSILON, Number(radius) || 0) * 0.55);
  return THREE.MathUtils.clamp(Math.max(2, Math.ceil(sweptDistance / spacing)), 2, DREADMACE_MAX_SWEEP_SAMPLE_COUNT);
}

export function computeDreadmaceGesturePower({ loadProgress = 0, downwardSpeed = 0, downwardTravel = 0, effectiveMass = DREADMACE_CONTACT_PRIMITIVES.mace_head.effectiveMass } = {}) {
  const load = THREE.MathUtils.clamp(loadProgress, 0, 1);
  const speed = THREE.MathUtils.clamp(downwardSpeed / 1.4, 0, 1);
  const travel = THREE.MathUtils.clamp(downwardTravel / DREADMACE_GESTURE_THRESHOLDS.minimumDownwardStrikeTravel, 0, 1);
  const mass = THREE.MathUtils.clamp(effectiveMass / DREADMACE_CONTACT_PRIMITIVES.mace_head.effectiveMass, 0, 1);
  return THREE.MathUtils.clamp(load * 0.5 + speed * 0.3 + travel * 0.15 + mass * 0.05, 0, 1);
}

export function sampleDreadmaceDirectPose({ baselineGrip = readyGrip, baselineQuaternion = readyQuaternion, baselineHammerPitch = DREADMACE_WORLD_WEAPON_CONFIG.hammerOrientation.restPitch, hammerPitch = DREADMACE_WORLD_WEAPON_CONFIG.hammerOrientation.restPitch, aimX = 0, aimY = 0, extension = 0 } = {}, grip = new THREE.Vector3(), quaternion = new THREE.Quaternion()) {
  const boundedAimX = THREE.MathUtils.clamp(aimX, -1, 1);
  const boundedAimY = THREE.MathUtils.clamp(aimY, -1, 1);
  grip.copy(baselineGrip);
  grip.x += boundedAimX * DREADMACE_WORLD_WEAPON_CONFIG.workspace.lateralReach;
  grip.y += boundedAimY * DREADMACE_WORLD_WEAPON_CONFIG.workspace.verticalReach;
  grip.z -= THREE.MathUtils.clamp(extension, 0, DREADMACE_WORLD_WEAPON_CONFIG.workspace.thrustDistance);
  grip.x = THREE.MathUtils.clamp(grip.x, DREADMACE_WORLD_WEAPON_CONFIG.workspace.min[0], DREADMACE_WORLD_WEAPON_CONFIG.workspace.max[0]);
  grip.y = THREE.MathUtils.clamp(grip.y, DREADMACE_WORLD_WEAPON_CONFIG.workspace.min[1], DREADMACE_WORLD_WEAPON_CONFIG.workspace.max[1]);
  grip.z = THREE.MathUtils.clamp(grip.z, DREADMACE_WORLD_WEAPON_CONFIG.workspace.min[2], DREADMACE_WORLD_WEAPON_CONFIG.workspace.max[2]);
  heldFreeRotation.setFromEuler(heldFreeEuler.set(
    hammerPitch - baselineHammerPitch,
    boundedAimX * DREADMACE_WORLD_WEAPON_CONFIG.directRotation.yaw,
    boundedAimX * DREADMACE_WORLD_WEAPON_CONFIG.directRotation.roll,
    'YXZ',
  ));
  quaternion.copy(baselineQuaternion).multiply(heldFreeRotation).normalize();
  return { grip, quaternion };
}

export function criticallyDampedMaceReturnProgress(elapsed, duration) {
  const normalized = THREE.MathUtils.clamp(elapsed / Math.max(EPSILON, duration), 0, 1);
  const x = normalized * 7;
  const raw = 1 - Math.exp(-x) * (1 + x);
  const end = 1 - Math.exp(-7) * 8;
  return normalized >= 1 ? 1 : raw / end;
}

export class MaceWorldWeaponController {
  constructor({ app, scene, camera, viewmodelAnchor = null, player, actor, physics, equipmentRuntime, controls, feedback = null, feedbackSystem = null, combatDirector = null, combatRouter = null, contactActivationProvider = null, outdoorLightingDirector = null, visualAssetLoader = loadDreadmaceAsset, bindPointerInput = true } = {}) {
    this.app = app;
    this.viewport = app?.querySelector?.('[data-game="viewport"]') ?? app;
    this.scene = scene;
    this.camera = camera;
    this.viewmodelAnchor = viewmodelAnchor;
    this.player = player;
    this.actor = actor;
    this.physics = physics;
    this.equipmentRuntime = equipmentRuntime;
    this.controls = controls;
    this.feedback = feedback;
    this.feedbackSystem = feedbackSystem;
    this.combatDirector = combatDirector ?? new CombatDirector({ actor, feedbackSystem, cameraFeedback: feedback });
    this.ownsCombatDirector = combatDirector == null;
    this.weaponContactRouter = new WeaponContactRouter({ combatRouter, fallbackActor: actor, fallbackDirector: this.combatDirector, cameraFeedback: feedback });
    this.contactActivationProvider = contactActivationProvider;
    this.outdoorLightingDirector = outdoorLightingDirector;
    this.visualAssetLoader = visualAssetLoader;
    this.config = DREADMACE_WORLD_WEAPON_CONFIG;
    this.weaponDefinition = Object.freeze({ id: this.config.itemId, family: 'mace', effectiveMass: DREADMACE_CONTACT_PRIMITIVES.mace_head.effectiveMass, authoredDimensions: DREADMACE_DIMENSIONS });
    this.gestureOwnership = new WeaponGestureOwnership(this.config.workspace);
    Object.defineProperty(this, 'gripPointerId', { configurable: true, get: () => this.gestureOwnership.pointerId, set: (value) => { this.gestureOwnership.pointerId = value; } });
    this.poseWorkspace = createWeaponPoseWorkspace();
    this.contactScratch = createWeaponContactScratch();
    this.localGrip = new THREE.Vector3().fromArray(this.config.workspace.ready);
    this.localQuaternion = readyQuaternion.clone();
    this.targetLocalGrip = this.localGrip.clone();
    this.targetLocalQuaternion = this.localQuaternion.clone();
    this.gestureBaselineGrip = this.localGrip.clone();
    this.gestureBaselineQuaternion = this.localQuaternion.clone();
    this.freeAimX = 0;
    this.freeAimY = 0;
    this.freeExtension = 0;
    this.desiredGrip = new THREE.Vector3();
    this.actualGrip = new THREE.Vector3();
    this.previousGrip = new THREE.Vector3();
    this.desiredQuaternion = new THREE.Quaternion();
    this.actualQuaternion = new THREE.Quaternion();
    this.previousQuaternion = new THREE.Quaternion();
    this.currentHeadCenter = new THREE.Vector3();
    this.previousHeadCenter = new THREE.Vector3();
    this.headCenterVelocity = new THREE.Vector3();
    this.displayedGrip = new THREE.Vector3();
    this.displayedQuaternion = new THREE.Quaternion();
    this.displayedHeadCenter = new THREE.Vector3();
    this.positionTrackingError = 0;
    this.rotationTrackingErrorDegrees = 0;
    this.visualPhysicalHeadError = 0;
    this.hammerPhase = MACE_HAMMER_PHASES.resting;
    this.hammerRaiseProgress = 0;
    this.hammerDownstrokeProgress = 0;
    this.hammerPitch = this.config.hammerOrientation.restPitch;
    this.hammerPitchTarget = this.hammerPitch;
    this.hammerPeakPitch = this.hammerPitch;
    this.hammerRaiseStartPitch = this.hammerPitch;
    this.hammerDownstrokeStartPitch = this.hammerPitch;
    this.hammerGestureBaselinePitch = this.hammerPitch;
    this.hammerRaiseStartGripY = this.localGrip.y;
    this.hammerPeakGripY = this.localGrip.y;
    this.hammerDownstrokeStartGripY = this.localGrip.y;
    this.hammerPreviousAuthoredGripY = this.localGrip.y;
    this.hammerRaiseTravel = 0;
    this.hammerDownstrokeTravel = 0;
    this.hammerUpwardGripSpeed = 0;
    this.hammerDownwardGripSpeed = 0;
    this.gripVelocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.localHeadOffset = new THREE.Vector3().fromArray(DREADMACE_DIMENSIONS.headCenter);
    this.state = MACE_GESTURE_STATES.ready;
    this.elapsed = 0;
    this.lastPhysicsDt = 1 / 60;
    this.accumulatedUpwardTravel = 0;
    this.accumulatedDownwardTravel = 0;
    this.rearmUpwardTravel = 0;
    this.upwardHeadSpeed = 0;
    this.downwardHeadSpeed = 0;
    this.loadEnergy = 0;
    this.loadEnergyAge = 0;
    this.lastQualifiedUpwardAt = null;
    this.loadProgress = 0;
    this.maximumLoadProgress = 0;
    this.loadCompletedAt = null;
    this.strikeSerial = 0;
    this.activeStrikeId = null;
    this.strikeOwnerId = null;
    this.strikeLoadEnergy = 0;
    this.strikeQualified = false;
    this.strikeSawSafeReset = false;
    this.swingPower = 0;
    this.swingCommitCount = 0;
    this.resolvedActors = new Set();
    this.activeBluntInteractions = new Map();
    this.resolvedActorId = null;
    this.returnElapsed = 0;
    this.returnStartGrip = new THREE.Vector3();
    this.returnStartQuaternion = new THREE.Quaternion();
    this.returnStartHammerPitch = this.hammerPitch;
    this.resistanceElapsed = 0;
    this.resistanceDuration = 0;
    this.resistancePositionOffset = new THREE.Vector3();
    this.resistanceRotationOffset = new THREE.Quaternion();
    this.impactEnergy = 0;
    this.impactResistance = 1;
    this.impactResponseStrength = 0;
    this.lastContactPrimitive = null;
    this.lastContactClassification = null;
    this.lastNormalImpactSpeed = 0;
    this.lastEffectiveMass = 0;
    this.lastEstimatedImpulse = 0;
    this.lastEstimatedEnergy = 0;
    this.lastImpactPoint = null;
    this.lastImpactRegion = null;
    this.lastBluntImpactRecord = null;
    this.feedbackCount = 0;
    this.rejectedRepeatContactCount = 0;
    this.lastSweepSampleCount = 0;
    this.maximumObservedSweepSampleCount = 0;
    this.lastStateTransition = 'initialized->ready';
    this.lastTransitionPositionJump = 0;
    this.lastTransitionRotationJumpDegrees = 0;
    this.lastGrabDistanceToHandle = null;
    this.lastGrabAccepted = false;
    this.outdoorMaterialRegistration = { status: outdoorLightingDirector ? 'pending' : 'unavailable', registered: false, eligibleMaterialCount: 0 };
    this.colliderFilter = (collider) => this.weaponContactRouter.ownsCollider(collider);
    this.sweepScratch = {
      grip0: new THREE.Vector3(), grip1: new THREE.Vector3(),
      quaternion0: new THREE.Quaternion(), quaternion1: new THREE.Quaternion(),
      point0: new THREE.Vector3(), point1: new THREE.Vector3(), localPoint: new THREE.Vector3(),
      deltaQuaternion: new THREE.Quaternion(), axis: new THREE.Vector3(), offset: new THREE.Vector3(), cross: new THREE.Vector3(),
      actorVelocity: new THREE.Vector3(), primitiveVelocity: new THREE.Vector3(), normal: new THREE.Vector3(), point: new THREE.Vector3(), bodyCenter: new THREE.Vector3(),
    };
    this.grabScratch = {
      worldStart: new THREE.Vector3(), worldEnd: new THREE.Vector3(), worldCenter: new THREE.Vector3(),
      projectedStart: new THREE.Vector3(), projectedEnd: new THREE.Vector3(), projectedCenter: new THREE.Vector3(),
    };
    this.poseRebaseRequest = { camera: this.camera, poseWorkspace: this.poseWorkspace, anchored: false, positions: [this.actualGrip, this.previousGrip, this.desiredGrip, this.currentHeadCenter, this.previousHeadCenter], quaternions: [this.actualQuaternion, this.previousQuaternion, this.desiredQuaternion] };
    this.disposers = [];
    this.disposed = false;
    this.debugVisible = false;
    this.buildVisual();
    this.presentation = new WeaponPresentationRuntime({ itemId: this.config.itemId, root: this.visual, scene: this.scene, camera: this.camera, viewmodelAnchor: this.viewmodelAnchor });
    this.presentation.recordLayer(MACE_VIEWMODEL_LAYER);
    this.buildDebug();
    this.initializePose();
    if (bindPointerInput) this.bindInput();
  }

  buildVisual() {
    this.visual = new THREE.Group();
    this.visual.name = 'dreadmace-authoritative-world-weapon';
    this.visualGeometries = [];
    this.visualMaterials = [];
    this.visualAssetState = 'loading';
    this.visualLoadPromise = this.visualAssetLoader().then((source) => {
      const owned = cloneOwnedWeaponVisual(source);
      if (this.disposed) { disposeOwnedWeaponVisual(owned); return 'disposed'; }
      owned.root.name = 'dreadmace-v001-mobile-1k-glb-visual';
      owned.root.userData.sourceAsset = DREADMACE_GLB_PATH;
      applyDreadmaceAssetCorrection(owned.root);
      this.visual.add(owned.root);
      this.visualGeometries.push(...owned.geometries);
      this.visualMaterials.push(...owned.materials);
      this.visualAssetState = 'loaded';
      this.registerOutdoorMaterials(owned.root);
      this.applyVisualLayer();
      return this.visualAssetState;
    }).catch((error) => {
      if (this.disposed) return 'disposed';
      this.visualAssetState = 'error';
      console.warn('[combat] Approved Dreadmace GLB failed to load; no substitute visual will be created.', error);
      return this.visualAssetState;
    });
    this.applyVisualLayer();
  }

  registerOutdoorMaterials(root) {
    if (!this.outdoorLightingDirector?.registerOrdinaryObject) return this.outdoorMaterialRegistration;
    this.outdoorMaterialRoot = root;
    this.outdoorMaterialRegistration = this.outdoorLightingDirector.registerOrdinaryObject(root);
    return this.outdoorMaterialRegistration;
  }

  unregisterOutdoorMaterials() {
    if (this.outdoorMaterialRoot) this.outdoorLightingDirector?.unregisterOrdinaryObject?.(this.outdoorMaterialRoot);
    this.outdoorMaterialRoot = null;
  }

  applyVisualLayer() {
    applyWeaponRenderLayer(this.visual, {
      layer: MACE_VIEWMODEL_LAYER,
      renderOrder: MACE_RENDER_ORDER,
      itemId: this.config.itemId,
      viewmodel: true,
      configureMesh: (object) => {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => { material.transparent = false; material.opacity = 1; material.depthWrite = true; });
        object.userData.combatMaceViewmodel = true;
      },
    });
    this.presentation?.recordLayer?.(MACE_VIEWMODEL_LAYER);
  }

  buildDebug() {
    this.debugRoot = new THREE.Group();
    this.debugRoot.name = 'dreadmace-contact-debug';
    this.debugRoot.visible = false;
    const material = new THREE.MeshBasicMaterial({ color: 0xe2a36d, wireframe: true, depthTest: false });
    this.debugHead = new THREE.Mesh(new THREE.SphereGeometry(DREADMACE_CONTACT_PRIMITIVES.mace_head.radius, 10, 7), material);
    this.debugRoot.add(this.debugHead);
    this.scene?.add?.(this.debugRoot);
  }

  initializePose() {
    initializeCameraRelativeWeaponPose({ camera: this.camera, workspace: this.config.workspace, poseWorkspace: this.poseWorkspace, actualGrip: this.actualGrip, previousGrip: this.previousGrip, desiredGrip: this.desiredGrip, actualQuaternion: this.actualQuaternion, previousQuaternion: this.previousQuaternion, desiredQuaternion: this.desiredQuaternion });
    this.localGrip.fromArray(this.config.workspace.ready);
    this.localQuaternion.copy(readyQuaternion);
    this.resetHammerPose();
    this.targetLocalGrip.copy(this.localGrip);
    this.targetLocalQuaternion.copy(this.localQuaternion);
    this.gestureBaselineGrip.copy(this.localGrip);
    this.gestureBaselineQuaternion.copy(this.localQuaternion);
    this.applyLocalPoseToWorld();
    this.previousGrip.copy(this.actualGrip);
    this.previousQuaternion.copy(this.actualQuaternion);
    this.previousHeadCenter.copy(this.currentHeadCenter);
    this.syncVisual(0);
  }

  bindInput() {
    this.disposers.push(bindWeaponPointerEvents({ viewport: this.viewport, onPointerDown: (event) => this.pointerDown(event), onPointerMove: (event) => this.pointerMove(event), onPointerEnd: (event) => this.pointerEnd(event), onSuspend: () => this.cancel('app-suspended') }));
  }

  pointerDown(event) {
    if (this.gripPointerId != null || !this.isEquipped() || event.target?.closest?.(DEFAULT_WEAPON_POINTER_BLOCK_SELECTOR) || !this.projectGrabHit(event.clientX, event.clientY, this.viewport)) return;
    if (!this.acquireGrip(event.pointerId, event.clientX, event.clientY, event.timeStamp || performance.now())) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    this.viewport?.setPointerCapture?.(event.pointerId);
  }

  pointerMove(event) {
    if (event.pointerId !== this.gripPointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    this.applyGripGesture(event.pointerId, event.clientX - this.gestureOwnership.startPoint.x, event.clientY - this.gestureOwnership.startPoint.y, event.clientX, event.clientY, event.timeStamp || performance.now());
  }

  pointerEnd(event) {
    if (event.pointerId !== this.gripPointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    this.viewport?.releasePointerCapture?.(event.pointerId);
    this.releaseGrip('pointer-release');
  }

  isEquipped() {
    return this.equipmentRuntime?.getEquippedWeaponProfile?.()?.id === this.config.itemId && this.equipmentRuntime?.hasItem?.(this.config.itemId);
  }

  acquireGrip(pointerId, clientX, clientY, timeMs = performance.now()) {
    if (!this.isEquipped() || !this.gestureOwnership.acquire(pointerId, clientX, clientY, timeMs)) return false;
    this.gestureBaselineGrip.copy(this.localGrip);
    this.gestureBaselineQuaternion.copy(this.localQuaternion);
    this.hammerGestureBaselinePitch = this.hammerPitch;
    this.targetLocalGrip.copy(this.localGrip);
    this.targetLocalQuaternion.copy(this.localQuaternion);
    this.freeAimX = 0;
    this.freeAimY = 0;
    this.freeExtension = 0;
    this.resetMotionHistory();
    this.clearStrikeToken();
    this.resistanceElapsed = 0;
    this.resistanceDuration = 0;
    this.resistancePositionOffset.set(0, 0, 0);
    this.resistanceRotationOffset.identity();
    this.beginHammerGesture();
    this.transitionState(MACE_GESTURE_STATES.held);
    return true;
  }

  applyGripGesture(pointerId, deltaX, deltaY, clientX, clientY, timeMs = performance.now()) {
    if (pointerId !== this.gripPointerId || this.state === MACE_GESTURE_STATES.returning) return false;
    const sample = this.gestureOwnership.update(pointerId, deltaX, deltaY, clientX, clientY, timeMs, this.freeExtension);
    if (!sample) return false;
    this.freeAimX = sample.aimX;
    this.freeAimY = sample.aimY;
    this.freeExtension = sample.extension;
    return true;
  }

  beginPlayerAuthoredStrike() {
    if (this.gripPointerId == null || this.activeStrikeId || this.loadEnergy < DREADMACE_GESTURE_THRESHOLDS.minimumRecentLoadEnergy) return false;
    this.strikeSerial += 1;
    this.activeStrikeId = `dreadmace-strike-${this.strikeSerial}`;
    this.strikeOwnerId = this.gripPointerId;
    this.strikeLoadEnergy = this.loadEnergy;
    this.accumulatedDownwardTravel = 0;
    this.rearmUpwardTravel = 0;
    this.strikeQualified = false;
    this.strikeSawSafeReset = false;
    this.swingCommitCount += 1;
    this.resolvedActors.clear();
    this.resolvedActorId = null;
    this.feedbackCount = 0;
    this.lastContactPrimitive = null;
    this.lastContactClassification = null;
    this.lastBluntImpactRecord = null;
    this.transitionState(MACE_GESTURE_STATES.striking);
    return true;
  }

  clearStrikeToken() {
    this.activeStrikeId = null;
    this.strikeOwnerId = null;
    this.strikeLoadEnergy = 0;
    this.strikeQualified = false;
    this.strikeSawSafeReset = false;
    this.accumulatedDownwardTravel = 0;
    this.rearmUpwardTravel = 0;
    this.resolvedActors.clear();
    this.resolvedActorId = null;
  }

  resetMotionHistory() {
    this.accumulatedUpwardTravel = 0;
    this.accumulatedDownwardTravel = 0;
    this.rearmUpwardTravel = 0;
    this.upwardHeadSpeed = 0;
    this.downwardHeadSpeed = 0;
    this.loadEnergy = 0;
    this.loadEnergyAge = 0;
    this.lastQualifiedUpwardAt = null;
    this.loadProgress = 0;
    this.maximumLoadProgress = 0;
    this.loadCompletedAt = null;
  }

  resetHammerPose() {
    const readyY = this.config.workspace.ready[1];
    this.hammerPhase = MACE_HAMMER_PHASES.resting;
    this.hammerRaiseProgress = 0;
    this.hammerDownstrokeProgress = 0;
    this.hammerPitch = this.config.hammerOrientation.restPitch;
    this.hammerPitchTarget = this.hammerPitch;
    this.hammerPeakPitch = this.hammerPitch;
    this.hammerRaiseStartPitch = this.hammerPitch;
    this.hammerDownstrokeStartPitch = this.hammerPitch;
    this.hammerGestureBaselinePitch = this.hammerPitch;
    this.hammerRaiseStartGripY = readyY;
    this.hammerPeakGripY = readyY;
    this.hammerDownstrokeStartGripY = readyY;
    this.hammerPreviousAuthoredGripY = readyY;
    this.hammerRaiseTravel = 0;
    this.hammerDownstrokeTravel = 0;
    this.hammerUpwardGripSpeed = 0;
    this.hammerDownwardGripSpeed = 0;
  }

  beginHammerGesture() {
    const gripY = this.localGrip.y;
    this.hammerRaiseProgress = 0;
    this.hammerDownstrokeProgress = 0;
    this.hammerRaiseTravel = 0;
    this.hammerDownstrokeTravel = 0;
    this.hammerUpwardGripSpeed = 0;
    this.hammerDownwardGripSpeed = 0;
    this.hammerRaiseStartGripY = gripY;
    this.hammerPeakGripY = gripY;
    this.hammerDownstrokeStartGripY = gripY;
    this.hammerPreviousAuthoredGripY = gripY;
    this.hammerRaiseStartPitch = this.hammerPitch;
    this.hammerDownstrokeStartPitch = this.hammerPitch;
    this.hammerPitchTarget = this.hammerPitch;
    this.hammerPeakPitch = this.hammerPitch;
    this.hammerPhase = this.hammerPitch >= this.config.hammerOrientation.topPitch * 0.85
      ? MACE_HAMMER_PHASES.cocked
      : this.hammerPitch <= this.config.hammerOrientation.restPitch + EPSILON
        ? MACE_HAMMER_PHASES.resting
        : MACE_HAMMER_PHASES.recovering;
  }

  updateHammerOrientation(authoredGripY, dt) {
    const config = this.config.hammerOrientation;
    const previousGripY = this.hammerPreviousAuthoredGripY;
    const gripDeltaY = authoredGripY - previousGripY;
    const safeDt = Math.max(EPSILON, dt);
    this.hammerUpwardGripSpeed = THREE.MathUtils.clamp(Math.max(0, gripDeltaY / safeDt), 0, config.maximumTrackedGripSpeed);
    this.hammerDownwardGripSpeed = THREE.MathUtils.clamp(Math.max(0, -gripDeltaY / safeDt), 0, config.maximumTrackedGripSpeed);
    const raising = gripDeltaY > EPSILON && this.hammerUpwardGripSpeed >= config.motionSpeedThreshold;
    const descending = gripDeltaY < -EPSILON && this.hammerDownwardGripSpeed >= config.motionSpeedThreshold;

    if (raising) {
      if (this.hammerPhase !== MACE_HAMMER_PHASES.raising) {
        this.hammerPhase = MACE_HAMMER_PHASES.raising;
        this.hammerRaiseStartGripY = previousGripY;
        this.hammerRaiseStartPitch = this.hammerPitch;
        this.hammerRaiseProgress = 0;
        this.hammerRaiseTravel = 0;
        this.hammerPeakPitch = this.hammerPitch;
        this.hammerPeakGripY = previousGripY;
      }
      this.hammerRaiseTravel = Math.max(0, authoredGripY - this.hammerRaiseStartGripY);
      this.hammerRaiseProgress = THREE.MathUtils.clamp(this.hammerRaiseTravel / config.fullRaiseGripTravel, 0, 1);
      const speedQualification = THREE.MathUtils.clamp(
        (this.hammerUpwardGripSpeed - config.overshootSpeedStart) / (config.overshootSpeedFull - config.overshootSpeedStart),
        0,
        1,
      );
      const upperRaiseWeight = smoothstep((this.hammerRaiseProgress - 0.70) / 0.30);
      const overshoot = config.maximumSpeedOvershoot * speedQualification * upperRaiseWeight;
      const raisedPitch = THREE.MathUtils.lerp(this.hammerRaiseStartPitch, config.topPitch, smoothstep(this.hammerRaiseProgress)) + overshoot;
      this.hammerPitchTarget = THREE.MathUtils.clamp(raisedPitch, config.impactPitch, config.maximumTopPitch);
      this.hammerPitch = Math.max(this.hammerPitch, this.hammerPitchTarget);
      if (this.hammerPitch >= this.hammerPeakPitch) {
        this.hammerPeakPitch = this.hammerPitch;
        this.hammerPeakGripY = authoredGripY;
      }
    } else if (descending && (this.hammerPhase === MACE_HAMMER_PHASES.raising || this.hammerPhase === MACE_HAMMER_PHASES.cocked || this.hammerPhase === MACE_HAMMER_PHASES.descending)) {
      if (this.hammerPhase !== MACE_HAMMER_PHASES.descending) {
        this.hammerPhase = MACE_HAMMER_PHASES.descending;
        this.hammerDownstrokeStartGripY = previousGripY;
        this.hammerDownstrokeStartPitch = this.hammerPitch;
        this.hammerDownstrokeProgress = 0;
        this.hammerDownstrokeTravel = 0;
      }
      this.hammerDownstrokeTravel = Math.max(0, this.hammerDownstrokeStartGripY - authoredGripY);
      this.hammerDownstrokeProgress = THREE.MathUtils.clamp(this.hammerDownstrokeTravel / config.fullDownstrokeGripTravel, 0, 1);
      this.hammerPitchTarget = THREE.MathUtils.lerp(this.hammerDownstrokeStartPitch, config.impactPitch, smoothstep(this.hammerDownstrokeProgress));
      this.hammerPitch = this.hammerPitchTarget;
    } else if (this.hammerPhase === MACE_HAMMER_PHASES.raising && this.hammerRaiseProgress >= config.cockedProgressThreshold) {
      this.hammerPhase = MACE_HAMMER_PHASES.cocked;
      this.hammerPitchTarget = this.hammerPitch;
    } else if (this.hammerPhase === MACE_HAMMER_PHASES.descending && this.hammerDownstrokeProgress >= 1) {
      this.hammerPhase = MACE_HAMMER_PHASES.recovering;
      this.hammerPitchTarget = this.hammerPitch;
    }

    this.hammerPitch = THREE.MathUtils.clamp(this.hammerPitch, config.impactPitch, config.maximumTopPitch);
    this.hammerPitchTarget = THREE.MathUtils.clamp(this.hammerPitchTarget, config.impactPitch, config.maximumTopPitch);
    this.hammerPreviousAuthoredGripY = authoredGripY;
  }

  releaseGrip(reason = 'pointer-release') {
    if (this.gripPointerId == null) return;
    this.gestureOwnership.release();
    this.clearStrikeToken();
    this.resetMotionHistory();
    this.beginReturn(reason);
  }

  beginReturn(_reason = 'safe-return') {
    this.returnElapsed = 0;
    this.returnStartGrip.copy(this.localGrip);
    this.returnStartQuaternion.copy(this.localQuaternion);
    this.returnStartHammerPitch = this.hammerPitch;
    this.targetLocalGrip.fromArray(this.config.workspace.ready);
    this.targetLocalQuaternion.copy(readyQuaternion);
    this.hammerPhase = MACE_HAMMER_PHASES.recovering;
    this.transitionState(MACE_GESTURE_STATES.returning);
  }

  beginImpactResistance(metrics) {
    const energyResponse = THREE.MathUtils.clamp(metrics.estimatedEnergy / 100, 0, 1);
    const resistanceResponse = THREE.MathUtils.clamp((this.impactResistance - 0.35) / 1.95, 0, 1);
    const response = THREE.MathUtils.clamp(this.impactResponseStrength * (0.7 + resistanceResponse * 0.3), 0, 1);
    this.resistanceElapsed = 0;
    this.resistanceDuration = THREE.MathUtils.lerp(
      this.config.impactResistanceDuration.minimum,
      this.config.impactResistanceDuration.maximum,
      Math.max(energyResponse * 0.7, response),
    );
    const localOpposition = this.sweepScratch.point.copy(this.headCenterVelocity);
    if (localOpposition.lengthSq() > EPSILON) localOpposition.normalize().negate();
    else localOpposition.set(0, 1, 1).normalize();
    this.camera?.getWorldQuaternion?.(this.contactScratch.inverseQuaternion);
    localOpposition.applyQuaternion(this.contactScratch.inverseQuaternion.invert());
    this.resistancePositionOffset.copy(localOpposition).multiplyScalar(0.018 + response * 0.027);
    this.resistanceRotationOffset.setFromAxisAngle(this.sweepScratch.axis.set(1, 0, 0), -0.04 - response * 0.07);
    this.transitionState(MACE_GESTURE_STATES.impactResistance);
  }

  transitionState(nextState) {
    if (this.state === nextState) return false;
    const previousState = this.state;
    const beforeGrip = this.localGrip.clone();
    const beforeQuaternion = this.localQuaternion.clone();
    this.state = nextState;
    this.lastStateTransition = `${previousState}->${nextState}`;
    this.lastTransitionPositionJump = beforeGrip.distanceTo(this.localGrip);
    this.lastTransitionRotationJumpDegrees = THREE.MathUtils.radToDeg(beforeQuaternion.angleTo(this.localQuaternion));
    return true;
  }

  updateGestureState(dt) {
    if (this.state === MACE_GESTURE_STATES.returning) {
      this.returnElapsed += dt;
      const t = criticallyDampedMaceReturnProgress(this.returnElapsed, this.config.returnDuration);
      this.localGrip.copy(this.returnStartGrip).lerp(this.contactScratch.point.fromArray(this.config.workspace.ready), t);
      this.localQuaternion.slerpQuaternions(this.returnStartQuaternion, readyQuaternion, t).normalize();
      this.hammerPitch = THREE.MathUtils.lerp(this.returnStartHammerPitch, this.config.hammerOrientation.restPitch, t);
      this.hammerPitchTarget = this.config.hammerOrientation.restPitch;
      this.hammerPreviousAuthoredGripY = this.localGrip.y;
      if (this.returnElapsed >= this.config.returnDuration) {
        this.transitionState(MACE_GESTURE_STATES.ready);
        this.localGrip.fromArray(this.config.workspace.ready);
        this.localQuaternion.copy(readyQuaternion);
        this.resetHammerPose();
        this.targetLocalGrip.copy(this.localGrip);
        this.targetLocalQuaternion.copy(this.localQuaternion);
        this.resetMotionHistory();
        this.freeAimX = 0;
        this.freeAimY = 0;
        this.freeExtension = 0;
      }
      return;
    }
    if (this.gripPointerId == null) return;
    sampleDreadmaceDirectPose({
      baselineGrip: this.gestureBaselineGrip,
      baselineQuaternion: this.gestureBaselineQuaternion,
      baselineHammerPitch: this.hammerGestureBaselinePitch,
      hammerPitch: this.hammerPitch,
      aimX: this.freeAimX,
      aimY: this.freeAimY,
      extension: this.freeExtension,
    }, this.targetLocalGrip, this.targetLocalQuaternion);
    this.updateHammerOrientation(this.targetLocalGrip.y, dt);
    sampleDreadmaceDirectPose({
      baselineGrip: this.gestureBaselineGrip,
      baselineQuaternion: this.gestureBaselineQuaternion,
      baselineHammerPitch: this.hammerGestureBaselinePitch,
      hammerPitch: this.hammerPitch,
      aimX: this.freeAimX,
      aimY: this.freeAimY,
      extension: this.freeExtension,
    }, this.targetLocalGrip, this.targetLocalQuaternion);
    this.localGrip.copy(this.targetLocalGrip);
    this.localQuaternion.copy(this.targetLocalQuaternion);
    if (this.state === MACE_GESTURE_STATES.impactResistance) {
      this.resistanceElapsed += dt;
      const progress = THREE.MathUtils.clamp(this.resistanceElapsed / Math.max(EPSILON, this.resistanceDuration), 0, 1);
      const weight = (1 - smoothstep(progress));
      this.localGrip.addScaledVector(this.resistancePositionOffset, weight);
      this.localQuaternion.multiply(this.sweepScratch.quaternion0.slerpQuaternions(identityQuaternion, this.resistanceRotationOffset, weight)).normalize();
      if (progress >= 1) this.transitionState(this.activeStrikeId ? MACE_GESTURE_STATES.striking : this.loadEnergy > 0 ? MACE_GESTURE_STATES.loading : MACE_GESTURE_STATES.held);
    }
  }

  applyLocalPoseToWorld() {
    this.camera?.updateMatrixWorld?.(true);
    this.desiredGrip.copy(this.localGrip);
    this.camera?.localToWorld?.(this.desiredGrip);
    this.camera?.getWorldQuaternion?.(this.desiredQuaternion);
    this.desiredQuaternion.multiply(this.localQuaternion).normalize();
    this.actualGrip.copy(this.desiredGrip);
    this.actualQuaternion.copy(this.desiredQuaternion);
    this.currentHeadCenter.copy(this.localHeadOffset).applyQuaternion(this.actualQuaternion).add(this.actualGrip);
  }

  updateKinematics(dt) {
    const safeDt = Math.max(EPSILON, dt);
    this.gripVelocity.subVectors(this.actualGrip, this.previousGrip).divideScalar(safeDt);
    const delta = this.sweepScratch.deltaQuaternion.copy(this.actualQuaternion).multiply(this.sweepScratch.quaternion0.copy(this.previousQuaternion).invert()).normalize();
    if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
    const halfAngle = Math.acos(THREE.MathUtils.clamp(delta.w, -1, 1));
    const sinHalf = Math.sin(halfAngle);
    if (sinHalf > EPSILON) this.angularVelocity.set(delta.x / sinHalf, delta.y / sinHalf, delta.z / sinHalf).multiplyScalar((2 * halfAngle) / safeDt);
    else this.angularVelocity.set(0, 0, 0);
    const offset = this.sweepScratch.offset.copy(this.localHeadOffset).applyQuaternion(this.actualQuaternion);
    this.headCenterVelocity.copy(this.gripVelocity).add(this.sweepScratch.cross.copy(this.angularVelocity).cross(offset));
  }

  updateMotionHistory(dt) {
    const safeDt = Math.max(EPSILON, dt);
    const actualVerticalTravel = this.currentHeadCenter.y - this.previousHeadCenter.y;
    this.upwardHeadSpeed = Math.max(0, this.headCenterVelocity.y);
    this.downwardHeadSpeed = Math.max(0, -this.headCenterVelocity.y);
    const totalHeadSpeed = this.headCenterVelocity.length();
    const pointerOwned = this.gripPointerId != null;
    const resistanceActive = this.state === MACE_GESTURE_STATES.impactResistance;
    const qualifiedUpward = pointerOwned
      && !resistanceActive
      && actualVerticalTravel > 0
      && this.upwardHeadSpeed >= DREADMACE_GESTURE_THRESHOLDS.minimumUpwardSpeed;
    if (qualifiedUpward) {
      const speedQualification = THREE.MathUtils.clamp(
        (this.upwardHeadSpeed - DREADMACE_GESTURE_THRESHOLDS.minimumUpwardSpeed)
        / (DREADMACE_GESTURE_THRESHOLDS.strongUpwardSpeed - DREADMACE_GESTURE_THRESHOLDS.minimumUpwardSpeed),
        0,
        1,
      );
      const contribution = actualVerticalTravel * THREE.MathUtils.lerp(0.25, 1, speedQualification);
      this.accumulatedUpwardTravel = Math.min(DREADMACE_GESTURE_THRESHOLDS.fullLoadTravel * 1.25, this.accumulatedUpwardTravel + contribution);
      this.lastQualifiedUpwardAt = this.elapsed;
      this.loadEnergyAge = 0;
      if (this.activeStrikeId) this.rearmUpwardTravel += actualVerticalTravel;
    } else if (pointerOwned) {
      this.accumulatedUpwardTravel *= Math.exp(-safeDt / DREADMACE_GESTURE_THRESHOLDS.loadMemorySeconds);
      this.loadEnergyAge = this.lastQualifiedUpwardAt == null ? 0 : Math.min(DREADMACE_GESTURE_THRESHOLDS.loadMemorySeconds * 4, this.elapsed - this.lastQualifiedUpwardAt);
    }
    this.loadEnergy = THREE.MathUtils.clamp(
      (this.accumulatedUpwardTravel - DREADMACE_GESTURE_THRESHOLDS.loadStartTravel)
      / (DREADMACE_GESTURE_THRESHOLDS.fullLoadTravel - DREADMACE_GESTURE_THRESHOLDS.loadStartTravel),
      0,
      1,
    );
    this.loadProgress = this.loadEnergy;
    this.maximumLoadProgress = this.loadEnergy;
    if (this.loadEnergy >= 0.999) this.loadCompletedAt ??= this.elapsed;
    else this.loadCompletedAt = null;

    if (!pointerOwned || resistanceActive) {
      this.strikeQualified = false;
      return;
    }
    if (this.activeStrikeId && totalHeadSpeed <= DREADMACE_GESTURE_THRESHOLDS.safeResetHeadSpeed) this.strikeSawSafeReset = true;
    if (this.activeStrikeId && qualifiedUpward) {
      const rearmed = this.rearmUpwardTravel >= DREADMACE_GESTURE_THRESHOLDS.meaningfulRearmRaiseTravel
        || (this.strikeSawSafeReset && this.rearmUpwardTravel >= DREADMACE_GESTURE_THRESHOLDS.safeResetRearmRaiseTravel);
      if (rearmed) {
        this.clearStrikeToken();
        this.transitionState(this.loadEnergy > 0 ? MACE_GESTURE_STATES.loading : MACE_GESTURE_STATES.held);
      }
    }
    if (!this.activeStrikeId
      && this.loadEnergy >= DREADMACE_GESTURE_THRESHOLDS.minimumRecentLoadEnergy
      && this.downwardHeadSpeed >= DREADMACE_GESTURE_THRESHOLDS.minimumDownwardPhaseSpeed) {
      this.beginPlayerAuthoredStrike();
    }
    if (this.activeStrikeId && actualVerticalTravel < 0) this.accumulatedDownwardTravel += -actualVerticalTravel;
    this.strikeQualified = Boolean(
      this.activeStrikeId
      && this.loadEnergy >= DREADMACE_GESTURE_THRESHOLDS.minimumRecentLoadEnergy
      && this.downwardHeadSpeed >= DREADMACE_GESTURE_THRESHOLDS.minimumDownwardHeadSpeed
      && totalHeadSpeed >= DREADMACE_GESTURE_THRESHOLDS.minimumTotalHeadSpeed
      && this.accumulatedDownwardTravel >= DREADMACE_GESTURE_THRESHOLDS.minimumDownwardStrikeTravel
    );
    this.swingPower = computeDreadmaceGesturePower({ loadProgress: this.loadEnergy, downwardSpeed: this.downwardHeadSpeed, downwardTravel: this.accumulatedDownwardTravel });
    if (this.state !== MACE_GESTURE_STATES.impactResistance) {
      this.transitionState(this.activeStrikeId ? MACE_GESTURE_STATES.striking : this.loadEnergy > 0 ? MACE_GESTURE_STATES.loading : MACE_GESTURE_STATES.held);
    }
  }

  beforePhysics(dt) {
    this.lastPhysicsDt = Math.max(0, Number(dt) || 0);
    this.elapsed += this.lastPhysicsDt;
    this.visual.visible = this.isEquipped();
    this.debugRoot.visible = this.debugVisible && this.visual.visible;
    if (!this.visual.visible) {
      if (this.gripPointerId != null || this.state !== MACE_GESTURE_STATES.ready) this.cancel('weapon-unequipped');
      return;
    }
    this.presentation.recordPhysicalCameraMatrix();
    rebaseWorldWeaponPoseToCamera(this.poseRebaseRequest);
    this.previousGrip.copy(this.actualGrip);
    this.previousQuaternion.copy(this.actualQuaternion);
    this.previousHeadCenter.copy(this.currentHeadCenter);
    this.updateGestureState(this.lastPhysicsDt);
    this.applyLocalPoseToWorld();
    this.updateKinematics(this.lastPhysicsDt);
    this.updateMotionHistory(this.lastPhysicsDt);
    if (this.strikeQualified
      && this.state !== MACE_GESTURE_STATES.impactResistance
      && (this.contactActivationProvider?.() ?? true)) this.resolveSmashContact();
  }

  getPrimitiveCenterVelocity(primitive, target = this.sweepScratch.primitiveVelocity) {
    const localCenter = primitive.center ?? [
      (primitive.points[0][0] + primitive.points[1][0]) * 0.5,
      (primitive.points[0][1] + primitive.points[1][1]) * 0.5,
      (primitive.points[0][2] + primitive.points[1][2]) * 0.5,
    ];
    const offset = this.sweepScratch.offset.fromArray(localCenter).applyQuaternion(this.actualQuaternion);
    return target.copy(this.gripVelocity).add(this.sweepScratch.cross.copy(this.angularVelocity).cross(offset));
  }

  sweepPrimitive(name, primitive, positionsPrepared) {
    const translationDistance = this.actualGrip.distanceTo(this.previousGrip);
    const angularDistance = this.previousQuaternion.angleTo(this.actualQuaternion);
    const leverArm = primitiveLeverArms[name];
    const sampleCount = resolveDreadmaceSweepSampleCount({ translationDistance, angularDistance, leverArm, radius: primitive.radius });
    this.lastSweepSampleCount = Math.max(this.lastSweepSampleCount, sampleCount);
    this.maximumObservedSweepSampleCount = Math.max(this.maximumObservedSweepSampleCount, sampleCount);
    let earliest = null;
    for (let segment = 0; segment < sampleCount; segment += 1) {
      const t0 = segment / sampleCount;
      const t1 = (segment + 1) / sampleCount;
      this.sweepScratch.grip0.lerpVectors(this.previousGrip, this.actualGrip, t0);
      this.sweepScratch.grip1.lerpVectors(this.previousGrip, this.actualGrip, t1);
      this.sweepScratch.quaternion0.slerpQuaternions(this.previousQuaternion, this.actualQuaternion, t0).normalize();
      this.sweepScratch.quaternion1.slerpQuaternions(this.previousQuaternion, this.actualQuaternion, t1).normalize();
      for (const localPoint of primitiveLocalPoints[name]) {
        this.sweepScratch.point0.fromArray(localPoint).applyQuaternion(this.sweepScratch.quaternion0).add(this.sweepScratch.grip0);
        this.sweepScratch.point1.fromArray(localPoint).applyQuaternion(this.sweepScratch.quaternion1).add(this.sweepScratch.grip1);
        const raw = this.physics?.castWeaponTip?.(this.sweepScratch.point0, this.sweepScratch.point1, primitive.radius, this.colliderFilter, positionsPrepared);
        if (!raw?.collider) continue;
        const localToi = THREE.MathUtils.clamp(raw.time_of_impact ?? 0, 0, 1);
        const toi = (segment + localToi) / sampleCount;
        if (earliest && earliest.toi <= toi) continue;
        const point = raw.witness1
          ? new THREE.Vector3(raw.witness1.x, raw.witness1.y, raw.witness1.z)
          : this.sweepScratch.point0.clone().lerp(this.sweepScratch.point1, localToi);
        earliest = { name, primitive, raw, toi, point, sampleCount };
      }
    }
    return earliest;
  }

  resolveSmashContact() {
    if (!this.physics || !this.activeStrikeId || !this.strikeQualified || this.resolvedActors.size >= this.config.maximumTargetsPerStrike) return false;
    this.lastSweepSampleCount = 0;
    const positionsPrepared = this.physics.prepareWeaponSweepBatch?.() === true;
    const priority = { mace_head: 0, haft: 1, grip: 2, pommel: 3 };
    const candidates = Object.entries(DREADMACE_CONTACT_PRIMITIVES)
      .map(([name, primitive]) => this.sweepPrimitive(name, primitive, positionsPrepared))
      .filter(Boolean)
      .sort((a, b) => a.toi - b.toi || priority[a.name] - priority[b.name]);
    if (!candidates.length) return false;
    return this.resolveContactCandidate(candidates[0]);
  }

  resolveContactCandidate(candidate) {
    const routed = this.weaponContactRouter.resolveTarget(candidate.raw.collider, candidate.point);
    if (!routed) return false;
    const actorId = routed.actor?.instanceId ?? routed.actor?.id ?? 'actor';
    if (this.resolvedActors.has(actorId)) {
      this.rejectedRepeatContactCount += 1;
      return false;
    }
    const normal = candidate.raw.normal1
      ? this.sweepScratch.normal.set(candidate.raw.normal1.x, candidate.raw.normal1.y, candidate.raw.normal1.z)
      : this.sweepScratch.normal.copy(candidate.point).sub(getRigidBodyWorldPosition(routed.hit.body, this.sweepScratch.bodyCenter));
    if (normal.lengthSq() < EPSILON) normal.copy(this.headCenterVelocity).negate();
    normal.normalize();
    const bodyVelocity = routed.hit.body?.linvel?.();
    this.sweepScratch.actorVelocity.set(bodyVelocity?.x ?? 0, bodyVelocity?.y ?? 0, bodyVelocity?.z ?? 0);
    const primitiveVelocity = this.getPrimitiveCenterVelocity(candidate.primitive);
    const metrics = estimateBluntImpactMetrics({
      headCenterVelocity: this.headCenterVelocity,
      contactCenterVelocity: primitiveVelocity,
      worldNormal: normal,
      actorVelocity: this.sweepScratch.actorVelocity,
      effectiveMass: candidate.primitive.effectiveMass,
      primitive: candidate.name,
      loadProgress: this.loadEnergy,
      gesturePower: this.swingPower,
    });
    const relativeSpeed = metrics.actorRelativeVelocity.length();
    const normalAlignment = relativeSpeed > EPSILON ? metrics.normalImpactSpeed / relativeSpeed : 0;
    const damaging = candidate.name === 'mace_head'
      && this.strikeQualified
      && metrics.normalImpactSpeed >= DREADMACE_GESTURE_THRESHOLDS.minimumContactNormalSpeed
      && normalAlignment >= DREADMACE_GESTURE_THRESHOLDS.minimumContactNormalAlignment;
    const impactClassification = damaging ? metrics.classification : BLUNT_IMPACT_CLASSIFICATIONS.nonDamagingContact;
    this.lastContactPrimitive = candidate.name;
    this.lastContactClassification = impactClassification;
    this.lastNormalImpactSpeed = metrics.normalImpactSpeed;
    this.lastEffectiveMass = metrics.effectiveMass;
    this.lastEstimatedImpulse = metrics.estimatedImpulse;
    this.lastEstimatedEnergy = metrics.estimatedEnergy;
    this.lastImpactPoint = candidate.point.clone();
    this.lastImpactRegion = routed.hit.regionId;
    this.impactEnergy = metrics.estimatedEnergy;
    this.impactResistance = THREE.MathUtils.clamp(routed.hit.region?.hardStructureResistance ?? routed.hit.region?.softTissueResistance ?? 1, 0.35, 2.3);
    this.impactResponseStrength = impactClassification === BLUNT_IMPACT_CLASSIFICATIONS.heavySmash
      ? 1
      : impactClassification === BLUNT_IMPACT_CLASSIFICATIONS.committedBlunt
        ? 0.72
        : 0.18;
    this.resolvedActors.add(actorId);
    this.resolvedActorId = actorId;
    if (!damaging) {
      this.lastBluntImpactRecord = createBluntImpactInteraction({
        interactionId: `${this.activeStrikeId}:non-damaging`, weaponId: this.config.itemId, weaponFamily: 'mace', primitive: candidate.name,
        actorId, bodyId: routed.hit.bodyId, regionId: routed.hit.regionId, worldPoint: candidate.point, worldNormal: normal,
        impactDirection: metrics.impactDirection, headCenterVelocity: this.headCenterVelocity, contactCenterVelocity: metrics.contactCenterVelocity, actorRelativeVelocity: metrics.actorRelativeVelocity,
        normalImpactSpeed: metrics.normalImpactSpeed, tangentialSpeed: metrics.tangentialSpeed, effectiveMass: metrics.effectiveMass,
        estimatedImpulse: metrics.estimatedImpulse, estimatedEnergy: metrics.estimatedEnergy, loadProgress: this.loadEnergy,
        gesturePower: this.swingPower, impactRadiusEstimate: candidate.primitive.impactRadiusEstimate, classification: impactClassification, startedAt: this.elapsed,
      });
    } else {
      const intent = Object.freeze({ weaponId: this.config.itemId, intent: MELEE_INTENTS.smash, ownerId: this.strikeOwnerId ?? this.activeStrikeId, speed: primitiveVelocity.length(), intentional: true, damaging: true, reason: 'owned-player-authored-downward-smash' });
      const interaction = routed.director?.resolveBluntImpact?.({
        weapon: this.weaponDefinition, intent, hit: routed.hit, primitive: candidate.name, worldPoint: candidate.point, worldNormal: normal,
        impactDirection: metrics.impactDirection, headCenterVelocity: this.headCenterVelocity, contactCenterVelocity: metrics.contactCenterVelocity, actorRelativeVelocity: metrics.actorRelativeVelocity,
        normalImpactSpeed: metrics.normalImpactSpeed, tangentialSpeed: metrics.tangentialSpeed, effectiveMass: metrics.effectiveMass,
        estimatedImpulse: metrics.estimatedImpulse, estimatedEnergy: metrics.estimatedEnergy, loadProgress: this.loadEnergy,
        gesturePower: this.swingPower, impactRadiusEstimate: candidate.primitive.impactRadiusEstimate, classification: impactClassification, weaponAdapter: this,
      });
      if (interaction) {
        this.activeBluntInteractions.set(interaction.id, routed.director);
        this.lastBluntImpactRecord = interaction.result.bluntImpact;
        this.feedbackCount += 1;
      }
    }
    this.beginImpactResistance(metrics);
    return true;
  }

  syncVisual(_frameDelta = this.lastPhysicsDt) {
    this.presentation.beginRenderFrame();
    const equipped = this.isEquipped();
    this.visual.visible = equipped;
    if (!equipped) {
      this.presentation.detachHidden();
      return;
    }
    this.presentation.writeViewmodelPose(this.localGrip, this.localQuaternion);
    this.visual.getWorldPosition(this.displayedGrip);
    this.visual.getWorldQuaternion(this.displayedQuaternion);
    this.displayedHeadCenter.copy(this.localHeadOffset).applyQuaternion(this.displayedQuaternion).add(this.displayedGrip);
    this.positionTrackingError = this.localGrip.distanceTo(this.targetLocalGrip);
    this.rotationTrackingErrorDegrees = THREE.MathUtils.radToDeg(this.localQuaternion.angleTo(this.targetLocalQuaternion));
    if (this.viewmodelAnchor && this.visual.parent === this.viewmodelAnchor) {
      const displayedLocalHead = this.contactScratch.point.copy(this.localHeadOffset).applyQuaternion(this.visual.quaternion).add(this.visual.position);
      const physicalLocalHead = this.contactScratch.correction.copy(this.localHeadOffset).applyQuaternion(this.localQuaternion).add(this.localGrip);
      this.visualPhysicalHeadError = displayedLocalHead.distanceTo(physicalLocalHead);
    } else this.visualPhysicalHeadError = this.displayedHeadCenter.distanceTo(this.currentHeadCenter);
    this.debugHead.position.copy(this.currentHeadCenter);
  }

  afterPhysics(_alpha = 1, frameDelta = this.lastPhysicsDt) { this.syncVisual(frameDelta); }
  afterPhysicsStep() {}
  onCombatResistance() {}
  onCombatRecovery(_payload, interaction) { if (interaction?.id) this.activeBluntInteractions.delete(interaction.id); }

  cancelTarget(actor, reason = 'target-cancelled') {
    const actorId = actor?.instanceId ?? actor?.id;
    if (!actorId || this.resolvedActorId !== actorId) return false;
    this.clearStrikeToken();
    if (this.gripPointerId == null) this.beginReturn(reason);
    else this.transitionState(this.loadEnergy > 0 ? MACE_GESTURE_STATES.loading : MACE_GESTURE_STATES.held);
    return true;
  }

  getActiveToolId() { return this.isEquipped() ? this.config.itemId : null; }
  getWeaponPresentationDiagnostics() { return this.presentation.getDiagnostics({ equippedItemId: this.isEquipped() ? this.config.itemId : null }); }

  projectGrip() {
    if (!this.camera || !this.viewport) return null;
    const rect = this.viewport.getBoundingClientRect();
    const radius = Math.max(this.config.gripZone.minimumRadiusPx, Math.min(this.config.gripZone.maximumRadiusPx, Math.min(rect.width, rect.height) * this.config.gripZone.viewportRatio));
    const start = this.grabScratch.worldStart.fromArray(this.config.gripZone.localSegmentStart).applyQuaternion(this.actualQuaternion).add(this.actualGrip);
    const end = this.grabScratch.worldEnd.fromArray(this.config.gripZone.localSegmentEnd).applyQuaternion(this.actualQuaternion).add(this.actualGrip);
    const center = this.grabScratch.worldCenter.copy(this.actualGrip);
    const projectedStart = this.grabScratch.projectedStart.copy(start).project(this.camera);
    const projectedEnd = this.grabScratch.projectedEnd.copy(end).project(this.camera);
    const projectedCenter = this.grabScratch.projectedCenter.copy(center).project(this.camera);
    const toScreen = (projected) => ({
      x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
      depth: projected.z,
    });
    const segmentStart = toScreen(projectedStart);
    const segmentEnd = toScreen(projectedEnd);
    const representativeCenter = toScreen(projectedCenter);
    return {
      ...representativeCenter,
      radius,
      segmentStart,
      segmentEnd,
      capsule: { start: segmentStart, end: segmentEnd, radius },
      localSegmentStart: [...this.config.gripZone.localSegmentStart],
      localSegmentEnd: [...this.config.gripZone.localSegmentEnd],
      toolId: this.config.itemId,
      kind: 'grip-input-capture',
    };
  }

  getProjectedGrabPoint(viewport = this.viewport) { return this.getProjectedGripZone(viewport); }
  getProjectedGripZone(viewport = this.viewport) { if (viewport !== this.viewport) this.viewport = viewport; return this.isEquipped() ? this.projectGrip() : null; }
  projectGrabHit(clientX, clientY, viewport = this.viewport) {
    const grip = this.getProjectedGripZone(viewport);
    if (!grip) {
      this.lastGrabDistanceToHandle = null;
      this.lastGrabAccepted = false;
      return false;
    }
    const start = grip.segmentStart;
    const end = grip.segmentEnd;
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    const projection = lengthSquared > EPSILON
      ? THREE.MathUtils.clamp(((clientX - start.x) * segmentX + (clientY - start.y) * segmentY) / lengthSquared, 0, 1)
      : 0;
    const closestX = start.x + segmentX * projection;
    const closestY = start.y + segmentY * projection;
    this.lastGrabDistanceToHandle = THREE.MathUtils.clamp(Math.hypot(clientX - closestX, clientY - closestY), 0, 10000);
    this.lastGrabAccepted = this.lastGrabDistanceToHandle <= grip.radius;
    return this.lastGrabAccepted;
  }

  getProjectedActivePoint(viewport = this.viewport) {
    if (!viewport || !this.isEquipped()) return null;
    const projected = this.currentHeadCenter.clone().project(this.camera);
    const rect = viewport.getBoundingClientRect();
    return { x: rect.left + (projected.x * 0.5 + 0.5) * rect.width, y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height, depth: projected.z, toolId: this.config.itemId, kind: 'mace-head' };
  }

  setGestureState(gesture = {}) {
    if (gesture.active && gesture.toolId === this.config.itemId) {
      if (this.gripPointerId == null) this.acquireGrip(gesture.pointerId, gesture.startX, gesture.startY, gesture.samples?.[0]?.timeMs ?? performance.now());
      this.applyGripGesture(gesture.pointerId, gesture.deltaX ?? 0, gesture.deltaY ?? 0, gesture.x ?? gesture.startX, gesture.y ?? gesture.startY, gesture.samples?.at?.(-1)?.timeMs ?? performance.now());
    } else if (this.gripPointerId != null) this.releaseGrip('external-gesture-release');
  }

  impact() {}
  setDebugVisible(visible) { this.debugVisible = Boolean(visible); }
  nudgeExtension() {}
  nudgeAim() {}

  cancel(reason = 'cancelled') {
    this.activeBluntInteractions.forEach((director, interactionId) => director?.cancelInteraction?.(interactionId, reason));
    this.activeBluntInteractions.clear();
    this.gestureOwnership.release();
    this.state = MACE_GESTURE_STATES.ready;
    this.resetMotionHistory();
    this.clearStrikeToken();
    this.returnElapsed = 0;
    this.resistanceElapsed = 0;
    this.resistanceDuration = 0;
    this.resistancePositionOffset.set(0, 0, 0);
    this.resistanceRotationOffset.identity();
    this.lastContactPrimitive = null;
    this.lastContactClassification = reason;
    this.lastNormalImpactSpeed = 0;
    this.lastEffectiveMass = 0;
    this.lastEstimatedImpulse = 0;
    this.lastEstimatedEnergy = 0;
    this.impactEnergy = 0;
    this.impactResistance = 1;
    this.impactResponseStrength = 0;
    this.lastImpactPoint = null;
    this.lastImpactRegion = null;
    this.lastBluntImpactRecord = null;
    this.feedbackCount = 0;
    this.lastSweepSampleCount = 0;
    this.localGrip.fromArray(this.config.workspace.ready);
    this.localQuaternion.copy(readyQuaternion);
    this.resetHammerPose();
    this.targetLocalGrip.copy(this.localGrip);
    this.targetLocalQuaternion.copy(this.localQuaternion);
    this.freeAimX = 0;
    this.freeAimY = 0;
    this.freeExtension = 0;
  }

  reset() {
    const equipped = this.isEquipped();
    this.cancel('reset');
    this.rejectedRepeatContactCount = 0;
    this.maximumObservedSweepSampleCount = 0;
    this.initializePose();
    this.visual.visible = equipped;
  }

  getDiagnostics() {
    const record = this.lastBluntImpactRecord;
    const projectedGrip = this.isEquipped() ? this.projectGrip() : null;
    return {
      itemId: this.config.itemId,
      equipped: this.isEquipped(),
      maceEquipped: this.isEquipped(),
      state: this.state,
      gestureState: this.state,
      freeAimX: Number(this.freeAimX.toFixed(4)),
      freeAimY: Number(this.freeAimY.toFixed(4)),
      freeExtension: Number(this.freeExtension.toFixed(4)),
      loadOverlayProgress: Number(this.loadEnergy.toFixed(4)),
      lastStateTransition: this.lastStateTransition,
      lastTransitionPositionJump: Number(this.lastTransitionPositionJump.toFixed(6)),
      lastTransitionRotationJumpDegrees: Number(this.lastTransitionRotationJumpDegrees.toFixed(4)),
      loadProgress: Number(this.loadProgress.toFixed(4)),
      maximumLoadProgress: Number(this.maximumLoadProgress.toFixed(4)),
      accumulatedUpwardTravel: Number(this.accumulatedUpwardTravel.toFixed(4)),
      upwardHeadSpeed: Number(this.upwardHeadSpeed.toFixed(4)),
      loadCompletionTime: this.loadCompletedAt,
      downwardCommitSpeed: Number(this.downwardHeadSpeed.toFixed(4)),
      downwardCommitTravel: Number(this.accumulatedDownwardTravel.toFixed(4)),
      currentSwingId: this.activeStrikeId,
      swingPower: Number(this.swingPower.toFixed(4)),
      swingCommitCount: this.swingCommitCount,
      primitiveThatContacted: this.lastContactPrimitive,
      resolvedActorId: this.resolvedActorId,
      contactClassification: this.lastContactClassification,
      normalImpactSpeed: Number(this.lastNormalImpactSpeed.toFixed(4)),
      effectiveMass: Number(this.lastEffectiveMass.toFixed(4)),
      estimatedImpulse: Number(this.lastEstimatedImpulse.toFixed(4)),
      estimatedEnergy: Number(this.lastEstimatedEnergy.toFixed(4)),
      impactPoint: this.lastImpactPoint?.toArray?.().map((value) => Number(value.toFixed(4))) ?? null,
      impactRegion: this.lastImpactRegion,
      actorDamageApplied: Number((record?.actorDamageApplied ?? 0).toFixed(4)),
      reactionEmitted: record?.reactionEmitted === true,
      collapseRequested: record?.collapseRequested === true,
      feedbackCount: this.feedbackCount,
      rejectedRepeatContactCount: this.rejectedRepeatContactCount,
      sweepSampleCount: this.lastSweepSampleCount,
      maximumSweepSampleCount: DREADMACE_MAX_SWEEP_SAMPLE_COUNT,
      maximumObservedSweepSampleCount: this.maximumObservedSweepSampleCount,
      gripPointerOwner: this.gripPointerId,
      headCenterVelocity: this.headCenterVelocity.toArray().map((value) => Number(value.toFixed(4))),
      visualAssetState: this.visualAssetState,
      assetPath: DREADMACE_GLB_PATH,
      dimensions: DREADMACE_DIMENSIONS,
      assetCorrection: DREADMACE_ASSET_CORRECTION,
      contactPrimitives: DREADMACE_CONTACT_PRIMITIVES,
      currentRenderLayer: getWeaponRenderLayer(this.visual),
      worldLightIntersectionStatus: getWeaponWorldLightIntersectionStatus(this.visual, this.scene),
      outdoorMaterialRegistrationStatus: this.outdoorMaterialRegistration.status,
      weaponPresentation: this.getWeaponPresentationDiagnostics(),
      maceDirectControl: {
        state: this.state,
        pointerOwned: this.gripPointerId != null,
        localGrip: this.localGrip.toArray().map((value) => Number(value.toFixed(6))),
        targetLocalGrip: this.targetLocalGrip.toArray().map((value) => Number(value.toFixed(6))),
        positionTrackingError: Number(this.positionTrackingError.toFixed(6)),
        rotationTrackingErrorDegrees: Number(this.rotationTrackingErrorDegrees.toFixed(4)),
        headVelocity: this.headCenterVelocity.toArray().map((value) => Number(value.toFixed(4))),
        upwardHeadSpeed: Number(this.upwardHeadSpeed.toFixed(4)),
        downwardHeadSpeed: Number(this.downwardHeadSpeed.toFixed(4)),
        accumulatedUpwardTravel: Number(this.accumulatedUpwardTravel.toFixed(4)),
        accumulatedDownwardTravel: Number(this.accumulatedDownwardTravel.toFixed(4)),
        loadEnergy: Number(this.loadEnergy.toFixed(4)),
        loadEnergyAge: Number(this.loadEnergyAge.toFixed(4)),
        activeStrikeId: this.activeStrikeId,
        strikeQualified: this.strikeQualified,
        strikeResolvedActorIds: [...this.resolvedActors].slice(0, this.config.maximumTargetsPerStrike),
        lastImpactClassification: this.lastContactClassification,
        lastImpactEnergy: Number(this.lastEstimatedEnergy.toFixed(4)),
        resistanceActive: this.state === MACE_GESTURE_STATES.impactResistance,
        visualPhysicalHeadError: Number(this.visualPhysicalHeadError.toFixed(6)),
        hammerPhase: this.hammerPhase,
        hammerRaiseProgress: Number(this.hammerRaiseProgress.toFixed(4)),
        hammerDownstrokeProgress: Number(this.hammerDownstrokeProgress.toFixed(4)),
        hammerPitchRadians: Number(this.hammerPitch.toFixed(4)),
        hammerPitchDegrees: Number(THREE.MathUtils.radToDeg(this.hammerPitch).toFixed(2)),
        hammerPitchTargetRadians: Number(this.hammerPitchTarget.toFixed(4)),
        hammerPeakPitchDegrees: Number(THREE.MathUtils.radToDeg(this.hammerPeakPitch).toFixed(2)),
        hammerRaiseTravel: Number(this.hammerRaiseTravel.toFixed(4)),
        hammerDownstrokeTravel: Number(this.hammerDownstrokeTravel.toFixed(4)),
        hammerUpwardGripSpeed: Number(this.hammerUpwardGripSpeed.toFixed(4)),
        hammerDownwardGripSpeed: Number(this.hammerDownwardGripSpeed.toFixed(4)),
        readyPitchDegrees: Number(THREE.MathUtils.radToDeg(this.config.hammerOrientation.restPitch).toFixed(2)),
        topPitchDegrees: Number(THREE.MathUtils.radToDeg(this.config.hammerOrientation.topPitch).toFixed(2)),
        impactPitchDegrees: Number(THREE.MathUtils.radToDeg(this.config.hammerOrientation.impactPitch).toFixed(2)),
        projectedGrabSegmentStart: projectedGrip?.segmentStart ?? null,
        projectedGrabSegmentEnd: projectedGrip?.segmentEnd ?? null,
        projectedGrabRadius: projectedGrip?.radius ?? 0,
        lastGrabDistanceToHandle: this.lastGrabDistanceToHandle == null ? null : Number(this.lastGrabDistanceToHandle.toFixed(2)),
        lastGrabAccepted: this.lastGrabAccepted,
      },
      completedBluntImpact: record ? {
        schema: record.schema,
        interactionId: record.interactionId,
        primitive: record.primitive,
        actorId: record.actorId,
        bodyId: record.bodyId,
        regionId: record.regionId,
        worldPoint: record.worldPoint.toArray(),
        worldNormal: record.worldNormal.toArray(),
        impactDirection: record.impactDirection.toArray(),
        headCenterVelocity: record.headCenterVelocity.toArray(),
        contactCenterVelocity: record.contactCenterVelocity.toArray(),
        normalImpactSpeed: record.normalImpactSpeed,
        tangentialSpeed: record.tangentialSpeed,
        effectiveMass: record.effectiveMass,
        estimatedImpulse: record.estimatedImpulse,
        estimatedEnergy: record.estimatedEnergy,
        loadProgress: record.loadProgress,
        gesturePower: record.gesturePower,
        impactRadiusEstimate: record.impactRadiusEstimate,
        startedAt: record.startedAt,
        completedAt: record.completedAt,
        classification: record.classification,
        actorDamageApplied: record.actorDamageApplied,
        reactionEmitted: record.reactionEmitted,
        collapseRequested: record.collapseRequested,
        deformationApplied: false,
        detachmentApplied: false,
      } : null,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.cancel('disposed');
    this.disposed = true;
    this.disposers.forEach((dispose) => dispose?.());
    this.disposers = [];
    this.unregisterOutdoorMaterials();
    this.debugRoot?.traverse?.((object) => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
    this.debugRoot?.removeFromParent?.();
    if (this.ownsCombatDirector) this.combatDirector.dispose();
    disposeOwnedWeaponVisual({ root: this.visual, geometries: this.visualGeometries, materials: this.visualMaterials });
  }
}
