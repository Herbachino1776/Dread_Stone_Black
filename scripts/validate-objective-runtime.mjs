import assert from 'node:assert/strict';
import { ObjectiveConditions, evaluateObjectiveCondition } from '../src/engine/objectives/ObjectiveConditions.js';
import { southReliquaryCryptObjectives } from '../src/game/objectives/southReliquaryCryptObjectives.js';

const completeState = {
  status: 'complete',
  stepStates: { inspect: { status: 'complete' } },
};
const context = {
  facts: {
    flags: new Set(['ready']),
    usedInteractionIds: new Set(['INT04']),
    visitedLocationIds: new Set(['folsom']),
    visitedRoomIds: new Set(['courtyard']),
  },
  runtime: {
    getObjectiveState: (objectiveId) => objectiveId === 'complete_objective' ? completeState : null,
  },
  equipmentRuntime: {
    hasItem: (itemId) => itemId === 'fishing_rod',
    getEquippedWeaponProfile: () => ({ id: 'unarmed' }),
  },
};

const survivingConditions = [
  ObjectiveConditions.flagSet('ready'),
  ObjectiveConditions.interactionUsed('INT04'),
  ObjectiveConditions.locationVisited('folsom'),
  ObjectiveConditions.roomVisited('courtyard'),
  ObjectiveConditions.objectiveComplete('complete_objective'),
  ObjectiveConditions.objectiveStepComplete('complete_objective', 'inspect'),
  ObjectiveConditions.hasEquipment('fishing_rod'),
  ObjectiveConditions.equippedWeapon('unarmed'),
];

assert.ok(southReliquaryCryptObjectives.length > 0, 'South Reliquary objective definitions must import without a bootstrap exception.');
assert.ok(survivingConditions.every((condition) => evaluateObjectiveCondition(condition, context)), 'Non-enemy objective conditions must evaluate against the live runtime context.');
assert.equal(evaluateObjectiveCondition(ObjectiveConditions.any(
  ObjectiveConditions.flagSet('missing'),
  ObjectiveConditions.interactionUsed('INT04'),
), context), true, 'Composite objective conditions must remain functional.');

for (const removedCondition of ['enemyDamaged', 'enemyKilled', 'factionKillCount']) {
  assert.equal(Object.hasOwn(ObjectiveConditions, removedCondition), false, `${removedCondition} must not be restored.`);
}

console.log('Objective definitions and surviving non-enemy conditions are valid.');
