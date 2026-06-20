import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDungeonCollision } from '../src/engine/dungeon-authoring/DungeonCollisionBuilder.js';
import { validateDungeonDefinition } from '../src/engine/dungeon-authoring/DungeonValidation.js';
import { validateDungeonIntegrity } from '../src/engine/dungeon-authoring/integrity/DungeonIntegrityValidator.js';
import { formatIntegrityIssue } from '../src/engine/dungeon-authoring/integrity/DungeonIntegrityReport.js';
import { buildLightObjectRegistry } from '../src/engine/lighting/LightObjectRegistry.js';
import { validateTorchPlacements } from '../src/engine/lighting/TorchPlacementValidator.js';
import { listLocationDefinitions } from '../src/game/locations/locationRegistry.js';
import { resolveStartupArea } from '../src/game/locationRouting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function resolvePublicTexturePath(texturePath) {
  if (typeof texturePath !== 'string') return null;
  if (texturePath.startsWith('./assets/')) return path.join(repoRoot, 'public', texturePath.slice(2));
  if (texturePath.startsWith('/assets/')) return path.join(repoRoot, 'public', texturePath);
  return null;
}

function textureAssetExists(texturePath) {
  const resolved = resolvePublicTexturePath(texturePath);
  return resolved ? fs.existsSync(resolved) : null;
}

const definitions = listLocationDefinitions();
const spawnIdsByLocation = new Map(definitions.map((definition) => [
  definition.id,
  new Set((definition.spawns ?? []).map((spawn) => spawn.id)),
]));

function destinationSpawnIdsFor(definition) {
  return new Set((definition.exits ?? [])
    .filter((exit) => exit.toLocation && exit.toLocation !== definition.id)
    .flatMap((exit) => [...(spawnIdsByLocation.get(exit.toLocation) ?? [])]));
}


function isFinitePosition(position) {
  return position && Number.isFinite(position.x) && Number.isFinite(position.y ?? 0) && Number.isFinite(position.z);
}

function pointInRect(position, rect, margin = 0) {
  return position.x >= rect.minX - margin
    && position.x <= rect.maxX + margin
    && position.z >= rect.minZ - margin
    && position.z <= rect.maxZ + margin;
}

function rectsOverlap(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

function rectClearance(position, rect) {
  if (pointInRect(position, rect)) return 0;
  const dx = position.x < rect.minX ? rect.minX - position.x : position.x > rect.maxX ? position.x - rect.maxX : 0;
  const dz = position.z < rect.minZ ? rect.minZ - position.z : position.z > rect.maxZ ? position.z - rect.maxZ : 0;
  return Math.hypot(dx, dz);
}

function allowsExitOverlap(a, b) {
  return a.userData?.allowTriggerOverlapWith?.includes?.(b.id)
    || b.userData?.allowTriggerOverlapWith?.includes?.(a.id);
}


function validateStartupRouting(definitions) {
  const errors = [];
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const expectArea = (requestedArea, expectedArea) => {
    const actualArea = resolveStartupArea(requestedArea);
    if (actualArea !== expectedArea) {
      errors.push(`requested area ${requestedArea ?? '<none>'} resolved to ${actualArea}; expected ${expectedArea}`);
    }
  };

  expectArea(null, 'field');
  expectArea('', 'field');
  expectArea('field', 'field');
  expectArea('reliquary-field', 'field');
  expectArea('kerovac', 'kerovac');
  expectArea('oarbFeatureYard', 'oarbFeatureYard');
  expectArea('not-a-real-area', 'field');

  const compiledRuntimeIds = definitions
    .filter((definition) => definition.tags?.includes('compiled-runtime'))
    .map((definition) => definition.id);
  compiledRuntimeIds.forEach((id) => expectArea(id, id));

  const requireReturnToField = (fromLocation, exitId) => {
    const exit = byId.get(fromLocation)?.exits?.find((candidate) => candidate.id === exitId);
    if (!exit) {
      errors.push(`${fromLocation}.${exitId} is missing`);
      return;
    }
    if (exit.toLocation !== 'reliquary-field') {
      errors.push(`${fromLocation}.${exitId} returns to ${exit.toLocation}; expected reliquary-field`);
    }
    if (!byId.get('reliquary-field')?.spawns?.some((spawn) => spawn.id === exit.destinationSpawnId)) {
      errors.push(`${fromLocation}.${exitId} targets missing Reliquary Field spawn ${exit.destinationSpawnId}`);
    }
  };

  requireReturnToField('kerovac', 'kerovac_exit_to_reliquary_field');
  requireReturnToField('oarbFeatureYard', 'oarb_feature_yard_return_gate');

  return errors;
}

function validateTransitionSafety(definitions) {
  const errors = [];
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));

  definitions.forEach((definition) => {
    (definition.exits ?? []).forEach((exit) => {
      const target = byId.get(exit.toLocation);
      if (!target) {
        errors.push(`${definition.id}.${exit.id} targets missing location ${exit.toLocation}`);
        return;
      }
      const destinationSpawn = (target.spawns ?? []).find((spawn) => spawn.id === exit.destinationSpawnId);
      if (!destinationSpawn) {
        errors.push(`${definition.id}.${exit.id} references missing destinationSpawnId ${exit.destinationSpawnId} in ${target.id}`);
        return;
      }
      if (!isFinitePosition(destinationSpawn.position)) {
        errors.push(`${target.id}.${destinationSpawn.id} destination position is not finite`);
      }
      if (target.type === 'field') {
        (target.exits ?? []).forEach((fieldExit) => {
          if (fieldExit.triggerRect && pointInRect(destinationSpawn.position, fieldExit.triggerRect)) {
            errors.push(`${definition.id}.${exit.id} returns to ${target.id}.${destinationSpawn.id} inside ${fieldExit.id}.triggerRect`);
          }
        });
      }
    });

    if (definition.type === 'field') {
      const exits = (definition.exits ?? []).filter((exit) => exit.triggerRect);
      exits.forEach((exit, index) => {
        exits.slice(index + 1).forEach((other) => {
          if (rectsOverlap(exit.triggerRect, other.triggerRect) && !allowsExitOverlap(exit, other)) {
            errors.push(`${definition.id} exit triggerRects overlap: ${exit.id} and ${other.id}`);
          }
        });
      });

      exits.forEach((exit) => {
        const returnSpawnId = exit.userData?.returnSpawnId;
        const safetyMargin = exit.userData?.returnSpawnSafetyMargin;
        if (!returnSpawnId || !Number.isFinite(safetyMargin)) return;
        const returnSpawn = (definition.spawns ?? []).find((spawn) => spawn.id === returnSpawnId);
        if (!returnSpawn) {
          errors.push(`${definition.id}.${exit.id} references missing returnSpawnId ${returnSpawnId}`);
          return;
        }
        const clearance = rectClearance(returnSpawn.position, exit.triggerRect);
        if (clearance < safetyMargin) {
          errors.push(`${definition.id}.${returnSpawn.id} is ${clearance.toFixed(2)} units from ${exit.id}.triggerRect; expected at least ${safetyMargin}`);
        }
      });
    }
  });

  const reliquaryField = byId.get('reliquary-field');
  const criticalReturnSpawns = ['field_kerovac_return', 'field_oarb_feature_yard_return'];
  const criticalFieldExits = ['field_enter_kerovac', 'oarb_feature_yard_gate'];
  criticalReturnSpawns.forEach((spawnId) => {
    const spawn = reliquaryField?.spawns?.find((candidate) => candidate.id === spawnId);
    criticalFieldExits.forEach((exitId) => {
      const exit = reliquaryField?.exits?.find((candidate) => candidate.id === exitId);
      if (!spawn || !exit) {
        errors.push(`missing critical Reliquary Field transition ${spawnId} or ${exitId}`);
      } else if (pointInRect(spawn.position, exit.triggerRect, 6)) {
        errors.push(`${spawnId} is inside the 6-unit safety buffer for ${exitId}`);
      }
    });
  });

  return errors;
}

function validateReliquaryFieldStartupRuntime(definitions) {
  const errors = [];
  const field = definitions.find((definition) => definition.id === 'reliquary-field');
  if (!field) return ['Reliquary Field definition is missing'];
  if (field.type !== 'field') errors.push(`Reliquary Field type is ${field.type}; expected field`);

  const playerSpawn = (field.spawns ?? []).find((spawn) => spawn.id === 'field_player_start' && spawn.kind === 'player');
  if (!isFinitePosition(playerSpawn?.position)) errors.push('field_player_start is missing or not finite');

  const terrain = field.terrain;
  const [terrainSizeX, terrainSizeZ] = Array.isArray(terrain?.size) ? terrain.size : [];
  const [terrainSegmentsX, terrainSegmentsZ] = Array.isArray(terrain?.segments) ? terrain.segments : [];
  if (!terrain || !Number.isFinite(terrainSizeX) || !Number.isFinite(terrainSizeZ) || !Number.isInteger(terrainSegmentsX) || !Number.isInteger(terrainSegmentsZ)) {
    errors.push('Reliquary Field terrain setup is missing finite size/segment values');
  }
  const terrainMaterialKey = terrain?.material;
  if (!terrainMaterialKey || !field.textures?.[terrainMaterialKey]) {
    errors.push(`Reliquary Field terrain material ${terrainMaterialKey ?? '<none>'} is not defined in textures`);
  }

  const runtimeReturnSpawns = new Map([
    ['FIELD_CRYPT_A_RETURN_START', 'field_south_reliquary_crypt_return'],
    ['FIELD_BLACK_GRASS_TEMPLE_RETURN_START', 'field_black_grass_temple_return'],
    ['FIELD_KEEPER_HOUSE_RETURN_START', 'field_keeper_house_return'],
    ['FIELD_DDPLUS_LEVEL1_RETURN_START', 'field_ddplus_level_1_return'],
    ['FIELD_SUMERIAN_CITY_BLOCK_V0_RETURN_START', 'field_sumerian_city_block_v0_return'],
    ['FIELD_SUMERIAN_SUN_PALACE_DISTRICT_V1_RETURN_START', 'field_sumerian_sun_palace_district_v1_return'],
    ['FIELD_SUMERIAN_CANAL_MARKET_DISTRICT_V2_RETURN_START', 'field_sumerian_canal_market_district_v2_return'],
    ['FIELD_BALTHAZAN_RETURN_START', 'field_balthazan_return'],
    ['FIELD_KEROVAC_RETURN_START', 'field_kerovac_return'],
    ['FIELD_OARB_FEATURE_YARD_RETURN_START', 'field_oarb_feature_yard_return'],
  ]);
  const dungeonSceneSource = fs.readFileSync(path.join(repoRoot, 'src/game/DungeonScene.js'), 'utf8');
  runtimeReturnSpawns.forEach((spawnId, constantName) => {
    const spawn = (field.spawns ?? []).find((candidate) => candidate.id === spawnId);
    if (!isFinitePosition(spawn?.position)) {
      errors.push(`${spawnId} is missing or not finite`);
      return;
    }
    const expectedVector = `const ${constantName} = new THREE.Vector3(${spawn.position.x}, ${spawn.position.y}, ${spawn.position.z});`;
    if (!dungeonSceneSource.includes(expectedVector)) {
      errors.push(`${constantName} does not match authored ${spawnId} position (${spawn.position.x}, ${spawn.position.y}, ${spawn.position.z})`);
    }
  });

  return errors;
}

const targets = definitions
  .filter((definition) => definition.type !== 'field' || definition.integrity?.facades?.length)
  .map((definition) => ({
    label: definition.type === 'field' ? `${definition.displayName} exterior facades` : definition.displayName,
    definition,
  }));

let totalErrors = 0;
let totalWarnings = 0;
const startupRoutingErrors = validateStartupRouting(definitions);
const transitionSafetyErrors = validateTransitionSafety(definitions);
const reliquaryFieldStartupErrors = validateReliquaryFieldStartupRuntime(definitions);
totalErrors += startupRoutingErrors.length + transitionSafetyErrors.length + reliquaryFieldStartupErrors.length;

console.log('Dungeon integrity validation');
if (startupRoutingErrors.length) {
  console.log('\nStartup routing');
  startupRoutingErrors.forEach((error) => console.log(`- error: ${error}`));
}
if (transitionSafetyErrors.length) {
  console.log('\nTransition safety');
  transitionSafetyErrors.forEach((error) => console.log(`- error: ${error}`));
}
if (reliquaryFieldStartupErrors.length) {
  console.log('\nReliquary Field startup runtime');
  reliquaryFieldStartupErrors.forEach((error) => console.log(`- error: ${error}`));
}

targets.forEach(({ label, definition }) => {
  const baseReport = validateDungeonDefinition(definition, { destinationSpawnIds: destinationSpawnIdsFor(definition), textureAssetExists });
  const integrityReport = validateDungeonIntegrity(definition);
  const lightRegistry = buildLightObjectRegistry(definition);
  const torchReport = validateTorchPlacements(definition, lightRegistry.torchFixtures);
  const collision = buildDungeonCollision(definition);
  const compiledWallBlockers = collision.blockerRects.filter((blocker) => blocker.tags?.includes('compiled-wall'));

  const errors = [...baseReport.errors, ...integrityReport.errors, ...torchReport.errors];
  const warnings = [...baseReport.warnings, ...integrityReport.warnings, ...torchReport.warnings];
  totalErrors += errors.length;
  totalWarnings += warnings.length;

  console.log(`\n${label}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Info: ${integrityReport.infos.length}`);
  console.log(`Wall segments: ${integrityReport.debug.wallSegments.length}`);
  console.log(`Declared openings: ${integrityReport.debug.openings.length}`);
  console.log(`Facades: ${integrityReport.debug.facades.length}`);
  console.log(`Compiled wall blockers: ${compiledWallBlockers.length}`);
  console.log(`Torch fixtures: ${lightRegistry.torchFixtures.length}`);

  [...errors, ...warnings].forEach((issue) => {
    const formatted = issue.source ? formatIntegrityIssue(issue) : `${issue.severity ?? 'issue'}: ${issue.id ? `${issue.id}: ` : ''}${issue.message}`;
    console.log(`- ${formatted}`);
    if (issue.suggestedFix) console.log(`  suggested fix: ${issue.suggestedFix}`);
  });
});

console.log(`\nTotal integrity errors: ${totalErrors}`);
console.log(`Total integrity warnings: ${totalWarnings}`);

if (totalErrors) {
  process.exitCode = 1;
}
