# Codex Grounding Guide - Dread Stone Black

## Repository identity

Repo: Herbachino1776/Dread_Stone_Black

Dread Stone Black is a browser-playable first-person dungeon crawler vertical slice built with Vite and Three.js.

The target is a King's Field-like feel: slow, dark, lonely, hostile, cryptic, and exploration-heavy.

This project must use original content. Do not copy King's Field names, UI, maps, enemy designs, music, items, or lore.

## Current development approach

Work through small pull requests.

Each PR should:

- have a clear single purpose
- build successfully
- preserve browser playability
- preserve GitHub Pages deployment
- avoid unnecessary systems
- keep code readable
- include useful comments where the logic may confuse a beginner

## Technical direction

Use:

- Vite
- Three.js
- plain JavaScript or TypeScript
- modular source files under `src/`
- static assets under `public/` or `src/assets/`, whichever best fits Vite conventions

Preferred starting structure:

```text
src/
  main.js
  game/
    Game.js
    PlayerController.js
    DungeonScene.js
    Collision.js
    Interactions.js
    Hud.js
  styles/
    hud.css
public/
  assets/
    weapons/
    textures/
    sprites/
    ui/
docs/
  GAME_PLAN.md
  CODEX_GROUNDING.md
```

This structure can be adjusted if there is a better clean Vite/Three.js pattern.

## First PR scope

The first PR must only build the foundation.

Required:

- Vite + Three.js project setup
- `npm run dev`
- `npm run build`
- first-person camera
- keyboard movement
- slow turning
- wall collision
- one stone room and one corridor
- fog/darkness
- basic sword overlay placeholder
- bottom HUD with HP, MP, POWER, MAGIC
- locked gate placeholder
- interact message: "The gate is locked."

Do not add:

- enemies
- combat
- inventory
- magic projectile
- leveling
- complex RPG stats
- procedural generation
- large dungeon
- 3D weapon models

## Gameplay feel

Movement should be deliberate and slow.

Recommended first-pass controls:

- W/S: move forward/back
- A/D: strafe or turn, whichever is easiest for first pass
- Arrow Left/Right or Q/E: turn
- E: interact
- Space or mouse click: reserved for later attack

The player should not move like a modern shooter. Keep the turn speed and walk speed restrained.

## Visual style

The first builds can be rough.

Final direction:

- dark stone dungeon
- low-poly geometry
- simple PS1-style texture feel
- limited draw distance
- fog doing major atmosphere work
- simple first-person sword overlay
- billboard enemies later
- practical retro HUD

Do not chase cinematic polish before the game loop works.

## Collision rules

Start simple.

Use either:

- bounding boxes for walls/gates, or
- grid-based collision

The player must not pass through walls or the locked gate.

Do not add a physics engine unless it is truly necessary.

## Interaction rules

Interaction can start with a simple forward ray/check.

For PR 1:

- the locked gate should detect the player looking/standing near it
- pressing E should show: "The gate is locked."

No inventory needed yet.

## HUD rules

For PR 1, the HUD can be HTML/CSS over the canvas.

Must show:

- HP
- MP
- POWER
- MAGIC
- message area

Do not overdesign the HUD yet.

## Asset rules

Use placeholder assets if needed.

A sword overlay can start as:

- simple CSS shape
- inline SVG
- basic transparent PNG placeholder

Do not block PR 1 on custom art.

## GitHub Pages

This repo is intended for GitHub Actions Pages deployment.

Do not break existing Pages setup. If no workflow exists yet, add a simple GitHub Pages deploy workflow for Vite only if appropriate.

Build output should be `dist/`.

## PR communication

Every PR description should include:

- what was added
- what was intentionally not added
- how to test locally
- whether `npm run build` passes

## Project danger zones

Avoid these early:

- building the whole game in one PR
- adding many systems before collision/movement feel good
- relying on large external engines/libraries without need
- making a modern fast FPS
- copying copyrighted game assets or layouts
- creating a complex inventory too early
- using 3D character animation before billboard enemies are tested

## North star

First success:

A player can open the browser game, walk through a dark stone room, see a sword and HUD, reach a locked gate, press interact, and receive the message: "The gate is locked."

That is the foundation for the whole vertical slice.