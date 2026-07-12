import * as THREE from 'three';
import { EQUIPMENT_EVENTS } from '../../engine/equipment/EquipmentEvents.js';
import { CastingController } from '../fishing/CastingController.js';
import { FishingRodView, HELD_ROD_VIEWMODEL_LAYER } from '../fishing/FishingRodView.js';
import { KEEPERS_LANTERN_EMITTER, KeepersLanternViewmodel } from '../viewmodels/KeepersLanternViewmodel.js';
import { OffhandAimController } from '../viewmodels/OffhandAimController.js';
import { TorchViewmodel } from '../viewmodels/TorchViewmodel.js';
import { PhysicalToolActionController } from '../physical-tools/PhysicalToolActionController.js';
import { PhysicalToolViewmodel } from '../physical-tools/PhysicalToolViewmodel.js';
import { WorldKnifeCombatController } from '../combat/WorldKnifeCombatController.js';

const ROD_VIEWMODEL_LIGHTING = Object.freeze({
  skyColor: 0xffe2b8,
  groundColor: 0x60452f,
  hemisphereIntensity: 1.35,
  keyColor: 0xffd0a0,
  keyIntensity: 2.1,
});

export class FirstPersonViewmodelHost {
  constructor({ app, sceneSessionHost, equipmentRuntime, inventoryBridge = null, gameState = null, hudHost = null, inputHost = null, feedback = null, audioRuntime = null } = {}) {
    this.app = app;
    this.sceneSessionHost = sceneSessionHost;
    this.equipmentRuntime = equipmentRuntime;
    this.inventoryBridge = inventoryBridge;
    this.gameState = gameState;
    this.hudHost = hudHost;
    this.inputHost = inputHost;
    this.feedback = feedback;
    this.audioRuntime = audioRuntime;
    this.session = null;
    this.disposers = [];
  }

  initializeForSession(session = this.sceneSessionHost) {
    this.session = session;
    this.camera = session?.camera;
    this.player = session?.player;
    this.dungeon = session?.dungeon;
    this.hud = this.hudHost?.hud;
    this.controls = this.inputHost?.controls;

    this.createRodViewmodelLights();
    this.fishingRodView = new FishingRodView({ camera: this.camera, equipmentRuntime: this.equipmentRuntime, gameState: this.gameState, dungeon: this.dungeon });
    this.keepersLanternViewmodel = new KeepersLanternViewmodel({ camera: this.camera, equipmentRuntime: this.equipmentRuntime, player: this.player });
    this.torchViewmodel = new TorchViewmodel({ camera: this.camera, equipmentRuntime: this.equipmentRuntime });
    this.physicalToolViewmodel = new PhysicalToolViewmodel({ camera: this.camera, equipmentRuntime: this.equipmentRuntime });
    this.offhandAimController = new OffhandAimController({ app: this.app, viewmodels: [this.torchViewmodel, this.keepersLanternViewmodel] });
    this.sceneSessionHost?.setLanternRevealEmitterProvider?.(() => this.getKeeperLanternEmitter());
    this.castingController = new CastingController({ app: this.app, camera: this.camera, player: this.player, dungeon: this.dungeon, hud: this.hud, rodView: this.fishingRodView, equipmentRuntime: this.equipmentRuntime, feedback: this.feedback });
    this.physicalToolActionController = this.dungeon?.isCombatLab ? null : new PhysicalToolActionController({
      app: this.app,
      camera: this.camera,
      player: this.player,
      dungeon: this.dungeon,
      equipmentRuntime: this.equipmentRuntime,
      viewmodel: this.physicalToolViewmodel,
      feedback: this.feedback,
      controls: this.controls,
      audioRuntime: this.audioRuntime,
    });
    if (this.dungeon?.isCombatLab) {
      this.physicalToolViewmodel.setCombatKnifeActive(true);
      this.combatKnifeController = new WorldKnifeCombatController({
        app: this.app,
        scene: this.dungeon.scene,
        camera: this.camera,
        player: this.player,
        actor: this.dungeon.actor,
        physics: this.dungeon.physics,
        equipmentRuntime: this.equipmentRuntime,
        controls: this.controls,
        feedback: this.feedback,
      });
      this.dungeon.attachWeaponController(this.combatKnifeController);
    }

    this.disposers.push(this.equipmentRuntime?.on?.(EQUIPMENT_EVENTS.equippedChanged, (equipmentState) => this.handleEquipmentChanged(equipmentState)));
    this.syncEquipmentVisuals();
    return this.getDebugSummary();
  }

  rebindSession(session = this.sceneSessionHost) {
    this.session = session;
    this.camera = session?.camera;
    this.player = session?.player;
    this.dungeon = session?.dungeon;
    if (this.fishingRodView) this.fishingRodView.dungeon = this.dungeon;
    this.keepersLanternViewmodel?.rebind?.({ camera: this.camera, player: this.player });
    this.torchViewmodel?.rebind?.({ camera: this.camera });
    this.physicalToolViewmodel?.rebind?.({ camera: this.camera });
    this.physicalToolActionController?.rebindSession?.({ camera: this.camera, player: this.player, dungeon: this.dungeon });
    this.castingController?.rebindSession?.({ player: this.player, dungeon: this.dungeon });
    this.syncEquipmentVisuals();
    return this.getDebugSummary();
  }

  syncEquipmentVisuals() {
    this.torchViewmodel?.update?.(0.001);
    this.keepersLanternViewmodel?.update?.(0.001);
  }

  handleEquipmentChanged(equipmentState = {}, context = {}) {
    if (equipmentState.slotId === 'offhand' || context.force === true) this.syncEquipmentVisuals();
  }

  update(deltaSeconds, context = {}) {
    this.fishingRodView?.update(deltaSeconds, this.castingController?.state);
    this.offhandAimController?.update(deltaSeconds);
    this.keepersLanternViewmodel?.update(deltaSeconds);
    this.torchViewmodel?.update(deltaSeconds);
    this.physicalToolViewmodel?.update(deltaSeconds);
    this.physicalToolActionController?.update(deltaSeconds);
    this.castingController?.update(deltaSeconds);
    return this.getDebugSummary(context);
  }

  updateDebugHud(player = this.player) {
    this.hudHost?.hud?.updateDebug(player, this.castingController?.debug);
  }

  getKeeperLanternEmitter(targets) {
    return this.keepersLanternViewmodel?.getEmitterState?.(targets) ?? {
      active: false,
      available: false,
      itemId: 'keepers_lantern',
      worldPosition: new THREE.Vector3(),
      worldDirection: new THREE.Vector3(0, 0, -1),
      coneAngleDegrees: KEEPERS_LANTERN_EMITTER.coneAngleDegrees,
      range: KEEPERS_LANTERN_EMITTER.range,
      source: 'unavailable',
    };
  }

  getTorchLightingState() {
    return this.torchViewmodel?.getLightingState?.() ?? { owned: false, equipped: false, lit: false, active: false, intensity: 0, range: 0, castShadow: false };
  }

  createRodViewmodelLights() {
    if (!this.camera || this.rodViewmodelLights) return;
    this.rodViewmodelLights = new THREE.Group();
    this.rodViewmodelLights.name = 'rod-a1-viewmodel-lighting';
    this.rodViewmodelLights.layers.set(HELD_ROD_VIEWMODEL_LAYER);

    this.rodViewmodelHemisphereLight = new THREE.HemisphereLight(
      ROD_VIEWMODEL_LIGHTING.skyColor,
      ROD_VIEWMODEL_LIGHTING.groundColor,
      ROD_VIEWMODEL_LIGHTING.hemisphereIntensity,
    );
    this.rodViewmodelKeyLight = new THREE.DirectionalLight(
      ROD_VIEWMODEL_LIGHTING.keyColor,
      ROD_VIEWMODEL_LIGHTING.keyIntensity,
    );
    this.rodViewmodelKeyLight.position.set(-0.8, 0.9, 0.7);
    this.rodViewmodelKeyLight.target.position.set(0.35, -0.25, -3.5);
    this.rodViewmodelKeyLight.castShadow = false;

    this.rodViewmodelLights.add(this.rodViewmodelHemisphereLight, this.rodViewmodelKeyLight, this.rodViewmodelKeyLight.target);
    this.rodViewmodelLights.traverse((child) => child.layers?.set?.(HELD_ROD_VIEWMODEL_LAYER));
    this.camera.add(this.rodViewmodelLights);
  }

  getDebugSummary() {
    return {
      hasFishingRodView: Boolean(this.fishingRodView),
      hasCastingController: Boolean(this.castingController),
      torchVisible: this.torchViewmodel?.root?.visible === true,
      keepersLanternActive: this.keepersLanternViewmodel?.isActive?.() === true,
      fishing: this.castingController?.debug ?? null,
      physicalToolId: this.physicalToolViewmodel?.getActiveToolId?.() ?? null,
      combatKnife: this.combatKnifeController?.getDiagnostics?.() ?? null,
    };
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose?.());
    this.disposers = [];
    this.camera?.remove?.(this.rodViewmodelLights);
    this.offhandAimController?.dispose?.();
    this.torchViewmodel?.dispose?.();
    this.physicalToolActionController?.dispose?.();
    this.combatKnifeController?.dispose?.();
    this.physicalToolViewmodel?.dispose?.();
    this.keepersLanternViewmodel?.dispose?.();
    this.sceneSessionHost?.setLanternRevealEmitterProvider?.(null);
    this.rodViewmodelLights = null;
    this.rodViewmodelHemisphereLight = null;
    this.rodViewmodelKeyLight = null;
    this.offhandAimController = null;
    this.torchViewmodel = null;
    this.physicalToolActionController = null;
    this.combatKnifeController = null;
    this.physicalToolViewmodel = null;
    this.keepersLanternViewmodel = null;
    this.session = null;
  }
}
