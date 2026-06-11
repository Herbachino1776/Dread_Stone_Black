import * as THREE from 'three';
import { TorchDebugRenderer } from '../lighting/TorchDebugRenderer.js';
import { addIntegrityDebugLayer } from './integrity/DungeonIntegrityDebug.js';

const DEBUG_LAYERS = Object.freeze(['all', 'rooms', 'blockers', 'nav', 'spawns', 'encounters', 'exits', 'torches', 'integrity']);

function rectMesh(rect, color, y = 0.035, opacity = 0.18) {
  const width = rect.maxX - rect.minX;
  const depth = rect.maxZ - rect.minZ;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((rect.minX + rect.maxX) / 2, y, (rect.minZ + rect.maxZ) / 2);
  return mesh;
}

function marker(position, color, size = 0.5) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false }),
  );
  mesh.position.set(position.x, 0.35, position.z);
  return mesh;
}

function lineBetween(a, b, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(a.x, 0.16, a.z),
    new THREE.Vector3(b.x, 0.16, b.z),
  ]);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.78 }));
}

function ring(center, radius, color) {
  const points = [];
  for (let i = 0; i <= 48; i += 1) {
    const theta = (i / 48) * Math.PI * 2;
    points.push(new THREE.Vector3(center.x + Math.cos(theta) * radius, 0.14, center.z + Math.sin(theta) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.82 }));
}

export class DungeonDebugRenderer {
  constructor({ scene, runtime }) {
    this.enabledInBuild = Boolean(import.meta.env?.DEV);
    this.scene = scene;
    this.runtime = runtime;
    this.group = null;
    this.layerIndex = 0;
    this.visible = false;
    this.playerMarker = null;
    this.keyHandler = null;

    if (!this.enabledInBuild || !scene || !runtime) return;

    this.group = new THREE.Group();
    this.group.name = `${runtime.locationId}-dungeon-debug`;
    this.group.visible = false;
    this.group.userData = { locationId: runtime.locationId, devOnly: true };
    this.layers = Object.fromEntries(DEBUG_LAYERS.map((layer) => {
      const group = new THREE.Group();
      group.name = `${runtime.locationId}-debug-${layer}`;
      group.userData.devOnly = true;
      this.group.add(group);
      return [layer, group];
    }));

    this.build();
    this.scene.add(this.group);
    this.installControls();
  }

  build() {
    this.runtime.walkableRects.forEach((rect) => {
      const mesh = rectMesh(rect, 0x4ea4ff, 0.025, 0.14);
      mesh.userData = { locationId: this.runtime.locationId, roomId: rect.id, devOnly: true };
      this.layers.rooms.add(mesh);
    });

    this.runtime.blockerRects.forEach((rect) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(rect.maxX - rect.minX, Math.max(rect.height ?? 1.2, 0.25), rect.maxZ - rect.minZ),
        new THREE.MeshBasicMaterial({ color: 0xff4d2f, transparent: true, opacity: 0.28, depthWrite: false }),
      );
      mesh.position.set((rect.minX + rect.maxX) / 2, Math.max(rect.height ?? 1.2, 0.25) / 2, (rect.minZ + rect.maxZ) / 2);
      mesh.userData = { locationId: this.runtime.locationId, blockerId: rect.id, devOnly: true };
      this.layers.blockers.add(mesh);
    });

    Object.entries(this.runtime.navGraph.links ?? {}).forEach(([roomId, links]) => {
      const fromRoom = this.runtime.navGraph.rooms[roomId];
      links.forEach((link) => {
        const toRoom = this.runtime.navGraph.rooms[link.to];
        if (!fromRoom || !toRoom || roomId > link.to) return;
        this.layers.nav.add(lineBetween(fromRoom.center, link.waypoint ?? toRoom.center, 0xd8c25a));
        this.layers.nav.add(lineBetween(link.waypoint ?? fromRoom.center, toRoom.center, 0xd8c25a));
      });
    });

    this.runtime.spawnAnchors.forEach((spawn) => {
      const color = spawn.kind === 'player' || spawn.kind === 'return'
        ? 0x4b8dff
        : spawn.faction === 'neck_man'
          ? 0xc46cff
          : spawn.faction === 'sheep_demon'
            ? 0xff6a4a
            : 0x49ddb1;
      const mesh = marker(spawn.position, color, spawn.kind === 'debug' ? 0.35 : 0.58);
      mesh.userData = { locationId: this.runtime.locationId, spawnId: spawn.id, devOnly: true };
      this.layers.spawns.add(mesh);
    });

    this.runtime.encounterZones.forEach((zone) => {
      const mesh = ring(zone.center, zone.radius, 0xf2d35b);
      mesh.userData = { locationId: this.runtime.locationId, encounterZoneId: zone.id, devOnly: true };
      this.layers.encounters.add(mesh);
    });

    this.runtime.exits.forEach((exit) => {
      const mesh = rectMesh(exit.triggerRect, 0x3fe07e, 0.055, 0.24);
      mesh.userData = { locationId: this.runtime.locationId, exitId: exit.id, devOnly: true };
      this.layers.exits.add(mesh);
    });

    const torchDebug = new TorchDebugRenderer({ runtime: this.runtime });
    this.layers.torches.add(torchDebug.group);
    addIntegrityDebugLayer({ runtime: this.runtime, group: this.layers.integrity });

    this.playerMarker = marker(new THREE.Vector3(), 0xffffff, 0.42);
    this.playerMarker.name = `${this.runtime.locationId}-debug-player-position`;
    this.layers.all.add(this.playerMarker);
    this.applyLayerVisibility();
  }

  installControls() {
    if (typeof window === 'undefined' || this.keyHandler) return;
    this.keyHandler = (event) => {
      if (event.code === 'F2') {
        event.preventDefault();
        this.visible = !this.visible;
        this.group.visible = this.visible;
        console.info(`Dungeon debug ${this.visible ? 'enabled' : 'disabled'} for ${this.runtime.locationId}`);
      } else if (event.code === 'F3') {
        event.preventDefault();
        this.layerIndex = (this.layerIndex + 1) % DEBUG_LAYERS.length;
        this.applyLayerVisibility();
        if (this.visible) console.info(`Dungeon debug layer: ${DEBUG_LAYERS[this.layerIndex]}`);
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  applyLayerVisibility() {
    if (!this.layers) return;
    const activeLayer = DEBUG_LAYERS[this.layerIndex];
    Object.entries(this.layers).forEach(([layer, group]) => {
      group.visible = activeLayer === 'all' || layer === activeLayer || layer === 'all';
    });
  }

  update(playerPosition) {
    if (!this.enabledInBuild || !this.visible || !this.playerMarker || !playerPosition) return;
    this.playerMarker.position.set(playerPosition.x, 0.55, playerPosition.z);
  }
}
