# Folsom World Audit

## Scope

This is an audit-only report for Folsom world consistency, visible geometry, collision, pond/terrain behavior, foliage integration, lighting/sky consistency, and recent path/paver regressions. No gameplay, geometry, asset, lighting, sky, fishing, sword, HUD, movement, terrain, pond, foliage, campfire, or collision code was changed in this PR.

## Executive Summary

- The path paver/walkway wall regression is confirmed: every Folsom spline trail now generates visible dark-stone rectangular edge boxes per segment, which can read as ugly strewn rectangles and do not create mitered or curved joins.
- Invisible/poorly explained collision is confirmed around generated walkable path-support ramps: they are not rendered, but they override player grounding and can feel like raised slabs over gullies.
- The pond-water/shore mismatch is plausible and high risk: Folsom water is a single transparent irregular disc at `waterY = -0.17`, while mud/shore/terrain layers use different generated outlines and heights. The system has multiple small vertical offsets and transparent/depth-order choices that can expose gaps from low approach angles.
- Terrain sinking on slopes is plausible: runtime terrain, path support surfaces, structure floors, and player/camera grounding all coexist, and the path supports interpolate centerline endpoint heights rather than sampling the full terrain under the player footprint.
- The old explicitly authored fake 3D Folsom tree is removed, but a generic legacy fake-tree code path still exists for `harvestableTrees`; Folsom currently uses billboard redwoods and has `harvestableTrees: []`.
- Stump material currently appears intentionally brown/dark-aged wood, not a raw placeholder; preserve the current stump material unless a visual inspection shows a mismatch in-game.
- Folsom sky is configured for sunny noon; no red storm/dusk skybox reference is active in the Folsom definition, though old retro red sky assets remain in `public/assets`.

## Confirmed Problems

### FWA-001: Visible paver edge rectangles are generated along every spline trail

- **Severity:** High
- **Category:** Visual / Navigation
- **Observed Problem:** Folsom's paths generate two rows of visible rectangular dark-stone paver/edge boxes for every path segment. With seven Folsom trails and three segments each, this produces roughly forty-two individual rectangular edge meshes before any joins/corners are considered. These match the user report that ugly rectangles appear strewn around Folsom.
- **Likely Root Cause:** `createOutdoorSplineTrailEdgeMeshes()` creates one `BoxGeometry` per segment side using `length + thickness * 0.55`, a fixed default dark-stone material, and segment-local rotation. It does not create continuous curved ribbons, rounded corners, clipped joins, or mitered intersections, so angled splines produce separated rectangular slabs/curbs.
- **Files / Objects / IDs Involved:** `folsomDefinition.splineTrails` defines the seven path IDs `folsom_courtyard_to_pond`, `folsom_courtyard_to_shrine`, `folsom_courtyard_to_house`, `folsom_courtyard_to_cellar`, `folsom_courtyard_to_reliquary`, `folsom_courtyard_to_north_road`, and `folsom_tool_yard_path`. `OutdoorSplineBuilder` emits mesh names like `<trail>_left_paver_edge_<index>` and `<trail>_right_paver_edge_<index>`.
- **How To Reproduce:** Load Folsom, walk from the courtyard along each trail, and inspect both path edges at bends. Toggle any scene/object inspector if available and look for `OARB-spline-path-edges-*` groups and child paver edge meshes.
- **Recommended Fix:** In a follow-up repair PR, either remove the visible edge mesh pass for Folsom or replace it with a continuous terrain-conforming edge/ribbon that supports bevels/mitered joins and is opt-in per trail. Keep this PR audit-only.
- **Risk Notes:** Removing or hiding the paver edge visuals is safer than changing collision because the current edge group user data says the edge is visual-only and path support handles walkability.
- **Suggested Follow-up PR Title:** Remove janky Folsom path paver rectangles

### FWA-002: Path support creates invisible walkable slabs/ramps over terrain

- **Severity:** High
- **Category:** Collision / Terrain / Navigation
- **Observed Problem:** Each Folsom spline trail creates invisible walkable support surfaces. These can make paths feel like invisible raised slabs, especially where gullies or terrain depressions sit under the path.
- **Likely Root Cause:** `createOutdoorSplinePathSupportSurfaces()` emits one invisible `ramp` surface per spline segment with `y0`/`y1` sampled only from the segment endpoints plus a fixed `0.055` offset. DungeonScene then appends those surfaces directly to collision walkable surfaces.
- **Files / Objects / IDs Involved:** Support IDs such as `folsom_courtyard_to_pond_path_support_0`; generated from `folsomDefinition.splineTrails`; appended in `DungeonScene.addAuthoredOutdoorTerrain()`.
- **How To Reproduce:** Walk along paths that cross depressions, especially courtyard-to-pond, courtyard-to-north-road, courtyard-to-cellar, and work-yard. Watch for sudden floating/raised grounding or camera height changes that do not match visible grass/terrain.
- **Recommended Fix:** In a follow-up PR, make path support optional per trail or derive support from the actual path ribbon/terrain mesh with tighter sampling and debug visualization. Validate against player height and camera/rod height.
- **Risk Notes:** This affects navigation and camera/rod presentation. Fix separately from paver visuals so visual cleanup cannot accidentally change movement.
- **Suggested Follow-up PR Title:** Audit and repair Folsom invisible path support slabs

### FWA-003: Folsom Underworks gate is visual-only, with no paired blocker

- **Severity:** Medium
- **Category:** Collision / Interaction
- **Observed Problem:** The Folsom Underworks entrance gate is authored as locked/passable false for presentation, but `blocksPlayer: false` and its user data says collision is visual-only. The user-reported “invisible blockers around Folsom Underworks entrance” are not explained by this gate object; if the player feels blocked, likely culprits are nearby path support/floor/terrain height transitions, nearby architecture, or interaction range rather than a gate blocker.
- **Likely Root Cause:** The Underworks gate intentionally avoids generated primitive collision while the cellar apron, terrain pad, path support, and inspect interaction overlap in the same area.
- **Files / Objects / IDs Involved:** `folsom_cellar_gate`, `folsom_cellar_apron`, `folsom_cellar_pad`, `folsom_underworks_locked`, and the `folsom_courtyard_to_cellar` path/support surfaces.
- **How To Reproduce:** Approach the Underworks gate from the courtyard path and from both apron corners. Attempt to walk through/around the visible gate and watch for blocking that does not match the gate frame.
- **Recommended Fix:** In a follow-up PR, inspect runtime collision debug around the cellar apron and path support. If a blocker is desired, make it visible and explicit; if not, remove the invisible snag source.
- **Risk Notes:** Do not add or remove collision in the same PR as path visual cleanup unless the exact runtime blocker has been identified.
- **Suggested Follow-up PR Title:** Remove or document Folsom Underworks invisible collision snag

### FWA-004: Pond water/shore is prone to visible gaps from low angles

- **Severity:** High
- **Category:** Pond / Visual / Terrain
- **Observed Problem:** Folsom pond water can plausibly appear not to meet shore/bank geometry from some approach angles. The pond water is one transparent irregular disc, while mud bed and wet-shore meshes are separate geometries with separate outlines and vertical offsets.
- **Likely Root Cause:** `OutdoorPondBuilder` sets Folsom water around `-0.17`, mud above water, wet shore above mud, terrain support below max shore height, and a generated water floor. `DungeonScene.addAuthoredWaterBodies()` renders separate bed, shore, and water meshes with transparency/depth settings and render order. Any outline mismatch, depth-write behavior, or terrain sampler mismatch can expose under-water/under-shore gaps.
- **Files / Objects / IDs Involved:** `folsom_starter_pond`, `folsom_starter_pond_water`, `folsom_starter_pond_bright_mud`, `folsom_starter_pond_wet_shore`, `folsom_starter_pond_outline_support`, and `DungeonScene.addAuthoredWaterBodies()`.
- **How To Reproduce:** Approach the pond from the courtyard-to-pond path, west reed bank, and southeast/backdrop grove. Lower the camera angle near the shore and look along the water plane edge for see-through gaps or exposed underside.
- **Recommended Fix:** In a follow-up PR, validate water, mud, wet-shore, terrain support, and render-order/depth settings together. Prefer increasing water/shore overlap or conforming shore/water outlines rather than moving the whole pond blindly.
- **Risk Notes:** Fishing depends on pond water/fishable-zone behavior. Keep fishing A1 and rod behavior untouched while fixing visuals.
- **Suggested Follow-up PR Title:** Fix Folsom pond water and shore seam mismatch

### FWA-005: Folsom terrain grounding has multiple competing support layers

- **Severity:** High
- **Category:** Terrain / Navigation / Interaction
- **Observed Problem:** The reported player sinking through grass/terrain and fishing rod disappearing on small hills is consistent with a mismatch between terrain sampling, walkable surfaces, and camera/player grounding. Folsom has large height stamps, flatten pads, micro bumps, pond cuts, path ribbons, and invisible path supports all contributing to perceived ground height.
- **Likely Root Cause:** The terrain mesh and sampler share generated height data, but path support surfaces are separate collision surfaces with higher priority; structure polygon floors also sit at authored heights. Player/camera state may sample a different surface than the visible terrain/foliage/rod expectation.
- **Files / Objects / IDs Involved:** `folsomTerrain.heightStamps`, `createOutdoorTerrainSampler()`, `createOutdoorTerrainMesh()`, `createOutdoorSplinePathSupportSurfaces()`, and collision walkable surfaces in `DungeonScene`.
- **How To Reproduce:** Walk slowly across small hills and slopes, especially around west shoulder hill, courtyard-to-pond draw, house-yard mound, northeast roll, and path transitions. Equip/use rod while walking uphill and watch for camera/player height dipping below visible terrain.
- **Recommended Fix:** In a follow-up PR, add a Folsom ground-height debug pass or route validation screenshots, then reconcile player grounding priority between terrain, polygon floors, and path support.
- **Risk Notes:** This is high impact but risky because it can affect movement, rod visibility, fishing casts, and interaction reach.
- **Suggested Follow-up PR Title:** Repair Folsom terrain grounding and path support height mismatches

### FWA-006: Folsom still has many harvestable billboard redwoods near paths/edges

- **Severity:** Medium
- **Category:** Foliage / Interaction / Navigation
- **Observed Problem:** Folsom uses generated dark-grove/redwood billboard swathes. Redwoods are harvestable by default when added as authored foliage billboards, which can create many interaction targets and stump placements in areas near paths, gates, pond backdrop, and entrances.
- **Likely Root Cause:** `addAuthoredFoliageBillboards()` creates a harvestable interaction for every placement whose layer is `redwood` unless `placement.harvestable === false`. The Folsom swathe generator does not appear to set `harvestable: false` for decorative/world-boundary redwoods.
- **Files / Objects / IDs Involved:** `FOLSOM_FOLIAGE_SWATHE_SPECS`, generated IDs like `folsom_inside_cedar_redwood_belt_*`, `folsom_southeast_redwood_screen_*`, `folsom_reliquary_dark_cedar_redwoods_*`, and runtime IDs `redwood_harvest_###`.
- **How To Reproduce:** Walk near inner-edge redwoods, pond-side redwood screen, shrine grove, north-road cedars/redwoods, and reliquary grove with the axe available. Check whether unexpected trees are interactable or later replaced by stumps in bad positions.
- **Recommended Fix:** In a follow-up PR, decide which Folsom redwoods are decorative vs harvestable and explicitly mark decorative/boundary swathes as non-harvestable if needed.
- **Risk Notes:** Do not alter harvesting in this audit PR; harvesting, inventory, and survival systems are stable gameplay surfaces.
- **Suggested Follow-up PR Title:** Limit Folsom harvestable redwoods to safe authored trees

### FWA-007: Legacy fake-tree code path remains, but current Folsom fake primitive tree is removed

- **Severity:** Low
- **Category:** Visual / Foliage
- **Observed Problem:** The Folsom definition confirms the old `folsom_work_yard_tree` primitive cylinder/cone fake tree was removed and `harvestableTrees` is empty. However, `DungeonScene.addAuthoredOutdoorSurvivalObjects()` still contains a generic cylinder/cone fake-tree renderer for any future `harvestableTrees` entries.
- **Likely Root Cause:** Folsom migrated to dark redwood billboard swathes but the shared authored survival-tree implementation remains available for other definitions/future use.
- **Files / Objects / IDs Involved:** Removed/legacy ID noted in source: `folsom_work_yard_tree`; current `harvestableTrees: []`; generic fake-tree group naming `${tree.id}-harvestable-tree`.
- **How To Reproduce:** Search the current Folsom definition for `folsom_work_yard_tree` and inspect Folsom in-game near the pond/work-yard. If a fake 3D tree remains visible, it is likely from another runtime path or stale build/cache, not this definition entry.
- **Recommended Fix:** If a fake tree is still visible in-game, identify its runtime object name with a scene inspector. If it comes from `harvestableTrees`, remove or replace that future entry in a separate PR.
- **Risk Notes:** Do not delete shared fake-tree code without confirming other locations do not use it.
- **Suggested Follow-up PR Title:** Remove any remaining Folsom fake 3D tree visual

### FWA-008: Stump material is already brown/dark aged wood, but placement height is flat

- **Severity:** Low
- **Category:** Visual / Foliage
- **Observed Problem:** The stump material issue appears mostly resolved in code: the stump uses `wood_dark_aged_01.png` with brown bark/cap tints. However, stump placement uses `position.y = 0.31` rather than sampling terrain at the stump point inside `addFieldStump()`, so stumps created from zero-y billboard harvest positions may float or sink on Folsom slopes.
- **Likely Root Cause:** `addFieldStump()` ignores incoming `position.y` and does not sample `outdoorTerrainRuntime`; `createRedwoodHarvestable()` stores billboard stump positions with y = 0.
- **Files / Objects / IDs Involved:** `addFieldStump()`, `createRedwoodHarvestable()`, texture path `TEXTURE_PATHS.stumpBark`, and runtime stump names `<treeId>-chopped-stump`.
- **How To Reproduce:** Harvest redwood billboards on slopes, then inspect the stump base relative to visible terrain. Confirm bark/cap are brown wood rather than gray placeholder.
- **Recommended Fix:** In a follow-up PR, preserve the material but ground stumps using terrain sampler or original billboard placement y.
- **Risk Notes:** Stump grounding touches survival visuals and saved harvested state; keep it isolated.
- **Suggested Follow-up PR Title:** Ground Folsom chopped stumps on terrain without changing materials

### FWA-009: Sunny noon sky is active for Folsom; old red sky assets are not active

- **Severity:** Low
- **Category:** Lighting
- **Observed Problem:** Folsom is configured to use a sunny noon panorama as a scene background with bright fog/background/ambient/directional light. No active Folsom definition reference to the retro red morning skybox was found.
- **Likely Root Cause:** Recent Folsom sky work switched the active sky to `sunny_noon_skybox_folsom_01.png`; old assets remain in `public/assets/textures/sky` but are not referenced by Folsom.
- **Files / Objects / IDs Involved:** `folsomDefinition.skyDome.texturePath`, `folsom_noon_ambient`, `folsom_noon_sun`, and `DungeonScene.applyCompiledOutdoorSkyDome()`.
- **How To Reproduce:** Load Folsom and verify the scene background is the sunny noon sky, not a red/dusk storm dome. Search for `red_morning_skybox_folsom_retro_02` references in source.
- **Recommended Fix:** Do not change lighting in this audit. If the scene still looks gloomy, investigate material emissive/fog/tonemapping separately from the skybox.
- **Risk Notes:** Lighting changes can mask geometry bugs; defer until pavers, blockers, pond, and terrain are fixed.
- **Suggested Follow-up PR Title:** Tune Folsom lighting only after geometry repairs

### FWA-010: Campfire flame uses transparent crossed planes and no depth write

- **Severity:** Medium
- **Category:** Visual / Interaction
- **Observed Problem:** The campfire uses two crossed transparent flame planes with `depthWrite: false`, `alphaTest: 0.04`, opacity, and render order 12. This can make sprite rectangles or sorting artifacts visible depending on texture alpha and view angle.
- **Likely Root Cause:** The flame is a transparent billboard material shared by both crossed planes. Low alpha test and disabled depth writing are common causes of rectangular halo/rectangle visibility.
- **Files / Objects / IDs Involved:** `folsom_courtyard_campfire`, `field-campfire-animated-crossed-flame-billboard`, `field-campfire-flame-cross-plane-1`, `field-campfire-flame-cross-plane-2`, and campfire use interaction `<campfireId>_use`.
- **How To Reproduce:** Stand near the Folsom courtyard campfire and rotate around it. Look for square sprite bounds, excessive opacity, too-large flame scale, or logs floating/sinking. Confirm the `Small Campfire` interaction remains reachable within range.
- **Recommended Fix:** In a follow-up PR, adjust alpha test/material/depth settings or flame sprite trim after capturing screenshots. Do not change cooking interaction reach unless separately broken.
- **Risk Notes:** Visual-only flame fixes should not touch cooking/eating inventory flows.
- **Suggested Follow-up PR Title:** Polish Folsom campfire flame transparency without changing cooking

## Suspected Problems

### FWA-S01: Paver/edge geometry may not follow terrain at spline bends

- **Confidence:** Medium
- **Severity:** Medium
- **Category:** Visual / Terrain
- **Observed Problem:** Path edge boxes sample terrain at segment endpoints and side-offset endpoint positions, then create straight boxes across the segment. At bends or uneven terrain, boxes may float, bury, or cross through the path.
- **Likely Root Cause:** Segment-only edge mesh construction does not resample intermediate heights or solve bend joins.
- **Files / Objects / IDs Involved:** `makeSegmentEdgeMesh()`, `createOutdoorSplineTrailEdgeMeshes()`, and all Folsom `*_paver_edge_*` meshes.
- **How To Reproduce:** Inspect each path bend from a low angle and look for dark-stone edges clipping into slopes or hovering.
- **Recommended Fix:** Same follow-up as FWA-001; remove or replace edge mesh generation.
- **Risk Notes:** Visual repair can be low risk if collision remains untouched.
- **Suggested Follow-up PR Title:** Replace Folsom paver boxes with terrain-conforming path edges

### FWA-S02: Pond boulder blocker may feel larger than visible stones

- **Confidence:** Medium
- **Severity:** Medium
- **Category:** Collision / Pond
- **Observed Problem:** The pond bank boulder cluster has a circular blocker radius of 3.8 around a visible cluster radius of 3.4. Generated visible stones are irregular and may not visually fill the entire blocker circle.
- **Likely Root Cause:** Curved blocker intentionally pads the visible boulder cluster, but the visible boulder distribution is lumpy and not collision-accurate.
- **Files / Objects / IDs Involved:** `folsom_pond_bank_boulders` and `folsom_pond_bank_boulder_blocker`.
- **How To Reproduce:** Walk around the boulders at approximately `[15, -62]` near the pond bank and test for collision before touching visible rocks.
- **Recommended Fix:** In a follow-up collision PR, adjust blocker radius/shape only after confirming visible mismatch in-game.
- **Risk Notes:** Do not reduce collision without checking whether the boulder blocker prevents pond clipping.
- **Suggested Follow-up PR Title:** Align Folsom pond boulder blocker to visible stones

### FWA-S03: Dark grove billboards may show white cutout slop depending on sprite alpha

- **Confidence:** Medium
- **Severity:** Medium
- **Category:** Foliage / Visual
- **Observed Problem:** The dark-grove tree sprites are alpha-cutout billboards. If source PNG edges contain pale matte pixels, white cutout slop can appear around tree silhouettes.
- **Likely Root Cause:** Runtime uses alpha-tested, depth-writing billboard materials; the source assets determine fringe quality. The audit did not edit assets.
- **Files / Objects / IDs Involved:** `folsom_dark_grove_tree_01_broad_canopy.png` through `folsom_dark_grove_tree_08_moody_foliage.png`, `FolsomFoliageBillboardKit`, and `addAuthoredFoliageBillboards()`.
- **How To Reproduce:** Inspect dark grove trees against the sunny noon sky and pond at different distances. Look for pale borders around transparent cutouts.
- **Recommended Fix:** If confirmed visually, clean PNG alpha/matte or adjust alpha-test threshold in a dedicated foliage-art PR.
- **Risk Notes:** Higher alpha thresholds can eat thin branches/leaves; test multiple sprites.
- **Suggested Follow-up PR Title:** Clean Folsom dark grove billboard alpha fringes

### FWA-S04: Oversized tree billboards may block sightlines but not movement

- **Confidence:** Medium
- **Severity:** Low
- **Category:** Foliage / Navigation
- **Observed Problem:** Ancient redwood variants reach about 16.2 units tall and multiple swathes are close to pond, shrine, north road, and reliquary entrance zones. They have no collision, but they can visually obscure paths/entrances.
- **Likely Root Cause:** Foliage swathes are dense and large; avoid zones reserve paths/pond/structures, but visual canopy width can still overlap route sightlines.
- **Files / Objects / IDs Involved:** `FOLSOM_FOLIAGE_SWATHE_SPECS`, `FOLSOM_FOLIAGE_SIZE_BANDS.redwood`, and generated Folsom billboard placements.
- **How To Reproduce:** Walk each validation route and note if a large billboard hides the pond edge, gate, Underworks, north road, or campfire.
- **Recommended Fix:** Trim only the specific offending placements in a follow-up PR after recording object IDs.
- **Risk Notes:** Avoid broad foliage reductions that erase the dark-grove mood.
- **Suggested Follow-up PR Title:** Trim only offending Folsom tree billboard placements

## Things That Look Correct / Should Not Be Touched

- **Fishing A1 / Rod A1:** No fishing or rod code was modified. Pond fish species and fishable water remain authored in `folsom_starter_pond`.
- **Broadsword / weapon handling:** The audit did not inspect or change sword logic beyond noting the Folsom rusted sword chest placement.
- **Inventory and HUD:** No inventory, HUD, mobile HUD, or item-count systems were changed.
- **Folsom sunny noon skybox selection:** The active Folsom skybox is the sunny noon panorama and should be preserved during geometry repair.
- **Current stump material:** The stump uses brown/dark-aged wood texture and should not be replaced unless a visual screenshot proves an issue.
- **Campfire cooking/eating interaction path:** The campfire `Small Campfire` interaction and cooking/eating flow should be preserved while flame visuals are audited.
- **Vite base `/Dread_Stone_Black/`:** Not relevant to this audit and should not be touched.

## Recommended Fix Order

1. **Remove/hide janky visible paver rectangles first.** This is the most visible regression and can likely be done as a visual-only PR without changing collision.
2. **Audit and remove invisible blocker/support snags.** Focus on path support surfaces, Underworks approach, paver edges, pond boulder blocker, campfire area, gates, trees, and wall edges.
3. **Fix pond water/shore mismatch.** Validate water, mud, wet-shore, terrain support, depth settings, and render order together.
4. **Fix terrain sinking / ground support consistency.** Reconcile terrain mesh sampling, path support, polygon floors, player grounding, camera height, and rod visibility.
5. **Clean fake tree/log props only if runtime inspection confirms leftovers.** The old Folsom primitive fake tree is removed in the definition; identify exact runtime object names before deleting shared code.
6. **Ground chopped stumps while preserving the brown wood material.** Fix placement height separately from material.
7. **Foliage, lighting, and campfire polish.** Address white cutout slop, oversized billboards, sky/lighting mood, and campfire flame rectangles after geometry/collision are stable.

## Do Not Fix In This PR

This PR is audit-only. Do not fix or “improve” Folsom gameplay, geometry, path pavers, pond, terrain, skybox, lighting, foliage, campfire, Fishing A1, Rod A1, Broadsword A1, inventory, HUD, mobile HUD, movement/look controls, or Vite base behavior in this PR.
