import { OBJECTIVE_STATUS } from './ObjectiveState.js';

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function getEquipmentRuntime(context) {
  return context?.equipmentRuntime ?? context?.context?.equipmentRuntime ?? context?.runtime?.context?.equipmentRuntime ?? null;
}

function getState(context, objectiveId) {
  return context?.runtime?.getObjectiveState(objectiveId) ?? context?.objectiveStates?.get?.(objectiveId) ?? null;
}

export function evaluateObjectiveCondition(condition, context = {}) {
  if (!condition) return true;
  if (Array.isArray(condition)) return condition.every((child) => evaluateObjectiveCondition(child, context));

  if (condition.type === 'all' || condition.all) {
    return asArray(condition.conditions ?? condition.all).every((child) => evaluateObjectiveCondition(child, context));
  }
  if (condition.type === 'any' || condition.any) {
    return asArray(condition.conditions ?? condition.any).some((child) => evaluateObjectiveCondition(child, context));
  }
  if (condition.type === 'not' || condition.not) {
    return !evaluateObjectiveCondition(condition.condition ?? condition.not, context);
  }

  const facts = context.facts ?? context;
  const equipmentRuntime = getEquipmentRuntime(context);

  switch (condition.type) {
    case 'flag':
    case 'flagSet':
      return Boolean(facts?.flags?.has(condition.flag ?? condition.flagId));
    case 'interactionUsed':
      return Boolean(condition.interactionId && facts?.usedInteractionIds?.has(condition.interactionId));
    case 'locationVisited':
      return Boolean(condition.locationId && facts?.visitedLocationIds?.has(condition.locationId));
    case 'roomVisited':
      return Boolean(condition.roomId && facts?.visitedRoomIds?.has(condition.roomId));
    case 'objectiveStarted': {
      const state = getState(context, condition.objectiveId);
      return Boolean(state && state.status !== OBJECTIVE_STATUS.locked);
    }
    case 'objectiveStepComplete':
      return getState(context, condition.objectiveId)?.stepStates?.[condition.stepId]?.status === OBJECTIVE_STATUS.complete;
    case 'objectiveComplete':
      return getState(context, condition.objectiveId)?.status === OBJECTIVE_STATUS.complete;
    case 'hasItem':
    case 'hasEquipment':
      return Boolean(equipmentRuntime?.hasItem?.(condition.itemId ?? condition.equipmentId));
    case 'equippedWeapon':
      return equipmentRuntime?.getEquippedWeaponProfile?.()?.id === condition.weaponId;
    default:
      console.warn(`Unknown objective condition type "${condition.type}".`, condition);
      return false;
  }
}

export const ObjectiveConditions = Object.freeze({
  all: (...conditions) => ({ type: 'all', conditions }),
  any: (...conditions) => ({ type: 'any', conditions }),
  not: (condition) => ({ type: 'not', condition }),
  flag: (flag) => ({ type: 'flag', flag }),
  flagSet: (flagId) => ({ type: 'flagSet', flagId }),
  interactionUsed: (interactionId) => ({ type: 'interactionUsed', interactionId }),
  locationVisited: (locationId) => ({ type: 'locationVisited', locationId }),
  roomVisited: (roomId) => ({ type: 'roomVisited', roomId }),
  objectiveStarted: (objectiveId) => ({ type: 'objectiveStarted', objectiveId }),
  objectiveStepComplete: (objectiveId, stepId) => ({ type: 'objectiveStepComplete', objectiveId, stepId }),
  objectiveComplete: (objectiveId) => ({ type: 'objectiveComplete', objectiveId }),
  hasItem: (itemId) => ({ type: 'hasItem', itemId }),
  hasEquipment: (equipmentId) => ({ type: 'hasEquipment', equipmentId }),
  equippedWeapon: (weaponId) => ({ type: 'equippedWeapon', weaponId }),
});
