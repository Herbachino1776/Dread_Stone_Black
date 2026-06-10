export const DEFAULT_GORE_PROFILE = Object.freeze({
  id: 'default',
  bloodColor: 0x240006,
  bloodSecondaryColor: 0x050000,
  particleOpacity: 0.78,
  mistOpacity: 0.42,
  hitParticleCount: 16,
  heavyParticleCount: 28,
  sprayStrength: 1,
  particleLifeSeconds: 0.62,
  particleSize: [0.045, 0.12],
  particleBurstType: 'droplet',
  heavyBurstType: 'chunky',
  decalType: 'splat',
  wallDecalType: 'spray',
  woundType: 'slash',
  woundColor: 0x160005,
  woundScale: 0.58,
  hitDecalScale: [0.34, 0.74],
  wallDecalScale: [0.44, 0.98],
  deathPoolScale: [1.0, 1.65],
  deathPoolOpacity: 0.72,
  corpsePersistenceWeight: 1,
  tags: Object.freeze([]),
});

export function mergeGoreProfiles(...profiles) {
  return Object.freeze(profiles.reduce((merged, profile) => {
    if (!profile) return merged;
    return { ...merged, ...profile };
  }, { ...DEFAULT_GORE_PROFILE }));
}

export function resolveGoreProfile({ creatureId, weaponId, registry = {} } = {}) {
  return mergeGoreProfiles(
    DEFAULT_GORE_PROFILE,
    registry.creatures?.default,
    registry.creatures?.[creatureId],
    registry.weapons?.[weaponId],
  );
}

