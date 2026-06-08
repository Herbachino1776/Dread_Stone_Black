# LOCATION BLUEPRINT - Black Grass Temple v01

Version: v0.1  
Document path: `docs/world/temples/black_grass_temple_v01.md`  
Parent field document: `docs/world/overworld/reliquary_field_v01.md`  
Connected overworld landmark: Black Grass Temple / C02  
Lane: Game World Architect  
Implementation owner: Codex after Producer/Dev Lead approval

---

## 1. Purpose

Black Grass Temple is the first production-grade medium dungeon planned for **Dread Stone Black**.

It is not another small baby labyrinth. It is a ruined field temple that descends into subterranean stone ruins, torchlit undercrofts, and buried tavern halls where black grass grows across the floor.

The design goal is to create a memorable field-to-dungeon destination with:

- a readable temple exterior in Reliquary Field
- a real multi-room underground layout
- multiple enemy spawn pockets
- a main loop and a shortcut loop
- black-grass tavern halls as the dungeon identity
- torchlit stone ruins using the current dungeon texture kit
- a sealed future door for expansion
- a return path back to the field

This is a larger and more complex dungeon than South Reliquary Crypt, but it should still be implementable in one disciplined PR if geometry stays simple and modular.

---

## 2. Architectural Concept

Black Grass Temple should feel like a place with layers.

The player sees a broken stone temple in the field. The first rooms below it are familiar: black stone walls, worn floors, dark ceilings, rusted gates, torchlight. Deeper inside, the architecture opens into old subterranean taverns: broad communal chambers, broken counters, low divider walls, bench-like stone blocks, service passages, and enemy-occupied rooms. Black grass grows inside these taverns as if the field has rooted itself below the temple.

The dungeon then tightens again into lower temple ruins: pillars, grates, sanctum blocks, a sealed reliquary gate, and a shortcut stair back toward the entrance.

The spatial progression is:

```txt
Field Temple Exterior
  -> Entry Stair Hall
  -> Torch Vestibule
  -> Stone Undercroft Rooms
  -> Black Grass Tavern Halls
  -> Lower Pillar Ruins
  -> Black Grass Sanctum
  -> Sealed Future Gate
  -> Shortcut Return
```

Design logic:

- Stone floors mean formal temple route.
- Black grass floors mean corrupted tavern chambers and enemy danger.
- Rusted gates mean thresholds or future expansion.
- Torch clusters guide the player toward important routes.
- Low dividers and pillars make rooms tactically interesting without needing complex geometry.

---

## 3. Scale

### 3.1 Exterior Placement

Long-term Reliquary Field placement:

```txt
C02 Black Grass Temple: X -210, Y 0, Z 55
```

Current 400 x 400 field note:

```txt
The original Reliquary Field first slice ends at X -200, so Black Grass Temple may require either a small westward field expansion or a temporary entrance placed at the west edge until the field grows.
```

Recommended implementation choices:

1. Preferred: add the exterior landmark just beyond/currently near the western edge if the field can safely expand a little.
2. Acceptable v0.1: add a temporary west-edge temple entrance trigger that routes into this dungeon, then move it to the full C02 position later.

### 3.2 Interior Bounds

- Interior bounds: `150 x 170` units
- X range: `-75` to `75`
- Z range: `-80` to `90`
- Ground/floor Y: `0`
- Default wall height: `3.2` units
- Default ceiling height: `3.2` units
- Player interior start: `X 0, Y 1.55, Z -72`
- Initial facing: north / positive Z
- Primary exit back to field: `X 0, Y 1.2, Z -76`
- Intended playtime: 8-12 minutes on first pass
- Intended room count: 14 rooms/zones
- Enemy spawn markers: 12 base spawns, with runtime activation adjustable for performance

---

## 4. Coordinate System

- X axis: west/east
  - Negative X = west
  - Positive X = east
- Z axis: south/north
  - Negative Z = entrance / field side
  - Positive Z = deeper temple
- Y axis: vertical height
  - Y 0 = floor level
- Interior origin: central route crossing between first tavern and service loops near `X 0, Z 0`

Implementation note:

```txt
Use local dungeon coordinates for the Black Grass Temple interior. The exterior temple entrance in the field can route into this interior through the existing area/query system or a new clean area value if needed.
```

Suggested area naming:

```txt
?area=black-grass-temple
```

or equivalent project-native routing.

---

## 5. High-Level Route

Main route:

```txt
EXT01 Field Temple Exterior
  -> R01 Entry Stair Hall
  -> R02 Torch Vestibule
  -> R03 Broken Offering Room
  -> R05 First Gate Hall
  -> R06 First Grass Tavern
  -> R08 Sunken Drinking Hall
  -> R11 Lower Pillar Hall
  -> R12 Black Grass Sanctum
  -> R13 Reliquary Gate / Future Door
```

Optional / loop route:

```txt
R02 Torch Vestibule
  -> R04 West Storage Ruin
  -> R07 Service Passage Loop
  -> R06 First Grass Tavern or R08 Sunken Drinking Hall
```

Shortcut route:

```txt
R12 Black Grass Sanctum
  -> R14 Shortcut Return Stair
  -> reopens near R02 Torch Vestibule or R05 First Gate Hall
```

The dungeon should not be a straight hallway. It should fold back on itself enough that the player feels they have explored a place, not a sequence of boxes.

---

## 6. ASCII Map

Legend:

```txt
P = player start / field exit
E = exit back to Reliquary Field
T = torch cluster
G = gate / grate
L = locked or one-way shortcut point
S = shrine / offering slab
B = black grass tavern floor zone
R = main combat / guardian room
A = sanctum / reliquary alcove
F = future sealed door
+ = shortcut / loop connection
# = solid wall / stone mass
. = walkable stone floor
, = black grass floor
```

Top-down design map, approximate:

```txt
Z +90

                     ###################
                     #.......F.........#
                     #.......G.........#
          ############....R13..........############
          #.......................................#
          #...............R12 A...................#
          #,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
          #,,,,,,,,black grass sanctum,,,,,,,,,,,,#
          ###########.................#############
                    #.................#
                    #.......T.........#
          ###########.....R11.........###########
          #...............pillars...............#
          #.....T.........................T.....#
          #.....................................#
          #######.....#############.....#########
                #.....#           #.....#
                #.....#           #.....#
      ###########.....#           #.....###########
      #...............#           #...............#
      #.....R09.......#           #.....R10.......#
      #..booths.......#           #..back bar.....#
      #,,,,,,,,,......#           #......,,,,,,,,,#
      #######.....#####           #####.....#######
            #.....#                   #.....#
            #.....#                   #.....#
      #######.....#####################.....#######
      #...........................................#
      #,,,,,,,,,,,,,,,,R08,,,,,,,,,,,,,,,,,,,,,,,,#
      #,,,,,,,sunken drinking hall,,,,,,,,,,,,,,,,#
      #.....E06.....E07.....E08..................#
      #######.....###############.....#############
            #.....#             #.....#
            #..R07 service loop #.....#
      #######.....###############.....#######
      #.....................................#
      #,,,,,,,,,,,,R06 first tavern,,,,,,,,,#
      #.....E03..............E04............#
      #........broken counters..............#
      #######.....###############.....#######
            #.....#             #.....#
            #.....#             #.....#
      #######.....#             #.....#######
      #........R04#             #R05........#
      # west store#             #gate hall..#
      #....E02....#             #....G......#
      #######.....###############.....#######
            #...........R03...........#
            #.....broken offering.....#
            #.....S.......E01.........#
            #######.....#######.....###
                  #.....R02.....T...#
                  #..torch vestibule#
                  #######.....#######
                        #.....#
                        #.R01.#
                        #stair#
                        #..P/E#
                        #######

Z -80                      X -75              X +75
```

---

## 7. Exterior Landmark Plan

| ID | Type | Position | Size | Material | Collision | Notes |
|---|---|---|---|---|---|---|
| EXT01_A | temple approach slab | X -210, Y 0.25, Z 55 | W 34, H 0.5, D 30 | `floor_worn_stone_01` | solid low / walkable if supported | Field approach platform |
| EXT01_B | left broken pylon | X -225, Y 4, Z 58 | W 5, H 8, D 5 | `wall_black_stone_01` | solid | Major silhouette |
| EXT01_C | right broken pylon | X -195, Y 3.2, Z 58 | W 5, H 6.4, D 5 | `wall_black_stone_01` | solid | Asymmetric broken silhouette |
| EXT01_D | rear temple wall | X -210, Y 4, Z 68 | W 34, H 8, D 4 | `wall_black_stone_01` | solid | Back mass around stair-mouth |
| EXT01_E | stair-mouth trigger | X -210, Y 1.2, Z 47 | W 12, H 3, D 8 | none | trigger | Enter Black Grass Temple |
| EXT01_F | dark stair-mouth visual | X -210, Y 2.2, Z 48 | W 12, H 4.4, D 0.3 | dark material or gate texture | visual | Recessed entrance |
| EXT01_G | black grass patch | around EXT01 | W 45, D 38 | `field_dead_grass_01` dark tint | walkable | Visual corruption at temple base |

If C02 is outside the current field bounds, Codex may implement a temporary west-edge access point for v0.1 and leave a comment pointing back to the intended C02 coordinates.

---

## 8. Zone / Room Table

| ID | Name | Center Position | Footprint | Floor Type | Purpose |
|---|---|---|---|---|---|
| R01 | Entry Stair Hall | X 0, Z -68 | W 10, D 22 | stone | Transition from field into dungeon |
| R02 | Torch Vestibule | X 0, Z -50 | W 24, D 16 | stone | Orientation room, first shortcut return point |
| R03 | Broken Offering Room | X 0, Z -32 | W 34, D 18 | stone | First controlled combat and shrine landmark |
| R04 | West Storage Ruin | X -34, Z -20 | W 20, D 22 | stone | Optional side chamber, early enemy pocket |
| R05 | First Gate Hall | X 34, Z -20 | W 20, D 22 | stone | Threshold into deeper dungeon, gate language |
| R06 | First Grass Tavern | X 0, Z 0 | W 50, D 26 | black grass | First identity room, two enemy spawns |
| R07 | Service Passage Loop | X -34, Z 8 | W 16, D 34 | stone | Side loop, narrow tension, one enemy spawn |
| R08 | Sunken Drinking Hall | X 0, Z 28 | W 62, D 30 | black grass | Main mid-dungeon combat hall |
| R09 | Collapsed Booth Chamber | X -44, Z 52 | W 24, D 26 | mixed grass/stone | Side ambush room off main hall |
| R10 | Back Bar / Storage Pit | X 44, Z 52 | W 24, D 26 | mixed grass/stone | Optional service room and route texture |
| R11 | Lower Pillar Hall | X 0, Z 62 | W 50, D 24 | stone | Formal temple architecture returns |
| R12 | Black Grass Sanctum | X 0, Z 82 | W 54, D 24 | black grass | Endpoint, main memory room, stronger enemy/spawn |
| R13 | Reliquary Gate | X 0, Z 94 | W 22, D 10 | stone | Sealed future door / expansion hook |
| R14 | Shortcut Return Stair | X 58, Z 35 to -46 | W 10, D 92 | stone | One-way return route back near R02/R05 |

---

## 9. Structural Implementation Plan

### 9.1 General Geometry Rules

Use simple box geometry.

Each room should use:

- one clean floor slab
- one clean ceiling slab
- solid wall boxes with doorway gaps
- no one-sided planes for walls
- no duplicate coplanar floors
- no overlapping corridor floors inside room footprints

Important production rule from prior bug:

```txt
Do not stack floor meshes at the same Y. Corridor floor slabs must stop at room edges. Room floors must not overlap each other. If needed, use slightly separated footprints or a single merged floor slab for a complex room.
```

### 9.2 Default Dimensions

```txt
wall height: 3.2
wall thickness: 0.35
floor thickness: 0.18
ceiling thickness: 0.18
floor Y center: -0.09
ceiling Y center: 3.2
player eye Y: 1.55
minimum doorway clear width: 3.4
preferred combat doorway width: 4.2
```

---

## 10. Doorway / Connection Table

| ID | Connects | Center | Clear Width | Notes |
|---|---|---|---:|---|
| D01 | Field / R01 | X 0, Z -78 | 4.0 | Exit back to field |
| D02 | R01 / R02 | X 0, Z -59 | 4.0 | Main entry route |
| D03 | R02 / R03 | X 0, Z -41 | 4.2 | First route forward |
| D04 | R03 / R04 | X -17, Z -24 | 3.6 | West optional branch |
| D05 | R03 / R05 | X 17, Z -24 | 3.6 | East gate hall branch |
| D06 | R03 / R06 | X 0, Z -13 | 4.6 | Main descent to first tavern |
| D07 | R04 / R07 | X -34, Z -8 | 3.6 | Storage to service loop |
| D08 | R05 / R06 | X 22, Z -4 | 4.0 | Gate hall into tavern |
| D09 | R06 / R07 | X -25, Z 4 | 3.6 | Local loop entrance |
| D10 | R06 / R08 | X 0, Z 14 | 5.0 | Wide opening into drinking hall |
| D11 | R07 / R08 | X -25, Z 22 | 3.6 | Loop into mid hall |
| D12 | R08 / R09 | X -31, Z 46 | 4.0 | Booth side chamber |
| D13 | R08 / R10 | X 31, Z 46 | 4.0 | Back bar side chamber |
| D14 | R08 / R11 | X 0, Z 43 | 5.0 | Main lower route |
| D15 | R11 / R12 | X 0, Z 74 | 5.0 | Hall to sanctum |
| D16 | R12 / R13 | X 0, Z 90 | 4.0 | Sealed future gate threshold |
| D17 | R12 / R14 | X 27, Z 80 | 3.6 | Shortcut start |
| D18 | R14 / R02 or R05 | X 12, Z -50 or X 44, Z -20 | 3.6 | Shortcut return point; choose cleaner implementation |

---

## 11. Material Plan

Use the existing texture kit.

Stone walls:

```txt
public/assets/textures/wall_black_stone_01.png
```

Stone floors:

```txt
public/assets/textures/floor_worn_stone_01.png
```

Ceilings:

```txt
public/assets/textures/ceiling_dark_stone_01.png
```

Metal gates / grates:

```txt
public/assets/textures/metal_gate_rusted_01.png
```

Black grass floors:

```txt
public/assets/textures/outdoor/field_dead_grass_01.png
```

Black grass material treatment:

- use the existing field grass texture
- tint/darken the material with color and lighting
- use it only on selected underground floor slabs
- do not add new grass geometry or blades
- keep it flat and walkable

Recommended black grass floor zones:

```txt
R06 First Grass Tavern
R08 Sunken Drinking Hall
R12 Black Grass Sanctum
partial patches in R09 and R10
```

---

## 12. Torch / Lighting Plan

Torches should return as a key readability tool.

### 12.1 Torch Placement

| ID | Position | Purpose |
|---|---|---|
| T01 | X 0, Y 2.0, Z -61 | Entry stair bottom |
| T02 | X -8, Y 2.0, Z -50 | Torch Vestibule left |
| T03 | X 8, Y 2.0, Z -50 | Torch Vestibule right |
| T04 | X 0, Y 2.1, Z -34 | Broken Offering Room focus |
| T05 | X 27, Y 2.1, Z -20 | First Gate Hall metal readability |
| T06 | X -18, Y 2.0, Z 0 | First Grass Tavern left side |
| T07 | X 18, Y 2.0, Z 0 | First Grass Tavern right side |
| T08 | X -25, Y 2.0, Z 28 | Sunken Drinking Hall west |
| T09 | X 25, Y 2.0, Z 28 | Sunken Drinking Hall east |
| T10 | X -15, Y 2.1, Z 62 | Lower Pillar Hall west |
| T11 | X 15, Y 2.1, Z 62 | Lower Pillar Hall east |
| T12 | X 0, Y 1.6, Z 82 | Black Grass Sanctum cold center fill, not normal torch |

Lighting language:

- stone undercroft: warm torchlight
- grass taverns: warm light at edges, darker center
- lower pillar hall: formal torch symmetry
- sanctum: cold dim center fill plus low warm edge light

### 12.2 Fog / Ambience

Recommended first pass:

```txt
Indoor fog near: 10-14
Indoor fog far: 48-62
Ambient: low warm gray
Torch lights: warm orange, moderate radius
Sanctum light: cold blue-gray or pale sickly green, low intensity
```

Mobile readability rule:

```txt
The player must see the next doorway or torch cluster from the center of each major room.
```

---

## 13. Enemy Spawn Plan

Enemy spawns should be placed by room role. This blueprint defines spawn markers. Codex can activate all or only some depending on current enemy system stability.

| ID | Room | Position | Type / Role | Notes |
|---|---|---|---|---|
| E01 | R03 Broken Offering Room | X 8, Y 0, Z -31 | first visible enemy | Controlled first combat |
| E02 | R04 West Storage Ruin | X -39, Y 0, Z -18 | side enemy | Optional branch threat |
| E03 | R06 First Grass Tavern | X -14, Y 0, Z 2 | tavern enemy | Visible from entry |
| E04 | R06 First Grass Tavern | X 16, Y 0, Z 6 | offset tavern enemy | Behind low divider / counter |
| E05 | R07 Service Passage Loop | X -35, Y 0, Z 12 | passage enemy | Narrow pressure, not a cheap ambush |
| E06 | R08 Sunken Drinking Hall | X -20, Y 0, Z 28 | hall enemy | Left side |
| E07 | R08 Sunken Drinking Hall | X 2, Y 0, Z 33 | hall enemy | Central/rear |
| E08 | R08 Sunken Drinking Hall | X 22, Y 0, Z 25 | hall enemy | Right side |
| E09 | R09 Collapsed Booth Chamber | X -48, Y 0, Z 54 | side ambush enemy | Visible if player scans room |
| E10 | R11 Lower Pillar Hall | X -10, Y 0, Z 61 | temple enemy | Between pillars |
| E11 | R11 Lower Pillar Hall | X 12, Y 0, Z 66 | temple enemy | Far side |
| E12 | R12 Black Grass Sanctum | X 0, Y 0, Z 80 | stronger guardian or normal enemy | Main endpoint threat |

Spawn activation guidance:

- First implementation may place spawn markers and activate a smaller subset.
- If combat load is too high, activate E01, E03, E06, E08, E10, E12 first.
- Do not spawn enemies directly behind the player at the entrance.
- Do not require attack/hurt/death animations beyond what already exists.
- Use current enemy system and current available enemy assets only.

---

## 14. Landmark / Prop Geometry

Use simple stone boxes and current materials.

| ID | Room | Prop | Position | Size | Purpose |
|---|---|---|---|---|---|
| P01 | R03 | broken offering slab | X 0, Y 0.55, Z -32 | W 7, H 1.1, D 3 | First shrine landmark |
| P02 | R06 | broken counter west | X -12, Y 0.6, Z -2 | W 12, H 1.2, D 2 | Tavern identity / cover |
| P03 | R06 | broken counter east | X 13, Y 0.6, Z 5 | W 10, H 1.2, D 2 | Enemy spacing / cover |
| P04 | R08 | low divider A | X -18, Y 0.55, Z 30 | W 10, H 1.1, D 2 | Combat readability |
| P05 | R08 | low divider B | X 18, Y 0.55, Z 26 | W 10, H 1.1, D 2 | Combat readability |
| P06 | R09 | booth divider cluster | X -45, Y 0.55, Z 52 | W 12, H 1.1, D 8 total | Side room identity |
| P07 | R10 | back bar block | X 44, Y 0.7, Z 50 | W 16, H 1.4, D 2 | Back bar identity |
| P08-P13 | R11 | square pillars | symmetric around X -18,-9,9,18 / Z 58,66 | W 2, H 3.2, D 2 | Formal lower temple hall |
| P14 | R12 | central reliquary block | X 0, Y 0.8, Z 82 | W 6, H 1.6, D 3 | Sanctum focus |
| P15 | R13 | sealed future gate | X 0, Y 1.6, Z 94 | W 8, H 3.2, D 0.45 | Future expansion gate |

Prop collision should be solid but generous. Avoid making small snag hazards in the center of routes.

---

## 15. Interaction Plan

| ID | Interaction | Position | Trigger Range | Result | Notes |
|---|---|---|---:|---|---|
| INT01 | enter temple from field | Exterior C02 / temp west edge | 4.5 | load Black Grass Temple interior | Field-side trigger |
| INT02 | exit to field | X 0, Y 1.2, Z -76 | 3.5 | return to Reliquary Field | Must never strand player |
| INT03 | inspect broken offering slab | X 0, Y 1.2, Z -32 | 3.0 | short message | Optional non-blocking lore |
| INT04 | test first gate | X 30, Y 1.2, Z -20 | 3.0 | sealed / opens if simple | Keep simple in v0.1 |
| INT05 | open shortcut from lower side | X 44 or 12, Y 1.2, Z -20/-50 | 3.5 | opens shortcut return | Optional if current door logic supports it |
| INT06 | inspect central reliquary | X 0, Y 1.2, Z 82 | 3.0 | endpoint message or simple flag | No inventory required |
| INT07 | inspect future gate | X 0, Y 1.2, Z 94 | 3.0 | sealed future content message | Must not load new area |

Suggested placeholder text:

```txt
INT01: "The black grass bends away from the temple stair."
INT02: "The field air waits above."
INT03: "Old cups are carved into the altar stone. None are empty."
INT04: "The rusted gate holds, but its hinges remember movement."
INT05: "A return stair opens behind the old wall."
INT06: "The grass grows from inside the reliquary block."
INT07: "The gate is sealed with roots blacker than iron."
```

---

## 16. Collision / Navigation Plan

Collision must be simple and production-stable.

Recommended walkable rectangles:

```txt
R01: minX -5, maxX 5, minZ -80, maxZ -57
R02: minX -12, maxX 12, minZ -58, maxZ -42
R03: minX -17, maxX 17, minZ -41, maxZ -23
R04: minX -44, maxX -24, minZ -31, maxZ -9
R05: minX 24, maxX 44, minZ -31, maxZ -9
R06: minX -25, maxX 25, minZ -13, maxZ 13
R07: minX -42, maxX -26, minZ -8, maxZ 25
R08: minX -31, maxX 31, minZ 13, maxZ 43
R09: minX -56, maxX -32, minZ 39, maxZ 65
R10: minX 32, maxX 56, minZ 39, maxZ 65
R11: minX -25, maxX 25, minZ 50, maxZ 74
R12: minX -27, maxX 27, minZ 74, maxZ 90
R13: minX -11, maxX 11, minZ 90, maxZ 100
R14: define as non-overlapping corridor rectangles from R12 back to R02/R05
```

Important rules:

- Doorway blockers must not overlap walkable doorway gaps.
- Low dividers should have collision only if they do not trap the player.
- Shortcut return should be wide enough to avoid snagging.
- Do not use diagonal collision for v0.1.
- If visual geometry is complex, collision can remain simple rectangles.

---

## 17. Implementation Phasing

### Phase 1 - Exterior Hook / Area Routing

Build:

- field-side Black Grass Temple entrance trigger
- exterior silhouette if safe
- route into Black Grass Temple interior
- return route back to field

### Phase 2 - Core Interior Shell

Build:

- all 14 room/corridor floor slabs
- ceilings
- perimeter walls with doorway gaps
- no overlapping coplanar floors
- no one-sided walls

### Phase 3 - Lighting and Materials

Build:

- torch clusters
- warm/cold lighting zones
- stone vs black grass floor material language
- indoor fog

### Phase 4 - Interactions and Shortcuts

Build:

- exit trigger
- offering slab inspect
- first gate inspect
- reliquary inspect
- future gate inspect
- shortcut return if clean

### Phase 5 - Enemy Spawn Markers / Enemies

Build:

- spawn markers for E01-E12
- activate only what current enemy system can safely support
- avoid overloading mobile performance

---

## 18. Codex Implementation Notes

Codex should build:

```txt
1. Create Black Grass Temple as a distinct interior area connected to the field.
2. Add or stage the field exterior entrance for C02 Black Grass Temple.
3. Build the 150 x 170 interior using the room table and map.
4. Use existing wall, floor, ceiling, gate, torch, and field grass texture assets only.
5. Use black grass floor material for tavern/sanctum rooms.
6. Add torch clusters and readable indoor fog.
7. Add simple rectangular collision and generous doorway widths.
8. Add interaction triggers for entrance, exit, reliquary, sealed gate, and optional shortcut.
9. Add enemy spawn markers and activate a safe subset using current enemy systems.
10. Run npm run build before final response.
```

Codex should avoid:

```txt
- procedural dungeon generation
- huge overworld expansion beyond what is needed for the entrance
- new textures or new model assets
- new animation states beyond current systems
- new inventory system
- minimap
- quest log
- deployment config changes
- changing Vite base path
- overlapping floors or ceilings
- one-sided wall planes
```

Systems that must remain working:

```txt
- Reliquary Field
- South Reliquary Crypt
- field-to-interior transitions
- mobile dual-stick controls
- vertical look
- FPV arms / HUD
- existing combat systems
- GitHub Pages deployment
- npm run build
```

Recommended PR title:

```txt
Implement Black Grass Temple v0.1
```

---

## 19. QA Checklist

Build QA:

- [ ] `npm run build` passes.
- [ ] No deployment config changed.
- [ ] No missing texture paths.
- [ ] No console errors on load.

Field connection QA:

- [ ] Player can enter Black Grass Temple from the field or temporary field-side entrance.
- [ ] Player can return to Reliquary Field.
- [ ] Return position does not place player inside collision.

Geometry QA:

- [ ] No missing wall surfaces.
- [ ] No accidental see-through gaps except intended doorways.
- [ ] No floor flickering / z-fighting.
- [ ] No ceiling flickering.
- [ ] No overlapping coplanar floor slabs.
- [ ] Walls are solid textured box geometry.

Navigation QA:

- [ ] Player can reach R01 through R13.
- [ ] Player can enter the optional west branch.
- [ ] Player can move through the service passage loop.
- [ ] Player can reach the Sunken Drinking Hall.
- [ ] Player can reach the Lower Pillar Hall.
- [ ] Player can reach the Black Grass Sanctum.
- [ ] Player can inspect the future gate without loading another area.
- [ ] Player can return without getting stuck.

Mobile QA:

- [ ] Doorways are wide enough for touch movement.
- [ ] Enemy rooms have enough maneuvering space.
- [ ] HUD prompts are readable and not blocked.
- [ ] Lighting is readable on iPhone portrait.
- [ ] Frame rate remains playable with active enemy count.

Design QA:

- [ ] The temple exterior reads as a major landmark.
- [ ] The undercroft feels like stone temple ruins.
- [ ] The black grass taverns are visually distinct.
- [ ] The Sunken Drinking Hall feels like the major mid-dungeon combat room.
- [ ] The Lower Pillar Hall changes the architectural mood.
- [ ] The Black Grass Sanctum feels like a strong endpoint.
- [ ] The dungeon feels more complex than a baby labyrinth without becoming confusing.

---

## 20. Future Addendum Targets

Possible future addendums:

```txt
docs/world/addendums/black_grass_temple_addendum_001_enemy_tuning.md
docs/world/addendums/black_grass_temple_addendum_002_sanctum_reward.md
docs/world/addendums/black_grass_temple_addendum_003_field_approach_expansion.md
docs/world/addendums/black_grass_temple_addendum_004_second_depth.md
```

Do not add the second depth until v0.1 is implemented and playtested.
