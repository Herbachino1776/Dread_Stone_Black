import * as THREE from 'three';
import { HUMANOID_ANATOMY_REGIONS, HUMANOID_BODY_CONFIG, HUMANOID_JOINT_CONFIG } from './CombatConfig.js';
import { RAPIER } from './CombatPhysicsWorld.js';
import { CombatWoundSystem } from './CombatWoundSystem.js';
import { CombatPhysiology } from './CombatPhysiology.js';
import { COLLAPSE_CONFIG, HUMANOID_DURABILITY_CONFIG, VESSEL_ZONES } from './CombatStage2Config.js';
import { COMBAT_MORTALITY_MODES, IMMORTAL_REACTIVE_CONFIG } from './CombatMortality.js';
import { HumanoidGlbVisualAdapter } from './HumanoidGlbVisualAdapter.js';
import { CURRENT_HUMANOID_PROFILE } from './HumanoidModelProfiles.js';
import { getKnifeWoundDecalLibrary } from './KnifeWoundDecalLibrary.js';

const BODY_COLLISION_GROUPS = 0x00020001;
const tmpPosition = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpInverseQuaternion = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpDirection = new THREE.Vector3();
const HUMANOID_PHYSICAL_SCALE = 0.82;
let humanoidActorInstanceSerial = 0;

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
  constructor({ physics, scene, spawnOffset = new THREE.Vector3(), spawnYaw = 0, eventSink = null, mortalityMode = COMBAT_MORTALITY_MODES.normal, visualProfile = CURRENT_HUMANOID_PROFILE, automaticMortality = true, isolateVisualMaterials = false, instanceId = null } = {}) {
    this.physics = physics;
    this.scene = scene;
    this.instanceId = instanceId ?? `humanoid-${++humanoidActorInstanceSerial}`;
    this.disposed = false;
    this.spawnOffset = spawnOffset.clone();
    this.spawnYaw = Number.isFinite(spawnYaw) ? spawnYaw : 0;
    this.visualRootYaw = this.spawnYaw;
    this.livingVelocity = new THREE.Vector3();
    this.automaticMortality = automaticMortality !== false;
    this.isolateVisualMaterials = isolateVisualMaterials === true;
    this.spawnRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.spawnYaw);
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
    this.vesselDebug = [];
    this.eventSink = eventSink;
    this.mortalityMode = mortalityMode;
    this.visualProfile = visualProfile;
    this.animationAuthorityReady = false;
    this.ragdollActive = false;
    this.ragdollForced = false;
    this.reactiveCollapseElapsed = 0;
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
    this.collapseFamily = null;
    this.collapseReason = null;
    this.reflex = { regionId: null, intensity: 0, time: 0, direction: new THREE.Vector3() };
    this.environmentContactHints = { groundY: this.spawnOffset.y, wallX: null };
    this.impactCooldowns = new Map();
    this.corpseSleeping = false;
    this.finalSettleEmitted = false;
    this.createMaterials();
    this.createPhysicalBody();
    const pelvisRest = this.bodies.get('pelvis')?.restPosition ?? new THREE.Vector3();
    this.visualRootPosition = new THREE.Vector3(pelvisRest.x, this.spawnOffset.y, pelvisRest.z);
    this.visualAdapter = typeof window !== 'undefined' ? new HumanoidGlbVisualAdapter({ actor: this, parent: this.root, profile: this.visualProfile, isolateMaterials: this.isolateVisualMaterials }) : null;
    this.woundSystem = new CombatWoundSystem({ actor: this, scene: this.scene, decalLibrary: getKnifeWoundDecalLibrary(), isolateMaterials: this.isolateVisualMaterials });
    this.wounds = this.woundSystem.wounds;
    this.physiology = new CombatPhysiology({ actor: this, woundSystem: this.woundSystem, eventSink: this.eventSink });
  }

  setEventSink(eventSink) { this.eventSink = eventSink; this.physiology?.setEventSink?.(eventSink); }
  setEnvironmentContactHints(hints = {}) { Object.assign(this.environmentContactHints, hints); }
  setLivingRootTransform(position, yaw = this.visualRootYaw, velocity = null) {
    if (this.ragdollActive || this.disposed || !position) return false;
    this.visualRootPosition.copy(position);
    this.visualRootYaw = Number.isFinite(yaw) ? yaw : this.visualRootYaw;
    if (velocity) this.livingVelocity.copy(velocity);
    else this.livingVelocity.set(0, 0, 0);
    this.visualAdapter?.setAuthoritativeTransform?.(this.visualRootPosition, this.visualRootYaw);
    return true;
  }
  setMortalityMode(mode) {
    this.mortalityMode = mode === COMBAT_MORTALITY_MODES.normal ? COMBAT_MORTALITY_MODES.normal : COMBAT_MORTALITY_MODES.immortalReactive;
    if (this.isImmortalReactive() && ['dying', 'dead'].includes(this.lifeState)) this.recoverReactivePosture(true);
  }
  isImmortalReactive() { return this.mortalityMode === COMBAT_MORTALITY_MODES.immortalReactive; }
  setAnimationAuthorityReady(adapter) {
    if (adapter !== this.visualAdapter && this.visualAdapter) return;
    this.animationAuthorityReady = this.visualProfile.animationAuthoritative === true;
    this.syncAnimationProxyBodies(adapter);
  }

  prepareFrame(deltaSeconds) {
    if (this.visualProfile.animationAuthoritative && !this.ragdollActive) this.visualAdapter?.updateAnimationAuthority?.(deltaSeconds);
    if (!this.ragdollActive && this.lifeState !== 'alive' && (!this.isImmortalReactive() || this.ragdollForced)) this.activateRagdoll({ forced: this.ragdollForced });
  }

  syncAnimationProxyBodies(adapter = this.visualAdapter) {
    if (!this.animationAuthorityReady || !adapter || this.ragdollActive) return;
    this.bodies.forEach((entry, bodyId) => {
      const pose = adapter.getProxyPose(bodyId);
      if (!pose) return;
      entry.body.setTranslation(pose.position, true);
      entry.body.setRotation(pose.quaternion, true);
      entry.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      entry.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
      entry.visual.position.copy(pose.position);
      entry.visual.quaternion.copy(pose.quaternion);
      entry.debug.position.copy(pose.position);
      entry.debug.quaternion.copy(pose.quaternion);
      entry.previousPosition.copy(pose.position);
      entry.previousQuaternion.copy(pose.quaternion);
    });
    this.physics.world.propagateModifiedBodyPositionsToColliders();
  }

  createMaterials() {
    this.materials = {
      wound: material(0x320909, 0.88),
      debug: new THREE.MeshBasicMaterial({ color: 0x58d6ff, wireframe: true, transparent: true, opacity: 0.32, depthWrite: false }),
    };
  }

  createPhysicalBody() {
    HUMANOID_BODY_CONFIG.forEach((config) => this.createBody(config));
    HUMANOID_JOINT_CONFIG.forEach((config) => this.createJoint(config));
    this.createVesselDebug();
  }

  createVesselDebug() {
    VESSEL_ZONES.forEach((zone) => {
      const region = HUMANOID_ANATOMY_REGIONS.find((entry) => entry.id === zone.regionId);
      if (!region || !this.bodies.has(region.bodyId)) return;
      const geometry = new THREE.SphereGeometry(zone.surfaceRadius, 8, 6);
      const mat = new THREE.MeshBasicMaterial({ color: zone.vesselType.includes('arterial') ? 0xff3040 : 0x4e70ff, wireframe: true, transparent: true, opacity: 0.65, depthTest: false });
      const marker = new THREE.Mesh(geometry, mat);
      marker.name = `vessel-zone-${zone.id}`;
      marker.renderOrder = 20001;
      this.debugRoot.add(marker);
      this.vesselDebug.push({ zone, bodyId: region.bodyId, localPoint: new THREE.Vector3(zone.surfaceCenter[0], zone.surfaceCenter[1], region.bodyId === 'neck' ? 0.08 : region.bodyId.includes('thigh') ? 0.1 : 0.075), marker });
    });
  }

  createBody(config) {
    const proxyFit = this.visualProfile.animationAuthoritative ? this.visualProfile.proxyFit?.[config.id] : null;
    const position = new THREE.Vector3(config.position[0] * HUMANOID_PHYSICAL_SCALE, config.position[1] * HUMANOID_PHYSICAL_SCALE, (config.position[2] + 3.55) * HUMANOID_PHYSICAL_SCALE)
      .applyQuaternion(this.spawnRotation)
      .add(new THREE.Vector3(this.spawnOffset.x, this.spawnOffset.y, this.spawnOffset.z - 3.55));
    const quaternion = this.spawnRotation.clone().multiply(bodyQuaternion(config.rotation));
    const descriptor = (proxyFit ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.dynamic())
      .setTranslation(position.x, position.y, position.z)
      .setRotation(quaternion)
      .setLinearDamping(3.4)
      .setAngularDamping(4.8)
      .setCanSleep(true);
    const body = this.physics.world.createRigidBody(descriptor);
    body.userData = { combatActor: this, bodyId: config.id, regionId: config.regionId };
    const colliderDescriptor = proxyFit?.shape === 'capsule'
      ? RAPIER.ColliderDesc.capsule(proxyFit.halfHeight, proxyFit.radius)
      : proxyFit?.shape === 'box'
        ? RAPIER.ColliderDesc.cuboid(...proxyFit.halfExtents)
        : config.shape === 'capsule'
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
    const visual = new THREE.Group();
    visual.name = `combat-body-transform-${config.id}`;
    visual.position.copy(position);
    visual.quaternion.copy(quaternion);
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
    const proxyFit = this.visualProfile.animationAuthoritative ? this.visualProfile.proxyFit?.[config.id] : null;
    const geometry = proxyFit?.shape === 'capsule'
      ? new THREE.CapsuleGeometry(proxyFit.radius, proxyFit.halfHeight * 2, 4, 8)
      : proxyFit?.shape === 'box'
        ? new THREE.BoxGeometry(proxyFit.halfExtents[0] * 2, proxyFit.halfExtents[1] * 2, proxyFit.halfExtents[2] * 2)
        : config.shape === 'capsule'
          ? new THREE.CapsuleGeometry(config.radius * HUMANOID_PHYSICAL_SCALE, config.halfHeight * 2 * HUMANOID_PHYSICAL_SCALE, 4, 8)
          : new THREE.BoxGeometry(config.size[0] * 2 * HUMANOID_PHYSICAL_SCALE, config.size[1] * 2 * HUMANOID_PHYSICAL_SCALE, config.size[2] * 2 * HUMANOID_PHYSICAL_SCALE);
    const result = mesh(geometry, this.materials.debug, `anatomy-debug-${config.regionId}`);
    result.userData.regionId = config.regionId;
    return result;
  }

  resolveHit(collider, worldPoint) {
    if (this.disposed) return null;
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
    return { actor: this, regionId, region: HUMANOID_ANATOMY_REGIONS.find((entry) => entry.id === regionId), bodyId, body: bodyEntry.body, collider, localPoint: local };
  }

  beginPunctureWound({ hit, entryPoint, direction, surfaceNormal = null, entryTangent = null, depth = 0.004, impactSeverity = 0, weaponProfile = null, hardContact = false, weaponId = 'old_work_knife', deferReaction = false, deferAudio = false } = {}) {
    const wound = this.woundSystem.createPuncture({ hit, entryPoint, axis: direction, surfaceNormal, entryTangent, depth, impactSeverity, weaponProfile, hardStructureContact: hardContact, embeddedWeaponId: weaponId, createdTime: this.elapsed });
    const state = this.regionState.get(hit.regionId);
    if (state) state.wounds = (state.wounds ?? 0) + 1;
    this.physiology.onWoundCreated(wound);
    if (!deferAudio) this.eventSink?.('puncture', { position: entryPoint, severity: wound.severity, wound });
    if (!deferReaction) this.triggerReflex(hit.regionId, Math.max(0.2, wound.severity), direction, { point: entryPoint, depth, force: 0.25, source: 'new_puncture' });
    return wound;
  }

  applyPenetration({ hit, entryPoint, direction, deltaDepth, depth, force, lateralMotion = 0, hardContact = false, woundId = null } = {}) {
    if (!hit?.region || this.lifeState === 'dead' && deltaDepth <= 0) return;
    const state = this.regionState.get(hit.regionId) ?? { trauma: 0, pain: 0, structural: 0, motorWeakness: 0, maximumDepth: 0, wounds: 0 };
    const severity = (Math.max(0, deltaDepth) * (3.1 + hit.region.structuralImportance * 2.2) + Math.max(0, force) * 0.006 + (hardContact ? 0.005 : 0)) * HUMANOID_DURABILITY_CONFIG.traumaScale;
    state.trauma += severity;
    state.pain += severity * hit.region.painResponse;
    state.structural += severity * hit.region.structuralImportance;
    state.motorWeakness = Math.min(0.94, state.motorWeakness + severity * 0.34);
    state.maximumDepth = Math.max(state.maximumDepth, depth);
    this.regionState.set(hit.regionId, state);
    this.balanceImpairment += severity * hit.region.balanceImpact;
    this.consciousnessImpairment = Math.max(this.consciousnessImpairment, severity * hit.region.consciousnessImpact);
    const impulse = direction.clone().multiplyScalar(Math.min(1.4, 0.09 + force * 0.04 + severity * 0.35));
    hit.body.applyImpulseAtPoint(impulse, entryPoint, true);
    this.lastReaction = { regionId: hit.regionId, severity, point: entryPoint.clone(), direction: direction.clone(), hardContact };
    if (woundId) this.woundSystem.extendPuncture(woundId, { depth, lateralMotion, hardStructureContact: hardContact });
    this.physiology.onTrauma({ hit, severity, depth, deltaDepth, hardContact });
    this.visualAdapter?.setEmbeddedTension?.({ regionId: hit.regionId, depth, worldDirection: direction });
    this.evaluateLifeState();
    return severity;
  }

  applySlashWound({ hit, startPoint, endPoint, surfaceNormal, cutDirection, depth, cutLength, severity, classification, edgeAlignment = 1, woundId = null, deferReaction = false } = {}) {
    let wound = woundId ? this.woundSystem.getWound(woundId) : null;
    const isNewWound = !wound;
    if (wound) {
      const rotation = hit.body.rotation();
      const inverse = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).invert();
      const localEnd = hit.localPoint.clone().add(endPoint.clone().sub(startPoint).applyQuaternion(inverse));
      wound = this.woundSystem.extendSlash(wound.id, { localEnd, worldEnd: endPoint, surfaceNormal, addedTravel: cutLength, depth, severity, edgeAlignment });
    } else {
      wound = this.woundSystem.createSlash({ hit, startPoint, endPoint, surfaceNormal, cutDirection, depth, cutLength, severity, classification, edgeAlignment, createdTime: this.elapsed });
      const state = this.regionState.get(hit.regionId);
      if (state) state.wounds = (state.wounds ?? 0) + 1;
      this.physiology.onWoundCreated(wound);
    }
    const traumaSeverity = severity * (0.18 + depth * 2.8) * HUMANOID_DURABILITY_CONFIG.traumaScale;
    const state = this.regionState.get(hit.regionId) ?? { trauma: 0, pain: 0, structural: 0, motorWeakness: 0, maximumDepth: 0, wounds: 1 };
    state.trauma += traumaSeverity;
    state.pain += traumaSeverity * hit.region.painResponse;
    state.structural += traumaSeverity * hit.region.structuralImportance;
    state.motorWeakness = Math.min(0.94, state.motorWeakness + traumaSeverity * 0.22);
    state.maximumDepth = Math.max(state.maximumDepth, depth);
    this.regionState.set(hit.regionId, state);
    this.balanceImpairment += traumaSeverity * hit.region.balanceImpact;
    hit.body.applyImpulseAtPoint(cutDirection.clone().multiplyScalar(Math.min(0.22, severity * 0.08)), endPoint, true);
    this.physiology.onTrauma({ hit, severity: traumaSeverity, depth, deltaDepth: depth * 0.2, hardContact: false });
    if (isNewWound && !deferReaction) this.triggerReflex(hit.regionId, Math.max(0.16, traumaSeverity), cutDirection, { point: endPoint, depth, slashSeverity: severity, force: severity, source: 'new_slash' });
    this.evaluateLifeState();
    return wound;
  }

  applyBluntContact({ hit, point, direction, severity = 0.1 } = {}) {
    const wound = this.woundSystem.createBluntMarker({ hit, severity, createdTime: this.elapsed });
    hit.body.applyImpulseAtPoint(direction.clone().multiplyScalar(Math.min(0.16, severity * 0.12)), point, true);
    this.triggerReflex(hit.regionId, severity * 0.35, direction, { point, force: severity, source: 'new_blunt_contact' });
    return wound;
  }

  onWeaponExtracted(woundId, { releaseSeverity = 0, direction = null } = {}) {
    const wound = this.woundSystem.markExtracted(woundId, { releaseSeverity, direction });
    if (wound) {
      this.physiology.onWoundCreated(wound);
      this.visualAdapter?.releaseEmbeddedTension?.();
    }
    return wound;
  }

  evaluateLifeState() {
    if (!this.automaticMortality) return;
    const totalTrauma = [...this.regionState.values()].reduce((sum, state) => sum + state.trauma, 0);
    const criticalTrauma = Math.max(...['head', 'face', 'skull', 'neck', 'upper_chest', 'lower_chest'].map((id) => this.regionState.get(id)?.trauma ?? 0));
    if (this.lifeState === 'alive' && (this.balanceImpairment > HUMANOID_DURABILITY_CONFIG.balanceCollapseThreshold || totalTrauma > HUMANOID_DURABILITY_CONFIG.accumulatedCollapseThreshold)) this.requestCollapse(this.resolveTraumaCollapseFamily(), { immediate: false, lethal: false });
    if (this.lifeState !== 'dead' && (criticalTrauma > HUMANOID_DURABILITY_CONFIG.criticalDyingThreshold || totalTrauma > HUMANOID_DURABILITY_CONFIG.accumulatedDyingThreshold)) this.transitionLifeState(this.isImmortalReactive() ? 'incapacitated' : 'dying', 'overwhelming-regional-trauma');
  }

  resolveTraumaCollapseFamily() {
    const worst = [...this.regionState.entries()].sort((a, b) => b[1].trauma - a[1].trauma)[0]?.[0] ?? '';
    if (['upper_chest', 'lower_chest', 'abdomen'].includes(worst)) return 'chest_fold';
    if (worst === 'neck') return 'neck_failure';
    if (['head', 'face', 'skull'].includes(worst)) return 'neurological';
    if (worst.includes('thigh') || worst.includes('leg') || worst.includes('foot')) return 'leg_failure';
    return 'general_trauma';
  }

  requestCollapse(family = 'general_trauma', { immediate = false, lethal = false, regionId = null } = {}) {
    if (!this.automaticMortality) return false;
    if (!COLLAPSE_CONFIG.families.includes(family) || this.lifeState === 'dead') return;
    this.collapseFamily ??= family;
    this.collapseReason ??= regionId ? `${family}:${regionId}` : family;
    if (lethal && !this.isImmortalReactive()) this.transitionLifeState('dying', this.collapseReason);
    else this.transitionLifeState('incapacitated', this.collapseReason);
    if (this.isImmortalReactive()) this.reactiveCollapseElapsed = 0;
    if (immediate) this.motorStrength = Math.min(this.motorStrength, family === 'neurological' ? 0.02 : 0.16);
  }

  transitionLifeState(nextState, reason = 'trauma') {
    if (!this.automaticMortality) return false;
    if (this.isImmortalReactive() && (nextState === 'dying' || nextState === 'dead')) nextState = 'incapacitated';
    const order = { alive: 0, incapacitated: 1, dying: 2, dead: 3 };
    if (!(nextState in order) || order[nextState] <= order[this.lifeState]) return false;
    this.lifeState = nextState;
    this.collapseReason ??= reason;
    if (['incapacitated', 'dying', 'dead'].includes(nextState) && (!this.isImmortalReactive() || this.ragdollForced)) this.activateRagdoll();
    if (nextState === 'incapacitated') this.eventSink?.('unconscious', { position: this.getBodyWorldPosition('head'), severity: 0.6 });
    if (nextState === 'dying') this.eventSink?.('shock_gasp', { position: this.getBodyWorldPosition('head'), severity: 0.9 });
    if (nextState === 'dead') {
      this.eventSink?.('final_exhale', { position: this.getBodyWorldPosition('head'), severity: 1, final: true });
      this.activeEmbeddedWeapon?.state && (this.activeEmbeddedWeapon.reason = 'embedded-in-corpse');
    }
    return true;
  }

  activateRagdoll({ forced = false } = {}) {
    if (this.ragdollActive || !this.animationAuthorityReady || !this.visualAdapter?.beginRagdoll?.()) return false;
    this.ragdollForced ||= forced;
    this.ragdollActive = true;
    this.bodies.forEach(({ body }) => {
      body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      body.setGravityScale(1, true);
      body.wakeUp();
    });
    if (this.lastReaction?.direction) {
      const entry = this.bodies.get(HUMANOID_ANATOMY_REGIONS.find((region) => region.id === this.lastReaction.regionId)?.bodyId ?? this.lastReaction.regionId);
      entry?.body.applyImpulseAtPoint(this.lastReaction.direction.clone().multiplyScalar(Math.min(1.1, 0.24 + this.lastReaction.severity * 0.5)), this.lastReaction.point, true);
    }
    return true;
  }

  forceRagdoll() {
    this.ragdollForced = true;
    this.collapseFamily ??= 'general_trauma';
    this.collapseReason ??= 'combat-lab-forced-ragdoll';
    if (this.lifeState === 'alive') this.lifeState = 'incapacitated';
    return this.activateRagdoll({ forced: true });
  }

  getBodyWorldPosition(bodyId, target = new THREE.Vector3()) {
    const translation = this.bodies.get(bodyId)?.body?.translation?.();
    return translation ? target.set(translation.x, translation.y, translation.z) : target.set(0, 0, 0);
  }

  updatePlayerCollisionBlocker(blocker = {}) {
    const pelvis = this.getBodyWorldPosition('pelvis');
    const upper = this.getBodyWorldPosition(this.ragdollActive ? 'head' : 'upper_chest');
    blocker.id ??= 'combat-humanoid-player-blocker';
    blocker.type = 'combatActor';
    blocker.blockerShape = 'capsule';
    blocker.from ??= { x: pelvis.x, z: pelvis.z };
    blocker.to ??= { x: upper.x, z: upper.z };
    blocker.from.x = pelvis.x;
    blocker.from.z = pelvis.z;
    blocker.to.x = upper.x;
    blocker.to.z = upper.z;
    blocker.radius = this.ragdollActive ? 0.2 : blocker.meleeSpacingRadius ?? 0.29;
    blocker.height = this.ragdollActive ? 0.5 : 1.82;
    blocker.userData = { actor: this, dynamic: true, ragdoll: this.ragdollActive, meleeSpacing: blocker.userData?.meleeSpacing ?? null };
    return blocker;
  }

  triggerReflex(regionId, intensity, direction, details = {}) {
    this.reflex.regionId = regionId;
    this.reflex.intensity = THREE.MathUtils.clamp(Math.max(this.reflex.intensity, intensity * 1.8), 0, 1);
    this.reflex.time = 0.38 + this.reflex.intensity * 0.42;
    this.reflex.direction.copy(direction ?? new THREE.Vector3());
    this.visualAdapter?.triggerPainReaction?.({ regionId, severity: intensity, worldDirection: direction, depth: details.depth ?? 0, slashSeverity: details.slashSeverity ?? 0, impactForce: details.force ?? 0, hitWorldPosition: details.point ?? null, actorState: this.lifeState, source: details.source ?? 'combat_contact', reactionKind: details.reactionKind ?? null, variation: details.variation ?? 0, impactMemory: details.impactMemory ?? 0, recoveryState: details.recoveryState ?? 'idle' });
    if (intensity > 0.08 && this.lifeState !== 'dead') this.eventSink?.('pain_vocal', { position: this.getBodyWorldPosition('head'), severity: intensity });
  }

  setEmbeddedWeapon(weapon) {
    this.activeEmbeddedWeapon = weapon;
  }

  beforePhysics(dt, playerPosition = null) {
    this.elapsed += dt;
    this.physiology.update(dt);
    this.consciousnessImpairment = 1 - this.physiology.consciousness;
    this.reflex.time = Math.max(0, this.reflex.time - dt);
    if (this.reflex.time <= 0) this.reflex.intensity = Math.max(0, this.reflex.intensity - dt * 3);
    if (this.lifeState === 'dying') {
      this.dyingElapsed += dt;
      const deathDelay = this.collapseFamily === 'neurological' ? 0.22 : this.collapseFamily === 'neck_failure' ? 0.85 : 1.6;
      if (this.dyingElapsed >= deathDelay) this.transitionLifeState('dead', this.collapseReason ?? 'mortal-trauma');
    }
    if (this.isImmortalReactive()) this.updateImmortalReactiveRecovery(dt);
    const releaseRate = COLLAPSE_CONFIG.motorReleaseRates[this.collapseFamily] ?? COLLAPSE_CONFIG.motorReleaseRates.general_trauma;
    if (this.lifeState === 'incapacitated' && this.isImmortalReactive()) {
      const recoveryStarted = this.reactiveCollapseElapsed >= IMMORTAL_REACTIVE_CONFIG.recoveryDelaySeconds;
      this.motorStrength = recoveryStarted ? Math.min(1, this.motorStrength + dt / IMMORTAL_REACTIVE_CONFIG.postureRecoverySeconds) : Math.max(0.08, this.motorStrength - dt * releaseRate);
      if (recoveryStarted && this.motorStrength >= 0.72 && this.physiology.consciousness >= 0.42) this.recoverReactivePosture();
    }
    else if (this.lifeState === 'incapacitated') this.motorStrength = Math.max(this.collapseFamily === 'leg_failure' ? 0.09 : 0.04, this.motorStrength - dt * releaseRate);
    else if (this.lifeState === 'dying') this.motorStrength = Math.max(0.015, this.motorStrength - dt * releaseRate * 1.35);
    else if (this.lifeState === 'dead') this.motorStrength = Math.max(0, this.motorStrength - dt * Math.max(1.8, releaseRate * 2));
    else this.motorStrength = Math.min(1, this.motorStrength + dt * 0.25);
    if (!this.animationAuthorityReady) this.bodies.forEach((entry, bodyId) => this.applyBodyMotor(entry, bodyId, dt, playerPosition));
  }

  updateImmortalReactiveRecovery(dt) {
    this.reactiveCollapseElapsed += this.lifeState === 'incapacitated' ? dt : 0;
    this.balanceImpairment = Math.max(0, Math.min(1.5, this.balanceImpairment) - IMMORTAL_REACTIVE_CONFIG.balanceRecoveryPerSecond * dt);
    this.regionState.forEach((state) => {
      state.trauma = Math.max(0, Math.min(1.5, state.trauma) - IMMORTAL_REACTIVE_CONFIG.traumaDecayPerSecond * dt);
      state.pain = Math.max(0, state.pain - IMMORTAL_REACTIVE_CONFIG.traumaDecayPerSecond * dt * 1.5);
      state.structural = Math.max(0, Math.min(1.5, state.structural) - IMMORTAL_REACTIVE_CONFIG.traumaDecayPerSecond * dt * 0.7);
      state.motorWeakness = Math.max(0, state.motorWeakness - IMMORTAL_REACTIVE_CONFIG.motorWeaknessDecayPerSecond * dt);
    });
  }

  recoverReactivePosture(immediate = false) {
    if (this.ragdollActive) return;
    this.lifeState = 'alive';
    this.collapseFamily = null;
    this.collapseReason = null;
    this.dyingElapsed = 0;
    this.reactiveCollapseElapsed = 0;
    this.corpseSleeping = false;
    this.finalSettleEmitted = false;
    if (immediate) this.motorStrength = Math.max(this.motorStrength, 0.72);
  }

  applyBodyMotor(entry, bodyId, dt, playerPosition) {
    const { body, config, restPosition, restQuaternion } = entry;
    if (!body.isDynamic() || this.motorStrength <= 0.001) return;
    const regionWeakness = this.regionState.get(config.regionId)?.motorWeakness ?? 0;
    let strength = config.motor * this.motorStrength * (1 - regionWeakness);
    if (bodyId.includes('foot') && this.lifeState === 'alive') strength *= 1.55 * Math.max(0.2, 1 - this.balanceImpairment * 0.65);
    if (this.collapseFamily === 'leg_failure' && this.reflex.regionId?.includes(bodyId.includes('left') ? 'left' : 'right') && (bodyId.includes('thigh') || bodyId.includes('leg') || bodyId.includes('foot'))) strength *= 0.16;
    if (strength <= 0.005) return;
    const translation = body.translation();
    const velocity = body.linvel();
    tmpTarget.copy(restPosition);
    if (['upper_chest', 'lower_chest', 'abdomen'].includes(bodyId)) tmpTarget.y += Math.sin(this.elapsed * 1.65) * 0.006 * (1 - (this.physiology?.breathInterruption ?? 0) * 0.88);
    if (this.lifeState === 'alive') tmpTarget.x += Math.sin(this.elapsed * 0.72) * 0.006 * (bodyId.includes('left') ? -1 : 1);
    this.applyReflexTarget(bodyId, tmpTarget);
    if (this.physiology.shock > 0.35 && this.lifeState !== 'dead') tmpTarget.x += Math.sin(this.elapsed * 22 + config.mass) * 0.006 * this.physiology.shock;
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

  applyReflexTarget(bodyId, target) {
    const intensity = this.reflex.intensity * THREE.MathUtils.clamp(this.reflex.time / 0.35, 0, 1);
    if (intensity <= 0) return;
    const region = this.reflex.regionId ?? '';
    if (['upper_chest', 'lower_chest', 'abdomen'].includes(region) && ['upper_chest', 'lower_chest', 'abdomen', 'head'].includes(bodyId)) {
      target.y -= 0.055 * intensity;
      target.z += 0.045 * intensity;
    }
    if (region === 'neck' && ['neck', 'head', 'upper_chest'].includes(bodyId)) {
      target.y -= bodyId === 'head' ? 0.07 * intensity : 0.025 * intensity;
      target.x += this.reflex.direction.x * 0.035 * intensity;
    }
    if (['head', 'face', 'skull'].includes(region) && bodyId === 'head') target.addScaledVector(this.reflex.direction, 0.065 * intensity);
    const side = region.startsWith('left_') ? 'left' : region.startsWith('right_') ? 'right' : null;
    if (side && region.includes('arm') && bodyId.startsWith(side) && (bodyId.includes('arm') || bodyId.includes('forearm'))) target.x += (side === 'left' ? 0.06 : -0.06) * intensity;
    if (side && (region.includes('thigh') || region.includes('leg') || region.includes('foot')) && bodyId === 'pelvis') target.x += (side === 'left' ? 0.075 : -0.075) * intensity;
  }

  afterPhysics(alpha = 1) {
    if (!this.animationAuthorityReady || this.ragdollActive) this.bodies.forEach((entry) => {
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
    this.updateVesselDebug();
    if (this.ragdollActive) this.visualAdapter?.updateRagdoll?.();
    else if (!this.visualProfile.animationAuthoritative) this.visualAdapter?.update();
    if (!this.visualProfile.animationAuthoritative || this.ragdollActive) this.woundSystem.update(1 / 60);
    this.updateBodyImpactFeedback();
    const speeds = [...this.bodies.values()].map((entry) => { const v = entry.body.linvel(); return Math.hypot(v.x, v.y, v.z); });
    const speed = speeds.length ? speeds.reduce((sum, value) => sum + value, 0) / speeds.length : 0;
    if (this.lifeState === 'dead' && speed < COLLAPSE_CONFIG.corpseSettleSpeed) this.settledSeconds += 1 / 60;
    else this.settledSeconds = 0;
    if (this.lifeState === 'dead' && this.settledSeconds >= COLLAPSE_CONFIG.corpseSettleSeconds) {
      if (!this.finalSettleEmitted) {
        this.finalSettleEmitted = true;
        this.eventSink?.('body_settle', { position: this.getBodyWorldPosition('pelvis'), severity: 0.5 });
      }
      if (!this.activeEmbeddedWeapon && speed < COLLAPSE_CONFIG.corpseSleepSpeed) {
        this.bodies.forEach(({ body }) => { if (!body.isSleeping()) body.sleep(); });
        this.corpseSleeping = true;
      }
    }
  }

  updateVesselDebug() {
    this.vesselDebug.forEach((entry) => {
      const body = this.bodies.get(entry.bodyId)?.body;
      if (!body) return;
      const translation = body.translation();
      const rotation = body.rotation();
      const q = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
      entry.marker.position.copy(entry.localPoint).applyQuaternion(q).add(new THREE.Vector3(translation.x, translation.y, translation.z));
      entry.marker.quaternion.copy(q);
      const active = this.woundSystem?.wounds?.some((wound) => wound.vesselInvolvement?.id === entry.zone.id);
      entry.marker.material.color.set(active ? 0xffe45c : entry.zone.vesselType.includes('arterial') ? 0xff3040 : 0x4e70ff);
    });
  }

  updateBodyImpactFeedback() {
    this.impactCooldowns.forEach((value, key) => { const next = value - 1 / 60; if (next <= 0) this.impactCooldowns.delete(key); else this.impactCooldowns.set(key, next); });
    const groundY = this.environmentContactHints.groundY ?? 0;
    const wallX = this.environmentContactHints.wallX;
    this.bodies.forEach((entry, bodyId) => {
      const position = entry.body.translation();
      const velocity = entry.body.linvel();
      const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
      if (position.y <= groundY + (bodyId === 'head' ? 0.24 : 0.18) && speed > 0.75 && !this.impactCooldowns.has(`ground:${bodyId}`)) {
        const event = ['pelvis', 'upper_chest', 'lower_chest', 'head'].includes(bodyId) ? 'body_ground' : 'limb_impact';
        this.eventSink?.(event, { position: new THREE.Vector3(position.x, position.y, position.z), severity: Math.min(1.4, speed / 3) });
        this.impactCooldowns.set(`ground:${bodyId}`, 0.38);
      }
      if (wallX != null && position.x <= wallX + 0.22 && velocity.x < -0.6 && !this.impactCooldowns.has(`wall:${bodyId}`)) {
        this.eventSink?.('body_wall', { position: new THREE.Vector3(position.x, position.y, position.z), severity: Math.min(1.4, speed / 3) });
        this.impactCooldowns.set(`wall:${bodyId}`, 0.4);
      }
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
      mortalityMode: this.mortalityMode,
      motorStrength: this.motorStrength,
      balanceImpairment: this.balanceImpairment,
      consciousnessImpairment: this.consciousnessImpairment,
      activeWounds: this.woundSystem.getActiveWounds().length,
      embeddedWeapon: this.activeEmbeddedWeapon?.state ?? null,
      settledSeconds: this.settledSeconds,
      collapseFamily: this.collapseFamily,
      collapseReason: this.collapseReason,
      corpseSleeping: this.corpseSleeping,
      ragdollActive: this.ragdollActive,
      ragdollForced: this.ragdollForced,
      physiology: this.physiology.getDiagnostics(),
      wounds: this.woundSystem.getDiagnostics(),
      reflex: { regionId: this.reflex.regionId, intensity: this.reflex.intensity, time: this.reflex.time },
      regionalTrauma: Object.fromEntries([...this.regionState.entries()].filter(([, value]) => value.trauma > 0.001).map(([id, value]) => [id, Number(value.trauma.toFixed(3))])),
      lastReaction: this.lastReaction ? { regionId: this.lastReaction.regionId, severity: this.lastReaction.severity, hardContact: this.lastReaction.hardContact } : null,
      bodyPositions,
      visualProfile: this.visualProfile.name,
      visualAdapter: this.visualAdapter?.getDiagnostics?.() ?? null,
      instanceId: this.instanceId,
      automaticMortality: this.automaticMortality,
    };
  }

  setDebugVisible(visible) {
    this.debugRoot.visible = visible;
  }

  setWoundSurfaceDebugVisible(visible) {
    this.woundSystem.setDebugVisible(visible);
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
    this.vesselDebug.forEach((entry) => entry.marker.material?.dispose?.());
    this.vesselDebug = [];
  }

  reset() {
    if (this.disposed) return;
    this.woundSystem.clear();
    this.disposePhysicalBody();
    this.regionState.clear();
    this.balanceImpairment = 0;
    this.consciousnessImpairment = 0;
    this.motorStrength = 1;
    this.lifeState = 'alive';
    this.ragdollActive = false;
    this.ragdollForced = false;
    this.lastReaction = null;
    this.settledSeconds = 0;
    this.dyingElapsed = 0;
    this.reactiveCollapseElapsed = 0;
    this.collapseFamily = null;
    this.collapseReason = null;
    this.reflex = { regionId: null, intensity: 0, time: 0, direction: new THREE.Vector3() };
    this.corpseSleeping = false;
    this.finalSettleEmitted = false;
    this.impactCooldowns.clear();
    this.physiology.reset();
    this.physics.resetCount += 1;
    this.createPhysicalBody();
    this.visualAdapter?.reset();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.woundSystem.dispose();
    this.visualAdapter?.dispose();
    this.disposePhysicalBody();
    Object.values(this.materials).forEach((entry) => entry.dispose?.());
    this.root.removeFromParent();
  }
}
