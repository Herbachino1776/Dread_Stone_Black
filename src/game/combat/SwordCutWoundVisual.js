import * as THREE from 'three';

export const MAX_SWORD_CUT_SURFACE_SAMPLES = 48;
export const MAX_SWORD_CUT_RIBBON_SEGMENTS = MAX_SWORD_CUT_SURFACE_SAMPLES - 1;
export const SWORD_CUT_VERTICES_PER_SEGMENT = 12;
export const SWORD_CUT_INDICES_PER_SEGMENT = 18;
export const SWORD_CUT_CENTER_INDEX_CAPACITY = MAX_SWORD_CUT_RIBBON_SEGMENTS * 6;

const startTangent = new THREE.Vector3();
const endTangent = new THREE.Vector3();
const startSide = new THREE.Vector3();
const endSide = new THREE.Vector3();

function makePose() {
  return {
    point: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    vertices: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
  };
}

export function createSwordCutRibbonWorkspace() {
  return {
    poses: Array.from({ length: MAX_SWORD_CUT_SURFACE_SAMPLES }, makePose),
    valid: new Uint8Array(MAX_SWORD_CUT_SURFACE_SAMPLES),
    renderedSegmentCount: 0,
    hiddenFragmentCount: 0,
    continuousRegionTransitionCount: 0,
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
  const lipOuterBias = 0.00085;
  const lipCrestBias = 0.0021;
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

export function resetSwordCutRibbonGeometry(geometry, workspace) {
  geometry.clearGroups();
  workspace.valid.fill(0);
  workspace.renderedSegmentCount = 0;
  workspace.hiddenFragmentCount = 0;
  workspace.continuousRegionTransitionCount = 0;
}

export function updateSwordCutRibbonGeometry({
  geometry,
  workspace,
  samples,
  reconstructSurface,
  width = 0.012,
  maximumBridgeDistance = 0.16,
} = {}) {
  resetSwordCutRibbonGeometry(geometry, workspace);
  const sampleCount = Math.min(samples?.length ?? 0, MAX_SWORD_CUT_SURFACE_SAMPLES);
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = samples[index];
    if (!sample?.binding) continue;
    const pose = reconstructSurface(sample.binding, workspace.poses[index]);
    if (!pose?.point || !pose?.normal || ![pose.point.x, pose.point.y, pose.point.z, pose.normal.x, pose.normal.y, pose.normal.z].every(Number.isFinite)) continue;
    workspace.valid[index] = 1;
  }

  let renderedSegmentCount = 0;
  for (let index = 1; index < sampleCount && renderedSegmentCount < MAX_SWORD_CUT_RIBBON_SEGMENTS; index += 1) {
    const previousSample = samples[index - 1];
    const sample = samples[index];
    const start = workspace.poses[index - 1];
    const end = workspace.poses[index];
    const invalid = !workspace.valid[index - 1]
      || !workspace.valid[index]
      || sample.breakBefore
      || previousSample.binding?.mesh !== sample.binding?.mesh
      || start.point.distanceTo(end.point) > maximumBridgeDistance;
    if (invalid) {
      workspace.hiddenFragmentCount += 1;
      continue;
    }
    if (!writeRibbonSegment({ geometry, segmentIndex: renderedSegmentCount, start, end, width })) {
      workspace.hiddenFragmentCount += 1;
      continue;
    }
    if (previousSample.regionId && sample.regionId && previousSample.regionId !== sample.regionId) workspace.continuousRegionTransitionCount += 1;
    renderedSegmentCount += 1;
  }

  workspace.renderedSegmentCount = renderedSegmentCount;
  geometry.clearGroups();
  if (renderedSegmentCount > 0) {
    geometry.addGroup(0, renderedSegmentCount * 6, 0);
    geometry.addGroup(SWORD_CUT_CENTER_INDEX_CAPACITY, renderedSegmentCount * 12, 1);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.index.needsUpdate = true;
  }
  return {
    renderedSegmentCount,
    hiddenFragmentCount: workspace.hiddenFragmentCount,
    continuousRegionTransitionCount: workspace.continuousRegionTransitionCount,
    sampleCount,
    bounded: sampleCount <= MAX_SWORD_CUT_SURFACE_SAMPLES && renderedSegmentCount <= MAX_SWORD_CUT_RIBBON_SEGMENTS,
  };
}
