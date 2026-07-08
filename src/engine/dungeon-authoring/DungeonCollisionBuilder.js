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
    blockerShape: blocker.blockerShape ?? 'aabb',
    from: blocker.from,
    to: blocker.to,
    thickness: blocker.thickness,
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

function wallBlocker(id, type, minX, maxX, minZ, maxZ, height, tags = ['compiled-wall']) {
  return {
    id,
    type,
    minX,
    maxX,
    minZ,
    maxZ,
    height,
    tags,
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


function pointXZ(value, y = 0) {
  return {
    x: Number(value?.x ?? value?.[0] ?? 0),
    y,
    z: Number(value?.z ?? value?.[1] ?? 0),
  };
}

function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

function distanceXZ(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function segmentParts(segment, doorGaps) {
  const from = pointXZ(segment.from, segment.y ?? 0);
  const to = pointXZ(segment.to, segment.y ?? 0);
  const length = distanceXZ(from, to);
  if (length <= 0.0001) return [];
  const gaps = asArray(doorGaps)
    .filter((gap) => gap.wallSegmentId === segment.id)
    .map((gap) => {
      const halfT = (gap.width ?? 0) / length / 2;
      return { start: Math.max(0, (gap.centerT ?? 0.5) - halfT), end: Math.min(1, (gap.centerT ?? 0.5) + halfT) };
    })
    .filter((gap) => gap.end > gap.start)
    .sort((a, b) => a.start - b.start);
  const ranges = [];
  let cursor = 0;
  gaps.forEach((gap) => {
    if (gap.start - cursor > 0.02) ranges.push([cursor, gap.start]);
    cursor = Math.max(cursor, gap.end);
  });
  if (1 - cursor > 0.02) ranges.push([cursor, 1]);
  return ranges.map(([startT, endT]) => ({ from: lerpPoint(from, to, startT), to: lerpPoint(from, to, endT) }));
}

function orientedWallBlocker(id, from, to, thickness, height, tags = ['compiled-wall']) {
  const minX = Math.min(from.x, to.x) - thickness / 2;
  const maxX = Math.max(from.x, to.x) + thickness / 2;
  const minZ = Math.min(from.z, to.z) - thickness / 2;
  const maxZ = Math.max(from.z, to.z) + thickness / 2;
  return {
    id, type: 'wall', minX, maxX, minZ, maxZ, height, tags,
    blockerShape: 'segment',
    from: { x: from.x, z: from.z },
    to: { x: to.x, z: to.z },
    thickness,
    userData: { generatedBy: 'DungeonCollisionBuilder', collisionStrategy: 'oriented-segment', wallSegmentId: id.replace(/^V2-WALL-BLOCKER-/, '').replace(/-\d+$/, '') },
  };
}

function buildV2WallBlockers(definition) {
  return asArray(definition.wallSegments).flatMap((segment) => {
    const thickness = segment.thickness ?? definition.geometry?.wallThickness ?? 0.32;
    const height = segment.height ?? definition.geometry?.wallHeight ?? 3.5;
    return segmentParts(segment, definition.doorGaps).map((part, index) => {
      const id = `V2-WALL-BLOCKER-${segment.id}-${index}`;
      const tags = ['compiled-wall', 'v2-wall', ...(segment.tags ?? [])];
      const axisAligned = Math.abs(part.from.x - part.to.x) < 0.001 || Math.abs(part.from.z - part.to.z) < 0.001;
      if (!axisAligned) return orientedWallBlocker(id, part.from, part.to, thickness, height, tags);
      return wallBlocker(
        id,
        'wall',
        Math.min(part.from.x, part.to.x) - thickness / 2,
        Math.max(part.from.x, part.to.x) + thickness / 2,
        Math.min(part.from.z, part.to.z) - thickness / 2,
        Math.max(part.from.z, part.to.z) + thickness / 2,
        height,
        tags,
      );
    });
  });
}


function boundsForPoints(id, points, tags = []) {
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  return { id, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs), tags };
}

function rectFootprint(centerValue, width = 0, depth = 0, yaw = 0) {
  const center = toVector3(centerValue);
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ].map(([x, z]) => ({
    x: center.x + x * cos - z * sin,
    y: center.y,
    z: center.z + x * sin + z * cos,
  }));
}

function rectForSegment(id, fromValue, toValue, width, tags = []) {
  const from = pointXZ(fromValue);
  const to = pointXZ(toValue);
  return {
    id,
    minX: Math.min(from.x, to.x) - width / 2,
    maxX: Math.max(from.x, to.x) + width / 2,
    minZ: Math.min(from.z, to.z) - width / 2,
    maxZ: Math.max(from.z, to.z) + width / 2,
    tags,
  };
}

function buildV21WalkableRects(definition) {
  const rects = [];
  asArray(definition.polygonFloors).forEach((floor) => {
    const points = asArray(floor.points).map((point) => pointXZ(point)).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z));
    if (points.length >= 3) rects.push(boundsForPoints(`V2-FLOOR-WALKABLE-${floor.id}`, points, ['v2-floor', ...(floor.tags ?? [])]));
  });
  asArray(definition.pathRibbons).forEach((ribbon) => {
    const points = asArray(ribbon.points);
    for (let i = 0; i < points.length - 1; i += 1) rects.push(rectForSegment(`V2-PATH-WALKABLE-${ribbon.id}-${i}`, points[i], points[i + 1], ribbon.width ?? 1, ['v2-path', ...(ribbon.tags ?? [])]));
  });
  asArray(definition.platforms).forEach((platform) => {
    const points = asArray(platform.footprint).map((point) => pointXZ(point)).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z));
    if (points.length >= 3) rects.push(boundsForPoints(`V2-PLATFORM-WALKABLE-${platform.id}`, points, ['v2-platform', ...(platform.tags ?? [])]));
  });
  asArray(definition.ramps).forEach((ramp) => rects.push(rectForSegment(`V2-RAMP-WALKABLE-${ramp.id}`, ramp.from, ramp.to, ramp.width ?? 1, ['v2-ramp'])));
  asArray(definition.stairs).forEach((stairs) => rects.push(rectForSegment(`V2-STAIR-WALKABLE-${stairs.id}`, stairs.from, stairs.to, stairs.width ?? 1, ['v2-stairs'])));
  asArray(definition.bridges).forEach((bridge) => rects.push(rectForSegment(`V2-BRIDGE-WALKABLE-${bridge.id}`, bridge.from, bridge.to, bridge.width ?? 1, ['v2-bridge'])));
  asArray(definition.architecturalPrimitives).forEach((primitive) => {
    if (STAIR_PRIMITIVE_KINDS.has(primitive.kind) && primitive.walkable !== false) {
      const endpoints = stairPrimitiveEndpoints(primitive);
      rects.push(rectForSegment(`V23-STAIR-WALKABLE-${primitive.id}`, endpoints.from, endpoints.to, primitive.width ?? 2.4, ['v2.3-primitive', 'stair-primitive', primitive.kind, ...(primitive.tags ?? [])]));
      return;
    }
    if (BRIDGE_PRIMITIVE_KINDS.has(primitive.kind) && primitive.walkable !== false) {
      const endpoints = stairPrimitiveEndpoints(primitive);
      rects.push(rectForSegment(`V25-BRIDGE-WALKABLE-${primitive.id}`, endpoints.from, endpoints.to, primitive.width ?? 2.4, ['v2.5-primitive', 'bridge-primitive', primitive.kind, ...(primitive.tags ?? [])]));
    }
  });
  asArray(definition.horizontalSurfaces).forEach((surface) => {
    if (surface.walkable === false || ['ceiling', 'roof'].includes(surface.kind)) return;
    if (surface.shape === 'polygon') {
      const points = asArray(surface.points).map((point) => pointXZ(point)).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z));
      if (points.length >= 3) rects.push(boundsForPoints(`HSURFACE-WALKABLE-${surface.id}`, points, ['horizontal-surface', surface.kind, ...(surface.tags ?? [])]));
      return;
    }
    const points = rectFootprint(surface.center, surface.width ?? 0, surface.depth ?? 0, surface.yaw ?? 0);
    if (points.length >= 3) rects.push(boundsForPoints(`HSURFACE-WALKABLE-${surface.id}`, points, ['horizontal-surface', surface.kind, ...(surface.tags ?? [])]));
  });
  return rects;
}

function walkableSurfacePoint(value) {
  return [Number(value?.x ?? value?.[0] ?? 0), Number(value?.z ?? value?.[1] ?? 0)];
}

const STAIR_PRIMITIVE_KINDS = new Set(['straightStair', 'wideSacredStair', 'narrowCryptStair', 'brokenStair', 'sunkenSteps', 'daisStair', 'splitStair', 'bridgeStair', 'cornerStair', 'processionalStair']);
const BRIDGE_PRIMITIVE_KINDS = new Set(['narrowStoneBridge', 'wideCeremonialBridge', 'brokenBridge', 'plankBridge', 'raisedWalkway', 'canalCrossing', 'bridgeWithRailings', 'archedStoneBridge', 'ritualSpanBridge', 'collapsedWalkway']);
const DOORWAY_PRIMITIVE_KINDS = new Set(['thickStoneDoorway', 'openArchPortal', 'bronzeSealedGate', 'lockedRitualGate', 'brokenGateFrame', 'doubleTempleDoor', 'returnPortalFrame', 'sunDiskThreshold', 'narrowCryptPortal', 'grandProcessionalGate']);
const COLUMN_PRIMITIVE_KINDS = new Set(['roundTempleColumn', 'squareStonePillar', 'brokenColumn', 'crackedSupportPillar', 'bronzeBandedColumn', 'glyphCarvedColumn', 'twinColumnFrame', 'massiveHallColumn', 'ruinedColumnBase', 'sacredObeliskColumn']);

function stairPrimitiveEndpoints(primitive) {
  const pos = toVector3(primitive.position);
  const yaw = primitive.yaw ?? primitive.rotation ?? 0;
  const length = primitive.length ?? primitive.depth ?? 4;
  const dx = Math.sin(yaw) * length / 2;
  const dz = Math.cos(yaw) * length / 2;
  return { from: [pos.x - dx, pos.z - dz], to: [pos.x + dx, pos.z + dz] };
}

function buildWalkableSurfaces(definition) {
  const surfaces = [];
  const defaultY = definition.defaultFloorY ?? 0;
  if (definition.collision?.roomFloorSurfaces === true) {
    asArray(definition.rooms).forEach((room) => {
      if (![room.minX, room.maxX, room.minZ, room.maxZ].every(Number.isFinite)) return;
      surfaces.push({
        id: `${room.id}_room_floor_walkable`,
        kind: 'flatPolygon',
        footprint: [
          [room.minX, room.minZ],
          [room.maxX, room.minZ],
          [room.maxX, room.maxZ],
          [room.minX, room.maxZ],
        ],
        y: room.floorY ?? defaultY,
        priority: -10,
        tags: ['compiled-room-floor', ...(room.tags ?? [])],
      });
    });
  }
  asArray(definition.polygonFloors).forEach((floor) => {
    const footprint = asArray(floor.points).map(walkableSurfacePoint);
    if (footprint.length >= 3) surfaces.push({
      id: floor.walkableId ?? `${floor.id}_walkable`,
      kind: 'flatPolygon',
      footprint,
      y: floor.y ?? defaultY,
      priority: floor.priority ?? 0,
      tags: ['v2-floor', ...(floor.tags ?? [])],
    });
  });
  asArray(definition.platforms).forEach((platform) => {
    const footprint = asArray(platform.footprint).map(walkableSurfacePoint);
    if (footprint.length >= 3) surfaces.push({
      id: platform.walkableId ?? `${platform.id}_top`,
      kind: 'platformTop',
      footprint,
      y: (platform.y ?? defaultY) + (platform.height ?? 0),
      priority: platform.priority ?? 20,
      tags: ['v2-platform', ...(platform.tags ?? [])],
    });
  });
  asArray(definition.ramps).forEach((ramp) => surfaces.push({
    id: ramp.walkableId ?? `${ramp.id}_walkable`, kind: 'ramp', from: walkableSurfacePoint(ramp.from), to: walkableSurfacePoint(ramp.to),
    width: ramp.width ?? 1, y0: ramp.y0 ?? defaultY, y1: ramp.y1 ?? defaultY, priority: ramp.priority ?? 30, tags: ['v2-ramp', ...(ramp.tags ?? [])],
  }));
  asArray(definition.stairs).forEach((stairs) => surfaces.push({
    id: stairs.walkableId ?? `${stairs.id}_walkable`, kind: 'stairRamp', from: walkableSurfacePoint(stairs.from), to: walkableSurfacePoint(stairs.to),
    width: stairs.width ?? 1, y0: stairs.y0 ?? defaultY, y1: stairs.y1 ?? defaultY, steps: stairs.steps ?? 1, priority: stairs.priority ?? 35, tags: ['v2-stairs', ...(stairs.tags ?? [])],
  }));
  asArray(definition.bridges).forEach((bridge) => surfaces.push({
    id: bridge.walkableId ?? `${bridge.id}_walkable`, kind: 'bridgeDeck', from: walkableSurfacePoint(bridge.from), to: walkableSurfacePoint(bridge.to),
    width: bridge.width ?? 1, y: bridge.y ?? defaultY, priority: bridge.priority ?? 25, tags: ['v2-bridge', ...(bridge.tags ?? [])],
  }));
  asArray(definition.architecturalPrimitives).forEach((primitive) => {
    if (!STAIR_PRIMITIVE_KINDS.has(primitive.kind) || primitive.walkable === false) return;
    const endpoints = stairPrimitiveEndpoints(primitive);
    const y0 = primitive.y0 ?? primitive.position?.y ?? primitive.position?.[1] ?? 0;
    const h = primitive.height ?? 1.2;
    surfaces.push({
      id: primitive.walkableId ?? `${primitive.id}_walkable`, kind: 'stairRamp', from: endpoints.from, to: endpoints.to,
      width: primitive.width ?? 2.4, y0: primitive.kind === 'sunkenSteps' ? y0 : y0, y1: primitive.kind === 'sunkenSteps' ? y0 - h : y0 + h,
      steps: primitive.stepCount ?? primitive.steps ?? 6, priority: primitive.priority ?? 38,
      tags: ['v2.3-primitive', 'stair-primitive', primitive.kind, ...(primitive.tags ?? [])],
      userData: { primitiveId: primitive.id, missingSteps: primitive.missingSteps ?? primitive.brokenSteps ?? [] },
    });
  });
  asArray(definition.architecturalPrimitives).forEach((primitive) => {
    if (!BRIDGE_PRIMITIVE_KINDS.has(primitive.kind) || primitive.walkable === false) return;
    const endpoints = stairPrimitiveEndpoints(primitive);
    const y = primitive.deckY ?? primitive.position?.y ?? primitive.position?.[1] ?? defaultY;
    surfaces.push({ id: primitive.walkableId ?? `${primitive.id}_walkable`, kind: 'bridgeDeck', from: endpoints.from, to: endpoints.to, width: primitive.width ?? 2.4, y, priority: primitive.priority ?? 42, tags: ['v2.5-primitive', 'bridge-primitive', primitive.kind, ...(primitive.tags ?? [])], userData: { primitiveId: primitive.id, brokenGaps: primitive.brokenGaps ?? primitive.gaps ?? [] } });
  });
  asArray(definition.horizontalSurfaces).forEach((surface) => {
    if (surface.walkable === false || ['ceiling', 'roof'].includes(surface.kind)) return;
    let footprint = [];
    if (surface.shape === 'polygon') {
      footprint = asArray(surface.points).map(walkableSurfacePoint);
    } else {
      footprint = rectFootprint(surface.center, surface.width ?? 0, surface.depth ?? 0, surface.yaw ?? 0).map((point) => [point.x, point.z]);
    }
    if (footprint.length >= 3) surfaces.push({
      id: surface.walkableId ?? `${surface.id}_walkable`,
      kind: surface.kind === 'platformTop' ? 'platformTop' : 'flatPolygon',
      footprint,
      y: surface.y ?? surface.center?.[1] ?? surface.center?.y ?? defaultY,
      priority: surface.priority ?? (surface.kind === 'platformTop' ? 24 : 10),
      tags: ['horizontal-surface', surface.kind, ...(surface.tags ?? [])],
    });
  });
  return surfaces;
}

function rotatedRectBlocker(id, position, width, depth, height, yaw = 0, tags = []) {
  const x = Number(position?.x ?? position?.[0] ?? 0);
  const z = Number(position?.z ?? position?.[2] ?? 0);
  const c = Math.abs(Math.cos(yaw)); const sn = Math.abs(Math.sin(yaw));
  const aabbW = width * c + depth * sn;
  const aabbD = width * sn + depth * c;
  return wallBlocker(id, 'architecturalPrimitive', x - aabbW / 2, x + aabbW / 2, z - aabbD / 2, z + aabbD / 2, height, tags);
}

function primitivePostBlockers(primitive) {
  const pos = toVector3(primitive.position); const yaw = primitive.yaw ?? 0; const width = primitive.width ?? 2; const height = primitive.height ?? 3; const thickness = primitive.thickness ?? 0.35; const depth = primitive.depth ?? thickness;
  return [-1, 1].map((side) => {
    const localX = side * (width / 2 - thickness / 2);
    const x = pos.x + Math.cos(yaw) * localX;
    const z = pos.z - Math.sin(yaw) * localX;
    return rotatedRectBlocker(`V23-PRIMITIVE-BLOCKER-${primitive.id}-post-${side}`, { x, z }, thickness, depth, height, yaw, ['v2.3-primitive', primitive.kind, 'opening-post']);
  });
}


function doorwayBlockers(primitive) {
  const pos = toVector3(primitive.position); const yaw = primitive.yaw ?? primitive.rotation ?? 0; const width = primitive.width ?? (primitive.kind === 'narrowCryptPortal' ? 1.25 : primitive.kind === 'grandProcessionalGate' ? 5.5 : 2.8); const height = primitive.height ?? 3.4; const depth = primitive.depth ?? primitive.thickness ?? 0.45; const postWidth = Math.min(width * 0.22, Math.max(0.22, primitive.frameWidth ?? primitive.thickness ?? 0.45));
  const blockers = [-1, 1].map((side) => { const localX = side * (width / 2 - postWidth / 2); const x = pos.x + Math.cos(yaw) * localX; const z = pos.z - Math.sin(yaw) * localX; return rotatedRectBlocker(`V24-PRIMITIVE-BLOCKER-${primitive.id}-post-${side}`, { x, z }, postWidth, depth, height, yaw, ['v2.4-primitive', primitive.kind, 'doorway-frame']); });
  const state = primitive.state ?? (primitive.open === true || primitive.passable === true ? 'open' : undefined) ?? (primitive.blocked ? 'blocked' : 'closed');
  const blocksOpening = primitive.blocksOpening === true || primitive.blocker === true || primitive.passable === false || ['closed', 'locked', 'blocked', 'sealed'].includes(state);
  if (blocksOpening) blockers.push(rotatedRectBlocker(`V24-PRIMITIVE-BLOCKER-${primitive.id}-door`, primitive.position, Math.max(0.2, width - postWidth * 2.15), Math.min(depth * 0.45, 0.28), height, yaw, ['v2.4-primitive', primitive.kind, 'doorway-door', state]));
  return blockers;
}

function bridgePrimitiveBlockers(primitive) {
  const blockers = []; const endpoints = stairPrimitiveEndpoints(primitive); const width = primitive.width ?? 2.4; const length = primitive.length ?? primitive.depth ?? 6; const yaw = primitive.yaw ?? primitive.rotation ?? 0; const deckY = primitive.deckY ?? primitive.position?.y ?? primitive.position?.[1] ?? 0.18; const railings = primitive.railings ?? ['bridgeWithRailings','wideCeremonialBridge','ritualSpanBridge','raisedWalkway'].includes(primitive.kind); const curbs = primitive.curbs ?? ['canalCrossing','archedStoneBridge','narrowStoneBridge'].includes(primitive.kind); const nx = Math.cos(yaw); const nz = -Math.sin(yaw);
  if (railings || curbs) [-1,1].forEach((side)=>{ const off = side * (width/2 + (railings ? 0.22 : 0.09)); const from = { x:endpoints.from[0]+nx*off, z:endpoints.from[1]+nz*off }; const to = { x:endpoints.to[0]+nx*off, z:endpoints.to[1]+nz*off }; const b = rectForSegment(`V25-PRIMITIVE-BLOCKER-${primitive.id}-${railings?'railing':'curb'}-${side}`, from, to, railings ? 0.18 : 0.24, ['v2.5-primitive', primitive.kind, railings?'railing':'curb']); b.height = deckY + (railings ? 1 : 0.35); blockers.push(b); });
  if (primitive.kind === 'brokenBridge' || primitive.kind === 'collapsedWalkway' || primitive.broken === true || primitive.state === 'broken') { const gapLength = Math.max(0.35, Math.min(length*0.38, primitive.gapLength ?? length*0.22)); const center = primitive.kind === 'collapsedWalkway' ? 0 : (primitive.gapOffset ?? length*0.12); const dz = Math.cos(yaw) * center; const dx = Math.sin(yaw) * center; const b = rotatedRectBlocker(`V25-PRIMITIVE-BLOCKER-${primitive.id}-broken-gap`, { x:(primitive.position?.x ?? primitive.position?.[0] ?? 0)+dx, z:(primitive.position?.z ?? primitive.position?.[2] ?? 0)+dz }, width, gapLength, deckY+0.8, yaw, ['v2.5-primitive', primitive.kind, 'broken-gap']); blockers.push(b); }
  if (primitive.kind === 'canalCrossing' || primitive.canalContext) { const b = rotatedRectBlocker(`V25-PRIMITIVE-BLOCKER-${primitive.id}-canal-edge`, primitive.position, width + 3.2, Math.min(length*0.72,4.2), 0.25, yaw, ['v2.5-primitive', primitive.kind, 'canal-edge-context']); b.blocksPlayer = false; blockers.push(b); }
  return blockers;
}


function columnPrimitiveBlockers(primitive) {
  const height = primitive.height ?? (primitive.kind === 'ruinedColumnBase' ? 1.1 : primitive.kind === 'massiveHallColumn' ? 8.8 : 4.2);
  const radius = primitive.radius ?? (primitive.kind === 'massiveHallColumn' ? 0.82 : 0.48);
  const width = primitive.width ?? radius * 2;
  const depth = primitive.depth ?? width;
  const yaw = primitive.yaw ?? primitive.rotation ?? 0;
  if (primitive.kind === 'twinColumnFrame') {
    const pos = toVector3(primitive.position);
    const spacing = primitive.columnSpacing ?? width * 2.2;
    return [-1, 1].map((side) => {
      const localX = side * spacing / 2;
      const x = pos.x + Math.cos(yaw) * localX;
      const z = pos.z - Math.sin(yaw) * localX;
      return rotatedRectBlocker(`V26-PRIMITIVE-BLOCKER-${primitive.id}-column-${side}`, { x, z }, width, depth, height, yaw, ['v2.6-primitive', primitive.kind, 'column-footprint']);
    });
  }
  return [rotatedRectBlocker(`V26-PRIMITIVE-BLOCKER-${primitive.id}`, primitive.position, width, depth, height, yaw, ['v2.6-primitive', primitive.kind, 'column-footprint'])];
}

function buildV23PrimitiveBlockers(definition) {
  const blockers = [];
  asArray(definition.architecturalPrimitives).forEach((primitive) => {
    const blocks = primitive.blocksPlayer;
    if (['railing', 'wallPanel', 'canalWater', 'curb'].includes(primitive.kind) && blocks !== true) return;
    if (primitive.blocksPlayer === false) return;
    if (COLUMN_PRIMITIVE_KINDS.has(primitive.kind)) { blockers.push(...columnPrimitiveBlockers(primitive)); return; }
    if (BRIDGE_PRIMITIVE_KINDS.has(primitive.kind)) { blockers.push(...bridgePrimitiveBlockers(primitive)); return; }
    if (DOORWAY_PRIMITIVE_KINDS.has(primitive.kind)) { blockers.push(...doorwayBlockers(primitive)); return; }
    if (['arch', 'doorFrame'].includes(primitive.kind)) { blockers.push(...primitivePostBlockers(primitive)); return; }
    if (STAIR_PRIMITIVE_KINDS.has(primitive.kind)) {
      if (primitive.railings) {
        const endpoints = stairPrimitiveEndpoints(primitive);
        const width = primitive.width ?? 2.4;
        const yaw = primitive.yaw ?? primitive.rotation ?? 0;
        const nx = Math.cos(yaw); const nz = -Math.sin(yaw);
        [-1, 1].forEach((side) => {
          const off = side * (width / 2 + 0.24);
          const from = { x: endpoints.from[0] + nx * off, z: endpoints.from[1] + nz * off };
          const to = { x: endpoints.to[0] + nx * off, z: endpoints.to[1] + nz * off };
          const b = rectForSegment(`V23-PRIMITIVE-BLOCKER-${primitive.id}-railing-${side}`, from, to, 0.18, ['v2.3-primitive', primitive.kind, 'stair-railing']); b.height = (primitive.height ?? 1.2) + 1; blockers.push(b);
        });
      }
      return;
    }
    if (['pillar', 'brokenPillar'].includes(primitive.kind)) {
      const radius = primitive.radius ?? 0.3; blockers.push(rotatedRectBlocker(`V23-PRIMITIVE-BLOCKER-${primitive.id}`, primitive.position, radius * 2, radius * 2, primitive.height ?? 2, primitive.yaw ?? 0, ['v2.3-primitive', primitive.kind])); return;
    }
    if (['lowWall', 'curb', 'railing'].includes(primitive.kind)) {
      const b = rectForSegment(`V23-PRIMITIVE-BLOCKER-${primitive.id}`, primitive.from, primitive.to, primitive.thickness ?? 0.25, ['v2.3-primitive', primitive.kind]); b.height = primitive.height ?? 0.5; blockers.push(b); return;
    }
    if (primitive.kind === 'altar') { blockers.push(rotatedRectBlocker(`V23-PRIMITIVE-BLOCKER-${primitive.id}`, primitive.position, primitive.width ?? 1.6, primitive.depth ?? 1, primitive.height ?? 0.8, primitive.yaw ?? 0, ['v2.3-primitive', primitive.kind])); return; }
    if (primitive.kind === 'stela') { blockers.push(rotatedRectBlocker(`V23-PRIMITIVE-BLOCKER-${primitive.id}`, primitive.position, primitive.width ?? 0.8, primitive.thickness ?? 0.2, primitive.height ?? 2, primitive.yaw ?? 0, ['v2.3-primitive', primitive.kind])); return; }
    if (primitive.kind === 'obelisk') { const w = primitive.baseWidth ?? 0.7; blockers.push(rotatedRectBlocker(`V23-PRIMITIVE-BLOCKER-${primitive.id}`, primitive.position, w, w, primitive.height ?? 3, primitive.yaw ?? 0, ['v2.3-primitive', primitive.kind])); }
  });
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
  })).concat(buildV21WalkableRects(definition));
  const blockers = asArray(definition.blockers);
  const wallBlockers = buildWallBlockers(definition).concat(buildV2WallBlockers(definition), buildV23PrimitiveBlockers(definition));
  const walkableSurfaces = buildWalkableSurfaces(definition);
  const blockerRects = blockers
    .filter((blocker) => blocker.blocksPlayer !== false)
    .map(blockerRect)
    .concat(wallBlockers);
  const lineOfMovementBlockerRects = blockers
    .filter((blocker) => blocker.blocksLineOfMovement !== false)
    .map(blockerRect)
    .concat(wallBlockers);

  return {
    walkableRects,
    walkableSurfaces,
    blockerRects,
    lineOfMovementBlockerRects,
    collisionWorld: new CollisionWorld({
      walkableRects,
      blockerRects,
      playerRadius: definition.collision?.playerRadius ?? 0.35,
      walkableSurfaces,
      defaultFloorY: definition.defaultFloorY ?? 0,
    }),
  };
}
