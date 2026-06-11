import { validateObjectiveDefinitions } from './ObjectiveDefinition.js';
import { executeObjectiveAction } from './ObjectiveActions.js';
import { evaluateObjectiveCondition } from './ObjectiveConditions.js';
import { createObjectiveEvent, objectiveEventMatches, OBJECTIVE_EVENTS } from './ObjectiveEvents.js';
import { normalizeObjectiveSnapshot, OBJECTIVE_SNAPSHOT_VERSION } from './ObjectivePersistence.js';
import { createObjectiveFacts, createObjectiveState, OBJECTIVE_STATUS, serializeFacts } from './ObjectiveState.js';
import { createObjectiveDebugInfo } from './ObjectiveDebug.js';

export class ObjectiveRuntime {
  constructor({
    context = {},
    callbacks = {},
    validation = {},
  } = {}) {
    this.context = context;
    this.callbacks = callbacks;
    this.validationOptions = validation;
    this.definitions = new Map();
    this.definitionsByLocation = new Map();
    this.objectiveStates = new Map();
    this.facts = createObjectiveFacts();
    this.listeners = new Map();
    this.lastEvent = null;
    this.currentLocationObjectivePack = null;
    this.loggedTransitions = new Set();
  }

  on(eventName, listener) {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName).add(listener);
    return () => this.listeners.get(eventName)?.delete(listener);
  }

  notify(eventName, payload) {
    this.listeners.get(eventName)?.forEach((listener) => listener(payload));
    this.callbacks[eventName]?.(payload);
  }

  registerLocationObjectives(locationId, definitions, { objectivePackId = null, validation = {}, silent = false } = {}) {
    const normalizedDefinitions = (definitions ?? []).map((definition) => {
      const definitionIsSilent = definition.silent ?? silent;
      return {
        ...definition,
        silent: definitionIsSilent,
        visible: definitionIsSilent ? false : definition.visible,
        hidden: definitionIsSilent ? true : definition.hidden,
        steps: (definition.steps ?? []).map((step) => ({
          ...step,
          silent: step.silent ?? definitionIsSilent,
        })),
      };
    });
    const result = validateObjectiveDefinitions(normalizedDefinitions, {
      ...this.validationOptions,
      ...validation,
    });
    if (!result.ok) {
      result.errors.forEach((issue) => console.error(`[OBJECTIVES] ${issue.message}`));
    }
    result.warnings.forEach((issue) => console.warn(`[OBJECTIVES] ${issue.message}`));

    normalizedDefinitions.forEach((definition) => {
      if (this.definitions.has(definition.id)) {
        console.warn(`[OBJECTIVES] Duplicate objective id ignored: ${definition.id}`);
        return;
      }
      this.definitions.set(definition.id, definition);
      if (!this.definitionsByLocation.has(locationId)) this.definitionsByLocation.set(locationId, []);
      this.definitionsByLocation.get(locationId).push(definition.id);
      if (!this.objectiveStates.has(definition.id)) {
        this.objectiveStates.set(definition.id, createObjectiveState(definition));
      }
    });

    this.currentLocationObjectivePack = objectivePackId ?? locationId;
    return result;
  }

  startObjective(objectiveId, options = {}) {
    const definition = this.definitions.get(objectiveId);
    const state = this.objectiveStates.get(objectiveId);
    if (!definition || !state) return false;
    if (state.status === OBJECTIVE_STATUS.complete && !definition.repeatable) return false;
    if (state.status === OBJECTIVE_STATUS.active) {
      if (options.visible) this.markObjectiveVisible(objectiveId);
      return false;
    }

    state.status = OBJECTIVE_STATUS.active;
    state.visible = definition.silent ? false : (options.visible ?? definition.visible ?? !definition.hidden);
    state.startedAt = Date.now();
    this.fireActions(definition.actionsOnStart, { objectiveId, definition, silent: definition.silent });
    this.activateNextStep(definition, state);
    this.logTransition(`start:${objectiveId}`, `Objective started: ${objectiveId}`);
    this.notify('objectiveChanged', { type: 'objective_started', definition, state });
    return true;
  }

  completeObjective(objectiveId) {
    const definition = this.definitions.get(objectiveId);
    const state = this.objectiveStates.get(objectiveId);
    if (!definition || !state || state.status === OBJECTIVE_STATUS.complete) return false;

    state.status = OBJECTIVE_STATUS.complete;
    state.visible = definition.silent ? false : true;
    state.completedAt = Date.now();
    this.fireActions(definition.actionsOnComplete, { objectiveId, definition, silent: definition.silent });
    this.logTransition(`complete:${objectiveId}`, `Objective complete: ${objectiveId}`);
    this.notify('objectiveChanged', { type: 'objective_completed', definition, state });
    return true;
  }

  markObjectiveVisible(objectiveId) {
    const definition = this.definitions.get(objectiveId);
    if (definition?.silent) return false;
    const state = this.objectiveStates.get(objectiveId);
    if (!state) return false;
    state.visible = true;
    this.notify('objectiveChanged', { type: 'objective_visible', state, definition });
    return true;
  }

  emit(eventOrType, payload = {}) {
    const event = typeof eventOrType === 'string'
      ? createObjectiveEvent(eventOrType, payload)
      : createObjectiveEvent(eventOrType.type, eventOrType);
    this.lastEvent = event;
    this.recordEventFacts(event);
    this.notify('objectiveEvent', event);
    this.evaluateStarts(event);
    this.evaluateActiveObjectives(event);
    return event;
  }

  update(_deltaSeconds, context = {}) {
    this.context = { ...this.context, ...context };
    this.evaluateStarts(null);
    this.evaluateActiveObjectives(null);
  }

  evaluateStarts(event) {
    this.definitions.forEach((definition) => {
      const state = this.objectiveStates.get(definition.id);
      if (!state || state.status !== OBJECTIVE_STATUS.locked) return;
      if (definition.startEvents?.length && event && !definition.startEvents.some((matcher) => objectiveEventMatches(event, matcher))) return;
      if (definition.startEvents?.length && !event) return;
      if (!this.conditionsPass(definition.startConditions)) return;
      this.startObjective(definition.id);
    });
  }

  evaluateActiveObjectives(event) {
    this.definitions.forEach((definition) => {
      const state = this.objectiveStates.get(definition.id);
      if (!state || state.status !== OBJECTIVE_STATUS.active) return;
      for (const step of definition.steps ?? []) {
        const stepState = state.stepStates[step.id];
        if (!stepState || stepState.status !== OBJECTIVE_STATUS.active) continue;
        const eventPasses = !step.completionEvents?.length
          || (event && step.completionEvents.some((matcher) => objectiveEventMatches(event, matcher)));
        const conditionsPass = this.conditionsPass(step.conditions);
        if (eventPasses && conditionsPass) {
          this.completeStep(definition, state, step);
        }
      }

      const allStepsComplete = (definition.steps ?? []).every((step) => state.stepStates[step.id]?.status === OBJECTIVE_STATUS.complete);
      if (allStepsComplete && this.conditionsPass(definition.completionConditions)) {
        this.completeObjective(definition.id);
      }
    });
  }

  activateNextStep(definition, state) {
    const nextStep = (definition.steps ?? []).find((step) => state.stepStates[step.id]?.status === OBJECTIVE_STATUS.locked);
    if (!nextStep) return false;
    const stepState = state.stepStates[nextStep.id];
    stepState.status = OBJECTIVE_STATUS.active;
    stepState.startedAt = Date.now();
    this.fireActions(nextStep.actionsOnStart, { objectiveId: definition.id, stepId: nextStep.id, definition, step: nextStep, silent: definition.silent || nextStep.silent });
    this.logTransition(`step-start:${definition.id}:${nextStep.id}`, `Objective step started: ${definition.id}/${nextStep.id}`);
    this.notify('objectiveChanged', { type: 'step_started', definition, state, step: nextStep, stepState });
    return true;
  }

  completeStep(definition, state, step) {
    const stepState = state.stepStates[step.id];
    if (!stepState || stepState.status === OBJECTIVE_STATUS.complete) return false;
    stepState.status = OBJECTIVE_STATUS.complete;
    stepState.completedAt = Date.now();
    this.fireActions(step.actionsOnComplete, { objectiveId: definition.id, stepId: step.id, definition, step, silent: definition.silent || step.silent });
    this.logTransition(`step-complete:${definition.id}:${step.id}`, `Objective step complete: ${definition.id}/${step.id}`);
    this.notify('objectiveChanged', { type: 'step_completed', definition, state, step, stepState });
    this.activateNextStep(definition, state);
    return true;
  }

  conditionsPass(conditions) {
    return evaluateObjectiveCondition(conditions, {
      runtime: this,
      facts: this.facts,
      context: this.context,
      equipmentRuntime: this.context.equipmentRuntime,
    });
  }

  fireActions(actions = [], metadata = {}) {
    actions.forEach((action) => {
      if (metadata.silent && ['showToast', 'showLocationMessage', 'markObjectiveVisible'].includes(action.type)) return;
      executeObjectiveAction(action, {
        runtime: this,
        facts: this.facts,
        callbacks: this.callbacks,
        equipmentRuntime: this.context.equipmentRuntime,
        ...metadata,
      });
    });
  }

  recordEventFacts(event) {
    if (event.type === OBJECTIVE_EVENTS.locationEntered && event.locationId) this.facts.visitedLocationIds.add(event.locationId);
    if (event.type === OBJECTIVE_EVENTS.roomEntered && event.roomId) this.facts.visitedRoomIds.add(event.roomId);
    if (event.type === OBJECTIVE_EVENTS.interactionUsed && event.interactionId) this.facts.usedInteractionIds.add(event.interactionId);
    if (event.type === OBJECTIVE_EVENTS.chestOpened && event.interactionId) this.facts.chestOpenedInteractionIds.add(event.interactionId);
    if (event.type === OBJECTIVE_EVENTS.enemyDamaged) {
      if (event.enemyId) this.facts.damagedEnemyIds.add(event.enemyId);
      if (event.targetId) this.facts.damagedEnemyIds.add(event.targetId);
      if (event.species) this.facts.damagedSpecies.add(event.species);
    }
    if ([OBJECTIVE_EVENTS.enemyKilled, OBJECTIVE_EVENTS.factionEnemyKilled].includes(event.type)) {
      if (event.enemyId) this.facts.killedEnemyIds.add(event.enemyId);
      if (event.targetId) this.facts.killedEnemyIds.add(event.targetId);
      if (event.species) this.facts.killedSpecies.add(event.species);
      this.incrementFactionKill(event.factionId, event.species);
    }
    if (event.type === OBJECTIVE_EVENTS.dungeonCompleted && event.locationId) {
      this.facts.locationCompletionIds.add(event.locationId);
    }
  }

  incrementFactionKill(factionId, species) {
    [
      `${factionId ?? '*'}:${species ?? '*'}`,
      `${factionId ?? '*'}:*`,
      `*:${species ?? '*'}`,
    ].forEach((key) => {
      this.facts.factionKills.set(key, (this.facts.factionKills.get(key) ?? 0) + 1);
    });
  }

  getActiveObjectives() {
    return [...this.objectiveStates.values()]
      .filter((state) => this.definitions.has(state.id) && state.status === OBJECTIVE_STATUS.active && state.visible)
      .filter((state) => !this.definitions.get(state.id)?.silent)
      .map((state) => ({
        ...this.definitions.get(state.id),
        state,
        steps: (this.definitions.get(state.id)?.steps ?? []).map((step) => ({
          ...step,
          state: state.stepStates[step.id]?.status ?? OBJECTIVE_STATUS.locked,
        })),
      }));
  }

  getObjectiveState(id) {
    return this.objectiveStates.get(id) ?? null;
  }

  getSnapshot() {
    return {
      version: OBJECTIVE_SNAPSHOT_VERSION,
      objectiveStates: [...this.objectiveStates.values()].map((state) => ({
        id: state.id,
        locationId: state.locationId,
        status: state.status,
        visible: state.visible,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        failedAt: state.failedAt,
        stepStates: state.stepStates,
      })),
      facts: serializeFacts(this.facts),
      lastEvent: this.lastEvent,
      debug: {
        activeObjectiveIds: this.getActiveObjectives().map((objective) => objective.id),
        completedObjectiveIds: [...this.objectiveStates.values()].filter((state) => state.status === OBJECTIVE_STATUS.complete).map((state) => state.id),
      },
    };
  }

  loadSnapshot(snapshot) {
    const normalized = normalizeObjectiveSnapshot(snapshot);
    this.facts = createObjectiveFacts(normalized.facts);
    normalized.objectiveStates.forEach((savedState) => {
      if (!savedState?.id) return;
      this.objectiveStates.set(savedState.id, {
        ...savedState,
        stepStates: savedState.stepStates ?? {},
      });
    });
    this.lastEvent = normalized.lastEvent;
  }

  resetLocationObjectives(locationId) {
    (this.definitionsByLocation.get(locationId) ?? []).forEach((objectiveId) => {
      const definition = this.definitions.get(objectiveId);
      if (definition) this.objectiveStates.set(objectiveId, createObjectiveState(definition));
    });
  }

  getDebugInfo() {
    return createObjectiveDebugInfo(this);
  }

  dispose() {
    this.listeners.clear();
  }

  logTransition(key, message) {
    if (this.loggedTransitions.has(key)) return;
    this.loggedTransitions.add(key);
    if (import.meta.env?.DEV) console.info(`[OBJECTIVES] ${message}`);
  }
}
