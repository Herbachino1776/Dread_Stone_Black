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
    futureClearState: 'not-implemented',
    ...extra,
  };
}

export class FolsomConnectedGrowthRuntime {
  constructor({ scene, network, textureLoader, sampleSurfaceY }) {
    this.scene = scene;
    this.network = network;
    this.sampleSurfaceY = sampleSurfaceY;
    this.root = new THREE.Group();
    this.root.name = 'folsom-connected-growth-network';
    this.root.userData = tagData(network, { staticVisualNetwork: true, animated: false });
    this.scene.add(this.root);
    this.loadMaterials(textureLoader);
    this.buildUnderworksLock(network.lock);
    network.anchors.forEach((anchor) => this.buildAnchor(anchor));
    network.feeds.forEach((feed) => this.buildFeed(feed));
  }

  loadMaterials(textureLoader) {
    const intact = BLACK_GROWTH_TEXTURES.intact.map((path) => loadBlackGrowthTexture(textureLoader, path));
    const wrappedIntact = BLACK_GROWTH_TEXTURES.intact.map((path) => loadWrappedBlackGrowthTexture(textureLoader, path));
    const cord = loadBlackGrowthTexture(textureLoader, BLACK_GROWTH_TEXTURES.cord);
    configureBlackGrowthTexture(cord).wrapS = THREE.RepeatWrapping;
    this.materials = {
      scab: intact.map((texture) => createBlackGrowthPlaneMaterial(texture, { color: 0x625e56 })),
      cord: createBlackGrowthPlaneMaterial(cord, { color: 0x59564f }),
      repeatingCord: createBlackGrowthPlaneMaterial(cord, { color: 0x55534d }),
      knot: wrappedIntact.map((texture) => createBlackGrowthKnotMaterial(texture)),
    };
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
  }

  buildAnchor(anchor) {
    const group = new THREE.Group();
    const groundY = this.surfaceY(anchor.position[0], anchor.position[1], anchor.fallbackY ?? 0);
    group.name = anchor.id;
    group.position.set(anchor.position[0], groundY, anchor.position[1]);
    group.userData = tagData(anchor, { futureAnchorId: anchor.id, anchorType: anchor.type, collectible: false });
    this.root.add(group);
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
    });
  }

  buildFeed(feed) {
    const points = feed.points.map(toPoint);
    const ribbon = this.createGroundRibbon(points, feed.width ?? 0.42, `${feed.id}-cord-ribbon`);
    ribbon.userData = tagData(feed, { futureAnchorId: feed.anchorId, feedRoute: feed.anchorId });
    this.root.add(ribbon);
    (feed.knotPointIndices ?? []).forEach((pointIndex, index) => {
      const point = points[pointIndex];
      if (!point) return;
      const group = new THREE.Group();
      group.name = `${feed.id}-route-knot-${index + 1}`;
      group.position.set(point.x, this.surfaceY(point.x, point.z), point.z);
      group.userData = ribbon.userData;
      this.addKnot(group, { name: `${group.name}-mass`, position: [0, 0.13, 0], scale: [0.46, 0.22, 0.62], texture: index % 2, data: ribbon.userData });
      this.root.add(group);
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
    const mesh = new THREE.Mesh(geometry, this.materials.repeatingCord);
    mesh.name = name;
    mesh.renderOrder = 2;
    mesh.frustumCulled = true;
    return mesh;
  }
}
