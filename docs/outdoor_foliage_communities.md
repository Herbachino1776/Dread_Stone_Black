# Outdoor Foliage Communities

`NorthRoadFoliageKit.js` places deterministic billboard ecology from named community presets rather than scattering one global random pool. Presets cover redwood upland, hunter hollow, creek lowland, church grove, scout ridge, Bent Road, growth ravine, and fort approach.

Each community owns a seed, elliptical bounds, target count, sprite pool, size range, sink/root offsets, and ecological tags. North Road currently resolves 712 accepted billboards across eight communities. Rejected candidates are retained only as development debug data.

Placement excludes road cores and blend footprints, waterway channels and banks, pond water and shoreline clearances, fishing lanes, camp clearings, crossings, the Empty Fort sightline, and required route openings.

Final billboard Y is sampled after hydrology and grading. Source sprite PNGs must exist, dimensions must be positive, alpha is preserved, and sprites do not become collision. Large visible roots, walls, and structures use separate authored blockers.

The development overlay uses green for accepted placements and red for rejected candidates. Production builds never construct it. Validation checks sprite paths, scales, bounds, water/road/casting exclusions, grounding contracts, count budgets, and determinism.

Future enemies should use the same ecological and sightline exclusions; no enemy placements are authored in this pass.
