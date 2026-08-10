# Encounter runtime architecture

Milestone 9 establishes the production contract and runtime composition for hand-authored enemy placement. It deliberately adds no canonical Folsom or North Road enemy records and no editor.

```text
Creature Pack
  technical body/export capability
        ->
Creature Definition
  gameplay/body archetype
        ->
Enemy Preset
  reusable body, loadout, weapon calibration, default reward
        ->
Encounter Spawn Record
  one stable authored identity and placement
        ->
Runtime Encounter Enemy
  actor + combat routing + armament + brain + loot + motion
```

**Enemy Preset is reusable tuning. Encounter Spawn Record is one authored individual. `spawnId` is the stable world identity. `actor.instanceId` is runtime identity.**

## `dreadstone.encounter_definition.v1`

The strict JSON-compatible contract is validated by `src/contracts/EncounterDefinition.js`:

```text
schema: "dreadstone.encounter_definition.v1"
version: 1
encounterId: stable lowercase ID
displayName: non-empty string
locationId: exact game location ID
spawns:
  - spawnId: globally unique stable authored ID
    presetId: registered Enemy Preset ID
    transform:
      position: finite world-space [x, y, z]
      yaw: finite world-space yaw in radians
    homeRadius: finite positive number
    rewardOverride: optional
      gold: positive safe integer fixed amount
```

The contract rejects unexpected fields at every level. Placement does not contain scale, Euler rotation, weapon assets, weapon calibration, Forge metadata, AI graphs, patrols, current HP, death state, loot-claim state, or save data. `locationId` uses the same exact identities as `SceneSessionHost` and the location registry, such as `folsom`, `north-road`, and `beneath-folsom`; display text is never used for activation.

`serializeEncounterDefinition()` rebuilds the record in canonical field order, normalizes finite placement numbers to at most eight decimal places, converts negative zero to zero, and emits deterministic valid JSON. `parseEncounterDefinition()` performs JSON parse, strict validation, and canonicalization. Parse -> validate -> serialize is stable and cannot retain runtime objects or debug fields.

## Registry and identity

`EncounterRegistry` validates, canonicalizes, deep-clones, and deep-freezes checked-in records. It rejects duplicate `encounterId` values and tracks one global owner for every `spawnId`, so duplicates across separate Encounter Definitions fail rather than being silently renamed. It resolves by encounter ID, filters by the active exact `locationId`, and preflights every referenced preset through `EnemyPresetResolver`.

The checked-in production registry intentionally starts empty. The two-Ram-God M9 proof is a separate dev fixture and is never imported into production encounter content.

`spawnId` must survive every load and reset of the authored encounter. It is not an array index, display name, object pointer, generated runtime UUID, or `actor.instanceId`. Each reset constructs fresh actor instances while retaining the same authored spawn IDs.

## Runtime creation and transaction

`EncounterSpawner` validates and canonicalizes the definition, verifies the current location and runtime services, and resolves all unique preset references before scene mutation. Each placed individual then follows the existing authority chain:

```text
spawn.presetId
  -> EnemyPresetResolver
  -> CreatureFactory.createActorFromResolved
  -> HumanoidCombatActor
  -> CombatDirector + CombatActorRouter
  -> NpcArmamentRuntime
  -> MinimalCombatBrain
  -> EnemyLootRuntime
```

The first preset-approved offensive Action is selected deterministically in loadout order. For `dread_ram_god_great_mace`, this remains `humanoid_one_hand_overhead`. The brain owns the one `NpcArmamentRuntime.update()` path; `EncounterRuntime` does not advance armament separately.

Construction is transactional. If any actor, visual, weapon, or brain fails to initialize, every earlier runtime enemy in that encounter is disposed in reverse order and the spawn call fails with a diagnostic. A half-live production encounter is never returned.

`EncounterRuntime` owns all instantiated enemies for one definition. It updates them, exposes diagnostics/contactable actors, despawns idempotently, and resets by disposing the old instances and reconstructing from the same immutable definition. Reset preserves `spawnId`, position, yaw, and home radius while creating fresh `actor.instanceId` values.

## Runtime enemy and motion

`EncounterEnemyRuntime` is a lifecycle/orchestration wrapper, not another creature class. It owns references to the spawn record, resolved preset, actor, director, armament, brain, reward runtime, and world-motion host. Its disposal releases the equipped weapon, attack source, brain, loot container, combat routing, player blocker, blood/director resources, scene nodes, subscriptions, and actor physics. Repeated disposal is safe.

`EnemyWorldMotionHost` adapts the existing `MinimalCombatBrain` motion contract to an active world scene. It applies the exact authored starting transform, samples the current dungeon collision ground during motion, rejects blocked moves, tries axis sliding, maintains player separation, updates the player collision blocker, faces correctly, and supports direct return-home movement. It intentionally provides no navmesh, pathfinding graph, A*, patrol route, or advanced avoidance. Enemies can navigate direct open space and simple collision, but cannot plan around complex obstacles.

Spawn-owned home values are passed without changing global brain defaults:

```text
transform.position -> brain.homePosition
transform.yaw      -> brain.homeYaw
homeRadius         -> brain.config.homeLeashRadius
```

## Combat and player receiver

Encounter actors register with the scene's existing `CombatActorRouter` and own ordinary `CombatDirector` instances. Player melee controllers continue using their current physical sweeps and `WeaponContactRouter`; no second raycast or distance-damage path exists. NPC attacks remain Forge-authored animation -> animated weapon capsule -> `PhysicalAttackSource` -> the one player receiver.

`Game` now creates one `PlayerCombatDamageReceiver` for every active game session, not only Creature Lab. It remains an adapter around the sole `PlayerCombatState`, rebinds to the replacement `PlayerController` on scene transitions, and clears only stale attack-identity ownership during rebind. Creature Lab obtains this same receiver through the player binding and does not create another HP authority or receiver.

`EncounterRuntimeHost` owns active encounter runtimes for the current location. It borrows an existing scene combat physics/router host when one exists (including Folsom) and otherwise creates production-neutral session combat infrastructure. Borrowed infrastructure is advanced by its existing fixed-step owner, so weapon, director, actor, and physics updates are not duplicated. The host disposes encounters before the scene's combat world is released and is a no-op for an empty location.

## Reward composition

Runtime reward input has one priority:

```text
Encounter rewardOverride.gold
            OR
Enemy Preset default Loot Profile
             -> immutable runtime reward configuration
             -> EnemyLootRuntime
```

An encounter override creates an unregistered, immutable runtime configuration; it does not mutate `LootProfileRegistry` and does not invent a permanent Loot Profile. A positive fixed override can supply reward even when the preset has no default profile. Without either source, no loot container or zero-gold prompt exists. Authoritative actor death, one-time range resolution, wallet-transaction atomicity, and exactly-once claim remain owned by `EnemyLootRuntime`.

## Explicit M9 proof

In a development build, open `?area=folsom&m9EncounterProof=1`. The touch-first **M9 ENCOUNTER PROOF** panel provides:

- Spawn Encounter Proof
- Reset Encounter
- Despawn Encounter
- Reset Player
- Claim Available Gold

The explicit fixture creates two independent `dread_ram_god_great_mace` instances with different spawn IDs, transforms, yaw/home tuning, actor identities, brains, armaments, and loot runtimes. The second individual uses a fixed 27-gold override. The panel reports encounter/spawn/live/dead counts plus per-enemy spawn ID, preset, actor ID, brain/home diagnostics, life, loot, and resolved gold. Enabling this proof suppresses the older Folsom walker proof for isolation. No proof record enters the production registry.

## Persistence and M9.5

M9 does not persist individual death, resolved random reward, claim state, corpse state, current HP, or encounter completion. Those remain future persistence concerns keyed by `spawnId`.

M9.5 must author this exact `dreadstone.encounter_definition.v1` contract. It may hold unsaved local drafts in localStorage, but a draft is not checked-in production authority. Save/Export must emit `serializeEncounterDefinition()` output; an editor-only spawn schema is forbidden.

The public boundaries are sufficient for M9.5 to list presets from `EnemyPresetRegistry`, resolve a preset and create a visual-only preview through `EnemyPresetResolver` plus `CreatureFactory` without invoking `EncounterSpawner`, edit plain spawn records, validate/serialize them, test through `EncounterRuntimeHost.spawnDefinition()`, reset through `EncounterRuntime.reset()`, and dispose without reaching into actor internals.
