# Sumerian Canal Market District v2

## Purpose

`Sumerian Canal Market District v2` (`sumerian-canal-market-district-v2`) is the first medium-small playable city district authored around DARB v2/v2.3 non-rectangular primitives rather than rectangular room blocks. It is an abandoned Sumerian canal market with a sacred trade road, canal-side shrine terrace, ruined administrative alley, and occult warning architecture.

## Entrance

- Field location: Reliquary Field southeast Sumerian entrance cluster.
- Entrance coordinates: `x: 110`, `y: 1`, `z: 128`.
- Prompt: `Enter Sumerian Canal Market`.
- Return spawn: `field_sumerian_canal_market_district_v2_return` at `x: 110`, `y: 1.55`, `z: 128`.

## Zones

1. `v2_market_entry_causeway` — entry path with arch, curbs, stelae, and warning architecture.
2. `v2_market_canal_spine` — main market lane beside dark canal water, low canal walls, railings, and stall ruins.
3. `v2_market_bridge_01` / `v2_market_bridge_02` — two crossable bridge decks over the canal.
4. `v2_market_shrine_terrace` — raised shrine platform with stairs, ramp, altar, obelisk, and pillars.
5. `v2_market_admin_alley` — narrow angled side route with wall panels and broken administrative masonry.
6. `v2_market_collapsed_court` — irregular ruined court with broken walls and fallen pillars.
7. Exit gate — door-frame threshold returning to Reliquary Field.

## DARB v2/v2.3 features used

- `polygonFloors`
- `wallSegments`
- `doorGaps`
- `pathRibbons`
- `platforms`
- `ramps`
- `stairs`
- `bridges`
- `architecturalPrimitives`
- `canalWater`, `lowWall`, `railing`, `curb`, `pillar`, `brokenPillar`, `arch`, `doorFrame`, `altar`, `stela`, `obelisk`, and `wallPanel`
- Walkable elevation surfaces for the shrine platform, ramp, stairs, and bridge decks
- Conservative invisible canal blockers split around bridge crossings

## Enemy scope

Architecture is the focus. The district only defines four conservative spawn anchors: two `sheep_demon` anchors and two `neck_man` anchors.

## Known limitations

- Canal water is a flat authored primitive, not a full water simulation.
- Primitive collisions remain intentionally approximate and lightweight.
- Bridge, stair, ramp, and platform traversal is validated by runtime walkable surfaces; final feel should be confirmed manually in browser.

## Manual test checklist

- Load Reliquary Field and confirm the new entrance is visible near the Sumerian cluster without blocking City Block v0 or Sun Palace.
- Confirm the prompt says `Enter Sumerian Canal Market` and entering loads the district.
- Confirm entry causeway, canal spine, canal water, low walls, both bridges, shrine terrace, administrative alley, and collapsed court render.
- Cross both bridges.
- Walk up the shrine stairs.
- Walk up the shrine ramp.
- Stand on the raised shrine terrace platform.
- Confirm wall panels, stelae, pillars, arches, altar, railings, curbs, and canal edges render.
- Confirm blocking walls, pillars, altar, and canal blockers prevent unintended traversal.
- Toggle debug overlay and inspect polygon floors, wall segments, door gaps, path ribbons, platforms, ramps, stairs, bridges, primitives, blockers, and spawn anchors.
- Use `Return to Reliquary Field` and confirm return at `x: 110`, `y: 1.55`, `z: 128`.
- Regression check Black Grass Temple, V2 Canal Shrine, Sumerian City Block v0, Sumerian Sun Palace District v1, HUD/inventory, mobile controls, fishing/cooking/hunger, and performance.
