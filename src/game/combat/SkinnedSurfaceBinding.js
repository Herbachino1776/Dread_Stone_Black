import * as THREE from 'three';

export const WOUND_SURFACE_BIAS = 0.0008;
export const MAX_SLASH_SURFACE_SAMPLES = 48;
export const MIN_SLASH_SURFACE_SAMPLES = 3;
export const MAX_SURFACE_PROJECTION_DISTANCE = 0.05;
export const MAX_ADJACENT_SURFACE_PROJECTION_DISTANCE = 0.06;
export const MAX_SURFACE_RECONSTRUCTION_ERROR = 0.018;
export const MAX_ADJACENT_SURFACE_RECONSTRUCTION_ERROR = 0.026;
export const MIN_SURFACE_NORMAL_COMPATIBILITY = 0.25;

const MAX_SURFACE_TANGENTIAL_DISTANCE = 0.03;
const MAX_ADJACENT_SURFACE_TANGENTIAL_DISTANCE = 0.035;
const MIN_SEMANTIC_TRIANGLE_WEIGHT = 0.08;
const MIN_SEMANTIC_OVERLAP_WEIGHT = 0.35;

const anatomyNeighbors = {
  pelvis: ['abdomen', 'left_thigh', 'right_thigh'],
  abdomen: ['pelvis', 'lower_chest'],
  lower_chest: ['abdomen', 'upper_chest'],
  upper_chest: ['lower_chest', 'neck', 'left_upper_arm', 'right_upper_arm'],
  neck: ['upper_chest', 'head'],
  head: ['neck'],
  left_upper_arm: ['upper_chest', 'left_forearm'],
  left_forearm: ['left_upper_arm', 'left_hand'],
  left_hand: ['left_forearm'],
  right_upper_arm: ['upper_chest', 'right_forearm'],
  right_forearm: ['right_upper_arm', 'right_hand'],
  right_hand: ['right_forearm'],
  left_thigh: ['pelvis', 'left_lower_leg'],
  left_lower_leg: ['left_thigh', 'left_foot'],
  left_foot: ['left_lower_leg'],
  right_thigh: ['pelvis', 'right_lower_leg'],
  right_lower_leg: ['right_thigh', 'right_foot'],
  right_foot: ['right_lower_leg'],
};

export const SURFACE_ANATOMY_NEIGHBORS = Object.freeze(Object.fromEntries(
  Object.entries(anatomyNeighbors).map(([id, neighbors]) => [id, Object.freeze(neighbors)]),
));

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const closest = new THREE.Vector3();
const delta = new THREE.Vector3();
const naturalNormal = new THREE.Vector3();
const barycentricScratch = new THREE.Vector3();
const influencePoint = new THREE.Vector3();
const influenceQuaternion = new THREE.Quaternion();
const triangle = new THREE.Triangle();
const triangleMetadataCache = new WeakMap();

function canonicalAnatomyId(regionId, bodyId = null) {
  if (regionId === 'face' || regionId === 'skull') return bodyId ?? 'head';
  return regionId ?? bodyId;
}

export function areSurfaceAnatomiesCompatible(firstRegionId, secondRegionId, firstBodyId = null, secondBodyId = null) {
  const first = canonicalAnatomyId(firstRegionId, firstBodyId);
  const second = canonicalAnatomyId(secondRegionId, secondBodyId);
  if (!first || !second) return false;
  return first === second || SURFACE_ANATOMY_NEIGHBORS[first]?.includes(second) === true;
}

export function createSurfaceBindingDiagnostics() {
  return {
    bindingAttempts: 0,
    successfulBindings: 0,
    failedBindings: 0,
    anatomyIncompatibleCandidateRejectionCount: 0,
    excessiveDistanceRejectionCount: 0,
    normalIncompatibilityRejectionCount: 0,
    maximumAcceptedBindDistance: 0,
    selectedTriangleSemanticCompatibility: null,
  };
}

function incrementDiagnostic(diagnostics, key, amount = 1) {
  if (!diagnostics) return;
  diagnostics[key] = Math.min(1_000_000_000, Math.max(0, Number(diagnostics[key]) || 0) + amount);
}

export function getTriangleVertexIndices(geometry, triangleIndex) {
  const index = geometry.index;
  const offset = triangleIndex * 3;
  return index
    ? [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)]
    : [offset, offset + 1, offset + 2];
}

function findNearestMappedDescendant(bone, semanticByBoneName) {
  const queue = [...(bone?.children ?? [])];
  while (queue.length) {
    const current = queue.shift();
    const semanticId = semanticByBoneName.get(current.name);
    if (semanticId) return semanticId;
    queue.push(...(current.children ?? []));
  }
  return null;
}

export function createSemanticBoneIndexMap(mesh, boneMap = {}) {
  const semanticByBoneName = new Map(Object.entries(boneMap).map(([semanticId, boneName]) => [boneName, semanticId]));
  return (mesh?.skeleton?.bones ?? []).map((bone) => {
    for (let current = bone; current; current = current.parent?.isBone ? current.parent : null) {
      const semanticId = semanticByBoneName.get(current.name);
      if (semanticId) return semanticId;
    }
    return findNearestMappedDescendant(bone, semanticByBoneName);
  });
}

export function buildSkinnedTriangleInfluenceMetadata(mesh, { boneMap = {}, semanticByBoneIndex = null } = {}) {
  const geometry = mesh?.geometry;
  const position = geometry?.attributes?.position;
  const skinIndex = geometry?.attributes?.skinIndex;
  const skinWeight = geometry?.attributes?.skinWeight;
  if (!mesh?.isSkinnedMesh || !position || !skinIndex || !skinWeight) return null;
  const semantics = semanticByBoneIndex ?? createSemanticBoneIndexMap(mesh, boneMap);
  const signature = semantics.map((id) => id ?? '').join('|');
  let cachedBySignature = triangleMetadataCache.get(geometry);
  if (!cachedBySignature) {
    cachedBySignature = new Map();
    triangleMetadataCache.set(geometry, cachedBySignature);
  }
  const cached = cachedBySignature.get(signature);
  if (cached) return cached;

  const triangleCount = Math.floor((geometry.index?.count ?? position.count) / 3);
  const triangles = new Array(triangleCount);
  const trianglesBySemantic = new Map();
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const indices = getTriangleVertexIndices(geometry, triangleIndex);
    const weightsBySemantic = new Map();
    const weightsByBone = new Map();
    for (const vertexIndex of indices) {
      for (let component = 0; component < 4; component += 1) {
        const weight = skinWeight.getComponent(vertexIndex, component);
        if (!(weight > 0)) continue;
        const boneIndex = Math.round(skinIndex.getComponent(vertexIndex, component));
        weightsByBone.set(boneIndex, (weightsByBone.get(boneIndex) ?? 0) + weight);
        const semanticId = semantics[boneIndex];
        if (semanticId) weightsBySemantic.set(semanticId, (weightsBySemantic.get(semanticId) ?? 0) + weight);
      }
    }
    const semanticEntries = [...weightsBySemantic.entries()].sort((left, right) => right[1] - left[1]);
    const boneEntries = [...weightsByBone.entries()].sort((left, right) => right[1] - left[1]);
    const semanticIds = semanticEntries.map(([id]) => id);
    const semanticWeights = semanticEntries.map(([, weight]) => weight / 3);
    const dominantBoneIndex = boneEntries[0]?.[0] ?? null;
    const metadata = {
      semanticIds,
      semanticWeights,
      dominantSemanticId: semanticIds[0] ?? null,
      dominantBoneIndex,
      dominantBoneName: dominantBoneIndex == null ? null : mesh.skeleton.bones[dominantBoneIndex]?.name ?? null,
    };
    triangles[triangleIndex] = metadata;
    semanticEntries.forEach(([semanticId, totalWeight]) => {
      if (totalWeight / 3 < MIN_SEMANTIC_TRIANGLE_WEIGHT) return;
      if (!trianglesBySemantic.has(semanticId)) trianglesBySemantic.set(semanticId, []);
      trianglesBySemantic.get(semanticId).push(triangleIndex);
    });
  }
  const result = { geometry, signature, triangleCount, triangles, trianglesBySemantic, semanticByBoneIndex: semantics };
  cachedBySignature.set(signature, result);
  return result;
}

function semanticWeight(metadata, semanticIds) {
  let maximum = 0;
  for (let index = 0; index < metadata.semanticIds.length; index += 1) {
    if (semanticIds.has(metadata.semanticIds[index])) maximum = Math.max(maximum, metadata.semanticWeights[index]);
  }
  return maximum;
}

function resolveSemanticCompatibility(metadata, regionId, bodyId) {
  const targetIds = new Set([canonicalAnatomyId(regionId, bodyId), bodyId].filter(Boolean));
  const adjacentIds = new Set();
  targetIds.forEach((id) => SURFACE_ANATOMY_NEIGHBORS[id]?.forEach((neighbor) => adjacentIds.add(neighbor)));
  targetIds.forEach((id) => adjacentIds.delete(id));
  const targetWeight = semanticWeight(metadata, targetIds);
  const adjacentWeight = semanticWeight(metadata, adjacentIds);
  const dominant = metadata.dominantSemanticId;
  let kind = 'incompatible';
  let score = 0;
  if (targetIds.has(dominant)) { kind = 'exact'; score = 1; }
  else if (targetWeight >= MIN_SEMANTIC_OVERLAP_WEIGHT) { kind = 'weighted_overlap'; score = 0.86; }
  else if (adjacentIds.has(dominant)) { kind = 'adjacent'; score = 0.68; }
  else if (adjacentWeight >= MIN_SEMANTIC_OVERLAP_WEIGHT) { kind = 'adjacent_overlap'; score = 0.54; }
  return {
    kind,
    score,
    compatible: kind !== 'incompatible',
    adjacent: kind === 'adjacent' || kind === 'adjacent_overlap',
    targetSemanticIds: [...targetIds],
    adjacentSemanticIds: [...adjacentIds],
    dominantSemanticId: dominant,
    dominantBoneName: metadata.dominantBoneName,
    targetWeight,
    adjacentWeight,
  };
}

function getAnatomyCandidateIndices(metadata, regionId, bodyId) {
  const targetIds = new Set([canonicalAnatomyId(regionId, bodyId), bodyId].filter(Boolean));
  const allowedIds = new Set(targetIds);
  targetIds.forEach((id) => SURFACE_ANATOMY_NEIGHBORS[id]?.forEach((neighbor) => allowedIds.add(neighbor)));
  const candidates = new Set();
  allowedIds.forEach((id) => metadata.trianglesBySemantic.get(id)?.forEach((triangleIndex) => candidates.add(triangleIndex)));
  return [...candidates];
}

function captureNeighborhoodInfluences(mesh, indices, barycentric, worldPoint) {
  const skinIndex = mesh.geometry.attributes.skinIndex;
  const skinWeight = mesh.geometry.attributes.skinWeight;
  if (!skinIndex || !skinWeight) return [];
  const barycentricWeights = [barycentric.x, barycentric.y, barycentric.z];
  const weightsByBone = new Map();
  indices.forEach((vertexIndex, vertexOffset) => {
    for (let component = 0; component < 4; component += 1) {
      const weightedInfluence = skinWeight.getComponent(vertexIndex, component) * barycentricWeights[vertexOffset];
      if (!(weightedInfluence > 0)) continue;
      const boneIndex = Math.round(skinIndex.getComponent(vertexIndex, component));
      weightsByBone.set(boneIndex, (weightsByBone.get(boneIndex) ?? 0) + weightedInfluence);
    }
  });
  const totalWeight = [...weightsByBone.values()].reduce((sum, weight) => sum + weight, 0);
  if (!(totalWeight > 0)) return [];
  return [...weightsByBone.entries()].map(([boneIndex, weight]) => {
    const bone = mesh.skeleton?.bones?.[boneIndex] ?? null;
    return bone ? { bone, boneIndex, weight: weight / totalWeight, localPoint: bone.worldToLocal(worldPoint.clone()) } : null;
  }).filter(Boolean);
}

export function reconstructSurfaceBindingNeighborhood(binding, target = {}) {
  if (!binding?.neighborhoodInfluences?.length) return null;
  const point = target.point ?? new THREE.Vector3();
  point.set(0, 0, 0);
  binding.neighborhoodInfluences.forEach((influence) => {
    influencePoint.copy(influence.localPoint);
    influence.bone.localToWorld(influencePoint);
    point.addScaledVector(influencePoint, influence.weight);
  });
  const normal = target.normal ?? new THREE.Vector3();
  if (binding.neighborhoodNormalBone && binding.neighborhoodLocalNormal) {
    normal.copy(binding.neighborhoodLocalNormal).applyQuaternion(binding.neighborhoodNormalBone.getWorldQuaternion(influenceQuaternion)).normalize();
  } else normal.copy(binding.referenceNormal).normalize();
  return { point, normal };
}

export function reconstructSkinnedSurface(binding, target = {}) {
  const mesh = binding?.mesh;
  const indices = binding?.triangleIndices;
  if (!mesh?.isSkinnedMesh || !mesh.parent || !indices || indices.some((index) => index < 0 || index >= mesh.geometry.attributes.position.count)) return null;
  const vertices = target.vertices ?? [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const va = mesh.getVertexPosition(indices[0], vertices[0]);
  const vb = mesh.getVertexPosition(indices[1], vertices[1]);
  const vc = mesh.getVertexPosition(indices[2], vertices[2]);
  mesh.localToWorld(va); mesh.localToWorld(vb); mesh.localToWorld(vc);
  if (![va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z].every(Number.isFinite)) return null;
  const barycentric = binding.barycentric;
  const point = target.point ?? new THREE.Vector3();
  point.set(0, 0, 0).addScaledVector(va, barycentric.x).addScaledVector(vb, barycentric.y).addScaledVector(vc, barycentric.z);
  const normal = target.normal ?? new THREE.Vector3();
  const abx = vb.x - va.x; const aby = vb.y - va.y; const abz = vb.z - va.z;
  const acx = vc.x - va.x; const acy = vc.y - va.y; const acz = vc.z - va.z;
  normal.set(aby * acz - abz * acy, abz * acx - abx * acz, abx * acy - aby * acx);
  if (normal.lengthSq() < 1e-12) return null;
  normal.normalize();
  if (normal.dot(binding.referenceNormal) < 0) normal.negate();

  let reconstructionError = 0;
  if (binding.neighborhoodInfluences?.length) {
    const expectedPoint = target.expectedPoint ?? new THREE.Vector3();
    reconstructSurfaceBindingNeighborhood(binding, { point: expectedPoint, normal: target.expectedNormal ?? new THREE.Vector3() });
    reconstructionError = point.distanceTo(expectedPoint);
    if (!Number.isFinite(reconstructionError) || reconstructionError > (binding.maximumReconstructionError ?? MAX_SURFACE_RECONSTRUCTION_ERROR)) return null;
  }
  return { point, normal, vertices, reconstructionError };
}

export function findClosestSkinnedSurface(skinnedMeshes, worldPoint, {
  regionId = null,
  bodyId = null,
  referenceNormal = null,
  maximumDistance = MAX_SURFACE_PROJECTION_DISTANCE,
  anatomyAware = false,
  triangleMetadataByMesh = null,
  diagnostics = null,
  allowLegacyDistance = false,
} = {}) {
  incrementDiagnostic(diagnostics, 'bindingAttempts');
  let best = null;
  let bestScore = Infinity;
  let normalizedReferenceNormal = referenceNormal?.clone?.() ?? null;
  if (normalizedReferenceNormal?.lengthSq() > 1e-10) normalizedReferenceNormal.normalize();
  else normalizedReferenceNormal = null;
  for (const mesh of skinnedMeshes ?? []) {
    const geometry = mesh.geometry;
    const position = geometry?.attributes?.position;
    let visible = mesh.visible;
    for (let parent = mesh.parent; visible && parent; parent = parent.parent) visible = parent.visible;
    if (!visible || !position) continue;
    mesh.updateMatrixWorld(true);
    mesh.skeleton?.update?.();
    const triangleCount = Math.floor((geometry.index?.count ?? position.count) / 3);
    const metadata = anatomyAware ? triangleMetadataByMesh?.get?.(mesh) ?? null : null;
    const candidateIndices = metadata ? getAnatomyCandidateIndices(metadata, regionId, bodyId) : null;
    if (metadata) incrementDiagnostic(diagnostics, 'anatomyIncompatibleCandidateRejectionCount', Math.max(0, triangleCount - candidateIndices.length));
    const trianglesToSearch = candidateIndices?.length ?? triangleCount;
    for (let candidateOffset = 0; candidateOffset < trianglesToSearch; candidateOffset += 1) {
      const triangleIndex = candidateIndices ? candidateIndices[candidateOffset] : candidateOffset;
      const triangleMetadata = metadata?.triangles[triangleIndex] ?? null;
      const semanticCompatibility = triangleMetadata ? resolveSemanticCompatibility(triangleMetadata, regionId, bodyId) : null;
      if (triangleMetadata && !semanticCompatibility.compatible) {
        incrementDiagnostic(diagnostics, 'anatomyIncompatibleCandidateRejectionCount');
        continue;
      }
      const adjacent = semanticCompatibility?.adjacent === true;
      const ordinaryLimit = allowLegacyDistance ? maximumDistance : Math.min(maximumDistance, MAX_SURFACE_PROJECTION_DISTANCE);
      const acceptedDistance = adjacent
        ? Math.min(ordinaryLimit + MAX_ADJACENT_SURFACE_PROJECTION_DISTANCE - MAX_SURFACE_PROJECTION_DISTANCE, MAX_ADJACENT_SURFACE_PROJECTION_DISTANCE)
        : ordinaryLimit;
      const indices = getTriangleVertexIndices(geometry, triangleIndex);
      mesh.getVertexPosition(indices[0], a); mesh.getVertexPosition(indices[1], b); mesh.getVertexPosition(indices[2], c);
      mesh.localToWorld(a); mesh.localToWorld(b); mesh.localToWorld(c);
      triangle.set(a, b, c);
      if (triangle.getArea() < 1e-10) continue;
      triangle.closestPointToPoint(worldPoint, closest);
      const distanceSq = closest.distanceToSquared(worldPoint);
      if (distanceSq > acceptedDistance * acceptedDistance) {
        incrementDiagnostic(diagnostics, 'excessiveDistanceRejectionCount');
        continue;
      }
      triangle.getNormal(naturalNormal);
      delta.subVectors(worldPoint, closest);
      const normalProjectionDistance = Math.abs(delta.dot(naturalNormal));
      const tangentialDistance = Math.sqrt(Math.max(0, distanceSq - normalProjectionDistance * normalProjectionDistance));
      if (tangentialDistance > (adjacent ? MAX_ADJACENT_SURFACE_TANGENTIAL_DISTANCE : MAX_SURFACE_TANGENTIAL_DISTANCE)) {
        incrementDiagnostic(diagnostics, 'excessiveDistanceRejectionCount');
        continue;
      }
      const normalCompatibility = normalizedReferenceNormal ? naturalNormal.dot(normalizedReferenceNormal) : 1;
      if (normalizedReferenceNormal && normalCompatibility < MIN_SURFACE_NORMAL_COMPATIBILITY) {
        incrementDiagnostic(diagnostics, 'normalIncompatibilityRejectionCount');
        continue;
      }
      const anatomyPenalty = semanticCompatibility ? (1 - semanticCompatibility.score) * 0.01 : 0;
      const normalPenalty = (1 - THREE.MathUtils.clamp(normalCompatibility, 0, 1)) * 0.0012;
      const score = distanceSq + anatomyPenalty + normalPenalty;
      if (score >= bestScore) continue;
      triangle.getBarycoord(closest, barycentricScratch);
      if (Math.abs(barycentricScratch.x + barycentricScratch.y + barycentricScratch.z - 1) > 1e-4) continue;
      const bindingNormal = normalizedReferenceNormal?.clone() ?? naturalNormal.clone();
      const dominantBoneIndex = triangleMetadata?.dominantBoneIndex ?? null;
      const neighborhoodBone = dominantBoneIndex == null ? null : mesh.skeleton?.bones?.[dominantBoneIndex] ?? null;
      const neighborhoodInfluences = captureNeighborhoodInfluences(mesh, indices, barycentricScratch, closest);
      const neighborhoodLocalNormal = neighborhoodBone
        ? bindingNormal.clone().applyQuaternion(neighborhoodBone.getWorldQuaternion(influenceQuaternion).invert()).normalize()
        : null;
      bestScore = score;
      best = {
        kind: 'skinned_triangle',
        mesh,
        meshName: mesh.name || mesh.uuid,
        triangleIndex,
        triangleIndices: indices,
        barycentric: barycentricScratch.clone(),
        referenceNormal: bindingNormal,
        regionId,
        bodyId,
        sourcePoint: worldPoint.clone(),
        distanceAtBind: Math.sqrt(distanceSq),
        normalProjectionDistanceAtBind: normalProjectionDistance,
        semanticCompatibility: semanticCompatibility ? { ...semanticCompatibility } : null,
        neighborhoodBone,
        neighborhoodInfluences,
        neighborhoodNormalBone: neighborhoodBone,
        neighborhoodLocalNormal,
        maximumReconstructionError: adjacent ? MAX_ADJACENT_SURFACE_RECONSTRUCTION_ERROR : MAX_SURFACE_RECONSTRUCTION_ERROR,
      };
    }
  }
  if (best) {
    incrementDiagnostic(diagnostics, 'successfulBindings');
    if (diagnostics) {
      diagnostics.maximumAcceptedBindDistance = Math.max(diagnostics.maximumAcceptedBindDistance ?? 0, best.distanceAtBind);
      diagnostics.selectedTriangleSemanticCompatibility = best.semanticCompatibility ? {
        kind: best.semanticCompatibility.kind,
        score: best.semanticCompatibility.score,
        dominantSemanticId: best.semanticCompatibility.dominantSemanticId,
        dominantBoneName: best.semanticCompatibility.dominantBoneName,
        triangleIndex: best.triangleIndex,
        meshName: best.meshName,
      } : null;
    }
  } else incrementDiagnostic(diagnostics, 'failedBindings');
  return best;
}

export function validateSurfaceBinding(binding) {
  if (!binding?.mesh?.geometry?.attributes?.position) return false;
  if (binding.triangleIndices?.length !== 3 || binding.triangleIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= binding.mesh.geometry.attributes.position.count)) return false;
  const sum = binding.barycentric?.x + binding.barycentric?.y + binding.barycentric?.z;
  return Number.isFinite(sum) && Math.abs(sum - 1) < 1e-4 && binding.barycentric.x >= -1e-5 && binding.barycentric.y >= -1e-5 && binding.barycentric.z >= -1e-5;
}

export function sampleSlashPath(startPoint, endPoint, desiredCount = MIN_SLASH_SURFACE_SAMPLES) {
  const count = THREE.MathUtils.clamp(Math.round(desiredCount), MIN_SLASH_SURFACE_SAMPLES, MAX_SLASH_SURFACE_SAMPLES);
  return Array.from({ length: count }, (_, index) => startPoint.clone().lerp(endPoint, index / (count - 1)));
}
