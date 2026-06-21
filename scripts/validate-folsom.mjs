import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDungeonCollision } from '../src/engine/dungeon-authoring/DungeonCollisionBuilder.js';
import { createOutdoorCurvedBlockers } from '../src/engine/outdoor-authoring/OutdoorBlockerBuilder.js';
import { createOutdoorTerrainSampler } from '../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { CollisionWorld } from '../src/game/Collision.js';
import { equipmentRegistry } from '../src/game/equipment/equipmentRegistry.js';
import { FISH_SPECS } from '../src/game/fishing/FishMeshFactory.js';
import { resolveStartupArea } from '../src/game/locationRouting.js';
import { folsomDefinition } from '../src/game/locations/folsom.definition.js';
import { reliquaryFieldDefinition } from '../src/game/locations/reliquaryField.definition.js';
import { validatePondDecor, validatePondFootprint } from './pond-footprint-validation.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const interactionsSource = readFileSync(resolve(repoRoot, 'src/game/Interactions.js'), 'utf8');
const terrainSampler = createOutdoorTerrainSampler(folsomDefinition.terrain);
const dungeonCollision = buildDungeonCollision(folsomDefinition);
const collision = new CollisionWorld({
  walkableRects: dungeonCollision.walkableRects,
  blockerRects: [...dungeonCollision.blockerRects, ...createOutdoorCurvedBlockers(folsomDefinition.curvedBlockers)],
  playerRadius: 0.5,
  walkableSurfaces: dungeonCollision.walkableSurfaces,
  defaultFloorY: folsomDefinition.defaultFloorY,
  outdoorTerrainSampler: terrainSampler,
});

function textureAssetExists(texturePath) {
  if (typeof texturePath !== 'string') return null;
  const publicPath = texturePath.replace(/^\.\//, 'public/');
  return existsSync(resolve(repoRoot, publicPath));
}

function canStandAt([x, z]) {
  const floor = collision.sampleWalkableY(x, z, 0).y;
  return collision.canStandAtFloorPosition({ x, y: floor, z });
}


function normalizedLabelText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isKnownFolsomCampfireOpenGround([x, z]) {
  const floor = collision.sampleWalkableY(x, z, 0).y;
  const inWater = folsomDefinition.waterBodies.some((body) => {
    const [cx, cz] = body.center ?? [];
    const [rx, rz] = Array.isArray(body.radius) ? body.radius : [body.radius, body.radius];
    if (![cx, cz, rx, rz].every(Number.isFinite)) return false;
    const margin = 1.1;
    return (((x - cx) ** 2) / ((rx + margin) ** 2)) + (((z - cz) ** 2) / ((rz + margin) ** 2)) <= 1;
  });
  return !inWater && collision.canStandAtFloorPosition({ x, y: floor, z });
}

function routeMaxSampledSlope(route) {
  let maxSlope = 0;
  for (let index = 1; index < route.points.length; index += 1) {
    const [x0, z0] = route.points[index - 1];
    const [x1, z1] = route.points[index];
    const distance = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(distance / 1.5));
    let previous = { x: x0, z: z0, y: terrainSampler.sampleOutdoorY(x0, z0) };
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const current = { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t };
      current.y = terrainSampler.sampleOutdoorY(current.x, current.z);
      const run = Math.hypot(current.x - previous.x, current.z - previous.z);
      if (run > 0) maxSlope = Math.max(maxSlope, Math.abs(current.y - previous.y) / run);
      previous = current;
    }
  }
  return maxSlope;
}

function routeIsWalkable(route) {
  for (let index = 0; index < route.points.length; index += 1) {
    if (!canStandAt(route.points[index])) return false;
    if (index === 0) continue;
    const [x0, z0] = route.points[index - 1];
    const [x1, z1] = route.points[index];
    const distance = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(distance / 1.5));
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      if (!canStandAt([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t])) return false;
    }
  }
  return true;
}

function pointDistance(a, b) {
  return Math.hypot((a?.[0] ?? 0) - (b?.[0] ?? 0), (a?.[1] ?? 0) - (b?.[1] ?? 0));
}

function angleDelta(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function segmentYaw(from, to) {
  return Math.atan2(to[1] - from[1], to[0] - from[0]);
}

function blockerCoversPanel(blocker, panel) {
  const blockerWallSegmentId = blocker.userData?.wallSegmentId ?? blocker.id?.replace(/^V2-WALL-BLOCKER-/, '').replace(/-\d+$/, '');
  if (blockerWallSegmentId !== panel.id) return false;
  const from = [blocker.from?.x, blocker.from?.z];
  const to = [blocker.to?.x, blocker.to?.z];
  if (from.every(Number.isFinite) && to.every(Number.isFinite)) {
    return pointDistance(from, panel.from) <= 0.05 && pointDistance(to, panel.to) <= 0.05;
  }
  const halfThickness = panel.thickness * 0.5;
  const minX = Math.min(panel.from[0], panel.to[0]) - halfThickness;
  const maxX = Math.max(panel.from[0], panel.to[0]) + halfThickness;
  const minZ = Math.min(panel.from[1], panel.to[1]) - halfThickness;
  const maxZ = Math.max(panel.from[1], panel.to[1]) + halfThickness;
  return blocker.minX <= minX + 0.05 && blocker.maxX >= maxX - 0.05 && blocker.minZ <= minZ + 0.05 && blocker.maxZ >= maxZ - 0.05;
}

function validateContinuousCityWallPanels({ cityWallValidation, cityWallSegments, expectedCityWallMaterials }) {
  const panelsById = new Map(cityWallSegments.map((segment) => [segment.id, segment]));
  const nonGateGapTolerance = 0.075;
  cityWallValidation.generatedRuns.forEach((run) => {
    assert.ok(run.panelIds.length > 0, 'Folsom invalid: perimeter segment generated posts without continuous panels.');
    run.panelIds.forEach((panelId, index) => {
      const panel = panelsById.get(panelId);
      assert.ok(panel, `Folsom invalid: wooden perimeter wall has non-gate gap. Missing panel ${panelId}.`);
      assert.ok(expectedCityWallMaterials.has(panel.material), `Folsom invalid: wall panel uses non-wood material: ${panel.material}.`);
      const expectedYaw = segmentYaw(panel.from, panel.to);
      assert.ok(angleDelta(panel.userData?.yaw ?? expectedYaw, expectedYaw) <= 0.01, `Folsom invalid: wall panel yaw is not aligned to perimeter segment. ${panel.id}`);
      if (index === 0) {
        assert.ok(pointDistance(panel.from, run.from) <= nonGateGapTolerance, 'Folsom invalid: wooden perimeter wall has non-gate gap.');
      } else {
        const previous = panelsById.get(run.panelIds[index - 1]);
        assert.ok(pointDistance(previous.to, panel.from) <= nonGateGapTolerance, 'Folsom invalid: wooden perimeter wall has non-gate gap.');
      }
      if (index === run.panelIds.length - 1) {
        assert.ok(pointDistance(panel.to, run.to) <= nonGateGapTolerance, 'Folsom invalid: wooden perimeter wall has non-gate gap.');
      }
    });
  });

  const postPrimitives = folsomDefinition.architecturalPrimitives.filter((primitive) => primitive.tags?.includes('city-border-wall-post'));
  postPrimitives.forEach((post) => {
    const attached = panelsById.get(post.userData?.attachedPanelId);
    assert.ok(attached, 'Folsom invalid: perimeter segment generated posts without continuous panels.');
    const postPoint = [post.position?.[0], post.position?.[2]];
    const attachedToEndpoint = pointDistance(postPoint, attached.from) <= 0.1 || pointDistance(postPoint, attached.to) <= 0.1;
    assert.ok(attachedToEndpoint, 'Folsom invalid: perimeter segment generated posts without continuous panels.');
  });

  const wallBlockers = dungeonCollision.blockerRects.filter((blocker) => blocker.tags?.includes('city-border-wall'));
  cityWallSegments.forEach((panel) => {
    assert.ok(wallBlockers.some((blocker) => blockerCoversPanel(blocker, panel)), `Folsom invalid: wooden wall blocker gap allows player to pass. ${panel.id}`);
  });
}

assert.equal(folsomDefinition.id, 'folsom');
assert.equal(folsomDefinition.displayName, 'Folsom');
assert.equal(resolveStartupArea(null), 'folsom', 'Folsom is the default no-query game root.');
assert.equal(resolveStartupArea('field'), 'field', 'The direct Reliquary Field fallback/dev route remains available.');

const playerSpawns = folsomDefinition.spawns.filter((spawn) => spawn.kind === 'player');
assert.equal(playerSpawns.length, 1, 'Folsom has exactly one player spawn.');
assert.equal(canStandAt([playerSpawns[0].position.x, playerSpawns[0].position.z]), true, 'Folsom player spawn is clear of authored geometry.');

const pond = folsomDefinition.waterBodies.find((body) => body.id === 'folsom_starter_pond');
assert.ok(pond?.fishable, 'Folsom starter pond is fishable.');
assert.ok(pond.fishableRadius > Math.max(...pond.radius), 'Pond fishing interaction reaches the casting bank.');
['smallRiverFish', 'broadCarpFish', 'flatMarshFish', 'spineBackFish'].forEach((species) => {
  assert.ok(pond.fishSpeciesPool.includes(species), `Folsom pond includes ${species}.`);
  assert.ok(FISH_SPECS[species], `Folsom pond species ${species} resolves in the shared Kerovac registry.`);
});
assert.ok(pond.fishSpeciesPool.filter((species) => species === 'spineBackFish').length < pond.fishSpeciesPool.filter((species) => species === 'smallRiverFish').length, 'spineBackFish remains rarer than the most common starter catch.');
assert.deepEqual(validatePondFootprint(pond, folsomDefinition).errors, [], 'Folsom pond footprint and shoreline ordering validate.');
assert.deepEqual(validatePondDecor(pond, folsomDefinition, { assetExists: textureAssetExists }).errors, [], 'Folsom pond decor validates.');
assert.equal(pond.userData?.validation?.avoidsGrassContact, true, 'Generated shoreline prevents water-to-grass contact.');
const pondMarkerLabel = normalizedLabelText(pond.userData?.visibleMarker?.label);
assert.equal(pondMarkerLabel, '', 'Folsom starter pond has no authored visible debug label.');
assert.equal((folsomDefinition.waterBodies ?? []).some((body) => ['undefined', 'null'].includes(normalizedLabelText(body.userData?.visibleMarker?.label))), false, 'Folsom invalid: pond label text resolves to undefined.');
assert.equal(isKnownFolsomCampfireOpenGround([12, -22]), true, 'Folsom campfire invalid: known open ground placement point rejected.');
assert.ok(interactionsSource.includes('ignoreCancelSeconds') && interactionsSource.includes('ignoreStartCancel'), 'Folsom cooking invalid: cooking can immediately cancel from the same input edge that started it.');
const layers = pond.footprint?.layerHeights;
assert.ok(layers && layers.waterFloorY < pond.y && layers.mudBedY > pond.y && layers.outerBankY >= layers.mudBedY, 'Pond layers order floor -> water -> bright mud -> wet bank.');
const [pondX, pondZ] = pond.center;
const pondFloorY = terrainSampler.sampleOutdoorY(pondX, pondZ);
assert.ok(pond.y > pondFloorY && pond.y - pondFloorY < 1.2, 'Pond water is supported by its carved terrain basin.');

const terrainStamps = new Map(folsomDefinition.terrain.heightStamps.map((stamp) => [stamp.id, stamp]));
const sampledRelief = [];
for (let x = -90; x <= 90; x += 10) {
  for (let z = -90; z <= 90; z += 10) sampledRelief.push(terrainSampler.sampleOutdoorY(x, z));
}
const reliefRange = Math.max(...sampledRelief) - Math.min(...sampledRelief);
const interiorRelief = [];
let flatSamples = 0;
let totalInteriorSamples = 0;
const stablePadAvoidZones = [
  { center: [0, 0], radius: 18 }, { center: [-34, -30], radius: 11 }, { center: [-42, 38], radius: 12 },
  { center: [42, -8], radius: 12 }, { center: [42, 42], radius: 11 }, { center: [0, -58], radius: 22 },
];
for (let x = -60; x <= 60; x += 5) {
  for (let z = -65; z <= 70; z += 5) {
    const y = terrainSampler.sampleOutdoorY(x, z);
    interiorRelief.push(y);
    if (stablePadAvoidZones.some((zone) => Math.hypot(x - zone.center[0], z - zone.center[1]) <= zone.radius)) continue;
    totalInteriorSamples += 1;
    if (Math.abs(y - 0.16) <= 0.015 || Math.abs(y) <= 0.015) flatSamples += 1;
  }
}
const interiorHeightRange = Math.max(...interiorRelief) - Math.min(...interiorRelief);
const flatAreaRatio = flatSamples / totalInteriorSamples;
const shrineElevationDelta = terrainSampler.sampleOutdoorY(-42, 38) - terrainSampler.sampleOutdoorY(-42, 18);
const pondLowlandDelta = terrainSampler.sampleOutdoorY(0, -25) - terrainSampler.sampleOutdoorY(0, -56);
const northRoadChannelDelta = Math.min(terrainSampler.sampleOutdoorY(-9, 62), terrainSampler.sampleOutdoorY(9, 62)) - terrainSampler.sampleOutdoorY(1, 62);
const routeSlopes = folsomDefinition.validationRoutes.map((route) => routeMaxSampledSlope(route));
const maxRouteSlope = Math.max(...routeSlopes);
const averageSlope = routeSlopes.reduce((sum, slope) => sum + slope, 0) / routeSlopes.length;
const terrainMetrics = { reliefRange, interiorHeightRange, averageSlope, maxRouteSlope, flatAreaRatio, shrineElevationDelta, pondLowlandDelta, northRoadChannelDelta };
assert.ok(reliefRange >= 2.4, `Folsom invalid: terrain height range is still too small; town still reads flat. Metrics: ${JSON.stringify(terrainMetrics)}`);
assert.ok(reliefRange <= 4.75, `Folsom invalid: terrain relief range exceeds safe starter-town grade. Metrics: ${JSON.stringify(terrainMetrics)}`);
assert.ok(interiorHeightRange >= 1.45, `Folsom invalid: interior terrain relief too low; town still reads flat. Metrics: ${JSON.stringify(terrainMetrics)}`);
assert.ok(flatAreaRatio <= 0.26, `Folsom invalid: too much playable grass area remains exactly flat. Metrics: ${JSON.stringify(terrainMetrics)}`);
['folsom_west_shoulder_hill', 'folsom_east_border_ridge_mass', 'folsom_shrine_knoll', 'folsom_pond_lowland_basin', 'folsom_future_stream_dry_gully', 'folsom_cellar_dug_cut', 'folsom_work_yard_drainage_swale', 'folsom_rusty_door_cut'].forEach((stampId) => {
  assert.ok(terrainStamps.has(stampId), `Folsom terrain relief stamp missing: ${stampId}.`);
});
assert.ok(shrineElevationDelta >= 0.35, `Folsom invalid: shrine knoll elevation below required threshold. Metrics: ${JSON.stringify(terrainMetrics)}`);
assert.ok(pondLowlandDelta >= 0.45, `Folsom invalid: pond lowland is not lower than surrounding town terrain. Metrics: ${JSON.stringify(terrainMetrics)}`);
assert.ok(northRoadChannelDelta >= 0.12, `Folsom invalid: north road/future stream corridor lacks readable channel shaping. Metrics: ${JSON.stringify(terrainMetrics)}`);
const floors = new Map(folsomDefinition.polygonFloors.map((floor) => [floor.id, floor]));
folsomDefinition.structurePads.forEach((pad) => {
  assert.ok(terrainStamps.has(pad.stampId), `${pad.id} has a leveled terrain pad.`);
  assert.ok(floors.has(pad.floorId), `${pad.id} has a visible DARB floor.`);
  const sampledY = terrainSampler.sampleOutdoorY(...pad.center);
  assert.ok(Math.abs(sampledY - floors.get(pad.floorId).y) <= 0.12, `${pad.id} floor is grounded on its OARB pad.`);
});

folsomDefinition.validationRoutes.forEach((route) => {
  assert.equal(routeIsWalkable(route), true, `${route.id} route is walkable from the courtyard.`);
  assert.ok(routeMaxSampledSlope(route) <= 0.18, `Folsom invalid: route from courtyard to ${route.id} exceeds safe slope threshold.`);
});

const approvedBoulderMaterials = new Set(folsomDefinition.validation?.naturalBoulderMaterialPool ?? []);
folsomDefinition.outdoorPrimitives
  .filter((primitive) => primitive.kind === 'boulderCluster')
  .forEach((primitive) => {
    assert.ok(approvedBoulderMaterials.has(primitive.material), `Folsom invalid: field boulder uses block/brick material instead of natural rock material: ${primitive.id}.`);
    const profile = folsomDefinition.textures[primitive.material];
    assert.ok(profile?.path?.startsWith('./assets/textures/rock/'), `Folsom invalid: field boulder uses block/brick material instead of natural rock material: ${primitive.id}.`);
    assert.equal(/brick|block|wall_black_stone|floor|wood/i.test(profile.path), false, `Folsom invalid: field boulder uses block/brick material instead of natural rock material: ${primitive.id}.`);
  });

const validChestItemIds = new Set(Object.keys(equipmentRegistry.items));
const requiredChestItems = new Set(['fishing_rod', 'wood_axe', 'flint_stick', 'torch', 'rusted_sword']);
folsomDefinition.outdoorChests.forEach((chest) => {
  assert.ok(validChestItemIds.has(chest.itemId), `${chest.id} uses a valid item id.`);
  assert.equal(canStandAt([chest.position.x, chest.position.z]), true, `${chest.id} is reachable on walkable ground.`);
  requiredChestItems.delete(chest.itemId);
});
assert.equal(requiredChestItems.size, 0, `Folsom is missing required starter chest items: ${[...requiredChestItems].join(', ')}`);

const underworks = folsomDefinition.outdoorInteractions.find((interaction) => interaction.id === 'folsom_underworks_locked');
assert.ok(underworks && canStandAt([underworks.target.x, underworks.target.z - 2]), 'The locked Folsom Underworks placeholder is reachable.');

const rustyDoor = folsomDefinition.exits.find((exit) => exit.id === 'folsom_rusted_reliquary_door');
assert.ok(rustyDoor, 'Folsom has the mandatory rusted Reliquary door.');
assert.equal(rustyDoor.toLocation, 'reliquary-field');
assert.ok(reliquaryFieldDefinition.spawns.some((spawn) => spawn.id === rustyDoor.destinationSpawnId), 'Rusted door resolves to the current Reliquary Field return spawn.');
assert.ok(reliquaryFieldDefinition.exits.some((exit) => exit.toLocation === 'folsom'), 'Reliquary Field preserves a return route to Folsom.');

const cityWallValidation = folsomDefinition.validation?.cityBorderWoodenWall;
assert.ok(cityWallValidation, 'Folsom invalid: city border wall missing.');
assert.ok(cityWallValidation.height >= 5.9 && cityWallValidation.height <= 6.4, 'Folsom invalid: wooden city wall below required protective height.');
assert.ok(Array.isArray(cityWallValidation.generatedRuns) && cityWallValidation.generatedRuns.length > 0, 'Folsom invalid: city border wall missing generated run coverage metadata.');
const cityWallSegments = folsomDefinition.wallSegments.filter((segment) => segment.tags?.includes('city-border-wall'));
assert.ok(cityWallSegments.length >= 50, 'Folsom invalid: city border wall missing.');
const cityWallMaterials = new Set(cityWallSegments.map((segment) => segment.material));
const expectedCityWallMaterials = new Set(['cityBorderWoodenWall01', 'cityBorderWoodenWall02', 'cityBorderWoodenWall03', 'cityBorderWoodenWall04', 'cityBorderWoodenWall05', 'cityBorderWoodenWall06']);
expectedCityWallMaterials.forEach((materialKey) => {
  assert.ok(cityWallMaterials.has(materialKey), `Folsom invalid: city border wall missing wooden texture variation ${materialKey}.`);
  const profile = folsomDefinition.textures[materialKey];
  assert.ok(profile, `Folsom invalid: city border wall panel uses missing texture key ${materialKey}.`);
  assert.ok(profile.path?.includes('/wall/wooden/city_border_wooden_wall_'), `Folsom invalid: city border wall uses non-wooden texture: ${materialKey}.`);
});
cityWallSegments.forEach((segment) => {
  assert.ok(expectedCityWallMaterials.has(segment.material), `Folsom invalid: city border wall uses non-wooden texture: ${segment.material}.`);
  assert.ok(segment.height >= 5.9, 'Folsom invalid: wooden city wall below required protective height.');
  const midpoint = [(segment.from[0] + segment.to[0]) * 0.5, (segment.from[1] + segment.to[1]) * 0.5];
  const sampledBase = terrainSampler.sampleOutdoorY(midpoint[0], midpoint[1]);
  assert.ok(Math.abs(segment.y - sampledBase) <= 0.75, `Folsom invalid: city border wall panel does not follow terrain: ${segment.id}.`);
});
validateContinuousCityWallPanels({ cityWallValidation, cityWallSegments, expectedCityWallMaterials });
const cityWallLength = cityWallSegments.reduce((sum, segment) => sum + Math.hypot(segment.to[0] - segment.from[0], segment.to[1] - segment.from[1]), 0);
assert.ok(cityWallLength >= 600, 'Folsom invalid: city border wall perimeter is not substantially continuous.');
assert.equal(routeIsWalkable(folsomDefinition.validationRoutes.find((route) => route.id === 'reliquary-door')), true, 'Folsom invalid: rusty Reliquary door is blocked by perimeter wall.');
assert.equal(routeIsWalkable(folsomDefinition.validationRoutes.find((route) => route.id === 'north-road')), true, 'Folsom invalid: north road/future gate opening is blocked by perimeter wall.');
assert.equal(canStandAt([88, 4]), true, 'Folsom invalid: rusty Reliquary door is blocked by perimeter wall.');
assert.equal(canStandAt([0, 94]), true, 'Folsom invalid: north road/future gate opening is blocked by perimeter wall.');
assert.equal(canStandAt([playerSpawns[0].position.x, playerSpawns[0].position.z]), true, 'Folsom invalid: player spawn is outside the protected perimeter or blocked.');

const [terrainWidth, terrainDepth] = folsomDefinition.terrain.size;
const [segmentsX, segmentsZ] = folsomDefinition.terrain.segments;
assert.ok(terrainWidth >= 180 && terrainWidth <= 220 && terrainDepth >= 180 && terrainDepth <= 220, 'Folsom keeps the requested compact town footprint.');
assert.ok(segmentsX <= 72 && segmentsZ <= 72, 'Folsom terrain tessellation remains mobile-safe.');
Object.entries(folsomDefinition.textures).forEach(([key, profile]) => {
  if (profile?.path) assert.equal(textureAssetExists(profile.path), true, `Folsom texture ${key} exists.`);
  (profile?.animatedFrames ?? []).forEach((frame) => assert.equal(textureAssetExists(frame), true, `Folsom animated texture frame exists: ${frame}`));
});

console.log(`Folsom starter town validation passed: non-flat terrain relief, safe pads/routes, pond, chests, natural boulders, legacy door, assets, and mobile budget. Terrain metrics: ${JSON.stringify(terrainMetrics)}`);
