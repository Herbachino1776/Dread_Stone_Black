import * as THREE from 'three';
import { CombatPhysicsWorld, initializeCombatPhysics } from './CombatPhysicsWorld.js';
import { HumanoidCombatActor } from './HumanoidCombatActor.js';
import { CombatBloodEffects } from './CombatBloodEffects.js';
import { CombatFeedbackSystem } from './CombatFeedbackSystem.js';
import { resolveCombatMortalityMode } from './CombatMortality.js';
import { MODEL_IDLE_COMBAT_PROFILE } from './HumanoidModelProfiles.js';
import { CombatDirector } from './CombatDirector.js';
import { KNIFE_COMBAT_CONFIG } from './CombatConfig.js';
import { applyMeleeSpacingEnvelope } from './CombatPresentation.js';
import { preloadKnifeWoundDecalLibrary } from './KnifeWoundDecalLibrary.js';

const FOLSOM_AUTHORED_PLAYER_SPAWN = Object.freeze([-2, 1.71, -4]);
const FOLSOM_MODEL_IDLE_SPAWN_XZ = Object.freeze([8, -4]);

export class FolsomCombatEncounter {
  static async create(options = {}) {
    await Promise.all([initializeCombatPhysics(), preloadKnifeWoundDecalLibrary()]);
    return new FolsomCombatEncounter(options);
  }

  constructor({ dungeon, audioRuntime = null } = {}) {
    this.dungeon = dungeon;
    this.scene = dungeon.scene;
    this.physics = new CombatPhysicsWorld();
    this.feedbackSystem = new CombatFeedbackSystem({ audioRuntime });
    this.weaponController = null;
    this.disposed = false;
    this.modelProfile = MODEL_IDLE_COMBAT_PROFILE;
    this.playerSpawn = new THREE.Vector3(...FOLSOM_AUTHORED_PLAYER_SPAWN);
    this.spawnPosition = this.resolveCombatSpawn();
    const sampledGround = dungeon.collision?.sampleWalkableY?.(this.spawnPosition.x, this.spawnPosition.z, 0.16);
    this.groundY = Number.isFinite(sampledGround?.y) ? sampledGround.y : 0.16;
    const spawnOffset = new THREE.Vector3(this.spawnPosition.x, this.groundY, this.spawnPosition.z + 3.55);
    const spawnYaw = Math.atan2(this.playerSpawn.x - this.spawnPosition.x, this.playerSpawn.z - this.spawnPosition.z);
    this.physics.createFixedBox({ position: { x: this.spawnPosition.x, y: this.groundY - 0.1, z: this.spawnPosition.z }, halfExtents: { x: 7, y: 0.1, z: 7 }, userData: { type: 'folsom-combat-courtyard-ground' } });
    this.actor = new HumanoidCombatActor({ physics: this.physics, scene: this.scene, spawnOffset, spawnYaw, visualProfile: this.modelProfile, mortalityMode: resolveCombatMortalityMode(), eventSink: (event, payload) => this.handleCombatEvent(event, payload) });
    this.actor.root.name = 'folsom-model-idle-combat-subject';
    this.playerBlocker = this.actor.updatePlayerCollisionBlocker({ id: 'folsom-model-idle-combat-player-blocker' });
    this.meleeSpacing = applyMeleeSpacingEnvelope(this.playerBlocker, { playerRadius: this.dungeon.collision?.playerRadius, readyReach: Math.abs(KNIFE_COMBAT_CONFIG.workspace.ready[2]) + KNIFE_COMBAT_CONFIG.bladeLength, gestureReach: KNIFE_COMBAT_CONFIG.workspace.thrustDistance, effectiveDepth: KNIFE_COMBAT_CONFIG.maximumPenetrationDepth });
    this.dungeon.collision?.addBlocker?.(this.playerBlocker);
    this.actor.setEnvironmentContactHints({ groundY: this.groundY, wallX: null });
    this.bloodEffects = new CombatBloodEffects({ scene: this.scene, woundSystem: this.actor.woundSystem, physiology: this.actor.physiology, groundY: this.groundY, eventSink: (event, payload) => this.handleCombatEvent(event, payload) });
    this.combatDirector = new CombatDirector({ actor: this.actor, bloodEffects: this.bloodEffects, feedbackSystem: this.feedbackSystem });
  }

  resolveCombatSpawn() {
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
    return new THREE.Vector3(FOLSOM_MODEL_IDLE_SPAWN_XZ[0], 0.16, FOLSOM_MODEL_IDLE_SPAWN_XZ[1]);
  }

  handleCombatEvent(event, payload = {}) {
    if (event === 'final_exhale') this.feedbackSystem.stopOwnerVocal('folsom-combat-actor');
    if (this.combatDirector) this.combatDirector.forwardFeedbackEvent(event, { ...payload, owner: 'folsom-combat-actor' });
    else this.feedbackSystem.emit(event, { ...payload, owner: 'folsom-combat-actor' });
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
    this.actor.prepareFrame(deltaSeconds);
    this.physics.step(deltaSeconds, (dt) => {
      this.feedbackSystem.update(dt);
      this.weaponController?.beforePhysics?.(dt);
      this.combatDirector.update(dt);
      this.actor.beforePhysics(dt, player?.position);
    }, (dt) => {
      this.weaponController?.afterPhysicsStep?.(dt);
      this.bloodEffects.update(dt);
    });
    this.actor.afterPhysics(this.physics.interpolationAlpha);
    this.actor.updatePlayerCollisionBlocker(this.playerBlocker);
    const combatShadowTarget = this.actor.getBodyWorldPosition('upper_chest');
    if (combatShadowTarget) this.scene.userData.activeCombatShadowTarget = combatShadowTarget;
    this.weaponController?.afterPhysics?.(this.physics.interpolationAlpha);
  }

  reset() {
    this.weaponController?.cancel?.('encounter-reset');
    this.actor.reset();
    this.actor.updatePlayerCollisionBlocker(this.playerBlocker);
    this.bloodEffects.clear();
    this.combatDirector.reset();
    this.feedbackSystem.reset();
    this.weaponController?.reset?.();
  }

  getDiagnostics() {
    return { modelProfileName: this.modelProfile.name, physics: this.physics.getDiagnostics(), actor: this.actor.getDiagnostics(), weapon: this.weaponController?.getDiagnostics?.() ?? null, director: this.combatDirector.getDiagnostics(), blood: this.bloodEffects.getDiagnostics(), feedback: this.feedbackSystem.getDiagnostics(), meleeSpacing: this.meleeSpacing, spawnPosition: this.spawnPosition.toArray(), groundY: this.groundY };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.weaponController?.cancel?.('encounter-dispose');
    this.dungeon.collision?.removeBlocker?.(this.playerBlocker);
    this.combatDirector.dispose();
    this.bloodEffects.dispose();
    this.feedbackSystem.dispose();
    this.actor.dispose();
    this.physics.dispose();
    delete this.scene.userData.activeCombatShadowTarget;
  }
}
