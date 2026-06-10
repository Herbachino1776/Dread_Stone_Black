export const ObjectiveActions = Object.freeze({
  setFlag: (flagId) => ({ type: 'setFlag', flagId }),
  clearFlag: (flagId) => ({ type: 'clearFlag', flagId }),
  showToast: (message) => ({ type: 'showToast', ...normalizeMessage(message) }),
  showLocationMessage: (message) => ({ type: 'showLocationMessage', ...normalizeMessage(message) }),
  unlockInteraction: (interactionId) => ({ type: 'unlockInteraction', interactionId }),
  unlockGate: (gateId) => ({ type: 'unlockGate', gateId }),
  markObjectiveVisible: (objectiveId) => ({ type: 'markObjectiveVisible', objectiveId }),
  startObjective: (objectiveId) => ({ type: 'startObjective', objectiveId }),
  completeObjective: (objectiveId) => ({ type: 'completeObjective', objectiveId }),
  grantItem: (itemId) => ({ type: 'grantItem', itemId }),
  grantEquipment: (itemId) => ({ type: 'grantEquipment', itemId }),
});

function normalizeMessage(message) {
  if (typeof message === 'string') return { messageId: message };
  return message ?? {};
}

export function executeObjectiveAction(action, context = {}) {
  if (!action) return false;
  if (context.silent && ['showToast', 'showLocationMessage', 'markObjectiveVisible'].includes(action.type)) return false;
  const runtime = context.runtime;
  const callbacks = context.callbacks ?? {};
  const facts = context.facts;
  const message = action.text ?? (action.messageId ? callbacks.resolveMessage?.(action.messageId) : null);

  switch (action.type) {
    case 'setFlag':
      facts?.flags?.add(action.flagId);
      return true;
    case 'clearFlag':
      facts?.flags?.delete(action.flagId);
      return true;
    case 'showToast':
      callbacks.showToast?.(message ?? action.messageId, action);
      return true;
    case 'showLocationMessage':
      callbacks.showLocationMessage?.(message ?? action.messageId, action);
      return true;
    case 'unlockInteraction':
      callbacks.unlockInteraction?.(action.interactionId, action);
      return true;
    case 'unlockGate':
      callbacks.unlockGate?.(action.gateId, action);
      return true;
    case 'markObjectiveVisible':
      runtime?.markObjectiveVisible?.(action.objectiveId);
      return true;
    case 'startObjective':
      runtime?.startObjective?.(action.objectiveId, { visible: true });
      return true;
    case 'completeObjective':
      runtime?.completeObjective?.(action.objectiveId);
      return true;
    case 'grantItem':
    case 'grantEquipment':
      context.equipmentRuntime?.acquireItem?.(action.itemId, { source: 'objective', tags: ['objective_reward'] });
      facts?.acquiredRewardIds?.add(action.itemId);
      return true;
    default:
      console.warn(`Unknown objective action type "${action.type}".`, action);
      return false;
  }
}
