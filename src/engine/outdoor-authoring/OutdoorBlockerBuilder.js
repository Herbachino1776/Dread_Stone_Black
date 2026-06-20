const OARB_BLOCKER_SOURCE = 'OARB';
export const OARB_CURVED_BLOCKER_MAX_COORDINATE = 2000;
export const OARB_CURVED_BLOCKER_MAX_RADIUS = 200;
export const OARB_CURVED_BLOCKER_MAX_THICKNESS = 80;

function finitePair(pair) {
  return Array.isArray(pair) && pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1])
    ? [pair[0], pair[1]]
    : null;
}

function toPoint(pair) {
  const parsed = finitePair(pair);
  return parsed ? { x: parsed[0], z: parsed[1] } : null;
}

function copyPoints(points = []) {
  return Array.isArray(points) ? points.map(finitePair).filter(Boolean) : [];
}

function baseMetadata(blocker, collisionType) {
  return {
    kind: blocker.kind,
    id: blocker.id,
    visibleStructureId: blocker.visibleStructureId ?? null,
    intentionallyInvisible: blocker.metadata?.intentionallyInvisible === true || blocker.intentionallyInvisible === true,
    collisionType,
    source: OARB_BLOCKER_SOURCE,
    metadata: blocker.metadata ?? {},
  };
}

function boundsForPoints(points, padding = 0) {
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  return {
    minX: Math.min(...xs) - padding,
    maxX: Math.max(...xs) + padding,
    minZ: Math.min(...zs) - padding,
    maxZ: Math.max(...zs) + padding,
  };
}

export function createOutdoorCurvedBlocker(blocker) {
  if (!blocker || typeof blocker !== 'object') return null;

  if (blocker.kind === 'circle' || blocker.kind === 'hazard') {
    const center = toPoint(blocker.center);
    if (!center || !Number.isFinite(blocker.radius) || blocker.radius <= 0) return null;
    return {
      ...boundsForPoints([center], blocker.radius),
      id: blocker.id,
      blockerShape: 'circle',
      center,
      radius: blocker.radius,
      type: blocker.kind === 'hazard' ? 'hazard' : 'oarbCurvedBlocker',
      tags: ['oarb', 'curvedBlocker', blocker.kind],
      userData: {
        ...baseMetadata(blocker, 'circle'),
        center: [...blocker.center],
        radius: blocker.radius,
      },
    };
  }

  if (blocker.kind === 'capsule') {
    const from = toPoint(blocker.from);
    const to = toPoint(blocker.to);
    if (!from || !to || !Number.isFinite(blocker.radius) || blocker.radius <= 0) return null;
    return {
      ...boundsForPoints([from, to], blocker.radius),
      id: blocker.id,
      blockerShape: 'capsule',
      from,
      to,
      radius: blocker.radius,
      thickness: blocker.radius * 2,
      type: 'oarbCurvedBlocker',
      tags: ['oarb', 'curvedBlocker', blocker.kind],
      userData: {
        ...baseMetadata(blocker, 'capsule'),
        from: [...blocker.from],
        to: [...blocker.to],
        radius: blocker.radius,
      },
    };
  }

  if (blocker.kind === 'spline' || blocker.kind === 'cliff') {
    const authoredPoints = copyPoints(blocker.points);
    const points = authoredPoints.map(([x, z]) => ({ x, z }));
    if (points.length < 2 || !Number.isFinite(blocker.thickness) || blocker.thickness <= 0) return null;
    return {
      ...boundsForPoints(points, blocker.thickness / 2),
      id: blocker.id,
      blockerShape: 'polyline',
      points,
      thickness: blocker.thickness,
      type: blocker.kind === 'cliff' ? 'cliff' : 'oarbCurvedBlocker',
      tags: ['oarb', 'curvedBlocker', blocker.kind],
      userData: {
        ...baseMetadata(blocker, 'thickPolyline'),
        points: authoredPoints.map((point) => [...point]),
        thickness: blocker.thickness,
      },
    };
  }

  return null;
}

export function createOutdoorCurvedBlockers(curvedBlockers = []) {
  if (!Array.isArray(curvedBlockers)) return [];
  return curvedBlockers.map(createOutdoorCurvedBlocker).filter(Boolean);
}
