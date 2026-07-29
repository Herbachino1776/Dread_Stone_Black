import { CombatLabWalkerController } from './CombatLabWalkerController.js';
import { DREADGUARD_DAMAGE_COMBAT_PROFILE } from './HumanoidModelProfiles.js';

export const FOLSOM_SHOWCASE_COMBAT_CONFIG = Object.freeze({
  enabled: true,
  additionalWalkerCount: 2,
  swordDismembermentEnabled: true,
  minimumSwordEdgeSpeed: 0.86,
  minimumSwordLateralMotionRatio: 0.68,
  minimumSwordAccumulatedEdgeTravel: 0.1,
  maximumSwordDetachmentsPerGesture: 2,
  maximumSwordSeamDistance: Object.freeze({
    head_neck: 0.18,
    left_elbow: 0.16,
    right_elbow: 0.16,
  }),
});

export function isFolsomShowcaseEnabled(query = new URLSearchParams(), config = FOLSOM_SHOWCASE_COMBAT_CONFIG) {
  return config.enabled === true && query?.get?.('folsomShowcase') !== '0';
}

// Removable Folsom presentation layer. Dismemberment 2.0 should replace this
// owner and the paired sword qualification adapter, not grow new rules here.
export class FolsomShowcaseCombatExtras {
  constructor({
    scene,
    physics,
    collision,
    combatRouter,
    stationaryActor,
    feedbackSystem,
    acceptedCombatAudio,
    playerProvider,
    query = new URLSearchParams(),
    walkerConfig,
    environmentFactory,
    actorFactory,
    beforeActorDisposal,
    config = FOLSOM_SHOWCASE_COMBAT_CONFIG,
  } = {}) {
    this.config = config;
    this.query = query;
    this.enabled = isFolsomShowcaseEnabled(query, config);
    this.controllers = [];
    if (!this.enabled) return;

    for (let index = 0; index < config.additionalWalkerCount; index += 1) {
      const ownerId = `showcase-${index + 1}`;
      const controller = new CombatLabWalkerController({
        scene,
        physics,
        collision,
        combatRouter,
        stationaryActor,
        feedbackSystem,
        acceptedCombatAudio,
        playerProvider,
        enabled: true,
        query,
        config: walkerConfig,
        environment: environmentFactory?.({ ownerId, ordinal: index + 1 }),
        actorFactory,
        beforeActorDisposal,
      });
      // Give every showcase walker a different deterministic candidate sequence
      // even before the shared collision world rejects overlapping blockers.
      controller.respawnGeneration = index + 1;
      controller.reset(playerProvider?.());
      this.controllers.push(controller);
    }
  }

  getWalkerControllers() {
    return this.controllers;
  }

  getActors() {
    return this.controllers.map((controller) => controller.actor).filter(Boolean);
  }

  setStationaryActor(actor) {
    this.controllers.forEach((controller) => { controller.stationaryActor = actor; });
  }

  prepareFrame(deltaSeconds, player) {
    this.controllers.forEach((controller) => controller.prepareFrame(deltaSeconds, player));
  }

  beforePhysics(deltaSeconds, playerPosition) {
    this.controllers.forEach((controller) => controller.beforePhysics(deltaSeconds, playerPosition));
  }

  afterPhysicsStep(deltaSeconds) {
    this.controllers.forEach((controller) => controller.afterPhysicsStep(deltaSeconds));
  }

  afterPhysics(alpha) {
    this.controllers.forEach((controller) => controller.afterPhysics(alpha));
  }

  reset(player, stationaryActor) {
    this.setStationaryActor(stationaryActor);
    this.controllers.forEach((controller) => controller.reset(player));
  }

  getDiagnostics() {
    const actors = this.getActors();
    return {
      enabled: this.enabled,
      configuredAdditionalWalkerCount: this.config.additionalWalkerCount,
      additionalWalkerCount: actors.length,
      damageProfileActorCount: actors.filter((actor) => actor.visualProfile === DREADGUARD_DAMAGE_COMBAT_PROFILE).length,
      walkers: this.controllers.map((controller) => controller.getDiagnostics()),
    };
  }

  dispose() {
    this.controllers.forEach((controller) => controller.dispose());
    this.controllers = [];
  }
}
