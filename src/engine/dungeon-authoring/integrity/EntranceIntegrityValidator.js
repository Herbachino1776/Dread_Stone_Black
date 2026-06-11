import { asArray, rectCenter } from '../DungeonDefinitionTypes.js';
import {
  INTEGRITY_CATEGORY,
  INTEGRITY_CODES,
  expandRect,
  pointInRect,
  rectDepth,
  rectWidth,
  rectsIntersect,
  unionRect,
} from './DungeonIntegrityTypes.js';
import { canReachRect } from './DungeonLeakDetector.js';

const MIN_FACADE_DEPTH = 4;
const MIN_FACADE_WIDTH = 8;

function blockerById(definition) {
  return new Map(asArray(definition.blockers).map((blocker) => [blocker.id, blocker]));
}

function exitById(definition) {
  return new Map(asArray(definition.exits).map((exit) => [exit.id, exit]));
}

function rectFromVisual(visual) {
  if (visual.bounds) return visual.bounds;
  if (!visual.position || !visual.dimensions) return null;
  return {
    minX: visual.position.x - visual.dimensions.width / 2,
    maxX: visual.position.x + visual.dimensions.width / 2,
    minZ: visual.position.z - visual.dimensions.depth / 2,
    maxZ: visual.position.z + visual.dimensions.depth / 2,
  };
}

function collisionHullsForFacade(definition, facade) {
  const blockers = blockerById(definition);
  const hulls = asArray(facade.collisionHullIds)
    .map((id) => blockers.get(id))
    .filter(Boolean);

  return [
    ...hulls,
    ...asArray(facade.solidStructureZones),
  ];
}

function triggerCenter(exit) {
  return exit?.position ?? rectCenter(exit?.triggerRect ?? { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }, 1);
}

function rectContainsRect(outer, inner, padding = 0) {
  return inner.minX >= outer.minX - padding
    && inner.maxX <= outer.maxX + padding
    && inner.minZ >= outer.minZ - padding
    && inner.maxZ <= outer.maxZ + padding;
}

function checkCriticalPointClear(definition, facade, point, report, label) {
  const blockers = collisionHullsForFacade(definition, facade);
  const blocking = blockers.find((blocker) => pointInRect(point, blocker, 0.15));
  if (!blocking) return;

  report.error({
    code: INTEGRITY_CODES.PROP_BLOCKS_CRITICAL_PATH,
    category: INTEGRITY_CATEGORY.FACADE,
    facadeId: facade.id,
    blockerId: blocking.id,
    position: point,
    message: `${label} for facade ${facade.id} is blocked by ${blocking.id}.`,
    suggestedFix: 'Move the trigger/approach point or carve a declared doorway through the facade collision hull.',
  });
}

export function validateEntranceIntegrity(definition, report) {
  const facades = asArray(definition.integrity?.facades);
  if (!facades.length) return;

  const exits = exitById(definition);
  const blockers = blockerById(definition);

  facades.forEach((facade) => {
    const bounds = facade.bounds;
    if (!bounds) {
      report.error({
        code: INTEGRITY_CODES.FACADE_TRIGGER_NOT_EMBEDDED,
        category: INTEGRITY_CATEGORY.FACADE,
        facadeId: facade.id,
        message: `Facade ${facade.id} is missing bounds.`,
        suggestedFix: 'Author facade bounds that cover the visible exterior structure.',
      });
      return;
    }

    report.debug.facades.push({
      id: facade.id,
      type: facade.type,
      bounds,
      approachZone: facade.approachZone,
      behindZone: facade.behindZone,
    });

    if (rectWidth(bounds) < MIN_FACADE_WIDTH || rectDepth(bounds) < MIN_FACADE_DEPTH) {
      report.error({
        code: INTEGRITY_CODES.FACADE_TRIGGER_NOT_EMBEDDED,
        category: INTEGRITY_CATEGORY.FACADE,
        facadeId: facade.id,
        position: rectCenter(bounds, 1),
        message: `Facade ${facade.id} is too shallow or narrow to read as grounded architecture.`,
        suggestedFix: 'Give the facade meaningful side/rear mass and visible depth.',
      });
    }

    const exit = exits.get(facade.doorway?.triggerId ?? facade.entryTriggerId);
    if (!exit) {
      report.error({
        code: INTEGRITY_CODES.FACADE_TRIGGER_NOT_EMBEDDED,
        category: INTEGRITY_CATEGORY.FACADE,
        facadeId: facade.id,
        objectId: facade.doorway?.triggerId ?? facade.entryTriggerId,
        message: `Facade ${facade.id} references a missing entry trigger.`,
        suggestedFix: 'Set doorway.triggerId to an authored exit/entrance id.',
      });
    } else {
      const center = triggerCenter(exit);
      const opening = facade.doorway?.openingRect ?? exit.triggerRect;
      if (opening && !rectsIntersect(bounds, opening, 0.5)) {
        report.error({
          code: INTEGRITY_CODES.FACADE_TRIGGER_NOT_EMBEDDED,
          category: INTEGRITY_CATEGORY.FACADE,
          facadeId: facade.id,
          objectId: exit.id,
          position: center,
          message: `Entry trigger ${exit.id} is not embedded in facade ${facade.id}.`,
          suggestedFix: 'Move the trigger/opening into the visible doorway mass.',
        });
      }

      if (facade.approachZone && !pointInRect(center, facade.approachZone, 8)) {
        report.warning({
          code: INTEGRITY_CODES.FACADE_TRIGGER_NOT_EMBEDDED,
          category: INTEGRITY_CATEGORY.FACADE,
          facadeId: facade.id,
          objectId: exit.id,
          position: center,
          message: `Entry trigger ${exit.id} sits far from the authored approach zone for ${facade.id}.`,
          suggestedFix: 'Move the trigger closer to the approach, or enlarge the approach zone deliberately.',
        });
      }

      checkCriticalPointClear(definition, facade, center, report, `Entry trigger ${exit.id}`);
      if (facade.approachZone) checkCriticalPointClear(definition, facade, rectCenter(facade.approachZone, 0), report, 'Approach zone center');
    }

    asArray(facade.collisionHullIds).forEach((id) => {
      if (!blockers.has(id)) {
        report.error({
          code: INTEGRITY_CODES.WALL_MISSING_COLLISION,
          category: INTEGRITY_CATEGORY.FACADE,
          facadeId: facade.id,
          blockerId: id,
          message: `Facade ${facade.id} references missing collision hull ${id}.`,
          suggestedFix: 'Add the blocker to the location definition or remove the stale hull id.',
        });
      }
    });

    const visualsById = new Map(asArray(facade.visualStructures).map((visual) => [visual.id, visual]));
    asArray(facade.visualStructureIds).forEach((id) => {
      if (!visualsById.has(id)) {
        report.warning({
          code: INTEGRITY_CODES.COLLISION_WITHOUT_VISUAL,
          category: INTEGRITY_CATEGORY.FACADE,
          facadeId: facade.id,
          objectId: id,
          message: `Facade ${facade.id} lists visual structure ${id} without bounds metadata.`,
          suggestedFix: 'Add visualStructures metadata so collision can be compared to visible mass.',
        });
      }
    });

    collisionHullsForFacade(definition, facade).forEach((hull) => {
      const supported = asArray(facade.visualStructures)
        .map(rectFromVisual)
        .filter(Boolean)
        .some((visualRect) => rectsIntersect(visualRect, hull, 0.75));
      if (!supported) {
        report.warning({
          code: INTEGRITY_CODES.COLLISION_WITHOUT_VISUAL,
          category: INTEGRITY_CATEGORY.FACADE,
          facadeId: facade.id,
          blockerId: hull.id,
          position: rectCenter(hull, 0.5),
          message: `Facade collision hull ${hull.id} has no nearby visual structure metadata.`,
          suggestedFix: 'Add a matching visualStructures entry, or mark the blocker as an intentional invisible boundary.',
        });
      }
    });

    asArray(facade.chaliceIds).forEach((id) => {
      const visual = visualsById.get(id);
      if (!visual) {
        report.warning({
          code: INTEGRITY_CODES.CHALICE_NOT_GROUNDED,
          category: INTEGRITY_CATEGORY.FACADE,
          facadeId: facade.id,
          objectId: id,
          message: `Facade ${facade.id} references missing chalice visual metadata ${id}.`,
          suggestedFix: 'Add the chalice to visualStructures or remove it from chaliceIds.',
        });
        return;
      }

      if (visual.grounded !== true && Number(visual.position?.y ?? 0) > 0.05) {
        report.warning({
          code: INTEGRITY_CODES.CHALICE_NOT_GROUNDED,
          category: INTEGRITY_CATEGORY.FACADE,
          facadeId: facade.id,
          objectId: id,
          position: visual.position,
          message: `Chalice ${id} is not marked as grounded.`,
          suggestedFix: 'Place the chalice base at floor height and mark grounded: true.',
        });
      }
    });

    if (facade.allowedWalkBehind === false && facade.behindZone && facade.approachZone) {
      const walkableRects = asArray(definition.rooms).length ? asArray(definition.rooms) : [definition.integrity?.walkableBounds].filter(Boolean);
      const localBounds = expandRect(unionRect([facade.approachZone, facade.behindZone, bounds]), 4);
      const reachableBehind = canReachRect({
        walkableRects,
        blockers: asArray(definition.blockers).filter((blocker) => blocker.blocksPlayer !== false),
        start: rectCenter(facade.approachZone, 0),
        targetRect: facade.behindZone,
        bounds: localBounds,
        sampleStep: facade.validation?.sampleStep ?? 1,
      });

      if (reachableBehind) {
        report.error({
          code: INTEGRITY_CODES.FACADE_WALK_BEHIND_LEAK,
          category: INTEGRITY_CATEGORY.FACADE,
          facadeId: facade.id,
          position: rectCenter(facade.behindZone, 0),
          message: `Facade ${facade.id} allows a walkable path behind the entrance structure.`,
          suggestedFix: 'Add visible side/rear mass with matching collision, or set allowedWalkBehind true with a believable authored route.',
        });
      }
    }

    if (facade.doorway?.openingRect && !rectContainsRect(expandRect(bounds, 0.5), facade.doorway.openingRect, 0)) {
      report.warning({
        code: INTEGRITY_CODES.FACADE_TRIGGER_NOT_EMBEDDED,
        category: INTEGRITY_CATEGORY.FACADE,
        facadeId: facade.id,
        position: rectCenter(facade.doorway.openingRect, 1),
        message: `Facade ${facade.id} doorway opening extends outside facade bounds.`,
        suggestedFix: 'Expand facade bounds or move the doorway opening inside the visible structure.',
      });
    }
  });
}
