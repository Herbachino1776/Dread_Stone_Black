# Current Milestone: Folsom Anchor Clearing V1

This is the production lock for the next Dread Stone Black tasks. It overrides older strategy, roadmap, audit, and blueprint language where they conflict.

## Project identity

Dread Stone Black is a mobile-first, browser-playable first-person dungeon crawler. It should feel slow, physical, readable, ominous, and tactile: the player forces a buried world to reveal what it has sealed away. Treat it as a real game, not a generic Three.js demo or fantasy prototype.

## Active implementation order

1. Preserve the completed tool-shed proof loop.
2. Make the fire, pond, and shrine growth anchors physically clearable.
3. Weaken each connected feed and unseal the above-ground Underworks gate after all three clear.

The direct shed loop and connected-growth visuals are complete. This pass adds only the first Chapter 2 above-ground clearing loop.

## Shed proof-loop locks

- Seal the tool-shed door seam and frame with black growth. The latch is not the target; do not build a tiny latch blob.
- Hide the Old Work Knife behind the shed so exploration teaches the solution.
- The knife is a short, worn work tool with a rusted blade and wooden handle, never a sword, fantasy dagger, or broadsword.
- Use environmental teaching only. Do not add tutorial popups or "strike the growth" instruction text.
- Require exactly three successful swipes.
- Present the runtime states as `intact -> damaged -> cleared`.
- Each successful hit should produce a small physical wiggle, pulse, or shrink-grow response.
- On the final clear, snap the cords, erupt or splash black oil, shake the screen, and fade or collapse the remaining growth.
- Open the shed only after the growth clears and persist that world state as `folsom_tool_shed_open`.
- Reveal only the locked reward: Wood Axe + Torch.

## Black-growth art lock

Black growth is a physical obstruction: wet black plant fiber, oily scab, tarred root, and burnt mycelium. It is not purple corruption, red gore, cartoon slime, magic smoke, or a generic black blob.

Use the current locked assets:

- `public/assets/textures/growth/black_growth_scab_intact_01.png`
- `public/assets/textures/growth/black_growth_scab_intact_02.png`
- `public/assets/textures/growth/black_growth_scab_damaged_01.png`
- `public/assets/textures/growth/black_growth_scab_damaged_02.png`
- `public/assets/textures/growth/black_growth_cord_surface_01.png`
- `public/assets/sprites/effects/growth/black_growth_hit_decal_01.png`

Procedural shed geometry, seam growth, hit zones, and a work-knife placeholder are acceptable for this proof. Preserve transparent PNG alpha and keep short-lived effects bounded for mobile browsers.

## Scope boundary

Persist `folsom_growth_anchor_fire_cleared`, `folsom_growth_anchor_pond_cleared`, `folsom_growth_anchor_shrine_cleared`, and `folsom_underworks_growth_unsealed` as world state. Fire uses the existing Torch/offhand capability; pond and shrine use the Old Work Knife cutting path. Cleared feeds remain visibly faded or broken, and the Underworks growth and gate open only after all three clear.

Preserve movement, mobile controls, HUD, inventory/equipment, fishing, campfire/survival behavior, gates, saves, and location loading. Do not build Beneath Folsom, a dungeon interior, Keeper's Lantern, Iron Drain Bar, enemies, Memory or Records UI, Pale Gates, church systems, or bosses.

Success is a small playable loop: physically clear all three visible anchors, see each feed fail, watch the Underworks lock and gate open, and retain every state after reload.
