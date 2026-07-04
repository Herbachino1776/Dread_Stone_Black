# Folsom Growth Asset Note

This file replaces the earlier full-game asset-gap audit. That audit was useful for discovery but was too broad and latch-first for the current production milestone. Use `docs/current_milestone_folsom_growth.md` as the implementation lock.

## Current asset decision

The first target is the Folsom tool-shed door seam/frame, not the latch. Build one small, readable physical obstruction from wet black plant fiber, oily scab, tarred root, and burnt mycelium. Do not request or build a tiny latch-cover blob.

The proof can use procedural/simple geometry for the rebuilt shed, seam growth, cords, hit zones, and Old Work Knife. A final growth GLB or knife GLB is not required before scale, interaction, and feel are proven.

## Locked assets already in the repository

- `public/assets/textures/growth/black_growth_scab_intact_01.png`
- `public/assets/textures/growth/black_growth_scab_intact_02.png`
- `public/assets/textures/growth/black_growth_scab_damaged_01.png`
- `public/assets/textures/growth/black_growth_scab_damaged_02.png`
- `public/assets/textures/growth/black_growth_cord_surface_01.png`
- `public/assets/sprites/effects/growth/black_growth_hit_decal_01.png`

These are the required art inputs for the first pass. Preserve their transparent alpha, avoid white fringes or baked backgrounds, and keep texture/effect use mobile-conscious.

## Art and feedback acceptance

- The growth reads as a seal bridging the door and frame.
- It stays black while retaining enough fibrous/oily surface detail to read on a phone.
- The runtime presents `intact -> damaged -> cleared` over exactly three successful swipes.
- Hits produce a small physical wiggle, pulse, or shrink-grow response.
- Final clearing snaps cords, erupts or splashes black oil, shakes the screen, and fades or collapses the remaining growth.
- Short-lived effects are cleaned up or pooled; no permanent transparent-particle accumulation.
- The Old Work Knife reads as a short rusted work tool with a worn wooden handle, never a sword, fantasy dagger, or broadsword.

## Deferred asset work

Do not commission a full growth family, latch cover, chest cover, pale-panel cover, enemy set, white-system kit, Records/Memory UI, or Chapter 2 anchor pack for this milestone. Review additional art needs only after the direct shed loop is playable and `folsom_tool_shed_open` survives reload.
