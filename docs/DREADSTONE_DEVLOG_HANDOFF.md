# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: 4dc568ce606a71e3fb6de9c4d50c5eb85f29c540 -->

## Current Handoff Snapshot

### Verified implementation

- **The production content chain now spans Forge body capability through authored encounters:** Forge/Creature Pack technical truth → Creature Definition body/gameplay archetype → game-owned weapon/loadout → Enemy Preset reusable production tuning → `dreadstone.encounter_definition.v1` placed spawn. Forge remains authoritative for skeletons, sockets, approved offensive Actions, progressive damage/deformation/gore/stains/segments, and embedded animation capability; game records own weapon identity/calibration and gameplay composition.
- **Six production Creature Pack sources are registered.** Chezwick, Dreadguard, Dread Ram God, Rusted Knight, Forest Knight, and White Knight have generated Creature Pack data; the three Rusted Warrior variants also have conservative file-backed starter Creature Definitions created by the transactional intake workflow. Their Forge artifacts report the expected humanoid runtime rig/sockets/Actions and checked-in validation reports previously recorded as `PASS`; those artifacts do not prove repository/build/device execution.
- **Creature Pack intake can make compatible humanoids immediately inspectable without auto-promoting gameplay policy.** `scripts/lib/creature-lab-definition.mjs` and `register-creature-lab-definitions.mjs` create only a starter Creature Definition when no authoritative definition exists. Loadout, Enemy Preset, loot, AI, encounter placement, and production acceptance remain explicit later decisions.
- **Commit `4dc568c` adds a transactional imported-weapon pipeline.** Root `IMPORT_WEAPON.cmd`, `scripts/import-weapon.mjs`, and `scripts/weapon-import-lib.mjs` accept GLB 2.0 files, derive stable lowercase IDs from filenames, require an explicit Forge weapon class, copy assets to `public/assets/weapons/imported/`, and write game-owned weapon JSON under `src/game/combat/weapons/data/`. Canonical IDs cannot be overwritten, existing imported IDs are rejected, destinations are path-contained, and partial installs are rolled back.
- **Imported weapon defaults are intentionally starting calibration, not accepted balance.** Weapon class selects initial capsule, damage/type, impact strength, reach, right-main-hand compatibility, unit scale, and neutral grip. The importer validates the resulting weapon record/loadout, but neither filename nor importer guesses a Forge animation. Forge Action/socket/class compatibility remains the final armament capability filter.
- **Production weapon/loadout discovery is data-driven.** `NpcWeaponRegistry` now includes file-backed imported weapon records, and `NpcLoadout.js` deterministically creates `humanoid_<weaponId>_main_hand` loadouts for imported weapons. Their broad humanoid offensive-action allow-list is narrowed at resolution by the selected Creature Pack's Forge-authored Action IDs, weapon classes, and socket roles.
- **Creature Lab can now author a complete production Enemy Preset from either an existing preset or a Creature Definition + selected weapon.** `CreatureLabCalibration.js`, `CreatureLabController.js`, and `CreatureLabPanel.js` retain target-height and weapon scale/grip/capsule calibration, add stable preset ID/display-name authoring, serialize the canonical Enemy Preset v2 shape, and support project save in development. Selecting another Lab weapon from definition mode is therefore an authoring path rather than an implicit production loadout change.
- **Enemy Preset project installation is constrained and transactional.** `scripts/enemy-preset-authoring-bridge.mjs` exposes a development-server POST endpoint only; `scripts/enemy-preset-installer-lib.mjs` parses the canonical contract, restricts filenames to stable preset IDs under `src/game/creatures/presets/`, validates the full Definition → Pack → Loadout → weapon → Forge Action/socket chain, writes through temp/backup files, revalidates the installed catalog, and restores the prior file on failure.
- **Authored Enemy Presets are now production-discovered files.** `EnemyPresetRegistry.js` eagerly discovers `src/game/creatures/presets/*.json` for dev/build and retains the built-in Dread Ram God Great Mace preset only when a file-backed record with that ID does not exist. `NpcWeaponRegistry`/`NpcLoadout` similarly expose imported weapon data to runtime resolution.
- **Encounter installation now shares the authored preset catalog.** `scripts/encounter-installer-lib.mjs` was changed to include installed file-backed Enemy Presets when validating encounter JSON, preventing a preset that is valid in the browser/production preset registry from being rejected solely because the installer previously knew only the built-in preset.
- **The canonical encounter/runtime architecture remains intact.** M9 encounter spawning resolves presets before mutation and composes Creature Factory actors, reciprocal player damage, NPC armament, `MinimalCombatBrain`, loot, and bounded collision/world motion transactionally. Authored `spawnId` remains stable world identity while runtime actor identity is recreated.
- **Folsom currently has two checked-in canonical encounter definitions, `folsomtst` and `folsomfight`, both using `dread_ram_god_great_mace`.** No commit in this range changes which encounter is selected/activated in normal play.
- **M9.5 Encounter Authoring remains development-only and edits the shipping contract.** It supports touch-first placement/editing, real resolved visual previews, exact-draft testing, local drafts, canonical JSON, and constrained project installation. The latest preset-catalog integration means newly saved file-backed presets can feed the same Enemy Bank/catalog path after development-server reload.
- **Player combat and economy authorities remain unchanged.** `PlayerCombatState` is the sole mutable HP/life authority; `PlayerCombatDamageReceiver` is the physical impact adapter/deduplication boundary. `PlayerCurrencyState` is the gold authority; encounter fixed-gold override still takes precedence over preset Loot Profile defaults.
- **Focused validation source was added for the new authoring workflow.** `tests/creature-lab-authoring-workflow.test.mjs` and `validate:creature-authoring` were added, with related Creature Lab runtime coverage updated. This records committed validation code only; no successful test command, build, CI, or live-device run is established by the reviewed commit.
- **No new audio assets or audio runtime changes appear in the processed commit.**

### Important design decisions

- Forge owns technical body/export and offensive-action truth; the game must not infer socket/Action capability from weapon names, creature names, or imported filenames.
- Creature Definitions own reusable body/gameplay archetypes. Game-owned weapon records own asset identity, class, calibration, damage/contact dimensions, and reach. NPC Loadouts select weapons plus an allow-list of Action IDs. Enemy Presets own reusable presentation/loadout/calibration/reward tuning. Encounter Spawn Records own exact placed identity, transform, home radius, and narrow fixed-gold override.
- **Imported weapons are repository data, not runtime-only Lab state.** The GLB and JSON record are installed together transactionally; deterministic loadout discovery makes them available to Creature Lab and production resolution without a second hand-maintained loadout catalog.
- **Weapon import does not imply production acceptance.** Class-based scale/grip/capsule/combat values are safe starter defaults that require Creature Lab calibration and an explicit Enemy Preset promotion before production use.
- **Creature Lab authoring promotes canonical data rather than mutating registries in-memory.** Browser drafts remain convenience state; the development bridge accepts canonical preset JSON and the installer re-resolves all referenced production dependencies before writing.
- **File-backed Enemy Presets are first-class production catalog entries.** Built-in fallback remains for the Dread Ram God Great Mace, but an authored file with the same ID supersedes that fallback rather than creating duplicate authority.
- Existing Creature Definitions remain authoritative over generated starter definitions. Automatic Creature Pack registration still does not create Enemy Presets, loot, AI, or encounter placement.
- `spawnId` remains the stable authored world identity and must not be replaced by array position, display name, runtime UUID, or `actor.instanceId`.
- Encounter construction/reset/disposal remains lifecycle-owned and transactional. Authoring filesystem access remains narrowly scoped to development endpoints and fixed project directories; no browser-selected arbitrary path, generic write endpoint, browser commit, or browser push was added.

### Risks, inference, and next logical work

- **Verified production state:** the repository now has repeatable data paths for both Forge creature intake and standalone GLB weapon intake, plus a development path that can promote Creature Lab calibration into file-backed Enemy Presets consumed by runtime and encounter authoring.
- **Verified limit:** no actual new weapon GLB or authored Enemy Preset JSON was added in `4dc568c`; the commit adds the workflow/infrastructure. Existing production gameplay therefore does not gain a new weapon or enemy variant merely from this commit.
- **Verified limit:** imported weapon values are class defaults. Their visible scale, grip, capsule contact, damage, reach, and practical animation compatibility require inspection/tuning on the intended Creature Pack.
- **Verified limit:** the three Rusted/Forest/White Knight starter definitions still have no checked-in production Enemy Presets, loot/AI tuning, encounter placement, or normal-game activation recorded in the processed range.
- **Verified limit:** per-spawn world persistence is still absent. Death, HP, corpse, resolved reward, claimed state, and encounter completion are not persisted by `spawnId`; reload/reset creates fresh runtime state.
- **Verified limit:** encounter locomotion remains direct bounded collision motion without navmesh/pathfinding, patrols, advanced obstacle planning, group tactics, perception simulation, or attack-slot coordination.
- **Verified limit:** player death still lacks a finalized normal-game persistence/respawn policy; economy remains gold-only with no item ownership, physical coins, rarity tables, merchants, or broad equipment economy added here.
- **Verified validation state:** new authoring/import tests and npm validation wiring exist in source. **Not verified in this range:** successful `npm run validate:creature-authoring`, `npm run validate:creature-packs`, `npm run validate:combat`, `npm run build`, CI, or live iPhone/deployed acceptance.
- **Inference:** the shortest production path for the three Rusted Warrior variants is now clearer: visually validate the generated Creature Definition in Creature Lab, import/select a real weapon, calibrate body/weapon/contact behavior, save a canonical Enemy Preset, then place that preset through Encounter Authoring. This is an inference from the implemented tooling, not evidence those acceptance steps have occurred.
- **Next logical work:** exercise the new workflow end-to-end with one intended knight: validate the starter body/animations/damage/sites/sockets, import or select its production weapon, tune scale/grip/capsule and target height, save a file-backed Enemy Preset, run focused validation, then place/test it in an authored Folsom encounter. Separately, normal-game encounter selection and `spawnId`-keyed persistence remain open architecture gaps.

## Development History

### 2026-08-17 02:01 EDT — Update through `4dc568c`

**Scanned range:** after canonical checkpoint `2afcbfad3e59f46dafcd6b44f72d135366528dbb` through observed `main` HEAD `4dc568ce606a71e3fb6de9c4d50c5eb85f29c540`. Commit `e42926e` was ignored because its message begins with `docs(devlog):` and only updates the canonical handoff. One development commit was included.

**Included commits, chronological:**

- `4dc568c` — UPDTE

**Grouped development steps:**

1. **Transactional standalone GLB weapon intake (`4dc568c`)**
   - Added `IMPORT_WEAPON.cmd`, `scripts/import-weapon.mjs`, `scripts/weapon-import-lib.mjs`, and `src/game/combat/weapons/data/README.md`. The importer validates a complete GLB 2.0 container, derives a stable ID from the source filename, requires an explicit supported weapon class, and installs the asset under `public/assets/weapons/imported/` plus a canonical game-owned JSON record under `src/game/combat/weapons/data/`.
   - Import rejects canonical/reserved weapon IDs and existing destination IDs, constrains derived paths to the intended project directories, validates the generated weapon/loadout records, and removes either side of a partial install on failure. Class-specific capsule/damage/type/impact/reach plus neutral scale/grip are starter calibration only.
   - Updated `NpcWeaponRegistry.js` and `NpcLoadout.js` so imported records are production-discovered and receive deterministic `humanoid_<weaponId>_main_hand` loadouts. Action selection remains filtered by Forge-authored Action ID, compatible weapon class, and socket role rather than guessed from asset identity.

2. **Creature Lab Enemy Preset authoring and project promotion (`4dc568c`)**
   - Extended `CreatureLabCalibration.js`, `CreatureLabController.js`, `CreatureLabPanel.js`, and `CreatureLabAttackHarness.js` so definition-mode weapon selection can produce a complete Enemy Preset v2 using stable preset ID/display name, selected Creature Definition/loadout, target height, and current weapon scale/grip/capsule calibration. Existing preset drafts retain reward linkage when present.
   - Added development-only `scripts/enemy-preset-authoring-bridge.mjs` and transactional `scripts/enemy-preset-installer-lib.mjs`. Installation parses the canonical contract, derives a safe filename from `presetId`, validates the full Definition → Pack → Loadout → weapon → Forge Action/socket dependency chain, writes with temp/backup rollback, and revalidates the installed catalog.
   - Changed `EnemyPresetRegistry.js` to eagerly discover `src/game/creatures/presets/*.json`; the built-in Dread Ram God Great Mace record remains fallback authority only when a file-backed preset with that ID is absent. Added `src/game/creatures/presets/README.md` documenting the authored catalog.
   - Updated `scripts/encounter-installer-lib.mjs` to load installed file-backed presets for encounter validation, aligning the installer with the production/authoring registry rather than limiting it to the built-in preset.

3. **Workflow documentation and focused validation source (`4dc568c`)**
   - Updated `docs/architecture/ENEMY_PRESET_ARCHITECTURE.md` and `docs/architecture/NPC_ARMAMENT_ARCHITECTURE.md` to document Save Preset to Project, authored-preset discovery, imported weapon flow, and the distinction between starter calibration and production tuning.
   - Added `tests/creature-lab-authoring-workflow.test.mjs`, updated `tests/creature-lab-runtime.test.mjs`, added `validate:creature-authoring` to `package.json`, and registered the authoring bridge in `vite.config.ts` for development serving. Test/source presence does not prove command, build, CI, or device success.
   - No audio assets/runtime, Creature Pack Forge artifacts, encounter JSON, normal-game encounter activation, or persistence system changed in this commit.

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