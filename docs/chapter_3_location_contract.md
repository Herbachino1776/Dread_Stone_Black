# Chapter 3 Location Contract

## Active topology

`Blue Flame Threshold -> lower shrine hatch -> BF05 Lower Shrine Stair -> impossible White-Scab front seal -> exposed lower knot -> Folsom shrine crawlspace terminal -> under-shrine-labyrinth -> end hatch -> beneath-folsom threshold backside`

The front seal is `beneath_folsom_white_scab_front_seal`. It is full-height collision and a layered black-scab, white-stone pressure, root-plate, and pale-seam composition. Destroying `beneath_folsom_white_scab_lower_knot` does not remove or open that seal.

## Location contract

- Location id: `under-shrine-labyrinth`.
- Registry: lazy-loaded compiled authored location in `locationRegistry.js`.
- Entrance: the Folsom shrine crawlspace terminal throat.
- Entrance spawn: `under_shrine_labyrinth_shrine_terminal_arrival`.
- End hatch: `under_shrine_labyrinth_end_hatch`.
- Exit location: `beneath-folsom`.
- Exit spawn: `beneath_folsom_white_scab_threshold_backside`.

The labyrinth is a bounded ten-segment twisting descent with nine meaningful bends, two narrow squeeze segments, one breathing pocket, one visible root/stone pressure moment, low ceilings, textured stone/dirt/root/maintenance dressing, no encounters, and near-total darkness. Handheld light is the intended navigation source.

## State contract

- `beneath_folsom_white_scab_lower_knot_destroyed`: persists the destroyed front-side knot.
- `folsom_shrine_crawlspace_terminal_open`: persists the physically opened shrine terminal throat.
- `under_shrine_labyrinth_end_hatch_open`: persists the opened labyrinth end hatch.

The first state additively enables the second. Existing Chapter 3 planned/progress flags migrate to hatch, knot, terminal, and end-hatch access so old saves beyond the former blocker do not softlock. Existing save keys are not renamed.

The exposed lower knot advances only through physical Old Work Knife cut contacts. It cannot be completed by Interact/A and never removes the front-seal collision. The Under-Shrine Labyrinth end hatch advances only through a planted Iron Drain Bar pry; after it opens, Interact may perform the location transition. Future Chapter 3 White-Scab tool mechanics follow the same physical receiver standard. Enemy/character combat is outside this contract.

## Scope boundary

Arrival behind the denied threshold ends this pass. A hard boundary prevents progression into the deferred White-Scab Hall and Shrine Mechanism Room mechanics. Pale Panel, Records/Memory, Pale Gates, combat content, First Crypt, and Chapter 4 remain unimplemented.
