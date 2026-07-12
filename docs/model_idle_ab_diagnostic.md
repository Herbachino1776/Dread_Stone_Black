# model_idle.glb A/B diagnostic

Normal Folsom retains the canonical combat dummy and adds a non-combat raw `model_idle.glb` reference ten horizontal meters from the authored player spawn. The raw reference uses only a uniform root scale, world position, yaw, and one ground-height correction. Its exported idle animation plays without manual bone writes.

Launch Folsom with `?modelIdleCombatTest=1` to omit the raw reference and select `model_idle_combat_diagnostic` as the sole combat actor profile. This mode is session-only and does not write canonical save state.

Interpret the comparison as follows:

- Case 1 — Raw reference looks correct, but adapted combat mode looks distorted: the GLB/export is usable. The physics-to-skeleton adapter, bind offsets, bone mapping, or collider/rest-pose relationship is responsible.
- Case 2 — Raw reference is already distorted, twisted, scaled incorrectly, or animated incorrectly: the problem exists in the GLB/export, animation, hierarchy, skin, or authored transforms before combat adaptation.
- Case 3 — Raw reference is correct and adapted mode is also correct: the new GLB profile is compatible, and the prior asset/profile combination is the likely source of the earlier failure.
- Case 4 — Raw reference loads but adapted mode reports missing bones: the new GLB is valid, but its rig naming or hierarchy needs a dedicated map before it can become a combat actor.
