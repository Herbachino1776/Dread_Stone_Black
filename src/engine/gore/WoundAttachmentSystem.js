import * as THREE from 'three';

const DEV = import.meta.env.DEV;
const STABLE_TARGET_FLAGS = Object.freeze([
  'creatureActor',
  'blackGrassTempleFactionEnemy',
  'standaloneSheepDemonEnemy',
  'hostile',
]);

function makeWoundTexture(type = 'slash') {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.translate(32, 32);
  ctx.fillStyle = 'rgba(12, 0, 2, 0.84)';
  ctx.strokeStyle = 'rgba(42, 0, 8, 0.82)';
  ctx.lineCap = 'round';

  if (type === 'puncture') {
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(8, 7, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'leak') {
    ctx.fillRect(-4, -22, 8, 36);
    ctx.beginPath();
    ctx.arc(0, 18, 8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(-0.25);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-24, -2);
    ctx.lineTo(22, 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-15, 8);
    ctx.lineTo(12, 12);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function hasStableTargetFlag(object) {
  return STABLE_TARGET_FLAGS.some((flag) => object?.userData?.[flag]);
}

function resolveStableTargetRoot(targetRoot) {
  if (!targetRoot) return null;
  let current = targetRoot;
  while (current?.parent && current.parent.type !== 'Scene') {
    if (hasStableTargetFlag(current.parent)) return current.parent;
    current = current.parent;
  }
  return hasStableTargetFlag(targetRoot) ? targetRoot : current ?? targetRoot;
}

function isTargetStillValid(targetRoot) {
  if (!targetRoot) return false;
  if (targetRoot.type === 'Scene') return true;
  if (!targetRoot.parent) return false;
  if (targetRoot.userData?.isRemoved || targetRoot.userData?.disposed || targetRoot.userData?.bodyWoundsShouldClear) return false;
  return true;
}

function ensureTargetWoundList(targetRoot) {
  if (!targetRoot.userData.goreBodyWounds) targetRoot.userData.goreBodyWounds = [];
  return targetRoot.userData.goreBodyWounds;
}

function removeTargetWoundReference(targetRoot, woundId) {
  const woundIds = targetRoot?.userData?.goreBodyWounds;
  if (!Array.isArray(woundIds)) return;
  const index = woundIds.indexOf(woundId);
  if (index >= 0) woundIds.splice(index, 1);
}

export class WoundAttachmentSystem {
  constructor({ budget }) {
    this.budget = budget;
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.textures = {
      slash: makeWoundTexture('slash'),
      puncture: makeWoundTexture('puncture'),
      leak: makeWoundTexture('leak'),
    };
    this.wounds = [];
    this.serial = 0;
    this.warnedInvalidTargets = new Set();
  }

  attachWound({ targetRoot, position, normal, creatureId, targetId = null, profile, type = null, lifetimeSeconds = 26 }) {
    const attachmentRoot = resolveStableTargetRoot(targetRoot);
    const budgetId = targetId ?? creatureId;
    if (!attachmentRoot || !budgetId || !this.budget.canAttachWound(budgetId)) return null;
    const woundType = type ?? profile.woundType ?? 'slash';
    const material = new THREE.MeshBasicMaterial({
      map: this.textures[woundType] ?? this.textures.slash,
      color: profile.woundColor ?? profile.bloodColor ?? 0x160005,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.name = `gore-wound-${this.serial += 1}-${creatureId}`;
    mesh.renderOrder = 6;
    mesh.userData = { goreWound: true, creatureId, type: woundType };

    attachmentRoot.updateMatrixWorld(true);
    const localPosition = attachmentRoot.worldToLocal(position.clone());
    if (!Number.isFinite(localPosition.x)) localPosition.set(0, 1.1, 0.18);
    localPosition.y = Math.max(localPosition.y, 0.75);
    mesh.position.copy(localPosition);

    const localNormal = normal?.clone?.() ?? new THREE.Vector3(0, 0, 1);
    const worldQuaternion = attachmentRoot.getWorldQuaternion(new THREE.Quaternion());
    localNormal.applyQuaternion(worldQuaternion.invert());
    localNormal.y *= 0.15;
    if (localNormal.lengthSq() < 0.0001) localNormal.set(0, 0, 1);
    localNormal.normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), localNormal);
    const scale = profile.woundScale ?? 0.58;
    mesh.scale.set(scale, scale * 0.42, 1);
    attachmentRoot.add(mesh);

    const wound = {
      id: mesh.name,
      mesh,
      creatureId,
      targetId: budgetId,
      budgetId,
      targetRoot: attachmentRoot,
      age: 0,
      lifetimeSeconds,
      baseOpacity: material.opacity,
    };
    this.wounds.push(wound);
    ensureTargetWoundList(attachmentRoot).push(wound.id);
    this.budget.trackWound(budgetId);
    return wound.id;
  }

  update(deltaSeconds) {
    for (let i = this.wounds.length - 1; i >= 0; i -= 1) {
      const wound = this.wounds[i];
      wound.age += deltaSeconds;
      if (!wound.mesh.parent || !isTargetStillValid(wound.targetRoot)) {
        this.warnInvalidTargetOnce(wound);
        this.removeWound(wound);
        continue;
      }
      const t = wound.age / wound.lifetimeSeconds;
      if (t > 0.7) wound.mesh.material.opacity = wound.baseOpacity * (1 - (t - 0.7) / 0.3);
      if (wound.age >= wound.lifetimeSeconds) this.removeWound(wound);
    }
  }

  warnInvalidTargetOnce(wound) {
    if (!DEV) return;
    const key = wound.targetId ?? wound.creatureId ?? wound.id;
    if (this.warnedInvalidTargets.has(key)) return;
    this.warnedInvalidTargets.add(key);
    console.warn(`Removed orphaned body wound decal for ${key}; target root is no longer valid.`);
  }

  removeWound(wound) {
    const index = this.wounds.indexOf(wound);
    if (index >= 0) this.wounds.splice(index, 1);
    this.budget.untrackWound(wound.budgetId ?? wound.targetId ?? wound.creatureId);
    removeTargetWoundReference(wound.targetRoot, wound.id);
    wound.mesh.removeFromParent();
    wound.mesh.material.dispose();
  }

  clearWoundsForTarget(targetId) {
    if (!targetId) return;
    [...this.wounds]
      .filter((wound) => wound.targetId === targetId || wound.creatureId === targetId)
      .forEach((wound) => this.removeWound(wound));
  }

  clearWoundsForObject(object) {
    if (!object) return;
    const attachmentRoot = resolveStableTargetRoot(object);
    [...this.wounds]
      .filter((wound) => wound.targetRoot === attachmentRoot || wound.mesh.parent === attachmentRoot)
      .forEach((wound) => this.removeWound(wound));
  }

  disposeTargetWounds(targetId) {
    this.clearWoundsForTarget(targetId);
  }

  updateAttachedWounds(deltaSeconds) {
    this.update(deltaSeconds);
  }

  clearAll() {
    [...this.wounds].forEach((wound) => this.removeWound(wound));
  }

  get count() {
    return this.wounds.length;
  }

  dispose() {
    this.clearAll();
    this.geometry.dispose();
    Object.values(this.textures).forEach((texture) => texture.dispose());
  }
}
