# AGENTS.md

Guidance for AI agents working in this repository.

## Project Identity

Dread Stone Black is a mobile-first first-person dungeon crawler built with Vite, Three.js, and GitHub Pages. The target play surface is an iPhone browser in portrait orientation. The intended feel is slow, physical, readable, and ominous: King's Field-like exploration and mood, with original lore, systems, assets, and locations.

The project is not a general Three.js demo. Treat every change as part of a real playable game with survival loops, authored locations, mobile controls, first-person presentation, performance limits, and save compatibility.

## Working Style

Prefer small focused pull requests. Inspect the actual code before changing behavior. Do not infer architecture from one file when there are existing runtimes, validators, or location definitions that may already solve the problem.

When asked for a feature, first identify the relevant runtime path, data definition, and existing helpers. Preserve nearby systems unless the task explicitly asks to replace them. Avoid broad rewrites when a surgical change will work.

Keep the game playable after every PR. If a change is experimental, gate it behind a debug flag, location-specific config, or clear authored definition data instead of making it global by accident.

## Non-Negotiables

- Preserve mobile-first portrait play.
- Preserve Folsom as the current starter/root location unless the task explicitly changes the root.
- Preserve core player flows: movement, look controls, HUD, inventory/equipment, chests, fishing/Rod A1, campfire cooking, hunger, gates, and basic combat.
- Do not break GitHub Pages deployment or Vite build assumptions.
- Do not silently remove authored content, assets, routes, or save-compatible item ids.
- Avoid global tuning when the request is location-specific or encounter-specific.
- Prefer data-driven location definitions and reusable runtime helpers over hardcoded one-off patches.

## Architecture Orientation

Expect multiple overlapping authoring/runtime systems:

- Location definitions under `src/game/locations/` drive authored spaces, spawns, exits, materials, terrain, interactions, and validation.
- Dungeon/interior authoring and runtime work through DARB-style compiled definitions.
- Outdoor authored spaces use OARB-style terrain, ponds, paths, foliage, outdoor chests, campfires, and exits.
- `DungeonScene` is a large world-scene coordinator. Prefer using or adding boundary helpers instead of increasing its direct low-level responsibilities.
- Creature systems use creature configs, animation sets, model loading, combat profiles, AI profiles, and faction/encounter managers. Treat GLB animation loading and skinned meshes as expensive on mobile.
- Fishing, survival inventory, equipment, interactions, and field objects have cross-system state. Use existing bridges/facades where present instead of duplicating ownership rules.

If you do not know which runtime path a feature uses, trace it from location definition to scene build path to update loop before editing.

## Location and Encounter Rules

Authored locations should be readable, grounded, and navigable. Spawn points must be on valid walkable ground. Exits must have clear prompt/return behavior. Decorative geometry should not create invisible blockers unless explicitly intended.

For encounters, separate visual scale from gameplay collision/range. A monster can look large without inheriting huge invisible combat bubbles. Avoid AI that fights from visually wrong distances, gets stuck on terrain, or relies on excessive per-frame path checks.

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
- repeated GLB decoding or material preparation
- hundreds of shadow casters
- large numbers of transparent billboard planes
- excessive unique materials or textures
- unbounded gore/particle/decal accumulation
- per-frame console logs
- per-frame terrain/path/collision sampling when throttling or caching would work

Prefer shared caches, pooled effects, throttled AI, active-only animation updates, visible-only work, and debug toggles that identify bottlenecks before broad optimization.

## Visual and Asset Rules

Use existing asset naming and folder conventions. Preserve alpha on sprites/textures. Avoid white borders, accidental backgrounds, and oversized assets. For repeated objects, share materials/textures where possible.

For first-person held items or viewmodel objects, do not let world collision/terrain depth rules break the player's view. Viewmodel presentation can have separate render/depth handling from world objects when needed.

## Debugging and Instrumentation

Use debug UI and console diagnostics intentionally. Debug panels should be optional, lightweight, and activated by URL flags or dev gates. They should help answer questions like: is the bottleneck shadows, foliage, skinned meshes, gore, draw calls, materials, or pixel ratio?

Avoid noisy logs in production. Throttle diagnostic updates. Prefer screenshot-friendly reports for mobile testing.

## Testing Expectations

Run the narrowest relevant validation first, then the build when code changes.

Common checks may include:

- `npm run build`
- `npm run validate:folsom`
- `npm run validate:fish`
- `npm run validate:reliquary-startup`

Validation scripts may lag behind current authored content. If a validator fails, report whether the failure is caused by the PR or an existing expectation mismatch. Do not ignore failures without explaining them.

Manual testing matters. For gameplay changes, include a short checklist that covers fresh load, mobile controls, the touched feature, adjacent survival/inventory systems, and return/gate flows.

## PR Quality Bar

A good PR description should include:

- what changed
- why it changed
- what files/systems are affected
- what was intentionally not changed
- test results
- known limitations or follow-up risks

Keep changes scoped. When a task reveals a larger architectural problem, solve the immediate issue safely and document the larger follow-up rather than smuggling a rewrite into the PR.

## Current Development Bias

When in doubt, protect the playable starter experience. Folsom should remain a stable hub for testing movement, HUD, survival, fishing, cooking, inventory, gates, simple combat, and future progression hooks.

Prefer systems that will survive multiple stages of development: authoring validation, reusable runtime boundaries, performance instrumentation, asset-loading discipline, and clear data contracts between definitions and runtime behavior.
