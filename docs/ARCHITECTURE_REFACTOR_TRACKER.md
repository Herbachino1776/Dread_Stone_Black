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
- PR #261: Extracted `ProgressionHost` as the owner of objective runtime creation, objective pack registration, save snapshot coordination, objective debug panel wiring, location-entered and room-entered objective events, room tracking, equipment objective events, and combat-hit objective events.
- Current PR: Extracted `SurvivalHost` as the owner of hunger/starvation update coordination, starvation damage handoff to combat, hunger HUD sync through `HudHost`, survival save snapshot coordination through `SaveHost`, cooked/raw fish pickup handoff, cooked fish eating, campfire build persistence, and raw-fish-to-cooked-fish campfire cooking consumption. `SurvivalInventoryBridge` remains the equipment/inventory bridge rather than being duplicated.

## Remaining Game.js responsibilities

- Top-level boot sequencing and host wiring.
- Equipment runtime and survival inventory bridge construction.
- Compatibility handoff of `ProgressionHost.getObjectiveRuntime()` to interaction systems that already emit authored interaction objective events.
- First-person viewmodel construction for Rod A1, broadsword, and player torch light.
- Interaction, combat, fishing cast controller, gesture controller, and feedback loop coordination.
- Survival loop ordering now delegates hunger/starvation and survival-facing fish/campfire save/HUD coordination to `SurvivalHost`; `Game.js` only calls the host during the animation loop and wires dependencies.
- Pause/reset UI state and saved-progress reset behavior.
- Main animation loop ordering across hosts and gameplay facades.

## Known intentional leftovers

- `Interactions` still owns proximity checks, timed-action lifecycle, prompts, authored interaction decisions, and objective event emission for chest opens, altar activations, gate unlocks, lever pulls, and location exits. Survival-specific consequences now call into `SurvivalHost`, but moving timed actions themselves should happen with an interaction/runtime boundary rather than by making `SurvivalHost` own all interaction decisions.
- `GameState` still owns the serialized field survival data shape and save-compatible repair helpers. `SurvivalHost` coordinates when that state changes and how it reaches HUD/save/combat, while `GameState` preserves compatibility with existing localStorage snapshots.
- First-person torch/viewmodel updates remain in `Game.js` because they belong to the equipment/viewmodel presentation layer, not survival lifecycle.
- Field return shrine reaction remains in `Game.js` for now because it is a one-off startup reaction that coordinates shrine visuals, HUD message, interaction hint, feedback shake, and save state. It should move only when a broader field-event or progression-reaction runtime exists.
- `EquipmentPanel` still reads survival inventory through `SurvivalInventoryBridge` because the panel is a UI facade; a later equipment UI pass can decide whether panel refresh/save signals should route through a host.

## Next recommended PR

Extract a `FirstPersonViewmodelHost` for Rod A1, broadsword, torch viewmodel/light updates, and equipment-driven first-person presentation. This is now the clearest remaining `Game.js` foundation seam because survival, progression, save, HUD, input, renderer, and scene-session lifecycle responsibilities have host boundaries.
