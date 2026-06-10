export const OBJECTIVE_SNAPSHOT_VERSION = 1;

export function normalizeObjectiveSnapshot(snapshot = null) {
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      version: OBJECTIVE_SNAPSHOT_VERSION,
      objectiveStates: [],
      facts: {},
      lastEvent: null,
      debug: {},
    };
  }

  return {
    version: snapshot.version ?? OBJECTIVE_SNAPSHOT_VERSION,
    objectiveStates: snapshot.objectiveStates ?? [],
    facts: snapshot.facts ?? {},
    lastEvent: snapshot.lastEvent ?? null,
    debug: snapshot.debug ?? {},
  };
}
