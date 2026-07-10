# Outdoor Waterway System

`OutdoorWaterwayBuilder.js` turns a short authored polyline into a dense, deterministic downhill profile. A waterway contract defines source/outlet elevations, minimum and maximum slope, variable width/depth, bank widths, materials, fishing reaches, crossings, and semantic endpoint tags.

## Cross-section

From center outward the terrain regions are channel bed, channel edge, submerged shelf, inner/outer wet bank, and dry transition. The runtime deforms the shared heightfield before road grading. Water meshes use the same dense center samples; banks and water therefore cannot separate from their channel truth.

Ford crossings locally reduce channel depth. Bridges use an explicit `bridge` path and visible deck kit. Culverts keep the water profile continuous beneath visible inlet/outlet headwalls. Ordinary dirt paths never receive hidden span collision.

North Road authors Scout Rill, Prayer Run, Hunter Creek, and Fort Approach Drain. The first three are named fishable waterways; Hunter Creek has two fishing reaches. Profiles contain 1,276 center samples in total and zero uphill segments.

Waterway meshes share logical bank and animated-water materials by material key. North Road's four waterway surfaces use one animated creek material, so animation timing and texture allocation are shared.

Validation rejects uphill or discontinuous profiles, dry channel centers, missing termination contracts, invalid species, malformed crossings, and non-finite geometry. Debug blue lines show accepted downhill profiles; red is reserved for an uphill error.

Known limitation: confluences share terrain and semantic connection tags but do not yet build bespoke junction topology or foam art.
