import * as THREE from 'three';
import { HumanoidGlbVisualAdapter } from '../../combat/HumanoidGlbVisualAdapter.js';
import { RuntimeAttachmentSocketResolver } from '../../combat/RuntimeAttachmentSocketResolver.js';

function materialsOf(material) {
  return (Array.isArray(material) ? material : [material]).filter(Boolean);
}

class VisualOnlyCreatureBody {
  constructor({ scene, profile, position, yaw = 0 } = {}) {
    this.scene = scene;
    this.physics = null;
    this.bodies = new Map();
    this.woundSystem = null;
    this.ragdollActive = false;
    this.lifeState = 'alive';
    this.disposed = false;
    this.spawnYaw = yaw;
    this.visualRootYaw = yaw;
    this.visualRootPosition = new THREE.Vector3().fromArray(position ?? [0, 0, 0]);
    this.root = new THREE.Group();
    this.root.name = 'encounter-authoring-visual-only-creature';
    this.root.userData.devOnly = true;
    this.root.userData.encounterAuthoringPreview = true;
    scene.add(this.root);
    this.visualAdapter = new HumanoidGlbVisualAdapter({
      actor: this,
      parent: this.root,
      profile,
      isolateMaterials: true,
      visualOnly: true,
    });
    this.ready = this.visualAdapter.ready.then(() => {
      if (!this.disposed) this.setTransform(position, yaw);
      return this;
    });
  }

  setAnimationAuthorityReady() {}
  syncAnimationProxyBodies() {}

  setTransform(position, yaw = this.visualRootYaw) {
    if (this.disposed) return false;
    if (Array.isArray(position)) this.visualRootPosition.fromArray(position);
    else if (position?.isVector3) this.visualRootPosition.copy(position);
    this.visualRootYaw = Number.isFinite(yaw) ? yaw : this.visualRootYaw;
    this.visualAdapter?.setAuthoritativeTransform?.(this.visualRootPosition, this.visualRootYaw);
    return true;
  }

  update(deltaSeconds) {
    if (this.disposed) return;
    if (this.visualAdapter?.profile?.animationAuthoritative) this.visualAdapter.updateAnimationAuthority(deltaSeconds);
    else if (this.visualAdapter?.profile?.restPoseAuthoritative) this.visualAdapter.updateRestPoseAuthority(deltaSeconds);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.visualAdapter?.dispose?.();
    this.root.removeFromParent();
  }
}

export function createVisualOnlyCreatureBody(options) {
  return new VisualOnlyCreatureBody(options);
}

export class EncounterAuthoringPresetPreview {
  static async create({
    presetId,
    scene,
    position = [0, 0, 0],
    yaw = 0,
    enemyPresetResolver,
    bodyFactory = createVisualOnlyCreatureBody,
    selected = false,
  } = {}) {
    if (!enemyPresetResolver?.resolve) throw new Error('Visual authoring preview requires EnemyPresetResolver.');
    const resolvedPreset = await enemyPresetResolver.resolve(presetId);
    const body = await bodyFactory({ scene, profile: resolvedPreset.profile, position, yaw, resolvedPreset });
    await (body.ready ?? body.visualAdapter?.ready);
    if (body.disposed) throw new Error('Visual-only preview body was disposed before it became ready.');

    const weaponRegistry = enemyPresetResolver.weaponRegistry;
    let attachmentResolver = null;
    let weaponVisual = null;
    try {
      weaponVisual = await weaponRegistry.createVisual(resolvedPreset.weapon);
      attachmentResolver = new RuntimeAttachmentSocketResolver({ visualAdapter: body.visualAdapter });
      attachmentResolver.resolve(resolvedPreset.attachmentSocket);
      attachmentResolver.attachWeapon(
        weaponVisual,
        resolvedPreset.weapon.gripTransform,
        resolvedPreset.weapon.assetScale,
      );
      const preview = new EncounterAuthoringPresetPreview({
        presetId,
        resolvedPreset,
        body,
        weaponRegistry,
        weaponVisual,
        attachmentResolver,
      });
      preview.captureMaterialBaselines();
      preview.setSelected(selected);
      return preview;
    } catch (error) {
      attachmentResolver?.dispose?.();
      if (weaponVisual) weaponRegistry?.disposeVisual?.(weaponVisual);
      body?.dispose?.();
      throw error;
    }
  }

  constructor({ presetId, resolvedPreset, body, weaponRegistry, weaponVisual, attachmentResolver } = {}) {
    this.presetId = presetId;
    this.resolvedPreset = resolvedPreset;
    this.body = body;
    this.root = body.root;
    this.weaponRegistry = weaponRegistry;
    this.weaponVisual = weaponVisual;
    this.attachmentResolver = attachmentResolver;
    this.materialBaselines = new Map();
    this.selected = false;
    this.disposed = false;
  }

  captureMaterialBaselines() {
    this.root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = false;
      object.receiveShadow = false;
      materialsOf(object.material).forEach((material) => {
        if (this.materialBaselines.has(material)) return;
        this.materialBaselines.set(material, {
          opacity: material.opacity,
          transparent: material.transparent,
          depthWrite: material.depthWrite,
          color: material.color?.clone?.() ?? null,
          emissive: material.emissive?.clone?.() ?? null,
          emissiveIntensity: material.emissiveIntensity,
        });
      });
    });
  }

  setSelected(selected) {
    this.selected = selected === true;
    this.materialBaselines.forEach((baseline, material) => {
      material.transparent = true;
      material.opacity = this.selected ? 0.62 : 0.38;
      material.depthWrite = false;
      if (baseline.color && material.color) {
        material.color.copy(baseline.color).lerp(new THREE.Color(this.selected ? 0xe6d28e : 0x7ea6a0), this.selected ? 0.35 : 0.42);
      }
      if (baseline.emissive && material.emissive) {
        material.emissive.copy(baseline.emissive).lerp(new THREE.Color(this.selected ? 0x665322 : 0x183b39), 0.6);
        material.emissiveIntensity = this.selected ? 0.45 : 0.28;
      }
      material.needsUpdate = true;
    });
  }

  setTransform(position, yaw) { this.body.setTransform(position, yaw); }
  update(deltaSeconds) { this.body.update(deltaSeconds); }

  getDiagnostics() {
    return {
      presetId: this.presetId,
      creatureDefinitionId: this.resolvedPreset?.definition?.definitionId ?? null,
      targetHeight: this.resolvedPreset?.profile?.targetHeight ?? null,
      weaponId: this.resolvedPreset?.weapon?.weaponId ?? null,
      weaponScale: this.resolvedPreset?.weapon?.assetScale ?? null,
      gripTransform: structuredClone(this.resolvedPreset?.weapon?.gripTransform ?? null),
      attachmentSocketId: this.resolvedPreset?.attachmentSocket?.socketId ?? null,
      hasCombatBrain: false,
      hasLootRuntime: false,
      combatRouterRegistered: false,
      hasCombatColliders: false,
      blocksPlayer: false,
      canDamagePlayer: false,
      selected: this.selected,
      disposed: this.disposed,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.attachmentResolver?.dispose?.();
    this.attachmentResolver = null;
    this.weaponRegistry?.disposeVisual?.(this.weaponVisual);
    this.weaponVisual = null;
    this.body?.dispose?.();
    this.body = null;
    this.root = null;
    this.materialBaselines.clear();
  }
}
