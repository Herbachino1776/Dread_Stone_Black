# Dread Stone Black - World Architecture Index

Version: v0.2
Lane: Game World Architect  
Purpose: Repo-facing index for buildable location blueprints.

---

## 1. Purpose of This System

World architecture for **Dread Stone Black** is designed as text first, code second.

Each location blueprint should be detailed enough that Codex can convert it into Three.js geometry, materials, collision, interactions, and testing work without inventing core structure.

The Architect produces planning documents. The Producer/Dev Lead reviews them, decides what gets built, then creates Codex prompts or repo tasks.

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

Creature animation lock-in:

- Default new animated creature states are `idle` and `walk` only.
- Ram Man proves the friendly animated NPC pipeline.
- Sheep Demon proves the hostile animated enemy pipeline with multiple GLB animation states.
- Hunyuan → texture optimization → Animate Anything → GLB animation → Three.js integration is a proven creature workflow.
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

### 3.2 Modular Geometry First

Complex places should be built from simple repeated structures:

- rectangular stone blocks
- low walls
- standing slabs
- floor planes
- ceiling planes for interiors
- gates and barred doors
- tomb-mouth openings
- simple ramps/stairs only when needed
- landmark silhouettes

The current texture kit should be used before asking for new assets.

### 3.3 Mobile Readability

For iPhone portrait play:

- important landmarks need readable silhouettes
- corridors should not be too narrow
- gates and entrances should be visible in fog before the player reaches them
- interaction targets should be generous
- avoid tiny props required for progression
- avoid dense object clutter in the first playable slice

### 3.4 PR-Sized Development

Large spaces should be split into implementation phases.

Recommended build order:

1. terrain / floor plane
2. collision bounds
3. landmark shells
4. entrances and interactions
5. interior/baby labyrinth loading hook
6. creatures and patrol zones
7. lighting/fog tuning
8. QA pass

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
  LOCATION_BLUEPRINT_TEMPLATE.md
  OVERWORLD_FIELD_BLUEPRINT.md
  overworld/
    reliquary_field_v01.md
  crypts/
    south_reliquary_crypt_baby_labyrinth_v01.md
  temples/
    temple_of_black_grass_v01.md
  addendums/
    reliquary_field_addendum_001.md
    south_reliquary_crypt_addendum_001.md
```

---

## 6. Active Location Documents

| File | Status | Purpose |
|---|---:|---|
| `docs/world/overworld/reliquary_field_v01.md` | v0.1 built foundation | 800 x 800 tomb-field master plan plus implemented first playable slice |
| `docs/world/crypts/south_reliquary_crypt_baby_labyrinth_v01.md` | v0.1 built foundation | First compact baby labyrinth under the South Reliquary Crypt entrance; use addendums for future changes |

---

## 7. Addendum Rules

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

## 8. Blueprint Approval Flow

1. Architect drafts the blueprint.
2. Producer/Dev Lead reviews it.
3. User approves, rejects, or asks for an addendum.
4. Producer/Dev Lead turns approved blueprint into a Codex prompt.
5. Codex implements in a PR-sized chunk.
6. User tests on mobile and desktop.
7. Bugs or expansion requests become addendums.

---

## 9. Do-Not-Add List Unless Approved

Do not add without explicit approval:

- new deployment tooling
- new framework
- new animation states beyond idle/walk
- procedural world-generation systems
- large physics rewrites
- minimap system
- quest log system
- inventory expansion
- new texture packs
- new creature families
- huge full-field implementation in one PR

---

## 10. Current Architecture Priority

The first field-to-labyrinth loop is built and should be treated as the current foundation:

- Reliquary Field outdoor tomb-field exists as the first playable overworld space.
- South Reliquary Crypt baby labyrinth exists under the field.
- The field-to-crypt-to-return route is a working core structure.
- Ram Man proves the friendly animated NPC pipeline.
- Sheep Demon proves the hostile animated enemy pipeline and is a successful concept proof.
- Do not restart either location as a fresh build target; extend them through addendums or connected blueprints.

Active priority has shifted from proving spaces to making the world flow clear and purposeful.

## 11. Next Useful Work

Near-term Architect/Codex tasks should focus on:

- first real player objective with a simple interactable and clear feedback
- progression reason to enter the crypts from the field
- field landmarks, pathing, silhouettes, and navigation clarity
- next Architect-authored blueprint for another connected location
- South Reliquary Crypt addendums for branches, gates, reliquary rewards, shortcuts, or encounter revisions
- future combat, creature behavior, and animation polish after world structure advances

Keep these tasks small, mobile-readable, and grounded in the built field-to-crypt loop.
