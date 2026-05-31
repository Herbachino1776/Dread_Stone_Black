import * as THREE from 'three';

const ATTACK_POWER_COST = 4;
const ATTACK_RANGE = 1.72;
const ATTACK_FRONT_DOT = 0.58;
const ATTACK_DAMAGE = 1;
const ATTACK_COOLDOWN = 0.95;
const POWER_RECOVERY_RATE = 1.15;
const ENEMY_WAKE_RANGE = 6.4;
const ENEMY_STOP_RANGE = 1.05;
const ENEMY_SPEED = 0.52;
const ENEMY_ATTACK_RANGE = 1.16;
const ENEMY_ATTACK_DAMAGE = 12;
const ENEMY_ATTACK_COOLDOWN = 1.85;

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
    this.enemyAttackCooldown = 0;
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
    this.enemyAttackCooldown = Math.max(0, this.enemyAttackCooldown - deltaSeconds);

    if (this.isPlayerDead) {
      this.deathResetTimer -= deltaSeconds;
      if (this.deathResetTimer <= 0) this.resetEncounter();
      this.hud.updateStats({ hp: this.hp, power: this.power });
      return;
    }

    if (this.controls.consumeAttack()) {
      this.tryPlayerAttack();
    }

    this.updateEnemy(deltaSeconds);
    this.hud.updateStats({ hp: this.hp, power: this.power });
  }

  recoverPower(deltaSeconds) {
    this.power = Math.min(this.maxPower, this.power + POWER_RECOVERY_RATE * deltaSeconds);
  }

  tryPlayerAttack() {
    if (this.attackCooldown > 0) {
      this.hud.showMessage('Let the blade settle.');
      return;
    }

    if (this.power < ATTACK_POWER_COST) {
      this.hud.showMessage('You need POWER to swing. Step back and breathe.');
      return;
    }

    this.power -= ATTACK_POWER_COST;
    this.attackCooldown = ATTACK_COOLDOWN;
    this.hud.playSwordAttack();

    const enemy = this.dungeon.enemy;
    if (!enemy || enemy.dead) {
      this.hud.showMessage('Your sword cuts only stale air.');
      return;
    }

    const toEnemy = enemy.group.position.clone().sub(this.player.position);
    toEnemy.y = 0;
    const distance = toEnemy.length();
    const inFront = distance > 0 && this.player.getLookDirection().dot(toEnemy.normalize()) >= ATTACK_FRONT_DOT;

    if (distance <= ATTACK_RANGE && inFront) {
      const defeated = this.dungeon.damageEnemy(ATTACK_DAMAGE, this.player.getLookDirection());
      this.hud.showMessage(defeated ? 'The gate wretch collapses into dust.' : 'Your sword bites the gate wretch.');
    } else {
      this.hud.showMessage('The swing falls short. Keep your spacing.');
    }
  }

  updateEnemy(deltaSeconds) {
    const enemy = this.dungeon.enemy;
    if (!enemy || enemy.dead) return;

    const toPlayer = this.player.position.clone().sub(enemy.group.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();

    enemy.group.lookAt(this.player.position.x, enemy.group.position.y, this.player.position.z);

    if (distance <= ENEMY_WAKE_RANGE && distance > ENEMY_STOP_RANGE) {
      const step = toPlayer.normalize().multiplyScalar(ENEMY_SPEED * deltaSeconds);
      const next = enemy.group.position.clone().add(step);

      if (this.dungeon.collision.canStandAt(next)) {
        enemy.group.position.copy(next);
      }
    }

    if (distance <= ENEMY_ATTACK_RANGE && this.enemyAttackCooldown <= 0) {
      this.enemyAttackCooldown = ENEMY_ATTACK_COOLDOWN;
      this.damagePlayer(ENEMY_ATTACK_DAMAGE, enemy.group.position);
    }
  }

  damagePlayer(amount, sourcePosition) {
    this.hp = Math.max(0, this.hp - amount);
    this.hud.flashDamage();

    const away = this.player.position.clone().sub(sourcePosition);
    away.y = 0;
    if (away.lengthSq() > 0) {
      away.normalize().multiplyScalar(0.28);
      this.player.position = this.dungeon.collision.moveWithCollision(this.player.position, away);
      this.player.syncCamera();
    }

    if (this.hp <= 0) {
      this.isPlayerDead = true;
      this.deathResetTimer = 2.6;
      this.hud.showMessage('You fall in the dark. The reliquary pulls you back...');
    } else {
      this.hud.showMessage('The gate wretch claws you. Back away.');
    }
  }

  resetEncounter() {
    this.isPlayerDead = false;
    this.hp = this.maxHp;
    this.power = this.maxPower;
    this.attackCooldown = 0;
    this.enemyAttackCooldown = 0;
    this.player.reset();
    this.dungeon.resetEnemy();
    this.hud.showMessage('You wake at the threshold, wounded pride intact.');
  }
}
