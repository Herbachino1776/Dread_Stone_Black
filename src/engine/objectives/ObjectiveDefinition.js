const KNOWN_CONDITION_KEYS = new Set(['type', 'all', 'any', 'not']);
const KNOWN_ACTION_TYPES = new Set([
  'setFlag',
  'clearFlag',
  'showToast',
  'showLocationMessage',
  'unlockInteraction',
  'unlockGate',
  'markObjectiveVisible',
  'startObjective',
  'completeObjective',
  'grantItem',
  'grantEquipment',
]);

export function defineObjective(definition) {
  return Object.freeze({
    repeatable: false,
    visible: true,
    hidden: false,
    failureConditions: [],
    rewards: [],
    tags: [],
    debug: {},
    ...definition,
    steps: Object.freeze((definition.steps ?? []).map((step) => Object.freeze({
      state: 'locked',
      conditions: [],
      completionEvents: [],
      actionsOnStart: [],
      actionsOnComplete: [],
      tags: [],
      ...step,
    }))),
  });
}

function addIssue(issues, severity, message, id = null) {
  issues.push({ severity, message, id });
}

function validateCondition(condition, issues, owner) {
  if (!condition) return;
  if (Array.isArray(condition)) {
    condition.forEach((entry) => validateCondition(entry, issues, owner));
    return;
  }
  if (condition.all) condition.all.forEach((entry) => validateCondition(entry, issues, owner));
  if (condition.any) condition.any.forEach((entry) => validateCondition(entry, issues, owner));
  if (condition.not) validateCondition(condition.not, issues, owner);
  if (!condition.type && !condition.all && !condition.any && !condition.not) {
    addIssue(issues, 'warning', `${owner} has condition without type/all/any/not`, owner);
  }
  Object.keys(condition).forEach((key) => {
    if (!KNOWN_CONDITION_KEYS.has(key) && !key.endsWith('Id') && !['count', 'minimum', 'species'].includes(key)) return;
  });
}

function validateAction(action, issues, owner, knownMessageIds = new Set(), warnUnknownReferences = true) {
  if (!action) return;
  if (!KNOWN_ACTION_TYPES.has(action.type)) {
    addIssue(issues, 'warning', `${owner} has unknown action type ${action.type}`, owner);
  }
  if (warnUnknownReferences && action.messageId && knownMessageIds.size && !knownMessageIds.has(action.messageId)) {
    addIssue(issues, 'warning', `${owner} references unknown message ${action.messageId}`, owner);
  }
}

export function validateObjectiveDefinitions(definitions, {
  knownInteractionIds = new Set(),
  knownItemIds = new Set(),
  knownMessageIds = new Set(),
  knownRoomIds = new Set(),
  warnUnknownReferences = true,
} = {}) {
  const errors = [];
  const warnings = [];
  const objectiveIds = new Set();

  definitions.forEach((definition, index) => {
    if (!definition?.id) {
      addIssue(errors, 'error', `objective[${index}] is missing id`);
      return;
    }
    if (objectiveIds.has(definition.id)) addIssue(errors, 'error', `duplicate objective id ${definition.id}`, definition.id);
    objectiveIds.add(definition.id);

    if (!definition.locationId) addIssue(errors, 'error', `objective ${definition.id} is missing locationId`, definition.id);
    const stepIds = new Set();
    (definition.steps ?? []).forEach((step, stepIndex) => {
      if (!step.id) {
        addIssue(errors, 'error', `objective ${definition.id} step[${stepIndex}] is missing id`, definition.id);
        return;
      }
      if (stepIds.has(step.id)) addIssue(errors, 'error', `objective ${definition.id} has duplicate step id ${step.id}`, step.id);
      stepIds.add(step.id);

      validateCondition(step.conditions, warnings, `${definition.id}.${step.id}`);
      (step.actionsOnStart ?? []).forEach((action) => validateAction(action, warnings, `${definition.id}.${step.id}`, knownMessageIds, warnUnknownReferences));
      (step.actionsOnComplete ?? []).forEach((action) => validateAction(action, warnings, `${definition.id}.${step.id}`, knownMessageIds, warnUnknownReferences));

      if (!warnUnknownReferences) return;
      if (step.interactionId && knownInteractionIds.size && !knownInteractionIds.has(step.interactionId)) {
        addIssue(warnings, 'warning', `objective step ${step.id} references unknown interaction ${step.interactionId}`, step.id);
      }
      const itemId = step.itemId ?? step.equipmentId;
      if (itemId && knownItemIds.size && !knownItemIds.has(itemId)) {
        addIssue(warnings, 'warning', `objective step ${step.id} references unknown item/equipment ${itemId}`, step.id);
      }
      if (step.roomId && knownRoomIds.size && !knownRoomIds.has(step.roomId)) {
        addIssue(warnings, 'warning', `objective step ${step.id} references unknown room ${step.roomId}`, step.id);
      }
    });

    validateCondition(definition.startConditions, warnings, definition.id);
    validateCondition(definition.completionConditions, warnings, definition.id);
    validateCondition(definition.failureConditions, warnings, definition.id);
    [...(definition.actionsOnStart ?? []), ...(definition.actionsOnComplete ?? [])].forEach((action) => {
      validateAction(action, warnings, definition.id, knownMessageIds, warnUnknownReferences);
    });
  });

  definitions.forEach((definition) => {
    [...(definition.actionsOnStart ?? []), ...(definition.actionsOnComplete ?? [])].forEach((action) => {
      if (['startObjective', 'completeObjective', 'markObjectiveVisible'].includes(action.type) && !objectiveIds.has(action.objectiveId)) {
        addIssue(warnings, 'warning', `objective ${definition.id} references missing objective ${action.objectiveId}`, definition.id);
      }
    });
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
