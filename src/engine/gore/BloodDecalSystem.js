import * as THREE from 'three';

export const BLOOD_DECAL_TUNING = Object.freeze({
  freshBloodColor: 0xb00016,
  wetHighlightColor: 0xe02028,
  pooledBloodColor: 0x65000b,
  driedBloodColor: 0x2a0004,
  deathPoolScale: [1.4, 2.2],
  deathPoolGrowSeconds: [1.5, 2.6],
  decalOpacity: 0.74,
  wallSprayOpacity: 0.72,
});

function paintUnevenBlob(ctx, { x, y, radiusX, radiusY, points = 14, fillStyle }) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const wobble = 0.72 + Math.random() * 0.48;
    const px = x + Math.cos(angle) * radiusX * wobble;
    const py = y + Math.sin(angle) * radiusY * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function paintDrop(ctx, x, y, radius, alpha = 0.86) {
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function makeDecalTexture(kind = 'splat', variant = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.translate(64, 64);
  ctx.rotate((variant - 1) * 0.08);

  if (kind === 'pool') {
    ctx.scale(1.22 + Math.random() * 0.28, 0.78 + Math.random() * 0.18);
    paintUnevenBlob(ctx, { x: 0, y: 0, radiusX: 43, radiusY: 34, points: 22, fillStyle: 'rgba(45, 45, 45, 0.72)' });
    paintUnevenBlob(ctx, { x: -2, y: -1, radiusX: 35, radiusY: 27, points: 18, fillStyle: 'rgba(155, 155, 155, 0.72)' });
    paintUnevenBlob(ctx, { x: -8, y: 2, radiusX: 24, radiusY: 18, points: 14, fillStyle: 'rgba(255, 255, 255, 0.52)' });
    for (let i = 0; i < 12; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = 34 + Math.random() * 22;
      paintDrop(ctx, Math.cos(a) * r, Math.sin(a) * r * 0.72, 1.4 + Math.random() * 3.6, 0.42 + Math.random() * 0.28);
    }
  } else if (kind === 'slash' || kind === 'smear') {
    ctx.rotate(-0.14 + Math.random() * 0.16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.beginPath();
    ctx.moveTo(-56, -7 + Math.random() * 4);
    ctx.bezierCurveTo(-28, -13, 12, -8, 54, -3);
    ctx.lineTo(50, 6 + Math.random() * 4);
    ctx.bezierCurveTo(11, 10, -26, 8, -56, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(70, 70, 70, 0.5)';
    ctx.beginPath();
    ctx.moveTo(-52, 3);
    ctx.bezierCurveTo(-16, 8, 13, 10, 40, 17);
    ctx.lineTo(28, 22);
    ctx.bezierCurveTo(6, 16, -19, 14, -48, 8);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 9; i += 1) {
      paintDrop(ctx, -12 + Math.random() * 70, 11 + Math.random() * 23, 1.1 + Math.random() * 3.2, 0.46 + Math.random() * 0.34);
    }
  } else if (kind === 'spray') {
    ctx.rotate(-0.08 + Math.random() * 0.16);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i += 1) {
      const startY = -12 + Math.random() * 24;
      const length = 22 + Math.random() * 52;
      const angle = -0.42 + Math.random() * 0.84;
      ctx.lineWidth = 1.2 + Math.random() * 3.2;
      ctx.beginPath();
      ctx.moveTo(-42 + Math.random() * 14, startY);
      ctx.lineTo(-42 + Math.cos(angle) * length, startY + Math.sin(angle) * length * 0.72);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(160, 160, 160, 0.58)';
    for (let i = 0; i < 7; i += 1) {
      const x = -12 + Math.random() * 52;
      const y = -20 + Math.random() * 34;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 5, y + 16 + Math.random() * 34);
      ctx.stroke();
    }
    for (let i = 0; i < 15; i += 1) {
      paintDrop(ctx, -18 + Math.random() * 76, -32 + Math.random() * 64, 1 + Math.random() * 3.8, 0.42 + Math.random() * 0.38);
    }
  } else {
    for (let i = 0; i < 5; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 16;
      paintUnevenBlob(ctx, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist * 0.8,
        radiusX: 14 + Math.random() * 18,
        radiusY: 10 + Math.random() * 16,
        points: 12,
        fillStyle: i === 0 ? 'rgba(255, 255, 255, 0.78)' : 'rgba(190, 190, 190, 0.62)',
      });
    }
    paintUnevenBlob(ctx, { x: -2, y: 1, radiusX: 22, radiusY: 18, points: 16, fillStyle: 'rgba(255, 255, 255, 0.48)' });
    for (let i = 0; i < 16; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 38;
      paintDrop(ctx, Math.cos(a) * r, Math.sin(a) * r, 1 + Math.random() * 4.2, 0.36 + Math.random() * 0.4);
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

function chooseTexture(textures, type) {
  const variants = textures[type] ?? textures.splat;
  if (Array.isArray(variants)) return variants[Math.floor(Math.random() * variants.length)];
  return variants;
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
      splat: Array.from({ length: 4 }, (_, index) => makeDecalTexture('splat', index)),
      pool: Array.from({ length: 3 }, (_, index) => makeDecalTexture('pool', index)),
      spray: Array.from({ length: 4 }, (_, index) => makeDecalTexture('spray', index)),
      slash: Array.from({ length: 3 }, (_, index) => makeDecalTexture('slash', index)),
      smear: Array.from({ length: 3 }, (_, index) => makeDecalTexture('smear', index)),
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
      scale: randomBetween(scaleRange ?? (type === 'pool' ? profile.deathPoolScale : profile.hitDecalScale) ?? BLOOD_DECAL_TUNING.deathPoolScale),
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

    const isPool = type === 'pool';
    const isWallSpray = type === 'spray' || type === 'slash';
    const material = new THREE.MeshBasicMaterial({
      map: chooseTexture(this.textures, type),
      color: profile.freshBloodColor ?? profile.bloodColor ?? BLOOD_DECAL_TUNING.freshBloodColor,
      transparent: true,
      opacity: isPool
        ? profile.deathPoolOpacity ?? 0.82
        : isWallSpray
          ? profile.wallSprayOpacity ?? BLOOD_DECAL_TUNING.wallSprayOpacity
          : profile.decalOpacity ?? BLOOD_DECAL_TUNING.decalOpacity,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.name = `gore-decal-${this.decalSerial += 1}-${type}`;
    mesh.position.copy(position);
    if (quaternion) mesh.quaternion.copy(quaternion);
    else if (rotation) mesh.rotation.copy(rotation);
    const growSeconds = isPool ? randomBetween(profile.deathPoolGrowSeconds ?? BLOOD_DECAL_TUNING.deathPoolGrowSeconds) : 0;
    const initialScale = isPool ? Math.max(0.28, scale * 0.42) : scale;
    mesh.scale.set(initialScale, initialScale, 1);
    mesh.renderOrder = isPool ? 2 : 4;
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
      initialScale,
      finalScale: scale,
      growSeconds,
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
      if (decal.growSeconds > 0 && decal.age < decal.growSeconds) {
        const growT = decal.age / decal.growSeconds;
        const eased = 1 - (1 - growT) * (1 - growT);
        const nextScale = THREE.MathUtils.lerp(decal.initialScale, decal.finalScale, eased);
        decal.mesh.scale.set(nextScale, nextScale, 1);
      } else if (decal.growSeconds > 0 && decal.mesh.scale.x !== decal.finalScale) {
        decal.mesh.scale.set(decal.finalScale, decal.finalScale, 1);
      }
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
    Object.values(this.textures).flat().forEach((texture) => texture.dispose());
  }
}
