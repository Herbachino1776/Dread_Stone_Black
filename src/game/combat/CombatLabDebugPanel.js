export class CombatLabDebugPanel {
  constructor({ app, dungeon, equipmentRuntime } = {}) {
    this.app = app;
    this.dungeon = dungeon;
    this.equipmentRuntime = equipmentRuntime;
    this.debugVisible = false;
    this.slow = false;
    this.frozen = false;
    this.lightingMode = 0;
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
      ['FREEZE P', () => this.toggleFreeze()],
      ['SLOW O', () => this.toggleSlow()],
      ['DAY/NIGHT N', () => this.toggleNight()],
      ['PANEL M', () => this.togglePanel()],
      ['PUSH I', () => this.dungeon?.weaponController?.nudgeExtension?.(0.1)],
      ['PULL U', () => this.dungeon?.weaponController?.nudgeExtension?.(-0.1)],
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
      if (event.code === 'KeyP') this.toggleFreeze();
      if (event.code === 'KeyO') this.toggleSlow();
      if (event.code === 'KeyN') this.toggleNight();
      if (event.code === 'KeyM') this.togglePanel();
      if (event.code === 'KeyI') this.dungeon?.weaponController?.nudgeExtension?.(0.1);
      if (event.code === 'KeyU') this.dungeon?.weaponController?.nudgeExtension?.(-0.1);
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
  toggleFreeze() { this.frozen = !this.frozen; this.dungeon?.setPhysicsPaused?.(this.frozen); }
  toggleSlow() { this.slow = !this.slow; this.dungeon?.setPhysicsSlow?.(this.slow); }
  toggleNight() {
    this.lightingMode = (this.lightingMode + 1) % 3;
    this.dungeon?.setLightingMode?.(['day', 'night-dark', 'night-local'][this.lightingMode]);
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
    this.readout.textContent = [
      `frame ${frameTimeMs.toFixed?.(2) ?? frameTimeMs}ms  physics ${(physics.physicsStepMs ?? 0).toFixed(2)}ms x${physics.substeps ?? 0}`,
      `bodies ${physics.rigidBodies ?? 0}  constraints ${physics.constraints ?? 0}  contacts ${physics.activeContacts ?? 0}  sweeps ${physics.weaponSweeps ?? 0}`,
      `time ${this.frozen ? 'FROZEN' : this.slow ? '20%' : '100%'}  light ${['DAY', 'NIGHT-DARK', 'NIGHT+LOCAL'][this.lightingMode]}  resets ${physics.resetCount ?? 0}`,
      '',
      `actor ${actor.state ?? 'unknown'}  motor ${(actor.motorStrength ?? 0).toFixed(2)}`,
      `balance ${(actor.balanceImpairment ?? 0).toFixed(2)}  consciousness ${(actor.consciousnessImpairment ?? 0).toFixed(2)}  wounds ${actor.activeWounds ?? 0}`,
      `trauma ${JSON.stringify(actor.regionalTrauma ?? {})}`,
      `pose ${JSON.stringify(actor.bodyPositions ?? {})}`,
      '',
      `knife ${weapon.equipped ? 'EQUIPPED' : 'HOLSTERED'}  ${weapon.state ?? 'unavailable'}`,
      `reason ${weapon.reason ?? '-'}`,
      `pos ${JSON.stringify(weapon.worldPosition ?? [])}`,
      `rot ${JSON.stringify(weapon.worldRotation ?? [])}`,
      `forward ${JSON.stringify(weapon.bladeForward ?? [])}`,
      `desired ${JSON.stringify(weapon.desiredHand ?? [])}`,
      `actual ${JSON.stringify(weapon.actualHand ?? [])}`,
      `depth ${(weapon.penetrationDepth ?? 0).toFixed(3)}m  speed ${(weapon.forwardVelocity ?? 0).toFixed(2)}m/s`,
      `visual/collision error ${(weapon.visibleCollisionError ?? 0).toFixed(5)}m`,
      '',
      'Grip-drag: hand aim | ATTACK drag up/down: insert/extract',
      'Desktop: Space advance | Shift withdraw | B debug',
    ].join('\n');
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.panel?.remove();
  }
}
