# Codex Grounding Guide - Dread Stone Black

## Repository identity

Repo: Herbachino1776/Dread_Stone_Black

Dread Stone Black is a mobile-first first-person dungeon crawler vertical slice built with Vite and Three.js.

The target is a King's Field-like feel: slow, dark, lonely, hostile, cryptic, and exploration-heavy.

This project must use original content. Do not copy King's Field names, UI, maps, enemy designs, music, items, or lore.

## Primary platform

The primary target is iPhone browser play, especially Chrome/Safari.

Desktop support is useful for development and testing, but it is secondary. Do not build desktop-first and patch mobile later.

Every major system should be designed with phone play in mind from the start.

## Current development approach

Work through small pull requests.

Each PR should:

- have a clear single purpose
- build successfully
- preserve mobile browser playability
- preserve automatic GitHub Pages deployment
- avoid unnecessary systems
- keep code readable
- include useful comments where the logic may confuse a beginner

## Technical direction

Use:

- Vite
- Three.js
- plain JavaScript or TypeScript
- modular source files under `src/`
- mobile-first HTML/CSS overlay for HUD and controls
- static assets under `public/` or `src/assets/`, whichever best fits Vite conventions

Preferred starting structure:

```text
src/
  main.js
  game/
    Game.js
    PlayerController.js
    MobileControls.js
    DungeonScene.js
    Collision.js
    Interactions.js
    Hud.js
  styles/
    hud.css
    controls.css
public/
  assets/
    weapons/
    textures/
    sprites/
    ui/
docs/
  GAME_PLAN.md
  CODEX_GROUNDING.md
.github/
  workflows/
    deploy-pages.yml
```

This structure can be adjusted if there is a better clean Vite/Three.js pattern.

## First PR scope

The first PR must only build the mobile foundation and automatic Pages deployment.

Required:

- Vite + Three.js project setup
- `npm run dev`
- `npm run build`
- first-person camera
- mobile-first canvas sizing
- touch movement controls
- touch turn/look controls
- optional keyboard controls for desktop testing
- slow movement
- slow turning
- wall collision
- one stone room and one corridor
- fog/darkness
- basic sword overlay placeholder
- bottom/mobile HUD with HP, MP, POWER, MAGIC
- large touch interact button
- locked gate placeholder
- interact message: "The gate is locked."
- CSS/JS protections against page scrolling, text selection, long-press callouts, and accidental browser gestures during gameplay where practical
- automatic GitHub Pages deployment workflow for Vite

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

## Mobile control requirements

The first playable build must not require a keyboard.

Recommended first-pass controls:

- left thumb zone or virtual stick: move forward/back and strafe
- right thumb zone or left/right buttons: turn/look
- large Interact button
- Attack and Spell buttons can be visible but disabled/reserved, or omitted until later PRs

Controls must be large enough for a phone screen.

Avoid tiny UI targets.

Avoid placing important controls under the iPhone home indicator or notch/safe area.

Use CSS safe-area variables where appropriate:

- `env(safe-area-inset-top)`
- `env(safe-area-inset-bottom)`
- `env(safe-area-inset-left)`
- `env(safe-area-inset-right)`

## Gameplay feel

Movement should be deliberate and slow.

The player should not move like a modern shooter. Keep the turn speed and walk speed restrained.

Touch controls should feel heavy, readable, and simple.

Avoid twitchy camera movement.

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
- practical mobile HUD

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
- tapping the Interact button should show: "The gate is locked."

No inventory needed yet.

## HUD rules

For PR 1, the HUD can be HTML/CSS over the canvas.

Must show:

- HP
- MP
- POWER
- MAGIC
- message area
- large touch Interact button

Do not overdesign the HUD yet.

The HUD must be readable on a phone screen.

## Asset rules

Use placeholder assets if needed.

A sword overlay can start as:

- simple CSS shape
- inline SVG
- basic transparent PNG placeholder

Do not block PR 1 on custom art.

## Mobile browser rules

The game should prevent common mobile browser problems during play:

- page scroll while dragging controls
- text selection
- long-press callout menu
- unwanted double-tap zoom where practical
- canvas or HUD layout breaking on viewport changes

Use CSS such as `touch-action: none`, `user-select: none`, and related mobile-safe rules where appropriate.

## GitHub Pages

This repo must use automatic GitHub Pages deployment from GitHub Actions.

Required deployment behavior:

- pull requests run `npm run build` as a check
- commits/merges to `main` build the Vite app
- the Vite `dist/` output is uploaded as a Pages artifact
- GitHub Pages publishes from that artifact
- no manual copying of built files into the repo

Recommended workflow file:

```text
.github/workflows/deploy-pages.yml
```

Recommended Actions pattern:

- `actions/checkout`
- `actions/setup-node`
- `npm ci`
- `npm run build`
- `actions/configure-pages`
- `actions/upload-pages-artifact` with `path: dist`
- `actions/deploy-pages`

Build output should be `dist/`.

## PR communication

Every PR description should include:

- what was added
- what was intentionally not added
- how to test locally
- how to test on phone/browser
- whether `npm run build` passes
- whether Pages deployment was preserved or added

## Project danger zones

Avoid these early:

- building the whole game in one PR
- adding many systems before collision/movement feel good on phone
- relying on large external engines/libraries without need
- making a modern fast FPS
- copying copyrighted game assets or layouts
- creating a complex inventory too early
- using 3D character animation before billboard enemies are tested
- hiding important controls behind tiny desktop-style UI
- breaking automatic Pages deployment

## North star

First success:

A player opens the game on an iPhone browser, moves with touch controls, turns/looks with touch controls, sees a sword and HUD, reaches a locked gate, taps interact, and receives the message: "The gate is locked."

That is the foundation for the whole vertical slice.