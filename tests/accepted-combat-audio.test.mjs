import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import * as THREE from 'three';
import { AUDIO_CUE_MANIFEST } from '../src/game/audio/audioCueManifest.js';
import {
  CombatAcceptedAudioSystem,
  DREADSTONE_SWORD_PIERCING_AUDIO_PROFILE,
  FLESH_STAB_CUE_IDS,
  LETHAL_STAB_DEATH_DELAY_RANGE_SECONDS,
  MALE_HUMAN_DEATH_SIGH_CUE_IDS,
  OLD_WORK_KNIFE_PIERCING_AUDIO_PROFILE,
  createPiercingAudioProfile,
  selectNonRepeatingCue,
} from '../src/game/combat/CombatAcceptedAudioSystem.js';
import { COMBAT_DIRECTOR_EVENTS, CombatDirector } from '../src/game/combat/CombatDirector.js';
import { PenetrationAudioGate } from '../src/game/combat/weapons/PenetrationAudioGate.js';
import { MELEE_INTENTS } from '../src/game/combat/MeleeIntentWeapon.js';
import { CURRENT_HUMANOID_PROFILE, TESTMAN_COMBAT_PROFILE, TESTMAN_DAMAGE_COMBAT_PROFILE } from '../src/game/combat/HumanoidModelProfiles.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const acceptedCueIds = [...FLESH_STAB_CUE_IDS, ...MALE_HUMAN_DEATH_SIGH_CUE_IDS];

class FakeAudioRuntime {
  constructor() {
    this.calls = [];
    this.stops = [];
  }

  hasCue(cueId) { return Boolean(AUDIO_CUE_MANIFEST[cueId]); }
  play3D(cueId, position, options = {}) {
    this.calls.push({ cueId, position: position.clone?.() ?? { ...position }, options: { ...options } });
    return Promise.resolve(true);
  }
  stopOneShotsByOwner(owner, options) { this.stops.push({ owner, options }); return 0; }
  getActiveOneShotCount() { return 0; }
}

function createActor(instanceId = 'male-actor-1', position = new THREE.Vector3(2, 1.7, -4)) {
  const root = new THREE.Object3D();
  root.position.copy(position);
  return {
    instanceId,
    lifeState: 'alive',
    visualProfile: TESTMAN_COMBAT_PROFILE,
    root,
    emitterPosition: position.clone(),
    getBodyWorldPosition() { return this.emitterPosition.clone(); },
    isSemanticBodyDetached() { return false; },
  };
}

function createDirectorActor(instanceId = 'director-male-1') {
  const actor = createActor(instanceId);
  actor.physiology = { interruptBreathing() {} };
  actor.beginPunctureWound = () => ({ id: `${instanceId}-wound`, maximumDepth: 0.004 });
  actor.beginSwordThrustWound = () => ({ id: `${instanceId}-sword-wound`, maximumDepth: 0.004 });
  actor.applyPenetration = () => 0.1;
  actor.triggerReflex = () => {};
  return actor;
}

function beginConfirmedKnifePuncture(director, gate, weaponProfile = { id: 'old_work_knife', family: 'knife', piercingAudio: OLD_WORK_KNIFE_PIERCING_AUDIO_PROFILE }) {
  return director.beginPuncture({
    weapon: weaponProfile,
    intent: { weaponId: weaponProfile.id, intent: MELEE_INTENTS.stab, ownerId: 7, speed: 1, intentional: true, damaging: true },
    hit: { regionId: 'upper_chest' },
    entryPoint: new THREE.Vector3(1, 1.5, -2),
    direction: new THREE.Vector3(0, 0, -1),
    depth: 0.004,
    force: 1,
    penetrationAudioGate: gate,
  });
}

test('all eighteen accepted WAVs exist and are registered with exact spatial combat paths', async () => {
  assert.equal(FLESH_STAB_CUE_IDS.length, 6);
  assert.equal(MALE_HUMAN_DEATH_SIGH_CUE_IDS.length, 12);
  assert.equal(new Set(acceptedCueIds).size, 18);
  for (const cueId of acceptedCueIds) {
    const cue = AUDIO_CUE_MANIFEST[cueId];
    assert.ok(cue, `${cueId} is registered`);
    assert.equal(cue.path, `./audio/combat/${cueId}.wav`);
    assert.equal(cue.spatial, true);
    await access(`${repoRoot}/public/audio/combat/${cueId}.wav`);
  }
  for (const cueId of FLESH_STAB_CUE_IDS) {
    assert.equal(AUDIO_CUE_MANIFEST[cueId].category, 'combat');
    assert.equal(AUDIO_CUE_MANIFEST[cueId].maxDistance, 20);
  }
  for (const cueId of MALE_HUMAN_DEATH_SIGH_CUE_IDS) {
    assert.equal(AUDIO_CUE_MANIFEST[cueId].category, 'voice');
    assert.equal(AUDIO_CUE_MANIFEST[cueId].maxDistance, 28);
  }
});

test('accepted pools randomize across every variation without immediate repetition or depth sub-pools', () => {
  const selected = new Set();
  for (let index = 0; index < FLESH_STAB_CUE_IDS.length; index += 1) selected.add(selectNonRepeatingCue(FLESH_STAB_CUE_IDS, null, () => (index + 0.1) / FLESH_STAB_CUE_IDS.length));
  assert.deepEqual(selected, new Set(FLESH_STAB_CUE_IDS));
  let previous = FLESH_STAB_CUE_IDS[2];
  for (const random of [0, 0.2, 0.5, 0.999]) {
    const next = selectNonRepeatingCue(FLESH_STAB_CUE_IDS, previous, () => random);
    assert.notEqual(next, previous);
    previous = next;
  }
  assert.equal('depth' in DREADSTONE_SWORD_PIERCING_AUDIO_PROFILE, false);
  assert.equal('shallowPool' in DREADSTONE_SWORD_PIERCING_AUDIO_PROFILE, false);
  assert.equal('deepPool' in DREADSTONE_SWORD_PIERCING_AUDIO_PROFILE, false);
});

test('piercing weapon profiles apply sword base treatment, lighter knife treatment, and future overrides', async () => {
  assert.equal(DREADSTONE_SWORD_PIERCING_AUDIO_PROFILE.volumeMultiplier, 1);
  assert.equal(DREADSTONE_SWORD_PIERCING_AUDIO_PROFILE.playbackRate, 1);
  assert.equal(OLD_WORK_KNIFE_PIERCING_AUDIO_PROFILE.volumeMultiplier, 0.85);
  assert.ok(Math.abs(OLD_WORK_KNIFE_PIERCING_AUDIO_PROFILE.playbackRate - 1.04) < 1e-8);
  const future = createPiercingAudioProfile({ volumeMultiplier: 0.7, playbackRate: 0.96 });
  assert.equal(future.pool, 'flesh_stab');
  assert.equal(future.volumeMultiplier, 0.7);
  assert.equal(future.playbackRate, 0.96);
  const maceSource = await readFile(`${repoRoot}/src/game/combat/weapons/MaceWorldWeaponController.js`, 'utf8');
  assert.doesNotMatch(maceSource, /piercingAudio|FLESH_STAB/);
});

test('confirmed living penetration emits one accepted stab and suppresses speculative or corpse playback', () => {
  const runtime = new FakeAudioRuntime();
  const actor = createDirectorActor();
  const accepted = new CombatAcceptedAudioSystem({ audioRuntime: runtime, random: () => 0.4 });
  actor.acceptedCombatAudio = accepted;
  accepted.registerActor(actor);
  const feedbackEvents = [];
  const haptics = [];
  const camera = [];
  const director = new CombatDirector({
    actor,
    acceptedCombatAudio: accepted,
    feedbackSystem: { emitAudio: (cue) => feedbackEvents.push(cue), emitCombatHaptic: (cue) => haptics.push(cue) },
    cameraFeedback: { shake: (payload) => camera.push(payload) },
  });
  const gate = new PenetrationAudioGate({ weaponId: 'old_work_knife' });
  const interaction = beginConfirmedKnifePuncture(director, gate);
  assert.ok(interaction);
  assert.equal(runtime.calls.length, 0, 'approach and contact do not emit an accepted stab');
  director.update(0.03);
  assert.equal(runtime.calls.length, 0, 'pre-rupture contact remains accepted-stab silent');
  director.update(0.01);
  assert.equal(runtime.calls.length, 1, 'wound creation owns the accepted stab request');
  assert.ok(FLESH_STAB_CUE_IDS.includes(runtime.calls[0].cueId));
  assert.equal(runtime.calls[0].options.volume, 0.85);
  assert.equal(runtime.calls[0].options.playbackRate, 1.04);
  director.update(0.1);
  assert.equal(feedbackEvents.includes('puncture'), false, 'accepted stab suppresses the synthesized puncture placeholder');
  assert.ok(haptics.includes('penetration'), 'penetration haptics remain');
  assert.equal(camera.length, 1, 'penetration camera feedback remains');

  accepted.confirmFleshPenetration({ actor, wound: interaction.result.wound, interactionId: interaction.id, weaponProfile: interaction.weapon.profile, penetrationAudioGate: gate, position: new THREE.Vector3() });
  assert.equal(runtime.calls.length, 1, 'embedded repeat emits no second stab');
  actor.lifeState = 'dead';
  const corpseGate = new PenetrationAudioGate({ weaponId: 'old_work_knife' });
  accepted.confirmFleshPenetration({ actor, wound: { deliberateStab: true, surfaceRuptured: true }, interactionId: 'corpse-puncture', weaponProfile: interaction.weapon.profile, penetrationAudioGate: corpseGate, position: new THREE.Vector3() });
  assert.equal(runtime.calls.length, 1, 'corpse penetration is silent');
  assert.equal(accepted.getDiagnostics({ actor, penetrationAudioGate: gate }).stabCorpseSuppressionCount, 1);
  director.dispose();
  accepted.dispose();
});

test('clothing, failed tip, scrape, edge, and blocked contact never enter the accepted stab pool', () => {
  const runtime = new FakeAudioRuntime();
  const actor = createDirectorActor('non-rupture-actor');
  const accepted = new CombatAcceptedAudioSystem({ audioRuntime: runtime });
  actor.acceptedCombatAudio = accepted;
  accepted.registerActor(actor);
  const director = new CombatDirector({ actor, acceptedCombatAudio: accepted, feedbackSystem: { emitAudio() {}, emitCombatHaptic() {} } });
  const intent = { weaponId: 'old_work_knife', intent: MELEE_INTENTS.stab, ownerId: 3, speed: 0.8, intentional: true, damaging: true };
  for (const cue of ['clothing_contact', 'failed_tip', 'blade_scrape', 'shallow_slash', 'blade_bind']) {
    director.reportContact({ weapon: { id: 'old_work_knife', family: 'knife', piercingAudio: OLD_WORK_KNIFE_PIERCING_AUDIO_PROFILE }, intent, hit: { regionId: 'upper_chest' }, position: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, -1), cue });
  }
  director.update(0.2);
  assert.equal(runtime.calls.length, 0);
  director.dispose();
  accepted.dispose();
});

test('shared penetration gate disarms while embedded and rearms only after confirmed full extraction', () => {
  const gate = new PenetrationAudioGate({ weaponId: 'future_spear' });
  let emitted = 0;
  assert.equal(gate.tryEmit('interaction-1', () => { emitted += 1; return true; }), true);
  assert.equal(gate.tryEmit('interaction-1', () => { emitted += 1; return true; }), false, 'deeper movement is suppressed');
  assert.equal(gate.tryEmit('interaction-2', () => { emitted += 1; return true; }), false, 'lateral embedded contact is suppressed');
  assert.equal(emitted, 1);
  assert.equal(gate.rearmAfterFullExtraction('wrong-interaction'), false);
  assert.equal(gate.penetrationAudioArmed, false);
  assert.equal(gate.rearmAfterFullExtraction('interaction-1'), true);
  assert.equal(gate.tryEmit('interaction-2', () => { emitted += 1; return true; }), true);
  assert.equal(emitted, 2);
  assert.equal(gate.getDiagnostics().rearmCount, 1);
});

test('male-human death commits once and lethal puncture timing is driven by combat update time', () => {
  const runtime = new FakeAudioRuntime();
  const actor = createActor();
  const accepted = new CombatAcceptedAudioSystem({ audioRuntime: runtime, random: () => 0.5 });
  const gate = new PenetrationAudioGate({ weaponId: 'dreadstone_sword' });
  accepted.confirmFleshPenetration({ actor, wound: { deliberateStab: true, surfaceRuptured: true }, interactionId: 'lethal-stab', weaponProfile: { id: 'dreadstone_sword', piercingAudio: DREADSTONE_SWORD_PIERCING_AUDIO_PROFILE }, penetrationAudioGate: gate, position: actor.emitterPosition });
  assert.equal(runtime.calls.length, 1);
  assert.equal(accepted.getDiagnostics({ actor }).pendingDelayedCueCount, 0, 'a nonlethal puncture does not predict or schedule death audio');
  actor.lifeState = 'dying';
  assert.equal(accepted.handleLifeStateTransition(actor, { previousState: 'alive', nextState: 'dying' }), true);
  assert.equal(accepted.getDiagnostics({ actor }).deathSighScheduled, true);
  assert.deepEqual(LETHAL_STAB_DEATH_DELAY_RANGE_SECONDS, [0.09, 0.18]);
  accepted.update(0.089);
  assert.equal(runtime.calls.length, 1);
  assert.equal(runtime.calls.length, 1, 'not advancing the combat clock leaves the paused delay frozen');
  accepted.update(0.046);
  assert.equal(runtime.calls.length, 2);
  assert.ok(MALE_HUMAN_DEATH_SIGH_CUE_IDS.includes(runtime.calls[1].cueId));
  assert.equal(runtime.calls[1].options.voiceGroup, 'accepted-male-death-sigh');
  assert.equal(runtime.calls[1].options.maximumVoices, 3);
  actor.lifeState = 'dead';
  assert.equal(accepted.handleLifeStateTransition(actor, { previousState: 'dying', nextState: 'dead' }), false);
  assert.equal(accepted.getDiagnostics({ actor }).deathSighEmissionCount, 1);
  assert.equal(accepted.getDiagnostics({ actor }).injuryVoicePlayed, false);
  accepted.dispose();
});

test('direct death, actor-time spatial capture, independent emitters, reset, disposal, and restored corpses remain guarded', () => {
  const runtime = new FakeAudioRuntime();
  const accepted = new CombatAcceptedAudioSystem({ audioRuntime: runtime, random: () => 0.5 });
  const first = createActor('male-a', new THREE.Vector3(1, 2, 3));
  const second = createActor('male-b', new THREE.Vector3(-4, 1, 6));
  first.root.visible = false;
  first.lifeState = 'dead';
  second.lifeState = 'dead';
  assert.equal(accepted.handleLifeStateTransition(first, { previousState: 'alive', nextState: 'dead' }), true);
  assert.equal(accepted.handleLifeStateTransition(second, { previousState: 'alive', nextState: 'dead' }), true);
  first.emitterPosition.set(7, 8, 9);
  second.emitterPosition.set(-7, 2, 5);
  accepted.update(0.041);
  const deathCalls = runtime.calls.filter((call) => MALE_HUMAN_DEATH_SIGH_CUE_IDS.includes(call.cueId));
  assert.equal(deathCalls.length, 2);
  assert.notEqual(deathCalls[0].cueId, deathCalls[1].cueId, 'death pool avoids immediate repetition at playback');
  assert.deepEqual(deathCalls.map((call) => call.position.toArray()), [[7, 8, 9], [-7, 2, 5]], 'positions are captured when playback begins');
  assert.deepEqual(deathCalls.map((call) => call.options.owner), ['male-a', 'male-b']);
  assert.equal(accepted.getDiagnostics({ actor: first }).offscreenDeathPlaybackCount, 1);

  accepted.resetActor(first);
  first.lifeState = 'dead';
  accepted.markRestoredLifeState(first, 'dead');
  const restoredState = accepted.getDiagnostics({ actor: first });
  assert.equal(restoredState.restoredDeadFromSave, true);
  assert.equal(accepted.handleLifeStateTransition(first, { previousState: 'alive', nextState: 'dead' }), false);
  const restoredGate = new PenetrationAudioGate({ weaponId: 'old_work_knife' });
  accepted.confirmFleshPenetration({ actor: first, wound: { deliberateStab: true, surfaceRuptured: true }, interactionId: 'restored-corpse-hit', weaponProfile: { id: 'old_work_knife', piercingAudio: OLD_WORK_KNIFE_PIERCING_AUDIO_PROFILE }, penetrationAudioGate: restoredGate, position: first.emitterPosition });
  assert.equal(runtime.calls.length, 2, 'restored corpse attacks remain silent');

  accepted.resetActor(second);
  second.lifeState = 'dead';
  accepted.handleLifeStateTransition(second, { previousState: 'alive', nextState: 'dead' });
  assert.equal(accepted.getDiagnostics({ actor: second }).pendingDelayedCueCount, 1);
  accepted.reset();
  accepted.update(1);
  assert.equal(runtime.calls.length, 2, 'reset cancels pending death sighs');

  second.lifeState = 'dead';
  accepted.handleLifeStateTransition(second, { previousState: 'alive', nextState: 'dead' });
  accepted.dispose();
  accepted.update(1);
  assert.equal(runtime.calls.length, 2, 'disposal cancels pending death sighs');
});

test('male voice metadata is explicit and detachment audio remains terminal-state owned', async () => {
  assert.equal(CURRENT_HUMANOID_PROFILE.voiceProfile, 'male_human');
  assert.equal(TESTMAN_COMBAT_PROFILE.voiceProfile, 'male_human');
  assert.equal(TESTMAN_DAMAGE_COMBAT_PROFILE.voiceProfile, 'male_human');
  const actorSource = await readFile(`${repoRoot}/src/game/combat/HumanoidCombatActor.js`, 'utf8');
  const segmentSource = await readFile(`${repoRoot}/src/game/combat/HumanoidDamageSegmentRuntime.js`, 'utf8');
  assert.match(actorSource, /requestFatalSegmentDetachment[\s\S]*transitionLifeState\('dying'/);
  assert.doesNotMatch(segmentSource, /deathSigh|male_death_sigh|acceptedCombatAudio/);
  assert.match(segmentSource, /fatal:\s*true/);
  assert.match(segmentSource, /fatal:\s*false/);
});

test('accepted combat system remains independent from Folsom daytime ambience', async () => {
  const acceptedAudioSource = await readFile(`${repoRoot}/src/game/combat/CombatAcceptedAudioSystem.js`, 'utf8');
  const combatDirectorSource = await readFile(`${repoRoot}/src/game/combat/CombatDirector.js`, 'utf8');
  assert.doesNotMatch(acceptedAudioSource, /folsom.*ambience|ambience.*folsom/i);
  assert.doesNotMatch(combatDirectorSource, /folsom.*ambience|ambience.*folsom/i);
});
