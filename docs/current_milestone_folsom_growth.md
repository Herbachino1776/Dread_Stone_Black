# Current Milestone: Folsom Growth Foundation

This is the production lock for the next Dread Stone Black tasks. It overrides older strategy, roadmap, audit, and blueprint language where they conflict.

## Project identity

Dread Stone Black is a mobile-first, browser-playable first-person dungeon crawler. It should feel slow, physical, readable, ominous, and tactile: the player forces a buried world to reveal what it has sealed away. Treat it as a real game, not a generic Three.js demo or fantasy prototype.

## Active implementation order

1. Keep documentation aligned with this production lock.
2. Rebuild the Folsom tool shed as a strong physical reveal target.
3. Implement and validate the black-growth proof loop on that shed.

The direct shed loop comes first. Do not build the Chapter 2 fire, pond, or shrine anchor network until it works.

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

Preserve movement, mobile controls, HUD, inventory/equipment, fishing, campfire/survival behavior, gates, saves, and location loading. Do not expand this milestone into enemies, Memory UI, Pale Gates, church systems, bosses, a full town rebuild, or the Chapter 2 anchor network.

Success is a small playable loop: see the sealed seam, explore behind the shed, find the knife, clear the growth in three readable swipes, watch the shed open, collect the axe and torch, and retain the opened state after reload.
