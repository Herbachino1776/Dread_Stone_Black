# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: d15407e34a017b299e03134a0840c557f018b647 -->

## Current Handoff Snapshot

### Verified implementation

- **Dreadguard remains the canonical humanoid combat character.** Folsom Field and Combat Lab use `public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb`, its Forge manifest, and validation report through `DREADGUARD_DAMAGE_COMBAT_PROFILE` in `src/game/combat/HumanoidModelProfiles.js`.
- **The Forge manifest remains authoritative for character segmentation and progressive damage.** Runtime validation owns intact objects, attached/detached relationships, deformation regions, morph targets, generated gore nodes, progressive sites, stage anchors, and ownership transfer.
- **Progressive mace damage now floors accepted hits at an exact authored stage.** `ForgeDamageDeformationRuntime.js` accepts glancing, committed, and heavy blunt classifications for progressive sites, while non-damaging contacts remain rejected. A sub-Light interpolated deformation may exist visually without claiming a named stage or showing stage gore; the next qualifying hit resolves to exact Light rather than accidentally consuming it.
- **The left-head progressive proof remains Light → Medium → Heavy.** Light is non-terminal, Medium is non-terminal, and Heavy is the terminal fatal commitment point. Named stage diagnostics and gore state now remain `null` until an exact stage anchor is reached.
- **The Dreadstone sword now uses a uniform authoritative combat scale of `0.85`.** Source dimensions are retained separately, then scaled for collision primitives, maximum penetration, blade geometry, fallback presentation, and diagnostics. The workspace is offset to preserve prior tip reach despite the smaller model.
- **Close-range sword thrust entry has a second authored probe.** A thrust first sweeps the actual tip; when that misses, it sweeps from the blade heel to catch close enemies already inside the tip path. Successful heel-probe entry reconstructs the actual tip impact position before routing impalement, and diagnostics track tip versus blade-heel entry sweeps/hits.
- **Sword collision and presentation scale are unified.** The GLB visual root and fallback visual receive the same `0.85` scale used by combat dimensions and contact radii, reducing visible-versus-physical mismatch rather than scaling presentation alone.
- **The exported Dreadguard rest pose remains authoritative while alive.** The profile remains non-animation-authoritative, normalizes to 1.5 m, applies the authored-axis yaw correction, drives kinematic proxy bodies, and hands off to dynamic ragdoll on terminal collapse.
- **Folsom close-combat systems remain active.** Tight walker hold spacing, player/enemy separation, knife-parity sword impalement and planted reacquisition, direct physical Dreadmace control, weighted piercing lethality, combat audio, ambience, showcase dismemberment, and persistent mace acquisition remain unless superseded above.
- **Regression coverage was extended.** Sword tests now assert the 0.85 source-to-runtime dimension contract, preserved tip reach, scaled visual roots, and close-range blade-heel entry behavior. Dreadguard tests now assert that sub-Light blends do not claim Light or stage gore, glancing hits resolve exact Light, and non-damaging contacts do not advance the site. The record does not claim tests, build, validation, or CI executed successfully.

### Important design decisions

- The Forge manifest, not JavaScript naming conventions, owns progressive stage identities, anchors, morph bindings, and gore ownership.
- Interpolated deformation below the first authored anchor is not an exact damage stage. Named stage and gore state begin only when an authored anchor is reached.
- Glancing blunt impacts are permitted to produce the exact Light progressive stage; non-damaging contact classifications are not.
- Sword render scale, collision dimensions, contact primitives, and penetration limits must share one authoritative scale constant.
- Reducing sword size must not silently reduce practical forward reach; workspace compensation preserves the prior tip envelope.
- Close-range impalement may use an interior blade-entry probe only as a fallback after the true tip sweep misses, while routed impact geometry remains based on the actual sword tip.

### Risks, inference, and next logical work

- **Verified risk surface:** The close-range blade-heel probe broadens entry detection. Live validation should confirm it fixes enemies already inside the tip arc without producing side-on or behind-the-guard false impalements.
- **Verified risk surface:** Sword reach compensation preserves the tip envelope while the guard, grip, thickness, and contact radii shrink. Collision feel near the hand and at oblique angles may therefore change independently from maximum reach.
- **Verified risk surface:** Allowing glancing blunt classification to advance progressive damage makes classification thresholds presentation-critical. Repeated low-energy contacts must be checked to ensure they do not qualify unexpectedly.
- **Verified risk surface:** Sub-Light morph weight can exist with no named stage or gore. Diagnostics and debug tooling must continue to distinguish interpolated visual state from exact stage ownership.
- **Inference:** The sword changes appear intended to improve visual proportion and close-body impalement reliability, but the diffs do not establish final scale approval or gameplay feel.
- **Next logical work:** Run the focused sword and Dreadguard tests plus `npm run validate:combat`, `npm run validate:folsom`, and `npm run build`. In live play, verify sword visual/collider alignment, preserved forward reach, close-range chest/head thrust entry, no heel-probe false positives, planted extraction/reacquisition after heel entry, Light/Medium/Heavy mace progression, sub-Light diagnostic state, glancing-hit qualification, and rejection of non-damaging contacts.

## Development History

### 2026-07-29 18:30 EDT — Update through `d15407e`

**Scanned range:** after canonical checkpoint `1b8c21224e7eae35b332dfcd43404f3b3bb14abf` through observed `main` HEAD `d15407e34a017b299e03134a0840c557f018b647`. The `71ce2a1` devlog self-update was ignored. Merge commit `fd0beaa` was also excluded because its recorded diff was limited to restoring `docs/DREADSTONE_DEVLOG_HANDOFF.md`. Two development commits were included.

**Included commits, chronological:**

- `c406b53` — fix(combat): tighten sword scale and close-range impalement
- `d15407e` — fix(combat): floor mace damage at exact light stage

**Grouped development steps:**

1. **Authoritative sword scale and reach preservation**
   - Added `DREADSTONE_SWORD_MODEL_SCALE = 0.85` in the sword combat controller and retained unscaled authored measurements as `DREADSTONE_SWORD_SOURCE_DIMENSIONS`.
   - Derived runtime bounds, blade/guard/grip measurements, contact radii, maximum penetration depth, and fallback geometry scale from the shared constant.
   - Applied the same scale to the loaded GLB visual root and fallback visual root, and exposed the authoritative scale through visual metadata/diagnostics.
   - Offset ready/min/max workspace points by the lost tip length so the smaller sword preserves the prior forward tip reach.

2. **Close-range sword impalement fallback**
   - Replaced tip-only thrust resolution with an entry resolver that first sweeps the tip, then conditionally sweeps a blade-heel probe when the tip finds no collider.
   - Reconstructs the actual tip location at the fallback time of impact before target routing, preserving tip-authored penetration geometry.
   - Added counters and last-probe diagnostics for close-range sweep attempts and successful heel-probe entries.
   - Expanded sword regression coverage for scaled source/runtime dimensions, contact primitives, visual scale, preserved reach, and close-range entry behavior.

3. **Exact-stage progressive mace floor**
   - Added `glancingBlunt` to qualifying progressive-impact classifications while retaining rejection of `nonDamagingContact`.
   - Changed progressive state so interpolated severity below the first exact anchor reports no `stageIndex`, `currentStage`, or stage gore rather than defaulting to Light.
   - Added regression coverage proving a sub-Light blend can carry partial morph weight without consuming Light or showing gore, and that the next qualifying glancing hit resolves exactly to Light before Medium and Heavy.

4. **Validation evidence**
   - Tests were added or changed in the commits. No successful test, build, validation, or CI execution is asserted by this record.

### 2026-07-29 13:59 EDT — Update through `1b8c212`

**Scanned range:** after canonical checkpoint `02545e2` through observed `main` HEAD `1b8c21224e7eae35b332dfcd43404f3b3bb14abf`. The prior `fd921cc` commit (`docs(devlog): update through 02545e2`) was ignored as a devlog-only self-update. Four development commits were included.

**Included commits, chronological:**

- `aada212` — combat testjg
- `148a9a5` — updates
- `7d86daa` — update
- `1b8c212` — fix(combat): close Folsom enemy spacing and facing

**Grouped development steps:**

1. **Testman-to-Dreadguard canonical migration and asset production**
   - Replaced Testman damage/animation assets and profile usage with `public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.{glb,json}` plus validation output.
   - Replaced `tests/testman-damage-segments.test.mjs` with `tests/dreadguard-damage-segments.test.mjs`; updated combat, Folsom, audio, puncture, fish-baseline, and validation references.
   - Added texture-rebuild handoffs, Blender/Python processing scripts, intermediate and packaged GLB/Blend/texture deliveries, contact/verification renders, and Folsom enemy/bandit image outputs under `output/` and `tmp/`.
   - The same commit replaced the canonical devlog with a focused Dreadguard handoff and removed its checkpoint/history; this devlog update restores the required canonical structure while recording the development changes.

2. **Manifest-driven progressive Dreadguard damage**
   - Expanded `ForgeDamageDeformationRuntime.js`, `HumanoidDamageSegmentRuntime.js`, `HumanoidGlbVisualAdapter.js`, `HumanoidCombatActor.js`, and Folsom integration for manifest-owned progressive sites, adjacent crossfades, midpoint gore replacement, exact stage diagnostics, and detachment ownership transfer.
   - Established the left-head Light/Medium/Heavy proof site and development console commands.

3. **Exported-rest-pose authority**
   - Added `restPoseAuthoritative` profile handling and `isHumanoidPoseAuthoritative()` routing.
   - Normalized the Dreadguard to 1.5 m, captured exported bone transforms, updated kinematic proxy and blocker sizing, preserved wound/damage updates, and allowed terminal handoff to ragdoll without requiring an animation mixer.

4. **Progressive lethality and gore presentation correction**
   - Restricted progressive site advancement to committed/heavy blunt impacts.
   - Prevented non-terminal progressive head stages from taking the generic immediate-collapse path, and made the terminal stage the fatal commitment point.
   - Removed the earlier delayed-fatal mace-head state, added a deterministic `solidHeadImpact()` debug command, and prepared gore meshes with render order, polygon offset, disabled frustum culling, and material diagnostics.

5. **Folsom facing and melee-spacing fix**
   - Declared the asset's authored `+Y` forward axis and applied a `Math.PI` profile yaw.
   - Tightened Folsom walker stop/hold/resume distances around the unchanged 0.95 m collision envelope.
   - Added regression assertions for facing, deterministic coordinate-space setup, and close-range stopping behavior.

6. **Validation evidence**
   - Tests and validation scripts were added or changed across the range. No successful test, build, or CI execution is asserted by this record.

### 2026-07-20 22:02 EDT — Update through `02545e2`

**Scanned range:** after checkpoint `76c7ea8` through observed `main` HEAD `02545e2c69c8ff7d4f96e59f13f83668d92c2a6a`. The intervening `0fc30f2` devlog-only commit was ignored.

**Included commits:** `8d5451e` — new mace; `02545e2` — fix gore overlay.

- Regenerated the Testman Forge damage GLB/manifest/validation contract with authored head/body deformation, paired attached/detached morphs, procedural impact stamps, and gore ownership.
- Added `ForgeDamageDeformationRuntime.js` and routed blunt impact, lifecycle, reset, diagnostics, and ownership transfer through actor/segment/visual/Folsom systems.
- Added the then-current 0.12-second fatal head reaction delay; this behavior was superseded by `7d86daa` terminal progressive-stage lethality.
- Made gore subtree visibility authoritative and expanded Testman regression coverage. No test execution was asserted.

### 2026-07-18 14:00 EDT — Update through `76c7ea8`

**Scanned range:** after checkpoint `c0fdbea` through observed HEAD `76c7ea885790c153ef710457174c80a847da7948`; ignored devlog-only `99f3569`.

**Included commits:** `dfa2155`, `27a9916`, `97d21dc` — Fix sword impalement grab stickiness; `76c7ea8` — Fix player trapping against close enemies.

- Iterated sword planted release/reacquisition, same-target collision suppression, body-local anchoring, knife-parity penetration/withdrawal resistance, extraction/cleanup, life-state integration, and diagnostics.
- Added authoritative player/enemy separation in `ActorSeparation.js` and `Collision.js`, including tangential escape, bounded depenetration, stable blocker ordering, walker close-range handling, blocker lifecycle release, and debug data.
- Expanded puncture and actor-separation tests; no test execution was asserted.

### 2026-07-17 01:59 EDT — Update through `c0fdbea`

**Included commit:** `c0fdbea` — Add player-authored mace hammer rotation.

- Added grip-travel-driven raise/cocked/downstroke/recovery phases, authoritative rotational physics, canonical non-identity ready pose, projected handle-capsule acquisition, diagnostics, and focused Dreadmace tests.

### 2026-07-16 17:58 EDT — Update through `37e5de4`

**Included commit:** `37e5de4` — Unify direct mace and sword control.

- Reworked Dreadmace into direct thumb-controlled physical motion with strike qualification, tokens, target limits, resistance, retained grip, and pose-unity diagnostics.
- Unified sword visible/physical transform and extraction continuity.
- Added a 0.01 m visible-to-physical edge gate for authored Folsom dismemberment and expanded combat diagnostics/tests.

### 2026-07-16 14:00 EDT — Update through `8011cac`

**Included commit:** `8011cac` — Polish Folsom weapon lethality and presentation.

- Added region/depth-sensitive piercing lethality and forced authored fatal transitions.
- Preserved weapon contact and single-shot detachment during dying until grounded.
- Added shared `WeaponViewmodelAnchor.js`, embed/extraction reparenting continuity, Dreadmace free-aim/return polish, and regression coverage.

### 2026-07-16 10:03 EDT — Bootstrap through `d834905`

**Scanned range:** latest ten non-devlog commits `7873996` through `d834905`; checkpoint set to observed HEAD.

**Included commits:** `7873996`, `8710f9f`, `720ead0`, `b09001d`, `e2b5896`, `f134156`, `f028758`, `43b4f53`, `6087407`, `d834905`.

- Added and cleaned up Folsom ambience and combat audio assets.
- Implemented the downward-smash Dreadmace vertical slice and blunt-impact routing.
- Integrated accepted stab/death audio with owner-scoped runtime cleanup.
- Added Folsom daytime ambience loops/spatial one-shots and diagnostics.
- Added Folsom showcase walkers, sword-sweep dismemberment, fatal-segment synchronization, persistent courtyard Dreadmace progression, and expanded validation coverage.