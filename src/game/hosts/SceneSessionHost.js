import * as THREE from 'three';
import { DungeonScene } from '../DungeonScene.js';
import { PlayerController } from '../PlayerController.js';
import { resolveLocationIdForArea, resolveLocationReturnSpawn, resolveStartupArea } from '../locationRouting.js';
import { getLocationDefinition, loadLocationDefinition } from '../locations/locationRegistry.js';

export class SceneSessionHost {
  constructor({ rendererHost, gameState, query = new URLSearchParams(window.location.search) } = {}) {
    this.rendererHost = rendererHost;
    this.gameState = gameState;
    this.query = query;
    this.dungeon = null;
    this.scene = null;
    this.player = null;
    this.locationId = null;

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
    const area = resolveStartupArea(requestedArea);
    const fieldSpawn = area === 'field'
      ? await resolveLocationReturnSpawn(returnedFrom)
      : 'start';

    await this.preloadLocationForArea(area);
    this.createSession({ area, fieldSpawn });
    return this.getSessionSummary();
  }

  createSession({ area, fieldSpawn = 'start' } = {}) {
    this.disposeCurrentSession();
    this.dungeon = new DungeonScene({ area, fieldSpawn, gameState: this.gameState });
    this.scene = this.dungeon.build();
    this.scene.add(this.camera);
    this.locationId = this.resolveLocationId(this.dungeon.area);
    this.player = new PlayerController(this.camera, this.dungeon.collision, {
      ...this.dungeon.playerSpawn,
      ...this.getMovementProfile(this.locationId),
    });
    return this.getSessionSummary();
  }

  async reloadCurrentSession() {
    const area = this.dungeon?.area ?? resolveStartupArea(this.query.get('area'));
    const fieldSpawn = this.dungeon?.fieldSpawn ?? 'start';
    await this.preloadLocationForArea(area);
    return this.createSession({ area, fieldSpawn });
  }

  async transitionToLocation(locationId, { areaParam = locationId, fromArea = null, delayMs = 0 } = {}) {
    await loadLocationDefinition(locationId);
    window.setTimeout(() => {
      const params = new URLSearchParams({ area: areaParam });
      if (fromArea) params.set('from', fromArea);
      window.location.assign(`${window.location.pathname}?${params.toString()}`);
    }, delayMs);
    return false;
  }

  update(deltaSeconds, { controls = null, isPaused = false, isPlayerDead = false } = {}) {
    if (!isPaused && !isPlayerDead) this.player?.update(deltaSeconds, controls);
    if (!isPaused) this.dungeon?.update(deltaSeconds, this.player);
  }

  render() {
    this.rendererHost.render(this.scene, this.camera);
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

  getSessionSummary() {
    return {
      area: this.dungeon?.area ?? null,
      locationId: this.locationId,
      fieldSpawn: this.dungeon?.fieldSpawn ?? null,
      hasScene: Boolean(this.scene),
      hasPlayer: Boolean(this.player),
    };
  }

  disposeCurrentSession() {
    if (!this.scene) return;
    this.scene.remove(this.camera);
    this.scene.traverse((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((material) => material?.dispose?.());
      else child.material?.dispose?.();
    });
    this.dungeon?.creatureWorldRuntime?.dispose?.();
    this.dungeon?.fishingWorldRuntime?.dispose?.();
    this.dungeon = null;
    this.scene = null;
    this.player = null;
    this.locationId = null;
  }

  dispose() {
    this.resizeDisposer?.();
    this.disposeCurrentSession();
  }

  get currentScene() { return this.scene; }
  get currentLocationId() { return this.locationId; }
}
