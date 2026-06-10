export const LOCATION_TYPES = Object.freeze(['field', 'dungeon', 'crypt', 'temple']);
export const BLOCKER_TYPES = Object.freeze(['wall', 'prop', 'altar', 'counter', 'divider', 'gate', 'exterior', 'hazard']);
export const SPAWN_KINDS = Object.freeze(['player', 'enemy', 'npc', 'return', 'debug']);
export const LIGHT_KINDS = Object.freeze(['ambient', 'directional', 'point', 'torch']);

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function hasUsableId(value) {
  return typeof value?.id === 'string' && value.id.trim().length > 0;
}

export function rectCenter(rect) {
  return {
    x: (rect.minX + rect.maxX) / 2,
    y: rect.y ?? 0,
    z: (rect.minZ + rect.maxZ) / 2,
  };
}

export function rectFromCenter({ x, z, width, depth }) {
  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  };
}

export function resolveTextureProfile(definition, reference, fallback = null) {
  if (!reference) return fallback;
  if (typeof reference === 'string') {
    return definition.textures?.[reference] ?? fallback;
  }
  if (reference.texture) {
    return {
      ...(definition.textures?.[reference.texture] ?? {}),
      ...reference,
    };
  }
  return reference;
}
