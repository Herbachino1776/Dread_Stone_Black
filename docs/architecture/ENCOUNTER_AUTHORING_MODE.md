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
iPhone on the same network, and use the small **DEV** control in the existing
top game toolbar. This is the one persistent development-tool entry point. Its
temporary menu contains **CREATURE LAB**, **ENCOUNTER AUTHORING**, and **COMBAT
DEBUG**, then closes as soon as a tool is selected. `?encounterAuthoring=1`
remains a direct fallback.

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

Encounter Authoring attaches its controls to the real viewport rather than the
page edge. Its DOM layer is pointer-transparent except for visible controls and
drawers. Touches on those controls stop at the UI; all exposed world and control
deck space retains the existing movement/look/tool ownership. Explicit PLACE
and SELECT AT RETICLE actions avoid taking all world touches.

## Mobile interaction model

The world is the primary authoring surface. Encounter Authoring is divided into
four kinds of presentation:

```text
DEV MENU
  -> choose one development tool

ENCOUNTER AUTHORING
  -> compact top-edge status chip + current actions

TEMPORARY DRAWERS
  -> Enemy Bank, spawn list, properties, encounter management, JSON

CONTEXT CONTROLS
  -> only the current spatial operation: place, move, radius, or test
```

Normal authoring uses a compact top-edge rail. The rail shows the current
location, encounter, spawn count, and local/project state, plus access to Add,
Select, Spawns, Test, Save, and More. The center view and the complete bottom
control deck remain clear. On narrow portrait layouts the rail may wrap at the
top; it never moves into either joystick region.

Selecting an authored enemy replaces the general rail with its frequent spatial
actions: Aim/Select, Move, Turn, Duplicate, Properties, protected Delete, and
Done. Opening a drawer never creates a full-screen transparent input catcher.
Entering placement, move, radius adjustment, or test automatically closes every
drawer and replaces the prior rail instead of stacking another toolbar on it.

If normal travel changes location while authoring is open, the current draft is
flushed to local storage, placement/move/test ownership is canceled, old preview
resources are released, and the shell rebinds to the new real SceneSession. A
Folsom draft is never shown as a North Road draft.

Closing authoring releases markers, previews, radius visualization, and any test
runtime, then re-enables registered production encounter activation.

## Creating and opening encounters

The temporary **ENCOUNTERS** drawer owns open, recover, and create work.
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

Enemy Bank is a compact temporary drawer backed by `EnemyPresetRegistry`; there
is no authoring-only enemy list. It filters by display name or preset ID, keeps
up to three session-recent choices at the top, and reports:

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

Choosing a supported preset closes Enemy Bank immediately. The configurable
mobile preview budget defaults to four full bodies including
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

Selecting a supported preset enters placement mode. The normal authoring rail
and every drawer disappear. Movement and look remain live while a compact
top-edge context rail provides:

- ROTATE -15 degrees;
- ROTATE +15 degrees;
- PLACE;
- CANCEL.

PLACE writes only `spawnId`, `presetId`, supported world position/yaw, and the
default 8 m home radius. Placement mode remains active with the same real ghost
for rapid camp population; the user can walk elsewhere and place another without
returning to Enemy Bank. Cancel returns directly to the compact authoring HUD.

Spawn IDs use:

```text
<encounterId>_enemy_<12 random lowercase hex characters>
```

Generation checks the current draft and all other installed encounter owners,
retries collisions, never uses an array index, and never reuses or renumbers
identity during ordinary edits. DUPLICATE always generates a fresh ID.

Existing individuals can be selected through either the temporary spawn-list
drawer or the center-screen **SELECT AT RETICLE** action. The selected ground
ring, facing arrow, preview treatment, and concise selected chip make the world
selection obvious. The contextual selected rail exposes the frequent operations:

- MOVE with CONFIRM / CANCEL and an unchanged original until confirm;
- immediate 15-degree yaw steps;
- DUPLICATE at a nearby non-stacked offset followed by move mode;
- two-tap DELETE without renumbering other records.

Less frequent identity and tuning fields live in the temporary **PROPERTIES**
drawer: change preset, exact transform readout, spawn ID, home radius, and gold
override. **ADJUST RADIUS IN WORLD** closes that drawer and replaces the selected
rail with small radius step controls, so the selected-only world ring remains
judgable while it changes. Change Preset opens Enemy Bank and preserves authored
identity and individual tuning.

## Autosave and canonical JSON

Meaningful mutations debounce into:

```text
dreadstone.encounter_authoring.draft.v1.<locationId>.<encounterId>
```

The storage envelope versions local editor metadata separately. Its embedded
`encounter` is still the exact canonical contract. Malformed or scope-mismatched
storage fails closed. Production baselines remain separately cloned in memory.

The dirty state is a small indicator on the always-reachable Save action and a
short `LOCAL DRAFT` versus `MATCHES PROJECT` status label; autosave therefore
does not need a persistent warning panel. A successful project save produces a
brief confirmation. **VIEW JSON**, **COPY JSON**, and **EXPORT JSON** live in
the temporary More drawer and all use M9's
`serializeEncounterDefinition()`. The readout stays selectable on iPhone when
Clipboard permission fails. Exported JSON is directly accepted by
`parseEncounterDefinition()`, `EncounterRegistry`, and `EncounterSpawner`.

## Testing the exact draft

**TEST ENCOUNTER** canonicalizes the current draft, suspends preview resources,
and calls `EncounterRuntimeHost.spawnDefinition(draft)`. The result uses the real
M9 spawner, Creature Factory, actors, combat routing, weapons, brain, player HP,
death, and loot. There is no editor combat path.

Testing hides all normal authoring status, selection, drawer, save, and encounter
controls. A two-button top-edge test rail provides:

- **RESET TEST**, which delegates to `EncounterRuntime.reset()`;
- **AUTHOR**, which despawns the test runtime, resets the dev player
  combat state if necessary, and reconstructs previews from the unchanged local
  draft.

Testing never regenerates spawn IDs and never writes runtime life/loot state into
the draft.

The movement joystick, look joystick, Attack, Interact, and equipment control
remain the ordinary gameplay controls during the test. The test rail is inside
the viewport's upper edge, not the bottom control deck.

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

## Creature Lab entry

Creature Lab retains its direct `?creatureLab=1` route and existing runtime.
Choosing it from DEV transitions to its Folsom lab route and opens the Lab panel
immediately. **EXIT LAB** returns to the ordinary route. There is no independent
fixed LAB button near the look joystick.

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
