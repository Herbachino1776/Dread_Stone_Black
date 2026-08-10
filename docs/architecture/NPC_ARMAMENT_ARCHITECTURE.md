# NPC armament architecture

Milestone 6 establishes animated armed-creature execution without adding AI,
loot, economy, or permanent weapons to Creature Definitions.

## Authority boundaries

Animation Forge defines where and how a body can carry and animate an attack.
Its Complete Damage technical output supplies:

- `dreadstone.attachment_sockets.v1`: stable socket ID, semantic hand role,
  real `DSB_DAMAGE_RIG` parent bone, and bone-local position/quaternion;
- `dreadstone.offensive_action.v1`: approved runtime Action name, stable combat
  ID, compatible weapon classes, socket role, clip duration, commitment, and
  exact WINDUP / ACTIVE / RECOVERY intervals in seconds.

The game defines what weapon is equipped and how dangerous it is. A
`dreadstone.npc_weapon.v1` record owns the world-visual factory, weapon class,
compatible hand roles, local grip, weapon-local attack capsule, damage, damage
type, impact strength, and reach category. It contains no rarity, value, loot,
or shop data.

`dreadstone.npc_loadout.v1` selects one main-hand weapon plus compatible combat
Action IDs for a particular combatant. The same Creature Pack and Creature
Definition can therefore be instantiated with different loadouts. Weapon IDs
do not enter Forge output, and specific equipped weapons do not enter Creature
Definitions.

## Runtime path

```text
Creature Pack attachment + offensive capability
  -> NPC Weapon Definition + NPC Loadout
  -> RuntimeAttachmentSocketResolver
  -> animated DSB_DAMAGE_RIG hand bone + authored local socket
  -> NpcArmamentRuntime
  -> weapon-local capsule transformed to previous/current world capsules
  -> M5 PhysicalAttackSource
  -> PlayerCombatDamageReceiver
```

The socket resolver finds the runtime bone once after the visual adapter is
ready, parents a socket frame to it, applies the Forge transform, and attaches
the game-owned world weapon. There is no per-frame scene search and no fallback
to actor root, chest, or a guessed hand. Equipment size is kept in game meters
even when the imported body uses a presentation scale. Disposal removes the
frame, weapon visual, diagnostics, and cached references.

`NpcArmamentRuntime` is an execution component, not an AI controller. Creature
Lab manually chooses an Action and triggers it. The runtime samples the actual
animation Action time, maps that time through the Forge intervals, updates the
animated weapon capsule every frame, and calls `PhysicalAttackSource.tryHit`
only during ACTIVE. WINDUP and RECOVERY still update geometry but cannot apply
damage. Physical intersection decides whether the player is actually hit, and
M5 continues to enforce one accepted hit per attack identity.

Commitment is captured once when playback begins. Player movement can turn a
committed swing into a miss; the runtime never turrets the attack toward a
moving target. `PhysicalAttackSource` remains source-neutral so future jaws,
claws, horns, or fists can use the same downstream path without pretending to
be equipped weapons.

## Compatibility and Creature Lab

Old Creature Packs remain valid. Import normalizes absent metadata to explicit
`available: false` attachment/offensive records and diagnostics; it never
manufactures production offsets or timing. Chezwick, Dreadguard, and Dread Ram
God therefore require new Forge exports before live animated-armament testing.

Creature Lab exposes touch-first Equip/Unequip, compatible Action selection,
Trigger Attack, Reset Player, and Show/Hide Attack Geometry controls. Its
readout includes weapon, socket, parent bone, Action/combat ID, phase, clip
time, all phase bounds, attack identity, world capsule, hit/miss, player HP,
and the last rejection. Canonical Folsom remains unchanged because the harness
exists only behind explicit Creature Lab mode.
