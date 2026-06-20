import { createPondCompositeGeometry, geometryWorldXZ } from '../src/engine/outdoor-authoring/PondCompositeBuilder.js';
import { createOutdoorTerrainSampler } from '../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';

const DEFAULT_MIN_MUD_MARGIN_WORLD = 2.0;
const DEFAULT_MIN_VISIBLE_MUD_BAND_WORLD = 2.0;
const DEFAULT_SHORELINE_SAMPLE_STEP_WORLD = 0.5;
const EPSILON = 1e-6;

function isFinitePoint(point) {
  return Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function polygonSignedArea(points) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const xi = polygon[index][0];
    const zi = polygon[index][1];
    const xj = polygon[previous][0];
    const zj = polygon[previous][1];
    const intersects = ((zi > point[1]) !== (zj > point[1])) && (point[0] < ((xj - xi) * (point[1] - zi)) / (zj - zi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= EPSILON) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSq));
  return Math.hypot(point[0] - (a[0] + dx * t), point[1] - (a[1] + dz * t));
}

function distanceToPolygonEdge(point, polygon) {
  return polygon.reduce((minDistance, current, index) => Math.min(minDistance, distanceToSegment(point, current, polygon[(index + 1) % polygon.length])), Infinity);
}

function boundsFor(points) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point[0]), maxX: Math.max(bounds.maxX, point[0]),
    minZ: Math.min(bounds.minZ, point[1]), maxZ: Math.max(bounds.maxZ, point[1]),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
}

function samplePolygonInterior(polygon, step = 0.75) {
  const bounds = boundsFor(polygon);
  const samples = [];
  for (let x = bounds.minX; x <= bounds.maxX + EPSILON; x += step) {
    for (let z = bounds.minZ; z <= bounds.maxZ + EPSILON; z += step) {
      const point = [Number(x.toFixed(3)), Number(z.toFixed(3))];
      if (pointInPolygon(point, polygon)) samples.push(point);
    }
  }
  return [...polygon, ...samples];
}


function formatCoord(value) {
  return Number(value.toFixed(3));
}

function directionLabel(dx, dz) {
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? '+X' : '-X';
  return dz >= 0 ? '+Z' : '-Z';
}

function sampleOutlineBand(innerOutline, outerOutline, minBandWidth, step, fail, bandName) {
  const orientation = polygonSignedArea(innerOutline) >= 0 ? 1 : -1;
  innerOutline.forEach((point, index) => {
    const next = innerOutline[(index + 1) % innerOutline.length];
    const dx = next[0] - point[0];
    const dz = next[1] - point[1];
    const length = Math.hypot(dx, dz);
    if (length <= EPSILON) {
      fail(`${bandName} edge ${index} has zero length.`);
      return;
    }
    const outwardNormal = orientation > 0 ? [dz / length, -dx / length] : [-dz / length, dx / length];
    const sampleCount = Math.max(1, Math.ceil(length / step));
    for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
      const t = Math.min(1, sampleIndex / sampleCount);
      const edgeSample = [point[0] + dx * t, point[1] + dz * t];
      for (let distance = step; distance <= minBandWidth + EPSILON; distance += step) {
        const sample = [formatCoord(edgeSample[0] + outwardNormal[0] * distance), formatCoord(edgeSample[1] + outwardNormal[1] * distance)];
        if (!pointInPolygon(sample, outerOutline)) {
          const dirLabel = directionLabel(outwardNormal[0], outwardNormal[1]);
          fail(`${bandName} edge sample at x=${formatCoord(edgeSample[0])} z=${formatCoord(edgeSample[1])} has no visible band before grass; ${dirLabel} shoreline band is shorter than ${minBandWidth} world units.`);
          return;
        }
      }
    }
  });
}

function labelFor(pond) {
  return pond?.userData?.pondExpoId ?? pond?.id ?? 'pond';
}

export function validatePondFootprint(pond, definition, options = {}) {
  const errors = [];
  const minMudMarginWorld = options.minMudMarginWorld ?? pond?.footprint?.minMudMarginWorld ?? DEFAULT_MIN_MUD_MARGIN_WORLD;
  const minVisibleMudBandWorld = options.minVisibleMudBandWorld ?? pond?.footprint?.minVisibleMudBandWorld ?? DEFAULT_MIN_VISIBLE_MUD_BAND_WORLD;
  const shorelineSampleStepWorld = options.shorelineSampleStepWorld ?? pond?.footprint?.shorelineSampleStepWorld ?? DEFAULT_SHORELINE_SAMPLE_STEP_WORLD;
  const label = labelFor(pond);
  const fail = (message) => errors.push(`${label} invalid: ${message}`);
  const footprint = pond?.footprint ?? {};
  const waterOutline = footprint.waterOutline ?? [];
  const mudBedOutline = footprint.mudBedOutline ?? [];
  const outerShoreOutline = footprint.outerShoreOutline ?? [];
  const [cx, cz] = pond?.center ?? [];
  const [rx, rz] = pond?.radius ?? [];

  if (![cx, cz, rx, rz, pond?.y, footprint.mudOffset].every(Number.isFinite)) fail('center, radii, y, and mud offset must all be finite.');
  if (rx <= 0 || rz <= 0) fail('water radii must be positive and not inverted.');
  if (footprint.recipe !== 'radial-expansion-irregular-polygon') fail('must use the single-source radial-expansion footprint recipe instead of a square/ellipse fallback.');
  if (footprint.center !== pond.center) fail('footprint center must share the exact water center object.');
  if (footprint.waterRadius !== pond.radius) fail('footprint waterRadius must share the exact water radius object.');
  if (!Array.isArray(waterOutline) || waterOutline.length < 8) fail('water outline must be the single source irregular polygon with at least 8 points.');
  if (mudBedOutline.length !== waterOutline.length) fail('bright mud bed outline must be generated point-for-point from the water outline.');
  if (outerShoreOutline.length > 0 && outerShoreOutline.length !== waterOutline.length) fail('wet shore outline must be generated point-for-point from the same water outline.');
  [...waterOutline, ...mudBedOutline, ...outerShoreOutline].forEach((point, index) => {
    if (!isFinitePoint(point)) fail(`outline point ${index} has non-finite coordinates.`);
  });

  if (waterOutline.length >= 3 && mudBedOutline.length >= 3) {
    if (Math.abs(polygonSignedArea(waterOutline)) <= EPSILON) fail('water outline has zero/invalid area.');
    if (Math.abs(polygonSignedArea(mudBedOutline)) <= Math.abs(polygonSignedArea(waterOutline))) fail('mud bed outline is not larger than the water outline.');
    samplePolygonInterior(waterOutline, options.sampleStepWorld ?? 0.75).forEach((sample) => {
      if (!pointInPolygon(sample, mudBedOutline)) fail(`water sample at x=${sample[0]} z=${sample[1]} is outside bright mud bed footprint.`);
      else if (distanceToPolygonEdge(sample, mudBedOutline) < minMudMarginWorld) fail(`water sample at x=${sample[0]} z=${sample[1]} is within ${minMudMarginWorld} world units of the bright mud bed edge.`);
    });
    sampleOutlineBand(waterOutline, mudBedOutline, minVisibleMudBandWorld, shorelineSampleStepWorld, fail, 'bright mud');
  }
  if (outerShoreOutline.length >= 3) {
    if (Math.abs(polygonSignedArea(outerShoreOutline)) <= Math.abs(polygonSignedArea(mudBedOutline))) fail('wet shore outline is not larger than the bright mud bed outline.');
    else sampleOutlineBand(mudBedOutline, outerShoreOutline, Math.min(minVisibleMudBandWorld, footprint.outerShoreOffset ?? minVisibleMudBandWorld), shorelineSampleStepWorld, fail, 'wet shore');
  }

  const pondRoom = (definition?.rooms ?? []).find((room) => room.tags?.includes('pond-expo'));
  waterOutline.forEach(([x, z], index) => {
    if (pondRoom && (x < pondRoom.minX || x > pondRoom.maxX || z < pondRoom.minZ || z > pondRoom.maxZ)) fail(`water outline point ${index} is outside expo bounds.`);
  });
  if (!definition?.textures?.[pond?.material]) fail(`water material ${pond?.material} does not resolve.`);
  if (!definition?.textures?.[pond?.bedMaterial]) fail(`bright mud material ${pond?.bedMaterial} does not resolve; water would fall back to grass/unknown bed.`);
  if (pond?.shoreMaterial && !definition?.textures?.[pond.shoreMaterial]) fail(`wet shore material ${pond.shoreMaterial} does not resolve.`);
  if (pond?.bedMaterial !== 'pondBrightMud') fail(`uses ${pond?.bedMaterial} under water instead of bright pond mud.`);
  if (pond?.userData?.noDownwardFacingTopNormals !== true) fail('geometry metadata must confirm top-visible/two-sided normals.');
  if (pond?.userData?.usesSquareDecalFallback === true) fail('square decal fallback is forbidden for polished pond recipes.');
  if (pond?.userData?.waterMeshSource !== 'waterOutline') fail('water mesh must use waterOutline instead of an ellipse fallback.');
  if (pond?.userData?.brightMudMeshSource !== 'mudBedOutline') fail('bright mud bed mesh must use mudBedOutline instead of a square/ellipse fallback.');
  if (outerShoreOutline.length >= 3 && pond?.userData?.wetShoreMeshSource !== 'outerShoreOutline') fail('wet shore mesh must use outerShoreOutline instead of a fallback ring.');

  return { valid: errors.length === 0, errors, minMudMarginWorld, minVisibleMudBandWorld, shorelineSampleStepWorld };
}

function samePointList(actual, expected, tolerance = 0.002) {
  return actual.length === expected.length && actual.every((point, index) => (
    Math.abs(point[0] - expected[index][0]) <= tolerance && Math.abs(point[1] - expected[index][1]) <= tolerance
  ));
}

function geometryHasOnlyUpwardTopNormals(geometry) {
  const normals = geometry?.attributes?.normal;
  if (!normals || normals.count === 0) return false;
  for (let index = 0; index < normals.count; index += 1) {
    if (normals.getY(index) < 0.999) return false;
  }
  return true;
}

export function validateRenderedPondComposite(pond, definition, options = {}) {
  const errors = [];
  const label = labelFor(pond);
  const fail = (message) => errors.push(`${label} rendered composite invalid: ${message}`);
  const footprint = pond?.footprint ?? {};
  let composite;
  try {
    composite = createPondCompositeGeometry(pond);
  } catch (error) {
    fail(`shared runtime geometry generation failed: ${error.message}`);
    return { valid: false, errors };
  }

  const center = pond.center ?? [];
  const waterVertices = geometryWorldXZ(composite.water.geometry, composite.water.position);
  const mudVertices = geometryWorldXZ(composite.mudBed.geometry, composite.mudBed.position);
  const outerIndices = Array.from({ length: footprint.outerShoreOutline?.length ?? 0 }, (_, index) => index * 2 + 1);
  const shoreOuterVertices = composite.wetShore ? geometryWorldXZ(composite.wetShore.geometry, composite.wetShore.position, outerIndices) : [];
  if (!samePointList(waterVertices, footprint.waterOutline ?? [])) fail('generated water BufferGeometry vertices do not match waterOutline in world coordinates.');
  if (!samePointList(mudVertices, footprint.mudBedOutline ?? [])) fail('generated bright-mud BufferGeometry vertices do not match mudBedOutline in world coordinates.');
  if (composite.wetShore && !samePointList(shoreOuterVertices, footprint.outerShoreOutline ?? [])) fail('generated wet-shore BufferGeometry vertices do not match outerShoreOutline in world coordinates.');
  if ([composite.water, composite.mudBed, composite.wetShore].filter(Boolean).some((layer) => layer.position[0] !== center[0] || layer.position[2] !== center[1])) fail('water, mud, and shore meshes do not share the authored world-coordinate basis.');
  if (composite.water.materialKey !== 'pondWaterAnimated') fail(`runtime water material resolves to ${composite.water.materialKey}, expected pondWaterAnimated.`);
  if (composite.mudBed.materialKey !== 'pondBrightMud') fail(`runtime mud material resolves to ${composite.mudBed.materialKey}, expected pondBrightMud.`);
  if (composite.water.source !== 'waterOutline' || composite.mudBed.source !== 'mudBedOutline' || composite.wetShore?.source !== 'outerShoreOutline') fail('one or more runtime layers selected a fallback ellipse/square geometry source.');
  if (![composite.water.geometry, composite.mudBed.geometry, composite.wetShore?.geometry].filter(Boolean).every(geometryHasOnlyUpwardTopNormals)) fail('generated pond top geometry contains downward-facing normals.');

  waterVertices.forEach((point, index) => {
    if (!pointInPolygon(point, mudVertices)) fail(`generated water vertex ${index} falls outside the generated mud mesh polygon.`);
    else if (distanceToPolygonEdge(point, mudVertices) < (footprint.minMudMarginWorld ?? DEFAULT_MIN_MUD_MARGIN_WORLD)) fail(`generated water vertex ${index} has insufficient rendered mud margin.`);
  });
  sampleOutlineBand(
    waterVertices,
    mudVertices,
    footprint.minVisibleMudBandWorld ?? DEFAULT_MIN_VISIBLE_MUD_BAND_WORLD,
    footprint.shorelineSampleStepWorld ?? DEFAULT_SHORELINE_SAMPLE_STEP_WORLD,
    fail,
    'generated bright mud',
  );

  const mudBedY = composite.mudBed.position[1];
  const wetShoreY = composite.wetShore?.position[1] ?? mudBedY;
  const waterY = composite.water.position[1];
  const terrainSafetyGap = footprint.layerHeights?.terrainSafetyGap ?? 0.02;
  if (!(waterY > mudBedY && waterY - mudBedY >= (footprint.layerHeights?.waterAboveMud ?? 0.035) - EPSILON)) fail('water mesh is not explicitly above the bright mud underlay.');
  if (Math.abs(wetShoreY - mudBedY) > 0.02) fail('wet shore and bright mud layers are too far apart to read as one shoreline.');

  const terrainSampler = options.terrainSampler ?? createOutdoorTerrainSampler(definition?.terrain);
  const terrainSamples = samplePolygonInterior(footprint.outerShoreOutline ?? [], options.terrainSampleStepWorld ?? 0.25);
  let maxTerrainY = -Infinity;
  let maxTerrainPoint = null;
  terrainSamples.forEach(([x, z]) => {
    const sampledY = terrainSampler.sampleOutdoorY(x, z);
    if (sampledY > maxTerrainY) {
      maxTerrainY = sampledY;
      maxTerrainPoint = [x, z];
    }
  });
  const lowestVisibleLayerY = Math.min(mudBedY, wetShoreY);
  if (maxTerrainY > lowestVisibleLayerY - terrainSafetyGap + EPSILON) fail(`terrain reaches y=${formatCoord(maxTerrainY)} at x=${maxTerrainPoint?.[0]} z=${maxTerrainPoint?.[1]}, above the required grass-to-mud safety ceiling.`);

  return {
    valid: errors.length === 0,
    errors,
    geometry: {
      waterVertexCount: composite.water.geometry.attributes.position.count,
      mudVertexCount: composite.mudBed.geometry.attributes.position.count,
      shoreVertexCount: composite.wetShore?.geometry.attributes.position.count ?? 0,
      maxTerrainY: formatCoord(maxTerrainY),
      layerHeights: { wetShoreY, mudBedY, waterY },
      coordinateBasis: composite.coordinateBasis,
      materialKeys: { wetShore: composite.wetShore?.materialKey, mudBed: composite.mudBed.materialKey, water: composite.water.materialKey },
    },
  };
}

export function assertValidRenderedPondComposite(pond, definition, options = {}) {
  const result = validateRenderedPondComposite(pond, definition, options);
  if (!result.valid) throw new Error(result.errors.join('\n'));
  return result;
}

export function assertValidPondFootprint(pond, definition, options = {}) {
  const result = validatePondFootprint(pond, definition, options);
  if (!result.valid) throw new Error(result.errors.join('\n'));
  return result;
}
