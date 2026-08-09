import * as THREE from 'three';

export const PROGRESSIVE_SITE_BINDING_MODES = Object.freeze({
  skinnedSurface: 'SKINNED_SURFACE',
  staticActorLocalFallback: 'STATIC_ACTOR_LOCAL_FALLBACK',
  untargetable: 'UNTARGETABLE',
});

// Collider proxies and rendered skin do not coincide perfectly. This tolerance is
// deliberately small and global so authored radii remain the targeting authority.
export const PROGRESSIVE_SITE_RADIUS_TOLERANCE_METERS = 0.008;
export const PROGRESSIVE_SITE_DIRECTION_SCORE_WEIGHT = 0.04;
export const PROGRESSIVE_SITE_MAXIMUM_RECONSTRUCTION_ERROR = 0.12;

const HEAD_REGIONS = new Set(['head', 'face', 'skull']);
const BODY_REGIONS = new Set(['upper_chest', 'lower_chest', 'abdomen', 'pelvis']);
const directionQuaternion = new THREE.Quaternion();
const influenceDirection = new THREE.Vector3();
const rootScale = new THREE.Vector3();

function finiteVector(value) {
  if (value?.isVector3 && value.toArray().every(Number.isFinite)) return value.clone();
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite)) return new THREE.Vector3().fromArray(value);
  if (value && [value.x, value.y, value.z].every(Number.isFinite)) return new THREE.Vector3(value.x, value.y, value.z);
  return null;
}

function finiteArray(value) {
  return finiteVector(value)?.toArray() ?? null;
}

function serializeVector(value) {
  return finiteVector(value)?.toArray() ?? null;
}

function stableNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function boundedIncrement(value) {
  return Math.min(1_000_000_000, Math.max(0, Number(value) || 0) + 1);
}

function collectTargetMeshes(targetObject) {
  const meshes = [];
  if (targetObject?.isSkinnedMesh) meshes.push(targetObject);
  targetObject?.traverse?.((child) => {
    if (child !== targetObject && child.isSkinnedMesh) meshes.push(child);
  });
  return meshes;
}

/** Convert Forge/Blender local XYZ (Z-up) into glTF/Three local XYZ (Y-up). */
export function forgeAuthoringLocalToThreeLocal(value, target = new THREE.Vector3()) {
  const source = finiteVector(value);
  return source ? target.set(source.x, source.z, -source.y) : null;
}

export function resolveProgressiveDamageSiteCaptureCenter(site) {
  const stageOrder = Array.isArray(site?.stageOrder) ? site.stageOrder : [];
  const stages = Array.isArray(site?.stageRecords) ? site.stageRecords : Array.isArray(site?.stages) ? site.stages : [];
  for (const stageName of stageOrder) {
    const stage = stages.find((entry) => entry?.stage === stageName);
    const center = finiteArray(stage?.measurements?.captureCenterLocal);
    if (center) return { captureCenterLocal: center, source: `stage:${stageName}` };
  }
  const anchor = finiteArray(site?.anchorLocal);
  if (anchor) return { captureCenterLocal: anchor, source: 'anchorLocal' };
  return { captureCenterLocal: null, source: null, rejectionReason: 'missing-authored-capture-center' };
}

export function isProgressiveSiteRegionCompatible(site, hitRegion) {
  if (!hitRegion) return false;
  if (site?.regionId === hitRegion || site?.structuralGroup === hitRegion) return true;
  if (HEAD_REGIONS.has(hitRegion)) {
    return site?.regionId === 'head'
      || site?.structuralGroup === 'head'
      // Chezwick's original face proof was authored on body_core. Keep that
      // compatibility exception semantic; it never supplies spatial position.
      || (site?.regionId === 'body_core' && /face|head/i.test(`${site?.displayName ?? ''} ${site?.siteId ?? ''}`));
  }
  if (BODY_REGIONS.has(hitRegion)) return site?.regionId === 'body_core' || site?.structuralGroup === 'body';
  if (hitRegion === 'left_forearm') return site?.regionId === 'forearm_left';
  if (hitRegion === 'right_forearm') return site?.regionId === 'forearm_right';
  return false;
}

export function createProgressiveDamageSiteTargetRecord(site, { root = null } = {}) {
  const center = resolveProgressiveDamageSiteCaptureCenter(site);
  const radius = Number(site?.radius);
  const preferredDirectionLocal = finiteArray(site?.preferredDirectionLocal);
  const convertedCenter = center.captureCenterLocal ? forgeAuthoringLocalToThreeLocal(center.captureCenterLocal) : null;
  const targetObject = site?.stageRecords?.find?.((stage) => stage?.keyRecord?.targetObject)?.keyRecord?.targetObject
    ?? site?.targetObject
    ?? null;
  const rejectionReason = !center.captureCenterLocal
    ? center.rejectionReason
    : !(radius > 0) ? 'missing-or-invalid-authored-radius' : null;
  const currentWorldCenter = convertedCenter?.clone() ?? null;
  if (convertedCenter && root?.localToWorld) {
    root.updateMatrixWorld?.(true);
    root.localToWorld(currentWorldCenter);
  }
  return {
    siteId: String(site?.siteId ?? ''),
    authority: site?.authority ?? 'NATIVE',
    displayName: site?.displayName ?? site?.siteId ?? 'Unnamed Site',
    regionId: site?.regionId ?? null,
    structuralGroup: site?.structuralGroup ?? null,
    captureCenterLocal: center.captureCenterLocal,
    captureCenterSource: center.source,
    convertedCenterLocal: convertedCenter,
    radius: radius > 0 ? radius : null,
    radiusWorld: radius > 0 ? radius : null,
    preferredDirectionLocal,
    targetObject,
    targetObjectName: targetObject?.name ?? site?.targetObjectName ?? null,
    bindingMode: rejectionReason ? PROGRESSIVE_SITE_BINDING_MODES.untargetable : PROGRESSIVE_SITE_BINDING_MODES.staticActorLocalFallback,
    bindingDiagnostic: rejectionReason ?? 'surface-binding-not-attempted',
    surfaceBinding: null,
    directionBindings: [],
    currentWorldCenter,
    currentWorldPreferredDirection: null,
    currentActorLocalCenter: null,
    reconstructionMode: rejectionReason ? 'UNAVAILABLE' : 'STATIC_ACTOR_LOCAL',
    rejectionReason,
    manifestSite: site,
  };
}

function candidateDiagnostic(record, impactWorld, impactDirection, radiusTolerance) {
  const center = record?.currentWorldCenter?.isVector3 ? record.currentWorldCenter : finiteVector(record?.currentWorldCenter);
  const radius = Number(record?.radiusWorld ?? record?.radius);
  const preferredSource = record?.currentWorldPreferredDirection ?? record?.preferredDirectionLocal;
  const preferredDirection = preferredSource?.isVector3 ? preferredSource : finiteVector(preferredSource);
  if (record?.bindingMode === PROGRESSIVE_SITE_BINDING_MODES.untargetable || !center) {
    return {
      siteId: record?.siteId ?? null,
      authority: record?.authority ?? null,
      bindingMode: record?.bindingMode ?? PROGRESSIVE_SITE_BINDING_MODES.untargetable,
      distance: null,
      radius: radius > 0 ? radius : null,
      authoredRadius: Number(record?.radius) > 0 ? Number(record.radius) : null,
      normalizedDistance: null,
      directionAlignment: null,
      selectionScore: null,
      eligible: false,
      rejectionReason: record?.rejectionReason ?? 'missing-current-world-center',
    };
  }
  if (!(radius > 0)) {
    return {
      siteId: record.siteId,
      authority: record.authority,
      bindingMode: record.bindingMode,
      distance: center.distanceTo(impactWorld),
      radius: null,
      authoredRadius: null,
      normalizedDistance: null,
      directionAlignment: null,
      selectionScore: null,
      eligible: false,
      rejectionReason: 'missing-or-invalid-authored-radius',
    };
  }
  const distance = center.distanceTo(impactWorld);
  const normalizedDistance = distance / radius;
  const directionAlignment = impactDirection && preferredDirection?.lengthSq() > 1e-8
    ? preferredDirection.dot(impactDirection) / preferredDirection.length()
    : null;
  const eligible = distance <= radius + radiusTolerance;
  const selectionScore = normalizedDistance - (directionAlignment ?? 0) * PROGRESSIVE_SITE_DIRECTION_SCORE_WEIGHT;
  return {
    siteId: record.siteId,
    authority: record.authority,
    bindingMode: record.bindingMode,
    distance,
    radius,
    authoredRadius: record.radius,
    normalizedDistance,
    directionAlignment,
    selectionScore,
    eligible,
    rejectionReason: eligible ? null : 'outside-authored-radius',
  };
}

export function selectProgressiveDamageSiteTarget(records, {
  impactRegion = null,
  impactWorld = null,
  impactActorLocal = null,
  impactDirection = null,
  radiusTolerance = PROGRESSIVE_SITE_RADIUS_TOLERANCE_METERS,
} = {}) {
  const point = finiteVector(impactWorld);
  const direction = finiteVector(impactDirection);
  if (direction?.lengthSq() > 1e-8) direction.normalize();
  else if (direction) direction.set(0, 0, 0);
  const regionCandidates = [...(records ?? [])]
    .filter((record) => isProgressiveSiteRegionCompatible(record, impactRegion));
  const baseDecision = {
    impactRegion,
    impactActorLocal: serializeVector(impactActorLocal),
    impactWorld: serializeVector(point),
    impactDirection: serializeVector(direction),
    selectedSiteId: null,
    selectedAuthority: null,
    selectedDistance: null,
    selectedRadius: null,
    selectedAuthoredRadius: null,
    normalizedDistance: null,
    directionAlignment: null,
    fallbackUsed: false,
    rejectionReason: null,
    candidateCount: regionCandidates.length,
    eligibleCandidateCount: 0,
    candidates: [],
  };
  if (!point) return { record: null, decision: { ...baseDecision, rejectionReason: 'missing-impact-world-point' } };
  if (!regionCandidates.length) return { record: null, decision: { ...baseDecision, rejectionReason: 'no-region-compatible-sites' } };
  const candidatePairs = regionCandidates.map((record) => ({ record, diagnostic: candidateDiagnostic(record, point, direction, radiusTolerance) }));
  const eligible = candidatePairs.filter((candidate) => candidate.diagnostic.eligible);
  baseDecision.candidates = candidatePairs.map(({ diagnostic }) => ({
    ...diagnostic,
    distance: stableNumber(diagnostic.distance),
    radius: stableNumber(diagnostic.radius),
    authoredRadius: stableNumber(diagnostic.authoredRadius),
    normalizedDistance: stableNumber(diagnostic.normalizedDistance),
    directionAlignment: stableNumber(diagnostic.directionAlignment),
    selectionScore: stableNumber(diagnostic.selectionScore),
  }));
  baseDecision.eligibleCandidateCount = eligible.length;
  if (!eligible.length) return { record: null, decision: { ...baseDecision, rejectionReason: 'no-site-inside-authored-radius' } };
  eligible.sort((first, second) => (
    first.diagnostic.selectionScore - second.diagnostic.selectionScore
    || first.diagnostic.normalizedDistance - second.diagnostic.normalizedDistance
    || (second.diagnostic.directionAlignment ?? 0) - (first.diagnostic.directionAlignment ?? 0)
    || String(first.record.siteId).localeCompare(String(second.record.siteId))
  ));
  const selected = eligible[0];
  return {
    record: selected.record,
    decision: {
      ...baseDecision,
      selectedSiteId: selected.record.siteId,
      selectedAuthority: selected.record.authority,
      selectedDistance: selected.diagnostic.distance,
      selectedRadius: selected.diagnostic.radius,
      selectedAuthoredRadius: selected.diagnostic.authoredRadius,
      normalizedDistance: selected.diagnostic.normalizedDistance,
      directionAlignment: selected.diagnostic.directionAlignment,
      rejectionReason: null,
    },
  };
}

export class ProgressiveDamageSiteTargeting {
  constructor({ sites = [], adapter = null, root = null } = {}) {
    this.adapter = adapter;
    this.root = root;
    this.records = [...sites].map((site) => createProgressiveDamageSiteTargetRecord(site, { root }));
    this.recordsById = new Map(this.records.map((record) => [record.siteId, record]));
    this.disposed = false;
    this.scratchSurface = {
      point: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      expectedPoint: new THREE.Vector3(),
      expectedNormal: new THREE.Vector3(),
      vertices: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    };
    this.resetDiagnostics();
    this.bindSites();
  }

  resetDiagnostics() {
    this.progressiveTargetingAttempts = 0;
    this.progressiveTargetingMatches = 0;
    this.progressiveTargetingMisses = 0;
    this.progressiveTargetingOverlapResolutions = 0;
    this.progressiveTargetingStaticFallbackUses = 0;
    this.lastTargetingDecision = null;
    this.lastPhysicalTargetingDecision = null;
  }

  updateStaticRecord(record) {
    if (!record.convertedCenterLocal) return false;
    record.currentWorldCenter.copy(record.convertedCenterLocal);
    if (this.root?.localToWorld) {
      this.root.updateMatrixWorld?.(true);
      this.root.localToWorld(record.currentWorldCenter);
      this.root.getWorldScale?.(rootScale);
      const scale = Math.max(Math.abs(rootScale.x), Math.abs(rootScale.y), Math.abs(rootScale.z));
      record.radiusWorld = record.radius * (scale > 0 ? scale : 1);
    } else record.radiusWorld = record.radius;
    const preferred = forgeAuthoringLocalToThreeLocal(record.preferredDirectionLocal, new THREE.Vector3());
    if (preferred?.lengthSq() > 1e-8) {
      if (this.root?.getWorldQuaternion) preferred.applyQuaternion(this.root.getWorldQuaternion(directionQuaternion));
      record.currentWorldPreferredDirection = preferred.normalize();
    } else record.currentWorldPreferredDirection = null;
    record.reconstructionMode = 'STATIC_ACTOR_LOCAL';
    return true;
  }

  bindSites() {
    if (this.disposed) return;
    this.root?.updateMatrixWorld?.(true);
    for (const record of this.records) {
      if (record.bindingMode === PROGRESSIVE_SITE_BINDING_MODES.untargetable) continue;
      this.updateStaticRecord(record);
      if (!this.adapter?.bindVisibleSurface) {
        record.bindingDiagnostic = 'skinned-surface-binding-api-unavailable';
        continue;
      }
      const targetMeshes = collectTargetMeshes(record.targetObject);
      const binding = this.adapter.bindVisibleSurface(record.currentWorldCenter, {
        targetMeshes: targetMeshes.length ? targetMeshes : undefined,
        maximumDistance: 0.05,
        maximumReconstructionError: PROGRESSIVE_SITE_MAXIMUM_RECONSTRUCTION_ERROR,
      });
      if (!binding) {
        record.bindingDiagnostic = targetMeshes.length ? 'no-reliable-surface-near-authored-center' : 'target-mesh-unavailable-and-surface-bind-failed';
        continue;
      }
      record.surfaceBinding = binding;
      record.bindingMode = PROGRESSIVE_SITE_BINDING_MODES.skinnedSurface;
      record.bindingDiagnostic = targetMeshes.length ? 'bound-to-authored-deformation-target' : 'bound-to-nearest-visible-skinned-surface';
      const preferredWorld = record.currentWorldPreferredDirection;
      record.directionBindings = preferredWorld && binding.neighborhoodInfluences?.length
        ? binding.neighborhoodInfluences.map((influence) => ({
          bone: influence.bone,
          weight: influence.weight,
          localDirection: preferredWorld.clone().applyQuaternion(influence.bone.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize(),
        }))
        : [];
      this.refreshRecord(record, { refreshFrame: false });
    }
  }

  refreshDirection(record) {
    if (!record.directionBindings.length) return this.updateStaticDirection(record);
    const direction = record.currentWorldPreferredDirection ?? new THREE.Vector3();
    direction.set(0, 0, 0);
    record.directionBindings.forEach((binding) => {
      influenceDirection.copy(binding.localDirection).applyQuaternion(binding.bone.getWorldQuaternion(directionQuaternion));
      direction.addScaledVector(influenceDirection, binding.weight);
    });
    if (direction.lengthSq() <= 1e-8) return this.updateStaticDirection(record);
    record.currentWorldPreferredDirection = direction.normalize();
    return true;
  }

  updateStaticDirection(record) {
    const preferred = forgeAuthoringLocalToThreeLocal(record.preferredDirectionLocal, new THREE.Vector3());
    if (!preferred || preferred.lengthSq() <= 1e-8) {
      record.currentWorldPreferredDirection = null;
      return false;
    }
    if (this.root?.getWorldQuaternion) preferred.applyQuaternion(this.root.getWorldQuaternion(directionQuaternion));
    record.currentWorldPreferredDirection = preferred.normalize();
    return true;
  }

  refreshRecord(recordOrId, { refreshFrame = true, includeActorLocal = false } = {}) {
    const record = typeof recordOrId === 'string' ? this.recordsById.get(recordOrId) : recordOrId;
    if (!record || this.disposed || record.bindingMode === PROGRESSIVE_SITE_BINDING_MODES.untargetable) return null;
    if (record.bindingMode === PROGRESSIVE_SITE_BINDING_MODES.skinnedSurface) {
      let reconstructionMode = 'SKINNED_SURFACE';
      let reconstructed = this.adapter?.reconstructVisibleSurface?.(record.surfaceBinding, this.scratchSurface, { refresh: refreshFrame });
      if (!reconstructed) {
        reconstructionMode = 'SKINNED_NEIGHBORHOOD';
        reconstructed = this.adapter?.reconstructVisibleSurfaceNeighborhood?.(record.surfaceBinding, this.scratchSurface, { refresh: refreshFrame });
      }
      if (reconstructed?.point) {
        record.currentWorldCenter.copy(reconstructed.point);
        record.reconstructionMode = reconstructionMode;
      } else {
        this.updateStaticRecord(record);
        record.reconstructionMode = 'STATIC_RECONSTRUCTION_FALLBACK';
      }
      this.refreshDirection(record);
    } else this.updateStaticRecord(record);
    if (includeActorLocal && this.adapter?.worldToActorLocal) {
      record.currentActorLocalCenter = this.adapter.worldToActorLocal(record.currentWorldCenter, record.currentActorLocalCenter ?? new THREE.Vector3());
    }
    return record;
  }

  refreshAll({ includeActorLocal = false } = {}) {
    if (this.disposed) return [];
    this.adapter?.prepareVisibleSurfaceFrame?.();
    this.records.forEach((record) => this.refreshRecord(record, { refreshFrame: false, includeActorLocal }));
    return this.records;
  }

  select({ impactRegion = null, impactWorld = null, impactActorLocal = null, impactDirection = null, source = 'physical' } = {}) {
    this.progressiveTargetingAttempts = boundedIncrement(this.progressiveTargetingAttempts);
    this.adapter?.prepareVisibleSurfaceFrame?.();
    this.records.forEach((record) => {
      if (isProgressiveSiteRegionCompatible(record, impactRegion)) this.refreshRecord(record, { refreshFrame: false });
    });
    const result = selectProgressiveDamageSiteTarget(this.records, { impactRegion, impactWorld, impactActorLocal, impactDirection });
    this.lastTargetingDecision = { ...result.decision, source };
    if (result.record) {
      this.progressiveTargetingMatches = boundedIncrement(this.progressiveTargetingMatches);
      if (result.decision.eligibleCandidateCount > 1) this.progressiveTargetingOverlapResolutions = boundedIncrement(this.progressiveTargetingOverlapResolutions);
      if (result.record.bindingMode === PROGRESSIVE_SITE_BINDING_MODES.staticActorLocalFallback || result.record.reconstructionMode === 'STATIC_RECONSTRUCTION_FALLBACK') {
        this.progressiveTargetingStaticFallbackUses = boundedIncrement(this.progressiveTargetingStaticFallbackUses);
      }
    } else this.progressiveTargetingMisses = boundedIncrement(this.progressiveTargetingMisses);
    if (source !== 'creature_lab_probe') this.lastPhysicalTargetingDecision = { ...this.lastTargetingDecision };
    return result;
  }

  noteRegionFallback(fallbackUsed) {
    if (!this.lastTargetingDecision) return;
    this.lastTargetingDecision.fallbackUsed = fallbackUsed === true;
    if (this.lastPhysicalTargetingDecision?.source === this.lastTargetingDecision.source) {
      this.lastPhysicalTargetingDecision.fallbackUsed = fallbackUsed === true;
    }
  }

  noteProgressiveDamageResult({ siteId, stage = null, acceptedHitCount = null, applied = false, reason = null } = {}) {
    if (this.lastTargetingDecision?.selectedSiteId !== siteId) return;
    Object.assign(this.lastTargetingDecision, { stage, acceptedHitCount, damageApplied: applied === true, damageRejectionReason: reason });
    if (this.lastTargetingDecision.source !== 'creature_lab_probe' && this.lastPhysicalTargetingDecision?.selectedSiteId === siteId) {
      Object.assign(this.lastPhysicalTargetingDecision, { stage, acceptedHitCount, damageApplied: applied === true, damageRejectionReason: reason });
    }
  }

  getRecord(siteId, { refresh = true, includeActorLocal = false } = {}) {
    const record = this.recordsById.get(siteId) ?? null;
    return refresh ? this.refreshRecord(record, { includeActorLocal }) : record;
  }

  listRecords({ refresh = true, includeActorLocal = false } = {}) {
    if (refresh) this.refreshAll({ includeActorLocal });
    return this.records;
  }

  getDiagnostics() {
    return {
      progressiveTargetingAttempts: this.progressiveTargetingAttempts,
      progressiveTargetingMatches: this.progressiveTargetingMatches,
      progressiveTargetingMisses: this.progressiveTargetingMisses,
      progressiveTargetingOverlapResolutions: this.progressiveTargetingOverlapResolutions,
      progressiveTargetingStaticFallbackUses: this.progressiveTargetingStaticFallbackUses,
      lastTargetingDecision: this.lastTargetingDecision ? { ...this.lastTargetingDecision, candidates: this.lastTargetingDecision.candidates.map((candidate) => ({ ...candidate })) } : null,
      lastPhysicalTargetingDecision: this.lastPhysicalTargetingDecision ? { ...this.lastPhysicalTargetingDecision, candidates: this.lastPhysicalTargetingDecision.candidates.map((candidate) => ({ ...candidate })) } : null,
      sites: Object.fromEntries(this.records.map((record) => [record.siteId, {
        authority: record.authority,
        regionId: record.regionId,
        structuralGroup: record.structuralGroup,
        captureCenterLocal: record.captureCenterLocal ? [...record.captureCenterLocal] : null,
        captureCenterSource: record.captureCenterSource,
        radius: record.radius,
        radiusWorld: record.radiusWorld,
        preferredDirectionLocal: record.preferredDirectionLocal ? [...record.preferredDirectionLocal] : null,
        targetObject: record.targetObjectName,
        bindingMode: record.bindingMode,
        bindingDiagnostic: record.bindingDiagnostic,
        reconstructionMode: record.reconstructionMode,
        currentWorldCenter: serializeVector(record.currentWorldCenter),
        currentActorLocalCenter: serializeVector(record.currentActorLocalCenter),
        currentWorldPreferredDirection: serializeVector(record.currentWorldPreferredDirection),
      }])),
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.records.forEach((record) => {
      record.surfaceBinding = null;
      record.directionBindings = [];
      record.targetObject = null;
      record.manifestSite = null;
    });
    this.recordsById.clear();
    this.adapter = null;
    this.root = null;
  }
}
