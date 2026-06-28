export const OBJECTIVE_STATUS = Object.freeze({
  locked: 'locked',
  active: 'active',
  complete: 'complete',
  failed: 'failed',
});

export function createObjectiveState(definition) {
  return {
    id: definition.id,
    locationId: definition.locationId,
    status: OBJECTIVE_STATUS.locked,
    visible: definition.visible === true && definition.hidden !== true,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    stepStates: Object.fromEntries((definition.steps ?? []).map((step) => [
      step.id,
      {
        id: step.id,
        status: step.state ?? OBJECTIVE_STATUS.locked,
        startedAt: null,
        completedAt: null,
        failedAt: null,
      },
    ])),
  };
}

export function createObjectiveFacts(snapshot = {}) {
  return {
    flags: new Set(snapshot.flags ?? []),
    usedInteractionIds: new Set(snapshot.usedInteractionIds ?? []),
    chestOpenedInteractionIds: new Set(snapshot.chestOpenedInteractionIds ?? []),
    visitedLocationIds: new Set(snapshot.visitedLocationIds ?? []),
    visitedRoomIds: new Set(snapshot.visitedRoomIds ?? []),
    damagedSpecies: new Set(snapshot.damagedSpecies ?? []),
    killedSpecies: new Set(snapshot.killedSpecies ?? []),
    locationCompletionIds: new Set(snapshot.locationCompletionIds ?? []),
    acquiredRewardIds: new Set(snapshot.acquiredRewardIds ?? []),
  };
}

export function serializeFacts(facts) {
  return {
    flags: [...facts.flags],
    usedInteractionIds: [...facts.usedInteractionIds],
    chestOpenedInteractionIds: [...facts.chestOpenedInteractionIds],
    visitedLocationIds: [...facts.visitedLocationIds],
    visitedRoomIds: [...facts.visitedRoomIds],
    damagedSpecies: [...facts.damagedSpecies],
    killedSpecies: [...facts.killedSpecies],
    locationCompletionIds: [...facts.locationCompletionIds],
    acquiredRewardIds: [...facts.acquiredRewardIds],
  };
}
