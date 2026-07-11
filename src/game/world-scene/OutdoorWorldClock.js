export const OUTDOOR_CLOCK_STORAGE_KEY = 'dreadStoneBlack.outdoorWorldClock.v1';
export const OUTDOOR_CYCLE_DURATION_MS = 20 * 60 * 1000;
export const OUTDOOR_SKY_ROTATION_DURATION_MS = 80 * 60 * 1000;

const PHASES = Object.freeze({ noon: 0, dusk: 7 / 20, night: 12 / 20, dawn: 17 / 20 });
const smooth = (value) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const positiveModulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

export function resolveOutdoorPhase(elapsedMs, durationMs = OUTDOOR_CYCLE_DURATION_MS) {
  return positiveModulo(elapsedMs, durationMs) / durationMs;
}

export function resolveOutdoorTimeOfDay(phase) {
  const minute = positiveModulo(phase, 1) * 20;
  if (minute < 6) return { name: 'day', progress: minute / 6 };
  if (minute < 8) return { name: 'dusk', progress: (minute - 6) / 2 };
  if (minute < 16) return { name: 'night', progress: (minute - 8) / 8 };
  if (minute < 18) return { name: 'dawn', progress: (minute - 16) / 2 };
  return { name: 'morning', progress: (minute - 18) / 2 };
}

export function resolveOutdoorSkyWeights(phase) {
  const { name, progress } = resolveOutdoorTimeOfDay(phase);
  let dayWeight = 0; let redWeight = 0; let nightWeight = 0;
  const t = smooth(progress);
  if (name === 'day') dayWeight = 1;
  else if (name === 'night') nightWeight = 1;
  else if (name === 'morning') { dayWeight = 1; }
  else if (name === 'dusk') {
    if (t < 0.5) { const u = smooth(t * 2); dayWeight = 1 - u; redWeight = u; }
    else { const u = smooth((t - 0.5) * 2); redWeight = 1 - u; nightWeight = u; }
  } else {
    if (t < 0.5) { const u = smooth(t * 2); nightWeight = 1 - u; redWeight = u; }
    else { const u = smooth((t - 0.5) * 2); redWeight = 1 - u; dayWeight = u; }
  }
  const sum = dayWeight + redWeight + nightWeight || 1;
  return { dayWeight: dayWeight / sum, redWeight: redWeight / sum, nightWeight: nightWeight / sum };
}

export class OutdoorWorldClock {
  constructor({ storage = globalThis.localStorage, now = () => Date.now(), query = null, development = false } = {}) {
    this.storage = storage; this.now = now;
    const params = query ?? (globalThis.location ? new URLSearchParams(globalThis.location.search) : new URLSearchParams());
    this.debugName = development ? params.get('timeOfDay') : null;
    const speed = development ? Number(params.get('dayCycleSpeed')) : 1;
    this.debugSpeed = Number.isFinite(speed) && speed >= 0 ? speed : 1;
    this.epochMs = this.readOrCreateEpoch();
  }

  readOrCreateEpoch() {
    try {
      const parsed = JSON.parse(this.storage?.getItem?.(OUTDOOR_CLOCK_STORAGE_KEY) ?? 'null');
      if (parsed?.version === 1 && Number.isFinite(parsed.epochMs)) return parsed.epochMs;
      const epochMs = this.now();
      this.storage?.setItem?.(OUTDOOR_CLOCK_STORAGE_KEY, JSON.stringify({ version: 1, epochMs }));
      return epochMs;
    } catch { return this.now(); }
  }

  getSnapshot(atMs = this.now()) {
    const override = PHASES[this.debugName];
    const elapsedMs = Math.max(0, atMs - this.epochMs);
    const phase = Number.isFinite(override) ? override : resolveOutdoorPhase(elapsedMs * this.debugSpeed);
    const timeOfDay = resolveOutdoorTimeOfDay(phase);
    return {
      phase, elapsedMs, ...timeOfDay, ...resolveOutdoorSkyWeights(phase),
      skyRotation: positiveModulo(elapsedMs, OUTDOOR_SKY_ROTATION_DURATION_MS) / OUTDOOR_SKY_ROTATION_DURATION_MS * Math.PI * 2,
      redOrientation: timeOfDay.name === 'dusk' ? Math.PI : 0,
    };
  }
}

let sharedClock = null;
export function getOutdoorWorldClock(options = {}) {
  if (!sharedClock) sharedClock = new OutdoorWorldClock(options);
  return sharedClock;
}

export function resetOutdoorWorldClockForTests() { sharedClock = null; }
