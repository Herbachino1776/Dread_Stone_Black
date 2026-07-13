import * as THREE from 'three';
import { DungeonScene } from '../DungeonScene.js';
import { PlayerController } from '../PlayerController.js';
import { resolveLocationIdForArea, resolveLocationReturnSpawn, resolveStartupArea } from '../locationRouting.js';
import { getLoadedLocationDefinitionIds, getLocationDefinition, getLocationRegistryDebugSummary, loadLocationDefinition } from '../locations/locationRegistry.js';
import { CombatLabScene } from '../combat/CombatLabScene.js';
import { FolsomCombatEncounter } from '../combat/FolsomCombatEncounter.js';

export class SceneSessionHost {
  constructor({ rendererHost, gameState, query = new URLSearchParams(window.location.search), audioRuntime = null, onSessionChanged = null } = {}) {
    this.rendererHost = rendererHost;
    this.gameState = gameState;
    this.query = query;
    this.audioRuntime = audioRuntime;
    this.dungeon = null;
    this.scene = null;
    this.player = null;
    this.locationId = null;
    this.onSessionChanged = onSessionChanged;
    this.transitionPromise = null;
    this.lanternRevealEmitterProvider = null;

    const { width, height } = this.rendererHost.getViewportSize();
    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 260);
    this.resizeDisposer = this.rendererHost.onResize(({ width: resizeWidth, height: resizeHeight }) => {
      this.camera.aspect = resizeWidth / resizeHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  async startInitialSession() {
    if (this.query.get('combatLab') === '1') return this.createCombatLabSession();
    const requestedArea = this.query.get('area');
    const returnedFrom = this.query.get('from');
    const spawnId = this.query.get('spawn');
    const area = resolveStartupArea(requestedArea);
    const fieldSpawn = area === 'field'
      ? await resolveLocationReturnSpawn(returnedFrom)
      : 'start';

    await this.preloadLocationForArea(area);
    this.createSession({ area, fieldSpawn, spawnId });
    await this.attachFolsomCombatEncounter();
    return this.getSessionSummary();
  }

  async attachFolsomCombatEncounter() {
    if (this.locationId !== 'folsom' || !this.dungeon?.scene || this.dungeon.combatEncounter) return null;
    this.dungeon.combatEncounter = await FolsomCombatEncounter.create({ dungeon: this.dungeon, audioRuntime: this.audioRuntime, query: this.query, player: this.player });
    return this.dungeon.combatEncounter;
  }

  createSession({ area, fieldSpawn = 'start', spawnId = null } = {}) {
    this.disposeCurrentSession();
    this.dungeon = new DungeonScene({ area, fieldSpawn, spawnId, gameState: this.gameState, audioRuntime: this.audioRuntime, outdoorQualityTier: this.rendererHost.outdoorQualityTier });
    this.scene = this.dungeon.build();
    this.dungeon.setLanternRevealEmitterProvider?.(this.lanternRevealEmitterProvider);
    this.scene.add(this.camera);
    this.locationId = this.resolveLocationId(this.dungeon.area);
    this.configureCameraForLocation(this.locationId);
    this.player = new PlayerController(this.camera, this.dungeon.collision, {
      ...this.dungeon.playerSpawn,
      ...this.getMovementProfile(this.locationId),
    });
    this.validateStartupSpawn();
    return this.getSessionSummary();
  }

  async reloadCurrentSession() {
    const area = this.dungeon?.area ?? resolveStartupArea(this.query.get('area'));
    const fieldSpawn = this.dungeon?.fieldSpawn ?? 'start';
    const spawnId = this.dungeon?.spawnId ?? null;
    await this.preloadLocationForArea(area);
    return this.createSession({ area, fieldSpawn, spawnId });
  }

  async createCombatLabSession() {
    this.disposeCurrentSession();
    this.dungeon = await CombatLabScene.create({ root: this.rendererHost.root, audioRuntime: this.audioRuntime, query: this.query });
    this.scene = this.dungeon.build();
    this.scene.add(this.camera);
    this.locationId = 'combat-lab';
    this.camera.far = 80;
    this.camera.updateProjectionMatrix();
    this.player = new PlayerController(this.camera, this.dungeon.collision, {
      ...this.dungeon.playerSpawn,
      moveSpeed: PlayerController.DUNGEON_MOVE_SPEED,
      strafeSpeed: PlayerController.DUNGEON_STRAFE_SPEED,
    });
    this.dungeon.player = this.player;
    return this.getSessionSummary();
  }

  async transitionToLocation(locationId, { areaParam = locationId, fromArea = null, destinationSpawnId = null, delayMs = 0 } = {}) {
    if (this.transitionPromise) return this.transitionPromise;
    this.transitionPromise = this.performInGameTransition(locationId, {
      areaParam,
      fromArea,
      destinationSpawnId,
      delayMs,
    });
    try {
      return await this.transitionPromise;
    } finally {
      this.transitionPromise = null;
    }
  }

  async performInGameTransition(locationId, { areaParam = locationId, fromArea = null, destinationSpawnId = null, delayMs = 0 } = {}) {
    await loadLocationDefinition(locationId);
    if (delayMs > 0) await new Promise((resolve) => window.setTimeout(resolve, delayMs));

    const destinationArea = areaParam === 'reliquary-field' ? 'field' : areaParam;
    const fieldSpawn = destinationArea === 'field'
      ? await resolveLocationReturnSpawn(fromArea)
      : 'start';
    this.createSession({
      area: destinationArea,
      fieldSpawn,
      spawnId: destinationArea === 'field' ? null : destinationSpawnId,
    });
    await this.attachFolsomCombatEncounter();
    const summary = this.getSessionSummary();
    this.audioRuntime?.handleLocationTransition?.(locationId);

    const params = new URLSearchParams({ area: destinationArea });
    if (fromArea) params.set('from', fromArea);
    if (destinationArea !== 'field' && destinationSpawnId) params.set('spawn', destinationSpawnId);
    this.query = params;
    window.history?.pushState?.({ area: destinationArea, spawnId: destinationSpawnId }, '', `${window.location.pathname}?${params.toString()}`);
    this.onSessionChanged?.(this, summary);
    return summary;
  }

  update(deltaSeconds, { controls = null, isPaused = false, isPlayerDead = false } = {}) {
    if (this.player && this.dungeon) {
      this.player.setTargetEyeHeight?.(this.dungeon.resolvePlayerEyeHeight?.(this.player.position, this.player.baseEyeHeight) ?? this.player.baseEyeHeight);
    }
    if (!isPaused && !isPlayerDead) this.player?.update(deltaSeconds, controls);
    if (!isPaused) this.dungeon?.update(deltaSeconds, this.player);
    else this.dungeon?.updateOutdoorPresentation?.(this.player);
    if (!isPaused) this.dungeon?.combatEncounter?.update?.(deltaSeconds, this.player);
    this.rendererHost.applySceneExposure?.(this.dungeon);
  }

  render() {
    this.rendererHost.render(this.scene, this.camera);
  }

  validateStartupSpawn() {
    if (this.locationId !== 'folsom' || !this.player || !this.dungeon?.collision) return;

    const collision = this.dungeon.collision;
    const sampledFloor = collision.sampleWalkableY?.(this.player.position.x, this.player.position.z, 0);
    const expectedEyeY = (sampledFloor?.y ?? 0) + this.player.eyeHeight;
    const blockers = collision.getIntersectingBlockers?.(this.player.position) ?? [];
    const invalid = !sampledFloor
      || !collision.canStandAt?.(this.player.position)
      || blockers.length > 0
      || this.player.position.y < expectedEyeY - 0.08;

    if (!invalid) return;

    const safeFloor = collision.sampleWalkableY?.(-2, -4, 0);
    const safeY = (Number.isFinite(safeFloor?.y) ? safeFloor.y : 0.16) + this.player.eyeHeight + 0.015;
    this.player.position.set(-2, safeY, -4);
    this.player.spawnPosition.copy(this.player.position);
    this.player.spawnYaw = 0;
    this.player.yaw = 0;
    this.player.pitch = 0;
    this.player.syncCamera();
  }

  getMovementProfile(locationId) {
    return getLocationDefinition(locationId)?.type === 'field'
      ? {
        moveSpeed: PlayerController.OUTDOOR_MOVE_SPEED,
        strafeSpeed: PlayerController.OUTDOOR_STRAFE_SPEED,
      }
      : {
        moveSpeed: PlayerController.DUNGEON_MOVE_SPEED,
        strafeSpeed: PlayerController.DUNGEON_STRAFE_SPEED,
      };
  }

  async preloadLocationForArea(area) {
    const locationId = this.resolveLocationId(area);
    if (getLocationDefinition(locationId)) return;
    try {
      await loadLocationDefinition(locationId);
    } catch (error) {
      console.error(`[Dread Stone Black] Could not load startup location definition ${locationId}.`, error);
      throw error;
    }
  }

  resolveLocationId(area) {
    return resolveLocationIdForArea(area);
  }

  getLocationLoadDebugSummary() {
    const registry = getLocationRegistryDebugSummary();
    return {
      currentLocationId: this.locationId,
      loadedLocationIds: getLoadedLocationDefinitionIds(),
      activeSceneDefinitionId: this.dungeon?.compiledLocationRuntime?.locationId ?? this.locationId,
      activeCollisionSourceId: this.dungeon?.collision?.sourceLocationId ?? this.dungeon?.compiledLocationRuntime?.locationId ?? this.locationId,
      offLocationObjectsCount: this.dungeon?.countOffLocationSceneObjects?.(this.locationId) ?? 0,
      offLocationCollisionEntriesCount: this.dungeon?.countOffLocationCollisionEntries?.(this.locationId) ?? 0,
      routeRegistryLoaded: registry.routeRegistryLoaded,
      lazyLocationsPending: registry.lazyLocationsPending,
      registry,
    };
  }

  getSessionSummary() {
    return {
      area: this.dungeon?.area ?? null,
      locationId: this.locationId,
      fieldSpawn: this.dungeon?.fieldSpawn ?? null,
      hasScene: Boolean(this.scene),
      hasPlayer: Boolean(this.player),
      locationLoadDebug: this.getLocationLoadDebugSummary(),
    };
  }

  configureCameraForLocation(locationId) {
    const definition = getLocationDefinition(locationId);
    const fogFar = Number(definition?.fog?.far);
    this.camera.far = Number.isFinite(fogFar) ? Math.max(260, fogFar + 80) : 260;
    this.camera.updateProjectionMatrix();
  }

  setLanternRevealEmitterProvider(provider) {
    this.lanternRevealEmitterProvider = typeof provider === 'function' ? provider : null;
    this.dungeon?.setLanternRevealEmitterProvider?.(this.lanternRevealEmitterProvider);
  }

  getLanternRevealEmitter(targets) {
    return this.lanternRevealEmitterProvider?.(targets) ?? null;
  }

  disposeCurrentSession() {
    if (!this.scene) return;
    this.player?.dispose?.();
    this.dungeon?.lanternConeRevealRuntime?.dispose?.();
    this.dungeon?.beneathFolsomHiddenGrowthGateRuntime?.dispose?.();
    this.dungeon?.beneathFolsomLowerShrineHatchRuntime?.dispose?.();
    this.dungeon?.combatEncounter?.dispose?.();
    this.scene.remove(this.camera);
    this.dungeon?.dispose?.();
    this.scene.traverse((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((material) => material?.dispose?.());
      else child.material?.dispose?.();
    });
    this.dungeon?.fishingWorldRuntime?.dispose?.();
    this.dungeon = null;
    this.scene = null;
    this.player = null;
    this.locationId = null;
  }

  dispose() {
    this.lanternRevealEmitterProvider = null;
    this.resizeDisposer?.();
    this.disposeCurrentSession();
  }

  get currentScene() { return this.scene; }
  get currentLocationId() { return this.locationId; }
}
