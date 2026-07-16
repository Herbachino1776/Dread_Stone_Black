import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createOutdoorTerrainSampler } from '../src/engine/outdoor-authoring/OutdoorTerrainBuilder.js';
import { AUDIO_CUE_MANIFEST } from '../src/game/audio/audioCueManifest.js';
import {
  FOLSOM_DAY_AMBIENCE_CUES,
  FOLSOM_DAY_AMBIENCE_LOOP_KEYS,
  FOLSOM_DAY_AMBIENCE_PROFILE,
  FOLSOM_DISTANT_LIFE_ANCHORS,
  FOLSOM_WOOD_STRUCTURE_ANCHORS,
} from '../src/game/audio/FolsomAmbienceConfig.js';
import { FolsomDayAmbienceRuntime, resolveFolsomAmbienceDayWeight } from '../src/game/audio/FolsomDayAmbienceRuntime.js';
import { GameAudioRuntime } from '../src/game/audio/GameAudioRuntime.js';
import { folsomDefinition } from '../src/game/locations/folsom.definition.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const APPROVED_ASSETS = Object.freeze([
  'public/audio/ambience/audio_ch1_folsom_exterior_day_base_ambience_loop.wav',
  'public/audio/ambience/audio_ch1_folsom_exterior_day_grass_texture_loop.wav',
  'public/audio/ambience/audio_ch1_folsom_exterior_day_distant_life_01_oneshot.wav',
  'public/audio/ambience/audio_ch1_folsom_exterior_day_distant_life_02_oneshot.wav',
  'public/audio/ambience/audio_ch1_folsom_exterior_day_wood_settle_01_oneshot.wav',
]);
const TERRAIN = createOutdoorTerrainSampler(folsomDefinition.terrain, { pathCorridors: folsomDefinition.splineTrails });

class FakeAudioRuntime {
  constructor({ running = true } = {}) {
    this.running = running;
    this.loops = new Map();
    this.pendingLoops = new Map();
    this.deferredOneShots = new Map();
    this.startCalls = [];
    this.stopCalls = [];
    this.playCalls = [];
    this.stopOwnerCalls = [];
    this.nextLoopInstance = 1;
  }

  isAudioRunning() { return this.running; }

  startLoop(cueId, key, options) {
    this.startCalls.push({ cueId, key, options: { ...options } });
    if (!this.running) {
      this.pendingLoops.set(key, { cueId, key, options: { ...options } });
      return false;
    }
    const existing = this.loops.get(key);
    this.loops.set(key, { cueId, key, options: { ...options }, instance: existing?.instance ?? this.nextLoopInstance++ });
    this.pendingLoops.delete(key);
    return true;
  }

  stopLoop(key, fadeSeconds) {
    this.stopCalls.push({ key, fadeSeconds });
    this.loops.delete(key);
    this.pendingLoops.delete(key);
  }

  play3D(cueId, position, options) {
    this.playCalls.push({ cueId, position: { ...position }, options: { ...options } });
    return true;
  }

  stopOneShotsByOwner(owner, options) {
    this.stopOwnerCalls.push({ owner, options: { ...options } });
    return 0;
  }
}

function presentation(dayWeight = 1, name = 'day', progress = 0.5) {
  return { dayWeight, name, progress };
}

function makeDungeon(state = presentation()) {
  return {
    outdoorSurfaceDefinition: folsomDefinition,
    outdoorTerrainRuntime: TERRAIN,
    outdoorLightingDirector: { currentPresentationState: state },
  };
}

function update(runtime, { deltaSeconds = 0.1, player = { position: { x: -2, y: 1.71, z: -4 } }, dungeon = makeDungeon(), locationId = 'folsom', paused = false } = {}) {
  runtime.update(deltaSeconds, { player, dungeon, locationId, paused });
}

test('approved Folsom WAVs are unchanged and registered with the accepted manifest profiles', () => {
  for (const relativePath of APPROVED_ASSETS) {
    assert.equal(existsSync(path.join(ROOT, relativePath)), true, `${relativePath} must exist`);
    const baselineHash = execFileSync('git', ['rev-parse', `HEAD:${relativePath}`], { cwd: ROOT, encoding: 'utf8' }).trim();
    const workingHash = execFileSync('git', ['hash-object', relativePath], { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(workingHash, baselineHash, `${relativePath} must not be modified`);
  }

  const cueIds = [FOLSOM_DAY_AMBIENCE_CUES.baseLoop, FOLSOM_DAY_AMBIENCE_CUES.grassLoop, ...FOLSOM_DAY_AMBIENCE_CUES.distantLife, FOLSOM_DAY_AMBIENCE_CUES.woodSettle];
  cueIds.forEach((cueId) => assert.match(AUDIO_CUE_MANIFEST[cueId].path, /^\.\/audio\/ambience\//));
  assert.equal(AUDIO_CUE_MANIFEST[FOLSOM_DAY_AMBIENCE_CUES.baseLoop].loop, true);
  assert.equal(AUDIO_CUE_MANIFEST[FOLSOM_DAY_AMBIENCE_CUES.grassLoop].loop, true);
  assert.equal(AUDIO_CUE_MANIFEST[FOLSOM_DAY_AMBIENCE_CUES.baseLoop].volume, 0.58);
  assert.equal(AUDIO_CUE_MANIFEST[FOLSOM_DAY_AMBIENCE_CUES.grassLoop].volume, 0.24);
  [...FOLSOM_DAY_AMBIENCE_CUES.distantLife, FOLSOM_DAY_AMBIENCE_CUES.woodSettle]
    .forEach((cueId) => assert.equal(AUDIO_CUE_MANIFEST[cueId].spatial, true));
  FOLSOM_DAY_AMBIENCE_CUES.distantLife.forEach((cueId) => assert.deepEqual(
    { volume: AUDIO_CUE_MANIFEST[cueId].volume, refDistance: AUDIO_CUE_MANIFEST[cueId].refDistance, maxDistance: AUDIO_CUE_MANIFEST[cueId].maxDistance, rolloffFactor: AUDIO_CUE_MANIFEST[cueId].rolloffFactor },
    { volume: 0.48, refDistance: 3, maxDistance: 48, rolloffFactor: 0.8 },
  ));
  assert.deepEqual(
    { volume: AUDIO_CUE_MANIFEST[FOLSOM_DAY_AMBIENCE_CUES.woodSettle].volume, refDistance: AUDIO_CUE_MANIFEST[FOLSOM_DAY_AMBIENCE_CUES.woodSettle].refDistance, maxDistance: AUDIO_CUE_MANIFEST[FOLSOM_DAY_AMBIENCE_CUES.woodSettle].maxDistance, rolloffFactor: AUDIO_CUE_MANIFEST[FOLSOM_DAY_AMBIENCE_CUES.woodSettle].rolloffFactor },
    { volume: 0.42, refDistance: 2, maxDistance: 25, rolloffFactor: 1.05 },
  );
});

test('authored emitter descriptors resolve from canonical Folsom foliage and wooden structures above terrain', () => {
  const runtime = new FolsomDayAmbienceRuntime({ audioRuntime: new FakeAudioRuntime(), random: () => 0 });
  const dungeon = makeDungeon();
  for (const descriptor of [...FOLSOM_DISTANT_LIFE_ANCHORS, ...FOLSOM_WOOD_STRUCTURE_ANCHORS]) {
    const sources = folsomDefinition[descriptor.sourceCollection];
    assert.ok(sources.some((source) => source.id === descriptor.sourceId), `${descriptor.sourceId} must be canonical Folsom authoring`);
    const resolved = runtime.resolveAuthoredAnchor(descriptor, folsomDefinition, dungeon);
    assert.ok(resolved, `${descriptor.id} must resolve`);
    assert.ok(resolved.position.y > TERRAIN.sampleOutdoorY(resolved.position.x, resolved.position.z));
  }
  assert.ok(FOLSOM_DISTANT_LIFE_ANCHORS.length >= 4);
  assert.ok(FOLSOM_WOOD_STRUCTURE_ANCHORS.length >= 4);
});

test('continuous loop ownership is Folsom-only, duplicate-free, and preserves unrelated location loops', () => {
  const audio = new FakeAudioRuntime();
  audio.loops.set('beneath:existing-bed', { instance: 99 });
  audio.loops.set('folsom:shed-growth-tension', { instance: 100 });
  const runtime = new FolsomDayAmbienceRuntime({ audioRuntime: audio, random: () => 0.5 });
  update(runtime);
  assert.equal(audio.loops.has(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base), true);
  assert.equal(audio.loops.has(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.grass), true);
  const baseInstance = audio.loops.get(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base).instance;
  const grassInstance = audio.loops.get(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.grass).instance;
  update(runtime);
  assert.equal(audio.loops.get(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base).instance, baseInstance);
  assert.equal(audio.loops.get(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.grass).instance, grassInstance);
  assert.equal(audio.startCalls.filter(({ key }) => key === FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base).length, 1);
  assert.equal(audio.startCalls.filter(({ key }) => key === FOLSOM_DAY_AMBIENCE_LOOP_KEYS.grass).length, 1);

  update(runtime, { locationId: 'beneath-folsom', dungeon: makeDungeon(presentation(0, 'night')) });
  assert.equal(audio.loops.has(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base), false);
  assert.equal(audio.loops.has(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.grass), false);
  assert.equal(audio.loops.has('beneath:existing-bed'), true);
  assert.equal(audio.loops.has('folsom:shed-growth-tension'), true);
  assert.deepEqual(audio.stopCalls.slice(-2).map(({ fadeSeconds }) => fadeSeconds), [2, 2]);
});

test('continuous day weight drives full day, dusk, night, and dawn without phase-name restarts', () => {
  const audio = new FakeAudioRuntime();
  const runtime = new FolsomDayAmbienceRuntime({ audioRuntime: audio, random: () => 0.5 });
  const dungeon = makeDungeon(presentation(1, 'day'));
  update(runtime, { dungeon });
  assert.equal(runtime.baseTargetVolume, 0.58);
  assert.equal(runtime.grassTargetVolume, 0.24);
  const callsAtDay = audio.startCalls.length;

  dungeon.outdoorLightingDirector.currentPresentationState = presentation(1, 'dusk', 0);
  update(runtime, { dungeon });
  assert.equal(audio.startCalls.length, callsAtDay, 'phase-name boundary alone must not restart loops');

  dungeon.outdoorLightingDirector.currentPresentationState = presentation(0.5, 'dusk', 0.5);
  update(runtime, { dungeon });
  assert.ok(runtime.baseTargetVolume > 0 && runtime.baseTargetVolume < 0.58);
  assert.equal(runtime.baseTargetVolume, 0.58 * resolveFolsomAmbienceDayWeight(0.5));

  dungeon.outdoorLightingDirector.currentPresentationState = presentation(0, 'night', 0.5);
  update(runtime, { dungeon });
  assert.equal(runtime.active, false);
  assert.equal(runtime.baseTargetVolume, 0);
  assert.equal(runtime.grassTargetVolume, 0);
  assert.equal(audio.loops.size, 0);

  dungeon.outdoorLightingDirector.currentPresentationState = presentation(0.35, 'dawn', 0.75);
  update(runtime, { dungeon });
  assert.ok(runtime.baseTargetVolume > 0 && runtime.baseTargetVolume < 0.58);
  assert.equal(audio.loops.size, 2);
});

test('distant-life timing is sparse, pause-safe, non-repeating, and uses fixed authored positions', () => {
  const audio = new FakeAudioRuntime();
  const runtime = new FolsomDayAmbienceRuntime({ audioRuntime: audio, random: () => 0 });
  const player = { position: { x: -15, y: 1.71, z: -20 } };
  update(runtime, { deltaSeconds: 0, player });
  assert.equal(audio.playCalls.length, 0, 'entry must not emit immediately');
  assert.ok(runtime.distantLifeNextInSeconds >= 12 && runtime.distantLifeNextInSeconds <= 28);
  assert.ok(runtime.woodSettleNextInSeconds >= 22 && runtime.woodSettleNextInSeconds <= 50);
  const beforePause = runtime.distantLifeNextInSeconds;
  update(runtime, { deltaSeconds: 9, player, paused: true });
  assert.equal(runtime.distantLifeNextInSeconds, beforePause);

  runtime.distantLifeNextInSeconds = 0;
  runtime.woodSettleNextInSeconds = 100;
  update(runtime, { deltaSeconds: 0, player });
  const first = audio.playCalls.at(-1);
  assert.ok(FOLSOM_DAY_AMBIENCE_CUES.distantLife.includes(first.cueId));
  assert.notDeepEqual(first.position, player.position);
  assert.equal(first.options.skipDefer, true);
  assert.equal(first.options.deferUntilUnlocked, false);

  runtime.randomizedOneShotCooldownSeconds = 0;
  runtime.distantLifeNextInSeconds = 0;
  update(runtime, { deltaSeconds: 0, player });
  const second = audio.playCalls.at(-1);
  assert.notEqual(second.cueId, first.cueId);
  assert.notDeepEqual(second.position, first.position);
  assert.notEqual(runtime.distantLifeLastAnchorId, null);
});

test('wood settle requires nearby authored structures and avoids an immediately repeated anchor', () => {
  const audio = new FakeAudioRuntime();
  const runtime = new FolsomDayAmbienceRuntime({ audioRuntime: audio, random: () => 0 });
  const nearShed = { position: { x: -35, y: 1.71, z: -30 } };
  update(runtime, { deltaSeconds: 0, player: nearShed });
  runtime.distantLifeNextInSeconds = 100;
  runtime.woodSettleNextInSeconds = 0;
  update(runtime, { deltaSeconds: 0, player: nearShed });
  const first = audio.playCalls.at(-1);
  assert.equal(first.cueId, FOLSOM_DAY_AMBIENCE_CUES.woodSettle);
  const firstAnchor = runtime.woodSettleLastAnchorId;

  runtime.randomizedOneShotCooldownSeconds = 0;
  runtime.woodSettleNextInSeconds = 0;
  update(runtime, { deltaSeconds: 0, player: nearShed });
  assert.notEqual(runtime.woodSettleLastAnchorId, firstAnchor);

  const playCount = audio.playCalls.length;
  const suppressedBefore = runtime.suppressedDistanceCount;
  runtime.randomizedOneShotCooldownSeconds = 0;
  runtime.woodSettleNextInSeconds = 0;
  update(runtime, { deltaSeconds: 0, player: { position: { x: 0, y: 1.71, z: 0 } } });
  assert.equal(audio.playCalls.length, playCount);
  assert.ok(runtime.suppressedDistanceCount > suppressedBefore);
});

test('night and location exit cancel randomized scheduling and active owned ambience only', () => {
  const audio = new FakeAudioRuntime();
  const runtime = new FolsomDayAmbienceRuntime({ audioRuntime: audio, random: () => 0 });
  const dungeon = makeDungeon();
  update(runtime, { dungeon, deltaSeconds: 0 });
  dungeon.outdoorLightingDirector.currentPresentationState = presentation(0, 'night');
  update(runtime, { dungeon, deltaSeconds: 30 });
  assert.equal(runtime.distantLifeNextInSeconds, null);
  assert.equal(runtime.woodSettleNextInSeconds, null);
  assert.equal(audio.playCalls.length, 0);
  assert.equal(runtime.suppressedNightCount, 1);
  assert.equal(audio.stopOwnerCalls.length, 1);

  dungeon.outdoorLightingDirector.currentPresentationState = presentation(1, 'day');
  update(runtime, { dungeon, deltaSeconds: 0 });
  update(runtime, { dungeon, locationId: 'beneath-folsom', deltaSeconds: 0 });
  assert.equal(runtime.distantLifeLastCueId, null);
  assert.equal(runtime.distantLifeLastAnchorId, null);
  assert.equal(runtime.woodSettleLastAnchorId, null);
  assert.equal(audio.stopOwnerCalls.length, 2);
});

test('locked audio keeps owned pending loops but never queues stale ambient one-shots', () => {
  const audio = new FakeAudioRuntime({ running: false });
  const runtime = new FolsomDayAmbienceRuntime({ audioRuntime: audio, random: () => 0 });
  update(runtime, { deltaSeconds: 40 });
  assert.equal(audio.pendingLoops.size, 2);
  assert.equal(runtime.distantLifeNextInSeconds, null);
  assert.equal(runtime.woodSettleNextInSeconds, null);
  assert.equal(audio.deferredOneShots.size, 0);
  assert.equal(audio.playCalls.length, 0);

  runtime.distantLifeNextInSeconds = 0;
  runtime.woodSettleNextInSeconds = 0;
  update(runtime, { deltaSeconds: 1 });
  assert.equal(audio.playCalls.length, 0);
  audio.running = true;
  update(runtime, { deltaSeconds: 0 });
  assert.ok(runtime.distantLifeNextInSeconds >= 12);
  assert.ok(runtime.woodSettleNextInSeconds >= 22);
  assert.equal(audio.playCalls.length, 0, 'unlock must begin fresh delays instead of bursting stale events');
});

test('reset and disposal stop both owned loops without timers or leaked scheduling', () => {
  const audio = new FakeAudioRuntime();
  const runtime = new FolsomDayAmbienceRuntime({ audioRuntime: audio, random: () => 0 });
  update(runtime, { deltaSeconds: 0 });
  runtime.reset();
  assert.equal(audio.loops.has(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base), false);
  assert.equal(audio.loops.has(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.grass), false);
  assert.equal(runtime.distantLifeNextInSeconds, null);
  assert.equal(runtime.woodSettleNextInSeconds, null);
  runtime.dispose();
  assert.equal(runtime.disposed, true);

  const source = readFileSync(path.join(ROOT, 'src/game/audio/FolsomDayAmbienceRuntime.js'), 'utf8');
  assert.doesNotMatch(source, /setTimeout|setInterval|requestAnimationFrame/);
  assert.doesNotMatch(source, /OutdoorWorldClock/);
});

test('location cleanup cancels a loop whose audio buffer is still loading', async () => {
  let resolveBuffer;
  const bufferPromise = new Promise((resolve) => { resolveBuffer = resolve; });
  const audio = Object.assign(Object.create(GameAudioRuntime.prototype), {
    muted: false,
    loops: new Map(),
    startingLoops: new Map(),
    pendingLoops: new Map(),
    ensureContext: () => ({}),
    isAudioRunning: () => true,
    loadCue: () => bufferPromise,
  });
  const startPromise = audio.startLoop(FOLSOM_DAY_AMBIENCE_CUES.baseLoop, FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base, { volume: 0.58 });
  await Promise.resolve();
  assert.equal(audio.startingLoops.has(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base), true);
  audio.stopLoop(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base, 2);
  resolveBuffer({});
  assert.equal(await startPromise, false);
  assert.equal(audio.loops.has(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base), false);
  assert.equal(audio.startingLoops.has(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base), false);
});

test('combat, weapon, outdoor-lighting, footsteps, shed tension, and Beneath Folsom paths remain untouched', () => {
  const changedCombatFiles = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'src/game/combat'], { cwd: ROOT, encoding: 'utf8' }).trim();
  assert.equal(changedCombatFiles, '');
  const changedLightingFiles = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'src/game/world-scene/OutdoorLightingDirector.js', 'src/game/world-scene/OutdoorWorldClock.js'], { cwd: ROOT, encoding: 'utf8' }).trim();
  assert.equal(changedLightingFiles, '');
  const gameAudioSource = readFileSync(path.join(ROOT, 'src/game/audio/GameAudioRuntime.js'), 'utf8');
  assert.match(gameAudioSource, /new FolsomDayAmbienceRuntime\(\{ audioRuntime: this, random \}\)/);
  assert.match(gameAudioSource, /this\.folsomDayAmbience\.update\(deltaSeconds/);
  assert.match(gameAudioSource, /this\.folsomDayAmbience\.dispose\(\)/);
  assert.match(gameAudioSource, /audio_ch1_folsom_shed_growth_tension_loop/);
  assert.match(gameAudioSource, /audio_system_footsteps_grass_walk_loop/);
  assert.match(gameAudioSource, /audio_ch2_blue_flame_hall_ambience_loop/);
  assert.ok(AUDIO_CUE_MANIFEST.audio_system_combat_sword_stab_flesh_01_oneshot);
  assert.ok(AUDIO_CUE_MANIFEST.audio_system_combat_male_death_sigh_12_oneshot);
});
