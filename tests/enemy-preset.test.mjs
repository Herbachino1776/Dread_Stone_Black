import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import {
  ENEMY_PRESET_SCHEMA,
  ENEMY_PRESET_VERSION,
  validateEnemyPreset,
} from '../src/contracts/EnemyPreset.js';
import {
  HUMANOID_DREADSTONE_MACE_MAIN_HAND_LOADOUT,
  NpcLoadoutRegistry,
  NPC_LOADOUT_SCHEMA,
} from '../src/game/combat/NpcLoadout.js';
import {
  DREADSTONE_MACE_WEAPON,
  NpcWeaponRegistry,
} from '../src/game/combat/NpcWeaponRegistry.js';
import { RuntimeAttachmentSocketResolver } from '../src/game/combat/RuntimeAttachmentSocketResolver.js';
import {
  CREATURE_LAB_WEAPON_CALIBRATION_LEGACY_NAMESPACE,
  CREATURE_LAB_WEAPON_CALIBRATION_NAMESPACE,
  CreatureLabCalibrationStore,
  serializeEnemyPresetFromLabCalibration,
  weaponDefinitionToLabCalibration,
} from '../src/game/creatures/CreatureLabCalibration.js';
import { CreatureLabController } from '../src/game/creatures/CreatureLabController.js';
import { CreatureDefinitionRegistry } from '../src/game/creatures/CreatureDefinitionRegistry.js';
import { CreatureFactory } from '../src/game/creatures/CreatureFactory.js';
import {
  DREAD_RAM_GOD_GREAT_MACE_PRESET,
  EnemyPresetRegistry,
} from '../src/game/creatures/EnemyPresetRegistry.js';
import { EnemyPresetResolver } from '../src/game/creatures/EnemyPresetResolver.js';

const packFiles = [
  'chezwick_damage_v001',
  'dreadguard_damage_v001',
  'dread_ram_god_damage_v001',
];
const packs = new Map(await Promise.all(packFiles.map(async (packId) => [
  packId,
  JSON.parse(await readFile(new URL(`../public/generated/creature-packs/${packId}.json`, import.meta.url), 'utf8')),
])));

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
    values,
  };
}

function packRegistry(source = packs) {
  return {
    async loadPack(packId) {
      const pack = source.get(packId);
      if (!pack) {
        const error = new Error(`Unknown Creature Pack ${packId}`);
        error.code = 'UNKNOWN_PACK';
        throw error;
      }
      return pack;
    },
  };
}

function presetVariant({
  presetId = 'dread_ram_god_second_mace',
  definitionId = 'dread_ram_god',
  loadoutId = HUMANOID_DREADSTONE_MACE_MAIN_HAND_LOADOUT.loadoutId,
  targetHeight = 1.7,
  assetScale = 1,
  gripPosition = [0, 0, 0],
  radius = 0.13,
} = {}) {
  return {
    schema: ENEMY_PRESET_SCHEMA,
    version: ENEMY_PRESET_VERSION,
    presetId,
    displayName: presetId.replaceAll('_', ' '),
    creatureDefinitionId: definitionId,
    presentation: { targetHeight },
    armament: {
      loadoutId,
      weaponOverride: {
        assetScale,
        gripTransform: {
          position: [...gripPosition],
          quaternion: [Math.SQRT1_2, 0, 0, Math.SQRT1_2],
        },
        attackCapsule: {
          start: [0, 0, -0.48],
          end: [0, 0, -0.29],
          radius,
        },
      },
    },
  };
}

function resolverFixture({
  presets = [DREAD_RAM_GOD_GREAT_MACE_PRESET],
  definitions = undefined,
  loadouts = undefined,
  weapons = undefined,
  sourcePacks = packs,
  creatureFactory = null,
} = {}) {
  const presetRegistry = new EnemyPresetRegistry({ presets });
  const definitionRegistry = new CreatureDefinitionRegistry(definitions ? { definitions } : undefined);
  const creaturePackRegistry = packRegistry(sourcePacks);
  const factory = creatureFactory ?? new CreatureFactory({ definitionRegistry, creaturePackRegistry });
  const loadoutRegistry = new NpcLoadoutRegistry(loadouts ? { loadouts } : undefined);
  const weaponRegistry = new NpcWeaponRegistry(weapons ? { definitions: weapons } : undefined);
  const resolver = new EnemyPresetResolver({
    presetRegistry,
    definitionRegistry,
    creaturePackRegistry,
    creatureFactory: factory,
    loadoutRegistry,
    weaponRegistry,
  });
  return { resolver, presetRegistry, definitionRegistry, creaturePackRegistry, creatureFactory: factory, loadoutRegistry, weaponRegistry };
}

test('dreadstone.enemy_preset.v1 accepts the checked-in Ram God preset', () => {
  assert.equal(validateEnemyPreset(DREAD_RAM_GOD_GREAT_MACE_PRESET).valid, true);
  assert.equal(DREAD_RAM_GOD_GREAT_MACE_PRESET.schema, 'dreadstone.enemy_preset.v1');
  assert.equal(DREAD_RAM_GOD_GREAT_MACE_PRESET.version, 1);
  assert.deepEqual(DREAD_RAM_GOD_GREAT_MACE_PRESET.presentation, { targetHeight: 2.1 });
  assert.deepEqual(DREAD_RAM_GOD_GREAT_MACE_PRESET.armament.weaponOverride, {
    assetScale: 1.41,
    gripTransform: {
      position: [0.005, 0.085, -0.015],
      quaternion: [0.70710678, 0, 0, 0.70710678],
    },
    attackCapsule: {
      start: [0, 0, -0.48],
      end: [0, 0, -0.29],
      radius: 0.13,
    },
  });
});

test('Enemy Preset contract rejects malformed and foreign-authority fields', () => {
  const malformed = structuredClone(DREAD_RAM_GOD_GREAT_MACE_PRESET);
  malformed.presentation.targetHeight = -1;
  malformed.armament.weaponOverride.gripTransform.quaternion = [0, 0, 0, 2];
  malformed.creaturePackId = 'forge_owned_pack';
  malformed.ai = { aggression: 1 };
  const validation = validateEnemyPreset(malformed);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('; '), /targetHeight|quaternion|creaturePackId|ai/);
});

test('Enemy Preset registry rejects duplicate preset IDs', () => {
  assert.throws(
    () => new EnemyPresetRegistry({ presets: [DREAD_RAM_GOD_GREAT_MACE_PRESET, structuredClone(DREAD_RAM_GOD_GREAT_MACE_PRESET)] }),
    (error) => error.code === 'DUPLICATE_PRESET',
  );
});

test('Enemy Preset resolver rejects unknown Creature Definitions', async () => {
  const { resolver } = resolverFixture({ presets: [presetVariant({ definitionId: 'unknown_creature' })] });
  await assert.rejects(resolver.resolve('dread_ram_god_second_mace'), (error) => error.code === 'UNKNOWN_DEFINITION');
});

test('Enemy Preset resolver rejects unknown loadouts', async () => {
  const { resolver } = resolverFixture({ presets: [presetVariant({ loadoutId: 'missing_loadout' })] });
  await assert.rejects(resolver.resolve('dread_ram_god_second_mace'), (error) => error.code === 'UNKNOWN_LOADOUT');
});

test('Enemy Preset resolver rejects unknown canonical weapons', async () => {
  const missingWeaponLoadout = {
    schema: NPC_LOADOUT_SCHEMA,
    loadoutId: 'missing_weapon_main_hand',
    mainHandWeaponId: 'missing_weapon',
    allowedOffensiveActionIds: ['humanoid_one_hand_overhead'],
  };
  const { resolver } = resolverFixture({
    presets: [presetVariant({ loadoutId: missingWeaponLoadout.loadoutId })],
    loadouts: [missingWeaponLoadout],
    weapons: [],
  });
  await assert.rejects(resolver.resolve('dread_ram_god_second_mace'), (error) => error.code === 'UNKNOWN_WEAPON');
});

test('Enemy Preset resolver fails closed when loadout and Forge Action capability are incompatible', async () => {
  const unavailableActionLoadout = {
    schema: NPC_LOADOUT_SCHEMA,
    loadoutId: 'ram_mace_heavy_only',
    mainHandWeaponId: 'dreadstone_mace',
    allowedOffensiveActionIds: ['humanoid_one_hand_heavy'],
  };
  const { resolver } = resolverFixture({
    presets: [presetVariant({ loadoutId: unavailableActionLoadout.loadoutId })],
    loadouts: [unavailableActionLoadout],
  });
  await assert.rejects(resolver.resolve('dread_ram_god_second_mace'), (error) => error.code === 'INCOMPATIBLE_LOADOUT');
});

test('Enemy Preset resolver fails closed when the required authored hand socket is absent', async () => {
  const noRightHandPacks = new Map(packs);
  const ram = structuredClone(packs.get('dread_ram_god_damage_v001'));
  ram.attachmentSockets.sockets = ram.attachmentSockets.sockets.filter((socket) => socket.semanticRole !== 'MAIN_HAND_R');
  ram.attachmentSockets.socketIds = ram.attachmentSockets.sockets.map((socket) => socket.socketId);
  noRightHandPacks.set(ram.packId, ram);
  const { resolver } = resolverFixture({ sourcePacks: noRightHandPacks });
  await assert.rejects(resolver.resolve('dread_ram_god_great_mace'), (error) => ['REQUIRED_SOCKET_UNAVAILABLE', 'INVALID_DESCRIPTOR'].includes(error.code));
});

test('preset weapon override creates an independent immutable weapon without mutating canonical truth', async () => {
  const canonicalSnapshot = structuredClone(DREADSTONE_MACE_WEAPON);
  const { resolver } = resolverFixture({ presets: [presetVariant({ assetScale: 1.8, gripPosition: [0.2, 0.1, -0.05], radius: 0.2 })] });
  const resolved = await resolver.resolve('dread_ram_god_second_mace');
  assert.notEqual(resolved.weapon, resolved.canonicalWeapon);
  assert.equal(Object.isFrozen(resolved.weapon), true);
  assert.equal(resolved.weapon.assetScale, 1.8);
  assert.deepEqual(resolved.weapon.gripTransform.position, [0.2, 0.1, -0.05]);
  assert.deepEqual(DREADSTONE_MACE_WEAPON, canonicalSnapshot);
});

test('two presets sharing the canonical mace resolve different independent calibration', async () => {
  const first = presetVariant({ presetId: 'ram_mace_small', assetScale: 0.8, gripPosition: [0.1, 0, 0] });
  const second = presetVariant({ presetId: 'ram_mace_large', assetScale: 2.1, gripPosition: [-0.2, 0.05, 0] });
  const { resolver } = resolverFixture({ presets: [first, second] });
  const [small, large] = await Promise.all([resolver.resolve(first.presetId), resolver.resolve(second.presetId)]);
  assert.equal(small.canonicalWeapon, large.canonicalWeapon);
  assert.notEqual(small.weapon, large.weapon);
  assert.notDeepEqual(small.weapon.gripTransform, large.weapon.gripTransform);
  assert.equal(small.weapon.assetScale, 0.8);
  assert.equal(large.weapon.assetScale, 2.1);
});

test('resolved asset scale leaves grip translation invariant and scales capsule geometry by the runtime law', async () => {
  const { resolver } = resolverFixture({ presets: [presetVariant({ assetScale: 2.5, gripPosition: [0.25, 0.1, -0.05] })] });
  const resolved = await resolver.resolve('dread_ram_god_second_mace');
  const hand = new THREE.Bone();
  hand.name = resolved.attachmentSocket.parentRuntimeBone;
  const root = new THREE.Group();
  root.add(hand);
  const attachment = new RuntimeAttachmentSocketResolver({ visualAdapter: { getRuntimeBone: () => hand } });
  attachment.resolve(resolved.attachmentSocket);
  const weaponRoot = new THREE.Group();
  attachment.attachWeapon(weaponRoot, resolved.weapon.gripTransform, resolved.weapon.assetScale);
  root.updateWorldMatrix(true, true);
  const gripBefore = attachment.binding.gripFrame.getWorldPosition(new THREE.Vector3()).toArray();
  const start = weaponRoot.localToWorld(new THREE.Vector3().fromArray(resolved.weapon.attackCapsule.start));
  const end = weaponRoot.localToWorld(new THREE.Vector3().fromArray(resolved.weapon.attackCapsule.end));
  const localLength = new THREE.Vector3().fromArray(resolved.weapon.attackCapsule.start)
    .distanceTo(new THREE.Vector3().fromArray(resolved.weapon.attackCapsule.end));
  assert.ok(Math.abs(start.distanceTo(end) - localLength * resolved.weapon.assetScale) < 1e-8);
  assert.equal(resolved.weapon.attackCapsule.radius * resolved.weapon.assetScale, 0.325);
  attachment.updateWeaponTransform(resolved.weapon.gripTransform, 4);
  assert.deepEqual(attachment.binding.gripFrame.getWorldPosition(new THREE.Vector3()).toArray(), gripBefore);
  attachment.dispose();
});

test('preset height composes through the shared profile path without mutating Creature Definition', async () => {
  const preset = presetVariant({ targetHeight: 2.35 });
  const fixture = resolverFixture({ presets: [preset] });
  const definition = fixture.definitionRegistry.getDefinition('dread_ram_god');
  const snapshot = structuredClone(definition);
  const resolved = await fixture.resolver.resolve(preset.presetId);
  assert.equal(resolved.profile.targetHeight, 2.35);
  assert.equal(resolved.definition, definition);
  assert.deepEqual(definition, snapshot);
});

test('Dread Ram God Great Mace resolves real body, MAIN_HAND_R, mace, and overhead Action', async () => {
  const resolved = await resolverFixture().resolver.resolve('dread_ram_god_great_mace');
  assert.equal(resolved.definition.definitionId, 'dread_ram_god');
  assert.equal(resolved.pack.packId, 'dread_ram_god_damage_v001');
  assert.equal(resolved.loadout.loadoutId, 'humanoid_dreadstone_mace_main_hand');
  assert.equal(resolved.weapon.weaponId, 'dreadstone_mace');
  assert.equal(resolved.attachmentSocket.semanticRole, 'MAIN_HAND_R');
  assert.deepEqual(resolved.compatibleActions.map((action) => action.combatActionId), ['humanoid_one_hand_overhead']);
});

test('legacy Chezwick and Dreadguard definition composition remains preset-independent', async () => {
  const { creatureFactory } = resolverFixture();
  const [chezwick, dreadguard] = await Promise.all([creatureFactory.resolve('chezwick'), creatureFactory.resolve('dreadguard')]);
  assert.equal(chezwick.profile.targetHeight, 1.5);
  assert.equal(dreadguard.profile.targetHeight, 1.5);
  assert.equal(chezwick.profile.creatureDefinitionId, 'chezwick');
  assert.equal(dreadguard.profile.creatureDefinitionId, 'dreadguard');
  assert.equal('enemyPresetId' in chezwick.profile, false);
});

test('Lab calibration drafts are isolated by preset plus weapon', () => {
  const storage = memoryStorage();
  const store = new CreatureLabCalibrationStore({ storage });
  const firstContext = { kind: 'preset', id: 'ram_mace_small' };
  const secondContext = { kind: 'preset', id: 'ram_mace_large' };
  const first = store.loadDraft({ context: firstContext, weaponDefinition: DREADSTONE_MACE_WEAPON, targetHeight: 1.7 });
  first.weaponCalibration.assetScale = 0.8;
  store.saveDraft({ context: firstContext, weaponDefinition: DREADSTONE_MACE_WEAPON, ...first });
  const second = store.loadDraft({ context: secondContext, weaponDefinition: DREADSTONE_MACE_WEAPON, targetHeight: 2.1 });
  assert.equal(second.weaponCalibration.assetScale, 1);
  assert.equal(second.targetHeight, 2.1);
  assert.notEqual(store.key(firstContext, 'dreadstone_mace'), store.key(secondContext, 'dreadstone_mace'));
});

test('v2 scoped drafts never silently migrate v1 global weapon calibration', () => {
  const oldCalibration = weaponDefinitionToLabCalibration(DREADSTONE_MACE_WEAPON);
  oldCalibration.assetScale = 7;
  const storage = memoryStorage({
    [`${CREATURE_LAB_WEAPON_CALIBRATION_LEGACY_NAMESPACE}.dreadstone_mace`]: JSON.stringify(oldCalibration),
  });
  const store = new CreatureLabCalibrationStore({ storage });
  const loaded = store.loadDraft({
    context: { kind: 'preset', id: 'dread_ram_god_great_mace' },
    weaponDefinition: DREADSTONE_MACE_WEAPON,
    targetHeight: 1.7,
  });
  assert.equal(CREATURE_LAB_WEAPON_CALIBRATION_NAMESPACE.endsWith('.v2'), true);
  assert.equal(loaded.weaponCalibration.assetScale, 1);
});

test('definition-only Lab fallback is explicit and isolated by Creature Definition', () => {
  const storage = memoryStorage();
  const store = new CreatureLabCalibrationStore({ storage });
  const chezwickContext = { kind: 'definition', id: 'chezwick' };
  const dreadguardContext = { kind: 'definition', id: 'dreadguard' };
  const draft = store.loadDraft({ context: chezwickContext, weaponDefinition: DREADSTONE_MACE_WEAPON, targetHeight: 1.5 });
  draft.weaponCalibration.gripPosition[0] = 0.42;
  store.saveDraft({ context: chezwickContext, weaponDefinition: DREADSTONE_MACE_WEAPON, ...draft });
  assert.equal(store.loadDraft({ context: dreadguardContext, weaponDefinition: DREADSTONE_MACE_WEAPON, targetHeight: 1.5 }).weaponCalibration.gripPosition[0], 0);
  assert.match(store.key(chezwickContext, 'dreadstone_mace'), /\.definition\.chezwick\.dreadstone_mace$/);
});

function controllerFixture() {
  const definitionRegistry = new CreatureDefinitionRegistry();
  const creaturePackRegistry = packRegistry();
  const realFactory = new CreatureFactory({ definitionRegistry, creaturePackRegistry });
  let actorSerial = 0;
  const labFactory = {
    resolve: (definitionId) => realFactory.resolve(definitionId),
    createActorFromResolved(resolved) {
      return {
        ...resolved,
        actor: {
          instanceId: `preset-lab-${++actorSerial}`,
          lifeState: 'alive',
          disposed: false,
          visualAdapter: { ready: Promise.resolve(), listProgressiveDamageSites: () => [] },
        },
      };
    },
  };
  const presetRegistry = new EnemyPresetRegistry();
  const weaponRegistry = new NpcWeaponRegistry();
  const enemyPresetResolver = new EnemyPresetResolver({
    presetRegistry,
    definitionRegistry,
    creaturePackRegistry,
    creatureFactory: labFactory,
    weaponRegistry,
  });
  const walkerController = {
    actor: null,
    actorFactory: null,
    reset() { this.actor = this.actorFactory({}); return true; },
    disposeWalker() { if (this.actor) this.actor.disposed = true; this.actor = null; },
  };
  const harness = {
    weaponRegistry,
    selectedWeaponId: 'dreadstone_mace',
    equipped: false,
    listWeapons: () => weaponRegistry.list(),
    getSelectedWeaponId() { return this.selectedWeaponId; },
    getDiagnostics() { return { enabled: true, capabilityAvailable: true, equipped: this.equipped }; },
    clearSubject() { this.equipped = false; },
    setSubject(actor, options) { this.actor = actor; this.loadout = options.loadout; return { accepted: true }; },
    selectWeapon(weaponId) { this.selectedWeaponId = weaponId; return { accepted: true, loadoutId: `fixture_${weaponId}` }; },
    setCalibrationOverride(calibration) { this.calibration = structuredClone(calibration); return { accepted: true }; },
    async equip() { this.equipped = true; return { accepted: true }; },
    update() {},
    dispose() {},
  };
  const storage = memoryStorage();
  const controller = new CreatureLabController({
    registry: creaturePackRegistry,
    definitionRegistry,
    creatureFactory: labFactory,
    presetRegistry,
    enemyPresetResolver,
    walkerController,
    attackHarness: harness,
    calibrationStorage: storage,
    initialPresetId: 'dread_ram_god_great_mace',
    initialDefinitionId: null,
  });
  return { controller, harness, storage };
}

test('Creature Lab resolves and selects the Ram God production preset as a separate workflow', async () => {
  const { controller, harness } = controllerFixture();
  await controller.initialize();
  const state = controller.getViewState();
  assert.equal(state.selectedPresetId, 'dread_ram_god_great_mace');
  assert.equal(state.selectedDefinitionId, 'dread_ram_god');
  assert.equal(state.selectedWeaponId, 'dreadstone_mace');
  assert.equal(state.resultingCreatureHeight, 2.1);
  assert.equal(harness.loadout.loadoutId, 'humanoid_dreadstone_mace_main_hand');
  assert.equal(harness.calibration.assetScale, 1.41);
  controller.dispose();
});

test('Reset to Preset Defaults clears height and weapon changes together', async () => {
  const { controller, storage } = controllerFixture();
  await controller.initialize();
  controller.setWeaponCalibrationField('assetScale', 2.4);
  await controller.setCreatureHeight(2.2);
  assert.equal(controller.getViewState().hasUnsavedLabDraft, true);
  assert.equal(controller.getViewState().resultingCreatureHeight, 2.2);
  assert.equal(controller.getViewState().weaponCalibration.assetScale, 2.4);
  const key = controller.calibrationStore.key({ kind: 'preset', id: 'dread_ram_god_great_mace' }, 'dreadstone_mace');
  assert.equal(storage.values.has(key), true);
  await controller.resetToPresetDefaults();
  assert.equal(controller.getViewState().hasUnsavedLabDraft, false);
  assert.equal(controller.getViewState().resultingCreatureHeight, 2.1);
  assert.equal(controller.getViewState().weaponCalibration.assetScale, 1.41);
  assert.equal(storage.values.has(key), false);
  controller.dispose();
});

test('Enemy Preset JSON copy payload is deterministic, complete, normalized, and production-only', () => {
  const calibration = weaponDefinitionToLabCalibration(DREADSTONE_MACE_WEAPON);
  calibration.assetScale = 1.2345678912;
  calibration.gripPosition = [0.123456789, -0.2, 0.3];
  calibration.gripEulerDegrees = [12, -34, 56];
  const options = {
    preset: DREAD_RAM_GOD_GREAT_MACE_PRESET,
    targetHeight: 2.123456789,
    weaponDefinition: DREADSTONE_MACE_WEAPON,
    calibration,
  };
  const first = serializeEnemyPresetFromLabCalibration(options);
  const second = serializeEnemyPresetFromLabCalibration(options);
  assert.equal(first, second);
  const record = JSON.parse(first);
  assert.deepEqual(Object.keys(record), ['schema', 'version', 'presetId', 'displayName', 'creatureDefinitionId', 'presentation', 'armament']);
  assert.deepEqual(Object.keys(record.armament.weaponOverride), ['assetScale', 'gripTransform', 'attackCapsule']);
  assert.equal(record.presentation.targetHeight, 2.12345679);
  assert.equal(record.armament.weaponOverride.assetScale, 1.23456789);
  assert.ok(Math.abs(Math.hypot(...record.armament.weaponOverride.gripTransform.quaternion) - 1) < 1e-7);
  assert.equal('weaponId' in record.armament.weaponOverride, false);
  assert.equal(first.includes('localStorage'), false);
  assert.equal(validateEnemyPreset(record).valid, true);
});

test('Creature Lab UI exposes preset defaults, draft status, reset, copy, and selectable clipboard fallback', async () => {
  const source = await readFile(new URL('../src/game/creatures/CreatureLabPanel.js', import.meta.url), 'utf8');
  assert.match(source, /PRODUCTION PRESET DEFAULTS/);
  assert.match(source, /UNSAVED LAB DRAFT/);
  assert.match(source, /Reset to Preset Defaults/);
  assert.match(source, /COPY ENEMY PRESET JSON/);
  assert.match(source, /selectNodeContents\(this\.enemyPresetReadout\)/);
});
