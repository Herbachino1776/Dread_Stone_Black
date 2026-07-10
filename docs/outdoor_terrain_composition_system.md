# Outdoor Terrain Composition System

`OutdoorTerrainCompositionBuilder.js` renders large fields as mobile-safe chunks while retaining one global heightfield as truth. North Road is 500 by 1,200 meters, sampled at 192 by 360 cells and rendered as 3 by 9 chunks. Every chunk has 2,665 vertices and 5,120 triangles, below the 6,500-vertex cap.

## Shared surface truth

`createOutdoorTerrainSampler` builds one deterministic `Float32Array`. Render chunks, collision grounding, road meshes, waterways, foliage, structures, fishing checks, and development overlays all sample it. Neighboring chunks duplicate boundary vertices at exactly equal X/Z/Y coordinates; chunks do not own separate terrain simulations.

Generation order is:

1. broad hills, hollows, ridges, ravines, pond basins, and pond shoreline supports
2. destination and camp pads
3. dense downhill waterway channels and banks
4. submerged pond-floor protection where waterways connect to ponds
5. graded road deformation
6. micro detail outside protected road and water footprints

Material zones select a logical terrain material by chunk center. UVs use world X/Z distance so tiling remains continuous in scale across chunks. The builder records bounds, elevation, slope, material, road/water overlap, stamp IDs, and geometry counts per chunk.

## Authoring and budgets

Chunk columns and rows must divide the global segment counts exactly. Authored points must stay inside final bounds. A chunk may not exceed 6,500 vertices; North Road totals 71,955 vertices and 138,240 triangles, but local chunks remain individually bounded.

Run `npm run validate:north-road` for finite geometry, normals, UVs, exact seams, sampler agreement, bounds, and per-chunk budgets. `npm run validate:outdoors` adds determinism and cross-chunk regression coverage.

Known limitation: this pass chunks rendering and authoring summaries, not network streaming or dynamic unload. That remains future work if profiling proves it necessary.
