import * as THREE from 'three';
import { CombatPhysicsWorld, initializeCombatPhysics } from './CombatPhysicsWorld.js';
import { HumanoidCombatActor } from './HumanoidCombatActor.js';
import { CombatBloodEffects } from './CombatBloodEffects.js';
import { CombatFeedbackSystem } from './CombatFeedbackSystem.js';
import { resolveCombatMortalityMode } from './CombatMortality.js';

export class FolsomCombatEncounter {
  static async create(options = {}) {
    await initializeCombatPhysics();
    return new FolsomCombatEncounter(options);
  }

  constructor({ dungeon, audioRuntime = null } = {}) {
    this.dungeon = dungeon;
    this.scene = dungeon.scene;
    this.physics = new CombatPhysicsWorld();
    this.feedbackSystem = new CombatFeedbackSystem({ audioRuntime });
    this.weaponController = null;
    this.disposed = false;
    this.spawnPosition = new THREE.Vector3(-2, 0, 0);
    const sampledGround = dungeon.collision?.sampleWalkableY?.(this.spawnPosition.x, this.spawnPosition.z, 0.16);
    this.groundY = Number.isFinite(sampledGround?.y) ? sampledGround.y : 0.16;
    const spawnOffset = new THREE.Vector3(this.spawnPosition.x, this.groundY, this.spawnPosition.z + 3.55);
    this.physics.createFixedBox({ position: { x: this.spawnPosition.x, y: this.groundY - 0.1, z: this.spawnPosition.z }, halfExtents: { x: 7, y: 0.1, z: 7 }, userData: { type: 'folsom-combat-courtyard-ground' } });
    this.actor = new HumanoidCombatActor({ physics: this.physics, scene: this.scene, spawnOffset, spawnYaw: Math.PI, mortalityMode: resolveCombatMortalityMode(), eventSink: (event, payload) => this.handleCombatEvent(event, payload) });
    this.actor.root.name = 'folsom-starter-humanoid-combat-subject';
    this.actor.setEnvironmentContactHints({ groundY: this.groundY, wallX: null });
    this.bloodEffects = new CombatBloodEffects({ scene: this.scene, woundSystem: this.actor.woundSystem, physiology: this.actor.physiology, groundY: this.groundY, eventSink: (event, payload) => this.handleCombatEvent(event, payload) });
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
    return { physics: this.physics.getDiagnostics(), actor: this.actor.getDiagnostics(), weapon: this.weaponController?.getDiagnostics?.() ?? null, blood: this.bloodEffects.getDiagnostics(), feedback: this.feedbackSystem.getDiagnostics(), spawnPosition: this.spawnPosition.toArray(), groundY: this.groundY };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.weaponController?.cancel?.('encounter-dispose');
    this.bloodEffects.dispose();
    this.feedbackSystem.dispose();
    this.actor.dispose();
    this.physics.dispose();
  }
}
