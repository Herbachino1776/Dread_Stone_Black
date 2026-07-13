# Combat Director

## Foundation contract

`CombatDirector` is the sole orchestration authority for successful melee interactions. Collision code reports facts; it does not directly create wounds, start blood, play contact audio, vibrate the device, shake the camera, or trigger the target reaction.

Each Folsom or combat-lab encounter owns exactly one director. The encounter advances it on the same fixed combat step as weapon collision and actor physics. The director owns a monotonic clock, stable interaction IDs, insertion-ordered event sequence numbers, a bounded scheduled-event queue, subscriber registration, lifecycle state, and diagnostics. Equal-time events execute by sequence number, so frame timing cannot reorder subsystems.

This pass changes architecture, not authored combat presentation. Existing wound, physiology, reaction, blood, audio, camera, haptic, and recovery implementations remain the effect executors behind director subscriptions.

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

The default successful puncture timeline intentionally separates work across short offsets: surface contact, compression, rupture/wound creation, tissue trauma, reaction, contact audio, entry blood, camera impulse, haptic impulse, and embedded state. Slash and extraction use their own ordered profiles. These offsets are architectural defaults in `DEFAULT_MELEE_TIMELINE`; future weapon data may supply compatible profiles without forking director logic.

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
6. Report later depth through `advancePenetration`, friction/bind through `reportResistance`, continued cut travel through `extendSlash`, and completion through `finishSlash` or `beginWithdrawal`.
7. React to resistance through the collision/visual solution. Do not call wound, blood, reaction, feedback, or camera systems directly.
8. Add intent rejection, deterministic event-order, successful contact, extraction/recovery, and existing-effect regression tests.

Daggers and spears primarily differ in collision geometry, intent thresholds, depth/resistance data, and timeline profile. Swords and axes primarily differ in swept edge geometry and tissue policy. Claws, creature limbs, tools, and improvised weapons use the same intent packet and director interaction ownership; they do not receive separate orchestration systems.

## Reset, disposal, and diagnostics

Reset clears queued events, interaction state, deterministic clocks, and logs before the next test interaction. Disposal also removes subscribers. Completed/cancelled interactions are pruned above the retained diagnostic bound, and event logs are capped.

`getDiagnostics()` exposes director time, queue size, total/active interactions, the last event, and the bounded ordered event log. Weapon diagnostics expose current intent, intent reason, layer identities, and active interaction ID. These are architecture diagnostics, not player-facing tutorial UI.

## Non-goals for this pass

This foundation does not tune damage, controls, blood rendering, wound rendering, audio assets, animation content, enemy AI, blocking, or weapon balance. It establishes the authority and integration contract those systems must use.
