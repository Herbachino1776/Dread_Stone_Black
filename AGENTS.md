# AGENTS.md

Guidance for AI agents working in this repository.

## Project Identity

Dread Stone Black is a mobile-first, browser-playable first-person dungeon crawler built with Vite, Three.js, and plain JavaScript/TypeScript tooling.

This is not a tech demo. Treat it as a real game. The target feel is slow, physical, readable, ominous, and tactile. The player should feel like they are forcing a buried world to reveal what it has sealed away.

The original strategy guide is design reference, not an implementation specification. Current locks and the live game override older chapter checklists, room lists, map assumptions, Severing language, and old progression dependencies when they conflict.

## Read Order for Current Work

Before implementation work, read:

1. `docs/CURRENT_PRODUCTION_NOTE.md`
2. the active milestone document, currently `docs/current_milestone_folsom_growth.md`
3. `docs/ACTUAL_GAME_TRAJECTORY.md`
4. the relevant runtime and architecture documents for the system being changed
5. older strategy/blueprint documents only as supporting reference

`docs/CURRENT_PRODUCTION_NOTE.md` and the active milestone define the immediate production lock. `docs/ACTUAL_GAME_TRAJECTORY.md` defines the macro direction and how older strategy material should be interpreted.

## Current Direction

The implemented route has progressed through the rewritten Folsom Chapters 1-2 spine, Beneath Folsom, the explicit lower shrine hatch, the impossible White-Scab front threshold, and the separate under-shrine labyrinth bypass. The player now emerges behind the denied threshold at the current Chapter 3 production boundary.

The next world-production problem is not to reproduce the old Chapter 3 room checklist. It is to establish the live game's lower-shrine language behind that threshold: black covering or interference, Keeper's Lantern reveal information, physical tool action, exposed pale architecture, readable world response, and route progression.

Before multiplying those interactions, preserve and tune the physical-tool ergonomics already proven with the Old Work Knife, Wood Axe, and Iron Drain Bar, especially on phone controls.

Creature technology is now a proven production capability: Forge output -> Creature Pack -> Creature Definition -> Creature Factory -> current runtime actor. Extend creature architecture when a real production encounter requires it rather than automatically building speculative physiology, persistence, simulation-tier, non-humanoid, or broad AI frameworks.

## Core Design Laws

- Black growth/scab is physical obstruction: wet black plant fiber, oily scab, tarred root, burnt mycelium, covering, binding, feeding, or sealing something real. It is not currency, purple corruption, red gore, cartoon slime, magic smoke, or a generic black blob.
- Do not resurrect the old prescribed vertical/horizontal/diagonal/circular/V-cut Severing ladder as the core interaction model.
- Tools matter because they read and physically change the world.
- Tool-authored blockers advance from the correct held tool, gesture/contact quality, active tool part, authored stage, and prerequisite state. Interact/A is not their victory path.
- The Keeper's Lantern is a bounded reveal instrument for hidden glyphs, feeds, lines, stains, and structures. It is not merely a stronger Torch or a generic objective highlighter.
- Prefer environmental teaching, visible physical response, and persistent world-state change over tutorial prose.
- Route progress belongs in world state. Do not represent opened paths, cleared seals, map changes, or network access as permanent junk inventory.
- Do not add a map system merely because an old guide beat mentioned a map. Navigation should primarily come from authored space, landmarks, reveal information, lighting, sightlines, and persistent changes.
- White-system art should feel ancient, pale/white-marble, intricate, sacred, embedded, and impossible, not like generic sci-fi control panels.
- Bosses and later systems should prove existing mechanics rather than introduce unrelated feature piles.
- Never use raw Forge `siteId` strings as gameplay semantics.

## How to Work

Inspect before editing. Find the real runtime path from authored data to scene build to interaction/update/save behavior before making changes.

Prefer small playable proofs over broad unfinished scaffolds. A narrow real implementation is better than a large fake system that will be thrown away.

Do not invent unrelated features. If a task is about one Chapter 3 white-scab proof, do not also build a global white-machinery framework, Records UI, Memory UI, Pale Gates, creature physiology, persistence, or a full AI stack unless explicitly requested.

Use the repo's existing conventions and helpers when they are good. Replace weak placeholder architecture only when the task actually requires it.

Keep changes understandable for a solo developer. Plain, named modules are better than clever abstractions.

When adapting the old strategy guide, preserve useful purpose rather than obsolete implementation. Ask what emotion, realization, progression pressure, object, location, enemy, or story clue was valuable, then rebuild that purpose using the live game's current tool, reveal, scab, world-state, creature, and mobile interaction language.

## Gameplay and World Rules

Preserve working starter gameplay unless the task explicitly changes it. This includes movement, mobile controls, HUD, inventory/equipment, fishing, campfire/survival behavior, gates, saves, and location loading.

Folsom is the starter/root location and must remain reliable for repeated testing.

The current physical tool vocabulary is:

- Old Work Knife: fast physical cuts/slashes for thin growth, cords, films, seams, and exposed knots.
- Wood Axe: slower committed chops for hard, thick, or fire-hardened material.
- Iron Drain Bar: planted/socketed constrained lever prying.

Right-hand physical tools should preserve lower-right ready presentation, generous grip/handle capture, pointer ownership until release, and active-part world contact. Left-side movement and ordinary right-side look should remain available outside the tool grip interaction.

The current Chapter 3 entry truth is an impossible front White-Scab threshold plus a remote-release/backtrack/labyrinth bypass. The front seal does not open locally. Do not replace that route with the old direct guide entry.

## Creature Rules

The production creature authority chain is:

```text
Forge export
  -> Creature Pack
  -> Creature Definition
  -> Creature Factory
  -> current runtime actor
```

Creature Pack owns technical body/export truth. Creature Definition owns gameplay archetype and presentation decisions. Do not copy Forge technical truth into definitions.

Canonical Folsom may retain explicitly documented compatibility/legacy paths until a production encounter migration is requested. Do not broaden creature architecture simply to remove compatibility debt with no gameplay consumer.

## Asset Rules

Use exact asset paths and names when provided. Preserve transparent PNG alpha. Avoid white fringes, baked backgrounds, accidental borders, and oversized textures.

For black growth, preserve the established material language rather than introducing generic slime or fantasy corruption imagery.

For physical tools, preserve readable real-tool proportions. The Old Work Knife is a short worn work tool, not a sword or fantasy dagger. The Iron Drain Bar is a pry tool, not a weapon-shaped lever substitute.

Procedural/simple geometry remains acceptable for early playable proofs where scale, interaction, and feel are still being established.

## Performance Rules

This game targets mobile browsers. Keep scenes and effects lightweight.

Be careful with transparent planes, particles, decals, shadows, skinned meshes, animation mixers, large textures, dynamic lights, and unbounded effect accumulation. Pool or clean up short-lived effects.

Effects should feel punchy but cheap. Bounded reveal, oil bursts, impact response, and screen shake are appropriate; permanent particle or light spam is not.

## Testing

Run the narrowest relevant checks first, then the build for code changes.

Common commands include:

- `npm run validate:folsom`
- `npm run validate:combat`
- `npm run validate:creature-packs`
- `npm run build`

Run only the suites relevant to the change plus any required production gate. If validation fails, report whether the failure is caused by the change or by an existing stale expectation. Do not ignore failures.

Manual phone-scale checks matter for interaction work. Verify the actual held-tool grip, look/movement coexistence, active-part contact, misses, recoil/return, pry seating/release, route persistence, and readability on the current production path affected by the change.

Creature work should use the mobile Creature Lab when appropriate, but Creature Lab success is not a substitute for a real canonical encounter once production integration is the goal.

## Pull Request / Commit Expectations

Keep changes scoped to the requested milestone.

A good completion report should say:

- what changed
- why it supports the current production goal
- what files/systems were touched
- what was intentionally not changed
- what validation was run
- what manual checks remain
- what limitations or follow-ups remain

When unsure, protect the playable proof loop and the live trajectory. Make the smallest real thing that proves the game better.
