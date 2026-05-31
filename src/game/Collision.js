import * as THREE from 'three';

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

export class CollisionWorld {
  constructor({ walkableRects, blockerRects = [], playerRadius = 0.35 }) {
    this.walkableRects = walkableRects;
    this.blockerRects = blockerRects;
    this.playerRadius = playerRadius;
  }

  removeBlocker(blockerRect) {
    this.blockerRects = this.blockerRects.filter((rect) => rect !== blockerRect);
  }

  canStandAt(position) {
    const testPoint = { x: position.x, z: position.z };
    const inWalkableSpace = this.walkableRects.some((rect) => pointInRect(testPoint, rect));

    if (!inWalkableSpace) {
      return false;
    }

    return !this.blockerRects.some((rect) => circleIntersectsRect(testPoint, this.playerRadius, rect));
  }

  moveWithCollision(position, movement) {
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
