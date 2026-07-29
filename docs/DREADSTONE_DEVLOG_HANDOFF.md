# Dreadstone Black 2.0 Development Handoff

<!-- last_processed_sha: 1b8c21224e7eae35b332dfcd43404f3b3bb14abf -->

## Current Handoff Snapshot

### Verified implementation

- **Dreadguard is now the canonical humanoid combat character.** Folsom Field and Combat Lab use `public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb`, its manifest JSON, and validation report through `DREADGUARD_DAMAGE_COMBAT_PROFILE` in `src/game/combat/HumanoidModelProfiles.js`. The previous Testman damage bundle, animation-pack files, profile references, diagnostics document, and Testman-focused tests were removed or replaced.
- **The Forge manifest is authoritative for combat-character structure and damage.** Runtime validation consumes intact objects, segments, attached/detached relationships, deformation regions, morph targets, generated gore nodes, and progressive-damage sites. Missing/duplicate nodes, invalid parenting, missing morphs, ownership inconsistencies, and invalid stage bindings are rejected.
- **The current progressive-damage proof is a left-head site.** Site `damage_site` uses region/group `head`, `ADJACENT_CROSSFADE`, `SMOOTHSTEP`, and `MIDPOINT_REPLACE`. Its exact stage mapping is Light at `0.33000001311302185` -> `Left_Head_Impact_v003`, Medium at `0.6600000262260437` -> `Left_Head_Impact_v002`, and Heavy at `1` -> `Left_Head_Impact_v001`.
- **Progressive mace damage is impact-qualified and terminal-stage lethal.** `ForgeDamageDeformationRuntime.js` only advances progressive sites for committed/heavy blunt classifications. It reports stage index/count and terminal-stage state. Earlier progressive head stages preserve neurological integrity above the collapse boundary; reaching the terminal stage commits fatal head-impact behavior and ragdoll/collapse without the superseded 0.12-second pending-fatal delay.
- **Gore presentation is explicitly prepared.** Managed gore mesh subtrees disable frustum culling, receive a fixed render order and polygon offset, and expose visible material/render diagnostics. Attached/detached ownership transfer remains subtree-authoritative.
- **A deterministic Folsom debug path exists.** Development builds expose `__DSB_DREADGUARD_DAMAGE__` commands for Light, Medium, Heavy, next stage, a synthetic solid head impact, reset, deformation diagnostics, and character diagnostics. No production UI is added.
- **The exported rest pose is authoritative while alive.** The Dreadguard profile is non-animation-authoritative but `restPoseAuthoritative: true`, uses `noAnimationFallback: 'exported_rest_pose'`, normalizes to a 1.5 m target height, captures/restores exported bone transforms, drives kinematic proxy bodies from that pose, and hands off to dynamic ragdoll only on collapse/death. The GLB's embedded walk clip remains intentionally ignored because no approved animation pack is declared.
- **Dreadguard authored facing is corrected.** The profile records authored forward as `+Y` and applies `rootYaw: Math.PI` so the exported character faces runtime forward rather than gliding backward. Deterministic puncture-space fixtures now include the profile yaw.
- **Folsom enemy hold distance is tightened to the melee envelope.** `FOLSOM_WALKER_CONFIG` now uses stop target `1.0`, stop-enter `1.08`, resume `1.42`, and slow distance `1.9`, while preserving the weapon-authored minimum collision distance of `0.95`.
- **Asset-production work was checked in.** The range adds Blender texture-rebuild handoffs, scripts, intermediate/rebuilt textures, Blender/GLB deliveries, verification renders, image-generation sources, and a v6 packaged retexture under `output/blender_texture_rebuild/`, plus Folsom enemy/bandit image outputs. These are repository artifacts; the diffs alone do not establish final visual approval.
- **Regression coverage was rewritten around Dreadguard.** `tests/dreadguard-damage-segments.test.mjs` replaces the Testman segment suite, and combat foundation, walker, Folsom, puncture-coordinate, puncture-only, accepted-audio, and validation scripts were updated. Added assertions cover bundle identity, exact progressive mappings, rest-pose authority, forward-axis correction, gore presentation, staged mace outcomes, detachment ownership, and close melee spacing. The record does not claim these tests or CI executed successfully.
- **Earlier active systems remain unless superseded above:** direct physical Dreadmace control, knife-parity sword impalement and planted reacquisition, selective embedded collision routing, authoritative player/enemy separation, shared weapon-viewmodel ownership, weighted piercing lethality, combat audio, Folsom ambience, showcase dismemberment, and persistent mace acquisition.

### Important design decisions

- The exported Forge manifest, not JavaScript naming conventions, owns character segmentation, progressive sites, morph bindings, and gore ownership.
- Living Dreadguard pose authority comes from the exported rest pose. Embedded animation is not treated as approved gameplay animation.
- Progressive head damage must visibly advance through authored stages; non-terminal qualified hits do not trigger ordinary blunt head-collapse logic, while the terminal stage commits the fatal result.
- Progressive stages crossfade only between adjacent morphs, with at most two active stage morphs; detailed gore replaces at the midpoint rather than stacking.
- Runtime forward must explicitly account for the asset's authored axis through the profile yaw.
- Walker stopping distances must remain outside the player collision envelope but close enough for melee interaction.

### Risks, inference, and next logical work

- **Verified risk surface:** The Dreadguard contract is tightly coupled to exact object, bone, morph, segment, fingerprint, progressive-site, and generated-gore identities. Re-exported assets require manifest and validation synchronization.
- **Verified risk surface:** Rest-pose kinematic authority, wound updates, progressive deformation, detachment transfer, and terminal ragdoll now cross actor, adapter, segment runtime, physiology, and Folsom encounter lifecycles. Ordering mistakes could create pose jumps, duplicate ownership, stale gore, or premature collapse.
- **Verified risk surface:** The committed/heavy classification gate means low-classification mace contacts no longer advance the progressive site. Strike classification and damage presentation should be verified together in live play.
- **Inference:** The checked-in texture-rebuild iterations and verification renders indicate active visual iteration, but the diffs do not prove which variant is approved for runtime use or that all angles/material responses are satisfactory.
- **Next logical work:** Run `npm run validate:combat`, `npm run validate:folsom`, `npm run build`, and the focused Dreadguard/Folsom tests. Manually verify the 1.5 m rest pose, forward orientation, close-range walker hold behavior, Light/Medium/Heavy head progression, insufficient-impact rejection, terminal-stage death/ragdoll, gore visibility at camera/frustum edges, attached-to-detached ownership transfer, reset, puncture coordinate alignment, and the selected retexture under gameplay lighting.

## Development History

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
