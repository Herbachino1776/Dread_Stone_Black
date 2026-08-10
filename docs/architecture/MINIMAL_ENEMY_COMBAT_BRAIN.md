# Minimal enemy combat brain

Milestone 7 proves one autonomous armed enemy in Creature Lab without adding a
canonical encounter or a broad AI framework.

## Runtime chain

```text
EnemyPresetResolver
  -> resolved Creature body + loadout + immutable weapon calibration
  -> Creature actor
  + MinimalCombatBrain
  + NpcArmamentRuntime
  -> real Forge offensive Action
  -> real animated weapon capsule
  -> PhysicalAttackSource
  -> PlayerCombatDamageReceiver
  -> PlayerCombatState
  -> HP / death / HUD / living-player input gate
```

`MinimalCombatBrain` decides only target validity, direct open-space approach,
pre-commit facing, attack request timing, recovery, reevaluation, and bounded
return home. It calls `equip()`, `selectOffensiveAction()`, `triggerAttack()`,
and `update()` on the existing `NpcArmamentRuntime`. It contains no HP mutation,
weapon rotation, collision, animation-phase calculation, or Forge capability
invention.

## State machine

```text
IDLE -> ACQUIRE -> APPROACH -> READY -> COMMIT_ATTACK -> ATTACKING
  -> RECOVERY -> REEVALUATE
  -> APPROACH / READY / RETURN_HOME / IDLE
```

The target is valid only while the authoritative player state is alive, player
spatial data is finite, and the creature actor remains alive/usable. A committed
attack may finish visually after the player dies, but no later attack is
requested. Enemy death/disposal stops the brain and clears armament resources.

## Range and movement

M7 uses direct horizontal movement supplied by its host. Attack range is derived
from resolved weapon capsule extent/scale plus a bounded body-height reach
contribution. Brain tuning remains separate from Forge Action metadata and
Enemy Preset v1. Movement stops before attack and respects a minimum
player/enemy separation.

Creature Lab adapts this through the existing walker collision/ground support
without making that Lab walker part of the reusable brain contract. While the
brain is active, it owns locomotion animation so the older walker cannot fight
its walk/idle or facing decisions.

## Commitment and physical miss

Before the authored commitment time, the brain may continue facing the living
target. When `commitment.timeSeconds` is reached and
`lockOrientationThroughActive` is true, the actor yaw is captured and held
through the strike. The animated mace therefore sweeps through committed world
space. Player movement after commitment can produce a real physical miss;
distance never applies damage.

## Home/leash and Creature Lab proof

The host supplies one home position/yaw. Leaving the bounded engagement/home
area stops pursuit, returns the actor without teleportation, restores home yaw,
and settles to idle. Creature Lab exposes touch controls to enable/disable the
brain, reset the player, and reset/respawn the enemy, plus concise brain,
distance, armament, Action, phase/outcome, and authoritative player-life
diagnostics. Manual armament controls are disabled while autonomous ownership is
active.

M7 deliberately adds no encounter placement, navmesh, patrol, perception
simulation, factions, group attack slots, loot, economy, or persistence.
