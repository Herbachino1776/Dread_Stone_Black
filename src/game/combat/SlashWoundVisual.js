import * as THREE from 'three';
import { KNIFE_COMBAT_CONFIG } from './CombatConfig.js';
import { getAlphaBoundUv } from './KnifeWoundDecalLibrary.js';
import { MAX_SLASH_SURFACE_SAMPLES, WOUND_SURFACE_BIAS } from './SkinnedSurfaceBinding.js';

export const MAX_SLASH_FRAGMENT_COUNT = 40;
export const SLASH_FRAGMENT_SPACING_RATIO = 0.3;
export const SLASH_FRAGMENT_ENDPOINT_SCALE = 0.9;
export const SLASH_FRAGMENT_SCALE_VARIATION = 0.08;
export const SLASH_FRAGMENT_MAXIMUM_ANGLE_RADIANS = THREE.MathUtils.degToRad(3);
export const SLASH_CONTINUITY_TOLERANCE = 1e-5;

const MINIMUM_PROJECTED_SCALE = SLASH_FRAGMENT_ENDPOINT_SCALE * (1 - SLASH_FRAGMENT_SCALE_VARIATION)
  * Math.cos(SLASH_FRAGMENT_MAXIMUM_ANGLE_RADIANS);
const LAYER_OFFSET_STEP = 0.000008;

function deterministicUnit(seed, index, salt) {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ salt) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967296;
}

export function getSlashFragmentVariation(seed, index, allowMirrorX = true, target = {}) {
  target.scale = 1 + (deterministicUnit(seed, index, 0x85ebca6b) * 2 - 1) * SLASH_FRAGMENT_SCALE_VARIATION;
  target.angle = (deterministicUnit(seed, index, 0xc2b2ae35) * 2 - 1) * SLASH_FRAGMENT_MAXIMUM_ANGLE_RADIANS;
  target.mirroredX = allowMirrorX && deterministicUnit(seed, index, 0x27d4eb2f) >= 0.5;
  return target;
}

export function deriveSlashFragmentMetrics({
  bladeWidth = KNIFE_COMBAT_CONFIG.bladeWidth,
  maximumDepth = 0,
  severity = 0,
  pathCurvature = 0,
  reopeningCount = 0,
} = {}) {
  const depthRatio = THREE.MathUtils.clamp(maximumDepth / 0.072, 0, 1);
  const severityRatio = THREE.MathUtils.clamp(severity, 0, 1);
  const curvatureRatio = THREE.MathUtils.clamp(pathCurvature, 0, 1);
  const reopenGrowth = THREE.MathUtils.clamp(reopeningCount, 0, 3) * 0.012;
  const majorLength = THREE.MathUtils.clamp(
    bladeWidth * (1.16 + depthRatio * 0.12 + severityRatio * 0.06 + curvatureRatio * 0.025 + reopenGrowth),
    0.058,
    0.074,
  );
  const maximumCenterSpacing = majorLength * MINIMUM_PROJECTED_SCALE * SLASH_FRAGMENT_SPACING_RATIO;
  return { majorLength, maximumCenterSpacing, minimumProjectedVisibleLength: majorLength * MINIMUM_PROJECTED_SCALE };
}

export function makeSlashFragmentGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(new Float32Array(MAX_SLASH_FRAGMENT_COUNT * 12), 3);
  const normals = new THREE.BufferAttribute(new Float32Array(MAX_SLASH_FRAGMENT_COUNT * 12), 3);
  const uvs = new THREE.BufferAttribute(new Float32Array(MAX_SLASH_FRAGMENT_COUNT * 8), 2);
  positions.setUsage(THREE.DynamicDrawUsage);
  normals.setUsage(THREE.DynamicDrawUsage);
  uvs.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('normal', normals);
  geometry.setAttribute('uv', uvs);
  const indices = new Uint16Array(MAX_SLASH_FRAGMENT_COUNT * 6);
  for (let fragment = 0; fragment < MAX_SLASH_FRAGMENT_COUNT; fragment += 1) {
    const vertex = fragment * 4;
    indices.set([vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3], fragment * 6);
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setDrawRange(0, 0);
  return geometry;
}

function makePathPose() {
  return {
    point: new THREE.Vector3(),
    normal: new THREE.Vector3(0, 0, 1),
    tangent: new THREE.Vector3(1, 0, 0),
    vertices: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    curvature: 0,
    breakBefore: false,
    sourceSampleIndex: -1,
  };
}

export function createSlashVisualWorkspace() {
  return {
    pathPoints: Array.from({ length: MAX_SLASH_SURFACE_SAMPLES }, makePathPose),
    pathPointCount: 0,
    pathDistances: new Float32Array(MAX_SLASH_SURFACE_SAMPLES),
    sections: Array.from({ length: MAX_SLASH_SURFACE_SAMPLES }, () => ({ start: 0, end: 0, length: 0 })),
    sectionCount: 0,
    fragmentCenters: new Float32Array(MAX_SLASH_FRAGMENT_COUNT * 3),
    fragmentTangents: new Float32Array(MAX_SLASH_FRAGMENT_COUNT * 3),
    fragmentNormals: new Float32Array(MAX_SLASH_FRAGMENT_COUNT * 3),
    fragmentLengths: new Float32Array(MAX_SLASH_FRAGMENT_COUNT),
    fragmentScales: new Float32Array(MAX_SLASH_FRAGMENT_COUNT),
    fragmentAngles: new Float32Array(MAX_SLASH_FRAGMENT_COUNT),
    fragmentCurvatures: new Float32Array(MAX_SLASH_FRAGMENT_COUNT),
    fragmentProgress: new Float32Array(MAX_SLASH_FRAGMENT_COUNT),
    fragmentMirrors: new Uint8Array(MAX_SLASH_FRAGMENT_COUNT),
    fragmentPathDistances: new Float32Array(MAX_SLASH_FRAGMENT_COUNT),
    fragmentSectionIndices: new Uint8Array(MAX_SLASH_FRAGMENT_COUNT),
    fragmentCount: 0,
    scratchA: new THREE.Vector3(),
    scratchB: new THREE.Vector3(),
    center: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    side: new THREE.Vector3(),
    rotatedTangent: new THREE.Vector3(),
    rotatedSide: new THREE.Vector3(),
    localCurvature: 0,
    variation: { scale: 1, angle: 0, mirroredX: false },
    lastUvVariantId: null,
    lastUvSeed: null,
    lastUvFragmentCount: 0,
    geometryRevision: 0,
    lastLayoutRevision: -1,
  };
}

export function resetSlashVisualPath(workspace) {
  workspace.pathPointCount = 0;
  workspace.sectionCount = 0;
}

export function appendSlashVisualPathPoint(workspace, point, normal, breakBefore = false, sourceSampleIndex = -1) {
  if (workspace.pathPointCount >= workspace.pathPoints.length) return false;
  const pose = workspace.pathPoints[workspace.pathPointCount];
  pose.point.copy(point);
  pose.normal.copy(normal);
  if (pose.normal.lengthSq() < 1e-8) pose.normal.set(0, 0, 1);
  else pose.normal.normalize();
  pose.breakBefore = Boolean(breakBefore);
  pose.sourceSampleIndex = sourceSampleIndex;
  workspace.pathPointCount += 1;
  return true;
}

function preparePath(workspace) {
  workspace.sectionCount = 0;
  let maximumPathCurvature = 0;
  let renderedPathLength = 0;
  let sectionStart = 0;
  for (let index = 0; index < workspace.pathPointCount; index += 1) {
    const point = workspace.pathPoints[index];
    const previous = index > sectionStart ? workspace.pathPoints[index - 1] : null;
    const step = previous ? point.point.distanceTo(previous.point) : 0;
    if (previous && point.breakBefore) {
      const section = workspace.sections[workspace.sectionCount++];
      section.start = sectionStart;
      section.end = index - 1;
      section.length = workspace.pathDistances[index - 1];
      renderedPathLength += section.length;
      sectionStart = index;
      workspace.pathDistances[index] = 0;
    } else workspace.pathDistances[index] = previous ? workspace.pathDistances[index - 1] + step : 0;
  }
  if (workspace.pathPointCount > 0) {
    const section = workspace.sections[workspace.sectionCount++];
    section.start = sectionStart;
    section.end = workspace.pathPointCount - 1;
    section.length = workspace.pathDistances[section.end];
    renderedPathLength += section.length;
  }

  for (let sectionIndex = 0; sectionIndex < workspace.sectionCount; sectionIndex += 1) {
    const section = workspace.sections[sectionIndex];
    for (let index = section.start; index <= section.end; index += 1) {
      const pose = workspace.pathPoints[index];
      if (section.start === section.end) {
        pose.tangent.set(1, 0, 0).addScaledVector(pose.normal, -pose.normal.x).normalize();
        pose.curvature = 0;
        continue;
      }
      if (index === section.start) workspace.scratchA.subVectors(workspace.pathPoints[index + 1].point, pose.point).normalize();
      else workspace.scratchA.subVectors(pose.point, workspace.pathPoints[index - 1].point).normalize();
      if (index === section.end) workspace.scratchB.copy(workspace.scratchA);
      else workspace.scratchB.subVectors(workspace.pathPoints[index + 1].point, pose.point).normalize();
      pose.curvature = index > section.start && index < section.end ? workspace.scratchA.angleTo(workspace.scratchB) : 0;
      maximumPathCurvature = Math.max(maximumPathCurvature, pose.curvature);
      pose.tangent.copy(workspace.scratchA).add(workspace.scratchB);
      pose.tangent.addScaledVector(pose.normal, -pose.tangent.dot(pose.normal));
      if (pose.tangent.lengthSq() < 1e-8) pose.tangent.copy(workspace.scratchB);
      pose.tangent.normalize();
    }
  }
  return { renderedPathLength, maximumPathCurvature };
}

function samplePreparedPath(workspace, section, distance) {
  let segment = section.start;
  while (segment < section.end - 1 && workspace.pathDistances[segment + 1] < distance) segment += 1;
  const start = workspace.pathPoints[segment];
  const end = workspace.pathPoints[Math.min(segment + 1, section.end)];
  const startDistance = workspace.pathDistances[segment];
  const segmentLength = Math.max(1e-8, workspace.pathDistances[Math.min(segment + 1, section.end)] - startDistance);
  const alpha = section.end === section.start ? 0 : THREE.MathUtils.clamp((distance - startDistance) / segmentLength, 0, 1);
  workspace.center.copy(start.point).lerp(end.point, alpha);
  workspace.normal.copy(start.normal).lerp(end.normal, alpha).normalize();
  workspace.tangent.copy(start.tangent).lerp(end.tangent, alpha);
  workspace.tangent.addScaledVector(workspace.normal, -workspace.tangent.dot(workspace.normal));
  if (workspace.tangent.lengthSq() < 1e-8) workspace.tangent.copy(start.tangent);
  workspace.tangent.normalize();
  workspace.localCurvature = THREE.MathUtils.lerp(start.curvature, end.curvature, alpha);
}

function writeVertex(positions, normals, vertexOffset, center, tangent, side, normal, along, across, surfaceOffset) {
  positions[vertexOffset] = center.x + tangent.x * along + side.x * across + normal.x * surfaceOffset;
  positions[vertexOffset + 1] = center.y + tangent.y * along + side.y * across + normal.y * surfaceOffset;
  positions[vertexOffset + 2] = center.z + tangent.z * along + side.z * across + normal.z * surfaceOffset;
  normals[vertexOffset] = normal.x;
  normals[vertexOffset + 1] = normal.y;
  normals[vertexOffset + 2] = normal.z;
}

export function updateSlashFragmentGeometry({
  geometry,
  workspace,
  variant,
  deterministicSeed = 0,
  physicalCutLength = 0,
  fragmentMajorLength,
  fragmentWidth,
  centerSpacing,
  fallbackUsage = false,
  layoutRevision = 0,
} = {}) {
  const prepared = preparePath(workspace);
  const positions = geometry.attributes.position.array;
  const normals = geometry.attributes.normal.array;
  const uvs = geometry.attributes.uv.array;
  const normalUv = variant ? getAlphaBoundUv(variant, false) : null;
  const mirroredUv = variant?.allowMirrorX === true ? getAlphaBoundUv(variant, true) : normalUv;
  // Cropping the authored alpha bounds edge-to-edge makes the quad's long axis
  // the fragment's actual visible major length, so spacing is based on visible alpha.
  const safeMajorLength = Math.max(0.001, fragmentMajorLength);
  const safeWidth = Math.max(0.001, fragmentWidth);
  const safeSpacing = Math.min(Math.max(0.001, centerSpacing), safeMajorLength * MINIMUM_PROJECTED_SCALE * SLASH_FRAGMENT_SPACING_RATIO);
  let fragmentCount = 0;
  let spacingSum = 0;
  let spacingPairCount = 0;
  let minimumVisibleOverlapRatio = 1;
  let maximumUncoveredGap = 0;
  let previousCenterDistance = 0;
  let previousVisibleLength = 0;
  let previousSectionIndex = -1;
  let finalEndpointScale = SLASH_FRAGMENT_ENDPOINT_SCALE;
  for (let sectionIndex = 0; sectionIndex < workspace.sectionCount && fragmentCount < MAX_SLASH_FRAGMENT_COUNT; sectionIndex += 1) {
    const section = workspace.sections[sectionIndex];
    if (section.length <= 1e-8) continue;
    const sectionFragmentCount = Math.floor(section.length / safeSpacing) + 1;
    for (let localIndex = 0; localIndex < sectionFragmentCount && fragmentCount < MAX_SLASH_FRAGMENT_COUNT; localIndex += 1) {
      const centerDistance = Math.min(section.length, localIndex * safeSpacing);
      const progress = section.length > 1e-8 ? centerDistance / section.length : 0.5;
      const endpointEnvelope = localIndex === 0 || localIndex === sectionFragmentCount - 1 ? SLASH_FRAGMENT_ENDPOINT_SCALE : 1;
      const variation = getSlashFragmentVariation(deterministicSeed, fragmentCount, variant?.allowMirrorX === true, workspace.variation);
      samplePreparedPath(workspace, section, centerDistance);
      const curvatureScale = 1 + THREE.MathUtils.clamp(workspace.localCurvature / Math.PI, 0, 1) * 0.04;
      const visibleLength = safeMajorLength * endpointEnvelope * variation.scale * curvatureScale * Math.cos(variation.angle);
      const renderedLength = safeMajorLength * endpointEnvelope * variation.scale * curvatureScale;
      const renderedWidth = safeWidth * (0.96 + (variation.scale - 1) * 0.5 + (curvatureScale - 1) * 0.5);
      workspace.side.crossVectors(workspace.normal, workspace.tangent);
      if (workspace.side.lengthSq() < 1e-8) workspace.side.set(0, 1, 0).cross(workspace.normal);
      workspace.side.normalize();
      const cosine = Math.cos(variation.angle);
      const sine = Math.sin(variation.angle);
      workspace.rotatedTangent.copy(workspace.tangent).multiplyScalar(cosine).addScaledVector(workspace.side, sine).normalize();
      workspace.rotatedSide.copy(workspace.side).multiplyScalar(cosine).addScaledVector(workspace.tangent, -sine).normalize();

      const normalOffset = WOUND_SURFACE_BIAS + (fragmentCount % 3) * LAYER_OFFSET_STEP;
      const halfLength = renderedLength * 0.5;
      const halfWidth = renderedWidth * 0.5;
      const positionOffset = fragmentCount * 12;
      writeVertex(positions, normals, positionOffset, workspace.center, workspace.rotatedTangent, workspace.rotatedSide, workspace.normal, -halfLength, -halfWidth, normalOffset);
      writeVertex(positions, normals, positionOffset + 3, workspace.center, workspace.rotatedTangent, workspace.rotatedSide, workspace.normal, halfLength, -halfWidth, normalOffset);
      writeVertex(positions, normals, positionOffset + 6, workspace.center, workspace.rotatedTangent, workspace.rotatedSide, workspace.normal, -halfLength, halfWidth, normalOffset);
      writeVertex(positions, normals, positionOffset + 9, workspace.center, workspace.rotatedTangent, workspace.rotatedSide, workspace.normal, halfLength, halfWidth, normalOffset);

      const dataOffset = fragmentCount * 3;
      workspace.fragmentCenters[dataOffset] = workspace.center.x;
      workspace.fragmentCenters[dataOffset + 1] = workspace.center.y;
      workspace.fragmentCenters[dataOffset + 2] = workspace.center.z;
      workspace.fragmentTangents[dataOffset] = workspace.rotatedTangent.x;
      workspace.fragmentTangents[dataOffset + 1] = workspace.rotatedTangent.y;
      workspace.fragmentTangents[dataOffset + 2] = workspace.rotatedTangent.z;
      workspace.fragmentNormals[dataOffset] = workspace.normal.x;
      workspace.fragmentNormals[dataOffset + 1] = workspace.normal.y;
      workspace.fragmentNormals[dataOffset + 2] = workspace.normal.z;
      workspace.fragmentLengths[fragmentCount] = visibleLength;
      workspace.fragmentScales[fragmentCount] = variation.scale;
      workspace.fragmentAngles[fragmentCount] = variation.angle;
      workspace.fragmentCurvatures[fragmentCount] = workspace.localCurvature;
      workspace.fragmentProgress[fragmentCount] = progress;
      workspace.fragmentMirrors[fragmentCount] = variation.mirroredX ? 1 : 0;
      workspace.fragmentPathDistances[fragmentCount] = centerDistance;
      workspace.fragmentSectionIndices[fragmentCount] = sectionIndex;

      if (variant) {
        const cropped = variation.mirroredX ? mirroredUv : normalUv;
        const uvOffset = fragmentCount * 8;
        uvs[uvOffset] = cropped.u0; uvs[uvOffset + 1] = cropped.v0;
        uvs[uvOffset + 2] = cropped.u1; uvs[uvOffset + 3] = cropped.v0;
        uvs[uvOffset + 4] = cropped.u0; uvs[uvOffset + 5] = cropped.v1;
        uvs[uvOffset + 6] = cropped.u1; uvs[uvOffset + 7] = cropped.v1;
      }

      if (previousSectionIndex === sectionIndex) {
        const spacing = centerDistance - previousCenterDistance;
        const overlap = (previousVisibleLength + visibleLength) * 0.5 - spacing;
        const uncovered = Math.max(0, -overlap);
        maximumUncoveredGap = Math.max(maximumUncoveredGap, uncovered);
        minimumVisibleOverlapRatio = Math.min(minimumVisibleOverlapRatio, Math.max(0, overlap) / Math.max(previousVisibleLength, visibleLength));
        spacingSum += spacing;
        spacingPairCount += 1;
      }
      previousCenterDistance = centerDistance;
      previousVisibleLength = visibleLength;
      previousSectionIndex = sectionIndex;
      finalEndpointScale = endpointEnvelope;
      fragmentCount += 1;
    }
    if (fragmentCount > 0 && previousSectionIndex === sectionIndex) {
      maximumUncoveredGap = Math.max(maximumUncoveredGap, section.length - (previousCenterDistance + previousVisibleLength * 0.5));
    }
  }

  geometry.setDrawRange(0, fragmentCount * 6);
  geometry.attributes.position.clearUpdateRanges();
  geometry.attributes.normal.clearUpdateRanges();
  geometry.attributes.position.addUpdateRange(0, fragmentCount * 12);
  geometry.attributes.normal.addUpdateRange(0, fragmentCount * 12);
  geometry.attributes.position.needsUpdate = fragmentCount > 0;
  geometry.attributes.normal.needsUpdate = fragmentCount > 0;
  const updateUvs = workspace.lastUvVariantId !== variant?.id
    || workspace.lastUvSeed !== deterministicSeed
    || workspace.lastUvFragmentCount !== fragmentCount;
  if (updateUvs && fragmentCount > 0) {
    geometry.attributes.uv.clearUpdateRanges();
    geometry.attributes.uv.addUpdateRange(0, fragmentCount * 8);
    geometry.attributes.uv.needsUpdate = true;
  }
  if (workspace.lastLayoutRevision !== layoutRevision || workspace.fragmentCount !== fragmentCount) {
    workspace.geometryRevision += 1;
    workspace.lastLayoutRevision = layoutRevision;
  }
  workspace.lastUvVariantId = variant?.id ?? null;
  workspace.lastUvSeed = deterministicSeed;
  workspace.lastUvFragmentCount = fragmentCount;
  workspace.fragmentCount = fragmentCount;

  return {
    selectedSlitVariant: variant?.id ?? null,
    physicalCutLength,
    renderedPathLength: prepared.renderedPathLength,
    fragmentCount,
    averageCenterSpacing: spacingPairCount > 0 ? spacingSum / spacingPairCount : 0,
    minimumVisibleOverlapRatio: spacingPairCount > 0 ? minimumVisibleOverlapRatio : 1,
    maximumUncoveredGap: Math.max(0, maximumUncoveredGap),
    continuityTolerance: SLASH_CONTINUITY_TOLERANCE,
    endpointScale: Math.min(SLASH_FRAGMENT_ENDPOINT_SCALE, finalEndpointScale),
    maximumPathCurvature: prepared.maximumPathCurvature,
    fallbackUsage,
    materialCount: fragmentCount > 0 ? 1 : 0,
    drawCallCount: fragmentCount > 0 ? 1 : 0,
    visualGeometryRevision: workspace.geometryRevision,
    maximumPermittedSpacing: safeSpacing,
    fragmentLimit: MAX_SLASH_FRAGMENT_COUNT,
  };
}
