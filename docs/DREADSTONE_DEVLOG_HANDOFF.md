# Dreadstone development handoff

## Current combat-character baseline

Folsom Field and the Combat Lab use the Dreadstone Animation Forge bundle at:

- `public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.glb`
- `public/assets/enemies/dreadguard/damage/dreadguard_damage_v001.json`
- `public/assets/enemies/dreadguard/damage/dreadguard_damage_v001_validation.json`

`DREADGUARD_DAMAGE_COMBAT_PROFILE` in `src/game/combat/HumanoidModelProfiles.js` is the runtime profile. The old TestMan runtime profile and assets have been retired.

The Forge manifest is authoritative for intact objects, segments, attached/detached relationships, deformation regions, morph targets, generated gore nodes, and progressive-damage sites. Runtime validation rejects missing or duplicated required objects, invalid segment parenting, missing morph targets, inconsistent gore ownership, and invalid progressive stage bindings.

## Progressive damage proof

The current export has one progressive site:

- Site: `damage_site` (`Left Head`)
- Region / structural group: `head`
- Transition: `ADJACENT_CROSSFADE`
- Curve: `SMOOTHSTEP`
- Gore transition: `MIDPOINT_REPLACE`

The exported stage mapping is preserved exactly:

| Stage | Severity anchor | Morph target |
| --- | ---: | --- |
| Light | `0.33000001311302185` | `Left_Head_Impact_v003` |
| Medium | `0.6600000262260437` | `Left_Head_Impact_v002` |
| Heavy | `1` | `Left_Head_Impact_v001` |

The runtime stores independent state per manifest site, so future Forge exports can add more progressive sites without adding site-specific JavaScript constants. Mace selection resolves compatible sites by manifest region and local site position. Adjacent stages crossfade with at most two active morphs; detailed gore switches at the transition midpoint and does not stack.

In development builds, Folsom installs a console-only testing hook:

```js
__DSB_DREADGUARD_DAMAGE__.Light()
__DSB_DREADGUARD_DAMAGE__.Medium()
__DSB_DREADGUARD_DAMAGE__.Heavy()
__DSB_DREADGUARD_DAMAGE__.nextStage()
__DSB_DREADGUARD_DAMAGE__.resetAllDamage()
__DSB_DREADGUARD_DAMAGE__.diagnostics()
__DSB_DREADGUARD_DAMAGE__.characterDiagnostics()
```

The hook is not installed in production builds and adds no production UI.

## Animation limitation

The bundle is treated as having no approved animation pack. Although the GLB contains one embedded walk clip, the companion bundle does not declare an animation pack and the profile intentionally ignores embedded clips.

Living characters use the established physics-bound rest-pose fallback. Combat targeting, collision, wounds, progressive damage, gore ownership, and segment detachment remain available. Terminal states use the physics collapse fallback. No animations were fabricated or retargeted.

## Validation focus

The focused Dreadguard suite checks:

- bundle identity and the Forge PASS report;
- exact manifest stage/key/anchor mappings;
- clear missing-node and missing-morph failures;
- intact startup visibility;
- adjacent smoothstep crossfades and midpoint gore replacement;
- left-head mace progression through Light, Medium, and Heavy;
- attached-to-detached morph and gore ownership transfer;
- head and forearm detached physics, single-shot ownership, and reset;
- no-animation fallback configuration;
- absence of site/key hard-coding in the generic Forge runtime.

Use:

- `npm run validate:combat`
- `npm run validate:folsom`
- `npm run build`
