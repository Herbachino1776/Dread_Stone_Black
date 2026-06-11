import * as THREE from 'three';
import { buildDungeonCollision } from './DungeonCollisionBuilder.js';
import { buildDungeonGeometry } from './DungeonGeometryBuilder.js';
import { buildDungeonNavigation } from './DungeonNavigationBuilder.js';
import { buildDungeonSpawns } from './DungeonSpawnBuilder.js';
import { asArray } from './DungeonDefinitionTypes.js';
import { logDungeonValidation, validateDungeonDefinition } from './DungeonValidation.js';
import { validateDungeonIntegrity } from './integrity/DungeonIntegrityValidator.js';
import { buildLightObjectRegistry } from '../lighting/LightObjectRegistry.js';
import { validateTorchPlacements } from '../lighting/TorchPlacementValidator.js';

function toVector3(value, fallbackY = 0) {
  return new THREE.Vector3(
    Number(value?.x ?? value?.[0] ?? 0),
    Number(value?.y ?? value?.[1] ?? fallbackY),
    Number(value?.z ?? value?.[2] ?? 0),
  );
}

function normalizeEncounterZones(definition) {
  return asArray(definition.encounterZones).map((zone) => ({
    id: zone.id,
    label: zone.label,
    roomIds: zone.roomIds ?? [],
    center: toVector3(zone.center),
    radius: zone.radius ?? 8,
    weight: zone.weight ?? 1,
    allowedFactions: zone.allowedFactions ?? [],
    actionBubblePriority: zone.actionBubblePriority ?? 0,
    tags: zone.tags ?? [],
    userData: zone.userData ?? {},
  }));
}

function normalizeExits(definition) {
  return asArray(definition.exits).map((exit) => ({
    id: exit.id,
    fromLocation: exit.fromLocation ?? definition.id,
    toLocation: exit.toLocation,
    triggerRect: exit.triggerRect,
    destinationSpawnId: exit.destinationSpawnId,
    promptText: exit.promptText,
    roomId: exit.roomId,
    position: exit.position ? toVector3(exit.position, 1.2) : toVector3({
      x: (exit.triggerRect.minX + exit.triggerRect.maxX) / 2,
      y: exit.triggerRect.y ?? 1.2,
      z: (exit.triggerRect.minZ + exit.triggerRect.maxZ) / 2,
    }),
    tags: exit.tags ?? [],
    userData: exit.userData ?? {},
  }));
}

export function compileDungeonLocation(definition, options = {}) {
  const baseValidation = validateDungeonDefinition(definition, options.validation ?? {});
  const integrityReport = validateDungeonIntegrity(definition, options.integrity ?? {});
  const lightRegistry = buildLightObjectRegistry(definition, options.lightRegistry ?? {});
  const fixtureValidation = validateTorchPlacements(definition, lightRegistry.torchFixtures);
  const validation = {
    ...baseValidation,
    errors: [...baseValidation.errors, ...fixtureValidation.errors, ...integrityReport.errors],
    warnings: [...baseValidation.warnings, ...fixtureValidation.warnings, ...integrityReport.warnings],
    infos: [...(baseValidation.infos ?? []), ...integrityReport.infos],
    ok: baseValidation.errors.length + fixtureValidation.errors.length + integrityReport.errors.length === 0,
    fixtureValidation,
    integrity: integrityReport,
  };
  if (import.meta.env?.DEV && options.logValidation !== false) {
    logDungeonValidation(validation);
  }

  const geometry = buildDungeonGeometry(definition, {
    materialFactory: options.materialFactory,
    torchFactory: options.torchFactory,
    lightRegistry,
  });
  const collision = buildDungeonCollision(definition);
  const navGraph = buildDungeonNavigation(definition);
  const spawnAnchors = buildDungeonSpawns(definition);
  const encounterZones = normalizeEncounterZones(definition);
  const exits = normalizeExits(definition);
  const runtime = {
    locationId: definition.id,
    displayName: definition.displayName,
    definition,
    group: geometry.group,
    rooms: asArray(definition.rooms),
    walkableRects: collision.walkableRects,
    blockerRects: collision.blockerRects,
    enemyBlockerRects: collision.enemyBlockerRects,
    lineOfMovementBlockerRects: collision.lineOfMovementBlockerRects,
    collisionWorld: collision.collisionWorld,
    navGraph,
    spawnAnchors,
    encounterZones,
    exits,
    lights: geometry.lights,
    lightFixtures: lightRegistry.lightFixtures,
    torchFixtures: lightRegistry.torchFixtures,
    pointLights: geometry.pointLights,
    fixtureValidation,
    lightBudget: lightRegistry.budget,
    props: geometry.props,
    integrityReport,
    debugData: {
      rooms: asArray(definition.rooms),
      blockers: collision.blockerRects,
      doorwayWaypoints: navGraph.doorwayWaypoints,
      spawnAnchors,
      encounterZones,
      exits,
      torchFixtures: lightRegistry.torchFixtures,
      fixtureValidation,
      integrity: integrityReport,
    },
    validation,
  };

  geometry.group.userData.runtimeBundle = {
    locationId: runtime.locationId,
    roomCount: runtime.rooms.length,
    blockerCount: runtime.blockerRects.length,
    spawnCount: runtime.spawnAnchors.length,
    validation: {
      errors: validation.errors.length,
      warnings: validation.warnings.length,
      fixtureErrors: fixtureValidation.errors.length,
      fixtureWarnings: fixtureValidation.warnings.length,
      integrityErrors: integrityReport.errors.length,
      integrityWarnings: integrityReport.warnings.length,
    },
  };

  return runtime;
}
