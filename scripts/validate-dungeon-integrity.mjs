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
import { resolveFieldPlayerSpawn } from '../src/game/fieldSpawnResolution.js';
import { resolveStartupArea } from '../src/game/locationRouting.js';
import { validatePondDecor, validatePondFootprint } from './pond-footprint-validation.mjs';

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

const definitions = await listLocationDefinitions();
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


function isFiniteVector3(value) {
  return value
    && value.isVector3 === true
    && Number.isFinite(value.x)
    && Number.isFinite(value.y)
    && Number.isFinite(value.z);
}

function validateFieldSpawnResolution() {
  const errors = [];
  const dungeonSceneSource = fs.readFileSync(path.join(repoRoot, 'src/game/DungeonScene.js'), 'utf8');
  const hasToVector3Calls = dungeonSceneSource.includes('this.toVector3(');
  if (hasToVector3Calls && !/toVector3\s*\([^)]*\)\s*\{/.test(dungeonSceneSource)) {
    errors.push('DungeonScene contains this.toVector3 calls, but no toVector3 prototype method is defined');
  }
  const getFieldPlayerSpawnIndex = dungeonSceneSource.indexOf('getFieldPlayerSpawn() {');
  const buildMethodIndex = dungeonSceneSource.indexOf('\n  build() {', getFieldPlayerSpawnIndex);
  const getFieldPlayerSpawnSource = getFieldPlayerSpawnIndex >= 0 && buildMethodIndex > getFieldPlayerSpawnIndex
    ? dungeonSceneSource.slice(getFieldPlayerSpawnIndex, buildMethodIndex)
    : '';
  if (!getFieldPlayerSpawnSource) {
    errors.push('DungeonScene.getFieldPlayerSpawn could not be found for validation');
  } else if (getFieldPlayerSpawnSource.includes('this.toVector3(')) {
    errors.push('getFieldPlayerSpawn calls this.toVector3; use the local authored position resolver instead');
  }

  ['start', 'kerovacExit', 'oarbFeatureYardExit'].forEach((fieldSpawn) => {
    try {
      const result = resolveFieldPlayerSpawn(fieldSpawn, { logger: { error() {} } });
      if (!isFiniteVector3(result?.spawnPosition)) {
        errors.push(`getFieldPlayerSpawn(${fieldSpawn}) did not return a finite THREE.Vector3 spawnPosition`);
      }
      if (!Number.isFinite(result?.spawnYaw)) {
        errors.push(`getFieldPlayerSpawn(${fieldSpawn}) did not return a finite spawnYaw`);
      }
    } catch (error) {
      errors.push(`getFieldPlayerSpawn(${fieldSpawn}) threw ${error?.name ?? 'Error'}: ${error?.message ?? error}`);
    }
  });

  return errors;
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

  expectArea(null, 'folsom');
  expectArea('', 'folsom');
  expectArea('field', 'field');
  expectArea('reliquary-field', 'field');
  expectArea('kerovac', 'kerovac');
  expectArea('oarbFeatureYard', 'oarbFeatureYard');
  expectArea('not-a-real-area', 'folsom');

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
  const oarbGate = reliquaryField?.exits?.find((candidate) => candidate.id === 'oarb_feature_yard_gate');
  const kerovacGate = reliquaryField?.exits?.find((candidate) => candidate.id === 'field_enter_kerovac');
  if (!oarbGate || !kerovacGate) {
    errors.push('missing OARB Proving Grounds or Kerovac field gate for dedicated overlap validation');
  } else if (rectsOverlap(oarbGate.triggerRect, kerovacGate.triggerRect)) {
    errors.push('oarb_feature_yard_gate triggerRect overlaps field_enter_kerovac triggerRect');
  }
  if (oarbGate && !oarbGate.userData?.visibleMarker && !oarbGate.userData?.authoredPlacementMetadata) {
    errors.push('oarb_feature_yard_gate needs a visibleMarker or authoredPlacementMetadata entry for discoverability');
  }

  const oarbReturnSpawn = reliquaryField?.spawns?.find((candidate) => candidate.id === 'field_oarb_feature_yard_return');
  if (!oarbReturnSpawn) {
    errors.push('field_oarb_feature_yard_return is missing');
  } else {
    (reliquaryField?.exits ?? []).forEach((fieldExit) => {
      if (fieldExit.triggerRect && pointInRect(oarbReturnSpawn.position, fieldExit.triggerRect)) {
        errors.push(`field_oarb_feature_yard_return lands inside ${fieldExit.id}.triggerRect`);
      }
    });
  }

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

function validateCompiledOutdoorFieldRuntime(definitions) {
  const errors = [];
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const dungeonSceneSource = fs.readFileSync(path.join(repoRoot, 'src/game/DungeonScene.js'), 'utf8');
  const requiredRuntimeSnippets = [
    'isCompiledOutdoorFieldArea()',
    'buildCompiledOutdoorField()',
    'configureCompiledOutdoorFieldRuntime',
    'addOutdoorTerrain(definition.terrain, definition.textures, definition)',
    'createOutdoorCurvedBlockers(definition.curvedBlockers)',
    'addCompiledOutdoorExitCues(definition)',
  ];
  requiredRuntimeSnippets.forEach((snippet) => {
    if (!dungeonSceneSource.includes(snippet)) {
      errors.push(`DungeonScene compiled outdoor field runtime is missing ${snippet}`);
    }
  });

  const oarb = byId.get('oarbFeatureYard');
  if (!oarb) return ['oarbFeatureYard definition is missing'];
  if (oarb.type !== 'field') errors.push(`oarbFeatureYard type is ${oarb.type}; expected field`);
  if (!oarb.tags?.includes('compiled-runtime')) errors.push('oarbFeatureYard must remain tagged compiled-runtime');

  const terrain = oarb.terrain;
  const [sizeX, sizeZ] = Array.isArray(terrain?.size) ? terrain.size : [];
  if (!terrain || !Number.isFinite(sizeX) || !Number.isFinite(sizeZ)) {
    errors.push('oarbFeatureYard terrain is missing finite bounds');
  }
  const terrainMaterialKey = terrain?.material;
  const terrainMaterial = terrainMaterialKey ? oarb.textures?.[terrainMaterialKey] : null;
  if (!terrainMaterial) {
    errors.push(`oarbFeatureYard terrain material ${terrainMaterialKey ?? '<none>'} is not defined in textures`);
  } else if (textureAssetExists(terrainMaterial.path) === false) {
    errors.push(`oarbFeatureYard terrain texture asset is missing: ${terrainMaterial.path}`);
  }

  const playerSpawn = (oarb.spawns ?? []).find((spawn) => spawn.id === 'oarb_feature_yard_player_start' && spawn.kind === 'player');
  if (!isFinitePosition(playerSpawn?.position)) {
    errors.push('oarb_feature_yard_player_start is missing or not finite');
  } else if (terrain && !pointInRect(playerSpawn.position, { minX: -sizeX * 0.5, maxX: sizeX * 0.5, minZ: -sizeZ * 0.5, maxZ: sizeZ * 0.5 })) {
    errors.push('oarb_feature_yard_player_start is outside terrain bounds');
  }

  const visiblePrimitive = (oarb.outdoorPrimitives ?? []).find((primitive) => primitive && primitive.id && primitive.tags?.includes('visible-boundary'));
  if (!visiblePrimitive) errors.push('oarbFeatureYard needs at least one visible outdoor primitive');

  const returnGate = (oarb.exits ?? []).find((exit) => exit.id === 'oarb_feature_yard_return_gate');
  if (!returnGate) {
    errors.push('oarb_feature_yard_return_gate is missing');
  } else {
    const target = byId.get(returnGate.toLocation);
    if (!target) errors.push(`oarb_feature_yard_return_gate targets missing ${returnGate.toLocation}`);
    if (!target?.spawns?.some((spawn) => spawn.id === returnGate.destinationSpawnId)) {
      errors.push(`oarb_feature_yard_return_gate destination spawn ${returnGate.destinationSpawnId} does not resolve`);
    }
  }


  const expo = byId.get('oarbOutdoorExpo');
  if (!expo) {
    errors.push('oarbOutdoorExpo definition is missing');
    return errors;
  }
  if (expo.type !== 'field') errors.push(`oarbOutdoorExpo type is ${expo.type}; expected field`);
  if (!expo.tags?.includes('compiled-runtime')) errors.push('oarbOutdoorExpo must be tagged compiled-runtime');
  const expoTerrain = expo.terrain;
  const [expoSizeX, expoSizeZ] = Array.isArray(expoTerrain?.size) ? expoTerrain.size : [];
  if (!expoTerrain || !Number.isFinite(expoSizeX) || !Number.isFinite(expoSizeZ)) errors.push('oarbOutdoorExpo terrain is missing finite bounds');
  for (const [key, profile] of Object.entries(expo.textures ?? {})) {
    if (textureAssetExists(profile?.path) === false) errors.push(`oarbOutdoorExpo texture asset is missing for ${key}: ${profile.path}`);
  }
  const expoPlayerSpawn = (expo.spawns ?? []).find((spawn) => spawn.id === 'oarb_outdoor_expo_player_start' && spawn.kind === 'player');
  if (!isFinitePosition(expoPlayerSpawn?.position)) {
    errors.push('oarb_outdoor_expo_player_start is missing or not finite');
  } else if (expoTerrain && !pointInRect(expoPlayerSpawn.position, { minX: -expoSizeX * 0.5, maxX: expoSizeX * 0.5, minZ: -expoSizeZ * 0.5, maxZ: expoSizeZ * 0.5 })) {
    errors.push('oarb_outdoor_expo_player_start is outside terrain bounds');
  }
  const expoEntry = byId.get('reliquary-field')?.exits?.find((exit) => exit.id === 'oarb_outdoor_expo_gate');
  if (!expoEntry) {
    errors.push('oarb_outdoor_expo_gate is missing from Reliquary Field');
  } else {
    const target = byId.get(expoEntry.toLocation);
    if (!target) errors.push(`oarb_outdoor_expo_gate target location ${expoEntry.toLocation} does not resolve`);
    if (!expo.spawns?.some((spawn) => spawn.id === expoEntry.destinationSpawnId)) errors.push(`oarb_outdoor_expo_gate destination spawn ${expoEntry.destinationSpawnId} does not resolve`);
    if (!expoEntry.userData?.visibleMarker?.ids?.length) errors.push('oarb_outdoor_expo_gate needs visible marker metadata');
    const expoFieldReturn = byId.get('reliquary-field')?.spawns?.find((spawn) => spawn.id === expoEntry.userData?.returnSpawnId);
    if (!isFinitePosition(expoFieldReturn?.position)) errors.push(`oarb_outdoor_expo_gate return spawn ${expoEntry.userData?.returnSpawnId ?? '<none>'} does not resolve`);
    else if (pointInRect(expoFieldReturn.position, expoEntry.triggerRect)) errors.push(`${expoFieldReturn.id} lands inside oarb_outdoor_expo_gate.triggerRect`);
    const runtimeSnippets = [
      'OARB_OUTDOOR_EXPO_INT_ENTER',
      "area: 'oarbOutdoorExpo'",
      "type: 'areaEntrance'",
      "hint: 'X: Enter OARB Outdoor Expo Center'",
      'OARB_OUTDOOR_EXPO_INTERACT_RANGE = 7.0',
      "debugGateId: 'oarb_outdoor_expo_gate'",
      "targetSpawnId: 'oarb_outdoor_expo_player_start'",
      'visibleMarkerPosition',
    ];
    runtimeSnippets.forEach((snippet) => {
      if (!dungeonSceneSource.includes(snippet)) errors.push(`oarb_outdoor_expo_gate runtime interaction is missing ${snippet}`);
    });
  }
  const expoReturn = (expo.exits ?? []).find((exit) => exit.id === 'oarb_outdoor_expo_return_gate');
  if (!expoReturn) errors.push('oarb_outdoor_expo_return_gate is missing');
  else if (!byId.get(expoReturn.toLocation)?.spawns?.some((spawn) => spawn.id === expoReturn.destinationSpawnId)) errors.push(`oarb_outdoor_expo_return_gate destination spawn ${expoReturn.destinationSpawnId} does not resolve`);
  const pondReserve = (expo.rooms ?? []).find((room) => room.tags?.includes('pond-expo') && room.tags?.includes('water-garden'));
  if (!pondReserve?.userData?.pondExpoWing) errors.push('oarbOutdoorExpo Pond Expo / Water Garden wing room metadata is missing');
  const expectedPondIds = ['POND 01', 'POND 02', 'POND 03', 'POND 04', 'POND 05', 'POND 06', 'POND 07', 'POND 08'];
  const waterBodies = expo.waterBodies ?? [];
  if (waterBodies.length !== expectedPondIds.length) errors.push('oarbOutdoorExpo must author exactly 8 Pond Expo water bodies');
  const authoredPondIds = new Set(waterBodies.map((body) => body.userData?.pondExpoId));
  expectedPondIds.forEach((pondExpoId) => {
    if (!authoredPondIds.has(pondExpoId)) errors.push(`oarbOutdoorExpo missing ${pondExpoId} metadata`);
  });
  const pondMarkerIds = new Set((expo.outdoorPrimitives ?? []).filter((primitive) => primitive.tags?.includes('pond-expo-marker')).map((primitive) => primitive.id));
  waterBodies.forEach((body) => {
    const marker = body.userData?.visibleMarker;
    if (!marker?.id || !marker?.label) errors.push(`oarbOutdoorExpo ${body.id} is missing visible marker metadata`);
    else if (!pondMarkerIds.has(marker.id)) errors.push(`oarbOutdoorExpo ${body.id} visible marker ${marker.id} does not resolve`);
    if (!expo.textures?.[body.material]) errors.push(`oarbOutdoorExpo ${body.id} water material ${body.material} is missing`);
    if (!expo.textures?.[body.shoreMaterial]) errors.push(`oarbOutdoorExpo ${body.id} shore material ${body.shoreMaterial} is missing`);
    if (!expo.textures?.[body.bedMaterial]) errors.push(`oarbOutdoorExpo ${body.id} bright mud material ${body.bedMaterial} is missing`);
    if (body.userData?.generatedBy !== 'OutdoorPondBuilder') errors.push(`oarbOutdoorExpo ${body.id} is not compiled by OutdoorPondBuilder`);
    const animatedProfile = expo.textures?.[body.material];
    if ((animatedProfile?.animatedFrames ?? []).length !== 6) errors.push(`oarbOutdoorExpo ${body.id} must resolve all 6 animated water frames`);
    if (!['loop', 'pingPong'].includes(animatedProfile?.playbackMode)) errors.push(`oarbOutdoorExpo ${body.id} has invalid water playback mode`);
    (animatedProfile?.animatedFrames ?? []).forEach((framePath) => {
      const publicPath = framePath.replace(/^\.\//, 'public/');
      if (!fs.existsSync(path.resolve(repoRoot, publicPath))) errors.push(`oarbOutdoorExpo ${body.id} animated water frame path is missing: ${framePath}`);
    });
    validatePondFootprint(body, expo).errors.forEach((error) => errors.push(`oarbOutdoorExpo ${error}`));
    validatePondDecor(body, expo, { assetExists: textureAssetExists }).errors.forEach((error) => errors.push(`oarbOutdoorExpo ${error}`));
  });
  const pond06 = waterBodies.find((body) => body.id === 'pond_expo_06_gully_repair');
  if (!pond06) errors.push('oarbOutdoorExpo POND 06 water surface is missing');
  else {
    const animatedProfile = expo.textures?.[pond06.material];
    if (!animatedProfile) errors.push('oarbOutdoorExpo POND 06 animated water material key does not resolve');
    else {
      const animatedFrames = animatedProfile.animatedFrames ?? [];
      if (animatedFrames.length !== 6) errors.push('oarbOutdoorExpo POND 06 animated water must author exactly 6 frames');
      const playbackMode = animatedProfile.playbackMode ?? 'loop';
      if (!['loop', 'pingPong'].includes(playbackMode)) errors.push(`oarbOutdoorExpo POND 06 animated water playbackMode must be loop or pingPong, found ${playbackMode}`);
      if (playbackMode !== 'pingPong') errors.push(`oarbOutdoorExpo POND 06 animated water should use pingPong playback, found ${playbackMode}`);
      if (!Number.isFinite(animatedProfile.frameDurationMs) || animatedProfile.frameDurationMs <= 0) errors.push('oarbOutdoorExpo POND 06 animated water frameDurationMs must be finite and positive');
      if (animatedProfile.frameDurationMs !== 220) errors.push(`oarbOutdoorExpo POND 06 animated water frameDurationMs should be 220, found ${animatedProfile.frameDurationMs}`);
      const pingPongSequence = playbackMode === 'pingPong' && animatedFrames.length > 1 ? animatedFrames.concat(animatedFrames.slice(1, -1).reverse()) : animatedFrames;
      if (playbackMode === 'pingPong' && pingPongSequence.length === 0) errors.push('oarbOutdoorExpo POND 06 animated water ping-pong sequence must be non-empty');
      (animatedProfile.animatedFrames ?? []).forEach((framePath) => {
        const publicPath = framePath.replace(/^\.\//, 'public/');
        if (!fs.existsSync(path.resolve(repoRoot, publicPath))) errors.push(`oarbOutdoorExpo POND 06 animated water frame path is missing: ${framePath}`);
      });
    }
    if ((pond06.footprint?.waterOutline ?? []).length < 3) errors.push('oarbOutdoorExpo POND 06 water mesh must keep an irregular water surface outline');
    if (pond06.userData?.noDownwardFacingTopNormals !== true) errors.push('oarbOutdoorExpo POND 06 should keep top-visible/two-sided water geometry metadata');
  }
  const visibleIds = new Set((expo.outdoorPrimitives ?? []).map((primitive) => primitive.id));
  (expo.curvedBlockers ?? []).forEach((blocker) => {
    if (!blocker.visibleStructureId || !visibleIds.has(blocker.visibleStructureId)) errors.push(`oarbOutdoorExpo blocker ${blocker.id} is not paired to a visible primitive`);
  });
  ['grassDryStrawPad', 'grassMattedPad', 'grassPatchyDirtPad', 'grassWornPad', 'mudWetDarkPad', 'mudCrackedDryPad', 'mudChurnedWetPad', 'mudPebblyEarthPad'].forEach((key) => {
    if (!expo.textures?.[key]) errors.push(`oarbOutdoorExpo texture gallery material key ${key} is missing`);
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
    ['FIELD_OARB_OUTDOOR_EXPO_RETURN_START', 'field_oarb_outdoor_expo_return'],
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
const fieldSpawnResolutionErrors = validateFieldSpawnResolution();
const compiledOutdoorFieldRuntimeErrors = validateCompiledOutdoorFieldRuntime(definitions);
totalErrors += startupRoutingErrors.length + transitionSafetyErrors.length + reliquaryFieldStartupErrors.length + fieldSpawnResolutionErrors.length + compiledOutdoorFieldRuntimeErrors.length;

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
if (fieldSpawnResolutionErrors.length) {
  console.log('\nReliquary Field spawn resolution');
  fieldSpawnResolutionErrors.forEach((error) => console.log(`- error: ${error}`));
}
if (compiledOutdoorFieldRuntimeErrors.length) {
  console.log('\nCompiled outdoor field runtime');
  compiledOutdoorFieldRuntimeErrors.forEach((error) => console.log(`- error: ${error}`));
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
