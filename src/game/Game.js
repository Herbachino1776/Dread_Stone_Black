import * as THREE from 'three';
import { Combat } from './Combat.js';
import { FishingRodView } from './fishing/FishingRodView.js';
import { CastingController } from './fishing/CastingController.js';
import { DungeonScene } from './DungeonScene.js';
import { EQUIPMENT_EVENTS } from '../engine/equipment/EquipmentEvents.js';
import { EquipmentRuntime } from '../engine/equipment/EquipmentRuntime.js';
import { ObjectiveRuntime } from '../engine/objectives/ObjectiveRuntime.js';
import { OBJECTIVE_EVENTS } from '../engine/objectives/ObjectiveEvents.js';
import { Feedback } from './Feedback.js';
import { EquipmentPanel } from './equipment/EquipmentPanel.js';
import { SurvivalInventoryBridge } from './equipment/SurvivalInventoryBridge.js';
import { equipmentRegistry } from './equipment/equipmentRegistry.js';
import { startingEquipment } from './equipment/startingEquipment.js';
import { HudHost } from './hosts/HudHost.js';
import { InputHost } from './hosts/InputHost.js';
import { RendererHost } from './hosts/RendererHost.js';
import { SaveHost } from './hosts/SaveHost.js';
import { Interactions } from './Interactions.js';
import { PerfDebugPanel } from './PerfDebugPanel.js';
import { PlayerController } from './PlayerController.js';
import { BroadswordView } from './weapons/BroadswordView.js';
import { BroadswordGestureController } from './weapons/BroadswordGestureController.js';
import { resolveLocationIdForArea, resolveLocationReturnSpawn, resolveStartupArea } from './locationRouting.js';
import { getLocationDefinition, loadLocationDefinition } from './locations/locationRegistry.js';
import { getObjectivePackForLocation } from './objectives/objectiveRegistry.js';
import { objectiveMessages, resolveObjectiveMessage } from './objectives/objectiveMessages.js';
import { ObjectivePanel } from './ui/ObjectivePanel.js';

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

export class Game {
  constructor(app) {
    this.app = app;
    this.clock = new THREE.Clock();
    this.lastFrame = 0;
  }

  async start() {
    try {
      await this.startUnsafe();
    } catch (error) {
      this.handleStartupError(error);
    }
  }

  async startUnsafe() {
    const query = new URLSearchParams(window.location.search);
    this.debugHudEnabled = import.meta.env.DEV && query.get('debugHud') === '1';
    this.perfDebugEnabled = query.get('perf') === '1';
    this.isPaused = false;
    this.resetConfirmTimer = null;
    this.wasKeyboardInteractHeld = false;
    this.resetConfirmExpiresAt = 0;
    this.hudHost = new HudHost({
      root: this.app,
      debugEnabled: this.debugHudEnabled,
      onPauseToggle: () => this.togglePause(),
      onResume: () => this.setPaused(false),
      onReset: () => this.requestProgressReset(),
    });
    this.rendererHost = new RendererHost({ root: this.app });
    // Compatibility references for lightweight debug helpers while Game.js is being split.
    this.canvas = this.hudHost.canvas;
    this.viewport = this.hudHost.viewport;
    this.pauseOverlay = this.hudHost.pauseOverlay;
    this.pauseButton = this.hudHost.pauseButton;
    this.resumeButton = this.hudHost.resumeButton;
    this.resetButtons = this.hudHost.resetButtons;
    this.renderer = this.rendererHost.renderer;

    const { width, height } = this.rendererHost.getViewportSize();
    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 260);
    this.rendererHost.onResize(({ width: resizeWidth, height: resizeHeight }) => {
      this.camera.aspect = resizeWidth / resizeHeight;
      this.camera.updateProjectionMatrix();
    });
    const requestedArea = query.get('area');
    const returnedFrom = query.get('from');
    const objectiveDebugUiEnabled = import.meta.env.DEV && query.get('objectiveDebug') === '1';
    const area = resolveStartupArea(requestedArea);
    const fieldSpawn = area === 'field'
      ? await resolveLocationReturnSpawn(returnedFrom)
      : 'start';
    await this.preloadStartupLocation(area);
    this.saveHost = new SaveHost();
    this.gameState = this.saveHost.loadInitialState();
    this.equipmentRuntime = new EquipmentRuntime({
      weaponProfiles: equipmentRegistry.weapons,
      startingEquipment: this.gameState.getEquipmentSnapshot() ?? startingEquipment,
    });
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.itemAcquired, () => this.saveEquipmentState());
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, ({ slotId, itemId }) => {
      this.saveEquipmentState();
      if (slotId === 'offhand') this.setPlayerTorchEnabled(itemId === 'torch');
    });
    this.survivalInventory = new SurvivalInventoryBridge({ equipmentRuntime: this.equipmentRuntime, gameState: this.gameState });
    this.dungeon = new DungeonScene({ area, fieldSpawn, gameState: this.gameState });
    this.scene = this.dungeon.build();
    this.scene.add(this.camera);
    this.locationId = this.resolveLocationId(this.dungeon.area);
    this.objectiveRuntime = this.createObjectiveRuntime();
    this.registerCurrentObjectivePack();
    this.objectiveRuntime.loadSnapshot(this.gameState.getObjectiveSnapshot());
    if (import.meta.env.DEV) {
      window.dreadStoneObjectiveRuntime = this.objectiveRuntime;
      window.dreadStoneObjectiveDebug = () => this.objectiveRuntime.getDebugInfo();
    }
    const movementProfile = getLocationDefinition(this.locationId)?.type === 'field'
      ? {
        moveSpeed: PlayerController.OUTDOOR_MOVE_SPEED,
        strafeSpeed: PlayerController.OUTDOOR_STRAFE_SPEED,
      }
      : {
        moveSpeed: PlayerController.DUNGEON_MOVE_SPEED,
        strafeSpeed: PlayerController.DUNGEON_STRAFE_SPEED,
      };
    this.player = new PlayerController(this.camera, this.dungeon.collision, {
      ...this.dungeon.playerSpawn,
      ...movementProfile,
    });
    this.hud = this.hudHost.hud;
    this.feedback = new Feedback(this.camera);
    this.objectivePanel = new ObjectivePanel({
      root: this.app,
      objectiveRuntime: this.objectiveRuntime,
      enabled: objectiveDebugUiEnabled,
    });
    this.createPlayerTorchLight();
    this.setPlayerTorchEnabled(this.equipmentRuntime.getEquippedOffhandId?.() === 'torch');
    this.inputHost = new InputHost({ root: this.app });
    this.controls = this.inputHost.controls;
    this.equipmentPanel = new EquipmentPanel({ root: this.app, equipmentRuntime: this.equipmentRuntime, gameState: this.gameState });
    this.fishingRodView = new FishingRodView({ camera: this.camera, equipmentRuntime: this.equipmentRuntime, gameState: this.gameState, dungeon: this.dungeon });
    this.broadswordView = new BroadswordView({ camera: this.camera, equipmentRuntime: this.equipmentRuntime });
    this.castingController = new CastingController({ app: this.app, camera: this.camera, player: this.player, dungeon: this.dungeon, hud: this.hud, rodView: this.fishingRodView, equipmentRuntime: this.equipmentRuntime, feedback: this.feedback });
    this.interactions = new Interactions({
      player: this.player,
      dungeon: this.dungeon,
      hud: this.hud,
      feedback: this.feedback,
      equipmentRuntime: this.equipmentRuntime,
      objectiveRuntime: this.objectiveRuntime,
    });
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, () => this.interactions.cancelActiveTimedAction?.());
    window.addEventListener('field-item-equipped-changed', () => this.interactions.cancelActiveTimedAction?.());
    window.addEventListener('field-offhand-equipped-changed', () => this.interactions.cancelActiveTimedAction?.());
    this.broadswordGestureController = new BroadswordGestureController({ app: this.app, view: this.broadswordView, controls: this.controls, equipmentRuntime: this.equipmentRuntime });
    this.combat = new Combat({
      player: this.player,
      dungeon: this.dungeon,
      hud: this.hud,
      controls: this.controls,
      equipmentRuntime: this.equipmentRuntime,
      onAttackPerformed: ({ weaponProfile }) => {
        if (weaponProfile?.id === 'rusted_sword') this.broadswordGestureController?.notifyFallbackAttack?.('rightSlash');
      },
    });

    this.bindObjectiveEquipmentEvents();
    this.emitLocationEntered();
    this.playFieldReturnReactionIfNeeded({ query });
    if (this.perfDebugEnabled) this.perfDebugPanel = new PerfDebugPanel({ game: this });

    this.rendererHost.setAnimationLoop((time) => this.update(time));
  }

  async preloadStartupLocation(area) {
    const locationId = this.resolveLocationId(area);
    if (getLocationDefinition(locationId)) return;
    try {
      await loadLocationDefinition(locationId);
    } catch (error) {
      console.error(`[Dread Stone Black] Could not load startup location definition ${locationId}.`, error);
      throw error;
    }
  }

  handleStartupError(error) {
    console.error('[Dread Stone Black] Startup failed before the scene became playable.', error);
    this.rendererHost?.setAnimationLoop?.(null);

    if (import.meta.env.DEV) {
      if (!this.app.innerHTML) this.hudHost = new HudHost({ root: this.app, debugEnabled: this.debugHudEnabled });
      const viewport = this.hudHost?.viewport ?? this.app.querySelector('[data-game="viewport"]');
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.style.cssText = 'position:absolute;inset:auto 1rem 1rem 1rem;z-index:20;margin:0;padding:0.75rem;background:rgba(32,8,8,0.92);color:#ffd8c2;border:1px solid #a45f3a;font:12px/1.4 monospace;';
      message.textContent = `Startup failed: ${error?.message ?? error}`;
      viewport?.append(message);
    }
  }

  resolveLocationId(area) {
    return resolveLocationIdForArea(area);
  }

  createObjectiveRuntime() {
    const runtime = new ObjectiveRuntime({
      context: {
        equipmentRuntime: this.equipmentRuntime,
      },
      callbacks: {
        resolveMessage: resolveObjectiveMessage,
        showToast: (message) => {
          this.objectivePanel?.showToast(message);
        },
        showLocationMessage: (message) => {
          this.objectivePanel?.showToast(message);
        },
      },
      validation: this.createObjectiveValidationContext(),
    });
    runtime.on('objectiveChanged', () => {
      this.objectivePanel?.render();
      this.saveObjectiveState();
    });
    runtime.on('objectiveEvent', () => this.saveObjectiveState());
    return runtime;
  }

  createObjectiveValidationContext() {
    const definitions = ['black-grass-temple', 'south-reliquary-crypt', 'field-keeper-house']
      .map((id) => getLocationDefinition(id))
      .filter(Boolean);
    return {
      knownInteractionIds: new Set(definitions.flatMap((definition) => (definition.interactions ?? []).map((interaction) => interaction.id))),
      knownRoomIds: new Set(definitions.flatMap((definition) => (definition.rooms ?? []).map((room) => room.id))),
      knownItemIds: new Set(Object.keys(equipmentRegistry.items ?? {})),
      knownMessageIds: new Set(Object.keys(objectiveMessages)),
    };
  }

  registerCurrentObjectivePack() {
    const locationDefinition = getLocationDefinition(this.locationId);
    const pack = getObjectivePackForLocation(this.locationId, locationDefinition?.objectivePackId);
    if (!pack) return;
    this.objectiveRuntime.registerLocationObjectives(pack.locationId, pack.definitions, {
      objectivePackId: pack.id,
      silent: pack.silent,
    });
  }

  bindObjectiveEquipmentEvents() {
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.itemAcquired, ({ item, metadata }) => {
      const payload = {
        locationId: this.locationId,
        roomId: this.currentRoomId,
        itemId: item.id,
        equipmentId: item.id,
        interactionId: metadata?.source ?? null,
        sourceId: metadata?.source ?? 'equipment',
        tags: metadata?.tags ?? [],
      };
      this.objectiveRuntime.emit(OBJECTIVE_EVENTS.itemAcquired, payload);
      this.objectiveRuntime.emit(OBJECTIVE_EVENTS.equipmentAcquired, payload);
    });
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, ({ itemId, slotId }) => {
      this.objectiveRuntime.emit(OBJECTIVE_EVENTS.equipmentEquipped, {
        locationId: this.locationId,
        roomId: this.currentRoomId,
        itemId,
        equipmentId: itemId,
        sourceId: slotId,
        tags: ['equipment'],
      });
    });
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.attackResolved, ({ weaponProfile, hit }) => {
      this.emitObjectiveCombatHit({ weaponProfile, hit });
    });
  }

  emitLocationEntered() {
    this.currentRoomId = this.dungeon.findRoomIdForPosition?.(this.player.position) ?? this.locationId;
    this.objectiveRuntime.emit(OBJECTIVE_EVENTS.locationEntered, {
      locationId: this.locationId,
      roomId: this.currentRoomId,
      tags: [this.dungeon.area],
    });
    this.objectiveRuntime.emit(OBJECTIVE_EVENTS.roomEntered, {
      locationId: this.locationId,
      roomId: this.currentRoomId,
    });
  }

  emitObjectiveCombatHit({ weaponProfile, hit }) {
    if (!hit) return;
    const goreEvent = hit.goreEvent ?? {};
    const basePayload = {
      locationId: this.locationId,
      roomId: goreEvent.roomId ?? this.currentRoomId,
      weaponId: weaponProfile?.id ?? goreEvent.weaponId,
      enemyId: goreEvent.targetId ?? null,
      targetId: goreEvent.targetId ?? null,
      species: goreEvent.species ?? goreEvent.creatureId ?? null,
      factionId: goreEvent.factionId ?? null,
      sourceId: goreEvent.sourceId ?? 'player',
      tags: ['player_attack', ...(goreEvent.tags ?? [])],
      metadata: {
        damage: hit.damage,
        remainingHealth: hit.remainingHealth,
        target: hit.target,
      },
    };
    this.objectiveRuntime.emit(OBJECTIVE_EVENTS.enemyDamaged, basePayload);
    if (hit.killed) {
      this.objectiveRuntime.emit(OBJECTIVE_EVENTS.enemyKilled, basePayload);
      if (basePayload.factionId) this.objectiveRuntime.emit(OBJECTIVE_EVENTS.factionEnemyKilled, basePayload);
    }
  }

  playFieldReturnReactionIfNeeded({ query }) {
    const returnedFromDungeon = this.dungeon.area === 'field' && query.get('from') === 'dungeon';
    if (!returnedFromDungeon || !this.gameState.hasSouthReliquaryFragment) return;

    window.setTimeout(() => {
      if (this.gameState.markFieldShrineReactionSeen()) {
        this.dungeon.awakenFieldShrine();
        this.interactions.setTemporaryHint('The field answers.', 1700);
        this.hud.showMessage('The field answers.');
        this.feedback.shake({ durationMs: 380, intensity: 0.13 });
      }
    }, 260);
  }


  createPlayerTorchLight() {
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
    this.playerTorchElapsed = (this.playerTorchElapsed ?? 0) + deltaSeconds;
    const flicker = 0.97 + Math.sin(this.playerTorchElapsed * 6.7) * 0.02 + Math.sin(this.playerTorchElapsed * 11.3) * 0.012;
    this.playerTorchPointLight.intensity = PLAYER_TORCH_POINT_LIGHT.intensity * flicker;
    this.playerTorchSpotLight.intensity = PLAYER_TORCH_SPOT_LIGHT.intensity * (0.985 + (flicker - 0.97) * 0.55);
  }

  saveEquipmentState() {
    this.saveHost.saveEquipmentState(this.gameState, this.equipmentRuntime);
  }

  saveObjectiveState() {
    this.saveHost.saveObjectiveState(this.gameState, this.objectiveRuntime);
  }

  update() {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
    this.perfDebugPanel?.update();

    if (this.isPaused) {
      this.controls.consumeAttack();
      this.controls.consumeInteract();
      this.hud.updateDebug(this.player, this.castingController?.debug, this.broadswordGestureController?.debug);
      this.rendererHost.render(this.scene, this.camera);
      return;
    }

    if (!this.combat.isPlayerDead) {
      this.player.update(deltaSeconds, this.controls);
    }
    this.dungeon.update(deltaSeconds, this.player);
    this.fishingRodView?.update(deltaSeconds, this.castingController?.state);
    this.broadswordView?.update(deltaSeconds);
    this.castingController?.update(deltaSeconds);
    this.broadswordGestureController?.update(deltaSeconds);
    this.combat.update(deltaSeconds);
    const hunger = this.gameState.updateHunger?.(deltaSeconds, { paused: this.equipmentPanel?.isOpen || this.isPaused, applyStarvationDamage: (amount) => this.combat.takeDamage?.(amount, 'Starvation') });
    if (hunger) this.hud.updateHunger?.(hunger);
    this.updatePlayerTorchLight(deltaSeconds);
    this.updateObjectiveLocationTracking(deltaSeconds);
    this.interactions.updateHint();
    const keyboardInteractHeld = this.player.keyboard?.has('KeyX') ?? false;
    const interactHeld = (this.controls.isInteractHeld?.() ?? false) || keyboardInteractHeld;
    const keyboardInteractPressed = keyboardInteractHeld && !this.wasKeyboardInteractHeld;
    this.interactions.updateTimedAction(deltaSeconds, this.equipmentPanel?.isOpen || this.isPaused || this.combat.isPlayerDead || this.controls.hasAttackQueued?.());

    if (this.controls.consumeInteract() || keyboardInteractPressed) {
      if (!this.interactions.useEquippedConsumable?.()) this.interactions.interact();
    }
    this.wasKeyboardInteractHeld = keyboardInteractHeld;

    this.hud.updateDebug(this.player, this.castingController?.debug, this.broadswordGestureController?.debug);
    this.feedback.update(deltaSeconds);
    this.rendererHost.render(this.scene, this.camera);
    this.perfDebugPanel?.render();
  }

  togglePause() {
    this.setPaused(!this.isPaused);
  }

  setPaused(isPaused) {
    this.isPaused = isPaused;
    this.hudHost?.setPaused(this.isPaused);
    if (!this.isPaused) this.clearResetConfirmation();
  }

  requestProgressReset() {
    const now = window.performance.now();
    if (now <= this.resetConfirmExpiresAt) {
      this.performProgressReset();
      return;
    }

    this.resetConfirmExpiresAt = now + 3000;
    this.setResetButtonLabels('CONFIRM');
    window.clearTimeout(this.resetConfirmTimer);
    this.resetConfirmTimer = window.setTimeout(() => this.clearResetConfirmation(), 3000);
  }

  clearResetConfirmation() {
    this.resetConfirmExpiresAt = 0;
    window.clearTimeout(this.resetConfirmTimer);
    this.resetConfirmTimer = null;
    this.wasKeyboardInteractHeld = false;
    this.setResetButtonLabels('RESET');
  }

  setResetButtonLabels(label) {
    this.hudHost?.setResetButtonLabels(label);
  }

  performProgressReset() {
    this.clearResetConfirmation();
    this.saveHost.resetAllProgress();
    window.location.reload();
  }

  updateObjectiveLocationTracking(deltaSeconds) {
    const roomId = this.dungeon.findRoomIdForPosition?.(this.player.position) ?? this.locationId;
    if (roomId && roomId !== this.currentRoomId) {
      this.currentRoomId = roomId;
      this.objectiveRuntime.emit(OBJECTIVE_EVENTS.roomEntered, {
        locationId: this.locationId,
        roomId,
      });
    }

    this.objectiveRuntime.update(deltaSeconds, {
      equipmentRuntime: this.equipmentRuntime,
      playerPosition: this.player.position,
      locationId: this.locationId,
      roomId: this.currentRoomId,
    });
  }

  getViewportSize() {
    return this.rendererHost.getViewportSize();
  }

  resize() {
    this.rendererHost.resize();
  }

}
