# Milestone: DARB Outdoor Authoring Runtime

## Main Objective

Build a production-ready outdoor geometry layer for **Dread Stone Black** that allows authored forest, mountain, ravine, riverbank, cave-mouth, and ruined-field locations to be generated at runtime with the same reliability now expected from DARB interior locations.

The goal is to move the outdoor world beyond flat fields with scattered sprites. Forest locations should become playable landscapes: curved paths, raised ridges, sunken groves, creek beds, cliff walls, cave mouths, root arches, terrain bowls, and natural choke points. The player should feel like they are moving through an actual hostile wilderness, not across a square plane decorated with trees.

This milestone extends the DARB philosophy into outdoor space:

- authored definition files
- runtime-generated mesh geometry
- visible geometry matched to collision truth
- validation warnings for dangerous authoring mistakes
- debug overlays for terrain, blockers, paths, and walkable surfaces
- mobile-safe performance for portrait play

## Working Name

**DARB Outdoor** or **OARB**: Outdoor Authoring Runtime Builder.

This does not replace indoor DARB. It expands the same runtime-authoring idea into natural terrain and exterior locations.

## Design Problem

Current outdoor environments risk feeling flat, blocky, or decorative. Trees, shrubs, and billboard foliage can make a field look denser, but they do not by themselves create meaningful terrain.

The required leap is a playable outdoor geometry library that supports:

- non-flat ground
- curved trails
- natural boundaries
- forest pockets and hidden chambers
- slopes and raised land
- ravines and trenches
- creek beds and riverbanks
- cliffs and mountain skirts
- cave entrances
- terrain-shaped encounter spaces

The runtime must avoid the same failures that appeared in earlier generated locations:

- invisible walls that do not match visible structures
- visible geometry with no collision
- stretched or muddy surface textures
- blocky rectangular terrain pretending to be natural land
- paths that look walkable but are not
- slopes that visually rise but do not affect player height
- expensive geometry that hurts mobile performance

## Core Technical Direction

Outdoor geometry should be built from four foundational systems.

### 1. Heightfield Terrain

A forest location should use a subdivided terrain mesh instead of a single flat plane.

The authored definition should declare terrain size, resolution, base height, material profiles, and height modifications.

Example schema direction:

```js
terrain: {
  size: [420, 420],
  segments: [96, 96],
  baseY: 0,
  material: 'forestGround',
  heightStamps: []
}
```

Runtime responsibilities:

- generate a terrain mesh from the heightfield
- apply world-scale UVs so ground textures tile properly
- support height sampling through `sampleOutdoorY(x, z)`
- allow the player and enemies to stand on terrain height instead of a flat Y plane
- expose terrain debug visualization in development mode

### 2. Terrain Stamps

Terrain stamps are authored brushes that modify the heightfield.

Required first-pass stamp types:

```js
{ kind: 'hill', center: [40, 90], radius: 34, height: 4.5 }
{ kind: 'hollow', center: [-60, 20], radius: 28, depth: 2.2 }
{ kind: 'ridge', path: [[-90, 40], [-40, 55], [5, 48]], width: 18, height: 5 }
{ kind: 'ravine', path: [[20, -80], [35, -20], [10, 45]], width: 10, depth: 3 }
{ kind: 'flatten', center: [0, 0], radius: 18, y: 0.2 }
```

Runtime responsibilities:

- blend stamps smoothly into terrain
- avoid sharp square edges unless explicitly requested
- allow stamps to stack in predictable order
- support validation for missing radius, malformed paths, extreme heights, and unsafe slopes

### 3. Spline-Based Outdoor Features

Natural outdoor features should be authored as curved splines, not box corridors.

Required first-pass spline features:

```js
splineTrails: [
  {
    id: 'old_hunter_path',
    points: [[-120, -80], [-70, -40], [-30, 10], [20, 44]],
    width: 5,
    material: 'mudTrail',
    flatten: true
  }
]
```

Supported spline feature types:

- `splineTrail`
- `riverSpline`
- `creekBed`
- `ridgeLine`
- `cliffLine`
- `rootPath`
- `ruinPath`

Runtime responsibilities:

- generate curved ribbon meshes
- optionally flatten or depress terrain beneath the spline
- optionally add border geometry, such as creek banks or trail shoulders
- allow authored material profiles per spline
- support debug drawing for spline centerline, width, and collision

### 4. Curved Collision and Visible Boundaries

Outdoor blockers must follow visible geometry. Forest cliffs, ravines, boulders, roots, and mountain edges should not use oversized invisible rectangles.

Required collision types:

- capsule segment blocker
- spline blocker
- circular blocker
- terrain hazard zone
- cliff edge blocker

Example schema direction:

```js
curvedBlockers: [
  {
    id: 'north_cliff_line',
    kind: 'cliff',
    points: [[-160, 80], [-120, 110], [-40, 125], [35, 105]],
    thickness: 3.5,
    visibleStructureId: 'north_cliff_mesh'
  }
]
```

Runtime responsibilities:

- test player/enemy radius against curved blockers
- preserve blocker metadata for debugging
- warn when a blocker lacks a visible structure reference unless intentionally invisible
- draw curved blocker overlays in development mode

## Outdoor Playable Geometry Library

The milestone should add a first-pass library of reusable outdoor primitives.

### Terrain Primitives

- `terrainPatch`
- `heightStamp`
- `forestClearing`
- `sunkenGrove`
- `raisedRidge`
- `ravineCut`
- `mudTrail`
- `riverBed`
- `creekBank`

### Boundary Primitives

- `cliffWall`
- `mountainSkirt`
- `stoneOutcrop`
- `boulderCluster`
- `fallenTreeBarrier`
- `rootWall`
- `denseThicketBlocker`

### Traversal Primitives

- `fallenTreeBridge`
- `rootArch`
- `steppingStones`
- `logCrossing`
- `slopeTrail`
- `caveMouth`
- `ledgePath`

### Encounter-Space Primitives

- `forestBowl`
- `ambushClearing`
- `ritualGrove`
- `ruinedFoundation`
- `hiddenAlcove`
- `spawnHollow`
- `fogPocket`

### Decoration Zones

Decoration zones should remain separate from collision truth.

- `treeClusterZone`
- `shrubPatchZone`
- `grassPatchZone`
- `mistVolume`
- `fallenBranchScatter`
- `standingStoneScatter`

These zones may spawn sprites or low-cost meshes, but they should not create collision unless explicitly paired with a blocker primitive.

## First Test Location

Create a small proving location called:

# Ashen Forest Proving Ground

Purpose: validate outdoor terrain authoring before attempting a full production forest.

Required features:

- one generated heightfield terrain mesh
- one curved muddy trail
- one raised ridge
- one shallow ravine or creek bed
- one curved cliff boundary
- one cave mouth
- one sunken grove
- one fallen tree crossing or root arch
- several dense tree cluster zones
- one field entrance and return exit
- bright enough lighting for testing
- no open-world sprawl yet
- minimal enemies, or none for the first pass

The location should be playable on mobile without heavy frame loss.

## Visual Direction

The forest should fit Dread Stone Black:

- hostile and ancient
- lonely and quiet
- dark fantasy wilderness
- dead grass, black roots, redwood-scale trees, old stone remains
- occult ruined structures partly swallowed by terrain
- foggy depth without hiding geometry during testing
- curved natural shapes instead of rectangular arenas

Testing builds should be bright enough to inspect terrain and collision clearly. Darkness and horror lighting can be tuned after geometry is reliable.

## Runtime Requirements

This milestone should touch the same categories as successful DARB interior work:

- geometry generation
- collision generation
- validation
- debug visualization
- material/UV handling
- spawn and exit support
- mobile performance guardrails

### Geometry Builder

Add outdoor terrain and primitive generation to the runtime geometry builder or a dedicated outdoor geometry builder.

Required outputs:

- terrain mesh
- spline ribbon meshes
- cliff/mountain skirt meshes
- outdoor primitive meshes
- optional decorative zone markers in dev mode

### Collision Builder

Add outdoor collision support.

Required outputs:

- terrain height sampler
- curved blockers
- circular blockers
- hazard zones
- cave/exit trigger zones
- walkable terrain metadata

### Validation

Add validation for outdoor definitions.

Validation should detect:

- malformed terrain size or segment count
- unsupported terrain stamp kinds
- missing material profiles
- non-finite coordinates
- extreme terrain heights
- overly steep authored slopes where possible
- blockers without visible structures
- exits without destination spawns
- decorative zones that accidentally claim blocking behavior

### Debug Overlay

Add a dev-only outdoor debug layer.

It should show:

- terrain grid or sampled height points
- spline centerlines and widths
- curved blocker shapes
- cliff/mountain boundary footprints
- spawn points
- exit triggers
- terrain stamp influence areas
- player sampled ground height

## Performance Rules

This must remain mobile-first.

Initial limits:

- terrain segments should remain conservative
- no physics engine
- no heavy terrain library dependency
- no real-time terrain deformation
- no dense 3D forest mesh generation at runtime
- prefer sprites/billboards for most trees and shrubs
- use generated geometry only where it affects traversal, silhouette, or collision

The first pass should prioritize reliable shape and traversal over visual excess.

## Acceptance Criteria

The milestone is successful when:

- the player can walk over non-flat terrain with correct Y height
- curved paths render and remain walkable
- ravines/ridges/cliffs feel natural instead of blocky
- visible cliff or root boundaries match collision
- no major invisible wall mismatch appears in the proving location
- terrain textures tile cleanly instead of stretching
- debug overlay clearly shows outdoor geometry and blockers
- validation catches common authoring mistakes
- the proving location can be entered from and returned to the Reliquary Field
- build and dungeon validation pass
- mobile performance remains acceptable

## Non-Goals for First Pass

Do not attempt these in the first milestone:

- full procedural open world generation
- dynamic terrain destruction
- complex navmesh generation
- realistic erosion simulation
- imported large terrain assets
- massive forest biome streaming
- advanced enemy AI pathing across every terrain case
- final horror lighting pass

This milestone is about the runtime foundation.

## Suggested PR Title

**Add DARB Outdoor terrain and forest geometry foundation**

## Suggested Implementation Order

1. Add outdoor definition schema fields.
2. Add heightfield terrain mesh generation.
3. Add terrain height sampling for player movement.
4. Add terrain stamps: hill, hollow, ridge, ravine, flatten.
5. Add spline trail mesh generation.
6. Add curved blocker collision.
7. Add cliff wall or mountain skirt primitive.
8. Add outdoor validation.
9. Add outdoor debug overlay.
10. Add Ashen Forest Proving Ground.
11. Wire entrance/return from Reliquary Field.
12. Run validation and build.

## Notes for Codex

Preserve all existing DARB interior behavior. Do not break Balthazan, Kerovac, Black Grass Temple, existing generated locations, survival systems, inventory, hunger, fishing, campfire, or GitHub Pages deployment.

Keep Vite base as `/Dread_Stone_Black/`.

Use existing texture assets where possible. Do not introduce heavy dependencies. Prefer simple generated Three.js geometry and lightweight collision math.

Every new outdoor primitive must have clear visible geometry, collision truth, validation, and debug metadata. If a blocker is intentionally invisible, it must be tagged and justified in metadata.

The first goal is not a giant finished forest. The first goal is a trustworthy outdoor authoring foundation that can later produce epic forest, mountain, ravine, riverbank, and ruin locations without blocky geometry or invisible-wall jank.
