import * as THREE from 'three';

export const BLOOD_PARTICLE_TUNING = Object.freeze({
  freshBloodColor: 0xb00016,
  wetHighlightColor: 0xe02028,
  pooledBloodColor: 0x65000b,
  driedBloodColor: 0x2a0004,
  hitParticleOpacity: 0.9,
  dropletGravity: 3.65,
});

function makeParticleTexture(kind = 'droplet') {
  const canvas = document.createElement('canvas');
  canvas.width = kind === 'streak' ? 64 : 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  if (kind === 'streak') {
    const gradient = ctx.createLinearGradient(5, 16, 62, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    gradient.addColorStop(0.48, 'rgba(235, 235, 235, 0.72)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(4, 13);
    ctx.bezierCurveTo(18, 7, 42, 9, 62, 14);
    ctx.lineTo(62, 19);
    ctx.bezierCurveTo(39, 22, 16, 22, 4, 18);
    ctx.closePath();
    ctx.fill();
  } else {
    const gradient = ctx.createRadialGradient(15, 15, 1, 15, 15, 16);
    if (kind === 'mist' || kind === 'vapor') {
      gradient.addColorStop(0, 'rgba(120, 120, 120, 0.34)');
      gradient.addColorStop(0.48, 'rgba(48, 48, 48, 0.16)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else if (kind === 'highlight') {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.38, 'rgba(245, 245, 245, 0.88)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      gradient.addColorStop(0.46, 'rgba(185, 185, 185, 0.86)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function randomBetween([min, max]) {
  return min + Math.random() * (max - min);
}

export class BloodParticlePool {
  constructor({ scene, budget }) {
    this.scene = scene;
    this.budget = budget;
    this.group = new THREE.Group();
    this.group.name = 'gore-particle-pool';
    this.scene.add(this.group);
    this.textures = {
      droplet: makeParticleTexture('droplet'),
      highlight: makeParticleTexture('highlight'),
      streak: makeParticleTexture('streak'),
      mist: makeParticleTexture('mist'),
      chunky: makeParticleTexture('droplet'),
      vapor: makeParticleTexture('vapor'),
    };
    this.pool = [];
    this.active = new Set();
    this.tempDirection = new THREE.Vector3();

    for (let i = 0; i < this.budget.particleLimit; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: this.textures.droplet,
        color: BLOOD_PARTICLE_TUNING.freshBloodColor,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        blending: THREE.NormalBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = 5;
      sprite.userData.goreParticle = {
        velocity: new THREE.Vector3(),
        age: 0,
        life: 0,
        baseOpacity: 0,
        spin: 0,
        gravity: BLOOD_PARTICLE_TUNING.dropletGravity,
      };
      this.group.add(sprite);
      this.pool.push(sprite);
    }
  }

  resolveParticleKind({ requestedType, profile, index, spawnCount }) {
    if (requestedType === 'vapor') return 'vapor';
    if (requestedType === 'mist') return Math.random() < 0.58 ? 'droplet' : 'mist';
    if (requestedType === 'chunky') {
      if (Math.random() < (profile.streakParticleChance ?? 0.22)) return 'streak';
      if (Math.random() < (profile.brightDropletChance ?? 0.14)) return 'highlight';
      return 'chunky';
    }
    if (index < Math.max(1, Math.floor(spawnCount * (profile.brightDropletChance ?? 0.16)))) return 'highlight';
    if (Math.random() < (profile.streakParticleChance ?? 0.24)) return 'streak';
    return 'droplet';
  }

  spawnBurst({ position, direction, profile, count, type = 'droplet', strength = 1 }) {
    const available = this.budget.particleLimit - this.active.size;
    const spawnCount = Math.max(0, Math.min(count, available));
    if (spawnCount <= 0) return 0;

    this.tempDirection.copy(direction ?? new THREE.Vector3(0, 0.2, 1));
    if (this.tempDirection.lengthSq() < 0.0001) this.tempDirection.set(0, 0.2, 1);
    this.tempDirection.normalize();

    for (let i = 0; i < spawnCount; i += 1) {
      const sprite = this.pool.find((candidate) => !candidate.visible);
      if (!sprite) break;
      const data = sprite.userData.goreParticle;
      const particleKind = this.resolveParticleKind({ requestedType: type, profile, index: i, spawnCount });
      const isEthereal = particleKind === 'mist' || particleKind === 'vapor';
      const isStreak = particleKind === 'streak';
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * (isEthereal ? 1.15 : 0.68),
        (isEthereal ? Math.random() * 0.42 + 0.08 : Math.random() * 0.36 + 0.08),
        (Math.random() - 0.5) * (isEthereal ? 1.15 : 0.68),
      );
      const burstDirection = this.tempDirection.clone().multiplyScalar(profile.sprayStrength ?? 1).add(spread).normalize();
      const fleckWeight = particleKind === 'chunky' ? 1.18 : isEthereal ? 0.44 : isStreak ? 1.05 : 0.88;
      data.velocity.copy(burstDirection.multiplyScalar((0.9 + Math.random() * 1.45) * strength * fleckWeight));
      data.velocity.y += isStreak ? 0.04 : Math.random() * 0.18;
      data.age = 0;
      data.life = (profile.particleLifeSeconds ?? 0.5) * (isEthereal ? 0.78 : 0.86 + Math.random() * 0.42);
      data.baseOpacity = isEthereal
        ? profile.mistOpacity ?? 0.22
        : profile.hitParticleOpacity ?? profile.particleOpacity ?? BLOOD_PARTICLE_TUNING.hitParticleOpacity;
      if (particleKind === 'highlight') data.baseOpacity = Math.min(1, data.baseOpacity + 0.06);
      data.spin = (Math.random() - 0.5) * (isStreak ? 7 : 5);
      data.gravity = isEthereal ? (profile.dropletGravity ?? BLOOD_PARTICLE_TUNING.dropletGravity) * 0.48 : profile.dropletGravity ?? BLOOD_PARTICLE_TUNING.dropletGravity;
      sprite.position.copy(position);
      sprite.position.y += 0.16 + Math.random() * 0.42;
      const size = randomBetween(isStreak ? profile.streakParticleSize ?? [0.11, 0.28] : profile.particleSize ?? [0.06, 0.16]);
      if (isStreak) sprite.scale.set(size * (1.7 + Math.random() * 0.8), size * (0.35 + Math.random() * 0.2), 1);
      else sprite.scale.setScalar(size * (isEthereal ? 1.55 : particleKind === 'chunky' ? 1.22 : 1));
      sprite.material.map = this.textures[particleKind] ?? this.textures.droplet;
      sprite.material.color.setHex(
        particleKind === 'highlight'
          ? profile.wetHighlightColor ?? BLOOD_PARTICLE_TUNING.wetHighlightColor
          : profile.freshBloodColor ?? profile.bloodColor ?? BLOOD_PARTICLE_TUNING.freshBloodColor,
      );
      sprite.material.opacity = data.baseOpacity;
      sprite.material.rotation = Math.atan2(data.velocity.y, Math.hypot(data.velocity.x, data.velocity.z)) + (Math.random() - 0.5) * 0.8;
      sprite.visible = true;
      this.active.add(sprite);
    }

    return spawnCount;
  }

  update(deltaSeconds) {
    this.active.forEach((sprite) => {
      const data = sprite.userData.goreParticle;
      data.age += deltaSeconds;
      if (data.age >= data.life) {
        this.release(sprite);
        return;
      }
      data.velocity.y -= data.gravity * deltaSeconds;
      sprite.position.addScaledVector(data.velocity, deltaSeconds);
      sprite.material.rotation += data.spin * deltaSeconds;
      const t = data.age / data.life;
      sprite.material.opacity = data.baseOpacity * (1 - t) * (1 - t * 0.18);
    });
  }

  release(sprite) {
    sprite.visible = false;
    sprite.material.opacity = 0;
    this.active.delete(sprite);
  }

  clearAll() {
    [...this.active].forEach((sprite) => this.release(sprite));
  }

  get activeCount() {
    return this.active.size;
  }

  dispose() {
    this.clearAll();
    this.group.removeFromParent();
    this.pool.forEach((sprite) => sprite.material.dispose());
    Object.values(this.textures).forEach((texture) => texture.dispose());
  }
}
