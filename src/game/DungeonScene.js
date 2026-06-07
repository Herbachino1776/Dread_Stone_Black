import * as THREE from 'three';
import { CollisionWorld } from './Collision.js';
import { loadDungeonModel } from './ModelLoader.js';

const WALL_HEIGHT = 3.2;
const FLOOR_Y = 0;
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
const ROOM_DOORWAY_Z = -4.35;

const TEXTURE_PATHS = {
  wall: './assets/textures/wall_black_stone_01.png',
  floor: './assets/textures/floor_worn_stone_01.png',
  ceiling: './assets/textures/ceiling_dark_stone_01.png',
  gate: './assets/textures/metal_gate_rusted_01.png',
  fieldGrass: './assets/textures/outdoor/field_dead_grass_01.png',
};

const FIELD_SIZE = 400;
const FIELD_HALF_SIZE = FIELD_SIZE / 2;
const FIELD_SEGMENTS = 96;
const FIELD_GRASS_REPEAT = [50, 50];
const FIELD_PLAYER_START = new THREE.Vector3(0, 1.55, 170);
const FIELD_PLAYER_YAW = Math.PI;
const FIELD_WALKABLE_RECT = { minX: -197.5, maxX: 197.5, minZ: -197.5, maxZ: 197.5 };
const CRYPT_ENTRANCES = [
  { id: 'crypt_entrance_a', label: 'Crypt A', position: new THREE.Vector3(-95, FLOOR_Y, -40), yaw: Math.PI / 2, functional: true },
  { id: 'crypt_entrance_b', label: 'Crypt B', position: new THREE.Vector3(115, FLOOR_Y, -95), yaw: -Math.PI / 2, functional: false },
  { id: 'crypt_entrance_c', label: 'Crypt C', position: new THREE.Vector3(0, FLOOR_Y, -175), yaw: Math.PI, functional: false },
];

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
  constructor({ area = 'field' } = {}) {
    this.area = area;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090807);
    this.scene.fog = new THREE.Fog(0x080706, 6.5, 20);
    this.textureLoader = new THREE.TextureLoader();
    this.textureCheckRig = null;
    this.playerSpawn = this.area === 'field'
      ? { spawnPosition: FIELD_PLAYER_START, spawnYaw: FIELD_PLAYER_YAW }
      : { spawnPosition: new THREE.Vector3(0, 1.55, 3.2), spawnYaw: Math.PI };
    this.outdoorInteractions = [];

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
    this.ramManNpc = null;
    this.ramManNpcPatrolIndex = 0;
    this.ramManNpcMoveTarget = 1;
    this.ramManNpcPauseTimer = 0;
    this.ramManNpcAnimation = null;
    this.torchLights = [];
    this.lightTime = 0;
    this.gateBlocker = { minX: -1.45, maxX: 1.45, minZ: -17.55, maxZ: -16.95 };
    this.shortcutBlocker = { minX: -6.15, maxX: -4.65, minZ: -5.12, maxZ: -3.58 };
    this.secretWallBlocker = { minX: 7.05, maxX: 9.35, minZ: -24.65, maxZ: -23.82 };
    const indoorWalkableRects = [
      { minX: -5.6, maxX: 5.6, minZ: -5.6, maxZ: 5.6 },
      { minX: -1.35, maxX: 1.35, minZ: -17.2, maxZ: -5.6 },
      { minX: -1.35, maxX: 1.35, minZ: -22.2, maxZ: -17.2 },
      { minX: -4.75, maxX: 4.75, minZ: -22.2, maxZ: -19.35 },
      { minX: 4.75, maxX: 9.6, minZ: -24.25, maxZ: -17.85 },
      { minX: -7.85, maxX: -4.75, minZ: -22.2, maxZ: -3.35 },
      { minX: 7.05, maxX: 9.35, minZ: -27.1, maxZ: -24.25 },
    ];

    this.collision = this.area === 'field'
      ? new CollisionWorld({ walkableRects: [FIELD_WALKABLE_RECT], blockerRects: this.createOutdoorBlockers(), playerRadius: 0.5 })
      : new CollisionWorld({
        walkableRects: indoorWalkableRects,
        blockerRects: [this.gateBlocker, this.shortcutBlocker, this.secretWallBlocker],
      });
  }

  build() {
    if (this.area === 'field') {
      this.buildOutdoorField();
    } else {
      this.buildIndoorDungeon();
    }

    this.addTextureVerificationMode();
    return this.scene;
  }

  buildIndoorDungeon() {
    this.addLights();
    this.addRoom();
    this.addCorridor();
    this.addDungeonExpansion();
    this.addPathCues();
    this.addTorches();
    this.addKeyPickup();
    this.addLever();
    this.addGate();
    this.addRamManNpc();
  }

  buildOutdoorField() {
    this.scene.background = new THREE.Color(0x1b1a17);
    this.scene.fog = new THREE.Fog(0x24211d, 55, 185);
    this.addOutdoorLights();
    this.addOutdoorTerrain();
    this.addOutdoorBoundary();
    this.addCentralLandmark();
    CRYPT_ENTRANCES.forEach((crypt) => this.addCryptEntrance(crypt));
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

  createOutdoorBlockers() {
    const blockers = [];
    const wallThickness = 5;
    blockers.push({ minX: -FIELD_HALF_SIZE - wallThickness, maxX: FIELD_HALF_SIZE + wallThickness, minZ: -FIELD_HALF_SIZE - wallThickness, maxZ: -FIELD_HALF_SIZE + 2 });
    blockers.push({ minX: -FIELD_HALF_SIZE - wallThickness, maxX: FIELD_HALF_SIZE + wallThickness, minZ: FIELD_HALF_SIZE - 2, maxZ: FIELD_HALF_SIZE + wallThickness });
    blockers.push({ minX: -FIELD_HALF_SIZE - wallThickness, maxX: -FIELD_HALF_SIZE + 2, minZ: -FIELD_HALF_SIZE - wallThickness, maxZ: FIELD_HALF_SIZE + wallThickness });
    blockers.push({ minX: FIELD_HALF_SIZE - 2, maxX: FIELD_HALF_SIZE + wallThickness, minZ: -FIELD_HALF_SIZE - wallThickness, maxZ: FIELD_HALF_SIZE + wallThickness });

    CRYPT_ENTRANCES.forEach(({ position }) => {
      blockers.push({ minX: position.x - 5.6, maxX: position.x + 5.6, minZ: position.z - 3.8, maxZ: position.z + 3.8 });
    });

    blockers.push({ minX: -2.2, maxX: 2.2, minZ: -29, maxZ: -21.5 });
    return blockers;
  }

  addOutdoorLights() {
    const ambient = new THREE.HemisphereLight(0x667080, 0x15100b, 0.58);
    this.scene.add(ambient);

    const cloudedMoon = new THREE.DirectionalLight(0x9ba1a6, 0.36);
    cloudedMoon.position.set(-35, 70, 45);
    this.scene.add(cloudedMoon);

    const tombFill = new THREE.PointLight(0x5b4630, 1.45, 38, 1.8);
    tombFill.position.set(0, 3, -25);
    this.scene.add(tombFill);
  }

  getOutdoorTerrainHeight(x, z) {
    const ridge = Math.sin(x * 0.035) * 0.34 + Math.cos(z * 0.031) * 0.28;
    const lowRoll = Math.sin((x + z) * 0.014) * 0.42 + Math.cos((x - z) * 0.018) * 0.22;
    const depression = -0.34 * Math.exp(-((x * x) + ((z + 40) * (z + 40))) / 9500);
    return THREE.MathUtils.clamp(0.58 + ridge + lowRoll + depression, 0.08, 1.22);
  }

  addOutdoorTerrain() {
    const grassMaterial = this.makeTexturedMaterial({
      path: TEXTURE_PATHS.fieldGrass,
      repeat: FIELD_GRASS_REPEAT,
      color: 0x8d8770,
      roughness: 0.98,
      metalness: 0.0,
      emissive: 0x161208,
      emissiveIntensity: 0.07,
    });
    const geometry = new THREE.PlaneGeometry(FIELD_SIZE, FIELD_SIZE, FIELD_SEGMENTS, FIELD_SEGMENTS);
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const z = position.getZ(index);
      position.setY(index, this.getOutdoorTerrainHeight(x, z) - 0.58);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();

    const terrain = new THREE.Mesh(geometry, grassMaterial);
    terrain.name = 'outdoor-tomb-field-400x400-dead-grass-repeat-50x50';
    terrain.receiveShadow = true;
    terrain.userData = {
      implementedFieldSize: FIELD_SIZE,
      longTermBlueprintSize: 800,
      textureRepeat: FIELD_GRASS_REPEAT,
      collisionNote: 'Visual terrain undulates; player collision stays on a stable flat 400x400 walkable rectangle for this first outdoor slice.',
    };
    this.scene.add(terrain);
  }

  addOutdoorBoundary() {
    const wallMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [24, 1.15], color: 0x635d52, roughness: 0.96, metalness: 0.0 });
    const moundMat = new THREE.MeshStandardMaterial({ color: 0x262016, roughness: 1.0, metalness: 0.0 });
    const wallHeight = 4.4;
    const wallThickness = 4.5;

    [
      { size: new THREE.Vector3(FIELD_SIZE + wallThickness * 2, wallHeight, wallThickness), position: new THREE.Vector3(0, wallHeight / 2 - 0.55, -FIELD_HALF_SIZE) },
      { size: new THREE.Vector3(FIELD_SIZE + wallThickness * 2, wallHeight, wallThickness), position: new THREE.Vector3(0, wallHeight / 2 - 0.55, FIELD_HALF_SIZE) },
      { size: new THREE.Vector3(wallThickness, wallHeight, FIELD_SIZE + wallThickness * 2), position: new THREE.Vector3(-FIELD_HALF_SIZE, wallHeight / 2 - 0.55, 0) },
      { size: new THREE.Vector3(wallThickness, wallHeight, FIELD_SIZE + wallThickness * 2), position: new THREE.Vector3(FIELD_HALF_SIZE, wallHeight / 2 - 0.55, 0) },
    ].forEach((wall, index) => this.addBox({ ...wall, material: wallMat, name: `outdoor-hard-boundary-${index + 1}` }));

    const fogBank = new THREE.Mesh(new THREE.BoxGeometry(FIELD_SIZE + 12, 2.2, FIELD_SIZE + 12), moundMat);
    fogBank.name = 'outdoor-boundary-low-fog-sill';
    fogBank.position.set(0, -1.8, 0);
    this.scene.add(fogBank);
  }

  addCentralLandmark() {
    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [1.2, 1.8], color: 0x807a6d, roughness: 0.97, metalness: 0.0 });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2e281f, roughness: 1.0 });
    const group = new THREE.Group();
    group.name = 'outdoor-central-landmark-standing-stone';
    group.position.set(0, this.getOutdoorTerrainHeight(0, -25) - 0.2, -25);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 5.4, 0.75, 9), baseMat);
    base.position.y = 0.15;
    group.add(base);

    const marker = new THREE.Mesh(new THREE.BoxGeometry(2.2, 7.4, 1.35), stoneMat);
    marker.position.y = 4.05;
    marker.rotation.z = 0.08;
    marker.rotation.y = -0.25;
    group.add(marker);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.1, 1.75), stoneMat);
    cap.position.y = 7.95;
    cap.rotation.z = -0.11;
    group.add(cap);

    this.scene.add(group);
  }

  addCryptEntrance({ id, label, position, yaw, functional }) {
    const group = new THREE.Group();
    group.name = id;
    group.position.set(position.x, this.getOutdoorTerrainHeight(position.x, position.z) - 0.45, position.z);
    group.rotation.y = yaw;

    const stoneMat = this.makeTexturedMaterial({ path: TEXTURE_PATHS.wall, repeat: [1.4, 1.3], color: 0x5d5a52, roughness: 0.96, metalness: 0.0 });
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x24211e, roughness: 0.95, metalness: 0.03, emissive: 0x030202, emissiveIntensity: 0.55 });
    const earthMat = new THREE.MeshStandardMaterial({ color: 0x2d2519, roughness: 1.0, metalness: 0.0 });

    const mound = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 15.5, 1.7, 12), earthMat);
    mound.scale.z = 0.65;
    mound.position.y = 0.35;
    group.add(mound);

    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5.2, 2.1), stoneMat);
    leftPillar.position.set(-4.1, 2.7, 0.15);
    group.add(leftPillar);

    const rightPillar = leftPillar.clone();
    rightPillar.position.x = 4.1;
    group.add(rightPillar);

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(10.2, 1.8, 2.35), stoneMat);
    lintel.position.set(0, 5.65, 0.05);
    group.add(lintel);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(5.8, 4.1, 1.25), slabMat);
    mouth.position.set(0, 2.35, -0.45);
    mouth.name = `${id}-dark-tomb-mouth`;
    group.add(mouth);

    const stairMat = new THREE.MeshStandardMaterial({ color: 0x34302a, roughness: 0.94, metalness: 0.0 });
    for (let step = 0; step < 3; step += 1) {
      const stair = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.28, 1.15), stairMat);
      stair.position.set(0, 0.1 - step * 0.12, 2.0 + step * 1.05);
      group.add(stair);
    }

    if (!functional) {
      const seal = new THREE.Mesh(new THREE.BoxGeometry(5.1, 3.45, 0.36), stoneMat);
      seal.name = `${id}-sealed-slab`;
      seal.position.set(0, 2.2, 0.24);
      seal.rotation.z = id === 'crypt_entrance_b' ? 0.08 : -0.05;
      group.add(seal);
    }

    this.outdoorInteractions.push({ id, label, target: position.clone().setY(1.5), functional });
    this.scene.add(group);
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
