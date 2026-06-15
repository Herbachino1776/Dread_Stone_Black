import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EQUIPMENT_EVENTS } from '../../engine/equipment/EquipmentEvents.js';

const gltfLoader = new GLTFLoader();
const BROADSWORD_FPV_PROFILE_ID = 'broadsword_ritual_01';
const BROADSWORD_WEAPON_IDS = new Set(['broadsword_ritual_01', 'rusted_sword']);
const RIGHT_HAND_BONE = 'arm_right_hand';
const RIGHT_FOREARM_BONE = 'arm_right_bot';
const FPV_ARM_BONE_NAMES = Object.freeze([
  'shoulder_right',
  'arm_right_top',
  'arm_right_bot',
  'arm_right_hand',
  'shoulder_left',
  'arm_left_top',
  'arm_left_bot',
  'arm_left_hand',
]);
const FALLBACK_HAND_BONES = ['arm_right_bot', 'arm_right_top', 'shoulder_right', 'arm_left_hand', 'arm_left_bot', 'arm_left_top', 'shoulder_left'];
const ARM_VERTEX_WEIGHT_THRESHOLD = 0.08;
const ARM_TRIANGLE_MIN_VERTICES = 2;
const ARM_TRIANGLE_MIN_AVERAGE_WEIGHT = 0.16;
const REQUIRED_ARM_ATTRIBUTES = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight'];

export const FIRST_PERSON_VIEWMODEL_CONFIG = Object.freeze({
  neckmanModelUrl: `${import.meta.env.BASE_URL}assets/player/fpv/neckman_01_optimized_idle.glb`,
  weaponModelUrl: `${import.meta.env.BASE_URL}assets/models/weapons/weapon_broadsword_ritual_01.glb`,

  viewmodelPosition: Object.freeze({ x: 0, y: 0, z: 0 }),
  viewmodelRotation: Object.freeze({ x: 0, y: 0, z: 0 }),
  viewmodelScale: 1,

  armsPosition: Object.freeze({ x: 0.02, y: -0.72, z: -0.78 }),
  armsRotation: Object.freeze({ x: -0.12, y: 0.04, z: 0 }),
  armsScale: 0.019,

  swordPositionOffset: Object.freeze({ x: 0.025, y: -0.045, z: -0.02 }),
  swordRotationOffset: Object.freeze({ x: -1.38, y: 0.18, z: 0.2 }),
  swordScale: 54,
  swordGripForwardAxis: '+Y blade axis; sword is parented under arm_right_hand via weaponHolder.',

  idleAnimationSpeed: 0.82,
  idleSwayAmount: 0.012,
  idleBobAmount: 0.01,
  attackDuration: 0.18,
  attackRecoverDuration: 0.28,
  swordSwingRotation: Object.freeze({ x: 0.72, y: -0.42, z: -0.88 }),
  swordSwingOffset: Object.freeze({ x: -0.075, y: -0.035, z: -0.08 }),
  rightHandAttackRotation: Object.freeze({ x: 0.22, y: -0.18, z: -0.28 }),
  rightForearmAttackRotation: Object.freeze({ x: 0.08, y: -0.08, z: -0.1 }),
  attackRecoilOffset: Object.freeze({ x: -0.018, y: -0.012, z: 0.018 }),
  attackRecoilRotation: Object.freeze({ x: -0.025, y: 0.015, z: -0.012 }),
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

function makeMaterialViewmodelSafe(material, { emissiveColor = 0x2f2117, emissiveIntensity = 0.18 } = {}) {
  const prepared = material?.clone?.() ?? new THREE.MeshStandardMaterial({
    color: 0xb9a18a,
    roughness: 0.82,
    metalness: 0.08,
  });
  prepared.depthTest = false;
  prepared.depthWrite = false;
  prepared.needsUpdate = true;
  if ('roughness' in prepared) prepared.roughness = Math.max(prepared.roughness ?? 0.7, 0.68);
  if ('emissive' in prepared && prepared.emissive instanceof THREE.Color) {
    prepared.emissive.lerp(new THREE.Color(emissiveColor), 0.42);
    prepared.emissiveIntensity = Math.max(prepared.emissiveIntensity ?? 0, emissiveIntensity);
  }
  return prepared;
}

function makeMaterialsViewmodelSafe(root, options) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.frustumCulled = false;
    child.castShadow = false;
    child.receiveShadow = false;
    child.renderOrder = 30;

    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => makeMaterialViewmodelSafe(material, options));
      return;
    }
    child.material = makeMaterialViewmodelSafe(child.material, options);
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

function getAttributeComponent(attribute, index, component) {
  if (component === 0 && attribute.getX) return attribute.getX(index);
  if (component === 1 && attribute.getY) return attribute.getY(index);
  if (component === 2 && attribute.getZ) return attribute.getZ(index);
  if (component === 3 && attribute.getW) return attribute.getW(index);
  return attribute.array[index * attribute.itemSize + component];
}

function getVertexArmWeight(vertexIndex, skinIndexAttribute, skinWeightAttribute, armBoneIndices) {
  let total = 0;
  const influences = Math.min(skinIndexAttribute.itemSize, skinWeightAttribute.itemSize);
  for (let component = 0; component < influences; component += 1) {
    const boneIndex = Math.round(getAttributeComponent(skinIndexAttribute, vertexIndex, component));
    const weight = getAttributeComponent(skinWeightAttribute, vertexIndex, component);
    if (weight > 0 && armBoneIndices.has(boneIndex)) total += weight;
  }
  return total;
}

function getMaterialIndexForTriangle(groups, triangleStart) {
  const group = groups.find((candidate) => triangleStart >= candidate.start && triangleStart < candidate.start + candidate.count);
  return group?.materialIndex ?? 0;
}

function getSourceVertexIndex(indexAttribute, triangleStart, triangleOffset) {
  const sourceIndex = triangleStart + triangleOffset;
  return indexAttribute ? indexAttribute.getX(sourceIndex) : sourceIndex;
}

function buildArmGeometry(sourceGeometry, armBoneIndices) {
  const position = sourceGeometry.getAttribute('position');
  const skinIndex = sourceGeometry.getAttribute('skinIndex');
  const skinWeight = sourceGeometry.getAttribute('skinWeight');
  if (!position || !skinIndex || !skinWeight) return null;

  const indexAttribute = sourceGeometry.getIndex();
  const sourceIndexCount = indexAttribute?.count ?? position.count;
  const attributeNames = Object.keys(sourceGeometry.attributes).filter((name) => (
    REQUIRED_ARM_ATTRIBUTES.includes(name) || sourceGeometry.getAttribute(name)
  ));
  const attributeValues = new Map(attributeNames.map((name) => [name, []]));
  const remappedVertices = new Map();
  const newIndices = [];
  const newGroups = [];
  let activeMaterialIndex = null;
  let activeGroupStart = 0;

  function pushGroup(materialIndex) {
    if (activeMaterialIndex === materialIndex) return;
    if (activeMaterialIndex !== null && newIndices.length > activeGroupStart) {
      newGroups.push({ start: activeGroupStart, count: newIndices.length - activeGroupStart, materialIndex: activeMaterialIndex });
    }
    activeMaterialIndex = materialIndex;
    activeGroupStart = newIndices.length;
  }

  function copyVertex(sourceVertexIndex) {
    const existing = remappedVertices.get(sourceVertexIndex);
    if (existing !== undefined) return existing;

    const remappedIndex = remappedVertices.size;
    remappedVertices.set(sourceVertexIndex, remappedIndex);
    for (const name of attributeNames) {
      const attribute = sourceGeometry.getAttribute(name);
      const values = attributeValues.get(name);
      for (let component = 0; component < attribute.itemSize; component += 1) {
        values.push(getAttributeComponent(attribute, sourceVertexIndex, component));
      }
    }
    return remappedIndex;
  }

  for (let triangleStart = 0; triangleStart <= sourceIndexCount - 3; triangleStart += 3) {
    const vertices = [
      getSourceVertexIndex(indexAttribute, triangleStart, 0),
      getSourceVertexIndex(indexAttribute, triangleStart, 1),
      getSourceVertexIndex(indexAttribute, triangleStart, 2),
    ];
    const weights = vertices.map((vertexIndex) => getVertexArmWeight(vertexIndex, skinIndex, skinWeight, armBoneIndices));
    const influencedVertices = weights.filter((weight) => weight >= ARM_VERTEX_WEIGHT_THRESHOLD).length;
    const averageWeight = weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
    if (influencedVertices < ARM_TRIANGLE_MIN_VERTICES || averageWeight < ARM_TRIANGLE_MIN_AVERAGE_WEIGHT) continue;

    pushGroup(getMaterialIndexForTriangle(sourceGeometry.groups, triangleStart));
    newIndices.push(copyVertex(vertices[0]), copyVertex(vertices[1]), copyVertex(vertices[2]));
  }

  if (activeMaterialIndex !== null && newIndices.length > activeGroupStart) {
    newGroups.push({ start: activeGroupStart, count: newIndices.length - activeGroupStart, materialIndex: activeMaterialIndex });
  }
  if (newIndices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  for (const name of attributeNames) {
    const sourceAttribute = sourceGeometry.getAttribute(name);
    const AttributeArray = sourceAttribute.array?.constructor ?? Float32Array;
    const values = attributeValues.get(name);
    geometry.setAttribute(name, new THREE.BufferAttribute(new AttributeArray(values), sourceAttribute.itemSize, sourceAttribute.normalized));
  }
  const IndexArray = remappedVertices.size > 65535 ? Uint32Array : Uint16Array;
  geometry.setIndex(new THREE.BufferAttribute(new IndexArray(newIndices), 1));
  newGroups.forEach((group) => geometry.addGroup(group.start, group.count, group.materialIndex));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createArmsOnlySkinnedMesh(sourceMesh, armBoneNames) {
  const armBoneNameSet = new Set(armBoneNames.map((name) => name.toLowerCase()));
  const armBoneIndices = new Set();
  sourceMesh.skeleton?.bones?.forEach((bone, index) => {
    if (armBoneNameSet.has((bone.name ?? '').toLowerCase())) armBoneIndices.add(index);
  });
  if (!armBoneIndices.size) return null;

  const geometry = buildArmGeometry(sourceMesh.geometry, armBoneIndices);
  if (!geometry) return null;

  const armsMesh = new THREE.SkinnedMesh(geometry, sourceMesh.material);
  armsMesh.name = `${sourceMesh.name || 'Neckman'}_FPVArmsOnly`;
  armsMesh.position.copy(sourceMesh.position);
  armsMesh.quaternion.copy(sourceMesh.quaternion);
  armsMesh.scale.copy(sourceMesh.scale);
  armsMesh.bindMode = sourceMesh.bindMode;
  armsMesh.frustumCulled = false;
  armsMesh.castShadow = false;
  armsMesh.receiveShadow = false;
  armsMesh.renderOrder = 30;
  armsMesh.bind(sourceMesh.skeleton, sourceMesh.bindMatrix);
  return armsMesh;
}

function isBroadswordProfile(profile) {
  return Boolean(profile && (BROADSWORD_WEAPON_IDS.has(profile.id) || profile.fpvProfileId === BROADSWORD_FPV_PROFILE_ID));
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
    this.rightForearmBone = null;
    this.mixer = null;
    this.idleAction = null;
    this.loadToken = 0;
    this.previousRightHandAttack = new THREE.Quaternion();
    this.previousRightForearmAttack = new THREE.Quaternion();

    this.viewmodelRoot = new THREE.Group();
    this.viewmodelRoot.name = 'FirstPersonViewModelRoot';
    this.armsRoot = new THREE.Group();
    this.armsRoot.name = 'FirstPersonViewModelArmsRoot';
    this.modelRoot = this.armsRoot;
    this.weaponHolder = new THREE.Group();
    this.weaponHolder.name = 'FirstPersonViewModelWeaponHolder';
    this.weaponRoot = new THREE.Group();
    this.weaponRoot.name = 'FirstPersonViewModelWeaponRoot';
    this.weaponHolder.add(this.weaponRoot);

    this.fillLight = new THREE.HemisphereLight(0xffdfb2, 0x19100b, 1.9);
    this.keyLight = new THREE.DirectionalLight(0xffc37a, 1.7);
    this.keyLight.position.set(1.3, 1.2, 0.8);

    setVector3(this.viewmodelRoot.position, this.config.viewmodelPosition);
    setEuler(this.viewmodelRoot.rotation, this.config.viewmodelRotation);
    this.viewmodelRoot.scale.setScalar(this.config.viewmodelScale);
    setVector3(this.armsRoot.position, this.config.armsPosition);
    setEuler(this.armsRoot.rotation, this.config.armsRotation);
    this.armsRoot.scale.setScalar(this.config.armsScale);

    this.viewmodelRoot.add(this.fillLight, this.keyLight, this.armsRoot);
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

    root.name = 'FirstPersonNeckmanSourceRig';
    makeMaterialsViewmodelSafe(root, { emissiveColor: 0x382618, emissiveIntensity: 0.24 });
    this.installArmsOnlyMeshes(root);
    this.modelRoot.add(root);
    this.rightHandAttachTarget = findNamedObject(root, RIGHT_HAND_BONE, FALLBACK_HAND_BONES);
    this.rightForearmBone = findNamedObject(root, RIGHT_FOREARM_BONE);
    if (!this.rightHandAttachTarget) {
      console.warn(`First-person Neckman viewmodel could not find "${RIGHT_HAND_BONE}"; using arms root fallback weapon mount.`);
      this.modelRoot.add(this.weaponHolder);
    } else {
      this.rightHandAttachTarget.add(this.weaponHolder);
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

  installArmsOnlyMeshes(root) {
    const sourceMeshes = [];
    root.traverse((child) => {
      if (child.isSkinnedMesh) sourceMeshes.push(child);
    });

    let armsMeshCount = 0;
    sourceMeshes.forEach((sourceMesh) => {
      const armsMesh = createArmsOnlySkinnedMesh(sourceMesh, FPV_ARM_BONE_NAMES);
      sourceMesh.visible = false;
      if (!armsMesh || !sourceMesh.parent) return;
      sourceMesh.parent.add(armsMesh);
      armsMeshCount += 1;
    });

    root.traverse((child) => {
      if (child.isMesh && !child.name.endsWith('_FPVArmsOnly')) child.visible = false;
    });

    if (armsMeshCount === 0) {
      console.warn('First-person Neckman viewmodel could not extract arms-only skinned geometry; source meshes remain hidden.');
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
    setVector3(this.weaponRoot.position, this.config.swordPositionOffset);
    setEuler(this.weaponRoot.rotation, this.config.swordRotationOffset);
    this.weaponRoot.scale.setScalar(this.config.swordScale);
  }

  setWeaponProfile(weaponProfile) {
    this.currentWeaponProfile = weaponProfile ?? null;
    this.updateWeaponVisibility();
  }

  updateWeaponVisibility() {
    this.weaponHolder.visible = isBroadswordProfile(this.currentWeaponProfile);
  }

  playAttack(weaponProfile) {
    if (weaponProfile) this.setWeaponProfile(weaponProfile);
    if (this.attackElapsed < this.config.attackDuration + this.config.attackRecoverDuration) return;
    this.attackElapsed = 0;
  }

  removeBoneAttackAdditives() {
    if (this.rightHandAttachTarget && !this.previousRightHandAttack.equals(new THREE.Quaternion())) {
      this.rightHandAttachTarget.quaternion.multiply(this.previousRightHandAttack.clone().invert());
      this.previousRightHandAttack.identity();
    }
    if (this.rightForearmBone && !this.previousRightForearmAttack.equals(new THREE.Quaternion())) {
      this.rightForearmBone.quaternion.multiply(this.previousRightForearmAttack.clone().invert());
      this.previousRightForearmAttack.identity();
    }
  }

  applyBoneAttackAdditive(bone, previous, rotation, attack) {
    if (!bone || !rotation || attack <= 0) return;
    const additive = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      (rotation.x ?? 0) * attack,
      (rotation.y ?? 0) * attack,
      (rotation.z ?? 0) * attack,
    ));
    bone.quaternion.multiply(additive);
    previous.copy(additive);
  }

  update(deltaSeconds) {
    this.elapsed += deltaSeconds;
    this.removeBoneAttackAdditives();
    this.mixer?.update(deltaSeconds);
    this.attackElapsed += deltaSeconds;

    const idleX = Math.sin(this.elapsed * 1.7) * this.config.idleSwayAmount;
    const idleY = Math.sin(this.elapsed * 2.2) * this.config.idleBobAmount;
    const idleZ = Math.cos(this.elapsed * 1.45) * this.config.idleSwayAmount * 0.55;
    const baseViewmodelPosition = this.config.viewmodelPosition;
    const baseViewmodelRotation = this.config.viewmodelRotation;
    const baseArmsPosition = this.config.armsPosition;
    const baseArmsRotation = this.config.armsRotation;

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

    this.viewmodelRoot.position.set(baseViewmodelPosition.x, baseViewmodelPosition.y, baseViewmodelPosition.z);
    this.viewmodelRoot.rotation.set(baseViewmodelRotation.x, baseViewmodelRotation.y, baseViewmodelRotation.z);
    this.armsRoot.position.set(
      baseArmsPosition.x + idleX + this.config.attackRecoilOffset.x * attack,
      baseArmsPosition.y + idleY + this.config.attackRecoilOffset.y * attack,
      baseArmsPosition.z + idleZ + this.config.attackRecoilOffset.z * attack,
    );
    this.armsRoot.rotation.set(
      baseArmsRotation.x + this.config.attackRecoilRotation.x * attack,
      baseArmsRotation.y + this.config.attackRecoilRotation.y * attack,
      baseArmsRotation.z + this.config.attackRecoilRotation.z * attack,
    );

    this.weaponHolder.position.set(
      this.config.swordSwingOffset.x * attack,
      this.config.swordSwingOffset.y * attack,
      this.config.swordSwingOffset.z * attack,
    );
    this.weaponHolder.rotation.set(
      this.config.swordSwingRotation.x * attack,
      this.config.swordSwingRotation.y * attack,
      this.config.swordSwingRotation.z * attack,
    );

    this.applyBoneAttackAdditive(this.rightHandAttachTarget, this.previousRightHandAttack, this.config.rightHandAttackRotation, attack);
    this.applyBoneAttackAdditive(this.rightForearmBone, this.previousRightForearmAttack, this.config.rightForearmAttackRotation, attack);
  }

  dispose() {
    this.unsubscribeEquipment?.();
    this.removeBoneAttackAdditives();
    this.camera.remove(this.viewmodelRoot);
    this.mixer?.stopAllAction();
  }
}
