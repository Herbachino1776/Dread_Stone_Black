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

    const contactHit = this.dungeon.consumeEnemyContactDamage?.(this.player.position);
    if (contactHit) {
      this.applyPlayerDamage(contactHit.amount, contactHit.source);
    }

    if (this.controls.consumeAttack()) {
      this.tryPlayerAttack();
    }
    this.hud.updateStats({ hp: this.hp, power: this.power });
  }

  recoverPower(deltaSeconds) {
    this.power = Math.min(this.maxPower, this.power + POWER_RECOVERY_RATE * deltaSeconds);
  }

  applyPlayerDamage(amount, source = 'the enemy') {
    this.hp = Math.max(0, this.hp - amount);
    this.hud.flashDamage();

    if (this.hp <= 0) {
      this.isPlayerDead = true;
      this.deathResetTimer = 2.4;
      this.hud.showMessage(`${source} knocks you back into blackness.`);
      return;
    }

    this.hud.showMessage(`${source} burns your ribs. Back away.`);
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

    const hit = this.dungeon.damageEnemyFromPlayerAttack?.({
      position: this.player.position,
      direction: this.player.getLookDirection(),
    });

    if (!hit) {
      this.hud.showMessage('Your hands cut only stale air. Step closer and face the fiend.');
      return;
    }

    if (hit.killed) {
      this.hud.showMessage(`${hit.target} collapses but does not fade.`);
      return;
    }

    this.hud.showMessage(`${hit.target} staggers. ${hit.remainingHealth} HP remains.`);
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
