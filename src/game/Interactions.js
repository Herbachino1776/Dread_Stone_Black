const INTERACT_RANGE = 2.65;
const KEY_RANGE = 2.25;
const LEVER_RANGE = 2.2;
const CRYPT_RANGE = 8.5;
const INDOOR_EXIT_RANGE = 3.1;

export class Interactions {
  constructor({ player, dungeon, hud }) {
    this.player = player;
    this.dungeon = dungeon;
    this.hud = hud;
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

    const outdoorCrypt = this.getNearbyOutdoorCrypt();
    if (outdoorCrypt) {
      return {
        hint: outdoorCrypt.functional
          ? `Tap INTERACT to test ${outdoorCrypt.label}'s black mouth.`
          : `${outdoorCrypt.label} is sealed by a dead stone slab.`,
        use: () => this.useOutdoorCrypt(outdoorCrypt),
      };
    }

    if (this.isNearKey()) {
      return {
        hint: 'Tap INTERACT to take the tarnished key.',
        use: () => this.pickUpKey(),
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

    if (this.isFacingGate()) {
      if (this.dungeon.gateOpen) {
        return {
          hint: 'The open gate breathes cold air from below.',
          use: () => this.hud.showMessage('The gate stands open.'),
        };
      }

      return {
        hint: this.hasKey ? 'Tap INTERACT to unlock the iron gate.' : 'Tap INTERACT to test the iron gate.',
        use: () => this.useGate(),
      };
    }

    return null;
  }

  useOutdoorCrypt(crypt) {
    if (crypt.functional) {
      this.setTemporaryHint('You descend through Crypt A into the Black Reliquary...', 900);
      window.setTimeout(() => {
        window.location.assign(`${window.location.pathname}?area=dungeon`);
      }, 160);
      return false;
    }

    this.setTemporaryHint(`${crypt.label} gives only a dead stone knock.`, 1400);
    this.hud.showMessage('The sealed tomb does not move. Fog gathers in its cracks.');
    return false;
  }

  useIndoorExit() {
    this.setTemporaryHint('Cold field air seeps down the entry stair...', 900);
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

  getNearbyOutdoorCrypt() {
    if (!this.dungeon.outdoorInteractions?.length) return null;

    return this.dungeon.outdoorInteractions
      .map((crypt) => ({ crypt, distance: this.horizontalDistanceTo(crypt.target) }))
      .filter(({ distance }) => distance <= CRYPT_RANGE)
      .sort((a, b) => a.distance - b.distance)[0]?.crypt ?? null;
  }

  getNearbyIndoorExit() {
    if (this.dungeon.area !== 'dungeon') return null;
    return this.isCloseEnough(this.dungeon.indoorExitTarget, INDOOR_EXIT_RANGE);
  }

  isNearKey() {
    return Boolean(this.dungeon.key) && this.isCloseEnough(this.dungeon.keyTarget, KEY_RANGE);
  }

  isNearLever() {
    return this.isCloseEnough(this.dungeon.leverTarget, LEVER_RANGE) && this.isMostlyFacing(this.dungeon.leverTarget, 0.15);
  }

  getShortcutHint() {
    if (this.dungeon.shortcutOpen) return 'The shortcut returns to the starting room.';
    if (this.player.position.x > -5.65) return 'A barred door waits beyond the western wall.';
    return 'Tap INTERACT to unbar the shortcut door.';
  }

  isFacingShortcutDoor() {
    return this.isCloseEnough(this.dungeon.shortcutTarget, 2.2) && this.isMostlyFacing(this.dungeon.shortcutTarget, 0.18);
  }

  isFacingSecretWall() {
    return this.isCloseEnough(this.dungeon.secretTarget, 2.05) && this.isMostlyFacing(this.dungeon.secretTarget, 0.2);
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
