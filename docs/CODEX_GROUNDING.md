# Codex Grounding Guide

## Repository identity

Dread Stone Black is a mobile-first, browser-playable first-person dungeon crawler built with Vite, Three.js, and plain JavaScript/TypeScript tooling. Its target feel is slow, physical, readable, ominous, and tactile. The player forces a buried world to reveal what it has sealed away.

This is an original game, not a generic Three.js demo or a fantasy prototype. Older first-PR and test-dungeon plans describe project history, not the current target.

## Source of current direction

Read these before implementation work:

1. `AGENTS.md`
2. `docs/current_milestone_folsom_growth.md`
3. `docs/chapter_2_closure_chapter_3_readiness.md`
4. the relevant runtime definitions and systems
5. longer strategy, architecture, and blueprint documents only as supporting reference

Current locks override older documents when they conflict.

## Current target

The Folsom tool loop, connected anchors, Underworks transition, Beneath Folsom tool and lantern loops, hidden five-hit growth gate, and blue-flame future threshold are functionally complete. Chapter 2 may pause.

The next target is Chapter 3 readiness: first lock the handoff from the existing blue-flame hallway to the Lower Shrine Stair, then prove one focused Keeper's Lantern reveal and white-scab clearing sequence. Do not treat the older strategy guide's shrine side-room/crawlspace layout as already implemented.

Do not add tutorial popups, progression tokens, enemies, Records UI, Memory UI, Pale Gates, a broad white-machinery framework, bosses, or unrelated route expansion.

## Technical and workflow grounding

- Design for phone play first; desktop is a development path.
- Inspect authored data, scene construction, interaction/update behavior, and persistence before editing.
- Preserve GitHub Pages behavior and the Vite base path.
- Prefer small named modules and existing good helpers over speculative frameworks.
- Preserve working starter systems outside the requested scope.
- Use world state for routes, opened structures, and cleared seals.
- Run the narrowest relevant validation, then `npm run build` for code changes or when explicitly requested.

## Scope discipline

Do not turn Chapter 3 readiness into a broad combat, enemy, town, Records, Memory, Pale Gate, church, boss, or route-expansion pass. The near-term standard is a narrow playable proof that survives reload and remains readable on mobile.
