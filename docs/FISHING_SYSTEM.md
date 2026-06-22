# Fishing System — Physical Rod A1 Angling

This is the practical engineering/design reference for the first playable physical fishing loop. Future prompts should preserve the systems named here and extend the physical loop rather than returning to `cast into pond -> timer -> fish pickup`.


## Rod A1 Fishing A1 Stable / Canonical Lock

Rod A1 Fishing A1 is now stable and canonical. Future PRs should not casually rewrite the core fishing loop or its survival handoff. In particular, preserve:

- Rod A1 touch casting;
- line/lure endpoint physics;
- spool length as the source of truth;
- clockwise reel gesture behavior;
- hooked fish bite/fight/landing;
- deterministic fish landing;
- Folsom pond fishing;
- raw fish pickup;
- the cooking/eating survival loop.

Future fishing work should be additive and polish-only unless a core rewrite is explicitly requested. Any future change to core fishing physics must preserve the current acceptance checks for casting, reeling, lure endpoint behavior, hooked fights, deterministic landing, raw pickup, cooking, and timed eating.

## Post-Catch Survival Loop

1. Catch a fish through the canonical Rod A1 bite/fight/landing loop.
2. Pick up the grounded raw fish pickup; raw fish remains non-edible.
3. Cook raw fish at a campfire through the existing cooking timed action.
4. Eat cooked fish from inventory through the timed eating action.
5. Hunger restores only after the eating timer completes, preserving the cooked fish size-group hunger metadata.

## Current Implemented Flow

1. Player equips Rod A1 (`fishing_rod`) from the existing field equipment path.
2. Near a fishable pond such as Folsom, `PhysicalFishAngling` spawns one visible pond fish actor from the zone species pool.
3. The fish idles under the water and occasionally enters `breach`, briefly breaking the surface and spawning a non-text splash ring.
4. Player casts the existing Rod A1 lure with the first-person freeform cast.
5. Lure landing in fishable water no longer creates a raw fish pickup immediately. The lure remains physical on the water.
6. If the lure lands directly on/too close to the fish, the fish enters `spooked` and darts away.
7. If the lure lands nearby, the fish becomes `aware`; lure bobbing, rod wiggles, line tension, and reel pulses raise interest.
8. At high interest the fish enters `chasingLure`, approaches the lure, and can strike.
9. Strike enters `hookedWater`, increases line tension, uses screen shake and safe haptics, and does **not** show “FISH ON” text.
10. While hooked in water, the fish remains attached to the lure/line and fights against line pull. Clockwise reel gestures shorten/pull the line; keeping Rod A1 up keeps the hook set.
11. Active reeling changes the fight to `draggingToShore`; once the fish has been hooked for at least `0.5s`, the line is reeled to `minLineLength + 0.92` or shorter, and clockwise reel input happened within the last `0.75s`, it deterministically enters `liftingFromWater`.
12. During `liftingFromWater`/`landedAttached`, water pinning is disabled (`isLureOnWater = false`) so the fish/lure endpoint can leave the pond zone, arc to a sampled beach/ground point near the player, and settle on terrain instead of being lerped back below the surface.
13. After landing, the actor despawns and creates the existing raw flopping fish pickup carrying species, size-group, and hunger metadata. It is not added directly to inventory; the player picks it up normally.
14. Dipping the rod too low for too long enters `lost`, splashes, detaches, creates no pickup, clears hooked/water fight ownership, and puts the lure into normal `recoveringToTip` recovery so clockwise reeling can bring it fully back to the dangling near-tip state.
15. Raw fish pickup, cooking, cooked fish pickup, inventory, and timed eating still use the existing survival path, now with size-based hunger restoration metadata.

## Rod A1 Control Summary

| Control | Current behavior |
| --- | --- |
| First-person cast | Pointer/touch grabs Rod A1 and releases a physical lure projectile from the rod tip. |
| Lure work | Small Rod A1 movements, lure bobbing, line tension changes, and short reel pulses can interest nearby fish. No new button is required. |
| Clockwise reel gesture | When line is deployed, clockwise motion around the projected reel zone creates manual reel rate and pulls lure/fish toward Rod A1. |
| Rod angle while hooked | Rod tip should stay reasonably above the player. If it is dipped too low for roughly 1.6 seconds while hooked, the fish can escape. |

## Rod A1 Lure Behavior Model

`FishingLinePhysics.lureRecoveryState` is the debuggable behavior state. The legacy contact booleans still exist for collision/render integration, but they must agree with this state rather than independently deciding recovery.

| State | Owner and transition rule |
| --- | --- |
| `danglingNearTip` | Ready/fully reeled. Spool is at `LINE_MIN_LENGTH`; only the weighted pendulum update owns the lure. |
| `castingUnspooling` | Begins on release. Cast-only payout is allowed and the endpoint tension ramps in after the grace window. |
| `deployedWater` | Water surface owns vertical bobbing. Reel constraint pulls horizontally until the contact geometry is too short to remain on the surface. |
| `deployedGround` | Terrain owns lure height. Reel constraint drags horizontally until the contact geometry is too short to remain grounded. |
| `recoveringToTip` | Water/ground contact has released. Cast payout is forbidden; gravity, reel shortening, and the endpoint constraint lift the lure toward the tip. |
| `hookedFish` / `hookedFishLanding` | `PhysicalFishAngling` owns fish/lure movement until escape or shore landing. Normal near-tip recovery is disabled only during the active fight. Landing disables water pinning before the fish is converted to a grounded raw pickup, while escape clears hooked ownership and returns the lure to normal water recovery. |

Do not use `isLureAirborne` by itself to authorize payout. Both a real cast (`isCasting`) and `castingUnspooling` are required; recovery is also airborne but must never leak line outward.

## Spool Lock Rules

- Lure held near rod: spool is locked/held at the true minimum line length, not a fake attachment to the rod mesh.
- Airborne cast: spool unlocks and unspools to satisfy lure travel.
- Cast release starts with a `0.34s` payout grace window where the spool expands aggressively toward lure distance plus a `0.5` unit buffer. Endpoint tension begins at `0.08x`, then ramps over `0.52s` toward `0.58x` while normal cast payout continues.
- Lure on water with no reeling/rod work: spool locks on water to preserve cast distance.
- Clockwise manual reeling: spool unlocks for reel-in and raises line tension.
- Grounded lure: spool locks unless manual reeling pulls it back.
- Fully reeled lure: when manual clockwise reeling shortens a deployed, unhooked line to the minimum length plus the recovery threshold, water/ground pinning is released continuously and the lure enters `danglingNearTip` as the weighted endpoint of the remaining short line.

## Manual Reel Signal

Clockwise pointer samples do not directly shorten the spool. They produce a bounded target rate, which becomes the actual rate through frame-based acceleration limits:

- per-sample clockwise arc is capped at `0.32rad`;
- target rate is capped at `4.8` line units/second;
- target filtering uses `16` response strength;
- fresh motion is held for `0.085s` so normal touch event spacing does not pulse the reel;
- actual rate accelerates at no more than `18` units/second squared and decelerates at no more than `24`;
- spool shortening is capped at `0.1` unit per rendered physics frame; while hooked, shortening is divided by the fish size group's reel weight and is intentionally not blocked by impossible rod-tip-to-water geometry;
- releasing or pausing the gesture drives the target to zero while actual rate decays, rather than resetting or persisting indefinitely.

Slow clean circles therefore stay slow, fast clean circles reach the cap progressively, and a single bad pointer delta cannot recover the lure in one frame.

## Lure and Line Behavior

- The lure is still the existing clean bobber / metal hook projectile, and it is always the authoritative weighted endpoint of the fishing line.
- The line origin remains Rod A1's world tip position; the final rendered line point is always the current lure position.
- The line uses the existing multi-point/tube visual and tension opacity, but no visual line may extend beyond the actual spool length currently out of the reel.
- On fishable water the lure bobs at the surface while the line is deployed; lure velocity and line tension feed fish interest. Clockwise reeling shortens the spool length and pulls the lure across the water until the remaining line is too short to keep it pinned, then it lifts naturally into the dangling endpoint state.
- On land the grounded lure remains terrain-constrained while deployed so reel-in drags it along the ground. When the shortened spool can no longer reach the ground contact, the lure lifts naturally into the dangling endpoint state.
- While a lure is surface/terrain constrained, spool shortening is limited by the horizontal distance it can physically move that frame (`0.12` unit maximum contact pull). This prevents the spool from becoming much shorter than the endpoint and avoids a later correction snap.
- Contact releases only when the lure is horizontally near the rod and spool length is within `0.16` unit of the vertical tip-to-contact distance. `recoveringToTip` then owns the continuous lift; it cannot re-enter cast payout.
- At max reel-in, an unhooked lure does **not** remain pinned to water or terrain and does **not** snap to a fake point beside the rod. It recovers into `danglingNearTip`, a short near-tip pose about 0.32 world units (roughly 1 foot in meter-ish tuning) below the true Rod A1 tip.
- In `danglingNearTip`, the visible line is short and taut from the true rod tip to the lure; the lure uses gravity plus spring/constraint damping so it sways like a small weighted pendulum rather than being rigidly glued to the tip.
- During the first burst of a cast, endpoint clamping is relaxed while line payout is allowed; hard endpoint constraint returns when the line reaches max spool length, the lure lands and locks, the lure is fully reeled/dangling, or hooked fish tension owns the fight.
- Line momentum/trailing only exists when spool length is actually out. When the line is near minimum length, old long rope points are collapsed/reseeded into a compact chain between the rod tip and lure endpoint so player motion cannot leave a long phantom trail.
- Hooked fish movement is coupled to the lure/rod direction in a simple first-playable way. Hooked reel pull is intentionally stronger than normal lure surface pull (`9.5 + manualRate * 2.4`, divided by size reel weight) while fish backdrag is damped to `0.42x` size fight strength so clean circles visibly move the fish closer without instantly teleporting it. Hooked spool shortening uses the same size reel weight, but it does not require the remaining line to be longer than the vertical rod-tip-to-water gap; that old geometry clamp made the short-line landing threshold unreachable. Hooked fish are excluded from near-tip lure recovery only while the fish/lure connection is actively under hooked fight, escape, or shore landing logic. The catch finish is deterministic: if `isFishHooked` is true, the fight is at least `0.5s` old, the line is within `0.92` units of `minLineLength`, and reel input was seen in the last `0.75s`, landing begins even if the fish has not solved perfect shore physics. Once landing begins, the fish/lure endpoint is no longer water-owned, can exit the fishable zone near shore, and is moved to a sampled ground/beach point. Complex line break math is intentionally deferred.
- Landing placement first uses the pond's existing shoreline/beach resolver near the player and samples outdoor terrain height. If that resolver cannot produce an outside-water point, placement falls back to a point between fish and player, then to safe ground beyond the player on the shore side. Survival gameplay should prefer a safely grounded raw fish pickup over an unwinnable physically perfect beach solution.
- Escape/lost cleanup must clear `isFishHooked`, line tension, fish actor ownership, and stale hooked landing state. The lure enters `recoveringToTip` rather than staying in `hookedFish` or water pinning, so normal clockwise reel recovery can return the lure to `danglingNearTip`.

## Hooked Reel-Cycle Tuning

The landing gate remains line-length based, but hooked fights also track accumulated clockwise reel radians as `hookedReelCycles = clockwiseRadians / 2π` for tuning and debug. A normal mid-pond medium fish should land in roughly **25 clean full clockwise reel cycles**. Small fish use `0.75x` reel weight and target about **19 cycles** (normally **16–20**); medium fish use `1.0x` and target **25**; large fish use `1.55x` and target about **39 cycles** (normally **30–40**). The deterministic short-line rule still makes every group landable. Fish that strike close to shore can land in fewer cycles because less line is out.

PR #211 introduced explicit landing states, but unwinnable fights could still happen when the fish/lure stayed water-owned, fishable-zone clamping continued to win over the landing motion, or the line remained just long enough that shore/rod-tip geometry gates never aligned in the same frame. The current rule intentionally does not require perfect rod-up, exact rod-tip reach, or physically solving the pond edge at the catch moment: hooked fish + short line + recent reel input + minimum fight age wins the fish. This is required for survival because raw fish must be a reliable food source; a player who executes the reel gesture should not starve because the fish never quite exits the water volume.

Lost-fish cleanup is equally explicit: escape spawns no pickup, clears `isFishHooked` and the hooked reel weight, clears stale water pinning, enters `recoveringToTip`, unlocks the spool, and gives the lure a small upward velocity so normal clockwise reeling can return it to the near-tip dangling state instead of leaving it stuck on the surface. Unequipping Rod A1, leaving the fishing zone, or changing out of the outdoor survival area uses the same cleanup path.

## Dev-Only Fishing Debug State

Debug data is present but disabled by default. In a development build, use `?debugHud=1` for the compact live readout or inspect `CastingController.debug` / `FishingLinePhysics.getDebugState()` when tuning. It includes:

- lure behavior mode, spool state, current/min/max line length, and tip-to-lure distance;
- hooked-fish state, hooked age, recent reel timer, deterministic landing threshold, landing-ready/reason, hooked reel cycles, target cycles, size group, reel pull, landing-triggered/spawned flags, and latest landing/lost cleanup result;
- reel target rate, actual rate, active acceleration/deceleration clamp, and clockwise accumulation;
- cast payout/grace flags, endpoint constraint activity, tension, and lure speed before/after constraint;
- rod grab `t`, hit samples/radius, hand pivot, rod-tip velocity, launch velocity, and lure hit type.

Do not add normal-gameplay console logging or an always-visible reel UI for this data.

## Physical Fish State Machine

| State | Purpose | Transitions |
| --- | --- | --- |
| `idle` | Fish swims below surface inside fishable water. | Timed breach; lure nearby -> `aware`; lure too close -> `spooked`. |
| `breach` | Fish briefly breaks surface and creates splash/ripple feedback. | Returns to `idle` after a short visible arc. |
| `aware` | Fish has noticed a nearby lure. | Lure work raises interest -> `chasingLure`; stale/far lure lowers interest. |
| `spooked` | Fish darts away after an overly direct landing. | Returns to `idle` after a short cooldown. |
| `chasingLure` | Fish approaches the worked lure. | Reaches lure -> `hookedWater`; lure moves away/far can reduce future interest. |
| `hookedWater` | Fish is attached to the lure/line and fights while still water-owned. | Active clockwise reeling -> `draggingToShore`; deterministic line-length landing can also enter `liftingFromWater`; rod too low too long -> `lost`. |
| `draggingToShore` | Fish remains attached and is pulled toward the player/shore, with only a weak near-shore zone clamp so it is not trapped forever. | Hooked for at least `0.5s`, short enough line (`minLineLength + 0.92`), and recent reel input (`0.75s`) -> `liftingFromWater`; rod too low too long -> `lost`. |
| `liftingFromWater` | Fish/lure endpoint is released from water pinning and arcs out of the pond to a sampled beach/ground landing point. | Lift completes -> `landedAttached`. |
| `landedAttached` | Fish is on the beach/ground at the landing point while the line has not snapped back to the rod tip. | Short settle completes -> `pickedUp` conversion. |
| `pickedUp` | Actor converts into the existing raw flopping fish pickup with species, size group, and hunger metadata preserved. | Terminal; actor despawns and pickup handles normal player interaction. |
| `lost` | Escape splash/no pickup. | Returns to `idle` after feedback. |

## Size Groups

Fish behavior is size-group driven. Do **not** add species personalities yet.

| Size group | Mesh scale | Hooking/fight role | Hunger restoration |
| --- | ---: | --- | ---: |
| Small Fish | `0.72x` existing species mesh | Easiest to hook, weak fight, light reel weight. | About 5 minutes (`300s`). |
| Medium Fish | `1.0x` existing species mesh | Default/current difficulty and visual size. | About 10 minutes (`600s`). |
| Large Fish | `1.32x` existing species mesh | Harder/heavier, stronger fight. Future caution/smarts belong here, not species personalities. | About 20 minutes (`1200s`). |

Size metadata is stored on the physical actor, raw pickup interaction, raw inventory fish stack, cooked pickup interaction, cooked inventory fish stack, and is consumed only when timed cooked-fish eating completes.

## Hunger Values by Fish Size

- Small cooked fish: restores `5 * 60` seconds.
- Medium cooked fish: restores `10 * 60` seconds and preserves the old/default cooked fish behavior.
- Large cooked fish: restores `20 * 60` seconds.
- Hunger remains capped by `hungerMaxSeconds`.

## Files and Integration Points

- `src/game/fishing/PhysicalFishAngling.js` owns the physical pond fish actor and state machine.
- `src/game/fishing/FishSizeGroups.js` centralizes size scale, difficulty, fight strength, reel weight, and hunger seconds.
- `src/game/fishing/CastingController.js` keeps Rod A1 cast/reel input and forwards lure/rod state into the physical fish system.
- `src/game/fishing/FishingLinePhysics.js` remains the spool, line, and lure physics source of truth, including the `danglingNearTip` fully-reeled lure state.
- `src/game/DungeonScene.js` owns raw/cooked pickup spawning and bridges physical landed fish into existing pickups.
- `src/game/GameState.js` stores size metadata in raw/cooked fish stacks and applies size-based hunger when eating.
- `src/game/Interactions.js` carries fish size metadata through pickup, cooking, and eating interactions.

## Do-Not-Break Notes for Future Prompts

- Do not show “FISH ON” text or add large fishing tutorial labels.
- Do not add a new cast button, reel button, green reel circle UI, hands/arms, or species personality labels.
- Preserve Rod A1 canonical first-person visual and line origin at rod tip.
- Preserve fully reeled Rod A1 lure recovery to `danglingNearTip`; do not let water or terrain constraints keep an unhooked max-reeled lure away from the tip, and do not render stale rope points beyond current spool length.
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
- Lure awareness, spook, chase, strike, hooked water fight, deterministic short-line finish, dragging-to-shore, lift-from-water, landed-attached conversion, escape cleanup, and raw pickup states.
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
