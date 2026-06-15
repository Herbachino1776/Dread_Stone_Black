# Equipment and FPV Weapon Runtime

Dread Stone Black now has a small equipment foundation for the first real weapon loop: acquire a weapon, equip it, let combat read its profile, and let first-person visuals react to that equipped state.

## Runtime Anatomy

The equipment runtime lives in `src/engine/equipment/`.

- `EquipmentRuntime.js` owns inventory state, equipped slots, event listeners, current weapon lookup, and snapshot/load hooks.
- `EquipmentInventory.js` stores acquired item ids with light metadata.
- `EquipmentSlot.js` defines `weapon`, `armor`, and `quickItem` slot ids. Armor and quick item are placeholders for future systems.
- `EquipmentEvents.js` names pickup, equip, and attack events.
- `WeaponProfile.js` normalizes weapon profile data.
- `EquipmentDebug.js` keeps development logging behind `import.meta.env.DEV`.

The runtime is intentionally local and lightweight. It is not a full RPG inventory, encumbrance, item stat, or save system.

## Weapon Profiles

Game weapon data lives in `src/game/equipment/weaponProfiles.js`.

Each weapon profile includes:

- `id`
- `displayName`
- `description`
- `weaponType`
- `damage`
- `attackRange`
- `attackCooldown`
- optional timing placeholders such as `windupTime` and `recoveryTime`
- `staminaCost`
- `fpvProfileId`
- `goreProfileId`
- optional `hitReactionType`
- `tags`

Current profiles:

- `unarmed`: fast, weak, short range, and available from game start.
- `rusted_sword`: slower than unarmed, higher damage, longer range, and acquired from the Black Grass Temple chest.

## Combat Integration

`Combat` asks `EquipmentRuntime.getEquippedWeaponProfile()` when the player attacks. The attack payload sent to the dungeon now includes `damage`, `range`, `weaponId`, `weaponProfile`, `goreProfileId`, and `hitReactionType`.

Enemy AI was not redesigned. Sheep Demon, Neck Man, and Black Grass Temple faction enemies still own their behavior. They only read `attack.range` and `attack.damage` when resolving player hits.

## FPV Equipment Renderer

FPV equipment code lives in `src/game/fpv/`.

- `fpvWeaponProfiles.js` maps equipment weapon profiles to first-person visual profiles.
- `FPVEquipmentRenderer.js` listens for equipped weapon changes, keeps the existing unarmed arms strip active, and toggles a weapon layer.

`unarmed` uses the existing arms idle strip. `rusted_sword` currently uses a procedural DOM/CSS placeholder blade because no dedicated sword FPV strip exists under `public/assets/`. This keeps the hook visible without baking in a fake image asset assumption.

Future FPV strips can add states such as `idle`, `attack`, `spell`, `block`, `hurt`, and `item_use` to the FPV profile map without changing combat input.

## Pickup and Chest

Black Grass Temple now contains an authored rusted sword chest in `src/game/locations/blackGrassTemple.definition.js`.

The chest is a placeholder box prop in the Broken Offering Room, clear of the main corridor and faction spawn anchors. Its interaction has `type: "equipmentPickup"` and `itemId: "rusted_sword"`.

`Interactions` handles that interaction by acquiring the item, showing a confirmation hint/message, and leaving the item available in the equipment screen.

## Equipment UI

`src/game/equipment/EquipmentPanel.js` renders a compact, touch-friendly equipment screen.

Controls:

- `EQ` button on the action cluster.
- `E` or `Tab` on desktop.
- Close button inside the panel.

The panel shows the current weapon and available weapons. Selecting a row equips that weapon. There is no drag/drop, stat comparison grid, armor UI, or item sorting yet.

## Persistence Hook

`EquipmentRuntime.getSnapshot()` returns:

- acquired item ids
- equipped weapon id
- equipped armor id placeholder
- equipped quick item placeholder

`loadSnapshot()` accepts the same shape. `GameState` stores this snapshot in local storage so equipment survives the existing area page reloads. This is still a narrow hook rather than a full save/load system.

## Adding A Weapon

1. Add a weapon profile in `src/game/equipment/weaponProfiles.js`.
2. Add item metadata in `src/game/equipment/equipmentRegistry.js`.
3. Add an FPV profile in `src/game/fpv/fpvWeaponProfiles.js`.
4. Add a pickup/chest interaction that calls `equipmentPickup` with the item id.
5. Add a gore profile or reuse an existing one.

## Limitations And Future Work

- Armor, shields, spells, durability, item stats, and quick item use are placeholders.
- Equipment is serializable but not yet integrated with a full Save Game Runtime.
- Rusted sword FPV uses a procedural placeholder until a real first-person sword strip exists.
- Attack windup/recovery are profile data only; combat currently applies cooldown immediately.
