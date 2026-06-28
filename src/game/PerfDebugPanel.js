import * as THREE from 'three';

const UPDATE_MS = 333;
const WINDOW_MS = 5000;

export class PerfDebugPanel {
  constructor({ game }) {
    this.game = game;
    this.samples = [];
    this.lastTime = performance.now();
    this.lastRender = 0;
    this.expanded = false;
    this.toggles = { neckmen: true, foliage: true, shadows: true, gore: true, water: true, skybox: true, hud: true, lowDpr: false };
    this.originalBackground = this.scene?.background ?? null;
    this.originalFog = this.scene?.fog ?? null;
    this.originalShadowEnabled = this.renderer?.shadowMap?.enabled ?? true;
    this.normalPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.createUi();
    this.applyToggles();
  }

  createUi() {
    this.root = document.createElement('aside');
    this.root.className = 'perf-debug';
    this.root.innerHTML = `<button class="perf-debug__tab" type="button">PERF</button><div class="perf-debug__panel" hidden><pre class="perf-debug__report"></pre><div class="perf-debug__toggles"></div><div class="perf-debug__actions"><button data-perf-copy type="button">Copy Report</button><button data-perf-reset type="button">Reset Counters</button></div></div>`;
    this.root.style.cssText = 'position:absolute;left:6px;top:6px;z-index:35;font:10px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#f4f4f4;pointer-events:auto;max-width:min(94vw,360px);';
    this.root.querySelector('.perf-debug__tab').style.cssText = 'border:1px solid #bbb;background:rgba(0,0,0,.72);color:#fff;border-radius:5px;padding:5px 7px;font:bold 11px monospace;';
    this.panel = this.root.querySelector('.perf-debug__panel');
    this.panel.style.cssText = 'margin-top:4px;padding:7px;border:1px solid rgba(255,255,255,.35);border-radius:6px;background:rgba(0,0,0,.78);backdrop-filter:blur(2px);box-shadow:0 2px 10px rgba(0,0,0,.35);';
    this.reportEl = this.root.querySelector('.perf-debug__report');
    this.reportEl.style.cssText = 'margin:0 0 6px 0;white-space:pre-wrap;';
    this.togglesEl = this.root.querySelector('.perf-debug__toggles');
    this.togglesEl.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:6px;';
    this.root.querySelector('.perf-debug__actions').style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;';
    this.root.querySelectorAll('button').forEach((button) => { button.style.touchAction = 'manipulation'; });
    this.root.querySelector('.perf-debug__tab').addEventListener('pointerdown', (e) => { e.preventDefault(); this.setExpanded(!this.expanded); });
    this.root.querySelector('[data-perf-reset]').addEventListener('pointerdown', (e) => { e.preventDefault(); this.resetCounters(); });
    const copyButton = this.root.querySelector('[data-perf-copy]');
    copyButton.hidden = !navigator.clipboard;
    copyButton.addEventListener('pointerdown', (e) => { e.preventDefault(); navigator.clipboard?.writeText(this.lastReport ?? ''); });
    Object.keys(this.toggles).forEach((key) => this.addToggle(key));
    this.game.hudHost?.viewport?.append(this.root);
  }

  addToggle(key) {
    const label = key === 'lowDpr' ? 'DPR cap' : key;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.toggle = key;
    button.style.cssText = 'font:10px monospace;padding:3px;border:1px solid rgba(255,255,255,.25);border-radius:4px;background:rgba(24,24,24,.9);color:#fff;';
    button.addEventListener('pointerdown', (event) => { event.preventDefault(); this.toggles[key] = !this.toggles[key]; this.applyToggles(); this.render(true); });
    this.togglesEl.append(button);
    button.textContent = `${label}: ${this.toggles[key] ? 'on' : 'off'}`;
  }

  get renderer() { return this.game.rendererHost?.renderer; }
  get scene() { return this.game.sceneSessionHost?.scene; }
  get dungeon() { return this.game.sceneSessionHost?.dungeon; }
  get locationId() { return this.game.sceneSessionHost?.locationId; }

  setExpanded(expanded) { this.expanded = expanded; this.panel.hidden = !expanded; if (expanded) this.render(true); }
  resetCounters() { this.samples = []; this.lastTime = performance.now(); this.renderer?.info?.reset?.(); this.render(true); }

  update() {
    const now = performance.now();
    const delta = Math.max(0.001, now - this.lastTime);
    this.lastTime = now;
    this.samples.push({ t: now, ms: delta });
    while (this.samples[0] && now - this.samples[0].t > WINDOW_MS) this.samples.shift();
    if (this.expanded && now - this.lastRender >= UPDATE_MS) this.render();
  }

  applyToggles() {
    const d = this.dungeon;
    if (!d) return;
    d.perfDebugToggles = { ...this.toggles };
    d.fieldFoliageBillboards?.forEach((o) => { o.visible = this.toggles.foliage && o.visible; o.userData.perfHidden = !this.toggles.foliage; });
    d.compiledSkyDomes?.forEach((o) => { o.visible = this.toggles.skybox; });
    if (this.scene) { this.scene.background = this.toggles.skybox ? this.originalBackground : null; this.scene.fog = this.toggles.skybox ? this.originalFog : null; }
    if (this.renderer?.shadowMap) this.renderer.shadowMap.enabled = this.toggles.shadows && this.originalShadowEnabled;
    this.scene?.traverse((o) => {
      if (o.castShadow !== undefined) { if (o.userData.perfOriginalCastShadow === undefined) o.userData.perfOriginalCastShadow = o.castShadow; o.castShadow = this.toggles.shadows && o.userData.perfOriginalCastShadow; }
      const isWater = o.userData?.kind === 'pond' || /water/i.test(o.name ?? '');
      if (isWater) {
        o.userData.perfWaterAnimationDisabled = !this.toggles.water;
        const mats = Array.isArray(o.material) ? o.material : [o.material].filter(Boolean);
        mats.forEach((m) => { m.userData = { ...(m.userData ?? {}), perfWaterAnimationDisabled: !this.toggles.water }; });
      }
      const isGore = o.userData?.goreDecal || o.userData?.goreWound || o.userData?.goreParticle || /gore|blood|corpse/i.test(o.name ?? '');
      if (isGore) o.visible = this.toggles.gore;
    });
    this.game.app?.querySelector('.hud-top')?.toggleAttribute('hidden', !this.toggles.hud);
    this.game.app?.querySelector('.control-deck')?.toggleAttribute('hidden', !this.toggles.hud);
    this.renderer?.setPixelRatio(this.toggles.lowDpr ? Math.min(window.devicePixelRatio || 1, 1) : this.normalPixelRatio);
    this.game.resize?.();
    this.togglesEl?.querySelectorAll('[data-toggle]').forEach((button) => { const key = button.dataset.toggle; button.textContent = `${key === 'lowDpr' ? 'DPR cap' : key}: ${this.toggles[key] ? 'on' : 'off'}`; });
  }

  collect() {
    let objects = 0, meshes = 0, skinned = 0, transparent = 0, materials = new Set(), lights = 0, shadows = 0;
    this.scene?.traverse((o) => { objects += 1; if (o.isMesh || o.isSprite) { meshes += 1; if (o.isSkinnedMesh) skinned += 1; const mats = Array.isArray(o.material) ? o.material : [o.material].filter(Boolean); mats.forEach((m) => { materials.add(m.uuid ?? m.id ?? m); if (m.transparent || m.opacity < 1) transparent += 1; }); } if (o.isLight) lights += 1; if (o.castShadow) shadows += 1; });
    const enemies = this.dungeon?.blackGrassFactionManager?.enemies ?? this.dungeon?.sheepDemonEnemies ?? [];
    const activeEnemies = enemies.filter((e) => e?.isAlive !== false && !e?.isRemoved).length + (this.dungeon?.sheepDemonEnemy?.isAlive ? 1 : 0);
    const activeNeckmen = enemies.filter((e) => e?.species === 'neck_man' && e?.isAlive !== false && !e?.isRemoved).length;
    const neckmanStateCounts = enemies
      .filter((e) => e?.species === 'neck_man' && e?.isAlive !== false && !e?.isRemoved)
      .map((e) => `${e.id ?? e.group?.name ?? 'neckman'}:${e.animation?.getLoadedStates?.().join('|') ?? e.group?.userData?.loadedAnimationStates?.join('|') ?? 'none'}`);
    const activeAnimationMixers = enemies.reduce((sum, e) => sum + (e?.animation?.getActiveMixerCount?.() ?? 0), 0);
    const loadedCreatureAnimationRoots = enemies.reduce((sum, e) => sum + (e?.animation?.getLoadedRootCount?.() ?? 0), 0);
    const gore = this.dungeon?.goreRuntime?.getDebugSummary?.() ?? {};
    const info = this.renderer?.info;
    const size = new THREE.Vector2(); this.renderer?.getDrawingBufferSize?.(size);
    const avgMs = this.samples.reduce((s, x) => s + x.ms, 0) / Math.max(1, this.samples.length);
    return { currentFps: 1000 / (this.samples.at(-1)?.ms ?? 16.7), avgFps: 1000 / avgMs, worstMs: Math.max(0, ...this.samples.map((x) => x.ms)), calls: info?.render?.calls ?? 0, tris: info?.render?.triangles ?? 0, geoms: info?.memory?.geometries ?? 0, textures: info?.memory?.textures ?? 0, objects, meshes, skinned, transparent, materials: materials.size, lights, shadows, activeEnemies, activeNeckmen, activeAnimationMixers, loadedCreatureAnimationRoots, neckmanStateCounts, goreCount: (gore.activeParticles ?? 0) + (gore.decals ?? 0) + (gore.corpses ?? 0) + (gore.wounds ?? 0), dpr: this.renderer?.getPixelRatio?.() ?? window.devicePixelRatio, width: size.x, height: size.y, location: this.locationId ?? this.dungeon?.area ?? 'unknown' };
  }

  render(force = false) {
    const now = performance.now(); if (!force && now - this.lastRender < UPDATE_MS) return; this.lastRender = now;
    const m = this.collect();
    const toggleLine = `neckmen ${this.toggles.neckmen ? 'on' : 'off'}, foliage ${this.toggles.foliage ? 'on' : 'off'}, shadows ${this.toggles.shadows ? 'on' : 'off'}, gore ${this.toggles.gore ? 'on' : 'off'}, water ${this.toggles.water ? 'on' : 'off'}, dprCap ${this.toggles.lowDpr ? 'on' : 'off'}`;
    this.lastReport = `Location: ${m.location}\nFPS: ${m.currentFps.toFixed(0)} / avg ${m.avgFps.toFixed(0)} / worst ${m.worstMs.toFixed(1)}ms\nRenderer: ${m.calls} calls / ${m.tris} tris / ${m.geoms} geoms / ${m.textures} textures\nScene: ${m.objects} objects / ${m.meshes} meshes / ${m.skinned} skinned / ${m.transparent} transparent / ${m.materials} materials / ${m.lights} lights / ${m.shadows} shadows\nGameplay: ${m.activeEnemies} enemies / ${m.activeNeckmen} neckmen / ${m.goreCount} gore\nCreature anim: ${m.activeAnimationMixers} active mixers / ${m.loadedCreatureAnimationRoots} loaded roots\nNeckman states: ${m.neckmanStateCounts.length ? m.neckmanStateCounts.join(', ') : 'none'}\nDPR: ${m.dpr.toFixed(2)}  Canvas: ${m.width}x${m.height}\nToggles: ${toggleLine}`;
    this.reportEl.textContent = this.lastReport;
  }

  dispose() {
    this.root?.remove?.();
    this.game = null;
  }
}
