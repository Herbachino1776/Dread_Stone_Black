import * as THREE from 'three';

export const OUTDOOR_LIGHT_OWNER = Object.freeze({
  WORLD: 'world',
  PLAYER: 'player',
  CAMERA: 'camera',
});

export function sampleBoundedLight(profile, distance) {
  const range = Math.max(0, profile?.distance ?? 0);
  const d = Math.max(0, Number(distance) || 0);
  if (range === 0 || d >= range) return 0;
  const decay = Math.max(0, profile?.decay ?? 2);
  const normalized = d / range;
  const cutoff = (1 - normalized ** 4) ** 2;
  return (profile?.intensity ?? 0) * cutoff / Math.max(1, d ** decay);
}

function worldPosition(light) {
  const position = new THREE.Vector3();
  light.getWorldPosition?.(position);
  return { x: position.x, y: position.y, z: position.z };
}

function hierarchyVisible(object) {
  let current = object;
  while (current) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  return true;
}

export class OutdoorLightSourceRegistry {
  constructor(scene) {
    this.scene = scene;
    this.entries = new Map();
    scene.userData.outdoorLightSourceRegistry = this;
  }

  register(light, { name = light?.name, type = light?.type, owner = OUTDOOR_LIGHT_OWNER.WORLD, source, global = false } = {}) {
    if (!light?.isLight) throw new Error('Outdoor light registry accepts THREE.Light instances only.');
    if (!name || !source) throw new Error('Outdoor light sources require explicit names and sources.');
    const entry = { light, name, type, owner, source, global: global === true };
    light.userData.outdoorLightSource = { name, type, owner, source, global: entry.global };
    this.entries.set(light.uuid, entry);
    return light;
  }

  unregister(light) { this.entries.delete(light?.uuid); }

  getDiagnostics() {
    return [...this.entries.values()].map((entry) => ({
      name: entry.name,
      type: entry.type,
      owner: entry.owner,
      source: entry.source,
      intensity: hierarchyVisible(entry.light) ? entry.light.intensity : 0,
      range: entry.light.distance ?? 0,
      position: worldPosition(entry.light),
      castShadow: entry.light.castShadow === true,
      global: entry.global,
      active: hierarchyVisible(entry.light) && entry.light.intensity > 0,
    }));
  }

  getActiveDiagnostics() { return this.getDiagnostics().filter((entry) => entry.active); }

  getActivePlayerLights() {
    return this.getActiveDiagnostics().filter((entry) => entry.owner === OUTDOOR_LIGHT_OWNER.PLAYER || entry.owner === OUTDOOR_LIGHT_OWNER.CAMERA);
  }

  disableAnonymousCameraLights(camera) {
    const disabled = [];
    camera?.traverse?.((object) => {
      if (!object.isLight || object.layers.mask !== 1 || this.entries.has(object.uuid)) return;
      if (object.intensity > 0) disabled.push(object.name || object.type);
      object.intensity = 0;
      object.castShadow = false;
    });
    return disabled;
  }

  disableUnregisteredWorldLights() {
    const disabled = [];
    this.scene?.traverse?.((object) => {
      if (!object.isLight || object.layers.mask !== 1 || this.entries.has(object.uuid)) return;
      if (object.intensity > 0) disabled.push(object.name || object.type);
      object.intensity = 0;
      object.castShadow = false;
    });
    return disabled;
  }
}

export function getOutdoorLightSourceRegistry(scene) {
  if (!scene) return null;
  return scene.userData.outdoorLightSourceRegistry ?? new OutdoorLightSourceRegistry(scene);
}

export function findOutdoorScene(object) {
  let current = object;
  while (current && !current.isScene) current = current.parent;
  return current?.isScene ? current : null;
}
