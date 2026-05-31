import * as THREE from 'three';
import { CollisionWorld } from './Collision.js';

const WALL_HEIGHT = 3.2;
const FLOOR_Y = 0;

export class DungeonScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050506);
    this.scene.fog = new THREE.Fog(0x050506, 2.2, 13);

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
    this.addGate();
    return this.scene;
  }

  addLights() {
    const ambient = new THREE.HemisphereLight(0x384150, 0x050505, 0.8);
    this.scene.add(ambient);

    const torchGlow = new THREE.PointLight(0xc47a38, 2.8, 9);
    torchGlow.position.set(-3.5, 2, 3.5);
    this.scene.add(torchGlow);

    const corridorGlow = new THREE.PointLight(0x76614d, 1.2, 7);
    corridorGlow.position.set(0, 2.2, -10.5);
    this.scene.add(corridorGlow);
  }

  makeStoneMaterial(color = 0x3b3a38) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.95,
      metalness: 0.02,
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
    const wallMat = this.makeStoneMaterial();
    const floorMat = this.makeStoneMaterial(0x252423);
    const ceilingMat = this.makeStoneMaterial(0x181817);

    this.addBox({ size: new THREE.Vector3(12, 0.18, 12), position: new THREE.Vector3(0, FLOOR_Y - 0.09, 0), material: floorMat });
    this.addBox({ size: new THREE.Vector3(12, 0.18, 12), position: new THREE.Vector3(0, WALL_HEIGHT, 0), material: ceilingMat });
    this.addBox({ size: new THREE.Vector3(12, WALL_HEIGHT, 0.4), position: new THREE.Vector3(0, WALL_HEIGHT / 2, 6), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.4, WALL_HEIGHT, 12), position: new THREE.Vector3(-6, WALL_HEIGHT / 2, 0), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.4, WALL_HEIGHT, 12), position: new THREE.Vector3(6, WALL_HEIGHT / 2, 0), material: wallMat });

    // Back wall is split to leave a dark corridor opening.
    this.addBox({ size: new THREE.Vector3(4.7, WALL_HEIGHT, 0.4), position: new THREE.Vector3(-3.65, WALL_HEIGHT / 2, -6), material: wallMat });
    this.addBox({ size: new THREE.Vector3(4.7, WALL_HEIGHT, 0.4), position: new THREE.Vector3(3.65, WALL_HEIGHT / 2, -6), material: wallMat });
  }

  addCorridor() {
    const wallMat = this.makeStoneMaterial(0x323130);
    const floorMat = this.makeStoneMaterial(0x20201f);
    const ceilingMat = this.makeStoneMaterial(0x151514);

    this.addBox({ size: new THREE.Vector3(3.1, 0.18, 12), position: new THREE.Vector3(0, FLOOR_Y - 0.09, -11.6), material: floorMat });
    this.addBox({ size: new THREE.Vector3(3.1, 0.18, 12), position: new THREE.Vector3(0, WALL_HEIGHT, -11.6), material: ceilingMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 12), position: new THREE.Vector3(-1.7, WALL_HEIGHT / 2, -11.6), material: wallMat });
    this.addBox({ size: new THREE.Vector3(0.35, WALL_HEIGHT, 12), position: new THREE.Vector3(1.7, WALL_HEIGHT / 2, -11.6), material: wallMat });
  }

  addGate() {
    const gateGroup = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.7, metalness: 0.65 });

    for (let x = -1.05; x <= 1.05; x += 0.42) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.45, 0.16), metalMat);
      bar.position.set(x, 1.25, -17.25);
      gateGroup.add(bar);
    }

    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.18), metalMat);
    top.position.set(0, 2.4, -17.25);
    gateGroup.add(top);

    const middle = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.18), metalMat);
    middle.position.set(0, 1.35, -17.25);
    gateGroup.add(middle);

    this.gate = gateGroup;
    this.scene.add(gateGroup);
  }
}
