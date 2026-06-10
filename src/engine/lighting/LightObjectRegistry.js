import * as THREE from 'three';
import { asArray } from '../dungeon-authoring/DungeonDefinitionTypes.js';
import { resolveTorchLightingProfile, TORCH_LIGHT_BUDGETS } from './TorchLightingProfile.js';

const WALL_NORMALS = Object.freeze({
  north: Object.freeze({ x: 0, y: 0, z: -1 }),
  south: Object.freeze({ x: 0, y: 0, z: 1 }),
  east: Object.freeze({ x: -1, y: 0, z: 0 }),
  west: Object.freeze({ x: 1, y: 0, z: 0 }),
});

function toVector3Data(value, fallbackY = 0) {
  return {
    x: Number(value?.x ?? value?.[0] ?? 0),
    y: Number(value?.y ?? value?.[1] ?? fallbackY),
    z: Number(value?.z ?? value?.[2] ?? 0),
  };
}

function normalizeXZ(value, fallback = { x: 0, y: 0, z: 1 }) {
  const vector = new THREE.Vector3(
    Number(value?.x ?? value?.[0] ?? fallback.x),
    0,
    Number(value?.z ?? value?.[2] ?? fallback.z),
  );
  if (vector.lengthSq() < 0.0001) vector.set(fallback.x, 0, fallback.z);
  vector.normalize();
  return { x: vector.x, y: 0, z: vector.z };
}

function yawFromNormal(normal) {
  return Math.atan2(normal.x, normal.z);
}

function findRoom(definition, roomId) {
  return asArray(definition.rooms).find((room) => room.id === roomId) ?? null;
}

function clampDistanceAlongWall(room, wallSide, distanceAlongWall = 0, insetFromCorner = 1.1) {
  if (wallSide === 'north' || wallSide === 'south') {
    return THREE.MathUtils.clamp(room.minX + distanceAlongWall, room.minX + insetFromCorner, room.maxX - insetFromCorner);
  }
  return THREE.MathUtils.clamp(room.minZ + distanceAlongWall, room.minZ + insetFromCorner, room.maxZ - insetFromCorner);
}

function resolveWallAnchoredFixture(definition, fixture, index) {
  const room = findRoom(definition, fixture.roomId);
  const wallSide = fixture.wallSide;
  const normal = normalizeXZ(WALL_NORMALS[wallSide]);
  const height = fixture.height ?? 1.72;
  const offsetFromWall = fixture.offsetFromWall ?? 0.16;
  const insetFromCorner = fixture.insetFromCorner ?? 1.15;
  let position = { x: 0, y: height, z: 0 };
  let wallAnchor = { x: 0, y: height, z: 0 };

  if (room && WALL_NORMALS[wallSide]) {
    if (wallSide === 'north') {
      wallAnchor = { x: clampDistanceAlongWall(room, wallSide, fixture.distanceAlongWall, insetFromCorner), y: height, z: room.maxZ };
    } else if (wallSide === 'south') {
      wallAnchor = { x: clampDistanceAlongWall(room, wallSide, fixture.distanceAlongWall, insetFromCorner), y: height, z: room.minZ };
    } else if (wallSide === 'east') {
      wallAnchor = { x: room.maxX, y: height, z: clampDistanceAlongWall(room, wallSide, fixture.distanceAlongWall, insetFromCorner) };
    } else if (wallSide === 'west') {
      wallAnchor = { x: room.minX, y: height, z: clampDistanceAlongWall(room, wallSide, fixture.distanceAlongWall, insetFromCorner) };
    }
    position = {
      x: wallAnchor.x + normal.x * offsetFromWall,
      y: height,
      z: wallAnchor.z + normal.z * offsetFromWall,
    };
  }

  const profile = resolveTorchLightingProfile(fixture.profile ?? fixture.lightingProfile, fixture.lighting);
  const lightOffset = fixture.lightOffset ?? profile.lightOffset ?? 0.38;

  return {
    ...fixture,
    id: fixture.id ?? `${definition.id}-torch-${index + 1}`,
    locationId: definition.id,
    kind: 'torch',
    authoringMode: 'wallAnchored',
    roomId: fixture.roomId,
    wallSide,
    height,
    offsetFromWall,
    wallAnchor,
    position,
    wallNormal: normal,
    yaw: fixture.yaw ?? yawFromNormal(normal),
    profile,
    lightPosition: {
      x: position.x + normal.x * lightOffset,
      y: position.y + 0.14,
      z: position.z + normal.z * lightOffset,
    },
    flickerPhase: fixture.flickerPhase ?? index * 1.913,
    debug: fixture.debug ?? {},
  };
}

function resolveExplicitFixture(definition, fixture, index) {
  const height = fixture.height ?? fixture.position?.y ?? fixture.position?.[1] ?? 1.72;
  const position = toVector3Data(fixture.position, height);
  position.y = height;
  const normal = normalizeXZ(fixture.wallNormal ?? fixture.normal, fixture.yaw !== undefined
    ? { x: Math.sin(fixture.yaw), y: 0, z: Math.cos(fixture.yaw) }
    : { x: 0, y: 0, z: 1 });
  const profile = resolveTorchLightingProfile(fixture.profile ?? fixture.lightingProfile, fixture.lighting);
  const lightOffset = fixture.lightOffset ?? profile.lightOffset ?? 0.38;

  return {
    ...fixture,
    id: fixture.id ?? `${definition.id}-torch-${index + 1}`,
    locationId: definition.id,
    kind: 'torch',
    authoringMode: 'explicit',
    height,
    offsetFromWall: fixture.offsetFromWall ?? 0.16,
    position,
    wallNormal: normal,
    yaw: fixture.yaw ?? fixture.rotationY ?? yawFromNormal(normal),
    profile,
    lightPosition: {
      x: position.x + normal.x * lightOffset,
      y: position.y + 0.14,
      z: position.z + normal.z * lightOffset,
    },
    flickerPhase: fixture.flickerPhase ?? index * 1.913,
    debug: fixture.debug ?? {},
  };
}

function applyLightBudget(torchFixtures, budget) {
  const active = [];
  const perRoomCost = new Map();

  return torchFixtures.map((fixture) => {
    const roomCost = perRoomCost.get(fixture.roomId) ?? 0;
    const tier = fixture.profile.mobileCostTier ?? 1;
    const canUsePointLight = active.length < budget.maxActivePointLights
      && roomCost + tier <= budget.maxCostTierPerRoom
      && fixture.lightEnabled !== false;
    if (canUsePointLight) {
      active.push(fixture.id);
      perRoomCost.set(fixture.roomId, roomCost + tier);
    }
    return {
      ...fixture,
      lightEnabled: canUsePointLight,
      budgetState: canUsePointLight ? 'active-point-light' : 'visual-only',
    };
  });
}

export function buildLightObjectRegistry(definition, { platform = 'desktop' } = {}) {
  const authoredFixtures = [
    ...asArray(definition.torchFixtures),
    ...asArray(definition.lightFixtures).filter((fixture) => fixture.kind === 'torch'),
    ...asArray(definition.lights).filter((light) => light.kind === 'torch').map((light) => ({
      ...light,
      profile: light.profile ?? 'dungeonTorch',
      lighting: {
        color: light.color,
        intensity: light.intensity,
        distance: light.distance,
        decay: light.decay,
      },
    })),
  ];
  const torchFixtures = authoredFixtures.map((fixture, index) => (
    fixture.wallSide
      ? resolveWallAnchoredFixture(definition, fixture, index)
      : resolveExplicitFixture(definition, fixture, index)
  ));
  const budget = TORCH_LIGHT_BUDGETS[platform] ?? TORCH_LIGHT_BUDGETS.desktop;
  const budgetedTorchFixtures = applyLightBudget(torchFixtures, budget);
  const nonTorchLights = asArray(definition.lights).filter((light) => light.kind !== 'torch');
  const legacyTorchLights = asArray(definition.lights).filter((light) => light.kind === 'torch');

  return {
    locationId: definition.id,
    platform,
    budget,
    lightFixtures: budgetedTorchFixtures,
    torchFixtures: budgetedTorchFixtures,
    pointLights: [
      ...nonTorchLights.filter((light) => light.kind === 'point'),
      ...budgetedTorchFixtures.filter((fixture) => fixture.lightEnabled !== false),
    ],
    nonTorchLights,
    legacyTorchLights,
  };
}
