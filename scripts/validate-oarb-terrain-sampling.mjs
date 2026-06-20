import assert from 'node:assert/strict';
import { createOutdoorTerrainMesh, createOutdoorTerrainSampler } from '../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { createOutdoorSplineTrailMesh, createOutdoorSplineTrailMeshes } from '../src/engine/outdoor-authoring/OutdoorSplineBuilder.js';
import { createOutdoorCurvedBlockers } from '../src/engine/outdoor-authoring/OutdoorBlockerBuilder.js';
import { CollisionWorld } from '../src/game/Collision.js';
import { reliquaryFieldDefinition } from '../src/game/locations/reliquaryField.definition.js';

const terrain = reliquaryFieldDefinition.terrain;
const sampler = createOutdoorTerrainSampler(terrain);

assert.equal(typeof sampler.sampleOutdoorY, 'function', 'OARB terrain sampler exposes sampleOutdoorY(x, z).');

const points = [
  [0, 0],
  [terrain.size[0] / 2, terrain.size[1] / 2],
  [-terrain.size[0] / 2, -terrain.size[1] / 2],
  [terrain.size[0] * 2, terrain.size[1] * -2],
];

for (const [x, z] of points) {
  const y = sampler.sampleOutdoorY(x, z);
  assert.equal(Number.isFinite(y), true, `sampleOutdoorY(${x}, ${z}) returns a finite value.`);
  assert.equal(y, terrain.baseY, `flat Reliquary Field sampleOutdoorY(${x}, ${z}) returns baseY.`);
}

const stampedTerrain = {
  size: [240, 240],
  segments: [48, 48],
  baseY: 0,
  material: 'forestGround',
  heightStamps: [
    { kind: 'hill', center: [-80, -80], radius: 20, height: 4.5 },
    { kind: 'hollow', center: [80, -80], radius: 20, depth: 2.2 },
    { kind: 'ridge', path: [[-90, 40], [-40, 55], [5, 48]], width: 18, height: 5 },
    { kind: 'ravine', path: [[45, 35], [55, 70], [40, 95]], width: 10, depth: 3 },
    { kind: 'flatten', center: [0, 0], radius: 18, y: 0.2 },
  ],
};
const stampedSampler = createOutdoorTerrainSampler(stampedTerrain);
const stampedMesh = createOutdoorTerrainMesh(stampedTerrain);

assert.equal(stampedSampler.heightStampsApplied, stampedTerrain.heightStamps.length, 'sampler records all authored height stamps.');
assert.equal(stampedMesh.userData.heightStampsApplied, stampedTerrain.heightStamps.length, 'mesh records all authored height stamps.');
assert.ok(stampedSampler.sampleOutdoorY(-80, -80) > stampedTerrain.baseY + 4, 'hill raises sampled Y.');
assert.ok(stampedSampler.sampleOutdoorY(80, -80) < stampedTerrain.baseY - 2, 'hollow lowers sampled Y.');
assert.ok(stampedSampler.sampleOutdoorY(-40, 55) > stampedTerrain.baseY + 4.5, 'ridge raises sampled Y along its path.');
assert.ok(stampedSampler.sampleOutdoorY(55, 70) < stampedTerrain.baseY - 2.5, 'ravine lowers sampled Y along its path.');
assert.ok(Math.abs(stampedSampler.sampleOutdoorY(0, 0) - 0.2) < 0.001, 'flatten moves sampled Y toward the target value.');
assert.ok(Math.abs(stampedSampler.sampleOutdoorY(118, 118) - stampedTerrain.baseY) < 0.001, 'samples outside stamp influence remain near baseY.');

for (const y of stampedSampler.heightData) {
  assert.equal(Number.isFinite(y), true, 'stamped height data remains finite.');
}

const meshPosition = stampedMesh.geometry.attributes.position;
for (let index = 0; index < meshPosition.count; index += 1) {
  const meshWorldY = stampedMesh.position.y + meshPosition.getY(index);
  assert.equal(meshWorldY, stampedSampler.heightData[index], `mesh vertex ${index} uses sampler height data.`);
}
assert.equal(stampedMesh.userData.sampleOutdoorY(-80, -80), stampedMesh.userData.terrainSampler.sampleOutdoorY(-80, -80), 'mesh and its sampler expose the same sampled stamped height.');

const trail = {
  id: 'validation_hunter_path',
  points: [[-90, 40], [-40, 55], [5, 48], [55, 70]],
  width: 5,
  material: 'mudTrail',
  flatten: true,
};
const trailTextures = { mudTrail: reliquaryFieldDefinition.textures.mudTrail };
const trailMesh = createOutdoorSplineTrailMesh(trail, { terrainSampler: stampedSampler, textures: trailTextures });
assert.ok(trailMesh, 'a spline trail ribbon mesh is generated.');
assert.equal(trailMesh.userData.kind, 'oarbSplineTrail', 'trail records OARB spline metadata.');
assert.equal(trailMesh.userData.id, trail.id, 'trail records its stable id.');
assert.equal(trailMesh.userData.width, trail.width, 'trail records authored width.');
assert.equal(trailMesh.userData.materialKey, 'mudTrail', 'trail records resolved material key.');
assert.equal(trailMesh.userData.materialFallbackUsed, false, 'trail material/profile resolution uses the authored mudTrail profile.');
assert.equal(trailMesh.userData.flattenRequested, true, 'trail preserves flatten metadata without terrain deformation.');
assert.match(trailMesh.userData.collisionNote, /No collision/, 'trail records that no collision is generated yet.');
assert.equal(trailMesh.userData.sampledTerrainSource, stampedSampler.kind, 'trail records sampled terrain source.');
assert.equal(stampedSampler.heightStampsApplied, stampedTerrain.heightStamps.length, 'trail generation does not alter stamped terrain data.');
assert.equal(createOutdoorSplineTrailMeshes([trail], { terrainSampler: stampedSampler, textures: trailTextures }).length, 1, 'batch spline trail builder returns generated meshes.');

const trailPosition = trailMesh.geometry.attributes.position;
const trailUv = trailMesh.geometry.attributes.uv;
assert.equal(trailPosition.count, trail.points.length * 2, 'trail creates two ribbon edge vertices per authored point.');
for (let index = 0; index < trailPosition.count; index += 1) {
  assert.equal(Number.isFinite(trailPosition.getX(index)), true, `trail vertex ${index} x is finite.`);
  assert.equal(Number.isFinite(trailPosition.getY(index)), true, `trail vertex ${index} y is finite.`);
  assert.equal(Number.isFinite(trailPosition.getZ(index)), true, `trail vertex ${index} z is finite.`);
  assert.equal(Number.isFinite(trailUv.getX(index)), true, `trail uv ${index} u is finite.`);
  assert.equal(Number.isFinite(trailUv.getY(index)), true, `trail uv ${index} v is finite.`);
}
trail.points.forEach(([x, z], pointIndex) => {
  const leftY = trailPosition.getY(pointIndex * 2);
  const rightY = trailPosition.getY(pointIndex * 2 + 1);
  const sampledY = stampedSampler.sampleOutdoorY(x, z);
  assert.ok(Math.abs(leftY - sampledY - trailMesh.userData.yOffset) < 0.001, `trail point ${pointIndex} follows sampled terrain Y.`);
  assert.ok(Math.abs(rightY - leftY) < 0.001, `trail point ${pointIndex} ribbon edge heights match.`);
});
assert.equal(trailMesh.userData.collision, undefined, 'no collision object is generated from trails yet.');

const authoredCurvedBlockers = [
  { id: 'validation_circle_blocker', kind: 'circle', center: [10, 10], radius: 2, visibleStructureId: 'future_stone_cluster' },
  { id: 'validation_capsule_blocker', kind: 'capsule', from: [-10, 0], to: [10, 0], radius: 1.5, visibleStructureId: 'future_fallen_tree' },
  { id: 'validation_spline_blocker', kind: 'spline', points: [[0, 20], [10, 24], [20, 20]], thickness: 3, visibleStructureId: 'future_root_wall' },
  { id: 'validation_cliff_blocker', kind: 'cliff', points: [[-25, -20], [-15, -16], [-5, -20]], thickness: 4, visibleStructureId: 'future_cliff_wall' },
  { id: 'validation_hazard_metadata', kind: 'hazard', center: [30, -30], radius: 3, metadata: { intentionallyInvisible: true } },
];
const curvedBlockers = createOutdoorCurvedBlockers(authoredCurvedBlockers);
assert.equal(curvedBlockers.length, authoredCurvedBlockers.length, 'all authored curved blockers convert to runtime blockers.');
assert.equal(curvedBlockers[0].userData.source, 'OARB', 'blocker metadata preserves OARB source.');
assert.equal(curvedBlockers[0].userData.visibleStructureId, 'future_stone_cluster', 'blocker metadata preserves visibleStructureId.');
assert.deepEqual(curvedBlockers[2].userData.points, authoredCurvedBlockers[2].points, 'spline blocker metadata preserves authored points.');
assert.equal(curvedBlockers[4].type, 'hazard', 'hazard blockers preserve hazard type metadata without adding gameplay effects.');
assert.equal(curvedBlockers[4].userData.intentionallyInvisible, true, 'intentionally invisible metadata is preserved.');

const blockerCollision = new CollisionWorld({
  walkableRects: [{ minX: -100, maxX: 100, minZ: -100, maxZ: 100 }],
  blockerRects: curvedBlockers,
  playerRadius: 0.5,
});
assert.equal(blockerCollision.canStandAtFloorPosition({ x: 12.4, y: 0, z: 10 }), false, 'circle blocker respects player radius.');
assert.equal(blockerCollision.canStandAtFloorPosition({ x: 0, y: 0, z: 1.9 }), false, 'capsule blocker blocks along a segment with player radius.');
assert.equal(blockerCollision.canStandAtFloorPosition({ x: 10, y: 0, z: 25.9 }), false, 'spline blocker blocks near a thick polyline.');
assert.equal(blockerCollision.canStandAtFloorPosition({ x: -15, y: 0, z: -13.6 }), false, 'cliff blocker behaves as a thick polyline blocker.');
assert.equal(blockerCollision.canStandAtFloorPosition({ x: 70, y: 0, z: 70 }), true, 'far-away points are not blocked by curved blockers.');
assert.equal(blockerCollision.canStandAtFloorPosition({ x: 12.6, y: 0, z: 10 }), true, 'points outside blocker radius plus player radius remain walkable.');

const indoorBlockerRegression = new CollisionWorld({
  walkableRects: [{ minX: -10, maxX: 10, minZ: -10, maxZ: 10 }],
  blockerRects: [{ id: 'indoor_rect', minX: -1, maxX: 1, minZ: -1, maxZ: 1 }],
  defaultFloorY: 3,
});
assert.equal(indoorBlockerRegression.canStandAtFloorPosition({ x: 0, y: 3, z: 0 }), false, 'indoor rectangular blockers continue to block.');
assert.equal(indoorBlockerRegression.canStandAtFloorPosition({ x: 5, y: 3, z: 5 }), true, 'indoor collision remains unaffected away from existing blockers.');

const outdoorCollision = new CollisionWorld({
  walkableRects: [{ minX: -200, maxX: 200, minZ: -200, maxZ: 200 }],
  outdoorTerrainSampler: sampler,
});
assert.equal(outdoorCollision.sampleWalkableY(12, -34, 99).y, terrain.baseY, 'outdoor collision samples OARB terrain height.');
assert.equal(outdoorCollision.sampleWalkableY(12, -34, 99).kind, 'oarbTerrain', 'outdoor collision marks terrain samples.');

const stampedCollision = new CollisionWorld({
  walkableRects: [{ minX: -120, maxX: 120, minZ: -120, maxZ: 120 }],
  outdoorTerrainSampler: stampedSampler,
});
assert.equal(stampedCollision.sampleWalkableY(-80, -80, 99).y, stampedSampler.sampleOutdoorY(-80, -80), 'outdoor collision grounding follows stamped terrain heights.');

const indoorCollision = new CollisionWorld({
  walkableRects: [{ minX: -10, maxX: 10, minZ: -10, maxZ: 10 }],
  defaultFloorY: 7,
});
assert.equal(indoorCollision.sampleWalkableY(0, 0, 7).y, 7, 'indoor collision remains on its existing floor path.');
assert.equal(indoorCollision.sampleWalkableY(0, 0, 7).kind, 'fallback', 'indoor collision does not gain OARB grounding.');

console.log('OARB terrain sampling validation passed.');
