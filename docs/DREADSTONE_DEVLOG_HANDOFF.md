# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: 0a3c9464a69a30530b436d1b299ac2c31f1223fe -->

## Current Handoff Snapshot

### Verified implementation

- **Creature Pack Milestones 1–3 are now implemented as an isolated migration path without replacing canonical Folsom's legacy profile path.** `dreadstone.creature_pack.v1` descriptors are generated from validated Forge output, resolved in-browser, combined with game-authored runtime policy, and exercised through the opt-in Creature Lab.
- **Milestone 1 established a deterministic repository ingest contract and registry.** `src/contracts/CreaturePack.js`, `scripts/import-creature-pack.mjs`, and `scripts/lib/creature-pack-importer.mjs` validate Forge manifests/reports/GLBs, require PASS reports and identity consistency, reuse damage/deformation validators, measure bounds/costs, and emit `public/generated/creature-packs/{chezwick_damage_v001,dreadguard_damage_v001,index}.json`. Generated pack truth deliberately excludes gameplay identity, AI, persistence, mortality policy, collision tuning, and other game-authored decisions.
- **Creature Pack compatibility is explicit rather than silently normalized.** Dreadguard's omitted draft progressive site is not advertised as native pack truth; Chezwick advertises its native right facial site while the left facial site remains game-owned compatibility data. Unapproved legacy animation clips are excluded from advertised capabilities, and the Chezwick GLB filename case mismatch is diagnosed rather than rewritten.
- **Milestone 2 added a browser-safe registry and policy/profile composition bridge.** `CreaturePackRegistry.js` validates and caches generated registry/descriptors using deploy-safe URLs. `CreatureRuntimePolicies.js` owns presentation/gameplay decisions and rejects duplication of pack-owned technical fields. The composed result remains compatible with `HumanoidCombatActor`/`HumanoidGlbVisualAdapter`, allowing gradual migration while `HumanoidModelProfiles.js` remains for legacy consumers.
- **An isolated mobile Creature Lab now runs through Folsom only when `?creatureLab=1` is explicitly present.** `CreatureLabController.js` and `CreatureLabPanel.js` replace the normal multi-Chezwick development wave with one controlled subject, support pack switching, damage reset, animation actions, progressive-site controls, real blunt-impact probes, detachment/death/respawn operations, diagnostics, and cleanup. The lab uses a read-only save-storage view and an ephemeral Dreadstone Mace loadout so lab operations do not persist equipment/progression writes.
- **Milestone 3 replaces axis/region-only progressive-site authority with animation-following 3D targeting.** `ProgressiveDamageSiteTargeting.js` builds actor-owned normalized site records from native and compatibility sites, resolves authored capture centers/radii, converts Forge Blender Z-up coordinates to runtime Y-up, projects sites to intended skinned deformation surfaces when possible, reconstructs current-pose centers/directions, and falls back to diagnosed static actor-local points when binding cannot be maintained.
- **Progressive-site selection is deterministic and radius-bounded.** Selection first filters by broad semantic physics region, then requires world-space distance within the scaled authored radius plus an explicit 0.008 m tolerance. Normalized distance dominates scoring; preferred direction contributes only a bounded adjustment, with stable tie breaking. If no progressive site qualifies, the existing non-progressive Forge region/key fallback remains available.
- **Creature Lab now visualizes and probes the same production targeting records.** `CreatureLabSiteMarkerRenderer.js` renders non-physical instanced site markers and an optional selected-radius sphere. Center/Edge/Outside probe controls route through `HumanoidCombatActor.applyBluntImpact` without forcing a `siteId`, so the production selector—not the panel—decides the site.
- **Testing/validation coverage expanded but successful execution is not asserted here.** `validate:creature-packs` and `validate:combat` now include creature-pack, Creature Lab, progressive-targeting, and asset-targeting tests; validation scripts were adjusted for the actor base/subclass and lab paths. No commit evidence reviewed in this range proves that the full suite, production build, CI, deployed-iPhone acceptance procedure, or live combat playtest completed successfully.
- **A separate Folsom weathered-oak material candidate set was added.** The first milestone commit added SDXL/image-generation candidates, a material metadata record, and tiling comparison output under `output/imagegen/texture_library/folsom_weathered_oak_01/`. The metadata marks it as a candidate needing seam processing, not a production-ready repeating material.

### Important design decisions

- Forge remains authoritative for exported damage/deformation structure, source fingerprints, progressive-site/stage truth, gore/stain records, segments, and approved animation metadata; generated Creature Packs add repository integration facts only.
- Runtime/game policy must remain separate from generated technical body truth. Scale targets, root presentation, proxy fit, mortality/lethality tuning, active supported segment subset, voice, compatibility sites, and animation selection stay game-authored.
- Native progressive sites always take precedence; compatibility sites may fill only a missing side and must remain visibly labeled as compatibility authority.
- Progressive-site targeting must use authored 3D centers/radii and current-pose reconstruction, not arbitrary mesh proximity, left/right X heuristics, or oversized inferred hit bubbles.
- Surface binding is prepared once; combat hot paths reconstruct only bounded candidate records and do not traverse the scene or perform topology searches.
- Creature Lab is an explicit development proving ground. It must not mutate canonical progression/save state or silently become the production Folsom spawn path.
- Existing legacy humanoid profile/runtime code is being bridged rather than replaced in one step; Creature Definitions, semantic damage consequences, persistence, simulation tiers, and non-humanoid support remain future work.

### Risks, inference, and next logical work

- **Verified risk surface:** The new pack importer is a large validation boundary spanning Forge reports, GLB parsing, animation approval, deformation validation, deterministic measurements, filename case handling, and generated descriptors. Run the committed `validate:creature-packs` path in a clean checkout and verify deterministic no-diff regeneration.
- **Verified risk surface:** Creature Lab pack switching touches actor disposal, combat routing, blockers, blood/director ownership, weapon targeting, visual initialization, and marker cleanup. Repeated switch/respawn/death cycles should be checked for stale actors, collision bodies, routes, bindings, markers, or retained event/input ownership.
- **Verified risk surface:** 3D progressive targeting depends on authored capture centers/radii and skinned-surface reconstruction. Verify marker/strike alignment through idle, walk, hurt, and guard poses on both Chezwick and Dreadguard; static fallback intentionally cannot follow local limb articulation.
- **Verified limit:** Post-authored-death/ragdoll progressive-site targeting is not certified, and progressive bindings are not transferred to separately detached segment meshes. Grounded actors removed from combat routing are not targetable.
- **Verified risk surface:** The 0.008 m tolerance and preferred-direction scoring are new contact-selection parameters. Confirm physical mace hits near overlapping/edge sites select deterministically without expanding damage reach beyond authored intent.
- **Verified risk surface:** The lab is now allowed in local or built/deployed games when the exact hidden query is present. Confirm `?creatureLab=0` and normal URLs produce no lab UI, marker renderer, loadout override, save-write behavior, or spawn override.
- **Inference:** The architecture is moving toward generated technical creature bodies plus small hand-authored Creature Definitions/policies, but the reviewed diffs do not establish a production Creature Definition Registry yet.
- **Next logical work:** Execute `npm run validate:creature-packs`, `npm run validate:combat`, production build checks, and the documented deployed mobile acceptance procedure. Then implement Milestone 4 as a small Creature Definition Registry/factory referencing validated packs plus game-authored identity/policy, without duplicating Forge truth or prematurely adding AI, persistence, faction, dialogue, inventory, or unrelated systems.

## Development History

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
