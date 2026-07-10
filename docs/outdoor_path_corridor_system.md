# Outdoor Path Corridor System

## Purpose

`OutdoorPathCorridorBuilder.js` is the production path system for outdoor routes that must share terrain, collision, placement, and visible-surface truth. It replaces the sparse two-edge dirt ribbon for explicitly migrated paths without silently changing legacy locations.

The previous ribbon renderer sampled terrain only at authored control points, assigned the center height to both road edges, and connected those sparse pairs with long triangles. A fixed visual lift, polygon offset, and optional endpoint-interpolated collision ramps could hide z-fighting but could not prevent a route from floating across a gully, cutting through a side slope, or disagreeing with player grounding. `flatten: true` was recorded in mesh metadata but did not deform terrain.

## Architecture

The focused system is split across three runtime layers:

- `OutdoorPathCorridorBuilder.js` sanitizes explicit path contracts, densely resamples centerlines, builds bounded profiles and cross-sections, deforms corridor samples, creates meshes, exposes a shared path sampler, and records audits.
- `OutdoorTerrainBuilder.js` applies terrain operations in production order and writes corridor deformation into the final height data used by both the terrain mesh and sampler.
- `OutdoorWorldRuntime.js` routes explicit corridors through the new builder, leaves paths without `surfaceMode` on the legacy spline renderer, supplies the final sampler to foliage and object placement, and only creates constructed support surfaces for explicit bridge mode.

This is deliberately not a general road network, shader splat, or streaming framework.

## Authoring Contract

```js
{
  id: 'courtyard_to_gate',
  points: [[0, 0], [12, 8], [30, 10]],
  width: 5,
  material: 'townPath',
  surfaceMode: 'graded',
  sampleSpacing: 0.65,

  grade: {
    smoothingDistance: 5,
    maxSlope: 0.12,
    maxCrossSlope: 0.16,
    maxCut: 0.5,
    maxFill: 0.4,
  },

  crossSection: {
    crownHeight: 0.035,
    shoulderWidth: 0.9,
    shoulderDrop: 0.06,
    terrainBlendWidth: 1.4,
    lateralSamples: 7,
  },

  pathSupport: false,
  edgeMeshes: false,
}
```

Explicit corridors require a stable ID, at least two finite non-duplicate points, positive width, sample spacing from 0.35 through 2 meters, a complete grade object, and a complete cross-section object. Lateral sample counts are odd values from 5 through 9.

### Surface Modes

- `conform` uses dense multi-strip geometry seated on the final terrain. It does not grade the centerline and never creates a hidden support surface.
- `graded` creates a continuous bounded profile, deforms the terrain corridor, protects the road footprint from later micro bumps, and uses the final heightfield as collision and rendering truth.
- `bridge` is explicit constructed-span mode. It does not deform terrain. The current minimal implementation uses a continuous endpoint-to-endpoint elevation profile and can supply dense bridge support segments when `pathSupport` is enabled. A bridge is never inferred from a depression or from legacy fields.

Paths without `surfaceMode` remain legacy spline ribbons for backward compatibility.

## Generation and Stamp Order

Locations with explicit corridors compile terrain in this order:

1. broad landforms, ponds, gullies, ridges, ravines, and other large shaping
2. building pads and courtyard shelves
3. explicit graded path corridors
4. micro-bump stamps only outside protected corridor footprints

The order is metadata-visible as `terrainSampler.stampOrder`. Locations with no explicit corridors retain the previous authored stamp order exactly.

The final `Float32Array` height data feeds the rendered terrain mesh and bilinear `sampleOutdoorY(x, z)` function. Collision, authored foliage grounding, runtime outdoor primitives, fishing ground queries, and the visible road mesh consume that sampler.

## Dense Resampling

Authored points remain route-shaping controls. Each segment is resampled by world distance, normally at 0.65 meters. Segments adjacent to turns sharper than 36 degrees use denser spacing. A second deterministic refinement inserts midpoint samples when terrain curvature exceeds 0.045 meters or raw local grade rises above 135 percent of the authored maximum.

Near-duplicate points are removed. Tangents use a small centered sample window to distribute turn rotation and prevent long outer-strip triangles. Each path is capped at 768 center samples. A path mesh is capped at 6,144 vertices and 10,240 triangles.

## Grading Profile

The grader samples raw pre-corridor terrain at every generated center point and across the road bed and shoulders. A distance-weighted smoothing window removes short noise while retaining broad terrain form. The candidate profile is then projected repeatedly against:

- maximum longitudinal slope
- maximum cut
- maximum fill
- cross-section-wide cut/fill limits

Every terrain grid deformation is clamped again against the current raw height. A deep gully therefore makes the route conform more closely and produces a `fill-limit`, `grade-limit`, or cross-section conflict warning instead of becoming an unsupported dirt bridge. A final audit raises an error if a graded sample still exceeds fill tolerance.

Destination pads exist before grading. Endpoint samples begin from the pad-shaped terrain and participate in the same slope/cut/fill projection, avoiding a separate ramp or vertical endpoint kink.

## Cross-Section and Terrain Deformation

The canonical seven-sample layout is:

```text
outer blend | shoulder | road edge | crown | road edge | shoulder | outer blend
```

The road bed rises by `crownHeight` at the center and eases to the profile height at each edge. Shoulders descend by `shoulderDrop`. The outer region uses smoothstep blending back to untouched terrain. At intersecting footprints, deterministic distance weights blend contributing corridor targets so courtyard and fork junctions do not create height seams.

The same lateral layout drives terrain deformation, visible vertices, UV width, cross-slope auditing, and the protected foliage/micro-detail footprint.

## Visible Mesh and Surface Truth

Road rows are generated at the dense center samples with 5–9 vertices across each row. UV U is cumulative world distance; UV V is world-scaled cross-section width. Triangle winding is checked and corrected to keep normals upward. Generated geometry is audited for finite attributes, matching UV/normal counts, degeneracy, and long edges.

Normal dirt paths sit on `terrainSampler.sampleOutdoorY`. A 0.006 meter visual clearance and very small polygon offset remain only as raster safeguards. They are not collision offsets and do not compensate for terrain disagreement.

For graded Folsom paths, surface truth is:

```text
final terrain height data
  -> terrain mesh
  -> collision grounding
  -> path surface query
  -> visible road vertex base height
  -> foliage/object placement
```

Polygon floors keep their existing higher-priority behavior at building interiors and authored courtyards.

## Folsom Migration

These seven paths use explicit `graded` mode:

- `folsom_courtyard_to_pond`
- `folsom_courtyard_to_shrine`
- `folsom_courtyard_to_house`
- `folsom_courtyard_to_cellar`
- `folsom_courtyard_to_reliquary`
- `folsom_courtyard_to_north_road`
- `folsom_tool_yard_path`

Their authored route points, widths, materials, and endpoints are preserved. Folsom uses 0.65 meter sampling, seven lateral samples, a 0.12 maximum longitudinal slope, a 0.16 maximum road-bed cross-slope, 0.7 maximum cut, and 0.55 maximum fill. The adjusted cut/fill allowances reflect the audited pond draw and reliquary road cut while remaining bounded and terrain-supported.

All seven disable `pathSupport` and edge meshes. They no longer author `flatten` or `visualYOffset`. The Folsom terrain grid is 96 by 96 cells (9,216 cells / 9,409 vertices), which preserves the existing mobile warning budget while resolving corridor shoulders more reliably than the former 64-cell grid.

Folsom foliage generation receives exact polyline corridor exclusion zones. Runtime foliage construction also rejects placements inside the compiled protected footprint and re-samples accepted placements against the final heightfield.

## Validation and Audit

Every corridor summary contains:

- authored and generated point counts
- generated vertices and triangles
- total length and elevation range
- maximum grade and road-bed cross-slope
- maximum cut and fill
- unsupported span count
- terrain agreement error
- longest triangle edge and degenerate triangle count
- warnings and errors

Validation covers finite positions/normals/UVs, upward normals, geometry counts, degeneracy, long triangles, sample and geometry budgets, bounds, grade, cross-slope, cut/fill, unsupported spans, deterministic generation, endpoint joins, and mesh/sampler agreement.

Run:

```sh
npm run validate:path-corridors
npm run validate:oarb-terrain
npm run validate:folsom
npm run build
```

The focused suite contains flat, rolling, shallow/deep gully, side-slope, sharp-turn, building-pad, courtyard, boundary, determinism, sampler-agreement, and Folsom regression cases. The Folsom regression explicitly fails if paths return to sparse authored rows or a two-edge ribbon.

## Debug Visualization

The development overlay can be enabled by setting `globalThis.__DSB_PATH_CORRIDOR_DEBUG__ = true` before outdoor runtime construction in a Vite development build. It shows center samples, outer corridor boundaries, final heightfield profiles, and warning state. The audit legend is:

- green: seated
- red: intended profile buried by final terrain
- blue: intended profile above final terrain
- yellow: grade, cross-slope, cut, fill, bounds, or unsupported-span warning

The overlay is guarded by `import.meta.env.DEV` and is never created in production builds.

## Legacy Compatibility

`OutdoorSplineBuilder.js` still renders paths with no explicit `surfaceMode`. Existing non-Folsom locations therefore retain their visuals and optional support behavior. Legacy `flatten: true` is deprecated: validation warns that it is visual metadata and does not grade terrain. It is not silently reinterpreted as `graded`.

Legacy visual offsets, edge meshes, and support surfaces remain available only to unchanged old definitions. New paths should use the explicit corridor contract. Explicit non-bridge corridors cannot opt into path support.

## Known Limitations

- The road material has a hard visual edge; the terrain height blends, but shader-level albedo splatting is not part of this pass.
- Turn handling smooths cross-section orientation rather than generating full civil-engineering miter/intersection topology. Severe near-reversal turns emit an authoring warning.
- Explicit bridge mode provides a deterministic profile and dense collision segments but no bridge rail, pier, deck thickness, or structural art.
- The heightfield still resolves deformation at the location terrain grid. Very narrow roads need a suitable terrain segment density.
- Drainage culverts, retaining walls, switchbacks, ruts, puddles, debris, and wheel tracks remain future authored or visual systems.

## Recommended Visual Follow-Up

The next low-risk polish pass should add terrain/path albedo feathering at the outer blend, subtle seeded edge breakup that does not change collision, and optional lightweight cut-bank dressing where audited cuts are visually exposed. Structural sampler agreement should remain unchanged.
