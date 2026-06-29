import * as THREE from 'three';
import { EQUIPMENT_EVENTS } from '../../engine/equipment/EquipmentEvents.js';
import { CastingController } from '../fishing/CastingController.js';
import { FishingRodView } from '../fishing/FishingRodView.js';

const PLAYER_TORCH_POINT_LIGHT = Object.freeze({
  color: 0xffb066,
  intensity: 6.8,
  distance: 36,
  decay: 1.3,
});

const PLAYER_TORCH_SPOT_LIGHT = Object.freeze({
  color: 0xffc078,
  intensity: 7.2,
  distance: 56,
  angle: 0.78,
  penumbra: 0.82,
  decay: 1.25,
});

export class FirstPersonViewmodelHost {
  constructor({ app, sceneSessionHost, equipmentRuntime, inventoryBridge = null, gameState = null, hudHost = null, inputHost = null, feedback = null } = {}) {
    this.app = app;
    this.sceneSessionHost = sceneSessionHost;
    this.equipmentRuntime = equipmentRuntime;
    this.inventoryBridge = inventoryBridge;
    this.gameState = gameState;
    this.hudHost = hudHost;
    this.inputHost = inputHost;
    this.feedback = feedback;
    this.session = null;
    this.playerTorchElapsed = 0;
    this.disposers = [];
  }

  initializeForSession(session = this.sceneSessionHost) {
    this.session = session;
    this.camera = session?.camera;
    this.player = session?.player;
    this.dungeon = session?.dungeon;
    this.hud = this.hudHost?.hud;
    this.controls = this.inputHost?.controls;

    this.createPlayerTorchLight();
    this.fishingRodView = new FishingRodView({ camera: this.camera, equipmentRuntime: this.equipmentRuntime, gameState: this.gameState, dungeon: this.dungeon });
    this.castingController = new CastingController({ app: this.app, camera: this.camera, player: this.player, dungeon: this.dungeon, hud: this.hud, rodView: this.fishingRodView, equipmentRuntime: this.equipmentRuntime, feedback: this.feedback });

    this.disposers.push(this.equipmentRuntime?.on?.(EQUIPMENT_EVENTS.equippedChanged, (equipmentState) => this.handleEquipmentChanged(equipmentState)));
    this.syncEquipmentVisuals();
    return this.getDebugSummary();
  }

  syncEquipmentVisuals() {
    this.setPlayerTorchEnabled(this.equipmentRuntime?.getEquippedOffhandId?.() === 'torch');
  }

  handleEquipmentChanged(equipmentState = {}, context = {}) {
    if (equipmentState.slotId === 'offhand' || context.force === true) this.syncEquipmentVisuals();
  }

  update(deltaSeconds, context = {}) {
    this.fishingRodView?.update(deltaSeconds, this.castingController?.state);
    this.castingController?.update(deltaSeconds);
    this.updatePlayerTorchLight(deltaSeconds);
    return this.getDebugSummary(context);
  }

  updateDebugHud(player = this.player) {
    this.hudHost?.hud?.updateDebug(player, this.castingController?.debug);
  }

  createPlayerTorchLight() {
    if (!this.camera || this.playerTorch) return;
    this.playerTorch = new THREE.Group();
    this.playerTorch.position.set(-0.42, -0.28, -0.82);
    this.playerTorchPointLight = new THREE.PointLight(
      PLAYER_TORCH_POINT_LIGHT.color,
      PLAYER_TORCH_POINT_LIGHT.intensity,
      PLAYER_TORCH_POINT_LIGHT.distance,
      PLAYER_TORCH_POINT_LIGHT.decay,
    );
    this.playerTorchPointLight.castShadow = false;
    this.playerTorchPointLight.position.set(-0.18, -0.08, -0.18);
    this.playerTorchSpotLight = new THREE.SpotLight(
      PLAYER_TORCH_SPOT_LIGHT.color,
      PLAYER_TORCH_SPOT_LIGHT.intensity,
      PLAYER_TORCH_SPOT_LIGHT.distance,
      PLAYER_TORCH_SPOT_LIGHT.angle,
      PLAYER_TORCH_SPOT_LIGHT.penumbra,
      PLAYER_TORCH_SPOT_LIGHT.decay,
    );
    this.playerTorchSpotLight.castShadow = false;
    this.playerTorchSpotLight.position.set(-0.1, -0.08, -0.12);
    this.playerTorchSpotLight.target.position.set(-0.25, -0.16, -6);
    this.playerTorch.add(this.playerTorchPointLight, this.playerTorchSpotLight, this.playerTorchSpotLight.target);
    this.playerTorch.visible = false;
    this.camera.add(this.playerTorch);
  }

  setPlayerTorchEnabled(enabled) {
    if (this.playerTorch) this.playerTorch.visible = Boolean(enabled);
  }

  updatePlayerTorchLight(deltaSeconds) {
    if (!this.playerTorch?.visible) return;
    this.playerTorchElapsed += deltaSeconds;
    const flicker = 0.97 + Math.sin(this.playerTorchElapsed * 6.7) * 0.02 + Math.sin(this.playerTorchElapsed * 11.3) * 0.012;
    this.playerTorchPointLight.intensity = PLAYER_TORCH_POINT_LIGHT.intensity * flicker;
    this.playerTorchSpotLight.intensity = PLAYER_TORCH_SPOT_LIGHT.intensity * (0.985 + (flicker - 0.97) * 0.55);
  }

  getDebugSummary() {
    return {
      hasFishingRodView: Boolean(this.fishingRodView),
      hasCastingController: Boolean(this.castingController),
      torchVisible: this.playerTorch?.visible === true,
      fishing: this.castingController?.debug ?? null,
    };
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose?.());
    this.disposers = [];
    this.camera?.remove?.(this.playerTorch);
    this.playerTorch = null;
    this.playerTorchPointLight = null;
    this.playerTorchSpotLight = null;
    this.session = null;
  }
}
