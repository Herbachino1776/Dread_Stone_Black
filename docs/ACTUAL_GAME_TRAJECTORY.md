# Dread Stone Black — Actual Game Trajectory

This document records the game Dread Stone Black is actually becoming.

It exists because the original strategy guide is now a design reservoir, not an implementation specification. The guide still contains useful atmosphere, narrative intent, location ideas, progression pressure, and occasional encounters or objects worth adapting, but the live game has deliberately diverged from its room lists, item checklists, map assumptions, Severing language, enemy cadence, and chapter-by-chapter implementation details.

## Authority and use

For implementation decisions, use this order:

1. `docs/CURRENT_PRODUCTION_NOTE.md` and the active milestone document define the immediate production lock.
2. This document defines the current macro trajectory and how older strategy material should be interpreted.
3. Current architecture and subsystem documents define technical contracts already proven in the game.
4. The original strategy guide and older blueprints are inspiration and historical design reference only.

If the old guide conflicts with the playable game or a current lock, the playable game and current lock win.

The question is no longer "what does the guide say happens next?" The useful question is "what was this old beat trying to accomplish, and what is the strongest version of that purpose in the game we have now?"

---

## Where the live game is now

In old-guide geography, the game has reached early Chapter 3 territory: below the Folsom shrine and immediately beyond the lower-shrine threshold.

That comparison is only approximate. Chapters 1 and 2 were heavily rewritten, and the current route into Chapter 3 no longer resembles the guide's literal sequence.

The implemented progression spine is now:

```text
FOLSOM
  -> discover the Old Work Knife behind the tool shed
  -> physically clear black growth from the shed
  -> recover Wood Axe + Torch
  -> physically open the Shrine Side Room: Knife cords -> Axe hard knot
  -> recover the Keeper's Lantern
  -> use the Lantern reveal wash to expose the hidden under-shrine convergence
  -> physically clear the connected surface feeds/endpoints
  -> unseal the Underworks
  -> enter beneath-folsom
  -> recover the Iron Drain Bar
  -> physically seat and pry the drain grate
  -> use the Keeper's Lantern to reveal the hidden glyph/growth gate
  -> physically knife-clear that gate
  -> cross the blue-flame threshold hallway
  -> physically pry the explicit lower shrine hatch
  -> reach the impossible White-Scab front threshold
  -> cut the exposed lower knot without opening the front seal
  -> pressure releases at the old Folsom shrine crawlspace terminal
  -> return to Folsom
  -> enter the separate under-shrine-labyrinth
  -> descend through the twisting dark bypass
  -> pry the labyrinth end hatch
  -> emerge behind the denied White-Scab threshold
  -> current production boundary
```

The current frontier is therefore not "build the old Chapter 3 checklist." It is: establish what lies behind that denied threshold using the physical, reveal-driven language the live game has earned.

---

## The central design change: from prescribed Severing to physical uncovering

The old strategy guide was built around a repeated Severing grammar: reveal a seam or thread, perform the prescribed gesture, and remove the obstruction.

That is no longer the governing interaction model.

The live game is moving toward a more physical rule:

```text
black growth / black scab / tarred root / burnt mycelium
        =
material covering, binding, sealing, feeding, or protecting something real
```

The player should read the material, choose the correct physical tool, make contact with the correct active part of that tool, damage or remove the obstruction, and reveal the structure beneath it.

This means the important interaction is not "execute the magic gesture." It is "understand what is physically here and force it to give way."

The current tool vocabulary reflects this:

- Old Work Knife: fast physical cutting/slashing of cord, film, seam growth, exposed knots, and similar thin material.
- Wood Axe: slower committed chopping of hard, fire-hardened, or thick growth.
- Iron Drain Bar: planted, socketed, constrained lever prying of authored structures.

Interact/A is not the victory path for tool-authored blockers.

Future scab and growth mechanics should build on this physical language rather than resurrecting vertical/horizontal/diagonal/circular/V-cut Severing prompts from the old guide.

---

## Black scab is a covering, not the final mystery

Black material is increasingly valuable when it conceals or interferes with something underneath.

The preferred progression language is:

```text
obstruction
  -> physical damage/removal
  -> exposed older structure
  -> inspection/reveal/activation
  -> visible world-state response
```

This is especially important in the lower shrine. Black scab should not become an endless sequence of interchangeable black targets. Its strongest purpose is to hide, bind, interrupt, or parasitize the pale system beneath the human shrine.

Destroying the black covering should make the world more legible and more disturbing.

---

## The Keeper's Lantern is a reveal instrument

The Keeper's Lantern is no longer just a stronger torch.

Its important identity is a bounded reveal emitter — effectively a blacklight/spectral inspection tool for hidden glyphs, feeds, stains, lines, and structures that ordinary Torch or ambient illumination cannot expose.

That gives Dread Stone Black two overlapping readings of the same place:

```text
ordinary visible world
        +
Keeper's Lantern reveal state
        =
a second layer of hidden information
```

This should remain a major exploration language.

The Lantern should reveal information rather than automatically solve it. The player still needs to interpret what was exposed and often use a separate physical tool to act on it.

Avoid turning the Lantern into a generic "show objective" cone or permanent detective vision.

---

## Navigation should come from the world, not a required map system

The old guide assumed several literal map objects and map-update beats.

The live game does not currently depend on maps, and it should not acquire a map system merely because the old chapter outline contained one.

Navigation and understanding should preferentially come from:

- memorable physical spaces;
- visible route changes;
- revealed glyphs, lines, cords, feeds, and architectural relationships;
- doors, hatches, grates, crawlspaces, thresholds, and return loops that physically change;
- lighting and environmental contrast;
- persistent world-state changes;
- strong landmarks and authored sightlines.

A future map is not forbidden. It simply needs a real gameplay reason. "The guide had a Shrine Mechanism Map" is not one.

Likewise, route progress should not be converted into inventory clutter. Opened paths, destroyed growth, cleared seals, and exposed machinery belong primarily to world state.

---

## White architecture: older, sacred, impossible, and physical

The lower white system should not read as generic science-fiction machinery.

The useful core from the strategy guide is that Folsom's human shrine sits on something much older, and the human religious layer has partially misunderstood, reused, covered, or ritualized structures it did not create.

The white system should feel:

- pale/white-marble or stone-like rather than industrial metal by default;
- intricate without becoming visual noise;
- sacred or ceremonial without confirming a simple religion;
- mechanically responsive without looking like a modern control panel;
- ancient, fitted, and difficult to explain;
- physically embedded in architecture rather than presented as floating UI.

Church fixtures or rituals may accidentally align with old functions, but that old guide idea is inspiration, not a required puzzle formula.

The next lower-shrine work should establish one excellent readable example of black covering -> pale mechanism -> physical/reveal response before any broad "white machinery framework" is built.

---

## What the old strategy guide still contributes

The old guide remains useful for purpose and pressure.

For example, its Chapter 3 was trying to accomplish several things that are still valuable:

1. Prove that the visible shrine was built over something older.
2. Establish a strong material contrast between human construction, black growth, and pale underlying architecture.
3. Teach the player that black growth can conceal or interfere with the older system.
4. Introduce ways to expose and manipulate that system.
5. Deepen the question of why the protagonist, the wound, or certain tools can interact with it.
6. Drive the player toward a deeper crypt/dungeon threshold.

Those intentions are useful.

The exact Candle Chamber, Broken Prayer Room, Shrine Mechanism Map, prescribed ring puzzle, Lower Shrine Mark, collectible proof items, fixed Severing gestures, and room order are not obligations.

Use the guide as a mine, not a checklist.

---

## Major deliberate divergences from the old guide

### Folsom and Chapters 1-2

The opening has become a physical tool-and-world-state proof rather than a dialogue/checklist-heavy tutorial sequence.

The Old Work Knife is discovered behind the shed. Black growth seals physical structures. The Shrine Side Room and connected-growth network are environmental systems. The Keeper's Lantern now reveals hidden information. The Iron Drain Bar is a physical pry tool. The lower shrine hatch is a real authored physical interaction.

### No required early enemy ladder

The old guide introduced several enemies very early. Canonical production deliberately deferred enemy encounters while the physical world interaction language and creature production pipeline were being proven.

This is not a permanent "no enemies" decision. It means the first production enemy should arrive because the authored location needs one, not because an old checklist says one should have appeared three rooms ago.

### North road progression

The north road is no longer required to wait for the old Road Warden Seal / Chapter 4 proof chain. Current world progression has already decoupled that route from the guide's original linear dependency.

### Maps and collectible proof tokens

Old map beats and many proof-item concepts are not current requirements. Prefer environmental discovery and persistent world change unless an item has genuine equipment, narrative, trade, ritual, or interaction value.

### The Chapter 3 entry

The front lower-shrine seal is intentionally impossible from the approach side. The player instead triggers a remote release, backtracks to the Folsom crawlspace, enters the new under-shrine labyrinth, and emerges behind the denied threshold.

That bypass is now live game truth even though it is absent from the old strategy guide.

---

## Creature technology: proven platform, not the main production branch

The creature pipeline is now a real production capability:

```text
Forge export
  -> validated Creature Pack
  -> Creature Definition
  -> Creature Factory
  -> current runtime actor
```

The Creature Lab has proven multiple production bodies, animation-following 3D progressive damage, gore/stains, supported detachments, definition-owned presentation tuning, and clean switching.

That work substantially retires the risk of "can we get authored creatures into the game cleanly?"

Creature-platform development should now be demand-driven.

Do not automatically build physiology, simulation tiers, universal persistence, non-humanoid abstractions, or a giant AI framework because they are next on an architecture roadmap. Add those when a real production encounter or creature requires them.

One hard rule remains: gameplay consequences must not branch on raw Forge `siteId` strings. If semantic wound consequences become necessary later, introduce an appropriate generic semantic layer at that time.

---

## Current near-term trajectory

The immediate game should return to production content rather than continue an architecture-only march.

### 1. Physical tool ergonomics lock

Before multiplying Chapter 3 blockers, make the existing Knife, Axe, Drain Bar, grip capture, look/movement coexistence, active-part collision, recoil, pry seating, release behavior, and phone ergonomics trustworthy enough to build on.

This is a feel-and-reliability pass, not a new framework.

### 2. Cross the current Chapter 3 production boundary

Build the first real White-Scab / pale-machinery sequence behind the denied threshold.

The goal is not to reproduce the old Outer Glyph Hall room list. The goal is to establish the new lower-shrine language:

```text
black covering
  -> Lantern/reveal information
  -> physical removal or manipulation
  -> exposed pale structure
  -> readable architectural response
  -> route progression
```

Start narrow. One excellent playable proof is more valuable than a broad unfinished white-system framework.

### 3. First production creature encounter

Once the location naturally calls for danger, take one Creature Definition out of Creature Lab and put it into one authored, bounded canonical encounter.

That should prove the real chain:

```text
Creature Definition
  -> Creature Factory
  -> canonical location
  -> combat
  -> death/cleanup
  -> route or world-state consequence
```

Only then expand behavior/AI according to actual encounter needs.

### 4. Continue world production

Favor continued Chapter 3 / crypt / world progress over speculative subsystem milestones.

Physiology, creature persistence, simulation tiers, non-humanoids, Records/Memory UI, maps, broad white-system frameworks, and large AI systems remain demand-driven features rather than automatic next milestones.

---

## Production laws to protect

These are the trajectory-level rules future work should preserve unless deliberately superseded:

- Mobile-first. Phone play is the primary interaction target.
- The game is slow, physical, readable, ominous, and tactile.
- The player should feel like they are forcing a buried world to reveal what it has sealed away.
- Physical blockers are solved by correct tools and physical contact, not generic Interact/A victory paths.
- Black growth/scab is material obstruction, covering, binding, feeding, or sealing — not generic magic goo.
- Do not resurrect the old prescribed Severing-gesture ladder as the core mechanic.
- The Keeper's Lantern reveals a hidden information layer; it is not merely a brighter Torch.
- Prefer environmental teaching over tutorial prose.
- Prefer world-state change over progression-token inventory clutter.
- Do not add maps simply to satisfy old guide beats.
- White architecture should feel ancient, sacred, pale, intricate, and impossible rather than generic sci-fi.
- Build the smallest real playable proof before broad frameworks.
- Let actual production encounters reveal what AI/physiology/persistence systems are needed.
- Never let raw Forge technical IDs become gameplay semantics.
- Do not interpret deviation from the old strategy guide as missing content by default.

---

## How to adapt an old guide beat

When mining the strategy guide, reduce the old beat to four questions:

1. What emotion or realization was this beat supposed to create?
2. What progression pressure did it provide?
3. Is there a physical object, location idea, enemy, image, or story clue worth retaining?
4. How would that purpose work using the live game's current tool, reveal, scab, world-state, creature, and mobile interaction language?

Then build the current-game answer.

Do not preserve an obsolete mechanic merely to preserve the old sequence around it.

---

## Current summary

Dread Stone Black is no longer a literal implementation of the strategy guide.

It is a mobile-first physical dungeon crawler where black material hides and binds a buried pale world; the player uses tangible tools, a specialized reveal lantern, persistent changes to architecture, and increasingly production-ready creatures to force that hidden structure into view.

The old guide still provides mythology, atmosphere, pressure, and raw ideas. The live game decides their final form.
