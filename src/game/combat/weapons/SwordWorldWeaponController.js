import * as THREE from 'three';
import { CombatDirector } from '../CombatDirector.js';
import { clampWorkspacePoint, deriveBladeTip } from '../CombatMath.js';
import { isDamageIntent, MeleeIntentWeapon } from '../MeleeIntentWeapon.js';
import { createWeaponContactScratch, getRigidBodyWorldPosition } from './WeaponContactScratch.js';
import { WeaponContactRouter } from './WeaponContactRouter.js';
import { bindWeaponPointerEvents, DEFAULT_WEAPON_POINTER_BLOCK_SELECTOR, WeaponGestureOwnership } from './WeaponGestureOwnership.js';
import { computeCameraRelativeWeaponPose, createWeaponPoseWorkspace, initializeCameraRelativeWeaponPose, rebaseWorldWeaponPoseToCamera } from './WeaponPoseWorkspace.js';
import { createCuttingEdgePath, createSweptCuttingEdgeScratch, resolveCuttingEdgeSampleCount, sweepCuttingEdge } from './SweptCuttingEdge.js';
import { applyWeaponRenderLayer, cloneOwnedWeaponVisual, createCachedWeaponGlbLoader, disposeOwnedWeaponVisual } from './WeaponVisualAsset.js';

export const DREADSTONE_SWORD_GLB_PATH = './assets/weapons/melee/dreadstone_sword_v002.glb';
export const SWORD_VIEWMODEL_LAYER = 1;
export const SWORD_EDGE_BASE_SAMPLE_COUNT = 5;
export const SWORD_EDGE_MAX_SAMPLE_COUNT = 17;
export const SWORD_EDGE_COLLISION_RADIUS = 0.012;

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
const localForward = new THREE.Vector3(0, 0, -1);
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
  constructor({ app, scene, camera, player, actor, physics, equipmentRuntime, controls, feedback = null, feedbackSystem = null, combatDirector = null, combatRouter = null, contactActivationProvider = null, visualAssetLoader = loadDreadstoneSwordAsset, bindPointerInput = true } = {}) {
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
    this.visualAssetLoader = visualAssetLoader;
    this.config = SWORD_WORLD_WEAPON_CONFIG;
    this.weaponDefinition = Object.freeze({
      id: this.config.itemId,
      family: 'sword',
      bladeLength: DREADSTONE_SWORD_DIMENSIONS.bladeLength,
      bladeWidth: DREADSTONE_SWORD_DIMENSIONS.bladeWidth,
      bladeThickness: DREADSTONE_SWORD_DIMENSIONS.bladeThickness,
      maximumPenetrationDepth: DREADSTONE_SWORD_DIMENSIONS.bladeLength,
      authoredDimensions: DREADSTONE_SWORD_DIMENSIONS,
    });
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
    this.offensiveVelocity = new THREE.Vector3();
    this.totalWorldVelocity = new THREE.Vector3();
    this.aimX = 0;
    this.aimY = 0;
    this.desiredExtension = 0;
    this.returnElapsed = 0;
    this.returnDuration = 0.18;
    this.returnStartAim = new THREE.Vector2();
    this.returnStartExtension = 0;
    this.state = 'ready';
    this.contactState = 'no_contact';
    this.contactDamageReason = 'non-damaging:no-pointer-owner';
    this.attackEnabled = false;
    this.lastFrameVelocity = 0;
    this.lastContactPart = 'none';
    this.lastEdgeSampleCount = 0;
    this.lastPhysicsDt = 1 / 60;
    this.elapsed = 0;
    this.contactCooldownUntil = 0;
    this.resistanceKick = 0;
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
      this.applyVisualLayer();
      return this.visualAssetState;
    }).catch(() => {
      if (this.disposed) return 'disposed';
      this.buildFallbackVisual();
      this.visualAssetState = 'fallback';
      this.applyVisualLayer();
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
  }

  applyVisualLayer() {
    applyWeaponRenderLayer(this.visual, { layer: SWORD_VIEWMODEL_LAYER, renderOrder: SWORD_RENDER_ORDER, itemId: this.config.itemId, viewmodel: true });
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
    if (!this.isEquipped() || !this.gestureOwnership.acquire(pointerId, clientX, clientY, timeMs)) return false;
    this.state = 'gripped';
    return true;
  }

  applyGripGesture(pointerId, deltaX, deltaY, clientX, clientY, timeMs = performance.now()) {
    const sample = this.gestureOwnership.update(pointerId, deltaX, deltaY, clientX, clientY, timeMs, this.desiredExtension);
    if (!sample) return false;
    this.aimX = sample.aimX;
    this.aimY = sample.aimY;
    this.desiredExtension = sample.extension;
    this.state = sample.intentionalTravel >= 4 ? 'attacking' : 'gripped';
    return true;
  }

  releaseGrip(reason = 'pointer-release') {
    if (this.gripPointerId == null && this.state === 'ready') return;
    this.gestureOwnership.release();
    this.finishActiveEdgeDamage(reason !== 'pointer-release');
    this.attackEnabled = false;
    this.returnElapsed = 0;
    this.returnStartAim.set(this.aimX, this.aimY);
    this.returnStartExtension = this.desiredExtension;
    this.state = 'returning';
  }

  updateInput(dt) {
    this.gestureOwnership.decayDeliberateVelocity(dt);
    if (this.state !== 'returning') return;
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
      this.state = 'ready';
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
      if (this.gripPointerId != null || this.state !== 'ready') this.cancel('weapon-unequipped');
      return;
    }
    rebaseWorldWeaponPoseToCamera(this.poseRebaseRequest);
    this.updateInput(dt);
    this.computeDesiredPose();
    this.previousGrip.copy(this.actualGrip);
    this.previousQuaternion.copy(this.actualQuaternion);
    this.previousTip.copy(this.currentTip);
    // Free-space tracking is direct; resistance is applied only after a real contact.
    this.actualGrip.copy(this.desiredGrip);
    this.actualQuaternion.copy(this.desiredQuaternion);
    this.updateDerivedPose();
    this.updatePrimitiveEndpoints();
    this.totalWorldVelocity.subVectors(this.currentTip, this.previousTip).divideScalar(Math.max(dt, 1e-5));
    const cameraQuaternion = this.camera.getWorldQuaternion(this.contactScratch.inverseQuaternion);
    this.offensiveVelocity.copy(this.deliberateInputVelocity).applyQuaternion(cameraQuaternion);
    const deliberateSpeed = this.offensiveVelocity.length();
    this.lastFrameVelocity = deliberateSpeed;
    this.intentState = this.intentWeapon.interpret({ ownerId: this.gripPointerId, controlState: this.state, localVelocity: this.deliberateInputVelocity, embedded: false });
    const contactActive = this.contactActivationProvider?.() ?? true;
    this.attackEnabled = contactActive && ['attacking', 'contact'].includes(this.state) && deliberateSpeed >= this.config.minimumAttackSpeed && isDamageIntent(this.intentState);
    if (!this.attackEnabled || !this.physics) {
      this.contactDamageReason = this.gripPointerId == null ? 'non-damaging:no-pointer-owner' : !contactActive ? 'non-damaging:outside-combat-contact-range' : 'non-damaging:no-deliberate-input-energy';
      this.finishActiveEdgeDamage(true);
      return;
    }
    this.contactDamageReason = 'damaging:grip-owned-deliberate-motion';
    const direction = this.contactScratch.direction.copy(this.offensiveVelocity).normalize();
    const localMotion = this.contactScratch.localMotion.copy(direction).applyQuaternion(this.contactScratch.inverseQuaternion.copy(this.actualQuaternion).invert());
    const leadingPart = resolveSwordLeadingPart(localMotion);
    const positionsPrepared = this.physics.prepareWeaponSweepBatch?.() === true;
    let resolved = false;
    if (leadingPart === 'tip') resolved = this.resolveTipContact(direction, localMotion, positionsPrepared);
    if (!resolved && leadingPart === 'edge') resolved = this.resolveEdgeContact(direction, localMotion, positionsPrepared);
    if (!resolved && (leadingPart === 'flat' || leadingPart === 'spine')) resolved = this.resolvePrimitiveContact([leadingPart], direction, localMotion, positionsPrepared);
    if (!resolved) resolved = this.resolvePrimitiveContact(['guard', 'grip'], direction, localMotion, positionsPrepared);
    if (!resolved) this.finishActiveEdgeDamage(false);
  }

  resolveTipContact(direction, localMotion, positionsPrepared) {
    if (this.previousTip.distanceToSquared(this.currentTip) < 1e-8) return false;
    const raw = this.physics.castWeaponTip(this.previousTip, this.currentTip, SWORD_CONTACT_PRIMITIVES.tip.radius, this.colliderFilter, positionsPrepared);
    if (!raw?.collider) return false;
    const toi = THREE.MathUtils.clamp(raw.time_of_impact ?? 0, 0, 1);
    const point = this.contactScratch.point.copy(this.previousTip).lerp(this.currentTip, toi);
    return this.resolveContact(raw, point, this.contactScratch.edgeMotion.subVectors(this.currentTip, this.previousTip), 'tip', direction, localMotion);
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
    this.state = 'contact';
    this.contactState = classification.classification;
    this.lastContactPart = part;
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
      const interaction = routed.director.beginEdgeDamage({ weapon: this.weaponDefinition, intent: this.intentState, hit: routed.hit, point, localPoint: routed.hit.localPoint, surfaceNormal: normal, direction, travel, depth, severity, edgeAlignment, swingSpeed, classification, part, weaponAdapter: this });
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
    this.visual.position.copy(this.actualGrip).add(this.contactScratch.correction.set(0, 0, this.resistanceKick).applyQuaternion(this.actualQuaternion));
    this.visual.quaternion.copy(this.actualQuaternion);
  }

  afterPhysicsStep(dt = 0) {
    if (this.ownsCombatDirector) this.combatDirector.update(dt);
  }

  onCombatResistance(payload = {}) {
    this.resistanceKick = Math.max(this.resistanceKick, Math.min(0.018, (payload.intensity ?? 0) * 0.012));
  }

  onCombatRecovery() {
    if (this.state === 'contact' && this.gripPointerId != null) this.state = 'attacking';
  }

  cancelTarget(actor, reason = 'target-cancelled') {
    if (this.activeEdgeDamage?.actor !== actor) return false;
    this.finishActiveEdgeDamage(true);
    this.contactState = reason;
    return true;
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
    this.state = 'attacking';
  }

  nudgeAim(deltaX = 0, deltaY = 0) {
    if (this.gripPointerId == null) this.acquireGrip('keyboard-debug', 0, 0);
    this.aimX = THREE.MathUtils.clamp(this.aimX + deltaX, -1, 1);
    this.aimY = THREE.MathUtils.clamp(this.aimY + deltaY, -1, 1);
    this.deliberateInputVelocity.set(deltaX * 2, deltaY * 2, 0);
    this.state = 'attacking';
  }

  cancel(reason = 'cancelled') {
    this.gestureOwnership.release();
    this.finishActiveEdgeDamage(true);
    this.aimX = 0;
    this.aimY = 0;
    this.desiredExtension = 0;
    this.attackEnabled = false;
    this.state = 'ready';
    this.contactState = reason;
  }

  reset() {
    this.cancel('reset');
    this.intentWeapon.reset();
    this.initializePose();
  }

  getDiagnostics() {
    return { itemId: this.config.itemId, equipped: this.isEquipped(), state: this.state, contactState: this.contactState, contactDamageReason: this.contactDamageReason, attackEnabled: this.attackEnabled, inputOwner: this.gripPointerId, lastContactPart: this.lastContactPart, lastEdgeSampleCount: this.lastEdgeSampleCount, edgeDamageCount: this.edgeDamageCount, activeEdgeDamage: this.activeEdgeDamage?.interactionId ?? null, visualAssetState: this.visualAssetState, assetPath: DREADSTONE_SWORD_GLB_PATH, dimensions: DREADSTONE_SWORD_DIMENSIONS };
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
