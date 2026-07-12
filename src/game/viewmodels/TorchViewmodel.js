import * as THREE from 'three';
import { KEEPERS_LANTERN_VIEWMODEL_LAYER } from './KeepersLanternViewmodel.js';
import { findOutdoorScene, getOutdoorLightSourceRegistry, OUTDOOR_LIGHT_OWNER } from '../world-scene/OutdoorLightSourceRegistry.js';

export const TORCH_ITEM_ID = 'torch';

export const TORCH_LIGHTING = Object.freeze({
  point: Object.freeze({ color: 0xffc58f, kelvin: 3200, intensity: 28, distance: 8, decay: 2 }),
});

export function resolveTorchLightActive({ ownsTorch, equippedOffhandId, lit }) {
  return ownsTorch === true && equippedOffhandId === TORCH_ITEM_ID && lit === true;
}

const TORCH_FLAME_FRAME_PATHS = Object.freeze([
  './assets/sprites/fire/campfire_flame_billboard_01.png',
  './assets/sprites/fire/campfire_flame_billboard_02.png',
  './assets/sprites/fire/campfire_flame_billboard_03.png',
  './assets/sprites/fire/campfire_flame_billboard_04.png',
  './assets/sprites/fire/campfire_flame_billboard_05.png',
  './assets/sprites/fire/campfire_flame_billboard_06.png',
]);
const TORCH_FLAME_FRAME_DURATION_MS = 110;
const REST_POSITION = Object.freeze({ x: -1.02, y: -0.86, z: -1.34 });
const REST_ROLL = -0.72;
const screenPoint = new THREE.Vector3();

function markViewmodel(object) {
  object.traverse((child) => {
    child.layers?.set?.(KEEPERS_LANTERN_VIEWMODEL_LAYER);
    if (!child.isMesh) return;
    child.renderOrder = Math.max(child.renderOrder, 10010);
    child.castShadow = false;
    child.receiveShadow = false;
    child.userData = { ...child.userData, torchViewmodel: true };
  });
}

export class TorchViewmodel {
  constructor({ camera, equipmentRuntime } = {}) {
    this.camera = camera;
    this.equipmentRuntime = equipmentRuntime;
    this.elapsed = 0;
    this.lit = true;
    const debugTorch = import.meta.env?.DEV && globalThis.location ? new URLSearchParams(globalThis.location.search).get('debugTorch') : null;
    this.debugTorchOverride = debugTorch === 'on' || debugTorch === 'off' ? debugTorch : null;
    this.flameLayers = [];
    this.aim = { x: 0, y: 0 };

    this.root = new THREE.Group();
    this.root.name = 'torch-first-person-viewmodel';
    this.root.position.set(REST_POSITION.x, REST_POSITION.y, REST_POSITION.z);
    this.root.visible = false;

    this.aimPivot = new THREE.Group();
    this.aimPivot.name = 'torch-aim-pivot';
    this.root.add(this.aimPivot);

    this.torchBody = new THREE.Group();
    this.torchBody.name = 'torch-held-body';
    this.torchBody.rotation.z = REST_ROLL;
    this.aimPivot.add(this.torchBody);
    this.buildProceduralTorch();
    markViewmodel(this.root);
    this.pointLight.layers.set(0);
    this.lightRegistry = getOutdoorLightSourceRegistry(findOutdoorScene(this.camera));
    this.lightRegistry?.register(this.pointLight, { name: this.pointLight.name, owner: OUTDOOR_LIGHT_OWNER.PLAYER, source: TORCH_ITEM_ID, global: false });
    this.camera?.add?.(this.root);
  }

  buildProceduralTorch() {
    this.woodTexture = new THREE.TextureLoader().load('./assets/textures/pack1/wood_oak_bright_01.png');
    this.woodTexture.colorSpace = THREE.SRGBColorSpace;
    this.woodTexture.wrapS = THREE.RepeatWrapping;
    this.woodTexture.wrapT = THREE.RepeatWrapping;
    this.woodTexture.repeat.set(1, 2.8);
    const wood = new THREE.MeshStandardMaterial({ map: this.woodTexture, color: 0xb58a57, roughness: 0.92 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x33231b, roughness: 1 });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.042, 0.64, 8), wood);
    shaft.name = 'torch-skinny-oak-shaft';
    shaft.position.y = 0.27;
    this.torchBody.add(shaft);

    for (let index = 0; index < 3; index += 1) {
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.058 - index * 0.003, 0.062 - index * 0.003, 0.09, 8), cloth);
      wrap.name = `torch-head-cloth-wrap-${index}`;
      wrap.position.y = 0.61 + index * 0.065;
      wrap.rotation.z = index % 2 ? 0.04 : -0.035;
      this.torchBody.add(wrap);
    }

    this.flameTextures = TORCH_FLAME_FRAME_PATHS.map((path) => {
      const texture = new THREE.TextureLoader().load(path);
      texture.name = path;
      texture.userData = { path, sprite: true, torchViewmodel: true };
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      return texture;
    });
    this.headSocket = new THREE.Group();
    this.headSocket.name = 'torch-head-flame-socket';
    this.headSocket.position.set(0, 0.76, 0);
    this.torchBody.add(this.headSocket);

    const flameLayerSpecs = [
      { id: 'main', x: 0, y: 0.14, z: 0.012, width: 0.29, height: 0.4, opacity: 0.88, lean: 0, startFrame: 0, frameDurationMs: TORCH_FLAME_FRAME_DURATION_MS },
      { id: 'left', x: -0.045, y: 0.135, z: 0.018, width: 0.27, height: 0.38, opacity: 0.25, lean: 0.08, startFrame: 2, frameDurationMs: TORCH_FLAME_FRAME_DURATION_MS - 7 },
      { id: 'right', x: 0.045, y: 0.13, z: 0.024, width: 0.27, height: 0.38, opacity: 0.25, lean: -0.075, startFrame: 4, frameDurationMs: TORCH_FLAME_FRAME_DURATION_MS + 17 },
      { id: 'foreground', x: 0, y: 0.075, z: 0.07, width: 0.33, height: 0.35, opacity: 0.28, lean: 0.02, startFrame: 1, frameDurationMs: TORCH_FLAME_FRAME_DURATION_MS + 9 },
    ];
    this.flameLayers = flameLayerSpecs.map((spec, index) => {
      const material = new THREE.MeshBasicMaterial({
        map: this.flameTextures[spec.startFrame],
        color: 0xffffff,
        transparent: true,
        opacity: spec.opacity,
        alphaTest: 0.04,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(spec.width, spec.height), material);
      plane.name = `torch-head-six-frame-fire-${spec.id}-plane`;
      plane.position.set(spec.x, spec.y, spec.z);
      plane.rotation.z = spec.lean;
      plane.renderOrder = 10011 + index;
      plane.userData = {
        torchViewmodel: true,
        animatedFireSprite: true,
        flameLayer: spec.id,
        orientation: 'inherits-torch-head-socket',
        framePaths: TORCH_FLAME_FRAME_PATHS,
        frameDurationMs: spec.frameDurationMs,
        opacity: spec.opacity,
      };
      this.headSocket.add(plane);
      return {
        material,
        plane,
        elapsedMs: spec.startFrame * spec.frameDurationMs,
        frameIndex: spec.startFrame,
        frameDurationMs: spec.frameDurationMs,
      };
    });
    this.flameMaterial = this.flameLayers[0].material;
    this.flamePlane = this.flameLayers[0].plane;

    this.emitterTransform = new THREE.Object3D();
    this.emitterTransform.name = 'torch-head-emitter-transform';
    this.emitterTransform.position.set(0, 0.1, -0.02);
    this.headSocket.add(this.emitterTransform);

    this.pointLight = new THREE.PointLight(TORCH_LIGHTING.point.color, TORCH_LIGHTING.point.intensity, TORCH_LIGHTING.point.distance, TORCH_LIGHTING.point.decay);
    this.pointLight.name = 'torch-head-warm-point-light';
    this.pointLight.castShadow = false;
    this.emitterTransform.add(this.pointLight);
    this.aimHitAnchor = this.emitterTransform;
  }

  isActive() {
    if (this.debugTorchOverride) return this.debugTorchOverride === 'on';
    const equippedOffhandId = this.equipmentRuntime?.getEquippedOffhandId?.() ?? null;
    const ownsTorch = this.equipmentRuntime?.hasItem ? this.equipmentRuntime.hasItem(TORCH_ITEM_ID) : equippedOffhandId === TORCH_ITEM_ID;
    return resolveTorchLightActive({ ownsTorch, equippedOffhandId, lit: this.lit });
  }

  setLit(lit) {
    this.lit = lit === true;
    if (!this.lit) {
      this.root.visible = false;
      this.pointLight.intensity = 0;
    }
  }

  getLightingState() {
    const equippedOffhandId = this.equipmentRuntime?.getEquippedOffhandId?.() ?? null;
    const owned = this.equipmentRuntime?.hasItem ? this.equipmentRuntime.hasItem(TORCH_ITEM_ID) : equippedOffhandId === TORCH_ITEM_ID;
    const active = this.isActive();
    return { owned, equipped: equippedOffhandId === TORCH_ITEM_ID, lit: this.lit, active, intensity: active ? this.pointLight.intensity : 0, range: TORCH_LIGHTING.point.distance, decay: TORCH_LIGHTING.point.decay, castShadow: false, debugOverride: this.debugTorchOverride };
  }

  setAimState(state = {}) {
    this.aim.x = Number(state.x) || 0;
    this.aim.y = Number(state.y) || 0;
  }

  update(deltaSeconds) {
    const active = this.isActive();
    this.root.visible = active;
    this.pointLight.intensity = active ? TORCH_LIGHTING.point.intensity : 0;
    if (!active) return;
    const dt = THREE.MathUtils.clamp(deltaSeconds, 0.001, 0.05);
    this.elapsed += dt;
    this.root.position.set(REST_POSITION.x + this.aim.x * 0.13, REST_POSITION.y + this.aim.y * 0.1, REST_POSITION.z);
    this.aimPivot.rotation.set(-this.aim.y * 0.23, -this.aim.x * 0.3, 0, 'YXZ');
    this.flameLayers.forEach((layer) => {
      layer.elapsedMs += dt * 1000;
      const nextFrameIndex = Math.floor(layer.elapsedMs / layer.frameDurationMs) % this.flameTextures.length;
      if (nextFrameIndex === layer.frameIndex) return;
      layer.frameIndex = nextFrameIndex;
      layer.material.map = this.flameTextures[nextFrameIndex];
      layer.material.needsUpdate = true;
    });
    const flicker = 0.97 + Math.sin(this.elapsed * 6.7) * 0.02 + Math.sin(this.elapsed * 11.3) * 0.012;
    this.pointLight.intensity = TORCH_LIGHTING.point.intensity * flicker;
  }

  projectAimHit(clientX, clientY, viewport) {
    if (!this.isActive() || !this.root.visible || !viewport) return false;
    this.camera.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);
    const rect = viewport.getBoundingClientRect();
    this.aimHitAnchor.getWorldPosition(screenPoint).project(this.camera);
    const x = (screenPoint.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-screenPoint.y * 0.5 + 0.5) * rect.height + rect.top;
    const radius = Math.max(70, Math.min(115, Math.min(rect.width, rect.height) * 0.18));
    return screenPoint.z >= -1 && screenPoint.z <= 1 && Math.hypot(clientX - x, clientY - y) <= radius;
  }

  rebind({ camera = this.camera } = {}) {
    if (camera !== this.camera) {
      this.camera?.remove?.(this.root);
      this.camera = camera;
      this.camera?.add?.(this.root);
    }
    const nextRegistry = getOutdoorLightSourceRegistry(findOutdoorScene(this.camera));
    if (nextRegistry !== this.lightRegistry) {
      this.lightRegistry?.unregister(this.pointLight);
      this.lightRegistry = nextRegistry;
      this.lightRegistry?.register(this.pointLight, { name: this.pointLight.name, owner: OUTDOOR_LIGHT_OWNER.PLAYER, source: TORCH_ITEM_ID, global: false });
    }
  }

  dispose() {
    this.lightRegistry?.unregister(this.pointLight);
    this.camera?.remove?.(this.root);
    this.root.traverse((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((entry) => entry?.dispose?.());
      else child.material?.dispose?.();
    });
    this.woodTexture?.dispose?.();
    this.flameTextures?.forEach((texture) => texture?.dispose?.());
    this.root.clear();
    this.camera = null;
  }
}
