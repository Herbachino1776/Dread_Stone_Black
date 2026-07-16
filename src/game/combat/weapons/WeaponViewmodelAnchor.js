import * as THREE from 'three';
import { WEAPON_VIEWMODEL_LAYER } from './WeaponRenderLayers.js';
import { getWeaponRenderLayer } from './WeaponVisualAsset.js';

const MAX_DIAGNOSTIC_COUNT = 1_000_000;
const incrementBounded = (value) => Math.min(MAX_DIAGNOSTIC_COUNT, value + 1);
const matrixChanged = (a, b, epsilon = 1e-10) => a.elements.some((value, index) => Math.abs(value - b.elements[index]) > epsilon);

export function createWeaponViewmodelAnchor(camera) {
  if (!camera) return null;
  const anchor = new THREE.Group();
  anchor.name = 'shared-first-person-weapon-viewmodel-anchor';
  anchor.position.set(0, 0, 0);
  anchor.quaternion.identity();
  anchor.scale.set(1, 1, 1);
  anchor.layers.set(WEAPON_VIEWMODEL_LAYER);
  anchor.userData.weaponViewmodelAnchor = true;
  camera.add(anchor);
  return anchor;
}

export function disposeWeaponViewmodelAnchor(anchor) {
  if (!anchor) return;
  anchor.children.slice().forEach((child) => child.removeFromParent());
  anchor.removeFromParent();
}

function visibleInHierarchy(object) {
  for (let current = object; current; current = current.parent) if (current.visible === false) return false;
  return true;
}

function countTaggedPresentation(scene, itemId) {
  let visibleAuthoritativeRootCount = 0;
  let visibleTaggedMeshCount = 0;
  scene?.traverse?.((object) => {
    if (!visibleInHierarchy(object)) return;
    if (object.userData?.weaponPresentationRoot === true && object.userData?.itemId === itemId) visibleAuthoritativeRootCount += 1;
    if (object.isMesh && object.userData?.itemId === itemId) visibleTaggedMeshCount += 1;
  });
  return { visibleAuthoritativeRootCount, visibleTaggedMeshCount };
}

export class WeaponPresentationRuntime {
  constructor({ itemId, root, scene, camera, viewmodelAnchor } = {}) {
    this.itemId = itemId;
    this.root = root;
    this.scene = scene;
    this.camera = camera;
    this.viewmodelAnchor = viewmodelAnchor;
    this.presentationMode = 'detached';
    this.transformWritesThisFrame = 0;
    this.parentTransitionCount = 0;
    this.layerTransitionCount = 0;
    this.currentLayer = null;
    this.cameraRelativePositionError = 0;
    this.cameraRelativeRotationErrorDegrees = 0;
    this.maximumMovementFramePositionError = 0;
    this.maximumMovementFrameRotationErrorDegrees = 0;
    this.postExtractionPositionJump = 0;
    this.postExtractionRotationJumpDegrees = 0;
    this.extractionContinuityActive = false;
    this.previousExtractionLocalPosition = new THREE.Vector3();
    this.previousExtractionLocalQuaternion = new THREE.Quaternion();
    this.physicalCameraMatrix = new THREE.Matrix4();
    this.finalCameraMatrix = new THREE.Matrix4();
    this.hasPhysicalCameraMatrix = false;
    this.cameraMovedSincePhysics = false;
    this.expectedLocalPosition = new THREE.Vector3();
    this.expectedLocalQuaternion = new THREE.Quaternion();
    this.scratchPosition = new THREE.Vector3();
    this.scratchQuaternion = new THREE.Quaternion();
    this.beforeTransitionPosition = new THREE.Vector3();
    this.beforeTransitionQuaternion = new THREE.Quaternion();
    this.duplicateWarningShown = false;
    if (root) {
      root.userData.weaponPresentationRoot = true;
      root.userData.itemId = itemId;
    }
  }

  rebind({ scene = this.scene, camera = this.camera, viewmodelAnchor = this.viewmodelAnchor } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.viewmodelAnchor = viewmodelAnchor;
  }

  recordPhysicalCameraMatrix() {
    this.camera?.updateMatrixWorld?.(true);
    if (this.camera?.matrixWorld) {
      this.physicalCameraMatrix.copy(this.camera.matrixWorld);
      this.hasPhysicalCameraMatrix = true;
    }
  }

  beginRenderFrame() {
    this.transformWritesThisFrame = 0;
    this.camera?.updateMatrixWorld?.(true);
    if (this.camera?.matrixWorld) {
      this.finalCameraMatrix.copy(this.camera.matrixWorld);
      this.cameraMovedSincePhysics = this.hasPhysicalCameraMatrix && matrixChanged(this.physicalCameraMatrix, this.finalCameraMatrix);
    }
  }

  captureWorldPose(position, quaternion) {
    if (!this.root?.parent) return false;
    this.root.parent.updateMatrixWorld?.(true);
    this.root.updateMatrixWorld?.(true);
    this.root.getWorldPosition(position);
    this.root.getWorldQuaternion(quaternion);
    return true;
  }

  transitionParent(parent, mode, { preserveWorld = true, extraction = false } = {}) {
    if (!this.root || !parent || this.root.parent === parent) {
      this.presentationMode = mode;
      return false;
    }
    const hadWorldPose = this.captureWorldPose(this.beforeTransitionPosition, this.beforeTransitionQuaternion);
    parent.updateMatrixWorld?.(true);
    if (preserveWorld && hadWorldPose) parent.attach(this.root);
    else parent.add(this.root);
    this.presentationMode = mode;
    this.parentTransitionCount = incrementBounded(this.parentTransitionCount);
    if (extraction && hadWorldPose) {
      this.root.updateMatrixWorld?.(true);
      const positionJump = this.root.getWorldPosition(this.scratchPosition).distanceTo(this.beforeTransitionPosition);
      const rotationJump = THREE.MathUtils.radToDeg(this.root.getWorldQuaternion(this.scratchQuaternion).angleTo(this.beforeTransitionQuaternion));
      this.postExtractionPositionJump = Math.max(this.postExtractionPositionJump, positionJump);
      this.postExtractionRotationJumpDegrees = Math.max(this.postExtractionRotationJumpDegrees, rotationJump);
      this.previousExtractionLocalPosition.copy(this.root.position);
      this.previousExtractionLocalQuaternion.copy(this.root.quaternion).normalize();
      this.extractionContinuityActive = true;
    }
    return true;
  }

  transitionToViewmodel(options = {}) {
    return this.transitionParent(this.viewmodelAnchor, 'viewmodel', options);
  }

  transitionToWorld(options = {}) {
    return this.transitionParent(this.scene, 'world', options);
  }

  detachHidden() {
    if (!this.root?.parent) {
      this.presentationMode = 'detached';
      return false;
    }
    this.root.removeFromParent();
    this.presentationMode = 'detached';
    this.parentTransitionCount = incrementBounded(this.parentTransitionCount);
    return true;
  }

  recordLayer(layer) {
    if (this.currentLayer != null && this.currentLayer !== layer) this.layerTransitionCount = incrementBounded(this.layerTransitionCount);
    this.currentLayer = layer;
  }

  writeViewmodelPose(localPosition, localQuaternion) {
    if (!this.root) return false;
    if (!this.viewmodelAnchor) {
      this.camera?.updateMatrixWorld?.(true);
      this.scratchPosition.copy(localPosition);
      this.camera?.localToWorld?.(this.scratchPosition);
      this.camera?.getWorldQuaternion?.(this.scratchQuaternion);
      this.scratchQuaternion.multiply(localQuaternion).normalize();
      this.transitionToWorld({ preserveWorld: true });
      this.root.position.copy(this.scratchPosition);
      this.root.quaternion.copy(this.scratchQuaternion);
      this.root.scale.set(1, 1, 1);
      this.root.updateMatrixWorld(true);
      this.transformWritesThisFrame = incrementBounded(this.transformWritesThisFrame);
      this.cameraRelativePositionError = 0;
      this.cameraRelativeRotationErrorDegrees = 0;
      return true;
    }
    this.transitionToViewmodel({ preserveWorld: true });
    this.expectedLocalPosition.copy(localPosition);
    this.expectedLocalQuaternion.copy(localQuaternion).normalize();
    if (this.extractionContinuityActive) {
      this.recordPostExtractionPoseJump(
        this.previousExtractionLocalPosition.distanceTo(localPosition),
        THREE.MathUtils.radToDeg(this.previousExtractionLocalQuaternion.angleTo(localQuaternion)),
      );
      this.previousExtractionLocalPosition.copy(localPosition);
      this.previousExtractionLocalQuaternion.copy(localQuaternion).normalize();
    }
    this.root.position.copy(localPosition);
    this.root.quaternion.copy(localQuaternion).normalize();
    this.root.scale.set(1, 1, 1);
    this.root.updateMatrixWorld(true);
    this.transformWritesThisFrame = incrementBounded(this.transformWritesThisFrame);
    this.measureCameraRelativeError();
    return true;
  }

  writeWorldPose(worldPosition, worldQuaternion) {
    if (!this.root || !this.scene) return false;
    this.transitionToWorld({ preserveWorld: true });
    this.root.position.copy(worldPosition);
    this.root.quaternion.copy(worldQuaternion).normalize();
    this.root.scale.set(1, 1, 1);
    this.root.updateMatrixWorld(true);
    this.transformWritesThisFrame = incrementBounded(this.transformWritesThisFrame);
    this.cameraRelativePositionError = 0;
    this.cameraRelativeRotationErrorDegrees = 0;
    return true;
  }

  measureCameraRelativeError() {
    if (!this.root || !this.viewmodelAnchor || this.root.parent !== this.viewmodelAnchor) return;
    this.cameraRelativePositionError = this.root.position.distanceTo(this.expectedLocalPosition);
    this.cameraRelativeRotationErrorDegrees = THREE.MathUtils.radToDeg(this.root.quaternion.angleTo(this.expectedLocalQuaternion));
    if (this.cameraMovedSincePhysics) {
      this.maximumMovementFramePositionError = Math.max(this.maximumMovementFramePositionError, this.cameraRelativePositionError);
      this.maximumMovementFrameRotationErrorDegrees = Math.max(this.maximumMovementFrameRotationErrorDegrees, this.cameraRelativeRotationErrorDegrees);
    }
  }

  recordPostExtractionPoseJump(positionJump = 0, rotationJumpDegrees = 0) {
    if (Number.isFinite(positionJump)) this.postExtractionPositionJump = Math.max(this.postExtractionPositionJump, Math.max(0, positionJump));
    if (Number.isFinite(rotationJumpDegrees)) this.postExtractionRotationJumpDegrees = Math.max(this.postExtractionRotationJumpDegrees, Math.max(0, rotationJumpDegrees));
  }

  endExtractionContinuity() { this.extractionContinuityActive = false; }

  getDiagnostics({ equippedItemId = this.itemId } = {}) {
    const counts = countTaggedPresentation(this.scene, equippedItemId);
    if (counts.visibleAuthoritativeRootCount > 1 && !this.duplicateWarningShown && import.meta.env?.DEV) {
      this.duplicateWarningShown = true;
      console.warn(`[combat] Multiple authoritative weapon presentation roots are visible for ${equippedItemId}.`);
    }
    return {
      equippedItemId,
      viewmodelAnchorPresent: Boolean(this.viewmodelAnchor),
      viewmodelAnchorParent: this.viewmodelAnchor?.parent?.name ?? this.viewmodelAnchor?.parent?.type ?? null,
      presentationMode: this.presentationMode,
      visualParent: this.root?.parent?.name ?? this.root?.parent?.type ?? null,
      visualRenderLayer: getWeaponRenderLayer(this.root),
      visibleAuthoritativeRootCount: counts.visibleAuthoritativeRootCount,
      visibleTaggedMeshCount: counts.visibleTaggedMeshCount,
      duplicateVisualRootCount: Math.max(0, counts.visibleAuthoritativeRootCount - 1),
      transformWritesThisFrame: this.transformWritesThisFrame,
      parentTransitionCount: this.parentTransitionCount,
      layerTransitionCount: this.layerTransitionCount,
      cameraRelativePositionError: this.cameraRelativePositionError,
      cameraRelativeRotationErrorDegrees: this.cameraRelativeRotationErrorDegrees,
      maximumMovementFramePositionError: this.maximumMovementFramePositionError,
      maximumMovementFrameRotationErrorDegrees: this.maximumMovementFrameRotationErrorDegrees,
      postExtractionPositionJump: this.postExtractionPositionJump,
      postExtractionRotationJumpDegrees: this.postExtractionRotationJumpDegrees,
    };
  }
}

export function getSharedWeaponPresentationDiagnostics(controllers = [], viewmodelAnchor = null) {
  const active = controllers.find((controller) => controller?.isEquipped?.())
    ?? controllers.find((controller) => controller?.presentation?.presentationMode === 'world')
    ?? null;
  if (active?.getWeaponPresentationDiagnostics) return active.getWeaponPresentationDiagnostics();
  return {
    equippedItemId: null,
    viewmodelAnchorPresent: Boolean(viewmodelAnchor),
    viewmodelAnchorParent: viewmodelAnchor?.parent?.name ?? viewmodelAnchor?.parent?.type ?? null,
    presentationMode: 'none',
    visualParent: null,
    visualRenderLayer: null,
    visibleAuthoritativeRootCount: 0,
    visibleTaggedMeshCount: 0,
    duplicateVisualRootCount: 0,
    transformWritesThisFrame: 0,
    parentTransitionCount: 0,
    layerTransitionCount: 0,
    cameraRelativePositionError: 0,
    cameraRelativeRotationErrorDegrees: 0,
    maximumMovementFramePositionError: 0,
    maximumMovementFrameRotationErrorDegrees: 0,
    postExtractionPositionJump: 0,
    postExtractionRotationJumpDegrees: 0,
  };
}
