const HATCH_VISUAL_ID = 'beneath_folsom_lower_shrine_hatch';
const HATCH_BLOCKER_ID = 'beneath_folsom_lower_shrine_hatch_blocker';
const HATCH_INTERACTION_ID = 'beneath_folsom_lower_shrine_hatch_pry';

export class BeneathFolsomLowerShrineHatchRuntime {
  constructor({ collision, compiledGroup, gameState, interactions = [] } = {}) {
    this.collision = collision;
    this.gameState = gameState;
    this.interactions = interactions;
    this.blocker = (collision?.blockerRects ?? []).find((candidate) => candidate.id === HATCH_BLOCKER_ID) ?? null;
    this.parts = [
      HATCH_VISUAL_ID,
      'beneath_folsom_lower_shrine_hatch_band_left',
      'beneath_folsom_lower_shrine_hatch_band_right',
      'beneath_folsom_lower_shrine_hatch_crossbar',
    ].map((id) => compiledGroup?.getObjectByName(id)).filter(Boolean).map((object) => ({
      object,
      closedPosition: object.position.clone(),
      closedRotation: object.rotation.clone(),
    }));
    this.open = Boolean(gameState?.isBeneathFolsomLowerShrineHatchOpen?.());
    this.opening = false;
    this.progress = this.open ? 1 : 0;
    this.audioContext = null;
    if (this.open) this.applyOpenState();
  }

  pry({ hasDrainBar = false } = {}) {
    if (this.open) return { opened: false, message: 'The lower shrine hatch lies forced open.' };
    if (!this.gameState?.isBeneathFolsomHiddenGrowthGateCleared?.()) {
      return { opened: false, message: 'The buried hatch has no exposed edge to work.' };
    }
    if (!hasDrainBar) return { opened: false, message: 'The stone-bound hatch will not move by hand.' };

    this.open = true;
    this.opening = true;
    this.progress = 0;
    this.gameState?.markBeneathFolsomLowerShrineHatchOpen?.();
    if (this.blocker) this.collision?.removeBlocker?.(this.blocker);
    const interaction = this.interactions.find((candidate) => candidate.id === HATCH_INTERACTION_ID);
    if (interaction) interaction.collected = true;
    this.playStrain();
    return { opened: true, message: 'Iron bites stone. The lower shrine hatch tears open.' };
  }

  applyOpenState() {
    if (this.blocker) this.collision?.removeBlocker?.(this.blocker);
    this.progress = 1;
    this.opening = false;
    this.applyProgress(1);
    const interaction = this.interactions.find((candidate) => candidate.id === HATCH_INTERACTION_ID);
    if (interaction) interaction.collected = true;
  }

  update(deltaSeconds) {
    if (!this.opening) return;
    this.progress = Math.min(1, this.progress + Math.min(deltaSeconds, 0.05) * 0.48);
    const strained = this.progress < 0.22
      ? Math.sin(this.progress * Math.PI * 18) * this.progress * 0.11
      : 0;
    const movementProgress = Math.max(0, (this.progress - 0.12) / 0.88);
    const eased = 1 - ((1 - movementProgress) ** 3);
    this.applyProgress(eased, strained);
    if (this.progress >= 1) this.opening = false;
  }

  applyProgress(progress, strain = 0) {
    this.parts.forEach(({ object, closedPosition, closedRotation }, index) => {
      object.position.copy(closedPosition);
      object.rotation.copy(closedRotation);
      object.position.y -= progress * 2.45;
      object.position.z += progress * 0.92;
      object.position.x += strain * (index % 2 ? -1 : 1);
      object.rotation.x -= progress * 1.18;
      object.rotation.z += strain * 0.24;
    });
  }

  playStrain() {
    try {
      const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioContext ??= new AudioContextClass();
      const context = this.audioContext;
      if (context.state === 'suspended') context.resume?.();
      const duration = 1.85;
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) {
        const t = index / data.length;
        const scrape = (Math.random() * 2 - 1) * (0.32 + Math.sin(index * 0.071) * 0.12);
        const groan = Math.sin(index * 0.013 + Math.sin(index * 0.0007) * 5) * 0.42;
        data[index] = (scrape + groan) * Math.sin(Math.min(1, t * 9) * Math.PI * 0.5) * Math.exp(-t * 1.25);
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      gain.gain.value = 0.2;
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      source.start();
    } catch {
      // Browsers may block WebAudio. Movement and camera feedback remain authoritative.
    }
  }

  dispose() {
    this.audioContext?.close?.();
    this.audioContext = null;
  }
}
