# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: 2afcbfad3e59f46dafcd6b44f72d135366528dbb -->

## Current Handoff Snapshot

### Verified implementation

- **The production creature chain reaches a placed-individual layer:** Forge/Creature Pack technical body truth → Creature Definition gameplay/body archetype → Enemy Preset reusable tuning → `dreadstone.encounter_definition.v1` Encounter Spawn Record. `src/contracts/EncounterDefinition.js` validates stable `spawnId`, `presetId`, exact `locationId`, world position/yaw, positive `homeRadius`, and an optional fixed positive gold override; unexpected runtime/editor fields are rejected and serialization is deterministic.
- **M9 supplies production encounter spawning and lifecycle composition.** `EncounterRegistry`, `EncounterSpawner`, `EncounterRuntime`, `EncounterRuntimeHost`, `EncounterEnemyRuntime`, and `EnemyWorldMotionHost` resolve presets before mutation and compose each spawn through the existing Creature Factory, combat routing/director, `NpcArmamentRuntime`, `MinimalCombatBrain`, `EnemyLootRuntime`, and world-motion/collision systems. Construction is transactional: failed initialization disposes previously-created runtime enemies rather than returning a half-live encounter.
- **Stable world identity is separated from runtime identity.** Authored `spawnId` persists across encounter reload/reset; `actor.instanceId` is recreated. Spawn placement owns start position, yaw, home radius, and optional fixed-gold override. Enemy Presets remain reusable tuning and Forge data remains technical body/action authority.
- **Normal game sessions own the reciprocal player damage receiver needed by production encounters.** `Game` constructs one `PlayerCombatDamageReceiver` around the existing sole `PlayerCombatState`, rebinds it on scene transitions, and lets Creature Lab borrow that same receiver instead of creating a second HP authority. Combat HP/death still has no persistence or finalized normal-game respawn policy.
- **Encounter enemies use bounded world motion without pathfinding.** `EnemyWorldMotionHost` grounds authored motion against the dungeon collision world, supports simple blocked-move rejection/axis sliding, player separation, facing, return-home, and collision-blocker ownership. Commit `e7e55b1` fixes self-blocking locomotion by allowing standability probes to ignore actor blockers during the world-support check while separately preserving other-actor blocking, world walls, unsupported-space rejection, and owned-blocker cleanup.
- **The checked-in Folsom encounter catalog contains two canonical definitions.** `folsomtst.json` and `folsomfight.json` each place one `dread_ram_god_great_mace` spawn with stable authored identity. No commit in the newly processed range changes encounter selection/activation semantics.
- **M9.5 provides a development-only, touch-first Encounter Authoring workflow over the exact production contract.** `EncounterAuthoringController`, draft store/operations/placement resolver, preview runtime, preset preview, and panel edit canonical Encounter Definitions rather than an editor-only schema. Authoring is location-scoped, preserves stable spawn IDs through ordinary edits, supports placement/move/yaw/duplicate/preset/home-radius/fixed-gold editing, visual-only real creature/weapon previews, local draft autosave, canonical JSON view/copy/export, and exact-draft testing through `EncounterRuntimeHost.spawnDefinition()`.
- **Authoring can install canonical encounter JSON through a constrained development bridge.** `scripts/encounter-authoring-bridge.mjs`, `scripts/encounter-installer-lib.mjs`, `scripts/install-encounter.mjs`, root `IMPORT_ENCOUNTER.cmd`, and Vite development middleware accept only validated canonical encounter JSON, derive the destination from `encounterId`, restrict writes to `src/game/encounters/data/`, validate the resulting catalog, and roll back failed installs. Production/preview hosting does not expose the save endpoint.
- **Creature Pack intake now covers six production technical sources.** Commit `d761008` adds Rusted Knight (`rusted_warrior_001_damage_v001`), Forest Knight (`rusted_warrior_001_forest_knight_damage_v001`), and White Knight (`rusted_warrior_001_white_knight_damage_v001`) beside Chezwick, Dread Ram God, and Dreadguard in `config/production-creature-packs.json`; each new pack has checked-in Forge GLB/manifest/validation artifacts and a generated Creature Pack descriptor/index entry.
- **The three Rusted Warrior variants share a Forge-backed humanoid capability baseline.** Their generated descriptors report one `DSB_DAMAGE_RIG` runtime skeleton with 21 required bones, two hand attachment sockets, approved overhead and thrust offensive Actions, four available detachable segments with `head_neck`/`left_elbow`/`right_elbow` active, deformation regions `body_core`/both forearms/head, two progressive sites, and seven approved embedded clips with zero unapproved clips. The reviewed base descriptor reports raw height `1.586024683 m`; starter definitions use that pack-backed height rather than inventing gameplay scale.
- **Checked-in Forge validation evidence exists for the new Rusted Warrior bundles.** The inspected validation reports declare `PASS` with empty `errors` and `warnings`. This is artifact evidence only; it does not establish that repository validation, build, CI, or live-device execution succeeded during these commits.
- **Creature Pack import now auto-registers compatible humanoids for Creature Lab.** Commit `2afcbfa` adds `scripts/lib/creature-lab-definition.mjs` and `scripts/register-creature-lab-definitions.mjs`; a successful new-pack transaction creates one conservative `dreadstone.creature_definition.v1` JSON under `src/game/creatures/data/` when no built-in/file definition already owns the pack. Existing definitions are preserved on re-import, and rollback removes a definition only when that transaction created it.
- **Auto-generated starter Creature Definitions deliberately stop at lab/body defaults.** They derive target height, approved animation kinds/names, supported runtime segment IDs, current humanoid collision profile, neutral durability/mortality, and conservative presentation/movement defaults from validated pack facts. They do not create loadouts, Enemy Presets, loot, AI, or encounter placement; `colliderFitNotes` explicitly require review before encounter production.
- **Creature Definition discovery is now data-driven for these starters.** `CreatureDefinitionRegistry.js` includes file-backed definitions under `src/game/creatures/data/`, and the three Rusted/Forest/White Knight JSON definitions are checked in. `validate:creature-packs` now also runs `register-creature-lab-definitions.mjs --all --check`, so registered production packs are expected to have either an existing built-in definition or a file-backed Creature Lab definition.
- **Focused validation source was expanded around intake/registration.** `tests/creature-pack-pipeline.test.mjs` and `tests/creature-pack-workflow.test.mjs` were updated for the additional pack inventory, starter-definition creation/preservation, and transactional rollback behavior. Source/test presence does not prove successful command execution.

### Important design decisions

- Forge owns technical body/export truth: asset/skeleton facts, progressive damage/deformation/gore/stains/segments, approved embedded animations, attachment sockets, and offensive Action timing/capability.
- Creature Definitions own base gameplay/body archetypes; Enemy Presets own reusable production tuning; Encounter Spawn Records own exact placed identity, transform, home radius, and the narrow per-instance fixed-gold override. Runtime HP/death/loot state does not belong in authored encounter JSON.
- **Automatic Creature Lab registration is not automatic gameplay promotion.** The import transaction may create a conservative starter Creature Definition, but loadout, Enemy Preset, loot, AI, encounter placement, and production tuning remain separate explicit work.
- **Existing Creature Definitions are authoritative over generated starters.** Re-import does not overwrite an existing built-in or file-backed definition; rollback only deletes the definition created by the failed transaction.
- `spawnId` is the stable authored world identity and must not be replaced by array position, display name, runtime UUID, or `actor.instanceId`.
- Canonical weapon identity, GLB path, damage/class, base scale/grip/capsule, and reach remain game-owned; Enemy Presets may override only permitted calibration fields. Forge Action metadata remains authoritative for compatible socket role, commitment, phase timing, and orientation lock.
- `PlayerCombatState` remains the sole player combat HP/life authority. `PlayerCombatDamageReceiver` remains an impact adapter/deduplication boundary; production encounters use that same authority rather than a lab-specific health model.
- Reward ownership stays separated: Encounter fixed-gold override takes precedence over the Enemy Preset default Loot Profile, `EnemyLootRuntime` owns one runtime enemy's resolved unclaimed reward, and `PlayerCurrencyState` owns actual gold. No encounter save-state authority has been added.
- Encounter construction/reset/disposal is lifecycle-owned and transactional. Encounter runtime orchestration does not introduce a second armament update path, alternate distance-damage path, or editor-only combat implementation.
- Encounter Authoring edits the exact shipping encounter contract. Local drafts are not production authority; project save/export must pass the same validation/serialization boundaries used by runtime loading.
- Authoring filesystem access is deliberately narrow: no browser-selected path, generic write endpoint, browser commit, or browser push exists.

### Risks, inference, and next logical work

- **Verified production state:** six production Creature Pack technical sources are now registered, and all three newly imported Rusted Warrior variants have generated descriptors plus file-backed starter Creature Definitions that make them selectable through the Creature Definition layer/Creature Lab after reload.
- **Verified limit:** the new Rusted Knight, Forest Knight, and White Knight definitions are explicitly starter Lab definitions. No Enemy Preset, production loadout, loot profile, AI tuning, encounter placement, or canonical normal-game activation for these bodies is added by the reviewed range.
- **Verified limit:** the auto-registration helper copies pack-backed animation/segment facts into a Creature Definition but uses generic starter values for movement, durability, mortality, blood presentation, root yaw/offset, and collision profile. Those values are implementation defaults, not evidence of production tuning or acceptance.
- **Verified limit:** no new audio assets or audio runtime changes appear in the processed commits.
- **Verified limit:** per-spawn world persistence is still absent. Death, current HP, resolved random reward, loot-claimed state, corpse state, and encounter completion are not saved by `spawnId`; reset/reload creates fresh runtime actor identity/state.
- **Verified limit:** encounter locomotion remains direct/simple collision motion. There is no navmesh, pathfinding graph/A*, patrol system, advanced obstacle planning, faction/group tactics, perception simulation, or attack-slot coordination.
- **Verified limit:** player combat death still lacks a finalized normal-game persistence/respawn policy; player combat remains one HP/life state plus physical hurt volume, without armor/block/stamina/body-part physiology in this range.
- **Verified limit:** economy remains gold-only. Encounter authoring can set one fixed per-spawn gold override, but no items, equipment ownership, physical coin entities, rarity tables, shops/merchants, loot-table editor, or broad economy model was added.
- **Verified validation state:** the three new Forge validation artifacts inspected in this range report `PASS` with no errors/warnings, and focused repository tests/check scripts were expanded. **Not verified by this range:** successful `npm run validate:creature-packs`, `npm run validate:combat`, `npm run build`, CI, or live iPhone/deployed acceptance.
- **Inference:** the intake pipeline is now materially closer to a repeatable “Forge export → repository → immediately inspectable in Creature Lab” loop. The next useful gate for the new variants is therefore visual/collision/animation/damage acceptance in Creature Lab before any of them receives Enemy Preset or encounter-level gameplay policy. This is an inference from the new registration boundary, not evidence that such acceptance has occurred.
- **Next logical work:** run the Creature Pack validation/check path and Creature Lab acceptance for Rusted Knight, Forest Knight, and White Knight; review generated starter height/collider/root orientation, approved animation playback, progressive-site targeting, segment behavior, sockets, and offensive Actions; only then author explicit loadout/Enemy Preset/loot/AI/encounter data for variants intended for production. Separately, the existing encounter-selection and `spawnId`-keyed persistence gaps remain open.

## Development History

### 2026-08-16 22:01 EDT — Update through `2afcbfa`

**Scanned range:** after canonical checkpoint `a11425fae0c2edee79f0ccf9f3d25c0a0f4322c9` through observed `main` HEAD `2afcbfad3e59f46dafcd6b44f72d135366528dbb`. Commit `520361a` was ignored because its message begins with `docs(devlog):` and only updates the canonical handoff. Two development commits were included.

**Included commits, chronological:**

- `d761008` — update
- `2afcbfa` — update

**Grouped development steps:**

1. **Three Rusted Warrior production Creature Pack imports (`d761008`)**
   - Added Rusted Knight, Forest Knight, and White Knight production source registrations to `config/production-creature-packs.json`, with canonical Damage directories under `public/assets/enemies/rusted_warrior_001*`.
   - Added each variant's Forge Damage GLB, manifest, and validation report, generated `dreadstone.creature_pack.v1` descriptor, and generated index membership. The reviewed artifacts report Forge validation `PASS` with empty errors/warnings.
   - The generated Rusted Knight descriptor records one `DSB_DAMAGE_RIG` runtime skeleton/skin with 21 required bones, left/right main-hand sockets, one-hand overhead and thrust offensive Actions, four available detachable segments with three active at runtime, four deformation regions, two progressive-damage sites, and seven approved embedded clips with zero unapproved clips. The three variants are registered as distinct pack/display/source identities rather than as Enemy Presets or encounter instances.
   - Updated Creature Pack pipeline/workflow tests for the expanded production inventory. The generic commit title carries no additional supported intent; no successful repository command/build/CI/device execution is inferred.

2. **Transactional automatic Creature Lab starter definitions (`2afcbfa`)**
   - Added `scripts/lib/creature-lab-definition.mjs` to create or find a Creature Definition for a production pack, plus `scripts/register-creature-lab-definitions.mjs --all [--check]` and documentation/PowerShell messaging for the new registration step.
   - Integrated definition registration into `scripts/lib/creature-pack-workflow.mjs` after the authoritative production import and before `validate:creature-packs`. Newly created definitions participate in rollback; existing built-in/file definitions are preserved and not overwritten.
   - Added file-backed production definitions for `rusted_warrior_001`, `rusted_warrior_001_forest_knight`, and `rusted_warrior_001_white_knight`. The starter shape derives pack raw height, approved animation inventory, and active runtime segment IDs, while using neutral Creature Lab defaults and explicitly leaving loadout, Enemy Preset, loot, AI, and encounter placement for later gameplay work.
   - Updated `CreatureDefinitionRegistry.js` for the file-backed definitions and extended `validate:creature-packs` with `register-creature-lab-definitions.mjs --all --check`. Expanded workflow tests cover creation, preservation, and rollback semantics; committed tests/check wiring does not establish successful execution.

### 2026-08-11 02:01 EDT — Update through `a11425f`

**Scanned range:** after canonical checkpoint `80e12c5f4ea09fa1dac5d92505910b056081ec97` through observed `main` HEAD `a11425fae0c2edee79f0ccf9f3d25c0a0f4322c9`. Commit `8bf5910` was ignored because its message begins with `docs(devlog):` and only updates the canonical handoff. One development commit was included.

**Included commits, chronological:**

- `a11425f` — Create folsomfight.json

**Grouped development steps:**

1. **Second checked-in Folsom encounter definition (`a11425f`)**
   - Added only `src/game/encounters/data/folsomfight.json`; no runtime code, tests, architecture docs, assets, audio, or validation artifacts changed in this commit.
   - The canonical `dreadstone.encounter_definition.v1` record defines encounter `folsomfight` / “FolsomFight” at `locationId: "folsom"` with stable spawn `folsomfight_enemy_7725bfec57ec`, preset `dread_ram_god_great_mace`, position `[-1.85667731, 0.188, 12.71035722]`, yaw `2.9531555`, home radius `8`, and no explicit fixed-gold override.
   - Existing eager encounter-data discovery means the file is part of the source catalog, but this diff alone does not establish its intended activation relationship to the existing `folsomtst` definition or provide successful validation/build/device evidence.

### 2026-08-10 21:59 EDT — Update through `80e12c5`

**Scanned range:** after canonical checkpoint `2a626b4a7ffc570ee2d25807ee6d3f4f3c6d00f0` through observed `main` HEAD `80e12c5f4ea09fa1dac5d92505910b056081ec97`. Commit `cdbd779` was ignored because its message begins with `docs(devlog):` and only updates the canonical handoff. Five development commits were included.

**Included commits, chronological:**

- `c1f37e4` — Add M9 encounter runtime spawning
- `ede71da` — Add touch-first encounter authoring mode
- `2be3163` — updte
- `e7e55b1` — Fix encounter enemy self-blocking locomotion
- `80e12c5` — Polish mobile encounter authoring UX

**Grouped development steps:**

1. **M9 canonical Encounter Definition and production runtime (`c1f37e4`)**
   - Added strict `src/contracts/EncounterDefinition.js` and `docs/architecture/ENCOUNTER_RUNTIME_ARCHITECTURE.md`. The contract owns stable `spawnId`, registered `presetId`, exact `locationId`, finite world position/yaw, positive `homeRadius`, and an optional fixed positive gold override; deterministic serialization strips runtime/editor state.
   - Added `EncounterRegistry.js`, `EncounterSpawner.js`, `EncounterRuntime.js`, `EncounterRuntimeHost.js`, `EncounterEnemyRuntime.js`, `EnemyWorldMotionHost.js`, development fixtures/proof UI, and `tests/m9-encounters.test.mjs`. Spawning resolves presets before scene mutation and composes Creature Factory actor, combat routing/director, NPC armament, minimal brain, loot runtime, and motion ownership transactionally.
   - Promoted `PlayerCombatDamageReceiver` into normal game sessions around the existing `PlayerCombatState`, with scene rebind and Lab reuse. Updated reciprocity/preset/loot/brain architecture docs to replace the former “future Encounter Instance” placeholder with the concrete Encounter Spawn Record boundary.
   - Added reward precedence for per-spawn fixed gold over preset-default Loot Profile without mutating the registry/profile authority. Individual death/loot/corpse/current-HP persistence remains deliberately absent.
   - Added `validate:m9-encounters`; committed test presence does not prove the command, build, CI, or device run succeeded.

2. **Touch-first canonical encounter authoring and constrained project installer (`ede71da`)**
   - Added `docs/architecture/ENCOUNTER_AUTHORING_MODE.md` plus authoring controller, draft store, operations, placement resolver, preview runtime, preset preview, and panel under `src/game/encounters/authoring/`. The tool edits the exact `dreadstone.encounter_definition.v1` contract, scopes drafts to the active location, preserves stable spawn identity, and supports place/select/move/yaw/duplicate/change-preset/home-radius/fixed-gold operations.
   - Visual previews use real resolved preset body/weapon/socket/grip data but intentionally omit combat actor, brain, loot, attack source, combat colliders, persistence, and player blocker. Ground placement uses world ray/collision support and rejects blocked/unsupported candidates.
   - Added exact-draft testing through `EncounterRuntimeHost.spawnDefinition()`, local draft autosave, canonical JSON view/copy/export, and a development-only Save-to-Project bridge. `scripts/encounter-authoring-bridge.mjs`, `scripts/encounter-installer-lib.mjs`, `scripts/install-encounter.mjs`, `IMPORT_ENCOUNTER.cmd`, and Vite development middleware validate/canonicalize/install only inside `src/game/encounters/data/` with catalog validation and rollback.
   - Changed production encounter discovery to eager data-file loading and added `tests/m95-encounter-authoring.test.mjs` plus `validate:m95-encounter-authoring`. Production/preview hosting does not expose the authoring write endpoint.

3. **First checked-in Folsom encounter data (`2be3163`)**
   - Added only `src/game/encounters/data/folsomtst.json`.
   - The record defines `folsomtst` / “FolsomTst” for `locationId: "folsom"` with one spawn: `folsomtst_enemy_d64927889973`, preset `dread_ram_god_great_mace`, position `[-2, 0.188, 5.75]`, yaw `0`, home radius `10`, and no explicit reward override.
   - The generic commit title provides no additional supported intent; this handoff records only the concrete checked-in encounter data.

4. **Encounter locomotion self-blocking regression fix (`e7e55b1`)**
   - Extended `CollisionWorld.canStandAtFloorPosition(position, options)` so floor-position checks forward explicit standability options.
   - Updated `EnemyWorldMotionHost` to perform the world-support standability check with `{ ignoreActorBlockers: true }`, while its separate blocker query still prevents overlap with other encounter actors. This avoids rejecting an enemy's own nearby movement because its current combat-actor blocker overlaps the candidate.
   - Expanded `tests/m9-encounters.test.mjs` with real `CollisionWorld` coverage proving normal standability still sees actor blockers, the world-only probe can ignore actor blockers, another enemy remains blocking, world walls/unsupported space remain invalid, and disposal removes only the host-owned blocker.

5. **Unified mobile development launcher and authoring interaction polish (`80e12c5`)**
   - Reworked `DevToolsLauncher.js` into one compact persistent `DEV` menu for Creature Lab, Encounter Authoring, and Combat Debug. Creature Lab drops its independent fixed LAB toggle, opens immediately when selected, and exposes Exit Lab routing back to the normal URL.
   - Reworked `EncounterAuthoringPanel.js` around a pointer-transparent top status/action rail, temporary drawers, and operation-specific context rails so world/control-deck touch ownership remains usable. Placement can remain active for repeated spawns; selected-enemy frequent actions stay in-context while less-common identity/tuning fields move to Properties.
   - Added recent Enemy Bank choices, clearer selection treatment, dirty/project-state indicators, selected-only radius adjustment, simplified test-mode controls, and top-edge placement/test controls that avoid the normal bottom gameplay deck.
   - Updated authoring preview/controller and focused Creature Lab/M9.5 tests for the consolidated launcher and interaction model. These source assertions do not establish live mobile usability or successful suite execution.

### 2026-08-10 18:04 EDT — Update through `2a626b4`

**Scanned range:** after canonical checkpoint `1517e318eea27c065357e59627c14058db428a0e` through observed `main` HEAD `2a626b4a7ffc570ee2d25807ee6d3f4f3c6d00f0`. Commit `d8b5e1f` was ignored because its message begins with `docs(devlog):` and only updates the canonical handoff. Five development commits were included.

**Included commits, chronological:**

- `7aa5480` — Fix Creature Lab weapon asset URLs
- `77491b5` — Add M6.7 enemy presets and armament calibration
- `482aaeb` — Calibrate Dread Ram God great mace preset
- `6713172` — Add M7 authoritative player combat and enemy brain
- `2a626b4` — Add M8 loot and economy kernel

**Grouped development steps:**

1. **Deployment-safe world weapon asset URLs (`7aa5480`)**
   - Updated `src/game/combat/WorldWeaponGlbLoader.js` so canonical `/assets/...` weapon paths are resolved against Vite `BASE_URL` and the current document base before `GLTFLoader.loadAsync()` is called. Added resolved-URL diagnostics while preserving source caching, retry-on-failure, cloning, and disposal semantics.
   - Updated `docs/architecture/NPC_ARMAMENT_ARCHITECTURE.md` to reflect base-path resolution and the now-available Ram God Forge armament capability; Chezwick and Dreadguard remain explicit unavailable legacy cases.
   - Added focused URL-resolution coverage in `tests/m66-real-weapon-pipeline.test.mjs`. The commit does not prove deployed build/device execution.

2. **Enemy Preset contract, resolver, production loadouts, and scoped Lab calibration (`77491b5`)**
   - Added `docs/architecture/ENEMY_PRESET_ARCHITECTURE.md`, strict `src/contracts/EnemyPreset.js`, `EnemyPresetRegistry.js`, `EnemyPresetResolver.js`, and shared `CreaturePresentationResolution.js`. The new production chain is Creature Pack → Creature Definition → Enemy Preset → future Encounter Instance.
   - Enemy Presets own reusable target-height/loadout selection and optional weapon scale/grip/capsule overrides only. Resolver failure is explicit for unknown definitions/packs/loadouts/weapons, incompatible Forge Actions, unavailable sockets, invalid heights, or invalid calibration. Canonical weapon records are cloned rather than mutated.
   - Reworked `NpcLoadout.js` around stable production-neutral loadout IDs and permitted offensive Action IDs while retaining existing Lab names as compatibility aliases to the same authority; expanded `NpcWeaponRegistry.js` support used by preset resolution.
   - Expanded Creature Lab controller/panel/calibration around a preset selector, preset-scoped `dreadstone.creature_lab.weapon_calibration.v2.*` drafts, combined height/weapon reset, production-default vs unsaved-draft diagnostics, and `COPY ENEMY PRESET JSON`. Definition-only and preset drafts are isolated so calibration cannot leak between contexts.
   - Added `tests/enemy-preset.test.mjs` and `validate:m67-enemy-presets`; package/test presence is not evidence of successful execution.

3. **Promoted Ram God Great Mace calibration (`482aaeb`)**
   - Changed only the Ram God Great Mace production preset, its architecture documentation, and focused assertions: target height moved from 1.7 m to 2.1 m, mace uniform scale from `1` to `1.41`, and grip position from `[0, 0, 0]` to `[0.005, 0.085, -0.015]`; the quaternion was normalized/rounded deterministically.
   - Preserved the existing attack capsule (`start [0,0,-0.48]`, `end [0,0,-0.29]`, radius `0.13`). The underlying Dread Ram God Creature Definition remains 1.7 m and the canonical Dreadstone mace remains unchanged.
   - Updated preset-selection/reset tests to treat the promoted values as checked-in production defaults. No device-scale art/contact acceptance is asserted by the diff.

4. **Authoritative player combat state and minimal autonomous enemy brain (`6713172`)**
   - Added `src/game/combat/PlayerCombatState.js` and rewired `Game.js`, `PlayerCombatDamageReceiver.js`, first-person viewmodel/tool input, and related combat controllers so one game-owned state owns HP/alive/dead/reset while the receiver owns only physical hurt volume, accepted attack identities, impact diagnostics, and feedback. M7 deliberately does not persist combat HP/death.
   - Added `src/game/combat/MinimalCombatBrain.js` and `docs/architecture/MINIMAL_ENEMY_COMBAT_BRAIN.md`. The brain consumes resolved preset/armament capability and owns direct target acquisition/approach, facing before commitment, attack request, recovery/reevaluation, minimum separation, and bounded return-home behavior without taking ownership of animation phases, weapon transforms/collision, damage, or Forge facts.
   - Integrated the brain into Creature Lab through `CreatureLabController.js`, `CreatureLabPanel.js`, and `CombatLabWalkerController.js`, including external locomotion authority, temporary home pose, enable/disable/reset controls, and diagnostics. Manual armament controls are suppressed while the autonomous owner is active.
   - Preserved physical miss semantics: once Forge commitment locks orientation, the strike continues through committed world space and only ACTIVE weapon geometry intersection may damage the player.
   - Added `tests/m7-combat-brain.test.mjs`, expanded reciprocity/armament/weapon tests, and added `validate:m7-combat-brain`. No successful test/build/CI/device run is asserted.

5. **Gold-only loot and currency kernel (`2a626b4`)**
   - Added `docs/architecture/LOOT_ECONOMY_KERNEL.md`, strict `src/contracts/LootProfile.js`, `LootProfileRegistry.js`, `EnemyLootRuntime.js`, `PlayerCurrencyState.js`, and `PlayerCurrencyPersistence.js`. `dreadstone.loot_profile.v1` supports validated FIXED or inclusive RANGE gold only; the first production profile `dread_ram_god_standard` is currently fixed at 12 gold.
   - Versioned Enemy Presets with `dreadstone.enemy_preset.v2`, whose only new optional field is `rewards.lootProfileId`; v1 remains unchanged and reward-free. The Ram God Great Mace preset moved to v2 and references `dread_ram_god_standard` without changing its 2.1 m/1.41 mace calibration. `EnemyPresetResolver` returns the immutable profile but never resolves currency itself.
   - `EnemyLootRuntime` observes authoritative actor death, attempts reward resolution once, creates at most one logical container, and permits one successful claim. Failed wallet/persistence transactions do not consume the container; subsequent successful claims cannot pay twice; respawn/new actor receives a new runtime.
   - `PlayerCurrencyState` is the sole mutable session wallet with non-negative safe-integer validation, atomic add/spend, overflow/affordability rejection, subscriptions, and bounded transaction diagnostics. Normal play persists through `GameStateCurrencyPersistenceAdapter` under `dreadStoneBlack.currencyState.v1`; Creature Lab uses a session adapter starting at zero and writing no normal save state.
   - Extended `Game.js`, `GameState.js`, `SceneSessionHost.js`, Folsom/Creature Lab wiring, panel/calibration exports, and tests so Lab can display Loot Profile/resolved gold/player gold and enable `TAKE GOLD` only after authoritative death. A general shipping HUD gold field, items, physical coins, shops, rarity, encounter placement, and per-corpse persistence remain explicitly deferred.
   - Added `tests/m8-loot-economy.test.mjs` and `validate:m8-loot-economy`. Source/test presence does not establish successful execution.

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
