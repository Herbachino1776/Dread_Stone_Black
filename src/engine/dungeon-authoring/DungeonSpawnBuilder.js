import * as THREE from 'three';
import { asArray } from './DungeonDefinitionTypes.js';

function toVector3(value, fallbackY = 0) {
  return new THREE.Vector3(
    Number(value?.x ?? value?.[0] ?? 0),
    Number(value?.y ?? value?.[1] ?? fallbackY),
    Number(value?.z ?? value?.[2] ?? 0),
  );
}

export function buildDungeonSpawns(definition) {
  return asArray(definition.spawns).map((spawn) => ({
    id: spawn.id,
    kind: spawn.kind,
    species: spawn.species,
    faction: spawn.faction,
    preferredFaction: spawn.faction ?? spawn.userData?.preferredFaction ?? 'neutral',
    position: toVector3(spawn.position),
    yaw: spawn.yaw ?? 0,
    roomId: spawn.roomId,
    minDistanceFromPlayer: spawn.minDistanceFromPlayer,
    allowedForInitialWave: Boolean(spawn.allowedForInitialWave),
    initialWave: Boolean(spawn.allowedForInitialWave),
    allowedForRespawn: spawn.allowedForRespawn !== false,
    patrolPoints: Object.freeze(asArray(spawn.userData?.patrolPoints).map((point) => toVector3(point))),
    actionBubblePriority: spawn.actionBubblePriority ?? 0,
    tags: spawn.tags ?? [],
    userData: spawn.userData ?? {},
  }));
}
