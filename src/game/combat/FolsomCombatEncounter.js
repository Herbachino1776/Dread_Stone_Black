import * as THREE from 'three';
import { CombatPhysicsWorld, initializeCombatPhysics } from './CombatPhysicsWorld.js';
import { HumanoidCombatActor } from './HumanoidCombatActor.js';
import { CombatBloodEffects } from './CombatBloodEffects.js';
import { CombatFeedbackSystem } from './CombatFeedbackSystem.js';
import { resolveCombatMortalityMode } from './CombatMortality.js';
import { FOLSOM_AUTHORED_PLAYER_SPAWN, FOLSOM_MODEL_IDLE_DIAGNOSTIC_XZ, FolsomModelIdleRawReference } from './FolsomModelIdleRawReference.js';
import { CURRENT_HUMANOID_PROFILE, MODEL_IDLE_COMBAT_PROFILE } from './HumanoidModelProfiles.js';

export function resolveFolsomModelDiagnosticMode(search = '') {
  const query = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  return query.get('modelIdleCombatTest') === '1' ? 'adapted-model-idle' : 'raw-reference';
}

export class FolsomCombatEncounter {
  static async create(options = {}) {
    await initializeCombatPhysics();
    const encounter = new FolsomCombatEncounter(options);
    await encounter.initializeRawDiagnostic();
    return encounter;
  }

  constructor({ dungeon, audioRuntime = null, modelIdleCombatTest = false } = {}) {
    this.dungeon = dungeon;
    this.scene = dungeon.scene;
    this.physics = new CombatPhysicsWorld();
    this.feedbackSystem = new CombatFeedbackSystem({ audioRuntime });
    this.weaponController = null;
    this.disposed = false;
    this.modelIdleCombatTest = Boolean(modelIdleCombatTest);
    this.modelProfile = this.modelIdleCombatTest ? MODEL_IDLE_COMBAT_PROFILE : CURRENT_HUMANOID_PROFILE;
    this.rawModelReference = null;
    this.playerSpawn = new THREE.Vector3(...FOLSOM_AUTHORED_PLAYER_SPAWN);
    this.diagnosticSpawn = this.resolveDiagnosticSpawn();
    this.spawnPosition = this.modelIdleCombatTest
      ? this.diagnosticSpawn.clone()
      : new THREE.Vector3(-2, 0, 0);
    const sampledGround = dungeon.collision?.sampleWalkableY?.(this.spawnPosition.x, this.spawnPosition.z, 0.16);
    this.groundY = Number.isFinite(sampledGround?.y) ? sampledGround.y : 0.16;
    const spawnOffset = new THREE.Vector3(this.spawnPosition.x, this.groundY, this.spawnPosition.z + 3.55);
    const spawnYaw = this.modelIdleCombatTest
      ? Math.atan2(this.playerSpawn.x - this.spawnPosition.x, this.playerSpawn.z - this.spawnPosition.z)
      : Math.PI;
    this.physics.createFixedBox({ position: { x: this.spawnPosition.x, y: this.groundY - 0.1, z: this.spawnPosition.z }, halfExtents: { x: 7, y: 0.1, z: 7 }, userData: { type: 'folsom-combat-courtyard-ground' } });
    this.actor = new HumanoidCombatActor({ physics: this.physics, scene: this.scene, spawnOffset, spawnYaw, visualProfile: this.modelProfile, mortalityMode: resolveCombatMortalityMode(), eventSink: (event, payload) => this.handleCombatEvent(event, payload) });
    this.actor.root.name = this.modelIdleCombatTest ? 'folsom-model-idle-adapted-combat-subject' : 'folsom-starter-humanoid-combat-subject';
    this.actor.setEnvironmentContactHints({ groundY: this.groundY, wallX: null });
    this.bloodEffects = new CombatBloodEffects({ scene: this.scene, woundSystem: this.actor.woundSystem, physiology: this.actor.physiology, groundY: this.groundY, eventSink: (event, payload) => this.handleCombatEvent(event, payload) });
  }

  resolveDiagnosticSpawn() {
    const candidates = [[10, 0], [-10, 0], [0, 10], [0, -10]];
    for (const [dx, dz] of candidates) {
      const x = this.playerSpawn.x + dx;
      const z = this.playerSpawn.z + dz;
      const sampled = this.dungeon.collision?.sampleWalkableY?.(x, z, 0.16);
      const floorY = Number.isFinite(sampled?.y) ? sampled.y : 0.16;
      const floorPosition = new THREE.Vector3(x, floorY, z);
      const walkable = this.dungeon.collision?.canStandAtFloorPosition?.(floorPosition) ?? true;
      const blocked = (this.dungeon.collision?.getIntersectingBlockers?.(new THREE.Vector3(x, floorY + 1.55, z), 0.5) ?? []).length > 0;
      if (walkable && !blocked) return floorPosition;
    }
    return new THREE.Vector3(FOLSOM_MODEL_IDLE_DIAGNOSTIC_XZ[0], 0.16, FOLSOM_MODEL_IDLE_DIAGNOSTIC_XZ[1]);
  }

  async initializeRawDiagnostic() {
    if (this.modelIdleCombatTest || typeof window === 'undefined') return;
    this.rawModelReference = await FolsomModelIdleRawReference.create({ scene: this.scene, groundY: this.diagnosticSpawn.y, spawnXZ: [this.diagnosticSpawn.x, this.diagnosticSpawn.z] });
  }

  handleCombatEvent(event, payload = {}) {
    if (event === 'final_exhale') this.feedbackSystem.stopOwnerVocal('folsom-combat-actor');
    this.feedbackSystem.emit(event, { ...payload, owner: 'folsom-combat-actor' });
  }

  isPlayerInCombatRange(player) {
    const pelvis = this.actor.getBodyWorldPosition('pelvis');
    return Boolean(player?.position && player.position.distanceTo(pelvis) <= 6.5);
  }

  attachWeaponController(controller) {
    this.weaponController?.cancel?.('controller-replaced');
    this.weaponController = controller;
  }

  update(deltaSeconds, player) {
    if (this.disposed) return;
    this.rawModelReference?.update(deltaSeconds);
    this.physics.step(deltaSeconds, (dt) => {
      this.feedbackSystem.update(dt);
      this.weaponController?.beforePhysics?.(dt);
      this.actor.beforePhysics(dt, player?.position);
    }, (dt) => {
      this.weaponController?.afterPhysicsStep?.(dt);
      this.bloodEffects.update(dt);
    });
    this.actor.afterPhysics(this.physics.interpolationAlpha);
    this.weaponController?.afterPhysics?.(this.physics.interpolationAlpha);
  }

  reset() {
    this.weaponController?.cancel?.('encounter-reset');
    this.actor.reset();
    this.bloodEffects.clear();
    this.feedbackSystem.reset();
    this.weaponController?.reset?.();
  }

  getDiagnostics() {
    return { diagnosticMode: this.modelIdleCombatTest ? 'adapted-model-idle' : 'raw-reference', modelProfileName: this.modelProfile.name, physics: this.physics.getDiagnostics(), actor: this.actor.getDiagnostics(), weapon: this.weaponController?.getDiagnostics?.() ?? null, blood: this.bloodEffects.getDiagnostics(), feedback: this.feedbackSystem.getDiagnostics(), spawnPosition: this.spawnPosition.toArray(), groundY: this.groundY, rawModelReference: this.rawModelReference?.getDiagnostics?.() ?? null };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.weaponController?.cancel?.('encounter-dispose');
    this.bloodEffects.dispose();
    this.feedbackSystem.dispose();
    this.actor.dispose();
    this.rawModelReference?.dispose();
    this.rawModelReference = null;
    this.physics.dispose();
  }
}
