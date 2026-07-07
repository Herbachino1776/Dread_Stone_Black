import * as THREE from 'three';
import { BLACK_GROWTH_TEXTURES, createBlackGrowthPlaneMaterial, loadBlackGrowthTexture } from './BlackGrowthVisuals.js';

const GATE_TARGET = new THREE.Vector3(0, 1.55, 21.36);
const WALL_FADE_DELAY_SECONDS = 0.65;
const WALL_FADE_SECONDS = 2.4;

export const BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_RULES = Object.freeze({
  requiredItemId: 'old_work_knife',
  revealItemId: 'keepers_lantern',
  hitsRequired: 5,
  saveKey: 'beneath_folsom_hidden_growth_gate_cleared',
});

export class BeneathFolsomHiddenGrowthGateRuntime {
  constructor({ scene, collision, compiledGroup, gameState, textureLoader }) {
    this.scene = scene;
    this.collision = collision;
    this.compiledGroup = compiledGroup;
    this.gameState = gameState;
    this.textureLoader = textureLoader;
    this.cleared = Boolean(gameState?.isBeneathFolsomHiddenGrowthGateCleared?.());
    this.hitCount = this.cleared ? BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_RULES.hitsRequired : 0;
    this.pulseRemaining = 0;
    this.collapseRemaining = 0;
    this.wallFadeDelay = 0;
    this.wallFadeProgress = this.cleared ? 1 : 0;
    this.effects = [];
    this.blueFlames = [];
    this.loadTextures();
    this.buildGrowth();
    this.findGateParts();
    this.buildBlueFlameHallway();
    if (this.cleared) this.applyClearedState();
  }

  loadTextures() {
    this.intactTextures = BLACK_GROWTH_TEXTURES.intact.map((path) => loadBlackGrowthTexture(this.textureLoader, path));
    this.damagedTextures = BLACK_GROWTH_TEXTURES.damaged.map((path) => loadBlackGrowthTexture(this.textureLoader, path));
    this.cordTexture = loadBlackGrowthTexture(this.textureLoader, BLACK_GROWTH_TEXTURES.cord);
    this.hitTexture = loadBlackGrowthTexture(this.textureLoader, BLACK_GROWTH_TEXTURES.hit);
  }

  revealData(extra = {}) {
    return {
      revealItemId: 'keepers_lantern', revealMode: 'lanternCone', hiddenByDefault: true,
      revealDistance: 4.5, revealConeDegrees: 42, nearFieldRevealRadius: 1.4,
      hiddenOpacity: 0, revealedOpacity: 0.92, fadeSpeed: 10, fadeOutSpeed: 12,
      revealLingerSeconds: 0.2, tags: ['lantern-reveal-decal', 'hidden-growth-gate'], ...extra,
    };
  }

  buildGrowth() {
    this.growthGroup = new THREE.Group();
    this.growthGroup.name = 'beneath-folsom-hidden-growth-gate';
    this.growthGroup.position.copy(GATE_TARGET);
    this.scene.add(this.growthGroup);

    const cordSpecs = [
      [-2.55, 0.02, 0.52, 3.08, -0.07], [-2.02, -0.08, 0.64, 3.25, 0.055],
      [-1.45, 0.05, 0.58, 3.18, -0.035], [-0.86, -0.02, 0.7, 3.34, 0.045],
      [-0.25, 0.03, 0.62, 3.26, -0.025], [0.36, -0.04, 0.72, 3.38, 0.035],
      [0.98, 0.04, 0.6, 3.2, -0.05], [1.56, -0.05, 0.68, 3.3, 0.04],
      [2.16, 0.02, 0.56, 3.14, -0.055], [2.62, -0.08, 0.46, 3.04, 0.06],
    ];
    this.cords = cordSpecs.map(([x, y, width, height, rotation], index) => {
      const texture = index % 3 === 0 ? this.intactTextures[index % 2] : this.cordTexture;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), createBlackGrowthPlaneMaterial(texture));
      mesh.name = `beneath-folsom-hidden-growth-cord-${index + 1}`;
      mesh.position.set(x, y, index * -0.002);
      mesh.rotation.z = rotation;
      mesh.userData = this.revealData({ textureIndex: index % 2, originalX: x, originalY: y, originalRotation: rotation });
      this.growthGroup.add(mesh);
      return mesh;
    });

    const scabSpecs = [
      [-1.72, 0.95, 1.42, 0.72, -0.18], [0.02, 0.12, 2.35, 0.88, 0.08],
      [1.72, -0.76, 1.5, 0.74, -0.12], [-0.95, -1.18, 1.85, 0.68, 0.1],
    ];
    this.scabs = scabSpecs.map(([x, y, width, height, rotation], index) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), createBlackGrowthPlaneMaterial(this.intactTextures[index % 2]));
      mesh.name = `beneath-folsom-hidden-growth-scab-${index + 1}`;
      mesh.position.set(x, y, -0.03 - index * 0.002);
      mesh.rotation.z = rotation;
      mesh.userData = this.revealData({ textureIndex: index % 2 });
      this.growthGroup.add(mesh);
      return mesh;
    });
  }

  findGateParts() {
    this.wall = this.compiledGroup?.getObjectByName('beneath_folsom_hidden_gate_wall') ?? null;
    this.blocker = (this.collision?.blockerRects ?? []).find((candidate) => candidate.id === 'beneath_folsom_hidden_growth_gate_blocker') ?? null;
    if (this.wall?.material) {
      this.wall.material = this.wall.material.clone();
      this.wall.material.transparent = true;
      this.wall.material.opacity = 1;
    }
  }

  buildBlueFlameHallway() {
    this.hallwayGroup = new THREE.Group();
    this.hallwayGroup.name = 'beneath-folsom-blue-flame-chapter-end-hallway';
    const iron = new THREE.MeshStandardMaterial({ color: 0x171c22, roughness: 0.82, metalness: 0.56 });
    [27, 34, 41, 48, 55].forEach((z, row) => {
      [-1, 1].forEach((side) => {
        const fixture = new THREE.Group();
        fixture.name = `beneath-folsom-blue-flame-torch-${row + 1}-${side < 0 ? 'left' : 'right'}`;
        fixture.position.set(side * 2.85, 1.78, z);
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.1), iron);
        bracket.position.x = -side * 0.16;
        fixture.add(bracket);
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.13, 0.18, 8), iron);
        bowl.position.y = -0.08;
        fixture.add(bowl);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.62, 8), new THREE.MeshBasicMaterial({ color: 0x65bfff, transparent: true, opacity: 0.9, depthWrite: false }));
        flame.name = `${fixture.name}-cold-blue-flame`;
        flame.position.y = 0.3;
        fixture.add(flame);
        const light = new THREE.PointLight(0x4b9fff, 1.5, 8.5, 1.65);
        light.position.y = 0.28;
        fixture.add(light);
        this.blueFlames.push({ flame, light, baseY: flame.position.y, phase: row * 1.47 + (side > 0 ? 0.7 : 0) });
        this.hallwayGroup.add(fixture);
      });
    });
    this.hallwayGroup.visible = this.cleared;
    this.scene.add(this.hallwayGroup);
  }

  getRevealObjects() { return [...this.cords, ...this.scabs]; }
  getTarget() { return GATE_TARGET; }
  isRevealed() { return !this.cleared && this.getRevealObjects().some((mesh) => mesh.visible && mesh.material.opacity > 0.22); }

  strike() {
    if (this.cleared) return { hit: false, cleared: true, hitCount: this.hitCount };
    if (!this.isRevealed()) return { hit: false, cleared: false, hitCount: this.hitCount };
    this.hitCount += 1;
    this.pulseRemaining = 0.3;
    this.spawnOilImpact(this.hitCount === 5 ? 1.45 : 0.5 + this.hitCount * 0.11);
    this.playWetGrowthHit(this.hitCount === 5);
    this.applyDamageState();
    if (this.hitCount >= BENEATH_FOLSOM_HIDDEN_GROWTH_GATE_RULES.hitsRequired) this.clear();
    return { hit: true, cleared: this.cleared, hitCount: this.hitCount };
  }

  applyDamageState() {
    this.scabs.forEach((mesh) => {
      mesh.material.map = this.damagedTextures[mesh.userData.textureIndex];
      mesh.material.needsUpdate = true;
    });
    const weakenCount = Math.min(this.cords.length - 2, this.hitCount * 2);
    this.cords.forEach((cord, index) => {
      if (index >= weakenCount) return;
      cord.scale.y = Math.max(0.28, 1 - this.hitCount * 0.11 - (index % 2) * 0.05);
      cord.position.y = cord.userData.originalY - this.hitCount * (0.07 + (index % 3) * 0.018);
      cord.rotation.z = cord.userData.originalRotation + (index % 2 ? -1 : 1) * this.hitCount * 0.045;
      cord.material.opacity = Math.max(0.28, 1 - this.hitCount * 0.1);
    });
  }

  clear() {
    this.cleared = true;
    this.collapseRemaining = 1.05;
    this.wallFadeDelay = WALL_FADE_DELAY_SECONDS;
    this.cords.forEach((cord, index) => { cord.userData.snapDirection = index % 2 ? -1 : 1; });
    this.gameState?.markBeneathFolsomHiddenGrowthGateCleared?.();
  }

  spawnOilImpact(strength) {
    const count = strength > 1 ? 22 : 5 + this.hitCount;
    for (let index = 0; index < count; index += 1) {
      const material = createBlackGrowthPlaneMaterial(this.hitTexture, { opacity: 0.92 });
      material.color.setHex(index % 4 === 0 ? 0x675b4b : 0x171513);
      const size = (0.14 + Math.random() * 0.3) * strength;
      const fleck = new THREE.Mesh(new THREE.PlaneGeometry(size, size * (0.55 + Math.random())), material);
      fleck.name = 'beneath-folsom-hidden-growth-short-lived-oil-fleck';
      fleck.position.copy(GATE_TARGET).add(new THREE.Vector3((Math.random() - 0.5) * 3.4, (Math.random() - 0.45) * 2.5, -0.09 - index * 0.0004));
      fleck.rotation.z = Math.random() * Math.PI * 2;
      fleck.renderOrder = 10;
      this.scene.add(fleck);
      this.effects.push({ object: fleck, life: 0.48 + Math.random() * 0.3, velocity: new THREE.Vector3((Math.random() - 0.5) * strength * 1.4, (0.25 + Math.random()) * strength, -0.03) });
    }
  }

  playWetGrowthHit(finalHit) {
    try {
      const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioContext ??= new AudioContextClass();
      const context = this.audioContext;
      if (context.state === 'suspended') context.resume?.();
      const duration = finalHit ? 0.42 : 0.18;
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        const t = i / data.length;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * (finalHit ? 5 : 9)) * (0.55 + 0.45 * Math.sin(i * 0.045));
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      filter.type = 'lowpass'; filter.frequency.value = finalHit ? 780 : 620;
      gain.gain.value = finalHit ? 0.24 : 0.13;
      source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(context.destination); source.start();
    } catch {
      // Audio is optional when a browser blocks WebAudio; visual and haptic feedback still run.
    }
  }

  update(deltaSeconds) {
    const dt = Math.min(deltaSeconds, 0.05);
    this.updatePulse(dt);
    this.updateCollapse(dt);
    this.updateWall(dt);
    this.updateEffects(dt);
    this.updateBlueFlames(dt);
  }

  updatePulse(dt) {
    if (this.pulseRemaining <= 0 || this.cleared) return;
    this.pulseRemaining = Math.max(0, this.pulseRemaining - dt);
    const wave = Math.sin((1 - this.pulseRemaining / 0.3) * Math.PI * 4);
    this.growthGroup.scale.set(1 + wave * 0.07, 1 - wave * 0.055, 1);
    this.growthGroup.rotation.z = wave * 0.028;
    if (this.pulseRemaining === 0) { this.growthGroup.scale.set(1, 1, 1); this.growthGroup.rotation.z = 0; }
  }

  updateCollapse(dt) {
    if (this.collapseRemaining <= 0 || !this.growthGroup.visible) return;
    this.collapseRemaining = Math.max(0, this.collapseRemaining - dt);
    const progress = 1 - this.collapseRemaining / 1.05;
    this.scabs.forEach((mesh) => { mesh.material.opacity = 1 - progress; mesh.scale.setScalar(1 - progress * 0.45); });
    this.cords.forEach((cord, index) => {
      cord.material.opacity = 1 - progress;
      cord.position.x += (cord.userData.snapDirection ?? 1) * dt * (1.8 + index * 0.12);
      cord.position.y -= dt * (0.7 + (index % 3) * 0.18);
      cord.rotation.z += (cord.userData.snapDirection ?? 1) * dt * 2.8;
      cord.scale.y = Math.max(0.02, cord.scale.y - dt * 0.95);
    });
    if (this.collapseRemaining === 0) this.growthGroup.visible = false;
  }

  updateWall(dt) {
    if (!this.cleared || this.wallFadeProgress >= 1) return;
    if (this.wallFadeDelay > 0) { this.wallFadeDelay = Math.max(0, this.wallFadeDelay - dt); return; }
    this.hallwayGroup.visible = true;
    this.wallFadeProgress = Math.min(1, this.wallFadeProgress + dt / WALL_FADE_SECONDS);
    const eased = this.wallFadeProgress * this.wallFadeProgress * (3 - 2 * this.wallFadeProgress);
    if (this.wall?.material) this.wall.material.opacity = 1 - eased;
    if (this.wall) this.wall.position.y = 1.48 - eased * 0.34;
    if (this.wallFadeProgress >= 1) {
      if (this.wall) this.wall.visible = false;
      if (this.blocker) this.collision?.removeBlocker?.(this.blocker);
    }
  }

  updateBlueFlames(dt) {
    if (!this.hallwayGroup.visible) return;
    const time = performance.now() * 0.001;
    this.blueFlames.forEach(({ flame, light, baseY, phase }) => {
      const flicker = 0.88 + Math.sin(time * 8.2 + phase) * 0.08 + Math.sin(time * 13.7 + phase) * 0.04;
      flame.scale.set(0.92 + flicker * 0.08, flicker, 0.92 + flicker * 0.08);
      flame.position.y = baseY + Math.sin(time * 6.5 + phase) * 0.025;
      light.intensity = 1.5 * flicker;
    });
  }

  updateEffects(dt) {
    this.effects = this.effects.filter((effect) => {
      effect.life -= dt;
      if (effect.life <= 0) {
        this.scene.remove(effect.object); effect.object.geometry.dispose(); effect.object.material.dispose(); return false;
      }
      effect.object.position.addScaledVector(effect.velocity, dt);
      effect.velocity.y -= dt * 2.8;
      effect.object.material.opacity = Math.min(0.92, effect.life / 0.22);
      return true;
    });
  }

  applyClearedState() {
    this.growthGroup.visible = false;
    if (this.wall) this.wall.visible = false;
    if (this.blocker) this.collision?.removeBlocker?.(this.blocker);
    this.hallwayGroup.visible = true;
  }

  dispose() {
    this.audioContext?.close?.();
    this.audioContext = null;
    this.effects = [];
  }
}
