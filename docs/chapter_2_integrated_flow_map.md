# Chapter 2 Integrated Flow Map

## Production status

The Lantern-first Folsom network backfill is implemented. The Shrine Side Room and maintenance crawlspace are real authored spaces, the Keeper's Lantern is canonical in the side room, and the retained surface anchors are endpoints of a revealed under-shrine network.

The lower shrine hatch remains the final blocking reconciliation item. White-Scab Hall mechanics remain paused.

## Integrated route

```text
CHAPTER 1 PROOF
Old Work Knife behind shed
  |
  v
Three-hit shed seam -> Wood Axe + Torch
  |
  v
OLD SHRINE EXTERIOR
Growth-bound side door
  |
  | Old Work Knife cuts cords
  | Wood Axe breaks hard knot
  | save: folsom_shrine_side_room_open
  v
SHRINE SIDE ROOM
Keeper's Lantern canonical pickup
  |
  | bounded Lantern wash reveals convergence marks
  | save: folsom_under_shrine_network_revealed
  v
LOW MAINTENANCE PANEL
  |
  | Old Work Knife cuts revealed cords
  | save: folsom_shrine_crawlspace_open
  v
SHRINE CRAWLSPACE
Blocked maintenance throat; no route bypass
  |
  | revealed feeds point back to the surface network
  v
SURFACE ENDPOINTS (free order after reveal)
  |- Fire endpoint: Torch
  |- Pond endpoint: Old Work Knife
  `- Shrine endpoint: Old Work Knife
  |
  | existing anchor save keys retained
  | save: folsom_underworks_growth_unsealed
  v
UNDERWORKS GATE
Visible route payoff and transition to beneath-folsom
  |
  v
BF01-BF03
Iron Drain Bar -> drain grate -> Lantern-revealed five-hit growth gate
  |
  v
BF04 BLUE FLAME THRESHOLD
  |
  | REMAINING DEBT: explicit Iron Drain Bar lower shrine hatch
  v
BF05 LOWER SHRINE STAIR / CHAPTER 3 SKELETON
```

## Authored space ids

- `folsom_shrine_side_room_floor`: keeper maintenance room
- `folsom_shrine_side_room_door`: physical staged side seal
- `folsom_shrine_keeper_workbench`: canonical Lantern setting
- `folsom_shrine_crawlspace_panel`: Lantern-readable low panel
- `folsom_shrine_crawlspace_floor`: short maintenance passage
- `folsom_shrine_crawlspace_terminal_slab`: solid no-bypass endpoint
- `beneath_folsom_keeper_niche_empty_hook`: retired BF03 pickup dressing

## State contract

New additive state:

- `folsom_shrine_side_room_open`
- `folsom_under_shrine_network_revealed`
- `folsom_shrine_crawlspace_open`

Preserved state:

- `folsom_growth_anchor_fire_cleared`
- `folsom_growth_anchor_pond_cleared`
- `folsom_growth_anchor_shrine_cleared`
- `folsom_underworks_growth_unsealed`
- all Beneath Folsom route flags

Keeper's Lantern ownership remains equipment state under the unchanged `keepers_lantern` item id.

## Migration behavior

- Existing `keepers_lantern` ownership hides the side-room pickup; acquisition cannot duplicate the item.
- Any existing anchor clear, Underworks unseal, drain-grate clear, or hidden-gate clear migrates `folsom_under_shrine_network_revealed` to true.
- Existing anchor clears are never reset and completed endpoints are not replayed.
- Existing Underworks access and the Beneath Folsom return route remain valid.
- The BF03 niche is environmental dressing only. Saves without the Lantern acquire it through the side room and can always return from Beneath Folsom.

## Scope boundary

This backfill does not implement the lower shrine hatch, White-Scab Hall, Pale Panel, Records/Memory UI, enemies, bosses, physical weapon swings, or any Chapter 3 mechanic. BF05-BF09 remain unchanged room skeleton geometry.
