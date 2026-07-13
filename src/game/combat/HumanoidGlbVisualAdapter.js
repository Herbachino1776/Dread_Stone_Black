import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CURRENT_HUMANOID_BONE_MAP, CURRENT_HUMANOID_PROFILE, getHumanoidProfileScale } from './HumanoidModelProfiles.js';
import { ProceduralPainReactionController } from './ProceduralPainReaction.js';
import { findClosestSkinnedSurface, reconstructSkinnedSurface, validateSurfaceBinding } from './SkinnedSurfaceBinding.js';
import { enableCombatReadabilityLightLayer } from './CombatReadabilityLightLayer.js';

export const HUMANOID_GLB_PATH = CURRENT_HUMANOID_PROFILE.assetPath;
export const HUMANOID_GLB_AUTHORED_HEIGHT = CURRENT_HUMANOID_PROFILE.rawHeight;
export const HUMANOID_GLB_TARGET_HEIGHT = CURRENT_HUMANOID_PROFILE.targetHeight;
export const HUMANOID_GLB_SCALE = getHumanoidProfileScale(CURRENT_HUMANOID_PROFILE);
export const HUMANOID_GLB_BONE_MAP = CURRENT_HUMANOID_BONE_MAP;

const cachedAssetPromises = new Map();
let assetLoadCount = 0;
const CHARACTER_LIGHTING_MODES = new Set(['normal', 'no-cast-shadow', 'no-receive-shadow', 'no-normal-map', 'no-directional-shadow', 'linear-normal-map', 'tight-shadow-frustum']);

function filterName(filter) {
  if (filter === THREE.NearestFilter) return 'NearestFilter';
  if (filter === THREE.LinearFilter) return 'LinearFilter';
  if (filter === THREE.LinearMipmapLinearFilter) return 'LinearMipmapLinearFilter';
  return String(filter);
}
const unitScale = new THREE.Vector3(1, 1, 1);
const decomposedBoneScale = new THREE.Vector3();
const proxyUp = new THREE.Vector3(0, 1, 0);
const ragdollBodyPosition = new THREE.Vector3();
const ragdollBodyQuaternion = new THREE.Quaternion();
const ragdollDesiredWorldPosition = new THREE.Vector3();
const ragdollDesiredWorldQuaternion = new THREE.Quaternion();
const ragdollParentWorldQuaternion = new THREE.Quaternion();

export function captureRotationOnlyRagdollBinding({ bodyId, bone, bodyPosition, bodyQuaternion, rootBodyId = 'pelvis' }) {
  const boneWorldPosition = bone.getWorldPosition(new THREE.Vector3());
  const boneWorldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion());
  const inverseBodyQuaternion = bodyQuaternion.clone().invert();
  return {
    bodyId,
    bone,
    isTranslationRoot: bodyId === rootBodyId,
    capturedLocalPosition: bone.position.clone(),
    capturedLocalScale: bone.scale.clone(),
    capturedLocalLength: bone.position.length(),
    bodyToBonePosition: boneWorldPosition.sub(bodyPosition).applyQuaternion(inverseBodyQuaternion),
    bodyToBoneQuaternion: inverseBodyQuaternion.multiply(boneWorldQuaternion).normalize(),
  };
}

export function applyRotationOnlyRagdollBinding(binding, bodyPosition, bodyQuaternion) {
  const { bone } = binding;
  bone.parent?.updateMatrixWorld?.(true);
  ragdollDesiredWorldQuaternion.copy(bodyQuaternion).multiply(binding.bodyToBoneQuaternion).normalize();
  if (bone.parent) {
    bone.parent.getWorldQuaternion(ragdollParentWorldQuaternion).invert();
    bone.quaternion.copy(ragdollParentWorldQuaternion.multiply(ragdollDesiredWorldQuaternion)).normalize();
  } else {
    bone.quaternion.copy(ragdollDesiredWorldQuaternion);
  }
  if (binding.isTranslationRoot) {
    ragdollDesiredWorldPosition.copy(binding.bodyToBonePosition).applyQuaternion(bodyQuaternion).add(bodyPosition);
    if (bone.parent) bone.position.copy(bone.parent.worldToLocal(ragdollDesiredWorldPosition));
    else bone.position.copy(ragdollDesiredWorldPosition);
  } else {
    bone.position.copy(binding.capturedLocalPosition);
  }
  bone.scale.copy(binding.capturedLocalScale);
  bone.updateMatrixWorld(true);
  return bone;
}

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

export function isolateObjectMaterials(root) {
  const clonesBySource = new Map();
  root?.traverse?.((object) => {
    if (!object.material) return;
    const cloneMaterial = (source) => {
      if (!source) return source;
      if (!clonesBySource.has(source)) clonesBySource.set(source, source.clone());
      return clonesBySource.get(source);
    };
    object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
  });
  return clonesBySource;
}

export class HumanoidGlbVisualAdapter {
  constructor({ actor, parent, profile = CURRENT_HUMANOID_PROFILE, isolateMaterials = false }) {
    this.actor = actor;
    this.parent = parent;
    this.profile = profile;
    this.scene = null;
    this.presentationRoot = null;
    this.skinnedMeshes = [];
    this.skeletons = [];
    this.bones = new Map();
    this.bindings = [];
    this.ragdollBindings = [];
    this.ragdollDiagnostics = this.createRagdollDiagnostics();
    this.mixer = null;
    this.idleAction = null;
    this.idlePlaybackScale = 1;
    this.reactionController = null;
    this.reactionBones = new Map();
    this.mixerAuthoredScales = new Map();
    this.locomotionController = null;
    this.isolateMaterials = isolateMaterials === true;
    this.ownedMaterials = new Map();
    this.fadePrepared = false;
    this.rawVisibleBounds = null;
    this.normalizedVisibleBounds = null;
    this.uniformScale = null;
    this.basePresentationPosition = new THREE.Vector3();
    this.basePresentationYaw = 0;
    this.disposed = false;
    const requestedLightingMode = globalThis.location ? new URLSearchParams(globalThis.location.search).get('characterLighting') : null;
    this.characterLightingMode = import.meta.env?.DEV && CHARACTER_LIGHTING_MODES.has(requestedLightingMode) ? requestedLightingMode : 'normal';
    this.ready = this.load();
  }

  createRagdollDiagnostics() {
    return {
      activationCount: 0,
      finalAnimatedPelvisPosition: null,
      firstRagdollPelvisPosition: null,
      maximumParentChildBoneLengthError: 0,
      nonFiniteTransformCount: 0,
      changedBoneScaleCount: 0,
    };
  }

  async load() {
    const asset = await loadCachedAsset(this.profile.assetPath);
    if (this.disposed) return;
    this.scene = clone(asset.scene);
    this.scene.name = 'humanoid-combat-glb-visual';
    if (this.isolateMaterials) this.ownedMaterials = isolateObjectMaterials(this.scene);
    this.scene.traverse((object) => {
      if (object.isBone) this.bones.set(object.name, object);
      if (!object.isSkinnedMesh) return;
      enableCombatReadabilityLightLayer(object);
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
          material.normalMap.magFilter = THREE.LinearFilter;
          material.normalMap.minFilter = THREE.LinearMipmapLinearFilter;
          material.normalMap.generateMipmaps = true;
          const normalSignX = Math.sign(material.normalScale?.x ?? 1) || 1;
          const normalSignY = Math.sign(material.normalScale?.y ?? 1) || 1;
          material.normalScale.set(normalSignX * 0.55, normalSignY * 0.55);
        }
        if (material.isMeshStandardMaterial) {
          material.metalness = 0;
          material.roughness = Math.max(material.roughness, 0.9);
        }
        material.needsUpdate = true;
      });
    });
    this.applyCharacterLightingDiagnostic();
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

  applyCharacterLightingDiagnostic() {
    if (this.characterLightingMode === 'no-cast-shadow') this.skinnedMeshes.forEach((mesh) => { mesh.castShadow = false; });
    if (this.characterLightingMode === 'no-receive-shadow') this.skinnedMeshes.forEach((mesh) => { mesh.receiveShadow = false; });
    if (this.characterLightingMode === 'no-normal-map') this.skinnedMeshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.filter(Boolean).forEach((material) => { material.userData.characterLightingNormalMap = material.normalMap; material.normalMap = null; material.needsUpdate = true; });
    });
    this.parent.userData.characterLightingMode = this.characterLightingMode;
    const hostScene = this.parent.parent;
    if (hostScene) {
      hostScene.userData.characterLightingDisableDirectional = this.characterLightingMode === 'no-directional-shadow';
      hostScene.userData.characterLightingForceTightFrustum = this.characterLightingMode === 'tight-shadow-frustum';
    }
    this.updateCharacterLightingDiagnostics();
  }

  updateCharacterLightingDiagnostics() {
    const normalMaps = [];
    this.skinnedMeshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.filter(Boolean).forEach((material) => {
        const normalMap = material.normalMap ?? material.userData.characterLightingNormalMap;
        if (!normalMap) return;
        normalMaps.push({ width: normalMap.image?.width ?? null, height: normalMap.image?.height ?? null, colorSpace: normalMap.colorSpace, magFilter: filterName(normalMap.magFilter), minFilter: filterName(normalMap.minFilter), normalScale: material.normalScale?.toArray?.() ?? null });
      });
    });
    const hostScene = this.parent.parent;
    const activeShadowCastingLights = [];
    let primaryDirectional = null;
    hostScene?.traverse?.((object) => {
      if (object.isDirectionalLight && object.castShadow && !primaryDirectional) primaryDirectional = object;
      if (object.isLight && object.castShadow && object.intensity > 0) activeShadowCastingLights.push({ name: object.name || object.type, type: object.type, intensity: object.intensity });
    });
    const shadowWidth = primaryDirectional ? primaryDirectional.shadow.camera.right - primaryDirectional.shadow.camera.left : null;
    const shadowMapResolution = primaryDirectional?.shadow.mapSize?.x ?? null;
    const directionalShadow = primaryDirectional ? { shadowMapResolution, radius: shadowWidth * 0.5, metersPerShadowTexel: shadowWidth / shadowMapResolution, bias: primaryDirectional.shadow.bias, normalBias: primaryDirectional.shadow.normalBias, filterRadius: primaryDirectional.shadow.radius } : null;
    const diagnostics = { mode: this.characterLightingMode, npcCastShadow: this.skinnedMeshes.every((mesh) => mesh.castShadow), npcReceiveShadow: this.skinnedMeshes.every((mesh) => mesh.receiveShadow), normalMaps, directionalShadow, activeShadowCastingLights };
    if (hostScene) hostScene.userData.characterLightingDiagnostics = diagnostics;
    if (import.meta.env?.DEV && globalThis.document) {
      const debugTokens = new Set((new URLSearchParams(globalThis.location?.search ?? '').get('debug') ?? '').split(','));
      if (debugTokens.has('character-lighting')) {
        this.characterLightingPanel ??= document.body.appendChild(document.createElement('pre'));
        this.characterLightingPanel.dataset.characterLightingDiagnostic = 'true';
        this.characterLightingPanel.style.cssText = 'position:fixed;right:8px;top:8px;z-index:9999;max-width:390px;padding:8px;background:#100d0ddd;color:#ffd7bd;font:11px/1.35 monospace;pointer-events:none;white-space:pre-wrap';
        const normal = normalMaps[0] ?? {};
        this.characterLightingPanel.textContent = `CHARACTER LIGHTING ${this.characterLightingMode}\nNPC cast ${diagnostics.npcCastShadow} receive ${diagnostics.npcReceiveShadow}\nnormal ${normal.width ?? '?'}x${normal.height ?? '?'} ${normal.magFilter ?? 'none'} / ${normal.minFilter ?? 'none'}\nnormal colorSpace ${normal.colorSpace ?? 'none'} scale ${normal.normalScale?.join(',') ?? 'none'}\nshadow map ${directionalShadow?.shadowMapResolution ?? 'none'} radius ${directionalShadow?.radius?.toFixed?.(2) ?? 'none'} texel ${directionalShadow?.metersPerShadowTexel?.toFixed?.(4) ?? 'none'}\nbias ${directionalShadow?.bias ?? 'none'} normalBias ${directionalShadow?.normalBias ?? 'none'} filter radius ${directionalShadow?.filterRadius ?? 'none'}\nshadow lights ${activeShadowCastingLights.map((light) => light.name).join(', ') || 'none'}`;
      }
    }
    return diagnostics;
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
    this.locomotionController?.bindBones?.(this.reactionBones);
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
    // Living pose authority: actor root -> fresh idle mixer pose -> walker gait
    // and consciousness loss -> additive pain -> matrices/skeleton -> skinned
    // wounds -> semantic proxies.
    const dt = Math.max(0, deltaSeconds);
    const reactionPlaybackScale = this.reactionController?.getPlaybackScale?.() ?? 1;
    const breathingPlaybackScale = 1 - (this.actor.physiology?.breathInterruption ?? 0) * 0.58;
    const targetPlaybackScale = Math.min(reactionPlaybackScale, breathingPlaybackScale);
    this.idlePlaybackScale = THREE.MathUtils.lerp(this.idlePlaybackScale, targetPlaybackScale, 1 - Math.exp(-dt * 10));
    this.mixer.timeScale = this.idlePlaybackScale;
    this.locomotionController?.restoreAuthoredPose?.();
    this.mixer.update(dt);
    this.reactionBones.forEach((bone, id) => {
      const scale = this.mixerAuthoredScales.get(id);
      if (scale) scale.copy(bone.scale);
      else this.mixerAuthoredScales.set(id, bone.scale.clone());
    });
    this.locomotionController?.applyAfterMixer?.(dt);
    this.reactionController?.applyAfterMixer(dt);
    this.presentationRoot.updateMatrixWorld(true);
    this.skeletons.forEach((skeleton) => skeleton.update());
    this.actor.woundSystem?.update?.(dt);
    this.actor.syncAnimationProxyBodies(this);
    if (this.characterLightingPanel) this.updateCharacterLightingDiagnostics();
  }

  setLocomotionController(controller = null) {
    this.locomotionController = controller;
    if (this.reactionBones.size) controller?.bindBones?.(this.reactionBones);
  }

  setAuthoritativeTransform(position, yaw) {
    if (!this.presentationRoot || this.actor.ragdollActive) return;
    this.basePresentationPosition.copy(position);
    this.basePresentationYaw = Number.isFinite(yaw) ? yaw + this.profile.rootYaw : this.basePresentationYaw;
    this.presentationRoot.position.copy(this.basePresentationPosition);
    this.presentationRoot.rotation.set(0, this.basePresentationYaw, 0);
    if (this.reactionController) {
      this.reactionController.baseYaw = this.basePresentationYaw;
      this.reactionController.rootYawQuaternion.setFromAxisAngle(proxyUp, this.basePresentationYaw);
    }
  }

  beginRagdoll() {
    // Ordinary hits never enter this path. The mixer remains authoritative until
    // the actor has explicitly transitioned into a terminal/collapse state.
    if (!this.scene || !this.presentationRoot || this.ragdollBindings.length) return this.ragdollBindings.length > 0;
    this.mixer.timeScale = 0;
    // Preserve the exact mixer + locomotion + pain pose, including bounded root
    // recoil, until offsets have been captured against the kinematic proxies.
    this.presentationRoot.updateMatrixWorld(true);
    this.scene.updateMatrixWorld(true);
    this.ragdollDiagnostics.activationCount += 1;
    this.ragdollDiagnostics.finalAnimatedPelvisPosition = this.reactionBones.get('pelvis')?.getWorldPosition(new THREE.Vector3()).toArray() ?? null;
    this.ragdollDiagnostics.firstRagdollPelvisPosition = null;
    this.ragdollDiagnostics.maximumParentChildBoneLengthError = 0;
    this.ragdollDiagnostics.nonFiniteTransformCount = 0;
    this.ragdollDiagnostics.changedBoneScaleCount = 0;
    this.ragdollBindings = [...this.reactionBones].map(([bodyId, bone]) => {
      const bodyEntry = this.actor.bodies.get(bodyId);
      if (!bodyEntry) return null;
      const translation = bodyEntry.body.translation();
      const rotation = bodyEntry.body.rotation();
      return {
        ...captureRotationOnlyRagdollBinding({
          bodyId,
          bone,
          bodyPosition: new THREE.Vector3(translation.x, translation.y, translation.z),
          bodyQuaternion: new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
        }),
        bodyEntry,
      };
    }).filter(Boolean).sort((a, b) => hierarchyDepth(a.bone) - hierarchyDepth(b.bone));
    return this.ragdollBindings.length > 0;
  }

  updateRagdoll() {
    if (!this.ragdollBindings.length || !this.scene) return;
    this.parent.updateMatrixWorld(true);
    for (const binding of this.ragdollBindings) {
      const translation = binding.bodyEntry.body.translation();
      const rotation = binding.bodyEntry.body.rotation();
      ragdollBodyPosition.set(translation.x, translation.y, translation.z);
      ragdollBodyQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w).normalize();
      applyRotationOnlyRagdollBinding(binding, ragdollBodyPosition, ragdollBodyQuaternion);
      if (binding.isTranslationRoot && this.ragdollDiagnostics.firstRagdollPelvisPosition == null) this.ragdollDiagnostics.firstRagdollPelvisPosition = ragdollBodyPosition.toArray();
      const localLengthError = binding.isTranslationRoot ? 0 : Math.abs(binding.bone.position.length() - binding.capturedLocalLength);
      this.ragdollDiagnostics.maximumParentChildBoneLengthError = Math.max(this.ragdollDiagnostics.maximumParentChildBoneLengthError, localLengthError);
      if (![...binding.bone.position.toArray(), ...binding.bone.quaternion.toArray(), ...binding.bone.scale.toArray()].every(Number.isFinite)) this.ragdollDiagnostics.nonFiniteTransformCount += 1;
      if (binding.bone.scale.distanceToSquared(binding.capturedLocalScale) > 1e-12) this.ragdollDiagnostics.changedBoneScaleCount += 1;
    }
    this.scene.updateMatrixWorld(true);
    this.skeletons.forEach((skeleton) => skeleton.update());
  }

  triggerPainReaction(contact) {
    return this.reactionController?.trigger?.(contact) ?? false;
  }

  setImpactMemory(memory) {
    this.reactionController?.setImpactMemory?.(memory);
  }

  setEmbeddedTension(contact) {
    this.reactionController?.setEmbeddedTension?.(contact);
  }

  releaseEmbeddedTension() {
    return this.reactionController?.releaseEmbeddedTension?.() ?? false;
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
    const normal = sourceNormal.clone();
    if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1);
    return { point: sourcePoint.clone(), normal: normal.normalize(), fallback: true, bodyId };
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

  getProximalJointWorldPosition(bodyId, target = new THREE.Vector3()) {
    const fit = this.profile.proxyFit?.[bodyId];
    const boneName = fit?.start ?? fit?.bone ?? this.profile.boneMap?.[bodyId];
    const bone = boneName ? this.bones.get(boneName) : null;
    return bone ? bone.getWorldPosition(target) : null;
  }

  reset() {
    if (this.profile.animationAuthoritative) {
      this.reactionController?.reset?.();
      this.locomotionController?.restoreAuthoredPose?.();
      this.ragdollBindings = [];
      this.ragdollDiagnostics = this.createRagdollDiagnostics();
      this.idlePlaybackScale = 1;
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
    const ragdollBonePositions = Object.fromEntries(['pelvis', 'upper_chest', 'head'].map((id) => [id, this.reactionBones.get(id)?.getWorldPosition(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(2))) ?? null]));
    return { path: this.profile.assetPath, profileName: this.profile.name, animationAuthoritative: this.profile.animationAuthoritative === true, loadCount: assetLoadCount, cacheKeys: [...cachedAssetPromises.keys()], skinnedMeshCount: this.skinnedMeshes.length, skeletonCount: this.skeletons.length, mappedBoneCount: this.profile.animationAuthoritative ? Object.keys(this.profile.boneMap).length : this.bindings.length, missingMappedBones: [], bindOffsetCount: this.bindings.length, ragdollBindingCount: this.ragdollBindings.length, ragdollBonePositions, ragdoll: { ...this.ragdollDiagnostics }, mixerCount: this.mixer ? 1 : 0, reactionControllerCount: this.reactionController ? 1 : 0, locomotionEnabled: Boolean(this.locomotionController), materialCloneCount: this.materialCloneCount, idleClip: this.idleAction?.getClip?.().name ?? null, rawMeasuredVisibleHeight: rawSize?.y ?? null, normalizedVisibleHeight: normalizedSize?.y ?? this.profile.targetHeight, normalizedVisibleMinY: this.normalizedVisibleBounds?.min.y ?? null, groundY: this.actor.visualRootPosition.y, groundClearance: this.profile.groundClearance ?? null, height: this.profile.targetHeight, scale: this.uniformScale ?? getHumanoidProfileScale(this.profile), scaleChangedBones, lighting: this.updateCharacterLightingDiagnostics(), reaction: this.reactionController?.getDiagnostics?.() ?? null };
  }

  get materialCloneCount() { return this.ownedMaterials.size; }

  getMaterialOpacitySnapshot() {
    const values = [];
    const seen = new Set();
    this.skinnedMeshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.filter(Boolean).forEach((material) => {
        if (seen.has(material)) return;
        seen.add(material);
        values.push(material.opacity);
      });
    });
    return values;
  }

  beginFade() {
    if (this.fadePrepared) return;
    this.fadePrepared = true;
    this.ownedMaterials.forEach((material) => {
      material.transparent = true;
      material.depthWrite = false;
      material.needsUpdate = true;
    });
  }

  setOpacity(opacity) {
    if (!this.isolateMaterials) return;
    this.beginFade();
    const value = THREE.MathUtils.clamp(Number(opacity) || 0, 0, 1);
    this.ownedMaterials.forEach((material) => { material.opacity = value; });
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
    this.idlePlaybackScale = 1;
    this.reactionController?.reset?.();
    this.reactionController = null;
    this.locomotionController?.bindBones?.(null);
    this.locomotionController = null;
    this.reactionBones.clear();
    this.mixerAuthoredScales.clear();
    this.bindings = [];
    this.ragdollBindings = [];
    this.ragdollDiagnostics = this.createRagdollDiagnostics();
    this.bones.clear();
    this.skinnedMeshes = [];
    this.skeletons = [];
    this.ownedMaterials.forEach((material) => material.dispose());
    this.ownedMaterials.clear();
    this.characterLightingPanel?.remove?.();
    this.characterLightingPanel = null;
  }
}
