# Current Production Note

This note captures the current practical direction for Dread Stone Black. It is not a permanent final roadmap. It should guide near-term Codex tasks and asset decisions until we intentionally revise it.


## Current Built State

The current built slice is no longer only an interior test space. It now has a working world loop:

- Reliquary Field outdoor tomb-field exists as the first playable overworld space.
- South Reliquary Crypt baby labyrinth exists under the field.
- The field-to-crypt-to-return route is a working core structure.
- Ram Man proves the friendly animated NPC pipeline.
- Sheep Demon proves the hostile animated enemy pipeline, including multiple GLB animation states.
- The Hunyuan → texture optimization → Animate Anything → GLB animation → Three.js integration workflow is proven for creatures.

Treat this as the baseline for future Codex tasks. New work should extend the loop instead of rebuilding it from scratch.

## Current creature animation rule

For now, animated creatures/NPCs should use only:

- idle animation
- walk animation

Attack, hurt, death, dialogue, and more advanced animation states are deferred.

Reason: the current successful creature pipeline depends on limited animation credits/accounts. We should spend those credits carefully and not overbuild animation states before the game feel is strong.

## Proven animated creature pipeline

Current successful pipeline:

1. Generate/source creature model, including Hunyuan-generated concepts when useful.
2. Optimize model and textures for browser/mobile use.
3. Use Animate Anything / related GLB animation tooling to produce game-ready animation states.
4. Upload optimized GLBs into the repo.
5. Integrate in Three.js with GLTFLoader and AnimationMixer.

Naming pattern for friendly NPCs:

```text
public/assets/npcs/<npc_name>/<npc_name>_idle_01.glb
public/assets/npcs/<npc_name>/<npc_name>_walk_01.glb
```

Naming pattern for enemies:

```text
public/assets/enemies/<enemy_name>/<enemy_name>_idle_01.glb
public/assets/enemies/<enemy_name>/<enemy_name>_walk_01.glb
```

Ram Man is the first proven friendly NPC example of this pipeline. Sheep Demon is the first proven hostile enemy example and a successful concept proof. Leave deeper Sheep Demon tuning for later unless the user explicitly prioritizes creature polish.

## Near-term creature scope

Do not flood the project with many new creatures yet.

Near-term interpretation:

- Ram Man friendly NPC is proven.
- Sheep Demon hostile enemy is proven enough as a concept proof.
- Future combat/creature polish should wait until world structure, objectives, and progression clarity advance.
- Add new animated creatures only when they support a concrete location or gameplay objective.
- Avoid spending animation credits on attack/hurt/death until the core game loop and world feel are stronger.

## Near-term gameplay priority

The basic field and first baby labyrinth now establish the world loop. Shift focus toward making that loop understandable and purposeful:

- first real player objective
- clear reason to enter crypts
- field landmarks and navigation clarity
- dungeon pacing
- UI readability
- lighting/fog mood
- progression clarity
- performance on iPhone browser

Do not let asset generation outrun the playable game.

## Future world/map direction

The next world work should build outward from the existing Reliquary Field and South Reliquary Crypt loop. Eventually, the game world should be planned through a large engineering-style technical map document.

The world can grow much larger than the current test dungeon. A future map document should describe:

- major chambers
- outdoor areas
- field connections
- gates and shortcuts
- dungeon entrances
- progression locks
- landmarks
- spatial flow

This future map can be hand-drawn or drafted as a technical/engineering-style map before being translated into game spaces.

## Outdoor and crypt interpretation

The Reliquary Field and South Reliquary Crypt are already built enough to serve as foundations. Do not treat either one as a fresh build target. Future work should add clarity, objectives, or addendums.

Useful expansion categories:

- field landmarks readable through fog
- dirt/path treatment that guides the player without a minimap
- stronger tomb-mouth silhouettes and return-route cues
- simple objective props that reuse current materials
- addendums for locked gates, reliquary rewards, shortcuts, or new crypt branches
- additional Architect-authored locations connected by the field loop

## Next Useful Work

Prioritize small documentation or implementation tasks that make the existing loop feel intentional:

- Define the first real player objective in one sentence and one interactable object.
- Give the player a practical progression reason to enter the crypts.
- Improve Reliquary Field landmarks, paths, and navigation clarity.
- Draft the next Architect blueprint for an additional connected location.
- Use South Reliquary Crypt addendums for future branches, gates, rewards, or encounter changes.
- Return to combat, enemy behavior, and creature animation polish after world flow advances.

## Current discipline

For now:

- default to idle/walk only for new animated GLB creatures unless explicitly approved
- treat Sheep Demon as a successful proof and defer deeper tuning
- keep the game mobile-first
- keep Pages deployment safe
- do not change `vite.config.ts` base path
- do not remove `.github/workflows/deploy-pages.yml`
- keep PRs small and focused
- prioritize game feel over asset count
