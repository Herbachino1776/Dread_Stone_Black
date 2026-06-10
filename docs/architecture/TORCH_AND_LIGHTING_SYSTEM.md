# Torch And Lighting Object System

## Why This Exists

Torches are authored lighting objects, not loose point lights or free-floating props. A torch is a wall anchor, wall normal, fixture visual, flame visual, point light, flicker behavior, validation data, and debug metadata.

This system fixes the common dungeon problems where torches drift into doorways, face the wrong way, sit too far from walls, or have light positions that do not match their visible geometry.

## Fixture Anatomy

Runtime torch fixtures are built by `src/engine/lighting/TorchFixture.js`.

Each fixture supports:

- `id`
- `locationId`
- `roomId`
- `position`
- `wallNormal`
- `wallSide`
- `height`
- `offsetFromWall`
- `yaw`
- `visualKind`
- `flameKind`
- `profile`
- `debug`

The default placeholder is procedural and intentionally small: a dark wall plate, short bracket, angled shaft, compact warm flame, soft glow, and point light. It does not use a large cone as the gameplay torch visual.

## Authoring Modes

### Wall-Anchored

Use this for normal dungeon torch placement.

```js
{
  id: 'BGT_T02_vestibule_west_wall',
  kind: 'torch',
  roomId: 'R02',
  wallSide: 'west',
  distanceAlongWall: 6,
  height: 1.72,
  offsetFromWall: 0.16,
  profile: 'dungeonTorch'
}
```

The compiler resolves final position, wall normal, yaw, and light position from the room rectangle and wall side. `distanceAlongWall` is measured from the room minimum corner along that wall. `insetFromCorner` keeps fixtures away from corners.

### Explicit

Use this only when a fixture is tied to unusual architecture.

```js
{
  id: 'special_torch',
  kind: 'torch',
  roomId: 'R12',
  position: { x: 10, y: 1.7, z: 84 },
  wallNormal: { x: -1, y: 0, z: 0 },
  profile: 'ritualTorch'
}
```

Explicit fixtures still validate against rooms, blockers, doors, props, exits, and navigation hints.

## Lighting Profiles

Profiles live in `src/engine/lighting/TorchLightingProfile.js`.

- `dungeonTorch`: default warm amber firelight.
- `weakTorch`: smaller radius for corridors or mood pockets.
- `strongTorch`: brighter pools for thresholds and combat readability.
- `ritualTorch`: warmer, stronger, slower flicker for important rooms.
- `exteriorTorch`: optional outdoor fixture profile.

The lighting theory is simple: torches create readable pools near walls, corners, thresholds, and combat spaces. Corridors should keep dark falloff between fixtures. Rooms should show silhouettes without becoming fullbright. Dead corners can remain dark.

## Validation

`TorchPlacementValidator.js` runs once when the dungeon location is compiled. It reports through the existing dungeon validation bundle and never spams per frame.

Rules include:

- fixture references a real room
- wall-anchored fixtures use a valid `wallSide`
- fixture is inside authored room rectangles unless explicitly allowed
- fixture is near a wall
- fixture height is roughly 1.5 to 2.3 world units
- `offsetFromWall` stays small and consistent
- fixture is not in the center of a doorway
- fixture does not overlap blockers
- fixture has clearance from doors, props, exits, enemy spawns, and nav waypoints
- fixture normal faces away from the nearest wall into the room or corridor

Warnings are used for soft authoring problems. Doorway-center placement and blocker overlap are errors.

## Flicker

`TorchFlickerController.js` updates registered fixtures without per-frame allocation. It applies subtle deterministic sine-based variation to point light intensity, light radius, flame scale, flame opacity, and glow opacity. Shadows are disabled by default.

The controller can be disabled for low-power modes by setting `enabled` to `false`.

## Light Budget

The first budget concept is profile based:

- each profile has a `mobileCostTier`
- mobile caps active point lights per location and per room
- fixtures over budget remain visual-only
- dynamic shadows are not enabled by default

The current desktop budget is generous. The mobile budget is conservative and intended to be tightened later around player-distance prioritization.

## Debug Tools

Dungeon debug remains dev-only:

- `F2`: toggle dungeon debug
- `F3`: cycle debug layers, including `torches`

Torch debug shows anchor points, facing rays, light radius rings, fixture id, room id, and warning/error status colors.

## Black Grass Temple Migration

Black Grass Temple now authors torches through `torchFixtures` in `src/game/locations/blackGrassTemple.definition.js`.

The migration moved torch data away from loose `kind: 'torch'` point light coordinates and into wall-mounted fixtures. Fixtures were placed on room walls, away from doorway centers, major blockers, and enemy pathing anchors. Warm torch pools remain near the entry, vestibule, offering room, first gate hall, tavern spaces, drinking hall, and reliquary hall. The cold sanctum fill remains a separate authored point light.

No combat, gore, dungeon navigation, deployment config, or GitHub Pages workflow behavior is intentionally changed.

## Future Placement Checklist

When placing a torch:

1. Prefer `wallSide` plus `distanceAlongWall`.
2. Keep `height` around `1.72`.
3. Keep `offsetFromWall` near `0.16`.
4. Avoid doorway centers and exit triggers.
5. Use `weakTorch` for narrow corridors.
6. Use `strongTorch` for combat thresholds.
7. Use `ritualTorch` only for important rooms.
8. Check the `torches` debug layer in dev.

## Current Limitations

- Wall anchors are based on rectangular room bounds.
- Door clearance uses authored connector centers and widths.
- Mobile light budgeting is compile-time, not distance-prioritized at runtime yet.
- Labels in the torch debug layer use simple canvas sprites.
- Procedural visuals are placeholders until authored torch assets exist.
