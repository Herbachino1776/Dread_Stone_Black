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
  loading: 'loading',
  loaded: 'loaded',
  smashing: 'smashing',
  impactRecoil: 'impact_recoil',
  followThrough: 'follow_through',
  returning: 'returning',
});

export const DREADMACE_GESTURE_THRESHOLDS = Object.freeze({
  loadStartDistance: 0.025,
  fullLoadDistance: 0.085,
  minimumQualifiedUpwardSpeed: 0.12,
  fullQualifiedUpwardSpeed: 0.32,
  minimumCommitLoad: 0.7,
  minimumDownwardCommitTravel: 0.018,
  minimumDownwardCommitSpeed: 0.28,
  minimumDamagingHeadSpeed: 0.52,
});

export const DREADMACE_WORLD_WEAPON_CONFIG = Object.freeze({
  itemId: 'dreadstone_mace',
  gripZone: Object.freeze({ minimumRadiusPx: 42, maximumRadiusPx: 78, viewportRatio: 0.09 }),
  workspace: Object.freeze({
    ready: Object.freeze([0.29, -0.34, -0.58]),
    min: Object.freeze([-0.18, -0.48, -0.95]),
    max: Object.freeze([0.5, 0.3, -0.38]),
    lateralSensitivity: 0.004,
    verticalSensitivity: 0.004,
    thrustSensitivity: 0.002,
    lateralReach: 0.2,
    verticalReach: 0.36,
    thrustDistance: 0.34,
  }),
  loadedGrip: Object.freeze([0.18, 0.12, -0.49]),
  loadedEuler: Object.freeze([1.05, -0.08, 0.08]),
  finishGrip: Object.freeze([0.2, -0.3, -0.75]),
  finishEuler: Object.freeze([-0.45, 0.08, -0.08]),
  swingDuration: Object.freeze({ minimum: 0.18, maximum: 0.28 }),
  recoilDuration: Object.freeze({ minimum: 0.07, maximum: 0.13 }),
  followThroughDuration: 0.095,
  returnDuration: 0.29,
});

const MACE_RENDER_ORDER = 10027;
const EPSILON = 1e-6;
const identityQuaternion = new THREE.Quaternion();
const readyGrip = new THREE.Vector3().fromArray(DREADMACE_WORLD_WEAPON_CONFIG.workspace.ready);
const loadedGrip = new THREE.Vector3().fromArray(DREADMACE_WORLD_WEAPON_CONFIG.loadedGrip);
const finishGrip = new THREE.Vector3().fromArray(DREADMACE_WORLD_WEAPON_CONFIG.finishGrip);
const loadedQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...DREADMACE_WORLD_WEAPON_CONFIG.loadedEuler, 'YXZ'));
const finishQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...DREADMACE_WORLD_WEAPON_CONFIG.finishEuler, 'YXZ'));
const heldLoadOffset = new THREE.Vector3().subVectors(loadedGrip, readyGrip);
const heldFreeEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const heldFreeRotation = new THREE.Quaternion();
const heldLoadRotation = new THREE.Quaternion();
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
  const travel = THREE.MathUtils.clamp(downwardTravel / 0.075, 0, 1);
  const mass = THREE.MathUtils.clamp(effectiveMass / DREADMACE_CONTACT_PRIMITIVES.mace_head.effectiveMass, 0, 1);
  return THREE.MathUtils.clamp(load * 0.5 + speed * 0.3 + travel * 0.15 + mass * 0.05, 0, 1);
}

export function sampleDreadmaceSmashArc(progress, power = 1, target = {}) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const eased = smoothstep(t);
  const arc = Math.sin(Math.PI * t);
  const grip = target.grip ?? new THREE.Vector3();
  const quaternion = target.quaternion ?? new THREE.Quaternion();
  const startGrip = target.startGrip ?? loadedGrip;
  const startQuaternion = target.startQuaternion ?? loadedQuaternion;
  grip.copy(startGrip).lerp(finishGrip, eased);
  grip.y += arc * (0.035 + power * 0.02);
  grip.z -= arc * (0.055 + power * 0.04);
  quaternion.slerpQuaternions(startQuaternion, finishQuaternion, eased).normalize();
  const head = target.head ?? new THREE.Vector3();
  head.fromArray(DREADMACE_DIMENSIONS.headCenter).applyQuaternion(quaternion).add(grip);
  return { grip, quaternion, head, progress: t, easedProgress: eased };
}

export function sampleDreadmaceHeldPose({ baselineGrip = readyGrip, baselineQuaternion = identityQuaternion, freeAimX = 0, freeAimY = 0, freeExtension = 0, loadProgress = 0 } = {}, grip = new THREE.Vector3(), quaternion = new THREE.Quaternion()) {
  const t = smoothstep(loadProgress);
  grip.copy(baselineGrip);
  grip.x += THREE.MathUtils.clamp(freeAimX, -1, 1) * 0.18;
  grip.y += THREE.MathUtils.clamp(freeAimY, -1, 1) * 0.11;
  grip.z -= THREE.MathUtils.clamp(freeExtension, 0, DREADMACE_WORLD_WEAPON_CONFIG.workspace.thrustDistance) * 0.32;
  grip.addScaledVector(heldLoadOffset, t);
  grip.x = THREE.MathUtils.clamp(grip.x, DREADMACE_WORLD_WEAPON_CONFIG.workspace.min[0], DREADMACE_WORLD_WEAPON_CONFIG.workspace.max[0]);
  grip.y = THREE.MathUtils.clamp(grip.y, DREADMACE_WORLD_WEAPON_CONFIG.workspace.min[1], DREADMACE_WORLD_WEAPON_CONFIG.workspace.max[1]);
  grip.z = THREE.MathUtils.clamp(grip.z, DREADMACE_WORLD_WEAPON_CONFIG.workspace.min[2], DREADMACE_WORLD_WEAPON_CONFIG.workspace.max[2]);
  heldFreeRotation.setFromEuler(heldFreeEuler.set(
    THREE.MathUtils.clamp(freeAimY, -1, 1) * 0.1,
    THREE.MathUtils.clamp(freeAimX, -1, 1) * -0.18,
    THREE.MathUtils.clamp(freeAimX, -1, 1) * -0.14,
    'YXZ',
  ));
  heldLoadRotation.slerpQuaternions(identityQuaternion, loadedQuaternion, t);
  quaternion.copy(baselineQuaternion).multiply(heldFreeRotation).multiply(heldLoadRotation).normalize();
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
    this.localQuaternion = new THREE.Quaternion();
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
    this.gripVelocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.localHeadOffset = new THREE.Vector3().fromArray(DREADMACE_DIMENSIONS.headCenter);
    this.state = MACE_GESTURE_STATES.ready;
    this.elapsed = 0;
    this.lastPhysicsDt = 1 / 60;
    this.loadProgress = 0;
    this.maximumLoadProgress = 0;
    this.normalizedUpwardLoadDistance = 0;
    this.maximumUpwardGestureSpeed = 0;
    this.downwardCommitSpeed = 0;
    this.downwardCommitTravel = 0;
    this.minimumGestureClientY = 0;
    this.loadCompletedAt = null;
    this.swingSerial = 0;
    this.currentSwingId = null;
    this.swingOwnerId = null;
    this.swingPower = 0;
    this.strikeDuration = 0;
    this.swingElapsed = 0;
    this.swingProgress = 0;
    this.swingStartGrip = new THREE.Vector3();
    this.swingStartQuaternion = new THREE.Quaternion();
    this.swingStartHead = new THREE.Vector3();
    this.swingJustCommitted = false;
    this.swingCommitCount = 0;
    this.resolvedActors = new Set();
    this.activeBluntInteractions = new Map();
    this.resolvedActorId = null;
    this.returnElapsed = 0;
    this.returnStartGrip = new THREE.Vector3();
    this.returnStartQuaternion = new THREE.Quaternion();
    this.phaseElapsed = 0;
    this.phaseStartGrip = new THREE.Vector3();
    this.phaseStartQuaternion = new THREE.Quaternion();
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
    this.outdoorMaterialRegistration = { status: outdoorLightingDirector ? 'pending' : 'unavailable', registered: false, eligibleMaterialCount: 0 };
    this.colliderFilter = (collider) => this.weaponContactRouter.ownsCollider(collider);
    this.sweepScratch = {
      grip0: new THREE.Vector3(), grip1: new THREE.Vector3(),
      quaternion0: new THREE.Quaternion(), quaternion1: new THREE.Quaternion(),
      point0: new THREE.Vector3(), point1: new THREE.Vector3(), localPoint: new THREE.Vector3(),
      deltaQuaternion: new THREE.Quaternion(), axis: new THREE.Vector3(), offset: new THREE.Vector3(), cross: new THREE.Vector3(),
      actorVelocity: new THREE.Vector3(), primitiveVelocity: new THREE.Vector3(), normal: new THREE.Vector3(), point: new THREE.Vector3(), bodyCenter: new THREE.Vector3(),
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
    this.localQuaternion.identity();
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
    if (!this.isEquipped() || ![MACE_GESTURE_STATES.ready, MACE_GESTURE_STATES.loading, MACE_GESTURE_STATES.loaded].includes(this.state) || !this.gestureOwnership.acquire(pointerId, clientX, clientY, timeMs)) return false;
    this.minimumGestureClientY = clientY;
    this.gestureBaselineGrip.copy(this.localGrip);
    this.gestureBaselineQuaternion.copy(this.localQuaternion);
    this.freeAimX = 0;
    this.freeAimY = 0;
    this.freeExtension = 0;
    this.normalizedUpwardLoadDistance = 0;
    this.maximumUpwardGestureSpeed = 0;
    this.downwardCommitSpeed = 0;
    this.downwardCommitTravel = 0;
    this.loadProgress = 0;
    this.maximumLoadProgress = 0;
    this.loadCompletedAt = null;
    return true;
  }

  applyGripGesture(pointerId, deltaX, deltaY, clientX, clientY, timeMs = performance.now()) {
    if (pointerId !== this.gripPointerId || ![MACE_GESTURE_STATES.ready, MACE_GESTURE_STATES.loading, MACE_GESTURE_STATES.loaded].includes(this.state)) return false;
    const rect = this.viewport?.getBoundingClientRect?.() ?? { width: 1, height: 1 };
    const viewportHeight = Math.max(1, rect.height || 1);
    const previousY = this.gestureOwnership.lastPoint.y;
    const previousTime = this.gestureOwnership.lastTimeMs;
    const rawDt = THREE.MathUtils.clamp((timeMs - previousTime) / 1000 || 1 / 60, 0.008, 0.35);
    const stepY = clientY - previousY;
    const sample = this.gestureOwnership.update(pointerId, deltaX, deltaY, clientX, clientY, timeMs, this.freeExtension);
    if (!sample) return false;
    this.freeAimX = sample.aimX;
    this.freeAimY = sample.aimY;
    this.freeExtension = sample.extension;
    const normalizedUpwardSpeed = Math.max(0, -stepY / viewportHeight / rawDt);
    this.maximumUpwardGestureSpeed = Math.max(this.maximumUpwardGestureSpeed, normalizedUpwardSpeed);
    this.minimumGestureClientY = Math.min(this.minimumGestureClientY, clientY);
    this.normalizedUpwardLoadDistance = Math.max(this.normalizedUpwardLoadDistance, (this.gestureOwnership.startPoint.y - this.minimumGestureClientY) / viewportHeight);
    const distanceProgress = THREE.MathUtils.clamp(
      (this.normalizedUpwardLoadDistance - DREADMACE_GESTURE_THRESHOLDS.loadStartDistance)
      / (DREADMACE_GESTURE_THRESHOLDS.fullLoadDistance - DREADMACE_GESTURE_THRESHOLDS.loadStartDistance),
      0,
      1,
    );
    const speedQualification = THREE.MathUtils.clamp(
      (this.maximumUpwardGestureSpeed - DREADMACE_GESTURE_THRESHOLDS.minimumQualifiedUpwardSpeed)
      / (DREADMACE_GESTURE_THRESHOLDS.fullQualifiedUpwardSpeed - DREADMACE_GESTURE_THRESHOLDS.minimumQualifiedUpwardSpeed),
      0,
      1,
    );
    this.loadProgress = distanceProgress * speedQualification;
    this.maximumLoadProgress = Math.max(this.maximumLoadProgress, this.loadProgress);
    if (this.normalizedUpwardLoadDistance >= DREADMACE_GESTURE_THRESHOLDS.loadStartDistance && speedQualification > 0) this.transitionState(MACE_GESTURE_STATES.loading);
    if (this.loadProgress >= 0.98) {
      this.transitionState(MACE_GESTURE_STATES.loaded);
      this.loadCompletedAt ??= this.elapsed;
    }
    const downwardSpeed = Math.max(0, stepY / viewportHeight / rawDt);
    const downwardTravel = Math.max(0, (clientY - this.minimumGestureClientY) / viewportHeight);
    this.downwardCommitSpeed = Math.max(this.downwardCommitSpeed, downwardSpeed);
    this.downwardCommitTravel = Math.max(this.downwardCommitTravel, downwardTravel);
    if (this.maximumLoadProgress >= DREADMACE_GESTURE_THRESHOLDS.minimumCommitLoad
      && downwardSpeed >= DREADMACE_GESTURE_THRESHOLDS.minimumDownwardCommitSpeed
      && downwardTravel >= DREADMACE_GESTURE_THRESHOLDS.minimumDownwardCommitTravel) {
      this.commitSmash({ loadProgress: this.maximumLoadProgress, downwardSpeed, downwardTravel });
    }
    return true;
  }

  commitSmash({ loadProgress = this.maximumLoadProgress, downwardSpeed = this.downwardCommitSpeed, downwardTravel = this.downwardCommitTravel } = {}) {
    if (![MACE_GESTURE_STATES.loading, MACE_GESTURE_STATES.loaded].includes(this.state)
      || loadProgress < DREADMACE_GESTURE_THRESHOLDS.minimumCommitLoad
      || downwardSpeed < DREADMACE_GESTURE_THRESHOLDS.minimumDownwardCommitSpeed
      || downwardTravel < DREADMACE_GESTURE_THRESHOLDS.minimumDownwardCommitTravel) return false;
    this.swingPower = computeDreadmaceGesturePower({ loadProgress, downwardSpeed, downwardTravel });
    this.strikeDuration = THREE.MathUtils.lerp(this.config.swingDuration.maximum, this.config.swingDuration.minimum, this.swingPower);
    this.swingElapsed = 0;
    this.swingProgress = 0;
    this.swingSerial += 1;
    this.currentSwingId = `dreadmace-swing-${this.swingSerial}`;
    this.swingOwnerId = this.gripPointerId ?? this.currentSwingId;
    this.swingCommitCount += 1;
    this.resolvedActors.clear();
    this.resolvedActorId = null;
    this.feedbackCount = 0;
    this.lastContactPrimitive = null;
    this.lastContactClassification = null;
    this.lastBluntImpactRecord = null;
    // The displayed local pose is the commitment boundary. Pointer data that
    // arrived after the last rendered frame must not replace it with a fresh
    // canonical loaded pose before the solver takes ownership.
    this.swingStartGrip.copy(this.localGrip);
    this.swingStartQuaternion.copy(this.localQuaternion);
    this.swingStartHead.copy(this.localHeadOffset).applyQuaternion(this.swingStartQuaternion).add(this.swingStartGrip);
    this.swingJustCommitted = true;
    this.transitionState(MACE_GESTURE_STATES.smashing);
    return true;
  }

  releaseGrip(reason = 'pointer-release') {
    if (this.gripPointerId == null) return;
    this.gestureOwnership.release();
    if ([MACE_GESTURE_STATES.smashing, MACE_GESTURE_STATES.impactRecoil, MACE_GESTURE_STATES.followThrough].includes(this.state)) return;
    if (this.state !== MACE_GESTURE_STATES.returning) this.beginReturn(reason);
  }

  beginReturn(_reason = 'safe-return') {
    this.returnElapsed = 0;
    this.returnStartGrip.copy(this.localGrip);
    this.returnStartQuaternion.copy(this.localQuaternion);
    this.transitionState(MACE_GESTURE_STATES.returning);
  }

  beginFollowThrough() {
    this.phaseElapsed = 0;
    this.phaseStartGrip.copy(this.localGrip);
    this.phaseStartQuaternion.copy(this.localQuaternion);
    this.transitionState(MACE_GESTURE_STATES.followThrough);
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
    if (this.state === MACE_GESTURE_STATES.ready) {
      if (this.gripPointerId != null) sampleDreadmaceHeldPose({ baselineGrip: this.gestureBaselineGrip, baselineQuaternion: this.gestureBaselineQuaternion, freeAimX: this.freeAimX, freeAimY: this.freeAimY, freeExtension: this.freeExtension, loadProgress: 0 }, this.localGrip, this.localQuaternion);
      else {
        this.localGrip.fromArray(this.config.workspace.ready);
        this.localQuaternion.identity();
      }
      return;
    }
    if ([MACE_GESTURE_STATES.loading, MACE_GESTURE_STATES.loaded].includes(this.state)) {
      sampleDreadmaceHeldPose({ baselineGrip: this.gestureBaselineGrip, baselineQuaternion: this.gestureBaselineQuaternion, freeAimX: this.freeAimX, freeAimY: this.freeAimY, freeExtension: this.freeExtension, loadProgress: this.maximumLoadProgress }, this.localGrip, this.localQuaternion);
      return;
    }
    if (this.state === MACE_GESTURE_STATES.smashing) {
      let sampledProgress;
      if (this.swingJustCommitted) {
        this.swingJustCommitted = false;
        this.swingElapsed += Math.min(dt, 0.003);
        sampledProgress = 0;
      } else this.swingElapsed += dt;
      this.swingProgress = THREE.MathUtils.clamp(this.swingElapsed / Math.max(EPSILON, this.strikeDuration), 0, 1);
      sampleDreadmaceSmashArc(sampledProgress ?? this.swingProgress, this.swingPower, { grip: this.localGrip, quaternion: this.localQuaternion, head: this.contactScratch.point, startGrip: this.swingStartGrip, startQuaternion: this.swingStartQuaternion });
      if ((sampledProgress ?? this.swingProgress) >= 1) this.beginFollowThrough();
      return;
    }
    if (this.state === MACE_GESTURE_STATES.impactRecoil) {
      this.phaseElapsed += dt;
      const energyResponse = THREE.MathUtils.clamp(this.impactEnergy / 100, 0, 1);
      const resistanceResponse = THREE.MathUtils.clamp((this.impactResistance - 0.35) / 1.95, 0, 1);
      const response = THREE.MathUtils.clamp(this.impactResponseStrength * (0.7 + resistanceResponse * 0.3), 0, 1);
      const duration = THREE.MathUtils.lerp(this.config.recoilDuration.minimum, this.config.recoilDuration.maximum, Math.max(energyResponse * 0.7, response));
      const t = THREE.MathUtils.clamp(this.phaseElapsed / duration, 0, 1);
      const pulse = Math.sin(Math.PI * t);
      this.localGrip.copy(this.phaseStartGrip);
      this.localGrip.y += 0.025 * response * pulse;
      this.localGrip.z += 0.045 * response * pulse;
      this.localQuaternion.copy(this.phaseStartQuaternion).multiply(this.sweepScratch.quaternion0.setFromAxisAngle(this.sweepScratch.axis.set(1, 0, 0), 0.11 * response * pulse)).normalize();
      if (t >= 1) this.beginFollowThrough();
      return;
    }
    if (this.state === MACE_GESTURE_STATES.followThrough) {
      this.phaseElapsed += dt;
      const t = smoothstep(this.phaseElapsed / this.config.followThroughDuration);
      const followGrip = this.contactScratch.point.fromArray(this.config.finishGrip);
      followGrip.add(this.contactScratch.correction.set(0.015, -0.055, -0.035));
      const followQuaternion = this.contactScratch.inverseQuaternion.setFromEuler(this.poseWorkspace.localEuler.set(-0.58, 0.1, -0.1, 'YXZ'));
      this.localGrip.copy(this.phaseStartGrip).lerp(followGrip, t);
      this.localQuaternion.slerpQuaternions(this.phaseStartQuaternion, followQuaternion, t).normalize();
      if (this.phaseElapsed >= this.config.followThroughDuration) this.beginReturn('follow-through-complete');
      return;
    }
    if (this.state === MACE_GESTURE_STATES.returning) {
      this.returnElapsed += dt;
      const t = criticallyDampedMaceReturnProgress(this.returnElapsed, this.config.returnDuration);
      this.localGrip.copy(this.returnStartGrip).lerp(this.contactScratch.point.fromArray(this.config.workspace.ready), t);
      this.localQuaternion.slerpQuaternions(this.returnStartQuaternion, identityQuaternion, t).normalize();
      if (this.returnElapsed >= this.config.returnDuration) {
        this.transitionState(MACE_GESTURE_STATES.ready);
        this.localGrip.fromArray(this.config.workspace.ready);
        this.localQuaternion.identity();
        this.swingOwnerId = null;
        this.loadProgress = 0;
        this.maximumLoadProgress = 0;
        this.freeAimX = 0;
        this.freeAimY = 0;
        this.freeExtension = 0;
      }
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
    if (this.state === MACE_GESTURE_STATES.smashing && (this.contactActivationProvider?.() ?? true)) this.resolveSmashContact();
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
    if (!this.physics || this.headCenterVelocity.length() < DREADMACE_GESTURE_THRESHOLDS.minimumDamagingHeadSpeed) return false;
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
      loadProgress: this.maximumLoadProgress,
      gesturePower: this.swingPower,
    });
    this.lastContactPrimitive = candidate.name;
    this.lastContactClassification = metrics.classification;
    this.lastNormalImpactSpeed = metrics.normalImpactSpeed;
    this.lastEffectiveMass = metrics.effectiveMass;
    this.lastEstimatedImpulse = metrics.estimatedImpulse;
    this.lastEstimatedEnergy = metrics.estimatedEnergy;
    this.lastImpactPoint = candidate.point.clone();
    this.lastImpactRegion = routed.hit.regionId;
    this.impactEnergy = metrics.estimatedEnergy;
    this.impactResistance = THREE.MathUtils.clamp(routed.hit.region?.hardStructureResistance ?? routed.hit.region?.softTissueResistance ?? 1, 0.35, 2.3);
    this.impactResponseStrength = metrics.classification === BLUNT_IMPACT_CLASSIFICATIONS.heavySmash
      ? 1
      : metrics.classification === BLUNT_IMPACT_CLASSIFICATIONS.committedBlunt
        ? 0.72
        : metrics.classification === BLUNT_IMPACT_CLASSIFICATIONS.haftContact
          ? 0.34
          : metrics.classification === BLUNT_IMPACT_CLASSIFICATIONS.nonDamagingContact ? 0.14 : 0.2;
    if (metrics.classification === BLUNT_IMPACT_CLASSIFICATIONS.nonDamagingContact) {
      this.lastBluntImpactRecord = createBluntImpactInteraction({
        interactionId: `${this.currentSwingId}:non-damaging`, weaponId: this.config.itemId, weaponFamily: 'mace', primitive: candidate.name,
        actorId, bodyId: routed.hit.bodyId, regionId: routed.hit.regionId, worldPoint: candidate.point, worldNormal: normal,
        impactDirection: metrics.impactDirection, headCenterVelocity: this.headCenterVelocity, contactCenterVelocity: metrics.contactCenterVelocity, actorRelativeVelocity: metrics.actorRelativeVelocity,
        normalImpactSpeed: metrics.normalImpactSpeed, tangentialSpeed: metrics.tangentialSpeed, effectiveMass: metrics.effectiveMass,
        estimatedImpulse: metrics.estimatedImpulse, estimatedEnergy: metrics.estimatedEnergy, loadProgress: this.maximumLoadProgress,
        gesturePower: this.swingPower, impactRadiusEstimate: candidate.primitive.impactRadiusEstimate, classification: metrics.classification, startedAt: this.elapsed,
      });
    } else {
      const intent = Object.freeze({ weaponId: this.config.itemId, intent: MELEE_INTENTS.smash, ownerId: this.swingOwnerId ?? this.currentSwingId, speed: primitiveVelocity.length(), intentional: true, damaging: true, reason: 'owned-loaded-downward-smash' });
      const interaction = routed.director?.resolveBluntImpact?.({
        weapon: this.weaponDefinition, intent, hit: routed.hit, primitive: candidate.name, worldPoint: candidate.point, worldNormal: normal,
        impactDirection: metrics.impactDirection, headCenterVelocity: this.headCenterVelocity, contactCenterVelocity: metrics.contactCenterVelocity, actorRelativeVelocity: metrics.actorRelativeVelocity,
        normalImpactSpeed: metrics.normalImpactSpeed, tangentialSpeed: metrics.tangentialSpeed, effectiveMass: metrics.effectiveMass,
        estimatedImpulse: metrics.estimatedImpulse, estimatedEnergy: metrics.estimatedEnergy, loadProgress: this.maximumLoadProgress,
        gesturePower: this.swingPower, impactRadiusEstimate: candidate.primitive.impactRadiusEstimate, classification: metrics.classification, weaponAdapter: this,
      });
      if (interaction) {
        this.activeBluntInteractions.set(interaction.id, routed.director);
        this.resolvedActors.add(actorId);
        this.resolvedActorId = actorId;
        this.lastBluntImpactRecord = interaction.result.bluntImpact;
        this.feedbackCount += 1;
      }
    }
    this.phaseElapsed = 0;
    this.phaseStartGrip.copy(this.localGrip);
    this.phaseStartQuaternion.copy(this.localQuaternion);
    this.transitionState(metrics.classification === BLUNT_IMPACT_CLASSIFICATIONS.glancingBlunt ? MACE_GESTURE_STATES.followThrough : MACE_GESTURE_STATES.impactRecoil);
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
    this.debugHead.position.copy(this.currentHeadCenter);
  }

  afterPhysics(_alpha = 1, frameDelta = this.lastPhysicsDt) { this.syncVisual(frameDelta); }
  afterPhysicsStep() {}
  onCombatResistance() {}
  onCombatRecovery(_payload, interaction) { if (interaction?.id) this.activeBluntInteractions.delete(interaction.id); }

  cancelTarget(actor, reason = 'target-cancelled') {
    const actorId = actor?.instanceId ?? actor?.id;
    if (!actorId || this.resolvedActorId !== actorId) return false;
    this.beginReturn(reason);
    return true;
  }

  getActiveToolId() { return this.isEquipped() ? this.config.itemId : null; }
  getWeaponPresentationDiagnostics() { return this.presentation.getDiagnostics({ equippedItemId: this.isEquipped() ? this.config.itemId : null }); }

  projectGrip() {
    if (!this.camera || !this.viewport) return null;
    const projected = this.actualGrip.clone().project(this.camera);
    const rect = this.viewport.getBoundingClientRect();
    const radius = Math.max(this.config.gripZone.minimumRadiusPx, Math.min(this.config.gripZone.maximumRadiusPx, Math.min(rect.width, rect.height) * this.config.gripZone.viewportRatio));
    return { x: rect.left + (projected.x * 0.5 + 0.5) * rect.width, y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height, radius, toolId: this.config.itemId, kind: 'grip-input-capture' };
  }

  getProjectedGrabPoint(viewport = this.viewport) { return this.getProjectedGripZone(viewport); }
  getProjectedGripZone(viewport = this.viewport) { if (viewport !== this.viewport) this.viewport = viewport; return this.isEquipped() ? this.projectGrip() : null; }
  projectGrabHit(clientX, clientY, viewport = this.viewport) { const grip = this.getProjectedGripZone(viewport); return Boolean(grip && Math.hypot(clientX - grip.x, clientY - grip.y) <= grip.radius); }

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
    this.loadProgress = 0;
    this.maximumLoadProgress = 0;
    this.normalizedUpwardLoadDistance = 0;
    this.maximumUpwardGestureSpeed = 0;
    this.downwardCommitSpeed = 0;
    this.downwardCommitTravel = 0;
    this.loadCompletedAt = null;
    this.swingOwnerId = null;
    this.swingElapsed = 0;
    this.swingProgress = 0;
    this.phaseElapsed = 0;
    this.returnElapsed = 0;
    this.resolvedActors.clear();
    this.resolvedActorId = null;
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
    this.localQuaternion.identity();
    this.freeAimX = 0;
    this.freeAimY = 0;
    this.freeExtension = 0;
  }

  reset() {
    const equipped = this.isEquipped();
    this.cancel('reset');
    this.currentSwingId = null;
    this.rejectedRepeatContactCount = 0;
    this.maximumObservedSweepSampleCount = 0;
    this.initializePose();
    this.visual.visible = equipped;
  }

  getDiagnostics() {
    const record = this.lastBluntImpactRecord;
    return {
      itemId: this.config.itemId,
      equipped: this.isEquipped(),
      maceEquipped: this.isEquipped(),
      state: this.state,
      gestureState: this.state,
      freeAimX: Number(this.freeAimX.toFixed(4)),
      freeAimY: Number(this.freeAimY.toFixed(4)),
      freeExtension: Number(this.freeExtension.toFixed(4)),
      loadOverlayProgress: Number(this.maximumLoadProgress.toFixed(4)),
      lastStateTransition: this.lastStateTransition,
      lastTransitionPositionJump: Number(this.lastTransitionPositionJump.toFixed(6)),
      lastTransitionRotationJumpDegrees: Number(this.lastTransitionRotationJumpDegrees.toFixed(4)),
      loadProgress: Number(this.loadProgress.toFixed(4)),
      maximumLoadProgress: Number(this.maximumLoadProgress.toFixed(4)),
      normalizedUpwardLoadDistance: Number(this.normalizedUpwardLoadDistance.toFixed(4)),
      maximumUpwardGestureSpeed: Number(this.maximumUpwardGestureSpeed.toFixed(4)),
      loadCompletionTime: this.loadCompletedAt,
      downwardCommitSpeed: Number(this.downwardCommitSpeed.toFixed(4)),
      downwardCommitTravel: Number(this.downwardCommitTravel.toFixed(4)),
      currentSwingId: this.currentSwingId,
      swingPower: Number(this.swingPower.toFixed(4)),
      swingProgress: Number(this.swingProgress.toFixed(4)),
      strikeDuration: Number(this.strikeDuration.toFixed(4)),
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
