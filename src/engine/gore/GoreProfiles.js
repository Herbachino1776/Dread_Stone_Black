export const GORE_COLOR_TUNING = Object.freeze({
  freshBloodColor: 0xb00016,
  wetHighlightColor: 0xe02028,
  arterialBloodColor: 0xc91520,
  pooledBloodColor: 0x65000b,
  driedBloodColor: 0x2a0004,
  occultBloodColor: 0x12000a,
});

export const DEFAULT_GORE_PROFILE = Object.freeze({
  id: 'default',
  freshBloodColor: GORE_COLOR_TUNING.freshBloodColor,
  wetHighlightColor: GORE_COLOR_TUNING.wetHighlightColor,
  pooledBloodColor: GORE_COLOR_TUNING.pooledBloodColor,
  driedBloodColor: GORE_COLOR_TUNING.driedBloodColor,
  bloodColor: GORE_COLOR_TUNING.freshBloodColor,
  bloodSecondaryColor: GORE_COLOR_TUNING.pooledBloodColor,
  particleOpacity: 0.9,
  hitParticleOpacity: 0.9,
  mistOpacity: 0.22,
  hitParticleCount: 17,
  heavyParticleCount: 29,
  sprayStrength: 1.08,
  dropletGravity: 3.65,
  particleLifeSeconds: 0.5,
  particleSize: [0.06, 0.16],
  streakParticleSize: [0.11, 0.28],
  brightDropletChance: 0.16,
  streakParticleChance: 0.24,
  particleBurstType: 'droplet',
  heavyBurstType: 'chunky',
  decalType: 'splat',
  wallDecalType: 'spray',
  woundType: 'slash',
  woundColor: GORE_COLOR_TUNING.freshBloodColor,
  woundScale: 0.58,
  hitDecalScale: [0.42, 0.86],
  wallDecalScale: [0.62, 1.18],
  deathPoolScale: [1.4, 2.2],
  deathPoolGrowSeconds: [1.5, 2.6],
  deathPoolOpacity: 0.82,
  decalOpacity: 0.74,
  wallSprayOpacity: 0.72,
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
