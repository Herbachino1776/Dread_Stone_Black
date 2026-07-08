import * as THREE from 'three';
import {
  BLACK_GROWTH_TEXTURES,
  createBlackGrowthKnotMaterial,
  createBlackGrowthPlaneMaterial,
  loadBlackGrowthTexture,
  loadWrappedBlackGrowthTexture,
} from './BlackGrowthVisuals.js';
import { isLanternRevealEmitterActive, isObjectInsideLanternWash } from './LanternConeRevealRuntime.js';

const SIDE_SEAL_TARGET = new THREE.Vector3(-51.72, 1.72, 38.32);
const CRAWLSPACE_TARGET = new THREE.Vector3(-60.55, 1.35, 39);
const REVEAL_CONFIG = Object.freeze({
  revealDistance: 4.25,
  revealConeDegrees: 42,
  nearFieldRevealRadius: 1.45,
  nearFieldConeDegrees: 82,
  exitConePaddingDegrees: 7,
  exitDistancePadding: 0.35,
});

export const FOLSOM_SHRINE_INVESTIGATION_RULES = Object.freeze({
  sideRoomSaveKey: 'folsom_shrine_side_room_open',
  networkRevealSaveKey: 'folsom_under_shrine_network_revealed',
  crawlspaceSaveKey: 'folsom_shrine_crawlspace_open',
  sideSealSequence: Object.freeze(['knife-cords', 'axe-knot', 'open']),
});

function cloneObjectMaterials(root) {
  root?.traverse((object) => {
    if (object.material) object.material = object.material.clone();
  });
}

export class FolsomShrineInvestigationRuntime {
  constructor({ scene, collision, compiledGroup, gameState, textureLoader, getEmitterState, onNetworkRevealed }) {
    this.scene = scene;
    this.collision = collision;
    this.compiledGroup = compiledGroup;
    this.gameState = gameState;
    this.textureLoader = textureLoader;
    this.getEmitterState = getEmitterState;
    this.onNetworkRevealed = onNetworkRevealed;
    this.sideRoomOpen = Boolean(gameState?.isFolsomShrineSideRoomOpen?.());
    this.networkRevealed = Boolean(gameState?.isFolsomUnderShrineNetworkRevealed?.());
    this.crawlspaceOpen = Boolean(gameState?.isFolsomShrineCrawlspaceOpen?.());
    this.sideSealStage = this.sideRoomOpen ? 2 : 0;
    this.doorProgress = this.sideRoomOpen ? 1 : 0;
    this.crawlspaceProgress = this.crawlspaceOpen ? 1 : 0;
    this.pulseRemaining = 0;
    this.revealHold = 0;
    this.effects = [];
    this.loadMaterials();
    this.findAuthoredParts();
    this.buildSideSeal();
    this.buildRevealMarks();
    this.buildLanternPickup();
    this.applyPersistedState();
  }

  loadMaterials() {
    this.intactTextures = BLACK_GROWTH_TEXTURES.intact.map((path) => loadBlackGrowthTexture(this.textureLoader, path));
    this.damagedTextures = BLACK_GROWTH_TEXTURES.damaged.map((path) => loadBlackGrowthTexture(this.textureLoader, path));
    this.cordTexture = loadBlackGrowthTexture(this.textureLoader, BLACK_GROWTH_TEXTURES.cord);
    this.hitTexture = loadBlackGrowthTexture(this.textureLoader, BLACK_GROWTH_TEXTURES.hit);
    this.knotTexture = loadWrappedBlackGrowthTexture(this.textureLoader, BLACK_GROWTH_TEXTURES.intact[1]);
    const paleTexture = this.textureLoader.load('./assets/revealed_glyphs/symbols/symbol_001.png');
    paleTexture.colorSpace = THREE.SRGBColorSpace;
    this.paleRevealMaterial = new THREE.MeshBasicMaterial({
      map: paleTexture,
      color: 0xb9d7cd,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
  }

  findAuthoredParts() {
    this.sideDoor = null;
    this.crawlspacePanel = null;
    this.compiledGroup?.traverse((object) => {
      const id = object.userData?.architecturalPrimitiveId;
      if (id === 'folsom_shrine_side_room_door') this.sideDoor = object;
      if (id === 'folsom_shrine_crawlspace_panel') this.crawlspacePanel = object;
    });
    [this.sideDoor, this.crawlspacePanel].forEach((object) => {
      if (!object) return;
      object.userData.closedPosition = object.position.clone();
      object.userData.closedRotationY = object.rotation.y;
      cloneObjectMaterials(object);
    });
    this.sideDoorBlockers = (this.collision?.blockerRects ?? [])
      .filter((blocker) => blocker.id?.includes('folsom_shrine_side_room_door') && !blocker.id?.includes('frame'));
    this.crawlspaceBlockers = (this.collision?.blockerRects ?? [])
      .filter((blocker) => blocker.id?.includes('folsom_shrine_crawlspace_panel'));
  }

  buildSideSeal() {
    this.sideSeal = new THREE.Group();
    this.sideSeal.name = 'folsom-shrine-side-room-growth-seal';
    this.sideSeal.position.copy(SIDE_SEAL_TARGET);
    this.sideSeal.rotation.y = Math.PI / 2;
    this.scene.add(this.sideSeal);

    this.scabs = [
      { x: -0.42, y: 0.02, width: 0.72, height: 1.95, texture: 0, rotation: -0.05 },
      { x: 0.35, y: 0.24, width: 0.66, height: 1.5, texture: 1, rotation: 0.08 },
    ].map((spec, index) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.width, spec.height), createBlackGrowthPlaneMaterial(this.intactTextures[spec.texture]));
      mesh.name = `folsom-shrine-side-seal-scab-${index + 1}`;
      mesh.position.set(spec.x, spec.y, index * 0.004);
      mesh.rotation.z = spec.rotation;
      mesh.userData.textureIndex = spec.texture;
      this.sideSeal.add(mesh);
      return mesh;
    });
    this.cords = [-0.58, 0.06, 0.68].map((y, index) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.25 - index * 0.1, 0.24), createBlackGrowthPlaneMaterial(this.cordTexture));
      mesh.name = `folsom-shrine-side-seal-cord-${index + 1}`;
      mesh.position.set(0, y, 0.016 + index * 0.003);
      mesh.rotation.z = index === 1 ? -0.16 : 0.12;
      this.sideSeal.add(mesh);
      return mesh;
    });
    this.knot = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 0), createBlackGrowthKnotMaterial(this.knotTexture));
    this.knot.name = 'folsom-shrine-side-seal-hard-knot';
    this.knot.position.set(0.42, -0.28, -0.12);
    this.knot.scale.set(1.05, 1.3, 0.58);
    this.sideSeal.add(this.knot);
  }

  buildRevealMarks() {
    this.revealMarks = [];
    const specs = [
      { name: 'folsom-under-shrine-convergence-mark', position: [-60.78, 1.55, 39], rotationY: Math.PI / 2, width: 1.9, height: 1.45, primary: true },
      { name: 'folsom-under-shrine-crawlspace-mark', position: [-64.6, 1.52, 40.42], rotationY: 0, width: 2.2, height: 0.58 },
      { name: 'folsom-under-shrine-terminal-mark', position: [-68.28, 1.48, 39], rotationY: Math.PI / 2, width: 1.85, height: 1.25 },
    ];
    specs.forEach((spec, index) => {
      const material = this.paleRevealMaterial.clone();
      material.opacity = this.networkRevealed ? 0.2 : 0;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.width, spec.height), material);
      mesh.name = spec.name;
      mesh.position.set(...spec.position);
      mesh.rotation.y = spec.rotationY;
      mesh.rotation.z = index === 1 ? Math.PI / 2 : index * 0.08 - 0.04;
      mesh.visible = this.networkRevealed;
      mesh.renderOrder = 7;
      mesh.userData.primaryNetworkReveal = Boolean(spec.primary);
      this.scene.add(mesh);
      this.revealMarks.push(mesh);
    });
  }

  buildLanternPickup() {
    const lantern = new THREE.Group();
    lantern.name = 'folsom-shrine-side-room-keepers-lantern';
    lantern.position.set(-57.4, 1.72, 35.15);
    lantern.rotation.y = -0.24;
    const metal = new THREE.MeshStandardMaterial({ color: 0x292f2d, roughness: 0.88, metalness: 0.48, emissive: 0x050807, emissiveIntensity: 0.16 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xa8c5b8, roughness: 0.48, emissive: 0x769b8a, emissiveIntensity: 0.62, transparent: true, opacity: 0.58 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.14, 8), metal);
    base.position.y = -0.3;
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.48, 10), glass);
    lens.position.y = 0.01;
    lantern.add(base, lens);
    [-0.24, 0.24].forEach((x) => {
      const cage = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.7, 0.055), metal);
      cage.position.set(x, 0, 0);
      lantern.add(cage);
    });
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.22, 8), metal);
    cap.position.y = 0.38;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 6, 12, Math.PI), metal);
    handle.position.y = 0.55;
    handle.rotation.z = Math.PI;
    const glow = new THREE.PointLight(0x9fc8b5, 0.34, 3.4, 1.8);
    glow.position.y = 0.05;
    lantern.add(cap, handle, glow);
    this.scene.add(lantern);
    this.lanternPickup = lantern;
  }

  getLanternPickupObject() { return this.lanternPickup; }
  getSideSealTarget() { return SIDE_SEAL_TARGET; }
  getCrawlspaceTarget() { return CRAWLSPACE_TARGET; }
  isNetworkRevealed() { return this.networkRevealed; }

  advanceSideRoom({ hasKnife = false, hasAxe = false } = {}) {
    if (this.sideRoomOpen) return { changed: false, opened: true, message: 'The keeper maintenance room stands open.' };
    if (this.sideSealStage === 0) {
      if (!hasKnife) return { changed: false, opened: false, message: 'Thin black cords bind the side latch.' };
      this.sideSealStage = 1;
      this.pulseRemaining = 0.32;
      this.cords[0].visible = false;
      this.cords[2].rotation.z -= 0.3;
      this.scabs.forEach((mesh) => {
        mesh.material.map = this.damagedTextures[mesh.userData.textureIndex];
        mesh.material.needsUpdate = true;
      });
      this.spawnOilImpact(4);
      return { changed: true, opened: false, message: 'The work knife parts the cords. A hard knot still grips the latch.' };
    }
    if (!hasAxe) return { changed: false, opened: false, message: 'The exposed knot is too hard for the knife.' };
    this.sideSealStage = 2;
    this.sideRoomOpen = true;
    this.pulseRemaining = 0.45;
    this.gameState?.markFolsomShrineSideRoomOpen?.();
    this.sideDoorBlockers.forEach((blocker) => this.collision?.removeBlocker?.(blocker));
    this.spawnOilImpact(10);
    return { changed: true, opened: true, message: 'The axe cracks the knot. The old side door gives.' };
  }

  openCrawlspace({ hasKnife = false } = {}) {
    if (this.crawlspaceOpen) return { changed: false, opened: true, message: 'The maintenance crawlspace stands open.' };
    if (!this.networkRevealed) return { changed: false, opened: false, message: 'The low stone panel has no readable edge.' };
    if (!hasKnife) return { changed: false, opened: false, message: 'Revealed black cords hold the panel in its groove.' };
    this.crawlspaceOpen = true;
    this.gameState?.markFolsomShrineCrawlspaceOpen?.();
    this.crawlspaceBlockers.forEach((blocker) => this.collision?.removeBlocker?.(blocker));
    this.spawnOilImpact(5, CRAWLSPACE_TARGET);
    return { changed: true, opened: true, message: 'The cords split. The maintenance panel sinks aside.' };
  }

  markNetworkRevealed() {
    if (this.networkRevealed) return false;
    this.networkRevealed = true;
    this.gameState?.markFolsomUnderShrineNetworkRevealed?.();
    this.onNetworkRevealed?.();
    this.revealMarks.forEach((mesh) => { mesh.visible = true; });
    return true;
  }

  spawnOilImpact(count, target = SIDE_SEAL_TARGET) {
    for (let index = 0; index < count; index += 1) {
      const material = createBlackGrowthPlaneMaterial(this.hitTexture, { opacity: 0.86, color: index % 3 ? 0x24211d : 0x5d5246 });
      const size = 0.14 + Math.random() * 0.24;
      const fleck = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
      fleck.name = 'folsom-shrine-short-lived-oil-fleck';
      fleck.position.copy(target).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.4) * 1.35, (Math.random() - 0.5) * 0.4));
      fleck.rotation.z = Math.random() * Math.PI * 2;
      this.scene.add(fleck);
      this.effects.push({ object: fleck, life: 0.38 + Math.random() * 0.18, velocity: new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.25 + Math.random() * 0.65, (Math.random() - 0.5) * 0.5) });
    }
  }

  update(deltaSeconds) {
    const dt = Math.min(deltaSeconds, 0.05);
    this.updateReveal(dt);
    this.updatePulse(dt);
    this.updateDoor(dt);
    this.updateCrawlspacePanel(dt);
    this.updateEffects(dt);
  }

  updateReveal(dt) {
    const emitter = this.getEmitterState?.() ?? null;
    const emitterActive = isLanternRevealEmitterActive(emitter);
    let primaryHit = false;
    this.revealMarks.forEach((mesh) => {
      const inside = emitterActive && isObjectInsideLanternWash(emitter, mesh, REVEAL_CONFIG, { wasRevealed: mesh.userData.insideLanternWash });
      mesh.userData.insideLanternWash = inside;
      if (inside && mesh.userData.primaryNetworkReveal) primaryHit = true;
      const targetOpacity = inside ? 0.9 : this.networkRevealed ? 0.2 : 0;
      mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, targetOpacity, 1 - Math.exp(-(inside ? 10 : 8) * dt));
      mesh.visible = mesh.material.opacity > 0.002 || this.networkRevealed;
    });
    this.revealHold = primaryHit ? this.revealHold + dt : Math.max(0, this.revealHold - dt * 2);
    if (this.revealHold >= 0.12) this.markNetworkRevealed();
  }

  updatePulse(dt) {
    if (this.pulseRemaining <= 0 || !this.sideSeal.visible) return;
    this.pulseRemaining = Math.max(0, this.pulseRemaining - dt);
    const wave = Math.sin((1 - this.pulseRemaining / 0.45) * Math.PI * 4);
    this.sideSeal.scale.set(1 + wave * 0.07, 1 - wave * 0.055, 1);
    if (this.sideRoomOpen) {
      this.sideSeal.traverse((object) => { if (object.material) object.material.opacity = Math.max(0, this.pulseRemaining / 0.45); });
      if (this.pulseRemaining === 0) this.sideSeal.visible = false;
    }
  }

  updateDoor(dt) {
    if (!this.sideRoomOpen || this.doorProgress >= 1) return;
    this.doorProgress = Math.min(1, this.doorProgress + dt * 1.45);
    this.applyDoorProgress(1 - ((1 - this.doorProgress) ** 3));
  }

  applyDoorProgress(progress) {
    if (!this.sideDoor?.userData.closedPosition) return;
    this.sideDoor.position.copy(this.sideDoor.userData.closedPosition);
    this.sideDoor.position.z += progress * 2.45;
    this.sideDoor.rotation.y = (this.sideDoor.userData.closedRotationY ?? 0) + progress * 0.18;
  }

  updateCrawlspacePanel(dt) {
    if (!this.crawlspaceOpen || this.crawlspaceProgress >= 1) return;
    this.crawlspaceProgress = Math.min(1, this.crawlspaceProgress + dt * 1.6);
    this.applyCrawlspaceProgress(1 - ((1 - this.crawlspaceProgress) ** 3));
  }

  applyCrawlspaceProgress(progress) {
    if (!this.crawlspacePanel?.userData.closedPosition) return;
    this.crawlspacePanel.position.copy(this.crawlspacePanel.userData.closedPosition);
    this.crawlspacePanel.position.y -= progress * 1.55;
  }

  applyPersistedState() {
    const lanternOwned = this.gameState?.getEquipmentSnapshot?.()?.acquiredItemIds?.includes('keepers_lantern');
    if (this.lanternPickup) this.lanternPickup.visible = !lanternOwned;
    if (this.sideRoomOpen) {
      this.sideSeal.visible = false;
      this.sideDoorBlockers.forEach((blocker) => this.collision?.removeBlocker?.(blocker));
      this.applyDoorProgress(1);
    }
    if (this.crawlspaceOpen) {
      this.crawlspaceBlockers.forEach((blocker) => this.collision?.removeBlocker?.(blocker));
      this.applyCrawlspaceProgress(1);
    }
    if (this.networkRevealed) this.onNetworkRevealed?.();
  }

  updateEffects(dt) {
    this.effects = this.effects.filter((effect) => {
      effect.life -= dt;
      if (effect.life <= 0) {
        this.scene.remove(effect.object);
        effect.object.geometry?.dispose?.();
        effect.object.material?.dispose?.();
        return false;
      }
      effect.object.position.addScaledVector(effect.velocity, dt);
      effect.velocity.y -= dt * 2.4;
      effect.object.material.opacity = Math.min(0.86, effect.life / 0.18);
      return true;
    });
  }
}
