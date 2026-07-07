import * as THREE from 'three';
import { KEEPERS_LANTERN_VIEWMODEL_LAYER } from './KeepersLanternViewmodel.js';

export const TORCH_ITEM_ID = 'torch';

export const TORCH_LIGHTING = Object.freeze({
  point: Object.freeze({ color: 0xffb066, intensity: 6.8, distance: 36, decay: 1.3 }),
  wash: Object.freeze({ color: 0xffc078, intensity: 7.2, distance: 56, angle: 0.78, penumbra: 0.82, decay: 1.25 }),
});

const TORCH_FLAME_FRAME_PATHS = Object.freeze([
  './assets/sprites/fire/campfire_flame_billboard_01.png',
  './assets/sprites/fire/campfire_flame_billboard_02.png',
  './assets/sprites/fire/campfire_flame_billboard_03.png',
  './assets/sprites/fire/campfire_flame_billboard_04.png',
  './assets/sprites/fire/campfire_flame_billboard_05.png',
  './assets/sprites/fire/campfire_flame_billboard_06.png',
]);
const TORCH_FLAME_FRAME_DURATION_MS = 110;
const REST_POSITION = Object.freeze({ x: -0.78, y: -0.7, z: -1.22 });
const REST_ROLL = -0.72;
const screenPoint = new THREE.Vector3();

function markViewmodel(object) {
  object.traverse((child) => {
    child.layers?.set?.(KEEPERS_LANTERN_VIEWMODEL_LAYER);
    if (!child.isMesh) return;
    child.renderOrder = 10010;
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
    this.flameElapsedMs = 0;
    this.flameFrameIndex = 0;
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
    this.warmSpotLight.layers.set(0);
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

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.96, 8), wood);
    shaft.name = 'torch-skinny-oak-shaft';
    shaft.position.y = 0.42;
    this.torchBody.add(shaft);

    for (let index = 0; index < 4; index += 1) {
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.072 - index * 0.004, 0.068 - index * 0.003, 0.105, 9), cloth);
      wrap.name = `torch-head-cloth-wrap-${index}`;
      wrap.position.y = 0.88 + index * 0.07;
      wrap.rotation.z = index % 2 ? 0.035 : -0.035;
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
    this.flameMaterial = new THREE.SpriteMaterial({
      map: this.flameTextures[0],
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      alphaTest: 0.04,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.flameSprite = new THREE.Sprite(this.flameMaterial);
    this.flameSprite.name = 'torch-head-six-frame-fire-sprite';
    this.flameSprite.position.set(0, 1.27, 0.012);
    this.flameSprite.scale.set(0.25, 0.34, 1);
    this.flameSprite.renderOrder = 10011;
    this.flameSprite.userData = {
      torchViewmodel: true,
      animatedFireSprite: true,
      framePaths: TORCH_FLAME_FRAME_PATHS,
      frameDurationMs: TORCH_FLAME_FRAME_DURATION_MS,
    };
    this.torchBody.add(this.flameSprite);

    this.emitterTransform = new THREE.Object3D();
    this.emitterTransform.name = 'torch-head-emitter-transform';
    this.emitterTransform.position.set(0, 1.16, -0.02);
    this.torchBody.add(this.emitterTransform);

    this.pointLight = new THREE.PointLight(TORCH_LIGHTING.point.color, TORCH_LIGHTING.point.intensity, TORCH_LIGHTING.point.distance, TORCH_LIGHTING.point.decay);
    this.pointLight.name = 'torch-head-warm-point-light';
    this.pointLight.castShadow = false;
    this.warmSpotLight = new THREE.SpotLight(TORCH_LIGHTING.wash.color, TORCH_LIGHTING.wash.intensity, TORCH_LIGHTING.wash.distance, TORCH_LIGHTING.wash.angle, TORCH_LIGHTING.wash.penumbra, TORCH_LIGHTING.wash.decay);
    this.warmSpotLight.name = 'torch-head-forward-wash';
    this.warmSpotLight.castShadow = false;
    this.warmSpotLight.target.position.set(0, 0.2, -6);
    this.emitterTransform.add(this.pointLight, this.warmSpotLight, this.warmSpotLight.target);
    this.aimHitAnchor = this.emitterTransform;
  }

  isActive() {
    return this.equipmentRuntime?.getEquippedOffhandId?.() === TORCH_ITEM_ID;
  }

  setAimState(state = {}) {
    this.aim.x = Number(state.x) || 0;
    this.aim.y = Number(state.y) || 0;
  }

  update(deltaSeconds) {
    const active = this.isActive();
    this.root.visible = active;
    if (!active) return;
    const dt = THREE.MathUtils.clamp(deltaSeconds, 0.001, 0.05);
    this.elapsed += dt;
    this.flameElapsedMs += dt * 1000;
    this.root.position.set(REST_POSITION.x + this.aim.x * 0.13, REST_POSITION.y + this.aim.y * 0.1, REST_POSITION.z);
    this.aimPivot.rotation.set(-this.aim.y * 0.23, -this.aim.x * 0.3, 0, 'YXZ');
    const nextFlameFrameIndex = Math.floor(this.flameElapsedMs / TORCH_FLAME_FRAME_DURATION_MS) % this.flameTextures.length;
    if (nextFlameFrameIndex !== this.flameFrameIndex) {
      this.flameFrameIndex = nextFlameFrameIndex;
      this.flameMaterial.map = this.flameTextures[nextFlameFrameIndex];
      this.flameMaterial.needsUpdate = true;
    }
    const flicker = 0.97 + Math.sin(this.elapsed * 6.7) * 0.02 + Math.sin(this.elapsed * 11.3) * 0.012;
    this.pointLight.intensity = TORCH_LIGHTING.point.intensity * flicker;
    this.warmSpotLight.intensity = TORCH_LIGHTING.wash.intensity * (0.985 + (flicker - 0.97) * 0.55);
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
    if (camera === this.camera) return;
    this.camera?.remove?.(this.root);
    this.camera = camera;
    this.camera?.add?.(this.root);
  }

  dispose() {
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
