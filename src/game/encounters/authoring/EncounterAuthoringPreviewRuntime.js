import * as THREE from 'three';
import { EncounterAuthoringPresetPreview } from './EncounterAuthoringPresetPreview.js';

function markerMaterial(color, opacity = 0.86) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, side: THREE.DoubleSide });
}

function disposeMarker(record) {
  record?.group?.removeFromParent?.();
  record?.group?.traverse?.((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material?.dispose?.());
    else object.material?.dispose?.();
  });
}

export class EncounterAuthoringPreviewRuntime {
  constructor({
    enemyPresetResolver,
    previewFactory = (options) => EncounterAuthoringPresetPreview.create(options),
    maxPreviewBodies = 4,
  } = {}) {
    this.enemyPresetResolver = enemyPresetResolver;
    this.previewFactory = previewFactory;
    this.maxPreviewBodies = Math.max(2, Math.floor(maxPreviewBodies));
    this.scene = null;
    this.camera = null;
    this.playerProvider = null;
    this.draft = null;
    this.selectedSpawnId = null;
    this.markers = new Map();
    this.spawnPreviews = new Map();
    this.pendingPreviews = new Map();
    this.desiredSpawnPreviewIds = new Set();
    this.placement = null;
    this.placementPreview = null;
    this.placementPromise = null;
    this.radiusRing = null;
    this.elapsedSinceBudget = 0;
    this.raycaster = new THREE.Raycaster();
    this.lastError = null;
    this.disposed = false;
    this.generation = 0;
  }

  attachSession({ scene, camera, playerProvider = null } = {}) {
    this.clearWorldVisuals();
    this.scene = scene;
    this.camera = camera;
    this.playerProvider = playerProvider;
    this.disposed = false;
    if (this.draft) this.syncMarkers();
  }

  setDraft(draft, { selectedSpawnId = this.selectedSpawnId } = {}) {
    this.draft = draft ?? null;
    this.selectedSpawnId = selectedSpawnId;
    this.syncMarkers();
    void this.reconcilePreviewBudget();
  }

  setSelection(spawnId) {
    this.selectedSpawnId = spawnId ?? null;
    this.syncMarkerStyles();
    this.syncRadiusRing();
    this.spawnPreviews.forEach((preview, id) => preview.setSelected(id === this.selectedSpawnId));
    void this.reconcilePreviewBudget();
  }

  setPlacement({ presetId, position, yaw = 0, valid = false, mode = 'placing' } = {}) {
    this.placement = { presetId, position: position ? [...position] : null, yaw, valid, mode };
    void this.reconcilePreviewBudget();
    if (!valid || !position) {
      if (this.placementPreview?.root) this.placementPreview.root.visible = false;
      return;
    }
    if (this.placementPreview?.presetId === presetId) {
      this.placementPreview.root.visible = true;
      this.placementPreview.setTransform(position, yaw);
    } else void this.ensurePlacementPreview();
  }

  clearPlacement() {
    this.placement = null;
    this.disposePlacementPreview();
    void this.reconcilePreviewBudget();
  }

  async ensurePlacementPreview() {
    if (!this.scene || !this.placement?.presetId || !this.placement.valid || this.placementPromise) return;
    this.disposePlacementPreview();
    const generation = this.generation;
    const request = { ...this.placement, position: [...this.placement.position] };
    this.placementPromise = this.previewFactory({
      presetId: request.presetId,
      scene: this.scene,
      position: request.position,
      yaw: request.yaw,
      selected: true,
      enemyPresetResolver: this.enemyPresetResolver,
    });
    try {
      const preview = await this.placementPromise;
      if (generation !== this.generation || !this.placement || this.placement.presetId !== request.presetId) preview.dispose();
      else {
        this.placementPreview = preview;
        preview.setTransform(this.placement.position, this.placement.yaw);
        preview.root.visible = this.placement.valid;
      }
      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    } finally {
      this.placementPromise = null;
    }
  }

  syncMarkers() {
    const spawns = this.draft?.spawns ?? [];
    const ids = new Set(spawns.map((spawn) => spawn.spawnId));
    this.markers.forEach((record, spawnId) => {
      if (!ids.has(spawnId)) { disposeMarker(record); this.markers.delete(spawnId); }
    });
    spawns.forEach((spawn) => {
      let record = this.markers.get(spawn.spawnId);
      if (!record && this.scene) {
        record = this.createMarker(spawn.spawnId);
        this.markers.set(spawn.spawnId, record);
      }
      if (record) {
        record.group.position.fromArray(spawn.transform.position);
        record.group.position.y += 0.035;
        record.group.rotation.y = spawn.transform.yaw;
      }
      const preview = this.spawnPreviews.get(spawn.spawnId);
      preview?.setTransform?.(spawn.transform.position, spawn.transform.yaw);
    });
    this.spawnPreviews.forEach((preview, spawnId) => {
      if (!ids.has(spawnId)) { preview.dispose(); this.spawnPreviews.delete(spawnId); }
    });
    this.syncMarkerStyles();
    this.syncRadiusRing();
  }

  createMarker(spawnId) {
    const group = new THREE.Group();
    group.name = `encounter-authoring-marker:${spawnId}`;
    group.userData = { devOnly: true, encounterAuthoringPreview: true, spawnId };
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.39, 24), markerMaterial(0x78a9a2));
    ring.rotation.x = -Math.PI / 2;
    const selectionHalo = new THREE.Mesh(new THREE.RingGeometry(0.43, 0.49, 24), markerMaterial(0xffdf82, 0.92));
    selectionHalo.rotation.x = -Math.PI / 2;
    selectionHalo.position.y = 0.006;
    selectionHalo.visible = false;
    const arrowGeometry = new THREE.BufferGeometry();
    arrowGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0.68, -0.12, 0, 0.4, 0.12, 0, 0.4,
    ], 3));
    const arrow = new THREE.Mesh(arrowGeometry, markerMaterial(0xc8e7df));
    const pick = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.8, 10), markerMaterial(0xffffff, 0.001));
    pick.position.y = 0.9;
    pick.userData = { devOnly: true, encounterAuthoringPreview: true, spawnId, authoringPickTarget: true };
    group.add(ring, selectionHalo, arrow, pick);
    this.scene.add(group);
    return { group, ring, selectionHalo, arrow, pick };
  }

  syncMarkerStyles() {
    this.markers.forEach((record, spawnId) => {
      const selected = spawnId === this.selectedSpawnId;
      record.ring.material.color.setHex(selected ? 0xf1cf72 : 0x78a9a2);
      record.arrow.material.color.setHex(selected ? 0xffefae : 0xc8e7df);
      record.selectionHalo.visible = selected;
      record.group.scale.setScalar(selected ? 1.34 : 1);
    });
  }

  syncRadiusRing() {
    this.radiusRing?.removeFromParent?.();
    this.radiusRing?.geometry?.dispose?.();
    this.radiusRing?.material?.dispose?.();
    this.radiusRing = null;
    const spawn = this.draft?.spawns?.find((entry) => entry.spawnId === this.selectedSpawnId);
    if (!spawn || !this.scene) return;
    const radius = spawn.homeRadius;
    this.radiusRing = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.01, radius - 0.035), radius + 0.035, 64),
      markerMaterial(0xd8b862, 0.72),
    );
    this.radiusRing.name = `encounter-authoring-home-radius:${spawn.spawnId}`;
    this.radiusRing.userData = { devOnly: true, encounterAuthoringPreview: true };
    this.radiusRing.rotation.x = -Math.PI / 2;
    this.radiusRing.position.fromArray(spawn.transform.position);
    this.radiusRing.position.y += 0.025;
    this.scene.add(this.radiusRing);
  }

  async reconcilePreviewBudget() {
    if (!this.scene || !this.draft || this.disposed) return;
    const reserve = this.placement?.presetId ? 1 : 0;
    const available = Math.max(0, this.maxPreviewBodies - reserve);
    const playerPosition = this.playerProvider?.()?.position ?? this.camera?.position ?? new THREE.Vector3();
    const ordered = [...this.draft.spawns].sort((first, second) => {
      if (first.spawnId === this.selectedSpawnId) return -1;
      if (second.spawnId === this.selectedSpawnId) return 1;
      const firstDistance = playerPosition.distanceToSquared(new THREE.Vector3().fromArray(first.transform.position));
      const secondDistance = playerPosition.distanceToSquared(new THREE.Vector3().fromArray(second.transform.position));
      return firstDistance - secondDistance;
    });
    const desired = new Set(ordered.slice(0, available).map((spawn) => spawn.spawnId));
    this.desiredSpawnPreviewIds = desired;
    this.spawnPreviews.forEach((preview, spawnId) => {
      if (!desired.has(spawnId)) { preview.dispose(); this.spawnPreviews.delete(spawnId); }
    });
    for (const spawn of ordered.slice(0, available)) void this.ensureSpawnPreview(spawn);
  }

  async ensureSpawnPreview(spawn) {
    const current = this.spawnPreviews.get(spawn.spawnId);
    if (current?.presetId === spawn.presetId) {
      current.setTransform(spawn.transform.position, spawn.transform.yaw);
      current.setSelected(spawn.spawnId === this.selectedSpawnId);
      return current;
    }
    if (current) { current.dispose(); this.spawnPreviews.delete(spawn.spawnId); }
    if (this.pendingPreviews.has(spawn.spawnId)) return this.pendingPreviews.get(spawn.spawnId);
    const generation = this.generation;
    const promise = this.previewFactory({
      presetId: spawn.presetId,
      scene: this.scene,
      position: spawn.transform.position,
      yaw: spawn.transform.yaw,
      selected: spawn.spawnId === this.selectedSpawnId,
      enemyPresetResolver: this.enemyPresetResolver,
    }).then((preview) => {
      const currentSpawn = this.draft?.spawns?.find((entry) => entry.spawnId === spawn.spawnId);
      if (
        generation !== this.generation
        || !currentSpawn
        || currentSpawn.presetId !== spawn.presetId
        || !this.desiredSpawnPreviewIds.has(spawn.spawnId)
      ) preview.dispose();
      else this.spawnPreviews.set(spawn.spawnId, preview);
      this.lastError = null;
      return preview;
    }).catch((error) => {
      this.lastError = error instanceof Error ? error.message : String(error);
      return null;
    }).finally(() => this.pendingPreviews.delete(spawn.spawnId));
    this.pendingPreviews.set(spawn.spawnId, promise);
    return promise;
  }

  pickCenter(camera = this.camera) {
    if (!camera) return null;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = this.raycaster.intersectObjects([...this.markers.values()].map((record) => record.pick), false);
    return hits[0]?.object?.userData?.spawnId ?? null;
  }

  update(deltaSeconds) {
    this.spawnPreviews.forEach((preview) => preview.update(deltaSeconds));
    this.placementPreview?.update?.(deltaSeconds);
    this.elapsedSinceBudget += deltaSeconds;
    if (this.elapsedSinceBudget >= 0.5) {
      this.elapsedSinceBudget = 0;
      void this.reconcilePreviewBudget();
    }
  }

  disposePlacementPreview() {
    this.placementPreview?.dispose?.();
    this.placementPreview = null;
  }

  clearWorldVisuals() {
    this.generation += 1;
    this.markers.forEach(disposeMarker);
    this.markers.clear();
    this.spawnPreviews.forEach((preview) => preview.dispose());
    this.spawnPreviews.clear();
    this.pendingPreviews.clear();
    this.desiredSpawnPreviewIds.clear();
    this.disposePlacementPreview();
    this.radiusRing?.removeFromParent?.();
    this.radiusRing?.geometry?.dispose?.();
    this.radiusRing?.material?.dispose?.();
    this.radiusRing = null;
  }

  getDiagnostics() {
    return {
      markerCount: this.markers.size,
      fullSpawnPreviewCount: this.spawnPreviews.size,
      hasPlacementPreview: Boolean(this.placementPreview),
      maximumPreviewBodies: this.maxPreviewBodies,
      totalFullPreviewCount: this.spawnPreviews.size + (this.placementPreview ? 1 : 0),
      selectedSpawnId: this.selectedSpawnId,
      combatRouterRegistrations: 0,
      combatColliderCount: 0,
      playerBlockerCount: 0,
      lastError: this.lastError,
      disposed: this.disposed,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.clearWorldVisuals();
    this.scene = null;
    this.camera = null;
    this.playerProvider = null;
    this.draft = null;
    this.disposed = true;
  }
}
