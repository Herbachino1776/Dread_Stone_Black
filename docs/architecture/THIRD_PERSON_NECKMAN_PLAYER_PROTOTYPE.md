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

`ThirdPersonCameraController` follows behind the player yaw after the normal `PlayerController` movement update.

Tuning constants:

- `cameraDistance`
- `cameraHeight`
- `cameraLookAtHeight`
- `cameraSideOffset`
- `cameraSmoothing`
- `collisionProbeEnabled`
- `collisionProbeMinDistance`
- `collisionProbeStep`
- `pitchClampMin`
- `pitchClampMax`

The controller keeps Neckman visible from a behind / over-shoulder angle. It performs a simple distance reduction if the desired camera point is outside walkable collision space, which helps in tight dungeon rooms without adding a full camera collision solver.

## Avatar Placement

The avatar root follows the existing player collision position. Since that position is still the first-person camera eye height, the avatar subtracts `playerEyeHeight` to place the model on the floor.

Avatar tuning constants:

- `avatarScale`
- `avatarPositionOffset`
- `avatarRotationOffset`
- `groundOffset`
- `playerEyeHeight`
- `targetHeight`
- `maxWidth`
- `turnSmoothing`

The player collision body and movement logic are unchanged.

## Known Limitations

- Camera wall handling is a simple walkable-space distance fallback, not a polished shoulder-camera collision solver.
- Neckman attack is still an enemy punch animation, repurposed as a sword stab/slash when the sword is visible.
- Each animation root has its own sword clone because the current creature runtime swaps separate GLB scenes.
- Locomotion blending is minimal; the prototype prioritizes stable visibility and easy rollback over animation polish.
- The old FPV systems remain in the codebase behind the mode gate for comparison or rollback.
