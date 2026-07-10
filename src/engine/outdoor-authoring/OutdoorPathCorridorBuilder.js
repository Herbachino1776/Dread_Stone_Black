import * as THREE from 'three';

export const OARB_PATH_CORRIDOR_SURFACE_MODES = Object.freeze(['conform', 'graded', 'bridge']);
export const OARB_PATH_CORRIDOR_DEFAULT_SAMPLE_SPACING = 0.65;
export const OARB_PATH_CORRIDOR_MAX_SAMPLES = 768;
export const OARB_PATH_CORRIDOR_MAX_VERTICES = 6144;
export const OARB_PATH_CORRIDOR_MAX_TRIANGLES = 10240;
export const OARB_PATH_CORRIDOR_VISUAL_CLEARANCE = 0.006;

export const OARB_PATH_CORRIDOR_GRADE_DEFAULTS = Object.freeze({
  smoothingDistance: 5,
  maxSlope: 0.12,
  maxCrossSlope: 0.16,
  maxCut: 0.5,
  maxFill: 0.4,
});

export const OARB_PATH_CORRIDOR_CROSS_SECTION_DEFAULTS = Object.freeze({
  crownHeight: 0.035,
  shoulderWidth: 0.9,
  shoulderDrop: 0.06,
  terrainBlendWidth: 1.4,
  lateralSamples: 7,
});

const FALLBACK_MATERIAL_KEY = 'mudTrail';
const FALLBACK_MATERIAL_PROFILE = Object.freeze({
  path: './assets/textures/outdoor/field_dead_grass_01.png',
  color: 0x5f4b37,
  roughness: 1,
  metalness: 0,
  worldTileLength: 8,
  worldTileWidth: 3,
});

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const finitePositive = (value) => Number.isFinite(value) && value > 0;

function safeNumber(value, fallback, minimum = -Infinity, maximum = Infinity) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, minimum, maximum) : fallback;
}

function finitePoint(value) {
  const x = Number(value?.x ?? value?.[0]);
  const z = Number(value?.z ?? value?.[1]);
  return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
}

function removeDuplicatePoints(points) {
  const result = [];
  points.forEach((point) => {
    const previous = result.at(-1);
    if (!previous || Math.hypot(point.x - previous.x, point.z - previous.z) > 0.001) result.push(point);
  });
  return result;
}

function normalize2(x, z, fallback = { x: 1, z: 0 }) {
  const length = Math.hypot(x, z);
  return length > 0.000001 ? { x: x / length, z: z / length } : fallback;
}

function tangentAt(points, index) {
  const previous = points[Math.max(0, index - 3)];
  const next = points[Math.min(points.length - 1, index + 3)];
  return normalize2(next.x - previous.x, next.z - previous.z);
}

function turnAngle(points, index) {
  if (index <= 0 || index >= points.length - 1) return 0;
  const incoming = normalize2(points[index].x - points[index - 1].x, points[index].z - points[index - 1].z);
  const outgoing = normalize2(points[index + 1].x - points[index].x, points[index + 1].z - points[index].z);
  return Math.acos(clamp(incoming.x * outgoing.x + incoming.z * outgoing.z, -1, 1));
}

function makeLateralOffsets(width, crossSection) {
  const bedHalf = width * 0.5;
  const shoulderEdge = bedHalf + crossSection.shoulderWidth;
  const outer = shoulderEdge + crossSection.terrainBlendWidth;
  const count = crossSection.lateralSamples;
  if (count === 7 && crossSection.shoulderWidth <= 0.001) return [bedHalf, bedHalf * (2 / 3), bedHalf * (1 / 3), 0, -bedHalf * (1 / 3), -bedHalf * (2 / 3), -bedHalf];
  if (count === 7) return [outer, shoulderEdge, bedHalf, 0, -bedHalf, -shoulderEdge, -outer];
  const offsets = [];
  for (let index = 0; index < count; index += 1) offsets.push(lerp(outer, -outer, index / (count - 1)));
  return offsets;
}

function sampleBudgetFor(path) {
  const byVertices = Math.floor(OARB_PATH_CORRIDOR_MAX_VERTICES / path.crossSection.lateralSamples);
  const byTriangles = Math.floor(OARB_PATH_CORRIDOR_MAX_TRIANGLES / (2 * Math.max(1, path.crossSection.lateralSamples - 1))) + 1;
  return Math.max(2, Math.min(OARB_PATH_CORRIDOR_MAX_SAMPLES, byVertices, byTriangles));
}

export function sanitizeOutdoorPathCorridor(path) {
  const id = typeof path?.id === 'string' && path.id.trim() ? path.id.trim() : null;
  const points = removeDuplicatePoints(Array.isArray(path?.points) ? path.points.map(finitePoint).filter(Boolean) : []);
  const width = Number(path?.width);
  const surfaceMode = OARB_PATH_CORRIDOR_SURFACE_MODES.includes(path?.surfaceMode) ? path.surfaceMode : null;
  if (!id || !surfaceMode || points.length < 2 || !finitePositive(width)) return null;

  const grade = Object.freeze({
    smoothingDistance: safeNumber(path.grade?.smoothingDistance, OARB_PATH_CORRIDOR_GRADE_DEFAULTS.smoothingDistance, 0, 40),
    maxSlope: safeNumber(path.grade?.maxSlope, OARB_PATH_CORRIDOR_GRADE_DEFAULTS.maxSlope, 0.01, 1),
    maxCrossSlope: safeNumber(path.grade?.maxCrossSlope, OARB_PATH_CORRIDOR_GRADE_DEFAULTS.maxCrossSlope, 0.01, 1),
    maxCut: safeNumber(path.grade?.maxCut, OARB_PATH_CORRIDOR_GRADE_DEFAULTS.maxCut, 0, 8),
    maxFill: safeNumber(path.grade?.maxFill, OARB_PATH_CORRIDOR_GRADE_DEFAULTS.maxFill, 0, 8),
  });
  let lateralSamples = Math.round(safeNumber(path.crossSection?.lateralSamples, OARB_PATH_CORRIDOR_CROSS_SECTION_DEFAULTS.lateralSamples, 5, 9));
  if (lateralSamples % 2 === 0) lateralSamples += lateralSamples < 9 ? 1 : -1;
  const crossSection = Object.freeze({
    crownHeight: safeNumber(path.crossSection?.crownHeight, OARB_PATH_CORRIDOR_CROSS_SECTION_DEFAULTS.crownHeight, 0, 0.3),
    shoulderWidth: safeNumber(path.crossSection?.shoulderWidth, OARB_PATH_CORRIDOR_CROSS_SECTION_DEFAULTS.shoulderWidth, 0, 8),
    shoulderDrop: safeNumber(path.crossSection?.shoulderDrop, OARB_PATH_CORRIDOR_CROSS_SECTION_DEFAULTS.shoulderDrop, 0, 1),
    terrainBlendWidth: safeNumber(path.crossSection?.terrainBlendWidth, OARB_PATH_CORRIDOR_CROSS_SECTION_DEFAULTS.terrainBlendWidth, 0.1, 12),
    lateralSamples,
  });

  return Object.freeze({
    id,
    points: Object.freeze(points.map(Object.freeze)),
    width,
    materialKey: typeof path.material === 'string' && path.material.trim() ? path.material : FALLBACK_MATERIAL_KEY,
    surfaceMode,
    sampleSpacing: safeNumber(path.sampleSpacing, OARB_PATH_CORRIDOR_DEFAULT_SAMPLE_SPACING, 0.35, 2),
    grade,
    crossSection,
    lateralOffsets: Object.freeze(makeLateralOffsets(width, crossSection)),
    pathSupport: path.surfaceMode === 'bridge' ? path.pathSupport !== false : false,
    edgeMeshes: path.edgeMeshes === true,
    tags: Object.freeze(Array.isArray(path.tags) ? [...path.tags] : []),
  });
}

function resampleAuthoredPolyline(path, terrainSampler) {
  const points = [];
  const sampleBudget = sampleBudgetFor(path);
  const segmentDefinitions = path.points.slice(0, -1).map((from, segmentIndex) => {
    const to = path.points[segmentIndex + 1];
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const sharpAtStart = turnAngle(path.points, segmentIndex) > Math.PI / 5;
    const sharpAtEnd = turnAngle(path.points, segmentIndex + 1) > Math.PI / 5;
    return { from, to, length, baseSpacing: (sharpAtStart || sharpAtEnd) ? path.sampleSpacing * 0.55 : path.sampleSpacing };
  });
  let spacingScale = 1;
  for (let pass = 0; pass < 12; pass += 1) {
    const requiredSteps = segmentDefinitions.reduce((sum, segment) => sum + Math.max(1, Math.ceil(segment.length / (segment.baseSpacing * spacingScale))), 0);
    if (requiredSteps <= sampleBudget - 1) break;
    spacingScale *= requiredSteps / (sampleBudget - 1) + 0.01;
  }
  const sampleBudgetAdapted = spacingScale > 1.0001;
  let sharpTurnInsertions = 0;
  segmentDefinitions.forEach(({ from, to, length, baseSpacing }) => {
    const spacing = baseSpacing * spacingScale;
    const steps = Math.max(1, Math.ceil(length / spacing));
    if (baseSpacing < path.sampleSpacing) sharpTurnInsertions += Math.max(0, steps - Math.ceil(length / (path.sampleSpacing * spacingScale)));
    for (let step = 0; step < steps; step += 1) {
      if (points.length >= sampleBudget - 1) break;
      const t = step / steps;
      points.push({ x: lerp(from.x, to.x, t), z: lerp(from.z, to.z, t) });
    }
  });
  points.push({ ...path.points.at(-1) });

  let terrainInsertions = 0;
  const refined = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    refined.push(from);
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    if (refined.length >= sampleBudget - 1 || distance <= path.sampleSpacing * 0.42) continue;
    const y0 = terrainSampler.sampleOutdoorY(from.x, from.z);
    const y1 = terrainSampler.sampleOutdoorY(to.x, to.z);
    const mx = (from.x + to.x) * 0.5;
    const mz = (from.z + to.z) * 0.5;
    const ym = terrainSampler.sampleOutdoorY(mx, mz);
    const curvature = Math.abs(ym - (y0 + y1) * 0.5);
    const grade = Math.abs(y1 - y0) / Math.max(distance, 0.001);
    if (curvature > 0.045 || grade > path.grade.maxSlope * 1.35) {
      refined.push({ x: mx, z: mz });
      terrainInsertions += 1;
    }
  }
  refined.push(points.at(-1));

  // Terrain refinement must never invalidate the same mobile budget that the
  // base resampler just enforced. Retain both endpoints and distribute the
  // bounded rows deterministically across the refined profile.
  const bounded = refined.length <= sampleBudget
    ? refined
    : Array.from({ length: sampleBudget }, (_, index) => refined[Math.round((index / (sampleBudget - 1)) * (refined.length - 1))]);

  let cumulativeDistance = 0;
  return {
    samples: bounded.map((point, index) => {
      if (index > 0) cumulativeDistance += Math.hypot(point.x - bounded[index - 1].x, point.z - bounded[index - 1].z);
      const tangent = tangentAt(bounded, index);
      return {
        ...point,
        distance: cumulativeDistance,
        tangent,
        normal: { x: -tangent.z, z: tangent.x },
        rawY: terrainSampler.sampleOutdoorY(point.x, point.z),
      };
    }),
    sharpTurnInsertions,
    terrainInsertions,
    sampleBudget,
    sampleBudgetAdapted,
  };
}

function crossSectionOffset(corridor, lateral) {
  const { crownHeight, shoulderWidth, shoulderDrop } = corridor.crossSection;
  const bedHalf = corridor.width * 0.5;
  const distance = Math.abs(lateral);
  if (distance <= bedHalf) {
    const normalized = bedHalf > 0 ? distance / bedHalf : 0;
    return crownHeight * (1 - normalized * normalized);
  }
  if (distance <= bedHalf + shoulderWidth) {
    const t = shoulderWidth > 0 ? (distance - bedHalf) / shoulderWidth : 1;
    return -shoulderDrop * t;
  }
  return -shoulderDrop;
}

function makeProfileLimits(samples, path, terrainSampler) {
  if (path.surfaceMode !== 'graded') return { limits: samples.map((sample) => ({ lower: sample.rawY, upper: sample.rawY })), infeasible: false };
  const shoulderEdge = path.width * 0.5 + path.crossSection.shoulderWidth;
  let infeasible = false;
  const limits = samples.map((sample) => {
    let lower = -Infinity;
    let upper = Infinity;
    path.lateralOffsets.filter((offset) => Math.abs(offset) <= shoulderEdge + 0.001).forEach((offset) => {
      const x = sample.x + sample.normal.x * offset;
      const z = sample.z + sample.normal.z * offset;
      const rawY = terrainSampler.sampleOutdoorY(x, z);
      const shapeOffset = crossSectionOffset(path, offset);
      lower = Math.max(lower, rawY - path.grade.maxCut - shapeOffset);
      upper = Math.min(upper, rawY + path.grade.maxFill - shapeOffset);
    });
    if (lower > upper) {
      infeasible = true;
      const middle = (lower + upper) * 0.5;
      lower = middle;
      upper = middle;
    }
    return { lower, upper };
  });
  return { limits, infeasible };
}

function makeSmoothedProfile(samples, path, profileLimits) {
  const { grade, surfaceMode } = path;
  const raw = samples.map((sample) => sample.rawY);
  if (surfaceMode === 'conform') return { profile: raw, requestedCutExceeded: false, requestedFillExceeded: false };
  if (surfaceMode === 'bridge') {
    const totalLength = samples.at(-1)?.distance ?? 0;
    return {
      profile: samples.map((sample) => lerp(raw[0], raw.at(-1), totalLength > 0 ? sample.distance / totalLength : 0)),
      requestedCutExceeded: false,
      requestedFillExceeded: false,
    };
  }
  const desired = samples.map((sample, index) => {
    if (index === 0 || index === samples.length - 1 || grade.smoothingDistance <= 0) return sample.rawY;
    let weightedHeight = 0;
    let totalWeight = 0;
    samples.forEach((other) => {
      const distance = Math.abs(other.distance - sample.distance);
      if (distance > grade.smoothingDistance) return;
      const weight = 1 - distance / grade.smoothingDistance;
      weightedHeight += other.rawY * weight;
      totalWeight += weight;
    });
    return totalWeight > 0 ? weightedHeight / totalWeight : sample.rawY;
  });
  const lower = profileLimits.map((limit) => limit.lower);
  const upper = profileLimits.map((limit) => limit.upper);
  const requestedCutExceeded = desired.some((height, index) => height < lower[index] - 0.001);
  const requestedFillExceeded = desired.some((height, index) => height > upper[index] + 0.001);
  const profile = desired.map((height, index) => clamp(height, lower[index], upper[index]));

  for (let pass = 0; pass < 32; pass += 1) {
    for (let index = 1; index < profile.length; index += 1) {
      const run = samples[index].distance - samples[index - 1].distance;
      const rise = grade.maxSlope * run;
      profile[index] = clamp(profile[index], Math.max(lower[index], profile[index - 1] - rise), Math.min(upper[index], profile[index - 1] + rise));
    }
    for (let index = profile.length - 2; index >= 0; index -= 1) {
      const run = samples[index + 1].distance - samples[index].distance;
      const rise = grade.maxSlope * run;
      profile[index] = clamp(profile[index], Math.max(lower[index], profile[index + 1] - rise), Math.min(upper[index], profile[index + 1] + rise));
    }
  }
  return { profile, requestedCutExceeded, requestedFillExceeded };
}

function maxCenterlineGrade(samples, heights) {
  let result = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const run = samples[index].distance - samples[index - 1].distance;
    result = Math.max(result, Math.abs(heights[index] - heights[index - 1]) / Math.max(run, 0.001));
  }
  return result;
}

function pathBoundsWarning(path, samples, bounds) {
  if (!bounds) return false;
  const outer = path.width * 0.5 + path.crossSection.shoulderWidth + path.crossSection.terrainBlendWidth;
  return samples.some((sample) => sample.x - outer < bounds.minX || sample.x + outer > bounds.maxX || sample.z - outer < bounds.minZ || sample.z + outer > bounds.maxZ);
}

function makeIssue(severity, code, message) {
  return Object.freeze({ severity, code, message });
}

function buildCorridor(path, terrainSampler, bounds) {
  const { samples, sharpTurnInsertions, terrainInsertions, sampleBudget, sampleBudgetAdapted } = resampleAuthoredPolyline(path, terrainSampler);
  const { limits: profileLimits, infeasible: crossSectionInfeasible } = makeProfileLimits(samples, path, terrainSampler);
  const { profile, requestedCutExceeded, requestedFillExceeded } = makeSmoothedProfile(samples, path, profileLimits);
  samples.forEach((sample, index) => { sample.profileY = profile[index]; });
  const warnings = [];
  const errors = [];
  const generatedGrade = maxCenterlineGrade(samples, profile);
  const gradeConstrained = generatedGrade > path.grade.maxSlope + 0.002;
  if (sampleBudgetAdapted) warnings.push(makeIssue('warning', 'sample-budget-adapted', `Sampling spacing was increased deterministically to keep the complete route within the ${sampleBudget}-sample geometry budget.`));
  if (samples.length > sampleBudget) errors.push(makeIssue('error', 'sample-budget', `Generated sample count exceeds the mobile-safe cap of ${sampleBudget} for this cross-section.`));
  if (gradeConstrained) warnings.push(makeIssue('warning', 'grade-limit', `Requested route cannot satisfy maxSlope ${path.grade.maxSlope.toFixed(3)} everywhere without exceeding cut/fill limits.`));
  if (requestedCutExceeded && (gradeConstrained || crossSectionInfeasible)) warnings.push(makeIssue('warning', 'cut-limit', `Cut limits prevent the requested smoothed cross-section from satisfying the authored grade.`));
  if (requestedFillExceeded && (gradeConstrained || crossSectionInfeasible)) warnings.push(makeIssue('warning', 'fill-limit', `Fill limits prevent the requested smoothed cross-section from satisfying the authored grade.`));
  if (path.surfaceMode === 'graded' && crossSectionInfeasible) warnings.push(makeIssue('warning', 'cross-section-cut-fill-conflict', 'Existing side slope cannot fit the requested cross-section within both cut and fill limits; author correction may be required.'));
  if (pathBoundsWarning(path, samples, bounds)) warnings.push(makeIssue('warning', 'terrain-bounds', 'Corridor blend footprint reaches outside the terrain bounds.'));
  const authoredTurns = path.points.map((_, index) => turnAngle(path.points, index));
  if (authoredTurns.some((angle) => angle > Math.PI * 0.72)) warnings.push(makeIssue('warning', 'sharp-turn', 'Authored turn is severe enough to risk cross-section overlap; add one route-shaping point.'));

  const elevations = samples.map((sample) => sample.profileY);
  return {
    ...path,
    samples,
    totalLength: samples.at(-1)?.distance ?? 0,
    footprintHalfWidth: path.width * 0.5 + path.crossSection.shoulderWidth + path.crossSection.terrainBlendWidth,
    rawTerrainSampler: terrainSampler,
    warnings,
    errors,
    summary: {
      id: path.id,
      surfaceMode: path.surfaceMode,
      authoredPointCount: path.points.length,
      generatedSampleCount: samples.length,
      sampleBudget,
      sampleBudgetAdapted,
      sharpTurnInsertions,
      terrainInsertions,
      generatedVertexCount: samples.length * path.crossSection.lateralSamples,
      generatedTriangleCount: Math.max(0, samples.length - 1) * Math.max(0, path.crossSection.lateralSamples - 1) * 2,
      totalLength: samples.at(-1)?.distance ?? 0,
      minElevation: Math.min(...elevations),
      maxElevation: Math.max(...elevations),
      maxGrade: generatedGrade,
      maxCrossSlope: 0,
      maxCut: Math.max(0, ...samples.map((sample) => sample.rawY - sample.profileY)),
      maxFill: Math.max(0, ...samples.map((sample) => sample.profileY - sample.rawY)),
      unsupportedSpanCount: 0,
      maxTerrainAgreementError: 0,
      maxTriangleEdge: 0,
      degenerateTriangleCount: 0,
      warnings,
      errors,
    },
  };
}

export function buildOutdoorPathCorridors(paths = [], { terrainSampler, terrainBounds = terrainSampler?.bounds } = {}) {
  if (typeof terrainSampler?.sampleOutdoorY !== 'function') return null;
  const corridors = paths.map(sanitizeOutdoorPathCorridor).filter(Boolean).map((path) => buildCorridor(path, terrainSampler, terrainBounds));
  if (!corridors.length) return null;
  const runtime = {
    kind: 'oarbPathCorridorRuntime',
    corridors,
    terrainBounds,
    rawTerrainSampler: terrainSampler,
    generatedSampleCount: corridors.reduce((sum, corridor) => sum + corridor.samples.length, 0),
    generatedVertexBudget: corridors.reduce((sum, corridor) => sum + corridor.summary.generatedVertexCount, 0),
    generatedTriangleBudget: corridors.reduce((sum, corridor) => sum + corridor.summary.generatedTriangleCount, 0),
  };
  runtime.spatialIndex = buildPathSegmentSpatialIndex(corridors);
  runtime.sampleCorridor = (x, z, modes) => sampleOutdoorPathCorridor(runtime, x, z, modes);
  runtime.deformTerrainY = (x, z, currentY) => deformOutdoorTerrainForPathCorridors(runtime, x, z, currentY);
  runtime.isPointInProtectedFootprint = (x, z) => isPointInOutdoorPathCorridorFootprint(runtime, x, z);
  return runtime;
}

function buildPathSegmentSpatialIndex(corridors, cellSize = 12) {
  const buckets = new Map();
  corridors.forEach((corridor) => {
    for (let index = 0; index < corridor.samples.length - 1; index += 1) {
      const from = corridor.samples[index];
      const to = corridor.samples[index + 1];
      const padding = corridor.footprintHalfWidth;
      const minCellX = Math.floor((Math.min(from.x, to.x) - padding) / cellSize);
      const maxCellX = Math.floor((Math.max(from.x, to.x) + padding) / cellSize);
      const minCellZ = Math.floor((Math.min(from.z, to.z) - padding) / cellSize);
      const maxCellZ = Math.floor((Math.max(from.z, to.z) + padding) / cellSize);
      for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
        for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
          const key = `${cellX},${cellZ}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push({ corridor, index, from, to });
        }
      }
    }
  });
  return Object.freeze({
    cellSize,
    buckets,
    get(x, z) {
      return buckets.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) ?? [];
    },
  });
}

function collectOutdoorPathCorridorSamples(runtime, x, z, modes = null) {
  if (!runtime?.corridors || !Number.isFinite(x) || !Number.isFinite(z)) return [];
  const matches = [];
  const bestByCorridor = new Map();
  const candidates = runtime.spatialIndex?.get?.(x, z) ?? runtime.corridors.flatMap((corridor) => corridor.samples.slice(0, -1).map((from, index) => ({ corridor, index, from, to: corridor.samples[index + 1] })));
  candidates.forEach(({ corridor, index, from, to }) => {
    if (modes && !modes.includes(corridor.surfaceMode)) return;
    let bestForCorridor = bestByCorridor.get(corridor) ?? null;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq <= 0.000001) return;
    const t = clamp(((x - from.x) * dx + (z - from.z) * dz) / lengthSq, 0, 1);
    const closestX = from.x + dx * t;
    const closestZ = from.z + dz * t;
    const tangent = normalize2(lerp(from.tangent.x, to.tangent.x, t), lerp(from.tangent.z, to.tangent.z, t));
    const normal = { x: -tangent.z, z: tangent.x };
    const offsetX = x - closestX;
    const offsetZ = z - closestZ;
    const distanceSq = offsetX * offsetX + offsetZ * offsetZ;
    if (distanceSq > corridor.footprintHalfWidth * corridor.footprintHalfWidth) return;
    if (!bestForCorridor || distanceSq < bestForCorridor.distanceSq) {
      bestForCorridor = {
        corridor,
        segmentIndex: index,
        t,
        closestX,
        closestZ,
        tangent,
        normal,
        lateral: offsetX * normal.x + offsetZ * normal.z,
        distanceSq,
        profileY: lerp(from.profileY, to.profileY, t),
        rawY: lerp(from.rawY, to.rawY, t),
        distance: lerp(from.distance, to.distance, t),
      };
    }
    if (bestForCorridor) bestByCorridor.set(corridor, bestForCorridor);
  });
  matches.push(...bestByCorridor.values());
  return matches.sort((a, b) => a.distanceSq - b.distanceSq || a.corridor.id.localeCompare(b.corridor.id));
}

export function sampleOutdoorPathCorridor(runtime, x, z, modes = null) {
  return collectOutdoorPathCorridorSamples(runtime, x, z, modes)[0] ?? null;
}

function crossSectionY(sample, currentTerrainY) {
  const { corridor, profileY } = sample;
  const { shoulderWidth, shoulderDrop, terrainBlendWidth } = corridor.crossSection;
  const bedHalf = corridor.width * 0.5;
  const distance = Math.abs(sample.lateral);
  if (distance <= bedHalf + shoulderWidth) return profileY + crossSectionOffset(corridor, sample.lateral);
  const blendT = terrainBlendWidth > 0 ? clamp((distance - bedHalf - shoulderWidth) / terrainBlendWidth, 0, 1) : 1;
  return lerp(profileY - shoulderDrop, currentTerrainY, blendT * blendT * (3 - 2 * blendT));
}

export function deformOutdoorTerrainForPathCorridors(runtime, x, z, currentY) {
  const samples = collectOutdoorPathCorridorSamples(runtime, x, z, ['graded']);
  if (!samples.length) return { y: currentY, corridor: null, changed: false };
  let weightedY = 0;
  let totalWeight = 0;
  samples.forEach((sample) => {
    const normalized = clamp(Math.abs(sample.lateral) / sample.corridor.footprintHalfWidth, 0, 1);
    const weight = Math.max(0.001, (1 - normalized) ** 2);
    const requestedY = crossSectionY(sample, currentY);
    const boundedY = clamp(requestedY, currentY - sample.corridor.grade.maxCut, currentY + sample.corridor.grade.maxFill);
    weightedY += boundedY * weight;
    totalWeight += weight;
  });
  const y = totalWeight > 0 ? weightedY / totalWeight : currentY;
  return { y: Number.isFinite(y) ? y : currentY, corridor: samples[0].corridor, sample: samples[0], contributors: samples.length, changed: Number.isFinite(y) && Math.abs(y - currentY) > 0.000001 };
}

export function isPointInOutdoorPathCorridorFootprint(runtime, x, z, modes = null) {
  return Boolean(sampleOutdoorPathCorridor(runtime, x, z, modes));
}

function updateRuntimeAudit(runtime) {
  runtime.audit = Object.freeze({
    pathCount: runtime.corridors.length,
    warningCount: runtime.corridors.reduce((sum, corridor) => sum + corridor.warnings.length, 0),
    errorCount: runtime.corridors.reduce((sum, corridor) => sum + corridor.errors.length, 0),
    summaries: runtime.corridors.map((corridor) => corridor.summary),
  });
}

export function auditOutdoorPathCorridors(runtime, finalTerrainSampler) {
  if (!runtime?.corridors || typeof finalTerrainSampler?.sampleOutdoorY !== 'function') return runtime;
  runtime.corridors.forEach((corridor) => {
    const centerHeights = [];
    let maxCrossSlope = 0;
    let maxCut = 0;
    let maxFill = 0;
    let unsupportedSpanCount = 0;
    corridor.samples.forEach((sample) => {
      const centerY = corridor.surfaceMode === 'bridge'
        ? sample.profileY + corridor.crossSection.crownHeight
        : finalTerrainSampler.sampleOutdoorY(sample.x, sample.z);
      centerHeights.push(centerY);
      const rawY = corridor.rawTerrainSampler.sampleOutdoorY(sample.x, sample.z);
      maxCut = Math.max(maxCut, rawY - centerY);
      maxFill = Math.max(maxFill, centerY - rawY);
      let sampleUnsupported = corridor.surfaceMode === 'graded' && centerY - rawY > corridor.grade.maxFill + 0.035;
      let previous = null;
      corridor.lateralOffsets.forEach((offset) => {
        const x = sample.x + sample.normal.x * offset;
        const z = sample.z + sample.normal.z * offset;
        const y = corridor.surfaceMode === 'bridge'
          ? crossSectionY({ corridor, profileY: sample.profileY, lateral: offset }, corridor.rawTerrainSampler.sampleOutdoorY(x, z))
          : finalTerrainSampler.sampleOutdoorY(x, z);
        const lateralRawY = corridor.rawTerrainSampler.sampleOutdoorY(x, z);
        maxCut = Math.max(maxCut, lateralRawY - y);
        maxFill = Math.max(maxFill, y - lateralRawY);
        if (corridor.surfaceMode === 'graded' && y - lateralRawY > corridor.grade.maxFill + 0.035) sampleUnsupported = true;
        const bedHalf = corridor.width * 0.5;
        if (previous && Math.abs(offset) <= bedHalf + 0.001 && Math.abs(previous.offset) <= bedHalf + 0.001) maxCrossSlope = Math.max(maxCrossSlope, Math.abs(y - previous.y) / Math.max(Math.abs(offset - previous.offset), 0.001));
        previous = { offset, y };
      });
      if (sampleUnsupported) unsupportedSpanCount += 1;
    });
    corridor.summary.maxGrade = maxCenterlineGrade(corridor.samples, centerHeights);
    corridor.summary.maxCrossSlope = maxCrossSlope;
    corridor.summary.maxCut = Math.max(0, maxCut);
    corridor.summary.maxFill = Math.max(0, maxFill);
    corridor.summary.unsupportedSpanCount = unsupportedSpanCount;
    corridor.summary.minElevation = Math.min(...centerHeights);
    corridor.summary.maxElevation = Math.max(...centerHeights);
    if (corridor.summary.maxGrade > corridor.grade.maxSlope + 0.035 && !corridor.warnings.some((issue) => issue.code === 'grade-limit')) corridor.warnings.push(makeIssue('warning', 'grade-limit', 'Final heightfield sampling exceeds the authored maximum grade tolerance.'));
    if (maxCrossSlope > corridor.grade.maxCrossSlope + 0.05) corridor.warnings.push(makeIssue('warning', 'cross-slope-limit', 'Final heightfield sampling exceeds the authored cross-slope tolerance.'));
    if (unsupportedSpanCount > 0 && !corridor.errors.some((issue) => issue.code === 'unsupported-span')) corridor.errors.push(makeIssue('error', 'unsupported-span', 'Final graded surface exceeds maxFill and would be unsupported.'));
  });
  updateRuntimeAudit(runtime);
  return runtime;
}

function assertCorridorGeometrySafe(geometry) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const normal = geometry.attributes.normal;
  if (!position || !uv || !normal || position.count === 0 || uv.count !== position.count || normal.count !== position.count) throw new Error('OARB path corridor generated invalid geometry attributes.');
  for (let index = 0; index < position.count; index += 1) {
    if (![position.getX(index), position.getY(index), position.getZ(index), uv.getX(index), uv.getY(index), normal.getX(index), normal.getY(index), normal.getZ(index)].every(Number.isFinite)) throw new Error(`OARB path corridor generated non-finite geometry at vertex ${index}.`);
    if (normal.getY(index) < -0.001) throw new Error(`OARB path corridor generated a downward-facing normal at vertex ${index}.`);
  }
}

function triangleMetrics(geometry) {
  const position = geometry.attributes.position;
  const index = geometry.index;
  let maxEdge = 0;
  let degenerate = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();
  for (let cursor = 0; cursor < index.count; cursor += 3) {
    a.fromBufferAttribute(position, index.getX(cursor));
    b.fromBufferAttribute(position, index.getX(cursor + 1));
    c.fromBufferAttribute(position, index.getX(cursor + 2));
    maxEdge = Math.max(maxEdge, a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    cross.crossVectors(ab, ac);
    if (cross.lengthSq() < 0.00000001) degenerate += 1;
  }
  return { maxEdge, degenerate };
}

function resolveMaterial(corridor, textures, makeMaterial) {
  const profile = textures[corridor.materialKey] ?? textures[FALLBACK_MATERIAL_KEY] ?? FALLBACK_MATERIAL_PROFILE;
  const usedFallback = !textures[corridor.materialKey];
  const material = typeof makeMaterial === 'function'
    ? makeMaterial({ ...FALLBACK_MATERIAL_PROFILE, ...profile, repeat: [1, 1] }, { materialKey: corridor.materialKey, profile, usedFallback })
    : new THREE.MeshStandardMaterial({ color: profile.color ?? FALLBACK_MATERIAL_PROFILE.color, roughness: profile.roughness ?? 1, metalness: profile.metalness ?? 0 });
  material.name = material.name || `OARB-path-corridor-material-${corridor.materialKey}`;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -0.15;
  material.polygonOffsetUnits = -0.15;
  return { material, profile, usedFallback };
}

export function createOutdoorPathCorridorMesh(corridor, { terrainSampler, textures = {}, makeMaterial, clearance = OARB_PATH_CORRIDOR_VISUAL_CLEARANCE } = {}) {
  if (!corridor?.samples?.length || typeof terrainSampler?.sampleOutdoorY !== 'function') return null;
  const lateralCount = corridor.lateralOffsets.length;
  const vertices = [];
  const uvs = [];
  const indices = [];
  const { material, profile, usedFallback } = resolveMaterial(corridor, textures, makeMaterial);
  const tileLength = finitePositive(profile.worldTileLength) ? profile.worldTileLength : 8;
  const tileWidth = finitePositive(profile.worldTileWidth) ? profile.worldTileWidth : Math.max(corridor.width, 1);
  let maxTerrainAgreementError = 0;

  corridor.samples.forEach((sample) => {
    corridor.lateralOffsets.forEach((offset, lateralIndex) => {
      const x = sample.x + sample.normal.x * offset;
      const z = sample.z + sample.normal.z * offset;
      const terrainY = terrainSampler.sampleOutdoorY(x, z);
      const surfaceY = corridor.surfaceMode === 'bridge'
        ? crossSectionY({ corridor, profileY: sample.profileY, lateral: offset }, corridor.rawTerrainSampler.sampleOutdoorY(x, z))
        : terrainY;
      const y = surfaceY + clearance;
      vertices.push(x, y, z);
      uvs.push(sample.distance / tileLength, (lateralIndex / (lateralCount - 1)) * (corridor.footprintHalfWidth * 2 / tileWidth));
      if (corridor.surfaceMode !== 'bridge') maxTerrainAgreementError = Math.max(maxTerrainAgreementError, Math.abs((y - clearance) - terrainY));
    });
  });

  const pushUpwardTriangle = (a, b, c) => {
    const ax = vertices[a * 3];
    const az = vertices[a * 3 + 2];
    const bx = vertices[b * 3];
    const bz = vertices[b * 3 + 2];
    const cx = vertices[c * 3];
    const cz = vertices[c * 3 + 2];
    const normalY = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (normalY >= 0) indices.push(a, b, c);
    else indices.push(a, c, b);
  };

  for (let row = 0; row < corridor.samples.length - 1; row += 1) {
    for (let column = 0; column < lateralCount - 1; column += 1) {
      const a = row * lateralCount + column;
      const b = (row + 1) * lateralCount + column;
      pushUpwardTriangle(a, b, a + 1);
      pushUpwardTriangle(a + 1, b, b + 1);
    }
  }
  if (vertices.length / 3 > OARB_PATH_CORRIDOR_MAX_VERTICES || indices.length / 3 > OARB_PATH_CORRIDOR_MAX_TRIANGLES) throw new Error(`OARB path corridor ${corridor.id} exceeds its mobile-safe geometry budget.`);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  assertCorridorGeometrySafe(geometry);
  const metrics = triangleMetrics(geometry);
  corridor.summary.generatedVertexCount = geometry.attributes.position.count;
  corridor.summary.generatedTriangleCount = geometry.index.count / 3;
  corridor.summary.maxTerrainAgreementError = maxTerrainAgreementError;
  corridor.summary.maxTriangleEdge = metrics.maxEdge;
  corridor.summary.degenerateTriangleCount = metrics.degenerate;
  if (metrics.degenerate > 0) corridor.errors.push(makeIssue('error', 'degenerate-triangle', `Generated ${metrics.degenerate} degenerate road triangles.`));
  if (metrics.maxEdge > Math.max(4, corridor.sampleSpacing * 5)) corridor.warnings.push(makeIssue('warning', 'long-triangle', `Road triangle edge ${metrics.maxEdge.toFixed(3)}m exceeds the expected dense-mesh limit.`));

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `OARB-path-corridor-${corridor.id}`;
  mesh.receiveShadow = true;
  mesh.userData = {
    kind: 'oarbPathCorridor',
    authoringRuntime: 'OARB',
    id: corridor.id,
    surfaceMode: corridor.surfaceMode,
    materialKey: corridor.materialKey,
    materialFallbackUsed: usedFallback,
    sampleSpacing: corridor.sampleSpacing,
    lateralSamples: corridor.crossSection.lateralSamples,
    visualClearance: clearance,
    surfaceTruth: corridor.surfaceMode === 'bridge' ? 'explicit constructed bridge profile' : 'final deformed outdoor terrain sampler',
    audit: corridor.summary,
  };
  return mesh;
}

export function createOutdoorPathCorridorMeshes(runtime, options = {}) {
  if (!runtime?.corridors) return [];
  const meshes = runtime.corridors.map((corridor) => createOutdoorPathCorridorMesh(corridor, options)).filter(Boolean);
  updateRuntimeAudit(runtime);
  return meshes;
}

export function createOutdoorPathCorridorSurfaceSampler(runtime, { terrainSampler } = {}) {
  if (!runtime?.corridors || typeof terrainSampler?.sampleOutdoorY !== 'function') return null;
  return {
    kind: 'oarbPathCorridorSurfaceSampler',
    sampleOutdoorY(x, z) {
      const sample = sampleOutdoorPathCorridor(runtime, x, z);
      if (!sample) return null;
      if (sample.corridor.surfaceMode === 'bridge') return crossSectionY(sample, sample.corridor.rawTerrainSampler.sampleOutdoorY(x, z));
      return terrainSampler.sampleOutdoorY(x, z);
    },
    sampleSurface(x, z) {
      const sample = sampleOutdoorPathCorridor(runtime, x, z);
      if (!sample) return null;
      const y = this.sampleOutdoorY(x, z);
      return { y, kind: 'pathCorridor', source: sample.corridor.surfaceMode === 'bridge' ? 'explicit-bridge-profile' : 'final-terrain-heightfield', corridorId: sample.corridor.id };
    },
    userData: { pathCount: runtime.corridors.length, surfaceTruth: 'graded/conform paths share the final terrain heightfield; bridge paths remain explicit constructed spans' },
  };
}

export function createOutdoorPathCorridorBridgeSurfaces(runtime, { priority = 18 } = {}) {
  if (!runtime?.corridors) return [];
  const surfaces = [];
  runtime.corridors.filter((corridor) => corridor.surfaceMode === 'bridge' && corridor.pathSupport).forEach((corridor) => {
    for (let index = 0; index < corridor.samples.length - 1; index += 1) {
      const from = corridor.samples[index];
      const to = corridor.samples[index + 1];
      surfaces.push({
        id: `${corridor.id}_bridge_support_${index}`,
        kind: 'ramp',
        from: [from.x, from.z],
        to: [to.x, to.z],
        width: corridor.width,
        y0: from.profileY + corridor.crossSection.crownHeight,
        y1: to.profileY + corridor.crossSection.crownHeight,
        priority,
        tags: ['oarb-explicit-bridge-surface', ...corridor.tags],
        userData: { sourceTrailId: corridor.id, surfaceMode: 'bridge', collisionTruth: 'Explicit authored constructed span; never inferred for a normal dirt road.' },
      });
    }
  });
  return surfaces;
}

function debugLine(points, colors, name) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.92 });
  const line = new THREE.Line(geometry, material);
  line.name = name;
  line.renderOrder = 1000;
  line.frustumCulled = false;
  return line;
}

export function createOutdoorPathCorridorDebugGroup(runtime, { terrainSampler, enabled = false, yOffset = 0.08 } = {}) {
  if (!enabled || !runtime?.corridors || typeof terrainSampler?.sampleOutdoorY !== 'function') return null;
  const group = new THREE.Group();
  group.name = 'DEV-OARB-path-corridor-grade-clearance-audit';
  runtime.corridors.forEach((corridor) => {
    const warning = corridor.warnings.length > 0 || corridor.errors.length > 0;
    const center = [];
    const colors = [];
    const left = [];
    const right = [];
    corridor.samples.forEach((sample) => {
      const y = terrainSampler.sampleOutdoorY(sample.x, sample.z) + yOffset;
      const intendedY = sample.profileY + corridor.crossSection.crownHeight;
      const difference = intendedY - (y - yOffset);
      const color = warning
        ? new THREE.Color(0xffd43b)
        : difference > 0.025
          ? new THREE.Color(0x328cff)
          : difference < -0.025
            ? new THREE.Color(0xf04444)
            : new THREE.Color(0x35e66f);
      center.push(sample.x, y, sample.z);
      colors.push(color.r, color.g, color.b);
      left.push(sample.x + sample.normal.x * corridor.footprintHalfWidth, terrainSampler.sampleOutdoorY(sample.x + sample.normal.x * corridor.footprintHalfWidth, sample.z + sample.normal.z * corridor.footprintHalfWidth) + yOffset * 0.65, sample.z + sample.normal.z * corridor.footprintHalfWidth);
      right.push(sample.x - sample.normal.x * corridor.footprintHalfWidth, terrainSampler.sampleOutdoorY(sample.x - sample.normal.x * corridor.footprintHalfWidth, sample.z - sample.normal.z * corridor.footprintHalfWidth) + yOffset * 0.65, sample.z - sample.normal.z * corridor.footprintHalfWidth);
    });
    group.add(debugLine(center, colors, `DEV-path-centerline-${corridor.id}`));
    const boundaryColor = new THREE.Color(0xbfc7d5);
    const boundaryColors = Array.from({ length: left.length / 3 }, () => [boundaryColor.r, boundaryColor.g, boundaryColor.b]).flat();
    group.add(debugLine(left, boundaryColors, `DEV-path-left-blend-boundary-${corridor.id}`));
    group.add(debugLine(right, boundaryColors, `DEV-path-right-blend-boundary-${corridor.id}`));
  });
  group.userData = {
    kind: 'oarbPathCorridorDebugOverlay',
    playerFacing: false,
    legend: { green: 'seated', red: 'buried/intersecting', blue: 'floating', yellow: 'grade/cut/fill/cross-slope warning' },
    views: ['centerline samples', 'corridor boundaries', 'shoulder/blend boundaries', 'generated terrain profile', 'unsupported span audit'],
  };
  return group;
}
