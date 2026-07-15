import * as THREE from 'three';
import { RAPIER } from './CombatPhysicsWorld.js';

export const DAMAGE_MANIFEST_SCHEMA = 'dreadstone.damage_authoring.v1';

export const DAMAGE_INTACT_VISIBLE_OBJECTS = Object.freeze([
  'DSB_BODY_CORE',
  'DSB_ATTACHED_HEAD',
  'DSB_ATTACHED_FOREARM_L',
  'DSB_ATTACHED_FOREARM_R',
]);

export const DAMAGE_INTACT_HIDDEN_OBJECTS = Object.freeze([
  'DSB_SEGMENT_HEAD',
  'DSB_STUMP_NECK_TORSO',
  'DSB_STUMP_NECK_HEAD',
  'DSB_SEGMENT_FOREARM_L',
  'DSB_SEGMENT_FOREARM_R',
  'DSB_STUMP_ELBOW_L_UPPER',
  'DSB_STUMP_ELBOW_L_LOWER',
  'DSB_STUMP_ELBOW_R_UPPER',
  'DSB_STUMP_ELBOW_R_LOWER',
  'DSB_SEGMENT_UPPER_BODY',
  'DSB_SEGMENT_LOWER_BODY',
  'DSB_STUMP_WAIST_UPPER',
  'DSB_STUMP_WAIST_LOWER',
  'DSB_SOCKET_ABDOMEN_VISCERA',
]);

const DETACHED_COLLISION_GROUPS = 0x00020001;
const MAXIMUM_DETACHED_LINEAR_SPEED = 8;
const MAXIMUM_DETACHED_ANGULAR_SPEED = 14;
const tmpPoint = new THREE.Vector3();

function basename(path = '') {
  return path.split('/').pop() ?? path;
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

export function validateDamageAsset({ manifest, root, profile, clips = [], animationManifest = null } = {}) {
  const errors = [];
  const { objects, duplicates } = collectNamedObjects(root);
  const requiredNames = [...(profile?.damageRequiredObjects ?? [])];
  const missingObjects = requiredNames.filter((name) => !objects.has(name));
  const duplicateRequiredObjects = requiredNames.filter((name) => duplicates.has(name));
  if (!manifest || manifest.schema !== DAMAGE_MANIFEST_SCHEMA) errors.push(`invalid damage manifest schema ${manifest?.schema ?? 'missing'}`);
  if (manifest?.authoringVersion !== profile?.damageAuthoringVersion) errors.push(`authoring version ${manifest?.authoringVersion ?? 'missing'} does not match ${profile?.damageAuthoringVersion ?? 'profile'}`);
  if (manifest?.authoringBuildId !== profile?.damageAuthoringBuildId) errors.push(`authoring build ${manifest?.authoringBuildId ?? 'missing'} does not match ${profile?.damageAuthoringBuildId ?? 'profile'}`);
  if (manifest?.glb !== basename(profile?.assetPath)) errors.push(`damage manifest targets ${manifest?.glb ?? 'missing'}, expected ${basename(profile?.assetPath)}`);
  if (manifest?.source?.topologyFingerprint !== profile?.damageTopologyFingerprint) errors.push('source topology fingerprint mismatch');
  if (manifest?.source?.weightFingerprint !== profile?.damageWeightFingerprint) errors.push('source weight fingerprint mismatch');
  if (missingObjects.length) errors.push(`missing required objects: ${missingObjects.join(', ')}`);
  if (duplicateRequiredObjects.length) errors.push(`duplicate required objects: ${duplicateRequiredObjects.join(', ')}`);

  const headSegments = (manifest?.segments ?? []).filter((entry) => entry?.segmentId === 'head_neck');
  const headSegment = headSegments[0] ?? null;
  if (headSegments.length !== 1) errors.push(`expected one head_neck segment, found ${headSegments.length}`);
  const expectedHeadMetadata = {
    attachedObject: 'DSB_ATTACHED_HEAD',
    detachedObject: 'DSB_SEGMENT_HEAD',
    proximalStump: 'DSB_STUMP_NECK_TORSO',
    distalStump: 'DSB_STUMP_NECK_HEAD',
    bone: 'head',
  };
  Object.entries(expectedHeadMetadata).forEach(([key, expected]) => {
    if (headSegment?.[key] !== expected) errors.push(`head_neck ${key} must be ${expected}`);
  });
  if (headSegment?.fatal !== true) errors.push('head_neck must be fatal');
  if (headSegment?.detachedMassHint !== 4.5) errors.push('head_neck detached mass must be 4.5');
  if (headSegment?.colliderHint !== 'convex_hull') errors.push('head_neck collider hint must be convex_hull');
  if (!objects.get(headSegment?.detachedObject)?.isMesh) errors.push('head_neck detached object must be a rigid mesh');
  if (objects.get(headSegment?.detachedObject)?.isSkinnedMesh) errors.push('head_neck detached object must not be skinned');
  if (!objects.get(headSegment?.attachedObject)?.isSkinnedMesh) errors.push('head_neck attached object must be skinned');
  if (!objects.get(headSegment?.proximalStump)?.isSkinnedMesh) errors.push('head_neck proximal stump must be skinned');
  if (objects.get(headSegment?.distalStump)?.parent !== objects.get(headSegment?.detachedObject)) errors.push('head_neck distal stump must be parented to the detached head');
  if (!objects.has(headSegment?.bone)) errors.push('head_neck animated bone is missing');

  const expectedAnimations = [...(profile?.damageExpectedAnimationNames ?? [])];
  const manifestAnimationNames = (animationManifest?.animations ?? []).map((entry) => entry?.name).filter(Boolean);
  const clipNames = clips.filter((clip) => clip?.tracks?.length > 0).map((clip) => clip.name);
  if (!sameNames(manifestAnimationNames, expectedAnimations)) errors.push('damage animation manifest does not contain the exact approved animation names');
  const missingAnimations = expectedAnimations.filter((name) => !clipNames.includes(name));
  if (missingAnimations.length) errors.push(`damage GLB is missing approved animations: ${missingAnimations.join(', ')}`);

  if (errors.length) throw new Error(`Humanoid damage profile ${profile?.name ?? 'unknown'} failed validation: ${errors.join('; ')}`);
  return {
    objects,
    headSegment,
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
    child.castShadow = true;
    child.receiveShadow = true;
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
    this.headSegment = this.validation.headSegment;
    this.headBone = this.objects.get(this.headSegment.bone);
    this.attachedHead = this.objects.get(this.headSegment.attachedObject);
    this.detachedHead = this.objects.get(this.headSegment.detachedObject);
    this.torsoStump = this.objects.get(this.headSegment.proximalStump);
    this.detachedHeadStump = this.objects.get(this.headSegment.distalStump);
    this.authoredDetachedParent = this.detachedHead.parent;
    this.authoredDetachedTransform = {
      position: this.detachedHead.position.clone(),
      quaternion: this.detachedHead.quaternion.clone(),
      scale: this.detachedHead.scale.clone(),
    };
    this.headBoneToDetached = new THREE.Matrix4();
    this.lastHeadPosition = new THREE.Vector3();
    this.lastHeadQuaternion = new THREE.Quaternion();
    this.headProxyVelocity = new THREE.Vector3();
    this.headProxyAngularVelocity = new THREE.Vector3();
    this.detachedBody = null;
    this.detachedCollider = null;
    this.colliderTypeUsed = null;
    this.detachedSegments = new Set();
    this.resetDiagnostics();
    this.configureDamageObjects();
    this.captureHeadBinding();
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
    this.lastCause = null;
  }

  configureDamageObjects() {
    [...this.objects.values()].filter((object) => object.name?.startsWith('DSB_')).forEach(configureDamageObject);
  }

  captureHeadBinding() {
    this.adapter.presentationRoot?.updateMatrixWorld?.(true);
    this.root.updateMatrixWorld(true);
    this.headBone.updateMatrixWorld(true);
    this.detachedHead.updateMatrixWorld(true);
    this.headBoneToDetached.copy(this.headBone.matrixWorld).invert().multiply(this.detachedHead.matrixWorld);
    this.headBone.getWorldPosition(this.lastHeadPosition);
    this.headBone.getWorldQuaternion(this.lastHeadQuaternion);
  }

  applyIntactState() {
    DAMAGE_INTACT_VISIBLE_OBJECTS.forEach((name) => { this.objects.get(name).visible = true; });
    DAMAGE_INTACT_HIDDEN_OBJECTS.forEach((name) => { this.objects.get(name).visible = false; });
    this.validation.diagnostics.intactStateValid = this.validateIntactState();
    return this.validation.diagnostics.intactStateValid;
  }

  validateIntactState() {
    return DAMAGE_INTACT_VISIBLE_OBJECTS.every((name) => this.objects.get(name)?.visible === true)
      && DAMAGE_INTACT_HIDDEN_OBJECTS.every((name) => this.objects.get(name)?.visible === false);
  }

  captureAnimatedMotion(deltaSeconds) {
    if (this.disposed || this.detachedSegments.has('head_neck') || !(deltaSeconds > 0)) return;
    this.adapter.presentationRoot?.updateMatrixWorld?.(true);
    this.root.updateMatrixWorld(true);
    const currentPosition = this.headBone.getWorldPosition(new THREE.Vector3());
    const currentQuaternion = this.headBone.getWorldQuaternion(new THREE.Quaternion());
    const livingVelocity = finiteVector(this.actor?.livingVelocity);
    this.headProxyVelocity.copy(currentPosition).sub(this.lastHeadPosition).multiplyScalar(1 / deltaSeconds).sub(livingVelocity);
    clampVectorLength(this.headProxyVelocity, 3.5);
    const deltaRotation = currentQuaternion.clone().multiply(this.lastHeadQuaternion.clone().invert()).normalize();
    if (deltaRotation.w < 0) deltaRotation.set(-deltaRotation.x, -deltaRotation.y, -deltaRotation.z, -deltaRotation.w);
    const angle = 2 * Math.acos(THREE.MathUtils.clamp(deltaRotation.w, -1, 1));
    const sine = Math.sqrt(Math.max(0, 1 - deltaRotation.w * deltaRotation.w));
    if (angle > 1e-6 && sine > 1e-6) this.headProxyAngularVelocity.set(deltaRotation.x / sine, deltaRotation.y / sine, deltaRotation.z / sine).multiplyScalar(angle / deltaSeconds);
    else this.headProxyAngularVelocity.set(0, 0, 0);
    clampVectorLength(this.headProxyAngularVelocity, 8);
    this.lastHeadPosition.copy(currentPosition);
    this.lastHeadQuaternion.copy(currentQuaternion);
  }

  getSegmentWorldPoint(segmentId = 'head_neck', target = new THREE.Vector3()) {
    if (segmentId !== 'head_neck') return null;
    this.adapter.prepareVisibleSurfaceFrame?.();
    const bounds = getObjectWorldBounds(this.torsoStump);
    return bounds.isEmpty() ? this.headBone.getWorldPosition(target) : bounds.getCenter(target);
  }

  createColliderVertices(authoredWorldScale) {
    const position = this.detachedHead.geometry?.attributes?.position;
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

  createDetachedPhysics(position, quaternion, scale) {
    const bodyDescriptor = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation(quaternion)
      .setLinearDamping(0.85)
      .setAngularDamping(1.15)
      .setCanSleep(true);
    const body = this.physics.world.createRigidBody(bodyDescriptor);
    body.userData = { actor: this.actor, type: 'detached-segment', segmentId: 'head_neck' };
    const vertices = this.createColliderVertices(scale);
    let colliderDescriptor = this.headSegment.colliderHint === 'convex_hull' ? RAPIER.ColliderDesc.convexHull(vertices) : null;
    let colliderType = 'convex_hull';
    if (!colliderDescriptor) {
      const bounds = new THREE.Box3().makeEmpty();
      for (let index = 0; index < vertices.length; index += 3) bounds.expandByPoint(tmpPoint.set(vertices[index], vertices[index + 1], vertices[index + 2]));
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const radius = THREE.MathUtils.clamp(Math.max(size.x, size.y, size.z) * 0.42, 0.08, 0.22);
      colliderDescriptor = RAPIER.ColliderDesc.ball(radius).setTranslation(center.x, center.y, center.z);
      colliderType = 'ball-fallback';
      if (!this.warnedColliderFallback) {
        this.warnedColliderFallback = true;
        console.warn('[HumanoidDamageSegmentRuntime] Convex hull generation failed for head_neck; using bounded ball fallback.');
      }
    }
    colliderDescriptor
      .setMass(this.headSegment.detachedMassHint)
      .setFriction(0.78)
      .setRestitution(0.025)
      .setCollisionGroups(DETACHED_COLLISION_GROUPS);
    const collider = this.physics.world.createCollider(colliderDescriptor, body);
    collider.userData = body.userData;
    return { body, collider, colliderType };
  }

  clampDetachedVelocities() {
    const linear = this.detachedBody.linvel();
    const angular = this.detachedBody.angvel();
    const safeLinear = clampVectorLength(new THREE.Vector3(linear.x, linear.y, linear.z), MAXIMUM_DETACHED_LINEAR_SPEED);
    const safeAngular = clampVectorLength(new THREE.Vector3(angular.x, angular.y, angular.z), MAXIMUM_DETACHED_ANGULAR_SPEED);
    this.detachedBody.setLinvel(safeLinear, true);
    this.detachedBody.setAngvel(safeAngular, true);
    this.inheritedLinearSpeed = safeLinear.length();
    this.inheritedAngularSpeed = safeAngular.length();
  }

  requestDetachment({ segmentId, cause = 'unspecified', worldPoint = null, impulse = null, angularImpulse = null } = {}) {
    this.requestedCount += 1;
    if (!(this.adapter.profile.activeDamageSegmentIds ?? []).includes(segmentId)) {
      return { accepted: false, segmentId, reason: 'unsupported-segment', detachedBodyCreated: false, mortalityTriggered: false, bloodTriggered: false };
    }
    if (this.detachedSegments.has(segmentId)) {
      this.rejectedDuplicateCount += 1;
      return { accepted: false, segmentId, reason: 'already-detached', detachedBodyCreated: false, mortalityTriggered: false, bloodTriggered: false };
    }

    this.adapter.prepareVisibleSurfaceFrame?.();
    const expectedWorldMatrix = this.headBone.matrixWorld.clone().multiply(this.headBoneToDetached);
    const expectedPosition = new THREE.Vector3();
    const expectedQuaternion = new THREE.Quaternion();
    const expectedScale = new THREE.Vector3();
    expectedWorldMatrix.decompose(expectedPosition, expectedQuaternion, expectedScale);
    if (![...expectedPosition.toArray(), ...expectedQuaternion.toArray(), ...expectedScale.toArray()].every(Number.isFinite)) {
      return { accepted: false, segmentId, reason: 'invalid-animated-transform', detachedBodyCreated: false, mortalityTriggered: false, bloodTriggered: false };
    }

    const physicsPiece = this.createDetachedPhysics(expectedPosition, expectedQuaternion, expectedScale);
    this.detachedBody = physicsPiece.body;
    this.detachedCollider = physicsPiece.collider;
    this.colliderTypeUsed = physicsPiece.colliderType;
    this.hostScene.attach(this.detachedHead);
    this.detachedHead.position.copy(expectedPosition);
    this.detachedHead.quaternion.copy(expectedQuaternion);
    this.detachedHead.scale.copy(expectedScale);
    this.detachedHead.updateMatrixWorld(true);

    this.attachedHead.visible = false;
    this.torsoStump.visible = true;
    this.detachedHead.visible = true;
    this.detachedHeadStump.visible = true;
    this.detachedSegments.add(segmentId);
    this.lastCause = cause;

    const inheritedVelocity = finiteVector(this.actor?.livingVelocity).add(this.headProxyVelocity);
    clampVectorLength(inheritedVelocity, MAXIMUM_DETACHED_LINEAR_SPEED);
    this.detachedBody.setLinvel(inheritedVelocity, true);
    this.detachedBody.setAngvel(clampVectorLength(this.headProxyAngularVelocity.clone(), MAXIMUM_DETACHED_ANGULAR_SPEED), true);
    const requestedImpulse = finiteVector(impulse);
    const requestedAngularImpulse = finiteVector(angularImpulse);
    if (requestedImpulse.lengthSq() > 0) this.detachedBody.applyImpulse(requestedImpulse, true);
    if (requestedAngularImpulse.lengthSq() > 0) this.detachedBody.applyTorqueImpulse(requestedAngularImpulse, true);
    this.clampDetachedVelocities();
    this.physics.world.propagateModifiedBodyPositionsToColliders();

    const actualPosition = this.detachedHead.getWorldPosition(new THREE.Vector3());
    const actualQuaternion = this.detachedHead.getWorldQuaternion(new THREE.Quaternion());
    this.spawnPositionError = actualPosition.distanceTo(expectedPosition);
    this.spawnRotationErrorDegrees = rotationErrorDegrees(actualQuaternion, expectedQuaternion);
    this.acceptedCount += 1;

    const seamPoint = this.getSegmentWorldPoint(segmentId, new THREE.Vector3()) ?? finiteVector(worldPoint, expectedPosition);
    const bloodDirection = requestedImpulse.lengthSq() > 1e-8 ? requestedImpulse.clone().normalize() : expectedQuaternion ? new THREE.Vector3(0, 1, 0).applyQuaternion(expectedQuaternion) : new THREE.Vector3(0, 1, 0);
    const bloodTriggered = this.actor?.emitDetachmentBlood?.({ segmentId, cause, position: seamPoint, direction: bloodDirection }) === true;
    if (bloodTriggered) this.bloodActivationCount += 1;
    const mortalityTriggered = this.headSegment.fatal === true && this.actor?.requestFatalSegmentDetachment?.({ segmentId, cause, worldPoint: seamPoint }) === true;
    if (mortalityTriggered) this.mortalityActivationCount += 1;

    return { accepted: true, segmentId, reason: 'detached', detachedBodyCreated: true, mortalityTriggered, bloodTriggered };
  }

  updateAfterPhysics() {
    if (!this.detachedBody || !this.detachedHead) return;
    const translation = this.detachedBody.translation();
    const rotation = this.detachedBody.rotation();
    this.detachedHead.position.set(translation.x, translation.y, translation.z);
    this.detachedHead.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w).normalize();
    this.detachedHead.updateMatrixWorld(true);
  }

  removeDetachedPhysics() {
    if (this.detachedCollider) this.physics.world.removeCollider(this.detachedCollider, false);
    if (this.detachedBody) this.physics.world.removeRigidBody(this.detachedBody);
    this.detachedCollider = null;
    this.detachedBody = null;
    this.colliderTypeUsed = null;
  }

  reset() {
    this.removeDetachedPhysics();
    if (this.detachedHead.parent !== this.authoredDetachedParent) this.authoredDetachedParent.add(this.detachedHead);
    this.detachedHead.position.copy(this.authoredDetachedTransform.position);
    this.detachedHead.quaternion.copy(this.authoredDetachedTransform.quaternion);
    this.detachedHead.scale.copy(this.authoredDetachedTransform.scale);
    this.detachedHead.updateMatrixWorld(true);
    this.detachedSegments.clear();
    this.applyIntactState();
    this.resetDiagnostics();
    this.captureHeadBinding();
  }

  getDamageAssetDiagnostics() {
    return { ...this.validation.diagnostics, intactStateValid: this.validateIntactState() || this.detachedSegments.has('head_neck') };
  }

  getDiagnostics() {
    const detachedPosition = this.detachedBody?.translation?.();
    const detachedQuaternion = this.detachedBody?.rotation?.();
    return {
      requestedCount: this.requestedCount,
      acceptedCount: this.acceptedCount,
      rejectedDuplicateCount: this.rejectedDuplicateCount,
      detachedSegments: [...this.detachedSegments],
      headDetached: this.detachedSegments.has('head_neck'),
      attachedHeadVisible: this.attachedHead.visible,
      torsoStumpVisible: this.torsoStump.visible,
      detachedHeadVisible: this.detachedHead.visible,
      detachedHeadStumpVisible: this.detachedHeadStump.visible,
      detachedRigidBodyCount: this.detachedBody ? 1 : 0,
      detachedColliderCount: this.detachedCollider ? 1 : 0,
      detachedHeadPosition: detachedPosition ? [detachedPosition.x, detachedPosition.y, detachedPosition.z] : null,
      detachedHeadQuaternion: detachedQuaternion ? [detachedQuaternion.x, detachedQuaternion.y, detachedQuaternion.z, detachedQuaternion.w] : null,
      spawnPositionError: this.spawnPositionError,
      spawnRotationErrorDegrees: this.spawnRotationErrorDegrees,
      inheritedLinearSpeed: this.inheritedLinearSpeed,
      inheritedAngularSpeed: this.inheritedAngularSpeed,
      bloodActivationCount: this.bloodActivationCount,
      mortalityActivationCount: this.mortalityActivationCount,
      detachedWoundTransferImplemented: false,
      colliderTypeUsed: this.colliderTypeUsed,
      detachedMass: this.detachedBody?.mass?.() ?? null,
      lastCause: this.lastCause,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.actor = null;
    this.adapter = null;
    this.root = null;
    this.hostScene = null;
  }
}
