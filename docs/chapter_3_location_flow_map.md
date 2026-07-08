# Chapter 3 Location Flow Map

## Production lock

The implemented Chapter 3 lead-in is an impossible front threshold plus an under-shrine bypass. The White-Scab front seal never opens locally. White-Scab Hall reveal/clear, Pale Panel, Shrine Mechanism Room mechanics, and later Chapter 3 systems remain deferred.

```text
BF04 BLUE-FLAME HALLWAY
  -> Iron Drain Bar pries the preserved lower shrine hatch
BF05 LOWER SHRINE STAIR
  -> WHITE-SCAB FRONT THRESHOLD
     seal: beneath_folsom_white_scab_front_seal (remains shut)
     lower knot: beneath_folsom_white_scab_lower_knot
     save: beneath_folsom_white_scab_lower_knot_destroyed
  -> cords recoil toward the old shrine route
     save: folsom_shrine_crawlspace_terminal_open
  -> return to FOLSOM SHRINE CRAWLSPACE
  -> cracked terminal throat opens
  -> location transition: under-shrine-labyrinth
  -> ten-segment, twisting, descending crawlspace route
     two tight squeezes + breathing pocket + impossible pressure moment
  -> physical end hatch
     save: under_shrine_labyrinth_end_hatch_open
  -> location transition: beneath-folsom
     spawn: beneath_folsom_white_scab_threshold_backside
  -> BACKSIDE OF DENIED THRESHOLD
  -> hard production boundary before deferred White-Scab Hall mechanics
```

The bypass proves that the player cannot solve the front seal by attacking it. A correct physical Old Work Knife cut sequence destroys only the exposed lower knot and releases pressure at the old Folsom shrine terminal. The front seal remains shut. The labyrinth end hatch uses a planted Iron Drain Bar pry before its normal transition becomes available. `under-shrine-labyrinth` is a separate compiled authored location, not a Folsom tunnel extension or test room.

Chapter 3 White-Scab growth, knots, panels, slabs, grates, and hatches must use the Physical Tool Action System when implemented. Right-hand tools originate lower-right and capture touch only at the grip/handle; movement stays left-side and ordinary right-look remains available outside that grip. Knife blade contact comes from a fast cut, Axe head contact from a heavy chop, and Drain Bar tip contact from plant-and-pry. Interact/A is not a blocker-victory path. Enemy combat remains deferred even though the receiver architecture is reusable.

White-Scab Hall must not be implemented until the physical-tool ergonomics pass is stable against the existing Folsom, shrine, Beneath Folsom, and Chapter 3 lead-in blockers.

## Deferred

- White-Scab Hall reveal/clear mechanic.
- Pale Panel activation and Shrine Mechanism Room mechanics.
- Records, Memory, Pale Gates, enemies, bosses, First Crypt, and Chapter 4.
