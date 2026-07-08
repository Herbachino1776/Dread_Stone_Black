const DEFAULT_TITLE_AMBIENCE_SRC = null;
const DEFAULT_TITLE_AMBIENCE_VOLUME = 0.28;
const DEFAULT_AUDIO_TIMEOUT_MS = 1200;

function withTimeout(promise, timeoutMs, label) {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

export class TitleAmbience {
  constructor({ src = DEFAULT_TITLE_AMBIENCE_SRC, volume = DEFAULT_TITLE_AMBIENCE_VOLUME } = {}) {
    this.src = src;
    this.volume = volume;
    this.audio = null;
    this.audioContext = null;
    this.warned = false;
  }

  async unlockAndPlay({ timeoutMs = DEFAULT_AUDIO_TIMEOUT_MS } = {}) {
    if (!this.src) return;

    try {
      await this.resumeAudioContext({ timeoutMs });
      await this.playLoop({ timeoutMs });
    } catch (error) {
      this.warnOnce(`Title ambience at ${this.src} could not be unlocked. The game will continue without title audio.`, error);
    }
  }

  async resumeAudioContext({ timeoutMs = DEFAULT_AUDIO_TIMEOUT_MS } = {}) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      this.audioContext ??= new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        await withTimeout(this.audioContext.resume(), timeoutMs, 'Title audio context resume');
      }
    } catch (error) {
      this.warnOnce('Could not resume WebAudio context for title ambience.', error);
    }
  }

  async playLoop({ timeoutMs = DEFAULT_AUDIO_TIMEOUT_MS } = {}) {
    try {
      const audio = this.ensureAudioElement();
      await withTimeout(audio.play(), timeoutMs, 'Title ambience playback');
    } catch (error) {
      this.warnOnce(`Could not play title ambience at ${this.src}. The game will continue without title audio.`, error);
    }
  }

  ensureAudioElement() {
    if (this.audio) return this.audio;

    const audio = new Audio(this.src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = this.volume;
    this.audio = audio;
    return audio;
  }

  warnOnce(message, error) {
    if (this.warned) return;
    this.warned = true;
    console.warn(`[Dread Stone Black] ${message}`, error);
  }
}
