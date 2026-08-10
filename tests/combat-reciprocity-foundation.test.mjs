import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {
  PHYSICAL_ATTACK_PHASES,
  PhysicalAttackLifecycle,
  PhysicalAttackSource,
  intersectSweptCapsules,
} from '../src/game/combat/PhysicalAttackSource.js';
import { PlayerCombatDamageReceiver } from '../src/game/combat/PlayerCombatDamageReceiver.js';
import { CreatureLabAttackHarness } from '../src/game/creatures/CreatureLabAttackHarness.js';
import { getCreatureLabOffensiveCombatActions } from '../src/game/creatures/CreatureLabPanel.js';
import { resolveCreatureLabMode } from '../src/game/creatures/CreatureLabController.js';

const crossingShapeLeft = { start: new THREE.Vector3(-1, 1, 0), end: new THREE.Vector3(-0.8, 1, 0), radius: 0.1 };
const crossingShapeRight = { start: new THREE.Vector3(0.8, 1, 0), end: new THREE.Vector3(1, 1, 0), radius: 0.1 };
const playerCapsule = { start: new THREE.Vector3(0, 0.3, 0), end: new THREE.Vector3(0, 1.6, 0), radius: 0.3 };

function impact(identity, damageAmount = 34) {
  return {
    source: 'test-source',
    damageAmount,
    damageType: 'blunt',
    impactPoint: new THREE.Vector3(0, 1, 0),
    impactDirection: new THREE.Vector3(1, 0, 0),
    impactStrength: 0.8,
    attackIdentity: identity,
  };
}

function prepareCrossingSource(source, identity) {
  source.beginAttack(identity);
  source.setPhase(PHYSICAL_ATTACK_PHASES.active);
  source.updateShape(crossingShapeLeft);
  source.updateShape(crossingShapeRight);
}

test('attack lifecycle exposes deterministic WINDUP, ACTIVE, RECOVERY, and COMPLETE transitions', () => {
  const lifecycle = new PhysicalAttackLifecycle({ phaseDurations: {
    WINDUP: 0.5,
    ACTIVE: 0.25,
    RECOVERY: 0.4,
  } });
  assert.equal(lifecycle.getState().phase, PHYSICAL_ATTACK_PHASES.complete);
  assert.equal(lifecycle.trigger({ attackIdentity: 'swing-1' }).accepted, true);
  assert.equal(lifecycle.update(0.49).phase, PHYSICAL_ATTACK_PHASES.windup);
  assert.equal(lifecycle.update(0.02).phase, PHYSICAL_ATTACK_PHASES.active);
  assert.equal(lifecycle.update(0.25).phase, PHYSICAL_ATTACK_PHASES.recovery);
  assert.equal(lifecycle.update(0.4).phase, PHYSICAL_ATTACK_PHASES.complete);
  assert.equal(lifecycle.getState().attackIdentity, 'swing-1');
});

test('physical attack source rejects windup and recovery even when geometry crosses the hurt volume', () => {
  let received = 0;
  const receiver = { receiveCombatImpact: () => { received += 1; return { accepted: true }; } };
  const source = new PhysicalAttackSource();
  source.beginAttack('phase-gate');
  source.updateShape(crossingShapeLeft);
  source.updateShape(crossingShapeRight);
  assert.equal(source.tryHit({ hurtVolume: playerCapsule, receiver }).reason, 'phase-windup');
  source.setPhase(PHYSICAL_ATTACK_PHASES.recovery);
  assert.equal(source.tryHit({ hurtVolume: playerCapsule, receiver }).reason, 'phase-recovery');
  assert.equal(received, 0);
});

test('swept capsule catches a fast crossing and preserves a spatial miss', () => {
  const hit = intersectSweptCapsules(crossingShapeLeft, crossingShapeRight, playerCapsule);
  assert.equal(hit.intersects, true);
  assert.ok(hit.targetPoint.toArray().every(Number.isFinite));
  const miss = intersectSweptCapsules(
    { ...crossingShapeLeft, start: crossingShapeLeft.start.clone().setZ(2), end: crossingShapeLeft.end.clone().setZ(2) },
    { ...crossingShapeRight, start: crossingShapeRight.start.clone().setZ(2), end: crossingShapeRight.end.clone().setZ(2) },
    playerCapsule,
  );
  assert.equal(miss.intersects, false);
  assert.equal(miss.reason, 'physical-miss');
});

test('one attack hits once, while a separate attack identity can hit independently', () => {
  const receiver = new PlayerCombatDamageReceiver();
  const source = new PhysicalAttackSource({ damageAmount: 10 });
  prepareCrossingSource(source, 'swing-1');
  assert.equal(source.tryHit({ hurtVolume: playerCapsule, receiver }).accepted, true);
  assert.equal(source.tryHit({ hurtVolume: playerCapsule, receiver }).reason, 'target-already-hit-this-attack');
  assert.equal(receiver.currentHealth, 90);
  prepareCrossingSource(source, 'swing-2');
  assert.equal(source.tryHit({ hurtVolume: playerCapsule, receiver }).accepted, true);
  assert.equal(receiver.currentHealth, 80);
  assert.equal(source.getDiagnostics().acceptedHitCount, 2);
});

test('player receiver applies authoritative HP, finite impact data, lethal damage, feedback, and identity reset', () => {
  const vitals = [];
  let flashes = 0;
  let shakes = 0;
  let deaths = 0;
  const receiver = new PlayerCombatDamageReceiver({
    hudHost: { updateVitals: (value) => vitals.push(value), hud: { flashDamage: () => { flashes += 1; } } },
    feedback: { shake: () => { shakes += 1; } },
    onDeath: () => { deaths += 1; },
  });
  assert.equal(receiver.receiveCombatImpact(impact('lethal-1')).currentHealth, 66);
  assert.equal(receiver.receiveCombatImpact(impact('lethal-2')).currentHealth, 32);
  const lethal = receiver.receiveCombatImpact(impact('lethal-3'));
  assert.equal(lethal.lethal, true);
  assert.equal(receiver.currentHealth, 0);
  assert.equal(deaths, 1);
  assert.equal(flashes, 3);
  assert.equal(shakes, 3);
  assert.deepEqual(vitals.at(-1), { hp: 0 });
  assert.ok(receiver.getDiagnostics().lastImpact.impactPoint.every(Number.isFinite));
  assert.equal(receiver.receiveCombatImpact(impact('after-death')).reason, 'player-already-dead');
  receiver.reset();
  assert.equal(receiver.receiveCombatImpact(impact('lethal-1', 5)).accepted, true, 'reset clears stale attack identity ownership');
  assert.equal(receiver.receiveCombatImpact({ ...impact('bad-vector'), impactPoint: new THREE.Vector3(Number.NaN, 0, 0) }).reason, 'invalid-impact-data');
});

function createHarnessFixture() {
  const scene = new THREE.Scene();
  const spawn = new THREE.Vector3(0, 1.55, -1.4);
  const player = {
    position: spawn.clone(),
    spawnPosition: spawn.clone(),
    eyeHeight: 1.55,
    collisionWorld: { playerRadius: 0.34 },
    reset() { this.position.copy(this.spawnPosition); },
  };
  const receiver = new PlayerCombatDamageReceiver({ player });
  const actor = {
    instanceId: 'lab-subject-a',
    lifeState: 'alive',
    disposed: false,
    spawnYaw: Math.PI,
    root: new THREE.Group(),
    getBodyWorldPosition: () => new THREE.Vector3(0, 1.1, 0),
  };
  const harness = new CreatureLabAttackHarness({
    scene,
    playerProvider: () => player,
    damageReceiverProvider: () => receiver,
  });
  harness.setSubject(actor);
  return { scene, player, receiver, actor, harness };
}

function runAttackToCompletion(harness) {
  assert.equal(harness.triggerAttack().accepted, true);
  for (let frame = 0; frame < 100 && harness.lifecycle.getState().phase !== PHYSICAL_ATTACK_PHASES.complete; frame += 1) harness.update(1 / 60);
  return harness.getDiagnostics();
}

test('lab harness visibly drives committed hit, miss, repeat-hit, lethal, reset, and cleanup proofs', () => {
  const { scene, player, receiver, actor, harness } = createHarnessFixture();
  harness.toggleAttackGeometry();
  let diagnostics = runAttackToCompletion(harness);
  assert.equal(diagnostics.outcome, 'hit');
  assert.equal(diagnostics.acceptedPlayerHitCount, 1);
  assert.equal(receiver.currentHealth, 66);

  player.position.set(0, 1.55, -4);
  diagnostics = runAttackToCompletion(harness);
  assert.equal(diagnostics.outcome, 'miss');
  assert.equal(receiver.currentHealth, 66);

  player.position.copy(player.spawnPosition);
  diagnostics = runAttackToCompletion(harness);
  assert.equal(diagnostics.outcome, 'hit');
  diagnostics = runAttackToCompletion(harness);
  assert.equal(diagnostics.playerDead, true);
  assert.equal(receiver.currentHealth, 0);
  assert.equal(diagnostics.acceptedPlayerHitCount, 3);

  assert.equal(harness.resetPlayer().accepted, true);
  assert.equal(receiver.currentHealth, 100);
  assert.equal(harness.getDiagnostics().attackId, null);
  assert.equal(harness.getDiagnostics().acceptedPlayerHitCount, 0);

  harness.setSubject({ ...actor, instanceId: 'lab-subject-b' });
  diagnostics = harness.getDiagnostics();
  assert.equal(diagnostics.subjectInstanceId, 'lab-subject-b');
  assert.equal(diagnostics.attackId, null);
  assert.equal(diagnostics.acceptedPlayerHitCount, 0);
  assert.equal(receiver.getDiagnostics().retainedAttackIdentityCount, 0);
  assert.equal(receiver.currentHealth, 100);
  assert.equal(receiver.getDiagnostics().lastImpact, null);

  const presentation = harness.presentation;
  harness.dispose();
  assert.equal(harness.disposed, true);
  assert.equal(harness.source.disposed, true);
  assert.equal(scene.children.includes(presentation), false);
});

test('moving away after windup commitment produces zero damage when ACTIVE sweep misses', () => {
  const { player, receiver, harness } = createHarnessFixture();
  assert.equal(harness.triggerAttack().accepted, true);
  harness.update(0.3);
  player.position.set(4, 1.55, 4);
  for (let frame = 0; frame < 100 && harness.lifecycle.getState().phase !== PHYSICAL_ATTACK_PHASES.complete; frame += 1) harness.update(1 / 60);
  assert.equal(harness.getDiagnostics().outcome, 'miss');
  assert.equal(receiver.currentHealth, 100);
  harness.dispose();
});

test('touch-first offensive controls require no console access', async () => {
  const calls = [];
  const controller = {
    triggerAttack: () => calls.push('triggerAttack'),
    resetPlayer: () => calls.push('resetPlayer'),
    toggleAttackGeometry: () => calls.push('toggleAttackGeometry'),
  };
  const actions = getCreatureLabOffensiveCombatActions(controller, { offensiveCombat: { showAttackGeometry: false } });
  assert.deepEqual(actions.map((action) => action.label), ['Trigger Attack', 'Reset Player', 'Show Attack Geometry']);
  for (const action of actions) await action.run();
  assert.deepEqual(calls, ['triggerAttack', 'resetPlayer', 'toggleAttackGeometry']);
});

test('combat reciprocity activates only for explicit Creature Lab and leaves canonical Folsom gated', () => {
  assert.equal(resolveCreatureLabMode(new URLSearchParams('creatureLab=1')), true);
  assert.equal(resolveCreatureLabMode(new URLSearchParams()), false);
  const gameSource = readFileSync(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const encounterSource = readFileSync(new URL('../src/game/combat/FolsomCombatEncounter.js', import.meta.url), 'utf8');
  assert.match(gameSource, /this\.playerCombatDamageReceiver = this\.creatureLabEnabled \? new PlayerCombatDamageReceiver/);
  assert.match(encounterSource, /this\.creatureLabAttackHarness = this\.creatureLabEnabled \? new CreatureLabAttackHarness/);
  assert.doesNotMatch(encounterSource, /this\.showcaseEnabled[^\n]+CreatureLabAttackHarness/);
});

test('physical attack source disposal clears shapes, ownership, and rejects later contact', () => {
  const source = new PhysicalAttackSource();
  prepareCrossingSource(source, 'dispose-me');
  source.dispose();
  const diagnostics = source.getDiagnostics();
  assert.equal(diagnostics.disposed, true);
  assert.equal(diagnostics.hasPreviousShape, false);
  assert.equal(diagnostics.hasCurrentShape, false);
  assert.equal(source.tryHit({ hurtVolume: playerCapsule, receiver: { receiveCombatImpact: () => ({ accepted: true }) } }).reason, 'attack-source-disposed');
});
