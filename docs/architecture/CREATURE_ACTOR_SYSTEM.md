# Creature Actor System

The Creature Actor System is the reusable body layer for Dread Stone Black creatures. It exists so Ram Man, Sheep Demon, Neck Man, and future Hunyuan / Animate Anything creatures can share the same GLB loading, animation switching, material tuning, scale normalization, grounding, combat shell, and debug metadata instead of becoming one-off integrations.

The system is intentionally boring. It does not replace dungeon authoring, Black Grass Temple faction AI, battle direction, navigation, or encounter design. Controllers still make decisions. `CreatureActor` owns the visible body.

## Current Files

Engine files:

- `src/engine/creatures/CreatureActor.js`
- `src/engine/creatures/CreatureAnimationSet.js`
- `src/engine/creatures/CreatureMaterialProfile.js`
- `src/engine/creatures/CreatureCombatProfile.js`
- `src/engine/creatures/CreatureAIProfile.js`
- `src/engine/creatures/CreatureSpawnProfile.js`
- `src/engine/creatures/CreatureActorFactory.js`
- `src/engine/creatures/CreatureDebugInfo.js`
- `src/engine/creatures/CreatureRuntimeRegistry.js`

Game creature config files:

- `src/game/creatures/ramManFriendly.config.js`
- `src/game/creatures/sheepDemon.config.js`
- `src/game/creatures/neckMan.config.js`
- `src/game/creatures/creatureRegistry.js`

## Supported Creatures

- `ram_man_friendly`: friendly NPC body for the opening chamber patrol.
- `sheep_demon`: standalone dungeon enemy body and Black Grass Temple faction body.
- `neck_man`: Black Grass Temple faction body.

## Separation Of Responsibilities

`CreatureActor` handles:

- Root `THREE.Group`
- Separate GLB-per-animation loading
- Active animation root switching
- Animation fallback resolution
- Animation mixers and clip duration lookup
- Material profile application
- Scale normalization and grounding through the shared model loader
- Health basics
- Debug userData

Existing controllers handle:

- Friendly Ram Man patrol routing
- Standalone Sheep Demon AI
- Black Grass Temple faction target selection
- Battle director behavior
- Navigation and local obstacle avoidance
- Attack timing decisions
- Death and respawn loops

This split keeps Black Grass Temple faction war intact while replacing duplicated body setup.

## Config Anatomy

Creature configs are readable JavaScript objects. A config includes:

- `id`
- `identity`: display name, species, role, faction metadata, tags
- `assets`: base path, animation files, expected animations, fallback animations, material metadata
- `scale`: target height, max width, ground offset, y offset, rotation offset, scale multiplier, body radius
- `animationProfile`: semantic animation names, fallback mapping, fade durations, hold times, disabled/rare animations, attack choices
- `materialProfile`: texture color-space handling and species tuning
- `combatProfile`: health, ranges, cooldowns, damage windows, lunge/body spacing values, maneuver chances
- `aiProfile`: behavior metadata for controllers
- `spawnProfile`: onboarding and spawn metadata
- `debugProfile`: debug visualization flags

## Animation Fallbacks

The current asset pipeline uses separate GLB files per animation. `CreatureAnimationSet` loads those files into separate roots under one actor group. Only the active root is visible.

Fallbacks are resolved from:

1. Direct animation file key
2. `assets.fallbackAnimations`
3. `animationProfile.fallbackMapping`
4. The configured idle animation
5. The first available animation file

Calling `setAnimationState()` with the same state repeatedly does not restart the animation every frame. Missing optional states are tracked in debug metadata and do not stop the game from loading.

## Material Profiles

`CreatureMaterialProfile` traverses creature meshes, clones materials by default, sets base color and emissive maps to sRGB, and keeps normal/roughness/metalness-style maps in non-color space.

Current species notes:

- Sheep Demon uses `sheep_demon_high_contrast_low_sepia` to preserve readable contrast under warm dungeon and Black Grass Temple lighting.
- Neck Man uses `neck_man_preserve_current_color` to keep the current GLB color/material look while normalizing texture color spaces.
- Ram Man uses the default dungeon material handling.

Material profiles do not change global lighting.

## Combat Profiles

Combat profiles are metadata plus a small health shell. They centralize numbers such as max health, attack damage, ranges, cooldowns, damage windows, lunge distance, desired combat distance, body separation, and maneuver chances.

The controllers still decide when an attack begins and when damage is applied. This keeps the existing Sheep Demon and Black Grass Temple combat feel.

## Adding A New Creature

1. Drop animation GLBs into `public/assets/enemies/new_creature/`.
2. Add `src/game/creatures/newCreature.config.js`.
3. Export animation files, fallback mappings, material profile, combat profile, AI metadata, spawn metadata, and debug metadata.
4. Register the config in `src/game/creatures/creatureRegistry.js`.
5. Spawn it through:

```js
import { createCreatureActor } from '../engine/creatures/CreatureActorFactory.js';
import '../game/creatures/creatureRegistry.js';

const actor = createCreatureActor('new_creature', { scene, position, yaw });
await actor.load();
```

A controller can then call:

```js
actor.update(deltaSeconds);
actor.setAnimationState('walk');
actor.faceDirection(direction, deltaSeconds);
actor.takeDamage(10, 'player');
```

## Migrated So Far

- Friendly Ram Man loading, animation switching, scale, material, and debug metadata now go through `CreatureActor`.
- Standalone Sheep Demon loading, animation switching, scale, material, health sync, and debug metadata now go through `CreatureActor`.
- Black Grass Temple Sheep Demon and Neck Man body setup now goes through `CreatureActor`.
- Black Grass Temple faction AI, battle director, action bubble, target selection, navigation, local avoidance, combat tactics, player fallback targeting, death, and respawn loops remain in `BlackGrassTempleFactions.js`.

## Still Hand-Coded

- Ram Man patrol route and chamber behavior remain in `DungeonScene`.
- Standalone Sheep Demon behavior remains in `SheepDemonEnemy`.
- Black Grass Temple faction decision-making remains in `BlackGrassTempleFactions`.
- Encounter composition remains in dungeon/location runtime definitions.

## Current Limitations

- Separate GLB roots are switched for animation. The system does not retarget clips across rigs.
- Lazy-loaded animations may fall back briefly until their GLB finishes loading.
- Debug visualization flags are metadata only; the actor currently emits debug userData and concise dev load summaries.
- Combat profiles do not replace controller-specific attack timing yet.
