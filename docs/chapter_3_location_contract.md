# Chapter 3 Location Contract

## Strategy authority

Chapter 3 of `dread_stone_black_strategy_guide_DESIGN_LOCKED_MASTER_01-19.md` is authoritative for location names, order, topology, interaction dependencies, and endpoint. The required physical room list in its developer reverse-engineering notes is:

1. Lower Shrine Stair
2. White-Scab Hall
3. Shrine Mechanism Room
4. Buried White Chamber
5. Crypt Access Stair

The guide also names “Pale Panel” in its area/route summary. The detailed route places that panel on the rear wall of the Shrine Mechanism Room. Production therefore treats `Pale Panel area` as a named interaction zone inside that room, not a separate room. This is an interpretation of the guide's own detailed topology, not a divergence.

## Topology

The route is a single ordered chain:

`Blue Flame Threshold (Chapter 2 seam) -> Lower Shrine Stair -> White-Scab Hall -> Shrine Mechanism Room / Pale Panel area -> Buried White Chamber -> Crypt Access Stair -> hard stop before First Crypt`

There are no branches, shortcuts, combat arenas, or chapter exits in this skeleton. Existing return travel through Beneath Folsom to Folsom remains intact.

## Implementation location choice

Chapter 3 extends the existing compiled `beneath-folsom` location.

Reasons:

- The blue-flame hallway is already the persisted Chapter 2 endpoint and must remain the physical seam.
- `beneath_folsom_hidden_growth_gate_cleared` already controls admission to that hallway, so extending the same collision/nav graph prevents a second transition from bypassing or duplicating the gate.
- The guide describes one continuous descent below Folsom. A seamless location preserves that spatial truth and the existing return route.
- The five-room skeleton is lightweight procedural geometry and does not yet justify a separate lazy-loaded location.

No `locationRegistry.js` change is required.

## Authored room ids

| Room id | Authoritative name | Production role |
| --- | --- | --- |
| `BF05` | Lower Shrine Stair | Chapter 3 entry and cold transition from human underworks to pale buried construction |
| `BF06` | White-Scab Hall | Focused pale floor-line and future white-scab proof |
| `BF07` | Shrine Mechanism Room | Central block and rear-wall Pale Panel area |
| `BF08` | Buried White Chamber | Damaged pale chamber revealed by future panel activation |
| `BF09` | Crypt Access Stair | Bounded Chapter 3 endpoint before First Crypt |

`BF04`, Blue Flame Threshold, remains the Chapter 2 capstone and Chapter 2-to-3 seam.

## Future blocker ids

| Blocker id | Prevents | Planned removal condition |
| --- | --- | --- |
| `beneath_folsom_ch3_white_scab_hall_blocker` | Entering Shrine Mechanism Room early | Lantern reveal, Wood Axe crust break, Old Work Knife film scrape |
| `beneath_folsom_ch3_pale_panel_chamber_blocker` | Entering Buried White Chamber early | Pale Panel exposure and activation |
| `beneath_folsom_ch3_crypt_root_mat_blocker` | Entering Crypt Access Stair early | Axe/knife root-mat clear and Iron Drain Bar pry |
| `beneath_folsom_ch3_first_crypt_boundary_blocker` | Entering unimplemented Chapter 4 | First Crypt implementation; this is currently a hard boundary |

These blockers are collision truth, not merely decorative props. Their visible seals communicate why the route stops.

## Save and world-state contract

No new save keys are written in this skeleton pass because the associated mechanics are intentionally deferred. The blockers carry planned state metadata so later interaction work has stable ownership names:

- `beneath_folsom_white_mechanism_exposed`
- `beneath_folsom_pale_panel_activated`
- `beneath_folsom_crypt_access_stair_open`

The following guide requirements need separate non-inventory ownership before implementation:

- Lower Shrine map update: planned as map/domain state, not equipment.
- First White Record: planned as Records/domain state, not an item.

Existing `beneath_folsom_hidden_growth_gate_cleared` remains the persisted prerequisite for reaching the Chapter 3 seam.

## Intentionally deferred mechanics

- White-scab reveal and staged clear mechanics.
- Pale Panel activation and central-block movement.
- First White Record and all Records/Memory UI.
- Crypt root-mat clear and stair-door pry.
- Pale Gates and reusable white-machinery frameworks.
- Enemies, bosses, physical weapon swings, HUD/equipment changes, and First Crypt content.

## Divergence from the strategy guide

There is no route-order, room-name, topology, lock-sequence, or endpoint divergence. The only production interpretation is that Pale Panel is represented as an area within Shrine Mechanism Room rather than an independent room, as specified by the guide's detailed room description and required-spaces list.
