import assert from 'node:assert/strict';
import { getLocationDefinition } from '../src/game/locations/locationRegistry.js';

const folsom = getLocationDefinition('folsom');
assert.ok(folsom, 'Folsom definition is registered.');
assert.equal(folsom.id, 'folsom');
assert.equal((folsom.spawns ?? []).some((spawn) => ['enemy', 'npc'].includes(spawn.kind)), false, 'Folsom has no enemy or NPC spawns.');
assert.ok((folsom.waterBodies ?? []).some((water) => water.fishable), 'Folsom keeps fishable pond.');
console.log('Folsom is registered without enemy/NPC spawns and keeps fishable pond.');
