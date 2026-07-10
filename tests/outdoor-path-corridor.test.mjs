import assert from 'node:assert/strict';
import { createOutdoorTerrainSampler } from '../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { createOutdoorPathCorridorBridgeSurfaces, createOutdoorPathCorridorMesh } from '../src/engine/outdoor-authoring/OutdoorPathCorridorBuilder.js';
import { folsomDefinition } from '../src/game/locations/folsom.definition.js';

const DEFAULT_GRADE = Object.freeze({ smoothingDistance: 5, maxSlope: 0.12, maxCrossSlope: 0.16, maxCut: 0.5, maxFill: 0.4 });
const DEFAULT_CROSS_SECTION = Object.freeze({ crownHeight: 0.035, shoulderWidth: 0.9, shoulderDrop: 0.06, terrainBlendWidth: 1.4, lateralSamples: 7 });

function makeTerrain(heightStamps = [], overrides = {}) {
  return { size: [80, 80], segments: [80, 80], baseY: 0, material: 'testGround', heightStamps, ...overrides };
}

function makePath(overrides = {}) {
  return {
    id: 'test_path',
    points: [[-24, 0], [24, 0]],
    width: 4.8,
    material: 'testRoad',
    surfaceMode: 'graded',
    sampleSpacing: 0.65,
    grade: { ...DEFAULT_GRADE },
    crossSection: { ...DEFAULT_CROSS_SECTION },
    edgeMeshes: false,
    pathSupport: false,
    ...overrides,
  };
}

function build(terrain, paths) {
  const pathList = Array.isArray(paths) ? paths : [paths];
  const sampler = createOutdoorTerrainSampler(terrain, { pathCorridors: pathList });
  assert.ok(sampler.pathCorridorRuntime, 'Explicit paths compile into a path corridor runtime.');
  return { sampler, runtime: sampler.pathCorridorRuntime, corridor: sampler.pathCorridorRuntime.corridors[0] };
}

function assertFiniteGeometry(mesh) {
  const position = mesh.geometry.attributes.position;
  const normal = mesh.geometry.attributes.normal;
  const uv = mesh.geometry.attributes.uv;
  assert.equal(position.count, normal.count, 'Normal count matches position count.');
  assert.equal(position.count, uv.count, 'UV count matches position count.');
  for (let index = 0; index < position.count; index += 1) {
    assert.ok([position.getX(index), position.getY(index), position.getZ(index), normal.getX(index), normal.getY(index), normal.getZ(index), uv.getX(index), uv.getY(index)].every(Number.isFinite), `Geometry vertex ${index} is finite.`);
    assert.ok(normal.getY(index) >= -0.001, `Geometry vertex ${index} has an upward-facing normal.`);
  }
}

// 1. Flat terrain path.
{
  const path = makePath();
  const { sampler, corridor } = build(makeTerrain(), path);
  const mesh = createOutdoorPathCorridorMesh(corridor, { terrainSampler: sampler });
  assertFiniteGeometry(mesh);
  assert.equal(corridor.errors.length, 0, 'Flat path has no corridor errors.');
  assert.ok(corridor.summary.maxGrade <= path.grade.maxSlope + 0.001, 'Flat path stays under maximum grade.');
  assert.ok(corridor.summary.maxCrossSlope <= path.grade.maxCrossSlope + 0.001, 'Flat road bed stays under maximum cross-slope.');

  const conform = build(makeTerrain(), makePath({ id: 'conform_contract', surfaceMode: 'conform' }));
  assert.equal(conform.sampler.sampleOutdoorY(0, 0), 0, 'Explicit conform mode leaves flat terrain undeformed.');
  const bridgeTerrain = makeTerrain([{ id: 'bridge_gully', kind: 'ravine', path: [[0, -18], [0, 18]], width: 5, depth: 1.2 }]);
  const bridge = build(bridgeTerrain, makePath({ id: 'bridge_contract', surfaceMode: 'bridge', pathSupport: true }));
  const bridgeSupports = createOutdoorPathCorridorBridgeSurfaces(bridge.runtime);
  assert.equal(bridgeSupports.length, bridge.corridor.samples.length - 1, 'Explicit bridge mode creates dense constructed support segments only when requested.');
  assert.ok(bridge.corridor.samples[Math.floor(bridge.corridor.samples.length / 2)].profileY > bridge.corridor.samples[Math.floor(bridge.corridor.samples.length / 2)].rawY + 0.5, 'Explicit bridge profile spans the gully instead of being inferred for a normal road.');
}

// 2. Shallow rolling terrain.
{
  const terrain = makeTerrain([
    { id: 'roll_a', kind: 'hill', center: [-12, 0], radius: 18, height: 0.42 },
    { id: 'roll_b', kind: 'hollow', center: [12, 0], radius: 18, depth: 0.32 },
  ]);
  const { corridor } = build(terrain, makePath());
  assert.equal(corridor.errors.length, 0, 'Rolling-terrain path remains supported.');
  assert.ok(corridor.summary.maxGrade <= corridor.grade.maxSlope + 0.01, 'Rolling-terrain grade is bounded.');
}

// 3. Shallow gully within fill tolerance.
{
  const terrain = makeTerrain([{ id: 'shallow_gully', kind: 'ravine', path: [[0, -18], [0, 18]], width: 7, depth: 0.24 }]);
  const { corridor } = build(terrain, makePath());
  assert.equal(corridor.summary.unsupportedSpanCount, 0, 'Shallow gully is graded without an unsupported span.');
  assert.ok(corridor.summary.maxFill <= corridor.grade.maxFill + 0.035, 'Shallow gully fill stays within tolerance.');
}

// 4. Gully exceeding fill tolerance.
{
  const path = makePath({ grade: { ...DEFAULT_GRADE, maxFill: 0.22, maxCut: 0.35 } });
  const terrain = makeTerrain([{ id: 'deep_gully', kind: 'ravine', path: [[0, -18], [0, 18]], width: 5, depth: 1.4 }]);
  const { corridor } = build(terrain, path);
  assert.ok(corridor.warnings.some((issue) => ['fill-limit', 'grade-limit', 'cross-section-cut-fill-conflict'].includes(issue.code)), 'Deep gully emits a clear grading-limit warning.');
  assert.ok(corridor.summary.maxFill <= path.grade.maxFill + 0.04, 'Deep gully profile is pulled back instead of silently bridging.');
}

// 5. Path across a side slope.
{
  const terrain = makeTerrain([{ id: 'side_slope', kind: 'ridge', path: [[-32, 10], [32, 10]], width: 22, height: 1.2 }]);
  const { corridor } = build(terrain, makePath({ grade: { ...DEFAULT_GRADE, maxCut: 0.7, maxFill: 0.7 } }));
  assert.ok(corridor.summary.maxCrossSlope <= corridor.grade.maxCrossSlope + 0.02, 'Road bed controls cross-slope on a side hill.');
  assert.equal(corridor.summary.unsupportedSpanCount, 0, 'Side-slope route remains terrain-supported.');
}

// 6. Sharp authored turn.
{
  const path = makePath({ points: [[-22, -12], [0, -12], [0, 18]] });
  const { sampler, corridor } = build(makeTerrain(), path);
  const mesh = createOutdoorPathCorridorMesh(corridor, { terrainSampler: sampler });
  assert.equal(corridor.summary.degenerateTriangleCount, 0, 'Sharp turn creates no degenerate triangles.');
  assert.ok(corridor.summary.maxTriangleEdge < 4, 'Sharp turn remains densely triangulated.');
  assert.ok(corridor.summary.sharpTurnInsertions > 0, 'Sharp turn receives additional samples.');
  assertFiniteGeometry(mesh);
}

// 7. Path joining a building pad.
{
  const terrain = makeTerrain([
    { id: 'approach_hill', kind: 'hill', center: [20, 0], radius: 18, height: 0.7 },
    { id: 'building_pad', kind: 'flatten', center: [24, 0], radius: 7, y: 0.38, tags: ['building-pad'] },
  ]);
  const { sampler, corridor } = build(terrain, makePath());
  assert.ok(Math.abs(sampler.sampleOutdoorY(24, 0) - 0.38) < 0.2, 'Building approach joins its destination pad without a vertical kink.');
  assert.equal(corridor.errors.length, 0, 'Building-pad approach has no corridor errors.');
}

// 8. Path joining a courtyard shelf.
{
  const terrain = makeTerrain([
    { id: 'courtyard_shelf', kind: 'flatten', center: [-24, 0], radius: 9, y: 0.22, tags: ['courtyard-shelf'] },
    { id: 'outside_roll', kind: 'hill', center: [4, 0], radius: 16, height: 0.35 },
  ]);
  const { sampler, corridor } = build(terrain, makePath());
  assert.ok(Math.abs(sampler.sampleOutdoorY(-24, 0) - 0.22) < 0.16, 'Courtyard endpoint blends into the authored shelf.');
  assert.equal(corridor.errors.length, 0, 'Courtyard approach has no corridor errors.');
}

// 9. Path near a terrain boundary.
{
  const { corridor } = build(makeTerrain(), makePath({ points: [[-39, -28], [-39, 28]] }));
  assert.ok(corridor.warnings.some((issue) => issue.code === 'terrain-bounds'), 'Boundary footprint emits a deterministic terrain-bounds warning.');
}

// 10. Deterministic repeated generation.
{
  const terrain = makeTerrain([{ id: 'deterministic_roll', kind: 'hill', center: [0, 0], radius: 16, height: 0.5 }]);
  const path = makePath({ points: [[-24, -5], [0, 4], [24, -2]] });
  const first = build(terrain, path);
  const second = build(terrain, path);
  assert.deepEqual([...first.sampler.heightData], [...second.sampler.heightData], 'Repeated generation produces identical final terrain heights.');
  assert.deepEqual(first.corridor.samples.map(({ x, z, profileY }) => [x, z, profileY]), second.corridor.samples.map(({ x, z, profileY }) => [x, z, profileY]), 'Repeated generation produces identical corridor samples and profiles.');
}

// 11. Terrain sampler and road mesh agreement.
{
  const terrain = makeTerrain([{ id: 'agreement_roll', kind: 'hollow', center: [0, 0], radius: 18, depth: 0.35 }]);
  const { sampler, corridor } = build(terrain, makePath());
  const mesh = createOutdoorPathCorridorMesh(corridor, { terrainSampler: sampler });
  const position = mesh.geometry.attributes.position;
  const clearance = mesh.userData.visualClearance;
  let maximumError = 0;
  for (let index = 0; index < position.count; index += 1) maximumError = Math.max(maximumError, Math.abs((position.getY(index) - clearance) - sampler.sampleOutdoorY(position.getX(index), position.getZ(index))));
  assert.ok(maximumError < 0.00001, `Road mesh agrees with final terrain sampler (max error ${maximumError}).`);
  assert.ok(corridor.summary.maxTerrainAgreementError < 0.00001, 'Corridor audit records terrain agreement within tolerance.');
}

// 12. Folsom regression and the sparse two-edge ribbon failure case.
{
  const { sampler, runtime } = build(folsomDefinition.terrain, folsomDefinition.splineTrails);
  assert.equal(runtime.corridors.length, 7, 'All seven Folsom dirt routes compile as path corridors.');
  runtime.corridors.forEach((corridor) => {
    const authored = folsomDefinition.splineTrails.find((path) => path.id === corridor.id);
    assert.equal(corridor.surfaceMode, 'graded', `${corridor.id} uses explicit graded mode.`);
    assert.equal(corridor.pathSupport, false, `${corridor.id} does not use a hidden support ramp.`);
    assert.ok(corridor.samples.length > authored.points.length * 10, `${corridor.id} is densely resampled instead of connecting sparse authored points.`);
    assert.equal(corridor.lateralOffsets.length, 7, `${corridor.id} uses a seven-sample cross-section instead of a two-edge ribbon.`);
    const mesh = createOutdoorPathCorridorMesh(corridor, { terrainSampler: sampler });
    assert.equal(corridor.summary.degenerateTriangleCount, 0, `${corridor.id} has no degenerate triangles.`);
    assert.ok(corridor.summary.maxTriangleEdge < 4, `${corridor.id} has no long paper-bridge triangles.`);
    assert.equal(corridor.summary.unsupportedSpanCount, 0, `${corridor.id} has no unsupported graded span.`);
    assert.equal(corridor.errors.length, 0, `${corridor.id} has no audit errors.`);
    assertFiniteGeometry(mesh);
  });
}

console.log('Outdoor path corridor tests passed: 12 terrain, grading, geometry, determinism, sampler-agreement, and Folsom regression cases.');
