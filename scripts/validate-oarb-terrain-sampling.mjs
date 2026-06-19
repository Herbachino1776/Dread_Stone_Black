import assert from 'node:assert/strict';
import { createOutdoorTerrainSampler } from '../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';
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

const outdoorCollision = new CollisionWorld({
  walkableRects: [{ minX: -200, maxX: 200, minZ: -200, maxZ: 200 }],
  outdoorTerrainSampler: sampler,
});
assert.equal(outdoorCollision.sampleWalkableY(12, -34, 99).y, terrain.baseY, 'outdoor collision samples OARB terrain height.');
assert.equal(outdoorCollision.sampleWalkableY(12, -34, 99).kind, 'oarbTerrain', 'outdoor collision marks terrain samples.');

const indoorCollision = new CollisionWorld({
  walkableRects: [{ minX: -10, maxX: 10, minZ: -10, maxZ: 10 }],
  defaultFloorY: 7,
});
assert.equal(indoorCollision.sampleWalkableY(0, 0, 7).y, 7, 'indoor collision remains on its existing floor path.');
assert.equal(indoorCollision.sampleWalkableY(0, 0, 7).kind, 'fallback', 'indoor collision does not gain OARB grounding.');

console.log('OARB terrain sampling validation passed.');
