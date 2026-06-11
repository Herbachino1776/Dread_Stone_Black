import { asArray, rectCenter } from '../DungeonDefinitionTypes.js';
import {
  INTEGRITY_CATEGORY,
  INTEGRITY_CODES,
  INTEGRITY_SEVERITY,
  OPENING_KIND,
  rectDepth,
  rectWidth,
} from './DungeonIntegrityTypes.js';

const EDGE_TOLERANCE = 1.1;
const EDGE_RANGE_PADDING = 0.2;
const MIN_WALL_SEGMENT_LENGTH = 0.2;

const EDGE_DEFINITIONS = Object.freeze([
  { side: 'south', axis: 'z', coordinate: (room) => room.minZ, spanStart: (room) => room.minX, spanEnd: (room) => room.maxX, outward: -1 },
  { side: 'north', axis: 'z', coordinate: (room) => room.maxZ, spanStart: (room) => room.minX, spanEnd: (room) => room.maxX, outward: 1 },
  { side: 'west', axis: 'x', coordinate: (room) => room.minX, spanStart: (room) => room.minZ, spanEnd: (room) => room.maxZ, outward: -1 },
  { side: 'east', axis: 'x', coordinate: (room) => room.maxX, spanStart: (room) => room.minZ, spanEnd: (room) => room.maxZ, outward: 1 },
]);

function toPosition(value, fallback = null) {
  if (!value) return fallback;
  return {
    x: Number(value.x ?? value[0] ?? fallback?.x ?? 0),
    y: Number(value.y ?? value[1] ?? fallback?.y ?? 0),
    z: Number(value.z ?? value[2] ?? fallback?.z ?? 0),
  };
}

function isConnectorRoom(room) {
  return asArray(room.tags).includes('connector') || room.integrity?.edgePolicy === 'connector';
}

function edgeMatchesPosition(edge, position, room) {
  if (edge.axis === 'z') {
    return Math.abs(position.z - edge.coordinate) < EDGE_TOLERANCE
      && position.x >= room.minX - EDGE_RANGE_PADDING
      && position.x <= room.maxX + EDGE_RANGE_PADDING;
  }

  return Math.abs(position.x - edge.coordinate) < EDGE_TOLERANCE
    && position.z >= room.minZ - EDGE_RANGE_PADDING
    && position.z <= room.maxZ + EDGE_RANGE_PADDING;
}

function openingInterval(edge, opening, room) {
  const center = toPosition(opening.position);
  const spanStart = edge.spanStart;
  const spanEnd = edge.spanEnd;
  const width = Number(opening.width ?? 0);
  const centerValue = edge.axis === 'z' ? center.x : center.z;
  return {
    start: Math.max(spanStart, centerValue - width / 2),
    end: Math.min(spanEnd, centerValue + width / 2),
    roomId: room.id,
    openingId: opening.id,
    sourceId: opening.sourceId,
    kind: opening.kind,
  };
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .filter((interval) => interval.end - interval.start > MIN_WALL_SEGMENT_LENGTH)
    .sort((a, b) => a.start - b.start);
  const merged = [];

  sorted.forEach((interval) => {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end + MIN_WALL_SEGMENT_LENGTH) {
      previous.end = Math.max(previous.end, interval.end);
      previous.sourceIds = [...new Set([...previous.sourceIds, interval.sourceId].filter(Boolean))];
      previous.openingIds = [...new Set([...previous.openingIds, interval.openingId].filter(Boolean))];
    } else {
      merged.push({
        ...interval,
        sourceIds: [interval.sourceId].filter(Boolean),
        openingIds: [interval.openingId].filter(Boolean),
      });
    }
  });

  return merged;
}

function collectDeclaredOpenings(definition, room) {
  const openings = [];

  asArray(definition.doors ?? definition.connectors).forEach((door) => {
    asArray(door.wallGaps).forEach((gap) => {
      if (gap.roomId !== room.id) return;
      openings.push({
        id: `${door.id}:${room.id}`,
        sourceId: door.id,
        sourceType: 'door',
        kind: asArray(door.tags).includes('arch') ? OPENING_KIND.ARCH : OPENING_KIND.DOORWAY,
        width: gap.width ?? door.width ?? 3.6,
        position: toPosition(gap.position ?? gap.navWaypoint ?? door.position),
        tags: door.tags ?? [],
      });
    });

    if ((door.fromRoom === room.id || door.toRoom === room.id) && !asArray(door.wallGaps).some((gap) => gap.roomId === room.id)) {
      openings.push({
        id: door.id,
        sourceId: door.id,
        sourceType: 'door',
        kind: OPENING_KIND.DOORWAY,
        width: door.width ?? 3.6,
        position: toPosition(door.position ?? door.navWaypoint),
        tags: door.tags ?? [],
      });
    }
  });

  asArray(definition.exits).forEach((exit) => {
    asArray(exit.wallGaps).forEach((gap) => {
      if (gap.roomId !== room.id) return;
      openings.push({
        id: `${exit.id}:${room.id}`,
        sourceId: exit.id,
        sourceType: 'exit',
        kind: OPENING_KIND.EXIT,
        width: gap.width ?? exit.width ?? Math.max(2, rectWidth(exit.triggerRect ?? { minX: -1, maxX: 1 })),
        position: toPosition(gap.position ?? exit.position ?? rectCenter(exit.triggerRect ?? room)),
        tags: exit.tags ?? [],
      });
    });
  });

  return openings.filter((opening) => opening.position && opening.width > 0);
}

function buildEdgesForRoom(definition, room) {
  const declaredOpenings = collectDeclaredOpenings(definition, room);
  const sealedByWall = room.wallGeometry !== false && room.visibleGeometry !== false;

  return EDGE_DEFINITIONS.map((edgeDefinition) => {
    const edge = {
      roomId: room.id,
      side: edgeDefinition.side,
      axis: edgeDefinition.axis,
      coordinate: edgeDefinition.coordinate(room),
      spanStart: edgeDefinition.spanStart(room),
      spanEnd: edgeDefinition.spanEnd(room),
      outward: edgeDefinition.outward,
      length: edgeDefinition.spanEnd(room) - edgeDefinition.spanStart(room),
      sealedByWall,
      connectorEdge: isConnectorRoom(room),
      openings: [],
    };

    edge.openings = mergeIntervals(declaredOpenings
      .filter((opening) => edgeMatchesPosition(edge, opening.position, room))
      .map((opening) => openingInterval(edge, opening, room)));

    return edge;
  });
}

function segmentRectFromEdge(definition, edge, start, end, index) {
  const wallThickness = definition.geometry?.wallThickness ?? 0.35;
  const half = wallThickness / 2;
  const offsetCenter = edge.coordinate + edge.outward * half;

  if (edge.axis === 'z') {
    return {
      id: `${edge.roomId}-${edge.side}-wall-${index}`,
      roomId: edge.roomId,
      side: edge.side,
      orientation: 'horizontal',
      minX: start,
      maxX: end,
      minZ: offsetCenter - half,
      maxZ: offsetCenter + half,
      length: end - start,
      wallThickness,
      visual: true,
      collisionRequired: true,
      source: 'roomEdge',
    };
  }

  return {
    id: `${edge.roomId}-${edge.side}-wall-${index}`,
    roomId: edge.roomId,
    side: edge.side,
    orientation: 'vertical',
    minX: offsetCenter - half,
    maxX: offsetCenter + half,
    minZ: start,
    maxZ: end,
    length: end - start,
    wallThickness,
    visual: true,
    collisionRequired: true,
    source: 'roomEdge',
  };
}

export function analyzeRoomEdges(definition, report = null) {
  const rooms = asArray(definition.rooms);
  const edges = rooms.flatMap((room) => buildEdgesForRoom(definition, room));
  const wallSegments = [];

  edges.forEach((edge) => {
    if (report) {
      report.debug.roomEdges.push({
        roomId: edge.roomId,
        side: edge.side,
        axis: edge.axis,
        coordinate: edge.coordinate,
        spanStart: edge.spanStart,
        spanEnd: edge.spanEnd,
        sealedByWall: edge.sealedByWall,
        connectorEdge: edge.connectorEdge,
      });
      report.debug.openings.push(...edge.openings.map((opening) => ({
        roomId: edge.roomId,
        side: edge.side,
        axis: edge.axis,
        kind: opening.kind,
        openingId: opening.openingId,
        sourceIds: opening.sourceIds,
        start: opening.start,
        end: opening.end,
        coordinate: edge.coordinate,
      })));
    }

    if (!edge.sealedByWall) {
      if (!edge.connectorEdge && report) {
        report.error({
          code: INTEGRITY_CODES.ROOM_EDGE_UNSEALED,
          category: INTEGRITY_CATEGORY.ROOM_EDGE,
          roomId: edge.roomId,
          message: `Room ${edge.roomId} has an unsealed ${edge.side} edge without connector/open-passage metadata.`,
          suggestedFix: 'Set wallGeometry true, add wall segments, or mark this room as a connector/passage with declared openings.',
        });
      }
      return;
    }

    let cursor = edge.spanStart;
    let segmentIndex = 0;
    edge.openings.forEach((opening) => {
      if (opening.start - cursor > MIN_WALL_SEGMENT_LENGTH) {
        wallSegments.push(segmentRectFromEdge(definition, edge, cursor, opening.start, segmentIndex));
        segmentIndex += 1;
      }
      cursor = Math.max(cursor, opening.end);
    });

    if (edge.spanEnd - cursor > MIN_WALL_SEGMENT_LENGTH) {
      wallSegments.push(segmentRectFromEdge(definition, edge, cursor, edge.spanEnd, segmentIndex));
    }
  });

  if (report) {
    report.debug.wallSegments.push(...wallSegments);
  }

  return { edges, wallSegments };
}

function hasOpeningForSource(edges, roomId, sourceId) {
  return edges.some((edge) => edge.roomId === roomId
    && edge.openings.some((opening) => opening.sourceIds.includes(sourceId)));
}

function openingSourceOnAnyEdge(edges, roomId, sourceId) {
  return edges
    .filter((edge) => edge.roomId === roomId)
    .flatMap((edge) => edge.openings)
    .some((opening) => opening.sourceIds.includes(sourceId));
}

export function validateDoorwayEdges(definition, edgeAnalysis, report) {
  const roomsById = new Map(asArray(definition.rooms).map((room) => [room.id, room]));
  const edges = edgeAnalysis.edges;

  asArray(definition.doors ?? definition.connectors).forEach((door) => {
    [door.fromRoom, door.toRoom].filter(Boolean).forEach((roomId) => {
      const room = roomsById.get(roomId);
      if (!room || room.wallGeometry === false || isConnectorRoom(room)) return;

      if (!hasOpeningForSource(edges, roomId, door.id)) {
        report.error({
          code: INTEGRITY_CODES.DOORWAY_MISMATCH,
          category: INTEGRITY_CATEGORY.ROOM_EDGE,
          roomId,
          objectId: door.id,
          message: `Door ${door.id} references ${roomId}, but that room has no declared edge opening for it.`,
          suggestedFix: 'Add a wallGap on the referenced room edge or remove the door reference.',
          relatedIds: [door.fromRoom, door.toRoom],
        });
      }
    });

    asArray(door.wallGaps).forEach((gap) => {
      if (!gap.roomId || !roomsById.has(gap.roomId)) return;
      if (!openingSourceOnAnyEdge(edges, gap.roomId, door.id)) {
        report.warning({
          severity: INTEGRITY_SEVERITY.WARNING,
          code: INTEGRITY_CODES.DOORWAY_MISMATCH,
          category: INTEGRITY_CATEGORY.ROOM_EDGE,
          roomId: gap.roomId,
          objectId: door.id,
          position: toPosition(gap.position),
          message: `Door ${door.id} wallGap for ${gap.roomId} is not on a room edge.`,
          suggestedFix: 'Move the wallGap position to the matching room edge or convert the space into an explicit connector room.',
        });
      }
    });
  });

  asArray(definition.exits).forEach((exit) => {
    if (!exit.roomId) return;
    if (!hasOpeningForSource(edges, exit.roomId, exit.id)) {
      report.error({
        code: INTEGRITY_CODES.EXIT_TRIGGER_OUTSIDE_OPENING,
        category: INTEGRITY_CATEGORY.ROOM_EDGE,
        roomId: exit.roomId,
        objectId: exit.id,
        position: toPosition(exit.position ?? rectCenter(exit.triggerRect ?? {})),
        message: `Exit ${exit.id} does not have a declared opening on room ${exit.roomId}.`,
        suggestedFix: 'Add an exit wallGap that matches the room edge used by the trigger.',
      });
    }
  });
}
