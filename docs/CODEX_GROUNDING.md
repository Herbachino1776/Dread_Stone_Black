# Codex Grounding Guide

## Repository identity

Dread Stone Black is a mobile-first, browser-playable first-person dungeon crawler built with Vite, Three.js, and plain JavaScript/TypeScript tooling. Its target feel is slow, physical, readable, ominous, and tactile. The player forces a buried world to reveal what it has sealed away.

This is an original game, not a generic Three.js demo or a fantasy prototype. Older first-PR and test-dungeon plans describe project history, not the current target.

## Source of current direction

Read these before implementation work:

1. `AGENTS.md`
2. `docs/current_milestone_folsom_growth.md`
3. the relevant runtime definitions and systems
4. longer strategy, architecture, and blueprint documents only as supporting reference

Current locks override older documents when they conflict.

## Current target

The active target is the Folsom tool-shed proof loop: rebuild the shed, place the Old Work Knife behind it, seal the door seam/frame with physical black growth, clear it in exactly three successful swipes, open the shed, reveal Wood Axe + Torch, and persist `folsom_tool_shed_open`.

The latch itself is not the growth target. Do not add tutorial popups. Do not build the Chapter 2 fire, pond, and shrine anchors until this direct loop works.

## Technical and workflow grounding

- Design for phone play first; desktop is a development path.
- Inspect authored data, scene construction, interaction/update behavior, and persistence before editing.
- Preserve GitHub Pages behavior and the Vite base path.
- Prefer small named modules and existing good helpers over speculative frameworks.
- Preserve working starter systems outside the requested scope.
- Use world state for routes, opened structures, and cleared seals.
- Run the narrowest relevant validation, then `npm run build` for code changes or when explicitly requested.

## Scope discipline

Do not turn the shed milestone into a broad combat, enemy, town, Memory, Pale Gate, church, boss, or Chapter 2 systems pass. A narrow playable proof that survives reload and remains usable on mobile is the near-term standard.
