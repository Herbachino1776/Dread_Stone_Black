import { buildDungeonCollision } from '../DungeonCollisionBuilder.js';
import { asArray, rectCenter } from '../DungeonDefinitionTypes.js';
import {
  DEFAULT_STRUCTURAL_PROP_KINDS,
  INTEGRITY_CATEGORY,
  INTEGRITY_CODES,
  INTEGRITY_SEVERITY,
  INVISIBLE_BLOCKER_PURPOSES,
  rectDepth,
  rectWidth,
  rectsIntersect,
} from './DungeonIntegrityTypes.js';

const ALIGNMENT_TOLERANCE = 0.28;
const COVERAGE_WARNING_RATIO = 0.94;

function rectOrientation(rect) {
  return rectWidth(rect) >= rectDepth(rect) ? 'horizontal' : 'vertical';
}

function intervalOverlap(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function coverageRatio(segment, blocker) {
  if (!rectsIntersect(segment, blocker, ALIGNMENT_TOLERANCE)) return 0;
  if (segment.orientation === 'horizontal') {
    return intervalOverlap(segment.minX, segment.maxX, blocker.minX, blocker.maxX) / Math.max(segment.maxX - segment.minX, 0.0001);
  }

  return intervalOverlap(segment.minZ, segment.maxZ, blocker.minZ, blocker.maxZ) / Math.max(segment.maxZ - segment.minZ, 0.0001);
}

function perpendicularOffset(segment, blocker) {
  const segmentCenter = rectCenter(segment);
  const blockerCenter = rectCenter(blocker);
  return segment.orientation === 'horizontal'
    ? Math.abs(segmentCenter.z - blockerCenter.z)
    : Math.abs(segmentCenter.x - blockerCenter.x);
}

function bestBlockerMatch(segment, blockers) {
  return blockers
    .map((blocker) => ({
      blocker,
      coverage: coverageRatio(segment, blocker),
      offset: perpendicularOffset(segment, blocker),
    }))
    .filter((candidate) => candidate.coverage > 0)
    .sort((a, b) => b.coverage - a.coverage || a.offset - b.offset)[0] ?? null;
}

function blockerHasVisibleProp(blocker, props) {
  return props.find((prop) => prop.collisionRef === blocker.id && prop.visibleGeometry !== false) ?? null;
}

function facadeCollisionIds(definition) {
  const ids = new Set();
  asArray(definition.integrity?.facades).forEach((facade) => {
    asArray(facade.collisionHullIds).forEach((id) => ids.add(id));
    asArray(facade.solidStructureZones).forEach((zone) => ids.add(zone.id));
  });
  return ids;
}

function allowedInvisibleBlocker(blocker) {
  const purpose = blocker.purpose ?? blocker.userData?.purpose;
  return blocker.invisible === true
    || blocker.userData?.invisible === true
    || asArray(blocker.tags).includes('invisible')
    || (purpose && INVISIBLE_BLOCKER_PURPOSES.includes(purpose));
}

function propFootprint(prop) {
  if (!prop.position || !prop.dimensions) return null;
  return {
    minX: prop.position.x - prop.dimensions.width / 2,
    maxX: prop.position.x + prop.dimensions.width / 2,
    minZ: prop.position.z - prop.dimensions.depth / 2,
    maxZ: prop.position.z + prop.dimensions.depth / 2,
  };
}

function visibleStructuralPropKinds(definition) {
  return new Set([
    ...DEFAULT_STRUCTURAL_PROP_KINDS,
    ...asArray(definition.integrity?.structuralPropKinds),
  ]);
}

function nonBlockingDecorIds(definition) {
  return new Set([
    ...asArray(definition.integrity?.nonBlockingDecor),
    ...asArray(definition.integrity?.decorativeNonBlockingPropIds),
  ]);
}

export function validateWallCollisionMatching(definition, edgeAnalysis, report) {
  const collision = buildDungeonCollision(definition);
  const collisionSegments = collision.blockerRects.filter((blocker) => asArray(blocker.tags).includes('compiled-wall'));
  const authoredBlockers = asArray(definition.blockers).filter((blocker) => blocker.blocksPlayer !== false);
  const props = asArray(definition.props);
  const facadeIds = facadeCollisionIds(definition);

  report.debug.collisionSegments.push(...collisionSegments);

  edgeAnalysis.wallSegments.forEach((segment) => {
    const match = bestBlockerMatch(segment, collisionSegments);
    if (!match) {
      report.error({
        code: INTEGRITY_CODES.WALL_MISSING_COLLISION,
        category: INTEGRITY_CATEGORY.WALL_COLLISION,
        roomId: segment.roomId,
        wallId: segment.id,
        position: rectCenter(segment, 0.8),
        message: `Visible ${segment.side} wall segment ${segment.id} has no matching collision blocker.`,
        suggestedFix: 'Make collision wall generation use the same wall gap data as visual wall generation, or add an explicit blocker.',
      });
      return;
    }

    if (match.coverage < COVERAGE_WARNING_RATIO) {
      report.warning({
        code: INTEGRITY_CODES.WALL_SEGMENT_GAP,
        category: INTEGRITY_CATEGORY.WALL_COLLISION,
        roomId: segment.roomId,
        wallId: segment.id,
        blockerId: match.blocker.id,
        position: rectCenter(segment, 0.8),
        message: `Wall segment ${segment.id} is only ${Math.round(match.coverage * 100)}% covered by blocker ${match.blocker.id}.`,
        suggestedFix: 'Extend the blocker to cover the full visual wall segment or explicitly author the gap as an opening.',
      });
    }

    if (match.offset > ALIGNMENT_TOLERANCE) {
      report.warning({
        code: INTEGRITY_CODES.BLOCKER_OFFSET_FROM_WALL,
        category: INTEGRITY_CATEGORY.WALL_COLLISION,
        roomId: segment.roomId,
        wallId: segment.id,
        blockerId: match.blocker.id,
        position: rectCenter(segment, 0.8),
        message: `Blocker ${match.blocker.id} is offset from visible wall segment ${segment.id}.`,
        suggestedFix: 'Rebuild the blocker from the same room edge coordinate as the visual wall.',
      });
    }
  });

  authoredBlockers.forEach((blocker) => {
    if (facadeIds.has(blocker.id)) return;
    if (blockerHasVisibleProp(blocker, props)) return;
    if (blocker.visualStructureId || blocker.userData?.visualStructureId) return;

    if (allowedInvisibleBlocker(blocker)) {
      report.info({
        code: INTEGRITY_CODES.COLLISION_WITHOUT_VISUAL,
        category: INTEGRITY_CATEGORY.COLLISION_VISUAL,
        blockerId: blocker.id,
        position: rectCenter(blocker, 0.5),
        message: `Blocker ${blocker.id} is intentionally invisible for ${blocker.purpose ?? blocker.userData?.purpose ?? 'an authored boundary'}.`,
        suggestedFix: 'No fix needed while this purpose remains intentional.',
      });
      return;
    }

    report.warning({
      code: INTEGRITY_CODES.COLLISION_WITHOUT_VISUAL,
      category: INTEGRITY_CATEGORY.COLLISION_VISUAL,
      blockerId: blocker.id,
      position: rectCenter(blocker, 0.5),
      message: `Collision blocker ${blocker.id} has no visible prop, facade, or explicit invisible-boundary purpose.`,
      suggestedFix: 'Attach a visible prop with collisionRef, add it to facade collision metadata, or mark the blocker with an allowed invisible purpose.',
    });
  });

  const structuralKinds = visibleStructuralPropKinds(definition);
  const nonBlocking = nonBlockingDecorIds(definition);
  props.forEach((prop) => {
    if (prop.visibleGeometry === false || prop.collisionRef || nonBlocking.has(prop.id)) return;
    if (prop.userData?.nonBlockingDecor === true || asArray(prop.tags).includes('decorative')) return;
    if (!structuralKinds.has(prop.kind)) return;

    report.error({
      severity: INTEGRITY_SEVERITY.ERROR,
      code: INTEGRITY_CODES.WALL_MISSING_COLLISION,
      category: INTEGRITY_CATEGORY.WALL_COLLISION,
      roomId: prop.roomId,
      objectId: prop.id,
      position: prop.position,
      message: `Visible structural prop ${prop.id} (${prop.kind}) has no collisionRef.`,
      suggestedFix: 'Add a matching blocker and set collisionRef, or mark the prop as intentional non-blocking decor.',
    });
  });

  props.forEach((prop) => {
    if (!prop.collisionRef) return;
    const blocker = authoredBlockers.find((candidate) => candidate.id === prop.collisionRef);
    const footprint = propFootprint(prop);
    if (!blocker || !footprint) return;

    if (rectOrientation(footprint) !== rectOrientation(blocker)) return;
    const offset = perpendicularOffset(
      { ...footprint, orientation: rectOrientation(footprint) },
      blocker,
    );
    if (offset > ALIGNMENT_TOLERANCE) {
      report.warning({
        code: INTEGRITY_CODES.BLOCKER_OFFSET_FROM_WALL,
        category: INTEGRITY_CATEGORY.COLLISION_VISUAL,
        roomId: prop.roomId,
        objectId: prop.id,
        blockerId: blocker.id,
        position: prop.position,
        message: `Prop ${prop.id} and blocker ${blocker.id} have noticeably different footprints.`,
        suggestedFix: 'Align the blocker rectangle to the prop dimensions and position.',
      });
    }
  });
}
