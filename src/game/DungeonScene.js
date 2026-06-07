import * as THREE from 'three';
import { CollisionWorld } from './Collision.js';
import { loadDungeonModel } from './ModelLoader.js';

const WALL_HEIGHT = 3.2;
const FLOOR_Y = 0;
const TEST_MODEL_URL = './assets/models/dread_stone_black_test_model_01.glb';
const RAM_MAN_NPC_IDLE_URL = './assets/npcs/ram_man/ram_man_friendly_idle_01.glb';
const RAM_MAN_NPC_WALK_URL = './assets/npcs/ram_man/ram_man_friendly_walk_01.glb';
const RAM_MAN_NPC_POSITION = new THREE.Vector3(4.15, FLOOR_Y, 2.15);
const RAM_MAN_NPC_PATROL_POINTS = [
  new THREE.Vector3(4.15, FLOOR_Y, 2.15),
  new THREE.Vector3(4.75, FLOOR_Y, 0.75),
  new THREE.Vector3(3.55, FLOOR_Y, -1.35),
  new THREE.Vector3(2.55, FLOOR_Y, 0.55),
];
const RAM_MAN_NPC_PATROL_SPEED = 0.34;
const RAM_MAN_NPC_TURN_SPEED = 3.2;
const RAM_MAN_NPC_PATROL_PAUSE_SECONDS = 0.9;
const TEST_MODEL_POSITION = new THREE.Vector3(3.65, FLOOR_Y, -2.45);
const TEST_MODEL_ROTATION_Y = -Math.PI / 5;
const TEST_MODEL_PATROL_POINTS = [
  new THREE.Vector3(3.65, FLOOR_Y, -2.45),
  new THREE.Vector3(2.15, FLOOR_Y, -4.25),
  new THREE.Vector3(-1.9, FLOOR_Y, -4.15),
  new THREE.Vector3(-3.75, FLOOR_Y, -1.05),
  new THREE.Vector3(-1.45, FLOOR_Y, 2.85),
  new THREE.Vector3(2.95, FLOOR_Y, 2.3),
];
const TEST_MODEL_PATROL_SPEED = 0.62;
const ROOM_DOORWAY_Z = -4.35;
const TEST_MODEL_TURN_SPEED = 4.4;

const TEXTURE_PATHS = {
  wall: './assets/textures/wall_black_stone_01.png',
  floor: './assets/textures/floor_worn_stone_01.png',
  ceiling: './assets/textures/ceiling_dark_stone_01.png',
  gate: './assets/textures/metal_gate_rusted_01.png',
};

const TEXTURE_REPEATS = {
  roomWall: [4, 1.35],
  corridorWall: [4, 1.35],
  roomFloor: [6, 6],
  corridorFloor: [1.5, 6],
  roomCeiling: [6, 6],
  corridorCeiling: [1.5, 6],
  branchWall: [3, 1.35],
  branchFloor: [4, 4],
  branchCeiling: [4, 4],
  longWall: [6, 1.35],
  returnFloor: [1.5, 8],
  returnCeiling: [1.5, 8],
  gateBars: [0.45, 2.5],
  gateBeams: [2.75, 0.45],
};

export class DungeonScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090807);
    this.scene.fog = new THREE.Fog(0x080706, 6.5, 20);
    this.textureLoader = new THREE.TextureLoader();
    this.textureCheckRig = null;

    this.gate = null;
    this.gateOpen = false;
    this.gateOpening = false;
    this.gateTarget = new THREE.Vector3(0, 1.3, -16.7);
    this.key = null;
    this.keyTarget = new THREE.Vector3(-3.7, 0.82, 2.55);
    this.lever = null;
    this.leverUsed = false;
    this.leverTarget = new THREE.Vector3(5.35, 1.15, -2.4);
    this.shortcutTarget = new THREE.Vector3(-5.75, 1.12, ROOM_DOORWAY_Z);
    this.secretTarget = new THREE.Vector3(8.2, 1.12, -24.25);
    this.shortcutDoor = null;
    this.shortcutOpen = false;
    this.secretWall = null;
    this.secretRevealed = false;
    this.enemySpawn = new THREE.Vector3(5.9, 0, -20.55);
    this.enemy = null;
    this.ramManNpc = null;
    this.ramManNpcPatrolIndex = 0;
    this.ramManNpcMoveTarget = 1;
    this.ramManNpcPauseTimer = 0;
    this.ramManNpcAnimation = null;
    this.testModelProp = null;
    this.testModelPatrolIndex = 0;
    this.testModelMoveTarget = 1;
    this.testModelGlow = null;
    this.torchLights = [];
    this.lightTime = 0;
    this.gateBlocker = { minX: -1.45, maxX: 1.45, minZ: -17.55, maxZ: -16.95 };
    this.shortcutBlocker = { minX: -6.15, maxX: -4.65, minZ: -5.12, maxZ: -3.58 };
    this.secretWallBlocker = { minX: 7.05, maxX: 9.35, minZ: -24.65, maxZ: -23.82 };
    this.collision = new CollisionWorld({
      walkableRects: [
        { minX: -5.6, maxX: 5.6, minZ: -5.6, maxZ: 5.6 },
        { minX: -1.35, maxX: 1.35, minZ: -17.2, maxZ: -5.6 },
        { minX: -1.35, maxX: 1.35, minZ: -22.2, maxZ: -17.2 },
        { minX: -4.75, maxX: 4.75, minZ: -22.2, maxZ: -19.35 },
        { minX: 4.75, maxX: 9.6, minZ: -24.25, maxZ: -17.85 },
        { minX: -7.85, maxX: -4.75, minZ: -22.2, maxZ: -3.35 },
        { minX: 7.05, maxX: 9.35, minZ: -27.1, maxZ: -24.25 },
      ],
      blockerRects: [this.gateBlocker, this.shortcutBlocker, this.secretWallBlocker],
    });
  }

  build() {
    this.addLights();
    this.addRoom();
    this.addCorridor();
    this.addDungeonExpansion();
    this.addPathCues();
    this.addTorches();
    this.addKeyPickup();
    this.addLever();
    this.addGate();
    this.addEnemy();
    this.addRamManNpc();
    this.addTestModelProp();
    this.addTextureVerificationMode();
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

    this.lightTime += deltaSeconds;
    this.updateTorchFlicker();
    this.updateRamManNpcPatrol(deltaSeconds);
    this.updateTestModelPatrol(deltaSeconds);

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

  openShortcutDoor() {
    if (this.shortcutOpen) return false;

    this.shortcutOpen = true;
    this.collision.removeBlocker(this.shortcutBlocker);

    if (this.shortcutDoor) {
      this.shortcutDoor.rotation.y = -Math.PI / 2;
      this.shortcutDoor.position.x = -6.42;
      this.shortcutDoor.position.z = ROOM_DOORWAY_Z - 0.62;
    }

    return true;
  }

  revealSecret() {
    if (this.secretRevealed) return false;

    this.secretRevealed = true;
    this.collision.removeBlocker(this.secretWallBlocker);

    if (this.secretWall) {
      this.secretWall.position.y = -0.35;
      this.secretWall.rotation.x = -0.08;
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
    const ambient = new THREE.HemisphereLight(0x687184, 0x150d09, 0.72);
    this.scene.add(ambient);

    const roomFill = new THREE.DirectionalLight(0xd9b17b, 0.28);
    roomFill.position.set(2.5, 5, 4);
    this.scene.add(roomFill);

    const entryTorchGlow = new THREE.PointLight(0xff9d46, 2.15, 10.5, 1.35);
    entryTorchGlow.position.set(-4.7, 2.05, 2.25);
    this.scene.add(entryTorchGlow);

    const corridorGlow = new THREE.PointLight(0xffb66a, 1.85, 12.5, 1.38);
    corridorGlow.position.set(0, 2.15, -9.6);
    this.scene.add(corridorGlow);

    const gateGlow = new THREE.PointLight(0xd08a4d, 1.1, 7.5, 1.45);
    gateGlow.position.set(0, 1.85, -15.5);
    this.scene.add(gateGlow);

    const testPropGlow = new THREE.PointLight(0xb9794f, 0.55, 4.25, 1.85);
    testPropGlow.position.copy(TEST_MODEL_POSITION).add(new THREE.Vector3(0, 1.35, 0.2));
    this.testModelGlow = testPropGlow;
    this.scene.add(testPropGlow);
  }

  loadRepeatingTexture(path, repeat) {
    const texture = this.textureLoader.load(path, (loadedTexture) => {
      if (import.meta.env.DEV) {
        console.info(`Texture loaded: ${path} @ repeat ${repeat[0]}x${repeat[1]}`, loadedTexture.image?.width, loadedTexture.image?.height);
      }
    });
    texture.name = path;
    texture.userData = { path, repeat: [...repeat] };
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  makeTexturedMaterial({ path, repeat, color = 0xffffff, roughness = 0.92, metalness = 0.02, emissive, emissiveIntensity } = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      map: this.loadRepeatingTexture(path, repeat),
      roughness,
      metalness,
      ...(emissive !== undefined ? { emissive, emissiveIntensity } : {}),
    });
  }

  addBox({ size, position, material, name }) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    if (name) mesh.name = name;
    mesh.position.copy(position);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  addRoom() {
    const wallMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: TEXTURE_REPEATS.roomWall, color: 0xffffff, roughness: 0.94, metalness: 0.01 });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: TEXTURE_REPEATS.roomFloor, color: 0xffffff, roughness: 0.92, metalness: 0.0, emissive: 0x0c0906, emissiveIntensity: 0.08 });
    const ceilingMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.ceiling, repeat: TEXTURE_REPEATS.roomCeiling, color: 0xf2eee6, roughness: 0.96, metalness: 0.0 });

    this.addBox({ size: new THREE.Vector3(12, 0.18, 12), position: new THREE.Vector3(0, FLOOR_Y - 0.09, 0), material: floorMat, name: 'room-floor-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(12, 0.18, 12), position: new THREE.Vector3(0, WALL_HEIGHT, 0), material: ceilingMat, name: 'room-ceiling-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(12, WALL_HEIGHT, 0.4), position: new THREE.Vector3(0, WALL_HEIGHT / 2, 6), material: wallMat });
    // West wall leaves a barred shortcut slit that only opens from the return passage.
    this.addBox({ size: new THREE.Vector3(0.4, WALL_HEIGHT, 9.7), position: new THREE.Vector3(-6, WALL_HEIGHT / 2, 1.15), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.4, WALL_HEIGHT, 0.95), position: new THREE.Vector3(-6, WALL_HEIGHT / 2, -5.52), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.4, WALL_HEIGHT, 12), position: new THREE.Vector3(6, WALL_HEIGHT / 2, 0), material: wallMat });

    // Back wall is split to leave a readable corridor opening.
    this.addBox({ size: new THREE.Vector3(4.7, WALL_HEIGHT, 0.4), position: new THREE.Vector3(-3.65, WALL_HEIGHT / 2, -6), material: wallMat });
    this.addBox({ size: new THREE.Vector3(4.7, WALL_HEIGHT, 0.4), position: new THREE.Vector3(3.65, WALL_HEIGHT / 2, -6), material: wallMat });
  }

  addCorridor() {
    const wallMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: TEXTURE_REPEATS.corridorWall, color: 0xffffff, roughness: 0.94, metalness: 0.01 });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: TEXTURE_REPEATS.corridorFloor, color: 0xffffff, roughness: 0.92, metalness: 0.0, emissive: 0x0c0906, emissiveIntensity: 0.08 });
    const ceilingMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.ceiling, repeat: TEXTURE_REPEATS.corridorCeiling, color: 0xf2eee6, roughness: 0.96, metalness: 0.0 });

    this.addBox({ size: new THREE.Vector3(3.1, 0.18, 12), position: new THREE.Vector3(0, FLOOR_Y - 0.09, -11.6), material: floorMat, name: 'corridor-floor-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(3.1, 0.18, 12), position: new THREE.Vector3(0, WALL_HEIGHT, -11.6), material: ceilingMat, name: 'corridor-ceiling-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 12), position: new THREE.Vector3(-1.7, WALL_HEIGHT / 2, -11.6), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 12), position: new THREE.Vector3(1.7, WALL_HEIGHT / 2, -11.6), material: wallMat });
  }

  addDungeonExpansion() {
    const wallMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: TEXTURE_REPEATS.branchWall, color: 0xffffff, roughness: 0.94, metalness: 0.01 });
    const longWallMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: TEXTURE_REPEATS.longWall, color: 0xffffff, roughness: 0.94, metalness: 0.01 });
    const floorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: TEXTURE_REPEATS.branchFloor, color: 0xffffff, roughness: 0.92, metalness: 0.0, emissive: 0x0c0906, emissiveIntensity: 0.08 });
    const returnFloorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.floor, repeat: TEXTURE_REPEATS.returnFloor, color: 0xffffff, roughness: 0.92, metalness: 0.0, emissive: 0x0c0906, emissiveIntensity: 0.08 });
    const ceilingMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.ceiling, repeat: TEXTURE_REPEATS.branchCeiling, color: 0xf2eee6, roughness: 0.96, metalness: 0.0 });
    const returnCeilingMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.ceiling, repeat: TEXTURE_REPEATS.returnCeiling, color: 0xf2eee6, roughness: 0.96, metalness: 0.0 });
    const doorMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: TEXTURE_REPEATS.gateBeams, color: 0xd6c1a2, roughness: 0.76, metalness: 0.36, emissive: 0x21140a, emissiveIntensity: 0.16 });

    // Space 1: a tight vestibule immediately beyond the locked gate.
    this.addBox({ size: new THREE.Vector3(3.1, 0.18, 5.25), position: new THREE.Vector3(0, FLOOR_Y - 0.09, -19.72), material: floorMat, name: 'post-gate-vestibule-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(3.1, 0.18, 5.25), position: new THREE.Vector3(0, WALL_HEIGHT, -19.72), material: ceilingMat, name: 'post-gate-vestibule-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 2.65), position: new THREE.Vector3(-1.7, WALL_HEIGHT / 2, -18.55), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 2.65), position: new THREE.Vector3(1.7, WALL_HEIGHT / 2, -18.55), material: wallMat });

    // Space 2: a cross passage that turns east into the encounter chamber and west into the return shortcut.
    this.addBox({ size: new THREE.Vector3(9.85, 0.18, 3.05), position: new THREE.Vector3(0, FLOOR_Y - 0.09, -20.8), material: floorMat, name: 'cross-passage-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(9.85, 0.18, 3.05), position: new THREE.Vector3(0, WALL_HEIGHT, -20.8), material: ceilingMat, name: 'cross-passage-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(3.1, WALL_HEIGHT, 0.35), position: new THREE.Vector3(-3.25, WALL_HEIGHT / 2, -18.95), material: wallMat });
    this.addBox({ size: new THREE.Vector3(3.1, WALL_HEIGHT, 0.35), position: new THREE.Vector3(3.25, WALL_HEIGHT / 2, -18.95), material: wallMat });
    this.addBox({ size: new THREE.Vector3(9.85, WALL_HEIGHT, 0.35), position: new THREE.Vector3(0, WALL_HEIGHT / 2, -22.55), material: wallMat });

    // Space 3: a small east crypt chamber for the first enemy encounter.
    this.addBox({ size: new THREE.Vector3(5.15, 0.18, 6.55), position: new THREE.Vector3(7.18, FLOOR_Y - 0.09, -21.05), material: floorMat, name: 'east-crypt-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(5.15, 0.18, 6.55), position: new THREE.Vector3(7.18, WALL_HEIGHT, -21.05), material: ceilingMat, name: 'east-crypt-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 6.55), position: new THREE.Vector3(9.85, WALL_HEIGHT / 2, -21.05), material: longWallMat });
    this.addBox({ size: new THREE.Vector3(3.85, WALL_HEIGHT, 0.35), position: new THREE.Vector3(7.78, WALL_HEIGHT / 2, -17.6), material: wallMat });
    this.addBox({ size: new THREE.Vector3(2.05, WALL_HEIGHT, 0.35), position: new THREE.Vector3(5.78, WALL_HEIGHT / 2, -24.5), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 1.85), position: new THREE.Vector3(4.55, WALL_HEIGHT / 2, -18.55), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 1.85), position: new THREE.Vector3(4.55, WALL_HEIGHT / 2, -23.15), material: wallMat });

    // A compact hidden alcove behind a false north wall.
    this.addBox({ size: new THREE.Vector3(2.55, 0.18, 2.9), position: new THREE.Vector3(8.2, FLOOR_Y - 0.09, -25.68), material: floorMat, name: 'hidden-alcove-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(2.55, 0.18, 2.9), position: new THREE.Vector3(8.2, WALL_HEIGHT, -25.68), material: ceilingMat, name: 'hidden-alcove-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 2.9), position: new THREE.Vector3(6.83, WALL_HEIGHT / 2, -25.68), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 2.9), position: new THREE.Vector3(9.57, WALL_HEIGHT / 2, -25.68), material: wallMat });
    this.addBox({ size: new THREE.Vector3(2.75, WALL_HEIGHT, 0.35), position: new THREE.Vector3(8.2, WALL_HEIGHT / 2, -27.25), material: wallMat });
    this.secretWall = this.addBox({ size: new THREE.Vector3(2.35, WALL_HEIGHT, 0.32), position: new THREE.Vector3(8.2, WALL_HEIGHT / 2, -24.38), material: wallMat, name: 'secret-cracked-wall' });

    // West return passage: a readable loop back to the entry chamber after the gate is conquered.
    this.addBox({ size: new THREE.Vector3(3.25, 0.18, 18.95), position: new THREE.Vector3(-6.3, FLOOR_Y - 0.09, -12.72), material: returnFloorMat, name: 'west-return-floor_worn_stone_01' });
    this.addBox({ size: new THREE.Vector3(3.25, 0.18, 18.95), position: new THREE.Vector3(-6.3, WALL_HEIGHT, -12.72), material: returnCeilingMat, name: 'west-return-ceiling_dark_stone_01' });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 18.95), position: new THREE.Vector3(-8.05, WALL_HEIGHT / 2, -12.72), material: longWallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 13.85), position: new THREE.Vector3(-4.55, WALL_HEIGHT / 2, -13.82), material: longWallMat });
    this.addBox({ size: new THREE.Vector3(3.25, WALL_HEIGHT, 0.35), position: new THREE.Vector3(-6.3, WALL_HEIGHT / 2, -3.12), material: wallMat });

    this.shortcutDoor = this.addBox({ size: new THREE.Vector3(0.22, 2.35, 1.28), position: new THREE.Vector3(-5.82, 1.18, ROOM_DOORWAY_Z), material: doorMat, name: 'entry-return-shortcut-door' });
  }

  addPathCues() {
    const pathMat = new THREE.MeshBasicMaterial({ color: 0xb38a4d, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xe0bd73, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });

    const centerPath = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 22), pathMat);
    centerPath.rotation.x = -Math.PI / 2;
    centerPath.position.set(0, 0.012, -6.2);
    this.scene.add(centerPath);

    [-1.28, 1.28].forEach((x) => {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 11.4), edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.018, -11.6);
      this.scene.add(edge);
    });
  }

  addTorches() {
    this.addTorch(new THREE.Vector3(-5.78, 1.55, 2.25), Math.PI / 2);
    this.addTorch(new THREE.Vector3(1.45, 1.55, -10.3), -Math.PI / 2);
    this.addTorch(new THREE.Vector3(4.65, 1.5, -18.55), Math.PI / 2);
    this.addTorch(new THREE.Vector3(-7.88, 1.5, -14.4), Math.PI / 2);
  }

  addTorch(position, rotationY) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotationY;

    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.75, metalness: 0.45 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b3419, roughness: 0.9 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xd77724 });

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

    const glow = new THREE.PointLight(0xff8f32, 1.45, 5.25, 1.55);
    glow.position.copy(flame.position);
    group.add(glow);
    this.torchLights.push({
      light: glow,
      flame,
      baseIntensity: glow.intensity,
      baseDistance: glow.distance,
      phase: this.torchLights.length * 1.93,
    });

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

  addTextureVerificationMode() {
    if (!import.meta.env.DEV) return;

    const query = new URLSearchParams(window.location.search);
    this.textureCheckRig = this.createTextureCheckRig();
    this.textureCheckRig.visible = query.get('textureCheck') === '1';
    this.scene.add(this.textureCheckRig);

    window.addEventListener('keydown', (event) => {
      if (event.code !== 'KeyT') return;
      this.textureCheckRig.visible = !this.textureCheckRig.visible;
      console.info(`Texture check mode ${this.textureCheckRig.visible ? 'enabled' : 'disabled'}`);
    });
  }

  createTextureCheckRig() {
    const rig = new THREE.Group();
    rig.name = 'dev-texture-check-rig';
    rig.position.set(-5.35, 1.6, 5.75);

    Object.entries(TEXTURE_PATHS).forEach(([name, path], index) => {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: this.loadRepeatingTexture(path, [1, 1]),
        side: THREE.DoubleSide,
      });
      const swatch = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), material);
      swatch.name = `dev-texture-check-${name}`;
      swatch.position.set(index * 1.06, 0, 0);
      rig.add(swatch);
    });

    return rig;
  }


  updateTorchFlicker() {
    this.torchLights.forEach(({ light, flame, baseIntensity, baseDistance, phase }) => {
      const slowPulse = Math.sin(this.lightTime * 7.5 + phase) * 0.11;
      const fastPulse = Math.sin(this.lightTime * 18.0 + phase * 2.7) * 0.055;
      const emberPulse = Math.sin(this.lightTime * 31.0 + phase * 0.6) * 0.025;
      const flicker = THREE.MathUtils.clamp(1 + slowPulse + fastPulse + emberPulse, 0.78, 1.18);

      light.intensity = baseIntensity * flicker;
      light.distance = baseDistance * THREE.MathUtils.clamp(0.96 + (flicker - 1) * 0.35, 0.9, 1.05);
      flame.scale.setScalar(THREE.MathUtils.clamp(0.94 + (flicker - 1) * 0.28, 0.9, 1.05));
    });
  }


  updateRamManNpcPatrol(deltaSeconds) {
    this.ramManNpcAnimation?.mixers.forEach((mixer) => mixer.update(deltaSeconds));

    if (!this.ramManNpc || RAM_MAN_NPC_PATROL_POINTS.length < 2) {
      this.setRamManNpcAnimation('idle');
      return;
    }

    if (this.ramManNpcPauseTimer > 0) {
      this.ramManNpcPauseTimer = Math.max(0, this.ramManNpcPauseTimer - deltaSeconds);
      this.setRamManNpcAnimation('idle');
      return;
    }

    const target = RAM_MAN_NPC_PATROL_POINTS[this.ramManNpcMoveTarget];
    const current = this.ramManNpc.position;
    const toTarget = target.clone().sub(current);
    toTarget.y = 0;
    const distance = toTarget.length();

    if (distance < 0.08) {
      this.ramManNpcPatrolIndex = this.ramManNpcMoveTarget;
      this.ramManNpcMoveTarget = (this.ramManNpcMoveTarget + 1) % RAM_MAN_NPC_PATROL_POINTS.length;
      this.ramManNpcPauseTimer = RAM_MAN_NPC_PATROL_PAUSE_SECONDS;
      this.setRamManNpcAnimation('idle');
      return;
    }

    const direction = toTarget.normalize();
    const stepDistance = Math.min(distance, RAM_MAN_NPC_PATROL_SPEED * deltaSeconds);
    const next = current.clone().add(direction.clone().multiplyScalar(stepDistance));
    next.y = FLOOR_Y;

    if (this.collision.canStandAt(next)) {
      current.copy(next);
      this.setRamManNpcAnimation(stepDistance > 0.001 ? 'walk' : 'idle');
    } else {
      this.ramManNpcMoveTarget = (this.ramManNpcMoveTarget + 1) % RAM_MAN_NPC_PATROL_POINTS.length;
      this.ramManNpcPauseTimer = RAM_MAN_NPC_PATROL_PAUSE_SECONDS;
      this.setRamManNpcAnimation('idle');
    }

    const desiredYaw = Math.atan2(direction.x, direction.z);
    this.ramManNpc.rotation.y = THREE.MathUtils.damp(this.ramManNpc.rotation.y, desiredYaw, RAM_MAN_NPC_TURN_SPEED, deltaSeconds);
  }

  setRamManNpcAnimation(state) {
    const animation = this.ramManNpcAnimation;
    if (!animation || animation.state === state) return;

    const nextTrack = animation.tracks[state];
    const previousTrack = animation.tracks[animation.state];
    if (!nextTrack) return;

    Object.entries(animation.tracks).forEach(([trackState, track]) => {
      track.root.visible = trackState === state;
    });

    nextTrack.action?.reset().fadeIn(0.16).play();
    if (previousTrack?.action && previousTrack !== nextTrack) {
      previousTrack.action.fadeOut(0.16);
    }

    animation.state = state;
  }

  createRamManNpcAnimationTrack({ state, root, gltf, scale }) {
    const mixer = new THREE.AnimationMixer(root);
    const clips = gltf.animations ?? [];
    const clip = clips.find((candidate) => candidate.name.toLowerCase().includes(state)) ?? clips[0];

    if (!clip) {
      console.warn(`Friendly Ram Man ${state} GLB loaded without animation clips.`);
      return { root, mixer, action: null, clip: null, clipNames: [], clipSummaries: [] };
    }

    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.enabled = true;

    return {
      root,
      mixer,
      action,
      clip,
      scale,
      clipNames: clips.map((candidate) => candidate.name || '(unnamed clip)'),
      clipSummaries: clips.map((candidate) => ({
        name: candidate.name || '(unnamed clip)',
        durationSeconds: Number(candidate.duration.toFixed(3)),
        trackCount: candidate.tracks.length,
      })),
    };
  }

  addRamManNpc() {
    // Friendly ambience-only NPC: no collision blocker, no enemy registration, no combat hooks.
    Promise.all([
      loadDungeonModel({ url: RAM_MAN_NPC_IDLE_URL, targetHeight: 1.72, maxWidth: 1.15 }),
      loadDungeonModel({ url: RAM_MAN_NPC_WALK_URL, targetHeight: 1.72, maxWidth: 1.15 }),
    ])
      .then(([idleModel, walkModel]) => {
        idleModel.root.name = 'ram-man-friendly-idle-01-model';
        walkModel.root.name = 'ram-man-friendly-walk-01-model';
        walkModel.root.visible = false;

        const idleTrack = this.createRamManNpcAnimationTrack({ state: 'idle', ...idleModel });
        const walkTrack = this.createRamManNpcAnimationTrack({ state: 'walk', ...walkModel });

        const patrolRig = new THREE.Group();
        patrolRig.name = 'ram-man-friendly-01';
        patrolRig.position.copy(RAM_MAN_NPC_POSITION);
        patrolRig.userData = {
          assetUrls: {
            idle: RAM_MAN_NPC_IDLE_URL,
            walk: RAM_MAN_NPC_WALK_URL,
          },
          animationClips: {
            idle: idleTrack.clipNames,
            walk: walkTrack.clipNames,
          },
          animationClipDetails: {
            idle: idleTrack.clipSummaries,
            walk: walkTrack.clipSummaries,
          },
          normalizedScale: {
            idle: idleModel.scale,
            walk: walkModel.scale,
          },
          friendly: true,
          collision: 'none - visual roaming NPC only',
          combat: 'none - not registered as an enemy or target',
          placement: 'opening chamber east side, clear of the center path to the gate',
          patrolSpeed: RAM_MAN_NPC_PATROL_SPEED,
          patrolPauseSeconds: RAM_MAN_NPC_PATROL_PAUSE_SECONDS,
          patrolPoints: RAM_MAN_NPC_PATROL_POINTS.map((point) => ({ x: point.x, y: point.y, z: point.z })),
        };
        patrolRig.add(idleModel.root, walkModel.root);

        this.ramManNpc = patrolRig;
        this.ramManNpcAnimation = {
          state: null,
          mixers: [idleTrack.mixer, walkTrack.mixer],
          tracks: {
            idle: idleTrack,
            walk: walkTrack,
          },
        };
        this.setRamManNpcAnimation('idle');
        this.scene.add(patrolRig);

        console.info('Friendly Ram Man animation clips detected:', patrolRig.userData.animationClipDetails);
      })
      .catch((error) => {
        this.ramManNpcAnimation = null;
        console.warn(
          `Friendly Ram Man animated GLBs failed to load from ${RAM_MAN_NPC_IDLE_URL} or ${RAM_MAN_NPC_WALK_URL}. The dungeon remains playable.`,
          error,
        );
      });
  }

  updateTestModelPatrol(deltaSeconds) {
    if (!this.testModelProp || TEST_MODEL_PATROL_POINTS.length < 2) return;

    const target = TEST_MODEL_PATROL_POINTS[this.testModelMoveTarget];
    const current = this.testModelProp.position;
    const toTarget = target.clone().sub(current);
    toTarget.y = 0;
    const distance = toTarget.length();

    if (distance < 0.08) {
      this.testModelPatrolIndex = this.testModelMoveTarget;
      this.testModelMoveTarget = (this.testModelMoveTarget + 1) % TEST_MODEL_PATROL_POINTS.length;
      return;
    }

    const direction = toTarget.normalize();
    const stepDistance = Math.min(distance, TEST_MODEL_PATROL_SPEED * deltaSeconds);
    const next = current.clone().add(direction.multiplyScalar(stepDistance));
    next.y = FLOOR_Y;

    if (this.collision.canStandAt(next)) {
      current.copy(next);
    } else {
      this.testModelMoveTarget = (this.testModelMoveTarget + 1) % TEST_MODEL_PATROL_POINTS.length;
    }

    const desiredYaw = Math.atan2(direction.x, direction.z);
    this.testModelProp.rotation.y = THREE.MathUtils.damp(this.testModelProp.rotation.y, desiredYaw, TEST_MODEL_TURN_SPEED, deltaSeconds);

    if (this.testModelGlow) {
      this.testModelGlow.position.copy(this.testModelProp.position).add(new THREE.Vector3(0, 1.35, 0.2));
    }
  }


  addTestModelProp() {
    // Normalize the uploaded prop to player/enemy scale while ModelLoader keeps it grounded on the floor.
    loadDungeonModel({ url: TEST_MODEL_URL, targetHeight: 1.8, maxWidth: 1.65 })
      .then(({ root, scale }) => {
        root.name = 'dread-stone-black-test-model-01-model';

        const patrolRig = new THREE.Group();
        patrolRig.name = 'dread-stone-black-test-model-01';
        patrolRig.position.copy(TEST_MODEL_POSITION);
        patrolRig.rotation.y = TEST_MODEL_ROTATION_Y;
        patrolRig.userData = {
          assetUrl: TEST_MODEL_URL,
          normalizedScale: scale,
          placement: 'slow grounded patrol loop inside the entry chamber',
          patrolSpeed: TEST_MODEL_PATROL_SPEED,
        };
        patrolRig.add(root);

        this.testModelProp = patrolRig;
        this.scene.add(patrolRig);
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
    const barMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: TEXTURE_REPEATS.gateBars, color: 0xffffff, roughness: 0.72, metalness: 0.48, emissive: 0x1d130b, emissiveIntensity: 0.2 });
    const beamMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.gate, repeat: TEXTURE_REPEATS.gateBeams, color: 0xffffff, roughness: 0.72, metalness: 0.48, emissive: 0x1d130b, emissiveIntensity: 0.2 });
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xd5a159, transparent: true, opacity: 0.82 });

    for (let x = -1.05; x <= 1.05; x += 0.42) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.45, 0.18), barMat);
      bar.position.set(x, 1.25, -17.25);
      gateGroup.add(bar);
    }

    const top = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.18, 0.2), beamMat);
    top.position.set(0, 2.4, -17.25);
    gateGroup.add(top);

    const middle = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.16, 0.2), beamMat);
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
