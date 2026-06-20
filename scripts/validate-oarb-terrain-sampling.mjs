import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createOutdoorTerrainMesh, createOutdoorTerrainSampler } from '../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { createOutdoorSplineTrailMesh, createOutdoorSplineTrailMeshes } from '../src/engine/outdoor-authoring/OutdoorSplineBuilder.js';
import { createOutdoorCurvedBlockers } from '../src/engine/outdoor-authoring/OutdoorBlockerBuilder.js';
import { createOutdoorPrimitiveMeshes } from '../src/engine/outdoor-authoring/OutdoorPrimitiveBuilder.js';
import { CollisionWorld } from '../src/game/Collision.js';
import { reliquaryFieldDefinition } from '../src/game/locations/reliquaryField.definition.js';
import { oarbFeatureYardDefinition } from '../src/game/locations/oarbFeatureYard.definition.js';
import { oarbOutdoorExpoDefinition } from '../src/game/locations/oarbOutdoorExpo.definition.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function assertTexturePathsExist(definition) {
  for (const [key, profile] of Object.entries(definition.textures ?? {})) {
    if (typeof profile?.path !== 'string') continue;
    const publicPath = profile.path.replace(/^\.\//, 'public/');
    assert.equal(existsSync(resolve(repoRoot, publicPath)), true, `${definition.id} texture profile ${key} path exists: ${profile.path}`);
  }
}

assertTexturePathsExist(reliquaryFieldDefinition);
assertTexturePathsExist(oarbFeatureYardDefinition);
assertTexturePathsExist(oarbOutdoorExpoDefinition);

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

const trailNormal = trailMesh.geometry.attributes.normal;
for (let index = 0; index < trailNormal.count; index += 1) {
  assert.equal(Number.isFinite(trailNormal.getX(index)), true, `trail normal ${index} x is finite.`);
  assert.equal(Number.isFinite(trailNormal.getY(index)), true, `trail normal ${index} y is finite.`);
  assert.equal(Number.isFinite(trailNormal.getZ(index)), true, `trail normal ${index} z is finite.`);
  assert.ok(trailNormal.getY(index) >= -0.001, `trail normal ${index} does not face downward.`);
}
const trailIndex = trailMesh.geometry.index;
assert.ok(trailIndex, 'trail geometry has indexed triangles.');
for (let triangle = 0; triangle < trailIndex.count; triangle += 3) {
  const a = trailIndex.getX(triangle);
  const b = trailIndex.getX(triangle + 1);
  const c = trailIndex.getX(triangle + 2);
  const ab = {
    x: trailPosition.getX(b) - trailPosition.getX(a),
    y: trailPosition.getY(b) - trailPosition.getY(a),
    z: trailPosition.getZ(b) - trailPosition.getZ(a),
  };
  const ac = {
    x: trailPosition.getX(c) - trailPosition.getX(a),
    y: trailPosition.getY(c) - trailPosition.getY(a),
    z: trailPosition.getZ(c) - trailPosition.getZ(a),
  };
  const faceNormalY = (ab.z * ac.x) - (ab.x * ac.z);
  assert.ok(faceNormalY >= -0.001, `trail triangle ${triangle / 3} is wound for top-side visibility.`);
}

trail.points.forEach(([x, z], pointIndex) => {
  const leftY = trailPosition.getY(pointIndex * 2);
  const rightY = trailPosition.getY(pointIndex * 2 + 1);
  const sampledY = stampedSampler.sampleOutdoorY(x, z);
  assert.ok(Math.abs(leftY - sampledY - trailMesh.userData.yOffset) < 0.001, `trail point ${pointIndex} follows sampled terrain Y.`);
  assert.ok(Math.abs(rightY - leftY) < 0.001, `trail point ${pointIndex} ribbon edge heights match.`);
});
assert.equal(trailMesh.userData.collision, undefined, 'no collision object is generated from trails yet.');


const oarbTerrainMesh = createOutdoorTerrainMesh(oarbFeatureYardDefinition.terrain, { textures: oarbFeatureYardDefinition.textures });
assert.equal(oarbTerrainMesh.userData.materialFallbackUsed, false, 'OARB Feature Yard terrain resolves its authored material profile.');
assert.equal(oarbTerrainMesh.userData.materialKey, 'forestGround', 'OARB Feature Yard terrain uses the authored forestGround material key.');
assert.equal(oarbFeatureYardDefinition.textures.forestGround.path, './assets/textures/outdoor/field_grass_matted_01.png', 'OARB Feature Yard terrain uses field_grass_matted_01.png.');
const oarbSampler = createOutdoorTerrainSampler(oarbFeatureYardDefinition.terrain);
const oarbTrailDefinition = oarbFeatureYardDefinition.splineTrails.find((candidate) => candidate.id === 'oarb_yard_test_trail');
assert.ok(oarbTrailDefinition, 'OARB Feature Yard keeps the authored oarb_yard_test_trail spline trail.');
const oarbTrailMesh = createOutdoorSplineTrailMesh(oarbTrailDefinition, { terrainSampler: oarbSampler, textures: oarbFeatureYardDefinition.textures });
assert.ok(oarbTrailMesh, 'OARB Feature Yard test trail generates a visible mesh.');
assert.equal(oarbTrailMesh.name, 'OARB-spline-trail-oarb_yard_test_trail', 'validation targets the disappearing OARB test trail mesh.');
assert.equal(oarbTrailMesh.userData.materialFallbackUsed, false, 'OARB Feature Yard trail resolves its authored material profile.');
assert.equal(oarbTrailMesh.userData.materialKey, 'mudTrail', 'OARB Feature Yard trail uses the authored mudTrail material key.');
assert.equal(oarbFeatureYardDefinition.textures.mudTrail.path, './assets/textures/outdoor/mud_wet_dark_01.png', 'OARB Feature Yard trail uses mud_wet_dark_01.png.');
const oarbTrailNormals = oarbTrailMesh.geometry.attributes.normal;
for (let index = 0; index < oarbTrailNormals.count; index += 1) {
  assert.ok(oarbTrailNormals.getY(index) >= -0.001, `OARB test trail normal ${index} is not downward-facing.`);
}

const oarbPond = oarbFeatureYardDefinition.waterBodies.find((candidate) => candidate.id === 'oarb_training_pond');
assert.ok(oarbPond, 'OARB Feature Yard keeps the authored training pond water body.');
const [pondX, pondZ] = oarbPond.center;
const [pondRadiusX, pondRadiusZ] = oarbPond.radius;
assert.ok([pondX, pondZ, pondRadiusX, pondRadiusZ, oarbPond.y].every(Number.isFinite), 'OARB pond center/radius/y are finite.');
assert.ok(pondX - pondRadiusX > -95 && pondX + pondRadiusX < 95 && pondZ - pondRadiusZ > -95 && pondZ + pondRadiusZ < 95, 'OARB pond stays inside Feature Yard bounds.');
assert.equal(oarbPond.material, 'pondWater', 'OARB pond resolves the authored pond water material.');
assert.equal(oarbPond.shoreMaterial, 'mudShore', 'OARB pond resolves the authored muddy shore material.');
assert.ok(oarbPond.fishable && oarbPond.fishableRadius > Math.max(pondRadiusX, pondRadiusZ), 'OARB pond exposes a shore-reachable fishable zone.');
const pondStampIds = new Set(oarbFeatureYardDefinition.terrain.heightStamps.map((stamp) => stamp.id));
['oarb_yard_training_pond_shore_shelf', 'oarb_yard_training_pond_bowl', 'oarb_yard_training_pond_floor_flatten'].forEach((stampId) => {
  assert.equal(pondStampIds.has(stampId), true, `OARB pond is supported by terrain stamp ${stampId}.`);
});
const pondFloorY = oarbSampler.sampleOutdoorY(pondX, pondZ);
assert.ok(pondFloorY < oarbPond.y, 'OARB pond water surface is above the carved pond floor.');
assert.ok(oarbPond.y - pondFloorY <= 0.35, 'OARB pond water surface is close enough to the flattened floor to avoid a floating decal.');
[[-pondRadiusX * 0.8, 0], [pondRadiusX * 0.8, 0], [0, -pondRadiusZ * 0.8], [0, pondRadiusZ * 0.8]].forEach(([dx, dz], sampleIndex) => {
  const bedY = oarbSampler.sampleOutdoorY(pondX + dx, pondZ + dz);
  assert.ok(Math.abs(bedY - pondFloorY) <= 0.32, `OARB pond bed sample ${sampleIndex} remains flattened under water.`);
  assert.ok(oarbPond.y - bedY <= 0.45, `OARB pond water sample ${sampleIndex} is not obviously above unsupported terrain.`);
});
const shoreY = oarbSampler.sampleOutdoorY(pondX + pondRadiusX + 4, pondZ);
assert.ok(shoreY > pondFloorY + 0.25, 'OARB pond has a raised muddy shore rim around the basin.');
const pondChest = oarbFeatureYardDefinition.outdoorChests.find((candidate) => candidate.id === 'oarb_training_pond_fishing_rod_chest');
assert.ok(pondChest, 'OARB fishing rod chest remains authored near the pond.');
assert.ok([pondChest.position.x, pondChest.position.y, pondChest.position.z].every(Number.isFinite), 'OARB fishing rod chest position is finite.');
const chestDx = pondChest.position.x - pondX;
const chestDz = pondChest.position.z - pondZ;
const chestEllipse = ((chestDx * chestDx) / (pondRadiusX * pondRadiusX)) + ((chestDz * chestDz) / (pondRadiusZ * pondRadiusZ));
assert.ok(chestEllipse > 1.1, 'OARB fishing rod chest is outside the water ellipse on dry land.');
assert.ok(Math.hypot(chestDx, chestDz) <= oarbPond.fishableRadius + 6, 'OARB fishing rod chest remains close to the fishable pond.');
assert.equal(pondChest.itemId, 'fishing_rod', 'OARB fishing rod chest still grants the fishing rod.');



const reliquaryBounds = reliquaryFieldDefinition.integrity.walkableBounds;
const pointInsideReliquaryBounds = ([x, z]) => x >= reliquaryBounds.minX && x <= reliquaryBounds.maxX && z >= reliquaryBounds.minZ && z <= reliquaryBounds.maxZ;
const expoFieldGate = reliquaryFieldDefinition.exits.find((candidate) => candidate.id === 'oarb_outdoor_expo_gate');
assert.ok(expoFieldGate, 'Reliquary Field keeps the OARB Outdoor Expo entrance trigger.');
assert.equal(expoFieldGate.toLocation, 'oarbOutdoorExpo', 'OARB Outdoor Expo entrance still routes to oarbOutdoorExpo.');
assert.equal(expoFieldGate.destinationSpawnId, 'oarb_outdoor_expo_player_start', 'OARB Outdoor Expo entrance still targets the expo player spawn.');
assert.equal(expoFieldGate.promptText, 'X: Enter OARB Outdoor Expo Center', 'OARB Outdoor Expo entrance prompt matches the runtime desktop/mobile interaction prompt.');
assert.deepEqual(expoFieldGate.position, { x: 88, y: 1, z: 186 }, 'OARB Outdoor Expo entrance remains at the authored x 88 z 186 gate position.');
const expoReturnSpawn = reliquaryFieldDefinition.spawns.find((candidate) => candidate.id === 'field_oarb_outdoor_expo_return');
assert.ok(expoReturnSpawn && [expoReturnSpawn.position.x, expoReturnSpawn.position.y, expoReturnSpawn.position.z].every(Number.isFinite), 'Reliquary Field OARB Outdoor Expo return spawn resolves and remains finite.');
assert.ok(expoReturnSpawn.position.z < expoFieldGate.triggerRect.minZ, 'OARB Outdoor Expo return spawn remains south of the expo trigger to avoid instant re-entry.');
function rectsOverlap(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}
reliquaryFieldDefinition.exits
  .filter((exit) => exit.id !== expoFieldGate.id)
  .forEach((exit) => assert.equal(rectsOverlap(expoFieldGate.triggerRect, exit.triggerRect), false, `OARB Outdoor Expo entrance trigger does not overlap ${exit.id}.`));
const expoVisibleIds = new Set(expoFieldGate.userData?.visibleMarker?.ids ?? []);
['OARB_OUTDOOR_EXPO_LEFT_STONE', 'OARB_OUTDOOR_EXPO_RIGHT_STONE', 'oarb_outdoor_expo_gold_header_panel', 'oarb_outdoor_expo_approach_path'].forEach((id) => {
  assert.equal(expoVisibleIds.has(id), true, `OARB Outdoor Expo visible marker metadata includes ${id}.`);
});
assert.deepEqual(expoFieldGate.userData?.visibleMarker?.gatePosition, { x: 88, y: 1, z: 186 }, 'OARB Outdoor Expo visible marker metadata records the exact gate position.');

const dungeonSceneSource = readFileSync(new URL('../src/game/DungeonScene.js', import.meta.url), 'utf8');
[
  'OARB_OUTDOOR_EXPO_INT_ENTER',
  "area: 'oarbOutdoorExpo'",
  "type: 'areaEntrance'",
  "hint: 'X: Enter OARB Outdoor Expo Center'",
  'OARB_OUTDOOR_EXPO_INTERACT_RANGE = 7.0',
  "debugGateId: 'oarb_outdoor_expo_gate'",
  "targetSpawnId: 'oarb_outdoor_expo_player_start'",
  'visibleMarkerPosition',
].forEach((snippet) => {
  assert.ok(dungeonSceneSource.includes(snippet), `OARB Outdoor Expo runtime interaction includes ${snippet}.`);
});
const expoPath = reliquaryFieldDefinition.splineTrails.find((trailCandidate) => trailCandidate.id === 'oarb_outdoor_expo_approach_path');
assert.ok(expoPath, 'Reliquary Field has an authored Outdoor Expo approach path.');
expoPath.points.forEach((point, index) => {
  assert.ok(point.every(Number.isFinite), `OARB Outdoor Expo approach path point ${index} is finite.`);
  assert.equal(pointInsideReliquaryBounds(point), true, `OARB Outdoor Expo approach path point ${index} is inside Reliquary Field bounds.`);
});
const reliquaryTrailMesh = createOutdoorSplineTrailMesh(expoPath, { terrainSampler: sampler, textures: reliquaryFieldDefinition.textures });
assert.ok(reliquaryTrailMesh, 'OARB Outdoor Expo approach path generates a visible trail mesh.');
const expoPrimitiveIdSet = new Set(reliquaryFieldDefinition.outdoorPrimitives.map((primitive) => primitive.id));
['oarb_outdoor_expo_gold_header_panel', 'oarb_outdoor_expo_left_beacon_cluster', 'oarb_outdoor_expo_right_beacon_cluster'].forEach((id) => {
  assert.equal(expoPrimitiveIdSet.has(id), true, `OARB Outdoor Expo exterior marker primitive ${id} exists.`);
});
reliquaryFieldDefinition.outdoorPrimitives
  .filter((primitive) => primitive.id.startsWith('oarb_outdoor_expo_'))
  .forEach((primitive) => {
    const pointsToCheck = primitive.points ?? [primitive.center].filter(Boolean);
    pointsToCheck.forEach((point, index) => {
      assert.ok(point.every(Number.isFinite), `${primitive.id} point ${index} is finite.`);
      assert.equal(pointInsideReliquaryBounds(point), true, `${primitive.id} point ${index} is inside Reliquary Field bounds.`);
    });
  });
const reliquaryExpoPrimitiveMeshes = createOutdoorPrimitiveMeshes(
  reliquaryFieldDefinition.outdoorPrimitives.filter((primitive) => primitive.id.startsWith('oarb_outdoor_expo_')),
  { terrainSampler: sampler, textures: reliquaryFieldDefinition.textures },
);
assert.equal(reliquaryExpoPrimitiveMeshes.length, 3, 'OARB Outdoor Expo exterior marker primitives generate visible finite meshes.');

const oarbOutdoorExpoTerrainMesh = createOutdoorTerrainMesh(oarbOutdoorExpoDefinition.terrain, { textures: oarbOutdoorExpoDefinition.textures });
assert.equal(oarbOutdoorExpoTerrainMesh.userData.materialFallbackUsed, false, 'OARB Outdoor Expo terrain resolves its authored material profile.');
assert.equal(oarbOutdoorExpoTerrainMesh.userData.materialKey, 'expoGrass', 'OARB Outdoor Expo terrain uses the authored expoGrass material key.');
const oarbOutdoorExpoSampler = createOutdoorTerrainSampler(oarbOutdoorExpoDefinition.terrain);
const expoPlayerSpawn = oarbOutdoorExpoDefinition.spawns.find((candidate) => candidate.id === 'oarb_outdoor_expo_player_start');
assert.ok(expoPlayerSpawn && [expoPlayerSpawn.position.x, expoPlayerSpawn.position.y, expoPlayerSpawn.position.z].every(Number.isFinite), 'OARB Outdoor Expo player spawn is finite.');
assert.ok(expoPlayerSpawn.position.x > -140 && expoPlayerSpawn.position.x < 140 && expoPlayerSpawn.position.z > -120 && expoPlayerSpawn.position.z < 120, 'OARB Outdoor Expo player spawn is inside terrain bounds.');
const pondReserve = oarbOutdoorExpoDefinition.rooms.find((room) => room.tags?.includes('pond-expo-reserve'));
assert.ok(pondReserve, 'OARB Outdoor Expo declares a Flat Pond Expo Reserve room.');
assert.equal(pondReserve.userData?.noWaterBodiesYet, true, 'OARB Outdoor Expo pond reserve metadata explicitly says no water bodies yet.');
assert.equal((oarbOutdoorExpoDefinition.waterBodies ?? []).length, 0, 'OARB Outdoor Expo has no pond or water bodies yet.');
const reserveSamples = [[-72, 24], [-112, -16], [-32, 64], [-72, 64]];
reserveSamples.forEach(([x, z], index) => {
  assert.ok(Math.abs(oarbOutdoorExpoSampler.sampleOutdoorY(x, z) - 0.08) <= 0.08, `OARB Outdoor Expo pond reserve sample ${index} stays mostly flat.`);
});
const textureGalleryMaterials = ['grassDryStrawPad', 'grassMattedPad', 'grassPatchyDirtPad', 'grassWornPad', 'mudWetDarkPad', 'mudCrackedDryPad', 'mudChurnedWetPad', 'mudPebblyEarthPad'];
textureGalleryMaterials.forEach((materialKey) => {
  assert.ok(oarbOutdoorExpoDefinition.textures[materialKey], `OARB Outdoor Expo texture gallery material ${materialKey} resolves.`);
  assert.ok(oarbOutdoorExpoDefinition.splineTrails.some((trail) => trail.id === `expo_texture_gallery_${materialKey}` && trail.material === materialKey), `OARB Outdoor Expo texture gallery has sample pad for ${materialKey}.`);
});
const expoPrimitiveIds = new Set(oarbOutdoorExpoDefinition.outdoorPrimitives.map((primitive) => primitive.id));
oarbOutdoorExpoDefinition.curvedBlockers.forEach((blocker) => {
  assert.ok(expoPrimitiveIds.has(blocker.visibleStructureId), `OARB Outdoor Expo blocker ${blocker.id} is paired with visible primitive ${blocker.visibleStructureId}.`);
});
const expoPrimitiveMeshes = createOutdoorPrimitiveMeshes(oarbOutdoorExpoDefinition.outdoorPrimitives, { terrainSampler: oarbOutdoorExpoSampler, textures: oarbOutdoorExpoDefinition.textures });
assert.equal(expoPrimitiveMeshes.length, oarbOutdoorExpoDefinition.outdoorPrimitives.length, 'OARB Outdoor Expo blocker station primitives generate visible meshes.');
const expoBlockers = createOutdoorCurvedBlockers(oarbOutdoorExpoDefinition.curvedBlockers);
assert.equal(expoBlockers.length, oarbOutdoorExpoDefinition.curvedBlockers.length, 'OARB Outdoor Expo paired blockers convert to runtime blockers.');

const authoredOutdoorPrimitives = [
  { id: 'future_cliff_wall', kind: 'cliffWall', points: [[-25, -20], [-15, -16], [-5, -20]], height: 8, thickness: 4, material: 'rockWall' },
  { id: 'future_root_wall', kind: 'rootWall', points: [[0, 20], [10, 24], [20, 20]], height: 4, thickness: 3, material: 'darkRoot' },
  { id: 'future_fallen_tree', kind: 'fallenTreeBarrier', from: [-10, 0], to: [10, 0], radius: 1.5, material: 'darkRoot' },
  { id: 'future_stone_cluster', kind: 'boulderCluster', center: [10, 10], radius: 4, material: 'stoneOutcrop' },
];
const primitiveTextures = {
  rockWall: reliquaryFieldDefinition.textures.rockWall,
  darkRoot: reliquaryFieldDefinition.textures.darkRoot,
  stoneOutcrop: reliquaryFieldDefinition.textures.stoneOutcrop,
};
const primitiveGroups = createOutdoorPrimitiveMeshes(authoredOutdoorPrimitives, { terrainSampler: stampedSampler, textures: primitiveTextures });
assert.equal(primitiveGroups.length, authoredOutdoorPrimitives.length, 'each supported outdoor primitive kind generates visible geometry.');
primitiveGroups.forEach((group, index) => {
  const authored = authoredOutdoorPrimitives[index];
  assert.equal(group.userData.authoringRuntime, 'OARB', `primitive ${authored.id} records OARB source metadata.`);
  assert.equal(group.userData.id, authored.id, `primitive ${authored.id} preserves stable id metadata.`);
  assert.equal(group.userData.kind, authored.kind, `primitive ${authored.id} preserves kind metadata.`);
  assert.equal(group.userData.materialKey, authored.material, `primitive ${authored.id} records material key.`);
  assert.equal(group.userData.materialFallbackUsed, false, `primitive ${authored.id} resolves authored material profile.`);
  assert.match(group.userData.pairedCollisionNote, /visibleStructureId/, `primitive ${authored.id} describes visibleStructureId pairing.`);
  assert.match(group.userData.collisionNote, /No collision/, `primitive ${authored.id} records that no collision is generated.`);
  assert.equal(group.userData.collision, undefined, `primitive ${authored.id} does not attach collision data.`);
  assert.ok(group.children.length > 0, `primitive ${authored.id} has visible child meshes.`);
  group.traverse((object) => {
    if (!object.isMesh) return;
    const position = object.geometry.attributes.position;
    for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
      assert.equal(Number.isFinite(position.getX(vertexIndex)), true, `${object.name} vertex ${vertexIndex} x is finite.`);
      assert.equal(Number.isFinite(position.getY(vertexIndex)), true, `${object.name} vertex ${vertexIndex} y is finite.`);
      assert.equal(Number.isFinite(position.getZ(vertexIndex)), true, `${object.name} vertex ${vertexIndex} z is finite.`);
    }
    assert.equal(Number.isFinite(object.position.x), true, `${object.name} world x is finite.`);
    assert.equal(Number.isFinite(object.position.y), true, `${object.name} world y is finite.`);
    assert.equal(Number.isFinite(object.position.z), true, `${object.name} world z is finite.`);
  });
});
const cliffSegment = primitiveGroups[0].children.find((child) => child.name.endsWith('segment-0'));
assert.ok(Math.abs((cliffSegment.position.y - authoredOutdoorPrimitives[0].height * 0.5) - stampedSampler.sampleOutdoorY(-25, -20)) < 0.2, 'cliff wall segment follows sampled terrain Y at its authored path.');
const rootSegment = primitiveGroups[1].children.find((child) => child.name.endsWith('segment-0'));
assert.ok(Math.abs((rootSegment.position.y - authoredOutdoorPrimitives[1].height * 0.5) - stampedSampler.sampleOutdoorY(0, 20)) < 0.2, 'root wall segment follows sampled terrain Y at its authored path.');
const trunk = primitiveGroups[2].children.find((child) => child.name.endsWith('trunk'));
const trunkBase = trunk.position.y - authoredOutdoorPrimitives[2].radius;
const expectedTrunkBase = (stampedSampler.sampleOutdoorY(-10, 0) + stampedSampler.sampleOutdoorY(10, 0)) * 0.5;
assert.ok(Math.abs(trunkBase - expectedTrunkBase) < 0.1, 'fallen tree barrier samples terrain height at both ends.');
const firstStone = primitiveGroups[3].children[0];
assert.ok(firstStone.position.y > stampedSampler.sampleOutdoorY(10, 10), 'boulder cluster stones sit above sampled terrain Y.');
const primitiveCollisionRegression = new CollisionWorld({
  walkableRects: [{ minX: -40, maxX: 40, minZ: -40, maxZ: 40 }],
  blockerRects: [],
  outdoorTerrainSampler: stampedSampler,
});
assert.equal(primitiveCollisionRegression.canStandAtFloorPosition({ x: -15, y: 0, z: -18 }), true, 'visible outdoor primitives do not create collision by themselves.');

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
