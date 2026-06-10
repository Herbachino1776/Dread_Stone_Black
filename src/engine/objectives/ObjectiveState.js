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
    visitedLocationIds: new Set(snapshot.visitedLocationIds ?? []),
    visitedRoomIds: new Set(snapshot.visitedRoomIds ?? []),
    damagedEnemyIds: new Set(snapshot.damagedEnemyIds ?? []),
    damagedSpecies: new Set(snapshot.damagedSpecies ?? []),
    killedEnemyIds: new Set(snapshot.killedEnemyIds ?? []),
    killedSpecies: new Set(snapshot.killedSpecies ?? []),
    factionKills: new Map(Object.entries(snapshot.factionKills ?? {})),
    locationCompletionIds: new Set(snapshot.locationCompletionIds ?? []),
    acquiredRewardIds: new Set(snapshot.acquiredRewardIds ?? []),
  };
}

export function serializeFacts(facts) {
  return {
    flags: [...facts.flags],
    usedInteractionIds: [...facts.usedInteractionIds],
    visitedLocationIds: [...facts.visitedLocationIds],
    visitedRoomIds: [...facts.visitedRoomIds],
    damagedEnemyIds: [...facts.damagedEnemyIds],
    damagedSpecies: [...facts.damagedSpecies],
    killedEnemyIds: [...facts.killedEnemyIds],
    killedSpecies: [...facts.killedSpecies],
    factionKills: Object.fromEntries(facts.factionKills),
    locationCompletionIds: [...facts.locationCompletionIds],
    acquiredRewardIds: [...facts.acquiredRewardIds],
  };
}
