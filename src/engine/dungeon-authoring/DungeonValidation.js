import { asArray, hasUsableId } from './DungeonDefinitionTypes.js';
import { OARB_TERRAIN_FALLBACK_MATERIAL_KEY, OARB_TERRAIN_MAX_SEGMENTS_PER_AXIS, OARB_TERRAIN_MAX_TOTAL_CELLS } from '../outdoor-authoring/OutdoorTerrainBuilder.js';
import { OARB_SPLINE_TRAIL_FALLBACK_MATERIAL_KEY, OARB_SPLINE_TRAIL_MAX_WIDTH } from '../outdoor-authoring/OutdoorSplineBuilder.js';

const loggedValidationKeys = new Set();
const RUNTIME_ENEMY_SPECIES = new Set(['sheep_demon', 'neck_man']);
const HORIZONTAL_SURFACE_KINDS = new Set(['floor', 'ceiling', 'roof', 'path', 'platformTop']);
const HORIZONTAL_SURFACE_SHAPES = new Set(['rect', 'polygon']);


const OUTDOOR_TERRAIN_WARN_SEGMENTS_PER_AXIS = 96;
const OUTDOOR_TERRAIN_WARN_TOTAL_CELLS = 9216;
const OUTDOOR_TERRAIN_MAX_SIZE_PER_AXIS = 2000;
const TERRAIN_STAMP_KINDS = new Set(['hill', 'hollow', 'ridge', 'ravine', 'flatten']);
const OUTDOOR_SPLINE_FIELDS = new Set(['id', 'points', 'width', 'material', 'flatten', 'metadata', 'tags', 'userData']);
const CURVED_BLOCKER_KINDS = new Set(['capsule', 'spline', 'circle', 'hazard', 'cliff']);
const DECORATION_ZONE_KINDS = new Set(['treeClusterZone', 'shrubPatchZone', 'grassPatchZone', 'mistVolume', 'fallenBranchScatter', 'standingStoneScatter']);
const OUTDOOR_PRIMITIVE_KINDS = new Set([
  'terrainPatch', 'heightStamp', 'forestClearing', 'sunkenGrove', 'raisedRidge', 'ravineCut', 'mudTrail', 'riverBed', 'creekBank',
  'cliffWall', 'mountainSkirt', 'stoneOutcrop', 'boulderCluster', 'fallenTreeBarrier', 'rootWall', 'denseThicketBlocker',
  'fallenTreeBridge', 'rootArch', 'steppingStones', 'logCrossing', 'slopeTrail', 'caveMouth', 'ledgePath',
  'forestBowl', 'ambushClearing', 'ritualGrove', 'ruinedFoundation', 'hiddenAlcove', 'spawnHollow', 'fogPocket',
]);

function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function pointArrayIsFinite(points, minPoints = 2) {
  const parsed = asArray(points).map(xzPoint);
  return parsed.length >= minPoints && parsed.every(Boolean);
}

function validateOutdoorMaterial(definition, material, label, id, errors, warnings, { required = false } = {}) {
  if (material === undefined || material === null || material === '') {
    if (required) addIssue(errors, 'error', `${label} is missing material`, id);
    return;
  }
  if (typeof material !== 'string') {
    addIssue(errors, 'error', `${label} material must be a texture profile key`, id);
  } else if (!definition.textures?.[material]) {
    if (material === OARB_TERRAIN_FALLBACK_MATERIAL_KEY) {
      addIssue(warnings, 'warning', `${label} references fallback material profile ${material}; runtime will use the safe built-in outdoor grass fallback`, id);
    } else if (material === OARB_SPLINE_TRAIL_FALLBACK_MATERIAL_KEY) {
      addIssue(warnings, 'warning', `${label} references fallback spline trail material profile ${material}; runtime will use the built-in outdoor trail fallback when needed`, id);
    } else {
      addIssue(warnings, 'warning', `${label} references material profile ${material} that is not defined in textures yet and will use the safe OARB fallback if rendered`, id);
    }
  }
}

function validateOutdoorAuthoring(definition, errors, warnings) {
  const terrain = definition.terrain;
  if (terrain !== undefined) {
    const size = Array.isArray(terrain?.size) ? terrain.size : [];
    const segments = Array.isArray(terrain?.segments) ? terrain.segments : [];
    if (size.length !== 2 || !size.every(isFinitePositive)) {
      addIssue(errors, 'error', 'terrain.size must be two finite positive numbers', 'terrain');
    } else if (size.some((value) => value > OUTDOOR_TERRAIN_MAX_SIZE_PER_AXIS)) {
      addIssue(errors, 'error', `terrain.size must remain within generation-safe bounds (<= ${OUTDOOR_TERRAIN_MAX_SIZE_PER_AXIS} per axis)`, 'terrain');
    }
    if (segments.length !== 2 || !segments.every((value) => Number.isInteger(value) && value > 0)) {
      addIssue(errors, 'error', 'terrain.segments must be two finite positive integers', 'terrain');
    } else {
      if (segments.some((value) => value > OARB_TERRAIN_MAX_SEGMENTS_PER_AXIS) || segments[0] * segments[1] > OARB_TERRAIN_MAX_TOTAL_CELLS) {
        addIssue(errors, 'error', `terrain.segments must remain mobile-safe (<= ${OARB_TERRAIN_MAX_SEGMENTS_PER_AXIS} per axis and <= ${OARB_TERRAIN_MAX_TOTAL_CELLS} cells)`, 'terrain');
      } else if (segments.some((value) => value > OUTDOOR_TERRAIN_WARN_SEGMENTS_PER_AXIS) || segments[0] * segments[1] > OUTDOOR_TERRAIN_WARN_TOTAL_CELLS) {
        addIssue(warnings, 'warning', `terrain.segments are high for mobile; prefer <= ${OUTDOOR_TERRAIN_WARN_SEGMENTS_PER_AXIS} per axis unless the location needs the extra vertices`, 'terrain');
      }
    }
    if (!Number.isFinite(terrain?.baseY ?? 0)) addIssue(errors, 'error', 'terrain.baseY must be finite', 'terrain');
    validateOutdoorMaterial(definition, terrain?.material, 'terrain', 'terrain', errors, warnings, { required: true });
    if (terrain?.heightStamps !== undefined && !Array.isArray(terrain.heightStamps)) addIssue(errors, 'error', 'terrain.heightStamps must be an array when present', 'terrain');

    asArray(terrain?.heightStamps).forEach((stamp, index) => {
      const id = stamp.id ?? `terrain.heightStamps[${index}]`;
      if (!TERRAIN_STAMP_KINDS.has(stamp.kind)) addIssue(errors, 'error', `heightStamp ${id} uses unsupported kind ${stamp.kind}`, id);
      const radial = ['hill', 'hollow', 'flatten'].includes(stamp.kind);
      const pathBased = ['ridge', 'ravine'].includes(stamp.kind);
      if (radial && !xzPoint(stamp.center)) addIssue(errors, 'error', `heightStamp ${id} needs a finite center`, id);
      if (pathBased && !pointArrayIsFinite(stamp.path, 2)) addIssue(errors, 'error', `heightStamp ${id} needs a path with at least two finite [x, z] points`, id);
      if (radial && !isFinitePositive(stamp.radius)) addIssue(errors, 'error', `heightStamp ${id} radius must be > 0`, id);
      if (pathBased && !isFinitePositive(stamp.width)) addIssue(errors, 'error', `heightStamp ${id} width must be > 0`, id);
      if (['hill', 'ridge'].includes(stamp.kind) && !isFinitePositive(stamp.height)) addIssue(errors, 'error', `heightStamp ${id} height must be > 0`, id);
      if (['hollow', 'ravine'].includes(stamp.kind) && !isFinitePositive(stamp.depth)) addIssue(errors, 'error', `heightStamp ${id} depth must be > 0`, id);
      if (stamp.kind === 'flatten' && !Number.isFinite(stamp.y)) addIssue(errors, 'error', `heightStamp ${id} y must be finite`, id);
      const vertical = Math.abs(stamp.height ?? stamp.depth ?? 0);
      const run = stamp.radius ?? stamp.width ?? 0;
      if (vertical > 8) addIssue(warnings, 'warning', `heightStamp ${id} has an extreme height/depth for mobile outdoor traversal`, id);
      if (Number.isFinite(vertical) && Number.isFinite(run) && run > 0 && vertical / run > 0.35) addIssue(warnings, 'warning', `heightStamp ${id} may create an overly steep authored slope`, id);
    });
  }

  [['splineTrails', definition.splineTrails], ['riverSplines', definition.riverSplines], ['creekBeds', definition.creekBeds]].forEach(([label, items]) => {
    if (items !== undefined && !Array.isArray(items)) addIssue(errors, 'error', `${label} must be an array when present`, label);
    asArray(items).forEach((spline, index) => {
      const id = spline.id ?? `${label}[${index}]`;
      if (!hasUsableId(spline)) addIssue(errors, 'error', `${label}[${index}] is missing a stable id`, id);
      if (!pointArrayIsFinite(spline.points, 2)) addIssue(errors, 'error', `${label} ${id} needs at least two finite [x, z] points`, id);
      if (!isFinitePositive(spline.width)) addIssue(errors, 'error', `${label} ${id} width must be > 0`, id);
      if (label === 'splineTrails' && isFinitePositive(spline.width) && spline.width > OARB_SPLINE_TRAIL_MAX_WIDTH) addIssue(errors, 'error', `${label} ${id} width must be <= ${OARB_SPLINE_TRAIL_MAX_WIDTH} for mobile-safe ribbon generation`, id);
      validateOutdoorMaterial(definition, spline.material, `${label} ${id}`, id, errors, warnings);
      if (spline.flatten !== undefined && typeof spline.flatten !== 'boolean') addIssue(errors, 'error', `${label} ${id} flatten must be boolean when present`, id);
      if (spline.collision || spline.blocksPlayer || spline.blocksEnemies || spline.deformTerrain) addIssue(errors, 'error', `${label} ${id} cannot claim collision, blocking, or terrain deformation behavior yet`, id);
      Object.keys(spline).filter((key) => !OUTDOOR_SPLINE_FIELDS.has(key)).forEach((key) => addIssue(errors, 'error', `${label} ${id} uses unsupported field ${key}; rendering/collision behavior is not implemented in this foundation PR`, id));
    });
  });

  asArray(definition.curvedBlockers).forEach((blocker, index) => {
    const id = blocker.id ?? `curvedBlockers[${index}]`;
    if (!hasUsableId(blocker)) addIssue(errors, 'error', `curvedBlockers[${index}] is missing a stable id`, id);
    if (!CURVED_BLOCKER_KINDS.has(blocker.kind)) addIssue(errors, 'error', `curvedBlocker ${id} uses unsupported kind ${blocker.kind}`, id);
    if (['capsule', 'cliff'].includes(blocker.kind) && (!xzPoint(blocker.from) || !xzPoint(blocker.to))) addIssue(errors, 'error', `curvedBlocker ${id} needs finite from/to points`, id);
    if (blocker.kind === 'spline' && !pointArrayIsFinite(blocker.points, 2)) addIssue(errors, 'error', `curvedBlocker ${id} needs at least two finite points`, id);
    if (['circle', 'hazard'].includes(blocker.kind) && !xzPoint(blocker.center)) addIssue(errors, 'error', `curvedBlocker ${id} needs a finite center`, id);
    if (['capsule', 'spline', 'cliff'].includes(blocker.kind) && !isFinitePositive(blocker.thickness ?? blocker.width)) addIssue(errors, 'error', `curvedBlocker ${id} thickness or width must be > 0`, id);
    if (['circle', 'hazard'].includes(blocker.kind) && !isFinitePositive(blocker.radius)) addIssue(errors, 'error', `curvedBlocker ${id} radius must be > 0`, id);
    if (!blocker.visibleStructureId && blocker.metadata?.intentionallyInvisible !== true) addIssue(warnings, 'warning', `curvedBlocker ${id} has no visibleStructureId; add metadata.intentionallyInvisible when this is deliberate`, id);
  });

  asArray(definition.outdoorPrimitives).forEach((primitive, index) => {
    const id = primitive.id ?? `outdoorPrimitives[${index}]`;
    if (!hasUsableId(primitive)) addIssue(errors, 'error', `outdoorPrimitives[${index}] is missing a stable id`, id);
    if (!OUTDOOR_PRIMITIVE_KINDS.has(primitive.kind)) addIssue(errors, 'error', `outdoorPrimitive ${id} uses unsupported kind ${primitive.kind}`, id);
    if (primitive.position) {
      const position = positionOf(primitive.position);
      if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) addIssue(errors, 'error', `outdoorPrimitive ${id} has invalid position`, id);
    }
    validateOutdoorMaterial(definition, primitive.material, `outdoorPrimitive ${id}`, id, errors, warnings);
  });

  asArray(definition.decorationZones).forEach((zone, index) => {
    const id = zone.id ?? `decorationZones[${index}]`;
    if (!hasUsableId(zone)) addIssue(errors, 'error', `decorationZones[${index}] is missing a stable id`, id);
    if (!DECORATION_ZONE_KINDS.has(zone.kind)) addIssue(errors, 'error', `decorationZone ${id} uses unsupported kind ${zone.kind}`, id);
    if (zone.center && !xzPoint(zone.center)) addIssue(errors, 'error', `decorationZone ${id} has a non-finite center`, id);
    if (zone.points && !pointArrayIsFinite(zone.points, 3)) addIssue(errors, 'error', `decorationZone ${id} polygon needs at least three finite points`, id);
    if (zone.radius !== undefined && !isFinitePositive(zone.radius)) addIssue(errors, 'error', `decorationZone ${id} radius must be > 0`, id);
    if ((zone.width !== undefined && !isFinitePositive(zone.width)) || (zone.depth !== undefined && !isFinitePositive(zone.depth))) addIssue(errors, 'error', `decorationZone ${id} width/depth must be > 0 when present`, id);
    if (zone.blocksPlayer || zone.blocksEnemies || zone.collision || zone.collisionRef) addIssue(errors, 'error', `decorationZone ${id} cannot claim collision/blocking behavior; add a paired curvedBlocker instead`, id);
  });
}

function pointInRect(point, rect, padding = 0) {
  return point.x >= rect.minX - padding && point.x <= rect.maxX + padding
    && point.z >= rect.minZ - padding && point.z <= rect.maxZ + padding;
}

function pointRectClearance(point, rect) {
  if (!pointInRect(point, rect)) return -Infinity;
  return Math.min(point.x - rect.minX, rect.maxX - point.x, point.z - rect.minZ, rect.maxZ - point.z);
}

function circleIntersectsRect(point, radius, rect) {
  const closestX = Math.min(Math.max(point.x, rect.minX), rect.maxX);
  const closestZ = Math.min(Math.max(point.z, rect.minZ), rect.maxZ);
  const dx = point.x - closestX;
  const dz = point.z - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

function rectsApproximatelyAlign(a, b, tolerance = 0.2) {
  return Math.abs(a.minX - b.minX) <= tolerance
    && Math.abs(a.maxX - b.maxX) <= tolerance
    && Math.abs(a.minZ - b.minZ) <= tolerance
    && Math.abs(a.maxZ - b.maxZ) <= tolerance;
}

function positionOf(value) {
  if (!value) return null;
  return {
    x: Number(value.x ?? value[0] ?? 0),
    y: Number(value.y ?? value[1] ?? 0),
    z: Number(value.z ?? value[2] ?? 0),
  };
}


function xzPoint(value) {
  if (!value) return null;
  const x = Number(value.x ?? value[0]);
  const z = Number(value.z ?? value[1]);
  return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
}

function xzDistance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.z - next.x * current.z;
  }
  return Math.abs(area) / 2;
}

function hasIntentionalGapTag(item) {
  return asArray(item?.tags).some((tag) => ['intentional-gap', 'broken-wall-gap', 'open-courtyard', 'connector'].includes(tag));
}

function validateWallClosure(wallSegments, doorGaps, rooms, warnings) {
  const roomTags = new Map(rooms.map((room) => [room.id, room]));
  const gapWallIds = new Set(doorGaps.map((gap) => gap.wallSegmentId));
  const byRoom = new Map();
  wallSegments.forEach((segment) => {
    const roomId = segment.roomId ?? 'unassigned-v2-wall-loop';
    if (!byRoom.has(roomId)) byRoom.set(roomId, []);
    byRoom.get(roomId).push(segment);
  });
  byRoom.forEach((segments, roomId) => {
    const room = roomTags.get(roomId);
    if (hasIntentionalGapTag(room)) return;
    segments.forEach((segment) => {
      if (hasIntentionalGapTag(segment) || gapWallIds.has(segment.id)) return;
      const end = xzPoint(segment.to);
      if (!end) return;
      const nearest = segments
        .filter((candidate) => candidate.id !== segment.id)
        .map((candidate) => ({ candidate, dist: xzDistance(end, xzPoint(candidate.from) ?? { x: Infinity, z: Infinity }) }))
        .sort((a, b) => a.dist - b.dist)[0];
      if (nearest && nearest.dist > 0.35 && !hasIntentionalGapTag(nearest.candidate)) {
        addIssue(warnings, 'warning', `V2 wall loop warning: ${roomId} has an unclaimed gap between ${segment.id} and ${nearest.candidate.id}.`, segment.id);
      }
    });
  });
}

function addIssue(target, severity, message, id = null) {
  target.push({ severity, message, id });
}

function defaultTextureAssetExists() {
  return null;
}

function textureAssetLabel(path) {
  if (typeof path !== 'string') return null;
  const publicPrefix = './assets/';
  if (path.startsWith(publicPrefix)) return `public/assets/${path.slice(publicPrefix.length)}`;
  if (path.startsWith('/assets/')) return `public${path}`;
  return null;
}

function validateTextureProfiles(definition, warnings, textureAssetExists = defaultTextureAssetExists) {
  Object.entries(definition.textures ?? {}).forEach(([profileName, profile]) => {
    const texturePath = profile?.path;
    if (typeof texturePath !== 'string' || !texturePath.trim()) return;
    const exists = textureAssetExists(texturePath, profileName, definition);
    if (exists === false) {
      addIssue(warnings, 'warning', `[${definition.id}] texture profile "${profileName}" points to missing asset "${texturePath}"`, profileName);
      return;
    }
    if (exists === null && !textureAssetLabel(texturePath)) {
      addIssue(warnings, 'warning', `[${definition.id}] texture profile "${profileName}" uses a path that cannot be resolved for validation: "${texturePath}"`, profileName);
    }
  });
}

function collectIds(collections, issues) {
  const seen = new Map();
  collections.forEach(({ label, items }) => {
    asArray(items).forEach((item, index) => {
      if (!hasUsableId(item)) {
        addIssue(issues, 'error', `${label}[${index}] is missing an id`);
        return;
      }
      const key = item.id;
      if (seen.has(key)) {
        addIssue(issues, 'error', `duplicate id ${key} in ${seen.get(key)} and ${label}`, key);
      } else {
        seen.set(key, label);
      }
    });
  });
}

export function validateDungeonDefinition(definition, { destinationSpawnIds = new Set(), textureAssetExists = defaultTextureAssetExists } = {}) {
  const errors = [];
  const warnings = [];
  const rooms = asArray(definition.rooms);
  const blockers = asArray(definition.blockers);
  const props = asArray(definition.props);
  const spawns = asArray(definition.spawns);
  const connectors = asArray(definition.doors ?? definition.connectors);
  const encounterZones = asArray(definition.encounterZones);
  const exits = asArray(definition.exits);
  const polygonFloors = asArray(definition.polygonFloors);
  const wallSegments = asArray(definition.wallSegments);
  const doorGaps = asArray(definition.doorGaps);
  const wallPropAnchors = asArray(definition.wallPropAnchors);
  const pathRibbons = asArray(definition.pathRibbons);
  const platforms = asArray(definition.platforms);
  const ramps = asArray(definition.ramps);
  const stairs = asArray(definition.stairs);
  const bridges = asArray(definition.bridges);
  const horizontalSurfaces = asArray(definition.horizontalSurfaces);
  const architecturalPrimitives = asArray(definition.architecturalPrimitives);
  const roomIds = new Set(rooms.map((room) => room.id));
  const spawnIds = new Set(spawns.map((spawn) => spawn.id));
  const blockerIds = new Set(blockers.map((blocker) => blocker.id));
  const validatesGeneratedEnemyRuntime = asArray(definition.tags).some((tag) => ['ai-authored-location', 'ddplus-export'].includes(tag));
  const usesOutdoorTerrain = definition.terrain !== undefined;

  validateTextureProfiles(definition, warnings, textureAssetExists);

  collectIds([
    { label: 'rooms', items: rooms },
    { label: 'doors', items: connectors },
    { label: 'blockers', items: blockers },
    { label: 'props', items: props },
    { label: 'spawns', items: spawns },
    { label: 'encounterZones', items: encounterZones },
    { label: 'exits', items: exits },
    { label: 'lights', items: definition.lights },
    { label: 'lightFixtures', items: definition.lightFixtures },
    { label: 'torchFixtures', items: definition.torchFixtures },
    { label: 'polygonFloors', items: polygonFloors },
    { label: 'wallSegments', items: wallSegments },
    { label: 'doorGaps', items: doorGaps },
    { label: 'wallPropAnchors', items: wallPropAnchors },
    { label: 'pathRibbons', items: pathRibbons },
    { label: 'platforms', items: platforms },
    { label: 'ramps', items: ramps },
    { label: 'stairs', items: stairs },
    { label: 'bridges', items: bridges },
    { label: 'horizontalSurfaces', items: horizontalSurfaces },
    { label: 'architecturalPrimitives', items: architecturalPrimitives },
    { label: 'splineTrails', items: definition.splineTrails },
    { label: 'riverSplines', items: definition.riverSplines },
    { label: 'creekBeds', items: definition.creekBeds },
    { label: 'curvedBlockers', items: definition.curvedBlockers },
    { label: 'outdoorPrimitives', items: definition.outdoorPrimitives },
    { label: 'decorationZones', items: definition.decorationZones },
  ], errors);

  validateOutdoorAuthoring(definition, errors, warnings);


  polygonFloors.forEach((floor) => {
    const points = asArray(floor.points).map(xzPoint);
    if (points.length < 3) {
      addIssue(errors, 'error', `polygonFloor ${floor.id} needs at least 3 points`, floor.id);
      return;
    }
    if (points.some((point) => !point)) {
      addIssue(errors, 'error', `polygonFloor ${floor.id} has non-finite points`, floor.id);
      return;
    }
    if (polygonArea(points) <= 0.01) {
      addIssue(errors, 'error', `polygonFloor ${floor.id} has near-zero area`, floor.id);
    }
  });

  const wallSegmentById = new Map();
  wallSegments.forEach((segment) => {
    const from = xzPoint(segment.from);
    const to = xzPoint(segment.to);
    if (segment.id) wallSegmentById.set(segment.id, { segment, from, to, length: from && to ? xzDistance(from, to) : 0 });
    if (!from || !to) {
      addIssue(errors, 'error', `wallSegment ${segment.id} has invalid from/to points`, segment.id);
      return;
    }
    if (xzDistance(from, to) <= 0.05) addIssue(errors, 'error', `wallSegment ${segment.id} is too short`, segment.id);
    if ((segment.height ?? 3.5) <= 0) addIssue(errors, 'error', `wallSegment ${segment.id} height must be > 0`, segment.id);
    if ((segment.thickness ?? 0.32) <= 0) addIssue(errors, 'error', `wallSegment ${segment.id} thickness must be > 0`, segment.id);
  });

  validateWallClosure(wallSegments, doorGaps, rooms, warnings);

  doorGaps.forEach((gap) => {
    const wall = wallSegmentById.get(gap.wallSegmentId);
    if (!wall) {
      addIssue(errors, 'error', `doorGap ${gap.id} references missing wallSegmentId ${gap.wallSegmentId}`, gap.id);
      return;
    }
    if (!Number.isFinite(gap.centerT) || gap.centerT < 0 || gap.centerT > 1) addIssue(errors, 'error', `doorGap ${gap.id} centerT must be between 0 and 1`, gap.id);
    if (!Number.isFinite(gap.width) || gap.width <= 0) addIssue(errors, 'error', `doorGap ${gap.id} width must be > 0`, gap.id);
    if (Number.isFinite(gap.width) && gap.width >= wall.length) addIssue(errors, 'error', `doorGap ${gap.id} width must be smaller than wall length`, gap.id);
  });

  const supportedAnchorKinds = new Set(['torchFixture', 'panel', 'marker']);
  wallPropAnchors.forEach((anchor) => {
    if (!wallSegmentById.has(anchor.wallSegmentId)) addIssue(errors, 'error', `wallPropAnchor ${anchor.id} references missing wallSegmentId ${anchor.wallSegmentId}`, anchor.id);
    if (!Number.isFinite(anchor.t) || anchor.t < 0 || anchor.t > 1) addIssue(errors, 'error', `wallPropAnchor ${anchor.id} t must be between 0 and 1`, anchor.id);
    if (!Number.isFinite(anchor.height ?? 0)) addIssue(errors, 'error', `wallPropAnchor ${anchor.id} height must be finite`, anchor.id);
    if (anchor.kind && !supportedAnchorKinds.has(anchor.kind)) addIssue(warnings, 'warning', `wallPropAnchor ${anchor.id} uses unsupported kind ${anchor.kind}`, anchor.id);
  });


  pathRibbons.forEach((ribbon) => {
    const points = asArray(ribbon.points).map(xzPoint);
    if (points.length < 2) addIssue(errors, 'error', `pathRibbon ${ribbon.id} needs at least 2 points`, ribbon.id);
    if (points.some((point) => !point)) addIssue(errors, 'error', `pathRibbon ${ribbon.id} has non-finite points`, ribbon.id);
    if (!Number.isFinite(ribbon.width) || ribbon.width <= 0) addIssue(errors, 'error', `pathRibbon ${ribbon.id} width must be > 0`, ribbon.id);
  });

  platforms.forEach((platform) => {
    const points = asArray(platform.footprint).map(xzPoint);
    if (points.length < 3) addIssue(errors, 'error', `platform ${platform.id} needs at least 3 footprint points`, platform.id);
    if (points.some((point) => !point)) addIssue(errors, 'error', `platform ${platform.id} has non-finite footprint points`, platform.id);
    if (!Number.isFinite(platform.height) || platform.height <= 0) addIssue(errors, 'error', `platform ${platform.id} height must be > 0`, platform.id);
  });

  ramps.forEach((ramp) => {
    if (!xzPoint(ramp.from) || !xzPoint(ramp.to)) addIssue(errors, 'error', `ramp ${ramp.id} has invalid from/to points`, ramp.id);
    if (!Number.isFinite(ramp.width) || ramp.width <= 0) addIssue(errors, 'error', `ramp ${ramp.id} width must be > 0`, ramp.id);
    if (!Number.isFinite(ramp.y0) || !Number.isFinite(ramp.y1)) addIssue(errors, 'error', `ramp ${ramp.id} y0/y1 must be finite`, ramp.id);
  });

  stairs.forEach((stepRun) => {
    if (!xzPoint(stepRun.from) || !xzPoint(stepRun.to)) addIssue(errors, 'error', `stairs ${stepRun.id} has invalid from/to points`, stepRun.id);
    if (!Number.isFinite(stepRun.width) || stepRun.width <= 0) addIssue(errors, 'error', `stairs ${stepRun.id} width must be > 0`, stepRun.id);
    if (!Number.isFinite(stepRun.y0) || !Number.isFinite(stepRun.y1)) addIssue(errors, 'error', `stairs ${stepRun.id} y0/y1 must be finite`, stepRun.id);
    if (!Number.isFinite(stepRun.steps) || stepRun.steps <= 0) addIssue(errors, 'error', `stairs ${stepRun.id} steps must be > 0`, stepRun.id);
  });

  bridges.forEach((bridge) => {
    if (!xzPoint(bridge.from) || !xzPoint(bridge.to)) addIssue(errors, 'error', `bridge ${bridge.id} has invalid from/to points`, bridge.id);
    if (!Number.isFinite(bridge.width) || bridge.width <= 0) addIssue(errors, 'error', `bridge ${bridge.id} width must be > 0`, bridge.id);
    if (!Number.isFinite(bridge.thickness) || bridge.thickness <= 0) addIssue(errors, 'error', `bridge ${bridge.id} thickness must be > 0`, bridge.id);
  });

  horizontalSurfaces.forEach((surface) => {
    if (!HORIZONTAL_SURFACE_KINDS.has(surface.kind)) addIssue(errors, 'error', `horizontalSurface ${surface.id} uses unsupported kind ${surface.kind}`, surface.id);
    if (!HORIZONTAL_SURFACE_SHAPES.has(surface.shape)) addIssue(errors, 'error', `horizontalSurface ${surface.id} uses unsupported shape ${surface.shape}`, surface.id);
    if (surface.roomId && !roomIds.has(surface.roomId)) addIssue(errors, 'error', `horizontalSurface ${surface.id} references missing room ${surface.roomId}`, surface.id);
    if (typeof surface.material !== 'string' || !definition.textures?.[surface.material]) {
      addIssue(errors, 'error', `horizontalSurface ${surface.id} references missing texture profile ${surface.material}`, surface.id);
    }
    if (!Number.isFinite(surface.y ?? surface.center?.[1] ?? surface.center?.y ?? 0)) addIssue(errors, 'error', `horizontalSurface ${surface.id} y must be finite`, surface.id);
    if ((surface.thickness ?? 0.08) <= 0) addIssue(errors, 'error', `horizontalSurface ${surface.id} thickness must be > 0`, surface.id);
    if (surface.shape === 'polygon') {
      const points = asArray(surface.points).map(xzPoint);
      if (points.length < 3) {
        addIssue(errors, 'error', `horizontalSurface ${surface.id} polygon needs at least 3 points`, surface.id);
      } else if (points.some((point) => !point)) {
        addIssue(errors, 'error', `horizontalSurface ${surface.id} has non-finite points`, surface.id);
      } else if (polygonArea(points) <= 0.01) {
        addIssue(errors, 'error', `horizontalSurface ${surface.id} has near-zero area`, surface.id);
      }
    } else if (surface.shape === 'rect') {
      const center = positionOf(surface.center);
      if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.z)) addIssue(errors, 'error', `horizontalSurface ${surface.id} rect needs a finite center`, surface.id);
      if (!Number.isFinite(surface.width) || surface.width <= 0) addIssue(errors, 'error', `horizontalSurface ${surface.id} width must be > 0`, surface.id);
      if (!Number.isFinite(surface.depth) || surface.depth <= 0) addIssue(errors, 'error', `horizontalSurface ${surface.id} depth must be > 0`, surface.id);
      if (!Number.isFinite(surface.yaw ?? 0)) addIssue(errors, 'error', `horizontalSurface ${surface.id} yaw must be finite`, surface.id);
    }
  });

  const stairPrimitiveKinds = new Set(['straightStair', 'wideSacredStair', 'narrowCryptStair', 'brokenStair', 'sunkenSteps', 'daisStair', 'splitStair', 'bridgeStair', 'cornerStair', 'processionalStair']);
  const doorwayPrimitiveKinds = new Set(['thickStoneDoorway', 'openArchPortal', 'bronzeSealedGate', 'lockedRitualGate', 'brokenGateFrame', 'doubleTempleDoor', 'returnPortalFrame', 'sunDiskThreshold', 'narrowCryptPortal', 'grandProcessionalGate']);
  const bridgePrimitiveKinds = new Set(['narrowStoneBridge', 'wideCeremonialBridge', 'brokenBridge', 'plankBridge', 'raisedWalkway', 'canalCrossing', 'bridgeWithRailings', 'archedStoneBridge', 'ritualSpanBridge', 'collapsedWalkway']);
  const columnPrimitiveKinds = new Set(['roundTempleColumn', 'squareStonePillar', 'brokenColumn', 'crackedSupportPillar', 'bronzeBandedColumn', 'glyphCarvedColumn', 'twinColumnFrame', 'massiveHallColumn', 'ruinedColumnBase', 'sacredObeliskColumn']);
  const supportedPrimitiveKinds = new Set(['pillar', 'brokenPillar', 'arch', 'doorFrame', 'lowWall', 'railing', 'altar', 'stela', 'obelisk', 'wallPanel', 'canalWater', 'curb', 'ceilingSlab', 'hangingSign', 'fishingRodDisplay', 'fishDisplay', ...stairPrimitiveKinds, ...doorwayPrimitiveKinds, ...bridgePrimitiveKinds, ...columnPrimitiveKinds]);
  const positive = (primitive, field, fallback = undefined) => {
    const value = primitive[field] ?? fallback;
    if (!Number.isFinite(value) || value <= 0) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} ${field} must be > 0`, primitive.id);
  };
  architecturalPrimitives.forEach((primitive) => {
    if (!supportedPrimitiveKinds.has(primitive.kind)) { addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} uses unsupported kind ${primitive.kind}`, primitive.id); return; }
    const needsPosition = ['pillar', 'brokenPillar', 'arch', 'doorFrame', 'altar', 'stela', 'obelisk', 'ceilingSlab', 'hangingSign', 'fishingRodDisplay', 'fishDisplay'].includes(primitive.kind) || columnPrimitiveKinds.has(primitive.kind) || stairPrimitiveKinds.has(primitive.kind) || doorwayPrimitiveKinds.has(primitive.kind) || bridgePrimitiveKinds.has(primitive.kind);
    const needsLine = ['lowWall', 'railing', 'canalWater', 'curb'].includes(primitive.kind);
    if (needsPosition) {
      const pos = positionOf(primitive.position);
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} has invalid position`, primitive.id);
    }
    if (needsLine && (!xzPoint(primitive.from) || !xzPoint(primitive.to))) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} has invalid from/to points`, primitive.id);
    if (['pillar', 'brokenPillar'].includes(primitive.kind)) { positive(primitive, 'radius', 0.3); positive(primitive, 'height', 2); }
    if (columnPrimitiveKinds.has(primitive.kind)) { positive(primitive, 'height', primitive.kind === 'ruinedColumnBase' ? 0.6 : 2); if (primitive.radius !== undefined) positive(primitive, 'radius', 0.25); if (primitive.width !== undefined) positive(primitive, 'width', 0.5); if (primitive.depth !== undefined) positive(primitive, 'depth', 0.5); if (!Number.isFinite(primitive.yaw ?? primitive.rotation ?? 0)) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} yaw must be finite`, primitive.id); const state = primitive.state ?? (primitive.broken ? 'broken' : primitive.cracked ? 'cracked' : primitive.ruined ? 'ruined' : 'intact'); if (!['intact', 'broken', 'cracked', 'ruined'].includes(state)) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} has invalid column state ${state}`, primitive.id); ['shaftMaterial', 'baseMaterial', 'capitalMaterial', 'bandMaterial', 'glyphMaterial', 'trimMaterial'].forEach((slot) => { if (primitive[slot] && typeof primitive[slot] === 'string' && !definition.textures?.[primitive[slot]]) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} references missing texture profile ${primitive[slot]} in ${slot}`, primitive.id); }); }
    if (['arch', 'doorFrame'].includes(primitive.kind)) { positive(primitive, 'width', 2); positive(primitive, 'height', 3); positive(primitive, 'thickness', 0.35); if ((primitive.width ?? 2) <= (primitive.thickness ?? 0.35) * 2) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} opening width is too small for side posts`, primitive.id); }
    if (doorwayPrimitiveKinds.has(primitive.kind)) { positive(primitive, 'width', primitive.kind === 'narrowCryptPortal' ? 1.25 : 2.8); positive(primitive, 'height', 3.2); positive(primitive, primitive.depth === undefined ? 'thickness' : 'depth', 0.4); if (!Number.isFinite(primitive.yaw ?? primitive.rotation ?? 0)) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} yaw must be finite`, primitive.id); const state = primitive.state ?? (primitive.open === true || primitive.passable === true ? 'open' : undefined) ?? (primitive.blocked ? 'blocked' : 'closed'); if (!['open', 'closed', 'locked', 'blocked', 'sealed'].includes(state)) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} has invalid doorway state ${state}`, primitive.id); ['frameMaterial', 'doorMaterial', 'trimMaterial', 'emblemMaterial'].forEach((slot) => { if (primitive[slot] && typeof primitive[slot] === 'string' && !definition.textures?.[primitive[slot]]) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} references missing texture profile ${primitive[slot]} in ${slot}`, primitive.id); }); if ((primitive.width ?? 2.8) <= Math.max(0.22, primitive.frameWidth ?? primitive.thickness ?? primitive.depth ?? 0.45) * 2) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} opening width is too small for doorway frame`, primitive.id); }

    if (bridgePrimitiveKinds.has(primitive.kind)) {
      positive(primitive, 'width', primitive.kind === 'wideCeremonialBridge' ? 5 : 2.4);
      positive(primitive, 'length', 6);
      positive(primitive, 'height', 0.18);
      if (!Number.isFinite(primitive.deckY ?? primitive.position?.y ?? primitive.position?.[1] ?? 0)) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} deckY must be finite`, primitive.id);
      if (!Number.isFinite(primitive.yaw ?? primitive.rotation ?? 0)) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} yaw must be finite`, primitive.id);
      const state = primitive.state ?? (primitive.broken ? 'broken' : 'intact');
      if (!['intact', 'broken', 'collapsed'].includes(state)) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} has invalid bridge state ${state}`, primitive.id);
      if (primitive.kind === 'collapsedWalkway' && state === 'intact') addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} collapsedWalkway cannot be intact`, primitive.id);
      if ((primitive.gapLength ?? 0) >= (primitive.length ?? 6)) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} gapLength must be smaller than length`, primitive.id);
      ['deckMaterial', 'sideMaterial', 'trimMaterial', 'railingMaterial', 'undersideMaterial', 'waterMaterial'].forEach((slot) => { if (primitive[slot] && typeof primitive[slot] === 'string' && !definition.textures?.[primitive[slot]]) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} references missing texture profile ${primitive[slot]} in ${slot}`, primitive.id); });
    }
    if (['lowWall', 'railing', 'canalWater', 'curb'].includes(primitive.kind)) { if (primitive.kind === 'canalWater') positive(primitive, 'width', 1); positive(primitive, 'height', primitive.kind === 'canalWater' ? 0.03 : (primitive.kind === 'curb' ? 0.22 : 0.7)); if (primitive.kind !== 'canalWater') positive(primitive, 'thickness', 0.2); }
    if (['altar', 'stela'].includes(primitive.kind)) { positive(primitive, 'width', 1); positive(primitive, 'height', 1); positive(primitive, 'thickness', primitive.kind === 'stela' ? 0.2 : 0.1); }
    if (primitive.kind === 'obelisk') { positive(primitive, 'height', 3); positive(primitive, 'baseWidth', 0.7); }
    if (primitive.kind === 'ceilingSlab') { positive(primitive, 'width', 4); positive(primitive, 'depth', 4); positive(primitive, 'thickness', 0.2); }
    if (primitive.kind === 'hangingSign') { positive(primitive, 'width', 4); positive(primitive, 'height', 1.5); positive(primitive, 'thickness', 0.12); if (!Number.isFinite(primitive.yaw ?? 0)) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} yaw must be finite`, primitive.id); }
    if (stairPrimitiveKinds.has(primitive.kind)) {
      positive(primitive, 'width', primitive.kind === 'narrowCryptStair' ? 1.2 : 2.4);
      positive(primitive, 'height', 1.2);
      positive(primitive, primitive.length === undefined ? 'depth' : 'length', 4);
      const steps = primitive.stepCount ?? primitive.steps ?? 6;
      if (!Number.isInteger(steps) || steps < 1 || steps > 64) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} stepCount must be an integer from 1 to 64`, primitive.id);
      if (!Number.isFinite(primitive.yaw ?? primitive.rotation ?? 0)) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} yaw must be finite`, primitive.id);
      ['treadMaterial', 'riserMaterial', 'sideMaterial', 'trimMaterial', 'railingMaterial'].forEach((slot) => {
        if (primitive[slot] && typeof primitive[slot] === 'string' && !definition.textures?.[primitive[slot]]) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} references missing texture profile ${primitive[slot]} in ${slot}`, primitive.id);
      });
      asArray(primitive.missingSteps ?? primitive.brokenSteps).forEach((step) => {
        if (!Number.isInteger(step) || step < 0 || step >= steps) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} missing step ${step} is outside stepCount`, primitive.id);
      });
    }
    if (primitive.kind === 'wallPanel') { if (!wallSegmentById.has(primitive.wallSegmentId)) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} references missing wallSegmentId ${primitive.wallSegmentId}`, primitive.id); if (!Number.isFinite(primitive.t) || primitive.t < 0 || primitive.t > 1) addIssue(errors, 'error', `architecturalPrimitive ${primitive.id} t must be between 0 and 1`, primitive.id); positive(primitive, 'height', 1); positive(primitive, 'width', 1); }
  });

  rooms.forEach((room) => {
    if (room.minX >= room.maxX || room.minZ >= room.maxZ) {
      addIssue(errors, 'error', `room ${room.id} has inverted bounds`, room.id);
    }
  });

  blockers.forEach((blocker) => {
    if (blocker.minX >= blocker.maxX || blocker.minZ >= blocker.maxZ) {
      addIssue(errors, 'error', `blocker ${blocker.id} has inverted bounds`, blocker.id);
    }
  });

  const blockerRects = blockers.filter((blocker) => blocker.blocksPlayer !== false || blocker.blocksEnemies !== false);
  spawns.forEach((spawn) => {
    const position = positionOf(spawn.position);
    if (!position) {
      addIssue(errors, 'error', `spawn ${spawn.id} is missing position`, spawn.id);
      return;
    }
    const room = rooms.find((candidate) => candidate.id === spawn.roomId);
    const containingWalkable = rooms.find((candidate) => pointInRect(position, candidate));
    const overlappingBlocker = blockerRects.find((blocker) => circleIntersectsRect(position, spawn.kind === 'enemy' ? 0.58 : 0.5, blocker));
    const clearanceRect = containingWalkable ?? room;
    const clearance = clearanceRect ? pointRectClearance(position, clearanceRect) : -Infinity;
    const allowsNearWall = spawn.userData?.allowNearWall || asArray(spawn.tags).includes('allow-near-wall');

    if (spawn.roomId && !roomIds.has(spawn.roomId)) {
      addIssue(errors, 'error', `spawn ${spawn.id} references missing room ${spawn.roomId}`, spawn.id);
    }
    if (['player', 'return', 'enemy'].includes(spawn.kind) && !containingWalkable && !usesOutdoorTerrain) {
      addIssue(errors, 'error', `${spawn.kind} spawn ${spawn.id} is outside walkable room rectangles`, spawn.id);
    }
    if (['player', 'return', 'enemy'].includes(spawn.kind) && overlappingBlocker) {
      addIssue(errors, 'error', `${spawn.kind} spawn ${spawn.id} overlaps blocker ${overlappingBlocker.id}`, spawn.id);
    }
    if (spawn.kind === 'enemy' && clearance < 0.75) {
      addIssue(warnings, 'warning', `spawn ${spawn.id} has low clearance near room wall`, spawn.id);
    }
    if (validatesGeneratedEnemyRuntime && spawn.kind === 'enemy' && !RUNTIME_ENEMY_SPECIES.has(spawn.species)) {
      addIssue(warnings, 'warning', `enemy spawn ${spawn.id} uses unknown runtime species ${spawn.species}`, spawn.id);
    }
    if (validatesGeneratedEnemyRuntime && spawn.kind === 'enemy' && !spawn.roomId) {
      addIssue(warnings, 'warning', `enemy spawn ${spawn.id} is missing roomId`, spawn.id);
    }
    if (validatesGeneratedEnemyRuntime && spawn.kind === 'enemy') {
      asArray(spawn.userData?.patrolPoints).forEach((point, index) => {
        const patrolPosition = positionOf(point);
        if (!patrolPosition || !rooms.some((candidate) => pointInRect(patrolPosition, candidate))) {
          addIssue(warnings, 'warning', `enemy spawn ${spawn.id} patrol point ${index} is outside walkable room rectangles`, spawn.id);
        } else if (blockerRects.find((blocker) => circleIntersectsRect(patrolPosition, 0.58, blocker))) {
          addIssue(warnings, 'warning', `enemy spawn ${spawn.id} patrol point ${index} overlaps a blocker`, spawn.id);
        }
      });
    }
    if (['player', 'return', 'enemy'].includes(spawn.kind) && !usesOutdoorTerrain && !allowsNearWall && clearance < 0.7) {
      addIssue(warnings, 'warning', `spawn ${spawn.id} is close to a wall`, spawn.id);
    }
  });

  encounterZones.forEach((zone) => {
    asArray(zone.roomIds).forEach((roomId) => {
      if (!roomIds.has(roomId)) {
        addIssue(errors, 'error', `encounter zone ${zone.id} references missing room ${roomId}`, zone.id);
      }
    });
  });

  exits.forEach((exit) => {
    if (!exit.destinationSpawnId) {
      addIssue(errors, 'error', `exit ${exit.id} is missing destinationSpawnId`, exit.id);
    } else if (exit.toLocation === definition.id && !spawnIds.has(exit.destinationSpawnId) && !destinationSpawnIds.has(exit.destinationSpawnId)) {
      addIssue(errors, 'error', `exit ${exit.id} references missing destinationSpawnId ${exit.destinationSpawnId}`, exit.id);
    }
  });

  connectors.forEach((door) => {
    if (door.fromRoom && !roomIds.has(door.fromRoom)) {
      addIssue(errors, 'error', `door ${door.id} references missing fromRoom ${door.fromRoom}`, door.id);
    }
    if (door.toRoom && !roomIds.has(door.toRoom)) {
      addIssue(errors, 'error', `door ${door.id} references missing toRoom ${door.toRoom}`, door.id);
    }
    const waypoint = positionOf(door.navWaypoint ?? door.position);
    if (waypoint && !rooms.some((room) => pointInRect(waypoint, room, 0.75))) {
      addIssue(warnings, 'warning', `door ${door.id} waypoint is outside authored walkable rectangles`, door.id);
    }
  });

  asArray(definition.navigation?.roomGraph?.links).forEach((link) => {
    if (!roomIds.has(link.fromRoom)) addIssue(errors, 'error', `nav link references missing fromRoom ${link.fromRoom}`, link.id);
    if (!roomIds.has(link.toRoom)) addIssue(errors, 'error', `nav link references missing toRoom ${link.toRoom}`, link.id);
    const waypoint = positionOf(link.navWaypoint ?? link.position);
    if (waypoint && !rooms.some((room) => pointInRect(waypoint, room, 0.75))) {
      addIssue(warnings, 'warning', `nav link ${link.id ?? `${link.fromRoom}-${link.toRoom}`} waypoint is outside walkable rectangles`, link.id);
    }
  });

  props.forEach((prop) => {
    if (!prop.collisionRef) return;
    if (!blockerIds.has(prop.collisionRef)) {
      addIssue(errors, 'error', `prop ${prop.id} references missing collisionRef ${prop.collisionRef}`, prop.id);
      return;
    }
    if (!prop.position || !prop.dimensions) return;
    const blocker = blockers.find((candidate) => candidate.id === prop.collisionRef);
    const position = positionOf(prop.position);
    const expected = {
      minX: position.x - prop.dimensions.width / 2,
      maxX: position.x + prop.dimensions.width / 2,
      minZ: position.z - prop.dimensions.depth / 2,
      maxZ: position.z + prop.dimensions.depth / 2,
    };
    if (!rectsApproximatelyAlign(expected, blocker)) {
      addIssue(warnings, 'warning', `prop ${prop.id} collisionRef ${prop.collisionRef} does not align with prop footprint`, prop.id);
    }
  });

  return {
    locationId: definition.id,
    errors,
    warnings,
    ok: errors.length === 0,
  };
}

export function logDungeonValidation(validation) {
  const key = `${validation.locationId}:${validation.errors.length}:${validation.warnings.length}`;
  if (loggedValidationKeys.has(key)) return;
  loggedValidationKeys.add(key);

  console.info(`[DUNGEON VALIDATION] ${validation.locationId}: ${validation.errors.length} errors, ${validation.warnings.length} warnings`);
  [...validation.errors, ...validation.warnings].slice(0, 10).forEach((issue) => {
    console.warn(`${issue.severity}: ${issue.message}`);
  });
}
