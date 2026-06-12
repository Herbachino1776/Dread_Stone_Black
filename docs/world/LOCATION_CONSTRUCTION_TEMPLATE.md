# LOCATION CONSTRUCTION TEMPLATE - <Location Name>

Version: v0.1  
Document path: `docs/world/<category>/<location_id>_v01.md`  
Runtime target: `src/game/locations/<locationId>.definition.js`  
Standard: `docs/world/ARCHITECTURE_BLUEPRINT_STANDARD.md`  
Lane: Game World Architect / Codex Production

---

## 0. Required Reading For Codex

Before implementation, read:

```txt
docs/world/ARCHITECTURE_BLUEPRINT_STANDARD.md
docs/architecture/DUNGEON_AUTHORING_RUNTIME.md
docs/architecture/DUNGEON_INTEGRITY_AND_COLLISION_TRUTH.md
docs/architecture/TORCH_AND_LIGHTING_SYSTEM.md
```

If creatures, objectives, equipment, or gore are involved, also read:

```txt
docs/architecture/CREATURE_ACTOR_SYSTEM.md
docs/architecture/DUNGEON_OBJECTIVE_RUNTIME.md
docs/architecture/EQUIPMENT_AND_FPV_WEAPON_RUNTIME.md
docs/architecture/GORE_RUNTIME.md
```

---

## 1. Purpose

Describe what this location is for.

```txt
Example:
This location is a compact field crypt that teaches the field-to-interior loop, introduces one branch, and returns the player to Reliquary Field.
```

Define:

- gameplay role
- tone / architectural identity
- connection to other locations
- intended playtime
- what this location should prove

---

## 2. Runtime Target

Choose one:

```txt
A. Create new location definition
B. Modify existing location definition
C. Add field exterior landmark only
D. Add addendum to existing location
E. Audit runtime against construction blueprint
```

Runtime file:

```txt
src/game/locations/<locationId>.definition.js
```

Location id:

```txt
<location-id>
```

Display name:

```txt
<Location Name>
```

Area query if needed:

```txt
?area=<location-id>
```

---

## 3. Coordinate System

```txt
X axis: west/east
negative X = west
positive X = east

Z axis: south/north
negative Z = entrance / earlier route
positive Z = deeper route

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
minX:
maxX:
minZ:
maxZ:
```

Player start:

```txt
X:
Y: 1.55
Z:
yaw:
```

Return/exit spawn:

```txt
X:
Y: 1.55
Z:
yaw:
```

---

## 4. Key / Legend

```txt
P = player start
E = exit / return to previous area
D = doorway / connector
G = gate / grate
L = locked or one-way shortcut point
S = shrine / slab / altar
A = alcove / reward / reliquary
F = future sealed door
T = torch cluster
R = major room / guardian room
B = black grass floor zone
# = solid wall / stone mass
. = walkable stone floor
, = walkable black grass floor
+ = shortcut / loop connection
x = enemy spawn marker
```

---

## 5. ASCII Map

Approximate top-down map.

```txt
<insert map here>
```

Rules:

- Map communicates layout intention.
- Tables below are the source of truth.
- Every visible route in the map must be represented in the route graph and door schedule.

---

## 6. Route Graph

```txt
R01 -> D01 -> R02
R02 -> D02 -> R03
R03 -> D03 -> R04
```

Shortcut graph:

```txt
RXX -> DXX -> RYY
```

Future/sealed graph:

```txt
RXX -> DXX sealed/future -> F01
```

---

## 7. Room Schedule

| ID | Label | minX | maxX | minZ | maxZ | Floor | Ceiling | Wall | Role | Landmark | Safe Spawn | Encounter Weight |
|---|---|---:|---:|---:|---:|---|---|---|---|---|---:|---:|
| R01 | Entry Room |  |  |  |  | floor | ceiling | wall |  |  | false | 0.1 |

Notes:

- Use one row per walkable room/connector.
- If a connector should not generate wall geometry, mark that in notes.

---

## 8. Door / Connector Schedule

| ID | From | To | X | Z | Width | State | Wall Gaps | Nav Waypoint | Notes |
|---|---|---|---:|---:|---:|---|---|---|---|
| D01 | R01 | R02 |  |  | 4.0 | open | R01 north, R02 south | same as doorway | Main route |

States:

```txt
open
sealed
locked
one-way
future
shortcut
exit
```

---

## 9. Floor Slab Schedule

| ID | Room | Center X | Center Z | Width | Depth | Floor Y | Material | Structural / Decor | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| FLOOR_R01 | R01 |  |  |  |  | 0 | floor | structural | One slab only |

Floor rules:

- no overlapping structural floor slabs
- no duplicate floor meshes at same Y
- decorative patches must be `floor_patch` and slightly above floor

---

## 10. Wall / Edge Sealing Schedule

| ID | Room | Edge | State | Openings | Expected Wall Segments | Material | Collision Required | Notes |
|---|---|---|---|---|---|---|---:|---|
| R01_N | R01 | north | opening | D01 width 4.0 | split left/right | wall | true | Connects to R02 |
| R01_S | R01 | south | sealed | none | full wall | wall | true | Entrance side unless exit gap exists |
| R01_W | R01 | west | sealed | none | full wall | wall | true |  |
| R01_E | R01 | east | sealed | none | full wall | wall | true |  |

Edges:

```txt
north = maxZ
south = minZ
west = minX
east = maxX
```

---

## 11. Ceiling Schedule

| ID | Room | Center X | Center Z | Width | Depth | Ceiling Y | Material | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|
| CEIL_R01 | R01 |  |  |  |  | 3.2 | ceiling | One slab only |

Ceiling rules:

- no overlapping structural ceiling slabs
- match floor ownership unless height exception is documented

---

## 12. Collision Truth Schedule

| ID | Type | minX | maxX | minZ | maxZ | Height | Visible Support ID | Blocks Player | Blocks Enemies | Allowed Invisible Purpose | Notes |
|---|---|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| BLK_R01_N | wall |  |  |  |  | 3.2 | WALL_R01_N | true | true | none |  |

Rules:

- visible structure needs collision
- collision needs visible support or explicit purpose
- no blockers in doorway gaps

---

## 13. Torch / Light Fixture Schedule

| ID | Room | Wall Side | Distance Along Wall | Height | Profile | Purpose | Illuminates | Notes |
|---|---|---|---:|---:|---|---|---|---|
| T01 | R01 | north | 2.0 | 1.72 | dungeonTorch | route guidance | D01 | Wall-mounted fixture |

Rules:

- prefer Torch Fixture runtime
- no floating torches unless freestanding is explicit
- no torches inside wall collision

---

## 14. Prop / Landmark Schedule

| ID | Kind | Room | X | Y | Z | W | H | D | Material | Collision Ref | Blocking Mode | Purpose |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---|---|---|
| P01 | altar | R01 |  |  |  |  |  |  | propStone | BLK_P01 | solid | Room identity |

Blocking modes:

```txt
solid
nonBlockingDecor
lowCover
futureGate
triggerOnly
```

---

## 15. Interaction / Exit Schedule

| ID | Type | Room | X | Y | Z | Range | Target | Result | Destination Area | Destination Spawn | Message / Note |
|---|---|---|---:|---:|---:|---:|---|---|---|---|---|
| INT01 | exit | R01 |  | 1.2 |  | 3.5 | exit threshold | return | field | <spawnId> |  |

Rules:

- exits must have valid destination spawns
- future gates inspect only unless destination exists
- equipment pickups use Equipment Runtime
- objective logic uses Objective Runtime

---

## 16. Enemy / NPC Spawn Schedule

| ID | Kind | Species | Faction | Room | X | Y | Z | Yaw | Initial | Respawn | Min Player Distance | Encounter Zone | Notes |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| E01 | enemy | sheep_demon | sheep_demon | R01 |  | 0 |  | 0 | false | true | 10 | ZONE01 |  |

Rules:

- no spawns inside blockers
- no enemies directly behind player start
- activate only mobile-safe enemy count first

---

## 17. Encounter Zone Schedule

| ID | Rooms | Center X | Center Z | Radius / Bounds | Max Active Enemies | Faction Rules | Respawn Policy | Notes |
|---|---|---:|---:|---|---:|---|---|---|
| ZONE01 | R01,R02 |  |  |  | 2 |  |  |  |

---

## 18. Navigation Notes

Define:

- main route
- optional branch routes
- shortcut routes
- forbidden zones
- patrol lanes
- room centers
- places enemies should avoid

```txt
<notes>
```

---

## 19. Material Rules

Allowed material profiles:

```txt
wall
floor
ceiling
gate
grassFloor
mixedFloor
propStone
offeringStone
rootDark
bonePale
bloodDark
```

Do not add new textures unless explicitly approved.

---

## 20. Validation Requirements

Codex must run:

```sh
npm run build
npm run validate:dungeons
```

If Black Grass Temple is involved, also run:

```sh
npm run validate:bgt
npm run validate:integrity
```

---

## 21. Codex Implementation Notes

Codex should:

```txt
- read docs/world/ARCHITECTURE_BLUEPRINT_STANDARD.md first
- implement through src/game/locations/<locationId>.definition.js when possible
- keep major dungeon geometry out of DungeonScene.js
- preserve mobile controls, FPV arms, HUD, combat, equipment, objectives, and gore runtimes
- use existing texture/material profiles first
- run all validation commands listed above
- report warnings/errors honestly
```

Codex should not:

```txt
- invent a new framework
- change deployment config
- change Vite base path
- add a minimap or quest log unless requested
- create overlapping floor slabs
- create one-sided structural walls
- place torches as random floating point lights
```

---

## 22. QA Checklist

Build:

- [ ] `npm run build` passes.
- [ ] `npm run validate:dungeons` passes.
- [ ] Location-specific validation passes.

Geometry:

- [ ] No missing walls.
- [ ] No accidental see-through gaps.
- [ ] No floor z-fighting.
- [ ] No ceiling z-fighting.
- [ ] No one-sided structural walls.
- [ ] Doorway gaps match route graph.

Collision:

- [ ] Player spawn clear.
- [ ] Return spawn clear.
- [ ] Enemy spawns clear.
- [ ] Visible walls have collision.
- [ ] Collision has visible support or explicit purpose.
- [ ] Doorways are not blocked.

Lighting:

- [ ] Torches are wall-mounted or explicitly freestanding.
- [ ] No torches inside walls.
- [ ] Next route is readable from each major room.

Gameplay:

- [ ] Player can follow main route.
- [ ] Player can use optional branches.
- [ ] Player can return to previous area.
- [ ] Interactions are reachable on mobile.
- [ ] Enemy count is mobile-safe.

Design:

- [ ] Each major room has identity.
- [ ] Route memory is clear.
- [ ] Shortcuts pay off.
- [ ] Future doors do not pretend to be implemented.
