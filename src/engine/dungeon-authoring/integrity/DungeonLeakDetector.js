import { buildDungeonCollision } from '../DungeonCollisionBuilder.js';
import { asArray, rectCenter } from '../DungeonDefinitionTypes.js';
import {
  INTEGRITY_CATEGORY,
  INTEGRITY_CODES,
  expandRect,
  pointInRect,
  unionRect,
} from './DungeonIntegrityTypes.js';

const DEFAULT_SAMPLE_STEP = 1;
const MAX_FLOOD_CELLS = 40000;

function keyFor(point, step) {
  return `${Math.round(point.x / step)}:${Math.round(point.z / step)}`;
}

function snapPoint(point, step) {
  return {
    x: Math.round(point.x / step) * step,
    y: point.y ?? 0,
    z: Math.round(point.z / step) * step,
  };
}

function findStartPoint(definition) {
  const playerSpawn = asArray(definition.spawns).find((spawn) => spawn.kind === 'player');
  if (playerSpawn?.position) return playerSpawn.position;
  const firstRoom = asArray(definition.rooms)[0];
  return firstRoom ? rectCenter(firstRoom) : null;
}

function insideAnyRect(point, rects, padding = 0) {
  return rects.some((rect) => pointInRect(point, rect, padding));
}

function floodReachable({ collisionWorld, start, bounds, step }) {
  if (!start || !bounds || !collisionWorld.canStandAt(start)) {
    return { reachable: [], stoppedEarly: false };
  }

  const queue = [snapPoint(start, step)];
  const seen = new Set([keyFor(queue[0], step)]);
  const reachable = [];
  const neighbors = [
    { x: step, z: 0 },
    { x: -step, z: 0 },
    { x: 0, z: step },
    { x: 0, z: -step },
  ];

  while (queue.length) {
    const point = queue.shift();
    reachable.push(point);
    if (reachable.length > MAX_FLOOD_CELLS) {
      return { reachable, stoppedEarly: true };
    }

    neighbors.forEach((delta) => {
      const next = { x: point.x + delta.x, y: point.y, z: point.z + delta.z };
      if (!pointInRect(next, bounds)) return;
      const key = keyFor(next, step);
      if (seen.has(key)) return;
      if (!collisionWorld.canStandAt(next)) return;
      seen.add(key);
      queue.push(next);
    });
  }

  return { reachable, stoppedEarly: false };
}

export function detectWalkableLeaks(definition, report, {
  sampleStep = DEFAULT_SAMPLE_STEP,
  intendedBounds = null,
  start = null,
} = {}) {
  const collision = buildDungeonCollision(definition);
  const roomBounds = unionRect(collision.walkableRects);
  const validationBounds = intendedBounds ?? definition.integrity?.intendedBounds ?? roomBounds;
  const floodBounds = roomBounds ? expandRect(roomBounds, sampleStep * 2) : null;
  const startPoint = start ?? findStartPoint(definition);

  if (!roomBounds || !startPoint) return { reachable: [], leaks: [] };

  const flood = floodReachable({
    collisionWorld: collision.collisionWorld,
    start: startPoint,
    bounds: floodBounds,
    step: sampleStep,
  });

  const leaks = flood.reachable.filter((point) => !pointInRect(point, validationBounds, sampleStep * 0.5));
  const uniqueLeaks = [];
  const seenLeakKeys = new Set();
  leaks.forEach((point) => {
    const key = keyFor(point, sampleStep * 4);
    if (seenLeakKeys.has(key)) return;
    seenLeakKeys.add(key);
    uniqueLeaks.push(point);
  });

  uniqueLeaks.slice(0, 12).forEach((point) => {
    report.error({
      code: INTEGRITY_CODES.WALKABLE_LEAK,
      category: INTEGRITY_CATEGORY.LEAK,
      position: point,
      message: `Reachable walkable sample escapes the intended bounds near (${point.x.toFixed(1)}, ${point.z.toFixed(1)}).`,
      suggestedFix: 'Seal the room edge, add a blocker, or declare the space as an intentional opening/exit.',
    });
  });

  if (flood.stoppedEarly) {
    report.warning({
      code: INTEGRITY_CODES.WALKABLE_LEAK,
      category: INTEGRITY_CATEGORY.LEAK,
      position: startPoint,
      message: `Leak flood reached the ${MAX_FLOOD_CELLS} cell cap before finishing.`,
      suggestedFix: 'Reduce validation bounds or increase sampling size for this location.',
    });
  }

  report.debug.leakMarkers.push({
    type: 'walkableFlood',
    start: startPoint,
    sampleStep,
    reachableCount: flood.reachable.length,
    leakCount: leaks.length,
    bounds: floodBounds,
  });

  uniqueLeaks.slice(0, 12).forEach((point) => {
    report.debug.leakMarkers.push({ type: 'leak', position: point });
  });

  return { reachable: flood.reachable, leaks };
}

export function canReachRect({ walkableRects, blockers, start, targetRect, bounds, sampleStep = DEFAULT_SAMPLE_STEP }) {
  const collision = buildDungeonCollision({
    id: 'integrity-temporary-world',
    rooms: walkableRects.map((rect, index) => ({ id: rect.id ?? `walkable-${index}`, ...rect, wallGeometry: false })),
    blockers,
    collision: { playerRadius: 0.5, wallBlockers: false },
  });

  const flood = floodReachable({
    collisionWorld: collision.collisionWorld,
    start,
    bounds,
    step: sampleStep,
  });

  return flood.reachable.some((point) => pointInRect(point, targetRect, sampleStep * 0.5));
}
