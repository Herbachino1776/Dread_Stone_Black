# Loot and economy kernel

Milestone 8 adds the first game-owned reward and currency path beneath the
existing M7 combat proof. It does not add shops, items, rarity, physical coin
pickups, encounter placement, spawn IDs, or per-corpse persistence.

## Ownership chain

```text
Creature Pack
  Forge-derived technical body capability
        ->
Creature Definition
  base gameplay/body archetype
        ->
Enemy Preset v1 or v2
  reusable production-tuned variant
  v2 may reference one default Loot Profile
        ->
Encounter Spawn Record (M9)
  one placed individual and deliberate per-instance overrides
```

The reward path is separate from combat:

```text
authoritative actor lifeState reaches dead
        ->
EnemyLootRuntime resolves one reward once
        ->
one logical LootContainerState
        ->
claim once
        ->
PlayerCurrencyState
        ->
GameState persistence adapter in the normal game
```

Enemy Preset owns the default reward profile.
An M9 Encounter Spawn Record may override one individual with fixed positive gold.
The runtime loot container owns the resolved unclaimed reward.
PlayerCurrencyState owns the player's actual gold.
GameState persists the wallet but is not the runtime wallet.

No gold is stored in Creature Packs, Creature Definitions, weapon/loadout
records, `MinimalCombatBrain`, `NpcArmamentRuntime`, or
`PhysicalAttackSource`.

## Player currency authority and persistence

`PlayerCurrencyState` is the sole mutable player-gold authority for one game
session. It validates non-negative safe integers, performs atomic add and spend
transactions, rejects unaffordable or overflowing mutations without partial
changes, exposes immutable subscription snapshots, and retains bounded
transaction diagnostics. Zero-value add/spend calls are accepted no-ops and do
not emit a mutation event.

Normal play uses `GameStateCurrencyPersistenceAdapter`. `GameState` reads and
writes only this durable record:

```json
{
  "version": 1,
  "gold": 123
}
```

The storage key is `dreadStoneBlack.currencyState.v1`. Malformed, negative,
fractional, unsafe, extra-field, or unknown-version records repair to zero.
`GameState.resetAllProgress()` clears the key through the existing
`dreadStoneBlack.*` reset boundary.

Persistence is attempted before the in-memory mutation is committed. A failed
adapter write therefore leaves the wallet and an attempted loot claim
unchanged.

Explicit Creature Lab sessions use the same `PlayerCurrencyState` class with a
`SessionCurrencyPersistenceAdapter`. That adapter accepts session transactions
without retaining a second balance or writing `GameState`/localStorage. The Lab
therefore begins at isolated zero gold and cannot contaminate normal saved
currency.

## Loot Profile v1

`dreadstone.loot_profile.v1` is a strict, gold-only production contract:

```text
schema, version
lootProfileId, displayName
currency
  gold
    FIXED: amount
    RANGE: min, max
```

All amounts are non-negative safe integers. Unknown modes, fields, item arrays,
rarity, malformed IDs, fractional/negative/unsafe values, and reversed ranges
fail validation. `LootProfileRegistry` clones and deep-freezes registered
records, rejects duplicate IDs, and fails closed on unknown IDs.

The first production record is `dread_ram_god_standard`, currently a
provisional fixed 12 gold. That amount is production tuning for the proof, not
an architectural economy constant.

## Enemy Preset versioning

`dreadstone.enemy_preset.v1` remains valid and unchanged in meaning. It cannot
contain `rewards`; resolution produces `lootProfile: null`.

`dreadstone.enemy_preset.v2` adds only this optional strict record:

```text
rewards
  lootProfileId
```

`EnemyPresetResolver` resolves that stable ID through `LootProfileRegistry` and
returns the immutable profile without rolling currency. Unknown profile IDs
fail preset resolution. The production `dread_ram_god_great_mace` preset moved
to v2 with `dread_ram_god_standard`; its 2.1 m height, mace loadout, 1.41 asset
scale, grip, quaternion, and attack capsule remain unchanged.

Creature Lab's Enemy Preset JSON calibration export preserves the selected
preset version and reward reference while changing only its existing
presentation/weapon calibration fields.

## Death, resolution, and claim law

The existing humanoid actor does not publish a separate death event.
`EnemyLootRuntime` therefore observes the authoritative actor `lifeState`
transition and acts only when it is `dead`. It does not inspect damage or kill
the actor. The runtime marks resolution attempted before rolling, so repeated
dead-state updates, UI inspection, or diagnostics cannot create or reroll a
container.

RANGE resolution receives one injectable random source call per actor reward
container and selects an inclusive integer between `min` and `max`. FIXED uses
the authored amount directly.

Claim delegates to `PlayerCurrencyState.addGold()`. Only an accepted wallet
transaction marks the container claimed. A failed wallet transaction leaves it
available, and all later attempts after a successful claim reject without
crediting gold again. Runtime disposal disables further claims. A respawn/new
actor receives a new independent `EnemyLootRuntime`.

An enemy with no resolved Loot Profile never creates a logical container,
zero-gold prompt, or pickup.

## Creature Lab proof

The touch-first Lab panel displays Enemy Preset, Loot Profile, Resolved Gold,
Loot State, and Player Gold. `TAKE GOLD` remains disabled until the current
actor is authoritatively dead and its reward is available. Claim updates the
session wallet immediately; subsequent attempts cannot pay again. Respawn
starts an independent unavailable runtime for the new actor.

The optional general HUD gold label is deferred. The existing five-column
mobile status row plus three-button toolbar is already width-constrained, so M8
keeps the canonical visible proof in Creature Lab instead of compressing the
shipping phone HUD for a feature not yet exposed by a canonical encounter.

## Future persistence boundary

M8 persists player gold.

M8 deliberately does not persist individual corpse/loot state because stable
Encounter spawn IDs do not exist until M9. A later placed-enemy persistence
milestone may own records such as `spawnId.dead`, `spawnId.lootClaimed`, and
`spawnId.resolvedGold`; those records must not turn GameState into a competing
runtime wallet.

M9 now consumes the intended flow as:

```text
Encounter Spawn Record
  spawnId, transform, facing, home radius
        -> immutable runtime reward configuration ->
EnemyPresetResolver default Loot Profile
        ->
optional deliberate instance reward override
        ->
EnemyLootRuntime
        ->
resolved corpse reward
        ->
PlayerCurrencyState
```

Focused coverage runs with:

```powershell
npm run validate:m8-loot-economy
```
