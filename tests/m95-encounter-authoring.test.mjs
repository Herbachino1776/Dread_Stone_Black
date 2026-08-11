import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import * as THREE from 'three';

import { parseEncounterDefinition, serializeEncounterDefinition } from '../src/contracts/EncounterDefinition.js';
import { EncounterRegistry } from '../src/game/encounters/EncounterRegistry.js';
import { EncounterRuntimeHost } from '../src/game/encounters/EncounterRuntimeHost.js';
import { EncounterAuthoringController, ENCOUNTER_AUTHORING_MODES } from '../src/game/encounters/authoring/EncounterAuthoringController.js';
import {
  ENCOUNTER_AUTHORING_DRAFT_NAMESPACE,
  EncounterAuthoringDraftStore,
} from '../src/game/encounters/authoring/EncounterAuthoringDraftStore.js';
import {
  changeSpawnPreset,
  createEncounterDraft,
  deleteSpawn,
  duplicateSpawn,
  generateSpawnId,
  moveSpawn,
  normalizeEncounterYaw,
  placeSpawn,
  removeSpawnGoldOverride,
  rotateSpawn,
  setSpawnGoldOverride,
  setSpawnHomeRadius,
  suggestEncounterId,
} from '../src/game/encounters/authoring/EncounterAuthoringOperations.js';
import { EncounterAuthoringPlacementResolver } from '../src/game/encounters/authoring/EncounterAuthoringPlacementResolver.js';
import { EncounterAuthoringPresetPreview } from '../src/game/encounters/authoring/EncounterAuthoringPresetPreview.js';
import { EncounterAuthoringPreviewRuntime } from '../src/game/encounters/authoring/EncounterAuthoringPreviewRuntime.js';
import {
  ENCOUNTER_AUTHORING_DRAWERS,
  ENCOUNTER_AUTHORING_PRESENTATIONS,
  resolveEncounterAuthoringPresentation,
} from '../src/game/encounters/authoring/EncounterAuthoringPanel.js';
import { createDevToolUrl, DEV_TOOL_IDS, DEV_TOOL_MENU_ITEMS } from '../src/game/devtools/DevToolsLauncher.js';
import { createEncounterAuthoringMiddleware, ENCOUNTER_AUTHORING_BRIDGE_PATH } from '../scripts/encounter-authoring-bridge.mjs';
import {
  installEncounterDefinition,
  readInstalledEncounterDefinitions,
  validateInstalledEncounterCatalog,
} from '../scripts/encounter-installer-lib.mjs';

const RAM_PRESET_ID = 'dread_ram_god_great_mace';

test('unified DEV launcher exposes the three tools and produces exclusive tool routes', () => {
  assert.deepEqual(DEV_TOOL_MENU_ITEMS.map((item) => item.id), [
    DEV_TOOL_IDS.creatureLab,
    DEV_TOOL_IDS.encounterAuthoring,
    DEV_TOOL_IDS.combatDebug,
  ]);
  const source = 'https://example.test/play?area=north-road&combatLab=1#game';
  const creatureLabUrl = new URL(createDevToolUrl(DEV_TOOL_IDS.creatureLab, source), source);
  assert.equal(creatureLabUrl.searchParams.get('area'), 'folsom');
  assert.equal(creatureLabUrl.searchParams.get('creatureLab'), '1');
  assert.equal(creatureLabUrl.searchParams.has('combatLab'), false);
  const authoringUrl = new URL(createDevToolUrl(DEV_TOOL_IDS.encounterAuthoring, source), source);
  assert.equal(authoringUrl.searchParams.get('area'), 'north-road');
  assert.equal(authoringUrl.searchParams.get('encounterAuthoring'), '1');
  assert.equal(authoringUrl.searchParams.has('combatLab'), false);
});

test('authoring presentation replaces general chrome with contextual spatial and test controls', () => {
  const draft = authoredEncounter();
  const normal = { open: true, mode: ENCOUNTER_AUTHORING_MODES.idle, draft, selectedSpawnId: null };
  assert.deepEqual(resolveEncounterAuthoringPresentation(normal, { drawer: ENCOUNTER_AUTHORING_DRAWERS.bank }), {
    presentation: ENCOUNTER_AUTHORING_PRESENTATIONS.normal,
    drawer: ENCOUNTER_AUTHORING_DRAWERS.bank,
  });
  assert.deepEqual(resolveEncounterAuthoringPresentation({ ...normal, mode: ENCOUNTER_AUTHORING_MODES.placing }, { drawer: ENCOUNTER_AUTHORING_DRAWERS.bank }), {
    presentation: ENCOUNTER_AUTHORING_PRESENTATIONS.spatial,
    drawer: null,
  });
  assert.deepEqual(resolveEncounterAuthoringPresentation({ ...normal, selectedSpawnId: draft.spawns[0].spawnId }, { radiusEditing: true }), {
    presentation: ENCOUNTER_AUTHORING_PRESENTATIONS.radius,
    drawer: null,
  });
  assert.deepEqual(resolveEncounterAuthoringPresentation({ ...normal, mode: ENCOUNTER_AUTHORING_MODES.testing }, { drawer: ENCOUNTER_AUTHORING_DRAWERS.more }), {
    presentation: ENCOUNTER_AUTHORING_PRESENTATIONS.testing,
    drawer: null,
  });
});

function authoredEncounter(overrides = {}) {
  return {
    schema: 'dreadstone.encounter_definition.v1',
    version: 1,
    encounterId: 'm95_test_encounter',
    displayName: 'M9.5 Test Encounter',
    locationId: 'folsom',
    spawns: [{
      spawnId: 'm95_test_encounter_enemy_a1b2c3',
      presetId: RAM_PRESET_ID,
      transform: { position: [1, 0.16, -3], yaw: 0.25 },
      homeRadius: 8,
    }],
    ...overrides,
  };
}

class MemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(key); }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

function fakeResolvedPreset(presetId = RAM_PRESET_ID) {
  return {
    preset: { presetId, displayName: 'Dread Ram God — Great Mace' },
    definition: { definitionId: 'dread_ram_god' },
    profile: { targetHeight: 2.1 },
    pack: { packId: 'dread_ram_god_damage_v001' },
    loadout: { loadoutId: 'humanoid_dreadstone_mace_main_hand' },
    weapon: {
      weaponId: 'dreadstone_mace',
      displayName: 'Dreadstone Mace',
      assetScale: 1.41,
      gripTransform: { position: [0.005, 0.085, -0.015], quaternion: [0, 0, 0, 1] },
    },
    attachmentSocket: { socketId: 'main_hand_r', parentRuntimeBone: 'hand_r', semanticRole: 'MAIN_HAND_R', localPosition: [0, 0, 0], localQuaternion: [0, 0, 0, 1] },
    lootProfile: { currency: { gold: { mode: 'FIXED', amount: 12 } } },
  };
}

function fakePresetRegistry() {
  const preset = { presetId: RAM_PRESET_ID, displayName: 'Dread Ram God — Great Mace', creatureDefinitionId: 'dread_ram_god', armament: { loadoutId: 'humanoid_dreadstone_mace_main_hand' }, rewards: { lootProfileId: 'dread_ram_god_standard' } };
  return { listPresets: () => [preset], hasPreset: (id) => id === RAM_PRESET_ID };
}

function fixedSuffixes(...suffixes) {
  let index = 0;
  return () => suffixes[index++] ?? 'ffeeddccbbaa';
}

test('NEW ENCOUNTER uses the exact current location and canonical serializer', () => {
  const draft = createEncounterDraft({ displayName: 'North Road Bandit Camp', encounterId: 'north_road_bandit_camp', locationId: 'north-road' });
  assert.equal(draft.locationId, 'north-road');
  assert.deepEqual(draft.spawns, []);
  assert.deepEqual(parseEncounterDefinition(serializeEncounterDefinition(draft)), draft);
});

test('encounter ID suggestion is visible stable-ID-compatible text', () => {
  assert.equal(suggestEncounterId('  North Road — Bandit Camp! '), 'north_road_bandit_camp');
});

test('PLACE creates a canonical spawn with stable non-index identity', () => {
  const draft = createEncounterDraft({ displayName: 'Proof', encounterId: 'proof', locationId: 'folsom' });
  const result = placeSpawn(draft, { presetId: RAM_PRESET_ID, position: [2, 0.16, 4], yaw: -0.2, spawnIdOptions: { suffixFactory: () => 'a7f31c' } });
  assert.equal(result.spawn.spawnId, 'proof_enemy_a7f31c');
  assert.equal(result.spawn.presetId, RAM_PRESET_ID);
  assert.deepEqual(result.spawn.transform.position, [2, 0.16, 4]);
  assert.ok(result.spawn.transform.yaw > 6);
  assert.equal(result.spawn.homeRadius, 8);
});

test('spawn ID generation rejects collisions and never uses array identity', () => {
  const id = generateSpawnId('proof', { existingSpawnIds: ['proof_enemy_a1b2c3'], suffixFactory: fixedSuffixes('a1b2c3', 'ffeedd') });
  assert.equal(id, 'proof_enemy_ffeedd');
  assert.doesNotMatch(id, /enemy_0$/);
});

test('MOVE changes only transform and preserves authored identity and preset', () => {
  const before = authoredEncounter();
  const moved = moveSpawn(before, before.spawns[0].spawnId, { position: [7, 0.3, 9], yaw: 2 });
  assert.equal(moved.spawns[0].spawnId, before.spawns[0].spawnId);
  assert.equal(moved.spawns[0].presetId, before.spawns[0].presetId);
  assert.deepEqual(moved.spawns[0].transform, { position: [7, 0.3, 9], yaw: 2 });
  assert.deepEqual(before.spawns[0].transform, { position: [1, 0.16, -3], yaw: 0.25 });
});

test('ROTATE normalizes yaw and preserves position and identity', () => {
  const before = authoredEncounter();
  const rotated = rotateSpawn(before, before.spawns[0].spawnId, Math.PI * 3);
  assert.ok(Math.abs(rotated.spawns[0].transform.yaw - Math.PI) < 1e-8);
  assert.deepEqual(rotated.spawns[0].transform.position, before.spawns[0].transform.position);
  assert.equal(normalizeEncounterYaw(-Math.PI / 2), Math.PI * 1.5);
});

test('DUPLICATE copies preset, home radius, and reward but receives a fresh offset identity', () => {
  const before = authoredEncounter({ spawns: [{ ...authoredEncounter().spawns[0], rewardOverride: { gold: 27 } }] });
  const result = duplicateSpawn(before, before.spawns[0].spawnId, { spawnIdOptions: { suffixFactory: () => 'c0ffee' } });
  assert.equal(result.spawn.spawnId, 'm95_test_encounter_enemy_c0ffee');
  assert.equal(result.spawn.presetId, before.spawns[0].presetId);
  assert.equal(result.spawn.homeRadius, 8);
  assert.deepEqual(result.spawn.rewardOverride, { gold: 27 });
  assert.notDeepEqual(result.spawn.transform.position, before.spawns[0].transform.position);
  assert.equal(before.spawns.length, 1);
});

test('CHANGE PRESET preserves spawn identity, transform, home radius, and reward', () => {
  const before = authoredEncounter({ spawns: [{ ...authoredEncounter().spawns[0], rewardOverride: { gold: 27 } }] });
  const changed = changeSpawnPreset(before, before.spawns[0].spawnId, 'replacement_preset');
  assert.equal(changed.spawns[0].spawnId, before.spawns[0].spawnId);
  assert.deepEqual(changed.spawns[0].transform, before.spawns[0].transform);
  assert.equal(changed.spawns[0].homeRadius, before.spawns[0].homeRadius);
  assert.deepEqual(changed.spawns[0].rewardOverride, { gold: 27 });
});

test('DELETE removes only the target and never renumbers other spawn identities', () => {
  const first = authoredEncounter().spawns[0];
  const second = { ...structuredClone(first), spawnId: 'm95_test_encounter_enemy_d4e5f6' };
  const deleted = deleteSpawn(authoredEncounter({ spawns: [first, second] }), first.spawnId);
  assert.deepEqual(deleted.spawns.map((spawn) => spawn.spawnId), [second.spawnId]);
});

test('HOME RADIUS accepts positive finite values and rejects invalid values', () => {
  const before = authoredEncounter();
  assert.equal(setSpawnHomeRadius(before, before.spawns[0].spawnId, 12.5).spawns[0].homeRadius, 12.5);
  for (const value of [0, -1, Infinity, NaN]) assert.throws(() => setSpawnHomeRadius(before, before.spawns[0].spawnId, value), /positive/);
});

test('GOLD fixed override writes the exact M9 field and removal deletes it cleanly', () => {
  const before = authoredEncounter();
  const fixed = setSpawnGoldOverride(before, before.spawns[0].spawnId, 27);
  assert.deepEqual(fixed.spawns[0].rewardOverride, { gold: 27 });
  assert.equal(Object.hasOwn(removeSpawnGoldOverride(fixed, before.spawns[0].spawnId).spawns[0], 'rewardOverride'), false);
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => setSpawnGoldOverride(before, before.spawns[0].spawnId, value), /positive safe integer/);
});

test('draft storage scopes records by locationId and encounterId and round trips canonical data', () => {
  const storage = new MemoryStorage();
  const store = new EncounterAuthoringDraftStore({ storage, now: () => 1234 });
  const draft = authoredEncounter();
  store.save(draft, { selectedSpawnId: draft.spawns[0].spawnId, tab: 'selected' });
  assert.ok(storage.getItem(`${ENCOUNTER_AUTHORING_DRAFT_NAMESPACE}.folsom.m95_test_encounter`));
  assert.deepEqual(store.load('folsom', 'm95_test_encounter').encounter, draft);
  assert.equal(store.load('north-road', 'm95_test_encounter'), null);
});

test('draft storage returns malformed local data safely without registering production content', () => {
  const storage = new MemoryStorage();
  const key = `${ENCOUNTER_AUTHORING_DRAFT_NAMESPACE}.folsom.broken`;
  storage.setItem(key, '{bad json');
  const store = new EncounterAuthoringDraftStore({ storage });
  assert.equal(store.load('folsom', 'broken'), null);
  assert.match(store.lastError, /JSON/);
  assert.deepEqual(new EncounterRegistry().listEncounters(), []);
});

test('draft storage list and last draft remain location-isolated', () => {
  const storage = new MemoryStorage();
  const store = new EncounterAuthoringDraftStore({ storage, now: (() => { let value = 1; return () => value++; })() });
  store.save(authoredEncounter());
  store.save(authoredEncounter({ encounterId: 'north_test', locationId: 'north-road', displayName: 'North Test', spawns: [] }));
  assert.deepEqual(store.list('folsom').map((entry) => entry.encounterId), ['m95_test_encounter']);
  assert.equal(store.loadLast('north-road').encounterId, 'north_test');
});

test('production baseline can remain immutable while local draft changes and resets', () => {
  const baseline = authoredEncounter();
  const storage = new MemoryStorage();
  const store = new EncounterAuthoringDraftStore({ storage });
  const local = setSpawnHomeRadius(baseline, baseline.spawns[0].spawnId, 18);
  store.save(local);
  assert.equal(baseline.spawns[0].homeRadius, 8);
  store.remove('folsom', baseline.encounterId);
  assert.equal(store.load('folsom', baseline.encounterId), null);
  assert.equal(baseline.spawns[0].homeRadius, 8);
});

test('placement resolver snaps camera-directed fallback to valid collision ground', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  camera.lookAt(0, 1.6, -1);
  camera.updateMatrixWorld(true);
  const collision = { sampleWalkableY: (x, z) => ({ y: x + z * 0 + 0.25, kind: 'terrain' }), canStandAtFloorPosition: () => true };
  const resolver = new EncounterAuthoringPlacementResolver({ raycaster: { setFromCamera() {}, intersectObjects: () => [] } });
  const result = resolver.resolve({ camera, scene: new THREE.Scene(), collision });
  assert.equal(result.valid, true);
  assert.equal(result.position[1], result.position[0] + 0.25);
});

test('placement resolver exposes NO VALID PLACEMENT when ground support is blocked', () => {
  const camera = new THREE.PerspectiveCamera(); camera.lookAt(0, 0, -1); camera.updateMatrixWorld(true);
  const collision = { sampleWalkableY: () => ({ y: 0, kind: 'terrain' }), canStandAtFloorPosition: () => false };
  const resolver = new EncounterAuthoringPlacementResolver({ raycaster: { setFromCamera() {}, intersectObjects: () => [] } });
  assert.equal(resolver.resolve({ camera, scene: new THREE.Scene(), collision }).valid, false);
});

test('visual-only preset preview resolves real profile and weapon calibration without combat composition', async () => {
  const sourceBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, opacity: 1 });
  const sourceWeaponMaterial = new THREE.MeshStandardMaterial({ color: 0x777777, opacity: 1 });
  let bodyOptions = null;
  let bodyDisposed = false;
  let weaponReleased = false;
  const bone = new THREE.Bone(); bone.name = 'hand_r';
  const bodyFactory = async (options) => {
    bodyOptions = options;
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), sourceBodyMaterial.clone()), bone);
    options.scene.add(root);
    return {
      root,
      disposed: false,
      ready: Promise.resolve(),
      visualAdapter: { getRuntimeBone: () => bone },
      setTransform(position, yaw) { this.position = [...position]; this.yaw = yaw; },
      update() {},
      dispose() { bodyDisposed = true; root.removeFromParent(); },
    };
  };
  let resolveCalls = 0;
  const resolved = fakeResolvedPreset();
  const enemyPresetResolver = {
    weaponRegistry: {
      createVisual: async () => new THREE.Mesh(new THREE.BoxGeometry(), sourceWeaponMaterial.clone()),
      disposeVisual: () => { weaponReleased = true; return true; },
    },
    async resolve(id) { resolveCalls += 1; assert.equal(id, RAM_PRESET_ID); return resolved; },
  };
  const preview = await EncounterAuthoringPresetPreview.create({ presetId: RAM_PRESET_ID, scene: new THREE.Scene(), position: [1, 2, 3], yaw: 0.4, enemyPresetResolver, bodyFactory });
  const diagnostics = preview.getDiagnostics();
  assert.equal(resolveCalls, 1);
  assert.equal(bodyOptions.profile.targetHeight, 2.1);
  assert.equal(diagnostics.weaponScale, 1.41);
  assert.deepEqual(diagnostics.gripTransform.position, [0.005, 0.085, -0.015]);
  assert.equal(diagnostics.hasCombatBrain, false);
  assert.equal(diagnostics.hasLootRuntime, false);
  assert.equal(diagnostics.combatRouterRegistered, false);
  assert.equal(diagnostics.hasCombatColliders, false);
  assert.equal(diagnostics.blocksPlayer, false);
  assert.equal(diagnostics.canDamagePlayer, false);
  assert.equal(sourceBodyMaterial.opacity, 1);
  assert.equal(sourceWeaponMaterial.opacity, 1);
  preview.dispose();
  assert.equal(bodyDisposed, true);
  assert.equal(weaponReleased, true);
});

test('preview runtime keeps all markers while enforcing the mobile full-body budget', async () => {
  const created = [];
  const previewFactory = async ({ presetId, position, selected }) => {
    const preview = { presetId, root: new THREE.Group(), selected, disposed: false, setSelected(value) { this.selected = value; }, setTransform(next) { this.position = [...next]; }, update() {}, dispose() { this.disposed = true; } };
    preview.root.visible = true; created.push(preview); return preview;
  };
  const runtime = new EncounterAuthoringPreviewRuntime({ enemyPresetResolver: {}, previewFactory, maxPreviewBodies: 3 });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1, 0);
  runtime.attachSession({ scene, camera, playerProvider: () => ({ position: new THREE.Vector3() }) });
  const spawns = Array.from({ length: 6 }, (_, index) => ({ spawnId: `budget_enemy_${index}aa`, presetId: RAM_PRESET_ID, transform: { position: [index + 1, 0, -2], yaw: 0 }, homeRadius: 8 }));
  runtime.setDraft(authoredEncounter({ spawns }), { selectedSpawnId: spawns[5].spawnId });
  await new Promise((resolve) => setImmediate(resolve));
  runtime.setPlacement({ presetId: RAM_PRESET_ID, position: [0, 0, -4], yaw: 0, valid: true });
  await new Promise((resolve) => setImmediate(resolve));
  const diagnostics = runtime.getDiagnostics();
  assert.equal(diagnostics.markerCount, 6);
  assert.ok(diagnostics.totalFullPreviewCount <= 3);
  assert.equal(diagnostics.combatColliderCount, 0);
  assert.equal(diagnostics.playerBlockerCount, 0);
  runtime.dispose();
});

test('preview budget discards stale asynchronous bodies when a placement ghost reserves capacity', async () => {
  const pending = [];
  const previewFactory = (options) => new Promise((resolve) => pending.push({ options, resolve }));
  const runtime = new EncounterAuthoringPreviewRuntime({ enemyPresetResolver: {}, previewFactory, maxPreviewBodies: 3 });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  runtime.attachSession({ scene, camera, playerProvider: () => ({ position: new THREE.Vector3() }) });
  const spawns = Array.from({ length: 4 }, (_, index) => ({ spawnId: `race_enemy_${index}aa`, presetId: RAM_PRESET_ID, transform: { position: [index, 0, -2], yaw: 0 }, homeRadius: 8 }));
  runtime.setDraft(authoredEncounter({ spawns }));
  runtime.setPlacement({ presetId: RAM_PRESET_ID, position: [0, 0, -4], valid: true });
  const created = pending.map(({ options, resolve }) => {
    const preview = { presetId: options.presetId, root: new THREE.Group(), disposed: false, setSelected() {}, setTransform() {}, update() {}, dispose() { this.disposed = true; } };
    resolve(preview);
    return preview;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(runtime.getDiagnostics().totalFullPreviewCount <= 3);
  assert.equal(created.filter((preview) => preview.disposed).length, 1);
  runtime.dispose();
});

class FakePreviewRuntime {
  constructor() { this.disposed = false; this.markers = []; this.placements = []; this.selection = null; this.clearCount = 0; }
  attachSession(session) { this.session = session; }
  setDraft(draft, options) { this.draft = structuredClone(draft); this.selection = options?.selectedSpawnId ?? null; }
  setSelection(id) { this.selection = id; }
  setPlacement(value) { this.placements.push(structuredClone(value)); }
  clearPlacement() { this.placements.push(null); }
  clearWorldVisuals() { this.clearCount += 1; }
  pickCenter() { return this.pickSpawnId ?? null; }
  update() {}
  dispose() { this.disposed = true; }
}

class FakeRuntimeHost {
  constructor(registry = new EncounterRegistry()) { this.registry = registry; this.runtimes = new Map(); this.suppressed = false; this.suppressionCalls = []; }
  async setRegisteredActivationSuppressed(value) { this.suppressed = value; this.suppressionCalls.push(value); return { suppressed: value }; }
  despawnAll() { const count = this.runtimes.size; this.runtimes.clear(); return count; }
  async spawnDefinition(definition) { const runtime = { encounterId: definition.encounterId, definition: structuredClone(definition), enemies: definition.spawns.map((spawn) => ({ spawnId: spawn.spawnId })) }; this.runtimes.set(definition.encounterId, runtime); return runtime; }
  despawnEncounter(id) { return this.runtimes.delete(id); }
  async resetEncounter(id) { return this.runtimes.has(id) ? { accepted: true, encounterId: id } : { accepted: false, reason: 'unavailable' }; }
}

function controllerHarness({ registry = new EncounterRegistry(), storage = new MemoryStorage(), locationId = 'folsom', fetchImplementation = async () => ({ ok: true, json: async () => ({ ok: true, encounterId: 'proof', locationId, spawnCount: 1, relativePath: 'src/game/encounters/data/proof.json' }) }) } = {}) {
  const preview = new FakePreviewRuntime();
  const sceneSessionHost = { locationId, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), player: { yaw: 0, position: new THREE.Vector3() }, dungeon: { collision: {} } };
  const host = new FakeRuntimeHost(registry);
  const resolver = { weaponRegistry: {}, resolve: async () => fakeResolvedPreset() };
  const controller = new EncounterAuthoringController({
    sceneSessionHost,
    encounterRuntimeHost: host,
    registry,
    presetRegistry: fakePresetRegistry(),
    enemyPresetResolver: resolver,
    draftStore: new EncounterAuthoringDraftStore({ storage, now: () => 100 }),
    placementResolver: { resolve: () => ({ valid: true, position: [2, 0.16, -4], source: 'test-ground' }) },
    previewRuntimeFactory: () => preview,
    fetchImplementation,
    setTimeoutImplementation: null,
    clearTimeoutImplementation: null,
    now: () => 1000,
  });
  return { controller, host, preview, sceneSessionHost, storage };
}

test('authoring controller opens/closes and suppresses/restores production runtimes', async () => {
  const { controller, host } = controllerHarness();
  await controller.open();
  assert.equal(controller.getState().open, true);
  assert.equal(host.suppressed, true);
  await controller.close();
  assert.equal(controller.getState().open, false);
  assert.equal(host.suppressed, false);
});

test('Enemy Bank selection enters placement and PLACE writes through the operation layer', async () => {
  const { controller } = controllerHarness();
  await controller.open();
  controller.createNewEncounter({ displayName: 'Proof', encounterId: 'proof' });
  controller.selectPreset(RAM_PRESET_ID);
  controller.update(0.016);
  const placed = controller.commitPlacement();
  const state = controller.getState();
  assert.equal(state.mode, ENCOUNTER_AUTHORING_MODES.placing);
  assert.equal(state.draft.spawns.length, 1);
  assert.equal(placed.presetId, RAM_PRESET_ID);
  assert.deepEqual(placed.transform.position, [2, 0.16, -4]);
  assert.deepEqual(state.recentPresetIds, [RAM_PRESET_ID]);
  controller.cancelPlacement();
  assert.equal(controller.getState().minimized, false);
});

test('selection can be cleared without mutating the authored spawn', async () => {
  const { controller, preview } = controllerHarness({ registry: new EncounterRegistry({ encounters: [authoredEncounter()] }) });
  await controller.open(); controller.openEncounter('m95_test_encounter');
  const spawnId = authoredEncounter().spawns[0].spawnId;
  controller.selectSpawn(spawnId);
  controller.clearSelection();
  assert.equal(controller.getState().selectedSpawnId, null);
  assert.equal(controller.getState().draft.spawns[0].spawnId, spawnId);
  assert.equal(preview.selection, null);
});

test('MOVE cancel preserves the exact original transform and identity', async () => {
  const { controller } = controllerHarness({ registry: new EncounterRegistry({ encounters: [authoredEncounter()] }) });
  await controller.open(); controller.openEncounter('m95_test_encounter');
  const before = controller.getState().draft.spawns[0];
  controller.selectSpawn(before.spawnId); controller.beginMove(); controller.update(0.016); controller.cancelMove();
  assert.deepEqual(controller.getState().draft.spawns[0].transform, before.transform);
  assert.equal(controller.getState().draft.spawns[0].spawnId, before.spawnId);
});

test('DUPLICATE begins intentional MOVE with a fresh authored identity', async () => {
  const { controller } = controllerHarness({ registry: new EncounterRegistry({ encounters: [authoredEncounter()] }) });
  await controller.open(); controller.openEncounter('m95_test_encounter'); controller.selectSpawn(authoredEncounter().spawns[0].spawnId);
  const duplicate = controller.duplicateSelected();
  assert.notEqual(duplicate.spawnId, authoredEncounter().spawns[0].spawnId);
  assert.equal(controller.getState().mode, ENCOUNTER_AUTHORING_MODES.moving);
  assert.equal(controller.getState().selectedSpawnId, duplicate.spawnId);
});

test('DELETE uses a two-tap touch-safe confirmation and does not affect other spawns', async () => {
  const { controller } = controllerHarness({ registry: new EncounterRegistry({ encounters: [authoredEncounter()] }) });
  await controller.open(); controller.openEncounter('m95_test_encounter'); controller.selectSpawn(authoredEncounter().spawns[0].spawnId);
  controller.requestDeleteSelected();
  assert.equal(controller.getState().draft.spawns.length, 1);
  controller.requestDeleteSelected();
  assert.equal(controller.getState().draft.spawns.length, 0);
});

test('TEST ENCOUNTER uses EncounterRuntimeHost and RETURN restores the unchanged draft', async () => {
  const { controller, host, preview } = controllerHarness({ registry: new EncounterRegistry({ encounters: [authoredEncounter()] }) });
  await controller.open(); controller.openEncounter('m95_test_encounter');
  const jsonBefore = controller.getCanonicalJson();
  await controller.testEncounter();
  assert.equal(controller.getState().mode, ENCOUNTER_AUTHORING_MODES.testing);
  assert.equal(host.runtimes.get('m95_test_encounter').definition.spawns[0].spawnId, authoredEncounter().spawns[0].spawnId);
  assert.ok(preview.clearCount > 0);
  controller.returnToAuthoring();
  assert.equal(controller.getState().mode, ENCOUNTER_AUTHORING_MODES.idle);
  assert.equal(controller.getCanonicalJson(), jsonBefore);
  assert.equal(host.runtimes.size, 0);
});

test('RESET TEST delegates to EncounterRuntime reset semantics', async () => {
  const { controller } = controllerHarness({ registry: new EncounterRegistry({ encounters: [authoredEncounter()] }) });
  await controller.open(); controller.openEncounter('m95_test_encounter'); await controller.testEncounter();
  assert.equal((await controller.resetTest()).accepted, true);
});

test('scene transition autosaves and never carries a Folsom draft into North Road', async () => {
  const { controller, sceneSessionHost, storage } = controllerHarness();
  await controller.open(); controller.createNewEncounter({ displayName: 'Folsom Local', encounterId: 'folsom_local' });
  sceneSessionHost.locationId = 'north-road'; sceneSessionHost.scene = new THREE.Scene();
  await controller.handleSessionChanged(sceneSessionHost);
  assert.equal(controller.getState().locationId, 'north-road');
  assert.equal(controller.getState().draft, null);
  assert.ok(storage.getItem(`${ENCOUNTER_AUTHORING_DRAFT_NAMESPACE}.folsom.folsom_local`));
});

test('SAVE TO PROJECT sends exact canonical JSON and updates only the session baseline after success', async () => {
  let request = null;
  const fetchImplementation = async (url, options) => { request = { url: String(url), options }; return { ok: true, json: async () => ({ ok: true, encounterId: 'proof', locationId: 'folsom', spawnCount: 0, relativePath: 'src/game/encounters/data/proof.json' }) }; };
  const { controller } = controllerHarness({ fetchImplementation });
  await controller.open(); controller.createNewEncounter({ displayName: 'Proof', encounterId: 'proof' });
  await controller.saveToProject();
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(parseEncounterDefinition(request.options.body), controller.getState().draft);
  assert.equal(controller.getState().dirty, false);
  assert.equal(controller.getState().lastSavedPath, 'src/game/encounters/data/proof.json');
});

test('unreachable save bridge fails clearly and preserves exportable local draft', async () => {
  const { controller } = controllerHarness({ fetchImplementation: async () => { throw new Error('offline'); } });
  await controller.open(); controller.createNewEncounter({ displayName: 'Proof', encounterId: 'proof' });
  await assert.rejects(() => controller.saveToProject(), /offline/);
  assert.equal(controller.getState().bridgeAvailable, false);
  assert.match(controller.getCanonicalJson(), /"proof"/);
});

async function temporaryDirectory(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'dreadstone-m95-'));
  try { return await run(directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('installer accepts valid canonical content and emits deterministic canonical JSON', () => temporaryDirectory(async (directory) => {
  const result = await installEncounterDefinition(authoredEncounter(), { dataDirectory: directory });
  assert.equal(result.relativePath, 'src/game/encounters/data/m95_test_encounter.json');
  assert.equal(await readFile(result.destination, 'utf8'), serializeEncounterDefinition(authoredEncounter()));
  assert.deepEqual((await validateInstalledEncounterCatalog(directory)).encounterIds, ['m95_test_encounter']);
}));

test('installer rejects malformed contract, unknown location, and unknown preset', () => temporaryDirectory(async (directory) => {
  await assert.rejects(() => installEncounterDefinition('{bad', { dataDirectory: directory }), /INVALID_CONTRACT/);
  await assert.rejects(() => installEncounterDefinition(authoredEncounter({ locationId: 'not-a-location' }), { dataDirectory: directory }), /UNKNOWN_LOCATION/);
  const unknown = authoredEncounter({ spawns: [{ ...authoredEncounter().spawns[0], presetId: 'unknown_preset' }] });
  await assert.rejects(() => installEncounterDefinition(unknown, { dataDirectory: directory }), /UNKNOWN_PRESET/);
}));

test('installer rejects a registered preset whose production dependencies do not resolve', () => temporaryDirectory(async (directory) => {
  await assert.rejects(() => installEncounterDefinition(authoredEncounter(), {
    dataDirectory: directory,
    enemyPresetResolver: { resolve: async () => { throw new Error('missing authored socket'); } },
  }), /UNRESOLVABLE_PRESET.*missing authored socket/);
}));

test('installer enforces global spawn ID uniqueness across separate encounters', () => temporaryDirectory(async (directory) => {
  await installEncounterDefinition(authoredEncounter(), { dataDirectory: directory });
  const second = authoredEncounter({ encounterId: 'second_encounter', displayName: 'Second Encounter' });
  await assert.rejects(() => installEncounterDefinition(second, { dataDirectory: directory }), /DUPLICATE_GLOBAL_SPAWN/);
}));

test('installer safely replaces the same encounter while preserving unrelated files', () => temporaryDirectory(async (directory) => {
  await installEncounterDefinition(authoredEncounter(), { dataDirectory: directory });
  await writeFile(path.join(directory, 'notes.txt'), 'preserve me');
  const replacement = authoredEncounter({ displayName: 'Retuned Encounter', spawns: [] });
  await installEncounterDefinition(replacement, { dataDirectory: directory });
  assert.equal((await readInstalledEncounterDefinitions(directory))[0].displayName, 'Retuned Encounter');
  assert.equal(await readFile(path.join(directory, 'notes.txt'), 'utf8'), 'preserve me');
}));

test('installer cannot derive path traversal or an arbitrary destination from client data', () => temporaryDirectory(async (directory) => {
  await assert.rejects(() => installEncounterDefinition(authoredEncounter({ encounterId: '../escape' }), { dataDirectory: directory }), /INVALID_CONTRACT/);
  assert.equal((await readdir(path.dirname(directory))).some((name) => name === 'escape.json'), false);
}));

test('failed post-install validation rolls back replacement and leaves no partial transaction file', () => temporaryDirectory(async (directory) => {
  await installEncounterDefinition(authoredEncounter(), { dataDirectory: directory });
  const original = await readFile(path.join(directory, 'm95_test_encounter.json'), 'utf8');
  await assert.rejects(() => installEncounterDefinition(authoredEncounter({ displayName: 'Must Roll Back' }), {
    dataDirectory: directory,
    afterInstallValidation: () => { throw new Error('injected catalog failure'); },
  }), /rolled back/);
  assert.equal(await readFile(path.join(directory, 'm95_test_encounter.json'), 'utf8'), original);
  assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith('.tmp') || name.endsWith('.bak')), []);
}));

test('production discovery data reconstructs registry filtering for multiple locations', () => temporaryDirectory(async (directory) => {
  await installEncounterDefinition(authoredEncounter(), { dataDirectory: directory });
  await installEncounterDefinition(authoredEncounter({ encounterId: 'north_encounter', displayName: 'North Encounter', locationId: 'north-road', spawns: [{ ...authoredEncounter().spawns[0], spawnId: 'north_encounter_enemy_abcdef' }] }), { dataDirectory: directory });
  const registry = new EncounterRegistry({ encounters: await readInstalledEncounterDefinitions(directory) });
  assert.deepEqual(registry.listByLocation('folsom').map((entry) => entry.encounterId), ['m95_test_encounter']);
  assert.deepEqual(registry.listByLocation('north-road').map((entry) => entry.encounterId), ['north_encounter']);
}));

class MockResponse {
  constructor() { this.headers = {}; this.statusCode = 0; this.body = ''; }
  setHeader(name, value) { this.headers[name] = value; }
  end(body = '') { this.body = String(body); }
  json() { return JSON.parse(this.body); }
}

function mockRequest({ method = 'POST', url = ENCOUNTER_AUTHORING_BRIDGE_PATH, body = '', headers = {} } = {}) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.method = method; request.url = url; request.headers = headers;
  return request;
}

test('dev bridge accepts POST only and invokes the shared installer', async () => {
  let received = null;
  const middleware = createEncounterAuthoringMiddleware({ install: async (body) => { received = body; return { encounterId: 'proof', locationId: 'folsom', spawnCount: 0, relativePath: 'src/game/encounters/data/proof.json' }; } });
  const getResponse = new MockResponse(); await middleware(mockRequest({ method: 'GET' }), getResponse);
  assert.equal(getResponse.statusCode, 405);
  const postResponse = new MockResponse(); await middleware(mockRequest({ body: serializeEncounterDefinition(authoredEncounter({ encounterId: 'proof', spawns: [] })) }), postResponse);
  assert.equal(postResponse.statusCode, 200);
  assert.match(received, /"proof"/);
  assert.deepEqual(Object.keys(postResponse.json()).sort(), ['encounterId', 'locationId', 'ok', 'relativePath', 'spawnCount'].sort());
});

test('dev bridge rejects oversized and malformed requests', async () => {
  const middleware = createEncounterAuthoringMiddleware({ maximumBytes: 16, install: async () => assert.fail('installer must not run') });
  const oversized = new MockResponse(); await middleware(mockRequest({ body: 'x'.repeat(17) }), oversized);
  assert.equal(oversized.statusCode, 413);
  const malformedMiddleware = createEncounterAuthoringMiddleware({ install: async () => { throw Object.assign(new Error('bad json'), { code: 'INVALID_CONTRACT' }); } });
  const malformed = new MockResponse(); await malformedMiddleware(mockRequest({ body: '{bad' }), malformed);
  assert.equal(malformed.statusCode, 400);
  assert.equal(malformed.json().error, 'INVALID_CONTRACT');
});

test('bridge is absent outside development and exposes no generic filesystem route', async () => {
  assert.equal(createEncounterAuthoringMiddleware({ development: false }), null);
  let passed = false;
  const middleware = createEncounterAuthoringMiddleware({ install: async () => assert.fail('installer must not run') });
  await middleware(mockRequest({ url: '/write-any-file', body: '{}' }), new MockResponse(), () => { passed = true; });
  assert.equal(passed, true);
});

test('EncounterRuntimeHost authoring suppression prevents registered activation until restored', async () => {
  const definition = authoredEncounter({ spawns: [] });
  const registry = new EncounterRegistry({ encounters: [definition] });
  const spawned = [];
  const spawner = { enemyPresetResolver: {}, spawn: async (record) => { const runtime = { encounterId: record.encounterId, enemies: [], dispose() {}, update() {}, getContactableActors: () => [] }; spawned.push(runtime); return runtime; } };
  const host = new EncounterRuntimeHost({ registry, spawner, registeredActivationSuppressed: true });
  host.scene = {}; host.locationId = 'folsom'; host.dungeon = { collision: {} }; host.physics = {}; host.combatRouter = {};
  assert.deepEqual(await host.activateRegisteredLocationEncounters(), []);
  await host.setRegisteredActivationSuppressed(false);
  assert.equal(spawned.length, 1);
  host.dispose();
});
