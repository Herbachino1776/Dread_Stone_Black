import { defineObjective } from '../../engine/objectives/ObjectiveDefinition.js';
import { ObjectiveActions } from '../../engine/objectives/ObjectiveActions.js';
import { ObjectiveConditions } from '../../engine/objectives/ObjectiveConditions.js';
import { OBJECTIVE_EVENTS } from '../../engine/objectives/ObjectiveEvents.js';

export const blackGrassTempleObjectivePackId = 'black-grass-temple-foundation';

export const blackGrassTempleObjectives = Object.freeze([
  defineObjective({
    id: 'bgt_arm_yourself',
    locationId: 'black-grass-temple',
    title: 'Arm Yourself',
    shortText: 'Internal rusted sword acquisition/equip state.',
    description: 'The temple asks for a hand that can answer iron.',
    silent: true,
    hidden: true,
    visible: false,
    tags: ['proof', 'equipment', 'black_grass_temple'],
    startEvents: [{ type: OBJECTIVE_EVENTS.locationEntered, locationId: 'black-grass-temple' }],
    startConditions: ObjectiveConditions.locationVisited('black-grass-temple'),
    completionConditions: ObjectiveConditions.equippedWeapon('rusted_sword'),
    failureConditions: [],
    rewards: [],
    actionsOnStart: [],
    actionsOnComplete: [
      ObjectiveActions.setFlag('bgt_arm_yourself_complete'),
    ],
    debug: { authoringNote: 'Proof objective for rusted sword chest, acquisition, and equipment runtime events.' },
    steps: [
      {
        id: 'find_rusted_sword_chest',
        title: 'Offering chest room visited',
        shortText: 'Internal R03 visit state.',
        silent: true,
        roomId: 'R03',
        markerRef: 'BGT-P16-rusted-sword-chest-placeholder',
        conditions: ObjectiveConditions.roomVisited('R03'),
        completionEvents: [{ type: OBJECTIVE_EVENTS.roomEntered, locationId: 'black-grass-temple', roomId: 'R03' }],
        actionsOnComplete: [],
        tags: ['room', 'chest'],
      },
      {
        id: 'take_rusted_sword',
        title: 'Rusted sword acquired',
        shortText: 'Internal equipment acquisition state.',
        silent: true,
        interactionId: 'BGT_INT_RUSTED_SWORD_CHEST',
        itemId: 'rusted_sword',
        equipmentId: 'rusted_sword',
        conditions: ObjectiveConditions.hasEquipment('rusted_sword'),
        completionEvents: [
          { type: OBJECTIVE_EVENTS.chestOpened, locationId: 'black-grass-temple', interactionId: 'BGT_INT_RUSTED_SWORD_CHEST' },
          { type: OBJECTIVE_EVENTS.equipmentAcquired, locationId: 'black-grass-temple', equipmentId: 'rusted_sword' },
        ],
        actionsOnComplete: [],
        tags: ['interaction', 'equipment'],
      },
      {
        id: 'equip_rusted_sword',
        title: 'Rusted sword equipped',
        shortText: 'Internal weapon slot state.',
        silent: true,
        itemId: 'rusted_sword',
        equipmentId: 'rusted_sword',
        conditions: ObjectiveConditions.equippedWeapon('rusted_sword'),
        completionEvents: [{ type: OBJECTIVE_EVENTS.equipmentEquipped, locationId: 'black-grass-temple', equipmentId: 'rusted_sword' }],
        tags: ['equipment'],
      },
    ],
  })
]);
