import * as THREE from 'three';
import { HUMANOID_ANATOMY_REGIONS, HUMANOID_BODY_CONFIG, HUMANOID_JOINT_CONFIG } from './CombatConfig.js';
import { RAPIER } from './CombatPhysicsWorld.js';

const BODY_COLLISION_GROUPS = 0x00020001;
const tmpPosition = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpInverseQuaternion = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpDirection = new THREE.Vector3();
const HUMANOID_PHYSICAL_SCALE = 0.82;

function material(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function mesh(geometry, mat, name, position = null, scale = null) {
  const result = new THREE.Mesh(geometry, mat);
  result.name = name;
  if (position) result.position.set(...position);
  if (scale) result.scale.set(...scale);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function bodyQuaternion(rotation = [0, 0, 0]) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'));
}

export class HumanoidCombatActor {
  constructor({ physics, scene, spawnOffset = new THREE.Vector3() } = {}) {
    this.physics = physics;
    this.scene = scene;
    this.spawnOffset = spawnOffset.clone();
    this.root = new THREE.Group();
    this.root.name = 'humanoid-combat-actor-visual';
    this.debugRoot = new THREE.Group();
    this.debugRoot.name = 'humanoid-combat-actor-debug';
    this.debugRoot.visible = false;
    this.root.add(this.debugRoot);
    this.scene.add(this.root);
    this.bodies = new Map();
    this.colliders = new Map();
    this.colliderRegions = new Map();
    this.visuals = new Map();
    this.joints = [];
    this.wounds = [];
    this.regionState = new Map();
    this.elapsed = 0;
    this.motorStrength = 1;
    this.balanceImpairment = 0;
    this.consciousnessImpairment = 0;
    this.lifeState = 'alive';
    this.activeEmbeddedWeapon = null;
    this.lastReaction = null;
    this.settledSeconds = 0;
    this.dyingElapsed = 0;
    this.createMaterials();
    this.createPhysicalBody();
    this.createWoundPool();
  }

  createMaterials() {
    this.materials = {
      skin: material(0x9f7666, 0.92),
      skinShadow: material(0x694c45, 0.96),
      eye: material(0xb8aaa0, 0.7),
      iris: material(0x28251d, 0.55),
      hair: material(0x211d1b, 1),
      hairGray: material(0x4b4540, 1),
      tunic: material(0x26272a, 0.98),
      tunicEdge: material(0x121315, 1),
      leather: material(0x35261e, 0.92),
      leatherLight: material(0x584031, 0.88),
      iron: material(0x3a3b3c, 0.7, 0.45),
      cloth: material(0x1d1c1f, 1),
      boot: material(0x171311, 0.95),
      wound: material(0x320909, 0.88),
      debug: new THREE.MeshBasicMaterial({ color: 0x58d6ff, wireframe: true, transparent: true, opacity: 0.32, depthWrite: false }),
    };
  }

  createPhysicalBody() {
    HUMANOID_BODY_CONFIG.forEach((config) => this.createBody(config));
    HUMANOID_JOINT_CONFIG.forEach((config) => this.createJoint(config));
  }

  createBody(config) {
    const position = new THREE.Vector3(config.position[0] * HUMANOID_PHYSICAL_SCALE, config.position[1] * HUMANOID_PHYSICAL_SCALE, -3.55 + (config.position[2] + 3.55) * HUMANOID_PHYSICAL_SCALE).add(this.spawnOffset);
    const quaternion = bodyQuaternion(config.rotation);
    const descriptor = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation(quaternion)
      .setLinearDamping(3.4)
      .setAngularDamping(4.8)
      .setCanSleep(true);
    const body = this.physics.world.createRigidBody(descriptor);
    body.userData = { combatActor: this, bodyId: config.id, regionId: config.regionId };
    const colliderDescriptor = config.shape === 'capsule'
      ? RAPIER.ColliderDesc.capsule(config.halfHeight * HUMANOID_PHYSICAL_SCALE, config.radius * HUMANOID_PHYSICAL_SCALE)
      : RAPIER.ColliderDesc.cuboid(config.size[0] * HUMANOID_PHYSICAL_SCALE, config.size[1] * HUMANOID_PHYSICAL_SCALE, config.size[2] * HUMANOID_PHYSICAL_SCALE);
    colliderDescriptor
      .setMass(config.mass)
      .setFriction(config.id.includes('foot') ? 1.35 : 0.72)
      .setRestitution(0.015)
      .setCollisionGroups(BODY_COLLISION_GROUPS)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = this.physics.world.createCollider(colliderDescriptor, body);
    collider.userData = body.userData;
    const visual = this.createBodyVisual(config);
    visual.scale.setScalar(HUMANOID_PHYSICAL_SCALE);
    const debug = this.createDebugBody(config);
    this.root.add(visual);
    this.debugRoot.add(debug);
    const restPosition = position.clone();
    const restQuaternion = quaternion.clone();
    this.bodies.set(config.id, { body, config, restPosition, restQuaternion, previousPosition: position.clone(), previousQuaternion: quaternion.clone(), visual, debug });
    this.colliders.set(config.id, collider);
    this.colliderRegions.set(collider.handle, config.regionId);
    this.visuals.set(config.id, visual);
    this.regionState.set(config.regionId, { trauma: 0, pain: 0, structural: 0, motorWeakness: 0, maximumDepth: 0, wounds: 0 });
  }

  createJoint(config) {
    const parent = this.bodies.get(config.parentId)?.body;
    const child = this.bodies.get(config.childId)?.body;
    if (!parent || !child) throw new Error(`Combat joint references missing body: ${config.id}`);
    const parentAnchor = { x: config.parentAnchor[0] * HUMANOID_PHYSICAL_SCALE, y: config.parentAnchor[1] * HUMANOID_PHYSICAL_SCALE, z: config.parentAnchor[2] * HUMANOID_PHYSICAL_SCALE };
    const childAnchor = { x: config.childAnchor[0] * HUMANOID_PHYSICAL_SCALE, y: config.childAnchor[1] * HUMANOID_PHYSICAL_SCALE, z: config.childAnchor[2] * HUMANOID_PHYSICAL_SCALE };
    const data = config.type === 'revolute'
      ? RAPIER.JointData.revolute(parentAnchor, childAnchor, { x: 1, y: 0, z: 0 })
      : RAPIER.JointData.spherical(parentAnchor, childAnchor);
    const joint = this.physics.world.createImpulseJoint(data, parent, child, true);
    if (config.type === 'revolute') joint.setLimits(-config.limitRadians, config.childId.includes('foot') ? config.limitRadians : 0.15);
    joint.setContactsEnabled(false);
    joint.userData = config;
    this.joints.push(joint);
  }

  createDebugBody(config) {
    const geometry = config.shape === 'capsule'
      ? new THREE.CapsuleGeometry(config.radius * HUMANOID_PHYSICAL_SCALE, config.halfHeight * 2 * HUMANOID_PHYSICAL_SCALE, 4, 8)
      : new THREE.BoxGeometry(config.size[0] * 2 * HUMANOID_PHYSICAL_SCALE, config.size[1] * 2 * HUMANOID_PHYSICAL_SCALE, config.size[2] * 2 * HUMANOID_PHYSICAL_SCALE);
    const result = mesh(geometry, this.materials.debug, `anatomy-debug-${config.regionId}`);
    result.userData.regionId = config.regionId;
    return result;
  }

  createBodyVisual(config) {
    const group = new THREE.Group();
    group.name = `combat-visual-${config.id}`;
    if (config.id === 'head') return this.createHeadVisual(group);
    if (config.id === 'neck') {
      group.add(mesh(new THREE.CapsuleGeometry(0.115, 0.13, 5, 10), this.materials.skinShadow, 'weathered-neck'));
      group.add(mesh(new THREE.TorusGeometry(0.125, 0.025, 6, 12), this.materials.leather, 'rough-neck-cord', [0, 0.02, 0]));
      return group;
    }
    if (['upper_chest', 'lower_chest', 'abdomen', 'pelvis'].includes(config.id)) return this.createTorsoVisual(group, config);
    if (config.id.includes('hand')) {
      group.add(mesh(new THREE.BoxGeometry(0.19, 0.27, 0.12, 2, 2, 2), this.materials.skin, `${config.id}-weathered-hand`));
      for (let i = 0; i < 4; i += 1) group.add(mesh(new THREE.CapsuleGeometry(0.018, 0.08, 3, 6), this.materials.skinShadow, `${config.id}-finger-${i}`, [-0.057 + i * 0.038, -0.15, 0.018]));
      return group;
    }
    if (config.id.includes('foot')) {
      group.add(mesh(new THREE.BoxGeometry(0.28, 0.17, 0.52, 2, 2, 2), this.materials.boot, `${config.id}-square-toed-boot`, [0, 0, 0.02]));
      group.add(mesh(new THREE.BoxGeometry(0.3, 0.055, 0.56), this.materials.leather, `${config.id}-boot-sole`, [0, -0.105, 0.02]));
      return group;
    }
    const isArm = config.id.includes('arm') || config.id.includes('forearm');
    const isUpper = config.id.includes('upper') || config.id.includes('thigh');
    const radius = config.radius * (isUpper ? 1.09 : 1.04);
    const length = config.halfHeight * 2;
    const mat = isArm ? (isUpper ? this.materials.tunic : this.materials.leather) : (isUpper ? this.materials.cloth : this.materials.boot);
    group.add(mesh(new THREE.CapsuleGeometry(radius, length, 5, 9), mat, `${config.id}-clothed-limb`));
    if (isArm) {
      group.add(mesh(new THREE.TorusGeometry(radius * 1.04, 0.018, 5, 10), this.materials.tunicEdge, `${config.id}-binding-upper`, [0, length * 0.38, 0]));
      group.add(mesh(new THREE.TorusGeometry(radius * 1.04, 0.015, 5, 10), this.materials.leatherLight, `${config.id}-binding-lower`, [0, -length * 0.34, 0]));
    } else {
      group.add(mesh(new THREE.TorusGeometry(radius * 1.05, 0.022, 5, 10), this.materials.leather, `${config.id}-leg-wrap`, [0, -length * 0.22, 0]));
    }
    return group;
  }

  createTorsoVisual(group, config) {
    if (config.id === 'pelvis') {
      group.add(mesh(new THREE.BoxGeometry(0.76, 0.4, 0.39, 3, 2, 2), this.materials.cloth, 'combat-pelvis-dark-trousers'));
      group.add(mesh(new THREE.BoxGeometry(0.86, 0.12, 0.43), this.materials.leather, 'combat-pelvis-cracked-belt', [0, 0.14, 0]));
      group.add(mesh(new THREE.BoxGeometry(0.12, 0.16, 0.045), this.materials.iron, 'combat-pelvis-belt-buckle', [0, 0.14, 0.235]));
      return group;
    }
    const widths = { abdomen: 0.49, lower_chest: 0.72, upper_chest: 0.9 };
    const heights = { abdomen: 0.39, lower_chest: 0.42, upper_chest: 0.48 };
    const depths = { abdomen: 0.39, lower_chest: 0.42, upper_chest: 0.45 };
    group.add(mesh(new THREE.BoxGeometry(widths[config.id], heights[config.id], depths[config.id], 4, 3, 2), this.materials.tunic, `${config.id}-patched-wool-tunic`));
    group.add(mesh(new THREE.BoxGeometry(widths[config.id] * 0.92, 0.04, depths[config.id] * 1.04), this.materials.tunicEdge, `${config.id}-tunic-seam`, [0, -heights[config.id] * 0.2, 0]));
    if (config.id === 'upper_chest') {
      group.add(mesh(new THREE.BoxGeometry(0.33, 0.36, 0.055), this.materials.leather, 'chest-crossed-leather-scrap-left', [-0.19, 0, 0.245]));
      group.children.at(-1).rotation.z = -0.45;
      group.add(mesh(new THREE.BoxGeometry(0.28, 0.34, 0.045), this.materials.leatherLight, 'chest-crossed-leather-scrap-right', [0.17, -0.02, 0.24]));
      group.children.at(-1).rotation.z = 0.38;
      [-0.36, 0.36].forEach((x) => group.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), this.materials.tunicEdge, 'tense-shoulder', [x, 0.13, 0])));
    }
    return group;
  }

  createHeadVisual(group) {
    const head = mesh(new THREE.SphereGeometry(0.19, 16, 12), this.materials.skin, 'weathered-angry-male-head', [0, 0, 0], [0.88, 1.22, 0.94]);
    group.add(head);
    [-1, 1].forEach((side) => group.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), this.materials.skinShadow, `ear-${side}`, [side * 0.174, -0.005, 0])));
    const nose = mesh(new THREE.ConeGeometry(0.045, 0.12, 5), this.materials.skinShadow, 'broken-angular-nose', [0, 0.005, 0.205]);
    nose.rotation.x = Math.PI / 2;
    group.add(nose);
    [-1, 1].forEach((side) => {
      const eye = mesh(new THREE.SphereGeometry(0.032, 8, 6), this.materials.eye, `angry-eye-white-${side}`, [side * 0.062, 0.048, 0.174], [1.12, 0.48, 0.38]);
      eye.rotation.z = side * -0.11;
      group.add(eye);
      group.add(mesh(new THREE.SphereGeometry(0.012, 7, 5), this.materials.iris, `angry-eye-pupil-${side}`, [side * 0.056, 0.047, 0.199]));
      const brow = mesh(new THREE.BoxGeometry(0.118, 0.028, 0.03), this.materials.hair, `severe-lowered-brow-${side}`, [side * 0.061, 0.074, 0.184]);
      brow.rotation.z = side * 0.22;
      group.add(brow);
      group.add(mesh(new THREE.BoxGeometry(0.026, 0.09, 0.018), this.materials.skinShadow, `weather-line-${side}`, [side * 0.118, -0.005, 0.172]));
    });
    const mouth = mesh(new THREE.BoxGeometry(0.12, 0.018, 0.018), this.materials.hair, 'clenched-tense-mouth', [0, -0.09, 0.185]);
    mouth.rotation.z = -0.035;
    group.add(mouth);
    group.add(mesh(new THREE.BoxGeometry(0.15, 0.055, 0.035), this.materials.hairGray, 'rough-moustache', [0, -0.062, 0.17]));
    group.add(mesh(new THREE.ConeGeometry(0.12, 0.19, 8), this.materials.hair, 'short-unkempt-beard', [0, -0.15, 0.12]));
    const hairCap = mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), this.materials.hair, 'rough-dark-graying-hair', [0, 0.085, -0.01], [0.95, 1, 1]);
    group.add(hairCap);
    for (let i = -3; i <= 3; i += 1) {
      const lock = mesh(new THREE.ConeGeometry(0.025, 0.11 + Math.abs(i % 2) * 0.035, 5), i % 2 ? this.materials.hairGray : this.materials.hair, `matted-hair-lock-${i}`, [i * 0.045, 0.17 - Math.abs(i) * 0.008, 0.08]);
      lock.rotation.x = Math.PI;
      group.add(lock);
    }
    group.add(mesh(new THREE.BoxGeometry(0.018, 0.13, 0.012), this.materials.skinShadow, 'old-face-scar', [0.105, 0.008, 0.19]));
    group.children.at(-1).rotation.z = -0.27;
    return group;
  }

  createWoundPool() {
    for (let index = 0; index < 12; index += 1) {
      const wound = mesh(new THREE.SphereGeometry(0.025, 7, 5), this.materials.wound, `pooled-puncture-wound-${index}`);
      wound.visible = false;
      wound.castShadow = false;
      this.scene.add(wound);
      this.wounds.push({ mesh: wound, active: false, bodyId: null, localPoint: new THREE.Vector3(), severity: 0 });
    }
  }

  resolveHit(collider, worldPoint) {
    const baseRegionId = this.colliderRegions.get(collider?.handle);
    if (!baseRegionId) return null;
    const bodyId = collider.userData?.bodyId;
    const bodyEntry = this.bodies.get(bodyId);
    if (!bodyEntry) return null;
    const translation = bodyEntry.body.translation();
    const rotation = bodyEntry.body.rotation();
    const local = worldPoint.clone().sub(new THREE.Vector3(translation.x, translation.y, translation.z)).applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).invert());
    let regionId = baseRegionId;
    if (bodyId === 'head') regionId = local.z > 0.075 && local.y < 0.1 ? 'face' : 'skull';
    return { regionId, region: HUMANOID_ANATOMY_REGIONS.find((entry) => entry.id === regionId), bodyId, body: bodyEntry.body, collider, localPoint: local };
  }

  applyPenetration({ hit, entryPoint, direction, deltaDepth, depth, force, hardContact = false } = {}) {
    if (!hit?.region || this.lifeState === 'dead' && deltaDepth <= 0) return;
    const state = this.regionState.get(hit.regionId) ?? { trauma: 0, pain: 0, structural: 0, motorWeakness: 0, maximumDepth: 0, wounds: 0 };
    const severity = Math.max(0, deltaDepth) * (3.1 + hit.region.structuralImportance * 2.2) + Math.max(0, force) * 0.006 + (hardContact ? 0.005 : 0);
    state.trauma += severity;
    state.pain += severity * hit.region.painResponse;
    state.structural += severity * hit.region.structuralImportance;
    state.motorWeakness = Math.min(0.94, state.motorWeakness + severity * 0.34);
    state.maximumDepth = Math.max(state.maximumDepth, depth);
    this.regionState.set(hit.regionId, state);
    this.balanceImpairment += severity * hit.region.balanceImpact;
    this.consciousnessImpairment += severity * hit.region.consciousnessImpact;
    const impulse = direction.clone().multiplyScalar(Math.min(1.4, 0.09 + force * 0.04 + severity * 0.35));
    hit.body.applyImpulseAtPoint(impulse, entryPoint, true);
    this.lastReaction = { regionId: hit.regionId, severity, point: entryPoint.clone(), direction: direction.clone(), hardContact };
    if (state.wounds === 0 || deltaDepth > 0.025) this.showWound(hit, entryPoint, severity);
    this.evaluateLifeState();
  }

  showWound(hit, worldPoint, severity) {
    const wound = this.wounds.find((entry) => !entry.active) ?? this.wounds.reduce((oldest, entry) => entry.severity < oldest.severity ? entry : oldest, this.wounds[0]);
    wound.active = true;
    wound.bodyId = hit.bodyId;
    wound.localPoint.copy(hit.localPoint);
    wound.severity = severity;
    wound.mesh.visible = true;
    wound.mesh.scale.setScalar(THREE.MathUtils.clamp(0.75 + severity * 1.3, 0.75, 1.8));
    const state = this.regionState.get(hit.regionId);
    state.wounds += 1;
  }

  evaluateLifeState() {
    const totalTrauma = [...this.regionState.values()].reduce((sum, state) => sum + state.trauma, 0);
    const criticalTrauma = Math.max(...['head', 'face', 'skull', 'neck', 'upper_chest', 'lower_chest'].map((id) => this.regionState.get(id)?.trauma ?? 0));
    if (this.lifeState === 'alive' && (this.balanceImpairment > 0.86 || this.consciousnessImpairment > 0.72 || totalTrauma > 1.9)) this.lifeState = 'incapacitated';
    if (this.lifeState !== 'dead' && (criticalTrauma > 1.22 || this.consciousnessImpairment > 1.55 || totalTrauma > 3.7)) this.lifeState = 'dying';
    if (this.lifeState === 'dying' && (criticalTrauma > 1.55 || totalTrauma > 4.5)) this.lifeState = 'dead';
  }

  setEmbeddedWeapon(weapon) {
    this.activeEmbeddedWeapon = weapon;
  }

  beforePhysics(dt, playerPosition = null) {
    this.elapsed += dt;
    if (this.lifeState === 'dying') {
      this.dyingElapsed += dt;
      if (this.dyingElapsed >= 1.6) this.lifeState = 'dead';
    }
    if (this.lifeState === 'incapacitated') this.motorStrength = Math.max(0.12, this.motorStrength - dt * 0.48);
    else if (this.lifeState === 'dying') this.motorStrength = Math.max(0.025, this.motorStrength - dt * 0.9);
    else if (this.lifeState === 'dead') this.motorStrength = Math.max(0, this.motorStrength - dt * 1.8);
    else this.motorStrength = Math.min(1, this.motorStrength + dt * 0.25);
    this.bodies.forEach((entry, bodyId) => this.applyBodyMotor(entry, bodyId, dt, playerPosition));
  }

  applyBodyMotor(entry, bodyId, dt, playerPosition) {
    const { body, config, restPosition, restQuaternion } = entry;
    if (!body.isDynamic() || this.motorStrength <= 0.001) return;
    const regionWeakness = this.regionState.get(config.regionId)?.motorWeakness ?? 0;
    let strength = config.motor * this.motorStrength * (1 - regionWeakness);
    if (bodyId.includes('foot') && this.lifeState === 'alive') strength *= 1.55 * Math.max(0.2, 1 - this.balanceImpairment * 0.65);
    if (strength <= 0.005) return;
    const translation = body.translation();
    const velocity = body.linvel();
    tmpTarget.copy(restPosition);
    if (['upper_chest', 'lower_chest', 'abdomen'].includes(bodyId)) tmpTarget.y += Math.sin(this.elapsed * 1.65) * 0.006;
    if (this.lifeState === 'alive') tmpTarget.x += Math.sin(this.elapsed * 0.72) * 0.006 * (bodyId.includes('left') ? -1 : 1);
    tmpDirection.set(tmpTarget.x - translation.x, tmpTarget.y - translation.y, tmpTarget.z - translation.z);
    const positionalGain = bodyId.includes('foot') ? 42 : bodyId === 'pelvis' ? 30 : 24;
    const impulse = tmpDirection.multiplyScalar(config.mass * positionalGain * strength * dt);
    impulse.x -= velocity.x * config.mass * 0.34 * strength * dt;
    impulse.y -= velocity.y * config.mass * 0.2 * strength * dt;
    impulse.z -= velocity.z * config.mass * 0.34 * strength * dt;
    impulse.y += config.mass * 9.81 * dt * strength;
    const maxImpulse = config.mass * dt * (bodyId.includes('foot') ? 28 : 22);
    if (impulse.length() > maxImpulse) impulse.setLength(maxImpulse);
    body.applyImpulse(impulse, true);

    tmpQuaternion.copy(restQuaternion);
    if (bodyId === 'head' && playerPosition && this.lifeState === 'alive') {
      const dx = playerPosition.x - translation.x;
      const dz = playerPosition.z - translation.z;
      const yaw = THREE.MathUtils.clamp(Math.atan2(dx, dz), -0.48, 0.48);
      tmpQuaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    }
    const current = body.rotation();
    const currentQ = new THREE.Quaternion(current.x, current.y, current.z, current.w);
    const errorQ = tmpQuaternion.multiply(currentQ.invert()).normalize();
    const angle = 2 * Math.acos(THREE.MathUtils.clamp(errorQ.w, -1, 1));
    const sinHalf = Math.sqrt(Math.max(1e-8, 1 - errorQ.w * errorQ.w));
    const axis = sinHalf > 0.001 ? new THREE.Vector3(errorQ.x / sinHalf, errorQ.y / sinHalf, errorQ.z / sinHalf) : new THREE.Vector3();
    const angular = body.angvel();
    const torque = axis.multiplyScalar(Math.min(angle, 0.65) * config.mass * 2.2 * strength * dt);
    torque.x -= angular.x * config.mass * 0.025 * strength;
    torque.y -= angular.y * config.mass * 0.025 * strength;
    torque.z -= angular.z * config.mass * 0.025 * strength;
    if (torque.length() > config.mass * 0.24) torque.setLength(config.mass * 0.24);
    body.applyTorqueImpulse(torque, true);
  }

  afterPhysics(alpha = 1) {
    this.bodies.forEach((entry) => {
      const translation = entry.body.translation();
      const rotation = entry.body.rotation();
      tmpPosition.set(translation.x, translation.y, translation.z);
      tmpQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      entry.visual.position.lerpVectors(entry.previousPosition, tmpPosition, alpha);
      entry.visual.quaternion.slerpQuaternions(entry.previousQuaternion, tmpQuaternion, alpha);
      entry.debug.position.copy(entry.visual.position);
      entry.debug.quaternion.copy(entry.visual.quaternion);
      entry.previousPosition.copy(tmpPosition);
      entry.previousQuaternion.copy(tmpQuaternion);
    });
    this.updateWounds();
    const speed = [...this.bodies.values()].reduce((sum, entry) => { const v = entry.body.linvel(); return sum + Math.hypot(v.x, v.y, v.z); }, 0);
    if (this.lifeState === 'dead' && speed < 0.25) this.settledSeconds += 1 / 60;
    else this.settledSeconds = 0;
  }

  updateWounds() {
    this.wounds.forEach((wound) => {
      if (!wound.active) return;
      const entry = this.bodies.get(wound.bodyId);
      if (!entry) { wound.mesh.visible = false; wound.active = false; return; }
      const translation = entry.body.translation();
      const rotation = entry.body.rotation();
      wound.mesh.position.copy(wound.localPoint).applyQuaternion(tmpQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)).add(tmpPosition.set(translation.x, translation.y, translation.z));
      wound.mesh.quaternion.copy(tmpQuaternion);
    });
  }

  getRegionState(regionId) {
    return this.regionState.get(regionId) ?? null;
  }

  getDiagnostics() {
    const bodyPositions = Object.fromEntries(['pelvis', 'upper_chest', 'head', 'left_foot', 'right_foot'].map((id) => {
      const position = this.bodies.get(id)?.body?.translation?.();
      return [id, position ? [position.x, position.y, position.z].map((value) => Number(value.toFixed(2))) : null];
    }));
    return {
      state: this.lifeState,
      motorStrength: this.motorStrength,
      balanceImpairment: this.balanceImpairment,
      consciousnessImpairment: this.consciousnessImpairment,
      activeWounds: this.wounds.filter((wound) => wound.active).length,
      embeddedWeapon: this.activeEmbeddedWeapon?.state ?? null,
      settledSeconds: this.settledSeconds,
      regionalTrauma: Object.fromEntries([...this.regionState.entries()].filter(([, value]) => value.trauma > 0.001).map(([id, value]) => [id, Number(value.trauma.toFixed(3))])),
      lastReaction: this.lastReaction ? { regionId: this.lastReaction.regionId, severity: this.lastReaction.severity, hardContact: this.lastReaction.hardContact } : null,
      bodyPositions,
    };
  }

  setDebugVisible(visible) {
    this.debugRoot.visible = visible;
  }

  disposePhysicalBody() {
    this.activeEmbeddedWeapon = null;
    this.joints.forEach((joint) => this.physics.world.removeImpulseJoint(joint, false));
    this.joints = [];
    this.bodies.forEach((entry) => this.physics.world.removeRigidBody(entry.body));
    this.bodies.clear();
    this.colliders.clear();
    this.colliderRegions.clear();
    this.visuals.forEach((visual) => {
      visual.traverse((object) => object.geometry?.dispose?.());
      visual.removeFromParent();
    });
    this.visuals.clear();
    this.debugRoot.children.slice().forEach((debug) => { debug.geometry?.dispose?.(); debug.removeFromParent(); });
  }

  reset() {
    this.disposePhysicalBody();
    this.wounds.forEach((wound) => { wound.active = false; wound.mesh.visible = false; wound.severity = 0; });
    this.regionState.clear();
    this.balanceImpairment = 0;
    this.consciousnessImpairment = 0;
    this.motorStrength = 1;
    this.lifeState = 'alive';
    this.lastReaction = null;
    this.settledSeconds = 0;
    this.dyingElapsed = 0;
    this.physics.resetCount += 1;
    this.createPhysicalBody();
  }

  dispose() {
    this.disposePhysicalBody();
    this.wounds.forEach((wound) => { wound.mesh.geometry?.dispose?.(); wound.mesh.removeFromParent(); });
    Object.values(this.materials).forEach((entry) => entry.dispose?.());
    this.root.removeFromParent();
  }
}
