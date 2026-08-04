# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: bf12345828997d5d1326a2203329ee35862112c0 -->

## Current Handoff Snapshot

### Verified implementation

- **Folsom Field now uses Chezwick as its active humanoid damage profile, while Combat Lab retains the Dreadguard profile.** `CHEZWICK_DAMAGE_COMBAT_PROFILE` points to `public/assets/enemies/chezwick/damage/chezwick_v001.glb` and its Forge manifest/validation files. Folsom encounter, showcase extras, diagnostics, and tests were rerouted from the Dreadguard profile to Chezwick.
- **Chezwick carries an embedded animation pack and manifest-driven damage contract.** The profile inherits the established humanoid combat baseline, enables authored idle/walk/hurt/right-arm mace guard/death runtime kinds, uses a `Math.PI` root yaw, and normalizes the measured raw height `1.5001617883459184` to the 1.5 m target.
- **The checked-in Chezwick Forge asset contract reports `PASS`.** The new GLB, JSON manifest, and validation report include progressive deformation, gore overlays, surface-stain data, segmentation, and source-readiness metadata. The validation artifact includes a warning that draft site `Damage Site Face Left` was omitted from export.
- **Folsom encounter lifecycle and population changed with the Chezwick integration.** The primary walker alias is synchronized from the walker controller, grounded actors are configured to respawn after 15 seconds, and showcase additional walkers increased from two to three. Combat blood/director hooks and Folsom diagnostics were updated alongside the profile migration.
- **Humanoid actor implementation was split into a reusable base plus a focused subclass.** The prior large `HumanoidCombatActor.js` implementation moved to `HumanoidCombatActorBase.js`; `HumanoidCombatActor` now extends the base and adds Chezwick terminal progressive-damage handling. This is a structural refactor intended to isolate profile-specific fatal-site behavior without duplicating the general actor system.
- **Chezwick terminal Heavy progressive damage is fatal.** The profile sets `terminalProgressiveDamageFatal: true`. The subclass override now treats an explicitly terminal progressive site as authoritative even when the selected Forge facial site is hosted on `body_core` and the physics collider reports a torso region, avoiding a region-label mismatch that previously prevented the fatal transition.
- **Existing Dreadguard systems remain active outside the Folsom profile swap.** Approved Dreadguard animation playback, Forge portable surface stains, exact-anchor mace progression, sword `0.85` presentation/collision scale, close-range heel-probe thrust fallback, detachment ownership, and ragdoll handoff remain part of the shared combat foundation.
- **Validation evidence is limited to committed artifacts and assertions.** `tests/chezwick-integration.test.mjs` was added and included in `validate:combat`; Folsom, walker, combat-foundation, Dreadguard, and validation assertions were updated. This record does not claim that the full test suite, build, CI, or live-play validation completed successfully.

### Important design decisions

- Forge manifests remain authoritative for progressive sites, stages, morphs, gore nodes, surface stains, segmentation, and attached/detached ownership.
- Folsom's active character identity is now profile-driven Chezwick; shared humanoid mechanics remain in the base actor rather than being forked into encounter-specific code.
- An explicitly fatal terminal progressive site is authoritative over coarse physics-region labels when Forge site hosting and collider anatomy differ.
- Embedded animation metadata may be consumed directly from the Chezwick asset contract; Dreadguard continues to use its separate approved animation-pack manifest.
- Actor lifecycle aliases and respawn ownership should flow through walker controllers rather than parallel encounter-owned actor state.
- Interpolated deformation below the first authored anchor is still not a named damage stage and must not expose named-stage gore.

### Risks, inference, and next logical work

- **Verified risk surface:** Chezwick's new asset and manifest are large, newly integrated files. Confirm the GLB loads in a clean checkout and packaged build, embedded animation clips resolve, and source/manifest node names match runtime bindings.
- **Verified risk surface:** The validation report passes but explicitly omits draft site `Damage Site Face Left`; verify the exported progressive site actually used for facial/head trauma is the intended production site.
- **Verified risk surface:** The terminal-fatal override deliberately crosses a `body_core`/torso collider mismatch. Verify it only triggers for an accepted terminal progressive site and cannot make unrelated torso Heavy damage fatal.
- **Verified risk surface:** Splitting `HumanoidCombatActor` into base/subclass changes import and inheritance boundaries across combat code. Check constructor behavior, diagnostics, wound/physiology ownership, detachment, animation authority, and ragdoll transitions for regressions.
- **Verified risk surface:** Folsom now owns more simultaneous walkers and 15-second grounded respawns. Verify blocker cleanup, actor-router ownership, blood/audio cleanup, deterministic aliases, and performance over repeated deaths/respawns.
- **Inference:** Chezwick appears intended to become Folsom's production enemy while Dreadguard remains a Combat Lab/reference profile, but the diffs do not establish a broader project-wide character replacement.
- **Next logical work:** Run `npm run validate:combat`, focused Chezwick/Folsom/walker/combat-foundation tests, and the production build. In live play, verify Chezwick idle height and ground contact, facing, embedded walk/hurt/guard/death playback, mace Light/Medium/Heavy progression, terminal Heavy fatality on the authored facial site despite torso-hosted geometry, nonfatal behavior on unrelated sites, gore/stain visibility and cleanup, three-walker spacing, death-to-respawn lifecycle, and absence of visible/physical proxy drift.

## Development History

### 2026-08-03 22:01 EDT — Update through `bf12345`

**Scanned range:** after canonical checkpoint `b45183fdf5c2fc131f43ffa859d2705a72f37ddc` through observed `main` HEAD `bf12345828997d5d1326a2203329ee35862112c0`. Commit `83d69ac` was ignored because its message begins with `docs(devlog):` and it only updated the canonical record. Four development commits were included.

**Included commits, chronological:**

- `c9a8636` — Update
- `fba9f56` — fix(combat): correct Chezwick animated idle height
- `9de0992` — fix(combat): make Chezwick heavy head damage fatal
- `bf12345` — fix(combat): enforce fatal Chezwick heavy site

**Grouped development steps:**

1. **Chezwick Forge asset and Folsom profile migration**
   - Added `public/assets/enemies/chezwick/damage/chezwick_v001.glb`, `chezwick_v001.json`, and `chezwick_v001_validation.json`.
   - Added `CHEZWICK_DAMAGE_COMBAT_PROFILE` in `src/game/combat/HumanoidModelProfiles.js`, inheriting the shared Dreadguard combat baseline while supplying Chezwick asset paths, embedded-animation behavior, progressive-site compatibility, durability/piercing settings, and mace-impact blood presentation.
   - Replaced Folsom's Dreadguard profile references with Chezwick in `FolsomCombatEncounter.js` and `FolsomShowcaseCombatExtras.js`; Combat Lab remains on Dreadguard.
   - Increased Folsom showcase extras to three additional walkers, added a 15-second grounded respawn setting, synchronized primary walker aliases, and updated encounter diagnostics and ownership paths.
   - Updated `CombatBloodEffects.js`, `CombatDirector.js`, `CombatLabWalkerController.js`, `ForgeDamageDeformationRuntime.js`, `HumanoidAnimationPackController.js`, `HumanoidDamageSegmentRuntime.js`, and `HumanoidGlbVisualAdapter.js` for the new profile/asset behavior.

2. **Humanoid actor base-class extraction**
   - Moved the general actor implementation from `HumanoidCombatActor.js` into new `HumanoidCombatActorBase.js`.
   - Reduced `HumanoidCombatActor.js` to a subclass layer so profile-specific behavior can be added while shared physics, wounds, physiology, animation, detachment, and ragdoll systems remain centralized.

3. **Chezwick height and terminal lethality fixes**
   - Corrected Chezwick `rawHeight` from `1.500000114288579` to `1.5001617883459184`, preserving the 1.5 m target normalization.
   - Enabled `terminalProgressiveDamageFatal` on the Chezwick profile.
   - Added a subclass post-processing path that forces the fatal head-hit transition for an accepted terminal progressive site even when Forge hosts the selected facial site on `body_core` and the collider reports a torso region. Guards prevent duplicate triggering after an existing fatal transition or once the actor is already dying/dead.

4. **Regression and validation coverage**
   - Added `tests/chezwick-integration.test.mjs` and included it in the `validate:combat` command.
   - Updated Folsom showcase/walker, combat-foundation, Dreadguard damage, and `scripts/validate-combat.mjs` assertions for Chezwick routing, respawn configuration, actor refactor, and damage behavior.
   - The checked-in Chezwick validation artifact reports `PASS` with a warning that draft site `Damage Site Face Left` was omitted. No successful full test run, build, CI run, or live-play verification is asserted.

### 2026-07-30 02:04 EDT — Update through `b45183f`

**Scanned range:** after canonical checkpoint `d15407e34a017b299e03134a0840c557f018b647` through observed `main` HEAD `b45183fdf5c2fc131f43ffa859d2705a72f37ddc`. The `6004de4` devlog commit was ignored. Two development commits were included.

**Included commits:** `3f5ae16` — feat(combat): integrate Forge surface stains; `b45183f` — feat(combat): enable approved Dreadguard animations.

- Regenerated the Dreadguard damage GLB/manifest/validation contract with portable surface stains and integrated manifest-owned stain lifecycle, reset, diagnostics, and attached/detached transfer through deformation, segment, visual, profile, and Folsom systems.
- Added the approved seven-clip Dreadguard animation pack, manifest-backed playback policy, walk/hurt/guard/death integration, final-pose holding, and expanded combat/walker/Folsom validation assertions.
- Checked-in validation artifacts report `PASS`, with explicit guard-coverage and omitted-draft-site warnings. No full test/build/CI result was asserted.

### 2026-07-29 18:30 EDT — Update through `d15407e`

**Included commits:** `c406b53` — fix(combat): tighten sword scale and close-range impalement; `d15407e` — fix(combat): floor mace damage at exact light stage.

- Unified sword source/runtime dimensions around scale `0.85`, preserved tip reach, and added blade-heel fallback probing for close-range thrust entry.
- Corrected progressive mace semantics so sub-Light interpolation has no named stage/gore and qualifying glancing hits resolve exact Light before Medium and Heavy.
- Added regression coverage; no successful test/build/CI execution was asserted.

### 2026-07-29 13:59 EDT — Update through `1b8c212`

**Included commits:** `aada212` — combat testjg; `148a9a5` — updates; `7d86daa` — update; `1b8c212` — fix(combat): close Folsom enemy spacing and facing.

- Migrated Testman assets/profile/tests to Dreadguard and added Forge texture-rebuild and packaging artifacts.
- Added manifest-driven progressive damage, exact stage diagnostics, gore ownership transfer, exported-rest-pose authority, terminal-stage mace lethality, gore rendering corrections, authored facing, and tighter Folsom spacing.
- Restored the canonical marker/history after a development commit replaced the handoff file. No successful test/build/CI execution was asserted.

### 2026-07-20 22:02 EDT — Update through `02545e2`

**Included commits:** `8d5451e` — new mace; `02545e2` — fix gore overlay.

- Regenerated the Testman Forge damage contract with head/body deformation, attached/detached morphs, procedural impact stamps, and gore ownership.
- Added `ForgeDamageDeformationRuntime.js`, routed blunt damage and ownership transfer, and made gore subtree visibility authoritative. The earlier delayed fatal-head behavior was later superseded.

### 2026-07-18 14:00 EDT — Update through `76c7ea8`

**Included commits:** `dfa2155`, `27a9916`, `97d21dc` — Fix sword impalement grab stickiness; `76c7ea8` — Fix player trapping against close enemies.

- Iterated sword planted release/reacquisition, same-target collision suppression, body-local anchoring, extraction, life-state integration, and diagnostics.
- Added authoritative player/enemy separation with tangential escape, bounded depenetration, stable blockers, lifecycle release, and regression tests.

### 2026-07-17 01:59 EDT — Update through `c0fdbea`

**Included commit:** `c0fdbea` — Add player-authored mace hammer rotation.

- Added grip-travel-driven raise/cocked/downstroke/recovery phases, authoritative rotational physics, canonical ready pose, projected handle-capsule acquisition, diagnostics, and focused tests.

### 2026-07-16 17:58 EDT — Update through `37e5de4`

**Included commit:** `37e5de4` — Unify direct mace and sword control.

- Reworked Dreadmace into direct thumb-controlled physical motion with strike qualification, tokens, target limits, resistance, retained grip, and pose-unity diagnostics.
- Unified sword visible/physical transform and extraction continuity, and added a 0.01 m visible-to-physical edge gate for authored Folsom dismemberment.

### 2026-07-16 14:00 EDT — Update through `8011cac`

**Included commit:** `8011cac` — Polish Folsom weapon lethality and presentation.

- Added region/depth-sensitive piercing lethality, forced authored fatal transitions, dying-state weapon contact, single-shot detachment, shared viewmodel anchoring, embed/extraction continuity, and Dreadmace motion polish.

### 2026-07-16 10:03 EDT — Bootstrap through `d834905`

**Scanned range:** latest ten non-devlog commits `7873996` through `d834905`; checkpoint set to observed HEAD.

**Included commits:** `7873996`, `8710f9f`, `720ead0`, `b09001d`, `e2b5896`, `f134156`, `f028758`, `43b4f53`, `6087407`, `d834905`.

- Added and cleaned up Folsom ambience and combat audio assets.
- Implemented the downward-smash Dreadmace vertical slice and blunt-impact routing.
- Integrated accepted stab/death audio with owner-scoped runtime cleanup.
- Added Folsom daytime ambience loops/spatial one-shots and diagnostics.
- Added Folsom showcase walkers, sword-sweep dismemberment, fatal-segment synchronization, persistent courtyard Dreadmace progression, and expanded validation coverage.
