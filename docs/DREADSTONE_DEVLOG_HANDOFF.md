# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: e82e3cbb02f61679a7e41531d09691fc3ea51970 -->

## Current Handoff Snapshot

### Verified implementation

- **The production creature chain now includes a gameplay-owned Creature Definition layer and one generic factory.** Milestone 4 adds `dreadstone.creature_definition.v1` in `src/contracts/CreatureDefinition.js`, production definitions for Chezwick, Dreadguard, and Dread Ram God in `CreatureDefinitionRegistry.js`, and `CreatureFactory.js` for definition → pack → support validation → current humanoid profile → `HumanoidCombatActor` construction. Definitions own gameplay identity/presentation/tuning; validated Creature Packs remain technical Forge/export truth. `CreatureRuntimePolicies.js` is now primarily a temporary current-humanoid compatibility/composition bridge rather than an independent production policy registry.
- **The Creature Lab has migrated to definition-driven selection and factory construction.** Lab switching resolves the selected definition and its referenced pack, preserves the established actor/router/blocker/blood/marker cleanup lifecycle, and retains compatibility bridges for old `creaturePack` selection only when the pack maps unambiguously to one definition. Canonical non-lab Folsom still uses the documented legacy direct Chezwick profile path; this range does not migrate a canonical encounter to the factory.
- **Combat reciprocity now has an authoritative player-damage boundary in Creature Lab.** Milestone 5 adds `PlayerCombatDamageReceiver`, `PhysicalAttackSource`, and a deterministic `CreatureLabAttackHarness`. Accepted physical impacts mutate lab-session combat HP, drive the existing HP HUD/damage flash/camera response, gate movement/actions on death, and can be reset without persistence. `PhysicalAttackSource` uses explicit WINDUP/ACTIVE/RECOVERY/COMPLETE phases, previous/current swept capsule contact, stable attack identities, and one accepted hit per target per execution.
- **The M5 physical-hit authority is source-neutral and deliberately separated from AI/animation/equipment policy.** A weapon, claw, horn, jaw, fist, or other physical source can later feed the same downstream contact path. The committed lab driver captures attack commitment at trigger time so subsequent player movement can turn an attack into a miss rather than allowing turret-like tracking.
- **Milestone 6 adds the runtime architecture for Forge-authored animated NPC armament without putting weapon truth into Creature Definitions.** `src/contracts/ForgeRuntimeArmament.js` validates optional Forge attachment-socket and offensive-Action capability. Creature Pack generation/import now carries `dreadstone.attachment_sockets.v1` records and approved `dreadstone.offensive_action.v1` records when present, including real runtime parent bone/socket transform and authored WINDUP/ACTIVE/RECOVERY timing.
- **Game-owned NPC equipment is separated from Forge body/animation truth.** `NpcWeaponRegistry.js` defines `dreadstone.npc_weapon.v1` records for world visual, weapon class, compatible hand roles, local grip, weapon-local attack capsule, damage/type/strength, and reach category; `NpcLoadout.js` selects a main-hand weapon plus compatible combat Action IDs. Weapon IDs and gameplay damage values do not enter Forge output, and specific equipped weapons do not enter Creature Definitions.
- **Animated weapon execution is implemented through the actual rig/socket/action path.** `RuntimeAttachmentSocketResolver.js` resolves the authored runtime bone once, parents a socket frame to it, applies the Forge local transform, and attaches the game-owned weapon without per-frame scene searches or guessed root/chest/hand fallbacks. `NpcArmamentRuntime.js` samples the actual animation Action time, maps it through Forge phase intervals, transforms the weapon-local capsule into previous/current world capsules, and delegates ACTIVE contact to the M5 `PhysicalAttackSource`/`PlayerCombatDamageReceiver` boundary.
- **Creature Lab receives armament controls/diagnostics rather than production AI.** The M6 path is manually driven in the lab with equip/unequip, compatible Action selection, attack triggering, player reset, and attack-geometry diagnostics. `NpcArmamentRuntime` is an execution component, not an AI controller. Commitment is captured once at playback start; the runtime does not rotate the attack toward a moving player during ACTIVE.
- **Dread Ram God now exposes live Forge-authored M6 armament capability.** Its Forge 5.2.2 production export carries two hand sockets and one approved `humanoid_one_hand_overhead` Action in addition to the six Creature Definition-selected locomotion/hurt/death clips. Chezwick and Dreadguard remain valid legacy packs with explicit unavailable socket/action capability; the runtime still does not invent production offsets or attack timing.
- **Focused regression suites and validation commands were added, but execution success is not asserted by this record.** Milestone 4 adds `tests/creature-definition-factory.test.mjs`; M5 adds `tests/combat-reciprocity-foundation.test.mjs` and `validate:combat-reciprocity`; M6 adds `tests/offensive-armament-runtime.test.mjs`, `tests/fixtures/m6_runtime_capability.json`, and `validate:m6-armament`, and folds the new suites into `validate:combat`/Creature Pack checks. The diffs demonstrate committed coverage and generated descriptor updates, not successful test, build, CI, deployed-iPhone, or live-play execution.
- **The project’s macro production direction was explicitly re-grounded in documentation.** `docs/ACTUAL_GAME_TRAJECTORY.md`, `AGENTS.md`, and `docs/CODEX_GROUNDING.md` now treat the old strategy guide as a design reservoir rather than an implementation checklist. The documented live route reaches behind the denied White-Scab threshold via the under-shrine labyrinth; near-term world work should favor one narrow black-covering → Lantern reveal → physical manipulation → exposed pale structure → readable route-response proof rather than a broad speculative framework.

### Important design decisions

- Forge owns technical body/export truth: asset identity/fingerprints, skeleton facts, native progressive damage/deformation/gore/stain/segment records, approved embedded animations, and—when exported—runtime attachment sockets and offensive Action timing/capability.
- Creature Definitions own gameplay archetype decisions: stable identity, pack reference, presentation/movement, selected animation capability, current supported segment subset, progressive cadence/mortality, voice, durability/lethality, and references to temporary compatibility profiles. Definitions must not duplicate raw Forge paths, fingerprints, site records, morph/gore/stain bindings, segment definitions, bone maps, or runtime-skeleton metadata.
- NPC weapons/loadouts remain game-owned and independent from body definitions. Forge says where/how an animated body can carry/execute an attack; the game says what weapon is equipped and how dangerous it is.
- The downstream physical-hit boundary remains geometry/phase authoritative. Animation time alone must never damage the player directly; the animated physical source must intersect the player hurt volume during ACTIVE and supply a stable execution identity.
- No guessed production armament metadata is allowed. Missing sockets/actions are explicit unavailable capability, not permission to infer offsets from a hand position, derive attack timing from clip names, or attach equipment to root/chest fallbacks.
- Creature Lab remains a proving ground, not canonical progression. Combat HP/death are session-only there, and canonical Folsom remains unchanged unless a future production encounter deliberately migrates the Creature Definition/Factory/armament path.
- Creature-platform expansion is now demand-driven. The trajectory docs explicitly caution against automatically building physiology, universal persistence, simulation tiers, non-humanoid abstractions, or a broad AI framework without a real production encounter requiring them.
- Raw Forge `siteId` strings must not become gameplay semantics. If semantic wound consequences are required later, introduce a generic semantic layer rather than branching gameplay behavior on authoring IDs.
- World-production direction remains mobile-first and physical: black growth/scab is covering/binding/sealing material; Knife/Axe/Drain Bar interactions are physical tool/contact systems; the Keeper’s Lantern is a bounded reveal instrument; world-state changes are preferred over checklist/map/token clutter; white architecture should feel ancient, pale, sacred, embedded, and impossible rather than generic sci-fi.

### Risks, inference, and next logical work

- **Verified production proof:** Dread Ram God now advertises two Forge hand sockets and one approved overhead offensive Action. Chezwick and Dreadguard continue to exercise the explicit-unavailable legacy path.
- **Verified limit:** `PlayerCombatDamageReceiver` currently uses one vertical player hurt capsule and lab-session-only HP/death. There is no player body-part physiology, blocking, armor, stamina, hostile-hit audio contract, canonical death persistence, or canonical encounter respawn policy in these commits.
- **Verified limit:** M6 adds animated armed execution, not AI. Creature Lab manually chooses/triggers compatible Actions. Encounter behavior, target selection, attack choice, pursuit, spacing, cooldown policy, and production enemy decision-making remain unimplemented here.
- **Verified risk surface:** socket/action validation and generated descriptor normalization add new optional Creature Pack branches. Clean deterministic regeneration should verify that packs without M6 metadata remain byte-stable except for the intended explicit-unavailable fields/clip-duration additions and that new Forge-enabled fixtures reject mismatched armature/bone/action/weapon-class data rather than degrading silently.
- **Verified risk surface:** animated weapon geometry now depends on presentation scale, rig/socket transforms, clip timing, and previous/current capsule reconstruction all agreeing. Mobile device play must confirm visual weapon alignment, phase timing, committed misses, one-hit identity behavior, cleanup on definition switch/respawn/disposal, and acceptable per-frame cost.
- **Verified validation state:** focused test files and npm validation entry points are committed. **Not verified:** this reviewed range contains no evidence that `npm run validate:creature-packs`, `npm run validate:combat-reciprocity`, `npm run validate:m6-armament`, `npm run validate:combat`, `npm run validate:folsom`, `npm run build`, CI, or deployed-iPhone acceptance completed successfully.
- **Documentation-level direction, not runtime proof:** the new trajectory/agent documents state that the current canonical route reaches the Chapter 3 boundary behind the denied White-Scab threshold and that creature architecture should now support demand-driven world production. These commits establish planning authority; they do not themselves implement the next White-Scab/pale-system sequence or a canonical enemy encounter.
- **Inference:** Milestones 4–6 collectively establish enough body identity, factory construction, reciprocal damage, and armament execution infrastructure to support a first bounded production creature encounter without another broad creature-platform pass. That is an architectural inference from the committed boundaries, not evidence that a production encounter is already complete.
- **Next logical work:** complete any needed device-scale armament checks against the real Ram God capability. Then, when the authored Chapter 3 space calls for danger, move one validated Creature Definition through `CreatureFactory` into one bounded canonical encounter and add only the minimal behavior needed for that encounter, while continuing the documented narrow White-Scab/Lantern/physical-tool world-production proof.

## Development History

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
