const INTERACT_RANGE = 3.0;
const KEY_RANGE = 2.55;
const LEVER_RANGE = 2.5;
const INDOOR_EXIT_RANGE = 4.0;
const SHORTCUT_DOOR_RANGE = 2.55;
const SECRET_WALL_RANGE = 2.4;

export class Interactions {
  constructor({ player, dungeon, hud, feedback = null }) {
    this.player = player;
    this.dungeon = dungeon;
    this.hud = hud;
    this.feedback = feedback;
    this.hasKey = false;
    this.currentHint = '';
    this.feedbackHint = '';
    this.feedbackUntil = 0;
  }

  updateHint() {
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
        hint: 'Tap INTERACT to climb back to the tomb-field.',
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
    if (interaction.type === 'centralShrine') {
      return this.useCentralShrine(interaction);
    }

    this.setTemporaryHint(interaction.message, 1200);

    if (interaction.functional) {
      this.hud.showMessage(interaction.message);
      window.setTimeout(() => {
        window.location.assign(`${window.location.pathname}?area=dungeon`);
      }, 220);
      return false;
    }

    this.hud.showMessage(interaction.message);
    return false;
  }

  useIndoorExit() {
    this.setTemporaryHint('Cold field air seeps down the stair.', 900);
    window.setTimeout(() => {
      window.location.assign(`${window.location.pathname}?area=field&from=dungeon`);
    }, 160);
    return false;
  }

  setTemporaryHint(message, durationMs) {
    this.feedbackHint = message;
    this.feedbackUntil = Date.now() + durationMs;
    this.hud.showHint(message);
  }

  useInspectInteraction(interaction) {
    if (interaction.type === 'southReliquary') {
      return this.useSouthReliquary(interaction);
    }

    this.setTemporaryHint(interaction.message, 1200);
    this.hud.showMessage(interaction.message);
    return false;
  }

  useSouthReliquary(interaction) {
    const activated = this.dungeon.activateSouthReliquary();
    const message = activated ? 'The black reliquary wakes.' : interaction.message;
    this.setTemporaryHint(message, activated ? 1700 : 1200);
    this.hud.showMessage(message);

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

  pickUpKey() {
    if (!this.dungeon.collectKey()) return;

    this.hasKey = true;
    this.hud.showMessage('You take the tarnished reliquary key.');
  }

  useGate() {
    if (!this.hasKey) {
      this.hud.showMessage('The gate is locked.');
      return;
    }

    if (this.dungeon.openGate()) {
      this.hud.showMessage('The key turns. The iron gate groans upward.');
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
    }
  }

  useSecretWall() {
    if (this.dungeon.revealSecret()) {
      this.hud.showMessage('The cracked wall sinks with a dry scrape, exposing a candleless alcove.');
    } else {
      this.hud.showMessage('The alcove is empty, but the stones whisper back.');
    }
  }

  useLever() {
    if (this.dungeon.useLever()) {
      this.hud.showMessage('The switch snaps down. Stone rumbles somewhere nearby.');
    } else {
      this.hud.showMessage('The switch is already lowered.');
    }
  }

  getNearbyOutdoorInteraction() {
    if (!this.dungeon.outdoorInteractions?.length) return null;

    return this.dungeon.outdoorInteractions
      .map((interaction) => ({ interaction, distance: this.horizontalDistanceTo(interaction.target) }))
      .filter(({ interaction, distance }) => distance <= (interaction.range ?? 4))
      .sort((a, b) => a.distance - b.distance)[0]?.interaction ?? null;
  }

  getNearbyIndoorExit() {
    if (this.dungeon.area !== 'dungeon') return null;
    return this.isCloseEnough(this.dungeon.indoorExitTarget, INDOOR_EXIT_RANGE);
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
