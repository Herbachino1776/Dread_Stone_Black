import * as THREE from 'three';
import { asArray, resolveTextureProfile } from './DungeonDefinitionTypes.js';
import { TorchFixture } from '../lighting/TorchFixture.js';

function toVector3(value, fallbackY = 0) {
  return new THREE.Vector3(
    Number(value?.x ?? value?.[0] ?? 0),
    Number(value?.y ?? value?.[1] ?? fallbackY),
    Number(value?.z ?? value?.[2] ?? 0),
  );
}

function makeFallbackMaterial(profile = {}) {
  return new THREE.MeshStandardMaterial({
    color: profile.color ?? 0xffffff,
    roughness: profile.roughness ?? 0.9,
    metalness: profile.metalness ?? 0,
    emissive: profile.emissive ?? 0x000000,
    emissiveIntensity: profile.emissiveIntensity ?? 0,
  });
}

function makeMaterial(definition, reference, materialFactory, fallbackProfile) {
  const profile = resolveTextureProfile(definition, reference, fallbackProfile) ?? fallbackProfile ?? {};
  return materialFactory ? materialFactory(profile) : makeFallbackMaterial(profile);
}

function addBox({ group, size, position, material, name, userData = {} }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { ...mesh.userData, ...userData };
  group.add(mesh);
  return mesh;
}

function gapCenter(gap) {
  return toVector3(gap.position ?? gap.navWaypoint);
}

function collectWallGaps(definition, room) {
  const gaps = [];
  asArray(definition.doors ?? definition.connectors).forEach((door) => {
    asArray(door.wallGaps).forEach((gap) => {
      if (gap.roomId === room.id) {
        gaps.push({ ...gap, id: `${door.id}:${gap.roomId}`, width: gap.width ?? door.width ?? 3.6 });
      }
    });

    if (door.fromRoom === room.id || door.toRoom === room.id) {
      gaps.push({ id: door.id, position: door.position, width: door.width ?? 3.6 });
    }
  });

  asArray(definition.exits).forEach((exit) => {
    asArray(exit.wallGaps).forEach((gap) => {
      if (gap.roomId === room.id) {
        gaps.push({ ...gap, id: `${exit.id}:${gap.roomId}`, width: gap.width ?? exit.width ?? 3.5 });
      }
    });
  });

  return gaps;
}

function addRoomWalls({ definition, group, room, material, wallThickness, wallHeight }) {
  const gaps = collectWallGaps(definition, room);
  const locationId = definition.id;
  const addHorizontal = (z, side) => {
    const sideGaps = gaps
      .map((gap) => ({ ...gap, center: gapCenter(gap) }))
      .filter((gap) => Math.abs(gap.center.z - z) < 1.1 && gap.center.x >= room.minX - 0.2 && gap.center.x <= room.maxX + 0.2)
      .sort((a, b) => a.center.x - b.center.x);
    let cursor = room.minX;
    sideGaps.forEach((gap) => {
      const start = Math.max(room.minX, gap.center.x - gap.width / 2);
      const end = Math.min(room.maxX, gap.center.x + gap.width / 2);
      if (start - cursor > 0.2) {
        addBox({
          group,
          size: new THREE.Vector3(start - cursor, wallHeight, wallThickness),
          position: new THREE.Vector3((cursor + start) / 2, wallHeight / 2, z + side * wallThickness / 2),
          material,
          name: `${locationId}-${room.id}-wall-z-${z}`,
          userData: { locationId, roomId: room.id, generatedBy: 'DungeonGeometryBuilder' },
        });
      }
      cursor = Math.max(cursor, end);
    });
    if (room.maxX - cursor > 0.2) {
      addBox({
        group,
        size: new THREE.Vector3(room.maxX - cursor, wallHeight, wallThickness),
        position: new THREE.Vector3((cursor + room.maxX) / 2, wallHeight / 2, z + side * wallThickness / 2),
        material,
        name: `${locationId}-${room.id}-wall-z-${z}`,
        userData: { locationId, roomId: room.id, generatedBy: 'DungeonGeometryBuilder' },
      });
    }
  };

  const addVertical = (x, side) => {
    const sideGaps = gaps
      .map((gap) => ({ ...gap, center: gapCenter(gap) }))
      .filter((gap) => Math.abs(gap.center.x - x) < 1.1 && gap.center.z >= room.minZ - 0.2 && gap.center.z <= room.maxZ + 0.2)
      .sort((a, b) => a.center.z - b.center.z);
    let cursor = room.minZ;
    sideGaps.forEach((gap) => {
      const start = Math.max(room.minZ, gap.center.z - gap.width / 2);
      const end = Math.min(room.maxZ, gap.center.z + gap.width / 2);
      if (start - cursor > 0.2) {
        addBox({
          group,
          size: new THREE.Vector3(wallThickness, wallHeight, start - cursor),
          position: new THREE.Vector3(x + side * wallThickness / 2, wallHeight / 2, (cursor + start) / 2),
          material,
          name: `${locationId}-${room.id}-wall-x-${x}`,
          userData: { locationId, roomId: room.id, generatedBy: 'DungeonGeometryBuilder' },
        });
      }
      cursor = Math.max(cursor, end);
    });
    if (room.maxZ - cursor > 0.2) {
      addBox({
        group,
        size: new THREE.Vector3(wallThickness, wallHeight, room.maxZ - cursor),
        position: new THREE.Vector3(x + side * wallThickness / 2, wallHeight / 2, (cursor + room.maxZ) / 2),
        material,
        name: `${locationId}-${room.id}-wall-x-${x}`,
        userData: { locationId, roomId: room.id, generatedBy: 'DungeonGeometryBuilder' },
      });
    }
  };

  addHorizontal(room.minZ, -1);
  addHorizontal(room.maxZ, 1);
  addVertical(room.minX, -1);
  addVertical(room.maxX, 1);
}

function addRoomGeometry({ definition, group, room, materialFactory }) {
  if (room.visibleGeometry === false) return;

  const floorY = room.floorY ?? definition.defaultFloorY ?? 0;
  const ceilingY = room.ceilingY ?? definition.defaultCeilingY ?? 3.2;
  const wallHeight = ceilingY - floorY;
  const width = room.maxX - room.minX;
  const depth = room.maxZ - room.minZ;
  const center = new THREE.Vector3((room.minX + room.maxX) / 2, floorY, (room.minZ + room.maxZ) / 2);
  const floorMaterial = makeMaterial(definition, room.floorTexture, materialFactory, definition.textures?.floor);
  const ceilingMaterial = makeMaterial(definition, room.ceilingTexture, materialFactory, definition.textures?.ceiling);
  const wallMaterial = makeMaterial(definition, room.wallTexture, materialFactory, definition.textures?.wall);
  const baseUserData = { locationId: definition.id, roomId: room.id, generatedBy: 'DungeonGeometryBuilder' };

  addBox({
    group,
    size: new THREE.Vector3(width, definition.geometry?.floorThickness ?? 0.18, depth),
    position: new THREE.Vector3(center.x, floorY - (definition.geometry?.floorThickness ?? 0.18) / 2, center.z),
    material: floorMaterial,
    name: `${definition.id}-${room.id}-floor`,
    userData: baseUserData,
  });

  addBox({
    group,
    size: new THREE.Vector3(width, definition.geometry?.ceilingThickness ?? 0.18, depth),
    position: new THREE.Vector3(center.x, ceilingY, center.z),
    material: ceilingMaterial,
    name: `${definition.id}-${room.id}-ceiling`,
    userData: baseUserData,
  });

  if (room.wallGeometry !== false) {
    addRoomWalls({
      definition,
      group,
      room,
      material: wallMaterial,
      wallThickness: definition.geometry?.wallThickness ?? 0.35,
      wallHeight,
    });
  }
}


function point2(value) {
  return new THREE.Vector2(Number(value?.x ?? value?.[0] ?? 0), Number(value?.z ?? value?.[1] ?? 0));
}

function point3FromXZ(value, y = 0) {
  return new THREE.Vector3(Number(value?.x ?? value?.[0] ?? 0), y, Number(value?.z ?? value?.[1] ?? 0));
}

function segmentParts(segment, doorGaps) {
  const from = point3FromXZ(segment.from, segment.y ?? 0);
  const to = point3FromXZ(segment.to, segment.y ?? 0);
  const length = from.distanceTo(to);
  if (length <= 0.0001) return [];
  const cuts = asArray(doorGaps)
    .filter((gap) => gap.wallSegmentId === segment.id)
    .map((gap) => {
      const halfT = (gap.width ?? 0) / length / 2;
      return {
        start: THREE.MathUtils.clamp((gap.centerT ?? 0.5) - halfT, 0, 1),
        end: THREE.MathUtils.clamp((gap.centerT ?? 0.5) + halfT, 0, 1),
      };
    })
    .filter((gap) => gap.end > gap.start)
    .sort((a, b) => a.start - b.start);
  const ranges = [];
  let cursor = 0;
  cuts.forEach((gap) => {
    if (gap.start - cursor > 0.02) ranges.push([cursor, gap.start]);
    cursor = Math.max(cursor, gap.end);
  });
  if (1 - cursor > 0.02) ranges.push([cursor, 1]);
  return ranges.map(([startT, endT]) => ({
    startT,
    endT,
    from: from.clone().lerp(to, startT),
    to: from.clone().lerp(to, endT),
  }));
}

function addV2PolygonFloors({ definition, group, materialFactory }) {
  return asArray(definition.polygonFloors).map((floor) => {
    const points = asArray(floor.points).map(point2);
    if (points.length < 3) return null;
    const triangles = THREE.ShapeUtils.triangulateShape(points, []);
    const y = floor.y ?? definition.defaultFloorY ?? 0;
    const vertices = [];
    const uvs = [];
    points.forEach((point) => {
      vertices.push(point.x, y, point.y);
      uvs.push(point.x * 0.18, point.y * 0.18);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(triangles.flat());
    geometry.computeVertexNormals();
    const material = makeMaterial(definition, floor.material ?? floor.textureProfile, materialFactory, definition.textures?.floor);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `V2-FLOOR-${floor.id}`;
    mesh.receiveShadow = true;
    mesh.userData = { locationId: definition.id, roomId: floor.roomId, polygonFloorId: floor.id, generatedBy: 'DungeonGeometryBuilder:v2' };
    group.add(mesh);
    return mesh;
  }).filter(Boolean);
}

function addV2WallSegments({ definition, group, materialFactory }) {
  const walls = [];
  asArray(definition.wallSegments).forEach((segment) => {
    const material = makeMaterial(definition, segment.material ?? segment.textureProfile, materialFactory, definition.textures?.wall);
    const height = segment.height ?? definition.geometry?.wallHeight ?? 3.5;
    const thickness = segment.thickness ?? definition.geometry?.wallThickness ?? 0.32;
    segmentParts(segment, definition.doorGaps).forEach((part, index) => {
      const length = part.from.distanceTo(part.to);
      const center = part.from.clone().lerp(part.to, 0.5);
      const mesh = addBox({
        group,
        size: new THREE.Vector3(length, height, thickness),
        position: new THREE.Vector3(center.x, (segment.y ?? 0) + height / 2, center.z),
        material,
        name: `V2-WALL-${segment.id}-${index}`,
        userData: { locationId: definition.id, roomId: segment.roomId, wallSegmentId: segment.id, generatedBy: 'DungeonGeometryBuilder:v2' },
      });
      mesh.rotation.y = Math.atan2(part.to.z - part.from.z, part.to.x - part.from.x);
      walls.push(mesh);
    });
  });
  return walls;
}

function addV2WallPropAnchors({ definition, group }) {
  const segments = new Map(asArray(definition.wallSegments).map((segment) => [segment.id, segment]));
  return asArray(definition.wallPropAnchors).map((anchor) => {
    const segment = segments.get(anchor.wallSegmentId);
    if (!segment) return null;
    const from = point3FromXZ(segment.from, segment.y ?? 0);
    const to = point3FromXZ(segment.to, segment.y ?? 0);
    const t = THREE.MathUtils.clamp(anchor.t ?? 0.5, 0, 1);
    const direction = to.clone().sub(from).normalize();
    const normal = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    const position = from.clone().lerp(to, t).add(normal.clone().multiplyScalar(anchor.offset ?? 0.12));
    position.y = (segment.y ?? 0) + (anchor.height ?? 1.8);
    let object;
    if (anchor.kind === 'torchFixture') {
      const torch = new TorchFixture({ id: anchor.id, position, yaw: Math.atan2(normal.x, normal.z), roomId: anchor.roomId ?? segment.roomId });
      object = torch.group;
    } else {
      object = new THREE.Mesh(
        new THREE.BoxGeometry(anchor.width ?? 0.45, anchor.heightSize ?? 0.45, anchor.depth ?? 0.08),
        makeFallbackMaterial({ color: anchor.color ?? 0x6b5540 }),
      );
      object.position.copy(position);
      object.rotation.y = Math.atan2(normal.x, normal.z);
    }
    object.name = `V2-ANCHOR-${anchor.id}`;
    object.userData = { ...object.userData, locationId: definition.id, roomId: anchor.roomId ?? segment.roomId, wallPropAnchorId: anchor.id, wallSegmentId: segment.id, generatedBy: 'DungeonGeometryBuilder:v2' };
    group.add(object);
    return object;
  }).filter(Boolean);
}


function addPolygonMesh({ group, points, y, material, name, userData = {} }) {
  if (points.length < 3) return null;
  const triangles = THREE.ShapeUtils.triangulateShape(points, []);
  const vertices = [];
  const uvs = [];
  points.forEach((point) => {
    vertices.push(point.x, y, point.y);
    uvs.push(point.x * 0.18, point.y * 0.18);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(triangles.flat());
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  mesh.userData = { ...mesh.userData, ...userData };
  group.add(mesh);
  return mesh;
}

function ribbonQuad(a, b, width) {
  const direction = b.clone().sub(a);
  if (direction.lengthSq() <= 0.0001) return [];
  direction.normalize();
  const normal = new THREE.Vector2(-direction.y, direction.x).multiplyScalar(width / 2);
  return [a.clone().add(normal), b.clone().add(normal), b.clone().sub(normal), a.clone().sub(normal)];
}

function addV2PathRibbons({ definition, group, materialFactory }) {
  const meshes = [];
  asArray(definition.pathRibbons).forEach((ribbon) => {
    const points = asArray(ribbon.points).map(point2);
    const material = makeMaterial(definition, ribbon.material ?? ribbon.textureProfile, materialFactory, definition.textures?.floor);
    for (let i = 0; i < points.length - 1; i += 1) {
      const quad = ribbonQuad(points[i], points[i + 1], ribbon.width ?? 1);
      const mesh = addPolygonMesh({ group, points: quad, y: ribbon.y ?? 0.02, material, name: `V2-PATH-${ribbon.id}-${i}`, userData: { locationId: definition.id, pathRibbonId: ribbon.id, generatedBy: 'DungeonGeometryBuilder:v2.1' } });
      if (mesh) meshes.push(mesh);
    }
  });
  return meshes;
}

function addV2Platforms({ definition, group, materialFactory }) {
  const meshes = [];
  asArray(definition.platforms).forEach((platform) => {
    const footprint = asArray(platform.footprint).map(point2);
    const y = platform.y ?? definition.defaultFloorY ?? 0;
    const height = platform.height ?? 0.5;
    const sideMaterial = makeMaterial(definition, platform.material ?? platform.textureProfile, materialFactory, definition.textures?.wall);
    const topMaterial = makeMaterial(definition, platform.topMaterial ?? platform.material ?? platform.textureProfile, materialFactory, definition.textures?.floor);
    const top = addPolygonMesh({ group, points: footprint, y: y + height, material: topMaterial, name: `V2-PLATFORM-TOP-${platform.id}`, userData: { locationId: definition.id, platformId: platform.id, generatedBy: 'DungeonGeometryBuilder:v2.1' } });
    if (top) meshes.push(top);
    footprint.forEach((from, index) => {
      const to = footprint[(index + 1) % footprint.length];
      const length = from.distanceTo(to);
      if (length <= 0.0001) return;
      const center = from.clone().lerp(to, 0.5);
      const side = addBox({ group, size: new THREE.Vector3(length, height, 0.12), position: new THREE.Vector3(center.x, y + height / 2, center.y), material: sideMaterial, name: `V2-PLATFORM-SIDE-${platform.id}-${index}`, userData: { locationId: definition.id, platformId: platform.id, generatedBy: 'DungeonGeometryBuilder:v2.1' } });
      side.rotation.y = Math.atan2(to.y - from.y, to.x - from.x);
      meshes.push(side);
    });
  });
  return meshes;
}

function segmentDeck(fromValue, toValue, width, y, material, group, name, userData = {}, thickness = 0.12) {
  const from = point3FromXZ(fromValue, y);
  const to = point3FromXZ(toValue, y);
  const length = from.distanceTo(to);
  if (length <= 0.0001) return null;
  const center = from.clone().lerp(to, 0.5);
  const mesh = addBox({ group, size: new THREE.Vector3(length, thickness, width), position: center, material, name, userData });
  mesh.rotation.y = Math.atan2(to.z - from.z, to.x - from.x);
  return mesh;
}

function addV2RampsStairsBridges({ definition, group, materialFactory }) {
  const meshes = [];
  asArray(definition.ramps).forEach((ramp) => {
    const material = makeMaterial(definition, ramp.material ?? ramp.textureProfile, materialFactory, definition.textures?.floor);
    const mesh = segmentDeck(ramp.from, ramp.to, ramp.width ?? 1, ((ramp.y0 ?? 0) + (ramp.y1 ?? 0)) / 2, material, group, `V2-RAMP-${ramp.id}`, { locationId: definition.id, rampId: ramp.id, generatedBy: 'DungeonGeometryBuilder:v2.1' }, 0.14);
    if (mesh) { mesh.rotation.z = Math.atan2((ramp.y1 ?? 0) - (ramp.y0 ?? 0), point3FromXZ(ramp.from).distanceTo(point3FromXZ(ramp.to))); meshes.push(mesh); }
  });
  asArray(definition.stairs).forEach((stairs) => {
    const material = makeMaterial(definition, stairs.material ?? stairs.textureProfile, materialFactory, definition.textures?.wall);
    const count = Math.max(1, stairs.steps ?? 1);
    const from = point3FromXZ(stairs.from, stairs.y0 ?? 0); const to = point3FromXZ(stairs.to, stairs.y1 ?? 0);
    for (let i = 0; i < count; i += 1) {
      const a = from.clone().lerp(to, i / count); const b = from.clone().lerp(to, (i + 1) / count);
      const mesh = segmentDeck([a.x, a.z], [b.x, b.z], stairs.width ?? 1, (a.y + b.y) / 2, material, group, `V2-STAIR-${stairs.id}-${i}`, { locationId: definition.id, stairsId: stairs.id, generatedBy: 'DungeonGeometryBuilder:v2.1' }, Math.max(0.08, (b.y - (stairs.y0 ?? 0))));
      if (mesh) meshes.push(mesh);
    }
  });
  asArray(definition.bridges).forEach((bridge) => {
    const material = makeMaterial(definition, bridge.material ?? bridge.textureProfile, materialFactory, definition.textures?.floor);
    const deck = segmentDeck(bridge.from, bridge.to, bridge.width ?? 1, bridge.y ?? 0.2, material, group, `V2-BRIDGE-${bridge.id}`, { locationId: definition.id, bridgeId: bridge.id, generatedBy: 'DungeonGeometryBuilder:v2.1' }, bridge.thickness ?? 0.2);
    if (deck) meshes.push(deck);
    if (bridge.railing && deck) [-1, 1].forEach((side) => {
      const rail = deck.clone(); rail.material = material; rail.name = `V2-BRIDGE-RAIL-${bridge.id}-${side}`; rail.scale.z = 0.08; rail.position.y += 0.45; rail.translateZ(side * (bridge.width ?? 1) / 2); group.add(rail); meshes.push(rail);
    });
  });
  return meshes;
}

function primitiveMaterial(definition, primitive, materialFactory, fallback = definition.textures?.wall) {
  return makeMaterial(definition, primitive.material ?? primitive.textureProfile, materialFactory, fallback);
}

function yawOf(from, to) {
  return Math.atan2(to.z - from.z, to.x - from.x);
}

function addCylinderPrimitive({ group, primitive, material, name, height, radius, sides = 8 }) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, Math.max(6, sides));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(toVector3(primitive.position));
  mesh.position.y += height / 2;
  mesh.rotation.y = primitive.yaw ?? 0;
  if (primitive.tilt) mesh.rotation.z = primitive.tilt;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { locationId: primitive.locationId, roomId: primitive.roomId, architecturalPrimitiveId: primitive.id, primitiveKind: primitive.kind, generatedBy: 'DungeonGeometryBuilder:v2.3' };
  group.add(mesh);
  return mesh;
}

function addLineBoxPrimitive({ definition, group, materialFactory, primitive, height, thickness, y = 0, name }) {
  const material = primitiveMaterial(definition, primitive, materialFactory);
  const mesh = segmentDeck(primitive.from, primitive.to, thickness, y + height / 2, material, group, name, { locationId: definition.id, roomId: primitive.roomId, architecturalPrimitiveId: primitive.id, primitiveKind: primitive.kind, generatedBy: 'DungeonGeometryBuilder:v2.3' }, height);
  return mesh;
}

function addV23ArchitecturalPrimitives({ definition, group, materialFactory }) {
  const meshes = [];
  const walls = new Map(asArray(definition.wallSegments).map((segment) => [segment.id, segment]));
  const addPart = (mesh) => { if (mesh) meshes.push(mesh); };
  asArray(definition.architecturalPrimitives).forEach((primitive) => {
    primitive.locationId = definition.id;
    const material = primitiveMaterial(definition, primitive, materialFactory, primitive.kind === 'canalWater' ? definition.textures?.water : definition.textures?.wall);
    const base = { locationId: definition.id, roomId: primitive.roomId, architecturalPrimitiveId: primitive.id, primitiveKind: primitive.kind, generatedBy: 'DungeonGeometryBuilder:v2.3' };
    if (primitive.kind === 'pillar' || primitive.kind === 'brokenPillar') {
      addPart(addCylinderPrimitive({ group, primitive, material, name: `V23-${primitive.kind}-${primitive.id}`, height: primitive.height ?? 2, radius: primitive.radius ?? 0.3, sides: primitive.sides ?? 8 }));
    } else if (primitive.kind === 'arch' || primitive.kind === 'doorFrame') {
      const pos = toVector3(primitive.position); const yaw = primitive.yaw ?? 0; const width = primitive.width ?? 2; const height = primitive.height ?? 3; const thickness = primitive.thickness ?? 0.35; const depth = primitive.depth ?? thickness;
      [-1, 1].forEach((side) => { const offset = new THREE.Vector3(side * (width / 2 - thickness / 2), height / 2, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw); const post = addBox({ group, size: new THREE.Vector3(thickness, height, depth), position: pos.clone().add(offset), material, name: `V23-${primitive.kind}-POST-${primitive.id}-${side}`, userData: base }); post.rotation.y = yaw; addPart(post); });
      const lintel = addBox({ group, size: new THREE.Vector3(width, thickness, depth), position: pos.clone().add(new THREE.Vector3(0, height - thickness / 2, 0)), material, name: `V23-${primitive.kind}-LINTEL-${primitive.id}`, userData: base }); lintel.rotation.y = yaw; addPart(lintel);
      if (primitive.kind === 'arch') { const cap = addBox({ group, size: new THREE.Vector3(width * 0.72, thickness * 0.7, depth * 1.04), position: pos.clone().add(new THREE.Vector3(0, height + thickness * 0.18, 0)), material, name: `V23-arch-CAP-${primitive.id}`, userData: base }); cap.rotation.y = yaw; addPart(cap); }
    } else if (['lowWall', 'curb'].includes(primitive.kind)) {
      addPart(addLineBoxPrimitive({ definition, group, materialFactory, primitive, height: primitive.height ?? (primitive.kind === 'curb' ? 0.22 : 0.75), thickness: primitive.thickness ?? 0.25, y: primitive.y ?? 0, name: `V23-${primitive.kind}-${primitive.id}` }));
    } else if (primitive.kind === 'railing') {
      const from = point3FromXZ(primitive.from, primitive.y ?? 0); const to = point3FromXZ(primitive.to, primitive.y ?? 0); const length = from.distanceTo(to); const yaw = yawOf(from, to); const height = primitive.height ?? 0.8;
      addPart(segmentDeck(primitive.from, primitive.to, 0.08, (primitive.y ?? 0) + height, material, group, `V23-railing-BEAM-${primitive.id}`, base, 0.08));
      const count = Math.max(2, Math.floor(length / (primitive.postSpacing ?? 1.4)) + 1);
      for (let i = 0; i < count; i += 1) { const t = count === 1 ? 0 : i / (count - 1); const p = from.clone().lerp(to, t); const post = addBox({ group, size: new THREE.Vector3(0.12, height, 0.12), position: new THREE.Vector3(p.x, (primitive.y ?? 0) + height / 2, p.z), material, name: `V23-railing-POST-${primitive.id}-${i}`, userData: base }); post.rotation.y = yaw; addPart(post); }
    } else if (primitive.kind === 'altar') {
      const pos = toVector3(primitive.position); const yaw = primitive.yaw ?? 0; const width = primitive.width ?? 1.6; const depth = primitive.depth ?? 1; const height = primitive.height ?? 0.8;
      const bottom = addBox({ group, size: new THREE.Vector3(width, height * 0.65, depth), position: new THREE.Vector3(pos.x, pos.y + height * 0.325, pos.z), material, name: `V23-altar-BASE-${primitive.id}`, userData: base }); bottom.rotation.y = yaw; addPart(bottom);
      const topMat = makeMaterial(definition, primitive.topMaterial ?? primitive.material, materialFactory, definition.textures?.floor); const top = addBox({ group, size: new THREE.Vector3(width * 1.12, height * 0.35, depth * 1.12), position: new THREE.Vector3(pos.x, pos.y + height * 0.825, pos.z), material: topMat, name: `V23-altar-TOP-${primitive.id}`, userData: base }); top.rotation.y = yaw; addPart(top);
    } else if (primitive.kind === 'stela') {
      const pos = toVector3(primitive.position); const slab = addBox({ group, size: new THREE.Vector3(primitive.width ?? 0.8, primitive.height ?? 2, primitive.thickness ?? 0.2), position: new THREE.Vector3(pos.x, pos.y + (primitive.height ?? 2) / 2, pos.z), material, name: `V23-stela-${primitive.id}`, userData: base }); slab.rotation.y = primitive.yaw ?? 0; addPart(slab);
    } else if (primitive.kind === 'ceilingSlab') {
      const pos = toVector3(primitive.position); const yaw = primitive.yaw ?? 0; const width = primitive.width ?? 4; const depth = primitive.depth ?? 4; const thickness = primitive.thickness ?? 0.2;
      const slab = addBox({ group, size: new THREE.Vector3(width, thickness, depth), position: pos, material, name: `V23-ceilingSlab-${primitive.id}`, userData: { ...base, animated: primitive.animated } }); slab.rotation.y = yaw; addPart(slab);
    } else if (primitive.kind === 'obelisk') {
      const pos = toVector3(primitive.position); const height = primitive.height ?? 3; const width = primitive.baseWidth ?? 0.7; const baseBox = addBox({ group, size: new THREE.Vector3(width, height * 0.78, width), position: new THREE.Vector3(pos.x, pos.y + height * 0.39, pos.z), material, name: `V23-obelisk-SHAFT-${primitive.id}`, userData: base }); baseBox.rotation.y = primitive.yaw ?? 0; addPart(baseBox); const tip = addBox({ group, size: new THREE.Vector3(width * 0.65, height * 0.22, width * 0.65), position: new THREE.Vector3(pos.x, pos.y + height * 0.89, pos.z), material, name: `V23-obelisk-TIP-${primitive.id}`, userData: base }); tip.rotation.y = (primitive.yaw ?? 0) + Math.PI / 4; addPart(tip);
    } else if (primitive.kind === 'wallPanel') {
      const wall = walls.get(primitive.wallSegmentId); if (!wall) return; const from = point3FromXZ(wall.from, wall.y ?? 0); const to = point3FromXZ(wall.to, wall.y ?? 0); const dir = to.clone().sub(from).normalize(); const normal = new THREE.Vector3(-dir.z, 0, dir.x); const pos = from.clone().lerp(to, primitive.t ?? 0.5).add(normal.multiplyScalar(primitive.offset ?? 0.08)); pos.y = (wall.y ?? 0) + (primitive.height ?? 1.8) / 2 + (primitive.y ?? 0.8); const panel = addBox({ group, size: new THREE.Vector3(primitive.width ?? 1, primitive.height ?? 1.5, primitive.thickness ?? 0.08), position: pos, material, name: `V23-wallPanel-${primitive.id}`, userData: { ...base, wallSegmentId: primitive.wallSegmentId } }); panel.rotation.y = Math.atan2(dir.z, dir.x); addPart(panel);
    } else if (primitive.kind === 'canalWater') {
      const waterMaterial = material.clone ? material.clone() : material; const water = segmentDeck(primitive.from, primitive.to, primitive.width ?? 1, primitive.y ?? 0.03, waterMaterial, group, `V23-canalWater-${primitive.id}`, { ...base, animated: 'canalWater', scrollSpeed: primitive.scrollSpeed }, 0.035); if (water) { if (primitive.emissiveColor && water.material?.emissive) water.material.emissive.setHex(primitive.emissiveColor); addPart(water); }
    }
  });
  return meshes;
}

function addProps({ definition, group, materialFactory }) {
  return asArray(definition.props).map((prop) => {
    if (prop.visibleGeometry === false || !prop.dimensions || !prop.position) return null;
    const material = makeMaterial(definition, prop.material ?? prop.textureProfile, materialFactory, definition.textures?.wall);
    const position = toVector3(prop.position);
    const size = new THREE.Vector3(prop.dimensions.width, prop.dimensions.height, prop.dimensions.depth);
    const mesh = addBox({
      group,
      size,
      position,
      material,
      name: prop.id,
      userData: {
        locationId: definition.id,
        roomId: prop.roomId,
        propId: prop.id,
        blockerId: prop.collisionRef,
        generatedBy: 'DungeonGeometryBuilder',
      },
    });
    const rotation = toVector3(prop.rotation);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    if (prop.scale) {
      const scale = toVector3(prop.scale, 1);
      mesh.scale.set(scale.x || 1, scale.y || 1, scale.z || 1);
    }
    return mesh;
  }).filter(Boolean);
}

function addLights({ definition, group, lights, torchFactory }) {
  return asArray(lights ?? definition.lights).map((light) => {
    let object = null;
    const position = toVector3(light.position, 1.6);

    if (light.kind === 'ambient') {
      object = new THREE.HemisphereLight(light.skyColor ?? light.color ?? 0xffffff, light.groundColor ?? 0x222222, light.intensity ?? 1);
    } else if (light.kind === 'directional') {
      object = new THREE.DirectionalLight(light.color ?? 0xffffff, light.intensity ?? 1);
      object.position.copy(position);
    } else if (light.kind === 'point') {
      object = new THREE.PointLight(light.color ?? 0xffffff, light.intensity ?? 1, light.distance ?? 10, light.decay ?? 1.5);
      object.position.copy(position);
    } else if (light.kind === 'torch' && torchFactory) {
      object = torchFactory(light);
    } else if (light.kind === 'torch') {
      object = new THREE.PointLight(light.color ?? 0xffa85a, light.intensity ?? 2.2, light.distance ?? 8, light.decay ?? 1.3);
      object.position.copy(position);
    }

    if (!object) return null;
    object.name = light.id;
    object.userData = {
      ...object.userData,
      locationId: definition.id,
      roomId: light.roomId,
      lightId: light.id,
      generatedBy: 'DungeonGeometryBuilder',
    };
    group.add(object);
    return object;
  }).filter(Boolean);
}

function addTorchFixtures({ group, torchFixtures }) {
  return asArray(torchFixtures).map((fixture) => {
    const torch = new TorchFixture(fixture);
    torch.group.userData = {
      ...torch.group.userData,
      lightId: fixture.id,
      generatedBy: 'TorchFixture',
    };
    group.add(torch.group);
    return torch.group;
  });
}

function collectPointLights(objects) {
  const pointLights = [];
  objects.forEach((object) => {
    object?.traverse?.((child) => {
      if (child.isPointLight && child.visible !== false) pointLights.push(child);
    });
  });
  return pointLights;
}

export function buildDungeonGeometry(definition, { materialFactory = null, torchFactory = null, lightRegistry = null } = {}) {
  const group = new THREE.Group();
  group.name = `${definition.id}-compiled-runtime`;
  group.userData = {
    locationId: definition.id,
    displayName: definition.displayName,
    generatedBy: 'DungeonCompiler',
  };

  asArray(definition.rooms).forEach((room) => addRoomGeometry({ definition, group, room, materialFactory }));
  const v2Floors = addV2PolygonFloors({ definition, group, materialFactory });
  const v2Walls = addV2WallSegments({ definition, group, materialFactory });
  const v2Paths = addV2PathRibbons({ definition, group, materialFactory });
  const v2Platforms = addV2Platforms({ definition, group, materialFactory });
  const v2VerticalLinks = addV2RampsStairsBridges({ definition, group, materialFactory });
  const v2Anchors = addV2WallPropAnchors({ definition, group });
  const v23Primitives = addV23ArchitecturalPrimitives({ definition, group, materialFactory });
  const props = addProps({ definition, group, materialFactory });
  const lights = addLights({ definition, group, lights: lightRegistry?.nonTorchLights, torchFactory });
  const torchObjects = addTorchFixtures({ group, torchFixtures: lightRegistry?.torchFixtures });
  const pointLights = collectPointLights([...lights, ...torchObjects]);

  return { group, props, lights, torchObjects, pointLights, v2Floors, v2Walls, v2Paths, v2Platforms, v2VerticalLinks, v2Anchors, v23Primitives };
}
