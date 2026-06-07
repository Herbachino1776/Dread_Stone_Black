# LOCATION BLUEPRINT - South Reliquary Crypt Baby Labyrinth v01

Version: v0.1  
Document path: `docs/world/crypts/south_reliquary_crypt_baby_labyrinth_v01.md`  
Parent field document: `docs/world/overworld/reliquary_field_v01.md`  
Connected overworld entrance: South Reliquary Crypt / C01  
Lane: Game World Architect  
Implementation owner: Codex after Producer/Dev Lead approval

---

## 1. Purpose

South Reliquary Crypt is the first compact underground baby labyrinth connected to Reliquary Field.

It should prove the field-to-interior loop:

```txt
Reliquary Field -> South Reliquary Crypt exterior -> baby labyrinth -> guardian chamber / reliquary alcove -> return path -> field
```

This is not a huge dungeon. It is a tight first interior under the tomb-field: readable, dangerous-feeling, and buildable with current stone textures.

Gameplay role:

- teach entering a crypt from the field
- give the player a short interior route with one branch and one loop
- stage the first underground guardian chamber
- create a clear return path to the field
- avoid requiring new assets or new animation states

---

## 2. Scale

- Interior bounds: `72 x 70` units
- X range: `-36` to `36`
- Z range: `-34` to `36`
- Ground/floor Y: `0`
- Ceiling height: `3.2` units
- Player start: `X 0, Y 1.55, Z -30`
- Initial facing: north / positive Z
- Primary exit: `X 0, Y 1.2, Z -32`
- Intended playtime: 3-6 minutes
- Mobile performance notes: simple box rooms, flat floors, no dense props, no procedural geometry

Design size category:

```txt
Baby labyrinth: compact. 5 rooms, 1 loop, 1 guardian chamber, 1 return route.
```

---

## 3. Coordinate System

- X axis: west/east
  - Negative X = west
  - Positive X = east
- Z axis: south/north
  - Negative Z = entrance / field side
  - Positive Z = deeper crypt
- Y axis: vertical height
  - Y 0 = floor level
- Origin: central split hall near `X 0, Z -12`

Recommended implementation note:

```txt
Use local crypt coordinates for this interior. Do not place this geometry physically under the field yet unless the current scene system supports it cleanly. Loading or switching to an interior area is acceptable for v0.1.
```

---

## 4. ASCII Map

Legend:

```txt
P = player start / field return
E = exit back to field
G = gate / grate
L = lever or future unlock point
R = guardian chamber / Ram Man candidate
A = reliquary alcove / reward hook
S = side chamber / shrine slab
# = wall / solid stone
. = walkable floor
+ = shortcut / loop connection
```

Top-down map, not to exact tile scale:

```txt
Z +36

              ###########
              #....A....#
              #.........#
      #########.........#########
      #.........................#
      #.............R...........#
      #.........................#
      #######.....#####.....#####
            #.....#   #.....#
            #.....#   #.....#
      #######.....#   #.....#######
      #.....+.....#   #.....+.....#
      #.....#.....#   #.....#.....#
      #..S..#.....#####.....#..L..#
      #.....#...............#.....#
      ###########.....#############
                #.....#
                #.....#
          #######.....#######
          #.................#
          #.....split.......#
          #.................#
          #######.....#######
                #.....#
                #.....#
                #.....#
                #..P/E#
                #######

Z -34              X -36          X +36
```

Route summary:

```txt
P/E Entry Stair
  -> R01 Entry Corridor
  -> R02 Split Hall
     -> west side chamber S
     -> east lever / sealed-grate side chamber L
  -> R05 Guardian Chamber R
  -> R06 Reliquary Alcove A
  -> east/west loop returns toward split hall
  -> back to P/E exit
```

---

## 5. Room / Zone Table

| ID | Type | Center Position | Footprint | Height | Material | Notes |
|---|---|---|---|---:|---|---|
| R01 | entry corridor | X 0, Z -25 | W 8, D 18 | 3.2 | stone kit | Connects field entrance to split hall |
| R02 | split hall | X 0, Z -12 | W 22, D 12 | 3.2 | stone kit | First decision point; should be readable on mobile |
| R03 | west side chamber | X -22, Z -8 | W 16, D 16 | 3.2 | stone kit | Optional shrine slab / dead-end clue chamber |
| R04 | east lever chamber | X 22, Z -8 | W 16, D 16 | 3.2 | stone kit | Future lever/lock point; can be inspect-only in first pass |
| R05 | guardian chamber | X 0, Z 14 | W 30, D 24 | 3.2 | stone kit | Main danger room; wide enough for mobile movement |
| R06 | reliquary alcove | X 0, Z 30 | W 14, D 10 | 3.2 | stone kit | Reward/progression hook; no full inventory system required |
| C01 | west loop corridor | X -18, Z 8 | W 8, D 24 | 3.2 | stone kit | Connects west side chamber to guardian room |
| C02 | east loop corridor | X 18, Z 8 | W 8, D 24 | 3.2 | stone kit | Connects east chamber to guardian room |

---

## 6. Structural Table

Implementation can use a helper that creates each room from floor, ceiling, and perimeter walls with doorway gaps. Exact wall segments below define the intended navigable layout.

| ID | Type | Position | Size | Material | Collision | Notes |
|---|---|---|---|---|---|---|
| FLOOR01 | floor | X 0, Y -0.09, Z -25 | W 8, H 0.18, D 18 | `floor_worn_stone_01` | walkable | Entry corridor |
| FLOOR02 | floor | X 0, Y -0.09, Z -12 | W 22, H 0.18, D 12 | `floor_worn_stone_01` | walkable | Split hall |
| FLOOR03 | floor | X -22, Y -0.09, Z -8 | W 16, H 0.18, D 16 | `floor_worn_stone_01` | walkable | West side chamber |
| FLOOR04 | floor | X 22, Y -0.09, Z -8 | W 16, H 0.18, D 16 | `floor_worn_stone_01` | walkable | East lever chamber |
| FLOOR05 | floor | X 0, Y -0.09, Z 14 | W 30, H 0.18, D 24 | `floor_worn_stone_01` | walkable | Guardian chamber |
| FLOOR06 | floor | X 0, Y -0.09, Z 30 | W 14, H 0.18, D 10 | `floor_worn_stone_01` | walkable | Reliquary alcove |
| FLOOR07 | floor | X -18, Y -0.09, Z 8 | W 8, H 0.18, D 24 | `floor_worn_stone_01` | walkable | West loop corridor |
| FLOOR08 | floor | X 18, Y -0.09, Z 8 | W 8, H 0.18, D 24 | `floor_worn_stone_01` | walkable | East loop corridor |
| CEIL_ALL | ceilings | same centers as floors | same W/D, H 0.18 | `ceiling_dark_stone_01` | none | One ceiling plane per room/corridor at Y 3.2 |
| WALL_PERIM | perimeter walls | around each room/corridor | H 3.2, thickness 0.35 | `wall_black_stone_01` | solid | Leave doorway gaps per doorway table |
| GATE01 | rusted grate | X 11, Y 1.45, Z -8 | W 0.35, H 2.7, D 5.5 | `metal_gate_rusted_01` | solid if closed | Optional: separates split hall from east chamber |
| SLAB01 | west shrine slab | X -22, Y 1.6, Z -14.5 | W 7, H 3.2, D 0.45 | `wall_black_stone_01` | solid | Side-chamber landmark |
| RELIC01 | reliquary block | X 0, Y 0.75, Z 32 | W 5, H 1.5, D 2 | `wall_black_stone_01` or `floor_worn_stone_01` | solid | Placeholder reward object; no new asset required |

---

## 7. Doorway / Connection Table

Doorways should be wide enough for mobile movement. Recommended minimum clear width: `3.0` units.

| ID | Connects | Center | Clear Width | Notes |
|---|---|---|---:|---|
| D01 | Field exit / R01 | X 0, Z -32 | 4.0 | Exit trigger back to Reliquary Field |
| D02 | R01 / R02 | X 0, Z -18 | 4.0 | Straight entry into split hall |
| D03 | R02 / R03 | X -11, Z -10 | 3.6 | West branch into side chamber |
| D04 | R02 / R04 | X 11, Z -10 | 3.6 | East branch; may be gated by GATE01 |
| D05 | R02 / R05 | X 0, Z -2 | 4.4 | Main route into guardian chamber |
| D06 | R03 / C01 | X -18, Z 0 | 3.6 | West loop start |
| D07 | C01 / R05 | X -12, Z 8 | 3.6 | West loop into guardian chamber |
| D08 | R04 / C02 | X 18, Z 0 | 3.6 | East loop start |
| D09 | C02 / R05 | X 12, Z 8 | 3.6 | East loop into guardian chamber |
| D10 | R05 / R06 | X 0, Z 25 | 4.0 | Guardian chamber to reliquary alcove |

---

## 8. Material Plan

Use only current assets.

Walls:

```txt
public/assets/textures/wall_black_stone_01.png
```

Floors:

```txt
public/assets/textures/floor_worn_stone_01.png
```

Ceilings:

```txt
public/assets/textures/ceiling_dark_stone_01.png
```

Metal / gates:

```txt
public/assets/textures/metal_gate_rusted_01.png
```

Texture repeat notes:

- Floor rooms: repeat based on room size, roughly 1 repeat per 3-4 units.
- Corridor floors: stretch less; use repeated texture, not one giant stretched tile.
- Wall height is low enough for mobile readability but should still feel oppressive.
- Keep material tint close to existing dungeon palette.

No new texture assets are required.

---

## 9. Interaction Plan

| ID | Interaction | Position | Trigger Range | Result | Notes |
|---|---|---|---:|---|---|
| INT01 | exit to Reliquary Field | X 0, Y 1.2, Z -32 | 3.5 units | return to `?area=field&from=dungeon` or equivalent field return | Must be reliable on mobile |
| INT02 | inspect west shrine slab | X -22, Y 1.2, Z -14 | 3.0 units | show short message | Optional, non-blocking |
| INT03 | test east grate | X 11, Y 1.2, Z -8 | 3.0 units | sealed or opens if simple lever exists | Do not require inventory system |
| INT04 | inspect reliquary block | X 0, Y 1.2, Z 32 | 3.0 units | show reward/progression text or set simple flag | No full inventory required |

Suggested placeholder text:

```txt
INT01: "Cold field air seeps down the stair."
INT02: "The slab is carved with a door that was never meant to open."
INT03: "The rusted grate gives a little, then holds."
INT04: "Something black sleeps inside the stone."
```

The Loremaster lane can replace text later.

---

## 10. Creature / NPC Plan

Current animation rule:

- idle
- walk

Do not require attack, hurt, death, stagger, or special animation states.

| ID | Creature | Position | Behavior | Required? | Notes |
|---|---|---|---|---|---|
| NPC01 | Ram Man or current proven GLB guardian | X 0, Y 0, Z 14 | idle or short patrol | optional for first implementation | Use only existing idle/walk GLB pipeline if stable |

Suggested patrol points:

```txt
P1: X -7, Z 10
P2: X 7, Z 10
P3: X 5, Z 19
P4: X -5, Z 19
```

Implementation rule:

```txt
If adding the guardian risks breaking current dungeon flow, skip the creature for the first PR and build only the chamber staging.
```

---

## 11. Lighting / Fog

Indoor lighting goal:

- readable but oppressive
- warmer than the outdoor field
- not pitch-black on iPhone
- corridor edges visible enough to avoid mobile frustration

Recommended first pass:

```txt
Ambient / hemisphere fill: low warm gray
Entry corridor: weak warm point light near X 0, Z -27
Split hall: weak fill at X 0, Z -12
Guardian chamber: stronger but dirty warm light at X 0, Z 14
Reliquary alcove: dim cold light or subtle emissive tint near X 0, Z 32
Fog: indoor fog, near 8-10, far 34-42
```

Readability notes:

- Doorways must be visible from the center of each room.
- The guardian chamber should read as a larger space immediately after the split hall.
- The reliquary alcove should be visible beyond the guardian chamber but not bright.

---

## 12. Collision / Navigation Notes

Collision should be rectangular and simple.

Recommended walkable rectangles:

```txt
R01: minX -4, maxX 4, minZ -34, maxZ -16
R02: minX -11, maxX 11, minZ -18, maxZ -6
R03: minX -30, maxX -14, minZ -16, maxZ 0
R04: minX 14, maxX 30, minZ -16, maxZ 0
R05: minX -15, maxX 15, minZ 2, maxZ 26
R06: minX -7, maxX 7, minZ 25, maxZ 35
C01: minX -22, maxX -14, minZ -2, maxZ 20
C02: minX 14, maxX 22, minZ -2, maxZ 20
```

Blockers:

- perimeter walls
- GATE01 if implemented as closed
- shrine slab
- reliquary block

Avoid:

- narrow 1-unit collision passages
- angled collision for v0.1
- tiny props at floor level
- maze complexity beyond this map

---

## 13. Codex Implementation Notes

Codex should build:

```txt
1. Add this interior as the target for South Reliquary Crypt / C01.
2. Use the existing scene switching or area query system if present.
3. Build the 72 x 70 unit baby labyrinth with simple box geometry.
4. Use existing dungeon textures only.
5. Implement floors, ceilings, perimeter walls, and doorway gaps.
6. Add exit trigger back to Reliquary Field.
7. Add optional inspect triggers for shrine slab, east grate, and reliquary block.
8. Keep the guardian chamber staged even if no creature is added yet.
9. Keep mobile controls, HUD, FPV arms, combat code, and deployment config working.
10. Run npm run build before final response.
```

Codex should not build:

```txt
- a huge dungeon
- procedural maze generation
- new assets
- new animation states beyond idle/walk
- attack/hurt/death animation requirements
- new inventory system
- minimap
- quest log
- deployment config changes
```

Recommended PR title:

```txt
Implement South Reliquary Crypt baby labyrinth v0.1
```

---

## 14. QA Checklist

Build QA:

- [ ] `npm run build` passes.
- [ ] No deployment config changed.
- [ ] No missing texture paths.
- [ ] No missing GLB errors if guardian is skipped.

Field-to-interior QA:

- [ ] South Reliquary Crypt entrance from Reliquary Field loads this interior.
- [ ] Player spawns at `X 0, Y 1.55, Z -30` facing inward.
- [ ] Exit trigger returns to Reliquary Field.
- [ ] Field return position is not inside collision.

Interior navigation QA:

- [ ] Player can reach split hall.
- [ ] Player can enter west side chamber.
- [ ] Player can enter or inspect east grate route depending on implementation scope.
- [ ] Player can reach guardian chamber.
- [ ] Player can reach reliquary alcove.
- [ ] Player can return to entrance without getting stuck.
- [ ] No wall clipping or collision snagging at doorways.

Mobile QA:

- [ ] Doorways feel wide enough for touch movement.
- [ ] HUD does not block prompts.
- [ ] Interact range feels forgiving.
- [ ] Lighting is readable on iPhone portrait.
- [ ] Frame rate remains playable.

Design QA:

- [ ] This feels like a compact baby labyrinth, not a giant dungeon.
- [ ] The split hall creates one meaningful choice.
- [ ] The loop gives the chamber layout spatial value.
- [ ] The guardian chamber is clearly the main room.
- [ ] The reliquary alcove reads as a reward/progression hook.

---

## 15. Future Addendum Targets

Likely next addendums:

```txt
docs/world/addendums/south_reliquary_crypt_addendum_001_guardian_behavior.md
docs/world/addendums/south_reliquary_crypt_addendum_002_reliquary_reward.md
docs/world/addendums/south_reliquary_crypt_addendum_003_shortcut_gate_logic.md
```

Do not add these until the base labyrinth is implemented and playtested.
