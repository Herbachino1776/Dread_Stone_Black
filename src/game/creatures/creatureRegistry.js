import { registerCreatureConfigs } from '../../engine/creatures/CreatureRuntimeRegistry.js';
import { ramManFriendlyConfig } from './ramManFriendly.config.js';
import { ramManConfig } from './ramMan.config.js';
import { sheepDemonConfig } from './sheepDemon.config.js';
import { neckManConfig } from './neckMan.config.js';

export const CREATURE_CONFIGS = Object.freeze([
  ramManConfig,
  ramManFriendlyConfig,
  sheepDemonConfig,
  neckManConfig,
]);

registerCreatureConfigs(CREATURE_CONFIGS);

export {
  ramManConfig,
  ramManFriendlyConfig,
  sheepDemonConfig,
  neckManConfig,
};
