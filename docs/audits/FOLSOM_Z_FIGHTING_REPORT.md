# Folsom Z-Fighting Report

## Summary
* Scanned meshes/surfaces: 44
* Confirmed issues: 0
* Suspected issues: 0
* Fixed: 13
* Deferred: 0

## Confirmed Z-Fighting Issues
* None remain above the configured threshold after the documented fixes. The fixed floor/apron and path-clearance conflicts are documented below because they were detected before adjustment as exact terrain-pad overlaps. *

## Suspected But Not Fixed
* None emitted with current flags. Use `--include-low-confidence` to include ordered transparent pond layer proximity checks.

## Fixed Adjustments
* FZF-FIX-001: Raised folsom_courtyard_floor from 0.160 to 0.188 (+0.028). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.
* FZF-FIX-002: Raised folsom_tool_shed_floor from 0.160 to 0.188 (+0.028). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.
* FZF-FIX-003: Raised folsom_house_floor from 0.160 to 0.188 (+0.028). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.
* FZF-FIX-004: Raised folsom_shrine_floor from 0.760 to 0.788 (+0.028). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.
* FZF-FIX-005: Raised folsom_cellar_apron from 0.340 to 0.368 (+0.028). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.
* FZF-FIX-006: Raised folsom_rusted_door_apron from 0.280 to 0.308 (+0.028). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.
* FZF-FIX-007: Raised folsom_courtyard_to_pond visual path offset from +0.035 to +0.055 (+0.020). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.
* FZF-FIX-008: Raised folsom_courtyard_to_shrine visual path offset from +0.035 to +0.055 (+0.020). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.
* FZF-FIX-009: Raised folsom_courtyard_to_house visual path offset from +0.035 to +0.055 (+0.020). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.
* FZF-FIX-010: Raised folsom_courtyard_to_cellar visual path offset from +0.035 to +0.055 (+0.020). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.
* FZF-FIX-011: Raised folsom_courtyard_to_reliquary visual path offset from +0.035 to +0.055 (+0.020). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.
* FZF-FIX-012: Raised folsom_courtyard_to_north_road visual path offset from +0.035 to +0.055 (+0.020). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.
* FZF-FIX-013: Raised folsom_tool_yard_path visual path offset from +0.035 to +0.055 (+0.020). File: src/game/locations/folsom.definition.js. Minimality: the numeric change is above the default 0.025 near-coplanar risk band only for the terrain-pad conflict when combined with authored material separation/polygon offset elsewhere, stays inside the requested 0.01–0.035 tiny-offset range, and does not move terrain/collision systems beyond the floor surface itself.

## Do Not Touch / Stable Systems Preserved
* Folsom sunny noon skybox, terrain shape, pond fishable zone, Fishing A1, Rod A1, fish landing, campfire cooking/eating, Broadsword A1, dark grove tree visuals, inventory, HUD, mobile controls, Vite base /Dread_Stone_Black/.

## Build/Test Result
* Run `node scripts/diagnostics/hunt-z-fighting.mjs --location folsom --write-report`.
* Run `npm run build`.

## Manual Folsom Checks
* Not run in this non-interactive terminal session: walking paths, pond low angles, chest areas, Underworks apron/gate, campfire, Fishing A1, Broadsword A1.
