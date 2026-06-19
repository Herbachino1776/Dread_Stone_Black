import assert from 'node:assert/strict';
import { createOutdoorTerrainMesh, createOutdoorTerrainSampler } from '../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';
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
