# Codex Grounding Guide

## Repository identity

Dread Stone Black is a mobile-first, browser-playable first-person dungeon crawler built with Vite, Three.js, and plain JavaScript/TypeScript tooling. Its target feel is slow, physical, readable, ominous, and tactile. The player forces a buried world to reveal what it has sealed away.

This is an original game, not a generic Three.js demo or a literal implementation of the old strategy guide. Older guides, audits, blueprints, first-PR plans, and test-dungeon plans describe design history and useful raw ideas, not automatic implementation requirements.

## Source of current direction

Read these before implementation work:

1. `AGENTS.md`
2. `docs/CURRENT_PRODUCTION_NOTE.md`
3. the active milestone document, currently `docs/current_milestone_folsom_growth.md`
4. `docs/ACTUAL_GAME_TRAJECTORY.md`
5. the relevant runtime/architecture documents for the system being changed
6. longer strategy, architecture, and blueprint documents only as supporting reference

The immediate production lock overrides the macro trajectory for narrow implementation details. Both override older strategy material when they conflict.

## Current game position

The rewritten Folsom Chapters 1-2 spine is implemented through the physical tool-shed proof, Shrine Side Room/crawlspace, Keeper's Lantern reveal network, connected surface endpoints, Underworks, drain-bar pry, hidden Lantern-revealed growth gate, blue-flame threshold, explicit lower shrine hatch, impossible White-Scab front threshold, remote lower-knot release, and the separate under-shrine labyrinth bypass.

The current production boundary is behind the denied White-Scab threshold after exiting the labyrinth end hatch.

Do not replace that route with the old guide's direct Chapter 3 entry.

## Current design language

- Black growth/scab is physical material that covers, binds, feeds, seals, or protects something real.
- The old prescribed Severing-gesture ladder is no longer the core mechanic.
- Knife, Axe, and Drain Bar interactions succeed through the correct held tool, physical motion/contact, active tool part, authored stage, and prerequisite state. Interact/A is not a blocker-victory fallback.
- The Keeper's Lantern is a bounded reveal instrument for hidden glyphs, lines, feeds, stains, and structures. It is not merely a stronger Torch or a generic objective highlighter.
- Prefer environmental comprehension and persistent world changes over map/checklist dependence and progression-token inventory clutter.
- White architecture should feel ancient, pale, sacred, intricate, embedded, and impossible rather than generic sci-fi machinery.

The next lower-shrine production work should establish the live game's black covering -> reveal -> physical manipulation -> exposed pale structure -> readable architectural response language with a narrow playable proof before any broad framework is built.

## Creature platform status

The production creature chain is now:

```text
Forge export
  -> validated Creature Pack
  -> Creature Definition
  -> Creature Factory
  -> current runtime actor
```

Creature Lab has proven multiple production bodies and multi-site animated damage. Creature-platform work is now demand-driven. Do not automatically add physiology, universal creature persistence, simulation tiers, non-humanoid abstraction, or a broad AI framework until a real production encounter requires them.

Do not use raw Forge `siteId` strings as gameplay semantics.

## Technical and workflow grounding

- Design for phone play first; desktop is a development path.
- Inspect authored data, scene construction, interaction/update behavior, and persistence before editing.
- Preserve GitHub Pages behavior and the Vite base path.
- Prefer small named modules and existing good helpers over speculative frameworks.
- Preserve working starter systems outside the requested scope.
- Use world state for routes, opened structures, destroyed growth, and cleared seals.
- Run the narrowest relevant validation, then `npm run build` for code changes or when explicitly requested.
- Manual device-scale testing matters for held-tool ergonomics and real creature encounters.

## Scope discipline

Do not interpret divergence from the strategy guide as missing work by default.

When adapting an old beat, preserve useful purpose — atmosphere, realization, pressure, location idea, physical object, enemy, or story clue — and rebuild it using the live game's current interaction language.

Do not turn a narrow Chapter 3 proof into a general white-machinery framework, map system, Records/Memory system, creature physiology pass, AI platform, boss ladder, or unrelated route expansion unless explicitly requested.

The near-term bias is toward playable world production: stabilize physical tool ergonomics, cross the current Chapter 3 boundary with one strong White-Scab/pale-system proof, then introduce a real production creature encounter when the authored location calls for it.
