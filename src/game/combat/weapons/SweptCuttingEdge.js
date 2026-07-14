import * as THREE from 'three';

export function createCuttingEdgePath(localPoints) {
  if (!Array.isArray(localPoints) || localPoints.length < 2) throw new Error('A cutting edge requires at least two local points.');
  const points = localPoints.map((point) => point.clone());
  const segmentLengths = [];
  let totalLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = points[index - 1].distanceTo(points[index]);
    segmentLengths.push(length);
    totalLength += length;
  }
  return Object.freeze({ points: Object.freeze(points), segmentLengths: Object.freeze(segmentLengths), totalLength });
}

export function sampleCuttingEdgeLocal(edgePath, edgeFraction, target = new THREE.Vector3()) {
  let distance = THREE.MathUtils.clamp(edgeFraction, 0, 1) * edgePath.totalLength;
  for (let index = 0; index < edgePath.segmentLengths.length; index += 1) {
    const segmentLength = edgePath.segmentLengths[index];
    if (distance <= segmentLength || index === edgePath.segmentLengths.length - 1) {
      const alpha = segmentLength > 0 ? THREE.MathUtils.clamp(distance / segmentLength, 0, 1) : 0;
      return target.lerpVectors(edgePath.points[index], edgePath.points[index + 1], alpha);
    }
    distance -= segmentLength;
  }
  return target.copy(edgePath.points.at(-1));
}

function resolveSampleCount(previousStart, previousEnd, currentStart, currentEnd, radius, baseSampleCount, maxSampleCount) {
  const previousX = previousEnd.x - previousStart.x;
  const previousY = previousEnd.y - previousStart.y;
  const previousZ = previousEnd.z - previousStart.z;
  const currentX = currentEnd.x - currentStart.x;
  const currentY = currentEnd.y - currentStart.y;
  const currentZ = currentEnd.z - currentStart.z;
  const rotationTravel = Math.hypot(currentX - previousX, currentY - previousY, currentZ - previousZ);
  const maximumGap = Math.max(1e-5, radius * 2);
  let intervals = baseSampleCount - 1;
  while (intervals < maxSampleCount - 1 && rotationTravel / intervals > maximumGap) intervals *= 2;
  return Math.min(maxSampleCount, intervals + 1);
}

export function resolveCuttingEdgeSampleCount(previousStart, previousEnd, currentStart, currentEnd, { radius, baseSampleCount = 3, maxSampleCount = 9 } = {}) {
  return resolveSampleCount(previousStart, previousEnd, currentStart, currentEnd, radius, baseSampleCount, maxSampleCount);
}

export function createSweptCuttingEdgeScratch() {
  return {
    currentStart: new THREE.Vector3(),
    currentEnd: new THREE.Vector3(),
    localSample: new THREE.Vector3(),
    previousSample: new THREE.Vector3(),
    currentSample: new THREE.Vector3(),
    selectedPrevious: new THREE.Vector3(),
    selectedCurrent: new THREE.Vector3(),
    contact: { hit: null, toi: Infinity, sampleT: 0.5, anchorDistance: Infinity, sampleCount: 0 },
  };
}

export function sweepCuttingEdge({
  edgePath,
  previousPosition,
  previousQuaternion,
  currentPosition,
  currentQuaternion,
  previousStart,
  previousEnd,
  radius,
  baseSampleCount = 3,
  maxSampleCount = 9,
  physics,
  colliderFilter,
  stableAnchorT = 0.5,
  toiEpsilon = 1e-5,
  scratch,
}) {
  scratch.currentStart.copy(edgePath.points[0]).applyQuaternion(currentQuaternion).add(currentPosition);
  scratch.currentEnd.copy(edgePath.points.at(-1)).applyQuaternion(currentQuaternion).add(currentPosition);
  const sampleCount = resolveSampleCount(previousStart, previousEnd, scratch.currentStart, scratch.currentEnd, radius, baseSampleCount, maxSampleCount);
  const contact = scratch.contact;
  contact.hit = null;
  contact.toi = Infinity;
  contact.sampleT = 0.5;
  contact.anchorDistance = Infinity;
  contact.sampleCount = sampleCount;
  const positionsPrepared = physics.prepareWeaponSweepBatch?.() === true;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const sampleT = sampleIndex / (sampleCount - 1);
    sampleCuttingEdgeLocal(edgePath, sampleT, scratch.localSample);
    const samplePrevious = scratch.previousSample.copy(scratch.localSample).applyQuaternion(previousQuaternion).add(previousPosition);
    const sampleCurrent = scratch.currentSample.copy(scratch.localSample).applyQuaternion(currentQuaternion).add(currentPosition);
    if (samplePrevious.distanceToSquared(sampleCurrent) < 1e-8) continue;
    const sampleHit = physics.castWeaponTip(samplePrevious, sampleCurrent, radius, colliderFilter, positionsPrepared);
    if (!sampleHit?.collider) continue;
    const toi = THREE.MathUtils.clamp(sampleHit.time_of_impact ?? 0, 0, 1);
    const anchorDistance = Math.abs(sampleT - stableAnchorT);
    const earlier = toi < contact.toi - toiEpsilon;
    const sameTimeStableAnchor = Math.abs(toi - contact.toi) <= toiEpsilon && anchorDistance < contact.anchorDistance;
    if (!earlier && !sameTimeStableAnchor) continue;
    contact.hit = sampleHit;
    contact.toi = toi;
    contact.sampleT = sampleT;
    contact.anchorDistance = anchorDistance;
    scratch.selectedPrevious.copy(samplePrevious);
    scratch.selectedCurrent.copy(sampleCurrent);
  }
  return contact;
}
