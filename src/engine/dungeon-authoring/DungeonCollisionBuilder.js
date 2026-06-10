import { CollisionWorld } from '../../game/Collision.js';
import { asArray } from './DungeonDefinitionTypes.js';

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
  const blockerRects = blockers
    .filter((blocker) => blocker.blocksPlayer !== false)
    .map(blockerRect);
  const enemyBlockerRects = blockers
    .filter((blocker) => blocker.blocksEnemies !== false)
    .map(blockerRect);
  const lineOfMovementBlockerRects = blockers
    .filter((blocker) => blocker.blocksLineOfMovement !== false)
    .map(blockerRect);

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
