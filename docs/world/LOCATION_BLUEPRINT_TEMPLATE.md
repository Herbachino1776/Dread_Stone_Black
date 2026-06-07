# LOCATION BLUEPRINT - <Location Name>

Version: v0.1  
Document path: `docs/world/<category>/<location_name>_v01.md`  
Lane: Game World Architect  
Implementation owner: Codex after Producer/Dev Lead approval

---

## 1. Purpose

Describe what this place is and what gameplay role it serves.

Keep this short and build-facing.

Example:

```txt
A compact outdoor crypt approach that teaches the player to navigate by tomb silhouettes, fog, and stone landmarks before entering the first baby labyrinth.
```

---

## 2. Scale

- Full bounds:
- First implemented bounds:
- Player start:
- Primary exit(s):
- Optional shortcut(s):
- Intended playtime:
- Mobile performance notes:

Recommended scale assumptions:

- 1 world unit roughly equals 1 meter of readable game space.
- First playable outdoor slices should stay dense enough to test but sparse enough for mobile performance.
- Baby labyrinths should usually fit within 30 x 30 to 80 x 80 units.

---

## 3. Coordinate System

- X axis:
- Z axis:
- Y axis:
- Important origin point:
- Ground level:
- Player eye-height assumption:

Recommended defaults:

```txt
X = west/east. Negative X is west. Positive X is east.
Z = south/north. Negative Z is south. Positive Z is north.
Y = vertical height. Y 0 is ground/floor level.
Origin X 0 Z 0 should be a major readable landmark or the player start.
```

---

## 4. ASCII Map

Legend:

```txt
P = player start
E = exit / entrance
G = gate
L = locked / blocked
R = Ram Man or guardian creature
C = crypt / tomb entrance
S = shrine / landmark
B = boundary / cliff / blocked edge
# = wall / stone mass
. = walkable space
~ = field / rough ground
```

Map:

```txt
<ASCII map here>
```

---

## 5. Structural Table

| ID | Type | Position | Size | Material | Collision | Notes |
|---|---|---|---|---|---|---|
| A01 | wall | X 0, Y 0, Z 0 | W/H/D | `wall_black_stone_01` | solid | Example |

Position format:

```txt
X <number>, Y <number>, Z <number>
```

Size format:

```txt
W <width>, H <height>, D <depth>
```

---

## 6. Material Plan

Use existing assets unless new assets are explicitly required.

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

Outdoor ground:

```txt
public/assets/textures/outdoor/field_dead_grass_01.png
```

Special surfaces:

```txt
List only if required.
```

Texture repeat notes:

- Outdoor field planes should use large repeats so grass does not stretch.
- Stone blocks should use consistent repeats so walls read as heavy masonry.
- Avoid tiny tiling noise that flickers on mobile.

---

## 7. Interaction Plan

| ID | Interaction | Position | Trigger Range | Result | Notes |
|---|---|---|---:|---|---|
| INT01 | enter crypt | X 0, Y 0, Z 0 | 4 units | load/teleport to target interior | Example |

Interaction guidance:

- Interactions should be generous for mobile.
- Entrances should be readable from at least 20 to 40 units away outdoors.
- Progression-critical targets should not be tiny or visually hidden.

---

## 8. Creature / NPC Plan

Current animation rule:

- idle
- walk

Do not require attack, hurt, death, stagger, or special animation states unless explicitly approved.

| ID | Creature | Asset Pattern | Position | Patrol / Behavior | Notes |
|---|---|---|---|---|---|
| NPC01 | Ram Man | `public/assets/npcs/ram_man/ram_man_idle_01.glb` + walk | X 0, Y 0, Z 0 | idle or short patrol | Example |

---

## 9. Lighting / Fog

Indoor:

```txt
Describe color, intensity, and readability intent.
```

Outdoor:

```txt
Describe sun direction, ambient level, and landmark readability.
```

Fog:

```txt
Define near/far feel. Example: landmarks readable by silhouette at 80-120 units.
```

Mobile readability notes:

```txt
Describe what must stay visible on iPhone portrait.
```

---

## 10. Collision / Navigation Notes

Define:

- solid walls
- invisible boundaries
- blocked edges
- gate collision
- entrance trigger volumes
- creature patrol zones
- player-safe return path

Avoid:

- narrow 1-unit corridors
- small collision seams that snag mobile movement
- stairs/ramps unless necessary
- dense prop clutter at player height

---

## 11. Codex Implementation Notes

Codex should build:

```txt
List exact implementation tasks.
```

Codex should not build:

```txt
List out-of-scope items.
```

Existing systems that must remain working:

```txt
- mobile dual-stick HUD
- vertical look
- current player controller
- Pages deployment
- npm run build
```

---

## 12. QA Checklist

Desktop:

- [ ] `npm run build` passes.
- [ ] Player spawns at the correct coordinates.
- [ ] Player cannot walk through solid walls or gates.
- [ ] Entrances trigger only at intended range.
- [ ] No console errors.

Mobile:

- [ ] iPhone portrait controls still work.
- [ ] HUD does not block critical interaction prompts.
- [ ] Landmarks are visible enough through fog.
- [ ] Frame rate remains playable.
- [ ] Interaction ranges feel forgiving.

Design:

- [ ] Route is readable without a minimap.
- [ ] Major landmark silhouettes are distinct.
- [ ] No required new assets unless listed.
- [ ] Creature plan uses idle/walk only.
