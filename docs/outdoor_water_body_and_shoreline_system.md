# Outdoor Water Body and Shoreline System

Outdoor ponds are authored as seeded recipes and compiled by `OutdoorPondBuilder.js`. Each recipe creates an irregular polygon water outline, per-vertex mud and shore expansions, terrain stamps, decor clearances, material profiles, and fishing-bank metadata.

The shoreline contract has seven physical layers:

1. deep basin
2. submerged floor
3. submerged shelf
4. waterline
5. exposed mud
6. wet bank
7. dry transition

The shared terrain is shaped before waterways. Connected outlets may cut the floor lower, but `OutdoorTerrainBuilder` prevents waterway bank shaping from raising any polygon water-floor sample above its submerged contract. Roads and casting paths must terminate outside the water polygon.

North Road includes Hunter's Mere, Prayer Pool, and Scout Tarn. All are distinct seeded outlines, fishable, terrain-audited, and connected to the drainage story. Scout Tarn uses a ridge-matched elevation rather than a perched artificial plateau.

Pond render geometry is visual only; collision and standing height come from the final terrain sampler. Water, bright mud, and wet-shore meshes derive from the same outline family. Fishing uses the exact water polygon, not a loose circular approximation.

Validation checks outline size, seven layers, submerged sample agreement, bank access outside water, water/terrain agreement, underwater spawn height, deterministic geometry, and the existing Folsom pond regression.

Known limitation: shore materials use discrete mesh bands rather than shader splat blending. A later art pass may feather color edges without changing surface truth.
