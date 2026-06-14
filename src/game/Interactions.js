import { OBJECTIVE_EVENTS } from '../engine/objectives/ObjectiveEvents.js';
import { EQUIPMENT_SLOTS } from '../engine/equipment/EquipmentSlot.js';

const INTERACT_RANGE = 3.0;
const KEY_RANGE = 2.55;
const LEVER_RANGE = 2.5;
const INDOOR_EXIT_RANGE = 4.0;
const SHORTCUT_DOOR_RANGE = 2.55;
const SECRET_WALL_RANGE = 2.4;

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
  }

  updateHint() {
    this.hud.updateFieldKitStatus?.(this.dungeon.gameState?.getFieldSurvivalSnapshot?.(), { visible: this.dungeon.area === 'field' });
    const hint = Date.now() < this.feedbackUntil
      ? this.feedbackHint
      : this.getNearbyInteraction()?.hint ?? '';

    if (hint !== this.currentHint) {
      this.currentHint = hint;
      this.hud.showHint(hint);
    }
  }

  interact() {
    const interaction = this.getNearbyInteraction();

    if (!interaction) {
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

    const fieldCampfireCraft = this.getOpenGroundCampfireCraftInteraction();
    if (fieldCampfireCraft) {
      return {
        hint: fieldCampfireCraft.hint,
        use: () => this.useOutdoorInteraction(fieldCampfireCraft),
      };
    }

    const outdoorInteraction = this.getNearbyOutdoorInteraction();
    if (outdoorInteraction) {
      return {
        hint: outdoorInteraction.hint,
        use: () => this.useOutdoorInteraction(outdoorInteraction),
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

    if (interaction.type === 'fieldCampfireCraft') {
      return this.useFieldCampfireCraft(interaction);
    }

    if (interaction.type === 'fieldCampfire') {
      return this.useFieldCampfire(interaction);
    }

    this.setTemporaryHint(interaction.message, 1200);

    if (interaction.functional) {
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

  useFieldSurvivalChest(interaction) {
    if (this.dungeon.gameState?.hasOpenedFieldChest?.(interaction.id)) {
      const repeatMessage = interaction.repeatMessage ?? 'The chest lies open and empty.';
      this.setTemporaryHint(repeatMessage, 1200);
      this.hud.showMessage(repeatMessage);
      return false;
    }

    this.dungeon.gameState?.markFieldChestOpened?.(interaction.id);
    this.dungeon.gameState?.addFieldItem?.(interaction.itemId);
    const chest = this.dungeon.fieldSurvivalObjects?.get(interaction.id);
    if (chest) {
      chest.children.forEach((child) => {
        if (child.geometry?.type === 'BoxGeometry' && child.position.y > 0.6) {
          child.position.set(0, 0.92, -0.42);
          child.rotation.x = -0.72;
        }
      });
    }
    interaction.hint = interaction.repeatHint ?? 'The chest lies open and empty.';
    interaction.message = interaction.repeatMessage ?? 'The chest lies open and empty.';
    const message = interaction.acquiredMessage ?? 'You acquire an item.';
    const readyMessage = this.dungeon.gameState?.getFieldItemCount?.('wood') >= 1 && this.dungeon.gameState?.hasFieldItem?.('flint_stick')
      ? ' Wood and Flint Stick ready. Hold INTERACT in open ground to build campfire.'
      : '';
    this.hud.updateFieldKitStatus?.(this.dungeon.gameState?.getFieldSurvivalSnapshot?.(), { visible: this.dungeon.area === 'field' });
    this.setTemporaryHint(`${message}${readyMessage}`, 2400);
    this.hud.showMessage(`${message}${readyMessage}`);
    return false;
  }

  useFieldHarvestableTree(interaction) {
    if (this.dungeon.gameState?.hasHarvestedFieldTree?.(interaction.id)) {
      this.setTemporaryHint('The chopped stump is dry and bare.', 1200);
      return false;
    }

    if (!this.dungeon.gameState?.hasFieldItem?.('field_axe')) {
      this.setTemporaryHint('A tool is needed.', 1200);
      this.hud.showMessage('A tool is needed.');
      return false;
    }

    this.setTemporaryHint('Chop tree', 700);
    this.dungeon.gameState?.markFieldTreeHarvested?.(interaction.id);
    this.dungeon.gameState?.addFieldItem?.('wood', 1);
    if (interaction.treeObject) interaction.treeObject.visible = false;
    this.dungeon.addFieldStump?.(interaction.stumpPosition, interaction.id);
    interaction.hint = 'The chopped stump is dry and bare.';
    interaction.message = 'The chopped stump is dry and bare.';
    window.setTimeout(() => {
      const message = this.dungeon.gameState?.hasFieldItem?.('flint_stick')
        ? 'Harvested Wood. Wood and Flint Stick ready. Hold INTERACT in open ground to build campfire.'
        : 'Harvested Wood. Find Flint Stick to build a campfire.';
      this.hud.updateFieldKitStatus?.(this.dungeon.gameState?.getFieldSurvivalSnapshot?.(), { visible: this.dungeon.area === 'field' });
      this.setTemporaryHint(message, 2400);
      this.hud.showMessage(message);
    }, 250);
    return false;
  }

  useFieldCampfireCraft(interaction = null) {
    if (this.dungeon.gameState?.hasFieldCampfireBuilt?.()) {
      this.setTemporaryHint('Use campfire', 900);
      return false;
    }

    if (
      this.dungeon.gameState?.getFieldItemCount?.('wood') < 1
      || !this.dungeon.gameState?.hasFieldItem?.('flint_stick')
    ) {
      this.setTemporaryHint('Need Wood and Flint Stick.', 1400);
      this.hud.showMessage('Need Wood and Flint Stick.');
      return false;
    }

    const placeAt = interaction?.placement ?? this.dungeon.getFieldCampfirePlacement?.(this.player);
    if (!placeAt || !this.dungeon.isFieldCampfireOpenGround?.(placeAt)) {
      this.setTemporaryHint('Need open ground.', 1400);
      this.hud.showMessage('Need open ground.');
      return false;
    }

    if (!this.dungeon.gameState?.consumeFieldItems?.({ wood: 1, flint_stick: 1 })) {
      this.setTemporaryHint('Need Wood and Flint Stick.', 1400);
      return false;
    }

    placeAt.y = 0;
    this.dungeon.gameState?.markFieldCampfireBuilt?.(placeAt);
    this.dungeon.addFieldCampfire?.(placeAt);
    this.hud.updateFieldKitStatus?.(this.dungeon.gameState?.getFieldSurvivalSnapshot?.(), { visible: this.dungeon.area === 'field' });
    this.setTemporaryHint('Built Campfire.', 1600);
    this.hud.showMessage('Built Campfire.');
    return false;
  }

  useFieldCampfire(interaction) {
    // TODO: Route this interaction into the future cooking system once recipes exist.
    this.setTemporaryHint(interaction.message ?? 'The fire is ready for cooking.', 1400);
    this.hud.showMessage(interaction.message ?? 'The fire is ready for cooking.');
    return false;
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
    if (this.dungeon.area !== 'field' || this.dungeon.gameState?.hasFieldCampfireBuilt?.()) return null;
    const hasIngredients = this.dungeon.gameState?.getFieldItemCount?.('wood') >= 1
      && this.dungeon.gameState?.hasFieldItem?.('flint_stick');
    if (!hasIngredients) return null;

    const placement = this.dungeon.getFieldCampfirePlacement?.(this.player);
    return {
      id: 'field_survival_open_ground_campfire',
      label: 'Campfire Crafting',
      target: placement ?? this.player.position,
      range: 99,
      hint: placement ? 'Build Campfire: Use Wood + Flint Stick' : 'Need open ground.',
      message: placement ? 'Built Campfire.' : 'Need open ground.',
      type: 'fieldCampfireCraft',
      placement,
      openGroundCraft: true,
    };
  }

  getNearbyOutdoorInteraction() {
    if (!this.dungeon.outdoorInteractions?.length) return null;

    return this.dungeon.outdoorInteractions
      .filter((interaction) => this.isOutdoorInteractionAvailable(interaction))
      .map((interaction) => ({ interaction: this.decorateOutdoorInteraction(interaction), distance: this.horizontalDistanceTo(interaction.target) }))
      .filter(({ interaction, distance }) => distance <= (interaction.range ?? 4))
      .sort((a, b) => a.distance - b.distance)[0]?.interaction ?? null;
  }

  isOutdoorInteractionAvailable(interaction) {
    if (interaction.type === 'fieldCampfireCraft') {
      return this.dungeon.area === 'field' && !this.dungeon.gameState?.hasFieldCampfireBuilt?.();
    }
    return true;
  }

  decorateOutdoorInteraction(interaction) {
    if (interaction.type === 'fieldHarvestableTree' && !this.dungeon.gameState?.hasHarvestedFieldTree?.(interaction.id)) {
      interaction.hint = this.dungeon.gameState?.hasFieldItem?.('field_axe') ? 'Chop tree' : 'A tool is needed.';
    }
    if (interaction.type === 'fieldCampfireCraft') {
      const hasIngredients = this.dungeon.gameState?.getFieldItemCount?.('wood') >= 1
        && this.dungeon.gameState?.hasFieldItem?.('flint_stick');
      interaction.hint = hasIngredients ? 'Build Campfire: Use Wood + Flint Stick' : 'Need Wood and Flint Stick.';
      interaction.message = hasIngredients ? 'Built Campfire.' : 'Need Wood and Flint Stick.';
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
