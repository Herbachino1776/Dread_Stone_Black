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
