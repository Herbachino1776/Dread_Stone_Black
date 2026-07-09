import * as THREE from 'three';
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
import { reloadToNewGameStartupRoute } from './startupRoute.js';
import { GameAudioRuntime } from './audio/GameAudioRuntime.js';

export class Game {
  constructor(app) {
    this.app = app;
    this.clock = new THREE.Clock();
    this.lastFrame = 0;
  }

  async start() {
    try {
      await this.startUnsafe();
      return true;
    } catch (error) {
      this.handleStartupError(error);
      return false;
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
    this.audioRuntime = new GameAudioRuntime({ root: this.app });

    const objectiveDebugUiEnabled = import.meta.env.DEV && query.get('objectiveDebug') === '1';
    this.saveHost = new SaveHost();
    this.gameState = this.saveHost.loadInitialState();
    this.equipmentRuntime = new EquipmentRuntime({
      weaponProfiles: equipmentRegistry.weapons,
      startingEquipment: this.gameState.getEquipmentSnapshot() ?? startingEquipment,
    });
    this.disposers = [];
    this.disposers.push(this.equipmentRuntime.on(EQUIPMENT_EVENTS.itemAcquired, (payload) => {
      this.saveEquipmentState();
      this.handleEquipmentAcquired(payload);
    }));
    this.disposers.push(this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, () => this.saveEquipmentState()));
    this.survivalInventory = new SurvivalInventoryBridge({ equipmentRuntime: this.equipmentRuntime, gameState: this.gameState });
    this.sceneSessionHost = new SceneSessionHost({
      rendererHost: this.rendererHost,
      gameState: this.gameState,
      query,
      audioRuntime: this.audioRuntime,
      onSessionChanged: (session) => this.handleSceneSessionChanged(session),
    });
    await this.sceneSessionHost.startInitialSession();
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
      audioRuntime: this.audioRuntime,
    });
    this.viewmodelHost.initializeForSession(this.sceneSessionHost);
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
    this.disposers.push(this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, () => this.interactions.cancelActiveTimedAction?.()));
    const cancelTimedAction = () => this.interactions.cancelActiveTimedAction?.();
    window.addEventListener('field-item-equipped-changed', cancelTimedAction);
    window.addEventListener('field-offhand-equipped-changed', cancelTimedAction);
    this.disposers.push(() => window.removeEventListener('field-item-equipped-changed', cancelTimedAction));
    this.disposers.push(() => window.removeEventListener('field-offhand-equipped-changed', cancelTimedAction));
    this.isPlayerDead = false;
    this.hasFatalRuntimeError = false;
    this.hasRenderedFirstFrame = false;
    this.firstFramePromise = new Promise((resolve) => {
      this.resolveFirstFrame = resolve;
    });

    this.playFieldReturnReactionIfNeeded({ query });
    if (this.perfDebugEnabled) this.perfDebugPanel = new PerfDebugPanel({ game: this });

    this.rendererHost.setAnimationLoop((time) => this.update(time));
    return this.firstFramePromise;
  }

  handleStartupError(error) {
    console.error('[Dread Stone Black] Startup failed before the scene became playable.', error);
    this.rendererHost?.setAnimationLoop?.(null);

    if (!this.app.innerHTML) this.hudHost = new HudHost({ root: this.app, debugEnabled: this.debugHudEnabled });
    const viewport = this.hudHost?.viewport ?? this.app.querySelector('[data-game="viewport"]') ?? this.app;
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.style.cssText = 'position:absolute;inset:auto 1rem 1rem 1rem;z-index:20;margin:0;padding:0.75rem;background:rgba(32,8,8,0.92);color:#ffd8c2;border:1px solid #a45f3a;font:12px/1.4 monospace;';
    message.textContent = `Startup failed: ${error?.message ?? error}`;
    viewport?.append(message);
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

  handleSceneSessionChanged(session = this.sceneSessionHost) {
    this.interactions?.initializeForSession?.({ player: session.player, dungeon: session.dungeon });
    this.viewmodelHost?.rebindSession?.(session);
    this.survivalHost?.initializeForSession?.(session);
    this.progressionHost?.handleLocationChanged?.(session);
    this.wasKeyboardInteractHeld = false;
    this.hud?.showHint?.('');
  }


  saveEquipmentState() {
    this.saveHost.saveEquipmentState(this.gameState, this.equipmentRuntime);
  }

  handleEquipmentAcquired({ item, metadata } = {}) {
    const cueByItem = {
      wood_axe: 'audio_ch1_folsom_shed_wood_axe_pickup_oneshot',
      torch: 'audio_ch1_folsom_shed_torch_pickup_oneshot',
      keepers_lantern: 'audio_ch2_keepers_lantern_pickup_reveal_oneshot',
      iron_drain_bar: 'audio_ch2_beneath_folsom_iron_drain_bar_pickup_oneshot',
    };
    const cueId = cueByItem[item?.id];
    if (!cueId || metadata?.source === 'field_survival_state_sync') return;
    this.audioRuntime?.play2D(cueId);
  }

  update(time) {
    if (this.hasFatalRuntimeError) return;

    try {
      this.updateUnsafe(time);
      if (!this.hasRenderedFirstFrame) {
        this.hasRenderedFirstFrame = true;
        this.resolveFirstFrame?.(true);
        this.resolveFirstFrame = null;
      }
    } catch (error) {
      this.handleRuntimeError(error);
    }
  }

  updateUnsafe() {
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
      isPlayerDead: this.isPlayerDead,
    });
    this.audioRuntime?.update(deltaSeconds, {
      camera: this.camera,
      player: this.player,
      dungeon: this.dungeon,
      locationId: this.locationId,
      controls: this.controls,
      paused: this.isPaused,
    });
    this.viewmodelHost?.update(deltaSeconds);
    this.survivalHost?.update(deltaSeconds, {
      paused: this.isPaused,
      equipmentPanelOpen: this.equipmentPanel?.isOpen,
      isPlayerDead: this.isPlayerDead,
    });
    this.progressionHost.update(deltaSeconds);
    if (this.controls.consumeAttack()) this.interactions.attack?.();
    this.interactions.updateHint();
    const keyboardInteractHeld = this.player.keyboard?.has('KeyX') ?? false;
    const keyboardInteractPressed = keyboardInteractHeld && !this.wasKeyboardInteractHeld;
    const timedActionCancelRequested = this.equipmentPanel?.isOpen || this.isPaused || this.isPlayerDead;
    this.interactions.updateTimedAction(deltaSeconds, timedActionCancelRequested);

    if (this.controls.consumeInteract() || keyboardInteractPressed) {
      if (!this.interactions.useEquippedConsumable?.()) this.interactions.interact();
    }
    this.wasKeyboardInteractHeld = keyboardInteractHeld;

    this.viewmodelHost?.updateDebugHud(this.player);
    this.feedback.update(deltaSeconds);
    this.sceneSessionHost.render();
    this.perfDebugPanel?.render();
  }

  handleRuntimeError(error) {
    if (this.hasFatalRuntimeError) return;
    this.hasFatalRuntimeError = true;
    this.rendererHost?.setAnimationLoop?.(null);
    console.error('[Dread Stone Black] Fatal runtime error during update/render.', error);
    this.showFatalRuntimeOverlay(error);
    if (!this.hasRenderedFirstFrame) {
      this.resolveFirstFrame?.(false);
      this.resolveFirstFrame = null;
    }
  }

  showFatalRuntimeOverlay(error) {
    const previous = document.querySelector('[data-game-fatal-overlay]');
    previous?.remove?.();

    const overlay = document.createElement('section');
    overlay.dataset.gameFatalOverlay = 'true';
    overlay.setAttribute('role', 'alert');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2000',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:calc(env(safe-area-inset-top) + 16px) calc(env(safe-area-inset-right) + 16px) calc(env(safe-area-inset-bottom) + 16px) calc(env(safe-area-inset-left) + 16px)',
      'background:rgba(2,0,0,0.88)',
      'color:#ffe0cf',
      'font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
      'pointer-events:auto',
      'white-space:normal',
    ].join(';');

    const card = document.createElement('article');
    card.style.cssText = 'width:min(100%,720px);max-height:88vh;overflow:auto;padding:1rem;border:1px solid #b86b42;background:rgba(38,8,5,0.96);box-shadow:0 0 28px rgba(0,0,0,0.7);';

    const title = document.createElement('h1');
    title.textContent = 'Dread Stone Black stopped';
    title.style.cssText = 'margin:0 0 0.75rem;color:#ffd0a8;font:700 1.1rem/1.2 Georgia,serif;letter-spacing:0.06em;';

    const intro = document.createElement('p');
    intro.textContent = 'A fatal update/render error occurred before the game could continue. The animation loop was stopped so this is not a silent black screen.';
    intro.style.margin = '0 0 0.75rem';

    const message = document.createElement('pre');
    message.textContent = `${error?.message ?? error ?? 'Unknown error'}${error?.stack ? `\n\n${error.stack}` : ''}`;
    message.style.cssText = 'margin:0;overflow:auto;white-space:pre-wrap;user-select:text;-webkit-user-select:text;';

    card.append(title, intro, message);
    overlay.append(card);
    document.body.append(overlay);
  }

  togglePause() {
    this.setPaused(!this.isPaused);
  }

  setPaused(isPaused) {
    this.isPaused = isPaused;
    this.hudHost?.setPaused(this.isPaused);
    this.audioRuntime?.setPaused(this.isPaused);
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
    reloadToNewGameStartupRoute();
  }

  getViewportSize() {
    return this.rendererHost.getViewportSize();
  }

  resize() {
    this.rendererHost.resize();
  }

  get dungeon() { return this.sceneSessionHost?.dungeon; }
  get scene() { return this.sceneSessionHost?.scene; }
  get camera() { return this.sceneSessionHost?.camera; }
  get player() { return this.sceneSessionHost?.player; }
  get locationId() { return this.sceneSessionHost?.locationId; }

  dispose() {
    this.rendererHost?.setAnimationLoop?.(null);
    this.perfDebugPanel?.dispose?.();
    this.clearResetConfirmation();
    this.disposers?.forEach((dispose) => dispose?.());
    this.disposers = [];
    this.viewmodelHost?.dispose?.();
    this.survivalHost?.dispose?.();
    this.progressionHost?.dispose?.();
    this.inputHost?.dispose?.();
    this.hudHost?.dispose?.();
    this.sceneSessionHost?.dispose?.();
    this.audioRuntime?.dispose?.();
    this.rendererHost?.dispose?.();
  }

}
