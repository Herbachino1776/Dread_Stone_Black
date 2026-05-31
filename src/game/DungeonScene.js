import * as THREE from 'three';
import { CollisionWorld } from './Collision.js';

const WALL_HEIGHT = 3.2;
const FLOOR_Y = 0;

function makeStoneTexture({ base = '#4b4841', mortar = '#1c1a18', accent = '#6a6252', rows = 8, columns = 8 }) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const blockWidth = canvas.width / columns;
  const blockHeight = canvas.height / rows;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const stagger = y % 2 === 0 ? 0 : blockWidth / 2;
      const shade = (x * 17 + y * 23) % 37;
      context.fillStyle = shade % 3 === 0 ? accent : base;
      context.globalAlpha = 0.16 + (shade % 5) * 0.03;
      context.fillRect(x * blockWidth - stagger + 2, y * blockHeight + 2, blockWidth - 4, blockHeight - 4);
    }
  }

  context.globalAlpha = 1;
  context.strokeStyle = mortar;
  context.lineWidth = 3;

  for (let y = 0; y <= rows; y += 1) {
    context.beginPath();
    context.moveTo(0, y * blockHeight);
    context.lineTo(canvas.width, y * blockHeight);
    context.stroke();
  }

  for (let y = 0; y < rows; y += 1) {
    const stagger = y % 2 === 0 ? 0 : blockWidth / 2;
    for (let x = -1; x <= columns; x += 1) {
      context.beginPath();
      context.moveTo(x * blockWidth + stagger, y * blockHeight);
      context.lineTo(x * blockWidth + stagger, (y + 1) * blockHeight);
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

export class DungeonScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x17120f);
    this.scene.fog = new THREE.Fog(0x17120f, 9, 27);

    this.gate = null;
    this.gateTarget = new THREE.Vector3(0, 1.3, -16.7);
    this.collision = new CollisionWorld({
      walkableRects: [
        { minX: -5.6, maxX: 5.6, minZ: -5.6, maxZ: 5.6 },
        { minX: -1.35, maxX: 1.35, minZ: -17.2, maxZ: -5.6 },
      ],
      blockerRects: [{ minX: -1.45, maxX: 1.45, minZ: -17.55, maxZ: -16.95 }],
    });
  }

  build() {
    this.addLights();
    this.addRoom();
    this.addCorridor();
    this.addPathCues();
    this.addTorches();
    this.addGate();
    return this.scene;
  }

  addLights() {
    const ambient = new THREE.HemisphereLight(0x7d8aa0, 0x22140b, 1.45);
    this.scene.add(ambient);

    const roomFill = new THREE.DirectionalLight(0xffe2ad, 0.65);
    roomFill.position.set(2.5, 5, 4);
    this.scene.add(roomFill);

    const entryTorchGlow = new THREE.PointLight(0xffb45a, 6.5, 15, 1.15);
    entryTorchGlow.position.set(-4.7, 2.05, 2.25);
    this.scene.add(entryTorchGlow);

    const corridorGlow = new THREE.PointLight(0xffd08a, 4.8, 18, 1.2);
    corridorGlow.position.set(0, 2.15, -9.6);
    this.scene.add(corridorGlow);

    const gateGlow = new THREE.PointLight(0xf0b16a, 3.3, 10, 1.25);
    gateGlow.position.set(0, 1.85, -15.5);
    this.scene.add(gateGlow);
  }

  makeStoneMaterial({ color = 0x5a554d, textureOptions, repeat = [2, 2] } = {}) {
    const texture = makeStoneTexture(textureOptions ?? {});
    texture.repeat.set(repeat[0], repeat[1]);

    return new THREE.MeshStandardMaterial({
      color,
      map: texture,
      roughness: 0.94,
      metalness: 0.01,
    });
  }

  addBox({ size, position, material }) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.copy(position);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  addRoom() {
    const wallMat = this.makeStoneMaterial({ color: 0x6a6254, textureOptions: { base: '#60594d', accent: '#8a7b63', rows: 7, columns: 8 }, repeat: [2.5, 1.5] });
    const floorMat = this.makeStoneMaterial({ color: 0x514d45, textureOptions: { base: '#504a41', accent: '#736a5b', rows: 8, columns: 8 }, repeat: [3, 3] });
    const ceilingMat = this.makeStoneMaterial({ color: 0x403b35, textureOptions: { base: '#403a33', accent: '#5a5145', rows: 6, columns: 7 }, repeat: [2, 2] });

    this.addBox({ size: new THREE.Vector3(12, 0.18, 12), position: new THREE.Vector3(0, FLOOR_Y - 0.09, 0), material: floorMat });
    this.addBox({ size: new THREE.Vector3(12, 0.18, 12), position: new THREE.Vector3(0, WALL_HEIGHT, 0), material: ceilingMat });
    this.addBox({ size: new THREE.Vector3(12, WALL_HEIGHT, 0.4), position: new THREE.Vector3(0, WALL_HEIGHT / 2, 6), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.4, WALL_HEIGHT, 12), position: new THREE.Vector3(-6, WALL_HEIGHT / 2, 0), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.4, WALL_HEIGHT, 12), position: new THREE.Vector3(6, WALL_HEIGHT / 2, 0), material: wallMat });

    // Back wall is split to leave a readable corridor opening.
    this.addBox({ size: new THREE.Vector3(4.7, WALL_HEIGHT, 0.4), position: new THREE.Vector3(-3.65, WALL_HEIGHT / 2, -6), material: wallMat });
    this.addBox({ size: new THREE.Vector3(4.7, WALL_HEIGHT, 0.4), position: new THREE.Vector3(3.65, WALL_HEIGHT / 2, -6), material: wallMat });
  }

  addCorridor() {
    const wallMat = this.makeStoneMaterial({ color: 0x5e574b, textureOptions: { base: '#554e44', accent: '#7b705d', rows: 8, columns: 4 }, repeat: [1.2, 3] });
    const floorMat = this.makeStoneMaterial({ color: 0x4d483f, textureOptions: { base: '#49433b', accent: '#6f6554', rows: 10, columns: 3 }, repeat: [1, 4] });
    const ceilingMat = this.makeStoneMaterial({ color: 0x3a352f, textureOptions: { base: '#3b362f', accent: '#554d41', rows: 6, columns: 3 }, repeat: [1, 3] });

    this.addBox({ size: new THREE.Vector3(3.1, 0.18, 12), position: new THREE.Vector3(0, FLOOR_Y - 0.09, -11.6), material: floorMat });
    this.addBox({ size: new THREE.Vector3(3.1, 0.18, 12), position: new THREE.Vector3(0, WALL_HEIGHT, -11.6), material: ceilingMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 12), position: new THREE.Vector3(-1.7, WALL_HEIGHT / 2, -11.6), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 12), position: new THREE.Vector3(1.7, WALL_HEIGHT / 2, -11.6), material: wallMat });
  }

  addPathCues() {
    const pathMat = new THREE.MeshBasicMaterial({ color: 0xb38a4d, transparent: true, opacity: 0.46, side: THREE.DoubleSide });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xe0bd73, transparent: true, opacity: 0.58, side: THREE.DoubleSide });

    const centerPath = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 22), pathMat);
    centerPath.rotation.x = -Math.PI / 2;
    centerPath.position.set(0, 0.012, -6.2);
    this.scene.add(centerPath);

    [-1.28, 1.28].forEach((x) => {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 11.4), edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.018, -11.6);
      this.scene.add(edge);
    });
  }

  addTorches() {
    this.addTorch(new THREE.Vector3(-5.78, 1.55, 2.25), Math.PI / 2);
    this.addTorch(new THREE.Vector3(1.45, 1.55, -10.3), -Math.PI / 2);
  }

  addTorch(position, rotationY) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotationY;

    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.75, metalness: 0.45 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b3419, roughness: 0.9 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb13d });

    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.48), bracketMat);
    bracket.position.z = 0.2;
    group.add(bracket);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.75, 6), woodMat);
    handle.rotation.x = Math.PI / 2.7;
    handle.position.set(0, -0.18, 0.44);
    group.add(handle);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.48, 7), flameMat);
    flame.position.set(0, 0.22, 0.72);
    group.add(flame);

    this.scene.add(group);
  }

  addGate() {
    const gateGroup = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.58, metalness: 0.62, emissive: 0x15100c, emissiveIntensity: 0.25 });
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xd5a159, transparent: true, opacity: 0.82 });

    for (let x = -1.05; x <= 1.05; x += 0.42) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.45, 0.18), metalMat);
      bar.position.set(x, 1.25, -17.25);
      gateGroup.add(bar);
    }

    const top = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.18, 0.2), metalMat);
    top.position.set(0, 2.4, -17.25);
    gateGroup.add(top);

    const middle = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.16, 0.2), metalMat);
    middle.position.set(0, 1.35, -17.25);
    gateGroup.add(middle);

    [-1.48, 1.48].forEach((x) => {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.7, 0.08), markerMat);
      marker.position.set(x, 1.35, -17.08);
      gateGroup.add(marker);
    });

    this.gate = gateGroup;
    this.scene.add(gateGroup);
  }
}
