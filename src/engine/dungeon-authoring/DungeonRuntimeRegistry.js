const dungeonRuntimeRegistry = new Map();

export function registerDungeonRuntime(runtime) {
  if (!runtime?.locationId) return runtime;
  dungeonRuntimeRegistry.set(runtime.locationId, runtime);
  return runtime;
}

export function getDungeonRuntime(locationId) {
  return dungeonRuntimeRegistry.get(locationId) ?? null;
}

export function hasDungeonRuntime(locationId) {
  return dungeonRuntimeRegistry.has(locationId);
}

export function listDungeonRuntimes() {
  return [...dungeonRuntimeRegistry.values()];
}

export function clearDungeonRuntimeRegistry() {
  dungeonRuntimeRegistry.clear();
}
