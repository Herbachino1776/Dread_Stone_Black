function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export function evaluateObjectiveCondition(condition, facts = {}) {
  if (!condition) return true;
  switch (condition.type) {
    case 'all': return asArray(condition.conditions).every((child) => evaluateObjectiveCondition(child, facts));
    case 'any': return asArray(condition.conditions).some((child) => evaluateObjectiveCondition(child, facts));
    case 'not': return !evaluateObjectiveCondition(condition.condition, facts);
    case 'flag': return Boolean(facts.flags?.has(condition.flag));
    case 'locationVisited': return Boolean(condition.locationId && facts.visitedLocations?.has(condition.locationId));
    case 'roomVisited': return Boolean(condition.roomId && facts.visitedRooms?.has(condition.roomId));
    case 'objectiveStarted': return Boolean(condition.objectiveId && facts.startedObjectives?.has(condition.objectiveId));
    case 'objectiveComplete': return Boolean(condition.objectiveId && facts.completedObjectives?.has(condition.objectiveId));
    case 'hasItem': return Boolean(condition.itemId && facts.inventoryItems?.has(condition.itemId));
    case 'hasEquipment': return Boolean(condition.equipmentId && facts.equipmentItems?.has(condition.equipmentId));
    case 'equippedWeapon': return Boolean(condition.weaponId && facts.equipped?.weapon === condition.weaponId);
    default: return false;
  }
}

export const ObjectiveConditions = Object.freeze({
  all: (...conditions) => ({ type: 'all', conditions }),
  any: (...conditions) => ({ type: 'any', conditions }),
  not: (condition) => ({ type: 'not', condition }),
  flag: (flag) => ({ type: 'flag', flag }),
  locationVisited: (locationId) => ({ type: 'locationVisited', locationId }),
  roomVisited: (roomId) => ({ type: 'roomVisited', roomId }),
  objectiveStarted: (objectiveId) => ({ type: 'objectiveStarted', objectiveId }),
  objectiveComplete: (objectiveId) => ({ type: 'objectiveComplete', objectiveId }),
  hasItem: (itemId) => ({ type: 'hasItem', itemId }),
  hasEquipment: (equipmentId) => ({ type: 'hasEquipment', equipmentId }),
  equippedWeapon: (weaponId) => ({ type: 'equippedWeapon', weaponId }),
});
