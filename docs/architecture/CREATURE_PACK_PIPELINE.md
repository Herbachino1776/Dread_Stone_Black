# Creature Pack Pipeline

`dreadstone.creature_pack.v1` is the repository receiving contract for a validated technical creature body. It is generated from Forge output and contains no gameplay identity, behavior, encounter, or persistence state.

Milestone 1 established the repository receiving contract and deterministic generated registry. Milestone 2 adds a browser-safe resolver, a separate game-policy layer, an effective-profile composition bridge, and an isolated mobile Creature Lab. Canonical Folsom still uses its legacy direct profile and remains unchanged unless the explicit development lab flag is active.

## Current bundle audit

Each proven damage bundle has exactly three required files:

- Dreadguard:
  - `public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb`
  - `public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.json`
  - `public/assets/enemies/dreadguard/damage/dreadguard_damage_v001_validation.json`
- Chezwick:
  - `public/assets/enemies/chezwick/damage/chezwick_v001.glb`
  - `public/assets/enemies/chezwick/damage/chezwick_v001.json`
  - `public/assets/enemies/chezwick/damage/chezwick_v001_validation.json`

Dreadguard also has an Animation Forge sidecar manifest and report:

- `public/assets/enemies/dreadguard/animations/dreadguard_animpack_v003.json`
- `public/assets/enemies/dreadguard/animations/dreadguard_animpack_v003_validation.json`

The standalone animation GLB named by that sidecar is not present in the repository. Its seven approved clips are embedded in the combined Dreadguard DamageGLB. Chezwick has no separate animation sidecars; approved clip metadata is embedded in its DamageGLB.

### Existing browser loading path

`src/game/combat/HumanoidGlbVisualAdapter.js` is the current production loader.

1. `GLTFLoader.loadAsync(profile.assetPath)` loads and caches the GLB.
2. `fetch()` loads and caches the optional animation manifest and Forge damage manifest from profile paths.
3. The loaded scene is cloned with `SkeletonUtils.clone`.
4. Forge default-hidden, gore, and stain objects are hidden; mesh materials and skinned-surface metadata are prepared.
5. The profile's animation/rest-pose authority normalizes scale and ground presentation.
6. `HumanoidDamageSegmentRuntime` validates and owns the damage body.

The browser does **not** fetch or inspect `damageValidationReportPath` or `animationValidationReportPath`. Those profile fields currently exist for integration traceability only. Before this milestone, the Dreadguard report was read by `scripts/validate-combat.mjs` and `tests/dreadguard-damage-segments.test.mjs`; Chezwick's report was not a repository ingest gate.

### Existing validators

- `validateDamageAsset` in `src/game/combat/HumanoidDamageSegmentRuntime.js` validates:
  - damage schema, authoring identity, manifest GLB name, and source fingerprints against a runtime profile;
  - intact body, sockets, segment objects, stump objects, detached rigid meshes, and bones;
  - the game-supported active segment subset;
  - approved animation names present in the GLB.
- `validateForgeDamageDeformationAsset` in `src/game/combat/ForgeDamageDeformationRuntime.js` validates:
  - deformation regions and morph targets;
  - exported region registries in GLB extras;
  - generated gore ownership and bindings;
  - portable surface-stain geometry, materials, COLOR_0 alpha, and morph bindings;
  - progressive sites, ordered stages, severity anchors, deformation keys, and object bindings.
- `resolveAnimationPackManifest` in `src/game/combat/HumanoidGlbVisualAdapter.js` validates approved manifest clips and, when requested, their embedded `dreadstone.animation_clip.v1` approval metadata.
- `scripts/validate-combat.mjs` performs additional Dreadguard manifest/report/GLB assertions, but it is not a generic importer.

The Creature Pack importer reuses these runtime validators. It adds repository-only validation for the required PASS report, embedded-report equality, manifest/report identity, animation sidecar report, GLB structure, deterministic measurement, and generated descriptor schema.

## Authority boundaries

Forge remains authoritative for:

- damage and deformation schemas;
- source/export object and armature identities;
- source topology and weight fingerprints;
- readiness analyzer revision/build;
- authoring version/build;
- intact, socket, segment, stump, and detached-object records;
- deformation regions and keys;
- native progressive damage sites and stages;
- gore and portable stain records;
- animation approval metadata;
- Forge warnings and PASS/FAIL reports.

The generated Creature Pack adds only repository integration facts Forge cannot provide directly:

- stable `packId` and debug/display name;
- repository asset paths;
- current recognized skeleton and bone-map profile identifiers;
- the subset of exported segment IDs the current runtime understands;
- deterministic loaded bounds and objective asset-cost counts;
- import diagnostics such as legacy inference, filename case mismatch, omitted draft sites, or ignored unapproved clips.

The importer never rewrites the GLB, Forge manifest, or Forge validation report. It rejects inconsistent output instead of repairing it.

## `dreadstone.creature_pack.v1`

The schema validator is `src/contracts/CreaturePack.js`. The Milestone 2 browser resolver reuses that validator before any descriptor is composed into an actor profile. A descriptor has this shape:

```text
schema, version, packId, displayName
assets
  glb
  damageManifest
  damageValidationReport
  animationManifest (optional)
  animationValidationReport (optional)
source
  source object/armature and stable source IDs
  readiness schema/revision/build
  topology and weight fingerprints
  Forge export timestamp
authoring
  damage version/build
  deformation version/build
presentation
  raw bounds and height
  authored forward/up axes and unit scale
  skeleton family and bone-map profile IDs
capabilities
  progressive damage, deformations, gore, stains
  paired detachable segments
  embedded/separately validated animations
damage
  available segment IDs
  current runtime-supported segment IDs
  deformation region IDs
  native progressive site IDs
animations
  delivery, separately validated state
  approved clip names/kinds and unapproved count
importDiagnostics
cost
  objective GLB/runtime counts
```

The descriptor deliberately excludes hostility, faction, health, damage multipliers, AI, morale, loot, dialogue, quest state, encounter role, and persistence state.

Generated descriptors are small summaries. They do not copy Forge deformation records, morph definitions, gore bindings, stain bindings, segment definitions, or progressive stage records.

## Import command and generated registry

Import one existing bundle:

```powershell
node scripts/import-creature-pack.mjs --id chezwick_damage_v001 --source public/assets/enemies/chezwick/damage
```

Regenerate both production fixtures:

```powershell
node scripts/import-creature-pack.mjs --all
```

Verify that committed output is current without writing:

```powershell
node scripts/import-creature-pack.mjs --all --check
npm run validate:creature-packs
```

Generated output is under `public/generated/creature-packs/`:

- `chezwick_damage_v001.json`
- `dreadguard_damage_v001.json`
- `index.json`, using `dreadstone.creature_pack_registry.v1`

The index is sorted by `packId` and points to the complete descriptors. It is generated data, not a hand-authored gameplay registry.

The importer:

1. discovers exactly one `dreadstone.damage_authoring.v1` manifest and its named GLB;
2. requires the matching damage validation report;
3. optionally discovers the sibling Animation Forge manifest/report pair;
4. validates schemas, PASS state, empty error arrays, authoring identity, source fingerprints, final-GLB status, and exact equality between the manifest's embedded validation and the sidecar report;
5. parses the GLB with Three.js `GLTFLoader`;
6. validates animation approval metadata;
7. calls the current damage-segment and deformation validators without profile compatibility fallbacks;
8. measures bounds and cost statistics;
9. validates and emits deterministic normalized metadata.

## Profile duplication audit

`src/game/combat/HumanoidModelProfiles.js` currently mixes export-derived facts with real game configuration.

Export-derived or repository-integration fields now checked against generated packs:

- `assetPath`;
- `damageManifestPath` and `damageValidationReportPath`;
- optional animation manifest/report paths;
- `rawHeight` (measured in the approved holding pose when a single approved IDLE exists, otherwise the exported rest pose);
- `authoredForwardAxis` where Forge anatomy or approved animation metadata declares it;
- `damageAuthoringVersion` and `damageAuthoringBuildId`;
- `damageTopologyFingerprint` and `damageWeightFingerprint`;
- exported/available segment IDs and the configured active runtime subset;
- expected runtime animation names as a subset of approved embedded capability.

Game-authored fields that remain in profiles:

- `voiceProfile`;
- `targetHeight`, `groundClearance`, `rootYaw`, and `rootOffset` presentation decisions;
- pose-authority, holding-pose, fade, walk-speed, and death-presentation policy;
- allowed animation kinds and intentional clip exclusions/selections;
- `proxyFit` collision geometry;
- progressive hits per stage and terminal fatal policy;
- durability, piercing lethality, and mace-blood tuning;
- collider fit notes.

`activeDamageSegmentIds` is a migration bridge: the IDs originate in Forge, but enabling only `head_neck`, `left_elbow`, and `right_elbow` is a current game-runtime support decision. Both bundles also export `lower_spine`; it is available in pack metadata but not active because `ACTIVE_DAMAGE_SEGMENT_CONTRACTS` does not support it yet.

## Milestone 2 runtime resolution

`src/game/creatures/CreaturePackRegistry.js` is the browser-safe runtime receiving dock. It uses `fetch`, never Node filesystem APIs, and resolves URLs against Vite's `BASE_URL` and the document base so deployed GitHub Pages paths remain valid. It:

- loads and validates `public/generated/creature-packs/index.json`;
- lists registered summaries and checks or resolves a `packId`;
- loads and validates the referenced `dreadstone.creature_pack.v1` descriptor;
- verifies registry/descriptor ID and display-name agreement;
- caches the index and individual descriptor promises;
- reports stable error codes for request, JSON, registry, descriptor, and unknown-pack failures.

The resolver does not fetch Forge validation reports or reconstruct compact descriptor facts. `HumanoidGlbVisualAdapter` still loads the GLB, optional animation manifest, and detailed Forge damage manifest required by the actual actor runtime.

## Runtime policy and effective-profile bridge

`src/game/creatures/CreatureRuntimePolicies.js` owns game-authored decisions for the current humanoid host. It currently registers a small policy for Chezwick and Dreadguard. Policies may contain presentation scale, grounding, rotation, collision fit, animation selection, holding/death behavior, voice, damage cadence, mortality/lethality tuning, compatibility sites, and the current supported segment subset.

Policies are explicitly rejected if they duplicate descriptor-owned technical fields such as asset paths, raw exported height, Forge authoring identity, or source fingerprints. `composeHumanoidCreatureRuntimeProfile(pack, policy)` combines the two authorities into the compatibility profile already accepted by `HumanoidCombatActor` and `HumanoidGlbVisualAdapter`:

```text
validated generated Creature Pack
  technical/export truth
             +
validated game-authored runtime policy
  presentation and gameplay decisions
             =
effective current humanoid profile
```

This bridge lets both production fixtures use one generic resolution/composition path without rewriting the actor. `HumanoidModelProfiles.js` remains in place for canonical Folsom and other existing consumers; it is legacy duplication to remove gradually only after parity is proven.

## Supported runtime boundary

The Milestone 2 Creature Lab supports only:

- skeleton family `DSB_HUMANOID_V1`;
- bone-map profile `dreadstone.humanoid.current_bone_map.v1`;
- packs with an explicit game-authored runtime policy;
- active segments that exist in the pack and have current semantic-body contracts;
- selected animations that appear in the pack's approved animation metadata.

A registered pack outside that boundary remains visible as `REGISTERED BUT CURRENT RUNTIME UNSUPPORTED` with a reason. The resolver does not guess a bone map, claim quadruped support, or enable an exported lower-spine boundary that the actor cannot safely run.

## Mobile Creature Lab

`src/game/creatures/CreatureLabController.js` owns the isolated development session. `src/game/creatures/CreatureLabPanel.js` is its touch-first UI. Activate it in a Vite development build with:

```text
?creatureLab=1
```

The flag is ignored outside a development build. In lab mode Folsom hosts one stationary, deliberately placed test subject and suppresses the normal four-Chezwick development combat wave. Without the flag, no lab controller, panel, toggle, lab actor, or spawn override exists.

The floating `LAB` button opens a safe-area-aware portrait panel. Core controls use 48 CSS-pixel minimum targets, readable labels, two-column/one-column responsive grids, vertical touch scrolling, no hover-only workflow, and no horizontal core-control overflow. Pointer, touch, and wheel events inside the panel are stopped from reaching world controls; the normal weapon-input ownership selectors also treat the panel as blocked input. Closing the panel restores the normal world control surface.

Button-driven operations include:

- close, respawn, and reset all damage;
- generated registered-pack selection without a page reload;
- compact pack technical/cost information;
- only resolvable idle, walk, hurt, guard, and death actions;
- progressive site listing and selection with `NATIVE` or `COMPATIBILITY` authority labels;
- direct Light, Medium, Heavy, Next Stage, and Reset Site controls;
- a supported real blunt strike through `HumanoidCombatActor.applyBluntImpact` at the authored capture center;
- detachment controls for pack-available boundaries, enabled only for the actor's supported subset;
- production-path death, safe ragdoll only when a pack does not retain authored-death authority, and respawn;
- on-screen diagnostics and clipboard copy with selectable-text fallback.

Console access is secondary only. The generic lab commands are exposed as `__DSB_CREATURE_LAB__` in development for diagnostics, while the existing `__DSB_CHEZWICK_DAMAGE__` commands remain available only on the legacy non-lab path for compatibility.

### Pack switching lifecycle

Selecting another supported pack cancels the current weapon target, disposes the current walker actor/director/blood ownership, unregisters combat routing, removes its player blocker, composes the new pack and policy, and spawns one clean replacement through the same `HumanoidCombatActor` factory path. The controller then waits for visual-adapter initialization before exposing resolved damage sites. Switching does not reload Folsom and does not write progression or save state.

Chezwick and Dreadguard preserve their existing compatibility behavior without changing generated truth:

- Chezwick exposes the native right-face site from Forge plus the policy-owned left-face reconstruction.
- Dreadguard exposes zero native sites from its pack and the existing policy-owned left-head compatibility site.

Native manifest sites take precedence. Compatibility sites are added only for a side not supplied by Forge, and diagnostics report the two counts separately.

## Compatibility exceptions

Compatibility metadata is never promoted into native Creature Pack truth.

- Dreadguard's Forge report says its authored Left Head progressive site is a disabled/omitted draft. `DREADGUARD_PROGRESSIVE_DAMAGE_SITE_FALLBACK` keeps the current runtime presentation working. The generated Dreadguard pack therefore reports deformation/gore/stain capability but zero native progressive sites.
- Chezwick natively exports only `damage_site_face_right`. Forge exported the left deformation artifacts but omitted the draft left site. `CHEZWICK_LEFT_PROGRESSIVE_DAMAGE_SITE_COMPATIBILITY` reconstructs the current left runtime site from exact stamp captures. The generated Chezwick pack lists only the native right site.
- Chezwick embeds five legacy `SBF_Production_*` clips without `dreadstone.animation_clip.v1` approval metadata. They are counted as unapproved and are not advertised as pack capabilities.
- Chezwick's manifest spells `Chezwick_v001.glb` while the repository file is lowercase. The importer resolves this known case-insensitive identity and emits a diagnostic because GitHub Pages paths are case-sensitive.

Runtime fallback precedence remains unchanged: native manifest sites win, and a compatibility site is added only for a side not supplied by Forge.

## Fingerprints and segment state

Source-body fingerprints are:

- `manifest.source.topologyFingerprint` / report `source_topology_sha256`;
- `manifest.source.weightFingerprint` / report `source_weight_sha256`.

Deformation authoring also records region/pair topology and weight fingerprints inside the deformation manifest/report. Those remain Forge detail and are validated by the reused deformation validator; they are not duplicated into the compact pack descriptor.

`damage.availableSegmentIds` contains every exported manifest segment. `damage.activeRuntimeSegmentIds` contains only segments with a current `ACTIVE_DAMAGE_SEGMENT_CONTRACTS` body binding. This separates body capability from current runtime support without pretending unsupported lower-spine behavior exists.

## What cannot yet be derived safely

The importer cannot derive gameplay scale, grounding preference, collision proxy fits, root presentation yaw, mortality policy, combat tuning, animation selection policy, or compatibility sites from Forge body truth.

Legacy exports without `manifest.anatomy` can only receive a skeleton/bone-map profile when their bone signature exactly matches a known family. Unknown legacy skeletons are rejected rather than guessed. A Forge anatomy profile is the forward path for new skeleton families.

The importer validates exported segments but cannot make a new segment playable unless the game has a semantic-body contract. It also does not prove detached wound transfer, arbitrary non-humanoid runtime support, simulation tiers, or persistent instances.

## Future boundary

Creature Pack:

- generated/imported technical body capabilities;
- implemented by this milestone.

Creature Definition:

- hand-authored gameplay identity and behavior;
- not implemented here.

Creature Instance:

- one world individual and its persistent state;
- not implemented here.

The planned migration now continues from the first two completed milestones:

1. Creature Pack contract/importer and generated registry (Milestone 1, complete).
2. Runtime resolver, policy composition, and mobile Folsom proving ground (Milestone 2, complete).
3. Generic 3D Progressive Damage Site Targeting + Site-Driven Damage Harness (Milestone 3, next).
4. Creature Definitions and factory.
5. Damage consequence vocabulary.
6. Gradual extraction from `HumanoidCombatActor`.
7. Persistence.
8. Simulation tiers.
9. Non-humanoid profiles.

Milestone 3 should replace panel-only site selection with generic in-world 3D site targeting and a site-driven damage harness. It must reuse the resolved native/compatibility site authority, not infer sites from arbitrary meshes. It is intentionally not implemented in Milestone 2.
