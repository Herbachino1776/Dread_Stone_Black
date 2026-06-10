import * as THREE from 'three';

function makeParticleTexture(kind = 'droplet') {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(15, 15, 1, 15, 15, 16);
  if (kind === 'mist' || kind === 'vapor') {
    gradient.addColorStop(0, 'rgba(65, 0, 12, 0.58)');
    gradient.addColorStop(0.45, 'rgba(24, 0, 7, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  } else {
    gradient.addColorStop(0, 'rgba(32, 0, 5, 0.95)');
    gradient.addColorStop(0.42, 'rgba(14, 0, 2, 0.86)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);

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
        color: 0x240006,
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
      };
      this.group.add(sprite);
      this.pool.push(sprite);
    }
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
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 0.9,
        Math.random() * 0.65 + 0.12,
        (Math.random() - 0.5) * 0.9,
      );
      const burstDirection = this.tempDirection.clone().multiplyScalar(profile.sprayStrength ?? 1).add(spread).normalize();
      const fleckWeight = type === 'chunky' ? 1.2 : type === 'mist' || type === 'vapor' ? 0.55 : 0.85;
      data.velocity.copy(burstDirection.multiplyScalar((0.85 + Math.random() * 1.7) * strength * fleckWeight));
      data.age = 0;
      data.life = (profile.particleLifeSeconds ?? 0.62) * (0.72 + Math.random() * 0.55);
      data.baseOpacity = type === 'mist' || type === 'vapor' ? profile.mistOpacity ?? 0.42 : profile.particleOpacity ?? 0.78;
      data.spin = (Math.random() - 0.5) * 5;
      sprite.position.copy(position);
      sprite.position.y += 0.2 + Math.random() * 0.55;
      const size = randomBetween(profile.particleSize ?? [0.045, 0.12]) * (type === 'mist' || type === 'vapor' ? 2.2 : 1);
      sprite.scale.setScalar(size);
      sprite.material.map = this.textures[type] ?? this.textures.droplet;
      sprite.material.color.setHex(profile.bloodColor ?? 0x240006);
      sprite.material.opacity = data.baseOpacity;
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
      data.velocity.y -= 2.35 * deltaSeconds;
      sprite.position.addScaledVector(data.velocity, deltaSeconds);
      sprite.material.rotation += data.spin * deltaSeconds;
      const t = data.age / data.life;
      sprite.material.opacity = data.baseOpacity * (1 - t) * (1 - t * 0.35);
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

