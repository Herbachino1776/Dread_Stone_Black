export class Interactions {
  constructor({ player, dungeon, hud }) {
    this.player = player;
    this.dungeon = dungeon;
    this.hud = hud;
  }

  interact() {
    if (this.isFacingLockedGate()) {
      this.hud.showMessage('The gate is locked.');
      return;
    }

    this.hud.showMessage('Nothing answers your touch.');
  }

  isFacingLockedGate() {
    const toGate = this.dungeon.gateTarget.clone().sub(this.player.position);
    const distance = toGate.length();

    if (distance > 2.8) {
      return false;
    }

    toGate.y = 0;
    toGate.normalize();
    const facingAmount = this.player.getLookDirection().dot(toGate);
    return facingAmount > 0.45;
  }
}
