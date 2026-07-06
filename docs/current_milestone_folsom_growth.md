# Current Milestone: Beneath Folsom Keeper's Lantern V1

This is the production lock for the next Dread Stone Black tasks. It overrides older strategy, roadmap, audit, and blueprint language where they conflict.

## Project identity

Dread Stone Black is a mobile-first, browser-playable first-person dungeon crawler. It should feel slow, physical, readable, ominous, and tactile: the player forces a buried world to reveal what it has sealed away. Treat it as a real game, not a generic Three.js demo or fantasy prototype.

## Active implementation order

1. Preserve the completed tool-shed proof loop.
2. Make the fire, pond, and shrine growth anchors physically clearable.
3. Weaken each connected feed and unseal the above-ground Underworks gate after all three clear.

The direct shed loop, Chapter 2 above-ground anchor clearing, Beneath Folsom entry, and Iron Drain Bar loop are complete. This pass adds the first proof that normal sight is insufficient below Folsom.

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

## Beneath Folsom tool-loop lock

- The opened Underworks gate becomes a functional transition only after `folsom_underworks_growth_unsealed`.
- Register the location as `beneath-folsom`, displayed as Beneath Folsom.
- Build one short descent/landing and one readable damp underworks chamber with timber bracing, drainage, mud, and atmospheric black roots.
- Provide a clear return route to the opened Underworks gate in Folsom.
- Place the persistent `iron_drain_bar` pickup near the first landing, away from the arrival spawn.
- Use it to pry one jammed lower drain grate; bare hands produce minimal physical failure feedback.
- Persist the opened route as `beneath_folsom_drain_grate_pried`.
- Open only a short maintenance alcove/drain throat beyond the grate, ending at a blocked future route.
- Place the persistent `keepers_lantern` utility pickup in the maintenance niche beyond the pried grate.
- Equip it through the shared offhand selection alongside Torch while keeping its cold reveal emitter and light behavior independent; the sealed lower wall carries one modest cluster of broken warning glyphs and black contamination.
- Persist discovery as `beneath_folsom_keepers_lantern_reveal_seen` so the route truth remains readable after reload.
- Keep hidden glyph art dynamically tied to the post-sway lantern emitter cone: it is not rendered under ambient light or Torch, fades in only under the focused cold light, and fades back to complete invisibility when the cone moves away. The discovery flag records read state, not permanent visual opacity.
- The traces point toward the sealed lower wall but do not open it.
- Preserve all existing shed, anchor, gate, survival, equipment, fishing, HUD, mobile-control, and save behavior.

## Scope boundary

Persist `folsom_growth_anchor_fire_cleared`, `folsom_growth_anchor_pond_cleared`, `folsom_growth_anchor_shrine_cleared`, and `folsom_underworks_growth_unsealed` as world state. Fire uses the existing Torch/offhand capability; pond and shrine use the Old Work Knife cutting path. Cleared feeds remain visibly faded or broken, and the Underworks growth and gate open only after all three clear.

Preserve movement, mobile controls, HUD, inventory/equipment, fishing, campfire/survival behavior, gates, saves, and location loading. Do not build the full Beneath Folsom dungeon, Iron Drain Bar combat, enemies, Memory or Records UI, Pale Gates, white machinery, church systems, or bosses.

Success is a small playable continuation: recover Keeper's Lantern beyond the grate and sweep its physical cone across a hidden warning cluster that points toward the next blocked route without opening it.
