# Chapter 3 Location Flow Map

## Authority and chapter seam

The location authority is Chapter 3, “The Shrine That Was Not a Shrine,” in `dread_stone_black_strategy_guide_DESIGN_LOCKED_MASTER_01-19.md`. The guide's developer notes define five required physical spaces. Its “Pale Panel” route beat is an interaction area on the rear wall of the Shrine Mechanism Room, not a sixth standalone room.

Chapter 2 ends when `beneath_folsom_hidden_growth_gate_cleared` removes the hidden five-hit growth gate and admits the player to the existing Blue Flame Threshold. Chapter 3 begins at the far end of that preserved hallway, where the route enters the Lower Shrine Stair.

## Production flow

```text
CHAPTER 2
Lower Drain Throat
  |
  | hidden growth gate (existing; 5 revealed knife hits)
  | save: beneath_folsom_hidden_growth_gate_cleared
  v
Blue Flame Threshold (preserved Chapter 2 -> 3 seam)
  |
  | open authored threshold
  v
CHAPTER 3
Lower Shrine Stair
  |
  v
White-Scab Hall
  |
  | FUTURE: Keeper's Lantern reveal -> Wood Axe hard crust -> Old Work Knife film
  | blocker: beneath_folsom_ch3_white_scab_hall_blocker
  | planned state: beneath_folsom_white_mechanism_exposed
  v
Shrine Mechanism Room
  |
  | Pale Panel area on rear wall
  | FUTURE: lantern reveal -> crust/cord/film clear -> panel activation
  | blocker: beneath_folsom_ch3_pale_panel_chamber_blocker
  | planned state: beneath_folsom_pale_panel_activated
  v
Buried White Chamber
  |
  | FUTURE: Wood Axe root knot -> Old Work Knife edge cords -> Iron Drain Bar pry
  | blocker: beneath_folsom_ch3_crypt_root_mat_blocker
  | planned state: beneath_folsom_crypt_access_stair_open
  v
Crypt Access Stair
  |
  | HARD STOP: beneath_folsom_ch3_first_crypt_boundary_blocker
  v
FIRST CRYPT / CHAPTER 4 (not implemented)
```

## Implemented in this pass

- The complete five-room Chapter 3 physical chain extends `beneath-folsom` after the blue-flame hallway.
- Every room has compiled floor, wall, ceiling, collision bounds, an authored door gap, and a navigation link.
- Pale limestone, cold light, buried white ribs, a pale floor line, black-scab concentrations, a central mechanism block, a rear panel silhouette, collapsed chamber stone, a root-mat seal, and a crypt-stair silhouette establish the route language.
- Three deferred-mechanic blockers prevent sequence bypass. A fourth hard boundary stops the route before Chapter 4.
- The old `beneath_folsom_chapter_end_stop` has been removed. The existing Chapter 2 hidden-growth gate remains the only admission gate to the blue-flame seam and Chapter 3 route.

## Deferred

- Keeper's Lantern reveal behavior for Chapter 3 scab and pale machinery.
- Axe-then-knife staged scab clearing and all hit feedback.
- Pale Panel interaction, silent image, central-block movement, and First White Record.
- Map and Records UI or domain-event ownership.
- Root-mat clearing, stair-door pry animation, and persistence for the new route states.
- Enemies, bosses, Pale Gates, broad white-machinery systems, physical weapon swings, and all First Crypt content.

The current skeleton deliberately makes later rooms exist in authored data while blockers keep them unreachable until their guide-ordered mechanics are implemented.
