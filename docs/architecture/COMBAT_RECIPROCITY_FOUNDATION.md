# Combat Reciprocity Foundation

Milestone 7 moves player combat HP/death into the game-owned
`PlayerCombatState` and adds the first autonomous consumer of the surviving
physical-hit chain. `PlayerCombatDamageReceiver` is now only the physical
impact adapter and attack-identity dedupe boundary. See
[MINIMAL_ENEMY_COMBAT_BRAIN.md](MINIMAL_ENEMY_COMBAT_BRAIN.md).

Milestone 6 superseded the temporary Creature Lab procedural swing with the
Forge-authored socket/offensive Action and game-owned NPC armament path. See
[NPC_ARMAMENT_ARCHITECTURE.md](NPC_ARMAMENT_ARCHITECTURE.md). The M5
`PhysicalAttackSource` and player receiver remain the downstream physical-hit
authority.

Milestone 5 proves hostile physical attack -> authoritative player damage -> player death only in `?creatureLab=1`. It does not add production attacks, offensive animation metadata, armament, AI, encounters, blocking, armor, stamina, loot, or canonical progression.

```text
Creature Lab trigger and deterministic pose driver
  -> PhysicalAttackSource
  -> swept world-space capsule contact
  -> PlayerCombatDamageReceiver
  -> HP / HUD flash / camera response / death gate
```

## Player combat-damage authority

The inspected runtime previously had a static 100 HP HUD, `Hud.flashDamage`, bounded `Feedback.shake`, and `Game.isPlayerDead` movement gating, but no authoritative player HP mutation. `SurvivalHost.applyStarvationDamage` remains intentionally empty and is not a competing health model.

`PlayerCombatState` is the one game-owned combat HP/life authority. It owns
maximum/current HP, alive/dead state, damage application, the idempotent death
transition, dev reset/revive, and subscriptions for HUD/input/runtime consumers.
It is intentionally not saved in M7.

`PlayerCombatDamageReceiver` remains the explicit physical combat entry point.
M9 promotes one receiver into every normal game session and binds it to the
current `PlayerController`, while supplying the same game-owned
`PlayerCombatState` used by HUD and living-player gates. The receiver owns only
accepted attack identities, physical hurt-capsule resolution, impact
diagnostics, and accepted-hit feedback. An accepted impact contains:

- `source`
- `damageAmount`
- `damageType`
- `impactPoint`
- `impactDirection`
- `impactStrength`
- `attackIdentity`

It rejects invalid/non-finite data, missing identities, duplicate identities,
and impacts after death, then delegates accepted damage to
`PlayerCombatState.applyDamage()`. State subscriptions update the existing HP
HUD and living-player gate; the receiver retains damage flash and camera
response. Lethal damage stops player movement, ordinary action dispatch, and
held physical/combat-tool input while the lab continues rendering and updating.
`Reset Player` restores 100 HP/alive, clears receiver and source attack
ownership, resets held input authority, and calls the existing player spawn
reset. There is no second Creature Lab HP model.

The temporary lab attack deals 34 damage against 100 HP, so three clean hits kill. This tuning is centralized in `PLAYER_COMBAT_HEALTH` and `CREATURE_LAB_ATTACK_TUNING` and is not a progression-balance contract.

## Physical Attack Source contract

`PhysicalAttackSource` is source-neutral: its name and payload do not assume a sword. A later source may be a weapon, claw, horn, jaw, fist, or another physical part.

The runtime contract is:

1. `beginAttack(attackIdentity)` clears per-execution target ownership.
2. `setPhase(WINDUP | ACTIVE | RECOVERY | COMPLETE)` explicitly gates damage.
3. `updateShape({ start, end, radius })` supplies the previous/current world-space capsule representing the active physical part.
4. `tryHit({ targetId, hurtVolume, receiver, impactDirection })` performs swept contact and offers a finite impact to the receiver only on an ACTIVE intersection.

The source retains no decision-making, animation selection, AI, equipment inventory, or player-health policy.

## Sweep and contact rule

Contact uses the previous and current capsule shapes. The cheap mobile representation tests previous/current source segments, swept start/end/midpoint paths, and bounded interpolated cross-sections against the player's vertical hurt capsule. This catches fast between-frame crossings without mesh-vs-mesh collision or current-tip point sampling.

A geometric miss produces no receiver call and no HP change. WINDUP, RECOVERY, and COMPLETE reject contact even if the shapes overlap. The reported impact point is the closest point on the player hurt capsule, and all accepted impact vectors must be finite.

## Attack lifecycle and commitment

`PhysicalAttackLifecycle` exposes `WINDUP`, `ACTIVE`, `RECOVERY`, and `COMPLETE` with explicit phase progress and a stable attack identity. It is a deterministic M5 driver, not an Animation Forge schema.

The lab harness captures one world-space origin and forward/right attack basis when the trigger is accepted. The visible proxy then winds up and sweeps across that fixed basis. It does not rotate toward the player's later position during ACTIVE, so moving out after windup can make the committed attack miss.

## One hit per attack

`PhysicalAttackSource` records target IDs accepted for the current attack identity. One execution can therefore damage the player at most once even while the source overlaps for the entire ACTIVE interval. A new `beginAttack` clears source ownership and may hit again. The receiver also retains accepted identities as a defensive authority check.

Player reset, subject switch, lab respawn, and disposal clear stale ownership. Subject generation is included in lab attack identities, so a replacement Creature Definition cannot inherit an old execution.

## Creature Lab harness

`CreatureLabAttackHarness` is temporary proving infrastructure associated with the current Creature Factory actor. It builds one lightweight visible mace-like proxy, drives a deterministic committed horizontal arc, updates the real `PhysicalAttackSource`, and can show bounded line diagnostics for previous/current capsules, endpoint sweeps, midpoint sweep, and player hurt volume.

The touch-first Creature Lab panel adds:

- `Trigger Attack`
- `Reset Player`
- `Show/Hide Attack Geometry`
- live phase, attack ID, active state, hit/miss outcome, accepted hit count, HP/death, last impact point/direction, and rejection reason

Switching Creature Definitions keeps the existing Definition -> Pack -> Factory -> walker cleanup path and additionally clears/disposes the old attack subject before binding the replacement actor. Normal play does not construct the Lab harness, but it now owns the same player receiver required by production Encounter enemies.

## M6 consumption contract

M6 should replace only the lab trigger/timer/pose driver. Animation Forge attack metadata, NPC armament, or natural-attack runtime should consume the surviving contact boundary as follows:

```js
attackSource.beginAttack(stableExecutionId);

// Driven by authored clip/runtime state on every update:
attackSource.setPhase(authoredPhase);
attackSource.updateShape({
  start: previousAndCurrentPhysicalPartStart,
  end: previousAndCurrentPhysicalPartEnd,
  radius: authoredPhysicalPartRadius,
});

if (authoredPhase === 'ACTIVE') {
  attackSource.tryHit({
    targetId: 'player',
    hurtVolume: playerCombatDamageReceiver.getHurtVolume(),
    receiver: playerCombatDamageReceiver,
    impactDirection: physicalPartVelocityDirection,
  });
}
```

M6 must supply a stable execution identity, explicit phase changes, and actual previous/current world transforms from the equipped weapon or anatomical source. It must not call the receiver directly from an animation timestamp. The `CreatureLabAttackHarness` proxy and deterministic arc should then remain a lab regression tool or be removed; they must not become production NPC armament.

## Current limitations

- The player hurt volume is one vertical capsule; there is no body-part physiology.
- M6.6 removes the procedural proxy from the normal proof path. Real weapon
  GLBs are game-owned, while current checked-in creature packs still require a
  future Forge re-export before their socket/offensive capability is available.
- Player hit audio is deferred because the existing audited cues do not provide a clean, source-neutral hostile-player impact event. HP, flash, camera response, and death remain unmistakable without misusing flesh-stab or creature-death cues.
- Combat HP is active normal-session authority in M9. HP persistence and a canonical death/respawn policy remain deferred.
- Device-level iPhone touch, performance, and visual-readability acceptance remain manual hardware checks.
