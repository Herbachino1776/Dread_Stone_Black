import * as THREE from 'three';
import { BLUNT_IMPACT_CLASSIFICATIONS } from './weapons/BluntImpactInteraction.js';

export const FORGE_DAMAGE_DEFORMATION_SCHEMA = 'dreadstone.damage_deformation.v1';
export const FORGE_PROGRESSIVE_DAMAGE_SITE_SCHEMA = 'dreadstone.progressive_damage_sites.v1';
export const FORGE_SURFACE_STAIN_BINDING_SCHEMA = 'dreadstone.surface_stain_binding.v1';

const HEAD_REGIONS = new Set(['head', 'face', 'skull']);
const BODY_REGIONS = new Set(['upper_chest', 'lower_chest', 'abdomen', 'pelvis']);
const VALID_GORE_ROLES = new Set(['ATTACHED', 'DETACHED', 'CORE']);
const QUALIFYING_PROGRESSIVE_IMPACTS = new Set([
  BLUNT_IMPACT_CLASSIFICATIONS.glancingBlunt,
  BLUNT_IMPACT_CLASSIFICATIONS.committedBlunt,
  BLUNT_IMPACT_CLASSIFICATIONS.heavySmash,
]);
const SIDE_EPSILON = 0.015;
const weightEpsilon = 1e-6;
export const FORGE_GORE_RENDER_ORDER = 6;
export const FORGE_SURFACE_STAIN_RENDER_ORDER = 5;

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

function containsMesh(object) {
  let found = object?.isMesh === true;
  object?.traverse?.((child) => { if (child.isMesh) found = true; });
  return found;
}

function parseJsonExtra(value, label, errors) {
  if (typeof value !== 'string' || !value) return null;
  try {
    return JSON.parse(value);
  } catch {
    errors.push(`${label} is not valid JSON`);
    return null;
  }
}

function resolveMorphBinding(object, morphName, label, errors) {
  const index = object?.morphTargetDictionary?.[morphName];
  if (!Number.isInteger(index) || !Array.isArray(object?.morphTargetInfluences) || index >= object.morphTargetInfluences.length) {
    errors.push(`${label} is missing morph ${morphName}`);
    return null;
  }
  return { object, index };
}

function approximatelyEqual(first, second, tolerance = 1e-6) {
  return Number.isFinite(first) && Number.isFinite(second) && Math.abs(first - second) <= tolerance;
}

function smoothstep01(value) {
  const clamped = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function resolveStageAnchor(site, stage) {
  const namedAnchor = Number(site?.severityAnchors?.[stage?.stage?.toLowerCase?.()]);
  const recommended = Number(stage?.recommendedSeverity);
  return Number.isFinite(namedAnchor) ? namedAnchor : recommended;
}

function setBindingWeight(binding, weight) {
  if (!binding) return 0;
  binding.object.morphTargetInfluences[binding.index] = weight;
  return binding.object.morphTargetInfluences[binding.index];
}

function readBindingWeight(binding) {
  return binding?.object?.morphTargetInfluences?.[binding.index] ?? 0;
}

function setGoreSubtreeVisible(node, visible) {
  node?.traverse?.((object) => { object.visible = visible; });
}

function prepareGoreSubtreePresentation(node) {
  let meshCount = 0;
  node?.traverse?.((object) => {
    if (!object.isMesh) return;
    meshCount += 1;
    object.frustumCulled = false;
    object.renderOrder = Math.max(object.renderOrder, FORGE_GORE_RENDER_ORDER);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material) return;
      material.polygonOffset = true;
      material.polygonOffsetFactor = -1;
      material.polygonOffsetUnits = -4;
      material.needsUpdate = true;
    });
  });
  return meshCount;
}

function prepareSurfaceStainPresentation(node) {
  let meshCount = 0;
  node?.traverse?.((object) => {
    if (!object.isMesh) return;
    meshCount += 1;
    object.frustumCulled = false;
    object.renderOrder = Math.max(object.renderOrder, FORGE_SURFACE_STAIN_RENDER_ORDER);
  });
  return meshCount;
}

function setStainEntryWeight(entry, weight) {
  return setBindingWeight(entry?.morphBinding, weight);
}

function finiteVector(value) {
  if (value?.isVector3 && value.toArray().every(Number.isFinite)) return value.clone();
  if (Array.isArray(value) && value.slice(0, 3).every(Number.isFinite)) return new THREE.Vector3().fromArray(value);
  if (value && [value.x, value.y, value.z].every(Number.isFinite)) return new THREE.Vector3(value.x, value.y, value.z);
  return null;
}

export function validateForgeDamageDeformationAsset({ manifest, root, progressiveDamageSiteFallbacks = [] } = {}) {
  const errors = [];
  const deformation = manifest?.deformations;
  const { objects, duplicates } = collectNamedObjects(root);
  if (!deformation || deformation.schema !== FORGE_DAMAGE_DEFORMATION_SCHEMA) errors.push(`invalid deformation schema ${deformation?.schema ?? 'missing'}`);
  if (!Array.isArray(deformation?.registeredRegions)) errors.push('registered deformation regions are missing');
  if (!Array.isArray(deformation?.generatedGoreMeshes)) errors.push('generated gore mesh records are missing');

  const regions = new Map();
  const keyRecords = new Map();
  for (const region of deformation?.registeredRegions ?? []) {
    if (!region?.regionId || regions.has(region.regionId)) {
      errors.push(`invalid or duplicate deformation region ${region?.regionId ?? 'missing'}`);
      continue;
    }
    const targetObject = objects.get(region.targetObject);
    if (!targetObject?.isMesh) errors.push(`${region.regionId} target ${region.targetObject ?? 'missing'} is not a mesh`);
    if (duplicates.has(region.targetObject)) errors.push(`${region.regionId} target ${region.targetObject} is duplicated`);
    if (targetObject?.userData?.dsb_deformation_region !== region.regionId) errors.push(`${region.targetObject} exported region extra does not match ${region.regionId}`);
    const registry = parseJsonExtra(targetObject?.userData?.dsb_deformation_region_registry_json, `${region.targetObject} region registry`, errors);
    const exportedRegion = registry?.regions?.find?.((entry) => entry?.regionId === region.regionId);
    if (!exportedRegion || exportedRegion.targetObject !== region.targetObject) errors.push(`${region.targetObject} exported registry is missing ${region.regionId}`);

    const detachedObject = region.detachedObject ? objects.get(region.detachedObject) : null;
    if (region.regionMode === 'PAIRED_SEGMENT' && !detachedObject?.isMesh) errors.push(`${region.regionId} detached target ${region.detachedObject ?? 'missing'} is not a mesh`);
    const regionRecord = {
      ...region,
      targetObject,
      detachedObject,
      keys: [],
    };
    regions.set(region.regionId, regionRecord);

    for (const key of region.keys ?? []) {
      if (!key?.name || keyRecords.has(key.name)) {
        errors.push(`invalid or duplicate deformation key ${key?.name ?? 'missing'}`);
        continue;
      }
      if (key.targetObject !== region.targetObject || key.regionId !== region.regionId) errors.push(`${key.name} target metadata does not match its region`);
      if (!exportedRegion?.managedKeys?.includes?.(key.name)) errors.push(`${region.targetObject} exported registry does not manage ${key.name}`);
      const targetMorph = resolveMorphBinding(targetObject, key.name, region.targetObject, errors);
      const detachedMorph = region.regionMode === 'PAIRED_SEGMENT'
        ? resolveMorphBinding(detachedObject, key.name, region.detachedObject, errors)
        : null;
      const record = {
        name: key.name,
        regionId: region.regionId,
        regionMode: region.regionMode,
        relatedSeamId: region.relatedSeamId ?? null,
        targetObject,
        detachedObject,
        targetMorph,
        detachedMorph,
        maximumInfluence: Math.max(0, Number(key.maximumInfluence) || 1),
        activationWeight: Math.max(0, Number(key.goreActivationContract?.activationWeight ?? key.goreActivationWeight) || 0),
        stampCenterX: Number(key.orderedStamps?.[0]?.center?.[0]),
        goreByRole: new Map(),
        stainByRole: new Map(),
        manifest: key,
      };
      regionRecord.keys.push(record);
      keyRecords.set(key.name, record);
    }
  }

  const goreNodes = [];
  for (const gore of deformation?.generatedGoreMeshes ?? []) {
    const keyRecord = keyRecords.get(gore?.deformationKey);
    const node = objects.get(gore?.nodeName);
    const role = gore?.ownershipRole ?? gore?.attachedDetachedRole;
    if (!keyRecord) errors.push(`${gore?.nodeName ?? 'gore node'} references unknown deformation ${gore?.deformationKey ?? 'missing'}`);
    if (!node || !containsMesh(node)) errors.push(`gore node ${gore?.nodeName ?? 'missing'} has no renderable mesh`);
    if (duplicates.has(gore?.nodeName)) errors.push(`gore node ${gore.nodeName} is duplicated`);
    if (!VALID_GORE_ROLES.has(role)) errors.push(`gore node ${gore?.nodeName ?? 'missing'} has invalid ownership ${role ?? 'missing'}`);
    const extras = node?.userData ?? {};
    if (extras.dsb_gore_owned !== true || extras.dsb_generated_role !== 'raised_gore') errors.push(`${gore?.nodeName ?? 'gore node'} is missing exported gore ownership extras`);
    if (extras.dsb_gore_mesh_id !== gore?.meshId) errors.push(`${gore?.nodeName ?? 'gore node'} mesh id extra does not match manifest`);
    if (extras.dsb_gore_region_id !== gore?.regionId || extras.dsb_gore_deformation_key !== gore?.deformationKey) errors.push(`${gore?.nodeName ?? 'gore node'} deformation extras do not match manifest`);
    if (extras.dsb_gore_pair_role !== role || extras.dsb_gore_source_object !== gore?.sourceObject) errors.push(`${gore?.nodeName ?? 'gore node'} ownership extras do not match manifest`);
    if (extras.dsb_gore_default_visible !== false || gore?.defaultVisible !== false) errors.push(`${gore?.nodeName ?? 'gore node'} must default hidden`);
    if (!approximatelyEqual(Number(extras.dsb_gore_activation_weight), Number(gore?.activationWeight))) errors.push(`${gore?.nodeName ?? 'gore node'} activation threshold extra does not match manifest`);
    if (keyRecord && node && VALID_GORE_ROLES.has(role)) {
      if (gore.regionId !== keyRecord.regionId || !keyRecord.manifest.goreGeneratedNodeNames?.includes?.(gore.nodeName)) errors.push(`${gore.nodeName} is not registered by ${keyRecord.name}`);
      if (!keyRecord.goreByRole.has(role)) keyRecord.goreByRole.set(role, []);
      keyRecord.goreByRole.get(role).push(node);
      keyRecord.activationWeight = Math.max(keyRecord.activationWeight, Number(gore.activationWeight) || 0);
      goreNodes.push({ ...gore, role, node, keyRecord });
    }
  }

  for (const record of keyRecords.values()) {
    const expectedGoreNames = new Set(record.manifest.goreGeneratedNodeNames ?? []);
    const expectedRoles = record.regionMode === 'PAIRED_SEGMENT' ? ['ATTACHED', 'DETACHED'] : ['CORE'];
    if (expectedGoreNames.size) expectedRoles.forEach((role) => {
      if ((record.goreByRole.get(role)?.length ?? 0) < 1) errors.push(`${record.name} requires at least one ${role} gore node`);
    });
    const resolvedGoreNames = new Set([...record.goreByRole.values()].flat().map((node) => node.name));
    if (expectedGoreNames.size !== resolvedGoreNames.size || [...expectedGoreNames].some((name) => !resolvedGoreNames.has(name))) {
      errors.push(`${record.name} resolved gore nodes do not match its manifest binding`);
    }
  }

  const surfaceStainNodes = [];
  const surfaceStainMeshes = deformation?.surfaceStainMeshes ?? [];
  if (!Array.isArray(surfaceStainMeshes)) errors.push('surface stain mesh records are invalid');
  if (surfaceStainMeshes.length && deformation?.surfaceStainBindingSchema !== FORGE_SURFACE_STAIN_BINDING_SCHEMA) {
    errors.push(`invalid surface stain binding schema ${deformation?.surfaceStainBindingSchema ?? 'missing'}`);
  }
  for (const stain of Array.isArray(surfaceStainMeshes) ? surfaceStainMeshes : []) {
    const keyRecord = keyRecords.get(stain?.deformationKey);
    const node = objects.get(stain?.nodeName);
    const role = stain?.ownershipRole;
    if (stain?.schema !== FORGE_SURFACE_STAIN_BINDING_SCHEMA) errors.push(`${stain?.nodeName ?? 'surface stain'} has invalid binding schema`);
    if (!keyRecord) errors.push(`${stain?.nodeName ?? 'surface stain'} references unknown deformation ${stain?.deformationKey ?? 'missing'}`);
    if (!node?.isMesh) errors.push(`surface stain node ${stain?.nodeName ?? 'missing'} is not a mesh`);
    if (duplicates.has(stain?.nodeName)) errors.push(`surface stain node ${stain.nodeName} is duplicated`);
    if (!VALID_GORE_ROLES.has(role)) errors.push(`surface stain node ${stain?.nodeName ?? 'missing'} has invalid ownership ${role ?? 'missing'}`);
    const extras = node?.userData ?? {};
    if (extras.dsb_stain_owned !== true || extras.dsb_generated_role !== 'surface_stain_export') errors.push(`${stain?.nodeName ?? 'surface stain'} is missing exported stain ownership extras`);
    if (extras.dsb_stain_binding_schema !== FORGE_SURFACE_STAIN_BINDING_SCHEMA) errors.push(`${stain?.nodeName ?? 'surface stain'} has mismatched exported binding schema`);
    if (extras.dsb_stain_mesh_id !== stain?.meshId) errors.push(`${stain?.nodeName ?? 'surface stain'} mesh id extra does not match manifest`);
    if (extras.dsb_stain_region_id !== stain?.regionId || extras.dsb_stain_deformation_key !== stain?.deformationKey) errors.push(`${stain?.nodeName ?? 'surface stain'} deformation extras do not match manifest`);
    if (extras.dsb_stain_pair_role !== role || extras.dsb_stain_source_object !== stain?.sourceObject) errors.push(`${stain?.nodeName ?? 'surface stain'} ownership extras do not match manifest`);
    if (extras.dsb_stain_default_visible !== false || stain?.defaultVisible !== false) errors.push(`${stain?.nodeName ?? 'surface stain'} must default hidden`);
    if (!approximatelyEqual(Number(extras.dsb_stain_activation_weight), Number(stain?.activationWeight))) errors.push(`${stain?.nodeName ?? 'surface stain'} activation threshold extra does not match manifest`);
    if (stain?.portableArtifactIncluded !== true || extras.dsb_stain_portable_artifact_included !== true) errors.push(`${stain?.nodeName ?? 'surface stain'} has no portable artifact`);
    if (stain?.portableRepresentation !== 'VERTEX_COLOR_RGBA' || stain?.attributeSemantic !== 'COLOR_0') errors.push(`${stain?.nodeName ?? 'surface stain'} has unsupported portable representation`);
    if (stain?.morphWeightSource !== 'MATCHING_DEFORMATION_KEY_WEIGHT' || stain?.morphTarget !== stain?.deformationKey) errors.push(`${stain?.nodeName ?? 'surface stain'} has unsupported morph binding`);
    if (!node?.geometry?.getAttribute?.('color') || node.geometry.getAttribute('color').itemSize !== 4) errors.push(`${stain?.nodeName ?? 'surface stain'} is missing COLOR_0 RGBA`);
    const nodeMaterials = (Array.isArray(node?.material) ? node.material : [node?.material]).filter(Boolean);
    if (!nodeMaterials.some((material) => material.name === stain?.materialName)) errors.push(`${stain?.nodeName ?? 'surface stain'} is missing material ${stain?.materialName ?? 'binding'}`);
    if (!nodeMaterials.every((material) => material.transparent === true && material.vertexColors === true)) errors.push(`${stain?.nodeName ?? 'surface stain'} material is not a vertex-color alpha blend`);
    const morphBinding = node ? resolveMorphBinding(node, stain?.morphTarget, stain?.nodeName ?? 'surface stain', errors) : null;
    if (keyRecord && node && morphBinding && VALID_GORE_ROLES.has(role)) {
      const expectedNames = keyRecord.manifest.surfaceStainBindings?.map?.((binding) => binding.nodeName) ?? [];
      if (stain.regionId !== keyRecord.regionId || !expectedNames.includes(stain.nodeName)) errors.push(`${stain.nodeName} is not registered by ${keyRecord.name}`);
      if (!keyRecord.stainByRole.has(role)) keyRecord.stainByRole.set(role, []);
      const entry = { ...stain, role, node, keyRecord, morphBinding };
      keyRecord.stainByRole.get(role).push(entry);
      keyRecord.activationWeight = Math.max(keyRecord.activationWeight, Number(stain.activationWeight) || 0);
      surfaceStainNodes.push(entry);
    }
  }

  for (const record of keyRecords.values()) {
    const expectsSurfaceStain = record.manifest.goreOverlayMode?.includes?.('STAIN')
      || (record.manifest.surfaceStainBindings?.length ?? 0) > 0;
    if (!expectsSurfaceStain) continue;
    const expectedRoles = record.regionMode === 'PAIRED_SEGMENT' ? ['ATTACHED', 'DETACHED'] : ['CORE'];
    expectedRoles.forEach((role) => {
      if ((record.stainByRole.get(role)?.length ?? 0) < 1) errors.push(`${record.name} requires at least one ${role} surface stain node`);
    });
    const expectedStainNames = new Set(record.manifest.surfaceStainBindings?.map?.((binding) => binding.nodeName) ?? []);
    const resolvedStainNames = new Set([...record.stainByRole.values()].flat().map((entry) => entry.node.name));
    if (expectedStainNames.size !== resolvedStainNames.size || [...expectedStainNames].some((name) => !resolvedStainNames.has(name))) {
      errors.push(`${record.name} resolved surface stain nodes do not match its manifest binding`);
    }
  }

  const progressiveSites = new Map();
  const progressiveStageByKey = new Map();
  const manifestProgressiveSites = Array.isArray(deformation?.progressiveDamageSites) ? deformation.progressiveDamageSites : [];
  const fallbackProgressiveSites = Array.isArray(progressiveDamageSiteFallbacks) ? progressiveDamageSiteFallbacks : [];
  const siteSide = (site) => {
    const stageName = site?.stageOrder?.[0];
    const stage = site?.stages?.find?.((entry) => entry.stage === stageName);
    const x = Number(stage?.measurements?.captureCenterLocal?.[0] ?? site?.anchorLocal?.[0]);
    return Math.abs(x) <= SIDE_EPSILON ? 0 : Math.sign(x);
  };
  const manifestSides = new Set(manifestProgressiveSites.map(siteSide));
  const compatibleFallbackSites = fallbackProgressiveSites.filter((site) => !manifestSides.has(siteSide(site)));
  const nativeProgressiveSiteIds = new Set(manifestProgressiveSites.map((site) => site.siteId));
  const authoredProgressiveSites = [...manifestProgressiveSites, ...compatibleFallbackSites];
  const progressiveSiteSource = manifestProgressiveSites.length && compatibleFallbackSites.length
    ? 'manifest+profile-compatibility'
    : manifestProgressiveSites.length ? 'manifest' : compatibleFallbackSites.length ? 'profile-fallback' : 'none';
  if (authoredProgressiveSites.length && deformation?.progressiveDamageSiteSchema !== FORGE_PROGRESSIVE_DAMAGE_SITE_SCHEMA) {
    errors.push(`invalid progressive damage site schema ${deformation.progressiveDamageSiteSchema ?? 'missing'}`);
  }
  for (const site of authoredProgressiveSites) {
    if (site?.schema !== FORGE_PROGRESSIVE_DAMAGE_SITE_SCHEMA || !site.siteId || progressiveSites.has(site.siteId)) {
      errors.push(`invalid or duplicate progressive damage site ${site?.siteId ?? 'missing'}`);
      continue;
    }
    if (!Array.isArray(site.stageOrder) || !site.stageOrder.length || !Array.isArray(site.stages)) {
      errors.push(`${site.siteId} is missing its stage order or stage records`);
      continue;
    }
    const stagesByName = new Map(site.stages.map((stage) => [stage?.stage, stage]));
    const stageRecords = [];
    let previousAnchor = 0;
    for (const stageName of site.stageOrder) {
      const stage = stagesByName.get(stageName);
      const keyRecord = keyRecords.get(stage?.deformationKeyName);
      const anchor = resolveStageAnchor(site, stage);
      if (!stage || !stage.stageId || !keyRecord) errors.push(`${site.siteId} stage ${stageName} has no valid manifest deformation binding`);
      if (!(anchor > previousAnchor && anchor <= 1)) errors.push(`${site.siteId} stage ${stageName} has invalid severity anchor ${anchor}`);
      if (stage?.regionId !== site.regionId || keyRecord?.regionId !== site.regionId) errors.push(`${site.siteId} stage ${stageName} region does not match ${site.regionId}`);
      if (stage?.targetObject !== keyRecord?.manifest?.targetObject || stage?.detachedObject !== keyRecord?.manifest?.detachedObject) {
        errors.push(`${site.siteId} stage ${stageName} object binding does not match deformation ${stage?.deformationKeyName ?? 'missing'}`);
      }
      if (keyRecord && progressiveStageByKey.has(keyRecord.name)) errors.push(`${keyRecord.name} is assigned to multiple progressive damage stages`);
      if (keyRecord) {
        const record = { ...stage, anchor, keyRecord };
        stageRecords.push(record);
        progressiveStageByKey.set(keyRecord.name, { siteId: site.siteId, stage: record });
      }
      previousAnchor = anchor;
    }
    if (stageRecords.length !== site.stageOrder.length) errors.push(`${site.siteId} did not resolve every stage in manifest order`);
    progressiveSites.set(site.siteId, {
      ...site,
      authority: nativeProgressiveSiteIds.has(site.siteId) ? 'NATIVE' : 'COMPATIBILITY',
      stageRecords,
    });
  }
  if (errors.length) throw new Error(`Forge damage deformation asset failed validation: ${errors.join('; ')}`);
  return {
    deformation,
    objects,
    regions,
    keyRecords,
    goreNodes,
    surfaceStainNodes,
    progressiveSites,
    progressiveStageByKey,
    progressiveSiteSource,
  };
}

export class ForgeDamageDeformationRuntime {
  constructor({ actor, adapter, segmentRuntime, root, manifest, progressiveDamageSiteFallbacks = [], progressiveDamageHitsPerStage = 1 } = {}) {
    this.actor = actor;
    this.adapter = adapter;
    this.segmentRuntime = segmentRuntime;
    this.root = root;
    this.manifest = manifest;
    this.validation = validateForgeDamageDeformationAsset({ manifest, root, progressiveDamageSiteFallbacks });
    this.keyRecords = this.validation.keyRecords;
    this.goreNodes = this.validation.goreNodes;
    this.surfaceStainNodes = this.validation.surfaceStainNodes;
    this.progressiveSites = this.validation.progressiveSites;
    this.progressiveStageByKey = this.validation.progressiveStageByKey;
    this.progressiveState = new Map();
    this.progressiveDamageHitsPerStage = Math.max(1, Math.trunc(Number(progressiveDamageHitsPerStage) || 1));
    this.acceptedProgressiveInteractionIds = new Set();
    this.lastActivation = null;
    this.activationCount = 0;
    this.disposed = false;
    this.parentDetachedPresentationToOwnedSegments();
    this.gorePresentationMeshCount = this.goreNodes.reduce((count, { node }) => count + prepareGoreSubtreePresentation(node), 0);
    this.surfaceStainPresentationMeshCount = this.surfaceStainNodes.reduce((count, { node }) => count + prepareSurfaceStainPresentation(node), 0);
    this.reset();
  }

  parentDetachedPresentationToOwnedSegments() {
    this.root.updateMatrixWorld(true);
    [...this.goreNodes, ...this.surfaceStainNodes].filter((entry) => entry.role === 'DETACHED').forEach((entry) => {
      const owner = this.validation.objects.get(entry.sourceObject);
      if (owner && entry.node.parent !== owner) owner.attach(entry.node);
    });
    this.root.updateMatrixWorld(true);
  }

  reset() {
    this.keyRecords.forEach((record) => {
      setBindingWeight(record.targetMorph, 0);
      setBindingWeight(record.detachedMorph, 0);
    });
    this.goreNodes.forEach(({ node }) => setGoreSubtreeVisible(node, false));
    this.surfaceStainNodes.forEach((entry) => {
      setStainEntryWeight(entry, 0);
      setGoreSubtreeVisible(entry.node, false);
    });
    this.progressiveState.clear();
    this.progressiveSites.forEach((site, siteId) => {
      this.progressiveState.set(siteId, {
        severity: 0,
        stageIndex: -1,
        currentStage: null,
        goreStage: null,
        activationCount: 0,
        acceptedHitCount: 0,
        stageWeights: Object.fromEntries(site.stageOrder.map((stageName) => [stageName, 0])),
      });
    });
    this.lastActivation = null;
    this.activationCount = 0;
    this.acceptedProgressiveInteractionIds.clear();
    return this.getDiagnostics();
  }

  getActorLocalPoint(hit, impact) {
    const worldPoint = finiteVector(impact?.worldPoint) ?? finiteVector(hit?.collisionPointWorld);
    if (worldPoint && this.adapter?.worldToActorLocal) return this.adapter.worldToActorLocal(worldPoint, new THREE.Vector3());
    const coordinateRoot = this.adapter?.getActorCoordinateRoot?.() ?? this.adapter?.presentationRoot ?? this.root;
    if (worldPoint && coordinateRoot?.worldToLocal) return coordinateRoot.worldToLocal(worldPoint);
    return finiteVector(hit?.localPoint) ?? new THREE.Vector3();
  }

  getActorLocalDirection(impact) {
    const direction = finiteVector(impact?.impactDirection) ?? new THREE.Vector3();
    if (direction.lengthSq() <= 1e-8) return direction;
    if (this.adapter?.worldDirectionToActorLocal) return this.adapter.worldDirectionToActorLocal(direction, new THREE.Vector3());
    const coordinateRoot = this.adapter?.getActorCoordinateRoot?.() ?? this.adapter?.presentationRoot ?? this.root;
    const quaternion = coordinateRoot?.getWorldQuaternion?.(new THREE.Quaternion())?.invert?.();
    return quaternion ? direction.applyQuaternion(quaternion).normalize() : direction.normalize();
  }

  getSiteCenterX(site) {
    const keyCenters = site.stageRecords.map(({ keyRecord }) => keyRecord.stampCenterX).filter(Number.isFinite);
    if (keyCenters.length) return keyCenters.reduce((total, value) => total + value, 0) / keyCenters.length;
    const anchorX = Number(site.anchorLocal?.[0]);
    return Number.isFinite(anchorX) ? anchorX : 0;
  }

  resolveHitSideX(localPoint, localDirection) {
    let sideX = localPoint.x;
    if (Math.abs(sideX) <= SIDE_EPSILON && Math.abs(localDirection.x) > SIDE_EPSILON) sideX = -localDirection.x;
    return sideX;
  }

  siteMatchesHitRegion(site, hitRegion) {
    if (!hitRegion) return false;
    if (site.regionId === hitRegion || site.structuralGroup === hitRegion) return true;
    if (HEAD_REGIONS.has(hitRegion)) return site.regionId === 'head'
      || site.structuralGroup === 'head'
      || (site.regionId === 'body_core' && /face|head/i.test(`${site.displayName ?? ''} ${site.siteId ?? ''}`));
    if (BODY_REGIONS.has(hitRegion)) return site.regionId === 'body_core' || site.structuralGroup === 'body';
    if (hitRegion === 'left_forearm') return site.regionId === 'forearm_left';
    if (hitRegion === 'right_forearm') return site.regionId === 'forearm_right';
    return false;
  }

  selectProgressiveSite(localPoint, localDirection, hitRegion) {
    const sideX = this.resolveHitSideX(localPoint, localDirection);
    const candidates = [...this.progressiveSites.values()].filter((site) => this.siteMatchesHitRegion(site, hitRegion));
    const sideCompatible = candidates.filter((site) => {
      const centerX = this.getSiteCenterX(site);
      return Math.abs(sideX) <= SIDE_EPSILON || Math.abs(centerX) <= SIDE_EPSILON || Math.sign(sideX) === Math.sign(centerX);
    });
    const available = sideCompatible.length ? sideCompatible : (Math.abs(sideX) <= SIDE_EPSILON ? candidates : []);
    if (!available.length) return null;
    return available.sort((first, second) => Math.abs(sideX - this.getSiteCenterX(first)) - Math.abs(sideX - this.getSiteCenterX(second)))[0];
  }

  selectRegionFallback(localPoint, localDirection, hitRegion) {
    const candidateRegions = HEAD_REGIONS.has(hitRegion)
      ? ['head']
      : BODY_REGIONS.has(hitRegion)
        ? ['body_core', 'body']
        : [hitRegion];
    const records = [...this.keyRecords.values()].filter((record) => candidateRegions.includes(record.regionId) && !this.progressiveStageByKey.has(record.name));
    if (!records.length) return null;
    const sideX = this.resolveHitSideX(localPoint, localDirection);
    if (Math.abs(sideX) <= SIDE_EPSILON) return records[0];
    const withCenters = records.filter((record) => Number.isFinite(record.stampCenterX));
    if (withCenters.length) {
      return withCenters.sort((first, second) => Math.abs(sideX - first.stampCenterX) - Math.abs(sideX - second.stampCenterX))[0];
    }
    return records[0];
  }

  selectMaceDamage({ hit, impact } = {}) {
    if (impact?.primitive !== 'mace_head') return null;
    const localPoint = this.getActorLocalPoint(hit, impact);
    const localDirection = this.getActorLocalDirection(impact);
    const site = this.selectProgressiveSite(localPoint, localDirection, hit?.regionId);
    if (site) {
      const centerX = this.getSiteCenterX(site);
      const hitSide = centerX < -SIDE_EPSILON ? 'left' : centerX > SIDE_EPSILON ? 'right' : 'center';
      return { site, record: null, hitRegion: hit.regionId, hitSide, localPoint, localDirection };
    }
    const record = this.selectRegionFallback(localPoint, localDirection, hit?.regionId);
    if (!record) return null;
    const hitSide = record.stampCenterX < -SIDE_EPSILON ? 'left' : record.stampCenterX > SIDE_EPSILON ? 'right' : 'center';
    return { site: null, record, hitRegion: hit.regionId, hitSide, localPoint, localDirection };
  }

  getOwnershipRole(record) {
    if (record.regionMode === 'CORE_SINGLE') return 'CORE';
    return this.segmentRuntime?.detachedSegments?.has?.(record.relatedSeamId) ? 'DETACHED' : 'ATTACHED';
  }

  hideRegionGore(regionId) {
    this.goreNodes.forEach((entry) => {
      if (entry.regionId === regionId) setGoreSubtreeVisible(entry.node, false);
    });
  }

  hideRegionSurfaceStains(regionId) {
    this.surfaceStainNodes.forEach((entry) => {
      if (entry.regionId === regionId) setGoreSubtreeVisible(entry.node, false);
    });
  }

  hideProgressiveSiteGore(site) {
    site?.stageRecords?.forEach(({ keyRecord }) => {
      keyRecord.goreByRole.forEach((nodes) => nodes.forEach((node) => setGoreSubtreeVisible(node, false)));
    });
  }

  hideProgressiveSiteSurfaceStains(site) {
    site?.stageRecords?.forEach(({ keyRecord }) => {
      keyRecord.stainByRole.forEach((entries) => entries.forEach((entry) => setGoreSubtreeVisible(entry.node, false)));
    });
  }

  resolveProgressiveSite(siteId = null) {
    if (siteId && this.progressiveSites.has(siteId)) return this.progressiveSites.get(siteId);
    if (!siteId && this.progressiveSites.size === 1) return this.progressiveSites.values().next().value;
    return null;
  }

  listProgressiveDamageSites() {
    return [...this.progressiveSites.values()].map((site) => {
      const firstStage = site.stageRecords[0];
      const captureCenterLocal = firstStage?.measurements?.captureCenterLocal ?? site.anchorLocal ?? null;
      return {
        siteId: site.siteId,
        displayName: site.displayName ?? site.siteId,
        authority: site.authority,
        regionId: site.regionId,
        structuralGroup: site.structuralGroup,
        stageOrder: [...site.stageOrder],
        captureCenterLocal: Array.isArray(captureCenterLocal) ? [...captureCenterLocal] : null,
        preferredDirectionLocal: Array.isArray(site.preferredDirectionLocal) ? [...site.preferredDirectionLocal] : null,
      };
    });
  }

  resetProgressiveDamageSite(siteId) {
    const site = this.resolveProgressiveSite(siteId);
    if (!site) return { applied: false, reason: 'unknown-site', siteId: siteId ?? null };
    const result = this.setProgressiveSiteSeverity(site.siteId, 0, {
      source: 'progressive_site_reset',
      hitRegion: site.regionId,
      hitSide: 'manual',
    });
    const state = this.progressiveState.get(site.siteId);
    if (state) {
      state.acceptedHitCount = 0;
      state.activationCount = 0;
    }
    return { ...result, reset: result.applied === true };
  }

  calculateProgressiveWeights(site, severity) {
    const clampedSeverity = THREE.MathUtils.clamp(Number(severity) || 0, 0, 1);
    const weights = site.stageRecords.map(() => 0);
    if (clampedSeverity <= 0 || !site.stageRecords.length) return { severity: clampedSeverity, weights, goreStageIndex: -1 };
    const first = site.stageRecords[0];
    if (clampedSeverity <= first.anchor) {
      weights[0] = smoothstep01(clampedSeverity / first.anchor);
      return { severity: clampedSeverity, weights, goreStageIndex: weights[0] + weightEpsilon >= first.keyRecord.activationWeight ? 0 : -1 };
    }
    for (let index = 1; index < site.stageRecords.length; index += 1) {
      const lower = site.stageRecords[index - 1];
      const upper = site.stageRecords[index];
      if (clampedSeverity > upper.anchor && index < site.stageRecords.length - 1) continue;
      const blend = smoothstep01((clampedSeverity - lower.anchor) / (upper.anchor - lower.anchor));
      weights[index - 1] = 1 - blend;
      weights[index] = blend;
      return { severity: clampedSeverity, weights, goreStageIndex: blend < 0.5 ? index - 1 : index };
    }
    weights[weights.length - 1] = 1;
    return { severity: clampedSeverity, weights, goreStageIndex: weights.length - 1 };
  }

  setProgressiveSiteSeverity(siteId, severity, { hitRegion = 'manual', hitSide = 'manual', source = 'progressive_damage' } = {}) {
    const site = this.resolveProgressiveSite(siteId);
    if (!site || this.disposed) return { applied: false, reason: 'unknown-site-or-disposed', siteId: siteId ?? null };
    const blend = this.calculateProgressiveWeights(site, severity);
    site.stageRecords.forEach(({ keyRecord }, index) => {
      setBindingWeight(keyRecord.targetMorph, blend.weights[index]);
      setBindingWeight(keyRecord.detachedMorph, blend.weights[index]);
      keyRecord.stainByRole.forEach((entries) => entries.forEach((entry) => setStainEntryWeight(entry, blend.weights[index])));
    });
    this.hideProgressiveSiteGore(site);
    this.hideProgressiveSiteSurfaceStains(site);
    const goreStage = blend.goreStageIndex >= 0 ? site.stageRecords[blend.goreStageIndex] : null;
    const ownershipRole = goreStage ? this.getOwnershipRole(goreStage.keyRecord) : null;
    const activatedGoreNodes = goreStage ? [...(goreStage.keyRecord.goreByRole.get(ownershipRole) ?? [])] : [];
    activatedGoreNodes.forEach((node) => setGoreSubtreeVisible(node, true));
    const activatedSurfaceStainNodes = [];
    site.stageRecords.forEach(({ keyRecord }, index) => {
      const role = this.getOwnershipRole(keyRecord);
      (keyRecord.stainByRole.get(role) ?? []).forEach((entry) => {
        if (blend.weights[index] + weightEpsilon < entry.activationWeight) return;
        setGoreSubtreeVisible(entry.node, true);
        activatedSurfaceStainNodes.push(entry.node);
      });
    });
    let exactStageIndex = -1;
    site.stageRecords.forEach((stage, index) => {
      if (blend.severity + weightEpsilon >= stage.anchor) exactStageIndex = index;
    });
    const state = this.progressiveState.get(site.siteId);
    state.severity = blend.severity;
    state.stageIndex = exactStageIndex;
    state.currentStage = exactStageIndex >= 0 ? site.stageRecords[exactStageIndex]?.stage ?? null : null;
    state.goreStage = goreStage?.stage ?? null;
    state.activationCount += 1;
    state.stageWeights = Object.fromEntries(site.stageRecords.map((stage, index) => [stage.stage, blend.weights[index]]));
    this.activationCount += 1;
    this.lastActivation = {
      source,
      hitRegion,
      hitSide,
      siteId: site.siteId,
      stage: state.currentStage,
      goreStage: state.goreStage,
      severity: blend.severity,
      selectedMorph: goreStage?.keyRecord.name ?? null,
      stageWeights: { ...state.stageWeights },
      ownershipRole,
      activatedGoreNode: activatedGoreNodes[0]?.name ?? null,
      activatedGoreNodes: activatedGoreNodes.map((node) => node.name),
      activatedSurfaceStainNode: activatedSurfaceStainNodes[0]?.name ?? null,
      activatedSurfaceStainNodes: activatedSurfaceStainNodes.map((node) => node.name),
      localPoint: null,
      localDirection: null,
    };
    const terminalStageIndex = site.stageRecords.length - 1;
    const terminalStage = site.stageRecords[terminalStageIndex];
    this.lastActivation.progressiveSite = true;
    this.lastActivation.stageIndex = state.stageIndex;
    this.lastActivation.stageCount = site.stageRecords.length;
    this.lastActivation.terminalStage = terminalStage?.stage ?? null;
    this.lastActivation.terminalStageReached = state.stageIndex === terminalStageIndex
      && blend.severity + weightEpsilon >= (terminalStage?.anchor ?? 1);
    this.logActivation(this.lastActivation);
    return { applied: true, ...this.lastActivation };
  }

  setProgressiveDamageStage(siteId, stageName, options = {}) {
    const site = this.resolveProgressiveSite(siteId);
    const normalizedStage = String(stageName ?? '').toUpperCase();
    const stage = site?.stageRecords?.find((entry) => entry.stage === normalizedStage);
    if (!site || !stage) return { applied: false, reason: 'unknown-site-or-stage', siteId: siteId ?? null, stage: normalizedStage || null };
    return this.setProgressiveSiteSeverity(site.siteId, stage.anchor, options);
  }

  advanceProgressiveDamageSite(siteId = null, options = {}) {
    const site = this.resolveProgressiveSite(siteId);
    if (!site) return { applied: false, reason: 'unknown-or-ambiguous-site', siteId: siteId ?? null };
    const state = this.progressiveState.get(site.siteId);
    const nextIndex = Math.min((state?.stageIndex ?? -1) + 1, site.stageRecords.length - 1);
    if ((state?.stageIndex ?? -1) >= site.stageRecords.length - 1) {
      return {
        applied: false,
        reason: 'site-at-heavy',
        siteId: site.siteId,
        stage: state.currentStage,
        severity: state.severity,
        progressiveSite: true,
        stageIndex: state.stageIndex,
        stageCount: site.stageRecords.length,
        terminalStage: site.stageRecords.at(-1)?.stage ?? null,
        terminalStageReached: true,
      };
    }
    return this.setProgressiveSiteSeverity(site.siteId, site.stageRecords[nextIndex].anchor, options);
  }

  activate(morphName, { requestedWeight = 1, hitRegion = 'manual', hitSide = 'manual', source = 'debug' } = {}) {
    const progressive = this.progressiveStageByKey.get(morphName);
    if (progressive) return this.setProgressiveDamageStage(progressive.siteId, progressive.stage.stage, { hitRegion, hitSide, source });
    const record = this.keyRecords.get(morphName);
    if (!record || this.disposed) return { applied: false, reason: 'unknown-or-disposed', selectedMorph: morphName ?? null };
    const actualWeight = THREE.MathUtils.clamp(Number(requestedWeight) || 0, 0, record.maximumInfluence);
    for (const sibling of this.keyRecords.values()) {
      if (sibling.regionId !== record.regionId || sibling === record) continue;
      setBindingWeight(sibling.targetMorph, 0);
      setBindingWeight(sibling.detachedMorph, 0);
      sibling.stainByRole.forEach((entries) => entries.forEach((entry) => setStainEntryWeight(entry, 0)));
    }
    this.hideRegionGore(record.regionId);
    this.hideRegionSurfaceStains(record.regionId);
    const attachedActual = setBindingWeight(record.targetMorph, actualWeight);
    const detachedActual = record.detachedMorph ? setBindingWeight(record.detachedMorph, actualWeight) : null;
    record.stainByRole.forEach((entries) => entries.forEach((entry) => setStainEntryWeight(entry, actualWeight)));
    const ownershipRole = this.getOwnershipRole(record);
    const thresholdPassed = attachedActual + weightEpsilon >= record.activationWeight;
    const activatedGoreNodes = thresholdPassed ? [...(record.goreByRole.get(ownershipRole) ?? [])] : [];
    activatedGoreNodes.forEach((node) => setGoreSubtreeVisible(node, true));
    const activatedSurfaceStainNodes = thresholdPassed
      ? (record.stainByRole.get(ownershipRole) ?? []).filter((entry) => actualWeight + weightEpsilon >= entry.activationWeight)
      : [];
    activatedSurfaceStainNodes.forEach((entry) => setGoreSubtreeVisible(entry.node, true));
    this.activationCount += 1;
    this.lastActivation = {
      source,
      hitRegion,
      hitSide,
      selectedMorph: record.name,
      requestedWeight: Number(requestedWeight) || 0,
      actualWeight: attachedActual,
      detachedWeight: detachedActual,
      activationThreshold: record.activationWeight,
      ownershipRole,
      activatedGoreNode: activatedGoreNodes[0]?.name ?? null,
      activatedGoreNodes: activatedGoreNodes.map((node) => node.name),
      activatedSurfaceStainNode: activatedSurfaceStainNodes[0]?.node?.name ?? null,
      activatedSurfaceStainNodes: activatedSurfaceStainNodes.map((entry) => entry.node.name),
      localPoint: null,
      localDirection: null,
    };
    this.logActivation(this.lastActivation);
    return { applied: true, ...this.lastActivation };
  }

  applyMaceHit({ hit, impact, requestedWeight = 1 } = {}) {
    const selection = this.selectMaceDamage({ hit, impact });
    if (!selection) return { applied: false, reason: 'unmanaged-hit', hitRegion: hit?.regionId ?? null, hitSide: 'none', selectedMorph: null };
    if (selection.site && !QUALIFYING_PROGRESSIVE_IMPACTS.has(impact?.classification)) {
      return {
        applied: false,
        reason: 'insufficient-progressive-impact',
        hitRegion: selection.hitRegion,
        hitSide: selection.hitSide,
        siteId: selection.site.siteId,
        progressiveSite: true,
        classification: impact?.classification ?? null,
        selectedMorph: null,
      };
    }
    const interactionId = String(impact?.interactionId ?? '');
    if (selection.site && interactionId && this.acceptedProgressiveInteractionIds.has(interactionId)) {
      return { applied: false, reason: 'duplicate-progressive-interaction', siteId: selection.site.siteId, progressiveSite: true };
    }
    const options = { requestedWeight, hitRegion: selection.hitRegion, hitSide: selection.hitSide, source: 'mace_hit' };
    let result;
    if (selection.site) {
      const state = this.progressiveState.get(selection.site.siteId);
      if (this.progressiveDamageHitsPerStage === 1 && state?.stageIndex >= selection.site.stageRecords.length - 1) {
        return this.advanceProgressiveDamageSite(selection.site.siteId, options);
      }
      const acceptedHitCount = (state?.acceptedHitCount ?? 0) + 1;
      const stageIndex = Math.min(Math.floor((acceptedHitCount - 1) / this.progressiveDamageHitsPerStage), selection.site.stageRecords.length - 1);
      result = this.setProgressiveSiteSeverity(selection.site.siteId, selection.site.stageRecords[stageIndex].anchor, options);
      if (result.applied) {
        state.acceptedHitCount = acceptedHitCount;
        result.acceptedHitCount = acceptedHitCount;
        if (interactionId) this.acceptedProgressiveInteractionIds.add(interactionId);
      }
    } else result = this.activate(selection.record.name, options);
    if (result.applied) {
      this.lastActivation.localPoint = selection.localPoint.toArray();
      this.lastActivation.localDirection = selection.localDirection.toArray();
      result.localPoint = [...this.lastActivation.localPoint];
      result.localDirection = [...this.lastActivation.localDirection];
    }
    return result;
  }

  handleSegmentDetached(segmentId) {
    const affected = [...this.keyRecords.values()].filter((record) => record.relatedSeamId === segmentId);
    affected.forEach((record) => {
      const weight = readBindingWeight(record.targetMorph);
      setBindingWeight(record.detachedMorph, weight);
      record.goreByRole.get('ATTACHED')?.forEach((node) => setGoreSubtreeVisible(node, false));
      record.goreByRole.get('DETACHED')?.forEach((node) => setGoreSubtreeVisible(node, false));
      record.stainByRole.forEach((entries) => entries.forEach((entry) => {
        setStainEntryWeight(entry, weight);
        setGoreSubtreeVisible(entry.node, false);
      }));
    });
    const progressiveKeys = new Set();
    for (const [siteId, site] of this.progressiveSites) {
      if (!site.stageRecords.some(({ keyRecord }) => keyRecord.relatedSeamId === segmentId)) continue;
      site.stageRecords.forEach(({ keyRecord }) => progressiveKeys.add(keyRecord.name));
      const state = this.progressiveState.get(siteId);
      const goreStage = site.stageRecords.find((stage) => stage.stage === state?.goreStage);
      goreStage?.keyRecord.goreByRole.get('DETACHED')?.forEach((node) => setGoreSubtreeVisible(node, true));
      site.stageRecords.forEach(({ keyRecord }) => {
        const weight = readBindingWeight(keyRecord.targetMorph);
        keyRecord.stainByRole.get('DETACHED')?.forEach((entry) => {
          setGoreSubtreeVisible(entry.node, weight + weightEpsilon >= entry.activationWeight);
        });
      });
    }
    affected.filter((record) => !progressiveKeys.has(record.name)).forEach((record) => {
      const weight = readBindingWeight(record.targetMorph);
      record.goreByRole.get('DETACHED')?.forEach((node) => setGoreSubtreeVisible(node, weight + weightEpsilon >= record.activationWeight));
      record.stainByRole.get('DETACHED')?.forEach((entry) => setGoreSubtreeVisible(entry.node, weight + weightEpsilon >= entry.activationWeight));
    });
    return affected.length > 0;
  }

  logActivation(diagnostics) {
    if (!(import.meta.env?.DEV === true || globalThis.__DSB_DAMAGE_DEBUG__ === true)) return;
    console.info('[ForgeDamage]', {
      region: diagnostics.hitRegion,
      side: diagnostics.hitSide,
      morph: diagnostics.selectedMorph,
      requestedWeight: diagnostics.requestedWeight,
      actualWeight: diagnostics.actualWeight,
      goreNode: diagnostics.activatedGoreNode,
    });
  }

  getDiagnostics() {
    const morphWeights = Object.fromEntries([...this.keyRecords].map(([name, record]) => [name, {
      attached: readBindingWeight(record.targetMorph),
      detached: record.detachedMorph ? readBindingWeight(record.detachedMorph) : null,
    }]));
    const visibleGoreNodes = this.goreNodes.filter(({ node }) => node.visible).map(({ node }) => node.name);
    const visibleSurfaceStainNodes = this.surfaceStainNodes.filter(({ node }) => node.visible).map(({ node }) => node.name);
    const visibleGoreMaterials = [];
    const recordedMaterials = new Set();
    this.goreNodes.filter(({ node }) => node.visible).forEach(({ node }) => node.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach((material) => {
        if (recordedMaterials.has(material.uuid)) return;
        recordedMaterials.add(material.uuid);
        visibleGoreMaterials.push({
          name: material.name,
          roughness: Number.isFinite(material.roughness) ? material.roughness : null,
          clearcoat: Number.isFinite(material.clearcoat) ? material.clearcoat : null,
          polygonOffset: material.polygonOffset === true,
          renderOrder: object.renderOrder,
        });
      });
    }));
    const headOwnershipOverlap = [...this.keyRecords.values()].some((record) => {
      const goreOverlap = record?.goreByRole.get('ATTACHED')?.some((node) => node.visible) && record?.goreByRole.get('DETACHED')?.some((node) => node.visible);
      const stainOverlap = record?.stainByRole.get('ATTACHED')?.some((entry) => entry.node.visible) && record?.stainByRole.get('DETACHED')?.some((entry) => entry.node.visible);
      return Boolean(goreOverlap || stainOverlap);
    });
    const progressiveSites = Object.fromEntries([...this.progressiveSites].map(([siteId, site]) => {
      const state = this.progressiveState.get(siteId);
      return [siteId, {
        displayName: site.displayName,
        regionId: site.regionId,
        structuralGroup: site.structuralGroup,
        stageOrder: [...site.stageOrder],
        stageKeyMapping: Object.fromEntries(site.stageRecords.map((stage) => [stage.stage, stage.keyRecord.name])),
        severityAnchors: { ...site.severityAnchors },
        transitionMode: site.transitionMode,
        transitionCurve: site.transitionCurve,
        goreTransitionMode: site.goreTransitionMode,
        severity: state?.severity ?? 0,
        currentStage: state?.currentStage ?? null,
        goreStage: state?.goreStage ?? null,
        stageWeights: { ...(state?.stageWeights ?? {}) },
        activationCount: state?.activationCount ?? 0,
        acceptedHitCount: state?.acceptedHitCount ?? 0,
      }];
    }));
    return {
      enabled: true,
      schema: this.validation.deformation.schema,
      authoringVersion: this.validation.deformation.authoringVersion,
      authoringBuildId: this.validation.deformation.authoringBuildId,
      managedMorphNames: [...this.keyRecords.keys()],
      morphWeights,
      visibleGoreNodes,
      visibleSurfaceStainNodes,
      visibleGoreMaterials,
      headOwnershipOverlap,
      progressiveSiteSchema: this.validation.deformation.progressiveDamageSiteSchema ?? null,
      progressiveSiteSource: this.validation.progressiveSiteSource,
      progressiveDamageHitsPerStage: this.progressiveDamageHitsPerStage,
      compatibilityDiagnostics: [...this.progressiveSites.values()].map((site) => site.compatibilityDiagnostic).filter(Boolean),
      progressiveSites,
      gorePresentationMeshCount: this.gorePresentationMeshCount,
      goreRenderOrder: FORGE_GORE_RENDER_ORDER,
      surfaceStainBindingSchema: this.validation.deformation.surfaceStainBindingSchema ?? null,
      surfaceStainPresentationMeshCount: this.surfaceStainPresentationMeshCount,
      surfaceStainRenderOrder: FORGE_SURFACE_STAIN_RENDER_ORDER,
      activationCount: this.activationCount,
      lastActivation: this.lastActivation ? { ...this.lastActivation } : null,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.actor = null;
    this.adapter = null;
    this.segmentRuntime = null;
    this.root = null;
  }
}
