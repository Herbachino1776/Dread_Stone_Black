# BLACK GRASS TEMPLE v02 - Construction Blueprint

Version: v0.2 construction pass  
Document path: `docs/world/temples/black_grass_temple_v02_construction_blueprint.md`  
Base design doc: `docs/world/temples/black_grass_temple_v01.md`  
Runtime target: `src/game/locations/blackGrassTemple.definition.js`  
Standard: `docs/world/ARCHITECTURE_BLUEPRINT_STANDARD.md`  
Lane: Game World Architect / Codex Production

---

## 0. Required Reading For Codex

Read before implementation:

```txt
docs/world/ARCHITECTURE_BLUEPRINT_STANDARD.md
docs/architecture/DUNGEON_AUTHORING_RUNTIME.md
docs/architecture/DUNGEON_INTEGRITY_AND_COLLISION_TRUTH.md
docs/architecture/TORCH_AND_LIGHTING_SYSTEM.md
docs/architecture/CREATURE_ACTOR_SYSTEM.md
docs/architecture/DUNGEON_OBJECTIVE_RUNTIME.md
docs/architecture/EQUIPMENT_AND_FPV_WEAPON_RUNTIME.md
docs/architecture/GORE_RUNTIME.md
```

This file is not asking for a fresh rebuild from vibes. It is a construction/audit blueprint for the compiled Black Grass Temple runtime.

---

## 1. Purpose

Black Grass Temple is the first production-grade medium dungeon in Dread Stone Black.

This construction blueprint exists to make the current runtime definition structurally reliable and authorable:

- no missing walls
- no unintentional wall gaps
- no floor flicker from overlapping structural slabs
- no ceiling flicker
- no torches floating or embedded in walls
- no collision without visible support
- no visible structure without collision where structure should block
- no invalid player/enemy spawn placements
- no route graph mismatch
- no exit that strands the player

Runtime target:

```txt
src/game/locations/blackGrassTemple.definition.js
```

Implementation goal:

```txt
Audit and align the runtime definition to this construction blueprint. Do not hand-build major dungeon geometry in DungeonScene.js.
```

---

## 2. Runtime Target

Operation type:

```txt
E. Audit runtime against construction blueprint
```

Location id:

```txt
black-grass-temple
```

Display name:

```txt
Black Grass Temple
```

Area query:

```txt
?area=black-grass-temple
```

Required runtime fields:

```txt
rooms
doors / connectors
wallGaps
blockers
props
spawns
encounterZones
exits
lights / torch fixtures
navigation
integrity metadata
```

---

## 3. Coordinate System

```txt
X axis: west/east
negative X = west
positive X = east

Z axis: south/north
negative Z = entrance / field side
positive Z = deeper temple

Y axis: vertical
Y 0 = floor plane
```

Defaults:

```txt
floorY: 0
playerEyeY: 1.55
wallHeight: 3.2
wallThickness: 0.35
floorThickness: 0.18
ceilingThickness: 0.18
minimumDoorwayWidth: 3.4
preferredCombatDoorwayWidth: 4.2
```

Interior bounds:

```txt
minX: -75
maxX: 75
minZ: -80
maxZ: 100
```

Player start:

```txt
X: 0
Y: 1.55
Z: -72
yaw: north / positive Z
```

Field return spawn should remain outside collision at the field-side Black Grass Temple entrance.

---

## 4. Key / Legend

```txt
P = player start
E = exit / field return
D = doorway / connector
G = gate / grate
L = locked or one-way shortcut
S = shrine / slab / altar
A = altar / reliquary / sanctum object
F = future sealed door
T = torch fixture
R = major room
B = black grass floor zone
# = solid wall / stone mass
. = walkable stone floor
, = walkable black grass floor
+ = shortcut / loop route
x = enemy spawn marker
```

---

## 5. ASCII Map

Approximate layout. Tables and runtime definition are the source of truth.

```txt
Z +100

                     ###########F###########
                     #.........G..........#
          ############........R13.........############
          #.........................................#
          #,,,,,,,,,,,,,,,,R12,,,,,,,,,,,,,,,,,,,,,,#
          #,,,,,,,,,,,SILENT ALTAR,,,,,,,,,,,,,,,,,,#
          ###########........A...........############
                    #....................#
          ###########........R11.........###########
          #.........T....PILLARS....T.............#
          #.......................................#
          #######.....###############.....#########
                #.....#             #.....#
      ###########.....#             #.....###########
      #......R09......#             #......R10......#
      #..rookery..x...#             #..bone store.x.#
      #....,,,,,......#             #......,,,,,....#
      #######.....#####             #####.....#######
            #.....#                     #.....#
      #######.....#######################.....#######
      #,,,,,,,,,,,,,,,,R08,,,,,,,,,,,,,,,,,,,,,,,,,,#
      #,,,,,,,,,,,WARRING CROSSING,,,,,,,,,,,,,,,,,,#
      #....x..........x...........x.................#
      #######.....###############.....###############
            #.....#             #.....#
            # R07 #             #     #
      #######.....###############.....#######
      #,,,,,,,,,,,,,,,,R06,,,,,,,,,,,,,,,,,,#
      #,,,,,,,,BLACK GRASS HALL,,,,,,,,,,,,,#
      #....x........counters........x.......#
      #######.....###############.....#######
            #.....#             #.....#
      #######.....#             #.....#######
      #....R04....#             #....R05....#
      # shrine.x..#             # gate..x...#
      #######.....###############.....#######
            #...........R03...........#
            #...BROKEN OFFERING...x...#
            #............S............#
            #######.....#######.....###
                  #.....R02.....T...#
                  #..DESCENT VEST...#
                  #######.....#######
                        #.....#
                        #.R01.#
                        # P/E #
                        #######

Z -80                      X -75              X +75
```

---

## 6. Route Graph

Main route:

```txt
R01 -> D01 -> R02
R02 -> D02 -> R03
R03 -> D06 -> R06
R06 -> D10 -> R08
R08 -> D14 -> R11
R11 -> D15 -> R12
R12 -> D16 -> R13 sealed/future
```

Optional west route:

```txt
R03 -> D04 -> R04
R04 -> D07 -> R07
R07 -> D11 -> R08
```

Optional east/gate route:

```txt
R03 -> D05 -> R05
R05 -> D08 -> R06
```

Side rooms from Warring Crossing:

```txt
R08 -> D12 -> R09
R08 -> D13 -> R10
```

Shortcut route:

```txt
R12 -> D17 -> R14
R14 -> D18 -> R02 or R05
```

Future route:

```txt
R12 -> D16 -> R13 -> F01 future sealed gate
```

---

## 7. Room Schedule

| ID | Label | minX | maxX | minZ | maxZ | Floor | Ceiling | Wall | Role | Landmark | Safe Spawn | Encounter Weight |
|---|---|---:|---:|---:|---:|---|---|---|---|---|---:|---:|
| R01 | Entry Threshold | -5 | 5 | -80 | -57 | floor | ceiling | wall | field return and descent | cold stair mouth | false | 0.1 |
| R02 | Descent Vestibule | -12 | 12 | -58 | -42 | floor | ceiling | wall | first safe orientation room | paired torches | false | 0.35 |
| R03 | Broken Offering Room | -17 | 17 | -41 | -23 | floor | ceiling | wall | first authored objective beat | broken offering slab / sword chest | true | 0.9 |
| R04 | West Shrine Nook | -44 | -24 | -31 | -9 | floor | ceiling | wall | optional west threat branch | failed shrine stones | true | 1.0 |
| R05 | Rusted Gate Watch | 24 | 44 | -31 | -9 | floor | ceiling | wall | east branch / shortcut landmark | standing rusted gate | true | 1.0 |
| R06 | Black Grass Hall | -25 | 25 | -13 | 13 | grassFloor | ceiling | wall | early wide combat hub | grass where stone should be | true | 1.2 |
| R07 | Rooted Service Loop | -42 | -26 | -8 | 25 | floor | ceiling | wall | west side loop | root crawl along wall | true | 0.9 |
| R08 | Warring Crossing | -31 | 31 | 13 | 43 | grassFloor | ceiling | wall | main faction combat arena | broken divider field | true | 1.65 |
| R09 | Sheep Demon Rookery | -56 | -32 | 39 | 65 | mixedFloor | ceiling | wall | optional west threat pocket | pale bone line | true | 0.9 |
| R10 | Neck Man Bone Store | 32 | 56 | 39 | 65 | mixedFloor | ceiling | wall | optional east threat pocket | counter and smear | true | 0.9 |
| R11 | Lower Rooted Room | -25 | 25 | 50 | 74 | floor | ceiling | wall | deep formal approach | four square pillars | true | 1.25 |
| R12 | Silent Altar Chamber | -27 | 27 | 74 | 90 | grassFloor | ceiling | wall | endpoint / objective chamber | central altar/reliquary | true | 1.35 |
| R13 | Future Reliquary Gate | -11 | 11 | 90 | 100 | floor | ceiling | wall/gate | inspect-only future expansion | sealed gate | false | 0.1 |
| R14 | Shortcut Return Stair | variable | variable | variable | variable | floor | ceiling | wall | return shortcut | opened from lower side | false | 0.2 |

---

## 8. Door / Connector Schedule

| ID | From | To | X | Z | Width | State | Wall Gaps | Nav Waypoint | Notes |
|---|---|---|---:|---:|---:|---|---|---|---|
| D01 | field exit | R01 | 0 | -78 | 4.0 | exit | R01 south / exit opening | X 0 Z -78 | Return to field |
| D02 | R01 | R02 | 0 | -58 | 4.0 | open | R01 north, R02 south | X 0 Z -58 | Entry route |
| D03 | R02 | R03 | 0 | -42 | 4.2 | open | R02 north, R03 south | X 0 Z -42 | Vestibule to offering |
| D04 | R03 | R04 | -17 | -24 | 3.6 | open | R03 west, R04 east | X -17 Z -24 | West optional branch |
| D05 | R03 | R05 | 17 | -24 | 3.6 | open | R03 east, R05 west | X 17 Z -24 | East gate branch |
| D06 | R03 | R06 | 0 | -23 | 4.6 | open | R03 north, R06 south | X 0 Z -23 | Main descent to black grass hall |
| D07 | R04 | R07 | -34 | -9 | 3.6 | open | R04 north, R07 south | X -34 Z -9 | Storage to service loop |
| D08 | R05 | R06 | 24 | -9 | 4.0 | open/gate-adjacent | R05 north/west, R06 east/south as authored | X 24 Z -9 | Gate hall to hall |
| D09 | R06 | R07 | -25 | 4 | 3.6 | open | R06 west, R07 east | X -25 Z 4 | Local loop entrance |
| D10 | R06 | R08 | 0 | 13 | 5.0 | open | R06 north, R08 south | X 0 Z 13 | Wide combat transition |
| D11 | R07 | R08 | -26 | 25 | 3.6 | open | R07 north/east, R08 west/south as authored | X -26 Z 25 | Loop into crossing |
| D12 | R08 | R09 | -31 | 46 | 4.0 | open | R08 west/north, R09 south/east as authored | X -31 Z 46 | Rookery branch |
| D13 | R08 | R10 | 31 | 46 | 4.0 | open | R08 east/north, R10 south/west as authored | X 31 Z 46 | Bone store branch |
| D14 | R08 | R11 | 0 | 50 | 5.0 | open | R08 north, R11 south | X 0 Z 50 | Main lower route |
| D15 | R11 | R12 | 0 | 74 | 5.0 | open | R11 north, R12 south | X 0 Z 74 | Pillar hall to altar |
| D16 | R12 | R13 | 0 | 90 | 4.0 | sealed/future | R12 north, R13 south | X 0 Z 90 | Future gate; inspect only |
| D17 | R12 | R14 | 27 | 80 | 3.6 | shortcut | R12 east, R14 start | X 27 Z 80 | Shortcut from lower side |
| D18 | R14 | R02/R05 | 12 or 44 | -50 or -20 | 3.6 | shortcut/one-way | shortcut return edge | defined by implementation | Return to early dungeon |

Codex may preserve the current runtime connector implementation if it passes integrity validation. Do not force exact geometric rewrites when the current connector metadata is already valid.

---

## 9. Floor Slab Schedule

Runtime rooms should generate one structural floor slab each.

| ID | Room | Center X | Center Z | Width | Depth | Floor Y | Material | Type | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| FLOOR_R01 | R01 | 0 | -68.5 | 10 | 23 | 0 | floor | structural | One slab only |
| FLOOR_R02 | R02 | 0 | -50 | 24 | 16 | 0 | floor | structural | No overlap with R01/R03 |
| FLOOR_R03 | R03 | 0 | -32 | 34 | 18 | 0 | floor | structural | Sword chest/altar room |
| FLOOR_R04 | R04 | -34 | -20 | 20 | 22 | 0 | floor | structural | West shrine |
| FLOOR_R05 | R05 | 34 | -20 | 20 | 22 | 0 | floor | structural | Gate watch |
| FLOOR_R06 | R06 | 0 | 0 | 50 | 26 | 0 | grassFloor | structural | Black grass hall |
| FLOOR_R07 | R07 | -34 | 8.5 | 16 | 33 | 0 | floor | structural | Service loop |
| FLOOR_R08 | R08 | 0 | 28 | 62 | 30 | 0 | grassFloor | structural | Warring Crossing |
| FLOOR_R09 | R09 | -44 | 52 | 24 | 26 | 0 | mixedFloor | structural | Rookery |
| FLOOR_R10 | R10 | 44 | 52 | 24 | 26 | 0 | mixedFloor | structural | Bone store |
| FLOOR_R11 | R11 | 0 | 62 | 50 | 24 | 0 | floor | structural | Pillar hall |
| FLOOR_R12 | R12 | 0 | 82 | 54 | 16 | 0 | grassFloor | structural | Silent altar |
| FLOOR_R13 | R13 | 0 | 95 | 22 | 10 | 0 | floor | structural | Future gate |
| FLOOR_R14 | R14 | varies | varies | per connector | per connector | 0 | floor | structural | Must not overlap room slabs |

Decorative grass/root/blood patches are allowed only as `floor_patch` props slightly above floor. They must not be structural floor slabs.

---

## 10. Wall / Edge Sealing Schedule

Global policy:

```txt
roomEdgePolicy: sealedUnlessDeclaredOpening
```

Every normal room edge is sealed unless the door schedule declares an opening.

| Room | South Edge | North Edge | West Edge | East Edge |
|---|---|---|---|---|
| R01 | D01 exit opening | D02 opening | sealed | sealed |
| R02 | D02 opening | D03 opening | sealed unless shortcut D18 uses west/east edge | sealed unless shortcut D18 uses west/east edge |
| R03 | D03 opening | D06 opening | D04 opening | D05 opening |
| R04 | sealed | D07 opening | sealed | D04 opening |
| R05 | sealed | D08 opening or gate-adjacent opening | D05 opening | sealed |
| R06 | D06 opening | D10 opening | D09 opening | D08 opening |
| R07 | D07 opening | D11 opening | sealed | D09 opening |
| R08 | D10 opening | D14 opening | D11/D12 openings as authored | D13 opening as authored |
| R09 | D12 opening | sealed | sealed | sealed unless D12 uses east edge |
| R10 | D13 opening | sealed | sealed unless D13 uses west edge | sealed |
| R11 | D14 opening | D15 opening | sealed | sealed |
| R12 | D15 opening | D16 sealed/future opening/gate | sealed | D17 shortcut opening |
| R13 | D16 sealed/future opening/gate | sealed/future | sealed | sealed |
| R14 | connector-defined | connector-defined | connector-defined | connector-defined |

Codex instructions:

- Generated wall segments must match this schedule.
- Do not leave an edge open unless it appears here.
- If validation reports `ROOM_EDGE_UNSEALED`, fix the wall/door metadata instead of hiding the warning.
- If validation reports `DOORWAY_MISMATCH`, move the doorway/gap to the real edge.

---

## 11. Ceiling Schedule

Ceiling ownership should mirror floor ownership.

| ID | Room | Center X | Center Z | Width | Depth | Ceiling Y | Material | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| CEIL_R01 | R01 | 0 | -68.5 | 10 | 23 | 3.2 | ceiling | One slab only |
| CEIL_R02 | R02 | 0 | -50 | 24 | 16 | 3.2 | ceiling | One slab only |
| CEIL_R03 | R03 | 0 | -32 | 34 | 18 | 3.2 | ceiling | One slab only |
| CEIL_R04 | R04 | -34 | -20 | 20 | 22 | 3.2 | ceiling | One slab only |
| CEIL_R05 | R05 | 34 | -20 | 20 | 22 | 3.2 | ceiling | One slab only |
| CEIL_R06 | R06 | 0 | 0 | 50 | 26 | 3.2 | ceiling | One slab only |
| CEIL_R07 | R07 | -34 | 8.5 | 16 | 33 | 3.2 | ceiling | One slab only |
| CEIL_R08 | R08 | 0 | 28 | 62 | 30 | 3.2 | ceiling | One slab only |
| CEIL_R09 | R09 | -44 | 52 | 24 | 26 | 3.2 | ceiling | One slab only |
| CEIL_R10 | R10 | 44 | 52 | 24 | 26 | 3.2 | ceiling | One slab only |
| CEIL_R11 | R11 | 0 | 62 | 50 | 24 | 3.2 | ceiling | One slab only |
| CEIL_R12 | R12 | 0 | 82 | 54 | 16 | 3.2 | ceiling | One slab only |
| CEIL_R13 | R13 | 0 | 95 | 22 | 10 | 3.2 | ceiling | One slab only |
| CEIL_R14 | R14 | varies | varies | per connector | per connector | 3.2 | ceiling | Must not overlap room ceilings |

---

## 12. Collision Truth Schedule

Collision must be derived from visible walls, structural props, gates, pillars, dividers, counters, and reliquary blocks.

Required behavior:

- generated wall collision supports generated visible walls
- gates have visible gate mesh and collision unless intentionally non-blocking
- props with movement impact use `collisionRef`
- decorative floor patches are non-blocking
- invisible blockers use explicit purpose only

Important structural props that require truth matching:

| ID / Kind | Room | Collision Rule | Notes |
|---|---|---|---|
| rusted gate | R05/R13 | visible gate + blocker or inspect-only blocker | Must not be invisible-only |
| broken offering slab | R03 | collisionRef if solid | Keep main route clear |
| rusted sword chest | R03 | collisionRef or non-blocking pickup marker | Must not block D03/D06 path |
| broken counters | R06 | collisionRef if used as cover | Avoid snagging |
| dividers | R08 | collisionRef if used as cover | Wide gaps around them |
| pillars | R11 | collisionRef required | Formal room identity |
| silent altar/reliquary | R12 | collisionRef required if solid | Endpoint object |
| future gate | R13 | visible gate + futureGate blocker | Inspect only |

Allowed invisible purposes:

```txt
worldBoundary
safetyBoundary
futureGate
debugOnly
facadeHull
```

---

## 13. Torch / Light Fixture Schedule

Torches should use the Torch Fixture runtime and wall-mounted authoring.

| ID | Room | Wall Side | Distance Along Wall | Height | Profile | Purpose | Illuminates |
|---|---|---|---:|---:|---|---|---|
| BGT-T01 | R01 | north | 2.0 | 1.72 | dungeonTorch | entry guidance | D02 |
| BGT-T02 | R02 | west | 4.0 | 1.72 | dungeonTorch | orientation | R02 center |
| BGT-T03 | R02 | east | 4.0 | 1.72 | dungeonTorch | orientation | R02 center |
| BGT-T04 | R03 | north | 6.0 | 1.72 | dungeonTorch | offering slab focus | P offering slab/chest |
| BGT-T05 | R05 | north | 4.0 | 1.72 | dungeonTorch | gate readability | rusted gate |
| BGT-T06 | R06 | west | 7.0 | 1.72 | dungeonTorch | tavern edge light | E03 side |
| BGT-T07 | R06 | east | 7.0 | 1.72 | dungeonTorch | tavern edge light | E04 side |
| BGT-T08 | R08 | west | 8.0 | 1.72 | dungeonTorch | arena silhouette | west divider |
| BGT-T09 | R08 | east | 8.0 | 1.72 | dungeonTorch | arena silhouette | east divider |
| BGT-T10 | R11 | west | 6.0 | 1.72 | dungeonTorch | pillar rhythm | west pillars |
| BGT-T11 | R11 | east | 6.0 | 1.72 | dungeonTorch | pillar rhythm | east pillars |
| BGT-T12 | R12 | special | center-safe | 1.4 | sanctumColdFill | endpoint mood | silent altar |

Rules:

- T12 may be freestanding/cold fill if marked special.
- All normal torches must mount to walls.
- If a torch cannot validate against a wall, move it or change wallSide/distanceAlongWall.
- Do not place torch visuals inside blocker rectangles.

---

## 14. Prop / Landmark Schedule

| ID | Kind | Room | Position Intent | Material | Collision | Purpose |
|---|---|---|---|---|---|---|
| BGT-P01 | offering slab | R03 | centered / slightly south of room center | offeringStone | solid with collisionRef | R03 landmark |
| BGT-P16 | rusted sword chest | R03 | side of offering room, clear of main route | propStone/gate | pickup interaction, non-snag | equipment proof |
| BGT-P02/P03 | broken counters | R06 | west/east offset | propStone | lowCover if stable | tavern identity/combat cover |
| BGT-P04/P05 | low dividers | R08 | left/right of arena | propStone | lowCover | encounter shaping |
| BGT-P06 | booth/divider cluster | R09 | side pocket | propStone/bonePale | optional | rookery identity |
| BGT-P07 | back bar block | R10 | rear or side wall | propStone/bloodDark | optional | bone store identity |
| BGT-P08-P13 | pillars | R11 | symmetric pillar grid | wall/propStone | solid collisionRef | formal lower room |
| BGT-P14 | silent altar/reliquary | R12 | central focus | offeringStone/rootDark | solid collisionRef | endpoint landmark |
| BGT-P15 | sealed future gate | R13 | north/future edge | gate | futureGate blocker | future expansion |

Decorative entries listed in `integrity.nonBlockingDecor` must remain non-blocking unless promoted to structural props with blockers.

---

## 15. Interaction / Exit Schedule

| ID | Type | Room | Position Intent | Range | Result | Notes |
|---|---|---|---|---:|---|---|
| BGT_INT_ENTER | exit/transition | field facade | Black Grass Temple exterior trigger | 4.5 | enter `black-grass-temple` | Field-side trigger |
| BGT_INT_EXIT_FIELD | exit/transition | R01 | near X 0 Z -76 | 3.5 | return to field spawn `blackGrassTempleExit` | Must never strand player |
| BGT_INT_RUSTED_SWORD_CHEST | equipmentPickup | R03 | chest prop | 3.0 | acquire `rusted_sword` | Uses Equipment Runtime |
| BGT_INT_OFFERING_SLAB | inspect | R03 | slab prop | 3.0 | silent/lore message | Optional |
| BGT_INT_FIRST_GATE | inspect/gate | R05 | gate prop | 3.0 | sealed or simple gate feedback | No fake destination |
| BGT_INT_SHORTCUT | shortcut | R14 | lower-side opener | 3.5 | open return route | Only if current runtime supports cleanly |
| BGT_INT_SILENT_ALTAR | inspect/objective | R12 | altar/reliquary | 3.0 | silent objective/progression flag | Avoid questy HUD |
| BGT_INT_FUTURE_GATE | inspect | R13 | future gate | 3.0 | sealed message | Must not load a new area |

---

## 16. Enemy / NPC Spawn Schedule

Primary factions:

```txt
sheep_demon
neck_man
```

Base spawn markers:

| ID | Kind | Species/Faction | Room | X | Y | Z | Initial | Respawn | Min Player Distance | Notes |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| E01 | enemy | sheep_demon | R03 | 8 | 0 | -31 | true | true | 10 | First visible enemy |
| E02 | enemy | sheep_demon | R04 | -39 | 0 | -18 | false | true | 10 | West pressure branch |
| E03 | enemy | sheep_demon | R06 | -14 | 0 | 2 | true | true | 10 | Tavern visible side |
| E04 | enemy | neck_man | R06 | 16 | 0 | 6 | true | true | 10 | Tavern offset side |
| E05 | enemy | sheep_demon | R07 | -35 | 0 | 12 | false | true | 10 | Service loop |
| E06 | enemy | sheep_demon | R08 | -20 | 0 | 28 | true | true | 10 | Arena left |
| E07 | enemy | neck_man | R08 | 2 | 0 | 33 | false | true | 10 | Arena center/rear |
| E08 | enemy | neck_man | R08 | 22 | 0 | 25 | true | true | 10 | Arena right |
| E09 | enemy | sheep_demon | R09 | -48 | 0 | 54 | false | true | 10 | Rookery side |
| E10 | enemy | neck_man | R11 | -10 | 0 | 61 | true | true | 10 | Pillar hall west |
| E11 | enemy | sheep_demon | R11 | 12 | 0 | 66 | false | true | 10 | Pillar hall far side |
| E12 | enemy | neck_man | R12 | 0 | 0 | 80 | true | true | 10 | Endpoint threat |

Safe active subset for first validation/performance pass:

```txt
E01, E03, E04, E06, E08, E10, E12
```

Rules:

- spawns must not overlap blockers
- initial spawns must not appear directly behind player
- use Creature Actor System configs
- do not require new animation states unless already supported

---

## 17. Encounter Zone Schedule

| ID | Rooms | Purpose | Max Active | Faction Rules | Notes |
|---|---|---|---:|---|---|
| BGT_ZONE_ENTRY | R01,R02,R03 | onboarding / first objective | 1 | minimal pressure | Do not overwhelm entry |
| BGT_ZONE_BRANCHES | R04,R05,R07 | side branch pressure | 2 | split species pressure | Optional loop tension |
| BGT_ZONE_TAVERN | R06 | first grass hall fight | 2 | sheep vs neck allowed | Good visibility |
| BGT_ZONE_CROSSING | R08,R09,R10 | main faction arena | 3 | faction-war anchor zone | Most active area |
| BGT_ZONE_LOWER | R11,R12,R13 | endpoint pressure | 2 | stronger pacing | Keep altar reachable |

---

## 18. Navigation Notes

Primary navigation should come from authored rooms and door nav waypoints.

Rules:

- faction routes should prefer room graph edges, not direct magnet movement through walls
- enemies should not get stuck on dividers/counters
- R08 must remain the main action hub
- R12 must remain reachable even when enemies are active
- shortcut route R14 should be simple, wide, and collision-clean if implemented

Forbidden / avoid zones:

- behind future gate R13
- inside prop blockers
- inside facade behind-zone unless explicitly allowed
- outside intended BGT interior bounds

---

## 19. Material Rules

Use existing material profiles.

```txt
wall = black stone walls
floor = worn stone floor
ceiling = dark stone ceiling
gate = rusted metal gates/grates
grassFloor = black grass tavern/sanctum floors
mixedFloor = partial stone/grass side chambers
propStone = generic stone props
offeringStone = altar/slab/reliquary focus
rootDark = decorative root/grass patches
bonePale = bone-line visual accents
bloodDark = old blood/dark smear accents
```

Do not add new texture files for this pass.

---

## 20. Validation Requirements

Codex must run:

```sh
npm run build
npm run validate:bgt
npm run validate:integrity
npm run validate:dungeons
```

Must report:

- command results
- validation errors
- validation warnings
- any intentional warnings left in place

Required result:

```txt
0 validation errors
```

Warnings may remain only if documented and justified.

---

## 21. Codex Implementation Notes

Codex should:

```txt
1. Read docs/world/ARCHITECTURE_BLUEPRINT_STANDARD.md first.
2. Audit src/game/locations/blackGrassTemple.definition.js against this file.
3. Preserve the compiled dungeon authoring runtime approach.
4. Fix room, door, wall gap, blocker, prop, torch, spawn, and exit mismatches.
5. Keep DungeonScene.js limited to scene lifecycle/routing/runtime ownership.
6. Do not hand-build major BGT dungeon geometry in DungeonScene.js.
7. Keep current gameplay systems working.
8. Run all validation commands listed above.
```

Codex should not:

```txt
- redesign Black Grass Temple from scratch
- add a new framework
- change Vite base path
- touch GitHub Pages workflow
- add minimap/quest log/inventory expansion
- add new assets
- hide validation problems
- remove rooms to make validation easier
- remove enemy systems to avoid fixing placement
```

---

## 22. QA Checklist

Build:

- [ ] `npm run build` passes.
- [ ] `npm run validate:bgt` passes.
- [ ] `npm run validate:integrity` passes.
- [ ] `npm run validate:dungeons` passes.

Geometry:

- [ ] no missing walls
- [ ] no accidental see-through wall gaps
- [ ] no overlapping structural floor slabs
- [ ] no floor flickering / z-fighting
- [ ] no overlapping structural ceiling slabs
- [ ] no one-sided structural walls
- [ ] all declared doorways have matching wall gaps
- [ ] all non-declared edges are sealed

Collision:

- [ ] visible structural props have collision or explicit non-blocking metadata
- [ ] collision has visible support or allowed invisible purpose
- [ ] no blockers in doorway gaps
- [ ] player start is clear
- [ ] field return spawn is clear
- [ ] enemy spawns are clear

Lighting:

- [ ] normal torches are wall-mounted fixtures
- [ ] torches are not inside walls
- [ ] torches are not floating unless marked special/freestanding
- [ ] route is readable from room centers

Gameplay:

- [ ] player can enter from field
- [ ] player can return to field
- [ ] player can reach R01 through R13
- [ ] player can reach rusted sword chest
- [ ] player can reach Silent Altar Chamber
- [ ] future gate is inspect-only
- [ ] enemy active subset does not tank mobile performance
- [ ] objective/equipment/gore systems still work

Design:

- [ ] R06 reads as first black-grass hall
- [ ] R08 reads as main warring/faction arena
- [ ] R11 reads as lower formal pillar room
- [ ] R12 reads as endpoint/silent altar chamber
- [ ] route memory is stronger than a box maze
- [ ] shortcut route, if implemented, pays off without confusion
