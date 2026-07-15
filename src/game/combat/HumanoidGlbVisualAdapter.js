import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CURRENT_HUMANOID_BONE_MAP, CURRENT_HUMANOID_PROFILE, getHumanoidProfileScale } from './HumanoidModelProfiles.js';
import { HumanoidAnimationPackController } from './HumanoidAnimationPackController.js';
import { buildSkinnedTriangleInfluenceMetadata, findClosestSkinnedSurface, reconstructSkinnedSurface, reconstructSurfaceBindingNeighborhood, validateSurfaceBinding } from './SkinnedSurfaceBinding.js';
import { enableCombatReadabilityLightLayer } from './CombatReadabilityLightLayer.js';
import { FULLY_OPAQUE_THRESHOLD, applyFadeOpacity, captureAndPrepareFadeMaterials, clampFadeOpacity, restoreFadeMaterials } from './MaterialFadeState.js';
import { actorLocalToWorld as transformActorLocalToWorld, worldToActorLocal as transformWorldToActorLocal } from './CombatCoordinateSpaces.js';
import { HumanoidDamageSegmentRuntime } from './HumanoidDamageSegmentRuntime.js';

export const HUMANOID_GLB_PATH = CURRENT_HUMANOID_PROFILE.assetPath;
export const HUMANOID_GLB_AUTHORED_HEIGHT = CURRENT_HUMANOID_PROFILE.rawHeight;
export const HUMANOID_GLB_TARGET_HEIGHT = CURRENT_HUMANOID_PROFILE.targetHeight;
export const HUMANOID_GLB_SCALE = getHumanoidProfileScale(CURRENT_HUMANOID_PROFILE);
export const HUMANOID_GLB_BONE_MAP = CURRENT_HUMANOID_BONE_MAP;

const cachedAssetPromises = new Map();
const cachedAnimationManifestPromises = new Map();
const cachedDamageManifestPromises = new Map();
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

function loadCachedAnimationManifest(manifestPath) {
  if (!manifestPath) return Promise.resolve(null);
  if (!cachedAnimationManifestPromises.has(manifestPath)) {
    const promise = fetch(manifestPath).then((response) => {
      if (!response.ok) throw new Error(`Animation manifest request failed (${response.status}): ${manifestPath}`);
      return response.json();
    }).catch((error) => {
      cachedAnimationManifestPromises.delete(manifestPath);
      throw error;
    });
    cachedAnimationManifestPromises.set(manifestPath, promise);
  }
  return cachedAnimationManifestPromises.get(manifestPath);
}

function loadCachedDamageManifest(manifestPath) {
  if (!manifestPath) return Promise.resolve(null);
  if (!cachedDamageManifestPromises.has(manifestPath)) {
    const promise = fetch(manifestPath).then((response) => {
      if (!response.ok) throw new Error(`Damage manifest request failed (${response.status}): ${manifestPath}`);
      return response.json();
    }).catch((error) => {
      cachedDamageManifestPromises.delete(manifestPath);
      throw error;
    });
    cachedDamageManifestPromises.set(manifestPath, promise);
  }
  return cachedDamageManifestPromises.get(manifestPath);
}

export function resolveAnimationPackManifest(manifest, clips, profileName = 'humanoid-animation-pack') {
  if (!manifest || manifest.schema !== 'dreadstone.animation_pack.v1') throw new Error(`Humanoid GLB profile ${profileName} has an invalid animation manifest schema`);
  if (!Array.isArray(manifest.animations) || manifest.animations.length !== manifest.approved_animation_count) throw new Error(`Humanoid GLB profile ${profileName} has an invalid approved animation count`);
  const entriesByName = new Map();
  const entriesByKind = new Map();
  for (const entry of manifest.animations) {
    if (!entry?.name || !entry.approved_kind || entriesByName.has(entry.name)) throw new Error(`Humanoid GLB profile ${profileName} has invalid or duplicate animation metadata`);
    entriesByName.set(entry.name, entry);
    if (!entriesByKind.has(entry.approved_kind)) entriesByKind.set(entry.approved_kind, []);
    entriesByKind.get(entry.approved_kind).push(entry);
  }
  const clipsByName = new Map(clips.filter((clip) => clip?.name && clip.tracks?.length > 0).map((clip) => [clip.name, clip]));
  const missing = [...entriesByName.keys()].filter((name) => !clipsByName.has(name));
  if (missing.length) throw new Error(`Humanoid GLB profile ${profileName} is missing manifest animations: ${missing.join(', ')}`);
  return { entriesByName, entriesByKind, clipsByName };
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
    this.surfaceBindingMetadata = new Map();
    this.bones = new Map();
    this.bindings = [];
    this.ragdollBindings = [];
    this.ragdollDiagnostics = this.createRagdollDiagnostics();
    this.mixer = null;
    this.idleAction = null;
    this.animationManifest = null;
    this.damageManifest = null;
    this.damageSegmentRuntime = null;
    this.loadedClips = [];
    this.animationPack = null;
    this.animationController = null;
    this.animationBones = new Map();
    this.pendingHurt = null;
    this.pendingDeath = null;
    this.isolateMaterials = isolateMaterials === true;
    this.ownedMaterials = new Map();
    this.fadePrepared = false;
    this.fadeMaterialBaselines = new Map();
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
    const [asset, animationManifest, damageManifest] = await Promise.all([
      loadCachedAsset(this.profile.assetPath),
      loadCachedAnimationManifest(this.profile.animationManifestPath),
      loadCachedDamageManifest(this.profile.damageManifestPath),
    ]);
    if (this.disposed) return;
    if (animationManifest) {
      const expectedAssetName = this.profile.assetPath.split('/').pop();
      if (animationManifest.asset !== expectedAssetName) throw new Error(`Humanoid GLB profile ${this.profile.name} manifest targets ${animationManifest.asset}, expected ${expectedAssetName}`);
    }
    this.scene = clone(asset.scene);
    this.scene.name = 'humanoid-combat-glb-visual';
    this.scene.visible = damageManifest ? false : true;
    this.loadedClips = asset.animations ?? [];
    this.damageManifest = damageManifest;
    if (this.isolateMaterials) this.ownedMaterials = isolateObjectMaterials(this.scene);
    this.scene.traverse((object) => {
      if (object.isBone) this.bones.set(object.name, object);
      if (!object.isMesh) return;
      enableCombatReadabilityLightLayer(object);
      if (object.isSkinnedMesh) {
        this.skinnedMeshes.push(object);
        if (object.skeleton && !this.skeletons.includes(object.skeleton)) this.skeletons.push(object.skeleton);
      }
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
    this.skinnedMeshes.forEach((mesh) => {
      const metadata = buildSkinnedTriangleInfluenceMetadata(mesh, { boneMap: this.profile.boneMap });
      if (metadata) this.surfaceBindingMetadata.set(mesh, metadata);
    });
    this.applyCharacterLightingDiagnostic();
    if (!this.skinnedMeshes.length || !this.skeletons.length) throw new Error(`Humanoid GLB has no SkinnedMesh/skeleton: ${this.profile.assetPath}`);
    if (this.profile.animationAuthoritative) {
      this.initializeAnimationAuthoritative(asset.animations ?? [], animationManifest);
      if (damageManifest) {
        this.damageSegmentRuntime = new HumanoidDamageSegmentRuntime({
          actor: this.actor,
          adapter: this,
          loadedGlbRoot: this.scene,
          damageManifest,
          physicsWorld: this.actor.physics,
          hostScene: this.actor.scene,
        });
        this.scene.visible = true;
      }
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

  initializeAnimationAuthoritative(clips, animationManifest = null) {
    this.presentationRoot = new THREE.Group();
    this.presentationRoot.name = 'testman-animpack-v002-animation-authoritative-root';
    this.presentationRoot.add(this.scene);
    this.parent.add(this.presentationRoot);
    this.animationManifest = animationManifest;
    this.animationPack = animationManifest ? resolveAnimationPackManifest(animationManifest, clips, this.profile.name) : null;
    const baseEntry = this.animationPack?.entriesByKind.get('WALK')?.[0] ?? null;
    const idleClip = (baseEntry ? this.animationPack.clipsByName.get(baseEntry.name) : null)
      ?? clips.find((clip) => clip.name === this.profile.idleClipName && clip.tracks.length > 0)
      ?? clips.find((clip) => /idle/i.test(clip.name) && clip.tracks.length > 0)
      ?? clips.find((clip) => clip.tracks.length > 0);
    if (!idleClip) throw new Error(`Humanoid GLB profile ${this.profile.name} has no valid idle animation`);
    this.mixer = new THREE.AnimationMixer(this.scene);
    if (this.animationPack) {
      this.animationController = new HumanoidAnimationPackController({
        mixer: this.mixer,
        animationPack: this.animationPack,
        manifest: animationManifest,
        fadeSeconds: this.profile.animationFadeSeconds,
        walkReferenceSpeed: this.profile.walkReferenceSpeed,
      });
      this.idleAction = this.animationController.walkAction;
      if (this.pendingDeath) this.animationController.playDeath(this.pendingDeath);
      else if (this.pendingHurt) this.animationController.playHurt(this.pendingHurt);
      this.pendingDeath = null;
      this.pendingHurt = null;
    } else {
      this.idleAction = this.mixer.clipAction(idleClip);
      this.idleAction.setLoop(baseEntry?.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, baseEntry?.loop === false ? 1 : Infinity);
      this.idleAction.clampWhenFinished = baseEntry?.hold_final_pose === true;
      this.idleAction.play();
    }
    this.mixer.update(0);
    this.scene.updateMatrixWorld(true);
    this.skeletons.forEach((skeleton) => skeleton.update());
    this.rawVisibleBounds = measureVisibleSkinnedBounds(this.scene);
    const measuredHeight = this.rawVisibleBounds.getSize(new THREE.Vector3()).y;
    if (!(measuredHeight > 0)) throw new Error(`Humanoid GLB profile ${this.profile.name} has empty skinned bounds`);
    const rawHeightTolerance = Math.max(0.0001, this.profile.rawHeight * 0.00001);
    if (Math.abs(measuredHeight - this.profile.rawHeight) > rawHeightTolerance) {
      throw new Error(`Humanoid GLB profile ${this.profile.name} rawHeight ${this.profile.rawHeight} does not match loaded skinned height ${measuredHeight}`);
    }
    this.uniformScale = getHumanoidProfileScale(this.profile);
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
    this.resolveAnimationBones();
    this.actor.setAnimationAuthorityReady(this);
  }

  resolveAnimationBones() {
    this.animationBones.clear();
    const missing = [];
    Object.entries(this.profile.boneMap).forEach(([semanticId, boneName]) => {
      const bone = this.bones.get(boneName);
      if (bone) this.animationBones.set(semanticId, bone);
      else missing.push(`${semanticId} -> ${boneName}`);
    });
    if (missing.length) throw new Error(`Humanoid animation profile ${this.profile.name} is missing mapped bones: ${missing.join(', ')}`);
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
    // The approved pack is the only skeletal pose authority. Wounds and semantic
    // proxies sample the completed authored pose after the mixer advances.
    const dt = Math.max(0, deltaSeconds);
    if (this.animationController) this.animationController.update(dt);
    else this.mixer.update(dt);
    this.presentationRoot.updateMatrixWorld(true);
    this.skeletons.forEach((skeleton) => skeleton.update());
    this.damageSegmentRuntime?.captureAnimatedMotion?.(dt);
    this.actor.woundSystem?.update?.(dt);
    this.actor.syncAnimationProxyBodies(this);
    if (this.characterLightingPanel) this.updateCharacterLightingDiagnostics();
  }

  setMovementState(movement = {}) {
    return this.animationController?.setMovement?.(movement) ?? false;
  }

  playDeathAnimation(options = {}) {
    if (!this.animationController) {
      this.pendingDeath = { ...options };
      return null;
    }
    return this.animationController.playDeath(options);
  }

  setAuthoritativeTransform(position, yaw) {
    if (!this.presentationRoot || this.actor.ragdollActive) return;
    this.basePresentationPosition.copy(position);
    this.basePresentationYaw = Number.isFinite(yaw) ? yaw + this.profile.rootYaw : this.basePresentationYaw;
    this.presentationRoot.position.copy(this.basePresentationPosition);
    this.presentationRoot.rotation.set(0, this.basePresentationYaw, 0);
  }

  beginRagdoll() {
    // Ordinary hits never enter this path. The mixer remains authoritative until
    // the actor has explicitly transitioned into a terminal/collapse state.
    if (!this.scene || !this.presentationRoot || this.ragdollBindings.length) return this.ragdollBindings.length > 0;
    this.mixer.timeScale = 0;
    // Preserve the exact authored mixer pose until offsets have been captured
    // against the kinematic proxies for an explicitly forced ragdoll diagnostic.
    this.presentationRoot.updateMatrixWorld(true);
    this.scene.updateMatrixWorld(true);
    this.ragdollDiagnostics.activationCount += 1;
    this.ragdollDiagnostics.finalAnimatedPelvisPosition = this.animationBones.get('pelvis')?.getWorldPosition(new THREE.Vector3()).toArray() ?? null;
    this.ragdollDiagnostics.firstRagdollPelvisPosition = null;
    this.ragdollDiagnostics.maximumParentChildBoneLengthError = 0;
    this.ragdollDiagnostics.nonFiniteTransformCount = 0;
    this.ragdollDiagnostics.changedBoneScaleCount = 0;
    this.ragdollBindings = [...this.animationBones].map(([bodyId, bone]) => {
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
    const localHitX = contact?.hitWorldPosition && this.presentationRoot
      ? this.presentationRoot.worldToLocal(contact.hitWorldPosition.clone()).x
      : null;
    const options = { ...contact, localHitX };
    if (!this.animationController) {
      if (!this.pendingDeath) this.pendingHurt = options;
      return null;
    }
    return this.animationController.playHurt(options);
  }

  bindVisibleSurface(worldPoint, options = {}) {
    if (!this.scene || !this.skinnedMeshes.length) return null;
    this.prepareVisibleSurfaceFrame();
    return findClosestSkinnedSurface(this.skinnedMeshes, worldPoint, {
      ...options,
      triangleMetadataByMesh: options.triangleMetadataByMesh ?? this.surfaceBindingMetadata,
    });
  }

  prepareVisibleSurfaceFrame() {
    if (!this.scene) return false;
    // Complete the authored pose and every ancestor transform before sampling
    // skinned vertices. The surface binder and reconstructor both operate in world.
    this.presentationRoot?.updateMatrixWorld(true);
    this.scene.updateMatrixWorld(true);
    this.skinnedMeshes.forEach((mesh) => mesh.updateMatrixWorld(true));
    this.skeletons.forEach((skeleton) => skeleton.update());
    return true;
  }

  getActorCoordinateRoot() {
    return this.presentationRoot ?? this.scene;
  }

  actorLocalToWorld(actorLocalPoint, target = new THREE.Vector3()) {
    return transformActorLocalToWorld(this.getActorCoordinateRoot(), actorLocalPoint, target);
  }

  worldToActorLocal(worldPoint, target = new THREE.Vector3()) {
    return transformWorldToActorLocal(this.getActorCoordinateRoot(), worldPoint, target);
  }

  reconstructVisibleSurface(binding, target, { refresh = true } = {}) {
    if (!validateSurfaceBinding(binding) || !this.scene) return null;
    if (refresh) this.prepareVisibleSurfaceFrame();
    return reconstructSkinnedSurface(binding, target);
  }

  reconstructVisibleSurfaceNeighborhood(binding, target, { refresh = true } = {}) {
    if (!binding || !this.scene) return null;
    if (refresh) this.prepareVisibleSurfaceFrame();
    return reconstructSurfaceBindingNeighborhood(binding, target);
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
      const quaternion = startBone.getWorldQuaternion(new THREE.Quaternion());
      if (direction.lengthSq() > 1e-8) {
        // Preserve authored twist (including actor spawn yaw) while aligning the
        // proxy's local Y axis exactly to the current start/end bone segment.
        const authoredUp = proxyUp.clone().applyQuaternion(quaternion).normalize();
        const alignment = new THREE.Quaternion().setFromUnitVectors(authoredUp, direction.normalize());
        quaternion.premultiply(alignment).normalize();
      }
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

  requestDetachment(request) {
    return this.damageSegmentRuntime?.requestDetachment?.(request) ?? null;
  }

  getDetachmentWorldPoint(segmentId, target = new THREE.Vector3()) {
    return this.damageSegmentRuntime?.getSegmentWorldPoint?.(segmentId, target) ?? null;
  }

  updateDamageSegments() {
    this.damageSegmentRuntime?.updateAfterPhysics?.();
  }

  reset() {
    this.resetFade();
    if (this.profile.animationAuthoritative) {
      this.animationController?.reset?.();
      this.ragdollBindings = [];
      this.ragdollDiagnostics = this.createRagdollDiagnostics();
      this.mixer?.setTime(0);
      this.presentationRoot?.position.copy(this.basePresentationPosition);
      if (this.presentationRoot) this.presentationRoot.rotation.set(0, this.basePresentationYaw, 0);
      this.presentationRoot?.updateMatrixWorld(true);
      this.skeletons.forEach((skeleton) => skeleton.update());
      this.damageSegmentRuntime?.reset?.();
      this.actor.syncAnimationProxyBodies(this);
      return;
    }
    this.damageSegmentRuntime?.reset?.();
    this.update();
  }

  getDiagnostics() {
    const rawSize = this.rawVisibleBounds?.getSize(new THREE.Vector3());
    const normalizedSize = this.normalizedVisibleBounds?.getSize(new THREE.Vector3());
    const ragdollBonePositions = Object.fromEntries(['pelvis', 'upper_chest', 'head'].map((id) => [id, this.animationBones.get(id)?.getWorldPosition(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(2))) ?? null]));
    return {
      path: this.profile.assetPath,
      profileName: this.profile.name,
      animationAuthoritative: this.profile.animationAuthoritative === true,
      animationManifestPath: this.profile.animationManifestPath ?? null,
      damageManifestPath: this.profile.damageManifestPath ?? null,
      manifestAnimationCount: this.animationPack?.entriesByName.size ?? 0,
      manifestAnimationNames: [...(this.animationPack?.entriesByName.keys() ?? [])],
      loadCount: assetLoadCount,
      cacheKeys: [...cachedAssetPromises.keys()],
      skinnedMeshCount: this.skinnedMeshes.length,
      skeletonCount: this.skeletons.length,
      mappedBoneCount: this.profile.animationAuthoritative ? Object.keys(this.profile.boneMap).length : this.bindings.length,
      missingMappedBones: [],
      bindOffsetCount: this.bindings.length,
      ragdollBindingCount: this.ragdollBindings.length,
      ragdollBonePositions,
      ragdoll: { ...this.ragdollDiagnostics },
      mixerCount: this.mixer ? 1 : 0,
      materialCloneCount: this.materialCloneCount,
      idleClip: this.idleAction?.getClip?.().name ?? null,
      rawMeasuredVisibleHeight: rawSize?.y ?? null,
      normalizedVisibleHeight: normalizedSize?.y ?? this.profile.targetHeight,
      normalizedVisibleMinY: this.normalizedVisibleBounds?.min.y ?? null,
      groundY: this.actor.visualRootPosition.y,
      groundClearance: this.profile.groundClearance ?? null,
      height: this.profile.targetHeight,
      scale: this.uniformScale ?? getHumanoidProfileScale(this.profile),
      lighting: this.updateCharacterLightingDiagnostics(),
      animation: this.animationController?.getDiagnostics?.() ?? null,
      damageAsset: this.damageSegmentRuntime?.getDamageAssetDiagnostics?.() ?? null,
      dismemberment: this.damageSegmentRuntime?.getDiagnostics?.() ?? null,
    };
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
    if (!this.isolateMaterials || this.fadePrepared) return false;
    this.fadePrepared = true;
    captureAndPrepareFadeMaterials(this.ownedMaterials.values(), this.fadeMaterialBaselines);
    return true;
  }

  setFadeOpacity(opacity) {
    if (!this.isolateMaterials || !this.fadePrepared) return false;
    applyFadeOpacity(this.fadeMaterialBaselines, opacity);
    return true;
  }

  setOpacity(opacity) {
    if (!this.isolateMaterials) return false;
    const value = clampFadeOpacity(opacity);
    if (!this.fadePrepared && value >= FULLY_OPAQUE_THRESHOLD) return false;
    if (!this.fadePrepared) this.beginFade();
    return this.setFadeOpacity(value);
  }

  resetFade() {
    const restored = this.fadePrepared || this.fadeMaterialBaselines.size > 0;
    restoreFadeMaterials(this.fadeMaterialBaselines);
    this.fadePrepared = false;
    return restored;
  }

  dispose() {
    this.disposed = true;
    this.damageSegmentRuntime?.dispose?.();
    this.damageSegmentRuntime = null;
    this.idleAction?.stop();
    this.mixer?.stopAllAction();
    if (this.scene && this.mixer) this.mixer.uncacheRoot(this.scene);
    this.presentationRoot?.removeFromParent();
    this.scene?.removeFromParent();
    this.scene = null;
    this.presentationRoot = null;
    this.animationController?.dispose?.();
    this.animationController = null;
    this.mixer = null;
    this.idleAction = null;
    this.damageManifest = null;
    this.loadedClips = [];
    this.animationBones.clear();
    this.pendingHurt = null;
    this.pendingDeath = null;
    this.bindings = [];
    this.ragdollBindings = [];
    this.ragdollDiagnostics = this.createRagdollDiagnostics();
    this.bones.clear();
    this.skinnedMeshes = [];
    this.skeletons = [];
    this.surfaceBindingMetadata.clear();
    this.ownedMaterials.forEach((material) => material.dispose());
    this.ownedMaterials.clear();
    this.fadeMaterialBaselines.clear();
    this.characterLightingPanel?.remove?.();
    this.characterLightingPanel = null;
  }
}
