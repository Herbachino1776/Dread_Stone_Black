# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: 76c7ea885790c153ef710457174c80a847da7948 -->

## Current Handoff Snapshot

### Verified implementation

- **Sword impalement now follows the shared knife-style depth model:** The final state in `src/game/combat/weapons/SwordWorldWeaponController.js` derives penetration/withdrawal rates, lateral bind distance, forced-extraction distance, and force transfer from `KNIFE_COMBAT_CONFIG`. Penetration depth is computed along the target body-local entry axis, with tissue resistance and authored hard-structure depth participating in advancement.
- **Embedded swords can be released, remain planted, and be reacquired:** Grip acquisition no longer rejects an active impalement. Releasing an embedded sword leaves it planted rather than auto-withdrawing; reacquisition resumes embedded control. Extraction and invalid-target cleanup remain explicit.
- **Embedded collision routing is selective:** Colliders belonging to the penetrated actor are suppressed during embedded movement to prevent repeated sticky self-collision, while other-target contact can still be resolved. Diagnostics count same-target suppression, other-target embedded contact, cleanup reasons, and tracking error.
- **Life-state integration is explicit:** `HumanoidCombatActor.js` notifies an active embedded weapon when the target changes life state. The sword controller tracks target life state and cleanup behavior rather than relying only on generic disposal.
- **Player/enemy trapping has a dedicated separation system:** New `src/game/ActorSeparation.js` supplies deterministic contact normals, stable blocker ordering, inward-motion rejection with tangential sliding, bounded player depenetration, and close-range enemy separation/hold/approach logic.
- **Collision movement now treats combat actors separately from static world geometry:** `src/game/Collision.js` constrains actor-relative movement before/alongside world collision, can ignore actor blockers for standability checks, applies bounded overlap recovery, and exposes detailed movement diagnostics.
- **Combat actors expose authoritative locomotion blockers:** Walker/actor code marks living combat volumes for player locomotion blocking and releases them through the existing death/contact lifecycle. Close enemies are prevented from continuing inward compression when minimum spacing is reached.
- **Diagnostics and tests expanded:** `CombatLabDebugPanel.js` now reports sword impalement and actor-separation state. `tests/actor-separation.test.mjs` was added, and sword/combat/Folsom tests were expanded. These diffs verify test coverage changes only; they do not prove successful local or CI execution.
- **Existing baseline remains:** Player-authored Dreadmace rotation, unified weapon presentation/physics, Folsom dismemberment gating, weighted piercing lethality, combat audio, Folsom ambience, and persistent Dreadmace progression remain active unless superseded above.

### Important design decisions

- Sword impalement depth authority is target-body-axis projection with knife-parity resistance and extraction semantics, not unconstrained camera-space tracking.
- Releasing an embedded sword should preserve a planted weapon that can be grabbed again; release is not automatic extraction.
- The penetrated target’s own colliders must not repeatedly block the embedded sword, but unrelated targets remain valid collision candidates.
- Actor separation must block only inward compression while preserving tangential escape, use deterministic normals for exact overlap, and cap depenetration per frame.
- Living combat actors are authoritative locomotion blockers; blocker release remains tied to the actor life/contact lifecycle rather than visual presentation alone.

### Risks and next logical work

- **Verified risk surface:** Three consecutive sword commits replaced portions of the embedded-control model. The canonical behavior is the final `97d21dc` knife-parity implementation; any assumptions based on the earlier camera-relative or corpse-detached intermediate versions are stale.
- **Verified risk surface:** Body-local entry axes and moving actor bodies can expose discontinuities if the body transform disappears, changes ownership, or detaches during death/dismemberment. Cleanup and rearm gates should be checked across those transitions.
- **Verified risk surface:** Selective same-target collider suppression must not hide legitimate extraction or permit the sword to tunnel into adjacent geometry/actors while planted.
- **Verified risk surface:** Actor separation now spans player movement, world collision, blocker metadata, walker motion, death-state release, exact-overlap fallback normals, and multiple simultaneous enemies. Ordering or stale blocker registration could create jitter, overcorrection, or new escape failures.
- **Inference:** Knife-parity constants and the new separation clearances/iteration caps are implemented tuning values, not proof of final feel or stability under low frame rate and dense crowds.
- **Next logical work:** Run the focused sword tests, `tests/actor-separation.test.mjs`, `npm run validate:combat`, and Folsom walker validation. Manually test planted release/regrab, slow and fast extraction, moving/dying/dismembered targets, adjacent-target contact while embedded, exact player/enemy overlap, diagonal escape, wall-plus-enemy pinches, multiple-enemy crowding, and blocker release during collapse. Confirm diagnostics show bounded correction without inward leakage or oscillation.

## Development History

### 2026-07-18 14:00 EDT — Update through `76c7ea8`

**Scanned range:** after checkpoint `c0fdbea` through observed `main` HEAD `76c7ea885790c153ef710457174c80a847da7948`. The intervening `99f3569` commit (`docs(devlog): update through c0fdbea`) was ignored as a devlog-only self-update. Four development commits were included.

**Included commits, chronological:**

- `dfa2155` — Fix sword impalement grab stickiness
- `27a9916` — Fix sword impalement grab stickiness
- `97d21dc` — Fix sword impalement grab stickiness
- `76c7ea8` — Fix player trapping against close enemies

**Grouped development steps:**

1. **Sword impalement lifecycle and direct-control iteration**
   - `src/game/combat/weapons/SwordWorldWeaponController.js` was repeatedly revised to remove released auto-withdrawal, permit reacquisition while embedded, add explicit impalement cleanup/extraction diagnostics, suppress repeat collisions against the penetrated target, and preserve collision checks against other targets.
   - The intermediate corpse-detachment approach was superseded by the final knife-parity model in `97d21dc`: penetration/withdrawal rates and lateral bind/forced-extraction/force-transfer values now derive from `KNIFE_COMBAT_CONFIG`, depth is projected along the target body-local entry axis, and the sword may remain planted when released and be grabbed again.
   - The final implementation restores live target-body anchoring via `physicsBodyLocalToWorld` / `physicsBodyLocalDirectionToWorld`, applies knife-style penetration advancement and tissue/hard-structure resistance, and keeps damage intent disabled for non-damaging planted/withdrawal states.
   - `HumanoidCombatActor.js` notifies embedded weapons on life-state changes. Combat Lab diagnostics expose impalement state, target life state, knife-parity mode, depth, resistance, extraction, collision suppression, tracking error, and cleanup counters.

2. **Sword regression coverage**
   - `tests/puncture-only-weapons.test.mjs` and related combat tests were substantially expanded across the three sword commits to cover embedded reacquisition, planted release behavior, same-target suppression, external contact while embedded, extraction/cleanup, body-local anchoring, knife-parity depth control, and target life-state transitions.
   - This record verifies that tests were added or changed; it does not claim they were executed successfully.

3. **Authoritative player/enemy separation**
   - Added `src/game/ActorSeparation.js` with deterministic horizontal fallback normals, authoritative combat-actor blocker filtering, player movement projection against actor volumes, bounded depenetration, stable blocker ordering, and close-range enemy separation/hold/approach resolution.
   - `src/game/Collision.js` now separates world collision from actor collision, allows tangential sliding while blocking inward movement, applies bounded overlap recovery, and records movement/depenetration diagnostics.
   - Combat actors and walker control were updated so living enemies expose locomotion blockers, release them through the existing death/contact lifecycle, and use explicit close-range separation rather than continuing to compress the player.
   - `CombatLabDebugPanel.js` surfaces nearest-enemy distance, required clearance, overlap, correction vectors, constrained actor IDs, and movement-block reason.

4. **Separation regression coverage**
   - Added `tests/actor-separation.test.mjs` and updated combat, Folsom walker, Dreadmace, puncture-coordinate-space, puncture-only, and damage-segment tests for blocker filtering, diagonal/tangential movement, deterministic overlap recovery, multiple-enemy constraints, close-range walker separation, and death-state blocker release.
   - No test execution or CI success is asserted by this record.

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
