const HATCH_VISUAL_ID = 'beneath_folsom_lower_shrine_hatch';
const HATCH_BLOCKER_ID = 'beneath_folsom_lower_shrine_hatch_blocker';
const HATCH_INTERACTION_ID = 'beneath_folsom_lower_shrine_hatch_pry';

export class BeneathFolsomLowerShrineHatchRuntime {
  constructor({ collision, compiledGroup, gameState, interactions = [], audioRuntime = null } = {}) {
    this.collision = collision;
    this.gameState = gameState;
    this.interactions = interactions;
    this.audioRuntime = audioRuntime;
    this.blocker = (collision?.blockerRects ?? []).find((candidate) => candidate.id === HATCH_BLOCKER_ID) ?? null;
    this.parts = [
      HATCH_VISUAL_ID,
      'beneath_folsom_lower_shrine_hatch_band_left',
      'beneath_folsom_lower_shrine_hatch_band_right',
      'beneath_folsom_lower_shrine_hatch_crossbar',
      'beneath_folsom_lower_shrine_hatch_pry_socket',
      'beneath_folsom_lower_shrine_hatch_socket_stone',
    ].map((id) => compiledGroup?.getObjectByName(id)).filter(Boolean).map((object) => ({
      object,
      closedPosition: object.position.clone(),
      closedRotation: object.rotation.clone(),
    }));
    this.open = Boolean(gameState?.isBeneathFolsomLowerShrineHatchOpen?.());
    this.opening = false;
    this.progress = this.open ? 1 : 0;
    this.pryStrain = 0;
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
    this.progress = Math.max(this.progress, this.pryStrain * 0.38);
    this.gameState?.markBeneathFolsomLowerShrineHatchOpen?.();
    if (this.blocker) this.collision?.removeBlocker?.(this.blocker);
    const interaction = this.interactions.find((candidate) => candidate.id === HATCH_INTERACTION_ID);
    if (interaction) interaction.collected = true;
    this.audioRuntime?.play3D?.('audio_ch2_lower_shrine_hatch_final_pry_oneshot', { x: -2.18, y: 0.78, z: 60.98 });
    return { opened: true, message: 'Iron bites stone. The lower shrine hatch tears open.', audioAcceptedCuePlayed: true };
  }

  setPryStrain(strain = 0) {
    if (this.open) return;
    this.pryStrain = Math.max(this.pryStrain * 0.25, Math.min(1, Math.max(0, strain)));
    this.progress = this.pryStrain * 0.38;
    const finalStrain = this.pryStrain >= 0.8
      ? Math.sin(this.pryStrain * Math.PI * 34) * (this.pryStrain - 0.8) * 0.18
      : 0;
    this.applyProgress(this.progress, finalStrain);
  }

  releasePry(retainFactor = 0.18) {
    if (this.open) return;
    this.pryStrain *= Math.max(0, Math.min(1, retainFactor));
    this.progress = this.pryStrain * 0.38;
    this.applyProgress(this.progress);
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

  dispose() {}
}
