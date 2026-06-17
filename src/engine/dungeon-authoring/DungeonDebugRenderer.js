import * as THREE from 'three';
import { TorchDebugRenderer } from '../lighting/TorchDebugRenderer.js';
import { addIntegrityDebugLayer } from './integrity/DungeonIntegrityDebug.js';

const DEBUG_LAYERS = Object.freeze(['all', 'rooms', 'blockers', 'nav', 'spawns', 'encounters', 'exits', 'torches', 'integrity', 'v2', 'elevation']);

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


function xz(value, y = 0.2) {
  return new THREE.Vector3(Number(value?.x ?? value?.[0] ?? 0), y, Number(value?.z ?? value?.[1] ?? 0));
}

function polyline(points, color, closed = false, y = 0.18) {
  const vectors = points.map((point) => xz(point, y));
  if (closed && vectors.length > 0) vectors.push(vectors[0].clone());
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(vectors), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.88 }));
}

function surfaceRect(surface, color) {
  const [x0, z0] = surface.from;
  const [x1, z1] = surface.to;
  const length = Math.hypot(x1 - x0, z1 - z0);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(surface.width ?? 1, length),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = -Math.atan2(x1 - x0, z1 - z0);
  mesh.position.set((x0 + x1) / 2, (surface.y ?? surface.y0 ?? 0) + 0.09, (z0 + z1) / 2);
  return mesh;
}

function arrow(from, to, color) {
  const start = xz(from, 0.28);
  const end = xz(to, 0.28);
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= 0.0001) return new THREE.Group();
  return new THREE.ArrowHelper(direction.normalize(), start, length, color, Math.min(0.8, length * 0.24), 0.35);
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
      const height = Math.max(rect.height ?? 1.2, 0.25);
      const material = new THREE.MeshBasicMaterial({ color: rect.blockerShape === 'segment' ? 0xffc02f : 0xff4d2f, transparent: true, opacity: 0.28, depthWrite: false });
      let mesh;
      if (rect.blockerShape === 'segment' && rect.from && rect.to) {
        const length = Math.hypot(rect.to.x - rect.from.x, rect.to.z - rect.from.z);
        mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, rect.thickness ?? 0.32), material);
        mesh.position.set((rect.from.x + rect.to.x) / 2, height / 2, (rect.from.z + rect.to.z) / 2);
        mesh.rotation.y = Math.atan2(rect.to.z - rect.from.z, rect.to.x - rect.from.x);
      } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(rect.maxX - rect.minX, height, rect.maxZ - rect.minZ), material);
        mesh.position.set((rect.minX + rect.maxX) / 2, height / 2, (rect.minZ + rect.maxZ) / 2);
      }
      mesh.userData = { locationId: this.runtime.locationId, blockerId: rect.id, blockerShape: rect.blockerShape ?? 'aabb', devOnly: true };
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


    const v2 = this.runtime.debugData?.v2Primitives ?? {};
    v2.polygonFloors?.forEach((floor) => this.layers.v2.add(polyline(floor.points ?? [], 0x4ea4ff, true, (floor.y ?? 0) + 0.12)));
    v2.wallSegments?.forEach((wall) => {
      this.layers.v2.add(polyline([wall.from, wall.to], 0xff4d2f, false, (wall.y ?? 0) + 0.22));
      const a = xz(wall.from, 0.38); const b = xz(wall.to, 0.38); const mid = a.clone().lerp(b, 0.5); const dir = b.clone().sub(a).normalize();
      this.layers.v2.add(new THREE.ArrowHelper(new THREE.Vector3(-dir.z, 0, dir.x), mid, 0.8, 0xff9c2f, 0.25, 0.16));
    });
    v2.doorGaps?.forEach((gap) => this.layers.v2.add(marker({ x: 0, z: 0, ...(gap.position ?? {}) }, 0x3fe07e, 0.38)));
    v2.wallPropAnchors?.forEach((anchor) => this.layers.v2.add(marker({ x: 0, z: 0 }, 0xffd36a, 0.28)));
    v2.pathRibbons?.forEach((ribbon) => this.layers.v2.add(polyline(ribbon.points ?? [], 0xe6d15c, false, (ribbon.y ?? 0) + 0.2)));
    v2.platforms?.forEach((platform) => this.layers.v2.add(polyline(platform.footprint ?? [], 0xc46cff, true, (platform.y ?? 0) + (platform.height ?? 0) + 0.16)));
    v2.ramps?.forEach((ramp) => this.layers.v2.add(arrow(ramp.from, ramp.to, 0x49ddb1)));
    v2.stairs?.forEach((stairs) => this.layers.v2.add(arrow(stairs.from, stairs.to, 0xffffff)));
    v2.bridges?.forEach((bridge) => this.layers.v2.add(polyline([bridge.from, bridge.to], 0x8fd4ff, false, (bridge.y ?? 0) + 0.25)));
    v2.architecturalPrimitives?.forEach((primitive) => {
      const color = primitive.blocksPlayer === false || ['railing', 'wallPanel', 'canalWater', 'curb'].includes(primitive.kind) ? 0x6ae6ff : 0xff6ad5;
      if (primitive.from && primitive.to) this.layers.v2.add(polyline([primitive.from, primitive.to], color, false, (primitive.y ?? 0) + (primitive.height ?? 0.35) + 0.18));
      if (primitive.position) {
        const size = primitive.radius ? primitive.radius * 2 : Math.max(primitive.width ?? primitive.baseWidth ?? 0.8, primitive.depth ?? primitive.thickness ?? 0.4);
        const pos = xz(primitive.position, (primitive.position?.y ?? primitive.position?.[1] ?? 0) + 0.4);
        const m = marker(pos, color, Math.max(0.22, Math.min(0.8, size)));
        m.name = `debug-primitive-${primitive.id}`;
        m.userData = { primitiveId: primitive.id, primitiveKind: primitive.kind, label: primitive.id };
        this.layers.v2.add(m);
      }
      if (['straightStair', 'wideSacredStair', 'narrowCryptStair', 'brokenStair', 'sunkenSteps', 'daisStair', 'splitStair', 'bridgeStair', 'cornerStair', 'processionalStair'].includes(primitive.kind)) {
        const p = xz(primitive.position, (primitive.position?.y ?? primitive.position?.[1] ?? 0) + (primitive.height ?? 1.2) + 0.22);
        const yaw = primitive.yaw ?? primitive.rotation ?? 0;
        const width = primitive.width ?? 2.4;
        const depth = primitive.length ?? primitive.depth ?? 4;
        const c = Math.cos(yaw); const sn = Math.sin(yaw);
        const corners = [[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]]
          .map(([x, z]) => ({ x: p.x + x * c - z * sn, z: p.z + x * sn + z * c }));
        const footprint = polyline(corners, 0xffffff, true, p.y);
        footprint.name = `debug-stair-footprint-${primitive.id}`;
        footprint.userData = { primitiveId: primitive.id, primitiveKind: primitive.kind, label: `${primitive.id} footprint` };
        this.layers.v2.add(footprint);
      }
      if (['arch', 'doorFrame', 'thickStoneDoorway', 'openArchPortal', 'bronzeSealedGate', 'lockedRitualGate', 'brokenGateFrame', 'doubleTempleDoor', 'returnPortalFrame', 'sunDiskThreshold', 'narrowCryptPortal', 'grandProcessionalGate'].includes(primitive.kind)) {
        const yaw = primitive.yaw ?? primitive.rotation ?? 0; const width = primitive.width ?? 2; const p = xz(primitive.position, 0.5); const dx = Math.cos(yaw) * width / 2; const dz = -Math.sin(yaw) * width / 2;
        this.layers.v2.add(lineBetween({ x: p.x - dx, z: p.z - dz }, { x: p.x + dx, z: p.z + dz }, 0x3fe07e));
      }
      if (primitive.kind === 'wallPanel') {
        const wall = v2.wallSegments?.find((candidate) => candidate.id === primitive.wallSegmentId);
        if (wall) { const a = xz(wall.from, 0.65); const b = xz(wall.to, 0.65); const mid = a.clone().lerp(b, primitive.t ?? 0.5); const dir = b.clone().sub(a).normalize(); this.layers.v2.add(new THREE.ArrowHelper(new THREE.Vector3(-dir.z, 0, dir.x), mid, 0.7, 0x6ae6ff, 0.2, 0.12)); }
      }
    });

    this.runtime.walkableSurfaces?.forEach((surface) => {
      if (surface.footprint) this.layers.elevation.add(polyline(surface.footprint, surface.kind === 'platformTop' ? 0xc46cff : 0x49ddb1, true, (surface.y ?? 0) + 0.22));
      if (surface.from && surface.to) {
        this.layers.elevation.add(surfaceRect(surface, surface.kind === 'bridgeDeck' ? 0x8fd4ff : 0x49ddb1));
        if (['ramp', 'stairRamp'].includes(surface.kind)) this.layers.elevation.add(arrow(surface.from, surface.to, surface.kind === 'stairRamp' ? 0xffffff : 0x49ddb1));
      }
    });
    this.runtime.validation?.warnings?.filter((issue) => issue.message?.startsWith('V2 wall loop warning')).forEach((issue, index) => {
      const mesh = marker({ x: -14 + index * 0.8, z: 10 }, 0xffea00, 0.32);
      mesh.userData.warning = issue.message;
      this.layers.elevation.add(mesh);
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
    const sampled = this.runtime.collisionWorld?.sampleWalkableY?.(playerPosition.x, playerPosition.z, 0);
    this.playerMarker.position.set(playerPosition.x, (sampled?.y ?? 0) + 0.55, playerPosition.z);
    this.playerMarker.userData.sampledFloorY = sampled?.y ?? 0;
  }
}
