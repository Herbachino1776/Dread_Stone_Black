# Combat Director

## Foundation contract

`CombatDirector` is the sole orchestration authority for successful melee interactions. Collision code reports facts; it does not directly create wounds, start blood, play contact audio, vibrate the device, shake the camera, or trigger the target reaction.

Each Folsom or combat-lab encounter owns exactly one director. The encounter advances it on the same fixed combat step as weapon collision and actor physics. The director owns a monotonic clock, stable interaction IDs, insertion-ordered event sequence numbers, a bounded scheduled-event queue, subscriber registration, lifecycle state, and diagnostics. Equal-time events execute by sequence number, so frame timing cannot reorder subsystems.

Existing wound, physiology, reaction, blood, audio, camera, haptic, and recovery implementations remain the effect executors behind director subscriptions. Presentation tuning belongs in the director timeline and its adapters; collision owners must not bypass the director to make a hit feel stronger.

## Three weapon layers

Every future melee weapon must expose three conceptual layers:

- The visual weapon presents the held object. In free space it follows the authored hand pose directly. It never uses follow delay to imply mass. During real contact it may show the same physical stop, recoil, friction, or settling imposed by the collision solution.
- The collision weapon owns world-space shapes, sweeps, contact points, surface normals, resistance, embedding, and extraction constraints. It reports contact facts to the director.
- The intent weapon interprets input ownership and gesture velocity as `stab`, `slash`, `withdraw`, `idle`, or `invalid`. Only owned `stab` and `slash` packets are damage-capable. Camera motion, player locomotion, target motion, return springs, and unowned tool sway cannot enter a damaging director timeline.

`MeleeIntentWeapon` is the shared interpreter and damage gate. A weapon may tune its minimum intent speed and slash bias, but it must preserve ownership and non-attack rejection.

The Old Work Knife exposes these layers through `WorldKnifeCombatController.weaponLayers`. Its free visual/collision pose copies the desired hand transform in the same step. Its existing surface correction, tissue resistance, hard stop, lateral bind, embedding, assisted withdrawal, and critically damped recovery remain physical sources of weight.

## Directed interaction lifecycle

Penetrating interactions use this vocabulary:

1. `approach`
2. `surface_contact`
3. `surface_compression`
4. `surface_rupture`
5. `soft_tissue`
6. `hard_tissue` when the resolved anatomy requires it
7. `embedded`
8. `withdrawal`
9. `exit`
10. `recovery`

Not every attack traverses every stage. A slash normally reaches surface rupture and soft tissue, then remains active until its collision owner finishes the path and requests recovery. A failed or scraping contact reaches surface contact, emits resistance/feedback, and recovers without a wound. A puncture remains active at embedded until the collision weapon requests withdrawal.

The default successful puncture timeline intentionally separates work across short offsets: surface contact, compression, surface audio, rupture/wound creation, deep audio, tissue trauma, reaction, entry seep, camera impulse, haptic impulse, and embedded settling. Slash and extraction use their own ordered profiles. These offsets are presentation defaults in `DEFAULT_MELEE_TIMELINE`; future weapon data may supply compatible profiles without forking director logic.

The built-in timing profiles are deliberately short and overlapping, but they do not collapse onto one render frame:

- puncture evolves from contact at `0 ms` through rupture at `31 ms`, reaction at `62 ms`, blood at `80 ms`, camera at `96 ms`, and embedded settling at `120 ms`;
- slash evolves from contact at `0 ms` through rupture at `30 ms`, reaction at `64 ms`, blood at `82 ms`, camera at `98 ms`, and recovery at `160 ms`;
- extraction begins with sticky withdrawal, releases the wound at `26 ms`, starts withdrawal audio at `40 ms`, releases blood at `70 ms`, produces restrained camera reinforcement at `84 ms`, exits at `108 ms`, and settles by `190 ms`.

Entry blood begins as a minimal directed seep. Continuous wound bleeding is armed after a further `55 ms`; this preserves the existing blood renderer while preventing the renderer from starting every blood layer on the collision frame. Torso reactions can briefly suppress the existing breathing motor, then recover smoothly. These are presentation overlays and do not alter physiology or damage policy.

## Presentation contract

`CombatPresentation.js` is the shared, allocation-conscious policy layer used by the director and weapon adapters. It provides deterministic variation, continuous tissue resistance, bounded weapon micro-response, recent-impact channels, and melee spacing envelopes.

Tissue resistance is continuous across skin, muscle, bone approach, sticky withdrawal, and surface release. The collision weapon remains the physical authority for actual depth and hard stops. Its adapter can translate director resistance events into individually capped responses: up to 6 mm of compression, 4.5 mm of release recoil, 0.75 mm of damped vibration, and 2.4 degrees of roll or twist. The combined response stays millimetric. These offsets are applied to the visible presentation after the physical pose is solved; they never make the free weapon chase the hand.

Camera feedback is a small directional impulse with a smooth rise and damped, non-oscillating return. It contains no random jitter. Reaction variation is derived from the stable interaction ID and blends impact direction, weapon direction, penetration depth, severity, body region, posture, current recovery, and recent regional hits. Repeated torso, arm, or leg hits create bounded guarding and confidence changes which decay over time and do not change combat capability.

All scheduled event records are pooled, inserted in stable time/sequence order, and returned to the pool after dispatch. Presentation updates reuse temporary vectors and response records so normal combat does not create per-frame garbage.

## Melee spacing contract

Body collision and weapon reach are one authored envelope, not independent constants. `resolveMeleeSpacingEnvelope` derives the standing actor blocker radius from:

- player collision radius;
- target surface extent;
- weapon ready reach (hand pose plus collision geometry);
- intentional gesture reach;
- useful penetration depth;
- a minimum loading clearance and small overtravel reserve.

At the closest allowed standing position, the ready weapon must still have at least 6 cm of surface clearance. The full intentional gesture must reach the weapon's configured useful penetration depth without requiring the camera to enter the target. For the Old Work Knife in Folsom this produces a 9 cm ready-tip gap and approximately 25 cm of full-gesture depth against a configured 22.5 cm maximum penetration. Grabbing, locomotion, idle sway, recovery, and other unowned motion remain non-damaging even if geometry contacts a target.

Future weapons must provide the same data. An axe normally uses its ready head reach and the swept downward arc's forward reach rather than a knife thrust distance; a spear uses the grip-to-tip ready reach and thrust stroke; a claw uses limb reach and its authored attack extension. The envelope changes approach spacing, while `MeleeIntentWeapon` still decides whether the motion is an attack. Do not shorten a weapon model or add visual-hand latency to repair a spacing mismatch.

## Event channels and subscribers

The permanent event channels are:

- `lifecycle`: stage transitions and interaction history;
- `tissue`: reserved boundary for material/tissue policy subscribers;
- `wound`: create, extend, finish, penetrate, and extract mutations;
- `reaction`: actor reflex and pain-reaction start;
- `blood`: entry, slash, and withdrawal bursts;
- `audio`: categorized combat cue start;
- `camera`: bounded camera impulse;
- `haptic`: capability-guarded haptic cue;
- `resistance`: physical stop, friction, bind, and hard-contact information for the collision weapon;
- `recovery`: interaction completion and cleanup.

The default subscribers adapt the existing `HumanoidCombatActor`, `CombatWoundSystem`, `CombatBloodEffects`, `CombatFeedbackSystem`, and camera `Feedback` object. Secondary actor events such as pain voice, collapse impact, unconsciousness, and final exhale also enter the director through `forwardFeedbackEvent`; encounter code no longer sends them straight to audio.

Subscribers may observe `*` for diagnostics, but gameplay systems should subscribe to the narrowest channel they own. A subscriber must not schedule damage from an audio, blood, camera, or haptic event.

## Adding a future melee weapon

Implement a new weapon in this order:

1. Define stable weapon data with an `id`, a weapon `family`, collision dimensions, resistance limits, and optional compatible `timeline.puncture` or `timeline.slash` offsets.
2. Build a responsive visual layer. Do not add interpolation delay between the player hand and a free weapon.
3. Build a collision layer that reports actual swept contact, part, point, normal, speed, pressure, and resolved target anatomy.
4. Feed owned local gesture velocity into `MeleeIntentWeapon`. Keep idle, return, and withdrawal motion non-damaging.
5. For an accepted tip attack call `beginPuncture`; for an accepted edge attack call `beginSlash`. Store the returned interaction ID as the sole lifecycle owner.
6. Report later depth through `advancePenetration`, friction/bind through `reportResistance`, continued cut travel through `extendSlash`, and completion through `finishSlash` or the paired `beginWithdrawal`/`completeWithdrawal` calls.
7. React to resistance through the collision/visual solution. Do not call wound, blood, reaction, feedback, or camera systems directly.
8. Supply ready reach, intentional gesture reach, useful depth, and target extent to `resolveMeleeSpacingEnvelope`; install the resulting blocker radius for the target's standing state.
9. Add intent rejection, spacing, deterministic event-order, successful contact, extraction/recovery, micro-response bounds, and existing-effect regression tests.

Daggers and spears primarily differ in collision geometry, intent thresholds, depth/resistance data, and timeline profile. Swords and axes primarily differ in swept edge geometry and tissue policy. Claws, creature limbs, tools, and improvised weapons use the same intent packet and director interaction ownership; they do not receive separate orchestration systems.

## Reset, disposal, and diagnostics

Reset clears queued events, interaction state, deterministic clocks, and logs before the next test interaction. Disposal also removes subscribers. Completed/cancelled interactions are pruned above the retained diagnostic bound, and event logs are capped.

`getDiagnostics()` exposes director time, queue and pool size, total/active interactions, recent regional impact memory, the last event, and the bounded ordered event log. Weapon diagnostics expose current intent, intent reason, layer identities, active interaction ID, tissue phase/resistance, readiness, and current bounded micro-response. Encounter diagnostics expose the installed spacing envelope. These are architecture diagnostics, not player-facing tutorial UI.

## Deliberate non-goals

This foundation and presentation pass do not tune damage, controls, blood rendering, wound rendering, audio assets, authored animation content, enemy AI, blocking, weapon dimensions, or weapon balance. They establish the authority, spacing, timing, and restrained presentation contract those systems must use.
