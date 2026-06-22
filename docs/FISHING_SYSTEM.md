# Fishing System — Physical Rod A1 Angling

This is the practical engineering/design reference for the first playable physical fishing loop. Future prompts should preserve the systems named here and extend the physical loop rather than returning to `cast into pond -> timer -> fish pickup`.

## Current Implemented Flow

1. Player equips Rod A1 (`fishing_rod`) from the existing field equipment path.
2. Near a fishable pond such as Folsom, `PhysicalFishAngling` spawns one visible pond fish actor from the zone species pool.
3. The fish idles under the water and occasionally enters `breach`, briefly breaking the surface and spawning a non-text splash ring.
4. Player casts the existing Rod A1 lure with the first-person freeform cast.
5. Lure landing in fishable water no longer creates a raw fish pickup immediately. The lure remains physical on the water.
6. If the lure lands directly on/too close to the fish, the fish enters `spooked` and darts away.
7. If the lure lands nearby, the fish becomes `aware`; lure bobbing, rod wiggles, line tension, and reel pulses raise interest.
8. At high interest the fish enters `chasingLure`, approaches the lure, and can strike.
9. Strike enters `hooked`, increases line tension, uses screen shake and safe haptics, and does **not** show “FISH ON” text.
10. While hooked, the fish fights against line pull. Clockwise reel gestures shorten/pull the line; keeping Rod A1 up keeps the hook set.
11. Dipping the rod too low for too long enters `lost`, splashes, detaches, and creates no pickup.
12. Reeling the fish close enough to the player/shore enters `reeledToShore`, despawns the actor, and creates an existing raw fish pickup carrying size metadata.
13. Raw fish pickup, cooking, cooked fish pickup, inventory, and eating still use the existing survival path, now with size-based hunger restoration metadata.

## Rod A1 Control Summary

| Control | Current behavior |
| --- | --- |
| First-person cast | Pointer/touch grabs Rod A1 and releases a physical lure projectile from the rod tip. |
| Lure work | Small Rod A1 movements, lure bobbing, line tension changes, and short reel pulses can interest nearby fish. No new button is required. |
| Clockwise reel gesture | When line is deployed, clockwise motion around the projected reel zone creates manual reel rate and pulls lure/fish toward Rod A1. |
| Rod angle while hooked | Rod tip should stay reasonably above the player. If it is dipped too low for roughly 1.6 seconds while hooked, the fish can escape. |

## Spool Lock Rules

- Lure held near rod: spool is locked/held at the short starting line length.
- Airborne cast: spool unlocks and unspools to satisfy lure travel.
- Lure on water with no reeling/rod work: spool locks on water to preserve cast distance.
- Clockwise manual reeling: spool unlocks for reel-in and raises line tension.
- Grounded lure: spool locks unless manual reeling pulls it back.

## Lure and Line Behavior

- The lure is still the existing clean bobber / metal hook projectile.
- The line origin remains Rod A1's world tip position.
- The line uses the existing multi-point/tube visual and tension opacity.
- On fishable water the lure bobs at the surface; lure velocity and line tension feed fish interest.
- Hooked fish movement is coupled to the lure/rod direction in a simple first-playable way. Complex line break math is intentionally deferred.

## Physical Fish State Machine

| State | Purpose | Transitions |
| --- | --- | --- |
| `idle` | Fish swims below surface inside fishable water. | Timed breach; lure nearby -> `aware`; lure too close -> `spooked`. |
| `breach` | Fish briefly breaks surface and creates splash/ripple feedback. | Returns to `idle` after a short visible arc. |
| `aware` | Fish has noticed a nearby lure. | Lure work raises interest -> `chasingLure`; stale/far lure lowers interest. |
| `spooked` | Fish darts away after an overly direct landing. | Returns to `idle` after a short cooldown. |
| `chasingLure` | Fish approaches the worked lure. | Reaches lure -> `hooked`; lure moves away/far can reduce future interest. |
| `hooked` | Fish is attached to the lure/line and fights. | Rod too low too long -> `lost`; close to player/shore -> `reeledToShore`. |
| `reeledToShore` | Fish converts into existing raw fish pickup. | Terminal; actor despawns. |
| `lost` | Escape splash/no pickup. | Returns to `idle` after feedback. |

## Size Groups

Fish behavior is size-group driven. Do **not** add species personalities yet.

| Size group | Mesh scale | Hooking/fight role | Hunger restoration |
| --- | ---: | --- | ---: |
| Small Fish | `0.72x` existing species mesh | Easiest to hook, weak fight, light reel weight. | About 5 minutes (`300s`). |
| Medium Fish | `1.0x` existing species mesh | Default/current difficulty and visual size. | About 10 minutes (`600s`). |
| Large Fish | `1.32x` existing species mesh | Harder/heavier, stronger fight. Future caution/smarts belong here, not species personalities. | About 20 minutes (`1200s`). |

Size metadata is stored on the physical actor, raw pickup interaction, raw inventory fish stack, cooked pickup interaction, cooked inventory fish stack, and is consumed when eating cooked fish.

## Hunger Values by Fish Size

- Small cooked fish: restores `5 * 60` seconds.
- Medium cooked fish: restores `10 * 60` seconds and preserves the old/default cooked fish behavior.
- Large cooked fish: restores `20 * 60` seconds.
- Hunger remains capped by `hungerMaxSeconds`.

## Files and Integration Points

- `src/game/fishing/PhysicalFishAngling.js` owns the physical pond fish actor and state machine.
- `src/game/fishing/FishSizeGroups.js` centralizes size scale, difficulty, fight strength, reel weight, and hunger seconds.
- `src/game/fishing/CastingController.js` keeps Rod A1 cast/reel input and forwards lure/rod state into the physical fish system.
- `src/game/fishing/FishingLinePhysics.js` remains the spool, line, and lure physics source of truth.
- `src/game/DungeonScene.js` owns raw/cooked pickup spawning and bridges physical landed fish into existing pickups.
- `src/game/GameState.js` stores size metadata in raw/cooked fish stacks and applies size-based hunger when eating.
- `src/game/Interactions.js` carries fish size metadata through pickup, cooking, and eating interactions.

## Do-Not-Break Notes for Future Prompts

- Do not show “FISH ON” text or add large fishing tutorial labels.
- Do not add a new cast button, reel button, green reel circle UI, hands/arms, or species personality labels.
- Preserve Rod A1 canonical first-person visual and line origin at rod tip.
- Preserve no-button freeform casting, clockwise reel gesture, and spool lock behavior.
- Preserve Folsom default spawn and Folsom pond fishing.
- Preserve the fish species registry, including C4 / `spineBackFish`.
- Preserve raw fish pickup, cooked fish, campfire, hunger, inventory, mobile HUD, A/X buttons, and movement/look joysticks.
- Preserve the Vite base `/Dread_Stone_Black/`.

## Current Implementation Status

Implemented in this PR:

- One physical pond fish actor near active fishable water.
- Species chosen from existing fishable zone pool.
- Small/medium/large size groups.
- Breach/splash target feedback.
- Lure awareness, spook, chase, strike, hooked fight, escape, and landing states.
- Non-text strike feedback through screen shake/haptics and tension.
- Clockwise reel integration for pulling hooked fish toward player/shore.
- Raw pickup only after the fish is physically landed.
- Size-based hunger metadata through raw pickup -> inventory -> cooking -> cooked pickup -> inventory -> eating.

## Future Planned Work

- Add stronger water-zone constraints for irregular/non-ellipse ponds.
- Add better fish swimming animation and water surface particles using a reusable effects helper.
- Add audio cues for breach, strike, escape, and landing.
- Add more robust rod-up evaluation from actual rod orientation rather than the current simple rod-tip/gesture rule.
- Add line break and drag math after the first playable hook/escape loop is stable.
- Add per-size tuning UI/debug overlays for developers only.
- Add fish schooling/multiple candidate actors after one-fish readability is proven.
- Add cautious/smart large-fish behavior later via size groups, not species-specific personalities.
