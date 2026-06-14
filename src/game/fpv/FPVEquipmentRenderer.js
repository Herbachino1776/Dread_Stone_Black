import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EQUIPMENT_EVENTS } from '../../engine/equipment/EquipmentEvents.js';
import { fpvWeaponProfiles } from './fpvWeaponProfiles.js';

const warnedMissingProfiles = new Set();
const gltfLoader = new GLTFLoader();

function applyTransform(object, profile, attack = null) {
  const p = profile.position ?? { x: 0, y: 0, z: -1.2 };
  const r = profile.rotation ?? { x: 0, y: 0, z: 0 };
  object.position.set(p.x, p.y, p.z);
  object.rotation.set(r.x, r.y, r.z);
  if (attack) {
    object.position.x += attack.x ?? 0;
    object.position.y += attack.y ?? 0;
    object.position.z += attack.z ?? 0;
    object.rotation.x += attack.rx ?? 0;
    object.rotation.y += attack.ry ?? 0;
    object.rotation.z += attack.rz ?? 0;
  }
}

export class FPVEquipmentRenderer {
  constructor({ root, armsOverlay, equipmentRuntime }) {
    this.root = root;
    this.armsOverlay = armsOverlay;
    this.equipmentRuntime = equipmentRuntime;
    this.weaponLayer = root.querySelector('[data-fpv-equipment-layer]');
    this.offhandLayer = root.querySelector('[data-fpv-offhand-layer]');
    this.currentProfileId = null;
    this.glbCanvas = null;
    this.glbRenderer = null;
    this.glbScene = null;
    this.glbCamera = null;
    this.glbWeapon = null;
    this.glbProfile = null;
    this.glbLoadToken = 0;
    this.attackStartedAt = 0;
    this.attackDurationMs = 0;
    this.animationFrame = null;

    this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, ({ weaponProfile, slotId, itemId }) => {
      this.setWeaponProfile(weaponProfile);
      if (slotId === 'offhand') this.setOffhand(itemId);
    });
    this.setWeaponProfile(this.equipmentRuntime.getEquippedWeaponProfile());
    this.setOffhand(this.equipmentRuntime.getEquippedOffhandId?.());
  }

  setWeaponProfile(weaponProfile) {
    const fpvProfileId = weaponProfile?.fpvProfileId ?? 'unarmed';
    const fpvProfile = fpvWeaponProfiles[fpvProfileId] ?? fpvWeaponProfiles.unarmed;
    if (!fpvWeaponProfiles[fpvProfileId] && !warnedMissingProfiles.has(fpvProfileId)) {
      warnedMissingProfiles.add(fpvProfileId);
      console.warn(`Missing FPV weapon profile "${fpvProfileId}"; using unarmed fallback.`);
    }

    if (this.currentProfileId === fpvProfile.id) return;
    this.currentProfileId = fpvProfile.id;
    this.armsOverlay.play(fpvProfile.baseClip);
    this.renderWeaponLayer(fpvProfile, weaponProfile);
  }

  renderWeaponLayer(fpvProfile, weaponProfile) {
    if (!this.weaponLayer) return;

    this.weaponLayer.className = 'first-person-weapon';
    this.weaponLayer.dataset.weaponId = weaponProfile?.id ?? fpvProfile.id;
    this.weaponLayer.hidden = fpvProfile.weaponLayer === 'none';
    this.weaponLayer.title = '';
    this.hideGlbWeapon();

    if (fpvProfile.weaponLayer === 'glb-model') {
      this.weaponLayer.hidden = false;
      this.weaponLayer.classList.add('first-person-weapon--glb');
      this.weaponLayer.title = `${weaponProfile?.displayName ?? fpvProfile.id} FPV model`;
      this.showGlbWeapon(fpvProfile);
      return;
    }
    if (fpvProfile.weaponLayer === 'sword-placeholder') {
      this.weaponLayer.classList.add('first-person-weapon--rusted-sword');
      this.weaponLayer.title = 'Rusted Sword FPV placeholder';
    }
    if (fpvProfile.weaponLayer === 'fishing-rod-placeholder') {
      this.weaponLayer.classList.add('first-person-weapon--fishing-rod');
      this.weaponLayer.title = 'Fishing Rod FPV placeholder';
    }
    if (fpvProfile.weaponLayer === 'axe-placeholder') {
      this.weaponLayer.classList.add('first-person-weapon--wood-axe');
      this.weaponLayer.title = 'Wood Axe FPV placeholder';
    }
  }

  ensureGlbOverlay() {
    if (this.glbRenderer) return;
    this.glbCanvas = document.createElement('canvas');
    this.glbCanvas.className = 'first-person-weapon__glb-canvas';
    this.glbCanvas.setAttribute('aria-hidden', 'true');
    this.weaponLayer.append(this.glbCanvas);
    this.glbRenderer = new THREE.WebGLRenderer({ canvas: this.glbCanvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.glbRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.glbRenderer.setClearColor(0x000000, 0);
    this.glbScene = new THREE.Scene();
    this.glbCamera = new THREE.PerspectiveCamera(42, 1, 0.01, 20);
    this.glbCamera.position.set(0, 0, 0);
    this.glbScene.add(new THREE.HemisphereLight(0xffe7c0, 0x160d08, 1.8));
    const key = new THREE.DirectionalLight(0xffd08a, 2.2);
    key.position.set(1.5, 2.5, 2.2);
    this.glbScene.add(key);
  }

  showGlbWeapon(fpvProfile) {
    this.ensureGlbOverlay();
    this.glbProfile = fpvProfile;
    this.glbCanvas.hidden = false;
    const token = ++this.glbLoadToken;
    if (this.glbWeapon?.userData?.modelUrl === fpvProfile.modelUrl) {
      applyTransform(this.glbWeapon, fpvProfile);
      this.startRenderLoop();
      return;
    }
    if (this.glbWeapon) this.glbScene.remove(this.glbWeapon);
    this.glbWeapon = null;
    gltfLoader.load(fpvProfile.modelUrl, (gltf) => {
      if (token !== this.glbLoadToken) return;
      const root = gltf.scene ?? gltf.scenes?.[0];
      if (!root) return;
      root.userData.modelUrl = fpvProfile.modelUrl;
      root.traverse((child) => {
        if (!child.isMesh) return;
        child.frustumCulled = false;
        child.castShadow = false;
        child.receiveShadow = false;
      });
      root.scale.setScalar(fpvProfile.scale ?? 1);
      applyTransform(root, fpvProfile);
      this.glbWeapon = root;
      this.glbScene.add(root);
      this.startRenderLoop();
    }, undefined, (error) => console.warn(`Unable to load FPV weapon model ${fpvProfile.modelUrl}`, error));
  }

  hideGlbWeapon() {
    this.glbLoadToken += 1;
    this.glbProfile = null;
    if (this.glbCanvas) this.glbCanvas.hidden = true;
    if (this.glbWeapon && this.glbScene) this.glbScene.remove(this.glbWeapon);
    this.glbWeapon = null;
  }

  setOffhand(itemId) {
    if (!this.offhandLayer) return;
    const equippedTorch = itemId === 'torch';
    this.offhandLayer.hidden = !equippedTorch;
    this.offhandLayer.dataset.offhandId = equippedTorch ? 'torch' : '';
    this.offhandLayer.title = equippedTorch ? 'Torch FPV placeholder' : '';
  }

  playAttack(weaponProfile) {
    this.setWeaponProfile(weaponProfile);
    if (!this.weaponLayer || this.weaponLayer.hidden) return;
    if (this.glbProfile?.weaponLayer === 'glb-model') {
      this.attackStartedAt = performance.now();
      this.attackDurationMs = Math.max(260, Math.min((weaponProfile?.attackCooldown ?? 0.8) * 720, 780));
      this.startRenderLoop();
      return;
    }
    this.weaponLayer.classList.remove('is-attacking');
    void this.weaponLayer.offsetWidth;
    this.weaponLayer.classList.add('is-attacking');
  }

  startRenderLoop() {
    if (this.animationFrame) return;
    const render = () => {
      this.animationFrame = null;
      if (!this.glbRenderer || !this.glbCanvas || this.glbCanvas.hidden || !this.glbProfile) return;
      const rect = this.weaponLayer.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      if (this.glbCanvas.width !== Math.floor(width * this.glbRenderer.getPixelRatio()) || this.glbCanvas.height !== Math.floor(height * this.glbRenderer.getPixelRatio())) {
        this.glbRenderer.setSize(width, height, false);
        this.glbCamera.aspect = width / height;
        this.glbCamera.updateProjectionMatrix();
      }
      if (this.glbWeapon) {
        const elapsed = performance.now() - this.attackStartedAt;
        const active = this.attackStartedAt > 0 && elapsed < this.attackDurationMs;
        if (active) {
          const t = elapsed / this.attackDurationMs;
          const windup = Math.min(t / 0.22, 1);
          const swing = t < 0.22 ? 0 : Math.min((t - 0.22) / 0.36, 1);
          const recover = t < 0.58 ? 0 : Math.min((t - 0.58) / 0.42, 1);
          const slash = Math.sin(swing * Math.PI);
          applyTransform(this.glbWeapon, this.glbProfile, {
            x: 0.08 * windup - 0.32 * slash * (1 - recover),
            y: 0.12 * windup - 0.2 * slash,
            z: -0.18 * slash,
            rx: -0.16 * windup + 0.5 * slash,
            ry: 0.12 * windup - 0.62 * slash,
            rz: -0.2 * windup - 1.05 * slash,
          });
        } else {
          this.attackStartedAt = 0;
          applyTransform(this.glbWeapon, this.glbProfile);
        }
      }
      this.glbRenderer.render(this.glbScene, this.glbCamera);
      if (this.attackStartedAt > 0) this.animationFrame = requestAnimationFrame(render);
    };
    this.animationFrame = requestAnimationFrame(render);
  }
}
