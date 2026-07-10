import assert from 'node:assert/strict';
import { createOutdoorTerrainComposition } from '../src/engine/outdoor-authoring/OutdoorTerrainCompositionBuilder.js';

const terrain = {
  size: [80, 120], segments: [24, 36], baseY: 0, material: 'ground',
  composition: { chunked: true, columns: 2, rows: 3 },
  heightStamps: [
    { id: 'ridge_across_chunks', kind: 'ridge', path: [[-40, -10], [40, 18]], width: 22, height: 3, tags: ['large-landform'] },
    { id: 'micro_off_road', kind: 'hill', center: [30, 40], radius: 8, height: 0.35, tags: ['micro-bump'] },
  ],
};
const road = {
  id: 'chunk_crossing_road', points: [[0, -56], [0, 56]], width: 6, material: 'road', surfaceMode: 'graded', sampleSpacing: 0.8,
  grade: { smoothingDistance: 5, maxSlope: 0.15, maxCrossSlope: 0.18, maxCut: 0.8, maxFill: 0.7 },
  crossSection: { crownHeight: 0.03, shoulderWidth: 0.8, shoulderDrop: 0.05, terrainBlendWidth: 1.3, lateralSamples: 7 }, pathSupport: false,
};
const waterway = {
  id: 'chunk_crossing_creek', displayName: 'Chunk Creek', kind: 'creek', points: [[20, -56], [20, 56]], sampleSpacing: 0.8,
  flow: { sourceY: 2, outletY: -1, minimumSlope: 0.002, maximumSlope: 0.08 },
  channel: { width: [3, 4], depth: [0.45, 0.7], bedWidthRatio: 0.5, lateralSamples: 9 },
  banks: { submergedShelfWidth: 0.4, innerWetBankWidth: 0.6, outerWetBankWidth: 0.8, dryTransitionWidth: 1.6 },
  materials: { bed: 'ground', submergedShelf: 'ground', wetBank: 'ground', dryBank: 'ground' }, water: { material: 'water', opacity: 0.6 },
  fishing: { enabled: false, zones: [] }, crossings: [], tags: ['test-boundary-outlet'],
};
const options = { textures: { ground: { color: 0x777777, repeat: [8, 12] }, road: { color: 0x665544 }, water: { color: 0x556677 } }, pathCorridors: [road], waterways: [waterway] };
const composition = createOutdoorTerrainComposition(terrain, options);
assert.equal(composition.chunks.length, 6, 'Composition creates the authored 2x3 mobile chunk grid.');
assert.equal(composition.terrainSampler.pathCorridorRuntime.corridors.length, 1, 'Road compiles against the shared global sampler.');
assert.equal(composition.terrainSampler.waterwayRuntime.waterways.length, 1, 'Water corridor compiles against the same shared global sampler.');
assert.ok(composition.chunks.every((chunk) => chunk.geometry.attributes.position.count < 6500), 'Every chunk stays under its vertex budget.');

function edgeSamples(chunk, axis, coordinate) {
  const position = chunk.geometry.attributes.position;
  const values = [];
  for (let index = 0; index < position.count; index += 1) {
    const value = axis === 'x' ? position.getX(index) : position.getZ(index);
    if (Math.abs(value - coordinate) < 1e-6) values.push([position.getX(index), position.getY(index), position.getZ(index)]);
  }
  return values.sort((a, b) => axis === 'x' ? a[2] - b[2] : a[0] - b[0]);
}
const left = edgeSamples(composition.chunks[0], 'x', 0);
const right = edgeSamples(composition.chunks[1], 'x', 0);
assert.deepEqual(left, right, 'Adjacent chunk vertices agree exactly on their shared X edge.');
const south = edgeSamples(composition.chunks[0], 'z', -20);
const north = edgeSamples(composition.chunks[2], 'z', -20);
assert.deepEqual(south, north, 'Adjacent chunk vertices agree exactly on their shared Z edge.');
assert.equal(composition.terrainSampler.sampleOutdoorY(0, -20), south.find(([x]) => Math.abs(x) < 1e-6)?.[1], 'Collision sampler agrees with a shared rendered seam vertex.');
const southEast = edgeSamples(composition.chunks[1], 'z', -20);
const northEast = edgeSamples(composition.chunks[3], 'z', -20);
assert.deepEqual(southEast, northEast, 'Waterway-side chunks agree exactly on their shared Z edge.');
assert.equal(composition.terrainSampler.sampleOutdoorY(20, -20), southEast.find(([x]) => Math.abs(x - 20) < 1e-6)?.[1], 'Waterway deformation crosses the chunk boundary without a separate surface truth.');
const groundedMarker = { x: 20, z: 12, y: composition.terrainSampler.sampleOutdoorY(20, 12) };
assert.equal(groundedMarker.y, composition.terrainSampler.sampleOutdoorY(groundedMarker.x, groundedMarker.z), 'Objects ground after water and road deformation, not against the broad pre-deformation terrain.');

const second = createOutdoorTerrainComposition(terrain, options);
assert.deepEqual([...composition.terrainSampler.heightData], [...second.terrainSampler.heightData], 'Chunked terrain generation is deterministic.');
console.log('Outdoor terrain composition tests passed: chunk grid, exact X/Z seams, road/water crossings, final grounding, sampler agreement, budget, and determinism.');
