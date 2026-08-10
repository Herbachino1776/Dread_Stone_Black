import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {
  extractForgeRuntimeArmamentCapabilities,
  offensivePhaseAtTime,
  validateAttachmentSocketCapability,
  validateOffensiveActionCapability,
} from '../src/contracts/ForgeRuntimeArmament.js';
import { NpcArmamentRuntime } from '../src/game/combat/NpcArmamentRuntime.js';
import { CREATURE_LAB_MACE_LOADOUT, NPC_LOADOUT_SCHEMA, resolveNpcLoadout, validateNpcLoadout } from '../src/game/combat/NpcLoadout.js';
import {
  DREADSTONE_MACE_WEAPON,
  DREADSTONE_SWORD_WEAPON,
  NPC_WEAPON_SCHEMA,
  NpcWeaponRegistry,
  OLD_WORK_KNIFE_WEAPON,
  validateNpcWeaponDefinition,
} from '../src/game/combat/NpcWeaponRegistry.js';
import { PlayerCombatDamageReceiver } from '../src/game/combat/PlayerCombatDamageReceiver.js';
import { RuntimeAttachmentSocketResolver } from '../src/game/combat/RuntimeAttachmentSocketResolver.js';
import { HUMANOID_ANIMATION_STATES, HumanoidAnimationPackController } from '../src/game/combat/HumanoidAnimationPackController.js';

const forgeFixture = JSON.parse(readFileSync(new URL('./fixtures/m6_runtime_capability.json', import.meta.url), 'utf8'));
const approvedClips = [{
  name: 'DSB_Attack_Slash_RTL_OneHand_v001',
  kind: 'ATTACK_SLASH_RTL_ONE_HAND',
  durationSeconds: 1.333333,
}];

function capabilities(manifest = forgeFixture, clips = approvedClips) {
  return extractForgeRuntimeArmamentCapabilities(manifest, { approvedClips: clips });
}

function makePack(manifest = forgeFixture) {
  return capabilities(manifest);
}

function makeAnimationController() {
  return {
    time: 0,
    offensiveCompletionCount: 0,
    played: [],
    playOffensiveAction(name) { this.time = 0; this.played.push(name); return { name, durationSeconds: 1.333333 }; },
    getActionClipTime() { return this.time; },
  };
}

function makeWeaponLoader() {
  const instances = new Set();
  return {
    async instantiate(assetPath) {
      const root = new THREE.Group();
      root.name = `FixtureWeapon:${assetPath}`;
      root.userData.assetPath = assetPath;
      instances.add(root);
      return root;
    },
    release(instance) {
      if (!instances.delete(instance)) return false;
      instance.removeFromParent();
      return true;
    },
    instances,
  };
}

function makeActorFixture({ playerPosition = new THREE.Vector3(0, 1.55, 0), rigScale = 1 } = {}) {
  const scene = new THREE.Scene();
  const rigRoot = new THREE.Group();
  rigRoot.name = 'DSB_DAMAGE_RIG';
  rigRoot.scale.setScalar(rigScale);
  const hand = new THREE.Bone();
  hand.name = 'arm_right_hand';
  rigRoot.add(hand);
  scene.add(rigRoot);
  scene.updateMatrixWorld(true);
  const animationController = makeAnimationController();
  const visualAdapter = {
    bones: new Map([[hand.name, hand]]),
    animationController,
    getRuntimeBone: (name) => name === hand.name ? hand : null,
  };
  const actor = {
    instanceId: 'm6-armed-actor',
    lifeState: 'alive',
    disposed: false,
    spawnYaw: 0,
    scene,
    visualAdapter,
  };
  const player = {
    position: playerPosition.clone(),
    spawnPosition: playerPosition.clone(),
    eyeHeight: 1.55,
    collisionWorld: { playerRadius: 0.34 },
    reset() { this.position.copy(this.spawnPosition); },
  };
  const receiver = new PlayerCombatDamageReceiver({ player });
  const weaponLoader = makeWeaponLoader();
  const weaponRegistry = new NpcWeaponRegistry({ weaponLoader });
  const runtime = new NpcArmamentRuntime({
    actor,
    creaturePack: makePack(),
    damageReceiverProvider: () => receiver,
    playerProvider: () => player,
    weaponRegistry,
  });
  return { scene, rigRoot, hand, animationController, visualAdapter, actor, player, receiver, runtime, weaponLoader, weaponRegistry };
}

function sample(runtime, controller, hand, time, x) {
  controller.time = time;
  hand.position.x = x;
  hand.updateWorldMatrix(true, true);
  runtime.update(1 / 60);
}

function finish(runtime, controller) {
  controller.time = 1.333333;
  controller.offensiveCompletionCount += 1;
  runtime.update(1 / 60);
}

test('the checked-in fixture is exact Forge-shaped socket and offensive capability', () => {
  const result = capabilities();
  assert.equal(result.attachmentSockets.available, true);
  assert.equal(result.attachmentSockets.sockets.length, 2);
  assert.equal(result.offensiveActions.available, true);
  assert.equal(result.offensiveActions.actions[0].combatActionId, 'humanoid_one_hand_slash_rtl');
  assert.equal(offensivePhaseAtTime(result.offensiveActions.actions[0], 0.2), 'WINDUP');
  assert.equal(offensivePhaseAtTime(result.offensiveActions.actions[0], 0.6), 'ACTIVE');
  assert.equal(offensivePhaseAtTime(result.offensiveActions.actions[0], 0.9), 'RECOVERY');
  assert.equal(offensivePhaseAtTime(result.offensiveActions.actions[0], 1.333333), 'COMPLETE');
});

test('socket import rejects malformed transforms, duplicates, and unsupported parents', () => {
  const invalid = structuredClone(capabilities().attachmentSockets);
  invalid.sockets[1].socketId = invalid.sockets[0].socketId;
  invalid.sockets[1].semanticRole = invalid.sockets[0].semanticRole;
  invalid.sockets[1].parentRuntimeBone = 'invented_hand';
  invalid.sockets[1].localPosition[0] = Number.NaN;
  const result = validateAttachmentSocketCapability(invalid, { supportedBones: forgeFixture.runtimeSkeleton.requiredBones });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /duplicate socket IDs/.test(error)));
  assert.ok(result.errors.some((error) => /duplicate semantic roles/.test(error)));
  assert.ok(result.errors.some((error) => /runtime skeleton/.test(error)));
  assert.ok(result.errors.some((error) => /finite 3-vector/.test(error)));

  const disabledExport = structuredClone(forgeFixture);
  disabledExport.runtimeAttachmentSockets.sockets[0].enabled = false;
  assert.throws(() => capabilities(disabledExport), /must be enabled and exportable/);
});

test('old Forge packs remain valid technical inputs and explicitly degrade unavailable', () => {
  const oldManifest = structuredClone(forgeFixture);
  delete oldManifest.runtimeAttachmentSockets;
  delete oldManifest.runtimeAnimations;
  const result = capabilities(oldManifest, []);
  assert.equal(result.attachmentSockets.available, false);
  assert.equal(result.offensiveActions.available, false);
  assert.deepEqual(result.attachmentSockets.sockets, []);
  assert.deepEqual(result.offensiveActions.actions, []);
});

test('offensive import rejects invalid phases, duplicate identities, unknown clips, and unresolved sockets', () => {
  const invalidPhase = structuredClone(capabilities().offensiveActions);
  invalidPhase.actions[0].phases.active.endSeconds = invalidPhase.actions[0].phases.active.startSeconds;
  assert.equal(validateOffensiveActionCapability(invalidPhase, { approvedClips, availableSocketRoles: ['MAIN_HAND_R'] }).valid, false);

  const duplicate = structuredClone(capabilities().offensiveActions);
  duplicate.actions.push(structuredClone(duplicate.actions[0]));
  const duplicateValidation = validateOffensiveActionCapability(duplicate, { approvedClips, availableSocketRoles: ['MAIN_HAND_R'] });
  assert.ok(duplicateValidation.errors.some((error) => /duplicate combat Action IDs/.test(error)));

  const unknown = structuredClone(forgeFixture);
  unknown.runtimeAnimations.offensiveActions[0].actionName = 'Unknown_Action';
  assert.throws(() => capabilities(unknown), /no runtime clip record/);

  const orphanedClipMetadata = structuredClone(forgeFixture);
  delete orphanedClipMetadata.runtimeAnimations.offensiveActions;
  assert.throws(() => capabilities(orphanedClipMetadata), /without offensiveActions list metadata/);

  const kindMismatch = structuredClone(forgeFixture);
  kindMismatch.runtimeAnimations.clips[0].approvedKind = 'ATTACK_OVERHEAD_ONE_HAND';
  assert.throws(() => capabilities(kindMismatch), /approved kind differs/);

  const failedSidecar = structuredClone(forgeFixture);
  failedSidecar.runtimeAnimations.status = 'FAIL';
  assert.throws(() => capabilities(failedSidecar), /status must be PASS/);

  const unresolved = validateOffensiveActionCapability(capabilities().offensiveActions, { approvedClips, availableSocketRoles: ['MAIN_HAND_L'] });
  assert.ok(unresolved.errors.some((error) => /cannot be resolved/.test(error)));
});

test('weapon and loadout contracts validate and resolve without entering Creature Definitions', () => {
  for (const weapon of [DREADSTONE_MACE_WEAPON, DREADSTONE_SWORD_WEAPON, OLD_WORK_KNIFE_WEAPON]) {
    assert.equal(validateNpcWeaponDefinition(weapon).valid, true);
  }
  assert.equal(validateNpcLoadout(CREATURE_LAB_MACE_LOADOUT).valid, true);
  const malformedWeapon = { ...DREADSTONE_MACE_WEAPON, schema: 'wrong', damage: -1, assetScale: [1, 1, 1] };
  assert.equal(validateNpcWeaponDefinition(malformedWeapon).valid, false);
  const malformedLoadout = { ...CREATURE_LAB_MACE_LOADOUT, offensiveActionIds: ['same', 'same'] };
  assert.equal(validateNpcLoadout(malformedLoadout).valid, false);
  const registry = new NpcWeaponRegistry();
  const resolved = resolveNpcLoadout({ loadout: CREATURE_LAB_MACE_LOADOUT, weaponRegistry: registry, offensiveActions: capabilities().offensiveActions });
  assert.equal(resolved.weapon.weaponId, 'dreadstone_mace');
  assert.deepEqual(resolved.compatibleActions.map((entry) => entry.combatActionId), ['humanoid_one_hand_slash_rtl']);

  const incompatibleWeapon = { ...DREADSTONE_MACE_WEAPON, compatibleSocketRoles: ['MAIN_HAND_L'] };
  const incompatibleRegistry = new NpcWeaponRegistry({ definitions: [incompatibleWeapon] });
  assert.throws(() => resolveNpcLoadout({ loadout: CREATURE_LAB_MACE_LOADOUT, weaponRegistry: incompatibleRegistry, offensiveActions: capabilities().offensiveActions }), /no compatible Forge offensive Action/);
});

test('runtime resolver caches the hand lookup, follows animation, and preserves game-meter weapon size under rig scale', () => {
  const { rigRoot, hand, visualAdapter } = makeActorFixture({ rigScale: 2 });
  const resolver = new RuntimeAttachmentSocketResolver({ visualAdapter });
  const socket = capabilities().attachmentSockets.sockets.find((entry) => entry.semanticRole === 'MAIN_HAND_R');
  const binding = resolver.resolve(socket);
  const weaponRoot = new THREE.Group();
  resolver.attachWeapon(weaponRoot, { position: [0, 0, 0], quaternion: [0, 0, 0, 1] });
  const localStart = new THREE.Vector3(0, 0.67, 0);
  const localEnd = new THREE.Vector3(0, 0.98, 0);
  weaponRoot.updateWorldMatrix(true, true);
  const worldStart = weaponRoot.localToWorld(localStart.clone());
  const worldEnd = weaponRoot.localToWorld(localEnd.clone());
  assert.ok(Math.abs(worldStart.distanceTo(worldEnd) - 0.31) < 1e-6);
  const before = weaponRoot.getWorldPosition(new THREE.Vector3());
  hand.position.x = 1.25;
  rigRoot.updateWorldMatrix(true, true);
  const after = weaponRoot.getWorldPosition(new THREE.Vector3());
  assert.ok(after.x > before.x + 2.4);
  assert.equal(resolver.lookupCount, 1);
  assert.equal(binding.bone, hand);
  resolver.dispose();
  assert.equal(binding.socketFrame.parent, null);

  const missingBoneResolver = new RuntimeAttachmentSocketResolver({ visualAdapter });
  assert.throws(() => missingBoneResolver.resolve({ ...socket, parentRuntimeBone: 'invented_hand' }), /cannot resolve DSB_DAMAGE_RIG bone/);
  missingBoneResolver.dispose();
});

test('authored animation controller plays named offensive clips and exposes actual clip time', () => {
  const root = new THREE.Group();
  const animated = new THREE.Group();
  animated.name = 'body';
  root.add(animated);
  const namesByKind = {
    WALK: 'walk',
    HURT_LEFT: 'hurt_left',
    HURT_RIGHT: 'hurt_right',
    DEATH: 'death',
    ATTACK_SLASH_RTL_ONE_HAND: 'DSB_Attack_Slash_RTL_OneHand_v001',
  };
  const entries = Object.entries(namesByKind).map(([approved_kind, name]) => ({
    name,
    approved_kind,
    frame_start: 0,
    frame_end: 24,
    duration_seconds: 1,
    loop: approved_kind === 'WALK',
    hold_final_pose: approved_kind === 'DEATH',
    return_to_previous_state: approved_kind.startsWith('HURT_') || approved_kind.startsWith('ATTACK_'),
  }));
  const clips = entries.map((entry) => new THREE.AnimationClip(entry.name, 1, [
    new THREE.NumberKeyframeTrack('body.position[x]', [0, 1], [0, 1]),
  ]));
  const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));
  const entriesByKind = new Map();
  for (const entry of entries) {
    if (!entriesByKind.has(entry.approved_kind)) entriesByKind.set(entry.approved_kind, []);
    entriesByKind.get(entry.approved_kind).push(entry);
  }
  const animationPack = {
    entriesByName,
    entriesByKind,
    clipsByName: new Map(clips.map((clip) => [clip.name, clip])),
    ignoredEntries: [],
  };
  const controller = new HumanoidAnimationPackController({
    mixer: new THREE.AnimationMixer(root),
    animationPack,
    manifest: { fps: 24 },
    restPoseClip: clips[0].clone(),
    fadeSeconds: 0,
  });
  const result = controller.playOffensiveAction('DSB_Attack_Slash_RTL_OneHand_v001');
  assert.equal(result.name, 'DSB_Attack_Slash_RTL_OneHand_v001');
  assert.equal(controller.state, HUMANOID_ANIMATION_STATES.attacking);
  controller.update(0.6);
  assert.ok(Math.abs(controller.getActionClipTime(result.name) - 0.6) < 1e-6);
  controller.update(0.5);
  assert.equal(controller.offensiveCompletionCount, 1);
  assert.equal(controller.state, HUMANOID_ANIMATION_STATES.holding);
  controller.dispose();
});

test('armament transforms weapon-local capsule into retained previous/current world capsules', async () => {
  const { runtime, hand } = makeActorFixture();
  assert.equal((await runtime.equip()).accepted, true);
  hand.position.x = -0.5;
  runtime.update();
  const first = runtime.getDiagnostics().currentWorldCapsule;
  hand.position.x = 0.75;
  runtime.update();
  const diagnostics = runtime.getDiagnostics();
  assert.deepEqual(diagnostics.previousWorldCapsule.start, first.start);
  assert.ok(diagnostics.currentWorldCapsule.start[0] > diagnostics.previousWorldCapsule.start[0] + 1.2);
  assert.equal(diagnostics.currentWorldCapsule.radius, DREADSTONE_MACE_WEAPON.attackCapsule.radius);
  runtime.dispose();
});

test('Forge WINDUP and RECOVERY never damage while animated ACTIVE intersection does', async () => {
  const { runtime, hand, animationController, receiver } = makeActorFixture();
  assert.equal((await runtime.equip()).accepted, true);
  assert.equal(runtime.triggerAttack().accepted, true);
  sample(runtime, animationController, hand, 0.2, -1);
  sample(runtime, animationController, hand, 0.3, 1);
  assert.equal(receiver.currentHealth, 100, 'WINDUP crossing must not damage');
  sample(runtime, animationController, hand, 0.5, -1);
  sample(runtime, animationController, hand, 0.6, 1);
  assert.equal(receiver.currentHealth, 66, 'ACTIVE crossing must damage');
  sample(runtime, animationController, hand, 0.9, -1);
  sample(runtime, animationController, hand, 1.1, 1);
  assert.equal(receiver.currentHealth, 66, 'RECOVERY must not add damage');
  runtime.dispose();
});

test('physical miss remains zero damage and commitment does not continuously retarget', async () => {
  const { runtime, hand, animationController, receiver, player } = makeActorFixture({ playerPosition: new THREE.Vector3(0, 1.55, 5) });
  await runtime.equip();
  runtime.triggerAttack();
  const committedTarget = runtime.getDiagnostics().commitment.targetAtCommit;
  player.position.set(8, 1.55, -8);
  sample(runtime, animationController, hand, 0.5, -1);
  sample(runtime, animationController, hand, 0.6, 1);
  assert.equal(receiver.currentHealth, 100);
  assert.deepEqual(runtime.getDiagnostics().commitment.targetAtCommit, committedTarget);
  finish(runtime, animationController);
  assert.equal(runtime.getDiagnostics().outcome, 'miss');
  runtime.dispose();
});

test('one hit per attack remains enforced and separate animated attacks may hit', async () => {
  const { runtime, hand, animationController, receiver } = makeActorFixture();
  await runtime.equip();
  runtime.triggerAttack();
  sample(runtime, animationController, hand, 0.5, -1);
  sample(runtime, animationController, hand, 0.6, 1);
  sample(runtime, animationController, hand, 0.65, -1);
  sample(runtime, animationController, hand, 0.7, 1);
  assert.equal(receiver.currentHealth, 66);
  assert.equal(runtime.getDiagnostics().acceptedPlayerHitCount, 1);
  finish(runtime, animationController);
  assert.equal(runtime.triggerAttack().accepted, true);
  sample(runtime, animationController, hand, 0.5, -1);
  sample(runtime, animationController, hand, 0.6, 1);
  assert.equal(receiver.currentHealth, 32);
  assert.equal(runtime.getDiagnostics().acceptedPlayerHitCount, 2);
  runtime.dispose();
});

test('same body can switch to a distinct compatible game-owned loadout', async () => {
  const blade = {
    ...structuredClone(DREADSTONE_MACE_WEAPON),
    schema: NPC_WEAPON_SCHEMA,
    weaponId: 'lab_training_blade',
    displayName: 'Lab Training Blade',
    weaponClass: 'ONE_HAND_BLADE',
    assetPath: '/assets/weapons/melee/lab_training_blade_fixture.glb',
    damageType: 'slash',
  };
  const registry = new NpcWeaponRegistry({
    definitions: [DREADSTONE_MACE_WEAPON, blade],
    weaponLoader: makeWeaponLoader(),
  });
  const { actor, receiver, player } = makeActorFixture();
  const bladeLoadout = {
    schema: NPC_LOADOUT_SCHEMA,
    loadoutId: 'lab_training_blade_loadout',
    mainHandWeaponId: 'lab_training_blade',
    offensiveActionIds: ['humanoid_one_hand_slash_rtl'],
  };
  const runtime = new NpcArmamentRuntime({ actor, creaturePack: makePack(), loadout: bladeLoadout, weaponRegistry: registry, damageReceiverProvider: () => receiver, playerProvider: () => player });
  assert.equal((await runtime.equip()).accepted, true);
  assert.equal(runtime.getDiagnostics().weaponId, 'lab_training_blade');
  runtime.setLoadout(CREATURE_LAB_MACE_LOADOUT);
  assert.equal((await runtime.equip()).accepted, true);
  assert.equal(runtime.getDiagnostics().weaponId, 'dreadstone_mace');
  runtime.dispose();
});

test('unequip, actor death, definition switch, and disposal remove attachment/runtime state', async () => {
  const fixture = makeActorFixture();
  const { runtime, actor, hand } = fixture;
  await runtime.equip();
  assert.ok(hand.children.some((child) => child.name.startsWith('DSB_RuntimeSocket_')));
  assert.equal(runtime.unequip().wasEquipped, true);
  assert.equal(hand.children.some((child) => child.name.startsWith('DSB_RuntimeSocket_')), false);
  await runtime.equip();
  actor.lifeState = 'dead';
  runtime.update();
  assert.equal(runtime.getDiagnostics().equipped, false);
  assert.equal(runtime.getDiagnostics().lastClearReason, 'actor-death-or-disposal');
  runtime.dispose();
  assert.equal(runtime.disposed, true);

  const replacement = makeActorFixture();
  await replacement.runtime.equip();
  replacement.runtime.dispose();
  assert.equal(replacement.hand.children.some((child) => child.name.startsWith('DSB_RuntimeSocket_')), false, 'definition switch disposal must remove attachment');
});

test('legacy generated production packs remain valid with unavailable armament capabilities', () => {
  for (const name of ['chezwick_damage_v001', 'dreadguard_damage_v001']) {
    const pack = JSON.parse(readFileSync(new URL(`../public/generated/creature-packs/${name}.json`, import.meta.url), 'utf8'));
    assert.equal(pack.capabilities.attachmentSockets, false);
    assert.equal(pack.capabilities.offensiveActions, false);
    assert.equal(pack.attachmentSockets.available, false);
    assert.equal(pack.offensiveActions.available, false);
  }
});

test('Dread Ram God exposes its real Forge hand sockets and overhead offensive Action', () => {
  const pack = JSON.parse(readFileSync(new URL('../public/generated/creature-packs/dread_ram_god_damage_v001.json', import.meta.url), 'utf8'));
  assert.equal(pack.capabilities.attachmentSockets, true);
  assert.equal(pack.attachmentSockets.available, true);
  assert.equal(pack.attachmentSockets.sockets.length, 2);
  assert.equal(pack.capabilities.offensiveActions, true);
  assert.equal(pack.offensiveActions.available, true);
  assert.deepEqual(pack.offensiveActions.actions.map((action) => action.combatActionId), ['humanoid_one_hand_overhead']);
});
