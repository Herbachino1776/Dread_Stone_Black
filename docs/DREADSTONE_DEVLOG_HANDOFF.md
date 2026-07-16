# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: 8011cac64e6147e0c236f1571742e0a7277e2474 -->

## Current Handoff Snapshot

### Verified implementation

- **Folsom piercing lethality was formalized and corrected:** `CombatLabWalkerController.js` now defines an explicit Folsom piercing-lethality configuration for accepted puncture and sword-thrust wounds. Deliberate, surface-rupturing sword thrusts from the Dreadstone sword can contribute one or two terminal credits based on region and depth; qualifying knife wounds retain region-specific depth thresholds. The policy tracks incremental wound weight so an existing wound can increase credit without being counted twice, and the terminal threshold remains two credits.
- **Fatal authored deaths now force the fatal life-state transition:** Authored stationary and walker death controllers pass `forceFatal: true` when entering `dying`, reducing ambiguity when the triggering wound path has not already committed mortality. Head/face/skull were also added to the vital-region set used by accepted piercing evaluation.
- **Dying actors remain weapon-contactable until grounded:** Folsom actors now distinguish living, dying/contactable, grounded, and disposed contact states. On death start, player-blocking collision is released, but combat routing and actor colliders remain active so accurately aimed sword follow-up cuts can still detach authored neck or elbow segments during the collapse. Combat routing and colliders are disabled when the actor reaches the grounded state. Detachment while already dying remains physical and can emit blood, but does not trigger a second mortality transition.
- **Folsom encounter queries were split by purpose:** Encounter code now exposes separate living-actor and contactable-actor collections instead of treating death start as immediate removal from every combat query. Stationary and walker controllers participate in the same grounded-contact cleanup model.
- **First-person weapon presentation gained a shared authoritative anchor:** A new `WeaponViewmodelAnchor.js` centralizes the camera-relative root, world-pose-preserving reparenting, presentation diagnostics, layer transitions, and continuity recovery used by knife, sword, and mace presentation. `FirstPersonViewmodelHost.js` and the three weapon controllers were updated around this ownership model. The implementation is designed to keep one visible authoritative weapon root, preserve exact world pose when knife/sword ownership moves between the viewmodel anchor and scene during embed/extraction, and bound post-extraction recovery movement.
- **Knife and sword presentation paths were reworked:** `WorldKnifeCombatController.js` and `SwordWorldWeaponController.js` now use the shared viewmodel anchor and diagnostics rather than independently writing camera-relative transforms. The sword changes also align thrust presentation and ownership transitions with the new continuity model.
- **Dreadmace handling and motion were polished:** `MaceWorldWeaponController.js` now separates loose free aim/extension from the additive load overlay, captures the displayed pose at grip acquisition and at commitment, starts return from the actual completed swing pose, and uses a time-based critically damped return. Combat Lab now passes frame delta into weapon `afterPhysics` presentation updates.
- **Validation coverage expanded:** `validate:combat` now includes the new `tests/combat-showcase-polish.test.mjs`. Added and updated tests cover corrected two-hit sword-thrust mortality across all four Folsom actors, dying-versus-grounded contact eligibility, single-shot detachment consequences during dying, one-root weapon presentation, exact embed/extraction pose preservation, bounded continuity recovery, and Dreadmace free-aim/commitment/return continuity. These are verified test and script additions; this handoff does not claim that the tests or CI were executed successfully for the commit.
- **Existing active systems remain in place:** The Folsom four-actor showcase, explicit sword-sweep dismemberment path, persistent Dreadmace reward, accepted stab/death audio, owner-scoped audio cleanup, and daytime ambience runtime remain part of the current development baseline.

### Important design decisions

- Knife, sword, and mace remain separate combat interaction paths, but their first-person visual ownership now converges on one shared camera-relative anchor and continuity contract.
- Actor death start releases navigation/player blocking immediately, while weapon contact remains available only through the authored collapse window; grounded or disposed actors are no longer combat-contactable.
- Structural detachment remains constrained to the explicit Folsom showcase sword path. A dying actor may receive a valid physical detachment, but mortality activation is single-shot.
- Piercing lethality is evidence-driven: interaction type, weapon family/id, deliberate-stab flag, rupture state, region, depth, and target state at wound creation are all checked before credit is granted.
- Sword-thrust mortality uses weighted credits, allowing a decisive vital thrust to reach the two-credit terminal threshold while shallower qualifying thrusts require a second accepted hit.
- Weapon embed/extraction changes parent ownership while preserving the same visual root and world pose; recovery toward the free held pose is bounded rather than snapping.
- Folsom ambience positions continue to resolve from canonical authored location data, and combat audio remains owner-addressable for lifecycle cleanup.

### Risks and next logical work

- **Verified risk surface:** The new contact-state split touches combat routing, collider lifetime, death animation completion, segment detachment, planted weapon behavior, and actor disposal. Regressions could leave grounded corpses contactable, disable contact too early during collapse, or permit duplicate mortality/detachment consequences.
- **Verified risk surface:** The shared presentation anchor changes transform ownership for all three held weapons. Camera motion, scene/viewmodel reparenting, depth/layer changes, equipment switching, location transitions, and disposal are the highest-risk paths for duplicate roots, pose jumps, stale anchors, or transform writes from more than one owner.
- **Inference:** The new Folsom sword thresholds and weighted terminal credits are presentation/lethality tuning values rather than a demonstrated final balance. Manual playtesting is still needed across regions, depths, actor animations, frame rates, and repeated wound updates.
- **Inference:** The Dreadmace pose and critically damped return changes are intended to improve visual continuity and control feel; automated pose assertions do not establish that the gesture feels correct in live play.
- **Next logical work:** Run `npm run validate:combat` and the Folsom validation suite; manually verify all four showcase actors with shallow and decisive sword thrusts; cut neck/elbow seams during collapse and confirm contact ends exactly on grounding; test planted knife/sword extraction through death; exercise camera movement and weapon switching for knife, sword, and mace; inspect diagnostics for one authoritative root, zero duplicate roots, bounded recovery error, and complete cleanup after location exit or actor disposal.

## Development History

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
