# Dread Stone Black — Pond Engine and Water Feature Authoring

## 1. Pond Engine Goal

The Pond Engine is a reusable world-building system for terrain-integrated water features. A pond is not a one-off Pond Expo trick or a decorative water decal. Every authored pond should read as a carved feature in the land with layered materials, ecology, fishing behavior, and validation.

A complete pond is built from these layers:

- terrain basin / gully stamp
- underwater mud floor
- water surface
- narrow exposed bright mud shoreline
- thin dark wet bank
- grass / outer terrain
- boulders
- reeds / aquatic brush
- fishability
- species pools

Core shoreline rule:

```text
water → bright mud → dark wet bank → grass
```

Never allow:

```text
water → grass
```

That sequence is the main visual and validation doctrine for all ponds and future water features.

## 2. Geometry / Terrain Contract

Pond layers must conform to the same depth profile. The terrain, mud, bank, and water are a single authored feature with related heights, not independent flat shapes.

A pond is not:

- a flat water disk over a grass bowl
- a cosmetic circle placed on top of terrain
- a floating mud plate with unrelated water above it

A pond is:

- carved terrain
- depth-aware mud and shore meshes
- a water surface that sits correctly inside the basin
- bank geometry that transitions naturally back into grass

Required relationships:

- The water surface is mostly flat.
- The underwater mud / floor is below water.
- The exposed bright mud shoreline is slightly above water.
- The dark wet bank slopes upward toward grass.
- The terrain basin supports the whole feature.

The basin stamp should be the source of truth for visual depth. Mesh layers must be authored or generated from that depth profile so the player can see where the pond is shallow, where the bank rises, and where the water sits inside the land.

## 3. Shoreline Shape

All ponds should have irregular, complex shorelines. Simple circles and ellipses may be used only as an invisible starting basis before organic deformation.

Important shape parameters:

- outline point count
- shoreline wobble
- bay / lobe count
- asymmetry
- edge roughness
- crescent / pinch bias
- radius variation

The shoreline should contain small inlets, bulges, pinches, and uneven edge samples. A pond may be calm, but its footprint should still feel made by terrain, erosion, animals, and plant growth rather than by a perfect primitive shape.

## 4. Depth Profiles

Depth classes should be strong and visually readable:

- very shallow
- shallow
- medium
- deep
- very deep

Depth should be driven by these values:

- `basinDepth`
- `waterSurfaceY`
- `pondFloorY`
- `shoreShelfY`
- `bankHeight`
- `bankSlope`
- terrain stamp depth
- gully / stamp profile

Depth is not just metadata for fishing. It must be visible in the feature: shallow shelves, readable wet banks, darker or lower underwater floor areas, and water sitting naturally in the carved terrain.

## 5. Decorative Ecology

Natural pond decoration should reinforce the depth and shoreline layers.

Use:

- boulders on bank
- boulders on wet shore
- partially submerged boulders
- small reed / brush clusters in shallow water
- aquatic brush on mud edge
- larger bushes / trees farther out
- clear fishing lanes preserved

Do not place redwoods in pond-edge vegetation. Large vegetation belongs farther from the waterline unless a location specifically authors a safe, readable exception. Reeds, aquatic brush, and rocks should cluster near edge samples without blocking all access to the water.

## 6. Fishing Integration

Ponds can be fishable. Fishable zones should derive from the actual water footprint rather than from unrelated trigger shapes.

Rules:

- Each pond can define a species pool.
- Catches use permanent Kerovac fish species.
- Caught fish use the shared fish mesh and textures.
- Fish pickup should land near shore, lie flat, and flop / twitch.
- Inventory may remain `raw_fish` while carrying species metadata.

Fishing lanes should remain clear enough that the player can approach, cast, see the water, and collect the dropped fish without fighting decorative clutter.

## 7. Permanent Fish Species

Current official fish species:

- `smallRiverFish`
- `broadCarpFish`
- `longEelFish`
- `spineBackFish`
- `flatMarshFish`
- `jawHunterFish`
- `sacredGlowFish`

Kerovac Fish Expo mapping:

- C1 -> `smallRiverFish`
- C2 -> `broadCarpFish`
- C3 -> `longEelFish`
- C4 -> `spineBackFish`
- D1 -> `flatMarshFish`
- D2 -> `jawHunterFish`
- D3 -> `sacredGlowFish`

Important: C4 / `spineBackFish` must remain preserved.

## 8. Streams and Rivers Extension

Streams and rivers should use the same philosophy as ponds, but stretched along a path. A stream should not be one giant rectangle.

A stream should use:

- meandering centerline
- semi-repeating linear terrain stamps
- linked basin / gully segments
- ribbon water mesh
- irregular banks along both sides
- mud / wet-bank strips following the path
- boulders / reeds / brush placed along edge samples
- fishable pockets / pools where appropriate

Difference in footprint model:

- pond = singular basin / closed footprint
- stream = repeated linear gully / stamp chain / open ribbon footprint

The stream system should reuse:

- depth profiles
- water material / animation ideas
- mud / shore layering
- boulder placement
- reeds / aquatic brush
- fishability zones
- validation rules

Streams should be authored as connected water features with alternating narrow runs, wider pockets, and local pools. The pond rule still applies along both sides: water transitions to bright mud, then dark wet bank, then grass.

## 9. Validation Doctrine

Validation must protect the water-feature contract. A pond or stream should fail validation when it violates core visual, gameplay, or asset rules.

Validation should check for:

- no water on grass
- no flat floating mud disks
- depth-aware layer heights
- irregular shoreline complexity
- boulder / reed placement sanity
- fish species validity
- texture / material resolution
- fishing lane clearance
- no missing assets

Readable failures are preferred. Example:

```text
Pond Engine validation invalid: water edge touches grass without bright mud and dark wet bank layers.
```

The goal is to catch broken water features before they become hard-to-debug visual regressions in Reliquary Field, Pond Expo, Kerovac, or future stream / river content.
