# FIELD KEEPER HOUSE v01 - Construction Blueprint

Version: v0.1  
Document path: `docs/world/houses/field_keeper_house_v01.md`  
Runtime target: `src/game/locations/fieldKeeperHouse.definition.js`  
Standard: `docs/world/ARCHITECTURE_BLUEPRINT_STANDARD.md`  
Parent field document: `docs/world/overworld/reliquary_field_v01.md`  
Lane: Game World Architect / Codex Production

---

## 0. Required Reading For Codex

Before implementation, read:

```txt
docs/world/ARCHITECTURE_BLUEPRINT_STANDARD.md
docs/world/LOCATION_CONSTRUCTION_TEMPLATE.md
docs/architecture/DUNGEON_AUTHORING_RUNTIME.md
docs/architecture/DUNGEON_INTEGRITY_AND_COLLISION_TRUTH.md
docs/architecture/TORCH_AND_LIGHTING_SYSTEM.md
```

This is a physical-structure blueprint. The first build should prove that the construction standard works for tight houses/interiors, not only big temples.

---

## 1. Purpose

Field Keeper House is a small ruined field dwelling connected to Reliquary Field.

It should feel like an old warden/keeper house built from the same black stone as the crypts and temples. It is not cozy. It is a practical stone dwelling that survived as a hollow shell: hearth room, sleeping alcove, storage, collapsed back room, cellar stair, and a root cellar beneath the floor.

Gameplay purpose:

- test the architecture standard on a compact building interior
- prove field exterior -> interior -> cellar -> return flow
- test small-room wall sealing and doorway validation
- test furniture/prop collision truth
- test torches/light fixtures in tight rooms
- create a reusable pattern for future houses, huts, gatehouses, and village interiors

First version scope:

```txt
- physical structure only
- no enemies required
- no new textures
- no new model assets
- no inventory expansion
- no quest system
- no new combat behavior
```

Optional simple inspect interactions are allowed.

---

## 2. Runtime Target

Operation type:

```txt
A. Create new location definition
```

Runtime file:

```txt
src/game/locations/fieldKeeperHouse.definition.js
```

Location id:

```txt
field-keeper-house
```

Display name:

```txt
Field Keeper House
```

Suggested area query:

```txt
?area=field-keeper-house
```

Connection:

```txt
Reliquary Field -> Field Keeper House -> Reliquary Field
```

Codex should create a compiled location definition if possible. Major geometry should not be hand-built directly in `DungeonScene.js`.

---

## 3. Coordinate System

Local interior coordinates:

```txt
X axis: west/east
negative X = west
positive X = east

Z axis: south/north
negative Z = front/field side
positive Z = rear/deeper house

Y axis: vertical
Y 0 = floor plane
```

Defaults:

```txt
floorY: 0
playerEyeY: 1.55
wallHeight: 3.0
wallThickness: 0.35
floorThickness: 0.18
ceilingThickness: 0.18
minimumDoorwayWidth: 3.2
preferredDoorwayWidth: 3.6
```

Interior bounds:

```txt
minX: -24
maxX: 24
minZ: -32
maxZ: 32
```

Player interior start:

```txt
X: 0
Y: 1.55
Z: -27
yaw: north / positive Z
```

Primary exit back to Reliquary Field:

```txt
X: 0
Y: 1.2
Z: -30
range: 3.5
```

---

## 4. Field Placement

Preferred field placement:

```txt
Field Keeper House exterior center: X 118, Y 0, Z -64
```

Placement logic:

- close enough to the first Reliquary Field slice to be useful
- offset from the South Reliquary Crypt so it reads as a different kind of destination
- small silhouette, not a major temple landmark
- should look like an abandoned field dwelling or keeper station

If the exact field coordinate conflicts with existing structures/collision, Codex may move it within this safe placement band:

```txt
X: 95 to 145
Z: -90 to -35
```

The house should face south/southwest toward the player approach.

---

## 5. Key / Legend

```txt
P = player start
E = exit / return to Reliquary Field
D = doorway / connector
L = one-way or opened shortcut
S = slab / bed / shelf
H = hearth / chimney block
C = cellar stair / cellar hatch
F = future sealed/collapsed room edge
T = wall torch / cold fixture
# = solid wall / stone mass
. = walkable stone floor
, = cellar dirt/grass-dark floor patch
x = optional future spawn marker, inactive in v0.1
```

---

## 6. ASCII Map

Approximate top-down house layout. Tables are the source of truth.

```txt
Z +32

          #########################
          #.........R05 F.........#
          #....collapsed back.....#
          #.........room..........#
          #######.....#####.....###
                #.....#   #.....#
                # D06 #   # D07 #
      ###########.....#####.....###########
      #........R03........#.....R04.......#
      # sleeping alcove S # storage S S...#
      #...................#...............#
      #######.....#########.....###########
            # D03 #       # D04 #
            #.....#       #.....#
      #######.....#########.....#######
      #................R02.............#
      #........MAIN HEARTH ROOM........#
      #.........H..............T.......#
      #...............................#
      #######.....#############.....###
            # D02 #           # D05 #
            #.....#           #.....#
      #######.....#      ######.....######
      #....R01....#      #.....R06.......#
      # mudroom E #      # cellar stair C#
      #....P......#      ######.....######
      #######.....#           # D08 #
            # D01 #           #.....#
            #######     ######.....######
                        #.....R07.......#
                        # root cellar ,,#
                        # shelves S ,,,,#
                        #################

Z -32                  X -24             X +24
```

---

## 7. Route Graph

Main route:

```txt
Field exterior -> EXT_D01 -> R01
R01 -> D02 -> R02
R02 -> D03 -> R03
R02 -> D04 -> R04
R02 -> D05 -> R06
R06 -> D08 -> R07
```

Rear route:

```txt
R03 -> D06 -> R05
R04 -> D07 -> R05
```

Exit route:

```txt
R01 -> D01/INT_EXIT -> Reliquary Field
```

Future/collapsed route:

```txt
R05 -> F01 collapsed rear wall / future expansion, inspect only
```

---

## 8. Room Schedule

| ID | Label | minX | maxX | minZ | maxZ | Floor | Ceiling | Wall | Role | Landmark | Safe Spawn | Encounter Weight |
|---|---|---:|---:|---:|---:|---|---|---|---|---|---:|---:|
| R01 | Entry Mudroom | -8 | 4 | -30 | -18 | floor | ceiling | wall | field entry / return room | low cracked threshold | false | 0.05 |
| R02 | Main Hearth Room | -18 | 18 | -18 | 2 | floor | ceiling | wall | central house room | hearth/chimney block | false | 0.15 |
| R03 | Sleeping Alcove | -22 | -4 | 2 | 16 | floor | ceiling | wall | west private room | stone bed slab | false | 0.1 |
| R04 | Storage Room | 4 | 22 | 2 | 16 | floor | ceiling | wall | east storage room | shelves/crates made from blocks | false | 0.1 |
| R05 | Collapsed Back Room | -16 | 16 | 16 | 30 | floor | ceiling | wall | ruined rear chamber / future hook | collapsed rear stones | false | 0.05 |
| R06 | Cellar Stair | 8 | 22 | -18 | -4 | floor | ceiling | wall | descent connector | dark cellar hatch/stair | false | 0.05 |
| R07 | Root Cellar | 8 | 24 | -32 | -18 | mixedFloor | ceiling | wall | underfloor chamber | root shelves / dirt-dark floor | false | 0.05 |

Notes:

- `R07` is still on local Y 0 for first implementation unless the runtime already supports vertical offset cleanly.
- If vertical stairs are risky, represent R06 as a short dark connector and R07 as a connected lower-feeling room through lighting/materials.
- No enemies are required for v0.1.

---

## 9. Door / Connector Schedule

| ID | From | To | X | Z | Width | State | Wall Gaps | Nav Waypoint | Notes |
|---|---|---|---:|---:|---:|---|---|---|---|
| D01 | field | R01 | 0 | -30 | 3.6 | exit | R01 south / exterior front opening | X 0 Z -30 | Field return threshold |
| D02 | R01 | R02 | 0 | -18 | 3.6 | open | R01 north, R02 south | X 0 Z -18 | Mudroom to hearth |
| D03 | R02 | R03 | -8 | 2 | 3.4 | open | R02 north/west, R03 south/east as authored | X -8 Z 2 | Hearth to sleeping alcove |
| D04 | R02 | R04 | 8 | 2 | 3.4 | open | R02 north/east, R04 south/west as authored | X 8 Z 2 | Hearth to storage |
| D05 | R02 | R06 | 14 | -10 | 3.4 | open | R02 east/south, R06 west/north as authored | X 14 Z -10 | Hearth to cellar stair |
| D06 | R03 | R05 | -8 | 16 | 3.2 | open | R03 north, R05 south | X -8 Z 16 | Sleeping alcove to collapsed rear |
| D07 | R04 | R05 | 8 | 16 | 3.2 | open | R04 north, R05 south | X 8 Z 16 | Storage to collapsed rear |
| D08 | R06 | R07 | 16 | -18 | 3.2 | open | R06 south, R07 north | X 16 Z -18 | Cellar stair to root cellar |
| F01 | R05 | future/collapsed | 0 | 30 | 4.0 | future/blocked | R05 north visual collapse, no passage | X 0 Z 30 | Inspect-only collapsed rear wall |

Codex may use short connector records if the runtime prefers connector spaces between non-touching rectangles. The route graph must remain intact.

---

## 10. Floor Slab Schedule

| ID | Room | Center X | Center Z | Width | Depth | Floor Y | Material | Type | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| FLOOR_R01 | R01 | -2 | -24 | 12 | 12 | 0 | floor | structural | Entry slab only |
| FLOOR_R02 | R02 | 0 | -8 | 36 | 20 | 0 | floor | structural | Main room slab only |
| FLOOR_R03 | R03 | -13 | 9 | 18 | 14 | 0 | floor | structural | Sleeping room slab only |
| FLOOR_R04 | R04 | 13 | 9 | 18 | 14 | 0 | floor | structural | Storage room slab only |
| FLOOR_R05 | R05 | 0 | 23 | 32 | 14 | 0 | floor | structural | Rear room slab only |
| FLOOR_R06 | R06 | 15 | -11 | 14 | 14 | 0 | floor | structural | Cellar stair room slab only |
| FLOOR_R07 | R07 | 16 | -25 | 16 | 14 | 0 | mixedFloor | structural | Root cellar; no vertical offset in v0.1 unless safe |
| PATCH_R07_DIRT | R07 | 17 | -25 | 11 | 9 | 0.035 | rootDark | decorative | Slightly above floor, non-blocking |

Rules:

- Structural floor slabs must not overlap.
- Decorative patch is not a second floor.
- Do not create floor flicker by placing cellar patch at same Y as floor.

---

## 11. Wall / Edge Sealing Schedule

Global policy:

```txt
roomEdgePolicy: sealedUnlessDeclaredOpening
```

| Room | South Edge | North Edge | West Edge | East Edge |
|---|---|---|---|---|
| R01 | D01 exit opening | D02 opening | sealed | sealed |
| R02 | D02 opening | D03/D04 openings as authored | sealed | D05 opening |
| R03 | D03 opening | D06 opening | sealed | sealed/shared doorway logic with R02 |
| R04 | D04 opening | D07 opening | sealed/shared doorway logic with R02 | sealed |
| R05 | D06/D07 openings | F01 collapsed/future visual block | sealed | sealed |
| R06 | D08 opening | D05 opening | D05 opening/shared edge | sealed |
| R07 | D08 opening | D08 opening/shared edge | sealed | sealed |

Rules:

- Do not leave back room open to outside except F01 collapsed visual/future wall.
- F01 is not a playable doorway in v0.1.
- Every doorway opening must match the door schedule.
- Tight-room walls must use solid box geometry through the compiler.

---

## 12. Ceiling Schedule

| ID | Room | Center X | Center Z | Width | Depth | Ceiling Y | Material | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| CEIL_R01 | R01 | -2 | -24 | 12 | 12 | 3.0 | ceiling | Low house ceiling |
| CEIL_R02 | R02 | 0 | -8 | 36 | 20 | 3.0 | ceiling | Main ceiling, optional chimney hole visual not required |
| CEIL_R03 | R03 | -13 | 9 | 18 | 14 | 3.0 | ceiling | Sleeping alcove ceiling |
| CEIL_R04 | R04 | 13 | 9 | 18 | 14 | 3.0 | ceiling | Storage ceiling |
| CEIL_R05 | R05 | 0 | 23 | 32 | 14 | 3.0 | ceiling | Rear room ceiling; can include collapsed visual props, but not missing structural ceiling unless authored |
| CEIL_R06 | R06 | 15 | -11 | 14 | 14 | 3.0 | ceiling | Cellar stair ceiling |
| CEIL_R07 | R07 | 16 | -25 | 16 | 14 | 2.8 | ceiling | Lower-feeling root cellar ceiling |

Rules:

- No overlapping ceiling slabs.
- If collapsed ceiling holes are desired, use visible prop dressing only in v0.1; do not create open sky holes unless explicitly authored.

---

## 13. Collision Truth Schedule

Important blockers / visible supports:

| ID | Type | Room | Bounds / Intent | Visible Support | Blocks Player | Blocks Enemies | Notes |
|---|---|---|---|---|---:|---:|---|
| BLK_WALLS | generated walls | all | generated from sealed edges | generated wall meshes | true | true | Must pass integrity validation |
| BLK_HEARTH | hearth | R02 | around hearth block | PROP_HEARTH | true | true | Large readable prop, not in main route |
| BLK_BED | bed slab | R03 | stone bed footprint | PROP_BED | true | true | Low but solid |
| BLK_STORAGE_A | shelf | R04 | west shelf/counter | PROP_SHELF_A | true | true | Keep D04/D07 clear |
| BLK_STORAGE_B | shelf | R04 | rear shelf | PROP_SHELF_B | true | true | Keep path readable |
| BLK_COLLAPSE | collapsed stones | R05 | north/rear future wall | PROP_COLLAPSE | true | true | Visible future blocker |
| BLK_CELLAR_RAIL | cellar stair side stone | R06 | side rail/edge | PROP_CELLAR_RAIL | true | true | Avoid snagging |
| BLK_ROOT_SHELF | root cellar shelf | R07 | side shelf | PROP_ROOT_SHELF | true | true | Keep center walkable |

Allowed invisible purposes:

```txt
safetyBoundary
worldBoundary
futureGate
debugOnly
```

No normal house blocker should be invisible without purpose.

---

## 14. Torch / Light Fixture Schedule

This house should be dim, but readable.

| ID | Room | Wall Side | Distance Along Wall | Height | Profile | Purpose | Illuminates | Notes |
|---|---|---|---:|---:|---|---|---|---|
| FKH-T01 | R01 | north | 2.0 | 1.65 | dungeonTorch | entry readability | D02 | Small wall sconce |
| FKH-T02 | R02 | east | 6.0 | 1.7 | dungeonTorch | main room identity | hearth and D05 | Wall-mounted |
| FKH-T03 | R03 | west | 4.0 | 1.6 | dungeonTorch | sleeping alcove mood | bed slab | Dimmer acceptable |
| FKH-T04 | R04 | east | 4.0 | 1.6 | dungeonTorch | storage readability | shelves | Wall-mounted |
| FKH-T05 | R06 | south | 3.0 | 1.55 | dungeonTorch | cellar descent | D08 | Should not block stair path |
| FKH-T06 | R07 | special | center-safe | 1.2 | coldCellarFill | root cellar readability | root shelf / cellar floor | Freestanding/cold fill allowed if marked special |

Rules:

- Normal torches use Torch Fixture runtime.
- No floating torches unless marked special.
- No torch fixture inside wall collision.
- R07 cold fill may be a point light without visible torch if documented.

---

## 15. Prop / Landmark Schedule

| ID | Kind | Room | X | Y | Z | W | H | D | Material | Collision Ref | Blocking Mode | Purpose |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---|---|---|
| PROP_THRESHOLD | threshold slab | R01 | 0 | 0.12 | -29 | 5 | 0.24 | 1.2 | propStone | none or BLK_THRESHOLD | nonBlockingDecor/low | Entry identity |
| PROP_HEARTH | hearth/chimney block | R02 | -10 | 0.9 | -8 | 5 | 1.8 | 2.2 | offeringStone | BLK_HEARTH | solid | Main room landmark |
| PROP_LOW_TABLE | low stone table | R02 | 4 | 0.45 | -7 | 5 | 0.9 | 2 | propStone | optional | lowCover | Domestic ruin identity |
| PROP_BED | stone bed slab | R03 | -16 | 0.45 | 8 | 7 | 0.9 | 3 | propStone | BLK_BED | solid | Sleeping alcove identity |
| PROP_BED_MARK | cracked pillow stone | R03 | -18 | 0.85 | 9.2 | 2 | 0.3 | 1.2 | bonePale | none | nonBlockingDecor | Small visual, no collision |
| PROP_SHELF_A | storage shelf A | R04 | 17 | 0.85 | 6 | 1.6 | 1.7 | 7 | propStone | BLK_STORAGE_A | solid | Storage wall identity |
| PROP_SHELF_B | rear shelf | R04 | 13 | 0.7 | 13 | 8 | 1.4 | 1.4 | propStone | BLK_STORAGE_B | solid | Rear storage |
| PROP_COLLAPSE | collapsed rear stones | R05 | 0 | 1.0 | 29 | 14 | 2.0 | 2.2 | wall | BLK_COLLAPSE | futureGate | Future/collapsed back |
| PROP_CRACKED_BACK_BEAM | fallen beam/slab | R05 | -6 | 0.35 | 22 | 8 | 0.7 | 1.5 | propStone | optional | lowCover | Ruin dressing |
| PROP_CELLAR_RAIL | stair side stone | R06 | 20 | 0.6 | -12 | 1.2 | 1.2 | 8 | propStone | BLK_CELLAR_RAIL | solid | Cellar descent edge |
| PROP_CELLAR_HATCH | hatch frame | R06 | 16 | 0.12 | -17 | 5 | 0.24 | 2 | gate | none | nonBlockingDecor | Implies descent |
| PROP_ROOT_SHELF | root shelf | R07 | 22 | 0.75 | -25 | 1.5 | 1.5 | 8 | propStone | BLK_ROOT_SHELF | solid | Cellar identity |
| PROP_ROOT_JARS | small jar blocks | R07 | 18 | 0.35 | -29 | 5 | 0.7 | 1 | bonePale | none | nonBlockingDecor | Readable storage detail |

No new assets are required. All props are simple boxes using current material profiles.

---

## 16. Interaction / Exit Schedule

| ID | Type | Room | X | Y | Z | Range | Target | Result | Destination Area | Destination Spawn | Message / Note |
|---|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FKH_INT_ENTER | transition | field exterior | field placement | 4.0 | house front door | enter house | field-keeper-house | playerStart | Field-side trigger |
| FKH_INT_EXIT | transition | R01 | 0 | 1.2 | -30 | 3.5 | front threshold | return to field | field | fieldKeeperHouseExit | Must never strand player |
| FKH_INT_HEARTH | inspect | R02 | -10 | 1.0 | -8 | 3.0 | PROP_HEARTH | message only | none | none | "The hearth is cold, but the stone around it is burned smooth." |
| FKH_INT_BED | inspect | R03 | -16 | 1.0 | 8 | 3.0 | PROP_BED | message only | none | none | "The bed slab is too short for a man and too long for a child." |
| FKH_INT_STORAGE | inspect | R04 | 14 | 1.0 | 12 | 3.0 | PROP_SHELF_B | message only | none | none | "Old storage niches face the wall, as if hiding what they held." |
| FKH_INT_COLLAPSE | inspect | R05 | 0 | 1.2 | 28 | 3.0 | PROP_COLLAPSE | future-blocked message | none | none | "The rear stones have fallen inward. Something pressed from below." |
| FKH_INT_CELLAR | inspect | R06 | 16 | 1.0 | -17 | 3.0 | PROP_CELLAR_HATCH | message only or route hint | none | none | "A cellar breathes through the floor." |
| FKH_INT_ROOTS | inspect | R07 | 18 | 1.0 | -26 | 3.0 | PROP_ROOT_SHELF | message only | none | none | "The roots grew around the shelves, not through them." |

Interactions should be optional and non-blocking in v0.1.

---

## 17. Enemy / NPC Spawn Schedule

No active enemies are required in v0.1.

Optional inactive/future marker only:

| ID | Kind | Species | Faction | Room | X | Y | Z | Yaw | Initial | Respawn | Min Player Distance | Encounter Zone | Notes |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| FKH_E01_FUTURE_CELLAR | debug/future | sheep_demon or none | none | R07 | 15 | 0 | -24 | 0 | false | false | 10 | none | Do not activate in v0.1 |

This blueprint is about physical structure. Do not add combat unless explicitly requested later.

---

## 18. Encounter Zone Schedule

No combat encounter zones required for v0.1.

Optional navigation/room grouping zones:

| ID | Rooms | Purpose | Max Active Enemies | Faction Rules | Notes |
|---|---|---|---:|---|---|
| FKH_ZONE_INTERIOR | R01,R02,R03,R04,R05,R06,R07 | interior traversal/debug grouping | 0 | none | No active encounter |

---

## 19. Navigation Notes

Main route:

```txt
field -> R01 -> R02 -> R03/R04/R06 -> R07 -> back to R01 -> field
```

Design intent:

- R02 is the orientation hub.
- R03 and R04 are side rooms.
- R05 is a rear future hook reachable from both side rooms.
- R06/R07 create a cellar descent path.
- No room should be a maze.
- Doorways must be wide enough for mobile movement.
- Props must not snag the player in small rooms.

Forbidden zones:

```txt
behind collapsed rear wall F01
outside house walls
inside prop blockers
inside exterior house shell walls
```

---

## 20. Material Rules

Use existing material profiles / texture kit only.

```txt
wall = black stone walls
floor = worn stone floors
ceiling = dark stone ceiling
gate = rusted metal/hatch accent
glassFloor = not used
mixedFloor = root cellar floor
propStone = furniture blocks / shelves / slabs
offeringStone = hearth block
rootDark = cellar dirt/root floor patch
bonePale = small pale stone/jar details
bloodDark = not required in v0.1
```

Do not add new textures or model assets for this pass.

---

## 21. Exterior Field Landmark Plan

Preferred exterior:

| ID | Type | Field Position | Size | Material | Collision | Purpose |
|---|---|---|---|---|---|---|
| FKH_EXT_BASE | low house foundation | X 118, Y 0.2, Z -64 | W 28, H 0.4, D 24 | floor | walkable/solid as supported | Foundation silhouette |
| FKH_EXT_WALL_REAR | rear wall mass | X 118, Y 2.4, Z -54 | W 28, H 4.8, D 2 | wall | solid | House back silhouette |
| FKH_EXT_WALL_W | west broken wall | X 104, Y 2.0, Z -64 | W 2, H 4, D 22 | wall | solid | Side wall |
| FKH_EXT_WALL_E | east broken wall | X 132, Y 1.8, Z -64 | W 2, H 3.6, D 22 | wall | solid | Side wall |
| FKH_EXT_FRONT_L | front left return | X 111, Y 1.6, Z -76 | W 10, H 3.2, D 2 | wall | solid | Creates doorway gap |
| FKH_EXT_FRONT_R | front right return | X 125, Y 1.6, Z -76 | W 10, H 3.2, D 2 | wall | solid | Creates doorway gap |
| FKH_EXT_DOOR | entrance trigger | X 118, Y 1.2, Z -77 | W 5, H 3, D 4 | none | trigger | Enter house |
| FKH_EXT_CHIMNEY | chimney block | X 109, Y 4, Z -63 | W 3, H 8, D 3 | wall | solid | Long-range silhouette |

If field placement is adjusted, keep exterior parts grouped around the same relative center.

---

## 22. Validation Requirements

Codex must run:

```sh
npm run build
npm run validate:dungeons
```

If the validation system only knows BGT/field at first, Codex should add Field Keeper House to the location registry and validation coverage in the smallest safe way.

Required result:

```txt
0 build errors
0 validation errors for the new house definition
```

Warnings may remain only if documented and justified.

---

## 23. Codex Implementation Notes

Codex should:

```txt
1. Read docs/world/ARCHITECTURE_BLUEPRINT_STANDARD.md first.
2. Create src/game/locations/fieldKeeperHouse.definition.js as a compiled location definition.
3. Add the definition to src/game/locations/locationRegistry.js.
4. Add a field-side entrance/return connection in the smallest safe way.
5. Implement house geometry through rooms, doors, wall gaps, floors, ceilings, blockers, props, exits, and lights.
6. Prefer the existing Dungeon Authoring Runtime over hand-building geometry in DungeonScene.js.
7. Add optional inspect interactions only if they fit existing Interactions patterns.
8. Do not add enemies in v0.1 unless using inactive future marker metadata only.
9. Run build and validation.
```

Codex should not:

```txt
- add new textures
- add new models
- add combat encounters
- add a quest log
- add inventory expansion
- change deployment config
- change Vite base path
- break Reliquary Field
- break South Reliquary Crypt
- break Black Grass Temple
- hide validation issues
- create overlapping floor/ceiling slabs
- create floating torches
```

Recommended PR title:

```txt
Implement Field Keeper House v0.1
```

---

## 24. QA Checklist

Build:

- [ ] `npm run build` passes.
- [ ] `npm run validate:dungeons` passes or reports no errors for the new house definition.

Field connection:

- [ ] Field Keeper House exterior appears in Reliquary Field.
- [ ] Exterior silhouette reads as a small ruined house.
- [ ] Player can enter from field.
- [ ] Player returns to field at a safe spawn point.

Geometry:

- [ ] No missing exterior walls.
- [ ] No missing interior walls.
- [ ] No accidental see-through gaps except intended doorways.
- [ ] No floor flickering.
- [ ] No ceiling flickering.
- [ ] No overlapping structural floor slabs.
- [ ] No overlapping structural ceiling slabs.
- [ ] F01 collapsed rear room reads as blocked/future, not broken geometry.

Collision:

- [ ] Visible structural props have collision or explicit non-blocking metadata.
- [ ] No invisible blockers without purpose.
- [ ] Doorways are not blocked.
- [ ] Player spawn is clear.
- [ ] Return spawn is clear.
- [ ] Tight rooms do not snag the player.

Lighting:

- [ ] Torches are wall-mounted or explicitly special.
- [ ] No torches inside walls.
- [ ] R02 hearth room is readable.
- [ ] R07 cellar is dim but navigable.

Navigation:

- [ ] Player can enter R01.
- [ ] Player can reach R02.
- [ ] Player can enter R03 sleeping alcove.
- [ ] Player can enter R04 storage room.
- [ ] Player can enter R05 collapsed back room.
- [ ] Player can enter R06 cellar stair.
- [ ] Player can enter R07 root cellar.
- [ ] Player can return to field.

Design:

- [ ] R02 reads as the main hearth room.
- [ ] R03 reads as a sleeping alcove.
- [ ] R04 reads as storage.
- [ ] R05 reads as collapsed/future rear room.
- [ ] R07 reads as a root cellar / underfloor chamber.
- [ ] The house feels physically constructed, not randomly carved.
