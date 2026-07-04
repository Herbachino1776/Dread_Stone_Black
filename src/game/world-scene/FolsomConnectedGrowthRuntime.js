import * as THREE from 'three';
import {
  BLACK_GROWTH_TEXTURES,
  configureBlackGrowthTexture,
  createBlackGrowthKnotMaterial,
  createBlackGrowthPlaneMaterial,
  loadBlackGrowthTexture,
  loadWrappedBlackGrowthTexture,
} from './BlackGrowthVisuals.js';

const UP = new THREE.Vector3(0, 1, 0);
const RIBBON_SAMPLE_LENGTH = 2.1;
const RIBBON_Y_OFFSET = 0.052;
const CLEAR_ANIMATION_SECONDS = 0.62;

export const FOLSOM_CONNECTED_GROWTH_RULES = Object.freeze({
  fire: Object.freeze({ saveKey: 'folsom_growth_anchor_fire_cleared', requiredItemId: 'torch', hint: 'Fire-blackened knot', failMessage: 'The knot holds cold.', message: 'The fire-blackened knot recoils.' }),
  pond: Object.freeze({ saveKey: 'folsom_growth_anchor_pond_cleared', requiredItemId: 'old_work_knife', hint: 'Wet root knot', failMessage: 'Wet black roots resist bare hands.', message: 'Wet black roots split under the blade.' }),
  shrine: Object.freeze({ saveKey: 'folsom_growth_anchor_shrine_cleared', requiredItemId: 'old_work_knife', hint: 'Shrine-bound cords', failMessage: 'The shrine cords resist bare hands.', message: 'The shrine cords slacken.' }),
  underworks: Object.freeze({ saveKey: 'folsom_underworks_growth_unsealed', message: 'The Underworks growth loses its pull.' }),
});

function toPoint(value) {
  return { x: Number(value?.[0] ?? value?.x) || 0, z: Number(value?.[1] ?? value?.z) || 0 };
}

function tagData(source, extra = {}) {
  return {
    locationId: 'folsom',
    objectCategory: 'connectedBlackGrowth',
    id: source.id,
    tags: [...(source.tags ?? [])],
    anchorGroup: source.anchorGroup ?? 'folsom_underworks',
    feedsUnderworksGrowth: true,
    clearState: 'intact',
    ...extra,
  };
}

export class FolsomConnectedGrowthRuntime {
  constructor({ scene, network, textureLoader, sampleSurfaceY, gameState = null, compiledGroup = null }) {
    this.scene = scene;
    this.network = network;
    this.sampleSurfaceY = sampleSurfaceY;
    this.gameState = gameState;
    this.compiledGroup = compiledGroup;
    this.anchorGroups = new Map();
    this.anchorVisuals = new Map();
    this.feedVisuals = new Map();
    this.clearedAnchorTypes = new Set(network.anchors
      .filter((anchor) => gameState?.isFolsomGrowthAnchorCleared?.(anchor.type))
      .map((anchor) => anchor.type));
    this.clearAnimations = [];
    this.effects = [];
    this.unsealed = Boolean(gameState?.isFolsomUnderworksGrowthUnsealed?.());
    this.root = new THREE.Group();
    this.root.name = 'folsom-connected-growth-network';
    this.root.userData = tagData(network, { persistentWorldNetwork: true, animatedOnlyDuringClear: true });
    this.scene.add(this.root);
    this.loadMaterials(textureLoader);
    this.buildUnderworksLock(network.lock);
    network.anchors.forEach((anchor) => this.buildAnchor(anchor));
    network.feeds.forEach((feed) => this.buildFeed(feed));
    this.findUnderworksGateParts();
    this.applyPersistedState();
  }

  loadMaterials(textureLoader) {
    const intact = BLACK_GROWTH_TEXTURES.intact.map((path) => loadBlackGrowthTexture(textureLoader, path));
    const wrappedIntact = BLACK_GROWTH_TEXTURES.intact.map((path) => loadWrappedBlackGrowthTexture(textureLoader, path));
    const cord = loadBlackGrowthTexture(textureLoader, BLACK_GROWTH_TEXTURES.cord);
    const hit = loadBlackGrowthTexture(textureLoader, BLACK_GROWTH_TEXTURES.hit);
    configureBlackGrowthTexture(cord).wrapS = THREE.RepeatWrapping;
    this.materials = {
      scab: intact.map((texture) => createBlackGrowthPlaneMaterial(texture, { color: 0x625e56 })),
      cord: createBlackGrowthPlaneMaterial(cord, { color: 0x59564f }),
      repeatingCord: createBlackGrowthPlaneMaterial(cord, { color: 0x55534d }),
      knot: wrappedIntact.map((texture) => createBlackGrowthKnotMaterial(texture)),
      hit,
    };
  }

  cloneMaterials(root) {
    root.traverse((object) => {
      if (object.material) object.material = object.material.clone();
    });
  }

  surfaceY(x, z, fallback = 0) {
    const y = this.sampleSurfaceY?.(x, z);
    return Number.isFinite(y) ? y : fallback;
  }

  addVerticalPlane(parent, { name, width, height, position, rotation = 0, texture = 0, data }) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.materials.scab[texture % this.materials.scab.length]);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.z = rotation;
    mesh.renderOrder = 4;
    mesh.userData = data;
    parent.add(mesh);
    return mesh;
  }

  addCordPlane(parent, { name, width, height = 0.32, position, rotation = 0, data }) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.materials.cord);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.z = rotation;
    mesh.renderOrder = 5;
    mesh.userData = data;
    parent.add(mesh);
    return mesh;
  }

  addGroundScab(parent, { name, x = 0, z = 0, y = 0.04, width, depth, rotation = 0, texture = 0, data }) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), this.materials.scab[texture % this.materials.scab.length]);
    mesh.name = name;
    mesh.position.set(x, y, z);
    const xAxis = new THREE.Vector3(Math.cos(rotation), 0, Math.sin(rotation));
    const yAxis = new THREE.Vector3().crossVectors(UP, xAxis);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, UP));
    mesh.renderOrder = 3;
    mesh.userData = data;
    parent.add(mesh);
    return mesh;
  }

  addKnot(parent, { name, position = [0, 0.3, 0], scale = [1, 1, 1], data, texture = 0 }) {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58, 0), this.materials.knot[texture % this.materials.knot.length]);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.rotation.set(0.18, 0.62, -0.12);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { ...data, wrappedHealthyGrowthTexture: true, growthTextureState: 'intact' };
    parent.add(mesh);
    return mesh;
  }

  buildUnderworksLock(lock) {
    const group = new THREE.Group();
    group.name = lock.id;
    group.position.set(lock.position[0], lock.position[1], lock.position[2]);
    group.userData = tagData(lock, { blocksUnderworks: true, passable: false, futureAnchorId: null });
    this.root.add(group);
    this.lockGroup = group;
    const data = group.userData;
    [
      { width: 2.2, height: 3.45, position: [0, 0, 0], rotation: -0.04, texture: 0 },
      { width: 1.45, height: 3.2, position: [-1.72, -0.08, 0.008], rotation: 0.08, texture: 1 },
      { width: 1.5, height: 3.25, position: [1.7, -0.04, 0.012], rotation: -0.09, texture: 1 },
      { width: 4.75, height: 1.18, position: [0.05, 1.52, 0.018], rotation: 0.015, texture: 0 },
    ].forEach((spec, index) => this.addVerticalPlane(group, { ...spec, name: `${lock.id}-scab-${index + 1}`, data }));
    [
      { width: 5.25, position: [0, 0.95, 0.035], rotation: 0.12 },
      { width: 5.1, position: [0, 0.12, 0.039], rotation: -0.16 },
      { width: 4.8, position: [0, -0.78, 0.043], rotation: 0.1 },
      { width: 4.35, position: [0, -1.37, 0.047], rotation: -0.04 },
    ].forEach((spec, index) => this.addCordPlane(group, { ...spec, name: `${lock.id}-gripping-cord-${index + 1}`, data }));
    this.addKnot(group, { name: `${lock.id}-central-knot`, position: [0.12, -0.05, -0.18], scale: [1.55, 1.85, 0.72], texture: 1, data });

    const rootCollar = new THREE.Group();
    rootCollar.name = `${lock.id}-feed-root-collar`;
    rootCollar.position.set(lock.position[0], this.surfaceY(lock.position[0], lock.position[2]), lock.position[2] - 0.12);
    rootCollar.userData = data;
    this.root.add(rootCollar);
    this.addGroundScab(rootCollar, { name: `${lock.id}-feed-root-scab-1`, width: 3.4, depth: 2.15, rotation: 0.08, texture: 0, data });
    this.addGroundScab(rootCollar, { name: `${lock.id}-feed-root-scab-2`, x: -0.72, z: -0.42, y: 0.058, width: 2.15, depth: 1.45, rotation: -0.34, texture: 1, data });
    this.lockCollar = rootCollar;
    this.cloneMaterials(group);
    this.cloneMaterials(rootCollar);
  }

  buildAnchor(anchor) {
    const group = new THREE.Group();
    const groundY = this.surfaceY(anchor.position[0], anchor.position[1], anchor.fallbackY ?? 0);
    group.name = anchor.id;
    group.position.set(anchor.position[0], groundY, anchor.position[1]);
    group.userData = tagData(anchor, { futureAnchorId: anchor.id, anchorType: anchor.type, collectible: false });
    this.root.add(group);
    this.anchorGroups.set(anchor.id, group);
    this.anchorVisuals.set(anchor.id, [group]);
    if (anchor.type === 'fire') this.buildFireAnchor(group, anchor);
    if (anchor.type === 'pond') this.buildPondAnchor(group, anchor);
    if (anchor.type === 'shrine') this.buildShrineAnchor(group, anchor);
  }

  buildFireAnchor(group, anchor) {
    const data = group.userData;
    this.addGroundScab(group, { name: `${anchor.id}-ash-scab-1`, width: 2.35, depth: 1.6, rotation: 0.32, texture: 0, data });
    this.addGroundScab(group, { name: `${anchor.id}-ash-scab-2`, x: 0.52, z: 0.35, y: 0.055, width: 1.65, depth: 1.15, rotation: -0.38, texture: 1, data });
    this.addKnot(group, { name: `${anchor.id}-char-knot`, position: [-0.18, 0.3, 0.03], scale: [1.45, 0.68, 1.2], texture: 0, data });
    this.addKnot(group, { name: `${anchor.id}-coal-knot`, position: [0.62, 0.2, 0.42], scale: [0.72, 0.42, 0.82], texture: 1, data });
    this.buildLocalTendrils(group, anchor, [[1.35, 0.85], [-1.65, -0.7], [-0.65, 1.55], [1.15, -1.35]]);
  }

  buildPondAnchor(group, anchor) {
    const data = group.userData;
    this.addGroundScab(group, { name: `${anchor.id}-wet-scab-1`, width: 2.65, depth: 1.55, rotation: -0.22, texture: 1, data });
    this.addGroundScab(group, { name: `${anchor.id}-wet-scab-2`, x: -0.65, z: -0.35, y: 0.058, width: 1.8, depth: 1.25, rotation: 0.41, texture: 0, data });
    this.addKnot(group, { name: `${anchor.id}-wet-root-knot`, position: [0.12, 0.25, 0], scale: [1.65, 0.62, 1.28], texture: 1, data });
    this.addKnot(group, { name: `${anchor.id}-mud-knot`, position: [-0.72, 0.16, -0.38], scale: [0.72, 0.34, 0.9], texture: 0, data });
    this.buildLocalTendrils(group, anchor, [[-1.8, -1.2], [0.2, -2.35], [1.25, -1.85], [1.7, 0.72]]);
  }

  buildShrineAnchor(group, anchor) {
    const data = group.userData;
    this.addGroundScab(group, { name: `${anchor.id}-stone-foot-scab`, z: -0.35, width: 2.3, depth: 1.35, rotation: 0.12, texture: 1, data });
    this.addVerticalPlane(group, { name: `${anchor.id}-altar-scab`, width: 2.4, height: 1.22, position: [0, 0.72, 0.05], rotation: -0.03, texture: 0, data });
    this.addCordPlane(group, { name: `${anchor.id}-altar-cord-low`, width: 3.05, position: [0, 0.38, 0.075], rotation: 0.13, data });
    this.addCordPlane(group, { name: `${anchor.id}-altar-cord-high`, width: 2.85, position: [0, 0.92, 0.08], rotation: -0.12, data });
    this.addKnot(group, { name: `${anchor.id}-stone-grip-knot`, position: [0.72, 0.34, -0.18], scale: [0.9, 0.68, 0.78], texture: 1, data });
    this.buildLocalTendrils(group, anchor, [[-1.75, -0.75], [1.65, -0.65], [-1.2, 1.1]]);
  }

  buildLocalTendrils(group, anchor, endpoints) {
    const origin = { x: group.position.x, z: group.position.z };
    endpoints.forEach(([x, z], index) => {
      const end = { x: origin.x + x, z: origin.z + z };
      const mesh = this.createGroundRibbon([origin, end], 0.24 + (index % 2) * 0.05, `${anchor.id}-tendril-${index + 1}`);
      mesh.userData = group.userData;
      this.root.add(mesh);
      this.anchorVisuals.get(anchor.id)?.push(mesh);
    });
    this.cloneMaterials(group);
  }

  buildFeed(feed) {
    const points = feed.points.map(toPoint);
    const ribbon = this.createGroundRibbon(points, feed.width ?? 0.42, `${feed.id}-cord-ribbon`);
    ribbon.userData = tagData(feed, { futureAnchorId: feed.anchorId, feedRoute: feed.anchorId });
    this.root.add(ribbon);
    const visuals = [ribbon];
    this.feedVisuals.set(feed.anchorId, visuals);
    (feed.knotPointIndices ?? []).forEach((pointIndex, index) => {
      const point = points[pointIndex];
      if (!point) return;
      const group = new THREE.Group();
      group.name = `${feed.id}-route-knot-${index + 1}`;
      group.position.set(point.x, this.surfaceY(point.x, point.z), point.z);
      group.userData = ribbon.userData;
      this.addKnot(group, { name: `${group.name}-mass`, position: [0, 0.13, 0], scale: [0.46, 0.22, 0.62], texture: index % 2, data: ribbon.userData });
      this.root.add(group);
      this.cloneMaterials(group);
      visuals.push(group);
    });
  }

  createGroundRibbon(sourcePoints, width, name) {
    const points = [];
    sourcePoints.slice(0, -1).forEach((from, index) => {
      const to = sourcePoints[index + 1];
      const distance = Math.hypot(to.x - from.x, to.z - from.z);
      const steps = Math.max(1, Math.ceil(distance / RIBBON_SAMPLE_LENGTH));
      for (let step = 0; step < steps; step += 1) {
        const t = step / steps;
        points.push({ x: THREE.MathUtils.lerp(from.x, to.x, t), z: THREE.MathUtils.lerp(from.z, to.z, t) });
      }
    });
    points.push(sourcePoints.at(-1));
    const positions = [];
    const uvs = [];
    const indices = [];
    let distanceAlong = 0;
    points.forEach((point, index) => {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const tangent = new THREE.Vector3(next.x - previous.x, 0, next.z - previous.z).normalize();
      const side = new THREE.Vector3().crossVectors(UP, tangent).multiplyScalar(width * 0.5);
      const y = this.surfaceY(point.x, point.z) + RIBBON_Y_OFFSET;
      positions.push(point.x + side.x, y, point.z + side.z, point.x - side.x, y, point.z - side.z);
      if (index > 0) distanceAlong += Math.hypot(point.x - previous.x, point.z - previous.z);
      const u = distanceAlong / 3.2;
      uvs.push(u, 0, u, 1);
      if (index > 0) {
        const base = index * 2;
        indices.push(base - 2, base - 1, base, base, base - 1, base + 1);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, this.materials.repeatingCord.clone());
    mesh.name = name;
    mesh.renderOrder = 2;
    mesh.frustumCulled = true;
    return mesh;
  }

  findUnderworksGateParts() {
    this.gateDoorParts = [];
    this.compiledGroup?.traverse((object) => {
      if (object.userData?.architecturalPrimitiveId !== 'folsom_cellar_gate' || object.userData?.doorwayPart !== 'door') return;
      object.userData.folsomClosedPosition = object.position.clone();
      this.gateDoorParts.push(object);
    });
  }

  getAnchorTargets() {
    return this.network.anchors.map((anchor) => {
      const group = this.anchorGroups.get(anchor.id);
      return {
        id: anchor.id,
        type: anchor.type,
        target: group?.position.clone().add(new THREE.Vector3(0, anchor.type === 'shrine' ? 0.75 : 0.35, 0)),
        cleared: this.isAnchorCleared(anchor.type),
      };
    });
  }

  getAnchorInteractions() {
    return this.getAnchorTargets()
      .filter((anchor) => !anchor.cleared && anchor.target)
      .map((anchor) => {
        const rule = FOLSOM_CONNECTED_GROWTH_RULES[anchor.type];
        return {
          id: anchor.id,
          label: rule.hint,
          target: anchor.target,
          range: 3.6,
          hint: rule.hint,
          message: rule.message,
          failMessage: rule.failMessage,
          requiredItemId: rule.requiredItemId,
          type: 'folsomGrowthAnchor',
          anchorType: anchor.type,
        };
      });
  }

  isAnchorCleared(anchorType) {
    return this.clearedAnchorTypes.has(anchorType);
  }

  clearAnchor(anchorId) {
    const anchor = this.network.anchors.find((candidate) => candidate.id === anchorId);
    if (!anchor || this.isAnchorCleared(anchor.type)) return { cleared: false, unsealed: this.unsealed };
    this.clearedAnchorTypes.add(anchor.type);
    this.gameState?.markFolsomGrowthAnchorCleared?.(anchor.type);
    this.startAnchorCollapse(anchor);
    const clearedCount = this.network.anchors.filter((candidate) => this.isAnchorCleared(candidate.type)).length;
    this.applyLockProgress(clearedCount);
    const shouldUnseal = clearedCount === this.network.anchors.length;
    if (shouldUnseal) this.unsealUnderworks();
    return {
      cleared: true,
      anchorType: anchor.type,
      clearedCount,
      unsealed: shouldUnseal,
      message: FOLSOM_CONNECTED_GROWTH_RULES[anchor.type].message,
      underworksMessage: shouldUnseal ? FOLSOM_CONNECTED_GROWTH_RULES.underworks.message : '',
    };
  }

  startAnchorCollapse(anchor) {
    const visuals = [...(this.anchorVisuals.get(anchor.id) ?? []), ...(this.feedVisuals.get(anchor.id) ?? [])];
    visuals.forEach((object, index) => {
      object.userData.clearStartScale = object.scale.clone();
      this.clearAnimations.push({ object, life: CLEAR_ANIMATION_SECONDS + index * 0.018, duration: CLEAR_ANIMATION_SECONDS + index * 0.018, finalOpacity: this.feedVisuals.get(anchor.id)?.includes(object) ? 0.12 : 0, hide: !this.feedVisuals.get(anchor.id)?.includes(object) });
    });
  }

  applyAnchorClearedState(anchor) {
    (this.anchorVisuals.get(anchor.id) ?? []).forEach((object) => { object.visible = false; });
    (this.feedVisuals.get(anchor.id) ?? []).forEach((object) => {
      object.visible = true;
      object.scale.y = 0.18;
      this.setObjectOpacity(object, 0.12);
      object.userData.clearState = 'broken';
    });
  }

  applyLockProgress(clearedCount) {
    if (!this.lockGroup || clearedCount >= 3) return;
    const cords = this.lockGroup.children.filter((child) => child.name.includes('gripping-cord'));
    cords.forEach((cord, index) => { cord.visible = index >= clearedCount; });
    const targetScale = 1 - clearedCount * 0.055;
    this.lockGroup.scale.set(targetScale, targetScale, 1);
  }

  unsealUnderworks() {
    if (this.unsealed) return false;
    this.unsealed = true;
    this.gameState?.markFolsomUnderworksGrowthUnsealed?.();
    [this.lockGroup, this.lockCollar].filter(Boolean).forEach((object, index) => {
      object.userData.clearStartScale = object.scale.clone();
      this.clearAnimations.push({ object, life: 0.78 + index * 0.08, duration: 0.78 + index * 0.08, finalOpacity: 0, hide: true, recoil: true });
    });
    this.gateOpenProgress = 0;
    this.spawnOilBurst();
    return true;
  }

  applyPersistedState() {
    this.network.anchors.forEach((anchor) => {
      if (this.isAnchorCleared(anchor.type)) this.applyAnchorClearedState(anchor);
    });
    const clearedCount = this.network.anchors.filter((anchor) => this.isAnchorCleared(anchor.type)).length;
    if (this.unsealed || clearedCount === this.network.anchors.length) {
      this.unsealed = true;
      this.gameState?.markFolsomUnderworksGrowthUnsealed?.();
      this.lockGroup.visible = false;
      this.lockCollar.visible = false;
      this.applyGateProgress(1);
    } else {
      this.applyLockProgress(clearedCount);
    }
  }

  applyGateProgress(progress) {
    this.gateDoorParts.forEach((door) => {
      const closed = door.userData.folsomClosedPosition;
      door.position.y = closed.y + progress * 4.2;
      door.userData.state = progress >= 1 ? 'open' : 'opening';
    });
  }

  spawnOilBurst() {
    const target = new THREE.Vector3(this.network.lock.position[0], this.network.lock.position[1], this.network.lock.position[2] - 0.08);
    for (let index = 0; index < 9; index += 1) {
      const material = createBlackGrowthPlaneMaterial(this.materials.hit, { opacity: 0.9, color: index % 3 ? 0x29251f : 0x5b5145 });
      const size = 0.24 + Math.random() * 0.42;
      const splash = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
      splash.name = 'folsom-underworks-short-lived-oil-splash';
      splash.position.copy(target).add(new THREE.Vector3((Math.random() - 0.5) * 2.3, (Math.random() - 0.35) * 2.4, -index * 0.001));
      splash.rotation.z = Math.random() * Math.PI * 2;
      splash.renderOrder = 9;
      this.scene.add(splash);
      this.effects.push({ object: splash, life: 0.42 + Math.random() * 0.24, velocity: new THREE.Vector3((Math.random() - 0.5) * 1.4, 0.35 + Math.random() * 1.2, -0.02) });
    }
  }

  setObjectOpacity(root, opacity) {
    root.traverse((object) => {
      if (!object.material) return;
      object.material.transparent = true;
      object.material.opacity = opacity;
    });
  }

  update(deltaSeconds) {
    this.clearAnimations = this.clearAnimations.filter((animation) => {
      animation.life = Math.max(0, animation.life - deltaSeconds);
      const progress = 1 - animation.life / animation.duration;
      const pulse = Math.sin(progress * Math.PI * 4) * (1 - progress);
      const start = animation.object.userData.clearStartScale;
      animation.object.scale.set(start.x * (1 + pulse * 0.08), start.y * Math.max(0.12, 1 - progress * 0.82), start.z * (1 + pulse * 0.05));
      if (animation.recoil) animation.object.position.y -= deltaSeconds * progress * 0.48;
      this.setObjectOpacity(animation.object, THREE.MathUtils.lerp(1, animation.finalOpacity, progress));
      if (animation.life > 0) return true;
      animation.object.visible = !animation.hide;
      animation.object.userData.clearState = animation.hide ? 'cleared' : 'broken';
      return false;
    });

    if (this.unsealed && Number.isFinite(this.gateOpenProgress) && this.gateOpenProgress < 1) {
      this.gateOpenProgress = Math.min(1, this.gateOpenProgress + deltaSeconds * 1.25);
      this.applyGateProgress(1 - ((1 - this.gateOpenProgress) ** 3));
    }

    this.effects = this.effects.filter((effect) => {
      effect.life -= deltaSeconds;
      if (effect.life <= 0) {
        this.scene.remove(effect.object);
        effect.object.geometry?.dispose?.();
        effect.object.material?.dispose?.();
        return false;
      }
      effect.object.position.addScaledVector(effect.velocity, deltaSeconds);
      effect.velocity.y -= deltaSeconds * 2.5;
      effect.object.material.opacity = Math.min(0.9, effect.life / 0.2);
      return true;
    });
  }
}
