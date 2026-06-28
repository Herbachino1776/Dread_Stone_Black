import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { compileDungeonLocation } from '../src/engine/dungeon-authoring/DungeonCompiler.js';
import { buildDungeonCollision } from '../src/engine/dungeon-authoring/DungeonCollisionBuilder.js';
import { createOutdoorCurvedBlockers } from '../src/engine/outdoor-authoring/OutdoorBlockerBuilder.js';
import { createOutdoorTerrainSampler } from '../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { CollisionWorld } from '../src/game/Collision.js';
import { equipmentRegistry } from '../src/game/equipment/equipmentRegistry.js';
import { FISH_SPECS } from '../src/game/fishing/FishMeshFactory.js';
import { getLocationExitDefinition, resolveStartupArea } from '../src/game/locationRouting.js';
import { listLocationDefinitions } from '../src/game/locations/locationRegistry.js';
import { FOLSOM_PINE_SWATHE_SPECS, FOLSOM_VISIBLE_TREE_BOUNDS, folsomDefinition } from '../src/game/locations/folsom.definition.js';
import { FOLSOM_CEDAR_LIKE_SOURCE_SPRITES, FOLSOM_DARK_GROVE_SOURCE_SPRITES, FOLSOM_UNDERSTORY_SOURCE_SPRITES } from '../src/game/world-kits/vegetation/FolsomFoliageBillboardKit.js';
import { reliquaryFieldDefinition } from '../src/game/locations/reliquaryField.definition.js';
import { createCreatureWorldRuntime } from '../src/game/world-scene/CreatureWorldRuntime.js';
import { validatePondDecor, validatePondFootprint } from './pond-footprint-validation.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const interactionsSource = readFileSync(resolve(repoRoot, 'src/game/Interactions.js'), 'utf8');
const dungeonSceneSource = readFileSync(resolve(repoRoot, 'src/game/DungeonScene.js'), 'utf8');
const outdoorWorldRuntimeSource = readFileSync(resolve(repoRoot, 'src/game/world-scene/OutdoorWorldRuntime.js'), 'utf8');
const folsomFoliageKitSource = readFileSync(resolve(repoRoot, 'src/game/world-kits/vegetation/FolsomFoliageBillboardKit.js'), 'utf8');
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


assert.ok(
  !/update(?:ReliquaryFieldFoliage|OutdoorFoliageBillboards)\s*\([^)]*\)\s*{[^}]*this\.area\s*!==\s*['"]field['"]/s.test(dungeonSceneSource),
  'Folsom invalid: authored foliage billboard updater is field-only and will not rotate Folsom pines.',
);
assert.ok(
  /updateOutdoorFoliageBillboards\(player\)/.test(dungeonSceneSource) && /this\.fieldFoliageBillboards\.push\(\.{3}runtime\.foliageBillboards\)/.test(dungeonSceneSource),
  'Folsom invalid: pine billboards are not registered for per-frame camera-facing rotation.',
);
assert.ok(
  /Math\.atan2\(dx, dz\)/.test(dungeonSceneSource) && /maxBillboardYawOffset/.test(dungeonSceneSource),
  'Folsom invalid: pine billboard yaw jitter can make trees appear paper-thin.',
);
assert.ok(
  /bottomTransparentPaddingRatio/.test(folsomFoliageKitSource) && /visualBaseGroundingOffset/.test(outdoorWorldRuntimeSource),
  'Folsom invalid: pine sprite visual base is not grounded; only mesh origin is grounded.',
);
const intendedFolsomFoliageSourceSprites = new Set([
  ...FOLSOM_DARK_GROVE_SOURCE_SPRITES,
  ...FOLSOM_CEDAR_LIKE_SOURCE_SPRITES,
  ...FOLSOM_UNDERSTORY_SOURCE_SPRITES,
]);

function textureAssetExists(texturePath) {
  if (typeof texturePath !== 'string') return null;
  const publicPath = texturePath.replace(/^\.\//, 'public/');
  return existsSync(resolve(repoRoot, publicPath));
}


function buildFolsomRuntimeCollision(runtime) {
  const [sizeX = 400, sizeZ = 400] = Array.isArray(folsomDefinition.terrain.size) ? folsomDefinition.terrain.size : [];
  const walkableRect = {
    id: 'folsom-terrain-walkable-bounds',
    minX: -sizeX * 0.5,
    maxX: sizeX * 0.5,
    minZ: -sizeZ * 0.5,
    maxZ: sizeZ * 0.5,
  };
  const roomRects = (folsomDefinition.rooms ?? [])
    .filter((room) => [room.minX, room.maxX, room.minZ, room.maxZ].every(Number.isFinite))
    .map((room) => ({ id: room.id, minX: room.minX, maxX: room.maxX, minZ: room.minZ, maxZ: room.maxZ }));
  return new CollisionWorld({
    walkableRects: roomRects.length ? roomRects : [walkableRect],
    blockerRects: [...runtime.blockerRects, ...createOutdoorCurvedBlockers(folsomDefinition.curvedBlockers)],
    playerRadius: 0.5,
    walkableSurfaces: runtime.walkableSurfaces,
    defaultFloorY: folsomDefinition.defaultFloorY ?? folsomDefinition.terrain.baseY ?? 0,
    outdoorTerrainSampler: terrainSampler,
  });
}

function createFolsomCompiledRuntimeForValidation() {
  return compileDungeonLocation(folsomDefinition, {
    logValidation: false,
    materialFactory: () => new THREE.MeshBasicMaterial(),
    torchFactory: () => new THREE.Group(),
  });
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



const folsomCompiledRuntime = createFolsomCompiledRuntimeForValidation();
const folsomRuntimeCollision = buildFolsomRuntimeCollision(folsomCompiledRuntime);
folsomCompiledRuntime.collisionWorld = folsomRuntimeCollision;
const folsomBloodFeudSpawns = folsomCompiledRuntime.spawnAnchors.filter((spawn) => spawn.kind === 'enemy' && spawn.species === 'neck_man' && spawn.tags?.includes('folsom-blood-feud'));
assert.equal(folsomBloodFeudSpawns.length, 3, 'Folsom has exactly 3 folsom-blood-feud Neckman enemy spawns.');
assert.deepEqual(folsomBloodFeudSpawns.map((spawn) => spawn.id).sort(), ['folsom_neckman_feud_01', 'folsom_neckman_feud_02', 'folsom_neckman_feud_03'], 'Folsom blood-feud Neckman spawn ids stay authored.');
folsomBloodFeudSpawns.forEach((spawn) => {
  assert.equal(spawn.allowedForInitialWave, true, `${spawn.id} is allowed for the initial wave.`);
  assert.equal(spawn.allowedForRespawn, true, `${spawn.id} is allowed to respawn.`);
});
const folsomCreatureRuntime = createCreatureWorldRuntime({
  scene: new THREE.Scene(),
  collision: folsomRuntimeCollision,
  area: 'folsom',
  playerSpawn: { spawnPosition: new THREE.Vector3(0, 1.55, 0), spawnYaw: 0 },
  resolveOutdoorVisibleSurfaceY: (x, z) => terrainSampler.sampleOutdoorY(x, z),
});
const resolvedBloodFeudAnchors = folsomBloodFeudSpawns.map((spawn) => folsomCreatureRuntime.createRuntimeEnemyAnchor(spawn, folsomCompiledRuntime));
assert.equal(resolvedBloodFeudAnchors.filter(Boolean).length, 3, 'Folsom blood-feud Neckman positions resolve to safe walkable enemy anchors using runtime collision.');
folsomCreatureRuntime.addCompiledLocationEnemies(folsomCompiledRuntime, { source: 'compiled-outdoor', validateOnly: true });
assert.equal(folsomCreatureRuntime.blackGrassFactionManager?.encounterMode, 'folsom_neckman_blood_feud', 'Folsom blood-feud encounter mode is not skipped.');
assert.equal(folsomCreatureRuntime.blackGrassFactionManager?.enableRespawns, true, 'Folsom blood-feud respawns remain enabled.');
assert.equal(folsomCreatureRuntime.blackGrassFactionManager?.respawnCooldownSeconds, 30, 'Folsom blood-feud respawn cooldown remains 30 seconds.');
assert.equal(folsomCreatureRuntime.bloodFeudSpawnDebug?.collisionAvailable, true, 'Folsom blood-feud validation reached CreatureWorldRuntime with collision available.');
assert.equal(folsomCreatureRuntime.bloodFeudSpawnDebug?.found, 3, 'CreatureWorldRuntime found 3 Folsom blood-feud authored spawns.');
assert.equal(folsomCreatureRuntime.bloodFeudSpawnDebug?.spawned, 3, 'CreatureWorldRuntime produced 3 Folsom blood-feud anchors.');
assert.equal(folsomCreatureRuntime.bloodFeudSpawnDebug?.skipped, 0, 'CreatureWorldRuntime did not skip Folsom blood-feud anchors.');
folsomCreatureRuntime.dispose();

const pineVariants = folsomDefinition.foliageBillboardVariants ?? [];
const pinePlacements = folsomDefinition.foliageBillboards ?? [];
const pineSources = new Set(pineVariants.map((variant) => variant.path));
assert.equal(pineSources.size, intendedFolsomFoliageSourceSprites.size, 'Folsom invalid: foliage source sprite registry count does not match the authored Folsom foliage kit.');
assert.deepEqual(pineSources, intendedFolsomFoliageSourceSprites, 'Folsom invalid: foliage variants must use the authored Folsom foliage source sprite contract.');
assert.equal(pineVariants.length, 50, 'Folsom invalid: expected 50 Folsom foliage billboard variants from the authored layer/source contract.');
pineSources.forEach((path) => assert.equal(textureAssetExists(path), true, `Folsom invalid: pine sprite texture missing: ${path}`));
const minimumVisibleFolsomPineBillboards = 160;
const hardFolsomPineBillboardMax = 520;
const visibleInBoundsPinePlacements = pinePlacements.filter((tree) => {
  const [x, , z] = tree.position ?? [];
  return x >= FOLSOM_VISIBLE_TREE_BOUNDS.minX && x <= FOLSOM_VISIBLE_TREE_BOUNDS.maxX && z >= FOLSOM_VISIBLE_TREE_BOUNDS.minZ && z <= FOLSOM_VISIBLE_TREE_BOUNDS.maxZ;
});
assert.ok(pinePlacements.length <= hardFolsomPineBillboardMax, `Folsom invalid: pine tree count ${pinePlacements.length} exceeds the hard mobile dense-forest budget of ${hardFolsomPineBillboardMax}.`);
assert.ok(visibleInBoundsPinePlacements.length === pinePlacements.length, 'Folsom invalid: pine density count includes off-map placements.');
assert.ok(visibleInBoundsPinePlacements.length >= minimumVisibleFolsomPineBillboards, `Folsom invalid: visible in-bounds pine count below required density. Found ${visibleInBoundsPinePlacements.length}.`);
FOLSOM_PINE_SWATHE_SPECS.forEach((swathe) => {
  const [x, z] = swathe.center;
  assert.ok(x >= -100 && x <= 100 && z >= -100 && z <= 100, `Folsom invalid: pine swathe center outside playable terrain bounds. ${swathe.idPrefix}`);
});
const pineSectorCounts = visibleInBoundsPinePlacements.reduce((counts, tree) => {
  const [x, , z] = tree.position;
  if (x < 0 && z >= 0) counts.NW += 1;
  if (x >= 0 && z >= 0) counts.NE += 1;
  if (x < 0 && z < 0) counts.SW += 1;
  if (x >= 0 && z < 0) counts.SE += 1;
  if (z > 48) counts.N += 1;
  if (z < -48) counts.S += 1;
  if (x > 48) counts.E += 1;
  if (x < -48) counts.W += 1;
  if (Math.abs(x) <= 70 && Math.abs(z) <= 70) counts.insideWallOrNearTown += 1;
  else counts.outerWallButInBounds += 1;
  return counts;
}, { NW: 0, NE: 0, SW: 0, SE: 0, N: 0, S: 0, E: 0, W: 0, insideWallOrNearTown: 0, outerWallButInBounds: 0 });
assert.ok(pineSectorCounts.insideWallOrNearTown >= 50, 'Folsom invalid: inside-wall or near-town pine count below required coverage.');
assert.ok(pineSectorCounts.outerWallButInBounds >= 100, 'Folsom invalid: outer wall pine belt must remain in terrain bounds.');
['NW', 'NE', 'SW', 'SE'].forEach((sector) => assert.ok(pineSectorCounts[sector] >= 24, `Folsom invalid: pine density missing visible sector ${sector}.`));
['N', 'S', 'E', 'W'].forEach((sector) => assert.ok(pineSectorCounts[sector] >= 40, `Folsom invalid: pine density missing visible edge sector ${sector}.`));

const pineVariantIds = new Set(pineVariants.map((variant) => variant.id));
const variantsByLayer = pineVariants.reduce((counts, variant) => ({ ...counts, [variant.layer]: (counts[variant.layer] ?? 0) + 1 }), {});
assert.deepEqual(variantsByLayer, { redwood: 32, cedar: 6, understory: 12 }, 'Folsom invalid: expected 50 Folsom foliage variants split across redwood, cedar, and understory layers.');
const pineAvoidValidationZones = [
  { label: 'player spawn', center: [0, 0], radius: 22 }, { label: 'campfire', center: [12, -22], radius: 8 },
  { label: 'pond water', center: [0, -58], radiusX: 18, radiusZ: 14 }, { label: 'fishing approach', center: [-12, -43], radius: 8 },
  { label: 'tool shed entrance', center: [-36, -34], radius: 8 }, { label: 'house doorway', center: [42, -14], radius: 8 },
  { label: 'shrine entrance', center: [-42, 31], radius: 8 }, { label: 'Underworks entrance', center: [42, 42], radius: 11 },
  { label: 'rusty Reliquary trigger', center: [82, 4], radius: 12 }, { label: 'north future road', center: [0, 94], radius: 13 },
  { label: 'required route clearance', minX: -8, maxX: 8, minZ: 14, maxZ: 99 },
  { label: 'required route clearance', minX: 68, maxX: 94, minZ: -6, maxZ: 14 },
];
function pointInValidationZone([x, z], zone) {
  if (zone.radiusX) return (((x - zone.center[0]) ** 2) / (zone.radiusX ** 2)) + (((z - zone.center[1]) ** 2) / (zone.radiusZ ** 2)) <= 1;
  if (zone.radius) return Math.hypot(x - zone.center[0], z - zone.center[1]) <= zone.radius;
  if (zone.minX !== undefined) return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
  return false;
}
function pineCountWithTag(tag) {
  return pinePlacements.filter((tree) => tree.tags?.includes(tag)).length;
}
pinePlacements.forEach((tree) => {
  assert.ok(pineVariantIds.has(tree.variantId), `Folsom invalid: foliage billboard ${tree.id} does not use the reusable Folsom foliage kit.`);
  assert.equal(textureAssetExists(tree.spritePath), true, `Folsom invalid: pine sprite texture missing: ${tree.spritePath}`);
  assert.ok(tree.tags?.includes('folsom-foliage-billboard'), `Folsom invalid: foliage billboard ${tree.id} is not tagged as reusable Folsom foliage.`);
  assert.ok([...(tree.position ?? []), tree.height, tree.width, tree.sinkIntoGround, tree.bottomTransparentPaddingRatio, tree.yawOffset].every(Number.isFinite), `Folsom invalid: pine tree ${tree.id} has non-finite placement data.`);
  assert.ok(Math.abs(tree.yawOffset) <= (tree.layer === 'understory' ? 0.34 : 0.18), 'Folsom invalid: foliage billboard yaw jitter can make trees appear paper-thin.');
  assert.ok(Number.isFinite(tree.bottomTransparentPaddingRatio), 'Folsom invalid: foliage sprite visual base is not grounded; only mesh origin is grounded.');
  const [x, y, z] = tree.position;
  assert.ok(x >= -100 && x <= 100 && z >= -100 && z <= 100, 'Folsom invalid: pine density count includes off-map placements.');
  assert.ok(Math.abs(x) < 99.5 && Math.abs(z) < 99.5, 'Folsom invalid: pine tree placed where terrain sampler clamps to edge.');
  assert.ok(Math.abs(y - terrainSampler.sampleOutdoorY(x, z)) <= 0.01, 'Folsom invalid: pine billboard base is not grounded to terrain.');
  pineAvoidValidationZones.forEach((zone) => {
    const failure = zone.label === 'pond water'
      ? 'Folsom invalid: pine tree placed on pond water.'
      : zone.label === 'required route clearance'
        ? 'Folsom invalid: pine tree placed inside required route clearance.'
        : `Folsom invalid: pine tree blocks ${zone.label}.`;
    assert.equal(pointInValidationZone([x, z], zone), false, failure);
  });
});
assert.ok(pinePlacements.some((tree) => tree.tags?.includes('outside-wall-forest')), 'Folsom invalid: outside wall pine forest belt missing.');
assert.ok(pinePlacements.some((tree) => tree.tags?.includes('inside-edge-tree-belt')), 'Folsom invalid: inside-edge pine belt missing.');
assert.ok(pinePlacements.some((tree) => tree.tags?.includes('pond-side-rush-brush-cluster')), 'Folsom invalid: pond-side foliage clusters missing.');
assert.ok(pinePlacements.some((tree) => tree.tags?.includes('shrine-grove')), 'Folsom invalid: shrine pine grove missing.');
assert.ok(pinePlacements.some((tree) => tree.tags?.includes('north-road-corridor')), 'Folsom invalid: north road pine corridor missing.');
assert.ok(pinePlacements.some((tree) => tree.tags?.includes('rusty-reliquary-ominous')), 'Folsom invalid: rusty Reliquary pine cluster missing.');
assert.ok(pineCountWithTag('outside-wall-forest') >= 80, 'Folsom invalid: outside wall pine forest belt is below dense swathe minimum.');
assert.ok(pineCountWithTag('inside-edge-tree-belt') >= 20, 'Folsom invalid: inside town pine pockets are below required coverage.');
assert.ok(pineCountWithTag('pond-side-rush-brush-cluster') >= 12, 'Folsom invalid: pond-side foliage coverage is below required coverage.');
assert.ok(pineCountWithTag('shrine-grove') >= 16, 'Folsom invalid: shrine grove is below required old-foliage coverage.');
assert.ok(pineCountWithTag('north-road-corridor') >= 18, 'Folsom invalid: north road corridor foliage coverage is below required coverage.');
assert.ok(pineCountWithTag('rusty-reliquary-ominous') >= 10, 'Folsom invalid: rusty Reliquary ominous pine cluster is below required coverage.');

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
  assert.equal(chest.bodyMaterial, 'agedWood', `${chest.id} uses aged wood chest body material.`);
  assert.equal(chest.strapMaterial, 'rustedIron', `${chest.id} uses rusted iron strap material.`);
  assert.ok(textureAssetExists(folsomDefinition.textures[chest.bodyMaterial]?.path), `${chest.id} wood chest texture exists.`);
  assert.ok(textureAssetExists(folsomDefinition.textures[chest.strapMaterial]?.path), `${chest.id} rusted metal strap texture exists.`);
  assert.ok(Math.abs((chest.position.y ?? 0) - terrainSampler.sampleOutdoorY(chest.position.x, chest.position.z)) <= 0.22, 'Folsom invalid: outdoor chest is floating above terrain.');
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

const locationDefinitions = await listLocationDefinitions();
const definitionsById = new Map(locationDefinitions.map((definition) => [definition.id, definition]));
assert.ok(definitionsById.has(resolveStartupArea(null)), 'Folsom startup route resolves to a known location definition.');
for (const definition of locationDefinitions) {
  for (const exit of definition.exits ?? []) {
    const targetDefinition = definitionsById.get(exit.toLocation);
    assert.ok(targetDefinition, `${definition.id} exit ${exit.id} targets known location ${exit.toLocation}.`);
    assert.ok(targetDefinition.spawns?.some((spawn) => spawn.id === exit.destinationSpawnId), `${definition.id} exit ${exit.id} destination spawn ${exit.destinationSpawnId} exists in ${exit.toLocation}.`);
  }
}
['folsom', 'black-grass-temple', 'kerovac', 'oarbFeatureYard', 'oarbOutdoorExpo'].forEach((locationId) => {
  const definition = definitionsById.get(locationId);
  const returnExit = getLocationExitDefinition(definition, { toLocation: 'reliquary-field' });
  assert.ok(returnExit?.destinationSpawnId, `${locationId} declares an authored return exit to Reliquary Field.`);
  assert.ok(reliquaryFieldDefinition.spawns.some((spawn) => spawn.id === returnExit.destinationSpawnId), `${locationId} return exit lands on a real Reliquary Field return spawn.`);
});
assert.equal(getLocationExitDefinition(reliquaryFieldDefinition, { toLocation: 'folsom' })?.destinationSpawnId, 'folsom_reliquary_return', 'Reliquary Field return to Folsom lands at the authored Folsom return anchor.');
assert.equal(getLocationExitDefinition(reliquaryFieldDefinition, { toLocation: 'kerovac' })?.destinationSpawnId, 'kerovac_player_start', 'Reliquary Field Kerovac route lands at Kerovac player start.');
assert.equal(getLocationExitDefinition(reliquaryFieldDefinition, { toLocation: 'oarbOutdoorExpo' })?.destinationSpawnId, 'oarb_outdoor_expo_player_start', 'Reliquary Field OARB Outdoor Expo route lands at the authored player start.');

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
