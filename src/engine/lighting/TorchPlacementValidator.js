import { asArray } from '../dungeon-authoring/DungeonDefinitionTypes.js';

const VALID_WALL_SIDES = new Set(['north', 'south', 'east', 'west']);

function pointInRect(point, rect, padding = 0) {
  return point.x >= rect.minX - padding && point.x <= rect.maxX + padding
    && point.z >= rect.minZ - padding && point.z <= rect.maxZ + padding;
}

function rectDistance(point, rect) {
  const dx = Math.max(rect.minX - point.x, 0, point.x - rect.maxX);
  const dz = Math.max(rect.minZ - point.z, 0, point.z - rect.maxZ);
  return Math.sqrt(dx * dx + dz * dz);
}

function pointDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function positionOf(value, fallbackY = 0) {
  if (!value) return null;
  return {
    x: Number(value.x ?? value[0] ?? 0),
    y: Number(value.y ?? value[1] ?? fallbackY),
    z: Number(value.z ?? value[2] ?? 0),
  };
}

function addIssue(target, severity, message, id = null) {
  target.push({ severity, message, id, source: 'torch-placement' });
}

function distanceToRoomWall(point, room) {
  if (!room) return Infinity;
  return Math.min(
    Math.abs(point.x - room.minX),
    Math.abs(point.x - room.maxX),
    Math.abs(point.z - room.minZ),
    Math.abs(point.z - room.maxZ),
  );
}

function nearestWallNormal(point, room) {
  const distances = [
    { distance: Math.abs(point.x - room.minX), normal: { x: 1, y: 0, z: 0 }, side: 'west' },
    { distance: Math.abs(point.x - room.maxX), normal: { x: -1, y: 0, z: 0 }, side: 'east' },
    { distance: Math.abs(point.z - room.minZ), normal: { x: 0, y: 0, z: 1 }, side: 'south' },
    { distance: Math.abs(point.z - room.maxZ), normal: { x: 0, y: 0, z: -1 }, side: 'north' },
  ].sort((a, b) => a.distance - b.distance);
  return distances[0];
}

function dotXZ(a, b) {
  return (a?.x ?? 0) * (b?.x ?? 0) + (a?.z ?? 0) * (b?.z ?? 0);
}

function doorCenter(door) {
  return positionOf(door.navWaypoint ?? door.position);
}

function fixtureNearDoorway(fixture, door, clearance) {
  const center = doorCenter(door);
  if (!center) return false;
  return pointDistance(fixture.position, center) < Math.max(clearance, (door.width ?? 3.6) / 2 + 0.45);
}

function fixtureInDoorCenter(fixture, door) {
  const center = doorCenter(door);
  if (!center) return false;
  const halfWidth = (door.width ?? 3.6) / 2;
  if (Math.abs(fixture.position.x - center.x) <= halfWidth && Math.abs(fixture.position.z - center.z) <= 0.85) return true;
  return Math.abs(fixture.position.z - center.z) <= halfWidth && Math.abs(fixture.position.x - center.x) <= 0.85;
}

export function validateTorchPlacements(definition, torchFixtures) {
  const errors = [];
  const warnings = [];
  const rooms = asArray(definition.rooms);
  const roomIds = new Set(rooms.map((room) => room.id));
  const blockers = asArray(definition.blockers);
  const props = blockers.filter((blocker) => !['wall', 'exterior'].includes(blocker.type));
  const doors = asArray(definition.doors ?? definition.connectors);
  const exits = asArray(definition.exits);
  const spawns = asArray(definition.spawns).filter((spawn) => spawn.kind === 'enemy');
  const navLinks = asArray(definition.navigation?.roomGraph?.links);

  torchFixtures.forEach((fixture) => {
    const id = fixture.id;
    const position = fixture.position;
    const room = rooms.find((candidate) => candidate.id === fixture.roomId);
    const containingRoom = rooms.find((candidate) => pointInRect(position, candidate, 0.04));
    const wallDistance = distanceToRoomWall(position, room ?? containingRoom);
    const authoredDoorClearance = fixture.doorClearance ?? 1.25;
    const propClearance = fixture.propClearance ?? 0.72;

    if (!fixture.roomId || !roomIds.has(fixture.roomId)) {
      addIssue(errors, 'error', `torch ${id} references missing room ${fixture.roomId ?? '(none)'}`, id);
    }

    if (fixture.authoringMode === 'wallAnchored' && !VALID_WALL_SIDES.has(fixture.wallSide)) {
      addIssue(errors, 'error', `torch ${id} has invalid wallSide ${fixture.wallSide}`, id);
    }

    if (!containingRoom && fixture.allowOutsideRoom !== true) {
      addIssue(errors, 'error', `torch ${id} is outside authored room rectangles`, id);
    }

    if (position.y < 1.5 || position.y > 2.3) {
      addIssue(warnings, 'warning', `torch ${id} height ${position.y.toFixed(2)} is outside the 1.5-2.3 wall fixture range`, id);
    }

    if (fixture.offsetFromWall < 0.05 || fixture.offsetFromWall > 0.34) {
      addIssue(warnings, 'warning', `torch ${id} offsetFromWall ${fixture.offsetFromWall.toFixed(2)} should stay close to the wall`, id);
    }

    if (wallDistance > 0.42 && fixture.allowInsideWalkable !== true) {
      addIssue(warnings, 'warning', `torch ${id} is ${wallDistance.toFixed(2)} units from the nearest room wall`, id);
    }

    const nearestWall = room ? nearestWallNormal(position, room) : null;
    if (nearestWall && dotXZ(fixture.wallNormal, nearestWall.normal) < 0.55) {
      addIssue(warnings, 'warning', `torch ${id} normal does not face away from nearest ${nearestWall.side} wall`, id);
    }

    blockers.forEach((blocker) => {
      if (pointInRect(position, blocker, 0.02)) {
        addIssue(errors, 'error', `torch ${id} overlaps blocker ${blocker.id}`, id);
      }
    });

    props.forEach((prop) => {
      if (rectDistance(position, prop) < propClearance) {
        addIssue(warnings, 'warning', `torch ${id} is close to prop/blocker ${prop.id}`, id);
      }
    });

    doors.forEach((door) => {
      if (fixtureInDoorCenter(fixture, door)) {
        addIssue(errors, 'error', `torch ${id} is in the center of doorway ${door.id}`, id);
      } else if (fixtureNearDoorway(fixture, door, authoredDoorClearance)) {
        addIssue(warnings, 'warning', `torch ${id} is close to doorway ${door.id}`, id);
      }
    });

    exits.forEach((exit) => {
      if (pointInRect(position, exit.triggerRect, fixture.exitClearance ?? 1.25)) {
        addIssue(warnings, 'warning', `torch ${id} is close to exit trigger ${exit.id}`, id);
      }
    });

    spawns.forEach((spawn) => {
      const spawnPosition = positionOf(spawn.position);
      if (spawnPosition && pointDistance(position, spawnPosition) < (fixture.enemyClearance ?? 1.2)) {
        addIssue(warnings, 'warning', `torch ${id} is close to enemy spawn ${spawn.id}`, id);
      }
    });

    navLinks.forEach((link) => {
      const waypoint = positionOf(link.navWaypoint ?? link.position);
      if (waypoint && pointDistance(position, waypoint) < (fixture.navClearance ?? 1.05)) {
        addIssue(warnings, 'warning', `torch ${id} is close to nav waypoint ${link.id ?? `${link.fromRoom}-${link.toRoom}`}`, id);
      }
    });
  });

  return {
    locationId: definition.id,
    errors,
    warnings,
    ok: errors.length === 0,
  };
}
