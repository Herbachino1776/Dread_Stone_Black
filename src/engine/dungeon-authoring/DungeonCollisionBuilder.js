import { CollisionWorld } from '../../game/Collision.js';
import { asArray } from './DungeonDefinitionTypes.js';

function toVector3(value) {
  return {
    x: Number(value?.x ?? value?.[0] ?? 0),
    y: Number(value?.y ?? value?.[1] ?? 0),
    z: Number(value?.z ?? value?.[2] ?? 0),
  };
}

function blockerRect(blocker) {
  return {
    id: blocker.id,
    minX: blocker.minX,
    maxX: blocker.maxX,
    minZ: blocker.minZ,
    maxZ: blocker.maxZ,
    height: blocker.height,
    type: blocker.type,
    tags: blocker.tags ?? [],
    userData: blocker.userData ?? {},
  };
}

function gapCenter(gap) {
  return toVector3(gap.position ?? gap.navWaypoint);
}

function collectWallGaps(definition, room) {
  const gaps = [];
  asArray(definition.doors ?? definition.connectors).forEach((door) => {
    asArray(door.wallGaps).forEach((gap) => {
      if (gap.roomId === room.id) {
        gaps.push({ ...gap, id: `${door.id}:${gap.roomId}`, width: gap.width ?? door.width ?? 3.6 });
      }
    });

    if (door.fromRoom === room.id || door.toRoom === room.id) {
      gaps.push({ id: door.id, position: door.position, width: door.width ?? 3.6 });
    }
  });

  asArray(definition.exits).forEach((exit) => {
    asArray(exit.wallGaps).forEach((gap) => {
      if (gap.roomId === room.id) {
        gaps.push({ ...gap, id: `${exit.id}:${gap.roomId}`, width: gap.width ?? exit.width ?? 3.5 });
      }
    });
  });

  return gaps;
}

function wallBlocker(id, type, minX, maxX, minZ, maxZ, height) {
  return {
    id,
    type,
    minX,
    maxX,
    minZ,
    maxZ,
    height,
    tags: ['compiled-wall'],
    userData: { generatedBy: 'DungeonCollisionBuilder' },
  };
}

function buildWallBlockersForRoom(definition, room) {
  if (room.wallGeometry === false || room.visibleGeometry === false) return [];

  const wallThickness = definition.geometry?.wallThickness ?? 0.35;
  const wallHeight = (room.ceilingY ?? definition.defaultCeilingY ?? 3.2) - (room.floorY ?? definition.defaultFloorY ?? 0);
  const gaps = collectWallGaps(definition, room);
  const blockers = [];
  const addHorizontal = (z, side) => {
    const sideGaps = gaps
      .map((gap) => ({ ...gap, center: gapCenter(gap) }))
      .filter((gap) => Math.abs(gap.center.z - z) < 1.1 && gap.center.x >= room.minX - 0.2 && gap.center.x <= room.maxX + 0.2)
      .sort((a, b) => a.center.x - b.center.x);
    let cursor = room.minX;
    sideGaps.forEach((gap) => {
      const start = Math.max(room.minX, gap.center.x - gap.width / 2);
      const end = Math.min(room.maxX, gap.center.x + gap.width / 2);
      if (start - cursor > 0.2) {
        blockers.push(wallBlocker(
          `${definition.id}-${room.id}-wall-blocker-z-${z}-${blockers.length}`,
          'wall',
          cursor,
          start,
          z + side * wallThickness / 2 - wallThickness / 2,
          z + side * wallThickness / 2 + wallThickness / 2,
          wallHeight,
        ));
      }
      cursor = Math.max(cursor, end);
    });
    if (room.maxX - cursor > 0.2) {
      blockers.push(wallBlocker(
        `${definition.id}-${room.id}-wall-blocker-z-${z}-${blockers.length}`,
        'wall',
        cursor,
        room.maxX,
        z + side * wallThickness / 2 - wallThickness / 2,
        z + side * wallThickness / 2 + wallThickness / 2,
        wallHeight,
      ));
    }
  };

  const addVertical = (x, side) => {
    const sideGaps = gaps
      .map((gap) => ({ ...gap, center: gapCenter(gap) }))
      .filter((gap) => Math.abs(gap.center.x - x) < 1.1 && gap.center.z >= room.minZ - 0.2 && gap.center.z <= room.maxZ + 0.2)
      .sort((a, b) => a.center.z - b.center.z);
    let cursor = room.minZ;
    sideGaps.forEach((gap) => {
      const start = Math.max(room.minZ, gap.center.z - gap.width / 2);
      const end = Math.min(room.maxZ, gap.center.z + gap.width / 2);
      if (start - cursor > 0.2) {
        blockers.push(wallBlocker(
          `${definition.id}-${room.id}-wall-blocker-x-${x}-${blockers.length}`,
          'wall',
          x + side * wallThickness / 2 - wallThickness / 2,
          x + side * wallThickness / 2 + wallThickness / 2,
          cursor,
          start,
          wallHeight,
        ));
      }
      cursor = Math.max(cursor, end);
    });
    if (room.maxZ - cursor > 0.2) {
      blockers.push(wallBlocker(
        `${definition.id}-${room.id}-wall-blocker-x-${x}-${blockers.length}`,
        'wall',
        x + side * wallThickness / 2 - wallThickness / 2,
        x + side * wallThickness / 2 + wallThickness / 2,
        cursor,
        room.maxZ,
        wallHeight,
      ));
    }
  };

  addHorizontal(room.minZ, -1);
  addHorizontal(room.maxZ, 1);
  addVertical(room.minX, -1);
  addVertical(room.maxX, 1);

  return blockers;
}

function buildWallBlockers(definition) {
  if (definition.collision?.wallBlockers === false) return [];
  return asArray(definition.rooms).flatMap((room) => buildWallBlockersForRoom(definition, room));
}

export function buildDungeonCollision(definition) {
  const walkableRects = asArray(definition.rooms).map((room) => ({
    id: room.id,
    minX: room.minX,
    maxX: room.maxX,
    minZ: room.minZ,
    maxZ: room.maxZ,
    roomId: room.id,
    tags: room.tags ?? [],
  }));
  const blockers = asArray(definition.blockers);
  const wallBlockers = buildWallBlockers(definition);
  const blockerRects = blockers
    .filter((blocker) => blocker.blocksPlayer !== false)
    .map(blockerRect)
    .concat(wallBlockers);
  const enemyBlockerRects = blockers
    .filter((blocker) => blocker.blocksEnemies !== false)
    .map(blockerRect)
    .concat(wallBlockers);
  const lineOfMovementBlockerRects = blockers
    .filter((blocker) => blocker.blocksLineOfMovement !== false)
    .map(blockerRect)
    .concat(wallBlockers);

  return {
    walkableRects,
    blockerRects,
    enemyBlockerRects,
    lineOfMovementBlockerRects,
    collisionWorld: new CollisionWorld({
      walkableRects,
      blockerRects,
      playerRadius: definition.collision?.playerRadius ?? 0.35,
    }),
  };
}
