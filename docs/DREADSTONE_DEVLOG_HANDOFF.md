# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: c0fdbeab47b34033eb85114d63b7f15b539dba26 -->

## Current Handoff Snapshot

### Verified implementation

- **The Dreadmace now has player-authored hammer rotation coupled to vertical grip movement:** `src/game/combat/weapons/MaceWorldWeaponController.js` introduces explicit hammer phases (`resting`, `raising`, `cocked`, `descending`, `recovering`) and derives hammer pitch from measured upward/downward grip travel rather than leaving pitch as a fixed direct-aim component. Raising progressively cocks the head overhead; the downstroke unwinds from the captured top pose toward an authored impact pitch.
- **Hammer orientation remains part of the authoritative weapon transform:** The same quaternion drives visible presentation, collision primitives, head-center motion, angular velocity, swept-contact physics, and diagnostics. The ready pose is intentionally non-identity and angles the imported `-Z` active axis upward while preserving visual/physical unity.
- **Vertical and lateral control are separated:** Hammer pitch is controlled by vertical grip travel, while yaw/roll continue to respond to lateral aim. A cocked hammer can remain overhead while the grip moves laterally, and load-memory decay does not lower the held weapon.
- **Raise/downstroke continuity was hardened:** The controller captures phase-start pitch and grip positions, bounds speed-driven over-center overshoot, tracks raise/downstroke progress and travel, and continues from the current pose when motion reverses. Return and reset paths now target the canonical angled ready quaternion rather than identity.
- **Grip acquisition now uses a projected handle capsule:** The screen-space grab target spans a configured lower-handle segment with a larger bounded radius instead of a circle around the grip origin. Near-handle touches are accepted; distant touches, head-only touches, and touches originating on movement/look controls are rejected. Grab geometry and last-attempt diagnostics were added.
- **Gesture tuning changed:** Full-load travel increased from `0.34` m to `0.42` m, and the hammer-orientation configuration adds rest/top/maximum-top/impact pitches, raise/downstroke travel scales, overshoot speed thresholds, and motion thresholds. These values are implemented but not established as final feel tuning.
- **Regression coverage expanded in `tests/dreadmace-vertical-slice.test.mjs`:** Added assertions cover the angled ready pose, progressive player-authored cocking, over-center bounds, lateral movement while cocked, independence from load-memory decay, downstroke pitch progression, reversal continuity, angular head velocity, visual/physical unity, safe return orientation, and projected-handle acquisition. This record verifies test additions only; it does not claim the suite or CI ran successfully.
- **Previously active systems remain baseline:** Direct physical mace strike tokens/rearming, impact resistance with retained grip ownership, sword pose/extraction authority, Folsom edge-unity dismemberment gating, weighted piercing lethality, collapse-window contact, combat audio, Folsom ambience, and persistent Dreadmace progression remain present unless superseded above.

### Important design decisions

- Mace rotation is authored by the player’s actual vertical grip path. It is not a canned attack animation and is not driven by load-memory decay.
- Visible orientation and physical orientation remain one authority. Rotational movement contributes directly to head velocity and swept collision behavior.
- A raised/cocked pose is persistent while held; lateral placement must remain available without forcing the hammer down or snapping to a fixed top position.
- Direction reversal must continue from the exact current pitch without creating duplicate strike ownership.
- The safe ready/return pose is a canonical angled quaternion, not identity, because the imported mace’s active axis is `-Z`.
- Grip acquisition should correspond to the visible usable handle, remain forgiving near that handle, and reject the mace head and UI-control touches.
- Existing tokenized strike, meaningful-raise rearm, and retained-impact-control decisions remain in force.

### Risks and next logical work

- **Verified risk surface:** Hammer pitch now depends on frame-sampled grip deltas, phase transitions, speed thresholds, travel normalization, over-center overshoot, reversal handling, and return/reset behavior. Low frame rates, very fast pointer motion, micro-reversals near phase boundaries, and starting a new grip from a partially recovered pose can expose discontinuities or unexpected phase changes.
- **Verified risk surface:** Rotational head velocity now materially affects swept contact. Incorrect angular velocity, pivot assumptions, or local-head offset handling could change strike qualification and collision ordering even when the grip path is unchanged.
- **Verified risk surface:** The projected handle capsule depends on camera projection and the configured local handle segment. Extreme field of view, viewport changes, near-camera clipping, rotated poses, and mobile control overlays are the main acquisition edge cases.
- **Inference:** The new `0.42` m full-load travel, pitch limits, overshoot, grab radius, and handle segment are control-feel values rather than proven final tuning. Automated assertions do not establish comfort, perceived weight, discoverability, or accidental-grab rates.
- **Next logical work:** Run `npm run validate:combat` and the focused Dreadmace suite. Manually test slow, fast, partial, and over-center raises; paused cocked holds; lateral repositioning overhead; downstroke reversals; repeated wall/body impacts; release/return/reacquire; low-frame-rate sweeps; and touch acquisition across desktop/mobile viewport sizes. Confirm the visible head and collision head remain coincident and that angular motion produces expected—not inflated—impact energy.

## Development History

### 2026-07-17 01:59 EDT — Update through `c0fdbea`

**Scanned range:** after checkpoint `37e5de4` through observed `main` HEAD `c0fdbeab47b34033eb85114d63b7f15b539dba26`. The intervening `56acfd0` commit (`docs(devlog): update through 37e5de4`) was ignored as a devlog-only self-update. One development commit was included.

**Included commits, chronological:**

- `c0fdbea` — Add player-authored mace hammer rotation

**Grouped development steps:**

1. **Player-authored hammer orientation**
   - Added `MACE_HAMMER_PHASES` and hammer-orientation state to `src/game/combat/weapons/MaceWorldWeaponController.js`.
   - Coupled vertical grip travel to progressive raise, cocked hold, downstroke, recovery, and bounded speed-based over-center pitch.
   - Captured phase-start pitch/grip values so descending and reversed motion continue from the current authoritative pose.

2. **Authoritative rotational physics and safe pose lifecycle**
   - Made the canonical ready quaternion non-identity and reused it for initialization, reset, direct-pose sampling, and return completion.
   - Kept presentation, collision geometry, angular velocity, head-center velocity, and swept physics on the same quaternion.
   - Added hammer phase, pitch, progress, travel, speed, and configured-angle diagnostics.

3. **Projected handle acquisition**
   - Replaced grip-origin circle hit testing with a projected screen-space capsule spanning configured local handle endpoints.
   - Increased the bounded grip radius and added rejection for head-only/distant touches and movement/look UI controls.
   - Added projected segment, radius, distance, and acceptance diagnostics.

4. **Focused regression additions**
   - Expanded `tests/dreadmace-vertical-slice.test.mjs` for canonical ready orientation, progressive raises, cocked lateral freedom, load-memory independence, downstroke/reversal continuity, rotational head velocity, visual/physical unity, safe return, and handle-capsule input behavior.
   - No test execution or CI success is asserted by this record.

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
