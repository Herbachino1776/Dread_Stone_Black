# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: 1517e318eea27c065357e59627c14058db428a0e -->

## Current Handoff Snapshot

### Verified implementation

- **The production creature chain is definition-driven and keeps Forge technical truth separate from game policy.** `dreadstone.creature_definition.v1`, `CreatureDefinitionRegistry.js`, and `CreatureFactory.js` define gameplay identity/presentation/tuning while generated Creature Packs retain authored asset, skeleton, damage, animation, socket, and offensive-Action facts. Creature Lab uses the definition → pack → factory path; canonical Folsom still retains its documented legacy direct Chezwick profile path.
- **Reciprocal physical combat has an explicit player-damage boundary.** `PlayerCombatDamageReceiver` owns lab-session HP/death and `PhysicalAttackSource` owns phased swept-capsule contact, stable execution identities, and one accepted hit per target per execution. The downstream hit boundary is geometry/phase authoritative rather than animation-time authoritative.
- **Animated NPC armament now uses real game-owned GLB weapons rather than a procedural proof proxy.** `NpcWeaponRegistry.js` records canonical GLB asset path, one uniform asset scale, weapon class/socket compatibility, grip transform, weapon-local attack capsule, damage/type/strength, and reach. Production definitions exist for the Dreadstone mace, Dreadstone sword, and old work knife. `WorldWeaponGlbLoader.js` caches parsed source GLBs and creates fresh independently disposable Object3D instances; failed loads are evicted so retries remain possible.
- **The rig/socket/weapon transform chain is explicit and shared by visuals and attack geometry.** `RuntimeAttachmentSocketResolver.js` composes animated hand bone → Forge socket transform → game weapon grip → uniform asset scale → cloned weapon GLB. Grip translation is insulated from asset scale, creature presentation scale is cancelled for equipment measurements in game meters, and attack capsule endpoints/radius pass through the same weapon scale/transform path.
- **`NpcArmamentRuntime.js` now supports asynchronous real-asset equip and calibration overrides while preserving authored attack timing.** It resolves the loadout against Forge offensive capability, loads the real GLB, attaches it through the authored socket, samples actual animation Action time against Forge WINDUP/ACTIVE/RECOVERY intervals, reconstructs previous/current world capsules, and delegates ACTIVE intersections to `PhysicalAttackSource`/`PlayerCombatDamageReceiver`. Equip in-flight state and serials guard asynchronous lifecycle races.
- **Creature Lab is now a production-geometry calibration surface for weapons.** It exposes the three production GLB weapons; equip/unequip; uniform asset scale; grip position and rotation; attack-capsule endpoints/radius; Action selection/trigger; player reset; and attack-capsule diagnostics. Calibration may persist only under `dreadstone.creature_lab.weapon_calibration.v1.*`; copying emits the production definition fields `assetScale`, `gripTransform`, and `attackCapsule` without mutating the registry.
- **Creature Lab can also temporarily override creature target height without altering production definitions.** The override rebuilds the composed runtime profile through the existing presentation-scale path, restores equipped armament on the rebuilt subject, and remains nonpersistent. Dread Ram God's production height remains 1.7 m.
- **Creature Pack intake now has a committed one-click/transactional workflow.** Root `IMPORT_CREATURE.cmd`, `scripts/Import-CreaturePack.ps1`, `scripts/creature-pack-workflow.mjs`, and workflow/catalog libraries inspect an incoming Forge Damage folder, derive or confirm display name/enemy slug/pack ID, stage only recognized Damage and optional animation artifacts, run the existing importer, and only replace production files after staged validation succeeds.
- **Production Creature Pack sources are cataloged independently of gameplay definitions.** `config/production-creature-packs.json` uses `dreadstone.production_creature_pack_sources.v1` and records only stable technical intake identity (`packId`, display name, enemy slug, source directory). Routine re-export updates retain the registered pack ID/slug; Creature Definition, loadout, AI, and encounter placement remain separate steps.
- **The import workflow includes explicit rollback boundaries.** Production damage files, generated descriptor output, and the source catalog are backed up around the authoritative import plus `npm run validate:creature-packs`; importer or validation failure restores the prior known-good state. An existing animation sidecar is retained when the incoming Damage bundle does not replace it. Optional full validation additionally invokes combat validation and build.
- **Dread Ram God now supplies a real production M6 capability export.** The accepted Forge bundle declares two runtime hand sockets (`MAIN_HAND_L`/`MAIN_HAND_R`) and one approved `humanoid_one_hand_overhead` offensive Action on `DSB_DAMAGE_RIG`, compatible with one-hand blade and blunt classes. Its authored timing is windup 0–1.5 s, active 1.5–1.625 s, recovery 1.625–1.958333 s, with orientation locked through ACTIVE and in-place root motion. The generated pack therefore supports real authored armament testing; Chezwick and Dreadguard remain explicit-unavailable legacy cases rather than using guessed fallbacks.
- **The checked-in Ram God Forge validation report is a clean PASS artifact.** `Dread_Ram_God_validation.json` reports `PASS`, no errors, and no warnings for the accepted export. This is artifact evidence only; the reviewed commits do not prove that repository test suites, `npm run build`, CI, deployed-iPhone checks, or live-play acceptance were executed successfully.
- **Regression/validation coverage was expanded in source.** The real-weapon work adds `tests/m66-real-weapon-pipeline.test.mjs` and `validate:m66-weapons`, folds it into M6/combat validation, and expands armament/reciprocity tests. The intake workflow adds `tests/creature-pack-workflow.test.mjs` and includes it in `validate:creature-packs`. These committed tests document intended invariants; successful execution is not inferred from their presence.
- **The macro production direction remains the documented narrow live-game trajectory.** The current guidance still prioritizes mobile-first physical world interaction and a bounded White-Scab/Lantern/physical-tool proof rather than broad speculative creature, physiology, AI, or simulation frameworks.

### Important design decisions

- Forge owns technical body/export truth: asset identity/fingerprints, skeleton facts, progressive damage/deformation/gore/stains/segments, approved embedded animations, runtime attachment sockets, and offensive Action timing/capability.
- Creature Definitions own gameplay archetype identity/presentation/tuning and references to validated technical packs; they must not duplicate Forge body/export facts.
- Weapon identities, GLB paths, grip/capsule calibration, damage values, and NPC loadouts remain game-owned. The same weapon identity is intentionally world-item neutral and may later be referenced by pickups, containers, drops, merchants, or player ownership without creating an NPC-only asset definition.
- Forge Action metadata remains authoritative for socket role, compatible weapon classes, commitment, and phase timing. Loadouts cannot force an incompatible clip, and missing sockets/actions remain explicit unavailable capability rather than permission to infer offsets or timing.
- The attack capsule must transform through the same grip/asset-scale/socket chain as the visible weapon. Visual alignment and collision geometry must not diverge through separate scale conventions.
- Creature Lab calibration is tooling state, not production truth. Its localStorage namespace and temporary height override must not mutate production weapon records, Creature Definitions, or canonical Folsom state.
- Creature Pack intake is intentionally transactional and narrow: recognized Forge artifacts enter through staging/import/validation/rollback, while Creature Definition, loadout, behavior, and encounter placement remain separate production decisions.
- `config/production-creature-packs.json` is a technical source inventory, not a gameplay registry. Routine Forge re-exports update a stable technical pack identity rather than creating arbitrary version churn.
- The physical-hit boundary remains source-neutral and geometry/phase authoritative. Animation time alone never damages the player; ACTIVE weapon geometry must intersect the player hurt volume and carry a stable execution identity.
- Creature Lab remains a proving ground, not canonical progression. Combat HP/death, calibration overrides, and temporary subject height remain lab-only until a production encounter explicitly adopts the systems.

### Risks, inference, and next logical work

- **Verified production proof:** Ram God now has a clean checked-in Forge armament export with two hand sockets and one approved overhead Action, while the game has real GLB weapon loading, authored-socket attachment, calibrated visual/collision transforms, and an ACTIVE-phase physical damage path.
- **Verified limit:** the reviewed commits still do not add production enemy AI. Target selection, pursuit, spacing, attack choice, cooldown policy, encounter behavior, and canonical respawn/persistence remain outside the M6 execution component.
- **Verified limit:** `PlayerCombatDamageReceiver` still uses one vertical player hurt capsule and lab-session HP/death. There is no player body-part physiology, blocking, armor, stamina, hostile-hit audio contract, or canonical death persistence in this range.
- **Verified risk surface:** real armament correctness depends on GLB asset scale, grip calibration, Forge socket transform, creature presentation scale cancellation, animation phase timing, and previous/current capsule reconstruction agreeing. Mobile/device checks should confirm visible alignment, reach, phase timing, committed misses, one-hit identity behavior, disposal/re-equip races, definition/subject switching, and acceptable per-frame cost.
- **Verified risk surface:** the new one-click import path performs filesystem replacement plus rollback and now owns the production source catalog. It should be exercised against update, new-creature, missing-sidecar, validation-failure, rollback, `--what-if`, and deterministic `--all --check` paths before treating the workflow as operationally proven.
- **Verified validation state:** a checked-in Ram God Forge validation artifact reports PASS with no warnings/errors. **Not verified by these diffs:** successful execution of `npm run validate:creature-packs`, `npm run validate:m66-weapons`, `npm run validate:m6-armament`, `npm run validate:combat`, `npm run build`, CI, or deployed-device acceptance.
- **Inference:** the combination of a real Forge-enabled production body, real production weapon GLBs, calibrated world-space attack geometry, transactional Creature Pack intake, and the existing Creature Definition/factory boundary removes the previous architecture blocker for a bounded real armed-creature proof. This is an inference from implemented components, not evidence that a canonical encounter is already complete.
- **Next logical work:** run the real Ram God + production weapon path through focused validation and device-scale Creature Lab checks, finalize any weapon grip/scale/capsule calibration from observed geometry, then migrate one validated Creature Definition through `CreatureFactory` into one deliberately bounded canonical encounter with only the minimal behavior needed for that encounter. In parallel, keep the next world-production work aligned with the documented narrow White-Scab/Lantern/physical-tool sequence.

## Development History

### 2026-08-10 14:00 EDT — Update through `1517e31`

**Scanned range:** after canonical checkpoint `e82e3cbb02f61679a7e41531d09691fc3ea51970` through observed `main` HEAD `1517e318eea27c065357e59627c14058db428a0e`. Commit `d1acc52` was ignored because its message begins with `docs(devlog):` and only updates the canonical handoff. Three development commits were included.

**Included commits, chronological:**

- `027c3f0` — Add real GLB weapon calibration pipeline
- `cdf28e0` — Add one-click Creature Pack import workflow
- `1517e31` — Accept Ram God M6 production export

**Grouped development steps:**

1. **Real GLB weapon loading, attachment, and calibration (`027c3f0`)**
   - Added `src/game/combat/WorldWeaponGlbLoader.js` and changed `NpcWeaponRegistry.js` from a procedural/NPC-only visual concept to canonical game-owned GLB paths plus uniform asset scale, grip transform, weapon-local attack capsule, damage/type/strength, reach, and socket/class compatibility. Production entries cover the Dreadstone mace, Dreadstone sword, and old work knife.
   - Reworked `RuntimeAttachmentSocketResolver.js` around the explicit animated hand → Forge socket → game grip → uniform scale → cloned GLB transform stack. Creature presentation scale is cancelled for equipment measurements, grip translation is not scaled by asset scale, and the attack capsule uses the same scaled transform chain as the visible weapon.
   - Extended `NpcArmamentRuntime.js` for asynchronous real-GLB equip, in-flight/serial lifecycle protection, validated calibration overrides, and scaled capsule reconstruction while preserving Forge Action phase/commitment authority and the existing `PhysicalAttackSource` downstream hit boundary.
   - Expanded Creature Lab controller/panel and `CreatureLabCalibration.js` with non-destructive weapon scale/grip/capsule calibration, namespaced localStorage persistence, copyable production fields, diagnostics, and a temporary nonpersistent creature-height override that rebuilds through the existing presentation-scale path and restores equipped armament.
   - Added `tests/m66-real-weapon-pipeline.test.mjs`, expanded armament/reciprocity coverage, and added `validate:m66-weapons` while folding the suite into M6/combat validation. The commit does not prove successful command, build, CI, or device execution.

2. **Transactional one-click Creature Pack intake (`cdf28e0`)**
   - Added root `IMPORT_CREATURE.cmd`, `scripts/Import-CreaturePack.ps1`, `scripts/creature-pack-workflow.mjs`, `scripts/lib/creature-pack-workflow.mjs`, `scripts/lib/creature-pack-catalog.mjs`, and `scripts/lib/production-creature-pack-import.mjs` to provide Windows drag/drop or prompted Forge Damage-folder intake plus terminal/what-if/full-validation variants.
   - Added `config/production-creature-packs.json` as the persistent technical source inventory for Chezwick, Dread Ram God, and Dreadguard. It records stable pack/display/slug/source identities and deliberately owns no Creature Definition, loadout, AI, encounter, or other gameplay policy.
   - The workflow inspects recognized Damage/optional animation artifacts, stages them inside the repository, runs the existing authoritative importer, and only replaces production state after staged success. Production Damage files, generated descriptor, and catalog are backed up around import plus `npm run validate:creature-packs`; failures restore the prior state, and missing incoming animation sidecars preserve existing sidecars.
   - Updated `docs/architecture/CREATURE_PACK_PIPELINE.md`, package validation wiring, importer/catalog plumbing, and added `tests/creature-pack-workflow.test.mjs`. Routine validation remains Creature Pack-scoped; optional full validation additionally requests combat validation and build. No successful execution is inferred.

3. **Accepted Dread Ram God M6 Forge production export (`1517e31`)**
   - Replaced the Ram God Damage GLB/manifest/validation artifacts and regenerated `public/generated/creature-packs/dread_ram_god_damage_v001.json`/registry output with authored armament capability.
   - Added two `dreadstone.attachment_sockets.v1` records on `DSB_DAMAGE_RIG`: left-hand `MAIN_HAND_L` and right-hand `MAIN_HAND_R`. Added one approved offensive Action, `DSB_Attack_Overhead_OneHand_v001` / `humanoid_one_hand_overhead`, for `EQUIPPED_MAIN_HAND` on `MAIN_HAND_R`, compatible with `ONE_HAND_BLADE` and `ONE_HAND_BLUNT`.
   - The authored Action is in-place and commits/locks orientation through ACTIVE: windup 0–1.5 s, active 1.5–1.625 s, recovery 1.625–1.958333 s. The six existing locomotion/hurt/death clips remain available; the offensive Action is armament capability rather than part of the Creature Definition's ordinary selected animation set.
   - The checked-in `Dread_Ram_God_validation.json` reports `PASS`, empty errors, and empty warnings. This verifies the committed Forge artifact only; repository validation/build/CI/device success is not asserted.

### 2026-08-10 02:13 EDT — Update through `e82e3cb`

**Scanned range:** after canonical checkpoint `6bcaf3289747d30bdd783fd175469a24787ae66f` through observed `main` HEAD `e82e3cbb02f61679a7e41531d09691fc3ea51970`. Commit `e80b2eb` was ignored because its message begins with `docs(devlog):` and it only updated the canonical record. Six development commits were included.

**Included commits, chronological:**

- `11c6fc4` — feat(creatures): add definition registry and factory
- `fa4e433` — docs: add actual game trajectory
- `4b8c854` — docs: align agent guidance with live trajectory
- `d7b8c08` — docs: ground Codex in actual game trajectory
- `ec3991a` — Add combat reciprocity foundation
- `e82e3cb` — Add animated NPC armament runtime

**Grouped development steps:**

1. **Creature Definition contract, registry, and generic factory (`11c6fc4`)**
   - Added `docs/architecture/CREATURE_DEFINITION_FACTORY.md`, `src/contracts/CreatureDefinition.js`, `src/game/creatures/CreatureDefinitionRegistry.js`, and `src/game/creatures/CreatureFactory.js`; added production definitions for Chezwick, Dreadguard, and Dread Ram God with gameplay identity/presentation/tuning separated from generated Creature Pack technical truth.
   - Reworked `CreatureRuntimePolicies.js` into the current-humanoid compatibility/composition bridge, retaining bone/proxy and omitted-site compatibility data by stable profile reference while deriving former policy-facing exports from definitions instead of owning an independent policy registry.
   - Migrated Creature Lab selection/switching to definition → pack → factory construction while preserving the existing cleanup lifecycle and temporary unambiguous pack-selection compatibility. Canonical non-lab Folsom remains on its legacy direct profile path.
   - Added `tests/creature-definition-factory.test.mjs`, updated Creature Lab/pack/Dread Ram God tests, and included factory coverage in `validate:creature-packs`/`validate:combat`. No successful command execution is inferred.

2. **Macro trajectory and agent-grounding documentation (`fa4e433`, `4b8c854`, `d7b8c08`)**
   - Added `docs/ACTUAL_GAME_TRAJECTORY.md` and updated `AGENTS.md` plus `docs/CODEX_GROUNDING.md` to make the live game/current production locks authoritative over literal old-guide room lists, map assumptions, Severing language, and obsolete progression dependencies.
   - Documented the implemented route through rewritten Folsom Chapters 1–2, Beneath Folsom, the denied White-Scab threshold, remote release/backtrack, under-shrine labyrinth bypass, and the current boundary behind that threshold.
   - Locked the near-term design language around physical black covering/binding, Knife/Axe/Drain Bar contact, Keeper’s Lantern reveal information, persistent world-state changes, ancient pale architecture, mobile ergonomics, small playable proofs, and demand-driven creature architecture. These are documented production decisions, not new runtime implementation in these three commits.

3. **Reciprocal physical combat foundation (`ec3991a`)**
   - Added `src/game/combat/PlayerCombatDamageReceiver.js` as the explicit lab-session combat HP/death authority and `src/game/combat/PhysicalAttackSource.js` as a source-neutral phased swept-capsule contact system with stable execution identities and one accepted hit per target per attack.
   - Added `src/game/creatures/CreatureLabAttackHarness.js` as temporary deterministic committed-swing infrastructure, wired receiver/death/reset behavior through `Game.js`, `FolsomCombatEncounter.js`, Creature Lab controls, and subject-switch cleanup, and kept the entire path restricted to `?creatureLab=1`.
   - Added `docs/architecture/COMBAT_RECIPROCITY_FOUNDATION.md`, `tests/combat-reciprocity-foundation.test.mjs`, and `validate:combat-reciprocity`; folded the suite into `validate:combat`. No test/build/device success is inferred from the committed suite.

4. **Forge armament capability and game-owned animated weapon execution (`e82e3cb`)**
   - Added `docs/architecture/NPC_ARMAMENT_ARCHITECTURE.md` and `src/contracts/ForgeRuntimeArmament.js`; extended `src/contracts/CreaturePack.js` and `scripts/lib/creature-pack-importer.mjs` to carry/validate optional runtime attachment sockets and approved offensive Actions plus animation durations.
   - Added `RuntimeAttachmentSocketResolver.js`, `NpcWeaponRegistry.js`, `NpcLoadout.js`, and `NpcArmamentRuntime.js`. The runtime attaches a game-owned weapon through a real authored rig socket, samples actual animation Action time against Forge WINDUP/ACTIVE/RECOVERY intervals, transforms the weapon-local capsule into previous/current world geometry, and delegates ACTIVE collision to the M5 physical attack/receiver authority.
   - Extended `HumanoidAnimationPackController.js`, `HumanoidGlbVisualAdapter.js`, Creature Lab controller/panel, and generated pack descriptors/registry for the new capability and diagnostics. Existing Chezwick, Dreadguard, and Dread Ram God packs explicitly report armament capability unavailable because their current Forge exports do not contain sockets/offensive Actions; no guessed fallback is introduced.
   - Added `tests/fixtures/m6_runtime_capability.json`, `tests/offensive-armament-runtime.test.mjs`, and `validate:m6-armament`, and included the armament suite in `validate:combat`. The reviewed commit does not prove those commands, CI, build, or live device testing passed.

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