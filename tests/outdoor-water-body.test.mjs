import assert from 'node:assert/strict';
import * as THREE from 'three';
import { auditOutdoorWaterBodyTerrain } from '../src/engine/outdoor-authoring/OutdoorWaterBodyBuilder.js';
import { createOutdoorTerrainSampler } from '../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { buildOutdoorPonds } from '../src/game/world-scene/OutdoorWorldRuntime.js';
import { folsomDefinition } from '../src/game/locations/folsom.definition.js';
import { northRoadDefinition } from '../src/game/locations/northRoad.definition.js';
import { isPointInFishingZone } from '../src/game/fishing/FishingZoneGeometry.js';

const sampler = createOutdoorTerrainSampler(northRoadDefinition.terrain, { pathCorridors: northRoadDefinition.splineTrails, waterways: northRoadDefinition.waterways });
for (const body of northRoadDefinition.waterBodies) {
  assert.equal(body.shorelineProfile.layers.length, 7, `${body.id} has basin-to-dry-bank shoreline layers.`);
  assert.equal(body.shorelineProfile.validation.nestingErrors, 0, `${body.id} shoreline outlines remain nested.`);
  assert.equal(body.shorelineProfile.validation.oneSourceOutline, true);
  assert.equal(body.shorelineProfile.validation.waterBelowMud, true);
  assert.equal(body.shorelineProfile.validation.mudBelowWetBank, true);
  assert.ok(body.fishingBanks.length >= 1, `${body.id} has an authored clear casting bank.`);
  const audit = auditOutdoorWaterBodyTerrain(body, sampler);
  assert.equal(audit.ok, true, `${body.id} terrain/shore/water agreement failed: ${JSON.stringify(audit)}`);
  assert.equal(audit.dryWaterSamples, 0);
}

const fishingZones = [];
const pondMeshes = buildOutdoorPonds({ waterBodies: northRoadDefinition.waterBodies, textureProfiles: northRoadDefinition.textures, makeTexturedMaterial: (profile) => new THREE.MeshStandardMaterial({ color: profile.color ?? 0xffffff, roughness: profile.roughness ?? 0.9 }), fishingZones });
assert.equal(fishingZones.length, 3);
assert.ok(fishingZones.every((zone) => zone.shape === 'polygon' && zone.points.length >= 24), 'Pond casts use the same irregular water outline, not a loose ellipse.');
for (const zone of fishingZones) {
  assert.equal(isPointInFishingZone({ x: zone.centerX, z: zone.centerZ }, zone), true);
  assert.equal(isPointInFishingZone({ x: zone.maxX + 1, z: zone.maxZ + 1 }, zone), false, `${zone.id} rejects dry bounding-box corners.`);
  assert.ok(zone.castingBanks.length >= 1);
  assert.ok(zone.visualSpawnBounds.maximumY < zone.position.y, `${zone.id} fish visual bounds stay underwater.`);
}
assert.equal(pondMeshes.filter((mesh) => mesh.userData.kind === 'pond').length, 3);

const folsomPond = folsomDefinition.waterBodies.find((body) => body.id === 'folsom_starter_pond');
const folsomSampler = createOutdoorTerrainSampler(folsomDefinition.terrain, { pathCorridors: folsomDefinition.splineTrails });
assert.equal(folsomPond.fishable, true, 'Folsom starter pond remains fishable.');
assert.equal(folsomPond.shorelineProfile.layers.length, 7, 'Folsom uses the compatibility shoreline profile.');
assert.equal(auditOutdoorWaterBodyTerrain(folsomPond, folsomSampler).dryWaterSamples, 0, 'Folsom pond water remains above its terrain basin.');
console.log('Outdoor water-body tests passed: irregular ponds, seven-layer shorelines, terrain agreement, polygon fishing water, underwater spawns, casting banks, and Folsom regression.');
