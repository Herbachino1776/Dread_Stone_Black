import * as THREE from 'three';

function summarizeVector(vector) {
  return {
    x: Number(vector.x.toFixed(2)),
    y: Number(vector.y.toFixed(2)),
    z: Number(vector.z.toFixed(2)),
  };
}

export function buildCreatureDebugInfo(actor, controllerState = {}) {
  const box = actor.group
    ? new THREE.Box3().setFromObject(actor.group)
    : new THREE.Box3();
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());

  return {
    creatureId: actor.config.id,
    species: actor.config.identity?.species,
    role: actor.config.identity?.role,
    currentAnimation: actor.animationSet?.currentState ?? null,
    currentBehaviorState: controllerState.behaviorState ?? actor.group?.userData.behaviorState ?? null,
    health: actor.health,
    targetId: controllerState.targetId ?? null,
    boundingBox: summarizeVector(size),
    scale: actor.group?.scale ? summarizeVector(actor.group.scale) : null,
    groundOffset: actor.config.scale?.groundOffset ?? 0,
    loadedAnimations: actor.animationSet?.getLoadedStates() ?? [],
    missingAnimations: actor.animationSet?.getMissingStates() ?? [],
  };
}

export class CreatureDebugInfo {
  static build(actor, controllerState = {}) {
    return buildCreatureDebugInfo(actor, controllerState);
  }
}
