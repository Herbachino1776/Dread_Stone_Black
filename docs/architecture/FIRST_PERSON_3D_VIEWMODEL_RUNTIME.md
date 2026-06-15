# First-Person 3D Viewmodel Runtime

## Purpose

The first-person 3D viewmodel runtime owns the player-facing hands and weapon presentation. It is a camera-space visual system, not a world actor, enemy, NPC, collider, or gameplay damage source. Combat timing, equipment state, movement, dungeon runtime, lighting, objectives, and enemy systems continue to drive gameplay outside this runtime.

## Prototype Body Asset

The first plugged-in body is the full Neckman idle rig:

- `public/assets/player/fpv/neckman_01_optimized_idle.glb`

The source asset is still a full skinned body, but normal gameplay no longer renders that full body. The runtime uses the GLB as an animated skeleton source and builds visible first-person arms from its skinned geometry at load time.

## Corrective pass: arms-only extraction

The previous full-body camera-space framing failed because Neckman remained a complete world-character mesh positioned in front of the player camera. In practice the viewport could show the character's back, head, shoulders, torso, and other non-first-person body parts. Moving and scaling the complete body was too fragile because the camera was still looking at a full third-person actor.

The corrective pass keeps the original GLB scene loaded for bones and idle animation, then hides the original SkinnedMesh instances. For each Neckman SkinnedMesh, the runtime creates a replacement `SkinnedMesh` whose `BufferGeometry` contains only triangles sufficiently influenced by the first-person arm bone set:

- `shoulder_right`
- `arm_right_top`
- `arm_right_bot`
- `arm_right_hand`
- `shoulder_left`
- `arm_left_top`
- `arm_left_bot`
- `arm_left_hand`

The geometry filter preserves the attributes needed by the skinned viewmodel path:

- `position`
- `normal`
- `uv` when present
- `skinIndex`
- `skinWeight`
- index data

The extracted arms mesh reuses the original skeleton and bind pose, so the Neckman idle clip still drives the visible hands and forearms. The full-body source rig may remain in the scene graph, but its original renderable meshes are hidden.

## Weapon Asset

The current sword model is:

- `public/assets/models/weapons/weapon_broadsword_ritual_01.glb`

The sword is attached to Neckman's right hand bone:

- `arm_right_hand`

The runtime parents a `weaponHolder` group to `arm_right_hand` and puts the sword model under that holder. This gives the sword a dedicated local transform for grip tuning and attack motion while keeping it driven by the right hand bone.

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
- `armsRoot` / `modelRoot`: holds the hidden Neckman source rig plus the extracted visible arms.
- `weaponHolder`: parented to the `arm_right_hand` bone when available.
- `weaponRoot`: child of `weaponHolder`; owns the sword grip offset, rotation, and scale.
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
- The existing `playAttack(weaponProfile)` hook triggers a fast procedural slash and recovery on `weaponHolder`, the sword model path, and small additive right hand / forearm rotations.
- Attack calls during the opening part of a swing are ignored to prevent transform corruption.

Attacks must not animate `viewmodelRoot` or rotate the whole Neckman rig. Root-level rotation makes the first-person model read like a spinning world character or cardboard sprite. The stable base pose stays on the camera-local viewmodel and arms roots; attack motion belongs on the weapon holder, sword, and optionally hand/forearm bones.

Tuning constants in `FIRST_PERSON_VIEWMODEL_CONFIG` include:

- `viewmodelPosition`
- `viewmodelRotation`
- `viewmodelScale`
- `armsPosition`
- `armsRotation`
- `armsScale`
- `swordPositionOffset`
- `swordRotationOffset`
- `swordScale`
- `idleAnimationSpeed`
- `idleSwayAmount`
- `idleBobAmount`
- `attackDuration`
- `attackRecoverDuration`
- `swordSwingRotation`
- `swordSwingOffset`
- `rightHandAttackRotation`
- `rightForearmAttackRotation`
- `attackRecoilOffset`
- `attackRecoilRotation`
- `attackAmplitude`

## Known Limitations

- The arms-only extraction is runtime mesh filtering, not an authored first-person arms asset. It may still need grip and lower-third framing polish after visual review.
- Shoulder-weighted geometry is included only when enough triangle vertices are influenced by the arm set, which avoids rendering the full torso but may need retuning if the source skin weights change.
- The sword local scale is large because it is parented under the scaled Neckman skeleton. This is deliberate and documented in config as a compensation for the source rig scale.
- There is no authored first-person attack animation yet; the slash is procedural.

## Future Replacement Path

A future authored arms-only GLB should keep a right-hand socket or bone equivalent to `arm_right_hand`. If the replacement model preserves that socket contract, the runtime can swap asset paths and retune offsets without rewriting combat, equipment, camera, or dungeon systems.
