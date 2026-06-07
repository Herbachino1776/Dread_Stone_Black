# LOCATION BLUEPRINT - Reliquary Field v01

Version: v0.1  
Document path: `docs/world/overworld/reliquary_field_v01.md`  
Lane: Game World Architect  
Implementation owner: Codex after Producer/Dev Lead approval

---

## 1. Purpose

Reliquary Field is the first outdoor tomb-field zone for **Dread Stone Black**.

It establishes the world direction: a large dead field scattered with crypt entrances, stone tomb structures, readable fog silhouettes, and small underground labyrinths.

The full design target is an **800 x 800** field. The first implementation target is a **400 x 400** playable slice centered around the starting approach and three major landmarks.

This is not a full open-world system. It is a controlled field hub that can be expanded through addendums.

---

## 2. Scale

### 2.1 Full Long-Term Bounds

- Full field bounds: `800 x 800` units
- X range: `-400` to `400`
- Z range: `-400` to `400`
- Y ground level: `0`
- Intended long-term playtime: 15-25 minutes of cautious exploration before all sub-entrances are understood

### 2.2 First Implemented Slice

- First playable bounds: `400 x 400` units
- X range: `-200` to `200`
- Z range: `-200` to `200`
- Player start: `X 0, Y 0, Z -175`
- Initial facing: north toward `Z 0`
- Intended first-slice playtime: 5-8 minutes

### 2.3 Mobile Performance Notes

- Use a single terrain plane for the first 400 x 400 slice.
- Use repeated texture mapping for dead grass; do not create individual grass blades.
- Use simple box geometry for crypt shells, walls, standing stones, and low ruins.
- Keep first-slice animated creature count low: 0-2 active creatures maximum.
- Avoid dense prop fields.
- Use fog to hide full-field edges and reduce draw pressure.

---

## 3. Coordinate System

- X axis: west/east
  - Negative X = west
  - Positive X = east
- Z axis: south/north
  - Negative Z = south
  - Positive Z = north
- Y axis: vertical height
  - Y 0 = field ground
- Important origin point: central broken shrine at `X 0, Z 0`
- Player start: south approach at `X 0, Z -175`
- First slice boundary: square invisible boundary from `-200` to `200` on X and Z

Scale assumption:

```txt
1 world unit roughly equals 1 meter of readable player space.
```

---

## 4. Full 800 x 800 Field Plan

The full field should eventually read as a dead plain with multiple tomb entrances arranged around a central ruined shrine.

### 4.1 Full Field ASCII Map

Legend:

```txt
P = first-slice player start
C = crypt / tomb entrance
S = shrine / major landmark
G = gate / sealed threshold
B = blocked edge / boundary landmark
R = Ram Man / guardian candidate
. = open dead field
# = stone ruin mass
```

Full 800 x 800 conceptual map:

```txt
Z +400

      B................................................B
      ..................................................
      ............C04 North Wall Crypt..................
      .................#######..........................
      ..................................................
      ....C05 West Low Crypt..............C06 East Scar..
      ......###..............................###.........
      ..................................................
      ....................G02 Bone Gate..................
      .......................###........................
      ..................................................
      ...............C03 Sunken Central Tomb.............
      ......................#####.......................
      ..................................................
      .........C02 Black Grass Temple.....C07 Broken Well
      ..............#####.....................##.........
      ..................................................
      .....................S01 Broken Shrine.............
      ......................###.........................
      ..................................................
      ........C01 South Reliquary Crypt..................
      ..............####.................................
      ..................................................
      ......................P............................
      B................................................B

Z -400                X -400                X +400
```

### 4.2 Full Field Landmark List

| ID | Landmark | Position | Long-Term Role | First Slice? |
|---|---|---|---|---|
| S01 | Broken Shrine | X 0, Z 0 | Central orientation landmark | Yes |
| C01 | South Reliquary Crypt | X -60, Z -95 | First baby labyrinth entrance | Yes |
| C02 | Black Grass Temple | X -210, Z 55 | Larger temple route, later | Partial silhouette only if beyond slice |
| C03 | Sunken Central Tomb | X 35, Z 140 | Guardian chamber / main descent | Yes, exterior shell only |
| C04 | North Wall Crypt | X -40, Z 310 | Northern boundary crypt | No |
| C05 | West Low Crypt | X -310, Z 130 | Side crypt / shortcut field loop | No |
| C06 | East Scar Crypt | X 300, Z 105 | Later dangerous region | No |
| C07 | Broken Well | X 220, Z -15 | Later vertical descent | No |
| G02 | Bone Gate | X 20, Z 225 | Future locked northern threshold | No |

---

## 5. First 400 x 400 Playable Slice

The first slice should feel open but controlled. It gives the player three readable goals:

1. **Broken Shrine** at the center.
2. **South Reliquary Crypt** as the first clear entrance.
3. **Sunken Central Tomb shell** as a distant locked or inactive structure.

The player should see at least one stone silhouette from the start.

### 5.1 First Slice ASCII Map

```txt
Z +200

      B############################################B
      #............................................#
      #................C03.........................#
      #...............#####........................#
      #.................G..........................#
      #............................................#
      #............................................#
      #..................S01.......................#
      #.................###........................#
      #............................................#
      #............................................#
      #.........C01................................#
      #........####.....................Standing...#
      #.........E.......................Stones.....#
      #...................................###......#
      #............................................#
      #..................P.........................#
      #............................................#
      B############################################B

Z -200              X -200                 X +200
```

### 5.2 First Slice Route Intent

Primary route:

```txt
Player Start -> Broken Shrine -> South Reliquary Crypt -> Crypt Interior Hook
```

Optional curiosity route:

```txt
Player Start -> Standing Stones -> Sunken Central Tomb exterior gate -> return to shrine
```

First slice should not require a minimap. The shrine should act as the main reorientation marker.

---

## 6. Structural Table - First Slice

| ID | Type | Position | Size | Material | Collision | Notes |
|---|---|---|---|---|---|---|
| TERRAIN01 | ground plane | X 0, Y 0, Z 0 | W 400, H 0.1, D 400 | `field_dead_grass_01` | walkable | Texture repeat approx 50 x 50 |
| BOUND01 | invisible boundary north | X 0, Y 1.5, Z 200 | W 400, H 3, D 2 | none | solid | Temporary slice edge |
| BOUND02 | invisible boundary south | X 0, Y 1.5, Z -200 | W 400, H 3, D 2 | none | solid | Temporary slice edge |
| BOUND03 | invisible boundary west | X -200, Y 1.5, Z 0 | W 2, H 3, D 400 | none | solid | Temporary slice edge |
| BOUND04 | invisible boundary east | X 200, Y 1.5, Z 0 | W 2, H 3, D 400 | none | solid | Temporary slice edge |
| S01_A | broken shrine base | X 0, Y 0.25, Z 0 | W 18, H 0.5, D 18 | `floor_worn_stone_01` | solid low | Low square platform |
| S01_B | shrine rear slab | X 0, Y 3, Z 5 | W 12, H 6, D 1.5 | `wall_black_stone_01` | solid | Main silhouette visible from south |
| S01_C | shrine left broken pillar | X -7, Y 2.5, Z 0 | W 2, H 5, D 2 | `wall_black_stone_01` | solid | Broken vertical marker |
| S01_D | shrine right broken pillar | X 7, Y 1.75, Z -1 | W 2, H 3.5, D 2 | `wall_black_stone_01` | solid | Lower asymmetric pillar |
| C01_A | crypt platform | X -60, Y 0.25, Z -95 | W 28, H 0.5, D 24 | `floor_worn_stone_01` | solid low | Approach pad |
| C01_B | crypt left wall | X -72, Y 3, Z -95 | W 3, H 6, D 22 | `wall_black_stone_01` | solid | Entrance frame left |
| C01_C | crypt right wall | X -48, Y 3, Z -95 | W 3, H 6, D 22 | `wall_black_stone_01` | solid | Entrance frame right |
| C01_D | crypt rear wall | X -60, Y 3, Z -84 | W 27, H 6, D 3 | `wall_black_stone_01` | solid | Back mass around entrance opening |
| C01_E | crypt lintel | X -60, Y 6.5, Z -95 | W 28, H 2, D 5 | `wall_black_stone_01` | solid | Heavy top silhouette |
| C01_F | crypt entrance trigger volume | X -60, Y 1, Z -107 | W 10, H 3, D 6 | none | trigger | Enter South Reliquary baby labyrinth |
| C01_G | dark entrance plane | X -60, Y 2.25, Z -106 | W 10, H 4.5, D 0.2 | dark unlit material or existing black material | non-solid visual | Placeholder void; no new texture required |
| C03_A | sunken tomb platform | X 35, Y 0.2, Z 140 | W 36, H 0.4, D 28 | `floor_worn_stone_01` | solid low | Future tomb approach |
| C03_B | sunken tomb rear wall | X 35, Y 4, Z 152 | W 34, H 8, D 4 | `wall_black_stone_01` | solid | Large distant silhouette |
| C03_C | sealed gate | X 35, Y 2.5, Z 128 | W 12, H 5, D 1 | `metal_gate_rusted_01` | solid | Non-enterable in first slice |
| C03_D | left tomb block | X 17, Y 2.5, Z 140 | W 4, H 5, D 24 | `wall_black_stone_01` | solid | Side mass |
| C03_E | right tomb block | X 53, Y 2.5, Z 140 | W 4, H 5, D 24 | `wall_black_stone_01` | solid | Side mass |
| STONE01 | standing stone cluster A | X 115, Y 2.5, Z -70 | W 3, H 5, D 2 | `wall_black_stone_01` | solid | Readable side landmark |
| STONE02 | standing stone cluster B | X 122, Y 1.75, Z -64 | W 2, H 3.5, D 2 | `wall_black_stone_01` | solid | Offset stone |
| STONE03 | standing stone cluster C | X 108, Y 1.25, Z -58 | W 2, H 2.5, D 2 | `wall_black_stone_01` | solid | Low stone |
| RUIN01 | low ruin wall west | X -130, Y 1, Z 20 | W 28, H 2, D 3 | `wall_black_stone_01` | solid | Optional cover/route texture test |
| RUIN02 | low ruin wall east | X 85, Y 1, Z 55 | W 24, H 2, D 3 | `wall_black_stone_01` | solid | Not progression critical |

---

## 7. Material Plan

### 7.1 Ground

Use:

```txt
public/assets/textures/outdoor/field_dead_grass_01.png
```

Application:

- Apply to `TERRAIN01`.
- Repeat approximately `50 x 50` across 400 x 400 units.
- Texture should not stretch across the entire plane.

### 7.2 Exterior Stone Structures

Use:

```txt
public/assets/textures/wall_black_stone_01.png
```

Application:

- crypt walls
- shrine slab
- standing stones
- ruin walls
- tomb shell blocks

### 7.3 Stone Platforms

Use:

```txt
public/assets/textures/floor_worn_stone_01.png
```

Application:

- shrine base
- crypt approach pads
- tomb platforms

### 7.4 Metal Gates

Use:

```txt
public/assets/textures/metal_gate_rusted_01.png
```

Application:

- sealed gate on Sunken Central Tomb
- future barred doors

### 7.5 New Assets Required

None required for v0.1.

Optional later assets:

- unique crypt entrance black void texture
- tomb-specific trim texture
- dead tree silhouettes
- stone inscription decals

Do not require these in the first implementation.

---

## 8. Interaction Plan

| ID | Interaction | Position | Trigger Range | Result | Notes |
|---|---|---|---:|---|---|
| INT01 | enter South Reliquary Crypt | X -60, Y 1, Z -107 | 4 units | load/teleport to placeholder interior or show debug transition message | First real baby labyrinth hook |
| INT02 | inspect sealed Sunken Central Tomb gate | X 35, Y 1, Z 124 | 4 units | show short locked/sealed message | No new key system required yet |
| INT03 | inspect Broken Shrine | X 0, Y 1, Z -8 | 4 units | show short world-text message | Optional, non-blocking |

Suggested temporary text:

```txt
INT01: "The crypt air moves inward."
INT02: "The rusted gate will not yield."
INT03: "The stone is warm where the sun has not touched it."
```

The text can be replaced later by the Loremaster lane.

---

## 9. Creature / NPC Plan

Current animation rule:

- idle
- walk

Do not require attack, hurt, death, stagger, or special creature animations.

### 9.1 First Slice Creature Budget

Maximum active animated creatures in first slice: 2.

Recommended v0.1 implementation:

| ID | Creature | Asset Pattern | Position | Behavior | Notes |
|---|---|---|---|---|---|
| NPC01 | Ram Man or current proven GLB creature | existing `idle` + `walk` pattern | X -95, Y 0, Z -45 | slow idle/patrol loop between 2-3 points | Optional. Use only if current Ram Man integration is stable outdoors. |

Patrol suggestion:

```txt
Point A: X -95, Z -45
Point B: X -120, Z -20
Point C: X -85, Z 5
```

Behavior should be non-complex for v0.1:

- idle when far from player
- walk along short patrol
- no attack requirement
- no chase requirement unless already implemented and stable

---

## 10. Lighting / Fog

### 10.1 Outdoor Lighting

Goal:

A readable sunrise field, not a pitch-black outdoor void.

Recommended intent:

- low warm directional light from east/southeast
- dim ambient light so stone silhouettes remain readable
- field should feel hostile but navigable
- crypt entrances should be legible from 25-50 units away
- central shrine silhouette should be visible from the player start through fog

### 10.2 Fog

Fog should make the 400 x 400 slice feel larger without hiding all navigation.

Recommended first pass:

```txt
Fog near: 35-50 units
Fog far: 160-220 units
```

Adjust based on actual camera FOV and mobile screen readability.

### 10.3 Landmark Visibility Requirements

From player start at `X 0, Z -175`:

- Broken Shrine rear slab at `X 0, Z 5` should be faintly visible by silhouette.
- South Reliquary Crypt at `X -60, Z -95` should become obvious after moving 30-45 units north.
- Sunken Central Tomb at `X 35, Z 140` may be barely visible at first, then clearer near the shrine.

---

## 11. Collision / Navigation Notes

### 11.1 Boundaries

For the first slice, use invisible solid boundaries at:

```txt
X -200
X 200
Z -200
Z 200
```

The boundaries are temporary. Hide them with fog and rough field distance.

### 11.2 Solid Structures

All crypt walls, shrine slabs, tomb walls, gates, and standing stones should be solid.

Low platforms may be either:

- walkable if step height is supported, or
- very low solid lips that do not trap the player

Do not create collision seams that snag mobile movement.

### 11.3 Entrance Trigger

The South Reliquary Crypt trigger should be generous.

Recommended:

```txt
center: X -60, Y 1, Z -107
size: W 10, H 3, D 6
activation: player inside volume or within 4 units
```

### 11.4 Route Widths

Outdoor walking routes should usually remain at least `8-12` units wide between collision objects.

Do not create narrow maze corridors outdoors in this first slice.

---

## 12. Baby Labyrinth Hooks

This document only defines entrances. It does not fully define interiors.

### 12.1 C01 - South Reliquary Crypt

Future interior file:

```txt
docs/world/crypts/south_reliquary_crypt_baby_labyrinth_v01.md
```

Recommended future size:

```txt
60 x 60 units
3-5 rooms
1 loop shortcut
1 guardian chamber
1 return path
```

### 12.2 C03 - Sunken Central Tomb

Future interior file:

```txt
docs/world/crypts/sunken_central_tomb_v01.md
```

Status in first slice:

- exterior shell only
- sealed gate interaction only
- no interior loading yet

---

## 13. Implementation Phasing

### Phase 1 - Field Shell

Codex should build:

- 400 x 400 terrain plane
- dead grass material repeat
- fog and sunrise lighting pass
- invisible slice boundaries
- player spawn at `X 0, Z -175`

Do not build:

- full 800 x 800 field
- new assets
- minimap
- procedural terrain

### Phase 2 - Structures

Codex should build:

- Broken Shrine
- South Reliquary Crypt exterior
- Sunken Central Tomb exterior shell
- Standing Stone cluster
- two low ruin walls

Do not build:

- interior labyrinths yet, except optional placeholder transition hook
- new creature systems

### Phase 3 - Interactions

Codex should build:

- South Reliquary Crypt entrance trigger
- Sealed gate inspect trigger
- Broken Shrine inspect trigger
- simple on-screen text prompts compatible with mobile HUD

Do not build:

- full quest system
- inventory/key dependency
- cutscenes

### Phase 4 - Optional Creature Pass

Codex may build only if the current outdoor GLB creature pipeline is stable:

- 1 Ram Man or proven GLB creature with idle/walk
- simple patrol route

Do not build:

- attack animations
- death animations
- complex combat encounter scripting

---

## 14. Codex Implementation Notes

Codex should build this as a PR-sized world architecture pass.

Required build goals:

```txt
1. Create or update the outdoor field scene to support a 400 x 400 Reliquary Field slice.
2. Use the existing dead grass texture for terrain.
3. Use existing dungeon textures for exterior stone tomb geometry.
4. Place structures at the coordinates listed in the structural table.
5. Add simple collision to all solid structures.
6. Add invisible boundaries at the edge of the first slice.
7. Add simple interaction volumes for C01, C03 gate, and S01 shrine.
8. Keep mobile controls working.
9. Keep current FPV arm/HUD systems working.
10. Run npm run build before final response.
```

Codex should not build:

```txt
- full 800 x 800 field in this PR
- new framework
- deployment config changes
- new animation states beyond idle/walk
- new asset pipeline
- procedural world generation
- minimap
- complex quest system
- large interior dungeon
```

Systems that must remain working:

```txt
- Vite base path: /Dread_Stone_Black/
- GitHub Pages deployment workflow
- mobile dual-stick controls
- vertical look
- existing FPV arm strip
- existing indoor/dungeon prototype access if present
- npm run build
```

---

## 15. QA Checklist

### 15.1 Build QA

- [ ] `npm run build` passes.
- [ ] No deployment config was changed.
- [ ] No missing texture paths in console.
- [ ] No missing GLB paths if optional creature is not used.

### 15.2 Desktop QA

- [ ] Player spawns at `X 0, Z -175`.
- [ ] Shrine is visible ahead or becomes visible quickly through fog.
- [ ] Player cannot leave the 400 x 400 slice.
- [ ] Player cannot walk through crypt walls, shrine slabs, tomb walls, or sealed gate.
- [ ] C01 entrance trigger fires only near the crypt mouth.
- [ ] C03 sealed gate gives a non-blocking message.
- [ ] No console errors during movement.

### 15.3 Mobile QA

- [ ] iPhone portrait loads the scene.
- [ ] Dual sticks remain usable.
- [ ] HUD does not block interaction prompts.
- [ ] Vertical look still works.
- [ ] Fog is readable, not blind.
- [ ] The player can identify at least one landmark from the start.
- [ ] Interaction ranges feel forgiving.
- [ ] Frame rate remains playable.

### 15.4 Design QA

- [ ] The field feels like an outdoor tomb-field, not a blank grass plane.
- [ ] The central shrine works as a reorientation landmark.
- [ ] The South Reliquary Crypt is clearly an entrance.
- [ ] The Sunken Central Tomb reads as future content without being enterable.
- [ ] No new assets are required for v0.1.
- [ ] Creature plan uses idle/walk only.

---

## 16. Future Addendum Targets

Recommended addendums after v0.1:

```txt
docs/world/addendums/reliquary_field_addendum_001_south_crypt_interior.md
docs/world/addendums/reliquary_field_addendum_002_north_expansion.md
docs/world/addendums/reliquary_field_addendum_003_bone_gate_route.md
docs/world/addendums/reliquary_field_addendum_004_black_grass_temple_silhouette.md
```

Most likely next document:

```txt
docs/world/crypts/south_reliquary_crypt_baby_labyrinth_v01.md
```

That document should define the first compact baby labyrinth connected to C01.
