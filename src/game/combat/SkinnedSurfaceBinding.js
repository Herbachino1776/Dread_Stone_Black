import * as THREE from 'three';

export const WOUND_SURFACE_BIAS = 0.002;
export const MAX_SLASH_SURFACE_SAMPLES = 12;
export const MIN_SLASH_SURFACE_SAMPLES = 3;
export const MAX_SURFACE_PROJECTION_DISTANCE = 0.085;

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const closest = new THREE.Vector3();
const triangle = new THREE.Triangle();

export function getTriangleVertexIndices(geometry, triangleIndex) {
  const index = geometry.index;
  const offset = triangleIndex * 3;
  return index
    ? [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)]
    : [offset, offset + 1, offset + 2];
}

export function reconstructSkinnedSurface(binding, target = {}) {
  const mesh = binding?.mesh;
  const indices = binding?.triangleIndices;
  if (!mesh?.isSkinnedMesh || !mesh.parent || !indices || indices.some((index) => index < 0 || index >= mesh.geometry.attributes.position.count)) return null;
  const va = mesh.getVertexPosition(indices[0], new THREE.Vector3());
  const vb = mesh.getVertexPosition(indices[1], new THREE.Vector3());
  const vc = mesh.getVertexPosition(indices[2], new THREE.Vector3());
  mesh.localToWorld(va); mesh.localToWorld(vb); mesh.localToWorld(vc);
  const barycentric = binding.barycentric;
  const point = target.point ?? new THREE.Vector3();
  point.set(0, 0, 0).addScaledVector(va, barycentric.x).addScaledVector(vb, barycentric.y).addScaledVector(vc, barycentric.z);
  const normal = target.normal ?? new THREE.Vector3();
  normal.subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va)).normalize();
  if (normal.dot(binding.referenceNormal) < 0) normal.negate();
  return { point, normal, vertices: [va, vb, vc] };
}

export function findClosestSkinnedSurface(skinnedMeshes, worldPoint, { regionId = null, bodyId = null, referenceNormal = null, maximumDistance = MAX_SURFACE_PROJECTION_DISTANCE } = {}) {
  let best = null;
  let bestDistanceSq = maximumDistance * maximumDistance;
  for (const mesh of skinnedMeshes ?? []) {
    const geometry = mesh.geometry;
    const position = geometry?.attributes?.position;
    if (!mesh.visible || !position) continue;
    mesh.updateMatrixWorld(true);
    mesh.skeleton?.update?.();
    const triangleCount = (geometry.index?.count ?? position.count) / 3;
    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      const indices = getTriangleVertexIndices(geometry, triangleIndex);
      mesh.getVertexPosition(indices[0], a); mesh.getVertexPosition(indices[1], b); mesh.getVertexPosition(indices[2], c);
      mesh.localToWorld(a); mesh.localToWorld(b); mesh.localToWorld(c);
      triangle.set(a, b, c);
      if (triangle.getArea() < 1e-10) continue;
      triangle.closestPointToPoint(worldPoint, closest);
      const distanceSq = closest.distanceToSquared(worldPoint);
      if (distanceSq >= bestDistanceSq) continue;
      const barycentric = triangle.getBarycoord(closest, new THREE.Vector3());
      if (!barycentric || Math.abs(barycentric.x + barycentric.y + barycentric.z - 1) > 1e-4) continue;
      const normal = triangle.getNormal(new THREE.Vector3());
      if (referenceNormal && normal.dot(referenceNormal) < 0) normal.negate();
      bestDistanceSq = distanceSq;
      best = {
        kind: 'skinned_triangle',
        mesh,
        meshName: mesh.name || mesh.uuid,
        triangleIndex,
        triangleIndices: indices,
        barycentric,
        referenceNormal: normal,
        regionId,
        bodyId,
        sourcePoint: worldPoint.clone(),
        distanceAtBind: Math.sqrt(distanceSq),
      };
    }
  }
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
