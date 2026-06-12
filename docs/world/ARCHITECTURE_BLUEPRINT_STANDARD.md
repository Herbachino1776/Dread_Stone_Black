# Dread Stone Black - Architecture Blueprint Standard

Version: v1.0  
Lane: Game World Architect / Codex Production  
Purpose: Required authoring standard for all buildable locations.

---

## 1. Purpose

This standard exists so Dread Stone Black locations are authored as reliable construction packages instead of vibe prompts.

Future dungeons, temples, crypts, houses, taverns, fields, shrines, towers, ruins, and interiors should follow this standard before Codex implements them.

The goal is to prevent recurring production errors:

- missing walls
- accidental see-through gaps
- wrongly placed torches
- floating torches
- torches inside walls
- floor z-fighting
- overlapping ceiling slabs
- collision that does not match visible geometry
- invisible blockers with no explanation
- player spawns inside collision
- enemy spawns too close to walls
- exits that strand the player
- Codex inventing systems instead of using the runtime

This standard should be read alongside:

```txt
docs/architecture/DUNGEON_AUTHORING_RUNTIME.md
docs/architecture/DUNGEON_INTEGRITY_AND_COLLISION_TRUTH.md
docs/architecture/TORCH_AND_LIGHTING_SYSTEM.md
docs/architecture/CREATURE_ACTOR_SYSTEM.md
docs/architecture/DUNGEON_OBJECTIVE_RUNTIME.md
docs/architecture/EQUIPMENT_AND_FPV_WEAPON_RUNTIME.md
```

---

## 2. Preferred File Type

Blueprints should be Markdown files committed under `docs/world/`.

Markdown is preferred because it can carry:

- intention
- ASCII maps
- keys
- route graphs
- construction tables
- runtime mapping rules
- QA checklists
- Codex implementation constraints

Do not use a standalone image, PDF, or pure prose document as the only blueprint.

A visual map can be added later, but the source of truth must be text/tables that Codex can parse.

---

## 3. Blueprint File Locations

Use predictable paths:

```txt
docs/world/crypts/<location_id>_v01.md
docs/world/temples/<location_id>_v01.md
docs/world/houses/<location_id>_v01.md
docs/world/dungeons/<location_id>_v01.md
docs/world/fields/<location_id>_v01.md
docs/world/addendums/<location_id>_addendum_001.md
```

Strict construction upgrades may use:

```txt
docs/world/<category>/<location_id>_v02_construction_blueprint.md
```

Runtime definitions should live under:

```txt
src/game/locations/<locationId>.definition.js
```

Example:

```txt
docs/world/temples/black_grass_temple_v02_construction_blueprint.md
src/game/locations/blackGrassTemple.definition.js
```

---

## 4. Coordinate Standard

All authored locations use top-down local coordinates unless explicitly marked as field/world coordinates.

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

Default values:

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

All room bounds use:

```txt
minX, maxX, minZ, maxZ
```

All visible props should use:

```txt
position: X, Y, Z
dimensions: width, height, depth
```

---

## 5. Required Blueprint Sections

Every production-grade location blueprint should include these sections.

```txt
1. Purpose
2. Runtime Target
3. Coordinate System
4. Key / Legend
5. ASCII Map
6. Route Graph
7. Room Schedule
8. Door / Connector Schedule
9. Floor Slab Schedule
10. Wall / Edge Sealing Schedule
11. Ceiling Schedule
12. Collision Truth Schedule
13. Torch / Light Fixture Schedule
14. Prop / Landmark Schedule
15. Interaction / Exit Schedule
16. Enemy / NPC Spawn Schedule
17. Encounter Zone Schedule
18. Navigation Notes
19. Material Rules
20. Validation Requirements
21. Codex Implementation Notes
22. QA Checklist
```

For very small locations, some schedules may be compact, but none should be vague.

---

## 6. Runtime Target Contract

Blueprints must say whether Codex should:

```txt
A. create a new location definition
B. modify an existing location definition
C. create an addendum only
D. create a field exterior landmark only
E. create an interior route connected to an existing exterior
```

For compiled locations, Codex should author data in:

```txt
src/game/locations/<locationId>.definition.js
```

The location definition should use the Dungeon Authoring Runtime concepts:

- rooms
- doors / connectors
- wall gaps
- blockers
- props
- spawns
- encounter zones
- exits
- lights / torch fixtures
- navigation
- integrity metadata

Do not hand-build full dungeon geometry directly in `DungeonScene.js` unless the existing runtime cannot support a small exceptional visual.

---

## 7. Key / Legend Standard

ASCII maps should use a clear key.

Recommended symbols:

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

ASCII maps are communication aids, not collision truth. Tables are the source of truth.

---

## 8. Route Graph Rules

Every location must include a route graph before construction schedules.

The route graph defines player logic:

```txt
R01 -> D01 -> R02
R02 -> D02 -> R03
R03 -> D03 -> R04
R03 -> D04 -> R05
R05 -> D05 -> R08
R12 -> D17 -> R14 -> D18 -> R02
```

Rules:

- Every listed room must be reachable unless explicitly marked future/sealed.
- Every door must list both connected spaces.
- Every exit must list destination area and destination spawn id.
- Shortcut doors must say whether they are open, locked, one-way, or opened from the far side.
- The route graph should match the room schedule and door schedule.

---

## 9. Room Schedule Rules

Every room needs a schedule row.

Required fields:

```txt
id
label
minX
maxX
minZ
maxZ
floorTexture
ceilingTexture
wallTexture
role
landmark
safeForSpawn
encounterWeight
```

Example:

```txt
| R03 | Broken Offering Room | -17 | 17 | -41 | -23 | floor | ceiling | wall | first combat room | broken offering slab | yes | 0.9 |
```

Rules:

- Room ids use `R01`, `R02`, `R03` order.
- Room ids should not change once runtime work begins unless necessary.
- Room labels should describe landmarks, not only function.
- Bounds must not be inverted.
- Connected rooms should touch or be connected by a connector space.
- Major combat rooms need enough footprint for mobile movement.

---

## 10. Door / Connector Rules

Every doorway needs a schedule row.

Required fields:

```txt
id
fromRoom
toRoom
position X/Z
width
state
wallGaps
navWaypoint
notes
```

Doorway states:

```txt
open
sealed
locked
one-way
future
shortcut
exit
```

Rules:

- Doorway positions must sit on shared room edges or on connector edges.
- Doorway width should be at least `3.4` units.
- Combat room entrances should be `4.2` to `5.0` units when possible.
- Every doorway must author wall gaps for every affected room edge.
- Do not create a visible opening without a matching door/connector/exits entry.
- Do not create a door schedule row without a matching room edge opening.

---

## 11. Floor Slab Rules

Floor z-fighting is prevented by strict slab ownership.

Rules:

- One room should own one primary floor slab.
- Corridors must stop at room edges.
- Room floor slabs must not overlap other room floor slabs.
- Corridor floor slabs must not overlap room floor slabs.
- Do not place two floor meshes at the same Y over the same footprint.
- Do not solve flicker by randomly raising floors.
- If a floor patch is decorative, place it slightly above floor and mark it as `floor_patch`, not as a second structural floor.

Required floor schedule fields:

```txt
id
roomId
centerX
centerZ
width
depth
floorY
material
structuralOrDecorative
notes
```

Decorative floor patches should use:

```txt
Y 0.025 to 0.05
kind: floor_patch
nonBlockingDecor metadata if needed
```

---

## 12. Wall / Edge Sealing Rules

This is the most important anti-missing-wall section.

Every normal room edge is sealed unless a declared opening exists.

Room edges:

```txt
NORTH = maxZ edge
SOUTH = minZ edge
WEST = minX edge
EAST = maxX edge
```

Rules:

- Closed edges must generate visible wall boxes and matching collision.
- Open edges must be declared by a doorway, exit, arch, passage, or connector.
- If an edge has a doorway, split the wall into wall boxes around the gap.
- Do not omit a wall because another room is nearby unless a doorway/connector declares it.
- Structural walls must be solid box geometry, not one-sided planes.
- Wall ids should include room and side, such as `R03_N`, `R03_S_W`, `R03_S_E`.

Wall schedule fields:

```txt
id
roomId
edge
state
openings
expectedWallSegments
material
collisionRequired
notes
```

Edge states:

```txt
sealed
opening
gate
exit
connector
futureBlocked
```

Example:

```txt
| R03_N | R03 | north | opening | D06 width 4.6 at X 0 | split left/right wall boxes | wall | yes | Main route to tavern |
```

---

## 13. Ceiling Rules

Ceilings follow floors but must avoid overlap.

Rules:

- One structural ceiling slab per room or connector.
- Ceiling slabs should match floor ownership.
- Do not overlap ceilings at the same Y.
- Ceiling decorative patches must not be mistaken for structural ceilings.
- Very tall spaces should declare height exceptions.

Ceiling schedule fields:

```txt
id
roomId
centerX
centerZ
width
depth
ceilingY
material
notes
```

---

## 14. Collision Truth Rules

Collision should match authored visible structure.

Rules:

- Visible structural props need blockers or `collisionRef`.
- Player blockers need visible support unless explicitly marked as boundary/safety/future/debug.
- Invisible collision is allowed only with an explicit purpose.
- Doorway blockers must not block declared door gaps.
- Low props should not create snag hazards on main route.
- Player spawn and return spawns must be outside blockers.
- Enemy spawns need wall clearance and player distance checks.

Blocker fields:

```txt
id
type
minX
maxX
minZ
maxZ
height
visibleSupportId
blocksPlayer
blocksEnemies
allowedInvisiblePurpose
notes
```

Use `collisionRef` on props whenever a prop has matching blocker collision.

---

## 15. Torch / Light Fixture Rules

Torches are authored fixtures, not random point lights.

Torch fixture fields:

```txt
id
roomId
wallSide
distanceAlongWall
height
profile
purpose
illuminates
notes
```

Wall side values:

```txt
north
south
east
west
```

Rules:

- Torches should mount to walls through the Torch Fixture runtime when possible.
- Do not place torches using naked world coordinates unless they are special freestanding lights.
- Torch placement must respect room bounds, wall side, and inset from corners.
- Torches should not sit inside wall collision.
- Torches should not float in open space unless marked freestanding.
- Every torch needs a purpose: route guidance, landmark illumination, enemy silhouette, gate visibility, or mood.

---

## 16. Props / Landmarks Rules

Props should identify rooms and shape movement.

Prop fields:

```txt
id
kind
roomId
position X/Y/Z
dimensions W/H/D
material
collisionRef
blockingMode
purpose
notes
```

Blocking modes:

```txt
solid
nonBlockingDecor
lowCover
futureGate
triggerOnly
```

Rules:

- Every major room needs a landmark.
- Props on critical routes should be large/readable, not tiny clutter.
- Props that affect movement must have matching collision.
- Decorative props with no collision should be listed in integrity exceptions if needed.
- Avoid prop clutter that makes mobile movement annoying.

---

## 17. Interaction / Exit Rules

Interaction fields:

```txt
id
type
roomId
position X/Y/Z
range
targetId
result
destinationArea
destinationSpawnId
messageId or text
notes
```

Rules:

- Interaction range should be forgiving on mobile.
- Exit interactions must never strand the player.
- Destination spawn id must exist.
- Exit spawn must be clear of collision.
- Inspect-only future gates must not load a new area.
- Equipment pickups should use the Equipment Runtime, not one-off inventory hacks.
- Objective triggers should use the Objective Runtime, preferably silently unless HUD feedback is desired.

---

## 18. Enemy / NPC Spawn Rules

Spawn fields:

```txt
id
kind
species
faction
roomId
position X/Y/Z
yaw
allowedForInitialWave
allowedForRespawn
minDistanceFromPlayer
patrolPoints
encounterZoneId
notes
```

Rules:

- Do not spawn enemies directly behind player starts.
- Spawns must not overlap blockers.
- Spawns should have room to move.
- Initial active spawn count should be mobile-safe.
- Spawn markers may exist even when only a subset is active.
- Creature assets should use the Creature Actor System.
- Do not require new animation states unless approved.

---

## 19. Encounter Zone Rules

Encounter zones define combat pacing and room ownership.

Fields:

```txt
id
roomIds
centerX
centerZ
radius or bounds
maxActiveEnemies
factionRules
respawnPolicy
notes
```

Rules:

- Major combat rooms can have higher max active counts.
- Narrow connectors should not host too many enemies.
- Faction-war encounters should prefer room-based anchors and nav graph paths.
- Respawn policies should avoid appearing directly in player view unless intended.

---

## 20. Material Rules

Blueprints should name material intent using existing texture profiles when possible.

Current texture kit:

```txt
wall_black_stone_01.png
floor_worn_stone_01.png
ceiling_dark_stone_01.png
metal_gate_rusted_01.png
field_dead_grass_01.png
```

Material profile names should match runtime definitions when possible:

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

Rules:

- Do not request new textures unless the user approves an asset pass.
- Black grass interiors can use the existing field grass texture with dark tint.
- Material naming should be consistent between docs and runtime definition.

---

## 21. Validation Requirements

Every implementation PR for a compiled location should run:

```sh
npm run build
npm run validate:dungeons
```

For Black Grass Temple work, also run:

```sh
npm run validate:bgt
npm run validate:integrity
```

Codex must report:

- commands run
- pass/fail status
- validation warnings
- known remaining issues

Warnings may be acceptable only if explained and intentional.

Errors are not acceptable unless the user explicitly says to merge a broken prototype.

---

## 22. Anti-Fuckboi Geometry Checks

Before calling a location done, verify:

- no missing perimeter walls
- no accidental see-through holes
- no floor z-fighting
- no ceiling z-fighting
- no overlapping structural floor slabs
- no overlapping structural ceiling slabs
- no one-sided wall planes for structural walls
- no torch inside wall collision
- no torch floating unless marked freestanding
- no invisible blocker without visible support or purpose
- no doorway blocked by collision
- no player spawn inside collision
- no return spawn inside collision
- no enemy spawn inside collision
- every route-graph room is reachable
- every declared doorway has a matching wall gap
- every visible gate has collision or an explicit non-blocking reason
- every exit has a valid destination
- every future door is inspect-only unless a destination exists

---

## 23. Codex Prompt Rule

When asking Codex to implement a location, always include:

```txt
Read docs/world/ARCHITECTURE_BLUEPRINT_STANDARD.md first.
Use the location blueprint as the source of truth.
Implement through src/game/locations/<locationId>.definition.js when possible.
Do not hand-build major dungeon geometry in DungeonScene.js.
Run npm run build and npm run validate:dungeons.
Report remaining validation warnings.
```

For Black Grass Temple:

```txt
Also run npm run validate:bgt and npm run validate:integrity.
```

---

## 24. Future Upgrade

If Markdown blueprints become too loose, add a JSON sidecar later:

```txt
docs/world/<category>/<location_id>_construction_blueprint.json
```

For now, Markdown with strict construction tables is the required source format.
