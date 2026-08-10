import { FORGE_SOCKET_ROLES, FORGE_WEAPON_CLASSES } from '../../contracts/ForgeRuntimeArmament.js';
import { worldWeaponGlbLoader } from './WorldWeaponGlbLoader.js';

export const NPC_WEAPON_SCHEMA = 'dreadstone.npc_weapon.v1';

const STABLE_ID = /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/;
const GAME_GLB_ASSET_PATH = /^\/assets\/[a-zA-Z0-9_./-]+\.glb$/;
const QUARTER_TURN_X = Object.freeze([Math.SQRT1_2, 0, 0, Math.SQRT1_2]);

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function finiteVector(value, length) {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}

function freezeWeapon(definition) {
  return Object.freeze({
    ...definition,
    compatibleSocketRoles: Object.freeze([...definition.compatibleSocketRoles]),
    gripTransform: Object.freeze({
      position: Object.freeze([...definition.gripTransform.position]),
      quaternion: Object.freeze([...definition.gripTransform.quaternion]),
    }),
    attackCapsule: Object.freeze({
      start: Object.freeze([...definition.attackCapsule.start]),
      end: Object.freeze([...definition.attackCapsule.end]),
      radius: definition.attackCapsule.radius,
    }),
  });
}

export function validateNpcWeaponDefinition(definition) {
  const errors = [];
  const requireCondition = (condition, path, message) => { if (!condition) errors.push(`${path} ${message}`); };
  requireCondition(isRecord(definition), 'weapon', 'must be an object');
  if (!isRecord(definition)) return { valid: false, errors };
  requireCondition(definition.schema === NPC_WEAPON_SCHEMA, 'weapon.schema', `must be ${NPC_WEAPON_SCHEMA}`);
  requireCondition(typeof definition.weaponId === 'string' && STABLE_ID.test(definition.weaponId), 'weapon.weaponId', 'must be a stable lowercase identifier');
  requireCondition(typeof definition.displayName === 'string' && definition.displayName.length > 0, 'weapon.displayName', 'must be a non-empty string');
  requireCondition(typeof definition.assetPath === 'string' && GAME_GLB_ASSET_PATH.test(definition.assetPath) && !definition.assetPath.includes('..'), 'weapon.assetPath', 'must be an absolute game-owned .glb asset path');
  requireCondition(Number.isFinite(definition.assetScale) && definition.assetScale > 0, 'weapon.assetScale', 'must be one finite positive uniform scalar');
  requireCondition(FORGE_WEAPON_CLASSES.includes(definition.weaponClass), 'weapon.weaponClass', 'is unsupported');
  requireCondition(Array.isArray(definition.compatibleSocketRoles) && definition.compatibleSocketRoles.length > 0 && definition.compatibleSocketRoles.every((role) => FORGE_SOCKET_ROLES.includes(role)) && new Set(definition.compatibleSocketRoles).size === definition.compatibleSocketRoles.length, 'weapon.compatibleSocketRoles', 'must contain supported unique roles');
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

export const DREADSTONE_MACE_WEAPON = freezeWeapon({
  schema: NPC_WEAPON_SCHEMA,
  weaponId: 'dreadstone_mace',
  displayName: 'Dreadstone Mace',
  assetPath: '/assets/weapons/melee/dreadmacev001_mobile_1k.glb',
  assetScale: 1,
  weaponClass: 'ONE_HAND_BLUNT',
  compatibleSocketRoles: ['MAIN_HAND_R'],
  gripTransform: { position: [0, 0, 0], quaternion: QUARTER_TURN_X },
  attackCapsule: { start: [0, 0, -0.48], end: [0, 0, -0.29], radius: 0.13 },
  damage: 34,
  damageType: 'heavy-blunt',
  impactStrength: 0.82,
  reachCategory: 'medium',
});

export const DREADSTONE_SWORD_WEAPON = freezeWeapon({
  schema: NPC_WEAPON_SCHEMA,
  weaponId: 'dreadstone_sword',
  displayName: 'Dreadstone Sword',
  assetPath: '/assets/weapons/melee/dreadstone_sword_v002.glb',
  assetScale: 1,
  weaponClass: 'ONE_HAND_BLADE',
  compatibleSocketRoles: ['MAIN_HAND_R'],
  gripTransform: { position: [0, 0, 0], quaternion: QUARTER_TURN_X },
  attackCapsule: { start: [0, 0, -0.82], end: [0, 0, -0.16], radius: 0.055 },
  damage: 30,
  damageType: 'slash',
  impactStrength: 0.7,
  reachCategory: 'long',
});

export const OLD_WORK_KNIFE_WEAPON = freezeWeapon({
  schema: NPC_WEAPON_SCHEMA,
  weaponId: 'old_work_knife',
  displayName: 'Old Work Knife',
  assetPath: '/assets/weapons/melee/old_work_knife_v004.glb',
  assetScale: 1,
  weaponClass: 'ONE_HAND_BLADE',
  compatibleSocketRoles: ['MAIN_HAND_R'],
  gripTransform: { position: [0, 0, 0], quaternion: QUARTER_TURN_X },
  attackCapsule: { start: [0, 0, -0.29], end: [0, 0, -0.065], radius: 0.025 },
  damage: 20,
  damageType: 'slash',
  impactStrength: 0.42,
  reachCategory: 'short',
});

export const PRODUCTION_WORLD_WEAPONS = Object.freeze([
  DREADSTONE_MACE_WEAPON,
  DREADSTONE_SWORD_WEAPON,
  OLD_WORK_KNIFE_WEAPON,
]);

export class NpcWeaponRegistry {
  constructor({ definitions = PRODUCTION_WORLD_WEAPONS, weaponLoader = worldWeaponGlbLoader } = {}) {
    this.definitions = new Map();
    this.weaponLoader = weaponLoader;
    for (const definition of definitions) this.register(definition);
  }

  register(definition) {
    const validation = validateNpcWeaponDefinition(definition);
    if (!validation.valid) throw new Error(`Invalid ${NPC_WEAPON_SCHEMA}: ${validation.errors.join('; ')}`);
    if (this.definitions.has(definition.weaponId)) throw new Error(`NPC weapon ${definition.weaponId} is duplicated`);
    const stored = Object.isFrozen(definition) ? definition : freezeWeapon(structuredClone(definition));
    this.definitions.set(stored.weaponId, stored);
    return stored;
  }

  get(weaponId) {
    return this.definitions.get(weaponId) ?? null;
  }

  require(weaponId) {
    const definition = this.get(weaponId);
    if (!definition) throw new Error(`Unknown NPC weapon ${weaponId}`);
    return definition;
  }

  async createVisual(definitionOrId) {
    const definition = typeof definitionOrId === 'string' ? this.require(definitionOrId) : definitionOrId;
    try {
      return await this.weaponLoader.instantiate(definition.assetPath);
    } catch (error) {
      throw new Error(`NPC weapon ${definition.weaponId} failed to load ${definition.assetPath}: ${error.message}`, { cause: error });
    }
  }

  disposeVisual(visual) {
    return this.weaponLoader.release?.(visual) === true;
  }

  list() {
    return [...this.definitions.values()];
  }
}

export const npcWeaponRegistry = new NpcWeaponRegistry();
