# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: 37e5de438faadf588bf95199442e933b05251cac -->

## Current Handoff Snapshot

### Verified implementation

- **Mace control was changed from authored smash animation to direct physical control:** `src/game/combat/weapons/MaceWorldWeaponController.js` now derives the visible and collision pose directly from thumb-driven position/rotation, tracks real upward/downward head travel and velocity, and qualifies strikes from recent load energy, downward motion, total head speed, travel, and contact-normal alignment. The state model is now `ready`, `held`, `loading`, `striking`, `impact_resistance`, and `returning` rather than the prior loaded/smashing/follow-through sequence.
- **Dreadmace strike ownership and rearming were hardened:** One active strike token governs a continuous downward action, resolved actors are capped per strike, resting contact and small vibration cannot mint another strike, and a meaningful physical raise is required to rearm. Solid impact preserves pointer ownership and enters a short impact-resistance state rather than releasing control.
- **Visible, physical, and diagnostic mace poses now share one authority:** The controller records position, rotation, and visual-to-physical head tracking error. `CombatLabDebugPanel.js` exposes direct-control travel, speed, strike qualification, resistance, and unity diagnostics. The diff also makes the mace head the required earliest valid damaging primitive in the covered contact case.
- **Sword free presentation was simplified to one authoritative pose:** `src/game/combat/weapons/SwordWorldWeaponController.js` removes the prior independently smoothed render target path. Free held pose, collision primitives, visible blade, and thumb response are derived from the same authoritative grip/quaternion. Presentation diagnostics now report tip/edge unity and extraction-cycle state.
- **Sword extraction continuity became a non-stacking authoritative offset:** Embedded world pose is preserved when returning to the viewmodel, then a 0.1-second offset decays toward the current thumb-driven pose. New input remains one-to-one during decay, and a later extraction replaces rather than accumulates the previous offset.
- **Folsom sword dismemberment now rejects visible/physical edge divergence:** `src/game/combat/FolsomShowcaseSwordDismemberment.js` adds a 0.01 m visible-to-physical edge tolerance. Neck/elbow detachment is rejected when the scheduled physical edge is too far from the visible blade, with dedicated rejection diagnostics.
- **Regression coverage expanded:** `tests/dreadmace-vertical-slice.test.mjs`, `tests/puncture-only-weapons.test.mjs`, `tests/combat-showcase-polish.test.mjs`, and `tests/folsom-combat-showcase.test.mjs` were updated. Added assertions cover direct mace pose unity, physical strike/rearm behavior, retained thumb ownership, sword pose/collider unity, ten continuous-hold impalement/extraction cycles, non-stacking extraction offsets, and ghost-edge dismemberment rejection. These are verified test additions; this record does not claim that the tests or CI ran successfully.
- **Previously active systems remain part of the baseline:** Folsom weighted piercing lethality, collapse-window contact, authored dying-state detachment, shared weapon viewmodel ownership, persistent Dreadmace reward, combat audio, and Folsom daytime ambience remain present unless superseded by the direct-control changes above.

### Important design decisions

- Mace damage must come from measured player-driven physical movement and contact geometry, not a prerecorded smash arc.
- The visible weapon, collision primitives, and gameplay pose must remain coincident; diagnostics and acceptance gates explicitly detect divergence.
- A Dreadmace strike is a bounded tokenized action. Continued overlap, rest, or vibration cannot repeatedly damage; meaningful upward movement rearms the next strike.
- Impact resistance preserves continuous grip ownership, allowing the player to feel/control the weapon through contact instead of transferring authority to an automatic recoil sequence.
- Sword extraction continuity is an offset layered onto the current authoritative free pose, not a second pose controller. New thumb input remains immediate, and offsets never stack across cycles.
- Folsom authored dismemberment requires both valid seam/gesture evidence and visible-to-physical blade agreement within 1 cm.
- Actor contact lifetime and piercing lethality decisions from the prior checkpoint remain unchanged by this commit.

### Risks and next logical work

- **Verified risk surface:** Direct mace control changes gesture thresholds, state transitions, collision sweep timing, strike IDs, target caps, pointer ownership, resistance, rearm behavior, and diagnostics in one controller. Edge cases include low-frame-rate sweeps, rapid direction reversals, glancing haft/grip contacts, repeated solid contact, and rearming while still intersecting geometry.
- **Verified risk surface:** Sword presentation no longer has the old render smoothing path. Camera movement, extraction, equipment switching, location transitions, and rapid repeated impalement cycles are the key paths for visible/collider divergence or transform discontinuity.
- **Verified risk surface:** The 0.01 m Folsom edge-unity gate can reject valid-looking dismemberment if scheduling or frame interpolation produces transient error; conversely, its effectiveness depends on the diagnostic being sampled at the correct contact instant.
- **Inference:** New mace travel/speed/load thresholds and workspace sensitivities are control-feel and balance values, not demonstrated final tuning. Automated tests cannot establish weight, resistance, or responsiveness in live play.
- **Next logical work:** Run `npm run validate:combat` plus the focused mace, puncture, and Folsom suites. Manually test slow/fast raises, diagonal and glancing blows, repeated wall/body contact, frame-rate extremes, and strike rearming. Verify the mace head remains visually coincident with collision through impact resistance. Repeat sword stab/extract cycles while moving the camera and thumb, then confirm Folsom neck/elbow cuts accept the visible blade and reject ghost contacts without false negatives.

## Development History

### 2026-07-16 17:58 EDT — Update through `37e5de4`

**Scanned range:** after checkpoint `8011cac` through observed `main` HEAD `37e5de438faadf588bf95199442e933b05251cac`. The intervening `817f79c` commit (`docs(devlog): update through 8011cac`) was ignored as a devlog-only self-update. One development commit was included.

**Included commits, chronological:**

- `37e5de4` — Unify direct mace and sword control

**Grouped development steps:**

1. **Direct Dreadmace control and physical strike qualification**
   - Reworked `src/game/combat/weapons/MaceWorldWeaponController.js` from an authored loaded/smash/follow-through arc to direct thumb-controlled position and rotation.
   - Added measured upward/downward head travel, velocity, recent load energy, downward strike qualification, contact-normal checks, active strike tokens, per-strike target limits, impact resistance, and meaningful-raise rearming.
   - Preserved grip ownership through solid impact and added visual/physical pose-unity diagnostics.

2. **Sword presentation and extraction authority**
   - Updated `src/game/combat/weapons/SwordWorldWeaponController.js` so free display pose, collision primitives, and thumb response use one authoritative transform.
   - Replaced the previous free-presentation smoothing path with a 0.1-second non-stacking extraction continuity offset that preserves the embedded world pose while allowing immediate input.

3. **Dismemberment presentation gate and diagnostics**
   - Added `FOLSOM_SHOWCASE_VISIBLE_PHYSICAL_EDGE_TOLERANCE` in `src/game/combat/FolsomShowcaseSwordDismemberment.js`.
   - Rejected authored neck/elbow detachment when visible and scheduled physical sword edges differ by more than 0.01 m.
   - Added presentation-error rejection counts and last-error diagnostics.

4. **Combat Lab diagnostics**
   - Updated `src/game/combat/CombatLabDebugPanel.js` to display direct mace travel/speed, strike identity and qualification, impact resistance, and position/rotation/head unity errors.

5. **Regression additions**
   - Expanded `tests/dreadmace-vertical-slice.test.mjs` for direct physical movement, earliest damaging head contact, retained pointer ownership, strike-token rearm rules, and reset semantics.
   - Expanded `tests/puncture-only-weapons.test.mjs` for free sword pose/collider unity, authoritative extraction continuity, and ten repeated continuous-hold impalement cycles.
   - Updated `tests/combat-showcase-polish.test.mjs` for the revised presentation-continuity behavior.
   - Expanded `tests/folsom-combat-showcase.test.mjs` to reject a ghost physical edge and accept coincident visible neck/elbow cuts. No test-run result is asserted by this record.

### 2026-07-16 14:00 EDT — Update through `8011cac`

**Scanned range:** after checkpoint `d834905` through observed `main` HEAD `8011cac64e6147e0c236f1571742e0a7277e2474`. The intervening `dff70d9` commit (`docs(devlog): update through d834905`) was ignored as a devlog-only self-update. One development commit was included.

**Included commits, chronological:**

- `8011cac` — Polish Folsom weapon lethality and presentation

**Grouped development steps:**

1. **Piercing lethality and authored mortality**
   - Added `FOLSOM_PIERCING_LETHALITY_CONFIG` and accepted-piercing filtering in `src/game/combat/CombatLabWalkerController.js`.
   - Added depth- and region-sensitive sword-thrust credits, retained knife thresholds, and changed wound accounting to apply only incremental credit increases.
   - Added forced fatal transitions in `src/game/combat/AuthoredHumanoidDeathController.js` and walker death handling.

2. **Collapse-window weapon contact and detachment**
   - Added explicit actor combat-contact state in `src/game/combat/HumanoidCombatActor.js`, `CombatLabWalkerController.js`, and `FolsomCombatEncounter.js`.
   - Separated release of player blockers from final removal of combat routing and colliders.
   - Updated `src/game/combat/FolsomShowcaseSwordDismemberment.js` so accurately aimed authored detachments may occur while an actor is dying, but not once grounded or disposed.
   - Preserved single-shot mortality semantics for physical head/forearm detachment during the dying state.

3. **Shared first-person weapon presentation**
   - Added `src/game/combat/weapons/WeaponViewmodelAnchor.js` as the shared camera-relative presentation root and diagnostics layer.
   - Updated `src/game/hosts/FirstPersonViewmodelHost.js`, `WorldKnifeCombatController.js`, `SwordWorldWeaponController.js`, and `MaceWorldWeaponController.js` to use the common ownership and continuity model.
   - Added pose-preserving reparenting for knife/sword embed and extraction, duplicate-root diagnostics, transform-write diagnostics, and bounded continuity recovery.

4. **Dreadmace pose and return polish**
   - Reworked free aim, extension, and load as composable pose inputs in `MaceWorldWeaponController.js`.
   - Captured actual displayed poses at grip, swing commitment, and return start.
   - Added time-based critically damped return behavior and passed frame delta from `CombatLabScene.js` into weapon presentation updates.

5. **Regression and validation additions**
   - Added `tests/combat-showcase-polish.test.mjs` and included it in `validate:combat`.
   - Expanded `tests/folsom-combat-showcase.test.mjs`, `tests/folsom-combat-walker.test.mjs`, `tests/testman-damage-segments.test.mjs`, `tests/combat-foundation.test.mjs`, and `tests/dreadmace-vertical-slice.test.mjs`.
   - Assertions cover two-hit sword-thrust mortality, dying/grounded contact boundaries, detachment without duplicate mortality, authoritative weapon-root ownership, exact reparenting continuity, and Dreadmace pose transitions. No test-run result is asserted by this record.

### 2026-07-16 10:03 EDT — Bootstrap through `d834905`

**Scanned range:** `7873996` through `d834905` (latest 10 non-devlog commits; checkpoint set to observed `main` HEAD `d834905ddfe74bd2914a4837243dd253161662fa`).

**Included commits, chronological:**

- `7873996` — Add files via upload
- `8710f9f` — Create te
- `720ead0` — Delete public/audio/combat/te
- `b09001d` — Create ye
- `e2b5896` — Add files via upload
- `f134156` — Delete public/audio/combat/ye
- `f028758` — Implement downward-smash Dreadmace vertical slice
- `43b4f53` — Integrate accepted stab and male death audio
- `6087407` — Integrate Folsom daytime ambience
- `d834905` — Add Folsom combat showcase dismemberment

**Grouped development steps:**

1. **Audio assets and cleanup**
   - Added Folsom daytime ambience WAVs under `public/audio/ambience/`.
   - Added sword stab and male death WAVs under `public/audio/combat/`.
   - Removed temporary placeholder files `public/audio/combat/te` and `public/audio/combat/ye`.

2. **Dreadmace combat slice**
   - Added blunt-impact interaction/trauma handling in combat systems and actor routing.
   - Added downward-smash gesture state, diagnostics, Combat Lab equip controls, and dedicated tests.
   - Extended development equipment loading for sword/mace in Combat Lab.

3. **Accepted combat audio integration**
   - Registered stab/death cues in the audio manifest.
   - Added owner-scoped cancellation, voice limits, spatial position providers, and cleanup APIs in the audio runtime.
   - Routed accepted penetration/death lifecycle events into combat audio with test coverage.

4. **Folsom daytime ambience integration**
   - Added authored ambience configuration and runtime scheduling for loops and randomized spatial one-shots.
   - Resolved emitters against canonical Folsom foliage and structure definitions.
   - Added diagnostics and Folsom ambience validation.

5. **Folsom combat showcase and progression**
   - Added extra showcase walkers and explicit sword-sweep dismemberment support.
   - Updated death/walker synchronization for fatal segment detachment.
   - Added persistent Dreadmace acquisition from a Folsom courtyard chest.
   - Expanded Folsom/combat tests and validation scripts for showcase spawning, damage segments, persistence, and detachment boundaries.
