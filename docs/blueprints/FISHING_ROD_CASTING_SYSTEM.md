# Dread Stone Black — Fishing Rod Casting System

## 1. Purpose

This document is a future design and technical blueprint for a weighty first-person fishing rod casting system. It is intentionally docs-only: no gameplay, UI, control, Pond Expo, OARB, DARB, or build-base behavior should change as part of this blueprint.

The goal is to move fishing from a simple proximity-and-hold interaction toward a tactile skill system:

```text
equip rod
→ rod appears in a believable held position
→ player touches and holds the rod / cast zone
→ player drags backward to load the cast
→ player flicks forward
→ weighted hook or lure flies through world space
→ accuracy depends on gesture, timing, direction, and release
```

Fishing should become one of Dread Stone Black's tactile “feel” systems: physical, readable, satisfying to practice, and useful across authored outdoor / indoor hybrid locations.

## 2. World Context

Dread Stone Black is reaching the point where OARB outdoor systems and DARB building / interior systems can combine into mixed authored locations:

- castle + courtyard
- starter field with buildings
- outdoor village with huts and temples
- water features, ponds, streams, bridges, and fishing spots
- DARB structures embedded into OARB outdoor terrain

The game is also becoming a living museum / timeline of development progress. Pond Expo, Kerovac, OARB Feature Yard, and related locations preserve stages of the project while creating reusable systems. A future casting mechanic should respect that museum quality: early prototypes can remain legible while later systems add depth.

## 3. Desired Player Feel

Casting should feel like loading a rod and throwing a lure, not pressing a generic “fish” button.

Target feel:

- physical
- weighty
- touch-driven
- skill-based
- readable
- accurate after practice
- satisfying before any fish bite occurs

The player should be able to improve at landing a lure:

- on a specific part of a pond
- near reeds
- between boulders
- in deeper water pockets
- in stream pools
- along shore edges
- inside authored fishable hotspots

A successful system lets the player think, “I can hit that pocket,” then learn to actually do it.

## 4. Core Interaction Flow

### 4.1 Step 1 — Equip Rod

When the Fishing Rod is equipped:

- a rod appears in first-person view
- the rod reads as held by the player
- full player arm sprites are not required
- the representation can be a lightweight 3D rod model or FPV rod overlay
- the rod tip remains visible enough to communicate motion, bend, and aim

The held pose should be believable rather than anatomically complete. The rod can occupy a lower-right or lower-center screen position, with the tip extending into view.

### 4.2 Step 2 — Touch and Hold Rod

On mobile:

- the player touches / holds the rod or a casting control zone
- holding begins cast preparation
- the rod becomes active
- camera movement must not fight the rod gesture
- UI state must clearly distinguish look movement from rod dragging

On desktop:

- mouse hold / drag can map to the same cast gesture
- keyboard fallback can exist later
- touch remains the design target

The first implementation should treat “cast mode active” as a temporary state that captures the relevant pointer / touch input until release or cancel.

### 4.3 Step 3 — Drag Backward to Load Cast

The player drags backward / downward to bend and load the rod.

Important input variables:

- drag distance
- drag direction
- drag duration
- drag smoothness
- rod bend amount
- cast power
- aim angle

The rod should visibly respond:

- rod tip bends backward
- line tightens
- hook / lure pulls back
- subtle tension feedback appears

The system should reward a steady, intentional pull more than a jittery gesture. The player should feel the rod accumulating energy.

### 4.4 Step 4 — Flick Forward to Release

The player flicks forward and releases.

The system reads:

- release velocity
- release direction
- release timing
- loaded power
- rod angle
- camera yaw / pitch

Then it launches the hook / lure. The lure should not teleport to a fishing result. It should travel through world space with a readable arc.

## 5. Hook / Lure Physics

The hook / lure should use lightweight physics. Full rigid-body simulation is not required for the first versions; a custom projectile simulation is acceptable.

Suggested behavior:

- start at the rod tip
- receive launch velocity
- arc through air
- fall under gravity
- land on water or ground
- create a splash if water is hit
- settle or bob if water is hit
- fail, bounce, or snag if terrain, rock, reed, tree, or other obstacle is hit

Potential simulation variables:

```js
lurePosition
lureVelocity
gravity
airDrag
lineLength
rodTipPosition
waterHitDetection
terrainHitDetection
splashOnWater
bobOnWater
```

Line length should eventually constrain maximum travel. Early prototypes can clamp max range before simulating a full line.

## 6. Casting Accuracy Model

Casting should reward skill while remaining playable on touch screens.

Accuracy factors:

- steady backward pull improves control
- clean forward flick improves distance
- release angle controls arc
- sideways gesture affects left / right aim
- too much power can overshoot
- short or sloppy gesture creates a weak cast
- reeds, rocks, branches, and tight banks can later snag or reduce success

Suggested early formula:

```text
baseDirection = camera yaw
sideOffset = horizontal flick component * sideAimScale
arc = camera pitch + vertical flick component * arcScale
power = clamp(loadAmount * releaseVelocity * rodPower, minCastPower, maxCastPower)
launchVelocity = direction(baseDirection + sideOffset, arc) * power
```

Extreme input should be clamped so the cast remains readable instead of chaotic. The system should still preserve enough variance for mastery.

## 7. Camera / Aim Relationship

The cast should combine:

- camera facing direction
- rod gesture direction
- release velocity
- selected fishing zone context

Recommended initial approach:

- camera yaw gives the base cast direction
- drag / flick modifies direction slightly
- release speed controls power
- camera pitch or vertical flick controls arc
- extreme values are clamped for playability

This keeps aiming understandable: look generally where you want to cast, then use the rod gesture for distance, arc, and fine correction.

## 8. Touch UX Options

Mobile controls are critical. The casting design must avoid conflicts with:

- left movement stick
- right look stick
- X interact
- A attack / action
- inventory / equipment buttons

### Option A — Hold X / Touch Rod to Enter Cast Mode

Flow:

- rod is equipped
- player holds X or touches the visible rod
- cast mode begins
- right-side drag controls rod load / release instead of camera look
- releasing touch casts
- lifting early or tapping another control cancels

Pros:

- uses familiar interaction entry points
- keeps the normal HUD relatively clean
- makes cast mode explicit

Cons:

- can conflict with existing interact expectations
- requires clear visual state so players know camera look is temporarily disabled
- may be awkward if X is already overloaded near water / pickups

### Option B — Dedicated Cast Zone While Rod Is Equipped

Flow:

- rod is equipped
- a dedicated cast zone appears on the right side or over the rod
- player presses and drags inside that zone
- cast zone captures the drag gesture until release

Pros:

- safest first prototype for touch separation
- easy to visually label and debug
- reduces accidental conflict with camera look and X interact

Cons:

- adds another temporary UI element
- may feel less diegetic than directly touching the rod
- needs careful placement on small screens

### Recommendation

Use Option B for the first prototype. A dedicated cast zone is easier to validate, tune, and debug without destabilizing existing mobile controls. Once the gesture feels good, the interaction can be made more diegetic by allowing direct rod touch or X-hold entry as an alternate path.

## 9. Visual and Audio Feedback

Casting should communicate state at every step.

Visual feedback:

- visible rod bend amount
- line tension
- hook / lure visible near rod tip before release
- readable launch arc
- small splash on water impact
- ripple ring at landing point
- lure or bobber idle state after landing
- prompt changes such as `Cast`, `Cancel`, `Wait`, `Reel`, or `Twitch`

Future audio / haptic feedback:

- subtle rod tension creak
- line zip during release
- lure splash
- small bobber water sounds
- optional mobile vibration on bite or snag

Even before fish biting exists, the cast should be satisfying to perform repeatedly.

## 10. Fishing Integration

Current fishing is intentionally simpler:

```text
equip fishing rod
stand near fishable pond
hold to fish
spawn raw fish pickup
```

Future fishing should evolve toward:

```text
equip rod
cast lure into fishable water
lure lands in water
wait / twitch / reel
bite chance depends on water zone + species pool
fish caught
species-based fish pickup appears near shore
```

The casting system should not remove the existing behavior until the replacement loop is ready. It should be possible to prototype casting visually before bite logic changes.

Permanent pond fish species pools should remain compatible:

- `smallRiverFish`
- `broadCarpFish`
- `longEelFish`
- `spineBackFish`
- `flatMarshFish`
- `jawHunterFish`
- `sacredGlowFish`

## 11. Water Feature Integration

The cast should work with:

- ponds
- future streams
- future rivers
- canals
- fishing holes
- shallow marshes
- deep pools

Ponds use closed water footprints. Streams and rivers should use linear ribbon footprints:

- meandering centerline
- repeating linear gully stamps
- shore / mud strips along both sides
- fishable pockets
- cast target zones

The casting system should not care whether the water body is a pond or stream. It should ask the water system questions:

- Did the lure land in fishable water?
- Which water body did it hit?
- Which species pool applies?
- How deep is the landing point?
- What shore / obstacle context surrounds it?
- Is the lure in a pocket, current, reeds, deep pool, or snag risk area?

This keeps casting generic while allowing authored water features to provide local meaning.

## 12. Possible Implementation Phases

### Phase 1 — Visual Cast Prototype

- rod appears when equipped
- drag / flick gesture is detected
- lure projectile launches
- lure lands and splashes
- no fish bite logic yet

### Phase 2 — Fishable Water Targeting

- detect lure landing in pond / stream water footprint
- register active fishing attempt at landing point
- show bobber / lure idle state

### Phase 3 — Bite / Reel Loop

- species pool selected from water body
- bite chance based on water body and lure position
- player taps, holds, twitches, or reels after bite
- catch success / failure is added

### Phase 4 — Rod Variants

Use existing rod variants:

- `reedPoleRod`
- `hookedBranchRod`
- `bronzeSpinedRod`
- `ritualBoneRod`
- `travelerWoodRod`
- `heavyRiverRod`

Rod variants can affect:

- cast power
- line length
- accuracy
- lure weight
- reel speed
- fish control
- durability later

### Phase 5 — Advanced Water Features

- stream current affects lure drift
- deep pools affect species chance
- reeds and boulders affect snagging
- special sacred fish appear in special waters
- night, day, and weather can affect behavior later

## 13. Technical Areas to Inspect Later

Likely existing code areas to inspect before implementation:

- `src/game/DungeonScene.js`
- `src/game/Interactions.js`
- `src/game/GameState.js`
- `src/game/equipment/`
- `src/game/fishing/`
- `src/engine/outdoor-authoring/OutdoorPondBuilder.js`
- `src/engine/outdoor-authoring/OutdoorTerrainBuilder.js`
- `src/game/locations/oarbOutdoorExpo.definition.js`

Potential future modules:

- `src/game/fishing/CastingController.js`
- `src/game/fishing/FishingRodView.js`
- `src/game/fishing/LureProjectile.js`
- `src/game/fishing/FishingWaterResolver.js`

Suggested responsibilities:

- `CastingController` owns input state, cast load, release reading, and cancellation.
- `FishingRodView` owns first-person rod pose, bend, line tension, and lure attachment visuals.
- `LureProjectile` owns projectile simulation, collision checks, splash / bob states, and line-length constraints.
- `FishingWaterResolver` owns water-body lookup, species-pool selection, depth context, and obstacle / shore metadata.

## 14. Non-Goals for This Blueprint

Do not implement this system now.

Do not change:

- current fishing gameplay
- Pond Expo
- OARB
- DARB
- player controls
- mobile UI
- Vite base `/Dread_Stone_Black/`

This document is a planning artifact for a later gameplay PR.

## 15. Prototype Acceptance Notes

A future Phase 1 prototype should be considered successful when:

- the rod appears only when equipped
- touch / mouse drag can load a cast
- forward release launches a visible lure
- the lure travels through world space
- water impact creates a small splash and idle bob state
- terrain impact fails or bounces clearly
- no fish bite logic is required
- existing fishing can remain intact during the experiment

The first playable milestone is not “catch a fish.” It is “casting feels good enough that players want to practice it.”
