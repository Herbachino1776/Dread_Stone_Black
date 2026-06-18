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
