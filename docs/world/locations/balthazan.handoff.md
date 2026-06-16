# Balthazan — DARB v2 City Blueprint Handoff

Balthazan is a new Sumerian-style canal city for Dread Stone Black. It should be treated as a real authored DARB v2/v2.3 location, not a dev chamber.

## Files

- `balthazan.definition.js`
- `balthazan.handoff.md`
- `balthazan_topdown.png`

## Core design

Balthazan is an ancient, mostly empty canal city built for giant guardians. It should feel quiet, monumental, and threatening. There are very few enemies, but they are twice-size Sheep Demon guardians.

## Main constraints

All primary architecture must support 2x sheep demons.

Targets:

```txt
main path width: 5.0–6.4
main arch width: 5.8–6.4
main arch height: 7.0–7.6
wall/ceiling height: 8.8–10.5
enemy scale: 2.0
```

If the runtime does not honor `scale: 2` or `userData.scaleMultiplier`, add support only for Balthazan guardian spawn anchors. Do not globally scale sheep demons.

## Zone list

1. Entry Court — giant gate, warning stela, return gate.
2. Processional Road — broad route into the city.
3. Canal Market Spine — canal, two bridges, sparse market remains.
4. West Bank / Collapsed Court — broken optional ruin area.
5. Raised Shrine Court — stairs, ramp, high terrace, altar, giant guardian.
6. Administrative Alley — black stone side route, obelisk, warning wall panel.

## DARB features used

- polygonFloors
- wallSegments
- doorGaps
- wallPropAnchors
- pathRibbons
- platforms
- ramps
- stairs
- bridges
- architecturalPrimitives
- canalWater
- lowWall
- railing
- curb
- arch
- doorFrame
- pillar
- brokenPillar
- altar
- stela
- obelisk
- wallPanel

## Enemy plan

Use very few enemies:

- `balthazan_giant_sheep_guardian_01`: market guardian, sheep_demon, scale 2
- `balthazan_giant_sheep_guardian_02`: shrine guardian, sheep_demon, scale 2
- `balthazan_giant_sheep_guardian_03`: optional/sleeping collapsed court guardian, sheep_demon, scale 2, not initial wave

No faction war yet. This is a quiet city with a few massive threats.

## Codex integration

Create/import:

```txt
src/game/locations/generated/balthazan.definition.js
```

Register in:

```txt
src/game/locations/locationRegistry.js
```

Add Reliquary Field entrance/return wiring in:

```txt
src/game/DungeonScene.js
src/game/locations/reliquaryField.definition.js
src/game/Game.js
```

Suggested field entrance:

```txt
x: 132
y: 1
z: 126
```

Prompt:

```txt
Enter Balthazan
```

Message:

```txt
The gates of Balthazan open.
```

Return spawn:

```txt
field_balthazan_return
```

## Place-making notes

This should not look like a dev test room.

Use fewer stronger landmarks:
- entry gate
- canal spine
- two bridges
- tall market arch
- raised shrine terrace
- altar
- warning panels
- obelisk/admin marker
- collapsed optional court

Do not scatter primitives randomly. Keep empty space for the giant guardians.

Lighting hierarchy:
- entry gold
- canal cold blue
- shrine warm orange
- admin subtle blue

## Manual QA

1. Reliquary Field loads.
2. Balthazan entrance is visible near Sumerian cluster.
3. `Enter Balthazan` works.
4. Entry Court renders.
5. Main route is broad and readable.
6. Canal water is visible.
7. Both bridges are walkable.
8. Shrine stairs are walkable.
9. Shrine ramp is walkable.
10. Player can stand on shrine high terrace.
11. Admin slanted ramp is walkable.
12. Player can stand on admin platform.
13. Return exit works.
14. Giant sheep demons spawn at 2x scale.
15. Giant sheep demons fit through main route and archways.
16. Enemy count remains low.
17. Black Grass Temple still loads.
18. Sumerian City Block v0 still loads.
19. Sumerian Sun Palace District v1 still loads.
20. V2 Canal Shrine still loads.

## Known limitations

- Market stalls are composed from low walls, not a dedicated marketStall primitive.
- Giant enemy scale may require runtime spawn support.
- Giant enemy pathing may need a follow-up pass.
- This pack designs the city and implementation handoff; final in-browser QA still required.
