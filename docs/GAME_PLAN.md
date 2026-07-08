# Dread Stone Black - Game Plan

## Core pitch

Dread Stone Black is a mobile-first, browser-playable first-person dungeon crawler. It is slow, physical, readable, ominous, and tactile. The player explores a buried world and uses practical tools to force it to reveal what black growth has sealed away.

All names, maps, enemies, UI, lore, art, and assets must remain original. The game may draw tonal inspiration from old first-person action RPGs, but it must not copy them.

## Platform and stack

- Vite and Three.js
- Plain JavaScript/TypeScript modules
- Phone-first touch controls and portrait-readable HUD
- Desktop controls as a secondary testing path
- GitHub Pages deployment from GitHub Actions

Preserve the configured Vite base path and automated Pages workflow.

## Current playable target

The active milestone is the Chapter 1-2 strategy reconciliation. The Lantern-first Shrine Side Room/crawlspace backfill is implemented; the explicit lower shrine hatch remains required before Chapter 3 mechanics. See [`chapter_2_integrated_flow_map.md`](chapter_2_integrated_flow_map.md) and [`current_milestone_folsom_growth.md`](current_milestone_folsom_growth.md).

The completed first proof remains locked:

1. Find a rebuilt, physically readable shed sealed along its door seam/frame.
2. Discover the Old Work Knife behind the shed without tutorial text.
3. Clear the black growth in exactly three successful swipes with readable physical feedback.
4. Open the shed and recover Wood Axe + Torch.
5. Preserve the opened state after reload.

The surface fire, pond, and shrine anchors are preserved as endpoints of the Lantern-revealed under-shrine network. Existing saves retain their clears; fresh saves reveal the network before endpoint interactions become available.

## Stable design rules

- Black growth is a physical obstruction, not currency, smoke, generic slime, or a magic pickup system.
- Tools matter because they let the player read and change the world.
- Route state, map updates, Records, Memory, and network progress are distinct concepts.
- World changes belong in persistent world state rather than junk inventory.
- Environmental teaching is preferred to tutorial prose.
- Mobile performance and readability constrain every effect and interaction.
- Broad content expansion waits for the current playable proof.
