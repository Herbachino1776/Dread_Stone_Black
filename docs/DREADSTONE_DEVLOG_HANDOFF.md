# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: b45183fdf5c2fc131f43ffa859d2705a72f37ddc -->

## Current Handoff Snapshot

### Verified implementation

- **Dreadguard remains the canonical humanoid combat character.** Folsom Field and Combat Lab use the Forge-authored Dreadguard damage asset/profile, with manifest-driven segmentation, progressive damage, gore ownership, and terminal ragdoll handoff.
- **Approved Dreadguard animation playback is now enabled.** `public/assets/enemies/dreadguard/animations/dreadguard_animpack_v003.json` and its validation report define seven approved clips: walk, left/right hurt, three mace head-guard variants, and a knees-first death. `HumanoidModelProfiles.js`, `HumanoidAnimationPackController.js`, `HumanoidGlbVisualAdapter.js`, actor/death/walker integration, and validation/tests were updated to consume that pack.
- **Animation authority now supersedes the prior alive rest-pose-only behavior when an approved clip is active.** The controller resolves approved kinds, clip metadata, looping/play-once behavior, final-pose holding, and return-to-previous-state behavior. The knees-first death is authored to hold its terminal pose before the existing collapse handoff; left/right hurt clips return to the previous state; walk loops.
- **Mace defense has three authored emergency head-guard variants.** Left-arm, right-arm, and two-arm clips carry marker timing, presented-region metadata, interruptibility, in-place root-motion policy, and guard-active times. Export validation passes, but the manifest contains explicit warnings that forearm-to-head visual coverage may be outside the authored coverage limit.
- **Forge portable surface stains are integrated into progressive damage.** The Dreadguard damage GLB/manifest/validation contract was regenerated under the `2026-07-29.portable-surface-stains.1` build. Runtime/profile/segment/visual/Folsom integration now consumes manifest-owned surface-stain data alongside deformation and gore state rather than deriving stain behavior from JavaScript naming conventions.
- **Surface-stain state follows progressive-site lifecycle and ownership.** `ForgeDamageDeformationRuntime.js`, `HumanoidDamageSegmentRuntime.js`, and `HumanoidGlbVisualAdapter.js` were expanded so authored stain bindings can be validated, applied with progressive damage, reset, diagnosed, and transferred with attached/detached ownership.
- **Progressive mace stage semantics remain exact-anchor based.** Sub-Light interpolation does not claim Light or stage gore; qualifying glancing, committed, and heavy blunt impacts can advance authored stages, while non-damaging contacts remain rejected. The left-head proof remains Light → Medium → Heavy, with Heavy terminal.
- **Sword scale and close-range thrust behavior remain active.** The sword uses the shared `0.85` render/collision scale, preserved tip reach, and a blade-heel fallback probe after a true tip sweep misses.
- **Validation evidence is limited to checked-in artifacts and assertions.** The new animation-pack validation JSON reports `PASS`, seven expected/exported clips, no missing/unexpected/duplicate clips, and no preview floor. The damage validation report reports `PASS` with one warning that draft site `Left Head` was omitted from export. Tests and `validate-combat` assertions were expanded, but this record does not claim the project test suite, build, or CI ran successfully.

### Important design decisions

- Forge manifests remain authoritative for progressive sites, stages, morphs, gore nodes, surface stains, and attached/detached ownership.
- Approved animation identity and playback policy come from the animation-pack manifest; runtime code should not infer clip semantics from arbitrary clip names alone.
- Animation authority is conditional: approved active clips may drive the visible rig, while combat proxies, damage state, and terminal physics remain separate systems that must stay synchronized.
- Guard-active timing and presented regions are authored data. A validation `PASS` does not erase explicit visual-coverage warnings.
- Interpolated deformation below the first authored anchor is not a named damage stage and must not expose named-stage gore.
- Sword visual scale, physical dimensions, contact radii, penetration limits, and reach compensation continue to share one contract.

### Risks, inference, and next logical work

- **Verified risk surface:** The animation GLB referenced by `dreadguard_animpack_v003.json` is not listed as added in the processed commit diff, while the JSON and validation files are. Confirm the runtime asset path resolves in a clean checkout and packaged build.
- **Verified risk surface:** All three mace guard exports pass validation but include warnings that the presented forearm may not visually cover the head at `Guard_Active`. Treat guard timing/coverage as needing live visual and combat-contact verification.
- **Verified risk surface:** Enabling animation authority changes transforms consumed by kinematic proxy, damage-segment, blocker, weapon-contact, and ragdoll systems. Verify no visible/physical drift during walk, hurt, guard interruption, death hold, and collapse handoff.
- **Verified risk surface:** Portable surface stains add another manifest-owned presentation layer that must remain synchronized across progressive advancement, reset, detachment, and attached/detached ownership transfer.
- **Inference:** The surface-stain work appears intended to make blood/impact marking portable with Forge-authored damage assets, but the diffs do not establish final art approval or live-play readability.
- **Next logical work:** Run focused animation, Dreadguard damage, walker, Folsom, and combat-foundation tests, then `npm run validate:combat`, `npm run validate:folsom`, and `npm run build`. In live play, verify animation asset loading, walk cadence, hurt-side selection and recovery, each guard’s activation/interrupt behavior and actual head coverage, knees-first death/final-pose/ragdoll transition, proxy alignment, progressive stain appearance and cleanup, detachment ownership transfer, and no regressions to exact Light/Medium/Heavy mace progression or sword impalement.

## Development History

### 2026-07-30 02:04 EDT — Update through `b45183f`

**Scanned range:** after canonical checkpoint `d15407e34a017b299e03134a0840c557f018b647` through observed `main` HEAD `b45183fdf5c2fc131f43ffa859d2705a72f37ddc`. The `6004de4` commit was ignored because its message begins with `docs(devlog):` and its change was the canonical record. Two development commits were included.

**Included commits, chronological:**

- `3f5ae16` — feat(combat): integrate Forge surface stains
- `b45183f` — feat(combat): enable approved Dreadguard animations

**Grouped development steps:**

1. **Forge-authored portable surface stains**
   - Regenerated `public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb`, its manifest, and validation output under Forge authoring version `4.0.0` / build `2026-07-29.portable-surface-stains.1`.
   - Expanded `ForgeDamageDeformationRuntime.js` to validate and manage manifest-owned stain data with progressive deformation, diagnostics, reset, and lifecycle state.
   - Updated `HumanoidDamageSegmentRuntime.js`, `HumanoidGlbVisualAdapter.js`, `HumanoidModelProfiles.js`, and `FolsomCombatEncounter.js` to bind and present stain state with the Dreadguard damage profile.
   - Extended `scripts/validate-combat.mjs`, `tests/combat-foundation.test.mjs`, and `tests/dreadguard-damage-segments.test.mjs` for the new contract.
   - The checked-in damage validation artifact reports `PASS` and carries a warning that draft site `Left Head` was omitted from export; no broader test/build result is asserted.

2. **Approved Dreadguard animation pack**
   - Added `dreadguard_animpack_v003.json` and `dreadguard_animpack_v003_validation.json`, describing seven approved animations: walk, bilateral hurt, three mace head guards, and a knees-first death.
   - Added manifest-backed clip selection and playback policy in `HumanoidAnimationPackController.js`, including loop, play-once, hold-final-pose, return-state, guard markers, and approved-kind handling.
   - Updated `HumanoidGlbVisualAdapter.js`, `HumanoidCombatActor.js`, `AuthoredHumanoidDeathController.js`, `CombatLabWalkerController.js`, `FolsomCombatEncounter.js`, `HumanoidDamageSegmentRuntime.js`, and `HumanoidModelProfiles.js` so approved animation authority can coexist with combat, damage, walker, and death systems.
   - Expanded combat, walker, Folsom, and Dreadguard regression assertions plus combat validation checks.
   - The animation validation artifact reports `PASS`, seven expected/exported clips, no missing/unexpected/duplicate clips, and warnings on all three mace guards that forearm-to-head visual coverage may need adjustment.

3. **Validation evidence**
   - Checked-in Forge validation artifacts report `PASS`, and tests/validation scripts were changed. No successful repository test suite, build, live-play validation, or CI run is asserted by this record.

### 2026-07-29 18:30 EDT — Update through `d15407e`

**Scanned range:** after canonical checkpoint `1b8c21224e7eae35b332dfcd43404f3b3bb14abf` through observed `main` HEAD `d15407e34a017b299e03134a0840c557f018b647`. The `71ce2a1` devlog self-update was ignored. Merge commit `fd0beaa` was also excluded because its recorded diff was limited to restoring `docs/DREADSTONE_DEVLOG_HANDOFF.md`. Two development commits were included.

**Included commits, chronological:**

- `c406b53` — fix(combat): tighten sword scale and close-range impalement
- `d15407e` — fix(combat): floor mace damage at exact light stage

**Grouped development steps:**

1. **Authoritative sword scale and reach preservation**
   - Added `DREADSTONE_SWORD_MODEL_SCALE = 0.85` in the sword combat controller and retained unscaled authored measurements as `DREADSTONE_SWORD_SOURCE_DIMENSIONS`.
   - Derived runtime bounds, blade/guard/grip measurements, contact radii, maximum penetration depth, and fallback geometry scale from the shared constant.
   - Applied the same scale to the loaded GLB visual root and fallback visual root, and exposed the authoritative scale through visual metadata/diagnostics.
   - Offset ready/min/max workspace points by the lost tip length so the smaller sword preserves the prior forward tip reach.

2. **Close-range sword impalement fallback**
   - Replaced tip-only thrust resolution with an entry resolver that first sweeps the tip, then conditionally sweeps a blade-heel probe when the tip finds no collider.
   - Reconstructs the actual tip location at the fallback time of impact before target routing, preserving tip-authored penetration geometry.
   - Added counters and last-probe diagnostics for close-range sweep attempts and successful heel-probe entries.
   - Expanded sword regression coverage for scaled source/runtime dimensions, contact primitives, visual scale, preserved reach, and close-range entry behavior.

3. **Exact-stage progressive mace floor**
   - Added `glancingBlunt` to qualifying progressive-impact classifications while retaining rejection of `nonDamagingContact`.
   - Changed progressive state so interpolated severity below the first exact anchor reports no `stageIndex`, `currentStage`, or stage gore rather than defaulting to Light.
   - Added regression coverage proving a sub-Light blend can carry partial morph weight without consuming Light or showing gore, and that the next qualifying glancing hit resolves exactly to Light before Medium and Heavy.

4. **Validation evidence**
   - Tests were added or changed in the commits. No successful test, build, validation, or CI execution is asserted by this record.

### 2026-07-29 13:59 EDT — Update through `1b8c212`

**Scanned range:** after canonical checkpoint `02545e2` through observed `main` HEAD `1b8c21224e7eae35b332dfcd43404f3b3bb14abf`. The prior `fd921cc` commit (`docs(devlog): update through 02545e2`) was ignored as a devlog-only self-update. Four development commits were included.

**Included commits, chronological:**

- `aada212` — combat testjg
- `148a9a5` — updates
- `7d86daa` — update
- `1b8c212` — fix(combat): close Folsom enemy spacing and facing

**Grouped development steps:**

1. **Testman-to-Dreadguard canonical migration and asset production**
   - Replaced Testman damage/animation assets and profile usage with `public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.{glb,json}` plus validation output.
   - Replaced `tests/testman-damage-segments.test.mjs` with `tests/dreadguard-damage-segments.test.mjs`; updated combat, Folsom, audio, puncture, fish-baseline, and validation references.
   - Added texture-rebuild handoffs, Blender/Python processing scripts, intermediate and packaged GLB/Blend/texture deliveries, contact/verification renders, and Folsom enemy/bandit image outputs under `output/` and `tmp/`.
   - The same commit replaced the canonical devlog with a focused Dreadguard handoff and removed its checkpoint/history; this devlog update restores the required canonical structure while recording the development changes.

2. **Manifest-driven progressive Dreadguard damage**
   - Expanded `ForgeDamageDeformationRuntime.js`, `HumanoidDamageSegmentRuntime.js`, `HumanoidGlbVisualAdapter.js`, `HumanoidCombatActor.js`, and Folsom integration for manifest-owned progressive sites, adjacent crossfades, midpoint gore replacement, exact stage diagnostics, and detachment ownership transfer.
   - Established the left-head Light/Medium/Heavy proof site and development console commands.

3. **Exported-rest-pose authority**
   - Added `restPoseAuthoritative` profile handling and `isHumanoidPoseAuthoritative()` routing.
   - Normalized the Dreadguard to 1.5 m, captured exported bone transforms, updated kinematic proxy and blocker sizing, preserved wound/damage updates, and allowed terminal handoff to ragdoll without requiring an animation mixer.

4. **Progressive lethality and gore presentation correction**
   - Restricted progressive site advancement to committed/heavy blunt impacts.
   - Prevented non-terminal progressive head stages from taking the generic immediate-collapse path, and made the terminal stage the fatal commitment point.
   - Removed the earlier delayed-fatal mace-head state, added a deterministic `solidHeadImpact()` debug command, and prepared gore meshes with render order, polygon offset, disabled frustum culling, and material diagnostics.

5. **Folsom facing and melee-spacing fix**
   - Declared the asset's authored `+Y` forward axis and applied a `Math.PI` profile yaw.
   - Tightened Folsom walker stop/hold/resume distances around the unchanged 0.95 m collision envelope.
   - Added regression assertions for facing, deterministic coordinate-space setup, and close-range stopping behavior.

6. **Validation evidence**
   - Tests and validation scripts were added or changed across the range. No successful test, build, or CI execution is asserted by this record.

### 2026-07-20 22:02 EDT — Update through `02545e2`

**Scanned range:** after checkpoint `76c7ea8` through observed `main` HEAD `02545e2c69c8ff7d4f96e59f13f83668d92c2a6a`. The intervening `0fc30f2` devlog-only commit was ignored.

**Included commits:** `8d5451e` — new mace; `02545e2` — fix gore overlay.

- Regenerated the Testman Forge damage GLB/manifest/validation contract with authored head/body deformation, paired attached/detached morphs, procedural impact stamps, and gore ownership.
- Added `ForgeDamageDeformationRuntime.js` and routed blunt impact, lifecycle, reset, diagnostics, and ownership transfer through actor/segment/visual/Folsom systems.
- Added the then-current 0.12-second fatal head reaction delay; this behavior was superseded by `7d86daa` terminal progressive-stage lethality.
- Made gore subtree visibility authoritative and expanded Testman regression coverage. No test execution was asserted.

### 2026-07-18 14:00 EDT — Update through `76c7ea8`

**Scanned range:** after checkpoint `c0fdbea` through observed HEAD `76c7ea885790c153ef710457174c80a847da7948`; ignored devlog-only `99f3569`.

**Included commits:** `dfa2155`, `27a9916`, `97d21dc` — Fix sword impalement grab stickiness; `76c7ea8` — Fix player trapping against close enemies.

- Iterated sword planted release/reacquisition, same-target collision suppression, body-local anchoring, knife-parity penetration/withdrawal resistance, extraction/cleanup, life-state integration, and diagnostics.
- Added authoritative player/enemy separation in `ActorSeparation.js` and `Collision.js`, including tangential escape, bounded depenetration, stable blocker ordering, walker close-range handling, blocker lifecycle release, and debug data.
- Expanded puncture and actor-separation tests; no test execution was asserted.

### 2026-07-17 01:59 EDT — Update through `c0fdbea`

**Included commit:** `c0fdbea` — Add player-authored mace hammer rotation.

- Added grip-travel-driven raise/cocked/downstroke/recovery phases, authoritative rotational physics, canonical non-identity ready pose, projected handle-capsule acquisition, diagnostics, and focused Dreadmace tests.

### 2026-07-16 17:58 EDT — Update through `37e5de4`

**Included commit:** `37e5de4` — Unify direct mace and sword control.

- Reworked Dreadmace into direct thumb-controlled physical motion with strike qualification, tokens, target limits, resistance, retained grip, and pose-unity diagnostics.
- Unified sword visible/physical transform and extraction continuity.
- Added a 0.01 m visible-to-physical edge gate for authored Folsom dismemberment and expanded combat diagnostics/tests.

### 2026-07-16 14:00 EDT — Update through `8011cac`

**Included commit:** `8011cac` — Polish Folsom weapon lethality and presentation.

- Added region/depth-sensitive piercing lethality and forced authored fatal transitions.
- Preserved weapon contact and single-shot detachment during dying until grounded.
- Added shared `WeaponViewmodelAnchor.js`, embed/extraction reparenting continuity, Dreadmace free-aim/return polish, and regression coverage.

### 2026-07-16 10:03 EDT — Bootstrap through `d834905`

**Scanned range:** latest ten non-devlog commits `7873996` through `d834905`; checkpoint set to observed HEAD.

**Included commits:** `7873996`, `8710f9f`, `720ead0`, `b09001d`, `e2b5896`, `f134156`, `f028758`, `43b4f53`, `6087407`, `d834905`.

- Added and cleaned up Folsom ambience and combat audio assets.
- Implemented the downward-smash Dreadmace vertical slice and blunt-impact routing.
- Integrated accepted stab/death audio with owner-scoped runtime cleanup.
- Added Folsom daytime ambience loops/spatial one-shots and diagnostics.
- Added Folsom showcase walkers, sword-sweep dismemberment, fatal-segment synchronization, persistent courtyard Dreadmace progression, and expanded validation coverage.