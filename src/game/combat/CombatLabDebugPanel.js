export class CombatLabDebugPanel {
  constructor({ app, dungeon, equipmentRuntime } = {}) {
    this.app = app;
    this.dungeon = dungeon;
    this.equipmentRuntime = equipmentRuntime;
    this.debugVisible = false;
    this.woundAnchorsVisible = false;
    this.slow = false;
    this.frozen = false;
    this.lightingMode = 0;
    this.consciousnessMode = 0;
    this.bloodMode = 0;
    this.lastTextUpdate = 0;
    this.disposers = [];
    this.build();
    this.bindKeyboard();
  }

  build() {
    this.panel = document.createElement('aside');
    this.panel.dataset.combatLabPanel = 'true';
    this.panel.style.cssText = 'position:fixed;z-index:1400;top:calc(env(safe-area-inset-top) + 6px);right:calc(env(safe-area-inset-right) + 6px);width:min(46vw,360px);max-height:58vh;overflow:auto;padding:7px;border:1px solid #685b4d;background:#0a0a0bd9;color:#d9d2c7;font:10px/1.32 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:auto;';
    const title = document.createElement('div');
    title.textContent = 'PHYSICAL COMBAT LAB';
    title.style.cssText = 'font-weight:700;letter-spacing:.12em;margin-bottom:6px;color:#e1b98a';
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px';
    const definitions = [
      ['RESET R', () => this.reset()],
      ['KNIFE K', () => this.restoreKnife()],
      ['DEBUG B', () => this.toggleDebug()],
      ['ANCHORS A', () => this.toggleWoundAnchors()],
      ['FREEZE P', () => this.toggleFreeze()],
      ['SLOW O', () => this.toggleSlow()],
      ['DAY/NIGHT N', () => this.toggleNight()],
      ['PANEL M', () => this.togglePanel()],
      ['PUSH I', () => this.dungeon?.weaponController?.nudgeExtension?.(0.1)],
      ['PULL U', () => this.dungeon?.weaponController?.nudgeExtension?.(-0.1)],
      ['SLASH <', () => this.dungeon?.weaponController?.nudgeAim?.(-0.22, 0)],
      ['SLASH >', () => this.dungeon?.weaponController?.nudgeAim?.(0.22, 0)],
      ['STEP .', () => this.dungeon?.stepPhysics?.()],
      ['WOUNDS C', () => this.dungeon?.clearWounds?.()],
      ['BLOOD V', () => this.dungeon?.clearBlood?.()],
      ['HAPTIC H', () => this.toggleHaptics()],
      ['MUTE Q', () => this.toggleMute()],
      ['CONSC Y', () => this.cycleConsciousness()],
      ['RESERVE G', () => this.cycleBloodReserve()],
      ['MORTALITY X', () => this.toggleMortality()],
      ['RAGDOLL Z', () => this.forceRagdoll()],
      ['CUT TEST 6', () => this.dungeon?.createDebugSlash?.()],
      ['CHEST 1', () => this.triggerCollapse('chest_fold', false)],
      ['NECK 2', () => this.triggerCollapse('neck_failure', true)],
      ['HEAD 3', () => this.triggerCollapse('neurological', true)],
      ['LEG 4', () => this.triggerCollapse('leg_failure', false)],
      ['LOSS 5', () => this.triggerCollapse('blood_loss', true)],
      ['TORCH T', () => this.equipLight('torch')],
      ['LANTERN L', () => this.equipLight('keepers_lantern')],
    ];
    definitions.forEach(([label, action]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.cssText = 'padding:4px 6px;border:1px solid #746657;background:#26211d;color:#e7ddd0;font:10px monospace;touch-action:manipulation';
      button.addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); action(); });
      controls.append(button);
    });
    this.readout = document.createElement('pre');
    this.readout.dataset.combatLabDiagnostics = 'true';
    this.readout.style.cssText = 'margin:0;white-space:pre-wrap;color:#b9d7ce;user-select:text';
    this.panel.append(title, controls, this.readout);
    this.app.append(this.panel);
  }

  bindKeyboard() {
    const keydown = (event) => {
      if (event.repeat || event.target?.matches?.('input,textarea,select')) return;
      if (event.code === 'KeyR') this.reset();
      if (event.code === 'KeyK') this.restoreKnife();
      if (event.code === 'KeyB') this.toggleDebug();
      if (event.code === 'KeyA') this.toggleWoundAnchors();
      if (event.code === 'KeyP') this.toggleFreeze();
      if (event.code === 'KeyO') this.toggleSlow();
      if (event.code === 'KeyN') this.toggleNight();
      if (event.code === 'KeyM') this.togglePanel();
      if (event.code === 'KeyI') this.dungeon?.weaponController?.nudgeExtension?.(0.1);
      if (event.code === 'KeyU') this.dungeon?.weaponController?.nudgeExtension?.(-0.1);
      if (event.code === 'KeyJ') this.dungeon?.weaponController?.nudgeAim?.(-0.22, 0);
      if (event.code === 'Semicolon') this.dungeon?.weaponController?.nudgeAim?.(0.22, 0);
      if (event.code === 'Period') this.dungeon?.stepPhysics?.();
      if (event.code === 'KeyC') this.dungeon?.clearWounds?.();
      if (event.code === 'KeyV') this.dungeon?.clearBlood?.();
      if (event.code === 'KeyH') this.toggleHaptics();
      if (event.code === 'KeyQ') this.toggleMute();
      if (event.code === 'KeyY') this.cycleConsciousness();
      if (event.code === 'KeyG') this.cycleBloodReserve();
      if (event.code === 'KeyX') this.toggleMortality();
      if (event.code === 'KeyZ') this.forceRagdoll();
      if (event.code === 'Digit6') this.dungeon?.createDebugSlash?.();
      if (event.code === 'Digit1') this.triggerCollapse('chest_fold', false);
      if (event.code === 'Digit2') this.triggerCollapse('neck_failure', true);
      if (event.code === 'Digit3') this.triggerCollapse('neurological', true);
      if (event.code === 'Digit4') this.triggerCollapse('leg_failure', false);
      if (event.code === 'Digit5') this.triggerCollapse('blood_loss', true);
      if (event.code === 'KeyT') this.equipLight('torch');
      if (event.code === 'KeyL') this.equipLight('keepers_lantern');
    };
    window.addEventListener('keydown', keydown);
    this.disposers.push(() => window.removeEventListener('keydown', keydown));
  }

  reset() { this.dungeon?.resetActor?.(); }
  restoreKnife() {
    if (!this.equipmentRuntime?.hasItem?.('old_work_knife')) this.equipmentRuntime?.acquireItem?.('old_work_knife', { source: 'combat_lab_ephemeral' });
    this.equipmentRuntime?.equip?.('tool', 'old_work_knife');
  }
  toggleDebug() {
    this.debugVisible = !this.debugVisible;
    this.dungeon?.actor?.setDebugVisible?.(this.debugVisible);
    this.dungeon?.weaponController?.setDebugVisible?.(this.debugVisible);
  }
  toggleWoundAnchors() {
    this.woundAnchorsVisible = !this.woundAnchorsVisible;
    this.dungeon?.actor?.setWoundSurfaceDebugVisible?.(this.woundAnchorsVisible);
  }
  toggleFreeze() { this.frozen = !this.frozen; this.dungeon?.setPhysicsPaused?.(this.frozen); }
  toggleSlow() { this.slow = !this.slow; this.dungeon?.setPhysicsSlow?.(this.slow); }
  toggleNight() {
    this.lightingMode = (this.lightingMode + 1) % 5;
    this.dungeon?.setLightingMode?.(['day', 'dusk', 'night-dark', 'night-torch', 'night-lantern'][this.lightingMode]);
  }
  toggleHaptics() { this.dungeon.feedbackSystem.setHapticsEnabled(!this.dungeon.feedbackSystem.hapticsEnabled); }
  toggleMute() { this.dungeon.feedbackSystem.setMuted(!this.dungeon.feedbackSystem.muted); }
  cycleConsciousness() { const values = [1, 0.5, 0.15]; this.consciousnessMode = (this.consciousnessMode + 1) % values.length; this.dungeon.actor.physiology.setConsciousness(values[this.consciousnessMode]); }
  cycleBloodReserve() { const values = [1, 0.45, 0.12]; this.bloodMode = (this.bloodMode + 1) % values.length; this.dungeon.actor.physiology.setBloodReserve(values[this.bloodMode]); }
  toggleMortality() { this.dungeon?.toggleMortalityMode?.(); }
  forceRagdoll() { this.dungeon?.actor?.forceRagdoll?.(); }
  triggerCollapse(family, lethal) { this.dungeon.actor.requestCollapse(family, { immediate: family === 'neurological' || family === 'neck_failure', lethal }); }
  equipLight(itemId) {
    if (!this.equipmentRuntime.hasItem(itemId)) this.equipmentRuntime.acquireItem(itemId, { source: 'combat_lab_ephemeral' });
    this.equipmentRuntime.equip('offhand', itemId);
    this.lightingMode = itemId === 'torch' ? 3 : 4;
    this.dungeon.setLightingMode(itemId === 'torch' ? 'night-torch' : 'night-lantern');
  }
  togglePanel() {
    this.readout.hidden = !this.readout.hidden;
    this.panel.style.width = this.readout.hidden ? 'auto' : 'min(46vw,360px)';
  }

  update(now = performance.now(), frameTimeMs = 0) {
    if (now - this.lastTextUpdate < 80) return;
    this.lastTextUpdate = now;
    const diagnostics = this.dungeon?.getDiagnostics?.() ?? {};
    const physics = diagnostics.physics ?? {};
    const actor = diagnostics.actor ?? {};
    const weapon = diagnostics.weapon ?? {};
    const director = diagnostics.director ?? {};
    const blood = diagnostics.blood ?? {};
    const feedback = diagnostics.feedback ?? {};
    const physiology = actor.physiology ?? {};
    const wounds = actor.wounds ?? {};
    const reaction = actor.visualAdapter?.reaction ?? {};
    this.readout.textContent = [
      `frame ${frameTimeMs.toFixed?.(2) ?? frameTimeMs}ms  physics ${(physics.physicsStepMs ?? 0).toFixed(2)}ms x${physics.substeps ?? 0}`,
      `bodies ${physics.rigidBodies ?? 0}  constraints ${physics.constraints ?? 0}  contacts ${physics.activeContacts ?? 0}  sweeps ${physics.weaponSweeps ?? 0}`,
      `time ${this.frozen ? 'FROZEN' : this.slow ? '20%' : '100%'}  light ${['DAY', 'DUSK', 'NIGHT-DARK', 'TORCH', 'LANTERN'][this.lightingMode]}  resets ${physics.resetCount ?? 0}`,
      '',
      `actor ${actor.state ?? 'unknown'}  mortality ${actor.mortalityMode ?? 'unknown'}  motor ${(actor.motorStrength ?? 0).toFixed(2)}`,
      `balance ${(actor.balanceImpairment ?? 0).toFixed(2)}  consciousness ${(actor.consciousnessImpairment ?? 0).toFixed(2)}  wounds ${actor.activeWounds ?? 0}`,
      `blood ${(physiology.bloodReserve ?? 1).toFixed(3)}  loss/s ${(physiology.bloodLossRate ?? 0).toFixed(4)}  shock ${(physiology.shock ?? 0).toFixed(2)}  conscious ${(physiology.consciousness ?? 1).toFixed(2)}`,
      `breathing ${physiology.breathingState ?? '-'}  collapse ${actor.collapseFamily ?? '-'}  ragdoll ${actor.ragdollActive ? 'ACTIVE' : 'OFF'}  sleep ${actor.corpseSleeping ? 'YES' : 'NO'}`,
      `wound ${JSON.stringify(wounds.selected ?? null)}`,
      `reaction ${reaction.region ?? '-'}  severity ${(reaction.severity ?? 0).toFixed(2)}  phase ${reaction.phase ?? 'idle'}  remaining ${(reaction.timeRemaining ?? 0).toFixed(3)}s`,
      `reaction bones ${JSON.stringify(reaction.affectedBones ?? [])}`,
      `additive deg ${JSON.stringify(reaction.additiveAngles ?? {})}`,
      `binding ${wounds.selected?.surfaceBindingStatus ?? '-'}  mesh ${wounds.selected?.meshName ?? '-'}  tri ${JSON.stringify(wounds.selected?.triangleIndices ?? null)}`,
      `bary ${JSON.stringify(wounds.selected?.barycentric ?? null)}  surface ${(wounds.selected?.surfaceDistance ?? 0).toFixed(4)}m  slash samples ${wounds.selected?.slashSampleCount ?? 0}`,
      `projection failures ${wounds.failedProjectionCount ?? 0}  fallback ${wounds.fallbackAnchorUsage ?? 0}  anchors ${this.woundAnchorsVisible ? 'ON' : 'OFF'}`,
      `blood fx ${blood.particles ?? 0}/${blood.particleLimit ?? 0}  decals ${blood.decals ?? 0}/${blood.decalLimit ?? 0}`,
      `audio ${feedback.activeVoices ?? 0} voices  haptic ${feedback.activeHapticEvents ?? 0}  event ${feedback.lastEvent ?? '-'}  mute ${feedback.muted ? 'YES' : 'NO'}`,
      `trauma ${JSON.stringify(actor.regionalTrauma ?? {})}`,
      `pose ${JSON.stringify(actor.bodyPositions ?? {})}`,
      `ragdoll bones ${JSON.stringify(actor.visualAdapter?.ragdollBonePositions ?? {})}  bindings ${actor.visualAdapter?.ragdollBindingCount ?? 0}`,
      '',
      `director ${(director.time ?? 0).toFixed(3)}s  active ${director.activeInteractions ?? 0}  queued ${director.queuedEvents ?? 0}`,
      `directed event ${JSON.stringify(director.lastEvent ?? null)}`,
      '',
      `knife ${weapon.equipped ? 'EQUIPPED' : 'HOLSTERED'}  ${weapon.state ?? 'unavailable'}`,
      `reason ${weapon.reason ?? '-'}  intent ${weapon.intent ?? '-'} (${weapon.intentReason ?? '-'})`,
      `pos ${JSON.stringify(weapon.worldPosition ?? [])}`,
      `rot ${JSON.stringify(weapon.worldRotation ?? [])}`,
      `forward ${JSON.stringify(weapon.bladeForward ?? [])}`,
      `desired ${JSON.stringify(weapon.desiredHand ?? [])}`,
      `actual ${JSON.stringify(weapon.actualHand ?? [])}`,
      `depth ${(weapon.penetrationDepth ?? 0).toFixed(3)}m  deliberate ${JSON.stringify(weapon.deliberateInputVelocity ?? [])}`,
      `total world ${JSON.stringify(weapon.totalWorldVelocity ?? [])}  offensive ${JSON.stringify(weapon.offensiveVelocity ?? [])}`,
      `owner ${weapon.gripPointerOwner ?? '-'}  attack ${weapon.attackEnabled ? 'ENABLED' : 'SAFE'}  ${weapon.contactDamageReason ?? '-'}`,
      `visual/collision error ${(weapon.visibleCollisionError ?? 0).toFixed(5)}m`,
      `part ${weapon.contactPart ?? '-'}  wound ${weapon.activeWoundId ?? '-'}  interaction ${weapon.activeCombatInteractionId ?? '-'}`,
      `slash ${JSON.stringify(weapon.activeSlash ?? null)}`,
      '',
      'Grip handle, then up: thrust | down: withdraw | side: slash',
      'Release: safe spring return | X mortality | B debug',
    ].join('\n');
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.panel?.remove();
  }
}
