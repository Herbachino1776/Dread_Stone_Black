# Dread Stone Black — Future Features

This document is a parking lot for strong ideas that should not interrupt the current implementation thread, but should be preserved for future Codex passes.

## 001 — Dev Attachment Tuning Mode With Export

### Summary

Add an in-game developer tool for live re-anchoring, positioning, rotating, and scaling held/equipped objects such as weapons, fishing rods, torches, shields, tools, fish, boats, and other gameplay props.

The goal is to stop guessing transform values in code. Instead, the game should let the developer tune the object visually in first person, then export the final transform as JSON or a ready-to-paste config block.

### Why This Matters

Dread Stone Black has repeated pain around held-object placement, especially first-person weapons and tools. A sword, torch, fishing rod, or other held prop can be technically equipped but visually wrong because its anchor, scale, rotation, or offset is off.

A live in-game tuning tool would make this workflow much faster:

1. Equip the item.
2. Open dev tuning mode.
3. Adjust position, rotation, scale, and anchor slot in game.
4. Export the finished transform.
5. Commit the tuned values back into the item definition.

### Proposed Dev Button

Add a dev-only button or panel entry:

```txt
DEV: Tune Held Item
```

This should only appear in development/debug mode, not as normal player UI.

### Tunable Values

The tuning panel should support:

- item ID
- anchor slot: `rightHand`, `leftHand`, `camera`, `world`, `inventoryPreview`, or future slots
- position X/Y/Z
- rotation X/Y/Z
- scale
- optional per-animation offsets if needed later
- reset to default
- load last local tuning
- save current local tuning

### Export Button

Add a dev-only export button:

```txt
Export Transform
```

The browser game cannot silently write directly into the repo, but it can safely:

- download a JSON file
- copy a config block to clipboard
- save the latest tuning values to `localStorage`

### Example JSON Export

```json
{
  "itemId": "fishingRod",
  "anchor": "rightHand",
  "position": [0.18, -0.34, -0.72],
  "rotation": [-12, 38, -8],
  "scale": 0.92
}
```

Suggested downloaded filename:

```txt
dreadstone-held-item-transform-fishingRod.json
```

### Example Clipboard Config Export

```js
fishingRod: {
  anchor: 'rightHand',
  position: [0.18, -0.34, -0.72],
  rotation: [-12, 38, -8],
  scale: 0.92
}
```

### Persistence

Use `localStorage` so reloads do not wipe tuning progress before export.

Suggested key pattern:

```txt
dsb.devAttachmentTuning.<itemId>
```

### Acceptance Criteria

This feature is successful when:

- a dev-only button opens held-item tuning mode
- the currently equipped item can be adjusted in game
- position, rotation, and scale update live
- anchor slot can be selected or displayed clearly
- the tuned transform can be exported as JSON
- the tuned transform can be copied as a ready-to-paste code block
- values persist in `localStorage` during development
- no normal gameplay UI is polluted in production mode
- the system works for at least sword, torch, and fishing rod style items

### Non-Goals For First Pass

Do not attempt these in the first pass:

- silent writes directly into repo source files
- full animation retargeting
- skeletal hand IK
- complex per-frame animation editing
- production player-facing UI
- cloud save of tuning values

### Notes For Codex

Keep this feature dev-only and lightweight. It should be a practical tool for tuning transforms, not a full editor. Browser download, clipboard export, and `localStorage` are enough for the first implementation.

Preserve mobile play, existing controls, inventory, survival systems, field entrances, Vite base `/Dread_Stone_Black/`, and GitHub Pages workflow.

Use bounded verification only unless explicitly told otherwise.

## 002 — Chest Opening, Item Reveal, And Hollow Chest Upgrade

### Summary

Future chest interactions should feel more physical and ceremonial. Opening a chest should trigger a short first-person item reveal rather than immediately leaving the item sitting in the chest.

### Intended Behavior

When the player opens a chest:

- the chest lid animates open;
- the contained item rises out of the chest;
- the item floats upward toward the player's eye line;
- the item becomes easier to inspect and slowly spins;
- the player presses `X` to add the item to inventory;
- walking away or canceling exits the reveal safely without duplicating or losing the item.

### Chest Model Direction

Chests should eventually be built from separate visible parts: walls, bottom, lid, straps, and interior space. Avoid solid-block chests when practical. The goal is for opened chests to read as hollow containers.

### Notes For Codex

Keep this first-person, short, and mobile-safe. Do not build a large cutscene framework for the first pass. Preserve existing inventory, item ownership, opened/looted state, Fishing A1, Broadsword A1, campfire, and controls.

## 003 — Fishable River Scene

### Summary

Create a river-focused outdoor scene that extends the existing pond fishing direction into a flowing river environment.

### Environment Direction

The river should have:

- thick trees along both banks;
- water that visually flows in one direction;
- boulders and rocks placed in and near the channel;
- mud banks on both sides;
- a natural riverbed that is deepest near the center and rises gradually toward the shore.

The shape should feel like a natural curved river channel, not a flat plane. A broad shallow-to-deep-to-shallow cross-section is preferred.

### Fishing Direction

The river should be fishable using the same core Fishing A1 / Rod A1 loop. River fishing must not break pond fishing.

### Notes For Codex

Start with a contained authored river scene or proving ground. Avoid swimming, boats, or complex water simulation in the first pass.

## 004 — Reusable Town Trail / Road Kit With Path Lighting

### Summary

Create reusable defaults for town paths, roads, and trails so locations like Folsom use consistent, maintainable path structures.

### Desired Trail Profile

A default town trail profile should define:

- width;
- material profile;
- terrain-conforming behavior;
- visual height offset policy;
- optional edge treatment;
- optional collision/walkable support rules;
- validation against sinking, floating, z-fighting, and invisible slabs.

### Path Lighting Direction

Important town trails should support optional paired torches or small flame fixtures at readable intervals. The goal is a lit main route through town, not random decoration.

### Notes For Codex

Do not reintroduce the old paver/field-wall rectangle jank. Path fixtures must not block movement or create hidden collision problems.

## 005 — Aggressive Terrain Stamp Proving Ground

### Summary

Create a safe place to test stronger terrain stamps before applying them to key gameplay areas.

### Terrain Shapes To Test

The proving ground should test:

- steeper hills;
- larger hills;
- steeper gullies;
- deeper road cuts;
- stronger shoreline and bank grades;
- saddle shapes between landmarks.

### Notes For Codex

Do this in a contained test area before changing Folsom broadly. Player grounding, chest/prop grounding, path surfaces, fishing, and first-person held items must remain stable on slopes.

## 006 — Openable Same-Location Doors

### Summary

Add interactable doors for structures that remain inside the same loaded location, such as Folsom tool shed or house doors.

### Intended Behavior

A local door should:

- start closed;
- open when the player presses interact;
- use a simple readable hinge or sliding animation;
- update collision to match the visible door state;
- allow the player to pass after opening.

### Notes For Codex

Start with one controlled local door before generalizing. Do not make this a location transition system.

## 007 — Audio Systems Milestone

### Summary

Audio should become a major future pillar, but it should be planned in an audio-focused pass rather than mixed into unrelated gameplay PRs.

### Audio Direction

Future audio should include:

- satisfying fishing sounds;
- reel and line sounds;
- water ambience;
- wind ambience;
- campfire/fire ambience;
- interaction sounds;
- retro OST support;
- future NPC dialogue support.

### Notes For Codex

Do not invent final audio assets. First build a lightweight audio pipeline that can load, trigger, loop, stop, mute, and scale volume safely on mobile browsers.

## 008 — Simple NPC Dialogue Tree Foundation

### Summary

Create a simple future dialogue tree foundation for authored NPC conversations. The desired direction is straightforward and readable, closer to simple adventure-game dialogue than a complex RPG conversation simulator.

### First-Pass Direction

A first version should support:

- NPC greeting text;
- short follow-up lines;
- optional player choices;
- simple branch selection;
- conversation exit;
- optional state flags for later use.

### Notes For Codex

Keep the first dialogue system intentionally small, text-first, and mobile-readable. Voice or advanced narrative systems can come later after the basic authored dialogue flow works.
