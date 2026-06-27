# AGENTS.md

Guidance for AI agents working in this repository.

## Project Identity

Dread Stone Black is a mobile-first, browser-based first-person dungeon crawler built with Vite, Three.js, and plain JavaScript/TypeScript tooling. It deploys through GitHub Pages and must run well on iPhone portrait browser play.

The intended feel is slow, physical, readable, mysterious, and ominous: King's Field-like exploration and mood, with original lore, systems, assets, and locations. Prioritize atmosphere, readable spaces, tactile interaction, mobile performance, and strong foundations over flashy features.

The project is not a general Three.js demo. Treat every change as part of a real playable game with survival loops, authored locations, mobile controls, first-person presentation, performance limits, and save compatibility.

## Working Style

Inspect the actual code before changing behavior. Do not infer architecture from one file when there are existing runtimes, validators, or location definitions that may already solve the problem.

Prefer focused pull requests, but do not under-solve foundation problems out of fear of a large diff. Codex is allowed to make meaningful architectural changes when the task calls for them. Coherent architecture is better than cosmetic micro-refactors. If a large PR is the correct architectural move, do not apologize for its size; explain the scope, preserve gameplay contracts, and make rollback safe.

When asked for a feature, first identify the relevant runtime path, data definition, and existing helpers. Preserve nearby systems unless the task explicitly asks to replace them. Avoid broad rewrites when a surgical change will work, but avoid fake architecture that only re-exports imports while leaving all logic in the old god file.

Keep the game playable after every PR. If a change is experimental, gate it behind a debug flag, location-specific config, or clear authored definition data instead of making it global by accident.

## Current Gameplay Contracts

These are current playable contracts, not eternal design handcuffs. Preserve them unless the task explicitly redesigns the starter loop or affected system:

- Folsom is the current default starter/root location.
- Folsom is a fortified pine-heavy starter settlement with pond, campfire/cooking, wooden palisade, shrine, house/tool shed, rusty Reliquary gate, and future north road/stream hooks.
- Rod A1 is the canonical fishing rod. Fishing is physical first-person rod-touch casting, not button casting. Do not add cast-zone UI unless explicitly requested.
- Preserve movement, look controls, HUD, inventory/equipment, chests, fishing/Rod A1, axe/wood, campfire cooking, hunger, torch/offhand light, gates, and basic combat unless the task says otherwise.
- Preserve mobile portrait browser play, especially iPhone.

## Non-Negotiables

- Do not break GitHub Pages deployment or Vite build assumptions.
- Do not silently remove authored content, assets, routes, or save-compatible item ids.
- Avoid global tuning when the request is location-specific or encounter-specific.
- Prefer data-driven location definitions and reusable runtime helpers over hardcoded one-off patches.
- Fix validation fallout when architecture changes expose stale assumptions. If a validator is stale, explain exactly why and what should be updated.

## Architecture Orientation

Expect multiple overlapping authoring/runtime systems:

- Location definitions under `src/game/locations/` drive authored spaces, spawns, exits, materials, terrain, interactions, and validation.
- Dungeon/interior authoring and runtime work through DARB-style compiled definitions.
- Outdoor authored spaces use OARB-style terrain, ponds, paths, foliage, outdoor chests, campfires, and exits.
- `Game.js` should be a runtime coordinator, not the owner of every system.
- `DungeonScene.js` should be a world-scene orchestrator, not the file that personally builds every indoor, outdoor, fishing, creature, gore, foliage, and interaction system.
- Survival inventory should flow through a coherent facade/runtime, not half through `GameState` and half through `EquipmentRuntime`.
- Creature systems use creature configs, animation sets, model loading, combat profiles, AI profiles, and faction/encounter managers. Treat GLB animation loading and skinned meshes as expensive on mobile.
- Fishing, survival inventory, equipment, interactions, and field objects have cross-system state. Use existing bridges/facades where present instead of duplicating ownership rules.

Meaningful refactors are allowed:

- Move code.
- Rename modules.
- Split large classes.
- Update call sites broadly.
- Create real modules/classes instead of thin re-export wrappers.
- Repair validators and call sites after architectural changes.

If you do not know which runtime path a feature uses, trace it from location definition to scene build path to update loop before editing.

## Location and Encounter Rules

Authored locations should be readable, grounded, and navigable. Spawn points must be on valid walkable ground. Exits must have clear prompt/return behavior. Decorative geometry should not create invisible blockers unless explicitly intended.

For encounters, separate visual scale from gameplay collision/range. A monster can look large without inheriting huge invisible combat bubbles. Avoid AI that fights from visually wrong distances, gets stuck on terrain, floats, sinks, or relies on excessive per-frame path checks.

When adding enemies or NPCs, consider:

- spawn safety and distance from starter loops
- target priorities and fallback behavior
- grounding on visible terrain/spline/path surfaces
- attack range matching the animation and perceived contact distance
- cleanup/respawn behavior
- mobile performance cost of skinned meshes, animations, shadows, materials, and particles

## Performance Rules

This game targets mobile browsers. A scene that is small by desktop standards can still be heavy on iPhone.

Be suspicious of:

- many skinned meshes
- many animation mixers updating every frame
- repeated GLB decoding, cloning, material preparation, or GPU upload bursts
- hidden animation roots that still update or cast shadows
- hundreds of shadow casters
- large numbers of transparent billboard planes
- excessive unique materials or textures
- unbounded gore/particle/decal accumulation
- per-frame console logs
- per-frame terrain/path/collision sampling when throttling or caching would work
- high device pixel ratio fill-rate costs on mobile

Prefer shared caches, pooled effects, throttled AI, active-only animation updates, visible-only work, staggered loading, and debug toggles that identify bottlenecks before broad optimization.

If a performance panel or screenshot report identifies a concrete bottleneck, address that bottleneck first instead of guessing.

## Visual and Asset Rules

Use existing asset naming and folder conventions. Preserve alpha on sprites/textures. Avoid white borders, accidental backgrounds, and oversized assets. For repeated objects, share materials/textures where possible.

For first-person held items or viewmodel objects, do not let world collision/terrain depth rules break the player's view. Viewmodel presentation can have separate render/depth handling from world objects when needed.

## Debugging and Instrumentation

Use debug UI and console diagnostics intentionally. Debug panels should be optional, lightweight, and activated by URL flags or dev gates. They should help answer questions like: is the bottleneck shadows, foliage, skinned meshes, animation mixers, loaded roots, gore, draw calls, materials, textures, pixel ratio, or startup asset loading?

Avoid noisy logs in production. Throttle diagnostic updates. Prefer screenshot-friendly reports for mobile testing.

## Coding Style

Use existing project style:

- ES modules.
- Prefer clear plain JavaScript unless the task is explicitly TypeScript migration.
- Keep runtime code understandable for an amateur solo developer.
- Avoid clever abstractions that make debugging harder.
- Prefer named domain modules over generic utility dumping grounds.

## Testing Expectations

Run the narrowest relevant validation first, then the build when code changes.

Common checks may include:

- `npm run build`
- `npm run validate:folsom`
- `npm run validate:fish`
- `npm run validate:reliquary-startup`

Validation scripts may lag behind current authored content. If a validator fails, report whether the failure is caused by the PR or an existing expectation mismatch. Do not ignore failures without explaining them.

Manual testing matters. For gameplay changes, include a short checklist that covers fresh load, mobile controls, the touched feature, adjacent survival/inventory systems, and return/gate flows.

When touching gameplay foundations, verify or reason through:

- fresh load starts in the intended root location
- Folsom terrain, pond, palisade, pine density, shrine, campfire area, and gates still appear when relevant
- inventory opens and shows survival items correctly
- axe/wood, Rod A1/fishing, torch, raw fish, cooked fish, hunger, and campfire cooking still work when relevant
- location transitions do not trap the player
- mobile HUD/controls still fit portrait play

## PR Quality Bar

A good PR description should include:

- what changed
- why the architecture or behavior is stronger
- what gameplay was preserved
- what files/systems are affected
- what was intentionally not changed
- validation/test results
- known limitations or follow-up risks

Keep changes scoped to the task. When a task reveals a larger architectural problem, either solve the immediate issue safely and document the larger follow-up, or make the meaningful architecture change directly if that is the correct scope.

## Current Development Bias

When in doubt, protect the playable starter experience. Folsom should remain a stable hub for testing movement, HUD, survival, fishing, cooking, inventory, gates, simple combat, and future progression hooks.

Prefer systems that will survive multiple stages of development: authoring validation, reusable runtime boundaries, performance instrumentation, asset-loading discipline, and clear data contracts between definitions and runtime behavior.
