# DREADSTONE BLACK 2.0
# Creature Damage, Physical Weapons, Gore, Dismemberment, Wildlife & Harvesting
## Locked Master Implementation Plan

**Status:** Approved direction — full-throttle implementation  
**Date locked:** July 13, 2026  
**Primary repository:** `Herbachino1776/Dread_Stone_Black`  
**Primary test subject:** Testman animation-authoritative humanoid  
**Initial test location:** Folsom  
**Wildlife production location:** North Road  

---

## 1. Purpose of This Document

This document preserves the agreed technical and creative direction for the next major Dreadstone Black 2.0 combat and survival initiative.

It is intended to prevent context loss between ChatGPT, Codex, Blender work, repository work, asset delivery, and future conversations.

This is not a loose brainstorm. It is the implementation contract.

The target experience is:

- weapons are physically manipulated in the same direct, world-space style as the Old Work Knife;
- sword cuts are derived from the actual moving blade;
- mace impacts deform and structurally damage bodies;
- knife penetration and dragging can open severe abdominal wounds;
- authored anatomical sections can detach at controlled boundaries;
- the body can bisect at an authored lower-spine/waist boundary;
- exposed interiors, stumps, protective black scab, blood, and viscera are supported;
- the system generalizes beyond humanoids to quadrupedal wildlife;
- wildlife can hear, flee, be wounded, killed, butchered, and converted into survival resources.

---

# 2. Non-Negotiable Context Locks

## 2.1 The old broadsword system is deleted

Do not revive, port, copy, reference, or build upon the removed broadsword system.

It is obsolete.

Any history showing the old broadsword is historical evidence only and is not a current architectural dependency.

## 2.2 The Old Work Knife is the canonical weapon reference

At present, the Old Work Knife is the only player-held object that physically interacts with enemies and NPCs through the advanced combat stack.

Every new melee weapon must follow its design philosophy:

- visible 3D weapon;
- direct player-controlled world pose;
- intentional pointer/gesture ownership;
- collision derived from the actual weapon pose;
- offensive energy derived from deliberate player motion;
- contact with semantic anatomy regions;
- physical resistance and weapon correction;
- routed combat events;
- wounds, physiology, reactions, death, and physics consequences;
- no fake canned “attack animation deals damage somewhere in front” shortcut.

The sword and mace are new implementations built from shared principles extracted from the knife—not modifications of an old weapon system.

## 2.3 Lower-spine waist bisection is an approved authored boundary

Testman has a lower-spine point suitable for a controlled waist bisection seam.

The damage-ready asset must support a named boundary such as:

`waist_lower_spine`

The exact exported name may change after rig inspection, but the boundary is a required feature.

## 2.4 Slash performance comes before feature expansion

Current slashing feels laggy and inconsistent.

Before introducing a sword, dismemberment, or additional complex gore, the slash contact and wound-extension pipeline must be profiled and redesigned.

This is Phase 0, not cleanup for later.

## 2.5 No arbitrary runtime topology cutting

The game should feel procedural, but it should not rebuild an arbitrary skinned mesh during combat.

Approved approach:

- actual weapon path determines where and how contact occurs;
- visible wound path follows the real contact;
- deformation is driven by authored morph targets and pose damage;
- detachment resolves to the nearest eligible authored anatomical seam;
- stump/interior geometry is prepared in Blender;
- geometry topology remains stable at runtime.

## 2.6 No bone-scale deformation

Body crushing and deformation must not be simulated by scaling animated bones.

Use:

- morph targets;
- corrective bones designed for deformation;
- rotation-only damage posture;
- segment visibility;
- authored replacement/interior meshes.

## 2.7 Audio is a later asset delivery, but the code contract starts now

The future sound package should plug into stable event names.

Code must define cue points during implementation, but temporary sounds or silence must not block the core systems.

---

# 3. Current Foundation

The repository already has several major pieces needed for this initiative.

## 3.1 Physical knife foundation

The Old Work Knife already provides:

- direct free-space pose tracking;
- tip and edge geometry;
- deliberate-input velocity;
- intent classification;
- physics casts;
- puncture entry;
- embedded motion;
- withdrawal;
- slash contact;
- contact resistance;
- combat routing;
- diagnostics.

This must be extracted carefully into reusable components without destabilizing the knife.

## 3.2 Semantic anatomy and segmented physics

The humanoid actor already describes:

- pelvis;
- abdomen;
- lower and upper chest;
- neck and head;
- upper arms, forearms, and hands;
- thighs, lower legs, and feet.

The physical actor already has corresponding rigid bodies, colliders, parent relationships, and joints.

This is the correct basis for deformation state, structural failure, detached segments, and bisection.

## 3.3 Animation-authoritative Testman

Testman already has:

- a bone map;
- an animation manifest;
- authored walk, hurt, and death behavior;
- bone-following collision proxies;
- animation-to-ragdoll handoff.

Damage and detachment must respect this authority boundary.

## 3.4 Surface-bound wound system

Punctures and slash paths already attach to reconstructed skinned surfaces.

That foundation should remain.

Dismemberment must transfer, hide, or rebind existing wound ownership without invalidating arbitrary triangle topology.

## 3.5 Survival and harvesting foundation

The repository already contains useful survival plumbing:

- inventory;
- equipment/tool slots;
- persistent harvested state;
- harvestable redwoods;
- raw fish;
- cooked fish;
- campfire cooking;
- hunger restoration.

Wildlife harvesting should reuse and generalize these patterns rather than creating an unrelated survival subsystem.

---

# 4. Product Vision

## 4.1 Weapon outcomes

### Old Work Knife

- puncture;
- embed;
- resistance;
- controlled withdrawal;
- lateral tearing;
- dragged cut;
- abdominal opening;
- disembowelment trigger;
- butchering and harvesting tool.

### New Sword

- direct physical handling in the knife style;
- point and edge contacts;
- shallow and deep slash;
- draw cuts;
- structural cuts;
- authored seam detection;
- decapitation;
- arm and lower-leg severing;
- fatal waist bisection;
- no reuse of the deleted broadsword code.

### New Mace

- direct physical handling in the knife style;
- swept mace-head collision;
- impact impulse and energy;
- skull dent/cave deformation;
- arm deformation/fracture;
- chest compression/caving;
- knockback and motor impairment;
- no cutting logic.

## 4.2 Body outcomes

- temporary pain posture;
- persistent region deformation;
- fractures and motor loss;
- visible black-scab destruction;
- open slash and puncture presentation;
- detached limbs;
- detached head;
- lower-spine waist split;
- internal cap/interior presentation;
- stable corpse physics;
- viscera tether;
- carcass harvesting.

## 4.3 Creature outcomes

- humanoid enemy framework;
- quadrupedal creature profiles;
- deer as the first wildlife species;
- herd behavior;
- hearing and vision;
- fleeing and wounded slowdown;
- death and carcass;
- knife butchering;
- raw meat;
- cooking;
- eating and hunger restoration.

---

# 5. System Ownership: Add-on vs Repository

## 5.1 Blender add-on owns authoring

The Blender tool should evolve into a modular **Dreadstone Forge**:

```text
Dreadstone Forge
├── Animation Forge
├── Damage Forge
├── Creature Forge
└── Pack Builder
```

It owns:

- rig adoption and analysis;
- animation authoring;
- damage-readiness analysis;
- anatomical region assignment;
- seam definition;
- mesh segmentation;
- stump and interior cap creation;
- detached-prop preparation;
- deformation shape-key management;
- viscera socket authoring;
- humanoid and quadruped profiles;
- manifest generation;
- GLB validation.

It does not own gameplay thresholds, live physics, AI, harvesting, or weapon input.

## 5.2 Repository owns runtime behavior

The game repository owns:

- weapon control;
- input and direct gesture interpretation;
- collision;
- impact and cutting calculations;
- combat intent;
- damage accumulation;
- morphology weights;
- structural failure;
- detachment;
- physics release;
- blood and wounds;
- viscera simulation;
- AI;
- carcass harvesting;
- inventory and cooking;
- save state;
- sound playback.

---

# 6. Phase 0 — Slash Performance and Contact Redesign

This phase must be completed before the sword or expanded gore.

## 6.1 Current suspected hot spots

The current slash path performs substantial work during continued contact:

- many temporary `Vector3` and quaternion allocations;
- repeated `.clone()` operations;
- edge contact based primarily on a swept midpoint;
- collision and semantic routing every physics step;
- an `extend_slash` Combat Director event for every continued slash step;
- sorted event-queue insertion;
- wound surface sampling on extension;
- dimensions, decal selection, bleeding profile, and wound visual updates on extension;
- additional visual reconstruction during wound updates.

This can cause:

- garbage collection;
- input/contact latency;
- noisy ownership changes;
- inconsistent cuts;
- excessive presentation work;
- a slash that feels delayed or “funky.”

## 6.2 Required instrumentation

Add development diagnostics before optimizing:

```text
slash.physicsCastsPerSecond
slash.contactSamplesPerSecond
slash.allocationsEstimated
slash.beginCount
slash.extendCount
slash.finishCount
slash.ownerChanges
slash.surfaceProjectionAttempts
slash.surfaceProjectionFailures
slash.woundVisualRebuilds
slash.directorQueueLength
slash.directorEventsScheduled
slash.contactLatencyFrames
slash.maximumStepDistance
slash.averageStepDistance
slash.cpuMilliseconds
```

Use development-only counters and browser performance markers.

## 6.3 New Slash Contact Kernel

Create a low-allocation kernel used first by the knife and later by the sword.

Suggested module:

`src/game/combat/weapons/SlashContactKernel.js`

Responsibilities:

- receive previous and current weapon edge poses;
- use persistent scratch vectors;
- perform continuous edge-volume contact;
- maintain stable contact ownership with hysteresis;
- classify edge, flat, spine, or point contact;
- accumulate travel, pressure, alignment, and severity;
- expose threshold transitions;
- batch wound updates;
- remain deterministic.

## 6.4 Collision strategy

Replace midpoint-only ownership with a bounded swept edge representation.

Recommended first version:

- represent the cutting edge as a segment;
- sample root, midpoint, and tip positions;
- perform a small number of swept-sphere/capsule queries;
- select the earliest valid semantic contact;
- reuse previous target and body as a fast path;
- query the broader combat router only when target ownership changes.

This is still inexpensive but better represents a long sword edge.

## 6.5 Separate contact sampling from wound committing

Contact may be sampled every fixed physics step.

Wound geometry should be committed only when one of these is true:

- accumulated path distance exceeds a threshold;
- contact direction changes beyond a threshold;
- depth/severity crosses a meaningful threshold;
- target region changes;
- contact ends.

Suggested initial distance threshold:

`0.008–0.012 meters`

This prevents dozens of nearly identical extensions.

## 6.6 Replace per-step scheduled extension events

`beginSlash` remains a directed interaction.

During the active contact:

- accumulate slash state synchronously in a small interaction object;
- update damage at controlled distance/time intervals;
- schedule presentation only for meaningful transitions;
- finish once.

Do not insert one sorted queue event for every physics-frame continuation.

## 6.7 Stable contact hysteresis

A slash should not constantly start and stop because a cast misses for one frame.

Maintain contact while:

- the same weapon edge remains near the previous surface;
- the missed time remains under a short release window;
- projected movement is continuous;
- the target actor remains valid.

Use both temporal and spatial hysteresis.

## 6.8 Allocation policy

The inner weapon-contact loop should create effectively zero garbage.

Required:

- persistent scratch vectors and quaternions;
- mutable contact result objects;
- pooled sample storage;
- fixed-size ring buffers;
- no `.clone()` in the hot path;
- no object spreads in per-step extension payloads;
- no array filtering in the hot path.

## 6.9 Wound visual policy

During active slash:

- update only the active slash visual;
- avoid reselecting decal variants after the slash variant is already chosen;
- update bleeding classification only at depth/severity thresholds;
- append surface samples only after distance threshold;
- freeze completed static wound metadata;
- skip off-screen wound presentation where possible;
- cap path sample count.

## 6.10 Acceptance gates

Slash optimization passes only when:

- visible weapon tracks the player directly;
- contact response occurs within one physics frame;
- a continuous slash produces one interaction;
- path ownership does not flicker;
- no obvious garbage-collection hitch occurs;
- active slashing holds target performance;
- existing puncture and withdrawal tests still pass;
- visual slash remains attached during animation and ragdoll;
- diagnostics show bounded casts, extensions, and samples.

---

# 7. Shared Physical Weapon Architecture

After slash optimization, extract reusable weapon infrastructure from the knife.

## 7.1 Proposed modules

```text
src/game/combat/weapons/
├── WorldMeleeWeaponController.js
├── WeaponPoseWorkspace.js
├── WeaponIntentInterpreter.js
├── WeaponContactRouter.js
├── SlashContactKernel.js
├── PointContactKernel.js
├── BluntContactKernel.js
├── OldWorkKnifeController.js
├── SwordWorldWeaponController.js
└── MaceWorldWeaponController.js
```

The existing knife may retain its filename initially and migrate carefully.

## 7.2 Shared weapon layers

Every weapon should separate:

```text
visual layer
collision layer
intent layer
presentation/resistance layer
```

## 7.3 Shared weapon contract

Each physical weapon supplies:

```text
weaponId
weaponFamily
grip pose
workspace
contact primitives
damage modes
minimum deliberate speed
maximum velocity
contact filters
event timeline
diagnostics
```

## 7.4 No generic damage shortcut

A weapon does damage only when:

- the player owns the active gesture;
- the weapon has deliberate motion;
- the physical contact primitive reaches a valid collider;
- the semantic anatomy target resolves;
- the weapon-specific classifier accepts the contact.

---

# 8. New Sword — From Scratch

## 8.1 Sword design

The sword should use:

- the same direct manipulation style as the knife;
- a longer handle and blade;
- two-handed-looking presentation if desired, but without requiring visible hands;
- real blade point;
- real cutting edge;
- flat/spine classification;
- resistance correction;
- no canned attack animation as the authority.

## 8.2 Sword contact primitives

```text
point:
  sword tip

edge:
  authored cutting segment

flat:
  blade plane contact

spine:
  non-cutting back edge
```

## 8.3 Sword damage state

Track:

```text
edgeSpeed
edgeAlignment
surfacePressure
continuousTravel
cutDepth
structuralDamage
seamCrossing
targetRegion
targetBoundary
```

## 8.4 Seam resolution

The sword’s visible wound follows actual contact.

Structural detachment resolves only when:

- the cut intersects an eligible region;
- the weapon path approaches an authored seam;
- edge alignment is sufficient;
- accumulated depth and structural damage cross thresholds;
- the target state permits detachment.

## 8.5 Initial sword seams

First production seams:

```text
neck
left_elbow
right_elbow
```

Next:

```text
left_wrist
right_wrist
left_knee
right_knee
```

Later:

```text
left_shoulder
right_shoulder
left_hip
right_hip
waist_lower_spine
```

---

# 9. New Mace — From Scratch

## 9.1 Mace design

The mace follows the knife’s direct physical interaction style but uses a blunt contact kernel.

The mace requires:

- a 3D model;
- visible world-space pose;
- direct gesture movement;
- mace-head swept collision;
- deliberate velocity;
- effective impact mass;
- contact point and normal;
- region-targeted impulse;
- structural/deformation output.

## 9.2 Blunt impact event

```text
weaponId
contactPoint
contactNormal
relativeVelocity
normalVelocity
tangentialVelocity
effectiveMass
impactEnergy
impulse
regionId
bodyId
```

## 9.3 Deformation results

Head:

```text
Head_Dent_Left
Head_Dent_Right
Head_Cave_Front
Jaw_Displaced
```

Arm:

```text
UpperArm_Crush_Left
Forearm_Crush_Left
UpperArm_Crush_Right
Forearm_Crush_Right
```

Torso:

```text
Chest_Cave_Left
Chest_Cave_Right
Sternum_Collapse
Abdomen_Compress
```

## 9.4 Mace gameplay consequences

- pain;
- stun;
- motor weakness;
- fracture;
- balance loss;
- knockback;
- consciousness loss;
- deformation;
- fatal head/chest collapse at high trauma.

---

# 10. Damage-Ready Asset Pipeline in Dreadstone Forge

## 10.1 v3.7 — Damage Readiness Analyzer

Non-destructive analysis:

- count meshes and SkinnedMeshes;
- inspect vertex groups and bone influences;
- identify topology near candidate seams;
- detect vertices weighted across both sides of a seam;
- list shape keys;
- list materials;
- inspect normals and manifold status;
- identify lower-spine boundary candidates;
- report automatic versus manual work;
- export a readiness report.

## 10.2 v3.8 — Segment and Stump Authoring

Tools:

```text
Create Damage Authoring Copy
Select Region by Dominant Bone
Define Detachment Boundary
Grow/Shrink Boundary Selection
Create Attached Segment
Create Detached Prop
Create Proximal Stump Cap
Create Distal Stump Cap
Assign Interior Material
Preview Attached State
Preview Detached State
Validate Seam
```

## 10.3 v3.9 — Deformation Authoring

Tools:

```text
Create Damage Shape Key
Create Mirrored Shape Key
Assign Shape Key to Region
Set Damage Axis
Set Maximum Influence
Preview Trauma Blend
Zero Deformations
Validate Morph Export
```

## 10.4 v4.0 — Creature Forge

Features:

- humanoid profile;
- quadruped profile;
- bone mapping presets;
- anatomy region mapping;
- collision proxy metadata;
- animation requirements;
- damage seams;
- harvest regions;
- damage manifest;
- creature-pack validation.

---

# 11. Testman Damage-Ready Asset

## 11.1 First asset scope

Prepare:

- head segment;
- torso neck stump;
- head neck stump;
- left forearm segment;
- left upper-arm/elbow stump;
- right forearm segment;
- right upper-arm/elbow stump;
- lower-spine waist boundary;
- upper-body waist cap;
- lower-body waist cap;
- abdominal viscera socket;
- head deformation morphs;
- arm deformation morphs;
- chest deformation morphs.

## 11.2 Required exported names

Example only:

```text
DSB_SEGMENT_HEAD
DSB_SEGMENT_FOREARM_L
DSB_SEGMENT_FOREARM_R
DSB_SEGMENT_UPPER_BODY
DSB_SEGMENT_LOWER_BODY

DSB_STUMP_NECK_TORSO
DSB_STUMP_NECK_HEAD
DSB_STUMP_ELBOW_L_UPPER
DSB_STUMP_ELBOW_L_LOWER
DSB_STUMP_ELBOW_R_UPPER
DSB_STUMP_ELBOW_R_LOWER
DSB_STUMP_WAIST_UPPER
DSB_STUMP_WAIST_LOWER

DSB_SOCKET_ABDOMEN_VISCERA
DSB_SOCKET_CHEST_INTERIOR
```

## 11.3 Damage manifest

Create:

`testman_damage_v001.json`

It must map:

- segment;
- parent region;
- bone;
- physics body;
- connecting joint;
- seam;
- stump caps;
- fatal status;
- deformation morphs;
- viscera sockets;
- harvest eligibility;
- detached mass and collider hints.

---

# 12. Runtime Creature Damage Architecture

## 12.1 Proposed modules

```text
src/game/creatures/
├── CreatureAnatomyProfile.js
├── CreatureCombatActor.js
├── CreatureDamageState.js
├── CreatureDeformationController.js
├── CreatureDismembermentController.js
├── DetachedSegmentRuntime.js
├── CreatureVisceraController.js
├── CreatureCorpseController.js
├── CorpseHarvestController.js
└── profiles/
    ├── TestmanCreatureProfile.js
    └── DeerCreatureProfile.js
```

## 12.2 Do not rewrite HumanoidCombatActor immediately

Use an extraction path:

1. add reusable components beside the existing actor;
2. make Testman use them;
3. preserve existing tests;
4. move shared behavior out gradually;
5. introduce `CreatureCombatActor` only after parity exists.

## 12.3 Region damage state

Each region tracks:

```text
surfaceDamage
penetrationDamage
bluntTrauma
compression
fracture
structuralDamage
motorLoss
deformationInfluence
severProgress
detached
```

## 12.4 Weapon-neutral damage events

```text
PenetrationDamageEvent
EdgeDamageEvent
BluntDamageEvent
StructuralFailureEvent
DetachmentEvent
VisceraReleaseEvent
HarvestEvent
```

---

# 13. Dismemberment Runtime

## 13.1 Detachment sequence

1. Validate the target seam.
2. Mark segment detached.
3. Stop further attached-body damage routing to that segment.
4. Hide the attached segment mesh.
5. Reveal the proximal stump.
6. Spawn or reveal detached segment object.
7. Copy current bone/world transform.
8. Transfer linear and angular velocity.
9. Remove or disable connecting joint.
10. Attach detached segment to its Rapier body.
11. Transfer eligible wounds.
12. Spawn boundary blood/scab effects.
13. Update physiology and motor state.
14. Lock animation rules that are no longer valid.
15. Record save/corpse state as needed.

## 13.2 Detached wound ownership

Wounds on a detached segment must:

- either move with the detached prop;
- or be converted to a detached-local binding;
- never remain attached to the original animated body.

## 13.3 Limb-loss animation policy

First implementation:

- missing arms/hands may continue using normal locomotion;
- invisible detached bones may continue animating harmlessly;
- leg loss forces collapse/death until crawling exists;
- head loss is fatal;
- waist split is fatal;
- authored death animation may hand off early to split/ragdoll state.

---

# 14. Lower-Spine Waist Bisection

## 14.1 Approved boundary

Use the known lower-spine point as the authored split seam.

## 14.2 Initial restrictions

The first waist bisection implementation is:

- fatal only;
- sword only;
- high-threshold;
- one fixed seam;
- no living upper-body crawl;
- no procedural arbitrary torso cut.

## 14.3 Physics split

Create two assemblies:

### Upper assembly

- abdomen/chest;
- arms;
- neck/head;
- upper waist stump.

### Lower assembly

- pelvis;
- thighs;
- legs;
- lower waist stump.

The implementation must define which assembly retains the original actor root and which becomes a detached assembly.

Recommended first pass:

- lower/pelvis assembly retains actor root;
- upper assembly becomes a detached multi-body corpse group;
- both immediately enter corpse physics;
- animation authority ends.

## 14.4 Bisection acceptance gate

- no explosive body separation;
- no major transform jump;
- both halves inherit plausible momentum;
- caps align;
- wounds remain on the correct half;
- blood source appears at the seam;
- both assemblies settle and sleep;
- no later animation reclaims the corpse.

---

# 15. Knife Disembowelment

## 15.1 Trigger

Require:

- abdomen region;
- meaningful penetration or deep slash;
- embedded or cutting knife;
- lateral drag across the abdomen;
- minimum wound length and depth;
- state not already discharged;
- available viscera pool.

## 15.2 Viscera tether

Use a bounded pooled chain:

```text
8–12 visible low-poly segments
small capsule physics bodies
short joints or Verlet constraints
one anchored beginning
controlled progressive release
sleep/freeze when settled
```

## 15.3 Release behavior

- first link starts at `DSB_SOCKET_ABDOMEN_VISCERA`;
- drag distance controls released length;
- knife may temporarily hold the leading section;
- full extraction releases it;
- gravity and body movement pull the chain;
- only one high-detail tether is active nearby;
- distant tethers simplify or freeze.

## 15.4 No full soft-body simulation

Do not simulate an entire abdominal organ system.

Use a convincing bounded visual system with strict physics budgets.

---

# 16. Quadrupedal Creature Support

## 16.1 Terminology

The intended category is **quadrupedal** creatures.

## 16.2 Generalization rule

Do not hard-code all creatures to humanoid animation requirements.

Creature profiles define:

- skeleton mapping;
- anatomy regions;
- collision proxies;
- required animations;
- damage seams;
- deformation morphs;
- locomotion modes;
- harvest outputs.

## 16.3 First wildlife species: deer

Deer is the preferred first species because it exercises:

- herd movement;
- hearing;
- vision;
- startle;
- fleeing;
- injured slowdown;
- blood tracking;
- death;
- harvesting;

without requiring complex attack AI in the first pass.

## 16.4 Deer anatomy example

```text
pelvis
abdomen
chest
neck
head
jaw

front_left_upper
front_left_lower
front_left_hoof
front_right_upper
front_right_lower
front_right_hoof

rear_left_thigh
rear_left_lower
rear_left_hoof
rear_right_thigh
rear_right_lower
rear_right_hoof
```

## 16.5 Deer animation contract

Example:

```text
IDLE
WALK
TROT
RUN
STARTLED
HURT_LEFT
HURT_RIGHT
DEATH_LEFT
DEATH_RIGHT
```

Manifest requirements must be profile-driven.

---

# 17. Wildlife AI

## 17.1 Folsom practice herd

Create a controlled development herd or enclosure used to verify:

- spawn;
- animation;
- hearing;
- fleeing;
- weapon contact;
- damage;
- death;
- carcass;
- harvesting.

It must not disrupt canonical Folsom story behavior.

## 17.2 North Road wildlife

Add a wildlife director with:

```text
species population budget
spawn zones
herd membership
leader/follower behavior
minimum player distance
despawn distance
hearing stimulus
vision stimulus
panic propagation
flee destinations
injury state
corpse persistence budget
```

## 17.3 Hearing

Stimuli include:

- footsteps;
- sprinting;
- weapon impacts;
- nearby creature panic;
- environmental events;
- future sound package cues where applicable.

## 17.4 Injury

Injury can change:

- maximum speed;
- acceleration;
- turn rate;
- gait;
- herd cohesion;
- bleeding trail;
- likelihood of falling.

---

# 18. Harvesting and Survivor Loop

## 18.1 Carcass interaction

```text
kill wildlife
→ approach carcass
→ equip Old Work Knife
→ hold/perform butcher interaction
→ region or whole-carcass harvest
→ raw meat and possible secondary resources
```

## 18.2 First resource scope

Start with:

```text
raw_meat
cooked_meat
```

Later:

```text
hide
bone
sinew
fat
antler
```

## 18.3 Reuse existing survival systems

Integrate with:

- equipment runtime;
- inventory;
- persistent harvested state;
- campfire;
- cooking;
- hunger.

## 18.4 Corpse state

A harvested carcass must:

- record harvested state;
- change visual state or disappear;
- prevent infinite repeated yield;
- persist appropriately across saves;
- respect corpse population budgets.

---

# 19. Sound Contract

The future sound package will attach to stable cues.

Initial cue namespace:

```text
weapon.knife.surface_contact
weapon.knife.puncture
weapon.knife.embedded_move
weapon.knife.extraction
weapon.knife.deep_slash

weapon.sword.surface_contact
weapon.sword.edge_scrape
weapon.sword.shallow_cut
weapon.sword.deep_cut
weapon.sword.bone_contact
weapon.sword.sever
weapon.sword.bisection

weapon.mace.cloth_impact
weapon.mace.body_impact
weapon.mace.bone_impact
weapon.mace.crush
weapon.mace.head_cave
weapon.mace.chest_cave

body.stump_release
body.limb_impact
body.head_impact
body.waist_split
body.viscera_release
body.viscera_drag
body.viscera_settle

wildlife.deer.alert
wildlife.deer.panic
wildlife.deer.injured
wildlife.deer.death
wildlife.deer.herd_flee

harvest.carcass_begin
harvest.carcass_cut
harvest.carcass_complete
```

The system should accept missing audio assets gracefully until delivery.

---

# 20. Implementation Order

## Milestone 0 — Lock documentation

Deliver:

- this master plan committed to the repository;
- no code behavior change.

Suggested repo path:

`docs/architecture/CREATURE_DAMAGE_GORE_WILDLIFE_MASTER_PLAN.md`

## Milestone 1 — Slash profiler

Deliver:

- current slash diagnostics;
- performance markers;
- repeatable test scenario;
- baseline measurements.

## Milestone 2 — Slash Contact Kernel

Deliver:

- low-allocation contact;
- stable ownership;
- batched wound extension;
- knife parity;
- improved responsiveness.

Do not begin sword runtime until this passes.

## Milestone 3 — Shared physical weapon framework

Deliver:

- reusable world weapon base;
- contact primitives;
- diagnostics;
- knife migrated without regression.

## Milestone 4 — Damage Readiness Analyzer v3.7

Deliver:

- Testman topology/weight report;
- lower-spine seam report;
- head/elbow seam report;
- no destructive edits.

## Milestone 5 — New sword vertical slice

Deliver:

- new 3D sword;
- knife-style direct manipulation;
- physical slash contact;
- shallow/deep wound;
- no dismemberment yet.

## Milestone 6 — New mace vertical slice

Deliver:

- new 3D mace;
- knife-style direct manipulation;
- blunt collision;
- head/arm/chest trauma events;
- no deformation yet.

## Milestone 7 — Testman deformation

Deliver:

- head dent;
- arm deformation;
- chest cave;
- trauma-driven morph controller.

## Milestone 8 — Segment/stump authoring v3.8

Deliver:

- head;
- left forearm;
- right forearm;
- caps;
- damage manifest.

## Milestone 9 — Dismemberment vertical slice

Deliver:

- debug decapitation;
- debug left/right forearm detachment;
- stable physics;
- wound transfer;
- stump reveal.

## Milestone 10 — Weapon-driven detachment

Deliver:

- sword thresholds;
- seam detection;
- decapitation;
- forearm severing.

## Milestone 11 — Lower-spine waist split

Deliver:

- authored upper/lower assemblies;
- sword bisection;
- fatal split;
- stable corpse physics.

## Milestone 12 — Knife disembowelment

Deliver:

- abdominal drag-cut state;
- viscera tether;
- pooled physics;
- release and settling.

## Milestone 13 — Creature Forge v4.0

Deliver:

- profile-driven humanoid/quadruped authoring;
- creature/damage manifests;
- validation.

## Milestone 14 — Deer runtime

Deliver:

- quadruped loading;
- animation;
- anatomy;
- damage;
- death;
- carcass.

## Milestone 15 — Herd and North Road

Deliver:

- herd AI;
- hearing;
- fleeing;
- spawn budgets;
- injured movement;
- North Road deployment.

## Milestone 16 — Harvest loop

Deliver:

- knife butchering;
- raw meat;
- cooking;
- eating;
- persistent carcass state.

## Milestone 17 — Sound integration

Deliver:

- supplied sound package mapped to stable cues;
- concurrency and distance budgets;
- no gameplay behavior changes.

---

# 21. Testing Strategy

## 21.1 Slash performance tests

- 60-second continuous knife slash test;
- maximum queue length;
- allocation/GC observation;
- contact latency;
- path continuity;
- wound sample count;
- multiple enemy routing;
- corpse and ragdoll surface attachment.

## 21.2 Weapon tests

Every new weapon:

- direct pose follows input;
- no contact without deliberate ownership;
- visible geometry matches collision;
- no damage through walls;
- no spring-return damage;
- correct semantic region;
- correct weapon-family event;
- works on moving target;
- works during authored animation;
- works after ragdoll where allowed.

## 21.3 Deformation tests

- gradual morph;
- maximum clamp;
- mirrored sides;
- survives animation transitions;
- survives death;
- survives ragdoll;
- no bone scaling;
- no altered bind pose.

## 21.4 Dismemberment tests

- correct seam;
- correct visible pieces;
- correct caps;
- correct physics body;
- correct inherited momentum;
- correct wound ownership;
- no animation override;
- no duplicate segment;
- no repeated detachment;
- cleanup and pooling.

## 21.5 Quadruped tests

- correct scale and ground;
- walk/trot/run;
- turns;
- hurt side;
- death;
- anatomy routing;
- herd panic;
- obstacle avoidance;
- wounded speed;
- carcass.

## 21.6 Harvest tests

- requires correct tool;
- no harvest while alive;
- bounded yield;
- persistent state;
- inventory update;
- cooking;
- hunger restoration;
- no duplicate infinite yield.

---

# 22. Performance Budgets

Initial targets:

```text
fixed physics: 60 Hz
slash contact latency: <= 1 physics frame
active slash interactions per weapon: 1
active high-detail viscera tether: 1 nearby
viscera segments: 8–12
detached high-detail segments per corpse: bounded
static wound sample count: bounded
weapon hot-loop allocations: effectively zero
off-screen gore updates: reduced or frozen
settled detached pieces: sleep/freeze
```

Exact budgets should be tuned from profiling rather than guessed permanently.

---

# 23. Repository Structure

Suggested additions:

```text
docs/architecture/
└── CREATURE_DAMAGE_GORE_WILDLIFE_MASTER_PLAN.md

src/game/combat/weapons/
├── WorldMeleeWeaponController.js
├── WeaponContactRouter.js
├── SlashContactKernel.js
├── PointContactKernel.js
├── BluntContactKernel.js
├── SwordWorldWeaponController.js
└── MaceWorldWeaponController.js

src/game/creatures/
├── CreatureAnatomyProfile.js
├── CreatureDamageState.js
├── CreatureDeformationController.js
├── CreatureDismembermentController.js
├── DetachedSegmentRuntime.js
├── CreatureVisceraController.js
├── CreatureCorpseController.js
├── CorpseHarvestController.js
└── profiles/

public/assets/weapons/
├── sword/
└── mace/

public/assets/enemies/testman/
├── testman_animpack_v002.glb
├── testman_animpack_v002.json
├── testman_damage_v001.json
└── future damage-ready GLB versions

public/assets/wildlife/deer/
├── deer_creaturepack_v001.glb
├── deer_creaturepack_v001.json
└── deer_damage_v001.json
```

The exact path for Blender add-on source should follow the repository’s existing tooling convention. Recommended fallback:

`tools/blender/dreadstone_forge/`

---

# 24. Pull Request Discipline

Do not create one giant gore PR.

Recommended PR chain:

1. documentation lock;
2. slash instrumentation;
3. slash kernel optimization;
4. reusable weapon foundation;
5. sword contact vertical slice;
6. mace contact vertical slice;
7. Forge analyzer;
8. Testman morph deformation;
9. Testman head/forearm segmentation;
10. debug dismemberment runtime;
11. weapon-driven dismemberment;
12. waist bisection;
13. viscera tether;
14. creature profile extraction;
15. deer;
16. herd AI;
17. harvesting;
18. sound integration.

Each PR must include:

- files changed;
- behavior added;
- diagnostics;
- tests;
- performance impact;
- known limitations;
- next dependency.

---

# 25. Risk Register

## Risk: slash optimization changes knife feel

Mitigation:

- capture baseline diagnostics;
- preserve direct hand tracking;
- compare side-by-side;
- gate behind a development flag during transition.

## Risk: segmented mesh shows seams during animation

Mitigation:

- overlap seam geometry;
- use stump/cap masking;
- keep compatible weights;
- author hidden overlap bands;
- validate extreme poses.

## Risk: wound bindings break after detachment

Mitigation:

- stable topology;
- region ownership metadata;
- convert attached binding to detached-local binding at release;
- test every eligible segment.

## Risk: waist split destabilizes ragdoll

Mitigation:

- implement after simple detachments;
- fixed authored seam;
- fatal-only;
- capture transforms before removing joints;
- bound inherited velocities.

## Risk: viscera destroys performance

Mitigation:

- object pooling;
- one high-detail active tether;
- bounded segments;
- sleep/freeze;
- simplified distant state.

## Risk: quadruped generalization becomes a rewrite

Mitigation:

- extract components gradually;
- maintain Testman parity;
- profile-driven requirements;
- deer first;
- no broad refactor before a working vertical slice.

---

# 26. First Immediate Execution Slice

The first work after committing this plan is:

## Slash Performance Foundation

1. Add diagnostics to the current knife slash path.
2. Build a deterministic Folsom slash benchmark.
3. Measure:
   - casts;
   - contact latency;
   - allocations;
   - extensions;
   - event queue;
   - wound updates.
4. Implement `SlashContactKernel`.
5. Replace per-frame scheduled wound extension with batched accumulation.
6. Preserve all puncture/embedded/withdrawal behavior.
7. Verify the knife feels faster and more stable.
8. Only then begin the sword.

This is the highest-leverage first move because the sword, dismemberment, and wildlife combat all depend on a fast and trustworthy moving-edge contact system.

---

# 27. Codex Context Header

Use this header at the beginning of future Codex tasks for this initiative:

> Dreadstone Black 2.0 is building a profile-driven physical creature damage framework. The deleted broadsword system is forbidden and must not be reused. The Old Work Knife is the canonical reference for all new physical weapons: direct world-space manipulation, deliberate input ownership, visible collision alignment, semantic anatomy routing, resistance, wounds, physiology, and real consequences. Phase 0 is slash optimization. Dismemberment uses authored anatomical seams and stable topology. The lower-spine waist seam is approved. The Blender add-on authors segments, caps, morphs, sockets, and manifests; the repository owns runtime weapon contact, deformation, detachment, physics, viscera, AI, harvesting, saving, and audio events.

---

# 28. Final Direction

The full feature is approved.

The implementation philosophy is:

```text
real player-controlled weapon motion
+ optimized physical contact
+ semantic anatomy
+ authored deformation
+ authored structural boundaries
+ deterministic runtime failure
+ reusable creature profiles
+ survival consequences
```

This initiative begins with slash optimization and Testman, expands through sword/mace/knife gore, then becomes the quadruped wildlife and harvesting foundation for North Road.
