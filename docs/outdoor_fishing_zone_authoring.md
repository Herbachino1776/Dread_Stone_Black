# Outdoor Fishing Zone Authoring

Fishing zones describe castable water, not a broad interaction bubble. `FishingZoneGeometry.js` is the shared containment layer used by interaction discovery, water-height resolution, physical angling, fish visuals, and validation.

Ponds use their generated water polygon. Streams use a dense corridor with per-sample widths and downhill water heights. Each zone requires a stable ID, existing fish species IDs, an underwater visual-spawn bound, and at least one usable bank contract.

Stream zones may define `startDistance`, `endDistance`, `fishSpeciesPool`, `castingBank`, an outside-channel `standingArea`, and a `noFoliageLane`. Pond casting banks are generated from authored lane angles and the final shoreline profile. Footpaths stop at the dry bank; they do not grade through water.

North Road supplies seven zones: four stream reaches and three ponds. Hunter Creek has road-bend and mere-outlet reaches; Scout Rill and Prayer Run each have one. Every cast-profile point is wet, every species resolves through `FISH_SPECS`, and visual fish spawn below the water surface.

Validation rejects dry overlap, bank-spawned fish, unknown species, standing positions inside the channel, foliage in required lanes, and terrain above the zone water profile. Folsom fishing remains a required regression.
