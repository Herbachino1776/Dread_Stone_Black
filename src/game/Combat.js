const ATTACK_POWER_COST = 4;
const ATTACK_COOLDOWN = 0.95;
const POWER_RECOVERY_RATE = 1.15;

export class Combat {
  constructor({ player, dungeon, hud, controls }) {
    this.player = player;
    this.dungeon = dungeon;
    this.hud = hud;
    this.controls = controls;
    this.maxPower = 10;
    this.power = this.maxPower;
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.attackCooldown = 0;
    this.deathResetTimer = 0;
    this.isPlayerDead = false;

    this.hud.updateStats({ hp: this.hp, power: this.power });
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        this.controls.queueAttack();
      }
    });
  }

  update(deltaSeconds) {
    this.recoverPower(deltaSeconds);
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaSeconds);

    if (this.isPlayerDead) {
      this.deathResetTimer -= deltaSeconds;
      if (this.deathResetTimer <= 0) this.resetEncounter();
      this.hud.updateStats({ hp: this.hp, power: this.power });
      return;
    }

    if (this.controls.consumeAttack()) {
      this.tryPlayerAttack();
    }
    this.hud.updateStats({ hp: this.hp, power: this.power });
  }

  recoverPower(deltaSeconds) {
    this.power = Math.min(this.maxPower, this.power + POWER_RECOVERY_RATE * deltaSeconds);
  }

  tryPlayerAttack() {
    if (this.attackCooldown > 0) {
      this.hud.showMessage('Let your arms settle.');
      return;
    }

    if (this.power < ATTACK_POWER_COST) {
      this.hud.showMessage('You need POWER to strike. Step back and breathe.');
      return;
    }

    this.power -= ATTACK_POWER_COST;
    this.attackCooldown = ATTACK_COOLDOWN;
    this.hud.playAttack();

    // Ram Man is friendly and non-targetable in this pass, so the attack remains a
    // first-person arms/power feedback test without damaging or aggroing any NPC.
    this.hud.showMessage('Your hands cut only stale air. Ram Man keeps his distance.');
  }

  resetEncounter() {
    this.isPlayerDead = false;
    this.hp = this.maxHp;
    this.power = this.maxPower;
    this.attackCooldown = 0;
    this.player.reset();
    this.hud.showMessage('You wake at the threshold, wounded pride intact.');
  }
}
