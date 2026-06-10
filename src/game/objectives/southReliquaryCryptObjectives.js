import { defineObjective } from '../../engine/objectives/ObjectiveDefinition.js';
import { ObjectiveActions } from '../../engine/objectives/ObjectiveActions.js';
import { ObjectiveConditions } from '../../engine/objectives/ObjectiveConditions.js';
import { OBJECTIVE_EVENTS } from '../../engine/objectives/ObjectiveEvents.js';

export const southReliquaryCryptObjectivePackId = 'south-reliquary-crypt-partial-foundation';

export const southReliquaryCryptObjectives = Object.freeze([
  defineObjective({
    id: 'south_crypt_wake_reliquary',
    locationId: 'south-reliquary-crypt',
    title: 'Wake the Reliquary',
    shortText: 'Find the black reliquary block.',
    description: 'The crypt keeps one black ember under stone.',
    tags: ['partial', 'reliquary', 'legacy_crypt'],
    startEvents: [{ type: OBJECTIVE_EVENTS.locationEntered, locationId: 'south-reliquary-crypt' }],
    startConditions: ObjectiveConditions.locationVisited('south-reliquary-crypt'),
    completionConditions: ObjectiveConditions.interactionUsed('INT04'),
    failureConditions: [],
    rewards: [],
    actionsOnStart: [ObjectiveActions.showToast('south_crypt_started')],
    actionsOnComplete: [
      ObjectiveActions.showToast('south_crypt_reliquary_awake'),
      ObjectiveActions.setFlag('south_crypt_reliquary_awake'),
    ],
    debug: { authoringNote: 'Partial hook into the existing live reliquary interaction; no crypt gate behavior changed.' },
    steps: [
      {
        id: 'inspect_black_reliquary',
        title: 'Inspect the black reliquary',
        shortText: 'Touch the reliquary in the alcove.',
        interactionId: 'INT04',
        roomId: 'R06',
        conditions: ObjectiveConditions.interactionUsed('INT04'),
        completionEvents: [
          { type: OBJECTIVE_EVENTS.altarActivated, locationId: 'south-reliquary-crypt', interactionId: 'INT04' },
        ],
        tags: ['interaction', 'altar'],
      },
    ],
  }),
  defineObjective({
    id: 'south_crypt_escape_placeholder',
    locationId: 'south-reliquary-crypt',
    title: 'Escape the Crypt',
    shortText: 'Return to the field after the reliquary wakes.',
    description: 'The exit is not a mercy. It is a test that lets you leave.',
    hidden: true,
    visible: false,
    tags: ['partial', 'escape', 'future_gate_chain'],
    startConditions: ObjectiveConditions.all(
      ObjectiveConditions.objectiveComplete('south_crypt_wake_reliquary'),
      ObjectiveConditions.flagSet('south_crypt_future_escape_enabled'),
    ),
    completionConditions: ObjectiveConditions.locationVisited('reliquary-field'),
    failureConditions: [],
    rewards: [],
    debug: {
      futureHooks: ['find key', 'unlock gate', 'pull lever', 'escape crypt'],
      authoringNote: 'Definition-only placeholder until the hand-built gate/key/lever flow is migrated.',
    },
    steps: [
      {
        id: 'future_find_key',
        title: 'Find the reliquary key',
        shortText: 'Future key objective placeholder.',
        interactionId: 'SOUTH_CRYPT_KEY_PLACEHOLDER',
        tags: ['placeholder', 'key'],
      },
      {
        id: 'future_unlock_gate',
        title: 'Unlock the east grate',
        shortText: 'Future locked gate objective placeholder.',
        interactionId: 'INT03',
        tags: ['placeholder', 'gate'],
      },
      {
        id: 'future_pull_lever',
        title: 'Pull the wall switch',
        shortText: 'Future lever objective placeholder.',
        interactionId: 'SOUTH_CRYPT_LEVER_PLACEHOLDER',
        tags: ['placeholder', 'lever'],
      },
    ],
  }),
]);
