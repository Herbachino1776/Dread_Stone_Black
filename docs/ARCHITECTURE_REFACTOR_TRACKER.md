# Architecture Refactor Tracker

This tracker records the staged Game.js foundation split so each PR can preserve the playable starter loop while moving ownership into durable hosts and runtimes.

## Completed refactor layers

- PR #253: Added `SurvivalInventoryBridge` so survival inventory state can flow through equipment-facing runtime code without duplicating ownership.
- PR #254: Extracted `OutdoorWorldRuntime` and repaired Folsom validation around authored outdoor spaces.
- PR #255: Extracted `FishingWorldRuntime` for Rod A1 and physical fishing world behavior.
- PR #256: Extracted `CreatureWorldRuntime` for creature spawning, animation, combat hooks, and gore-facing enemy runtime responsibilities.
- PR #257: Moved route metadata toward authored location definitions and kept return spawn resolution data-driven where definitions exist.
- PR #258: Extracted `RendererHost`, `InputHost`, and `SaveHost` from `Game.js`.
- PR #259: Extracted `HudHost` from `Game.js`.
- PR #260: Extracted `SceneSessionHost` as the owner of the active world session, including camera creation, `DungeonScene` creation, startup location resolution, return-spawn resolution, player creation, scene update handoff, rendering handoff, transition URL orchestration, reload/reset session API, compatibility accessors, and session cleanup.
- Current PR: Extracted `ProgressionHost` as the owner of objective runtime creation, objective pack registration, save snapshot coordination, objective debug panel wiring, location-entered and room-entered objective events, room tracking, equipment objective events, and combat-hit objective events.

## Remaining Game.js responsibilities

- Top-level boot sequencing and host wiring.
- Equipment runtime and survival inventory bridge construction.
- Compatibility handoff of `ProgressionHost.getObjectiveRuntime()` to interaction systems that already emit authored interaction objective events.
- First-person viewmodel construction for Rod A1, broadsword, and player torch light.
- Interaction, combat, fishing cast controller, gesture controller, hunger update, and feedback loop coordination.
- Pause/reset UI state and saved-progress reset behavior.
- Main animation loop ordering across hosts and gameplay facades.

## Known intentional leftovers

- `Interactions` still receives the objective runtime directly because it owns interaction-specific authored events such as chest opens, altar activations, gate unlocks, lever pulls, and location exits. Moving those events should happen with an interaction/runtime boundary rather than by making `ProgressionHost` know every interaction detail.
- Hunger/starvation remains in `Game.js` because it bridges `GameState`, equipment panel pause state, HUD hunger rendering, and combat damage; it should move with a future survival runtime coordinator rather than into `ProgressionHost`.
- First-person torch/viewmodel updates remain in `Game.js` because they belong to the equipment/viewmodel layer, not progression lifecycle.
- Field return shrine reaction remains in `Game.js` for now because it is a one-off startup reaction that coordinates shrine visuals, HUD message, interaction hint, feedback shake, and save state. It should move only when a broader field-event or progression-reaction runtime exists.
- Interactions still performs interaction-specific decision logic, but location navigation is delegated into `SceneSessionHost` so transition URL construction and preloading are no longer interaction-owned.

## Next recommended PR

Extract a `SurvivalHost` for hunger/starvation, cooking-adjacent survival save/HUD coordination, and survival inventory-facing loop concerns, or extract a `FirstPersonViewmodelHost` for Rod A1, broadsword, torch viewmodel/light updates, and equipment-driven presentation. `SurvivalHost` is likely the better next foundation PR because hunger and campfire/cooking state still cross `GameState`, HUD, combat, interactions, and equipment inventory.
