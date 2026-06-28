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
- Current PR: Extracted `SceneSessionHost` as the owner of the active world session, including camera creation, `DungeonScene` creation, startup location resolution, return-spawn resolution, player creation, scene update handoff, rendering handoff, transition URL orchestration, reload/reset session API, compatibility accessors, and session cleanup.

## Remaining Game.js responsibilities

- Top-level boot sequencing and host wiring.
- Equipment runtime and survival inventory bridge construction.
- Objective runtime, objective event bridging, and objective debug panel wiring.
- First-person viewmodel construction for Rod A1, broadsword, and player torch light.
- Interaction, combat, fishing cast controller, gesture controller, hunger update, and feedback loop coordination.
- Pause/reset UI state and saved-progress reset behavior.
- Main animation loop ordering across hosts and gameplay facades.

## Known intentional leftovers

- Objective location/room tracking remains in `Game.js` because objective runtime ownership has not been extracted yet and is still coupled to equipment events, combat hit events, and objective panel saves.
- Hunger/starvation remains in `Game.js` because it bridges `GameState`, equipment panel pause state, HUD hunger rendering, and combat damage; it should move with a future survival runtime coordinator rather than into `SceneSessionHost`.
- First-person torch/viewmodel updates remain in `Game.js` because they belong to the equipment/viewmodel layer, not scene-session lifecycle.
- Interactions still performs interaction-specific decision logic, but location navigation is delegated into `SceneSessionHost` so transition URL construction and preloading are no longer interaction-owned.

## Next recommended PR

Extract an `ObjectiveHost` or `ProgressionHost` that owns objective runtime creation, location/room tracking, equipment/combat objective event bridges, objective panel rendering, and objective save snapshots. That would leave `Game.js` focused on boot order and high-level loop composition while keeping authored objective validation and messages in their existing registries.
