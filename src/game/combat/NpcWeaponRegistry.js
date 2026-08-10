import * as THREE from 'three';
import { FORGE_SOCKET_ROLES, FORGE_WEAPON_CLASSES } from '../../contracts/ForgeRuntimeArmament.js';

export const NPC_WEAPON_SCHEMA = 'dreadstone.npc_weapon.v1';
export const NPC_WEAPON_VISUAL_FACTORY_SCHEMA = 'dreadstone.npc_weapon_visual_factory.v1';

const STABLE_ID = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function finiteVector(value, length) {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}

export function validateNpcWeaponDefinition(definition) {
  const errors = [];
  const requireCondition = (condition, path, message) => { if (!condition) errors.push(`${path} ${message}`); };
  requireCondition(isRecord(definition), 'weapon', 'must be an object');
  if (!isRecord(definition)) return { valid: false, errors };
  requireCondition(definition.schema === NPC_WEAPON_SCHEMA, 'weapon.schema', `must be ${NPC_WEAPON_SCHEMA}`);
  requireCondition(typeof definition.weaponId === 'string' && STABLE_ID.test(definition.weaponId), 'weapon.weaponId', 'must be a stable lowercase identifier');
  requireCondition(typeof definition.displayName === 'string' && definition.displayName.length > 0, 'weapon.displayName', 'must be a non-empty string');
  requireCondition(FORGE_WEAPON_CLASSES.includes(definition.weaponClass), 'weapon.weaponClass', 'is unsupported');
  requireCondition(Array.isArray(definition.compatibleSocketRoles) && definition.compatibleSocketRoles.length > 0 && definition.compatibleSocketRoles.every((role) => FORGE_SOCKET_ROLES.includes(role)) && new Set(definition.compatibleSocketRoles).size === definition.compatibleSocketRoles.length, 'weapon.compatibleSocketRoles', 'must contain supported unique roles');
  requireCondition(isRecord(definition.visual) && typeof definition.visual.factoryId === 'string' && STABLE_ID.test(definition.visual.factoryId), 'weapon.visual.factoryId', 'must be a stable game-owned factory ID');
  requireCondition(isRecord(definition.gripTransform), 'weapon.gripTransform', 'must be an object');
  if (isRecord(definition.gripTransform)) {
    requireCondition(finiteVector(definition.gripTransform.position, 3), 'weapon.gripTransform.position', 'must be a finite 3-vector');
    requireCondition(finiteVector(definition.gripTransform.quaternion, 4) && Math.abs(Math.hypot(...definition.gripTransform.quaternion) - 1) <= 1e-4, 'weapon.gripTransform.quaternion', 'must be a finite normalized [x,y,z,w] quaternion');
  }
  requireCondition(isRecord(definition.attackCapsule), 'weapon.attackCapsule', 'must be an object');
  if (isRecord(definition.attackCapsule)) {
    requireCondition(finiteVector(definition.attackCapsule.start, 3), 'weapon.attackCapsule.start', 'must be a finite 3-vector');
    requireCondition(finiteVector(definition.attackCapsule.end, 3), 'weapon.attackCapsule.end', 'must be a finite 3-vector');
    requireCondition(Number.isFinite(definition.attackCapsule.radius) && definition.attackCapsule.radius > 0, 'weapon.attackCapsule.radius', 'must be finite and positive');
  }
  requireCondition(Number.isFinite(definition.damage) && definition.damage > 0, 'weapon.damage', 'must be finite and positive');
  requireCondition(typeof definition.damageType === 'string' && definition.damageType.length > 0, 'weapon.damageType', 'must be a non-empty string');
  requireCondition(Number.isFinite(definition.impactStrength) && definition.impactStrength >= 0, 'weapon.impactStrength', 'must be finite and non-negative');
  if (definition.reachCategory != null) requireCondition(typeof definition.reachCategory === 'string' && definition.reachCategory.length > 0, 'weapon.reachCategory', 'must be a non-empty string');
  return { valid: errors.length === 0, errors };
}

export function createLabWorldMaceVisual() {
  const root = new THREE.Group();
  root.name = 'DreadstoneLabNpcMaceWorldVisual';
  root.userData.npcWorldEquipment = true;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 0.82, 8),
    new THREE.MeshStandardMaterial({ color: 0x36281e, roughness: 0.9, metalness: 0.02 }),
  );
  shaft.position.y = 0.41;
  const head = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.15, 0),
    new THREE.MeshStandardMaterial({ color: 0x3f4242, roughness: 0.62, metalness: 0.58 }),
  );
  head.position.y = 0.91;
  const pommel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.16, 8),
    new THREE.MeshStandardMaterial({ color: 0x17110e, roughness: 0.95 }),
  );
  pommel.position.y = 0.08;
  root.add(shaft, head, pommel);
  root.traverse((object) => { if (object.isMesh) object.castShadow = true; });
  return root;
}

export const DREADSTONE_LAB_MACE_WEAPON = Object.freeze({
  schema: NPC_WEAPON_SCHEMA,
  weaponId: 'dreadstone_lab_mace',
  displayName: 'Dreadstone Lab Mace',
  weaponClass: 'ONE_HAND_BLUNT',
  visual: Object.freeze({ factoryId: 'dreadstone_lab_mace_world_v1' }),
  compatibleSocketRoles: Object.freeze(['MAIN_HAND_R']),
  gripTransform: Object.freeze({
    position: Object.freeze([0, 0, 0]),
    quaternion: Object.freeze([0, 0, 0, 1]),
  }),
  attackCapsule: Object.freeze({
    start: Object.freeze([0, 0.67, 0]),
    end: Object.freeze([0, 0.98, 0]),
    radius: 0.16,
  }),
  damage: 34,
  damageType: 'heavy-blunt',
  impactStrength: 0.82,
  reachCategory: 'medium',
});

export class NpcWeaponRegistry {
  constructor({
    definitions = [DREADSTONE_LAB_MACE_WEAPON],
    visualFactories = { dreadstone_lab_mace_world_v1: createLabWorldMaceVisual },
  } = {}) {
    this.definitions = new Map();
    this.visualFactories = new Map(Object.entries(visualFactories));
    for (const definition of definitions) this.register(definition);
  }

  register(definition) {
    const validation = validateNpcWeaponDefinition(definition);
    if (!validation.valid) throw new Error(`Invalid ${NPC_WEAPON_SCHEMA}: ${validation.errors.join('; ')}`);
    if (this.definitions.has(definition.weaponId)) throw new Error(`NPC weapon ${definition.weaponId} is duplicated`);
    if (!this.visualFactories.has(definition.visual.factoryId)) throw new Error(`NPC weapon ${definition.weaponId} references unknown visual factory ${definition.visual.factoryId}`);
    this.definitions.set(definition.weaponId, definition);
    return definition;
  }

  get(weaponId) {
    return this.definitions.get(weaponId) ?? null;
  }

  require(weaponId) {
    const definition = this.get(weaponId);
    if (!definition) throw new Error(`Unknown NPC weapon ${weaponId}`);
    return definition;
  }

  createVisual(definitionOrId) {
    const definition = typeof definitionOrId === 'string' ? this.require(definitionOrId) : definitionOrId;
    const factory = this.visualFactories.get(definition.visual.factoryId);
    if (!factory) throw new Error(`NPC weapon visual factory ${definition.visual.factoryId} is unavailable`);
    const visual = factory(definition);
    if (!visual?.isObject3D) throw new Error(`NPC weapon visual factory ${definition.visual.factoryId} returned no Object3D`);
    return visual;
  }

  list() {
    return [...this.definitions.values()];
  }
}

export const npcWeaponRegistry = new NpcWeaponRegistry();
