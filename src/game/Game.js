import * as THREE from 'three';
import { Combat } from './Combat.js';
import { DungeonScene } from './DungeonScene.js';
import { EQUIPMENT_EVENTS } from '../engine/equipment/EquipmentEvents.js';
import { EquipmentRuntime } from '../engine/equipment/EquipmentRuntime.js';
import { ObjectiveRuntime } from '../engine/objectives/ObjectiveRuntime.js';
import { OBJECTIVE_EVENTS } from '../engine/objectives/ObjectiveEvents.js';
import { Feedback } from './Feedback.js';
import { FirstPersonArmsOverlay } from './FirstPersonArmsOverlay.js';
import { EquipmentPanel } from './equipment/EquipmentPanel.js';
import { equipmentRegistry } from './equipment/equipmentRegistry.js';
import { startingEquipment } from './equipment/startingEquipment.js';
import { FPVEquipmentRenderer } from './fpv/FPVEquipmentRenderer.js';
import { GameState } from './GameState.js';
import { Hud } from './Hud.js';
import { Interactions } from './Interactions.js';
import { MobileControls } from './MobileControls.js';
import { PlayerController } from './PlayerController.js';
import { getLocationDefinition } from './locations/locationRegistry.js';
import { getObjectivePackForLocation } from './objectives/objectiveRegistry.js';
import { objectiveMessages, resolveObjectiveMessage } from './objectives/objectiveMessages.js';
import { ObjectivePanel } from './ui/ObjectivePanel.js';

export class Game {
  constructor(app) {
    this.app = app;
    this.clock = new THREE.Clock();
    this.lastFrame = 0;
  }

  start() {
    this.app.innerHTML = this.renderShell();

    this.canvas = this.app.querySelector('#game-canvas');
    this.viewport = this.app.querySelector('[data-game="viewport"]');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const { width, height } = this.getViewportSize();
    this.renderer.setSize(width, height, false);

    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 260);
    const query = new URLSearchParams(window.location.search);
    const requestedArea = query.get('area');
    const returnedFrom = query.get('from');
    const objectiveDebugUiEnabled = import.meta.env.DEV && query.get('objectiveDebug') === '1';
    const fieldSpawn = returnedFrom === 'black-grass-temple' ? 'blackGrassTempleExit' : returnedFrom === 'dungeon' ? 'cryptAExit' : 'start';
    const area = ['dungeon', 'black-grass-temple'].includes(requestedArea) ? requestedArea : 'field';
    this.gameState = new GameState();
    this.equipmentRuntime = new EquipmentRuntime({
      weaponProfiles: equipmentRegistry.weapons,
      startingEquipment: this.gameState.getEquipmentSnapshot() ?? startingEquipment,
    });
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.itemAcquired, () => this.saveEquipmentState());
    this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, () => this.saveEquipmentState());
    this.dungeon = new DungeonScene({ area, fieldSpawn, gameState: this.gameState });
    this.scene = this.dungeon.build();
    this.locationId = this.resolveLocationId(this.dungeon.area);
    this.objectiveRuntime = this.createObjectiveRuntime();
    this.registerCurrentObjectivePack();
    this.objectiveRuntime.loadSnapshot(this.gameState.getObjectiveSnapshot());
    if (import.meta.env.DEV) {
      window.dreadStoneObjectiveRuntime = this.objectiveRuntime;
      window.dreadStoneObjectiveDebug = () => this.objectiveRuntime.getDebugInfo();
    }
    const movementProfile = this.dungeon.area === 'field'
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
    this.hud = new Hud(this.app);
    this.feedback = new Feedback(this.camera);
    this.armsOverlay = new FirstPersonArmsOverlay(this.app);
    this.objectivePanel = new ObjectivePanel({
      root: this.app,
      objectiveRuntime: this.objectiveRuntime,
      enabled: objectiveDebugUiEnabled,
    });
    this.fpvEquipmentRenderer = new FPVEquipmentRenderer({
      root: this.app,
      armsOverlay: this.armsOverlay,
      equipmentRuntime: this.equipmentRuntime,
    });
    this.controls = new MobileControls(this.app);
    this.equipmentPanel = new EquipmentPanel({ root: this.app, equipmentRuntime: this.equipmentRuntime });
    this.interactions = new Interactions({
      player: this.player,
      dungeon: this.dungeon,
      hud: this.hud,
      feedback: this.feedback,
      equipmentRuntime: this.equipmentRuntime,
      objectiveRuntime: this.objectiveRuntime,
    });
    this.combat = new Combat({
      player: this.player,
      dungeon: this.dungeon,
      hud: this.hud,
      controls: this.controls,
      equipmentRuntime: this.equipmentRuntime,
      fpvEquipmentRenderer: this.fpvEquipmentRenderer,
    });

    this.preventMobilePageGestures();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 250));
    this.viewportResizeObserver = new ResizeObserver(() => this.resize());
    this.viewportResizeObserver.observe(this.viewport);

    this.bindObjectiveEquipmentEvents();
    this.emitLocationEntered();
    this.playFieldReturnReactionIfNeeded({ query });

    this.renderer.setAnimationLoop((time) => this.update(time));
  }

  resolveLocationId(area) {
    if (area === 'dungeon') return 'south-reliquary-crypt';
    if (area === 'field') return 'reliquary-field';
    return area;
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
    const definitions = ['black-grass-temple', 'south-reliquary-crypt']
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

  saveEquipmentState() {
    this.gameState.saveEquipmentSnapshot(this.equipmentRuntime.getSnapshot());
  }

  saveObjectiveState() {
    this.gameState.saveObjectiveSnapshot(this.objectiveRuntime.getSnapshot());
  }

  renderShell() {
    return `
      <main class="reliquary-shell" aria-label="Dread Stone Black handheld reliquary interface">
        <section class="top-stat-row" aria-label="Player status">
          <div class="stat stat-hp"><span>HP</span><strong data-stat="hp">100</strong></div>
          <div class="stat stat-mp"><span>MP</span><strong>24</strong></div>
          <div class="stat stat-power"><span>POWER</span><strong data-stat="power">10</strong></div>
          <div class="stat stat-magic"><span>MAGIC</span><strong>3</strong></div>
        </section>

        <section class="viewport-frame" aria-label="Framed game viewport">
          <div class="viewport-ornament viewport-ornament-top" aria-hidden="true">✦</div>
          <div class="viewport-stage" data-game="viewport">
            <canvas id="game-canvas" aria-label="Dread Stone Black game view"></canvas>
            <p class="interaction-hint" data-hud="hint" aria-live="polite"></p>
            <div class="first-person-arms" data-arms-overlay aria-hidden="true">
              <div class="first-person-arms__layer" data-arms-layer="base"></div>
              <div class="first-person-weapon" data-fpv-equipment-layer hidden></div>
            </div>
            <div class="damage-flash" data-hud="damage" aria-hidden="true"></div>
            <section class="equipment-panel" data-equipment-panel aria-label="Equipment" aria-hidden="true">
              <div class="equipment-panel__header">
                <div>
                  <span class="equipment-panel__eyebrow">Equipment</span>
                  <h2>Weapon Slot</h2>
                </div>
                <button class="equipment-close" data-equipment="close" type="button" aria-label="Close equipment">X</button>
              </div>
              <p class="equipment-current">Equipped: <strong data-equipment="current-weapon">Unarmed</strong></p>
              <div class="equipment-list" data-equipment="weapon-list"></div>
            </section>
          </div>
          <div class="viewport-ornament viewport-ornament-bottom" aria-hidden="true">◆</div>
        </section>

        <section class="control-deck" aria-label="Touch controls">
          <div class="deck-engraving" aria-hidden="true"></div>
          <div class="stick-zone move-zone" data-control="move" aria-label="Move">
            <div class="stick-ring">
              <div class="stick-cardinal stick-cardinal-up">▲</div>
              <div class="stick-cardinal stick-cardinal-down">▼</div>
              <div class="stick-knob" data-control="move-knob"></div>
            </div>
            <span>MOVE</span>
          </div>

          <div class="action-cluster" aria-label="Action buttons">
            <button class="interact-button action-button" data-action="interact" type="button" aria-label="Interact">X</button>
            <button class="attack-button action-button" data-action="attack" type="button" aria-label="Attack">A</button>
            <button class="equipment-button action-button" data-action="equipment" type="button" aria-label="Equipment">EQ</button>
          </div>

          <div class="stick-zone look-zone" data-control="look" aria-label="Look">
            <div class="stick-ring">
              <div class="stick-cardinal stick-cardinal-left">◀</div>
              <div class="stick-cardinal stick-cardinal-right">▶</div>
              <div class="stick-knob" data-control="look-knob"></div>
            </div>
            <span>LOOK</span>
          </div>
        </section>

        <p class="debug-readout" data-hud="debug" aria-label="Debug player position">POS 0.0, 0.0 · YAW 0° · PITCH 0°</p>
      </main>
    `;
  }

  update() {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
    if (!this.combat.isPlayerDead) {
      this.player.update(deltaSeconds, this.controls);
    }
    this.dungeon.update(deltaSeconds, this.player);
    this.combat.update(deltaSeconds);
    this.armsOverlay.update(deltaSeconds);
    this.updateObjectiveLocationTracking(deltaSeconds);
    this.interactions.updateHint();

    if (this.controls.consumeInteract()) {
      this.interactions.interact();
    }

    this.hud.updateDebug(this.player);
    this.feedback.update(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
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
    const rect = this.viewport.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rect.width || window.innerWidth)),
      height: Math.max(1, Math.floor(rect.height || window.innerHeight)),
    };
  }

  resize() {
    if (!this.viewport || !this.renderer || !this.camera) return;

    const { width, height } = this.getViewportSize();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  preventMobilePageGestures() {
    // CSS handles most cases; this catches iOS Safari's page drag on the document.
    document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
    document.addEventListener('contextmenu', (event) => event.preventDefault());
  }
}
