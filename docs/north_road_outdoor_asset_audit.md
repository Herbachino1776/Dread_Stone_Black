# North Road Outdoor Asset Audit

This audit records the production baseline on main at `0ae6b7a`. Run `npm run audit:outdoor-assets` for deterministic path, dimensions, alpha, category, registry-reference, and runtime-consumer output. The audit is read-only and never renames source art.

## Implementation matrix

| Area | Status | Production decision |
| --- | --- | --- |
| Shared outdoor height sampler | REUSABLE WITHOUT CHANGE | Existing height data already drives terrain mesh, collision grounding, object grounding, and explicit path corridors. |
| Large zoned terrain | MISSING | Add a location-scoped composition builder that makes chunk meshes from one global sampler. |
| Terrain-integrated path corridors | IMPLEMENTED | Reuse `OutdoorPathCorridorBuilder`; North Road authors only explicit `graded`, `conform`, or `bridge` routes. |
| Waterway corridors | MISSING | Add a cross-section builder that deforms the same terrain truth and emits water, banks, fishing candidates, crossings, audits, and debug data. |
| Pond generation | PARTIAL | Deterministic irregular outlines, animation, decor, and fishability exist; the shoreline profile needs a compatibility-preserving shared contract. |
| Fishing runtime | PARTIAL | Catch logic, fish meshes, species pools, and zone resolution exist. Zone metadata and non-ellipse containment need extension for creeks. |
| Foliage registries | IMPLEMENTED | Redwood, dark-grove, willow, cypress, ritual-tree, brush, pine, and windswept sprites are available. |
| Ecological foliage composition | REQUIRES PROFESSIONALIZATION | Existing swathes are deterministic but Folsom-specific. North Road needs named communities and road/water/casting/sightline exclusions. |
| Wilderness structures | PLACEHOLDER | General primitive walls/boulders exist. Camps, bridge, culvert, roadwork, and fort silhouette need focused kits. |
| Outdoor collision | PARTIAL | Terrain, walkable surfaces, rectangles, circles, capsules, and spline blockers exist. North Road needs visible paired boundaries and route-state blocker restoration. |
| Location lazy loading | IMPLEMENTED | Register `north-road` in the existing lazy registry. |
| Chapter 5 route state | MISSING | No current Road Warden or north-gate save key exists. Add a separate namespace without changing Chapter 3/4 completion. |
| Outdoor debug overlays | PARTIAL | Path overlay exists. Add terrain, water, pond, fishing, foliage, spawn, and route-state layers behind development guards. |
| Outdoor validation | PARTIAL | Folsom, terrain, pond, and path checks exist independently. Add North Road and cross-system validators. |
| Bespoke hero art | ASSET GAP | No bespoke fort/camp/bridge models are required for this pass; use textured procedural geometry. |

## Useful current assets

- Terrain: four grass states and four mud states under `public/assets/textures/outdoor/`.
- Rock: four dark-cliff textures under `public/assets/textures/rock/`.
- Structure: aged/dark wood, rusted metal, black/worn/limestone stone, and border-wall wood textures already exist.
- Water: six animated pond frames under `public/assets/textures/water/pond/`.
- Ecology: redwood, pine, willow, cypress, ritual tree, dark-grove, dead scrub, bramble, seedpod, and windswept sprites.
- Growth: locked scab, damaged scab, cord, and hit-decal textures are present.

No new texture is justified before the material gallery exposes a concrete gap. The first North Road pass reuses existing source textures with neutral tinting and world-scale UVs.

## Constraints found

- A single terrain mesh is capped at 16,384 cells, so a kilometer-scale location needs chunked rendering backed by one global sampler.
- Pond water and visible shore meshes derive from one irregular footprint, but their elevation bands are still visual overlays. North Road validation must compare them against final terrain.
- Fishing currently resolves ellipses or axis-aligned rectangles. Creek zones need polygon/corridor containment without replacing the existing catch loop.
- `requiredWorldState` is authored on some interactions but is not a generic route-state resolver. North Road progression must wire explicit state checks rather than assuming the field is enforced.
- The accepted audio manifest contains growth cues suitable for physical cuts/collapse, but no synthetic wilderness audio should be added.
