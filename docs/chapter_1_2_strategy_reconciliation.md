# Chapter 1-2 Strategy Reconciliation

Audit date: 2026-07-07
Audited baseline: `2c35afd` (`Add Chapter 3 location truth and room skeleton`)

## Implementation update: Chapter 2 structural reconciliation

The first recommended backfill is implemented after the audited baseline:

- `folsom_shrine_side_room_floor` and its enclosing maintenance-space geometry make the Shrine Side Room physical.
- The side seal uses a staged Old Work Knife cord cut followed by a Wood Axe knot break and persists `folsom_shrine_side_room_open`.
- The Keeper's Lantern canonical pickup is `folsom_shrine_side_room_keepers_lantern_pickup`. BF03 now contains an empty hook rather than a duplicate pickup.
- A bounded Lantern wash reveals the convergence marks and previously hidden surface feeds, persisting `folsom_under_shrine_network_revealed`.
- The retained fire, pond, and shrine anchors are unavailable to fresh saves until that reveal. Existing anchor and Underworks progress migrates automatically and is never reset.
- `folsom_shrine_crawlspace_floor` is a short physical maintenance passage. Its panel persists `folsom_shrine_crawlspace_open`, and its solid terminal throat prevents an Underworks bypass.
- The crawlspace now lowers the player view beneath its roof while occupied.
- `beneath_folsom_lower_shrine_hatch` explicitly closes the BF04/BF05 seam. It requires the hidden five-hit gate clear and the existing Iron Drain Bar, removes `beneath_folsom_lower_shrine_hatch_blocker`, and persists `beneath_folsom_lower_shrine_hatch_open`.
- The blue-flame hallway remains threshold atmosphere rather than substituting for the hatch.

See [`chapter_2_integrated_flow_map.md`](chapter_2_integrated_flow_map.md) for the current route contract.

## Verdict

Chapter 1's shed proof matches the current production lock and the strategy guide. The broader Chapter 1 framing is only partial. Chapter 2 now has the intended Lantern-first investigation, a coherent surface-endpoint adaptation, and the explicit bar-pried lower shrine hatch handoff. Chapter 2 structural reconciliation is complete.

The surface anchors are explicitly revealed endpoints of a deeper under-shrine network. This keeps the successful surface loop while restoring the guide's investigation-tool order and causal lesson. The remaining major divergence is the approved replacement of three underground pockets with adapted surface endpoints; it is not a structural blocker.

White-Scab Hall remains the next paused Chapter 3 mechanic. This verdict does not authorize White-Scab Hall, Pale Panel, or other Chapter 3 implementation in the hatch pass.

## Sources and authority

This audit read the preface/design locks, all of Chapters 1 and 2, and the Chapter 3 opening and route setup in `dread_stone_black_strategy_guide_DESIGN_LOCKED_MASTER_01-19.md`, plus the current milestone, closure audit, Chapter 3 contract/flow map, production note, game plan, grounding guide, asset note, authored location definitions, interactions, persistence, and the shed/connected-growth/Lantern/hidden-gate runtimes.

No separate `dread_stone_black_strategy_guide_MASTER_01-19.md` is present. The design-locked master is the only 01-19 strategy guide in the repository.

The current milestone has production precedence, but precedence does not make a divergence invisible. This document identifies which current locks should remain, which need backfill, and which still require an explicit design decision.

## 1. Guide truth summary

### Chapter 1 intended route

1. Wake on the road outside Folsom and enter through the west gate.
2. Receive a Folsom map update and inspect the choked common fire without tools.
3. Follow the pond path to the tool shed.
4. Find the Old Work Knife behind the shed.
5. Clear the shed door seam/frame in exactly three successful swipes.
6. Recover the Wood Axe and Torch.
7. Restore the common fire through physical film/cord/knot clearing.
8. Inspect the pond marker and record the pond/shrine connection.
9. Mark the Old Shrine Exterior as the next objective.
10. Optionally explore the First Night Road; combat is not required.

The guide's current-proof language narrows the mandatory production proof to the knife, three-swipe shed seal, Axe/Torch reward, and persisted open state. It still defines the broader Chapter 1 route and endpoint as the first tools recovered with the old shrine marked next.

### Chapter 1 required locations/spaces

- Folsom west gate and outside-road arrival
- Common fire
- Tool shed
- Pond path and marker
- Old Shrine Exterior
- Optional First Night Road

### Chapter 1 required tools

- Old Work Knife
- Wood Axe
- Torch

### Chapter 1 required route/domain states

- Folsom local map update
- Tool Shed Opened (`folsom_tool_shed_open` in the current proof)
- Common Fire Restored
- Pond Clue Recorded
- Old Shrine Exterior Marked

The latter three are world/map/Records concepts, not inventory items.

### Chapter 2 intended route

1. Return to the Old Shrine Exterior.
2. Clear a side latch with Knife/Axe work and open the Shrine Side Room.
3. Recover the Keeper's Lantern in that side room.
4. Use the Lantern to reveal cords running under the shrine.
5. Reveal and open a crawlspace panel, then enter beneath the shrine.
6. Recover the Iron Drain Bar from a threaded worker near the blocked drain.
7. Break growth and pry open the drain channel.
8. At the underground drain split, use the Lantern to read three cord paths.
9. Clear the underground Fire, Pond, and Shrine anchor pockets in any order.
10. Return to the lower shrine hatch after all three cords die.
11. Pry the lower hatch open with the Iron Drain Bar.

The structural lesson is not merely "clear three objects." It is: use the Lantern to discover that a blocked route is fed by a network, follow the network through physical spaces, clear its anchors, return to the blocker, and open the route.

### Chapter 2 required locations/spaces

- Old Shrine Exterior
- Shrine Side Room
- Shrine Crawlspace
- Drain channel and three-way split
- Fire Anchor pocket
- Pond Anchor pocket
- Shrine Anchor pocket
- Lower shrine hatch

### Chapter 2 required tools

- Keeper's Lantern, acquired before the hidden-cord/network investigation
- Iron Drain Bar, acquired near the drain after entering below the shrine
- Continued use of Old Work Knife and Wood Axe

### Chapter 2 required route/domain states

- Shrine Side Room Open
- Keeper's Lantern Recovered (equipment ownership)
- Drain Channel Open
- Folsom Anchor I/II/III Cleared
- Lower Shrine Hatch Open
- Shrine note and drain-worker note in Records
- Shrine side-room map update and lower-shrine route map update

### Chapter 2 endpoint and Chapter 3 handoff

Chapter 2 ends when the three underground feeds are dead and the player pries open the lower shrine hatch. Chapter 3 begins by descending through that hatch into the Lower Shrine Stair, then proceeds to White-Scab Hall.

The guide does not define a hidden five-hit growth wall or blue-flame hallway at this boundary. Those can remain as added threshold material, but they do not by themselves satisfy the lower-hatch handoff.

## 2. Implementation summary

### Current Folsom implementation

- Folsom loads as the root field with the player starting inside the central courtyard, not outside the west gate.
- The rebuilt tool shed has a full seam/frame growth target. The Old Work Knife is behind it; exactly three hits open it and persist `folsom_tool_shed_open`; Wood Axe and Torch chests are inside.
- A fishable pond, pond path, open ruined shrine exterior, central campfire, border wall, Underworks gate, and return spawn exist.
- A physical Shrine Side Room extends the existing shrine, with a Knife-then-Axe seal, keeper workbench, canonical Lantern pickup, and persisted opening.
- A physical low maintenance crawlspace extends from the side room and ends at blocked roots/grating without bypassing the Underworks gate.
- Three connected-growth anchors are retained above ground at the common fire, pond, and shrine. Their feeds are hidden from fresh saves until the Lantern reveals the under-shrine network.
- Fire requires Torch ownership. Pond and shrine require Old Work Knife ownership. All three endpoint interactions require the persisted network reveal for fresh saves.
- Clearing all three surface anchors persists their states, unseals the separate Underworks gate, raises its door, and enables the `beneath-folsom` transition.
- There is still no shrine note, pond clue record, Old Shrine Exterior map state, west-gate arrival sequence, or Wrong Dog route.

### Current Beneath Folsom implementation

- BF01 is an Underworks Entry Stair with a return route to Folsom.
- BF02 is a broad First Drain Landing. The Iron Drain Bar is an equipment pickup on the landing before the drain grate.
- The drain grate requires the bar, animates open, removes collision, and persists `beneath_folsom_drain_grate_pried`.
- BF03 is a Lower Drain Throat. Its former Lantern pickup is now an empty niche; the Lantern arrives from the Folsom shrine route.
- The Lantern reveal cone exposes glyph decals and a hidden growth wall. Torch and ambient light do not reveal them.
- The hidden wall requires Lantern reveal, Old Work Knife ownership, and exactly five successful hits. Its final clear persists, collapses the growth, fades the wall, and reveals the blue-flame hallway.
- BF04 is the Blue Flame Threshold. It is now an open physical seam into BF05, the Chapter 3 Lower Shrine Stair.
- BF05-BF09 contain the preserved Chapter 3 room skeleton through the Crypt Access Stair, with deferred-mechanic blockers.
- There are no three underground anchor pockets, worker body, shrine/drain Records, or map-state implementation. The explicit lower shrine hatch is now implemented at BF04/BF05.

### Current route order

`courtyard start -> Old Work Knife -> three-hit shed -> Wood Axe + Torch -> Shrine Side Room Knife/Axe seal -> Keeper's Lantern -> under-shrine network reveal -> crawlspace panel -> surface fire/pond/shrine endpoints -> Underworks gate -> BF01 entry -> Iron Drain Bar -> drain grate -> revealed five-hit growth gate -> Blue Flame Threshold -> Lower Shrine Stair -> White-Scab Hall future blocker`

The Lantern reveal gates all three endpoints for fresh saves. After reveal, anchor order is free. Existing saves with any anchor or Underworks progress migrate to revealed state and retain every completed clear.

### Current save and world-state keys

Written route flags:

- `folsom_tool_shed_open`
- `folsom_shrine_side_room_open`
- `folsom_under_shrine_network_revealed`
- `folsom_shrine_crawlspace_open`
- `folsom_growth_anchor_fire_cleared`
- `folsom_growth_anchor_pond_cleared`
- `folsom_growth_anchor_shrine_cleared`
- `folsom_underworks_growth_unsealed`
- `beneath_folsom_drain_grate_pried`
- `beneath_folsom_hidden_growth_gate_cleared`

Equipment ownership is persisted in `dreadStoneBlack.equipmentState`, including Old Work Knife, Wood Axe, Torch, Iron Drain Bar, and Keeper's Lantern.

`beneath_folsom_keepers_lantern_reveal_seen` is declared, resettable, and exposed through `GameState`, but the inspected runtime never calls `revealBeneathFolsomKeepersLanternTraces()`. It should not currently be described as a reliably written route flag.

Planned Chapter 3 keys are metadata only and are not yet written:

- `beneath_folsom_white_mechanism_exposed`
- `beneath_folsom_pale_panel_activated`
- `beneath_folsom_crypt_access_stair_open`

### Current blockers and gates

- Shed door collision until the three-hit seam growth clears.
- Shrine side-room door collision until the Knife-cord/Axe-knot sequence completes.
- Shrine crawlspace panel collision until the Lantern-revealed cords are cut.
- Fresh-save surface endpoint interactions until `folsom_under_shrine_network_revealed` is written.
- Surface Underworks growth lock and transition requirement until all three anchors clear.
- BF02 drain-grate collision until the Iron Drain Bar pry.
- BF03 hidden growth wall until five revealed Knife hits clear it.
- Chapter 3 future blockers at White-Scab Hall, Pale Panel/Buried White Chamber, and crypt root mat.
- Hard boundary before First Crypt.

### Current tool acquisition order

1. Old Work Knife
2. Wood Axe and Torch
3. Keeper's Lantern
4. Iron Drain Bar

The backfill now matches the guide's important tool order: the Keeper's Lantern leads the crawlspace/network investigation, and the Iron Drain Bar is recovered later in Beneath Folsom.

## 3. Difference table

Status terms are applied to guide beats, not to general playability.

| Guide beat | Status | Reconciliation finding |
| --- | --- | --- |
| Physical growth, tools, route state, Records/map separation | MATCHES | Implemented route flags and equipment stay separate; no anchor tokens are awarded. Records/map domains remain absent rather than faked as inventory. |
| Wake outside Folsom facing the west gate | IMPLEMENTED DIFFERENTLY | The player starts inside the central courtyard. No arrival road or west-gate entry sequence exists. |
| Folsom local map update | MISSING | No Chapter 1 map-state event exists. |
| Inspect choked common fire before finding tools | PARTIAL | A campfire and Fire Anchor exist, but there is no pre-tool inspection beat or delayed Chapter 1 fire problem. |
| Tool shed as the first physical proof target | MATCHES | The shed is a readable structure and the growth seals the seam/frame. |
| Old Work Knife behind the shed | MATCHES | Correct environmental placement and tool proportions are implemented. |
| Exactly three shed swipes: intact -> damaged -> cleared | MATCHES | Hit count, state change, reaction, oil, cord collapse, shake, door opening, and persistence are implemented. |
| Shed reward: Wood Axe + Torch | MATCHES | Both are inside the opened shed. |
| Restore common fire with film/cord/knot tool roles | INTENTIONAL DIVERGENCE ALREADY DOCUMENTED | Production keeps fire in the Chapter 2 surface-anchor loop. Its hardened knot now requires a physical Wood Axe chop; the guide's full `Common Fire Restored` sequence/state remains absent. |
| Pond path and optional fishing | PARTIAL | Pond/path/fishing exist. The guide's marker-stone reveal and clue are absent. |
| Pond Clue Recorded | MISSING | No Records event/domain entry exists. |
| Old Shrine Exterior as marked Chapter 1 endpoint | PARTIAL | The shrine exterior and altar inspection exist; no map mark, side-wall clue, keeper warning, or explicit Chapter 1 endpoint state exists. |
| Optional First Night Road/Wrong Dog | MISSING | Optional content; not a structural blocker. |
| Chapter 1 ends with tools recovered and shrine marked next | PARTIAL | Tools are recovered. Shrine marking and route framing are missing. |
| Return to Old Shrine for Chapter 2 | MATCHES | The physical side-room seal now centers the Chapter 2 investigation on the existing shrine exterior. |
| Clear shrine side latch with Knife/Axe | MATCHES | Knife cuts the cords, Axe breaks the exposed hard knot, and the physical door opens. |
| Shrine Side Room Open | MATCHES | The authored keeper maintenance room persists `folsom_shrine_side_room_open`. |
| Keeper's Lantern acquired in Shrine Side Room | MATCHES | The side-room workbench is canonical; BF03 is an empty niche and existing ownership is deduplicated. |
| Shrine note and side-room map update | MISSING | No Records or map implementation exists. |
| Lantern reveals cords under shrine before network traversal | MATCHES | The bounded Lantern wash reveals convergence marks and all three surface feeds before fresh-save endpoint interactions become available. |
| Shrine crawlspace panel and crawlspace | MATCHES | A Knife-opened, persisted low maintenance passage ends at a blocked throat and points back into the Underworks network. |
| Threaded worker and Iron Drain Bar after crawlspace | PARTIAL | The bar exists as a persistent local tool, but it sits openly on BF02's landing with no worker/body discovery. |
| Drain channel and grate opened with growth break + bar pry | PARTIAL | The drain channel and bar-pried grate exist and persist. The Axe growth-break stage is absent. |
| Underground drain split into three visible cord routes | IMPLEMENTED DIFFERENTLY | The Lantern reveals an under-shrine convergence and three long surface feed routes rather than an underground three-way tunnel split. |
| Three underground anchor chambers/pockets/knots | INTENTIONAL DIVERGENCE ALREADY DOCUMENTED | The three retained surface endpoints now belong visibly and mechanically to the revealed under-shrine network and are the approved adaptation. |
| Fire Anchor tool sequence and prior-fire consequence | PARTIAL | A surface Fire Anchor requires Torch, but no Axe/Knife sequence or weakened-by-restored-fire dependency exists. |
| Pond Anchor Lantern/Axe/Knife sequence around pale stone | PARTIAL | A surface pond knot exists and Knife clears it; Lantern and Axe stages and pale-stone reveal are absent. |
| Shrine Anchor Lantern reveal around pale panel | PARTIAL | A surface shrine knot exists and Knife clears it; Lantern reveal, panel edges, and pale pulse are absent. |
| Anchor states are persistent world state, not inventory | MATCHES | All three clears persist as world flags. |
| Anchors open the lower shrine hatch | IMPLEMENTED DIFFERENTLY | They unseal the separate above-ground Underworks gate instead. |
| Underworks gate opened from surface anchors | INTENTIONAL DIVERGENCE ALREADY DOCUMENTED | This is current production truth and a successful route gate, but it is an added/substituted beat rather than guide truth. |
| Iron Drain Bar pries the lower shrine hatch | MATCHES | The existing bar forces the BF04/BF05 hatch with a slower, heavier strain response than the drain grate. |
| Lower Shrine Hatch Open route state | MATCHES | The explicit hatch removes its blocker and persists `beneath_folsom_lower_shrine_hatch_open`; legacy and Chapter 3-progress saves migrate open. |
| Beneath Folsom hidden five-hit growth gate | INTENTIONAL DIVERGENCE ALREADY DOCUMENTED | This is a successful Lantern/Knife capstone added by the current lock. It should be preserved, but it does not mechanically stand in for a bar-pried lower hatch. |
| Hidden gate partial damage persistence | PARTIAL | Final clear persists; hit counts one through four reset on reload. This is polish unless mid-encounter persistence becomes a project-wide rule. |
| Keeper's Lantern reveal-seen state | PARTIAL | The key and methods exist, but no inspected call writes the flag when reveal occurs. |
| Blue-flame hallway as Chapter 2 endpoint/seam | APPROVED ADDITION | The hall is threshold atmosphere leading to the explicit hatch; it does not replace the guide endpoint. |
| Chapter 3 begins by descending through the opened lower hatch | MATCHES | The bar-pried hatch now exposes BF05 Lower Shrine Stair. |
| Chapter 3 Lower Shrine Stair and guide room order | MATCHES | The preserved BF05-BF09 skeleton follows the guide's Chapter 3 space order. Mechanics remain deferred. |

## 4. Design decision recommendations

### A. Keep as approved adaptation

- Preserve the completed three-hit shed loop exactly as implemented.
- Preserve the three surface anchor scenes and their persistent flags. They are readable world changes and can become the above-ground ends of a Lantern-revealed network instead of being discarded.
- Preserve the Underworks gate as the major Folsom-to-below transition. It gives the surface anchors an immediate visible payoff.
- Preserve the Iron Drain Bar and persistent drain-grate pry.
- Preserve the bounded Keeper's Lantern reveal runtime.
- Preserve the hidden five-hit growth gate and its blue-flame reveal as an added Chapter 2 capstone.
- Preserve the blue-flame hallway and the complete Chapter 3 room skeleton.

These approvals define the completed Chapter 2 structural adaptation.

### B. Structural backfill status

1. **Lower-hatch handoff complete.** The readable BF04/BF05 hatch uses the existing Iron Drain Bar after the hidden gate clear and persists `beneath_folsom_lower_shrine_hatch_open` without changing the Chapter 3 skeleton.

The Lantern-first shrine investigation, physical maintenance crawlspace, canonical pickup migration, and reveal-gated surface network are complete.

### C. Backfill later as polish

- West-gate outside-road arrival, guard dialogue, and Folsom local map update.
- Pond marker and Pond Clue Records entry.
- Old Shrine Exterior map mark and keeper dialogue.
- Shrine/drain notes once Records ownership exists.
- Threaded worker dressing around the Iron Drain Bar.
- Richer film/cord/knot sub-stages for the common fire and individual anchors.
- Optional First Night Road and Wrong Dog.
- Persist one-to-four hidden-gate hits if encounter-level partial damage persistence becomes a standard.
- Wire `beneath_folsom_keepers_lantern_reveal_seen` or remove it from claimed route truth.

The Chapter 1 shrine mark is useful framing, but the Chapter 2 Lantern order and handoff are more important blockers.

### D. Rewrite guide / update lock

After the backfill decision is implemented and playtested, update the guide/current lock to state explicitly:

- the three Folsom anchors are surface endpoints of an under-shrine network rather than three underground combat/puzzle pockets, if that adaptation is retained;
- clearing those endpoints opens the Underworks gate as an intermediate route change;
- the five-hit revealed growth gate is an added Chapter 2 capstone;
- the blue-flame hallway is transition atmosphere between the hidden gate and lower shrine hatch/stair;
- whether the common-fire restoration is folded into the Fire Anchor or remains a separate Chapter 1 state;
- which map/Records beats are deferred rather than silently considered complete.

Do not rewrite the guide first merely to declare the current implementation correct. Lock the intended integrated route, implement the smallest proof, then update the long guide to the tested truth.

## 5. Recommended next implementation plan

### Pass 1: Shrine side-room and Lantern-first network backfill — complete

- Build one compact side room/access niche into the existing Folsom shrine footprint.
- Make it the canonical Keeper's Lantern acquisition point.
- Reveal the three existing surface feeds or their under-shrine origin with the Lantern.
- Add a short crawlspace/maintenance connection that makes the Underworks route spatially belong to the shrine network.
- Preserve the shed, three surface anchor visuals/flags, Underworks gate, and all existing equipment ownership.
- Define migration behavior for saves that already own the Lantern or have cleared anchors.

Implemented with additive save keys and migration for existing Chapter 2 progress.

### Pass 2: Lower shrine hatch and Chapter 2 endpoint backfill — complete

- Add an explicit hatch at the Blue Flame Threshold-to-Lower Shrine Stair seam.
- Require the existing hidden gate clear and Iron Drain Bar pry.
- Persist the hatch as route state and preserve reload behavior.
- Keep BF05-BF09 coordinates and blockers intact.
- Clarify the blue hall as threshold atmosphere, not a replacement for the hatch.

### Pass 3: Chapter 1-2 framing and domain-state polish

- Add the Old Shrine Exterior mark and the minimum pond/common-fire framing needed for honest chapter boundaries.
- Wire map/Records events only through proper domain ownership; do not create inventory tokens or broad UI systems.
- Refresh the strategy guide and production lock to describe the accepted surface-anchor adaptation and final handoff.

White-Scab Hall is the next paused Chapter 3 mechanic and requires an explicit resume decision. Chapter 3's existing room skeleton remains in place.
