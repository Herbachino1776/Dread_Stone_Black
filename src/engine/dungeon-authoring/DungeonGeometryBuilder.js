import * as THREE from 'three';
import { asArray, resolveTextureProfile } from './DungeonDefinitionTypes.js';

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

function addLights({ definition, group, torchFactory }) {
  return asArray(definition.lights).map((light) => {
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

export function buildDungeonGeometry(definition, { materialFactory = null, torchFactory = null } = {}) {
  const group = new THREE.Group();
  group.name = `${definition.id}-compiled-runtime`;
  group.userData = {
    locationId: definition.id,
    displayName: definition.displayName,
    generatedBy: 'DungeonCompiler',
  };

  asArray(definition.rooms).forEach((room) => addRoomGeometry({ definition, group, room, materialFactory }));
  const props = addProps({ definition, group, materialFactory });
  const lights = addLights({ definition, group, torchFactory });

  return { group, props, lights };
}
