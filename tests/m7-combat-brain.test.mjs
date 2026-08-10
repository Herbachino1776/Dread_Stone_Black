import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { FirstPersonViewmodelHost } from '../src/game/hosts/FirstPersonViewmodelHost.js';
import { MinimalCombatBrain, MINIMAL_COMBAT_BRAIN_STATES } from '../src/game/combat/MinimalCombatBrain.js';
import { NpcArmamentRuntime } from '../src/game/combat/NpcArmamentRuntime.js';
import { PlayerCombatDamageReceiver } from '../src/game/combat/PlayerCombatDamageReceiver.js';
import { PlayerCombatState } from '../src/game/combat/PlayerCombatState.js';
import { PHYSICAL_ATTACK_PHASES, PhysicalAttackSource } from '../src/game/combat/PhysicalAttackSource.js';
import { EnemyPresetResolver } from '../src/game/creatures/EnemyPresetResolver.js';
import { getCreatureLabOffensiveCombatActions } from '../src/game/creatures/CreatureLabPanel.js';

const ACTION = Object.freeze({
  actionName: 'DSB_Attack_Overhead_OneHand_v001',
  combatActionId: 'humanoid_one_hand_overhead',
  clipDurationSeconds: 1,
  commitment: Object.freeze({ timeSeconds: 0.5, lockOrientationThroughActive: true }),
  phases: Object.freeze({
    windup: Object.freeze({ startSeconds: 0, endSeconds: 0.5 }),
    active: Object.freeze({ startSeconds: 0.5, endSeconds: 0.7 }),
    recovery: Object.freeze({ startSeconds: 0.7, endSeconds: 1 }),
  }),
});

const MACE = Object.freeze({
  weaponId: 'dreadstone_mace',
  assetScale: 1.41,
  gripTransform: Object.freeze({ position: Object.freeze([0.005, 0.085, -0.015]), quaternion: Object.freeze([Math.SQRT1_2, 0, 0, Math.SQRT1_2]) }),
  attackCapsule: Object.freeze({ start: Object.freeze([0, 0, -0.48]), end: Object.freeze([0, 0, -0.29]), radius: 0.13 }),
});

class FakeArmamentRuntime {
  constructor({ autoAdvance = true } = {}) {
    this.autoAdvance = autoAdvance;
    this.clipTime = 0;
    this.equipCount = 0;
    this.selectCount = 0;
    this.triggerCount = 0;
    this.updateCount = 0;
    this.unequipCount = 0;
    this.resetCount = 0;
    this.outcome = 'idle';
    this.activeAttack = null;
    this.selectedAction = null;
    this.animationController = { getActionClipTime: () => this.clipTime };
  }

  setCalibrationOverride(calibration) {
    this.calibration = structuredClone(calibration);
    return { accepted: true };
  }

  async equip() {
    this.equipCount += 1;
    this.equipped = true;
    return { accepted: true, weaponId: 'dreadstone_mace' };
  }

  selectOffensiveAction(combatActionId) {
    this.selectCount += 1;
    if (combatActionId !== ACTION.combatActionId) return { accepted: false, reason: 'unavailable' };
    this.selectedAction = ACTION;
    return { accepted: true, combatActionId };
  }

  triggerAttack() {
    if (this.activeAttack) return { accepted: false, reason: 'attack-already-running' };
    this.triggerCount += 1;
    this.clipTime = 0;
    this.activeAttack = { identity: `fake:${this.triggerCount}`, action: ACTION, phase: PHYSICAL_ATTACK_PHASES.windup };
    this.outcome = 'pending';
    return { accepted: true, attackIdentity: this.activeAttack.identity };
  }

  update(deltaSeconds) {
    this.updateCount += 1;
    if (!this.activeAttack || !this.autoAdvance) return;
    this.clipTime += deltaSeconds;
    this.activeAttack.phase = this.clipTime < 0.5 ? PHYSICAL_ATTACK_PHASES.windup
      : this.clipTime < 0.7 ? PHYSICAL_ATTACK_PHASES.active
        : this.clipTime < 1 ? PHYSICAL_ATTACK_PHASES.recovery : PHYSICAL_ATTACK_PHASES.complete;
    if (this.clipTime >= 1) {
      this.activeAttack = null;
      this.outcome = 'miss';
    }
  }

  resetCombatState() {
    this.resetCount += 1;
    this.activeAttack = null;
    this.clipTime = 0;
    this.outcome = 'idle';
    return { accepted: true };
  }

  unequip() {
    this.unequipCount += 1;
    this.equipped = false;
    this.activeAttack = null;
    return { accepted: true };
  }

  getDiagnostics() {
    return {
      weaponId: this.equipped ? 'dreadstone_mace' : null,
      combatActionId: this.selectedAction?.combatActionId ?? null,
      attackPhase: this.activeAttack?.phase ?? PHYSICAL_ATTACK_PHASES.complete,
      outcome: this.outcome,
    };
  }
}

function makeBrainFixture({ playerPosition = new THREE.Vector3(10, 1.55, 0), autoAdvance = true } = {}) {
  const movementSamples = [];
  const actor = {
    lifeState: 'alive',
    disposed: false,
    visualRootPosition: new THREE.Vector3(0, 0, 0),
    visualRootYaw: 0,
    visualAdapter: {
      setMovementState(movement) { movementSamples.push({ ...movement }); return true; },
    },
    setLivingRootTransform(position, yaw, velocity) {
      this.visualRootPosition.copy(position);
      this.visualRootYaw = yaw;
      this.velocity = velocity?.clone?.() ?? new THREE.Vector3();
      return true;
    },
  };
  const player = { position: playerPosition.clone() };
  const playerCombatState = new PlayerCombatState();
  const armament = new FakeArmamentRuntime({ autoAdvance });
  const brain = new MinimalCombatBrain({
    actor,
    armamentRuntime: armament,
    playerProvider: () => player,
    playerCombatState,
    homePosition: actor.visualRootPosition,
    homeYaw: 0,
    approvedActionId: ACTION.combatActionId,
    resolvedWeapon: MACE,
    bodyHeight: 2.1,
    config: {
      detectionRange: 5,
      disengageRange: 7,
      homeLeashRadius: 8,
      approachSpeed: 2,
      returnSpeed: 2,
      turnRateRadians: 20,
      readySeconds: 0.01,
      recoverySeconds: 0.05,
    },
  });
  return { actor, player, playerCombatState, armament, brain, movementSamples };
}

function tickUntil(brain, predicate, { maximumTicks = 240, deltaSeconds = 0.05 } = {}) {
  for (let tick = 0; tick < maximumTicks; tick += 1) {
    brain.update(deltaSeconds);
    if (predicate()) return tick + 1;
  }
  assert.fail(`Brain did not reach expected state from ${brain.state}`);
}

function validImpact(attackIdentity, damageAmount = 34) {
  return {
    source: 'm7-test-mace',
    damageAmount,
    damageType: 'heavy-blunt',
    impactPoint: new THREE.Vector3(0, 1, 0),
    impactDirection: new THREE.Vector3(0, 0, 1),
    impactStrength: 0.82,
    attackIdentity,
  };
}

test('PlayerCombatState is the sole mutable HP/death owner behind the receiver adapter', () => {
  assert.throws(() => new PlayerCombatDamageReceiver(), /requires the game-owned PlayerCombatState/);
  const state = new PlayerCombatState();
  const receiver = new PlayerCombatDamageReceiver({ combatState: state, player: { position: new THREE.Vector3(0, 1.55, 0), eyeHeight: 1.55 } });
  assert.equal(Object.hasOwn(receiver, 'currentHealth'), false);
  assert.equal(Object.hasOwn(receiver, 'maximumHealth'), false);
  assert.equal(Object.hasOwn(receiver, 'dead'), false);
  assert.equal(receiver.combatState, state);
  assert.equal(receiver.receiveCombatImpact(validImpact('one')).accepted, true);
  assert.equal(receiver.receiveCombatImpact(validImpact('one')).reason, 'attack-already-accepted');
  assert.equal(state.currentHealth, 66);
  assert.equal(receiver.currentHealth, 66);
  receiver.dispose();
});

test('receiver preserves attack identity dedupe while routing lethal transition exactly once', () => {
  const state = new PlayerCombatState();
  const events = [];
  state.subscribe((_snapshot, event) => events.push(event.type), { emitCurrent: false });
  const receiver = new PlayerCombatDamageReceiver({ combatState: state, player: { position: new THREE.Vector3(0, 1.55, 0), eyeHeight: 1.55 } });
  assert.equal(receiver.receiveCombatImpact(validImpact('lethal', 100)).lethal, true);
  assert.equal(receiver.receiveCombatImpact(validImpact('lethal', 100)).reason, 'player-already-dead');
  assert.equal(receiver.receiveCombatImpact(validImpact('future', 10)).reason, 'player-already-dead');
  assert.equal(events.filter((type) => type === 'death').length, 1);
  assert.equal(state.deathTransitionCount, 1);
  assert.equal(receiver.acceptedImpactCount, 1);
  receiver.dispose();
});

test('authoritative reset restores HP/alive, HUD subscription, receiver ownership, and living input gate', () => {
  const state = new PlayerCombatState();
  const hpUpdates = [];
  state.subscribe((snapshot) => hpUpdates.push(snapshot.currentHealth));
  const receiver = new PlayerCombatDamageReceiver({ combatState: state, player: { position: new THREE.Vector3(0, 1.55, 0), eyeHeight: 1.55 } });
  const host = new FirstPersonViewmodelHost({ playerCombatState: state });
  let toolCancelCount = 0;
  let weaponCancelCount = 0;
  host.physicalToolActionController = { cancelGesture: () => { toolCancelCount += 1; } };
  host.combatWeaponController = { cancel: () => { weaponCancelCount += 1; } };
  const unsubscribe = state.subscribe((snapshot) => host.setLivingPlayerEnabled(snapshot.alive));
  receiver.receiveCombatImpact(validImpact('death', 100));
  assert.equal(host.isLivingPlayerEnabled(), false);
  assert.equal(toolCancelCount, 1);
  assert.equal(weaponCancelCount, 1);
  receiver.clearAttackOwnership();
  state.reset({ reason: 'test-reset' });
  assert.equal(state.currentHealth, 100);
  assert.equal(state.isAlive, true);
  assert.equal(host.isLivingPlayerEnabled(), true);
  assert.equal(receiver.acceptedAttackIdentities.size, 0);
  assert.deepEqual(hpUpdates.slice(-2), [0, 100]);
  unsubscribe();
  receiver.dispose();
});

test('brain stays idle without a target, then acquires and approaches a valid living player', async () => {
  const fixture = makeBrainFixture();
  const enabled = await fixture.brain.enable();
  assert.equal(enabled.accepted, true);
  assert.equal(fixture.armament.equipCount, 1);
  assert.equal(fixture.armament.selectCount, 1);
  assert.equal(fixture.armament.calibration.assetScale, 1.41);
  fixture.brain.update(0.05);
  assert.equal(fixture.brain.state, MINIMAL_COMBAT_BRAIN_STATES.idle);
  fixture.player.position.set(4, 1.55, 0);
  fixture.brain.update(0.05);
  assert.equal(fixture.brain.state, MINIMAL_COMBAT_BRAIN_STATES.acquire);
  fixture.brain.update(0.05);
  assert.equal(fixture.brain.state, MINIMAL_COMBAT_BRAIN_STATES.approach);
  const before = fixture.actor.visualRootPosition.x;
  fixture.brain.update(0.05);
  assert.ok(fixture.actor.visualRootPosition.x > before);
  assert.equal(fixture.movementSamples.at(-1).walking, true);
});

test('brain stops in geometry-derived range, selects the approved Action, and triggers only through armament', async () => {
  const fixture = makeBrainFixture({ playerPosition: new THREE.Vector3(4, 1.55, 0) });
  await fixture.brain.enable();
  tickUntil(fixture.brain, () => fixture.brain.state === MINIMAL_COMBAT_BRAIN_STATES.ready);
  assert.ok(fixture.brain.targetDistance <= fixture.brain.attackRange + 0.001);
  assert.equal(fixture.armament.selectedAction.combatActionId, ACTION.combatActionId);
  tickUntil(fixture.brain, () => fixture.brain.state === MINIMAL_COMBAT_BRAIN_STATES.attacking);
  assert.equal(fixture.armament.triggerCount, 1);
  assert.equal(fixture.playerCombatState.currentHealth, 100, 'brain must never mutate player HP');
  for (let index = 0; index < 8; index += 1) fixture.brain.update(0.05);
  assert.equal(fixture.armament.triggerCount, 1, 'active attack blocks overlapping trigger requests');
});

test('authored attack completes before brain recovery permits another request', async () => {
  const fixture = makeBrainFixture({ playerPosition: new THREE.Vector3(1.2, 1.55, 0) });
  await fixture.brain.enable();
  tickUntil(fixture.brain, () => fixture.brain.state === MINIMAL_COMBAT_BRAIN_STATES.attacking);
  tickUntil(fixture.brain, () => fixture.brain.state === MINIMAL_COMBAT_BRAIN_STATES.recovery);
  assert.equal(fixture.armament.triggerCount, 1);
  fixture.brain.update(0.025);
  assert.equal(fixture.brain.state, MINIMAL_COMBAT_BRAIN_STATES.recovery);
  tickUntil(fixture.brain, () => fixture.armament.triggerCount === 2);
  assert.equal(fixture.armament.triggerCount, 2);
});

test('authored commitment locks facing so a post-commit target move cannot home the strike', async () => {
  const fixture = makeBrainFixture({ playerPosition: new THREE.Vector3(0, 1.55, 1.2), autoAdvance: false });
  await fixture.brain.enable();
  tickUntil(fixture.brain, () => fixture.brain.state === MINIMAL_COMBAT_BRAIN_STATES.attacking);
  fixture.player.position.set(1.2, 1.55, 0);
  fixture.armament.clipTime = 0.25;
  fixture.brain.update(0.05);
  const trackedYaw = fixture.brain.currentYaw;
  assert.notEqual(trackedYaw, 0);
  fixture.armament.clipTime = ACTION.commitment.timeSeconds;
  fixture.brain.update(0.05);
  const committedYaw = fixture.brain.currentYaw;
  assert.equal(fixture.brain.orientationLocked, true);
  fixture.player.position.set(-1.2, 1.55, 0);
  fixture.brain.update(0.05);
  assert.equal(fixture.brain.currentYaw, committedYaw);
});

test('player death prevents new attacks while an already-started attack may finish visually', async () => {
  const fixture = makeBrainFixture({ playerPosition: new THREE.Vector3(1.2, 1.55, 0) });
  await fixture.brain.enable();
  tickUntil(fixture.brain, () => fixture.brain.state === MINIMAL_COMBAT_BRAIN_STATES.attacking);
  fixture.playerCombatState.applyDamage({ amount: 100, source: 'test' });
  tickUntil(fixture.brain, () => !fixture.armament.activeAttack);
  for (let index = 0; index < 60; index += 1) fixture.brain.update(0.05);
  assert.equal(fixture.armament.triggerCount, 1);
  assert.equal(fixture.brain.targetAcquired, false);
});

test('enemy death and brain disposal stop pursuit, clear armament, and release ownership', async () => {
  const fixture = makeBrainFixture({ playerPosition: new THREE.Vector3(3, 1.55, 0) });
  await fixture.brain.enable();
  fixture.brain.update(0.05);
  fixture.actor.lifeState = 'dead';
  fixture.brain.update(0.05);
  assert.equal(fixture.brain.enabled, false);
  assert.equal(fixture.armament.unequipCount, 1);
  fixture.brain.dispose();
  assert.equal(fixture.brain.disposed, true);
  assert.ok(fixture.armament.unequipCount >= 2);
});

test('bounded leash returns the enemy home without teleporting and settles to idle', async () => {
  const fixture = makeBrainFixture({ playerPosition: new THREE.Vector3(3, 1.55, 0) });
  await fixture.brain.enable();
  tickUntil(fixture.brain, () => fixture.brain.state === MINIMAL_COMBAT_BRAIN_STATES.approach);
  for (let index = 0; index < 6; index += 1) fixture.brain.update(0.05);
  assert.ok(fixture.actor.visualRootPosition.length() > 0.2);
  fixture.player.position.set(20, 1.55, 0);
  fixture.brain.update(0.05);
  assert.equal(fixture.brain.state, MINIMAL_COMBAT_BRAIN_STATES.returnHome);
  tickUntil(fixture.brain, () => fixture.brain.state === MINIMAL_COMBAT_BRAIN_STATES.idle);
  assert.ok(fixture.actor.visualRootPosition.distanceTo(new THREE.Vector3()) <= fixture.brain.config.returnHomeTolerance + 0.001);
});

test('post-commit movement can physically miss and one accepted attack identity cannot multi-hit', () => {
  const player = { position: new THREE.Vector3(0, 1.55, 0), eyeHeight: 1.55 };
  const state = new PlayerCombatState();
  const receiver = new PlayerCombatDamageReceiver({ combatState: state, player });
  const source = new PhysicalAttackSource({ source: 'mace', damageAmount: 34, damageType: 'heavy-blunt', impactStrength: 0.82 });
  source.beginAttack('swing-hit');
  source.setPhase(PHYSICAL_ATTACK_PHASES.active);
  source.updateShape({ start: new THREE.Vector3(-1, 0.5, 0), end: new THREE.Vector3(-1, 1.4, 0), radius: 0.2 });
  source.updateShape({ start: new THREE.Vector3(0, 0.5, 0), end: new THREE.Vector3(0, 1.4, 0), radius: 0.2 });
  assert.equal(source.tryHit({ targetId: 'player', hurtVolume: receiver.getHurtVolume(), receiver, impactDirection: new THREE.Vector3(1, 0, 0) }).accepted, true);
  assert.equal(source.tryHit({ targetId: 'player', hurtVolume: receiver.getHurtVolume(), receiver, impactDirection: new THREE.Vector3(1, 0, 0) }).reason, 'target-already-hit-this-attack');
  assert.equal(state.currentHealth, 66);

  source.beginAttack('swing-miss');
  source.setPhase(PHYSICAL_ATTACK_PHASES.active);
  source.updateShape({ start: new THREE.Vector3(-1, 0.5, 0), end: new THREE.Vector3(-1, 1.4, 0), radius: 0.2 });
  player.position.set(5, 1.55, 0);
  source.updateShape({ start: new THREE.Vector3(0, 0.5, 0), end: new THREE.Vector3(0, 1.4, 0), radius: 0.2 });
  assert.equal(source.tryHit({ targetId: 'player', hurtVolume: receiver.getHurtVolume(), receiver, impactDirection: new THREE.Vector3(1, 0, 0) }).reason, 'physical-miss');
  assert.equal(state.currentHealth, 66);
  source.dispose();
  receiver.dispose();
});

test('Ram God Great Mace preset resolves real loadout/socket/Action and calibration reaches armament immutably', async () => {
  const ramGodPack = JSON.parse(await readFile(new URL('../public/generated/creature-packs/dread_ram_god_damage_v001.json', import.meta.url), 'utf8'));
  const resolver = new EnemyPresetResolver({
    creaturePackRegistry: {
      async loadPack(packId) {
        if (packId !== ramGodPack.packId) throw new Error(`Unexpected pack ${packId}`);
        return ramGodPack;
      },
    },
  });
  const canonicalBefore = structuredClone(resolver.weaponRegistry.require('dreadstone_mace'));
  const resolved = await resolver.resolve('dread_ram_god_great_mace');
  assert.equal(resolved.definition.definitionId, 'dread_ram_god');
  assert.equal(resolved.loadout.mainHandWeaponId, 'dreadstone_mace');
  assert.equal(resolved.attachmentSocket.semanticRole, 'MAIN_HAND_R');
  assert.deepEqual(resolved.compatibleActions.map((action) => action.combatActionId), ['humanoid_one_hand_overhead']);
  const runtime = new NpcArmamentRuntime({ creaturePack: resolved.pack, loadout: resolved.loadout, weaponRegistry: resolver.weaponRegistry });
  assert.equal(runtime.setCalibrationOverride(resolved.weapon).accepted, true);
  assert.equal(runtime.getDiagnostics().assetScale, 1.41);
  assert.deepEqual(resolver.weaponRegistry.require('dreadstone_mace'), canonicalBefore);
  runtime.dispose();
});

test('Creature Lab exposes touch-first M7 ownership/reset controls and disables manual attack conflict', () => {
  const controller = {
    enableCombatBrain() {}, disableCombatBrain() {}, respawn() {}, equipArmament() {}, unequipArmament() {},
    selectOffensiveAction() {}, triggerAttack() {}, resetPlayer() {}, toggleAttackGeometry() {},
  };
  const actions = getCreatureLabOffensiveCombatActions(controller, {
    selectedPresetId: 'dread_ram_god_great_mace',
    selectedWeaponId: 'dreadstone_mace',
    weapons: [{ weaponId: 'dreadstone_mace', displayName: 'Dreadstone Mace' }],
    offensiveCombat: {
      equipped: true,
      combatBrainEnabled: true,
      showAttackGeometry: false,
      compatibleActions: [{ combatActionId: ACTION.combatActionId }],
    },
  });
  assert.deepEqual(actions.slice(0, 3).map((action) => action.label), ['Enable Combat Brain', 'Disable Combat Brain', 'Reset Enemy / Respawn']);
  assert.equal(actions.find((action) => action.id === 'offense:trigger').disabled, true);
  assert.equal(actions.find((action) => action.id === 'offense:action:humanoid_one_hand_overhead').disabled, true);
  assert.equal(actions.find((action) => action.id === 'offense:reset_player').label, 'Reset Player');
});

test('production-neutral brain source contains no HP mutation or collision implementation', async () => {
  const source = await readFile(new URL('../src/game/combat/MinimalCombatBrain.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.applyDamage\s*\(/);
  assert.doesNotMatch(source, /currentHealth\s*=/);
  assert.doesNotMatch(source, /PhysicalAttackSource|receiveCombatImpact/);
});
