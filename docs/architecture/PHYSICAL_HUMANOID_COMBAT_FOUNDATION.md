# Physical Humanoid Combat Foundation

## Launch and scope

The development laboratory is available in development builds at `/?combatLab=1`. It bypasses the title selection, creates an isolated scene, grants and equips the existing `old_work_knife` item ephemerally, and never writes equipment or actor state to the canonical save. The lab has flat ground, a body-contact wall, daylight, a source-local night light, a safe player spawn, and one standing humanoid.

This stage deliberately contains no combat AI, navigation, attacks, blocking, loot, dismemberment, or medical simulation.

## Physics decision and ownership

`@dimforge/rapier3d-compat` is the only new runtime dependency. Rapier is package-managed, permissively licensed, actively maintained, WebAssembly-backed, and supplies stable rigid bodies, colliders, impulse joints, collision filtering, sleeping, and shape casting at a cost appropriate to one mobile humanoid. It is isolated behind `CombatPhysicsWorld`; game code does not create competing global physics worlds.

The combat world uses a 60 Hz fixed step, at most four catch-up steps, a 100 ms accepted frame delta, render interpolation state, bounded body velocity, and a suspension guard that discards deltas over 500 ms. `CombatLabScene` owns the world, fixed environment bodies, actor, and attached weapon controller. Disposal removes the actor, constraints, listeners, pooled wounds, and Rapier world. Reset removes and recreates exactly the actor's bodies and joints without recreating the world.

The actor has 18 dynamic bodies and 17 impulse joints. It uses boxes for pelvis/chest/feet/hands and capsules for spine, head, arms, and legs. Actor colliders collide with the environment but not one another. Authored mass totals 71.3 kg, with high friction at the feet, low restitution, and region-specific physical-animation strength.

## Humanoid actor and visuals

`HumanoidCombatActor` permanently separates these responsibilities:

- semantic anatomy and authored tissue data;
- Rapier bodies, colliders, and joints;
- physical-animation motors and balance state;
- regional wounds and trauma;
- life/consciousness transitions;
- procedural player-facing visuals;
- optional debug collision presentation.

The visible adult male is built from layered, lit Three.js geometry rather than exposed collision capsules or a GLB. The construction includes a patched dark wool silhouette, trousers, square-toed boots, leather bindings, belt and iron buckle, complete articulated limbs and hands, and a modeled weathered head. The face has a broken nose, ears, pale recessed eyes and pupils, lowered asymmetrical brows, facial weather lines, a scar, clenched mouth, moustache, short beard, and rough mixed dark/gray hair locks. All player-facing surfaces use `MeshStandardMaterial`, receive source lighting, cast/receive bounded shadows, and have no emissive skin, clothing, or eyes.

At night the ambient and sun sources go effectively black. A bounded orange point source then reveals only nearby surfaces, so the actor does not become globally full-bright.

## Semantic anatomy

The authored regions are `head`, `face`, `skull`, `neck`, `upper_chest`, `lower_chest`, `abdomen`, `pelvis`, left/right `upper_arm`, `forearm`, `hand`, `thigh`, `lower_leg`, and `foot`. Collision resolution maps a collider handle to a body and semantic region; head-local contact further resolves face versus skull. Visual mesh names are never combat authority.

Each region declares surface thickness, tissue resistance and depth, optional hard structure and depth, hard resistance, vital class, pain, structural importance, consciousness impact, balance impact, and a Prompt 2 blood-profile placeholder. Chest rib contact is spatially banded, neck hard contact depends on the central path, and head contact encounters hard structure early. One coarse skeleton therefore does not make every chest path bone, while head penetration remains difficult.

## Upright physical animation, trauma, and collapse

The standing actor is never static. Per-body bounded PD-style impulses and torque impulses drive the articulated body toward an authored tense pose. Feet and pelvis receive stronger control, torso bodies breathe subtly, the stance shifts slightly, and the head turns within a limited range toward the player. Constraints and Rapier collisions remain authoritative; motors do not teleport bodies.

Penetration adds regional trauma, pain, structural weakness, balance impairment, consciousness impairment, and bounded impulses at the actual entry point. The contacted part leads the reaction. Leg trauma contributes substantially more balance loss than arm trauma; neck/head/chest trauma carries greater consciousness and structural effects.

Thresholds progress through `alive`, `incapacitated`, `dying`, and `dead`. Incapacitation progressively weakens motors, dying releases them faster, and death reaches zero control. Existing impulse and embedded-weapon force remain, knees/hips fold through joints, environment collision shapes the fall, sleeping/damping settle the body, and the corpse remains present. Reset reconstructs a clean living stance and clears all wounds and embedding.

## Old movement failure and replacement

The old work-tool path in `PhysicalToolViewmodel.getDesiredMotion` converted pointer `deltaX`/`deltaY` into camera-local X/Y translation and pitch/yaw/roll. Z travel was only `-0.08 * min(1, travelPx / 90)`. `getProjectedActivePoint` projected that animated camera-local point into screen pixels, and `PhysicalToolActionController.pointerMove` checked a 2D screen sweep through `PhysicalToolTargetRegistry`. That is the exact center-seeking/screen-space failure: the visible action and receiver contact were projections, not an authoritative blade moving into the world.

The authored cut/chop/pry path remains intact for canonical environmental targets. In the combat lab, the old knife viewmodel and its screen sweep are suppressed. `WorldKnifeCombatController` owns one authoritative pose containing previous/current/desired grip position, previous/current/desired quaternion, normalized blade-forward axis, tip, cutting-edge endpoints, and desired/actual hand transforms. The visible knife group receives the exact authoritative position and quaternion; the swept collision tip derives from those same values. A validator enforces the transform tolerance.

## Hand workspace and touch control

The hand workspace is a camera-relative bounded box entirely in front of the near plane. Its authored relaxed/ready pose, lateral reach, vertical reach, thrust distance, follow rates, input sensitivity, maximum translation velocity, and maximum penetration are in `CombatConfig.js`.

Dragging from the projected knife grip adjusts lateral and vertical hand aim without capturing ordinary look touches elsewhere. Camera aim and this hand offset establish blade orientation. The ATTACK button is pressure control: touch begins with zero automatic insertion; dragging upward advances from the current extension, holding or releasing preserves the chosen hand/depth request, and a later downward gesture withdraws. On desktop, Space advances and Shift withdraws. Visibility change, page hide, unequip, invalid target, scene disposal, and reset all cancel embedding safely.

The desired hand pose follows the camera, input, and workspace. The achievable pose moves toward it under maximum linear/angular rates. A thrust is simply increasing camera-local negative Z while retaining the blade's chosen quaternion, so up/down/left/right/downward orientations preserve their world path. No target is queried to aim the knife, and no torso, reticle, or camera center is passed to the solver. A miss is a normal result.

## Contact and penetration flow

Rapier sphere shape-casting sweeps the previous tip to the proposed current tip to prevent tunneling. Queries are active only while the existing knife item is owned and equipped. Actor collider handles resolve semantic anatomy. One active entry owns the penetration state, preventing duplicate penetration-start events.

The state vocabulary is `no_contact`, `blunt_contact`, `edge_contact`, `glancing_contact`, `tip_contact`, `failed_penetration`, `surface_puncture`, `active_penetration`, `embedded`, `bone_contact`, `withdrawal`, and `fully_extracted`. Classification considers the contacting weapon part, actual tip velocity, motion/blade alignment, regional tissue resistance, current depth, region thickness, hard depth, and prior entry ownership.

After entry, the wound point and penetration axis are stored in the struck body's local frame. Every physics step reconstructs them from body motion. Forward input requests greater depth; backward input requests less. Tissue resistance rate-limits both. Hard structure raises resistance and clamps depth. The constrained tip remains on the wound path, while lateral desired/actual error applies bounded impulse at the entry point. Large lateral withdrawal can force a safe extraction rather than permit impossible clipping or infinite energy accumulation.

First-pass feedback uses pooled dark puncture marks, localized physical impulses, restrained shake, and short haptics. There are no large blood clouds or unbounded decals.

## Debug controls and diagnostics

The lab panel is normal only in the lab. Controls are:

- `R`: reset/respawn actor, clear wounds, clear embedding, and restore standing state;
- `K`: restore/equip the existing Old Work Knife;
- `B`: toggle anatomy bodies plus weapon/workspace/debug paths;
- `P`: freeze/unfreeze physics;
- `O`: switch 100%/20% physics time;
- `N`: switch neutral day/source-local night;
- `M`: collapse/expand the diagnostic readout.
- `I` / `U`: deterministic debug-only 10 cm push/pull increments for frame-by-frame contact inspection (the normal ATTACK drag remains the production touch path).

Debug drawing includes anatomy bodies, the camera-relative workspace, desired and actual hand markers, grip, tip, cutting edge, forward axis, previous/current swept tip segment, camera center ray for comparison, entry point, penetration axis/depth, and semantic body labels through object metadata. The panel reports frame/physics duration, bodies, constraints, contacts, sweeps, reset/resume counts, actor state, motor strength, balance, consciousness, wounds, regional trauma, representative body positions, knife state/reason, world transform, desired/actual hand, forward axis, depth, speed, and visible/collision divergence.

## Mobile budget

The lab keeps one world, 20 total bodies including ground/wall, 17 constraints, bounded queries, 12 pooled wound marks, shared actor materials, no per-frame geometry/material construction, 1024px sun shadow, no self-collision, and no critical-mechanic quality downgrade on mobile. Rapier is loaded in the main game chunk today; code splitting is a later packaging optimization, not a mechanics change.

## Deferred to Prompt 2

Prompt 2 owns slash wound expansion, directional/arterial blood, richer wound persistence and decals, sound layers, final haptic tuning, more detailed death presentation, and audiovisual polish. Prompt 1 intentionally leaves the procedural body as the first production character technique rather than a GLB pipeline, and joint-limit debug arcs are represented by authored limits/data rather than rendered cones. Combat AI and enemy attacks remain out of scope.
