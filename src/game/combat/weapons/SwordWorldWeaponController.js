import * as THREE from 'three';
import { CombatDirector } from '../CombatDirector.js';
import { deriveBladeTip } from '../CombatMath.js';
import { capturePhysicsBodyTransform, physicsBodyLocalDirectionToWorld, physicsBodyLocalToWorld, worldDirectionToPhysicsBodyLocal } from '../CombatCoordinateSpaces.js';
import { MELEE_INTENTS, MeleeIntentWeapon } from '../MeleeIntentWeapon.js';
import { sampleTissueResistanceCurve } from '../CombatPresentation.js';
import { createWeaponContactScratch, getRigidBodyWorldPosition } from './WeaponContactScratch.js';
import { WeaponContactRouter } from './WeaponContactRouter.js';
import { bindWeaponPointerEvents, DEFAULT_WEAPON_POINTER_BLOCK_SELECTOR, WeaponGestureOwnership } from './WeaponGestureOwnership.js';
import { computeCameraRelativeWeaponPose, createWeaponPoseWorkspace, initializeCameraRelativeWeaponPose, rebaseWorldWeaponPoseToCamera } from './WeaponPoseWorkspace.js';
import { createCuttingEdgePath, createSweptCuttingEdgeScratch, resolveCuttingEdgeSampleCount, sweepCuttingEdge } from './SweptCuttingEdge.js';
import { applyWeaponRenderLayer, captureWeaponMaterialLightingState, cloneOwnedWeaponVisual, createCachedWeaponGlbLoader, disposeOwnedWeaponVisual, getWeaponRenderLayer, getWeaponWorldLightIntersectionStatus, weaponMaterialLightingStateChanged } from './WeaponVisualAsset.js';
import { WEAPON_VIEWMODEL_LAYER, WEAPON_WORLD_LAYER } from './WeaponRenderLayers.js';
import { DREADSTONE_SWORD_PIERCING_AUDIO_PROFILE } from '../CombatAcceptedAudioSystem.js';
import { PenetrationAudioGate } from './PenetrationAudioGate.js';

export const DREADSTONE_SWORD_GLB_PATH = './assets/weapons/melee/dreadstone_sword_v002.glb';
export const SWORD_VIEWMODEL_LAYER = WEAPON_VIEWMODEL_LAYER;
export const SWORD_EDGE_BASE_SAMPLE_COUNT = 5;
export const SWORD_EDGE_MAX_SAMPLE_COUNT = 17;
export const SWORD_EDGE_COLLISION_RADIUS = 0.012;
export const SWORD_RUNTIME_COMBAT_MODE = 'puncture_only';
export const SWORD_THRUST_MIN_FORWARD_SPEED = 0.16;
export const SWORD_THRUST_MIN_FORWARD_RATIO = 0.55;
export const SWORD_THRUST_REARM_DISTANCE = 0.05;
export const SWORD_PENETRATION_RATE_METERS_PER_SECOND = 0.48;
export const SWORD_WITHDRAWAL_RATE_METERS_PER_SECOND = 0.62;
export const SWORD_RELEASE_EXTRACTION_DURATION = 0.15;

// Authored v002 measurements. Collision intentionally does not inspect render triangles.
export const DREADSTONE_SWORD_DIMENSIONS = Object.freeze({
  boundsMin: Object.freeze([-0.098054029, -0.019207124, -0.892469227]),
  boundsMax: Object.freeze([0.098054029, 0.019207124, 0.207401887]),
  overallLength: 1.099870,
  tipZ: -0.892469227,
  bladeHeelZ: -0.214,
  bladeShoulderZ: -0.70,
  bladeLength: 0.678469227,
  bladeWidth: 0.071,
  bladeThickness: 0.024,
  bladeHalfWidth: 0.0355,
  bladeHalfThickness: 0.012,
  guardCenterZ: -0.16,
  guardHalfSpan: 0.098054029,
  guardRadius: 0.019207124,
  gripMinZ: -0.10,
  gripMaxZ: 0.195,
  gripRadius: 0.019,
});

export const SWORD_MAXIMUM_PENETRATION_DEPTH =
  Math.abs(
    DREADSTONE_SWORD_DIMENSIONS.tipZ
    - (DREADSTONE_SWORD_DIMENSIONS.guardCenterZ - DREADSTONE_SWORD_DIMENSIONS.guardRadius),
  );

export const SWORD_IMPALEMENT_STATES = Object.freeze({
  ready: 'ready',
  attacking: 'attacking',
  surfaceContact: 'surface_contact',
  penetrating: 'penetrating',
  embedded: 'embedded',
  withdrawing: 'withdrawing',
  releaseWithdrawing: 'release_withdrawing',
  returning: 'returning',
});

export const SWORD_CONTACT_PRIMITIVES = Object.freeze({
  tip: Object.freeze({ kind: 'point', point: Object.freeze([0, 0, DREADSTONE_SWORD_DIMENSIONS.tipZ]), radius: 0.014 }),
  leftEdge: Object.freeze({ kind: 'cutting_edge', points: Object.freeze([Object.freeze([-0.035, 0, -0.214]), Object.freeze([-0.0355, 0, -0.70]), Object.freeze([0, 0, DREADSTONE_SWORD_DIMENSIONS.tipZ])]), radius: SWORD_EDGE_COLLISION_RADIUS }),
  rightEdge: Object.freeze({ kind: 'cutting_edge', points: Object.freeze([Object.freeze([0.035, 0, -0.214]), Object.freeze([0.0355, 0, -0.70]), Object.freeze([0, 0, DREADSTONE_SWORD_DIMENSIONS.tipZ])]), radius: SWORD_EDGE_COLLISION_RADIUS }),
  flat: Object.freeze({ kind: 'blade_flat', points: Object.freeze([Object.freeze([0, 0, -0.22]), Object.freeze([0, 0, -0.84])]), radius: 0.031 }),
  spine: Object.freeze({ kind: 'blade_spine', points: Object.freeze([Object.freeze([0, DREADSTONE_SWORD_DIMENSIONS.bladeHalfThickness, -0.22]), Object.freeze([0, DREADSTONE_SWORD_DIMENSIONS.bladeHalfThickness, -0.82])]), radius: 0.014 }),
  guard: Object.freeze({ kind: 'guard', points: Object.freeze([Object.freeze([-DREADSTONE_SWORD_DIMENSIONS.guardHalfSpan, 0, DREADSTONE_SWORD_DIMENSIONS.guardCenterZ]), Object.freeze([DREADSTONE_SWORD_DIMENSIONS.guardHalfSpan, 0, DREADSTONE_SWORD_DIMENSIONS.guardCenterZ])]), radius: DREADSTONE_SWORD_DIMENSIONS.guardRadius }),
  grip: Object.freeze({ kind: 'grip', points: Object.freeze([Object.freeze([0, 0, DREADSTONE_SWORD_DIMENSIONS.gripMinZ]), Object.freeze([0, 0, DREADSTONE_SWORD_DIMENSIONS.gripMaxZ])]), radius: DREADSTONE_SWORD_DIMENSIONS.gripRadius }),
});

export const SWORD_WORLD_WEAPON_CONFIG = Object.freeze({
  itemId: 'dreadstone_sword',
  tipLength: Math.abs(DREADSTONE_SWORD_DIMENSIONS.tipZ),
  minimumAttackSpeed: 0.05,
  gripZone: Object.freeze({ minimumRadiusPx: 38, maximumRadiusPx: 74, viewportRatio: 0.082 }),
  workspace: Object.freeze({
    ready: Object.freeze([0.16, -0.24, -0.50]),
    min: Object.freeze([-0.36, -0.43, -1.03]),
    max: Object.freeze([0.43, 0.10, -0.42]),
    lateralReach: 0.34,
    verticalReach: 0.24,
    thrustDistance: 0.43,
    lateralSensitivity: 1 / 150,
    verticalSensitivity: 1 / 170,
    thrustSensitivity: 1 / 255,
  }),
});

const SWORD_RENDER_ORDER = 10028;
const SWORD_WORLD_LAYER = WEAPON_WORLD_LAYER;
const SWORD_KINEMATIC_EPSILON = 1e-6;
const SWORD_INITIAL_PUNCTURE_DEPTH = 0.004;
const SWORD_EXTRACTION_CLEARANCE = -0.04;
const SWORD_CONTINUITY_POSITION_STEP = 0.01;
const SWORD_CONTINUITY_ROTATION_STEP = THREE.MathUtils.degToRad(3);
const localForward = new THREE.Vector3(0, 0, -1);
const localRight = new THREE.Vector3(1, 0, 0);
const identityQuaternion = new THREE.Quaternion();
const loadDreadstoneSwordAsset = createCachedWeaponGlbLoader(DREADSTONE_SWORD_GLB_PATH, 'Dreadstone Sword');

const primitivePaths = Object.freeze(Object.fromEntries(
  Object.entries(SWORD_CONTACT_PRIMITIVES)
    .filter(([, primitive]) => primitive.points)
    .map(([name, primitive]) => [name, createCuttingEdgePath(primitive.points.map((point) => new THREE.Vector3(...point)))]),
));

export function resolveSwordEdgeSampleCount(previousStart, previousEnd, currentStart, currentEnd, radius = SWORD_EDGE_COLLISION_RADIUS) {
  return resolveCuttingEdgeSampleCount(previousStart, previousEnd, currentStart, currentEnd, { radius, baseSampleCount: SWORD_EDGE_BASE_SAMPLE_COUNT, maxSampleCount: SWORD_EDGE_MAX_SAMPLE_COUNT });
}

export function classifySwordContact({ part, speed = 0, localMotion = null } = {}) {
  const x = Math.abs(Number(localMotion?.x) || 0);
  const y = Math.abs(Number(localMotion?.y) || 0);
  const forward = Math.max(0, -(Number(localMotion?.z) || 0));
  if (part === 'tip') return forward >= 0.5 && speed >= 0.22
    ? Object.freeze({ classification: 'thrust', damaging: true, reason: 'tip-led-thrust' })
    : Object.freeze({ classification: 'scrape', damaging: false, reason: 'glancing-tip' });
  if (part === 'leftEdge' || part === 'rightEdge') return x >= 0.28 && speed >= 0.18
    ? Object.freeze({ classification: 'cut', damaging: true, reason: 'edge-led-cut' })
    : Object.freeze({ classification: 'scrape', damaging: false, reason: 'edge-scrape' });
  if (part === 'flat') return Object.freeze({ classification: 'flat_strike', damaging: false, reason: 'blade-flat-impact' });
  if (part === 'spine') return Object.freeze({ classification: 'scrape', damaging: false, reason: y >= 0.25 ? 'spine-led-scrape' : 'spine-contact' });
  if (part === 'guard') return Object.freeze({ classification: 'guard_impact', damaging: false, reason: 'guard-impact' });
  return Object.freeze({ classification: 'grip_impact', damaging: false, reason: 'grip-impact' });
}

export function resolveSwordLeadingPart(localMotion) {
  const x = Math.abs(localMotion.x);
  const y = Math.abs(localMotion.y);
  const forward = Math.max(0, -localMotion.z);
  if (forward >= Math.max(x, y) * 0.8) return 'tip';
  if (x >= y * 0.92) return 'edge';
  return localMotion.y < 0 ? 'spine' : 'flat';
}

function makePrimitiveRuntime(name) {
  const definition = SWORD_CONTACT_PRIMITIVES[name];
  return {
    name,
    definition,
    path: primitivePaths[name],
    previousStart: new THREE.Vector3(),
    previousEnd: new THREE.Vector3(),
    currentStart: new THREE.Vector3(),
    currentEnd: new THREE.Vector3(),
    scratch: createSweptCuttingEdgeScratch(),
  };
}

export class SwordWorldWeaponController {
  constructor({ app, scene, camera, player, actor, physics, equipmentRuntime, controls, feedback = null, feedbackSystem = null, combatDirector = null, combatRouter = null, contactActivationProvider = null, outdoorLightingDirector = null, visualAssetLoader = loadDreadstoneSwordAsset, bindPointerInput = true } = {}) {
    this.app = app;
    this.viewport = app?.querySelector?.('[data-game="viewport"]') ?? app;
    this.scene = scene;
    this.camera = camera;
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
    this.config = SWORD_WORLD_WEAPON_CONFIG;
    this.weaponDefinition = Object.freeze({
      id: this.config.itemId,
      family: 'sword',
      bladeLength: DREADSTONE_SWORD_DIMENSIONS.bladeLength,
      bladeWidth: DREADSTONE_SWORD_DIMENSIONS.bladeWidth,
      bladeThickness: DREADSTONE_SWORD_DIMENSIONS.bladeThickness,
      maximumPenetrationDepth: SWORD_MAXIMUM_PENETRATION_DEPTH,
      authoredDimensions: DREADSTONE_SWORD_DIMENSIONS,
      piercingAudio: DREADSTONE_SWORD_PIERCING_AUDIO_PROFILE,
    });
    this.penetrationAudioGate = new PenetrationAudioGate({ weaponId: this.config.itemId });
    this.intentWeapon = new MeleeIntentWeapon({ weaponId: this.config.itemId, minimumIntentSpeed: this.config.minimumAttackSpeed, slashBias: 0.58 });
    this.intentState = this.intentWeapon.current;
    this.gestureOwnership = new WeaponGestureOwnership(this.config.workspace);
    Object.defineProperty(this, 'gripPointerId', { configurable: true, get: () => this.gestureOwnership.pointerId, set: (value) => { this.gestureOwnership.pointerId = value; } });
    this.gripStart = this.gestureOwnership.startPoint;
    this.deliberateInputVelocity = this.gestureOwnership.deliberateVelocity;
    this.poseWorkspace = createWeaponPoseWorkspace();
    this.contactScratch = createWeaponContactScratch();
    this.desiredGrip = new THREE.Vector3();
    this.actualGrip = new THREE.Vector3();
    this.previousGrip = new THREE.Vector3();
    this.desiredQuaternion = new THREE.Quaternion();
    this.actualQuaternion = new THREE.Quaternion();
    this.previousQuaternion = new THREE.Quaternion();
    this.desiredTip = new THREE.Vector3();
    this.currentTip = new THREE.Vector3();
    this.previousTip = new THREE.Vector3();
    this.bladeForward = new THREE.Vector3(0, 0, -1);
    this.tipDisplacement = new THREE.Vector3();
    this.tipVelocity = new THREE.Vector3();
    this.tipContactDirection = new THREE.Vector3();
    this.entryTangent = new THREE.Vector3(1, 0, 0);
    this.offensiveVelocity = new THREE.Vector3();
    this.totalWorldVelocity = new THREE.Vector3();
    this.aimX = 0;
    this.aimY = 0;
    this.desiredExtension = 0;
    this.returnElapsed = 0;
    this.returnDuration = 0.18;
    this.returnStartAim = new THREE.Vector2();
    this.returnStartExtension = 0;
    this.state = SWORD_IMPALEMENT_STATES.ready;
    this.contactState = 'no_contact';
    this.contactDamageReason = 'non-damaging:no-pointer-owner';
    this.attackEnabled = false;
    this.lastFrameVelocity = 0;
    this.actualTipSpeed = 0;
    this.forwardSpeed = 0;
    this.forwardRatio = 0;
    this.thrustEligible = false;
    this.lastContactPart = 'none';
    this.lastClassification = 'none';
    this.lastEdgeSampleCount = 0;
    this.lastPhysicsDt = 1 / 60;
    this.elapsed = 0;
    this.contactCooldownUntil = 0;
    this.resistanceKick = 0;
    this.visibleCollisionError = 0;
    this.entry = null;
    this.penetrationDepth = 0;
    this.maximumDepthReached = 0;
    this.desiredProjectedDepth = 0;
    this.rawDesiredProjectedDepth = 0;
    this.projectionError = 0;
    this.rearmReady = true;
    this.rearmGate = null;
    this.lastRearmClearance = 0;
    this.tissueResistanceSample = { phase: 'skin', effectiveResistance: 0.3, drag: 0, deflection: 0 };
    this.punctureBeginCount = 0;
    this.extractionCount = 0;
    this.rearmCount = 0;
    this.lastExtractionReason = null;
    this.releaseWithdrawal = {
      active: false,
      elapsed: 0,
      startDepth: 0,
      progress: 0,
    };
    this.tipSweepCount = 0;
    this.suppressedNonTipContacts = 0;
    this.embeddedToFreePositionDiscontinuity = 0;
    this.embeddedToFreeRotationDiscontinuity = 0;
    this.measureEmbeddedToFreeContinuity = false;
    this.transitionLightingDiscontinuityCount = 0;
    this.currentRenderLayer = null;
    this.outdoorMaterialRegistration = { status: outdoorLightingDirector ? 'pending' : 'unavailable', registered: false, eligibleMaterialCount: 0, ordinaryEmissiveScale: null };
    this.poseContinuity = {
      active: false,
      holdWhileEmbedded: false,
      localPositionOffset: new THREE.Vector3(),
      localQuaternionOffset: new THREE.Quaternion(),
    };
    this.poseContinuityScratch = {
      cameraQuaternion: new THREE.Quaternion(),
      inverseCameraQuaternion: new THREE.Quaternion(),
      canonicalLocalQuaternion: new THREE.Quaternion(),
      actualLocalQuaternion: new THREE.Quaternion(),
      canonicalLocalGrip: new THREE.Vector3(),
      actualLocalGrip: new THREE.Vector3(),
      worldOffset: new THREE.Vector3(),
    };
    this.activeEdgeDamage = null;
    this.edgeDamageCount = 0;
    this.primitives = Object.fromEntries(['leftEdge', 'rightEdge', 'flat', 'spine', 'guard', 'grip'].map((name) => [name, makePrimitiveRuntime(name)]));
    this.colliderFilter = (collider) => this.weaponContactRouter.ownsCollider(collider);
    this.poseRebaseRequest = { camera: this.camera, poseWorkspace: this.poseWorkspace, anchored: false, positions: [this.actualGrip, this.previousGrip, this.desiredGrip, this.currentTip, this.previousTip, this.desiredTip], quaternions: [this.actualQuaternion, this.previousQuaternion, this.desiredQuaternion] };
    this.desiredPoseRequest = { camera: this.camera, workspace: this.config.workspace, poseWorkspace: this.poseWorkspace, aimX: 0, aimY: 0, extension: 0, pitchFromAimY: 0.32, yawFromAimX: -0.36, rollFromAimX: -0.24, tipLength: this.config.tipLength, desiredGrip: this.desiredGrip, desiredQuaternion: this.desiredQuaternion, desiredTip: this.desiredTip };
    this.disposers = [];
    this.disposed = false;
    this.debugVisible = false;
    this.buildVisual();
    this.initializePose();
    if (bindPointerInput) this.bindInput();
  }

  buildVisual() {
    this.visual = new THREE.Group();
    this.visual.name = 'dreadstone-sword-authoritative-world-weapon';
    this.visualGeometries = [];
    this.visualMaterials = [];
    this.visualAssetState = 'loading';
    this.applyVisualLayer();
    this.scene?.add?.(this.visual);
    this.visualLoadPromise = this.visualAssetLoader().then((source) => {
      const owned = cloneOwnedWeaponVisual(source);
      if (this.disposed) {
        disposeOwnedWeaponVisual(owned);
        return 'disposed';
      }
      owned.root.name = 'dreadstone-sword-v002-glb-visual';
      owned.root.userData.sourceAsset = DREADSTONE_SWORD_GLB_PATH;
      this.visual.add(owned.root);
      this.visualGeometries.push(...owned.geometries);
      this.visualMaterials.push(...owned.materials);
      this.visualAssetState = 'loaded';
      this.registerOutdoorMaterials(owned.root);
      this.applyVisualLayer(true);
      return this.visualAssetState;
    }).catch(() => {
      if (this.disposed) return 'disposed';
      this.buildFallbackVisual();
      this.visualAssetState = 'fallback';
      this.applyVisualLayer(true);
      return this.visualAssetState;
    });
  }

  buildFallbackVisual() {
    const steel = new THREE.MeshStandardMaterial({ color: 0x7b7f80, roughness: 0.48, metalness: 0.72 });
    const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x2d241d, roughness: 0.9 });
    const bladeGeometry = new THREE.BoxGeometry(0.071, 0.016, 0.67);
    const guardGeometry = new THREE.BoxGeometry(0.196, 0.032, 0.045);
    const gripGeometry = new THREE.CylinderGeometry(0.019, 0.021, 0.295, 8);
    const blade = new THREE.Mesh(bladeGeometry, steel);
    blade.position.z = -0.55;
    const guard = new THREE.Mesh(guardGeometry, steel);
    guard.position.z = DREADSTONE_SWORD_DIMENSIONS.guardCenterZ;
    const grip = new THREE.Mesh(gripGeometry, gripMaterial);
    grip.rotation.x = Math.PI / 2;
    grip.position.z = 0.0475;
    this.visual.add(blade, guard, grip);
    this.visualGeometries.push(bladeGeometry, guardGeometry, gripGeometry);
    this.visualMaterials.push(steel, gripMaterial);
    this.registerOutdoorMaterials(this.visual);
  }

  registerOutdoorMaterials(root) {
    if (!this.outdoorLightingDirector?.registerOrdinaryObject) return this.outdoorMaterialRegistration;
    this.outdoorMaterialRegistration = this.outdoorLightingDirector.registerOrdinaryObject(root);
    return this.outdoorMaterialRegistration;
  }

  applyVisualLayer(force = false) {
    const embeddedInWorld = Boolean(this.entry);
    const mode = embeddedInWorld ? 'world' : 'viewmodel';
    if (!force && this.visualLayerMode === mode) return;
    const nextLayer = embeddedInWorld ? SWORD_WORLD_LAYER : SWORD_VIEWMODEL_LAYER;
    const before = this.currentRenderLayer != null && this.currentRenderLayer !== nextLayer
      ? captureWeaponMaterialLightingState(this.visual)
      : null;
    this.visualLayerMode = mode;
    applyWeaponRenderLayer(this.visual, {
      layer: nextLayer,
      renderOrder: embeddedInWorld ? 0 : SWORD_RENDER_ORDER,
      itemId: this.config.itemId,
      viewmodel: !embeddedInWorld,
    });
    this.currentRenderLayer = nextLayer;
    if (before && weaponMaterialLightingStateChanged(before, captureWeaponMaterialLightingState(this.visual))) {
      this.transitionLightingDiscontinuityCount = Math.min(1_000_000, this.transitionLightingDiscontinuityCount + 1);
    }
  }

  initializePose() {
    initializeCameraRelativeWeaponPose({ camera: this.camera, workspace: this.config.workspace, poseWorkspace: this.poseWorkspace, actualGrip: this.actualGrip, previousGrip: this.previousGrip, desiredGrip: this.desiredGrip, actualQuaternion: this.actualQuaternion, previousQuaternion: this.previousQuaternion, desiredQuaternion: this.desiredQuaternion });
    this.computeDesiredPose();
    this.actualGrip.copy(this.desiredGrip);
    this.previousGrip.copy(this.desiredGrip);
    this.actualQuaternion.copy(this.desiredQuaternion);
    this.previousQuaternion.copy(this.desiredQuaternion);
    this.updateDerivedPose();
    this.previousTip.copy(this.currentTip);
    this.updatePrimitiveEndpoints();
  }

  bindInput() {
    this.disposers.push(bindWeaponPointerEvents({ viewport: this.viewport, onPointerDown: (event) => this.pointerDown(event), onPointerMove: (event) => this.pointerMove(event), onPointerEnd: (event) => this.pointerEnd(event), onSuspend: () => this.cancel('app-suspended') }));
  }

  pointerDown(event) {
    if (this.gripPointerId != null || !this.isEquipped() || event.target?.closest?.(DEFAULT_WEAPON_POINTER_BLOCK_SELECTOR) || !this.projectGrabHit(event.clientX, event.clientY, this.viewport)) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    this.acquireGrip(event.pointerId, event.clientX, event.clientY, performance.now());
    this.viewport?.setPointerCapture?.(event.pointerId);
  }

  pointerMove(event) {
    if (event.pointerId !== this.gripPointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    this.applyGripGesture(event.pointerId, event.clientX - this.gripStart.x, event.clientY - this.gripStart.y, event.clientX, event.clientY, performance.now());
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
    if (!this.isEquipped() || this.entry || !this.gestureOwnership.acquire(pointerId, clientX, clientY, timeMs)) return false;
    if (this.state !== SWORD_IMPALEMENT_STATES.returning) this.state = SWORD_IMPALEMENT_STATES.ready;
    return true;
  }

  applyGripGesture(pointerId, deltaX, deltaY, clientX, clientY, timeMs = performance.now()) {
    const sample = this.gestureOwnership.update(pointerId, deltaX, deltaY, clientX, clientY, timeMs, this.desiredExtension);
    if (!sample) return false;
    this.aimX = sample.aimX;
    this.aimY = sample.aimY;
    this.desiredExtension = sample.extension;
    if (this.entry) {
      if (this.state !== SWORD_IMPALEMENT_STATES.surfaceContact) this.state = SWORD_IMPALEMENT_STATES.embedded;
    } else if (this.state === SWORD_IMPALEMENT_STATES.returning && (this.returnElapsed < this.returnDuration || !this.rearmReady)) {
      this.state = SWORD_IMPALEMENT_STATES.returning;
    } else this.state = sample.intentionalTravel >= 4 ? SWORD_IMPALEMENT_STATES.attacking : SWORD_IMPALEMENT_STATES.ready;
    return true;
  }

  releaseGrip(reason = 'pointer-release') {
    if (this.gripPointerId == null && !this.entry && this.state === SWORD_IMPALEMENT_STATES.ready) return;
    if (this.releaseWithdrawal.active) return;
    this.gestureOwnership.release();
    this.finishActiveEdgeDamage(reason !== 'pointer-release');
    this.attackEnabled = false;
    this.offensiveVelocity.set(0, 0, 0);
    if (this.entry) {
      if (this.penetrationDepth > 0) this.beginReleasedSwordWithdrawal();
      else this.completeSwordExtraction(this.getEntryWorldPose(), 'released-auto-withdrawal');
      return;
    }
    this.returnElapsed = 0;
    this.returnStartAim.set(this.aimX, this.aimY);
    this.returnStartExtension = this.desiredExtension;
    this.state = SWORD_IMPALEMENT_STATES.returning;
  }

  updateInput(dt) {
    this.gestureOwnership.decayDeliberateVelocity(dt);
    if (this.state !== SWORD_IMPALEMENT_STATES.returning) return;
    this.returnElapsed += dt;
    const progress = THREE.MathUtils.clamp(this.returnElapsed / this.returnDuration, 0, 1);
    const eased = 1 - Math.exp(-8 * progress) * (1 + 8 * progress);
    this.aimX = THREE.MathUtils.lerp(this.returnStartAim.x, 0, eased);
    this.aimY = THREE.MathUtils.lerp(this.returnStartAim.y, 0, eased);
    this.desiredExtension = THREE.MathUtils.lerp(this.returnStartExtension, 0, eased);
    if (progress >= 1) {
      this.aimX = 0;
      this.aimY = 0;
      this.desiredExtension = 0;
      if (this.rearmReady) this.state = SWORD_IMPALEMENT_STATES.ready;
    }
  }

  computeDesiredPose() {
    this.desiredPoseRequest.aimX = this.aimX;
    this.desiredPoseRequest.aimY = this.aimY;
    this.desiredPoseRequest.extension = this.desiredExtension;
    computeCameraRelativeWeaponPose(this.desiredPoseRequest);
    if (this.poseContinuity.active) {
      const scratch = this.poseContinuityScratch;
      this.camera.getWorldQuaternion(scratch.cameraQuaternion);
      this.desiredGrip.add(scratch.worldOffset.copy(this.poseContinuity.localPositionOffset).applyQuaternion(scratch.cameraQuaternion));
      this.desiredQuaternion.copy(scratch.cameraQuaternion)
        .multiply(this.poseContinuity.localQuaternionOffset)
        .multiply(this.poseWorkspace.localQuaternion)
        .normalize();
      deriveBladeTip(this.desiredGrip, this.desiredQuaternion, this.config.tipLength, this.desiredTip);
    }
  }

  rebaseDesiredPoseToActual(holdWhileEmbedded = false) {
    const continuity = this.poseContinuity;
    const scratch = this.poseContinuityScratch;
    continuity.active = false;
    continuity.holdWhileEmbedded = false;
    this.computeDesiredPose();
    this.camera.updateMatrixWorld(true);
    scratch.canonicalLocalGrip.copy(this.desiredGrip);
    scratch.actualLocalGrip.copy(this.actualGrip);
    this.camera.worldToLocal(scratch.canonicalLocalGrip);
    this.camera.worldToLocal(scratch.actualLocalGrip);
    continuity.localPositionOffset.subVectors(scratch.actualLocalGrip, scratch.canonicalLocalGrip);
    this.camera.getWorldQuaternion(scratch.cameraQuaternion);
    scratch.inverseCameraQuaternion.copy(scratch.cameraQuaternion).invert();
    scratch.canonicalLocalQuaternion.copy(scratch.inverseCameraQuaternion).multiply(this.desiredQuaternion).normalize();
    scratch.actualLocalQuaternion.copy(scratch.inverseCameraQuaternion).multiply(this.actualQuaternion).normalize();
    continuity.localQuaternionOffset.copy(scratch.actualLocalQuaternion)
      .multiply(scratch.canonicalLocalQuaternion.invert())
      .normalize();
    continuity.active = true;
    continuity.holdWhileEmbedded = holdWhileEmbedded;
    this.computeDesiredPose();
  }

  updatePoseContinuity() {
    const continuity = this.poseContinuity;
    if (!continuity.active || (continuity.holdWhileEmbedded && this.entry)) return;
    continuity.holdWhileEmbedded = false;
    const positionLength = continuity.localPositionOffset.length();
    if (positionLength <= SWORD_CONTINUITY_POSITION_STEP) continuity.localPositionOffset.set(0, 0, 0);
    else continuity.localPositionOffset.multiplyScalar((positionLength - SWORD_CONTINUITY_POSITION_STEP) / positionLength);
    const rotationAngle = continuity.localQuaternionOffset.angleTo(identityQuaternion);
    if (rotationAngle <= SWORD_CONTINUITY_ROTATION_STEP) continuity.localQuaternionOffset.identity();
    else continuity.localQuaternionOffset.slerp(identityQuaternion, SWORD_CONTINUITY_ROTATION_STEP / rotationAngle).normalize();
    if (this.measureEmbeddedToFreeContinuity) {
      this.embeddedToFreePositionDiscontinuity = Math.max(this.embeddedToFreePositionDiscontinuity, positionLength - continuity.localPositionOffset.length());
      this.embeddedToFreeRotationDiscontinuity = Math.max(this.embeddedToFreeRotationDiscontinuity, rotationAngle - continuity.localQuaternionOffset.angleTo(identityQuaternion));
    }
    if (continuity.localPositionOffset.lengthSq() <= SWORD_KINEMATIC_EPSILON ** 2 && continuity.localQuaternionOffset.angleTo(identityQuaternion) <= SWORD_KINEMATIC_EPSILON) {
      continuity.active = false;
      continuity.localPositionOffset.set(0, 0, 0);
      continuity.localQuaternionOffset.identity();
      this.measureEmbeddedToFreeContinuity = false;
    }
  }

  updateDerivedPose() {
    deriveBladeTip(this.actualGrip, this.actualQuaternion, this.config.tipLength, this.currentTip);
    this.bladeForward.copy(localForward).applyQuaternion(this.actualQuaternion).normalize();
  }

  updatePrimitiveEndpoints() {
    Object.values(this.primitives).forEach((primitive) => {
      primitive.previousStart.copy(primitive.path.points[0]).applyQuaternion(this.previousQuaternion).add(this.previousGrip);
      primitive.previousEnd.copy(primitive.path.points.at(-1)).applyQuaternion(this.previousQuaternion).add(this.previousGrip);
      primitive.currentStart.copy(primitive.path.points[0]).applyQuaternion(this.actualQuaternion).add(this.actualGrip);
      primitive.currentEnd.copy(primitive.path.points.at(-1)).applyQuaternion(this.actualQuaternion).add(this.actualGrip);
    });
  }

  beforePhysics(dt) {
    this.lastPhysicsDt = Math.max(0, dt);
    this.elapsed += this.lastPhysicsDt;
    this.visual.visible = this.isEquipped();
    if (!this.visual.visible) {
      if (this.gripPointerId != null || this.entry || this.state !== SWORD_IMPALEMENT_STATES.ready) this.cancel('weapon-unequipped');
      return;
    }
    this.poseRebaseRequest.anchored = Boolean(this.entry);
    rebaseWorldWeaponPoseToCamera(this.poseRebaseRequest);
    this.updateInput(dt);
    this.updatePoseContinuity();
    this.computeDesiredPose();
    this.previousGrip.copy(this.actualGrip);
    this.previousQuaternion.copy(this.actualQuaternion);
    this.previousTip.copy(this.currentTip);
    const cameraQuaternion = this.camera.getWorldQuaternion(this.contactScratch.inverseQuaternion);
    this.offensiveVelocity.copy(this.deliberateInputVelocity).applyQuaternion(cameraQuaternion);
    this.lastFrameVelocity = this.offensiveVelocity.length();
    const contactActive = this.contactActivationProvider?.() ?? true;
    if (this.entry) this.solveSwordImpalement(dt);
    else this.solveFreeSwordPose(dt, contactActive);
    this.updatePrimitiveEndpoints();
    this.applyVisualLayer();
  }

  updateTipKinematics(dt) {
    const safeDt = Math.max(Number(dt) || 0, SWORD_KINEMATIC_EPSILON);
    this.tipDisplacement.subVectors(this.currentTip, this.previousTip);
    this.actualTipSpeed = this.tipDisplacement.length() / safeDt;
    this.tipVelocity.copy(this.tipDisplacement).divideScalar(safeDt);
    this.totalWorldVelocity.copy(this.tipVelocity);
    this.forwardSpeed = Math.max(0, this.tipVelocity.dot(this.bladeForward));
    this.forwardRatio = this.forwardSpeed / Math.max(this.actualTipSpeed, SWORD_KINEMATIC_EPSILON);
  }

  solveFreeSwordPose(dt, contactActive) {
    // Free-space tracking stays direct. The authored point displacement, rather
    // than pointer-leading-part classification, owns thrust recognition.
    this.actualGrip.copy(this.desiredGrip);
    this.actualQuaternion.copy(this.desiredQuaternion);
    this.updateDerivedPose();
    this.updateTipKinematics(dt);
    this.updateSwordRearmGate();
    this.intentState = this.intentWeapon.interpret({ ownerId: this.gripPointerId, controlState: this.state, localVelocity: this.deliberateInputVelocity, embedded: false });
    const deliberateEnergy = this.lastFrameVelocity >= this.config.minimumAttackSpeed;
    const intentionalState = [SWORD_IMPALEMENT_STATES.attacking, SWORD_IMPALEMENT_STATES.surfaceContact].includes(this.state);
    this.thrustEligible = Boolean(
      SWORD_RUNTIME_COMBAT_MODE === 'puncture_only'
      && this.physics
      && this.gripPointerId != null
      && intentionalState
      && contactActive
      && deliberateEnergy
      && this.rearmReady
      && this.forwardSpeed >= SWORD_THRUST_MIN_FORWARD_SPEED
      && this.forwardRatio >= SWORD_THRUST_MIN_FORWARD_RATIO
    );
    this.attackEnabled = this.thrustEligible;
    if (!this.thrustEligible) {
      this.contactDamageReason = this.gripPointerId == null
        ? 'non-damaging:no-pointer-owner'
        : !contactActive
          ? 'non-damaging:outside-combat-contact-range'
          : !deliberateEnergy
            ? 'non-damaging:no-deliberate-input-energy'
            : !this.rearmReady
              ? 'non-damaging:awaiting-entry-surface-clearance'
              : 'non-damaging:puncture-only-non-forward-motion';
      if (SWORD_RUNTIME_COMBAT_MODE === 'puncture_only' && this.gripPointerId != null && intentionalState && contactActive && deliberateEnergy && this.actualTipSpeed > SWORD_KINEMATIC_EPSILON) this.recordSuppressedNonTipContact();
      return;
    }
    this.contactDamageReason = 'damaging:actual-tip-forward-thrust';
    this.tipContactDirection.copy(this.tipVelocity).normalize();
    const positionsPrepared = this.physics.prepareWeaponSweepBatch?.() === true;
    if (!this.resolveSwordThrustTipContact(this.tipContactDirection, positionsPrepared)) this.recordSuppressedNonTipContact();
  }

  recordSuppressedNonTipContact() {
    this.suppressedNonTipContacts = Math.min(1_000_000, this.suppressedNonTipContacts + 1);
  }

  resolveSwordThrustTipContact(contactDirection, positionsPrepared) {
    if (this.tipDisplacement.lengthSq() < SWORD_KINEMATIC_EPSILON ** 2) return false;
    this.tipSweepCount = Math.min(1_000_000, this.tipSweepCount + 1);
    const raw = this.physics.castWeaponTip(this.previousTip, this.currentTip, SWORD_CONTACT_PRIMITIVES.tip.radius, this.colliderFilter, positionsPrepared);
    if (!raw?.collider) return false;
    const toi = THREE.MathUtils.clamp(raw.time_of_impact ?? 0, 0, 1);
    const point = raw.witness1
      ? this.contactScratch.point.set(raw.witness1.x, raw.witness1.y, raw.witness1.z)
      : this.contactScratch.point.copy(this.previousTip).lerp(this.currentTip, toi);
    const routed = this.weaponContactRouter.resolveTarget(raw.collider, point);
    if (!routed) return false;
    const normal = raw.normal1
      ? this.contactScratch.normal.set(raw.normal1.x, raw.normal1.y, raw.normal1.z).normalize()
      : this.contactScratch.normal.copy(point).sub(getRigidBodyWorldPosition(routed.hit.body, this.contactScratch.bodyCenter)).normalize();
    return this.beginSwordPenetration({ routed, point, normal, contactDirection });
  }

  beginSwordPenetration({ routed, point, normal, contactDirection }) {
    if (this.entry) return false;
    const entryAxis = this.bladeForward.clone().normalize();
    const rawCollisionFrameProjectedDepth = this.desiredTip.clone().sub(point).dot(entryAxis);
    const collisionFrameProjectedDepth = THREE.MathUtils.clamp(
      rawCollisionFrameProjectedDepth,
      SWORD_EXTRACTION_CLEARANCE,
      SWORD_MAXIMUM_PENETRATION_DEPTH,
    );
    const collisionFrameDepth = THREE.MathUtils.clamp(
      Math.max(SWORD_INITIAL_PUNCTURE_DEPTH, collisionFrameProjectedDepth),
      0,
      SWORD_MAXIMUM_PENETRATION_DEPTH,
    );
    const bodyTransformAtCollision = capturePhysicsBodyTransform(routed.hit.bodyTransformAtCollision ?? routed.hit.body);
    const localAxis = worldDirectionToPhysicsBodyLocal(bodyTransformAtCollision ?? routed.hit.body, entryAxis);
    if (!localAxis) return false;
    const bodyQuaternion = bodyTransformAtCollision?.quaternion ?? new THREE.Quaternion();
    const localQuaternion = bodyQuaternion.clone().invert().multiply(this.actualQuaternion).normalize();
    const forcedThrustIntent = Object.freeze({
      weaponId: this.config.itemId,
      intent: MELEE_INTENTS.stab,
      ownerId: this.gripPointerId,
      speed: this.actualTipSpeed,
      intentional: true,
      damaging: true,
      reason: 'actual-tip-forward-thrust',
    });
    this.intentState = forcedThrustIntent;
    this.entryTangent.copy(localRight).applyQuaternion(this.actualQuaternion).normalize();
    const interaction = routed.director.beginSwordPuncture?.({
      weapon: this.weaponDefinition,
      intent: forcedThrustIntent,
      hit: routed.hit,
      entryPoint: point,
      direction: entryAxis,
      contactDirection,
      surfaceNormal: normal,
      entryTangent: this.entryTangent,
      depth: SWORD_INITIAL_PUNCTURE_DEPTH,
      force: this.actualTipSpeed,
      weaponAdapter: this,
      penetrationAudioGate: this.penetrationAudioGate,
      onWoundCreated: (wound, directedInteraction) => {
        if (this.entry?.directorInteractionId !== directedInteraction.id) return;
        this.entry.woundId = wound?.id ?? null;
        this.entry.surfaceRuptured = true;
      },
    });
    if (!interaction) return false;
    this.entry = {
      actor: routed.actor,
      director: routed.director,
      hit: routed.hit,
      body: routed.hit.body,
      bodyId: routed.hit.bodyId,
      regionId: routed.hit.regionId,
      localPoint: routed.hit.localPoint.clone(),
      localAxis,
      localQuaternion,
      bodyTransformAtCollision,
      entryAxisWorldAtCollision: entryAxis.clone(),
      contactDirection: contactDirection.clone(),
      surfaceNormal: normal.clone(),
      woundId: null,
      directorInteractionId: interaction.id,
      surfaceRuptured: false,
      withdrawalStarted: false,
      resistancePhase: null,
      worldPoint: new THREE.Vector3(),
      worldAxis: new THREE.Vector3(),
      worldBodyQuaternion: new THREE.Quaternion(),
      worldSwordQuaternion: new THREE.Quaternion(),
      worldPose: { point: null, axis: null, quaternion: null },
    };
    this.entry.worldPose.point = this.entry.worldPoint;
    this.entry.worldPose.axis = this.entry.worldAxis;
    this.entry.worldPose.quaternion = this.entry.worldSwordQuaternion;
    this.rawDesiredProjectedDepth = rawCollisionFrameProjectedDepth;
    this.desiredProjectedDepth = collisionFrameDepth;
    this.penetrationDepth = collisionFrameDepth;
    this.projectionError = this.desiredProjectedDepth - this.penetrationDepth;
    this.maximumDepthReached = collisionFrameDepth;
    this.resetReleaseWithdrawal();
    this.rearmReady = false;
    this.thrustEligible = true;
    this.lastContactPart = 'tip';
    this.lastClassification = 'thrust';
    this.contactState = SWORD_IMPALEMENT_STATES.surfaceContact;
    this.state = SWORD_IMPALEMENT_STATES.surfaceContact;
    this.punctureBeginCount = Math.min(1_000_000, this.punctureBeginCount + 1);
    routed.actor?.setEmbeddedWeapon?.(this);
    const worldEntry = this.getEntryWorldPose();
    if (worldEntry) {
      sampleTissueResistanceCurve({
        depth: this.penetrationDepth,
        surfaceThickness: this.entry.hit.region?.surfaceThickness,
        softTissueResistance: this.entry.hit.region?.softTissueResistance,
        hardDepth: null,
        hardStructureResistance: 0,
        withdrawing: false,
      }, this.tissueResistanceSample);
      const collisionFrameDelta = Math.max(0, this.penetrationDepth - SWORD_INITIAL_PUNCTURE_DEPTH);
      if (collisionFrameDelta > 0) {
        this.entry.director.advancePenetration(this.entry.directorInteractionId, {
          hit: this.entry.hit,
          entryPoint: worldEntry.point,
          direction: worldEntry.axis,
          deltaDepth: collisionFrameDelta,
          depth: this.penetrationDepth,
          force: this.tissueResistanceSample.effectiveResistance + this.actualTipSpeed,
          lateralMotion: 0,
          hardContact: false,
          resistanceProfile: this.tissueResistanceSample,
        });
      }
      this.applyConstrainedSwordPose(worldEntry);
    }
    this.applyVisualLayer();
    return true;
  }

  getEntryWorldPose(entry = this.entry) {
    const body = entry?.body;
    if (!body) return null;
    const point = physicsBodyLocalToWorld(body, entry.localPoint, entry.worldPoint);
    const axis = physicsBodyLocalDirectionToWorld(body, entry.localAxis, entry.worldAxis);
    const rotation = body.rotation?.();
    if (!point || !axis || !rotation) return null;
    entry.worldBodyQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w).normalize();
    entry.worldSwordQuaternion.copy(entry.worldBodyQuaternion).multiply(entry.localQuaternion).normalize();
    return entry.worldPose;
  }

  applyConstrainedSwordPose(worldEntry) {
    this.actualQuaternion.copy(worldEntry.quaternion);
    this.actualGrip.copy(worldEntry.point).addScaledVector(worldEntry.axis, this.penetrationDepth - this.config.tipLength);
    this.updateDerivedPose();
  }

  resetReleaseWithdrawal() {
    this.releaseWithdrawal.active = false;
    this.releaseWithdrawal.elapsed = 0;
    this.releaseWithdrawal.startDepth = 0;
    this.releaseWithdrawal.progress = 0;
  }

  beginReleasedSwordWithdrawal(worldEntry = this.getEntryWorldPose()) {
    if (!this.entry || this.releaseWithdrawal.active) return false;
    this.releaseWithdrawal.active = true;
    this.releaseWithdrawal.elapsed = 0;
    this.releaseWithdrawal.startDepth = Math.max(0, this.penetrationDepth);
    this.releaseWithdrawal.progress = 0;
    this.state = SWORD_IMPALEMENT_STATES.releaseWithdrawing;
    this.contactState = SWORD_IMPALEMENT_STATES.releaseWithdrawing;
    this.contactDamageReason = 'non-damaging:released-sword-auto-withdrawal';
    this.attackEnabled = false;
    this.beginSwordWithdrawal(worldEntry);
    return true;
  }

  solveReleasedSwordWithdrawal(dt, worldEntry) {
    const entry = this.entry;
    if (!entry || !this.releaseWithdrawal.active) return false;
    const withdrawal = this.releaseWithdrawal;
    withdrawal.elapsed = Math.min(SWORD_RELEASE_EXTRACTION_DURATION, withdrawal.elapsed + Math.max(0, Number(dt) || 0));
    withdrawal.progress = THREE.MathUtils.clamp(withdrawal.elapsed / SWORD_RELEASE_EXTRACTION_DURATION, 0, 1);
    const easedProgress = withdrawal.progress * withdrawal.progress * (3 - 2 * withdrawal.progress);
    const previousDepth = this.penetrationDepth;
    this.penetrationDepth = Math.min(previousDepth, withdrawal.startDepth * (1 - easedProgress));
    this.rawDesiredProjectedDepth = this.penetrationDepth;
    this.desiredProjectedDepth = this.penetrationDepth;
    this.projectionError = 0;
    this.state = SWORD_IMPALEMENT_STATES.releaseWithdrawing;
    this.contactState = SWORD_IMPALEMENT_STATES.releaseWithdrawing;
    this.contactDamageReason = 'non-damaging:released-sword-auto-withdrawal';
    this.attackEnabled = false;
    sampleTissueResistanceCurve({
      depth: this.penetrationDepth,
      surfaceThickness: entry.hit.region?.surfaceThickness,
      softTissueResistance: entry.hit.region?.softTissueResistance,
      hardDepth: null,
      hardStructureResistance: 0,
      withdrawing: true,
    }, this.tissueResistanceSample);
    this.applyConstrainedSwordPose(worldEntry);
    this.updateTipKinematics(dt);
    if (entry.resistancePhase !== this.tissueResistanceSample.phase) {
      entry.resistancePhase = this.tissueResistanceSample.phase;
      entry.director.reportResistance?.(entry.directorInteractionId, { kind: this.tissueResistanceSample.phase, intensity: this.tissueResistanceSample.drag, depth: this.penetrationDepth, position: worldEntry.point });
    }
    if (withdrawal.progress >= 1) {
      this.penetrationDepth = 0;
      this.applyConstrainedSwordPose(worldEntry);
      this.resetReleaseWithdrawal();
      this.completeSwordExtraction(worldEntry, 'released-auto-withdrawal');
    }
    return true;
  }

  solveSwordImpalement(dt) {
    const entry = this.entry;
    this.thrustEligible = false;
    const actorBodyMissing = entry?.actor?.bodies instanceof Map && !entry.actor.bodies.has(entry.bodyId);
    if (!entry || entry.actor?.disposed || actorBodyMissing) {
      this.clearInvalidSwordTarget('target-invalid');
      return;
    }
    const worldEntry = this.getEntryWorldPose(entry);
    if (!worldEntry) {
      this.clearInvalidSwordTarget('target-invalid');
      return;
    }
    if (this.gripPointerId == null && !this.releaseWithdrawal.active) this.beginReleasedSwordWithdrawal(worldEntry);
    if (this.releaseWithdrawal.active) {
      this.solveReleasedSwordWithdrawal(dt, worldEntry);
      return;
    }
    this.intentState = this.intentWeapon.interpret({ ownerId: this.gripPointerId, controlState: SWORD_IMPALEMENT_STATES.embedded, localVelocity: this.deliberateInputVelocity, embedded: true });
    const previousDepth = this.penetrationDepth;
    this.rawDesiredProjectedDepth = this.gripPointerId == null
      ? this.penetrationDepth
      : this.desiredTip.clone().sub(worldEntry.point).dot(worldEntry.axis);
    this.desiredProjectedDepth = THREE.MathUtils.clamp(this.rawDesiredProjectedDepth, SWORD_EXTRACTION_CLEARANCE, SWORD_MAXIMUM_PENETRATION_DEPTH);
    const targetDepth = this.desiredProjectedDepth;
    const advancing = targetDepth > previousDepth + SWORD_KINEMATIC_EPSILON;
    const withdrawing = targetDepth < previousDepth - SWORD_KINEMATIC_EPSILON;
    if (withdrawing) this.beginSwordWithdrawal(worldEntry);
    this.penetrationDepth = targetDepth;
    if (advancing) {
      this.state = this.penetrationDepth < SWORD_MAXIMUM_PENETRATION_DEPTH ? SWORD_IMPALEMENT_STATES.penetrating : SWORD_IMPALEMENT_STATES.embedded;
      this.contactState = this.state;
      this.contactDamageReason = 'damaging:projected-sword-penetration';
      this.attackEnabled = true;
    } else if (withdrawing) {
      this.state = SWORD_IMPALEMENT_STATES.withdrawing;
      this.contactState = SWORD_IMPALEMENT_STATES.withdrawing;
      this.contactDamageReason = 'non-damaging:projected-sword-withdrawal';
      this.attackEnabled = false;
    } else {
      this.state = entry.surfaceRuptured ? SWORD_IMPALEMENT_STATES.embedded : SWORD_IMPALEMENT_STATES.surfaceContact;
      this.contactState = this.state;
      this.contactDamageReason = entry.surfaceRuptured ? 'non-damaging:embedded-hold' : 'non-damaging:surface-rupture-pending';
      this.attackEnabled = false;
    }
    sampleTissueResistanceCurve({
      depth: this.penetrationDepth,
      surfaceThickness: entry.hit.region?.surfaceThickness,
      softTissueResistance: entry.hit.region?.softTissueResistance,
      hardDepth: null,
      hardStructureResistance: 0,
      withdrawing,
    }, this.tissueResistanceSample);
    this.maximumDepthReached = Math.max(this.maximumDepthReached, this.penetrationDepth);
    this.applyConstrainedSwordPose(worldEntry);
    this.updateTipKinematics(dt);
    this.projectionError = this.desiredProjectedDepth - this.penetrationDepth;
    const deltaDepth = Math.max(0, this.penetrationDepth - previousDepth);
    if (deltaDepth > 0) {
      entry.director.advancePenetration(entry.directorInteractionId, {
        hit: entry.hit,
        entryPoint: worldEntry.point,
        direction: worldEntry.axis,
        deltaDepth,
        depth: this.penetrationDepth,
        force: this.tissueResistanceSample.effectiveResistance,
        lateralMotion: 0,
        hardContact: false,
        resistanceProfile: this.tissueResistanceSample,
      });
    } else if (withdrawing && entry.resistancePhase !== this.tissueResistanceSample.phase) {
      entry.resistancePhase = this.tissueResistanceSample.phase;
      entry.director.reportResistance?.(entry.directorInteractionId, { kind: this.tissueResistanceSample.phase, intensity: this.tissueResistanceSample.drag, depth: this.penetrationDepth, position: worldEntry.point });
    }
    if (withdrawing && this.penetrationDepth < -SWORD_KINEMATIC_EPSILON) this.completeSwordExtraction(worldEntry);
  }

  beginSwordWithdrawal(worldEntry = this.getEntryWorldPose()) {
    const entry = this.entry;
    if (!entry?.directorInteractionId || entry.withdrawalStarted) return false;
    entry.withdrawalStarted = true;
    entry.director.beginWithdrawal(entry.directorInteractionId, { releaseSeverity: this.maximumDepthReached, direction: worldEntry?.axis?.clone?.().negate?.(), position: worldEntry?.point ?? this.currentTip });
    return true;
  }

  completeSwordExtraction(worldEntry = this.getEntryWorldPose(), reason = 'fully-extracted') {
    const entry = this.entry;
    if (!entry) return false;
    const transitionPosition = this.actualGrip.clone();
    const transitionQuaternion = this.actualQuaternion.clone();
    this.beginSwordWithdrawal(worldEntry);
    entry.director.completeWithdrawal(entry.directorInteractionId, { releaseSeverity: this.maximumDepthReached, direction: worldEntry?.axis?.clone?.().negate?.(), position: worldEntry?.point ?? this.currentTip });
    this.penetrationAudioGate.rearmAfterFullExtraction(entry.directorInteractionId);
    entry.actor?.setEmbeddedWeapon?.(null);
    this.rearmGate = {
      actor: entry.actor,
      body: entry.body,
      bodyId: entry.bodyId,
      localPoint: entry.localPoint.clone(),
      localAxis: entry.localAxis.clone(),
      worldPoint: new THREE.Vector3(),
      worldAxis: new THREE.Vector3(),
    };
    this.entry = null;
    this.penetrationDepth = 0;
    this.resetReleaseWithdrawal();
    this.rearmReady = false;
    this.lastRearmClearance = 0;
    this.extractionCount = Math.min(1_000_000, this.extractionCount + 1);
    this.lastExtractionReason = reason;
    this.attackEnabled = false;
    this.contactState = 'fully_extracted';
    this.contactDamageReason = 'non-damaging:awaiting-entry-surface-clearance';
    if (this.gripPointerId != null) {
      this.state = SWORD_IMPALEMENT_STATES.attacking;
      this.measureEmbeddedToFreeContinuity = true;
      this.rebaseDesiredPoseToActual(false);
    } else {
      this.measureEmbeddedToFreeContinuity = true;
      this.rebaseDesiredPoseToActual(false);
      this.returnElapsed = 0;
      this.returnStartAim.set(this.aimX, this.aimY);
      this.returnStartExtension = this.desiredExtension;
      this.state = SWORD_IMPALEMENT_STATES.returning;
    }
    this.applyVisualLayer();
    this.embeddedToFreePositionDiscontinuity = transitionPosition.distanceTo(this.actualGrip);
    this.embeddedToFreeRotationDiscontinuity = transitionQuaternion.angleTo(this.actualQuaternion);
    return true;
  }

  updateSwordRearmGate() {
    const gate = this.rearmGate;
    if (!gate) return;
    const actorBodyMissing = gate.actor?.bodies instanceof Map && !gate.actor.bodies.has(gate.bodyId);
    if (gate.actor?.disposed || actorBodyMissing || !gate.body) {
      this.rearmGate = null;
      this.rearmReady = true;
      if (this.state === SWORD_IMPALEMENT_STATES.returning && this.returnElapsed >= this.returnDuration) this.state = SWORD_IMPALEMENT_STATES.ready;
      return;
    }
    const point = physicsBodyLocalToWorld(gate.body, gate.localPoint, gate.worldPoint);
    const axis = physicsBodyLocalDirectionToWorld(gate.body, gate.localAxis, gate.worldAxis);
    if (!point || !axis) return;
    const signedTipDepth = this.contactScratch.edgeMotion.subVectors(this.currentTip, point).dot(axis);
    this.lastRearmClearance = Math.max(0, -signedTipDepth);
    if (this.lastRearmClearance + SWORD_KINEMATIC_EPSILON < SWORD_THRUST_REARM_DISTANCE) return;
    this.rearmGate = null;
    this.rearmReady = true;
    this.rearmCount = Math.min(1_000_000, this.rearmCount + 1);
    if (this.state === SWORD_IMPALEMENT_STATES.returning && this.returnElapsed >= this.returnDuration) this.state = SWORD_IMPALEMENT_STATES.ready;
  }

  clearInvalidSwordTarget(reason = 'target-invalid') {
    const entry = this.entry;
    if (entry?.directorInteractionId) entry.director.cancelInteraction?.(entry.directorInteractionId, reason);
    if (entry?.woundId) entry.actor?.woundSystem?.markExtracted?.(entry.woundId, { releaseSeverity: 0, direction: null });
    entry?.actor?.setEmbeddedWeapon?.(null);
    this.entry = null;
    this.resetReleaseWithdrawal();
    this.rearmGate = null;
    this.rearmReady = true;
    this.penetrationDepth = 0;
    this.desiredProjectedDepth = 0;
    this.rawDesiredProjectedDepth = 0;
    this.projectionError = 0;
    this.attackEnabled = false;
    this.thrustEligible = false;
    this.maximumDepthReached = 0;
    this.state = SWORD_IMPALEMENT_STATES.ready;
    this.contactState = reason;
    this.contactDamageReason = `non-damaging:${reason}`;
    this.gestureOwnership.release();
    this.poseContinuity.active = false;
    this.measureEmbeddedToFreeContinuity = false;
    this.applyVisualLayer();
    this.penetrationAudioGate.reset();
  }

  sweepPrimitive(primitive, positionsPrepared) {
    return sweepCuttingEdge({ edgePath: primitive.path, previousPosition: this.previousGrip, previousQuaternion: this.previousQuaternion, currentPosition: this.actualGrip, currentQuaternion: this.actualQuaternion, previousStart: primitive.previousStart, previousEnd: primitive.previousEnd, radius: primitive.definition.radius, baseSampleCount: primitive.definition.kind === 'cutting_edge' ? SWORD_EDGE_BASE_SAMPLE_COUNT : 3, maxSampleCount: primitive.definition.kind === 'cutting_edge' ? SWORD_EDGE_MAX_SAMPLE_COUNT : 9, physics: this.physics, colliderFilter: this.colliderFilter, stableAnchorT: 0.55, positionsPrepared, scratch: primitive.scratch });
  }

  resolveEdgeContact(direction, localMotion, positionsPrepared) {
    const candidates = ['leftEdge', 'rightEdge'].map((name) => ({ primitive: this.primitives[name], contact: this.sweepPrimitive(this.primitives[name], positionsPrepared) }));
    const selected = candidates.filter((candidate) => candidate.contact.hit).sort((a, b) => a.contact.toi - b.contact.toi || a.contact.anchorDistance - b.contact.anchorDistance)[0];
    if (!selected) return false;
    this.lastEdgeSampleCount = selected.contact.sampleCount;
    return this.resolveSweptContact(selected, direction, localMotion);
  }

  resolvePrimitiveContact(names, direction, localMotion, positionsPrepared) {
    for (const name of names) {
      const primitive = this.primitives[name];
      const contact = this.sweepPrimitive(primitive, positionsPrepared);
      if (contact.hit && this.resolveSweptContact({ primitive, contact }, direction, localMotion)) return true;
    }
    return false;
  }

  resolveSweptContact({ primitive, contact }, direction, localMotion) {
    const point = contact.hit.witness1
      ? this.contactScratch.point.set(contact.hit.witness1.x, contact.hit.witness1.y, contact.hit.witness1.z)
      : this.contactScratch.point.copy(primitive.scratch.selectedPrevious).lerp(primitive.scratch.selectedCurrent, contact.toi);
    const edgeMotion = this.contactScratch.edgeMotion.subVectors(primitive.scratch.selectedCurrent, primitive.scratch.selectedPrevious);
    return this.resolveContact(contact.hit, point, edgeMotion, primitive.name, direction, localMotion);
  }

  resolveContact(raw, point, contactTravel, part, direction, localMotion) {
    const routed = this.weaponContactRouter.resolveTarget(raw.collider, point);
    if (!routed) return false;
    const normal = raw.normal1
      ? this.contactScratch.normal.set(raw.normal1.x, raw.normal1.y, raw.normal1.z).normalize()
      : this.contactScratch.normal.copy(point).sub(getRigidBodyWorldPosition(routed.hit.body, this.contactScratch.bodyCenter)).normalize();
    const classification = classifySwordContact({ part, speed: this.lastFrameVelocity, localMotion });
    const pressure = Math.max(0, -direction.dot(normal));
    const edgeAlignment = part === 'leftEdge' || part === 'rightEdge' ? THREE.MathUtils.clamp(Math.abs(localMotion.x), 0, 1) : part === 'tip' ? THREE.MathUtils.clamp(-localMotion.z, 0, 1) : 0;
    this.state = SWORD_IMPALEMENT_STATES.surfaceContact;
    this.contactState = classification.classification;
    this.lastContactPart = part;
    this.lastClassification = classification.classification;
    const inwardTravel = Math.max(0, -contactTravel.dot(normal));
    this.actualGrip.addScaledVector(normal, Math.min(0.065, inwardTravel + 0.004));
    this.updateDerivedPose();
    if (classification.damaging) {
      const depth = classification.classification === 'thrust'
        ? THREE.MathUtils.clamp(0.006 + this.lastFrameVelocity * 0.025 * edgeAlignment, 0.006, 0.055)
        : THREE.MathUtils.clamp(0.002 + pressure * 0.018 + this.lastFrameVelocity * edgeAlignment * 0.006, 0.002, 0.026);
      const travel = Math.min(0.12, Math.max(0.003, contactTravel.length()));
      const severity = THREE.MathUtils.clamp(this.lastFrameVelocity * (0.35 + pressure * 0.3) * (0.7 + edgeAlignment * 0.3), 0.12, 1);
      this.trackEdgeDamage({ routed, point, normal, direction, travel, depth, severity, edgeAlignment, swingSpeed: this.lastFrameVelocity, classification: classification.classification, part });
    } else {
      this.finishActiveEdgeDamage(false);
      if (this.elapsed >= this.contactCooldownUntil) {
        this.contactCooldownUntil = this.elapsed + 0.11;
        routed.hit.body?.applyImpulseAtPoint?.(direction.clone().multiplyScalar(Math.min(0.18, 0.035 + this.lastFrameVelocity * 0.045)), point, true);
        const cues = { scrape: 'blade_scrape', flat_strike: 'blunt_contact', guard_impact: 'blunt_contact', grip_impact: 'clothing_contact' };
        routed.director.reportContact({ weapon: this.weaponDefinition, intent: this.intentState, hit: routed.hit, position: point, direction, cue: cues[classification.classification], severity: Math.min(0.8, 0.16 + this.lastFrameVelocity * 0.18), resistance: classification.classification, weaponAdapter: this });
      }
    }
    return true;
  }

  trackEdgeDamage({ routed, point, normal, direction, travel, depth, severity, edgeAlignment, swingSpeed, classification, part }) {
    const active = this.activeEdgeDamage;
    const adjacentRegion = active?.actor?.areAnatomyRegionsAdjacent?.(active.regionId, routed.hit.regionId) === true;
    const samePath = active && active.actor === routed.actor && (active.regionId === routed.hit.regionId || adjacentRegion) && active.classification === classification && active.lastPoint.distanceTo(point) <= 0.24;
    if (!samePath) {
      this.finishActiveEdgeDamage(false);
      const interaction = routed.director.beginEdgeDamage({ weapon: this.weaponDefinition, intent: this.intentState, hit: routed.hit, point, localPoint: routed.hit.localPoint, surfaceNormal: normal, direction, travel, depth, severity, edgeAlignment, swingSpeed, classification, part, weaponAdapter: this, penetrationAudioGate: this.penetrationAudioGate });
      if (!interaction) return;
      this.activeEdgeDamage = { actor: routed.actor, director: routed.director, interactionId: interaction.id, bodyId: routed.hit.bodyId, regionId: routed.hit.regionId, classification, part, hit: routed.hit, lastPoint: point.clone(), lastNormal: normal.clone(), lastDirection: direction.clone(), pendingTravel: 0, pendingSeverity: 0, pendingDepth: 0, pendingEdgeAlignment: 0, pendingSwingSpeed: 0, pendingSamples: 0 };
      this.edgeDamageCount += 1;
      return;
    }
    active.pendingTravel += travel;
    active.pendingSeverity += severity;
    active.pendingDepth = Math.max(active.pendingDepth, depth);
    active.pendingEdgeAlignment += edgeAlignment;
    active.pendingSwingSpeed = Math.max(active.pendingSwingSpeed, swingSpeed);
    active.pendingSamples += 1;
    active.hit = routed.hit;
    active.bodyId = routed.hit.bodyId;
    active.regionId = routed.hit.regionId;
    active.lastPoint.copy(point);
    active.lastNormal.copy(normal);
    active.lastDirection.copy(direction);
    if (active.pendingTravel >= 0.012) this.flushActiveEdgeDamage();
  }

  flushActiveEdgeDamage() {
    const active = this.activeEdgeDamage;
    if (!active?.pendingSamples) return false;
    const count = active.pendingSamples;
    active.director.extendEdgeDamage(active.interactionId, { hit: active.hit, point: active.lastPoint, localPoint: active.hit.localPoint, surfaceNormal: active.lastNormal, direction: active.lastDirection, travel: active.pendingTravel, depth: active.pendingDepth, severity: active.pendingSeverity / count, edgeAlignment: active.pendingEdgeAlignment / count, swingSpeed: active.pendingSwingSpeed });
    active.pendingTravel = 0;
    active.pendingSeverity = 0;
    active.pendingDepth = 0;
    active.pendingEdgeAlignment = 0;
    active.pendingSwingSpeed = 0;
    active.pendingSamples = 0;
    return true;
  }

  finishActiveEdgeDamage(interrupted = false) {
    if (!this.activeEdgeDamage) return false;
    this.flushActiveEdgeDamage();
    this.activeEdgeDamage.director.finishEdgeDamage(this.activeEdgeDamage.interactionId, interrupted);
    this.activeEdgeDamage = null;
    return true;
  }

  afterPhysics() {
    if (!this.visual.visible) return;
    this.resistanceKick *= Math.exp(-24 * this.lastPhysicsDt);
    this.visual.position.copy(this.actualGrip);
    if (!this.entry) this.visual.position.add(this.contactScratch.correction.set(0, 0, this.resistanceKick).applyQuaternion(this.actualQuaternion));
    this.visual.quaternion.copy(this.actualQuaternion);
    this.visibleCollisionError = this.entry ? this.visual.position.distanceTo(this.actualGrip) : 0;
  }

  afterPhysicsStep(dt = 0) {
    if (this.ownsCombatDirector) this.combatDirector.update(dt);
  }

  onCombatResistance(payload = {}) {
    this.resistanceKick = Math.max(this.resistanceKick, Math.min(0.018, (payload.intensity ?? 0) * 0.012));
  }

  onCombatRecovery() {
    if (!this.entry && this.state === SWORD_IMPALEMENT_STATES.surfaceContact && this.gripPointerId != null) this.state = SWORD_IMPALEMENT_STATES.attacking;
  }

  cancelTarget(actor, reason = 'target-cancelled') {
    if (this.entry?.actor === actor) {
      this.clearInvalidSwordTarget(reason);
      return true;
    }
    if (this.activeEdgeDamage?.actor === actor) {
      this.finishActiveEdgeDamage(true);
      this.contactState = reason;
      return true;
    }
    return false;
  }

  getActiveToolId() { return this.isEquipped() ? this.config.itemId : null; }

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
    const projected = this.currentTip.clone().project(this.camera);
    const rect = viewport.getBoundingClientRect();
    return { x: rect.left + (projected.x * 0.5 + 0.5) * rect.width, y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height, depth: projected.z, toolId: this.config.itemId, kind: 'sword-tip' };
  }

  setGestureState(gesture = {}) {
    if (gesture.active && gesture.toolId === this.config.itemId) {
      if (this.gripPointerId == null) this.acquireGrip(gesture.pointerId, gesture.startX, gesture.startY, gesture.samples?.[0]?.timeMs ?? performance.now());
      this.applyGripGesture(gesture.pointerId, gesture.deltaX ?? 0, gesture.deltaY ?? 0, gesture.x ?? gesture.startX, gesture.y ?? gesture.startY, gesture.samples?.at?.(-1)?.timeMs ?? performance.now());
    } else if (this.gripPointerId != null) this.releaseGrip('external-gesture-release');
  }

  impact() {}
  setDebugVisible(visible) { this.debugVisible = Boolean(visible); }

  nudgeExtension(delta) {
    if (this.gripPointerId == null) this.acquireGrip('keyboard-debug', 0, 0);
    this.desiredExtension = THREE.MathUtils.clamp(this.desiredExtension + delta, 0, this.config.workspace.thrustDistance);
    this.deliberateInputVelocity.set(0, 0, -Math.sign(delta) * 0.9);
    if (!this.entry) this.state = SWORD_IMPALEMENT_STATES.attacking;
  }

  nudgeAim(deltaX = 0, deltaY = 0) {
    if (this.gripPointerId == null) this.acquireGrip('keyboard-debug', 0, 0);
    this.aimX = THREE.MathUtils.clamp(this.aimX + deltaX, -1, 1);
    this.aimY = THREE.MathUtils.clamp(this.aimY + deltaY, -1, 1);
    this.deliberateInputVelocity.set(deltaX * 2, deltaY * 2, 0);
    if (!this.entry) this.state = SWORD_IMPALEMENT_STATES.attacking;
  }

  cancel(reason = 'cancelled') {
    const entry = this.entry;
    if (entry?.directorInteractionId) entry.director.cancelInteraction?.(entry.directorInteractionId, reason);
    if (entry?.woundId) entry.actor?.woundSystem?.markExtracted?.(entry.woundId, { releaseSeverity: 0, direction: null });
    entry?.actor?.setEmbeddedWeapon?.(null);
    this.entry = null;
    this.resetReleaseWithdrawal();
    this.rearmGate = null;
    this.rearmReady = true;
    this.penetrationDepth = 0;
    this.desiredProjectedDepth = 0;
    this.rawDesiredProjectedDepth = 0;
    this.projectionError = 0;
    this.gestureOwnership.release();
    this.finishActiveEdgeDamage(true);
    this.aimX = 0;
    this.aimY = 0;
    this.desiredExtension = 0;
    this.attackEnabled = false;
    this.thrustEligible = false;
    this.maximumDepthReached = 0;
    this.actualTipSpeed = 0;
    this.forwardSpeed = 0;
    this.forwardRatio = 0;
    this.state = SWORD_IMPALEMENT_STATES.ready;
    this.contactState = reason;
    this.contactDamageReason = `non-damaging:${reason}`;
    this.lastContactPart = 'none';
    this.lastClassification = 'none';
    this.deliberateInputVelocity.set(0, 0, 0);
    this.offensiveVelocity.set(0, 0, 0);
    this.poseContinuity.active = false;
    this.poseContinuity.holdWhileEmbedded = false;
    this.poseContinuity.localPositionOffset.set(0, 0, 0);
    this.poseContinuity.localQuaternionOffset.identity();
    this.measureEmbeddedToFreeContinuity = false;
    this.applyVisualLayer();
    this.penetrationAudioGate.reset();
  }

  reset() {
    this.cancel('reset');
    this.intentWeapon.reset();
    this.initializePose();
  }

  getDiagnostics() {
    const worldLightIntersectionStatus = getWeaponWorldLightIntersectionStatus(this.visual, this.scene);
    return {
      itemId: this.config.itemId,
      equipped: this.isEquipped(),
      runtimeCombatMode: SWORD_RUNTIME_COMBAT_MODE,
      state: this.state,
      impalementState: this.state,
      contactState: this.contactState,
      contactDamageReason: this.contactDamageReason,
      attackEnabled: this.attackEnabled,
      inputOwner: this.gripPointerId,
      actualTipSpeed: Number(this.actualTipSpeed.toFixed(4)),
      forwardSpeed: Number(this.forwardSpeed.toFixed(4)),
      forwardRatio: Number(this.forwardRatio.toFixed(4)),
      thrustEligible: this.thrustEligible,
      tipSweepCount: this.tipSweepCount,
      lastContactPart: this.lastContactPart,
      lastClassification: this.lastClassification,
      ownedTargetActor: this.entry?.actor?.instanceId ?? this.entry?.actor?.id ?? null,
      entryBody: this.entry?.bodyId ?? null,
      entryRegion: this.entry?.regionId ?? null,
      depthInputMode: this.releaseWithdrawal.active ? 'release-time-eased-withdrawal' : this.entry && this.gripPointerId != null ? 'desired-tip-entry-axis-projection' : 'free-pointer-tracking',
      desiredProjectedDepth: Number(this.desiredProjectedDepth.toFixed(4)),
      rawDesiredProjectedDepth: Number(this.rawDesiredProjectedDepth.toFixed(4)),
      penetrationDepth: Number(this.penetrationDepth.toFixed(4)),
      projectionError: Number(this.projectionError.toFixed(6)),
      maximumPenetrationDepth: SWORD_MAXIMUM_PENETRATION_DEPTH,
      maximumDepthReached: Number(this.maximumDepthReached.toFixed(4)),
      penetrationRate: SWORD_PENETRATION_RATE_METERS_PER_SECOND,
      withdrawalRate: SWORD_WITHDRAWAL_RATE_METERS_PER_SECOND,
      releaseExtractionActive: this.releaseWithdrawal.active,
      releaseExtractionDuration: SWORD_RELEASE_EXTRACTION_DURATION,
      releaseExtractionElapsed: Number(this.releaseWithdrawal.elapsed.toFixed(4)),
      releaseExtractionProgress: Number(this.releaseWithdrawal.progress.toFixed(4)),
      releaseStartDepth: Number(this.releaseWithdrawal.startDepth.toFixed(4)),
      punctureWoundId: this.entry?.woundId ?? null,
      punctureBeginCount: this.punctureBeginCount,
      extractionCount: this.extractionCount,
      lastExtractionReason: this.lastExtractionReason,
      rearmCount: this.rearmCount,
      rearmReady: this.rearmReady,
      rearmClearance: Number(this.lastRearmClearance.toFixed(4)),
      rearmDistance: SWORD_THRUST_REARM_DISTANCE,
      suppressedNonTipContacts: this.suppressedNonTipContacts,
      visibleCollisionError: Number(this.visibleCollisionError.toFixed(6)),
      embeddedToFreePositionDiscontinuity: Number(this.embeddedToFreePositionDiscontinuity.toFixed(6)),
      embeddedToFreeRotationDiscontinuity: Number(THREE.MathUtils.radToDeg(this.embeddedToFreeRotationDiscontinuity).toFixed(4)),
      lastEdgeSampleCount: this.lastEdgeSampleCount,
      edgeDamageCount: this.edgeDamageCount,
      activeEdgeDamage: this.activeEdgeDamage?.interactionId ?? null,
      visualAssetState: this.visualAssetState,
      visualDepthMode: this.visualLayerMode === 'world' ? 'world-occluded' : 'viewmodel',
      visualLayerMode: this.visualLayerMode,
      currentRenderLayer: getWeaponRenderLayer(this.visual),
      worldLightIntersectionStatus,
      outdoorMaterialRegistrationStatus: this.outdoorMaterialRegistration.status,
      currentOutdoorEmissiveScale: this.outdoorLightingDirector?.currentOrdinaryEmissiveScale ?? this.outdoorMaterialRegistration.ordinaryEmissiveScale ?? null,
      transitionLightingDiscontinuityCount: this.transitionLightingDiscontinuityCount,
      transitionLightingDiscontinuityCounter: this.transitionLightingDiscontinuityCount,
      assetPath: DREADSTONE_SWORD_GLB_PATH,
      dimensions: DREADSTONE_SWORD_DIMENSIONS,
      penetrationAudio: this.penetrationAudioGate.getDiagnostics(),
    };
  }

  dispose() {
    if (this.disposed) return;
    this.cancel('disposed');
    this.disposed = true;
    this.disposers.forEach((dispose) => dispose?.());
    this.disposers = [];
    if (this.ownsCombatDirector) this.combatDirector.dispose();
    disposeOwnedWeaponVisual({ root: this.visual, geometries: this.visualGeometries, materials: this.visualMaterials });
  }
}
