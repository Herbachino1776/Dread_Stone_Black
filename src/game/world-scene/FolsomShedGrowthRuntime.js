import * as THREE from 'three';
import { BLACK_GROWTH_TEXTURES, createBlackGrowthPlaneMaterial, loadBlackGrowthTexture } from './BlackGrowthVisuals.js';

const GROWTH_TARGET = new THREE.Vector3(-35, 1.85, -35.82);
export const FOLSOM_SHED_GROWTH_RULES = Object.freeze({
  requiredItemId: 'old_work_knife',
  hitsRequired: 3,
  stateSequence: Object.freeze(['intact', 'damaged', 'cleared']),
  saveKey: 'folsom_tool_shed_open',
});
export const FOLSOM_SHED_GROWTH_TEXTURES = BLACK_GROWTH_TEXTURES;

export class FolsomShedGrowthRuntime {
  constructor({ scene, collision, compiledGroup, gameState, textureLoader, audioRuntime = null }) {
    this.scene = scene;
    this.collision = collision;
    this.compiledGroup = compiledGroup;
    this.gameState = gameState;
    this.textureLoader = textureLoader;
    this.audioRuntime = audioRuntime;
    this.open = Boolean(gameState?.isFolsomToolShedOpen?.());
    this.hitCount = this.open ? 3 : 0;
    this.pulseRemaining = 0;
    this.collapseRemaining = 0;
    this.doorOpenProgress = this.open ? 1 : 0;
    this.effects = [];
    this.growthGroup = new THREE.Group();
    this.growthGroup.name = 'folsom-tool-shed-seam-growth';
    this.growthGroup.position.copy(GROWTH_TARGET);
    this.scene.add(this.growthGroup);
    this.loadTextures();
    this.buildGrowth();
    this.findDoorParts();
    if (this.open) this.applyOpenedState();
  }

  loadTextures() {
    this.intactTextures = FOLSOM_SHED_GROWTH_TEXTURES.intact.map((path) => loadBlackGrowthTexture(this.textureLoader, path));
    this.damagedTextures = FOLSOM_SHED_GROWTH_TEXTURES.damaged.map((path) => loadBlackGrowthTexture(this.textureLoader, path));
    this.cordTexture = loadBlackGrowthTexture(this.textureLoader, FOLSOM_SHED_GROWTH_TEXTURES.cord);
    this.hitTexture = loadBlackGrowthTexture(this.textureLoader, FOLSOM_SHED_GROWTH_TEXTURES.hit);
  }

  buildGrowth() {
    const scabSpecs = [
      { x: -0.08, y: 0, width: 0.92, height: 3.55, rotation: -0.03, texture: 0 },
      { x: -1.72, y: 0.02, width: 0.48, height: 3.5, rotation: 0.025, texture: 1 },
      { x: 1.72, y: -0.03, width: 0.48, height: 3.5, rotation: -0.02, texture: 1 },
      { x: 0.82, y: 1.63, width: 1.9, height: 0.46, rotation: 0.02, texture: 0 },
    ];
    this.scabs = scabSpecs.map((spec, index) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.width, spec.height), createBlackGrowthPlaneMaterial(this.intactTextures[spec.texture]));
      mesh.name = `folsom-shed-growth-scab-${index + 1}`;
      mesh.position.set(spec.x, spec.y, index * 0.002);
      mesh.rotation.z = spec.rotation;
      mesh.userData.textureIndex = spec.texture;
      this.growthGroup.add(mesh);
      return mesh;
    });
    const cordSpecs = [
      { y: 1.02, rotation: 0.08, width: 4.05 },
      { y: 0.18, rotation: -0.18, width: 3.95 },
      { y: -0.72, rotation: 0.15, width: 3.85 },
    ];
    this.cords = cordSpecs.map((spec, index) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.width, 0.34), createBlackGrowthPlaneMaterial(this.cordTexture));
      mesh.name = `folsom-shed-growth-cord-${index + 1}`;
      mesh.position.set(0, spec.y, 0.012 + index * 0.002);
      mesh.rotation.z = spec.rotation;
      this.growthGroup.add(mesh);
      return mesh;
    });
  }

  findDoorParts() {
    this.doorParts = [];
    this.compiledGroup?.traverse((object) => {
      const primitiveId = object.userData?.architecturalPrimitiveId;
      if (!['folsom_shed_door_left', 'folsom_shed_door_right'].includes(primitiveId)) return;
      object.userData.closedTransform = { position: object.position.clone(), rotationY: object.rotation.y };
      object.userData.openDirection = primitiveId.endsWith('left') ? -1 : 1;
      this.doorParts.push(object);
    });
    this.doorBlockers = (this.collision?.blockerRects ?? []).filter((blocker) => blocker.id?.includes('folsom_shed_door_left') || blocker.id?.includes('folsom_shed_door_right'));
  }

  getTarget() { return GROWTH_TARGET; }

  strike() {
    if (this.open || this.hitCount >= FOLSOM_SHED_GROWTH_RULES.hitsRequired) return { hit: false, cleared: true, hitCount: FOLSOM_SHED_GROWTH_RULES.hitsRequired };
    this.hitCount += 1;
    const cueId = this.hitCount === 1
      ? 'audio_ch1_folsom_shed_growth_knife_first_bite_oneshot'
      : this.hitCount === 2
        ? 'audio_ch1_folsom_shed_growth_knife_second_damage_oneshot'
        : 'audio_ch1_folsom_shed_growth_knife_final_clear_oneshot';
    this.audioRuntime?.play3D?.(cueId, GROWTH_TARGET);
    this.pulseRemaining = this.hitCount === 2 ? 0.32 : 0.24;
    this.spawnOilImpact(this.hitCount === 3 ? 1 : this.hitCount === 2 ? 0.72 : 0.48);
    if (this.hitCount === 2) this.applyDamagedState();
    if (this.hitCount === FOLSOM_SHED_GROWTH_RULES.hitsRequired) this.clearGrowth();
    return {
      hit: true,
      cleared: this.hitCount === FOLSOM_SHED_GROWTH_RULES.hitsRequired,
      hitCount: this.hitCount,
      audioAcceptedCuePlayed: true,
    };
  }

  applyDamagedState() {
    this.scabs.forEach((mesh) => {
      mesh.material.map = this.damagedTextures[mesh.userData.textureIndex];
      mesh.material.needsUpdate = true;
    });
    this.cords[1].visible = false;
    this.cords[0].rotation.z += 0.11;
    this.cords[2].rotation.z -= 0.13;
  }

  clearGrowth() {
    this.open = true;
    this.collapseRemaining = 0.55;
    this.doorBlockers.forEach((blocker) => this.collision?.removeBlocker?.(blocker));
    this.cords.forEach((cord, index) => {
      cord.visible = true;
      cord.userData.snapDirection = index % 2 ? -1 : 1;
    });
    this.gameState?.markFolsomToolShedOpen?.();
    this.audioRuntime?.play3D?.('audio_ch1_folsom_shed_door_open_oneshot', GROWTH_TARGET.clone().add(new THREE.Vector3(0, -0.12, 0.18)));
  }

  spawnOilImpact(strength) {
    const count = strength >= 1 ? 11 : strength > 0.6 ? 5 : 3;
    for (let index = 0; index < count; index += 1) {
      const material = createBlackGrowthPlaneMaterial(this.hitTexture, { opacity: 0.9 });
      material.color.setHex(index % 3 === 0 ? 0x5b5145 : 0x27231f);
      const size = (0.2 + Math.random() * 0.34) * strength;
      const splash = new THREE.Mesh(new THREE.PlaneGeometry(size, size * (0.75 + Math.random() * 0.7)), material);
      splash.name = 'folsom-shed-growth-short-lived-oil-splash';
      splash.position.copy(GROWTH_TARGET).add(new THREE.Vector3((Math.random() - 0.5) * 1.25, (Math.random() - 0.45) * 1.8, -0.035 - index * 0.0005));
      splash.rotation.z = Math.random() * Math.PI * 2;
      splash.renderOrder = 8;
      this.scene.add(splash);
      this.effects.push({ object: splash, life: 0.42 + Math.random() * 0.22, velocity: new THREE.Vector3((Math.random() - 0.5) * strength, (0.2 + Math.random()) * strength, -0.02) });
    }
  }

  update(deltaSeconds) {
    this.updatePulse(deltaSeconds);
    this.updateCollapse(deltaSeconds);
    this.updateDoor(deltaSeconds);
    this.updateEffects(deltaSeconds);
  }

  updatePulse(deltaSeconds) {
    if (this.pulseRemaining <= 0 || this.open) return;
    this.pulseRemaining = Math.max(0, this.pulseRemaining - deltaSeconds);
    const strength = Math.sin((1 - this.pulseRemaining / 0.32) * Math.PI * 3);
    const scale = 1 + strength * (this.hitCount === 2 ? 0.085 : 0.055);
    this.growthGroup.scale.set(scale, 1 - strength * 0.045, 1);
    this.growthGroup.rotation.z = strength * (this.hitCount === 2 ? 0.035 : 0.022);
    if (this.pulseRemaining === 0) {
      this.growthGroup.scale.set(1, 1, 1);
      this.growthGroup.rotation.z = 0;
    }
  }

  updateCollapse(deltaSeconds) {
    if (this.collapseRemaining <= 0 || !this.growthGroup.visible) return;
    this.collapseRemaining = Math.max(0, this.collapseRemaining - deltaSeconds);
    const progress = 1 - this.collapseRemaining / 0.55;
    this.scabs.forEach((mesh) => { mesh.material.opacity = 1 - progress; });
    this.cords.forEach((cord, index) => {
      cord.material.opacity = 1 - progress;
      cord.position.x += (cord.userData.snapDirection ?? 1) * deltaSeconds * (2.2 + index * 0.35);
      cord.rotation.z += (cord.userData.snapDirection ?? 1) * deltaSeconds * 2.6;
    });
    this.growthGroup.scale.y = Math.max(0.05, 1 - progress * 0.7);
    if (this.collapseRemaining === 0) this.growthGroup.visible = false;
  }

  updateDoor(deltaSeconds) {
    if (!this.open || this.doorOpenProgress >= 1) return;
    this.doorOpenProgress = Math.min(1, this.doorOpenProgress + deltaSeconds * 1.35);
    this.applyDoorProgress(1 - ((1 - this.doorOpenProgress) ** 3));
  }

  applyDoorProgress(progress) {
    this.doorParts.forEach((door) => {
      const closed = door.userData.closedTransform;
      const direction = door.userData.openDirection;
      door.rotation.y = closed.rotationY + direction * progress * 1.35;
      door.position.x = closed.position.x + direction * progress * 0.72;
      door.position.z = closed.position.z + progress * 0.7;
    });
  }

  applyOpenedState() {
    this.growthGroup.visible = false;
    this.doorBlockers.forEach((blocker) => this.collision?.removeBlocker?.(blocker));
    this.applyDoorProgress(1);
  }

  updateEffects(deltaSeconds) {
    this.effects = this.effects.filter((effect) => {
      effect.life -= deltaSeconds;
      if (effect.life <= 0) {
        this.scene.remove(effect.object);
        effect.object.geometry?.dispose?.();
        effect.object.material?.dispose?.();
        return false;
      }
      effect.object.position.addScaledVector(effect.velocity, deltaSeconds);
      effect.velocity.y -= deltaSeconds * 2.4;
      effect.object.material.opacity = Math.min(0.9, effect.life / 0.24);
      return true;
    });
  }
}
