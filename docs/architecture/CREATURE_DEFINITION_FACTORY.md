# Creature Definition Registry and Factory

Milestone 4 adds the gameplay-owned layer between validated Creature Packs and the existing humanoid combat actor. It does not change Forge assets, rewrite `HumanoidCombatActor`, add AI or persistence, or migrate canonical Folsom.

```text
Creature Definition ID
        ↓
validated Creature Definition
        +
resolved Creature Pack
        ↓
current humanoid runtime profile
        ↓
HumanoidCombatActor
```

## Authority boundary

A Creature Pack is a technical body cartridge. It owns repository asset paths, measured bounds, Forge authoring identity, source fingerprints, skeleton metadata, approved animation capability, native progressive sites, deformation keys, gore/stain bindings, and exported segment definitions.

A Creature Definition is a gameplay archetype. It owns stable gameplay identity, the referenced pack ID, target height, voice, presentation and movement tuning, animation selection, the current supported damage-segment subset, progressive cadence, terminal-stage mortality, durability/lethality tuning, and a reference to any temporary compatibility profile.

Definitions do not contain GLB or manifest paths, raw bounds, fingerprints, authoring versions, Forge site records, morph keys, gore/stain bindings, exported segment records, bone maps, or runtime-skeleton metadata. `src/contracts/CreatureDefinition.js` rejects unknown contract fields and explicitly diagnoses these technical fields if they appear anywhere in a definition.

## `dreadstone.creature_definition.v1`

The versioned contract has this shape:

```text
schema, version
definitionId, displayName, creaturePackId
voiceProfile
collisionProfileId
presentation
  targetHeight
  groundClearance
  rootYaw
  rootOffset
  colliderFitNotes
movement
  walkReferenceSpeed
animation
  animationAuthoritative
  restPoseAuthoritative
  authoredAnimationPack
  authoredDeathAnimations
  ignoreEmbeddedAnimations
  holdingPoseMode
  fadeSeconds
  runtimeKinds
  selectedAnimationNames
  ignoredEmbeddedAnimationNames
  requireEmbeddedApprovalMetadata
damage
  supportedSegmentIds
  compatibilityProgressiveSiteProfileId
  progressiveHitsPerStage
  maceImpactBlood
mortality
  terminalProgressiveDamageFatal
durability
  multiplier
  piercingLethalityMultiplier
```

The schema requires stable lowercase IDs, finite positive tuning, explicit booleans, finite presentation vectors, and unique string arrays. Definitions are validated and cloned into immutable registry records before use.

## Production registry

`src/game/creatures/CreatureDefinitionRegistry.js` contains three explicit production definitions:

| Definition ID | Display name | Creature Pack ID | Target height |
| --- | --- | --- | ---: |
| `chezwick` | Chezwick | `chezwick_damage_v001` | 1.5 m |
| `dreadguard` | Dreadguard | `dreadguard_damage_v001` | 1.5 m |
| `dread_ram_god` | Dread Ram God | `dread_ram_god_damage_v001` | 1.7 m |

Definition IDs are independent from pack IDs. The registry also supports multiple definitions referencing one pack and exposes that relationship explicitly through `findDefinitionsForPack`; it never derives a definition ID from a pack ID.

## Current runtime bridge

`src/game/creatures/CreatureRuntimePolicies.js` is no longer a separate production policy registry. It now composes validated definitions with validated packs and holds only temporary current-humanoid compatibility data that does not belong in either contract:

- the current collision profile's bone map and proxy fit;
- Chezwick's omitted left-face compatibility site;
- Dreadguard's omitted left-head compatibility site.

Definitions reference those compatibility records by stable profile ID. The full technical records are not copied into definitions. Former runtime-policy exports remain derived aliases or lookup helpers for temporary caller compatibility; they do not own independent values.

Composition validates:

- the Creature Pack descriptor;
- the Creature Definition contract;
- exact definition-to-pack identity;
- current skeleton and bone-map support;
- current collision-profile support;
- compatibility-profile availability;
- requested segments against pack capability and current runtime support;
- selected animations against pack-approved clips.

The composed result remains the profile shape accepted by `HumanoidCombatActor` and `HumanoidGlbVisualAdapter`. Pack-owned technical values are copied from the resolved pack only; gameplay values are copied from the definition only.

## Creature Factory

`src/game/creatures/CreatureFactory.js` is the single generic factory. It accepts a definition ID and:

1. resolves the definition from `CreatureDefinitionRegistry`;
2. loads the referenced pack through `CreaturePackRegistry`;
3. validates current runtime support;
4. composes the current humanoid runtime profile;
5. constructs `HumanoidCombatActor` through the existing actor options/profile path.

The factory has no Chezwick, Dreadguard, or Dread Ram God branches. Actor construction is injectable for focused tests. `resolve()` supports asynchronous pack loading, while `createActorFromResolved()` lets existing synchronous walker lifecycle code construct replacement actors after resolution.

## Creature Lab migration

Creature Lab lists and selects definitions. Each selection follows:

```text
definition
  → pack
  → runtime support/profile composition
  → factory actor construction
  → existing walker reset and cleanup
```

The UI displays definition identity and target height while retaining pack diagnostics for technical inspection. The primary query is `?creatureDefinition=<definitionId>` when `?creatureLab=1` is active. The old `creaturePack` query and `selectPack` debug helper remain temporary compatibility bridges only when exactly one definition references the pack; ambiguous multi-definition packs require an explicit definition ID.

Pack/definition switching keeps the established cleanup order: cancel the weapon target, dispose markers and the current walker actor, replace the factory closure, reset the walker, wait for visual readiness, then expose the new damage sites.

## Preserved behavior and limits

- Chezwick and Dreadguard retain their effective 1.5 m height and animation/damage selections.
- Dread Ram God uses the same six approved animations, no guard role, four native sites, no compatibility sites, one hit per stage, nonfatal terminal progressive damage, and active `head_neck`, `left_elbow`, and `right_elbow` segments. `lower_spine` remains pack-available and runtime-inactive.
- Dread Ram God target height is definition-owned and intentionally set to 1.7 m. Forge coordinates, authored radii, targeting tolerance, skeleton data, and damage metadata are unchanged.
- Canonical non-lab Folsom still constructs its legacy Chezwick profile directly. This milestone does not migrate production encounters.
- AI, physiology semantics, persistence, creature-instance IDs, encounters, factions, schedules, dialogue, loot, harvesting, simulation tiers, and non-humanoid support remain out of scope.

Focused coverage lives in `tests/creature-definition-factory.test.mjs` and the migrated Creature Lab tests. The standard gates are:

```powershell
npm run validate:creature-packs
npm run validate:combat
npm run validate:folsom
npm run build
```
