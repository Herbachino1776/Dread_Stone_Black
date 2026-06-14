import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EQUIPMENT_EVENTS } from '../../engine/equipment/EquipmentEvents.js';
import { fpvWeaponProfiles } from './fpvWeaponProfiles.js';

const warnedMissingProfiles = new Set();
const gltfLoader = new GLTFLoader();
const isDev = import.meta.env.DEV;
const DEBUG_FPV_WEAPON = false;
const BROADSWORD_FPV_PROFILE_ID = 'broadsword_ritual_01';
const DEFAULT_FPV_CAMERA = Object.freeze({ fov: 50, near: 0.01, far: 100 });
const BROADSWORD_TUNE_STEP = Object.freeze({ position: 0.03, rotation: 0.04, scale: 0.04 });

function devLog(...args) {
  if (isDev) console.info(...args);
}

function copyPose(pose = {}) {
  return {
    position: { x: pose.position?.x ?? 0, y: pose.position?.y ?? 0, z: pose.position?.z ?? -1.2 },
    rotation: { x: pose.rotation?.x ?? 0, y: pose.rotation?.y ?? 0, z: pose.rotation?.z ?? 0 },
    scale: pose.scale ?? 1,
  };
}

function applyPose(object, pose) {
  const p = pose.position ?? { x: 0, y: 0, z: -1.2 };
  const r = pose.rotation ?? { x: 0, y: 0, z: 0 };
  object.position.set(p.x, p.y, p.z);
  object.rotation.set(r.x, r.y, r.z);
  object.scale.setScalar(pose.scale ?? 1);
}

function lerpPose(from, to, t) {
  return {
    position: {
      x: THREE.MathUtils.lerp(from.position.x, to.position.x, t),
      y: THREE.MathUtils.lerp(from.position.y, to.position.y, t),
      z: THREE.MathUtils.lerp(from.position.z, to.position.z, t),
    },
    rotation: {
      x: THREE.MathUtils.lerp(from.rotation.x, to.rotation.x, t),
      y: THREE.MathUtils.lerp(from.rotation.y, to.rotation.y, t),
      z: THREE.MathUtils.lerp(from.rotation.z, to.rotation.z, t),
    },
    scale: THREE.MathUtils.lerp(from.scale, to.scale, t),
  };
}

function offsetPose(pose, offset) {
  const next = copyPose(pose);
  next.position.x += offset.x ?? 0;
  next.position.y += offset.y ?? 0;
  next.position.z += offset.z ?? 0;
  next.rotation.x += offset.rx ?? 0;
  next.rotation.y += offset.ry ?? 0;
  next.rotation.z += offset.rz ?? 0;
  next.scale += offset.scale ?? 0;
  return next;
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
    this.glbModelGroup = null;
    this.glbAxisHelper = null;
    this.glbProfile = null;
    this.glbIdlePose = null;
    this.broadswordTunePose = null;
    this.glbLoadToken = 0;
    this.attackStartedAt = 0;
    this.attackDurationMs = 0;
    this.animationFrame = null;
    this.handleDevHotkey = this.handleDevHotkey.bind(this);
    if (isDev) window.addEventListener('keydown', this.handleDevHotkey);

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
    devLog('[FPVEquipmentRenderer] equipped FPV profile id:', fpvProfile.id);
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
    devLog('[FPVEquipmentRenderer] current weaponLayer mode:', fpvProfile.weaponLayer);

    if (fpvProfile.weaponLayer === 'glb-model') {
      this.weaponLayer.hidden = false;
      this.weaponLayer.classList.add('first-person-weapon--glb');
      this.weaponLayer.title = `${weaponProfile?.displayName ?? fpvProfile.id} FPV model`;
      this.showGlbWeapon(fpvProfile, weaponProfile);
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
    this.glbCamera = new THREE.PerspectiveCamera(DEFAULT_FPV_CAMERA.fov, 1, DEFAULT_FPV_CAMERA.near, DEFAULT_FPV_CAMERA.far);
    this.glbCamera.position.set(0, 0, 0);
    this.glbScene.add(new THREE.HemisphereLight(0xffe7c0, 0x160d08, 1.8));
    const key = new THREE.DirectionalLight(0xffd08a, 2.2);
    key.position.set(1.5, 2.5, 2.2);
    this.glbScene.add(key);
  }

  showGlbWeapon(fpvProfile, weaponProfile) {
    this.ensureGlbOverlay();
    this.glbProfile = fpvProfile;
    this.glbCanvas.hidden = false;
    const token = ++this.glbLoadToken;
    devLog('[FPVEquipmentRenderer] loading GLB model URL:', fpvProfile.modelUrl);
    if (this.glbWeapon?.userData?.modelUrl === fpvProfile.modelUrl) {
      this.glbIdlePose = this.createIdlePose(fpvProfile);
      applyPose(this.glbWeapon, this.glbIdlePose);
      this.startRenderLoop();
      return;
    }
    if (this.glbWeapon) this.glbScene.remove(this.glbWeapon);
    this.glbWeapon = null;
    this.glbModelGroup = null;
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
      const weaponRoot = new THREE.Group();
      const modelGroup = new THREE.Group();
      weaponRoot.userData.modelUrl = fpvProfile.modelUrl;
      weaponRoot.add(modelGroup);
      modelGroup.add(root);
      if (!this.normalizeModel(root, modelGroup, fpvProfile)) {
        console.warn('Broadsword GLB loaded but FPV bounds/transform invalid; using placeholder.');
        this.showGlbFallback(weaponProfile);
        return;
      }
      this.glbIdlePose = this.createIdlePose(fpvProfile);
      applyPose(weaponRoot, this.glbIdlePose);
      if (isDev && DEBUG_FPV_WEAPON) {
        this.glbAxisHelper = new THREE.AxesHelper(0.45);
        weaponRoot.add(this.glbAxisHelper);
      }
      this.glbWeapon = weaponRoot;
      this.glbModelGroup = modelGroup;
      this.glbScene.add(weaponRoot);
      devLog('[FPVEquipmentRenderer] GLB loaded successfully:', fpvProfile.modelUrl);
      this.startRenderLoop();
    }, undefined, (error) => {
      if (token !== this.glbLoadToken) return;
      console.warn(`Unable to load FPV weapon model ${fpvProfile.modelUrl}`, error);
      devLog('[FPVEquipmentRenderer] GLB load failure:', fpvProfile.modelUrl, error);
      this.showGlbFallback(weaponProfile);
    });
  }

  hideGlbWeapon() {
    this.glbLoadToken += 1;
    this.glbProfile = null;
    this.glbIdlePose = null;
    this.attackStartedAt = 0;
    if (this.glbCanvas) this.glbCanvas.hidden = true;
    if (this.glbWeapon && this.glbScene) this.glbScene.remove(this.glbWeapon);
    this.glbWeapon = null;
    this.glbModelGroup = null;
    this.glbAxisHelper = null;
  }

  createIdlePose(fpvProfile) {
    if (fpvProfile.id === BROADSWORD_FPV_PROFILE_ID && this.broadswordTunePose) return copyPose(this.broadswordTunePose);
    return copyPose({ position: fpvProfile.position, rotation: fpvProfile.rotation, scale: fpvProfile.scale });
  }

  normalizeModel(root, modelGroup, fpvProfile) {
    root.updateMatrixWorld(true);
    const rawBounds = new THREE.Box3().setFromObject(root);
    const rawSize = rawBounds.getSize(new THREE.Vector3());
    const rawCenter = rawBounds.getCenter(new THREE.Vector3());
    if (!Number.isFinite(rawSize.x + rawSize.y + rawSize.z) || rawSize.y <= 0 || rawSize.length() <= 0.0001 || rawSize.length() > 1000) return false;
    const targetHeight = fpvProfile.normalizedHeight ?? 1.65;
    const normalizedScale = targetHeight / rawSize.y;
    if (!Number.isFinite(normalizedScale) || normalizedScale <= 0) return false;
    root.position.set(-rawCenter.x, -rawBounds.min.y, -rawCenter.z);
    modelGroup.scale.setScalar(normalizedScale);
    modelGroup.updateMatrixWorld(true);
    const normalizedBounds = new THREE.Box3().setFromObject(modelGroup);
    const normalizedSize = normalizedBounds.getSize(new THREE.Vector3());
    return Number.isFinite(normalizedSize.x + normalizedSize.y + normalizedSize.z) && normalizedSize.y > 0.05 && normalizedSize.y < 20;
  }

  showGlbFallback(weaponProfile) {
    this.glbProfile = null;
    if (this.glbCanvas) this.glbCanvas.hidden = true;
    if (this.glbWeapon && this.glbScene) this.glbScene.remove(this.glbWeapon);
    this.glbWeapon = null;
    this.glbModelGroup = null;
    this.glbAxisHelper = null;
    if (!this.weaponLayer) return;
    this.weaponLayer.hidden = false;
    this.weaponLayer.className = 'first-person-weapon first-person-weapon--rusted-sword';
    this.weaponLayer.dataset.weaponId = weaponProfile?.id ?? 'broadsword_ritual_01';
    this.weaponLayer.title = 'Ritual Broadsword GLB failed; using placeholder';
    devLog('[FPVEquipmentRenderer] current weaponLayer mode: sword-placeholder fallback');
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
      this.attackDurationMs = Math.max(420, Math.min((weaponProfile?.attackCooldown ?? 0.8) * 460, 520));
      this.startRenderLoop();
      return;
    }
    this.weaponLayer.classList.remove('is-attacking');
    void this.weaponLayer.offsetWidth;
    this.weaponLayer.classList.add('is-attacking');
  }

  handleDevHotkey(event) {
    if (!isDev || this.glbProfile?.id !== BROADSWORD_FPV_PROFILE_ID || !this.glbWeapon) return;
    const idlePose = this.glbIdlePose ?? this.createIdlePose(this.glbProfile);
    const nextPose = copyPose(idlePose);
    let handled = true;
    switch (event.key) {
      case 'ArrowLeft': nextPose.position.x -= BROADSWORD_TUNE_STEP.position; break;
      case 'ArrowRight': nextPose.position.x += BROADSWORD_TUNE_STEP.position; break;
      case 'ArrowUp': nextPose.position.y += BROADSWORD_TUNE_STEP.position; break;
      case 'ArrowDown': nextPose.position.y -= BROADSWORD_TUNE_STEP.position; break;
      case 'PageUp': nextPose.position.z -= BROADSWORD_TUNE_STEP.position; break;
      case 'PageDown': nextPose.position.z += BROADSWORD_TUNE_STEP.position; break;
      case 'q': case 'Q': nextPose.rotation.z -= BROADSWORD_TUNE_STEP.rotation; break;
      case 'e': case 'E': nextPose.rotation.z += BROADSWORD_TUNE_STEP.rotation; break;
      case 'w': case 'W': nextPose.rotation.x -= BROADSWORD_TUNE_STEP.rotation; break;
      case 's': case 'S': nextPose.rotation.x += BROADSWORD_TUNE_STEP.rotation; break;
      case 'a': case 'A': nextPose.rotation.y -= BROADSWORD_TUNE_STEP.rotation; break;
      case 'd': case 'D': nextPose.rotation.y += BROADSWORD_TUNE_STEP.rotation; break;
      case '-': nextPose.scale = Math.max(0.1, nextPose.scale - BROADSWORD_TUNE_STEP.scale); break;
      case '=': case '+': nextPose.scale += BROADSWORD_TUNE_STEP.scale; break;
      default: handled = false;
    }
    if (!handled) return;
    event.preventDefault();
    this.broadswordTunePose = nextPose;
    this.glbIdlePose = copyPose(nextPose);
    if (this.attackStartedAt === 0) applyPose(this.glbWeapon, this.glbIdlePose);
    console.info('FPV broadsword transform:', { position: { ...nextPose.position }, rotation: { ...nextPose.rotation }, scale: nextPose.scale });
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
          const idlePose = this.glbIdlePose ?? this.createIdlePose(this.glbProfile);
          const windupPose = offsetPose(idlePose, { x: 0.1, y: 0.12, z: -0.08, rx: -0.18, ry: -0.08, rz: -0.18 });
          const strikePose = offsetPose(idlePose, { x: -0.34, y: -0.24, z: -0.2, rx: 0.54, ry: -0.66, rz: -1.08 });
          const recoveryPose = recover > 0 ? lerpPose(strikePose, idlePose, recover) : strikePose;
          const attackPose = t < 0.22 ? lerpPose(idlePose, windupPose, windup) : lerpPose(windupPose, recoveryPose, swing);
          applyPose(this.glbWeapon, attackPose);
        } else {
          this.attackStartedAt = 0;
          this.glbIdlePose = this.createIdlePose(this.glbProfile);
          applyPose(this.glbWeapon, this.glbIdlePose);
        }
      }
      this.glbRenderer.render(this.glbScene, this.glbCamera);
      if (this.glbProfile && this.glbCanvas && !this.glbCanvas.hidden) this.animationFrame = requestAnimationFrame(render);
    };
    this.animationFrame = requestAnimationFrame(render);
  }
}
