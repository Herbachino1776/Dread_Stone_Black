export function createObjectiveDebugInfo(runtime) {
  const activeStates = [...runtime.objectiveStates.values()].filter((state) => state.status === 'active');
  return {
    activeObjectives: activeStates.map((state) => state.id),
    visibleActiveObjectives: runtime.getActiveObjectives().map((objective) => objective.id),
    silentActiveObjectives: activeStates
      .filter((state) => runtime.definitions.get(state.id)?.silent)
      .map((state) => state.id),
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
