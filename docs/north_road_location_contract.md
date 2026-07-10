# North Road Location Contract

`north-road` is a separately compiled, lazy-loaded Chapter 5 wilderness location built early in parallel with the active Chapter 3 lock. It never marks Chapters 3 or 4 complete and never grants Road Warden proof.

## Bounds and route

- Authored bounds: 500 meters wide by 1,200 meters long.
- Useful traversable width: approximately 420 meters.
- Generated main-road centerline: 1,156.47 meters, including the ford and engineered fort climb.
- Terrain sectors, south to north: `NR00` Folsom North Gate Exterior Shelf, `NR01` North Road Rise, `NR02` Hunter Hollow, `NR03` Creek Lowland, `NR04` Church Grove, `NR05` Scout Ridge, `NR06` Bent Road Basin, `NR07` Growth Gate Ravine, `NR08` Empty Fort Approach.
- The Empty Fort is exterior silhouette and intentional production boundary only.

## Transition and progression contract

Normal Folsom entry requires future world state `road_warden_proof_accepted`; opening persists as `folsom_north_gate_open`. Neither state is granted by North Road development access. The return exit targets `folsom_north_gate_return` and is always safe. Development query/spawn access loads the location directly and supplies tools only through the existing development-loadout path.

## World-state ownership

Route state uses stable snake-case save keys:

- `north_road_map_updated`
- `north_road_hunter_camp_marked`, `north_road_church_camp_marked`, `north_road_scout_camp_marked`
- `north_road_hunter_root_cleared`, `north_road_church_root_cleared`, `north_road_scout_root_cleared`
- `north_road_bent_road_corrected`
- `north_road_growth_gate_left_knot_cleared`, `north_road_growth_gate_right_cords_cleared`, `north_road_growth_gate_soft_mat_cleared`
- `north_road_growth_gate_open`
- `north_road_empty_fort_approach_marked`

These are world state, never inventory tokens. Camp inspection can mark the route without creating junk items.

## Performance contract

- Terrain chunks share one sampler and stay below 6,500 vertices each.
- Normal roads use no hidden support surfaces.
- Transparent water and effects are bounded and cleaned up.
- Foliage is deterministic, distance-limited, non-colliding except for separately authored visible blockers, and excludes critical routes/casting lanes.
- Dynamic lights remain at or below four for the location.

## Development and debug

Direct development entry is `?area=north-road&spawn=<spawn-id>`. Add `devLoadout=1` for an ephemeral knife, axe, fishing rod, torch, and Keeper's Lantern; these IDs are filtered out of normal equipment saves. `debug=outdoors` enables the combined development overlay. Narrow flags are `terrain`, `ponds`, `fishing`, `foliage`, and `route`; `outdoor-material-gallery` opens the raw/final material gallery. All debug construction is guarded by `import.meta.env.DEV`.

Validation is `npm run validate:north-road`; the broader regression suite is `npm run validate:outdoors`.
