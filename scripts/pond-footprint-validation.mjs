import { createPondCompositeGeometry, geometryWorldXZ } from '../src/engine/outdoor-authoring/PondCompositeBuilder.js';
import { createOutdoorTerrainSampler } from '../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { generatePondDecorPlacements, pointInPondDecorClearZone, pointInPondPolygon, POND_VEGETATION_SPRITES } from '../src/engine/outdoor-authoring/PondDecorBuilder.js';

const DEFAULT_MIN_MUD_MARGIN_WORLD = 2.0;
const DEFAULT_MIN_VISIBLE_MUD_BAND_WORLD = 2.0;
const DEFAULT_SHORELINE_SAMPLE_STEP_WORLD = 0.5;
const EPSILON = 1e-6;
const SUPPORTED_FOOTPRINT_RECIPES = new Set([
  'radial-expansion-irregular-polygon',
  'per-vertex-expansion-irregular-polygon',
]);

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

function countInRange(count, range) {
  return Array.isArray(range) && range.length >= 2 && Number.isFinite(range[0]) && Number.isFinite(range[1])
    && count >= range[0] && count <= range[1];
}

export function validatePondDecor(pond, definition, options = {}) {
  const errors = [];
  const label = labelFor(pond);
  const fail = (message) => errors.push(`${label} invalid: ${message}`);
  const recipe = pond?.pondDecor;
  if (!recipe) return { valid: true, errors, decorations: { boulders: [], vegetation: [] } };
  const decorations = generatePondDecorPlacements(pond);
  const assetExists = typeof options.assetExists === 'function' ? options.assetExists : null;
  const waterOutline = pond?.footprint?.waterOutline ?? [];
  const clearZones = recipe.clearZones ?? [];

  const boulderRecipe = recipe.boulders;
  if (boulderRecipe) {
    if (!countInRange(decorations.boulders.length, boulderRecipe.countRange)) {
      fail(`generated ${decorations.boulders.length} boulders outside requested range ${JSON.stringify(boulderRecipe.countRange)}.`);
    }
    (boulderRecipe.texturePool ?? []).forEach((materialKey) => {
      const profile = definition?.textures?.[materialKey];
      if (!profile) fail(`boulder material ${materialKey} does not resolve.`);
      else if (typeof profile.path !== 'string') fail(`boulder material ${materialKey} has no texture path.`);
      else if (assetExists && !assetExists(profile.path)) fail(`boulder texture path does not resolve: ${profile.path}.`);
    });
    decorations.boulders.forEach((boulder) => {
      if (![...(boulder.position ?? []), ...(boulder.scale ?? []), ...(boulder.rotation ?? []), boulder.sinkRatio].every(Number.isFinite)) {
        fail(`boulder ${boulder.id} has non-finite placement values.`);
      }
      if (!definition?.textures?.[boulder.materialKey]) fail(`boulder ${boulder.id} uses missing material ${boulder.materialKey}.`);
      if (!(boulderRecipe.texturePool ?? []).includes(boulder.materialKey)) fail(`boulder ${boulder.id} uses material ${boulder.materialKey} outside its texture pool.`);
      const insideWater = pointInPondPolygon(boulder.position, waterOutline);
      if (insideWater && !(boulder.partiallySubmerged && boulder.placementZone === 'submerged')) {
        fail(`boulder ${boulder.id} placed inside water footprint.`);
      }
      if (boulder.placementZone === 'submerged') {
        const edgeDistance = distanceToPolygonEdge(boulder.position, waterOutline);
        if (!insideWater || edgeDistance > 1.35) fail(`submerged boulder ${boulder.id} is not partly in/near water edge.`);
        if (boulder.sinkRatio >= 0.78) fail(`submerged boulder ${boulder.id} is fully below water surface.`);
      }
      if (pointInPondDecorClearZone(boulder.position, clearZones)) fail(`boulder ${boulder.id} overlaps a marker, label, or inspection-path clear zone.`);
    });
  }

  const vegetationRecipe = recipe.vegetation;
  if (vegetationRecipe) {
    const bushes = decorations.vegetation.filter((placement) => placement.layer === 'bush');
    const smallTrees = decorations.vegetation.filter((placement) => placement.layer === 'small-tree');
    if (!countInRange(bushes.length, vegetationRecipe.bushesRange)) fail(`generated ${bushes.length} bushes outside requested range ${JSON.stringify(vegetationRecipe.bushesRange)}.`);
    if (!countInRange(smallTrees.length, vegetationRecipe.smallTreesRange)) fail(`generated ${smallTrees.length} small trees outside requested range ${JSON.stringify(vegetationRecipe.smallTreesRange)}.`);
    decorations.vegetation.forEach((placement) => {
      const registryEntry = POND_VEGETATION_SPRITES.find((sprite) => sprite.id === placement.spriteId);
      const assetLabel = `${placement.spriteId ?? ''} ${placement.spritePath ?? ''}`.toLowerCase();
      if (![...(placement.position ?? []), placement.scale, placement.sinkRatio, placement.width].every(Number.isFinite)) fail(`vegetation ${placement.id} has non-finite placement values.`);
      if (assetLabel.includes('redwood')) fail(`vegetation asset ${placement.spriteId} is forbidden for pond vegetation.`);
      (vegetationRecipe.excludeTags ?? []).forEach((tag) => {
        if (assetLabel.includes(String(tag).toLowerCase())) fail(`vegetation asset ${placement.spriteId} matches excluded tag ${tag}.`);
      });
      if (!registryEntry) fail(`vegetation asset ${placement.spriteId} does not resolve in the outdoor foliage registry.`);
      else if (registryEntry.path !== placement.spritePath) fail(`vegetation asset ${placement.spriteId} resolves to an unexpected sprite path.`);
      if (assetExists && placement.spritePath && !assetExists(placement.spritePath)) fail(`vegetation sprite path does not resolve: ${placement.spritePath}.`);
      if (placement.layer === 'aquatic-brush') {
        const edgeDistance = distanceToPolygonEdge(placement.position, waterOutline);
        if (edgeDistance > 1.6) fail(`aquatic brush cluster placed too far from shoreline.`);
      } else if (pointInPondPolygon(placement.position, waterOutline)) fail(`vegetation ${placement.id} placed inside water footprint.`);
      if (pointInPondDecorClearZone(placement.position, clearZones)) fail(`vegetation ${placement.id} overlaps a marker, label, or inspection-path clear zone.`);
    });
  }
  return { valid: errors.length === 0, errors, decorations };
}

export function assertValidPondDecor(pond, definition, options = {}) {
  const result = validatePondDecor(pond, definition, options);
  if (!result.valid) throw new Error(result.errors.join('\n'));
  return result;
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
  if (!SUPPORTED_FOOTPRINT_RECIPES.has(footprint.recipe)) fail('must use a supported single-source irregular-polygon footprint recipe instead of a square/ellipse fallback.');
  if (footprint.center !== pond.center) fail('footprint center must share the exact water center object.');
  if (footprint.waterRadius !== pond.radius) fail('footprint waterRadius must share the exact water radius object.');
  if (!Array.isArray(waterOutline) || waterOutline.length < 16) fail('water outline must be the single source irregular polygon with at least 16 points.');
  if (Array.isArray(waterOutline) && waterOutline.length >= 3) {
    const radii = waterOutline.map(([x, z]) => Math.hypot(x - cx, z - cz));
    const mean = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
    const variation = Math.sqrt(radii.reduce((sum, radius) => sum + (radius - mean) ** 2, 0) / radii.length) / Math.max(EPSILON, mean);
    const recipeShape = pond?.userData?.recipeData?.shape ?? {};
    if (variation < 0.045 && (recipeShape.outlineWobble ?? 0) < 0.16 && (recipeShape.edgeRoughness ?? 0) < 0.06) fail('water outline is too circular; shoreline variation below minimum.');
  }
  if (mudBedOutline.length !== waterOutline.length) fail('bright mud bed outline must be generated point-for-point from the water outline.');
  if (outerShoreOutline.length > 0 && outerShoreOutline.length !== waterOutline.length) fail('wet shore outline must be generated point-for-point from the same water outline.');
  if (footprint.recipe === 'per-vertex-expansion-irregular-polygon') {
    if (footprint.mudOffsets?.length !== waterOutline.length || !footprint.mudOffsets.every(Number.isFinite)) fail('per-vertex bright mud expansion must provide one finite offset for every water point.');
    if (outerShoreOutline.length > 0 && (footprint.outerShoreOffsets?.length !== waterOutline.length || !footprint.outerShoreOffsets.every(Number.isFinite))) fail('per-vertex wet shore expansion must provide one finite offset for every water point.');
    if (new Set(footprint.mudOffsets ?? []).size < 3) fail('per-vertex bright mud expansion must vary around the shoreline.');
    if (outerShoreOutline.length > 0 && new Set(footprint.outerShoreOffsets ?? []).size < 3) fail('per-vertex wet shore expansion must vary around the shoreline.');
  }
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
  if (pond?.userData?.generatedBy !== 'OutdoorPondBuilder') fail('must be compiled by OutdoorPondBuilder from a deterministic recipe.');
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


function geometryWorldYRange(geometry, position = [0, 0, 0]) {
  const attribute = geometry?.attributes?.position;
  if (!attribute) return { min: Infinity, max: -Infinity, values: [] };
  const values = Array.from({ length: attribute.count }, (_, index) => attribute.getY(index) + position[1]);
  return { min: Math.min(...values), max: Math.max(...values), values };
}

function geometryWorldXZForIndices(geometry, position, indices) {
  return geometryWorldXZ(geometry, position, indices);
}
function geometryHasAcceptableTopNormals(geometry) {
  const normals = geometry?.attributes?.normal;
  if (!normals || normals.count === 0) return false;
  for (let index = 0; index < normals.count; index += 1) {
    if (normals.getY(index) < 0.2) return false;
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
  const renderedWaterOutline = footprint.visualWaterOutline ?? footprint.waterOutline ?? [];
  const mudOuterIndices = composite.mudBed.geometry.userData?.pondGeometryKind === 'conformedMudBed' ? Array.from({ length: footprint.mudBedOutline?.length ?? 0 }, (_, index) => index * 2 + 2) : null;
  const mudVertices = geometryWorldXZForIndices(composite.mudBed.geometry, composite.mudBed.position, mudOuterIndices);
  const outerIndices = Array.from({ length: footprint.outerShoreOutline?.length ?? 0 }, (_, index) => index * 2 + 1);
  const shoreOuterVertices = composite.wetShore ? geometryWorldXZ(composite.wetShore.geometry, composite.wetShore.position, outerIndices) : [];
  if (!samePointList(waterVertices, renderedWaterOutline)) fail('generated water BufferGeometry vertices do not match the authored rendered water outline in world coordinates.');
  if (!samePointList(mudVertices, footprint.mudBedOutline ?? [])) fail('generated bright-mud BufferGeometry vertices do not match mudBedOutline in world coordinates.');
  if (composite.wetShore && !samePointList(shoreOuterVertices, footprint.outerShoreOutline ?? [])) fail('generated wet-shore BufferGeometry vertices do not match outerShoreOutline in world coordinates.');
  if ([composite.water, composite.mudBed, composite.wetShore].filter(Boolean).some((layer) => layer.position[0] !== center[0] || layer.position[2] !== center[1])) fail('water, mud, and shore meshes do not share the authored world-coordinate basis.');
  if (composite.water.materialKey !== pond.material) fail(`runtime water material resolves to ${composite.water.materialKey}, expected ${pond.material}.`);
  if (composite.mudBed.materialKey !== pond.bedMaterial) fail(`runtime mud material resolves to ${composite.mudBed.materialKey}, expected ${pond.bedMaterial}.`);
  const waterProfile = definition?.textures?.[pond.material];
  if (!Array.isArray(waterProfile?.animatedFrames) || waterProfile.animatedFrames.length !== 6) fail('runtime water material must resolve all six animated pond frames.');
  if (!['loop', 'pingPong'].includes(waterProfile?.playbackMode)) fail('runtime water playback mode must be loop or pingPong.');
  if (!['waterOutline', 'visualWaterOutline-shore-overlap'].includes(composite.water.source) || composite.mudBed.source !== 'mudBedOutline' || composite.wetShore?.source !== 'outerShoreOutline') fail('one or more runtime layers selected a fallback ellipse/square geometry source.');
  if (![composite.water.geometry, composite.mudBed.geometry, composite.wetShore?.geometry].filter(Boolean).every(geometryHasAcceptableTopNormals)) fail('generated pond top geometry contains downward-facing normals.');

  waterVertices.forEach((point, index) => {
    if (!pointInPolygon(point, mudVertices)) fail(`generated water vertex ${index} falls outside the generated mud mesh polygon.`);
  });
  const logicalWaterVertices = footprint.waterOutline ?? waterVertices;
  logicalWaterVertices.forEach((point, index) => {
    if (distanceToPolygonEdge(point, mudVertices) < (footprint.minMudMarginWorld ?? DEFAULT_MIN_MUD_MARGIN_WORLD)) fail(`authored water vertex ${index} has insufficient logical mud margin.`);
  });
  sampleOutlineBand(
    logicalWaterVertices,
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
  const mudYRange = geometryWorldYRange(composite.mudBed.geometry, composite.mudBed.position);
  const shoreYRange = geometryWorldYRange(composite.wetShore?.geometry, composite.wetShore?.position ?? [0, 0, 0]);
  const depth = waterY - (footprint.layerHeights?.waterFloorY ?? mudYRange.min);
  const depthProfile = String(footprint.depthProfile ?? pond?.userData?.depthProfile ?? '');
  const needsVariation = depth >= 0.5 || /medium|deep/.test(depthProfile);
  if (!(mudYRange.min < waterY - 0.04)) fail('underwater mud/floor is not below the water surface.');
  if (!((footprint.layerHeights?.mudBedY ?? mudYRange.max) > waterY + 0.008)) fail('exposed mud inner edge is below water surface.');
  if (needsVariation && mudYRange.max - mudYRange.min < 0.12) fail('deep pond shore layer is flat; expected Y variation across mud/bank mesh.');
  if (needsVariation && shoreYRange.max - shoreYRange.min < 0.025) fail('deep pond wet bank layer is flat; expected uphill slope toward grass.');
  if (Math.abs((shoreYRange.min || wetShoreY) - (footprint.layerHeights?.mudBedY ?? mudBedY)) > 0.08) fail('wet shore and bright mud layers disconnect instead of forming one sloped shoreline.');

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
  const outerBankY = footprint.layerHeights?.outerBankY ?? shoreYRange.max;
  if (maxTerrainY > outerBankY + terrainSafetyGap + 0.08) fail(`terrain reaches y=${formatCoord(maxTerrainY)} at x=${maxTerrainPoint?.[0]} z=${maxTerrainPoint?.[1]}, above the conformed outer bank ceiling.`);
  if (needsVariation && (footprint.layerHeights?.visibleMudWidth ?? Infinity) > 1.25) fail('visible bright mud band is too wide for a deep conformed pond.');
  if (needsVariation && (footprint.layerHeights?.wetBankWidth ?? Infinity) > 0.78) fail('dark wet bank is too wide for a deep conformed pond.');

  return {
    valid: errors.length === 0,
    errors,
    geometry: {
      waterVertexCount: composite.water.geometry.attributes.position.count,
      mudVertexCount: composite.mudBed.geometry.attributes.position.count,
      shoreVertexCount: composite.wetShore?.geometry.attributes.position.count ?? 0,
      maxTerrainY: formatCoord(maxTerrainY),
      layerHeights: { wetShoreY, mudBedY, waterY, mudYRange, shoreYRange },
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
