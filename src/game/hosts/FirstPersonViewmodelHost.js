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
import { SwordWorldWeaponController } from '../combat/weapons/SwordWorldWeaponController.js';
import { MaceWorldWeaponController } from '../combat/weapons/MaceWorldWeaponController.js';

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
    this.torchViewmodel = new TorchViewmodel({
      camera: this.camera,
      equipmentRuntime: this.equipmentRuntime,
      combatActorProvider: () => this.getTorchCombatActor(),
      darknessProvider: () => this.getTorchDarknessLevel(),
    });
    this.physicalToolViewmodel = new PhysicalToolViewmodel({ camera: this.camera, equipmentRuntime: this.equipmentRuntime });
    this.initializeCombatKnifeRuntime();
    this.toolInputViewmodel = this.createToolInputViewmodel();
    this.offhandAimController = new OffhandAimController({ app: this.app, viewmodels: [this.torchViewmodel, this.keepersLanternViewmodel] });
    this.sceneSessionHost?.setLanternRevealEmitterProvider?.(() => this.getKeeperLanternEmitter());
    this.castingController = new CastingController({ app: this.app, camera: this.camera, player: this.player, dungeon: this.dungeon, hud: this.hud, rodView: this.fishingRodView, equipmentRuntime: this.equipmentRuntime, feedback: this.feedback });
    this.physicalToolActionController = this.dungeon?.isCombatLab ? null : new PhysicalToolActionController({
      app: this.app,
      camera: this.camera,
      player: this.player,
      dungeon: this.dungeon,
      equipmentRuntime: this.equipmentRuntime,
      viewmodel: this.toolInputViewmodel,
      feedback: this.feedback,
      controls: this.controls,
      audioRuntime: this.audioRuntime,
    });

    this.disposers.push(this.equipmentRuntime?.on?.(EQUIPMENT_EVENTS.equippedChanged, (equipmentState) => this.handleEquipmentChanged(equipmentState)));
    this.syncEquipmentVisuals();
    return this.getDebugSummary();
  }

  rebindSession(session = this.sceneSessionHost) {
    this.session = session;
    this.camera = session?.camera;
    this.player = session?.player;
    this.dungeon = session?.dungeon;
    this.combatKnifeController?.dispose?.();
    this.combatSwordController?.dispose?.();
    this.combatMaceController?.dispose?.();
    this.combatKnifeController = null;
    this.combatSwordController = null;
    this.combatMaceController = null;
    this.combatWeaponController = null;
    this.combatRuntime = null;
    this.combatActivationProvider = null;
    if (this.fishingRodView) this.fishingRodView.dungeon = this.dungeon;
    this.keepersLanternViewmodel?.rebind?.({ camera: this.camera, player: this.player });
    this.torchViewmodel?.rebind?.({ camera: this.camera });
    this.physicalToolViewmodel?.rebind?.({ camera: this.camera });
    this.physicalToolActionController?.rebindSession?.({ camera: this.camera, player: this.player, dungeon: this.dungeon });
    this.castingController?.rebindSession?.({ player: this.player, dungeon: this.dungeon });
    this.initializeCombatKnifeRuntime();
    this.syncEquipmentVisuals();
    return this.getDebugSummary();
  }

  initializeCombatKnifeRuntime() {
    const combatRuntime = this.dungeon?.isCombatLab ? this.dungeon : this.dungeon?.combatEncounter;
    const contactActivationProvider = this.dungeon?.isCombatLab ? () => true : combatRuntime ? () => combatRuntime.isPlayerInCombatRange(this.player) : () => false;
    this.combatKnifeController = new WorldKnifeCombatController({ app: this.app, scene: combatRuntime?.scene ?? this.dungeon?.scene, camera: this.camera, player: this.player, actor: combatRuntime?.actor ?? null, physics: combatRuntime?.physics ?? null, equipmentRuntime: this.equipmentRuntime, controls: this.controls, feedback: this.feedback, feedbackSystem: combatRuntime?.feedbackSystem ?? null, bloodEffects: combatRuntime?.bloodEffects ?? null, combatDirector: combatRuntime?.combatDirector ?? null, combatRouter: combatRuntime?.combatRouter ?? null, contactActivationProvider, outdoorLightingDirector: this.dungeon?.outdoorLightingDirector ?? null, bindPointerInput: this.dungeon?.isCombatLab === true });
    this.combatSwordController = new SwordWorldWeaponController({ app: this.app, scene: combatRuntime?.scene ?? this.dungeon?.scene, camera: this.camera, player: this.player, actor: combatRuntime?.actor ?? null, physics: combatRuntime?.physics ?? null, equipmentRuntime: this.equipmentRuntime, controls: this.controls, feedback: this.feedback, feedbackSystem: combatRuntime?.feedbackSystem ?? null, combatDirector: combatRuntime?.combatDirector ?? null, combatRouter: combatRuntime?.combatRouter ?? null, contactActivationProvider, outdoorLightingDirector: this.dungeon?.outdoorLightingDirector ?? null, bindPointerInput: true });
    this.combatMaceController = this.dungeon?.isCombatLab === true
      ? new MaceWorldWeaponController({ app: this.app, scene: combatRuntime?.scene ?? this.dungeon?.scene, camera: this.camera, player: this.player, actor: combatRuntime?.actor ?? null, physics: combatRuntime?.physics ?? null, equipmentRuntime: this.equipmentRuntime, controls: this.controls, feedback: this.feedback, feedbackSystem: combatRuntime?.feedbackSystem ?? null, combatDirector: combatRuntime?.combatDirector ?? null, combatRouter: combatRuntime?.combatRouter ?? null, contactActivationProvider, outdoorLightingDirector: this.dungeon?.outdoorLightingDirector ?? null, bindPointerInput: true })
      : null;
    const controllers = [this.combatKnifeController, this.combatSwordController, this.combatMaceController].filter(Boolean);
    const active = () => controllers.find((controller) => controller?.isEquipped?.()) ?? this.combatKnifeController;
    this.combatWeaponController = {
      get penetrationAudioGate() { return active()?.penetrationAudioGate ?? null; },
      beforePhysics: (dt) => controllers.forEach((controller) => controller?.beforePhysics?.(dt)),
      afterPhysicsStep: (dt) => controllers.forEach((controller) => controller?.afterPhysicsStep?.(dt)),
      afterPhysics: (alpha) => controllers.forEach((controller) => controller?.afterPhysics?.(alpha)),
      cancel: (reason) => controllers.forEach((controller) => controller?.cancel?.(reason)),
      reset: () => controllers.forEach((controller) => controller?.reset?.()),
      cancelTarget: (actor, reason) => controllers.forEach((controller) => controller?.cancelTarget?.(actor, reason)),
      nudgeExtension: (delta) => active()?.nudgeExtension?.(delta),
      nudgeAim: (deltaX, deltaY) => active()?.nudgeAim?.(deltaX, deltaY),
      setDebugVisible: (visible) => controllers.forEach((controller) => controller?.setDebugVisible?.(visible)),
      getDiagnostics: () => ({ active: active()?.getDiagnostics?.() ?? null, knife: this.combatKnifeController?.getDiagnostics?.() ?? null, sword: this.combatSwordController?.getDiagnostics?.() ?? null, mace: this.combatMaceController?.getDiagnostics?.() ?? null }),
    };
    combatRuntime?.attachWeaponController?.(this.combatWeaponController);
    this.combatRuntime = combatRuntime;
  }

  createToolInputViewmodel() {
    const active = () => this.combatMaceController?.isEquipped?.()
      ? this.combatMaceController
      : this.combatSwordController?.isEquipped?.()
        ? this.combatSwordController
        : this.combatKnifeController?.isEquipped?.() ? this.combatKnifeController : this.physicalToolViewmodel;
    return {
      getActiveToolId: () => active()?.getActiveToolId?.() ?? null,
      projectGrabHit: (...args) => active()?.projectGrabHit?.(...args) ?? false,
      getProjectedGrabPoint: (...args) => active()?.getProjectedGrabPoint?.(...args) ?? null,
      getProjectedActivePoint: (...args) => active()?.getProjectedActivePoint?.(...args) ?? null,
      setGestureState: (gesture) => active()?.setGestureState?.(gesture),
      impact: (context) => active()?.impact?.(context),
    };
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
    if (!this.combatRuntime) {
      this.combatKnifeController?.beforePhysics?.(deltaSeconds);
      this.combatKnifeController?.afterPhysics?.();
      this.combatSwordController?.beforePhysics?.(deltaSeconds);
      this.combatSwordController?.afterPhysics?.();
      this.combatMaceController?.beforePhysics?.(deltaSeconds);
      this.combatMaceController?.afterPhysics?.();
    }
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

  getTorchCombatActor() {
    const runtime = this.dungeon?.isCombatLab ? this.dungeon : this.dungeon?.combatEncounter;
    return runtime?.disposed === true ? null : runtime?.getPriorityCombatActor?.(this.player) ?? runtime?.actor ?? null;
  }

  getTorchDarknessLevel() {
    const outdoorLevel = this.dungeon?.outdoorLightingDirector?.debug?.torchNeedLevel;
    if (Number.isFinite(outdoorLevel)) return outdoorLevel;
    if (this.dungeon?.isCombatLab) return this.dungeon.night === true || this.dungeon.lightingMode?.startsWith?.('night') ? 1 : 0;
    return 0;
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
      physicalToolId: this.toolInputViewmodel?.getActiveToolId?.() ?? null,
      combatKnife: this.combatKnifeController?.getDiagnostics?.() ?? null,
      combatSword: this.combatSwordController?.getDiagnostics?.() ?? null,
      combatMace: this.combatMaceController?.getDiagnostics?.() ?? null,
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
    this.combatSwordController?.dispose?.();
    this.combatMaceController?.dispose?.();
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
    this.combatSwordController = null;
    this.combatMaceController = null;
    this.combatWeaponController = null;
    this.combatRuntime = null;
    this.toolInputViewmodel = null;
    this.physicalToolViewmodel = null;
    this.keepersLanternViewmodel = null;
    this.session = null;
  }
}
