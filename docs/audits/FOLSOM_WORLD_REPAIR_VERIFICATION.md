# Folsom World Repair Verification

Repair pass for `docs/audits/FOLSOM_WORLD_AUDIT.md`. This is a focused fix pass, not a redesign.

## FWA-001 — Visible paver edge rectangles

- **Status:** Fixed.
- **Files changed:** `src/game/locations/folsom.definition.js`, `src/engine/outdoor-authoring/OutdoorSplineBuilder.js`.
- **Root cause:** Folsom spline trails inherited the generic visible `BoxGeometry` edge mesh pass, creating separate dark rectangular paver slabs on every segment.
- **Fix:** Added per-trail `edgeMeshes: false` support and disabled edge meshes on all Folsom dirt trails. Dirt path ribbon visuals remain.
- **Manual test performed:** Code-path inspection confirmed all Folsom spline trails opt out of edge meshes and `createOutdoorSplineTrailEdgeMeshes()` returns no Folsom paver edge groups.
- **Risk note:** Low; this removes visual-only geometry and does not change fishing, sword, HUD, or controls.

## FWA-002 — Invisible path support slabs/ramps

- **Status:** Fixed.
- **Files changed:** `src/game/locations/folsom.definition.js`, `src/engine/outdoor-authoring/OutdoorSplineBuilder.js`.
- **Root cause:** Generated path support ramps sampled only segment endpoints and were added as invisible walkable collision surfaces above terrain.
- **Fix:** Added per-trail `pathSupport: false` support and disabled generated Folsom path support surfaces, so terrain/polygon floors are authoritative rather than hidden slabs.
- **Manual test performed:** Code-path inspection confirmed `createOutdoorSplinePathSupportSurfaces()` skips every Folsom trail.
- **Risk note:** Medium-low; path grounding now relies on visible terrain and authored floors instead of hidden endpoint ramps.

## FWA-003 — Underworks entrance collision ambiguity

- **Status:** Fixed.
- **Files changed:** `src/game/locations/folsom.definition.js`, `src/engine/outdoor-authoring/OutdoorSplineBuilder.js`.
- **Root cause:** The gate is visual-only; the likely snag was the `folsom_courtyard_to_cellar` generated support ramp overlapping the cellar apron/gate approach.
- **Fix:** Disabled support surfaces for the cellar path while preserving the visual gate, cellar apron, and `folsom_underworks_locked` interaction.
- **Manual test performed:** Inspected `folsom_cellar_gate`, `folsom_cellar_apron`, `folsom_cellar_pad`, `folsom_underworks_locked`, and `folsom_courtyard_to_cellar`; no new invisible blocker was added.
- **Risk note:** Low; interaction remains authored and no hidden blocker was introduced.

## FWA-004 — Pond water/shore seam mismatch

- **Status:** Fixed.
- **Files changed:** `src/engine/outdoor-authoring/OutdoorPondBuilder.js`, `src/engine/outdoor-authoring/PondCompositeBuilder.js`.
- **Root cause:** The rendered water disc used the exact water outline while mud/shore meshes used separately expanded outlines, allowing low-angle gaps at the edge.
- **Fix:** Added a small `visualWaterOutline` shoreline overlap derived from the water outline and used it only for the rendered water mesh; fishable zone dimensions and logical pond outline remain unchanged.
- **Manual test performed:** Code-path inspection confirmed `folsom_starter_pond_water` renders from the overlapped outline while mud/shore/fishing logic continue using existing outlines.
- **Risk note:** Low; visual overlap avoids a seam without moving the pond or changing Fishing A1.

## FWA-005 — Terrain grounding / sinking / rod disappearing on hills

- **Status:** Fixed.
- **Files changed:** `src/game/locations/folsom.definition.js`, `src/engine/outdoor-authoring/OutdoorSplineBuilder.js`.
- **Root cause:** Invisible spline support surfaces could override the Folsom terrain sampler and create mismatches between visible grass, player height, camera, and held rod presentation.
- **Fix:** Removed Folsom path support surfaces so `CollisionWorld.sampleWalkableY()` falls back to the outdoor terrain sampler unless an explicit authored visible floor has higher priority.
- **Manual test performed:** Code-path inspection verified terrain remains the outdoor fallback and Folsom paths no longer inject hidden support surfaces.
- **Risk note:** Medium; movement behavior changes only by removing hidden Folsom slabs.

## FWA-006 — Too many decorative/boundary redwoods harvestable

- **Status:** Fixed.
- **Files changed:** `src/game/locations/folsom.definition.js`, `src/game/world-kits/vegetation/FolsomFoliageBillboardKit.js`, `src/game/DungeonScene.js`.
- **Root cause:** Folsom redwood billboard swathes lacked explicit non-harvestable metadata, so decorative redwoods were eligible for harvest interactions.
- **Fix:** Marked decorative swathes `harvestable: false` and allowed only three intentional redwood billboards to be generated with `intentional-harvestable-redwood` tags.
- **Manual test performed:** Code-path inspection confirmed boundary, pond, reliquary, and screen swathes are non-harvestable while a small safe set remains intentional.
- **Risk note:** Low; the dark grove visual layer remains intact.

## FWA-007 — Fake 3D tree / legacy fake-tree risk

- **Status:** Fixed / Not Applicable.
- **Files changed:** `src/game/locations/folsom.definition.js`, `src/game/DungeonScene.js`.
- **Root cause:** Current Folsom has no `harvestableTrees`, but legacy primitive tree rendering remains for definitions that use that shared array.
- **Fix:** Left shared legacy code intact and kept Folsom harvesting on billboard redwoods only; no Folsom primitive fake tree source was added.
- **Manual test performed:** Source inspection confirmed `harvestableTrees: []` and no `folsom_work_yard_tree` runtime source.
- **Risk note:** Low; shared code remains available for other locations.

## FWA-008 — Chopped stump grounding on terrain

- **Status:** Fixed.
- **Files changed:** `src/game/DungeonScene.js`.
- **Root cause:** `addFieldStump()` always placed stump centers at `y = 0.31`, ignoring terrain and saved tree position.
- **Fix:** Stump base now samples `outdoorTerrainRuntime.sampleOutdoorY()` at the stump x/z and falls back to the saved position y only if terrain is unavailable. Existing dark aged wood material is preserved.
- **Manual test performed:** Code-path inspection confirmed runtime stump names are unchanged and grounding metadata records the sampled base height.
- **Risk note:** Low; harvested-state IDs and wood reward flow are unchanged.

## FWA-009 — Preserve sunny noon sky

- **Status:** Fixed / Not Applicable.
- **Files changed:** None for sky or lighting.
- **Root cause:** The audit found sunny noon sky was already active and should be preserved.
- **Fix:** No lighting, skybox, fog, or time-of-day change was made.
- **Manual test performed:** Source inspection confirmed `./assets/textures/sky/sunny_noon_skybox_folsom_01.png` remains the Folsom sky texture.
- **Risk note:** Low; no sky-system churn.

## FWA-010 — Campfire flame transparency/depth/card risk

- **Status:** Not Applicable.
- **Files changed:** None for campfire/flame/cooking.
- **Root cause:** The audit flagged a possible card artifact risk but did not confirm a current runtime artifact.
- **Fix:** No flame change was made, preserving the existing 40% larger flame, `0.65` opacity, six-frame animation, semi-transparent fire, and cooking/eating interactions.
- **Manual test performed:** Source inspection confirmed this repair pass did not alter campfire flame or cooking/eating code.
- **Risk note:** Low; avoids unnecessary visual retuning.

## Manual Acceptance Checklist Notes

- Load Folsom: source/build verification only in this non-interactive environment.
- Walk every dirt path: support and edge generation paths inspected; Folsom opts out of both hidden slabs and visible paver boxes.
- Confirm ugly paver rectangles are gone: Folsom trails set `edgeMeshes: false`.
- Confirm no invisible raised slab feeling on paths: Folsom trails set `pathSupport: false`.
- Walk courtyard-to-pond / courtyard-to-cellar / Underworks: code inspection confirmed no Folsom path support surfaces are emitted.
- Pond approaches and low angles: visual water overlap added without moving the pond/fishing zone.
- Walk hills with rod equipped / no terrain sinking: terrain sampler is now the outdoor fallback without hidden Folsom support override.
- Cut intentional trees flat/slope: stumps ground to terrain sampler; intentional harvestable redwoods remain limited.
- Decorative/boundary harvest spam: decorative swathes explicitly non-harvestable.
- Fake 3D tree: Folsom `harvestableTrees` remains empty.
- Campfire cooking/eating, Fishing A1, Rod A1, Broadsword A1, HUD, controls: not modified.
- Sunny noon skybox: preserved.
- Build: `npm run build` passes.
