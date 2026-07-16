import {
  FOLSOM_DAY_AMBIENCE_CUES,
  FOLSOM_DAY_AMBIENCE_LOOP_KEYS,
  FOLSOM_DAY_AMBIENCE_PROFILE,
  FOLSOM_DISTANT_LIFE_ANCHORS,
  FOLSOM_WOOD_STRUCTURE_ANCHORS,
} from './FolsomAmbienceConfig.js';

const RANDOMIZED_OWNER = 'folsom:exterior-day-randomized';
const RANDOMIZED_VOICE_GROUP = 'folsom-exterior-day-randomized';
const LOOP_TARGET_EPSILON = 0.004;
const MINIMUM_ABOVE_TERRAIN = 0.04;
const MAX_DIAGNOSTIC_COUNT = 999999;

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const incrementBounded = (value) => Math.min(MAX_DIAGNOSTIC_COUNT, value + 1);

export function resolveFolsomAmbienceDayWeight(dayWeight) {
  const threshold = FOLSOM_DAY_AMBIENCE_PROFILE.activationDayWeight;
  const normalized = clamp01((clamp01(dayWeight) - threshold) / (1 - threshold));
  return normalized * normalized * (3 - 2 * normalized);
}

function finitePosition(position) {
  return Boolean(position && [position.x, position.y, position.z].every(Number.isFinite));
}

function sourcePosition(source, descriptor) {
  const position = source?.position;
  let x;
  let y;
  let z;
  if (Array.isArray(position)) [x, y, z] = position;
  else if (position) ({ x, y, z } = position);
  else if (Array.isArray(source?.from) && Array.isArray(source?.to)) {
    x = (source.from[0] + source.to[0]) * 0.5;
    z = (source.from[1] + source.to[1]) * 0.5;
    y = (source.y ?? 0) + (source.height ?? 0) * (descriptor.heightRatio ?? 0.5);
  }
  const resolved = {
    x: Number(x),
    y: Number(y) + (descriptor.heightOffset ?? 0),
    z: Number(z),
  };
  return finitePosition(resolved) ? resolved : null;
}

function resolveTerrainY(dungeon, definition, x, z) {
  const visibleSurface = dungeon?.resolveOutdoorVisibleSurfaceY?.(x, z, { water: false });
  const visibleY = typeof visibleSurface === 'number' ? visibleSurface : visibleSurface?.y;
  if (Number.isFinite(visibleY)) return visibleY;
  const runtimeY = dungeon?.outdoorVisibleSurfaceRuntime?.sampleOutdoorY?.(x, z)
    ?? dungeon?.outdoorTerrainRuntime?.sampleOutdoorY?.(x, z);
  if (Number.isFinite(runtimeY)) return runtimeY;
  return Number.isFinite(definition?.defaultFloorY) ? definition.defaultFloorY : null;
}

function distanceBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export class FolsomDayAmbienceRuntime {
  constructor({ audioRuntime, random = Math.random } = {}) {
    this.audioRuntime = audioRuntime;
    this.random = typeof random === 'function' ? random : Math.random;
    this.locationId = null;
    this.presentationName = 'unavailable';
    this.presentationProgress = 0;
    this.dayWeight = 0;
    this.smoothedDayWeight = 0;
    this.baseTargetVolume = 0;
    this.grassTargetVolume = 0;
    this.lastBaseTargetVolume = null;
    this.lastGrassTargetVolume = null;
    this.distantLifeNextInSeconds = null;
    this.woodSettleNextInSeconds = null;
    this.randomizedOneShotCooldownSeconds = 0;
    this.distantLifeEmissionCount = 0;
    this.woodSettleEmissionCount = 0;
    this.distantLifeLastCueId = null;
    this.distantLifeLastAnchorId = null;
    this.woodSettleLastAnchorId = null;
    this.suppressedNightCount = 0;
    this.suppressedDistanceCount = 0;
    this.invalidAnchorCount = 0;
    this.audioWasRunning = false;
    this.nightSuppressionLatched = false;
    this.active = false;
    this.disposed = false;
  }

  update(deltaSeconds, { player = null, dungeon = null, locationId = null, paused = false } = {}) {
    if (this.disposed) return;
    if (locationId !== this.locationId) this.handleLocationChanged(locationId);

    const presentation = dungeon?.outdoorLightingDirector?.currentPresentationState ?? {};
    this.presentationName = presentation.name ?? 'unavailable';
    this.presentationProgress = clamp01(presentation.progress);
    this.dayWeight = clamp01(presentation.dayWeight);
    this.smoothedDayWeight = resolveFolsomAmbienceDayWeight(this.dayWeight);
    this.baseTargetVolume = FOLSOM_DAY_AMBIENCE_PROFILE.baseVolume * this.smoothedDayWeight;
    this.grassTargetVolume = FOLSOM_DAY_AMBIENCE_PROFILE.grassVolume * this.smoothedDayWeight;
    this.active = this.locationId === 'folsom'
      && this.dayWeight > FOLSOM_DAY_AMBIENCE_PROFILE.activationDayWeight;

    if (paused) return;

    this.syncContinuousLoops();
    if (!this.active) {
      if (this.locationId === 'folsom' && !this.nightSuppressionLatched) {
        this.suppressedNightCount = incrementBounded(this.suppressedNightCount);
        this.audioRuntime?.stopOneShotsByOwner?.(RANDOMIZED_OWNER, { voiceGroup: RANDOMIZED_VOICE_GROUP });
        this.nightSuppressionLatched = true;
      }
      this.clearRandomizedScheduling();
      this.audioWasRunning = false;
      return;
    }

    this.nightSuppressionLatched = false;
    if (!this.audioRuntime?.isAudioRunning?.()) {
      // Loops retain their normal pending-loop ownership. Randomized events do not.
      this.clearRandomizedScheduling();
      this.audioWasRunning = false;
      return;
    }

    if (!this.audioWasRunning) {
      this.distantLifeNextInSeconds = this.randomInterval(FOLSOM_DAY_AMBIENCE_PROFILE.distantLifeIntervalSeconds);
      this.woodSettleNextInSeconds = this.randomInterval(FOLSOM_DAY_AMBIENCE_PROFILE.woodSettleIntervalSeconds);
      this.randomizedOneShotCooldownSeconds = 0;
      this.audioWasRunning = true;
    }

    const dt = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
    this.distantLifeNextInSeconds ??= this.randomInterval(FOLSOM_DAY_AMBIENCE_PROFILE.distantLifeIntervalSeconds);
    this.woodSettleNextInSeconds ??= this.randomInterval(FOLSOM_DAY_AMBIENCE_PROFILE.woodSettleIntervalSeconds);
    this.distantLifeNextInSeconds -= dt;
    this.woodSettleNextInSeconds -= dt;
    this.randomizedOneShotCooldownSeconds = Math.max(0, this.randomizedOneShotCooldownSeconds - dt);
    if (this.randomizedOneShotCooldownSeconds > 0) return;

    if (this.distantLifeNextInSeconds <= 0 && this.emitDistantLife(player, dungeon)) return;
    if (this.woodSettleNextInSeconds <= 0) this.emitWoodSettle(player, dungeon);
  }

  syncContinuousLoops() {
    const fadeSeconds = FOLSOM_DAY_AMBIENCE_PROFILE.loopFadeSeconds;
    if (!this.active) {
      this.stopOwnedLoops(fadeSeconds);
      return;
    }
    this.syncLoop({
      cueId: FOLSOM_DAY_AMBIENCE_CUES.baseLoop,
      key: FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base,
      targetVolume: this.baseTargetVolume,
      lastTargetProperty: 'lastBaseTargetVolume',
    });
    this.syncLoop({
      cueId: FOLSOM_DAY_AMBIENCE_CUES.grassLoop,
      key: FOLSOM_DAY_AMBIENCE_LOOP_KEYS.grass,
      targetVolume: this.grassTargetVolume,
      lastTargetProperty: 'lastGrassTargetVolume',
    });
  }

  syncLoop({ cueId, key, targetVolume, lastTargetProperty }) {
    const owned = this.audioRuntime?.loops?.has?.(key) || this.audioRuntime?.pendingLoops?.has?.(key);
    const previousTarget = this[lastTargetProperty];
    if (owned && Number.isFinite(previousTarget) && Math.abs(previousTarget - targetVolume) < LOOP_TARGET_EPSILON) return;
    this[lastTargetProperty] = targetVolume;
    this.audioRuntime?.startLoop?.(cueId, key, {
      category: 'ambience',
      spatial: false,
      volume: targetVolume,
      fadeSeconds: FOLSOM_DAY_AMBIENCE_PROFILE.loopFadeSeconds,
    });
  }

  stopOwnedLoops(fadeSeconds = FOLSOM_DAY_AMBIENCE_PROFILE.loopFadeSeconds) {
    if (this.lastBaseTargetVolume != null || this.isLoopActive(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base)) {
      this.audioRuntime?.stopLoop?.(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base, fadeSeconds);
    }
    if (this.lastGrassTargetVolume != null || this.isLoopActive(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.grass)) {
      this.audioRuntime?.stopLoop?.(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.grass, fadeSeconds);
    }
    this.lastBaseTargetVolume = null;
    this.lastGrassTargetVolume = null;
  }

  emitDistantLife(player, dungeon) {
    this.distantLifeNextInSeconds = this.randomInterval(FOLSOM_DAY_AMBIENCE_PROFILE.distantLifeIntervalSeconds);
    const cueId = this.chooseAvoiding(FOLSOM_DAY_AMBIENCE_CUES.distantLife, this.distantLifeLastCueId)?.id;
    const anchor = this.chooseAuthoredAnchor({
      descriptors: FOLSOM_DISTANT_LIFE_ANCHORS,
      lastAnchorId: this.distantLifeLastAnchorId,
      player,
      dungeon,
      maximumDistance: FOLSOM_DAY_AMBIENCE_PROFILE.distantLifeAudibleRange,
    });
    if (!cueId || !anchor) return false;
    this.distantLifeLastCueId = cueId;
    this.distantLifeLastAnchorId = anchor.id;
    this.randomizedOneShotCooldownSeconds = FOLSOM_DAY_AMBIENCE_PROFILE.randomizedOneShotCooldownSeconds;
    const result = this.audioRuntime.play3D(cueId, { ...anchor.position }, this.randomizedPlaybackOptions());
    this.recordEmission(result, 'distantLifeEmissionCount');
    return true;
  }

  emitWoodSettle(player, dungeon) {
    this.woodSettleNextInSeconds = this.randomInterval(FOLSOM_DAY_AMBIENCE_PROFILE.woodSettleIntervalSeconds);
    const anchor = this.chooseAuthoredAnchor({
      descriptors: FOLSOM_WOOD_STRUCTURE_ANCHORS,
      lastAnchorId: this.woodSettleLastAnchorId,
      player,
      dungeon,
      maximumDistance: FOLSOM_DAY_AMBIENCE_PROFILE.woodSettleAudibleRange,
    });
    if (!anchor) return false;
    this.woodSettleLastAnchorId = anchor.id;
    this.randomizedOneShotCooldownSeconds = FOLSOM_DAY_AMBIENCE_PROFILE.randomizedOneShotCooldownSeconds;
    const result = this.audioRuntime.play3D(
      FOLSOM_DAY_AMBIENCE_CUES.woodSettle,
      { ...anchor.position },
      this.randomizedPlaybackOptions(),
    );
    this.recordEmission(result, 'woodSettleEmissionCount');
    return true;
  }

  randomizedPlaybackOptions() {
    return {
      category: 'ambience',
      owner: RANDOMIZED_OWNER,
      cancellable: true,
      voiceGroup: RANDOMIZED_VOICE_GROUP,
      maximumVoices: 1,
      deferUntilUnlocked: false,
      skipDefer: true,
    };
  }

  recordEmission(result, countProperty) {
    if (result && typeof result.then === 'function') {
      result.then((played) => {
        if (!this.disposed && played) this[countProperty] = incrementBounded(this[countProperty]);
      });
      return;
    }
    if (result !== false) this[countProperty] = incrementBounded(this[countProperty]);
  }

  chooseAuthoredAnchor({ descriptors, lastAnchorId, player, dungeon, maximumDistance }) {
    if (!finitePosition(player?.position)) {
      this.suppressedDistanceCount = incrementBounded(this.suppressedDistanceCount);
      return null;
    }
    const definition = dungeon?.outdoorSurfaceDefinition;
    const resolved = [];
    descriptors.forEach((descriptor) => {
      const anchor = this.resolveAuthoredAnchor(descriptor, definition, dungeon);
      if (!anchor) this.invalidAnchorCount = incrementBounded(this.invalidAnchorCount);
      else if (distanceBetween(player.position, anchor.position) <= maximumDistance
        && distanceBetween(player.position, anchor.position) > 0.01) resolved.push(anchor);
    });
    if (!resolved.length) {
      this.suppressedDistanceCount = incrementBounded(this.suppressedDistanceCount);
      return null;
    }
    return this.chooseAvoiding(resolved, lastAnchorId);
  }

  resolveAuthoredAnchor(descriptor, definition, dungeon) {
    if (definition?.id !== 'folsom') return null;
    const sources = definition[descriptor.sourceCollection];
    const source = Array.isArray(sources) ? sources.find((entry) => entry?.id === descriptor.sourceId) : null;
    const position = sourcePosition(source, descriptor);
    if (!position) return null;
    const terrainY = resolveTerrainY(dungeon, definition, position.x, position.z);
    if (!Number.isFinite(terrainY) || position.y < terrainY + MINIMUM_ABOVE_TERRAIN) return null;
    return { id: descriptor.id, meaning: descriptor.meaning, sourceId: descriptor.sourceId, position };
  }

  chooseAvoiding(entries, previousId) {
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const normalized = entries.map((entry) => typeof entry === 'string' ? { id: entry } : entry);
    const alternatives = normalized.filter((entry) => entry.id !== previousId);
    const pool = alternatives.length ? alternatives : normalized;
    const index = Math.min(pool.length - 1, Math.floor(clamp01(this.random()) * pool.length));
    return pool[index];
  }

  randomInterval([minimum, maximum]) {
    return minimum + clamp01(this.random()) * (maximum - minimum);
  }

  clearRandomizedScheduling({ clearLast = false, stopActive = false } = {}) {
    this.distantLifeNextInSeconds = null;
    this.woodSettleNextInSeconds = null;
    this.randomizedOneShotCooldownSeconds = 0;
    if (clearLast) {
      this.distantLifeLastCueId = null;
      this.distantLifeLastAnchorId = null;
      this.woodSettleLastAnchorId = null;
    }
    if (stopActive) this.audioRuntime?.stopOneShotsByOwner?.(RANDOMIZED_OWNER, { voiceGroup: RANDOMIZED_VOICE_GROUP });
  }

  handleLocationChanged(locationId) {
    if (locationId === this.locationId) return;
    const leavingFolsom = this.locationId === 'folsom' && locationId !== 'folsom';
    this.locationId = locationId;
    if (leavingFolsom) this.stopOwnedLoops(FOLSOM_DAY_AMBIENCE_PROFILE.locationExitFadeSeconds);
    this.clearRandomizedScheduling({ clearLast: true, stopActive: leavingFolsom });
    this.audioWasRunning = false;
    this.nightSuppressionLatched = false;
    this.active = false;
  }

  reset() {
    if (this.disposed) return;
    this.stopOwnedLoops(0.08);
    this.clearRandomizedScheduling({ clearLast: true, stopActive: true });
    this.presentationName = 'unavailable';
    this.presentationProgress = 0;
    this.dayWeight = 0;
    this.smoothedDayWeight = 0;
    this.baseTargetVolume = 0;
    this.grassTargetVolume = 0;
    this.audioWasRunning = false;
    this.nightSuppressionLatched = false;
    this.active = false;
  }

  isLoopActive(key) {
    return Boolean(this.audioRuntime?.hasLoopOwnership?.(key)
      || this.audioRuntime?.loops?.has?.(key)
      || this.audioRuntime?.startingLoops?.has?.(key)
      || this.audioRuntime?.pendingLoops?.has?.(key));
  }

  getDiagnostics() {
    return {
      active: this.active,
      locationId: this.locationId,
      presentationName: this.presentationName,
      presentationProgress: this.presentationProgress,
      dayWeight: this.dayWeight,
      smoothedDayWeight: this.smoothedDayWeight,
      baseLoopActive: this.isLoopActive(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.base),
      grassLoopActive: this.isLoopActive(FOLSOM_DAY_AMBIENCE_LOOP_KEYS.grass),
      baseTargetVolume: this.baseTargetVolume,
      grassTargetVolume: this.grassTargetVolume,
      distantLifeNextInSeconds: this.distantLifeNextInSeconds,
      distantLifeEmissionCount: this.distantLifeEmissionCount,
      distantLifeLastCueId: this.distantLifeLastCueId,
      distantLifeLastAnchorId: this.distantLifeLastAnchorId,
      woodSettleNextInSeconds: this.woodSettleNextInSeconds,
      woodSettleEmissionCount: this.woodSettleEmissionCount,
      woodSettleLastAnchorId: this.woodSettleLastAnchorId,
      suppressedNightCount: this.suppressedNightCount,
      suppressedDistanceCount: this.suppressedDistanceCount,
      invalidAnchorCount: this.invalidAnchorCount,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.audioRuntime = null;
    this.random = null;
  }
}
