# Equipment Runtime Notes

First-person viewport arm, hand, and weapon overlays have been removed from the game. Equipment still drives combat, harvesting, fishing, inventory, objectives, and offhand torch lighting through the shared equipment runtime, but it no longer owns any FPV sprite or DOM overlay renderer.

## Current responsibilities

- `EquipmentSlot.js` defines equipment slot ids used by gameplay systems.
- Weapon profiles still provide combat and interaction metadata such as damage, range, stamina cost, cooldown, gore profile, and hit reaction type.
- Offhand torch equip state still controls the player torch light in `Game.js`.
- UI equipment buttons and inventory flows remain independent from first-person viewport art.

## Removed viewport overlay rule

Do not reintroduce player arm or hand sprites, idle hand strips, attack hand strips, fishing hand overlays, or hidden fallback assets. Future visible held-item work should be designed as a separate item model system with its own authoring rules and validation, not as player-arm sprites.
