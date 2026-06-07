DREAD STONE BLACK - OVERWORLD FIELD BLUEPRINT
Working document for Codex / ChatGPT Project Sources
Version: v0.1
Purpose: Give Codex an engineering-style plan for building the first outdoor sandbox field.

============================================================
0. CURRENT RULES / LOCK-INS
============================================================

This document describes a near-term overworld prototype for Dread Stone Black.

Do not treat this as the final entire game map. Treat it as the first outdoor sandbox blueprint.

Project identity:
- Mobile-first first-person dungeon crawler.
- Three.js / Vite / GitHub Pages.
- iPhone browser play is the primary target.
- King's Field-like mood: slow, lonely, dark, hostile, cryptic, and spatially confusing in a good way.
- All names, maps, assets, enemies, UI, and lore must be original.

Creature rule for now:
- Animated creatures use only IDLE and WALK animation files.
- Do not add attack, hurt, death, or dialogue animation states yet.
- Ram Man is the proven animated GLB creature/NPC pipeline example.

Deployment safety:
- Do not change vite.config.ts base path. It must remain: /Dread_Stone_Black/
- Do not remove .github/workflows/deploy-pages.yml
- Run npm run build before final PR.

Outdoor asset rule for this first pass:
- Grass/field texture is enough for now.
- Do not wait for trees, rocks, cliffs, or exterior props.
- Use procedural/simple geometry for crypt entrances and boundary structures if needed.


============================================================
1. HIGH-LEVEL WORLD CONCEPT
============================================================

The first outdoor world should feel like a cursed tomb-field.

The player exits or begins near a stone threshold and enters a broad, foggy field surrounded by ancient boundary walls, black cliffs, or unreadable darkness.

The field is not a cheerful grassland.
It should feel dead, wet, brown-green, old, unsafe, and abandoned.

The field should contain multiple crypt/tomb entrances spread far enough apart that the player feels exposed while traveling between them.

The design goal is to make the game feel like an open-world RPG immediately, even though the first implementation should stay small enough to run well on mobile.

Core fantasy:
- A large outdoor burial ground.
- Dispersed tomb entrances.
- Each tomb is a small baby labyrinth.
- A dangerous Ram Man / guardian creature waits inside or near the center of each labyrinth.
- The field itself creates fear through distance, fog, low visibility, and sparse landmarks.


============================================================
2. WORLD SCALE DECISION
============================================================

User originally suggested 800 x 800 world units.

Codex should understand this as a LONG-TERM FULL FIELD SCALE, not necessarily the first fully detailed loaded area.

Scale interpretation:
- 1 world unit roughly equals 1 meter of player-scale movement.
- 800 x 800 is a large field for a mobile browser game.
- If built all at once with too many objects, it may hurt performance.
- Use fog, low-poly terrain, and sparse objects to make the space feel huge.

Recommended plan:
- Full design blueprint: 800 x 800 units.
- First playable implementation: 400 x 400 units maximum, centered around the player start.
- If performance is strong, expand toward the full 800 x 800 later.

If Codex is asked to build the first implementation in one PR:
- Prefer 400 x 400 units for actual geometry.
- Keep the coordinate plan compatible with future 800 x 800 expansion.
- Use invisible/fog boundary beyond the first playable zone.


============================================================
3. COORDINATE SYSTEM
============================================================

Use a simple top-down coordinate plan.

World center:
- (0, 0) is the approximate center of the outdoor field.

Full planned field bounds:
- X: -400 to +400
- Z: -400 to +400

First playable field bounds:
- X: -200 to +200
- Z: -200 to +200

Player start:
- X: 0
- Z: +170
- Facing north toward the central field.

Important convention:
- Negative Z = north / deeper into the field.
- Positive Z = south / starting boundary.
- Negative X = west.
- Positive X = east.


============================================================
4. ASCII BLUEPRINT - FULL 800 x 800 DESIGN
============================================================

This is the long-term target layout.

Not every entrance needs to be functional immediately.

Legend:
P  = player start
C# = crypt / tomb entrance
R  = Ram Man / guardian-centered labyrinth
W  = wall / cliff / hard boundary
F  = fog-heavy open field
S  = shrine / landmark
G  = gate / locked boundary
~  = low ground / swampy depression
.  = sparse field

Top-down plan:

Z -400  W W W W W W W W W W W W W W W W W W W W
        W                 C07                     W
        W           F F F . . . F F               W
        W     C05                     C06         W
        W                                             W
        W          . . .       S       . . .          W
        W                                             W
        W  C03              ~ ~ ~              C04    W
        W                ~   C08   ~                 W
        W                  ~ ~ ~                     W
        W                                             W
        W        C01                     C02          W
        W                                             W
        W             broken field path               W
        W                                             W
        W                    P                        W
Z +400  W W W W W W W W W G W W W W W W W W W W

X -400                    X 0                    X +400

Long-term crypt entrance list:
- C01: West low crypt
- C02: East low crypt
- C03: West middle crypt
- C04: East middle crypt
- C05: Northwest crypt
- C06: Northeast crypt
- C07: North wall crypt / major tomb
- C08: Sunken central tomb in swamp depression

First implementation should not build all eight interiors.
First implementation should build 3 visible entrances and 1 functional baby labyrinth.


============================================================
5. FIRST PLAYABLE OUTDOOR SLICE
============================================================

Target first build:
- 400 x 400 outdoor field.
- Undulating grass terrain.
- Fog-heavy distance.
- 3 visible crypt entrances.
- 1 functional crypt entrance.
- 2 sealed/locked/nonfunctional entrances for atmosphere.
- One existing Ram Man animated GLB can be used as the first guardian creature.

First playable coordinates:

Player Start:
- Position: (0, 0, +170)
- Facing: north / toward negative Z.
- Role: safe-ish starting edge of field.

Crypt Entrance A / First Functional Crypt:
- Position: (-95, 0, -40)
- Purpose: first baby labyrinth entrance.
- Should be visible after some exploration.
- Contains or leads to Ram Man guardian encounter.
- Label in code: crypt_entrance_a

Crypt Entrance B / Sealed Crypt:
- Position: (+115, 0, -95)
- Purpose: visible goal / future content.
- Interact text can be removed or minimal, since visible messages are currently minimized.
- Label in code: crypt_entrance_b

Crypt Entrance C / Far Fog Crypt:
- Position: (0, 0, -175)
- Purpose: distant silhouette in fog.
- Should make the world feel larger.
- Label in code: crypt_entrance_c

Central landmark:
- Position: (0, 0, -25)
- Simple standing stone or broken marker.
- Built from basic geometry if no prop exists.
- Helps player orient in the field.

Boundary:
- The field should have a hard outer boundary around the playable zone.
- Use dark low walls, cliffs, or invisible blockers.
- Player should not walk into endless unloaded space.


============================================================
6. TERRAIN SPEC
============================================================

The field should NOT be a perfectly flat plane.

Use a low-poly undulating terrain.

First implementation terrain:
- Size: 400 x 400 units.
- Segments: 96 x 96 or 128 x 128.
- Height variation: approximately 0.2 to 1.2 units.
- Use gentle rolling noise, not sharp mountains.
- Keep slopes walkable.
- The player controller must stay grounded on terrain height.

If terrain-following is too risky for one PR:
- Use a mostly flat collision plane first.
- Add visual undulation to terrain mesh.
- Keep player Y stable temporarily.
- But document that true terrain-following is needed next.

Grass texture:
- Use one uploaded grass/field texture.
- Suggested path:
  public/assets/textures/outdoor/field_dead_grass_01.png

Texture behavior:
- Use RepeatWrapping.
- Tile the texture many times across the terrain.
- Avoid stretching a 512x512 texture across the entire field.
- Suggested repeat for 400 x 400 field: 40 x 40 or 50 x 50.
- If using 800 x 800 later, increase repeat accordingly.

Lighting:
- Dim outdoor ambient.
- Dull gray/brown sky/fog.
- No bright sunny daylight.
- Fog should reduce visibility enough that landmarks emerge gradually.

Fog:
- Start: 45 to 70 units.
- End: 150 to 220 units.
- Tune for iPhone readability.
- Distant crypts should appear as silhouettes, not crisp objects.


============================================================
7. CRYPT ENTRANCE STRUCTURE
============================================================

For the first pass, crypt entrances can be built with simple geometry.

Do not wait for custom GLB entrances.

Basic crypt entrance kit:
- dark stone doorway
- two side blocks/pillars
- lintel/top slab
- short stair/ramp down or black rectangular doorway
- optional low mound around entrance

Simple geometry dimensions:
- doorway width: 5 to 8 units
- doorway height: 4 to 6 units
- entrance depth: 4 to 8 units
- mound radius: 10 to 16 units

The doorway should be readable from far away as a tomb mouth.

Suggested material:
- Reuse existing dungeon wall/gate textures if outdoor-specific stone is missing.
- Use dark stone material.
- Keep entrance darker than field.

Functional entrance behavior:
- Crypt Entrance A should be able to transition or teleport the player to the existing dungeon/baby labyrinth area.
- If full transition system is not ready, make the entrance stand as a clear marker first.
- Do not overbuild loading zones if it risks breaking the current game.

Sealed entrances:
- B and C can be blocked for now.
- Use physical stone door/slab or dark barrier.
- They are visual promises for future expansion.


============================================================
8. BABY LABYRINTH STRUCTURE
============================================================

Each crypt should be a compact dangerous interior.

A baby labyrinth is not a huge dungeon. It is a small bite-sized dungeon module.

Recommended size:
- 30 x 30 to 80 x 80 units.
- 3 to 6 chambers.
- 1 loop or locked shortcut.
- 1 central danger chamber.
- 1 reward/exit path.

Baby labyrinth shape:
- Entrance corridor
- Split or small branch
- Side room
- Central guardian chamber
- Return loop or locked shortcut

Ram Man/guardian location:
- Near center of the labyrinth.
- Idle/walk only for now.
- If hostile behavior exists later, damage can be proximity/contact-based until attack animation exists.
- For now, Ram Man may remain friendly or non-damaging depending on current implementation.


============================================================
9. PERFORMANCE / MOBILE CONSTRAINTS
============================================================

This must work on iPhone browser.

Rules:
- Keep terrain simple.
- Do not scatter hundreds of GLB trees.
- Do not use heavy grass instances yet.
- Do not load too many animated GLBs at once.
- Use fog to hide distance and simplify what must be visible.
- Use simple collision.
- Prefer repeated textures and simple geometry.
- Keep first implementation sparse.

Object budget for first outdoor slice:
- 1 terrain mesh
- 3 crypt entrances built from boxes/simple geometry
- 1 central landmark
- 1 boundary wall/cliff ring
- 0-1 animated creature outdoors
- No dense forest yet

Asset budget for first outdoor slice:
- 1 grass/dead field texture only is acceptable.


============================================================
10. WHAT CODEX SHOULD BUILD FIRST
============================================================

If asked to implement this blueprint, Codex should create a focused PR:

PR name:
Create first outdoor tomb-field prototype

Implementation scope:
- Add an outdoor field scene or outdoor area mode.
- Use 400 x 400 playable terrain based on the 800 x 800 blueprint.
- Load field_dead_grass_01.png from public/assets/textures/outdoor/
- Generate gently undulating terrain.
- Add fog and dim outdoor lighting.
- Add 3 crypt entrance structures from simple geometry.
- Add hard boundary.
- Add central landmark.
- Allow player to move around the field.
- Preserve mobile controls and FPV arms.
- Do not build all crypt interiors in this PR.
- Do not add attack/hurt/death creature states.
- Do not change deployment config.

Expected grass asset:
public/assets/textures/outdoor/field_dead_grass_01.png

If the grass texture is missing:
- Stop and clearly report it is missing.
- Do not fake a committed texture path.
- A temporary procedural material is acceptable only if explicitly requested.


============================================================
11. CODEX PROMPT FOR IMPLEMENTATION
============================================================

Use this prompt after uploading the grass texture:

Repo: Herbachino1776/Dread_Stone_Black

Read first:
- docs/GAME_PLAN.md
- docs/CODEX_GROUNDING.md
- docs/CURRENT_PRODUCTION_NOTE.md
- docs/OVERWORLD_FIELD_BLUEPRINT.md

Create the next PR: first outdoor tomb-field prototype.

Goal:
Build the first playable outdoor tomb-field sandbox from the blueprint, using one uploaded grass/field texture and simple procedural geometry.

Expected texture:
public/assets/textures/outdoor/field_dead_grass_01.png

First:
- Confirm the grass texture exists.
- If missing, stop and clearly say it needs to be uploaded.

Requirements:
- Create a first outdoor field area based on a long-term 800 x 800 blueprint, but implement only a 400 x 400 playable first slice.
- Use gently undulating terrain, not a perfectly flat plane.
- Apply the grass texture with RepeatWrapping.
- Do not stretch the 512x512 texture across the whole field.
- Suggested repeat: 40 x 40 or 50 x 50 for the 400 x 400 field.
- Add dim outdoor lighting and heavy fog.
- Add three visible crypt/tomb entrances using simple geometry.
- Place entrances at approximately:
  - crypt A: X -95, Z -40
  - crypt B: X +115, Z -95
  - crypt C: X 0, Z -175
- Add a central landmark around X 0, Z -25.
- Add hard outer boundaries so the player cannot leave the playable area.
- Preserve current mobile-first controls, dual sticks, FPV arms, HUD, and existing indoor dungeon systems.
- Do not remove Ram Man.
- Do not add new animated creatures.
- Do not add attack/hurt/death animation states.
- Do not change vite.config.ts base path. It must remain /Dread_Stone_Black/
- Do not remove .github/workflows/deploy-pages.yml
- Run npm run build.

Do not add:
- full 800 x 800 loaded world
- trees/rocks/extra outdoor assets
- new enemies
- inventory
- magic
- dialogue
- new UI redesign

PR description should include:
- implemented field size
- terrain repeat values
- crypt entrance coordinates
- how boundaries work
- how to test on iPhone
- whether npm run build passes


============================================================
12. OPEN QUESTIONS FOR LATER
============================================================

Later decisions:
- Will the outdoor field be the start area or reached after the first chamber?
- Will crypt interiors be separate scenes, portals, or continuous connected geometry?
- Will Ram Man become hostile or remain an NPC archetype?
- How many crypts should the full 800 x 800 field eventually contain?
- Should the field have a world map/minimap? Probably not yet.
- Should fog fully hide distant crypts until nearby? Probably yes.
- Should terrain collision follow exact terrain height? Eventually yes.
