# Outdoor world clock

Folsom and North Road use `OutdoorWorldClock`, a shared absolute wall-time clock stored under `dreadStoneBlack.outdoorWorldClock.v1`. The stored versioned epoch survives reload, suspension, indoor travel, and location transitions. Rendering resolves from `Date.now()`, so pause/background time catches up immediately; no large frame delta is integrated. New-game reset removes the key and the next session starts at noon.

The 20-minute cycle is day 0–6, dusk 6–8, night 8–16, dawn 16–18, and morning-to-noon 18–20 minutes. The panorama/cloud rotation is a separate wall-time loop completing every 40 minutes. Development-only `timeOfDay` and `dayCycleSpeed` query overrides never write canonical state.
