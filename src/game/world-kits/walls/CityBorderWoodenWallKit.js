const DEFAULT_WALL_HEIGHT = 6.1;
const DEFAULT_THICKNESS = 0.65;
const DEFAULT_PANEL_LENGTH = 6;
const DEFAULT_POST_HEIGHT = 6.6;
const DEFAULT_POST_THICKNESS = 0.9;

function point2(value) {
  const x = Number(value?.x ?? value?.[0]);
  const z = Number(value?.z ?? value?.[1]);
  return Number.isFinite(x) && Number.isFinite(z) ? [x, z] : null;
}

function distance2(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function lerpPoint(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function projectPointToSegment(point, a, b) {
  const vx = b[0] - a[0];
  const vz = b[1] - a[1];
  const lengthSq = vx * vx + vz * vz;
  if (lengthSq <= 0.000001) return { t: 0, distance: distance2(point, a), projected: a };
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * vx + (point[1] - a[1]) * vz) / lengthSq));
  const projected = lerpPoint(a, b, t);
  return { t, distance: distance2(point, projected), projected };
}

function intervalsForSegment(a, b, gateOpenings = []) {
  const length = distance2(a, b);
  if (length <= 0.001) return [[0, 1]];
  const cuts = [];
  gateOpenings.forEach((gate) => {
    const center = point2(gate.center);
    const width = Number(gate.width);
    if (!center || !Number.isFinite(width) || width <= 0) return;
    const projected = projectPointToSegment(center, a, b);
    const tolerance = Number.isFinite(gate.tolerance) ? gate.tolerance : Math.max(3, width * 0.65);
    if (projected.distance > tolerance) return;
    const halfT = (width * 0.5) / length;
    cuts.push([Math.max(0, projected.t - halfT), Math.min(1, projected.t + halfT)]);
  });
  cuts.sort((left, right) => left[0] - right[0]);
  const intervals = [];
  let cursor = 0;
  cuts.forEach(([start, end]) => {
    if (start > cursor + 0.01) intervals.push([cursor, start]);
    cursor = Math.max(cursor, end);
  });
  if (cursor < 0.99) intervals.push([cursor, 1]);
  return intervals.filter(([start, end]) => end - start > 0.01);
}

function sampleY(terrainSampler, point) {
  const y = terrainSampler?.sampleOutdoorY?.(point[0], point[1]);
  return Number.isFinite(y) ? y : 0;
}

export function createCityBorderWoodenWall({
  idPrefix,
  points,
  roomId = 'folsom_bounds',
  height = DEFAULT_WALL_HEIGHT,
  thickness = DEFAULT_THICKNESS,
  panelLength = DEFAULT_PANEL_LENGTH,
  postHeight = DEFAULT_POST_HEIGHT,
  postThickness = DEFAULT_POST_THICKNESS,
  materialKeys = [],
  gateOpenings = [],
  terrainSampler = null,
  terrainSamplerAware = true,
  tags = [],
} = {}) {
  const safePrefix = typeof idPrefix === 'string' && idPrefix.trim() ? idPrefix.trim() : 'city_border_wooden_wall';
  const safePoints = Array.isArray(points) ? points.map(point2).filter(Boolean) : [];
  const safeMaterials = materialKeys.filter((key) => typeof key === 'string' && key.trim());
  if (safePoints.length < 2 || safeMaterials.length === 0) {
    return { wallSegments: [], architecturalPrimitives: [], validation: { idPrefix: safePrefix, height, materialKeys: safeMaterials, gateOpenings } };
  }

  const wallSegments = [];
  const architecturalPrimitives = [];
  let panelIndex = 0;
  let postIndex = 0;

  for (let runIndex = 0; runIndex < safePoints.length - 1; runIndex += 1) {
    const runStart = safePoints[runIndex];
    const runEnd = safePoints[runIndex + 1];
    const runLength = distance2(runStart, runEnd);
    if (runLength <= 0.001) continue;
    intervalsForSegment(runStart, runEnd, gateOpenings).forEach(([intervalStart, intervalEnd]) => {
      const intervalLength = runLength * (intervalEnd - intervalStart);
      const pieces = Math.max(1, Math.ceil(intervalLength / panelLength));
      for (let piece = 0; piece < pieces; piece += 1) {
        const startT = intervalStart + ((intervalEnd - intervalStart) * piece) / pieces;
        const endT = intervalStart + ((intervalEnd - intervalStart) * (piece + 1)) / pieces;
        const from = lerpPoint(runStart, runEnd, startT);
        const to = lerpPoint(runStart, runEnd, endT);
        const midpoint = lerpPoint(from, to, 0.5);
        const baseY = terrainSamplerAware ? Math.min(sampleY(terrainSampler, from), sampleY(terrainSampler, midpoint), sampleY(terrainSampler, to)) : 0;
        const material = safeMaterials[panelIndex % safeMaterials.length];
        wallSegments.push({
          id: `${safePrefix}_panel_${String(panelIndex + 1).padStart(3, '0')}`,
          from,
          to,
          y: Number(baseY.toFixed(3)),
          height,
          thickness,
          material,
          roomId,
          tags: ['city-border-wall', 'wooden-city-wall', 'terrain-following', ...tags],
          userData: { kit: 'CityBorderWoodenWallKit', panelIndex, textureVariationIndex: panelIndex % safeMaterials.length },
        });
        [from, to].forEach((point, endpointIndex) => {
          if (endpointIndex === 0 && piece > 0) return;
          const postY = terrainSamplerAware ? sampleY(terrainSampler, point) : baseY;
          architecturalPrimitives.push({
            id: `${safePrefix}_post_${String(postIndex + 1).padStart(3, '0')}`,
            kind: 'brokenColumn',
            position: [point[0], Number(postY.toFixed(3)), point[1]],
            radius: postThickness * 0.5,
            height: postHeight,
            material,
            blocksPlayer: true,
            tags: ['city-border-wall-post', 'wooden-city-wall', ...tags],
            userData: { kit: 'CityBorderWoodenWallKit', panelIndex, postIndex },
          });
          postIndex += 1;
        });
        panelIndex += 1;
      }
    });
  }

  return {
    wallSegments,
    architecturalPrimitives,
    validation: { idPrefix: safePrefix, height, thickness, panelLength, materialKeys: safeMaterials, gateOpenings },
  };
}
