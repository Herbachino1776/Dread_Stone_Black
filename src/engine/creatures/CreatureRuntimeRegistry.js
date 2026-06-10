const creatureConfigs = new Map();

export function registerCreatureConfig(config) {
  if (!config?.id) throw new Error('Creature config requires an id.');
  creatureConfigs.set(config.id, config);
  return config;
}

export function registerCreatureConfigs(configs = []) {
  configs.forEach((config) => registerCreatureConfig(config));
}

export function getCreatureConfig(id) {
  return creatureConfigs.get(id) ?? null;
}

export function listCreatureConfigs() {
  return [...creatureConfigs.values()];
}

export function clearCreatureRegistry() {
  creatureConfigs.clear();
}
