# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: d834905ddfe74bd2914a4837243dd253161662fa -->

## Current Handoff Snapshot

### Verified implementation

- **Folsom combat showcase:** The Folsom encounter now uses the damage-segment Testman profile, adds two additional walker slots, supports authored sword-sweep dismemberment, synchronizes fatal segment detachment with walker/death-controller state, and adds stationary showcase spawn/blocker handling. The courtyard progression now includes a persistent `dreadstone_mace` chest reward, with save-state and equipment restoration support.
- **Dreadmace vertical slice:** A right-hand Dreadmace combat path is implemented around a downward smash gesture. The combat director accepts blunt-impact interactions, derives trauma, emits reactions/audio/camera/haptics, and routes resulting actor damage. Combat Lab controls and diagnostics can equip and inspect the mace independently from knife and sword paths.
- **Accepted combat audio:** Six sword-stab flesh one-shots and twelve male death-sigh one-shots were added and registered. The audio runtime gained `combat` and `voice` buses, cancellable owner-scoped one-shots, voice-group concurrency limits, dynamic position providers, and explicit owner cleanup. Combat feedback now has dedicated accepted stab/death playback coverage.
- **Folsom daytime ambience:** Five authored ambience assets are integrated: base and grass loops, two distant-life one-shots, and one wood-settle one-shot. Runtime configuration resolves authored foliage/structure anchors, blends activity from day weight, schedules randomized spatial emitters, fades loops on location exit, and exposes ambience diagnostics in the performance panel.
- **Validation coverage:** `validate:combat` now includes accepted-combat-audio, Dreadmace, Folsom showcase, and damage-segment tests. `validate:folsom` includes Folsom combat showcase and daytime ambience tests. Dedicated `validate:folsom-ambience` coverage exists. These are verified script/test additions; this handoff does not claim that CI or the full suites passed during these commits.
- **Asset-pipeline cleanup:** Temporary zero-content placeholder paths named `te` and `ye` were created and then deleted around the audio uploads. The retained binary assets are the named Folsom ambience and combat WAV files.

### Important design decisions

- Knife, sword, and mace remain separate weapon/interaction paths rather than one generalized damage gesture.
- Structural detachment is still constrained to the explicit Folsom showcase dismemberment path; tests guard against ordinary weapon code directly requesting detachment.
- Combat audio playback is owner-addressable so death vocals and other cancellable one-shots can be stopped when actors reset, despawn, or finish their lifecycle.
- Folsom ambience positions are resolved from the canonical authored location definition rather than duplicated world coordinates.
- The Dreadmace is now a persistent Folsom acquisition, while Combat Lab may still grant ephemeral development equipment.

### Risks and next logical work

- **Verified risk:** The latest changes are broad and cross-cut combat lifecycle, equipment persistence, audio concurrency, and Folsom spawning. Regression-sensitive areas include actor reset/despawn cleanup, simultaneous death voices, dismemberment state transitions, and persistent mace restoration.
- **Inference:** The showcase configuration appears intended as a controlled vertical slice rather than final encounter balance. Additional playtesting is likely needed for spawn spacing, gesture thresholds, blunt trauma tuning, dismemberment frequency, and audio mix levels.
- **Next logical work:** Run the expanded combat and Folsom validation commands, manually exercise Folsom through repeated death/respawn and location transitions, verify no owner-scoped audio leaks, confirm mace chest persistence across reloads, and inspect multi-actor showcase behavior under simultaneous combat events.

## Development History

### 2026-07-16 10:03 EDT — Bootstrap through `d834905`

**Scanned range:** `7873996` through `d834905` (latest 10 non-devlog commits; checkpoint set to observed `main` HEAD `d834905ddfe74bd2914a4837243dd253161662fa`).

**Included commits, chronological:**

- `7873996` — Add files via upload
- `8710f9f` — Create te
- `720ead0` — Delete public/audio/combat/te
- `b09001d` — Create ye
- `e2b5896` — Add files via upload
- `f134156` — Delete public/audio/combat/ye
- `f028758` — Implement downward-smash Dreadmace vertical slice
- `43b4f53` — Integrate accepted stab and male death audio
- `6087407` — Integrate Folsom daytime ambience
- `d834905` — Add Folsom combat showcase dismemberment

**Grouped development steps:**

1. **Audio assets and cleanup**
   - Added Folsom daytime ambience WAVs under `public/audio/ambience/`.
   - Added sword stab and male death WAVs under `public/audio/combat/`.
   - Removed temporary placeholder files `public/audio/combat/te` and `public/audio/combat/ye`.

2. **Dreadmace combat slice**
   - Added blunt-impact interaction/trauma handling in combat systems and actor routing.
   - Added downward-smash gesture state, diagnostics, Combat Lab equip controls, and dedicated tests.
   - Extended development equipment loading for sword/mace in Combat Lab.

3. **Accepted combat audio integration**
   - Registered stab/death cues in the audio manifest.
   - Added owner-scoped cancellation, voice limits, spatial position providers, and cleanup APIs in the audio runtime.
   - Routed accepted penetration/death lifecycle events into combat audio with test coverage.

4. **Folsom daytime ambience integration**
   - Added authored ambience configuration and runtime scheduling for loops and randomized spatial one-shots.
   - Resolved emitters against canonical Folsom foliage and structure definitions.
   - Added diagnostics and Folsom ambience validation.

5. **Folsom combat showcase and progression**
   - Added extra showcase walkers and explicit sword-sweep dismemberment support.
   - Updated death/walker synchronization for fatal segment detachment.
   - Added persistent Dreadmace acquisition from a Folsom courtyard chest.
   - Expanded Folsom/combat tests and validation scripts for showcase spawning, damage segments, persistence, and detachment boundaries.
