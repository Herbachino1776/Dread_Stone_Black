import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { extractForgeRuntimeArmamentCapabilities } from '../src/contracts/ForgeRuntimeArmament.js';
import { NpcArmamentRuntime } from '../src/game/combat/NpcArmamentRuntime.js';
import {
  CREATURE_LAB_WEAPON_LOADOUTS,
  resolveNpcLoadout,
} from '../src/game/combat/NpcLoadout.js';
import {
  DREADSTONE_MACE_WEAPON,
  DREADSTONE_SWORD_WEAPON,
  NpcWeaponRegistry,
  OLD_WORK_KNIFE_WEAPON,
  PRODUCTION_WORLD_WEAPONS,
  validateNpcWeaponDefinition,
} from '../src/game/combat/NpcWeaponRegistry.js';
import { PlayerCombatDamageReceiver } from '../src/game/combat/PlayerCombatDamageReceiver.js';
import { WorldWeaponGlbLoader, WorldWeaponGlbLoadError } from '../src/game/combat/WorldWeaponGlbLoader.js';
import {
  createCreatureLabHeightResolution,
  CreatureLabCalibrationStore,
  CREATURE_LAB_WEAPON_CALIBRATION_NAMESPACE,
  labCalibrationToWeaponDefinitionPatch,
} from '../src/game/creatures/CreatureLabCalibration.js';
import { CreatureLabController } from '../src/game/creatures/CreatureLabController.js';
import { CreatureDefinitionRegistry } from '../src/game/creatures/CreatureDefinitionRegistry.js';

const forgeFixture = JSON.parse(await readFile(new URL('./fixtures/m6_runtime_capability.json', import.meta.url), 'utf8'));
const approvedClips = [{
  name: 'DSB_Attack_Slash_RTL_OneHand_v001',
  kind: 'ATTACK_SLASH_RTL_ONE_HAND',
  durationSeconds: 1.333333,
}];

function capabilities() {
  return extractForgeRuntimeArmamentCapabilities(forgeFixture, { approvedClips });
}

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

function disposableLoader() {
  const instances = new Set();
  const released = [];
  return {
    async instantiate(assetPath) {
      const root = new THREE.Group();
      root.name = assetPath;
      root.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), new THREE.MeshStandardMaterial()));
      instances.add(root);
      return root;
    },
    release(instance) {
      if (!instances.delete(instance)) return false;
      instance.removeFromParent();
      instance.traverse((object) => {
        object.geometry?.dispose?.();
        object.material?.dispose?.();
      });
      released.push(instance);
      return true;
    },
    instances,
    released,
  };
}

function armamentFixture({ rigScale = 1 } = {}) {
  const scene = new THREE.Scene();
  const rig = new THREE.Group();
  rig.scale.setScalar(rigScale);
  const hand = new THREE.Bone();
  hand.name = 'arm_right_hand';
  rig.add(hand);
  scene.add(rig);
  const animationController = {
    offensiveCompletionCount: 0,
    playOffensiveAction: () => ({ name: approvedClips[0].name }),
    getActionClipTime: () => 0,
  };
  const actor = {
    instanceId: 'm66-actor',
    lifeState: 'alive',
    disposed: false,
    scene,
    spawnYaw: 0,
    visualAdapter: {
      animationController,
      getRuntimeBone: (name) => name === hand.name ? hand : null,
    },
  };
  const player = {
    position: new THREE.Vector3(0, 0, 2),
    eyeHeight: 1.55,
    collisionWorld: { playerRadius: 0.34 },
  };
  const receiver = new PlayerCombatDamageReceiver({ player });
  const weaponLoader = disposableLoader();
  const weaponRegistry = new NpcWeaponRegistry({ weaponLoader });
  const runtime = new NpcArmamentRuntime({
    actor,
    creaturePack: capabilities(),
    weaponRegistry,
    damageReceiverProvider: () => receiver,
    playerProvider: () => player,
  });
  return { scene, rig, hand, actor, player, receiver, weaponLoader, weaponRegistry, runtime };
}

test('three canonical real GLB weapons validate, exist, and are the production registry entries', async () => {
  const registry = new NpcWeaponRegistry({ weaponLoader: disposableLoader() });
  assert.deepEqual(registry.list().map((weapon) => weapon.weaponId), [
    'dreadstone_mace',
    'dreadstone_sword',
    'old_work_knife',
  ]);
  for (const weapon of PRODUCTION_WORLD_WEAPONS) {
    assert.equal(validateNpcWeaponDefinition(weapon).valid, true);
    assert.equal(typeof weapon.assetScale, 'number');
    assert.deepEqual(weapon.compatibleSocketRoles, ['MAIN_HAND_R']);
    const file = await stat(new URL(`../public${weapon.assetPath}`, import.meta.url));
    assert.ok(file.isFile() && file.size > 1_000_000, `${weapon.assetPath} must be a real checked-in GLB`);
  }
  assert.equal(validateNpcWeaponDefinition({ ...DREADSTONE_MACE_WEAPON, assetPath: '../escape.glb' }).valid, false);
  assert.equal(validateNpcWeaponDefinition({ ...DREADSTONE_MACE_WEAPON, assetScale: [1, 1, 1] }).valid, false, 'non-uniform XYZ scale is not supported');
});

test('world weapon loader caches one source load and clones independently disposable instances', async () => {
  let loadCount = 0;
  const source = new THREE.Group();
  const texture = new THREE.Texture();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), new THREE.MeshStandardMaterial({ map: texture }));
  source.add(mesh);
  const loader = new WorldWeaponGlbLoader({
    loader: { async loadAsync() { loadCount += 1; return { scene: source }; } },
    cloneScene: (value) => value.clone(true),
  });
  const [first, second] = await Promise.all([loader.instantiate('/assets/fixture.glb'), loader.instantiate('/assets/fixture.glb')]);
  assert.equal(loadCount, 1);
  assert.notEqual(first, second);
  assert.notEqual(first.children[0].geometry, second.children[0].geometry);
  assert.notEqual(first.children[0].material, second.children[0].material);
  assert.equal(first.children[0].material.map, second.children[0].material.map, 'cached source textures may be shared safely');
  let firstGeometryDisposed = false;
  first.children[0].geometry.addEventListener('dispose', () => { firstGeometryDisposed = true; });
  assert.equal(loader.release(first), true);
  assert.equal(firstGeometryDisposed, true);
  assert.equal(loader.getDiagnostics().activeInstanceCount, 1);
  assert.equal(second.children[0].parent, second);
  loader.dispose();
  assert.equal(loader.getDiagnostics().disposed, true);
});

test('world weapon load failures include the asset path and failed loads remain retryable', async () => {
  let attempts = 0;
  const loader = new WorldWeaponGlbLoader({
    loader: { async loadAsync() { attempts += 1; throw new Error('fixture network failure'); } },
  });
  await assert.rejects(
    loader.instantiate('/assets/weapons/missing.glb'),
    (error) => error instanceof WorldWeaponGlbLoadError
      && error.assetPath === '/assets/weapons/missing.glb'
      && /fixture network failure/.test(error.message),
  );
  await assert.rejects(loader.instantiate('/assets/weapons/missing.glb'));
  assert.equal(attempts, 2);
  loader.dispose();
});

test('real mace, sword, and knife loadouts resolve only Forge-declared class/socket compatibility', () => {
  const registry = new NpcWeaponRegistry({ weaponLoader: disposableLoader() });
  const offensiveActions = capabilities().offensiveActions;
  const resolved = CREATURE_LAB_WEAPON_LOADOUTS.map((loadout) => resolveNpcLoadout({ loadout, weaponRegistry: registry, offensiveActions }));
  assert.deepEqual(resolved.map((entry) => entry.weapon.weaponId), ['dreadstone_mace', 'dreadstone_sword', 'old_work_knife']);
  assert.ok(resolved.every((entry) => entry.compatibleActions.length === 1));
  assert.equal(resolved[0].weapon.weaponClass, 'ONE_HAND_BLUNT');
  assert.equal(resolved[1].weapon.weaponClass, 'ONE_HAND_BLADE');
  assert.equal(resolved[2].weapon.weaponClass, 'ONE_HAND_BLADE');

  const bladeOnlyActions = structuredClone(offensiveActions);
  bladeOnlyActions.actions[0].compatibleWeaponClasses = ['ONE_HAND_BLADE'];
  assert.throws(
    () => resolveNpcLoadout({ loadout: CREATURE_LAB_WEAPON_LOADOUTS[0], weaponRegistry: registry, offensiveActions: bladeOnlyActions }),
    /no compatible Forge offensive Action/,
  );
});

test('uniform asset scale changes GLB and physical capsule while grip translation stays invariant and socket animation is followed', async () => {
  const { runtime, hand, rig, weaponLoader } = armamentFixture({ rigScale: 2 });
  assert.equal((await runtime.equip()).accepted, true);
  const base = runtime.getDiagnostics();
  const baseLength = new THREE.Vector3().fromArray(base.currentWorldCapsule.start)
    .distanceTo(new THREE.Vector3().fromArray(base.currentWorldCapsule.end));
  const override = {
    weaponId: 'dreadstone_mace',
    assetScale: 2.5,
    gripTransform: { position: [0.25, 0.1, -0.05], quaternion: [...DREADSTONE_MACE_WEAPON.gripTransform.quaternion] },
    attackCapsule: structuredClone(DREADSTONE_MACE_WEAPON.attackCapsule),
  };
  assert.equal(runtime.setCalibrationOverride(override).accepted, true);
  const scaled = runtime.getDiagnostics();
  const scaledLength = new THREE.Vector3().fromArray(scaled.currentWorldCapsule.start)
    .distanceTo(new THREE.Vector3().fromArray(scaled.currentWorldCapsule.end));
  assert.ok(Math.abs(scaledLength - baseLength * 2.5) < 1e-6);
  assert.ok(Math.abs(scaled.currentWorldCapsule.radius - DREADSTONE_MACE_WEAPON.attackCapsule.radius * 2.5) < 1e-9);
  assert.ok(scaled.weaponWorldTransform.scale.every((entry) => Math.abs(entry - 2.5) < 1e-6));

  const gripWorldBeforeScaleChange = [...scaled.weaponWorldTransform.position];
  override.assetScale = 4;
  runtime.setCalibrationOverride(override);
  const rescaled = runtime.getDiagnostics();
  assert.deepEqual(rescaled.weaponWorldTransform.position, gripWorldBeforeScaleChange, 'asset scale must not scale grip translation');
  assert.ok(Math.abs(rescaled.currentWorldCapsule.radius - DREADSTONE_MACE_WEAPON.attackCapsule.radius * 4) < 1e-9);

  const beforeAnimation = rescaled.weaponWorldTransform.position[0];
  hand.position.x = 0.6;
  rig.updateWorldMatrix(true, true);
  runtime.update();
  assert.ok(runtime.getDiagnostics().weaponWorldTransform.position[0] > beforeAnimation + 1.1, 'weapon follows the animated hand/socket');
  assert.equal(runtime.unequip().wasEquipped, true);
  assert.equal(weaponLoader.instances.size, 0);
  assert.equal(hand.children.some((child) => child.name.startsWith('DSB_RuntimeSocket_')), false);
  runtime.dispose();
});

test('weapon switching releases the old GLB instance and equips a fresh canonical instance', async () => {
  const fixture = armamentFixture();
  assert.equal((await fixture.runtime.equip()).accepted, true);
  const firstVisual = fixture.runtime.weaponVisual;
  fixture.runtime.setLoadout(CREATURE_LAB_WEAPON_LOADOUTS[1]);
  assert.equal(fixture.weaponLoader.released.includes(firstVisual), true);
  assert.equal((await fixture.runtime.equip()).accepted, true);
  assert.equal(fixture.runtime.getDiagnostics().weaponId, 'dreadstone_sword');
  assert.notEqual(fixture.runtime.weaponVisual, firstVisual);
  fixture.runtime.dispose();
  assert.equal(fixture.weaponLoader.instances.size, 0);
});

test('Creature Lab weapon calibration persists only in its namespace, resets, and never mutates production definitions', () => {
  const productionSnapshot = structuredClone(DREADSTONE_SWORD_WEAPON);
  const storage = memoryStorage({ 'dreadstone.production.weapon': 'untouched' });
  const store = new CreatureLabCalibrationStore({ storage });
  const calibration = store.load(DREADSTONE_SWORD_WEAPON);
  calibration.assetScale = 3.25;
  calibration.gripPosition[0] = 0.175;
  calibration.gripEulerDegrees = [12, -34, 56];
  calibration.attackCapsule.radius = 0.09;
  const saved = store.save(DREADSTONE_SWORD_WEAPON, calibration);
  const key = `${CREATURE_LAB_WEAPON_CALIBRATION_NAMESPACE}.dreadstone_sword`;
  assert.ok(storage.values.has(key));
  assert.equal(storage.values.get('dreadstone.production.weapon'), 'untouched');
  const patch = labCalibrationToWeaponDefinitionPatch(DREADSTONE_SWORD_WEAPON, saved);
  assert.equal(patch.assetScale, 3.25);
  assert.deepEqual(patch.gripTransform.position, [0.175, 0, 0]);
  assert.equal(patch.gripTransform.quaternion.length, 4);
  assert.equal(patch.attackCapsule.radius, 0.09);
  const reset = store.reset(DREADSTONE_SWORD_WEAPON);
  assert.equal(reset.assetScale, DREADSTONE_SWORD_WEAPON.assetScale);
  assert.equal(storage.values.has(key), false);
  assert.deepEqual(DREADSTONE_SWORD_WEAPON, productionSnapshot);
});

test('creature height override copies the runtime profile, restores equipped armament after rebuild, and resets without definition mutation', async () => {
  const productionDefinition = new CreatureDefinitionRegistry().getDefinition('dread_ram_god');
  const productionSnapshot = structuredClone(productionDefinition);
  const baseResolved = Object.freeze({
    definition: productionDefinition,
    pack: { packId: productionDefinition.creaturePackId, displayName: 'Fixture Pack' },
    profile: Object.freeze({ name: 'fixture-profile', targetHeight: productionDefinition.presentation.targetHeight }),
  });
  const definitionRegistry = new CreatureDefinitionRegistry({ definitions: [productionDefinition] });
  let actorSerial = 0;
  const disposedActors = [];
  const creatureFactory = {
    async resolve() { return baseResolved; },
    createActorFromResolved(resolved) {
      return {
        ...resolved,
        actor: {
          instanceId: `height-actor-${++actorSerial}`,
          lifeState: 'alive',
          disposed: false,
          visualAdapter: { ready: Promise.resolve(), listProgressiveDamageSites: () => [] },
        },
      };
    },
  };
  const walkerController = {
    actor: null,
    actorFactory: null,
    reset() { this.actor = this.actorFactory({}); return true; },
    disposeWalker() { if (this.actor) { this.actor.disposed = true; disposedActors.push(this.actor); } this.actor = null; },
  };
  const harness = {
    selectedWeaponId: 'dreadstone_mace',
    equipped: false,
    attachedActor: null,
    equipCount: 0,
    listWeapons: () => PRODUCTION_WORLD_WEAPONS,
    getSelectedWeaponId() { return this.selectedWeaponId; },
    getDiagnostics() { return { enabled: true, capabilityAvailable: true, equipped: this.equipped }; },
    clearSubject() { this.attachedActor = null; this.equipped = false; },
    setSubject(actor) { this.attachedActor = actor; return { accepted: true }; },
    selectWeapon(weaponId) { this.selectedWeaponId = weaponId; return { accepted: true }; },
    setCalibrationOverride(calibration) { this.lastCalibration = structuredClone(calibration); return { accepted: true }; },
    async equip() { this.equipped = true; this.equipCount += 1; return { accepted: true }; },
    update() {},
    dispose() {},
  };
  const controller = new CreatureLabController({
    definitionRegistry,
    creatureFactory,
    walkerController,
    attackHarness: harness,
    calibrationStorage: memoryStorage(),
    initialDefinitionId: 'dread_ram_god',
  });
  await controller.initialize();
  assert.equal(controller.setWeaponCalibrationField('assetScale', 2.2).accepted, true);
  assert.equal(harness.lastCalibration.assetScale, 2.2);
  assert.equal(controller.resetWeaponCalibration().accepted, true);
  assert.equal(harness.lastCalibration.assetScale, DREADSTONE_MACE_WEAPON.assetScale);
  assert.equal((await controller.equipArmament()).accepted, true);
  const firstActor = controller.actor;
  assert.equal((await controller.setCreatureHeight(2.4)).accepted, true);
  assert.equal(firstActor.disposed, true);
  assert.equal(harness.attachedActor, controller.actor);
  assert.equal(harness.equipped, true);
  assert.equal(harness.equipCount, 2);
  assert.equal(controller.effectiveProfile.targetHeight, 2.4);
  assert.equal(controller.selectedDefinition, productionDefinition);
  assert.equal(createCreatureLabHeightResolution(baseResolved, 2.4).definition, productionDefinition);

  const heightActor = controller.actor;
  assert.equal((await controller.resetCreatureHeight()).accepted, true);
  assert.equal(heightActor.disposed, true);
  assert.equal(controller.effectiveProfile.targetHeight, 1.7);
  assert.equal(harness.attachedActor, controller.actor);
  assert.equal(harness.equipped, true);
  assert.equal(harness.equipCount, 3);
  assert.deepEqual(productionDefinition, productionSnapshot, 'Ram God production definition remains exactly 1.7 m');
  assert.ok(disposedActors.length >= 2);
  controller.dispose();
});
