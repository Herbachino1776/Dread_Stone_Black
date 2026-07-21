import * as THREE from 'three';

export const FORGE_DAMAGE_DEFORMATION_SCHEMA = 'dreadstone.damage_deformation.v1';

export const TESTMAN_FORGE_DAMAGE_MORPHS = Object.freeze({
  headLeft: 'Head_Dent_Left',
  headRight: 'Head_Dent_Right',
  bodyFront: 'Face_Middle_impact_v001',
});

const HEAD_REGIONS = new Set(['head', 'face', 'skull']);
const BODY_REGIONS = new Set(['upper_chest', 'lower_chest', 'abdomen', 'pelvis']);
const VALID_GORE_ROLES = new Set(['ATTACHED', 'DETACHED', 'CORE']);
const SIDE_EPSILON = 0.015;
const weightEpsilon = 1e-6;

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

function finiteVector(value) {
  if (value?.isVector3 && value.toArray().every(Number.isFinite)) return value.clone();
  if (Array.isArray(value) && value.slice(0, 3).every(Number.isFinite)) return new THREE.Vector3().fromArray(value);
  if (value && [value.x, value.y, value.z].every(Number.isFinite)) return new THREE.Vector3(value.x, value.y, value.z);
  return null;
}

export function validateForgeDamageDeformationAsset({ manifest, root } = {}) {
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
    const expectedRoles = record.regionMode === 'PAIRED_SEGMENT' ? ['ATTACHED', 'DETACHED'] : ['CORE'];
    expectedRoles.forEach((role) => {
      if ((record.goreByRole.get(role)?.length ?? 0) !== 1) errors.push(`${record.name} requires exactly one ${role} gore node`);
    });
  }
  if (errors.length) throw new Error(`Forge damage deformation asset failed validation: ${errors.join('; ')}`);
  return { deformation, objects, regions, keyRecords, goreNodes };
}

export class ForgeDamageDeformationRuntime {
  constructor({ actor, adapter, segmentRuntime, root, manifest } = {}) {
    this.actor = actor;
    this.adapter = adapter;
    this.segmentRuntime = segmentRuntime;
    this.root = root;
    this.manifest = manifest;
    this.validation = validateForgeDamageDeformationAsset({ manifest, root });
    this.keyRecords = this.validation.keyRecords;
    this.goreNodes = this.validation.goreNodes;
    this.lastActivation = null;
    this.activationCount = 0;
    this.disposed = false;
    this.parentDetachedGoreToOwnedSegments();
    this.reset();
  }

  parentDetachedGoreToOwnedSegments() {
    this.root.updateMatrixWorld(true);
    this.goreNodes.filter((entry) => entry.role === 'DETACHED').forEach((entry) => {
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
    this.lastActivation = null;
    this.activationCount = 0;
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

  selectHeadMorph(localPoint, localDirection) {
    const left = this.keyRecords.get(TESTMAN_FORGE_DAMAGE_MORPHS.headLeft);
    const right = this.keyRecords.get(TESTMAN_FORGE_DAMAGE_MORPHS.headRight);
    if (!left || !right) return null;
    let sideX = localPoint.x;
    if (Math.abs(sideX) <= SIDE_EPSILON && Math.abs(localDirection.x) > SIDE_EPSILON) sideX = -localDirection.x;
    if (Math.abs(sideX) <= SIDE_EPSILON) return left;
    if (Number.isFinite(left.stampCenterX) && Number.isFinite(right.stampCenterX)) {
      return Math.abs(sideX - left.stampCenterX) <= Math.abs(sideX - right.stampCenterX) ? left : right;
    }
    return sideX >= 0 ? left : right;
  }

  selectMaceDamage({ hit, impact } = {}) {
    if (impact?.primitive !== 'mace_head') return null;
    const localPoint = this.getActorLocalPoint(hit, impact);
    const localDirection = this.getActorLocalDirection(impact);
    let record = null;
    let hitSide = 'none';
    if (HEAD_REGIONS.has(hit?.regionId)) {
      record = this.selectHeadMorph(localPoint, localDirection);
      hitSide = record?.name === TESTMAN_FORGE_DAMAGE_MORPHS.headLeft ? 'left' : 'right';
    } else if (BODY_REGIONS.has(hit?.regionId)) {
      record = this.keyRecords.get(TESTMAN_FORGE_DAMAGE_MORPHS.bodyFront) ?? null;
      hitSide = 'center/front';
    }
    return record ? { record, hitRegion: hit.regionId, hitSide, localPoint, localDirection } : null;
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

  activate(morphName, { requestedWeight = 1, hitRegion = 'manual', hitSide = 'manual', source = 'debug' } = {}) {
    const record = this.keyRecords.get(morphName);
    if (!record || this.disposed) return { applied: false, reason: 'unknown-or-disposed', selectedMorph: morphName ?? null };
    const actualWeight = THREE.MathUtils.clamp(Number(requestedWeight) || 0, 0, record.maximumInfluence);
    for (const sibling of this.keyRecords.values()) {
      if (sibling.regionId !== record.regionId || sibling === record) continue;
      setBindingWeight(sibling.targetMorph, 0);
      setBindingWeight(sibling.detachedMorph, 0);
    }
    this.hideRegionGore(record.regionId);
    const attachedActual = setBindingWeight(record.targetMorph, actualWeight);
    const detachedActual = record.detachedMorph ? setBindingWeight(record.detachedMorph, actualWeight) : null;
    const ownershipRole = this.getOwnershipRole(record);
    const thresholdPassed = attachedActual + weightEpsilon >= record.activationWeight;
    const activatedGoreNodes = thresholdPassed ? [...(record.goreByRole.get(ownershipRole) ?? [])] : [];
    activatedGoreNodes.forEach((node) => setGoreSubtreeVisible(node, true));
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
      localPoint: null,
      localDirection: null,
    };
    this.logActivation(this.lastActivation);
    return { applied: true, ...this.lastActivation };
  }

  applyMaceHit({ hit, impact, requestedWeight = 1 } = {}) {
    const selection = this.selectMaceDamage({ hit, impact });
    if (!selection) return { applied: false, reason: 'unmanaged-hit', hitRegion: hit?.regionId ?? null, hitSide: 'none', selectedMorph: null };
    const result = this.activate(selection.record.name, {
      requestedWeight,
      hitRegion: selection.hitRegion,
      hitSide: selection.hitSide,
      source: 'mace_hit',
    });
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
      record.goreByRole.get('DETACHED')?.forEach((node) => setGoreSubtreeVisible(node, weight + weightEpsilon >= record.activationWeight));
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
    const headOwnershipOverlap = [TESTMAN_FORGE_DAMAGE_MORPHS.headLeft, TESTMAN_FORGE_DAMAGE_MORPHS.headRight].some((name) => {
      const record = this.keyRecords.get(name);
      return Boolean(record?.goreByRole.get('ATTACHED')?.some((node) => node.visible) && record?.goreByRole.get('DETACHED')?.some((node) => node.visible));
    });
    return {
      enabled: true,
      schema: this.validation.deformation.schema,
      authoringVersion: this.validation.deformation.authoringVersion,
      authoringBuildId: this.validation.deformation.authoringBuildId,
      managedMorphNames: [...this.keyRecords.keys()],
      morphWeights,
      visibleGoreNodes,
      headOwnershipOverlap,
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
