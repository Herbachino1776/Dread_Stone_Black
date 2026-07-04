# AGENTS.md

Guidance for AI agents working in this repository.

## Project Identity

Dread Stone Black is a mobile-first, browser-playable first-person dungeon crawler built with Vite, Three.js, and plain JavaScript/TypeScript tooling.

This is not a tech demo. Treat it as a real game. The target feel is slow, physical, readable, ominous, and tactile. The player should feel like they are forcing a buried world to reveal what it has sealed away.

Use the strategy guide and project documents as design reference, but do not turn every old note into implementation. Current locks and active milestone notes override older text when they conflict.

## Current Direction

The current near-term goal is the Folsom starter loop, not the whole game.

Primary active milestone:

- Rebuild the Folsom tool shed into a strong first proof target.
- Put the Old Work Knife behind the shed as an environmental discovery.
- Seal the shed door seam with black growth, not a latch blob.
- Require three swipes to clear the growth: intact -> damaged -> cleared.
- On hit, the growth should react physically with a small wiggle/shrink-grow response.
- On final clear, cords should snap, black oil should erupt/splash, the growth should fade or collapse away, and the shed should open.
- Save the opened state as `folsom_tool_shed_open`.
- The shed reward is Wood Axe + Torch.
- No tutorial text for this loop. The player learns by seeing, exploring, finding the knife, and using it.

Next design layer after that is the Chapter 2 Folsom connected-growth loop: fire, pond, and shrine anchors feeding a larger obstruction. Do not build that until the direct shed loop works.

Long-term design direction:

- Black growth is physical obstruction, not currency, magic smoke, purple corruption, or generic slime.
- Tools matter because they read and change the world.
- Records, Memory, map updates, route state, and network progress are separate concepts; do not dump progression into random inventory items.
- White-system art should feel alien, white-marble, intricate, sacred, and impossible, not generic sci-fi panels.
- Bosses and late-game systems should prove existing mechanics, not introduce unrelated feature piles.

## How to Work

Inspect before editing. Find the real runtime path from authored data to scene build to interaction/update/save behavior before making changes.

Prefer small playable proofs over broad unfinished scaffolds. A narrow real implementation is better than a large fake system that will be thrown away.

Do not invent unrelated features. If the task is about the Folsom shed, do not also build enemies, Memory UI, Pale Gates, church systems, boss ladders, or a full Folsom building overhaul unless explicitly requested.

Use the repo's existing conventions and helpers when they are good. Replace weak placeholder architecture only when the task actually requires it.

Keep changes understandable for a solo developer. Plain, named modules are better than clever abstractions.

## Gameplay and World Rules

Preserve working starter gameplay unless the task explicitly changes it. This includes movement, mobile controls, HUD, inventory/equipment, fishing, campfire/survival behavior, gates, and location loading.

Folsom is the current root/starter location. Keep it stable enough for repeated testing.

Do not add tutorial prose unless explicitly requested. Prefer environmental teaching: visible obstruction, readable tool placement, physical reaction, and clear world-state change.

Route progress should be saved as world state. Do not represent opened paths, cleared seals, map changes, or network access as permanent junk inventory.

## Asset Rules

Use exact asset paths and names when provided. Preserve transparent PNG alpha. Avoid white fringes, baked backgrounds, accidental borders, and oversized textures.

Current locked black-growth assets include:

- `public/assets/textures/growth/black_growth_scab_intact_01.png`
- `public/assets/textures/growth/black_growth_scab_intact_02.png`
- `public/assets/textures/growth/black_growth_scab_damaged_01.png`
- `public/assets/textures/growth/black_growth_scab_damaged_02.png`
- `public/assets/textures/growth/black_growth_cord_surface_01.png`
- `public/assets/sprites/effects/growth/black_growth_hit_decal_01.png`

For the Old Work Knife, do not use a sword or fantasy dagger. If no final model exists, create a simple procedural work-knife placeholder: short rusted blade, worn wooden handle, dull shed-tool proportions.

For the first shed pass, procedural/simple geometry is acceptable for the shed, seam growth, hit zones, and knife placeholder. A final GLB can come later after scale and feel are proven.

## Performance Rules

This game targets mobile browsers. Keep scenes and effects lightweight.

Be careful with transparent planes, particles, decals, shadows, skinned meshes, animation mixers, large textures, and unbounded effect accumulation. Pool or clean up short-lived effects.

Effects should feel punchy but cheap. A black oil burst and screen shake are fine; permanent particle spam is not.

## Testing

Run the narrowest relevant checks first, then the build when code changes.

Common commands:

- `npm run validate:folsom`
- `npm run build`

If validation fails, report whether the failure is caused by the change or by an existing stale expectation. Do not ignore failures.

Manual gameplay checks matter. For the current Folsom shed milestone, verify:

- fresh load reaches Folsom
- the rebuilt shed appears and is navigable
- the Old Work Knife is behind the shed
- the shed seam growth blocks opening before clearing
- three swipes clear the growth
- hit feedback, black oil burst, cord snap/fade, and screen shake trigger appropriately
- the shed opens and reveals Wood Axe + Torch
- `folsom_tool_shed_open` persists after reload
- existing starter systems still work well enough for testing

## Pull Request Expectations

Keep PRs scoped to the requested milestone.

A good PR summary should say:

- what changed
- why it supports the current milestone
- what files/systems were touched
- what was intentionally not changed
- what validation was run
- what limitations or follow-ups remain

When unsure, protect the playable proof loop. Make the smallest real thing that proves the game better.