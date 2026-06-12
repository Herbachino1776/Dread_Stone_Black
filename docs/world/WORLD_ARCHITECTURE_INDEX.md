# Dread Stone Black - World Architecture Index

Version: v0.4
Lane: Game World Architect  
Purpose: Repo-facing index for buildable location blueprints and construction standards.

---

## 1. Purpose of This System

World architecture for **Dread Stone Black** is designed as text first, code second.

Each location blueprint should be detailed enough that Codex can convert it into Three.js geometry, materials, collision, interactions, runtime definition data, and testing work without inventing core structure.

The Architect produces planning documents. The Producer/Dev Lead reviews them, decides what gets built, then creates Codex prompts or repo tasks.

Current production direction:

```txt
Architectural concept
-> construction blueprint
-> runtime definition
-> validation
-> playtest
-> addendum
```

---

## 2. Current Project Constraints

Project stack:

- Three.js
- Vite
- GitHub Pages
- GitHub Actions deployment
- Mobile-first browser target, especially iPhone portrait play

Deployment lock-ins:

- Do not change `vite.config.ts` base path.
- The base path must remain `/Dread_Stone_Black/`.
- Do not remove `.github/workflows/deploy-pages.yml`.
- Every implementation PR must pass `npm run build`.

Validation lock-ins:

- Location implementation PRs should pass `npm run validate:dungeons`.
- Black Grass Temple PRs should pass `npm run validate:bgt` and `npm run validate:integrity`.

Creature animation lock-in:

- Default new animated creature states are `idle` and `walk` only.
- Ram Man proves the friendly animated NPC pipeline.
- Sheep Demon proves the hostile animated enemy pipeline with multiple GLB animation states.
- Hunyuan -> texture optimization -> Animate Anything -> GLB animation -> Three.js integration is a proven creature workflow.
- Do not require new attack, hurt, death, stagger, or transition animations unless the user explicitly approves them.

---

## 3. Architecture Design Principles

### 3.1 Buildable First

Every blueprint should define:

- map bounds
- player start
- exits
- coordinates
- dimensions
- materials
- interactions
- collision expectations
- lighting/fog intent
- mobile performance notes
- explicit Codex build constraints

Avoid vague mood writing unless it directly informs geometry, lighting, placement, or player routing.

### 3.2 Runtime Definition First

New compiled locations should be authored through:

```txt
src/game/locations/<locationId>.definition.js
```

Codex should prefer runtime definitions over hand-building major dungeon geometry in `DungeonScene.js`.

Blueprints should map cleanly to runtime fields:

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

### 3.3 Modular Geometry First

Complex places should be built from simple repeated structures:

- rectangular rooms
- rectangular wall boxes
- low walls
- standing slabs
- floor planes/slabs
- ceiling planes/slabs
- gates and barred doors
- tomb-mouth openings
- simple ramps/stairs only when needed
- landmark silhouettes

The current texture kit should be used before asking for new assets.

### 3.4 Mobile Readability

For iPhone portrait play:

- important landmarks need readable silhouettes
- corridors should not be too narrow
- gates and entrances should be visible in fog before the player reaches them
- interaction targets should be generous
- avoid tiny props required for progression
- avoid dense object clutter in first passes

### 3.5 PR-Sized Development

Large spaces should be split into implementation phases.

Recommended build order:

1. runtime definition / room graph
2. floor and ceiling ownership
3. wall gaps and sealed edges
4. collision truth
5. landmark props
6. exits and interactions
7. torch fixtures and lighting
8. spawns and encounter zones
9. validation pass
10. mobile playtest pass

---

## 4. Current Asset Kit

### 4.1 Interior / Dungeon Textures

```txt
public/assets/textures/wall_black_stone_01.png
public/assets/textures/floor_worn_stone_01.png
public/assets/textures/ceiling_dark_stone_01.png
public/assets/textures/metal_gate_rusted_01.png
```

### 4.2 Outdoor Texture

```txt
public/assets/textures/outdoor/field_dead_grass_01.png
```

### 4.3 NPC / Enemy GLB Pattern

NPCs:

```txt
public/assets/npcs/<npc_name>/<npc_name>_idle_01.glb
public/assets/npcs/<npc_name>/<npc_name>_walk_01.glb
```

Enemies:

```txt
public/assets/enemies/<enemy_name>/<enemy_name>_idle_01.glb
public/assets/enemies/<enemy_name>/<enemy_name>_walk_01.glb
```

---

## 5. Recommended Repo Structure

```txt
docs/world/
  WORLD_ARCHITECTURE_INDEX.md
  ARCHITECTURE_BLUEPRINT_STANDARD.md
  LOCATION_CONSTRUCTION_TEMPLATE.md
  LOCATION_BLUEPRINT_TEMPLATE.md
  OVERWORLD_FIELD_BLUEPRINT.md
  overworld/
    reliquary_field_v01.md
  crypts/
    south_reliquary_crypt_baby_labyrinth_v01.md
  temples/
    black_grass_temple_v01.md
    black_grass_temple_v02_construction_blueprint.md
  addendums/
    reliquary_field_addendum_001.md
    south_reliquary_crypt_addendum_001.md
    black_grass_temple_addendum_001.md
```

---

## 6. Core World Architecture Documents

| File | Status | Purpose |
|---|---:|---|
| `docs/world/ARCHITECTURE_BLUEPRINT_STANDARD.md` | v1.0 active standard | Required blueprint rules for rooms, wall gaps, floors, ceilings, collision truth, torches, spawns, exits, validation, and Codex prompts |
| `docs/world/LOCATION_CONSTRUCTION_TEMPLATE.md` | v0.1 active template | Reusable construction blueprint shell for future dungeons, temples, houses, crypts, fields, shrines, and interiors |
| `docs/world/WORLD_ARCHITECTURE_INDEX.md` | active index | Entry point for architecture docs and current production priorities |

---

## 7. Active Location Documents

| File | Status | Purpose |
|---|---:|---|
| `docs/world/overworld/reliquary_field_v01.md` | v0.1 built foundation | 800 x 800 tomb-field master plan plus implemented first playable slice |
| `docs/world/crypts/south_reliquary_crypt_baby_labyrinth_v01.md` | v0.1 built foundation | First compact baby labyrinth under the South Reliquary Crypt entrance; use addendums for future changes |
| `docs/world/temples/black_grass_temple_v01.md` | v0.1 design blueprint | Production-grade medium dungeon: field temple, subterranean ruins, black-grass tavern halls, enemy spawn plan, lower sanctum, return shortcut |
| `docs/world/temples/black_grass_temple_v02_construction_blueprint.md` | v0.2 construction blueprint | Runtime-facing audit blueprint for `src/game/locations/blackGrassTemple.definition.js` |

---

## 8. Addendum Rules

Use addendums when a location grows or changes after the base blueprint is accepted.

Do not rewrite the main location document every time unless the entire space is being replaced.

Addendum naming:

```txt
docs/world/addendums/<location_name>_addendum_001.md
docs/world/addendums/<location_name>_addendum_002.md
```

Each addendum should include:

- target base document
- date/version
- changed structures
- new coordinates
- removed structures
- Codex implementation notes
- test requirements

---

## 9. Blueprint Approval Flow

1. Architect drafts the blueprint or addendum.
2. Producer/Dev Lead reviews it.
3. User approves, rejects, or asks for an addendum.
4. Producer/Dev Lead turns approved blueprint into a Codex prompt.
5. Codex implements in a PR-sized chunk.
6. Codex runs build and validation.
7. User tests on mobile and desktop.
8. Bugs or expansion requests become addendums.

---

## 10. Do-Not-Add List Unless Approved

Do not add without explicit approval:

- new deployment tooling
- new framework
- new animation states beyond current approved creature systems
- procedural world-generation systems
- large physics rewrites
- minimap system
- quest log system
- inventory expansion
- new texture packs
- new creature families
- huge full-field implementation in one PR

---

## 11. Current Architecture Priority

The first field-to-labyrinth loop is built and should be treated as the current foundation:

- Reliquary Field outdoor tomb-field exists as the first playable overworld space.
- South Reliquary Crypt baby labyrinth exists under the field.
- The field-to-crypt-to-return route is a working core structure.
- Ram Man proves the friendly animated NPC pipeline.
- Sheep Demon proves the hostile animated enemy pipeline and is a successful concept proof.
- Do not restart either location as a fresh build target; extend them through addendums or connected blueprints.

Active priority has shifted to construction-grade authoring and runtime validation.

Black Grass Temple is the next major architecture target:

- use `black_grass_temple_v02_construction_blueprint.md`
- audit `src/game/locations/blackGrassTemple.definition.js`
- keep geometry compiled through Dungeon Authoring Runtime
- run `npm run build`, `npm run validate:bgt`, `npm run validate:integrity`, and `npm run validate:dungeons`
- fix validation errors before claiming completion

## 12. Next Useful Work

Near-term Architect/Codex tasks should focus on:

- using the new construction standard for all future locations
- auditing Black Grass Temple against the v02 construction blueprint
- resolving validation warnings/errors honestly
- preserving Reliquary Field and South Reliquary Crypt while improving BGT
- using addendums after playtest for enemy tuning, sanctum reward, field approach expansion, or second-depth work

Keep these tasks mobile-readable, buildable, and grounded in the existing field-to-crypt loop.
