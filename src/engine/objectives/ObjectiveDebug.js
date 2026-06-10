export function createObjectiveDebugInfo(runtime) {
  return {
    activeObjectives: runtime.getActiveObjectives().map((objective) => objective.id),
    completedObjectives: [...runtime.objectiveStates.values()]
      .filter((state) => state.status === 'complete')
      .map((state) => state.id),
    flags: [...runtime.facts.flags],
    lastObjectiveEvent: runtime.lastEvent,
    currentLocationObjectivePack: runtime.currentLocationObjectivePack,
    stepStates: Object.fromEntries([...runtime.objectiveStates.entries()].map(([id, state]) => [
      id,
      Object.fromEntries(Object.entries(state.stepStates).map(([stepId, step]) => [stepId, step.status])),
    ])),
  };
}
