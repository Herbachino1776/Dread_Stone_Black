# Chapter 2 Integrated Flow Map

## Production status

The Lantern-first Folsom network backfill is implemented and setpiece-hardened. The Shrine Side Room is a dressed keeper maintenance chamber, the bounded crawlspace has a physically reinforced no-bypass throat, the Keeper's Lantern is canonical in the side room, and the retained surface anchors are readable endpoints of a revealed under-shrine network.

The explicit lower shrine hatch is implemented at the BF04/BF05 seam. The blue-flame hallway is threshold atmosphere, not a hatch replacement. Chapter 2 structural reconciliation is complete. The active Chapter 3 handoff now uses an impossible front seal and the separate Under-Shrine Labyrinth bypass; White-Scab Hall mechanics remain deferred.

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
  | bounded Lantern wash reveals three-way marks and buried cords
  | save: folsom_under_shrine_network_revealed
  v
LOW MAINTENANCE PANEL
  |
  | Old Work Knife cuts revealed cords
  | save: folsom_shrine_crawlspace_open
  v
SHRINE CRAWLSPACE
Low frames + buried slabs + cords -> barred stone throat; no route bypass
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
  | threshold atmosphere
  v
EXPLICIT LOWER SHRINE HATCH
  | requires: beneath_folsom_hidden_growth_gate_cleared
  | tool: Iron Drain Bar
  | save: beneath_folsom_lower_shrine_hatch_open
  v
BF05 LOWER SHRINE STAIR
  -> impossible front seal (never opens locally)
  -> lower knot death opens Folsom shrine crawlspace terminal
  -> under-shrine-labyrinth
  -> beneath-folsom threshold backside
```

## Authored space ids

- `folsom_shrine_side_room_floor`: keeper maintenance room
- `folsom_shrine_side_room_door`: physical staged side seal
- `folsom_shrine_keeper_workbench`: canonical Lantern setting
- `folsom_shrine_keeper_broken_work_surface`: failed keeper work station
- `folsom_shrine_keeper_wall_shelf_low` / `folsom_shrine_keeper_wall_shelf_high`: maintenance storage dressing
- `folsom_shrine_keeper_floor_slab` / `folsom_shrine_keeper_floor_grate`: low work slab and cord-entry ironwork
- `folsom_shrine_keeper_frame_*`: old timber pressure framing
- `folsom_shrine_crawlspace_panel`: Lantern-readable low panel
- `folsom_shrine_crawlspace_floor`: short maintenance passage
- `folsom_shrine_crawlspace_frame_*`: repeated low maintenance frames
- `folsom_shrine_crawlspace_buried_slab_left` / `folsom_shrine_crawlspace_buried_slab_right`: pressed-in stone dressing
- `folsom_shrine_crawlspace_terminal_slab`: solid Chapter 2 endpoint; cracks open only after the Chapter 3 lower-knot state
- `folsom_shrine_crawlspace_terminal_stone_collar`: heavy throat framing around the terminal grate
- `beneath_folsom_keeper_niche_backplate`, `beneath_folsom_keeper_niche_empty_hook`, and related bracket/ring/dust-shadow props: retired BF03 pickup dressing
- `beneath_folsom_lower_shrine_hatch`: heavy shrine-stone hatch visual at the BF04/BF05 seam
- `beneath_folsom_lower_shrine_hatch_blocker`: route collision removed by the successful bar pry

## State contract

New additive state:

- `folsom_shrine_side_room_open`
- `folsom_under_shrine_network_revealed`
- `folsom_shrine_crawlspace_open`
- `beneath_folsom_lower_shrine_hatch_open`
- `beneath_folsom_white_scab_lower_knot_destroyed`
- `folsom_shrine_crawlspace_terminal_open`
- `under_shrine_labyrinth_end_hatch_open`

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
- Fresh saves require both persisted and active runtime reveal state before surface-endpoint prompts are eligible.
- Existing Underworks access and the Beneath Folsom return route remain valid.
- The BF03 niche is environmental dressing only. Saves without the Lantern acquire it through the side room and can always return from Beneath Folsom.
- On the first hatch-aware load, legacy saves that had already cleared the formerly open BF04/BF05 seam are migrated to hatch-open. Any existing or future save with a planned Chapter 3 state also forces the hatch open, preventing a route softlock.

## Scope boundary

Chapter 2 remains preserved. Chapter 3 now bypasses the impossible front seal through the old shrine terminal and the standalone `under-shrine-labyrinth` location, exiting behind the denied threshold. White-Scab Hall clear, Pale Panel, Shrine Mechanism Room mechanics, Records/Memory UI, enemies, bosses, and physical weapon swings remain deferred.
