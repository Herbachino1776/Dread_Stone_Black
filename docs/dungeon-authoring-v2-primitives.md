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
