const cloneTags = (tags = []) => [...tags];

const stamp = (definition) => ({ ...definition, tags: cloneTags(definition.tags) });

export const terrainStampKit = Object.freeze({
  softTownRise({ id, center, radius, height, tags = [] }) {
    return stamp({ id, kind: 'hill', center, radius, height, tags: ['terrain-kit', 'soft-town-rise', ...tags] });
  },

  shallowGully({ id, center, radius, depth, tags = [] }) {
    return stamp({ id, kind: 'hollow', center, radius, depth, tags: ['terrain-kit', 'shallow-gully', ...tags] });
  },

  linearDrainageGully({ id, path, width, depth, tags = [] }) {
    return stamp({ id, kind: 'ravine', path, width, depth, tags: ['terrain-kit', 'linear-drainage-gully', ...tags] });
  },

  boundaryRidge({ id, path, width, height, tags = [] }) {
    return stamp({ id, kind: 'ridge', path, width, height, tags: ['terrain-kit', 'boundary-ridge', ...tags] });
  },

  buildingPad({ id, center, radius, y, tags = [] }) {
    return stamp({ id, kind: 'flatten', center, radius, y, tags: ['terrain-kit', 'building-pad', ...tags] });
  },

  courtyardShelf({ id, center, radius, y, tags = [] }) {
    return stamp({ id, kind: 'flatten', center, radius, y, tags: ['terrain-kit', 'courtyard-shelf', ...tags] });
  },

  shrineKnoll({ id, center, radius, height, tags = [] }) {
    return stamp({ id, kind: 'hill', center, radius, height, tags: ['terrain-kit', 'shrine-knoll', ...tags] });
  },

  pondApproachBasin({ id, center, radius, depth, tags = [] }) {
    return stamp({ id, kind: 'hollow', center, radius, depth, tags: ['terrain-kit', 'pond-approach-basin', ...tags] });
  },

  roadCut({ id, path, width, depth, tags = [] }) {
    return stamp({ id, kind: 'ravine', path, width, depth, tags: ['terrain-kit', 'road-cut', ...tags] });
  },

  microBumpField({ idPrefix, bumps, tags = [] }) {
    return bumps.map((bump, index) => stamp({
      id: `${idPrefix}_${String(index + 1).padStart(2, '0')}`,
      kind: bump.height >= 0 ? 'hill' : 'hollow',
      center: bump.center,
      radius: bump.radius,
      ...(bump.height >= 0 ? { height: bump.height } : { depth: Math.abs(bump.height) }),
      tags: ['terrain-kit', 'micro-bump', ...tags, ...(bump.tags ?? [])],
    }));
  },
});
