import * as THREE from 'three';

const MAX_COLLISION_STEP_DISTANCE = 0.12;

function pointInRect(point, rect) {
  return point.x >= rect.minX && point.x <= rect.maxX && point.z >= rect.minZ && point.z <= rect.maxZ;
}

function circleIntersectsRect(point, radius, rect) {
  const closestX = THREE.MathUtils.clamp(point.x, rect.minX, rect.maxX);
  const closestZ = THREE.MathUtils.clamp(point.z, rect.minZ, rect.maxZ);
  const dx = point.x - closestX;
  const dz = point.z - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

function circleIntersectsSegment(point, radius, rect) {
  const from = rect.from; const to = rect.to;
  if (!from || !to) return circleIntersectsRect(point, radius, rect);
  const dx = to.x - from.x; const dz = to.z - from.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 0.0001) return circleIntersectsRect(point, radius, rect);
  const t = THREE.MathUtils.clamp(((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSq, 0, 1);
  const closestX = from.x + dx * t;
  const closestZ = from.z + dz * t;
  const px = point.x - closestX;
  const pz = point.z - closestZ;
  const combinedRadius = radius + (rect.thickness ?? 0) / 2;
  return px * px + pz * pz < combinedRadius * combinedRadius;
}

function pointInPolygon(point, footprint) {
  let inside = false;
  for (let i = 0, j = footprint.length - 1; i < footprint.length; j = i, i += 1) {
    const xi = footprint[i][0]; const zi = footprint[i][1];
    const xj = footprint[j][0]; const zj = footprint[j][1];
    const intersects = ((zi > point.z) !== (zj > point.z))
      && (point.x < ((xj - xi) * (point.z - zi)) / ((zj - zi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function sampleSegmentSurface(point, surface) {
  const [x0, z0] = surface.from;
  const [x1, z1] = surface.to;
  const dx = x1 - x0; const dz = z1 - z0;
  const length = Math.hypot(dx, dz);
  if (length <= 0.0001) return null;
  const ux = dx / length; const uz = dz / length;
  const px = point.x - x0; const pz = point.z - z0;
  const along = px * ux + pz * uz;
  const across = Math.abs(px * -uz + pz * ux);
  if (along < 0 || along > length || across > (surface.width ?? 1) / 2) return null;
  const t = THREE.MathUtils.clamp(along / length, 0, 1);
  if (surface.kind === 'bridgeDeck') return { y: surface.y ?? 0, t };
  const steppedT = surface.kind === 'stairRamp' && surface.steps > 0
    ? Math.floor(t * surface.steps) / surface.steps
    : t;
  return { y: THREE.MathUtils.lerp(surface.y0 ?? 0, surface.y1 ?? 0, steppedT), t: steppedT };
}

export class CollisionWorld {
  constructor({ walkableRects, blockerRects = [], playerRadius = 0.35, walkableSurfaces = [], defaultFloorY = 0 }) {
    this.walkableRects = walkableRects;
    this.walkableSurfaces = walkableSurfaces;
    this.blockerRects = blockerRects;
    this.playerRadius = playerRadius;
    this.defaultFloorY = defaultFloorY;
    this.eyeHeight = 1.55;
    this.maxStepUp = 0.38;
  }

  removeBlocker(blockerRect) {
    this.blockerRects = this.blockerRects.filter((rect) => rect !== blockerRect);
  }

  sampleWalkableY(x, z, fallbackY = this.defaultFloorY) {
    const point = { x, z };
    let best = { y: fallbackY, priority: -Infinity, kind: 'fallback', surface: null };
    this.walkableSurfaces.forEach((surface) => {
      let sample = null;
      if ((surface.kind === 'flatPolygon' || surface.kind === 'platformTop') && pointInPolygon(point, surface.footprint ?? [])) {
        sample = { y: surface.y ?? fallbackY, t: 0 };
      } else if (['ramp', 'stairRamp', 'bridgeDeck'].includes(surface.kind)) {
        sample = sampleSegmentSurface(point, surface);
      }
      if (!sample) return;
      const priority = surface.priority ?? 0;
      if (priority > best.priority || (priority === best.priority && sample.y > best.y)) {
        best = { y: sample.y, priority, kind: surface.kind, surface, t: sample.t };
      }
    });
    return best;
  }

  canStandAt(position) {
    const testPoint = { x: position.x, z: position.z };
    const inWalkableSpace = this.walkableRects.some((rect) => pointInRect(testPoint, rect));

    if (!inWalkableSpace) return false;

    const targetSurface = this.sampleWalkableY(position.x, position.z, this.defaultFloorY);
    const currentFloorY = Number.isFinite(position.y) ? position.y - this.eyeHeight : this.defaultFloorY;
    const heightDelta = targetSurface.y - currentFloorY;
    if (heightDelta > this.maxStepUp && !['ramp', 'stairRamp'].includes(targetSurface.kind)) return false;

    return !this.blockerRects.some((rect) => {
      if (rect.type === 'canal' && targetSurface.kind === 'bridgeDeck') return false;
      return rect.blockerShape === 'segment'
        ? circleIntersectsSegment(testPoint, this.playerRadius, rect)
        : circleIntersectsRect(testPoint, this.playerRadius, rect);
    });
  }

  canStandAtFloorPosition(position) {
    if (!position) return false;
    return this.canStandAt(new THREE.Vector3(position.x, position.y + this.eyeHeight, position.z));
  }

  moveWithCollision(position, movement) {
    const distance = movement.length();
    const steps = Math.max(1, Math.ceil(distance / MAX_COLLISION_STEP_DISTANCE));
    const stepMovement = movement.clone().multiplyScalar(1 / steps);
    let next = position.clone();

    for (let i = 0; i < steps; i += 1) {
      next = this.moveSingleStepWithCollision(next, stepMovement);
    }

    return next;
  }

  moveSingleStepWithCollision(position, movement) {
    // Axis-separated movement gives simple sliding along walls without a physics engine.
    const next = position.clone();
    const xStep = next.clone();
    xStep.x += movement.x;

    if (this.canStandAt(xStep)) {
      next.x = xStep.x;
    }

    const zStep = next.clone();
    zStep.z += movement.z;

    if (this.canStandAt(zStep)) {
      next.z = zStep.z;
    }

    return next;
  }
}
