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
- PR #262: Extracted `SurvivalHost` as the owner of hunger/starvation update coordination, starvation damage handoff to combat, hunger HUD sync through `HudHost`, survival save snapshot coordination through `SaveHost`, cooked/raw fish pickup handoff, cooked fish eating, campfire build persistence, and raw-fish-to-cooked-fish campfire cooking consumption. `SurvivalInventoryBridge` remains the equipment/inventory bridge rather than being duplicated.
- PR #263: Extracted `FirstPersonViewmodelHost` as the owner of camera-attached first-person equipment presentation: Rod A1 view setup/update, physical casting controller wiring, broadsword view/gesture wiring, fallback attack animation coordination, torch/offhand light attachment, equipment-driven torch visibility sync, torch flicker updates, and first-person debug summaries.
- Current PR: Finalized the `Game.js` coordinator audit by removing stale renderer/HUD/viewmodel compatibility aliases, moving the perf debug panel to read renderer/scene/session state through existing hosts, adding explicit top-level disposal ordering, and making document-level input gesture blockers disposable through `InputHost`.

## Game.js responsibilities after the coordinator audit

`Game.js` is now intentionally the application coordinator. It still owns:

- Top-level boot sequencing and host construction order.
- Wiring dependencies between hosts and existing gameplay facades.
- Equipment runtime and `SurvivalInventoryBridge` construction because they are shared cross-system state rather than one host's private implementation detail.
- `EquipmentPanel`, `Interactions`, `Combat`, and `Feedback` construction until those systems get coherent domain-specific ownership boundaries.
- The main animation-loop ordering across scene/session, first-person viewmodel, combat, survival, progression, interactions, feedback, rendering, and optional perf diagnostics.
- Pause state, reset-confirmation UI flow, saved-progress reset, startup error display, and top-level disposal.
- Lightweight read-only coordinator accessors (`dungeon`, `scene`, `camera`, `player`, and `locationId`) that forward to `SceneSessionHost` so debug consumers do not keep stale duplicated session references.

The current god-object refactor phase is considered complete: renderer, input, save, HUD, scene session, progression, survival, and first-person viewmodel internals are owned by hosts/runtimes rather than by `Game.js`.

## Known intentional leftovers

- `Interactions` still owns proximity checks, timed-action lifecycle, prompts, authored interaction decisions, and objective event emission for chest opens, altar activations, gate unlocks, lever pulls, and location exits. Survival-specific consequences call into `SurvivalHost`, but moving timed actions should happen only with a real interaction/runtime boundary.
- `Combat` still owns player attack resolution, creature damage handoff, death state, and gore-facing hit results. `Game.js` only wires its attack-start callback into `FirstPersonViewmodelHost` so first-person weapon animation remains synchronized.
- `EquipmentPanel` still reads survival inventory through `SurvivalInventoryBridge` because the panel is a UI facade. A later equipment UI pass can decide whether panel refresh/save signals should route through a host.
- Field return shrine reaction remains in `Game.js` because it is a small startup-only cross-system reaction that coordinates shrine visuals, HUD message, interaction hint, feedback shake, and save state. It should move only if a broader field-event or progression-reaction runtime is introduced.
- `GameState` still owns serialized field survival data shape and save-compatible repair helpers. Hosts coordinate when that state changes, while `GameState` preserves compatibility with existing localStorage snapshots.

## Next recommended non-refactor priority

Shift from foundation refactoring to playable-content validation and mobile performance hardening for Folsom and the Reliquary path. Recommended next work: run a device-focused smoke/performance pass around Folsom startup, Rod A1 physical fishing, campfire cooking, torch/offhand lighting, gates/return spawns, and combat/gore, then address the highest measured mobile bottleneck or the most obvious starter-loop usability issue before starting another architecture split.
