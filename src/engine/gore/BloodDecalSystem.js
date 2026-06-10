import * as THREE from 'three';

function makeDecalTexture(kind = 'splat') {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 96, 96);
  ctx.translate(48, 48);
  ctx.fillStyle = 'rgba(23, 0, 4, 0.82)';

  if (kind === 'pool') {
    ctx.scale(1.28, 0.82);
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(4, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.arc(-7, 4, 20, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'slash' || kind === 'smear') {
    ctx.rotate(-0.18);
    ctx.fillRect(-40, -5, 76, 10);
    ctx.fillRect(-22, 5, 38, 5);
  } else if (kind === 'spray') {
    for (let i = 0; i < 18; i += 1) {
      const r = 4 + Math.random() * 34;
      const a = -0.9 + Math.random() * 1.8;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.55;
      ctx.beginPath();
      ctx.arc(x, y, 2 + Math.random() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 13; i += 1) {
      const x = (Math.random() - 0.5) * 52;
      const y = (Math.random() - 0.5) * 42;
      ctx.beginPath();
      ctx.arc(x, y, 4 + Math.random() * 13, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function randomBetween([min, max]) {
  return min + Math.random() * (max - min);
}

export class BloodDecalSystem {
  constructor({ scene, budget }) {
    this.scene = scene;
    this.budget = budget;
    this.group = new THREE.Group();
    this.group.name = 'gore-decal-system';
    this.scene.add(this.group);
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.textures = {
      splat: makeDecalTexture('splat'),
      pool: makeDecalTexture('pool'),
      spray: makeDecalTexture('spray'),
      slash: makeDecalTexture('slash'),
      smear: makeDecalTexture('smear'),
    };
    this.decals = [];
    this.decalSerial = 0;
  }

  addFloorDecal({ position, roomId, profile, type = 'splat', scaleRange = null, floorY = 0, lifetimeSeconds = 42 }) {
    return this.addDecal({
      position: new THREE.Vector3(position.x, floorY + 0.018 + Math.random() * 0.012, position.z),
      rotation: new THREE.Euler(-Math.PI / 2, 0, Math.random() * Math.PI * 2),
      roomId,
      profile,
      type,
      scale: randomBetween(scaleRange ?? profile.hitDecalScale ?? [0.34, 0.74]),
      lifetimeSeconds,
    });
  }

  addWallDecal({ position, normal, roomId, profile, type = 'spray', lifetimeSeconds = 32 }) {
    const wallNormal = normal?.clone?.() ?? new THREE.Vector3(0, 0, 1);
    wallNormal.y = 0;
    if (wallNormal.lengthSq() < 0.0001) wallNormal.set(0, 0, 1);
    wallNormal.normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), wallNormal);
    const decalPosition = position.clone().addScaledVector(wallNormal, 0.035);
    decalPosition.y = Math.max(0.42, decalPosition.y);

    return this.addDecal({
      position: decalPosition,
      quaternion: quat,
      roomId,
      profile,
      type,
      scale: randomBetween(profile.wallDecalScale ?? [0.44, 0.98]),
      lifetimeSeconds,
    });
  }

  addDecal({ position, rotation = null, quaternion = null, roomId, profile, type, scale, lifetimeSeconds }) {
    this.trimForBudget(roomId);

    const material = new THREE.MeshBasicMaterial({
      map: this.textures[type] ?? this.textures.splat,
      color: profile.bloodColor ?? 0x240006,
      transparent: true,
      opacity: type === 'pool' ? profile.deathPoolOpacity ?? 0.72 : 0.66,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.name = `gore-decal-${this.decalSerial += 1}-${type}`;
    mesh.position.copy(position);
    if (quaternion) mesh.quaternion.copy(quaternion);
    else if (rotation) mesh.rotation.copy(rotation);
    mesh.scale.set(scale, scale, 1);
    mesh.renderOrder = type === 'pool' ? 2 : 4;
    mesh.userData = { goreDecal: true, roomId, type };
    this.group.add(mesh);

    const decal = {
      id: mesh.name,
      mesh,
      roomId,
      type,
      age: 0,
      lifetimeSeconds,
      baseOpacity: material.opacity,
    };
    this.decals.push(decal);
    this.budget.trackDecal(roomId);
    return decal.id;
  }

  trimForBudget(roomId) {
    while (
      this.decals.length >= this.budget.decalGlobalLimit
      || this.budget.getRoomDecalCount(roomId) >= this.budget.decalRoomLimit
    ) {
      this.removeDecal(this.decals[0]);
      if (!this.decals.length) break;
    }
  }

  update(deltaSeconds) {
    for (let i = this.decals.length - 1; i >= 0; i -= 1) {
      const decal = this.decals[i];
      decal.age += deltaSeconds;
      const t = decal.age / decal.lifetimeSeconds;
      if (t >= 1) {
        this.removeDecal(decal);
      } else if (t > 0.72) {
        decal.mesh.material.opacity = decal.baseOpacity * (1 - (t - 0.72) / 0.28);
      }
    }
  }

  removeDecal(decal) {
    const index = this.decals.indexOf(decal);
    if (index >= 0) this.decals.splice(index, 1);
    this.budget.untrackDecal(decal.roomId);
    decal.mesh.removeFromParent();
    decal.mesh.material.dispose();
  }

  clearRoom(roomId) {
    [...this.decals].filter((decal) => decal.roomId === roomId).forEach((decal) => this.removeDecal(decal));
  }

  clearAll() {
    [...this.decals].forEach((decal) => this.removeDecal(decal));
  }

  get count() {
    return this.decals.length;
  }

  dispose() {
    this.clearAll();
    this.group.removeFromParent();
    this.geometry.dispose();
    Object.values(this.textures).forEach((texture) => texture.dispose());
  }
}

