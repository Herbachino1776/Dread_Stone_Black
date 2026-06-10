import { OBJECTIVE_STATUS } from './ObjectiveState.js';

function getEquipmentRuntime(context) {
  return context?.equipmentRuntime ?? context?.runtime?.context?.equipmentRuntime ?? null;
}

function getState(context, objectiveId) {
  return context?.runtime?.getObjectiveState(objectiveId) ?? context?.objectiveStates?.get?.(objectiveId) ?? null;
}

function normalizeTarget(condition) {
  return condition.enemyId ?? condition.species ?? condition.targetId ?? condition.id ?? null;
}

function factionKillKey({ factionId, species }) {
  return `${factionId ?? '*'}:${species ?? '*'}`;
}

export function evaluateObjectiveCondition(condition, context = {}) {
  if (!condition) return true;

  if (Array.isArray(condition)) {
    return condition.every((entry) => evaluateObjectiveCondition(entry, context));
  }

  if (condition.all) {
    return condition.all.every((entry) => evaluateObjectiveCondition(entry, context));
  }

  if (condition.any) {
    return condition.any.some((entry) => evaluateObjectiveCondition(entry, context));
  }

  if (condition.not) {
    return !evaluateObjectiveCondition(condition.not, context);
  }

  const facts = context.facts;
  const equipmentRuntime = getEquipmentRuntime(context);

  switch (condition.type) {
    case 'hasItem':
    case 'hasEquipment':
      return Boolean(equipmentRuntime?.hasItem?.(condition.itemId ?? condition.equipmentId));
    case 'equippedWeapon':
      return equipmentRuntime?.getEquippedWeaponProfile?.()?.id === condition.weaponId;
    case 'interactionUsed':
      return facts?.usedInteractionIds?.has(condition.interactionId);
    case 'flagSet':
      return facts?.flags?.has(condition.flagId);
    case 'locationVisited':
      return facts?.visitedLocationIds?.has(condition.locationId);
    case 'roomVisited':
      return facts?.visitedRoomIds?.has(condition.roomId);
    case 'enemyDamaged': {
      const target = normalizeTarget(condition);
      return Boolean(target && (facts?.damagedEnemyIds?.has(target) || facts?.damagedSpecies?.has(target)));
    }
    case 'enemyKilled': {
      const target = normalizeTarget(condition);
      return Boolean(target && (facts?.killedEnemyIds?.has(target) || facts?.killedSpecies?.has(target)));
    }
    case 'factionKillCount': {
      const minimum = condition.count ?? condition.minimum ?? 1;
      const direct = facts?.factionKills?.get(factionKillKey(condition)) ?? 0;
      const byFaction = facts?.factionKills?.get(factionKillKey({ factionId: condition.factionId })) ?? 0;
      const bySpecies = facts?.factionKills?.get(factionKillKey({ species: condition.species })) ?? 0;
      return Math.max(direct, byFaction, bySpecies) >= minimum;
    }
    case 'objectiveStepComplete': {
      const objectiveState = getState(context, condition.objectiveId);
      return objectiveState?.stepStates?.[condition.stepId]?.status === OBJECTIVE_STATUS.complete;
    }
    case 'objectiveComplete':
      return getState(context, condition.objectiveId)?.status === OBJECTIVE_STATUS.complete;
    default:
      console.warn(`Unknown objective condition type "${condition.type}".`, condition);
      return false;
  }
}

export const ObjectiveConditions = Object.freeze({
  hasItem: (itemId) => ({ type: 'hasItem', itemId }),
  hasEquipment: (itemId) => ({ type: 'hasEquipment', itemId }),
  equippedWeapon: (weaponId) => ({ type: 'equippedWeapon', weaponId }),
  interactionUsed: (interactionId) => ({ type: 'interactionUsed', interactionId }),
  flagSet: (flagId) => ({ type: 'flagSet', flagId }),
  locationVisited: (locationId) => ({ type: 'locationVisited', locationId }),
  roomVisited: (roomId) => ({ type: 'roomVisited', roomId }),
  enemyDamaged: (target) => ({ type: 'enemyDamaged', ...target }),
  enemyKilled: (target) => ({ type: 'enemyKilled', ...target }),
  factionKillCount: (target) => ({ type: 'factionKillCount', ...target }),
  objectiveStepComplete: (objectiveId, stepId) => ({ type: 'objectiveStepComplete', objectiveId, stepId }),
  objectiveComplete: (objectiveId) => ({ type: 'objectiveComplete', objectiveId }),
  all: (...conditions) => ({ all: conditions }),
  any: (...conditions) => ({ any: conditions }),
  not: (condition) => ({ not: condition }),
});
