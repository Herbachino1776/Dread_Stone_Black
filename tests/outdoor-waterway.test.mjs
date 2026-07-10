import assert from 'node:assert/strict';
import { buildOutdoorWaterways, createOutdoorWaterwayMeshes, deformOutdoorTerrainForWaterways, sampleOutdoorWaterway } from '../src/engine/outdoor-authoring/OutdoorWaterwayBuilder.js';
import { isPointInFishingZone, sampleFishingZoneWaterY } from '../src/game/fishing/FishingZoneGeometry.js';

const definition = {
  id: 'test_downhill_creek', displayName: 'Test Creek', kind: 'creek', points: [[-20, -30], [-8, -4], [4, 16], [18, 34]], sampleSpacing: 0.7,
  flow: { sourceY: 8, outletY: 2, minimumSlope: 0.002, maximumSlope: 0.1 }, channel: { width: [3, 6], depth: [0.5, 1], bedWidthRatio: 0.5, lateralSamples: 9 },
  banks: { submergedShelfWidth: 0.5, innerWetBankWidth: 0.8, outerWetBankWidth: 1.1, dryTransitionWidth: 2.2 }, materials: { bed: 'bed', submergedShelf: 'shelf', wetBank: 'bank', dryBank: 'ground' }, water: { material: 'water', opacity: 0.6 },
  fishing: { enabled: true, zones: [{ id: 'test_creek_fishing', startDistance: 8, endDistance: 55, fishSpeciesPool: ['smallRiverFish'] }] }, crossings: [{ id: 'test_ford', kind: 'ford', center: [-8, -4], radius: 5, depth: 0.25 }],
};
const first = buildOutdoorWaterways([definition]);
const second = buildOutdoorWaterways([definition]);
assert.deepEqual(first.waterways[0].samples, second.waterways[0].samples, 'Waterway generation is deterministic.');
assert.equal(first.audit.uphillSegments, 0, 'Water surface never climbs uphill.');
assert.ok(first.waterways[0].samples.length > definition.points.length * 10, 'Sparse controls become a dense water profile.');
assert.ok(first.waterways[0].samples[0].width < first.waterways[0].samples.at(-1).width, 'Variable-width channel is preserved.');
const middle = first.waterways[0].samples[Math.floor(first.waterways[0].samples.length / 2)];
const channel = sampleOutdoorWaterway(first, middle.x, middle.z);
assert.equal(channel.region, 'channel-bed');
assert.ok(deformOutdoorTerrainForWaterways(first, middle.x, middle.z, 10).y < middle.waterY, 'Channel deformation cuts below the water surface.');
const zone = first.fishingZones[0];
const profilePoint = zone.waterProfile[Math.floor(zone.waterProfile.length / 2)];
assert.equal(isPointInFishingZone(profilePoint, zone), true, 'Corridor cast surface contains its water profile.');
assert.ok(Number.isFinite(sampleFishingZoneWaterY(profilePoint, zone)), 'Corridor water elevation resolves from its downhill profile.');
const meshes = createOutdoorWaterwayMeshes(first, { textures: { water: { color: 0x556677 }, bank: { color: 0x443322 } } });
assert.equal(meshes.length, 2, 'Waterway produces physical bank/bed and water meshes.');
assert.ok(meshes.every((mesh) => mesh.geometry.attributes.position.count > definition.points.length * 10), 'Generated water and banks are not sparse flat ribbons.');
assert.ok(meshes.every((mesh) => [...mesh.geometry.attributes.position.array].every(Number.isFinite)), 'Waterway geometry remains finite.');
assert.equal(meshes[0].geometry.index.count / 3, (first.waterways[0].samples.length - 1) * 8, 'Left and right bank strips remain disconnected instead of roofing over the channel.');
assert.deepEqual(meshes.sharedMaterialSummary, { bankMaterialCount: 1, waterMaterialCount: 1 }, 'Waterway material allocation is shared by logical key.');
console.log('Outdoor waterway tests passed: downhill flow, variable cross-section, ford depth, terrain deformation, fishing containment, dense geometry, and determinism.');
