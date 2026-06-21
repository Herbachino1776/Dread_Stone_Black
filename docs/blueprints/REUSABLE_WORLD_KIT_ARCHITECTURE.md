# Dread Stone Black — Reusable World Kit Architecture

## 1. Purpose

This document records the current state of Dread Stone Black's reusable world-building architecture: what is strong, what is weak, and where the project needs to go next.

The immediate concern is that new locations should not become piles of one-off authored geometry. Folsom, Pond Expo, Kerovac, and future mixed OARB/DARB locations should be built from reusable building blocks: terrain stamps, water features, boulder kits, vegetation kits, wall kits, hut/shrine/house kits, fish species, rod variants, and material-role registries.

The desired future is not that Codex authors every asset from scratch in every PR. The desired future is:

```text
locked reusable systems
+
small location-specific recipes
+
validation that prevents fallback junk
=
fast variation without losing quality
```

The fish system demonstrated why this matters. The chosen Kerovac fish species were supposed to be the permanent keeper species, but an early Pond Expo fishing pass still created local/simple fish visuals instead of wiring catches into the selected fish. That was later corrected by moving the fish species into a shared factory. That same discipline now needs to be applied to terrain, boulders, buildings, walls, vegetation, and starter-town composition.

## 2. Current Architecture Summary

Dread Stone Black currently has several reusable engines, but not enough reusable kit catalogs.

A reusable engine is a system that knows how to create a class of thing.

A reusable kit catalog is a curated set of approved, named building blocks that locations can reuse safely.

The project has several reusable engines:

- fish mesh factory;
- outdoor pond builder;
- outdoor terrain stamp processor;
- outdoor primitive builder;
- DARB-style geometry definitions for floors, walls, gaps, roofs, and architectural primitives;
- texture profile systems;
- validation scripts.

The project does not yet have enough reusable catalogs:

- approved terrain stamp presets;
- approved natural boulder material/shape kits;
- reusable Folsom-style huts, sheds, shrines, border doors, cellars, and courtyard modules;
- wall/fieldwall kits using the user's stone and brick textures;
- vegetation ecology kits;
- material role registries separating natural rock, building stone, mud, wood, metal, water, foliage, and ritual surfaces;
- location recipe standards that discourage inline one-off authoring.

This means Codex often uses the right underlying engine, but still authors each location too directly.

## 3. Existing Strengths

### 3.1 Fish Species Registry

The fish system is currently the best model for where the rest of the architecture needs to go.

The project now has a shared fish factory with permanent species definitions and material slots. The approved species are:

```text
smallRiverFish
broadCarpFish
longEelFish
spineBackFish
flatMarshFish
jawHunterFish
sacredGlowFish
```

This is the correct pattern:

```text
keeper species chosen once
→ shared species registry
→ shared mesh factory
→ all locations consume the same species
→ validation prevents local placeholder replacements
```

Important rule: `spineBackFish` is the C4 keeper fish and must remain preserved.

Future additions should not recreate fish locally. New fishing locations should reference species IDs, not invent visual fish geometry in location files.

### 3.2 Pond Engine

The pond engine is close to the correct architecture.

The current pond builder accepts pond recipes and emits:

- water bodies;
- terrain stamps;
- generated outlines;
- mud/shore/water layers;
- pond-specific textures;
- decoration metadata;
- fishable water metadata.

This is a strong reusable engine. Locations like Folsom can define one pond through a recipe instead of hand-authoring every water/mud/shore piece.

The pond engine also now has important doctrine:

```text
water → narrow bright mud → thin dark wet bank → grass
```

and the negative rule:

```text
never water → grass
```

The remaining architectural work is to turn common pond styles into named reusable recipe presets, such as:

```text
starterReedBankPond
smallForestFishingPond
rockySpringPond
marshyShallowPond
deepFishingHole
crescentSacredPond
```

Locations should be able to say, in effect:

```js
pondKit.starterReedBankPond({ center, seed, fishSpeciesPool })
```

instead of re-specifying every shape, terrain, mud, water, boulder, and brush parameter inline.

### 3.3 Outdoor Terrain Engine

The terrain engine supports low-level stamp kinds:

```text
hill
hollow
ridge
ravine
flatten
flattenOutline
```

This is a real reusable base. It allows terrain to move beyond flat fields.

The weakness is not the underlying engine. The weakness is that locations are still specifying raw stamp records directly.

A location should not need to hand-author every pad and hill from scratch. It should eventually call named terrain kit functions:

```js
terrainStampKit.spawnCourtyardShelf(...)
terrainStampKit.shrineKnoll(...)
terrainStampKit.toolYardPad(...)
terrainStampKit.linearDrainageGully(...)
terrainStampKit.rustyDoorCut(...)
terrainStampKit.pondApproachSlope(...)
```

The low-level stamp engine is strong. The high-level terrain catalog is missing.

### 3.4 OARB + DARB Mixed Locations

Folsom proves that the project can combine outdoor terrain and authored structures in one location.

This is a major strength. The game can now support:

- outdoor terrain;
- ponds;
- paths;
- boulders;
- foliage;
- DARB floors;
- DARB walls;
- DARB door gaps;
- roofs;
- shrines;
- houses;
- border gates;
- dungeon placeholders;
- outdoor chests;
- campfires;
- location exits.

The weak point is that many of these assemblies are still authored inline in the location definition rather than coming from reusable structure chunks.

Folsom should become the last major location where that level of inline structure authoring is acceptable. Future towns should consume reusable kits.

## 4. Current Weak Points

### 4.1 Inline Location Authoring Is Still Too Heavy

Folsom currently contains many directly authored terrain stamps, floors, wall segments, primitives, boulders, paths, chests, and props.

That is acceptable for a first implementation, but it is not a scalable pattern.

The risk is that every new town, castle, shrine, field, and courtyard becomes a fresh pile of hand-placed objects with slightly different material choices, slightly different collision assumptions, and slightly different validation coverage.

Bad future pattern:

```text
location definition owns everything
→ every object is placed uniquely
→ every PR invents new variants
→ quality varies by prompt
→ regressions return
```

Good future pattern:

```text
world kit owns reusable chunks
→ location definition assembles chunks
→ recipe parameters create variation
→ validation protects role contracts
→ quality compounds over time
```

### 4.2 Terrain Has Primitives, Not Presets

The terrain engine has useful primitives but not enough named presets.

Current low-level records like `hill`, `flatten`, and `ravine` are expressive, but they invite Codex to improvise each location. That creates inconsistency.

The next step is a terrain stamp catalog.

Required examples:

```text
softTownRise
lowMound
shallowFootpathCut
linearDrainageGully
buildingPadSmall
buildingPadWide
courtyardShelf
shrineKnoll
rustedGateCut
pondApproachSlope
streamPreviewDryChannel
```

Each preset should produce one or more low-level terrain stamps while preserving mobile-safe geometry and validation expectations.

### 4.3 Natural Boulders Are Not Material-Safe Yet

The project has boulder primitives, but material assignment is still too loose.

A natural field boulder should not use the same material role as a building wall or black-stone block.

The pond boulder rock texture work created a better natural rock visual language. Field boulders should consume the same natural rock material pool, not wall or brick materials.

Needed rule:

```text
natural boulder → approved natural rock material profile only
building wall → wall/brick/stone block material profile
ruin stone → ruin/structure material profile
```

This requires a material role registry, not just string material keys.

### 4.4 DARB Structures Need Prefab-Level Kits

DARB can already describe walls, floors, roofs, doors, gaps, and primitives. That is good.

But future locations need reusable assembled chunks:

```text
starterHutSmall
openToolShed
openCeilingShrineSmall
fisherHouseShell
rustyBorderDoorWall
cellarEntrancePlaceholder
fieldstoneCourtyardWall
lowRuinWallSegment
woodenLeanTo
stoneGateFrame
```

A Folsom-style tool shed should not be rebuilt manually every time. A ruined shrine should not be a brand-new scatter of walls and columns every time.

The system needs DARB kits that output validated collections of floors, walls, roofs, gaps, surfaces, blockers, and optional chests/interactions.

### 4.5 Vegetation Is Not Yet Ecological Enough

Vegetation currently works as sprites/billboards and can be placed near ponds, but it is not yet a fully reusable ecology system.

Needed future kits:

```text
pondReedCluster
wetBankBrushPatch
fieldShrubScatter
forestEdgeCluster
townYardSparseGrass
roadsideWeeds
ruinOvergrowth
nonRedwoodSmallTreeCluster
```

Vegetation should be placed by context:

- wet edge;
- dry road edge;
- field wall base;
- building corner;
- shrine overgrowth;
- pond reeds;
- stream bank;
- forest transition.

The future vegetation pass should not just add more sprites. It should create reusable ecology recipes.

### 4.6 Validation Is Strong in Places, But Not Yet Role-Based Enough

Validation has improved a lot, especially around ponds, fish, terrain, and Folsom. But validation should increasingly enforce role contracts.

Examples:

```text
fishable water must use registered fish species
natural boulders must use natural rock materials
pond labels may not render undefined/null
water may not touch grass directly
building floors must be near terrain pads
DARB structures may not float over OARB terrain
starter town routes must remain walkable
legacy doors must route intentionally
```

The strongest validation should protect the user's selected keepers and prevent local shortcuts from reappearing.

## 5. Required Architectural Direction

### 5.1 Create a Formal World Kit Layer

Introduce a clear world-kit layer for reusable authored components.

Possible structure:

```text
src/game/world-kits/
  fish/
  ponds/
  terrain/
  rocks/
  vegetation/
  buildings/
  walls/
  materials/
  starter-loops/
```

This does not need to happen all at once. But future work should move toward this structure instead of continuing to grow one-off location definitions.

### 5.2 Recommended Module Roles

#### Fish Kit

May wrap or re-export the existing shared fish factory.

Responsibilities:

- permanent species IDs;
- material profiles;
- species validation;
- catch pool helpers;
- display/caught pickup compatibility.

This is already mostly solved by the existing fish factory and should not be duplicated carelessly.

#### Pond Kit

Responsibilities:

- named pond recipes;
- starter pond presets;
- marsh presets;
- deep pool presets;
- rocky spring presets;
- fishable pond helper;
- decoration defaults;
- validation metadata.

Locations should use pond kit recipes rather than restating full pond details.

#### Terrain Stamp Kit

Responsibilities:

- reusable terrain stamp presets;
- composition helpers that emit low-level stamp arrays;
- safety defaults for mobile terrain;
- named pad/gully/hill/shelf functions.

This is one of the highest-priority missing pieces.

#### Rock Kit

Responsibilities:

- natural rock material pool;
- boulder cluster presets;
- submerged rock variants;
- field boulder variants;
- cliff/outcrop variants;
- validation tags proving natural rocks do not use building/wall materials.

This should fix the field-boulder material problem permanently.

#### Building Kit

Responsibilities:

- reusable huts;
- sheds;
- houses;
- shrines;
- gate frames;
- cellar entrances;
- floors/walls/roofs/blockers bundled together;
- path/door alignment metadata;
- validation hooks.

#### Wall Kit

Responsibilities:

- fieldstone walls;
- courtyard walls;
- ruined walls;
- brick variants;
- stone texture variants;
- low walls for visibility;
- doorway/gate helpers;
- collision metadata.

This should become important after the current terrain pass succeeds.

#### Vegetation Kit

Responsibilities:

- ecological placement recipes;
- pond reeds;
- field shrubs;
- road weeds;
- ruin overgrowth;
- tree clusters;
- no-redwood constraints for small-town/ecology contexts;
- visibility/depth sorting rules.

#### Material Role Kit

Responsibilities:

- separate natural rock, building stone, brick, mud, wet bank, wood, metal, foliage, water, ritual stone;
- prevent using black wall texture on field boulders;
- provide approved material pools by object role;
- support location-specific palette overrides safely.

### 5.3 Location Definitions Should Become Recipes

A future high-quality location definition should read more like a recipe than a raw geometry dump.

Preferred future pattern:

```js
const terrain = terrainStampKit.composeTownTerrain({
  courtyard: terrainStampKit.spawnCourtyardShelf(...),
  shrine: terrainStampKit.shrineKnoll(...),
  pond: terrainStampKit.pondApproachSlope(...),
  road: terrainStampKit.linearDrainageGully(...),
});

const pond = pondKit.starterReedBankPond({
  center: [0, -58],
  fishSpeciesPool: fishKit.earlyTownPool({ includeRareC4: true }),
});

const structures = [
  buildingKit.openToolShed(...),
  buildingKit.smallOpenCeilingShrine(...),
  buildingKit.fisherHouseSmall(...),
  wallKit.rustyReliquaryDoorWall(...),
];
```

The final compiled definition can still be arrays of floors, walls, water bodies, stamps, and primitives, but the authoring source should increasingly come from reusable kits.

## 6. Prioritized Roadmap

### Phase 1 — Protect Existing Keepers

Goal: prevent known regressions.

Actions:

- keep fish species as shared registry only;
- prevent local fish visual shortcuts;
- enforce C4/spineBackFish preservation;
- ensure caught fish uses the shared mesh factory and texture profiles;
- ensure pond recipes stay builder-driven;
- prevent undefined labels and material fallbacks.

### Phase 2 — Material Role Registry

Goal: stop blocky/wrong material usage.

Actions:

- define material roles;
- separate natural rock from building stone;
- create approved natural rock pools;
- update boulder primitives to default to rock-kit materials;
- validate natural boulders do not use wall/brick/block materials.

### Phase 3 — Terrain Stamp Kit

Goal: stop raw terrain stamp improvisation.

Actions:

- create named stamp presets;
- wrap low-level `hill`, `hollow`, `ridge`, `ravine`, `flatten`, and `flattenOutline`;
- create presets for Folsom-like towns;
- migrate Folsom terrain to consume presets where practical;
- validate relief, slope, and pad stability.

### Phase 4 — Structure Kits

Goal: stop rebuilding huts/shrines/walls manually.

Actions:

- create reusable tool shed, house, shrine, cellar, rusty door, and wall kit functions;
- emit DARB floors, walls, roof surfaces, door gaps, blockers, lights, and interactions as bundled outputs;
- support texture/palette variants;
- validate buildings against OARB terrain pads.

### Phase 5 — Vegetation/Ecology Kit

Goal: make outdoor locations feel alive through reusable ecology.

Actions:

- create pond reed cluster presets;
- create field shrub/road weed/ruin overgrowth presets;
- ensure depth sorting and alpha behavior remain stable;
- validate no-redwood constraints where appropriate;
- keep fishing/casting lanes clear.

### Phase 6 — Location Recipe Standard

Goal: make future locations compositional.

Actions:

- define `locationRecipe` conventions;
- encourage kit-based authoring;
- limit raw inline geometry except for one-off hero objects;
- validation should detect unapproved one-off shortcuts in production locations;
- preserve feature expo areas as test references, but do not let them define the production pattern.

## 7. Codex Prompting Standard Going Forward

Future Codex prompts should explicitly say:

```text
Before authoring new geometry, search for an existing reusable kit/factory/builder.
If a suitable reusable building block exists, use it.
If it does not exist, create a reusable kit function first, then consume it from the location.
Do not create local placeholder geometry for keeper systems.
Do not use fallback materials for production objects unless explicitly documented.
```

Prompts should name the relevant keeper systems:

```text
Fish species are permanent and shared.
Pond engine owns pond layer/terrain/water construction.
Natural rocks must use natural rock material roles.
Terrain stamps should come from reusable presets.
Buildings should move toward DARB structure kits.
Vegetation should move toward ecology recipes.
```

## 8. Definition of Done for Reusability

A new world-building feature is not truly done when it appears once.

It is done when:

- it has a reusable builder or kit;
- it has named material roles;
- it can be varied through parameters;
- it is consumed by at least one location;
- validation prevents obvious misuse;
- future prompts can reference it by name;
- it does not rely on local one-off fallback geometry.

## 9. Short-Term Recommendation

After the current Folsom terrain pass, the next architecture-focused PR should not simply add more decoration.

Recommended next PR:

```text
Create reusable world-kit foundations for terrain stamps, natural rocks, and starter structures.
```

Minimum useful deliverable:

- `terrainStampKit` with named Folsom-grade pads, rises, gullies, and road cuts;
- `rockKit` with natural boulder material roles and cluster presets;
- `buildingKit` with at least one reusable tool shed or open shrine assembly;
- validation ensuring production locations use the kit or document why they do not.

Once this exists, vegetation, field walls, courtyard walls, and future towns can build much faster and with less regression risk.

## 10. Final Position

The project is not failing at reusability. It is in the transition phase.

Strong reusable engines now exist. The missing layer is the curated reusable world kit.

The path forward is clear:

```text
engine primitives
→ named kits
→ location recipes
→ validation-protected production world
```

Fish proved the model. Ponds are close. Terrain, rocks, structures, walls, and vegetation should follow next.
