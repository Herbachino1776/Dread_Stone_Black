import * as THREE from 'three';
import { CreatureAnimationSet } from './CreatureAnimationSet.js';
import { CreatureMaterialProfile } from './CreatureMaterialProfile.js';
import { CreatureCombatProfile } from './CreatureCombatProfile.js';
import { CreatureAIProfile } from './CreatureAIProfile.js';
import { CreatureSpawnProfile } from './CreatureSpawnProfile.js';
import { buildCreatureDebugInfo } from './CreatureDebugInfo.js';

const devLoadSummaryLogged = new Set();

export class CreatureActor {
  constructor(config, { scene = null, position = null, yaw = null, name = null } = {}) {
    this.config = config;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = name ?? config.id;
    this.materialProfile = new CreatureMaterialProfile(config.materialProfile ?? {});
    this.combatProfile = new CreatureCombatProfile(config.combatProfile ?? {});
    this.aiProfile = new CreatureAIProfile(config.aiProfile ?? {});
    this.spawnProfile = new CreatureSpawnProfile(config.spawnProfile ?? {});
    this.runtimeCombat = this.combatProfile.createRuntimeState();
    this.health = this.runtimeCombat.health;
    this.isLoaded = false;
    this.loadError = null;
    this.lastLoadSummary = null;
    this.animationSet = new CreatureAnimationSet({
      config,
      rootGroup: this.group,
      materialProfile: this.materialProfile,
      onTrackLoaded: () => this.refreshUserData(),
    });
    this.spawnProfile.applyToGroup(this.group, { position, yaw });
    this.refreshUserData();
  }

  load({ initialStates = null, lazyStates = null, addToScene = true } = {}) {
    const expected = this.config.assets?.expectedAnimations ?? Object.keys(this.config.assets?.animationFiles ?? {});
    const initial = initialStates ?? expected;
    const lazy = lazyStates ?? [];

    return this.animationSet.loadStates(initial)
      .then(() => {
        const defaultState = this.config.animationProfile?.idle ?? initial[0] ?? expected[0];
        this.setAnimationState(defaultState, { force: true });
        if (this.scene && addToScene && !this.group.parent) this.scene.add(this.group);
        this.isLoaded = true;
        this.refreshUserData();
        this.logLoadSummaryOnce();
        lazy.forEach((state) => {
          this.animationSet.loadState(state)
            .then(() => {
              this.refreshUserData();
            })
            .catch(() => {});
        });
        return this;
      })
      .catch((error) => {
        this.loadError = error;
        throw error;
      });
  }

  update(deltaSeconds, context = {}) {
    this.animationSet.update(deltaSeconds);
    if (context.behaviorState || context.targetId) this.refreshUserData(context);
  }

  setAnimationState(state, options = {}) {
    const didSet = this.animationSet.setState(state, options);
    if (didSet) this.refreshUserData();
    return didSet;
  }

  applyMaterialProfile() {
    const summaries = {};
    Object.entries(this.animationSet.tracks).forEach(([state, track]) => {
      summaries[state] = this.materialProfile.apply(track.root);
    });
    this.group.userData.materialTuning = summaries;
    return summaries;
  }

  setPosition(position) {
    this.group.position.copy(position);
    this.refreshUserData();
  }

  faceDirection(direction, deltaSeconds, turnSpeed = this.config.combatProfile?.turnSpeed ?? 5.2) {
    if (!direction || direction.lengthSq() < 0.0004) return;
    const desiredYaw = Math.atan2(direction.x, direction.z) + (this.config.scale?.rotationOffset ?? 0);
    const yawDelta = THREE.MathUtils.euclideanModulo(desiredYaw - this.group.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    const maxDelta = Math.max(0.01, turnSpeed * deltaSeconds);
    const dampedDelta = yawDelta * (1 - Math.exp(-turnSpeed * deltaSeconds));
    this.group.rotation.y += THREE.MathUtils.clamp(dampedDelta, -maxDelta, maxDelta);
    this.group.rotation.y = THREE.MathUtils.euclideanModulo(this.group.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
  }

  takeDamage(amount, source = null) {
    if (!this.isAlive()) return { killed: false, remainingHealth: this.health };
    this.health = Math.max(0, this.health - amount);
    this.group.userData.health = this.health;
    this.group.userData.lastDamageSource = source;
    if (this.health <= 0) {
      this.setAnimationState(this.config.animationProfile?.die ?? 'die', { force: true });
      return { killed: true, remainingHealth: 0 };
    }
    return { killed: false, remainingHealth: this.health };
  }

  isAlive() {
    return this.health > 0;
  }

  getActionDuration(animationState, fallback = 0) {
    return this.animationSet.getDuration(animationState, fallback);
  }

  refreshUserData(controllerState = {}) {
    const debugInfo = buildCreatureDebugInfo(this, controllerState);
    this.group.userData = {
      ...this.group.userData,
      creatureActor: true,
      creatureId: this.config.id,
      displayName: this.config.identity?.displayName ?? this.config.displayName,
      species: this.config.identity?.species,
      role: this.config.identity?.role,
      faction: this.config.identity?.factionId,
      opposingFaction: this.config.identity?.opposingFactionId,
      tags: this.config.identity?.tags ?? [],
      assetUrls: this.config.assets?.animationFiles ?? {},
      animationStrategy: 'separate GLB scenes are swapped inside one CreatureActor root',
      loadedAnimationStates: this.animationSet.getLoadedStates(),
      expectedAnimationStates: this.config.assets?.expectedAnimations ?? Object.keys(this.config.assets?.animationFiles ?? {}),
      missingAnimationStates: this.animationSet.getMissingStates(),
      animationState: this.animationSet.currentState,
      visibleAnimationState: this.animationSet.currentState,
      normalizedScale: Object.fromEntries(Object.entries(this.animationSet.tracks).map(([state, track]) => [state, track.scale])),
      materialTuning: Object.fromEntries(Object.entries(this.animationSet.tracks).map(([state, track]) => [state, track.materialSummary])),
      health: this.health,
      combat: this.config.combatProfile,
      aiProfile: this.config.aiProfile,
      spawnProfile: this.config.spawnProfile,
      debug: debugInfo,
    };
  }

  logLoadSummaryOnce() {
    if (!import.meta.env.DEV) return;
    const key = this.config.id;
    if (devLoadSummaryLogged.has(key)) return;

    const expected = this.config.assets?.expectedAnimations ?? Object.keys(this.config.assets?.animationFiles ?? {});
    const loaded = this.animationSet.getLoadedStates();
    const missing = expected.filter((state) => !loaded.includes(this.animationSet.resolveState(state)));
    this.lastLoadSummary = {
      creatureId: this.config.id,
      loadedAnimationStates: loaded,
      missingOptionalStates: missing,
      finalScale: this.group.userData.normalizedScale,
      materialProfileApplied: this.config.materialProfile?.id ?? 'default',
    };
    console.info('CreatureActor load summary:', this.lastLoadSummary);
    devLoadSummaryLogged.add(key);
  }

  dispose() {
    this.group.userData.disposed = true;
    this.animationSet.dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
