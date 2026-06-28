import * as THREE from 'three';
import { Combat } from './Combat.js';
import { EQUIPMENT_EVENTS } from '../engine/equipment/EquipmentEvents.js';
import { EquipmentRuntime } from '../engine/equipment/EquipmentRuntime.js';
import { Feedback } from './Feedback.js';
import { EquipmentPanel } from './equipment/EquipmentPanel.js';
import { SurvivalInventoryBridge } from './equipment/SurvivalInventoryBridge.js';
import { equipmentRegistry } from './equipment/equipmentRegistry.js';
import { startingEquipment } from './equipment/startingEquipment.js';
import { HudHost } from './hosts/HudHost.js';
import { InputHost } from './hosts/InputHost.js';
import { RendererHost } from './hosts/RendererHost.js';
import { SaveHost } from './hosts/SaveHost.js';
import { ProgressionHost } from './hosts/ProgressionHost.js';
import { SceneSessionHost } from './hosts/SceneSessionHost.js';
import { SurvivalHost } from './hosts/SurvivalHost.js';
import { FirstPersonViewmodelHost } from './hosts/FirstPersonViewmodelHost.js';
import { Interactions } from './Interactions.js';
import { PerfDebugPanel } from './PerfDebugPanel.js';

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

    const objectiveDebugUiEnabled = import.meta.env.DEV && query.get('objectiveDebug') === '1';
    this.saveHost = new SaveHost();
    this.gameState = this.saveHost.loadInitialState();
    this.equipmentRuntime = new EquipmentRuntime({
      weaponProfiles: equipmentRegistry.weapons,
      startingEquipment: this.gameState.getEquipmentSnapshot() ?? startingEquipment,
    });
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.itemAcquired, () => this.saveEquipmentState());
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, () => this.saveEquipmentState());
    this.survivalInventory = new SurvivalInventoryBridge({ equipmentRuntime: this.equipmentRuntime, gameState: this.gameState });
    this.sceneSessionHost = new SceneSessionHost({ rendererHost: this.rendererHost, gameState: this.gameState, query });
    await this.sceneSessionHost.startInitialSession();
    this.dungeon = this.sceneSessionHost.dungeon;
    this.scene = this.sceneSessionHost.scene;
    this.camera = this.sceneSessionHost.camera;
    this.player = this.sceneSessionHost.player;
    this.locationId = this.sceneSessionHost.locationId;
    this.progressionHost = new ProgressionHost({
      root: this.app,
      gameState: this.gameState,
      equipmentRuntime: this.equipmentRuntime,
      hudHost: this.hudHost,
      saveHost: this.saveHost,
      debugEnabled: objectiveDebugUiEnabled,
    });
    this.progressionHost.initializeForSession(this.sceneSessionHost);
    this.survivalHost = new SurvivalHost({
      gameState: this.gameState,
      hudHost: this.hudHost,
      saveHost: this.saveHost,
      sceneSessionHost: this.sceneSessionHost,
      inventoryBridge: this.survivalInventory,
      progressionHost: this.progressionHost,
    });
    this.survivalHost.initializeForSession(this.sceneSessionHost);
    this.objectiveRuntime = this.progressionHost.getObjectiveRuntime();
    this.hud = this.hudHost.hud;
    this.feedback = new Feedback(this.camera);
    this.inputHost = new InputHost({ root: this.app });
    this.controls = this.inputHost.controls;
    this.equipmentPanel = new EquipmentPanel({ root: this.app, equipmentRuntime: this.equipmentRuntime, gameState: this.gameState });
    this.viewmodelHost = new FirstPersonViewmodelHost({
      app: this.app,
      sceneSessionHost: this.sceneSessionHost,
      equipmentRuntime: this.equipmentRuntime,
      inventoryBridge: this.survivalInventory,
      gameState: this.gameState,
      hudHost: this.hudHost,
      inputHost: this.inputHost,
      feedback: this.feedback,
    });
    this.viewmodelHost.initializeForSession(this.sceneSessionHost);
    // Compatibility references for debug panels while Game.js continues becoming a coordinator.
    this.castingController = this.viewmodelHost.castingController;
    this.broadswordGestureController = this.viewmodelHost.broadswordGestureController;
    this.interactions = new Interactions({
      player: this.player,
      dungeon: this.dungeon,
      hud: this.hud,
      feedback: this.feedback,
      equipmentRuntime: this.equipmentRuntime,
      objectiveRuntime: this.objectiveRuntime,
      transitionToLocation: (...args) => this.sceneSessionHost.transitionToLocation(...args),
      survivalHost: this.survivalHost,
    });
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, () => this.interactions.cancelActiveTimedAction?.());
    window.addEventListener('field-item-equipped-changed', () => this.interactions.cancelActiveTimedAction?.());
    window.addEventListener('field-offhand-equipped-changed', () => this.interactions.cancelActiveTimedAction?.());
    this.combat = new Combat({
      player: this.player,
      dungeon: this.dungeon,
      hud: this.hud,
      controls: this.controls,
      equipmentRuntime: this.equipmentRuntime,
      onAttackPerformed: (context) => this.viewmodelHost?.handleAttackStarted(context),
    });
    this.survivalHost.combat = this.combat;

    this.playFieldReturnReactionIfNeeded({ query });
    if (this.perfDebugEnabled) this.perfDebugPanel = new PerfDebugPanel({ game: this });

    this.rendererHost.setAnimationLoop((time) => this.update(time));
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


  saveEquipmentState() {
    this.saveHost.saveEquipmentState(this.gameState, this.equipmentRuntime);
  }

  update() {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
    this.perfDebugPanel?.update();

    if (this.isPaused) {
      this.controls.consumeAttack();
      this.controls.consumeInteract();
      this.viewmodelHost?.updateDebugHud(this.player);
      this.sceneSessionHost.render();
      return;
    }

    this.sceneSessionHost.update(deltaSeconds, {
      controls: this.controls,
      isPaused: false,
      isPlayerDead: this.combat.isPlayerDead,
    });
    this.viewmodelHost?.update(deltaSeconds);
    this.combat.update(deltaSeconds);
    this.survivalHost?.update(deltaSeconds, {
      paused: this.isPaused,
      equipmentPanelOpen: this.equipmentPanel?.isOpen,
      isPlayerDead: this.combat.isPlayerDead,
    });
    this.progressionHost.update(deltaSeconds);
    this.interactions.updateHint();
    const keyboardInteractHeld = this.player.keyboard?.has('KeyX') ?? false;
    const interactHeld = (this.controls.isInteractHeld?.() ?? false) || keyboardInteractHeld;
    const keyboardInteractPressed = keyboardInteractHeld && !this.wasKeyboardInteractHeld;
    this.interactions.updateTimedAction(deltaSeconds, this.equipmentPanel?.isOpen || this.isPaused || this.combat.isPlayerDead || this.controls.hasAttackQueued?.());

    if (this.controls.consumeInteract() || keyboardInteractPressed) {
      if (!this.interactions.useEquippedConsumable?.()) this.interactions.interact();
    }
    this.wasKeyboardInteractHeld = keyboardInteractHeld;

    this.viewmodelHost?.updateDebugHud(this.player);
    this.feedback.update(deltaSeconds);
    this.sceneSessionHost.render();
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

  getViewportSize() {
    return this.rendererHost.getViewportSize();
  }

  resize() {
    this.rendererHost.resize();
  }

}
