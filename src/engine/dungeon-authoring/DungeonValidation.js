import { asArray, hasUsableId } from './DungeonDefinitionTypes.js';

const loggedValidationKeys = new Set();
const RUNTIME_ENEMY_SPECIES = new Set(['sheep_demon', 'neck_man']);

function pointInRect(point, rect, padding = 0) {
  return point.x >= rect.minX - padding && point.x <= rect.maxX + padding
    && point.z >= rect.minZ - padding && point.z <= rect.maxZ + padding;
}

function pointRectClearance(point, rect) {
  if (!pointInRect(point, rect)) return -Infinity;
  return Math.min(point.x - rect.minX, rect.maxX - point.x, point.z - rect.minZ, rect.maxZ - point.z);
}

function circleIntersectsRect(point, radius, rect) {
  const closestX = Math.min(Math.max(point.x, rect.minX), rect.maxX);
  const closestZ = Math.min(Math.max(point.z, rect.minZ), rect.maxZ);
  const dx = point.x - closestX;
  const dz = point.z - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

function rectsApproximatelyAlign(a, b, tolerance = 0.2) {
  return Math.abs(a.minX - b.minX) <= tolerance
    && Math.abs(a.maxX - b.maxX) <= tolerance
    && Math.abs(a.minZ - b.minZ) <= tolerance
    && Math.abs(a.maxZ - b.maxZ) <= tolerance;
}

function positionOf(value) {
  if (!value) return null;
  return {
    x: Number(value.x ?? value[0] ?? 0),
    y: Number(value.y ?? value[1] ?? 0),
    z: Number(value.z ?? value[2] ?? 0),
  };
}


function xzPoint(value) {
  if (!value) return null;
  const x = Number(value.x ?? value[0]);
  const z = Number(value.z ?? value[1]);
  return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
}

function xzDistance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.z - next.x * current.z;
  }
  return Math.abs(area) / 2;
}

function addIssue(target, severity, message, id = null) {
  target.push({ severity, message, id });
}

function collectIds(collections, issues) {
  const seen = new Map();
  collections.forEach(({ label, items }) => {
    asArray(items).forEach((item, index) => {
      if (!hasUsableId(item)) {
        addIssue(issues, 'error', `${label}[${index}] is missing an id`);
        return;
      }
      const key = item.id;
      if (seen.has(key)) {
        addIssue(issues, 'error', `duplicate id ${key} in ${seen.get(key)} and ${label}`, key);
      } else {
        seen.set(key, label);
      }
    });
  });
}

export function validateDungeonDefinition(definition, { destinationSpawnIds = new Set() } = {}) {
  const errors = [];
  const warnings = [];
  const rooms = asArray(definition.rooms);
  const blockers = asArray(definition.blockers);
  const props = asArray(definition.props);
  const spawns = asArray(definition.spawns);
  const connectors = asArray(definition.doors ?? definition.connectors);
  const encounterZones = asArray(definition.encounterZones);
  const exits = asArray(definition.exits);
  const polygonFloors = asArray(definition.polygonFloors);
  const wallSegments = asArray(definition.wallSegments);
  const doorGaps = asArray(definition.doorGaps);
  const wallPropAnchors = asArray(definition.wallPropAnchors);
  const roomIds = new Set(rooms.map((room) => room.id));
  const spawnIds = new Set(spawns.map((spawn) => spawn.id));
  const blockerIds = new Set(blockers.map((blocker) => blocker.id));
  const validatesGeneratedEnemyRuntime = asArray(definition.tags).some((tag) => ['ai-authored-location', 'ddplus-export'].includes(tag));

  collectIds([
    { label: 'rooms', items: rooms },
    { label: 'doors', items: connectors },
    { label: 'blockers', items: blockers },
    { label: 'props', items: props },
    { label: 'spawns', items: spawns },
    { label: 'encounterZones', items: encounterZones },
    { label: 'exits', items: exits },
    { label: 'lights', items: definition.lights },
    { label: 'lightFixtures', items: definition.lightFixtures },
    { label: 'torchFixtures', items: definition.torchFixtures },
    { label: 'polygonFloors', items: polygonFloors },
    { label: 'wallSegments', items: wallSegments },
    { label: 'doorGaps', items: doorGaps },
    { label: 'wallPropAnchors', items: wallPropAnchors },
  ], errors);


  polygonFloors.forEach((floor) => {
    const points = asArray(floor.points).map(xzPoint);
    if (points.length < 3) {
      addIssue(errors, 'error', `polygonFloor ${floor.id} needs at least 3 points`, floor.id);
      return;
    }
    if (points.some((point) => !point)) {
      addIssue(errors, 'error', `polygonFloor ${floor.id} has non-finite points`, floor.id);
      return;
    }
    if (polygonArea(points) <= 0.01) {
      addIssue(errors, 'error', `polygonFloor ${floor.id} has near-zero area`, floor.id);
    }
  });

  const wallSegmentById = new Map();
  wallSegments.forEach((segment) => {
    const from = xzPoint(segment.from);
    const to = xzPoint(segment.to);
    if (segment.id) wallSegmentById.set(segment.id, { segment, from, to, length: from && to ? xzDistance(from, to) : 0 });
    if (!from || !to) {
      addIssue(errors, 'error', `wallSegment ${segment.id} has invalid from/to points`, segment.id);
      return;
    }
    if (xzDistance(from, to) <= 0.05) addIssue(errors, 'error', `wallSegment ${segment.id} is too short`, segment.id);
    if ((segment.height ?? 3.5) <= 0) addIssue(errors, 'error', `wallSegment ${segment.id} height must be > 0`, segment.id);
    if ((segment.thickness ?? 0.32) <= 0) addIssue(errors, 'error', `wallSegment ${segment.id} thickness must be > 0`, segment.id);
  });

  doorGaps.forEach((gap) => {
    const wall = wallSegmentById.get(gap.wallSegmentId);
    if (!wall) {
      addIssue(errors, 'error', `doorGap ${gap.id} references missing wallSegmentId ${gap.wallSegmentId}`, gap.id);
      return;
    }
    if (!Number.isFinite(gap.centerT) || gap.centerT < 0 || gap.centerT > 1) addIssue(errors, 'error', `doorGap ${gap.id} centerT must be between 0 and 1`, gap.id);
    if (!Number.isFinite(gap.width) || gap.width <= 0) addIssue(errors, 'error', `doorGap ${gap.id} width must be > 0`, gap.id);
    if (Number.isFinite(gap.width) && gap.width >= wall.length) addIssue(errors, 'error', `doorGap ${gap.id} width must be smaller than wall length`, gap.id);
  });

  const supportedAnchorKinds = new Set(['torchFixture', 'panel', 'marker']);
  wallPropAnchors.forEach((anchor) => {
    if (!wallSegmentById.has(anchor.wallSegmentId)) addIssue(errors, 'error', `wallPropAnchor ${anchor.id} references missing wallSegmentId ${anchor.wallSegmentId}`, anchor.id);
    if (!Number.isFinite(anchor.t) || anchor.t < 0 || anchor.t > 1) addIssue(errors, 'error', `wallPropAnchor ${anchor.id} t must be between 0 and 1`, anchor.id);
    if (!Number.isFinite(anchor.height ?? 0)) addIssue(errors, 'error', `wallPropAnchor ${anchor.id} height must be finite`, anchor.id);
    if (anchor.kind && !supportedAnchorKinds.has(anchor.kind)) addIssue(warnings, 'warning', `wallPropAnchor ${anchor.id} uses unsupported kind ${anchor.kind}`, anchor.id);
  });

  rooms.forEach((room) => {
    if (room.minX >= room.maxX || room.minZ >= room.maxZ) {
      addIssue(errors, 'error', `room ${room.id} has inverted bounds`, room.id);
    }
  });

  blockers.forEach((blocker) => {
    if (blocker.minX >= blocker.maxX || blocker.minZ >= blocker.maxZ) {
      addIssue(errors, 'error', `blocker ${blocker.id} has inverted bounds`, blocker.id);
    }
  });

  const blockerRects = blockers.filter((blocker) => blocker.blocksPlayer !== false || blocker.blocksEnemies !== false);
  spawns.forEach((spawn) => {
    const position = positionOf(spawn.position);
    if (!position) {
      addIssue(errors, 'error', `spawn ${spawn.id} is missing position`, spawn.id);
      return;
    }
    const room = rooms.find((candidate) => candidate.id === spawn.roomId);
    const containingWalkable = rooms.find((candidate) => pointInRect(position, candidate));
    const overlappingBlocker = blockerRects.find((blocker) => circleIntersectsRect(position, spawn.kind === 'enemy' ? 0.58 : 0.5, blocker));
    const clearanceRect = containingWalkable ?? room;
    const clearance = clearanceRect ? pointRectClearance(position, clearanceRect) : -Infinity;
    const allowsNearWall = spawn.userData?.allowNearWall || asArray(spawn.tags).includes('allow-near-wall');

    if (spawn.roomId && !roomIds.has(spawn.roomId)) {
      addIssue(errors, 'error', `spawn ${spawn.id} references missing room ${spawn.roomId}`, spawn.id);
    }
    if (['player', 'return', 'enemy'].includes(spawn.kind) && !containingWalkable) {
      addIssue(errors, 'error', `${spawn.kind} spawn ${spawn.id} is outside walkable room rectangles`, spawn.id);
    }
    if (['player', 'return', 'enemy'].includes(spawn.kind) && overlappingBlocker) {
      addIssue(errors, 'error', `${spawn.kind} spawn ${spawn.id} overlaps blocker ${overlappingBlocker.id}`, spawn.id);
    }
    if (spawn.kind === 'enemy' && clearance < 0.75) {
      addIssue(warnings, 'warning', `spawn ${spawn.id} has low clearance near room wall`, spawn.id);
    }
    if (validatesGeneratedEnemyRuntime && spawn.kind === 'enemy' && !RUNTIME_ENEMY_SPECIES.has(spawn.species)) {
      addIssue(warnings, 'warning', `enemy spawn ${spawn.id} uses unknown runtime species ${spawn.species}`, spawn.id);
    }
    if (validatesGeneratedEnemyRuntime && spawn.kind === 'enemy' && !spawn.roomId) {
      addIssue(warnings, 'warning', `enemy spawn ${spawn.id} is missing roomId`, spawn.id);
    }
    if (validatesGeneratedEnemyRuntime && spawn.kind === 'enemy') {
      asArray(spawn.userData?.patrolPoints).forEach((point, index) => {
        const patrolPosition = positionOf(point);
        if (!patrolPosition || !rooms.some((candidate) => pointInRect(patrolPosition, candidate))) {
          addIssue(warnings, 'warning', `enemy spawn ${spawn.id} patrol point ${index} is outside walkable room rectangles`, spawn.id);
        } else if (blockerRects.find((blocker) => circleIntersectsRect(patrolPosition, 0.58, blocker))) {
          addIssue(warnings, 'warning', `enemy spawn ${spawn.id} patrol point ${index} overlaps a blocker`, spawn.id);
        }
      });
    }
    if (['player', 'return', 'enemy'].includes(spawn.kind) && !allowsNearWall && clearance < 0.7) {
      addIssue(warnings, 'warning', `spawn ${spawn.id} is close to a wall`, spawn.id);
    }
  });

  encounterZones.forEach((zone) => {
    asArray(zone.roomIds).forEach((roomId) => {
      if (!roomIds.has(roomId)) {
        addIssue(errors, 'error', `encounter zone ${zone.id} references missing room ${roomId}`, zone.id);
      }
    });
  });

  exits.forEach((exit) => {
    if (!exit.destinationSpawnId) {
      addIssue(errors, 'error', `exit ${exit.id} is missing destinationSpawnId`, exit.id);
    } else if (exit.toLocation === definition.id && !spawnIds.has(exit.destinationSpawnId) && !destinationSpawnIds.has(exit.destinationSpawnId)) {
      addIssue(errors, 'error', `exit ${exit.id} references missing destinationSpawnId ${exit.destinationSpawnId}`, exit.id);
    }
  });

  connectors.forEach((door) => {
    if (door.fromRoom && !roomIds.has(door.fromRoom)) {
      addIssue(errors, 'error', `door ${door.id} references missing fromRoom ${door.fromRoom}`, door.id);
    }
    if (door.toRoom && !roomIds.has(door.toRoom)) {
      addIssue(errors, 'error', `door ${door.id} references missing toRoom ${door.toRoom}`, door.id);
    }
    const waypoint = positionOf(door.navWaypoint ?? door.position);
    if (waypoint && !rooms.some((room) => pointInRect(waypoint, room, 0.75))) {
      addIssue(warnings, 'warning', `door ${door.id} waypoint is outside authored walkable rectangles`, door.id);
    }
  });

  asArray(definition.navigation?.roomGraph?.links).forEach((link) => {
    if (!roomIds.has(link.fromRoom)) addIssue(errors, 'error', `nav link references missing fromRoom ${link.fromRoom}`, link.id);
    if (!roomIds.has(link.toRoom)) addIssue(errors, 'error', `nav link references missing toRoom ${link.toRoom}`, link.id);
    const waypoint = positionOf(link.navWaypoint ?? link.position);
    if (waypoint && !rooms.some((room) => pointInRect(waypoint, room, 0.75))) {
      addIssue(warnings, 'warning', `nav link ${link.id ?? `${link.fromRoom}-${link.toRoom}`} waypoint is outside walkable rectangles`, link.id);
    }
  });

  props.forEach((prop) => {
    if (!prop.collisionRef) return;
    if (!blockerIds.has(prop.collisionRef)) {
      addIssue(errors, 'error', `prop ${prop.id} references missing collisionRef ${prop.collisionRef}`, prop.id);
      return;
    }
    if (!prop.position || !prop.dimensions) return;
    const blocker = blockers.find((candidate) => candidate.id === prop.collisionRef);
    const position = positionOf(prop.position);
    const expected = {
      minX: position.x - prop.dimensions.width / 2,
      maxX: position.x + prop.dimensions.width / 2,
      minZ: position.z - prop.dimensions.depth / 2,
      maxZ: position.z + prop.dimensions.depth / 2,
    };
    if (!rectsApproximatelyAlign(expected, blocker)) {
      addIssue(warnings, 'warning', `prop ${prop.id} collisionRef ${prop.collisionRef} does not align with prop footprint`, prop.id);
    }
  });

  return {
    locationId: definition.id,
    errors,
    warnings,
    ok: errors.length === 0,
  };
}

export function logDungeonValidation(validation) {
  const key = `${validation.locationId}:${validation.errors.length}:${validation.warnings.length}`;
  if (loggedValidationKeys.has(key)) return;
  loggedValidationKeys.add(key);

  console.info(`[DUNGEON VALIDATION] ${validation.locationId}: ${validation.errors.length} errors, ${validation.warnings.length} warnings`);
  [...validation.errors, ...validation.warnings].slice(0, 10).forEach((issue) => {
    console.warn(`${issue.severity}: ${issue.message}`);
  });
}
