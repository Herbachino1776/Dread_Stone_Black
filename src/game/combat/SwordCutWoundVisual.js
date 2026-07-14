import * as THREE from 'three';
import { areSurfaceAnatomiesCompatible, validateSurfaceBinding } from './SkinnedSurfaceBinding.js';

export const MAX_SWORD_CUT_SURFACE_SAMPLES = 48;
export const MAX_SWORD_CUT_RIBBON_SEGMENTS = MAX_SWORD_CUT_SURFACE_SAMPLES - 1;
export const SWORD_CUT_VERTICES_PER_SEGMENT = 12;
export const SWORD_CUT_INDICES_PER_SEGMENT = 18;
export const SWORD_CUT_CENTER_INDEX_CAPACITY = MAX_SWORD_CUT_RIBBON_SEGMENTS * 6;
export const SWORD_CUT_TARGET_SAMPLE_SPACING = 0.014;
export const SWORD_CUT_MAX_SEGMENT_LENGTH = 0.024;
export const SWORD_CUT_MAX_MIDPOINT_SURFACE_ERROR = 0.0045;
export const SWORD_CUT_MAX_NORMAL_ANGLE_DEGREES = 65;
export const SWORD_CUT_SEED_LENGTH = 0.008;

const MIN_SEGMENT_NORMAL_DOT = Math.cos(THREE.MathUtils.degToRad(SWORD_CUT_MAX_NORMAL_ANGLE_DEGREES));
const startTangent = new THREE.Vector3();
const endTangent = new THREE.Vector3();
const startSide = new THREE.Vector3();
const endSide = new THREE.Vector3();
const midpoint = new THREE.Vector3();
const midpointNormal = new THREE.Vector3();
const seedStartPoint = new THREE.Vector3();
const seedEndPoint = new THREE.Vector3();
const seedFallbackTangent = new THREE.Vector3();

function makePose() {
  return {
    point: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    vertices: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    expectedPoint: new THREE.Vector3(),
    expectedNormal: new THREE.Vector3(),
  };
}

export function createSwordCutRibbonWorkspace() {
  return {
    poses: Array.from({ length: MAX_SWORD_CUT_SURFACE_SAMPLES }, makePose),
    midpointPoses: Array.from({ length: MAX_SWORD_CUT_RIBBON_SEGMENTS }, makePose),
    valid: new Uint8Array(MAX_SWORD_CUT_SURFACE_SAMPLES),
    connected: new Uint8Array(MAX_SWORD_CUT_SURFACE_SAMPLES),
    renderedSegmentCount: 0,
    hiddenFragmentCount: 0,
    continuousRegionTransitionCount: 0,
    oneSampleSeedUsageCount: 0,
    maximumRenderedSegmentLength: 0,
    maximumMidpointToSurfaceError: 0,
  };
}

export function makeSwordCutRibbonGeometry() {
  const vertexCapacity = MAX_SWORD_CUT_RIBBON_SEGMENTS * SWORD_CUT_VERTICES_PER_SEGMENT;
  const positions = new Float32Array(vertexCapacity * 3);
  const normals = new Float32Array(vertexCapacity * 3);
  const indices = new Uint16Array(MAX_SWORD_CUT_RIBBON_SEGMENTS * SWORD_CUT_INDICES_PER_SEGMENT);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setDrawRange(0, indices.length);
  geometry.clearGroups();
  return geometry;
}

function writeVertex(positionAttribute, normalAttribute, vertexIndex, point, normal, side, sideOffset, normalOffset) {
  positionAttribute.setXYZ(
    vertexIndex,
    point.x + side.x * sideOffset + normal.x * normalOffset,
    point.y + side.y * sideOffset + normal.y * normalOffset,
    point.z + side.z * sideOffset + normal.z * normalOffset,
  );
  normalAttribute.setXYZ(vertexIndex, normal.x, normal.y, normal.z);
}

function writeQuad(indexAttribute, offset, a, b, c, d) {
  indexAttribute.setX(offset, a);
  indexAttribute.setX(offset + 1, b);
  indexAttribute.setX(offset + 2, c);
  indexAttribute.setX(offset + 3, c);
  indexAttribute.setX(offset + 4, b);
  indexAttribute.setX(offset + 5, d);
}

function writeRibbonSegment({ geometry, segmentIndex, start, end, width }) {
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const indices = geometry.index;
  startTangent.subVectors(end.point, start.point).addScaledVector(start.normal, -startTangent.dot(start.normal));
  endTangent.subVectors(end.point, start.point).addScaledVector(end.normal, -endTangent.dot(end.normal));
  if (startTangent.lengthSq() < 1e-10 || endTangent.lengthSq() < 1e-10) return false;
  startTangent.normalize();
  endTangent.normalize();
  startSide.crossVectors(start.normal, startTangent).normalize();
  endSide.crossVectors(end.normal, endTangent).normalize();
  if (startSide.lengthSq() < 1e-10 || endSide.lengthSq() < 1e-10) return false;

  const outerHalfWidth = width * 0.5;
  const centerHalfWidth = Math.max(0.0011, width * 0.16);
  const centerBias = 0.00015;
  const lipOuterBias = 0.0007;
  const lipCrestBias = 0.0018;
  const vertex = segmentIndex * SWORD_CUT_VERTICES_PER_SEGMENT;

  writeVertex(positions, normals, vertex, start.point, start.normal, startSide, -centerHalfWidth, centerBias);
  writeVertex(positions, normals, vertex + 1, start.point, start.normal, startSide, centerHalfWidth, centerBias);
  writeVertex(positions, normals, vertex + 2, end.point, end.normal, endSide, -centerHalfWidth, centerBias);
  writeVertex(positions, normals, vertex + 3, end.point, end.normal, endSide, centerHalfWidth, centerBias);

  writeVertex(positions, normals, vertex + 4, start.point, start.normal, startSide, -outerHalfWidth, lipOuterBias);
  writeVertex(positions, normals, vertex + 5, start.point, start.normal, startSide, -centerHalfWidth, lipCrestBias);
  writeVertex(positions, normals, vertex + 6, end.point, end.normal, endSide, -outerHalfWidth, lipOuterBias);
  writeVertex(positions, normals, vertex + 7, end.point, end.normal, endSide, -centerHalfWidth, lipCrestBias);

  writeVertex(positions, normals, vertex + 8, start.point, start.normal, startSide, centerHalfWidth, lipCrestBias);
  writeVertex(positions, normals, vertex + 9, start.point, start.normal, startSide, outerHalfWidth, lipOuterBias);
  writeVertex(positions, normals, vertex + 10, end.point, end.normal, endSide, centerHalfWidth, lipCrestBias);
  writeVertex(positions, normals, vertex + 11, end.point, end.normal, endSide, outerHalfWidth, lipOuterBias);

  const centerIndex = segmentIndex * 6;
  const lipIndex = SWORD_CUT_CENTER_INDEX_CAPACITY + segmentIndex * 12;
  writeQuad(indices, centerIndex, vertex, vertex + 1, vertex + 2, vertex + 3);
  writeQuad(indices, lipIndex, vertex + 4, vertex + 5, vertex + 6, vertex + 7);
  writeQuad(indices, lipIndex + 6, vertex + 8, vertex + 9, vertex + 10, vertex + 11);
  return true;
}

function writeSurfaceSeed({ geometry, segmentIndex, pose, sample, width }) {
  seedFallbackTangent.subVectors(pose.vertices[1], pose.vertices[0]);
  startTangent.copy(sample?.worldDirection ?? seedFallbackTangent);
  startTangent.addScaledVector(pose.normal, -startTangent.dot(pose.normal));
  if (startTangent.lengthSq() < 1e-10) {
    startTangent.subVectors(pose.vertices[2], pose.vertices[0]).addScaledVector(pose.normal, -startTangent.dot(pose.normal));
  }
  if (startTangent.lengthSq() < 1e-10) return false;
  startTangent.normalize();
  seedStartPoint.copy(pose.point).addScaledVector(startTangent, -SWORD_CUT_SEED_LENGTH * 0.5);
  seedEndPoint.copy(pose.point).addScaledVector(startTangent, SWORD_CUT_SEED_LENGTH * 0.5);
  const start = { point: seedStartPoint, normal: pose.normal };
  const end = { point: seedEndPoint, normal: pose.normal };
  return writeRibbonSegment({ geometry, segmentIndex, start, end, width: Math.min(width, 0.006) });
}

export function resetSwordCutRibbonGeometry(geometry, workspace) {
  geometry.clearGroups();
  workspace.valid.fill(0);
  workspace.connected.fill(0);
  workspace.renderedSegmentCount = 0;
  workspace.hiddenFragmentCount = 0;
  workspace.continuousRegionTransitionCount = 0;
  workspace.oneSampleSeedUsageCount = 0;
  workspace.maximumRenderedSegmentLength = 0;
  workspace.maximumMidpointToSurfaceError = 0;
}

function reconstructSample(samples, index, workspace, reconstructSurface) {
  const sample = samples[index];
  if (!validateSurfaceBinding(sample?.binding)) {
    workspace.valid[index] = 0;
    return null;
  }
  const pose = reconstructSurface(sample.binding, workspace.poses[index]);
  if (!pose?.point || !pose?.normal || ![pose.point.x, pose.point.y, pose.point.z, pose.normal.x, pose.normal.y, pose.normal.z].every(Number.isFinite)) {
    workspace.valid[index] = 0;
    return null;
  }
  workspace.valid[index] = 1;
  return pose;
}

function validateSegment({ previousSample, sample, start, end, midpointPose, maximumBridgeDistance }) {
  if (!validateSurfaceBinding(previousSample?.binding) || !validateSurfaceBinding(sample?.binding)) return { valid: false, reason: 'invalid_binding' };
  if (previousSample.binding.mesh !== sample.binding.mesh) return { valid: false, reason: 'mesh_discontinuity' };
  if (!areSurfaceAnatomiesCompatible(previousSample.regionId, sample.regionId, previousSample.bodyId, sample.bodyId)) return { valid: false, reason: 'semantic_discontinuity' };
  const segmentLength = start.point.distanceTo(end.point);
  if (segmentLength > maximumBridgeDistance) return { valid: false, reason: 'excessive_segment_length', segmentLength };
  if (start.normal.dot(end.normal) < MIN_SEGMENT_NORMAL_DOT) return { valid: false, reason: 'normal_discontinuity', segmentLength };
  if (!midpointPose?.point) return { valid: false, reason: 'midpoint_unbound', segmentLength };
  if (midpointPose.binding && (
    midpointPose.binding.mesh !== previousSample.binding.mesh
    || !areSurfaceAnatomiesCompatible(sample.regionId, midpointPose.binding.regionId, sample.bodyId, midpointPose.binding.bodyId)
  )) return { valid: false, reason: 'midpoint_semantic_discontinuity', segmentLength };
  midpoint.lerpVectors(start.point, end.point, 0.5);
  const midpointError = midpoint.distanceTo(midpointPose.point);
  if (midpointError > SWORD_CUT_MAX_MIDPOINT_SURFACE_ERROR) return { valid: false, reason: 'midpoint_surface_error', segmentLength, midpointError };
  midpointNormal.addVectors(start.normal, end.normal);
  if (midpointNormal.lengthSq() < 1e-10 || midpointNormal.normalize().dot(midpointPose.normal) < MIN_SEGMENT_NORMAL_DOT) return { valid: false, reason: 'midpoint_normal_discontinuity', segmentLength, midpointError };
  return { valid: true, segmentLength, midpointError };
}

export function updateSwordCutRibbonGeometry({
  geometry,
  workspace,
  samples,
  reconstructSurface,
  resolveMidpointSurface = null,
  attemptLocalRebind = null,
  width = 0.012,
  maximumBridgeDistance = SWORD_CUT_MAX_SEGMENT_LENGTH,
} = {}) {
  resetSwordCutRibbonGeometry(geometry, workspace);
  const sampleCount = Math.min(samples?.length ?? 0, MAX_SWORD_CUT_SURFACE_SAMPLES);
  for (let index = 0; index < sampleCount; index += 1) reconstructSample(samples, index, workspace, reconstructSurface);

  let renderedSegmentCount = 0;
  let renderedPrimitiveCount = 0;
  for (let index = 1; index < sampleCount && renderedPrimitiveCount < MAX_SWORD_CUT_RIBBON_SEGMENTS; index += 1) {
    const previousSample = samples[index - 1];
    const sample = samples[index];
    let start = workspace.poses[index - 1];
    let end = workspace.poses[index];
    let midpointPose = workspace.valid[index - 1] && workspace.valid[index] && !sample.breakBefore
      ? resolveMidpointSurface?.(previousSample, sample, workspace.midpointPoses[index - 1]) ?? null
      : null;
    let result = !workspace.valid[index - 1] || !workspace.valid[index] || sample.breakBefore
      ? { valid: false, reason: sample.breakBefore ? 'explicit_break' : 'invalid_binding' }
      : validateSegment({ previousSample, sample, start, end, midpointPose, maximumBridgeDistance });

    if (!result.valid && result.reason !== 'explicit_break' && attemptLocalRebind?.({
      previousSample,
      sample,
      index,
      reason: result.reason,
      previousValid: Boolean(workspace.valid[index - 1]),
      currentValid: Boolean(workspace.valid[index]),
    }) === true) {
      reconstructSample(samples, index - 1, workspace, reconstructSurface);
      reconstructSample(samples, index, workspace, reconstructSurface);
      start = workspace.poses[index - 1];
      end = workspace.poses[index];
      midpointPose = workspace.valid[index - 1] && workspace.valid[index]
        ? resolveMidpointSurface?.(previousSample, sample, workspace.midpointPoses[index - 1]) ?? null
        : null;
      result = workspace.valid[index - 1] && workspace.valid[index]
        ? validateSegment({ previousSample, sample, start, end, midpointPose, maximumBridgeDistance })
        : { valid: false, reason: 'invalid_binding' };
    }
    if (!result.valid) {
      workspace.hiddenFragmentCount += 1;
      continue;
    }
    if (!writeRibbonSegment({ geometry, segmentIndex: renderedPrimitiveCount, start, end, width })) {
      workspace.hiddenFragmentCount += 1;
      continue;
    }
    workspace.connected[index - 1] = 1;
    workspace.connected[index] = 1;
    workspace.maximumRenderedSegmentLength = Math.max(workspace.maximumRenderedSegmentLength, result.segmentLength);
    workspace.maximumMidpointToSurfaceError = Math.max(workspace.maximumMidpointToSurfaceError, result.midpointError);
    if (previousSample.regionId && sample.regionId && previousSample.regionId !== sample.regionId) workspace.continuousRegionTransitionCount += 1;
    renderedSegmentCount += 1;
    renderedPrimitiveCount += 1;
  }

  for (let index = 0; index < sampleCount && renderedPrimitiveCount < MAX_SWORD_CUT_RIBBON_SEGMENTS; index += 1) {
    if (!workspace.valid[index] || workspace.connected[index]) continue;
    if (!writeSurfaceSeed({ geometry, segmentIndex: renderedPrimitiveCount, pose: workspace.poses[index], sample: samples[index], width })) continue;
    workspace.oneSampleSeedUsageCount += 1;
    renderedPrimitiveCount += 1;
  }

  workspace.renderedSegmentCount = renderedSegmentCount;
  geometry.clearGroups();
  if (renderedPrimitiveCount > 0) {
    geometry.addGroup(0, renderedPrimitiveCount * 6, 0);
    geometry.addGroup(SWORD_CUT_CENTER_INDEX_CAPACITY, renderedPrimitiveCount * 12, 1);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.index.needsUpdate = true;
  }
  return {
    renderedSegmentCount,
    renderedPrimitiveCount,
    hiddenSegmentCount: workspace.hiddenFragmentCount,
    hiddenFragmentCount: workspace.hiddenFragmentCount,
    continuousRegionTransitionCount: workspace.continuousRegionTransitionCount,
    sampleCount,
    oneSampleSeedUsageCount: workspace.oneSampleSeedUsageCount,
    maximumRenderedSegmentLength: workspace.maximumRenderedSegmentLength,
    maximumMidpointToSurfaceError: workspace.maximumMidpointToSurfaceError,
    bounded: sampleCount <= MAX_SWORD_CUT_SURFACE_SAMPLES && renderedPrimitiveCount <= MAX_SWORD_CUT_RIBBON_SEGMENTS,
  };
}
