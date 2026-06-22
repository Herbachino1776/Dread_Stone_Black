# Equipment Runtime Notes

First-person viewport arm, hand, and weapon overlays have been removed from the game. Equipment still drives combat, harvesting, fishing, inventory, objectives, and offhand torch lighting through the shared equipment runtime, but it no longer owns any FPV sprite or DOM overlay renderer.

## Current responsibilities

- `EquipmentSlot.js` defines equipment slot ids used by gameplay systems.
- Weapon profiles still provide combat and interaction metadata such as damage, range, stamina cost, cooldown, gore profile, and hit reaction type.
- Offhand torch equip state still controls the player torch light in `Game.js`.
- UI equipment buttons and inventory flows remain independent from first-person viewport art.

## Removed viewport overlay rule

Do not reintroduce player arm or hand sprites, idle hand strips, attack hand strips, fishing hand overlays, or hidden fallback assets. Future visible held-item work should be designed as a separate item model system with its own authoring rules and validation, not as player-arm sprites.

## Broadsword A1 first-person weapon note

Broadsword A1 replaces the old rusted sword presentation while preserving the compatibility item id `rusted_sword` for saves, objectives, chest pickups, and combat balance. The first-person model is loaded from `/assets/models/weapons/weapon_broadsword_ritual_01.glb` through the Vite base-aware runtime URL.

The broadsword view is a camera-local GLB root with a named normalization group and tuning constants for rest pose, scale, spring lag, drag offsets, swing offsets, recovery, cooldown, hit-zone radius, release speed, and damage-window debug values. Touch input starts only from the projected sword/fallback weapon zone, tracks a short gesture history, classifies slash/thrust/horizontal intent, and queues the existing melee attack path on a valid release. The A attack button remains a fallback and also plays the procedural broadsword swing when the sword is equipped.

Fishing A1 / Rod A1 remains separate and should not be coupled to broadsword gestures; the fishing lock, casting, reeling, bite/fight/landing, cooking/eating, and rod physics are intentionally untouched by this weapon pass.
