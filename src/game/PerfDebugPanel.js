import * as THREE from 'three';

const UPDATE_MS = 350;

export class PerfDebugPanel {
  constructor({ game }) {
    this.game = game;
    this.renderer = game.rendererHost?.renderer ?? game.renderer;
    this.scene = game.sceneSessionHost?.scene ?? game.scene;
    this.dungeon = game.sceneSessionHost?.dungeon ?? game.dungeon;
    this.locationId = game.sceneSessionHost?.locationId ?? this.dungeon?.area;
    this.samples = [];
    this.startedAt = performance.now();
    this.lastRender = 0;
    this.toggles = { foliage: true, shadows: true, water: true, skybox: true, hud: true, lowDpr: false };
    this.originalPixelRatio = this.renderer?.getPixelRatio?.() ?? window.devicePixelRatio ?? 1;
    this.originalBackground = this.scene?.background ?? null;
    this.originalFog = this.scene?.fog ?? null;
    this.originalShadowEnabled = this.renderer?.shadowMap?.enabled ?? true;
    this.root = document.createElement('section');
    this.root.className = 'perf-debug-panel';
    this.root.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:50;max-height:46vh;overflow:auto;padding:8px;background:rgba(7,8,7,.86);color:#d8f8cf;border:1px solid rgba(160,255,160,.35);font:11px/1.35 monospace;white-space:pre-wrap;pointer-events:auto;';
    this.togglesEl = document.createElement('div');
    this.reportEl = document.createElement('pre');
    this.reportEl.style.margin = '6px 0 0';
    Object.keys(this.toggles).forEach((key) => {
      const button = document.createElement('button');
      button.dataset.toggle = key;
      button.type = 'button';
      button.style.cssText = 'margin:0 4px 4px 0;font:11px monospace;';
      button.addEventListener('click', () => { this.toggles[key] = !this.toggles[key]; this.applyToggles(); this.render(true); });
      this.togglesEl.append(button);
    });
    this.root.append(this.togglesEl, this.reportEl);
    document.body.append(this.root);
    this.applyToggles();
  }

  update() {
    const renderer = this.game.rendererHost?.renderer ?? this.renderer;
    if (renderer && renderer !== this.renderer) this.renderer = renderer;
    this.scene = this.game.sceneSessionHost?.scene ?? this.scene;
    this.dungeon = this.game.sceneSessionHost?.dungeon ?? this.dungeon;
    this.locationId = this.game.sceneSessionHost?.locationId ?? this.dungeon?.area ?? this.locationId;
    const now = performance.now();
    const previous = this.lastSampleAt ?? now;
    this.lastSampleAt = now;
    this.samples.push({ ms: Math.max(0.01, now - previous) });
    if (this.samples.length > 90) this.samples.shift();
  }

  applyToggles() {
    const d = this.dungeon;
    d?.fieldFoliageGroup?.traverse?.((o) => { o.visible = this.toggles.foliage; });
    d?.compiledSkyDomes?.forEach((o) => { o.visible = this.toggles.skybox; });
    if (this.scene) {
      this.scene.background = this.toggles.skybox ? this.originalBackground : null;
      this.scene.fog = this.toggles.skybox ? this.originalFog : null;
    }
    if (this.renderer?.shadowMap) this.renderer.shadowMap.enabled = this.toggles.shadows && this.originalShadowEnabled;
    this.scene?.traverse((o) => {
      if (o.castShadow !== undefined) {
        if (o.userData.perfOriginalCastShadow === undefined) o.userData.perfOriginalCastShadow = o.castShadow;
        o.castShadow = this.toggles.shadows && o.userData.perfOriginalCastShadow;
      }
      const isWater = o.userData?.kind === 'pond' || /water/i.test(o.name ?? '');
      if (isWater) {
        o.userData.perfWaterAnimationDisabled = !this.toggles.water;
        const mats = Array.isArray(o.material) ? o.material : [o.material].filter(Boolean);
        mats.forEach((m) => { m.userData = { ...(m.userData ?? {}), perfWaterAnimationDisabled: !this.toggles.water }; });
      }
    });
    this.game.app?.querySelector('.hud-top')?.toggleAttribute('hidden', !this.toggles.hud);
    this.game.app?.querySelector('.control-deck')?.toggleAttribute('hidden', !this.toggles.hud);
    this.renderer?.setPixelRatio(this.toggles.lowDpr ? Math.min(window.devicePixelRatio || 1, 1) : this.originalPixelRatio);
    this.game.resize?.();
    this.togglesEl?.querySelectorAll('[data-toggle]').forEach((button) => { const key = button.dataset.toggle; button.textContent = `${key === 'lowDpr' ? 'DPR cap' : key}: ${this.toggles[key] ? 'on' : 'off'}`; });
  }

  collect() {
    let objects = 0; let meshes = 0; let skinned = 0; let transparent = 0; const materials = new Set(); let lights = 0; let shadows = 0;
    this.scene?.traverse((o) => {
      objects += 1;
      if (o.isMesh || o.isSprite) {
        meshes += 1;
        if (o.isSkinnedMesh) skinned += 1;
        const mats = Array.isArray(o.material) ? o.material : [o.material].filter(Boolean);
        mats.forEach((m) => { materials.add(m.uuid ?? m.id ?? m); if (m.transparent || m.opacity < 1) transparent += 1; });
      }
      if (o.isLight) lights += 1;
      if (o.castShadow) shadows += 1;
    });
    const info = this.renderer?.info;
    const size = new THREE.Vector2(); this.renderer?.getDrawingBufferSize?.(size);
    const avgMs = this.samples.reduce((sum, sample) => sum + sample.ms, 0) / Math.max(1, this.samples.length);
    return { sessionAgeSeconds: (performance.now() - this.startedAt) / 1000, currentFps: 1000 / (this.samples.at(-1)?.ms ?? 16.7), avgFps: 1000 / avgMs, worstMs: Math.max(0, ...this.samples.map((x) => x.ms)), calls: info?.render?.calls ?? 0, tris: info?.render?.triangles ?? 0, geoms: info?.memory?.geometries ?? 0, textures: info?.memory?.textures ?? 0, objects, meshes, skinned, transparent, materials: materials.size, lights, shadows, dpr: this.renderer?.getPixelRatio?.() ?? window.devicePixelRatio, width: size.x, height: size.y, location: this.locationId ?? 'unknown', locationLoad: this.game.sceneSessionHost?.getLocationLoadDebugSummary?.() ?? null };
  }

  render(force = false) {
    const now = performance.now();
    if (!force && now - this.lastRender < UPDATE_MS) return;
    this.lastRender = now;
    const m = this.collect();
    const locationLoadLine = m.locationLoad ? `Location load: current ${m.locationLoad.currentLocationId ?? 'n/a'} / loaded ${(m.locationLoad.loadedLocationIds ?? []).join(',') || 'none'} / scene ${m.locationLoad.activeSceneDefinitionId ?? 'n/a'} / collision ${m.locationLoad.activeCollisionSourceId ?? 'n/a'} / routes ${m.locationLoad.routeRegistryLoaded ? 'yes' : 'no'} / lazy pending ${m.locationLoad.lazyLocationsPending ? 'yes' : 'no'}\n` : '';
    const toggleLine = `foliage ${this.toggles.foliage ? 'on' : 'off'}, shadows ${this.toggles.shadows ? 'on' : 'off'}, water ${this.toggles.water ? 'on' : 'off'}, dprCap ${this.toggles.lowDpr ? 'on' : 'off'}`;
    this.reportEl.textContent = `Location: ${m.location}\n${locationLoadLine}Session: ${m.sessionAgeSeconds.toFixed(1)}s\nFPS: ${m.currentFps.toFixed(0)} / avg ${m.avgFps.toFixed(0)} / worst ${m.worstMs.toFixed(1)}ms\nRenderer: ${m.calls} calls / ${m.tris} tris / ${m.geoms} geoms / ${m.textures} textures\nScene: ${m.objects} objects / ${m.meshes} meshes / ${m.skinned} skinned / ${m.transparent} transparent / ${m.materials} materials / ${m.lights} lights / ${m.shadows} shadows\nDPR: ${m.dpr.toFixed(2)}  Canvas: ${m.width}x${m.height}\nToggles: ${toggleLine}`;
  }

  dispose() {
    this.root?.remove?.();
    this.game = null;
  }
}
