# Equipment And First-Person Tool Runtime

Equipment continues to drive inventory, harvesting, fishing, survival, and offhand light state. Camera-local first-person presentation is now split by responsibility: Rod A1 owns physical fishing, Torch and Keeper's Lantern own offhand light/reveal, and the Physical Tool Action System owns the Old Work Knife, Wood Axe, and Iron Drain Bar.

No player-arm sprites, hand strips, DOM weapon overlays, or hidden fallback assets are used. Visible tools are lightweight procedural camera-local geometry on the established viewmodel layer, independent from Torch/Lantern visibility.

## Physical tool standard

`PhysicalToolViewmodel` supplies a ready pose, touch-following active pose, impact recoil, cooldown recovery, and return-to-ready pose for each tool. `PhysicalToolActionController` captures pointer/touch only when the player grabs the projected held tool, leaving left-thumb movement and unrelated viewport look input intact.

Every gesture remains visible. Effectiveness is separate and tool-specific:

- Old Work Knife: cut/slash; narrow and quick, with the widest useful speed and angle envelope.
- Wood Axe: heavy chop; longer travel, slower maximum useful speed, a clean downward contact angle, and a high smoothness requirement.
- Iron Drain Bar: pry/lever; the bar must sweep onto an authored pry point, plant, then move through a slow smooth lever arc.

Over-fast, short, wrong-angle, or squiggly motion still moves the held tool but does not advance a receiver. This gives each tool a learnable motion envelope without adding tutorial text or UI timing indicators.

## Contact and receiver path

The authoritative route is:

```text
touch grab and gesture
  -> visible held-tool motion
  -> swept screen/contact-zone test or planted pry contact
  -> PhysicalToolTargetRegistry validation
  -> authored runtime receiver
  -> visual stage change and existing persisted world state
```

Targets declare accepted tool id, physical action type, gesture requirements, contact zone/pry point, stage order, visual state, prerequisites, completion save key, and wrong-contact feedback. Interact/A has no growth or pry completion dispatch. Interact remains responsible for pickups, inspection, and normal transitions after a tool blocker is already open.

Wrong contact produces recoil, a skid/thud/scrape sound, and short haptics without progression. Valid contact uses tool-weighted recoil, shake, haptics, existing oil/cord/knot effects, staged material/geometry changes, and final blocker collapse/opening.

## Equipment selection and offhand coexistence

The Work Knife and Drain Bar use the existing `tool` slot and can be selected from Key Items. Their pickups equip that slot. Wood Axe remains in the weapon slot. Rod A1 suppresses the physical work-tool view while fishing. Torch and Keeper's Lantern remain independent offhand viewmodels and can remain visible with a right-hand physical tool.

## Scope boundary

The receiver architecture is intentionally reusable for future enemies, but this system does not add enemies, AI, player damage, character weapon damage, bosses, or combat arenas. Character combat remains deferred.
