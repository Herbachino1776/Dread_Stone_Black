import * as THREE from 'three';
import { RAPIER } from './CombatPhysicsWorld.js';
import { ForgeDamageDeformationRuntime } from './ForgeDamageDeformationRuntime.js';

export const DAMAGE_MANIFEST_SCHEMA = 'dreadstone.damage_authoring.v1';

export const ACTIVE_DAMAGE_SEGMENT_CONTRACTS = Object.freeze({
  head_neck: Object.freeze({
    segmentId: 'head_neck',
    detachedBodyIds: Object.freeze(['head']),
  }),
  left_elbow: Object.freeze({
    segmentId: 'left_elbow',
    detachedBodyIds: Object.freeze(['left_forearm', 'left_hand']),
  }),
  right_elbow: Object.freeze({
    segmentId: 'right_elbow',
    detachedBodyIds: Object.freeze(['right_forearm', 'right_hand']),
  }),
});

const DETACHED_COLLISION_GROUPS = 0x00020001;
const MAXIMUM_DETACHED_LINEAR_SPEED = 8;
const MAXIMUM_DETACHED_ANGULAR_SPEED = 14;
const MAXIMUM_DIAGNOSTIC_COUNT = 1_000_000;
const tmpPoint = new THREE.Vector3();

function basename(path = '') {
  return path.split('/').pop()?.split(/[?#]/, 1)[0] ?? path;
}

function finiteVector(value, fallback = new THREE.Vector3()) {
  if (value?.isVector3 && value.toArray().every(Number.isFinite)) return value.clone();
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite)) return new THREE.Vector3().fromArray(value);
  if (value && [value.x, value.y, value.z].every(Number.isFinite)) return new THREE.Vector3(value.x, value.y, value.z);
  return fallback.clone();
}

function collectNamedObjects(root) {
  const objects = new Map();
  const duplicates = new Set();
  root?.traverse?.((object) => {
    if (!object.name) return;
    if (objects.has(object.name)) duplicates.add(object.name);
    else objects.set(object.name, object);
  });
  return { objects, duplicates };
}

function sameNames(actual, expected) {
  if (actual.length !== expected.length) return false;
  const left = [...actual].sort();
  const right = [...expected].sort();
  return left.every((name, index) => name === right[index]);
}

function incrementBounded(value) {
  return Math.min(MAXIMUM_DIAGNOSTIC_COUNT, value + 1);
}

export function validateDamageAsset({ manifest, root, profile, clips = [], animationManifest = null } = {}) {
  const errors = [];
  const { objects, duplicates } = collectNamedObjects(root);
  if (!manifest || manifest.schema !== DAMAGE_MANIFEST_SCHEMA) errors.push(`invalid damage manifest schema ${manifest?.schema ?? 'missing'}`);
  if (manifest?.authoringVersion !== profile?.damageAuthoringVersion) errors.push(`authoring version ${manifest?.authoringVersion ?? 'missing'} does not match ${profile?.damageAuthoringVersion ?? 'profile'}`);
  if (manifest?.authoringBuildId !== profile?.damageAuthoringBuildId) errors.push(`authoring build ${manifest?.authoringBuildId ?? 'missing'} does not match ${profile?.damageAuthoringBuildId ?? 'profile'}`);
  if (String(manifest?.glb ?? '').toLowerCase() !== basename(profile?.assetPath).toLowerCase()) errors.push(`damage manifest targets ${manifest?.glb ?? 'missing'}, expected ${basename(profile?.assetPath)}`);
  if (manifest?.source?.topologyFingerprint !== profile?.damageTopologyFingerprint) errors.push('source topology fingerprint mismatch');
  if (manifest?.source?.weightFingerprint !== profile?.damageWeightFingerprint) errors.push('source weight fingerprint mismatch');

  const segmentRecords = new Map();
  const requiredNames = new Set([
    manifest?.intact?.bodyCore,
    ...(manifest?.intact?.attachedSegments ?? []),
    ...(manifest?.sockets ?? []).map((socket) => socket?.object),
  ].filter(Boolean));
  if (!Array.isArray(manifest?.segments)) errors.push('damage segments are missing');
  for (const segment of manifest?.segments ?? []) {
    const segmentId = segment?.segmentId;
    if (!segmentId || segmentRecords.has(segmentId)) {
      errors.push(`invalid or duplicate damage segment ${segmentId ?? 'missing'}`);
      continue;
    }
    for (const key of ['attachedObject', 'detachedObject', 'proximalSegmentObject', 'proximalStump', 'distalStump', 'bone']) {
      if (segment[key]) requiredNames.add(segment[key]);
    }
    const attachedObject = segment.attachedObject ? objects.get(segment.attachedObject) : null;
    const detachedObject = segment.detachedObject ? objects.get(segment.detachedObject) : null;
    const proximalSegmentObject = segment.proximalSegmentObject ? objects.get(segment.proximalSegmentObject) : null;
    const proximalStump = segment.proximalStump ? objects.get(segment.proximalStump) : null;
    const distalStump = segment.distalStump ? objects.get(segment.distalStump) : null;
    if (!detachedObject?.isMesh || detachedObject.isSkinnedMesh) errors.push(`${segmentId} detached object ${segment.detachedObject ?? 'missing'} must be a rigid mesh`);
    if (segment.attachedObject && !attachedObject?.isSkinnedMesh) errors.push(`${segmentId} attached object ${segment.attachedObject} must be skinned`);
    if (!segment.attachedObject && !proximalSegmentObject?.isMesh) errors.push(`${segmentId} requires an attached object or proximal rigid segment`);
    if (proximalSegmentObject?.isSkinnedMesh) errors.push(`${segmentId} proximal segment ${segment.proximalSegmentObject} must be rigid`);
    if (!proximalStump?.isMesh) errors.push(`${segmentId} proximal stump ${segment.proximalStump ?? 'missing'} must be a mesh`);
    if (!distalStump?.isMesh) errors.push(`${segmentId} distal stump ${segment.distalStump ?? 'missing'} must be a mesh`);
    if (distalStump?.parent !== detachedObject) errors.push(`${segmentId} distal stump must be parented to its manifest detached object`);
    if (!objects.get(segment.bone)?.isBone) errors.push(`${segmentId} bone ${segment.bone ?? 'missing'} is missing`);
    segmentRecords.set(segmentId, segment);
  }
  for (const segmentId of profile?.activeDamageSegmentIds ?? []) {
    if (!segmentRecords.has(segmentId)) errors.push(`active damage segment ${segmentId} is missing from the manifest`);
    if (!ACTIVE_DAMAGE_SEGMENT_CONTRACTS[segmentId]) errors.push(`active damage segment ${segmentId} has no gameplay body binding`);
  }
  const missingObjects = [...requiredNames].filter((name) => !objects.has(name));
  const duplicateRequiredObjects = [...requiredNames].filter((name) => duplicates.has(name));
  if (missingObjects.length) errors.push(`missing manifest objects: ${missingObjects.join(', ')}`);
  if (duplicateRequiredObjects.length) errors.push(`duplicate manifest objects: ${duplicateRequiredObjects.join(', ')}`);

  const expectedAnimations = [...(profile?.damageExpectedAnimationNames ?? [])];
  const runtimeKinds = new Set(profile?.animationRuntimeKinds ?? []);
  const manifestAnimationNames = (animationManifest?.animations ?? [])
    .filter((entry) => runtimeKinds.size === 0 || runtimeKinds.has(entry?.approved_kind))
    .map((entry) => entry?.name)
    .filter(Boolean);
  const clipNames = clips.filter((clip) => clip?.tracks?.length > 0).map((clip) => clip.name);
  if (!sameNames(manifestAnimationNames, expectedAnimations)) errors.push('damage animation manifest does not contain the exact approved animation names');
  const missingAnimations = expectedAnimations.filter((name) => !clipNames.includes(name));
  if (missingAnimations.length) errors.push(`damage GLB is missing approved animations: ${missingAnimations.join(', ')}`);

  if (errors.length) throw new Error(`Humanoid damage profile ${profile?.name ?? 'unknown'} failed validation: ${errors.join('; ')}`);
  return {
    objects,
    segments: segmentRecords,
    headSegment: segmentRecords.get('head_neck') ?? null,
    diagnostics: {
      enabled: true,
      manifestSchema: manifest.schema,
      authoringVersion: manifest.authoringVersion,
      authoringBuildId: manifest.authoringBuildId,
      assetPath: profile.assetPath,
      requiredObjectsResolved: true,
      missingObjects: [],
      intactStateValid: false,
    },
  };
}

function configureDamageObject(object) {
  object?.traverse?.((child) => {
    if (!child.isMesh) return;
    const isSurfaceStain = child.userData?.dsb_stain_owned === true
      || child.userData?.dsb_generated_role === 'surface_stain_export';
    child.castShadow = !isSurfaceStain;
    child.receiveShadow = true;
    if (isSurfaceStain) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      material.opacity = 1;
      material.transparent = false;
      material.needsUpdate = true;
    });
  });
}

function getObjectWorldBounds(object, target = new THREE.Box3()) {
  target.makeEmpty();
  if (!object?.geometry?.attributes?.position) return target;
  object.updateMatrixWorld(true);
  object.skeleton?.update?.();
  const position = object.geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    if (object.isSkinnedMesh) object.getVertexPosition(index, tmpPoint);
    else tmpPoint.fromBufferAttribute(position, index);
    object.localToWorld(tmpPoint);
    target.expandByPoint(tmpPoint);
  }
  return target;
}

function rotationErrorDegrees(first, second) {
  const dot = THREE.MathUtils.clamp(Math.abs(first.dot(second)), -1, 1);
  return THREE.MathUtils.radToDeg(2 * Math.acos(dot));
}

function clampVectorLength(vector, maximum) {
  if (!vector.toArray().every(Number.isFinite)) return vector.set(0, 0, 0);
  if (vector.length() > maximum) vector.setLength(maximum);
  return vector;
}

export class HumanoidDamageSegmentRuntime {
  constructor({ actor, adapter, loadedGlbRoot, damageManifest, physicsWorld, hostScene } = {}) {
    this.actor = actor;
    this.adapter = adapter;
    this.root = loadedGlbRoot;
    this.manifest = damageManifest;
    this.physics = physicsWorld;
    this.hostScene = hostScene;
    this.disposed = false;
    this.warnedColliderFallback = false;
    this.validation = validateDamageAsset({
      manifest: damageManifest,
      root: loadedGlbRoot,
      profile: adapter.profile,
      clips: adapter.loadedClips,
      animationManifest: adapter.animationManifest,
    });
    this.objects = this.validation.objects;
    this.segmentStates = new Map();
    for (const segmentId of adapter.profile.activeDamageSegmentIds ?? []) {
      const manifestSegment = this.validation.segments.get(segmentId);
      const contract = ACTIVE_DAMAGE_SEGMENT_CONTRACTS[segmentId];
      if (!manifestSegment || !contract) continue;
      const detachedObject = this.objects.get(manifestSegment.detachedObject);
      this.segmentStates.set(segmentId, {
        segmentId,
        manifest: manifestSegment,
        contract,
        bone: this.objects.get(manifestSegment.bone),
        attachedObject: this.objects.get(manifestSegment.attachedObject),
        detachedObject,
        proximalStump: this.objects.get(manifestSegment.proximalStump),
        distalStump: this.objects.get(manifestSegment.distalStump),
        detachedBodyIds: [...contract.detachedBodyIds],
        authoredParent: detachedObject.parent,
        authoredTransform: {
          position: detachedObject.position.clone(),
          quaternion: detachedObject.quaternion.clone(),
          scale: detachedObject.scale.clone(),
        },
        boneToDetached: new THREE.Matrix4(),
        lastBonePosition: new THREE.Vector3(),
        lastBoneQuaternion: new THREE.Quaternion(),
        proxyVelocity: new THREE.Vector3(),
        proxyAngularVelocity: new THREE.Vector3(),
        body: null,
        collider: null,
        colliderType: null,
        fallbackColliderUsed: false,
        spawnPositionError: null,
        spawnRotationErrorDegrees: null,
        inheritedLinearSpeed: 0,
        inheritedAngularSpeed: 0,
        bloodActivationCount: 0,
        consequenceActivationCount: 0,
      });
    }
    this.headSegment = this.validation.headSegment;
    this.headState = this.segmentStates.get('head_neck');
    this.headBone = this.headState.bone;
    this.attachedHead = this.headState.attachedObject;
    this.detachedHead = this.headState.detachedObject;
    this.torsoStump = this.headState.proximalStump;
    this.detachedHeadStump = this.headState.distalStump;
    this.authoredDetachedParent = this.headState.authoredParent;
    this.authoredDetachedTransform = this.headState.authoredTransform;
    this.headBoneToDetached = this.headState.boneToDetached;
    this.lastHeadPosition = this.headState.lastBonePosition;
    this.lastHeadQuaternion = this.headState.lastBoneQuaternion;
    this.headProxyVelocity = this.headState.proxyVelocity;
    this.headProxyAngularVelocity = this.headState.proxyAngularVelocity;
    this.detachedBody = null;
    this.detachedCollider = null;
    this.colliderTypeUsed = null;
    this.detachedSegments = new Set();
    this.resetDiagnostics();
    this.configureDamageObjects();
    this.deformationRuntime = new ForgeDamageDeformationRuntime({
      actor,
      adapter,
      segmentRuntime: this,
      root: loadedGlbRoot,
      manifest: damageManifest,
      progressiveDamageSiteFallbacks: adapter.profile.progressiveDamageSiteFallbacks,
      progressiveDamageHitsPerStage: adapter.profile.progressiveDamageHitsPerStage,
    });
    this.captureSegmentBindings();
    this.applyIntactState();
  }

  resetDiagnostics() {
    this.requestedCount = 0;
    this.acceptedCount = 0;
    this.rejectedDuplicateCount = 0;
    this.spawnPositionError = null;
    this.spawnRotationErrorDegrees = null;
    this.inheritedLinearSpeed = 0;
    this.inheritedAngularSpeed = 0;
    this.bloodActivationCount = 0;
    this.mortalityActivationCount = 0;
    this.nonfatalConsequenceCount = 0;
    this.lastCause = null;
    this.segmentStates.forEach((state) => {
      state.spawnPositionError = null;
      state.spawnRotationErrorDegrees = null;
      state.inheritedLinearSpeed = 0;
      state.inheritedAngularSpeed = 0;
      state.bloodActivationCount = 0;
      state.consequenceActivationCount = 0;
      state.fallbackColliderUsed = false;
    });
  }

  configureDamageObjects() {
    [...this.objects.values()].filter((object) => object.name?.startsWith('DSB_')).forEach(configureDamageObject);
  }

  captureSegmentBinding(state) {
    this.adapter.presentationRoot?.updateMatrixWorld?.(true);
    this.root.updateMatrixWorld(true);
    state.bone.updateMatrixWorld(true);
    state.detachedObject.updateMatrixWorld(true);
    state.boneToDetached.copy(state.bone.matrixWorld).invert().multiply(state.detachedObject.matrixWorld);
    state.bone.getWorldPosition(state.lastBonePosition);
    state.bone.getWorldQuaternion(state.lastBoneQuaternion);
  }

  captureSegmentBindings() {
    this.segmentStates.forEach((state) => this.captureSegmentBinding(state));
  }

  applyIntactState() {
    this.objects.forEach((object) => {
      if (
        object.userData?.dsb_default_visible === false
        || object.userData?.dsb_gore_default_visible === false
        || object.userData?.dsb_stain_default_visible === false
        || object.name?.startsWith('DSB_GORE_')
        || object.name?.startsWith('DSB_STAIN_')
      ) object.visible = false;
    });
    const intactNames = [this.manifest?.intact?.bodyCore, ...(this.manifest?.intact?.attachedSegments ?? [])].filter(Boolean);
    intactNames.forEach((name) => { this.objects.get(name).visible = true; });
    this.deformationRuntime?.reset?.();
    this.validation.diagnostics.intactStateValid = this.validateIntactState();
    return this.validation.diagnostics.intactStateValid;
  }

  validateIntactState() {
    const intactNames = [this.manifest?.intact?.bodyCore, ...(this.manifest?.intact?.attachedSegments ?? [])].filter(Boolean);
    const hiddenObjects = [...this.objects.values()].filter((object) => (
      object.userData?.dsb_default_visible === false
      || object.userData?.dsb_gore_default_visible === false
      || object.userData?.dsb_stain_default_visible === false
      || object.name?.startsWith('DSB_GORE_')
      || object.name?.startsWith('DSB_STAIN_')
    ));
    const deformation = this.deformationRuntime?.getDiagnostics?.();
    return intactNames.every((name) => this.objects.get(name)?.visible === true)
      && hiddenObjects.every((object) => object.visible === false)
      && (deformation?.visibleGoreNodes?.length ?? 0) === 0
      && (deformation?.visibleSurfaceStainNodes?.length ?? 0) === 0
      && Object.values(deformation?.morphWeights ?? {}).every((weights) => Math.abs(weights.attached ?? 0) <= 1e-6 && Math.abs(weights.detached ?? 0) <= 1e-6);
  }

  applyForgeMaceDamage(request = {}) {
    return this.deformationRuntime?.applyMaceHit?.(request) ?? { applied: false, reason: 'deformation-runtime-not-ready' };
  }

  activateForgeDamage(morphName, options = {}) {
    return this.deformationRuntime?.activate?.(morphName, options) ?? { applied: false, reason: 'deformation-runtime-not-ready', selectedMorph: morphName ?? null };
  }

  setProgressiveDamageStage(siteId, stageName, options = {}) {
    return this.deformationRuntime?.setProgressiveDamageStage?.(siteId, stageName, options) ?? { applied: false, reason: 'deformation-runtime-not-ready', siteId: siteId ?? null, stage: stageName ?? null };
  }

  advanceProgressiveDamageSite(siteId = null, options = {}) {
    return this.deformationRuntime?.advanceProgressiveDamageSite?.(siteId, options) ?? { applied: false, reason: 'deformation-runtime-not-ready', siteId };
  }

  resetForgeDamage() {
    return this.deformationRuntime?.reset?.() ?? null;
  }

  captureAnimatedMotion(deltaSeconds) {
    if (this.disposed || !(deltaSeconds > 0)) return;
    this.adapter.presentationRoot?.updateMatrixWorld?.(true);
    this.root.updateMatrixWorld(true);
    const livingVelocity = finiteVector(this.actor?.livingVelocity);
    this.segmentStates.forEach((state) => {
      if (this.detachedSegments.has(state.segmentId)) return;
      const currentPosition = state.bone.getWorldPosition(new THREE.Vector3());
      const currentQuaternion = state.bone.getWorldQuaternion(new THREE.Quaternion());
      state.proxyVelocity.copy(currentPosition).sub(state.lastBonePosition).multiplyScalar(1 / deltaSeconds).sub(livingVelocity);
      clampVectorLength(state.proxyVelocity, 3.5);
      const deltaRotation = currentQuaternion.clone().multiply(state.lastBoneQuaternion.clone().invert()).normalize();
      if (deltaRotation.w < 0) deltaRotation.set(-deltaRotation.x, -deltaRotation.y, -deltaRotation.z, -deltaRotation.w);
      const angle = 2 * Math.acos(THREE.MathUtils.clamp(deltaRotation.w, -1, 1));
      const sine = Math.sqrt(Math.max(0, 1 - deltaRotation.w * deltaRotation.w));
      if (angle > 1e-6 && sine > 1e-6) state.proxyAngularVelocity.set(deltaRotation.x / sine, deltaRotation.y / sine, deltaRotation.z / sine).multiplyScalar(angle / deltaSeconds);
      else state.proxyAngularVelocity.set(0, 0, 0);
      clampVectorLength(state.proxyAngularVelocity, 8);
      state.lastBonePosition.copy(currentPosition);
      state.lastBoneQuaternion.copy(currentQuaternion);
    });
  }

  getSegmentWorldPoint(segmentId = 'head_neck', target = new THREE.Vector3()) {
    const state = this.segmentStates.get(segmentId);
    if (!state) return null;
    this.adapter.prepareVisibleSurfaceFrame?.();
    const bounds = getObjectWorldBounds(state.proximalStump);
    return bounds.isEmpty() ? state.bone.getWorldPosition(target) : bounds.getCenter(target);
  }

  createColliderVertices(state, authoredWorldScale) {
    const position = state.detachedObject.geometry?.attributes?.position;
    if (!position || position.count < 4) return new Float32Array();
    const vertices = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      tmpPoint.fromBufferAttribute(position, index).multiply(authoredWorldScale);
      vertices[index * 3] = tmpPoint.x;
      vertices[index * 3 + 1] = tmpPoint.y;
      vertices[index * 3 + 2] = tmpPoint.z;
    }
    return vertices;
  }

  createDetachedPhysics(state, position, quaternion, scale) {
    const bodyDescriptor = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation(quaternion)
      .setLinearDamping(0.85)
      .setAngularDamping(1.15)
      .setCanSleep(true);
    const body = this.physics.world.createRigidBody(bodyDescriptor);
    body.userData = { actor: this.actor, type: 'detached-segment', segmentId: state.segmentId };
    const vertices = this.createColliderVertices(state, scale);
    let colliderDescriptor = state.manifest.colliderHint === 'convex_hull' ? RAPIER.ColliderDesc.convexHull(vertices) : null;
    let colliderType = 'convex_hull';
    let fallbackColliderUsed = false;
    if (!colliderDescriptor) {
      const bounds = new THREE.Box3().makeEmpty();
      for (let index = 0; index < vertices.length; index += 3) bounds.expandByPoint(tmpPoint.set(vertices[index], vertices[index + 1], vertices[index + 2]));
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      if (state.segmentId === 'head_neck') {
        const radius = THREE.MathUtils.clamp(Math.max(size.x, size.y, size.z) * 0.42, 0.08, 0.22);
        colliderDescriptor = RAPIER.ColliderDesc.ball(radius).setTranslation(center.x, center.y, center.z);
        colliderType = 'ball-fallback';
      } else {
        const half = size.multiplyScalar(0.5);
        colliderDescriptor = RAPIER.ColliderDesc.cuboid(
          THREE.MathUtils.clamp(half.x, 0.025, 0.3),
          THREE.MathUtils.clamp(half.y, 0.025, 0.3),
          THREE.MathUtils.clamp(half.z, 0.025, 0.3),
        ).setTranslation(center.x, center.y, center.z);
        colliderType = 'box-fallback';
      }
      fallbackColliderUsed = true;
      if (!this.warnedColliderFallback) {
        this.warnedColliderFallback = true;
        console.warn(`[HumanoidDamageSegmentRuntime] Convex hull generation failed for ${state.segmentId}; using bounded ${colliderType}.`);
      }
    }
    colliderDescriptor
      .setMass(state.manifest.detachedMassHint)
      .setFriction(0.78)
      .setRestitution(0.025)
      .setCollisionGroups(DETACHED_COLLISION_GROUPS);
    const collider = this.physics.world.createCollider(colliderDescriptor, body);
    collider.userData = body.userData;
    return { body, collider, colliderType, fallbackColliderUsed };
  }

  clampDetachedVelocities(state) {
    const linear = state.body.linvel();
    const angular = state.body.angvel();
    const safeLinear = clampVectorLength(new THREE.Vector3(linear.x, linear.y, linear.z), MAXIMUM_DETACHED_LINEAR_SPEED);
    const safeAngular = clampVectorLength(new THREE.Vector3(angular.x, angular.y, angular.z), MAXIMUM_DETACHED_ANGULAR_SPEED);
    state.body.setLinvel(safeLinear, true);
    state.body.setAngvel(safeAngular, true);
    state.inheritedLinearSpeed = safeLinear.length();
    state.inheritedAngularSpeed = safeAngular.length();
  }

  requestDetachment({ segmentId, cause = 'unspecified', worldPoint = null, impulse = null, angularImpulse = null } = {}) {
    this.requestedCount = incrementBounded(this.requestedCount);
    const state = this.segmentStates.get(segmentId);
    if (!(this.adapter.profile.activeDamageSegmentIds ?? []).includes(segmentId) || !state) {
      return { accepted: false, segmentId, reason: 'unsupported-segment', detachedBodyCreated: false, detachedColliderCreated: false, fatal: false, mortalityTriggered: false, reactionTriggered: false, bloodTriggered: false };
    }
    if (this.detachedSegments.has(segmentId)) {
      this.rejectedDuplicateCount = incrementBounded(this.rejectedDuplicateCount);
      return { accepted: false, segmentId, reason: 'already-detached', detachedBodyCreated: false, detachedColliderCreated: false, fatal: state.manifest.fatal === true, mortalityTriggered: false, reactionTriggered: false, bloodTriggered: false };
    }

    this.adapter.prepareVisibleSurfaceFrame?.();
    const expectedWorldMatrix = state.bone.matrixWorld.clone().multiply(state.boneToDetached);
    const expectedPosition = new THREE.Vector3();
    const expectedQuaternion = new THREE.Quaternion();
    const expectedScale = new THREE.Vector3();
    expectedWorldMatrix.decompose(expectedPosition, expectedQuaternion, expectedScale);
    if (![...expectedPosition.toArray(), ...expectedQuaternion.toArray(), ...expectedScale.toArray()].every(Number.isFinite)) {
      return { accepted: false, segmentId, reason: 'invalid-animated-transform', detachedBodyCreated: false, detachedColliderCreated: false, fatal: state.manifest.fatal === true, mortalityTriggered: false, reactionTriggered: false, bloodTriggered: false };
    }

    const physicsPiece = this.createDetachedPhysics(state, expectedPosition, expectedQuaternion, expectedScale);
    state.body = physicsPiece.body;
    state.collider = physicsPiece.collider;
    state.colliderType = physicsPiece.colliderType;
    state.fallbackColliderUsed = physicsPiece.fallbackColliderUsed;
    this.hostScene.attach(state.detachedObject);
    state.detachedObject.position.copy(expectedPosition);
    state.detachedObject.quaternion.copy(expectedQuaternion);
    state.detachedObject.scale.copy(expectedScale);
    state.detachedObject.updateMatrixWorld(true);

    state.attachedObject.visible = false;
    state.proximalStump.visible = true;
    state.detachedObject.visible = true;
    state.distalStump.visible = true;
    this.detachedSegments.add(segmentId);
    this.deformationRuntime?.handleSegmentDetached?.(segmentId);
    this.lastCause = cause;
    if (segmentId !== 'head_neck') this.actor?.disableDetachedSemanticBodies?.(state.detachedBodyIds);

    const semanticVelocity = this.actor?.getSemanticBodyVelocity?.(state.detachedBodyIds, new THREE.Vector3()) ?? new THREE.Vector3();
    const inheritedVelocity = finiteVector(this.actor?.livingVelocity).add(state.proxyVelocity).add(semanticVelocity);
    clampVectorLength(inheritedVelocity, MAXIMUM_DETACHED_LINEAR_SPEED);
    state.body.setLinvel(inheritedVelocity, true);
    state.body.setAngvel(clampVectorLength(state.proxyAngularVelocity.clone(), MAXIMUM_DETACHED_ANGULAR_SPEED), true);
    const requestedImpulse = finiteVector(impulse);
    const requestedAngularImpulse = finiteVector(angularImpulse);
    if (requestedImpulse.lengthSq() > 0) state.body.applyImpulse(requestedImpulse, true);
    if (requestedAngularImpulse.lengthSq() > 0) state.body.applyTorqueImpulse(requestedAngularImpulse, true);
    this.clampDetachedVelocities(state);
    this.physics.world.propagateModifiedBodyPositionsToColliders();

    const actualPosition = state.detachedObject.getWorldPosition(new THREE.Vector3());
    const actualQuaternion = state.detachedObject.getWorldQuaternion(new THREE.Quaternion());
    state.spawnPositionError = actualPosition.distanceTo(expectedPosition);
    state.spawnRotationErrorDegrees = rotationErrorDegrees(actualQuaternion, expectedQuaternion);
    this.acceptedCount = incrementBounded(this.acceptedCount);

    const seamPoint = this.getSegmentWorldPoint(segmentId, new THREE.Vector3()) ?? finiteVector(worldPoint, expectedPosition);
    const bloodDirection = requestedImpulse.lengthSq() > 1e-8 ? requestedImpulse.clone().normalize() : expectedQuaternion ? new THREE.Vector3(0, 1, 0).applyQuaternion(expectedQuaternion) : new THREE.Vector3(0, 1, 0);
    const bloodTriggered = this.actor?.emitDetachmentBlood?.({ segmentId, cause, position: seamPoint, direction: bloodDirection }) === true;
    if (bloodTriggered) {
      this.bloodActivationCount = incrementBounded(this.bloodActivationCount);
      state.bloodActivationCount = incrementBounded(state.bloodActivationCount);
    }
    const mortalityTriggered = state.manifest.fatal === true && this.actor?.requestFatalSegmentDetachment?.({ segmentId, cause, worldPoint: seamPoint }) === true;
    if (mortalityTriggered) this.mortalityActivationCount = incrementBounded(this.mortalityActivationCount);
    const consequence = state.manifest.fatal === false
      ? this.actor?.applyNonfatalSegmentDetachment?.({ segmentId, cause, worldPoint: seamPoint, direction: bloodDirection, detachedBodyIds: state.detachedBodyIds })
      : null;
    const consequenceTriggered = consequence?.accepted === true || consequence === true;
    const reactionTriggered = consequence?.reactionTriggered === true;
    if (consequenceTriggered) {
      this.nonfatalConsequenceCount = incrementBounded(this.nonfatalConsequenceCount);
      state.consequenceActivationCount = incrementBounded(state.consequenceActivationCount);
    }

    if (segmentId === 'head_neck') {
      this.detachedBody = state.body;
      this.detachedCollider = state.collider;
      this.colliderTypeUsed = state.colliderType;
      this.spawnPositionError = state.spawnPositionError;
      this.spawnRotationErrorDegrees = state.spawnRotationErrorDegrees;
      this.inheritedLinearSpeed = state.inheritedLinearSpeed;
      this.inheritedAngularSpeed = state.inheritedAngularSpeed;
    }

    return { accepted: true, segmentId, reason: 'detached', detachedBodyCreated: true, detachedColliderCreated: true, fatal: state.manifest.fatal === true, mortalityTriggered, reactionTriggered, bloodTriggered };
  }

  updateAfterPhysics() {
    this.segmentStates.forEach((state) => {
      if (!state.body) return;
      const translation = state.body.translation();
      const rotation = state.body.rotation();
      state.detachedObject.position.set(translation.x, translation.y, translation.z);
      state.detachedObject.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w).normalize();
      state.detachedObject.updateMatrixWorld(true);
    });
  }

  removeDetachedPhysics(state) {
    if (state.collider) this.physics.world.removeCollider(state.collider, false);
    if (state.body) this.physics.world.removeRigidBody(state.body);
    state.collider = null;
    state.body = null;
    state.colliderType = null;
    state.fallbackColliderUsed = false;
  }

  removeAllDetachedPhysics() {
    this.segmentStates.forEach((state) => this.removeDetachedPhysics(state));
    this.detachedCollider = null;
    this.detachedBody = null;
    this.colliderTypeUsed = null;
  }

  reset() {
    const disabledBodyIds = [...new Set([...this.segmentStates.values()].flatMap((state) => state.detachedBodyIds))];
    this.removeAllDetachedPhysics();
    this.segmentStates.forEach((state) => {
      if (state.detachedObject.parent !== state.authoredParent) state.authoredParent.add(state.detachedObject);
      state.detachedObject.position.copy(state.authoredTransform.position);
      state.detachedObject.quaternion.copy(state.authoredTransform.quaternion);
      state.detachedObject.scale.copy(state.authoredTransform.scale);
      state.detachedObject.updateMatrixWorld(true);
    });
    this.actor?.restoreDetachedSemanticBodies?.(disabledBodyIds);
    this.detachedSegments.clear();
    this.applyIntactState();
    this.resetDiagnostics();
    this.captureSegmentBindings();
  }

  getDamageAssetDiagnostics() {
    return {
      ...this.validation.diagnostics,
      intactStateValid: this.validateIntactState() || this.detachedSegments.size > 0,
      deformation: this.deformationRuntime?.getDiagnostics?.() ?? null,
    };
  }

  getDiagnostics() {
    const headPosition = this.headState.body?.translation?.();
    const headQuaternion = this.headState.body?.rotation?.();
    const perSegment = Object.fromEntries([...this.segmentStates].map(([segmentId, state]) => {
      const position = state.body?.translation?.();
      const quaternion = state.body?.rotation?.();
      return [segmentId, {
        segmentId,
        detached: this.detachedSegments.has(segmentId),
        attachedVisible: state.attachedObject.visible,
        proximalStumpVisible: state.proximalStump.visible,
        detachedVisible: state.detachedObject.visible,
        distalStumpVisible: state.distalStump.visible,
        rigidBodyCreated: Boolean(state.body),
        colliderCreated: Boolean(state.collider),
        colliderType: state.colliderType,
        fallbackColliderUsed: state.fallbackColliderUsed,
        spawnPositionError: state.spawnPositionError,
        spawnRotationErrorDegrees: state.spawnRotationErrorDegrees,
        inheritedLinearSpeed: state.inheritedLinearSpeed,
        inheritedAngularSpeed: state.inheritedAngularSpeed,
        bloodActivationCount: state.bloodActivationCount,
        consequenceActivationCount: state.consequenceActivationCount,
        detachedMass: state.body?.mass?.() ?? null,
        detachedBodyIds: [...state.detachedBodyIds],
        position: position ? [position.x, position.y, position.z] : null,
        quaternion: quaternion ? [quaternion.x, quaternion.y, quaternion.z, quaternion.w] : null,
      }];
    }));
    return {
      requestedCount: this.requestedCount,
      acceptedCount: this.acceptedCount,
      rejectedDuplicateCount: this.rejectedDuplicateCount,
      detachedSegments: [...this.detachedSegments],
      detachedRigidBodyCount: [...this.segmentStates.values()].filter((state) => state.body).length,
      detachedColliderCount: [...this.segmentStates.values()].filter((state) => state.collider).length,
      bloodActivationCount: this.bloodActivationCount,
      mortalityActivationCount: this.mortalityActivationCount,
      nonfatalConsequenceCount: this.nonfatalConsequenceCount,
      disabledProxyBodyIds: [...(this.actor?.detachedSemanticBodyIds ?? [])],
      detachedWoundTransferImplemented: false,
      deformation: this.deformationRuntime?.getDiagnostics?.() ?? null,
      perSegment,
      headDetached: this.detachedSegments.has('head_neck'),
      attachedHeadVisible: this.attachedHead.visible,
      torsoStumpVisible: this.torsoStump.visible,
      detachedHeadVisible: this.detachedHead.visible,
      detachedHeadStumpVisible: this.detachedHeadStump.visible,
      detachedHeadPosition: headPosition ? [headPosition.x, headPosition.y, headPosition.z] : null,
      detachedHeadQuaternion: headQuaternion ? [headQuaternion.x, headQuaternion.y, headQuaternion.z, headQuaternion.w] : null,
      spawnPositionError: this.headState.spawnPositionError,
      spawnRotationErrorDegrees: this.headState.spawnRotationErrorDegrees,
      inheritedLinearSpeed: this.headState.inheritedLinearSpeed,
      inheritedAngularSpeed: this.headState.inheritedAngularSpeed,
      colliderTypeUsed: this.headState.colliderType,
      detachedMass: this.headState.body?.mass?.() ?? null,
      lastCause: this.lastCause,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.reset();
    this.deformationRuntime?.dispose?.();
    this.deformationRuntime = null;
    this.disposed = true;
    this.actor = null;
    this.adapter = null;
    this.root = null;
    this.hostScene = null;
  }
}
