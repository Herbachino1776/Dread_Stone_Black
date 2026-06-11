# Dungeon Authoring Runtime

The dungeon authoring runtime exists so Dread Stone Black stops hand-building every dungeon directly inside scene code. A location should be readable data first, then compiled into Three.js objects, collision, navigation, spawn anchors, encounter zones, exits, lights, and dev diagnostics.

The practical target is boring stability: visible layout, collision, spawns, and navigation should come from the same authored source so a room wall, enemy spawn, or blocker cannot drift into a separate hand-maintained system.

## Problems It Solves

- Player starts and return points can be validated against walkable rectangles and blockers.
- Enemy spawns can be checked for blocker overlap and wall clearance.
- Prop collision can be aligned against prop footprints.
- Visible walls, structural props, and exterior facades can be checked against collision truth.
- Room edges can be sealed unless an opening, doorway, passage, or exit is explicitly authored.
- The faction navigation graph can be generated from authored rooms and links.
- Encounter zones and doorway waypoints live beside the layout that makes them valid.
- Debug rendering can show the compiled room graph, blockers, spawns, exits, and encounter rings without shipping production junk.

## Definition Shape

Location definitions live under `src/game/locations/`. A definition is plain JavaScript data:

- metadata: `id`, `displayName`, `type`, `tags`, `notes`
- environment: `fog`, `lighting`, `textures`, `defaultFloorY`, `defaultCeilingY`
- `rooms`: authored walkable rectangles plus render profiles
- `doors`: room connectors with doorway positions, nav waypoints, and optional wall gaps
- `blockers`: solid rectangles for player, enemy, and movement-line collision
- `props`: visible boxes that may reference a blocker via `collisionRef`
- `spawns`: player, return, enemy, npc, and debug spawn anchors
- `encounterZones`: faction director/action bubble zones
- `exits`: transition triggers and destination spawn ids
- `lights`: ambient, directional, point, and torch records
- `navigation`: explicit room graph, doorway waypoints, avoidance hints, forbidden zones, and patrol routes

Definitions are intentionally hand-editable. They are not a visual editor, procedural generator, or map-editor format.

## Compiler Output

`compileDungeonLocation(definition)` returns a runtime bundle:

```js
{
  locationId,
  group,
  rooms,
  walkableRects,
  blockerRects,
  collisionWorld,
  navGraph,
  spawnAnchors,
  encounterZones,
  exits,
  lights,
  props,
  debugData,
  validation
}
```

The bundle is built by small engine modules in `src/engine/dungeon-authoring/`:

- `DungeonDefinitionTypes.js`
- `DungeonCompiler.js`
- `DungeonValidation.js`
- `DungeonGeometryBuilder.js`
- `DungeonCollisionBuilder.js`
- `DungeonNavigationBuilder.js`
- `DungeonSpawnBuilder.js`
- `DungeonDebugRenderer.js`
- `DungeonRuntimeRegistry.js`
- `integrity/DungeonIntegrityValidator.js`

Generated Three.js objects receive useful `userData` such as `locationId`, `roomId`, `blockerId`, `propId`, `spawnId`, `encounterZoneId`, and `devOnly` where applicable.

## Validation

Validation runs during compilation and logs once in development:

```txt
[DUNGEON VALIDATION] black-grass-temple: 0 errors, 2 warnings
warning: spawn sheep_spawn_mid has low clearance near blocker altar_mid_01
```

Current checks include duplicate/missing ids, inverted bounds, room/spawn references, player and return spawn placement, enemy spawn placement and clearance, encounter zone room references, exit destination ids, door/nav room references, doorway waypoint walkability, blocker coverage of critical spawns, prop `collisionRef` alignment, and spawns too close to walls unless explicitly allowed.

Integrity validation extends those checks with visual wall to collision matching, collision to visual support, room edge sealing, declared opening validation, sampled walkable leak detection, and exterior facade entrance checks. See `docs/architecture/DUNGEON_INTEGRITY_AND_COLLISION_TRUTH.md` for the full issue-code guide and authoring rules.

Warnings are meant to guide authoring. Errors mean the definition should not be trusted.

## Debug Rendering

`DungeonDebugRenderer` is development-only. It attaches no visible production objects and is only constructed for compiled locations in dev builds.

Controls:

- `F2`: toggle dungeon debug
- `F3`: cycle layers

Layers show walkable room rectangles, blockers, nav links, spawn anchors, encounter-zone rings, exit trigger rectangles, torch diagnostics, integrity wall/opening/facade markers, and a current player marker.

## Black Grass Temple

Black Grass Temple now compiles from `src/game/locations/blackGrassTemple.definition.js`.

The compiler supplies:

- room and connector geometry
- floor, wall, ceiling, prop, gate, and torch objects
- player and return spawn anchors
- player collision world
- blocker rectangles for props and gates
- faction spawn anchors
- faction navigation graph
- faction encounter zones
- exit metadata
- inspect interaction targets
- validation and debug data
- integrity validation report data

`DungeonScene` still owns the high-level scene lifecycle, current routing, material creation, torch flicker bookkeeping, and the faction manager instance. `BlackGrassTempleFactions` still owns combat behavior, animation loading, target selection, and battle-director logic, but it now consumes compiler-generated anchors, nav graph, and encounter zones.

## Partial Definitions

`southReliquaryCrypt.definition.js` captures current known spawns, return points, major interaction locations, a few known rooms, and notes for future migration. The live South Reliquary Crypt still uses the existing baby labyrinth scene code.

`reliquaryField.definition.js` captures first-slice field bounds, player start, return spawns, transition metadata, outdoor blockers, and the Black Grass Temple facade integrity metadata. The live field still uses the existing outdoor visual builders, but collision is now sourced from the field definition.

Those partial definitions are registry entries and migration anchors, not active runtime replacements yet.

## Adding A Future Dungeon

1. Create a new definition in `src/game/locations/`.
2. Add rooms first, with generous walkable rectangles and clear labels.
3. Add doors/connectors and explicit nav links.
4. Add blockers and props, using `collisionRef` for any solid prop.
5. Add `integrity.nonBlockingDecor` for visible decorative props that are intentionally non-solid.
6. Add player, return, enemy, npc, and debug spawns.
7. Add encounter zones and exits.
8. Register the definition in `locationRegistry.js`.
9. Compile it from scene code with the local material and torch factories.
10. Run validation and use `F2`/`F3` to inspect the compiled runtime.

## Current Limitations

- The compiler builds simple box/plane-style room geometry. It is not a mesh editor.
- Door wall-gap authoring is explicit so old layouts can migrate without clever inference.
- The live routing system still uses query-string area switches.
- South Reliquary Crypt and Reliquary Field are only partially authored.
- The faction AI remains hand-coded behavior that consumes authored data.
- No visual editor exists yet.
- Integrity validation uses practical rectangular heuristics rather than arbitrary mesh analysis.

## Intentionally Not Migrated

- South Reliquary Crypt live geometry and puzzle logic.
- Reliquary Field live terrain and exterior structure builders.
- The Black Grass Temple faction combat state machine.
- Asset loading and animation tuning.
- Deployment config, Vite base, and GitHub Pages workflows.
