# First-Person 3D Viewmodel Runtime

## Purpose

The first-person 3D viewmodel runtime owns the player-facing hands and weapon presentation. It is a camera-space visual system, not a world actor, enemy, NPC, collider, or gameplay damage source. Combat timing, equipment state, movement, dungeon runtime, lighting, objectives, and enemy systems continue to drive gameplay outside this runtime.

## Prototype Body Asset

The first plugged-in body is the full Neckman idle rig:

- `public/assets/player/fpv/neckman_01_optimized_idle.glb`

This is intentionally a prototype pass. The asset is a full skinned body with a skeleton and idle animation, so the runtime positions and scales the full model under the camera until mostly hands, forearms, and lower arms read in first person. The code does not do mesh surgery. Future passes should replace this file with a cleaner arms-only GLB while preserving the same runtime concepts: camera-space root, animated model root, and weapon socket attachment.

## Weapon Asset

The current sword model is:

- `public/assets/models/weapons/weapon_broadsword_ritual_01.glb`

The sword is attached to Neckman's right hand bone:

- `arm_right_hand`

Fallback/debug socket names are available in code for asset inspection and future tuning:

- `arm_right_bot`
- `arm_right_top`
- `shoulder_right`
- `arm_left_hand`
- `arm_left_bot`
- `arm_left_top`
- `shoulder_left`

## Runtime Shape

`src/game/fpv/FirstPersonViewModel.js` creates and owns:

- `viewmodelRoot`: parented to the player camera, so it follows camera position and orientation.
- `armsRoot` / `modelRoot`: holds the Neckman prototype model and idle animation mixer.
- `weaponRoot`: parented to the `arm_right_hand` bone when available.
- `rightHandAttachTarget`: the resolved right-hand socket.
- `currentWeaponModel`: the loaded ritual broadsword model.
- An animation mixer when the Neckman GLB exposes animation clips.
- Procedural idle sway and attack motion.

The root is camera-local and does not enter collision, navigation, enemy, or actor registries. Materials are prepared with disabled shadow casting/receiving and conservative depth behavior so the viewmodel reads in dark dungeon lighting without throwing large shadows into the world.

## Equipment Integration

The runtime listens to `EquipmentRuntime` equipped-state events. Normal equipment state remains the source of truth:

- `unarmed`: shows the Neckman FPV hands/arms and hides the sword.
- `rusted_sword`: shows the ritual broadsword GLB attached to `arm_right_hand`.
- `broadsword_ritual_01`: also shows the ritual broadsword GLB.

The existing `rusted_sword` weapon profile maps its `fpvProfileId` to `broadsword_ritual_01`, so the authored rusted sword chest and equipment panel stay on the existing equipment path while the first-person visual uses the real broadsword asset.

## Legacy 2D Path

The previous DOM arms and placeholder weapon overlay remains in the codebase only as a disabled legacy/debug fallback. Normal gameplay does not instantiate `FirstPersonArmsOverlay` or `FPVEquipmentRenderer`, and the shell marks the DOM FPV overlay hidden behind `ENABLE_LEGACY_DOM_FPV = false`.

## Animation And Attacks

If the Neckman GLB exposes clips, the runtime plays the idle clip through a `THREE.AnimationMixer`. It also layers procedural camera-space motion:

- Idle sway and bob keep the hands from feeling static.
- `Combat.tryPlayerAttack()` still owns gameplay timing and damage.
- The existing `playAttack(weaponProfile)` hook triggers a fast procedural slash and recovery on the viewmodel.
- Attack calls during the opening part of a swing are ignored to prevent transform corruption.

Tuning constants in `FIRST_PERSON_VIEWMODEL_CONFIG` include:

- `viewmodelPosition`
- `viewmodelRotation`
- `viewmodelScale`
- `neckmanModelScale`
- `neckmanModelPosition`
- `neckmanModelRotation`
- `weaponPositionOffset`
- `weaponRotationOffset`
- `weaponScale`
- `swordPositionOffset`
- `swordRotationOffset`
- `swordScale`
- `idleAnimationSpeed`
- `idleSwayAmount`
- `idleBobAmount`
- `attackDuration`
- `attackRecoverDuration`
- `attackSwingRotation`
- `attackSwingOffset`
- `attackBobAmount`
- `attackAmplitude`

## Known Limitations

- The full Neckman body is still present; positioning hides as much of the non-arm body as practical, but it is not a final arms-only model.
- The sword grip offsets are first-pass runtime tuning and should be revisited with visual review.
- The sword local scale is large because it is parented under the scaled Neckman skeleton. This is deliberate and documented in config as a prototype compensation.
- There is no authored first-person attack animation yet; the slash is procedural.

## Future Replacement Path

A future arms-only GLB should keep a right-hand socket or bone equivalent to `arm_right_hand`. If the replacement model preserves that socket contract, the runtime can swap asset paths and retune offsets without rewriting combat, equipment, camera, or dungeon systems.
