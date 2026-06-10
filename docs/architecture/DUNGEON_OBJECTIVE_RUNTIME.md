# Dungeon Objective Runtime

## Purpose

Dread Stone Black needs dungeons that can declare progression instead of hiding progression inside one-off room logic. The objective runtime is a small data-driven layer for dungeon goals, step state, objective feedback, and persistence. It is not the final quest journal or save menu.

The runtime currently supports:

- location objective packs
- objective and step state
- event-driven completion
- condition checks against objective facts, equipment, rooms, and combat
- simple actions such as flags, toasts, visibility, and objective chaining
- localStorage snapshot persistence through `GameState`

## Files

Engine:

- `src/engine/objectives/ObjectiveRuntime.js`
- `src/engine/objectives/ObjectiveDefinition.js`
- `src/engine/objectives/ObjectiveState.js`
- `src/engine/objectives/ObjectiveEvents.js`
- `src/engine/objectives/ObjectiveConditions.js`
- `src/engine/objectives/ObjectiveActions.js`
- `src/engine/objectives/ObjectivePersistence.js`
- `src/engine/objectives/ObjectiveDebug.js`

Game data:

- `src/game/objectives/objectiveRegistry.js`
- `src/game/objectives/blackGrassTempleObjectives.js`
- `src/game/objectives/southReliquaryCryptObjectives.js`
- `src/game/objectives/objectiveMessages.js`

UI:

- `src/game/ui/ObjectivePanel.js`
- `src/styles/hud.css`

## Objective Definition Shape

Objectives are plain JavaScript objects passed through `defineObjective`.

```js
defineObjective({
  id: 'bgt_arm_yourself',
  locationId: 'black-grass-temple',
  title: 'Arm Yourself',
  shortText: 'Find, take, and equip a temple blade.',
  description: 'The temple asks for a hand that can answer iron.',
  visible: true,
  hidden: false,
  repeatable: false,
  tags: ['proof', 'equipment'],
  startEvents: [{ type: 'location_entered', locationId: 'black-grass-temple' }],
  startConditions: { type: 'locationVisited', locationId: 'black-grass-temple' },
  completionConditions: { type: 'equippedWeapon', weaponId: 'rusted_sword' },
  failureConditions: [],
  rewards: [],
  actionsOnStart: [{ type: 'showToast', messageId: 'bgt_arm_started' }],
  actionsOnComplete: [{ type: 'setFlag', flagId: 'bgt_arm_yourself_complete' }],
  debug: { authoringNote: 'Proof objective.' },
  steps: [],
});
```

## Step Definition Shape

Steps are also data only. No scripting language is used.

```js
{
  id: 'take_rusted_sword',
  title: 'Open the chest',
  shortText: 'Take the rusted sword.',
  state: 'locked',
  conditions: { type: 'hasEquipment', itemId: 'rusted_sword' },
  completionEvents: [
    { type: 'equipment_acquired', equipmentId: 'rusted_sword' },
  ],
  actionsOnStart: [],
  actionsOnComplete: [{ type: 'showToast', messageId: 'bgt_sword_taken' }],
  markerRef: 'BGT-P16-rusted-sword-chest-placeholder',
  interactionId: 'BGT_INT_RUSTED_SWORD_CHEST',
  roomId: 'R03',
  itemId: 'rusted_sword',
  equipmentId: 'rusted_sword',
  enemyId: null,
  factionId: null,
  tags: ['interaction', 'equipment'],
}
```

## Event Model

Objective events are normalized by `createObjectiveEvent`.

Supported event types:

- `location_entered`
- `location_exited`
- `room_entered`
- `item_acquired`
- `equipment_acquired`
- `equipment_equipped`
- `interaction_used`
- `chest_opened`
- `gate_unlocked`
- `lever_pulled`
- `altar_activated`
- `enemy_damaged`
- `enemy_killed`
- `faction_enemy_killed`
- `encounter_cleared`
- `dungeon_completed`

Payload fields:

- `type`
- `locationId`
- `roomId`
- `interactionId`
- `itemId`
- `equipmentId`
- `weaponId`
- `enemyId`
- `species`
- `factionId`
- `sourceId`
- `targetId`
- `timestamp`
- `tags`
- `metadata`

## Conditions

`ObjectiveConditions.js` supports:

- `hasItem(itemId)`
- `hasEquipment(itemId)`
- `equippedWeapon(weaponId)`
- `interactionUsed(interactionId)`
- `flagSet(flagId)`
- `locationVisited(locationId)`
- `roomVisited(roomId)`
- `enemyDamaged({ enemyId })` or `enemyDamaged({ species })`
- `enemyKilled({ enemyId })` or `enemyKilled({ species })`
- `factionKillCount({ factionId, species, count })`
- `objectiveStepComplete(objectiveId, stepId)`
- `objectiveComplete(objectiveId)`

Boolean composition:

- `{ all: [conditionA, conditionB] }`
- `{ any: [conditionA, conditionB] }`
- `{ not: condition }`

## Actions

`ObjectiveActions.js` supports:

- `setFlag(flagId)`
- `clearFlag(flagId)`
- `showToast(messageId or { text })`
- `showLocationMessage(messageId or { text })`
- `unlockInteraction(interactionId)` placeholder callback
- `unlockGate(gateId)` placeholder callback
- `markObjectiveVisible(objectiveId)`
- `startObjective(objectiveId)`
- `completeObjective(objectiveId)`
- `grantItem(itemId)` placeholder via equipment acquisition if available
- `grantEquipment(itemId)` placeholder via equipment acquisition if available

Current proof objectives use toasts, flags, objective starts, and equipment/room/combat conditions.

## Persistence Snapshot

`GameState` stores the objective snapshot at `dreadStoneBlack.objectiveState`.

The snapshot includes:

- objective states
- step states
- flags
- used interaction ids
- visited location ids
- visited room ids
- damaged enemy ids/species
- killed enemy ids/species
- faction kill counts
- completed dungeon ids
- acquired reward placeholders
- last event

The snapshot is saved when objective events or objective transitions occur. It rides alongside the existing equipment snapshot and existing South Reliquary flags.

## UI Feedback

`ObjectivePanel` adds:

- a compact active objective readout inside the viewport
- objective toasts for starts and completions
- a collapsible detail view toggled by tapping the readout or pressing `O`

It does not add a full quest journal and does not add more mobile control buttons.

## Equipment Integration

`Game` bridges `EquipmentRuntime` events into objective events:

- `equipment:item-acquired` becomes `item_acquired` and `equipment_acquired`
- `equipment:equipped-changed` becomes `equipment_equipped`
- `equipment:attack-resolved` becomes `enemy_damaged`, `enemy_killed`, and `faction_enemy_killed` when a hit exists

Combat payloads preserve `weaponId`, species, faction id, and target id where the existing enemy/gore metadata provides them.

## Dungeon Authoring Integration

Location definitions can declare an `objectivePackId`.

```js
export const blackGrassTempleDefinition = Object.freeze({
  id: 'black-grass-temple',
  objectivePackId: 'black-grass-temple-foundation',
});
```

`Game` resolves the current location id, asks `objectiveRegistry` for the pack, registers it with `ObjectiveRuntime`, then emits `location_entered` and `room_entered`.

## Black Grass Temple Proof Objectives

Black Grass Temple has a conservative proof chain:

- `bgt_arm_yourself`: enter the temple, reach the Broken Offering Room, take the rusted sword, equip it
- `bgt_blood_the_blade`: damage or kill Sheep Demon or Neck Man with `rusted_sword`
- `bgt_survive_warring_temple`: enter the first deeper tavern room after the blade is blooded

No objective blocks exiting the temple. No gate or encounter lock was added.

## South Reliquary Crypt Partial Objectives

South Reliquary Crypt has partial definitions:

- `south_crypt_wake_reliquary`: hook into the existing black reliquary interaction `INT04`
- `south_crypt_escape_placeholder`: definition-only placeholder for future key, gate, lever, and escape objectives

The live crypt gate/key/lever logic is not migrated in this pass.

## Adding Future Objective Chains

1. Add stable ids to location rooms, interactions, props, gates, enemies, and exits.
2. Add a new objective pack file in `src/game/objectives`.
3. Register the pack in `objectiveRegistry.js`.
4. Add `objectivePackId` to the location definition.
5. Emit objective events from the existing interaction, equipment, combat, or transition code.
6. Keep objectives data-only: conditions and events should describe the required state; actions should remain small and explicit.

## Debugging

In Vite dev mode:

- objective transitions log once
- `window.dreadStoneObjectiveRuntime` exposes the runtime
- `window.dreadStoneObjectiveDebug()` returns active objectives, completed objectives, flags, last event, current pack, and step states

There is no per-frame objective logging.

## Current Limitations

- No full quest journal.
- No save/load menu.
- No objective markers in world space.
- No branching NPC objectives.
- Gate, lever, and boss-gate actions are placeholders until those systems have stable authored runtime ids.
- South Reliquary Crypt remains partly hand-built.
- Rewards are tracked as placeholders unless they map safely to current equipment acquisition.

## Future Work

- full quest journal
- boss gates
- save/load menu
- objective markers
- branching NPC/lore objectives
- authored room-clearing objectives
- dungeon completion screens
- stronger editor validation for objective references
