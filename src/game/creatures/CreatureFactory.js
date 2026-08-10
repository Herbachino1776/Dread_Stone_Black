import { HumanoidCombatActor } from '../combat/HumanoidCombatActor.js';
import { CreatureDefinitionRegistry } from './CreatureDefinitionRegistry.js';
import { CreaturePackRegistry } from './CreaturePackRegistry.js';
import {
  assessCreaturePackRuntimeSupport,
  composeHumanoidCreatureRuntimeProfile,
} from './CreatureRuntimePolicies.js';

export class CreatureFactoryError extends Error {
  constructor(code, message, options = {}) {
    super(`[Creature Factory:${code}] ${message}`, options);
    this.name = 'CreatureFactoryError';
    this.code = code;
  }
}

export class CreatureFactory {
  constructor({
    definitionRegistry = new CreatureDefinitionRegistry(),
    creaturePackRegistry = new CreaturePackRegistry(),
    actorConstructor = HumanoidCombatActor,
  } = {}) {
    this.definitionRegistry = definitionRegistry;
    this.creaturePackRegistry = creaturePackRegistry;
    this.actorConstructor = actorConstructor;
  }

  async resolve(definitionId) {
    let definition;
    try {
      definition = this.definitionRegistry.getDefinition(definitionId);
    } catch (error) {
      throw new CreatureFactoryError(error.code ?? 'UNKNOWN_DEFINITION', error.message, { cause: error });
    }

    let pack;
    try {
      pack = await this.creaturePackRegistry.loadPack(definition.creaturePackId);
    } catch (error) {
      const code = error.code === 'UNKNOWN_PACK' ? 'MISSING_PACK' : 'PACK_RESOLUTION_FAILED';
      throw new CreatureFactoryError(code, `Creature Definition "${definitionId}" could not resolve Creature Pack "${definition.creaturePackId}": ${error.message}`, { cause: error });
    }

    const support = assessCreaturePackRuntimeSupport(pack, definition);
    if (!support.supported) {
      throw new CreatureFactoryError(support.code, `Creature Definition "${definitionId}" cannot use Creature Pack "${definition.creaturePackId}": ${support.reason}`);
    }
    const profile = composeHumanoidCreatureRuntimeProfile(pack, definition);
    return Object.freeze({ definition, pack, profile });
  }

  createActorFromResolved(resolved, actorOptions = {}) {
    if (!resolved?.definition || !resolved?.pack || !resolved?.profile) {
      throw new CreatureFactoryError('INVALID_RESOLUTION', 'A resolved definition, pack, and runtime profile are required before actor construction.');
    }
    const actor = new this.actorConstructor({ ...actorOptions, visualProfile: resolved.profile });
    return { ...resolved, actor };
  }

  async createActor(definitionId, actorOptions = {}) {
    return this.createActorFromResolved(await this.resolve(definitionId), actorOptions);
  }
}
