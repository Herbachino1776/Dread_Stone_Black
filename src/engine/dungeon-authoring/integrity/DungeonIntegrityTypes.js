export const INTEGRITY_SEVERITY = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
});

export const INTEGRITY_CATEGORY = Object.freeze({
  WALL_COLLISION: 'wallCollision',
  COLLISION_VISUAL: 'collisionVisual',
  ROOM_EDGE: 'roomEdge',
  LEAK: 'leak',
  FACADE: 'facade',
  AUTHORING: 'authoring',
});

export const INTEGRITY_CODES = Object.freeze({
  WALL_MISSING_COLLISION: 'WALL_MISSING_COLLISION',
  COLLISION_WITHOUT_VISUAL: 'COLLISION_WITHOUT_VISUAL',
  ROOM_EDGE_UNSEALED: 'ROOM_EDGE_UNSEALED',
  DOORWAY_MISMATCH: 'DOORWAY_MISMATCH',
  EXIT_TRIGGER_OUTSIDE_OPENING: 'EXIT_TRIGGER_OUTSIDE_OPENING',
  WALKABLE_LEAK: 'WALKABLE_LEAK',
  FACADE_WALK_BEHIND_LEAK: 'FACADE_WALK_BEHIND_LEAK',
  FACADE_TRIGGER_NOT_EMBEDDED: 'FACADE_TRIGGER_NOT_EMBEDDED',
  WALL_SEGMENT_GAP: 'WALL_SEGMENT_GAP',
  BLOCKER_OFFSET_FROM_WALL: 'BLOCKER_OFFSET_FROM_WALL',
  PROP_BLOCKS_CRITICAL_PATH: 'PROP_BLOCKS_CRITICAL_PATH',
  CHALICE_NOT_GROUNDED: 'CHALICE_NOT_GROUNDED',
});

export const OPENING_KIND = Object.freeze({
  DOORWAY: 'doorway',
  EXIT: 'exit',
  PASSAGE: 'passage',
  ARCH: 'arch',
  GAP: 'gap',
});

export const INVISIBLE_BLOCKER_PURPOSES = Object.freeze([
  'safetyBoundary',
  'worldBoundary',
  'futureGate',
  'debugOnly',
]);

export const DEFAULT_STRUCTURAL_PROP_KINDS = Object.freeze([
  'facade',
  'gate',
  'lintel',
  'pillar',
  'pylon',
  'solid_gate',
  'wall',
]);

export function rectCenter(rect, y = 0) {
  return {
    x: (Number(rect.minX) + Number(rect.maxX)) / 2,
    y,
    z: (Number(rect.minZ) + Number(rect.maxZ)) / 2,
  };
}

export function rectWidth(rect) {
  return Number(rect.maxX) - Number(rect.minX);
}

export function rectDepth(rect) {
  return Number(rect.maxZ) - Number(rect.minZ);
}

export function pointInRect(point, rect, padding = 0) {
  return point.x >= rect.minX - padding
    && point.x <= rect.maxX + padding
    && point.z >= rect.minZ - padding
    && point.z <= rect.maxZ + padding;
}

export function rectsIntersect(a, b, padding = 0) {
  return a.minX <= b.maxX + padding
    && a.maxX >= b.minX - padding
    && a.minZ <= b.maxZ + padding
    && a.maxZ >= b.minZ - padding;
}

export function unionRect(rects) {
  if (!rects.length) return null;
  return rects.reduce((acc, rect) => ({
    minX: Math.min(acc.minX, rect.minX),
    maxX: Math.max(acc.maxX, rect.maxX),
    minZ: Math.min(acc.minZ, rect.minZ),
    maxZ: Math.max(acc.maxZ, rect.maxZ),
  }), { ...rects[0] });
}

export function expandRect(rect, padding) {
  return {
    minX: rect.minX - padding,
    maxX: rect.maxX + padding,
    minZ: rect.minZ - padding,
    maxZ: rect.maxZ + padding,
  };
}
