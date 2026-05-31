# Dread Stone Black - Game Plan

## Core pitch

Dread Stone Black is a browser-playable first-person dungeon crawler inspired by the slow, hostile, lonely feel of old first-person action RPG dungeon games.

It should feel like a King's Field-like vertical slice, but all names, maps, enemies, UI, lore, art, and assets must be original.

## Target stack

- Vite
- Three.js
- JavaScript or TypeScript
- GitHub Pages deployment
- PR-based development through Codex

## Vertical slice goal

Build a 10-15 minute playable sample dungeon.

The slice should prove:

- first-person movement
- wall collision
- dark dungeon atmosphere
- sword overlay
- basic HUD
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
- simple bottom HUD
- original occult/dark fantasy atmosphere

Avoid over-polished AAA visuals. The target is a believable small-team retro 3D browser game.

## Player feel

The player should feel:

- slow
- vulnerable
- curious
- slightly lost
- rewarded for observation
- punished for rushing

Movement should be deliberate. Combat should be simple, tense, and spacing-based.

## First dungeon concept

Working dungeon: The Black Reliquary.

Player starts in a dark stone entry chamber. A locked iron gate blocks the deeper sanctum. The player explores nearby rooms, finds a key or lever, fights a weak guardian, opens the gate, finds a shortcut, and reaches a final guarded chamber.

## PR milestones

### PR 1 - Project foundation

Goal: make the game load and feel like the start of a dungeon crawler.

Must include:

- Vite + Three.js setup
- clean project structure
- first-person camera
- keyboard movement
- slow turning
- wall collision
- one room and one corridor
- fog/darkness
- sword overlay placeholder
- bottom HUD: HP, MP, POWER, MAGIC
- locked gate placeholder
- interact message: "The gate is locked."
- working build script
- keep GitHub Pages deployment working

Do not add enemies, combat, inventory, or magic yet.

### PR 2 - Interaction loop

Goal: make the dungeon respond to the player.

Must include:

- interact key
- message box system
- key pickup
- locked gate opens after key
- lever or switch
- simple item pickup feedback

### PR 3 - Combat prototype

Goal: make one enemy fight work.

Must include:

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

### PR 6 - Atmosphere pass

Goal: make the slice feel intentional.

Must include:

- improved textures
- improved HUD styling
- torch/flicker props
- ambient audio
- footstep audio
- enemy audio
- tuned fog and lighting

## Asset plan

Use placeholders first.

Later production assets:

- sword overlay PNG
- wall textures
- floor textures
- ceiling textures
- gate texture
- key item
- lever prop
- enemy billboard sprites
- spell effect sprite
- HUD frame art
- item icons
- ambient audio
- attack/hit sounds

## Development rules

- Keep PRs small.
- Every PR must build.
- Every PR must be playable in browser.
- Do not jump to complex RPG systems early.
- Do not copy King's Field assets, names, UI, enemies, music, layout, or lore.
- Prioritize movement, collision, atmosphere, and pacing first.
- Prefer simple working systems over ambitious broken systems.

## First playable success state

The first real success is simple:

The player loads the game, walks through a dark stone room, sees a sword and HUD, reaches a locked gate, presses interact, and gets the message: "The gate is locked."