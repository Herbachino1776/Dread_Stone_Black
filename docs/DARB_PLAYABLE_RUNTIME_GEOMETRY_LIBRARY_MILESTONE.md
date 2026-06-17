# Milestone: DARB Playable Runtime Geometry Library

## Main Objective

Expand **DARB** — the Dungeon Authoring Runtime — into the primary production-grade playable geometry system for Dread Stone Black.

The goal is to give future locations a reliable runtime construction vocabulary: chambers, paths, stairs, bridges, portals, alcoves, canals, platforms, dividers, pits, arches, colonnades, ledges, dais structures, ceiling systems, and other authored geometry that is both visible and playable.

This milestone is about making DARB the system Codex uses to build real locations, not one-off geometry piles.

Every authored primitive must follow one core rule:

> Visible geometry, collision truth, validation, and debug metadata must agree.

If a player can see it, its blocking/walkable behavior must be intentional. If collision exists, it must correspond to visible structure unless explicitly marked and justified as invisible gameplay logic.

## Why This Matters

Recent DARB work solved major foundational problems:

- stretched or muddy floor and ceiling textures
- invisible or one-sided polygon floors
- oversized diagonal wall collision blockers
- unreliable horizontal surfaces
- unclear authoring patterns for production locations

The next step is to grow the runtime geometry library so future interiors, cities, temples, crypts, markets, sanctums, and ruins can be composed from known-good pieces instead of ad hoc boxes.

This is the architectural foundation for locations like Kerovac, Balthazan successors, future temples, underground cities, sacred canals, and large interior districts.

## Scope

This milestone focuses on **interior and built-location playable geometry**.

It does not replace the separate outdoor/forest terrain milestone. Outdoor heightfields, forests, ravines, mountains, and terrain stamps belong in the DARB Outdoor milestone.

This milestone is for built authored spaces:

- dungeon interiors
- temple interiors
- city interiors
- canal districts
- sunken courts
- ruins
- sacred halls
- markets
- crypt networks
- palace chambers
- progression spaces

## Current DARB Foundation

DARB already has several important runtime systems:

- polygon floors
- wall segments
- door gaps
- path ribbons
- platforms
- ramps
- stairs
- bridges
- walkable elevation
- architectural primitives
- horizontal surfaces
- dungeon validation
- debug rendering
- compiled runtime definitions

Recent horizontal surface work is especially important. Floors, ceilings, roofs, paths, and platform tops should now be authored explicitly through the horizontal surface pipeline wherever appropriate.

Future DARB work should treat that pipeline as the preferred solution for reliable surfaces.

## Design Principles

### 1. Author Once, Play Reliably

A location definition should describe intent clearly. The runtime should generate the mesh, collision, validation data, and debug overlays from that single source of truth.

Codex should not need to invent a unique geometry workaround for every new city or dungeon.

### 2. No Invisible-Wall Jank

Invisible blockers are only acceptable when they are explicit gameplay boundaries and are tagged as such.

Most collision should match visible structures:

- walls block because visible walls exist
- railings may or may not block, depending on authoring
- canal water blocks because water/curb boundaries exist
- ledges block because ledge geometry exists
- doorways allow passage because wall gaps/portals exist

### 3. No Blob Floors or Fake Ceilings

Large surfaces must use real tiled textures with proper UVs.

Floors, ceilings, roofs, platforms, and paths must not become single stretched flat-color planes.

### 4. Primitive Library Over Ad Hoc Boxes

The runtime should provide reusable primitives with known behavior.

A future Codex task should be able to request a sacred city, market, tomb, or palace using a stable library instead of constructing everything from raw `BoxGeometry` fragments.

### 5. Debug Visibility Is Mandatory

Every primitive added to the runtime should expose enough metadata for debug overlays and QA logs.

If a geometry/collision mismatch happens, it should be findable quickly.

## Required Playable Geometry Expansion

### Portal and Doorway Primitives

Add stronger transition geometry for readable progression.

Suggested primitives:

- `portalArch`
- `thickDoorway`
- `sealedGate`
- `openGate`
- `lockedGate`
- `thresholdSlab`
- `returnPortal`

Runtime behavior:

- visible frame geometry
- optional center passage
- optional blocker when sealed/locked
- wall gap integration
- destination/exit metadata where relevant
- debug overlay showing passable and blocked regions

### Stair and Elevation Primitives

DARB has ramps and stairs, but production locations need richer visual stair forms.

Suggested primitives:

- `stairBlock`
- `wideSacredStair`
- `steppedDais`
- `sunkenSteps`
- `platformStairPair`
- `processionalStair`

Runtime behavior:

- visible stepped geometry
- walkable elevation sampling
- optional simplified ramp collision for smooth movement
- consistent material use on treads/risers
- validation for width, step count, height, and slope

### Platform, Dais, and Ledge Primitives

Sacred interiors need raised and lowered areas that are readable and playable.

Suggested primitives:

- `dais`
- `altarPlatform`
- `sunkenPit`
- `ledgeWalkway`
- `raisedCourt`
- `platformRing`
- `balconyEdge`

Runtime behavior:

- visible side walls and top surfaces
- authored walkable top when intended
- blockers or drop boundaries where needed
- clear debug metadata linking walkable surface and visual platform

### Bridge and Canal Primitives

Canal districts and sacred water features should be reusable.

Suggested primitives:

- `bridgeSpan`
- `narrowBridge`
- `wideStoneBridge`
- `brokenBridge`
- `canalCrossing`
- `waterChannel`
- `curbedCanal`
- `drainageRunnel`

Runtime behavior:

- visible water/channel geometry
- bridge deck walkable surface
- optional railings
- blockers for water/voids
- collision that respects standing on bridge decks
- material profiles for water, stone, bronze, and wood

### Wall, Divider, and Barrier Primitives

Interior space needs more than full-height walls.

Suggested primitives:

- `halfWall`
- `ritualDivider`
- `marketCounter`
- `brokenWall`
- `collapsedBarrier`
- `lowRailing`
- `highRailing`
- `screenWall`

Runtime behavior:

- optional blocking by primitive kind
- explicit `blocksPlayer` and `blocksEnemies` controls
- visible geometry that matches collision footprint
- validation for height/thickness/length

### Alcove, Niche, and Chamber Detail Primitives

These give interiors readable shape without creating accidental collision problems.

Suggested primitives:

- `wallAlcove`
- `statueNiche`
- `panelNiche`
- `lootAlcove`
- `enemyRecess`
- `sideChapel`
- `blindPassage`

Runtime behavior:

- visible inset or attached geometry
- optional spawn/loot anchor support
- non-blocking by default unless explicitly authored
- debug labels for anchors and room association

### Column and Structural Rhythm Primitives

Large interiors need structure and scale.

Suggested primitives:

- `colonnade`
- `pillarRow`
- `brokenPillarRow`
- `pairedObelisks`
- `supportBay`
- `arcadeRun`

Runtime behavior:

- repeatable pillar/arch generation
- compact collision per blocking element
- optional central passage clearance
- validation for spacing and count

### Ceiling and Overhead Primitives

Ceilings are critical for Dread Stone Black interiors. Open-sky or fake colored ceilings are not acceptable for sealed interior locations.

Suggested primitives:

- `ceilingSlab`
- `cofferedCeiling`
- `steppedCeiling`
- `barrelVaultSuggestion`
- `overheadRib`
- `roofCap`
- `oculusSeal`

Runtime behavior:

- real visible overhead geometry
- proper underside-facing normals/materials
- tiled UVs
- non-walkable unless explicitly authored as roof/platform
- validation for missing ceiling coverage where a location claims to be sealed

### Chamber Template Primitives

Add higher-level templates that combine lower-level primitives.

Suggested templates:

- `processionalHall`
- `sunCourt`
- `reliquaryCourt`
- `warningSanctum`
- `canalHall`
- `marketCourt`
- `priestVestibule`
- `cryptCellBlock`
- `sealedThroneRoom`

Runtime behavior:

- expands into rooms, surfaces, walls, lights, and primitives
- keeps authored structure readable
- preserves manual override capability
- optional, not required for first implementation pass

## Required Runtime Systems

### Geometry Builder

The geometry builder should support all new primitives through generated Three.js geometry.

Requirements:

- no heavy dependency
- mobile-safe mesh counts
- consistent material resolution
- world-scale UV handling
- correct normals and material sides
- userData linking mesh to definition primitive ID

### Collision Builder

Collision must be generated from the same primitive definitions.

Requirements:

- compact blockers
- oriented segment blockers for diagonal/angled structures
- explicit blocker shapes where useful
- walkable surfaces for platforms, bridges, stairs, and dais tops
- no accidental oversized AABB blockers
- metadata linking collision to visible structure IDs

### Validation

Validation must catch authoring mistakes before runtime.

Required checks:

- unsupported primitive kinds
- missing IDs
- missing material profiles
- non-finite coordinates
- negative or zero dimensions
- impossible stair settings
- missing wall gaps for portal passages
- blockers without visible structures unless intentionally invisible
- walkable surfaces with no visible top mesh
- ceiling claims without ceiling geometry
- exit triggers without destination spawns

### Debug Renderer

Debug rendering should make DARB trustworthy.

Required debug layers:

- wall blockers
- segment blockers
- walkable surfaces
- horizontal surfaces
- portals and door gaps
- primitive footprints
- spawn anchors
- exit triggers
- room boundaries
- ceiling/overhead surfaces where useful

Debug overlays should be quiet by default and useful when enabled.

## First Proof Location

Create a small dedicated test location after the primitive expansion begins.

Suggested name:

# DARB Geometry Proving Hall

Purpose: test playable geometry primitives in one controlled, bright interior.

Required contents:

- one entry room
- one wide stair
- one raised dais
- one bridge/canal crossing
- one portal arch
- one alcove
- one colonnade
- one half-wall/divider
- one coffered or stepped ceiling example
- one exit back to Reliquary Field
- bright lighting for testing
- minimal or no enemies

This should not be a production dungeon. It is a controlled test chamber for runtime trust.

## Acceptance Criteria

The milestone is successful when:

- new primitives render with correct visible geometry
- collision matches visible structures
- walkable surfaces work for stairs, bridges, platforms, and dais tops
- large surfaces use tiled textures instead of stretched blobs
- ceilings render as real overhead geometry
- debug overlays identify primitive geometry and blockers clearly
- validation catches common mistakes
- DARB Geometry Proving Hall is enterable and returnable from Reliquary Field
- existing locations still build and validate
- Balthazan remains intact
- Kerovac remains intact
- Black Grass Temple remains intact
- Vite base remains `/Dread_Stone_Black/`
- GitHub Pages workflow remains unchanged

## Non-Goals

Do not attempt these in the first pass:

- full navmesh replacement
- physics engine integration
- complex imported architectural models
- procedural city generation
- final art pass for every primitive
- large production dungeon built entirely from new primitives
- outdoor forest terrain, mountains, ravines, or heightfields

This milestone is about the reusable runtime library.

## Suggested PR Title

**Expand DARB playable runtime geometry library**

## Suggested Implementation Order

1. Add schema support for new primitive categories.
2. Add geometry builder support for the smallest useful primitive set.
3. Add collision builder support for those primitives.
4. Add validation rules.
5. Add debug renderer support.
6. Add DARB Geometry Proving Hall.
7. Wire field entrance and return.
8. Run bounded verification.

## Bounded Verification Policy

Do not run open-ended live browser smoke tests by default.

Default verification for this milestone:

```txt
- Run npm run validate:dungeons if relevant.
- Run npm run validate:bgt if relevant.
- Run npm run build.
- Run git diff --check.
- Do not run npm run dev unless explicitly requested.
- Do not attempt Playwright/browser/manual localhost smoke tests unless explicitly requested.
- Do not start or connect to a long-running Vite server for routine verification.
- If a live runtime smoke test seems necessary, stop and explain why instead of attempting it automatically.
```

Human visual QA is still expected after merge for major geometry changes.

## Notes for Codex

Preserve existing systems and locations.

Do not break:

- Balthazan
- Kerovac
- Black Grass Temple
- Sumerian Sun Palace
- Sumerian Canal Market District
- survival systems
- inventory
- hunger
- fishing
- campfire crafting
- field entrances and returns
- mobile controls
- GitHub Pages deployment

Keep the implementation lightweight and incremental. Prefer simple generated Three.js geometry and clear collision math over clever systems that are hard to debug.

Every new primitive must be understandable from the definition file alone.

The goal is not to make one flashy room. The goal is to give Dread Stone Black a dependable authored-location construction library that future Codex tasks can use without creating invisible walls, blob floors, missing ceilings, or one-off geometry hacks.
