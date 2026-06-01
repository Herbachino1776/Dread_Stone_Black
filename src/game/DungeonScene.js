import * as THREE from 'three';
import { CollisionWorld } from './Collision.js';
import { loadDungeonModel } from './ModelLoader.js';

const WALL_HEIGHT = 3.2;
const FLOOR_Y = 0;
const TEST_MODEL_URL = './assets/models/dread_stone_black_test_model_01.glb';
const TEST_MODEL_POSITION = new THREE.Vector3(3.65, 0, -2.45);
const TEST_MODEL_ROTATION_Y = -Math.PI / 5;

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
    this.gateOpen = false;
    this.gateOpening = false;
    this.gateTarget = new THREE.Vector3(0, 1.3, -16.7);
    this.key = null;
    this.keyTarget = new THREE.Vector3(-3.7, 0.82, 2.55);
    this.lever = null;
    this.leverUsed = false;
    this.leverTarget = new THREE.Vector3(5.35, 1.15, -2.4);
    this.enemySpawn = new THREE.Vector3(0, 0, -14.6);
    this.enemy = null;
    this.testModelProp = null;
    this.gateBlocker = { minX: -1.45, maxX: 1.45, minZ: -17.55, maxZ: -16.95 };
    this.collision = new CollisionWorld({
      walkableRects: [
        { minX: -5.6, maxX: 5.6, minZ: -5.6, maxZ: 5.6 },
        { minX: -1.35, maxX: 1.35, minZ: -17.2, maxZ: -5.6 },
      ],
      blockerRects: [this.gateBlocker],
    });
  }

  build() {
    this.addLights();
    this.addRoom();
    this.addCorridor();
    this.addPathCues();
    this.addTorches();
    this.addKeyPickup();
    this.addLever();
    this.addGate();
    this.addEnemy();
    this.addTestModelProp();
    return this.scene;
  }

  update(deltaSeconds) {
    if (this.key) {
      this.key.rotation.y += deltaSeconds * 1.7;
      this.key.position.y = this.keyTarget.y + Math.sin(performance.now() * 0.003) * 0.035;
    }

    if (this.gateOpening && this.gate) {
      this.gate.position.y = Math.min(this.gate.position.y + deltaSeconds * 1.35, 2.45);

      if (this.gate.position.y >= 2.45) {
        this.gateOpening = false;
      }
    }

    if (this.enemy?.hitFlashTimer > 0) {
      this.enemy.hitFlashTimer -= deltaSeconds;
      if (this.enemy.hitFlashTimer <= 0 && !this.enemy.dead) {
        this.enemy.bodyMat.color.setHex(0x6f2f28);
        this.enemy.headMat.color.setHex(0x3f322b);
      }
    }
  }

  collectKey() {
    if (!this.key) return false;

    this.scene.remove(this.key);
    this.key.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
    this.key = null;
    return true;
  }

  openGate() {
    if (this.gateOpen) return false;

    this.gateOpen = true;
    this.gateOpening = true;
    this.collision.removeBlocker(this.gateBlocker);

    if (this.gate) {
      this.gate.children.forEach((child) => {
        if (child.material?.emissive) {
          child.material.emissive.setHex(0x332617);
          child.material.emissiveIntensity = 0.45;
        }
      });
    }

    return true;
  }

  useLever() {
    if (this.leverUsed) return false;

    this.leverUsed = true;
    if (this.lever) {
      const handle = this.lever.getObjectByName('lever-handle');
      if (handle) {
        handle.rotation.z = -0.95;
      }
    }
    return true;
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

    const testPropGlow = new THREE.PointLight(0xffd2a0, 2.6, 5.5, 1.7);
    testPropGlow.position.copy(TEST_MODEL_POSITION).add(new THREE.Vector3(0, 1.45, 0.25));
    this.scene.add(testPropGlow);
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

  addKeyPickup() {
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x2f2924, roughness: 0.88, metalness: 0.05 });
    const keyMat = new THREE.MeshStandardMaterial({ color: 0xd7b76a, roughness: 0.42, metalness: 0.72, emissive: 0x3a2406, emissiveIntensity: 0.34 });

    const group = new THREE.Group();
    group.position.copy(this.keyTarget);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.58, 8), pedestalMat);
    pedestal.position.y = -0.32;
    group.add(pedestal);

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.08), keyMat);
    shaft.position.x = 0.08;
    group.add(shaft);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 16), keyMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = -0.36;
    group.add(ring);

    [0.25, 0.43].forEach((x, index) => {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18 + index * 0.08, 0.08), keyMat);
      tooth.position.set(x, -0.11 - index * 0.02, 0);
      group.add(tooth);
    });

    const glow = new THREE.PointLight(0xf3c76f, 1.7, 4.5, 1.8);
    glow.position.set(0, 0.3, 0);
    group.add(glow);

    this.key = group;
    this.scene.add(group);
  }

  addLever() {
    const group = new THREE.Group();
    group.position.copy(this.leverTarget);
    group.rotation.y = -Math.PI / 2;

    const plateMat = new THREE.MeshStandardMaterial({ color: 0x3c332a, roughness: 0.68, metalness: 0.45 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x9b6b3a, roughness: 0.62, metalness: 0.25, emissive: 0x1f1207, emissiveIntensity: 0.22 });

    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.5), plateMat);
    group.add(plate);

    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12), handleMat);
    pivot.rotation.z = Math.PI / 2;
    pivot.position.x = -0.12;
    group.add(pivot);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.12), handleMat);
    handle.name = 'lever-handle';
    handle.position.set(-0.15, 0.18, 0);
    handle.rotation.z = 0.45;
    group.add(handle);

    this.lever = group;
    this.scene.add(group);
  }


  addTestModelProp() {
    loadDungeonModel({ url: TEST_MODEL_URL, targetHeight: 0.9, maxWidth: 1.05 })
      .then(({ root, scale }) => {
        root.name = 'dread-stone-black-test-model-01';
        root.position.add(TEST_MODEL_POSITION);
        root.rotation.y = TEST_MODEL_ROTATION_Y;
        root.userData = {
          ...root.userData,
          assetUrl: TEST_MODEL_URL,
          normalizedScale: scale,
          placement: 'entry room near the lever wall and key/gate approach',
        };

        this.testModelProp = root;
        this.scene.add(root);
      })
      .catch((error) => {
        console.warn(`Optional test GLB failed to load from ${TEST_MODEL_URL}. The dungeon remains playable.`, error);
      });
  }


  addEnemy() {
    const group = new THREE.Group();
    group.position.copy(this.enemySpawn);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6f2f28, roughness: 0.86, metalness: 0.02, emissive: 0x1d0705, emissiveIntensity: 0.2 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x3f322b, roughness: 0.9, metalness: 0.02, emissive: 0x1a0b08, emissiveIntensity: 0.28 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffc16b });

    const body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.35, 6), bodyMat);
    body.name = 'enemy-body';
    body.position.y = 0.88;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 0.42), headMat);
    head.position.y = 1.66;
    group.add(head);

    [-0.13, 0.13].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.035), eyeMat);
      eye.position.set(x, 1.7, 0.22);
      group.add(eye);
    });

    const clawMat = new THREE.MeshStandardMaterial({ color: 0x1f1916, roughness: 0.72, metalness: 0.08 });
    [-0.42, 0.42].forEach((x) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.14), clawMat);
      arm.position.set(x, 0.92, 0.05);
      arm.rotation.z = x < 0 ? -0.28 : 0.28;
      group.add(arm);
    });

    const wakeGlow = new THREE.PointLight(0xb5452f, 1.25, 3.8, 1.6);
    wakeGlow.position.set(0, 1.25, 0);
    group.add(wakeGlow);

    this.enemy = {
      group,
      bodyMat,
      headMat,
      hp: 3,
      maxHp: 3,
      dead: false,
      hitFlashTimer: 0,
    };
    this.scene.add(group);
  }

  damageEnemy(amount, pushDirection) {
    if (!this.enemy || this.enemy.dead) return false;

    this.enemy.hp = Math.max(0, this.enemy.hp - amount);
    this.enemy.hitFlashTimer = 0.22;
    this.enemy.bodyMat.color.setHex(0xd8b06a);
    this.enemy.headMat.color.setHex(0xffd38a);

    const knockback = pushDirection.clone();
    knockback.y = 0;
    if (knockback.lengthSq() > 0) {
      const next = this.enemy.group.position.clone().add(knockback.normalize().multiplyScalar(0.34));
      if (this.collision.canStandAt(next)) {
        this.enemy.group.position.copy(next);
      }
    }

    if (this.enemy.hp <= 0) {
      this.enemy.dead = true;
      this.scene.remove(this.enemy.group);
      return true;
    }

    return false;
  }

  resetEnemy() {
    if (!this.enemy) return;

    this.enemy.hp = this.enemy.maxHp;
    this.enemy.dead = false;
    this.enemy.hitFlashTimer = 0;
    this.enemy.group.position.copy(this.enemySpawn);
    this.enemy.bodyMat.color.setHex(0x6f2f28);
    this.enemy.headMat.color.setHex(0x3f322b);

    if (!this.enemy.group.parent) {
      this.scene.add(this.enemy.group);
    }
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
