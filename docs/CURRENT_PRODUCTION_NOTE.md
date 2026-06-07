# Current Production Note

This note captures the current practical direction for Dread Stone Black. It is not a permanent final roadmap. It should guide near-term Codex tasks and asset decisions until we intentionally revise it.

## Current creature animation rule

For now, animated creatures/NPCs should use only:

- idle animation
- walk animation

Attack, hurt, death, dialogue, and more advanced animation states are deferred.

Reason: the current successful creature pipeline depends on limited animation credits/accounts. We should spend those credits carefully and not overbuild animation states before the game feel is strong.

## Proven animated creature pipeline

Current successful pipeline:

1. Generate/source creature model.
2. Optimize if needed.
3. Use Anything World / Animate Anything to produce idle and walk GLB animations.
4. Upload game-ready GLBs into the repo.
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

Ram Man is the first proven example of this pipeline.

## Near-term creature scope

Do not flood the project with many new creatures yet.

Near-term target:

- Ram Man friendly NPC is proven.
- Add only 2-3 more animated NPCs/enemies for now.
- Focus on making those few creatures feel good in the dungeon.
- Avoid spending animation credits on attack/hurt/death until the core game loop and world feel are stronger.

## Near-term gameplay priority

After a few animated creatures are proven, shift focus back to game feel:

- movement feel
- combat feel
- dungeon pacing
- UI readability
- lighting/fog mood
- chamber layout
- progression clarity
- performance on iPhone browser

Do not let asset generation outrun the playable game.

## Future world/map direction

Eventually, the game world should be planned through a large engineering-style technical map document.

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

## Outdoor environment need

The current interior chamber set is strong enough to keep building on:

- chamber walls
- floors
- ceilings
- gate materials
- dark dungeon lighting

The next major environment asset category should be outdoors:

- grass/field texture
- dirt/path texture
- simple tree set
- low-poly rocks
- boundary walls/cliffs
- exterior fog/sky treatment

Outdoor spaces may serve two possible purposes:

1. Connect separate dungeon chambers through field paths.
2. Create one large open field with multiple chambers/entrances placed along its walls or boundary.

This is a future expansion target, not the immediate next PR unless explicitly requested.

## Current discipline

For now:

- use idle/walk only for animated GLB creatures
- add only 2-3 more animated creatures/NPCs
- keep the game mobile-first
- keep Pages deployment safe
- do not change `vite.config.ts` base path
- do not remove `.github/workflows/deploy-pages.yml`
- keep PRs small and focused
- prioritize game feel over asset count
