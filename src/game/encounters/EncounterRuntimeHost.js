import * as THREE from 'three';
import { CombatAcceptedAudioSystem } from '../combat/CombatAcceptedAudioSystem.js';
import { CombatActorRouter } from '../combat/CombatActorRouter.js';
import { CombatFeedbackSystem } from '../combat/CombatFeedbackSystem.js';
import { CombatPhysicsWorld, initializeCombatPhysics } from '../combat/CombatPhysicsWorld.js';
import { encounterRegistry } from './EncounterRegistry.js';
import { EncounterSpawner } from './EncounterSpawner.js';

export class EncounterRuntimeHost {
  constructor({ registry = encounterRegistry, spawner = new EncounterSpawner(), audioRuntime = null, playerProvider = null, playerDamageReceiverProvider = null, playerCombatState = null, playerCurrencyState = null, lootRandom = Math.random, registeredActivationSuppressed = false } = {}) {
    if (!registry?.listByLocation) throw new Error('EncounterRuntimeHost requires an EncounterRegistry-compatible source.');
    this.registry = registry;
    this.spawner = spawner;
    this.audioRuntime = audioRuntime;
    this.playerProvider = playerProvider;
    this.playerDamageReceiverProvider = playerDamageReceiverProvider;
    this.playerCombatState = playerCombatState;
    this.playerCurrencyState = playerCurrencyState;
    this.lootRandom = lootRandom;
    this.session = null;
    this.dungeon = null;
    this.scene = null;
    this.locationId = null;
    this.physics = null;
    this.combatRouter = null;
    this.feedbackSystem = null;
    this.acceptedCombatAudio = null;
    this.borrowedCombatRuntime = null;
    this.ownsCombatInfrastructure = false;
    this.weaponController = null;
    this.activeRuntimes = new Map();
    this.initializing = false;
    this.disposed = false;
    this.lastError = null;
    this.sessionGeneration = 0;
    this.registeredActivationSuppressed = registeredActivationSuppressed === true;
  }

  get externallyDriven() { return Boolean(this.borrowedCombatRuntime); }
  get actor() { return this.getPriorityCombatActor(); }
  get bloodEffects() { return null; }
  get combatDirector() { return this.actor ? this.combatRouter?.getDirector?.(this.actor) ?? null : null; }

  async initializeForSession(session) {
    if (this.disposed) throw new Error('EncounterRuntimeHost is disposed.');
    this.detachSession('scene-session-rebind');
    const generation = ++this.sessionGeneration;
    this.initializing = true;
    this.session = session;
    this.dungeon = session?.dungeon ?? null;
    this.scene = session?.scene ?? this.dungeon?.scene ?? null;
    this.locationId = session?.locationId ?? session?.currentLocationId ?? this.dungeon?.area ?? null;
    if (!this.dungeon || !this.scene || !this.locationId) {
      this.initializing = false;
      throw new Error('EncounterRuntimeHost requires an active scene session with dungeon, scene, and locationId.');
    }
    this.dungeon.encounterRuntimeHost = this;

    const existing = this.dungeon.isCombatLab === true ? this.dungeon : this.dungeon.combatEncounter;
    if (existing?.physics && existing?.combatRouter) {
      this.borrowedCombatRuntime = existing;
      this.physics = existing.physics;
      this.combatRouter = existing.combatRouter;
      this.feedbackSystem = existing.feedbackSystem ?? null;
      this.acceptedCombatAudio = existing.acceptedCombatAudio ?? null;
      existing.attachEncounterRuntimeHost?.(this);
    } else {
      await initializeCombatPhysics();
      if (generation !== this.sessionGeneration || this.disposed) return this;
      this.ownsCombatInfrastructure = true;
      this.physics = new CombatPhysicsWorld();
      this.combatRouter = new CombatActorRouter();
      this.feedbackSystem = new CombatFeedbackSystem({ audioRuntime: this.audioRuntime });
      this.acceptedCombatAudio = new CombatAcceptedAudioSystem({ audioRuntime: this.audioRuntime });
    }

    try {
      await this.activateRegisteredLocationEncounters();
      this.lastError = null;
    } catch (error) {
      this.lastError = error.message;
      this.despawnAll('location-activation-rollback');
      throw error;
    } finally {
      if (generation === this.sessionGeneration) this.initializing = false;
    }
    return this;
  }

  createServices(encounterId = null) {
    return {
      encounterId,
      locationId: this.locationId,
      scene: this.scene,
      physics: this.physics,
      collision: this.dungeon?.collision,
      combatRouter: this.combatRouter,
      feedbackSystem: this.feedbackSystem,
      acceptedCombatAudio: this.acceptedCombatAudio,
      weaponRegistry: this.spawner.enemyPresetResolver?.weaponRegistry,
      playerProvider: this.playerProvider,
      playerDamageReceiverProvider: this.playerDamageReceiverProvider,
      playerCombatState: this.playerCombatState,
      playerCurrencyState: this.playerCurrencyState,
      lootRandom: this.lootRandom,
      weaponControllerProvider: () => this.borrowedCombatRuntime?.weaponController ?? this.weaponController,
    };
  }

  async activateRegisteredLocationEncounters() {
    if (this.registeredActivationSuppressed) return [];
    const activated = [];
    try {
      for (const definition of this.registry.listByLocation(this.locationId)) activated.push(await this.spawnDefinition(definition));
      return activated;
    } catch (error) {
      activated.reverse().forEach((runtime) => {
        this.activeRuntimes.delete(runtime.encounterId);
        runtime.dispose?.();
      });
      throw error;
    }
  }

  async spawnDefinition(definition) {
    if (this.disposed || !this.scene) throw new Error('EncounterRuntimeHost has no active scene session.');
    if (definition.locationId !== this.locationId) throw new Error(`Encounter "${definition.encounterId}" belongs to location "${definition.locationId}", not "${this.locationId}".`);
    if (this.activeRuntimes.has(definition.encounterId)) return this.activeRuntimes.get(definition.encounterId);
    const runtime = await this.spawner.spawn(definition, this.createServices(definition.encounterId));
    this.activeRuntimes.set(runtime.encounterId, runtime);
    return runtime;
  }

  async setRegisteredActivationSuppressed(suppressed, { despawn = true } = {}) {
    const next = suppressed === true;
    if (this.registeredActivationSuppressed === next) return { suppressed: next, changed: false };
    this.registeredActivationSuppressed = next;
    if (next) {
      const despawned = despawn ? this.despawnAll('registered-encounters-authoring-suppressed') : 0;
      return { suppressed: true, changed: true, despawned };
    }
    const activated = this.scene ? await this.activateRegisteredLocationEncounters() : [];
    return { suppressed: false, changed: true, activated: activated.length };
  }

  async resetEncounter(encounterId) {
    const runtime = this.activeRuntimes.get(encounterId);
    if (!runtime) return { accepted: false, reason: 'encounter-runtime-unavailable' };
    return await runtime.reset();
  }

  despawnEncounter(encounterId, reason = 'encounter-host-despawn') {
    const runtime = this.activeRuntimes.get(encounterId);
    if (!runtime) return false;
    this.activeRuntimes.delete(encounterId);
    runtime.dispose?.(reason);
    return true;
  }

  despawnAll(reason = 'encounter-host-despawn-all') {
    const runtimes = [...this.activeRuntimes.values()];
    this.activeRuntimes.clear();
    runtimes.reverse().forEach((runtime) => runtime.dispose?.(reason));
    return runtimes.length;
  }

  updateEncounterFrames(deltaSeconds) { this.activeRuntimes.forEach((runtime) => runtime.update?.(deltaSeconds)); }
  beforePhysics(deltaSeconds) {
    const playerPosition = this.playerProvider?.()?.position ?? null;
    this.activeRuntimes.forEach((runtime) => runtime.beforePhysics?.(deltaSeconds, playerPosition));
  }
  afterPhysicsStep(deltaSeconds) { this.activeRuntimes.forEach((runtime) => runtime.afterPhysicsStep?.(deltaSeconds)); }
  afterPhysics(alpha = 1) { this.activeRuntimes.forEach((runtime) => runtime.afterPhysics?.(alpha)); }

  update(deltaSeconds = 0) {
    if (this.disposed || this.initializing || this.externallyDriven || !this.physics) return this.getDiagnostics();
    this.updateEncounterFrames(deltaSeconds);
    this.physics.step(deltaSeconds, (dt) => {
      this.acceptedCombatAudio?.update?.(dt);
      this.feedbackSystem?.update?.(dt);
      this.weaponController?.beforePhysics?.(dt);
      this.beforePhysics(dt);
    }, (dt) => {
      this.weaponController?.afterPhysicsStep?.(dt);
      this.afterPhysicsStep(dt);
    });
    this.afterPhysics(this.physics.interpolationAlpha);
    this.weaponController?.afterPhysics?.(this.physics.interpolationAlpha, deltaSeconds);
    return this.getDiagnostics();
  }

  attachWeaponController(controller) {
    if (this.weaponController === controller) return;
    this.weaponController?.cancel?.('encounter-host-weapon-controller-replaced');
    this.weaponController = controller;
  }

  getContactableActors() {
    return [...this.activeRuntimes.values()].flatMap((runtime) => runtime.getContactableActors?.() ?? []);
  }

  getActiveCombatActors() {
    return this.getContactableActors().filter((actor) => actor.lifeState === 'alive');
  }

  getPriorityCombatActor(player = this.playerProvider?.()) {
    if (!player?.position) return this.getActiveCombatActors()[0] ?? null;
    let selected = null;
    let distance = Infinity;
    for (const actor of this.getActiveCombatActors()) {
      const position = actor.visualRootPosition ?? actor.getBodyWorldPosition?.('pelvis');
      const candidateDistance = position?.distanceTo?.(player.position) ?? Infinity;
      if (candidateDistance < distance) { selected = actor; distance = candidateDistance; }
    }
    return selected;
  }

  isPlayerInCombatRange(player = this.playerProvider?.()) {
    if (!player?.position) return false;
    return this.getContactableActors().some((actor) => {
      const position = actor.visualRootPosition ?? actor.getBodyWorldPosition?.('pelvis', new THREE.Vector3());
      return position?.distanceTo?.(player.position) <= 6.5;
    });
  }

  getRuntime(encounterId) { return this.activeRuntimes.get(encounterId) ?? null; }

  getDiagnostics() {
    const encounters = [...this.activeRuntimes.values()].map((runtime) => runtime.getDiagnostics?.() ?? {});
    return {
      locationId: this.locationId,
      activeEncounterCount: encounters.length,
      activeEnemyCount: encounters.reduce((sum, encounter) => sum + (encounter.enemies?.length ?? 0), 0),
      borrowedCombatInfrastructure: Boolean(this.borrowedCombatRuntime),
      ownsCombatInfrastructure: this.ownsCombatInfrastructure,
      combatRouting: this.combatRouter?.getDiagnostics?.() ?? { actorCount: 0, colliderCount: 0 },
      encounters,
      initializing: this.initializing,
      registeredActivationSuppressed: this.registeredActivationSuppressed,
      lastError: this.lastError,
      disposed: this.disposed,
    };
  }

  detachSession(reason = 'encounter-host-session-detach') {
    this.sessionGeneration += 1;
    this.initializing = false;
    this.weaponController?.cancel?.(reason);
    this.despawnAll(reason);
    this.borrowedCombatRuntime?.detachEncounterRuntimeHost?.(this);
    if (this.dungeon?.encounterRuntimeHost === this) delete this.dungeon.encounterRuntimeHost;
    if (this.ownsCombatInfrastructure) {
      this.acceptedCombatAudio?.dispose?.();
      this.feedbackSystem?.dispose?.();
      this.combatRouter?.dispose?.();
      this.physics?.dispose?.();
    }
    this.session = null;
    this.dungeon = null;
    this.scene = null;
    this.locationId = null;
    this.physics = null;
    this.combatRouter = null;
    this.feedbackSystem = null;
    this.acceptedCombatAudio = null;
    this.borrowedCombatRuntime = null;
    this.ownsCombatInfrastructure = false;
    this.weaponController = null;
  }

  dispose() {
    if (this.disposed) return;
    this.detachSession('encounter-host-dispose');
    this.disposed = true;
  }
}
