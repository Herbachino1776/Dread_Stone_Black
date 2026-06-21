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
const floors = new Map(folsomDefinition.polygonFloors.map((floor) => [floor.id, floor]));
folsomDefinition.structurePads.forEach((pad) => {
  assert.ok(terrainStamps.has(pad.stampId), `${pad.id} has a leveled terrain pad.`);
  assert.ok(floors.has(pad.floorId), `${pad.id} has a visible DARB floor.`);
  const sampledY = terrainSampler.sampleOutdoorY(...pad.center);
  assert.ok(Math.abs(sampledY - floors.get(pad.floorId).y) <= 0.12, `${pad.id} floor is grounded on its OARB pad.`);
});

folsomDefinition.validationRoutes.forEach((route) => assert.equal(routeIsWalkable(route), true, `${route.id} route is walkable from the courtyard.`));

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

const [terrainWidth, terrainDepth] = folsomDefinition.terrain.size;
const [segmentsX, segmentsZ] = folsomDefinition.terrain.segments;
assert.ok(terrainWidth >= 180 && terrainWidth <= 220 && terrainDepth >= 180 && terrainDepth <= 220, 'Folsom keeps the requested compact town footprint.');
assert.ok(segmentsX <= 72 && segmentsZ <= 72, 'Folsom terrain tessellation remains mobile-safe.');
Object.entries(folsomDefinition.textures).forEach(([key, profile]) => {
  if (profile?.path) assert.equal(textureAssetExists(profile.path), true, `Folsom texture ${key} exists.`);
  (profile?.animatedFrames ?? []).forEach((frame) => assert.equal(textureAssetExists(frame), true, `Folsom animated texture frame exists: ${frame}`));
});

console.log('Folsom starter town validation passed: spawn, mixed OARB+DARB grounding, pond, routes, chests, legacy door, assets, and mobile budget.');
