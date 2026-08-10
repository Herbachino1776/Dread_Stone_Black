# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: 6bcaf3289747d30bdd783fd175469a24787ae66f -->

## Current Handoff Snapshot

### Verified implementation

- **Creature Pack Milestones 1–3.5 are implemented as an isolated migration path without replacing canonical Folsom's legacy profile path.** `dreadstone.creature_pack.v1` descriptors are generated from validated Forge output, resolved in-browser, combined with game-authored runtime policy, and exercised through the opt-in Creature Lab. Milestone 3.5 adds Dread Ram God as the third production fixture alongside Chezwick and Dreadguard.
- **Dread Ram God is integrated through the existing generic Creature Pack/runtime-policy path, not character-specific combat architecture.** The commit adds `public/assets/enemies/dread_ram_god/damage/Dread_Ram_God.{glb,json}`, `Dread_Ram_God_validation.json`, generated descriptor `public/generated/creature-packs/dread_ram_god_damage_v001.json`, registry membership, and `DREAD_RAM_GOD_CREATURE_RUNTIME_POLICY` in `src/game/creatures/CreatureRuntimePolicies.js`.
- **The generated Dread Ram God descriptor records a complete Forge-authored technical body.** It uses skeleton family `DSB_HUMANOID_V1`, bone-map profile `dreadstone.humanoid.current_bone_map.v1`, runtime armature `DSB_DAMAGE_RIG`, one skeleton/skin, and 21 required bones. Capabilities include progressive damage, deformations, gore, portable surface stains, detachable segments, and embedded animations.
- **Dread Ram God exposes four native progressive damage sites with no game-owned compatibility site.** The generated descriptor lists `damage_site`, `damage_site_left_body`, `damage_site_left_body_2`, and `damage_site_left_face`. The runtime policy leaves `progressiveDamageSiteFallbacks` empty, so native Forge site truth is exercised directly.
- **Progressive damage is intentionally non-terminal for the Dread Ram God lab policy.** `progressiveDamageHitsPerStage` is `1` and `terminalProgressiveDamageFatal` is `false`, allowing multiple sites to coexist at different Light/Medium/Heavy states without killing the actor solely because one site reaches Heavy. Head/neck detachment remains part of the existing detachable-segment fatal path rather than this progressive-stage policy.
- **Three detachable segments are currently runtime-enabled while Lower Spine remains available but unsupported.** The pack advertises `head_neck`, `left_elbow`, `lower_spine`, and `right_elbow`; the current humanoid policy activates only `head_neck`, `left_elbow`, and `right_elbow`, preserving the existing migration boundary.
- **The asset contains exactly six selected approved embedded runtime clips.** They are Idle, Walk, Hurt Left, Hurt Right, and two Death clips; the generated descriptor reports zero unapproved clips. The runtime policy requires embedded approval metadata and selects those six names explicitly.
- **Creature Pack validation now understands the optional Forge runtime-skeleton contract.** `src/contracts/CreaturePack.js` and `scripts/lib/creature-pack-importer.mjs` were extended to carry and cross-check runtime armature/skeleton/skin/bone-count facts against the PASS report and parsed GLB where present. The generated Dread Ram God descriptor carries that validated runtime-skeleton block.
- **Creature Lab coverage now treats Dread Ram God as a multi-site production torture test.** The architecture documentation and runtime tests cover four anatomical markers, animation-following skin binding, Center/Edge/Outside targeting, independent per-site stage accumulation, physical mace routing, detachments, authored death/respawn, and Dread Ram God → Chezwick → Dreadguard → Dread Ram God cleanup cycles.
- **Focused regression coverage was added, but successful command execution is not asserted by this record.** `tests/dread-ram-god-integration.test.mjs` validates the checked-in Forge report/GLB/descriptor agreement, one runtime skeleton, four native sites, skin-bound site reconstruction through every approved pose, deterministic center/edge/outside selection, and exact embedded animation inventory. `tests/creature-pack-pipeline.test.mjs` and `tests/creature-lab-runtime.test.mjs` were expanded, and both `validate:creature-packs` and `validate:combat` now include the Dread Ram God integration test. The checked-in Forge validation report says `PASS` with no errors or warnings; that is artifact evidence, not proof that repository test suites, build, CI, deployed-iPhone checks, or live combat validation were run for this commit.
- **The earlier Creature Pack architecture remains intact.** Forge remains technical truth; `CreatureRuntimePolicies.js` owns game-authored runtime decisions; generated descriptors remain deterministic repository integration output; the lab remains opt-in/read-only with an ephemeral mace loadout; animation-following 3D progressive targeting remains the production selection path used by lab probes and physical strikes.
- **The separate Folsom weathered-oak material candidates from the prior milestone remain unfinished candidate assets.** Nothing in this commit promotes them to production material status.

### Important design decisions

- Forge remains authoritative for exported damage/deformation structure, fingerprints, native progressive sites/stages, gore/stains, segments, runtime-skeleton facts when exported, and approved embedded animation metadata. Generated Creature Packs add repository integration facts only.
- Runtime/game policy stays separate from generated technical body truth. Target scale, root presentation, collision fit, mortality/lethality tuning, active supported segment subset, voice, animation selection, stage cadence, and compatibility sites remain game-authored.
- Dread Ram God is evidence that the generic pack/policy/actor path can host a creature with four simultaneous native sites; it should not introduce bespoke Dread Ram God combat branches unless a later requirement proves a generic abstraction insufficient.
- Native progressive sites always take precedence. Dread Ram God deliberately supplies no compatibility progressive-site policy because all four required sites are native Forge exports.
- Progressive-site targeting remains authored-radius and current-pose 3D reconstruction, not mesh-nearest guessing, broad left/right heuristics, or oversized inferred hit volumes.
- Current runtime support still certifies only `head_neck`, `left_elbow`, and `right_elbow` detachable segments. `lower_spine` being present in Forge/generated metadata is not equivalent to runtime certification.
- Creature Lab remains a development proving ground. Normal Folsom must remain unchanged unless the exact hidden lab query is active, and lab operations must not write canonical save/progression state.
- Legacy humanoid profile/runtime code is still bridged rather than removed. Creature Definition Registry/factory work remains the next architecture milestone; semantic damage consequences, persistence, simulation tiers, and non-humanoid support remain later work.

### Risks, inference, and next logical work

- **Verified risk surface:** Dread Ram God is materially heavier than the earlier fixture descriptors: the generated pack reports a roughly 43.9 MB GLB, 135,755 vertices, 88,127 triangles, 71 skinned meshes, 24 morph targets, 15 generated gore meshes, 12 stain meshes, and 54 images/textures. Mobile memory, load latency, animation/deformation cost, and repeated pack-switch cleanup need deployed-device validation; the diff itself does not prove acceptable performance.
- **Verified risk surface:** Four nearby native sites create more opportunity for overlap/tie behavior than the prior fixtures. The committed tests cover current-pose center/edge/outside selection and same-side rejection, but physical mace strikes across real animation, camera, and collision conditions still require play validation.
- **Verified risk surface:** The importer now has an optional runtime-skeleton validation branch. Run deterministic `--all --check` regeneration in a clean checkout and confirm older Chezwick/Dreadguard packs remain byte-stable and valid when no Dread Ram God-specific assumptions apply.
- **Verified limit:** `lower_spine` is still exported but not in `ACTIVE_DAMAGE_SEGMENT_CONTRACTS`; do not treat its presence in the pack as supported detachment behavior.
- **Verified limit:** Post-authored-death/ragdoll progressive-site targeting and transfer of progressive bindings onto separately detached meshes remain uncertified from the previous milestone.
- **Verified validation artifact:** `Dread_Ram_God_validation.json` records `PASS`, empty `errors`, and empty `warnings`, and the focused integration test is committed. **Not verified:** there is no reviewed evidence in this commit that `npm run validate:creature-packs`, `npm run validate:combat`, a production build, CI, the documented iPhone acceptance procedure, or live combat playtesting actually completed successfully.
- **Inference:** Milestone 3.5 is intended to prove that the current generic humanoid Creature Pack path scales to a richer multi-site creature before introducing Creature Definitions. That inference is supported by the architecture/documentation changes, but it is not evidence of production performance or broad creature-family generality.
- **Next logical work:** Run the committed validation commands and the documented deployed-iPhone Dread Ram God acceptance sequence, with special attention to four-site marker/strike alignment, independent deformation/gore/stain state, physical mace routing, three-pack cleanup, detachment behavior, and mobile resource cost. If that passes, proceed to the documented next milestone: a small Creature Definition Registry/factory that references validated packs plus game-authored identity/policy without duplicating Forge technical truth or pulling in AI, persistence, factions, dialogue, inventories, or unrelated systems.

## Development History

### 2026-08-09 21:59 EDT — Update through `6bcaf32`

**Scanned range:** after canonical checkpoint `0a3c9464a69a30530b436d1b299ac2c31f1223fe` through observed `main` HEAD `6bcaf3289747d30bdd783fd175469a24787ae66f`. Commit `241d027` was ignored because its message begins with `docs(devlog):` and it only updated the canonical record. One development commit was included.

**Included commits, chronological:**

- `6bcaf32` — feat(combat): integrate Dread Ram God creature pack

**Grouped development steps:**

1. **Dread Ram God Forge bundle and generated Creature Pack**
   - Added `public/assets/enemies/dread_ram_god/damage/Dread_Ram_God.glb`, `Dread_Ram_God.json`, and `Dread_Ram_God_validation.json`, plus generated descriptor `public/generated/creature-packs/dread_ram_god_damage_v001.json` and registry membership in `public/generated/creature-packs/index.json`.
   - The generated descriptor records the current humanoid skeleton family/bone-map profile, optional Forge runtime-skeleton contract (`DSB_DAMAGE_RIG`, one skeleton, one skin, 21 required bones), four native progressive sites, four exported detachable segments, three active runtime segments, portable stains/gore/deformations, and six approved embedded animations with zero unapproved clips.
   - The checked-in Forge validation artifact reports `PASS` with empty errors/warnings. This is checked-in artifact evidence only; no repository command execution result is inferred from it.

2. **Generic runtime policy and multi-site behavior**
   - Added `DREAD_RAM_GOD_CREATURE_RUNTIME_POLICY` in `src/game/creatures/CreatureRuntimePolicies.js` using the shared humanoid policy/factory path, six explicitly selected approved clips, no compatibility progressive sites, one accepted hit per progressive stage, and non-fatal terminal progressive stages.
   - Preserved the current supported detachable subset (`head_neck`, `left_elbow`, `right_elbow`) while leaving exported `lower_spine` available in pack metadata but inactive at runtime.
   - Updated `docs/architecture/CREATURE_PACK_PIPELINE.md` to designate this integration Milestone 3.5 and document the intended four-native-site, multi-site coexistence, physical mace routing, detachment, death/respawn, and three-pack cleanup acceptance flow. Canonical Folsom remains outside the lab migration path.

3. **Importer/contract validation expansion**
   - Extended `src/contracts/CreaturePack.js` and `scripts/lib/creature-pack-importer.mjs` to represent and validate optional Forge runtime-skeleton facts and cross-check them against the PASS report/GLB when present.
   - Updated `scripts/import-creature-pack.mjs` and generated-registry expectations so `--all` covers the three production fixtures: Dreadguard, Chezwick, and Dread Ram God.

4. **Regression and validation coverage**
   - Added `tests/dread-ram-god-integration.test.mjs`. It asserts report/manifest/descriptor agreement, one runtime skeleton, four native progressive sites, exact approved animation inventory, skinned-surface binding through all six selected animations, and deterministic Center/Edge/Outside targeting for every site.
   - Expanded `tests/creature-pack-pipeline.test.mjs` and `tests/creature-lab-runtime.test.mjs` for the third production fixture and multi-site lab lifecycle.
   - Added the Dread Ram God integration test to both `validate:creature-packs` and `validate:combat` in `package.json`. No successful full suite, build, CI, deployed-device, or live-play execution is asserted by this record.

### 2026-08-09 09:59 EDT — Update through `0a3c946`

**Scanned range:** after canonical checkpoint `bf12345828997d5d1326a2203329ee35862112c0` through observed `main` HEAD `0a3c9464a69a30530b436d1b299ac2c31f1223fe`. Commit `fe13608` was ignored because its message begins with `docs(devlog):`. Three development commits were included.

**Included commits, chronological:**

- `0f5b2fd` — update
- `810c4f3` — Implement runtime creature lab milestone 2
- `0a3c946` — Implement 3D progressive damage site targeting

**Grouped development steps:**

1. **Creature Pack receiving contract, importer, and generated registry (`0f5b2fd`)**
   - Added `src/contracts/CreaturePack.js`, `scripts/import-creature-pack.mjs`, `scripts/lib/creature-pack-importer.mjs`, `tests/creature-pack-pipeline.test.mjs`, and generated descriptors/index under `public/generated/creature-packs/`.
   - Added `docs/architecture/CREATURE_PACK_PIPELINE.md` documenting Forge authority, repository integration facts, compatibility exceptions, segment support, fingerprints, deterministic import/check commands, and the future Creature Pack / Creature Definition / Creature Instance boundary.
   - The importer requires matching Forge damage validation reports, validates PASS/error state and manifest/report identity, parses GLBs, reuses runtime damage/deformation validators, checks animation approval, measures bounds/costs, and rejects inconsistent output instead of rewriting Forge assets.
   - Added the `folsom_weathered_oak_01` material candidate package under `output/imagegen/texture_library/`, including two generated candidates, metadata, and a tiling comparison. The metadata records that seam processing is still needed.

2. **Runtime Creature Lab and policy composition bridge (`810c4f3`)**
   - Added `CreaturePackRegistry.js` for browser-safe generated-pack resolution and validation, plus `CreatureRuntimePolicies.js` to hold game-authored presentation/combat decisions and compose them with validated pack truth into the existing humanoid runtime profile shape.
   - Added `CreatureLabController.js` and `CreatureLabPanel.js`; integrated lab mode through `FolsomCombatEncounter.js`, input ownership, walker reset paths, Forge damage runtime accessors, segment/runtime adapters, and validation scripts.
   - The lab supports generated-pack switching, direct progressive stage controls, real blunt-impact probes, animation/death/detachment/respawn operations, diagnostics, and clean actor/router/blocker/blood/director disposal without changing canonical Folsom when the lab flag is absent.
   - Added `tests/creature-lab-runtime.test.mjs` and included it in `validate:combat`. No successful execution result is asserted by this record.

3. **Animation-following 3D Progressive Damage Site targeting (`0a3c946`)**
   - Added `ProgressiveDamageSiteTargeting.js`, integrated it into `ForgeDamageDeformationRuntime.js`, and extended `SkinnedSurfaceBinding.js`, `HumanoidGlbVisualAdapter.js`, and `HumanoidDamageSegmentRuntime.js` to expose actor-specific target reconstruction data.
   - Site records retain native/compatibility authority, authored capture center/radius/direction, semantic region/group, surface/static/untargetable binding mode, current reconstructed center/direction, and bounded targeting diagnostics without mutating Forge manifests or generated descriptors.
   - Selection now uses semantic-region filtering plus authored 3D radius eligibility, normalized distance, bounded direction preference, and deterministic tie breaks. Existing non-progressive Forge fallback remains when no progressive site qualifies.
   - Added `CreatureLabSiteMarkerRenderer.js` and expanded Creature Lab controls to show production site centers/radii and issue Center/Edge/Outside blunt probes without specifying a requested site ID.
   - Updated `Game.js` so exact `?creatureLab=1` can run in local or built/deployed environments through read-only save storage and an ephemeral mace loadout; ordinary Folsom URLs remain unaffected.
   - Added `tests/progressive-damage-site-targeting.test.mjs` and `tests/progressive-damage-site-assets.test.mjs`, expanded Creature Lab/Chezwick tests, and added them to `validate:combat`. The documented mobile acceptance procedure is planned validation, not evidence that it was completed.

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
