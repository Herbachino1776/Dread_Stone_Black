# Enemy Preset architecture

Milestone 6.7 adds the reusable production-tuning layer between a Creature Definition and a placed encounter individual. M9 now supplies that placed-individual contract and runtime.

```text
Creature Pack
  technical body/export capability
        ↓
Creature Definition
  gameplay and body archetype
        ↓
Enemy Preset
  reusable production-tuned variant
        ↓
Encounter Spawn Record (M9)
  placed individual
```

**A preset is reusable production tuning. An encounter instance is a placed individual.**

M6.7 did not add encounter placement, spawning, AI, health/death behavior,
gold, loot, shops, persistence, or save-game state. M8 now versions the preset
contract narrowly so a v2 preset may reference one default Loot Profile; see
[LOOT_ECONOMY_KERNEL.md](LOOT_ECONOMY_KERNEL.md).

M7 consumes the unchanged v1 preset through the first minimal combat brain.
Detection, approach speed, recovery delay, attack-range composition, and leash
remain runtime brain configuration; no AI or placement fields were added to the
preset. Creature Lab supplies temporary home position/yaw, while a future
Encounter Instance remains the intended owner of placement and home radius.

## Authority boundaries

The layers remain separate:

- Animation Forge owns the body's authored sockets and offensive Action capability, including action timing and compatible weapon classes.
- Creature Pack owns validated technical body/export truth and repository asset paths.
- Creature Definition owns the base gameplay/body archetype and its ordinary presentation policy.
- `NpcWeapon` owns canonical weapon identity, asset, class, stats, base grip, base uniform scale, and base attack capsule.
- `NpcLoadout` owns a game-authored main-hand weapon reference and the offensive Action IDs that loadout permits. Forge capability filtering remains authoritative.
- Enemy Preset owns one reusable variant's target height, loadout selection,
  optional character-specific weapon calibration, and in v2 one default Loot
  Profile reference.
- An Encounter Spawn Record owns placement, facing, home radius, stable authored identity, and the narrow fixed-gold individual override.

Enemy Presets never contain Forge technical records, Creature Pack paths,
bones, socket transforms, Action phase timing, weapon asset paths, weapon
damage, AI, raw gold/currency values, resolved loot, encounter coordinates, or
persistence state.

## `dreadstone.enemy_preset.v1`

The strict contract is validated by `src/contracts/EnemyPreset.js`.

```text
schema, version
presetId, displayName, creatureDefinitionId
presentation
  targetHeight
armament
  loadoutId
  weaponOverride (optional)
    assetScale
    gripTransform
      position
      quaternion
    attackCapsule
      start
      end
      radius
```

`EnemyPresetRegistry` validates, clones, deep-freezes, and rejects duplicate records. The first production record is:

```text
dread_ram_god_great_mace
Dread Ram God — Great Mace
  -> dread_ram_god
  -> humanoid_dreadstone_mace_main_hand
  -> dreadstone_mace
  -> humanoid_one_hand_overhead
  -> MAIN_HAND_R
```

Its production calibration was promoted from Creature Lab at 2.1 m target height, 1.41 uniform mace scale, and grip position `[0.005, 0.085, -0.015]`. The Creature Definition remains at its base 1.7 m height, and the canonical mace remains unchanged.

## `dreadstone.enemy_preset.v2`

M8 preserves v1 compatibility and adds only an optional strict
`rewards.lootProfileId` reference in v2. A v1 record remains reward-free and is
never inferred or migrated at runtime. `dread_ram_god_great_mace` is now the
first production v2 record and references `dread_ram_god_standard`; every
existing presentation and armament calibration value is unchanged.

The resolver resolves the referenced profile through `LootProfileRegistry` and
returns it immutably as `lootProfile`. A missing reference fails closed. The
resolver never rolls gold; runtime reward resolution belongs to the actor-bound
`EnemyLootRuntime` after authoritative death.

## Resolution and failure behavior

`EnemyPresetResolver` performs one explicit fail-closed resolution:

```text
presetId
  -> validated Enemy Preset
  -> Creature Definition
  -> Creature Pack
  -> composed humanoid runtime profile
  -> shared production height composition
  -> registered NPC Loadout
  -> canonical NPC weapon
  -> new immutable preset-resolved weapon
  -> Forge-compatible offensive Actions
  -> required authored attachment socket
```

Unknown definitions, packs, loadouts, weapons, incompatible Action capability, unavailable hand sockets, invalid target heights, and invalid weapon overrides are reported rather than hidden or guessed.

The canonical weapon registry object is never mutated. Preset resolution clones the canonical weapon and replaces only uniform `assetScale`, `gripTransform`, and `attackCapsule`. Identity, asset path, class, socket roles, damage, damage type, impact strength, and reach remain canonical.

The runtime transform law remains:

```text
animated hand bone
  -> Forge socket
  -> preset-resolved grip transform
  -> uniform asset scale below the grip transform
  -> real weapon GLB
```

Grip translation therefore does not change when asset scale changes. Capsule endpoints pass through the same asset-scale frame as the GLB, and capsule radius is multiplied by the same uniform scalar.

## Production height composition

`CreaturePresentationResolution.js` is the neutral shared humanoid presentation-height helper. Both Enemy Preset resolution and Creature Lab use it. It creates a new runtime profile with the requested `targetHeight`; it does not scale arbitrary scene roots, edit bones, use non-uniform scaling, or mutate the Creature Definition.

The established visual adapter presentation path still applies that target height, preserving rig, socket, damage-site, collision-profile, and weapon-attachment alignment assumptions.

## Production loadouts

`NpcLoadoutRegistry` resolves stable production-neutral loadout IDs. Canonical records use `mainHandWeaponId` and `allowedOffensiveActionIds`. The former Creature-Lab-named exports remain API aliases to the same production records so existing Lab and test callers continue to work without a second loadout authority.

Loadout permission plus Forge body capability is authoritative. A loadout cannot manufacture an Action, socket, timing interval, or compatible weapon class that Forge did not export.

## Creature Lab calibration workflow

Creature Lab keeps its existing Creature Definition inspection workflow and adds an explicit Enemy Preset selector. Selecting `Dread Ram God — Great Mace` resolves the Ram God body, preset height, real Dreadstone Mace, preset weapon calibration, `MAIN_HAND_R`, and the real overhead Action.

Use the production calibration workflow:

1. Select `Dread Ram God — Great Mace`.
2. Tune height.
3. Tune weapon scale and grip.
4. Tune the attack capsule.
5. Trigger the real attack.
6. Reset or check preset defaults as needed.
7. Enter a stable preset ID and display name in **Enemy Preset Authoring**.
8. Use **SAVE PRESET TO PROJECT** (or copy the complete JSON as a fallback).

The panel labels the checked-in values as **PRODUCTION PRESET DEFAULTS** and the current browser values as a **LOCAL LAB DRAFT**. Any difference displays **UNSAVED LAB DRAFT**. **Reset to Preset Defaults** resets height, scale, grip, and capsule together without changing source files.

Selecting a different Lab weapon exits preset mode into the selected Creature
Definition's authoring workflow. The Lab creates a complete v2 preset from that
definition, the selected production loadout, height, grip, scale, and capsule.
The development save bridge validates the full Definition -> Pack -> Loadout ->
weapon -> Forge Action -> socket chain before transactionally writing
`src/game/creatures/presets/<presetId>.json`.

The production preset registry discovers those files automatically. Because
Encounter Authoring Mode reads that registry, a saved preset becomes an Enemy
Bank option after the development server reloads. The encounter installer reads
the same file-backed catalog, so project saves cannot reject a preset that only
the browser knew about.

## Local draft ownership and migration

Drafts use the versioned namespace:

```text
dreadstone.creature_lab.weapon_calibration.v2.<scope>.<contextId>.<weaponId>
```

Preset work uses `scope=preset` and definition-only work uses `scope=definition`. Consequently, two presets using `dreadstone_mace` cannot leak calibration into each other, and definition-only testing cannot overwrite preset drafts.

The old `dreadstone.creature_lab.weapon_calibration.v1.<weaponId>` namespace is intentionally not interpreted as preset production tuning. Existing v1 entries may remain in localStorage, but v2 starts from the checked-in preset or definition-scoped canonical defaults.

## Copy Enemy Preset JSON

The copy action emits the complete selected Enemy Preset version in canonical
field order using the current live Lab height, uniform asset scale, grip, and
capsule. For v2 it preserves the checked-in `rewards.lootProfileId`. Numbers are
rounded to stable eight-place precision. The grip quaternion is normalized and
uses a deterministic sign. The payload contains no localStorage keys or draft
metadata.

The formatted JSON is always visible in a selectable readout. If the Clipboard API is unavailable or permission is denied, the Lab focuses and selects that readout for touch-friendly manual copying. The browser never mutates the checked-in preset.

Focused coverage is in `tests/enemy-preset.test.mjs` and
`tests/creature-lab-authoring-workflow.test.mjs` and runs with:

```powershell
npm run validate:m67-enemy-presets
npm run validate:creature-authoring
```
