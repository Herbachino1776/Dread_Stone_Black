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
  const material = new THREE.MeshStandardMaterial({
    color: profile.color ?? 0xffffff,
    roughness: profile.roughness ?? 0.9,
    metalness: profile.metalness ?? 0,
    emissive: profile.emissive ?? 0x000000,
    emissiveIntensity: profile.emissiveIntensity ?? 0,
  });
  material.userData.definitionProfile = { ...(material.userData.definitionProfile ?? {}), ...profile };
  return material;
}

function makeMaterial(definition, reference, materialFactory, fallbackProfile) {
  const profile = resolveTextureProfile(definition, reference, fallbackProfile) ?? fallbackProfile ?? {};
  const material = materialFactory ? materialFactory(profile) : makeFallbackMaterial(profile);
  material.userData.definitionProfile = { ...(material.userData.definitionProfile ?? {}), ...profile };
  return material;
}

function applyBoxWorldUvs(geometry, size, profile = {}) {
  const scale = Array.isArray(profile.boxUvScale) && profile.boxUvScale.length >= 2
    ? profile.boxUvScale
    : [0.2, 0.2];

  const uv = geometry.getAttribute('uv');
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uScale = Number(scale[0]) || 1;
  const vScale = Number(scale[1]) || uScale;

  for (let i = 0; i < uv.count; i += 1) {
    const nx = normal.getX(i);
    const ny = normal.getY(i);
    const nz = normal.getZ(i);
    const x = position.getX(i) + size.x / 2;
    const y = position.getY(i) + size.y / 2;
    const z = position.getZ(i) + size.z / 2;

    if (Math.abs(ny) > 0.5) {
      uv.setXY(i, x * uScale, z * vScale);
    } else if (Math.abs(nx) > 0.5) {
      uv.setXY(i, z * uScale, y * vScale);
    } else if (Math.abs(nz) > 0.5) {
      uv.setXY(i, x * uScale, y * vScale);
    }
  }

  uv.needsUpdate = true;
  return geometry;
}

function makeBoxGeometry(size, material) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  return applyBoxWorldUvs(geometry, size, material?.userData?.definitionProfile ?? {});
}

function addBox({ group, size, position, material, name, userData = {} }) {
  const mesh = new THREE.Mesh(makeBoxGeometry(size, material), material);
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

function horizontalPolygonArea(points) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    area += points[j].x * points[i].y - points[i].x * points[j].y;
  }
  return area / 2;
}

function ensureHorizontalPolygonFacesUp(points, triangles) {
  const shouldReverse = horizontalPolygonArea(points) < 0;
  return triangles.map((triangle) => (shouldReverse ? [triangle[0], triangle[2], triangle[1]] : triangle));
}

function averageNormalY(geometry) {
  const normals = geometry.getAttribute('normal');
  if (!normals?.count) return 0;
  let y = 0;
  for (let i = 0; i < normals.count; i += 1) y += normals.getY(i);
  return y / normals.count;
}

function guardHorizontalMaterial(material) {
  if (!material || material.side === THREE.DoubleSide) return material;
  material.side = THREE.DoubleSide;
  material.needsUpdate = true;
  return material;
}

function addV2PolygonFloors({ definition, group, materialFactory }) {
  return asArray(definition.polygonFloors).map((floor) => {
    const points = asArray(floor.points).map(point2);
    if (points.length < 3) return null;
    const triangles = ensureHorizontalPolygonFacesUp(points, THREE.ShapeUtils.triangulateShape(points, []));
    const y = floor.y ?? definition.defaultFloorY ?? 0;
    const vertices = [];
    const uvs = [];
    const material = guardHorizontalMaterial(makeMaterial(definition, floor.material ?? floor.textureProfile, materialFactory, definition.textures?.floor));
    const uvScale = material?.userData?.definitionProfile?.polygonUvScale ?? [0.18, 0.18];
    const uScale = Number(uvScale?.[0]) || 0.18;
    const vScale = Number(uvScale?.[1]) || uScale;
    points.forEach((point) => {
      vertices.push(point.x, y, point.y);
      uvs.push(point.x * uScale, point.y * vScale);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(triangles.flat());
    geometry.computeVertexNormals();
    if (averageNormalY(geometry) < 0) {
      geometry.setIndex(triangles.map((triangle) => [triangle[0], triangle[2], triangle[1]]).flat());
      geometry.computeVertexNormals();
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `V2-FLOOR-${floor.id}`;
    mesh.receiveShadow = true;
    mesh.userData = { locationId: definition.id, roomId: floor.roomId, polygonFloorId: floor.id, generatedBy: 'DungeonGeometryBuilder:v2' };
    group.add(mesh);
    return mesh;
  }).filter(Boolean);
}

function horizontalSurfaceFacesDown(surface) {
  return surface.kind === 'ceiling' || surface.kind === 'roof';
}

function horizontalSurfaceY(surface) {
  return Number(surface.y ?? surface.center?.[1] ?? surface.center?.y ?? 0);
}

function horizontalSurfaceCenter(surface) {
  const center = toVector3(surface.center, horizontalSurfaceY(surface));
  center.y = horizontalSurfaceY(surface);
  return center;
}

function setSurfaceMaterialSide(material) {
  if (!material) return material;
  material.side = THREE.DoubleSide;
  material.needsUpdate = true;
  return material;
}

function horizontalSurfaceUserData(definition, surface, material, normalY, worldSize) {
  return {
    locationId: definition.id,
    roomId: surface.roomId,
    horizontalSurfaceId: surface.id,
    horizontalSurfaceKind: surface.kind,
    horizontalSurfaceShape: surface.shape,
    horizontalSurfaceMaterial: surface.material ?? surface.textureProfile,
    horizontalSurfaceMaterialPath: material?.userData?.definitionProfile?.path,
    horizontalSurfaceNormalY: normalY,
    horizontalSurfaceWorldSize: worldSize,
    tags: surface.tags ?? [],
    generatedBy: 'DungeonGeometryBuilder:horizontalSurfaces',
  };
}

function addRectHorizontalSurface({ definition, group, surface, material }) {
  const width = Number(surface.width ?? 0);
  const depth = Number(surface.depth ?? 0);
  if (width <= 0 || depth <= 0) return null;
  const thickness = Math.max(0.01, Number(surface.thickness ?? definition.geometry?.floorThickness ?? 0.08));
  const facesDown = horizontalSurfaceFacesDown(surface);
  const normalY = facesDown ? -1 : 1;
  const center = horizontalSurfaceCenter(surface);
  const positionY = center.y + (facesDown ? thickness / 2 : -thickness / 2);
  const mesh = addBox({
    group,
    size: new THREE.Vector3(width, thickness, depth),
    position: new THREE.Vector3(center.x, positionY, center.z),
    material,
    name: `HSURFACE-${surface.kind}-${surface.id}`,
    userData: horizontalSurfaceUserData(definition, surface, material, normalY, { width, depth }),
  });
  mesh.rotation.y = Number(surface.yaw ?? 0);
  return mesh;
}

function addPolygonHorizontalSurface({ definition, group, surface, material }) {
  const points = asArray(surface.points).map(point2);
  if (points.length < 3) return null;
  const y = horizontalSurfaceY(surface);
  const facesDown = horizontalSurfaceFacesDown(surface);
  const baseTriangles = ensureHorizontalPolygonFacesUp(points, THREE.ShapeUtils.triangulateShape(points, []));
  const triangles = facesDown
    ? baseTriangles.map((triangle) => [triangle[0], triangle[2], triangle[1]])
    : baseTriangles;
  const vertices = [];
  const uvs = [];
  const uvScale = material?.userData?.definitionProfile?.polygonUvScale
    ?? material?.userData?.definitionProfile?.boxUvScale
    ?? [0.18, 0.18];
  const uScale = Number(uvScale?.[0]) || 0.18;
  const vScale = Number(uvScale?.[1]) || uScale;
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
  points.forEach((point) => {
    vertices.push(point.x, y, point.y);
    uvs.push(point.x * uScale, point.y * vScale);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.y);
    maxZ = Math.max(maxZ, point.y);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(triangles.flat());
  geometry.computeVertexNormals();
  const expectedNormalY = facesDown ? -1 : 1;
  if (Math.sign(averageNormalY(geometry) || expectedNormalY) !== expectedNormalY) {
    geometry.setIndex(triangles.map((triangle) => [triangle[0], triangle[2], triangle[1]]).flat());
    geometry.computeVertexNormals();
  }
  setSurfaceMaterialSide(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `HSURFACE-${surface.kind}-${surface.id}`;
  mesh.receiveShadow = true;
  mesh.userData = {
    ...mesh.userData,
    ...horizontalSurfaceUserData(definition, surface, material, expectedNormalY, { width: maxX - minX, depth: maxZ - minZ }),
  };
  group.add(mesh);
  return mesh;
}

function addHorizontalSurfaces({ definition, group, materialFactory }) {
  return asArray(definition.horizontalSurfaces).map((surface) => {
    const material = makeMaterial(definition, surface.material ?? surface.textureProfile, materialFactory, definition.textures?.floor);
    if (surface.shape === 'polygon') {
      return addPolygonHorizontalSurface({ definition, group, surface, material });
    }
    return addRectHorizontalSurface({ definition, group, surface, material });
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
  const triangles = ensureHorizontalPolygonFacesUp(points, THREE.ShapeUtils.triangulateShape(points, []));
  const vertices = [];
  const uvs = [];
  const uvScale = material?.userData?.definitionProfile?.polygonUvScale ?? [0.18, 0.18];
  const uScale = Number(uvScale?.[0]) || 0.18;
  const vScale = Number(uvScale?.[1]) || uScale;
  points.forEach((point) => {
    vertices.push(point.x, y, point.y);
    uvs.push(point.x * uScale, point.y * vScale);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(triangles.flat());
  geometry.computeVertexNormals();
  if (averageNormalY(geometry) < 0) {
    geometry.setIndex(triangles.map((triangle) => [triangle[0], triangle[2], triangle[1]]).flat());
    geometry.computeVertexNormals();
  }
  guardHorizontalMaterial(material);
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
    if (platform.topVisible !== false) {
      const top = addPolygonMesh({ group, points: footprint, y: y + height, material: topMaterial, name: `V2-PLATFORM-TOP-${platform.id}`, userData: { locationId: definition.id, platformId: platform.id, generatedBy: 'DungeonGeometryBuilder:v2.1' } });
      if (top) meshes.push(top);
    }
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

function addCylinderBetween({ group, from, to, radius = 0.05, material, name, userData = {}, segments = 8 }) {
  const start = toVector3(from);
  const end = toVector3(to);
  const midpoint = start.clone().lerp(end, 0.5);
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= 0.0001) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
  mesh.name = name;
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { ...mesh.userData, ...userData };
  group.add(mesh);
  return mesh;
}

function localPoint(origin, yaw, x, y, z) {
  const c = Math.cos(yaw); const sn = Math.sin(yaw);
  return new THREE.Vector3(origin.x + x * c - z * sn, origin.y + y, origin.z + x * sn + z * c);
}

function basicMat(color, roughness = 0.9, metalness = 0, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
}

const ROD_SPECS = {
  reedPoleRod: { len: 4.5, r: 0.035, curve: 0.2, wood: 0x8a7442, grip: 0x3d2617, metal: 0x7a5b2b, noReel: true, wraps: 5, hook: 'bone' },
  hookedBranchRod: { len: 3.7, r: 0.07, curve: 0.62, wood: 0x4a2d1b, grip: 0x20140f, metal: 0x5f4a34, branch: true, wraps: 3, hook: 'thorn' },
  bronzeSpinedRod: { len: 4.25, r: 0.05, curve: 0.12, wood: 0x2c2118, grip: 0x16100c, metal: 0xb07a35, reel: true, spines: 7, turquoise: true, wraps: 4 },
  ritualBoneRod: { len: 3.95, r: 0.052, curve: -0.16, wood: 0xd3c7a1, grip: 0x271716, metal: 0x6b5c4d, bone: true, glyph: true, wraps: 6, hook: 'bone' },
  travelerWoodRod: { len: 4.0, r: 0.046, curve: 0.04, wood: 0x6d4525, grip: 0x4a2b19, metal: 0x5b4633, pack: true, wraps: 8 },
  heavyRiverRod: { len: 3.55, r: 0.095, curve: 0.08, wood: 0x33251b, grip: 0x211611, metal: 0x6b5035, reel: true, stout: true, wraps: 5 },
};

const FISH_SPECS = {
  smallRiverFish: { bodyLength: 1.25, bodyHeight: 0.3, bodyWidth: 0.22, bodyMaterial: 'fishScaleSilver', finMaterial: 'fishFinAmber', tailScale: 0.92, dorsalScale: 0.82, pectoralScale: 0.86, headTaper: 1 },
  broadCarpFish: { bodyLength: 1.55, bodyHeight: 0.58, bodyWidth: 0.36, bodyMaterial: 'fishScaleKoiCreamOrange', finMaterial: 'fishFinAmber', tailScale: 1.18, dorsalScale: 1.06, pectoralScale: 1.0, headTaper: 1 },
  longEelFish: { bodyLength: 2.25, bodyHeight: 0.2, bodyWidth: 0.16, bodyMaterial: 'fishScaleEelSkinDark', finMaterial: 'fishFinDark', tailScale: 0.68, dorsalScale: 0.48, pectoralScale: 0.48, headTaper: 1 },
  spineBackFish: { bodyLength: 1.6, bodyHeight: 0.38, bodyWidth: 0.26, bodyMaterial: 'fishScaleZebraOlive', finMaterial: 'fishFinDark', tailScale: 1.0, dorsalScale: 1.38, pectoralScale: 0.84, headTaper: 1 },
  flatMarshFish: { bodyLength: 1.45, bodyHeight: 0.2, bodyWidth: 0.62, bodyMaterial: 'fishScaleMottledDark', finMaterial: 'fishFinSpottedTeal', tailScale: 0.86, dorsalScale: 0.52, pectoralScale: 1.22, headTaper: 1 },
  jawHunterFish: { bodyLength: 1.85, bodyHeight: 0.4, bodyWidth: 0.3, bodyMaterial: 'fishScaleMottledDark', finMaterial: 'fishFinDark', tailScale: 1.08, dorsalScale: 0.92, pectoralScale: 0.82, headTaper: 0.9 },
  sacredGlowFish: { bodyLength: 1.55, bodyHeight: 0.34, bodyWidth: 0.25, bodyMaterial: 'fishScaleIridescentTeal', finMaterial: 'fishFinSpottedTeal', tailScale: 1.0, dorsalScale: 0.88, pectoralScale: 0.82, headTaper: 1, glow: true },
};

function fishMaterial(definition, primitive, slot, spec, materialFactory, fallbackColor, options = {}) {
  const reference = primitive[slot] ?? spec[slot];
  const fallback = { color: fallbackColor, roughness: options.roughness ?? 0.84, metalness: options.metalness ?? 0.02, emissive: options.emissive ?? 0x000000, emissiveIntensity: options.emissiveIntensity ?? 0 };
  return makeMaterial(definition, reference, materialFactory, fallback);
}

function makeClosedWedgeGeometry({ length = 0.28, height = 0.16, width = 0.08, pointDirection = -1 } = {}) {
  const xBase = pointDirection > 0 ? -length / 2 : length / 2;
  const xTip = pointDirection > 0 ? length / 2 : -length / 2;
  const vertices = [
    xTip, 0, 0,
    xBase, height / 2, -width / 2,
    xBase, -height / 2, -width / 2,
    xBase, height / 2, width / 2,
    xBase, -height / 2, width / 2,
    xBase, 0, 0,
  ];
  const indices = [0, 1, 2, 0, 4, 3, 0, 3, 1, 0, 2, 4, 1, 3, 5, 2, 5, 4, 1, 5, 2, 3, 4, 5];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.closedVolumetricFishWedge = true;
  return geometry;
}

function makeTailDiamondGeometry({ length = 0.34, height = 0.34, width = 0.1 } = {}) {
  const frontX = length * 0.34;
  const rearX = -length * 0.66;
  const vertices = [
    frontX, 0, -width / 2, rearX, height / 2, -width / 2, rearX, -height / 2, -width / 2,
    frontX, 0, width / 2, rearX, height / 2, width / 2, rearX, -height / 2, width / 2,
  ];
  const indices = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 2, 5, 3, 2, 3, 0, 1, 4, 5, 1, 5, 2];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.closedVolumetricFishTail = true;
  return geometry;
}

function addFishMesh(root, geometry, material, name, position, userData = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = userData;
  root.add(mesh);
  return mesh;
}

function buildSimpleFish({ id, bodyLength, bodyHeight, bodyWidth, bodyMaterial, finMaterial, eyeMaterial, tailScale = 1, dorsalScale = 1, pectoralScale = 1, headTaper = 1, baseUserData = {} }) {
  const root = new THREE.Group();
  root.name = `V25-fishDisplay-ROOT-${id}`;
  root.userData = { ...baseUserData, fishConstruction: 'single-reusable-symmetrical-volumetric-template', coordinateStandard: 'X=head-tail-positive-head,Y=vertical,Z=left-right', allowedDisplayRotation: 'Y-axis-only' };

  const body = addFishMesh(root, new THREE.SphereGeometry(0.5, 18, 12), bodyMaterial, `V25-fishDisplay-CLOSED-ELLIPSOID-BODY-${id}`, new THREE.Vector3(0, 0, 0), { ...baseUserData, fishPart: 'singleClosedEllipsoidBody', materialSlot: 'bodyMaterial', textureRole: 'scaleTexture', headTaper });
  body.scale.set(bodyLength * 0.5 * headTaper, bodyHeight * 0.5, bodyWidth * 0.5);
  const silhouetteBodyLength = bodyLength * 0.5 * headTaper;

  const tailLength = bodyLength * 0.24 * tailScale;
  const tailHeight = bodyHeight * 0.95 * tailScale;
  const tailWidth = bodyWidth * 0.38;
  const tailEmbed = silhouetteBodyLength * 0.15;
  const tailFrontX = tailLength * 0.34;
  const tail = addFishMesh(root, makeTailDiamondGeometry({ length: tailLength, height: tailHeight, width: tailWidth }), finMaterial, `V25-fishDisplay-CLOSED-ATTACHED-TAIL-${id}`, new THREE.Vector3(-silhouetteBodyLength * 0.5 + tailEmbed - tailFrontX, 0, 0), { ...baseUserData, fishPart: 'closedAttachedTail', materialSlot: 'finMaterial', textureRole: 'finTexture', attachesToBody: true, bodyEmbed: tailEmbed });

  const dorsalHeight = bodyHeight * Math.min(0.34 * dorsalScale, 0.42);
  const dorsal = addFishMesh(root, makeClosedWedgeGeometry({ length: silhouetteBodyLength * 0.24, height: dorsalHeight, width: bodyWidth * 0.24, pointDirection: 1 }), finMaterial, `V25-fishDisplay-CLOSED-ATTACHED-DORSAL-FIN-${id}`, new THREE.Vector3(-silhouetteBodyLength * 0.04, bodyHeight * 0.3, 0), { ...baseUserData, fishPart: 'closedAttachedDorsalFin', materialSlot: 'finMaterial', textureRole: 'finTexture', attachesToBody: true, bodyEmbed: bodyHeight * 0.16 });

  [-1, 1].forEach((side) => {
    const pectoral = addFishMesh(root, makeClosedWedgeGeometry({ length: silhouetteBodyLength * 0.16 * pectoralScale, height: bodyHeight * 0.3 * pectoralScale, width: bodyWidth * 0.16, pointDirection: 1 }), finMaterial, `V25-fishDisplay-CLOSED-MIRRORED-PECTORAL-FIN-${id}-${side}`, new THREE.Vector3(silhouetteBodyLength * 0.12, -bodyHeight * 0.03, side * bodyWidth * 0.34), { ...baseUserData, fishPart: 'closedMirroredPectoralFin', mirrorSide: side, materialSlot: 'finMaterial', textureRole: 'finTexture', attachesToBody: true, bodyEmbed: bodyWidth * 0.16 });
    pectoral.rotation.y = side * 0.18;
  });

  const eyeRadius = Math.min(bodyHeight, bodyWidth) * 0.09;
  [-1, 1].forEach((side) => {
    addFishMesh(root, new THREE.SphereGeometry(eyeRadius, 8, 6), eyeMaterial, `V25-fishDisplay-TINY-MIRRORED-BLACK-EYE-${id}-${side}`, new THREE.Vector3(silhouetteBodyLength * 0.32, bodyHeight * 0.12, side * bodyWidth * 0.24), { ...baseUserData, fishPart: 'tinyMirroredBlackEye', mirrorSide: side, materialSlot: 'eyeMaterial', bodyEmbed: eyeRadius * 0.25 });
  });

  root.userData.fishSanity = { bodyLength: silhouetteBodyLength, authoredBodyLength: bodyLength, bodyHeight, bodyWidth, childCount: root.children.length, tailEmbed, tailOverlapsBody: tail.position.x + tailFrontX > -silhouetteBodyLength * 0.5, dorsalOverlapsBody: dorsal.position.y - dorsalHeight * 0.5 < bodyHeight * 0.5 };
  return root;
}

function addFishingRodDisplay({ definition, group, primitive }) {
  const spec = ROD_SPECS[primitive.variant] ?? ROD_SPECS.reedPoleRod;
  const origin = toVector3(primitive.position); origin.y += 0.72;
  const yaw = primitive.yaw ?? 0;
  const meshes = [];
  const wood = basicMat(spec.wood);
  const grip = basicMat(spec.grip);
  const metal = basicMat(spec.metal, 0.72, spec.reel ? 0.45 : 0.15);
  const bone = basicMat(0xd6caa3);
  const cord = basicMat(0x1a130f);
  const base = { locationId: definition.id, roomId: primitive.roomId, itemId: primitive.itemId, displayPadId: primitive.userData?.displayPadId, objectCategory: 'fishingRod', generatedBy: 'DungeonGeometryBuilder:fishingExpoObject', ...primitive.userData };
  const p0 = localPoint(origin, yaw, -spec.len / 2, 0.16, 0);
  const p1 = localPoint(origin, yaw, -spec.len * 0.15, 0.22 + spec.curve * 0.12, spec.curve * 0.16);
  const p2 = localPoint(origin, yaw, spec.len * 0.25, 0.28 + spec.curve * 0.18, spec.curve * 0.25);
  const p3 = localPoint(origin, yaw, spec.len / 2, 0.34 + spec.curve * 0.28, spec.curve * 0.34);
  [[p0,p1],[p1,p2],[p2,p3]].forEach(([a,b], i) => meshes.push(addCylinderBetween({ group, from:a, to:b, radius: spec.r * (1 - i * 0.15), material: spec.bone ? bone : wood, name:`V23-fishingRod-SHAFT-${primitive.id}-${i}`, userData: base, segments: spec.branch ? 7 : 10 })));
  meshes.push(addCylinderBetween({ group, from: localPoint(origin,yaw,-spec.len/2-0.15,0.16,0), to: localPoint(origin,yaw,-spec.len/2+0.72,0.17,0), radius: spec.r*1.35, material: grip, name:`V23-fishingRod-GRIP-${primitive.id}`, userData: base, segments: 8 }));
  for (let i=0;i<spec.wraps;i+=1) meshes.push(addCylinderBetween({ group, from: localPoint(origin,yaw,-spec.len/2+0.08+i*0.13,0.22,-0.16), to: localPoint(origin,yaw,-spec.len/2+0.08+i*0.13,0.22,0.16), radius: 0.018, material: cord, name:`V23-fishingRod-WRAP-${primitive.id}-${i}`, userData: base, segments: 6 }));
  const tip = p3; const hookEnd = localPoint(origin, yaw, spec.len/2+0.25, -0.26, spec.curve*0.34+0.12);
  meshes.push(addCylinderBetween({ group, from: tip, to: hookEnd, radius: 0.008, material: basicMat(0x151515), name:`V23-fishingRod-LINE-${primitive.id}`, userData: base, segments: 5 }));
  meshes.push(addCylinderBetween({ group, from: hookEnd, to: localPoint(origin,yaw,spec.len/2+0.36,-0.06,spec.curve*0.34+0.16), radius: 0.018, material: spec.hook === 'bone' ? bone : metal, name:`V23-fishingRod-HOOK-${primitive.id}`, userData: base, segments: 6 }));
  if (spec.reel) { const reel = new THREE.Mesh(new THREE.TorusGeometry(0.18,0.035,8,18), metal); reel.name=`V23-fishingRod-REEL-${primitive.id}`; reel.position.copy(localPoint(origin,yaw,-spec.len/2+0.9,0.18,0.2)); reel.rotation.set(Math.PI/2, yaw, 0); reel.userData=base; group.add(reel); meshes.push(reel); }
  if (spec.spines) for (let i=0;i<spec.spines;i+=1) meshes.push(addCylinderBetween({ group, from: localPoint(origin,yaw,-0.3+i*0.35,0.34,0.03), to: localPoint(origin,yaw,-0.24+i*0.35,0.58,0.03), radius: 0.025, material: metal, name:`V23-fishingRod-SPINE-${primitive.id}-${i}`, userData: base, segments: 5 }));
  if (spec.turquoise || spec.glyph || spec.pack) { const beadMat = basicMat(spec.turquoise ? 0x26a6a0 : 0xb9a26d, 0.65, 0.05, spec.turquoise ? 0x0b4d4a : 0x000000, spec.turquoise ? 0.25 : 0); for (let i=0;i<3;i+=1){ const bead=new THREE.Mesh(new THREE.SphereGeometry(0.07,10,8), beadMat); bead.name=`V23-fishingRod-ORNAMENT-${primitive.id}-${i}`; bead.position.copy(localPoint(origin,yaw,-0.2+i*0.42,0.42,0.12)); bead.userData=base; group.add(bead); meshes.push(bead); } }
  return meshes.filter(Boolean);
}

function addFishDisplay({ definition, group, primitive, materialFactory }) {
  const spec = FISH_SPECS[primitive.variant] ?? FISH_SPECS.smallRiverFish;
  const origin = toVector3(primitive.position);
  const yaw = primitive.yaw ?? 0;
  const base = {
    locationId: definition.id,
    roomId: primitive.roomId,
    itemId: primitive.itemId,
    displayPadId: primitive.userData?.displayPadId,
    objectCategory: 'fish',
    generatedBy: 'DungeonGeometryBuilder:volumetricFishTemplate',
    materialSlots: { bodyMaterial: spec.bodyMaterial, finMaterial: spec.finMaterial, eyeMaterial: 'tinyBlackEye' },
    fishConstruction: 'strict-single-template-closed-ellipsoid-body-attached-closed-fins-tail-tiny-black-eyes',
    cohesiveMainBodyGeometry: true,
    forbiddenGeometryAvoided: ['PlaneGeometry', 'Sprite', 'billboard', 'lookAt', 'flatFloatingTriangle'],
    ...primitive.userData,
  };
  const slabMat = basicMat(0x2d2922);
  const bodyMat = fishMaterial(definition, primitive, 'bodyMaterial', spec, materialFactory, 0x53635a, { emissive: spec.glow ? 0x0f6b64 : 0, emissiveIntensity: spec.glow ? 0.14 : 0 });
  const finMat = fishMaterial(definition, primitive, 'finMaterial', spec, materialFactory, 0x39433e, { emissive: spec.glow ? 0x0a4b47 : 0, emissiveIntensity: spec.glow ? 0.08 : 0 });
  const eyeMat = basicMat(0x020202, 0.28, 0.08);
  const meshes = [];

  const slab = addBox({ group, size: new THREE.Vector3(2.8, 0.16, 1.55), position: new THREE.Vector3(origin.x, 0.18, origin.z), material: slabMat, name: `V25-fishDisplay-PLINTH-${primitive.id}`, userData: base });
  slab.rotation.y = yaw;
  meshes.push(slab);

  const fishRoot = buildSimpleFish({ id: primitive.id, ...spec, bodyMaterial: bodyMat, finMaterial: finMat, eyeMaterial: eyeMat, baseUserData: base });
  fishRoot.position.set(origin.x, 0.74, origin.z);
  fishRoot.rotation.set(0, yaw, 0);
  group.add(fishRoot);
  meshes.push(fishRoot, ...fishRoot.children);
  return meshes.filter(Boolean);
}

function addV2RampsStairsBridges({ definition, group, materialFactory }) {
  const meshes = [];
  asArray(definition.ramps).forEach((ramp) => {
    const material = makeMaterial(definition, ramp.material ?? ramp.textureProfile, materialFactory, definition.textures?.floor);
    const mesh = segmentDeck(ramp.from, ramp.to, ramp.width ?? 1, ((ramp.y0 ?? 0) + (ramp.y1 ?? 0)) / 2, material, group, `V2-RAMP-${ramp.id}`, { locationId: definition.id, rampId: ramp.id, generatedBy: 'DungeonGeometryBuilder:v2.1' }, 0.14);
    if (mesh) { mesh.rotation.z = Math.atan2((ramp.y1 ?? 0) - (ramp.y0 ?? 0), point3FromXZ(ramp.from).distanceTo(point3FromXZ(ramp.to))); meshes.push(mesh); }
  });
  asArray(definition.stairs).forEach((stairs) => {
    const material = makeMaterial(definition, stairs.material ?? stairs.textureProfile, materialFactory, definition.textures?.floor);
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


const STAIR_PRIMITIVE_KINDS = new Set(['straightStair', 'wideSacredStair', 'narrowCryptStair', 'brokenStair', 'sunkenSteps', 'daisStair', 'splitStair', 'bridgeStair', 'cornerStair', 'processionalStair']);
const DOORWAY_PRIMITIVE_KINDS = new Set(['thickStoneDoorway', 'openArchPortal', 'bronzeSealedGate', 'lockedRitualGate', 'brokenGateFrame', 'doubleTempleDoor', 'returnPortalFrame', 'sunDiskThreshold', 'narrowCryptPortal', 'grandProcessionalGate']);

function stairMaterial(definition, primitive, slot, materialFactory, fallback) {
  return makeMaterial(definition, primitive[slot] ?? primitive.material ?? primitive.textureProfile, materialFactory, fallback);
}

function stairMissingSteps(primitive) {
  return new Set(asArray(primitive.missingSteps ?? primitive.brokenSteps).map((step) => Number(step)).filter((step) => Number.isInteger(step) && step >= 0));
}

function addStairPrimitive({ definition, group, materialFactory, primitive, addPart }) {
  const pos = toVector3(primitive.position);
  const yaw = primitive.yaw ?? primitive.rotation ?? 0;
  const width = primitive.width ?? (primitive.kind === 'wideSacredStair' || primitive.kind === 'processionalStair' ? 4 : primitive.kind === 'narrowCryptStair' ? 1.2 : 2.4);
  const length = primitive.length ?? primitive.depth ?? 4;
  const height = primitive.height ?? 1.2;
  const steps = Math.max(1, Math.floor(primitive.stepCount ?? primitive.steps ?? 6));
  const missing = stairMissingSteps(primitive);
  const treadMat = stairMaterial(definition, primitive, 'treadMaterial', materialFactory, definition.textures?.floor);
  const riserMat = stairMaterial(definition, primitive, 'riserMaterial', materialFactory, definition.textures?.wall);
  const sideMat = stairMaterial(definition, primitive, 'sideMaterial', materialFactory, definition.textures?.wall);
  const trimMat = stairMaterial(definition, primitive, 'trimMaterial', materialFactory, definition.textures?.wall);
  const railingMat = stairMaterial(definition, primitive, 'railingMaterial', materialFactory, definition.textures?.wall);
  const base = { locationId: definition.id, roomId: primitive.roomId, architecturalPrimitiveId: primitive.id, primitiveKind: primitive.kind, generatedBy: 'DungeonGeometryBuilder:stair-primitives', debugFootprint: { width, length, height, steps } };
  const stepDepth = length / steps;
  const stepHeight = height / steps;
  const laneCount = primitive.kind === 'splitStair' ? 2 : 1;
  const gap = primitive.kind === 'splitStair' ? Math.min(0.6, width * 0.12) : 0;
  const laneWidth = laneCount === 2 ? (width - gap) / 2 : width;
  const addLocalBox = (name, size, local, material, extra = {}) => {
    const world = pos.clone().add(new THREE.Vector3(local.x, local.y, local.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    const mesh = addBox({ group, size, position: world, material, name, userData: { ...base, ...extra } });
    mesh.rotation.y = yaw;
    addPart(mesh);
    return mesh;
  };
  for (let i = 0; i < steps; i += 1) {
    if (missing.has(i)) continue;
    const brokenScale = primitive.kind === 'brokenStair' && i % 3 === 1 ? 0.72 : 1;
    const yTop = primitive.kind === 'sunkenSteps' ? -stepHeight * (i + 1) : stepHeight * (i + 1);
    const centerZ = -length / 2 + stepDepth * (i + 0.5);
    for (let lane = 0; lane < laneCount; lane += 1) {
      const laneX = laneCount === 1 ? 0 : (lane === 0 ? -(laneWidth + gap) / 2 : (laneWidth + gap) / 2);
      addLocalBox(`V23-${primitive.kind}-TREAD-${primitive.id}-${i}-${lane}`, new THREE.Vector3(laneWidth * brokenScale, 0.08, stepDepth * 0.96), { x: laneX, y: yTop - 0.04, z: centerZ }, treadMat, { stairStepIndex: i, stairPart: 'tread' });
      addLocalBox(`V23-${primitive.kind}-RISER-${primitive.id}-${i}-${lane}`, new THREE.Vector3(laneWidth * brokenScale, Math.abs(stepHeight), 0.08), { x: laneX, y: yTop - stepHeight / 2, z: centerZ - stepDepth / 2 }, riserMat, { stairStepIndex: i, stairPart: 'riser' });
    }
  }
  if (['wideSacredStair', 'daisStair', 'processionalStair', 'cornerStair'].includes(primitive.kind)) {
    addLocalBox(`V23-${primitive.kind}-TRIM-${primitive.id}-top`, new THREE.Vector3(width + 0.35, 0.16, 0.18), { x: 0, y: height + 0.08, z: length / 2 + 0.09 }, trimMat, { stairPart: 'trim' });
  }
  if (primitive.sideWalls !== false) {
    [-1, 1].forEach((side) => addLocalBox(`V23-${primitive.kind}-SIDE-${primitive.id}-${side}`, new THREE.Vector3(0.16, Math.max(0.25, Math.abs(height)), length), { x: side * (width / 2 + 0.08), y: height / 2, z: 0 }, sideMat, { stairPart: 'side' }));
  }
  if (primitive.railings) {
    [-1, 1].forEach((side) => addLocalBox(`V23-${primitive.kind}-RAIL-${primitive.id}-${side}`, new THREE.Vector3(0.1, 0.9, length), { x: side * (width / 2 + 0.24), y: height + 0.45, z: 0 }, railingMat, { stairPart: 'railing' }));
  }
  if (primitive.kind === 'cornerStair') {
    const landing = addLocalBox(`V23-cornerStair-LANDING-${primitive.id}`, new THREE.Vector3(width, 0.12, width), { x: width / 2, y: height + 0.06, z: length / 2 }, treadMat, { stairPart: 'landing' });
    landing.rotation.y = yaw + Math.PI / 2;
  }
}


const BRIDGE_PRIMITIVE_KINDS = new Set(['narrowStoneBridge', 'wideCeremonialBridge', 'brokenBridge', 'plankBridge', 'raisedWalkway', 'canalCrossing', 'bridgeWithRailings', 'archedStoneBridge', 'ritualSpanBridge', 'collapsedWalkway']);
const COLUMN_PRIMITIVE_KINDS = new Set(['roundTempleColumn', 'squareStonePillar', 'brokenColumn', 'crackedSupportPillar', 'bronzeBandedColumn', 'glyphCarvedColumn', 'twinColumnFrame', 'massiveHallColumn', 'ruinedColumnBase', 'sacredObeliskColumn']);

function bridgeMaterial(definition, primitive, slot, materialFactory, fallback) {
  return makeMaterial(definition, primitive[slot] ?? primitive.material ?? primitive.textureProfile, materialFactory, fallback);
}

function bridgeBrokenGaps(primitive, length) {
  const gapLength = Math.max(0.35, Math.min(length * 0.38, primitive.gapLength ?? length * 0.22));
  if (primitive.kind === 'collapsedWalkway') return [{ center: 0, length: gapLength }];
  if (primitive.kind === 'brokenBridge' || primitive.broken === true || primitive.state === 'broken') return [{ center: primitive.gapOffset ?? length * 0.12, length: gapLength }];
  return [];
}

function addBridgePrimitive({ definition, group, materialFactory, primitive, addPart }) {
  const pos = toVector3(primitive.position);
  const yaw = primitive.yaw ?? primitive.rotation ?? 0;
  const width = primitive.width ?? (primitive.kind === 'wideCeremonialBridge' ? 5 : primitive.kind === 'narrowStoneBridge' ? 1.6 : 2.6);
  const length = primitive.length ?? primitive.depth ?? 6;
  const deckY = primitive.deckY ?? pos.y ?? 0.18;
  const height = primitive.height ?? Math.max(0.18, deckY);
  const thickness = primitive.thickness ?? 0.22;
  const railings = primitive.railings ?? ['bridgeWithRailings', 'wideCeremonialBridge', 'ritualSpanBridge', 'raisedWalkway'].includes(primitive.kind);
  const curbs = primitive.curbs ?? ['canalCrossing', 'archedStoneBridge', 'narrowStoneBridge'].includes(primitive.kind);
  const deckMat = bridgeMaterial(definition, primitive, 'deckMaterial', materialFactory, definition.textures?.floor);
  const sideMat = bridgeMaterial(definition, primitive, 'sideMaterial', materialFactory, definition.textures?.wall);
  const trimMat = bridgeMaterial(definition, primitive, 'trimMaterial', materialFactory, definition.textures?.wall);
  const railMat = bridgeMaterial(definition, primitive, 'railingMaterial', materialFactory, definition.textures?.wall);
  const underMat = bridgeMaterial(definition, primitive, 'undersideMaterial', materialFactory, definition.textures?.wall);
  const base = { locationId: definition.id, roomId: primitive.roomId, architecturalPrimitiveId: primitive.id, primitiveKind: primitive.kind, generatedBy: 'DungeonGeometryBuilder:bridge-primitives', debugFootprint: { width, length, height, deckY, railings, curbs, gaps: bridgeBrokenGaps(primitive, length) }, blockerBehavior: primitive.blockerBehavior ?? 'generated railings/curbs/gaps/canal-edge blockers' };
  const addLocalBox = (suffix, size, local, material, data = {}) => {
    const offset = new THREE.Vector3(local.x, local.y, local.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const mesh = addBox({ group, size, position: pos.clone().add(offset), material, name: `V25-${primitive.kind}-${suffix}-${primitive.id}`, userData: { ...base, ...data } });
    mesh.rotation.y = yaw; addPart(mesh); return mesh;
  };
  const gaps = bridgeBrokenGaps(primitive, length);
  let cursor = -length / 2;
  gaps.sort((a,b)=>a.center-b.center).forEach((gap, i) => {
    const start = Math.max(-length / 2, gap.center - gap.length / 2);
    const end = Math.min(length / 2, gap.center + gap.length / 2);
    if (start - cursor > 0.1) addLocalBox(`DECK-${i}`, new THREE.Vector3(width, thickness, start - cursor), { x: 0, y: deckY - thickness / 2, z: (cursor + start) / 2 }, deckMat, { bridgePart: 'walkableDeck' });
    cursor = Math.max(cursor, end);
  });
  if (length / 2 - cursor > 0.1) addLocalBox('DECK-end', new THREE.Vector3(width, thickness, length / 2 - cursor), { x: 0, y: deckY - thickness / 2, z: (cursor + length / 2) / 2 }, deckMat, { bridgePart: 'walkableDeck' });
  if (height > thickness) addLocalBox('UNDERSIDE', new THREE.Vector3(width * 0.86, Math.max(0.12, height), length * 0.92), { x: 0, y: deckY - thickness - height / 2, z: 0 }, underMat, { bridgePart: primitive.kind === 'archedStoneBridge' ? 'archedUndersideMass' : 'underside' });
  if (['plankBridge', 'raisedWalkway', 'collapsedWalkway'].includes(primitive.kind)) {
    const count = Math.max(3, Math.floor(length / 0.7));
    for (let i=0;i<count;i+=1) addLocalBox(`PLANK-${i}`, new THREE.Vector3(width * 0.94, 0.055, 0.08), { x: 0, y: deckY + 0.035, z: -length/2 + (i+0.5)*length/count }, trimMat, { bridgePart: 'plankSeam' });
  }
  if (curbs) [-1,1].forEach((side)=>addLocalBox(`CURB-${side}`, new THREE.Vector3(0.18, 0.24, length), { x: side*(width/2+0.09), y: deckY+0.12, z:0 }, sideMat, { bridgePart:'curb', blocksPlayer:true }));
  if (railings) [-1,1].forEach((side)=>{ addLocalBox(`RAIL-${side}`, new THREE.Vector3(0.12, 0.9, length), { x: side*(width/2+0.22), y: deckY+0.45, z:0 }, railMat, { bridgePart:'railing', blocksPlayer:true }); });
  if (primitive.kind === 'canalCrossing' || primitive.canalContext) {
    addLocalBox('WATER', new THREE.Vector3(width + 2.8, 0.035, Math.min(length * 0.72, 4.2)), { x: 0, y: Math.max(0.025, deckY - 0.32), z: 0 }, makeMaterial(definition, primitive.waterMaterial ?? 'turquoiseWater', materialFactory, definition.textures?.water), { bridgePart: 'compactCanalContext', blocksPlayer: false });
  }
}

function doorwayMaterial(definition, primitive, slot, materialFactory, fallback) {
  return makeMaterial(definition, primitive[slot] ?? primitive.material ?? primitive.textureProfile, materialFactory, fallback);
}

function addDoorwayPrimitive({ definition, group, materialFactory, primitive, addPart }) {
  const pos = toVector3(primitive.position);
  const yaw = primitive.yaw ?? primitive.rotation ?? 0;
  const width = primitive.width ?? (primitive.kind === 'narrowCryptPortal' ? 1.25 : primitive.kind === 'grandProcessionalGate' ? 5.5 : 2.8);
  const height = primitive.height ?? (primitive.kind === 'grandProcessionalGate' ? 5.4 : 3.4);
  const thickness = primitive.thickness ?? primitive.depth ?? 0.45;
  const depth = primitive.depth ?? thickness;
  const postWidth = Math.min(width * 0.22, Math.max(0.22, primitive.frameWidth ?? thickness));
  const lintelHeight = Math.min(height * 0.22, Math.max(0.22, primitive.lintelHeight ?? thickness));
  const state = primitive.state ?? (primitive.open === true || primitive.passable === true ? 'open' : undefined) ?? (primitive.blocked ? 'blocked' : 'closed');
  const frameMat = doorwayMaterial(definition, primitive, 'frameMaterial', materialFactory, definition.textures?.wall);
  const doorMat = doorwayMaterial(definition, primitive, 'doorMaterial', materialFactory, definition.textures?.wall);
  const trimMat = doorwayMaterial(definition, primitive, 'trimMaterial', materialFactory, definition.textures?.wall);
  const emblemMat = doorwayMaterial(definition, primitive, 'emblemMaterial', materialFactory, definition.textures?.wall);
  const base = { locationId: definition.id, roomId: primitive.roomId, architecturalPrimitiveId: primitive.id, primitiveKind: primitive.kind, generatedBy: 'DungeonGeometryBuilder:doorway-primitives', interaction: primitive.interaction, state, debugFootprint: { width, height, depth, thickness, state } };
  const addLocalBox = (suffix, size, local, material, data = {}) => {
    const offset = new THREE.Vector3(local.x, local.y, local.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const mesh = addBox({ group, size, position: pos.clone().add(offset), material, name: `V24-${primitive.kind}-${suffix}-${primitive.id}`, userData: { ...base, ...data } });
    mesh.rotation.y = yaw; addPart(mesh); return mesh;
  };
  [-1, 1].forEach((side) => addLocalBox(`POST-${side}`, new THREE.Vector3(postWidth, height, depth), { x: side * (width / 2 - postWidth / 2), y: height / 2, z: 0 }, frameMat, { doorwayPart: 'post' }));
  if (primitive.kind !== 'brokenGateFrame') addLocalBox('LINTEL', new THREE.Vector3(width, lintelHeight, depth), { x: 0, y: height - lintelHeight / 2, z: 0 }, frameMat, { doorwayPart: 'lintel' });
  if (['openArchPortal', 'returnPortalFrame', 'grandProcessionalGate', 'narrowCryptPortal'].includes(primitive.kind)) addLocalBox('ARCH-CAP', new THREE.Vector3(width * 0.72, lintelHeight * 0.72, depth * 1.06), { x: 0, y: height + lintelHeight * 0.16, z: 0 }, frameMat, { doorwayPart: 'archCap' });
  if (['bronzeSealedGate', 'lockedRitualGate', 'doubleTempleDoor'].includes(primitive.kind) || ['closed', 'locked', 'blocked'].includes(state)) {
    const slabW = Math.max(0.2, width - postWidth * 2.15);
    if (primitive.kind === 'doubleTempleDoor') {
      [-1, 1].forEach((side) => addLocalBox(`DOOR-${side}`, new THREE.Vector3(slabW / 2 - 0.03, height - lintelHeight * 1.15, Math.min(depth * 0.38, 0.22)), { x: side * slabW / 4, y: (height - lintelHeight) / 2, z: -depth * 0.04 }, doorMat, { doorwayPart: 'door', collisionBlockingPart: true }));
    } else addLocalBox('DOOR', new THREE.Vector3(slabW, height - lintelHeight * 1.15, Math.min(depth * 0.42, 0.24)), { x: 0, y: (height - lintelHeight) / 2, z: -depth * 0.04 }, doorMat, { doorwayPart: 'door', collisionBlockingPart: true });
  }
  if (primitive.kind !== 'thickStoneDoorway') {
    addLocalBox('THRESHOLD', new THREE.Vector3(width, 0.14, depth * 1.18), { x: 0, y: 0.07, z: 0 }, trimMat, { doorwayPart: 'threshold' });
    addLocalBox('EMBLEM', new THREE.Vector3(Math.min(width * 0.35, 1.25), Math.min(height * 0.16, 0.55), 0.08), { x: 0, y: height * 0.62, z: -depth / 2 - 0.045 }, emblemMat, { doorwayPart: 'emblem' });
  }
}


function columnMaterial(definition, primitive, slot, materialFactory, fallback) {
  return makeMaterial(definition, primitive[slot] ?? primitive.material ?? primitive.textureProfile, materialFactory, fallback);
}

function addColumnPrimitive({ definition, group, materialFactory, primitive, addPart }) {
  const pos = toVector3(primitive.position);
  const yaw = primitive.yaw ?? primitive.rotation ?? 0;
  const height = primitive.height ?? (primitive.kind === 'ruinedColumnBase' ? 1.1 : primitive.kind === 'massiveHallColumn' ? 8.8 : 4.2);
  const radius = primitive.radius ?? (primitive.kind === 'massiveHallColumn' ? 0.82 : 0.48);
  const width = primitive.width ?? radius * 2;
  const depth = primitive.depth ?? width;
  const segments = primitive.segments ?? primitive.sides ?? (primitive.kind === 'roundTempleColumn' || primitive.kind === 'bronzeBandedColumn' || primitive.kind === 'massiveHallColumn' ? 18 : 10);
  const baseSize = primitive.baseSize ?? Math.max(width, radius * 2) * 1.35;
  const capitalSize = primitive.capitalSize ?? Math.max(width, radius * 2) * 1.28;
  const baseHeight = Math.min(height * 0.18, primitive.baseHeight ?? 0.42);
  const capitalHeight = Math.min(height * 0.18, primitive.capitalHeight ?? 0.38);
  const shaftHeight = Math.max(0.2, height - baseHeight - capitalHeight);
  const shaftMat = columnMaterial(definition, primitive, 'shaftMaterial', materialFactory, definition.textures?.wall);
  const baseMat = columnMaterial(definition, primitive, 'baseMaterial', materialFactory, definition.textures?.wall);
  const capMat = columnMaterial(definition, primitive, 'capitalMaterial', materialFactory, definition.textures?.wall);
  const bandMat = columnMaterial(definition, primitive, 'bandMaterial', materialFactory, definition.textures?.bronze ?? definition.textures?.wall);
  const glyphMat = columnMaterial(definition, primitive, 'glyphMaterial', materialFactory, definition.textures?.wall);
  const trimMat = columnMaterial(definition, primitive, 'trimMaterial', materialFactory, definition.textures?.wall);
  const state = primitive.state ?? (primitive.broken ? 'broken' : primitive.cracked ? 'cracked' : primitive.ruined ? 'ruined' : 'intact');
  const baseData = { locationId: definition.id, roomId: primitive.roomId, architecturalPrimitiveId: primitive.id, primitiveKind: primitive.kind, generatedBy: 'DungeonGeometryBuilder:column-primitives', state, debugFootprint: { width, depth, radius, height, baseSize, capitalSize, segments, blocksPlayer: primitive.blocksPlayer !== false, blocksEnemies: primitive.blocksEnemies !== false } };
  const addLocalBox = (suffix, size, local, material, data = {}) => { const off = new THREE.Vector3(local.x, local.y, local.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw); const mesh = addBox({ group, size, position: pos.clone().add(off), material, name: `V26-${primitive.kind}-${suffix}-${primitive.id}`, userData: { ...baseData, ...data } }); mesh.rotation.y = yaw; addPart(mesh); return mesh; };
  const addLocalCyl = (suffix, h, r, local, material, data = {}) => { const off = new THREE.Vector3(local.x ?? 0, local.y ?? 0, local.z ?? 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw); const mesh = addCylinderPrimitive({ group, primitive: { ...primitive, position: [pos.x + off.x, pos.y + off.y, pos.z + off.z], yaw }, material, name: `V26-${primitive.kind}-${suffix}-${primitive.id}`, height: h, radius: r, sides: segments, userData: { ...baseData, ...data } }); addPart(mesh); return mesh; };
  const squareKinds = ['squareStonePillar', 'crackedSupportPillar', 'glyphCarvedColumn', 'twinColumnFrame', 'sacredObeliskColumn'];
  if (primitive.kind === 'sacredObeliskColumn') {
    addLocalBox('BASE', new THREE.Vector3(baseSize, baseHeight, baseSize), { x: 0, y: baseHeight / 2, z: 0 }, baseMat, { columnPart: 'base' });
    addLocalBox('SHAFT', new THREE.Vector3(width * 0.72, height * 0.72, depth * 0.72), { x: 0, y: baseHeight + height * 0.36, z: 0 }, shaftMat, { columnPart: 'obeliskShaft' });
    addLocalBox('TIP', new THREE.Vector3(width * 0.48, height * 0.14, depth * 0.48), { x: 0, y: height * 0.93, z: 0 }, capMat, { columnPart: 'pyramidion' });
    return;
  }
  if (primitive.kind === 'twinColumnFrame') {
    const spacing = primitive.columnSpacing ?? width * 2.2;
    [-1, 1].forEach((side) => { addLocalBox(`BASE-${side}`, new THREE.Vector3(baseSize, baseHeight, baseSize), { x: side * spacing / 2, y: baseHeight / 2, z: 0 }, baseMat, { columnPart: 'base' }); addLocalCyl(`SHAFT-${side}`, shaftHeight, radius, { x: side * spacing / 2, y: baseHeight, z: 0 }, shaftMat, { columnPart: 'shaft' }); addLocalBox(`CAPITAL-${side}`, new THREE.Vector3(capitalSize, capitalHeight, capitalSize), { x: side * spacing / 2, y: baseHeight + shaftHeight + capitalHeight / 2, z: 0 }, capMat, { columnPart: 'capital' }); });
    addLocalBox('LINTEL', new THREE.Vector3(spacing + capitalSize, capitalHeight * 1.2, depth * 0.9), { x: 0, y: height - capitalHeight * 0.4, z: 0 }, trimMat, { columnPart: 'lintel' });
    return;
  }
  addLocalBox('BASE', new THREE.Vector3(baseSize, baseHeight, baseSize), { x: 0, y: baseHeight / 2, z: 0 }, baseMat, { columnPart: 'base' });
  if (squareKinds.includes(primitive.kind)) addLocalBox('SHAFT', new THREE.Vector3(width, shaftHeight, depth), { x: 0, y: baseHeight + shaftHeight / 2, z: 0 }, shaftMat, { columnPart: 'shaft' });
  else addLocalCyl('SHAFT', shaftHeight, radius, { x: 0, y: baseHeight, z: 0 }, shaftMat, { columnPart: 'shaft' });
  if (!['brokenColumn', 'ruinedColumnBase'].includes(primitive.kind)) addLocalBox('CAPITAL', new THREE.Vector3(capitalSize, capitalHeight, capitalSize), { x: 0, y: baseHeight + shaftHeight + capitalHeight / 2, z: 0 }, capMat, { columnPart: 'capital' });
  if (['bronzeBandedColumn', 'massiveHallColumn'].includes(primitive.kind)) [0.28, 0.62, 0.86].forEach((t, i) => addLocalBox(`BAND-${i}`, new THREE.Vector3(width * 1.12, 0.12, depth * 1.12), { x: 0, y: baseHeight + shaftHeight * t, z: 0 }, bandMat, { columnPart: 'band' }));
  if (['glyphCarvedColumn', 'crackedSupportPillar'].includes(primitive.kind)) addLocalBox('GLYPH-PANEL', new THREE.Vector3(width * 1.02, shaftHeight * 0.46, 0.08), { x: 0, y: baseHeight + shaftHeight * 0.56, z: -depth / 2 - 0.045 }, glyphMat, { columnPart: 'glyphPanel' });
  if (state !== 'intact') addLocalBox('DAMAGE-SCAR', new THREE.Vector3(width * 0.72, Math.max(0.12, shaftHeight * 0.08), 0.1), { x: width * 0.12, y: baseHeight + shaftHeight * 0.72, z: -depth / 2 - 0.06 }, trimMat, { columnPart: 'damageMarker' });
}


function primitiveMaterial(definition, primitive, materialFactory, fallback = definition.textures?.wall) {
  return makeMaterial(definition, primitive.material ?? primitive.textureProfile, materialFactory, fallback);
}

function yawOf(from, to) {
  return Math.atan2(to.z - from.z, to.x - from.x);
}

function applyCylinderWorldUvs(geometry, radius, height, profile = {}) {
  const uv = geometry.getAttribute('uv');
  const pos = geometry.getAttribute('position');
  if (!uv || !pos) return geometry;
  const scale = profile.cylinderUvScale ?? profile.boxUvScale ?? [0.25, 0.18];
  const uScale = Number(scale[0]) || 0.25;
  const vScale = Number(scale[1]) || 0.18;
  for (let i = 0; i < uv.count; i += 1) {
    const x = pos.getX(i); const y = pos.getY(i) + height / 2; const z = pos.getZ(i);
    const theta = Math.atan2(z, x);
    const around = ((theta + Math.PI) / (Math.PI * 2)) * Math.PI * 2 * radius;
    uv.setXY(i, around * uScale, y * vScale);
  }
  uv.needsUpdate = true;
  return geometry;
}

function addCylinderPrimitive({ group, primitive, material, name, height, radius, sides = 8, userData = {} }) {
  const geometry = applyCylinderWorldUvs(new THREE.CylinderGeometry(radius, radius, height, Math.max(6, sides)), radius, height, material?.userData?.definitionProfile ?? {});
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(toVector3(primitive.position));
  mesh.position.y += height / 2;
  mesh.rotation.y = primitive.yaw ?? 0;
  if (primitive.tilt) mesh.rotation.z = primitive.tilt;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { locationId: primitive.locationId, roomId: primitive.roomId, architecturalPrimitiveId: primitive.id, primitiveKind: primitive.kind, generatedBy: 'DungeonGeometryBuilder:v2.3', ...userData };
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
    if (COLUMN_PRIMITIVE_KINDS.has(primitive.kind)) {
      addColumnPrimitive({ definition, group, materialFactory, primitive, addPart });
    } else if (BRIDGE_PRIMITIVE_KINDS.has(primitive.kind)) {
      addBridgePrimitive({ definition, group, materialFactory, primitive, addPart });
    } else if (STAIR_PRIMITIVE_KINDS.has(primitive.kind)) {
      addStairPrimitive({ definition, group, materialFactory, primitive, addPart });
    } else if (DOORWAY_PRIMITIVE_KINDS.has(primitive.kind)) {
      addDoorwayPrimitive({ definition, group, materialFactory, primitive, addPart });
    } else if (primitive.kind === 'pillar' || primitive.kind === 'brokenPillar') {
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
    } else if (primitive.kind === 'hangingSign') {
      const pos = toVector3(primitive.position); const yaw = primitive.yaw ?? 0; const width = primitive.width ?? 8; const height = primitive.height ?? 3; const thickness = primitive.thickness ?? 0.22;
      const frameMaterial = makeMaterial(definition, primitive.frameMaterial ?? primitive.material, materialFactory, definition.textures?.wall);
      const chainMaterial = makeMaterial(definition, primitive.chainMaterial ?? primitive.frameMaterial ?? primitive.material, materialFactory, definition.textures?.wall);
      const panel = addBox({ group, size: new THREE.Vector3(width, height, thickness), position: pos, material: frameMaterial, name: `V23-hangingSign-PANEL-${primitive.id}`, userData: base }); panel.rotation.y = yaw; addPart(panel);
      const faceGeometry = new THREE.PlaneGeometry(width * 0.86, height * 0.68);
      const face = new THREE.Mesh(faceGeometry, material);
      face.name = `V23-hangingSign-FACE-${primitive.id}`;
      const front = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      face.position.copy(pos.clone().add(front.multiplyScalar(thickness / 2 + 0.012)));
      face.rotation.y = yaw;
      face.castShadow = true; face.receiveShadow = true; face.userData = { ...base, hangingSignFace: true }; group.add(face); addPart(face);
      const trimY = height / 2 - 0.12;
      [-1, 1].forEach((side) => {
        const railOffset = new THREE.Vector3(0, side * trimY, thickness / 2 + 0.025).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const rail = addBox({ group, size: new THREE.Vector3(width * 0.96, 0.14, 0.12), position: pos.clone().add(railOffset), material: frameMaterial, name: `V23-hangingSign-RAIL-${primitive.id}-${side}`, userData: base }); rail.rotation.y = yaw; addPart(rail);
      });
      const chainTopY = primitive.chainTopY ?? 9.2; const chainWidth = primitive.chainWidth ?? 0.08; const anchorX = width * 0.42;
      [-1, 1].forEach((xSide) => {
        const anchor = new THREE.Vector3(xSide * anchorX, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(pos);
        const chainHeight = Math.max(0.2, chainTopY - (pos.y + height / 2));
        const chain = addBox({ group, size: new THREE.Vector3(chainWidth, chainHeight, chainWidth), position: new THREE.Vector3(anchor.x, pos.y + height / 2 + chainHeight / 2, anchor.z), material: chainMaterial, name: `V23-hangingSign-CHAIN-${primitive.id}-${xSide}`, userData: base }); chain.rotation.y = yaw; addPart(chain);
      });
    } else if (primitive.kind === 'obelisk') {
      const pos = toVector3(primitive.position); const height = primitive.height ?? 3; const width = primitive.baseWidth ?? 0.7; const baseBox = addBox({ group, size: new THREE.Vector3(width, height * 0.78, width), position: new THREE.Vector3(pos.x, pos.y + height * 0.39, pos.z), material, name: `V23-obelisk-SHAFT-${primitive.id}`, userData: base }); baseBox.rotation.y = primitive.yaw ?? 0; addPart(baseBox); const tip = addBox({ group, size: new THREE.Vector3(width * 0.65, height * 0.22, width * 0.65), position: new THREE.Vector3(pos.x, pos.y + height * 0.89, pos.z), material, name: `V23-obelisk-TIP-${primitive.id}`, userData: base }); tip.rotation.y = (primitive.yaw ?? 0) + Math.PI / 4; addPart(tip);
    } else if (primitive.kind === 'wallPanel') {
      const wall = walls.get(primitive.wallSegmentId); if (!wall) return; const from = point3FromXZ(wall.from, wall.y ?? 0); const to = point3FromXZ(wall.to, wall.y ?? 0); const dir = to.clone().sub(from).normalize(); const normal = new THREE.Vector3(-dir.z, 0, dir.x); const pos = from.clone().lerp(to, primitive.t ?? 0.5).add(normal.multiplyScalar(primitive.offset ?? 0.08)); pos.y = (wall.y ?? 0) + (primitive.height ?? 1.8) / 2 + (primitive.y ?? 0.8); const panel = addBox({ group, size: new THREE.Vector3(primitive.width ?? 1, primitive.height ?? 1.5, primitive.thickness ?? 0.08), position: pos, material, name: `V23-wallPanel-${primitive.id}`, userData: { ...base, wallSegmentId: primitive.wallSegmentId } }); panel.rotation.y = Math.atan2(dir.z, dir.x); addPart(panel);
    } else if (primitive.kind === 'fishingRodDisplay') {
      addFishingRodDisplay({ definition, group, primitive }).forEach(addPart);
    } else if (primitive.kind === 'fishDisplay') {
      addFishDisplay({ definition, group, primitive, materialFactory }).forEach(addPart);
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
  const horizontalSurfaces = addHorizontalSurfaces({ definition, group, materialFactory });
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

  return { group, props, lights, torchObjects, pointLights, v2Floors, horizontalSurfaces, v2Walls, v2Paths, v2Platforms, v2VerticalLinks, v2Anchors, v23Primitives };
}
