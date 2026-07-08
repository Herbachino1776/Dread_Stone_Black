# Equipment And First-Person Tool Runtime

Equipment continues to drive inventory, harvesting, fishing, survival, and offhand light state. Camera-local first-person presentation is now split by responsibility: Rod A1 owns physical fishing, Torch and Keeper's Lantern own offhand light/reveal, and the Physical Tool Action System owns the Old Work Knife, Wood Axe, and Iron Drain Bar.

No player-arm sprites, hand strips, DOM weapon overlays, or hidden fallback assets are used. Visible tools are lightweight procedural camera-local geometry on the established viewmodel layer, independent from Torch/Lantern visibility.

## Physical tool standard

`PhysicalToolViewmodel` supplies centralized per-tool ready pose, grip zone, active-part point, motion weight, impact recoil, cooldown recovery, and return-to-ready data. Every right-hand tool originates at the lower-right of the camera: its handle is the nearest/lower-most readable part, while its blade, head, or pry tip rests above it and reaches the center only through an action arc.

The invisible grip/handle zone is input capture only. `PhysicalToolActionController` captures a pointer only when its touch begins in that zone and keeps that pointer through release. The captured swipe drives the held tool. The knife blade, axe head, and drain-bar tip are separate physical contact surfaces and can never initiate the gesture. Left-side movement remains untouched. Right-side look and offhand aiming remain normal when a touch begins outside the grip zone; a captured grip touch is withheld from those systems. Mouse/pointer follows the same route for desktop testing.

Every gesture remains visible. Effectiveness is separate and tool-specific:

- Old Work Knife: a fast cut/slash. Its handle starts lower-right and its short blade angles up toward center; the blade passes through the target only during the slash.
- Wood Axe: a heavy chop. Its handle starts lower-right and the head rests above/right of the grip; longer travel, slower maximum useful speed, and high smoothness distinguish it from the Knife.
- Iron Drain Bar: plant-and-pry. Its lower bar is the grip, its tip aims toward the authored pry point, and the action plants, leans, and pulls through a slow smooth lever arc rather than swinging like a sword.

Over-fast, short, wrong-angle, or squiggly motion still moves the held tool but does not advance a receiver. This gives each tool a learnable motion envelope without adding tutorial text or UI timing indicators.

## Contact and receiver path

The authoritative route is:

```text
grip-zone touch capture and gesture
  -> visible held-tool motion
  -> swept knife blade / axe head volume or planted pry-tip contact
  -> PhysicalToolTargetRegistry validation
  -> authored runtime receiver
  -> visual stage change and existing persisted world state
```

Touch zones and hit zones are intentionally unrelated. Targets declare accepted tool id, physical action type, gesture requirements, world contact zone/pry point, stage order, visual state, prerequisites, completion save key, and wrong-contact feedback. Only a swept active part can reach those zones. Interact/A has no growth or pry completion dispatch or fallback. Interact remains responsible for pickups, inspection, and normal transitions after a tool blocker is already open.

Wrong contact produces recoil, a skid/thud/scrape sound, and short haptics without progression. Valid contact uses tool-weighted recoil, shake, haptics, existing oil/cord/knot effects, staged material/geometry changes, and final blocker collapse/opening.

## Equipment selection and offhand coexistence

The Work Knife and Drain Bar use the existing `tool` slot and are selected from the Right Hand inventory surface. Wood Axe remains in the weapon slot. Rod A1 suppresses the physical work-tool view while fishing. Torch and Keeper's Lantern remain independent left/offhand viewmodels and can remain visible without unreadable overlap with the lower-right tool. Lantern reveal ownership and bounded reveal logic are unchanged.

## Scope boundary

The receiver architecture is intentionally reusable for future enemies, but this system does not add enemies, AI, player damage, character weapon damage, bosses, or combat arenas. Character combat remains deferred. White-Scab Hall must not be implemented until this lower-right viewmodel and grip-capture ergonomics pass is stable.
