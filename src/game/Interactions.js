import { OBJECTIVE_EVENTS } from '../engine/objectives/ObjectiveEvents.js';
import { EQUIPMENT_SLOTS } from '../engine/equipment/EquipmentSlot.js';

const INTERACT_RANGE = 3.0;
const KEY_RANGE = 2.55;
const LEVER_RANGE = 2.5;
const INDOOR_EXIT_RANGE = 4.0;
const SHORTCUT_DOOR_RANGE = 2.55;
const SECRET_WALL_RANGE = 2.4;
const CAMPFIRE_TIMED_ACTION_SECONDS = 2;
const FISHING_TIMED_ACTION_SECONDS = 3;
const COOKING_TIMED_ACTION_SECONDS = 10;
const TIMED_ACTION_MOVE_CANCEL_DISTANCE = 1.4;

export class Interactions {
  constructor({ player, dungeon, hud, feedback = null, equipmentRuntime = null, objectiveRuntime = null }) {
    this.player = player;
    this.dungeon = dungeon;
    this.hud = hud;
    this.feedback = feedback;
    this.equipmentRuntime = equipmentRuntime;
    this.objectiveRuntime = objectiveRuntime;
    this.hasKey = false;
    this.currentHint = '';
    this.feedbackHint = '';
    this.feedbackUntil = 0;
    this.activeTimedAction = null;
    this.debugAreaGateStates = new Map();
  }

  updateHint() {
    this.hud.updateFieldKitStatus?.(this.dungeon.gameState?.getFieldSurvivalSnapshot?.(), { visible: false });
    const nearbyInteraction = this.getNearbyInteraction();
    this.logAreaEntranceGatePromptState(nearbyInteraction);
    const hint = Date.now() < this.feedbackUntil
      ? this.feedbackHint
      : nearbyInteraction?.hint ?? '';

    if (hint !== this.currentHint) {
      this.currentHint = hint;
      this.hud.showHint(hint);
    }
  }

  interact() {
    const interaction = this.getNearbyInteraction();

    if (!interaction) {
      const fieldAttemptMessage = this.dungeon.area === 'field' ? this.getCampfireRequirementMessage?.() : '';
      if (fieldAttemptMessage && fieldAttemptMessage !== 'Need open ground.') {
        this.setTemporaryHint(fieldAttemptMessage, 1200);
        this.hud.showMessage(fieldAttemptMessage);
        return;
      }
      this.hud.showMessage('Nothing answers your touch.');
      return;
    }

    const shouldRefreshHint = interaction.use() !== false;
    if (shouldRefreshHint) this.updateHint();
  }

  getNearbyInteraction() {
    const indoorExit = this.getNearbyIndoorExit();
    if (indoorExit) {
      return {
        hint: indoorExit.promptText ?? (this.dungeon.area === 'black-grass-temple' ? '' : 'Tap INTERACT to climb back to the tomb-field.'),
        use: () => this.useIndoorExit(),
      };
    }

    const outdoorInteraction = this.getNearbyOutdoorInteraction();
    if (outdoorInteraction) {
      return {
        hint: outdoorInteraction.hint,
        use: () => this.useOutdoorInteraction(outdoorInteraction),
      };
    }

    const fieldCampfireCraft = this.getOpenGroundCampfireCraftInteraction();
    if (fieldCampfireCraft) {
      return {
        hint: fieldCampfireCraft.hint,
        use: () => this.useOutdoorInteraction(fieldCampfireCraft),
      };
    }

    if (this.isNearKey()) {
      return {
        hint: 'Tap INTERACT to take the tarnished key.',
        use: () => this.pickUpKey(),
      };
    }

    const inspectInteraction = this.getNearbyInspectInteraction();
    if (inspectInteraction) {
      return {
        hint: inspectInteraction.hint,
        use: () => this.useInspectInteraction(inspectInteraction),
      };
    }

    if (this.isNearLever()) {
      return {
        hint: this.dungeon.leverUsed ? 'The wall switch rests in its lowered notch.' : 'Tap INTERACT to pull the wall switch.',
        use: () => this.useLever(),
      };
    }

    if (this.isFacingShortcutDoor()) {
      return {
        hint: this.getShortcutHint(),
        use: () => this.useShortcutDoor(),
      };
    }

    if (this.isFacingSecretWall()) {
      return {
        hint: this.dungeon.secretRevealed ? 'The hidden alcove yawns open.' : 'Tap INTERACT to press the cracked black stones.',
        use: () => this.useSecretWall(),
      };
    }

    return null;
  }

  useOutdoorInteraction(interaction) {
    this.emitObjectiveEvent(OBJECTIVE_EVENTS.interactionUsed, {
      interactionId: interaction.id,
      sourceId: interaction.id,
      tags: ['outdoor', interaction.type ?? 'inspect'],
    });

    if (interaction.type === 'centralShrine') {
      return this.useCentralShrine(interaction);
    }

    if (interaction.type === 'fieldSurvivalChest') {
      return this.useFieldSurvivalChest(interaction);
    }

    if (interaction.type === 'fieldHarvestableTree') {
      return this.useFieldHarvestableTree(interaction);
    }

    if (interaction.type === 'activeTimedAction') {
      return false;
    }

    if (interaction.type === 'fieldCampfireCraft') {
      return this.tryStartFieldCampfireTimedAction(interaction);
    }

    if (interaction.type === 'fieldCampfire') {
      return this.useFieldCampfire(interaction);
    }

    if (interaction.type === 'fieldFishing') {
      return this.startFishingTimedAction(interaction);
    }

    if (interaction.type === 'cookedFishPickup') {
      return this.pickupCookedFish(interaction);
    }

    if (interaction.type === 'rawFishPickup') {
      return this.pickupRawFish(interaction);
    }

    this.setTemporaryHint(interaction.message, 1200);

    if (interaction.functional) {
      this.logAreaEntranceGateInteract(interaction);
      this.hud.showMessage(interaction.message);
      this.emitObjectiveEvent(OBJECTIVE_EVENTS.locationExited, {
        interactionId: interaction.id,
        targetId: interaction.area ?? 'dungeon',
        tags: ['transition'],
      });
      window.setTimeout(() => {
        window.location.assign(`${window.location.pathname}?area=${interaction.area ?? 'dungeon'}`);
      }, 220);
      return false;
    }

    this.hud.showMessage(interaction.message);
    return false;
  }

  useIndoorExit() {
    const fromArea = this.dungeon.area === 'dungeon' ? 'dungeon' : this.dungeon.area;
    const hint = this.dungeon.area === 'black-grass-temple' ? '' : this.dungeon.area === 'field-keeper-house' ? 'Cold field air leaks under the threshold.' : 'Cold field air seeps down the stair.';
    this.setTemporaryHint(hint, 900);
    this.emitObjectiveEvent(OBJECTIVE_EVENTS.locationExited, {
      interactionId: `${this.getLocationId()}_exit`,
      targetId: 'reliquary-field',
      tags: ['transition', 'indoor_exit'],
    });
    window.setTimeout(() => {
      window.location.assign(`${window.location.pathname}?area=field&from=${fromArea}`);
    }, 160);
    return false;
  }


  getDebugAreaEntranceGates() {
    if (!import.meta.env.DEV) return [];
    return (this.dungeon.outdoorInteractions ?? []).filter((interaction) => interaction.type === 'areaEntrance' && interaction.debugGateId);
  }

  logAreaEntranceGatePromptState(nearbyInteraction) {
    this.getDebugAreaEntranceGates().forEach((gate) => {
      if (!gate?.target) return;
      const distance = this.horizontalDistanceTo(gate.gatePosition ?? gate.target);
      const promptActive = nearbyInteraction?.id === gate.id;
      const state = `${distance.toFixed(2)}|${promptActive}`;
      if (state === this.debugAreaGateStates.get(gate.debugGateId)) return;
      this.debugAreaGateStates.set(gate.debugGateId, state);
      console.debug('[AreaEntranceGate]', {
        gateId: gate.debugGateId,
        nearestGateDistance: Number(distance.toFixed(2)),
        promptActive,
        selectedDestinationLocationId: gate.targetLocationId ?? gate.area ?? gate.toLocation ?? 'dungeon',
        destinationSpawnId: gate.targetSpawnId ?? gate.destinationSpawnId ?? null,
        visibleMarkerPosition: gate.visibleMarkerPosition ?? gate.gatePosition ?? null,
      });
    });
  }

  logAreaEntranceGateInteract(interaction) {
    if (!import.meta.env.DEV || interaction.type !== 'areaEntrance' || !interaction.debugGateId) return;
    console.debug('[AreaEntranceGate]', {
      gateId: interaction.debugGateId,
      interactFired: true,
      nearestGateDistance: Number(this.horizontalDistanceTo(interaction.gatePosition ?? interaction.target).toFixed(2)),
      promptActive: true,
      selectedDestinationLocationId: interaction.targetLocationId ?? interaction.area ?? interaction.toLocation ?? 'dungeon',
      destinationSpawnId: interaction.targetSpawnId ?? interaction.destinationSpawnId ?? null,
      visibleMarkerPosition: interaction.visibleMarkerPosition ?? interaction.gatePosition ?? null,
    });
  }

  setTemporaryHint(message, durationMs) {
    this.feedbackHint = message;
    this.feedbackUntil = Date.now() + durationMs;
    this.hud.showHint(message);
  }

  useInspectInteraction(interaction) {
    this.emitObjectiveEvent(OBJECTIVE_EVENTS.interactionUsed, {
      interactionId: interaction.id,
      sourceId: interaction.id,
      tags: [interaction.type ?? 'inspect'],
    });

    if (interaction.type === 'equipmentPickup') {
      return this.useEquipmentPickup(interaction);
    }

    if (interaction.type === 'fieldSurvivalChest') {
      return this.useFieldSurvivalChest(interaction);
    }

    if (interaction.type === 'southReliquary') {
      return this.useSouthReliquary(interaction);
    }

    if (interaction.id === 'BGT_INT06') {
      this.dungeon.gameState?.markBlackGrassTempleAltarActivated?.();
      this.dungeon.ensureGiantRamManFieldManifestation?.();
      return false;
    }

    this.setTemporaryHint(interaction.message, 1200);
    this.hud.showMessage(interaction.message);
    return false;
  }

  useEquipmentPickup(interaction) {
    if (!interaction.itemId || !this.equipmentRuntime) {
      this.setTemporaryHint(interaction.message ?? 'The chest is empty.', 1200);
      return false;
    }

    if (this.equipmentRuntime.hasItem(interaction.itemId)) {
      const repeatMessage = interaction.repeatMessage ?? 'The chest lies open and empty.';
      this.setTemporaryHint(repeatMessage, 1200);
      this.hud.showMessage(repeatMessage);
      return false;
    }

    if (interaction.id === 'BGT_INT_RUSTED_SWORD_CHEST') {
      this.dungeon.gameState?.markRustedSwordChestOpened?.();
    }
    this.equipmentRuntime.acquireItem(interaction.itemId, {
      source: interaction.id,
      tags: ['pickup', this.dungeon.area],
    });
    if (interaction.autoEquip === true) {
      this.equipmentRuntime.equip(EQUIPMENT_SLOTS.weapon, interaction.itemId);
    }
    this.emitObjectiveEvent(OBJECTIVE_EVENTS.chestOpened, {
      interactionId: interaction.id,
      itemId: interaction.itemId,
      equipmentId: interaction.itemId,
      sourceId: interaction.id,
      tags: ['equipment', 'chest'],
    });
    if (this.dungeon.markInteractionCollected?.(interaction.id)) {
      interaction.hint = interaction.repeatHint ?? 'The chest lies open and empty.';
      interaction.message = interaction.repeatMessage ?? 'The chest lies open and empty.';
    }
    const message = interaction.acquiredMessage ?? interaction.message ?? 'You acquire an item.';
    this.setTemporaryHint(message, 1600);
    this.hud.showMessage(message);
    return false;
  }

  useSouthReliquary(interaction) {
    const activated = this.dungeon.activateSouthReliquary();
    const message = activated ? 'The black reliquary wakes.' : interaction.message;
    this.setTemporaryHint(message, activated ? 1700 : 1200);
    this.hud.showMessage(message);
    this.emitObjectiveEvent(OBJECTIVE_EVENTS.altarActivated, {
      interactionId: interaction.id,
      sourceId: interaction.id,
      tags: ['reliquary', activated ? 'activated' : 'already_awake'],
    });

    if (activated) {
      this.feedback?.shake({ durationMs: 360, intensity: 0.14 });
    }

    return false;
  }

  useCentralShrine(interaction) {
    const shrineIsAwake = Boolean(this.dungeon.gameState?.hasSouthReliquaryFragment);
    const message = shrineIsAwake ? 'The field answers.' : 'The shrine is cold. Something is missing.';
    this.setTemporaryHint(message, shrineIsAwake ? 1500 : 1200);
    this.hud.showMessage(message);

    if (shrineIsAwake) {
      this.dungeon.awakenFieldShrine();
      if (this.dungeon.gameState?.markFieldShrineReactionSeen()) {
        this.feedback?.shake({ durationMs: 360, intensity: 0.12 });
      }
    }

    return false;
  }

  openFieldChestVisual(chestId) {
    const chest = this.dungeon.fieldSurvivalObjects?.get(chestId);
    if (!chest) return;
    chest.children.forEach((child) => {
      if (child.geometry?.type === 'BoxGeometry' && child.position.y > 0.6) {
        child.position.set(0, 0.92, -0.42);
        child.rotation.x = -0.72;
      }
    });
  }

  useFieldSurvivalChest(interaction) {
    if (this.dungeon.gameState?.hasLootedFieldChest?.(interaction.id)) {
      const repeatMessage = interaction.repeatMessage ?? 'Empty.';
      this.setTemporaryHint(repeatMessage, 1200);
      this.hud.showMessage(repeatMessage);
      return false;
    }

    if (!this.dungeon.gameState?.hasOpenedFieldChest?.(interaction.id)) {
      this.dungeon.gameState?.markFieldChestOpened?.(interaction.id);
      this.openFieldChestVisual(interaction.id);
      interaction.hint = 'Retrieve item';
      interaction.message = interaction.acquiredMessage ?? 'Item acquired.';
      this.setTemporaryHint('Chest opened.', 1200);
      this.hud.showMessage('Chest opened.');
      return false;
    }

    this.dungeon.gameState?.markFieldChestLooted?.(interaction.id);
    this.dungeon.gameState?.addFieldItem?.(interaction.itemId);
    if (interaction.itemId === 'wood_axe') {
      this.equipmentRuntime?.acquireItem?.('wood_axe', { source: interaction.id, tags: ['weapon', 'axe', 'woodcutting', 'field-survival'] });
    }
    if (interaction.itemId === 'fishing_rod') {
      this.equipmentRuntime?.acquireItem?.('fishing_rod', { source: interaction.id, tags: ['weapon', 'tool', 'fishing', 'field-survival'] });
    }
    if (interaction.itemId === 'torch') {
      this.equipmentRuntime?.acquireItem?.('torch', { source: interaction.id, tags: ['offhand', 'torch', 'light', 'dungeon-utility'] });
    }
    this.openFieldChestVisual(interaction.id);
    interaction.hint = interaction.repeatHint ?? 'The chest lies open and empty.';
    interaction.message = interaction.repeatMessage ?? 'The chest lies open and empty.';
    const message = interaction.acquiredMessage ?? 'Item acquired.';
    this.hud.updateFieldKitStatus?.(this.dungeon.gameState?.getFieldSurvivalSnapshot?.(), { visible: false });
    this.setTemporaryHint(message, 1600);
    this.hud.showMessage(message);
    return false;
  }

  useFieldHarvestableTree(interaction) {
    if (this.dungeon.gameState?.hasHarvestedFieldTree?.(interaction.id)) {
      this.setTemporaryHint('The chopped stump is dry and bare.', 1200);
      return false;
    }

    const hasAxe = this.dungeon.gameState?.hasFieldItem?.('wood_axe') || this.equipmentRuntime?.hasItem?.('wood_axe');
    const equippedAxe = this.equipmentRuntime
      ? this.equipmentRuntime.getEquippedWeaponProfile?.().id === 'wood_axe'
      : this.dungeon.gameState?.getEquippedFieldTool?.() === 'wood_axe';
    if (!hasAxe) {
      this.setTemporaryHint('Equip Wood Axe.', 1200);
      this.hud.showMessage('Equip Wood Axe.');
      return false;
    }

    if (!equippedAxe) {
      this.setTemporaryHint('Equip Wood Axe.', 1200);
      this.hud.showMessage('Equip Wood Axe.');
      return false;
    }

    this.setTemporaryHint('Chop redwood', 700);
    this.feedback?.shake?.({ durationMs: 180, intensity: 0.08 });
    this.dungeon.fpvEquipmentRenderer?.playAttack?.(this.equipmentRuntime?.getEquippedWeaponProfile?.());
    this.dungeon.gameState?.markFieldTreeHarvested?.(interaction.id);
    this.dungeon.gameState?.addFieldItem?.('wood', interaction.yield ?? 1);
    if (interaction.treeObject) interaction.treeObject.visible = false;
    this.dungeon.addFieldStump?.(interaction.stumpPosition, interaction.id);
    interaction.hint = 'The chopped stump is dry and bare.';
    interaction.message = 'The chopped stump is dry and bare.';
    window.setTimeout(() => {
      const message = this.dungeon.gameState?.hasFieldKeyItem?.('flint_stick')
        ? 'Wood harvested.'
        : 'Wood harvested.';
      this.hud.updateFieldKitStatus?.(this.dungeon.gameState?.getFieldSurvivalSnapshot?.(), { visible: false });
      this.setTemporaryHint(message, 2400);
      this.hud.showMessage(message);
    }, 250);
    return false;
  }

  getCampfireRequirementMessage(interaction = null) {
    if (this.dungeon.area !== 'field') return 'Need open ground.';
    if (this.dungeon.gameState?.getFieldItemCount?.('wood') < 1) return 'Need Wood.';
    if (!this.dungeon.gameState?.hasFieldKeyItem?.('flint_stick')) return 'Need Flint Stick.';
    if (this.dungeon.gameState?.getEquippedFieldItem?.() !== 'wood') return 'Equip Wood.';
    const placeAt = interaction?.placement ?? this.dungeon.getFieldCampfirePlacement?.(this.player);
    if (!placeAt || !this.dungeon.isFieldCampfireOpenGround?.(placeAt)) return 'Need open ground.';
    return '';
  }

  tryStartFieldCampfireTimedAction(interaction = null) {
    const missing = this.getCampfireRequirementMessage(interaction);
    if (missing) {
      this.setTemporaryHint(missing, 1400);
      this.hud.showMessage(missing);
      this.cancelTimedAction({ silent: true });
      return false;
    }

    const placement = interaction?.placement ?? this.dungeon.getFieldCampfirePlacement?.(this.player);
    return this.startTimedAction({
      type: 'buildCampfire',
      label: 'Building',
      durationSeconds: CAMPFIRE_TIMED_ACTION_SECONDS,
      startPosition: this.player.position.clone(),
      placement: placement.clone?.() ?? placement,
      cancelMessage: 'Building canceled.',
      validate: (action) => this.dungeon.area === 'field'
        && this.player.position.distanceTo(action.startPosition) <= TIMED_ACTION_MOVE_CANCEL_DISTANCE
        && !this.getCampfireRequirementMessage({ placement: action.placement }),
      complete: (action) => this.completeFieldCampfireCraft(action),
    });
  }

  updateTimedAction(deltaSeconds, cancelRequested = false) {
    const action = this.activeTimedAction;
    if (!action) { this.hud.updateTimedActionProgress?.(0); return; }
    if (cancelRequested || action.validate?.(action) === false) {
      this.cancelTimedAction();
      return;
    }
    action.elapsedSeconds = Math.min(action.durationSeconds, action.elapsedSeconds + Math.max(0, deltaSeconds));
    const progress = Math.min(1, action.elapsedSeconds / Math.max(0.001, action.durationSeconds));
    this.hud.updateTimedActionProgress?.(progress, action.label);
    if (progress >= 1 && !action.completed) {
      action.completed = true;
      this.activeTimedAction = null;
      this.hud.updateTimedActionProgress?.(0);
      action.complete?.(action);
      this.updateHint();
    }
  }

  updateHold(deltaSeconds, isInteractHeld, cancelRequested = false) {
    this.updateTimedAction(deltaSeconds, cancelRequested);
  }

  cancelTimedAction({ silent = false } = {}) {
    const action = this.activeTimedAction;
    this.activeTimedAction = null;
    this.hud.updateTimedActionProgress?.(0);
    if (action && !silent && action.cancelMessage) {
      this.setTemporaryHint(action.cancelMessage, 1200);
      this.hud.showMessage(action.cancelMessage);
    }
  }

  cancelActiveTimedAction() {
    this.cancelTimedAction();
  }

  completeFieldCampfireCraft(action = this.activeTimedAction) {
    if (!action || this.getCampfireRequirementMessage({ placement: action.placement })) return false;
    if (!this.dungeon.gameState?.consumeFieldItems?.({ wood: 1 })) {
      this.setTemporaryHint('Need Wood.', 1400);
      return false;
    }

    action.placement.y = 0;
    this.dungeon.gameState?.markFieldCampfireBuilt?.(action.placement);
    this.dungeon.addFieldCampfire?.(action.placement);
    this.hud.updateFieldKitStatus?.(this.dungeon.gameState?.getFieldSurvivalSnapshot?.(), { visible: false });
    this.setTemporaryHint('Campfire Built.', 1600);
    this.hud.showMessage('Campfire Built.');
    return false;
  }

  useFieldCampfire(interaction) {
    if (this.dungeon.gameState?.getEquippedFieldItem?.() === 'raw_fish' && this.dungeon.gameState?.getFieldItemCount?.('raw_fish') > 0) {
      return this.startCookingTimedAction(interaction);
    }
    this.setTemporaryHint(interaction.message ?? 'The fire is ready for cooking.', 1400);
    this.hud.showMessage(interaction.message ?? 'The fire is ready for cooking.');
    return false;
  }

  startFishingTimedAction(interaction = null) {
    const fishingZone = this.dungeon.getNearbyFishingZone?.(this.player.position);
    if (!fishingZone || this.equipmentRuntime?.getEquippedWeaponProfile?.().id !== 'fishing_rod') {
      this.cancelTimedAction({ silent: true });
      return false;
    }

    return this.startTimedAction({
      type: 'fish',
      label: 'Fishing',
      durationSeconds: FISHING_TIMED_ACTION_SECONDS,
      startPosition: this.player.position.clone(),
      fishingZoneId: fishingZone.id,
      cancelMessage: 'Fishing canceled.',
      validate: (action) => (this.dungeon.area === 'field' || this.dungeon.isCompiledOutdoorFieldArea?.())
        && this.equipmentRuntime?.getEquippedWeaponProfile?.().id === 'fishing_rod'
        && this.player.position.distanceTo(action.startPosition) <= TIMED_ACTION_MOVE_CANCEL_DISTANCE
        && Boolean(this.dungeon.getNearbyFishingZone?.(this.player.position)),
      complete: () => {
        const pickup = this.dungeon.spawnRawFishPickupForPlayer?.(this.player, fishingZone);
        if (pickup) {
          this.setTemporaryHint('Fish Caught.', 1500);
          this.hud.showMessage('Fish Caught.');
        } else {
          console.warn('[Dread Stone Black] Raw Fish pickup spawn failed.');
          this.setTemporaryHint('No fish.', 1200);
          this.hud.showMessage('No fish.');
        }
      },
    });
  }

  startCookingTimedAction(interaction) {
    return this.startTimedAction({
      type: 'cookFish',
      label: 'Cooking',
      durationSeconds: COOKING_TIMED_ACTION_SECONDS,
      startPosition: this.player.position.clone(),
      target: interaction.target?.clone?.() ?? interaction.target,
      range: interaction.range ?? 4.25,
      cancelMessage: 'Cooking canceled.',
      validate: (action) => this.dungeon.area === 'field'
        && this.player.position.distanceTo(action.startPosition) <= TIMED_ACTION_MOVE_CANCEL_DISTANCE
        && this.dungeon.gameState?.getEquippedFieldItem?.() === 'raw_fish'
        && this.dungeon.gameState?.getFieldItemCount?.('raw_fish') > 0
        && this.horizontalDistanceTo(action.target) <= action.range,
      complete: (action) => {
        if (this.dungeon.gameState?.consumeFieldItems?.({ raw_fish: 1 })) {
          this.dungeon.spawnCookedFishPickup?.(action.target);
          this.setTemporaryHint('Fish Cooked.', 1500);
          this.hud.showMessage('Fish Cooked.');
        }
      },
    });
  }

  startTimedAction(action) {
    if (this.activeTimedAction) return false;
    this.activeTimedAction = { elapsedSeconds: 0, completed: false, ...action };
    this.hud.updateTimedActionProgress?.(0.001, action.label);
    this.setTemporaryHint(`${action.label}...`, 700);
    return false;
  }

  pickupCookedFish(interaction) {
    this.dungeon.gameState?.addFieldItem?.('cooked_fish', 1);
    this.dungeon.removeCookedFishPickup?.(interaction.pickup);
    this.setTemporaryHint('Cooked Fish Acquired.', 1400);
    this.hud.showMessage('Cooked Fish Acquired.');
    return false;
  }

  pickupRawFish(interaction) {
    this.dungeon.gameState?.addFieldItem?.('raw_fish', 1);
    this.dungeon.removeRawFishPickup?.(interaction.pickup);
    this.setTemporaryHint('Raw Fish Acquired.', 1400);
    this.hud.showMessage('Raw Fish Acquired.');
    return false;
  }

  useEquippedConsumable() {
    if (this.dungeon.gameState?.getEquippedFieldItem?.() !== 'cooked_fish') return false;
    if (!this.dungeon.gameState?.eatCookedFish?.()) return false;
    this.setTemporaryHint('Ate Cooked Fish.', 1300);
    this.hud.showMessage('Ate Cooked Fish.');
    return true;
  }

  pickUpKey() {
    if (!this.dungeon.collectKey()) return;

    this.hasKey = true;
    this.hud.showMessage('You take the tarnished reliquary key.');
    this.emitObjectiveEvent(OBJECTIVE_EVENTS.itemAcquired, {
      itemId: 'tarnished_reliquary_key',
      sourceId: 'south_crypt_key',
      tags: ['key'],
    });
  }

  useGate() {
    if (!this.hasKey) {
      this.hud.showMessage('The gate is locked.');
      return;
    }

    if (this.dungeon.openGate()) {
      this.hud.showMessage('The key turns. The iron gate groans upward.');
      this.emitObjectiveEvent(OBJECTIVE_EVENTS.gateUnlocked, {
        interactionId: 'INT03',
        targetId: 'GATE01',
        tags: ['gate'],
      });
    } else {
      this.hud.showMessage('The gate stands open.');
    }
  }

  useShortcutDoor() {
    if (this.dungeon.shortcutOpen) {
      this.hud.showMessage('The shortcut door hangs open to the starting chamber.');
      return;
    }

    if (this.player.position.x > -5.65) {
      this.hud.showMessage('Iron hooks bar this door from the far side.');
      return;
    }

    if (this.dungeon.openShortcutDoor()) {
      this.hud.showMessage('You lift the hooks. A shortcut opens back to the first chamber.');
      this.emitObjectiveEvent(OBJECTIVE_EVENTS.gateUnlocked, {
        targetId: 'south_crypt_shortcut_door',
        tags: ['shortcut'],
      });
    }
  }

  useSecretWall() {
    if (this.dungeon.revealSecret()) {
      this.hud.showMessage('The cracked wall sinks with a dry scrape, exposing a candleless alcove.');
      this.emitObjectiveEvent(OBJECTIVE_EVENTS.interactionUsed, {
        interactionId: 'south_crypt_secret_wall',
        tags: ['secret'],
      });
    } else {
      this.hud.showMessage('The alcove is empty, but the stones whisper back.');
    }
  }

  useLever() {
    if (this.dungeon.useLever()) {
      this.hud.showMessage('The switch snaps down. Stone rumbles somewhere nearby.');
      this.emitObjectiveEvent(OBJECTIVE_EVENTS.leverPulled, {
        interactionId: 'south_crypt_wall_switch',
        tags: ['lever'],
      });
    } else {
      this.hud.showMessage('The switch is already lowered.');
    }
  }

  emitObjectiveEvent(type, payload = {}) {
    if (!this.objectiveRuntime) return;
    this.objectiveRuntime.emit(type, {
      locationId: this.getLocationId(),
      roomId: this.dungeon.findRoomIdForPosition?.(this.player.position) ?? null,
      ...payload,
    });
  }

  getLocationId() {
    if (this.dungeon.area === 'dungeon') return 'south-reliquary-crypt';
    if (this.dungeon.area === 'field') return 'reliquary-field';
    return this.dungeon.area;
  }

  getOpenGroundCampfireCraftInteraction() {
    if (this.dungeon.area !== 'field') return null;
    if (this.dungeon.gameState?.getFieldItemCount?.('wood') < 1
      || !this.dungeon.gameState?.hasFieldKeyItem?.('flint_stick')
      || this.dungeon.gameState?.getEquippedFieldItem?.() !== 'wood') return null;

    const placement = this.dungeon.getFieldCampfirePlacement?.(this.player);
    return {
      id: 'field_survival_open_ground_campfire',
      label: 'Campfire Crafting',
      target: placement ?? this.player.position,
      range: 99,
      hint: placement ? 'Build Campfire' : 'Need open ground.',
      message: placement ? 'Campfire Built.' : 'Need open ground.',
      type: 'fieldCampfireCraft',
      placement,
      openGroundCraft: true,
    };
  }

  getNearbyOutdoorInteraction() {
    const outdoorInteractions = this.dungeon.outdoorInteractions ?? [];

    const pickupInteraction = outdoorInteractions
      .filter((interaction) => ['rawFishPickup', 'cookedFishPickup'].includes(interaction.type) && this.isOutdoorInteractionAvailable(interaction))
      .map((interaction) => ({ interaction: this.decorateOutdoorInteraction(interaction), distance: this.horizontalDistanceTo(interaction.target) }))
      .filter(({ interaction, distance }) => distance <= (interaction.range ?? 4))
      .sort((a, b) => a.distance - b.distance)[0]?.interaction ?? null;
    if (pickupInteraction) return pickupInteraction;

    if (this.activeTimedAction) {
      return {
        id: `active_${this.activeTimedAction.type}`,
        hint: `${this.activeTimedAction.label}...`,
        type: 'activeTimedAction',
        use: () => false,
      };
    }

    const nearbyOutdoorInteractions = outdoorInteractions
      .filter((interaction) => this.isOutdoorInteractionAvailable(interaction))
      .map((interaction) => ({ interaction: this.decorateOutdoorInteraction(interaction), distance: this.horizontalDistanceTo(interaction.target) }))
      .filter(({ interaction, distance }) => distance <= (interaction.range ?? 4))
      .sort((a, b) => a.distance - b.distance);

    const campfireInteraction = nearbyOutdoorInteractions.find(({ interaction }) => interaction.type === 'fieldCampfire')?.interaction ?? null;
    if (campfireInteraction && this.dungeon.gameState?.getEquippedFieldItem?.() === 'raw_fish' && this.dungeon.gameState?.getFieldItemCount?.('raw_fish') > 0) {
      campfireInteraction.hint = 'Cook Fish';
      return campfireInteraction;
    }

    const redwoodInteraction = this.dungeon.getNearbyFieldHarvestableRedwood?.(this.player.position);
    if (redwoodInteraction) return this.decorateOutdoorInteraction(redwoodInteraction);

    if (campfireInteraction) return campfireInteraction;

    const fishingZone = this.dungeon.getNearbyFishingZone?.(this.player.position);
    if (fishingZone && this.equipmentRuntime?.getEquippedWeaponProfile?.().id === 'fishing_rod') {
      return { id: fishingZone.id, label: fishingZone.label ?? 'River Fishing', target: fishingZone.position, range: fishingZone.interactPadding, hint: 'Fish', message: 'Fish Caught.', type: 'fieldFishing' };
    }

    return nearbyOutdoorInteractions[0]?.interaction ?? null;
  }

  isOutdoorInteractionAvailable(interaction) {
    if (interaction.type === 'activeTimedAction') {
      return false;
    }

    if (interaction.type === 'fieldCampfireCraft') {
      return this.dungeon.area === 'field' && !this.getCampfireRequirementMessage(interaction);
    }
    return true;
  }

  decorateOutdoorInteraction(interaction) {
    if (interaction.type === 'fieldHarvestableTree' && !this.dungeon.gameState?.hasHarvestedFieldTree?.(interaction.id)) {
      const hasAxe = this.dungeon.gameState?.hasFieldItem?.('wood_axe') || this.equipmentRuntime?.hasItem?.('wood_axe');
      const equippedAxe = this.equipmentRuntime
        ? this.equipmentRuntime.getEquippedWeaponProfile?.().id === 'wood_axe'
        : this.dungeon.gameState?.getEquippedFieldTool?.() === 'wood_axe';
      interaction.hint = equippedAxe ? 'Chop redwood' : '';
    }
    if (interaction.type === 'activeTimedAction') {
      return false;
    }

    if (interaction.type === 'fieldCampfireCraft') {
      const missing = this.getCampfireRequirementMessage(interaction);
      interaction.hint = missing || 'Build Campfire';
      interaction.message = missing || 'Campfire Built.';
    }
    return interaction;
  }

  getNearbyIndoorExit() {
    if (this.dungeon.area === 'field') return null;
    if (!this.dungeon.indoorExitTarget) return null;
    if (!this.isCloseEnough(this.dungeon.indoorExitTarget, INDOOR_EXIT_RANGE)) return null;
    return this.dungeon.compiledLocationRuntime?.exits?.find((exit) => exit.toLocation === 'reliquary-field') ?? true;
  }

  isNearKey() {
    return Boolean(this.dungeon.key) && this.isCloseEnough(this.dungeon.keyTarget, KEY_RANGE);
  }

  isNearLever() {
    return Boolean(this.dungeon.leverTarget) && this.isCloseEnough(this.dungeon.leverTarget, LEVER_RANGE) && this.isMostlyFacing(this.dungeon.leverTarget, 0.15);
  }

  getNearbyInspectInteraction() {
    if (!this.dungeon.inspectInteractions?.length) return null;

    return this.dungeon.inspectInteractions
      .map((interaction) => ({ interaction, distance: this.horizontalDistanceTo(interaction.target) }))
      .filter(({ interaction, distance }) => distance <= (interaction.range ?? INTERACT_RANGE))
      .sort((a, b) => a.distance - b.distance)[0]?.interaction ?? null;
  }

  getShortcutHint() {
    if (this.dungeon.shortcutOpen) return 'The shortcut returns to the starting room.';
    if (this.player.position.x > -5.65) return 'A barred door waits beyond the western wall.';
    return 'Tap INTERACT to unbar the shortcut door.';
  }

  isFacingShortcutDoor() {
    return Boolean(this.dungeon.shortcutTarget) && this.isCloseEnough(this.dungeon.shortcutTarget, SHORTCUT_DOOR_RANGE) && this.isMostlyFacing(this.dungeon.shortcutTarget, 0.18);
  }

  isFacingSecretWall() {
    return Boolean(this.dungeon.secretTarget) && this.isCloseEnough(this.dungeon.secretTarget, SECRET_WALL_RANGE) && this.isMostlyFacing(this.dungeon.secretTarget, 0.2);
  }

  isFacingGate() {
    return this.isCloseEnough(this.dungeon.gateTarget, INTERACT_RANGE) && this.isMostlyFacing(this.dungeon.gateTarget, 0.45);
  }

  isCloseEnough(target, range) {
    return this.horizontalDistanceTo(target) <= range;
  }

  horizontalDistanceTo(target) {
    const toTarget = target.clone().sub(this.player.position);
    toTarget.y = 0;
    return toTarget.length();
  }

  isMostlyFacing(target, requiredFacingAmount) {
    const toTarget = target.clone().sub(this.player.position);
    toTarget.y = 0;

    if (toTarget.lengthSq() === 0) {
      return true;
    }

    toTarget.normalize();
    return this.player.getLookDirection().dot(toTarget) > requiredFacingAmount;
  }
}
