# Third-Person Neckman Player Prototype

## Purpose

This prototype salvages the Neckman work by moving the full-body character out of first person and into a third-person player presentation. The first-person Neckman approach failed visually because the source asset is a complete animated body, not an authored first-person hands rig. Attempts to frame it in camera space made the player see awkward body, shoulder, head, and arm shapes.

The third-person path keeps the existing movement, collision, combat, equipment, HUD, dungeon, enemy, hunger, inventory, and objective systems. It adds a visible avatar layer plus a follow camera.

## Active Mode

`src/game/Game.js` owns the mode flag:

- `PLAYER_PRESENTATION_MODE = 'thirdPerson'`

When this flag is set to `thirdPerson`:

- `FirstPersonArmsOverlay` is not instantiated.
- `FPVEquipmentRenderer` is not instantiated.
- the DOM first-person arms and placeholder weapon layer is hidden.
- `ThirdPersonNeckmanPlayerAvatar` becomes the combat visual hook used by `Combat`.
- `ThirdPersonCameraController` overwrites the old first-person camera placement after normal player movement updates.

To disable or revert the prototype cleanly, change `PLAYER_PRESENTATION_MODE` away from `thirdPerson` and restore the old FPV renderer wiring in `Game.js`, or revert this PR. No dungeon, equipment, enemy, survival, HUD, or objective systems need to be removed.

## Neckman Assets

The prototype uses the existing Neckman enemy animation files:

- `public/assets/enemies/neck_man/neckman_01_optimized_idle.glb`
- `public/assets/enemies/neck_man/neckman_01_optimized_walk.glb`
- `public/assets/enemies/neck_man/neckman_01_optimized_run.glb`
- `public/assets/enemies/neck_man/neckman_01_optimized_punch_right.glb`

Runtime state mapping:

- `idle` uses `idle`
- `walk` uses `walk`
- `run` uses `run`
- `attack` uses `punch_right`

The runtime loads these through `loadDungeonModel`, using Neckman's existing creature scale values from `neckManConfig`.

## Sword Attachment

The sword asset is:

- `public/assets/models/weapons/weapon_broadsword_ritual_01.glb`

The sword is attached to Neckman's right hand bone:

- `arm_right_hand`

Because the current creature animation system swaps separate GLB roots per animation, the prototype attaches a cloned sword model to the `arm_right_hand` bone on each loaded animation root. The active animation root controls which sword clone is visible.

Sword tuning constants live in `THIRD_PERSON_NECKMAN_PLAYER_CONFIG`:

- `swordPositionOffset`
- `swordRotationOffset`
- `swordScale`

## Equipment Integration

Equipment state remains the source of truth. `ThirdPersonNeckmanPlayerAvatar` listens for `EQUIPMENT_EVENTS.equippedChanged` and checks the current weapon profile.

- unarmed: Neckman remains visible, sword holders are hidden
- sword weapon profiles such as `rusted_sword` and `broadsword_ritual_01`: sword holders are visible

Combat still calls `playAttack(weaponProfile)` through the existing visual hook. When the sword is equipped, the attached sword follows the punch animation and reads as a temporary stab or slash prototype.

## Camera Behavior

`ThirdPersonCameraController` follows behind the player yaw after the normal `PlayerController` movement update. The corrected framing moves the default camera farther back and higher so Neckman sits in the lower-middle of a portrait viewport instead of filling the screen. The camera looks slightly downward and smooths both the follow target and the camera position from the same authoritative player position.

Tuned defaults:

- `cameraDistance`: `6.1`
- `cameraHeight`: `3.0`
- `cameraLookAtHeight`: `1.42`
- `cameraSideOffset`: `0.22`
- `cameraSmoothing`: `0.18`
- `cameraPitch`: `-8°`
- `minCameraDistance`: `2.35`
- `maxCameraDistance`: `7.25`
- `collisionProbeEnabled`: `true`
- `collisionProbeMinDistance`: `2.35`
- `collisionProbeStep`: `0.22`
- `pitchClampMin` / `pitchClampMax`: `-28°` / `28°`

The controller keeps Neckman visible from a behind / over-shoulder angle. It performs a simple distance reduction if the desired camera point is outside walkable collision space, which helps in tight dungeon rooms without adding a full camera collision solver. The fallback no longer allows the camera to collapse into an extreme close-up unless collision constraints force the configured minimum distance.

## Avatar Placement

The avatar root follows the existing player collision position. Since that position is still the first-person camera eye height, the avatar subtracts `playerEyeHeight` to place the model on the floor.

Avatar tuning constants:

- `avatarScale`: `0.78`
- `avatarPositionOffset`: `{ x: 0, y: 0, z: 0 }`
- `avatarRotationOffset`: `0`
- `groundOffset`: `0`
- `playerEyeHeight`: `1.55`
- `targetHeight`: inherited from `neckManConfig.scale.targetHeight`
- `maxWidth`: inherited from `neckManConfig.scale.maxWidth`
- `turnSmoothing`: `10`
- `rootMotionEpsilon`: `0.00001`

The player collision body and movement logic are unchanged. The avatar scale is reduced from the first prototype so the model reads as a player-sized character at the corrected third-person camera distance. Feet remain grounded by keeping the same eye-height subtraction and zero ground offset.

## Jitter Stability

The authoritative player transform remains `PlayerController.position` and `PlayerController.yaw`. The third-person update order is intentionally narrow:

1. `PlayerController.update` applies input, collision, authoritative position, yaw, and pitch.
2. `ThirdPersonNeckmanPlayerAvatar.update` places the avatar root from that authoritative position and smooths visual yaw toward movement/look direction.
3. Avatar animation mixers advance.
4. Root motion is neutralized after mixer updates by removing root-position tracks where possible and re-centering each animation root under the avatar group if an animation still moves it.
5. `ThirdPersonCameraController.update` follows a smoothed target derived from the same authoritative player position.
6. Dungeon, combat, HUD, feedback, and render continue through the existing game loop.

The visible jitter root cause was likely a combination of close camera framing amplifying small avatar/camera corrections and animation root translation competing with the gameplay-driven avatar root. The corrective path keeps gameplay movement as the only world-space source of truth, smooths visual yaw with angle interpolation, and prevents animation clips from drifting the avatar roots through the world.

## Known Limitations

- Camera wall handling is a simple walkable-space distance fallback, not a polished shoulder-camera collision solver. Very tight spaces can still push the camera to the configured minimum distance.
- Neckman attack is still an enemy punch animation, repurposed as a sword stab/slash when the sword is visible.
- Each animation root has its own sword clone because the current creature runtime swaps separate GLB scenes.
- Locomotion blending is minimal; the prototype prioritizes stable visibility and easy rollback over animation polish.
- The old FPV systems remain in the codebase behind the mode gate for comparison or rollback.
