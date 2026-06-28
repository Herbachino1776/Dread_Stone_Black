import { EQUIPMENT_EVENTS } from '../../engine/equipment/EquipmentEvents.js';
import { OBJECTIVE_EVENTS } from '../../engine/objectives/ObjectiveEvents.js';
import { ObjectiveRuntime } from '../../engine/objectives/ObjectiveRuntime.js';
import { equipmentRegistry } from '../equipment/equipmentRegistry.js';
import { getLocationDefinition } from '../locations/locationRegistry.js';
import { objectiveMessages, resolveObjectiveMessage } from '../objectives/objectiveMessages.js';
import { getObjectivePackForLocation } from '../objectives/objectiveRegistry.js';
import { ObjectivePanel } from '../ui/ObjectivePanel.js';

export class ProgressionHost {
  constructor({ root, gameState, equipmentRuntime, hudHost = null, saveHost = null, debugEnabled = false } = {}) {
    this.root = root;
    this.gameState = gameState;
    this.equipmentRuntime = equipmentRuntime;
    this.hudHost = hudHost;
    this.saveHost = saveHost;
    this.debugEnabled = debugEnabled;
    this.locationId = null;
    this.currentRoomId = null;
    this.session = null;
    this.disposers = [];

    this.objectiveRuntime = this.createObjectiveRuntime();
    this.objectivePanel = new ObjectivePanel({
      root: this.root,
      objectiveRuntime: this.objectiveRuntime,
      enabled: this.debugEnabled,
    });
    this.objectiveRuntime.loadSnapshot(this.gameState.getObjectiveSnapshot());
    this.bindObjectiveEquipmentEvents();
    this.installDevDebugHooks();
  }

  createObjectiveRuntime() {
    const runtime = new ObjectiveRuntime({
      context: {
        equipmentRuntime: this.equipmentRuntime,
      },
      callbacks: {
        resolveMessage: resolveObjectiveMessage,
        showToast: (message) => this.objectivePanel?.showToast(message),
        showLocationMessage: (message) => this.objectivePanel?.showToast(message),
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

  initializeForSession(session) {
    this.session = session;
    this.locationId = session?.locationId ?? null;
    this.currentRoomId = this.findCurrentRoomId() ?? this.locationId;
    this.registerCurrentObjectivePack();
    this.emitLocationEntered();
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
    const onItemAcquired = ({ item, metadata }) => {
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
    };
    const onEquippedChanged = ({ itemId, slotId }) => {
      this.objectiveRuntime.emit(OBJECTIVE_EVENTS.equipmentEquipped, {
        locationId: this.locationId,
        roomId: this.currentRoomId,
        itemId,
        equipmentId: itemId,
        sourceId: slotId,
        tags: ['equipment'],
      });
    };

    this.disposers.push(this.equipmentRuntime.on(EQUIPMENT_EVENTS.itemAcquired, onItemAcquired));
    this.disposers.push(this.equipmentRuntime.on(EQUIPMENT_EVENTS.equippedChanged, onEquippedChanged));
  }

  emitLocationEntered() {
    this.objectiveRuntime.emit(OBJECTIVE_EVENTS.locationEntered, {
      locationId: this.locationId,
      roomId: this.currentRoomId,
      tags: [this.session?.dungeon?.area].filter(Boolean),
    });
    this.objectiveRuntime.emit(OBJECTIVE_EVENTS.roomEntered, {
      locationId: this.locationId,
      roomId: this.currentRoomId,
    });
  }

  update(deltaSeconds, context = {}) {
    if (context.session) this.session = context.session;
    this.updateRoomTracking();
    this.objectiveRuntime.update(deltaSeconds, {
      equipmentRuntime: this.equipmentRuntime,
      playerPosition: this.session?.player?.position,
      locationId: this.locationId,
      roomId: this.currentRoomId,
    });
  }

  updateRoomTracking() {
    const roomId = this.findCurrentRoomId();
    if (roomId && roomId !== this.currentRoomId) this.handleRoomChanged({ roomId });
  }

  handleLocationChanged(locationContext = {}) {
    this.initializeForSession(locationContext.session ?? locationContext);
  }

  handleRoomChanged(roomContext = {}) {
    this.currentRoomId = roomContext.roomId ?? this.currentRoomId;
    this.objectiveRuntime.emit(OBJECTIVE_EVENTS.roomEntered, {
      locationId: this.locationId,
      roomId: this.currentRoomId,
    });
  }


  findCurrentRoomId() {
    return this.session?.dungeon?.findRoomIdForPosition?.(this.session?.player?.position) ?? this.locationId;
  }

  saveObjectiveState() {
    this.saveHost?.saveObjectiveState(this.gameState, this.objectiveRuntime);
  }

  getObjectiveRuntime() {
    return this.objectiveRuntime;
  }

  getDebugSummary() {
    return {
      locationId: this.locationId,
      roomId: this.currentRoomId,
      objectives: this.objectiveRuntime.getDebugInfo?.() ?? null,
    };
  }

  installDevDebugHooks() {
    if (!import.meta.env.DEV) return;
    window.dreadStoneObjectiveRuntime = this.objectiveRuntime;
    window.dreadStoneObjectiveDebug = () => this.getDebugSummary();
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    if (import.meta.env.DEV) {
      if (window.dreadStoneObjectiveRuntime === this.objectiveRuntime) delete window.dreadStoneObjectiveRuntime;
      delete window.dreadStoneObjectiveDebug;
    }
  }
}
