import { getLocationDefinition, hasLocationDefinition } from './locations/locationRegistry.js';

const FIELD_AREA_ALIASES = Object.freeze(new Set(['field', 'reliquary-field']));

export function resolveStartupArea(requestedArea) {
  if (!requestedArea) return 'folsom';
  if (FIELD_AREA_ALIASES.has(requestedArea)) return 'field';
  if (requestedArea === 'dungeon') return 'dungeon';

  const requestedLocation = getLocationDefinition(requestedArea);
  if (requestedLocation?.tags?.includes('compiled-runtime')) return requestedArea;
  if (hasLocationDefinition(requestedArea)) return requestedArea;

  return 'folsom';
}
