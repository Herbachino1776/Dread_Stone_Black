import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EQUIPMENT_EVENTS } from '../../engine/equipment/EquipmentEvents.js';

const gltfLoader = new GLTFLoader();
const BROADSWORD_FPV_PROFILE_ID = 'broadsword_ritual_01';
const BROADSWORD_WEAPON_IDS = new Set(['broadsword_ritual_01', 'rusted_sword']);
const RIGHT_HAND_BONE = 'arm_right_hand';
const FALLBACK_HAND_BONES = ['arm_right_bot', 'arm_right_top', 'shoulder_right', 'arm_left_hand', 'arm_left_bot', 'arm_left_top', 'shoulder_left'];

export const FIRST_PERSON_VIEWMODEL_CONFIG = Object.freeze({
  neckmanModelUrl: `${import.meta.env.BASE_URL}assets/player/fpv/neckman_01_optimized_idle.glb`,
  weaponModelUrl: `${import.meta.env.BASE_URL}assets/models/weapons/weapon_broadsword_ritual_01.glb`,

  // Exposed for tuning because this first pass uses the full Neckman body as a camera-space FPV prototype.
  viewmodelPosition: Object.freeze({ x: 0, y: 0, z: 0 }),
  viewmodelRotation: Object.freeze({ x: 0, y: 0, z: 0 }),
  viewmodelScale: 1,
  neckmanModelScale: 0.018,
  neckmanModelPosition: Object.freeze({ x: 0.04, y: -0.82, z: -0.86 }),
  neckmanModelRotation: Object.freeze({ x: -0.05, y: 0.02, z: 0 }),

  weaponPositionOffset: Object.freeze({ x: 0.02, y: -0.05, z: -0.015 }),
  weaponRotationOffset: Object.freeze({ x: -1.42, y: 0.12, z: 0.16 }),
  weaponScale: 56,
  swordPositionOffset: Object.freeze({ x: 0.02, y: -0.05, z: -0.015 }),
  swordRotationOffset: Object.freeze({ x: -1.42, y: 0.12, z: 0.16 }),
  swordScale: 56,
  swordGripForwardAxis: '+Y blade axis; large local scale compensates for the scaled Neckman skeleton parent.',

  idleAnimationSpeed: 0.82,
  idleSwayAmount: 0.018,
  idleBobAmount: 0.014,
  attackDuration: 0.24,
  attackRecoverDuration: 0.34,
  attackSwingRotation: Object.freeze({ x: 0.42, y: -0.34, z: -0.52 }),
  attackSwingOffset: Object.freeze({ x: -0.11, y: -0.06, z: -0.08 }),
  attackBobAmount: 0.045,
  attackAmplitude: 1,
});

function setVector3(target, values) {
  target.set(values.x ?? 0, values.y ?? 0, values.z ?? 0);
}

function setEuler(target, values) {
  target.set(values.x ?? 0, values.y ?? 0, values.z ?? 0);
}

function loadGltf(url) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, resolve, undefined, reject);
  });
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * THREE.MathUtils.clamp(t, 0, 1)) - 1) / 2;
}

function makeMaterialsViewmodelSafe(root, { emissiveColor = 0x2f2117, emissiveIntensity = 0.18 } = {}) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.frustumCulled = false;
    child.castShadow = false;
    child.receiveShadow = false;
    child.renderOrder = 30;

    const materials = Array.isArray(child.material) ? child.material : [child.material].filter(Boolean);
    if (!materials.length) {
      child.material = new THREE.MeshStandardMaterial({
        color: 0xb9a18a,
        roughness: 0.82,
        metalness: 0.08,
        emissive: emissiveColor,
        emissiveIntensity,
        depthTest: false,
        depthWrite: false,
      });
      return;
    }

    const prepared = materials.map((material) => {
      const clone = material.clone();
      clone.depthTest = false;
      clone.depthWrite = false;
      clone.needsUpdate = true;
      if ('roughness' in clone) clone.roughness = Math.max(clone.roughness ?? 0.7, 0.68);
      if ('emissive' in clone && clone.emissive instanceof THREE.Color) {
        clone.emissive.lerp(new THREE.Color(emissiveColor), 0.42);
        clone.emissiveIntensity = Math.max(clone.emissiveIntensity ?? 0, emissiveIntensity);
      }
      return clone;
    });
    child.material = Array.isArray(child.material) ? prepared : prepared[0];
  });
}

function findNamedObject(root, preferredName, fallbackNames = []) {
  const names = [preferredName, ...fallbackNames];
  for (const name of names) {
    const found = root.getObjectByName(name);
    if (found) return found;
  }
  return null;
}

export class FirstPersonViewModel {
  constructor({ camera, equipmentRuntime, config = FIRST_PERSON_VIEWMODEL_CONFIG }) {
    this.camera = camera;
    this.equipmentRuntime = equipmentRuntime;
    this.config = config;
    this.elapsed = 0;
    this.attackElapsed = Infinity;
    this.currentWeaponProfile = this.equipmentRuntime?.getEquippedWeaponProfile?.() ?? null;
    this.currentWeaponModel = null;
    this.rightHandAttachTarget = null;
    this.mixer = null;
    this.idleAction = null;
    this.loadToken = 0;

    this.viewmodelRoot = new THREE.Group();
    this.viewmodelRoot.name = 'FirstPersonViewModelRoot';
    this.armsRoot = new THREE.Group();
    this.armsRoot.name = 'FirstPersonViewModelArmsRoot';
    this.modelRoot = this.armsRoot;
    this.weaponRoot = new THREE.Group();
    this.weaponRoot.name = 'FirstPersonViewModelWeaponRoot';

    this.fillLight = new THREE.HemisphereLight(0xffdfb2, 0x19100b, 1.9);
    this.keyLight = new THREE.DirectionalLight(0xffc37a, 1.7);
    this.keyLight.position.set(1.3, 1.2, 0.8);

    setVector3(this.viewmodelRoot.position, this.config.viewmodelPosition);
    setEuler(this.viewmodelRoot.rotation, this.config.viewmodelRotation);
    this.viewmodelRoot.scale.setScalar(this.config.viewmodelScale);
    setVector3(this.modelRoot.position, this.config.neckmanModelPosition);
    setEuler(this.modelRoot.rotation, this.config.neckmanModelRotation);
    this.modelRoot.scale.setScalar(this.config.neckmanModelScale);

    this.viewmodelRoot.add(this.fillLight, this.keyLight, this.modelRoot);
    this.camera.add(this.viewmodelRoot);

    this.unsubscribeEquipment = this.equipmentRuntime?.on?.(EQUIPMENT_EVENTS.equippedChanged, ({ weaponProfile }) => {
      this.setWeaponProfile(weaponProfile);
    });
    this.setWeaponProfile(this.currentWeaponProfile);
    this.load();
  }

  async load() {
    const token = ++this.loadToken;
    try {
      const [neckman, sword] = await Promise.all([
        loadGltf(this.config.neckmanModelUrl),
        loadGltf(this.config.weaponModelUrl),
      ]);
      if (token !== this.loadToken) return;
      this.installNeckman(neckman);
      this.installSword(sword);
      this.updateWeaponVisibility();
    } catch (error) {
      console.warn('Unable to load first-person 3D viewmodel assets.', error);
    }
  }

  installNeckman(gltf) {
    const root = gltf.scene ?? gltf.scenes?.[0];
    if (!root) {
      console.warn(`First-person Neckman GLB loaded without a scene: ${this.config.neckmanModelUrl}`);
      return;
    }

    root.name = 'FirstPersonNeckmanPrototype';
    makeMaterialsViewmodelSafe(root, { emissiveColor: 0x382618, emissiveIntensity: 0.24 });
    this.modelRoot.add(root);
    this.rightHandAttachTarget = findNamedObject(root, RIGHT_HAND_BONE, FALLBACK_HAND_BONES);
    if (!this.rightHandAttachTarget) {
      console.warn(`First-person Neckman viewmodel could not find "${RIGHT_HAND_BONE}"; using root fallback weapon mount.`);
      this.modelRoot.add(this.weaponRoot);
    } else {
      this.rightHandAttachTarget.add(this.weaponRoot);
    }
    this.applyWeaponTransform();

    const clips = gltf.animations ?? [];
    if (clips.length > 0) {
      this.mixer = new THREE.AnimationMixer(root);
      const clip = clips.find((candidate) => candidate.name.toLowerCase().includes('idle')) ?? clips[0];
      this.idleAction = this.mixer.clipAction(clip);
      this.idleAction.timeScale = this.config.idleAnimationSpeed;
      this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
      this.idleAction.enabled = true;
      this.idleAction.play();
    }
  }

  installSword(gltf) {
    const root = gltf.scene ?? gltf.scenes?.[0];
    if (!root) {
      console.warn(`First-person broadsword GLB loaded without a scene: ${this.config.weaponModelUrl}`);
      return;
    }

    root.name = 'FirstPersonRitualBroadsword';
    makeMaterialsViewmodelSafe(root, { emissiveColor: 0x37220f, emissiveIntensity: 0.2 });
    this.currentWeaponModel = root;
    this.weaponRoot.add(root);
    this.applyWeaponTransform();
  }

  applyWeaponTransform() {
    setVector3(this.weaponRoot.position, this.config.swordPositionOffset ?? this.config.weaponPositionOffset);
    setEuler(this.weaponRoot.rotation, this.config.swordRotationOffset ?? this.config.weaponRotationOffset);
    this.weaponRoot.scale.setScalar(this.config.swordScale ?? this.config.weaponScale);
  }

  setWeaponProfile(weaponProfile) {
    this.currentWeaponProfile = weaponProfile ?? null;
    this.updateWeaponVisibility();
  }

  updateWeaponVisibility() {
    const profile = this.currentWeaponProfile;
    const shouldShowSword = Boolean(
      profile
      && (BROADSWORD_WEAPON_IDS.has(profile.id) || profile.fpvProfileId === BROADSWORD_FPV_PROFILE_ID),
    );
    this.weaponRoot.visible = shouldShowSword;
  }

  playAttack(weaponProfile) {
    if (weaponProfile) this.setWeaponProfile(weaponProfile);
    if (this.attackElapsed < this.config.attackDuration + this.config.attackRecoverDuration) return;
    this.attackElapsed = 0;
  }

  update(deltaSeconds) {
    this.elapsed += deltaSeconds;
    this.mixer?.update(deltaSeconds);
    this.attackElapsed += deltaSeconds;

    const idleX = Math.sin(this.elapsed * 1.7) * this.config.idleSwayAmount;
    const idleY = Math.sin(this.elapsed * 2.2) * this.config.idleBobAmount;
    const idleZ = Math.cos(this.elapsed * 1.45) * this.config.idleSwayAmount * 0.55;
    const basePosition = this.config.viewmodelPosition;
    const baseRotation = this.config.viewmodelRotation;
    const swingOffset = this.config.attackSwingOffset;
    const swingRotation = this.config.attackSwingRotation;

    let attack = 0;
    const totalAttackDuration = this.config.attackDuration + this.config.attackRecoverDuration;
    if (this.attackElapsed < totalAttackDuration) {
      const strikeCutoff = this.config.attackDuration / totalAttackDuration;
      if (this.attackElapsed / totalAttackDuration <= strikeCutoff) {
        attack = easeOutCubic(this.attackElapsed / this.config.attackDuration);
      } else {
        attack = 1 - easeInOutSine((this.attackElapsed - this.config.attackDuration) / this.config.attackRecoverDuration);
      }
      attack *= this.config.attackAmplitude;
    }

    this.viewmodelRoot.position.set(
      basePosition.x + idleX + swingOffset.x * attack,
      basePosition.y + idleY + swingOffset.y * attack - Math.sin(attack * Math.PI) * this.config.attackBobAmount,
      basePosition.z + idleZ + swingOffset.z * attack,
    );
    this.viewmodelRoot.rotation.set(
      baseRotation.x + swingRotation.x * attack,
      baseRotation.y + swingRotation.y * attack,
      baseRotation.z + swingRotation.z * attack,
    );
  }

  dispose() {
    this.unsubscribeEquipment?.();
    this.camera.remove(this.viewmodelRoot);
    this.mixer?.stopAllAction();
  }
}
