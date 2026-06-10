# Gore Runtime + Corpse Persistence System

## Purpose

The Gore Runtime makes combat leave readable physical evidence in the dungeon without adding expensive physics, mesh slicing, ragdolls, or heavy dependencies. It is built for dark fantasy mobile play: short-lived sprite bursts, cheap planar decals, simple wound cards, and budgeted corpse bookkeeping.

## Current Systems

- `GoreRuntime` coordinates events, particles, decals, wounds, corpse records, budgets, debug, cleanup, and disposal.
- `BloodParticlePool` preallocates sprite particles for hit bursts, mist, chunky flecks, and black-red vapor.
- `BloodDecalSystem` places transparent floor and wall planes for splats, pools, sprays, slash streaks, and future drag smears.
- `WoundAttachmentSystem` attaches optional wound planes to creature roots near the approximated impact point.
- `CorpseManager` records persistent corpses, death room, blood pool ids, collision mode, loot placeholder, and decay timing.
- `GoreBudgetManager` enforces mobile-safe global and per-room limits.
- `GoreDebug` is dev-only and uses F6 for visibility and F7 to clear gore in the current location.

## Gore Events

Combat code emits normalized gore event data through `createGoreEvent`. Events carry id, type, world position, direction/normal, source id, target id, creature id, weapon id, damage amount, hit strength, surface type, room id, timestamp, and tags. Current event types are `hit`, `heavy_hit`, `kill`, `corpse_decay`, and the placeholder `drag`.

When exact hit contact is unavailable, the integration uses attacker and target positions, places the impact near the target upper body, and projects death pools to the room floor.

## Particles

Particles are pooled `THREE.Sprite` objects. The pool is capped by budget, fades quickly, uses dark red/black-red procedural canvas textures, and applies only simple velocity plus gravity. Far-away events skip particle and wound work through distance culling.

## Decals

Floor decals are horizontal planes placed slightly above `floorY` to avoid z-fighting. Wall decals are vertical planes oriented from an approximate impact normal. Decals have global and per-room caps, random rotation/scale, timed fading, and oldest-first cleanup.

## Corpse Persistence

Corpse entries track creature id, species, optional faction id, position, yaw, room id, death time, visual root reference, blood pool ids, decay timer, collision mode, loot placeholder, and tags. For this foundation pass, existing dead models are left in place where the combat system already supports it. The manager records and trims corpses under budget, with simple removal hooks ready for future dragging or blockers.

## Profiles

Weapon profiles live in `src/game/gore/weaponGoreProfiles.js` and currently define `unarmed`, `sword`, `claw`, `blunt`, and `occult`. They tune burst type, counts, spray strength, decal type, wound type, blood tone, death pool scale, and corpse persistence weight.

Creature profiles live in `src/game/gore/sheepDemonGore.config.js` and `src/game/gore/neckManGore.config.js`. Sheep Demon uses heavier black-red splashes, larger pools, and chunky flecks. Neck Man uses thinner narrow sprays, slash smears, smaller pools, and pale/black wound overlays.

## Asset Strategy

This PR intentionally uses procedural canvas textures so the runtime is not blocked on art. Future art can be added under `public/assets/gore/particles`, `decals`, `wounds`, and `props`. Keep first-pass real assets transparent PNGs for billboards/decals and lightweight GLB props for authored static gore dressing.

## Integration

`DungeonScene` owns one `GoreRuntime`, updates it in the scene loop, and resolves room ids from the Dungeon Authoring Runtime when available. Player attacks and Black Grass Temple faction attacks return or emit gore metadata without changing combat balance or attack timing.

## Limitations

- No dismemberment.
- No mesh slicing.
- No ragdolls.
- No corpse dragging yet.
- Wall sprays use approximate normals until authored wall-hit data exists.
- Wound cards attach to creature roots, not skeleton bones.

## Future Work

- Dragged corpse trails and smear events.
- Boss-specific death variants.
- 3D chunk/prop placement from authored GLB assets.
- Skeletal hit zones for better wound placement.
- Room transition persistence rules backed by save data.

