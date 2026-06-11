# Dungeon Integrity And Collision Truth

The Dungeon Integrity system exists to keep authored spaces structurally honest. If a wall, gate, facade, pillar, or other structural object looks solid, player collision should support it. If an edge is open, that opening should be authored as a doorway, exit, arch, passage, or explicitly decorative gap.

This is validation, not a new physics engine. It uses practical top-down rectangle heuristics because the current dungeon authoring runtime is built from rectangular rooms, wall gaps, props, blockers, exits, and exterior facade metadata.

## Core Concepts

- Room bounds: the walkable rectangle for an authored room or connector.
- Room edges: the north, south, east, and west edges of a room rectangle.
- Wall segments: the sealed pieces of a room edge after declared openings are removed.
- Authored openings: wall gaps declared by doors, connectors, exits, arches, or passages.
- Doorways: room-to-room openings that should align on room edges.
- Exits: transition openings with trigger rectangles and destination spawn ids.
- Facades: exterior entrance structures such as temple fronts, crypt mouths, gatehouses, and ruin gates.
- Visual wall coverage: the visible structural wall, gate, pylon, or facade mass.
- Collision blocker coverage: the player blocker rectangle that supports visible structure.
- Walkable area: room or field rectangles where the player is allowed to stand.
- Forbidden/outside area: space that should not be reachable unless declared.
- Leak path: a sampled path from a valid start into forbidden or behind-facade space.
- Structural warning: suspicious but potentially intentional authoring.
- Structural error: a structural lie likely to break gameplay or immersion.

## Intentional Openings

Open room edges must be declared. Use:

- `doors[].wallGaps` for room-to-room doorways and passages.
- `exits[].wallGaps` for exit thresholds.
- connector rooms with `tags: ['connector']` and `wallGeometry: false` for short traversal runs between rooms.
- explicit integrity metadata for special cases rather than relying on accidental missing walls.

An open edge without one of those declarations is treated as a missing wall, not a clever shortcut.

## Visual To Collision Truth

The validator derives structural wall segments from room bounds and declared wall gaps, then compares those segments against compiled wall blockers. It reports:

- `WALL_MISSING_COLLISION` when a visible wall or structural prop lacks collision.
- `WALL_SEGMENT_GAP` when a blocker leaves a large unintended wall gap.
- `BLOCKER_OFFSET_FROM_WALL` when blocker placement drifts away from the visual wall.

Visible structural props such as gates, pillars, facades, counters, dividers, altars, and reliquaries should use `collisionRef` unless they are explicitly listed in `integrity.nonBlockingDecor`.

## Collision To Visual Truth

Authored blockers should have visible support. A blocker is acceptable when it has:

- a visible prop with `collisionRef`
- exterior facade metadata through `collisionHullIds`
- `userData.visualStructureId`
- an explicit invisible purpose such as `worldBoundary`, `safetyBoundary`, `futureGate`, or `debugOnly`

Otherwise the validator reports `COLLISION_WITHOUT_VISUAL`, because invisible walls in normal play should be rare and documented.

## Room Edge Sealing

For each authored room, the validator builds north, south, east, and west edge records. Sealed room edges are converted into wall segments. Declared openings are subtracted from those segments.

The validator reports:

- `ROOM_EDGE_UNSEALED` for a normal room with `wallGeometry: false`.
- `DOORWAY_MISMATCH` when a door references a room but has no edge opening there.
- `EXIT_TRIGGER_OUTSIDE_OPENING` when an exit lacks a matching wall gap.

Black Grass Temple uses this to catch doorway coordinates that drift outside the real shared edge.

## Leak Detection

`DungeonLeakDetector` performs a lightweight top-down flood fill against the authored collision world. It samples from the player spawn or first room center and reports `WALKABLE_LEAK` if reachable cells escape `integrity.intendedBounds`.

This is not gameplay pathfinding. It is a cheap validation pass for obvious escape paths and missing edge seals.

## Exterior Facade Integrity

Exterior entrances use `definition.integrity.facades`. A facade should author:

- `id`, `locationId`, and `type`
- `bounds`
- `approachZone`
- `doorway.triggerId` and `doorway.openingRect`
- `behindZone`
- `allowedWalkBehind`
- `collisionHullIds`
- `visualStructureIds`
- `visualStructures`
- optional `chaliceIds`

The validator checks that the facade has real depth, the trigger sits in the entrance mass, approach and trigger points are not blocked, collision hulls have visual support, referenced chalices are grounded, and `allowedWalkBehind: false` facades do not have sampled walk-behind routes.

## Issue Codes

- `WALL_MISSING_COLLISION`: visible structural mass has no matching blocker.
- `COLLISION_WITHOUT_VISUAL`: blocker lacks visible support or an allowed invisible purpose.
- `ROOM_EDGE_UNSEALED`: normal room edge is open without connector/opening metadata.
- `DOORWAY_MISMATCH`: doorway and edge wall gaps do not agree.
- `EXIT_TRIGGER_OUTSIDE_OPENING`: exit trigger lacks a matching edge opening.
- `WALKABLE_LEAK`: flood fill reaches outside intended bounds.
- `FACADE_WALK_BEHIND_LEAK`: exterior facade allows an invalid behind-structure path.
- `FACADE_TRIGGER_NOT_EMBEDDED`: entrance trigger or doorway is not embedded in the facade.
- `WALL_SEGMENT_GAP`: blocker coverage leaves a large unintended gap.
- `BLOCKER_OFFSET_FROM_WALL`: collision and visual wall positions drift apart.
- `PROP_BLOCKS_CRITICAL_PATH`: facade trigger or approach is blocked by a hull.
- `CHALICE_NOT_GROUNDED`: referenced flame chalice is not grounded or lacks metadata.

## Running Validation

```sh
npm.cmd run validate:bgt
npm.cmd run validate:integrity
```

`validate:bgt` includes the integrity checks for Black Grass Temple. `validate:integrity` checks Black Grass Temple plus the Reliquary Field Black Grass Temple facade.

## Fixing Common Failures

- Wall missing collision: add a blocker, restore generated wall collision, or mark the prop as intentional non-blocking decor.
- Collision without visual: add a visible prop, add facade visual metadata, or mark an allowed invisible purpose.
- Doorway mismatch: move the wall gap to the room edge and keep connector rooms touching both rooms.
- Edge unsealed: set `wallGeometry` back to true or mark the space as a connector.
- Walkable leak: add visible wall/collision support or declare an intentional exit/passage.
- Facade walk-behind leak: add side/rear mass with matching collision, or explicitly allow the route with believable authoring.

## Known Limitations

- The system assumes top-down rectangular bounds.
- It does not inspect arbitrary mesh triangles.
- It cannot prove artistic intent; intentional exceptions still need metadata.
- Flood fill is sampled and validation-only, not a gameplay navigation rewrite.
- Exterior facade validation relies on authored metadata until field structures are fully compiled from definitions.
