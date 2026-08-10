import * as THREE from 'three';
import { CombatBloodEffects } from '../combat/CombatBloodEffects.js';
import { CombatDirector } from '../combat/CombatDirector.js';
import { MinimalCombatBrain } from '../combat/MinimalCombatBrain.js';
import { NpcArmamentRuntime } from '../combat/NpcArmamentRuntime.js';
import { createEnemyRuntimeRewardConfiguration, EnemyLootRuntime } from '../economy/EnemyLootRuntime.js';
import { EnemyWorldMotionHost } from './EnemyWorldMotionHost.js';

function selectApprovedAction(resolvedPreset) {
  const action = resolvedPreset?.compatibleActions?.[0];
  if (!action?.combatActionId) throw new Error(`Enemy Preset "${resolvedPreset?.preset?.presetId ?? 'unknown'}" has no deterministic approved offensive Action.`);
  return action;
}

export class EncounterEnemyRuntime {
  static async create(options = {}) {
    const runtime = new EncounterEnemyRuntime(options);
    try {
      await runtime.initialize();
      return runtime;
    } catch (error) {
      runtime.dispose();
      throw error;
    }
  }

  constructor({ spawnRecord, resolvedPreset, services, creatureFactory, motionHostFactory = null } = {}) {
    if (!spawnRecord || !resolvedPreset || !services || !creatureFactory) throw new Error('EncounterEnemyRuntime requires spawn, resolved preset, runtime services, and CreatureFactory.');
    this.spawnRecord = spawnRecord;
    this.spawnId = spawnRecord.spawnId;
    this.presetId = spawnRecord.presetId;
    this.resolvedPreset = resolvedPreset;
    this.services = services;
    this.creatureFactory = creatureFactory;
    this.motionHostFactory = motionHostFactory;
    this.actor = null;
    this.combatDirector = null;
    this.bloodEffects = null;
    this.armamentRuntime = null;
    this.brain = null;
    this.lootRuntime = null;
    this.motionHost = null;
    this.routingRegistered = false;
    this.collisionReleased = false;
    this.initialized = false;
    this.disposed = false;
    this.lastLifeState = null;
  }

  async initialize() {
    const position = new THREE.Vector3().fromArray(this.spawnRecord.transform.position);
    const spawnOffset = new THREE.Vector3(position.x, position.y, position.z + 3.55);
    let director = null;
    const eventSink = (event, payload) => director?.forwardFeedbackEvent?.(event, { ...payload, spawnId: this.spawnId });
    const created = this.creatureFactory.createActorFromResolved(this.resolvedPreset, {
      physics: this.services.physics,
      scene: this.services.scene,
      spawnOffset,
      spawnYaw: this.spawnRecord.transform.yaw,
      automaticMortality: true,
      isolateVisualMaterials: true,
      acceptedCombatAudio: this.services.acceptedCombatAudio ?? null,
      eventSink,
    });
    this.actor = created.actor;
    this.actor.root.name = `encounter-enemy-${this.spawnId}`;
    this.actor.root.userData.spawnId = this.spawnId;
    this.actor.root.userData.encounterId = this.services.encounterId ?? null;
    this.actor.combatContactState = 'alive';
    await this.actor.visualAdapter?.ready;
    if (this.disposed) throw new Error(`Encounter enemy "${this.spawnId}" was disposed during visual initialization.`);

    this.motionHost = this.motionHostFactory
      ? this.motionHostFactory({ actor: this.actor, position, yaw: this.spawnRecord.transform.yaw, spawnRecord: this.spawnRecord, services: this.services })
      : new EnemyWorldMotionHost({
        actor: this.actor,
        collision: this.services.collision,
        position,
        yaw: this.spawnRecord.transform.yaw,
        blockerId: `encounter-spawn-${this.spawnId}`,
      });
    this.actor.setDetachmentBloodEmitter?.((request) => this.bloodEffects?.emitDetachment?.(request) === true);
    this.bloodEffects = new CombatBloodEffects({
      scene: this.services.scene,
      woundSystem: this.actor.woundSystem,
      physiology: this.actor.physiology,
      groundY: position.y,
      eventSink,
    });
    director = new CombatDirector({
      actor: this.actor,
      bloodEffects: this.bloodEffects,
      feedbackSystem: this.services.feedbackSystem ?? null,
      acceptedCombatAudio: this.services.acceptedCombatAudio ?? null,
    });
    this.combatDirector = director;
    this.services.combatRouter.register(this.actor, this.combatDirector);
    this.routingRegistered = true;

    this.armamentRuntime = new NpcArmamentRuntime({
      actor: this.actor,
      creaturePack: this.resolvedPreset.pack,
      loadout: this.resolvedPreset.loadout,
      weaponRegistry: this.services.weaponRegistry,
      playerProvider: this.services.playerProvider,
      damageReceiverProvider: this.services.playerDamageReceiverProvider,
    });
    const rewardConfiguration = createEnemyRuntimeRewardConfiguration({
      lootProfile: this.resolvedPreset.lootProfile,
      fixedGoldOverride: this.spawnRecord.rewardOverride?.gold ?? null,
      spawnId: this.spawnId,
    });
    this.lootRuntime = new EnemyLootRuntime({
      actor: this.actor,
      lootProfile: this.resolvedPreset.lootProfile,
      rewardConfiguration,
      playerCurrencyState: this.services.playerCurrencyState,
      random: this.services.lootRandom ?? Math.random,
    });
    const action = selectApprovedAction(this.resolvedPreset);
    this.brain = new MinimalCombatBrain({
      actor: this.actor,
      armamentRuntime: this.armamentRuntime,
      playerProvider: this.services.playerProvider,
      playerCombatState: this.services.playerCombatState,
      homePosition: position,
      homeYaw: this.spawnRecord.transform.yaw,
      approvedActionId: action.combatActionId,
      resolvedWeapon: this.resolvedPreset.weapon,
      bodyHeight: this.resolvedPreset.profile?.targetHeight,
      motionHost: this.motionHost,
      config: { homeLeashRadius: this.spawnRecord.homeRadius },
    });
    const enabled = await this.brain.enable();
    if (enabled.accepted !== true) throw new Error(`Encounter enemy "${this.spawnId}" could not enable its combat brain: ${enabled.reason ?? 'unknown failure'}`);
    this.lastLifeState = this.actor.lifeState;
    this.initialized = true;
    return this;
  }

  update(deltaSeconds = 0) {
    if (this.disposed || !this.initialized) return this.getDiagnostics();
    this.actor?.prepareFrame?.(deltaSeconds);
    this.brain?.update?.(deltaSeconds);
    this.lootRuntime?.update?.();
    this.handleLifeStateChange();
    return this.getDiagnostics();
  }

  beforePhysics(deltaSeconds, playerPosition = null) {
    if (this.disposed) return;
    this.combatDirector?.update?.(deltaSeconds);
    this.actor?.beforePhysics?.(deltaSeconds, playerPosition);
  }

  afterPhysicsStep(deltaSeconds) {
    if (this.disposed) return;
    this.bloodEffects?.update?.(deltaSeconds);
  }

  afterPhysics(alpha = 1) {
    if (this.disposed) return;
    this.actor?.afterPhysics?.(alpha);
    this.motionHost?.updatePlayerBlocker?.();
    this.handleLifeStateChange();
  }

  handleLifeStateChange() {
    const lifeState = this.actor?.lifeState ?? 'disposed';
    if (lifeState === this.lastLifeState) return;
    this.lastLifeState = lifeState;
    if (lifeState === 'dead') {
      this.actor.combatContactState = 'grounded';
      if (this.routingRegistered) this.services.combatRouter.unregister(this.actor);
      this.routingRegistered = false;
      this.motionHost?.releaseCollisionOwnership?.();
      this.collisionReleased = true;
      this.services.weaponControllerProvider?.()?.cancelTarget?.(this.actor, 'encounter-enemy-dead');
      this.lootRuntime?.update?.();
    } else if (lifeState === 'dying') this.actor.combatContactState = 'dying';
  }

  claimLoot(context = null) {
    return this.lootRuntime?.claim?.({ source: 'encounter-loot-claim', spawnId: this.spawnId, ...context })
      ?? { accepted: false, reason: 'loot-runtime-unavailable' };
  }

  isContactable() {
    return Boolean(this.actor && !this.actor.disposed && ['alive', 'dying'].includes(this.actor.lifeState) && this.routingRegistered);
  }

  getDiagnostics() {
    const brain = this.brain?.getDiagnostics?.() ?? null;
    const loot = this.lootRuntime?.getSnapshot?.() ?? null;
    return {
      spawnId: this.spawnId,
      presetId: this.presetId,
      actorInstanceId: this.actor?.instanceId ?? null,
      brainState: brain?.state ?? 'IDLE',
      brainEnabled: brain?.enabled === true,
      distanceToHome: brain?.homeDistance ?? 0,
      homePosition: brain?.homePosition ?? [...this.spawnRecord.transform.position],
      homeYaw: brain?.homeYaw ?? this.spawnRecord.transform.yaw,
      homeRadius: this.brain?.config?.homeLeashRadius ?? this.spawnRecord.homeRadius,
      lifeState: this.actor?.lifeState ?? 'disposed',
      lootState: loot?.state ?? 'unavailable',
      resolvedGold: loot?.resolvedGold ?? null,
      routingRegistered: this.routingRegistered,
      collisionReleased: this.collisionReleased,
      armament: this.armamentRuntime?.getDiagnostics?.() ?? null,
      motion: this.motionHost?.getDiagnostics?.() ?? null,
      initialized: this.initialized,
      disposed: this.disposed,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.services?.weaponControllerProvider?.()?.cancelTarget?.(this.actor, 'encounter-enemy-dispose');
    this.brain?.dispose?.();
    this.brain = null;
    this.armamentRuntime?.dispose?.();
    this.armamentRuntime = null;
    this.lootRuntime?.dispose?.();
    this.lootRuntime = null;
    if (this.routingRegistered) this.services?.combatRouter?.unregister?.(this.actor);
    this.routingRegistered = false;
    this.motionHost?.dispose?.();
    this.motionHost = null;
    this.combatDirector?.dispose?.();
    this.combatDirector = null;
    this.bloodEffects?.dispose?.();
    this.bloodEffects = null;
    this.actor?.dispose?.();
    this.actor = null;
    this.initialized = false;
  }
}
