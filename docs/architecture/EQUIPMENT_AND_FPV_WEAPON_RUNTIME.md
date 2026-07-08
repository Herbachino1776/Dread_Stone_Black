# Equipment And First-Person Tool Runtime

Equipment continues to drive inventory, harvesting, fishing, survival, and offhand light state. Camera-local first-person presentation is now split by responsibility: Rod A1 owns physical fishing, Torch and Keeper's Lantern own offhand light/reveal, and the Physical Tool Action System owns the Old Work Knife, Wood Axe, and Iron Drain Bar.

No player-arm sprites, hand strips, DOM weapon overlays, or hidden fallback assets are used. Visible tools are lightweight procedural camera-local geometry on the established viewmodel layer, independent from Torch/Lantern visibility.

## Physical tool standard

`PhysicalToolViewmodel` supplies centralized per-tool ready pose, grip zone, active-part point, motion weight, impact recoil, cooldown recovery, and return-to-ready data. Every right-hand tool originates at the lower-right of the camera: its handle is the nearest/lower-most readable part, while its blade, head, or pry tip rests above it and reaches the center only through an action arc.

The invisible grip/handle zone is input capture only. `PhysicalToolActionController` captures a pointer only when its touch begins in that zone and keeps that pointer through release. The captured swipe drives the held tool. The knife blade, axe head, and drain-bar tip are separate physical contact surfaces and can never initiate the gesture. Left-side movement remains untouched. Right-side look and offhand aiming remain normal when a touch begins outside the grip zone; a captured grip touch is withheld from those systems. Mouse/pointer follows the same route for desktop testing.

Every gesture remains visible. Effectiveness is separate and tool-specific:

- Old Work Knife: a fast cut/slash. Its handle starts lower-right and its short blade angles up toward center; the blade passes through the target only during the slash.
- Wood Axe: a heavy chop. Its handle starts lower-right and the head rests above/right of the grip; longer travel, slower maximum useful speed, and high smoothness distinguish it from the Knife.
- Iron Drain Bar: socketed lever pry. Its lower-right bar is the grip and touch-control point. The pry tip must be guided into an authored visible socket volume, settles without teleporting, then remains anchored while the grip drives a constrained target-authored lever arc. It never behaves as a sword or tap action.

Over-fast, short, wrong-angle, or squiggly motion still moves the held tool but does not advance a receiver. This gives each tool a learnable motion envelope without adding tutorial text or UI timing indicators.

## Contact and receiver path

The authoritative route is:

```text
grip-zone touch capture and gesture
  -> visible held-tool motion
  -> swept knife blade / axe head volume or seated pry-tip socket contact
  -> PhysicalToolTargetRegistry validation
  -> authored runtime receiver
  -> visual stage change and existing persisted world state
```

Touch zones and hit zones are intentionally unrelated. Cut/chop targets declare accepted tool id, action, swept contact zone, stages, prerequisites, save key, and wrong-contact feedback. Pry targets additionally declare visible socket geometry, socket world position/volume, lever direction/arc, tension threshold, blocker id, release relaxation, and visual strain stages. No pry progress is evaluated until the tip is seated. Interact/A has no growth or pry completion dispatch or fallback. Interact remains responsible for pickups, inspection, and normal transitions after a tool blocker is already open.

The pry controller exposes `free_bar`, `socket_seeking`, `seated`, `tension_pry`, and `released/open`. Ordinary movement and right-look remain available while free/seeking because only touches beginning in the projected grip zone are captured. Once seated, movement/look input is temporarily constrained until release or completion. The last 20% of target strain is the feedback spike; earlier travel moves the target without screen shake.

Wrong contact produces recoil, a skid/thud/scrape sound, and short haptics without progression. Valid contact uses tool-weighted recoil, shake, haptics, existing oil/cord/knot effects, staged material/geometry changes, and final blocker collapse/opening.

## Equipment selection and offhand coexistence

The Work Knife and Drain Bar use the existing `tool` slot and are selected from the Right Hand inventory surface. Wood Axe remains in the weapon slot. Rod A1 suppresses the physical work-tool view while fishing. Torch and Keeper's Lantern remain independent left/offhand viewmodels and can remain visible without unreadable overlap with the lower-right tool. Lantern reveal ownership and bounded reveal logic are unchanged.

## Scope boundary

The receiver architecture is intentionally reusable for future enemies, but this system does not add enemies, AI, player damage, character weapon damage, bosses, or combat arenas. Character combat remains deferred. White-Scab Hall must not be implemented until this lower-right viewmodel and grip-capture ergonomics pass is stable.
