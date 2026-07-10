import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { compileDungeonLocation } from '../src/engine/dungeon-authoring/DungeonCompiler.js';
import { createOutdoorTerrainSampler } from '../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { createOutdoorTerrainComposition } from '../src/engine/outdoor-authoring/OutdoorTerrainCompositionBuilder.js';
import { createOutdoorPathCorridorMeshes, sampleOutdoorPathCorridor } from '../src/engine/outdoor-authoring/OutdoorPathCorridorBuilder.js';
import { createOutdoorWaterwayMeshes, sampleOutdoorWaterway } from '../src/engine/outdoor-authoring/OutdoorWaterwayBuilder.js';
import { auditOutdoorWaterBodyTerrain } from '../src/engine/outdoor-authoring/OutdoorWaterBodyBuilder.js';
import { getLocationDefinition, hasLocationDefinition, isLocationDefinitionLoaded, loadLocationDefinition } from '../src/game/locations/locationRegistry.js';
import { NORTH_ROAD_WORLD_KEYS } from '../src/game/GameState.js';
import { FISH_SPECS } from '../src/game/fishing/FishMeshFactory.js';
import { isPointInFishingZone, sampleFishingZoneWaterY } from '../src/game/fishing/FishingZoneGeometry.js';
import { buildOutdoorPonds } from '../src/game/world-scene/OutdoorWorldRuntime.js';
import { createOutdoorCrossingGroups } from '../src/game/world-kits/structures/OutdoorCrossingKit.js';
import { createOutdoorWildernessStructureGroups } from '../src/game/world-kits/structures/OutdoorWildernessStructureKit.js';

const ROOT = process.cwd();
const PASS = [];
const WARNING = [];
const FAIL = [];
const METRICS = {};
function pass(message) { PASS.push(message); }
function warning(message) { WARNING.push(message); }
function check(message, callback) {
  try { callback(); pass(message); } catch (error) { FAIL.push(`${message}: ${error.message}`); }
}
function material(profile = {}) {
  return new THREE.MeshStandardMaterial({ color: profile.color ?? 0x777777, roughness: profile.roughness ?? 0.95, metalness: profile.metalness ?? 0 });
}
function geometryTotals(objects) {
  let meshes = 0; let vertices = 0; let triangles = 0;
  objects.forEach((object) => object?.traverse?.((child) => {
    if (!child.isMesh || !child.geometry) return;
    meshes += 1;
    vertices += child.geometry.attributes.position?.count ?? 0;
    triangles += child.geometry.index ? child.geometry.index.count / 3 : (child.geometry.attributes.position?.count ?? 0) / 3;
  }));
  return { meshes, vertices, triangles };
}
function assertGeometryFinite(objects, label) {
  let geometryCount = 0;
  objects.forEach((object) => object?.traverse?.((child) => {
    if (!child.geometry) return;
    geometryCount += 1;
    const position = child.geometry.attributes.position;
    const uv = child.geometry.attributes.uv;
    const normal = child.geometry.attributes.normal;
    assert.ok(position?.count > 0, `${label} ${child.name} has no positions.`);
    for (let index = 0; index < position.count; index += 1) {
      assert.ok([position.getX(index), position.getY(index), position.getZ(index)].every(Number.isFinite), `${label} ${child.name} has a non-finite position.`);
      if (normal) assert.ok([normal.getX(index), normal.getY(index), normal.getZ(index)].every(Number.isFinite), `${label} ${child.name} has a non-finite normal.`);
      if (uv) assert.ok([uv.getX(index), uv.getY(index)].every(Number.isFinite), `${label} ${child.name} has a non-finite UV.`);
    }
  }));
  assert.ok(geometryCount > 0, `${label} generated no geometry.`);
}
function pointInPolygon(x, z, points = []) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [xi, zi] = points[index]; const [xj, zj] = points[previous];
    if (((zi > z) !== (zj > z)) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function contentPoints(definition) {
  return [
    ...definition.splineTrails.flatMap((entry) => entry.points ?? []),
    ...definition.waterways.flatMap((entry) => entry.points ?? []),
    ...definition.outdoorStructureKits.flatMap((entry) => entry.points ?? (entry.center ? [entry.center] : [])),
    ...definition.foliageBillboards.map((entry) => [entry.position[0], entry.position[2]]),
    ...definition.spawns.map((entry) => [entry.position?.x ?? entry.position?.[0], entry.position?.z ?? entry.position?.[2]]),
  ].filter(([x, z]) => Number.isFinite(x) && Number.isFinite(z));
}

check('registered location id', () => assert.equal(hasLocationDefinition('north-road'), true));
check('fresh registry begins lazy/unloaded', () => assert.equal(isLocationDefinitionLoaded('north-road'), false));
const definition = await loadLocationDefinition('north-road');
check('successful lazy load and cache', () => assert.equal(getLocationDefinition('north-road'), definition));
const compiled = compileDungeonLocation(definition, { logValidation: false });

check('location dimensions, sectors, and chunk contract', () => {
  assert.equal(definition.id, 'north-road'); assert.equal(definition.type, 'field');
  assert.deepEqual(definition.terrain.size, [500, 1200]);
  assert.equal(definition.terrain.composition.columns * definition.terrain.composition.rows, 27);
  assert.equal(definition.rooms.length, 9);
});
check('valid entry, safe return, and development spawns', () => {
  assert.ok(compiled.validation.ok, compiled.validation.errors.map((issue) => issue.message).join('; '));
  assert.ok(compiled.exits.some((exit) => exit.toLocation === 'folsom' && exit.destinationSpawnId === 'folsom_north_gate_return'));
  assert.ok(definition.development.spawnIds.every((id) => definition.spawns.some((spawn) => spawn.id === id)));
  assert.equal(definition.development.spawnIds.length, 12);
});
check('normal progression remains locked and dev access grants nothing', () => {
  const folsomSource = fs.readFileSync(path.join(ROOT, 'src/game/locations/folsom.definition.js'), 'utf8');
  assert.match(folsomSource, /requiredWorldState: 'folsom_north_gate_open'/);
  assert.match(folsomSource, /destinationSpawnId: 'north-gate-exterior'/);
  assert.equal(definition.development.productionStartupAllowed, false);
  assert.equal(definition.development.grantsProgression, false);
  assert.doesNotMatch(definition.development.directEntry, /road_warden_proof_accepted|folsom_north_gate_open/);
});

const sampler = createOutdoorTerrainSampler(definition.terrain, { pathCorridors: definition.splineTrails, waterways: definition.waterways });
const composition = createOutdoorTerrainComposition(definition.terrain, { textures: definition.textures, makeMaterial: material, pathCorridors: definition.splineTrails, waterways: definition.waterways });
const pathMeshes = createOutdoorPathCorridorMeshes(sampler.pathCorridorRuntime, { terrainSampler: sampler, textures: definition.textures, makeMaterial: material });
const animatedWaterMaterials = new Set();
const waterwayMeshes = createOutdoorWaterwayMeshes(sampler.waterwayRuntime, { textures: definition.textures, makeMaterial: material, registerAnimatedTextureFlipbook: (target) => animatedWaterMaterials.add(target) });
const pondFishingZones = [];
const pondMeshes = buildOutdoorPonds({ waterBodies: definition.waterBodies, textureProfiles: definition.textures, makeTexturedMaterial: material, registerAnimatedTextureFlipbook: (target) => animatedWaterMaterials.add(target), fishingZones: pondFishingZones });
const crossingGroups = createOutdoorCrossingGroups(definition.outdoorCrossings, { terrainSampler: sampler, waterwayRuntime: sampler.waterwayRuntime, pathCorridorRuntime: sampler.pathCorridorRuntime, textures: definition.textures, makeMaterial: material });
const structureGroups = createOutdoorWildernessStructureGroups(definition.outdoorStructureKits, { terrainSampler: sampler, textures: definition.textures, makeMaterial: material });

check('finite terrain geometry, UVs, normals, sampler agreement, and exact shared edges', () => {
  assertGeometryFinite([composition.group], 'terrain');
  const edgeHeights = new Map(); let duplicateEdgeVertices = 0;
  composition.chunks.forEach((chunk) => {
    const position = chunk.geometry.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index); const y = position.getY(index); const z = position.getZ(index);
      assert.ok(Math.abs(y - sampler.sampleOutdoorY(x, z)) < 0.0001, `${chunk.name} disagrees with final sampler.`);
      const key = `${x.toFixed(6)},${z.toFixed(6)}`;
      if (edgeHeights.has(key)) { duplicateEdgeVertices += 1; assert.equal(y, edgeHeights.get(key), `Chunk seam ${key} does not agree exactly.`); }
      edgeHeights.set(key, y);
    }
  });
  assert.ok(duplicateEdgeVertices > 0, 'No duplicated seam vertices were audited.');
});
check('terrain has complete bounds, safe chunk budgets, and no extreme unintended slopes', () => {
  assert.equal(composition.chunks.length, 27);
  assert.ok(composition.summaries.every((chunk) => chunk.vertexCount <= 6500 && chunk.triangleCount <= 12288));
  assert.ok(Math.max(...composition.summaries.map((chunk) => chunk.maximumSlope)) < 8);
  const [sizeX, sizeZ] = definition.terrain.size;
  assert.ok(contentPoints(definition).every(([x, z]) => x >= -sizeX / 2 && x <= sizeX / 2 && z >= -sizeZ / 2 && z <= sizeZ / 2));
});

check('professional roads have finite dense meshes and no legacy or hidden support', () => {
  assert.ok(definition.splineTrails.length >= 10);
  assert.ok(definition.splineTrails.every((entry) => ['graded', 'conform', 'bridge'].includes(entry.surfaceMode)));
  assert.ok(definition.splineTrails.filter((entry) => entry.surfaceMode !== 'bridge').every((entry) => entry.pathSupport === false));
  assert.ok(definition.splineTrails.filter((entry) => entry.surfaceMode === 'bridge').every((entry) => entry.pathSupport === true));
  assertGeometryFinite(pathMeshes, 'path');
});
check('road grade, cross-slope, cut/fill, support, triangle, and terrain agreement limits', () => {
  sampler.pathCorridorRuntime.corridors.forEach((corridor) => {
    assert.equal(corridor.errors.length, 0, `${corridor.id}: ${corridor.errors.map((entry) => entry.code).join(',')}`);
    assert.equal(corridor.warnings.length, 0, `${corridor.id}: ${corridor.warnings.map((entry) => entry.code).join(',')}`);
    assert.ok(corridor.summary.maxGrade <= corridor.grade.maxSlope + 0.035, `${corridor.id} grade ${corridor.summary.maxGrade}.`);
    assert.ok(corridor.summary.maxCrossSlope <= corridor.grade.maxCrossSlope + 0.05, `${corridor.id} cross-slope ${corridor.summary.maxCrossSlope}.`);
    if (corridor.surfaceMode === 'graded') {
      assert.ok(corridor.summary.maxCut <= corridor.grade.maxCut + 0.05, `${corridor.id} cut ${corridor.summary.maxCut}.`);
      assert.ok(corridor.summary.maxFill <= corridor.grade.maxFill + 0.05, `${corridor.id} fill ${corridor.summary.maxFill}.`);
      assert.equal(corridor.summary.unsupportedSpanCount, 0);
    }
    assert.ok(corridor.summary.maxTerrainAgreementError < 0.00001);
    assert.ok(corridor.summary.maxTriangleEdge < 8, `${corridor.id} triangle edge ${corridor.summary.maxTriangleEdge}.`);
    assert.equal(corridor.summary.degenerateTriangleCount, 0);
  });
});

check('downhill continuous waterways with terrain-matched channels and banks', () => {
  assertGeometryFinite(waterwayMeshes, 'waterway');
  assert.equal(sampler.waterwayRuntime.audit.uphillSegments, 0);
  sampler.waterwayRuntime.waterways.forEach((waterway) => {
    assert.ok(waterway.samples.length > waterway.points.length * 3);
    waterway.samples.slice(1).forEach((sample, index) => {
      const previous = waterway.samples[index];
      assert.ok(sample.waterY <= previous.waterY + 0.000001);
      assert.ok(previous.waterY - sample.waterY <= waterway.flow.maximumSlope * (sample.distance - previous.distance) + 0.03);
      const terrainY = sampler.sampleOutdoorY(sample.x, sample.z);
      if (sample.crossingId) assert.ok(terrainY <= sample.waterY + 0.15, `${waterway.id} crossing rises too far above its water profile.`);
      else assert.ok(terrainY < sample.waterY, `${waterway.id} channel rises above water.`);
    });
    assert.ok(waterway.tags.some((tag) => /outlet|connection|tributary|drainage|named-waterway|primary-creek/.test(tag)), `${waterway.id} lacks an authored termination contract.`);
  });
});
check('ford, bridge, and culvert interfaces are valid and visible', () => {
  assert.deepEqual(definition.outdoorCrossings.map((entry) => entry.kind).sort(), ['bridge', 'culvert', 'ford']);
  assert.equal(crossingGroups.length, 3);
  const bridge = crossingGroups.find((entry) => entry.userData.kind === 'proceduralTimberBridge');
  const ford = crossingGroups.find((entry) => entry.userData.kind === 'fordInterface');
  const culvert = crossingGroups.find((entry) => entry.userData.kind === 'militaryRoadCulvert');
  assert.ok(bridge?.userData.visibleDeck && bridge.userData.collision.includes('support'));
  assert.ok(ford?.userData.visibleShallowBed && ford.userData.waterwayId === 'north_road_hunter_creek');
  assert.ok(culvert?.userData.inletVisible && culvert.userData.outletVisible && culvert.userData.continuousWaterProfile);
});

check('three mandatory fishable ponds have valid seven-layer terrain-integrated shorelines', () => {
  assert.deepEqual(definition.waterBodies.map((body) => body.id), ['north_road_hunters_mere', 'north_road_prayer_pool', 'north_road_scout_tarn']);
  definition.waterBodies.forEach((body) => {
    assert.equal(body.fishable, true);
    assert.equal(body.shorelineProfile.layers.length, 7);
    assert.ok(body.footprint.waterOutline.length >= 24);
    assert.ok(body.fishingBanks.length >= 1);
    assert.ok(auditOutdoorWaterBodyTerrain(body, sampler).ok, `${body.id} terrain audit failed.`);
    body.fishingBanks.forEach((bank) => assert.equal(pointInPolygon(bank.position[0], bank.position[1], body.footprint.waterOutline), false));
  });
});

const allFishingZones = [...sampler.waterwayRuntime.fishingZones, ...pondFishingZones];
check('all required water fishing zones use valid species and wet cast/spawn surfaces', () => {
  assert.equal(sampler.waterwayRuntime.fishingZones.length, 4);
  assert.equal(pondFishingZones.length, 3);
  assert.ok(['north_road_scout_rill', 'north_road_prayer_run', 'north_road_hunter_creek'].every((id) => sampler.waterwayRuntime.fishingZones.some((zone) => zone.waterBodyId === id)));
  assert.equal(sampler.waterwayRuntime.fishingZones.filter((zone) => zone.waterBodyId === 'north_road_hunter_creek').length, 2);
  allFishingZones.forEach((zone) => {
    assert.ok(zone.fishSpeciesPool.length > 0 && zone.fishSpeciesPool.every((species) => FISH_SPECS[species]));
    if (zone.shape === 'corridor') {
      zone.waterProfile.forEach((profile) => {
        assert.equal(isPointInFishingZone(profile, zone), true);
        assert.ok(Number.isFinite(sampleFishingZoneWaterY(profile, zone)));
        assert.ok(sampler.sampleOutdoorY(profile.x, profile.z) < profile.y);
      });
      const standing = zone.standingArea?.center;
      if (standing) {
        const sampled = sampleOutdoorWaterway(sampler.waterwayRuntime, standing[0], standing[1]);
        assert.ok(!sampled || sampled.distance > sampled.channelHalf, `${zone.id} standing position lies in water.`);
      }
    } else {
      assert.ok(zone.visualSpawnBounds.maximumY < zone.position.y);
      assert.equal(isPointInFishingZone({ x: zone.centerX, z: zone.centerZ }, zone), true);
    }
  });
});

check('ecological foliage uses real sprites, valid scales, bounds, and protected exclusions', () => {
  const [sizeX, sizeZ] = definition.terrain.size;
  definition.foliageBillboards.forEach((entry) => {
    const [x, , z] = entry.position;
    assert.ok(entry.height > 0.2 && entry.width > 0.2);
    assert.ok(x >= -sizeX / 2 && x <= sizeX / 2 && z >= -sizeZ / 2 && z <= sizeZ / 2);
    assert.ok(fs.existsSync(path.join(ROOT, 'public', entry.spritePath.replace(/^\.\//, ''))), `Missing ${entry.spritePath}.`);
    const road = sampleOutdoorPathCorridor(sampler.pathCorridorRuntime, x, z);
    assert.ok(!road || Math.abs(road.lateral) > road.corridor.width * 0.5 + 0.1, `${entry.id} blocks ${road?.corridor?.id ?? 'a road'}.`);
    definition.waterBodies.forEach((body) => assert.equal(pointInPolygon(x, z, body.footprint.waterOutline), false, `${entry.id} lies in ${body.id}.`));
    const waterway = sampleOutdoorWaterway(sampler.waterwayRuntime, x, z);
    assert.ok(!waterway || waterway.distance > waterway.channelHalf, `${entry.id} lies in ${waterway?.waterway?.id ?? 'a waterway'}.`);
    const lanes = [
      ...definition.waterBodies.flatMap((body) => body.fishingBanks.map((bank) => ({ center: bank.position, radius: bank.noFoliageRadius }))),
      ...sampler.waterwayRuntime.fishingZones.map((zone) => zone.noFoliageLane).filter(Boolean),
    ];
    assert.ok(lanes.every((lane) => Math.hypot(x - lane.center[0], z - lane.center[1]) > lane.radius), `${entry.id} blocks a casting lane.`);
  });
});

check('procedural structures have valid geometry/material references and traversable camps', () => {
  assertGeometryFinite([...structureGroups, ...crossingGroups], 'structure');
  assert.equal(structureGroups.filter((group) => group.userData.kind === 'outdoorCampKit').length, 3);
  assert.ok(structureGroups.filter((group) => group.userData.kind === 'outdoorCampKit').every((group) => group.userData.traversableClearing));
  const materialReferences = [
    ...definition.splineTrails.map((entry) => entry.material),
    ...definition.waterways.flatMap((entry) => [entry.materials.bed, entry.materials.submergedShelf, entry.materials.wetBank, entry.materials.dryBank, entry.water.material]),
    ...definition.waterBodies.flatMap((entry) => [entry.material, entry.bedMaterial, entry.shoreMaterial]),
    ...definition.outdoorStructureKits.map((entry) => entry.material).filter(Boolean),
    ...definition.outdoorCrossings.flatMap((entry) => [entry.material, entry.hardwareMaterial]).filter(Boolean),
  ];
  assert.ok(materialReferences.every((key) => definition.textures[key]), `Missing material key: ${materialReferences.find((key) => !definition.textures[key])}`);
});
check('hard Empty Fort boundary spans both terrain sides and cannot be bypassed', () => {
  const ids = new Set(definition.curvedBlockers.map((entry) => entry.id));
  for (const id of ['north_road_fort_boundary_west_blocker', 'north_road_empty_fort_boundary_blocker', 'north_road_fort_boundary_east_blocker']) assert.ok(ids.has(id));
  const west = definition.curvedBlockers.find((entry) => entry.id === 'north_road_fort_boundary_west_blocker');
  const east = definition.curvedBlockers.find((entry) => entry.id === 'north_road_fort_boundary_east_blocker');
  assert.ok(west.points[0][0] <= -240 && east.points.at(-1)[0] >= 240);
  assert.equal(definition.metrics.emptyFortInteriorBuilt, false);
  assert.ok(definition.outdoorStructureKits.some((entry) => entry.kind === 'boundaryGate'));
});

check('route state prerequisites, persistence keys, and physical-only progression contracts', () => {
  for (const key of ['hunterCampMarked', 'churchCampMarked', 'scoutCampMarked', 'hunterRootCleared', 'churchRootCleared', 'scoutRootCleared', 'bentRoadCorrected', 'growthGateLeftKnotCleared', 'growthGateRightCordsCleared', 'growthGateSoftMatCleared', 'growthGateOpen']) assert.ok(NORTH_ROAD_WORLD_KEYS[key]);
  assert.equal(definition.outdoorInteractions.some((entry) => /root|growth_gate/.test(entry.id) && entry.type === 'areaEntrance'), false);
  assert.ok(definition.routeStateStructures.some((entry) => entry.id === 'north_road_bent_road_false_landmark'));
  assert.ok(definition.routeStateStructures.some((entry) => entry.id === 'north_road_growth_gate'));
});
check('development debug contracts are production guarded and audio has no fake placeholders', () => {
  const runtimeSource = fs.readFileSync(path.join(ROOT, 'src/game/world-scene/OutdoorWorldRuntime.js'), 'utf8');
  assert.match(runtimeSource, /import\.meta\.env\?\.DEV/);
  assert.ok(definition.audioZones.every((entry) => entry.acceptedCueId === null && entry.status === 'future-cue-contract-no-placeholder-audio'));
});

const terrainTotals = geometryTotals([composition.group]);
const pathTotals = geometryTotals(pathMeshes);
const waterTotals = geometryTotals(waterwayMeshes);
const pondTotals = geometryTotals(pondMeshes);
const structureTotals = geometryTotals([...structureGroups, ...crossingGroups]);
Object.assign(METRICS, {
  terrainChunks: composition.chunks.length,
  terrainVertices: terrainTotals.vertices,
  terrainTriangles: terrainTotals.triangles,
  pathVertices: pathTotals.vertices,
  pathTriangles: pathTotals.triangles,
  waterwayVertices: waterTotals.vertices,
  waterwayTriangles: waterTotals.triangles,
  pondVertices: pondTotals.vertices,
  pondTriangles: pondTotals.triangles,
  structureMeshes: structureTotals.meshes,
  foliageBillboards: definition.foliageBillboards.length,
  fishingZones: allFishingZones.length,
  estimatedTransparentObjects: definition.foliageBillboards.length + sampler.waterwayRuntime.waterways.length + definition.waterBodies.length,
  dynamicLights: definition.lights.filter((entry) => entry.kind !== 'ambient' && entry.kind !== 'hemisphere').length,
  animatedWaterMaterials: animatedWaterMaterials.size,
});
check('reported performance counts remain inside authored mobile budgets', () => {
  assert.ok(METRICS.terrainVertices < 100000);
  assert.ok(METRICS.pathVertices < 30000);
  assert.ok(METRICS.foliageBillboards <= 900);
  assert.ok(METRICS.estimatedTransparentObjects <= 950);
  assert.ok(METRICS.dynamicLights <= 2);
  assert.ok(METRICS.animatedWaterMaterials <= 4);
});

compiled.validation.warnings.forEach((issue) => warning(`Compiler: ${issue.message}`));
sampler.pathCorridorRuntime.corridors.flatMap((corridor) => corridor.warnings.map((issue) => `${corridor.id}: ${issue.message}`)).forEach(warning);

console.log(`North Road validation: PASS (${PASS.length}), WARNING (${WARNING.length}), FAIL (${FAIL.length})`);
PASS.forEach((message) => console.log(`PASS: ${message}`));
WARNING.forEach((message) => console.log(`WARNING: ${message}`));
FAIL.forEach((message) => console.log(`FAIL: ${message}`));
Object.entries(METRICS).forEach(([key, value]) => console.log(`METRIC: ${key}=${value}`));
if (FAIL.length) process.exitCode = 1;
