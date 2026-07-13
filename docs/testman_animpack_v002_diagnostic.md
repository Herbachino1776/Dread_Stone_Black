# Testman v002 authored combat animation pack

Testman now loads from `./assets/enemies/testman/testman_animpack_v002.glb` in Folsom and the combat laboratory. `testman_animpack_v002.json` is the animation metadata source of truth; runtime startup rejects the pack if a manifest animation is missing from the GLB.

The v002 pack is the sole skeletal pose authority for Testman:

- `DSB_Walk_NORMAL_v001` loops while the actor moves and holds its current authored pose while stopped.
- `DSB_Hurt_LEFT_Flank_v001` and `DSB_Hurt_RIGHT_Flank_v001` play once, then return to the prior walking or held state.
- `DSB_Death_ChestHold_LEFT_v001` and `DSB_Death_Faceplant_LEFT_v001` play once and clamp their final pose.

There is no procedural gait, additive procedural pain pose, procedural skeletal death collapse, or forced-ragdoll override in the Testman runtime. Invisible semantic combat proxies follow the completed authored mixer pose for hit detection, wounds, trauma, and blood; Testman mortality never drives the GLB bones from Rapier.

The legacy `public/assets/models/npc/human/model_idle.glb` file remains in the repository only as an integration fallback. It is not a runtime or validation target. Remove it only after in-browser Folsom checks confirm loading, manifest discovery, walk looping, both hurt recoveries, both terminal death holds, scale/grounding, and the complete combat validation suite.
