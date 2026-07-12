import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CURRENT_HUMANOID_BONE_MAP, CURRENT_HUMANOID_PROFILE, getHumanoidProfileScale } from './HumanoidModelProfiles.js';
import { ProceduralPainReactionController } from './ProceduralPainReaction.js';
import { findClosestSkinnedSurface, reconstructSkinnedSurface, validateSurfaceBinding } from './SkinnedSurfaceBinding.js';

export const HUMANOID_GLB_PATH = CURRENT_HUMANOID_PROFILE.assetPath;
export const HUMANOID_GLB_AUTHORED_HEIGHT = CURRENT_HUMANOID_PROFILE.rawHeight;
export const HUMANOID_GLB_TARGET_HEIGHT = CURRENT_HUMANOID_PROFILE.targetHeight;
export const HUMANOID_GLB_SCALE = getHumanoidProfileScale(CURRENT_HUMANOID_PROFILE);
export const HUMANOID_GLB_BONE_MAP = CURRENT_HUMANOID_BONE_MAP;

const cachedAssetPromises = new Map();
let assetLoadCount = 0;
const unitScale = new THREE.Vector3(1, 1, 1);
const decomposedBoneScale = new THREE.Vector3();
const proxyUp = new THREE.Vector3(0, 1, 0);

export function measureVisibleSkinnedBounds(root) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().makeEmpty();
  const vertex = new THREE.Vector3();
  root.traverse((object) => {
    if (!object.isSkinnedMesh || !object.geometry?.attributes?.position) return;
    object.skeleton?.update?.();
    for (let index = 0; index < object.geometry.attributes.position.count; index += 1) {
      object.getVertexPosition(index, vertex);
      object.localToWorld(vertex);
      bounds.expandByPoint(vertex);
    }
  });
  return bounds;
}

function hierarchyDepth(object) {
  let depth = 0;
  for (let parent = object.parent; parent; parent = parent.parent) depth += 1;
  return depth;
}

export function captureModelSpaceBoneBinding({ modelRootWorld, bodyBindWorld, boneBindWorld }) {
  const worldToModel = modelRootWorld.clone().invert();
  const bodyBindModel = worldToModel.clone().multiply(bodyBindWorld);
  const boneBindModel = worldToModel.clone().multiply(boneBindWorld);
  return bodyBindModel.invert().multiply(boneBindModel);
}

export function solveModelSpaceBoneLocal({ modelRootWorld, parentWorld, bodyWorld, bindOffset }) {
  const worldToModel = modelRootWorld.clone().invert();
  const bodyModel = worldToModel.clone().multiply(bodyWorld);
  const desiredBoneModel = bodyModel.multiply(bindOffset);
  const parentModel = worldToModel.multiply(parentWorld);
  return parentModel.invert().multiply(desiredBoneModel);
}

export function applySolvedBoneLocalTransform(bone, localMatrix, bindLocalScale) {
  localMatrix.decompose(bone.position, bone.quaternion, decomposedBoneScale);
  bone.scale.copy(bindLocalScale);
}

export function resolveRequiredBoneMappings({ bones, bodies, boneMap, profileName }) {
  const missing = [];
  const resolved = Object.entries(boneMap).map(([bodyId, boneName]) => {
    const bone = bones.get(boneName);
    const bodyEntry = bodies.get(bodyId);
    if (!bone || !bodyEntry) {
      missing.push(`${bodyId} -> ${boneName}`);
      return null;
    }
    return { bodyId, boneName, bone, bodyEntry };
  }).filter(Boolean);
  if (missing.length) throw new Error(`Humanoid GLB profile ${profileName} is missing required mappings: ${missing.join(', ')}`);
  return resolved;
}

function loadCachedAsset(assetPath) {
  if (!cachedAssetPromises.has(assetPath)) {
    assetLoadCount += 1;
    const promise = new GLTFLoader().loadAsync(assetPath).catch((error) => {
      cachedAssetPromises.delete(assetPath);
      throw error;
    });
    cachedAssetPromises.set(assetPath, promise);
  }
  return cachedAssetPromises.get(assetPath);
}

export class HumanoidGlbVisualAdapter {
  constructor({ actor, parent, profile = CURRENT_HUMANOID_PROFILE }) {
    this.actor = actor;
    this.parent = parent;
    this.profile = profile;
    this.scene = null;
    this.presentationRoot = null;
    this.skinnedMeshes = [];
    this.skeletons = [];
    this.bones = new Map();
    this.bindings = [];
    this.mixer = null;
    this.idleAction = null;
    this.reactionController = null;
    this.reactionBones = new Map();
    this.mixerAuthoredScales = new Map();
    this.rawVisibleBounds = null;
    this.normalizedVisibleBounds = null;
    this.uniformScale = null;
    this.basePresentationPosition = new THREE.Vector3();
    this.basePresentationYaw = 0;
    this.disposed = false;
    this.ready = this.load();
  }

  async load() {
    const asset = await loadCachedAsset(this.profile.assetPath);
    if (this.disposed) return;
    this.scene = clone(asset.scene);
    this.scene.name = 'humanoid-combat-glb-visual';
    this.scene.traverse((object) => {
      if (object.isBone) this.bones.set(object.name, object);
      if (!object.isSkinnedMesh) return;
      this.skinnedMeshes.push(object);
      if (object.skeleton && !this.skeletons.includes(object.skeleton)) this.skeletons.push(object.skeleton);
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.magFilter = THREE.NearestFilter;
          material.map.minFilter = THREE.LinearMipmapLinearFilter;
          material.map.generateMipmaps = true;
        }
        if (material.normalMap) {
          material.normalMap.colorSpace = THREE.NoColorSpace;
          material.normalMap.magFilter = THREE.NearestFilter;
          material.normalMap.minFilter = THREE.LinearMipmapLinearFilter;
          material.normalMap.generateMipmaps = true;
        }
        material.needsUpdate = true;
      });
    });
    if (!this.skinnedMeshes.length || !this.skeletons.length) throw new Error(`Humanoid GLB has no SkinnedMesh/skeleton: ${this.profile.assetPath}`);
    if (this.profile.animationAuthoritative) {
      this.initializeAnimationAuthoritative(asset.animations ?? []);
      return;
    }
    this.scene.position.fromArray(this.profile.rootOffset);
    this.scene.rotation.y = this.profile.rootYaw;
    this.scene.scale.setScalar(getHumanoidProfileScale(this.profile));
    this.scene.updateMatrixWorld(true);
    this.parent.add(this.scene);
    this.captureBindings();
    this.update(1);
  }

  initializeAnimationAuthoritative(clips) {
    this.presentationRoot = new THREE.Group();
    this.presentationRoot.name = 'model-idle-animation-authoritative-root';
    this.presentationRoot.add(this.scene);
    this.parent.add(this.presentationRoot);
    const idleClip = clips.find((clip) => clip.name === this.profile.idleClipName && clip.tracks.length > 0)
      ?? clips.find((clip) => /idle/i.test(clip.name) && clip.tracks.length > 0)
      ?? clips.find((clip) => clip.tracks.length > 0);
    if (!idleClip) throw new Error(`Humanoid GLB profile ${this.profile.name} has no valid idle animation`);
    this.mixer = new THREE.AnimationMixer(this.scene);
    this.idleAction = this.mixer.clipAction(idleClip);
    this.idleAction.setLoop(THREE.LoopRepeat, Infinity).play();
    this.mixer.update(0);
    this.scene.updateMatrixWorld(true);
    this.skeletons.forEach((skeleton) => skeleton.update());
    this.rawVisibleBounds = measureVisibleSkinnedBounds(this.scene);
    const measuredHeight = this.rawVisibleBounds.getSize(new THREE.Vector3()).y;
    if (!(measuredHeight > 0)) throw new Error(`Humanoid GLB profile ${this.profile.name} has empty skinned bounds`);
    this.uniformScale = this.profile.targetHeight / measuredHeight;
    this.scene.scale.setScalar(this.uniformScale);
    this.scene.updateMatrixWorld(true);
    this.skeletons.forEach((skeleton) => skeleton.update());
    const scaledBounds = measureVisibleSkinnedBounds(this.scene);
    this.scene.position.y = this.profile.groundClearance - scaledBounds.min.y;
    this.basePresentationPosition.copy(this.actor.visualRootPosition);
    this.basePresentationYaw = this.actor.spawnYaw + this.profile.rootYaw;
    this.presentationRoot.position.copy(this.basePresentationPosition);
    this.presentationRoot.rotation.y = this.basePresentationYaw;
    this.presentationRoot.updateMatrixWorld(true);
    this.skeletons.forEach((skeleton) => skeleton.update());
    this.normalizedVisibleBounds = measureVisibleSkinnedBounds(this.scene);
    this.resolveReactionBones();
    this.reactionController = new ProceduralPainReactionController({ bones: this.reactionBones, presentationRoot: this.presentationRoot, basePosition: this.basePresentationPosition, baseYaw: this.basePresentationYaw });
    this.actor.setAnimationAuthorityReady(this);
  }

  resolveReactionBones() {
    this.reactionBones.clear();
    const missing = [];
    Object.entries(this.profile.boneMap).forEach(([semanticId, boneName]) => {
      const bone = this.bones.get(boneName);
      if (bone) this.reactionBones.set(semanticId, bone);
      else missing.push(`${semanticId} -> ${boneName}`);
    });
    if (missing.length) throw new Error(`Humanoid reaction profile ${this.profile.name} is missing mapped bones: ${missing.join(', ')}`);
  }

  captureBindings() {
    this.scene.updateMatrixWorld(true);
    const modelRootWorld = this.scene.matrixWorld.clone();
    const bones = new Map();
    this.scene.traverse((object) => { if (object.isBone) bones.set(object.name, object); });
    this.bindings = resolveRequiredBoneMappings({ bones, bodies: this.actor.bodies, boneMap: this.profile.boneMap, profileName: this.profile.name }).map(({ bodyId, boneName, bone, bodyEntry }) => {
      const bodyBindWorld = new THREE.Matrix4().compose(bodyEntry.restPosition, bodyEntry.restQuaternion, unitScale);
      const offset = captureModelSpaceBoneBinding({ modelRootWorld, bodyBindWorld, boneBindWorld: bone.matrixWorld });
      return { bodyId, boneName, bone, offset, bindLocalScale: bone.scale.clone() };
    });
    this.bindings.sort((a, b) => hierarchyDepth(a.bone) - hierarchyDepth(b.bone));
  }

  update() {
    if (this.profile.animationAuthoritative) return;
    if (!this.scene || !this.bindings.length) return;
    this.parent.updateMatrixWorld(true);
    const modelRootWorld = this.scene.matrixWorld.clone();
    for (const binding of this.bindings) {
      const entry = this.actor.bodies.get(binding.bodyId);
      if (!entry) continue;
      const bodyWorld = new THREE.Matrix4().compose(entry.visual.position, entry.visual.quaternion, unitScale);
      binding.bone.parent?.updateMatrixWorld(true);
      const local = solveModelSpaceBoneLocal({ modelRootWorld, parentWorld: binding.bone.parent?.matrixWorld ?? modelRootWorld, bodyWorld, bindOffset: binding.offset });
      applySolvedBoneLocalTransform(binding.bone, local, binding.bindLocalScale);
      binding.bone.updateMatrixWorld(true);
    }
    this.skeletons.forEach((skeleton) => skeleton.update());
  }

  updateAnimationAuthority(deltaSeconds) {
    if (!this.mixer || !this.presentationRoot) return;
    const dt = Math.max(0, deltaSeconds);
    const diagnostics = this.reactionController?.getDiagnostics?.();
    this.mixer.timeScale = diagnostics?.phase === 'impact' && diagnostics.severity > 0.65 ? 0.62 : diagnostics?.phase === 'pain_hold' ? 0.78 : 1;
    this.mixer.update(dt);
    this.mixerAuthoredScales.clear();
    this.reactionBones.forEach((bone, id) => this.mixerAuthoredScales.set(id, bone.scale.clone()));
    this.reactionController?.applyAfterMixer(dt);
    this.presentationRoot.updateMatrixWorld(true);
    this.skeletons.forEach((skeleton) => skeleton.update());
    this.actor.syncAnimationProxyBodies(this);
  }

  triggerPainReaction(contact) {
    return this.reactionController?.trigger?.(contact) ?? false;
  }

  setEmbeddedTension(contact) {
    this.reactionController?.setEmbeddedTension?.(contact);
  }

  releaseEmbeddedReaction(contact) {
    return this.reactionController?.releaseEmbedded?.(contact) ?? false;
  }

  bindVisibleSurface(worldPoint, options = {}) {
    if (!this.scene || !this.skinnedMeshes.length) return null;
    this.presentationRoot?.updateMatrixWorld(true);
    this.skeletons.forEach((skeleton) => skeleton.update());
    return findClosestSkinnedSurface(this.skinnedMeshes, worldPoint, options);
  }

  reconstructVisibleSurface(binding, target) {
    return validateSurfaceBinding(binding) ? reconstructSkinnedSurface(binding, target) : null;
  }

  getFallbackWoundAnchor(bodyId, sourcePoint, sourceNormal = new THREE.Vector3(0, 0, 1)) {
    const pose = this.getProxyPose(bodyId);
    if (!pose) return { point: sourcePoint.clone(), normal: sourceNormal.clone().normalize(), fallback: true };
    const towardHit = sourcePoint.clone().sub(pose.position);
    if (towardHit.lengthSq() < 1e-8) towardHit.copy(sourceNormal);
    towardHit.normalize();
    return { point: pose.position.clone().addScaledVector(towardHit, 0.012), normal: towardHit, fallback: true };
  }

  getProxyPose(bodyId) {
    const fit = this.profile.proxyFit?.[bodyId];
    if (!fit) return null;
    if (fit.start && fit.end) {
      const startBone = this.bones.get(fit.start);
      const endBone = this.bones.get(fit.end);
      if (!startBone || !endBone) return null;
      const start = startBone.getWorldPosition(new THREE.Vector3());
      const end = endBone.getWorldPosition(new THREE.Vector3());
      const direction = end.clone().sub(start);
      const quaternion = direction.lengthSq() > 1e-8
        ? new THREE.Quaternion().setFromUnitVectors(proxyUp, direction.normalize())
        : startBone.getWorldQuaternion(new THREE.Quaternion());
      return { position: start.add(end).multiplyScalar(0.5), quaternion };
    }
    const bone = this.bones.get(fit.bone);
    if (!bone) return null;
    const quaternion = bone.getWorldQuaternion(new THREE.Quaternion());
    const position = bone.getWorldPosition(new THREE.Vector3());
    if (fit.offset) position.add(new THREE.Vector3().fromArray(fit.offset).applyQuaternion(quaternion));
    return { position, quaternion };
  }

  reset() {
    if (this.profile.animationAuthoritative) {
      this.reactionController?.reset?.();
      this.idleAction?.reset().play();
      this.mixer?.setTime(0);
      this.presentationRoot?.position.copy(this.basePresentationPosition);
      if (this.presentationRoot) this.presentationRoot.rotation.set(0, this.basePresentationYaw, 0);
      this.presentationRoot?.updateMatrixWorld(true);
      this.skeletons.forEach((skeleton) => skeleton.update());
      this.actor.syncAnimationProxyBodies(this);
      return;
    }
    this.update();
  }

  getDiagnostics() {
    const rawSize = this.rawVisibleBounds?.getSize(new THREE.Vector3());
    const normalizedSize = this.normalizedVisibleBounds?.getSize(new THREE.Vector3());
    const scaleChangedBones = [...this.mixerAuthoredScales].filter(([id, scale]) => scale.distanceTo(this.reactionBones.get(id)?.scale ?? scale) > 1e-8).map(([id]) => id);
    return { path: this.profile.assetPath, profileName: this.profile.name, animationAuthoritative: this.profile.animationAuthoritative === true, loadCount: assetLoadCount, cacheKeys: [...cachedAssetPromises.keys()], skinnedMeshCount: this.skinnedMeshes.length, skeletonCount: this.skeletons.length, mappedBoneCount: this.profile.animationAuthoritative ? Object.keys(this.profile.boneMap).length : this.bindings.length, missingMappedBones: [], bindOffsetCount: this.bindings.length, mixerCount: this.mixer ? 1 : 0, reactionControllerCount: this.reactionController ? 1 : 0, idleClip: this.idleAction?.getClip?.().name ?? null, rawMeasuredVisibleHeight: rawSize?.y ?? null, normalizedVisibleHeight: normalizedSize?.y ?? this.profile.targetHeight, normalizedVisibleMinY: this.normalizedVisibleBounds?.min.y ?? null, groundY: this.actor.visualRootPosition.y, groundClearance: this.profile.groundClearance ?? null, height: this.profile.targetHeight, scale: this.uniformScale ?? getHumanoidProfileScale(this.profile), scaleChangedBones, reaction: this.reactionController?.getDiagnostics?.() ?? null };
  }

  dispose() {
    this.disposed = true;
    this.idleAction?.stop();
    this.mixer?.stopAllAction();
    if (this.scene && this.mixer) this.mixer.uncacheRoot(this.scene);
    this.presentationRoot?.removeFromParent();
    this.scene?.removeFromParent();
    this.scene = null;
    this.presentationRoot = null;
    this.mixer = null;
    this.idleAction = null;
    this.reactionController?.reset?.();
    this.reactionController = null;
    this.reactionBones.clear();
    this.mixerAuthoredScales.clear();
    this.bindings = [];
    this.bones.clear();
    this.skinnedMeshes = [];
    this.skeletons = [];
  }
}
