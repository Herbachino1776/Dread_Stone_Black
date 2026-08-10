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
`dreadstone.npc_weapon.v1` record owns the canonical game asset path, one
uniform asset scale, weapon class, compatible hand roles, local grip,
weapon-local attack capsule, damage, damage type, impact strength, and reach
category. It contains no rarity, value, loot, shop, NPC-only visual factory,
or player-viewmodel data. The same weapon identity can later be referenced by
world pickups, containers, drops, merchants, or player ownership.

`dreadstone.npc_loadout.v1` selects one main-hand weapon plus compatible combat
Action IDs for a particular combatant. The same Creature Pack and Creature
Definition can therefore be instantiated with different loadouts. Weapon IDs
do not enter Forge output, and specific equipped weapons do not enter Creature
Definitions.

## Runtime path

```text
Creature Pack attachment + offensive capability
  -> NPC Weapon Definition + NPC Loadout
  -> cached WorldWeaponGlbLoader source + fresh Object3D instance
  -> RuntimeAttachmentSocketResolver
  -> animated DSB_DAMAGE_RIG hand bone + authored local socket
  -> NpcArmamentRuntime
  -> weapon-local capsule transformed to previous/current world capsules
  -> M5 PhysicalAttackSource
  -> PlayerCombatDamageReceiver
```

`WorldWeaponGlbLoader` uses Three.js `GLTFLoader`, caches each parsed source GLB,
and creates a fresh Object3D tree with independently disposable geometry and
materials for every instance. Source textures remain shared until the loader
itself is disposed. A failed load names the exact asset path and is removed
from the cache so a later attempt can retry. The loader is world-item neutral
and has no first-person/viewmodel coupling.

The socket resolver finds the runtime bone once after the visual adapter is
ready and constructs this explicit transform stack:

```text
animated hand bone
  -> Forge-authored socket position/quaternion
  -> game weapon grip position/quaternion
  -> game weapon uniform assetScale
  -> cloned weapon GLB
```

Grip and scale use separate frames, so changing asset scale cannot scale grip
translation. The equipment frame cancels creature presentation scale, keeping
weapon measurements in game meters while the attachment still follows the
animated hand. Weapon-local capsule endpoints transform through the same
asset-scale frame, and its radius is multiplied by the same scalar. Disposal
removes all attachment frames and releases only the equipped instance; the
cached source remains reusable.

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

Creature Lab exposes the three production GLB weapons, Equip/Unequip, live
uniform scale, grip position, pitch/yaw/roll, attack-capsule endpoints/radius,
compatible Action selection, Trigger Attack, Reset Player, and Show/Hide Attack
Capsule controls. Calibration may persist only in the
`dreadstone.creature_lab.weapon_calibration.v1.*` localStorage namespace. Its
copy readout emits exactly `assetScale`, `gripTransform`, and `attackCapsule`
definition fields; neither it nor reset mutates a production weapon record.

The Lab also supports a nonpersistent uniform creature-height override by
copying the composed runtime profile with a temporary `targetHeight` and
cleanly rebuilding the actor. It uses the existing presentation-scale path,
restores an equipped weapon on the replacement hand/socket, and never mutates
the production Creature Definition, including Dread Ram God's 1.7 m value.

Diagnostics include weapon ID/GLB path/asset scale, socket and parent hand,
grip and current weapon world transforms, local and world capsules,
Action/combat ID, phase, clip time, phase bounds, attack identity, hit/miss,
player HP, and the last rejection. Canonical Folsom remains unchanged because
the harness exists only behind explicit Creature Lab mode.

## M6.6 production definitions

| Weapon ID | Asset | Class | Socket role |
| --- | --- | --- | --- |
| `dreadstone_mace` | `/assets/weapons/melee/dreadmacev001_mobile_1k.glb` | `ONE_HAND_BLUNT` | `MAIN_HAND_R` |
| `dreadstone_sword` | `/assets/weapons/melee/dreadstone_sword_v002.glb` | `ONE_HAND_BLADE` | `MAIN_HAND_R` |
| `old_work_knife` | `/assets/weapons/melee/old_work_knife_v004.glb` | `ONE_HAND_BLADE` | `MAIN_HAND_R` |

Initial damage, impact, grip, capsule, and scale values are temporary combat
calibration values rather than final balance. Forge Action metadata remains the
authority for class/socket compatibility; loadouts cannot force an incompatible
clip to resolve.
