# Black Grass Temple v0.2 Production Pass

## Design Goal

Black Grass Temple v0.2 turns the compiled dungeon slice into the first serious playable Dread Stone Black dungeon experience. The pass uses the existing dungeon authoring, torch lighting, objective, equipment, faction enemy, gore, and FPV weapon systems. It does not add a new quest engine, save system, combat rewrite, or deployment behavior.

The intended feel is a buried stone temple swallowed by black subterranean grass. The player should understand where they entered, find the rusted sword, see Sheep Demon and Neck Man conflict, survive a widening route through hostile ritual rooms, and still be able to return to the field.

## Playable Path

1. Enter from Reliquary Field through the west-edge temple mouth.
2. Descend through the Entry Threshold into the Descent Vestibule.
3. Read the paired vestibule torches and move into the Broken Offering Room.
4. Find the rusted sword chest in the southwest offering niche.
5. See or hear the first faction pressure from the West Shrine Nook and Rusted Gate Watch.
6. Push into the Black Grass Hall, a wider grass-floored combat and navigation space.
7. Reach the Warring Crossing, where the main Sheep Demon / Neck Man conflict is staged.
8. Continue through the Lower Rooted Room toward the Silent Altar Chamber.
9. Inspect the silent altar or sealed root gate, then return by the main route or the eastern return threshold.

The path is still dungeon-like, with branches and side rooms, but the torch pools, central landmarks, grass patches, and return corridor keep it legible.

## Room Identities

- R01 Entry Threshold: field-return and descent room, kept non-spawning so the player cannot be trapped immediately.
- R02 Descent Vestibule: first safe orientation space, identified by paired wall torches.
- R03 Broken Offering Room: rusted sword chest, broken slab, and offering stones.
- R04 West Shrine Nook: first Sheep Demon pressure branch, failed shrine stones, old blood.
- R05 Rusted Gate Watch: first Neck Man pressure branch, rusted gate, return landmark.
- R06 Black Grass Hall: broad grass-floored early combat hub.
- R07 Rooted Service Loop: west-side loop that reconnects to the main route.
- R08 Warring Crossing: primary faction combat chamber.
- R09 Sheep Demon Rookery: optional west threat pocket with pale bone markers.
- R10 Neck Man Bone Store: optional east threat pocket with low counter and bone marker.
- R11 Lower Rooted Room: pillar hall and survival route toward the altar.
- R12 Silent Altar Chamber: ritual endpoint for v0.2, black grass around the reliquary block.
- R13 Sealed Root Gate: future progression tease, sealed by black roots.
- R14A/R14B/R14C Return Threshold: readable eastern return route back toward the gate watch.

## Objective Sequence

- Arm Yourself starts when entering Black Grass Temple. It asks the player to find the Broken Offering Room, open the rusted sword chest, and equip the Rusted Sword.
- Blood the Blade starts after the Rusted Sword is equipped. It completes on a stable existing combat event against Sheep Demon or Neck Man.
- Enter the Deeper Grass Hall starts after the blade is blooded. It completes when the player reaches the Black Grass Hall or Warring Crossing.
- Touch the Silent Altar is optional. It starts when R12 is visited and completes when the existing silent altar inspect interaction is used.

No objective blocks exiting the temple. No objective depends on exact faction AI outcomes.

## Equipment And Chest Placement

The rusted sword chest remains the existing `equipmentPickup` interaction for `rusted_sword`. It moved to the southwest offering niche in R03, clear of the central doorway line and the early faction spawn paths. A strong south-wall torch and a black grass floor patch frame it visually.

The interaction still emits `chest_opened`, acquires `rusted_sword`, updates the chest state, and lets the equipment panel and FPV weapon renderer react through the existing equipment runtime.

## Faction Encounter Staging

The first safe orientation room no longer hosts faction spawns. The initial Sheep Demon and Neck Man anchors now sit in R04 and R05, creating a first branch conflict near the offering room instead of directly on top of the player.

Encounter zones were renamed and tuned around the v0.2 route:

- `early_branch_glimpse`: first faction activity around R03/R04/R05.
- `west_rooted_loop`: pressure through the west shrine and service loop.
- `black_grass_hall_pressure`: early combat pressure in R06.
- `warring_crossing`: main chaotic faction chamber across R08/R09/R10.
- `lower_rooted_room`: deeper pressure around R11/R12.
- `east_return_watch`: low-priority pressure near the return threshold.

Spawn anchors were pulled away from props, door centers, and player start spaces. The active count remains governed by the existing faction manager.

## Torch And Lighting Pass

The pass uses wall-anchored torch fixtures only. Important pools are placed at the entry threshold, vestibule, offering chest, west shrine, rusted gate watch, Black Grass Hall, Warring Crossing, Lower Rooted Room, Silent Altar Chamber, and the return threshold.

Ambient and directional fill were reduced so the dungeon does not read as fullbright. Stronger profiles are reserved for the chest, gate watch, Warring Crossing, and ritual rooms. The silent altar keeps a cold point fill as a non-torch ritual cue.

`npm run validate:bgt` currently reports zero torch placement warnings.

## Geometry And Collision Fixes

- R01 and R02 are marked non-spawning for safer entry/readability.
- Chest placement is clear of the central slab, branch doorways, and faction anchors.
- New storytelling props are non-colliding unless they correspond to existing solid blockers.
- Grass and blood floor overlays sit just above floor level to avoid z-fighting.
- The gate-watch torch was moved off the return doorway after validation caught it in the doorway center.
- The return-route torch was moved away from the D19 doorway clearance.
- Existing player exit trigger remains in R01 and keeps the route back to Reliquary Field available.

## Environmental Storytelling

The pass adds short, physical storytelling beats rather than long text:

- black grass creeping at the entry, chest niche, Warring Crossing, Lower Rooted Room, and silent altar
- empty offering stones around the broken slab
- a cracked west shrine and Neck Man scratch stone
- pale bone markers in side threat pockets
- old blood smears near faction pressure spaces
- concise inspect text at the chest, altar, gate, return mark, and sealed root gate

## Validation

Added `npm run validate:bgt`, which checks:

- dungeon authoring validation
- torch placement validation
- objective id/reference validation
- rusted sword chest interaction and prop presence
- `rusted_sword` item registry presence
- player start and field-return exit presence
- encounter-zone room references

Use it alongside the normal production checks:

```sh
npm.cmd run validate:bgt
npm.cmd run build
git diff --check
```

## Known Limitations

- Props are still procedural boxes using existing texture profiles.
- The rusted sword FPV visual is still the existing placeholder layer.
- There is no locked progression gate or boss endpoint in v0.2.
- Faction combat still depends on the current battle director and simple authored room graph.
- No browser/mobile smoke test was performed as part of this pass.

## v0.3 Follow-Ups

- Replace placeholder chest, altar, bones, roots, and ritual basin with authored meshes.
- Add distance-prioritized mobile torch budgeting.
- Add stable audio cues for the first branch fight and Warring Crossing.
- Add a deeper gate objective once gate logic has a safe authored unlock path.
- Add a small authored exit/shortcut reveal instead of the current always-available return threshold.
- Give R09 and R10 stronger faction-specific silhouettes once creature lair props exist.
