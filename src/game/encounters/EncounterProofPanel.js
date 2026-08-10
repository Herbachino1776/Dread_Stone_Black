import { M9_DEV_ENCOUNTER_ID, M9_FOLSOM_TWO_RAM_GODS_PROOF } from './EncounterDevFixtures.js';

function element(tag, text = null) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  return node;
}

export class EncounterProofPanel {
  constructor({ root, encounterRuntimeHost, playerDamageReceiver = null, playerProvider = null } = {}) {
    this.root = root;
    this.host = encounterRuntimeHost;
    this.playerDamageReceiver = playerDamageReceiver;
    this.playerProvider = playerProvider;
    this.busy = false;
    this.disposed = false;
    this.lastStatus = 'Ready. Spawn is explicit; this fixture is not canonical Folsom content.';
    this.build();
  }

  build() {
    this.toggle = element('button', 'M9 ENCOUNTER PROOF');
    this.toggle.type = 'button';
    this.toggle.style.cssText = 'position:fixed;right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));z-index:1201;min-height:48px;padding:0 14px;border:1px solid #a88b62;background:rgba(18,14,10,.94);color:#f0dfbd;font:700 11px/1.2 ui-monospace,monospace;touch-action:manipulation;';
    this.panel = element('section');
    this.panel.hidden = true;
    this.panel.style.cssText = 'position:fixed;z-index:1200;right:max(10px,env(safe-area-inset-right));bottom:max(68px,calc(env(safe-area-inset-bottom) + 58px));width:min(92vw,440px);max-height:72vh;overflow:auto;padding:12px;border:1px solid #8f7957;background:rgba(12,10,8,.96);color:#ead9b7;font:11px/1.38 ui-monospace,monospace;box-shadow:0 8px 30px rgba(0,0,0,.55);';
    const title = element('h2', 'M9 Encounter Runtime Proof');
    title.style.cssText = 'margin:0 0 10px;font:700 14px/1.2 Georgia,serif;letter-spacing:.05em;';
    this.controls = element('div');
    this.controls.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
    this.addButton('SPAWN ENCOUNTER PROOF', () => this.spawn(), true);
    this.addButton('RESET ENCOUNTER', () => this.reset());
    this.addButton('DESPAWN ENCOUNTER', () => this.despawn());
    this.addButton('RESET PLAYER', () => this.resetPlayer());
    this.addButton('CLAIM AVAILABLE GOLD', () => this.claimAvailable(), true);
    this.status = element('p', this.lastStatus);
    this.status.style.cssText = 'margin:10px 0;color:#d8c08f;';
    this.readout = element('pre', '');
    this.readout.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text;';
    this.panel.append(title, this.controls, this.status, this.readout);
    this.toggle.addEventListener('click', () => { this.panel.hidden = !this.panel.hidden; });
    this.root.append(this.toggle, this.panel);
    this.timer = window.setInterval(() => this.update(), 250);
    this.update();
  }

  addButton(label, action, wide = false) {
    const button = element('button', label);
    button.type = 'button';
    button.style.cssText = `min-height:48px;padding:8px;border:1px solid #78674c;background:#252017;color:#f0dfbd;font:700 10px/1.2 ui-monospace,monospace;touch-action:manipulation;${wide ? 'grid-column:1/-1;' : ''}`;
    button.addEventListener('click', () => void this.run(action));
    this.controls.append(button);
  }

  async run(action) {
    if (this.busy || this.disposed) return;
    this.busy = true;
    try { await action(); } catch (error) { this.lastStatus = `ERROR: ${error.message}`; } finally { this.busy = false; this.update(); }
  }

  async spawn() {
    if (this.host.locationId !== M9_FOLSOM_TWO_RAM_GODS_PROOF.locationId) throw new Error('Open the proof in Folsom (?area=folsom&m9EncounterProof=1).');
    const existing = this.host.getRuntime(M9_DEV_ENCOUNTER_ID);
    if (existing) { this.lastStatus = 'Proof encounter is already spawned.'; return; }
    const runtime = await this.host.spawnDefinition(M9_FOLSOM_TWO_RAM_GODS_PROOF);
    this.lastStatus = `Spawned ${runtime.enemies.length} independent runtime enemies.`;
  }

  async reset() {
    const result = await this.host.resetEncounter(M9_DEV_ENCOUNTER_ID);
    this.lastStatus = result.accepted ? 'Encounter reset from the same authored records; spawn IDs preserved and actor IDs renewed.' : `Reset rejected: ${result.reason}`;
  }

  despawn() {
    const removed = this.host.despawnEncounter(M9_DEV_ENCOUNTER_ID, 'm9-proof-panel-despawn');
    this.lastStatus = removed ? 'Encounter despawned and runtime resources released.' : 'No proof encounter is active.';
  }

  resetPlayer() {
    this.playerDamageReceiver?.reset?.();
    this.playerProvider?.()?.reset?.();
    this.lastStatus = 'Player combat state and spawn reset for the explicit dev proof.';
  }

  claimAvailable() {
    const runtime = this.host.getRuntime(M9_DEV_ENCOUNTER_ID);
    if (!runtime) { this.lastStatus = 'No proof encounter is active.'; return; }
    const results = runtime.enemies.map((enemy) => ({ spawnId: enemy.spawnId, result: enemy.claimLoot() }));
    const accepted = results.filter((entry) => entry.result.accepted).length;
    this.lastStatus = accepted ? `Claimed ${accepted} independent corpse reward${accepted === 1 ? '' : 's'}.` : `No claimable reward: ${results.map((entry) => `${entry.spawnId}=${entry.result.reason}`).join(', ')}`;
  }

  update() {
    if (this.disposed) return;
    this.status.textContent = this.lastStatus;
    const runtime = this.host.getRuntime(M9_DEV_ENCOUNTER_ID);
    const diagnostics = runtime?.getDiagnostics?.() ?? {
      encounterId: M9_DEV_ENCOUNTER_ID,
      spawnCount: M9_FOLSOM_TWO_RAM_GODS_PROOF.spawns.length,
      liveCount: 0,
      deadCount: 0,
      enemies: M9_FOLSOM_TWO_RAM_GODS_PROOF.spawns.map((spawn) => ({ spawnId: spawn.spawnId, presetId: spawn.presetId, actorInstanceId: null, brainState: 'NOT SPAWNED', distanceToHome: null, lifeState: 'absent', lootState: 'unavailable', resolvedGold: null })),
    };
    this.readout.textContent = [
      `Encounter ID  ${diagnostics.encounterId}`,
      `Spawn Count   ${diagnostics.spawnCount}`,
      `Live Count    ${diagnostics.liveCount}`,
      `Dead Count    ${diagnostics.deadCount}`,
      '',
      ...diagnostics.enemies.flatMap((enemy) => [
        `${enemy.spawnId}`,
        `  Preset      ${enemy.presetId}`,
        `  Actor       ${enemy.actorInstanceId ?? 'none'}`,
        `  Brain       ${enemy.brainState}`,
        `  Home Dist   ${Number.isFinite(enemy.distanceToHome) ? `${enemy.distanceToHome.toFixed(2)} m` : 'n/a'}`,
        `  Life        ${enemy.lifeState}`,
        `  Loot        ${enemy.lootState}`,
        `  Gold        ${Number.isSafeInteger(enemy.resolvedGold) ? enemy.resolvedGold : 'unresolved'}`,
      ]),
    ].join('\n');
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.clearInterval(this.timer);
    this.toggle?.remove?.();
    this.panel?.remove?.();
  }
}
