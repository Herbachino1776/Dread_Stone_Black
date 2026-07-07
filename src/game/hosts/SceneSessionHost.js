import * as THREE from 'three';
import { DungeonScene } from '../DungeonScene.js';
import { PlayerController } from '../PlayerController.js';
import { resolveLocationIdForArea, resolveLocationReturnSpawn, resolveStartupArea } from '../locationRouting.js';
import { getLoadedLocationDefinitionIds, getLocationDefinition, getLocationRegistryDebugSummary, loadLocationDefinition } from '../locations/locationRegistry.js';

export class SceneSessionHost {
  constructor({ rendererHost, gameState, query = new URLSearchParams(window.location.search), onSessionChanged = null } = {}) {
    this.rendererHost = rendererHost;
    this.gameState = gameState;
    this.query = query;
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
    const requestedArea = this.query.get('area');
    const returnedFrom = this.query.get('from');
    const spawnId = this.query.get('spawn');
    const area = resolveStartupArea(requestedArea);
    const fieldSpawn = area === 'field'
      ? await resolveLocationReturnSpawn(returnedFrom)
      : 'start';

    await this.preloadLocationForArea(area);
    this.createSession({ area, fieldSpawn, spawnId });
    return this.getSessionSummary();
  }

  createSession({ area, fieldSpawn = 'start', spawnId = null } = {}) {
    this.disposeCurrentSession();
    this.dungeon = new DungeonScene({ area, fieldSpawn, spawnId, gameState: this.gameState });
    this.scene = this.dungeon.build();
    this.dungeon.setLanternRevealEmitterProvider?.(this.lanternRevealEmitterProvider);
    this.scene.add(this.camera);
    this.locationId = this.resolveLocationId(this.dungeon.area);
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
    const summary = this.createSession({
      area: destinationArea,
      fieldSpawn,
      spawnId: destinationArea === 'field' ? null : destinationSpawnId,
    });

    const params = new URLSearchParams({ area: destinationArea });
    if (fromArea) params.set('from', fromArea);
    if (destinationArea !== 'field' && destinationSpawnId) params.set('spawn', destinationSpawnId);
    this.query = params;
    window.history?.pushState?.({ area: destinationArea, spawnId: destinationSpawnId }, '', `${window.location.pathname}?${params.toString()}`);
    this.onSessionChanged?.(this, summary);
    return summary;
  }

  update(deltaSeconds, { controls = null, isPaused = false, isPlayerDead = false } = {}) {
    if (!isPaused && !isPlayerDead) this.player?.update(deltaSeconds, controls);
    if (!isPaused) this.dungeon?.update(deltaSeconds, this.player);
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
    this.scene.remove(this.camera);
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
