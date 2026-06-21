# Dread Stone Black — Starter Town and Real Game World Blueprint

## 1. Purpose

Dread Stone Black is ready to begin shifting from a development-history world into a real, authored game world. Existing systems are mature enough to support a compact starter location that looks intentional, teaches core play through environment design, and becomes the future root of the game.

This document defines the design and implementation direction for that starter town. It is a planning blueprint only. It does not implement the town, change spawn routing, delete legacy locations, or alter gameplay code.

The current world should be treated as a valuable development timeline. Reliquary Field, OARB Feature Yard, Pond Expo, Kerovac, and other test-era areas should remain available for testing, reference, and historical continuity. They should no longer be the long-term primary player path once the new starter town exists.

The intended world relationship is:

- **New Starter Town**: future real game beginning and default player root.
- **Rusty Border Door**: intentional in-world access point to the old prototype timeline.
- **Reliquary Field**: preserved old-world / museum / legacy zone.
- **Old test locations**: preserved until intentionally archived, routed behind museum paths, or removed later with coverage.

## 2. Working Names

The final name can be chosen later. The first implementation may use a neutral technical identifier such as `starterTown` while the world fiction settles.

Possible display names:

- Rustgate Hamlet
- Hollowmere
- Old Mere Town
- Miregate
- Rustmere

Recommended implementation placeholder:

- **Area id**: `starterTown`
- **Display name**: `Starter Town`

## 3. Core Design Philosophy

The starter town should feel like the first real place in the game, not a tutorial room and not a sandbox test yard.

It should be:

- compact;
- readable;
- atmospheric;
- system-rich;
- intentionally authored;
- beautiful enough to represent the future direction of the game;
- practical enough to build with the current OARB and DARB tools;
- dense without becoming cluttered;
- useful for onboarding without heavy tutorial text.

Recommended scale:

- **160x160 to 220x220 world units**.

Avoid proposing or building an 800x800 starter field. The first real town should be small enough to finish, validate, and polish.

## 4. High-Level Concept

The starter town combines outdoor authored terrain with authored buildings and interiors:

```text
OARB outdoor terrain, ponds, paths, foliage, boulders, water layers
+
DARB buildings, huts, shrines, interiors, gates, courtyards, cellars
=
compact real starter world
```

The player should begin in a safe, readable courtyard and immediately see multiple meaningful destinations: pond, shrine, tool shed, first house, first dungeon entrance, rusty legacy door, and future road or stream exit.

## 5. Spatial Layout

Recommended high-level structure:

```text
                         [Future Stream / Road Exit]
                                   |
                                   |
          [Shrine / Open-Ceiling Temple] ---- [First Dungeon / Cellar Gate]
                    \                         /
                     \                       /
                      [Spawn Courtyard / Safe Center]
                       /        |           \
                      /         |            \
        [First House / Interior] |       [Rusty Border Door]
                                 |        to Reliquary Field
                                 |
                    [Tool Shed / Work Yard]
                                 |
                         [Fishing Pond / Reed Bank]
```

The plan should prioritize sightlines from spawn:

- a visible pond path;
- a visible shrine silhouette;
- a visible rusty border door;
- a visible dungeon entrance or blocked descent;
- a nearby campfire or cooking point;
- 2–4 readable building masses.

The player should understand, within seconds, that this is a town hub with several routes rather than an empty field.

## 6. Required Zones

### 6.1 Spawn Courtyard

Purpose:

- provide the first safe orientation space;
- establish the tone of the real game world;
- give the player a clear central landmark;
- let the player see multiple destinations without needing UI explanation.

Recommended contents:

- central well, broken fountain, or old stone basin;
- campfire nearby but not blocking the initial view;
- 2–4 readable buildings or ruined structures;
- one obvious pond path;
- one obvious shrine path;
- one visible rusty border door;
- one visible first dungeon entrance;
- possible friendly NPC location for a later pass.

Design notes:

- Spawn should not face clutter.
- The first view should read as “town hub.”
- Sightlines should pull the eye toward the pond, shrine, and rusty door.
- The courtyard should be safe, but not sterile.

### 6.2 Fishing Pond / Reed Bank

Purpose:

- provide the first real use of pond systems in the actual game world;
- teach fishing through play;
- support hunger and cooking loops;
- show water quality early without copying Pond Expo scale.

Recommended contents:

- one beautiful irregular pond;
- reeds and aquatic brush;
- partially submerged boulders;
- a fishable zone;
- a fishing rod chest nearby or in the tool shed;
- a small dock, plank edge, or muddy casting bank;
- clear path back to the campfire.

Pond doctrine:

```text
water → narrow bright mud → thin dark wet bank → grass
```

The pond should be simpler than Pond Expo but higher in authored quality. Its edges should look practical, walkable, and readable. Avoid placing water directly against grass without shoreline transition.

### 6.3 Tool Shed / Work Yard

Purpose:

- introduce practical survival tools;
- support axe, wood, flint, and campfire loops;
- provide the first useful semi-open structure.

Recommended contents:

- wood axe chest;
- wood pile, chop target, or nearby harvestable tree;
- flint stick chest if required by current survival flow;
- crates, barrels, and a workbench;
- small shed or open-roof hut built with DARB-style pieces;
- clear path to the campfire.

Design notes:

- Keep decoration functional and sparse.
- This is the survival loop corner, not a prop warehouse.
- The player should understand that tools found here are immediately useful.

### 6.4 Shrine / Open-Ceiling Temple

Purpose:

- establish sacred, ruined, or cosmic tone;
- prove DARB and OARB can coexist in a mixed outdoor location;
- provide a non-house landmark;
- foreshadow larger spiritual systems without needing those systems now.

Recommended contents:

- open-ceiling shrine or ruined temple;
- simple interior platform or covered stone floor;
- altar, stone plinth, or weathered ritual object;
- first lore inscription or interactable;
- torch chest or ritual item;
- optional locked sacred door for later.

Design notes:

- It should be beautiful but small.
- Do not build a giant temple yet.
- The structure should feel embedded in the outdoor terrain rather than pasted onto it.

### 6.5 First House / Interior

Purpose:

- prove the starter town can include ordinary buildings;
- introduce DARB interiors without abrupt world transition;
- provide a small narrative or loot space.

Possible forms:

- simple hut;
- ruined house;
- fisherman’s house;
- caretaker’s house;
- storehouse.

Recommended contents:

- readable doorway;
- small interior;
- one chest or interactable;
- possible note, book, or later NPC position;
- minimal furniture or storage props.

Design notes:

- Keep the interior small.
- Avoid maze complexity.
- Validate doors, walls, ceilings, floors, and collision before expanding interior count.

### 6.6 First Dungeon Entrance

Purpose:

- connect the starter town to the dungeon crawler identity;
- present a first “danger below town” route;
- foreshadow deeper game structure before fully building it.

Possible forms:

- sealed cellar;
- crypt stair;
- old aqueduct hatch;
- ruined well descent;
- shrine basement;
- tomb gate.

Recommended placeholder names:

- Town Cellar
- Old Mere Crypt
- Rustgate Underworks

The first dungeon itself should not be built as part of this blueprint. The town should reserve a clear entrance location that can later route into the first dungeon once its layout, enemies, loot, and progression are designed.

### 6.7 Rusty Border Door to Reliquary Field

This is a critical world-structure requirement.

Reliquary Field should become an intentionally preserved old-world zone behind a rusty door at the starter town border.

Purpose:

- preserve the current legacy and prototype timeline;
- keep old test locations accessible;
- stop making Reliquary Field the main game root;
- make the old world feel intentional instead of accidental.

Suggested interaction labels:

- `Open Rusted Field Door`
- `Enter the Old Reliquary Grounds`

Suggested fiction:

- a corroded iron door sits in an old town wall;
- beyond it are the old grounds;
- townsfolk avoid it, but it remains unlocked or lightly obstructed during development;
- the route acts as a museum/timeline path until old content is archived or removed.

Implementation notes for a future task:

- Do not delete Reliquary Field.
- Do not delete old test locations.
- Route Reliquary Field behind this door once `starterTown` becomes the real spawn.
- Keep the route visible enough for testers but not framed as the main forward path.

### 6.8 Future Stream / Road Exit

Purpose:

- reserve space for future wilderness expansion;
- prepare for stream and river logic;
- give the town a believable outbound route.

Stream doctrine:

```text
pond = closed basin
stream = semi-repeating linear gully / ribbon water feature
```

Future streams should use:

- meandering paths;
- repeated linear terrain stamps;
- muddy banks;
- reeds;
- boulders;
- fishable pools;
- small bridges or stepping stones;
- occasional road or footpath crossings.

Do not implement the stream until a future task requests it. The starter town should merely reserve the exit and avoid blocking the corridor with permanent structures.

## 7. OARB + DARB Mixed Location Doctrine

The starter town should become the first strong proof that outdoor terrain authoring and dungeon/building authoring can coexist in a single game-quality location.

### 7.1 OARB Responsibilities

OARB should own:

- terrain height;
- grass and ground materials;
- paths;
- ponds;
- streams;
- trees and foliage;
- boulders;
- outdoor props;
- water and shore systems;
- open-world walkability.

### 7.2 DARB Responsibilities

DARB should own:

- buildings;
- walls;
- floors;
- ceilings;
- roofs;
- huts;
- shrines;
- interiors;
- courtyards;
- gates;
- doors;
- enclosed or semi-enclosed spaces.

### 7.3 Mixed Examples

The first town should include or reserve patterns like:

- DARB hut sitting on OARB terrain;
- DARB shrine inside an OARB courtyard;
- OARB pond beside a DARB fisherman hut;
- DARB cellar entrance embedded in OARB ground;
- OARB stream running past a DARB bridge or ruin;
- DARB rusty door mounted into an OARB border wall or terrain edge.

The technical standard is not merely that both systems appear in the same area. The standard is that they meet cleanly: no floating buildings, no terrain clipping through floors, no doors detached from paths, no water layer hovering above banks, and no invisible collision surprises.

## 8. Starter Town Gameplay Loop

The intended first 10–20 minutes should be environmental onboarding, not a text-heavy tutorial.

Example sequence:

1. Player spawns in the courtyard.
2. Player sees the pond, shrine, tool shed, rusty door, and dungeon entrance.
3. Player opens the tool shed chest.
4. Player gets a fishing rod or axe.
5. Player walks to the pond.
6. Player catches a fish.
7. Player returns to the campfire.
8. Player cooks the fish.
9. Player eats the fish and learns the hunger loop.
10. Player finds a torch or first weapon.
11. Player enters the shrine or first house.
12. Player chooses between the first dungeon route and the rusty legacy door.

Guidelines:

- Prefer landmarks over tutorial popups.
- Prefer visible affordances over UI instructions.
- Keep first item pickups obvious.
- Keep dangerous routes visually distinct from safe routes.
- Let optional discovery exist, but do not hide the basic loop.

## 9. First-Pass Item Placement

Recommended first implementation placement:

| Item or Loop Object | Recommended Location | Purpose |
| --- | --- | --- |
| Fishing rod | Pond-side chest or tool shed chest | Begins fishing loop. |
| Wood axe | Tool shed | Supports wood and campfire loop. |
| Flint stick | Work yard or small chest | Supports fire-starting if required. |
| Torch | Shrine or first house | Prepares player for dark interiors. |
| First weapon | Near dungeon entrance or inside shrine | Signals danger route. |
| Campfire | Courtyard edge near pond path | Connects fish, cooking, and hunger. |
| Fishable pond species | Starter pond | Makes first water feature mechanically real. |

Placement should be readable from nearby paths. Do not hide required survival-loop items in obscure corners during the first pass.

## 10. Future 3D Held Item Direction

The starter town should not wait for first-person arms or held-item presentation. It can be built using current interaction systems.

Future held-item goals:

- 3D arms;
- 3D weapon presentation;
- 3D fishing rod presentation;
- believable first-person held poses;
- touch, drag, or flick casting for rod use;
- clearer tool feedback for axe, torch, and weapon states.

These goals should influence future polish but should not block the starter town implementation.

## 11. Technical Implementation Guidance for Future Work

Likely future files or areas of work:

- `src/game/locations/starterTown.definition.js`
- `src/game/locations/starterTown/`
- `src/engine/outdoor-authoring/`
- `src/engine/dungeon-authoring/`
- `src/game/DungeonScene.js`
- `scripts/validate-oarb-terrain-sampling.mjs`
- `scripts/validate-dungeon-integrity.mjs`

Recommended future area metadata:

```js
{
  id: 'starterTown',
  displayName: 'Starter Town'
}
```

Recommended eventual routing direction:

- Game starts in `starterTown`, not Reliquary Field.
- The rusty border door routes from `starterTown` to Reliquary Field.
- Existing development routes remain available through controlled gates, old-world paths, or development menus until intentionally retired.

This blueprint does not make those code changes.

## 12. Migration Strategy

### Phase 0 — Documentation

Create this blueprint and align future work around it.

Scope:

- documentation only;
- no spawn change;
- no routing change;
- no Reliquary Field deletion;
- no test location deletion.

### Phase 1 — Build `starterTown` as a Standalone Location

Build the new area alongside existing content.

Requirements:

- create the standalone starter town definition;
- include spawn courtyard, pond, tool shed, shrine, first house, dungeon entrance placeholder, rusty door placeholder, and future road/stream exit;
- preserve old locations;
- add access through a dev menu or temporary gate if needed.

### Phase 2 — Make `starterTown` the New Main Spawn

Once the town validates, make it the player’s default start.

Requirements:

- start player in the spawn courtyard;
- route the rusty door to Reliquary Field;
- ensure the player can still reach legacy content intentionally;
- keep fallback or dev access for testing.

### Phase 3 — Move Legacy Content Behind Museum / Old-World Routing

Reliquary Field becomes the old grounds. OARB Feature Yard, Pond Expo, Kerovac, and similar locations remain accessible through controlled gates, dev routes, or an in-world museum structure.

Requirements:

- make old content feel intentionally preserved;
- avoid making test yards part of the main player path;
- keep useful fixtures available for regression testing.

### Phase 4 — Archive or Remove Old Content Later

Only archive or remove old content after the starter town is stable.

Requirements:

- test coverage exists for systems previously validated by old areas;
- old routing dependencies are removed intentionally;
- any museum or chronicle content is explicitly selected, not left accidental;
- removals happen in focused PRs with clear risk review.

## 13. Future Validation Requirements

Future implementation PRs should validate at minimum:

- starter town has exactly one valid default spawn;
- all exits route correctly;
- rusty Reliquary door works;
- buildings do not float over terrain;
- DARB floors do not clip badly into OARB terrain;
- pond layers do not float;
- fishable pond has a valid species pool;
- shoreline follows water, bright mud, dark wet bank, grass ordering;
- chests are reachable;
- paths are walkable;
- first dungeon entrance is reachable;
- no invisible walls block intended routes;
- no water is painted directly on grass without bank transition;
- no missing textures or assets;
- mobile performance remains safe;
- build and existing validation scripts remain green.

Suggested validation commands for future code PRs:

```bash
git diff --check
npm run build
node scripts/validate-oarb-terrain-sampling.mjs
node scripts/validate-dungeon-integrity.mjs
```

For this docs-only blueprint PR, `git diff --check` and `npm run build` are sufficient unless repository changes require broader validation.

## 14. Non-Goals for This Blueprint

This document does not authorize the current PR to:

- implement the starter town;
- change gameplay code;
- change the default spawn location;
- modify Reliquary Field;
- modify OARB Outdoor Expo;
- modify Pond Expo;
- modify Kerovac;
- modify routing;
- modify mobile UI;
- modify Vite base path `/Dread_Stone_Black/`;
- delete old locations;
- add the first dungeon;
- add first-person arms or 3D held items.

## 15. Build Standard for the Future Town

The first implementation of the starter town should be judged by whether it feels like a real place that happens to teach systems, not by how many systems it contains.

A good first pass is:

- small;
- coherent;
- traversable;
- visually intentional;
- mechanically useful;
- easy to validate;
- able to become the future default start without embarrassing the project.

A poor first pass is:

- huge;
- scattered;
- overdecorated;
- dependent on tutorial text;
- full of test fixtures;
- visually indistinguishable from a feature expo;
- unsafe to route as the main game root.

The recommended target is a compact starter town that establishes Dread Stone Black’s real-world direction while preserving the project’s old-world timeline behind a rusty door.
