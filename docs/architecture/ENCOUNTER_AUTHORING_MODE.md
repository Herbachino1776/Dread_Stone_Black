# Encounter Authoring Mode

M9.5 adds a development-only, touch-first in-world authoring workflow for the
existing M9 encounter contract. It does not create an editor schema.

```text
DEV TOOLS
  -> ENCOUNTER AUTHORING
  -> active SceneSession locationId
  -> production baseline + location-scoped local draft
  -> EnemyPresetRegistry
  -> visual-only real preset preview
  -> canonical dreadstone.encounter_definition.v1
  -> TEST ENCOUNTER through EncounterRuntimeHost
  -> SAVE TO PROJECT through the safe development bridge
  -> src/game/encounters/data/<encounterId>.json
  -> next normal session discovers the encounter automatically
```

## Creature Lab versus Encounter Authoring

Creature Lab answers: **“What is this reusable enemy?”**

Encounter Authoring answers: **“Where does this exact individual live?”**

The ownership chain remains:

```text
Enemy Preset
  reusable enemy variant: body, target height, loadout, calibrated weapon,
  compatible Actions, and default reward

Encounter Spawn Record
  one placed individual: presetId, transform, homeRadius, optional fixed gold

spawnId
  stable authored world identity; future world persistence may trust it

actor.instanceId
  temporary runtime identity recreated by spawn/reset
```

Changing an individual's preset does not change its `spawnId`, transform, home
radius, or reward override. Runtime weapon data, scale, grip, capsule, Creature
Pack data, AI state, current HP, death, and loot state never enter the encounter
record.

## Opening the tool on phone

Run the Vite development server with `npm run dev`, open the normal game from an
iPhone on the same network, and use the touch-accessible **DEV TOOLS** button.
Choose **ENCOUNTER AUTHORING**. Existing query-driven tools remain available,
and `?encounterAuthoring=1` remains a direct fallback.

The Dev Tools launcher and all Encounter Authoring DOM are created only inside
the development branch. The production build contains neither the authoring
chunks nor a callable browser save endpoint.

Opening authoring mode:

1. reads the exact active `SceneSessionHost.locationId`;
2. suppresses and despawns registered production encounters;
3. preserves normal player movement, look, world collision, and terrain;
4. lists only installed encounters whose exact `locationId` matches;
5. lists valid location-scoped local drafts;
6. restores the last valid local draft for that location when available.

The bottom sheet can be minimized. Panel touches stop at the panel; touches in
the visible world continue into the existing mobile movement/look ownership.
Explicit PLACE and SELECT AT RETICLE buttons avoid taking all world touches.

If normal travel changes location while authoring is open, the current draft is
flushed to local storage, placement/move/test ownership is canceled, old preview
resources are released, and the shell rebinds to the new real SceneSession. A
Folsom draft is never shown as a North Road draft.

Closing authoring releases markers, previews, radius visualization, and any test
runtime, then re-enables registered production encounter activation.

## Creating and opening encounters

**OPEN EXISTING ENCOUNTER** clones the registry's immutable production record.
The registry object is never mutated in place.

**NEW ENCOUNTER** asks for display name and final encounter ID. The panel suggests
a lowercase slug but keeps the ID visible before creation. `locationId` is not
editable; it comes only from the current SceneSession. The new record begins as
a valid empty `dreadstone.encounter_definition.v1`.

The authority distinction is always explicit:

```text
LOCAL DRAFT != PRODUCTION ENCOUNTER
```

A local draft may survive refresh or crash, but it never registers with normal
gameplay. **RESET TO PRODUCTION** uses a two-tap confirmation and replaces only
the local draft with the immutable session baseline.

## Enemy Bank and visual-only previews

Enemy Bank reads `EnemyPresetRegistry`; there is no authoring-only enemy list.
It filters by display name or preset ID and reports:

- display name and preset ID;
- Creature Definition;
- resolved loadout and weapon;
- default gold summary;
- a disabled resolution failure when a preset cannot resolve.

The real preview path is:

```text
EnemyPresetResolver
  -> resolved Creature Pack/profile at preset target height
  -> HumanoidGlbVisualAdapter in visualOnly mode
  -> isolated body materials
  -> real weapon GLB instance
  -> RuntimeAttachmentSocketResolver
  -> real socket + preset grip + preset uniform weapon scale
```

The visual-only adapter skips damage-segment/physics construction. The preview
has no `HumanoidCombatActor`, `MinimalCombatBrain`, `EnemyLootRuntime`,
`PhysicalAttackSource`, combat-router registration, combat colliders, persistence,
or player blocker. Body and weapon materials are instance-owned before their
translucent authoring style is applied; shared production materials are not
mutated.

The configurable mobile preview budget defaults to four full bodies including
the active placement ghost. The placement ghost and selected individual receive
priority, then nearby individuals. Every spawn always retains a cheap ground
ring, facing arrow, and authoring-only pick volume when its body falls outside
the budget.

## Ground-aware placement

Placement first sends a center-camera ray against visible world geometry,
rejecting camera children and authoring objects. It then snaps the candidate to
the existing collision world's `sampleWalkableY()` support and validates it with
`canStandAtFloorPosition()`.

Scenes without a useful direct world hit use a bounded camera-forward sequence
and the same collision support validation. No navmesh is added. A non-finite,
blocked, unsupported, floating, or deeply mismatched candidate reports **NO
VALID PLACEMENT**, and PLACE/CONFIRM MOVE remains disabled.

## Place, select, and edit

Selecting a supported preset enters placement mode. Movement and look remain
live while the compact mode bar provides:

- ROTATE -15 degrees;
- ROTATE +15 degrees;
- PLACE;
- CANCEL.

PLACE writes only `spawnId`, `presetId`, supported world position/yaw, and the
default 8 m home radius. Placement mode remains active for rapid camp population.

Spawn IDs use:

```text
<encounterId>_enemy_<12 random lowercase hex characters>
```

Generation checks the current draft and all other installed encounter owners,
retries collisions, never uses an array index, and never reuses or renumbers
identity during ordinary edits. DUPLICATE always generates a fresh ID.

Existing individuals can be selected through either the spawn list or the
center-screen **SELECT AT RETICLE** action. The selected inspector exposes:

- MOVE with CONFIRM MOVE / CANCEL MOVE and an unchanged original until confirm;
- touch-step yaw rotation;
- DUPLICATE at a nearby non-stacked offset followed by move mode;
- CHANGE PRESET while preserving authored identity and individual tuning;
- two-tap DELETE without renumbering other records;
- positive finite home radius controls and a selected-only world ring;
- preset-default gold or one positive safe-integer fixed override.

## Autosave and canonical JSON

Meaningful mutations debounce into:

```text
dreadstone.encounter_authoring.draft.v1.<locationId>.<encounterId>
```

The storage envelope versions local editor metadata separately. Its embedded
`encounter` is still the exact canonical contract. Malformed or scope-mismatched
storage fails closed. Production baselines remain separately cloned in memory.

**VIEW JSON**, **COPY JSON**, and **EXPORT JSON** all use M9's
`serializeEncounterDefinition()`. The readout stays selectable on iPhone when
Clipboard permission fails. Exported JSON is directly accepted by
`parseEncounterDefinition()`, `EncounterRegistry`, and `EncounterSpawner`.

## Testing the exact draft

**TEST ENCOUNTER** canonicalizes the current draft, suspends preview resources,
and calls `EncounterRuntimeHost.spawnDefinition(draft)`. The result uses the real
M9 spawner, Creature Factory, actors, combat routing, weapons, brain, player HP,
death, and loot. There is no editor combat path.

The compact test bar provides:

- **RESET TEST**, which delegates to `EncounterRuntime.reset()`;
- **RETURN TO AUTHORING**, which despawns the test runtime, resets the dev player
  combat state if necessary, and reconstructs previews from the unchanged local
  draft.

Testing never regenerates spawn IDs and never writes runtime life/loot state into
the draft.

## Saving to the project

**SAVE TO PROJECT** posts only the canonical Encounter Definition JSON to the
same-origin development endpoint:

```text
POST /__dreadstone/encounter-authoring
```

The bridge:

- exists only in Vite's development-server plugin path;
- accepts POST only with a 128 KiB limit;
- accepts no destination or filename from the client;
- validates the exact contract, registered location, and full production resolution of every referenced preset;
- derives `<encounterId>.json` after stable-ID validation;
- rejects traversal, absolute paths, arbitrary extensions, and global spawn-ID
  collisions;
- calls the shared transactional installer;
- writes only inside `src/game/encounters/data/`;
- validates the complete resulting catalog and rolls back on failure;
- returns only canonical identity, spawn count, and repository-relative path.

Production discovery uses an eager, deterministic Vite JSON import glob in
`EncounterRegistry.js`. One canonical file per encounter is automatically part
of the next normal development/production session; no JavaScript registration
edit is needed. Saving updates the current authoring session's production
baseline but intentionally does not hot-mutate the already-constructed normal
registry.

There is no generic filesystem endpoint, browser-selected repository path,
browser commit, or browser push. Vite preview and production hosting do not
register the middleware.

## Fallback import

If the bridge is unavailable:

```text
EXPORT JSON
  -> drag file onto IMPORT_ENCOUNTER.cmd
  -> node scripts/install-encounter.mjs <file>
  -> the same shared installer and validations
```

The command helper is recovery/fallback only. It does not maintain a second
install implementation.

## Deliberate limits

M9.5 does not add bandits or canonical Folsom/North Road population, navmesh,
patrols, factions, group combat, M11 persistence, shops, items, loot-table
editing, or runtime death/HP/loot state. The existing Ram God preset is enough
to prove the authoring tool. Animation Forge and Skin and Bones are unchanged.
