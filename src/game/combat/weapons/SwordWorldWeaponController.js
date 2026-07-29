import * as THREE from 'three';
import { CombatDirector } from '../CombatDirector.js';
import { advancePenetrationDepth, deriveBladeTip } from '../CombatMath.js';
import { KNIFE_COMBAT_CONFIG } from '../CombatConfig.js';
import { capturePhysicsBodyTransform, physicsBodyLocalDirectionToWorld, physicsBodyLocalToWorld, worldDirectionToPhysicsBodyLocal } from '../CombatCoordinateSpaces.js';
import { isDamageIntent, MELEE_INTENTS, MeleeIntentWeapon } from '../MeleeIntentWeapon.js';
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
import { WeaponPresentationRuntime } from './WeaponViewmodelAnchor.js';

export const DREADSTONE_SWORD_GLB_PATH = './assets/weapons/melee/dreadstone_sword_v002.glb';
export const SWORD_VIEWMODEL_LAYER = WEAPON_VIEWMODEL_LAYER;
export const DREADSTONE_SWORD_MODEL_SCALE = 0.85;
export const SWORD_EDGE_BASE_SAMPLE_COUNT = 5;
export const SWORD_EDGE_MAX_SAMPLE_COUNT = 17;
export const SWORD_EDGE_COLLISION_RADIUS = 0.012 * DREADSTONE_SWORD_MODEL_SCALE;
export const SWORD_RUNTIME_COMBAT_MODE = 'puncture_only';
export const SWORD_THRUST_MIN_FORWARD_SPEED = 0.16;
export const SWORD_THRUST_MIN_FORWARD_RATIO = 0.55;
export const SWORD_THRUST_REARM_DISTANCE = 0.05;
export const SWORD_PENETRATION_RATE_METERS_PER_SECOND = KNIFE_COMBAT_CONFIG.penetrationRate;
export const SWORD_WITHDRAWAL_RATE_METERS_PER_SECOND = KNIFE_COMBAT_CONFIG.withdrawalRate;
export const SWORD_EXTRACTION_CONTINUITY_DURATION = 0.1;
export const SWORD_LATERAL_BIND_DISTANCE = KNIFE_COMBAT_CONFIG.lateralBindDistance;
export const SWORD_FORCED_EXTRACTION_DISTANCE = KNIFE_COMBAT_CONFIG.forcedExtractionDistance;
export const SWORD_FORCE_TRANSFER = KNIFE_COMBAT_CONFIG.forceTransfer;

// Authored v002 measurements. Collision intentionally does not inspect render triangles.
export const DREADSTONE_SWORD_SOURCE_DIMENSIONS = Object.freeze({
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

const scaleSwordMeters = (value) => value * DREADSTONE_SWORD_MODEL_SCALE;
const scaleSwordPoint = (point) => Object.freeze(point.map(scaleSwordMeters));

export const DREADSTONE_SWORD_DIMENSIONS = Object.freeze({
  boundsMin: scaleSwordPoint(DREADSTONE_SWORD_SOURCE_DIMENSIONS.boundsMin),
  boundsMax: scaleSwordPoint(DREADSTONE_SWORD_SOURCE_DIMENSIONS.boundsMax),
  overallLength: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.overallLength),
  tipZ: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.tipZ),
  bladeHeelZ: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.bladeHeelZ),
  bladeShoulderZ: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.bladeShoulderZ),
  bladeLength: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.bladeLength),
  bladeWidth: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.bladeWidth),
  bladeThickness: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.bladeThickness),
  bladeHalfWidth: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.bladeHalfWidth),
  bladeHalfThickness: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.bladeHalfThickness),
  guardCenterZ: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.guardCenterZ),
  guardHalfSpan: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.guardHalfSpan),
  guardRadius: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.guardRadius),
  gripMinZ: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.gripMinZ),
  gripMaxZ: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.gripMaxZ),
  gripRadius: scaleSwordMeters(DREADSTONE_SWORD_SOURCE_DIMENSIONS.gripRadius),
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
  returning: 'returning',
});

export const SWORD_CONTACT_PRIMITIVES = Object.freeze({
  tip: Object.freeze({ kind: 'point', point: Object.freeze([0, 0, DREADSTONE_SWORD_DIMENSIONS.tipZ]), radius: scaleSwordMeters(0.014) }),
  leftEdge: Object.freeze({ kind: 'cutting_edge', points: Object.freeze([scaleSwordPoint([-0.035, 0, -0.214]), scaleSwordPoint([-0.0355, 0, -0.70]), Object.freeze([0, 0, DREADSTONE_SWORD_DIMENSIONS.tipZ])]), radius: SWORD_EDGE_COLLISION_RADIUS }),
  rightEdge: Object.freeze({ kind: 'cutting_edge', points: Object.freeze([scaleSwordPoint([0.035, 0, -0.214]), scaleSwordPoint([0.0355, 0, -0.70]), Object.freeze([0, 0, DREADSTONE_SWORD_DIMENSIONS.tipZ])]), radius: SWORD_EDGE_COLLISION_RADIUS }),
  flat: Object.freeze({ kind: 'blade_flat', points: Object.freeze([scaleSwordPoint([0, 0, -0.22]), scaleSwordPoint([0, 0, -0.84])]), radius: scaleSwordMeters(0.031) }),
  spine: Object.freeze({ kind: 'blade_spine', points: Object.freeze([scaleSwordPoint([0, DREADSTONE_SWORD_SOURCE_DIMENSIONS.bladeHalfThickness, -0.22]), scaleSwordPoint([0, DREADSTONE_SWORD_SOURCE_DIMENSIONS.bladeHalfThickness, -0.82])]), radius: scaleSwordMeters(0.014) }),
  guard: Object.freeze({ kind: 'guard', points: Object.freeze([Object.freeze([-DREADSTONE_SWORD_DIMENSIONS.guardHalfSpan, 0, DREADSTONE_SWORD_DIMENSIONS.guardCenterZ]), Object.freeze([DREADSTONE_SWORD_DIMENSIONS.guardHalfSpan, 0, DREADSTONE_SWORD_DIMENSIONS.guardCenterZ])]), radius: DREADSTONE_SWORD_DIMENSIONS.guardRadius }),
  grip: Object.freeze({ kind: 'grip', points: Object.freeze([Object.freeze([0, 0, DREADSTONE_SWORD_DIMENSIONS.gripMinZ]), Object.freeze([0, 0, DREADSTONE_SWORD_DIMENSIONS.gripMaxZ])]), radius: DREADSTONE_SWORD_DIMENSIONS.gripRadius }),
});

export const SWORD_REACH_COMPENSATION = Math.abs(DREADSTONE_SWORD_SOURCE_DIMENSIONS.tipZ) - Math.abs(DREADSTONE_SWORD_DIMENSIONS.tipZ);
const preserveSwordTipReach = (point) => Object.freeze([point[0], point[1], point[2] - SWORD_REACH_COMPENSATION]);

export const SWORD_WORLD_WEAPON_CONFIG = Object.freeze({
  itemId: 'dreadstone_sword',
  tipLength: Math.abs(DREADSTONE_SWORD_DIMENSIONS.tipZ),
  minimumAttackSpeed: 0.05,
  gripZone: Object.freeze({ minimumRadiusPx: 38, maximumRadiusPx: 74, viewportRatio: 0.082 }),
  workspace: Object.freeze({
    ready: preserveSwordTipReach([0.16, -0.24, -0.50]),
    min: preserveSwordTipReach([-0.36, -0.43, -1.03]),
    max: preserveSwordTipReach([0.43, 0.10, -0.42]),
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
  constructor({ app, scene, camera, viewmodelAnchor = null, player, actor, physics, equipmentRuntime, controls, feedback = null, feedbackSystem = null, combatDirector = null, combatRouter = null, contactActivationProvider = null, edgeSweepObserver = null, outdoorLightingDirector = null, visualAssetLoader = loadDreadstoneSwordAsset, bindPointerInput = true } = {}) {
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
    this.edgeSweepObserver = edgeSweepObserver;
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
    this.renderLocalGrip = new THREE.Vector3();
    this.renderLocalQuaternion = new THREE.Quaternion();
    this.authoritativeLocalGrip = new THREE.Vector3();
    this.authoritativeLocalQuaternion = new THREE.Quaternion();
    this.displayedLocalGrip = new THREE.Vector3();
    this.displayedLocalQuaternion = new THREE.Quaternion();
    this.displayedWorldGrip = new THREE.Vector3();
    this.displayedWorldQuaternion = new THREE.Quaternion();
    this.authoritativeTip = new THREE.Vector3();
    this.displayedTip = new THREE.Vector3();
    this.presentationPositionError = 0;
    this.presentationRotationErrorDegrees = 0;
    this.presentationTipError = 0;
    this.maximumPresentationTipError = 0;
    this.presentationEdgeError = 0;
    this.maximumPresentationEdgeError = 0;
    this.extractionPositionOffset = new THREE.Vector3();
    this.extractionQuaternionOffset = new THREE.Quaternion();
    this.extractionOffsetActive = false;
    this.extractionOffsetAge = 0;
    this.extractionCycleCount = 0;
    this.continuityScratch = {
      preservedLocalGrip: new THREE.Vector3(),
      canonicalLocalGrip: new THREE.Vector3(),
      correctedLocalGrip: new THREE.Vector3(),
      cameraQuaternion: new THREE.Quaternion(),
      preservedLocalQuaternion: new THREE.Quaternion(),
      canonicalLocalQuaternion: new THREE.Quaternion(),
      correctedLocalQuaternion: new THREE.Quaternion(),
      decayedQuaternionOffset: new THREE.Quaternion(),
    };
    this.desiredTip = new THREE.Vector3();
    this.currentTip = new THREE.Vector3();
    this.previousTip = new THREE.Vector3();
    this.previousCloseRangeEntryProbe = new THREE.Vector3();
    this.currentCloseRangeEntryProbe = new THREE.Vector3();
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
    this.rearmCheckDelayFrames = 0;
    this.lastExtractionReason = null;
    this.entryResistanceElapsed = 0;
    this.entryResistanceActive = false;
    this.extractionDetected = false;
    this.sameTargetCollisionSuppressionCount = 0;
    this.otherTargetContactWhileEmbeddedCount = 0;
    this.directControlTrackingErrorWhileEmbedded = 0;
    this.maximumDirectControlTrackingErrorWhileEmbedded = 0;
    this.lastEmbeddedDirectControlTrackingError = 0;
    this.lastImpalementCleanupReason = null;
    this.impalementCleanupCount = 0;
    this.tipSweepCount = 0;
    this.closeRangeEntrySweepCount = 0;
    this.closeRangeEntryHitCount = 0;
    this.lastEntryProbe = 'none';
    this.suppressedNonTipContacts = 0;
    this.embeddedToFreePositionDiscontinuity = 0;
    this.embeddedToFreeRotationDiscontinuity = 0;
    this.measureEmbeddedToFreeContinuity = false;
    this.transitionLightingDiscontinuityCount = 0;
    this.currentRenderLayer = null;
    this.outdoorMaterialRegistration = { status: outdoorLightingDirector ? 'pending' : 'unavailable', registered: false, eligibleMaterialCount: 0, ordinaryEmissiveScale: null };
    this.activeEdgeDamage = null;
    this.edgeDamageCount = 0;
    this.primitives = Object.fromEntries(['leftEdge', 'rightEdge', 'flat', 'spine', 'guard', 'grip'].map((name) => [name, makePrimitiveRuntime(name)]));
    this.colliderFilter = (collider) => this.weaponContactRouter.ownsCollider(collider);
    this.embeddedColliderFilter = (collider) => this.shouldResolveEmbeddedCollider(collider);
    this.poseRebaseRequest = { camera: this.camera, poseWorkspace: this.poseWorkspace, anchored: false, positions: [this.actualGrip, this.previousGrip, this.desiredGrip, this.currentTip, this.previousTip, this.desiredTip], quaternions: [this.actualQuaternion, this.previousQuaternion, this.desiredQuaternion] };
    this.desiredPoseRequest = { camera: this.camera, workspace: this.config.workspace, poseWorkspace: this.poseWorkspace, aimX: 0, aimY: 0, extension: 0, pitchFromAimY: 0.32, yawFromAimX: -0.36, rollFromAimX: -0.24, tipLength: this.config.tipLength, desiredGrip: this.desiredGrip, desiredQuaternion: this.desiredQuaternion, desiredTip: this.desiredTip };
    this.disposers = [];
    this.disposed = false;
    this.debugVisible = false;
    this.buildVisual();
    this.presentation = new WeaponPresentationRuntime({ itemId: this.config.itemId, root: this.visual, scene: this.scene, camera: this.camera, viewmodelAnchor: this.viewmodelAnchor });
    this.presentation.recordLayer(SWORD_VIEWMODEL_LAYER);
    this.initializePose();
    if (bindPointerInput) this.bindInput();
  }

  buildVisual() {
    this.visual = new THREE.Group();
    this.visual.name = 'dreadstone-sword-authoritative-world-weapon';
    this.visualModelRoot = null;
    this.visualGeometries = [];
    this.visualMaterials = [];
    this.visualAssetState = 'loading';
    this.applyVisualLayer();
    this.visualLoadPromise = this.visualAssetLoader().then((source) => {
      const owned = cloneOwnedWeaponVisual(source);
      if (this.disposed) {
        disposeOwnedWeaponVisual(owned);
        return 'disposed';
      }
      owned.root.name = 'dreadstone-sword-v002-glb-visual';
      owned.root.userData.sourceAsset = DREADSTONE_SWORD_GLB_PATH;
      owned.root.userData.authoritativeCombatScale = DREADSTONE_SWORD_MODEL_SCALE;
      owned.root.scale.multiplyScalar(DREADSTONE_SWORD_MODEL_SCALE);
      this.visualModelRoot = owned.root;
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
    const fallbackRoot = new THREE.Group();
    fallbackRoot.name = 'dreadstone-sword-fallback-scaled-visual';
    fallbackRoot.userData.authoritativeCombatScale = DREADSTONE_SWORD_MODEL_SCALE;
    fallbackRoot.scale.setScalar(DREADSTONE_SWORD_MODEL_SCALE);
    const steel = new THREE.MeshStandardMaterial({ color: 0x7b7f80, roughness: 0.48, metalness: 0.72 });
    const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x2d241d, roughness: 0.9 });
    const bladeGeometry = new THREE.BoxGeometry(0.071, 0.016, 0.67);
    const guardGeometry = new THREE.BoxGeometry(0.196, 0.032, 0.045);
    const gripGeometry = new THREE.CylinderGeometry(0.019, 0.021, 0.295, 8);
    const blade = new THREE.Mesh(bladeGeometry, steel);
    blade.position.z = -0.55;
    const guard = new THREE.Mesh(guardGeometry, steel);
    guard.position.z = DREADSTONE_SWORD_SOURCE_DIMENSIONS.guardCenterZ;
    const grip = new THREE.Mesh(gripGeometry, gripMaterial);
    grip.rotation.x = Math.PI / 2;
    grip.position.z = 0.0475;
    fallbackRoot.add(blade, guard, grip);
    this.visualModelRoot = fallbackRoot;
    this.visual.add(fallbackRoot);
    this.visualGeometries.push(bladeGeometry, guardGeometry, gripGeometry);
    this.visualMaterials.push(steel, gripMaterial);
    this.registerOutdoorMaterials(fallbackRoot);
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
    this.presentation?.recordLayer?.(nextLayer);
    if (embeddedInWorld) this.presentation?.transitionToWorld?.({ preserveWorld: true });
    else if (this.visual?.visible !== false) this.presentation?.transitionToViewmodel?.({ preserveWorld: true, extraction: this.presentation?.presentationMode === 'world' });
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
    this.captureFreeRenderPose(true);
  }

  captureFreeRenderPose() {
    if (this.entry || !this.camera) return false;
    this.camera.updateMatrixWorld(true);
    this.authoritativeLocalGrip.copy(this.actualGrip);
    this.camera.worldToLocal(this.authoritativeLocalGrip);
    this.camera.getWorldQuaternion(this.continuityScratch.cameraQuaternion);
    this.authoritativeLocalQuaternion.copy(this.continuityScratch.cameraQuaternion).invert().multiply(this.actualQuaternion).normalize();
    this.renderLocalGrip.copy(this.authoritativeLocalGrip);
    this.renderLocalQuaternion.copy(this.authoritativeLocalQuaternion);
    return true;
  }

  beginAuthoritativeExtractionContinuity(worldPosition, worldQuaternion) {
    if (!this.camera || !worldPosition || !worldQuaternion) return false;
    const scratch = this.continuityScratch;
    this.camera.updateMatrixWorld(true);
    scratch.preservedLocalGrip.copy(worldPosition);
    this.camera.worldToLocal(scratch.preservedLocalGrip);
    scratch.canonicalLocalGrip.copy(this.desiredGrip);
    this.camera.worldToLocal(scratch.canonicalLocalGrip);
    this.camera.getWorldQuaternion(scratch.cameraQuaternion);
    scratch.preservedLocalQuaternion.copy(scratch.cameraQuaternion).invert().multiply(worldQuaternion).normalize();
    scratch.canonicalLocalQuaternion.copy(scratch.cameraQuaternion).invert().multiply(this.desiredQuaternion).normalize();
    this.extractionPositionOffset.subVectors(scratch.preservedLocalGrip, scratch.canonicalLocalGrip);
    this.extractionQuaternionOffset.copy(scratch.canonicalLocalQuaternion).invert().multiply(scratch.preservedLocalQuaternion).normalize();
    this.extractionOffsetAge = 0;
    this.extractionOffsetActive = this.extractionPositionOffset.lengthSq() > 1e-12
      || this.extractionQuaternionOffset.angleTo(identityQuaternion) > 1e-8;
    this.extractionCycleCount = Math.min(1_000_000, this.extractionCycleCount + 1);
    this.applyFreeSwordAuthoritativePose(0);
    this.captureFreeRenderPose();
    return true;
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
    if (!this.isEquipped() || !this.gestureOwnership.acquire(pointerId, clientX, clientY, timeMs)) return false;
    if (this.entry) this.state = SWORD_IMPALEMENT_STATES.embedded;
    else if (this.state !== SWORD_IMPALEMENT_STATES.returning) this.state = SWORD_IMPALEMENT_STATES.ready;
    this.edgeSweepObserver?.beginGesture?.({ pointerId, controller: this });
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
    this.edgeSweepObserver?.endGesture?.(reason);
    this.gestureOwnership.release();
    this.finishActiveEdgeDamage(reason !== 'pointer-release');
    this.attackEnabled = false;
    this.offensiveVelocity.set(0, 0, 0);
    if (this.entry) {
      this.entry.plantedDesiredGrip.copy(this.desiredGrip);
      this.state = SWORD_IMPALEMENT_STATES.embedded;
      this.contactState = SWORD_IMPALEMENT_STATES.embedded;
      this.contactDamageReason = 'non-damaging:planted-embedded-hold';
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
    this.presentation.recordPhysicalCameraMatrix();
    this.poseRebaseRequest.anchored = Boolean(this.entry);
    rebaseWorldWeaponPoseToCamera(this.poseRebaseRequest);
    this.updateInput(dt);
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
    if (!this.entry) {
      this.captureFreeRenderPose();
      const deliberateEnergy = this.lastFrameVelocity >= this.config.minimumAttackSpeed;
      const intentionalState = [SWORD_IMPALEMENT_STATES.attacking, SWORD_IMPALEMENT_STATES.surfaceContact].includes(this.state);
      this.edgeSweepObserver?.update?.({ controller: this, dt, contactActive, deliberateEnergy, intentionalState, embedded: false });
    }
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

  applyFreeSwordAuthoritativePose(dt) {
    if (!this.extractionOffsetActive) {
      this.actualGrip.copy(this.desiredGrip);
      this.actualQuaternion.copy(this.desiredQuaternion);
      return;
    }
    const scratch = this.continuityScratch;
    this.extractionOffsetAge = Math.min(SWORD_EXTRACTION_CONTINUITY_DURATION, this.extractionOffsetAge + Math.max(0, Number(dt) || 0));
    const progress = THREE.MathUtils.clamp(this.extractionOffsetAge / SWORD_EXTRACTION_CONTINUITY_DURATION, 0, 1);
    const easedProgress = progress * progress * (3 - 2 * progress);
    const offsetWeight = 1 - easedProgress;
    this.camera.updateMatrixWorld(true);
    scratch.canonicalLocalGrip.copy(this.desiredGrip);
    this.camera.worldToLocal(scratch.canonicalLocalGrip);
    this.camera.getWorldQuaternion(scratch.cameraQuaternion);
    scratch.canonicalLocalQuaternion.copy(scratch.cameraQuaternion).invert().multiply(this.desiredQuaternion).normalize();
    scratch.correctedLocalGrip.copy(scratch.canonicalLocalGrip).addScaledVector(this.extractionPositionOffset, offsetWeight);
    scratch.decayedQuaternionOffset.slerpQuaternions(identityQuaternion, this.extractionQuaternionOffset, offsetWeight).normalize();
    scratch.correctedLocalQuaternion.copy(scratch.canonicalLocalQuaternion).multiply(scratch.decayedQuaternionOffset).normalize();
    this.actualGrip.copy(scratch.correctedLocalGrip);
    this.camera.localToWorld(this.actualGrip);
    this.actualQuaternion.copy(scratch.cameraQuaternion).multiply(scratch.correctedLocalQuaternion).normalize();
    if (progress >= 1) {
      this.extractionOffsetActive = false;
      this.measureEmbeddedToFreeContinuity = false;
      this.extractionPositionOffset.set(0, 0, 0);
      this.extractionQuaternionOffset.identity();
      this.presentation.endExtractionContinuity();
    }
  }

  solveFreeSwordPose(dt, contactActive) {
    // Free-space tracking stays direct. The authored point displacement, rather
    // than pointer-leading-part classification, owns thrust recognition.
    this.applyFreeSwordAuthoritativePose(dt);
    this.updateDerivedPose();
    this.updateTipKinematics(dt);
    this.updateSwordRearmGate(true);
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
    if (!this.resolveSwordThrustEntryContact(this.tipContactDirection, positionsPrepared)) this.recordSuppressedNonTipContact();
  }

  recordSuppressedNonTipContact() {
    this.suppressedNonTipContacts = Math.min(1_000_000, this.suppressedNonTipContacts + 1);
  }

  resolveSwordThrustEntryContact(contactDirection, positionsPrepared) {
    if (this.tipDisplacement.lengthSq() < SWORD_KINEMATIC_EPSILON ** 2) return false;
    this.tipSweepCount = Math.min(1_000_000, this.tipSweepCount + 1);
    let previousProbe = this.previousTip;
    let currentProbe = this.currentTip;
    let entryProbe = 'tip';
    let raw = this.physics.castWeaponTip(previousProbe, currentProbe, SWORD_CONTACT_PRIMITIVES.tip.radius, this.colliderFilter, positionsPrepared);
    if (!raw?.collider) {
      this.previousCloseRangeEntryProbe
        .set(0, 0, DREADSTONE_SWORD_DIMENSIONS.bladeHeelZ)
        .applyQuaternion(this.previousQuaternion)
        .add(this.previousGrip);
      this.currentCloseRangeEntryProbe
        .set(0, 0, DREADSTONE_SWORD_DIMENSIONS.bladeHeelZ)
        .applyQuaternion(this.actualQuaternion)
        .add(this.actualGrip);
      previousProbe = this.previousCloseRangeEntryProbe;
      currentProbe = this.currentCloseRangeEntryProbe;
      entryProbe = 'blade_heel';
      this.closeRangeEntrySweepCount = Math.min(1_000_000, this.closeRangeEntrySweepCount + 1);
      raw = this.physics.castWeaponTip(previousProbe, currentProbe, SWORD_CONTACT_PRIMITIVES.tip.radius, this.colliderFilter, positionsPrepared);
    }
    if (!raw?.collider) return false;
    const toi = THREE.MathUtils.clamp(raw.time_of_impact ?? 0, 0, 1);
    const point = raw.witness1
      ? this.contactScratch.point.set(raw.witness1.x, raw.witness1.y, raw.witness1.z)
      : this.contactScratch.point.copy(previousProbe).lerp(currentProbe, toi);
    const routed = this.weaponContactRouter.resolveTarget(raw.collider, point);
    if (!routed) return false;
    const normal = raw.normal1
      ? this.contactScratch.normal.set(raw.normal1.x, raw.normal1.y, raw.normal1.z).normalize()
      : this.contactScratch.normal.copy(point).sub(getRigidBodyWorldPosition(routed.hit.body, this.contactScratch.bodyCenter)).normalize();
    const accepted = this.beginSwordPenetration({ routed, point, normal, contactDirection, entryProbe });
    if (accepted && entryProbe === 'blade_heel') this.closeRangeEntryHitCount = Math.min(1_000_000, this.closeRangeEntryHitCount + 1);
    return accepted;
  }

  beginSwordPenetration({ routed, point, normal, contactDirection, entryProbe = 'tip' }) {
    if (this.entry) return false;
    const entryAxis = this.bladeForward.clone().normalize();
    const bodyTransformAtCollision = capturePhysicsBodyTransform(routed.hit.bodyTransformAtCollision ?? routed.hit.body);
    const localAxis = worldDirectionToPhysicsBodyLocal(bodyTransformAtCollision ?? routed.hit.body, entryAxis);
    if (!localAxis) return false;
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
    this.extractionOffsetActive = false;
    this.extractionOffsetAge = 0;
    this.extractionPositionOffset.set(0, 0, 0);
    this.extractionQuaternionOffset.identity();
    this.presentation.endExtractionContinuity();
    this.entry = {
      actor: routed.actor,
      director: routed.director,
      hit: routed.hit,
      body: routed.hit.body,
      bodyId: routed.hit.bodyId,
      regionId: routed.hit.regionId,
      localPoint: routed.hit.localPoint.clone(),
      localAxis,
      bodyTransformAtCollision,
      targetLifeStateAtEntry: routed.actor?.lifeState ?? 'unknown',
      entryAxisWorldAtCollision: entryAxis.clone(),
      contactDirection: contactDirection.clone(),
      surfaceNormal: normal.clone(),
      woundId: null,
      directorInteractionId: interaction.id,
      surfaceRuptured: false,
      withdrawalStarted: false,
      resistancePhase: 'skin',
      hardDepth: this.resolveHardStructureDepth(routed.hit),
      hardFeedback: false,
      reportedLateralMotion: 0,
      plantedDesiredGrip: new THREE.Vector3(),
      targetLifeState: routed.actor?.lifeState ?? 'unknown',
      worldPoint: new THREE.Vector3(),
      worldAxis: new THREE.Vector3(),
      worldPose: { point: null, axis: null },
    };
    this.entry.worldPose.point = this.entry.worldPoint;
    this.entry.worldPose.axis = this.entry.worldAxis;
    this.rawDesiredProjectedDepth = SWORD_INITIAL_PUNCTURE_DEPTH;
    this.desiredProjectedDepth = SWORD_INITIAL_PUNCTURE_DEPTH;
    this.penetrationDepth = SWORD_INITIAL_PUNCTURE_DEPTH;
    this.projectionError = this.desiredProjectedDepth - this.penetrationDepth;
    this.maximumDepthReached = SWORD_INITIAL_PUNCTURE_DEPTH;
    this.entryResistanceElapsed = 0;
    this.entryResistanceActive = true;
    this.extractionDetected = false;
    this.directControlTrackingErrorWhileEmbedded = 0;
    this.maximumDirectControlTrackingErrorWhileEmbedded = 0;
    this.rearmReady = false;
    this.thrustEligible = true;
    this.lastContactPart = 'tip';
    this.lastClassification = 'thrust';
    this.lastEntryProbe = entryProbe;
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
      this.applyKnifeStyleEmbeddedPose(worldEntry);
    }
    this.applyVisualLayer();
    return true;
  }

  resolveHardStructureDepth(hit) {
    const region = hit?.region;
    if (!region?.hardStructure) return null;
    if (['skull', 'face', 'head'].includes(hit.regionId)) return region.hardStructureDepth;
    if (hit.regionId === 'neck') return Math.abs(hit.localPoint.x) < 0.055 ? region.hardStructureDepth : null;
    if (['upper_chest', 'lower_chest'].includes(hit.regionId)) {
      const ribBand = Math.abs(Math.sin((hit.localPoint.x + 0.42) * 17)) > 0.48;
      return ribBand ? region.hardStructureDepth : null;
    }
    return Math.abs(hit.localPoint.x) < 0.045 ? region.hardStructureDepth : null;
  }

  getEntryWorldPose(entry = this.entry) {
    const body = entry?.body ?? entry?.hit?.body;
    if (!body) return null;
    const point = physicsBodyLocalToWorld(body, entry.localPoint, entry.worldPoint);
    const axis = physicsBodyLocalDirectionToWorld(body, entry.localAxis, entry.worldAxis);
    return point && axis ? entry.worldPose : null;
  }

  applyKnifeStyleEmbeddedPose(worldEntry) {
    this.actualQuaternion.setFromUnitVectors(localForward, worldEntry.axis);
    this.actualGrip
      .copy(worldEntry.point)
      .addScaledVector(worldEntry.axis, Math.max(0, this.penetrationDepth) - this.config.tipLength);
    this.updateDerivedPose();
    this.directControlTrackingErrorWhileEmbedded = this.actualGrip.distanceTo(this.desiredGrip);
    this.maximumDirectControlTrackingErrorWhileEmbedded = Math.max(
      this.maximumDirectControlTrackingErrorWhileEmbedded,
      this.directControlTrackingErrorWhileEmbedded,
    );
    return true;
  }

  isPenetratedTargetCollider(collider, entry = this.entry) {
    if (!entry || !collider) return false;
    if (collider === entry.hit?.collider) return true;
    const handle = collider.handle;
    if (Number.isFinite(handle) && entry.actor?.colliderRegions?.has?.(handle)) return true;
    for (const ownedCollider of entry.actor?.colliders?.values?.() ?? []) {
      if (ownedCollider === collider || (Number.isFinite(handle) && ownedCollider?.handle === handle)) return true;
    }
    return false;
  }

  shouldResolveEmbeddedCollider(collider) {
    if (!this.colliderFilter(collider)) return false;
    if (!this.isPenetratedTargetCollider(collider)) return true;
    this.sameTargetCollisionSuppressionCount = Math.min(1_000_000, this.sameTargetCollisionSuppressionCount + 1);
    return false;
  }

  resolveEmbeddedExternalTipContact() {
    if (!this.entry || this.gripPointerId == null || this.actualTipSpeed <= SWORD_KINEMATIC_EPSILON) return false;
    const raw = this.physics?.castWeaponTip?.(
      this.previousTip,
      this.currentTip,
      SWORD_CONTACT_PRIMITIVES.tip.radius,
      this.embeddedColliderFilter,
      false,
    );
    if (!raw?.collider) return false;
    const toi = THREE.MathUtils.clamp(raw.time_of_impact ?? 0, 0, 1);
    const point = raw.witness1
      ? this.contactScratch.point.set(raw.witness1.x, raw.witness1.y, raw.witness1.z)
      : this.contactScratch.point.copy(this.previousTip).lerp(this.currentTip, toi);
    const routed = this.weaponContactRouter.resolveTarget(raw.collider, point);
    if (!routed || routed.actor === this.entry.actor) {
      if (routed?.actor === this.entry.actor) this.sameTargetCollisionSuppressionCount = Math.min(1_000_000, this.sameTargetCollisionSuppressionCount + 1);
      return false;
    }
    this.otherTargetContactWhileEmbeddedCount = Math.min(1_000_000, this.otherTargetContactWhileEmbeddedCount + 1);
    this.lastContactPart = 'tip';
    this.lastClassification = 'embedded_external_contact';
    this.contactState = 'embedded_external_contact';
    if (this.elapsed >= this.contactCooldownUntil) {
      this.contactCooldownUntil = this.elapsed + 0.11;
      const direction = this.tipDisplacement.lengthSq() > SWORD_KINEMATIC_EPSILON
        ? this.tipDisplacement.clone().normalize()
        : this.bladeForward.clone();
      routed.director.reportContact?.({
        weapon: this.weaponDefinition,
        intent: this.intentState,
        hit: routed.hit,
        position: point,
        direction,
        cue: 'clothing_contact',
        severity: Math.min(0.55, 0.12 + this.actualTipSpeed * 0.12),
        resistance: 'already-embedded-external-tip-contact',
        weaponAdapter: this,
      });
    }
    return true;
  }

  recallPlantedSwordIfSeparated(dt) {
    const entry = this.entry;
    if (this.gripPointerId != null || !entry?.plantedDesiredGrip) return false;
    if (entry.plantedDesiredGrip.distanceToSquared(this.desiredGrip) <= SWORD_FORCED_EXTRACTION_DISTANCE ** 2) return false;
    this.completeSwordExtraction(this.getEntryWorldPose(entry), 'walk-away-recall');
    this.solveFreeSwordPose(dt, this.contactActivationProvider?.() ?? true);
    return true;
  }

  solveSwordImpalement(dt) {
    const entry = this.entry;
    this.thrustEligible = false;
    const actorBodyMissing = entry?.actor?.bodies instanceof Map && !entry.actor.bodies.has(entry.bodyId);
    if (!entry || entry.actor?.disposed || actorBodyMissing) {
      this.clearInvalidSwordTarget('target_removed');
      return;
    }
    const worldEntry = this.getEntryWorldPose(entry);
    if (!worldEntry) {
      this.clearInvalidSwordTarget('target_removed');
      return;
    }
    const plantedHold = this.gripPointerId == null;
    if (plantedHold && this.recallPlantedSwordIfSeparated(dt)) return;

    const maximumRegionDepth = Math.min(
      Number(entry.hit.region?.maximumTissueDepth) || SWORD_MAXIMUM_PENETRATION_DEPTH,
      SWORD_MAXIMUM_PENETRATION_DEPTH,
    );
    const previousDepth = this.penetrationDepth;
    this.rawDesiredProjectedDepth = this.contactScratch.edgeMotion.subVectors(this.desiredTip, worldEntry.point).dot(worldEntry.axis);
    this.desiredProjectedDepth = plantedHold
      ? previousDepth
      : THREE.MathUtils.clamp(this.rawDesiredProjectedDepth, SWORD_EXTRACTION_CLEARANCE, maximumRegionDepth);
    const wantsWithdrawal = !plantedHold && this.desiredProjectedDepth < previousDepth;
    sampleTissueResistanceCurve({
      depth: previousDepth,
      surfaceThickness: entry.hit.region?.surfaceThickness,
      softTissueResistance: entry.hit.region?.softTissueResistance,
      hardDepth: entry.hardDepth,
      hardStructureResistance: entry.hit.region?.hardStructureResistance,
      withdrawing: wantsWithdrawal,
    }, this.tissueResistanceSample);
    const penetration = advancePenetrationDepth({
      currentDepth: previousDepth,
      targetDepth: this.desiredProjectedDepth,
      dt,
      tissueResistance: this.tissueResistanceSample.effectiveResistance,
      hardDepth: entry.hardDepth,
      maximumDepth: maximumRegionDepth,
      penetrationRate: SWORD_PENETRATION_RATE_METERS_PER_SECOND,
      withdrawalRate: SWORD_WITHDRAWAL_RATE_METERS_PER_SECOND,
    });
    this.desiredProjectedDepth = penetration.targetDepth;
    this.penetrationDepth = penetration.depth;
    this.projectionError = this.desiredProjectedDepth - this.penetrationDepth;
    const advancing = this.penetrationDepth > previousDepth + SWORD_KINEMATIC_EPSILON;
    const withdrawing = this.penetrationDepth < previousDepth - 0.001;
    this.entryResistanceElapsed += Math.max(0, Number(dt) || 0);
    this.entryResistanceActive = advancing && this.penetrationDepth + SWORD_KINEMATIC_EPSILON < this.desiredProjectedDepth;
    this.extractionDetected ||= wantsWithdrawal;

    if (penetration.hardContact && !entry.hardFeedback) {
      entry.hardFeedback = true;
      entry.director.advancePenetration(entry.directorInteractionId, {
        hit: entry.hit,
        entryPoint: worldEntry.point,
        direction: worldEntry.axis,
        deltaDepth: 0,
        depth: this.penetrationDepth,
        force: 0,
        lateralMotion: 0,
        hardContact: true,
        resistanceProfile: this.tissueResistanceSample,
      });
    }
    if (penetration.extracted) {
      this.completeSwordExtraction(worldEntry);
      return;
    }

    const constrainedTip = this.contactScratch.correction
      .copy(worldEntry.point)
      .addScaledVector(worldEntry.axis, Math.max(0, this.penetrationDepth));
    const desiredLateral = this.contactScratch.bodyCenter.subVectors(this.desiredTip, constrainedTip);
    desiredLateral.addScaledVector(worldEntry.axis, -desiredLateral.dot(worldEntry.axis));
    const lateralDistance = desiredLateral.length();
    this.intentState = this.intentWeapon.interpret({ ownerId: this.gripPointerId, controlState: SWORD_IMPALEMENT_STATES.embedded, localVelocity: this.deliberateInputVelocity, embedded: true });
    const embeddedAttackEnabled = !plantedHold
      && isDamageIntent(this.intentState)
      && this.deliberateInputVelocity.length() >= 0.02;
    const lateralForce = embeddedAttackEnabled ? Math.min(1.2, lateralDistance * SWORD_FORCE_TRANSFER) : 0;
    if (lateralForce > 0 && lateralDistance > 0.002) {
      entry.body.applyImpulseAtPoint?.(desiredLateral.normalize().multiplyScalar(lateralForce * dt), worldEntry.point, true);
    }
    if (embeddedAttackEnabled && lateralDistance > SWORD_LATERAL_BIND_DISTANCE) {
      entry.director.reportResistance?.(entry.directorInteractionId, {
        kind: 'lateral_bind',
        intensity: lateralDistance / SWORD_FORCED_EXTRACTION_DISTANCE,
        depth: this.penetrationDepth,
        cue: 'blade_bind',
        position: worldEntry.point,
      });
    }
    if (embeddedAttackEnabled && lateralDistance > SWORD_FORCED_EXTRACTION_DISTANCE && this.desiredProjectedDepth < this.penetrationDepth * 0.35) {
      this.completeSwordExtraction(worldEntry, 'forced-lateral-release');
      return;
    }

    this.applyKnifeStyleEmbeddedPose(worldEntry);
    this.updateTipKinematics(dt);
    this.maximumDepthReached = Math.max(this.maximumDepthReached, this.penetrationDepth);
    const deltaDepth = Math.max(0, this.penetrationDepth - previousDepth);
    if (withdrawing) {
      this.beginSwordWithdrawal(worldEntry);
      if (entry.resistancePhase !== this.tissueResistanceSample.phase) {
        entry.resistancePhase = this.tissueResistanceSample.phase;
        entry.director.reportResistance?.(entry.directorInteractionId, { kind: this.tissueResistanceSample.phase, intensity: this.tissueResistanceSample.drag, depth: this.penetrationDepth, position: worldEntry.point });
      }
    }
    const reportLateralMotion = embeddedAttackEnabled && lateralDistance >= entry.reportedLateralMotion + 0.003;
    if ((deltaDepth > 0 || reportLateralMotion) && embeddedAttackEnabled) {
      if (reportLateralMotion) entry.reportedLateralMotion = lateralDistance;
      entry.director.advancePenetration(entry.directorInteractionId, {
        hit: entry.hit,
        entryPoint: worldEntry.point,
        direction: worldEntry.axis,
        deltaDepth,
        depth: this.penetrationDepth,
        force: this.tissueResistanceSample.effectiveResistance + lateralForce,
        lateralMotion: entry.reportedLateralMotion,
        hardContact: penetration.hardContact,
        resistanceProfile: this.tissueResistanceSample,
      });
    }
    if (penetration.hardContact) {
      this.state = SWORD_IMPALEMENT_STATES.embedded;
      this.contactState = 'bone_contact';
      this.contactDamageReason = 'non-damaging:hard-structure-resistance';
    } else if (withdrawing) {
      this.state = SWORD_IMPALEMENT_STATES.withdrawing;
      this.contactState = SWORD_IMPALEMENT_STATES.withdrawing;
      this.contactDamageReason = 'non-damaging:controlled-extraction';
    } else {
      this.state = entry.surfaceRuptured ? SWORD_IMPALEMENT_STATES.embedded : SWORD_IMPALEMENT_STATES.surfaceContact;
      this.contactState = this.state;
      this.contactDamageReason = embeddedAttackEnabled ? 'damaging:grip-owned-embedded-manipulation' : plantedHold ? 'non-damaging:planted-embedded-hold' : 'non-damaging:embedded-hold';
    }
    this.attackEnabled = embeddedAttackEnabled;
    this.resolveEmbeddedExternalTipContact();
  }

  beginSwordWithdrawal(worldEntry = this.getEntryWorldPose()) {
    const entry = this.entry;
    if (!entry?.directorInteractionId || entry.withdrawalStarted) return false;
    entry.withdrawalStarted = true;
    entry.director.beginWithdrawal(entry.directorInteractionId, { releaseSeverity: this.maximumDepthReached, direction: worldEntry?.axis?.clone?.().negate?.(), position: worldEntry?.point ?? this.currentTip });
    return true;
  }

  cleanupSwordImpalement(reason = 'target_removed', { worldEntry = null, completeWithdrawal = false, createRearmGate = false, preserveVisualPose = true } = {}) {
    const entry = this.entry;
    if (!entry) return false;
    const resolvedWorldEntry = worldEntry ?? this.getEntryWorldPose(entry);
    const transitionPosition = this.actualGrip.clone();
    const transitionQuaternion = this.actualQuaternion.clone();
    if (completeWithdrawal) {
      this.beginSwordWithdrawal(resolvedWorldEntry);
      entry.director.completeWithdrawal?.(entry.directorInteractionId, {
        releaseSeverity: this.maximumDepthReached,
        direction: resolvedWorldEntry?.axis?.clone?.().negate?.(),
        position: resolvedWorldEntry?.point ?? this.currentTip,
      });
    } else {
      entry.director.cancelInteraction?.(entry.directorInteractionId, reason);
      if (entry.woundId) entry.actor?.woundSystem?.markExtracted?.(entry.woundId, { releaseSeverity: 0, direction: null });
    }
    this.penetrationAudioGate.rearmAfterFullExtraction(entry.directorInteractionId);
    if (entry.actor?.activeEmbeddedWeapon === this) entry.actor?.setEmbeddedWeapon?.(null);
    this.rearmGate = createRearmGate && resolvedWorldEntry
      ? {
        worldPoint: resolvedWorldEntry.point.clone(),
        worldAxis: resolvedWorldEntry.axis.clone().normalize(),
      }
      : null;
    this.entry = null;
    this.rearmReady = !this.rearmGate;
    this.rearmCheckDelayFrames = this.rearmGate ? 1 : 0;
    this.lastRearmClearance = 0;
    this.penetrationDepth = 0;
    this.desiredProjectedDepth = 0;
    this.rawDesiredProjectedDepth = 0;
    this.projectionError = 0;
    this.entryResistanceElapsed = 0;
    this.entryResistanceActive = false;
    this.extractionDetected = false;
    this.lastEmbeddedDirectControlTrackingError = this.maximumDirectControlTrackingErrorWhileEmbedded;
    this.directControlTrackingErrorWhileEmbedded = 0;
    this.maximumDirectControlTrackingErrorWhileEmbedded = 0;
    this.attackEnabled = false;
    this.thrustEligible = false;
    this.maximumDepthReached = 0;
    this.lastContactPart = 'none';
    this.lastClassification = 'none';
    this.tissueResistanceSample.phase = 'skin';
    this.tissueResistanceSample.effectiveResistance = 0.3;
    this.tissueResistanceSample.drag = 0;
    this.tissueResistanceSample.deflection = 0;
    this.lastImpalementCleanupReason = reason;
    this.impalementCleanupCount = Math.min(1_000_000, this.impalementCleanupCount + 1);
    this.measureEmbeddedToFreeContinuity = preserveVisualPose;
    this.applyVisualLayer();
    if (preserveVisualPose) this.beginAuthoritativeExtractionContinuity(transitionPosition, transitionQuaternion);
    else {
      this.extractionOffsetActive = false;
      this.extractionOffsetAge = 0;
      this.extractionPositionOffset.set(0, 0, 0);
      this.extractionQuaternionOffset.identity();
      this.presentation.endExtractionContinuity();
      this.captureFreeRenderPose();
    }
    return true;
  }

  completeSwordExtraction(worldEntry = this.getEntryWorldPose(), reason = 'extracted') {
    const transitionPosition = this.actualGrip.clone();
    const transitionQuaternion = this.actualQuaternion.clone();
    if (!this.cleanupSwordImpalement(reason, { worldEntry, completeWithdrawal: true, createRearmGate: reason === 'extracted', preserveVisualPose: true })) return false;
    this.extractionCount = Math.min(1_000_000, this.extractionCount + 1);
    this.lastExtractionReason = reason;
    this.contactState = 'fully_extracted';
    this.contactDamageReason = this.rearmGate ? 'non-damaging:awaiting-entry-surface-clearance' : `non-damaging:${reason}`;
    if (this.gripPointerId != null) {
      this.state = SWORD_IMPALEMENT_STATES.attacking;
    } else {
      this.returnElapsed = 0;
      this.returnStartAim.set(this.aimX, this.aimY);
      this.returnStartExtension = this.desiredExtension;
      this.state = SWORD_IMPALEMENT_STATES.returning;
    }
    this.embeddedToFreePositionDiscontinuity = transitionPosition.distanceTo(this.actualGrip);
    this.embeddedToFreeRotationDiscontinuity = transitionQuaternion.angleTo(this.actualQuaternion);
    return true;
  }

  updateSwordRearmGate(respectDelay = false) {
    const gate = this.rearmGate;
    if (!gate) return;
    if (respectDelay && this.rearmCheckDelayFrames > 0) {
      this.rearmCheckDelayFrames -= 1;
      return;
    }
    const signedTipDepth = this.contactScratch.edgeMotion.subVectors(this.currentTip, gate.worldPoint).dot(gate.worldAxis);
    this.lastRearmClearance = Math.max(0, -signedTipDepth);
    if (this.lastRearmClearance + SWORD_KINEMATIC_EPSILON < SWORD_THRUST_REARM_DISTANCE) return;
    this.rearmGate = null;
    this.rearmReady = true;
    this.rearmCheckDelayFrames = 0;
    this.rearmCount = Math.min(1_000_000, this.rearmCount + 1);
    if (this.state === SWORD_IMPALEMENT_STATES.returning && this.returnElapsed >= this.returnDuration) this.state = SWORD_IMPALEMENT_STATES.ready;
  }

  clearInvalidSwordTarget(reason = 'target-invalid') {
    const held = this.gripPointerId != null;
    if (!this.cleanupSwordImpalement(reason, { completeWithdrawal: false, createRearmGate: false, preserveVisualPose: true })) return false;
    this.state = held ? SWORD_IMPALEMENT_STATES.attacking : SWORD_IMPALEMENT_STATES.ready;
    this.contactState = reason;
    this.contactDamageReason = `non-damaging:${reason}`;
    return true;
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

  afterPhysics(_alpha = 1, frameDelta = this.lastPhysicsDt) {
    this.presentation.beginRenderFrame();
    const equipped = this.isEquipped();
    this.visual.visible = equipped;
    if (!equipped) {
      if (this.entry || this.gripPointerId != null || this.state !== SWORD_IMPALEMENT_STATES.ready) this.cancel('weapon-unequipped');
      this.presentation.detachHidden();
      return;
    }
    if (this.entry) {
      this.presentation.writeWorldPose(this.actualGrip, this.actualQuaternion);
      this.visibleCollisionError = this.visual.getWorldPosition(this.contactScratch.correction).distanceTo(this.actualGrip);
      this.measureSwordPresentationUnity();
      return;
    }
    this.presentation.writeViewmodelPose(this.renderLocalGrip, this.renderLocalQuaternion);
    this.visibleCollisionError = 0;
    this.measureSwordPresentationUnity();
  }

  measureSwordPresentationUnity() {
    if (!this.camera || !this.visual) return null;
    if (!this.entry && this.viewmodelAnchor && this.visual.parent === this.viewmodelAnchor) {
      this.authoritativeLocalGrip.copy(this.renderLocalGrip);
      this.authoritativeLocalQuaternion.copy(this.renderLocalQuaternion);
      this.displayedLocalGrip.copy(this.visual.position);
      this.displayedLocalQuaternion.copy(this.visual.quaternion);
      deriveBladeTip(this.authoritativeLocalGrip, this.authoritativeLocalQuaternion, this.config.tipLength, this.authoritativeTip);
      deriveBladeTip(this.displayedLocalGrip, this.displayedLocalQuaternion, this.config.tipLength, this.displayedTip);
      this.presentationPositionError = this.authoritativeLocalGrip.distanceTo(this.displayedLocalGrip);
      this.presentationRotationErrorDegrees = THREE.MathUtils.radToDeg(this.authoritativeLocalQuaternion.angleTo(this.displayedLocalQuaternion));
      this.presentationTipError = this.authoritativeTip.distanceTo(this.displayedTip);
      let edgeError = 0;
      for (const name of ['leftEdge', 'rightEdge']) {
        const path = this.primitives[name].path.points;
        for (const point of [path[0], path.at(-1)]) {
          const physical = this.contactScratch.edgeMotion.copy(point).applyQuaternion(this.authoritativeLocalQuaternion).add(this.authoritativeLocalGrip);
          const displayed = this.contactScratch.correction.copy(point).applyQuaternion(this.displayedLocalQuaternion).add(this.displayedLocalGrip);
          edgeError = Math.max(edgeError, physical.distanceTo(displayed));
        }
      }
      this.presentationEdgeError = edgeError;
      this.maximumPresentationTipError = Math.max(this.maximumPresentationTipError, this.presentationTipError);
      this.maximumPresentationEdgeError = Math.max(this.maximumPresentationEdgeError, edgeError);
      return edgeError;
    }
    this.camera.updateMatrixWorld(true);
    this.authoritativeLocalGrip.copy(this.actualGrip);
    this.camera.worldToLocal(this.authoritativeLocalGrip);
    this.camera.getWorldQuaternion(this.contactScratch.inverseQuaternion);
    this.authoritativeLocalQuaternion.copy(this.contactScratch.inverseQuaternion).invert().multiply(this.actualQuaternion).normalize();
    this.visual.getWorldPosition(this.displayedWorldGrip);
    this.displayedLocalGrip.copy(this.displayedWorldGrip);
    this.camera.worldToLocal(this.displayedLocalGrip);
    this.visual.getWorldQuaternion(this.displayedWorldQuaternion);
    this.displayedLocalQuaternion.copy(this.contactScratch.inverseQuaternion).invert().multiply(this.displayedWorldQuaternion).normalize();
    deriveBladeTip(this.actualGrip, this.actualQuaternion, this.config.tipLength, this.authoritativeTip);
    deriveBladeTip(this.displayedWorldGrip, this.displayedWorldQuaternion, this.config.tipLength, this.displayedTip);
    this.presentationPositionError = this.authoritativeLocalGrip.distanceTo(this.displayedLocalGrip);
    this.presentationRotationErrorDegrees = THREE.MathUtils.radToDeg(this.authoritativeLocalQuaternion.angleTo(this.displayedLocalQuaternion));
    this.presentationTipError = this.authoritativeTip.distanceTo(this.displayedTip);
    this.maximumPresentationTipError = Math.max(this.maximumPresentationTipError, this.presentationTipError);
    let edgeError = 0;
    for (const name of ['leftEdge', 'rightEdge']) {
      const path = this.primitives[name].path.points;
      for (const point of [path[0], path.at(-1)]) {
        const physical = this.contactScratch.edgeMotion.copy(point).applyQuaternion(this.actualQuaternion).add(this.actualGrip);
        const displayed = this.contactScratch.correction.copy(point).applyQuaternion(this.displayedWorldQuaternion).add(this.displayedWorldGrip);
        edgeError = Math.max(edgeError, physical.distanceTo(displayed));
      }
    }
    this.presentationEdgeError = edgeError;
    this.maximumPresentationEdgeError = Math.max(this.maximumPresentationEdgeError, edgeError);
    return this.presentationEdgeError;
  }

  getScheduledVisiblePhysicalEdgeError() {
    if (!this.camera || this.entry) return this.presentationEdgeError;
    this.camera.updateMatrixWorld(true);
    this.displayedWorldGrip.copy(this.renderLocalGrip);
    this.camera.localToWorld(this.displayedWorldGrip);
    this.camera.getWorldQuaternion(this.displayedWorldQuaternion);
    this.displayedWorldQuaternion.multiply(this.renderLocalQuaternion).normalize();
    let edgeError = 0;
    for (const name of ['leftEdge', 'rightEdge']) {
      const path = this.primitives[name].path.points;
      for (const point of [path[0], path.at(-1)]) {
        const physical = this.contactScratch.edgeMotion.copy(point).applyQuaternion(this.actualQuaternion).add(this.actualGrip);
        const displayed = this.contactScratch.correction.copy(point).applyQuaternion(this.displayedWorldQuaternion).add(this.displayedWorldGrip);
        edgeError = Math.max(edgeError, physical.distanceTo(displayed));
      }
    }
    this.presentationEdgeError = edgeError;
    this.maximumPresentationEdgeError = Math.max(this.maximumPresentationEdgeError, edgeError);
    return edgeError;
  }

  afterPhysicsStep(dt = 0) {
    if (this.ownsCombatDirector) this.combatDirector.update(dt);
  }

  onCombatResistance() {}

  onCombatRecovery() {
    if (!this.entry && this.state === SWORD_IMPALEMENT_STATES.surfaceContact && this.gripPointerId != null) this.state = SWORD_IMPALEMENT_STATES.attacking;
  }

  cancelTarget(actor, reason = 'target-cancelled') {
    if (this.entry?.actor === actor) {
      this.clearInvalidSwordTarget('target_removed');
      return true;
    }
    if (this.activeEdgeDamage?.actor === actor) {
      this.finishActiveEdgeDamage(true);
      this.contactState = reason;
      return true;
    }
    return false;
  }

  onTargetLifeStateChanged(actor, { nextState } = {}) {
    if (this.entry?.actor !== actor || !nextState || nextState === 'alive') return false;
    this.entry.targetLifeState = nextState;
    this.contactDamageReason = 'non-damaging:embedded-in-corpse';
    this.attackEnabled = false;
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
    const cleanupReason = reason === 'weapon-unequipped'
      ? 'weapon_unequipped'
      : reason === 'disposed' || reason.includes('dispose')
        ? 'disposed'
        : reason.includes('reset')
          ? 'scene_reset'
          : reason;
    const cleanedImpalement = this.cleanupSwordImpalement(cleanupReason, { completeWithdrawal: false, createRearmGate: false, preserveVisualPose: false });
    this.rearmGate = null;
    this.rearmReady = true;
    this.rearmCheckDelayFrames = 0;
    this.penetrationDepth = 0;
    this.desiredProjectedDepth = 0;
    this.rawDesiredProjectedDepth = 0;
    this.projectionError = 0;
    this.edgeSweepObserver?.endGesture?.(reason);
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
    this.lastEntryProbe = 'none';
    this.deliberateInputVelocity.set(0, 0, 0);
    this.offensiveVelocity.set(0, 0, 0);
    this.measureEmbeddedToFreeContinuity = false;
    this.extractionOffsetActive = false;
    this.extractionOffsetAge = 0;
    this.extractionPositionOffset.set(0, 0, 0);
    this.extractionQuaternionOffset.identity();
    this.presentation.endExtractionContinuity();
    this.applyVisualLayer();
    if (cleanedImpalement) this.captureFreeRenderPose();
    this.penetrationAudioGate.reset();
  }

  reset() {
    this.cancel('reset');
    this.intentWeapon.reset();
    this.edgeSweepObserver?.reset?.();
    this.initializePose();
  }

  getDiagnostics() {
    const worldLightIntersectionStatus = getWeaponWorldLightIntersectionStatus(this.visual, this.scene);
    const extractionProgress = THREE.MathUtils.clamp(this.extractionOffsetAge / SWORD_EXTRACTION_CONTINUITY_DURATION, 0, 1);
    const extractionOffsetWeight = this.extractionOffsetActive ? 1 - extractionProgress * extractionProgress * (3 - 2 * extractionProgress) : 0;
    this.continuityScratch.decayedQuaternionOffset.slerpQuaternions(identityQuaternion, this.extractionQuaternionOffset, extractionOffsetWeight).normalize();
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
      closeRangeEntrySweepCount: this.closeRangeEntrySweepCount,
      closeRangeEntryHitCount: this.closeRangeEntryHitCount,
      lastEntryProbe: this.lastEntryProbe,
      lastContactPart: this.lastContactPart,
      lastClassification: this.lastClassification,
      ownedTargetActor: this.entry?.actor?.instanceId ?? this.entry?.actor?.id ?? null,
      embeddedTargetId: this.entry?.actor?.instanceId ?? this.entry?.actor?.id ?? null,
      embeddedTargetLifeState: this.entry?.targetLifeState ?? this.entry?.actor?.lifeState ?? null,
      penetrationActive: Boolean(this.entry),
      entryBody: this.entry?.bodyId ?? null,
      entryRegion: this.entry?.regionId ?? null,
      depthInputMode: this.entry && this.gripPointerId != null ? 'knife-parity-body-axis-projection' : 'free-pointer-tracking',
      desiredProjectedDepth: Number(this.desiredProjectedDepth.toFixed(4)),
      rawDesiredProjectedDepth: Number(this.rawDesiredProjectedDepth.toFixed(4)),
      penetrationDepth: Number(this.penetrationDepth.toFixed(4)),
      projectionError: Number(this.projectionError.toFixed(6)),
      entryResistanceActive: this.entryResistanceActive,
      entryResistanceElapsed: Number(this.entryResistanceElapsed.toFixed(4)),
      entryResistanceModel: 'knife-tissue-depth-advance',
      extractionDetected: this.extractionDetected,
      sameTargetCollisionSuppressionActive: Boolean(this.entry),
      sameTargetCollisionSuppressionCount: this.sameTargetCollisionSuppressionCount,
      otherTargetContactWhileEmbeddedCount: this.otherTargetContactWhileEmbeddedCount,
      directControlTrackingErrorWhileEmbedded: Number(this.directControlTrackingErrorWhileEmbedded.toFixed(6)),
      maximumDirectControlTrackingErrorWhileEmbedded: Number(this.maximumDirectControlTrackingErrorWhileEmbedded.toFixed(6)),
      lastEmbeddedDirectControlTrackingError: Number(this.lastEmbeddedDirectControlTrackingError.toFixed(6)),
      lastImpalementCleanupReason: this.lastImpalementCleanupReason,
      impalementCleanupCount: this.impalementCleanupCount,
      maximumPenetrationDepth: SWORD_MAXIMUM_PENETRATION_DEPTH,
      maximumDepthReached: Number(this.maximumDepthReached.toFixed(4)),
      penetrationRate: SWORD_PENETRATION_RATE_METERS_PER_SECOND,
      withdrawalRate: SWORD_WITHDRAWAL_RATE_METERS_PER_SECOND,
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
      modelScale: DREADSTONE_SWORD_MODEL_SCALE,
      sourceDimensions: DREADSTONE_SWORD_SOURCE_DIMENSIONS,
      dimensions: DREADSTONE_SWORD_DIMENSIONS,
      penetrationAudio: this.penetrationAudioGate.getDiagnostics(),
      edgeSweepObserver: this.edgeSweepObserver?.getDiagnostics?.() ?? null,
      weaponPresentation: this.getWeaponPresentationDiagnostics(),
      swordPresentationUnity: {
        authoritativeLocalGrip: this.authoritativeLocalGrip.toArray().map((value) => Number(value.toFixed(6))),
        displayedLocalGrip: this.displayedLocalGrip.toArray().map((value) => Number(value.toFixed(6))),
        authoritativeTip: this.authoritativeTip.toArray().map((value) => Number(value.toFixed(6))),
        displayedTip: this.displayedTip.toArray().map((value) => Number(value.toFixed(6))),
        positionError: Number(this.presentationPositionError.toFixed(6)),
        rotationErrorDegrees: Number(this.presentationRotationErrorDegrees.toFixed(4)),
        tipError: Number(this.presentationTipError.toFixed(6)),
        maximumTipError: Number(this.maximumPresentationTipError.toFixed(6)),
        edgeError: Number(this.presentationEdgeError.toFixed(6)),
        maximumEdgeError: Number(this.maximumPresentationEdgeError.toFixed(6)),
        extractionOffsetActive: this.extractionOffsetActive,
        extractionOffsetPositionMagnitude: Number((this.extractionPositionOffset.length() * extractionOffsetWeight).toFixed(6)),
        extractionOffsetRotationDegrees: Number(THREE.MathUtils.radToDeg(identityQuaternion.angleTo(this.continuityScratch.decayedQuaternionOffset)).toFixed(4)),
        extractionOffsetAge: Number(this.extractionOffsetAge.toFixed(4)),
        extractionCycleCount: this.extractionCycleCount,
        rejectedDismembermentPresentationErrorCount: this.edgeSweepObserver?.getDiagnostics?.().rejectedPresentationErrorCount ?? 0,
      },
    };
  }

  dispose() {
    if (this.disposed) return;
    this.cancel('disposed');
    this.disposed = true;
    this.disposers.forEach((dispose) => dispose?.());
    this.disposers = [];
    this.edgeSweepObserver?.dispose?.();
    if (this.ownsCombatDirector) this.combatDirector.dispose();
    disposeOwnedWeaponVisual({ root: this.visual, geometries: this.visualGeometries, materials: this.visualMaterials });
  }
}
