# Physical Humanoid Combat Foundation

## Launch and scope

The development laboratory is available in development builds at `/?combatLab=1`. It bypasses the title selection, creates an isolated scene, grants and equips the existing `old_work_knife` item ephemerally, and never writes equipment or actor state to the canonical save. The lab has flat ground, a body-contact wall, five authored lighting modes, a safe player spawn, and one standing humanoid.

The production Folsom session also owns one `FolsomCombatEncounter`. Its actor is centered at `(-2, ground, 0)`, approximately four metres directly ahead of the authored new-game spawn `(-2, eye height, -4)`. This fixes the Prompt 1 visibility problem: the actor had previously existed only behind the lab query. The Folsom encounter uses no save keys and is destroyed with the session, so the combat subject is nearby and visible without contaminating canonical progression. Knife combat activates within 6.5 metres; farther away the established Old Work Knife shed-growth interaction remains authoritative.

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

Rapier sphere shape-casting sweeps the previous tip to the proposed current tip to prevent tunneling. Lateral/non-forward motion separately sweeps the authored cutting-edge midpoint, so edge contact is sourced from the physical edge path rather than inferred from the reticle or tip alone. Queries are active only while the existing knife item is owned and equipped. Actor collider handles resolve semantic anatomy. One active entry owns the penetration state, preventing duplicate penetration-start events.

The state vocabulary is `no_contact`, `blunt_contact`, `edge_contact`, `glancing_contact`, `tip_contact`, `failed_penetration`, `surface_puncture`, `active_penetration`, `embedded`, `bone_contact`, `withdrawal`, and `fully_extracted`. Classification considers the contacting weapon part, actual tip velocity, motion/blade alignment, regional tissue resistance, current depth, region thickness, hard depth, and prior entry ownership.

After entry, the wound point and penetration axis are stored in the struck body's local frame. Every physics step reconstructs them from body motion. Forward input requests greater depth; backward input requests less. Tissue resistance rate-limits both. Hard structure raises resistance and clamps depth. The constrained tip remains on the wound path, while lateral desired/actual error applies bounded impulse at the entry point. Large lateral withdrawal can force a safe extraction rather than permit impossible clipping or infinite energy accumulation.

Feedback uses persistent pooled region-local wounds, bounded blood, localized physical impulses, spatial synthesized audio, restrained hand resistance, and capability-guarded short haptics. There are no large blood clouds or unbounded decals.

## Slash and wound completion

Slashing is a separate edge-led contact path, not stab damage rotated sideways. The controller sweeps the real cutting-edge midpoint from the previous to current authoritative weapon pose. A continuous slash owner accumulates contact duration and actual edge travel with release hysteresis. Classification considers the contacting part (`tip`, sharp edge, flat, spine, grip/pommel), tangent speed, edge alignment, inward pressure, duration, clothing resistance, tissue resistance, and bounded travel. Results are `edge_touch_no_cut`, `scraping_contact`, `glancing_contact`, `shallow_cut`, `draw_cut`, `deep_slash`, `failed_cut`, or interrupted/reopened ownership. Straight forward motion remains tip-authoritative, and the handle, flat, and spine cannot create an edge wound.

`CombatWoundSystem` owns at most 24 wounds. A wound retains its unique ID, actor/body/semantic-region owner, type, body-local entry and surface vectors, penetration axis, present/maximum depth, local cut endpoints/direction, physically measured length, severity, tissue class, hard contact, vessel intersection, bleeding profile, timestamps, embedded weapon, reopening state, and pooled visual slot. Wound types are puncture, deep puncture, shallow cut, deep slash, arterial wound, and blunt trauma marker. Re-entry near an existing path reopens it; one sweep cannot allocate a wound every frame. Reset and actor disposal release all slots.

Wound presentation uses a fixed pool of lit `MeshStandardMaterial` overlays. Punctures are small dark region-local circles; slashes are narrow body-local geometry strips whose endpoints are the measured cut path. Each frame the overlay reconstructs its world pose from its physical body, so wounds follow stagger, collapse, sleeping corpses, and corpse manipulation. Materials are dark, non-emissive, depth-compatible, and share the same world lighting as the actor.

## Vessels, blood loss, and physiology

Eight authored vessel zones cover the bilateral carotid and jugular paths, brachial vessels, and femoral vessels. A vessel requires the correct semantic region, sufficient depth, a surface path inside the local vessel radius, and a viable penetration axis. A shallow neck scrape therefore remains capillary; it is never promoted merely because the region is `neck`. An embedded blade obstructs arterial or venous flow, and withdrawal temporarily raises release before non-arterial clotting reduces output.

`CombatPhysiology` tracks normalized blood reserve and circulation, aggregate blood-loss rate, total loss, pain, shock, consciousness, neurological integrity, breathing integrity/state, mortal injury, and time since mortal injury. Shallow limb injury can remain survivable. Chest depth impairs breathing and posture; abdominal wounds produce pain and delayed venous deterioration; neck vessel or neurological damage can rapidly release upper-body control; skull paths strongly resist and decisive valid neurological trauma releases motors immediately; leg trauma preferentially removes balance. High general durability is intentional: normal regional trauma is scaled to 55%, with collapse/dying thresholds raised substantially, while anatomically decisive neurological and vessel injuries retain cause-specific consequences.

`CombatBloodEffects` uses one 72-instance droplet mesh and 24 pooled world marks. Entry, insertion, withdrawal, shallow/deep slash, arterial pulse, venous drip, movement, and collapse impact events originate at the active wound pose. Direction combines surface normal, blade/withdrawal motion, target motion, and gravity. Pulse strength is multiplied by circulation and embedded obstruction; it weakens and ceases after physiological death. Ground/wall marks are bounded and reused. All blood uses dark, rough, non-emissive materials and therefore disappears into unlit night with the actor.

## Audio, haptics, reactions, and death

`CombatFeedbackSystem` is the project-owned event boundary for 25 distinct categories: knife movement, clothing, blunt, scrape, failed tip, puncture, soft/deep penetration, bone, embedded movement, binding, extraction, shallow/deep slash, spray/drop, stagger foot, body ground/wall/limb/settle, breathing, pain, shock, unconsciousness, and final exhalation. It applies owner/event cooldowns, an eight-voice ceiling, a two-vocal ceiling, distance panning through the existing audio runtime, and bounded pitch/volume variation. Current combat sounds are deliberately documented Web Audio synthesis placeholders because the audited repository has no suitable licensed flesh, bone, body-impact, or adult-male vocal source set. They provide mechanically distinct feedback but should later be replaced event-for-event with final mastered assets.

Haptics distinguish surface, penetration, hard stop, resistance, extraction, deep slash, severe impact, and collapse. Calls are guarded through `navigator.vibrate`, limited to eight recent events with per-category cooldown, fail silently on unsupported iOS/browser paths, and can be disabled independently. They are supplementary; every state remains readable visually and mechanically.

The actor changes local motor targets and stiffness instead of playing detached flinch clips. Chest wounds fold the torso; neck trauma destabilizes head/upper spine; arm reflexes contract the wounded side; leg wounds weaken their support; shock introduces restrained instability. The face has blink timing, pain/shock brow and jaw targets, weakening lids/gaze, breathing-linked jaw motion, and final stillness. Death hides focused pupils, stops living vocals and breathing, and never returns to hostile idle.

Collapse families are `chest_fold`, `neck_failure`, `neurological`, `leg_failure`, `blood_loss`, and `general_trauma`. They select regional motor-release rates and impulses without teleporting or replacing the articulated body. Current momentum, embedded blade force, joints, ground, and wall determine the result. Neurological release is rapid; blood-loss and leg failure are progressive. Ground, wall, limb, and final-settle events are velocity/cooldown bounded. Once low-energy motion remains under the authored threshold, Rapier sleep suppresses corpse jitter. The collidable corpse, attached wounds, bounded residual blood, and a physically valid embedded knife remain until reset/session disposal.

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
- `J` / `;`: deterministic left/right hand-workspace increments for inspecting edge travel;
- `.`: advance one fixed physics step while paused;
- `C` / `V`: clear wounds / clear blood and world marks;
- `H` / `Q`: toggle haptics / combat audio mute;
- `Y` / `G`: cycle consciousness / circulating blood reserve;
- `1` through `5`: trigger chest, neck, neurological, leg, or blood-loss collapse families;
- `T` / `L`: select source-local torch / lantern night tests.

Debug drawing includes anatomy bodies, the camera-relative workspace, desired and actual hand markers, grip, tip, cutting edge, forward axis, previous/current swept tip segment, camera center ray for comparison, entry point, penetration axis/depth, and semantic body labels through object metadata. The panel reports frame/physics duration, bodies, constraints, contacts, sweeps, reset/resume counts, actor state, motor strength, balance, consciousness, wounds, regional trauma, representative body positions, knife state/reason, world transform, desired/actual hand, forward axis, depth, speed, and visible/collision divergence.

## Mobile budget

The lab keeps one world, 20 total bodies including ground/wall, 17 constraints, bounded queries, 24 pooled wound overlays, 72 instanced droplets, 24 pooled world marks, eight audio voices, shared actor/effect materials, no per-frame geometry/material construction, 1024px sun shadow, no self-collision, and no critical-mechanic quality downgrade on mobile. A 390 x 844 browser smoke pass measured approximately 0.1–0.3 ms reported fixed-physics work with one healthy actor, zero transform divergence, 20 bodies, and 17 constraints. This is a development-machine diagnostic, not an iPhone hardware benchmark. Rapier is loaded in the main game chunk today; code splitting is a later packaging optimization, not a mechanics change.

## Known limitations and deferred work

Combat audio is intentionally synthesized placeholder material pending licensed, mastered assets and device-level mix tuning. The procedural geometry actor has controlled face components rather than a full blend-shape facial rig. Blood uses pooled ballistic droplets and bounded impact marks rather than body-surface fluid simulation. Clothing resistance is data-driven but clothing is not destructible. Wall catches are physical collider interactions rather than authored wall-bracing intelligence. The system has deterministic lifecycle/configuration tests and a mobile-viewport browser smoke pass, but final Safari/iPhone thermal profiling, haptic characterization (Safari support varies), and a recorded human touch-play acceptance pass remain hardware QA tasks. Joint-limit debug arcs remain represented through authored limit data rather than rendered cones. AI, attacks, blocking, dismemberment, multiple weapons/archetypes, and full medical simulation remain explicitly out of scope.
