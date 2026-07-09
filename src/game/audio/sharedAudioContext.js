const DEFAULT_UNLOCK_TIMEOUT_MS = 1200;

let sharedAudioContext = null;
let silentUnlockCount = 0;

function getAudioContextClass() {
  return globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

export function getSharedAudioContext() {
  return sharedAudioContext?.state === 'closed' ? null : sharedAudioContext;
}

export function ensureSharedAudioContext() {
  const existing = getSharedAudioContext();
  if (existing) return existing;

  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) return null;
  sharedAudioContext = new AudioContextClass();
  return sharedAudioContext;
}

export function playSilentUnlockTick(context = ensureSharedAudioContext()) {
  if (!context || context.state === 'closed') return false;
  try {
    const source = context.createBufferSource();
    const gain = context.createGain();
    const buffer = context.createBuffer(1, 1, Math.max(1, context.sampleRate || 44100));
    gain.gain.value = 0;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.start(0);
    source.stop(context.currentTime + 0.01);
    silentUnlockCount += 1;
    window.setTimeout(() => {
      source.disconnect();
      gain.disconnect();
    }, 80);
    return true;
  } catch {
    return false;
  }
}

export async function unlockSharedAudioContext({ timeoutMs = DEFAULT_UNLOCK_TIMEOUT_MS } = {}) {
  const context = ensureSharedAudioContext();
  if (!context) return null;

  playSilentUnlockTick(context);
  if (context.state === 'suspended' || context.state === 'interrupted') {
    await withTimeout(context.resume(), timeoutMs, 'Shared audio context resume');
  }
  if (context.state === 'running') playSilentUnlockTick(context);
  return context;
}

export function getSharedAudioContextDebugState() {
  const context = getSharedAudioContext();
  return {
    state: context?.state ?? 'none',
    sampleRate: context?.sampleRate ?? null,
    silentUnlockCount,
  };
}
