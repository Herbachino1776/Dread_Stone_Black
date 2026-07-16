import * as THREE from 'three';
import { KNIFE_COMBAT_CONFIG } from './CombatConfig.js';
import { advancePenetrationDepth, clampWorkspacePoint, classifyKnifeContact, classifySlashContact, deriveBladeTip, normalizedBladeForward } from './CombatMath.js';
import { SLASH_CONFIG } from './CombatStage2Config.js';
import { KNIFE_CONTROL_STATES, canKnifeCreateOffensiveContact, criticallyDampedReturnProgress, getKnifeReleasePlan } from './KnifeControlState.js';
import { CombatDirector } from './CombatDirector.js';
import { isDamageIntent, MELEE_INTENTS, MeleeIntentWeapon } from './MeleeIntentWeapon.js';
import { resolveWeaponMicroResponse, sampleTissueResistanceCurve } from './CombatPresentation.js';
import { createWeaponContactScratch, getRigidBodyWorldPosition } from './weapons/WeaponContactScratch.js';
import { WeaponContactRouter } from './weapons/WeaponContactRouter.js';
import { bindWeaponPointerEvents, DEFAULT_WEAPON_POINTER_BLOCK_SELECTOR, WeaponGestureOwnership } from './weapons/WeaponGestureOwnership.js';
import { computeCameraRelativeWeaponPose, createWeaponPoseWorkspace, initializeCameraRelativeWeaponPose, rebaseWorldWeaponPoseToCamera } from './weapons/WeaponPoseWorkspace.js';
import { createCuttingEdgePath, resolveCuttingEdgeSampleCount, sampleCuttingEdgeLocal, sweepCuttingEdge } from './weapons/SweptCuttingEdge.js';
import { applyWeaponRenderLayer, captureWeaponMaterialLightingState, cloneOwnedWeaponVisual, createCachedWeaponGlbLoader, disposeOwnedWeaponVisual, getWeaponRenderLayer, getWeaponWorldLightIntersectionStatus, weaponMaterialLightingStateChanged } from './weapons/WeaponVisualAsset.js';
import { WEAPON_VIEWMODEL_LAYER, WEAPON_WORLD_LAYER } from './weapons/WeaponRenderLayers.js';
import { physicsBodyLocalDirectionToWorld, physicsBodyLocalToWorld, worldDirectionToPhysicsBodyLocal } from './CombatCoordinateSpaces.js';
import { OLD_WORK_KNIFE_PIERCING_AUDIO_PROFILE } from './CombatAcceptedAudioSystem.js';
import { PenetrationAudioGate } from './weapons/PenetrationAudioGate.js';
import { WeaponPresentationRuntime } from './weapons/WeaponViewmodelAnchor.js';

const forwardLocal = new THREE.Vector3(0, 0, -1);
const KNIFE_PRESENTATION_POSITION_STEP = 0.01;
const KNIFE_PRESENTATION_ROTATION_STEP = THREE.MathUtils.degToRad(3);
const knifeBladeHalfWidth = KNIFE_COMBAT_CONFIG.bladeWidth * 0.5;
const knifeBladeShoulder = KNIFE_COMBAT_CONFIG.bladeLength * 0.78;
const knifeEdgeHeelLocal = new THREE.Vector3(-knifeBladeHalfWidth, 0, -0.006);
const knifeEdgeShoulderLocal = new THREE.Vector3(-knifeBladeHalfWidth * 0.92, 0, -knifeBladeShoulder);
const knifeEdgeTipLocal = new THREE.Vector3(0, 0, -KNIFE_COMBAT_CONFIG.bladeLength);
const knifeCuttingEdgePath = createCuttingEdgePath([knifeEdgeHeelLocal, knifeEdgeShoulderLocal, knifeEdgeTipLocal]);
export const COMBAT_KNIFE_VIEWMODEL_LAYER = WEAPON_VIEWMODEL_LAYER;
export const COMBAT_KNIFE_WORLD_LAYER = WEAPON_WORLD_LAYER;
export const KNIFE_RUNTIME_COMBAT_MODE = 'puncture_only';
export const KNIFE_EDGE_COLLISION_RADIUS = KNIFE_COMBAT_CONFIG.bladeThickness * 0.5;
export const KNIFE_EDGE_BASE_SAMPLE_COUNT = 3;
export const KNIFE_EDGE_MAX_SAMPLE_COUNT = 9;
const COMBAT_KNIFE_RENDER_ORDER = 10030;
export const OLD_WORK_KNIFE_GLB_PATH = './assets/weapons/melee/old_work_knife_v004.glb';
const SLASH_EXTENSION_DIRECTION_DOT = Math.cos(THREE.MathUtils.degToRad(SLASH_CONFIG.extensionDirectionDegrees));
let oldWorkKnifeLoadWarningShown = false;
const loadOldWorkKnifeAsset = createCachedWeaponGlbLoader(OLD_WORK_KNIFE_GLB_PATH, 'Old Work Knife');

export function sampleKnifeCuttingEdgeLocal(edgeFraction, target = new THREE.Vector3()) {
  return sampleCuttingEdgeLocal(knifeCuttingEdgePath, edgeFraction, target);
}

export function resolveKnifeEdgeSampleCount(previousStart, previousEnd, currentStart, currentEnd, radius = KNIFE_EDGE_COLLISION_RADIUS) {
  return resolveCuttingEdgeSampleCount(previousStart, previousEnd, currentStart, currentEnd, {
    radius,
    baseSampleCount: KNIFE_EDGE_BASE_SAMPLE_COUNT,
    maxSampleCount: KNIFE_EDGE_MAX_SAMPLE_COUNT,
  });
}

export function resolveSlashLeadingPart(localMotion) {
  const lateralLead = Math.abs(localMotion.x);
  const flatLead = Math.abs(localMotion.y);
  return flatLead > lateralLead * 0.92 ? 'flat' : lateralLead > 0.12 ? 'edge' : 'flat';
}

export function computeBladeSurfaceCorrection(edgeMotion, normal, maximumCorrection = 0.06, target = new THREE.Vector3()) {
  const inwardTravel = Math.max(0, -edgeMotion.dot(normal));
  return inwardTravel > 0
    ? target.copy(normal).multiplyScalar(Math.min(maximumCorrection, inwardTravel + 0.004))
    : target.set(0, 0, 0);
}

function setLine(line, start, end) {
  const array = line.geometry.attributes.position.array;
  array[0] = start.x; array[1] = start.y; array[2] = start.z;
  array[3] = end.x; array[4] = end.y; array[5] = end.z;
  line.geometry.attributes.position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

export class WorldKnifeCombatController {
  constructor({ app, scene, camera, viewmodelAnchor = null, player, actor, physics, equipmentRuntime, controls, feedback = null, feedbackSystem = null, bloodEffects = null, combatDirector = null, combatRouter = null, contactActivationProvider = null, outdoorLightingDirector = null, visualAssetLoader = loadOldWorkKnifeAsset, bindPointerInput = true } = {}) {
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
    this.bloodEffects = bloodEffects;
    this.combatDirector = combatDirector ?? new CombatDirector({ actor, bloodEffects, feedbackSystem, cameraFeedback: feedback });
    this.combatRouter = combatRouter;
    this.ownsCombatDirector = combatDirector == null;
    if (feedback) this.combatDirector.setCameraFeedback(feedback);
    this.weaponContactRouter = new WeaponContactRouter({ combatRouter, fallbackActor: actor, fallbackDirector: this.combatDirector, cameraFeedback: feedback });
    this.contactActivationProvider = contactActivationProvider;
    this.outdoorLightingDirector = outdoorLightingDirector;
    this.visualAssetLoader = visualAssetLoader;
    this.bindPointerInput = bindPointerInput;
    this.config = KNIFE_COMBAT_CONFIG;
    this.weaponDefinition = Object.freeze({ id: this.config.itemId, family: 'knife', maximumPenetrationDepth: this.config.maximumPenetrationDepth, piercingAudio: OLD_WORK_KNIFE_PIERCING_AUDIO_PROFILE });
    this.penetrationAudioGate = new PenetrationAudioGate({ weaponId: this.config.itemId });
    this.intentWeapon = new MeleeIntentWeapon({ weaponId: this.config.itemId, minimumIntentSpeed: 0.035, slashBias: 0.52 });
    this.intentState = this.intentWeapon.current;
    this.state = KNIFE_CONTROL_STATES.ready;
    this.contactState = 'no_contact';
    this.reason = 'ready';
    this.contactDamageReason = 'non-damaging:no-pointer-owner';
    this.aimX = 0;
    this.aimY = 0;
    this.desiredExtension = 0;
    this.gestureOwnership = new WeaponGestureOwnership(this.config.workspace);
    Object.defineProperties(this, {
      gripPointerId: {
        configurable: true,
        get: () => this.gestureOwnership.pointerId,
        set: (value) => { this.gestureOwnership.pointerId = value; },
      },
      lastGripTimeMs: {
        configurable: true,
        get: () => this.gestureOwnership.lastTimeMs,
        set: (value) => { this.gestureOwnership.lastTimeMs = value; },
      },
    });
    this.gripStart = this.gestureOwnership.startPoint;
    this.lastGripPoint = this.gestureOwnership.lastPoint;
    this.deliberateInputVelocity = this.gestureOwnership.deliberateVelocity;
    this.offensiveVelocity = new THREE.Vector3();
    this.totalWorldVelocity = new THREE.Vector3();
    this.attackEnabled = false;
    this.returnElapsed = 0;
    this.returnDuration = 0;
    this.returnStartAim = new THREE.Vector2();
    this.returnStartExtension = 0;
    this.failedContact = false;
    this.wasCombatContactActive = false;
    this.desiredGrip = new THREE.Vector3();
    this.actualGrip = new THREE.Vector3();
    this.previousGrip = new THREE.Vector3();
    this.desiredQuaternion = new THREE.Quaternion();
    this.actualQuaternion = new THREE.Quaternion();
    this.visualGrip = new THREE.Vector3();
    this.visualQuaternion = new THREE.Quaternion();
    this.renderLocalGrip = new THREE.Vector3();
    this.renderLocalQuaternion = new THREE.Quaternion();
    this.renderTargetLocalGrip = new THREE.Vector3();
    this.renderTargetLocalQuaternion = new THREE.Quaternion();
    this.presentationContinuityActive = false;
    this.previousQuaternion = new THREE.Quaternion();
    this.bladeForward = new THREE.Vector3(0, 0, -1);
    this.previousTip = new THREE.Vector3();
    this.currentTip = new THREE.Vector3();
    this.desiredTip = new THREE.Vector3();
    this.edgeStart = new THREE.Vector3();
    this.edgeEnd = new THREE.Vector3();
    this.previousEdgeStart = new THREE.Vector3();
    this.previousEdgeEnd = new THREE.Vector3();
    this.poseWorkspace = createWeaponPoseWorkspace();
    this.poseQuaternion = this.poseWorkspace.localQuaternion;
    this.slashScratch = createWeaponContactScratch();
    this.slashState = {
      actor: null,
      director: null,
      bodyId: null,
      regionId: null,
      part: 'none',
      hit: null,
      startPoint: new THREE.Vector3(),
      startLocalPoint: new THREE.Vector3(),
      lastPoint: new THREE.Vector3(),
      surfaceNormal: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      lastCommittedDirection: new THREE.Vector3(),
      duration: 0,
      travel: 0,
      pressure: 0,
      woundId: null,
      directorInteractionId: null,
      missedTime: 0,
      pendingTravel: 0,
      pendingDepth: 0,
      pendingSeverity: 0,
      pendingDamageSeverity: 0,
      pendingDepthWeightedSeverity: 0,
      pendingEdgeAlignment: 0,
      pendingClassification: null,
      lastCommittedClassification: null,
      extensionCommitCount: 0,
      edgeAnchorT: 0.5,
    };
    this.onSlashWoundCreated = (wound, directedInteraction) => {
      if (this.activeSlash?.directorInteractionId === directedInteraction.id) this.activeSlash.woundId = wound?.id ?? null;
    };
    this.combatColliderFilter = (collider) => this.ownsCombatCollider(collider);
    this.edgeSweepRequest = {
      edgePath: knifeCuttingEdgePath,
      previousPosition: this.previousGrip,
      previousQuaternion: this.previousQuaternion,
      currentPosition: this.actualGrip,
      currentQuaternion: this.actualQuaternion,
      previousStart: this.previousEdgeStart,
      previousEnd: this.previousEdgeEnd,
      radius: KNIFE_EDGE_COLLISION_RADIUS,
      baseSampleCount: KNIFE_EDGE_BASE_SAMPLE_COUNT,
      maxSampleCount: KNIFE_EDGE_MAX_SAMPLE_COUNT,
      physics: this.physics,
      colliderFilter: this.combatColliderFilter,
      stableAnchorT: 0.5,
      scratch: this.slashScratch.edgeSweep,
    };
    this.entry = null;
    this.activeSlash = null;
    this.lastContactPart = 'none';
    this.slashCount = 0;
    this.suppressedSlashAttempts = 0;
    this.lastEdgeSampleCount = 0;
    this.penetrationDepth = 0;
    this.maximumDepthReached = 0;
    this.contactNormal = new THREE.Vector3();
    this.lastSweep = { from: new THREE.Vector3(), to: new THREE.Vector3() };
    this.poseRebasePositions = [this.actualGrip, this.previousGrip, this.desiredGrip, this.currentTip, this.previousTip, this.desiredTip, this.edgeStart, this.edgeEnd, this.previousEdgeStart, this.previousEdgeEnd, this.lastSweep.from, this.lastSweep.to];
    this.poseRebaseQuaternions = [this.actualQuaternion, this.previousQuaternion, this.desiredQuaternion];
    this.poseRebaseRequest = { camera: this.camera, poseWorkspace: this.poseWorkspace, anchored: false, positions: this.poseRebasePositions, quaternions: this.poseRebaseQuaternions };
    this.desiredPoseRequest = {
      camera: this.camera,
      workspace: this.config.workspace,
      poseWorkspace: this.poseWorkspace,
      aimX: 0,
      aimY: 0,
      extension: 0,
      pitchFromAimY: 0.34,
      yawFromAimX: -0.34,
      rollFromAimX: -0.12,
      tipLength: this.config.bladeLength,
      desiredGrip: this.desiredGrip,
      desiredQuaternion: this.desiredQuaternion,
      desiredTip: this.desiredTip,
    };
    this.lastFrameVelocity = 0;
    this.visibleCollisionError = 0;
    this.maximumPresentationOffset = 0;
    this.lastPhysicsDt = 1 / 60;
    this.tissueResistanceSample = { phase: 'skin', effectiveResistance: this.config.minimumPunctureSpeed, drag: 0, deflection: 0 };
    this.microResponse = { kind: 'idle', duration: 0, compression: 0, recoil: 0, roll: 0, twist: 0, vibration: 0 };
    this.microElapsed = 0;
    this.microCompression = 0;
    this.microRecoil = 0;
    this.microRoll = 0;
    this.microTwist = 0;
    this.microVariation = 0;
    this.microActive = false;
    this.visualDepthMode = null;
    this.currentRenderLayer = null;
    this.transitionLightingDiscontinuityCount = 0;
    this.outdoorMaterialRegistration = { status: outdoorLightingDirector ? 'pending' : 'unavailable', registered: false, eligibleMaterialCount: 0, ordinaryEmissiveScale: null };
    this.presentationReady = true;
    this.microLocalOffset = new THREE.Vector3();
    this.microWorldOffset = new THREE.Vector3();
    this.microQuaternion = new THREE.Quaternion();
    this.microEuler = new THREE.Euler(0, 0, 0, 'XYZ');
    this.disposers = [];
    this.disposed = false;
    this.buildVisual();
    this.presentation = new WeaponPresentationRuntime({ itemId: this.config.itemId, root: this.visual, scene: this.scene, camera: this.camera, viewmodelAnchor: this.viewmodelAnchor });
    this.presentation.recordLayer(COMBAT_KNIFE_VIEWMODEL_LAYER);
    this.weaponLayers = Object.freeze({
      visual: Object.freeze({ kind: 'visual', root: this.visual }),
      collision: Object.freeze({ kind: 'collision', controller: this }),
      intent: Object.freeze({ kind: 'intent', interpreter: this.intentWeapon }),
    });
    this.buildDebug();
    this.initializePose();
    if (this.bindPointerInput) this.bindInput();
  }

  buildVisual() {
    this.materials = [];
    this.visualGeometries = [];
    this.visualAssetState = 'loading';
    this.visualAssetError = null;
    this.visual = new THREE.Group();
    this.visual.name = 'old-work-knife-authoritative-world-weapon';
    this.visualDepthMode = 'viewmodel';
    this.applyVisualDepthMode();
    this.visualLoadPromise = this.visualAssetLoader().then((source) => {
      const visual = cloneOwnedWeaponVisual(source);
      if (this.disposed) {
        disposeOwnedWeaponVisual(visual);
        return 'disposed';
      }
      visual.root.name = 'old-work-knife-glb-visual';
      visual.root.userData.sourceAsset = OLD_WORK_KNIFE_GLB_PATH;
      this.visual.add(visual.root);
      this.visualGeometries.push(...visual.geometries);
      this.materials.push(...visual.materials);
      this.visualAssetState = 'loaded';
      this.registerOutdoorMaterials(visual.root);
      this.applyVisualDepthMode();
      return this.visualAssetState;
    }).catch((error) => {
      if (this.disposed) return 'disposed';
      this.visualAssetError = error;
      this.buildFallbackVisual();
      this.visualAssetState = 'fallback';
      this.applyVisualDepthMode();
      if (!oldWorkKnifeLoadWarningShown && typeof window !== 'undefined') {
        oldWorkKnifeLoadWarningShown = true;
        console.warn(`Failed to load ${OLD_WORK_KNIFE_GLB_PATH}; using the procedural fallback.`, error);
      }
      return this.visualAssetState;
    });
  }

  buildFallbackVisual() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x4c3021, roughness: 0.96 });
    const rust = new THREE.MeshStandardMaterial({ color: 0x6a4a3b, roughness: 0.72, metalness: 0.58 });
    const darkRust = new THREE.MeshStandardMaterial({ color: 0x302621, roughness: 0.82, metalness: 0.45 });
    const handleGeometry = new THREE.CylinderGeometry(0.026, 0.03, this.config.handleLength, 8);
    const guardGeometry = new THREE.BoxGeometry(0.09, 0.022, 0.025);
    const handle = new THREE.Mesh(handleGeometry, wood);
    handle.name = 'old-work-knife-grip';
    handle.rotation.x = Math.PI / 2;
    handle.position.z = this.config.handleLength * 0.5;
    this.visual.add(handle);
    const guard = new THREE.Mesh(guardGeometry, darkRust);
    guard.name = 'old-work-knife-guard';
    guard.position.z = 0.015;
    this.visual.add(guard);
    const halfWidth = this.config.bladeWidth * 0.5;
    const shoulder = this.config.bladeLength * 0.78;
    const halfThickness = this.config.bladeThickness * 0.5;
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position', new THREE.Float32BufferAttribute([
      -halfWidth, halfThickness, -0.006, halfWidth, halfThickness, -0.006, halfWidth * 0.82, halfThickness, -shoulder, 0, halfThickness, -this.config.bladeLength,
      -halfWidth * 0.92, halfThickness, -shoulder, -halfWidth, -halfThickness, -0.006, halfWidth, -halfThickness, -0.006, halfWidth * 0.82, -halfThickness, -shoulder,
      0, -halfThickness, -this.config.bladeLength, -halfWidth * 0.92, -halfThickness, -shoulder,
    ], 3));
    blade.setIndex([0, 1, 2, 0, 2, 4, 4, 2, 3, 5, 7, 6, 5, 9, 7, 9, 8, 7, 0, 5, 6, 0, 6, 1, 1, 6, 7, 1, 7, 2, 2, 7, 8, 2, 8, 3, 3, 8, 9, 3, 9, 4, 4, 9, 5, 4, 5, 0]);
    blade.computeVertexNormals();
    const bladeMesh = new THREE.Mesh(blade, rust);
    bladeMesh.name = 'old-work-knife-blade-body';
    this.visual.add(bladeMesh);
    this.materials.push(wood, rust, darkRust);
    this.visualGeometries.push(handleGeometry, guardGeometry, blade);
    this.registerOutdoorMaterials(this.visual);
  }

  registerOutdoorMaterials(root) {
    if (!this.outdoorLightingDirector?.registerOrdinaryObject) return this.outdoorMaterialRegistration;
    this.outdoorMaterialRegistration = this.outdoorLightingDirector.registerOrdinaryObject(root);
    return this.outdoorMaterialRegistration;
  }

  applyVisualDepthMode() {
    const layer = this.entry ? COMBAT_KNIFE_WORLD_LAYER : COMBAT_KNIFE_VIEWMODEL_LAYER;
    const viewmodel = !this.entry;
    const before = this.currentRenderLayer != null && this.currentRenderLayer !== layer
      ? captureWeaponMaterialLightingState(this.visual)
      : null;
    applyWeaponRenderLayer(this.visual, {
      layer,
      renderOrder: viewmodel ? COMBAT_KNIFE_RENDER_ORDER : 0,
      itemId: this.config.itemId,
      viewmodel,
      configureMesh: (object) => { object.userData.combatKnifeViewmodel = viewmodel; },
    });
    this.currentRenderLayer = layer;
    this.presentation?.recordLayer?.(layer);
    if (this.entry) this.presentation?.transitionToWorld?.({ preserveWorld: true });
    else if (this.visual?.visible !== false) this.presentation?.transitionToViewmodel?.({ preserveWorld: true, extraction: this.presentation?.presentationMode === 'world' });
    if (before && weaponMaterialLightingStateChanged(before, captureWeaponMaterialLightingState(this.visual))) {
      this.transitionLightingDiscontinuityCount = Math.min(1_000_000, this.transitionLightingDiscontinuityCount + 1);
    }
  }

  syncVisualDepthMode() {
    const depthMode = this.entry ? 'world-occluded' : 'viewmodel';
    if (this.visualDepthMode === depthMode) return false;
    this.visualDepthMode = depthMode;
    this.applyVisualDepthMode();
    return true;
  }

  buildDebug() {
    this.debugRoot = new THREE.Group();
    this.debugRoot.name = 'world-knife-combat-debug';
    this.debugRoot.visible = false;
    const makeMarker = (color, size, name) => {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), new THREE.MeshBasicMaterial({ color, depthTest: false }));
      marker.name = name;
      marker.renderOrder = 20000;
      this.debugRoot.add(marker);
      return marker;
    };
    const makeLine = (color, name) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, depthTest: false }));
      line.name = name;
      line.renderOrder = 19999;
      this.debugRoot.add(line);
      return line;
    };
    this.debugDesired = makeMarker(0xffcf33, 0.025, 'desired-hand-position');
    this.debugActual = makeMarker(0x3dff83, 0.025, 'actual-hand-position');
    this.debugTip = makeMarker(0xff3a38, 0.02, 'knife-tip');
    this.debugEntry = makeMarker(0xcf4cff, 0.022, 'penetration-entry');
    this.debugForward = makeLine(0xff3434, 'blade-forward-axis');
    this.debugSweep = makeLine(0x47d6ff, 'previous-current-tip-sweep');
    this.debugEdge = makeLine(0xffd348, 'cutting-edge-segment');
    this.debugCameraRay = makeLine(0xffffff, 'camera-center-ray-comparison-only');
    this.debugPenetration = makeLine(0xcf4cff, 'penetration-axis-depth');
    const workspace = this.config.workspace;
    const size = new THREE.Vector3(workspace.max[0] - workspace.min[0], workspace.max[1] - workspace.min[1], workspace.max[2] - workspace.min[2]);
    this.debugWorkspace = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)), new THREE.LineBasicMaterial({ color: 0x4fd2ff, transparent: true, opacity: 0.45, depthTest: false }));
    this.debugWorkspace.name = 'camera-relative-hand-workspace-bounds';
    this.debugRoot.add(this.debugWorkspace);
    this.scene.add(this.debugRoot);
  }

  initializePose() {
    initializeCameraRelativeWeaponPose({
      camera: this.camera,
      workspace: this.config.workspace,
      poseWorkspace: this.poseWorkspace,
      actualGrip: this.actualGrip,
      previousGrip: this.previousGrip,
      desiredGrip: this.desiredGrip,
      actualQuaternion: this.actualQuaternion,
      previousQuaternion: this.previousQuaternion,
      desiredQuaternion: this.desiredQuaternion,
    });
    this.updateDerivedPose(true);
    this.lastSweep.from.copy(this.currentTip);
    this.lastSweep.to.copy(this.currentTip);
    this.captureFreeRenderPose(true);
  }

  captureFreeRenderPose(force = false) {
    if (this.entry || !this.camera) return false;
    this.camera.updateMatrixWorld(true);
    this.renderTargetLocalGrip.copy(this.actualGrip);
    this.camera.worldToLocal(this.renderTargetLocalGrip);
    this.camera.getWorldQuaternion(this.slashScratch.inverseQuaternion);
    this.renderTargetLocalQuaternion.copy(this.slashScratch.inverseQuaternion).invert().multiply(this.actualQuaternion).normalize();
    if (force || !this.presentationContinuityActive) {
      this.renderLocalGrip.copy(this.renderTargetLocalGrip);
      this.renderLocalQuaternion.copy(this.renderTargetLocalQuaternion);
    }
    return true;
  }

  beginFreePresentationContinuity() {
    if (!this.viewmodelAnchor || this.visual.parent !== this.viewmodelAnchor) return false;
    this.renderLocalGrip.copy(this.visual.position);
    this.renderLocalQuaternion.copy(this.visual.quaternion).normalize();
    this.presentationContinuityActive = true;
    this.captureFreeRenderPose(false);
    return true;
  }

  rebaseFreeWeaponToCamera() {
    this.poseRebaseRequest.anchored = Boolean(this.entry);
    rebaseWorldWeaponPoseToCamera(this.poseRebaseRequest);
  }

  bindInput() {
    this.disposers.push(bindWeaponPointerEvents({
      viewport: this.viewport,
      onPointerDown: (event) => this.pointerDown(event),
      onPointerMove: (event) => this.pointerMove(event),
      onPointerEnd: (event) => this.pointerEnd(event),
      onSuspend: () => this.cancel('app-suspended'),
    }));
  }

  pointerDown(event) {
    if (this.gripPointerId != null || !this.isEquipped() || event.target?.closest?.(DEFAULT_WEAPON_POINTER_BLOCK_SELECTOR)) return;
    if (!this.projectGrabHit(event.clientX, event.clientY, this.viewport)) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    this.acquireGrip(event.pointerId, event.clientX, event.clientY, performance.now());
    this.viewport.setPointerCapture?.(event.pointerId);
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
    this.viewport.releasePointerCapture?.(event.pointerId);
    this.releaseGrip('pointer-release');
  }

  isEquipped() {
    return this.equipmentRuntime?.getEquippedToolId?.() === this.config.itemId && this.equipmentRuntime?.hasItem?.(this.config.itemId);
  }

  acquireGrip(pointerId, clientX, clientY, timeMs = performance.now()) {
    if (this.gripPointerId != null || !this.isEquipped()) return false;
    if (!this.gestureOwnership.acquire(pointerId, clientX, clientY, timeMs)) return false;
    this.state = this.entry ? KNIFE_CONTROL_STATES.embedded : KNIFE_CONTROL_STATES.gripped;
    this.reason = 'thumb-grip-acquired';
    return true;
  }

  applyGripGesture(pointerId, deltaX, deltaY, clientX, clientY, timeMs = performance.now()) {
    const previousExtension = this.desiredExtension;
    const sample = this.gestureOwnership.update(pointerId, deltaX, deltaY, clientX, clientY, timeMs, previousExtension);
    if (!sample) return false;
    this.aimX = sample.aimX;
    this.aimY = sample.aimY;
    this.desiredExtension = sample.extension;
    if (this.entry) this.state = KNIFE_CONTROL_STATES.embedded;
    else this.state = sample.intentionalTravel >= 4 ? KNIFE_CONTROL_STATES.attacking : KNIFE_CONTROL_STATES.gripped;
    this.reason = this.entry ? 'grip-owned-embedded-manipulation' : this.state === KNIFE_CONTROL_STATES.attacking ? 'grip-owned-deliberate-attack' : 'thumb-gripped';
    return true;
  }

  releaseGrip(reason = 'pointer-release') {
    if (this.gripPointerId == null && !this.entry && this.state === KNIFE_CONTROL_STATES.ready) return;
    this.gestureOwnership.release();
    this.attackEnabled = false;
    this.offensiveVelocity.set(0, 0, 0);
    if (this.entry) this.entry.plantedDesiredGrip.copy(this.desiredGrip);
    const plan = getKnifeReleasePlan({ embeddedDepth: this.penetrationDepth, failedContact: this.failedContact, config: this.config });
    this.state = plan.state;
    this.reason = `${reason}:${plan.reason}`;
    this.returnElapsed = 0;
    this.returnDuration = plan.durationSeconds;
    this.returnStartAim.set(this.aimX, this.aimY);
    this.returnStartExtension = this.desiredExtension;
    this.failedContact = false;
  }

  beginDirectedWithdrawal(worldEntry = this.getEntryWorldPose()) {
    if (!this.entry?.directorInteractionId || this.entry.withdrawalStarted) return false;
    this.entry.withdrawalStarted = true;
    this.entry.director.beginWithdrawal(this.entry.directorInteractionId, { releaseSeverity: this.maximumDepthReached, direction: worldEntry?.axis?.clone?.().negate?.(), position: worldEntry?.point ?? this.currentTip });
    return true;
  }

  ownsCombatCollider(collider) {
    return this.weaponContactRouter.ownsCollider(collider);
  }

  resolveCombatTarget(collider, worldPoint) {
    return this.weaponContactRouter.resolveTarget(collider, worldPoint);
  }

  updateInput(dt) {
    this.gestureOwnership.decayDeliberateVelocity(dt);
    if (this.state !== KNIFE_CONTROL_STATES.returning) return;
    this.returnElapsed += dt;
    const progress = THREE.MathUtils.clamp(this.returnElapsed / Math.max(0.001, this.returnDuration), 0, 1);
    const eased = criticallyDampedReturnProgress(this.returnElapsed, this.returnDuration);
    this.aimX = THREE.MathUtils.lerp(this.returnStartAim.x, 0, eased);
    this.aimY = THREE.MathUtils.lerp(this.returnStartAim.y, 0, eased);
    this.desiredExtension = THREE.MathUtils.lerp(this.returnStartExtension, 0, eased);
    if (progress >= 1) {
      this.aimX = 0;
      this.aimY = 0;
      this.desiredExtension = 0;
      this.state = KNIFE_CONTROL_STATES.ready;
      this.reason = 'ready-after-return';
      this.presentationReady = !this.microActive;
    }
  }

  computeDesiredPose() {
    this.desiredPoseRequest.aimX = this.aimX;
    this.desiredPoseRequest.aimY = this.aimY;
    this.desiredPoseRequest.extension = this.desiredExtension;
    computeCameraRelativeWeaponPose(this.desiredPoseRequest);
  }

  beforePhysics(dt) {
    this.lastPhysicsDt = Math.max(0, dt);
    this.visual.visible = this.isEquipped();
    if (!this.visual.visible) {
      if (this.entry || this.gripPointerId != null || this.state !== KNIFE_CONTROL_STATES.ready) this.cancel('weapon-unequipped');
      return;
    }
    this.presentation.recordPhysicalCameraMatrix();
    const combatContactActive = this.contactActivationProvider?.() ?? true;
    if (this.wasCombatContactActive && !combatContactActive && this.gripPointerId != null) this.releaseGrip('combat-range-exit');
    this.wasCombatContactActive = combatContactActive;
    this.rebaseFreeWeaponToCamera();
    this.updateInput(dt);
    this.computeDesiredPose();
    this.previousGrip.copy(this.actualGrip);
    this.previousQuaternion.copy(this.actualQuaternion);
    this.previousTip.copy(this.currentTip);
    this.previousEdgeStart.copy(this.edgeStart);
    this.previousEdgeEnd.copy(this.edgeEnd);
    if (this.entry) this.solveEmbeddedPose(dt);
    else this.solveFreePose(dt);
    this.syncVisualDepthMode();
    this.updateDerivedPose();
    if (!this.entry) this.captureFreeRenderPose();
  }

  solveFreePose(dt) {
    // Free-space visual/collision tracking is direct. Weight comes from contact
    // resistance and recovery, never delayed hand tracking.
    this.actualGrip.copy(this.desiredGrip);
    this.actualQuaternion.copy(this.desiredQuaternion);
    const scratch = this.slashScratch;
    const prospectiveTip = deriveBladeTip(this.actualGrip, this.actualQuaternion, this.config.bladeLength, scratch.prospectiveTip);
    const travelVector = scratch.travel.subVectors(prospectiveTip, this.previousTip);
    const travel = travelVector.length();
    this.totalWorldVelocity.copy(travelVector).divideScalar(Math.max(dt, 1e-5));
    this.lastFrameVelocity = this.totalWorldVelocity.length();
    this.camera.getWorldQuaternion(this.poseQuaternion);
    this.offensiveVelocity.copy(this.deliberateInputVelocity).applyQuaternion(this.poseQuaternion);
    const deliberateSpeed = this.offensiveVelocity.length();
    const combatContactActive = this.contactActivationProvider?.() ?? true;
    this.intentState = this.intentWeapon.interpret({ ownerId: this.gripPointerId, controlState: this.state, localVelocity: this.deliberateInputVelocity, embedded: false });
    this.attackEnabled = combatContactActive && isDamageIntent(this.intentState) && canKnifeCreateOffensiveContact({ pointerOwnerId: this.gripPointerId, state: this.state, deliberateSpeed, minimumSpeed: 0.035 });
    this.lastSweep.from.copy(this.previousTip);
    this.lastSweep.to.copy(prospectiveTip);
    if (!this.attackEnabled) {
      this.contactDamageReason = this.gripPointerId == null
        ? 'non-damaging:no-pointer-owner'
        : !combatContactActive
          ? 'non-damaging:outside-combat-contact-range'
          : this.state === KNIFE_CONTROL_STATES.returning
            ? 'non-damaging:spring-return'
            : 'non-damaging:no-deliberate-input-energy';
      this.releaseSlashContact(dt, true);
      return;
    }
    this.contactDamageReason = 'damaging:grip-owned-deliberate-motion';
    if (travel <= 1e-5) { this.releaseSlashContact(dt, false); return; }
    const forward = normalizedBladeForward(this.actualQuaternion, scratch.forward);
    const movementDirection = scratch.movementDirection.copy(this.offensiveVelocity).normalize();
    const offensiveTravel = Math.min(travel, deliberateSpeed * dt);
    const offensiveSweepStart = scratch.offensiveSweepStart.copy(prospectiveTip).addScaledVector(movementDirection, -offensiveTravel);
    const forwardMotion = movementDirection.dot(forward);
    const tangentialRatio = Math.sqrt(Math.max(0, 1 - forwardMotion * forwardMotion));
    // A physical draw cut can include inward pressure. Give the swept edge first
    // ownership only for a substantially tangential tip path; straight thrusts
    // remain tip-authoritative.
    if (KNIFE_RUNTIME_COMBAT_MODE === 'puncture_only' && (this.intentState.intent === MELEE_INTENTS.slash || tangentialRatio >= 0.52)) {
      this.suppressedSlashAttempts = Math.min(1_000_000, this.suppressedSlashAttempts + 1);
      this.attackEnabled = false;
      this.contactDamageReason = 'non-damaging:puncture-only-lateral-motion';
      this.lastContactPart = 'none';
      this.releaseSlashContact(dt, true);
      return;
    }
    if (KNIFE_RUNTIME_COMBAT_MODE !== 'puncture_only' && tangentialRatio >= 0.52 && this.resolveSweptEdgeContact(dt)) {
      return;
    }
    this.releaseSlashContact(dt, false);
    const hit = this.physics.castWeaponTip(offensiveSweepStart, prospectiveTip, this.config.tipRadius, this.combatColliderFilter);
    if (!hit?.collider) return;
    const toi = THREE.MathUtils.clamp(hit.time_of_impact ?? 0, 0, 1);
    const contactPoint = scratch.contactPoint.copy(offensiveSweepStart).lerp(prospectiveTip, toi);
    const contactNormal = hit.normal1
      ? scratch.contactNormal.set(hit.normal1.x, hit.normal1.y, hit.normal1.z).normalize()
      : scratch.contactNormal.copy(this.bladeForward).negate();
    const routedTarget = this.resolveCombatTarget(hit.collider, contactPoint);
    if (!routedTarget) return;
    const { hit: semanticHit, actor: targetActor, director: targetDirector } = routedTarget;
    const alignment = movementDirection.dot(forward);
    this.contactNormal.copy(contactNormal);
    this.lastContactPart = 'tip';
    const classification = classifyKnifeContact({ speed: deliberateSpeed, alignment, part: Math.abs(alignment) < 0.24 ? 'edge' : 'tip', minimumSpeed: this.config.minimumPunctureSpeed, minimumAlignment: this.config.minimumPunctureAlignment, failedAlignment: this.config.failedPenetrationAlignment });
    if (classification.state === 'edge_contact' || classification.state === 'glancing_contact') {
      this.contactState = classification.state;
      this.state = KNIFE_CONTROL_STATES.contact;
      this.reason = classification.reason;
      this.failedContact = true;
      this.actualGrip.add(contactNormal.multiplyScalar(Math.min(0.035, travel)));
      semanticHit.body.applyImpulseAtPoint(movementDirection.multiplyScalar(0.035), contactPoint, true);
      targetDirector.reportContact({ weapon: this.weaponDefinition, intent: this.intentState, hit: semanticHit, position: contactPoint, direction: movementDirection, cue: classification.state === 'glancing_contact' ? 'blade_scrape' : 'clothing_contact', severity: 0.2, resistance: classification.state, weaponAdapter: this });
      return;
    }
    if (!classification.penetrates) {
      this.contactState = classification.state;
      this.state = KNIFE_CONTROL_STATES.contact;
      this.reason = classification.reason;
      this.failedContact = true;
      this.actualGrip.add(contactNormal.multiplyScalar(Math.min(0.025, travel)));
      targetDirector.reportContact({ weapon: this.weaponDefinition, intent: this.intentState, hit: semanticHit, position: contactPoint, direction: movementDirection, cue: 'failed_tip', severity: this.lastFrameVelocity * 0.2, resistance: 'failed_tip_stop', weaponAdapter: this });
      return;
    }
    this.beginPenetration(semanticHit, contactPoint, forward, contactNormal, alignment, targetActor, targetDirector);
  }

  resolveSweptEdgeContact(dt) {
    const scratch = this.slashScratch;
    const stableAnchorT = this.activeSlash?.edgeAnchorT ?? 0.5;
    this.edgeSweepRequest.stableAnchorT = stableAnchorT;
    const contact = sweepCuttingEdge(this.edgeSweepRequest);
    this.lastEdgeSampleCount = contact.sampleCount;
    const hit = contact.hit;
    if (!hit) return false;
    const point = hit.witness1
      ? scratch.point.set(hit.witness1.x, hit.witness1.y, hit.witness1.z)
      : scratch.point.copy(scratch.edgeSweep.selectedPrevious).lerp(scratch.edgeSweep.selectedCurrent, contact.toi);
    const routedTarget = this.resolveCombatTarget(hit.collider, point);
    if (!routedTarget) return false;
    const { hit: semanticHit, actor: targetActor, director: targetDirector } = routedTarget;
    const normal = hit.normal1
      ? scratch.normal.set(hit.normal1.x, hit.normal1.y, hit.normal1.z).normalize()
      : scratch.normal.copy(point).sub(this.getBodyCenter(semanticHit.body, scratch.bodyCenter)).normalize();
    const edgeMotion = scratch.edgeMotion.subVectors(scratch.edgeSweep.selectedCurrent, scratch.edgeSweep.selectedPrevious);
    const direction = scratch.direction.copy(this.offensiveVelocity.lengthSq() > 1e-8 ? this.offensiveVelocity : edgeMotion).normalize();
    const localMotion = scratch.localMotion.copy(direction).applyQuaternion(scratch.inverseQuaternion.copy(this.actualQuaternion).invert());
    const lateralLead = Math.abs(localMotion.x);
    // Both lateral draw directions are accepted at mobile gesture scale. Flat-led
    // motion still binds instead of cutting, so camera motion cannot fake a slash.
    const part = resolveSlashLeadingPart(localMotion);
    const surfacePressure = Math.max(0, -direction.dot(normal));
    const forwardPressure = Math.max(0, -localMotion.z) * 0.65;
    const pressure = Math.max(surfacePressure, forwardPressure, part === 'edge' ? lateralLead * 0.16 : 0);
    const edgeAlignment = part === 'edge' ? THREE.MathUtils.clamp(lateralLead, 0, 1) : 0;
    const stepTravel = Math.min(SLASH_CONFIG.maximumStepLength, edgeMotion.length());
    const speed = this.offensiveVelocity.length();
    const sameOwner = this.activeSlash?.actor === targetActor && this.activeSlash?.bodyId === semanticHit.bodyId && this.activeSlash?.regionId === semanticHit.regionId && this.activeSlash?.part === part;
    if (!sameOwner) {
      this.finishActiveSlash(true);
      this.beginActiveSlash({ actor: targetActor, director: targetDirector, hit: semanticHit, part, point, normal, direction });
    }
    const slash = this.activeSlash;
    slash.hit = semanticHit;
    slash.edgeAnchorT = contact.sampleT;
    slash.duration += dt;
    slash.travel = Math.min(SLASH_CONFIG.maximumWoundLength, slash.travel + stepTravel);
    slash.pressure = THREE.MathUtils.lerp(slash.pressure, pressure, 0.4);
    slash.direction.lerp(direction, 0.35).normalize();
    slash.lastPoint.copy(point);
    slash.surfaceNormal.copy(normal);
    slash.missedTime = 0;
    const regionKey = semanticHit.regionId.includes('arm') ? 'arm' : semanticHit.regionId.includes('leg') || semanticHit.regionId.includes('thigh') ? 'leg' : semanticHit.regionId.includes('hand') ? 'hand' : semanticHit.regionId.includes('foot') ? 'foot' : semanticHit.regionId;
    const classification = classifySlashContact({ part, edgeSpeed: speed, edgeAlignment, pressure: slash.pressure, contactDuration: slash.duration, travel: slash.travel, tissueResistance: semanticHit.region.softTissueResistance, clothingResistance: SLASH_CONFIG.clothingResistance[regionKey] ?? 0.2 });
    this.contactState = classification.state;
    this.state = KNIFE_CONTROL_STATES.contact;
    this.reason = `${part}:${classification.state}`;
    this.lastContactPart = part;
    if (classification.cuts) {
      this.actualGrip.add(computeBladeSurfaceCorrection(edgeMotion, normal, 0.06, scratch.correction));
      if (!slash.directorInteractionId) {
        const interaction = slash.director.beginSlash({
          weapon: this.weaponDefinition,
          intent: this.intentState,
          hit: { ...semanticHit, localPoint: slash.startLocalPoint.clone() },
          startPoint: slash.startPoint,
          endPoint: point,
          surfaceNormal: normal,
          cutDirection: slash.direction,
          depth: classification.depth,
          cutLength: classification.physicalTravel,
          severity: classification.severity,
          classification: classification.state,
          edgeAlignment,
          weaponAdapter: this,
          onWoundCreated: this.onSlashWoundCreated,
        });
        if (interaction) {
          slash.directorInteractionId = interaction.id;
          slash.lastCommittedDirection.copy(slash.direction);
          slash.lastCommittedClassification = classification.state;
          this.slashCount += 1;
        }
      } else {
        this.accumulateSlashExtension(slash, { addedTravel: stepTravel, depth: classification.depth, severity: classification.severity, classification: classification.state, edgeAlignment });
      }
    } else if (part === 'flat' || part === 'spine') {
      semanticHit.body.applyImpulseAtPoint(scratch.impulse.copy(direction).multiplyScalar(Math.min(0.045, speed * 0.008)), point, true);
      targetDirector.reportContact({ weapon: this.weaponDefinition, intent: this.intentState, hit: semanticHit, position: point, direction, cue: part === 'spine' ? 'blunt_contact' : 'clothing_contact', severity: pressure * speed * 0.1, resistance: `${part}_contact`, weaponAdapter: this });
    } else if (classification.state === 'scraping_contact') targetDirector.reportContact({ weapon: this.weaponDefinition, intent: this.intentState, hit: semanticHit, position: point, direction, cue: 'blade_scrape', severity: speed * 0.1, resistance: 'surface_scrape', weaponAdapter: this });
    return true;
  }

  beginActiveSlash({ actor, director, hit, part, point, normal, direction }) {
    const slash = this.slashState;
    slash.actor = actor;
    slash.director = director;
    slash.bodyId = hit.bodyId;
    slash.regionId = hit.regionId;
    slash.part = part;
    slash.hit = hit;
    slash.startPoint.copy(point);
    slash.startLocalPoint.copy(hit.localPoint);
    slash.lastPoint.copy(point);
    slash.surfaceNormal.copy(normal);
    slash.direction.copy(direction);
    slash.lastCommittedDirection.set(0, 0, 0);
    slash.duration = 0;
    slash.travel = 0;
    slash.pressure = 0;
    slash.woundId = null;
    slash.directorInteractionId = null;
    slash.missedTime = 0;
    slash.pendingTravel = 0;
    slash.pendingDepth = 0;
    slash.pendingSeverity = 0;
    slash.pendingDamageSeverity = 0;
    slash.pendingDepthWeightedSeverity = 0;
    slash.pendingEdgeAlignment = 0;
    slash.pendingClassification = null;
    slash.lastCommittedClassification = null;
    slash.extensionCommitCount = 0;
    slash.edgeAnchorT = 0.5;
    this.activeSlash = slash;
    return slash;
  }

  accumulateSlashExtension(slash, { addedTravel, depth, severity, classification, edgeAlignment }) {
    const sampleSeverity = Math.max(0, severity);
    const previousTravel = slash.pendingTravel;
    slash.pendingTravel += Math.max(0, addedTravel);
    slash.pendingDepth = Math.max(slash.pendingDepth, depth);
    slash.pendingSeverity = Math.max(slash.pendingSeverity, sampleSeverity);
    slash.pendingDamageSeverity += sampleSeverity;
    slash.pendingDepthWeightedSeverity += sampleSeverity * Math.max(0, depth);
    slash.pendingEdgeAlignment = slash.pendingTravel > 0
      ? (slash.pendingEdgeAlignment * previousTravel + edgeAlignment * Math.max(0, addedTravel)) / slash.pendingTravel
      : edgeAlignment;
    slash.pendingClassification = classification;
    return this.commitSlashExtension(slash, false);
  }

  commitSlashExtension(slash, force = false) {
    if (!slash?.directorInteractionId || slash.pendingTravel <= 0) return false;
    const classificationChanged = slash.pendingClassification !== slash.lastCommittedClassification;
    const directionChanged = slash.lastCommittedDirection.lengthSq() > 0
      && slash.lastCommittedDirection.dot(slash.direction) <= SLASH_EXTENSION_DIRECTION_DOT;
    if (!force && slash.pendingTravel < SLASH_CONFIG.extensionCommitDistance && !classificationChanged && !directionChanged) return false;
    const committed = slash.director.extendSlash(slash.directorInteractionId, {
      hit: slash.hit,
      startPoint: slash.startPoint,
      endPoint: slash.lastPoint,
      surfaceNormal: slash.surfaceNormal,
      cutDirection: slash.direction,
      depth: slash.pendingDepth,
      cutLength: slash.pendingTravel,
      severity: slash.pendingSeverity,
      damageSeverity: slash.pendingDamageSeverity,
      depthWeightedSeverity: slash.pendingDepthWeightedSeverity,
      classification: slash.pendingClassification,
      edgeAlignment: slash.pendingEdgeAlignment,
    });
    if (!committed) return false;
    slash.pendingTravel = 0;
    slash.pendingDepth = 0;
    slash.pendingSeverity = 0;
    slash.pendingDamageSeverity = 0;
    slash.pendingDepthWeightedSeverity = 0;
    slash.pendingEdgeAlignment = 0;
    slash.lastCommittedClassification = slash.pendingClassification;
    slash.pendingClassification = null;
    slash.lastCommittedDirection.copy(slash.direction);
    slash.extensionCommitCount += 1;
    return true;
  }

  getBodyCenter(body, target = new THREE.Vector3()) {
    return getRigidBodyWorldPosition(body, target);
  }

  releaseSlashContact(dt, interrupted) {
    if (!this.activeSlash) return;
    this.activeSlash.missedTime += dt;
    if (this.activeSlash.missedTime >= SLASH_CONFIG.contactReleaseSeconds) this.finishActiveSlash(interrupted);
  }

  finishActiveSlash(interrupted = false) {
    if (!this.activeSlash) return;
    if (this.activeSlash.directorInteractionId) {
      this.commitSlashExtension(this.activeSlash, true);
      this.activeSlash.director.finishSlash(this.activeSlash.directorInteractionId, interrupted);
    }
    if (!this.activeSlash.woundId && this.activeSlash.duration > 0) {
      this.contactState = interrupted ? 'interrupted_cut' : this.contactState;
      this.reason = interrupted ? 'edge-path-interrupted-before-cut' : this.reason;
    }
    this.activeSlash = null;
  }

  beginPenetration(hit, entryPoint, axis, surfaceNormal, alignment, targetActor = this.actor, targetDirector = this.combatDirector) {
    this.intentState = this.intentWeapon.interpret({ ownerId: this.gripPointerId, controlState: this.state, localVelocity: this.deliberateInputVelocity, embedded: false });
    const interaction = targetDirector.beginPuncture({
      weapon: this.weaponDefinition,
      intent: this.intentState,
      hit,
      entryPoint,
      direction: axis,
      surfaceNormal,
      entryTangent: new THREE.Vector3(1, 0, 0).applyQuaternion(this.actualQuaternion).normalize(),
      depth: 0.004,
      force: this.offensiveVelocity.length(),
      weaponAdapter: this,
      penetrationAudioGate: this.penetrationAudioGate,
      onWoundCreated: (wound, directedInteraction) => {
        if (this.entry?.directorInteractionId === directedInteraction.id) this.entry.woundId = wound?.id ?? null;
      },
    });
    if (!interaction) return;
    this.entry = {
      actor: targetActor,
      director: targetDirector,
      hit,
      bodyId: hit.bodyId,
      localPoint: hit.localPoint.clone(),
      localAxis: worldDirectionToPhysicsBodyLocal(hit.bodyTransformAtCollision ?? hit.body, axis),
      initialAlignment: alignment,
      hardDepth: this.resolveHardStructureDepth(hit),
      woundId: null,
      directorInteractionId: interaction.id,
      softFeedback: false,
      deepFeedback: false,
      hardFeedback: false,
      withdrawalStarted: false,
      resistancePhase: 'skin',
      reportedLateralMotion: 0,
      plantedDesiredGrip: new THREE.Vector3(),
    };
    this.penetrationDepth = 0.004;
    this.maximumDepthReached = 0.004;
    this.contactState = 'surface_puncture';
    this.state = KNIFE_CONTROL_STATES.embedded;
    this.reason = 'aligned-tip-punctured-surface';
    targetActor.setEmbeddedWeapon(this);
    this.syncVisualDepthMode();
  }

  resolveHardStructureDepth(hit) {
    const region = hit.region;
    if (!region.hardStructure) return null;
    if (['skull', 'face', 'head'].includes(hit.regionId)) return region.hardStructureDepth;
    if (hit.regionId === 'neck') return Math.abs(hit.localPoint.x) < 0.055 ? region.hardStructureDepth : null;
    if (['upper_chest', 'lower_chest'].includes(hit.regionId)) {
      const ribBand = Math.abs(Math.sin((hit.localPoint.x + 0.42) * 17)) > 0.48;
      return ribBand ? region.hardStructureDepth : null;
    }
    return Math.abs(hit.localPoint.x) < 0.045 ? region.hardStructureDepth : null;
  }

  getEntryWorldPose() {
    const body = this.entry?.hit?.body;
    if (!body) return null;
    return {
      // A planted knife intentionally follows the current physics proxy. This is
      // distinct from initial surface binding, which uses the preserved world hit.
      point: physicsBodyLocalToWorld(body, this.entry.localPoint),
      axis: physicsBodyLocalDirectionToWorld(body, this.entry.localAxis),
    };
  }

  recallPlantedKnifeIfSeparated(dt) {
    if (this.gripPointerId != null || this.state === KNIFE_CONTROL_STATES.withdrawing || !this.entry?.plantedDesiredGrip) return false;
    if (this.entry.plantedDesiredGrip.distanceToSquared(this.desiredGrip) <= this.config.forcedExtractionDistance ** 2) return false;
    this.extract('walk-away-recall');
    this.solveFreePose(dt);
    return true;
  }

  solveEmbeddedPose(dt) {
    const worldEntry = this.getEntryWorldPose();
    if (!worldEntry || this.entry.actor?.disposed || !this.entry.actor?.bodies?.has(this.entry.bodyId)) { this.cancel('target-invalid'); return; }
    const maximumRegionDepth = Math.min(this.entry.hit.region.maximumTissueDepth, this.config.maximumPenetrationDepth, this.config.bladeLength);
    const assistedWithdrawal = this.state === KNIFE_CONTROL_STATES.withdrawing;
    const plantedHold = this.gripPointerId == null && !assistedWithdrawal;
    if (plantedHold && this.recallPlantedKnifeIfSeparated(dt)) return;
    const desiredProjection = this.desiredTip.clone().sub(worldEntry.point).dot(worldEntry.axis);
    let targetDepth = assistedWithdrawal
      ? Math.max(-0.04, this.penetrationDepth - this.config.withdrawalRate * dt)
      : plantedHold
        ? this.penetrationDepth
        : THREE.MathUtils.clamp(desiredProjection, -0.04, maximumRegionDepth);
    const hardDepth = this.entry.hardDepth;
    const wantsWithdrawal = assistedWithdrawal || targetDepth < this.penetrationDepth;
    const resistanceProfile = sampleTissueResistanceCurve({ depth: this.penetrationDepth, surfaceThickness: this.entry.hit.region.surfaceThickness, softTissueResistance: this.entry.hit.region.softTissueResistance, hardDepth, hardStructureResistance: this.entry.hit.region.hardStructureResistance, withdrawing: wantsWithdrawal }, this.tissueResistanceSample);
    const penetration = advancePenetrationDepth({ currentDepth: this.penetrationDepth, targetDepth, dt, tissueResistance: resistanceProfile.effectiveResistance, hardDepth, maximumDepth: maximumRegionDepth, penetrationRate: this.config.penetrationRate, withdrawalRate: this.config.withdrawalRate });
    const hardContact = penetration.hardContact;
    targetDepth = penetration.targetDepth;
    if (hardContact) {
      this.contactState = 'bone_contact';
      this.reason = 'hard-structure-resistance';
      if (!this.entry.hardFeedback) {
        this.entry.hardFeedback = true;
        this.entry.director.advancePenetration(this.entry.directorInteractionId, { hit: this.entry.hit, entryPoint: worldEntry.point, direction: worldEntry.axis, deltaDepth: 0, depth: this.penetrationDepth, force: 0, hardContact: true, resistanceProfile });
      }
    }
    const resistance = resistanceProfile.effectiveResistance;
    const previousDepth = this.penetrationDepth;
    this.penetrationDepth = penetration.depth;
    if (penetration.extracted) { this.extract(); return; }
    const constrainedTip = worldEntry.point.clone().addScaledVector(worldEntry.axis, Math.max(0, this.penetrationDepth));
    const desiredLateral = this.desiredTip.clone().sub(constrainedTip).addScaledVector(worldEntry.axis, -this.desiredTip.clone().sub(constrainedTip).dot(worldEntry.axis));
    const lateralDistance = desiredLateral.length();
    this.intentState = this.intentWeapon.interpret({ ownerId: this.gripPointerId, controlState: assistedWithdrawal ? KNIFE_CONTROL_STATES.withdrawing : KNIFE_CONTROL_STATES.embedded, localVelocity: this.deliberateInputVelocity, embedded: true });
    const embeddedAttackEnabled = !assistedWithdrawal && isDamageIntent(this.intentState) && canKnifeCreateOffensiveContact({ pointerOwnerId: this.gripPointerId, state: KNIFE_CONTROL_STATES.embedded, deliberateSpeed: this.deliberateInputVelocity.length(), minimumSpeed: 0.02 });
    const force = embeddedAttackEnabled ? Math.min(1.2, lateralDistance * this.config.forceTransfer) : 0;
    if (force > 0 && lateralDistance > 0.002) this.entry.hit.body.applyImpulseAtPoint(desiredLateral.normalize().multiplyScalar(force * dt), worldEntry.point, true);
    if (embeddedAttackEnabled && lateralDistance > this.config.lateralBindDistance) this.entry.director.reportResistance(this.entry.directorInteractionId, { kind: 'lateral_bind', intensity: lateralDistance / this.config.forcedExtractionDistance, depth: this.penetrationDepth, cue: 'blade_bind', position: worldEntry.point });
    if (embeddedAttackEnabled && lateralDistance > this.config.forcedExtractionDistance && targetDepth < this.penetrationDepth * 0.35) { this.extract('forced-lateral-release'); return; }
    this.actualQuaternion.setFromUnitVectors(forwardLocal, worldEntry.axis);
    this.actualGrip.copy(constrainedTip).addScaledVector(worldEntry.axis, -this.config.bladeLength);
    const deltaDepth = Math.max(0, this.penetrationDepth - previousDepth);
    const withdrawal = this.penetrationDepth < previousDepth - 0.001;
    if (withdrawal) {
      this.beginDirectedWithdrawal(worldEntry);
      if (this.entry.resistancePhase !== resistanceProfile.phase) {
        this.entry.resistancePhase = resistanceProfile.phase;
        this.entry.director.reportResistance(this.entry.directorInteractionId, { kind: resistanceProfile.phase, intensity: resistanceProfile.drag, depth: this.penetrationDepth, position: worldEntry.point });
      }
    }
    this.maximumDepthReached = Math.max(this.maximumDepthReached, this.penetrationDepth);
    const reportLateralMotion = embeddedAttackEnabled && lateralDistance >= this.entry.reportedLateralMotion + 0.003;
    if ((deltaDepth > 0 || reportLateralMotion) && embeddedAttackEnabled) {
      if (reportLateralMotion) this.entry.reportedLateralMotion = lateralDistance;
      this.entry.director.advancePenetration(this.entry.directorInteractionId, { hit: this.entry.hit, entryPoint: worldEntry.point, direction: worldEntry.axis, deltaDepth, depth: this.penetrationDepth, force: resistance + force, lateralMotion: this.entry.reportedLateralMotion, hardContact, resistanceProfile });
      if (this.penetrationDepth >= 0.025) this.entry.softFeedback = true;
      if (this.penetrationDepth >= 0.075) this.entry.deepFeedback = true;
    }
    if (!hardContact) this.contactState = withdrawal ? 'withdrawal' : this.penetrationDepth > 0.018 ? 'embedded' : 'active_penetration';
    if (!hardContact) this.reason = withdrawal ? 'controlled-extraction' : 'player-controlled-depth';
    this.state = assistedWithdrawal ? KNIFE_CONTROL_STATES.withdrawing : KNIFE_CONTROL_STATES.embedded;
    this.attackEnabled = embeddedAttackEnabled;
    this.contactDamageReason = embeddedAttackEnabled ? 'damaging:grip-owned-embedded-manipulation' : assistedWithdrawal ? 'non-damaging:assisted-withdrawal' : 'non-damaging:embedded-hold';
  }

  extract(reason = 'fully-extracted') {
    const entry = this.entry;
    const worldEntry = entry ? this.getEntryWorldPose() : null;
    if (entry?.directorInteractionId) {
      this.beginDirectedWithdrawal(worldEntry);
      entry.director.completeWithdrawal(entry.directorInteractionId, { releaseSeverity: this.maximumDepthReached, direction: worldEntry?.axis?.clone?.().negate?.(), position: worldEntry?.point ?? this.currentTip });
      this.penetrationAudioGate.rearmAfterFullExtraction(entry.directorInteractionId);
    }
    this.contactState = 'fully_extracted';
    this.reason = reason;
    this.entry = null;
    this.penetrationDepth = 0;
    entry?.actor?.setEmbeddedWeapon?.(null);
    this.syncVisualDepthMode();
    this.beginFreePresentationContinuity();
    if (this.gripPointerId == null) {
      this.state = KNIFE_CONTROL_STATES.returning;
      this.returnElapsed = 0;
      this.returnDuration = this.config.return.freeSeconds;
      this.returnStartAim.set(this.aimX, this.aimY);
      this.returnStartExtension = this.desiredExtension;
    } else this.state = KNIFE_CONTROL_STATES.attacking;
  }

  updateDerivedPose(initial = false) {
    normalizedBladeForward(this.actualQuaternion, this.bladeForward);
    deriveBladeTip(this.actualGrip, this.actualQuaternion, this.config.bladeLength, this.currentTip);
    this.edgeStart.copy(knifeEdgeHeelLocal).applyQuaternion(this.actualQuaternion).add(this.actualGrip);
    this.edgeEnd.copy(knifeEdgeTipLocal).applyQuaternion(this.actualQuaternion).add(this.actualGrip);
    if (initial) this.previousTip.copy(this.currentTip);
    if (initial) {
      this.previousEdgeStart.copy(this.edgeStart);
      this.previousEdgeEnd.copy(this.edgeEnd);
    }
  }

  onCombatResistance(payload = {}, interaction = {}) {
    resolveWeaponMicroResponse(payload.kind, payload.intensity, interaction.variation ?? 0, this.microResponse);
    this.microVariation = interaction.variation ?? 0;
    this.microElapsed = 0;
    this.microActive = true;
    this.presentationReady = false;
  }

  onCombatRecovery(_payload = {}, interaction = {}) {
    resolveWeaponMicroResponse('recovery_settle', 0.24, interaction.variation ?? this.microVariation, this.microResponse);
    this.microVariation = interaction.variation ?? this.microVariation;
    this.microElapsed = 0;
    this.microActive = true;
    this.presentationReady = false;
  }

  updateMicroPresentation(dt) {
    const safeDt = Math.max(0, Math.min(0.05, Number(dt) || 0));
    this.microElapsed += safeDt;
    const duration = Math.max(0.001, this.microResponse.duration || 0.001);
    const t = THREE.MathUtils.clamp(this.microElapsed / duration, 0, 1);
    const riseEnd = 0.18;
    let envelope;
    if (t < riseEnd) {
      const rise = t / riseEnd;
      envelope = rise * rise * (3 - 2 * rise);
    } else {
      const recovery = (t - riseEnd) / (1 - riseEnd);
      const x = recovery * 6;
      const raw = (1 + x) * Math.exp(-x);
      const end = 7 * Math.exp(-6);
      envelope = Math.max(0, (raw - end) / (1 - end));
    }
    const response = 1 - Math.exp(-safeDt * (envelope > 0.35 ? 42 : 20));
    this.microCompression = THREE.MathUtils.lerp(this.microCompression, this.microResponse.compression * envelope, response);
    this.microRecoil = THREE.MathUtils.lerp(this.microRecoil, this.microResponse.recoil * envelope, response);
    this.microRoll = THREE.MathUtils.lerp(this.microRoll, this.microResponse.roll * envelope, response);
    this.microTwist = THREE.MathUtils.lerp(this.microTwist, this.microResponse.twist * envelope, response);
    const vibration = this.microActive
      ? Math.sin(this.microElapsed * Math.PI * 46 + this.microVariation * Math.PI) * this.microResponse.vibration * Math.exp(-this.microElapsed * 28)
      : 0;
    this.microLocalOffset.set(vibration, -Math.abs(vibration) * 0.22, this.microCompression + this.microRecoil);
    this.microWorldOffset.copy(this.microLocalOffset).applyQuaternion(this.actualQuaternion);
    this.microQuaternion.setFromEuler(this.microEuler.set(this.microTwist, this.microRoll * 0.32, this.microRoll));
    if (t >= 1 && Math.abs(this.microCompression) + Math.abs(this.microRecoil) + Math.abs(this.microRoll) + Math.abs(this.microTwist) < 0.00008) {
      this.microActive = false;
      this.presentationReady = this.state === KNIFE_CONTROL_STATES.ready || this.state === KNIFE_CONTROL_STATES.gripped || this.state === KNIFE_CONTROL_STATES.attacking;
    }
  }

  afterPhysics(_alpha = 1, frameDelta = this.lastPhysicsDt) {
    this.presentation.beginRenderFrame();
    const equipped = this.isEquipped();
    this.visual.visible = equipped;
    if (!equipped) {
      if (this.entry || this.gripPointerId != null || this.state !== KNIFE_CONTROL_STATES.ready) this.cancel('weapon-unequipped');
      this.presentation.detachHidden();
      return;
    }
    const renderDt = Math.max(0, Math.min(0.05, Number(frameDelta) || 0));
    this.updateMicroPresentation(renderDt);
    let extractionContinuityCompleted = false;
    if (this.presentationContinuityActive && !this.entry) {
      const response = 1 - Math.exp(-renderDt * 16);
      const remainingDistance = this.renderLocalGrip.distanceTo(this.renderTargetLocalGrip);
      const positionJump = Math.min(remainingDistance, KNIFE_PRESENTATION_POSITION_STEP, remainingDistance * response);
      if (remainingDistance > 1e-12) this.renderLocalGrip.lerp(this.renderTargetLocalGrip, positionJump / remainingDistance);
      const remainingAngle = this.renderLocalQuaternion.angleTo(this.renderTargetLocalQuaternion);
      const rotationJump = Math.min(remainingAngle, KNIFE_PRESENTATION_ROTATION_STEP, remainingAngle * response);
      if (remainingAngle > 1e-12) this.renderLocalQuaternion.slerp(this.renderTargetLocalQuaternion, rotationJump / remainingAngle).normalize();
      this.presentation.recordPostExtractionPoseJump(positionJump, THREE.MathUtils.radToDeg(rotationJump));
      if (this.renderLocalGrip.distanceToSquared(this.renderTargetLocalGrip) <= 1e-8 && this.renderLocalQuaternion.angleTo(this.renderTargetLocalQuaternion) <= THREE.MathUtils.degToRad(0.05)) {
        this.renderLocalGrip.copy(this.renderTargetLocalGrip);
        this.renderLocalQuaternion.copy(this.renderTargetLocalQuaternion);
        this.presentationContinuityActive = false;
        extractionContinuityCompleted = true;
      }
    }
    this.visualGrip.copy(this.actualGrip);
    this.visualQuaternion.copy(this.actualQuaternion);
    if (!this.entry) {
      this.visualGrip.add(this.microWorldOffset);
      this.visualQuaternion.multiply(this.microQuaternion).normalize();
    }
    if (this.entry) this.presentation.writeWorldPose(this.visualGrip, this.visualQuaternion);
    else {
      const localGrip = this.slashScratch.point.copy(this.renderLocalGrip)
        .add(this.slashScratch.correction.copy(this.microLocalOffset).applyQuaternion(this.renderLocalQuaternion));
      const localQuaternion = this.slashScratch.inverseQuaternion.copy(this.renderLocalQuaternion).multiply(this.microQuaternion).normalize();
      this.presentation.writeViewmodelPose(localGrip, localQuaternion);
    }
    if (extractionContinuityCompleted) this.presentation.endExtractionContinuity();
    this.visibleCollisionError = this.visualGrip.distanceTo(this.actualGrip);
    this.maximumPresentationOffset = Math.max(this.maximumPresentationOffset, this.visibleCollisionError);
    this.updateDebug();
  }

  afterPhysicsStep(dt = 0) {
    if (this.ownsCombatDirector) this.combatDirector.update(dt);
  }

  updateDebug() {
    if (!this.debugRoot.visible) return;
    this.debugDesired.position.copy(this.desiredGrip);
    this.debugActual.position.copy(this.actualGrip);
    this.debugTip.position.copy(this.currentTip);
    this.debugEntry.visible = Boolean(this.entry);
    if (this.entry) this.debugEntry.position.copy(this.getEntryWorldPose()?.point ?? this.currentTip);
    setLine(this.debugForward, this.actualGrip, this.actualGrip.clone().addScaledVector(this.bladeForward, 0.8));
    setLine(this.debugSweep, this.previousTip, this.currentTip);
    setLine(this.debugEdge, this.edgeStart, this.edgeEnd);
    const cameraPosition = this.camera.getWorldPosition(new THREE.Vector3());
    setLine(this.debugCameraRay, cameraPosition, cameraPosition.clone().addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()), 3));
    const entryPose = this.entry ? this.getEntryWorldPose() : null;
    this.debugPenetration.visible = Boolean(entryPose);
    if (entryPose) setLine(this.debugPenetration, entryPose.point, entryPose.point.clone().addScaledVector(entryPose.axis, this.penetrationDepth));
    const workspace = this.config.workspace;
    const centerLocal = new THREE.Vector3((workspace.min[0] + workspace.max[0]) * 0.5, (workspace.min[1] + workspace.max[1]) * 0.5, (workspace.min[2] + workspace.max[2]) * 0.5);
    this.debugWorkspace.position.copy(centerLocal);
    this.camera.localToWorld(this.debugWorkspace.position);
    this.camera.getWorldQuaternion(this.debugWorkspace.quaternion);
  }

  projectGrip() {
    if (!this.camera || !this.viewport) return null;
    const projected = new THREE.Vector3(0, 0, this.config.handleLength * 0.55).applyQuaternion(this.actualQuaternion).add(this.actualGrip).project(this.camera);
    const rect = this.viewport.getBoundingClientRect();
    const radius = Math.max(this.config.gripZone.minimumRadiusPx, Math.min(this.config.gripZone.maximumRadiusPx, Math.min(rect.width, rect.height) * this.config.gripZone.viewportRatio));
    return { x: rect.left + (projected.x * 0.5 + 0.5) * rect.width, y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height, radius, toolId: this.config.itemId, kind: 'grip-input-capture' };
  }

  getActiveToolId() { return this.isEquipped() ? this.config.itemId : null; }
  getWeaponPresentationDiagnostics() { return this.presentation.getDiagnostics({ equippedItemId: this.isEquipped() ? this.config.itemId : null }); }

  getProjectedGrabPoint(viewport = this.viewport) { return this.getProjectedGripZone(viewport); }

  getProjectedGripZone(viewport = this.viewport) {
    if (viewport !== this.viewport) this.viewport = viewport;
    return this.isEquipped() ? this.projectGrip() : null;
  }

  projectGrabHit(clientX, clientY, viewport = this.viewport) {
    const grip = this.getProjectedGripZone(viewport);
    return Boolean(grip && Math.hypot(clientX - grip.x, clientY - grip.y) <= grip.radius);
  }

  getProjectedActivePoint(viewport = this.viewport, gesture = null) {
    if (!this.camera || !viewport || !this.isEquipped()) return null;
    const dx = gesture?.active ? gesture.deltaX ?? 0 : this.aimX / this.config.workspace.lateralSensitivity;
    const dy = gesture?.active ? gesture.deltaY ?? 0 : -this.desiredExtension / this.config.workspace.thrustSensitivity;
    const aimX = THREE.MathUtils.clamp(dx * this.config.workspace.lateralSensitivity, -1, 1);
    const aimY = THREE.MathUtils.clamp(-dy * this.config.workspace.verticalSensitivity, -1, 1);
    const extension = THREE.MathUtils.clamp(-dy * this.config.workspace.thrustSensitivity, 0, this.config.workspace.thrustDistance);
    const localGrip = new THREE.Vector3(
      this.config.workspace.ready[0] + aimX * this.config.workspace.lateralReach,
      this.config.workspace.ready[1] + aimY * this.config.workspace.verticalReach,
      this.config.workspace.ready[2] - extension,
    );
    clampWorkspacePoint(localGrip, this.config.workspace);
    const quaternion = this.camera.getWorldQuaternion(new THREE.Quaternion());
    quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(aimY * 0.34, -aimX * 0.34, -aimX * 0.12, 'YXZ'))).normalize();
    this.camera.localToWorld(localGrip);
    const projected = deriveBladeTip(localGrip, quaternion, this.config.bladeLength, new THREE.Vector3()).project(this.camera);
    const rect = viewport.getBoundingClientRect();
    return { x: rect.left + (projected.x * 0.5 + 0.5) * rect.width, y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height, depth: projected.z, toolId: this.config.itemId, kind: 'knife-blade' };
  }

  getProjectedBounds() {
    if (!this.camera || !this.visual) return null;
    this.camera.updateMatrixWorld(true);
    this.visual.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.visual);
    if (box.isEmpty()) return null;
    const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minDepth: Infinity, maxDepth: -Infinity };
    const corner = new THREE.Vector3();
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      corner.set(x, y, z).project(this.camera);
      bounds.minX = Math.min(bounds.minX, corner.x); bounds.maxX = Math.max(bounds.maxX, corner.x);
      bounds.minY = Math.min(bounds.minY, corner.y); bounds.maxY = Math.max(bounds.maxY, corner.y);
      bounds.minDepth = Math.min(bounds.minDepth, corner.z); bounds.maxDepth = Math.max(bounds.maxDepth, corner.z);
    }
    return bounds;
  }

  setGestureState(gesture = {}) {
    if (gesture.active && gesture.toolId === this.config.itemId) {
      if (this.gripPointerId == null) this.acquireGrip(gesture.pointerId, gesture.startX, gesture.startY, gesture.samples?.[0]?.timeMs ?? performance.now());
      this.applyGripGesture(gesture.pointerId, gesture.deltaX ?? 0, gesture.deltaY ?? 0, gesture.x ?? gesture.startX, gesture.y ?? gesture.startY, gesture.samples?.at?.(-1)?.timeMs ?? performance.now());
    } else if (this.gripPointerId != null) this.releaseGrip('external-gesture-release');
  }

  impact({ strength = 1 } = {}) {
    if (strength < 0.5) this.failedContact = true;
  }

  setDebugVisible(visible) {
    this.debugRoot.visible = visible;
  }

  nudgeExtension(delta) {
    if (this.gripPointerId == null) this.acquireGrip('keyboard-debug', 0, 0);
    this.desiredExtension = THREE.MathUtils.clamp(this.desiredExtension + delta, 0, this.config.workspace.thrustDistance);
    this.deliberateInputVelocity.set(0, 0, -Math.sign(delta) * 0.8);
    this.state = KNIFE_CONTROL_STATES.attacking;
  }

  nudgeAim(deltaX = 0, deltaY = 0) {
    if (this.gripPointerId == null) this.acquireGrip('keyboard-debug', 0, 0);
    this.aimX = THREE.MathUtils.clamp(this.aimX + deltaX, -1, 1);
    this.aimY = THREE.MathUtils.clamp(this.aimY + deltaY, -1, 1);
    this.deliberateInputVelocity.set(deltaX * 1.8, deltaY * 1.8, 0);
    this.state = KNIFE_CONTROL_STATES.attacking;
  }

  cancel(reason = 'cancelled') {
    const wasEmbedded = Boolean(this.entry);
    this.presentationContinuityActive = false;
    this.presentation.endExtractionContinuity();
    if (this.entry) {
      if (this.entry.directorInteractionId) {
        this.entry.director.beginWithdrawal(this.entry.directorInteractionId, { releaseSeverity: 0, direction: null, position: this.currentTip });
        this.entry.director.completeWithdrawal(this.entry.directorInteractionId, { releaseSeverity: 0, direction: null, position: this.currentTip });
      }
      this.entry.actor?.setEmbeddedWeapon?.(null);
    }
    this.finishActiveSlash(true);
    this.entry = null;
    this.penetrationDepth = 0;
    this.syncVisualDepthMode();
    this.desiredExtension = 0;
    this.aimX = 0;
    this.aimY = 0;
    this.state = KNIFE_CONTROL_STATES.ready;
    this.contactState = 'no_contact';
    this.reason = reason;
    this.gestureOwnership.release();
    this.attackEnabled = false;
    this.deliberateInputVelocity.set(0, 0, 0);
    this.offensiveVelocity.set(0, 0, 0);
    this.intentWeapon.reset();
    this.intentState = this.intentWeapon.current;
    this.penetrationAudioGate.reset();
    if (wasEmbedded) this.beginFreePresentationContinuity();
  }

  cancelTarget(actor, reason = 'target-disposed') {
    if (this.entry?.actor === actor || this.activeSlash?.actor === actor) {
      this.cancel(reason);
      return true;
    }
    return false;
  }

  reset() {
    this.cancel('reset');
    this.aimX = 0;
    this.aimY = 0;
    this.microElapsed = 0;
    this.microCompression = 0;
    this.microRecoil = 0;
    this.microRoll = 0;
    this.microTwist = 0;
    this.microActive = false;
    this.presentationReady = true;
    this.microLocalOffset.set(0, 0, 0);
    this.microWorldOffset.set(0, 0, 0);
    this.microQuaternion.identity();
    this.maximumPresentationOffset = 0;
    this.initializePose();
  }

  getDiagnostics() {
    const round = (v) => [v.x, v.y, v.z].map((value) => Number(value.toFixed(3)));
    const euler = new THREE.Euler().setFromQuaternion(this.actualQuaternion, 'YXZ');
    const worldLightIntersectionStatus = getWeaponWorldLightIntersectionStatus(this.visual, this.scene);
    return {
      itemId: this.config.itemId,
      runtimeCombatMode: KNIFE_RUNTIME_COMBAT_MODE,
      suppressedSlashAttempts: this.suppressedSlashAttempts,
      equipped: this.isEquipped(),
      state: this.state,
      contactState: this.contactState,
      reason: this.reason,
      contactDamageReason: this.contactDamageReason,
      worldPosition: round(this.actualGrip),
      worldRotation: [euler.x, euler.y, euler.z].map((value) => Number(value.toFixed(3))),
      desiredHand: round(this.desiredGrip),
      actualHand: round(this.actualGrip),
      tip: round(this.currentTip),
      bladeForward: round(this.bladeForward),
      penetrationDepth: Number(this.penetrationDepth.toFixed(3)),
      maximumDepthReached: Number(this.maximumDepthReached.toFixed(3)),
      totalWorldVelocity: round(this.totalWorldVelocity),
      deliberateInputVelocity: round(this.deliberateInputVelocity),
      offensiveVelocity: round(this.offensiveVelocity),
      forwardVelocity: Number(this.offensiveVelocity.length().toFixed(3)),
      attackEnabled: this.attackEnabled,
      intent: this.intentState.intent,
      intentReason: this.intentState.reason,
      weaponLayers: { visual: 'responsive-hand-pose', collision: 'resistance-capable-world-pose', intent: 'owned-gesture-classifier' },
      visibleCollisionError: Number(this.visibleCollisionError.toFixed(5)),
      maximumPresentationOffset: Number(this.maximumPresentationOffset.toFixed(5)),
      presentationReady: this.presentationReady,
      visualDepthMode: this.visualDepthMode,
      visualLayerMode: this.visualDepthMode,
      currentRenderLayer: getWeaponRenderLayer(this.visual),
      worldLightIntersectionStatus,
      outdoorMaterialRegistrationStatus: this.outdoorMaterialRegistration.status,
      currentOutdoorEmissiveScale: this.outdoorLightingDirector?.currentOrdinaryEmissiveScale ?? this.outdoorMaterialRegistration.ordinaryEmissiveScale ?? null,
      transitionLightingDiscontinuityCount: this.transitionLightingDiscontinuityCount,
      transitionLightingDiscontinuityCounter: this.transitionLightingDiscontinuityCount,
      visualAssetState: this.visualAssetState,
      microImpact: { kind: this.microResponse.kind, active: this.microActive, compression: Number(this.microCompression.toFixed(5)), recoil: Number(this.microRecoil.toFixed(5)), rollDegrees: Number(THREE.MathUtils.radToDeg(this.microRoll).toFixed(2)), twistDegrees: Number(THREE.MathUtils.radToDeg(this.microTwist).toFixed(2)) },
      tissueResistance: { phase: this.tissueResistanceSample.phase, effective: Number((this.tissueResistanceSample.effectiveResistance ?? 0).toFixed(3)), drag: Number((this.tissueResistanceSample.drag ?? 0).toFixed(3)), boneProximity: Number((this.tissueResistanceSample.boneProgress ?? 0).toFixed(3)) },
      gripPointerActive: this.gripPointerId != null,
      gripPointerOwner: this.gripPointerId,
      visualRootName: this.visual.name,
      visualRootId: this.visual.id,
      visualScale: round(this.visual.scale),
      bladeLength: this.config.bladeLength,
      handleLength: this.config.handleLength,
      overallLength: this.config.overallLength,
      contactPart: this.lastContactPart,
      activeWoundId: this.entry?.woundId ?? this.activeSlash?.woundId ?? null,
      activeCombatInteractionId: this.entry?.directorInteractionId ?? this.activeSlash?.directorInteractionId ?? null,
      activeCombatActorId: this.entry?.actor?.instanceId ?? this.activeSlash?.actor?.instanceId ?? null,
      activeSlash: this.activeSlash ? { regionId: this.activeSlash.regionId, part: this.activeSlash.part, duration: Number(this.activeSlash.duration.toFixed(3)), travel: Number(this.activeSlash.travel.toFixed(3)), pendingTravel: Number(this.activeSlash.pendingTravel.toFixed(3)), extensionCommitCount: this.activeSlash.extensionCommitCount, edgeAnchorT: Number(this.activeSlash.edgeAnchorT.toFixed(3)), edgeSampleCount: this.lastEdgeSampleCount, woundId: this.activeSlash.woundId } : null,
      slashCount: this.slashCount,
      penetrationAudio: this.penetrationAudioGate.getDiagnostics(),
      weaponPresentation: this.getWeaponPresentationDiagnostics(),
    };
  }

  dispose() {
    this.disposed = true;
    this.cancel('disposed');
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    disposeOwnedWeaponVisual({ root: this.visual, geometries: this.visualGeometries, materials: this.materials });
    this.visualGeometries = [];
    this.materials = [];
    this.debugRoot.traverse((object) => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
    this.debugRoot.removeFromParent();
    if (this.ownsCombatDirector) this.combatDirector.dispose();
  }
}
