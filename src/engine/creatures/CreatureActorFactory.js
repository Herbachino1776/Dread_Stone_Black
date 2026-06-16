import { CreatureActor } from './CreatureActor.js';
import { getCreatureConfig } from './CreatureRuntimeRegistry.js';

export function createCreatureActor(id, options = {}) {
  const { config: overrideConfig = null, ...actorOptions } = options;
  const config = overrideConfig ?? getCreatureConfig(id);
  if (!config) throw new Error(`Unknown creature config: ${id}`);
  return new CreatureActor(config, actorOptions);
}

export class CreatureActorFactory {
  static create(id, options = {}) {
    return createCreatureActor(id, options);
  }
}
