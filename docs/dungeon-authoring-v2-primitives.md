# Dungeon Authoring Runtime v2 primitives

This layer adds optional primitives beside the legacy rectangular `rooms`, `doors`, `props`, and `blockers` schema. Existing rectangular maps do not need any v2 fields.

## `polygonFloors`

A polygon floor creates a flat walkable-looking mesh from X/Z points. The current runtime triangulates the polygon with `THREE.ShapeUtils.triangulateShape`, places it at `y` (default `0`), and applies the same material/texture profile patterns used by legacy room floors.

```js
{
  id: 'shrine_floor',
  points: [[-6, -5], [5, -5], [7, -2], [5, 5], [-4, 6], [-7, 1]],
  y: 0,
  material: 'floor',
  roomId: 'shrine'
}
```

## `wallSegments`

A wall segment is an explicit wall box running from `from` to `to`. It supports diagonal walls by rotating the box along the segment direction. `height` defaults to `3.5`; `thickness` defaults to the dungeon wall thickness or `0.32`.

## `doorGaps`

A door gap references a wall segment and removes a span from the visual wall and compiled wall collision. The first implementation splits the wall segment into pieces around each gap.

```js
{ id: 'entry_gap', wallSegmentId: 'south_wall', centerT: 0.5, width: 2.2 }
```

`centerT` is a normalized 0-to-1 position along the segment, and `width` is in world units.

## `wallPropAnchors`

A wall prop anchor resolves an authored `t` position along a wall segment plus the segment normal. The initial visible integration supports `kind: 'torchFixture'`; simple marker/panel anchors are safe to validate and extend later.

```js
{ id: 'torch_left', wallSegmentId: 'northwest_wall', t: 0.45, height: 2.15, offset: 0.16, kind: 'torchFixture' }
```

## Known limitations

- Polygon floors are visual/runtime foundation geometry; exact polygon walkable collision is not implemented yet.
- V2 wall collision compiles to simple blocker rectangles around split wall pieces, which is adequate for the first diagonal-wall pass but not a full oriented physics shape.
- Wall prop anchors currently cover torch fixtures and simple marker/panel geometry.
- Navigation still relies on the existing room graph. V2 locations should keep a small legacy room bounds entry for spawn/nav compatibility until a later navmesh pass.

## Compatibility

All v2 fields are optional. Legacy maps using only rectangular rooms, connectors, doors, props, blockers, spawns, exits, and light fixtures continue to compile through the existing paths.

## DARB v2.1 primitives

All v2.1 fields are optional and coexist with legacy rectangular rooms plus the v2 polygon floor/wall fields.

### `pathRibbons`

Use path ribbons for streets, alleys, canal-side walks, curved corridors, trails, and future patrol hints. The first runtime pass renders each pair of points as a straight joined strip.

```js
pathRibbons: [{
  id: 'market_spine',
  points: [[-32, -10], [-18, -4], [-4, -7], [14, 2], [31, 8]],
  width: 4.5,
  y: 0.02,
  material: 'floor_worn_stone_01',
  tags: ['street', 'main-path'],
}]
```

### `platforms`

Platforms create an irregular raised footprint with a top floor and vertical side faces. They are suitable for shrine bases, ziggurat terraces, altars, docks, and plinths.

```js
platforms: [{
  id: 'ziggurat_lower_terrace',
  footprint: [[-10, -8], [12, -8], [14, 6], [-8, 9]],
  y: 0,
  height: 1.2,
  material: 'stone_limestone_block_01',
  topMaterial: 'floor_limestone_temple_01',
  tags: ['raised', 'temple'],
}]
```

### `ramps` and `stairs`

Ramps connect authored elevation levels with a simple sloped deck. Stairs render visual step boxes over the same authored span; movement still uses the 2D collision/walkable approximation.

```js
ramps: [{ id: 'market_to_temple_ramp', from: [-4, 0], to: [4, 6], width: 3.2, y0: 0, y1: 1.2, material: 'floor_limestone_temple_01' }],
stairs: [{ id: 'ziggurat_front_steps', from: [0, -8], to: [0, -2], width: 5, y0: 0, y1: 1.2, steps: 6, material: 'stone_limestone_block_01' }]
```

### `bridges`

Bridges are rectangular decks along a line with optional simple railings. Use them for river, canal, and void crossings.

```js
bridges: [{ id: 'canal_bridge_01', from: [-6, 0], to: [6, 0], width: 3.4, y: 0.35, thickness: 0.25, material: 'wood_dark_aged_01', railing: true }]
```

### Debug overlay

In development builds, press `F2` to toggle the dungeon debug overlay and `F3` to cycle layers. The v2 layer includes polygon floor outlines, wall segments and normals, door/anchor markers, path ribbon centerlines, platform outlines, ramp/stair arrows, bridge spans, blockers, and spawn markers. The overlay is disabled by default and is gated behind `import.meta.env.DEV`.

## DARB v2.2 walkable elevation

Compiled v2 locations now include `walkableSurfaces` in addition to the legacy rectangular `walkableRects`. The player controller samples these surfaces after X/Z collision to decide the floor Y under the camera, so v2 visual architecture can be traversed without introducing a full physics engine.

Supported runtime surface kinds:

- `flatPolygon` — polygon floor at a constant `y`.
- `platformTop` — platform footprint at `platform.y + platform.height`; the top wins over lower floor surfaces by priority.
- `ramp` — oriented rectangle from `from` to `to`; height linearly interpolates from `y0` to `y1` along the ramp direction.
- `stairRamp` — oriented rectangle sampled like a ramp but quantized by `steps`, giving stable stair-height movement while preserving simple collision.
- `bridgeDeck` — oriented rectangle at constant `y`; bridge decks can pass over canal/void blockers when the sampled surface is the bridge.

Surface priority resolves overlaps. Ramps/stairs use higher priority than base floors, bridges beat the canal floor/blocker zone, and platform tops beat the lower courtyard floor. Legacy rectangular dungeons that do not author v2 primitives keep the old flat fallback height.

### Authoring notes

- Align the top of a ramp or stair run with the edge of a `platformTop`. Directly stepping from a low floor onto a high platform is blocked by the lightweight max-step check, but arriving through a ramp/stair is allowed.
- Use enough `width` on ramps/stairs/bridges for the player radius plus steering tolerance.
- Keep canal/void blockers below bridge spans as normal blockers; the runtime ignores those blocker hits only while the sampled surface is a `bridgeDeck`.
- The first pass is still a lightweight controller, not a rigid-body physics system. Platform side collision is approximated by the max-step rule, and stairs use sampled height rather than per-tread mesh collision.

### Wall closure validation

V2 `wallSegments` are grouped by `roomId` and checked for endpoint continuity. The validator warns when a segment end does not approximately connect to the next segment start, unless the gap is claimed by a `doorGap` or tagged intentionally. Use tags such as `intentional-gap`, `broken-wall-gap`, `open-courtyard`, or `connector` on the segment or room for authored openings.

Example warning:

```text
V2 wall loop warning: v2_canal_shrine_courtyard has an unclaimed gap between wall_north and wall_west_high.
```

### Debug overlay

In development builds, `F2` toggles the dungeon debug overlay and `F3` cycles layers. The new elevation layer draws platform top outlines, ramp/stair direction arrows, bridge deck footprints, the sampled floor Y under the player marker, and markers for wall closure warnings.

## DARB v2.3 Architectural Primitives

`architecturalPrimitives` is an optional authored array for lightweight runtime-generated ancient-world architecture. It sits beside `polygonFloors`, `wallSegments`, `pathRibbons`, `platforms`, `ramps`, `stairs`, and `bridges`; legacy rectangular maps can omit it.

Shared fields:

```js
architecturalPrimitives: [{
  id: 'example_pillar',
  kind: 'pillar',
  position: [0, 0, 0],
  yaw: 0,
  material: 'wall',
  roomId: 'courtyard',
  tags: [],
  userData: {},
}]
```

Supported primitive kinds:

- `pillar`: octagonal/cylindrical column (`position`, `radius`, `height`, optional `sides`). Blocks by default.
- `brokenPillar`: shorter tilted column fragment (`position`, `radius`, `height`, optional `tilt`). Blocks by default.
- `arch`: two posts plus lintel/cap (`position`, `width`, `height`, `thickness`, optional `depth`). Side posts block; center stays open.
- `doorFrame`: two posts plus lintel for transitions. Side posts block; center stays open.
- `lowWall`: low segment from `from` to `to` with `height` and `thickness`. Blocks by default.
- `railing`: thin beam and repeated posts from `from` to `to`; visual-only unless `blocksPlayer: true`.
- `altar`: stacked plinth box (`position`, `width`, `depth`, `height`, optional `topMaterial`). Blocks by default.
- `stela`: upright slab (`position`, `width`, `height`, `thickness`). Blocks by default.
- `obelisk`: simple stacked/taper-suggested landmark (`position`, `height`, `baseWidth`). Blocks by default.
- `wallPanel`: slab attached to a `wallSegmentId` at `t` using the wall normal; visual-only by default.
- `canalWater`: flat dark strip from `from` to `to` with `width` and optional `emissiveColor`; visual-only.
- `curb`: very low path/causeway edge from `from` to `to`; visual-only unless `blocksPlayer: true`.

Example line and wall-attached primitives:

```js
{ id: 'canal_water', kind: 'canalWater', from: [-12, 1.5], to: [-5.5, 1.5], width: 2.4, y: 0.03, material: 'water' }
{ id: 'warning_panel', kind: 'wallPanel', wallSegmentId: 'east_wall', t: 0.65, width: 1.4, height: 1.8, offset: 0.08, material: 'temple' }
```

Validation checks that each primitive has an id, supported `kind`, required finite points/positions, positive dimensions, and valid `wallSegmentId` references for `wallPanel`. Unsupported optional fields should be ignored or warned about by future tooling rather than crashing runtime compilation.

Debug overlay: in dev builds, `F2`/`F3` now includes primitive markers, line bounds for segment-style primitives, arch/door-frame opening guides, collision-colored markers, and wall-panel normal arrows.

Known limitations: arches use a lintel/cap suggestion rather than true curved mesh, obelisks use simple box stacking instead of custom taper geometry, primitive collision is axis-aligned and approximate, and canal water is a flat material strip rather than a full water shader.
