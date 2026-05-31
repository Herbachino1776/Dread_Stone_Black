# Dread Stone Black - Game Plan

## Core pitch

Dread Stone Black is a mobile-first first-person dungeon crawler inspired by the slow, hostile, lonely feel of old first-person action RPG dungeon games.

It should feel like a King's Field-like vertical slice, but all names, maps, enemies, UI, lore, art, and assets must be original.

The primary play target is an iPhone in Chrome/Safari. Desktop support is useful for development, but mobile playability must be designed from the start.

## Target stack

- Vite
- Three.js
- JavaScript or TypeScript
- Mobile-first touch UI
- GitHub Pages deployment from GitHub Actions
- PR-based development through Codex

## Deployment rule

The repo should automatically deploy the latest working `main` branch to GitHub Pages.

Required behavior:

- pull requests run build checks
- merges/commits to `main` run the deploy workflow
- the Vite `dist/` output is published to GitHub Pages
- deployment must not require manual file copying
- Codex should preserve automatic deployment in every PR

## Primary device target

Design first for phone portrait play unless a specific PR says otherwise.

Mobile requirements:

- playable on iPhone Chrome/Safari
- no required keyboard or mouse
- touch movement controls
- touch turn/look controls
- large attack/interact buttons
- HUD readable on a phone screen
- safe-area aware layout for notches/home indicator
- no accidental page scrolling while playing
- no long-press text selection/callouts during gameplay
- canvas resizes correctly on orientation/viewport changes

Desktop controls may exist as a secondary testing path.

## Vertical slice goal

Build a 10-15 minute playable sample dungeon.

The slice should prove:

- mobile first-person movement
- mobile camera/turn controls
- wall collision
- dark dungeon atmosphere
- sword overlay
- touch-friendly HUD
- locked gate interaction
- key pickup
- simple enemy combat
- one spell
- one shortcut or secret
- one final encounter

## Visual target

Early builds should be functional before beautiful.

Final slice target:

- low-poly dungeon rooms
- simple stone textures
- heavy fog and darkness
- limited draw distance
- slow movement
- first-person sword overlay
- billboard enemies at first
- simple mobile HUD
- original occult/dark fantasy atmosphere

Avoid over-polished AAA visuals. The target is a believable small-team retro 3D mobile browser game.

## Player feel

The player should feel:

- slow
- vulnerable
- curious
- slightly lost
- rewarded for observation
- punished for rushing

Movement should be deliberate. Combat should be simple, tense, and spacing-based.

Touch controls should feel heavy and readable, not twitchy.

## First dungeon concept

Working dungeon: The Black Reliquary.

Player starts in a dark stone entry chamber. A locked iron gate blocks the deeper sanctum. The player explores nearby rooms, finds a key or lever, fights a weak guardian, opens the gate, finds a shortcut, and reaches a final guarded chamber.

## PR milestones

### PR 1 - Mobile project foundation

Goal: make the game load on phone and feel like the start of a mobile dungeon crawler.

Must include:

- Vite + Three.js setup
- clean project structure
- first-person camera
- mobile-first canvas sizing
- touch movement controls
- touch turn/look controls
- optional keyboard controls for desktop testing
- slow movement and slow turning
- wall collision
- one room and one corridor
- fog/darkness
- sword overlay placeholder
- bottom/mobile HUD: HP, MP, POWER, MAGIC
- large touch interact button
- locked gate placeholder
- interact message: "The gate is locked."
- CSS that disables page scrolling, long-press selection, and unwanted touch callouts during gameplay
- working build script
- automatic GitHub Pages deployment workflow for Vite

Do not add enemies, combat, inventory, or magic yet.

### PR 2 - Mobile interaction loop

Goal: make the dungeon respond to touch controls.

Must include:

- touch interact button
- message box system
- key pickup
- locked gate opens after key
- lever or switch
- simple item pickup feedback

### PR 3 - Mobile combat prototype

Goal: make one enemy fight work on phone.

Must include:

- large touch attack button
- sword attack animation
- POWER cost/recovery
- attack range check
- enemy HP
- enemy approach behavior
- enemy attack behavior
- player damage
- death/reset state

### PR 4 - Magic and item layer

Goal: add one simple spell and basic consumable logic.

Must include:

- large touch spell button
- MP usage
- one projectile spell
- one potion pickup
- spell slot UI
- item pickup messaging

### PR 5 - Dungeon assembly

Goal: turn systems into a mini dungeon.

Must include:

- 8-12 connected spaces
- one shortcut loop
- one secret wall
- enemy placement
- key/gate progression
- final room encounter
- end-of-slice message
- phone readability pass for layout and pacing

### PR 6 - Atmosphere pass

Goal: make the slice feel intentional on mobile.

Must include:

- improved textures
- improved mobile HUD styling
- torch/flicker props
- ambient audio
- footstep audio
- enemy audio
- tuned fog and lighting
- performance check on phone-sized viewport

## Asset plan

Use placeholders first.

Later production assets:

- sword overlay PNG sized for phone view
- wall textures
- floor textures
- ceiling textures
- gate texture
- key item
- lever prop
- enemy billboard sprites
- spell effect sprite
- mobile HUD frame art
- touch button icons
- item icons
- ambient audio
- attack/hit sounds

## Development rules

- Keep PRs small.
- Every PR must build.
- Every PR must be playable on a phone browser.
- Desktop controls are secondary.
- Do not jump to complex RPG systems early.
- Do not copy King's Field assets, names, UI, enemies, music, layout, or lore.
- Prioritize movement, collision, mobile controls, atmosphere, and pacing first.
- Prefer simple working systems over ambitious broken systems.
- Preserve automatic GitHub Pages deployment.

## First playable success state

The first real success is simple:

The player opens the game on an iPhone browser, moves with touch controls, looks/turns with touch controls, sees a sword and HUD, reaches a locked gate, taps interact, and gets the message: "The gate is locked."