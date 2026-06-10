import * as THREE from 'three';
import { asArray } from './DungeonDefinitionTypes.js';

function toVector3(value, fallbackY = 0) {
  return new THREE.Vector3(
    Number(value?.x ?? value?.[0] ?? 0),
    Number(value?.y ?? value?.[1] ?? fallbackY),
    Number(value?.z ?? value?.[2] ?? 0),
  );
}

function centerForRoom(room) {
  return room.userData?.navCenter
    ? toVector3(room.userData.navCenter)
    : new THREE.Vector3((room.minX + room.maxX) / 2, room.floorY ?? 0, (room.minZ + room.maxZ) / 2);
}

export function buildDungeonNavigation(definition) {
  const navConfig = definition.navigation ?? {};
  const configuredRoomIds = asArray(navConfig.roomGraph?.roomIds);
  const navRoomIds = new Set(configuredRoomIds.length
    ? configuredRoomIds
    : asArray(definition.rooms).filter((room) => !asArray(room.tags).includes('connector')).map((room) => room.id));
  const navRooms = asArray(definition.rooms)
    .filter((room) => navRoomIds.has(room.id))
    .map((room) => [room.id, {
      id: room.id,
      label: room.label,
      minX: room.minX,
      maxX: room.maxX,
      minZ: room.minZ,
      maxZ: room.maxZ,
      center: centerForRoom(room),
      tags: room.tags ?? [],
      encounterWeight: room.encounterWeight ?? 1,
      safeForSpawn: room.safeForSpawn !== false,
    }]);
  const links = new Map(navRooms.map(([id]) => [id, []]));

  const addLink = (fromRoom, toRoom, waypoint, linkData = {}) => {
    if (!links.has(fromRoom) || !links.has(toRoom)) return;
    const vector = toVector3(waypoint);
    links.get(fromRoom).push({
      to: toRoom,
      waypoint: vector,
      doorId: linkData.doorId ?? linkData.id,
      blockedByGate: linkData.blockedByGate,
      interactionId: linkData.interactionId,
      tags: linkData.tags ?? [],
    });
    links.get(toRoom).push({
      to: fromRoom,
      waypoint: vector.clone(),
      doorId: linkData.doorId ?? linkData.id,
      blockedByGate: linkData.blockedByGate,
      interactionId: linkData.interactionId,
      tags: linkData.tags ?? [],
    });
  };

  const explicitLinks = asArray(navConfig.roomGraph?.links);
  if (explicitLinks.length) {
    explicitLinks.forEach((link) => addLink(
      link.fromRoom,
      link.toRoom,
      link.navWaypoint ?? link.position,
      link,
    ));
  } else {
    asArray(definition.doors ?? definition.connectors).forEach((door) => {
      if (!door.fromRoom || !door.toRoom) return;
      addLink(door.fromRoom, door.toRoom, door.navWaypoint ?? door.position, { ...door, doorId: door.id });
    });
  }

  return {
    rooms: Object.fromEntries(navRooms),
    links: Object.fromEntries(links),
    doorwayWaypoints: asArray(definition.doors ?? definition.connectors).map((door) => ({
      id: door.id,
      fromRoom: door.fromRoom,
      toRoom: door.toRoom,
      position: toVector3(door.navWaypoint ?? door.position),
      width: door.width,
      tags: door.tags ?? [],
    })),
    localAvoidanceHints: navConfig.localAvoidanceHints ?? [],
    forbiddenZones: navConfig.forbiddenZones ?? [],
    preferredPatrolRoutes: navConfig.preferredPatrolRoutes ?? [],
  };
}
